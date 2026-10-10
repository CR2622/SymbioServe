/**
 * SymbioServe Engine — Shared Domain Types
 * Phase 2 Core Agent Logic
 */

export interface OrderItem {
  name: string
  quantity: number | string
  modifications?: string[]
  allergy_alert?: string
}

export interface InventoryRow {
  id: string
  item_name: string
  base_cost?: number
  current_stock_kg: number
  initial_stock_kg: number
  hours_remaining?: number | null
  expires_at?: string | null
  expiration_timestamp?: string | null
  allergens?: string[]
  created_at?: string
  [key: string]: unknown
}

export interface MenuItemRow {
  id: string
  item_name: string
  base_cost?: number
  base_price?: number
  current_dynamic_price: number | null
  labor_intensity_score?: number
  allergens?: string[]
  category?: string
  description?: string
  is_active?: boolean
  last_evaluated_at?: string | null
  inventory_id?: string | null
  created_at?: string
  [key: string]: unknown
}

export interface RecipeIngredientRow {
  id: string
  menu_item_id: string
  inventory_id: string
  quantity_required: number
  allergen_flag?: string | null
  created_at?: string
  inventory?: InventoryRow | null
  menu_item?: MenuItemRow | null
  [key: string]: unknown
}

export interface KitchenStatusRow {
  id: string
  current_labor_capacity: 'Normal' | 'Overwhelmed' | string
  active_headcount?: number
  surge_multiplier?: number
  throttling_enabled?: boolean
  updated_at?: string
  [key: string]: unknown
}

export interface CustomerOrderPayload {
  customer_name?: string
  table_number?: string
  items: Array<{
    name: string
    quantity: number
    modifications?: string[]
    allergy_alert?: string
  }>
}

export interface OrderRow {
  id?: string
  order_id: string
  source_platform: string
  items: OrderItem[] | string
  status: 'pending' | 'preparing' | 'ready' | 'completed' | 'dispatched' | 'cancelled' | string
  created_at?: string
  received_at?: string
  allergy_notes?: string
  [key: string]: unknown
}

export interface FailedWebhookRow {
  id?: string
  raw_payload: string
  error_message: string
  source_ip?: string | null
  created_at?: string
  [key: string]: unknown
}

export interface SlimeReadResponse {
  agent: 'SLIME'
  status: 'online' | 'evaluated' | 'error'
  items: MenuItemRow[]
  timestamp: string
  error?: string
}

export interface SlimeEvaluation {
  itemId: string
  itemName: string
  baseCost: number
  dynamicPrice: number
  decayFactor: number
  hoursRemaining: number
  stockPressure: number
  urgency: number
  lastEvaluatedAt: string
}

export interface AntAck {
  agent: 'ANT'
  status: 'acknowledged'
  orderId: string
  sourcePlatform: string
  queuePosition?: number
  receivedAt: string
}

export interface WebhookSuccessResponse {
  status: 'acknowledged'
  agent: 'ANT'
  orderId: string
  platform: string
  itemCount: number
  receivedAt: string
}

export interface WebhookErrorResponse {
  status: 'dlq_routed' | 'unauthorized' | 'invalid_payload'
  agent: 'ANT'
  error: string
  dlqId?: string
}

export type SaasTier =
  | 'Tier 1: Local Cafe'
  | 'Tier 2: Fast Casual'
  | 'Tier 3: Enterprise'
  | 'tier_1'
  | 'tier_2'
  | 'tier_3'

export interface BeeRestockQuote {
  id?: string
  supplier: string
  item: string
  restock_price: number
  price_change_pct?: number
  delta_value?: string
  delta_pct?: string
  eta: string
  action: 'PO_Drafted' | 'Approved' | 'Delivered' | string
  po_number?: string
  category?: string
  timestamp?: string
  [key: string]: unknown
}

export interface BeeAgentResponse {
  agent: 'BEE'
  status: 'active'
  quotes: BeeRestockQuote[]
  categories?: string[]
  timestamp: string
}

export type KitchenStationId = 'grill' | 'fryer' | 'assembly' | 'beverage' | 'packaging' | string

export type StationSyncStatus = 'phase_locked' | 'synchronizing' | 'drifting' | 'overloaded'

export interface KitchenStation {
  id: KitchenStationId
  name: string
  station_type?: string
  load_percentage: number
  active_orders: number
  capacity_orders_per_hr: number
  cycle_time_seconds: number
  phase_radians: number
  phase_degrees: number
  frequency_hz: number
  status: StationSyncStatus
  lead_cook: string
  temperature_celsius?: number
  thermal_load_celsius?: number
  active_items: string[]
}

export interface FireflyKuramotoMetrics {
  global_coherence_R: number
  mean_phase_psi: number
  coupling_strength_K: number
  sync_state: 'Fully Phase-Locked' | 'Synchronizing Mesh' | 'Phase Drift Detected'
  total_kitchen_load: number
  bottleneck_station: KitchenStationId | null
  thermal_headroom_celsius?: number
  last_sync_timestamp: string
}

export interface FireflyAgentResponse {
  agent: 'FIREFLY'
  status: 'active' | 'synced' | 'drift'
  metrics: FireflyKuramotoMetrics
  stations: KitchenStation[]
  timestamp: string
}

export interface BacteriaColonyMetric {
  sensor_zone: string
  ambient_temp_celsius: number
  relative_humidity_pct: number
  cfu_count_estimate: number
  spoilage_risk_level: 'nominal' | 'elevated' | 'critical'
  surge_forecast_multiplier: number
}

export interface BacteriaAmbientTelemetry {
  mean_kitchen_temp_c: number
  mean_humidity_pct: number
  microbial_growth_index: number
  shelf_life_acceleration_factor: number
}

export interface BacteriaDemandSurgeForecast {
  peak_predicted_in_mins: number
  estimated_volume_surge_pct: number
  spoilage_mitigation_action: string
}

export interface BacteriaAgentResponse {
  agent: 'BACTERIA'
  status: 'active' | 'warning' | 'nominal'
  ambient_telemetry: BacteriaAmbientTelemetry
  zones: BacteriaColonyMetric[]
  demand_surge_forecast: BacteriaDemandSurgeForecast
  timestamp: string
}

export interface TCellDefenseFlag {
  id: string
  zone: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  hazard_type: 'cross_contamination' | 'temp_abuse' | 'allergen_breach' | 'sanitizer_depletion' | string
  message: string
  resolved: boolean
  timestamp: string
}

export interface TCellAgentResponse {
  agent: 'TCELL'
  status: 'active' | 'defending' | 'alert'
  sanitizer_ppm: number
  sanitizer_status: 'optimal' | 'low' | 'excessive'
  uvc_sterilization_active: boolean
  surface_swab_purity_pct: number
  haccp_compliance_score: number
  active_flags: TCellDefenseFlag[]
  neutralized_threats_today: number
  timestamp: string
}


