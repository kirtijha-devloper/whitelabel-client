import axios from 'axios';
import { BASE_URL } from "../constants";
import { getAuthToken } from '../utils/auth';

const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const getDefaultRateItems = async (role = 'merchant') => {
  try {
    const token = getAuthToken();
    if (!token) throw new Error("Not Authorized");

    const { data } = await api.get(`/default-rate?role=${role}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log(data);
    return data.data || [];
  } catch (error) {
    throw new Error(error.response?.data?.message || "Failed to fetch user rate items");
  }
};
