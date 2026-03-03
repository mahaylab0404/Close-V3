/**
 * Rate Limiting Middleware
 * Per-agent request throttling using D1 sliding window.
 * Prevents OSINT provider abuse and protects upstream APIs.
 */

import { Env } from '../env';

interface RateLimitConfig {
    windowMs: number;       // Time window in milliseconds
    maxRequests: number;    // Max requests per window
}

// Different limits for different route groups
const RATE_LIMITS: Record<string, RateLimitConfig> = {
    'enrichment': { windowMs: 60_000, maxRequests: 10 },     // 10 enrichment calls/min
    'property': { windowMs: 60_000, maxRequests: 30 },     // 30 property lookups/min
    'auth': { windowMs: 300_000, maxRequests: 15 },    // 15 auth attempts/5 min
    'default': { windowMs: 60_000, maxRequests: 60 },     // 60 general requests/min
};

/**
 * Determine which rate limit bucket a request falls into.
 */
function getBucket(url: string): string {
    if (url.includes('/api/leads/enrich') || url.includes('/intel/recompute')) return 'enrichment';
    if (url.includes('/api/property/')) return 'property';
    if (url.includes('/api/auth/')) return 'auth';
    return 'default';
}

/**
 * In-memory sliding window rate limiter.
 * Uses a Map keyed by agentId:bucket with timestamped request counts.
 *
 * NOTE: In Cloudflare Workers, each isolate has its own memory, so this
 * provides per-isolate rate limiting. For strict global rate limiting,
 * upgrade to Durable Objects or KV-backed tracking.
 */
const requestLog = new Map<string, number[]>();

// Clean old entries periodically to prevent memory leaks
function cleanExpired(key: string, windowMs: number, now: number): number[] {
    const timestamps = requestLog.get(key) || [];
    const valid = timestamps.filter(t => t > now - windowMs);
    requestLog.set(key, valid);
    return valid;
}

export interface RateLimitResult {
    allowed: boolean;
    remaining: number;
    resetMs: number;
    limit: number;
}

/**
 * Check rate limit for a given agent + route bucket.
 */
export function checkRateLimit(agentId: string, url: string): RateLimitResult {
    const bucket = getBucket(url);
    const config = RATE_LIMITS[bucket];
    const key = `${agentId}:${bucket}`;
    const now = Date.now();

    const timestamps = cleanExpired(key, config.windowMs, now);

    if (timestamps.length >= config.maxRequests) {
        const oldestInWindow = timestamps[0];
        const resetMs = oldestInWindow + config.windowMs - now;

        return {
            allowed: false,
            remaining: 0,
            resetMs: Math.max(0, resetMs),
            limit: config.maxRequests,
        };
    }

    // Record this request
    timestamps.push(now);
    requestLog.set(key, timestamps);

    return {
        allowed: true,
        remaining: config.maxRequests - timestamps.length,
        resetMs: config.windowMs,
        limit: config.maxRequests,
    };
}

/**
 * Rate limit middleware for itty-router.
 * Must run AFTER auth middleware so agentId is available.
 */
export function rateLimitMiddleware(request: Request): Response | undefined {
    const agentId = (request as any).agentId || getIPIdentifier(request);
    const result = checkRateLimit(agentId, request.url);

    if (!result.allowed) {
        return new Response(JSON.stringify({
            error: 'Rate limit exceeded',
            message: `Too many requests. Try again in ${Math.ceil(result.resetMs / 1000)}s.`,
            retryAfterMs: result.resetMs,
        }), {
            status: 429,
            headers: {
                'Content-Type': 'application/json',
                'Retry-After': String(Math.ceil(result.resetMs / 1000)),
                'X-RateLimit-Limit': String(result.limit),
                'X-RateLimit-Remaining': '0',
            },
        });
    }

    return undefined; // pass-through
}

/**
 * Fallback identifier for unauthenticated routes (e.g. /api/auth/login).
 */
function getIPIdentifier(request: Request): string {
    return request.headers.get('CF-Connecting-IP') ||
        request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ||
        'anonymous';
}
