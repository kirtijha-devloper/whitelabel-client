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

export const getSevenPayBeneficiaries = async (merchantId) => {
  try {
    const res = await api.get(`/sevenpay/beneficiaries/${merchantId}`, {
      headers: authHeaders(),
    });
    return res.data;
  } catch (error) {
    throw new Error(error?.response?.data?.message || 'Failed to fetch beneficiaries');
  }
};

export const addSevenPayBeneficiary = async (payload) => {
  try {
    const res = await api.post('/sevenpay/beneficiaries', payload, {
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

export const deleteSevenPayBeneficiary = async (id, merchantId) => {
  try {
    const res = await api.delete(`/sevenpay/beneficiaries/${id}`, {
      headers: authHeaders(),
      params: { merchantId },
    });
    return res.data;
  } catch (error) {
    throw new Error(error?.response?.data?.message || 'Failed to delete beneficiary');
  }
};

export const initiateSevenPayPayout = async (payload) => {
  try {
    const res = await api.post('/sevenpay/payout', payload, {
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

export const checkSevenPayPayoutStatus = async (payload) => {
  try {
    const res = await api.post('/sevenpay/payout/status', payload, {
      headers: authHeaders(),
    });
    return res.data;
  } catch (error) {
    throw new Error(error?.response?.data?.message || 'Failed to check payout status');
  }
};

export const manualSevenPayPayoutRefund = async (payload) => {
  try {
    const res = await api.post('/sevenpay/payout/manual-refund', payload, {
      headers: authHeaders(),
    });
    return res.data;
  } catch (error) {
    const err = new Error(error?.response?.data?.message || 'Failed to issue SevenPay manual refund');
    err.status = error?.response?.status;
    err.response = error?.response;
    throw err;
  }
};

export const getSevenPayPayoutTransactions = async (params = {}) => {
  try {
    const res = await api.get('/sevenpay/payout-transactions', {
      headers: authHeaders(),
      params,
    });
    return res.data;
  } catch (error) {
    throw new Error(error?.response?.data?.message || 'Failed to fetch payout transactions');
  }
};

export const getSevenPayPayoutAuditLogs = async (params = {}) => {
  try {
    const res = await api.get('/sevenpay/payout/audit-logs', {
      headers: authHeaders(),
      params,
    });
    return res.data;
  } catch (error) {
    const err = new Error(error?.response?.data?.message || 'Failed to fetch payout audit logs');
    err.status = error?.response?.status;
    err.response = error?.response;
    throw err;
  }
};

export const getSevenPayPayoutAuditLogsByPayout = async (params = {}) => {
  try {
    const url = api.getUri({
      url: '/sevenpay/payout/audit-logs/by-payout',
      params,
    });
    console.log('[getSevenPayPayoutAuditLogsByPayout] final URL:', url);

    const res = await api.get('/sevenpay/payout/audit-logs/by-payout', {
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

export const validateSevenPayBankAccount = async (payload) => {
  try {
    const res = await api.post('/sevenpay/bank/validation', payload, {
      headers: authHeaders(),
    });
    return res.data;
  } catch (error) {
    throw new Error(error?.response?.data?.message || 'Failed to validate bank account');
  }
};

export const getSevenPayPayoutReference = async (merchantId) => {
  try {
    const res = await api.get('/sevenpay/payout/reference', {
      headers: authHeaders(),
      params: { merchantId },
    });
    return res.data;
  } catch (error) {
    throw new Error(error?.response?.data?.message || 'Failed to fetch payout reference');
  }
};

export const getSevenPayWalletBalance = async (orgId = 47716) => {
  try {
    const res = await api.get('/sevenpay/payout/balance', {
      headers: authHeaders(),
      params: { orgId },
    });
    return res.data;
  } catch (error) {
    const err = new Error(error?.response?.data?.message || 'Failed to fetch SevenPay wallet balance');
    err.status = error?.response?.status;
    err.response = error?.response;
    throw err;
  }
};

