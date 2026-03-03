# Agent Backend Build Checklist

Current state audit of the Closr agent backend (Cloudflare Workers + D1).

## ✅ Done

### Infrastructure
- [x] Cloudflare Workers entry point (`functions/index.ts`)
- [x] Router setup with CORS, health check, 404 handler
- [x] D1 database schema (`schema.sql`) — 7 tables, all indexed
- [x] Wrangler config (`wrangler.toml`) — D1 binding, env vars
- [x] Env interface extracted (`functions/env.ts`)

### Authentication (`functions/api/auth.ts`)
- [x] `POST /api/auth/register` — agent registration with bcrypt + JWT
- [x] `POST /api/auth/login` — credential verification + token generation
- [x] `GET /api/auth/me` — token-validated profile fetch

### OSINT Enrichment Pipeline
- [x] Match engine (`functions/enrichment/match_engine.ts`) — Levenshtein, token-set overlap, address normalization, entity detection
- [x] Scoring engine (`functions/enrichment/scoring_engine.ts`) — 0-100 weighted scoring with breakdown
- [x] Lead intel orchestrator (`functions/enrichment/lead_intel_service.ts`) — cache → provider → entity → match → score → persist
- [x] Provider cache layer (D1 `provider_cache` table)

### API Routes
- [x] `POST /api/leads/enrich` — batch OSINT enrichment
- [x] `GET /api/leads/:id/intel` — retrieve stored intel
- [x] `POST /api/leads/:id/intel/recompute` — re-run enrichment
- [x] `DELETE /api/leads/:id/consent` — GDPR-style data deletion
- [x] `GET /api/property/:county/:folio` — folio lookup via county provider
- [x] `GET /api/property/search?address=&county=` — address search

### Real OSINT Providers (no mock)
- [x] Miami-Dade — ArcGIS Property_Boundary_View FeatureServer
- [x] Broward — GeoHub ArcGIS FeatureServer (with wildcard fallback)
- [x] Palm Beach — OpenData ArcGIS MapServer
- [x] Sunbiz — HTML scraper of search.sunbiz.org
- [x] Provider config (`osint` | `licensed` mode toggle)

### Frontend Services
- [x] `services/authService.ts` — register, login, token management
- [x] `services/osintService.ts` — enrichment, intel fetch, recompute, consent revocation
- [x] `services/publicDataService.ts` — direct public record searches
- [x] `services/geminiService.ts` — AI-powered lead discovery

### Dashboard Integration
- [x] OSINT auto-enrichment on lead discovery
- [x] Intel badges (verification status, risk flags, property type)
- [x] OSINT Brief panel (score, confidence %, property profile, sources)
- [x] Enrichment log display in discovery panel

---

## ⬜ Not Yet Built

### Auth & Security
- [x] Auth middleware — protect `/api/leads/*` and `/api/property/*` routes behind JWT verification
- [x] Rate limiting — per-agent request throttling (especially for OSINT providers)
- [x] Password reset / forgot password flow
- [x] License number verification against DBPR API

### Lead Management
- [x] `POST /api/leads` — persist Gemini-discovered leads to D1
- [x] `GET /api/leads` — list agent's leads (paginated, filterable)
- [x] `PUT /api/leads/:id` — update lead status (hot/warm/cold/closed)
- [x] `DELETE /api/leads/:id` — delete a lead
- [x] Lead access logging (compliance audit trail using `lead_access_log` table)

### Agent Features
- [x] `PUT /api/auth/me` — update agent profile / settings
- [x] `GET /api/agents/:id/stats` — lead pipeline metrics (total, by status, by score)
- [x] Agent settings persistence (D1 table or JSON field)
- [x] Multi-county support per agent (currently single county)

### Deployment
- [x] Create D1 database (`wrangler d1 create closr_production`)
- [x] Apply schema (`wrangler d1 execute closr_production --remote --file=./schema.sql`)
- [x] Set secrets (`wrangler secret put JWT_SECRET`, `wrangler secret put GEMINI_API_KEY`)
- [x] Deploy to Cloudflare (`wrangler deploy`) — live at https://closr-api.mahaylabalentine04.workers.dev
- [x] Configure production environment variables (`VITE_API_URL` in `.env.local`)
- [x] Set up custom domain (`api.zuldeira.com`)

### Testing
- [x] Smoke test script for all API endpoints
- [ ] Test OSINT providers against live county APIs
- [ ] Load testing for concurrent enrichment requests
