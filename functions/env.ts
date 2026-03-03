/// <reference types="@cloudflare/workers-types" />

/**
 * Shared Env interface for Cloudflare Workers bindings.
 * Extracted to its own file to avoid circular imports between
 * index.ts and the API route modules.
 */
export interface Env {
    DB: D1Database;
    JWT_SECRET: string;
    GEMINI_API_KEY: string;
    ENVIRONMENT: string;
}
