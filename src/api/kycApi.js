import axios from 'axios';
import { getAuthToken } from '../utils/auth';
import { BASE_URL } from '../constants';

// This is a mock API service until the actual backend endpoints are provided.
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

// Get KYC Profile (Pre-filled Data - from /api/kyc/info)
export const getKycProfile = async () => {
  try {
    const response = await api.get('/kyc/info');
    return response.data; // Expected format: { success, data: { mobile, email, aadhaar, pan, isKycDone } }
  } catch (error) {
    throw new Error(error.response?.data?.message || 'Failed to fetch KYC info');
  }
};

// Generate KYC OTP (Initiate KYC)
export const generateKycOtp = async (kycData) => {
  try {
    // kycData should contain: mobile, email, aadhaar, pan, bankAccountNo, bankIfsc, consent, latitude, longitude, forceReset
    const response = await api.post('/kyc/initiate', kycData);
    return response.data; // Expected format: { success, message, data: { otpReferenceID, hash } }
  } catch (error) {
    throw new Error(error.response?.data?.message || 'Failed to initiate KYC and generate OTP');
  }
}

// Final Submit KYC (Validate OTP)
export const submitKyc = async (otpData) => {
  try {
    // otpData should contain: otpReferenceID, hash, otp
    const response = await api.post('/kyc/validate-otp', otpData);
    return response.data; // Expected format: { success, message, data: { outletId, ipayResponse } }
  } catch (error) {
    throw new Error(error.response?.data?.message || 'Invalid OTP or validation failed');
  }
};
