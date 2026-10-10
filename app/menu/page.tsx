'use client'

import React, { useEffect, useState, useMemo } from 'react'
import {
  Check,
  Clock,
  Flame,
  Layers,
  Plus,
  RotateCcw,
  Send,
  ShieldAlert,
  ShieldCheck,
  ShoppingBag,
  TrendingDown,
  X,
} from 'lucide-react'
import CrossNav from '@/components/CrossNav'
import { supabase } from '@/lib/supabaseClient'
import type {
  KitchenStatusRow,
  MenuItemRow,
  RecipeIngredientRow,
} from '@/lib/types'

// Default fallback items with rich recipe and allergen metadata
const FALLBACK_MENU_ITEMS: MenuItemRow[] = [
  {
    id: 'm1',
    item_name: 'Paneer Tikka',
    base_price: 299.0,
    current_dynamic_price: 245.0,
    labor_intensity_score: 5.0,
    allergens: ['Dairy'],
    category: 'Starters',
    description: 'Charcoal-charred artisanal cottage cheese steeped in Greek yogurt marinade and stone-ground spices.',
  },
  {
    id: 'm2',
    item_name: 'Chicken Biryani',
    base_price: 349.0,
    current_dynamic_price: 319.0,
    labor_intensity_score: 9.2, // THROTTLED WHEN OVERWHELMED (> 7)
    allergens: [],
    category: 'Mains',
    description: 'Slow-dum aged basmati rice infused with Kashmiri saffron, caramelized shallots, and tender chicken.',
  },
  {
    id: 'm3',
    item_name: 'Artisan Truffle Pizza',
    base_price: 420.0,
    current_dynamic_price: 389.0,
    labor_intensity_score: 8.8, // THROTTLED WHEN OVERWHELMED (> 7)
    allergens: ['Dairy', 'Gluten'],
    category: 'Mains',
    description: '72-hour cold fermented sourdough crust crowned with black truffle puree, fior di latte, and micro-herbs.',
  },
  {
    id: 'm4',
    item_name: 'Thai Peanut Satay Noodle',
    base_price: 280.0,
    current_dynamic_price: 235.0,
    labor_intensity_score: 8.1, // THROTTLED WHEN OVERWHELMED (> 7)
    allergens: ['Peanuts', 'Gluten'],
    category: 'Mains',
    description: 'Wok-charred hand-pulled noodles tossed in roasted peanut chili-lime emulsion with crispy shallot crunch.',
  },
  {
    id: 'm5',
    item_name: 'Dal Makhani',
    base_price: 199.0,
    current_dynamic_price: 182.0,
    labor_intensity_score: 4.2,
    allergens: ['Dairy'],
    category: 'Mains',
    description: 'Slow-cooked whole black lentils simmered for 24 hours with churned dairy butter and vine-ripened tomatoes.',
  },
  {
    id: 'm6',
    item_name: 'Peanut Butter Lava Brownie',
    base_price: 160.0,
    current_dynamic_price: 138.0,
    labor_intensity_score: 3.8,
    allergens: ['Peanuts', 'Dairy', 'Gluten'],
    category: 'Desserts',
    description: 'Warm Belgian dark chocolate fondant with a molten roasted peanut praline center.',
  },
  {
    id: 'm7',
    item_name: 'Gulab Jamun',
    base_price: 99.0,
    current_dynamic_price: 78.0,
    labor_intensity_score: 2.5,
    allergens: ['Dairy', 'Gluten'],
    category: 'Desserts',
    description: 'Traditional evaporated milk dumplings steeped in Damascus rose syrup and bruised green cardamom.',
  },
  {
    id: 'm8',
    item_name: 'Fresh Citrus Kale Salad',
    base_price: 190.0,
    current_dynamic_price: 165.0,
    labor_intensity_score: 2.0,
    allergens: [],
    category: 'Salads',
    description: 'Tuscan lacinato kale tossed with blood orange discs, toasted sunflower kernels, and lemon-shallot dressing.',
  },
  {
    id: 'm9',
    item_name: 'Signature Smash Burger',
    base_price: 380.0,
    current_dynamic_price: 335.0,
    labor_intensity_score: 7.9, // THROTTLED WHEN OVERWHELMED (> 7)
    allergens: ['Dairy', 'Gluten'],
    category: 'Mains',
    description: 'Double smash patties with melted aged white cheddar, house-cured pickles, on toasted brioche.',
  },
  {
    id: 'm10',
    item_name: 'Mango Mint Lassi',
    base_price: 120.0,
    current_dynamic_price: 95.0,
    labor_intensity_score: 1.8,
    allergens: ['Dairy'],
    category: 'Beverages',
    description: 'Cultured whole-milk yogurt whipped with Alphonso mango nectar, fresh spearmint, and cardamom dust.',
  },
]

const ALLERGY_OPTIONS = [
  { id: 'Dairy', label: 'Dairy', icon: '🥛', color: 'border-blue-500/40 text-blue-300 bg-blue-950/30' },
  { id: 'Peanuts', label: 'Peanuts', icon: '🥜', color: 'border-amber-500/40 text-amber-300 bg-amber-950/30' },
  { id: 'Gluten', label: 'Gluten', icon: '🌾', color: 'border-yellow-500/40 text-yellow-300 bg-yellow-950/30' },
  { id: 'Shellfish', label: 'Shellfish', icon: '🦐', color: 'border-rose-500/40 text-rose-300 bg-rose-950/30' },
  { id: 'Soy', label: 'Soy', icon: '🌱', color: 'border-emerald-500/40 text-emerald-300 bg-emerald-950/30' },
  { id: 'Eggs', label: 'Eggs', icon: '🥚', color: 'border-orange-500/40 text-orange-300 bg-orange-950/30' },
]

interface CartItem {
  dish: MenuItemRow
  quantity: number
  customization?: string
}

// Relational recipe ingredients fallback mapping (ENZYME layer)
const FALLBACK_RECIPE_INGREDIENTS: RecipeIngredientRow[] = [
  // Paneer Tikka (m1) -> Paneer + Dairy Cream
  { id: 'r1', menu_item_id: 'm1', inventory_id: 'i-paneer', quantity_required: 0.25, allergen_flag: 'Dairy', inventory: { id: 'i-paneer', item_name: 'Fresh Paneer', current_stock_kg: 14.0, initial_stock_kg: 20.0 } },
  { id: 'r2', menu_item_id: 'm1', inventory_id: 'i-dairy', quantity_required: 0.08, allergen_flag: 'Dairy', inventory: { id: 'i-dairy', item_name: 'Dairy Cream & Milk', current_stock_kg: 16.0, initial_stock_kg: 20.0 } },
  // Chicken Biryani (m2) -> Chicken + Rice
  { id: 'r3', menu_item_id: 'm2', inventory_id: 'i-chicken', quantity_required: 0.35, allergen_flag: null, inventory: { id: 'i-chicken', item_name: 'Farm Fresh Chicken', current_stock_kg: 3.8, initial_stock_kg: 25.0 } },
  { id: 'r4', menu_item_id: 'm2', inventory_id: 'i-rice', quantity_required: 0.20, allergen_flag: null, inventory: { id: 'i-rice', item_name: 'Aged Basmati Rice', current_stock_kg: 22.0, initial_stock_kg: 30.0 } },
  // Artisan Truffle Pizza (m3) -> Flour + Dairy
  { id: 'r5', menu_item_id: 'm3', inventory_id: 'i-flour', quantity_required: 0.25, allergen_flag: 'Gluten', inventory: { id: 'i-flour', item_name: 'Sourdough Flour', current_stock_kg: 18.0, initial_stock_kg: 25.0 } },
  { id: 'r6', menu_item_id: 'm3', inventory_id: 'i-dairy', quantity_required: 0.15, allergen_flag: 'Dairy', inventory: { id: 'i-dairy', item_name: 'Dairy Cream & Milk', current_stock_kg: 16.0, initial_stock_kg: 20.0 } },
  // Thai Peanut Satay Noodle (m4) -> Peanuts + Flour
  { id: 'r7', menu_item_id: 'm4', inventory_id: 'i-peanuts', quantity_required: 0.08, allergen_flag: 'Peanuts', inventory: { id: 'i-peanuts', item_name: 'Roasted Peanuts', current_stock_kg: 12.0, initial_stock_kg: 15.0 } },
  { id: 'r8', menu_item_id: 'm4', inventory_id: 'i-flour', quantity_required: 0.20, allergen_flag: 'Gluten', inventory: { id: 'i-flour', item_name: 'Sourdough Flour', current_stock_kg: 18.0, initial_stock_kg: 25.0 } },
  // Dal Makhani (m5) -> Lentils + Dairy
  { id: 'r9', menu_item_id: 'm5', inventory_id: 'i-lentils', quantity_required: 0.20, allergen_flag: null, inventory: { id: 'i-lentils', item_name: 'Black Lentils (Urad)', current_stock_kg: 3.2, initial_stock_kg: 18.0 } },
  { id: 'r10', menu_item_id: 'm5', inventory_id: 'i-dairy', quantity_required: 0.12, allergen_flag: 'Dairy', inventory: { id: 'i-dairy', item_name: 'Dairy Cream & Milk', current_stock_kg: 16.0, initial_stock_kg: 20.0 } },
  // Peanut Butter Lava Brownie (m6) -> Chocolate + Peanuts + Flour + Dairy
  { id: 'r11', menu_item_id: 'm6', inventory_id: 'i-choc', quantity_required: 0.10, allergen_flag: null, inventory: { id: 'i-choc', item_name: 'Belgian Chocolate', current_stock_kg: 2.5, initial_stock_kg: 10.0 } },
  { id: 'r12', menu_item_id: 'm6', inventory_id: 'i-peanuts', quantity_required: 0.06, allergen_flag: 'Peanuts', inventory: { id: 'i-peanuts', item_name: 'Roasted Peanuts', current_stock_kg: 12.0, initial_stock_kg: 15.0 } },
  { id: 'r13', menu_item_id: 'm6', inventory_id: 'i-flour', quantity_required: 0.08, allergen_flag: 'Gluten', inventory: { id: 'i-flour', item_name: 'Sourdough Flour', current_stock_kg: 18.0, initial_stock_kg: 25.0 } },
  { id: 'r14', menu_item_id: 'm6', inventory_id: 'i-dairy', quantity_required: 0.05, allergen_flag: 'Dairy', inventory: { id: 'i-dairy', item_name: 'Dairy Cream & Milk', current_stock_kg: 16.0, initial_stock_kg: 20.0 } },
  // Gulab Jamun (m7) -> Dairy + Flour
  { id: 'r15', menu_item_id: 'm7', inventory_id: 'i-dairy', quantity_required: 0.15, allergen_flag: 'Dairy', inventory: { id: 'i-dairy', item_name: 'Dairy Cream & Milk', current_stock_kg: 16.0, initial_stock_kg: 20.0 } },
  { id: 'r16', menu_item_id: 'm7', inventory_id: 'i-flour', quantity_required: 0.05, allergen_flag: 'Gluten', inventory: { id: 'i-flour', item_name: 'Sourdough Flour', current_stock_kg: 18.0, initial_stock_kg: 25.0 } },
  // Fresh Citrus Kale Salad (m8) -> Kale
  { id: 'r17', menu_item_id: 'm8', inventory_id: 'i-kale', quantity_required: 0.22, allergen_flag: null, inventory: { id: 'i-kale', item_name: 'Organic Kale & Citrus', current_stock_kg: 9.0, initial_stock_kg: 10.0 } },
  // Signature Smash Burger (m9) -> Flour + Dairy
  { id: 'r18', menu_item_id: 'm9', inventory_id: 'i-flour', quantity_required: 0.15, allergen_flag: 'Gluten', inventory: { id: 'i-flour', item_name: 'Sourdough Flour', current_stock_kg: 18.0, initial_stock_kg: 25.0 } },
  { id: 'r19', menu_item_id: 'm9', inventory_id: 'i-dairy', quantity_required: 0.08, allergen_flag: 'Dairy', inventory: { id: 'i-dairy', item_name: 'Dairy Cream & Milk', current_stock_kg: 16.0, initial_stock_kg: 20.0 } },
  // Mango Mint Lassi (m10) -> Mango + Dairy
  { id: 'r20', menu_item_id: 'm10', inventory_id: 'i-mango', quantity_required: 0.18, allergen_flag: null, inventory: { id: 'i-mango', item_name: 'Alphonso Mango Pulp', current_stock_kg: 7.5, initial_stock_kg: 12.0 } },
  { id: 'r21', menu_item_id: 'm10', inventory_id: 'i-dairy', quantity_required: 0.22, allergen_flag: 'Dairy', inventory: { id: 'i-dairy', item_name: 'Dairy Cream & Milk', current_stock_kg: 16.0, initial_stock_kg: 20.0 } },
]

export default function CustomerMenuPage() {
  const [menuItems, setMenuItems] = useState<MenuItemRow[]>(FALLBACK_MENU_ITEMS)
  const [recipeIngredients, setRecipeIngredients] = useState<RecipeIngredientRow[]>(FALLBACK_RECIPE_INGREDIENTS)
  const [kitchenStatus, setKitchenStatus] = useState<KitchenStatusRow>({
    id: 'current',
    current_labor_capacity: 'Normal',
  })
  const [selectedAllergens, setSelectedAllergens] = useState<string[]>([])
  const [activeCategory, setActiveCategory] = useState<string>('All')
  const [selectedDishDetail, setSelectedDishDetail] = useState<MenuItemRow | null>(null)
  const [cart, setCart] = useState<CartItem[]>([])
  const [tableNumber, setTableNumber] = useState<string>('Table 4')
  const [orderSubmitting, setOrderSubmitting] = useState(false)
  const [orderConfirmed, setOrderConfirmed] = useState<string | null>(null)
  const [showOverrideThrottled, setShowOverrideThrottled] = useState(false)
  const [customizationNote, setCustomizationNote] = useState<string>('')

  // ── 1. Hydrate Menu Items, Recipe Ingredients & Kitchen Status ──
  useEffect(() => {
    let isMounted = true

    const loadData = async () => {
      try {
        // Fetch Menu Items
        const { data: menuData } = await supabase
          .from('menu_items')
          .select('*')
          .order('base_price', { ascending: false })

        if (menuData && menuData.length > 0 && isMounted) {
          setMenuItems(menuData as MenuItemRow[])
        }

        // Fetch Recipe Ingredients (ENZYME mapping layer)
        try {
          const { data: recipeData } = await supabase
            .from('recipe_ingredients')
            .select('*, inventory:inventory_id(*)')

          if (recipeData && recipeData.length > 0 && isMounted) {
            setRecipeIngredients(recipeData as RecipeIngredientRow[])
          }
        } catch (rErr) {
          console.warn('[CustomerMenu] Using fallback ENZYME recipe mappings:', rErr)
        }

        // Fetch Kitchen Status (BACTERIA agent)
        const { data: statusData } = await supabase
          .from('kitchen_status')
          .select('*')
          .eq('id', 'current')
          .single()

        if (statusData && isMounted) {
          setKitchenStatus(statusData as KitchenStatusRow)
        }
      } catch (err) {
        console.error('[CustomerMenu] Error loading initial Supabase state:', err)
      }
    }

    loadData()

    // ── 2. Realtime Subscriptions ──
    const realtimeChannel = supabase
      .channel('customer-menu-realtime')
      // Event: Kitchen Status (BACTERIA agent throttling)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'kitchen_status' },
        (payload) => {
          if (payload.new) {
            setKitchenStatus(payload.new as KitchenStatusRow)
          }
        }
      )
      // Event: Menu Items (SLIME dynamic pricing updates)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'menu_items' },
        (payload) => {
          if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
            const updated = payload.new as MenuItemRow
            setMenuItems((prev) => {
              const idx = prev.findIndex((m) => m.id === updated.id || m.item_name === updated.item_name)
              if (idx >= 0) {
                const next = [...prev]
                next[idx] = updated
                return next
              }
              return [...prev, updated]
            })
          }
        }
      )
      .subscribe()

    return () => {
      isMounted = false
      supabase.removeChannel(realtimeChannel)
    }
  }, [])

  // ── 3. Allergen Filtering (T-CELL Agent) ──
  const toggleAllergen = (allergyId: string) => {
    setSelectedAllergens((prev) =>
      prev.includes(allergyId) ? prev.filter((a) => a !== allergyId) : [...prev, allergyId]
    )
  }

  const isKitchenOverwhelmed = kitchenStatus.current_labor_capacity === 'Overwhelmed'

  // Helper to cross-reference dish allergens via menu_items.allergens AND recipe_ingredients junction table
  const dishContainsSelectedAllergens = (dish: MenuItemRow, allergens: string[]): boolean => {
    if (allergens.length === 0) return false

    // 1. Direct array on menu_items
    const directAllergens = dish.allergens || []
    const hasDirectMatch = directAllergens.some((a) =>
      allergens.some((sel) => sel.toLowerCase() === a.toLowerCase())
    )
    if (hasDirectMatch) return true

    // 2. Relational cross-reference via recipe_ingredients junction table (T-CELL Agent)
    const fallbackId = FALLBACK_MENU_ITEMS.find((f) => f.item_name === dish.item_name)?.id
    const relatedLinks = recipeIngredients.filter((r) =>
      r.menu_item_id === dish.id ||
      (fallbackId && r.menu_item_id === fallbackId) ||
      (r.menu_item && r.menu_item.item_name === dish.item_name)
    )

    for (const link of relatedLinks) {
      if (link.allergen_flag) {
        const flagMatches = allergens.some(
          (sel) => sel.toLowerCase() === link.allergen_flag?.toLowerCase()
        )
        if (flagMatches) return true
      }
      const inv = link.inventory as { allergens?: string[]; item_name?: string } | null
      if (inv?.allergens && Array.isArray(inv.allergens)) {
        const invMatches = inv.allergens.some((a) =>
          allergens.some((sel) => sel.toLowerCase() === a.toLowerCase())
        )
        if (invMatches) return true
      }
      // Name-based inference for raw ingredient allergen safety
      if (inv?.item_name) {
        const nameLower = inv.item_name.toLowerCase()
        if (allergens.some((sel) => sel.toLowerCase() === 'dairy' && (nameLower.includes('milk') || nameLower.includes('cream') || nameLower.includes('paneer') || nameLower.includes('butter')))) return true
        if (allergens.some((sel) => sel.toLowerCase() === 'peanuts' && nameLower.includes('peanut'))) return true
        if (allergens.some((sel) => sel.toLowerCase() === 'gluten' && (nameLower.includes('flour') || nameLower.includes('wheat') || nameLower.includes('bread')))) return true
      }
    }

    return false
  }

  // ── 4. Compute Filtered Dishes ──
  const { visibleDishes, throttledDishes, allergyExcludedDishes } = useMemo(() => {
    const visible: MenuItemRow[] = []
    const throttled: MenuItemRow[] = []
    const allergyExcluded: MenuItemRow[] = []

    menuItems.forEach((dish) => {
      // Category filter check
      if (activeCategory !== 'All' && dish.category !== activeCategory) {
        return
      }

      // T-CELL Allergen Check
      const hasAllergyConflict = dishContainsSelectedAllergens(dish, selectedAllergens)
      if (hasAllergyConflict) {
        allergyExcluded.push(dish)
        return
      }

      // BACTERIA Labor Throttling Check
      const laborScore = Number(dish.labor_intensity_score ?? 5)
      const isThrottledByBacteria = isKitchenOverwhelmed && laborScore > 7.0

      if (isThrottledByBacteria) {
        throttled.push(dish)
        if (showOverrideThrottled) {
          visible.push(dish)
        }
      } else {
        visible.push(dish)
      }
    })

    return { visibleDishes: visible, throttledDishes: throttled, allergyExcludedDishes: allergyExcluded }
  }, [menuItems, selectedAllergens, activeCategory, isKitchenOverwhelmed, showOverrideThrottled, recipeIngredients])

  // Categories list
  const categories = useMemo(() => {
    const set = new Set<string>()
    menuItems.forEach((m) => {
      if (m.category) set.add(m.category)
    })
    return ['All', ...Array.from(set)]
  }, [menuItems])

  // Cart operations
  const addToCart = (dish: MenuItemRow, note?: string) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.dish.id === dish.id)
      if (existing) {
        return prev.map((item) =>
          item.dish.id === dish.id
            ? { ...item, quantity: item.quantity + 1, customization: note || item.customization }
            : item
        )
      }
      return [...prev, { dish, quantity: 1, customization: note }]
    })
  }

  const removeFromCart = (dishId: string) => {
    setCart((prev) => prev.filter((item) => item.dish.id !== dishId))
  }

  const cartTotal = useMemo(() => {
    return cart.reduce((acc, item) => {
      const price = item.dish.current_dynamic_price ?? item.dish.base_price ?? 0
      return acc + price * item.quantity
    }, 0)
  }, [cart])

  // ── 5. Submit Order Directly to Supabase Orders Table ──
  const handlePlaceOrder = async () => {
    if (cart.length === 0) return
    setOrderSubmitting(true)

    try {
      const orderNum = Math.floor(100 + Math.random() * 900)
      const orderId = `CUST-${orderNum}`

      // Create modifications list based on active allergy filters
      const allergyModifications: string[] = []
      if (selectedAllergens.length > 0) {
        allergyModifications.push(`ALLERGY SHIELD: STRICT NO ${selectedAllergens.join(', ').toUpperCase()}`)
      }

      const orderPayloadItems = cart.map((c) => ({
        name: c.dish.item_name,
        quantity: c.quantity,
        modifications: [
          ...(c.customization ? [c.customization] : []),
          ...(allergyModifications.length > 0 ? allergyModifications : []),
        ],
        allergy_alert:
          selectedAllergens.length > 0
            ? `CUSTOMER ALLERGY: ${selectedAllergens.join(', ')}`
            : undefined,
      }))

      const allergyNote = selectedAllergens.length > 0 ? `CUSTOMER ALLERGY: ${selectedAllergens.join(', ')}` : null

      const { data, error } = await supabase.from('orders').insert({
        order_id: orderId,
        source_platform: `Customer Web (${tableNumber})`,
        items: orderPayloadItems,
        status: 'pending',
        received_at: new Date().toISOString(),
        allergy_notes: allergyNote,
      }).select().single()

      if (error) {
        console.warn('[CustomerMenu] Direct insert notice, retrying with baseline fields:', error.message)
        const { error: retryErr } = await supabase.from('orders').insert({
          order_id: orderId,
          source_platform: `Customer Web (${tableNumber})`,
          items: orderPayloadItems,
          status: 'pending',
          received_at: new Date().toISOString(),
        })
        if (retryErr) {
          // Try fallback API route
          await fetch('/api/orders/place', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              table_number: tableNumber,
              items: orderPayloadItems,
            }),
          }).catch(() => {})
        }
      }

      setOrderConfirmed(orderId)
      setCart([])
    } catch (err) {
      console.error('[CustomerMenu] Order submission error:', err)
    } finally {
      setOrderSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white font-sans flex flex-col antialiased selection:bg-emerald-500 selection:text-black">
      {/* Universal RBAC Navigation */}
      <CrossNav />

      {/* Mobile-First Header Container */}
      <div className="w-full max-w-md mx-auto px-4 pt-4 pb-24 sm:max-w-2xl md:max-w-4xl">
        {/* BioFlow Engine Restaurant Identity */}
        <div className="flex items-center justify-between border-b border-gray-800/80 pb-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-emerald-500/20 to-cyan-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-bold text-lg shadow-lg shadow-emerald-950/50">
              🌿
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-black text-white tracking-tight">
                  BioFlow Bistro
                </h1>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-950 border border-emerald-800/60 text-emerald-400 font-semibold">
                  LIVE
                </span>
              </div>
              <p className="text-xs text-gray-400">
                Cellular Synthesis Dining & Dynamic Pricing
              </p>
            </div>
          </div>

          {/* Table Selector Pill */}
          <div className="flex items-center gap-1.5 bg-gray-900 border border-gray-800 px-3 py-1 rounded-full text-xs font-mono text-gray-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
            <select
              value={tableNumber}
              onChange={(e) => setTableNumber(e.target.value)}
              className="bg-transparent border-none text-white focus:outline-none cursor-pointer text-xs font-bold"
            >
              <option value="Table 1" className="bg-gray-900">Table 1</option>
              <option value="Table 2" className="bg-gray-900">Table 2</option>
              <option value="Table 4" className="bg-gray-900">Table 4 (Patio)</option>
              <option value="Takeaway" className="bg-gray-900">Takeaway</option>
            </select>
          </div>
        </div>

        {/* ── BACTERIA AGENT LABOR THROTTLE ALERT BANNER ── */}
        {isKitchenOverwhelmed && (
          <div
            data-testid="bacteria-throttle-banner"
            className="mb-4 rounded-xl bg-gradient-to-r from-rose-950/90 via-red-950/80 to-amber-950/80 border-2 border-rose-500/90 p-3.5 shadow-xl shadow-rose-950/50 animate-in fade-in slide-in-from-top-2"
          >
            <div className="flex items-start gap-3">
              <div className="h-9 w-9 rounded-lg bg-rose-900/60 border border-rose-500/80 flex items-center justify-center text-rose-300 shrink-0">
                <Flame className="h-5 w-5 animate-pulse text-rose-400" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black uppercase tracking-wider text-rose-300 flex items-center gap-1.5">
                    <span>⚡ BACTERIA AGENT THROTTLING ACTIVE</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.2 bg-rose-950 border border-rose-700 rounded text-rose-200">
                      OVERWHELMED
                    </span>
                  </h3>
                  <button
                    type="button"
                    onClick={() => setShowOverrideThrottled((prev) => !prev)}
                    className="text-[10px] text-rose-300 hover:text-white underline font-mono cursor-pointer"
                  >
                    {showOverrideThrottled ? 'Hide Throttled' : 'Inspect Paused'}
                  </button>
                </div>
                <p className="text-xs text-rose-200/90 mt-1 leading-relaxed">
                  Kitchen prep load exceeds critical threshold. To guarantee fast service,{' '}
                  <span className="font-bold text-white underline">
                    {throttledDishes.length} high-complexity dishes
                  </span>{' '}
                  (labor intensity score &gt; 7.0) are autonomously hidden from the active menu.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── T-CELL AGENT ALLERGY FILTER SECTION ── */}
        <section className="mb-4 rounded-xl bg-gray-900/90 border border-gray-800 p-3.5 shadow-md">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-white">
                T-CELL Immune Shield — Allergy Filter
              </h2>
            </div>
            {selectedAllergens.length > 0 && (
              <button
                type="button"
                onClick={() => setSelectedAllergens([])}
                className="text-[11px] font-mono text-gray-400 hover:text-emerald-400 flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="h-3 w-3" />
                Reset
              </button>
            )}
          </div>

          <p className="text-xs text-gray-400 mb-3">
            Select your allergies. The <span className="text-emerald-400 font-semibold">T-CELL agent</span>{' '}
            will autonomously cross-reference recipes in the relational database to hide hazardous dishes.
          </p>

          {/* Allergy Pills Multi-Select */}
          <div className="flex flex-wrap gap-2">
            {ALLERGY_OPTIONS.map((allergy) => {
              const isSelected = selectedAllergens.includes(allergy.id)
              return (
                <button
                  key={allergy.id}
                  type="button"
                  onClick={() => toggleAllergen(allergy.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer border ${
                    isSelected
                      ? 'bg-red-500/20 border-red-500 text-red-300 shadow-md shadow-red-950/60 ring-1 ring-red-500'
                      : 'bg-gray-950 border-gray-800 text-gray-300 hover:border-gray-700 hover:text-white'
                  }`}
                >
                  <span>{allergy.icon}</span>
                  <span>{allergy.label}</span>
                  {isSelected ? (
                    <X className="h-3 w-3 ml-0.5 text-red-400" />
                  ) : (
                    <Plus className="h-3 w-3 ml-0.5 text-gray-500" />
                  )}
                </button>
              )
            })}
          </div>

          {/* Allergen Shield Feedback */}
          {selectedAllergens.length > 0 && (
            <div className="mt-3 p-2 rounded-lg bg-emerald-950/50 border border-emerald-800/60 text-xs text-emerald-300 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-emerald-400 shrink-0" />
                <span>
                  Filtering active: <strong>{selectedAllergens.join(', ')}</strong> blocked.
                </span>
              </div>
              <span className="font-mono text-[11px] font-bold text-emerald-400 px-2 py-0.5 rounded bg-emerald-900/60">
                {allergyExcludedDishes.length} Safe-Filtered
              </span>
            </div>
          )}
        </section>

        {/* ── INTERFACE-RELEVANT GRAPH: Customer Kitchen Load & Wait-Time Forecast ── */}
        <section className="mb-5 rounded-xl bg-gray-900/80 border border-gray-800 p-3.5 shadow-md">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-cyan-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                Live Kitchen Load Forecast & Turnaround Latency
              </h3>
            </div>
            <span className="text-[11px] font-mono text-cyan-400 font-bold">
              {isKitchenOverwhelmed ? 'Surge: ~28m wait' : 'Normal: ~12m wait'}
            </span>
          </div>

          {/* SVG Load Curve Chart */}
          <div className="h-24 w-full relative bg-gray-950/80 rounded-lg p-2 border border-gray-800/80 overflow-hidden">
            <svg className="w-full h-full overflow-visible" viewBox="0 0 400 70" preserveAspectRatio="none">
              <defs>
                <linearGradient id="customerLoadGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={isKitchenOverwhelmed ? '#f43f5e' : '#06b6d4'} stopOpacity="0.4" />
                  <stop offset="100%" stopColor={isKitchenOverwhelmed ? '#f43f5e' : '#06b6d4'} stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Threshold line for labor intensity > 7.0 */}
              <line
                x1="0"
                y1="25"
                x2="400"
                y2="25"
                stroke="#e11d48"
                strokeDasharray="4 3"
                strokeWidth="1.2"
                opacity="0.8"
              />
              <text x="310" y="22" fill="#fda4af" fontSize="8" fontFamily="monospace">
                BACTERIA THROTTLE CUTOFF
              </text>

              {/* Area path */}
              <path
                d={
                  isKitchenOverwhelmed
                    ? 'M 0 55 Q 80 50 140 30 T 260 12 T 340 18 L 400 24 L 400 70 L 0 70 Z'
                    : 'M 0 58 Q 80 52 140 45 T 260 38 T 340 44 L 400 50 L 400 70 L 0 70 Z'
                }
                fill="url(#customerLoadGrad)"
              />

              {/* Stroke line */}
              <path
                d={
                  isKitchenOverwhelmed
                    ? 'M 0 55 Q 80 50 140 30 T 260 12 T 340 18 L 400 24'
                    : 'M 0 58 Q 80 52 140 45 T 260 38 T 340 44 L 400 50'
                }
                fill="none"
                stroke={isKitchenOverwhelmed ? '#f43f5e' : '#06b6d4'}
                strokeWidth="2.5"
              />

              {/* Current time marker */}
              <circle
                cx="260"
                cy={isKitchenOverwhelmed ? 12 : 38}
                r="4.5"
                fill={isKitchenOverwhelmed ? '#f43f5e' : '#06b6d4'}
                stroke="#ffffff"
                strokeWidth="1.5"
              />
            </svg>

            {/* Time stamps */}
            <div className="flex justify-between text-[9px] font-mono text-gray-400 mt-1 px-1">
              <span>Now (12:00)</span>
              <span>12:20</span>
              <span className="text-cyan-300 font-bold">12:40 (Peak)</span>
              <span>13:00</span>
            </div>
          </div>
        </section>

        {/* ── Category Filter Tabs ── */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-4 scrollbar-none">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveCategory(cat)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer ${
                activeCategory === cat
                  ? 'bg-emerald-500 text-gray-950 shadow-md shadow-emerald-500/20 font-black'
                  : 'bg-gray-900 border border-gray-800 text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* ── Dish Catalog Grid ── */}
        <div className="space-y-3">
          {visibleDishes.length === 0 ? (
            <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-8 text-center">
              <ShieldAlert className="h-10 w-10 text-amber-400 mx-auto mb-2" />
              <h3 className="text-sm font-bold text-white">No dishes available with current filters</h3>
              <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">
                {selectedAllergens.length > 0
                  ? `Your selected allergies (${selectedAllergens.join(', ')}) filtered out all items in this category.`
                  : 'All items are currently paused.'}
              </p>
              {selectedAllergens.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedAllergens([])}
                  className="mt-3 px-3 py-1.5 rounded-lg bg-gray-800 text-xs font-bold text-emerald-400 hover:bg-gray-700 cursor-pointer"
                >
                  Clear Allergy Filters
                </button>
              )}
            </div>
          ) : (
            visibleDishes.map((dish) => {
              const isThrottled = Number(dish.labor_intensity_score ?? 0) > 7.0 && isKitchenOverwhelmed
              const discount =
                dish.base_price && dish.current_dynamic_price
                  ? Math.round(((dish.base_price - dish.current_dynamic_price) / dish.base_price) * 100)
                  : 0

              return (
                <div
                  key={dish.id}
                  className={`group relative rounded-xl border p-4 transition-all ${
                    isThrottled
                      ? 'bg-rose-950/20 border-rose-900/60 opacity-60'
                      : 'bg-gray-900/90 border-gray-800 hover:border-gray-700 hover:shadow-lg hover:shadow-emerald-950/20'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row items-start justify-between gap-3">
                    {/* Left: Dish Info */}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h3 className="text-sm font-bold text-white group-hover:text-emerald-300 transition-colors">
                          {dish.item_name}
                        </h3>

                        {/* Category Pill */}
                        <span className="text-[10px] font-mono text-gray-400 px-2 py-0.5 rounded bg-gray-800 border border-gray-700">
                          {dish.category || 'Mains'}
                        </span>

                        {/* Labor Intensity Score Pill (BACTERIA agent metric) */}
                        <span
                          className={`text-[10px] font-mono px-2 py-0.5 rounded border font-semibold ${
                            Number(dish.labor_intensity_score ?? 5) > 7
                              ? 'bg-rose-950/80 border-rose-800/80 text-rose-300'
                              : 'bg-emerald-950/80 border-emerald-800/80 text-emerald-300'
                          }`}
                          title="Labor Intensity Score (BACTERIA Agent)"
                        >
                          Prep Complexity: {dish.labor_intensity_score ?? 5}/10
                        </span>

                        {/* Throttled badge if overridden */}
                        {isThrottled && (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-red-950 border border-red-700 text-red-200 font-bold">
                            THROTTLED (PAUSED)
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-gray-400 leading-relaxed mb-2.5">
                        {dish.description}
                      </p>

                      {/* Allergens Array */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {dish.allergens && dish.allergens.length > 0 ? (
                          dish.allergens.map((alg) => (
                            <span
                              key={alg}
                              className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-gray-950 border border-gray-800 text-amber-300 flex items-center gap-1"
                            >
                              <span>⚠️</span>
                              <span>{alg}</span>
                            </span>
                          ))
                        ) : (
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-950/50 border border-emerald-800/50 text-emerald-400 flex items-center gap-1">
                            <Check className="h-3 w-3 text-emerald-400" />
                            Allergen Clean
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Right: Pricing & Order Action */}
                    <div className="flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto gap-2 shrink-0 border-t sm:border-t-0 border-gray-800 pt-2 sm:pt-0">
                      <div className="text-left sm:text-right">
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-base font-black text-white">
                            ₹{dish.current_dynamic_price ?? dish.base_price}
                          </span>
                          {discount > 0 && (
                            <span className="text-xs line-through text-gray-500 font-mono">
                              ₹{dish.base_price}
                            </span>
                          )}
                        </div>

                        {discount > 0 && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-mono font-bold text-emerald-400">
                            <TrendingDown className="h-3 w-3" />
                            SLIME -{discount}%
                          </span>
                        )}
                      </div>

                      {/* Action Button & Recipe Inspection */}
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedDishDetail(dish)}
                          className="px-2.5 py-1.5 rounded-lg border border-gray-700 bg-gray-800/80 hover:bg-gray-700 text-[11px] font-mono text-cyan-400 hover:text-cyan-300 transition-all cursor-pointer flex items-center gap-1"
                          title="Inspect ENZYME Recipe Ingredients"
                        >
                          <Layers className="h-3 w-3" />
                          <span className="hidden sm:inline">Recipe</span>
                        </button>

                        <button
                          type="button"
                          disabled={isThrottled}
                          onClick={() => addToCart(dish)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            isThrottled
                              ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                              : 'bg-emerald-500 text-gray-950 hover:bg-emerald-400 shadow-md shadow-emerald-500/20 active:scale-95'
                          }`}
                        >
                          <Plus className="h-3.5 w-3.5" />
                          <span>Add</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* ── ENZYME Recipe Ingredient Inspection Modal ── */}
        {selectedDishDetail && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/80 backdrop-blur-sm p-4">
            <div className="w-full max-w-md rounded-2xl bg-gray-900 border border-cyan-500/50 p-6 shadow-2xl animate-in zoom-in-95">
              <div className="flex items-start justify-between border-b border-gray-800 pb-3 mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-black text-white">{selectedDishDetail.item_name}</h3>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950 border border-cyan-800 text-cyan-400 font-bold">
                      ENZYME MAPPING
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">{selectedDishDetail.description}</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedDishDetail(null)
                    setCustomizationNote('')
                  }}
                  className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Recipe Ingredients Junction Breakdown */}
              <div className="mb-4">
                <h4 className="text-xs font-bold text-gray-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Layers className="h-3.5 w-3.5 text-cyan-400" />
                  <span>Junction Ingredients (recipe_ingredients)</span>
                </h4>
                <div className="space-y-1.5 bg-gray-950 rounded-xl p-3 border border-gray-800">
                  {recipeIngredients.filter((r) => {
                    const fallbackId = FALLBACK_MENU_ITEMS.find((f) => f.item_name === selectedDishDetail.item_name)?.id
                    return r.menu_item_id === selectedDishDetail.id ||
                      (fallbackId && r.menu_item_id === fallbackId) ||
                      (r.menu_item && r.menu_item.item_name === selectedDishDetail.item_name)
                  }).length === 0 ? (
                    <div className="text-xs text-gray-500 font-mono">
                      Baseline inventory mapping: Whole fresh ingredients batch.
                    </div>
                  ) : (
                    recipeIngredients
                      .filter((r) => {
                        const fallbackId = FALLBACK_MENU_ITEMS.find((f) => f.item_name === selectedDishDetail.item_name)?.id
                        return r.menu_item_id === selectedDishDetail.id ||
                          (fallbackId && r.menu_item_id === fallbackId) ||
                          (r.menu_item && r.menu_item.item_name === selectedDishDetail.item_name)
                      })
                      .map((link) => {
                        const inv = link.inventory as { item_name?: string } | null
                        return (
                          <div
                            key={link.id}
                            className="flex items-center justify-between text-xs py-1 border-b border-gray-800/60 last:border-none"
                          >
                            <span className="text-white font-medium">
                              {inv?.item_name || 'Inventory Item'}
                            </span>
                            <div className="flex items-center gap-2">
                              {link.allergen_flag && (
                                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-950 border border-amber-800 text-amber-300">
                                  {link.allergen_flag}
                                </span>
                              )}
                              <span className="font-mono text-cyan-400 font-bold">
                                {Number(link.quantity_required).toFixed(2)} kg
                              </span>
                            </div>
                          </div>
                        )
                      })
                  )}
                </div>
              </div>

              {/* Customization input */}
              <div className="mb-4">
                <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-1.5">
                  Kitchen Modification / Allergy Note
                </label>
                <input
                  type="text"
                  placeholder="e.g. NO DAIRY, EXTRA CRISPY..."
                  value={customizationNote}
                  onChange={(e) => setCustomizationNote(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-gray-950 border border-gray-800 text-xs text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              {/* Modal Actions */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    addToCart(selectedDishDetail, customizationNote)
                    setSelectedDishDetail(null)
                    setCustomizationNote('')
                  }}
                  className="flex-1 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-gray-950 font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Plus className="h-4 w-4" />
                  <span>Add to Tray (₹{selectedDishDetail.current_dynamic_price ?? selectedDishDetail.base_price})</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Active Order Drawer / Bottom Tray ── */}
        {cart.length > 0 && (
          <div className="fixed bottom-0 left-0 right-0 z-30 p-4 bg-gray-950/95 border-t border-gray-800 backdrop-blur-xl shadow-2xl">
            <div className="max-w-md mx-auto sm:max-w-xl flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="relative h-10 w-10 rounded-xl bg-emerald-500 text-gray-950 flex items-center justify-center font-bold shadow-lg shadow-emerald-500/30">
                  <ShoppingBag className="h-5 w-5" />
                  <span className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-rose-600 text-white text-[10px] flex items-center justify-center font-mono font-bold">
                    {cart.reduce((a, b) => a + b.quantity, 0)}
                  </span>
                </div>
                <div>
                  <div className="text-xs font-bold text-white">
                    Tray Total: ₹{cartTotal}
                  </div>
                  <div className="text-[11px] text-gray-400 font-mono">
                    {selectedAllergens.length > 0
                      ? `⚠️ Shield: ${selectedAllergens.join(', ')} flagged`
                      : 'Zero allergen alerts'}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={orderSubmitting}
                  onClick={handlePlaceOrder}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 text-gray-950 font-black text-xs shadow-lg shadow-emerald-500/20 hover:from-emerald-400 hover:to-teal-300 transition-all cursor-pointer"
                >
                  <Send className="h-3.5 w-3.5" />
                  <span>{orderSubmitting ? 'Transmitting...' : 'Dispatch to Chef'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Order Confirmation Modal ── */}
        {orderConfirmed && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/80 backdrop-blur-sm p-4">
            <div className="w-full max-w-sm rounded-2xl bg-gray-900 border border-emerald-500/50 p-6 shadow-2xl text-center animate-in zoom-in-95">
              <div className="h-14 w-14 rounded-2xl bg-emerald-950/90 border border-emerald-500 text-emerald-400 flex items-center justify-center mx-auto mb-3">
                <Check className="h-7 w-7" />
              </div>
              <h3 className="text-base font-black text-white">Order Transmitted to Kitchen!</h3>
              <p className="text-xs font-mono text-emerald-400 font-bold mt-1">
                Order Ticket: #{orderConfirmed}
              </p>
              <p className="text-xs text-gray-400 mt-2">
                Your order is now live on the Chef KDS display. Realtime updates will track ticket status.
              </p>
              <button
                type="button"
                onClick={() => setOrderConfirmed(null)}
                className="mt-4 w-full py-2 rounded-xl bg-emerald-500 text-gray-950 font-bold text-xs hover:bg-emerald-400 transition-all cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
