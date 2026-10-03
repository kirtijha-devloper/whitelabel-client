import axios from 'axios';
import { getAuthToken } from '../utils/auth';
import { BASE_URL } from '../constants';

const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = getAuthToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 1. GET /categories
export const getCategories = async () => {
  try {
    const response = await api.get('/bbps-cc/categories');
    return response.data;
  } catch (error) {
    throw new Error(error.response?.data?.message || 'Failed to fetch categories');
  }
};

// 2. GET /billers
export const getBillers = async () => {
  try {
    const response = await api.get('/bbps-cc/billers');
    return response.data;
  } catch (error) {
    throw new Error(error.response?.data?.message || 'Failed to fetch billers');
  }
};

// 3. POST /biller-details
export const getBillerDetails = async (billerId) => {
  try {
    const response = await api.post('/bbps-cc/biller-details', { billerId });
    return response.data;
  } catch (error) {
    throw new Error(error.response?.data?.message || 'Failed to fetch biller details');
  }
};

// 4. POST /pre-payment-enquiry
export const prePaymentEnquiry = async (data) => {
  try {
    const response = await api.post('/bbps-cc/pre-payment-enquiry', data);
    return response.data;
  } catch (error) {
    throw new Error(error.response?.data?.message || 'Pre-payment enquiry failed');
  }
};

// 5. POST /pay
export const executePayment = async (data) => {
  try {
    const response = await api.post('/bbps-cc/pay', data);
    return response.data;
  } catch (error) {
    throw new Error(error.response?.data?.message || 'CC bill payment failed');
  }
};
