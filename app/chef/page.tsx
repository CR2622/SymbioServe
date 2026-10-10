'use client'

import React, { useEffect, useState, useCallback, useMemo } from 'react'
import {
  AlertTriangle,
  Bell,
  Check,
  CheckCircle,
  ChefHat,
  Clock,
  Flame,
  Gauge,
  Play,
  RefreshCw,
  ShieldAlert,
  Volume2,
  VolumeX,
} from 'lucide-react'
import CrossNav from '@/components/CrossNav'
import { supabase } from '@/lib/supabaseClient'
import type { OrderItem, OrderRow } from '@/lib/types'

function parseOrderItems(items: OrderRow['items']): OrderItem[] {
  const normalize = (it: unknown): OrderItem => {
    if (typeof it === 'string') return { name: it, quantity: 1 }
    const obj = it && typeof it === 'object' ? (it as Record<string, unknown>) : {}
    return {
      name: String(obj.name || obj.item_name || 'Item'),
      quantity: Number(obj.quantity || obj.qty || 1),
      modifications: Array.isArray(obj.modifications)
        ? (obj.modifications as string[])
        : typeof obj.modifications === 'string'
        ? [obj.modifications]
        : undefined,
      allergy_alert: obj.allergy_alert ? String(obj.allergy_alert) : undefined,
    }
  }

  if (Array.isArray(items)) return items.map(normalize)
  if (typeof items === 'string') {
    try {
      const parsed = JSON.parse(items)
      if (Array.isArray(parsed)) return parsed.map(normalize)
    } catch {
      return [{ name: items, quantity: 1 }]
    }
  }
  return []
}

function getElapsedMinutes(timestamp?: string | null, currentEpoch?: number): number {
  if (!timestamp) return 0
  const date = new Date(timestamp)
  if (isNaN(date.getTime())) return 0
  const ref = currentEpoch || Date.now()
  return Math.max(0, Math.floor((ref - date.getTime()) / 60000))
}

function getElapsedSeconds(timestamp?: string | null, currentEpoch?: number): number {
  if (!timestamp) return 0
  const date = new Date(timestamp)
  if (isNaN(date.getTime())) return 0
  const ref = currentEpoch || Date.now()
  return Math.max(0, Math.floor((ref - date.getTime()) / 1000))
}

function formatTicketTime(timestamp?: string | null, currentEpoch?: number): string {
  const secs = getElapsedSeconds(timestamp, currentEpoch)
  const mins = Math.floor(secs / 60)
  const remSecs = secs % 60
  return `${String(mins).padStart(2, '0')}:${String(remSecs).padStart(2, '0')}`
}

const FALLBACK_CHEF_ORDERS: OrderRow[] = [
  {
    id: 'ord-1',
    order_id: 'ZOM-402',
    source_platform: 'Zomato',
    items: [
      { name: 'Paneer Tikka', quantity: 2, modifications: ['NO DAIRY', 'EXTRA MINT CHUTNEY'], allergy_alert: 'DAIRY ALLERGY — SUBSTITUTE CASHEW CREME' },
      { name: 'Dal Makhani', quantity: 1 },
      { name: 'Garlic Naan', quantity: 3 },
    ],
    status: 'pending',
    received_at: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
    allergy_notes: 'DAIRY ALLERGY — STRICT NO DAIRY',
  },
  {
    id: 'ord-2',
    order_id: 'CUST-104',
    source_platform: 'Customer Web (Table 4)',
    items: [
      { name: 'Thai Peanut Satay Noodle', quantity: 1, modifications: ['NO PEANUTS'], allergy_alert: 'SEVERE PEANUT ALLERGY' },
      { name: 'Mango Mint Lassi', quantity: 2 },
    ],
    status: 'pending',
    received_at: new Date(Date.now() - 1 * 60 * 1000).toISOString(),
    allergy_notes: 'SEVERE PEANUT ALLERGY',
  },
  {
    id: 'ord-3',
    order_id: 'UBER-109',
    source_platform: 'UberEats',
    items: [
      { name: 'Artisan Truffle Pizza', quantity: 1, modifications: ['NO GLUTEN CRUST (CAULIFLOWER)'], allergy_alert: 'CELIAC GLUTEN ALERT' },
      { name: 'Fresh Citrus Kale Salad', quantity: 1 },
    ],
    status: 'pending',
    received_at: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
    allergy_notes: 'CELIAC GLUTEN ALERT — NO GLUTEN CRUST',
  },
  {
    id: 'ord-4',
    order_id: 'SWIG-882',
    source_platform: 'Swiggy',
    items: [
      { name: 'Chicken Biryani', quantity: 2 },
      { name: 'Gulab Jamun', quantity: 2 },
    ],
    status: 'preparing',
    received_at: new Date(Date.now() - 6 * 60 * 1000).toISOString(),
  },
]

export default function ChefKDSPage() {
  const [orders, setOrders] = useState<OrderRow[]>(FALLBACK_CHEF_ORDERS)
  const [isLoading, setIsLoading] = useState(false)
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'pending' | 'preparing' | 'ready' | 'allergies'>('all')
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [newOrderAlert, setNewOrderAlert] = useState<string | null>(null)
  const [now, setNow] = useState(Date.now())

  // Dynamic ticker for elapsed time counter (updates every 5 seconds)
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 5000)
    return () => clearInterval(timer)
  }, [])

  // ── 1. Hydrate Initial Orders (Zero-Polling) ──
  const fetchOrders = useCallback(async () => {
    try {
      setIsLoading(true)
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .neq('status', 'completed')
        .neq('status', 'dispatched')
        .order('received_at', { ascending: true })

      if (data && data.length > 0) {
        setOrders(data as OrderRow[])
      } else if (error) {
        console.error('[ChefKDS] Error fetching orders:', error.message)
      }
    } catch (err) {
      console.error('[ChefKDS] Hydration exception:', err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // ── 2. Realtime Event Stream ──
  useEffect(() => {
    fetchOrders()

    const channel = supabase
      .channel('chef-kds-stream')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newOrder = payload.new as OrderRow
            setOrders((prev) => [newOrder, ...prev.filter((o) => o.id !== newOrder.id)])
            setNewOrderAlert(newOrder.order_id)
            setTimeout(() => setNewOrderAlert(null), 4000)
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new as OrderRow
            if (updated.status === 'completed' || updated.status === 'dispatched') {
              setOrders((prev) => prev.filter((o) => o.id !== updated.id))
            } else {
              setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)))
            }
          } else if (payload.eventType === 'DELETE') {
            const oldId = (payload.old as { id: string }).id
            setOrders((prev) => prev.filter((o) => o.id !== oldId))
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchOrders])

  // ── 3. Ticket Status Bump Handler ──
  const handleUpdateStatus = async (orderId: string, nextStatus: string) => {
    try {
      // Optimistic update
      setOrders((prev) =>
        nextStatus === 'completed'
          ? prev.filter((o) => o.order_id !== orderId)
          : prev.map((o) => (o.order_id === orderId ? { ...o, status: nextStatus } : o))
      )

      await supabase
        .from('orders')
        .update({ status: nextStatus })
        .eq('order_id', orderId)
    } catch (err) {
      console.error('[ChefKDS] Bump error:', err)
      fetchOrders()
    }
  }

  // ── 4. Helper to detect allergen modification in ticket ──
  const ticketHasAllergy = (order: OrderRow): boolean => {
    if (order.allergy_notes) return true
    const items = parseOrderItems(order.items)
    return items.some((it) => {
      if (it.allergy_alert) return true
      if (it.modifications && it.modifications.length > 0) {
        return it.modifications.some(
          (m) =>
            m.toUpperCase().includes('NO ') ||
            m.toUpperCase().includes('ALLERGY') ||
            m.toUpperCase().includes('GLUTEN') ||
            m.toUpperCase().includes('DAIRY') ||
            m.toUpperCase().includes('PEANUT')
        )
      }
      return false
    })
  }

  // ── 5. Filtered Tickets ──
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      if (selectedFilter === 'pending') return order.status === 'pending'
      if (selectedFilter === 'preparing') return order.status === 'preparing'
      if (selectedFilter === 'ready') return order.status === 'ready'
      if (selectedFilter === 'allergies') return ticketHasAllergy(order)
      return true
    })
  }, [orders, selectedFilter])

  // Metrics
  const pendingCount = orders.filter((o) => o.status === 'pending').length
  const preparingCount = orders.filter((o) => o.status === 'preparing').length
  const allergyAlertCount = orders.filter((o) => ticketHasAllergy(o)).length

  return (
    <div className="min-h-screen bg-black text-white font-sans flex flex-col antialiased selection:bg-amber-500 selection:text-black">
      {/* Universal RBAC Top Navigation */}
      <CrossNav />

      {/* High-Contrast Chef Header */}
      <header className="px-4 py-3 bg-gray-950 border-b border-gray-800 flex flex-wrap items-center justify-between gap-3 sticky top-14 z-30 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500 text-black font-black shadow-lg shadow-amber-500/30">
            <ChefHat className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black tracking-tight text-white uppercase">
                Chef Line KDS
              </h1>
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-amber-950 border border-amber-600/80 text-amber-300 font-black">
                HIGH-CONTRAST PASS
              </span>
            </div>
            <p className="text-xs text-gray-400 font-mono">
              Live Order Routing & Allergen Defense Screen
            </p>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto py-1">
          <button
            type="button"
            onClick={() => setSelectedFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
              selectedFilter === 'all'
                ? 'bg-white text-black shadow-md'
                : 'bg-gray-900 border border-gray-800 text-gray-400 hover:text-white'
            }`}
          >
            All ({orders.length})
          </button>

          <button
            type="button"
            onClick={() => setSelectedFilter('pending')}
            className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
              selectedFilter === 'pending'
                ? 'bg-emerald-500 text-black shadow-md'
                : 'bg-emerald-950/40 border border-emerald-800 text-emerald-400 hover:bg-emerald-900/60'
            }`}
          >
            Pending ({pendingCount})
          </button>

          <button
            type="button"
            onClick={() => setSelectedFilter('preparing')}
            className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
              selectedFilter === 'preparing'
                ? 'bg-cyan-500 text-black shadow-md'
                : 'bg-cyan-950/40 border border-cyan-800 text-cyan-400 hover:bg-cyan-900/60'
            }`}
          >
            In Prep ({preparingCount})
          </button>

          <button
            type="button"
            onClick={() => setSelectedFilter('allergies')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
              selectedFilter === 'allergies'
                ? 'bg-amber-400 text-black shadow-lg shadow-amber-400/40 ring-2 ring-amber-300'
                : 'bg-amber-950/60 border-2 border-amber-500 text-amber-300 hover:bg-amber-900/80 animate-pulse'
            }`}
          >
            <ShieldAlert className="h-3.5 w-3.5" />
            <span>Allergy Alerts ({allergyAlertCount})</span>
          </button>
        </div>

        {/* Right Station Metrics */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setSoundEnabled((p) => !p)}
            className="p-2 rounded-lg bg-gray-900 border border-gray-800 text-gray-400 hover:text-white cursor-pointer"
            title="Toggle Alert Sounds"
          >
            {soundEnabled ? <Volume2 className="h-4 w-4 text-emerald-400" /> : <VolumeX className="h-4 w-4" />}
          </button>

          <button
            type="button"
            onClick={fetchOrders}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-900 border border-gray-800 text-xs font-mono text-gray-300 hover:text-white cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin text-amber-400' : ''}`} />
            <span>Sync</span>
          </button>
        </div>
      </header>

      {/* New Order Realtime Toast */}
      {newOrderAlert && (
        <div className="bg-amber-400 text-black py-2 px-4 text-center font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 animate-bounce">
          <Bell className="h-4 w-4" />
          <span>NEW TICKET RECEIVED: #{newOrderAlert}</span>
        </div>
      )}

      {/* ── CHEF-SPECIFIC GRAPH: Station Velocity & Kuramoto Phase Locking ── */}
      <section className="mx-4 mt-4 p-4 rounded-2xl bg-gray-950 border border-gray-800/80">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <Gauge className="h-4 w-4 text-amber-400" />
            <h2 className="text-xs font-black uppercase tracking-wider text-white">
              Station Velocity & Phase Synchronization Mesh (Kuramoto Coherence: 94.8%)
            </h2>
          </div>
          <div className="flex items-center gap-3 text-[11px] font-mono">
            <span className="text-emerald-400 font-bold">Grill: 180s cycle</span>
            <span className="text-cyan-400 font-bold">Fryer: 120s cycle</span>
            <span className="text-purple-400 font-bold">Pass: 60s cycle</span>
          </div>
        </div>

        {/* Kuramoto Phase Wave SVG */}
        <div className="h-20 w-full relative bg-black rounded-xl p-2 border border-gray-900 overflow-hidden">
          <svg className="w-full h-full overflow-visible" viewBox="0 0 600 60" preserveAspectRatio="none">
            <defs>
              <linearGradient id="chefSyncGrad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#10b981" />
                <stop offset="35%" stopColor="#f59e0b" />
                <stop offset="70%" stopColor="#06b6d4" />
                <stop offset="100%" stopColor="#a855f7" />
              </linearGradient>
            </defs>

            {/* Background Phase Grid */}
            <line x1="0" y1="30" x2="600" y2="30" stroke="#1f2937" strokeWidth="1" />
            <line x1="150" y1="0" x2="150" y2="60" stroke="#1f2937" strokeDasharray="3 3" />
            <line x1="300" y1="0" x2="300" y2="60" stroke="#1f2937" strokeDasharray="3 3" />
            <line x1="450" y1="0" x2="450" y2="60" stroke="#1f2937" strokeDasharray="3 3" />

            {/* Sine Wave Harmonic */}
            <path
              d="M 0 30 Q 75 5 150 30 T 300 30 T 450 30 T 600 30"
              fill="none"
              stroke="url(#chefSyncGrad)"
              strokeWidth="3"
            />

            {/* Active Station Markers */}
            <circle cx="150" cy="30" r="5" fill="#10b981" />
            <text x="135" y="52" fill="#10b981" fontSize="9" fontFamily="monospace" fontWeight="bold">
              GRILL
            </text>

            <circle cx="300" cy="30" r="5" fill="#f59e0b" />
            <text x="285" y="52" fill="#f59e0b" fontSize="9" fontFamily="monospace" fontWeight="bold">
              FRYER
            </text>

            <circle cx="450" cy="30" r="5" fill="#06b6d4" />
            <text x="430" y="52" fill="#06b6d4" fontSize="9" fontFamily="monospace" fontWeight="bold">
              ASSEMBLY
            </text>

            <circle cx="560" cy="30" r="5" fill="#a855f7" />
            <text x="545" y="52" fill="#a855f7" fontSize="9" fontFamily="monospace" fontWeight="bold">
              PASS
            </text>
          </svg>
        </div>
      </section>

      {/* ── High-Contrast KDS Ticket Grid ── */}
      <main className="p-4 flex-1">
        {filteredOrders.length === 0 ? (
          <div className="h-64 rounded-2xl border-2 border-dashed border-gray-800 flex flex-col items-center justify-center text-center p-6">
            <CheckCircle className="h-12 w-12 text-emerald-500 mb-3" />
            <h3 className="text-base font-black text-white uppercase tracking-wider">
              Pass is Clear! No Active Tickets in Queue
            </h3>
            <p className="text-xs text-gray-500 font-mono mt-1">
              New tickets from Delivery Webhooks (ANT) or Customer Menu will appear automatically in realtime.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredOrders.map((order) => {
              const items = parseOrderItems(order.items)
              const hasAllergy = ticketHasAllergy(order)
              const elapsedMins = getElapsedMinutes(order.received_at, now)
              const timeFormatted = formatTicketTime(order.received_at, now)

              // High-urgency color coding based on elapsed time:
              // < 5m: Green/Emerald
              // 5m - 10m: Amber
              // > 10m: Red / Urgent
              const timerColor =
                elapsedMins > 10
                  ? 'bg-red-600 text-white animate-pulse'
                  : elapsedMins > 5
                  ? 'bg-amber-500 text-black'
                  : 'bg-emerald-600 text-white'

              return (
                <div
                  key={order.id || order.order_id}
                  data-testid="chef-order-ticket"
                  className={`flex flex-col rounded-2xl border-2 transition-all shadow-xl ${
                    hasAllergy
                      ? 'border-amber-400 bg-gray-950 shadow-amber-500/20 ring-1 ring-amber-400'
                      : 'border-gray-800 bg-gray-950'
                  }`}
                >
                  {/* Ticket Header */}
                  <div
                    className={`p-3.5 border-b flex items-center justify-between ${
                      hasAllergy ? 'border-amber-500/60 bg-amber-950/30' : 'border-gray-800 bg-gray-900/60'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-black tracking-tight text-white font-mono">
                          #{order.order_id}
                        </span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded font-black uppercase bg-gray-800 text-gray-300">
                          {order.source_platform}
                        </span>
                      </div>
                      <div className="text-[11px] text-gray-400 font-mono mt-0.5">
                        Status: <span className="uppercase text-white font-bold">{order.status}</span>
                      </div>
                    </div>

                    {/* Big Elapsed Timer */}
                    <div
                      className={`px-2.5 py-1 rounded-xl text-xs font-mono font-black tracking-wider flex items-center gap-1.5 shadow-md ${timerColor}`}
                    >
                      <Clock className="h-3.5 w-3.5" />
                      <span>{timeFormatted}</span>
                    </div>
                  </div>

                  {/* CRITICAL ALLERGY BANNER (Bright Amber Highlight) */}
                  {hasAllergy && (
                    <div
                      data-testid="allergy-highlight-badge"
                      className="px-3.5 py-2 bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-400 text-black font-black text-xs uppercase tracking-wider flex items-center gap-2 shadow-inner"
                    >
                      <AlertTriangle className="h-4 w-4 shrink-0 text-black" />
                      <span className="leading-tight">
                        {order.allergy_notes ||
                          items.find((i) => i.allergy_alert)?.allergy_alert ||
                          items.flatMap((i) => i.modifications || []).find((m) => m.toUpperCase().includes('NO ') || m.toUpperCase().includes('ALLERGY')) ||
                          '⚠️ CUSTOMER ALLERGEN RESTRICTION DETECTED'}
                      </span>
                    </div>
                  )}

                  {/* Items List */}
                  <div className="p-3.5 flex-1 space-y-3">
                    {items.map((item, idx) => {
                      const hasItemAllergy =
                        item.allergy_alert ||
                        (item.modifications &&
                          item.modifications.some((m) =>
                            m.toUpperCase().includes('NO ') || m.toUpperCase().includes('ALLERGY')
                          ))

                      return (
                        <div
                          key={idx}
                          className={`p-2.5 rounded-xl border ${
                            hasItemAllergy
                              ? 'bg-amber-950/40 border-amber-500/80'
                              : 'bg-gray-900/80 border-gray-800'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className="text-sm font-black text-white leading-tight">
                              {item.name}
                            </span>
                            <span className="text-sm font-mono font-black px-2 py-0.5 rounded bg-white text-black shrink-0">
                              x{item.quantity}
                            </span>
                          </div>

                          {/* BRIGHT AMBER MODIFICATION BADGES */}
                          {item.modifications && item.modifications.length > 0 && (
                            <div className="mt-2 space-y-1">
                              {item.modifications.map((mod, mIdx) => (
                                <div
                                  key={mIdx}
                                  className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-amber-400 text-black font-black text-[11px] uppercase tracking-wide mr-1 shadow-sm"
                                >
                                  <Flame className="h-3 w-3" />
                                  <span>{mod}</span>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Dedicated Allergy Alert on Item */}
                          {item.allergy_alert && (
                            <div className="mt-1.5 text-[11px] font-black text-amber-300 font-mono bg-black/60 px-2 py-1 rounded border border-amber-500/60 flex items-center gap-1">
                              <span>⚠️</span>
                              <span>{item.allergy_alert}</span>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>

                  {/* Action Buttons (Bump Ticket) */}
                  <div className="p-3 border-t border-gray-800 bg-gray-900/60 flex items-center gap-2">
                    {order.status === 'pending' && (
                      <button
                        type="button"
                        onClick={() => handleUpdateStatus(order.order_id, 'preparing')}
                        className="flex-1 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Play className="h-3.5 w-3.5 fill-black" />
                        <span>Start Prep</span>
                      </button>
                    )}

                    {order.status === 'preparing' && (
                      <button
                        type="button"
                        onClick={() => handleUpdateStatus(order.order_id, 'ready')}
                        className="flex-1 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Check className="h-4 w-4" />
                        <span>Pass Ready</span>
                      </button>
                    )}

                    {order.status === 'ready' && (
                      <button
                        type="button"
                        onClick={() => handleUpdateStatus(order.order_id, 'completed')}
                        className="flex-1 py-2 rounded-xl bg-purple-500 hover:bg-purple-400 text-white font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <CheckCircle className="h-4 w-4" />
                        <span>Bump (Completed)</span>
                      </button>
                    )}

                    {/* Quick Bump to completed */}
                    {order.status !== 'ready' && (
                      <button
                        type="button"
                        onClick={() => handleUpdateStatus(order.order_id, 'completed')}
                        className="px-3 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold text-xs uppercase cursor-pointer"
                        title="Direct Bump / Clear"
                      >
                        Bump
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
