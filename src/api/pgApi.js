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
 * Step 1: Initiate a PG Order
 * @param {Object} payload - { gateway: 'pg_1' | 'pg_2', amount: number, return_url?: string }
 */
export const createPgOrder = async (payload) => {
  try {
    const res = await api.post('/pg/create-order', payload, {
      headers: authHeaders(),
    });
    return res.data;
  } catch (error) {
    throw new Error(error?.response?.data?.message || 'Failed to initiate payment order');
  }
};

/**
 * Fetch list of PG transactions
 * @param {Object} params - { gateway, status, page, limit, search }
 */
export const getPgTransactions = async (params = {}) => {
  try {
    const res = await api.get('/pg/transactions', {
      headers: authHeaders(),
      params,
    });
    return res.data;
  } catch (error) {
    throw new Error(error?.response?.data?.message || 'Failed to fetch PG transactions');
  }
};

/**
 * Fetch single order status
 * @param {string|number} orderId
 */
export const getPgOrderStatus = async (orderId) => {
  try {
    const res = await api.get(`/pg/order/${orderId}`, {
      headers: authHeaders(),
    });
    return res.data;
  } catch (error) {
    throw new Error(error?.response?.data?.message || 'Failed to fetch order status');
  }
};
