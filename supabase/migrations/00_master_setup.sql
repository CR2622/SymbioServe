-- ============================================================================
-- SymbioServe OS — BioFlow Engine Master Database Setup (Clean Install)
-- Run this script in your Supabase Dashboard -> SQL Editor
-- ============================================================================

-- ── 1. Enable Required Extensions ──
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- ── 2. Clean Reset of Previous Table Schemas ──
DROP TABLE IF EXISTS public.inventory CASCADE;
DROP TABLE IF EXISTS public.menu_items CASCADE;
DROP TABLE IF EXISTS public.orders CASCADE;
DROP TABLE IF EXISTS public.failed_webhooks CASCADE;

-- ── 3. Create Core Tables with V4 Schema ──

-- Inventory: Raw stock with expiration & weight tracking
CREATE TABLE public.inventory (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  item_name TEXT NOT NULL,
  base_cost NUMERIC(10, 2) NOT NULL,
  expiration_timestamp TIMESTAMPTZ NOT NULL,
  current_stock_kg NUMERIC(10, 2) NOT NULL DEFAULT 10.00,
  initial_stock_kg NUMERIC(10, 2) NOT NULL DEFAULT 10.00,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Menu Items: Customer-facing catalog with dynamic prices
CREATE TABLE public.menu_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  item_name TEXT NOT NULL UNIQUE,
  base_price NUMERIC(10, 2) NOT NULL,
  current_dynamic_price NUMERIC(10, 2),
  last_evaluated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Orders: Normalized order stream from all delivery platforms
CREATE TABLE public.orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id TEXT NOT NULL,
  source_platform TEXT NOT NULL,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending',
  received_at TIMESTAMPTZ DEFAULT now()
);

-- Failed Webhooks: Dead Letter Queue (DLQ) for uncertain or unparseable payloads
CREATE TABLE public.failed_webhooks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  raw_payload TEXT NOT NULL,
  error_message TEXT NOT NULL,
  source_ip TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ── 4. Table Permissions & RLS ──
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;

ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.failed_webhooks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_full_access" ON public.inventory;
CREATE POLICY "anon_full_access" ON public.inventory FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_full_access" ON public.menu_items;
CREATE POLICY "anon_full_access" ON public.menu_items FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_full_access" ON public.orders;
CREATE POLICY "anon_full_access" ON public.orders FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_full_access" ON public.failed_webhooks;
CREATE POLICY "anon_full_access" ON public.failed_webhooks FOR ALL USING (true) WITH CHECK (true);

-- ── 5. Supabase Realtime Publication ──
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.menu_items;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.failed_webhooks;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
END;
$$;

-- ── 6. Database-Native SLIME Pricing Engine (Continuous Decay) ──
CREATE OR REPLACE FUNCTION public.run_continuous_pricing()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  inv RECORD;
  v_hours_remaining NUMERIC;
  v_time_ratio NUMERIC;
  v_stock_pressure NUMERIC;
  v_urgency NUMERIC;
  v_decay_factor NUMERIC;
  v_dynamic_price NUMERIC;
BEGIN
  FOR inv IN 
    SELECT 
      item_name, 
      base_cost, 
      expiration_timestamp, 
      COALESCE(current_stock_kg, 10.00) AS current_stock_kg, 
      COALESCE(initial_stock_kg, 10.00) AS initial_stock_kg
    FROM public.inventory
  LOOP
    -- Hours remaining until expiration
    v_hours_remaining := GREATEST(0.0, EXTRACT(EPOCH FROM (inv.expiration_timestamp - NOW())) / 3600.0);

    -- time_ratio: clamp(hours_remaining / 48.0, 0.0, 1.0)
    v_time_ratio := LEAST(1.0, GREATEST(0.0, v_hours_remaining / 48.0));

    -- stock_pressure: current_stock_kg / initial_stock_kg
    IF inv.initial_stock_kg > 0 THEN
      v_stock_pressure := inv.current_stock_kg / inv.initial_stock_kg;
    ELSE
      v_stock_pressure := 1.0;
    END IF;

    -- urgency = (1.0 - time_ratio) * stock_pressure
    v_urgency := (1.0 - v_time_ratio) * v_stock_pressure;

    -- decay_factor bounded between 0.60 and 1.00
    v_decay_factor := LEAST(1.0, GREATEST(0.60, 1.0 - (v_urgency * 0.40)));

    -- dynamic price
    v_dynamic_price := ROUND(inv.base_cost * v_decay_factor, 2);

    -- update menu_items
    UPDATE public.menu_items
    SET 
      current_dynamic_price = v_dynamic_price,
      last_evaluated_at = NOW()
    WHERE item_name = inv.item_name;

  END LOOP;
END;
$$;

-- ── 7. Autonomous Cron Schedule (Runs every 1 minute) ──
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'autonomous_slime_pricing') THEN
    PERFORM cron.unschedule('autonomous_slime_pricing');
  END IF;
  
  PERFORM cron.schedule(
    'autonomous_slime_pricing',
    '* * * * *',
    'SELECT public.run_continuous_pricing();'
  );
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'pg_cron not enabled directly. Enable via Supabase Project Settings -> Database -> Extensions.';
END;
$$;

-- ── 8. Seed Initial Test Data ──
INSERT INTO public.inventory (item_name, base_cost, expiration_timestamp, current_stock_kg, initial_stock_kg)
VALUES
  ('Paneer Tikka',    299.00, now() + interval '6 hours',  12.5, 15.0),
  ('Chicken Biryani', 349.00, now() + interval '24 hours', 5.0,  30.0),
  ('Gulab Jamun',      99.00, now() + interval '3 hours',  8.0,   8.0),
  ('Dal Makhani',     199.00, now() + interval '48 hours', 2.0,  20.0);

INSERT INTO public.menu_items (item_name, base_price, current_dynamic_price)
VALUES
  ('Paneer Tikka',    299.00, 299.00),
  ('Chicken Biryani', 349.00, 349.00),
  ('Gulab Jamun',      99.00, 99.00),
  ('Dal Makhani',     199.00, 199.00);

-- Initial execution of continuous decay pricing calculation
SELECT public.run_continuous_pricing();
