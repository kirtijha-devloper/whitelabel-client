import axios from 'axios';
import { getAuthToken } from '../utils/auth';
import { BASE_URL } from '../constants';

const getBaseUrl = () => {
  const envUrl = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) || 
                 (typeof process !== 'undefined' && process.env?.REACT_APP_API_URL) || '';
  if (envUrl) {
    return envUrl.endsWith('/api') ? envUrl.slice(0, -4) : envUrl;
  }
  if (BASE_URL) {
    return BASE_URL.endsWith('/api') ? BASE_URL.slice(0, -4) : BASE_URL;
  }
  return '';
};

const API_BASE_URL = getBaseUrl();


/**
 * Auth helper: retrieves token from auth utility or localStorage fallback
 */
const getAuthHeader = () => {
  const token = getAuthToken() || localStorage.getItem('token');
  return {
    headers: {
      Authorization: token ? `Bearer ${token}` : '',
      'Content-Type': 'application/json',
    },
  };
};

export const SuperAdminRateService = {
  // 1. Fetch Admin Users List for Dropdown
  getAdmins: async () => {
    const res = await axios.get(`${API_BASE_URL}/api/super-admin/getAllAdmins`, getAuthHeader());
    return res.data;
  },

  // 2. List POS Rate Rules
  getPosRules: async (params = {}) => {
    const res = await axios.get(`${API_BASE_URL}/api/super-admin/rate-settings/pos`, {
      ...getAuthHeader(),
      params,
    });
    return res.data;
  },

  // 3. Create Rate Rule
  createPosRule: async (ruleData) => {
    const res = await axios.post(
      `${API_BASE_URL}/api/super-admin/rate-settings/pos`,
      ruleData,
      getAuthHeader()
    );
    return res.data;
  },

  // 4. Update Rate Rule
  updatePosRule: async (id, ruleData) => {
    const res = await axios.put(
      `${API_BASE_URL}/api/super-admin/rate-settings/pos/${id}`,
      ruleData,
      getAuthHeader()
    );
    return res.data;
  },

  // 5. Delete Rate Rule
  deletePosRule: async (id) => {
    const res = await axios.delete(
      `${API_BASE_URL}/api/super-admin/rate-settings/pos/${id}`,
      getAuthHeader()
    );
    return res.data;
  },

  // Payout Slabs
  getPayoutSlabs: async (params = {}) => {
    const res = await axios.get(`${API_BASE_URL}/api/super-admin/rate-settings/payout`, {
      ...getAuthHeader(),
      params,
    });
    return res.data;
  },
  createPayoutSlab: async (data) => {
    const res = await axios.post(`${API_BASE_URL}/api/super-admin/rate-settings/payout`, data, getAuthHeader());
    return res.data;
  },
  updatePayoutSlab: async (id, data) => {
    const res = await axios.put(`${API_BASE_URL}/api/super-admin/rate-settings/payout/${id}`, data, getAuthHeader());
    return res.data;
  },

  // User Payout Overrides
  getUserPayoutOverrides: async (params = {}) => {
    const res = await axios.get(`${API_BASE_URL}/api/super-admin/rate-settings/user-payout`, {
      ...getAuthHeader(),
      params,
    });
    return res.data;
  },
  createUserPayoutOverride: async (data) => {
    const res = await axios.post(`${API_BASE_URL}/api/super-admin/rate-settings/user-payout`, data, getAuthHeader());
    return res.data;
  },
  updateUserPayoutOverride: async (id, data) => {
    const res = await axios.put(`${API_BASE_URL}/api/super-admin/rate-settings/user-payout/${id}`, data, getAuthHeader());
    return res.data;
  },

  // General Charge Slabs
  getGeneralSlabs: async (params = {}) => {
    const res = await axios.get(`${API_BASE_URL}/api/super-admin/rate-settings/slabs`, {
      ...getAuthHeader(),
      params,
    });
    return res.data;
  },
  createGeneralSlab: async (data) => {
    const res = await axios.post(`${API_BASE_URL}/api/super-admin/rate-settings/slabs`, data, getAuthHeader());
    return res.data;
  },
  updateGeneralSlab: async (id, data) => {
    const res = await axios.put(`${API_BASE_URL}/api/super-admin/rate-settings/slabs/${id}`, data, getAuthHeader());
    return res.data;
  },

  // Service Fees
  getServiceFees: async (params = {}) => {
    const res = await axios.get(`${API_BASE_URL}/api/super-admin/rate-settings/service-fees`, {
      ...getAuthHeader(),
      params,
    });
    return res.data;
  },
  createServiceFee: async (data) => {
    const res = await axios.post(`${API_BASE_URL}/api/super-admin/rate-settings/service-fees`, data, getAuthHeader());
    return res.data;
  },
  updateServiceFee: async (id, data) => {
    const res = await axios.put(`${API_BASE_URL}/api/super-admin/rate-settings/service-fees/${id}`, data, getAuthHeader());
    return res.data;
  },

  // Commissions
  getCommissions: async (params = {}) => {
    const res = await axios.get(`${API_BASE_URL}/api/super-admin/rate-settings/commissions`, {
      ...getAuthHeader(),
      params,
    });
    return res.data;
  },
  createCommission: async (data) => {
    const res = await axios.post(`${API_BASE_URL}/api/super-admin/rate-settings/commissions`, data, getAuthHeader());
    return res.data;
  },
  updateCommission: async (id, data) => {
    const res = await axios.put(`${API_BASE_URL}/api/super-admin/rate-settings/commissions/${id}`, data, getAuthHeader());
    return res.data;
  },
};

export default SuperAdminRateService;
