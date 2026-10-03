import axios from 'axios';
import { getAuthToken } from '../utils/auth';
import { BASE_URL } from '../constants';

const api = axios.create({
    baseURL: BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

export const onboardUser = async (id, formData, role) => {
    try {
        const token = getAuthToken();
        if (!token) throw new Error("Unauthorized User");

        const data = new FormData();
        Object.keys(formData).forEach((key) => {
            if (formData[key] instanceof File) {
                data.append(key, formData[key]);
            } else {
                data.append(key, formData[key]);
            }
        });

        // const endpoint = role === "franchise" ? `/franchise/${id}/onboard` : `/merchant/${id}/onboard`;
        const endpoint = '/user/register';
        const response = await api.post(endpoint, data, {
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'multipart/form-data',
            },
        });
        return response.data;
    } catch (error) {
        throw new Error(error.response?.data?.message || "Something went wrong!");
    }
};


export const FranchiseAllUsers = async (params = {}) => {
    try {
        const token = getAuthToken();
        if (!token) throw new Error("Unauthorized User");
        let url = '/franchaise/?status=active';
        const { page, limit, ...rest } = params;
        if (page) {
            url += `&page=${encodeURIComponent(page)}`;
        }
        if (limit) {
            url += `&limit=${encodeURIComponent(limit)}`;
        }
        Object.entries(rest).forEach(([k, v]) => {
            url += `&${encodeURIComponent(k)}=${encodeURIComponent(v)}`;
        });

        const response = await api.get(url, {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });
        return response.data;
    }
    catch (error) {
        throw new Error(error.response?.data?.message);
    }
}

export const SuperFranchiseAllUsers = async (params = {}) => {
    try {
        const token = getAuthToken();
        if (!token) throw new Error("Unauthorized User");
        let url = '/super-franchise/?status=active';
        const { page, limit, ...rest } = params;
        if (page) {
            url += `&page=${encodeURIComponent(page)}`;
        }
        if (limit) {
            url += `&limit=${encodeURIComponent(limit)}`;
        }
        Object.entries(rest).forEach(([k, v]) => {
            url += `&${encodeURIComponent(k)}=${encodeURIComponent(v)}`;
        });

        const response = await api.get(url, {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });
        return response.data;
    }
    catch (error) {
        throw new Error(error.response?.data?.message);
    }
}

export const MerchantAllUsers = async (params = {}) => {
    const token = getAuthToken();

    if (!token) throw new Error("Unauthorized User");
    try {
        let url = '/merchant/?status=active';
        const { franchiseId, page, limit, ...rest } = params;
        if (franchiseId) {
            url += `&franchise_id=${encodeURIComponent(franchiseId)}`;
        }
        if (page) {
            url += `&page=${encodeURIComponent(page)}`;
        }
        if (limit) {
            url += `&limit=${encodeURIComponent(limit)}`;
        }
        Object.entries(rest).forEach(([k, v]) => {
            url += `&${encodeURIComponent(k)}=${encodeURIComponent(v)}`;
        });

        const response = await api.get(url, {
            headers: {
                Authorization: `Bearer ${token}`
            }
        });
        return response.data;
    }
    catch (error) {
        throw new Error(error.response?.data?.message);
    }
}

export const AllUsers = async (params = {}) => {
    try {
        const token = getAuthToken();
        if (!token) throw new Error("Unauthorized User");

        const { page, limit, status, role, search } = params;
        let url = '/user';
        const query = [];
        if (page) query.push(`page=${encodeURIComponent(page)}`);
        if (limit) query.push(`limit=${encodeURIComponent(limit)}`);
        if (status) query.push(`status=${encodeURIComponent(status)}`);
        if (role) query.push(`role=${encodeURIComponent(role)}`);
        if (search) query.push(`search=${encodeURIComponent(search)}`);
        if (query.length) url += `?${query.join('&')}`;

        const response = await api.get(url, {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });
        return response.data;
    } catch (error) {
        throw new Error(error.response?.data?.message);
    }
}

export const searchUsers = async ({
    q = '',
    status = '',
    role = '',
    limit = 10,
    offset,
    page,
} = {}) => {
    try {
        const token = getAuthToken();
        if (!token) throw new Error('Unauthorized User');

        const params = new URLSearchParams();
        if (q) params.append('q', q);
        if (status) params.append('status', status);
        if (role) params.append('role', role);
        params.append('limit', String(limit));
        if (typeof page !== 'undefined') {
            params.append('page', String(page));
        } else if (typeof offset !== 'undefined') {
            params.append('offset', String(offset));
        }

        const response = await api.get(`/user/search?${params.toString()}`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        return response.data;
    } catch (error) {
        throw new Error(error.response?.data?.message || 'Failed to search users');
    }
};

// --- Unfiltered APIs for Commission Assignment ---

export const GetAllFranchises = async () => {
    try {
        const token = getAuthToken();
        if (!token) throw new Error("Unauthorized User");
        // Remove status=active to get ALL, but add limit to ensure we get enough
        const response = await api.get('/franchaise/?limit=1000', {
            headers: { Authorization: `Bearer ${token}` },
        });
        return response.data;
    } catch (error) {
        throw new Error(error.response?.data?.message);
    }
}

export const GetAllMerchants = async () => {
    try {
        const token = getAuthToken();
        if (!token) throw new Error("Unauthorized User");
        // Remove status=active to get ALL, but add limit to ensure we get enough
        const response = await api.get('/merchant/?limit=1000', {
            headers: { Authorization: `Bearer ${token}` }
        });
        return response.data;
    } catch (error) {
        throw new Error(error.response?.data?.message);
    }
}
