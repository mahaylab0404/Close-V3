/// <reference types="@cloudflare/workers-types" />

/**
 * Closr API - Cloudflare Workers Entry Point
 * Uses itty-router v5 with flat route registration to avoid sub-router hang.
 */

export type { Env } from './env';
import { Env } from './env';

import { Router } from 'itty-router';
import { authRoutes } from './api/auth';
import { leadRoutes } from './api/leads';
import { propertyRoutes } from './api/property';
import { agentRoutes } from './api/agents';
import vendorsRouter from './api/vendors';
import aiRouter from './api/ai';
console.log('[DEBUG] aiRouter imported');
import { authMiddleware } from './middleware/auth';
import { rateLimitMiddleware } from './middleware/rate_limiter';

// CORS headers for frontend
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function json(data: any, status = 200): Response {
    return new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
}

export default {
    async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
        // Handle CORS preflight
        if (request.method === 'OPTIONS') {
            return new Response(null, { headers: corsHeaders });
        }

        const url = new URL(request.url);
        const path = url.pathname;
        console.log(`[DEBUG] Incoming path: ${path}`);

        try {
            let response: Response | undefined;

            // ── Health check (public) ──
            if (path === '/api/health') {
                response = json({ status: 'ok', service: 'closr-api' });
            }

            // ── Auth routes (public, rate limited) ──
            else if (path.startsWith('/api/auth/')) {
                const rlResult = rateLimitMiddleware(request);
                if (rlResult) response = rlResult;
                else response = await authRoutes.fetch(request, env, ctx);
            }

            // ─── Protected routes: require JWT + rate limit ──
            else if (path.startsWith('/api/leads') || path.startsWith('/api/property') || path.startsWith('/api/agents') || path.startsWith('/api/vendors')) {
                // Auth check
                const authResult = await authMiddleware(request, env);
                if (authResult) {
                    response = authResult;
                } else {
                    // Rate limit check
                    const rlResult = rateLimitMiddleware(request);
                    if (rlResult) {
                        response = rlResult;
                    } else {
                        // Route to appropriate handler
                        if (path.startsWith('/api/leads')) {
                            response = await leadRoutes.fetch(request, env, ctx);
                        } else if (path.startsWith('/api/property')) {
                            response = await propertyRoutes.fetch(request, env, ctx);
                        } else if (path.startsWith('/api/agents')) {
                            response = await agentRoutes.fetch(request, env, ctx);
                        } else if (path.startsWith('/api/vendors')) {
                            response = await vendorsRouter.fetch(request, env, ctx);
                        } else if (path.startsWith('/api/ai')) {
                            response = await aiRouter.fetch(request, env, ctx);
                        }
                    }
                }
            }

            // ── 404 ──
            if (!response) {
                response = json({ error: 'Not found' }, 404);
            }

            // Append CORS headers to whatever response we got
            // (Clone response to mutate headers if immutable)
            const newHeaders = new Headers(response.headers);
            Object.entries(corsHeaders).forEach(([k, v]) => newHeaders.set(k, v));

            return new Response(response.body, {
                status: response.status,
                statusText: response.statusText,
                headers: newHeaders
            });

        } catch (error) {
            console.error('API Error:', error);
            // json() helper already adds CORS
            return json({
                error: 'Internal server error',
                message: error instanceof Error ? error.message : 'Unknown error',
            }, 500);
        }
    },
};
