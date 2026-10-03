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

export const getMxBeneficiaries = async (merchantId) => {
  try {
    const res = await api.get(`/payout-m-x/beneficiaries/${merchantId}`, {
      headers: authHeaders(),
    });
    return res.data;
  } catch (error) {
    throw new Error(error?.response?.data?.message || 'Failed to fetch beneficiaries');
  }
};

export const addMxBeneficiary = async (payload) => {
  try {
    const res = await api.post('/payout-m-x/beneficiaries', payload, {
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

export const deleteMxBeneficiary = async (id, merchantId) => {
  try {
    const res = await api.delete(`/payout-m-x/beneficiaries/${id}`, {
      headers: authHeaders(),
      params: { merchantId },
    });
    return res.data;
  } catch (error) {
    throw new Error(error?.response?.data?.message || 'Failed to delete beneficiary');
  }
};

export const initiateMxPayout = async (payload) => {
  try {
    const res = await api.post('/payout-m-x/payout/initiate', payload, {
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

export const checkMxPayoutStatus = async (payload) => {
  try {
    const res = await api.post('/payout-m-x/payout/status', payload, {
      headers: authHeaders(),
    });
    return res.data;
  } catch (error) {
    throw new Error(error?.response?.data?.message || 'Failed to check payout status');
  }
};

export const manualMxPayoutRefund = async (payload) => {
  try {
    const res = await api.post('/payout-m-x/payout/manual-refund', payload, {
      headers: authHeaders(),
    });
    return res.data;
  } catch (error) {
    const err = new Error(error?.response?.data?.message || 'Failed to issue manual refund');
    err.status = error?.response?.status;
    err.response = error?.response;
    throw err;
  }
};

export const getMxPayoutReference = async (merchantId) => {
  try {
    const res = await api.get('/payout-m-x/payout/reference', {
      headers: authHeaders(),
      params: { merchantId },
    });
    return res.data;
  } catch (error) {
    throw new Error(error?.response?.data?.message || 'Failed to fetch payout reference');
  }
};

export const getMxPayoutAuditLogsByPayout = async (params) => {
  try {
    const res = await api.get('/payout-m-x/payout/audit-logs', {
      headers: authHeaders(),
      params,
    });
    return res.data;
  } catch (error) {
    throw new Error(error?.response?.data?.message || 'Failed to fetch payout audit logs');
  }
};
