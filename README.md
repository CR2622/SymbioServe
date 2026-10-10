# SymbioServe OS — BioFlow Multi-Interface Engine

Autonomous Bio-Cybernetic Kitchen Operating System with Event-Driven Supabase Realtime Architecture and 3 Role-Based Access Control (RBAC) Interfaces.

---

## 🌟 RBAC Interfaces & Architecture Overview

SymbioServe pivots dark kitchen operations through decentralized bio-inspired agents and a relational database schema mapping:

| Interface | URL Route | Target Persona | Key Agent Integrations |
| :--- | :--- | :--- | :--- |
| **Master Engine Hub** | `/` | Executive / Engineering | Unified ANT order queue, SLIME continuous pricing, BEE supplier quotes, FIREFLY oscillator mesh |
| **Customer Menu** | `/menu` | Diners & Mobile Orderers | **T-CELL** relational allergy filter, **BACTERIA** labor throttling, kitchen load forecast curve |
| **Chef Display KDS** | `/chef` | Line & Station Cooks | High-contrast tickets, **amber allergen highlight badges**, station velocity & sync phase chart |
| **Ops & Logistics** | `/ops` | General Managers & Supply Chain | Ingested orders metrics, SLIME margin saved, **low stock alerts table**, real-time labor toggle |

---

## 🧬 Biological Agent Roles

- **ENZYME (Recipe Synthesis Mapping Layer)**:
  Relational junction table `recipe_ingredients` mapping customer menu items to raw inventory batch lots with quantity and allergen classifications.
- **T-CELL (Kitchen Immune & Allergen Defense)**:
  Cross-references customer allergy selections across the relational schema to autonomously filter out hazardous dishes in real-time.
- **BACTERIA (Labor Throttling & Colony Telemetry)**:
  Monitors kitchen capacity from `kitchen_status`. When capacity transitions to `'Overwhelmed'`, autonomously hides dishes with `labor_intensity_score > 7.0` to preserve pass velocity.
- **SLIME (Continuous Decay Dynamic Pricing)**:
  PostgreSQL-native continuous decay algorithm adjusting menu pricing proportionally to ingredient shelf-life remaining and current stock pressure.
- **ANT (Autonomous Webhook Ingestion)**:
  Zero-liability ingestion of delivery webhooks (Zomato, Swiggy, UberEats, DoorDash) with Dead-Letter-Queue (DLQ) routing for uncertain payloads.
- **FIREFLY (Coupled-Oscillator Station Mesh)**:
  Kuramoto phase-synchronization aligning cooking cycles across Grill, Fryer, Assembly, and Pass stations.

---

## 🗄️ Database Schema & Migrations

All migrations reside in `supabase/migrations/`:
- `supabase/migrations/00_master_setup.sql`: Core inventory, menu items, orders, DLQ tables & SLIME pricing function.
- `supabase/migrations/20261010_firefly_and_agents_mesh.sql`: Station telemetry and purchase order foraging tables.
- `supabase/migrations/20261010_enzyme_rbac_schema.sql`: **ENZYME RBAC migration**:
  - `recipe_ingredients`: Junction table linking `menu_items(id)` to `inventory(id)` with `quantity_required` and `allergen_flag`.
  - `kitchen_status`: Tracks `current_labor_capacity` ('Normal' vs 'Overwhelmed').
  - `menu_items`: Enhanced with `labor_intensity_score` and `allergens TEXT[]`.
  - Supabase Realtime publication enabled on all tables.

### Seeding Data
Seed or sync data via the UI button in `/ops` or via POST endpoint:
```bash
curl -X POST http://localhost:3000/api/admin/seed-enzyme
```

---

## 🚀 Getting Started

### 1. Environment Variables
Ensure `.env.local` is configured (never commit this file):
```env
NEXT_PUBLIC_SUPABASE_URL=https://<your-project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-jwt-key>
GEMINI_API_KEY=<your-google-genai-key>
WEBHOOK_SECRET=symbiosis-ant-2026
```

### 2. Install & Run Dev Server
```bash
npm install
npm run dev
```

Navigate between interfaces using the universal cross-navigation dock:
- Customer Menu: [http://localhost:3000/menu](http://localhost:3000/menu)
- Chef KDS: [http://localhost:3000/chef](http://localhost:3000/chef)
- Ops & Logistics: [http://localhost:3000/ops](http://localhost:3000/ops)
- Engine KDS: [http://localhost:3000/](http://localhost:3000/)

---

## 🔒 Security & Credentials
- All sensitive API keys and connection strings remain strictly stored in untracked environment files (`.env.local`).
- Row Level Security (RLS) is configured for anon read/write in demonstration mode.
