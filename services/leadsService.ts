/**
 * Leads API Service — Frontend client for lead management
 * Uses authFetch from authService for JWT-authenticated requests
 */

import { authFetch } from './authService';

export interface Lead {
    id: string;
    name: string;
    address: string;
    county: string;
    folio_id?: string;
    case_number?: string;
    source_type: string;
    source_url?: string;
    verification_level: string;
    score: number;
    estimated_equity?: string;
    motivation_trigger?: string;
    discovered_at: number;
    last_accessed: number;
    scoring_factors: Array<{ label: string; impact: string; description: string }>;
}

export interface LeadListResponse {
    leads: Lead[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        total_pages: number;
        has_next: boolean;
        has_prev: boolean;
    };
    filters: Record<string, string | number | null>;
    sort: { field: string; order: string };
}

export interface LeadCreateInput {
    name: string;
    address: string;
    county: string;
    source_type: string;
    verification_level: string;
    score?: number;
    estimated_equity?: string;
    motivation_trigger?: string;
    folio_id?: string;
    case_number?: string;
    source_url?: string;
    scoring_factors?: Array<{ label: string; impact: string; description: string }>;
}

// ─── List leads (paginated, filterable) ─────────────────────
export const fetchLeads = async (params: {
    page?: number;
    limit?: number;
    county?: string;
    verification_level?: string;
    source_type?: string;
    q?: string;
    min_score?: number;
    max_score?: number;
    sort?: string;
    order?: 'asc' | 'desc';
} = {}): Promise<LeadListResponse> => {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
            searchParams.set(key, String(value));
        }
    });

    const response = await authFetch(`/api/leads/?${searchParams.toString()}`);
    return response.json() as Promise<LeadListResponse>;
};

// ─── Get single lead with intel ─────────────────────────────
export const fetchLead = async (id: string): Promise<{ lead: Lead; intel: any }> => {
    const response = await authFetch(`/api/leads/${id}`);
    return response.json() as Promise<{ lead: Lead; intel: any }>;
};

// ─── Create leads (batch) ───────────────────────────────────
export const createLeads = async (leads: LeadCreateInput[]): Promise<{
    success: boolean;
    saved: number;
    leads: Array<{ id: string; name: string; address: string }>;
}> => {
    const response = await authFetch('/api/leads/', {
        method: 'POST',
        body: JSON.stringify({ leads }),
    });
    return response.json() as Promise<any>;
};

// ─── Update a lead ──────────────────────────────────────────
export const updateLead = async (id: string, updates: Partial<Lead>): Promise<{
    success: boolean;
    lead: Lead;
}> => {
    const response = await authFetch(`/api/leads/${id}`, {
        method: 'PUT',
        body: JSON.stringify(updates),
    });
    return response.json() as Promise<any>;
};

// ─── Delete a lead ──────────────────────────────────────────
export const deleteLead = async (id: string): Promise<{ success: boolean }> => {
    const response = await authFetch(`/api/leads/${id}`, {
        method: 'DELETE',
    });
    return response.json() as Promise<any>;
};

// ─── Get lead access history ────────────────────────────────
export const fetchLeadHistory = async (id: string): Promise<{
    lead_id: string;
    history: Array<{ action: string; timestamp: number; date: string }>;
}> => {
    const response = await authFetch(`/api/leads/${id}/history`);
    return response.json() as Promise<any>;
};

// ─── Enrich leads via OSINT ─────────────────────────────────
export const enrichLeads = async (
    leads: Array<{ id: string; name: string; address: string; type?: string }>,
    county: string,
): Promise<any> => {
    const response = await authFetch('/api/leads/enrich', {
        method: 'POST',
        body: JSON.stringify({ leads, county, consent: true }),
    });
    return response.json();
};
