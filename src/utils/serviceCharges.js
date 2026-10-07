import { getRegisteredServices } from "./serviceFlags";

const STORAGE_KEY = "super_admin_service_charges";

export const DEFAULT_SERVICE_CHARGES = [
  // Vimo Payout
  {
    id: "sc_vimo_1",
    service_key: "vimo_payout",
    service_name: "Vimo Payout",
    category: "Payout & Banking",
    min_amount: 1,
    max_amount: 1000,
    fee_type: "flat",
    flat_fee: 5.0,
    percent_fee: 0,
    gst_percent: 18,
    is_gst_inclusive: false,
    target_role: "all",
    payment_mode: "IMPS",
    is_active: true,
  },
  {
    id: "sc_vimo_2",
    service_key: "vimo_payout",
    service_name: "Vimo Payout",
    category: "Payout & Banking",
    min_amount: 1001,
    max_amount: 10000,
    fee_type: "flat",
    flat_fee: 8.0,
    percent_fee: 0,
    gst_percent: 18,
    is_gst_inclusive: false,
    target_role: "all",
    payment_mode: "IMPS",
    is_active: true,
  },
  {
    id: "sc_vimo_3",
    service_key: "vimo_payout",
    service_name: "Vimo Payout",
    category: "Payout & Banking",
    min_amount: 10001,
    max_amount: 200000,
    fee_type: "flat",
    flat_fee: 14.0,
    percent_fee: 0,
    gst_percent: 18,
    is_gst_inclusive: false,
    target_role: "all",
    payment_mode: "ALL",
    is_active: true,
  },

  // SevenPay Payout
  {
    id: "sc_sevenpay_1",
    service_key: "sevenpay_payout",
    service_name: "SevenPay Payout",
    category: "Payout & Banking",
    min_amount: 1,
    max_amount: 1000,
    fee_type: "flat",
    flat_fee: 5.5,
    percent_fee: 0,
    gst_percent: 18,
    is_gst_inclusive: false,
    target_role: "all",
    payment_mode: "IMPS",
    is_active: true,
  },
  {
    id: "sc_sevenpay_2",
    service_key: "sevenpay_payout",
    service_name: "SevenPay Payout",
    category: "Payout & Banking",
    min_amount: 1001,
    max_amount: 25000,
    fee_type: "flat",
    flat_fee: 9.0,
    percent_fee: 0,
    gst_percent: 18,
    is_gst_inclusive: false,
    target_role: "all",
    payment_mode: "IMPS",
    is_active: true,
  },

  // BranchX Payout
  {
    id: "sc_branchx_1",
    service_key: "branchx_payout",
    service_name: "BranchX Payout",
    category: "Payout & Banking",
    min_amount: 1,
    max_amount: 5000,
    fee_type: "flat",
    flat_fee: 6.0,
    percent_fee: 0,
    gst_percent: 18,
    is_gst_inclusive: false,
    target_role: "all",
    payment_mode: "ALL",
    is_active: true,
  },
  {
    id: "sc_branchx_2",
    service_key: "branchx_payout",
    service_name: "BranchX Payout",
    category: "Payout & Banking",
    min_amount: 5001,
    max_amount: 200000,
    fee_type: "flat",
    flat_fee: 12.0,
    percent_fee: 0,
    gst_percent: 18,
    is_gst_inclusive: false,
    target_role: "all",
    payment_mode: "ALL",
    is_active: true,
  },

  // PAYOUT-N
  {
    id: "sc_ndia5_1",
    service_key: "ndia5_payout",
    service_name: "PAYOUT-N",
    category: "Payout & Banking",
    min_amount: 1,
    max_amount: 200000,
    fee_type: "flat",
    flat_fee: 7.5,
    percent_fee: 0,
    gst_percent: 18,
    is_gst_inclusive: false,
    target_role: "all",
    payment_mode: "NEFT",
    is_active: true,
  },

  // CC Bill Pay
  {
    id: "sc_cc_1",
    service_key: "cc_bill_pay",
    service_name: "CC Bill Pay",
    category: "Credit Card & Utility",
    min_amount: 100,
    max_amount: 50000,
    fee_type: "percentage",
    flat_fee: 0,
    percent_fee: 0.85,
    gst_percent: 18,
    is_gst_inclusive: true,
    target_role: "all",
    payment_mode: "CARD",
    is_active: true,
  },
  {
    id: "sc_cc_2",
    service_key: "cc_bill_pay",
    service_name: "CC Bill Pay",
    category: "Credit Card & Utility",
    min_amount: 50001,
    max_amount: 200000,
    fee_type: "percentage",
    flat_fee: 0,
    percent_fee: 0.75,
    gst_percent: 18,
    is_gst_inclusive: true,
    target_role: "all",
    payment_mode: "CARD",
    is_active: true,
  },

  // BA CC Bill Pay
  {
    id: "sc_bacc_1",
    service_key: "ba_cc_bill_pay",
    service_name: "BA CC Bill Pay",
    category: "Credit Card & Utility",
    min_amount: 100,
    max_amount: 100000,
    fee_type: "percentage",
    flat_fee: 0,
    percent_fee: 0.9,
    gst_percent: 18,
    is_gst_inclusive: false,
    target_role: "all",
    payment_mode: "CARD",
    is_active: true,
  },

  // CC Bill 3
  {
    id: "sc_cc3_1",
    service_key: "cc_bill_3",
    service_name: "CC Bill 3",
    category: "Credit Card & Utility",
    min_amount: 100,
    max_amount: 100000,
    fee_type: "percentage",
    flat_fee: 0,
    percent_fee: 0.7,
    gst_percent: 18,
    is_gst_inclusive: true,
    target_role: "all",
    payment_mode: "CARD",
    is_active: true,
  },

  // POS Machine Hardware
  {
    id: "sc_pos_1",
    service_key: "pos_inventory",
    service_name: "POS Machine Hardware",
    category: "POS & Hardware",
    min_amount: 1,
    max_amount: 1000000,
    fee_type: "percentage",
    flat_fee: 0,
    percent_fee: 1.65,
    gst_percent: 18,
    is_gst_inclusive: false,
    target_role: "all",
    payment_mode: "CARD",
    is_active: true,
  },

  // Digital QR
  {
    id: "sc_qr_1",
    service_key: "qr_inventory",
    service_name: "QR Standees & Soundboxes",
    category: "Digital QR",
    min_amount: 1,
    max_amount: 100000,
    fee_type: "flat",
    flat_fee: 0,
    percent_fee: 0,
    gst_percent: 18,
    is_gst_inclusive: false,
    target_role: "all",
    payment_mode: "UPI",
    is_active: true,
  },

  // Payment Gateway
  {
    id: "sc_pg_1",
    service_key: "pg_inventory",
    service_name: "PG MID Routing",
    category: "Payment Gateway",
    min_amount: 1,
    max_amount: 1000000,
    fee_type: "percentage",
    flat_fee: 0,
    percent_fee: 1.85,
    gst_percent: 18,
    is_gst_inclusive: false,
    target_role: "all",
    payment_mode: "ALL",
    is_active: true,
  },

  // POS T+0 Settlement Evaluator
  {
    id: "sc_post0_1",
    service_key: "pos_t0_settlement",
    service_name: "POS Settlement Evaluator",
    category: "Settlement & Limits",
    min_amount: 1,
    max_amount: 500000,
    fee_type: "percentage",
    flat_fee: 0,
    percent_fee: 0.25,
    gst_percent: 18,
    is_gst_inclusive: false,
    target_role: "merchant",
    payment_mode: "T0",
    is_active: true,
  },
];

export const getAllServiceCharges = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn("Failed to read stored service charges", err);
  }
  return DEFAULT_SERVICE_CHARGES;
};

export const saveAllServiceCharges = (charges) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(charges));
    window.dispatchEvent(new Event("service_charges_updated"));
  } catch (err) {
    console.error("Failed to save service charges", err);
  }
};

export const getChargesForService = (serviceKey) => {
  const all = getAllServiceCharges();
  return all.filter((c) => c.service_key === serviceKey);
};

export const addServiceChargeRule = (ruleData) => {
  const all = getAllServiceCharges();
  const newRule = {
    ...ruleData,
    id: ruleData.id || `sc_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    is_active: ruleData.is_active !== undefined ? ruleData.is_active : true,
  };

  const updated = [newRule, ...all];
  saveAllServiceCharges(updated);
  return newRule;
};

export const updateServiceChargeRule = (id, ruleData) => {
  const all = getAllServiceCharges();
  const updated = all.map((rule) => {
    if (rule.id === id) {
      return {
        ...rule,
        ...ruleData,
        updated_at: new Date().toISOString(),
      };
    }
    return rule;
  });

  saveAllServiceCharges(updated);
  return updated.find((r) => r.id === id);
};

export const deleteServiceChargeRule = (id) => {
  const all = getAllServiceCharges();
  const filtered = all.filter((rule) => rule.id !== id);
  saveAllServiceCharges(filtered);
  return filtered;
};

export const toggleServiceChargeRuleStatus = (id, isActive) => {
  return updateServiceChargeRule(id, { is_active: isActive });
};

export const calculateServiceFee = (serviceKey, amount, role = "merchant") => {
  const numericAmount = Number(amount) || 0;
  const rules = getChargesForService(serviceKey).filter((r) => r.is_active);

  // Find matching slab
  const matchingRule = rules.find((r) => {
    const roleMatches = !r.target_role || r.target_role === "all" || r.target_role === role;
    const amountMatches = numericAmount >= Number(r.min_amount) && numericAmount <= Number(r.max_amount);
    return roleMatches && amountMatches;
  });

  if (!matchingRule) {
    return { fee: 0, gst: 0, total: 0, rule: null };
  }

  let fee = 0;
  if (matchingRule.fee_type === "flat") {
    fee = Number(matchingRule.flat_fee) || 0;
  } else if (matchingRule.fee_type === "percentage") {
    fee = (numericAmount * (Number(matchingRule.percent_fee) || 0)) / 100;
  } else if (matchingRule.fee_type === "both") {
    fee = (Number(matchingRule.flat_fee) || 0) + (numericAmount * (Number(matchingRule.percent_fee) || 0)) / 100;
  }

  const gstRate = Number(matchingRule.gst_percent) || 0;
  const gst = matchingRule.is_gst_inclusive ? 0 : (fee * gstRate) / 100;
  const total = fee + gst;

  return {
    fee: Number(fee.toFixed(2)),
    gst: Number(gst.toFixed(2)),
    total: Number(total.toFixed(2)),
    rule: matchingRule,
  };
};
