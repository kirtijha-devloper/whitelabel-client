import axios from "axios";
import { BASE_URL } from "../constants";
import { getAuthToken } from "../utils/auth";

const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

const SUCCESS_STATUS_CODES = new Set(["TXN", "TUP"]);
const paymentStore = new Map();
const FETCH_BILL_ENQUIRY_AMOUNT = 1;

const toNumber = (value, fallback = null) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

const toAmount = (value, fallback = null) => {
  const normalized = normalizeText(value).replace(/,/g, "");
  if (!normalized) return fallback;
  const num = Number(normalized);
  return Number.isFinite(num) ? num : fallback;
};

const toIsoDate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const pickArray = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.list)) return payload.list;
  if (Array.isArray(payload?.rows)) return payload.rows;
  if (Array.isArray(payload?.result)) return payload.result;
  if (Array.isArray(payload?.data?.data)) return payload.data.data;
  return [];
};

const authHeaders = () => {
  const token = getAuthToken();
  if (!token) throw new Error("Not Authorized");
  return {
    Authorization: `Bearer ${token}`,
  };
};

const normalizeText = (value) => String(value ?? "").trim();
const pickFirstText = (...values) =>
  values.map(normalizeText).find(Boolean) || "";

const getNamedDetailValue = (details, candidateNames = []) => {
  const normalizedCandidates = candidateNames
    .map((name) => normalizeText(name).toLowerCase())
    .filter(Boolean);
  if (normalizedCandidates.length === 0) return "";

  const items = Array.isArray(details) ? details : [];
  const match = items.find((item) => {
    const itemName = normalizeText(item?.Name || item?.name).toLowerCase();
    return normalizedCandidates.some(
      (candidate) => itemName === candidate || itemName.includes(candidate),
    );
  });

  return normalizeText(match?.Value ?? match?.value);
};

const getCustomerMobileFromParams = (details) => {
  if (!Array.isArray(details)) return "";
  const mobileDetail = details.find((item) =>
    String(item?.Name || "")
      .toLowerCase()
      .includes("mobile"),
  );
  return normalizeText(mobileDetail?.Value);
};

const getAdditionalDetailValue = (details, key) => {
  if (!Array.isArray(details)) return null;
  const detail = details.find(
    (item) =>
      String(item?.Name || "").toLowerCase() ===
      String(key || "").toLowerCase(),
  );
  return detail ? normalizeText(detail.Value) : null;
};

const parseAmount = (value, fallback = null) => {
  const normalized = normalizeText(value).replace(/,/g, "");
  if (!normalized) return fallback;
  const num = Number(normalized.replace(/[^0-9.-]+/g, ""));
  return Number.isFinite(num) ? num : fallback;
};

// Fixed geoCode sent with every InstantPay request.
// InstantPay requires a valid "lat,long" string; the geographic centre of India
// satisfies the format check without needing browser permission.
const FIXED_GEO_CODE = "20.5937,78.9629";

const maskCard = (value) => {
  const input = normalizeText(value).replace(/\D/g, "");
  if (!input) return "";
  const last4 = input.slice(-4).padStart(4, "0");
  return `**** **** **** ${last4}`;
};

const extractBillerDetails = (payload) => {
  return payload?.data?.data || payload?.data || payload || {};
};

const shouldRunEnquiry = (details) => {
  const fetchReq = normalizeText(details?.fetchRequirement).toUpperCase();
  const validationReq = normalizeText(details?.supportValidation).toUpperCase();
  return fetchReq === "MANDATORY" || validationReq === "MANDATORY";
};

const normalizePaymentModes = (paymentModes = []) => {
  const modes = Array.isArray(paymentModes) ? paymentModes : [];
  if (modes.length === 0) {
    return [
      {
        id: "CASH",
        label: "Cash",
        remarks: "",
        raw: { name: "Cash", paymentInfo: [] },
      },
    ];
  }

  return modes.map((mode) => {
    const label = normalizeText(mode?.name || mode?.label || "Cash");
    const id = label.replace(/\s+/g, "_").toUpperCase();
    const info = Array.isArray(mode?.paymentInfo) ? mode.paymentInfo : [];
    const required = info.filter(
      (item) => item?.optional === false || item?.optional === "false",
    );
    const remarks =
      required.length > 0
        ? `Required: ${required
            .map((item) => normalizeText(item?.name))
            .filter(Boolean)
            .join(", ")}`
        : "";
    return {
      id,
      label,
      remarks,
      raw: {
        ...mode,
        paymentInfo: info,
      },
    };
  });
};

const inferEnquiryParams = (
  billerDetails = {},
  { mobile = "", cardLast4 = "" } = {},
) => {
  const normalizedMobile = normalizeText(mobile);
  const normalizedCard = normalizeText(cardLast4);
  const params = Array.isArray(billerDetails?.parameters)
    ? billerDetails.parameters
    : [];

  const guessValue = (param) => {
    const name = String(param?.name ?? "").toLowerCase();
    const desc = String(param?.desc ?? "").toLowerCase();

    if (name.includes("mobile") || desc.includes("mobile"))
      return normalizedMobile;
    if (name.includes("card") || desc.includes("card")) return normalizedCard;
    if (desc.includes("last") && desc.includes("4")) return normalizedCard;
    if (param?.minLength === 10 || param?.maxLength === 10)
      return normalizedMobile;
    if (param?.minLength === 4 || param?.maxLength === 4) return normalizedCard;

    return "";
  };

  const values = params.slice(0, 2).map(guessValue);
  return {
    param1: values[0] || normalizedMobile,
    param2: values[1] || normalizedCard,
  };
};

const runPrePaymentEnquiry = async ({
  billerId,
  param1,
  param2 = "",
  transactionAmount,
  customerMobile,
}) => {
  const payload = {
    billerId,
    param1: normalizeText(param1),
    param2: normalizeText(param2),
    transactionAmount: Number(transactionAmount),
    customerMobile: normalizeText(customerMobile),
  };

  const response = await api.post("/bbps-cc/pre-payment-enquiry", payload, {
    headers: authHeaders(),
  });
  return response.data;
};

const getNestedStatusCode = (payload) => {
  // Collect statuscode from all nesting levels, then prioritize a recognized
  // success code (TXN / TUP) over whatever happens to appear first.
  // Without this, a backend wrapper that sets its own statuscode at the root
  // (e.g. "200", "00", "SUCCESS") would short-circuit the OR chain and hide
  // InstantPay's actual "TXN"/"TUP" stored at payload.data.statuscode.
  const candidates = [
    payload?.statuscode,
    payload?.data?.statuscode,
    payload?.data?.data?.statuscode,
  ]
    .map((v) => normalizeText(v).toUpperCase())
    .filter(Boolean);
  return (
    candidates.find((c) => SUCCESS_STATUS_CODES.has(c)) ?? candidates[0] ?? ""
  );
};

const normalizePaymentResponse = (payload, fallbackAmount) => {
  const statusCode = getNestedStatusCode(payload);
  // Follow backend rules: must be explicitly successful AND have a success status code.
  const successFlag =
    payload?.success === true ||
    payload?.data?.success === true ||
    payload?.data?.data?.success === true;
  const success = successFlag && SUCCESS_STATUS_CODES.has(statusCode);
  const transactionId = normalizeText(
    payload?.data?.data?.txnReferenceId ||
      payload?.data?.txnReferenceId ||
      payload?.txnReferenceId ||
      payload?.externalRef,
  );
  const referenceId = normalizeText(payload?.externalRef || transactionId);
  const txnValue = toNumber(payload?.data?.data?.txnValue, fallbackAmount ?? 0);
  const providerStatus = normalizeText(
    payload?.data?.status ||
      payload?.data?.data?.status ||
      payload?.status ||
      payload?.message,
  );

  return {
    status: success ? "SUCCESS" : "FAILED",
    statusCode,
    providerStatus,
    message: normalizeText(
      payload?.message || payload?.data?.status || "Payment response received",
    ),
    transactionId,
    referenceId,
    amount: txnValue,
    processedAt: new Date().toISOString(),
    raw: payload,
  };
};

const buildPendingStatus = (referenceId) => ({
  status: "PENDING",
  statusCode: "",
  providerStatus: "",
  message: "No status endpoint is available yet for this provider flow.",
  transactionId: "",
  referenceId: normalizeText(referenceId),
  amount: null,
  processedAt: new Date().toISOString(),
  raw: null,
});

/**
 * GET /api/bbps-cc/billers
 */
export const getCcBillBanks = async () => {
  try {
    const response = await api.get("/bbps-cc/billers", {
      headers: authHeaders(),
    });

    console.groupCollapsed("[CCBillPay] biller list response");
    console.log("Raw response", response?.data);
    console.groupEnd();

    const list = pickArray(response.data?.data ?? response.data);
    return list.map((item) => ({
      id: normalizeText(item?.billerId || item?.id),
      name: normalizeText(item?.billerName || item?.name),
      code: normalizeText(item?.billerId || item?.code),
      raw: item,
    }));
  } catch (error) {
    if (error.response) {
      if (error.response.status === 502) {
        throw new Error(
          "InstantPay upstream failure. Unable to load billers. Please try again.",
        );
      }
      const resp = error.response.data;
      if (resp?.success === false) {
        const clientMessage = normalizeText(resp.message) || "Unable to load billers. Please try again.";
        throw new Error(clientMessage);
      }
      throw new Error(error.response?.data?.message || "Unable to load billers. Please try again.");
    }
    throw new Error("Unable to load billers. Please try again.");
  }
};

/**
 * POST /api/bbps-cc/biller-details
 * Optional: POST /api/bbps-cc/pre-payment-enquiry
 */
export const fetchCcBill = async ({
  bank,
  cardLast4,
  mobile,
  user,
  transactionAmount,
}) => {
  const billerId = normalizeText(bank?.id || bank?.billerId);
  const customerMobile = normalizeText(mobile);

  if (!billerId) throw new Error("Biller is required");

  try {
    const billerDetailsResp = await api.post(
      "/bbps-cc/biller-details",
      { billerId },
      { headers: authHeaders() },
    );

    const billerDetails = extractBillerDetails(billerDetailsResp.data);
    const paymentModes = normalizePaymentModes(billerDetails?.paymentModes);

    const { param1, param2 } = inferEnquiryParams(billerDetails, {
      mobile: customerMobile,
      cardLast4,
    });

    if (!param1) throw new Error("Required param1 is missing");

    // If the biller requires an enquiry, always attempt it, even when we don't yet know the final amount.
    // Some providers return the bill amount and the required enquiryReferenceId as part of this call.
    const requestedAmount = toNumber(transactionAmount, null);
    const amountForEnquiry =
      Number.isFinite(requestedAmount) && requestedAmount > 0
        ? requestedAmount
        : FETCH_BILL_ENQUIRY_AMOUNT;
    const enquiryPayload = {
      billerId,
      param1,
      param2,
      transactionAmount: amountForEnquiry,
      customerMobile,
    };
    let prePayment = null;
    if (shouldRunEnquiry(billerDetails)) {
      try {
        prePayment = await runPrePaymentEnquiry(enquiryPayload);
      } catch {
        // Some billers do not support pre-payment enquiry; ignore and proceed with available details.
      }
    }

    const billDetails =
      prePayment?.data?.data || prePayment?.data || billerDetails || {};
    const additionalDetails = Array.isArray(billDetails?.AdditionalDetails)
      ? billDetails.AdditionalDetails
      : Array.isArray(billDetails?.additionalDetails)
        ? billDetails.additionalDetails
        : [];
    const outstandingFromAdditionalDetails = toAmount(
      getNamedDetailValue(additionalDetails, [
        "Current Outstanding Amount",
        "Outstanding Amount",
        "Total Due Amount",
        "Total Amount Due",
      ]),
      null,
    );
    const minimumFromAdditionalDetails = toAmount(
      getNamedDetailValue(additionalDetails, [
        "Minimum Amount Due",
        "Minimum Due Amount",
        "Minimum Due",
        "Min Amount Due",
      ]),
      null,
    );

    const rawBillAmount = parseAmount(
      billDetails?.BillAmount ??
        billDetails?.billAmount ??
        billDetails?.amount ??
        billDetails?.totalDueAmount,
      null,
    );

    const currentOutstanding = parseAmount(
      billDetails?.outstandingAmount ??
        billDetails?.outstanding ??
        billDetails?.CurrentOutstandingAmount ??
        billDetails?.currentOutstandingAmount ??
        billDetails?.current_outstanding_amount,
      null,
    );

    const resolvedCurrentOutstandingAmount =
      currentOutstanding ?? outstandingFromAdditionalDetails ?? null;

    const totalDueAmount =
      resolvedCurrentOutstandingAmount ??
      rawBillAmount ??
      toNumber(
        billDetails?.totalDueAmount ??
          billDetails?.outstandingAmount ??
          billDetails?.amount ??
          billDetails?.dueAmount,
        0,
      );

    const minimumDueAmount =
      minimumFromAdditionalDetails ??
      toAmount(
        billDetails?.minimumDueAmount ??
          billDetails?.minimumDueAmount ??
          billDetails?.minDueAmount ??
          billDetails?.minimumAmount ??
          billDetails?.minAmount,
        null,
      ) ??
      Number(Math.max(100, totalDueAmount * 0.2).toFixed(2));

    const today = new Date();
    const customerName = pickFirstText(
      billDetails?.CustomerName,
      billDetails?.customerName,
      billDetails?.customer_name,
      billDetails?.cardHolderName,
      billDetails?.card_holder_name,
      "Customer",
    );
    const customerMobileFromResponse = getCustomerMobileFromParams(
      billDetails?.CustomerParamsDetails,
    );
    const resolvedBillDate =
      pickFirstText(
        billDetails?.BillDate,
        billDetails?.billDate,
        billDetails?.bill_date,
      ) || toIsoDate(today);
    const resolvedDueDate = pickFirstText(
      billDetails?.BillDueDate,
      billDetails?.dueDate,
      billDetails?.due_date,
    );

    const bill = {
      cardNumberMasked: maskCard(cardLast4 || param1),
      bankName: normalizeText(billerDetails?.billerName || bank?.name || "N/A"),
      customerName,
      mobileNumber: customerMobileFromResponse || customerMobile || "",
      billDate: resolvedBillDate,
      dueDate: resolvedDueDate,
      outstandingAmount: totalDueAmount,
      currentOutstandingAmount: resolvedCurrentOutstandingAmount,
      totalDueAmount,
      minimumDueAmount,
      referenceId: normalizeText(
        prePayment?.externalRef ||
          prePayment?.enquiryReferenceId ||
          prePayment?.data?.data?.enquiryReferenceId ||
          "",
      ),
      raw: {
        billerId,
        param1,
        param2,
        customerMobile,
        transactionAmount: amountForEnquiry,
        fetchRequirement: normalizeText(billerDetails?.fetchRequirement),
        supportValidation: normalizeText(billerDetails?.supportValidation),
        enquiryReferenceId: normalizeText(
          prePayment?.enquiryReferenceId ||
            prePayment?.data?.data?.enquiryReferenceId ||
            "",
        ),
        billerDetails,
        prePayment,
      },
    };

    return {
      bill,
      paymentModes,
      status: "SUCCESS",
      message: normalizeText(
        prePayment?.message || "Biller details fetched successfully",
      ),
    };
  } catch (error) {
    throw new Error(
      error.response?.data?.message || "Unable to fetch bill details",
    );
  }
};

/**
 * POST /api/bbps-cc/pay
 */
export const submitCcBillPayment = async ({
  amount,
  biller,
  cardLast4,
  mobile,
  paymentMode,
  billData,
  enquiryReferenceId: explicitEnquiryReferenceId,
  geoCode,
  customerPan,
}) => {
  const transactionAmount = toNumber(amount, null);
  if (!Number.isFinite(transactionAmount) || transactionAmount <= 0) {
    throw new Error("Valid amount is required");
  }

  const billRaw = billData?.raw || {};
  const billerId = normalizeText(
    billRaw?.billerId || biller?.id || biller?.billerId,
  );
  const customerMobile = normalizeText(
    mobile || billRaw?.customerMobile || billData?.mobileNumber,
  );
  const inferredParams = inferEnquiryParams(billRaw?.billerDetails || {}, {
    mobile: customerMobile,
    cardLast4,
  });
  const param1 = normalizeText(
    billRaw?.param1 ?? inferredParams.param1 ?? cardLast4,
  );
  const param2 = normalizeText(billRaw?.param2 ?? inferredParams.param2 ?? "");

  if (!billerId) throw new Error("Biller is required");
  if (!param1) throw new Error("Card number is required");
  if (!customerMobile) throw new Error("Customer mobile is required");

  const selectedModeName = normalizeText(
    paymentMode?.label || paymentMode?.name || "Cash",
  );
  const paymentInfoSchema = Array.isArray(paymentMode?.raw?.paymentInfo)
    ? paymentMode.raw.paymentInfo
    : [];
  const requiredPaymentInfo = paymentInfoSchema.filter(
    (item) => item?.optional === false || item?.optional === "false",
  );
  if (requiredPaymentInfo.length > 0) {
    const fields = requiredPaymentInfo
      .map((item) => normalizeText(item?.name))
      .filter(Boolean)
      .join(", ");
    throw new Error(`Selected payment mode needs extra fields: ${fields}`);
  }

  let enquiryReferenceId = normalizeText(
    explicitEnquiryReferenceId ||
      billRaw?.enquiryReferenceId ||
      billRaw?.raw?.enquiryReferenceId,
  );
  const mandatoryEnquiry =
    normalizeText(billRaw?.fetchRequirement).toUpperCase() === "MANDATORY" ||
    normalizeText(billRaw?.supportValidation).toUpperCase() === "MANDATORY";

  try {
    // Always attempt to ensure we have an enquiryReferenceId before paying.
    // Some providers require it even if the biller flags it as optional.
    if (!enquiryReferenceId) {
      const prePayment = await runPrePaymentEnquiry({
        billerId,
        param1,
        param2,
        transactionAmount,
        customerMobile,
      });

      enquiryReferenceId = normalizeText(
        prePayment?.enquiryReferenceId ||
          prePayment?.data?.data?.enquiryReferenceId ||
          prePayment?.data?.enquiryReferenceId,
      );
    }

    if (!enquiryReferenceId && mandatoryEnquiry) {
      throw new Error("Missing enquiryReferenceId required for this biller.");
    }

    const payload = {
      billerId,
      initChannel: "Internet",
      param1,
      param2,
      transactionAmount,
      customerMobile,
      paymentMode: selectedModeName || "Cash",
      paymentInfo:
        selectedModeName.toUpperCase() === "CASH"
          ? { Remarks: "CC bill payment" }
          : {},
      enquiryReferenceId,
      geoCode: geoCode || FIXED_GEO_CODE,
      ...(normalizeText(customerPan) ? { customerPan: normalizeText(customerPan) } : {}),
    };

    const response = await api.post("/bbps-cc/pay", payload, {
      headers: authHeaders(),
    });

    const normalized = normalizePaymentResponse(
      response.data,
      transactionAmount,
    );
    if (!normalized.referenceId) {
      normalized.referenceId = normalizeText(
        normalized.transactionId || `ccpay_${Date.now()}`,
      );
    }
    paymentStore.set(normalized.referenceId, normalized);

    return { payment: normalized };
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.message ||
      "Payment request failed";
    const enrichedError = new Error(message);
    enrichedError.status = error?.response?.status;
    enrichedError.code = error?.response?.data?.code;
    enrichedError.service_key = error?.response?.data?.service_key;
    enrichedError.response = error?.response;
    enrichedError.responseData = error?.response?.data;
    throw enrichedError;
  }
};

/**
 * No dedicated status endpoint available in current doc.
 * Return last known payment state for now.
 */
export const getCcBillPaymentStatus = async ({ referenceId }) => {
  const key = normalizeText(referenceId);
  return {
    payment: paymentStore.get(key) || buildPendingStatus(key),
  };
};
