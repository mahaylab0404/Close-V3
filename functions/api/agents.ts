/**
 * Agent API Routes — Profile, Stats, Settings, Multi-County
 */

import { Router } from 'itty-router';
import { Env } from '../env';
import * as bcrypt from 'bcryptjs';

const router = Router();

const VALID_COUNTIES = ['Miami-Dade', 'Broward', 'Palm Beach'];

// ─── PUT /api/agents/me ─────────────────────────────────────
// Update authenticated agent's profile and settings
router.put('/api/agents/me', async (request: Request, env: Env) => {
    try {
        const agentId = (request as any).agentId;
        if (!agentId) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), {
                status: 401, headers: { 'Content-Type': 'application/json' },
            });
        }

        const body = await request.json() as {
            name?: string;
            email?: string;
            phone?: string;
            bio?: string;
            county?: string;           // Update primary county
            currentPassword?: string;   // Required if changing password
            newPassword?: string;
            settings?: {
                notifications_enabled?: boolean;
                email_digest?: 'daily' | 'weekly' | 'none';
                lead_auto_enrich?: boolean;
                default_sort?: string;
                theme?: 'light' | 'dark' | 'system';
            };
        };

        // Fetch current agent
        const agent = await env.DB.prepare(
            'SELECT * FROM agents WHERE id = ?'
        ).bind(agentId).first<any>();

        if (!agent) {
            return new Response(JSON.stringify({ error: 'Agent not found' }), {
                status: 404, headers: { 'Content-Type': 'application/json' },
            });
        }

        const updates: string[] = [];
        const values: any[] = [];

        // Name
        if (body.name && body.name.trim().length > 0) {
            updates.push('name = ?');
            values.push(body.name.trim());
        }

        // Email (check uniqueness)
        if (body.email && body.email !== agent.email) {
            const existing = await env.DB.prepare(
                'SELECT id FROM agents WHERE email = ? AND id != ?'
            ).bind(body.email, agentId).first();
            if (existing) {
                return new Response(JSON.stringify({ error: 'Email already in use' }), {
                    status: 409, headers: { 'Content-Type': 'application/json' },
                });
            }
            updates.push('email = ?');
            values.push(body.email);
        }

        // Phone
        if (body.phone !== undefined) {
            updates.push('phone = ?');
            values.push(body.phone || null);
        }

        // Bio
        if (body.bio !== undefined) {
            updates.push('bio = ?');
            values.push(body.bio || null);
        }

        // Primary county
        if (body.county && VALID_COUNTIES.includes(body.county)) {
            updates.push('county = ?');
            values.push(body.county);
        }

        // Password change
        if (body.newPassword) {
            if (!body.currentPassword) {
                return new Response(JSON.stringify({ error: 'Current password required to set new password' }), {
                    status: 400, headers: { 'Content-Type': 'application/json' },
                });
            }
            const valid = await bcrypt.compare(body.currentPassword, agent.password_hash);
            if (!valid) {
                return new Response(JSON.stringify({ error: 'Current password is incorrect' }), {
                    status: 400, headers: { 'Content-Type': 'application/json' },
                });
            }
            if (body.newPassword.length < 8) {
                return new Response(JSON.stringify({ error: 'New password must be at least 8 characters' }), {
                    status: 400, headers: { 'Content-Type': 'application/json' },
                });
            }
            const salt = await bcrypt.genSalt(10);
            const hash = await bcrypt.hash(body.newPassword, salt);
            updates.push('password_hash = ?');
            values.push(hash);
        }

        // Settings (merge with existing)
        if (body.settings) {
            const existingSettings = JSON.parse(agent.settings || '{}');
            const mergedSettings = { ...existingSettings, ...body.settings };
            updates.push('settings = ?');
            values.push(JSON.stringify(mergedSettings));
        }

        if (updates.length === 0) {
            return new Response(JSON.stringify({ error: 'No fields to update' }), {
                status: 400, headers: { 'Content-Type': 'application/json' },
            });
        }

        updates.push('updated_at = ?');
        values.push(Date.now());

        await env.DB.prepare(
            `UPDATE agents SET ${updates.join(', ')} WHERE id = ?`
        ).bind(...values, agentId).run();

        // Return updated profile
        const updated = await env.DB.prepare(
            'SELECT id, email, name, phone, bio, county, settings, license_number, verification_status, created_at, updated_at FROM agents WHERE id = ?'
        ).bind(agentId).first<any>();

        // Fetch counties
        const counties = await env.DB.prepare(
            'SELECT county, is_primary FROM agent_counties WHERE agent_id = ? ORDER BY is_primary DESC'
        ).bind(agentId).all<any>();

        return new Response(JSON.stringify({
            success: true,
            agent: {
                id: updated.id,
                email: updated.email,
                name: updated.name,
                phone: updated.phone,
                bio: updated.bio,
                county: updated.county,
                counties: counties?.results || [{ county: updated.county, is_primary: 1 }],
                settings: JSON.parse(updated.settings || '{}'),
                licenseNumber: updated.license_number,
                verificationStatus: updated.verification_status,
                createdAt: updated.created_at,
                updatedAt: updated.updated_at,
            },
        }), {
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (err) {
        console.error('Profile update error:', err);
        return new Response(JSON.stringify({ error: 'Failed to update profile' }), {
            status: 500, headers: { 'Content-Type': 'application/json' },
        });
    }
});

// ─── POST /api/agents/me/counties ───────────────────────────
// Add a county to agent's service area
router.post('/api/agents/me/counties', async (request: Request, env: Env) => {
    try {
        const agentId = (request as any).agentId;
        if (!agentId) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), {
                status: 401, headers: { 'Content-Type': 'application/json' },
            });
        }

        const body = await request.json() as { county: string; is_primary?: boolean };

        if (!body.county || !VALID_COUNTIES.includes(body.county)) {
            return new Response(JSON.stringify({
                error: 'Invalid county. Valid options: ' + VALID_COUNTIES.join(', '),
            }), {
                status: 400, headers: { 'Content-Type': 'application/json' },
            });
        }

        // Check if already added
        const existing = await env.DB.prepare(
            'SELECT id FROM agent_counties WHERE agent_id = ? AND county = ?'
        ).bind(agentId, body.county).first();

        if (existing) {
            return new Response(JSON.stringify({ error: 'County already added' }), {
                status: 409, headers: { 'Content-Type': 'application/json' },
            });
        }

        // If setting as primary, clear existing primary
        if (body.is_primary) {
            await env.DB.prepare(
                'UPDATE agent_counties SET is_primary = 0 WHERE agent_id = ?'
            ).bind(agentId).run();

            // Also update agents.county
            await env.DB.prepare(
                'UPDATE agents SET county = ?, updated_at = ? WHERE id = ?'
            ).bind(body.county, Date.now(), agentId).run();
        }

        await env.DB.prepare(
            'INSERT INTO agent_counties (id, agent_id, county, is_primary, added_at) VALUES (?, ?, ?, ?, ?)'
        ).bind(crypto.randomUUID(), agentId, body.county, body.is_primary ? 1 : 0, Date.now()).run();

        // Return all counties
        const counties = await env.DB.prepare(
            'SELECT county, is_primary, added_at FROM agent_counties WHERE agent_id = ? ORDER BY is_primary DESC'
        ).bind(agentId).all<any>();

        return new Response(JSON.stringify({
            success: true,
            counties: counties?.results || [],
        }), {
            status: 201,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (err) {
        console.error('Add county error:', err);
        return new Response(JSON.stringify({ error: 'Failed to add county' }), {
            status: 500, headers: { 'Content-Type': 'application/json' },
        });
    }
});

// ─── DELETE /api/agents/me/counties/:county ─────────────────
// Remove a county from agent's service area
router.delete('/api/agents/me/counties/:county', async (request: Request & { params: { county: string } }, env: Env) => {
    try {
        const agentId = (request as any).agentId;
        const county = decodeURIComponent(request.params.county);

        // Can't remove primary county (must have at least one)
        const record = await env.DB.prepare(
            'SELECT is_primary FROM agent_counties WHERE agent_id = ? AND county = ?'
        ).bind(agentId, county).first<{ is_primary: number }>();

        if (!record) {
            return new Response(JSON.stringify({ error: 'County not found in your service area' }), {
                status: 404, headers: { 'Content-Type': 'application/json' },
            });
        }

        if (record.is_primary) {
            return new Response(JSON.stringify({
                error: 'Cannot remove primary county. Set another county as primary first.',
            }), {
                status: 400, headers: { 'Content-Type': 'application/json' },
            });
        }

        await env.DB.prepare(
            'DELETE FROM agent_counties WHERE agent_id = ? AND county = ?'
        ).bind(agentId, county).run();

        const counties = await env.DB.prepare(
            'SELECT county, is_primary, added_at FROM agent_counties WHERE agent_id = ? ORDER BY is_primary DESC'
        ).bind(agentId).all<any>();

        return new Response(JSON.stringify({
            success: true,
            counties: counties?.results || [],
        }), {
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (err) {
        console.error('Remove county error:', err);
        return new Response(JSON.stringify({ error: 'Failed to remove county' }), {
            status: 500, headers: { 'Content-Type': 'application/json' },
        });
    }
});

// ─── GET /api/agents/me/stats ───────────────────────────────
// Lead pipeline metrics for authenticated agent
router.get('/api/agents/me/stats', async (request: Request, env: Env) => {
    try {
        const agentId = (request as any).agentId;
        if (!agentId) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), {
                status: 401, headers: { 'Content-Type': 'application/json' },
            });
        }

        // Total leads
        const totalResult = await env.DB.prepare(
            'SELECT COUNT(*) as total FROM leads WHERE agent_id = ?'
        ).bind(agentId).first<{ total: number }>();

        // By verification level
        const byVerification = await env.DB.prepare(
            'SELECT verification_level, COUNT(*) as count FROM leads WHERE agent_id = ? GROUP BY verification_level'
        ).bind(agentId).all<{ verification_level: string; count: number }>();

        // By source type
        const bySource = await env.DB.prepare(
            'SELECT source_type, COUNT(*) as count FROM leads WHERE agent_id = ? GROUP BY source_type'
        ).bind(agentId).all<{ source_type: string; count: number }>();

        // By county
        const byCounty = await env.DB.prepare(
            'SELECT county, COUNT(*) as count FROM leads WHERE agent_id = ? GROUP BY county'
        ).bind(agentId).all<{ county: string; count: number }>();

        // Score distribution
        const scoreRanges = await env.DB.prepare(`
            SELECT 
                SUM(CASE WHEN score >= 80 THEN 1 ELSE 0 END) as hot,
                SUM(CASE WHEN score >= 60 AND score < 80 THEN 1 ELSE 0 END) as warm,
                SUM(CASE WHEN score >= 30 AND score < 60 THEN 1 ELSE 0 END) as cool,
                SUM(CASE WHEN score < 30 THEN 1 ELSE 0 END) as cold
            FROM leads WHERE agent_id = ?
        `).bind(agentId).first<{ hot: number; warm: number; cool: number; cold: number }>();

        // Average score
        const avgResult = await env.DB.prepare(
            'SELECT AVG(score) as avg_score FROM leads WHERE agent_id = ?'
        ).bind(agentId).first<{ avg_score: number }>();

        // Recent activity (last 7 days)
        const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
        const recentLeads = await env.DB.prepare(
            'SELECT COUNT(*) as count FROM leads WHERE agent_id = ? AND discovered_at > ?'
        ).bind(agentId, sevenDaysAgo).first<{ count: number }>();

        const recentActions = await env.DB.prepare(
            'SELECT action, COUNT(*) as count FROM lead_access_log WHERE agent_id = ? AND timestamp > ? GROUP BY action'
        ).bind(agentId, sevenDaysAgo).all<{ action: string; count: number }>();

        // Top leads (highest score)
        const topLeads = await env.DB.prepare(
            'SELECT id, name, address, county, score, verification_level, source_type FROM leads WHERE agent_id = ? ORDER BY score DESC LIMIT 5'
        ).bind(agentId).all<any>();

        // OSINT enrichment stats
        const enrichedResult = await env.DB.prepare(`
            SELECT 
                COUNT(*) as total_enriched,
                SUM(CASE WHEN li.verification_status = 'strong_match' THEN 1 ELSE 0 END) as strong_matches,
                SUM(CASE WHEN li.verification_status = 'partial_match' THEN 1 ELSE 0 END) as partial_matches,
                AVG(li.lead_score) as avg_osint_score
            FROM lead_intel li
            JOIN leads l ON l.id = li.lead_id
            WHERE l.agent_id = ?
        `).bind(agentId).first<{
            total_enriched: number;
            strong_matches: number;
            partial_matches: number;
            avg_osint_score: number;
        }>();

        return new Response(JSON.stringify({
            agent_id: agentId,
            overview: {
                total_leads: totalResult?.total || 0,
                avg_score: Math.round(avgResult?.avg_score || 0),
                leads_last_7_days: recentLeads?.count || 0,
            },
            pipeline: {
                hot: scoreRanges?.hot || 0,       // 80-100
                warm: scoreRanges?.warm || 0,      // 60-79
                cool: scoreRanges?.cool || 0,      // 30-59
                cold: scoreRanges?.cold || 0,      // 0-29
            },
            by_verification: Object.fromEntries(
                (byVerification?.results || []).map(r => [r.verification_level, r.count])
            ),
            by_source: Object.fromEntries(
                (bySource?.results || []).map(r => [r.source_type, r.count])
            ),
            by_county: Object.fromEntries(
                (byCounty?.results || []).map(r => [r.county, r.count])
            ),
            enrichment: {
                total_enriched: enrichedResult?.total_enriched || 0,
                strong_matches: enrichedResult?.strong_matches || 0,
                partial_matches: enrichedResult?.partial_matches || 0,
                avg_osint_score: Math.round(enrichedResult?.avg_osint_score || 0),
            },
            recent_activity: Object.fromEntries(
                (recentActions?.results || []).map(r => [r.action, r.count])
            ),
            top_leads: topLeads?.results || [],
            generated_at: new Date().toISOString(),
        }), {
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (err) {
        console.error('Stats error:', err);
        return new Response(JSON.stringify({ error: 'Failed to fetch stats' }), {
            status: 500, headers: { 'Content-Type': 'application/json' },
        });
    }
});

export const agentRoutes = router;
