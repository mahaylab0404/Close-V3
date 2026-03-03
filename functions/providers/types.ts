/**
 * OSINT Provider Type Definitions
 * Common interfaces for all county property providers and entity lookups
 */

// Normalized property record returned by all county providers
export interface PropertyRecord {
    parcel_id: string;          // Folio number / parcel ID
    owner_name: string;
    mailing_address: string;
    property_address: string;
    property_type: string;      // SFH, Condo, Townhouse, Multi-Family, Vacant
    last_sale_date: string;     // ISO date string
    last_sale_price: number;
    assessed_value: number;
    market_value: number;
    homestead: boolean;
    year_built: number;
    bedrooms: number;
    bathrooms: number;
    sqft: number;
    legal_description: string;
    source_url: string;         // Direct link to county record
    retrieved_at: string;       // ISO timestamp
}

// Entity record from Sunbiz
export interface EntityRecord {
    entity_name: string;
    entity_type: string;        // LLC, INC, CORP, LP, TRUST
    status: string;             // Active, Inactive, Dissolved
    filing_number: string;
    filing_date: string;
    registered_agent: string;
    principal_address: string;
    mailing_address: string;
    source_url: string;
    retrieved_at: string;
}

// Match result from the match engine
export interface MatchResult {
    verification_status: 'unverified' | 'partial_match' | 'strong_match';
    address_to_parcel_confidence: number;   // 0–1
    owner_name_match_confidence: number;    // 0–1
    mailing_address_match: 'yes' | 'no' | 'unknown';
    owner_type: 'individual' | 'entity';
    flags: string[];
}

// Score result from the scoring engine
export interface ScoreResult {
    score: number;              // 0–100
    breakdown: ScoreBreakdown;
}

export interface ScoreBreakdown {
    address_parcel_resolved: number;
    owner_name_match: number;
    mailing_match: number;
    entity_investor_bonus: number;
    contact_deliverable: number;
    no_parcel_penalty: number;
    mismatch_penalty: number;
    missing_fields_penalty: number;
    raw_total: number;
}

// Enrichment source audit trail
export interface EnrichmentSource {
    source_name: string;
    query_params: Record<string, string>;
    retrieved_at: string;
}

// Complete enrichment result for a single lead
export interface LeadIntelResult {
    verification_status: MatchResult['verification_status'];
    lead_score: number;
    lead_score_breakdown: ScoreBreakdown;
    property_profile: PropertyRecord | null;
    entity_profile: EntityRecord | null;
    matches: MatchResult;
    risk_flags: string[];
    explanation: string;
    sources: EnrichmentSource[];
}

// Provider interface — all county adapters must implement this
export interface PropertyProvider {
    county: string;
    lookupByAddress(normalizedAddress: string, apiKey?: string): Promise<PropertyRecord | null>;
    lookupByParcel(parcelId: string): Promise<PropertyRecord | null>;
}

// Entity provider interface
export interface EntityProvider {
    lookupByName(entityName: string): Promise<EntityRecord | null>;
}

// Provider configuration
export interface ProviderConfig {
    mode: 'osint' | 'licensed';
    rateLimitPerMinute: number;
    cacheExpirySeconds: number;
    publicApiUrl?: string;      // Free government ArcGIS / public endpoint
    licensedApiUrl?: string;
    licensedApiKey?: string;
}
