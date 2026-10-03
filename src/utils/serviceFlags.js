export const SERVICE_FLAG_CONFIG = [
  {
    key: "vimo_payout",
    label: "Vimo Payout",
    description: "Enable or disable the Vimo payout flow for merchant and franchise users.",
  },
  {
    key: "sevenpay_payout",
    label: "SevenPay Payout",
    description: "Enable or disable the SevenPay payout flow for merchant and franchise users.",
  },
  {
    key: "ndia5_payout",
    label: "PAYOUT-N",
    description: "Enable or disable the PAYOUT-N flow for merchant and franchise users.",
  },
  {
    key: "branchx_payout",
    label: "BranchX Payout",
    description: "Enable or disable the BranchX payout flow for merchant and franchise users.",
  },
  {
    key: "cc_bill_pay",
    label: "CC Bill Pay",
    description: "Enable or disable the InstantPay credit-card bill payment flow.",
  },
  {
    key: "ba_cc_bill_pay",
    label: "BA CC Bill Pay",
    description: "Enable or disable the BillAvenue credit-card bill payment flow.",
  },
  {
    key: "cc_bill_3",
    label: "CC Bill 3",
    description: "Enable or disable the CC Bill 3 bank-callback payment flow.",
  },
  {
    key: "mx_payout",
    label: "Payout MX",
    description: "Enable or disable the Payout MX flow for merchant and franchise users.",
  },
  {
    key: "user_daily_limit",
    label: "User Daily Limit",
    description: "Enable or disable daily payout limit enforcement for users.",
  },
  {
    key: "pos_t0_settlement",
    label: "POS Settlement Evaluator",
    description: "Enable or disable global POS Settlement Evaluator. When ON, Money-In events dynamically evaluate daily limit rules to route T0/T1. When OFF, static DB settlement mode is used without limit checks.",
  },
];

export const SERVICE_FLAG_DEFAULTS = SERVICE_FLAG_CONFIG.reduce((acc, item) => {
  acc[item.key] = (item.key === "mx_payout" || item.key === "ndia5_payout") ? false : true;
  return acc;
}, {});

export const getServiceFlagMeta = (serviceKey) =>
  SERVICE_FLAG_CONFIG.find((item) => item.key === serviceKey) || null;

export const getServiceFlagValue = (source, serviceKey, fallback = true) => {
  const rawValue = source?.[serviceKey];

  if (typeof rawValue === "boolean") {
    return rawValue;
  }

  if (rawValue && typeof rawValue === "object" && typeof rawValue.is_enabled === "boolean") {
    return rawValue.is_enabled;
  }

  const effectiveFallback = (serviceKey === "ndia5_payout" || serviceKey === "mx_payout") ? false : fallback;
  return effectiveFallback;
};

export const normalizeServiceFlags = (source, fallback = true) =>
  SERVICE_FLAG_CONFIG.reduce((acc, item) => {
    acc[item.key] = getServiceFlagValue(source, item.key, fallback);
    return acc;
  }, {});

export const isServiceDisabledError = (error) => {
  const status = Number(error?.status ?? error?.response?.status ?? 0);
  const code =
    error?.code ||
    error?.response?.data?.code ||
    error?.responseData?.code ||
    "";

  return status === 403 && String(code).trim().toUpperCase() === "SERVICE_DISABLED";
};

export const getServiceDisabledMessage = (
  error,
  fallback = "Service is currently disabled."
) => {
  if (!isServiceDisabledError(error)) {
    return (
      error?.response?.data?.message ||
      error?.responseData?.message ||
      error?.message ||
      fallback
    );
  }

  const serviceKey =
    error?.service_key ||
    error?.response?.data?.service_key ||
    error?.responseData?.service_key ||
    "";
  const meta = getServiceFlagMeta(serviceKey);

  return meta ? `${meta.label} is currently disabled.` : fallback;
};
