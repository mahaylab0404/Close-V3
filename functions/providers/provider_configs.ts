/**
 * Provider Configurations (constants only — no provider imports)
 * Extracted to break circular dependency between config.ts ↔ provider files.
 */

import { ProviderConfig } from './types';

// ─── MASTER TOGGLE ──────────────────────────────────────────
// 'osint'    → Live queries to free public ArcGIS / county APIs (default)
// 'licensed' → Paid data vendor API (fill in credentials below)
export const PROVIDER_MODE: 'osint' | 'licensed' = 'osint';

// ─── PER-PROVIDER CONFIG ────────────────────────────────────
export const PROVIDER_CONFIGS: Record<string, ProviderConfig> = {
    'Miami-Dade': {
        mode: PROVIDER_MODE,
        rateLimitPerMinute: 30,
        cacheExpirySeconds: 86400, // 24 hours
        publicApiUrl: 'https://services.arcgis.com/8Pc9XBTAsYuxx47m/arcgis/rest/services/Property_Boundary_View/FeatureServer/0/query',
    },
    'Broward': {
        mode: PROVIDER_MODE,
        rateLimitPerMinute: 30,
        cacheExpirySeconds: 86400,
        publicApiUrl: 'https://bcgishub.broward.org/server/rest/services/GeoHubDownloads/Parcels/FeatureServer/0/query',
    },
    'Palm Beach': {
        mode: PROVIDER_MODE,
        rateLimitPerMinute: 30,
        cacheExpirySeconds: 86400,
        publicApiUrl: 'https://maps.co.palm-beach.fl.us/arcgis/rest/services/OpenData/OpenData/MapServer/0/query',
    },
    'Sunbiz': {
        mode: PROVIDER_MODE,
        rateLimitPerMinute: 10,
        cacheExpirySeconds: 604800, // 7 days
        publicApiUrl: 'https://search.sunbiz.org/Inquiry/CorporationSearch/SearchByName',
    },
};
