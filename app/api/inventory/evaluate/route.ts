import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabaseClient'
import type { MenuItemRow } from '@/lib/types'

/**
 * SLIME Agent — Read-only Dynamic Pricing Query Endpoint
 *
 * Queries `menu_items` table and returns current dynamic prices.
 * Zero database writes: pricing recalculation is handled natively in PostgreSQL
 * via `run_continuous_pricing()` scheduled with `pg_cron`.
 */
export async function GET(): Promise<NextResponse> {
  try {
    const { data, error } = await supabase
      .from('menu_items')
      .select('*')
      .order('item_name', { ascending: true })

    if (error) {
      return NextResponse.json(
        {
          agent: 'SLIME',
          status: 'error',
          error: error.message,
          items: [],
          timestamp: new Date().toISOString(),
        },
        { status: 500 }
      )
    }

    const items: MenuItemRow[] = (data as MenuItemRow[]) || []

    return NextResponse.json(
      {
        agent: 'SLIME',
        status: 'online',
        items,
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    )
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown internal error'
    return NextResponse.json(
      {
        agent: 'SLIME',
        status: 'error',
        error: errorMessage,
        items: [],
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}

export async function POST(): Promise<NextResponse> {
  return NextResponse.json(
    {
      agent: 'SLIME',
      error:
        'Client-triggered writes disabled. Pricing is computed database-natively via run_continuous_pricing() and pg_cron.',
    },
    { status: 405 }
  )
}
