import { NextResponse } from 'next/server'
import { GoogleGenAI } from '@google/genai'
import { supabase } from '@/lib/supabaseClient'
import type { OrderItem } from '@/lib/types'

interface ExtractedPayload {
  order_id: string | 'ERROR'
  source_platform: string | 'ERROR'
  items: Array<{
    name: string | 'ERROR'
    quantity: number | 'ERROR'
  }>
}

export async function POST(request: Request): Promise<NextResponse> {
  // ── 1. Authorization Gate ──
  const incomingSecret = request.headers.get('x-webhook-secret')
  const expectedSecret = process.env.WEBHOOK_SECRET

  if (!expectedSecret || incomingSecret !== expectedSecret) {
    return NextResponse.json(
      { error: 'Unauthorized: missing or invalid x-webhook-secret header' },
      { status: 401 }
    )
  }

  const rawPayload = await request.text()
  const sourceIp = request.headers.get('x-forwarded-for') || '127.0.0.1'

  // Helper to send straight to Dead Letter Queue (DLQ)
  const routeToDLQ = async (errorMessage: string) => {
    try {
      await supabase.from('failed_webhooks').insert({
        raw_payload: rawPayload,
        error_message: errorMessage,
        source_ip: sourceIp,
      })
    } catch (insertErr) {
      console.error('[DLQ Insert Error]:', insertErr)
    }

    return NextResponse.json(
      {
        status: 'dlq_routed',
        agent: 'ANT',
        error: `Payload failed zero-liability validation and was routed to DLQ: ${errorMessage}`,
      },
      { status: 500 }
    )
  }

  // ── 2. AI Extraction with Zero-Liability Financial Safety Rules ──
  try {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return await routeToDLQ('GEMINI_API_KEY is not configured in environment')
    }

    const ai = new GoogleGenAI({ apiKey })

    const prompt = `You are a zero-liability data extraction engine for a commercial dark kitchen.
Analyze the following raw delivery webhook payload:
"""${rawPayload}"""

Extract the order information strictly matching this JSON schema:
{
  "order_id": string,
  "source_platform": string,
  "items": [
    {
      "name": string,
      "quantity": number or "ERROR"
    }
  ]
}

EXTRACTION GUIDELINES:
- If an order number or ID is present anywhere in the text (e.g. '#ZOM-882', 'order #4521', 'ref: 9910'), extract that as order_id without the hash symbol.
- If the platform is mentioned (e.g. Zomato, Swiggy, UberEats, DoorDash), extract it as source_platform.

CRITICAL FINANCIAL RULE:
If the exact item quantity or name cannot be determined with absolute certainty, you must return the string 'ERROR' for that field. Do NOT default to 1. Do NOT guess.

Return ONLY the raw JSON object, without markdown code fences, without explanation.`

    const candidateModels = [
      process.env.GEMINI_MODEL,
      'gemini-3.8-flash',
      'gemini-2.5-flash',
      'gemini-2.0-flash',
    ].filter(Boolean) as string[]

    let aiResponseText = ''
    let lastError: Error | null = null

    for (const modelName of candidateModels) {
      try {
        const resp = await ai.models.generateContent({
          model: modelName,
          contents: prompt,
        })
        if (resp.text) {
          aiResponseText = resp.text
          break
        }
      } catch (err) {
        lastError = err as Error
        console.warn(`[ANT Gemini] Model ${modelName} failed, trying next candidate:`, (err as Error).message)
      }
    }

    if (!aiResponseText) {
      return await routeToDLQ(`All Gemini candidate models failed: ${lastError?.message || 'Empty response'}`)
    }

    let cleanText = aiResponseText
    cleanText = cleanText.replace(/```json/gi, '').replace(/```/g, '').trim()

    let parsed: ExtractedPayload
    try {
      parsed = JSON.parse(cleanText)
    } catch (parseErr) {
      return await routeToDLQ(`AI response was not valid JSON: ${(parseErr as Error).message}`)
    }

    // ── 3. Strict Validation Checks ──
    if (!parsed.order_id || parsed.order_id === 'ERROR') {
      return await routeToDLQ('Order ID could not be determined with absolute certainty')
    }

    if (!parsed.source_platform || parsed.source_platform === 'ERROR') {
      return await routeToDLQ('Source platform could not be determined with certainty')
    }

    if (!Array.isArray(parsed.items) || parsed.items.length === 0) {
      return await routeToDLQ('No valid items found in order payload')
    }

    for (const item of parsed.items) {
      if (!item.name || item.name === 'ERROR') {
        return await routeToDLQ('One or more item names was flagged as ERROR (uncertainty detected)')
      }
      if (item.quantity === 'ERROR' || typeof item.quantity !== 'number' || item.quantity <= 0) {
        return await routeToDLQ(`Uncertain item quantity flagged as ERROR for item: ${item.name}`)
      }
    }

    // ── 4. Insert Normalized Order into Supabase ──
    const sanitizedItems: OrderItem[] = parsed.items.map((i) => ({
      name: String(i.name),
      quantity: Number(i.quantity),
    }))

    const { data: insertedOrder, error: dbError } = await supabase
      .from('orders')
      .insert({
        order_id: String(parsed.order_id),
        source_platform: String(parsed.source_platform),
        items: sanitizedItems,
        status: 'pending',
      })
      .select()
      .single()

    if (dbError) {
      return await routeToDLQ(`Database insert error: ${dbError.message}`)
    }

    return NextResponse.json(
      {
        status: 'acknowledged',
        agent: 'ANT',
        orderId: parsed.order_id,
        platform: parsed.source_platform,
        itemCount: sanitizedItems.length,
        receivedAt: insertedOrder?.received_at || new Date().toISOString(),
      },
      { status: 200 }
    )
  } catch (error) {
    return await routeToDLQ(`AI or Execution Exception: ${(error as Error).message}`)
  }
}

export async function GET(): Promise<NextResponse> {
  const { data: orders, error } = await supabase
    .from('orders')
    .select('*')
    .eq('status', 'pending')
    .order('received_at', { ascending: false })

  if (error) {
    return NextResponse.json({ agent: 'ANT', orders: [], error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    agent: 'ANT',
    status: 'online',
    orders: orders || [],
  })
}
