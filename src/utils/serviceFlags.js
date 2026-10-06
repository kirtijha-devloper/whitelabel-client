export const INITIAL_SERVICE_CONFIG = [
  {
    key: "vimo_payout",
    label: "Vimo Payout",
    category: "Payout & Banking",
    description: "Enable or disable the Vimo payout flow for merchant and franchise users.",
    target_roles: ["admin", "franchise", "merchant", "super_franchise"],
  },
  {
    key: "sevenpay_payout",
    label: "SevenPay Payout",
    category: "Payout & Banking",
    description: "Enable or disable the SevenPay payout flow for merchant and franchise users.",
    target_roles: ["admin", "franchise", "merchant", "super_franchise"],
  },
  {
    key: "ndia5_payout",
    label: "PAYOUT-N",
    category: "Payout & Banking",
    description: "Enable or disable the PAYOUT-N flow for merchant and franchise users.",
    target_roles: ["admin", "franchise", "merchant", "super_franchise"],
  },
  {
    key: "branchx_payout",
    label: "BranchX Payout",
    category: "Payout & Banking",
    description: "Enable or disable the BranchX payout flow for merchant and franchise users.",
    target_roles: ["admin", "franchise", "merchant", "super_franchise"],
  },
  {
    key: "cc_bill_pay",
    label: "CC Bill Pay",
    category: "Credit Card & Utility",
    description: "Enable or disable the InstantPay credit-card bill payment flow.",
    target_roles: ["admin", "franchise", "merchant", "super_franchise"],
  },
  {
    key: "ba_cc_bill_pay",
    label: "BA CC Bill Pay",
    category: "Credit Card & Utility",
    description: "Enable or disable the BillAvenue credit-card bill payment flow.",
    target_roles: ["admin", "franchise", "merchant", "super_franchise"],
  },
  {
    key: "cc_bill_3",
    label: "CC Bill 3",
    category: "Credit Card & Utility",
    description: "Enable or disable the CC Bill 3 bank-callback payment flow.",
    target_roles: ["admin", "franchise", "merchant", "super_franchise"],
  },
  {
    key: "mx_payout",
    label: "Payout MX",
    category: "Payout & Banking",
    description: "Enable or disable the Payout MX flow for merchant and franchise users.",
    target_roles: ["admin", "franchise", "merchant", "super_franchise"],
  },
  {
    key: "pos_inventory",
    label: "POS Machine Hardware",
    category: "POS & Hardware",
    description: "Enable or disable POS terminal machines and hardware stock management.",
    target_roles: ["admin", "franchise", "merchant"],
  },
  {
    key: "qr_inventory",
    label: "QR Standees & Soundboxes",
    category: "Digital QR",
    description: "Enable or disable physical QR code standees and 4G voice soundbox services.",
    target_roles: ["admin", "franchise", "merchant"],
  },
  {
    key: "pg_inventory",
    label: "PG MID Routing",
    category: "Payment Gateway",
    description: "Enable or disable Payment Gateway MIDs and aggregator routing services.",
    target_roles: ["admin", "merchant"],
  },
  {
    key: "user_daily_limit",
    label: "User Daily Limit",
    category: "Financial Controls",
    description: "Enable or disable daily payout limit enforcement for users.",
    target_roles: ["admin", "franchise", "merchant"],
  },
  {
    key: "pos_t0_settlement",
    label: "POS Settlement Evaluator",
    category: "Settlement & Limits",
    description: "Enable or disable global POS Settlement Evaluator. When ON, Money-In events dynamically evaluate daily limit rules.",
    target_roles: ["admin"],
  },
];

export const SERVICE_FLAG_CONFIG = INITIAL_SERVICE_CONFIG;

export const getRegisteredServices = () => {
  try {
    const savedCustom = localStorage.getItem("super_admin_custom_services");
    if (savedCustom) {
      const parsed = JSON.parse(savedCustom);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const customKeys = new Set(parsed.map((s) => s.key));
        const base = INITIAL_SERVICE_CONFIG.filter((s) => !customKeys.has(s.key));
        return [...base, ...parsed];
      }
    }
  } catch (e) {
    console.warn("Failed to load custom services", e);
  }
  return INITIAL_SERVICE_CONFIG;
};

export const getServiceStatusMap = () => {
  const registered = getRegisteredServices();
  const defaults = {};
  registered.forEach((item) => {
    defaults[item.key] = item.key === "ndia5_payout" || item.key === "mx_payout" ? false : true;
  });

  try {
    const savedStatuses = localStorage.getItem("super_admin_service_statuses");
    if (savedStatuses) {
      const parsed = JSON.parse(savedStatuses);
      return { ...defaults, ...parsed };
    }
  } catch (e) {
    console.warn("Failed to load service statuses", e);
  }
  return defaults;
};

export const saveServiceStatuses = (statuses) => {
  try {
    localStorage.setItem("super_admin_service_statuses", JSON.stringify(statuses));
    window.dispatchEvent(new Event("service_flags_updated"));
  } catch (e) {
    console.error("Failed to save service statuses", e);
  }
};

export const toggleGlobalServiceStatus = (serviceKey, isEnabled) => {
  const current = getServiceStatusMap();
  current[serviceKey] = Boolean(isEnabled);
  saveServiceStatuses(current);
};

export const saveCustomService = (serviceObj) => {
  try {
    const registered = getRegisteredServices();
    const existingIndex = registered.findIndex((s) => s.key === serviceObj.key);
    let updated;
    if (existingIndex >= 0) {
      updated = [...registered];
      updated[existingIndex] = { ...updated[existingIndex], ...serviceObj };
    } else {
      updated = [
        ...registered,
        {
          ...serviceObj,
          target_roles: serviceObj.target_roles || ["admin", "franchise", "merchant", "super_franchise"],
          created_at: new Date().toISOString(),
        },
      ];
    }
    localStorage.setItem("super_admin_custom_services", JSON.stringify(updated));

    const statuses = getServiceStatusMap();
    if (typeof serviceObj.enabled === "boolean") {
      statuses[serviceObj.key] = serviceObj.enabled;
      saveServiceStatuses(statuses);
    }
    window.dispatchEvent(new Event("service_flags_updated"));
    return updated;
  } catch (e) {
    console.error("Failed to save custom service", e);
    return getRegisteredServices();
  }
};

export const deleteCustomService = (serviceKey) => {
  try {
    const registered = getRegisteredServices();
    const filtered = registered.filter((s) => s.key !== serviceKey);
    localStorage.setItem("super_admin_custom_services", JSON.stringify(filtered));

    const statuses = getServiceStatusMap();
    delete statuses[serviceKey];
    saveServiceStatuses(statuses);
    window.dispatchEvent(new Event("service_flags_updated"));
  } catch (e) {
    console.error("Failed to delete service", e);
  }
};

export const isGlobalServiceEnabled = (serviceKey, fallback = true) => {
  const statuses = getServiceStatusMap();
  if (typeof statuses[serviceKey] === "boolean") {
    return statuses[serviceKey];
  }
  return fallback;
};

export const SERVICE_FLAG_DEFAULTS = INITIAL_SERVICE_CONFIG.reduce((acc, item) => {
  acc[item.key] = item.key === "mx_payout" || item.key === "ndia5_payout" ? false : true;
  return acc;
}, {});

export const getServiceFlagMeta = (serviceKey) => {
  const registered = getRegisteredServices();
  return registered.find((item) => item.key === serviceKey) || null;
};

export const getServiceFlagValue = (source, serviceKey, fallback = true) => {
  const globalEnabled = isGlobalServiceEnabled(serviceKey, fallback);
  if (!globalEnabled) {
    return false;
  }

  const rawValue = source?.[serviceKey];
  if (typeof rawValue === "boolean") {
    return rawValue;
  }
  if (rawValue && typeof rawValue === "object" && typeof rawValue.is_enabled === "boolean") {
    return rawValue.is_enabled;
  }

  const effectiveFallback = serviceKey === "ndia5_payout" || serviceKey === "mx_payout" ? false : fallback;
  return effectiveFallback;
};

export const normalizeServiceFlags = (source, fallback = true) => {
  const registered = getRegisteredServices();
  return registered.reduce((acc, item) => {
    acc[item.key] = getServiceFlagValue(source, item.key, fallback);
    return acc;
  }, {});
};

export const isServiceDisabledError = (error) => {
  const status = Number(error?.status ?? error?.response?.status ?? 0);
  const code = error?.code || error?.response?.data?.code || error?.responseData?.code || "";
  return status === 403 && String(code).trim().toUpperCase() === "SERVICE_DISABLED";
};

export const getServiceDisabledMessage = (
  error,
  fallback = "Service is currently disabled."
) => {
  if (!isServiceDisabledError(error)) {
    return error?.response?.data?.message || error?.responseData?.message || error?.message || fallback;
  }
  const serviceKey = error?.service_key || error?.response?.data?.service_key || error?.responseData?.service_key || "";
  const meta = getServiceFlagMeta(serviceKey);
  return meta ? `${meta.label} is currently disabled.` : fallback;
};
