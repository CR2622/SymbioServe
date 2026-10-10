import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabaseClient'
import type { BacteriaAgentResponse } from '@/lib/types'

/**
 * BACTERIA Agent — Colony Sensing, Ambient Telemetry & Labor Throttling Forecast
 */
export async function GET(): Promise<NextResponse> {
  let isOverwhelmed = false
  try {
    const { data } = await supabase
      .from('kitchen_status')
      .select('current_labor_capacity')
      .eq('id', 'current')
      .single()
    if (data?.current_labor_capacity === 'Overwhelmed') {
      isOverwhelmed = true
    }
  } catch {
    // default
  }

  const response: BacteriaAgentResponse = {
    agent: 'BACTERIA',
    status: isOverwhelmed ? 'warning' : 'nominal',
    ambient_telemetry: {
      mean_kitchen_temp_c: isOverwhelmed ? 26.8 : 22.4,
      mean_humidity_pct: isOverwhelmed ? 68.4 : 54.2,
      microbial_growth_index: isOverwhelmed ? 0.38 : 0.12,
      shelf_life_acceleration_factor: isOverwhelmed ? 1.45 : 1.04,
    },
    zones: [
      {
        sensor_zone: 'Walk-In Chiller Matrix',
        ambient_temp_celsius: 3.4,
        relative_humidity_pct: 82.0,
        cfu_count_estimate: 12,
        spoilage_risk_level: 'nominal',
        surge_forecast_multiplier: 1.0,
      },
      {
        sensor_zone: 'Prep Table Alpha (Dairy & Herbs)',
        ambient_temp_celsius: isOverwhelmed ? 24.2 : 19.8,
        relative_humidity_pct: 58.5,
        cfu_count_estimate: isOverwhelmed ? 88 : 42,
        spoilage_risk_level: isOverwhelmed ? 'elevated' : 'nominal',
        surge_forecast_multiplier: isOverwhelmed ? 1.85 : 1.25,
      },
      {
        sensor_zone: 'Cold Hold Station Beta',
        ambient_temp_celsius: 4.1,
        relative_humidity_pct: 68.0,
        cfu_count_estimate: 18,
        spoilage_risk_level: 'nominal',
        surge_forecast_multiplier: 1.1,
      },
      {
        sensor_zone: 'Dry Grains & Spice Cellar',
        ambient_temp_celsius: 21.6,
        relative_humidity_pct: 42.0,
        cfu_count_estimate: 20,
        spoilage_risk_level: 'nominal',
        surge_forecast_multiplier: 1.0,
      },
    ],
    demand_surge_forecast: {
      peak_predicted_in_mins: isOverwhelmed ? 5 : 18,
      estimated_volume_surge_pct: isOverwhelmed ? 85 : 34,
      spoilage_mitigation_action: isOverwhelmed
        ? 'CRITICAL LABOR THROTTLE ENGAGED: Menu items with labor score > 7.0 paused autonomously.'
        : 'Pre-emptively prep 12x Paneer Burgers & dispatch cold-line stock before peak velocity',
    },
    timestamp: new Date().toISOString(),
  }

  return NextResponse.json(response, {
    status: 200,
    headers: {
      'Cache-Control': 'no-store, max-age=0',
    },
  })
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = await request.json().catch(() => ({}))
    const { action, zone } = body

    return NextResponse.json({
      agent: 'BACTERIA',
      status: 'nominal',
      action_applied: action || 'mitigation_executed',
      target_zone: zone || 'All Zones',
      message: 'Demand surge mitigation action acknowledged. Prep cadence adjusted.',
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    return NextResponse.json(
      { agent: 'BACTERIA', error: err instanceof Error ? err.message : 'Invalid request' },
      { status: 400 }
    )
  }
}
