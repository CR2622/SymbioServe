import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabaseClient'
import type { InventoryRow, SlimeEvaluation } from '@/lib/types'

/**
 * Autonomous SLIME Continuous Decay Pricing Route
 *
 * Implements continuous proportional decay algorithm:
 *   time_ratio = clamp(hours_remaining / 48, 0, 1)
 *   stock_pressure = current_stock_kg / initial_stock_kg
 *   urgency = (1 - time_ratio) * stock_pressure
 *   decay_factor = clamp(1 - (urgency * 0.40), 0.60, 1.00)
 *   dynamic_price = round(base_cost * decay_factor, 2)
 */
export async function POST(request: Request): Promise<NextResponse> {
  // Authorization Gate (Accepts WEBHOOK_SECRET or admin call)
  const incomingSecret = request.headers.get('x-webhook-secret')
  const expectedSecret = process.env.WEBHOOK_SECRET

  if (expectedSecret && incomingSecret && incomingSecret !== expectedSecret) {
    return NextResponse.json(
      { error: 'Unauthorized: invalid x-webhook-secret header' },
      { status: 401 }
    )
  }

  try {
    const { data: inventoryData, error: invError } = await supabase
      .from('inventory')
      .select('*')

    if (invError) {
      return NextResponse.json(
        { agent: 'SLIME', error: `Inventory query failed: ${invError.message}` },
        { status: 500 }
      )
    }

    const inventory: InventoryRow[] = (inventoryData as InventoryRow[]) || []
    const evaluations: SlimeEvaluation[] = []

    for (const inv of inventory) {
      const baseCost = Number(inv.base_cost) || 100
      const currentStock = Number(inv.current_stock_kg) || 10
      const initialStock = Number(inv.initial_stock_kg) || 10

      // Calculate hours remaining until expiration
      let hoursRemaining = 48
      if (inv.expiration_timestamp) {
        const expTime = new Date(inv.expiration_timestamp).getTime()
        const diffMs = expTime - Date.now()
        hoursRemaining = Math.max(0, diffMs / (1000 * 60 * 60))
      }

      const timeRatio = Math.min(1.0, Math.max(0.0, hoursRemaining / 48.0))
      const stockPressure = initialStock > 0 ? currentStock / initialStock : 1.0
      const urgency = (1.0 - timeRatio) * stockPressure
      const decayFactor = Math.min(1.0, Math.max(0.6, 1.0 - urgency * 0.4))
      const dynamicPrice = Math.round(baseCost * decayFactor * 100) / 100

      // Update menu_items with dynamic price
      const nowIso = new Date().toISOString()
      const { error: updateError } = await supabase
        .from('menu_items')
        .update({
          current_dynamic_price: dynamicPrice,
          last_evaluated_at: nowIso,
        })
        .eq('item_name', inv.item_name)

      if (updateError) {
        console.warn(`[SLIME] Failed to update item ${inv.item_name}:`, updateError.message)
      }

      evaluations.push({
        itemId: inv.id,
        itemName: inv.item_name,
        baseCost,
        dynamicPrice,
        decayFactor: Math.round(decayFactor * 1000) / 1000,
        hoursRemaining: Math.round(hoursRemaining * 10) / 10,
        stockPressure: Math.round(stockPressure * 100) / 100,
        urgency: Math.round(urgency * 100) / 100,
        lastEvaluatedAt: nowIso,
      })
    }

    return NextResponse.json({
      agent: 'SLIME',
      status: 'evaluated',
      evaluated_count: evaluations.length,
      evaluations,
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    return NextResponse.json(
      { agent: 'SLIME', error: err instanceof Error ? err.message : 'Unknown evaluation error' },
      { status: 500 }
    )
  }
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    agent: 'SLIME',
    endpoint: '/api/admin/run-pricing',
    description: 'Trigger autonomous continuous decay pricing engine via POST with x-webhook-secret header.',
  })
}
