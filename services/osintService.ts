/**
 * OSINT Enrichment Frontend Service
 * Calls the backend enrichment API from the AgentDashboard.
 */

import { Lead } from '../types';

const API_BASE = import.meta.env.VITE_API_URL || '';

export interface LeadIntel {
    verification_status: 'unverified' | 'partial_match' | 'strong_match';
    lead_score: number;
    lead_score_breakdown: {
        address_parcel_resolved: number;
        owner_name_match: number;
        mailing_match: number;
        entity_investor_bonus: number;
        contact_deliverable: number;
        no_parcel_penalty: number;
        mismatch_penalty: number;
        missing_fields_penalty: number;
        raw_total: number;
    };
    property_profile: {
        parcel_id: string;
        owner_name: string;
        mailing_address: string;
        property_address: string;
        property_type: string;
        last_sale_date: string;
        last_sale_price: number;
        assessed_value: number;
        market_value: number;
        homestead: boolean;
        year_built: number;
        sqft: number;
        source_url: string;
    } | null;
    entity_profile: {
        entity_name: string;
        entity_type: string;
        status: string;
        filing_number: string;
        registered_agent: string;
        principal_address: string;
        source_url: string;
    } | null;
    matches: {
        verification_status: string;
        address_to_parcel_confidence: number;
        owner_name_match_confidence: number;
        mailing_address_match: string;
        owner_type: string;
        flags: string[];
    };
    risk_flags: string[];
    explanation: string;
    sources: Array<{
        source_name: string;
        query_params: Record<string, string>;
        retrieved_at: string;
    }>;
}

export interface EnrichedLead extends Lead {
    intel?: LeadIntel;
}

export interface EnrichmentResponse {
    enriched: Array<{
        id: string;
        name: string;
        address: string;
        type?: string;
        intel: LeadIntel;
    }>;
    meta: {
        total: number;
        verified: number;
        partial: number;
        unverified: number;
        county: string;
        timestamp: string;
    };
}

/**
 * Send discovered leads to the OSINT enrichment pipeline.
 */
export async function enrichDiscoveredLeads(leads: Lead[], county: string): Promise<EnrichmentResponse> {
    const payload = {
        leads: leads.map(l => ({
            id: l.id,
            name: l.name,
            address: l.address,
            type: l.type,
            phone: l.phone,
            email: l.email,
        })),
        county,
        consent: true,
    };

    const response = await fetch(`${API_BASE}/api/leads/enrich`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        throw new Error(`Enrichment failed: ${response.statusText}`);
    }

    return response.json();
}

/**
 * Get stored intel for a specific lead.
 */
export async function getLeadIntel(leadId: string): Promise<LeadIntel | null> {
    const response = await fetch(`${API_BASE}/api/leads/${leadId}/intel`);
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`Failed to get intel: ${response.statusText}`);
    return response.json();
}

/**
 * Re-run enrichment for a specific lead.
 */
export async function recomputeLeadIntel(leadId: string, county: string): Promise<LeadIntel> {
    const response = await fetch(`${API_BASE}/api/leads/${leadId}/intel/recompute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ county }),
    });

    if (!response.ok) throw new Error(`Recompute failed: ${response.statusText}`);
    const data = await response.json() as { intel: LeadIntel };
    return data.intel;
}

/**
 * Revoke consent and delete all enrichment data.
 */
export async function revokeLeadConsent(leadId: string): Promise<void> {
    await fetch(`${API_BASE}/api/leads/${leadId}/consent`, { method: 'DELETE' });
}
