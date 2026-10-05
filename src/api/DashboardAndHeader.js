import axios from 'axios';
import { getAuthToken } from '../utils/auth';
import { BASE_URL } from '../constants';

const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const getDashboard = async () => {
  try {
    console.log("🔥 getDashboard STARTED");

    const token = getAuthToken();
    if (!token) throw new Error("User Not Authorized");

    const response = await api.get('/dashboard/', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    console.log("🔥 getDashboard RESPONSE:", response);
    return response.data;
  }
  catch (error) {
    throw new Error(error?.response?.data?.message || "Something went wrong");
  }
}

export const getTodayPayout = async () => {
  try {
    const token = getAuthToken();
    if (!token) throw new Error("User Not Authorized");

    const response = await api.get('/dashboard/today-payouts', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    return response.data;
  }
  catch (error) {
    throw new Error(error?.response?.data?.message || "Something went wrong");
  }
}