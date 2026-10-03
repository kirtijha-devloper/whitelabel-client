import axios from 'axios';
import { BASE_URL } from "../constants";
import { getAuthToken } from '../utils/auth';

const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ===== RATE ITEMS API =====

// Get all rate items for a specific user
export const getUserRateItems = async (userId) => {
  try {
    const token = getAuthToken();
    if (!token) throw new Error("Not Authorized");

    const { data } = await api.get(`/user-rate-settings/rate-items/${userId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log(data);
    return data.data || [];
  } catch (error) {
    throw new Error(error.response?.data?.message || "Failed to fetch user rate items");
  }
};

// Create new rate item for a specific user
export const createUserRateItem = async (userId, rateItemData) => {
  try {
    const token = getAuthToken();
    if (!token) throw new Error("Not Authorized");

    const { data } = await api.post(`/user-rate-settings/rate-items/${userId}`, rateItemData, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return data.data;
  } catch (error) {
    throw new Error(error.response?.data?.message || "Failed to create user rate item");
  }
};

// Update existing rate item for a specific user
export const updateUserRateItem = async (payload) => {
  console.log("Updating user rate item:", { payload });
  try {
    const token = getAuthToken();
    if (!token) throw new Error("Not Authorized");
    const { data } = await api.put(`/user-rate-settings/rate-items/${payload.userId}/${payload.rateId}`, payload, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return data.data;
  } catch (error) {
    throw new Error(error.response?.data?.message || "Failed to update user rate item");
  }
};

// Delete rate item for a specific user
export const deleteUserRateItem = async (userId, itemId) => {
  try {
    const token = getAuthToken();
    if (!token) throw new Error("Not Authorized");

    const { data } = await api.delete(`/rate-items/${userId}/${itemId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return data;
  } catch (error) {
    throw new Error(error.response?.data?.message || "Failed to delete user rate item");
  }
};

// ===== BULK OPERATIONS API =====

// Bulk update user rates
export const bulkUpdateUserRates = async (userId, bulkUpdateData) => {
  try {
    const token = getAuthToken();
    if (!token) throw new Error("Not Authorized");

    const { data } = await api.post(`/bulk-update/${userId}`, bulkUpdateData, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return data.data;
  } catch (error) {
    throw new Error(error.response?.data?.message || "Failed to bulk update user rates");
  }
};
