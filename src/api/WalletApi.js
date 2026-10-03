import axios from "axios";
import { getAuthToken } from "../utils/auth";
import { BASE_URL } from "../constants";

const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});
const ADMIN_WALLET_TIMEOUT_MS = 15000;
const nowMs = () =>
  (typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now());

const decodeBase64Url = (value) => {
  if (!value || typeof value !== "string") return null;

  try {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "===".slice((normalized.length + 3) % 4);
    if (typeof atob === "function") {
      return atob(padded);
    }
  } catch {
    return null;
  }

  return null;
};

const getWalletAuthDebugSnapshot = (token) => {
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
  const parts = String(token).split(".");
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

const getHeaderKeys = (headers) => {
  if (!headers || typeof headers !== "object") return [];
  return Object.keys(headers).sort();
};

const sanitizeWalletPayload = ({ user_id, amount, reason, idempotency_key }) => ({
  user_id: Number(user_id),
  amount: Number(amount),
  hasReason: Boolean(reason && String(reason).trim().length > 0),
  reasonLength: reason ? String(reason).trim().length : 0,
  hasIdempotencyKey: Boolean(idempotency_key),
  idempotencyKeyFingerprint: idempotency_key
    ? `${String(idempotency_key).length}:${String(idempotency_key).slice(-6)}`
    : null,
});

const isNetworkOrTimeoutError = (error) => {
  const status = error?.response?.status;
  const code = error?.code;
  const message = String(error?.message || "").toLowerCase();
  return (
    !status &&
    (code === "ECONNABORTED" ||
      code === "ERR_NETWORK" ||
      message.includes("timeout") ||
      message.includes("network"))
  );
};

const toWalletApiError = (error, fallbackMessage, traceId) => {
  const timeoutMessage = "Wallet request timed out. Please try again.";
  const apiMessage =
    error?.response?.data?.message ||
    error?.message ||
    fallbackMessage;
  const message = error?.code === "ECONNABORTED" ? timeoutMessage : apiMessage;
  const nextError = new Error(message);
  nextError.status = error?.response?.status ?? null;
  nextError.code = error?.code ?? null;
  nextError.raw = error?.response?.data ?? null;
  nextError.url = error?.config?.url ?? null;
  nextError.method = error?.config?.method ?? null;
  nextError.timeout = error?.config?.timeout ?? null;
  nextError.traceId = traceId;
  return nextError;
};

export const requestFund = async (data) => {
  try {
    const token = getAuthToken();
    if (!token) throw new Error("No token found");
    const body = data && typeof data === "object" ? data : {};

    const response = await api.post(`/wallet/request`, body, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  } catch (error) {
    console.error("Error requesting fund:", error);
    throw new Error(error.response?.data?.message || "Failed to request fund");
  }
};

export const transferFund = async (id) => {
  try {
    const token = getAuthToken();
    if (!token) throw new Error("No token found");

    const response = await api.post(`/wallet/transer/${id}`, {}, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  } catch (error) {
    console.error(`Error transferring fund for ID ${id}:`, error);
    throw new Error(error.response?.data?.message || "Failed to transfer fund");
  }
};

export const holdFund = async (id) => {
  try {
    const token = getAuthToken();
    if (!token) throw new Error("No token found");

    const response = await api.post(`/wallet/hold/${id}`, {}, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  } catch (error) {
    console.error(`Error holding fund for ID ${id}:`, error);
    throw new Error(error.response?.data?.message || "Failed to hold fund");
  }
};

export const unholdFund = async (id) => {
    console.log(id, "data comes ")
  try {
    const token = getAuthToken();
    if (!token) throw new Error("No token found");

    const response = await api.post(`/wallet/unhold/${id}`, {}, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  } catch (error) {
    console.error(`Error unholding fund for ID ${id}:`, error);
    throw new Error(error.response?.data?.message || "Failed to unhold fund");
  }
};

export const getWalletRequests = async () => {
  try {
    const token = getAuthToken();
    if (!token) throw new Error("No token found");

    const response = await api.get(`/wallet/requests`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  } catch (error) {
    console.error("Error fetching wallet requests:", error);
    throw new Error(error.response?.data?.message || "Failed to fetch wallet requests");
  }
};

export const getTransactionsByRole = async () => {
  try {
    const token = getAuthToken();
    if (!token) throw new Error("No token found");

    const response = await api.get(`/wallet/list`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  } catch (error) {
    console.error("Error fetching transactions by role:", error);
    throw new Error(error.response?.data?.message || "Failed to fetch transactions by role");
  }
};

export const getWalletRequestById = async (id) => {
  try {
    const token = getAuthToken();
    if (!token) throw new Error("No token found");

    const response = await api.get(`/wallet/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  } catch (error) {
    console.error(`Error fetching wallet request for ID ${id}:`, error);
    throw new Error(error.response?.data?.message || "Failed to fetch wallet request");
  }
};

export const getUserWalletTransactions = async (filters) => {
  try {
    const token = getAuthToken();
    if (!token) throw new Error("No token found");
    const body = filters && typeof filters === "object" ? filters : {};

    const response = await api.post(`/wallet/filter`, body, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  } catch (error) {
    console.error("Error fetching filtered wallet transactions:", error);
    throw new Error(error.response?.data?.message || "Failed to fetch filtered wallet transactions");
  }
};

const applyAdminWalletAdjustment = async ({ action, user_id, amount, reason, idempotency_key }) => {
  const traceId = `wallet-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const requestStartedAt = nowMs();

  try {
    const token = getAuthToken();
    if (!token) throw new Error("No token found");
    const authSnapshot = getWalletAuthDebugSnapshot(token);

    const normalizedAction = String(action || "").trim().toLowerCase();
    if (normalizedAction !== "credit" && normalizedAction !== "debit") {
      throw new Error("Invalid wallet action");
    }

    const payload = {
      user_id: Number(user_id),
      amount: Number(amount),
      idempotency_key,
    };

    if (reason) {
      payload.reason = String(reason).trim();
    }

    const endpoint = `${BASE_URL}/admin/wallet/${normalizedAction}`;
    const payloadSnapshot = sanitizeWalletPayload(payload);

    console.info("[wallet-adjustment][start]", {
      traceId,
      action: normalizedAction,
      endpoint,
      timeoutMs: ADMIN_WALLET_TIMEOUT_MS,
      payload: payloadSnapshot,
      ...authSnapshot,
      browserOrigin: typeof window !== "undefined" ? window.location?.origin : null,
      browserHref: typeof window !== "undefined" ? window.location?.href : null,
      online: typeof navigator !== "undefined" ? navigator.onLine : null,
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : null,
    });

    const response = await api.post(`/admin/wallet/${normalizedAction}`, payload, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: ADMIN_WALLET_TIMEOUT_MS,
    });

    const result = response?.data || {};
    console.info("[wallet-adjustment][success]", {
      traceId,
      action: normalizedAction,
      endpoint: response?.config?.url || endpoint,
      status: response?.status ?? null,
      elapsedMs: Math.round(nowMs() - requestStartedAt),
      responseKeys: Object.keys(result || {}),
      message: result?.message ?? null,
      ledgerId: result?.data?.ledger_id ?? result?.ledger_id ?? null,
      balanceBefore: result?.data?.balance_before ?? null,
      balanceAfter: result?.data?.balance_after ?? null,
    });

    return response.data;
  } catch (error) {
    const request = error?.request;
    const likelyBrowserCorsOrPreflightIssue =
      typeof window !== "undefined" && isNetworkOrTimeoutError(error) && !error?.response;
    console.error(`[wallet-adjustment][failed]`, {
      traceId,
      action: String(action || "").trim().toLowerCase(),
      elapsedMs: Math.round(nowMs() - requestStartedAt),
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
      browserOrigin: typeof window !== "undefined" ? window.location?.origin : null,
      browserHref: typeof window !== "undefined" ? window.location?.href : null,
      online: typeof navigator !== "undefined" ? navigator.onLine : null,
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : null,
      likelyBrowserCorsOrPreflightIssue,
      response: error?.response?.data ?? null,
    });

    if (likelyBrowserCorsOrPreflightIssue) {
      console.warn(
        "[wallet-adjustment][hint] Browser request failed before HTTP response. Check CORS/OPTIONS and firewall/WAF rules.",
        {
          traceId,
          endpoint: error?.config?.url || null,
          origin: typeof window !== "undefined" ? window.location?.origin : null,
          method: error?.config?.method || null,
        }
      );
    }

    throw toWalletApiError(error, `Failed to ${action} wallet`, traceId);
  }
};

export const adminWalletCredit = async (payload) =>
  applyAdminWalletAdjustment({ ...payload, action: "credit" });

export const adminWalletDebit = async (payload) =>
  applyAdminWalletAdjustment({ ...payload, action: "debit" });
