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

/**
 * Fetch all verified beneficiaries.
 * Admin: all beneficiaries in system.
 * Franchise / Merchant: user-scoped beneficiaries.
 */
export const getPayoutBeneficiaries = async () => {
  try {
    const res = await api.get('/payout/beneficiaries', {
      headers: authHeaders(),
    });
    return res.data;
  } catch (error) {
    throw new Error(error?.response?.data?.message || 'Failed to fetch payout beneficiaries');
  }
};

/**
 * Update an existing beneficiary record.
 */
export const updatePayoutBeneficiary = async (id, payload) => {
  try {
    const res = await api.put(`/payout/beneficiaries/${id}`, payload, {
      headers: authHeaders(),
    });
    return res.data;
  } catch (error) {
    throw new Error(error?.response?.data?.message || 'Failed to update payout beneficiary');
  }
};

