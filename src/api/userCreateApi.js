import axios from 'axios';
import { getAuthToken } from '../utils/auth';
import { BASE_URL } from '../constants';
import { normalizeUserRole } from '../utils/userAccess';

const api = axios.create({
    baseURL: BASE_URL,
});

const FILE_FIELD_NAMES = new Set([
    'aadhar_photo',
    'aadhar_back_photo',
    'pan_photo',
    'bank_passbook',
    'shop_photo',
]);

const extractCreateUserDebugSnapshot = (userData) => {
    const snapshot = {
        technicalFields: {},
        providedFields: [],
        fileFields: {},
    };

    const recordEntry = (key, value) => {
        if (!key) return;

        snapshot.providedFields.push(key);

        if (FILE_FIELD_NAMES.has(key)) {
            snapshot.fileFields[key] = value && typeof value === 'object'
                ? {
                    name: value.name || null,
                    type: value.type || null,
                    size: typeof value.size === 'number' ? value.size : null,
                }
                : {
                    name: null,
                    type: null,
                    size: null,
                };
            return;
        }

        if (key === 'password') {
            snapshot.technicalFields.password = '[redacted]';
            return;
        }

        if (key === 'email' || key === 'mobile_number' || key === 'name') {
            snapshot.technicalFields[key] = value ? '[provided]' : '[empty]';
            return;
        }

        snapshot.technicalFields[key] = value;
    };

    if (userData instanceof FormData) {
        for (const [key, value] of userData.entries()) {
            recordEntry(key, value);
        }
        return snapshot;
    }

    if (userData && typeof userData === 'object') {
        Object.entries(userData).forEach(([key, value]) => recordEntry(key, value));
    }

    return snapshot;
};

const extractCreateUserErrorMessage = (error) => {
    const responseData = error?.response?.data;
    const validationMessages = Array.isArray(responseData?.errors)
        ? responseData.errors
            .map((item) => item?.message || item?.msg || item)
            .filter(Boolean)
        : [];

    if (validationMessages.length > 0) {
        return validationMessages.join(' ');
    }

    return responseData?.message || error?.message || 'User creation failed';
};

const normalizeCreateUserPayload = (userData) => {
    if (userData instanceof FormData) {
        const normalized = new FormData();
        for (const [key, value] of userData.entries()) {
            normalized.append(key, key === 'role' ? normalizeUserRole(value) : value);
        }
        return normalized;
    }

    if (userData && typeof userData === 'object') {
        return {
            ...userData,
            role: normalizeUserRole(userData.role),
        };
    }

    return userData;
};

export const createUser = async (userData) => {
    try {
        const token = getAuthToken();
        if (!token) throw new Error("Unauthorized User");

        const normalizedPayload = normalizeCreateUserPayload(userData);
        const debugSnapshot = extractCreateUserDebugSnapshot(normalizedPayload);

        console.info('[createUser] request payload', debugSnapshot);

        const response = await api.post('/user/register', normalizedPayload, {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });

        return response.data;
    } catch (error) {
        console.error('[createUser] request failed', {
            status: error?.response?.status ?? null,
            message: error?.response?.data?.message || error?.message || null,
            details: error?.response?.data ?? null,
        });
        throw new Error(extractCreateUserErrorMessage(error));
    }
};
