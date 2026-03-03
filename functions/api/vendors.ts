
import { Router } from 'itty-router';
import { Env } from '../env';

const router = Router();

// Helper to standard JSON response
const json = (data: any, status = 200) => new Response(JSON.stringify(data), {
    status,
    headers: {
        'Content-Type': 'application/json',
        // CORS headers will be added by index.ts wrapper
    }
});

// GET /api/vendors
// List vetted vendors, optionally filtered by county/category
router.get('/', async (request, env: Env) => {
    const url = new URL(request.url);
    const county = url.searchParams.get('county');
    const category = url.searchParams.get('category');

    let query = 'SELECT * FROM vendors WHERE 1=1';
    const params: any[] = [];

    if (county) {
        query += ' AND county = ?';
        params.push(county);
    }

    if (category) {
        query += ' AND category = ?';
        params.push(category);
    }

    query += ' ORDER BY rating DESC, name ASC';

    try {
        const { results } = await env.DB.prepare(query).bind(...params).all();
        return json(results);
    } catch (e) {
        return json({ error: 'Failed to fetch vendors' }, 500);
    }
});

// GET /api/vendors/:id
router.get('/:id', async (request, env: Env) => {
    const { id } = request.params;
    const vendor = await env.DB.prepare('SELECT * FROM vendors WHERE id = ?').bind(id).first();

    if (!vendor) return json({ error: 'Vendor not found' }, 404);
    return json(vendor);
});

// POST /api/vendors
// Admin/Agent can add a new vendor (in reality this might be admin-only)
router.post('/', async (request, env: Env) => {
    try {
        const body = await request.json() as any;
        const { name, category, county, phone, email, website } = body;

        if (!name || !category || !county) {
            return json({ error: 'Missing required fields' }, 400);
        }

        const id = crypto.randomUUID();
        const now = Date.now();

        await env.DB.prepare(
            `INSERT INTO vendors (id, name, category, county, phone, email, website, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(id, name, category, county, phone, email, website, now).run();

        return json({ id, name, category }, 201);
    } catch (e) {
        console.error('Add vendor error:', e);
        return json({ error: 'Failed to create vendor' }, 500);
    }
});

// POST /api/vendors/assign
// Assign a vendor to a lead
router.post('/assign', async (request, env: Env) => {
    try {
        const body = await request.json() as any;
        const { leadId, vendorId, notes } = body;

        if (!leadId || !vendorId) return json({ error: 'Missing leadId or vendorId' }, 400);

        const id = crypto.randomUUID();
        const now = Date.now();

        // Create assignment
        await env.DB.prepare(
            `INSERT INTO lead_vendors (id, lead_id, vendor_id, status, notes, assigned_at)
             VALUES (?, ?, ?, 'assigned', ?, ?)`
        ).bind(id, leadId, vendorId, notes || '', now).run();

        // Auto-generate default tasks based on category
        const vendor = await env.DB.prepare('SELECT category FROM vendors WHERE id = ?').bind(vendorId).first<{ category: string }>();

        if (vendor) {
            const tasks = getTasksForCategory(vendor.category);
            if (tasks.length > 0) {
                const stmt = env.DB.prepare(
                    `INSERT INTO vendor_tasks (id, lead_vendor_id, description, created_at) VALUES (?, ?, ?, ?)`
                );

                const batch = tasks.map(desc => stmt.bind(crypto.randomUUID(), id, desc, now));
                await env.DB.batch(batch);
            }
        }

        return json({ success: true, id }, 201);
    } catch (e) {
        console.error('Assign vendor error:', e);
        return json({ error: 'Failed to assign vendor' }, 500);
    }
});

// GET /api/leads/:leadId/vendors
// Get all vendors assigned to a specific lead
router.get('/lead/:leadId', async (request, env: Env) => {
    const { leadId } = request.params;

    // Join lead_vendors with vendors to get names/details
    const query = `
        SELECT lv.*, v.name as vendor_name, v.category, v.phone, v.email 
        FROM lead_vendors lv
        JOIN vendors v ON lv.vendor_id = v.id
        WHERE lv.lead_id = ?
        ORDER BY lv.assigned_at DESC
    `;

    try {
        const { results } = await env.DB.prepare(query).bind(leadId).all();

        // For each assignment, fetch tasks. This is N+1 but acceptable for small scale (leads rarely have >5 vendors)
        // A better approach would be a separate endpoint or a JSON aggregation query if D1 supported it well
        for (const row of results) {
            const tasks = await env.DB.prepare(
                'SELECT * FROM vendor_tasks WHERE lead_vendor_id = ? ORDER BY created_at'
            ).bind(row.id).all();
            (row as any).tasks = tasks.results;
        }

        return json(results);
    } catch (e) {
        console.error('Fetch assignments error:', e);
        return json({ error: 'Failed to fetch assignments' }, 500);
    }
});

// PATCH /api/vendors/tasks/:taskId
// Update task status
router.patch('/tasks/:taskId', async (request, env: Env) => {
    const { taskId } = request.params;
    try {
        const body = await request.json() as any;
        const { isCompleted } = body;

        await env.DB.prepare(
            'UPDATE vendor_tasks SET is_completed = ? WHERE id = ?'
        ).bind(isCompleted ? 1 : 0, taskId).run();

        return json({ success: true });
    } catch (e) {
        return json({ error: 'Failed to update task' }, 500);
    }
});

// Helper: Get default tasks per category
function getTasksForCategory(category: string): string[] {
    switch (category.toLowerCase()) {
        case 'mover':
            return ['Schedule initial estimate', 'Confirm moving date', 'Verify insurance certificate', 'Final walkthrough'];
        case 'estate_sale':
            return ['Inventory verification', 'Sign contract', 'Set sale dates', 'Post-sale cleanout'];
        case 'attorney':
            return ['Draft probate documents', 'Review title commitments', 'Closing statement review'];
        case 'organizer':
            return ['Sorting session', 'Donation pickup', 'Packing supervision'];
        default:
            return ['Initial consultation', 'Service execution', 'Invoice payment'];
    }
}

export default router;
