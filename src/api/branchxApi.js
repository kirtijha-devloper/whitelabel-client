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

// Step 2 — List Beneficiaries
// GET /payment/v2/beneficiaries/:merchant_id
export const getBranchXBeneficiaries = async (merchantId) => {
  try {
    const res = await api.get(`/payment/v2/beneficiaries/${merchantId}`, {
      headers: authHeaders(),
    });
    return res.data;
  } catch (error) {
    throw new Error(error?.response?.data?.message || 'Failed to fetch beneficiaries');
  }
};

// Step 3 — Add Beneficiary
// POST /payment/v2/add-beneficiary
// Server performs penny-drop validation; beneficiary_name stored will be from bank record.
export const addBranchXBeneficiary = async (payload) => {
  try {
    const res = await api.post('/payment/v2/add-beneficiary', payload, {
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

// Step 4 — Delete Beneficiary (soft-delete)
// DELETE /payment/v2/beneficiary/:id?merchantId=<merchant_id>
export const deleteBranchXBeneficiary = async (id, merchantId) => {
  try {
    const res = await api.delete(`/payment/v2/beneficiary/${id}`, {
      headers: authHeaders(),
      params: { merchantId },
    });
    return res.data;
  } catch (error) {
    throw new Error(error?.response?.data?.message || 'Failed to delete beneficiary');
  }
};

// Step 5 — Initiate Payout
// POST /payment/v2/payout
export const initiateBranchXPayout = async (payload) => {
  try {
    const res = await api.post('/payment/v2/payout', payload, {
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

// Step 6 — Check Payout Status
// POST /payment/v2/payout/status-check
// payload: { payout_transaction_id: number } OR { requestId: string }
export const checkBranchXPayoutStatus = async (payload) => {
  try {
    const res = await api.post('/payment/v2/payout/status-check', payload, {
      headers: authHeaders(),
    });
    return res.data;
  } catch (error) {
    throw new Error(error?.response?.data?.message || 'Failed to check payout status');
  }
};

// Step 6.5 — Manual Refund for BranchX Payout
// POST /payment/v2/payout/manual-refund
export const manualBranchXPayoutRefund = async (payload) => {
  try {
    const res = await api.post('/payment/v2/payout/manual-refund', payload, {
      headers: authHeaders(),
    });
    return res.data;
  } catch (error) {
    const err = new Error(error?.response?.data?.message || 'Failed to issue BranchX manual refund');
    err.status = error?.response?.status;
    err.response = error?.response;
    throw err;
  }
};

// Step 7 — List Payout Transactions
// GET /payment/v2/payout-transactions
export const getBranchXPayoutTransactions = async (params = {}) => {
  try {
    const res = await api.get('/payment/v2/payout-transactions', {
      headers: authHeaders(),
      params,
    });
    return res.data;
  } catch (error) {
    throw new Error(error?.response?.data?.message || 'Failed to fetch payout transactions');
  }
};

// Step 8 — Get Payout Audit Logs
// GET /payment/v2/payout/audit-logs
export const getBranchXPayoutAuditLogs = async (params = {}) => {
  try {
    const res = await api.get('/payment/v2/payout/audit-logs', {
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

// Step 9 — Get Payout Audit Logs by Payout ID or Request ID
// GET /payment/v2/payout/audit-logs/by-payout
export const getBranchXPayoutAuditLogsByPayout = async (params = {}) => {
  try {
    const url = api.getUri({
      url: '/payment/v2/payout/audit-logs/by-payout',
      params,
    });
    console.log('[getBranchXPayoutAuditLogsByPayout] final URL:', url);

    const res = await api.get('/payment/v2/payout/audit-logs/by-payout', {
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

// Supplementary — Standalone Bank Account Validation
// POST /payment/v2/bank/validation
export const validateBranchXBankAccount = async (payload) => {
  try {
    const res = await api.post('/payment/v2/bank/validation', payload, {
      headers: authHeaders(),
    });
    return res.data;
  } catch (error) {
    throw new Error(error?.response?.data?.message || 'Failed to validate bank account');
  }
};
