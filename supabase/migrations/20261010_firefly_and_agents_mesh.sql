-- ============================================================================
-- SymbioServe OS — Multi-Agent Expansion: FIREFLY, BEE, SLIME, BACTERIA, T-CELL
-- Migration: 20261010_firefly_and_agents_mesh.sql
-- ============================================================================

-- ── 1. Kitchen Stations Telemetry Table (FIREFLY Coupled-Oscillator Mesh) ──
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

-- RLS Configuration
ALTER TABLE public.kitchen_stations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_full_access" ON public.kitchen_stations;
CREATE POLICY "anon_full_access" ON public.kitchen_stations FOR ALL USING (true) WITH CHECK (true);

-- Realtime Publication for kitchen_stations
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.kitchen_stations;
EXCEPTION WHEN OTHERS THEN NULL;
END;
$$;

-- Seed Default 5 Kitchen Stations
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

-- ── 2. Supplier Forager Purchase Orders Table (BEE Agent) ──
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

ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_full_access" ON public.purchase_orders;
CREATE POLICY "anon_full_access" ON public.purchase_orders FOR ALL USING (true) WITH CHECK (true);

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.purchase_orders;
EXCEPTION WHEN OTHERS THEN NULL;
END;
$$;
