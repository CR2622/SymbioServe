import { NextResponse } from 'next/server'
import type { TCellAgentResponse } from '@/lib/types'

/**
 * T-CELL Agent — Kitchen Immune Defense, Pathogen Shield & Sanitizer PPM
 *
 * Simulates real-time biological and HACCP immune defense surveillance,
 * tracking quaternary ammonium/chlorine sanitizer PPM, cross-contamination flags,
 * and UV-C air scrubbers.
 */
export async function GET(): Promise<NextResponse> {
  const response: TCellAgentResponse = {
    agent: 'TCELL',
    status: 'active',
    sanitizer_ppm: 215,
    sanitizer_status: 'optimal',
    uvc_sterilization_active: true,
    surface_swab_purity_pct: 99.8,
    haccp_compliance_score: 99.4,
    active_flags: [
      {
        id: 'tc-flag-101',
        zone: 'Prep Board Station 2 (Allergen Bay)',
        severity: 'low',
        hazard_type: 'cross_contamination',
        message: 'Purple allergen kit active; dedicated knife sterilized at 85°C',
        resolved: true,
        timestamp: '12m ago',
      },
      {
        id: 'tc-flag-102',
        zone: 'Sanitization Sink 3',
        severity: 'low',
        hazard_type: 'sanitizer_depletion',
        message: 'Active Quat sanitizer verified at 215 PPM (Target: 200-400 PPM)',
        resolved: true,
        timestamp: '28m ago',
      },
      {
        id: 'tc-flag-103',
        zone: 'Walk-in Air Curtain',
        severity: 'low',
        hazard_type: 'temp_abuse',
        message: 'Thermal ingress seal checked; ambient temp locked at 3.4°C',
        resolved: true,
        timestamp: '45m ago',
      },
    ],
    neutralized_threats_today: 14,
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
    const { action, flag_id, sanitizer_ppm } = body

    return NextResponse.json({
      agent: 'TCELL',
      status: 'active',
      resolved_flag: flag_id || null,
      sanitizer_ppm: Number(sanitizer_ppm) || 220,
      message:
        action === 'calibrate_sanitizer'
          ? 'Quat sanitizer recalibrated to optimal 220 PPM'
          : `Hazard flag ${flag_id || 'selected'} verified and neutralized`,
      haccp_compliance_score: 99.8,
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    return NextResponse.json(
      { agent: 'TCELL', error: err instanceof Error ? err.message : 'Invalid request' },
      { status: 400 }
    )
  }
}
