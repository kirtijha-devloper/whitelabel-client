import axios from 'axios';
import { BASE_URL } from "../constants";
import { getAuthToken } from '../utils/auth';

const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const getTransactionRates = async () => {
  try {
    const token = getAuthToken();
    if (!token) throw new Error("Not Authorized");

    const { data } = await api.get('/transaction-rate', {
      headers: { Authorization: `Bearer ${token}` }
    });
    // Assuming the API returns the list in a `data` property
    return data.data || [];
  } catch (error) {
    throw new Error(error.response?.data?.message || "Failed to fetch transaction rates");
  }
};

export const createTransactionRate = async (rateData) => {
  try {
    const token = getAuthToken();
    if (!token) throw new Error("Not Authorized");

    const { data } = await api.post('/transaction-rate', rateData, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return data.data;
  } catch (error) {
    throw new Error(error.response?.data?.message || "Failed to create transaction rate");
  }
};

export const updateTransactionRate = async ({ id, ...rateData }) => {
  try {
    const token = getAuthToken();
    if (!token) throw new Error("Not Authorized");

    const { data } = await api.put(`/transaction-rate/${id}`, rateData, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return data.data;
  } catch (error) {
    throw new Error(error.response?.data?.message || "Failed to update transaction rate");
  }
};

export const deleteTransactionRate = async (id) => {
  try {
    const token = getAuthToken();
    if (!token) throw new Error("Not Authorized");

    const { data } = await api.delete(`/transaction-rate/${id}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return data;
  } catch (error) {
    throw new Error(error.response?.data?.message || "Failed to delete transaction rate");
  }
};