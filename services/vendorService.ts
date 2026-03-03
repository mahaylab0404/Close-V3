
import { getToken } from './authService';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8787';

export interface Vendor {
    id: string;
    name: string;
    category: 'mover' | 'estate_sale' | 'attorney' | 'organizer' | 'cleaner' | 'other';
    county: string;
    phone?: string;
    email?: string;
    website?: string;
    rating: number;
    isVerified: boolean;
}

export interface VendorTask {
    id: string;
    description: string;
    isCompleted: boolean;
    dueDate?: string;
}

export interface VendorAssignment {
    id: string;
    vendorId: string;
    vendorName: string;
    category: string;
    status: 'assigned' | 'contacted' | 'booked' | 'completed';
    notes?: string;
    assignedAt: number;
    tasks: VendorTask[];
    phone?: string;
    email?: string;
}

const getAuthHeaders = (tokenOverride?: string) => {
    const token = tokenOverride || getToken();
    return {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };
};

export const getVendors = async (token: string, county?: string, category?: string): Promise<Vendor[]> => {
    const params = new URLSearchParams();
    if (county) params.append('county', county);
    if (category) params.append('category', category);

    const response = await fetch(`${API_BASE_URL}/api/vendors?${params.toString()}`, {
        headers: getAuthHeaders(token)
    });

    if (!response.ok) throw new Error('Failed to fetch vendors');
    return response.json();
};

export const assignVendor = async (token: string, leadId: string, vendorId: string, notes?: string): Promise<{ success: boolean; id: string }> => {
    const response = await fetch(`${API_BASE_URL}/api/vendors/assign`, {
        method: 'POST',
        headers: getAuthHeaders(token),
        body: JSON.stringify({ leadId, vendorId, notes })
    });

    if (!response.ok) throw new Error('Failed to assign vendor');
    return response.json();
};

export const getVendorAssignments = async (token: string, leadId: string): Promise<VendorAssignment[]> => {
    const response = await fetch(`${API_BASE_URL}/api/vendors/lead/${leadId}`, {
        headers: getAuthHeaders(token)
    });

    if (!response.ok) throw new Error('Failed to fetch vendor assignments');
    // Map snake_case from DB to camelCase for frontend
    const data = await response.json();
    return data.map((item: any) => ({
        id: item.id,
        vendorId: item.vendor_id,
        vendorName: item.vendor_name,
        category: item.category,
        status: item.status,
        notes: item.notes,
        assignedAt: item.assigned_at,
        tasks: (item.tasks || []).map((t: any) => ({
            id: t.id,
            description: t.description,
            isCompleted: t.is_completed === 1,
            dueDate: t.due_date
        })),
        phone: item.phone,
        email: item.email
    }));
};

export const updateVendorTask = async (token: string, taskId: string, isCompleted: boolean): Promise<void> => {
    const response = await fetch(`${API_BASE_URL}/api/vendors/tasks/${taskId}`, {
        method: 'PATCH',
        headers: getAuthHeaders(token),
        body: JSON.stringify({ isCompleted })
    });

    if (!response.ok) throw new Error('Failed to update task');
};
