/// <reference types="@cloudflare/workers-types" />

/**
 * Lead Intel Service — OSINT Enrichment Orchestrator
 * Runs the full enrichment pipeline for discovered leads:
 * 1. Normalize address → determine county
 * 2. Check cache → fetch from county provider if miss
 * 3. Detect entity → Sunbiz lookup if applicable
 * 4. Run match engine → verification status + flags
 * 5. Compute score → breakdown
 * 6. Persist to D1 lead_intel table
 * 7. Return enriched results
 */

import { Env } from '../env';
import { LeadIntelResult, PropertyRecord, EntityRecord, EnrichmentSource } from '../providers/types';
import { getProviderForCounty, getEntityProvider, getProviderConfig, isSupportedCounty } from '../providers/config';
import { normalizeAddress, isEntityName, matchLeadToProperty } from './match_engine';
import { computeLeadScore, explainScore } from './scoring_engine';

// ─── CACHE HELPERS ──────────────────────────────────────────

async function getCachedLookup(db: D1Database, cacheKey: string): Promise<PropertyRecord | null> {
    const row = await db.prepare(
        'SELECT response_data FROM provider_cache WHERE cache_key = ? AND expires_at > ?'
    ).bind(cacheKey, Date.now()).first<{ response_data: string }>();

    if (row) {
        try { return JSON.parse(row.response_data); } catch { return null; }
    }
    return null;
}

async function setCachedLookup(db: D1Database, cacheKey: string, provider: string, data: PropertyRecord, expirySeconds: number): Promise<void> {
    const id = crypto.randomUUID();
    await db.prepare(
        'INSERT OR REPLACE INTO provider_cache (id, cache_key, provider, response_data, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(id, cacheKey, provider, JSON.stringify(data), Date.now(), Date.now() + expirySeconds * 1000).run();
}

// ─── SINGLE LEAD ENRICHMENT ─────────────────────────────────

interface LeadInput {
    id: string;
    name: string;
    address: string;
    type?: string;       // seller, buyer, investor
    phone?: string;
    email?: string;
}

export async function enrichSingleLead(
    lead: LeadInput,
    county: string,
    db: D1Database,
    apiKey?: string
): Promise<LeadIntelResult> {
    const sources: EnrichmentSource[] = [];
    const normalizedAddr = normalizeAddress(lead.address);

    // Step 1: County provider lookup (with cache)
    let propertyRecord: PropertyRecord | null = null;

    if (isSupportedCounty(county)) {
        const cacheKey = `${normalizedAddr}:${county}`;
        const config = getProviderConfig(county);

        // Check cache first
        propertyRecord = await getCachedLookup(db, cacheKey);

        if (!propertyRecord) {
            const provider = getProviderForCounty(county);
            propertyRecord = await provider.lookupByAddress(normalizedAddr, apiKey);

            sources.push({
                source_name: `${county} Property Appraiser`,
                query_params: { address: normalizedAddr, county },
                retrieved_at: new Date().toISOString(),
            });

            // Cache the result
            if (propertyRecord) {
                await setCachedLookup(db, cacheKey, county, propertyRecord, config.cacheExpirySeconds);
            }
        } else {
            sources.push({
                source_name: `${county} Property Appraiser (cached)`,
                query_params: { address: normalizedAddr, county },
                retrieved_at: new Date().toISOString(),
            });
        }
    }

    // Step 2: Entity detection + Sunbiz lookup
    let entityRecord: EntityRecord | null = null;
    const ownerName = propertyRecord?.owner_name || lead.name;

    if (isEntityName(ownerName)) {
        const entityProvider = getEntityProvider();
        entityRecord = await entityProvider.lookupByName(ownerName);

        sources.push({
            source_name: 'Florida Sunbiz (Division of Corporations)',
            query_params: { entity_name: ownerName },
            retrieved_at: new Date().toISOString(),
        });
    }

    // Step 3: Match engine
    const matchResult = matchLeadToProperty(
        { name: lead.name, address: lead.address, type: lead.type },
        propertyRecord,
        entityRecord
    );

    // Step 4: Scoring
    const missingFields: string[] = [];
    if (!lead.phone && !lead.email) missingFields.push('contact_info');
    if (!lead.name) missingFields.push('name');

    const scoreResult = computeLeadScore({
        matchResult,
        leadType: lead.type,
        contactDeliverable: false, // TODO: Integrate contact validation API
        missingFields,
    });

    // Step 5: Build explanation
    const explanation = explainScore(scoreResult, matchResult);

    // Step 6: Build risk flags
    const riskFlags = [...matchResult.flags];
    if (scoreResult.score < 30) riskFlags.push('low_confidence_lead');
    if (propertyRecord && (2025 - (propertyRecord.year_built || 2025)) > 40) {
        riskFlags.push('aging_structure');
    }

    return {
        verification_status: matchResult.verification_status,
        lead_score: scoreResult.score,
        lead_score_breakdown: scoreResult.breakdown,
        property_profile: propertyRecord,
        entity_profile: entityRecord,
        matches: matchResult,
        risk_flags: riskFlags,
        explanation,
        sources,
    };
}

// ─── BATCH ENRICHMENT ───────────────────────────────────────

export async function enrichLeads(
    leads: LeadInput[],
    county: string,
    env: Env
): Promise<Array<LeadInput & { intel: LeadIntelResult }>> {
    const results: Array<LeadInput & { intel: LeadIntelResult }> = [];

    for (const lead of leads) {
        try {
            const intel = await enrichSingleLead(lead, county, env.DB, env.GEMINI_API_KEY);

            // Persist to D1
            const intelId = crypto.randomUUID();
            const now = Date.now();

            await env.DB.prepare(`
        INSERT OR REPLACE INTO lead_intel
        (id, lead_id, verification_status, lead_score, lead_score_breakdown, lead_tags, property_profile, matches, risk_flags, explanation, sources, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
                intelId,
                lead.id,
                intel.verification_status,
                intel.lead_score,
                JSON.stringify(intel.lead_score_breakdown),
                JSON.stringify(intel.risk_flags),
                JSON.stringify(intel.property_profile),
                JSON.stringify(intel.matches),
                JSON.stringify(intel.risk_flags),
                intel.explanation,
                JSON.stringify(intel.sources),
                now,
                now
            ).run();

            results.push({ ...lead, intel });
        } catch (err) {
            console.error(`Enrichment failed for lead ${lead.id}:`, err);
            // Return unenriched lead with error intel
            results.push({
                ...lead,
                intel: {
                    verification_status: 'unverified',
                    lead_score: 0,
                    lead_score_breakdown: {
                        address_parcel_resolved: 0, owner_name_match: 0, mailing_match: 0,
                        entity_investor_bonus: 0, contact_deliverable: 0, no_parcel_penalty: 0,
                        mismatch_penalty: 0, missing_fields_penalty: 0, raw_total: 0,
                    },
                    property_profile: null,
                    entity_profile: null,
                    matches: {
                        verification_status: 'unverified',
                        address_to_parcel_confidence: 0,
                        owner_name_match_confidence: 0,
                        mailing_address_match: 'unknown',
                        owner_type: 'individual',
                        flags: ['enrichment_error'],
                    },
                    risk_flags: ['enrichment_error'],
                    explanation: `Enrichment failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
                    sources: [],
                },
            });
        }
    }

    return results;
}

// ─── RECOMPUTE ──────────────────────────────────────────────

export async function recomputeIntel(leadId: string, county: string, env: Env): Promise<LeadIntelResult | null> {
    // Fetch existing lead data
    const lead = await env.DB.prepare('SELECT * FROM leads WHERE id = ?').bind(leadId).first<any>();
    if (!lead) return null;

    // Delete old intel
    await env.DB.prepare('DELETE FROM lead_intel WHERE lead_id = ?').bind(leadId).run();

    // Re-enrich
    const intel = await enrichSingleLead(
        { id: lead.id, name: lead.name || '', address: lead.address, type: lead.source_type },
        county,
        env.DB,
        env.GEMINI_API_KEY
    );

    // Persist new intel
    const intelId = crypto.randomUUID();
    const now = Date.now();
    await env.DB.prepare(`
    INSERT INTO lead_intel
    (id, lead_id, verification_status, lead_score, lead_score_breakdown, lead_tags, property_profile, matches, risk_flags, explanation, sources, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
        intelId, leadId, intel.verification_status, intel.lead_score,
        JSON.stringify(intel.lead_score_breakdown), JSON.stringify(intel.risk_flags),
        JSON.stringify(intel.property_profile), JSON.stringify(intel.matches),
        JSON.stringify(intel.risk_flags), intel.explanation, JSON.stringify(intel.sources),
        now, now
    ).run();

    return intel;
}

// ─── CONSENT REVOCATION ─────────────────────────────────────

export async function revokeConsent(leadId: string, db: D1Database): Promise<boolean> {
    await db.prepare('DELETE FROM lead_intel WHERE lead_id = ?').bind(leadId).run();
    await db.prepare('DELETE FROM provider_cache WHERE cache_key LIKE ?').bind(`%${leadId}%`).run();
    return true;
}
