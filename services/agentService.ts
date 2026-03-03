/**
 * Agent API Service — Frontend client for profile, stats, multi-county
 * Uses authFetch from authService for JWT-authenticated requests
 */

import { authFetch } from './authService';

export interface AgentProfile {
    id: string;
    email: string;
    name: string;
    phone?: string;
    bio?: string;
    county: string;
    counties: Array<{ county: string; is_primary: number }>;
    settings: AgentSettings;
    licenseNumber: string;
    verificationStatus: string;
    createdAt: number;
    updatedAt: number;
}

export interface AgentSettings {
    notifications_enabled?: boolean;
    email_digest?: 'daily' | 'weekly' | 'none';
    lead_auto_enrich?: boolean;
    default_sort?: string;
    theme?: 'light' | 'dark' | 'system';
}

export interface AgentStats {
    agent_id: string;
    overview: { total_leads: number; avg_score: number; leads_last_7_days: number };
    pipeline: { hot: number; warm: number; cool: number; cold: number };
    by_verification: Record<string, number>;
    by_source: Record<string, number>;
    by_county: Record<string, number>;
    enrichment: {
        total_enriched: number;
        strong_matches: number;
        partial_matches: number;
        avg_osint_score: number;
    };
    recent_activity: Record<string, number>;
    top_leads: Array<{
        id: string;
        name: string;
        address: string;
        county: string;
        score: number;
        verification_level: string;
        source_type: string;
    }>;
    generated_at: string;
}

// ─── Update profile ─────────────────────────────────────────
export const updateProfile = async (updates: {
    name?: string;
    email?: string;
    phone?: string;
    bio?: string;
    county?: string;
    currentPassword?: string;
    newPassword?: string;
    settings?: Partial<AgentSettings>;
}): Promise<{ success: boolean; agent: AgentProfile }> => {
    const response = await authFetch('/api/agents/me', {
        method: 'PUT',
        body: JSON.stringify(updates),
    });
    return response.json() as Promise<any>;
};

// ─── Get pipeline stats ─────────────────────────────────────
export const fetchStats = async (): Promise<AgentStats> => {
    const response = await authFetch('/api/agents/me/stats');
    return response.json() as Promise<AgentStats>;
};

// ─── Add county ─────────────────────────────────────────────
export const addCounty = async (county: string, isPrimary = false): Promise<{
    success: boolean;
    counties: Array<{ county: string; is_primary: number; added_at: number }>;
}> => {
    const response = await authFetch('/api/agents/me/counties', {
        method: 'POST',
        body: JSON.stringify({ county, is_primary: isPrimary }),
    });
    return response.json() as Promise<any>;
};

// ─── Remove county ──────────────────────────────────────────
export const removeCounty = async (county: string): Promise<{
    success: boolean;
    counties: Array<{ county: string; is_primary: number; added_at: number }>;
}> => {
    const response = await authFetch(`/api/agents/me/counties/${encodeURIComponent(county)}`, {
        method: 'DELETE',
    });
    return response.json() as Promise<any>;
};
