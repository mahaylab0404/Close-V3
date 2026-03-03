/**
 * Authentication API Routes
 * Agent registration, login, and session management
 */

import { Router } from 'itty-router';
import { Env } from '../env';
import * as bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';

const router = Router();

// Generate unique ID
function generateId(): string {
    return crypto.randomUUID();
}

// Hash password
async function hashPassword(password: string): Promise<string> {
    const salt = await bcrypt.genSalt(10);
    return bcrypt.hash(password, salt);
}

// Verify password
async function verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
}

// Generate JWT token
async function generateToken(agentId: string, secret: string): Promise<string> {
    const encoder = new TextEncoder();
    const secretKey = encoder.encode(secret);

    return await new SignJWT({ agentId })
        .setProtectedHeader({ alg: 'HS256' })
        .setExpirationTime('7d')
        .setIssuedAt()
        .sign(secretKey);
}

// Verify JWT token
async function verifyToken(token: string, secret: string): Promise<{ agentId: string } | null> {
    try {
        const encoder = new TextEncoder();
        const secretKey = encoder.encode(secret);
        const { payload } = await jwtVerify(token, secretKey);
        return payload as { agentId: string };
    } catch {
        return null;
    }
}

// POST /api/auth/register - Agent registration
router.post('/api/auth/register', async (request: Request, env: Env) => {
    try {
        const body = await request.json() as {
            email: string;
            password: string;
            name: string;
            licenseNumber: string;
            county: string;
        };

        // Validate input
        if (!body.email || !body.password || !body.name || !body.licenseNumber || !body.county) {
            return new Response(JSON.stringify({ error: 'Missing required fields' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // Check if email or license already exists
        const existing = await env.DB.prepare(
            'SELECT id FROM agents WHERE email = ? OR license_number = ?'
        ).bind(body.email, body.licenseNumber).first();

        if (existing) {
            return new Response(JSON.stringify({ error: 'Email or license number already registered' }), {
                status: 409,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // Create agent account
        const agentId = generateId();
        const passwordHash = await hashPassword(body.password);
        const now = Date.now();

        await env.DB.prepare(
            `INSERT INTO agents (id, email, password_hash, license_number, name, county, verification_status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?)`
        ).bind(agentId, body.email, passwordHash, body.licenseNumber, body.name, body.county, now, now).run();

        // Generate token
        const token = await generateToken(agentId, env.JWT_SECRET);

        return new Response(JSON.stringify({
            success: true,
            agent: {
                id: agentId,
                email: body.email,
                name: body.name,
                county: body.county,
                verificationStatus: 'pending',
            },
            token,
        }), {
            status: 201,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        console.error('Registration error:', error);
        return new Response(JSON.stringify({ error: 'Registration failed' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
});

// POST /api/auth/login - Agent login
router.post('/api/auth/login', async (request: Request, env: Env) => {
    try {
        const body = await request.json() as { email: string; password: string };

        if (!body.email || !body.password) {
            return new Response(JSON.stringify({ error: 'Email and password required' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // Find agent
        const agent = await env.DB.prepare(
            'SELECT id, email, password_hash, name, county, verification_status FROM agents WHERE email = ?'
        ).bind(body.email).first();

        if (!agent) {
            return new Response(JSON.stringify({ error: 'Invalid credentials' }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // Verify password
        const valid = await verifyPassword(body.password, agent.password_hash as string);
        if (!valid) {
            return new Response(JSON.stringify({ error: 'Invalid credentials' }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // Generate token
        const token = await generateToken(agent.id as string, env.JWT_SECRET);

        return new Response(JSON.stringify({
            success: true,
            agent: {
                id: agent.id,
                email: agent.email,
                name: agent.name,
                county: agent.county,
                verificationStatus: agent.verification_status,
            },
            token,
        }), {
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        console.error('Login error:', error);
        return new Response(JSON.stringify({ error: 'Login failed' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
});

// GET /api/auth/me - Get current agent profile
router.get('/api/auth/me', async (request: Request, env: Env) => {
    try {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const token = authHeader.substring(7);
        const payload = await verifyToken(token, env.JWT_SECRET);

        if (!payload) {
            return new Response(JSON.stringify({ error: 'Invalid token' }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const agent = await env.DB.prepare(
            'SELECT id, email, name, county, license_number, verification_status, created_at FROM agents WHERE id = ?'
        ).bind(payload.agentId).first();

        if (!agent) {
            return new Response(JSON.stringify({ error: 'Agent not found' }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        return new Response(JSON.stringify({
            agent: {
                id: agent.id,
                email: agent.email,
                name: agent.name,
                county: agent.county,
                licenseNumber: agent.license_number,
                verificationStatus: agent.verification_status,
                createdAt: agent.created_at,
            },
        }), {
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        console.error('Profile error:', error);
        return new Response(JSON.stringify({ error: 'Failed to fetch profile' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
});

// ─── POST /api/auth/forgot-password ────────────────────────
// Generates a 6-digit reset code stored in D1 (15min expiry)
router.post('/api/auth/forgot-password', async (request: Request, env: Env) => {
    try {
        const body = await request.json() as { email: string };

        if (!body.email) {
            return new Response(JSON.stringify({ error: 'Email is required' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // Find agent by email
        const agent = await env.DB.prepare(
            'SELECT id, email, name FROM agents WHERE email = ?'
        ).bind(body.email).first<{ id: string; email: string; name: string }>();

        // Always return success to prevent email enumeration
        const successResponse = new Response(JSON.stringify({
            message: 'If an account exists with that email, a reset code has been generated.',
        }), {
            headers: { 'Content-Type': 'application/json' },
        });

        if (!agent) return successResponse;

        // Generate 6-digit reset code
        const resetCode = String(Math.floor(100000 + Math.random() * 900000));
        const now = Date.now();
        const expiresAt = now + 15 * 60 * 1000; // 15 minutes

        // Delete any existing reset tokens for this agent
        await env.DB.prepare(
            'DELETE FROM password_reset_tokens WHERE agent_id = ?'
        ).bind(agent.id).run();

        // Store reset token
        const tokenId = crypto.randomUUID();
        await env.DB.prepare(
            'INSERT INTO password_reset_tokens (id, agent_id, reset_code, expires_at, created_at) VALUES (?, ?, ?, ?, ?)'
        ).bind(tokenId, agent.id, resetCode, expiresAt, now).run();

        // Log the reset code (in production, send via email service)
        console.log(`[PASSWORD RESET] Agent: ${agent.email}, Code: ${resetCode}, Expires: ${new Date(expiresAt).toISOString()}`);

        return successResponse;
    } catch (error) {
        console.error('Forgot password error:', error);
        return new Response(JSON.stringify({ error: 'Request failed' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
});

// ─── POST /api/auth/reset-password ─────────────────────────
// Validates the 6-digit code and resets the password
router.post('/api/auth/reset-password', async (request: Request, env: Env) => {
    try {
        const body = await request.json() as { email: string; code: string; newPassword: string };

        if (!body.email || !body.code || !body.newPassword) {
            return new Response(JSON.stringify({ error: 'Email, code, and newPassword are required' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        if (body.newPassword.length < 8) {
            return new Response(JSON.stringify({ error: 'Password must be at least 8 characters' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // Find agent
        const agent = await env.DB.prepare(
            'SELECT id FROM agents WHERE email = ?'
        ).bind(body.email).first<{ id: string }>();

        if (!agent) {
            return new Response(JSON.stringify({ error: 'Invalid reset code' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // Find valid reset token
        const token = await env.DB.prepare(
            'SELECT id, reset_code, expires_at FROM password_reset_tokens WHERE agent_id = ? AND reset_code = ? AND expires_at > ?'
        ).bind(agent.id, body.code, Date.now()).first<{ id: string; reset_code: string; expires_at: number }>();

        if (!token) {
            return new Response(JSON.stringify({ error: 'Invalid or expired reset code' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // Update password
        const passwordHash = await hashPassword(body.newPassword);
        await env.DB.prepare(
            'UPDATE agents SET password_hash = ?, updated_at = ? WHERE id = ?'
        ).bind(passwordHash, Date.now(), agent.id).run();

        // Delete used token
        await env.DB.prepare(
            'DELETE FROM password_reset_tokens WHERE agent_id = ?'
        ).bind(agent.id).run();

        // Generate fresh login token
        const loginToken = await generateToken(agent.id, env.JWT_SECRET);

        return new Response(JSON.stringify({
            success: true,
            message: 'Password has been reset successfully.',
            token: loginToken,
        }), {
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        console.error('Password reset error:', error);
        return new Response(JSON.stringify({ error: 'Reset failed' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
});

// ─── POST /api/auth/verify-license ─────────────────────────
// Verify agent's FL real estate license against DBPR
router.post('/api/auth/verify-license', async (request: Request, env: Env) => {
    try {
        // Require auth
        const authHeader = request.headers.get('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const jwtToken = authHeader.substring(7);
        const payload = await verifyToken(jwtToken, env.JWT_SECRET);
        if (!payload) {
            return new Response(JSON.stringify({ error: 'Invalid token' }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // Get agent's license number
        const agent = await env.DB.prepare(
            'SELECT license_number FROM agents WHERE id = ?'
        ).bind(payload.agentId).first<{ license_number: string }>();

        if (!agent) {
            return new Response(JSON.stringify({ error: 'Agent not found' }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // Import and run verification
        const { verifyAndUpdateAgent } = await import('../services/dbpr_verification');
        const result = await verifyAndUpdateAgent(payload.agentId, agent.license_number, env.DB);

        return new Response(JSON.stringify({
            verification: result,
        }), {
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        console.error('License verification error:', error);
        return new Response(JSON.stringify({ error: 'Verification failed' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
});

export const authRoutes = router;
