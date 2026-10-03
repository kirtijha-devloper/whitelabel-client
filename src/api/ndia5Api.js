import axios from 'axios';
import { getAuthToken } from '../utils/auth';
import { BASE_URL } from '../constants';

const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

const authHeaders = () => {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const getNdia5Beneficiaries = async (merchantId) => {
  try {
    const res = await api.get(`/ndia5/beneficiaries/${merchantId}`, {
      headers: authHeaders(),
    });
    return res.data;
  } catch (error) {
    throw new Error(error?.response?.data?.message || 'Failed to fetch beneficiaries');
  }
};

export const addNdia5Beneficiary = async (payload) => {
  try {
    const res = await api.post('/ndia5/beneficiaries', payload, {
      headers: authHeaders(),
    });
    return res.data;
  } catch (error) {
    const err = new Error(error?.response?.data?.message || 'Failed to add beneficiary');
    err.status = error?.response?.status;
    err.response = error?.response;
    throw err;
  }
};

export const deleteNdia5Beneficiary = async (id, merchantId) => {
  try {
    const res = await api.delete(`/ndia5/beneficiaries/${id}`, {
      headers: authHeaders(),
      params: { merchantId },
    });
    return res.data;
  } catch (error) {
    throw new Error(error?.response?.data?.message || 'Failed to delete beneficiary');
  }
};

export const initiateNdia5Payout = async (payload) => {
  try {
    const res = await api.post('/ndia5/payout', payload, {
      headers: authHeaders(),
    });
    return res.data;
  } catch (error) {
    const err = new Error(error?.response?.data?.message || 'Failed to process payout');
    err.status = error?.response?.status;
    err.response = error?.response;
    throw err;
  }
};

export const checkNdia5PayoutStatus = async (payload) => {
  try {
    const res = await api.post('/ndia5/payout/status', payload, {
      headers: authHeaders(),
    });
    return res.data;
  } catch (error) {
    throw new Error(error?.response?.data?.message || 'Failed to check payout status');
  }
};

export const checkNdia5DebugStatus = async (payload) => {
  try {
    const res = await api.post('/ndia5/payout/debug-status', payload, {
      headers: authHeaders(),
    });
    return res.data;
  } catch (error) {
    throw new Error(error?.response?.data?.message || 'Failed to check debug payout status');
  }
};

export const manualNdia5PayoutRefund = async (payload) => {
  try {
    const res = await api.post('/ndia5/payout/manual-refund', payload, {
      headers: authHeaders(),
    });
    return res.data;
  } catch (error) {
    const err = new Error(error?.response?.data?.message || 'Failed to issue NDIA5 manual refund');
    err.status = error?.response?.status;
    err.response = error?.response;
    throw err;
  }
};

export const getNdia5PayoutAuditLogsByPayout = async (params = {}) => {
  try {
    const res = await api.get('/ndia5/payout/audit-logs/by-payout', {
      headers: authHeaders(),
      params,
    });
    return res.data;
  } catch (error) {
    const err = new Error(error?.response?.data?.message || 'Failed to fetch payout audit logs by payout');
    err.status = error?.response?.status;
    err.response = error?.response;
    throw err;
  }
};

export const getNdia5PayoutReference = async (merchantId) => {
  try {
    const res = await api.get('/ndia5/payout/reference', {
      headers: authHeaders(),
      params: { merchantId },
    });
    return res.data;
  } catch (error) {
    throw new Error(error?.response?.data?.message || 'Failed to fetch payout reference');
  }
};

export const getNdia5WalletBalance = async () => {
  try {
    const res = await api.get('/ndia5/payout/balance', {
      headers: authHeaders(),
    });
    return res.data;
  } catch (error) {
    const err = new Error(error?.response?.data?.message || 'Failed to fetch NDIA5 wallet balance');
    err.status = error?.response?.status;
    err.response = error?.response;
    throw err;
  }
};
