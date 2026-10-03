import axios from "axios";
import { BASE_URL } from "../constants";
import { getAuthToken } from "../utils/auth";

/*
  Commission mode switch (Dev vs Real API)
  ----------------------------------------
  In browser console:
  - Enable dummy/dev mode:
      localStorage.setItem("commission_dev_mode", "true")
  - Disable dummy/dev mode (use real testing API):
      localStorage.setItem("commission_dev_mode", "false")
  Then refresh the page.

  Optional env override:
  - VITE_COMMISSION_DEV_MODE=true|false
*/

const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

const COMMISSION_DEV_MODE_KEY = "commission_dev_mode";
const COMMISSION_DEV_ENV = typeof import.meta !== "undefined" ? import.meta.env?.VITE_COMMISSION_DEV_MODE : undefined;
const TRUE_VALUES = new Set(["1", "true", "yes", "on"]);
const FALSE_VALUES = new Set(["0", "false", "no", "off"]);

const parseBooleanFlag = (value) => {
  if (typeof value === "boolean") return value;
  const normalized = String(value ?? "").trim().toLowerCase();
  if (TRUE_VALUES.has(normalized)) return true;
  if (FALSE_VALUES.has(normalized)) return false;
  return undefined;
};

const getStoredCommissionDevMode = () => {
  if (typeof window === "undefined") return undefined;
  try {
    return parseBooleanFlag(window.localStorage.getItem(COMMISSION_DEV_MODE_KEY));
  } catch {
    return undefined;
  }
};

const isLocalRuntime = () => {
  if (typeof window === "undefined") return false;
  const host = String(window.location?.hostname || "").toLowerCase();
  return host === "localhost" || host === "127.0.0.1";
};

export const isCommissionDevelopmentMode = () => false;

export const setCommissionDevelopmentMode = (enabled) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(COMMISSION_DEV_MODE_KEY, enabled ? "true" : "false");
  } catch {
    // ignore storage errors
  }
};

const HARDCORE_DEFAULT_SLABS = [
  { id: 101, paymentCardBrand: "VISA", paymentCardType: "CREDIT", paymentMode: "CARD", min_amount: 0, max_amount: 1000, percent_fee: 1.5 },
  { id: 102, paymentCardBrand: "VISA", paymentCardType: "DEBIT", paymentMode: "CARD", min_amount: 0, max_amount: 1000, percent_fee: 1.2 },
  { id: 103, paymentCardBrand: "MASTERCARD", paymentCardType: "CREDIT", paymentMode: "CARD", min_amount: 0, max_amount: 1000, percent_fee: 1.6 },
  { id: 104, paymentCardBrand: "MASTERCARD", paymentCardType: "DEBIT", paymentMode: "CARD", min_amount: 0, max_amount: 1000, percent_fee: 1.3 },
  { id: 105, paymentCardBrand: "RUPAY", paymentCardType: "CREDIT", paymentMode: "CARD", min_amount: 0, max_amount: 1000, percent_fee: 1.4 },
  { id: 106, paymentCardBrand: "RUPAY", paymentCardType: "DEBIT", paymentMode: "CARD", min_amount: 0, max_amount: 1000, percent_fee: 1.1 },
  { id: 107, paymentCardBrand: "OTHER", paymentCardType: "CREDIT", paymentMode: "CARD", min_amount: 0, max_amount: 1000, percent_fee: 1.8 },
  { id: 108, paymentCardBrand: "OTHER", paymentCardType: "DEBIT", paymentMode: "CARD", min_amount: 0, max_amount: 1000, percent_fee: 1.4 },
  { id: 109, paymentMode: "UPI", min_amount: 0, max_amount: 1000, percent_fee: 0.8 },
  { id: 110, paymentMode: "NETBANKING", min_amount: 0, max_amount: 1000, percent_fee: 1.0 },
  { id: 111, paymentMode: "WALLET", min_amount: 0, max_amount: 1000, percent_fee: 1.25 },
  { id: 112, paymentMode: "CASH", min_amount: 0, max_amount: 1000, percent_fee: 0.0 },
  { id: 113, paymentMode: "OTHER", min_amount: 0, max_amount: 1000, percent_fee: 1.5 },
];

const HARDCORE_USER_COMMISSIONS = [
  { id: 2001, user_id: 42, commission_default_id: 101, paymentCardBrand: "VISA", paymentCardType: "CREDIT", paymentMode: "CARD", percent_fee: 1.35, min_amount: 0, max_amount: 1000, is_active: true },
  { id: 2002, user_id: 42, commission_default_id: 109, paymentMode: "UPI", percent_fee: 0.7, min_amount: 0, max_amount: 1000, is_active: true },
  { id: 2003, user_id: 42, commission_default_id: 110, paymentMode: "NETBANKING", percent_fee: 0.9, min_amount: 0, max_amount: 1000, is_active: true },
];

const pickArray = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.list)) return payload.list;
  if (Array.isArray(payload?.rows)) return payload.rows;
  if (Array.isArray(payload?.result)) return payload.result;
  if (Array.isArray(payload?.data?.rows)) return payload.data.rows;
  return [];
};

const authHeaders = () => {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const normalizeToken = (value) => String(value ?? "").trim().toUpperCase().replace(/\s+/g, "");
const toTitle = (value) => {
  const text = String(value ?? "").toLowerCase();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : "";
};

const toUiMethod = (paymentModeOrMethod) => {
  const token = normalizeToken(paymentModeOrMethod);
  if (token === "CARD" || token === "POS") return "Card";
  if (token === "UPI") return "UPI";
  if (token === "NETBANKING") return "Net Banking";
  if (token === "WALLET") return "Wallet";
  if (token === "CASH") return "Cash";
  if (token === "PREPAID") return "Prepaid";
  if (token === "CORPORATE") return "Corporate";
  if (!token) return "Other";
  return "Other";
};

const toApiCardMode = ({ sourceMode, forUser = false } = {}) => {
  if (forUser) return "CARD";
  const incomingMode = normalizeToken(sourceMode);
  if (incomingMode === "POS" || incomingMode === "CARD") return incomingMode;
  return "POS";
};

const toApiPaymentMode = (method, { sourceMode, forUser = false } = {}) => {
  const token = normalizeToken(method);
  if (token === "CARD") return toApiCardMode({ sourceMode, forUser });
  if (token === "UPI") return "UPI";
  if (token === "NETBANKING") return "NETBANKING";
  if (token === "WALLET") return "WALLET";
  if (token === "CASH") return "CASH";
  if (token === "PREPAID") return "PREPAID";
  if (token === "CORPORATE") return "CORPORATE";
  return "OTHER";
};

const isNumericString = (value) => /^\d+$/.test(String(value ?? "").trim());

const toApiUserId = (value) => {
  const raw = String(value ?? "").trim();
  if (!raw) return undefined;
  return isNumericString(raw) ? Number(raw) : raw;
};

const toApiDefaultId = (value) => {
  const raw = String(value ?? "").trim();
  if (!raw || !isNumericString(raw)) return undefined;
  return Number(raw);
};

const hasValue = (value) => value !== undefined && value !== null && String(value).trim() !== "";
const clampPercentage = (value) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return Math.min(100, Math.max(0, num));
};

const extractFee = (row) => {
  const percent = row?.percent_fee ?? row?.percentFee;
  const flat = row?.flat_fee ?? row?.flatFee;
  if (percent !== undefined && percent !== null && percent !== "") return Number(percent);
  if (flat !== undefined && flat !== null && flat !== "") return Number(flat);
  return 0;
};

const toUiCommissionRow = (rawRow, overrides = {}) => {
  const source = rawRow?.commission_default || rawRow?.commissionDefault || rawRow?.default || rawRow;
  const rawPaymentMode =
    source?.paymentMode ??
    source?.payment_mode ??
    rawRow?.paymentMode ??
    rawRow?.payment_mode;
  const percentFeeCandidate = source?.percent_fee ?? source?.percentFee ?? rawRow?.percent_fee ?? rawRow?.percentFee;
  const flatFeeCandidate = source?.flat_fee ?? source?.flatFee ?? rawRow?.flat_fee ?? rawRow?.flatFee;
  const percentFeeValue = Number(percentFeeCandidate ?? 0);
  const flatFeeValue = Number(flatFeeCandidate ?? 0);
  const percentFee = Number.isFinite(percentFeeValue) ? percentFeeValue : 0;
  const flatFee = Number.isFinite(flatFeeValue) ? flatFeeValue : 0;
  const hasPercentFee = percentFee > 0;
  const hasFlatFee = flatFee > 0;
  const fee = extractFee(source);
  const commissionRateCandidate =
    rawRow?.commission_rate ??
    rawRow?.commissionRate ??
    source?.commission_rate ??
    source?.commissionRate;

  const commissionRate =
    commissionRateCandidate !== undefined && commissionRateCandidate !== null && commissionRateCandidate !== ""
      ? Number(commissionRateCandidate)
      : Number(hasPercentFee ? percentFee : fee ?? 0);
  const feeType = hasFlatFee && !hasPercentFee ? "flat" : "percent";

  return {
    id: rawRow?.id ?? source?.id ?? rawRow?.commission_default_id ?? Date.now(),
    user_id: rawRow?.user_id ?? rawRow?.userId ?? "",
    commission_default_id: rawRow?.commission_default_id ?? source?.id ?? "",
    method: toUiMethod(rawPaymentMode ?? source?.method),
    network: String(source?.paymentCardBrand ?? source?.payment_card_brand ?? source?.network ?? "").toUpperCase(),
    cardType: toTitle(source?.paymentCardType ?? source?.payment_card_type ?? source?.cardType),
    paymentMode: normalizeToken(rawPaymentMode),
    feeType,
    commissionRate,
    flatFee: hasFlatFee ? flatFee : "",
    min_amount: source?.min_amount ?? source?.minAmount ?? 0,
    max_amount: source?.max_amount ?? source?.maxAmount ?? 1000000,
    is_active: rawRow?.is_active ?? true,
    ...overrides,
  };
};

const toDefaultRows = (payload) => {
  const list = pickArray(payload);
  return dedupeGlobalRows(list.map((row) => toUiCommissionRow(row)));
};

const toUserRows = (payload) => {
  const list = pickArray(payload);
  return list.map((row) => toUiCommissionRow(row));
};

const globalRuleSignature = (row) =>
  `${String(row?.method || "").trim().toUpperCase()}|${String(row?.network || "").trim().toUpperCase()}|${String(row?.cardType || "").trim().toUpperCase()}|${String(row?.min_amount ?? row?.minAmount ?? "").trim()}|${String(row?.max_amount ?? row?.maxAmount ?? "").trim()}`;

const pickPreferredGlobalRow = (current, candidate) => {
  const currentHasUser = hasValue(current?.user_id ?? current?.userId);
  const candidateHasUser = hasValue(candidate?.user_id ?? candidate?.userId);
  if (currentHasUser !== candidateHasUser) {
    return candidateHasUser ? current : candidate;
  }

  const currentId = Number(current?.id);
  const candidateId = Number(candidate?.id);
  if (Number.isFinite(currentId) && Number.isFinite(candidateId)) {
    return candidateId < currentId ? candidate : current;
  }

  return current;
};

const dedupeGlobalRows = (rows) => {
  const bySignature = new Map();
  rows.forEach((row) => {
    const key = globalRuleSignature(row);
    const existing = bySignature.get(key);
    if (!existing) {
      bySignature.set(key, row);
      return;
    }
    bySignature.set(key, pickPreferredGlobalRow(existing, row));
  });
  return Array.from(bySignature.values());
};

const toApiCommissionPayload = (uiRow, { forUser = false } = {}) => {
  const paymentMode = toApiPaymentMode(uiRow?.method, {
    sourceMode: uiRow?.paymentMode ?? uiRow?.payment_mode,
    forUser,
  });
  // NOTE: Flat-fee payload flow is intentionally disabled in percentage-only mode.
  // const feeType = String(uiRow?.feeType ?? "").trim().toLowerCase() === "flat" ? "flat" : "percent";

  const payload = {
    paymentMode,
    min_amount: Number(uiRow?.min_amount ?? uiRow?.minAmount ?? 0),
    max_amount: Number(uiRow?.max_amount ?? uiRow?.maxAmount ?? 1000000),
  };

  const commissionRateValue = uiRow?.commissionRate;
  const feeSource = hasValue(commissionRateValue) ? commissionRateValue : uiRow?.percent_fee;
  payload.percent_fee = clampPercentage(feeSource ?? 0);
  // NOTE: Do not send `flat_fee` until fixed-rate slab rollout is enabled again.
  // payload.flat_fee = 0;

  if (paymentMode === "CARD" || paymentMode === "POS") {
    payload.paymentCardBrand = String(uiRow?.network ?? "VISA").toUpperCase();
    payload.paymentCardType = normalizeToken(uiRow?.cardType || "CREDIT");
  }

  if (forUser) {
    const userId = toApiUserId(uiRow?.user_id ?? uiRow?.userId);
    if (userId !== undefined) payload.user_id = userId;
    const defaultId = toApiDefaultId(uiRow?.commission_default_id ?? uiRow?.commissionDefaultId);
    if (defaultId !== undefined) payload.commission_default_id = defaultId;
  }

  return payload;
};

const buildMockCreatedRow = (payload, { forUser = false } = {}) =>
  toUiCommissionRow(
    {
      id: Date.now(),
      user_id: payload?.user_id,
      commission_default_id: payload?.commission_default_id,
      paymentMode: payload?.paymentMode,
      paymentCardBrand: payload?.paymentCardBrand,
      paymentCardType: payload?.paymentCardType,
      min_amount: payload?.min_amount,
      max_amount: payload?.max_amount,
      percent_fee: payload?.percent_fee,
      // NOTE: Flat-fee mock mapping intentionally disabled in percentage-only mode.
      // flat_fee: payload?.flat_fee,
      is_active: true,
    },
    forUser ? { user_id: payload?.user_id ?? "" } : {}
  );

export const getDefaultCommissions = async () => {
  if (isCommissionDevelopmentMode()) {
    return toDefaultRows(HARDCORE_DEFAULT_SLABS);
  }

  const token = getAuthToken();
  if (!token) throw new Error("Not Authorized");

  try {
    const response = await api.get("/commission/default", {
      headers: authHeaders(),
    });
    const rows = toDefaultRows(response.data);
    return rows;
  } catch (error) {
    throw new Error(error.response?.data?.message || "Failed to fetch default commissions");
  }
};

export const createDefaultCommission = async (uiData) => {
  const payload = toApiCommissionPayload(uiData, { forUser: false });
  if (isCommissionDevelopmentMode()) {
    return buildMockCreatedRow(payload);
  }

  const token = getAuthToken();
  if (!token) throw new Error("Not Authorized");

  try {
    const response = await api.post("/commission/default", payload, {
      headers: authHeaders(),
    });
    return toUiCommissionRow(response.data || payload);
  } catch (error) {
    throw new Error(error.response?.data?.message || "Failed to create default commission");
  }
};

export const updateDefaultCommission = async (id, uiData) => {
  const payload = toApiCommissionPayload(uiData, { forUser: false });
  if (isCommissionDevelopmentMode()) {
    return { ...uiData, id };
  }

  const token = getAuthToken();
  if (!token) throw new Error("Not Authorized");

  try {
    const response = await api.put(`/commission/default/${id}`, payload, {
      headers: authHeaders(),
    });
    return toUiCommissionRow(response.data || { ...payload, id });
  } catch (error) {
    throw new Error(error.response?.data?.message || "Failed to update default commission");
  }
};

export const deleteDefaultCommission = async (id) => {
  if (isCommissionDevelopmentMode()) {
    return { id, deleted: true, mock: true };
  }

  const token = getAuthToken();
  if (!token) throw new Error("Not Authorized");

  try {
    const response = await api.delete(`/commission/default/${id}`, {
      headers: authHeaders(),
    });
    return response.data;
  } catch (error) {
    throw new Error(error.response?.data?.message || "Failed to delete default commission");
  }
};

export const getUserCommissions = async (userId) => {
  const sample = hasValue(userId)
    ? toUserRows(HARDCORE_USER_COMMISSIONS.filter((row) => String(row.user_id) === String(userId)))
    : toUserRows(HARDCORE_USER_COMMISSIONS);

  if (isCommissionDevelopmentMode()) {
    return sample;
  }

  const token = getAuthToken();
  if (!token) throw new Error("Not Authorized");

  try {
    const response = await api.get("/commission/user", {
      headers: authHeaders(),
      params: hasValue(userId) ? { user_id: toApiUserId(userId) ?? userId } : undefined,
    });
    const rows = toUserRows(response.data);
    return rows;
  } catch (error) {
    throw new Error(error.response?.data?.message || "Failed to fetch user commissions");
  }
};

export const createUserCommission = async (uiData) => {
  const userId = toApiUserId(uiData?.user_id ?? uiData?.userId);
  const commissionDefaultId = toApiDefaultId(uiData?.commission_default_id);
  const hasCustomCommission =
    (uiData.commissionRate !== "" && uiData.commissionRate !== undefined && uiData.commissionRate !== null);
  // NOTE: Flat-fee custom detection intentionally disabled in percentage-only mode.
  // (uiData.flatFee !== "" && uiData.flatFee !== undefined && uiData.flatFee !== null) ||
  // (uiData.flat_fee !== "" && uiData.flat_fee !== undefined && uiData.flat_fee !== null);

  let payload;
  if (hasCustomCommission) {
    // Case 1: Custom commission provided. Create a new slab for the user, using the global rule as a template.
    // The backend expects a full slab definition without a reference to a default slab.
    payload = toApiCommissionPayload(uiData, { forUser: true });
    delete payload.commission_default_id;
  } else if (commissionDefaultId !== undefined) {
    // Case 2: No custom commission. Link the user to the existing default slab.
    payload = {
      user_id: userId,
      commission_default_id: commissionDefaultId,
    };
  } else {
    // Case 3: Fallback for creating a new slab from scratch without a template.
    payload = toApiCommissionPayload(uiData, { forUser: true });
  }


  if (!hasValue(payload?.user_id)) {
    throw new Error("User is required");
  }

  if (isCommissionDevelopmentMode()) {
    return buildMockCreatedRow(payload, { forUser: true });
  }

  const token = getAuthToken();
  if (!token) throw new Error("Not Authorized");

  try {
    const response = await api.post("/commission/user", payload, {
      headers: authHeaders(),
    });
    return toUiCommissionRow(response.data || payload, {
      user_id: payload?.user_id ?? "",
    });
  } catch (error) {
    console.error("[createUserCommission] 400/failed payload:", payload);
    console.error("[createUserCommission] server response:", error?.response?.data);
    throw new Error(error.response?.data?.message || "Failed to create user commission");
  }
};

export const updateUserCommission = async (id, uiData) => {
  const basePayload = toApiCommissionPayload(uiData, { forUser: true });
  // eslint-disable-next-line no-unused-vars
  const { user_id, ...payload } = basePayload;

  if (isCommissionDevelopmentMode()) {
    return { ...uiData, id };
  }

  const token = getAuthToken();
  if (!token) throw new Error("Not Authorized");

  try {
    const response = await api.put(`/commission/user/${id}`, payload, {
      headers: authHeaders(),
    });
    return toUiCommissionRow(response.data || { ...payload, id }, { user_id: uiData?.user_id ?? "" });
  } catch (error) {
    console.error("[updateUserCommission] 400/failed payload:", payload);
    console.error("[updateUserCommission] server response:", error?.response?.data);
    throw new Error(error.response?.data?.message || "Failed to update user commission");
  }
};

export const deleteUserCommission = async (id) => {
  if (isCommissionDevelopmentMode()) {
    return { id, deleted: true, mock: true };
  }

  const token = getAuthToken();
  if (!token) throw new Error("Not Authorized");

  try {
    const response = await api.delete(`/commission/user/${id}`, {
      headers: authHeaders(),
    });
    return response.data;
  } catch (error) {
    throw new Error(error.response?.data?.message || "Failed to delete user commission");
  }
};

const toUiUser = (user) => ({
  id: user?.id ?? user?.user_id ?? user?.abheepay_id ?? "",
  name: user?.name ?? user?.full_name ?? user?.user_name ?? "Unknown",
  mobile: user?.mobile ?? user?.mobile_number ?? user?.phone ?? "",
});

export const getFranchises = async ({ page = 1, limit = 1000, status = "active" } = {}) => {
  if (isCommissionDevelopmentMode()) {
    return [
      { id: "FRN1001", name: "Franchise One", mobile: "9333333333" },
      { id: "FRN1002", name: "Franchise Two", mobile: "9444444444" },
    ];
  }

  const token = getAuthToken();
  if (!token) throw new Error("Not Authorized");

  try {
    const response = await api.get(`/franchaise/?status=${encodeURIComponent(status)}&page=${page}&limit=${limit}`, {
      headers: authHeaders(),
    });
    return pickArray(response.data).map(toUiUser);
  } catch (error) {
    throw new Error(error.response?.data?.message || "Failed to fetch franchises");
  }
};

export const getMerchants = async ({ page = 1, limit = 1000, status = "active" } = {}) => {
  if (isCommissionDevelopmentMode()) {
    return [
      { id: "MRC2001", name: "Merchant One", mobile: "9111111111" },
      { id: "MRC2002", name: "Merchant Two", mobile: "9222222222" },
    ];
  }

  const token = getAuthToken();
  if (!token) throw new Error("Not Authorized");

  try {
    const response = await api.get(`/merchant/?status=${encodeURIComponent(status)}&page=${page}&limit=${limit}`, {
      headers: authHeaders(),
    });
    return pickArray(response.data).map(toUiUser);
  } catch (error) {
    throw new Error(error.response?.data?.message || "Failed to fetch merchants");
  }
};

export const mockGlobal = toDefaultRows(HARDCORE_DEFAULT_SLABS);
export const mockUsers = [
  { id: 1, name: "Merchant One" },
  { id: 2, name: "Merchant Two" },
];