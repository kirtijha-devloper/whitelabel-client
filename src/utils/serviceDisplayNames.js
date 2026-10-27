import { normalizeUserRole, isSuperAdmin } from "./userAccess.js";
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

  if (!userOrRole) {
    // Default to checking window location prefix if no user/role provided
    if (typeof window !== "undefined") {
      const path = window.location?.pathname || "";
      if (path.startsWith("/super-admin")) return false;
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
  }

  // If user object passed, check super admin indicators
  if (typeof userOrRole === "object") {
    if (isSuperAdminUser(userOrRole) || isSuperAdmin(userOrRole)) {
      return false;
    }
  }

  const roleValue = typeof userOrRole === "string" ? userOrRole : userOrRole?.role;
  const normalized = normalizeUserRole(roleValue);

  if (normalized === "super_admin") {
    return false;
  }

  return ["admin", "franchise", "super_franchise", "merchant", "employee"].includes(normalized);
};

/**
 * Service display names for child roles
 */
export const CHILD_SERVICE_DISPLAY_NAMES = {
  // Payout Services (V, S, B)
  vimo_payout: "Payout V",
  vimo: "Payout V",
  sevenpay_payout: "Payout S",
  sevenpay: "Payout S",
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
  }

  return defaultName || providerKey;
};
