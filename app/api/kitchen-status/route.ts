import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabaseClient'

export async function GET(): Promise<NextResponse> {
  try {
    const { data, error } = await supabase
      .from('kitchen_status')
      .select('*')
      .eq('id', 'current')
      .single()

    if (error || !data) {
      // Fallback default
      return NextResponse.json({
        id: 'current',
        current_labor_capacity: 'Normal',
        active_headcount: 6,
        surge_multiplier: 1.0,
        throttling_enabled: true,
        updated_at: new Date().toISOString(),
      })
    }

    return NextResponse.json(data)
  } catch (err: unknown) {
    return NextResponse.json(
      { current_labor_capacity: 'Normal', error: err instanceof Error ? err.message : 'Unknown' },
      { status: 200 }
    )
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = await request.json()
    const { current_labor_capacity } = body

    if (!current_labor_capacity || !['Normal', 'Overwhelmed'].includes(current_labor_capacity)) {
      return NextResponse.json({ error: "Invalid status: must be 'Normal' or 'Overwhelmed'" }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('kitchen_status')
      .upsert(
        {
          id: 'current',
          current_labor_capacity,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      )
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, data })
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Update failed' },
      { status: 500 }
    )
  }
}
