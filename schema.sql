-- Closr Database Schema for Cloudflare D1
-- Run with: wrangler d1 execute closr_production --file=./schema.sql

-- Agent accounts with FL license verification
CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  license_number TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  county TEXT NOT NULL, -- Primary county: Miami-Dade, Broward, Palm Beach
  phone TEXT,
  bio TEXT,
  settings TEXT DEFAULT '{}', -- JSON: notification prefs, display prefs, etc.
  verification_status TEXT DEFAULT 'pending', -- pending, verified, rejected
  verification_notes TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_agents_email ON agents(email);
CREATE INDEX IF NOT EXISTS idx_agents_license ON agents(license_number);
CREATE INDEX IF NOT EXISTS idx_agents_verification ON agents(verification_status);

-- Multi-county support (agents can serve multiple counties)
CREATE TABLE IF NOT EXISTS agent_counties (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  county TEXT NOT NULL, -- Miami-Dade, Broward, Palm Beach
  is_primary INTEGER DEFAULT 0, -- 1 = primary county
  added_at INTEGER NOT NULL,
  FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE,
  UNIQUE(agent_id, county)
);

CREATE INDEX IF NOT EXISTS idx_agent_counties_agent ON agent_counties(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_counties_county ON agent_counties(county);

-- Lead discovery records with verification sources
CREATE TABLE IF NOT EXISTS leads (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  name TEXT,
  address TEXT NOT NULL,
  county TEXT NOT NULL,
  folio_id TEXT, -- Property appraiser parcel ID
  case_number TEXT, -- Court case number for probate/foreclosure
  source_type TEXT NOT NULL, -- probate, permit, high_tenure, foreclosure
  source_url TEXT, -- Direct link to county record
  verification_level TEXT NOT NULL, -- verified_record, high_probability, signal_only
  score INTEGER, -- 0-100 lead quality score
  estimated_equity TEXT,
  motivation_trigger TEXT,
  discovered_at INTEGER NOT NULL,
  last_accessed INTEGER,
  FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_leads_agent ON leads(agent_id);
CREATE INDEX IF NOT EXISTS idx_leads_county ON leads(county);
CREATE INDEX IF NOT EXISTS idx_leads_verification ON leads(verification_level);
CREATE INDEX IF NOT EXISTS idx_leads_discovered ON leads(discovered_at);

-- Scoring factors for lead intelligence
CREATE TABLE IF NOT EXISTS lead_factors (
  id TEXT PRIMARY KEY,
  lead_id TEXT NOT NULL,
  label TEXT NOT NULL, -- "Tenure", "Probate Filing", "Recent Permit"
  impact TEXT NOT NULL, -- high, medium, low
  description TEXT NOT NULL,
  FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_lead_factors_lead ON lead_factors(lead_id);

-- Audit trail for compliance (SRES ethics)
CREATE TABLE IF NOT EXISTS lead_access_log (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  lead_id TEXT NOT NULL,
  action TEXT NOT NULL, -- viewed, verified, exported, contacted
  timestamp INTEGER NOT NULL,
  FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE,
  FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_access_log_agent ON lead_access_log(agent_id);
CREATE INDEX IF NOT EXISTS idx_access_log_lead ON lead_access_log(lead_id);
CREATE INDEX IF NOT EXISTS idx_access_log_timestamp ON lead_access_log(timestamp);

-- Agent sessions for JWT token management
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sessions_agent ON sessions(agent_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

-- ============================================================
-- OSINT Lead Enrichment Module
-- ============================================================

-- Enrichment intel per lead
CREATE TABLE IF NOT EXISTS lead_intel (
  id TEXT PRIMARY KEY,
  lead_id TEXT NOT NULL,
  verification_status TEXT NOT NULL DEFAULT 'unverified', -- unverified, partial_match, strong_match
  lead_score INTEGER DEFAULT 0,
  lead_score_breakdown TEXT DEFAULT '{}', -- JSON
  lead_tags TEXT DEFAULT '[]', -- JSON array
  property_profile TEXT DEFAULT '{}', -- JSON: owner, parcel, assessed value, etc.
  matches TEXT DEFAULT '{}', -- JSON: address_to_parcel_confidence, owner_name_match_confidence, etc.
  risk_flags TEXT DEFAULT '[]', -- JSON array of flag strings
  explanation TEXT,
  sources TEXT DEFAULT '[]', -- JSON array of {source_name, query_params, retrieved_at}
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_lead_intel_lead ON lead_intel(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_intel_verification ON lead_intel(verification_status);
CREATE INDEX IF NOT EXISTS idx_lead_intel_score ON lead_intel(lead_score);

-- Cache for provider lookups (avoids redundant county API calls)
CREATE TABLE IF NOT EXISTS provider_cache (
  id TEXT PRIMARY KEY,
  cache_key TEXT NOT NULL UNIQUE, -- normalized_address:county
  provider TEXT NOT NULL,
  response_data TEXT NOT NULL, -- JSON
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_provider_cache_key ON provider_cache(cache_key);
CREATE INDEX IF NOT EXISTS idx_provider_cache_expires ON provider_cache(expires_at);

-- Password reset tokens (6-digit codes, 15min expiry)
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  reset_code TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_reset_tokens_agent ON password_reset_tokens(agent_id);
CREATE INDEX IF NOT EXISTS idx_reset_tokens_expires ON password_reset_tokens(expires_at);

-- ============================================================
-- Vendor Management Hub
-- ============================================================

CREATE TABLE IF NOT EXISTS vendors (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL, -- mover, estate_sale, attorney, organizer, cleaner
  county TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  website TEXT,
  rating REAL DEFAULT 0,
  is_verified INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_vendors_county ON vendors(county);
CREATE INDEX IF NOT EXISTS idx_vendors_category ON vendors(category);

CREATE TABLE IF NOT EXISTS lead_vendors (
  id TEXT PRIMARY KEY,
  lead_id TEXT NOT NULL,
  vendor_id TEXT NOT NULL,
  status TEXT DEFAULT 'assigned', -- assigned, contacted, booked, completed
  notes TEXT,
  assigned_at INTEGER NOT NULL,
  FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE,
  FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_lead_vendors_lead ON lead_vendors(lead_id);

CREATE TABLE IF NOT EXISTS vendor_tasks (
  id TEXT PRIMARY KEY,
  lead_vendor_id TEXT NOT NULL,
  description TEXT NOT NULL,
  is_completed INTEGER DEFAULT 0,
  due_date INTEGER,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (lead_vendor_id) REFERENCES lead_vendors(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_vendor_tasks_assignment ON vendor_tasks(lead_vendor_id);

