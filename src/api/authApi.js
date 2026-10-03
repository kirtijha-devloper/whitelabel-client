import axios from 'axios';
import { getAuthToken } from '../utils/auth';
import { BASE_URL } from '../constants';

const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});
const IMPERSONATION_TIMEOUT_MS = 30000;
const ADMIN_DL_TOKEN_ENDPOINT = `${BASE_URL}/admin/dl-token`;
const ADMIN_DL_TOKEN_STATUS_ENDPOINT = `${BASE_URL}/admin/dl-token/status`;
const ADMIN_DIRECT_LOGIN_ENDPOINT = `${BASE_URL}/admin/direct-login`;

// In-memory direct-login token cache for the current tab only.
let adminDlTokenCache = null;
let adminDlTokenExpiryMs = 0;
let adminDirectLoginUnsupported = false;

const nowMs = () =>
  (typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now());

const decodeBase64Url = (value) => {
  if (!value || typeof value !== 'string') return null;

  try {
    const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized + '==='.slice((normalized.length + 3) % 4);

    if (typeof atob === 'function') {
      return atob(padded);
    }
  } catch {
    return null;
  }

  return null;
};

const getAuthDebugSnapshot = (token) => {
  if (!token) {
    return {
      hasToken: false,
      tokenFingerprint: null,
      jwtRole: null,
      jwtUserId: null,
      jwtExpIso: null,
      jwtExpiresInSec: null,
    };
  }

  let payload = null;
  const parts = String(token).split('.');
  if (parts.length >= 2) {
    const decoded = decodeBase64Url(parts[1]);
    if (decoded) {
      try {
        payload = JSON.parse(decoded);
      } catch {
        payload = null;
      }
    }
  }

  const exp = Number(payload?.exp || 0);
  const expiresInSec = exp ? Math.round(exp - Date.now() / 1000) : null;

  return {
    hasToken: true,
    tokenFingerprint: `${String(token).length}:${String(token).slice(-6)}`,
    jwtRole: payload?.role ?? payload?.user?.role ?? null,
    jwtUserId: payload?.id ?? payload?.user_id ?? payload?.sub ?? null,
    jwtExpIso: exp ? new Date(exp * 1000).toISOString() : null,
    jwtExpiresInSec: expiresInSec,
  };
};

const isNetworkOrTimeoutError = (error) => {
  const status = error?.status ?? error?.response?.status;
  const code = error?.code;
  const message = String(error?.message || '').toLowerCase();
  return (
    !status &&
    (code === 'ECONNABORTED' || code === 'ERR_NETWORK' || message.includes('timeout') || message.includes('network'))
  );
};

const getHeaderKeys = (headers) => {
  if (!headers || typeof headers !== 'object') return [];
  return Object.keys(headers).sort();
};

const clearAdminDlTokenCache = () => {
  adminDlTokenCache = null;
  adminDlTokenExpiryMs = 0;
};

// Normalizes axios/network errors so UI handlers can rely on one shape.
const toApiError = (error, fallbackMessage) => {
  const timeoutMs = Number(error?.config?.timeout || 0);
  const timeoutSuffix = timeoutMs ? ` after ${Math.round(timeoutMs / 1000)}s` : '';
  const timeoutMessage = error?.code === 'ECONNABORTED' ? `Request timed out${timeoutSuffix}.` : null;
  const apiMessage = error?.response?.data?.message || timeoutMessage || error?.message || fallbackMessage;
  const nextError = new Error(apiMessage);
  nextError.status = error?.response?.status;
  nextError.code = error?.code;
  nextError.raw = error?.response?.data;
  nextError.url = error?.config?.url;
  nextError.method = error?.config?.method;
  nextError.timeout = error?.config?.timeout;
  return nextError;
};

const logImpersonationError = (context, error, meta = {}) => {
  const request = error?.request;
  const likelyBrowserCorsOrPreflightIssue =
    typeof window !== 'undefined' && isNetworkOrTimeoutError(error) && !error?.response;
  const snapshot = {
    message: error?.message || null,
    code: error?.code || null,
    status: error?.response?.status ?? null,
    url: error?.config?.url || null,
    baseURL: error?.config?.baseURL || null,
    method: error?.config?.method || null,
    params: error?.config?.params || null,
    requestHeaderKeys: getHeaderKeys(error?.config?.headers),
    hasAuthHeader: Boolean(error?.config?.headers?.Authorization || error?.config?.headers?.authorization),
    timeout: error?.config?.timeout ?? null,
    requestReadyState: request?.readyState ?? null,
    requestStatus: request?.status ?? null,
    requestResponseURL: request?.responseURL ?? null,
    browserOrigin: typeof window !== 'undefined' ? window.location?.origin : null,
    browserHref: typeof window !== 'undefined' ? window.location?.href : null,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
    online: typeof navigator !== 'undefined' ? navigator.onLine : null,
    likelyBrowserCorsOrPreflightIssue,
    response: error?.response?.data ?? null,
  };

  // Intentionally no token/body logging here.
  console.error(`[impersonation][${context}]`, { ...meta, ...snapshot });

  if (likelyBrowserCorsOrPreflightIssue) {
    console.warn('[impersonation][hint] Browser timed out without an HTTP response. Check CORS/OPTIONS for origin and firewall/WAF rules.', {
      endpoint: error?.config?.url || null,
      origin: snapshot.browserOrigin,
      method: snapshot.method,
      traceId: meta?.traceId || null,
    });
  }
};

const parseExpiresAtMs = (value) => {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

// Small safety window prevents using a token that is about to expire.
const hasFreshAdminDlToken = () => {
  if (!adminDlTokenCache) return false;
  if (!adminDlTokenExpiryMs) return true;
  return Date.now() < adminDlTokenExpiryMs - 5000;
};

const extractDlToken = (payload) => {
  if (!payload) return null;
  const candidates = [
    payload?.dl_token,
    payload?.data?.dl_token,
    payload?.token,
    payload?.data?.token,
  ];
  return candidates.find((value) => typeof value === 'string' && value.trim().length > 0) || null;
};

const extractDlExpiry = (payload) => {
  const candidates = [
    payload?.data?.expires_at,
    payload?.expires_at,
  ];
  return candidates.find((value) => typeof value === 'string' && value.trim().length > 0) || null;
};

export const signup = async (userData) => {
  try {
    const token = getAuthToken();

    if (!token) throw new Error("Not Authorized");
    const response = await api.post('/user/register', userData, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    return response.data;
  } catch (error) {
    throw new Error(error.response?.data?.message || 'Signup failed');
  }
};

export const login = async (credentials) => {
  try {
    const response = await api.post(`/user/login`, credentials
    )
    return response.data;
  } catch (error) {
    throw new Error(error.response?.data?.message || 'Login failed');
  }
};

const extractTokenFromResponse = (payload) => {
  if (!payload) return null;
  if (typeof payload === 'string') return payload;

  const candidates = [
    payload?.token,
    payload?.session_token,
    payload?.jwt,
    payload?.auth_token,
    payload?.accessToken,
    payload?.access_token,
    payload?.data?.token,
    payload?.data?.session_token,
    payload?.data?.jwt,
    payload?.data?.auth_token,
    payload?.data?.accessToken,
    payload?.data?.access_token,
    payload?.authorisation?.token,
    payload?.data?.authorisation?.token,
  ];

  return candidates.find((value) => typeof value === 'string' && value.trim().length > 0) || null;
};

const runAdminDirectLogin = async ({ dlToken, userId, role, traceId }) => {
  try {
    // Contract: POST /admin/direct-login with { dl_token, user_id }.
    const response = await api.post(
      ADMIN_DIRECT_LOGIN_ENDPOINT,
      {
        dl_token: dlToken,
        user_id: userId,
      },
      {
        timeout: IMPERSONATION_TIMEOUT_MS,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    const impersonationToken = extractTokenFromResponse(response?.data);
    if (!impersonationToken) {
      throw new Error('Direct-login user token missing in response');
    }

    return {
      token: impersonationToken,
      user: response?.data?.user || response?.data?.data?.user || null,
      raw: response.data,
    };
  } catch (error) {
    logImpersonationError('direct-login-attempt-failed', error, {
      traceId,
      endpoint: ADMIN_DIRECT_LOGIN_ENDPOINT,
      payloadKeys: ['dl_token', 'user_id'],
      userId,
      role,
    });
    throw toApiError(error, 'Failed to start impersonation');
  }
};

export const generateAdminDirectLoginToken = async () => {
  const requestStartedAt = nowMs();
  const authSnapshot = getAuthDebugSnapshot(getAuthToken());

  try {
    if (adminDirectLoginUnsupported) {
      throw Object.assign(new Error('Direct-login endpoints are unavailable'), { status: 404 });
    }

    const token = getAuthToken();
    if (!token) throw new Error('No token found');

    // Send {} (not null) to avoid null-body parsing issues in some middleware.
    const response = await api.post(ADMIN_DL_TOKEN_ENDPOINT, {}, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      timeout: IMPERSONATION_TIMEOUT_MS,
    });

    const dlToken = extractDlToken(response?.data);
    if (!dlToken) {
      throw new Error('Direct-login token missing in response');
    }

    const expiresAt = extractDlExpiry(response?.data);
    adminDirectLoginUnsupported = false;
    adminDlTokenCache = dlToken;
    adminDlTokenExpiryMs = parseExpiresAtMs(expiresAt);

    console.info('[impersonation][generate-dl-token-success]', {
      endpoint: ADMIN_DL_TOKEN_ENDPOINT,
      status: response?.status ?? null,
      elapsedMs: Math.round(nowMs() - requestStartedAt),
      tokenExpiresAt: expiresAt || null,
    });

    return {
      dlToken,
      expiresAt: expiresAt || null,
      raw: response.data,
    };
  } catch (error) {
    logImpersonationError('generate-dl-token-failed', error, {
      endpoint: ADMIN_DL_TOKEN_ENDPOINT,
      elapsedMs: Math.round(nowMs() - requestStartedAt),
      ...authSnapshot,
    });
    if (error?.response?.status === 404 || error?.status === 404) {
      adminDirectLoginUnsupported = true;
    }
    clearAdminDlTokenCache();
    throw toApiError(error, 'Failed to generate direct-login token');
  }
};

export const getAdminDirectLoginTokenStatus = async () => {
  try {
    if (adminDirectLoginUnsupported) {
      return { success: false, active: false, unsupported: true };
    }

    const token = getAuthToken();
    if (!token) throw new Error('No token found');

    const response = await api.get(ADMIN_DL_TOKEN_STATUS_ENDPOINT, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      timeout: IMPERSONATION_TIMEOUT_MS,
    });

    return response.data;
  } catch (error) {
    logImpersonationError('dl-token-status-failed', error);
    throw toApiError(error, 'Failed to fetch direct-login token status');
  }
};

export const revokeAdminDirectLoginToken = async () => {
  clearAdminDlTokenCache();

  try {
    if (adminDirectLoginUnsupported) {
      return { success: true, unsupported: true };
    }

    const token = getAuthToken();
    if (!token) return { success: true };

    const response = await api.delete(ADMIN_DL_TOKEN_ENDPOINT, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      timeout: IMPERSONATION_TIMEOUT_MS,
    });

    return response.data;
  } catch (error) {
    logImpersonationError('revoke-dl-token-failed', error);
    throw toApiError(error, 'Failed to revoke direct-login token');
  }
};

const getAdminDirectLoginToken = async ({ forceRefresh = false } = {}) => {
  // Reuse cached token unless caller explicitly requests a fresh one.
  if (!forceRefresh && hasFreshAdminDlToken()) {
    return adminDlTokenCache;
  }

  const generated = await generateAdminDirectLoginToken();
  return generated.dlToken;
};

export const primeAdminDirectLoginToken = async () => {
  const dlToken = await getAdminDirectLoginToken();
  return {
    dlToken,
    expiresAt: adminDlTokenExpiryMs ? new Date(adminDlTokenExpiryMs).toISOString() : null,
  };
};

export const impersonateUser = async ({
  userId,
  role,
  forceRefreshDlToken = false,
  onEvent,
} = {}) => {
  const traceId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const token = getAuthToken();
  const authSnapshot = getAuthDebugSnapshot(token);
  // Optional event stream for UI progress/debug hooks.
  const emitEvent = (type, details = {}) => {
    if (typeof onEvent === 'function') {
      onEvent({ type, traceId, ...details });
    }
  };

  console.info('[impersonation][start]', {
    traceId,
    userId,
    role,
    baseUrl: BASE_URL,
    ...authSnapshot,
  });

  if (!token) {
    const error = new Error('No token found');
    error.traceId = traceId;
    emitEvent('auth-missing', { message: error.message });
    throw error;
  }

  const parsedUserId = Number(userId);
  if (!Number.isFinite(parsedUserId)) {
    const error = new Error('Invalid user id for impersonation');
    error.traceId = traceId;
    emitEvent('validation-failed', { message: error.message, userId });
    throw error;
  }

  const normalizedRole = String(role || '').trim().toLowerCase();
  if (adminDirectLoginUnsupported) {
    const error = new Error('Admin direct-login endpoints are unavailable.');
    error.status = 404;
    error.traceId = traceId;
    emitEvent('endpoint-unsupported', { message: error.message, status: 404 });
    throw error;
  }

  let dlToken;
  const getDlTokenStartedAt = nowMs();
  try {
    emitEvent('dl-token-request', {
      url: ADMIN_DL_TOKEN_ENDPOINT,
      method: 'POST',
      forceRefresh: Boolean(forceRefreshDlToken),
    });
    dlToken = await getAdminDirectLoginToken({ forceRefresh: forceRefreshDlToken });
    emitEvent('dl-token-ready', {
      url: ADMIN_DL_TOKEN_ENDPOINT,
      method: 'POST',
      payload: {
        dl_token: dlToken,
      },
      expiresAt: adminDlTokenExpiryMs ? new Date(adminDlTokenExpiryMs).toISOString() : null,
    });
  } catch (error) {
    logImpersonationError('get-dl-token-for-login-failed', error, {
      traceId,
      userId: parsedUserId,
      role: normalizedRole,
      elapsedMs: Math.round(nowMs() - getDlTokenStartedAt),
      ...authSnapshot,
    });
    const apiError = toApiError(error, 'Failed to start impersonation');
    apiError.traceId = traceId;
    emitEvent('dl-token-failed', {
      message: apiError.message,
      code: apiError.code ?? null,
      status: apiError.status ?? null,
    });
    throw apiError;
  }

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      emitEvent('direct-login-request', {
        url: ADMIN_DIRECT_LOGIN_ENDPOINT,
        method: 'POST',
        payload: {
          dl_token: dlToken,
          user_id: parsedUserId,
        },
        attempt: attempt + 1,
      });
      const result = await runAdminDirectLogin({
        dlToken,
        userId: parsedUserId,
        role: normalizedRole,
        traceId,
      });
      emitEvent('direct-login-response', {
        url: ADMIN_DIRECT_LOGIN_ENDPOINT,
        method: 'POST',
        response: result?.raw ?? null,
      });
      return result;
    } catch (error) {
      const message = error?.response?.data?.message || error?.message || 'Failed to start impersonation';
      const status = error?.status ?? error?.response?.status;
      const shouldRefreshDlToken =
        status === 401 ||
        status === 409 ||
        (status === 400 && /dl[_\s-]?token/i.test(message));

      // First failure can refresh DL token and retry once (expired/used token cases).
      if (attempt === 0 && shouldRefreshDlToken) {
        console.warn('[impersonation] refreshing dl_token and retrying direct-login request');
        emitEvent('dl-token-refresh', {
          reason: message,
          status: status ?? null,
          url: ADMIN_DL_TOKEN_ENDPOINT,
          method: 'POST',
        });
        dlToken = await getAdminDirectLoginToken({ forceRefresh: true });
        continue;
      }

      const apiError =
        error?.status || error?.code || error?.raw
          ? error
          : toApiError(error, message);
      apiError.traceId = traceId;
      emitEvent('direct-login-failed', {
        message: apiError.message,
        code: apiError.code ?? null,
        status: apiError.status ?? null,
        response: apiError.raw ?? null,
      });
      throw apiError;
    }
  }

  const error = new Error('Failed to start admin direct-login');
  error.traceId = traceId;
  throw error;
};

export const fetchUserDetails = async () => {
  try {
    const token = getAuthToken();

    if (!token) throw new Error("No token found");
    console.info("[auth] current token:", token);

    const response = await api.get(`/user/current`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return response.data;
  } catch (error) {
    throw new Error(error.response?.data?.message || 'Failed to fetch user details');
  }
};

export const getRecentUsers = async () => {
  try {
    const token = getAuthToken();
    if (!token) throw new Error("No token found");

    const response = await api.get(`/user/`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return response.data;
  } catch (error) {
    throw new Error(error.response?.data?.message || "Failed to fetch recent users");
  }
};

export const userDetail = async (id) => {
  try {
    const token = getAuthToken();
    if (!token) throw new Error("No token found");

    const response = await api.get(`/user/${id}/?is_pos_detail_required=true`, {
      headers: {
        Authorization: `Bearer ${token}`,
      }
    })
    return response.data;
  }
  catch (error) {
    console.error('Error approving user:', error);
    throw new Error(error.response?.data?.message || 'Failed to approve user');
  }
}

export const promoteMerchantToFranchise = async (id) => {
  try {
    const token = getAuthToken();
    if (!token) throw new Error('No token found');

    const userId = Number(id);
    if (!Number.isFinite(userId)) {
      throw new Error('Invalid user id');
    }

    const response = await api.post(`/user/${userId}/promote-to-franchise`, null, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    return response.data;
  } catch (error) {
    console.error('[promoteMerchantToFranchise] request failed', error);
    throw new Error(error.response?.data?.message || 'Failed to promote merchant to franchise');
  }
}

export const promoteUserToSuperFranchise = async (id) => {
  try {
    const token = getAuthToken();
    if (!token) throw new Error('No token found');

    const userId = Number(id);
    if (!Number.isFinite(userId)) {
      throw new Error('Invalid user id');
    }

    const response = await api.post(`/user/${userId}/promote-to-super-franchise`, null, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    return response.data;
  } catch (error) {
    console.error('[promoteUserToSuperFranchise] request failed', error);
    throw new Error(error.response?.data?.message || 'Failed to promote user to super franchise');
  }
}

export const enableLedger = async (id) => {
  try {
    const token = getAuthToken();
    if (!token) throw new Error('No token found');

    const userId = Number(id);
    if (!Number.isFinite(userId)) {
      throw new Error('Invalid user id');
    }

    const response = await api.put(`/user/${userId}/enable-ledger`, null, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    return response.data;
  } catch (error) {
    console.error('[enableLedger] request failed', error);
    throw new Error(error.response?.data?.message || 'Failed to enable ledger tracking');
  }
};

const isFileValue = (value) =>
  (typeof File !== 'undefined' && value instanceof File) ||
  (typeof Blob !== 'undefined' && value instanceof Blob);

const toMultipartFormData = (entries = [], extra = {}) => {
  const formData = new FormData();

  entries.forEach(([key, value]) => {
    if (isFileValue(value)) {
      formData.append(key, value);
      return;
    }
    if (Array.isArray(value)) {
      formData.append(key, JSON.stringify(value));
      return;
    }
    formData.append(key, String(value));
  });

  Object.entries(extra || {}).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    formData.append(key, String(value));
  });

  return formData;
};

const buildUserUpdatePayload = (data = {}) => {
  if (typeof FormData !== 'undefined' && data instanceof FormData) {
    return data;
  }

  const entries = Object.entries(data || {}).filter(([, value]) => value !== undefined && value !== null);
  return toMultipartFormData(entries);
};

export const updateUserProfile = async ({ id, data }) => {
  try {
    const token = getAuthToken();
    if (!token) throw new Error("No token found");

    const userId = Number(id);
    if (!Number.isFinite(userId)) {
      throw new Error("Invalid user id");
    }

    const body = buildUserUpdatePayload(data);
    const response = await axios.put(`${BASE_URL}/user/${userId}`, body, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    return response.data;
  } catch (error) {
    console.error('[updateUserProfile] request failed', {
      status: error?.response?.status ?? null,
      message: error?.response?.data?.message || error?.message || null,
      details: error?.response?.data ?? null,
    });
    throw new Error(error.response?.data?.message || "Failed to update user");
  }
};

export const updateAllUserSettlementType = async (settlementType) => {
  try {
    const token = getAuthToken();
    if (!token) throw new Error('No token found');

    const allowedTypes = ['today_settlement', 'next_day_settlement'];
    if (!allowedTypes.includes(settlementType)) {
      throw new Error('Invalid settlement type');
    }

    const response = await api.put(
      '/admin/users/settlement-type',
      { settlement_type: settlementType },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    return response.data;
  } catch (error) {
    console.error('[updateAllUserSettlementType] request failed', {
      settlementType,
      statusCode: error?.response?.status ?? null,
      message: error?.response?.data?.message || error?.message || null,
      details: error?.response?.data ?? null,
    });
    throw new Error(error.response?.data?.message || 'Failed to update settlement type for all users');
  }
};

export const updateUserStatus = async ({ id, status, is_payout_enabled, role }) => {
  try {
    const token = getAuthToken();
    if (!token) throw new Error('No token found');

    const userId = Number(id);
    if (!Number.isFinite(userId)) {
      throw new Error('Invalid user id');
    }

    const payload = {};
    if (status !== undefined && status !== null) payload.status = status;
    if (is_payout_enabled !== undefined && is_payout_enabled !== null) payload.is_payout_enabled = is_payout_enabled;

    if (!('status' in payload) && !('is_payout_enabled' in payload)) {
      throw new Error('Either status or is_payout_enabled must be provided');
    }

    const headers = {
      Authorization: `Bearer ${token}`,
    };

    // Primary endpoint
    const endpoint = `/user/${userId}/status`;

    try {
      const response = await api.put(endpoint, payload, { headers });
      return response.data;
    } catch (error) {
      const statusCode = error?.response?.status;
      if (statusCode === 404 || statusCode === 400) {
        // Fallback legacy endpoints
        const fallbackEndpoints = [];
        if (role === 'merchant' || role === 'franchise') {
          fallbackEndpoints.push(`/${role}/${userId}/status`);
        }
        fallbackEndpoints.push(`/merchant/${userId}/status`, `/franchaise/${userId}/status`);

        for (const route of fallbackEndpoints) {
          try {
            const response = await api.put(route, payload, { headers });
            return response.data;
          } catch {
            continue;
          }
        }
      }

      throw error;
    }
  } catch (error) {
    console.error('[updateUserStatus] request failed', {
      id,
      status,
      is_payout_enabled,
      role,
      statusCode: error?.response?.status ?? null,
      message: error?.response?.data?.message || error?.message || null,
    });
    throw new Error(error.response?.data?.message || 'Failed to update user status');
  }
};

export const updateUserIpayOutlet = async ({ id, ipay_outlet_id }) => {
  try {
    const token = getAuthToken();
    if (!token) throw new Error('No token found');

    const userId = Number(id);
    if (!Number.isFinite(userId)) {
      throw new Error('Invalid user id');
    }

    let payloadValue = null;
    if (ipay_outlet_id !== null) {
      const outletId = Number(ipay_outlet_id);
      if (!Number.isInteger(outletId)) {
        throw new Error('ipay_outlet_id must be a valid integer or null');
      }
      payloadValue = outletId;
    }

    const response = await api.put(
      `/admin/user/${userId}/ipay-outlet`,
      { ipay_outlet_id: payloadValue },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    return response.data;
  } catch (error) {
    console.error('[updateUserIpayOutlet] request failed', {
      id,
      ipay_outlet_id,
      statusCode: error?.response?.status ?? null,
      message: error?.response?.data?.message || error?.message || null,
    });
    throw new Error(error.response?.data?.message || 'Failed to update InstantPay outlet ID');
  }
};

export const approveUser = async (id) => {
  try {
    const token = getAuthToken();
    if (!token) throw new Error('No token found');

    const response = await api.patch(
      `/user/${id}/approve`, // Adjust endpoint to match your backend
      { is_approved: true },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    return response.data;
  } catch (error) {
    console.error('Error approving user:', error);
    throw new Error(error.response?.data?.message || 'Failed to approve user');
  }
};

export const sendOtp = async ({ mobile, purpose }) => {
  try {
    const response = await api.post('/user/send-otp', { mobile, purpose });
    return response.data;
  } catch (error) {
    throw new Error(error.response?.data?.message || 'Failed to send OTP');
  }
};

export const verifyOtp = async ({ mobile_number, otp, purpose }) => {
  try {
    const response = await api.post('/user/verify-otp', { mobile_number, otp, purpose });
    return response.data;
  } catch (error) {
    throw new Error(error.response?.data?.message || 'Failed to verify OTP');
  }
};

export const resetPassword = async ({ new_password, token }) => {
  try {
    const response = await api.post('/user/reset-password', { new_password, token });
    return response.data;
  } catch (error) {
    throw new Error(error.response?.data?.message || 'Failed to reset password');
  }
};

export const updatePassword = async ({ id, currentPassword, newPassword, password }) => {
  try {
    const token = getAuthToken();
    if (!token) throw new Error("No token found");
    const userId = Number(id);
    const targetPassword = newPassword || password;

    if (!Number.isFinite(userId)) throw new Error("Invalid user id");
    if (!targetPassword) throw new Error("New password is required");

    const endpoints = ['/update-password', '/user/update-password'];
    const payloadAttempts = [
      { id: userId, currentPassword: currentPassword || '', newPassword: targetPassword },
      { id: userId, current_password: currentPassword || '', new_password: targetPassword },
      { id: userId, oldPassword: currentPassword || '', newPassword: targetPassword },
      { id: userId, old_password: currentPassword || '', new_password: targetPassword },
      // Legacy payload fallback
      { id: userId, password: targetPassword },
    ];

    let lastError = null;

    for (const endpoint of endpoints) {
      for (const payload of payloadAttempts) {
        try {
          const response = await api.put(endpoint, payload, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });
          return response.data;
        } catch (error) {
          lastError = error;
          const status = error?.response?.status;

          if (status === 400 || status === 404 || status === 422) {
            continue;
          }

          throw new Error(error.response?.data?.message || 'Failed to update password');
        }
      }
    }

    throw new Error(lastError?.response?.data?.message || 'Failed to update password');
  } catch (error) {
    throw new Error(error.response?.data?.message || error.message || 'Failed to update password');
  }
};

export const generateTpin = async ({ tpin } = {}) => {
  try {
    const token = getAuthToken();
    if (!token) throw new Error("No Token Found");

    const payload = tpin ? { tpin: String(tpin) } : {};

    const response = await api.post('/user/tpin', payload, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    return response.data;
  } catch (error) {
    throw new Error(error.response?.data?.message || 'Failed to generate tpin');
  }
}

export const verifyTPin = async ({ tpin: tpin }) => {
  try {
    const token = getAuthToken();
    if (!token) throw new Error("No Token Found");

    const response = await api.post('/user/tpin/verify', { tpin: tpin }, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    })
    return response.data;

  } catch (error) {
    throw new Error(error.response?.data?.message || 'Failed to verify or tpin')
  }
}

export const forgotPassword = async ({ mobile_number }) => {
  try {
    const response = await api.post('/user/forgot-password', { mobile_number });
    return response.data;
  } catch (error) {
    throw new Error(error.response?.data?.message || 'Failed to send forgot password OTP');
  }
};

export const verifyForgotPasswordOtp = async ({ mobile_number, otp }) => {
  try {
    const response = await api.post('/user/verify-otp', {
      mobile_number,
      otp,
      purpose: 'forgot_password'
    });
    return response.data;
  } catch (error) {
    throw new Error(error.response?.data?.message || 'Failed to verify OTP');
  }
};

export const resetPasswordWithToken = async ({ new_password, reset_token }) => {
  try {
    const response = await api.post('/user/reset-password', {
      new_password,
      reset_token
    });
    return response.data;
  } catch (error) {
    throw new Error(error.response?.data?.message || 'Failed to reset password');
  }
};

export const getDashboardData = () => {
  // }
  return {
    // userName: user.name,
    walletBalance: 22330.0,
    posTransactions: 25000.0,
    posSuccess: 22000.0,
    posFailed: 3000.0,
    ccBillPaymentTXN: 14000.0,
    ccBillPaymentSuccess: 10000.0,
    ccBillPaymentFailed: 4000.0,
    todayPayout: 22000.0,
    merchantCount: 200,
    franchiseCount: 50,
    posMachineCount: 200,
    posActive: 150,
    posDActive: 50,
  }

};
