import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabaseClient'
import type { CustomerOrderPayload } from '@/lib/types'

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const payload: CustomerOrderPayload = await request.json()

    if (!payload.items || !Array.isArray(payload.items) || payload.items.length === 0) {
      return NextResponse.json({ error: 'Order must contain at least one item' }, { status: 400 })
    }

    const orderNum = Math.floor(100 + Math.random() * 900)
    const orderId = `CUST-${orderNum}`
    const sourcePlatform = `Customer Web (${payload.table_number || 'Mobile App'})`

    // Extract allergy notes from modifications
    const allergyTags: string[] = []
    payload.items.forEach((item) => {
      if (item.allergy_alert) allergyTags.push(item.allergy_alert)
      if (item.modifications) {
        item.modifications.forEach((m) => {
          if (m.toUpperCase().includes('NO ') || m.toUpperCase().includes('ALLERGY')) {
            allergyTags.push(m)
          }
        })
      }
    })

    const newOrder = {
      order_id: orderId,
      source_platform: sourcePlatform,
      items: payload.items,
      status: 'pending',
      received_at: new Date().toISOString(),
      allergy_notes: allergyTags.length > 0 ? allergyTags.join(' • ') : null,
    }

    const { data, error } = await supabase
      .from('orders')
      .insert(newOrder)
      .select()
      .single()

    if (error) {
      console.error('[Place Order] DB insert error:', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      order: data || newOrder,
      order_id: orderId,
      message: 'Order dispatched directly to kitchen display system.',
    })
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Order submission failed' },
      { status: 500 }
    )
  }
}
