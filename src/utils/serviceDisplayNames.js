import { normalizeUserRole } from "./userAccess.js";
import { isSuperAdminUser } from "./accessControl.js";

/**
 * Checks if a user or role is one of the child roles:
 * Admin, Franchise, Super Franchise, Merchant (and employee under Admin).
 * Strictly returns false for Super Admin.
 */
export const isChildRole = (userOrRole) => {
  // If window path is explicitly super-admin, this is Super Admin context
  if (typeof window !== "undefined" && window.location?.pathname?.startsWith("/super-admin")) {
    return false;
  }

  
  // 1. If explicit user object or role string is provided, evaluate it directly
  if (userOrRole) {
    if (typeof userOrRole === "object") {
      if (isSuperAdminUser(userOrRole)) {
        return false;
      }
    }

    const roleValue = typeof userOrRole === "string" ? userOrRole : userOrRole?.role;
    const normalized = normalizeUserRole(roleValue);

    if (normalized === "super_admin") {
      return false;
    }

    if (["admin", "franchise", "super_franchise", "merchant", "employee"].includes(normalized)) {
      return true;
    }
  }

  // 2. Fallback: try resolving logged-in viewer from localStorage if in browser
  if (typeof window !== "undefined") {
    try {
      const stored = localStorage.getItem("user");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && typeof parsed === "object") {
          if (isSuperAdminUser(parsed)) {
            return false;
          }
          const norm = normalizeUserRole(parsed?.role);
          if (norm === "super_admin") {
            return false;
          }
          if (["admin", "franchise", "super_franchise", "merchant", "employee"].includes(norm)) {
            return true;
          }
        }
      }
    } catch {
      // ignore storage / parsing error
    }

    // 3. Fallback: check window location prefix
    const path = window.location?.pathname || "";
    if (path.startsWith("/super-admin")) {
      return false;
    }
    if (
      path.startsWith("/admin") ||
      path.startsWith("/franchise") ||
      path.startsWith("/super-franchise") ||
      path.startsWith("/merchant")
    ) {
      return true;
    }
  }

  return false;
};

/**
 * Service display names for child roles
 */
export const CHILD_SERVICE_DISPLAY_NAMES = {
  // Payout Services (V, S, B, N)
  vimo_payout: "Payout V",
  vimo: "Payout V",
  sevenpay_payout: "Payout S",
  sevenpay: "Payout S",
  ndia5_payout: "PAYOUT-N",
  ndia5: "PAYOUT-N",
  branchx_payout: "Payout B",
  branchx: "Payout B",

  // CC Bill Services (1, 2, 3)
  cc_bill_pay: "CC Bill 1",
  ba_cc_bill_pay: "CC Bill 2",
  cc_bill_3: "CC Bill 3",
  "cc-bill": "CC Bill 1",
  "ba-cc-bill": "CC Bill 2",
  "cc-bill-3": "CC Bill 3",
};

/**
 * Standard / original service inline labels for Super Admin
 */
export const SUPER_ADMIN_SERVICE_INLINE_LABELS = {
  vimo_payout: "Vimo",
  sevenpay_payout: "SevenPay",
  ndia5_payout: "PAYOUT-N",
  branchx_payout: "BranchX",
  cc_bill_pay: "CC Bill",
  ba_cc_bill_pay: "BA CC Bill",
  cc_bill_3: "CC Bill 3",
};

/**
 * Child role service inline labels (for UserList and similar views)
 */
export const CHILD_SERVICE_INLINE_LABELS = {
  vimo_payout: "Payout V",
  sevenpay_payout: "Payout S",
  ndia5_payout: "PAYOUT-N",
  branchx_payout: "Payout B",
  cc_bill_pay: "CC Bill 1",
  ba_cc_bill_pay: "CC Bill 2",
  cc_bill_3: "CC Bill 3",
};

/**
 * Returns the appropriate inline label map based on user role.
 */
export const getUserServiceInlineLabels = (userOrRole) => {
  if (isChildRole(userOrRole)) {
    return CHILD_SERVICE_INLINE_LABELS;
  }
  return SUPER_ADMIN_SERVICE_INLINE_LABELS;
};

/**
 * Resolves a role-based display name for a given service key.
 * If user is a child role, maps Payout & CC Bill to numbered names.
 * If user is Super Admin, returns defaultName / canonical name without alteration.
 */
export const getServiceDisplayName = (serviceKey, userOrRole, defaultName = "") => {
  if (!serviceKey) return defaultName;

  if (isChildRole(userOrRole)) {
    const mapped = CHILD_SERVICE_DISPLAY_NAMES[serviceKey];
    if (mapped) return mapped;
  } else {
    const superAdminMapped = SUPER_ADMIN_SERVICE_INLINE_LABELS[serviceKey];
    if (superAdminMapped && !defaultName) return superAdminMapped;
  }

  return defaultName || serviceKey;
};

/**
 * Resolves provider display name for payout reports, tables, and dropdowns.
 */
export const getPayoutProviderDisplayName = (providerKey, userOrRole, defaultName = "") => {
  if (!providerKey) return defaultName;
  const normalizedKey = String(providerKey).trim().toLowerCase();

  if (isChildRole(userOrRole)) {
    if (normalizedKey.includes("vimo")) return "Payout V";
    if (normalizedKey.includes("sevenpay")) return "Payout S";
    if (normalizedKey.includes("branchx")) return "Payout B";
    if (normalizedKey.includes("ndia5")) return "PAYOUT-N";
  } else {
    if (normalizedKey.includes("vimo")) return "Vimo";
    if (normalizedKey.includes("sevenpay")) return "SevenPay";
    if (normalizedKey.includes("branchx")) return "BranchX";
    if (normalizedKey.includes("ndia5")) return "PAYOUT-N";
  }

  return defaultName || providerKey;
};
