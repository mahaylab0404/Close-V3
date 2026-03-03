/**
 * Property Data API Routes
 * Real property lookups using county providers (ArcGIS REST API)
 */

import { Router } from 'itty-router';
import { Env } from '../env';
import { getProviderForCounty, isSupportedCounty, SUPPORTED_COUNTIES } from '../providers/config';

const router = Router();

// ─── GET /api/property/:county/:folio ───────────────────────
// Look up a property by folio/parcel ID within a specific county
router.get('/api/property/:county/:folio', async (request: Request & { params: { county: string; folio: string } }, env: Env) => {
    const { county, folio } = request.params;
    const decodedCounty = decodeURIComponent(county);

    if (!isSupportedCounty(decodedCounty)) {
        return new Response(JSON.stringify({
            error: `Unsupported county: ${decodedCounty}`,
            supported: [...SUPPORTED_COUNTIES],
        }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    try {
        const provider = getProviderForCounty(decodedCounty);
        const record = await provider.lookupByParcel(folio);

        if (!record) {
            return new Response(JSON.stringify({
                error: 'No property record found',
                county: decodedCounty,
                folio,
            }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        return new Response(JSON.stringify({
            property: record,
            county: decodedCounty,
            folio,
        }), {
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (err) {
        console.error(`Property lookup error [${decodedCounty}/${folio}]:`, err);
        return new Response(JSON.stringify({
            error: 'Property lookup failed',
            message: err instanceof Error ? err.message : 'Unknown error',
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
});

// ─── GET /api/property/search ───────────────────────────────
// Search by address within a county
router.get('/api/property/search', async (request: Request, env: Env) => {
    const url = new URL(request.url);
    const address = url.searchParams.get('address');
    const county = url.searchParams.get('county');

    if (!address || !county) {
        return new Response(JSON.stringify({
            error: 'Missing required query params: address, county',
        }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    if (!isSupportedCounty(county)) {
        return new Response(JSON.stringify({
            error: `Unsupported county: ${county}`,
            supported: [...SUPPORTED_COUNTIES],
        }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    try {
        const provider = getProviderForCounty(county);
        const record = await provider.lookupByAddress(address);

        if (!record) {
            return new Response(JSON.stringify({
                error: 'No property record found for address',
                address,
                county,
            }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        return new Response(JSON.stringify({
            property: record,
            county,
            address,
        }), {
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (err) {
        console.error(`Property search error [${county}/${address}]:`, err);
        return new Response(JSON.stringify({
            error: 'Property search failed',
            message: err instanceof Error ? err.message : 'Unknown error',
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
});

export const propertyRoutes = router;
