import axios from 'axios';
import { getAuthToken } from '../utils/auth';
import { BASE_URL } from '../constants';

const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Normalizes machine status string into standard status keys
 */
export const normalizeMachineStatus = (value) => {
  const raw = String(value || '').trim().toLowerCase().replace(/_/g, '-');
  if (!raw) return 'unknown';
  if (raw === 'in-active' || raw === 'inactive' || raw === 'deactive') return 'inactive';
  if (raw === 'return-initiated' || raw === 'returned-initiated') return 'returned-initiated';
  return raw;
};

/**
 * Fetches POS machines strictly assigned to the authenticated merchant.
 * Prioritizes the dedicated GET /api/merchant/stock-pos endpoint,
 * with seamless fallback to GET /api/pos-machine/list (which enforces server-side merchant scoping).
 */
export const getMerchantStockPosMachines = async ({
  status = null,
  search = null,
  bankName = null,
  tidNumber = null,
  midNumber = null,
  deviceSerialNumber = null,
  page = 1,
  limit = 10,
} = {}) => {
  const token = getAuthToken();
  if (!token) {
    throw new Error('Not Authorized: Missing authentication session');
  }

  const params = new URLSearchParams();
  if (status && String(status).toLowerCase().trim() !== 'all') {
    params.append('status', status);
  }
  if (search && String(search).trim()) {
    params.append('search', String(search).trim());
  }
  if (bankName && String(bankName).trim()) {
    params.append('bank_name', String(bankName).trim());
  }
  if (tidNumber && String(tidNumber).trim()) {
    params.append('tid_number', String(tidNumber).trim());
  }
  if (midNumber && String(midNumber).trim()) {
    params.append('mid_number', String(midNumber).trim());
  }
  if (deviceSerialNumber && String(deviceSerialNumber).trim()) {
    params.append('device_serial_number', String(deviceSerialNumber).trim());
  }
  params.append('page', page);
  params.append('limit', limit);

  const headers = {
    Authorization: `Bearer ${token}`,
  };

  // Try dedicated merchant stock POS endpoint first
  try {
    const response = await api.get(`/merchant/stock-pos?${params.toString()}`, { headers });
    const payload = response.data || {};
    const machines = payload.data || payload.list || [];

    const normalizedMachines = machines.map((machine) => ({
      ...machine,
      status: normalizeMachineStatus(machine.status),
    }));

    const totalCount = Number(
      payload.summary?.totalAssigned ??
      payload.totalItems ??
      payload.pagination?.total ??
      normalizedMachines.length
    );

    const activeCount = Number(
      payload.summary?.activeMachines ??
      normalizedMachines.filter((m) => m.status === 'active').length
    );

    const inactiveCount = Number(
      payload.summary?.inactiveMachines ??
      normalizedMachines.filter((m) => m.status !== 'active').length
    );

    return {
      data: normalizedMachines,
      summary: {
        totalAssigned: totalCount,
        activeMachines: activeCount,
        inactiveMachines: inactiveCount,
      },
      pagination: {
        total: totalCount,
        page: Number(payload.currentPage || payload.pagination?.page || page),
        limit: Number(payload.pagination?.limit || limit),
        totalPages: Number(payload.totalPages || payload.pagination?.totalPages || Math.ceil(totalCount / limit) || 1),
      },
    };
  } catch (err) {
    // Fallback to /pos-machine/list if dedicated endpoint is not yet mounted on remote server
    if (err?.response?.status === 404) {
      const response = await api.get(`/pos-machine/list?${params.toString()}`, { headers });
      const payload = response.data || {};
      const machines = payload.data || payload.list || [];

      const normalizedMachines = machines.map((machine) => ({
        ...machine,
        status: normalizeMachineStatus(machine.status),
      }));

      const totalCount = Number(payload.totalItems ?? payload.pagination?.total ?? normalizedMachines.length);
      const activeCount = normalizedMachines.filter((m) => m.status === 'active').length;
      const inactiveCount = normalizedMachines.filter((m) => m.status !== 'active').length;

      return {
        data: normalizedMachines,
        summary: {
          totalAssigned: totalCount,
          activeMachines: activeCount,
          inactiveMachines: inactiveCount,
        },
        pagination: {
          total: totalCount,
          page: Number(payload.currentPage || payload.pagination?.page || page),
          limit: Number(payload.pagination?.limit || limit),
          totalPages: Number(payload.totalPages || payload.pagination?.totalPages || Math.ceil(totalCount / limit) || 1),
        },
      };
    }

    throw new Error(err?.response?.data?.message || err.message || 'Failed to fetch assigned POS machines');
  }
};

