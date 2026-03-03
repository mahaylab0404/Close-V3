/**
 * Auth Service - Frontend authentication helpers
 * Handles API calls to Cloudflare Workers backend
 */

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8787';

export interface AuthAgent {
    id: string;
    email: string;
    name: string;
    county: string;
    licenseNumber?: string;
    verificationStatus: 'pending' | 'verified' | 'rejected';
    createdAt?: number;
}

export interface AuthResponse {
    success: boolean;
    agent: AuthAgent;
    token: string;
    error?: string;
}

// Token management
const TOKEN_KEY = 'closr_auth_token';
const AGENT_KEY = 'closr_agent_data';

export const getToken = (): string | null => localStorage.getItem(TOKEN_KEY);
export const getStoredAgent = (): AuthAgent | null => {
    const data = localStorage.getItem(AGENT_KEY);
    return data ? JSON.parse(data) : null;
};

const saveAuth = (token: string, agent: AuthAgent) => {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(AGENT_KEY, JSON.stringify(agent));
};

export const clearAuth = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(AGENT_KEY);
};

export const isAuthenticated = (): boolean => !!getToken();

// API Calls
export const registerAgent = async (data: {
    email: string;
    password: string;
    name: string;
    licenseNumber: string;
    county: string;
}): Promise<AuthResponse> => {
    try {
        const response = await fetch(`${API_URL}/api/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
        const result = await response.json() as AuthResponse;
        if (result.success) {
            saveAuth(result.token, result.agent);
        }
        return result;
    } catch (error) {
        return { success: false, agent: {} as AuthAgent, token: '', error: 'Network error. Please try again.' };
    }
};

export const loginAgent = async (email: string, password: string): Promise<AuthResponse> => {
    try {
        const response = await fetch(`${API_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
        });
        const result = await response.json() as AuthResponse;
        if (result.success) {
            saveAuth(result.token, result.agent);
        }
        return result;
    } catch (error) {
        return { success: false, agent: {} as AuthAgent, token: '', error: 'Network error. Please try again.' };
    }
};

export const fetchAgentProfile = async (): Promise<AuthAgent | null> => {
    const token = getToken();
    if (!token) return null;

    try {
        const response = await fetch(`${API_URL}/api/auth/me`, {
            headers: { 'Authorization': `Bearer ${token}` },
        });
        if (!response.ok) {
            clearAuth();
            return null;
        }
        const result = await response.json() as { agent: AuthAgent };
        if (result.agent) {
            localStorage.setItem(AGENT_KEY, JSON.stringify(result.agent));
        }
        return result.agent;
    } catch {
        return getStoredAgent();
    }
};

// Authenticated fetch wrapper
export const authFetch = async (path: string, options: RequestInit = {}): Promise<Response> => {
    const token = getToken();
    return fetch(`${API_URL}${path}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
            ...options.headers,
        },
    });
};
