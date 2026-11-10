import axios from 'axios';
import { BASE_URL } from '../constants';
import { getAuthToken } from '../utils/auth';

const getAuthHeaders = () => {
  const token = getAuthToken();
  return {
    headers: {
      Authorization: `Bearer ${token}`
    }
  };
};

const PG_API_BASE = `${BASE_URL}/pg/charge-rules`;
const PG_LEGACY_BASE = `${BASE_URL}/pg-charge-rules`;

export const RULE_SCOPES = {
  SUPER_ADMIN_DEFAULT: 'super_admin_default',
  SUPER_ADMIN_ADMIN: 'super_admin_admin',
  ADMIN_DEFAULT: 'admin_default',
  ADMIN_SUPER_FRANCHISE: 'admin_super_franchise',
  SUPER_FRANCHISE_DEFAULT: 'super_franchise_default',
  SUPER_FRANCHISE_FRANCHISE: 'super_franchise_franchise',
  SUPER_FRANCHISE_MERCHANT: 'super_franchise_merchant',
  ADMIN_FRANCHISE: 'admin_franchise',
  ADMIN_MERCHANT: 'admin_merchant',
  FRANCHISE_DEFAULT: 'franchise_default',
  FRANCHISE_MERCHANT: 'franchise_merchant'
};

/**
 * Fetch PG Charge Rules with query params
 */
export const fetchPgChargeRules = async (params = {}) => {
  try {
    const config = {
      ...getAuthHeaders(),
      params
    };
    const response = await axios.get(PG_API_BASE, config);
    return response.data?.data || [];
  } catch (error) {
    try {
      const config = {
        ...getAuthHeaders(),
        params
      };
      const fallback = await axios.get(`${PG_LEGACY_BASE}/list`, config);
      return fallback.data?.data || [];
    } catch {
      console.error('fetchPgChargeRules error:', error);
      throw error;
    }
  }
};

/**
 * Fetch PG Charge Rules by audience: 'merchant', 'admin', 'franchise', 'all'
 */
export const fetchPgChargeRulesByAudience = async (audience = 'all', params = {}) => {
  try {
    const config = {
      ...getAuthHeaders(),
      params: { ...params, audience }
    };
    const response = await axios.get(PG_API_BASE, config);
    return response.data?.data || [];
  } catch (error) {
    try {
      const config = {
        ...getAuthHeaders(),
        params
      };
      const endpoint = audience === 'all' 
        ? `${PG_LEGACY_BASE}/list`
        : `${PG_LEGACY_BASE}/list/${audience}`;
      const fallback = await axios.get(endpoint, config);
      return fallback.data?.data || [];
    } catch {
      console.error(`fetchPgChargeRulesByAudience (${audience}) error:`, error);
      throw error;
    }
  }
};

/**
 * Create a new PG Charge Rule
 */
export const createPgChargeRule = async (ruleData) => {
  try {
    const response = await axios.post(PG_API_BASE, ruleData, getAuthHeaders());
    return response.data;
  } catch (error) {
    try {
      const fallback = await axios.post(PG_LEGACY_BASE, ruleData, getAuthHeaders());
      return fallback.data;
    } catch {
      console.error('createPgChargeRule error:', error);
      throw error?.response?.data || error;
    }
  }
};

/**
 * Update a PG Charge Rule by ID
 */
export const updatePgChargeRule = async (id, updates) => {
  try {
    const response = await axios.put(`${PG_API_BASE}/${id}`, updates, getAuthHeaders());
    return response.data;
  } catch (error) {
    try {
      const fallback = await axios.put(`${PG_LEGACY_BASE}/${id}`, updates, getAuthHeaders());
      return fallback.data;
    } catch {
      console.error('updatePgChargeRule error:', error);
      throw error?.response?.data || error;
    }
  }
};

/**
 * Delete a PG Charge Rule by ID
 */
export const deletePgChargeRule = async (id) => {
  try {
    const response = await axios.delete(`${PG_API_BASE}/${id}`, getAuthHeaders());
    return response.data;
  } catch (error) {
    try {
      const fallback = await axios.delete(`${PG_LEGACY_BASE}/${id}`, getAuthHeaders());
      return fallback.data;
    } catch {
      console.error('deletePgChargeRule error:', error);
      throw error?.response?.data || error;
    }
  }
};

/**
 * Calculate charge for testing/previewing
 */
export const calculatePgCharge = async (payload) => {
  try {
    const response = await axios.post(`${PG_API_BASE}/calculate`, payload, getAuthHeaders());
    return response.data?.data;
  } catch (error) {
    try {
      const fallback = await axios.post(`${PG_LEGACY_BASE}/calculate`, payload, getAuthHeaders());
      return fallback.data?.data;
    } catch {
      console.error('calculatePgCharge error:', error);
      throw error?.response?.data || error;
    }
  }
};

/**
 * Super Admin PG Rules
 */
export const fetchSuperAdminPgRules = async (params = {}) => {
  return await fetchPgChargeRules({ ...params, scope: 'super_admin_default' });
};

export const fetchAdminPgRules = async (adminId) => {
  return await fetchPgChargeRules({ user_id: adminId, scope: 'super_admin_admin' });
};

/**
 * Get Franchise-Managed PG Default Rates
 */
export const getPgFranchiseManagedDefaultRates = async (franchiseId) => {
  try {
    const params = franchiseId ? { franchaise_id: franchiseId } : {};
    const [adminRules, franchiseRules] = await Promise.all([
      fetchPgChargeRulesByAudience('admin', params).catch(() => []),
      fetchPgChargeRulesByAudience('franchise', params).catch(() => [])
    ]);

    return {
      adminRules,
      franchiseRules,
      allRules: [...adminRules, ...franchiseRules]
    };
  } catch (error) {
    console.error('getPgFranchiseManagedDefaultRates error:', error);
    return { adminRules: [], franchiseRules: [], allRules: [] };
  }
};

/**
 * Get Franchise-Managed Merchant PG Rates
 */
export const getPgFranchiseManagedMerchantRates = async (merchantId, franchiseId) => {
  try {
    const params = { user_id: merchantId };
    if (franchiseId) params.franchaise_id = franchiseId;
    const rules = await fetchPgChargeRules(params);
    return rules;
  } catch (error) {
    console.error('getPgFranchiseManagedMerchantRates error:', error);
    return [];
  }
};

/**
 * Get Super Franchise Managed PG Default Rates
 */
export const getPgSuperFranchiseManagedDefaultRates = async (superFranchiseId) => {
  try {
    const params = superFranchiseId ? { super_franchise_id: superFranchiseId } : {};
    const rules = await fetchPgChargeRules(params);
    return rules;
  } catch (error) {
    console.error('getPgSuperFranchiseManagedDefaultRates error:', error);
    return [];
  }
};

/**
 * Get Merchant's Authenticated PG Rules
 */
export const getAuthenticatedPgMerchantChargeRules = async () => {
  try {
    const rules = await fetchPgChargeRulesByAudience('merchant');
    return rules;
  } catch (error) {
    console.error('getAuthenticatedPgMerchantChargeRules error:', error);
    return [];
  }
};
