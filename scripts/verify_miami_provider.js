const ARCGIS_BASE = 'https://services.arcgis.com/8Pc9XBTAsYuxx9Ny/arcgis/rest/services/Property_Search_gdb/FeatureServer/0/query';

async function query(address) {
    const where = `SITUS_ADDR LIKE '%${address.toUpperCase()}%'`;
    const params = new URLSearchParams({
        where: where,
        outFields: 'FOLIO,OWNER1,SITUS_ADDR',
        returnGeometry: 'false',
        f: 'json',
        resultRecordCount: '5'
    });

    const url = `${ARCGIS_BASE}?${params.toString()}`;
    console.log(`Querying: ${url}`);

    try {
        const res = await fetch(url);
        if (!res.ok) {
            console.error(`HTTP Error: ${res.status}`);
            return;
        }
        const data = await res.json();
        console.log(JSON.stringify(data, null, 2));
    } catch (err) {
        console.error('Fetch Error:', err);
    }
}

// Test cases
// Standard
await query('1111 LINCOLN RD');
// Partial
await query('1111 LINCOLN');
