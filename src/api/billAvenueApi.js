import axios from "axios";
import { BASE_URL } from "../constants";
import { getAuthToken } from "../utils/auth";

const api = axios.create({
  baseURL: BASE_URL,
  headers: { "Content-Type": "application/json" },
});

const authHeaders = () => {
  const token = getAuthToken();
  if (!token) throw new Error("Not Authorized");
  return { Authorization: `Bearer ${token}` };
};

const normalizeText = (value) => String(value ?? "").trim();

const pickArray = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.list)) return payload.list;
  if (Array.isArray(payload?.rows)) return payload.rows;
  if (Array.isArray(payload?.result)) return payload.result;
  if (Array.isArray(payload?.data?.data)) return payload.data.data;
  return [];
};

const parseBillAvenueError = (error, fallback = 'Unexpected request failure') => {
  const data = error?.response?.data;
  if (data) {
    if (typeof data === 'string' && data.trim().startsWith('<')) {
      return 'BillAvenue access issue (credentials/IP). Contact ops.';
    }
    return data.message || data.error || fallback;
  }
  return error?.message || fallback;
};

/**
 * Extracts input parameter definitions from a biller object.
 * BillAvenue billers carry per-biller input fields; structure varies, so we
 * try several common paths and fall back to a single CRN field.
 */
export const extractBillerInputParams = (biller) => {
  const raw = biller?.raw || biller || {};
  const params =
    raw.parameters ||
    raw.metadata?.parameters ||
    raw.inputParams ||
    raw.billerInputParams ||
    raw.customerInputFields ||
    raw.fetchInputs ||
    [];

  if (Array.isArray(params) && params.length > 0) {
    return params.map((p) => {
      const fieldLabel = normalizeText(p.desc || p.paramName || (p.name && !p.name.startsWith('param') ? p.name : '') || p.label || "Card Reference Number");
      return {
        key: fieldLabel,
        label: fieldLabel,
        type: normalizeText(p.inputType || p.paramType || p.type || "ALPHANUMERIC"),
        minLength: p.minLength || p.minLen || null,
        maxLength: p.maxLength || p.maxLen || null,
        optional: Boolean(p.optional || p.mandatory === 0),
        regex: p.regex || p.regEx || null,
      };
    });
  }

  return [
    {
      key: "Card Reference Number",
      label: "Card Reference Number",
      type: "ALPHANUMERIC",
      minLength: null,
      maxLength: null,
      optional: false,
    },
  ];
};

/**
 * GET /api/bill-avenue/billers
 * Returns cached list of CC billers supported by BillAvenue.
 */
export const getBillAvenueBillers = async (categoryOrContext = "Credit Card") => {
  const category = typeof categoryOrContext === "string" ? categoryOrContext : "Credit Card";

  try {
    const response = await api.get("/bill-avenue/billers", {
      headers: authHeaders(),
      params: { category },
    });

    // BillAvenue returns { success: true, data: { billers: [...] } }
    const payload = response.data?.data;
    let list = [];
    if (Array.isArray(payload?.billers)) {
      list = payload.billers;
    } else {
      list = pickArray(payload ?? response.data);
    }

    return list.map((item) => ({
      id: normalizeText(item?.billerId || item?.id),
      name: normalizeText(item?.billerName || item?.name),
      raw: item,
    }));
  } catch (error) {
    throw new Error(parseBillAvenueError(error, 'Failed to fetch BillAvenue billers'));
  }
};

/**
 * POST /api/bill-avenue/billers/upload
 * Uploads CSV/XLS/XLSX biller list to admin store.
 */
export const uploadBillAvenueBillers = async (file) => {
  if (!file) {
    throw new Error('File is required for upload');
  }

  try {
    const formData = new FormData();
    formData.append('file', file);

    const response = await api.post('/bill-avenue/billers/upload', formData, {
      headers: {
        ...authHeaders(),
        'Content-Type': 'multipart/form-data',
      },
    });

    if (!response.data?.success) {
      throw new Error(response.data?.message || 'Upload failed');
    }

    return response.data;
  } catch (error) {
    throw new Error(parseBillAvenueError(error, 'Failed to upload BillAvenue biller file'));
  }
};

/**
 * POST /api/bill-avenue/fetch-bill
 * Validates the customer account and retrieves the outstanding bill amount.
 */
export const fetchBillAvenueBill = async ({ billerId, customerParams, amount, initChannel = "AGT" }) => {
  const payload = { billerId, customerParams, initChannel };
  if (amount != null && Number(amount) > 0) {
    payload.amount = Number(amount);
  }
  try {
    const response = await api.post("/bill-avenue/fetch-bill", payload, {
      headers: authHeaders(),
    });
    // The endpoint can return 400 with an insufficient-balance error when
    // amount is provided for pre-check — treat non-success as an error.
    if (!response.data?.success) {
      const err = new Error(response.data?.message || "Failed to fetch bill");
      err.responseData = response.data;
      throw err;
    }
    return response.data;
  } catch (error) {
    if (error.responseData) throw error;
    throw new Error(parseBillAvenueError(error, 'Failed to fetch bill'));
  }
};

/**
 * POST /api/bill-avenue/pay
 * Executes the CC bill payment. The server debits the wallet and calls
 * BillAvenue. Always check `success` and `responseCode` — HTTP 200 does not
 * mean the payment succeeded.
 */
export const submitBillAvenuePayment = async ({
  billerId,
  customerParams,
  amount,
  paymentMode = "Cash",
  quickPay = "N",
  splitPay = null,
  ccf = null,
  billerResponseInfo = undefined,
  additionalInfo = undefined,
  requestId = undefined,
  initChannel = "AGT",
  customerPan = undefined,
}) => {
  const transactionAmount = Number(amount);
  if (!Number.isFinite(transactionAmount) || transactionAmount <= 0) {
    throw new Error("Valid amount is required");
  }
  try {
    const payload = { billerId, customerParams, amount: transactionAmount, paymentMode, quickPay, splitPay, ccf, billerResponseInfo, additionalInfo, requestId, initChannel, customerPan };
    console.log("[BillAvenue] PAY REQUEST PAYLOAD:", JSON.stringify(payload, null, 2));
    
    const response = await api.post(
      "/bill-avenue/pay",
      payload,
      { headers: authHeaders() }
    );
    console.log("[BillAvenue] PAY RESPONSE:", JSON.stringify(response.data, null, 2));
    return response.data;
  } catch (error) {
    const enrichedError = new Error(parseBillAvenueError(error, 'Payment request failed'));
    enrichedError.status = error?.response?.status;
    enrichedError.code = error?.response?.data?.code;
    enrichedError.service_key = error?.response?.data?.service_key;
    enrichedError.response = error?.response;
    enrichedError.responseData = error?.response?.data;
    throw enrichedError;
  }
};

/**
 * POST /api/bill-avenue/biller-info-json
 * Retrieves detailed information for a selected BillAvenue biller.
 */
export const getBillAvenueBillerInfo = async (billerId) => {
  if (!billerId) {
    throw new Error('Biller ID is required');
  }

  try {
    const response = await api.post(
      '/bill-avenue/biller-info',
      { billerId },
      { headers: authHeaders() }
    );

    if (!response.data?.success) {
      const err = new Error(response.data?.message || 'Failed to fetch BillAvenue biller info');
      err.responseData = response.data;
      throw err;
    }

    return response.data;
  } catch (error) {
    if (error.responseData) throw error;
    throw new Error(parseBillAvenueError(error, 'Failed to fetch BillAvenue biller info'));
  }
};

/**
 * GET /api/bill-avenue/payments
 * Returns paginated payment history. Admins see all records.
 *
 * @param {object} params - { page, limit, status, billerId, transactionRefId }
 */
export const getBillAvenuePayments = async (params = {}) => {
  try {
    const response = await api.get("/bill-avenue/payments", {
      headers: authHeaders(),
      params,
    });
    return response.data;
  } catch (error) {
    throw new Error(parseBillAvenueError(error, 'Failed to fetch payment records'));
  }
};

export const getAllBillAvenuePayments = async (params = {}, options = {}) => {
  const requestedLimit = Number(options.limit) > 0 ? Number(options.limit) : 200;
  const firstResponse = await getBillAvenuePayments({
    ...params,
    page: 1,
    limit: requestedLimit,
  });

  const firstRows = pickArray(firstResponse);
  const totalCount = Number(firstResponse?.count ?? firstResponse?.total ?? firstRows.length);
  const totalPages = Number.isFinite(totalCount) && totalCount > 0
    ? Math.max(1, Math.ceil(totalCount / requestedLimit))
    : 1;

  if (totalPages <= 1) {
    return firstRows;
  }

  const remainingResponses = await Promise.all(
    Array.from({ length: totalPages - 1 }, (_, index) =>
      getBillAvenuePayments({
        ...params,
        page: index + 2,
        limit: requestedLimit,
      })
    )
  );

  return [firstRows, ...remainingResponses.map((response) => pickArray(response))].flat();
};

/**
 * GET /api/bill-avenue/payments/:id
 */
export const getBillAvenuePaymentById = async (id) => {
  try {
    const response = await api.get(`/bill-avenue/payments/${id}`, {
      headers: authHeaders(),
    });
    return response.data;
  } catch (error) {
    throw new Error(parseBillAvenueError(error, 'Failed to fetch payment record'));
  }
};

/**
 * GET /api/bill-avenue/cc-bill-3/banks
 * Returns supported bank names for the CC Bill 3 flow.
 */
export const getBillAvenueCcBill3Banks = async () => {
  try {
    const response = await api.get("/bill-avenue/cc-bill-3/banks", {
      headers: authHeaders(),
    });
    return response.data;
  } catch (error) {
    throw new Error(parseBillAvenueError(error, "Failed to fetch CC Bill 3 banks"));
  }
};

/**
 * POST /api/vimo/cc-bill-3/pay-direct
 * Initiates the CC Bill 3 payment flow.
 */
export const submitBillAvenueCcBill3Payment = async ({
  billerId,
  customerParams,
  bankName,
  amount,
  lat,
  long,
  beneficiaryLocation,
}) => {
  try {
    const response = await api.post(
      "/vimo/cc-bill-3/pay-direct",
      {
        billerId,
        customerParams,
        bankName,
        amount,
        lat,
        long,
        beneficiaryLocation,
      },
      {
        headers: authHeaders(),
      }
    );
    return response.data;
  } catch (error) {
    const enrichedError = new Error(parseBillAvenueError(error, "CC Bill 3 payment request failed"));
    enrichedError.status = error?.response?.status;
    enrichedError.code = error?.response?.data?.code;
    enrichedError.response = error?.response;
    enrichedError.responseData = error?.response?.data;
    throw enrichedError;
  }
};

/**
 * GET /api/bill-avenue/cc-bill-3/payments/:id
 * Returns the latest status for a CC Bill 3 payment.
 */
export const getBillAvenueCcBill3PaymentById = async (id) => {
  if (!id) {
    throw new Error("Payment ID is required");
  }

  try {
    const response = await api.get(`/bill-avenue/cc-bill-3/payments/${id}`, {
      headers: authHeaders(),
    });
    return response.data;
  } catch (error) {
    throw new Error(parseBillAvenueError(error, "Failed to fetch CC Bill 3 payment status"));
  }
};

/**
 * POST /api/bill-avenue/transaction-status
 * Verify a transaction outcome when the payment response was ambiguous.
 */
export const checkBillAvenueStatus = async (transactionRefId, requestId) => {
  try {
    const payload = {};
    if (transactionRefId) payload.transactionRefId = transactionRefId;
    if (requestId) payload.requestId = requestId;

    const response = await api.post(
      "/bill-avenue/transaction-status",
      payload,
      { headers: authHeaders() }
    );
    return response.data;
  } catch (error) {
    throw new Error(parseBillAvenueError(error, 'Failed to check transaction status'));
  }
};

/**
 * POST /api/bill-avenue/complaint
 * Raise a complaint for a failed or disputed transaction.
 */
export const registerBillAvenueComplaint = async ({
  billerId,
  transactionRefId,
  reason = "Transaction Failed",
  description = "",
}) => {
  try {
    const response = await api.post(
      "/bill-avenue/complaint",
      { billerId, transactionRefId, reason, description },
      { headers: authHeaders() }
    );
    return response.data;
  } catch (error) {
    throw new Error(parseBillAvenueError(error, 'Failed to register complaint'));
  }
};
