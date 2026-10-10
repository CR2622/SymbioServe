'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  ChefHat,
  Cpu,
  Flame,
  ShieldCheck,
  Sliders,
  UtensilsCrossed,
} from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import type { KitchenStatusRow } from '@/lib/types'

export default function CrossNav() {
  const pathname = usePathname()
  const [kitchenStatus, setKitchenStatus] = useState<KitchenStatusRow>({
    id: 'current',
    current_labor_capacity: 'Normal',
  })
  const [realtimeActive, setRealtimeActive] = useState(false)

  // Hydrate kitchen status and listen to Supabase realtime
  useEffect(() => {
    let isMounted = true

    const fetchStatus = async () => {
      try {
        const { data, error } = await supabase
          .from('kitchen_status')
          .select('*')
          .eq('id', 'current')
          .single()

        if (data && isMounted) {
          setKitchenStatus(data as KitchenStatusRow)
        }
      } catch {
        // Fallback default
      }
    }

    fetchStatus()

    const channel = supabase
      .channel('crossnav-kitchen-status')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'kitchen_status' },
        (payload) => {
          if (payload.new) {
            setKitchenStatus(payload.new as KitchenStatusRow)
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setRealtimeActive(true)
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          setRealtimeActive(false)
        }
      })

    return () => {
      isMounted = false
      supabase.removeChannel(channel)
    }
  }, [])

  const navItems = [
    {
      href: '/',
      label: 'Master KDS',
      roleTag: 'Engine Mesh',
      icon: Cpu,
      badge: 'All Agents',
      badgeColor: 'border-emerald-500/40 text-emerald-400 bg-emerald-950/40',
    },
    {
      href: '/menu',
      label: 'Customer Menu',
      roleTag: 'Customer RBAC',
      icon: UtensilsCrossed,
      badge: 'T-CELL / BACTERIA',
      badgeColor: 'border-cyan-500/40 text-cyan-400 bg-cyan-950/40',
    },
    {
      href: '/chef',
      label: 'Chef Display',
      roleTag: 'Kitchen RBAC',
      icon: ChefHat,
      badge: 'High-Contrast KDS',
      badgeColor: 'border-amber-500/40 text-amber-400 bg-amber-950/40',
    },
    {
      href: '/ops',
      label: 'Ops & Logistics',
      roleTag: 'Managerial RBAC',
      icon: Sliders,
      badge: 'ANT / SLIME / Stock',
      badgeColor: 'border-purple-500/40 text-purple-400 bg-purple-950/40',
    },
  ]

  const isOverwhelmed = kitchenStatus.current_labor_capacity === 'Overwhelmed'

  return (
    <nav className="w-full border-b border-gray-800/80 bg-gray-950/95 backdrop-blur-md sticky top-0 z-40 select-none shadow-md shadow-black/40">
      <div className="max-w-7xl mx-auto px-3 sm:px-6">
        <div className="flex items-center justify-between h-14 gap-2">
          {/* Logo / Brand */}
          <div className="flex items-center gap-3 shrink-0">
            <Link
              href="/"
              className="flex items-center gap-2 group transition-transform hover:scale-105"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-950/80 border border-emerald-500/50 text-emerald-400 shadow-md shadow-emerald-950/40">
                <span className="font-mono text-lg font-black text-emerald-400">§</span>
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-black tracking-tight text-white flex items-center gap-1.5 leading-none">
                  SymbioServe
                  <span className="text-[10px] font-mono text-emerald-400 font-normal px-1 py-0.5 rounded bg-emerald-950/60 border border-emerald-800/60">
                    RBAC
                  </span>
                </span>
                <span className="text-[10px] font-mono text-gray-400 leading-tight">
                  BioFlow Multi-Interface
                </span>
              </div>
            </Link>
          </div>

          {/* Navigation Links */}
          <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto py-1 scrollbar-none">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 cursor-pointer ${
                    isActive
                      ? 'bg-gray-800 text-white border border-gray-700 shadow-sm shadow-emerald-500/10 font-bold'
                      : 'text-gray-400 hover:text-gray-200 hover:bg-gray-900/80'
                  }`}
                >
                  <Icon
                    className={`h-3.5 w-3.5 ${
                      isActive ? 'text-emerald-400' : 'text-gray-400'
                    }`}
                  />
                  <span>{item.label}</span>
                  <span
                    className={`hidden md:inline-block text-[9px] font-mono uppercase px-1.5 py-0.5 rounded border ${
                      item.badgeColor
                    }`}
                  >
                    {item.badge}
                  </span>
                </Link>
              )
            })}
          </div>

          {/* Right Status Telemetry */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Realtime Stream Ping */}
            <div
              title={realtimeActive ? 'Supabase Realtime Synced' : 'Connecting to Realtime Mesh'}
              className="hidden lg:flex items-center gap-1.5 px-2 py-1 rounded-md bg-gray-900/80 border border-gray-800 text-[10px] font-mono text-gray-300"
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  realtimeActive ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                }`}
              />
              <span className="text-gray-400">Stream:</span>
              <span className={realtimeActive ? 'text-emerald-400' : 'text-amber-400'}>
                {realtimeActive ? 'LIVE' : 'SYNCING'}
              </span>
            </div>

            {/* Kitchen Capacity Agent Pill (BACTERIA) */}
            <Link
              href="/ops"
              title="Click to toggle in Ops Dashboard"
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-bold transition-all ${
                isOverwhelmed
                  ? 'bg-rose-950/80 border-rose-500/80 text-rose-300 animate-pulse'
                  : 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
              }`}
            >
              {isOverwhelmed ? (
                <>
                  <Flame className="h-3.5 w-3.5 text-rose-400" />
                  <span className="hidden sm:inline">BACTERIA:</span>
                  <span>Overwhelmed (Throttled)</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                  <span className="hidden sm:inline">BACTERIA:</span>
                  <span>Normal Load</span>
                </>
              )}
            </Link>
          </div>
        </div>
      </div>
    </nav>
  )
}
