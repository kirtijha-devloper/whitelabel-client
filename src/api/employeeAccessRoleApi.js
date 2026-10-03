import axios from 'axios';
import { BASE_URL } from '../constants';
import { getAuthToken } from '../utils/auth';

const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

const ROLE_BASE = '/admin/employee-access-roles';

const getAuthHeaders = () => {
  const token = getAuthToken();
  if (!token) {
    throw new Error('No token found');
  }
  return {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };
};

const toApiError = (error, fallbackMessage) =>
  new Error(error?.response?.data?.message || error?.message || fallbackMessage);

export const fetchEmployeeAccessRoleMeta = async () => {
  try {
    const response = await api.get(`${ROLE_BASE}/meta`, getAuthHeaders());
    const payload = response.data;
    if (Array.isArray(payload)) {
      return payload[0]?.data || payload[0] || {};
    }
    return payload?.data || payload || {};
  } catch (error) {
    throw toApiError(error, 'Failed to load access role metadata');
  }
};

export const fetchEmployeeAccessRoles = async () => {
  try {
    const response = await api.get(ROLE_BASE, getAuthHeaders());
    const payload = response.data;
    if (Array.isArray(payload)) {
      return payload[0]?.data || payload[0] || [];
    }
    return payload?.data || payload || [];
  } catch (error) {
    throw toApiError(error, 'Failed to load access roles');
  }
};

export const fetchEmployeeAccessRole = async (id) => {
  try {
    const response = await api.get(`${ROLE_BASE}/${id}`, getAuthHeaders());
    const payload = response.data;
    if (Array.isArray(payload)) {
      return payload[0]?.data || payload[0] || {};
    }
    return payload?.data || payload || {};
  } catch (error) {
    throw toApiError(error, 'Failed to load access role');
  }
};

export const createEmployeeAccessRole = async (payload) => {
  try {
    const response = await api.post(ROLE_BASE, payload, getAuthHeaders());
    return response.data;
  } catch (error) {
    throw toApiError(error, 'Failed to create access role');
  }
};

export const updateEmployeeAccessRole = async ({ id, payload }) => {
  try {
    const response = await api.put(`${ROLE_BASE}/${id}`, payload, getAuthHeaders());
    return response.data;
  } catch (error) {
    throw toApiError(error, 'Failed to update access role');
  }
};

export const deleteEmployeeAccessRole = async (id) => {
  try {
    const response = await api.delete(`${ROLE_BASE}/${id}`, getAuthHeaders());
    return response.data;
  } catch (error) {
    throw toApiError(error, 'Failed to delete access role');
  }
};
