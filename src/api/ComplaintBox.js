import axios from 'axios';
import { getAuthToken } from '../utils/auth';
import { BASE_URL } from '../constants';

const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const complaintIssues = async (complaintData) => {
  try {
    const token = getAuthToken();
    if (!token) throw new Error('Not Authorized');

    const response = await api.post('/complaint/submit', complaintData, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return response.data;
  } catch (error) {
    throw new Error(error.response?.data?.message || 'Complaint submission failed');
  }
};

export const getComplaintIssues = async () => {
  try {
    const token = getAuthToken();
    if (!token) throw new Error('Not Authorized');

    const response = await api.get('/complaint', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return response.data;
  } catch (error) {
    throw new Error(error.response?.data?.message || 'Failed to fetch complaints');
  }
};

export const updateComplaintStatus = async (complaintId, status, reply = '') => {
  try {
    const token = getAuthToken();
    if (!token) throw new Error('Not Authorized');

    const response = await api.put(
      `/complaint/${complaintId}/status`,
      { status, reply, admin_reply: reply },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
    return response.data;
  } catch (error) {
    throw new Error(error.response?.data?.message || 'Failed to update complaint status');
  }
};