/**
 * Lead API Routes — CRUD + OSINT Enrichment Endpoints
 * Full lead lifecycle management with compliance audit trail.
 */

import { Router } from 'itty-router';
import { Env } from '../env';
import { enrichLeads, recomputeIntel, revokeConsent } from '../enrichment/lead_intel_service';

const router = Router();

// ─── Helper: log lead access for SRES compliance ────────────
async function logAccess(db: D1Database, agentId: string, leadId: string, action: string): Promise<void> {
    try {
        await db.prepare(
            'INSERT INTO lead_access_log (id, agent_id, lead_id, action, timestamp) VALUES (?, ?, ?, ?, ?)'
        ).bind(crypto.randomUUID(), agentId, leadId, action, Date.now()).run();
    } catch (err) {
        console.error('Access log write failed:', err);
    }
}

// ═══════════════════════════════════════════════════════════════
//  LEAD CRUD
// ═══════════════════════════════════════════════════════════════

// ─── POST /api/leads ────────────────────────────────────────
// Persist one or more Gemini-discovered leads to D1
router.post('/api/leads', async (request: Request, env: Env) => {
    try {
        const agentId = (request as any).agentId;
        if (!agentId) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), {
                status: 401, headers: { 'Content-Type': 'application/json' },
            });
        }

        const body = await request.json() as {
            leads: Array<{
                id?: string;
                name: string;
                address: string;
                county: string;
                folio_id?: string;
                case_number?: string;
                source_type: string;      // probate, permit, high_tenure, foreclosure
                source_url?: string;
                verification_level: string; // verified_record, high_probability, signal_only
                score?: number;
                estimated_equity?: string;
                motivation_trigger?: string;
                phone?: string;
                email?: string;
                type?: string;             // seller, buyer, investor
                scoring_factors?: Array<{ label: string; impact: string; description: string }>;
            }>;
        };

        if (!body.leads || !Array.isArray(body.leads) || body.leads.length === 0) {
            return new Response(JSON.stringify({ error: 'leads array is required and must not be empty' }), {
                status: 400, headers: { 'Content-Type': 'application/json' },
            });
        }

        const now = Date.now();
        const saved: Array<{ id: string; name: string; address: string }> = [];

        for (const lead of body.leads) {
            const leadId = lead.id || crypto.randomUUID();

            await env.DB.prepare(
                `INSERT INTO leads (id, agent_id, name, address, county, folio_id, case_number, source_type, source_url, verification_level, score, estimated_equity, motivation_trigger, discovered_at, last_accessed)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
            ).bind(
                leadId, agentId, lead.name, lead.address, lead.county,
                lead.folio_id || null, lead.case_number || null,
                lead.source_type, lead.source_url || null,
                lead.verification_level, lead.score || 0,
                lead.estimated_equity || null, lead.motivation_trigger || null,
                now, now
            ).run();

            // Persist scoring factors
            if (lead.scoring_factors && lead.scoring_factors.length > 0) {
                for (const factor of lead.scoring_factors) {
                    await env.DB.prepare(
                        'INSERT INTO lead_factors (id, lead_id, label, impact, description) VALUES (?, ?, ?, ?, ?)'
                    ).bind(crypto.randomUUID(), leadId, factor.label, factor.impact, factor.description).run();
                }
            }

            // Audit trail
            await logAccess(env.DB, agentId, leadId, 'created');
            saved.push({ id: leadId, name: lead.name, address: lead.address });
        }

        return new Response(JSON.stringify({
            success: true,
            saved: saved.length,
            leads: saved,
        }), {
            status: 201,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (err) {
        console.error('Lead persist error:', err);
        return new Response(JSON.stringify({
            error: 'Failed to save leads',
            message: err instanceof Error ? err.message : 'Unknown error',
        }), {
            status: 500, headers: { 'Content-Type': 'application/json' },
        });
    }
});

// ─── GET /api/leads ─────────────────────────────────────────
// List agent's leads — paginated, filterable, sortable
// Query params: page, limit, status, county, verification_level, sort, order, q (search)
router.get('/api/leads', async (request: Request, env: Env) => {
    try {
        const agentId = (request as any).agentId;
        if (!agentId) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), {
                status: 401, headers: { 'Content-Type': 'application/json' },
            });
        }

        const url = new URL(request.url);
        const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
        const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '25')));
        const offset = (page - 1) * limit;

        // Filters
        const county = url.searchParams.get('county');
        const verificationLevel = url.searchParams.get('verification_level');
        const sourceType = url.searchParams.get('source_type');
        const search = url.searchParams.get('q');
        const minScore = url.searchParams.get('min_score');
        const maxScore = url.searchParams.get('max_score');

        // Sort
        const validSortFields = ['score', 'discovered_at', 'name', 'county', 'verification_level'];
        const sortField = validSortFields.includes(url.searchParams.get('sort') || '')
            ? url.searchParams.get('sort')!
            : 'discovered_at';
        const sortOrder = (url.searchParams.get('order') || 'desc').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

        // Build WHERE clause
        let where = 'WHERE agent_id = ?';
        const bindings: any[] = [agentId];

        if (county) {
            where += ' AND county = ?';
            bindings.push(county);
        }
        if (verificationLevel) {
            where += ' AND verification_level = ?';
            bindings.push(verificationLevel);
        }
        if (sourceType) {
            where += ' AND source_type = ?';
            bindings.push(sourceType);
        }
        if (search) {
            where += ' AND (name LIKE ? OR address LIKE ?)';
            bindings.push(`%${search}%`, `%${search}%`);
        }
        if (minScore) {
            where += ' AND score >= ?';
            bindings.push(parseInt(minScore));
        }
        if (maxScore) {
            where += ' AND score <= ?';
            bindings.push(parseInt(maxScore));
        }

        // Count total
        const countResult = await env.DB.prepare(
            `SELECT COUNT(*) as total FROM leads ${where}`
        ).bind(...bindings).first<{ total: number }>();
        const total = countResult?.total || 0;

        // Fetch page
        const leadsResult = await env.DB.prepare(
            `SELECT * FROM leads ${where} ORDER BY ${sortField} ${sortOrder} LIMIT ? OFFSET ?`
        ).bind(...bindings, limit, offset).all<any>();

        const leads = leadsResult?.results || [];

        // Fetch scoring factors for each lead
        const leadsWithFactors = await Promise.all(leads.map(async (lead: any) => {
            const factors = await env.DB.prepare(
                'SELECT label, impact, description FROM lead_factors WHERE lead_id = ?'
            ).bind(lead.id).all<any>();

            return {
                id: lead.id,
                name: lead.name,
                address: lead.address,
                county: lead.county,
                folio_id: lead.folio_id,
                case_number: lead.case_number,
                source_type: lead.source_type,
                source_url: lead.source_url,
                verification_level: lead.verification_level,
                score: lead.score,
                estimated_equity: lead.estimated_equity,
                motivation_trigger: lead.motivation_trigger,
                discovered_at: lead.discovered_at,
                last_accessed: lead.last_accessed,
                scoring_factors: factors?.results || [],
            };
        }));

        return new Response(JSON.stringify({
            leads: leadsWithFactors,
            pagination: {
                page,
                limit,
                total,
                total_pages: Math.ceil(total / limit),
                has_next: page * limit < total,
                has_prev: page > 1,
            },
            filters: {
                county: county || null,
                verification_level: verificationLevel || null,
                source_type: sourceType || null,
                search: search || null,
                min_score: minScore ? parseInt(minScore) : null,
                max_score: maxScore ? parseInt(maxScore) : null,
            },
            sort: { field: sortField, order: sortOrder },
        }), {
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (err) {
        console.error('Lead list error:', err);
        return new Response(JSON.stringify({ error: 'Failed to list leads' }), {
            status: 500, headers: { 'Content-Type': 'application/json' },
        });
    }
});

// ─── GET /api/leads/:id ─────────────────────────────────────
// Get a single lead with its scoring factors and intel
router.get('/api/leads/:id', async (request: Request & { params: { id: string } }, env: Env) => {
    try {
        const agentId = (request as any).agentId;
        const leadId = request.params.id;

        // Skip sub-routes handled below
        if (leadId === 'enrich' || leadId === 'discover') return;

        const lead = await env.DB.prepare(
            'SELECT * FROM leads WHERE id = ? AND agent_id = ?'
        ).bind(leadId, agentId).first<any>();

        if (!lead) {
            return new Response(JSON.stringify({ error: 'Lead not found' }), {
                status: 404, headers: { 'Content-Type': 'application/json' },
            });
        }

        // Fetch factors
        const factors = await env.DB.prepare(
            'SELECT label, impact, description FROM lead_factors WHERE lead_id = ?'
        ).bind(leadId).all<any>();

        // Fetch intel
        const intel = await env.DB.prepare(
            'SELECT * FROM lead_intel WHERE lead_id = ? ORDER BY updated_at DESC LIMIT 1'
        ).bind(leadId).first<any>();

        // Log access
        await logAccess(env.DB, agentId, leadId, 'viewed');

        // Update last_accessed
        await env.DB.prepare(
            'UPDATE leads SET last_accessed = ? WHERE id = ?'
        ).bind(Date.now(), leadId).run();

        return new Response(JSON.stringify({
            lead: {
                ...lead,
                scoring_factors: factors?.results || [],
            },
            intel: intel ? {
                verification_status: intel.verification_status,
                lead_score: intel.lead_score,
                lead_score_breakdown: JSON.parse(intel.lead_score_breakdown || '{}'),
                property_profile: JSON.parse(intel.property_profile || '{}'),
                matches: JSON.parse(intel.matches || '{}'),
                risk_flags: JSON.parse(intel.risk_flags || '[]'),
                explanation: intel.explanation,
                sources: JSON.parse(intel.sources || '[]'),
            } : null,
        }), {
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (err) {
        console.error('Lead get error:', err);
        return new Response(JSON.stringify({ error: 'Failed to get lead' }), {
            status: 500, headers: { 'Content-Type': 'application/json' },
        });
    }
});

// ─── PUT /api/leads/:id ─────────────────────────────────────
// Update lead — status, score, verification level, notes
router.put('/api/leads/:id', async (request: Request & { params: { id: string } }, env: Env) => {
    try {
        const agentId = (request as any).agentId;
        const leadId = request.params.id;

        // Verify ownership
        const existing = await env.DB.prepare(
            'SELECT id FROM leads WHERE id = ? AND agent_id = ?'
        ).bind(leadId, agentId).first();

        if (!existing) {
            return new Response(JSON.stringify({ error: 'Lead not found' }), {
                status: 404, headers: { 'Content-Type': 'application/json' },
            });
        }

        const body = await request.json() as {
            verification_level?: string;
            score?: number;
            estimated_equity?: string;
            motivation_trigger?: string;
            name?: string;
            address?: string;
            folio_id?: string;
            case_number?: string;
            source_type?: string;
            source_url?: string;
        };

        // Build dynamic UPDATE
        const updates: string[] = [];
        const values: any[] = [];

        const allowedFields: Record<string, string> = {
            verification_level: 'verification_level',
            score: 'score',
            estimated_equity: 'estimated_equity',
            motivation_trigger: 'motivation_trigger',
            name: 'name',
            address: 'address',
            folio_id: 'folio_id',
            case_number: 'case_number',
            source_type: 'source_type',
            source_url: 'source_url',
        };

        for (const [key, column] of Object.entries(allowedFields)) {
            if ((body as any)[key] !== undefined) {
                updates.push(`${column} = ?`);
                values.push((body as any)[key]);
            }
        }

        if (updates.length === 0) {
            return new Response(JSON.stringify({ error: 'No fields to update' }), {
                status: 400, headers: { 'Content-Type': 'application/json' },
            });
        }

        // Always update last_accessed
        updates.push('last_accessed = ?');
        values.push(Date.now());

        await env.DB.prepare(
            `UPDATE leads SET ${updates.join(', ')} WHERE id = ? AND agent_id = ?`
        ).bind(...values, leadId, agentId).run();

        // Log the update
        await logAccess(env.DB, agentId, leadId, 'updated');

        // Return updated lead
        const updated = await env.DB.prepare(
            'SELECT * FROM leads WHERE id = ?'
        ).bind(leadId).first<any>();

        return new Response(JSON.stringify({
            success: true,
            lead: updated,
        }), {
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (err) {
        console.error('Lead update error:', err);
        return new Response(JSON.stringify({ error: 'Failed to update lead' }), {
            status: 500, headers: { 'Content-Type': 'application/json' },
        });
    }
});

// ─── DELETE /api/leads/:id ──────────────────────────────────
// Delete a lead and all associated data (factors, intel, access logs)
router.delete('/api/leads/:id', async (request: Request & { params: { id: string } }, env: Env) => {
    try {
        const agentId = (request as any).agentId;
        const leadId = request.params.id;

        // Verify ownership
        const existing = await env.DB.prepare(
            'SELECT id FROM leads WHERE id = ? AND agent_id = ?'
        ).bind(leadId, agentId).first();

        if (!existing) {
            return new Response(JSON.stringify({ error: 'Lead not found' }), {
                status: 404, headers: { 'Content-Type': 'application/json' },
            });
        }

        // Log before deletion
        await logAccess(env.DB, agentId, leadId, 'deleted');

        // Cascade delete — factors, intel, and the lead itself
        // (Foreign key ON DELETE CASCADE handles lead_factors, lead_intel, lead_access_log)
        await env.DB.prepare('DELETE FROM lead_factors WHERE lead_id = ?').bind(leadId).run();
        await env.DB.prepare('DELETE FROM lead_intel WHERE lead_id = ?').bind(leadId).run();
        await env.DB.prepare('DELETE FROM leads WHERE id = ? AND agent_id = ?').bind(leadId, agentId).run();

        return new Response(JSON.stringify({
            success: true,
            message: 'Lead and all associated data deleted.',
            lead_id: leadId,
        }), {
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (err) {
        console.error('Lead delete error:', err);
        return new Response(JSON.stringify({ error: 'Failed to delete lead' }), {
            status: 500, headers: { 'Content-Type': 'application/json' },
        });
    }
});

// ─── GET /api/leads/:id/history ─────────────────────────────
// Get access history for a lead (compliance / SRES audit trail)
router.get('/api/leads/:id/history', async (request: Request & { params: { id: string } }, env: Env) => {
    try {
        const agentId = (request as any).agentId;
        const leadId = request.params.id;

        // Verify ownership
        const existing = await env.DB.prepare(
            'SELECT id FROM leads WHERE id = ? AND agent_id = ?'
        ).bind(leadId, agentId).first();

        if (!existing) {
            return new Response(JSON.stringify({ error: 'Lead not found' }), {
                status: 404, headers: { 'Content-Type': 'application/json' },
            });
        }

        const history = await env.DB.prepare(
            'SELECT action, timestamp FROM lead_access_log WHERE lead_id = ? ORDER BY timestamp DESC LIMIT 100'
        ).bind(leadId).all<any>();

        return new Response(JSON.stringify({
            lead_id: leadId,
            history: (history?.results || []).map((h: any) => ({
                action: h.action,
                timestamp: h.timestamp,
                date: new Date(h.timestamp).toISOString(),
            })),
        }), {
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (err) {
        console.error('Lead history error:', err);
        return new Response(JSON.stringify({ error: 'Failed to get history' }), {
            status: 500, headers: { 'Content-Type': 'application/json' },
        });
    }
});

// ═══════════════════════════════════════════════════════════════
//  OSINT ENRICHMENT ENDPOINTS (existing)
// ═══════════════════════════════════════════════════════════════

// ─── POST /api/leads/enrich ─────────────────────────────────
// Accepts raw leads from Gemini discovery, enriches them via OSINT pipeline
router.post('/api/leads/enrich', async (request: Request, env: Env) => {
    try {
        const body = await request.json() as {
            leads: Array<{ id: string; name: string; address: string; type?: string; phone?: string; email?: string }>;
            county: string;
            consent?: boolean;
        };

        if (!body.leads || !body.county) {
            return new Response(JSON.stringify({ error: 'Missing required fields: leads, county' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // Consent guardrail
        if (body.consent === false) {
            return new Response(JSON.stringify({
                error: 'Enrichment requires consent=true. Leads were not processed.',
                leads: body.leads,
            }), {
                status: 403,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const enrichedLeads = await enrichLeads(body.leads, body.county, env);

        // Log enrichment access
        const agentId = (request as any).agentId;
        if (agentId) {
            for (const lead of enrichedLeads) {
                await logAccess(env.DB, agentId, lead.id, 'enriched');
            }
        }

        return new Response(JSON.stringify({
            enriched: enrichedLeads,
            meta: {
                total: enrichedLeads.length,
                verified: enrichedLeads.filter(l => l.intel.verification_status === 'strong_match').length,
                partial: enrichedLeads.filter(l => l.intel.verification_status === 'partial_match').length,
                unverified: enrichedLeads.filter(l => l.intel.verification_status === 'unverified').length,
                county: body.county,
                timestamp: new Date().toISOString(),
            },
        }), {
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (err) {
        console.error('Enrichment error:', err);
        return new Response(JSON.stringify({
            error: 'Enrichment pipeline failed',
            message: err instanceof Error ? err.message : 'Unknown error',
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
});

// ─── GET /api/leads/:id/intel ───────────────────────────────
// Returns stored enrichment intel for a specific lead
router.get('/api/leads/:id/intel', async (request: Request & { params: { id: string } }, env: Env) => {
    const leadId = request.params.id;

    const intel = await env.DB.prepare(
        'SELECT * FROM lead_intel WHERE lead_id = ? ORDER BY updated_at DESC LIMIT 1'
    ).bind(leadId).first<any>();

    if (!intel) {
        return new Response(JSON.stringify({ error: 'No intel found for this lead', lead_id: leadId }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    return new Response(JSON.stringify({
        lead_id: leadId,
        verification_status: intel.verification_status,
        lead_score: intel.lead_score,
        lead_score_breakdown: JSON.parse(intel.lead_score_breakdown || '{}'),
        property_profile: JSON.parse(intel.property_profile || '{}'),
        matches: JSON.parse(intel.matches || '{}'),
        risk_flags: JSON.parse(intel.risk_flags || '[]'),
        explanation: intel.explanation,
        sources: JSON.parse(intel.sources || '[]'),
        updated_at: intel.updated_at,
    }), {
        headers: { 'Content-Type': 'application/json' },
    });
});

// ─── POST /api/leads/:id/intel/recompute ────────────────────
// Re-run enrichment for a specific lead
router.post('/api/leads/:id/intel/recompute', async (request: Request & { params: { id: string } }, env: Env) => {
    const leadId = request.params.id;

    const body = await request.json() as { county: string };
    if (!body.county) {
        return new Response(JSON.stringify({ error: 'county is required' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    const intel = await recomputeIntel(leadId, body.county, env);

    if (!intel) {
        return new Response(JSON.stringify({ error: 'Lead not found', lead_id: leadId }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    return new Response(JSON.stringify({ lead_id: leadId, intel }), {
        headers: { 'Content-Type': 'application/json' },
    });
});

// ─── DELETE /api/leads/:id/consent ──────────────────────────
// Revoke consent — deletes all lead_intel and cached data
router.delete('/api/leads/:id/consent', async (request: Request & { params: { id: string } }, env: Env) => {
    const leadId = request.params.id;

    await revokeConsent(leadId, env.DB);

    return new Response(JSON.stringify({
        message: 'Consent revoked. All enrichment data has been deleted.',
        lead_id: leadId,
    }), {
        headers: { 'Content-Type': 'application/json' },
    });
});

// ─── GET /api/leads/discover (backwards compat) ─────────────
router.get('/api/leads/discover', async () => {
    return new Response(JSON.stringify({
        message: 'Use POST /api/leads/enrich with discovered leads for OSINT enrichment.',
        leads: [],
    }), {
        headers: { 'Content-Type': 'application/json' },
    });
});

export const leadRoutes = router;
