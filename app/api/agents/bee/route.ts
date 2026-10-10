import { NextResponse } from 'next/server'
import type { BeeRestockQuote, BeeAgentResponse } from '@/lib/types'

/**
 * BEE Agent (Supplier Forager) — Autonomous Local Farmer Restock Engine
 *
 * Forages decentralized local farmer cooperatives and suppliers to autonomously draft
 * purchase orders (POs) when dark-kitchen ingredients approach critical inventory safety stock.
 */

let quotesStore: BeeRestockQuote[] = [
  {
    id: 'po-101',
    supplier: 'Alun - Subneat KDV',
    item: 'Organic Malai Paneer',
    restock_price: 248.5,
    price_change_pct: 14.32,
    delta_value: '+28.871',
    delta_pct: '+14.33%',
    eta: '45 mins',
    action: 'PO_Drafted',
    po_number: 'PO-4091',
    category: 'Local Farmers',
    timestamp: 'Darnic, 21. 30:00 PM',
  },
  {
    id: 'po-102',
    supplier: 'Lolad Medreive, Tholk (ICX)',
    item: 'Roma Vine Tomatoes & Puree',
    restock_price: 126.58,
    price_change_pct: 15.07,
    delta_value: '+26.586',
    delta_pct: '+10.51%',
    eta: '1.2 hours',
    action: 'PO_Drafted',
    po_number: 'PO-4092',
    category: 'Local Farmers',
    timestamp: 'Darnic, 21. 34:00 PM',
  },
  {
    id: 'po-103',
    supplier: 'Alne Sole Cujne KCE',
    item: 'Cold-Pressed Mustard Oil & Spices',
    restock_price: 196.58,
    price_change_pct: 16.37,
    delta_value: '+148.585',
    delta_pct: '+14.07%',
    eta: '2 hours',
    action: 'PO_Drafted',
    po_number: 'PO-4093',
    category: 'Local Farmers',
    timestamp: 'Darnic, 21. 34:00 PM',
  },
  {
    id: 'po-104',
    supplier: 'Colob Bongur KDV',
    item: 'Sharbati Whole Wheat Atta',
    restock_price: 84.16,
    price_change_pct: 18.77,
    delta_value: '+24.1676',
    delta_pct: '+18.17%',
    eta: '3 hours',
    action: 'PO_Drafted',
    po_number: 'PO-4094',
    category: 'Local Farmers',
    timestamp: 'Darnic, 21. 38:00 PM',
  },
  {
    id: 'po-105',
    supplier: 'Rcoal Teushinal (REA)',
    item: 'Eco-Degradable Meal Containers',
    restock_price: 150.52,
    price_change_pct: 1.64,
    delta_value: '+50.529',
    delta_pct: '+1.64%',
    eta: '1.5 hours',
    action: 'PO_Drafted',
    po_number: 'PO-4095',
    category: 'Reconstructive local farmers',
    timestamp: 'Darnic, 21. 34:00 PM',
  },
  {
    id: 'po-106',
    supplier: 'Fvle Perlonce Number (175)',
    item: 'Farm-Fresh Free Range Poultry',
    restock_price: 332.04,
    price_change_pct: 10.0,
    delta_value: '+632.04',
    delta_pct: '+10.0%',
    eta: '45 mins',
    action: 'PO_Drafted',
    po_number: 'PO-4096',
    category: 'Local Farmers',
    timestamp: 'Flat, 20. 34:00 PM',
  },
  {
    id: 'po-107',
    supplier: 'Knlo Ourogen HRC',
    item: 'A2 Cow Ghee & White Butter',
    restock_price: 480.0,
    price_change_pct: -0.18,
    delta_value: '-0.18%',
    delta_pct: '-0.18%',
    eta: '2.5 hours',
    action: 'Approved',
    po_number: 'PO-4097',
    category: 'Reconstructive local farmers',
    timestamp: 'Darnic, 21. 34:00 PM',
  },
  {
    id: 'po-108',
    supplier: 'GR 7 2. ROGO HEK',
    item: 'Organic Alphonso Mango Pulp',
    restock_price: 210.0,
    price_change_pct: 9.08,
    delta_value: '+39.08%',
    delta_pct: '+9.08%',
    eta: '1 hour',
    action: 'PO_Drafted',
    po_number: 'PO-4098',
    category: 'Local Farmers',
    timestamp: 'Darnic, 21. 35:00 PM',
  },
  {
    id: 'po-109',
    supplier: 'UFS Gayro Foomkick HEE',
    item: 'Chaat Masala & Garam Masala Pods',
    restock_price: 145.0,
    price_change_pct: -3.84,
    delta_value: '-3.84%',
    delta_pct: '-3.84%',
    eta: '3.5 hours',
    action: 'PO_Drafted',
    po_number: 'PO-4099',
    category: 'Reconstructive local farmers',
    timestamp: 'Failed, 21. 38:00 PM',
  },
]

export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url)
  const categoryFilter = searchParams.get('category')

  let filtered = quotesStore
  if (categoryFilter && categoryFilter !== 'All') {
    filtered = quotesStore.filter((q) => q.category === categoryFilter)
  }

  const response: BeeAgentResponse = {
    agent: 'BEE',
    status: 'active',
    quotes: filtered,
    categories: ['All', 'Local Farmers', 'Reconstructive local farmers'],
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
    const body = await request.json()
    const { action, id, quote } = body

    if (action === 'approve_po' && id) {
      quotesStore = quotesStore.map((q) =>
        q.id === id ? { ...q, action: 'Approved' } : q
      )
    } else if (action === 'draft_po' && quote) {
      const newQuote: BeeRestockQuote = {
        id: `po-${Date.now()}`,
        supplier: quote.supplier || 'Local Co-op',
        item: quote.item || 'Ingredient',
        restock_price: Number(quote.restock_price) || 100,
        price_change_pct: Number(quote.price_change_pct) || 0,
        eta: quote.eta || '1 hour',
        action: 'PO_Drafted',
        po_number: `PO-${Math.floor(1000 + Math.random() * 9000)}`,
        category: quote.category || 'Local Farmers',
        timestamp: new Date().toLocaleTimeString(),
      }
      quotesStore = [newQuote, ...quotesStore]
    }

    return NextResponse.json({
      agent: 'BEE',
      status: 'success',
      quotes: quotesStore,
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    return NextResponse.json(
      { agent: 'BEE', error: err instanceof Error ? err.message : 'Invalid request' },
      { status: 400 }
    )
  }
}
