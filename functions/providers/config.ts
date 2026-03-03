/**
 * Provider Configuration
 * Central config for all county providers + Sunbiz
 * Toggle PROVIDER_MODE to 'licensed' when you have a real data vendor
 */

import { ProviderConfig, PropertyProvider, EntityProvider } from './types';
import { MiamiDadeProvider } from './miami_dade';
import { BrowardProvider } from './broward';
import { PalmBeachProvider } from './palm_beach';
import { SunbizProvider } from './sunbiz';
import { PROVIDER_MODE, PROVIDER_CONFIGS } from './provider_configs';

// Re-export configs for external consumers
export { PROVIDER_MODE, PROVIDER_CONFIGS };

// ─── PROVIDER FACTORY ───────────────────────────────────────

const providers: Record<string, PropertyProvider> = {
    'Miami-Dade': new MiamiDadeProvider(),
    'Broward': new BrowardProvider(),
    'Palm Beach': new PalmBeachProvider(),
};

export function getProviderForCounty(county: string): PropertyProvider {
    const provider = providers[county];
    if (!provider) {
        throw new Error(`No provider configured for county: ${county}. Supported: ${Object.keys(providers).join(', ')}`);
    }
    return provider;
}

export function getEntityProvider(): EntityProvider {
    return new SunbizProvider();
}

export function getProviderConfig(county: string): ProviderConfig {
    return PROVIDER_CONFIGS[county] || PROVIDER_CONFIGS['Miami-Dade'];
}

// ─── SUPPORTED COUNTIES ─────────────────────────────────────
export const SUPPORTED_COUNTIES = ['Miami-Dade', 'Broward', 'Palm Beach'] as const;
export type SupportedCounty = typeof SUPPORTED_COUNTIES[number];

export function isSupportedCounty(county: string): county is SupportedCounty {
    return SUPPORTED_COUNTIES.includes(county as SupportedCounty);
}
