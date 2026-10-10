-- ============================================================================
-- SymbioServe OS — Migration: 20261010_enzyme_rbac_schema.sql
-- ENZYME Recipe Synthesis & Relational RBAC Infrastructure
-- T-CELL (Allergen Cross-Ref) + BACTERIA (Labor Throttling) + MULTI-AGENT MESH
-- ============================================================================

-- ── 1. Create Kitchen Status Table (BACTERIA Labor Throttling Agent) ──
CREATE TABLE IF NOT EXISTS public.kitchen_status (
  id TEXT PRIMARY KEY DEFAULT 'current',
  current_labor_capacity TEXT NOT NULL DEFAULT 'Normal',
  active_headcount INTEGER DEFAULT 6,
  surge_multiplier NUMERIC(4, 2) DEFAULT 1.00,
  throttling_enabled BOOLEAN DEFAULT true,
  spoilage_risk_level TEXT DEFAULT 'nominal',
  ambient_temp_celsius NUMERIC(4, 1) DEFAULT 22.4,
  ambient_humidity_pct NUMERIC(4, 1) DEFAULT 54.2,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Seed initial kitchen status row if not present
INSERT INTO public.kitchen_status (id, current_labor_capacity, active_headcount, surge_multiplier, throttling_enabled)
VALUES ('current', 'Normal', 6, 1.00, true)
ON CONFLICT (id) DO UPDATE SET
  updated_at = now();

-- ── 2. Ensure Constraints and Columns on Existing Core Tables ──

-- Inventory: Ensure UNIQUE on item_name for ON CONFLICT upserts, and add allergens array
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'inventory_item_name_key'
  ) THEN
    ALTER TABLE public.inventory ADD CONSTRAINT inventory_item_name_key UNIQUE (item_name);
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS allergens TEXT[] DEFAULT '{}';

-- Menu Items: Add Labor Intensity Score and Allergen Array
ALTER TABLE public.menu_items ADD COLUMN IF NOT EXISTS labor_intensity_score NUMERIC(4, 1) DEFAULT 5.0;
ALTER TABLE public.menu_items ADD COLUMN IF NOT EXISTS allergens TEXT[] DEFAULT '{}';
ALTER TABLE public.menu_items ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'Mains';
ALTER TABLE public.menu_items ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';
ALTER TABLE public.menu_items ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Orders: Add Allergy Notes column for Customer -> Chef ticket transmission
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS allergy_notes TEXT;

-- ── 3. Create Recipe Ingredients Junction Table (ENZYME Mapping Layer) ──
CREATE TABLE IF NOT EXISTS public.recipe_ingredients (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  menu_item_id UUID NOT NULL REFERENCES public.menu_items(id) ON DELETE CASCADE,
  inventory_id UUID NOT NULL REFERENCES public.inventory(id) ON DELETE CASCADE,
  quantity_required NUMERIC(10, 2) NOT NULL DEFAULT 1.00,
  allergen_flag TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ── 4. Create Multi-Agent Tables (FIREFLY, BEE, T-CELL) ──

-- Kitchen Stations Telemetry Table (FIREFLY Oscillator Sync Mesh)
CREATE TABLE IF NOT EXISTS public.kitchen_stations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  station_type TEXT NOT NULL,
  load_percentage NUMERIC(5, 2) NOT NULL DEFAULT 50.00,
  active_orders INTEGER NOT NULL DEFAULT 0,
  capacity_orders_per_hr INTEGER NOT NULL DEFAULT 60,
  cycle_time_seconds INTEGER NOT NULL DEFAULT 120,
  phase_radians NUMERIC(6, 3) NOT NULL DEFAULT 0.000,
  phase_degrees INTEGER NOT NULL DEFAULT 0,
  frequency_hz NUMERIC(5, 2) NOT NULL DEFAULT 1.00,
  status TEXT NOT NULL DEFAULT 'phase_locked',
  lead_cook TEXT NOT NULL DEFAULT 'Chef Operator',
  temperature_celsius NUMERIC(5, 2) DEFAULT 25.00,
  thermal_load_celsius NUMERIC(5, 2) DEFAULT 25.00,
  active_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Supplier Purchase Orders Table (BEE Agent Forager Restock)
CREATE TABLE IF NOT EXISTS public.purchase_orders (
  id TEXT PRIMARY KEY,
  po_number TEXT NOT NULL UNIQUE,
  supplier TEXT NOT NULL,
  item TEXT NOT NULL,
  restock_price NUMERIC(10, 2) NOT NULL,
  price_change_pct NUMERIC(6, 2) DEFAULT 0.00,
  delta_value TEXT,
  delta_pct TEXT,
  eta TEXT NOT NULL,
  action TEXT NOT NULL DEFAULT 'PO_Drafted',
  category TEXT NOT NULL DEFAULT 'Local Farmers',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- HACCP and Pathogen Defense Log (T-CELL Agent)
CREATE TABLE IF NOT EXISTS public.tcell_defense_log (
  id TEXT PRIMARY KEY,
  zone TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'low',
  hazard_type TEXT NOT NULL,
  message TEXT NOT NULL,
  resolved BOOLEAN DEFAULT true,
  sanitizer_ppm INTEGER DEFAULT 215,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ── 5. Permissions & Row Level Security (RLS) ──
ALTER TABLE public.kitchen_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipe_ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.failed_webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kitchen_stations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tcell_defense_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_full_access" ON public.kitchen_status;
CREATE POLICY "anon_full_access" ON public.kitchen_status FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_full_access" ON public.recipe_ingredients;
CREATE POLICY "anon_full_access" ON public.recipe_ingredients FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_full_access" ON public.menu_items;
CREATE POLICY "anon_full_access" ON public.menu_items FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_full_access" ON public.inventory;
CREATE POLICY "anon_full_access" ON public.inventory FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_full_access" ON public.orders;
CREATE POLICY "anon_full_access" ON public.orders FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_full_access" ON public.failed_webhooks;
CREATE POLICY "anon_full_access" ON public.failed_webhooks FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_full_access" ON public.kitchen_stations;
CREATE POLICY "anon_full_access" ON public.kitchen_stations FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_full_access" ON public.purchase_orders;
CREATE POLICY "anon_full_access" ON public.purchase_orders FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_full_access" ON public.tcell_defense_log;
CREATE POLICY "anon_full_access" ON public.tcell_defense_log FOR ALL USING (true) WITH CHECK (true);

GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;

-- ── 6. Supabase Realtime Publication ──
DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.kitchen_status; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.recipe_ingredients; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.menu_items; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.inventory; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.orders; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.kitchen_stations; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.purchase_orders; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.tcell_defense_log; EXCEPTION WHEN OTHERS THEN NULL; END;
END $$;

-- ── 7. Seed Inventory Items ──
INSERT INTO public.inventory (item_name, base_cost, expiration_timestamp, current_stock_kg, initial_stock_kg, allergens)
VALUES
  ('Fresh Paneer',          280.00, now() + interval '8 hours',   14.00, 20.00, ARRAY['Dairy']),
  ('Farm Fresh Chicken',    320.00, now() + interval '20 hours',   3.80, 25.00, ARRAY[]::TEXT[]), -- Low Stock Trigger! (< 5.0 kg & < 25%)
  ('Roasted Peanuts',       110.00, now() + interval '72 hours',  12.00, 15.00, ARRAY['Peanuts']),
  ('Aged Basmati Rice',      95.00, now() + interval '120 hours', 22.00, 30.00, ARRAY[]::TEXT[]),
  ('Black Lentils (Urad)',  130.00, now() + interval '96 hours',   3.20, 18.00, ARRAY[]::TEXT[]), -- Low Stock Trigger! (< 5.0 kg & < 25%)
  ('Dairy Cream & Milk',    140.00, now() + interval '14 hours',  16.00, 20.00, ARRAY['Dairy']),
  ('Sourdough Flour',        85.00, now() + interval '140 hours', 18.00, 25.00, ARRAY['Gluten']),
  ('Belgian Chocolate',     380.00, now() + interval '60 hours',   2.50, 10.00, ARRAY[]::TEXT[]), -- Low Stock Trigger! (< 5.0 kg & < 25%)
  ('Alphonso Mango Pulp',   160.00, now() + interval '18 hours',   7.50, 12.00, ARRAY[]::TEXT[]),
  ('Organic Kale & Citrus', 110.00, now() + interval '16 hours',   9.00, 10.00, ARRAY[]::TEXT[])
ON CONFLICT (item_name) DO UPDATE SET
  current_stock_kg = EXCLUDED.current_stock_kg,
  expiration_timestamp = EXCLUDED.expiration_timestamp,
  allergens = EXCLUDED.allergens;

-- ── 8. Seed Menu Items (with Labor Scores and Allergens) ──
-- High labor score (> 7.0): Throttled autonomously when kitchen_status = 'Overwhelmed'
INSERT INTO public.menu_items (item_name, base_price, current_dynamic_price, labor_intensity_score, allergens, category, description)
VALUES
  ('Paneer Tikka', 299.00, 245.00, 5.0, ARRAY['Dairy'], 'Starters', 'Charcoal-charred artisanal cottage cheese steeped in Greek yogurt marinade and stone-ground spices.'),
  ('Chicken Biryani', 349.00, 319.00, 9.2, ARRAY[]::TEXT[], 'Mains', 'Slow-dum aged basmati rice infused with Kashmiri saffron, caramelized shallots, and tender chicken.'),
  ('Artisan Truffle Pizza', 420.00, 389.00, 8.8, ARRAY['Dairy', 'Gluten'], 'Mains', '72-hour cold fermented sourdough crust crowned with black truffle puree, fior di latte, and micro-herbs.'),
  ('Thai Peanut Satay Noodle', 280.00, 235.00, 8.1, ARRAY['Peanuts', 'Gluten'], 'Mains', 'Wok-charred hand-pulled noodles tossed in roasted peanut chili-lime emulsion with crispy shallot crunch.'),
  ('Dal Makhani', 199.00, 182.00, 4.2, ARRAY['Dairy'], 'Mains', 'Slow-cooked whole black lentils simmered for 24 hours with churned dairy butter and vine-ripened tomatoes.'),
  ('Peanut Butter Lava Brownie', 160.00, 138.00, 3.8, ARRAY['Peanuts', 'Dairy', 'Gluten'], 'Desserts', 'Warm Belgian dark chocolate fondant with a molten roasted peanut praline center.'),
  ('Gulab Jamun', 99.00, 78.00, 2.5, ARRAY['Dairy', 'Gluten'], 'Desserts', 'Traditional evaporated milk dumplings steeped in Damascus rose syrup and bruised green cardamom.'),
  ('Fresh Citrus Kale Salad', 190.00, 165.00, 2.0, ARRAY[]::TEXT[], 'Salads', 'Tuscan lacinato kale tossed with blood orange discs, toasted sunflower kernels, and lemon-shallot dressing.'),
  ('Signature Smash Burger', 380.00, 335.00, 7.9, ARRAY['Dairy', 'Gluten'], 'Mains', 'Double smash patties with melted aged white cheddar, house-cured pickles, on toasted brioche.'),
  ('Mango Mint Lassi', 120.00, 95.00, 1.8, ARRAY['Dairy'], 'Beverages', 'Cultured whole-milk yogurt whipped with Alphonso mango nectar, fresh spearmint, and cardamom dust.')
ON CONFLICT (item_name) DO UPDATE SET
  base_price = EXCLUDED.base_price,
  current_dynamic_price = EXCLUDED.current_dynamic_price,
  labor_intensity_score = EXCLUDED.labor_intensity_score,
  allergens = EXCLUDED.allergens,
  category = EXCLUDED.category,
  description = EXCLUDED.description;

-- ── 9. Seed ENZYME Recipe Ingredients Mapping ──
DELETE FROM public.recipe_ingredients WHERE true;

DO $$
DECLARE
  v_paneer_tikka_id UUID;
  v_chicken_biryani_id UUID;
  v_truffle_pizza_id UUID;
  v_satay_noodle_id UUID;
  v_dal_makhani_id UUID;
  v_pb_brownie_id UUID;
  v_gulab_jamun_id UUID;
  v_citrus_salad_id UUID;
  v_smash_burger_id UUID;
  v_mango_lassi_id UUID;

  v_inv_paneer UUID;
  v_inv_chicken UUID;
  v_inv_peanuts UUID;
  v_inv_rice UUID;
  v_inv_lentils UUID;
  v_inv_dairy UUID;
  v_inv_flour UUID;
  v_inv_choc UUID;
  v_inv_mango UUID;
  v_inv_kale UUID;
BEGIN
  SELECT id INTO v_paneer_tikka_id FROM public.menu_items WHERE item_name = 'Paneer Tikka' LIMIT 1;
  SELECT id INTO v_chicken_biryani_id FROM public.menu_items WHERE item_name = 'Chicken Biryani' LIMIT 1;
  SELECT id INTO v_truffle_pizza_id FROM public.menu_items WHERE item_name = 'Artisan Truffle Pizza' LIMIT 1;
  SELECT id INTO v_satay_noodle_id FROM public.menu_items WHERE item_name = 'Thai Peanut Satay Noodle' LIMIT 1;
  SELECT id INTO v_dal_makhani_id FROM public.menu_items WHERE item_name = 'Dal Makhani' LIMIT 1;
  SELECT id INTO v_pb_brownie_id FROM public.menu_items WHERE item_name = 'Peanut Butter Lava Brownie' LIMIT 1;
  SELECT id INTO v_gulab_jamun_id FROM public.menu_items WHERE item_name = 'Gulab Jamun' LIMIT 1;
  SELECT id INTO v_citrus_salad_id FROM public.menu_items WHERE item_name = 'Fresh Citrus Kale Salad' LIMIT 1;
  SELECT id INTO v_smash_burger_id FROM public.menu_items WHERE item_name = 'Signature Smash Burger' LIMIT 1;
  SELECT id INTO v_mango_lassi_id FROM public.menu_items WHERE item_name = 'Mango Mint Lassi' LIMIT 1;

  SELECT id INTO v_inv_paneer FROM public.inventory WHERE item_name = 'Fresh Paneer' LIMIT 1;
  SELECT id INTO v_inv_chicken FROM public.inventory WHERE item_name = 'Farm Fresh Chicken' LIMIT 1;
  SELECT id INTO v_inv_peanuts FROM public.inventory WHERE item_name = 'Roasted Peanuts' LIMIT 1;
  SELECT id INTO v_inv_rice FROM public.inventory WHERE item_name = 'Aged Basmati Rice' LIMIT 1;
  SELECT id INTO v_inv_lentils FROM public.inventory WHERE item_name = 'Black Lentils (Urad)' LIMIT 1;
  SELECT id INTO v_inv_dairy FROM public.inventory WHERE item_name = 'Dairy Cream & Milk' LIMIT 1;
  SELECT id INTO v_inv_flour FROM public.inventory WHERE item_name = 'Sourdough Flour' LIMIT 1;
  SELECT id INTO v_inv_choc FROM public.inventory WHERE item_name = 'Belgian Chocolate' LIMIT 1;
  SELECT id INTO v_inv_mango FROM public.inventory WHERE item_name = 'Alphonso Mango Pulp' LIMIT 1;
  SELECT id INTO v_inv_kale FROM public.inventory WHERE item_name = 'Organic Kale & Citrus' LIMIT 1;

  -- Paneer Tikka (Paneer, Dairy)
  IF v_paneer_tikka_id IS NOT NULL AND v_inv_paneer IS NOT NULL THEN
    INSERT INTO public.recipe_ingredients (menu_item_id, inventory_id, quantity_required, allergen_flag)
    VALUES (v_paneer_tikka_id, v_inv_paneer, 0.25, 'Dairy');
  END IF;
  IF v_paneer_tikka_id IS NOT NULL AND v_inv_dairy IS NOT NULL THEN
    INSERT INTO public.recipe_ingredients (menu_item_id, inventory_id, quantity_required, allergen_flag)
    VALUES (v_paneer_tikka_id, v_inv_dairy, 0.08, 'Dairy');
  END IF;

  -- Chicken Biryani (Chicken, Rice)
  IF v_chicken_biryani_id IS NOT NULL AND v_inv_chicken IS NOT NULL THEN
    INSERT INTO public.recipe_ingredients (menu_item_id, inventory_id, quantity_required, allergen_flag)
    VALUES (v_chicken_biryani_id, v_inv_chicken, 0.35, NULL);
  END IF;
  IF v_chicken_biryani_id IS NOT NULL AND v_inv_rice IS NOT NULL THEN
    INSERT INTO public.recipe_ingredients (menu_item_id, inventory_id, quantity_required, allergen_flag)
    VALUES (v_chicken_biryani_id, v_inv_rice, 0.20, NULL);
  END IF;

  -- Artisan Truffle Pizza (Flour, Dairy)
  IF v_truffle_pizza_id IS NOT NULL AND v_inv_flour IS NOT NULL THEN
    INSERT INTO public.recipe_ingredients (menu_item_id, inventory_id, quantity_required, allergen_flag)
    VALUES (v_truffle_pizza_id, v_inv_flour, 0.25, 'Gluten');
  END IF;
  IF v_truffle_pizza_id IS NOT NULL AND v_inv_dairy IS NOT NULL THEN
    INSERT INTO public.recipe_ingredients (menu_item_id, inventory_id, quantity_required, allergen_flag)
    VALUES (v_truffle_pizza_id, v_inv_dairy, 0.15, 'Dairy');
  END IF;

  -- Thai Peanut Satay Noodle (Peanuts, Flour)
  IF v_satay_noodle_id IS NOT NULL AND v_inv_peanuts IS NOT NULL THEN
    INSERT INTO public.recipe_ingredients (menu_item_id, inventory_id, quantity_required, allergen_flag)
    VALUES (v_satay_noodle_id, v_inv_peanuts, 0.08, 'Peanuts');
  END IF;
  IF v_satay_noodle_id IS NOT NULL AND v_inv_flour IS NOT NULL THEN
    INSERT INTO public.recipe_ingredients (menu_item_id, inventory_id, quantity_required, allergen_flag)
    VALUES (v_satay_noodle_id, v_inv_flour, 0.20, 'Gluten');
  END IF;

  -- Dal Makhani (Lentils, Dairy)
  IF v_dal_makhani_id IS NOT NULL AND v_inv_lentils IS NOT NULL THEN
    INSERT INTO public.recipe_ingredients (menu_item_id, inventory_id, quantity_required, allergen_flag)
    VALUES (v_dal_makhani_id, v_inv_lentils, 0.20, NULL);
  END IF;
  IF v_dal_makhani_id IS NOT NULL AND v_inv_dairy IS NOT NULL THEN
    INSERT INTO public.recipe_ingredients (menu_item_id, inventory_id, quantity_required, allergen_flag)
    VALUES (v_dal_makhani_id, v_inv_dairy, 0.12, 'Dairy');
  END IF;

  -- Peanut Butter Lava Brownie (Chocolate, Peanuts, Flour, Dairy)
  IF v_pb_brownie_id IS NOT NULL AND v_inv_choc IS NOT NULL THEN
    INSERT INTO public.recipe_ingredients (menu_item_id, inventory_id, quantity_required, allergen_flag)
    VALUES (v_pb_brownie_id, v_inv_choc, 0.10, NULL);
  END IF;
  IF v_pb_brownie_id IS NOT NULL AND v_inv_peanuts IS NOT NULL THEN
    INSERT INTO public.recipe_ingredients (menu_item_id, inventory_id, quantity_required, allergen_flag)
    VALUES (v_pb_brownie_id, v_inv_peanuts, 0.06, 'Peanuts');
  END IF;
  IF v_pb_brownie_id IS NOT NULL AND v_inv_flour IS NOT NULL THEN
    INSERT INTO public.recipe_ingredients (menu_item_id, inventory_id, quantity_required, allergen_flag)
    VALUES (v_pb_brownie_id, v_inv_flour, 0.08, 'Gluten');
  END IF;
  IF v_pb_brownie_id IS NOT NULL AND v_inv_dairy IS NOT NULL THEN
    INSERT INTO public.recipe_ingredients (menu_item_id, inventory_id, quantity_required, allergen_flag)
    VALUES (v_pb_brownie_id, v_inv_dairy, 0.05, 'Dairy');
  END IF;

  -- Gulab Jamun (Dairy, Flour)
  IF v_gulab_jamun_id IS NOT NULL AND v_inv_dairy IS NOT NULL THEN
    INSERT INTO public.recipe_ingredients (menu_item_id, inventory_id, quantity_required, allergen_flag)
    VALUES (v_gulab_jamun_id, v_inv_dairy, 0.15, 'Dairy');
  END IF;
  IF v_gulab_jamun_id IS NOT NULL AND v_inv_flour IS NOT NULL THEN
    INSERT INTO public.recipe_ingredients (menu_item_id, inventory_id, quantity_required, allergen_flag)
    VALUES (v_gulab_jamun_id, v_inv_flour, 0.05, 'Gluten');
  END IF;

  -- Fresh Citrus Kale Salad (Kale)
  IF v_citrus_salad_id IS NOT NULL AND v_inv_kale IS NOT NULL THEN
    INSERT INTO public.recipe_ingredients (menu_item_id, inventory_id, quantity_required, allergen_flag)
    VALUES (v_citrus_salad_id, v_inv_kale, 0.22, NULL);
  END IF;

  -- Signature Smash Burger (Flour, Dairy)
  IF v_smash_burger_id IS NOT NULL AND v_inv_flour IS NOT NULL THEN
    INSERT INTO public.recipe_ingredients (menu_item_id, inventory_id, quantity_required, allergen_flag)
    VALUES (v_smash_burger_id, v_inv_flour, 0.15, 'Gluten');
  END IF;
  IF v_smash_burger_id IS NOT NULL AND v_inv_dairy IS NOT NULL THEN
    INSERT INTO public.recipe_ingredients (menu_item_id, inventory_id, quantity_required, allergen_flag)
    VALUES (v_smash_burger_id, v_inv_dairy, 0.08, 'Dairy');
  END IF;

  -- Mango Mint Lassi (Mango, Dairy)
  IF v_mango_lassi_id IS NOT NULL AND v_inv_mango IS NOT NULL THEN
    INSERT INTO public.recipe_ingredients (menu_item_id, inventory_id, quantity_required, allergen_flag)
    VALUES (v_mango_lassi_id, v_inv_mango, 0.18, NULL);
  END IF;
  IF v_mango_lassi_id IS NOT NULL AND v_inv_dairy IS NOT NULL THEN
    INSERT INTO public.recipe_ingredients (menu_item_id, inventory_id, quantity_required, allergen_flag)
    VALUES (v_mango_lassi_id, v_inv_dairy, 0.22, 'Dairy');
  END IF;
END $$;

-- ── 10. Seed Multi-Agent Kitchen Stations (FIREFLY Agent) ──
INSERT INTO public.kitchen_stations (
  id, name, station_type, load_percentage, active_orders, capacity_orders_per_hr,
  cycle_time_seconds, phase_radians, phase_degrees, frequency_hz, status, lead_cook,
  temperature_celsius, thermal_load_celsius, active_items
) VALUES
  ('grill', 'Tandoor & Char-Grill Station', 'Grill', 78.00, 4, 50, 210, 5.90, 338, 1.42, 'phase_locked', 'Marcus R.', 224.0, 224.0, '["Paneer Tikka Burger", "Smoky Patty x3"]'::jsonb),
  ('fryer', 'Deep Fryer Bank (Dual-Vat)', 'Fryer', 62.00, 2, 60, 150, 5.52, 316, 1.15, 'phase_locked', 'Dev P.', 182.0, 182.0, '["Crispy Fries x2", "Falafel Pops"]'::jsonb),
  ('assembly', 'Cold Prep & Garde Manger', 'Cold Assembly', 45.00, 5, 75, 90, 6.22, 356, 0.98, 'phase_locked', 'Elena S.', 3.8, 3.8, '["Greek Salad", "Farm Wrap x2", "Fresh Aioli Dip"]'::jsonb),
  ('packaging', 'Finishing Pass & Heat Gantry', 'Pass', 84.00, 3, 80, 70, 5.78, 331, 1.30, 'phase_locked', 'Chef Ananya', 66.0, 66.0, '["Order QC #4412", "Bag Seal & Tag #4413"]'::jsonb),
  ('beverage', 'Barista & Cold Dispensary', 'Beverage', 38.00, 2, 90, 60, 5.65, 324, 1.05, 'phase_locked', 'Kenji T.', 18.5, 18.5, '["Cold Brew Shaker", "Mango Mint Soda"]'::jsonb)
ON CONFLICT (id) DO UPDATE SET
  load_percentage = EXCLUDED.load_percentage,
  active_orders = EXCLUDED.active_orders,
  updated_at = now();

-- ── 11. Seed Supplier Purchase Orders (BEE Agent) ──
INSERT INTO public.purchase_orders (
  id, po_number, supplier, item, restock_price, price_change_pct, delta_value, delta_pct, eta, action, category
) VALUES
  ('po-1', 'PO-9401', 'Green Valley Farms', 'Fresh Paneer', 265.00, -5.35, '-₹15/kg', '-5.4%', 'Tomorrow 06:00 AM', 'PO_Drafted', 'Dairy Co-op'),
  ('po-2', 'PO-9402', 'Poultry Direct Hub', 'Farm Fresh Chicken', 305.00, -4.68, '-₹15/kg', '-4.7%', 'Today 04:30 PM', 'Approved', 'Poultry Farm'),
  ('po-3', 'PO-9403', 'Apex Millers Ltd', 'Aged Basmati Rice', 92.00, -3.15, '-₹3/kg', '-3.2%', 'In 2 days', 'PO_Drafted', 'Grain Wholesale'),
  ('po-4', 'PO-9404', 'Kisan Spice Collective', 'Black Lentils (Urad)', 122.00, -6.15, '-₹8/kg', '-6.2%', 'Tomorrow 08:00 AM', 'Delivered', 'Direct Mandi')
ON CONFLICT (po_number) DO UPDATE SET
  restock_price = EXCLUDED.restock_price,
  action = EXCLUDED.action;

-- ── 12. Seed T-CELL Immune Defense Log ──
INSERT INTO public.tcell_defense_log (id, zone, severity, hazard_type, message, resolved, sanitizer_ppm)
VALUES
  ('tc-1', 'Prep Board Station 2 (Allergen Bay)', 'low', 'cross_contamination', 'Purple allergen kit active; dedicated knife sterilized at 85°C', true, 215),
  ('tc-2', 'Sanitization Sink 3', 'low', 'sanitizer_depletion', 'Active Quat sanitizer verified at 215 PPM (Target: 200-400 PPM)', true, 215),
  ('tc-3', 'Walk-in Air Curtain', 'low', 'temp_abuse', 'Thermal ingress seal checked; ambient temp locked at 3.4°C', true, 215)
ON CONFLICT (id) DO UPDATE SET
  message = EXCLUDED.message,
  resolved = EXCLUDED.resolved;

-- ── 13. Seed Initial Orders (with Allergen Badges & Tags for Chef KDS) ──
INSERT INTO public.orders (order_id, source_platform, items, status, received_at, allergy_notes)
VALUES
  (
    'ZOM-402',
    'Zomato',
    '[{"name":"Paneer Tikka","quantity":2,"modifications":["NO DAIRY","EXTRA MINT CHUTNEY"],"allergy_alert":"DAIRY ALLERGY — SUBSTITUTE CASHEW CREME"},{"name":"Dal Makhani","quantity":1},{"name":"Garlic Naan","quantity":3}]'::jsonb,
    'pending',
    now() - interval '3 minutes',
    'DAIRY ALLERGY — STRICT NO DAIRY'
  ),
  (
    'CUST-104',
    'Customer Web (Table 4)',
    '[{"name":"Thai Peanut Satay Noodle","quantity":1,"modifications":["NO PEANUTS"],"allergy_alert":"SEVERE PEANUT ALLERGY"},{"name":"Mango Mint Lassi","quantity":2}]'::jsonb,
    'pending',
    now() - interval '1 minute',
    'SEVERE PEANUT ALLERGY'
  ),
  (
    'SWIG-882',
    'Swiggy',
    '[{"name":"Chicken Biryani","quantity":2},{"name":"Gulab Jamun","quantity":2}]'::jsonb,
    'preparing',
    now() - interval '6 minutes',
    NULL
  ),
  (
    'UBER-109',
    'UberEats',
    '[{"name":"Artisan Truffle Pizza","quantity":1,"modifications":["NO GLUTEN CRUST (CAULIFLOWER)"],"allergy_alert":"CELIAC GLUTEN ALERT"},{"name":"Fresh Citrus Kale Salad","quantity":1}]'::jsonb,
    'pending',
    now() - interval '8 minutes',
    'CELIAC GLUTEN ALERT — NO GLUTEN CRUST'
  )
ON CONFLICT (id) DO NOTHING;
