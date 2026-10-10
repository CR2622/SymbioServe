import { NextResponse } from 'next/server'
import { POST as seedEnzymePOST } from '@/app/api/admin/seed-enzyme/route'

/**
 * Demo Data Seeder Endpoint (Unified ENZYME & Multi-Agent RBAC Seeder)
 */
export async function POST(): Promise<NextResponse> {
  return seedEnzymePOST()
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    description: 'POST to this endpoint to seed database tables with sample inventory, menu items with ENZYME recipe ingredients, kitchen status, orders, and DLQ rows.',
  })
}
