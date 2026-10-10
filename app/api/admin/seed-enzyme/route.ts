import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabaseClient'

export async function POST(): Promise<NextResponse> {
  try {
    // 1. Seed or update kitchen_status (BACTERIA agent)
    const { error: kitchenErr } = await supabase.from('kitchen_status').upsert(
      {
        id: 'current',
        current_labor_capacity: 'Normal',
        active_headcount: 6,
        surge_multiplier: 1.0,
        throttling_enabled: true,
        spoilage_risk_level: 'nominal',
        ambient_temp_celsius: 22.4,
        ambient_humidity_pct: 54.2,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    )
    if (kitchenErr) {
      console.warn('[Seed-Enzyme] kitchen_status upsert notice:', kitchenErr.message)
    }

    // 2. Seed Inventory (Logistics & Cold-Chain Stock)
    const inventoryData = [
      { item_name: 'Fresh Paneer', base_cost: 280.0, expiration_timestamp: new Date(Date.now() + 8 * 3600 * 1000).toISOString(), current_stock_kg: 14.0, initial_stock_kg: 20.0, allergens: ['Dairy'] },
      { item_name: 'Farm Fresh Chicken', base_cost: 320.0, expiration_timestamp: new Date(Date.now() + 20 * 3600 * 1000).toISOString(), current_stock_kg: 3.8, initial_stock_kg: 25.0, allergens: [] }, // CRITICAL LOW STOCK
      { item_name: 'Roasted Peanuts', base_cost: 110.0, expiration_timestamp: new Date(Date.now() + 72 * 3600 * 1000).toISOString(), current_stock_kg: 12.0, initial_stock_kg: 15.0, allergens: ['Peanuts'] },
      { item_name: 'Aged Basmati Rice', base_cost: 95.0, expiration_timestamp: new Date(Date.now() + 120 * 3600 * 1000).toISOString(), current_stock_kg: 22.0, initial_stock_kg: 30.0, allergens: [] },
      { item_name: 'Black Lentils (Urad)', base_cost: 130.0, expiration_timestamp: new Date(Date.now() + 96 * 3600 * 1000).toISOString(), current_stock_kg: 3.2, initial_stock_kg: 18.0, allergens: [] }, // CRITICAL LOW STOCK
      { item_name: 'Dairy Cream & Milk', base_cost: 140.0, expiration_timestamp: new Date(Date.now() + 14 * 3600 * 1000).toISOString(), current_stock_kg: 16.0, initial_stock_kg: 20.0, allergens: ['Dairy'] },
      { item_name: 'Sourdough Flour', base_cost: 85.0, expiration_timestamp: new Date(Date.now() + 140 * 3600 * 1000).toISOString(), current_stock_kg: 18.0, initial_stock_kg: 25.0, allergens: ['Gluten'] },
      { item_name: 'Belgian Chocolate', base_cost: 380.0, expiration_timestamp: new Date(Date.now() + 60 * 3600 * 1000).toISOString(), current_stock_kg: 2.5, initial_stock_kg: 10.0, allergens: [] }, // CRITICAL LOW STOCK
      { item_name: 'Alphonso Mango Pulp', base_cost: 160.0, expiration_timestamp: new Date(Date.now() + 18 * 3600 * 1000).toISOString(), current_stock_kg: 7.5, initial_stock_kg: 12.0, allergens: [] },
      { item_name: 'Organic Kale & Citrus', base_cost: 110.0, expiration_timestamp: new Date(Date.now() + 16 * 3600 * 1000).toISOString(), current_stock_kg: 9.0, initial_stock_kg: 10.0, allergens: [] },
    ]

    for (const inv of inventoryData) {
      // First attempt upsert with onConflict item_name
      const { error: invErr } = await supabase.from('inventory').upsert(inv, { onConflict: 'item_name' })
      if (invErr) {
        // If unique constraint isn't on item_name, check if item already exists
        const { data: existing } = await supabase.from('inventory').select('id').eq('item_name', inv.item_name).maybeSingle()
        if (existing) {
          await supabase.from('inventory').update(inv).eq('id', existing.id)
        } else {
          await supabase.from('inventory').insert(inv)
        }
      }
    }

    // 3. Seed Menu Items (with Labor Scores and Allergens)
    const menuItemsData = [
      {
        item_name: 'Paneer Tikka',
        base_price: 299.0,
        current_dynamic_price: 245.0,
        labor_intensity_score: 5.0,
        allergens: ['Dairy'],
        category: 'Starters',
        description: 'Charcoal-charred artisanal cottage cheese steeped in Greek yogurt marinade and stone-ground spices.',
      },
      {
        item_name: 'Chicken Biryani',
        base_price: 349.0,
        current_dynamic_price: 319.0,
        labor_intensity_score: 9.2, // THROTTLED (> 7.0) WHEN OVERWHELMED
        allergens: [],
        category: 'Mains',
        description: 'Slow-dum aged basmati rice infused with Kashmiri saffron, caramelized shallots, and tender chicken.',
      },
      {
        item_name: 'Artisan Truffle Pizza',
        base_price: 420.0,
        current_dynamic_price: 389.0,
        labor_intensity_score: 8.8, // THROTTLED (> 7.0) WHEN OVERWHELMED
        allergens: ['Dairy', 'Gluten'],
        category: 'Mains',
        description: '72-hour cold fermented sourdough crust crowned with black truffle puree, fior di latte, and micro-herbs.',
      },
      {
        item_name: 'Thai Peanut Satay Noodle',
        base_price: 280.0,
        current_dynamic_price: 235.0,
        labor_intensity_score: 8.1, // THROTTLED (> 7.0) WHEN OVERWHELMED
        allergens: ['Peanuts', 'Gluten'],
        category: 'Mains',
        description: 'Wok-charred hand-pulled noodles tossed in roasted peanut chili-lime emulsion with crispy shallot crunch.',
      },
      {
        item_name: 'Dal Makhani',
        base_price: 199.0,
        current_dynamic_price: 182.0,
        labor_intensity_score: 4.2,
        allergens: ['Dairy'],
        category: 'Mains',
        description: 'Slow-cooked whole black lentils simmered for 24 hours with churned dairy butter and vine-ripened tomatoes.',
      },
      {
        item_name: 'Peanut Butter Lava Brownie',
        base_price: 160.0,
        current_dynamic_price: 138.0,
        labor_intensity_score: 3.8,
        allergens: ['Peanuts', 'Dairy', 'Gluten'],
        category: 'Desserts',
        description: 'Warm Belgian dark chocolate fondant with a molten roasted peanut praline center.',
      },
      {
        item_name: 'Gulab Jamun',
        base_price: 99.0,
        current_dynamic_price: 78.0,
        labor_intensity_score: 2.5,
        allergens: ['Dairy', 'Gluten'],
        category: 'Desserts',
        description: 'Traditional evaporated milk dumplings steeped in Damascus rose syrup and bruised green cardamom.',
      },
      {
        item_name: 'Fresh Citrus Kale Salad',
        base_price: 190.0,
        current_dynamic_price: 165.0,
        labor_intensity_score: 2.0,
        allergens: [],
        category: 'Salads',
        description: 'Tuscan lacinato kale tossed with blood orange discs, toasted sunflower kernels, and lemon-shallot dressing.',
      },
      {
        item_name: 'Signature Smash Burger',
        base_price: 380.0,
        current_dynamic_price: 335.0,
        labor_intensity_score: 7.9, // THROTTLED (> 7.0) WHEN OVERWHELMED
        allergens: ['Dairy', 'Gluten'],
        category: 'Mains',
        description: 'Double smash patties with melted aged white cheddar, house-cured pickles, on toasted brioche.',
      },
      {
        item_name: 'Mango Mint Lassi',
        base_price: 120.0,
        current_dynamic_price: 95.0,
        labor_intensity_score: 1.8,
        allergens: ['Dairy'],
        category: 'Beverages',
        description: 'Cultured whole-milk yogurt whipped with Alphonso mango nectar, fresh spearmint, and cardamom dust.',
      },
    ]

    for (const m of menuItemsData) {
      await supabase.from('menu_items').upsert(m, { onConflict: 'item_name' })
    }

    // 4. Fetch IDs to link Recipe Ingredients (ENZYME junction table)
    const { data: dbMenuItems } = await supabase.from('menu_items').select('id, item_name')
    const { data: dbInventory } = await supabase.from('inventory').select('id, item_name')

    if (dbMenuItems && dbInventory) {
      const getMenuId = (name: string) => dbMenuItems.find((m) => m.item_name === name)?.id
      const getInvId = (name: string) => dbInventory.find((i) => i.item_name === name)?.id

      const links: Array<{ menu_item_id: string; inventory_id: string; quantity_required: number; allergen_flag?: string }> = []

      // Paneer Tikka -> Paneer (Dairy) + Dairy Cream (Dairy)
      const mPaneer = getMenuId('Paneer Tikka')
      const iPaneer = getInvId('Fresh Paneer')
      const iDairy = getInvId('Dairy Cream & Milk')
      if (mPaneer && iPaneer) links.push({ menu_item_id: mPaneer, inventory_id: iPaneer, quantity_required: 0.25, allergen_flag: 'Dairy' })
      if (mPaneer && iDairy) links.push({ menu_item_id: mPaneer, inventory_id: iDairy, quantity_required: 0.08, allergen_flag: 'Dairy' })

      // Chicken Biryani -> Chicken + Rice
      const mBiryani = getMenuId('Chicken Biryani')
      const iChicken = getInvId('Farm Fresh Chicken')
      const iRice = getInvId('Aged Basmati Rice')
      if (mBiryani && iChicken) links.push({ menu_item_id: mBiryani, inventory_id: iChicken, quantity_required: 0.35 })
      if (mBiryani && iRice) links.push({ menu_item_id: mBiryani, inventory_id: iRice, quantity_required: 0.20 })

      // Truffle Pizza -> Flour (Gluten) + Dairy (Dairy)
      const mPizza = getMenuId('Artisan Truffle Pizza')
      const iFlour = getInvId('Sourdough Flour')
      if (mPizza && iFlour) links.push({ menu_item_id: mPizza, inventory_id: iFlour, quantity_required: 0.25, allergen_flag: 'Gluten' })
      if (mPizza && iDairy) links.push({ menu_item_id: mPizza, inventory_id: iDairy, quantity_required: 0.15, allergen_flag: 'Dairy' })

      // Thai Peanut Satay Noodle -> Peanuts (Peanuts) + Flour (Gluten)
      const mNoodle = getMenuId('Thai Peanut Satay Noodle')
      const iPeanuts = getInvId('Roasted Peanuts')
      if (mNoodle && iPeanuts) links.push({ menu_item_id: mNoodle, inventory_id: iPeanuts, quantity_required: 0.08, allergen_flag: 'Peanuts' })
      if (mNoodle && iFlour) links.push({ menu_item_id: mNoodle, inventory_id: iFlour, quantity_required: 0.20, allergen_flag: 'Gluten' })

      // Peanut Butter Lava Brownie -> Peanuts + Chocolate + Flour + Dairy
      const mBrownie = getMenuId('Peanut Butter Lava Brownie')
      const iChoc = getInvId('Belgian Chocolate')
      if (mBrownie && iChoc) links.push({ menu_item_id: mBrownie, inventory_id: iChoc, quantity_required: 0.10 })
      if (mBrownie && iPeanuts) links.push({ menu_item_id: mBrownie, inventory_id: iPeanuts, quantity_required: 0.06, allergen_flag: 'Peanuts' })
      if (mBrownie && iFlour) links.push({ menu_item_id: mBrownie, inventory_id: iFlour, quantity_required: 0.08, allergen_flag: 'Gluten' })
      if (mBrownie && iDairy) links.push({ menu_item_id: mBrownie, inventory_id: iDairy, quantity_required: 0.05, allergen_flag: 'Dairy' })

      // Dal Makhani -> Lentils + Dairy
      const mDal = getMenuId('Dal Makhani')
      const iLentils = getInvId('Black Lentils (Urad)')
      if (mDal && iLentils) links.push({ menu_item_id: mDal, inventory_id: iLentils, quantity_required: 0.20 })
      if (mDal && iDairy) links.push({ menu_item_id: mDal, inventory_id: iDairy, quantity_required: 0.12, allergen_flag: 'Dairy' })

      // Gulab Jamun -> Dairy + Flour
      const mJamun = getMenuId('Gulab Jamun')
      if (mJamun && iDairy) links.push({ menu_item_id: mJamun, inventory_id: iDairy, quantity_required: 0.15, allergen_flag: 'Dairy' })
      if (mJamun && iFlour) links.push({ menu_item_id: mJamun, inventory_id: iFlour, quantity_required: 0.05, allergen_flag: 'Gluten' })

      // Fresh Citrus Kale Salad -> Kale
      const mSalad = getMenuId('Fresh Citrus Kale Salad')
      const iKale = getInvId('Organic Kale & Citrus')
      if (mSalad && iKale) links.push({ menu_item_id: mSalad, inventory_id: iKale, quantity_required: 0.22 })

      // Signature Smash Burger -> Flour + Dairy
      const mBurger = getMenuId('Signature Smash Burger')
      if (mBurger && iFlour) links.push({ menu_item_id: mBurger, inventory_id: iFlour, quantity_required: 0.15, allergen_flag: 'Gluten' })
      if (mBurger && iDairy) links.push({ menu_item_id: mBurger, inventory_id: iDairy, quantity_required: 0.08, allergen_flag: 'Dairy' })

      // Mango Lassi -> Mango + Dairy
      const mLassi = getMenuId('Mango Mint Lassi')
      const iMango = getInvId('Alphonso Mango Pulp')
      if (mLassi && iMango) links.push({ menu_item_id: mLassi, inventory_id: iMango, quantity_required: 0.18 })
      if (mLassi && iDairy) links.push({ menu_item_id: mLassi, inventory_id: iDairy, quantity_required: 0.22, allergen_flag: 'Dairy' })

      if (links.length > 0) {
        try {
          await supabase.from('recipe_ingredients').delete().neq('id', '00000000-0000-0000-0000-000000000000')
          await supabase.from('recipe_ingredients').insert(links)
        } catch (linkErr) {
          console.warn('[Seed-Enzyme] recipe_ingredients insert error:', linkErr)
        }
      }
    }

    // 5. Seed Orders (with bright amber allergy modification badges)
    const seedOrders = [
      {
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
        order_id: 'SWIG-882',
        source_platform: 'Swiggy',
        items: [
          { name: 'Chicken Biryani', quantity: 2 },
          { name: 'Gulab Jamun', quantity: 2 },
        ],
        status: 'preparing',
        received_at: new Date(Date.now() - 6 * 60 * 1000).toISOString(),
        allergy_notes: '',
      },
      {
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
    ]

    for (const ord of seedOrders) {
      const { data: existingOrd } = await supabase.from('orders').select('id').eq('order_id', ord.order_id).maybeSingle()
      if (existingOrd) {
        await supabase.from('orders').update(ord).eq('id', existingOrd.id)
      } else {
        await supabase.from('orders').insert(ord)
      }
    }

    // 6. Seed Multi-Agent Tables: kitchen_stations (FIREFLY)
    const stations = [
      { id: 'grill', name: 'Tandoor & Char-Grill Station', station_type: 'Grill', load_percentage: 78.0, active_orders: 4, capacity_orders_per_hr: 50, cycle_time_seconds: 210, phase_radians: 5.9, phase_degrees: 338, frequency_hz: 1.42, status: 'phase_locked', lead_cook: 'Marcus R.', temperature_celsius: 224.0, thermal_load_celsius: 224.0, active_items: ['Paneer Tikka Burger', 'Smoky Patty x3'] },
      { id: 'fryer', name: 'Deep Fryer Bank (Dual-Vat)', station_type: 'Fryer', load_percentage: 62.0, active_orders: 2, capacity_orders_per_hr: 60, cycle_time_seconds: 150, phase_radians: 5.52, phase_degrees: 316, frequency_hz: 1.15, status: 'phase_locked', lead_cook: 'Dev P.', temperature_celsius: 182.0, thermal_load_celsius: 182.0, active_items: ['Crispy Fries x2', 'Falafel Pops'] },
      { id: 'assembly', name: 'Cold Prep & Garde Manger', station_type: 'Cold Assembly', load_percentage: 45.0, active_orders: 5, capacity_orders_per_hr: 75, cycle_time_seconds: 90, phase_radians: 6.22, phase_degrees: 356, frequency_hz: 0.98, status: 'phase_locked', lead_cook: 'Elena S.', temperature_celsius: 3.8, thermal_load_celsius: 3.8, active_items: ['Greek Salad', 'Farm Wrap x2'] },
      { id: 'packaging', name: 'Finishing Pass & Heat Gantry', station_type: 'Pass', load_percentage: 84.0, active_orders: 3, capacity_orders_per_hr: 80, cycle_time_seconds: 70, phase_radians: 5.78, phase_degrees: 331, frequency_hz: 1.30, status: 'phase_locked', lead_cook: 'Chef Ananya', temperature_celsius: 66.0, thermal_load_celsius: 66.0, active_items: ['Order QC #4412', 'Bag Seal & Tag #4413'] },
      { id: 'beverage', name: 'Barista & Cold Dispensary', station_type: 'Beverage', load_percentage: 38.0, active_orders: 2, capacity_orders_per_hr: 90, cycle_time_seconds: 60, phase_radians: 5.65, phase_degrees: 324, frequency_hz: 1.05, status: 'phase_locked', lead_cook: 'Kenji T.', temperature_celsius: 18.5, thermal_load_celsius: 18.5, active_items: ['Cold Brew Shaker', 'Mango Mint Soda'] },
    ]
    for (const st of stations) {
      await supabase.from('kitchen_stations').upsert(st, { onConflict: 'id' })
    }

    // 7. Seed Multi-Agent Tables: purchase_orders (BEE)
    const pos = [
      { id: 'po-1', po_number: 'PO-9401', supplier: 'Green Valley Farms', item: 'Fresh Paneer', restock_price: 265.0, price_change_pct: -5.35, delta_value: '-₹15/kg', delta_pct: '-5.4%', eta: 'Tomorrow 06:00 AM', action: 'PO_Drafted', category: 'Dairy Co-op' },
      { id: 'po-2', po_number: 'PO-9402', supplier: 'Poultry Direct Hub', item: 'Farm Fresh Chicken', restock_price: 305.0, price_change_pct: -4.68, delta_value: '-₹15/kg', delta_pct: '-4.7%', eta: 'Today 04:30 PM', action: 'Approved', category: 'Poultry Farm' },
      { id: 'po-3', po_number: 'PO-9403', supplier: 'Apex Millers Ltd', item: 'Aged Basmati Rice', restock_price: 92.0, price_change_pct: -3.15, delta_value: '-₹3/kg', delta_pct: '-3.2%', eta: 'In 2 days', action: 'PO_Drafted', category: 'Grain Wholesale' },
      { id: 'po-4', po_number: 'PO-9404', supplier: 'Kisan Spice Collective', item: 'Black Lentils (Urad)', restock_price: 122.0, price_change_pct: -6.15, delta_value: '-₹8/kg', delta_pct: '-6.2%', eta: 'Tomorrow 08:00 AM', action: 'Delivered', category: 'Direct Mandi' },
    ]
    for (const p of pos) {
      await supabase.from('purchase_orders').upsert(p, { onConflict: 'id' })
    }

    return NextResponse.json({
      success: true,
      message: 'All agent tables and ENZYME relational schema seeded into Supabase.',
      seeded: {
        inventory: inventoryData.length,
        menu_items: menuItemsData.length,
        orders: seedOrders.length,
        kitchen_stations: stations.length,
        purchase_orders: pos.length,
      },
    })
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown seed error' },
      { status: 500 }
    )
  }
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    description: 'POST to seed ENZYME relational RBAC data and multi-agent tables (kitchen_status, recipe_ingredients, menu_items, inventory, orders, kitchen_stations, purchase_orders)',
  })
}
