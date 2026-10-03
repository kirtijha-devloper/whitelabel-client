import axios from 'axios';
import { getAuthToken } from '../utils/auth';
import { BASE_URL } from '../constants';

const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

const authHeaders = () => {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const getVimoAuthToken = async (forceRefresh = false) => {
  try {
    const config = {
      headers: authHeaders(),
      params: {},
    };
    if (forceRefresh) {
      config.params.forceRefresh = true;
    }

    const res = await api.get('/vimo/auth/token', config);
    return res.data;
  } catch (error) {
    throw new Error(error?.response?.data?.message || 'Failed to fetch Vimo auth token');
  }
};

export const getVimoAuthTokenStatus = async () => {
  try {
    const res = await api.get('/vimo/auth/token', { headers: authHeaders() });
    return res.data;
  } catch (error) {
    throw new Error(error?.response?.data?.message || 'Failed to fetch Vimo auth token status');
  }
};

export const postVimoAuthToken = async () => {
  try {
    const res = await api.post('/vimo/auth/token', {}, { headers: authHeaders() });
    return res.data;
  } catch (error) {
    throw new Error(error?.response?.data?.message || 'Failed to refresh Vimo auth token');
  }
};

export const getVimoBanks = async () => {
  try {
    const res = await api.get('/vimo/banks', { headers: authHeaders() });
    return res.data;
  } catch (error) {
    throw new Error(error?.response?.data?.message || 'Failed to fetch Vimo bank list');
  }
};

export const getVimoPurposes = async () => {
  try {
    const res = await api.get('/vimo/purposes', { headers: authHeaders() });
    return res.data;
  } catch (error) {
    throw new Error(error?.response?.data?.message || 'Failed to fetch Vimo purposes');
  }
};

export const getVimoStates = async () => {
  try {
    const res = await api.get('/vimo/states', { headers: authHeaders() });
    return res.data;
  } catch (error) {
    throw new Error(error?.response?.data?.message || 'Failed to fetch Vimo states');
  }
};

export const createVimoPayout = async (payload) => {
  try {
    const endpoint = '/vimo/payout';
    console.info('[vimo-api] createVimoPayout endpoint:', endpoint);
    console.info('[vimo-api] createVimoPayout payload:', payload);
    const res = await api.post(endpoint, payload, { headers: authHeaders() });
    return res.data;
  } catch (error) {
    const msg = error?.response?.data?.message || 'Failed to process payout';
    const status = error?.response?.status;
    const err = new Error(msg);
    err.status = status;
    err.response = error?.response;
    throw err;
  }
};

export const failVimoPayout = async ({ reference_id, merchantRefId, referenceId }) => {
  try {
    const endpoint = '/vimo/payout/admin/fail';
    const payload = {};
    if (reference_id) payload.reference_id = reference_id;
    if (merchantRefId) payload.merchantRefId = merchantRefId;
    if (referenceId) payload.referenceId = referenceId;

    if (!payload.reference_id && !payload.merchantRefId && !payload.referenceId) {
      throw new Error('reference_id, merchantRefId or referenceId is required');
    }

    console.info('[vimo-api] failVimoPayout endpoint:', endpoint);
    console.info('[vimo-api] failVimoPayout payload:', payload);
    const res = await api.post(endpoint, payload, { headers: authHeaders() });
    return res.data;
  } catch (error) {
    const msg = error?.response?.data?.message || 'Failed to mark Vimo payout as failed';
    const status = error?.response?.status;
    const err = new Error(msg);
    err.status = status;
    err.response = error?.response;
    throw err;
  }
};

export const getVimoPayoutAuditLogsByReference = async (params = {}) => {
  try {
    const res = await api.get('/vimo/payout/audit-logs/by-reference', {
      headers: authHeaders(),
      params,
    });
    return res.data;
  } catch (error) {
    const err = new Error(error?.response?.data?.message || 'Failed to fetch Vimo payout audit logs');
    err.status = error?.response?.status;
    err.response = error?.response;
    throw err;
  }
};

export const getVimoPayoutReference = async () => {
  try {
    const res = await api.get('/vimo/payout/reference', { headers: authHeaders() });
    return res.data;
  } catch (error) {
    throw new Error(error?.response?.data?.message || 'Failed to fetch payout reference');
  }
};

export const getVimoBeneficiaries = async () => {
  try {
    const endpoint = '/vimo/beneficiaries';
    const res = await api.get(endpoint, { headers: authHeaders() });
    return res.data;
  } catch (error) {
    throw new Error(error?.response?.data?.message || 'Failed to fetch beneficiaries');
  }
};

const buildBeneficiaryDto = (payload) => {
  const dto = {};

  const setValue = (key, value) => {
    if (value !== undefined && value !== null && value !== '') {
      dto[key] = value;
    }
  };

  setValue('beneficiary_name', payload.beneficiary_name || payload.name || payload.accountName || payload.beneficiaryName);
  setValue('account_number', payload.account_number || payload.accountNumber || payload.beneficiaryAccountNumber);
  setValue('ifsc_code', payload.ifsc_code || payload.ifsc || payload.beneficiaryIFSC);
  setValue('bank_name', payload.bank_name || payload.bankName || payload.beneficiaryBank);
  setValue('branch_name', payload.branch_name || payload.branchName || payload.branch || payload.beneficiaryBranch);
  setValue('state', payload.state || payload.state_code || payload.stateCode || payload.beneficiaryStateCode || payload.beneficiaryState);
  setValue('mobile_number', payload.mobile_number || payload.mobile || payload.mobileNumber || payload.beneficiaryMobileNumber);
  setValue('email', payload.email || payload.beneficiaryEmail);
  setValue('status', payload.status);

  return dto;
};

const buildVimoBeneficiaryCreatePayload = (payload) => {
  const requestBody = {};

  const setValue = (key, value) => {
    if (value !== undefined && value !== null && value !== '') {
      requestBody[key] = value;
    }
  };

  setValue('name', payload.name || payload.beneficiaryName || payload.beneficiary_name || payload.accountName);
  setValue('account_number', payload.account_number || payload.accountNumber || payload.beneficiaryAccountNumber);
  setValue('ifsc_code', payload.ifsc_code || payload.ifsc || payload.beneficiaryIFSC);
  setValue('bank_name', payload.bank_name || payload.bankName || payload.beneficiaryBank);
  setValue('branch_name', payload.branch_name || payload.branchName || payload.branch || payload.beneficiaryBranch);
  setValue('state', payload.state || payload.state_code || payload.stateCode || payload.beneficiaryStateCode || payload.beneficiaryState);
  setValue('mobile', payload.mobile || payload.mobileNumber || payload.mobile_number || payload.beneficiaryMobileNumber);
  setValue('email', payload.email || payload.beneficiaryEmail);

  return requestBody;
};

export const createVimoBeneficiary = async (payload) => {
  try {
    const dto = buildVimoBeneficiaryCreatePayload(payload);
    const endpoint = '/vimo/beneficiaries';
    console.info('[vimo-beneficiary] create endpoint:', endpoint);
    console.info('[vimo-beneficiary] create payload:', dto);
    const res = await api.post(endpoint, dto, { headers: authHeaders() });
    return res.data;
  } catch (error) {
    const msg = error?.response?.data?.message || 'Failed to create beneficiary';
    const err = new Error(msg);
    err.status = error?.response?.status;
    err.response = error?.response;
    throw err;
  }
};

export const updateVimoBeneficiary = async (id, payload) => {
  try {
    const dto = buildBeneficiaryDto(payload);
    const endpoint = `/vimo/beneficiaries/${id}`;
    console.info('[vimo-beneficiary] update endpoint:', endpoint);
    console.info('[vimo-beneficiary] update payload:', { id, dto });
    const res = await api.put(endpoint, dto, { headers: authHeaders() });
    console.info('[vimo-beneficiary] update response:', res?.data);
    return res.data;
  } catch (error) {
    console.error('[vimo-beneficiary] update error:', error?.response?.data || error.message || error);
    throw new Error(error?.response?.data?.message || 'Failed to update beneficiary');
  }
};

export const deleteVimoBeneficiary = async (id) => {
  try {
    const endpoint = `/vimo/beneficiaries/${id}`;
    console.info('[vimo-beneficiary] delete endpoint:', endpoint);
    const res = await api.delete(endpoint, { headers: authHeaders() });
    return res.data;
  } catch (error) {
    throw new Error(error?.response?.data?.message || 'Failed to delete beneficiary');
  }
};

export const checkVimoBeneficiaryLimit = async (payload) => {
  try {
    const endpoint = '/vimo/payout/limit-check';
    const res = await api.post(endpoint, payload, { headers: authHeaders() });
    return res.data;
  } catch (error) {
    const msg = error?.response?.data?.message || 'Failed to check beneficiary limit';
    const status = error?.response?.status;
    const err = new Error(msg);
    err.status = status;
    err.response = error?.response;
    throw err;
  }
};

export const getVimoWalletBalance = async () => {
  try {
    const res = await api.get('/vimo/balance', { headers: authHeaders() });
    return res.data;
  } catch (error) {
    const msg = error?.response?.data?.message || 'Failed to fetch wallet balance';
    const status = error?.response?.status;
    const err = new Error(msg);
    err.status = status;
    err.response = error?.response;
    throw err;
  }
};

export const checkVimoPayoutStatus = async (payload) => {
  try {
    const endpoint = '/vimo/payout/status';
    const res = await api.post(endpoint, payload, { headers: authHeaders() });
    return res.data;
  } catch (error) {
    const msg = error?.response?.data?.message || 'Failed to check payout status';
    const status = error?.response?.status;
    const err = new Error(msg);
    err.status = status;
    err.response = error?.response;
    throw err;
  }
};
