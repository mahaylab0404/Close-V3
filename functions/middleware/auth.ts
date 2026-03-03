/**
 * Auth Middleware
 * JWT verification for protected routes.
 * Attaches `agentId` to the request for downstream handlers.
 */

import { Env } from '../env';
import { jwtVerify } from 'jose';

export interface AuthenticatedRequest extends Request {
    agentId: string;
    agentCounty?: string;
}

/**
 * Verify the JWT from the Authorization header.
 * Returns the authenticated request with agentId attached, or a 401 Response.
 */
export async function requireAuth(
    request: Request,
    env: Env
): Promise<AuthenticatedRequest | Response> {
    const authHeader = request.headers.get('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return new Response(JSON.stringify({
            error: 'Unauthorized',
            message: 'Missing or invalid Authorization header. Expected: Bearer <token>',
        }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    const token = authHeader.substring(7);

    try {
        const encoder = new TextEncoder();
        const secretKey = encoder.encode(env.JWT_SECRET);
        const { payload } = await jwtVerify(token, secretKey);

        if (!payload.agentId || typeof payload.agentId !== 'string') {
            return new Response(JSON.stringify({
                error: 'Unauthorized',
                message: 'Invalid token payload',
            }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // Attach agentId to request
        const authedRequest = request as AuthenticatedRequest;
        authedRequest.agentId = payload.agentId;

        // Optionally lookup agent county for downstream use
        const agent = await env.DB.prepare(
            'SELECT county FROM agents WHERE id = ?'
        ).bind(payload.agentId).first<{ county: string }>();

        if (!agent) {
            return new Response(JSON.stringify({
                error: 'Unauthorized',
                message: 'Agent not found',
            }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        authedRequest.agentCounty = agent.county;
        return authedRequest;

    } catch (error) {
        return new Response(JSON.stringify({
            error: 'Unauthorized',
            message: 'Token expired or invalid',
        }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}

/**
 * Middleware wrapper for itty-router.
 * Returns undefined (pass-through) on success, or a Response on auth failure.
 */
export function authMiddleware(request: Request, env: Env): Promise<Response | undefined> {
    return requireAuth(request, env).then(result => {
        if (result instanceof Response) {
            return result;
        }
        // Auth succeeded — mutate request with agentId for downstream handlers
        (request as any).agentId = result.agentId;
        (request as any).agentCounty = result.agentCounty;
        return undefined; // pass-through
    });
}
