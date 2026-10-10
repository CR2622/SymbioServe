'use client'

import React, { useEffect, useState, useCallback } from 'react'
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Bell,
  Biohazard,
  Bug,
  Check,
  CheckCircle,
  ChefHat,
  ChevronDown,
  Clock,
  Crown,
  Droplets,
  Gauge,
  LayoutDashboard,
  Lock,
  Package,
  Plug,
  Radio,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Thermometer,
  Trash2,
  TrendingDown,
  TrendingUp,
  Truck,
  User,
  X,
} from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import CrossNav from '@/components/CrossNav'
import type {
  BacteriaAgentResponse,
  BeeRestockQuote,
  FailedWebhookRow,
  FireflyAgentResponse,
  MenuItemRow,
  OrderItem,
  OrderRow,
  SaasTier,
  TCellAgentResponse,
} from '@/lib/types'

function formatRelativeTime(dateStr?: string | null): string {
  if (!dateStr) return 'Pending'
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return 'Pending'
  const diffSecs = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000))
  if (diffSecs < 10) return 'Just now'
  if (diffSecs < 60) return `${diffSecs}s ago`
  const diffMins = Math.floor(diffSecs / 60)
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHours = Math.floor(diffMins / 60)
  return `${diffHours}h ago`
}

function parseOrderItems(items: OrderRow['items']): OrderItem[] {
  const normalizeItem = (it: unknown): OrderItem => {
    if (typeof it === 'string') return { name: it, quantity: 1 }
    const obj = it && typeof it === 'object' ? (it as Record<string, unknown>) : {}
    return {
      name: String(obj.name || obj.item_name || 'Item'),
      quantity: Number(obj.quantity || obj.qty || 1),
    }
  }

  if (Array.isArray(items)) return items.map(normalizeItem)
  if (typeof items === 'string') {
    try {
      const parsed = JSON.parse(items)
      if (Array.isArray(parsed)) return parsed.map(normalizeItem)
    } catch {
      return []
    }
  }
  return []
}

function getPlatformBadge(platform?: string | null) {
  if (!platform || typeof platform !== 'string') {
    return 'bg-amber-950/80 text-amber-400 border-amber-800/60'
  }
  const p = platform.toLowerCase()
  if (p.includes('uber')) {
    return 'bg-emerald-950/80 text-emerald-400 border-emerald-800/60'
  }
  if (p.includes('doordash')) {
    return 'bg-red-950/80 text-red-400 border-red-800/60'
  }
  if (p.includes('swiggy')) {
    return 'bg-orange-950/80 text-orange-400 border-orange-800/60'
  }
  if (p.includes('zomato')) {
    return 'bg-rose-950/80 text-rose-400 border-rose-800/60'
  }
  return 'bg-amber-950/80 text-amber-400 border-amber-800/60'
}

const SAAS_TIERS = [
  { id: 'Tier 1: Local Cafe' as SaasTier, label: 'Tier 1: Local Cafe' },
  { id: 'Tier 2: Fast Casual' as SaasTier, label: 'Tier 2: Fast Casual' },
  { id: 'Tier 3: Enterprise' as SaasTier, label: 'Tier 3: Enterprise' },
]

export default function KDS() {
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [menuItems, setMenuItems] = useState<MenuItemRow[]>([])
  const [failedWebhooks, setFailedWebhooks] = useState<FailedWebhookRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [realtimeConnected, setRealtimeConnected] = useState(false)
  const [showDlqModal, setShowDlqModal] = useState(false)
  const [dismissingId, setDismissingId] = useState<string | null>(null)
  const [activeTier, setActiveTier] = useState<SaasTier>('Tier 2: Fast Casual')

  // Navigation dock state
  const [activeNav, setActiveNav] = useState<'dashboard' | 'agents' | 'inventory' | 'immune' | 'telemetry'>('dashboard')

  // Column 2 Tab: BEE (Supplier Forager) vs FIREFLY (Active Stations)
  const [col2Tab, setCol2Tab] = useState<'bee' | 'firefly'>('bee')
  const [beeCategory, setBeeCategory] = useState<'All' | 'Local Farmers' | 'Reconstructive local farmers'>('All')

  // Column 3 Sub-tab: SLIME vs BACTERIA vs T-CELL
  const [col3Tab, setCol3Tab] = useState<'slime' | 'bacteria' | 'tcell'>('slime')

  // BEE Agent data
  const [beeQuotes, setBeeQuotes] = useState<BeeRestockQuote[]>([])
  const [beeLoading, setBeeLoading] = useState(true)
  const [beeError, setBeeError] = useState<string | null>(null)

  // FIREFLY Agent data
  const [fireflyData, setFireflyData] = useState<FireflyAgentResponse | null>(null)
  const [fireflyLoading, setFireflyLoading] = useState(true)

  // BACTERIA Agent data
  const [bacteriaData, setBacteriaData] = useState<BacteriaAgentResponse | null>(null)
  const [bacteriaLoading, setBacteriaLoading] = useState(true)

  // T-CELL Agent data
  const [tcellData, setTCellData] = useState<TCellAgentResponse | null>(null)
  const [tcellLoading, setTCellLoading] = useState(true)

  // Dropdown popover state for Subscription Tier
  const [showTierDropdown, setShowTierDropdown] = useState(false)
  const [agentActionMessage, setAgentActionMessage] = useState<string | null>(null)

  // Dynamic Odometer animation values (matches video sequence 0090 -> 0059 -> 0055 -> 0070)
  const ODOMETER_STAGES = ['0090', '0059', '0055', '0070']
  const [odometerIndex, setOdometerIndex] = useState(0)
  const odometerVal = ODOMETER_STAGES[odometerIndex]

  // Client-side visual odometer ticker (zero network polling)
  useEffect(() => {
    const timer = setInterval(() => {
      setOdometerIndex((prev) => (prev + 1) % ODOMETER_STAGES.length)
    }, 4500)
    return () => clearInterval(timer)
  }, [ODOMETER_STAGES.length])

  const isTier1 =
    activeTier === 'Tier 1: Local Cafe' ||
    activeTier === 'tier_1' ||
    String(activeTier).startsWith('Tier 1')

  // ── 1. Initial State Hydration (Zero Polling — Mount only) ──
  const hydrateInitialState = useCallback(async () => {
    try {
      setIsLoading(true)
      const [ordersRes, menuRes, dlqRes] = await Promise.all([
        supabase
          .from('orders')
          .select('*')
          .eq('status', 'pending')
          .order('received_at', { ascending: false }),
        supabase
          .from('menu_items')
          .select('*')
          .order('item_name', { ascending: true }),
        supabase
          .from('failed_webhooks')
          .select('*')
          .order('created_at', { ascending: false }),
      ])

      if (ordersRes.data) setOrders(ordersRes.data as OrderRow[])
      if (menuRes.data) setMenuItems(menuRes.data as MenuItemRow[])
      if (dlqRes.data) setFailedWebhooks(dlqRes.data as FailedWebhookRow[])
    } catch (err) {
      console.error('[KDS] Initial state hydration error:', err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // ── 2. Multiplexed Supabase Realtime Subscription (Zero Polling) ──
  useEffect(() => {
    hydrateInitialState()

    const multiplexChannel = supabase
      .channel('kds-events')
      // Event 1: Orders (ANT Queue)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newOrder = payload.new as OrderRow
            if (newOrder.status === 'pending') {
              setOrders((prev) => [newOrder, ...prev.filter((o) => o.id !== newOrder.id)])
            }
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new as OrderRow
            if (updated.status !== 'pending') {
              setOrders((prev) => prev.filter((o) => o.id !== updated.id))
            } else {
              setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)))
            }
          } else if (payload.eventType === 'DELETE') {
            const oldOrder = payload.old as { id: string }
            setOrders((prev) => prev.filter((o) => o.id !== oldOrder.id))
          }
        }
      )
      // Event 2: Menu Items (SLIME Dynamic Pricing)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'menu_items' },
        (payload) => {
          if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
            const updated = payload.new as MenuItemRow
            setMenuItems((prev) => {
              const exists = prev.some((m) => m.id === updated.id || m.item_name === updated.item_name)
              if (exists) {
                return prev.map((m) => (m.id === updated.id || m.item_name === updated.item_name ? updated : m))
              }
              return [...prev, updated]
            })
          } else if (payload.eventType === 'DELETE') {
            const oldItem = payload.old as { id: string }
            setMenuItems((prev) => prev.filter((m) => m.id !== oldItem.id))
          }
        }
      )
      // Event 3: Dead Letter Queue (DLQ Alerts)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'failed_webhooks' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newDlq = payload.new as FailedWebhookRow
            setFailedWebhooks((prev) => [newDlq, ...prev.filter((d) => d.id !== newDlq.id)])
          } else if (payload.eventType === 'DELETE') {
            const deleted = payload.old as { id: string }
            setFailedWebhooks((prev) => prev.filter((d) => d.id !== deleted.id))
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setRealtimeConnected(true)
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          setRealtimeConnected(false)
        }
      })

    return () => {
      supabase.removeChannel(multiplexChannel)
    }
  }, [hydrateInitialState])

  // ── 3. Dismiss DLQ Entry ──
  const handleDismissDlq = async (id: string) => {
    try {
      setDismissingId(id)
      const { error } = await supabase.from('failed_webhooks').delete().eq('id', id)
      if (error) {
        console.error('[KDS] Failed to delete DLQ row:', error)
      } else {
        setFailedWebhooks((prev) => prev.filter((d) => d.id !== id))
      }
    } catch (err) {
      console.error('[KDS] Error dismissing DLQ row:', err)
    } finally {
      setDismissingId(null)
    }
  };

  // ── 4. Agent Telemetry Fetchers (Mount Only — No setInterval Polling Loops) ──
  const fetchBeeQuotes = useCallback(async () => {
    try {
      setBeeLoading(true)
      setBeeError(null)
      const res = await fetch('/api/agents/bee')
      if (!res.ok) throw new Error(`Failed to load quotes: ${res.status}`)
      const data = await res.json()
      setBeeQuotes(Array.isArray(data) ? data : data.quotes || [])
    } catch (err) {
      console.error('[KDS] Error fetching BEE quotes:', err)
      setBeeError(err instanceof Error ? err.message : 'Error foraging suppliers')
    } finally {
      setBeeLoading(false)
    }
  }, [])

  const fetchFireflyData = useCallback(async () => {
    try {
      setFireflyLoading(true)
      const res = await fetch('/api/agents/firefly')
      if (res.ok) {
        const data = await res.json()
        setFireflyData(data)
      }
    } catch (err) {
      console.error('[KDS] Error fetching FIREFLY data:', err)
    } finally {
      setFireflyLoading(false)
    }
  }, [])

  const fetchBacteriaData = useCallback(async () => {
    try {
      setBacteriaLoading(true)
      const res = await fetch('/api/agents/bacteria')
      if (res.ok) {
        const data = await res.json()
        setBacteriaData(data)
      }
    } catch (err) {
      console.error('[KDS] Error fetching BACTERIA data:', err)
    } finally {
      setBacteriaLoading(false)
    }
  }, [])

  const fetchTCellData = useCallback(async () => {
    try {
      setTCellLoading(true)
      const res = await fetch('/api/agents/tcell')
      if (res.ok) {
        const data = await res.json()
        setTCellData(data)
      }
    } catch (err) {
      console.error('[KDS] Error fetching T-CELL data:', err)
    } finally {
      setTCellLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchBeeQuotes()
    fetchFireflyData()
    fetchBacteriaData()
    fetchTCellData()
  }, [fetchBeeQuotes, fetchFireflyData, fetchBacteriaData, fetchTCellData])

  const handleFireflyResync = async () => {
    try {
      const res = await fetch('/api/agents/firefly', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'resync' }),
      })
      if (res.ok) {
        setAgentActionMessage('Kuramoto phase-lock mesh re-synchronized (R = 96.5%)')
        fetchFireflyData()
        setTimeout(() => setAgentActionMessage(null), 3500)
      }
    } catch (err) {
      console.error('[FIREFLY resync error]:', err)
    }
  }

  const handleBacteriaMitigate = async () => {
    try {
      const res = await fetch('/api/agents/bacteria', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mitigate_spoilage' }),
      })
      if (res.ok) {
        setAgentActionMessage('Demand surge mitigation dispatched. Prep volume boosted.')
        fetchBacteriaData()
        setTimeout(() => setAgentActionMessage(null), 3500)
      }
    } catch (err) {
      console.error('[BACTERIA mitigate error]:', err)
    }
  }

  const handleTcellCalibrate = async () => {
    try {
      const res = await fetch('/api/agents/tcell', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'calibrate_sanitizer', sanitizer_ppm: 220 }),
      })
      if (res.ok) {
        setAgentActionMessage('Quat sanitizer recalibrated to optimal 220 PPM')
        fetchTCellData()
        setTimeout(() => setAgentActionMessage(null), 3500)
      }
    } catch (err) {
      console.error('[T-CELL calibrate error]:', err)
    }
  }

  const handleTcellResolveFlag = async (flagId: string) => {
    try {
      const res = await fetch('/api/agents/tcell', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'resolve_hazard', flag_id: flagId }),
      })
      if (res.ok) {
        setAgentActionMessage(`Hazard ${flagId} verified & neutralized`)
        fetchTCellData()
        setTimeout(() => setAgentActionMessage(null), 3500)
      }
    } catch (err) {
      console.error('[T-CELL resolve flag error]:', err)
    }
  }

  const filteredBeeQuotes =
    beeCategory === 'All'
      ? beeQuotes
      : beeQuotes.filter((q) => q.category === beeCategory)

  return (
    <div className="min-h-screen bg-gray-950 text-white font-sans flex antialiased selection:bg-emerald-500 selection:text-black">
      {/* ── Left Dock Navigation (Vertical biological nodes) ── */}
      <aside className="w-14 sm:w-16 border-r border-gray-800/80 bg-gray-950/95 flex flex-col items-center py-4 justify-between shrink-0 z-20">
        <div className="flex flex-col items-center gap-6">
          {/* Top Biological Glyphic Logo */}
          <button
            type="button"
            onClick={() => setActiveNav('dashboard')}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-950/70 border border-emerald-500/50 text-emerald-400 shadow-lg shadow-emerald-950/40 hover:scale-105 transition-all cursor-pointer"
            title="SymbioServe Core Engine"
          >
            <span className="font-mono text-xl font-black text-emerald-400">§</span>
          </button>

          {/* Navigation Nodes */}
          <nav className="flex flex-col items-center gap-3">
            <button
              type="button"
              onClick={() => setActiveNav('dashboard')}
              title="Dashboard (All Nodes)"
              className={`flex h-9 w-9 items-center justify-center rounded-lg transition-all cursor-pointer ${
                activeNav === 'dashboard'
                  ? 'bg-emerald-500 text-gray-950 shadow-md shadow-emerald-500/20 font-bold'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/60'
              }`}
            >
              <LayoutDashboard className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveNav('agents')
                setCol2Tab('firefly')
              }}
              title="Autonomous Agents (ANT, BEE, FIREFLY)"
              className={`flex h-9 w-9 items-center justify-center rounded-lg transition-all cursor-pointer ${
                activeNav === 'agents'
                  ? 'bg-emerald-500 text-gray-950 shadow-md shadow-emerald-500/20 font-bold'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/60'
              }`}
            >
              <Bug className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveNav('inventory')
                setCol3Tab('slime')
              }}
              title="Inventory Velocity & SLIME"
              className={`flex h-9 w-9 items-center justify-center rounded-lg transition-all cursor-pointer ${
                activeNav === 'inventory'
                  ? 'bg-emerald-500 text-gray-950 shadow-md shadow-emerald-500/20 font-bold'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/60'
              }`}
            >
              <Package className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveNav('immune')
                setCol3Tab('tcell')
              }}
              title="Kitchen Immune Defense (T-CELL)"
              className={`flex h-9 w-9 items-center justify-center rounded-lg transition-all cursor-pointer ${
                activeNav === 'immune'
                  ? 'bg-emerald-500 text-gray-950 shadow-md shadow-emerald-500/20 font-bold'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/60'
              }`}
            >
              <ShieldCheck className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveNav('telemetry')
                setCol3Tab('bacteria')
              }}
              title="Biological Telemetry & BACTERIA"
              className={`flex h-9 w-9 items-center justify-center rounded-lg transition-all cursor-pointer ${
                activeNav === 'telemetry'
                  ? 'bg-emerald-500 text-gray-950 shadow-md shadow-emerald-500/20 font-bold'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/60'
              }`}
            >
              <Radio className="h-4 w-4" />
            </button>
          </nav>
        </div>

        {/* Bottom Dock Nodes */}
        <div className="flex flex-col items-center gap-3">
          <div
            title={realtimeConnected ? 'Stream Online' : 'Stream Reconnecting'}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-900 border border-gray-800"
          >
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                realtimeConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
              }`}
            />
          </div>
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-800 text-gray-400 hover:text-white"
            title="User Profile: Commander"
          >
            <User className="h-4 w-4" />
          </button>
        </div>
      </aside>

      {/* ── Main Work Area ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <CrossNav />
        {/* ── Header ── */}
        <header className="px-5 py-3 border-b border-gray-800/80 bg-gray-950/80 sticky top-0 z-30 backdrop-blur-md flex flex-wrap items-center justify-between gap-3">
          {/* Left Title & System Badge */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="font-mono text-2xl font-black text-emerald-400">§</span>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
                SymbioServe OS
              </h1>
            </div>
            <span className="font-mono text-xs text-gray-400 hidden sm:inline-block border-l border-gray-800 pl-3">
              Kitchen Display-950
            </span>
          </div>

          {/* Top-Centered Critical DLQ Alert Badge */}
          <div className="flex items-center justify-center">
            {failedWebhooks.length > 0 ? (
              <button
                type="button"
                onClick={() => setShowDlqModal(true)}
                className="flex items-center gap-1.5 rounded-full bg-red-950/90 border border-red-600/80 px-3.5 py-1 text-xs font-bold text-red-400 animate-pulse hover:bg-red-900/90 shadow-md shadow-red-950/50 cursor-pointer"
                title="Review dead-letter webhooks"
              >
                <AlertTriangle className="h-3.5 w-3.5 text-red-400" />
                <span>Critical DLQ Alert: {failedWebhooks.length}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setShowDlqModal(true)}
                className="flex items-center gap-1.5 rounded-full bg-red-950/50 border border-red-900/50 px-3.5 py-1 text-xs font-semibold text-red-400/80 hover:bg-red-900/60 transition-colors cursor-pointer"
                title="DLQ buffer clear"
              >
                <AlertTriangle className="h-3.5 w-3.5 text-red-400" />
                <span>Critical DLQ Alert</span>
              </button>
            )}
          </div>

          {/* Right Network Telemetry & SaaS Tier Selector */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
            {/* Sy-gray-950 badge */}
            <div className="hidden lg:flex items-center gap-1.5 rounded-md bg-gray-900/90 border border-gray-800 px-2.5 py-1 text-xs font-mono text-gray-300">
              <Activity className="h-3 w-3 text-emerald-400" />
              <span>Sy-gray-950</span>
            </div>

            {/* Soojorg Café / 1% Flads */}
            <div className="hidden xl:flex items-center gap-1 rounded-md bg-gray-900/90 border border-gray-800 px-2.5 py-1 text-xs text-gray-300">
              <span className="font-semibold text-gray-200">Soojorg Café</span>
              <span className="text-gray-500">·</span>
              <span className="text-emerald-400 font-mono text-[11px]">1% Flads</span>
            </div>

            {/* Subscription Tier Selector (Interactive Glassmorphic Dropdown matching video) */}
            <div
              data-testid="saas-tier-selector"
              className="relative"
            >
              <button
                type="button"
                onClick={() => setShowTierDropdown((prev) => !prev)}
                className="flex items-center gap-2 rounded-lg border border-gray-700/80 bg-gray-900/95 px-3 py-1.5 text-xs font-bold text-amber-300 shadow-md hover:border-amber-500/60 transition-all cursor-pointer"
                title="Select Active Subscription Tier"
              >
                <Crown className="h-3.5 w-3.5 text-amber-400" />
                <span>{activeTier}</span>
                <ChevronDown
                  className={`h-3 w-3 text-gray-400 transition-transform ${
                    showTierDropdown ? 'rotate-180 text-amber-300' : ''
                  }`}
                />
              </button>

              {/* Accessible hidden select for form/test bindings */}
              <select
                aria-label="Active Subscription Tier"
                value={activeTier}
                onChange={(e) => setActiveTier(e.target.value as SaasTier)}
                className="sr-only"
                tabIndex={-1}
              >
                {SAAS_TIERS.map((tier) => (
                  <option key={tier.id} value={tier.id}>
                    {tier.label}
                  </option>
                ))}
              </select>

              {/* Dropdown Popover */}
              {showTierDropdown && (
                <div className="absolute right-0 mt-2 w-56 rounded-xl border border-gray-700 bg-gray-950/95 p-2 shadow-2xl backdrop-blur-md z-50 animate-in fade-in zoom-in-95">
                  <div className="px-2 py-1.5 text-[10px] font-mono uppercase tracking-wider text-gray-400 border-b border-gray-800">
                    Active Subscription Tier
                  </div>
                  <div className="mt-1 space-y-1">
                    {SAAS_TIERS.map((tier) => {
                      const isSelected = activeTier === tier.id
                      return (
                        <button
                          key={tier.id}
                          type="button"
                          onClick={() => {
                            setActiveTier(tier.id)
                            setShowTierDropdown(false)
                          }}
                          className={`w-full flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-semibold text-left transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50'
                              : 'text-gray-300 hover:bg-gray-800/80 hover:text-white'
                          }`}
                        >
                          <span>{tier.label}</span>
                          {isSelected && <Check className="h-3.5 w-3.5 text-emerald-400" />}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Intercostal telemetry pill */}
            <div className="flex items-center gap-1.5 rounded-md bg-emerald-950/70 border border-emerald-800/80 px-2.5 py-1 text-xs font-mono font-bold text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
              <span>Intercostal: 904.841</span>
            </div>

            {/* 2 TUK pill */}
            <span className="rounded-md bg-cyan-950/80 border border-cyan-800/70 px-2.5 py-1 text-xs font-mono font-bold text-cyan-300">
              2 TUK
            </span>

            {/* 50 FNU pill */}
            <span className="rounded-md bg-rose-950/80 border border-rose-800/70 px-2.5 py-1 text-xs font-mono font-bold text-rose-300">
              50 FNU
            </span>

            {/* Notification bell */}
            <button
              type="button"
              onClick={() => setShowDlqModal(true)}
              className="relative rounded-md p-1.5 text-gray-400 hover:text-white hover:bg-gray-800/70 transition-colors cursor-pointer"
              title="Notifications"
            >
              <Bell className="h-4 w-4" />
              <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-red-500 animate-pulse" />
            </button>

            {/* User Avatar */}
            <div className="h-7 w-7 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center text-xs font-bold text-gray-950 shadow-inner">
              KD
            </div>
          </div>
        </header>

        {/* Global Agent Action Notification Banner */}
        {agentActionMessage && (
          <div className="fixed top-16 right-6 z-50 rounded-lg bg-emerald-950/95 border border-emerald-500 px-4 py-2 text-xs font-bold text-emerald-300 shadow-xl shadow-emerald-950/80 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-emerald-400" />
            {agentActionMessage}
          </div>
        )}

        {/* ── Main Agent Grid (3 Columns) ── */}
        <main className="p-4 sm:p-5 grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* ════════ COLUMN 1: ANT AGENT (Unified Queue) ════════ */}
          <section
            data-testid="ant-queue-column"
            className={`relative flex flex-col rounded-xl border border-gray-800 bg-gray-900/80 p-4 shadow-lg min-w-0 transition-all ${
              isTier1 ? 'border-amber-900/60 overflow-hidden' : ''
            }`}
          >
            {/* Conditional Tier 1 Gating Overlay (Frosted Minimalist Lock matching video frames 00:04-00:06) */}
            {isTier1 && (
              <div
                data-testid="tier-1-gating-overlay"
                className="absolute inset-0 z-20 flex flex-col items-center justify-center rounded-xl bg-gray-950/75 backdrop-blur-[6px] p-6 text-center"
              >
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-900/90 border border-emerald-500/50 text-emerald-400 shadow-[0_0_30px_rgba(16,185,129,0.35)] animate-pulse">
                  <Lock className="h-8 w-8 text-emerald-400" />
                </div>
                <span
                  data-testid="tier-upgrade-badge"
                  className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 border border-amber-500/50 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-amber-300 shadow-sm"
                >
                  <ShieldAlert className="h-3.5 w-3.5 text-amber-400" />
                  Requires Tier 2 Upgrade
                </span>
                <h3 className="text-sm font-bold text-gray-200 mt-2">
                  Unified Queue (ANT) Gated
                </h3>
                <p className="mt-1 max-w-[240px] text-[11px] text-gray-400 leading-relaxed">
                  Delivery ingestion is restricted on{' '}
                  <span className="text-amber-300 font-medium">Tier 1: Local Cafe</span>.
                </p>
                <button
                  type="button"
                  data-testid="upgrade-tier-button"
                  onClick={() => setActiveTier('Tier 2: Fast Casual')}
                  className="mt-3.5 inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-2 text-xs font-bold text-gray-950 shadow-lg shadow-emerald-950/60 hover:from-emerald-400 hover:to-teal-400 transition-all cursor-pointer"
                >
                  <Crown className="h-3.5 w-3.5 text-gray-950" />
                  Upgrade to Tier 2: Fast Casual
                </button>
              </div>
            )}

            {/* Column 1 Content */}
            <div
              className={`flex flex-col flex-1 transition-all ${
                isTier1 ? 'opacity-20 filter blur-[0.5px] pointer-events-none select-none' : ''
              }`}
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-gray-800 pb-2.5 mb-3">
                <div className="flex items-center gap-2">
                  <Truck className="h-4 w-4 text-emerald-400" />
                  <h2 className="text-sm font-bold tracking-wide text-white uppercase">
                    Unified Queue (ANT)
                  </h2>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="rounded-full bg-emerald-950/80 border border-emerald-800/70 px-2 py-0.5 text-[10px] font-mono font-bold text-emerald-400">
                    ANT AGENT
                  </span>
                  <span className="rounded-full bg-gray-800 px-2 py-0.5 text-[10px] font-mono text-gray-400">
                    {orders.length}
                  </span>
                </div>
              </div>

              {/* Glowing Top Sparkline Area Chart */}
              <div className="relative mb-3 rounded-lg bg-gray-950/90 border border-gray-800/80 p-2.5 overflow-hidden">
                <div className="flex items-center justify-between mb-1 text-[11px]">
                  <span className="text-gray-400 font-medium">Throughput Flux</span>
                  <span className="font-mono text-emerald-400 font-bold flex items-center gap-1">
                    <TrendingUp className="h-3 w-3" />
                    +18.4%
                  </span>
                </div>
                <div className="h-16 w-full relative">
                  <svg className="w-full h-full overflow-visible" viewBox="0 0 280 60" preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="antGlowGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10b981" stopOpacity="0.4" />
                        <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>
                    {/* Area fill */}
                    <path
                      d="M 0 50 Q 40 20, 80 35 T 160 15 T 220 28 T 280 8 L 280 60 L 0 60 Z"
                      fill="url(#antGlowGrad)"
                    />
                    {/* Glowing Stroke line */}
                    <path
                      d="M 0 50 Q 40 20, 80 35 T 160 15 T 220 28 T 280 8"
                      fill="none"
                      stroke="#10b981"
                      strokeWidth="2"
                      style={{ filter: 'drop-shadow(0 0 4px rgba(16, 185, 129, 0.7))' }}
                    />
                    {/* Indicator dots */}
                    <circle cx="160" cy="15" r="3" fill="#10b981" />
                    <circle cx="280" cy="8" r="3" fill="#34d399" />
                  </svg>
                </div>

                {/* Video Ticket Feeds / Synthetic Telemetry Badges */}
                <div className="grid grid-cols-2 gap-1.5 mt-2 pt-2 border-t border-gray-800/80 text-[10px] font-mono">
                  <div className="flex justify-between items-center bg-gray-900/60 px-2 py-1 rounded">
                    <span className="text-gray-400">Frervallrdions</span>
                    <span className="text-rose-400 font-semibold">-1.484 GH</span>
                  </div>
                  <div className="flex justify-between items-center bg-gray-900/60 px-2 py-1 rounded">
                    <span className="text-gray-400">Mayusullan fey</span>
                    <span className="text-emerald-400 font-semibold">+3.003 CH</span>
                  </div>
                  <div className="flex justify-between items-center bg-gray-900/60 px-2 py-1 rounded">
                    <span className="text-gray-400">Cclab Binndga</span>
                    <span className="text-amber-400 font-semibold">+1.84 TH</span>
                  </div>
                  <div className="flex justify-between items-center bg-gray-900/60 px-2 py-1 rounded">
                    <span className="text-gray-400">Bveohd chores</span>
                    <span className="text-rose-400 font-semibold">-1.205 GM</span>
                  </div>
                </div>
              </div>

              {/* Real-time Order Cards Stream */}
              <div className="flex-1 space-y-2.5 overflow-y-auto max-h-[380px] pr-1">
                {isLoading ? (
                  <div className="animate-pulse space-y-2.5">
                    <div className="h-20 rounded-lg bg-gray-800/60" />
                    <div className="h-20 rounded-lg bg-gray-800/60" />
                  </div>
                ) : orders.length === 0 ? (
                  <div className="rounded-lg border border-gray-800/60 bg-gray-950/60 p-4 text-center text-gray-500">
                    <Radio className="h-6 w-6 mx-auto mb-2 text-emerald-500/50 animate-pulse" />
                    <p className="text-xs font-semibold text-gray-300">Unified Queue Clear</p>
                    <p className="text-[11px] text-gray-500 mt-1">
                      Listening for delivery webhooks on POST /api/webhooks/delivery
                    </p>
                  </div>
                ) : (
                  orders.map((order) => {
                    const parsedItems = parseOrderItems(order.items)
                    return (
                      <div
                        key={order.id || order.order_id}
                        className="rounded-lg border border-gray-800 bg-gray-950/90 p-3 transition-all hover:border-emerald-700/50 shadow-sm"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span
                              className={`rounded px-2 py-0.5 text-[10px] font-bold border uppercase tracking-wide ${getPlatformBadge(
                                order.source_platform
                              )}`}
                            >
                              {order.source_platform || 'Delivery'}
                            </span>
                            <span className="font-mono text-xs font-bold text-gray-200">
                              #{order.order_id}
                            </span>
                          </div>
                          <span className="flex items-center gap-1 text-[10px] text-gray-400">
                            <Clock className="h-3 w-3" />
                            {formatRelativeTime(order.received_at)}
                          </span>
                        </div>

                        <ul className="space-y-1 my-1.5 border-t border-gray-800/60 pt-1.5 text-xs">
                          {parsedItems.map((item, idx) => (
                            <li key={idx} className="flex justify-between items-center text-gray-300">
                              <span className="truncate max-w-[170px]">{item.name}</span>
                              <span className="font-mono font-semibold text-amber-300 bg-amber-950/40 px-1.5 py-0.2 rounded text-[10px]">
                                x{item.quantity}
                              </span>
                            </li>
                          ))}
                        </ul>

                        <div className="flex justify-between items-center pt-1.5 text-[10px] text-gray-500">
                          <span className="flex items-center gap-1 text-emerald-400">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            Ready for Line Prep
                          </span>
                          <span>{parsedItems.length} items</span>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>

              {/* Bottom Metrics Pill (Matches video Lowed Trirce / Recon Specnt) */}
              <div className="mt-3 pt-2.5 border-t border-gray-800 grid grid-cols-2 gap-2 text-[10px]">
                <div className="bg-gray-950/80 border border-gray-800/80 rounded px-2.5 py-1.5 flex flex-col">
                  <span className="text-gray-500 uppercase tracking-wider text-[9px]">Lowed Trirce</span>
                  <span className="font-mono text-emerald-400 font-bold text-xs mt-0.5">55%, 17 FPS</span>
                </div>
                <div className="bg-gray-950/80 border border-gray-800/80 rounded px-2.5 py-1.5 flex flex-col">
                  <span className="text-gray-500 uppercase tracking-wider text-[9px]">Recon Specnt</span>
                  <span className="font-mono text-emerald-400 font-bold text-xs mt-0.5">6.48.5%</span>
                </div>
              </div>

              {/* Footer row */}
              <div className="mt-2 flex items-center justify-between text-[9px] font-mono text-gray-500 px-0.5">
                <span>Do-gray-950</span>
                <span>CSCTB: 60164</span>
                <span>ADK: 1016</span>
              </div>
            </div>
          </section>

          {/* ════════ COLUMN 2: BEE AGENT & FIREFLY AGENT ════════ */}
          <section className="flex flex-col rounded-xl border border-gray-800 bg-gray-900/80 p-4 shadow-lg min-w-0">
            {/* Column 2 Header with Sub-tabs */}
            <div className="flex items-center justify-between border-b border-gray-800 pb-2.5 mb-3">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setCol2Tab('bee')}
                  className={`px-2.5 py-1 rounded text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    col2Tab === 'bee'
                      ? 'bg-amber-500/20 border border-amber-500/60 text-amber-300 shadow-sm'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                  Supplier Forager (BEE)
                </button>
                <button
                  type="button"
                  onClick={() => setCol2Tab('firefly')}
                  className={`px-2.5 py-1 rounded text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    col2Tab === 'firefly'
                      ? 'bg-blue-500/20 border border-blue-500/60 text-blue-300 shadow-sm'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <ChefHat className="h-3.5 w-3.5 text-blue-400" />
                  Active Stations (FIREFLY)
                </button>
              </div>

              <button
                type="button"
                onClick={() => {
                  fetchBeeQuotes()
                  fetchFireflyData()
                }}
                title="Refresh Forager & Station Telemetry"
                className="text-gray-400 hover:text-white p-1 rounded hover:bg-gray-800/80 cursor-pointer"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${beeLoading || fireflyLoading ? 'animate-spin text-amber-400' : ''}`}
                />
              </button>
            </div>

            {/* TAB 1: BEE AGENT — Local Farmer Feeds & Autonomous POs */}
            {col2Tab === 'bee' && (
              <div className="flex flex-col flex-1 min-w-0">
                {/* Farmer Category Selector matching video */}
                <div className="flex items-center justify-between mb-2 text-xs">
                  <div className="flex items-center gap-1 bg-gray-950/80 p-0.5 rounded border border-gray-800/80 text-[11px]">
                    {(['All', 'Local Farmers', 'Reconstructive local farmers'] as const).map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setBeeCategory(cat)}
                        className={`px-2 py-0.5 rounded transition-all cursor-pointer ${
                          beeCategory === cat
                            ? 'bg-amber-500 text-gray-950 font-bold'
                            : 'text-gray-400 hover:text-white'
                        }`}
                      >
                        {cat === 'Reconstructive local farmers' ? 'Reconstructive' : cat}
                      </button>
                    ))}
                  </div>

                  <span className="font-mono text-[10px] text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/60">
                    {beeQuotes.length} POs Active
                  </span>
                </div>

                {/* Farmer Feeds List matching video frame values */}
                <div className="flex-1 space-y-2 overflow-y-auto max-h-[440px] pr-1">
                  {beeLoading ? (
                    <div className="animate-pulse space-y-2">
                      <div className="h-16 rounded-lg bg-gray-800/60" />
                      <div className="h-16 rounded-lg bg-gray-800/60" />
                    </div>
                  ) : filteredBeeQuotes.length === 0 ? (
                    <div className="text-center py-8 text-gray-500 text-xs">
                      No supplier feeds in this category
                    </div>
                  ) : (
                    filteredBeeQuotes.map((quote) => {
                      const isPositive =
                        !quote.delta_value || quote.delta_value.startsWith('+')
                      return (
                        <div
                          key={quote.id || quote.item}
                          className="rounded-lg border border-gray-800/90 bg-gray-950/90 p-2.5 transition-all hover:border-amber-700/60 hover:bg-gray-950 shadow-sm flex items-center justify-between gap-2"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-xs text-gray-200 truncate">
                                {quote.supplier}
                              </span>
                            </div>
                            <p className="text-[11px] text-gray-400 truncate mt-0.5">
                              {quote.item}
                            </p>
                            <span className="text-[9px] font-mono text-gray-500">
                              ETA: {quote.eta}&ensp;·&ensp;{quote.timestamp || 'Today'}
                            </span>
                          </div>

                          <div className="flex flex-col items-end shrink-0">
                            {/* Delta / Flux value badge matching video (+28.871, +148.585) */}
                            <span
                              className={`font-mono text-xs font-bold ${
                                isPositive ? 'text-emerald-400' : 'text-rose-400'
                              }`}
                            >
                              {quote.delta_value || `₹${Number(quote.restock_price).toFixed(2)}`}
                            </span>
                            {quote.delta_pct && (
                              <span
                                className={`text-[10px] font-mono ${
                                  quote.delta_pct.startsWith('+') ? 'text-emerald-400' : 'text-rose-400'
                                }`}
                              >
                                {quote.delta_pct}
                              </span>
                            )}
                            <span className="mt-1 rounded bg-amber-950/80 border border-amber-800/60 px-1.5 py-0.2 text-[9px] font-bold text-amber-300">
                              {quote.action}
                            </span>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>

                {/* Bottom Autonomous Restock Marquee */}
                <div className="mt-3 pt-2.5 border-t border-gray-800">
                  <div className="overflow-hidden rounded bg-gray-950/80 border border-amber-900/40 p-1.5">
                    <div className="flex w-max animate-marquee gap-3">
                      {[...beeQuotes, ...beeQuotes].slice(0, 10).map((q, idx) => (
                        <div key={idx} className="flex items-center gap-1.5 text-[10px] shrink-0 font-mono">
                          <span className="text-amber-400 font-bold">{q.supplier}</span>
                          <span className="text-gray-400">{q.item}</span>
                          <span className="text-emerald-400 font-semibold">{q.delta_value || `₹${q.restock_price}`}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="mt-1.5 flex items-center justify-between text-[10px] text-gray-500 px-1 font-mono">
                    <span className="text-amber-400 flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-ping" />
                      Foraging Co-ops
                    </span>
                    <span>+6:00 AM UTC</span>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: FIREFLY AGENT — Active Stations (Phase-Lock Oscillators & Thermal Load) */}
            {col2Tab === 'firefly' && (
              <div className="flex flex-col flex-1 min-w-0">
                {/* Global Kuramoto Phase Coherence Card */}
                <div className="rounded-lg bg-gray-950/90 border border-blue-900/40 p-3 mb-3">
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="font-semibold text-gray-200 flex items-center gap-1.5">
                      <Gauge className="h-3.5 w-3.5 text-blue-400" />
                      Global Phase Coherence (R)
                    </span>
                    <span className="font-mono text-blue-400 font-black text-sm">
                      {fireflyData?.metrics?.global_coherence_R !== undefined
                        ? `${(fireflyData.metrics.global_coherence_R * 100).toFixed(1)}%`
                        : '94.8%'}
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="h-2 w-full rounded-full bg-gray-800 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-400"
                      style={{
                        width: `${
                          (fireflyData?.metrics?.global_coherence_R ?? 0.948) * 100
                        }%`,
                      }}
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-2 mt-2 pt-2 border-t border-gray-800/80 text-[10px] font-mono text-gray-400">
                    <div>
                      <span className="block text-gray-500">Coupling K</span>
                      <span className="text-gray-200 font-bold">
                        {fireflyData?.metrics?.coupling_strength_K ?? 0.82}
                      </span>
                    </div>
                    <div>
                      <span className="block text-gray-500">Thermal Headroom</span>
                      <span className="text-emerald-400 font-bold">
                        +{fireflyData?.metrics?.thermal_headroom_celsius ?? 42}°C
                      </span>
                    </div>
                    <div>
                      <span className="block text-gray-500">Sync State</span>
                      <span className="text-blue-300 font-bold truncate">
                        {fireflyData?.metrics?.sync_state ?? 'Fully Phase-Locked'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Stations List */}
                <div className="flex-1 space-y-2.5 overflow-y-auto max-h-[380px] pr-1">
                  {(fireflyData?.stations || []).map((station) => (
                    <div
                      key={station.id}
                      className="rounded-lg border border-gray-800 bg-gray-950/90 p-2.5 transition-all hover:border-blue-700/60 shadow-sm"
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-1.5">
                          <ChefHat className="h-3.5 w-3.5 text-blue-400" />
                          <span className="font-bold text-xs text-gray-100">
                            {station.name}
                          </span>
                        </div>
                        <span className="rounded bg-blue-950/80 border border-blue-800/70 px-2 py-0.5 text-[9px] font-bold text-blue-300 font-mono">
                          {station.status.replace('_', ' ').toUpperCase()}
                        </span>
                      </div>

                      {/* Station Phase Frequency & Thermal Load Meter */}
                      <div className="grid grid-cols-3 gap-2 my-2 text-[10px] font-mono bg-gray-900/60 p-1.5 rounded">
                        <div>
                          <span className="text-gray-500 block">Frequency</span>
                          <span className="text-blue-400 font-bold">
                            {station.frequency_hz} Hz
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-500 block">Phase Angle</span>
                          <span className="text-cyan-400 font-bold">
                            {station.phase_degrees}°
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-500 block">Thermal Load</span>
                          <span
                            className={`font-bold flex items-center gap-0.5 ${
                              (station.thermal_load_celsius ?? 0) > 200
                                ? 'text-amber-400'
                                : 'text-emerald-400'
                            }`}
                          >
                            <Thermometer className="h-3 w-3" />
                            {station.thermal_load_celsius ?? station.temperature_celsius ?? 65}°C
                          </span>
                        </div>
                      </div>

                      {/* Lead Cook & Active Items */}
                      <div className="flex items-center justify-between text-[10px] text-gray-400 pt-1 border-t border-gray-800/60">
                        <span>Lead: <strong className="text-gray-300">{station.lead_cook}</strong></span>
                        <span className="truncate max-w-[150px] text-gray-500">
                          {station.active_items.join(', ')}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-3 pt-2 border-t border-gray-800 flex items-center justify-between text-[10px] text-gray-500 font-mono">
                  <button
                    type="button"
                    onClick={handleFireflyResync}
                    className="flex items-center gap-1.5 text-blue-400 hover:text-blue-300 transition-colors cursor-pointer"
                    title="Click to trigger Kuramoto phase-lock mesh re-sync"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-ping" />
                    <span>Re-sync Kuramoto Mesh</span>
                  </button>
                  <span>GET /api/agents/firefly</span>
                </div>
              </div>
            )}
          </section>

          {/* ════════ COLUMN 3: SLIME AGENT & BACTERIA & T-CELL ════════ */}
          <section className="flex flex-col rounded-xl border border-gray-800 bg-gray-900/80 p-4 shadow-lg min-w-0">
            {/* Column 3 Header with Switcher Tabs */}
            <div className="flex items-center justify-between border-b border-gray-800 pb-2.5 mb-3">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setCol3Tab('slime')}
                  className={`px-2 py-1 rounded text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                    col3Tab === 'slime'
                      ? 'bg-purple-500/20 border border-purple-500/60 text-purple-300 shadow-sm'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <TrendingDown className="h-3.5 w-3.5 text-purple-400" />
                  SLIME
                </button>
                <button
                  type="button"
                  onClick={() => setCol3Tab('bacteria')}
                  className={`px-2 py-1 rounded text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                    col3Tab === 'bacteria'
                      ? 'bg-emerald-500/20 border border-emerald-500/60 text-emerald-300 shadow-sm'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <Biohazard className="h-3.5 w-3.5 text-emerald-400" />
                  BACTERIA
                </button>
                <button
                  type="button"
                  onClick={() => setCol3Tab('tcell')}
                  className={`px-2 py-1 rounded text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                    col3Tab === 'tcell'
                      ? 'bg-rose-500/20 border border-rose-500/60 text-rose-300 shadow-sm'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <ShieldCheck className="h-3.5 w-3.5 text-rose-400" />
                  T-CELL
                </button>
              </div>

              <span className="rounded-full bg-purple-950/80 border border-purple-800/70 px-2 py-0.5 text-[10px] font-mono text-purple-300">
                {col3Tab.toUpperCase()}
              </span>
            </div>

            {/* SUB-VIEW 1: SLIME AGENT (Inventory Velocity & Flip Counter) */}
            {col3Tab === 'slime' && (
              <div className="flex flex-col flex-1 min-w-0">
                {/* Main Flip Counter / Odometer Card matching video */}
                <div className="rounded-lg bg-gray-950/90 border border-gray-800/90 p-3 mb-3 shadow-inner">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <h3 className="font-bold text-sm text-gray-100">Gulab Jamun</h3>
                      <p className="text-[10px] text-gray-500">Autonomous Price Decay Target</p>
                    </div>
                    <span className="rounded bg-gray-800 px-2 py-0.5 text-[9px] font-mono text-gray-400">
                      60fps
                    </span>
                  </div>

                  {/* Flip Counter / Odometer Display + -38% Decay Badge */}
                  <div className="flex items-center justify-between my-2">
                    <button
                      type="button"
                      onClick={() => setOdometerIndex((prev) => (prev + 1) % ODOMETER_STAGES.length)}
                      title="Click to advance mechanical odometer"
                      className="flex items-center gap-1.5 font-mono text-2xl font-black cursor-pointer group"
                    >
                      {odometerVal.split('').map((digit, idx) => (
                        <div
                          key={idx}
                          className="flex h-11 w-8 items-center justify-center rounded-md border border-gray-700/80 bg-gray-900/90 text-white shadow-inner tracking-widest transition-all group-hover:border-emerald-500/70"
                        >
                          {digit}
                        </div>
                      ))}
                    </button>

                    <div className="flex items-center gap-1 rounded-full bg-emerald-950/90 border border-emerald-500/80 px-3 py-1 text-xs font-extrabold text-emerald-400 shadow-lg shadow-emerald-950/60">
                      <ArrowDownRight className="h-3.5 w-3.5" />
                      -38% Decay
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[10px] font-mono text-gray-500 pt-1.5 border-t border-gray-800/80">
                    <span className="text-gray-400">5% Velocity Index</span>
                    <span className="text-gray-400">Total Dure: 1%</span>
                  </div>
                </div>

                {/* Glowing Green SVG Area Sparkline (Country Fity from video) */}
                <div className="rounded-lg bg-gray-950/90 border border-gray-800/90 p-3 mb-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-gray-300">Country Fity</span>
                    <div className="flex items-center gap-1 text-xs font-mono font-bold text-emerald-400">
                      <ArrowUpRight className="h-3 w-3" />
                      306 mb
                    </div>
                  </div>

                  {/* SVG Chart */}
                  <div className="h-16 w-full relative">
                    <svg className="w-full h-full overflow-visible" viewBox="0 0 260 55" preserveAspectRatio="none">
                      <defs>
                        <linearGradient id="slimeSparkGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#10b981" stopOpacity="0.45" />
                          <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                        </linearGradient>
                      </defs>
                      <path
                        d="M 0 45 Q 35 48, 70 35 T 140 20 T 200 12 T 260 8 L 260 55 L 0 55 Z"
                        fill="url(#slimeSparkGrad)"
                      />
                      <path
                        d="M 0 45 Q 35 48, 70 35 T 140 20 T 200 12 T 260 8"
                        fill="none"
                        stroke="#10b981"
                        strokeWidth="2.5"
                        style={{ filter: 'drop-shadow(0 0 6px rgba(16, 185, 129, 0.8))' }}
                      />
                      <circle cx="200" cy="12" r="3.5" fill="#34d399" />
                      <circle cx="260" cy="8" r="3.5" fill="#6ee7b7" />
                    </svg>
                  </div>

                  <div className="flex items-center justify-between text-[10px] font-mono text-gray-500 pt-2 border-t border-gray-800/80">
                    <span>Genres</span>
                    <span className="text-emerald-400 font-bold">+11%</span>
                    <span>GREEN TW</span>
                  </div>
                </div>

                {/* Dynamic Pricing Catalog from Supabase Realtime menu_items */}
                <div className="flex-1 space-y-2 overflow-y-auto max-h-[220px] pr-1">
                  {isLoading ? (
                    <div className="animate-pulse space-y-2">
                      <div className="h-14 rounded-lg bg-gray-800/60" />
                      <div className="h-14 rounded-lg bg-gray-800/60" />
                    </div>
                  ) : menuItems.length === 0 ? (
                    <div className="text-center py-4 text-gray-500 text-xs">
                      No dynamic items loaded
                    </div>
                  ) : (
                    menuItems.slice(0, 5).map((item) => {
                      const basePrice = Number(item.base_price) || 0
                      const dynPrice =
                        item.current_dynamic_price !== null && item.current_dynamic_price !== undefined
                          ? Number(item.current_dynamic_price)
                          : basePrice
                      const isDiscounted = dynPrice < basePrice
                      const discountPct =
                        isDiscounted && basePrice > 0
                          ? Math.round(((basePrice - dynPrice) / basePrice) * 100)
                          : 0

                      return (
                        <div
                          key={item.id || item.item_name}
                          className="rounded-lg border border-gray-800/80 bg-gray-950/80 p-2.5 transition-all hover:border-purple-700/60"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-xs text-gray-200">
                              {item.item_name}
                            </span>
                            {isDiscounted ? (
                              <span className="flex items-center gap-0.5 rounded bg-purple-950/90 border border-purple-800/70 px-1.5 py-0.2 text-[10px] font-bold text-purple-300">
                                -{discountPct}% Decay
                              </span>
                            ) : (
                              <span className="text-[10px] text-gray-500">Nominal</span>
                            )}
                          </div>
                          <div className="flex items-baseline justify-between mt-1 pt-1 border-t border-gray-800/60">
                            <span className="font-mono text-xs font-bold text-emerald-400">
                              ₹{dynPrice.toFixed(2)}
                            </span>
                            <span className="text-[9px] text-gray-500">
                              {item.last_evaluated_at
                                ? `Sync ${formatRelativeTime(item.last_evaluated_at)}`
                                : 'pg_cron stream'}
                            </span>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            )}

            {/* SUB-VIEW 2: BACTERIA AGENT (Colony Sensing & Ambient Telemetry) */}
            {col3Tab === 'bacteria' && (
              <div className="flex flex-col flex-1 min-w-0">
                {/* Ambient Telemetry Overview Card */}
                <div className="rounded-lg bg-gray-950/90 border border-emerald-900/40 p-3 mb-3">
                  <div className="flex items-center justify-between text-xs mb-2">
                    <span className="font-bold text-gray-200 flex items-center gap-1.5">
                      <Biohazard className="h-4 w-4 text-emerald-400" />
                      Colony Sensing & Telemetry
                    </span>
                    <span className="rounded bg-emerald-950/80 border border-emerald-800/60 px-2 py-0.5 text-[9px] font-mono text-emerald-300">
                      NOMINAL
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                    <div className="bg-gray-900/70 p-2 rounded border border-gray-800">
                      <span className="text-gray-500 block text-[10px]">Kitchen Ambient Temp</span>
                      <span className="text-gray-200 font-bold text-sm">
                        {bacteriaData?.ambient_telemetry?.mean_kitchen_temp_c ?? 22.4}°C
                      </span>
                    </div>
                    <div className="bg-gray-900/70 p-2 rounded border border-gray-800">
                      <span className="text-gray-500 block text-[10px]">Relative Humidity</span>
                      <span className="text-cyan-400 font-bold text-sm">
                        {bacteriaData?.ambient_telemetry?.mean_humidity_pct ?? 54.2}%
                      </span>
                    </div>
                    <div className="bg-gray-900/70 p-2 rounded border border-gray-800">
                      <span className="text-gray-500 block text-[10px]">Microbial Growth Index</span>
                      <span className="text-emerald-400 font-bold text-sm">
                        {bacteriaData?.ambient_telemetry?.microbial_growth_index ?? 0.12}
                      </span>
                    </div>
                    <div className="bg-gray-900/70 p-2 rounded border border-gray-800">
                      <span className="text-gray-500 block text-[10px]">Shelf-Life Factor</span>
                      <span className="text-amber-400 font-bold text-sm">
                        {bacteriaData?.ambient_telemetry?.shelf_life_acceleration_factor ?? 1.04}x
                      </span>
                    </div>
                  </div>
                </div>

                {/* Demand Surge Forecast Widget */}
                <div className="rounded-lg bg-gray-950/90 border border-amber-900/50 p-3 mb-3">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-bold text-amber-400 flex items-center gap-1.5">
                      <Activity className="h-3.5 w-3.5" />
                      Demand Surge Forecast
                    </span>
                    <span className="font-mono text-xs font-bold text-amber-300">
                      +{bacteriaData?.demand_surge_forecast?.estimated_volume_surge_pct ?? 34}%
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-300 mt-1 leading-relaxed">
                    Peak surge anticipated in{' '}
                    <strong className="text-amber-300 font-mono">
                      {bacteriaData?.demand_surge_forecast?.peak_predicted_in_mins ?? 18} minutes
                    </strong>
                    .
                  </p>
                  <p className="text-[10px] text-gray-500 mt-1 italic">
                    Action:{' '}
                    {bacteriaData?.demand_surge_forecast?.spoilage_mitigation_action ??
                      'Pre-prep high-velocity paneer & salads.'}
                  </p>
                  <button
                    type="button"
                    onClick={handleBacteriaMitigate}
                    className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg bg-amber-500/20 border border-amber-500/50 px-2.5 py-1 text-[11px] font-bold text-amber-300 hover:bg-amber-500/30 transition-all cursor-pointer"
                  >
                    <Biohazard className="h-3.5 w-3.5 text-amber-400" />
                    Dispatch Spoilage Surge Prep
                  </button>
                </div>

                {/* Colony Sensor Zones */}
                <div className="flex-1 space-y-2 overflow-y-auto max-h-[220px] pr-1">
                  {(bacteriaData?.zones || []).map((zone, idx) => (
                    <div
                      key={idx}
                      className="rounded border border-gray-800/80 bg-gray-950/80 p-2 text-[11px] flex justify-between items-center"
                    >
                      <div>
                        <span className="font-semibold text-gray-200 block truncate max-w-[160px]">
                          {zone.sensor_zone}
                        </span>
                        <span className="text-[10px] font-mono text-gray-500">
                          {zone.ambient_temp_celsius}°C&ensp;·&ensp;{zone.relative_humidity_pct}% RH
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="font-mono font-bold text-emerald-400">
                          {zone.cfu_count_estimate} CFU
                        </span>
                        <span className="block text-[9px] text-gray-500 uppercase">
                          {zone.spoilage_risk_level}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* SUB-VIEW 3: T-CELL AGENT (Pathogen Defense & Sanitizer PPM) */}
            {col3Tab === 'tcell' && (
              <div className="flex flex-col flex-1 min-w-0">
                {/* Sanitizer & HACCP Compliance Score */}
                <div className="rounded-lg bg-gray-950/90 border border-rose-900/40 p-3 mb-3">
                  <div className="flex items-center justify-between text-xs mb-2">
                    <span className="font-bold text-gray-200 flex items-center gap-1.5">
                      <ShieldCheck className="h-4 w-4 text-rose-400" />
                      Kitchen Immune Defense
                    </span>
                    <span className="rounded bg-rose-950/80 border border-rose-800/60 px-2 py-0.5 text-[9px] font-mono text-rose-300">
                      DEFENSE ACTIVE
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                    <div className="bg-gray-900/70 p-2 rounded border border-gray-800">
                      <span className="text-gray-500 block text-[10px]">Active Sanitizer</span>
                      <div className="flex items-baseline justify-between">
                        <span className="text-rose-400 font-bold text-sm">
                          {tcellData?.sanitizer_ppm || 215} PPM
                        </span>
                        <span className="text-[9px] text-emerald-400">Optimal (200-400)</span>
                      </div>
                      <button
                        type="button"
                        onClick={handleTcellCalibrate}
                        className="mt-1 text-[10px] text-rose-300 font-bold hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <RefreshCw className="h-2.5 w-2.5" /> Recalibrate 220 PPM
                      </button>
                    </div>
                    <div className="bg-gray-900/70 p-2 rounded border border-gray-800">
                      <span className="text-gray-500 block text-[10px]">HACCP Score</span>
                      <span className="text-emerald-400 font-bold text-sm">
                        {tcellData?.haccp_compliance_score || 99.4}%
                      </span>
                      <span className="text-[9px] text-gray-500 block">Zero Breaches</span>
                    </div>
                  </div>

                  <div className="mt-2.5 pt-2 border-t border-gray-800/80 flex items-center justify-between text-[10px]">
                    <span className="text-gray-400 flex items-center gap-1">
                      <Droplets className="h-3 w-3 text-cyan-400" />
                      UV-C Air Scrubbers
                    </span>
                    <span className="font-mono text-emerald-400 font-bold">ONLINE (99.8%)</span>
                  </div>
                </div>

                {/* Pathogen Defense Flags */}
                <div className="flex-1 space-y-2 overflow-y-auto max-h-[260px] pr-1">
                  {(tcellData?.active_flags || []).map((flag) => (
                    <div
                      key={flag.id}
                      className="rounded-lg border border-gray-800/80 bg-gray-950/80 p-2.5 text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-gray-200">{flag.zone}</span>
                        <button
                          type="button"
                          onClick={() => handleTcellResolveFlag(flag.id)}
                          className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 hover:bg-emerald-900/80 px-1.5 py-0.2 rounded border border-emerald-800/60 transition-colors cursor-pointer"
                          title="Click to neutralize hazard"
                        >
                          RESOLVED
                        </button>
                      </div>
                      <p className="text-[11px] text-gray-400 leading-snug">{flag.message}</p>
                      <span className="text-[9px] font-mono text-gray-500 block">
                        Logged {flag.timestamp}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="mt-3 pt-2 border-t border-gray-800 flex items-center justify-between text-[10px] text-gray-500 font-mono">
                  <span className="text-rose-400 flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-rose-400 animate-ping" />
                    14 Threats Neutralized
                  </span>
                  <span>GET /api/agents/tcell</span>
                </div>
              </div>
            )}
          </section>
        </main>

        {/* ── Bottom Strip: Video Frame Telemetry & Dynamic Plugin Hook ── */}
        <div className="px-4 sm:px-5 pb-5 space-y-3">
          {/* Top 3 Telemetry Cards (matching video frame 00:00) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Card 1: Eos Pclicas */}
            <div className="rounded-xl border border-gray-800/80 bg-gray-900/70 p-3 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-mono text-gray-500 uppercase">Eos Pclicas</span>
                <p className="text-xs font-bold text-gray-200 mt-0.5">Sprset 147-3</p>
              </div>
              <span className="rounded bg-rose-950/80 border border-rose-800/60 px-2 py-0.5 text-xs font-mono font-bold text-rose-400">
                -15.35%
              </span>
            </div>

            {/* Card 2: Klrpe Anocos */}
            <div className="rounded-xl border border-gray-800/80 bg-gray-900/70 p-3 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-mono text-gray-500 uppercase">Klrpe Anocos</span>
                <p className="text-xs font-mono font-bold text-emerald-400 mt-0.5">761:00</p>
              </div>
              <span className="rounded bg-emerald-950/80 border border-emerald-800/60 px-2 py-0.5 text-xs font-mono font-bold text-emerald-400">
                +16:00 AM
              </span>
            </div>

            {/* Card 3: Spree / Sarrer / GREEN TW */}
            <div className="rounded-xl border border-gray-800/80 bg-gray-900/70 p-3 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-mono text-gray-500 uppercase">Spree · Sarrer</span>
                <p className="text-xs font-bold text-emerald-300 mt-0.5">GREEN TW</p>
              </div>
              <div className="flex items-end gap-1 h-5">
                {[4, 8, 14, 18, 10, 16].map((bar, idx) => (
                  <span
                    key={idx}
                    className="w-1 bg-emerald-400/80 rounded-t"
                    style={{ height: `${bar}px` }}
                  />
                ))}
              </div>
            </div>
          </div>

          <section className="rounded-xl border border-gray-800/90 bg-gray-900/90 p-4 shadow-xl flex items-center justify-between gap-4">
            {/* Left Flanking Animated Equalizer Bars */}
            <div className="hidden sm:flex items-end gap-1 h-10 w-24 sm:w-44 shrink-0 overflow-hidden">
              {[12, 24, 8, 32, 16, 28, 6, 20, 36, 14, 26, 10, 30, 18, 22, 14, 34, 16, 28, 8, 24, 18, 30, 12].map(
                (h, idx) => (
                  <div
                    key={idx}
                    className="w-1 rounded-t bg-emerald-400/90 animate-soundwave"
                    style={{
                      height: `${h}px`,
                      animationDelay: `${(idx % 8) * 0.12}s`,
                      filter: 'drop-shadow(0 0 3px rgba(16, 185, 129, 0.6))',
                    }}
                  />
                )
              )}
            </div>

            {/* Center Dynamic Plugin Hook Title & Status */}
            <div className="flex-1 flex flex-col items-center text-center px-2">
              <div className="flex items-center gap-2 mb-1">
                <Plug className="h-4 w-4 text-emerald-400 animate-pulse" />
                <h3 className="text-base sm:text-lg font-black tracking-wide text-white">
                  Dynamic Plugin Hook
                </h3>
              </div>
              <p className="text-[11px] sm:text-xs text-gray-400 max-w-xl">
                Modular zero-downtime middleware socket for Day-Of Secret Feature injection. Decoupled from core agent fabric.
              </p>
              <div className="mt-2 flex items-center gap-2">
                <span className="rounded-full bg-emerald-950/80 border border-emerald-800/70 px-2.5 py-0.5 text-[10px] font-mono text-emerald-400 flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
                  SLOT: DAY_OF_SECRET_FEATURE
                </span>
                <span className="text-[10px] font-mono text-gray-500">
                  Ready for Hot-Plug Injection
                </span>
              </div>
            </div>

            {/* Right Flanking Animated Equalizer Bars */}
            <div className="hidden sm:flex items-end gap-1 h-10 w-24 sm:w-44 shrink-0 overflow-hidden justify-end">
              {[14, 30, 18, 22, 14, 34, 16, 28, 8, 24, 18, 30, 12, 24, 8, 32, 16, 28, 6, 20, 36, 14, 26, 10].map(
                (h, idx) => (
                  <div
                    key={idx}
                    className="w-1 rounded-t bg-emerald-400/90 animate-soundwave"
                    style={{
                      height: `${h}px`,
                      animationDelay: `${(idx % 7) * 0.15}s`,
                      filter: 'drop-shadow(0 0 3px rgba(16, 185, 129, 0.6))',
                    }}
                  />
                )
              )}
            </div>
          </section>
        </div>

        {/* ── Footer ── */}
        <footer className="px-5 py-3 border-t border-gray-800/80 text-[11px] text-gray-500 flex flex-col sm:flex-row items-center justify-between gap-2 bg-gray-950">
          <span>SymbioServe OS&ensp;·&ensp;Kitchen Display 950&ensp;·&ensp;BioFlow Engine</span>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 text-emerald-400 font-mono">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Event Stream Connected · Zero Polling
            </span>
            <span className="text-gray-600">|</span>
            <span className="font-mono text-gray-400">Mesh v2.4.0</span>
          </div>
        </footer>
      </div>

      {/* ── DLQ Review Modal ── */}
      {showDlqModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl rounded-xl border border-red-800/80 bg-gray-900 p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-800 pb-3 mb-4">
              <div className="flex items-center gap-2 text-red-400 font-semibold text-lg">
                <AlertTriangle className="h-5 w-5" />
                <span>Dead Letter Queue (DLQ) — Unresolved Webhooks</span>
              </div>
              <button
                type="button"
                onClick={() => setShowDlqModal(false)}
                className="text-gray-400 hover:text-white p-1 rounded"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-xs text-gray-400 mb-4">
              The ANT zero-liability AI engine routed the following payloads to the DLQ because item names or quantities could not be extracted with 100% financial certainty. Review and dismiss them once inspected.
            </p>

            <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
              {failedWebhooks.length === 0 ? (
                <div className="text-center py-8 text-gray-500 text-sm">
                  <CheckCircle className="h-8 w-8 text-emerald-400 mx-auto mb-2" />
                  All DLQ entries have been resolved!
                </div>
              ) : (
                failedWebhooks.map((dlq, index) => (
                  <div
                    key={dlq.id || `dlq-${index}`}
                    className="rounded-lg border border-red-900/60 bg-gray-950 p-4 space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-red-300 font-semibold">
                        ID: {dlq.id ? `${dlq.id.slice(0, 8)}...` : 'Pending ID'}
                      </span>
                      <span className="text-gray-500">
                        {formatRelativeTime(dlq.created_at)}
                      </span>
                    </div>

                    <div className="text-red-400 font-medium bg-red-950/40 p-2 rounded border border-red-900/40">
                      Reason: {dlq.error_message}
                    </div>

                    <div>
                      <span className="text-gray-500 text-[11px] block mb-1">Raw Payload:</span>
                      <pre className="bg-gray-900 p-2 rounded text-[11px] text-gray-300 font-mono overflow-x-auto whitespace-pre-wrap max-h-24">
                        {dlq.raw_payload}
                      </pre>
                    </div>

                    <div className="flex justify-end pt-2">
                      <button
                        type="button"
                        onClick={() => dlq.id && handleDismissDlq(dlq.id)}
                        disabled={!dlq.id || dismissingId === dlq.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-red-900/60 hover:bg-red-800 text-red-200 text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        {dismissingId === dlq.id ? 'Dismissing...' : 'Dismiss & Clear Alert'}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="mt-4 pt-3 border-t border-gray-800 flex justify-end">
              <button
                type="button"
                onClick={() => setShowDlqModal(false)}
                className="px-4 py-2 rounded bg-gray-800 hover:bg-gray-700 text-sm font-medium text-gray-200 transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
