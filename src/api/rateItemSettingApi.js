import axios from 'axios';
import { BASE_URL } from "../constants";
import { getAuthToken } from '../utils/auth';

const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Get all rate items
export const getRateItems = async () => {
  try {
    const token = getAuthToken();
    if (!token) throw new Error("Not Authorized");

    const { data } = await api.get('/rate-items', {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log(data.data);
    return data.data || [];
  } catch (error) {
    throw new Error(error.response?.data?.message || "Failed to fetch rate items");
  }
};

// Create new rate item
export const createRateItem = async (rateItemData) => {
  try {
    const token = getAuthToken();
    if (!token) throw new Error("Not Authorized");

    const { data } = await api.post('/rate-items', rateItemData, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return data.data;
  } catch (error) {
    throw new Error(error.response?.data?.message || "Failed to create rate item");
  }
};

// Update existing rate item
export const updateRateItem = async ({ id, ...rateItemData }) => {
  try {
    const token = getAuthToken();
    if (!token) throw new Error("Not Authorized");

    const { data } = await api.put(`/rate-items/${id}`, rateItemData, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return data.data;
  } catch (error) {
    throw new Error(error.response?.data?.message || "Failed to update rate item");
  }
};

// Delete rate item
export const deleteRateItem = async (id) => {
  try {
    const token = getAuthToken();
    if (!token) throw new Error("Not Authorized");

    const { data } = await api.delete(`/rate-items/${id}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return data;
  } catch (error) {
    throw new Error(error.response?.data?.message || "Failed to delete rate item");
  }
};

// Get single rate item by ID
export const getRateItemById = async (id) => {
  try {
    const token = getAuthToken();
    if (!token) throw new Error("Not Authorized");

    const { data } = await api.get(`/rate-items/${id}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return data.data;
  } catch (error) {
    throw new Error(error.response?.data?.message || "Failed to fetch rate item");
  }
};
