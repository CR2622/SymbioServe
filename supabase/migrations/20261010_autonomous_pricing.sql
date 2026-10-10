-- ============================================================================
-- BioFlow Engine: Database-Native SLIME Pricing Engine (Continuous Decay)
-- Migration: 20261010_autonomous_pricing.sql
-- ============================================================================

-- 1. Enable pg_cron extension for database-native autonomous scheduling
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 2. Define the continuous decay pricing calculation function in PL/pgSQL
CREATE OR REPLACE FUNCTION run_continuous_pricing()
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
  -- Iterate through inventory rows to compute proportional decay
  FOR inv IN 
    SELECT 
      item_name, 
      base_cost, 
      expiration_timestamp, 
      COALESCE(current_stock_kg, 10.00) AS current_stock_kg, 
      COALESCE(initial_stock_kg, 10.00) AS initial_stock_kg
    FROM inventory
  LOOP
    -- Calculate hours remaining until expiration (floor at 0.0)
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

    -- decay_factor = 1.0 - (urgency * 0.40) bounded between [0.60, 1.00]
    v_decay_factor := LEAST(1.0, GREATEST(0.60, 1.0 - (v_urgency * 0.40)));

    -- calculate dynamic price rounded to 2 decimal places
    v_dynamic_price := ROUND(inv.base_cost * v_decay_factor, 2);

    -- Execute native UPDATE on menu_items
    UPDATE menu_items
    SET 
      current_dynamic_price = v_dynamic_price,
      last_evaluated_at = NOW()
    WHERE item_name = inv.item_name;

  END LOOP;
END;
$$;

-- 3. Schedule the continuous pricing function to run every 1 minute via pg_cron
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'autonomous_slime_pricing') THEN
    PERFORM cron.unschedule('autonomous_slime_pricing');
  END IF;
  
  PERFORM cron.schedule(
    'autonomous_slime_pricing',
    '* * * * *',
    'SELECT run_continuous_pricing();'
  );
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Note: If pg_cron schedule fails, ensure pg_cron is enabled in Supabase Project Settings -> Database -> Extensions.';
END;
$$;

-- 4. Initial execution run to ensure immediate data freshness
SELECT run_continuous_pricing();
