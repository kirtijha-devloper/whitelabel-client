import React, { useEffect, useState } from "react";
import Table from "../components/Table";
import Modal from "../components/Modal";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { AllUsers, searchUsers } from "../api/FranchiseApi";
import { getAssignedPosMachines } from "../api/posMachine";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Ban, ChevronDown, Eye, Loader2, LogIn, MoreVertical, SquarePen, Wallet } from "lucide-react";
import { toast } from "react-toastify";
import {
  impersonateUser,
  userDetail,
  updateUserStatus,
  updateUserIpayOutlet,
  updateUserProfile,
} from "../api/authApi";
import { seedSessionAuthInWindow } from "../utils/auth";
import { adminWalletCredit, adminWalletDebit } from "../api/WalletApi";
import { extractUsersArray, normalizeUserRole, maskEmail, maskEmailForUser } from "../utils/userAccess";
import {
  formatPermissionList,
  getAdminLandingPathForUser,
  hasAnyPermission,
  hasPermission,
  isAdminUser,
} from "../utils/accessControl";
import { fetchEmployeeAccessRoles } from "../api/employeeAccessRoleApi";
import { fetchServiceSettings, updateUserServiceSettings, updateBulkUserServiceSettings } from "../api/serviceSettingsApi";
import { useServiceSettingsPolling } from "../hooks/useServiceSettingsPolling";
import { updateAllUserSettlementType } from "../api/authApi";
import { SERVICE_FLAG_CONFIG, normalizeServiceFlags } from "../utils/serviceFlags";
import { recordLimitAuditLog, dispatchLimitChangeEvent } from "../utils/userLimit";
import { dispatchSettlementChangeEvent } from "../utils/userSettlement";

const escapeHtml = (value) =>
  String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const createIdempotencyKey = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  const seed = `${Date.now()}-${Math.random().toString(16).slice(2, 10)}-${Math.random()
    .toString(16)
    .slice(2, 10)}`;
  return `fallback-${seed}`;
};

const generateWalletCaptcha = (action) => {
  const prefix = String(action || "").trim().toUpperCase() === "CREDIT" ? "CREDIT" : "DEBIT";
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${prefix}-${suffix}`;
};

const parseWalletBalance = (payload) => {
  const candidates = [
    payload?.user?.wallet,
    payload?.user?.wallet_balance,
    payload?.wallet,
    payload?.wallet_balance,
    payload?.data?.wallet,
    payload?.data?.wallet_balance,
  ];

  for (const candidate of candidates) {
    const amount = Number(candidate);
    if (Number.isFinite(amount)) {
      return amount;
    }
  }

  return null;
};

const getWalletDebugRow = (user = {}) => {
  const walletKeys = Object.keys(user).filter((key) => {
    const normalizedKey = String(key).toLowerCase();
    return normalizedKey.includes("wallet") || normalizedKey === "balance";
  });

  const walletValue = Number(user?.wallet ?? user?.wallet_balance ?? 0);
  const availableValue = Number(user?.available_balance ?? user?.availableBalance ?? walletValue);
  const computedHold = Number.isFinite(walletValue) && Number.isFinite(availableValue)
    ? Math.max(0, walletValue - availableValue)
    : null;

  return {
    id: user?.id ?? null,
    name: user?.name ?? null,
    role: user?.role ?? null,
    wallet: user?.wallet ?? null,
    wallet_balance: user?.wallet_balance ?? null,
    available_balance: user?.available_balance ?? null,
    wallet_hold: computedHold,
    balance: user?.balance ?? null,
    wallet_keys: walletKeys.length > 0 ? walletKeys.join(", ") : "none",
  };
};

const logUserListPayload = ({ scope, response, users, currentUser }) => {
  console.groupCollapsed(`[user-list][${scope}] backend payload`);
  console.log("viewer", {
    id: currentUser?.id ?? null,
    role: currentUser?.role ?? null,
    totalUsers: Array.isArray(users) ? users.length : 0,
  });
  console.log("rawResponse", response);
  console.log("normalizedUsers", users);

  if (Array.isArray(users) && users.length > 0) {
    console.table(users.map((user) => getWalletDebugRow(user)));
  }

  console.groupEnd();
};

const formatWalletValue = (value) => {
  const amount = Number(value);
  if (Number.isFinite(amount)) {
    return `₹${amount.toFixed(2)}`;
  }

  return value || "₹0.00";
};

const getFranchiseDisplayNameForExport = (user = {}) =>
  user?.franchise_details?.name ||
  user?.franchise_details?.abheepay_id ||
  user?.franchise_name ||
  user?.franchise?.name ||
  user?.franchaise?.name ||
  "-";

const getWalletStatusLabel = (user = {}) => {
  const explicitValue =
    user?.wallet_status ??
    user?.walletStatus ??
    user?.is_wallet_active ??
    user?.isWalletActive ??
    user?.wallet_enabled ??
    user?.walletEnabled ??
    user?.wallet?.status;

  if (typeof explicitValue === "boolean") {
    return explicitValue ? "Active" : "Inactive";
  }

  if (
    explicitValue === 1 ||
    explicitValue === "1" ||
    String(explicitValue || "").trim().toLowerCase() === "active"
  ) {
    return "Active";
  }

  if (
    explicitValue === 0 ||
    explicitValue === "0" ||
    String(explicitValue || "").trim().toLowerCase() === "inactive"
  ) {
    return "Inactive";
  }

  const hasWalletField =
    user?.wallet !== undefined ||
    user?.wallet_balance !== undefined ||
    user?.available_balance !== undefined ||
    user?.availableBalance !== undefined;

  return hasWalletField ? "Active" : "-";
};

const normalizeSettlementType = (value) => {
  const normalizedValue = String(value || "").trim().toLowerCase();
  return normalizedValue === "next_day_settlement" || normalizedValue === "t1"
    ? "next_day_settlement"
    : "today_settlement";
};

const getSettlementApiValue = (value) =>
  normalizeSettlementType(value) === "next_day_settlement"
    ? "next_day_settlement"
    : "today_settlement";

const isSettlementShortcutRole = (user = {}) => {
  const normalizedRole = normalizeUserRole(user?.role);
  return normalizedRole !== "admin" && normalizedRole !== "employee";
};

const roleBadgeStyles = {
  super_franchise: "bg-purple-100 text-purple-800",
  admin: "bg-indigo-100 text-indigo-800",
  franchise: "bg-emerald-100 text-emerald-800",
  merchant: "bg-blue-100 text-blue-800",
  employee: "bg-violet-100 text-violet-800",
  user: "bg-gray-100 text-gray-800",
  default: "bg-gray-100 text-gray-800",
};

const getRoleBadge = (role) => {
  const normalized = normalizeUserRole(role);
  let label = "-";
  if (normalized === "super_franchise") {
    label = "Super Franchise";
  } else if (normalized) {
    label = `${normalized.charAt(0).toUpperCase()}${normalized.slice(1)}`;
  }
  const style = roleBadgeStyles[normalized] || roleBadgeStyles.default;
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${style}`}>
      {label}
    </span>
  );
};

const getRoleSupplementaryText = (user = {}) => {
  const normalizedRole = normalizeUserRole(user?.role);

  if (normalizedRole === "super_franchise") {
    const franchiseCount = Number(user?.franchise_count);
    return `Franchise Count: ${Number.isFinite(franchiseCount) ? franchiseCount : 0}`;
  }

  if (normalizedRole === "franchise") {
    const merchantCount = Number(user?.merchant_count);
    const superFranchiseName =
      user?.super_franchise_details?.name ||
      user?.super_franchise_details?.abheepay_id ||
      null;
    return `Merchant Count: ${Number.isFinite(merchantCount) ? merchantCount : 0}${superFranchiseName ? ` | SF: ${superFranchiseName}` : ""}`;
  }

  if (normalizedRole === "merchant") {
    const franchiseName =
      user?.franchise_details?.name ||
      user?.franchise_details?.abheepay_id ||
      "-";
    return `Franchise: ${franchiseName}`;
  }

  return null;
};

const getAssignedPosMachineDate = (pos = {}) =>
  pos?.assigned_at ??
  pos?.assignedAt ??
  pos?.assign_date ??
  pos?.assignDate ??
  pos?.allotted_at ??
  pos?.allottedAt ??
  pos?.updated_at ??
  pos?.updatedAt ??
  pos?.created_at ??
  pos?.createdAt ??
  "";

const formatAssignedPosMachineDate = (value) => {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleString("en-IN");
};

const renderRoleWithDetails = (user = {}) => {
  const supplementaryText = getRoleSupplementaryText(user);

  return (
    <div className="space-y-1">
      {getRoleBadge(user?.role)}
      {supplementaryText && (
        <div className="text-xs text-gray-500">{supplementaryText}</div>
      )}
    </div>
  );
};

const getLegacyPayoutValue = (user = {}) => {
  const rawValue =
    user?.is_payout_enabled ?? user?.isPayoutEnabled ?? user?.payoutEnabled ?? null;

  if (typeof rawValue === "boolean") {
    return rawValue;
  }

  if (rawValue === 0 || rawValue === 1 || rawValue === "0" || rawValue === "1") {
    return Boolean(Number(rawValue));
  }

  return null;
};

const getUserServiceSettings = (user = {}) => {
  const normalized = normalizeServiceFlags(user?.user_service_settings, true);
  const legacyPayoutValue = getLegacyPayoutValue(user);

  if (
    legacyPayoutValue !== null &&
    (user?.user_service_settings === null || user?.user_service_settings === undefined)
  ) {
    normalized.vimo_payout = legacyPayoutValue;
    normalized.sevenpay_payout = legacyPayoutValue;
    normalized.branchx_payout = legacyPayoutValue;
  }

  return normalized;
};

const getEffectiveServiceFlags = (user = {}) => {
  const normalized = normalizeServiceFlags(user?.service_flags, true);
  const legacyPayoutValue = getLegacyPayoutValue(user);

  if (
    legacyPayoutValue !== null &&
    (user?.service_flags === null || user?.service_flags === undefined)
  ) {
    normalized.vimo_payout = legacyPayoutValue;
    normalized.sevenpay_payout = legacyPayoutValue;
    normalized.branchx_payout = legacyPayoutValue;
  }

  return normalized;
};

const isServiceToggleRole = (user = {}) => {
  const normalizedRole = normalizeUserRole(user?.role);
  return normalizedRole === "merchant" || normalizedRole === "franchise" || normalizedRole === "super_franchise";
};

const USER_SERVICE_INLINE_LABELS = {
  vimo_payout: "Vimo",
  sevenpay_payout: "SevenPay",
  ndia5_payout: "PAYOUT-N",
  branchx_payout: "BranchX",
  cc_bill_pay: "CC Bill",
  ba_cc_bill_pay: "BA CC Bill",
  cc_bill_3: "CC Bill 3",
  mx_payout: "Payout MX",
};

const MASTER_SERVICE_CONTROLS = [
  { key: "vimo_payout", label: "Vimo" },
  { key: "sevenpay_payout", label: "SevenPay" },
  { key: "ndia5_payout", label: "PAYOUT-N" },
  { key: "branchx_payout", label: "BranchX" },
  { key: "cc_bill_pay", label: "CC Bill" },
  { key: "ba_cc_bill_pay", label: "BA CC Bill" },
  { key: "cc_bill_3", label: "CC Bill 3" },
  { key: "mx_payout", label: "Payout MX" },
  { key: "user_daily_limit", label: "User Daily Limit" },
  { key: "pos_t0_settlement", label: "POS T0/T1 Settlement & Limit" },
];

const getServiceStatusSummary = (user = {}) => {
  const serviceFlags = getUserServiceSettings(user);

  return Object.entries(USER_SERVICE_INLINE_LABELS)
    .map(([key, label]) => `${label}: ${serviceFlags[key] ? "Active" : "Inactive"}`)
    .join(", ");
};

const AdminList = ({
  currentUser,
  title = "All Users",
  lockedRole = "",
  listMode = "all",
}) => {
  const [searchInputValue, setSearchInputValue] = useState("");
  const [committedSearch, setCommittedSearch] = useState("");
  const [impersonatingUser, setImpersonatingUser] = useState(null);
  const [walletSubmitting, setWalletSubmitting] = useState(false);
  const [isExportingUsers, setIsExportingUsers] = useState(false);
  const [serviceSettingUpdatingKey, setServiceSettingUpdatingKey] = useState("");
  const [bulkServiceUpdatingKey, setBulkServiceUpdatingKey] = useState("");
  const [walletModalState, setWalletModalState] = useState({
    open: false,
    user: null,
    role: "",
    action: "credit",
  });
  const [walletForm, setWalletForm] = useState({
    amount: "",
    reason: "",
    idempotencyKey: createIdempotencyKey(),
  });
  const [walletConfirmState, setWalletConfirmState] = useState({
    open: false,
    acknowledged: false,
    captchaText: "",
    captchaInput: "",
  });
  const [ipayOutletModalState, setIpayOutletModalState] = useState({
    open: false,
    user: null,
    outletId: "",
  });
  const [isIpayOutletSubmitting, setIsIpayOutletSubmitting] = useState(false);
  const [walletBalanceState, setWalletBalanceState] = useState({
    loading: false,
    balance: null,
    error: null,
  });
  const [settlementUpdatingUserId, setSettlementUpdatingUserId] = useState(null);
  const [isBulkSettlementUpdating, setIsBulkSettlementUpdating] = useState(false);
  const [bulkSettlementType, setBulkSettlementType] = useState("today_settlement");
  const [isBulkSettlementConfirmOpen, setIsBulkSettlementConfirmOpen] = useState(false);

  const { data: masterServiceSettingsData, refetch: refetchMasterServiceSettings } = useQuery({
    queryKey: ["masterServiceSettings"],
    queryFn: fetchServiceSettings,
    staleTime: 30000,
  });
  useServiceSettingsPolling();
  const [roleUpdatingUserId, setRoleUpdatingUserId] = useState(null);
  const [roleConfirmState, setRoleConfirmState] = useState({
    open: false,
    user: null,
    nextRoleId: "",
    currentRoleName: "",
    nextRoleName: "",
  });

  const [posModalState, setPosModalState] = useState({
    open: false,
    user: null,
    page: 1,
    limit: 50,
    status: "",
  });
  const [mobileActionSheet, setMobileActionSheet] = useState({
    open: false,
    user: null,
  });

  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const normalizedCurrentUserRole = normalizeUserRole(currentUser?.role);
  const isAdmin = isAdminUser(currentUser);
  const isSuperAdminViewer = normalizedCurrentUserRole === "super_admin";
  const isEmployeeDirectory = listMode === "employees";
  const canListUsers = isSuperAdminViewer || hasPermission(currentUser, "users.list");
  const canSearchUsers = isSuperAdminViewer || hasPermission(currentUser, "users.search");
  const canReadUsers = isSuperAdminViewer || hasPermission(currentUser, "users.read");
  const canUpdateUsers = isSuperAdminViewer || hasPermission(currentUser, "users.update");
  const isSuperFranchiseViewer = normalizedCurrentUserRole === "super_franchise";
  const canUseImpersonateLogin = isAdmin || isSuperFranchiseViewer || hasPermission(currentUser, "users.impersonate");
  const canUpdateUserStatus =
    isSuperAdminViewer || hasPermission(currentUser, "users.status.update");
  const canViewWalletAmount =
    isSuperAdminViewer || isAdmin || hasPermission(currentUser, "wallet.read");
  const canCreditWallet = isAdmin || hasPermission(currentUser, "wallet.credit");
  const canDebitWallet = isAdmin || hasPermission(currentUser, "wallet.debit");
  const canAdjustWallet = !isEmployeeDirectory && (canCreditWallet || canDebitWallet);
  const hasWalletPermission =
    isAdmin ||
    isSuperAdminViewer ||
    hasAnyPermission(currentUser, ["wallet.read", "wallet.credit", "wallet.debit"]);
  const canManageSettlementShortcut =
    !isEmployeeDirectory &&
    hasWalletPermission &&
    (isAdmin ||
      (hasPermission(currentUser, "users.update") &&
        hasPermission(currentUser, "users.settlement.update")));
  const canBulkUpdateSettlementType = isAdmin;
  const canViewAssignedPosMachines = !isEmployeeDirectory && canReadUsers;
  const canManageUserServiceSettings =
    !isEmployeeDirectory &&
    (isAdmin || hasPermission(currentUser, "users.service_settings.manage"));
  const canViewWalletColumn =
    !isEmployeeDirectory &&
    (normalizedCurrentUserRole === "admin" ||
      normalizedCurrentUserRole === "franchise" ||
      hasAnyPermission(currentUser, ["wallet.read", "wallet.credit", "wallet.debit"]) ||
      canManageSettlementShortcut);

  const {
    data: employeeAccessRoles = [],
    isLoading: employeeAccessRolesLoading,
  } = useQuery({
    queryKey: ["employee-access-roles"],
    queryFn: fetchEmployeeAccessRoles,
    enabled: isEmployeeDirectory && isAdmin,
    select: (response) => {
      const payload = response?.data || response?.rows || response || [];
      return Array.isArray(payload) ? payload : [];
    },
  });

  // Query for all users (default list)
  const [allUsersParams, setAllUsersParams] = useState({
    page: 1,
    limit: 10,
    status: "",
    role: lockedRole,
  });

  // Separate page state for search results
  const [searchPage, setSearchPage] = useState(1);
  const searchPageSize = 10;
  const isSearchMode = Boolean(committedSearch);

  const {
    data: allUsersResponse,
    isLoading: allUsersLoading,
    error: allUsersError,
    refetch: refetchAllUsers,
  } = useQuery({
    queryKey: ["allUsers", allUsersParams],
    queryFn: () => AllUsers(allUsersParams),
    enabled: !isSearchMode,
  });

  const {
    data: searchResponse,
    isLoading: searchLoading,
    error: searchError,
  } = useQuery({
    queryKey: ["userSearch", committedSearch, allUsersParams.status, allUsersParams.role, searchPage, searchPageSize],
    queryFn: () =>
      searchUsers({
        q: committedSearch,
        status: allUsersParams.status,
        role: allUsersParams.role,
        limit: searchPageSize,
        offset: (searchPage - 1) * searchPageSize,
      }),
    enabled: isSearchMode,
    staleTime: 30 * 1000,
  });

  const allUsers = allUsersResponse ? extractUsersArray(allUsersResponse) : [];
  const searchUsers_ = searchResponse ? (Array.isArray(searchResponse?.data) ? searchResponse.data : extractUsersArray(searchResponse)) : [];

  useEffect(() => {
    if (typeof allUsersResponse === "undefined") {
      return;
    }

    logUserListPayload({
      scope: "all-users",
      response: allUsersResponse,
      users: extractUsersArray(allUsersResponse),
      currentUser: {
        id: currentUser?.id,
        role: currentUser?.role,
      },
    });
  }, [currentUser?.id, currentUser?.role, allUsersResponse]);

  useEffect(() => {
    if (!lockedRole) return;
    setAllUsersParams((prev) =>
      prev.role === lockedRole ? prev : { ...prev, role: lockedRole, page: 1 }
    );
  }, [lockedRole]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    const term = searchInputValue.trim();
    setSearchPage(1);
    setCommittedSearch(term);
    setSearchInputValue("");
  };

  const handleSearchClear = () => {
    setSearchInputValue("");
    setCommittedSearch("");
    setSearchPage(1);
  };

  const handleBulkSettlementTypeChange = (value) => {
    setBulkSettlementType(value);
  };

  const handleBulkSettlementUpdate = () => {
    if (!canBulkUpdateSettlementType) {
      toast.error("Only admin can update settlement type for all merchant and franchise users.");
      return;
    }

    setIsBulkSettlementConfirmOpen(true);
  };

  const closeBulkSettlementModal = () => {
    setIsBulkSettlementConfirmOpen(false);
  };

  const confirmBulkSettlementUpdate = async () => {
    if (!canBulkUpdateSettlementType) {
      toast.error("Only admin can update settlement type for all merchant and franchise users.");
      closeBulkSettlementModal();
      return;
    }

    const normalizedValue = getSettlementApiValue(bulkSettlementType);
    const label = normalizedValue === "next_day_settlement" ? "Next Day Settlement" : "Today Settlement";

    try {
      setIsBulkSettlementUpdating(true);
      const response = await updateAllUserSettlementType(normalizedValue);
      toast.success(response?.message || `Settlement type updated to ${label} for all merchant/franchise users.`);
      closeBulkSettlementModal();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["allUsers"] }),
        queryClient.invalidateQueries({ queryKey: ["userSearch"] }),
      ]);
    } catch (error) {
      toast.error(error?.message || "Failed to update settlement type for all users.");
    } finally {
      setIsBulkSettlementUpdating(false);
    }
  };

  const handleMasterBulkToggle = async (serviceKey, targetState) => {
    if (!isAdmin) {
      toast.error("Only admin can perform bulk service updates across all users.");
      return;
    }

    const serviceItem = MASTER_SERVICE_CONTROLS.find((s) => s.key === serviceKey);
    const serviceLabel = serviceItem ? serviceItem.label : serviceKey;
    const actionText = targetState ? "ENABLE" : "DISABLE";

    if (!window.confirm(`Are you sure you want to ${actionText} ${serviceLabel} for ALL merchant and franchise users in the system?`)) {
      return;
    }

    try {
      setBulkServiceUpdatingKey(serviceKey);
      const response = await updateBulkUserServiceSettings(serviceKey, targetState);
      toast.success(response?.message || `Successfully ${targetState ? 'enabled' : 'disabled'} ${serviceLabel} for all users!`);
      await Promise.all([
        refetchMasterServiceSettings(),
        queryClient.invalidateQueries({ queryKey: ["allUsers"] }),
        queryClient.invalidateQueries({ queryKey: ["userSearch"] }),
      ]);
    } catch (error) {
      toast.error(error?.message || `Failed to bulk update ${serviceLabel} for all users.`);
    } finally {
      setBulkServiceUpdatingKey("");
    }
  };

  const {
    data: assignedPosResponse,
    isLoading: assignedPosLoading,
    error: assignedPosError,
  } = useQuery({
    queryKey: [
      "assignedPosMachines",
      posModalState.user?.id,
      posModalState.page,
      posModalState.limit,
      posModalState.status,
    ],
    queryFn: () =>
      getAssignedPosMachines({
        userId: posModalState.user?.id,
        status: posModalState.status || null,
        page: posModalState.page,
        limit: posModalState.limit,
      }),
    enabled: Boolean(posModalState.open && posModalState.user?.id),
    keepPreviousData: true,
  });

  const redirectUrl = normalizedCurrentUserRole === 'franchise' ? '/franchise/user' : normalizedCurrentUserRole === 'super_franchise' ? '/super-franchise/user' : '/admin/user';
  const activeRole = null;

  const handleSettlementShortcutUpdate = async (row, nextSettlementType) => {
    const userId = Number(row?.id);

    if (!Number.isFinite(userId)) {
      toast.error("Invalid user selected.");
      return;
    }

    if (!canManageSettlementShortcut) {
      toast.error("You do not have permission to update settlement type.");
      return;
    }

    if (!isSettlementShortcutRole(row)) {
      toast.error("Settlement shortcut is only available for merchant and franchise users.");
      return;
    }

    const normalizedNextValue = normalizeSettlementType(nextSettlementType);
    const currentSettlementType = normalizeSettlementType(
      row?.settlement_type ?? row?.settlementType
    );

    if (currentSettlementType === normalizedNextValue) {
      return;
    }

    try {
      const updatePayload = {
        settlement_type: getSettlementApiValue(normalizedNextValue),
      };

      console.log("[user-list][settlement-shortcut] update payload", {
        userId,
        userName: row?.name || null,
        currentSettlementType,
        nextSettlementType: normalizedNextValue,
        payload: updatePayload,
      });

      setSettlementUpdatingUserId(String(userId));
      await updateUserProfile({
        id: userId,
        data: updatePayload,
      });
      toast.success(
        `${row?.name || "User"} settlement updated to ${normalizedNextValue === "next_day_settlement" ? "T+1" : "T"
        }.`
      );
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["allUsers"] }),
        queryClient.invalidateQueries({ queryKey: ["allUsersListForPosSetting"] }),
        queryClient.invalidateQueries({ queryKey: ["posSettings"] }),
        queryClient.invalidateQueries({ queryKey: ["userSearch"] }),
        queryClient.invalidateQueries({ queryKey: ["user", String(userId)] }),
        queryClient.invalidateQueries({ queryKey: ["user", userId] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      ]);
      dispatchSettlementChangeEvent({ type: "user_settlement_update", userId, settlementType: normalizedNextValue });
      dispatchLimitChangeEvent({ type: "settlement_toggle", userId });
    } catch (error) {
      toast.error(error?.message || "Failed to update settlement type.");
    } finally {
      setSettlementUpdatingUserId((currentId) =>
        currentId === String(userId) ? null : currentId
      );
    }
  };

  const renderSettlementShortcut = (row) => {
    if (!canManageSettlementShortcut || !isSettlementShortcutRole(row)) {
      return null;
    }

    const currentSettlementType = normalizeSettlementType(
      row?.settlement_type ?? row?.settlementType
    );
    const isUpdating = settlementUpdatingUserId === String(row?.id);

    return (
      <div className="flex items-center gap-2 text-[11px] text-gray-600">
        <span className="font-semibold uppercase tracking-[0.16em] text-gray-500">
          Settlement
        </span>
        <span
          className={`font-semibold ${currentSettlementType === "today_settlement" ? "text-primary" : "text-gray-400"
            }`}
        >
          T
        </span>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            handleSettlementShortcutUpdate(
              row,
              currentSettlementType === "today_settlement"
                ? "next_day_settlement"
                : "today_settlement"
            );
          }}
          disabled={isUpdating}
          className={`relative inline-flex h-5 w-10 items-center rounded-full transition ${currentSettlementType === "next_day_settlement"
            ? "bg-primary"
            : "bg-primary/50"
            } ${isUpdating ? "cursor-not-allowed opacity-60" : ""}`}
          aria-label="Toggle settlement type"
          aria-pressed={currentSettlementType === "next_day_settlement"}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${currentSettlementType === "next_day_settlement"
              ? "translate-x-5"
              : "translate-x-0.5"
              }`}
          />
        </button>
        <span
          className={`font-semibold ${currentSettlementType === "next_day_settlement"
            ? "text-primary"
            : "text-gray-400"
            }`}
        >
          T+1
        </span>
        {isUpdating && <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />}
      </div>
    );
  };

  const renderWalletCell = (wallet, row) => {
    const formattedWallet = formatWalletValue(wallet);
    const settlementShortcut = renderSettlementShortcut(row);

    if (!canAdjustWallet && !settlementShortcut) {
      return canViewWalletAmount ? formattedWallet : "-";
    }

    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span>{canViewWalletAmount ? formattedWallet : "Hidden"}</span>
          {canAdjustWallet && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                openWalletModal(row, activeRole);
              }}
              className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700 hover:bg-amber-100"
            >
              <Wallet className="h-3.5 w-3.5" />
              Wallet
            </button>
          )}
        </div>
        {settlementShortcut}
      </div>
    );
  };

  const renderPosCountCell = (count, row) => {
    const numeric = Number(count) || 0;
    if (!canViewAssignedPosMachines || numeric <= 0) return numeric;

    return (
      <button
        type="button"
        className="text-primary underline font-medium"
        onClick={(event) => {
          event?.stopPropagation?.();
          openPosModal(row);
        }}
      >
        {numeric}
      </button>
    );
  };

  const getServiceToggleState = (row, serviceKey) => {
    const userServiceSettings = getUserServiceSettings(row);
    const effectiveServiceFlags = getEffectiveServiceFlags(row);

    return {
      rawEnabled: Boolean(userServiceSettings?.[serviceKey]),
      effectiveEnabled: Boolean(effectiveServiceFlags?.[serviceKey]),
    };
  };

  const getServiceSettingUpdateKey = (userId, serviceKey) => `${userId}:${serviceKey}`;

  const renderServiceSettingsInline = (row, className = "") => {
    if (!isServiceToggleRole(row)) {
      return "-";
    }

    return (
      <div
        className={`inline-grid grid-cols-2 items-start gap-x-5 gap-y-1.5 whitespace-normal ${className}`.trim()}
      >
        {SERVICE_FLAG_CONFIG.filter((service) => service.key !== "user_daily_limit" && service.key !== "pos_t0_settlement").map((service) => {
          const { rawEnabled, effectiveEnabled } = getServiceToggleState(row, service.key);
          const isUpdating =
            serviceSettingUpdatingKey === getServiceSettingUpdateKey(row?.id, service.key);
          const showGlobalHint = rawEnabled && !effectiveEnabled;

          return (
            <div key={service.key}>
              <label
                title={showGlobalHint ? "Globally blocked" : undefined}
                className="inline-flex items-center gap-3 whitespace-nowrap rounded px-0.5 py-0.5 text-[13px] text-gray-700"
              >
                <span className="font-medium leading-none text-gray-800">
                  {USER_SERVICE_INLINE_LABELS[service.key] || service.label}
                </span>
                <input
                  type="checkbox"
                  checked={rawEnabled}
                  disabled={!canManageUserServiceSettings || isUpdating}
                  onChange={(event) => {
                    event.stopPropagation();
                    handleToggleUserService(row, service.key, event.target.checked);
                  }}
                  className="h-3.5 w-3.5 shrink-0 rounded border-gray-300 text-primary focus:ring-1 focus:ring-primary/30 disabled:cursor-not-allowed"
                />
              </label>
            </div>
          );
        })}
      </div>
    );
  };

  const columns = isEmployeeDirectory
    ? [
      { header: "SL", key: "sl" },
      {
        header: "Employee",
        key: "name",
        render: (name, row) => (
          <div className="space-y-0.5">
            <div className="font-medium text-gray-900">{name || "-"}</div>
            <div className="text-xs text-gray-600">{row.mobile_number || "-"}</div>
            <div className="text-xs text-gray-500">{row.abheepay_id || "-"}</div>
          </div>
        ),
      },
      {
        header: "Email",
        key: "email",
        render: (email) => (
          <span className="text-sm text-gray-700">{maskEmailForUser(email, currentUser)}</span>
        ),
      },
      {
        header: "Access Role",
        key: "employee_access_role_id",
        render: (_value, row) => {
          if (!isAdmin) {
            return (
              <span className="text-sm text-gray-700">
                {row?.employee_access_role?.name || row?.employeeAccessRole?.name || "-"}
              </span>
            );
          }

          const currentRoleId = getEmployeeAccessRoleId(row);

          return (
            <div className="flex items-center gap-2">
              <select
                value={currentRoleId}
                onChange={(event) => handleEmployeeRoleChange(row, event.target.value)}
                className="border border-gray-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                disabled={employeeAccessRolesLoading || roleUpdatingUserId === row?.id}
              >
                <option value="">Select role</option>
                {employeeAccessRoles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
              </select>
              {roleUpdatingUserId === row?.id && (
                <Loader2 className="h-4 w-4 animate-spin text-gray-500" />
              )}
            </div>
          );
        },
      },
      {
        header: "Permissions",
        key: "permissions",
        render: (permissions) => (
          <span className="text-sm text-gray-700">{formatPermissionList(permissions)}</span>
        ),
      },
      {
        header: "Status",
        key: "status",
        render: (status) => (
          <span
            className={`px-2 py-1 rounded-full text-xs font-semibold ${status === "active" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
              }`}
          >
            {status}
          </span>
        ),
      },
    ]
    : [
      { header: "SL", key: "sl" },
      {
        header: "User",
        key: "name",
        render: (name, row) => (
          <div className="space-y-0.5">
            <div className="font-medium text-gray-900">{name || "-"}</div>
            <div className="text-xs text-gray-600">{row.mobile_number || "-"}</div>
            <div className="text-xs text-gray-500">{row.abheepay_id || "-"}</div>
          </div>
        ),
      },
      {
        header: "Role",
        key: "role",
        render: (_role, row) => renderRoleWithDetails(row),
      },
      ...(canViewWalletColumn
        ? [
          {
            header: "Wallet",
            key: "wallet",
            render: (wallet, row) => renderWalletCell(wallet, row),
          },
        ]
        : []),
      {
        header: "Status",
        key: "status",
        render: (status) => (
          <span
            className={`px-2 py-1 rounded-full text-xs font-semibold ${status === "active" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
              }`}
          >
            {status}
          </span>
        ),
      },
      {
        header: "Services",
        key: "user_service_settings",
        render: (_value, row) => renderServiceSettingsInline(row, "min-w-[190px]"),
      },
    ];

  const handleEditUser = (row) => {
    navigate(`${redirectUrl}/${row.id}/edit`);
  };

  const handleToggleUserStatus = async (row, nextStatus) => {
    try {
      await updateUserStatus({
        id: row?.id,
        status: nextStatus,
      });
      toast.success(`${row?.name || "User"} ${nextStatus === "active" ? "enabled" : "disabled"} successfully.`);
      if (typeof refetchAllUsers === "function") {
        await refetchAllUsers();
      }
    } catch (error) {
      toast.error(error?.message || "Failed to update user status.");
    }
  };

  const getEmployeeAccessRoleId = (user) => {
    const direct = user?.employee_access_role_id ?? user?.employeeAccessRoleId ?? null;
    if (direct !== null && direct !== undefined && `${direct}` !== "") {
      return String(direct);
    }
    const nested = user?.employee_access_role?.id ?? user?.employeeAccessRole?.id ?? null;
    return nested ? String(nested) : "";
  };

  const handleEmployeeRoleChange = async (user, nextRoleId) => {
    if (!user?.id) return;

    const currentRoleId = getEmployeeAccessRoleId(user);
    if (String(currentRoleId || "") === String(nextRoleId || "")) {
      return;
    }

    const currentRoleName =
      user?.employee_access_role?.name ||
      user?.employeeAccessRole?.name ||
      "No role";
    const nextRoleName =
      employeeAccessRoles.find((role) => String(role.id) === String(nextRoleId))?.name ||
      "No role";

    setRoleConfirmState({
      open: true,
      user,
      nextRoleId: String(nextRoleId || ""),
      currentRoleName,
      nextRoleName,
    });
  };

  const closeRoleConfirmModal = () => {
    setRoleConfirmState({
      open: false,
      user: null,
      nextRoleId: "",
      currentRoleName: "",
      nextRoleName: "",
    });
  };

  const confirmEmployeeRoleChange = async () => {
    const user = roleConfirmState.user;
    if (!user?.id) {
      closeRoleConfirmModal();
      return;
    }

    setRoleUpdatingUserId(user.id);
    try {
      await updateUserProfile({
        id: user.id,
        data: {
          role: "employee",
          employee_access_role_id: roleConfirmState.nextRoleId || "",
        },
      });
      toast.success("Employee access role updated.");
      closeRoleConfirmModal();
      if (typeof refetchAllUsers === "function") {
        await refetchAllUsers();
      }
      queryClient.invalidateQueries(["userSearch"]);
    } catch (error) {
      toast.error(error?.message || "Failed to update access role.");
    } finally {
      setRoleUpdatingUserId(null);
    }
  };

  const handleToggleUserService = async (row, serviceKey, enabled) => {
    const userId = row?.id;
    if (!userId) {
      toast.error("Invalid user for updating service settings.");
      return;
    }

    if (!canManageUserServiceSettings) {
      toast.error("Only admins can update user service settings.");
      return;
    }

    if (!isServiceToggleRole(row)) {
      toast.error("Service controls are only available for merchant and franchise users.");
      return;
    }

    const service = SERVICE_FLAG_CONFIG.find((item) => item.key === serviceKey);
    const updateKey = getServiceSettingUpdateKey(userId, serviceKey);
    setServiceSettingUpdatingKey(updateKey);
    try {
      await updateUserServiceSettings(userId, {
        [serviceKey]: enabled,
      });

      // Record System Activity Log for this action
      try {
        recordLimitAuditLog({
          performingUser: currentUser,
          affectedUser: row,
          previousState: enabled ? "Disabled" : "Enabled",
          newState: enabled ? "Enabled" : "Disabled",
          action: enabled ? "SERVICE_ENABLED" : "SERVICE_DISABLED",
          serviceKey: serviceKey,
        });
      } catch (logErr) {}

      toast.success(
        `${service?.label || "Service"} has been ${enabled ? "enabled" : "disabled"
        } for ${row?.name || "user"}.`
      );
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["allUsers"] }),
        queryClient.invalidateQueries({ queryKey: ["userSearch"] }),
        queryClient.invalidateQueries({ queryKey: ["user"] }),
      ]);
    } catch (error) {
      console.error("[user-list][toggle-service-settings] error", error);
      toast.error(
        error?.message || `Could not ${enabled ? "enable" : "disable"} ${service?.label || "service"}.`
      );
    } finally {
      setServiceSettingUpdatingKey((currentKey) =>
        currentKey === updateKey ? "" : currentKey
      );
    }
  };

  const handleBulkToggleService = async (serviceKey, enabled) => {
    if (!canManageUserServiceSettings) {
      toast.error("Only admins can update service settings.");
      return;
    }

    const service = SERVICE_FLAG_CONFIG.find((item) => item.key === serviceKey);
    const serviceLabel = USER_SERVICE_INLINE_LABELS[serviceKey] || service?.label || serviceKey;
    const actionText = enabled ? "ENABLE" : "DISABLE";

    const confirmMsg = `Are you sure you want to ${actionText} ${serviceLabel} for ALL merchant & franchise users on this list?`;
    if (!window.confirm(confirmMsg)) return;

    setBulkServiceUpdatingKey(serviceKey);

    try {
      const targetUsers = currentData.filter((u) => isServiceToggleRole(u));
      if (targetUsers.length === 0) {
        toast.info("No merchant or franchise users found on current view.");
        return;
      }

      toast.info(`Bulk updating ${serviceLabel} for ${targetUsers.length} user(s)...`);

      let updatedCount = 0;
      for (const u of targetUsers) {
        try {
          await updateUserServiceSettings(u.id, { [serviceKey]: enabled });
          
          // Record System Activity Audit Log per user
          try {
            recordLimitAuditLog({
              performingUser: currentUser,
              affectedUser: u,
              previousState: enabled ? "Disabled" : "Enabled",
              newState: enabled ? "Enabled" : "Disabled",
              action: enabled ? "BULK_SERVICE_ENABLED" : "BULK_SERVICE_DISABLED",
              serviceKey: serviceKey,
            });
          } catch (lErr) {}

          updatedCount += 1;
        } catch (err) {
          console.error(`Failed to update ${serviceLabel} for user ${u.id}`, err);
        }
      }

      toast.success(
        `Successfully ${enabled ? "enabled" : "disabled"} ${serviceLabel} for ${updatedCount} user(s)!`
      );

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["allUsers"] }),
        queryClient.invalidateQueries({ queryKey: ["userSearch"] }),
        queryClient.invalidateQueries({ queryKey: ["user"] }),
      ]);
    } catch (error) {
      console.error("[bulk-toggle-service] failed", error);
      toast.error(`Could not bulk update ${serviceLabel}.`);
    } finally {
      setBulkServiceUpdatingKey("");
    }
  };

  const getIpayOutletId = (row) => {
    const value = row?.ipay_outlet_id ?? row?.ipayOutletId ?? null;
    return value !== undefined ? value : null;
  };

  const hasIpayOutlet = (row) => {
    const value = getIpayOutletId(row);
    return value !== null && value !== undefined && String(value).trim() !== "";
  };

  const openIpayOutletModal = (user) => {
    setIpayOutletModalState({
      open: true,
      user,
      outletId: "",
    });
  };

  const closeIpayOutletModal = () => {
    if (isIpayOutletSubmitting) return;
    setIpayOutletModalState({
      open: false,
      user: null,
      outletId: "",
    });
  };

  const handleIpayOutletSubmit = async (event) => {
    event.preventDefault();
    const userId = Number(ipayOutletModalState.user?.id);
    const rawValue = String(ipayOutletModalState.outletId || "").trim();

    if (!Number.isFinite(userId)) {
      toast.error('Invalid user selected.');
      return;
    }

    if (rawValue === "") {
      toast.error('Enter a valid ipay_outlet_id.');
      return;
    }

    const outletId = Number(rawValue);
    if (!Number.isInteger(outletId) || outletId <= 0) {
      toast.error('ipay_outlet_id must be a valid integer.');
      return;
    }

    try {
      setIsIpayOutletSubmitting(true);
      await updateUserIpayOutlet({ id: userId, ipay_outlet_id: outletId });
      toast.success('InstantPay outlet ID updated successfully');
      closeIpayOutletModal();
      if (typeof refetchAllUsers === 'function') {
        await refetchAllUsers();
      }
      queryClient.invalidateQueries(['allUsers']);
      queryClient.invalidateQueries(['userSearch']);
    } catch (error) {
      toast.error(error?.message || 'Failed to update InstantPay outlet ID');
    } finally {
      setIsIpayOutletSubmitting(false);
    }
  };

  const handleResetIpayOutlet = async (user) => {
    if (!window.confirm(`Are you sure you want to reset KYC for ${user.name || user.mobile_number}?`)) {
      return;
    }

    try {
      setIsIpayOutletSubmitting(true);
      await updateUserIpayOutlet({ id: user.id, ipay_outlet_id: null });
      toast.success('InstantPay outlet ID reset successfully');
      if (typeof refetchAllUsers === 'function') {
        await refetchAllUsers();
      }
      queryClient.invalidateQueries(['allUsers']);
      queryClient.invalidateQueries(['userSearch']);
    } catch (error) {
      toast.error(error?.message || 'Failed to reset InstantPay outlet ID');
    } finally {
      setIsIpayOutletSubmitting(false);
    }
  };

  const openWalletModal = (user, role) => {
    if (!canAdjustWallet) {
      return;
    }

    const defaultAction = canDebitWallet ? "debit" : "credit";

    setWalletModalState({
      open: true,
      user,
      role: String(user?.role || role || "").trim().toLowerCase(),
      action: defaultAction,
    });
    setWalletForm({
      amount: "",
      reason: "",
      idempotencyKey: createIdempotencyKey(),
    });

    setWalletBalanceState({
      loading: true,
      balance: null,
      error: null,
    });

    userDetail(user.id)
      .then((response) => {
        const balance = parseWalletBalance(response);
        setWalletBalanceState({
          loading: false,
          balance,
          error: balance === null ? "Wallet balance unavailable" : null,
        });
      })
      .catch(() => {
        setWalletBalanceState({
          loading: false,
          balance: null,
          error: "Unable to fetch wallet balance",
        });
      });
  };

  const closeWalletModal = () => {
    if (walletSubmitting) return;
    setWalletModalState({
      open: false,
      user: null,
      role: "",
      action: "credit",
    });
    setWalletConfirmState({
      open: false,
      acknowledged: false,
      captchaText: "",
      captchaInput: "",
    });
    setWalletBalanceState({
      loading: false,
      balance: null,
      error: null,
    });
  };

  const closeWalletConfirmModal = () => {
    if (walletSubmitting) return;
    setWalletConfirmState({
      open: false,
      acknowledged: false,
      captchaText: "",
      captchaInput: "",
    });
  };

  function openPosModal(user) {
    setPosModalState({
      open: true,
      user,
      page: 1,
      limit: 50,
      status: "",
    });
  }

  const openMobileActionSheet = (user) => {
    setMobileActionSheet({ open: true, user });
  };

  const closeMobileActionSheet = () => {
    setMobileActionSheet({ open: false, user: null });
  };

  function closePosModal() {
    setPosModalState({
      open: false,
      user: null,
      page: 1,
      limit: 50,
      status: "",
    });
  }

  const handleWalletAdjustmentSubmit = async (event) => {
    event.preventDefault();

    const userId = Number(walletModalState?.user?.id);
    const amount = Number(walletForm.amount);

    if (!Number.isFinite(userId)) {
      toast.error("Invalid user selected.");
      return;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Enter a valid amount greater than 0.");
      return;
    }

    if (
      walletModalState.action === "debit" &&
      walletBalanceState.balance !== null &&
      amount > walletBalanceState.balance
    ) {
      toast.error(
        `Debit amount cannot exceed wallet balance (₹${walletBalanceState.balance.toFixed(2)}).`
      );
      return;
    }

    if (!walletForm.idempotencyKey) {
      toast.error("Idempotency key is required.");
      return;
    }

    if (!walletConfirmState.open) {
      setWalletConfirmState({
        open: true,
        acknowledged: false,
        captchaText:
          walletModalState.action === "credit"
            ? generateWalletCaptcha(walletModalState.action)
            : "",
        captchaInput: "",
      });
      return;
    }

    if (!walletConfirmState.acknowledged) {
      toast.error(
        walletModalState.action === "credit"
          ? "Please confirm the credit checkbox."
          : "Please confirm the debit checkbox."
      );
      return;
    }

    if (
      walletModalState.action === "credit" &&
      String(walletConfirmState.captchaInput || "").trim().toUpperCase() !==
      String(walletConfirmState.captchaText || "").trim().toUpperCase()
    ) {
      toast.error("Captcha text does not match.");
      return;
    }

    const payload = {
      user_id: userId,
      amount,
      reason: walletForm.reason?.trim() || undefined,
      idempotency_key: walletForm.idempotencyKey,
    };
    const walletTraceId = `wallet-ui-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    try {
      console.info("[wallet-adjustment][ui-start]", {
        traceId: walletTraceId,
        action: walletModalState.action,
        userId,
        role: walletModalState.role,
        amount,
        hasReason: Boolean(payload.reason),
        reasonLength: payload.reason ? String(payload.reason).length : 0,
        idempotencyKeyFingerprint: payload.idempotency_key
          ? `${String(payload.idempotency_key).length}:${String(payload.idempotency_key).slice(-6)}`
          : null,
      });
      setWalletSubmitting(true);
      const response =
        walletModalState.action === "debit"
          ? await adminWalletDebit(payload)
          : await adminWalletCredit(payload);

      const successMessage =
        response?.message ||
        (walletModalState.action === "debit"
          ? "Wallet debited successfully."
          : "Wallet credited successfully.");
      console.info("[wallet-adjustment][ui-success]", {
        traceId: walletTraceId,
        action: walletModalState.action,
        userId,
        message: successMessage,
        responseKeys: Object.keys(response || {}),
      });
      toast.success(successMessage);
      closeWalletModal();
    } catch (error) {
      console.error("[wallet-adjustment][ui-failed]", {
        traceId: walletTraceId,
        action: walletModalState.action,
        userId,
        role: walletModalState.role,
        amount,
        status: error?.status ?? null,
        code: error?.code ?? null,
        apiTraceId: error?.traceId ?? null,
        url: error?.url ?? null,
        method: error?.method ?? null,
        timeout: error?.timeout ?? null,
        response: error?.raw ?? null,
        message: error?.message || null,
      });
      toast.error(error?.message || "Wallet adjustment failed.");
    } finally {
      setWalletSubmitting(false);
    }
  };

  const enteredAmount = Number(walletForm.amount);
  const isAmountInvalid =
    walletForm.amount === "" || !Number.isFinite(enteredAmount) || enteredAmount <= 0;
  const isDebitExceedingBalance =
    walletModalState.action === "debit" &&
    walletBalanceState.balance !== null &&
    Number.isFinite(enteredAmount) &&
    enteredAmount > walletBalanceState.balance;

  const isTargetTestUser = (targetUser) => {
    if (!targetUser) return false;
    const idStr = String(targetUser.id || "");
    const abheepayIdStr = String(targetUser.abheepay_id || "").toUpperCase();
    const mobileStr = String(targetUser.mobile_number || "");
    const testList = [
      "APM00009", "9262914251",
      "APM00008", "9262914250",
      "APF00004", "9091325033",
      "APF00003", "1234567892",
      "APF00001", "123456789",
    ];
    return testList.some((item) => {
      const norm = String(item).trim().toUpperCase();
      return idStr === norm || abheepayIdStr === norm || mobileStr === norm;
    });
  };

  const isCurrentUserPrimaryAdmin = (user) => {
    if (!user || String(user.role || "").toLowerCase() !== "admin") return false;
    const idStr = String(user.id || "");
    const abheepayIdStr = String(user.abheepay_id || "").toUpperCase();
    const mobileStr = String(user.mobile_number || "");
    const emailStr = String(user.email || "").toLowerCase();
    const primaryList = ["APA00001", "8119865074", "9990450938", "admin@abheepay.com", "1"];
    return primaryList.some((item) => {
      const norm = String(item).trim();
      return (
        idStr === norm ||
        abheepayIdStr === norm.toUpperCase() ||
        mobileStr === norm ||
        emailStr === norm.toLowerCase()
      );
    });
  };

  const openImpersonatedDashboard = async (user, role) => {
    const normalizedTargetRole = normalizeUserRole(role || user?.role);
    const isSuperFranchiseUser = normalizedCurrentUserRole === "super_franchise";
    const targetCanBeImpersonatedByNonAdmin =
      normalizedTargetRole === "merchant" || normalizedTargetRole === "franchise" || (isAdmin && normalizedTargetRole === "super_franchise");

    if (!isAdmin && !isSuperFranchiseUser && (!canUseImpersonateLogin || !targetCanBeImpersonatedByNonAdmin)) {
      toast.error("You do not have permission to login as this user.");
      return;
    }

    if (isAdmin && normalizeUserRole(role || user?.role) === "admin") {
      toast.error("Admin direct login to admin is not allowed.");
      return;
    }

    const isPrimaryAdminUser = isCurrentUserPrimaryAdmin(currentUser);
    if (!isPrimaryAdminUser && !isSuperFranchiseUser && !isTargetTestUser(user)) {
      toast.error("Only primary admins and super franchises can log in as their assigned users.");
      return;
    }

    const tabId = `${normalizedTargetRole}-${user.id}`;
    const loadingTab = window.open("", "_blank");

    if (!loadingTab) {
      toast.error("Popup blocked. Please allow popups and try again.");
      return;
    }

    loadingTab.document.title = "Opening Dashboard...";
    loadingTab.document.body.innerHTML = `
      <div style="font-family: Arial, sans-serif; padding: 16px;">
        <h3 style="margin:0 0 10px;">Opening dashboard...</h3>
        <p style="margin:0; color:#444;">Please wait while we sign in.</p>
      </div>
    `;

    try {
      setImpersonatingUser(tabId);
      const result = await impersonateUser({
        userId: user.id,
        role,
        forceRefreshDlToken: true,
      });
      toast.success(result?.raw?.message || "Direct-login response received.");
      const resolvedRole = String(result?.user?.role || role || "").trim().toLowerCase();
      if (resolvedRole === "admin") {
        throw new Error("Admin direct login to admin is not allowed.");
      }

      const targetPath =
        resolvedRole === "super_franchise"
          ? "/super-franchise/dashboard"
          : resolvedRole === "franchise" || resolvedRole === "franchaise"
            ? "/franchise/dashboard"
            : resolvedRole === "employee"
              ? "/admin/dashboard"
              : "/merchant/dashboard";
      const seeded = seedSessionAuthInWindow(loadingTab, result.token);
      if (!seeded) {
        throw new Error("Unable to prepare secure session for new tab.");
      }

      const nextUrl = `${window.location.origin}${targetPath}`;
      loadingTab.location.replace(nextUrl);
    } catch (error) {
      const message = error?.message || "Unable to open impersonated dashboard.";
      console.error("[login-as] failed", {
        traceId: error?.traceId ?? null,
        userId: user?.id,
        role,
        code: error?.code ?? null,
        url: error?.url ?? null,
        method: error?.method ?? null,
        timeout: error?.timeout ?? null,
        status: error?.status ?? null,
        apiResponse: error?.raw ?? null,
        stack: error?.stack ?? null,
        href: window.location.href,
        online: navigator.onLine,
        message,
      });
      const safeMessage = escapeHtml(message);
      const debugHint = error?.traceId ? `<p style="margin:0 0 12px; color:#64748b; font-size:12px;">Trace: ${escapeHtml(error.traceId)}</p>` : "";
      loadingTab.document.title = "Unable to open dashboard";
      loadingTab.document.body.innerHTML = `
        <div style="font-family: Arial, sans-serif; padding: 16px;">
          <h3 style="margin:0 0 8px;">Unable to open dashboard</h3>
          <p style="margin:0 0 12px; color:#444;">${safeMessage}</p>
          ${debugHint}
          <button style="padding:8px 12px; border:0; border-radius:6px; background:#0ea5a4; color:#fff; cursor:pointer;" onclick="window.close()">Close</button>
        </div>
      `;
      toast.error(message);
    } finally {
      setImpersonatingUser(null);
    }
  };

  const canImpersonateTarget = (row) => {
    const normalizedTargetRole = normalizeUserRole(row?.role);
    if (!normalizedTargetRole) return false;
    if (normalizedTargetRole === "admin") return false;

    const isPrimaryAdminUser = isCurrentUserPrimaryAdmin(currentUser);
    const isSuperFranchiseUser = normalizedCurrentUserRole === "super_franchise";

    if (!isPrimaryAdminUser && !isSuperFranchiseUser && !isTargetTestUser(row)) {
      return false;
    }

    if (isAdmin) return true;
    if (isSuperFranchiseUser) {
      return normalizedTargetRole === "franchise" || normalizedTargetRole === "merchant";
    }
    if (!canUseImpersonateLogin) return false;
    return normalizedTargetRole === "merchant" || normalizedTargetRole === "franchise";
  };

  // Actions for merchants table
  const userActions = () => {
    const actions = [];

    if (canReadUsers && normalizedCurrentUserRole !== "employee") {
      actions.push({
        label: (
          <Eye className="text-blue-500 text-xl hover:text-blue-700 transition-colors" />
        ),
        onClick: (row) => navigate(redirectUrl + `/${row.id}`),
      });
    }

    if (canUpdateUsers) {
      actions.push({
        label: (
          <SquarePen className="text-primary text-xl hover:opacity-80 transition-colors" />
        ),
        onClick: handleEditUser,
      });
    }

    if (canUpdateUserStatus && !isEmployeeDirectory) {
      actions.push({
        label: (row) => (
          <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700">
            {row?.status === "active" ? "Disable" : "Enable"}
          </span>
        ),
        onClick: (row) => handleToggleUserStatus(row, row?.status === "active" ? "inactive" : "active"),
      });
    }

    if (isEmployeeDirectory && isAdmin) {
      actions.push({
        label: (
          <span
            className="inline-flex items-center gap-1 px-2 py-1 rounded-full border text-xs font-semibold border-emerald-200 bg-emerald-50 text-emerald-700"
            title="Login as employee"
          >
            <LogIn className="w-3.5 h-3.5" />
            Login
          </span>
        ),
        onClick: (row) => openImpersonatedDashboard(row, row.role),
      });
      actions.push({
        label: (row) => (
          <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700">
            {row?.status === "active" ? "Disable" : "Enable"}
          </span>
        ),
        onClick: (row) => handleToggleUserStatus(row, row?.status === "active" ? "inactive" : "active"),
      });
      return actions.length ? actions : null;
    }

    if (isAdmin) {
      actions.push({
        label: (
          <span
            className="inline-flex items-center gap-1 px-2 py-1 rounded-full border text-xs font-semibold border-amber-200 bg-amber-50 text-amber-700"
            title="Set KYC via InstantPay outlet ID"
          >
            Set KYC
          </span>
        ),
        onClick: openIpayOutletModal,
        show: (row) => !hasIpayOutlet(row),
      });

      actions.push({
        label: (
          <span
            className="inline-flex items-center gap-1 px-2 py-1 rounded-full border text-xs font-semibold border-red-200 bg-red-50 text-red-700"
            title="Reset KYC"
          >
            Reset KYC
          </span>
        ),
        onClick: (row) => handleResetIpayOutlet(row),
        show: (row) => hasIpayOutlet(row),
      });
    }

    if (!isEmployeeDirectory && canUseImpersonateLogin) {
      actions.push({
        label: (
          <span
            className="inline-flex items-center gap-1 px-2 py-1 rounded-full border text-xs font-semibold border-emerald-200 bg-emerald-50 text-emerald-700"
            title="Login as user"
          >
            <LogIn className="w-3.5 h-3.5" />
            Login
          </span>
        ),
        onClick: (row) => openImpersonatedDashboard(row, row.role),
        show: (row) => canImpersonateTarget(row),
      });
    }

    return actions.length ? actions : null;
  };

  const currentData = isSearchMode ? searchUsers_ : allUsers;

  // Add serial number for display in table (1-based per current page)
  const baseIndex = isSearchMode
    ? (searchPage - 1) * searchPageSize
    : (allUsersParams.page - 1) * allUsersParams.limit;
  const tableData = currentData.map((row, idx) => ({ ...row, sl: baseIndex + idx + 1 }));

  const handleAllUsersFilterChange = (field, value) => {
    setCommittedSearch("");
    setSearchInputValue("");
    setSearchPage(1);
    setAllUsersParams((prev) => ({
      ...prev,
      [field]: value,
      page: field === "page" ? value : 1,
    }));
  };

  const isTabLoading = isSearchMode ? searchLoading : allUsersLoading;
  const tabError = isSearchMode ? searchError : allUsersError;
  const tabLabel = "users";

  const searchTotalPages = searchResponse?.pagination?.totalPages ?? 1;
  const listTotalPages = allUsersResponse?.pagination?.totalPages || 1;

  const formatExcelDate = (dateStr) => {
    if (!dateStr) return "-";
    try {
      return new Date(dateStr).toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      });
    } catch {
      return dateStr;
    }
  };

  const formatUserAddress = (user) => {
    if (!user) return "-";
    if (user.address && !user.address1) {
      return user.address;
    }
    const addressParts = [
      user.address1,
      user.address2,
      user.city,
      user.district,
      user.state,
      user.country,
      user.pincode || user.pin_code ? `PIN: ${user.pincode || user.pin_code}` : null,
    ].filter((part) => part && String(part).trim() !== "");

    if (addressParts.length > 0) {
      return addressParts.join(", ");
    }
    return user.address || "-";
  };

  const buildUserExportRows = (users = []) =>
    users.map((user, index) => {
      const normalizedRole = normalizeUserRole(user?.role);
      const walletValue = user?.wallet ?? user?.wallet_balance ?? 0;
      const settlementType = normalizeSettlementType(
        user?.settlement_type ?? user?.settlementType
      );

      return {
        "SL No": index + 1,
        "User Name": user?.name || "-",
        "Mobile Number": user?.mobile_number || user?.mobile || "-",
        Email: maskEmailForUser(user?.email, currentUser),
        "User ID": user?.abheepay_id || user?.id || "-",
        Role: normalizedRole ? `${normalizedRole.charAt(0).toUpperCase()}${normalizedRole.slice(1)}` : "-",
        Franchise: normalizedRole === "merchant" ? getFranchiseDisplayNameForExport(user) : "-",
        Address: formatUserAddress(user),
        Wallet: formatWalletValue(walletValue),
        "Wallet Status": getWalletStatusLabel(user),
        Settlement: settlementType === "next_day_settlement" ? "T+1" : "T+0",
        "POS Count": user?.pos_machine_count ?? 0,
        "User Status": user?.status || "-",
        Services: getServiceStatusSummary(user),
        "Created At": formatExcelDate(user?.createdAt || user?.created_at),
      };
    });

  const handleExportUsers = async () => {
    try {
      setIsExportingUsers(true);

      let exportUsers = currentData;

      if (isSearchMode) {
        const total = Number(searchResponse?.pagination?.total ?? searchUsers_.length ?? 0);
        const response = await searchUsers({
          q: committedSearch,
          status: allUsersParams.status,
          role: allUsersParams.role,
          limit: total > 0 ? total : 1000,
          page: 1,
        });
        exportUsers = Array.isArray(response?.data) ? response.data : extractUsersArray(response);
      } else {
        const total = Number(allUsersResponse?.pagination?.total ?? allUsers.length ?? 0);
        const response = await AllUsers({
          ...allUsersParams,
          page: 1,
          limit: total > 0 ? total : 1000,
        });
        exportUsers = extractUsersArray(response);
      }

      if (!Array.isArray(exportUsers) || exportUsers.length === 0) {
        toast.info("No users available to export.");
        return;
      }

      const worksheet = XLSX.utils.json_to_sheet(buildUserExportRows(exportUsers));
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Users");
      const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
      const blob = new Blob([excelBuffer], { type: "application/octet-stream" });
      saveAs(blob, "UserList.xlsx");
      toast.success("User list exported successfully.");
    } catch (error) {
      toast.error(error?.message || "Failed to export user list.");
    } finally {
      setIsExportingUsers(false);
    }
  };

  if (!canListUsers) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
        <h2 className="text-xl font-semibold text-gray-900">User List Access Required</h2>
        <p className="mt-2 text-sm text-gray-500">
          This account does not currently have permission to open the user list.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-gray-100 min-h-screen">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
      </div>

      <div className="bg-white rounded-lg shadow-sm px-1 py-6 md:p-6">
        {/* Search */}
        {canSearchUsers && (
          <form onSubmit={handleSearchSubmit} className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {isEmployeeDirectory ? "Search Employees" : "Search Users"}
            </label>
            <div className="flex gap-2 max-w-md">
              <input
                type="text"
                value={searchInputValue}
                onChange={(e) => setSearchInputValue(e.target.value)}
                placeholder="Name, email, username or mobile..."
                autoComplete="off"
                className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <button
                type="submit"
                disabled={searchLoading}
                className="rounded-md bg-primary px-2 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
              >
                {searchLoading ? "Searching..." : "Search"}
              </button>
              {isSearchMode && (
                <button
                  type="button"
                  onClick={handleSearchClear}
                  className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
                >
                  Clear
                </button>
              )}
            </div>
            {isSearchMode && (
              <p className="mt-1 text-xs text-gray-500">
                {searchLoading
                  ? "Searching..."
                  : `${searchResponse?.pagination?.total ?? searchUsers_.length} result(s) for "${committedSearch}"`}
              </p>
            )}
          </form>
        )}

        {isAdmin && (
          <div className="mb-6 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h3 className="flex items-center gap-2 text-sm font-bold text-gray-800 uppercase tracking-wide">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
                  MASTER SERVICE CONTROLS (BULK ENABLE / DISABLE ALL USERS)
                </h3>
                <p className="mt-0.5 text-xs text-gray-500">
                  Click the toggle switch on any service to bulk toggle for all users. Individual user checkboxes can still be customized in the table below.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-5">
              {MASTER_SERVICE_CONTROLS.map((service) => {
                const isPending = bulkServiceUpdatingKey === service.key;
                const isCurrentlyActive = masterServiceSettingsData?.[service.key]?.is_enabled !== false;

                return (
                  <div
                    key={service.key}
                    className={`flex items-center justify-between rounded-xl border p-2.5 transition-all duration-200 shadow-sm ${
                      isCurrentlyActive
                        ? "border-emerald-200 bg-emerald-50/40 hover:border-emerald-300"
                        : "border-gray-200 bg-gray-50/60 hover:border-gray-300"
                    }`}
                  >
                    <div className="flex flex-col min-w-0 pr-2">
                      <span className="font-bold text-gray-800 text-xs truncate" title={service.label}>
                        {service.label}
                      </span>
                      <span className={`text-[10px] font-medium ${isCurrentlyActive ? "text-emerald-600 font-semibold" : "text-gray-400"}`}>
                        {isCurrentlyActive ? "Enabled for All" : "Disabled for All"}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleMasterBulkToggle(service.key, !isCurrentlyActive)}
                      disabled={isPending}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full p-0.5 transition-colors duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-emerald-500/20 disabled:opacity-50 ${
                        isCurrentlyActive ? "bg-emerald-600" : "bg-gray-300"
                      }`}
                      title={`Click to toggle ${service.label} for ALL users`}
                    >
                      <span
                        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition duration-300 ease-in-out flex items-center justify-center text-[9px] font-extrabold ${
                          isCurrentlyActive ? "translate-x-5 text-emerald-600" : "translate-x-0 text-gray-400"
                        }`}
                      >
                        {isPending ? "..." : (isCurrentlyActive ? "ON" : "OFF")}
                      </span>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="flex flex-wrap gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500">Status</label>
              <select
                value={allUsersParams.status}
                onChange={(e) => handleAllUsersFilterChange("status", e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-200 bg-white py-1.5 px-2 text-sm text-gray-700 shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">All</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            {!lockedRole && (
              <div>
                <label className="block text-xs font-medium text-gray-500">Role</label>
                <select
                  value={allUsersParams.role}
                  onChange={(e) => handleAllUsersFilterChange("role", e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-200 bg-white py-1.5 px-2 text-sm text-gray-700 shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="">All</option>
                  {normalizedCurrentUserRole === "admin" && (
                    <>
                      <option value="admin">Admin</option>
                      <option value="employee">Employee</option>
                      <option value="super_franchise">Super Franchise</option>
                    </>
                  )}
                  {normalizedCurrentUserRole !== "franchise" && (
                    <>
                      <option value="franchaise">Franchise</option>
                    </>
                  )}
                  <option value="merchant">Merchant</option>
                </select>
              </div>
            )}
          </div>

          <div className="flex flex-col items-end gap-3 text-sm text-gray-600 md:flex-row md:items-center">
            {normalizedCurrentUserRole !== "employee" && (
              <button
                type="button"
                onClick={handleExportUsers}
                disabled={isExportingUsers || isTabLoading}
                className="inline-flex items-center rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isExportingUsers ? "Exporting..." : "Download Excel"}
              </button>
            )}
            {canBulkUpdateSettlementType && (
              <div className="min-w-[220px]">
                <label className="block text-xs font-medium text-gray-500">Bulk Settlement type update</label>
                <div className="mt-1 flex gap-2">
                  <select
                    value={bulkSettlementType}
                    onChange={(e) => handleBulkSettlementTypeChange(e.target.value)}
                    className="flex-1 rounded-md border-gray-200 bg-white py-1.5 px-2 text-sm text-gray-700 shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="today_settlement">Today Settlement</option>
                    <option value="next_day_settlement">Next Day Settlement</option>
                  </select>
                  <button
                    type="button"
                    onClick={handleBulkSettlementUpdate}
                    disabled={isBulkSettlementUpdating}
                    className="inline-flex items-center rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isBulkSettlementUpdating ? "Updating..." : "Update All"}
                  </button>
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  Updates every merchant/franchise user.
                </p>
              </div>
            )}
            <div className="flex items-center gap-2">
              {isSearchMode ? (
                <>
                  <span>Page {searchPage} of {searchTotalPages}</span>
                  <button
                    type="button"
                    onClick={() => setSearchPage((p) => Math.max(1, p - 1))}
                    disabled={searchPage <= 1}
                    className="rounded-md border border-gray-200 bg-white px-3 py-1 text-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Prev
                  </button>
                  <button
                    type="button"
                    onClick={() => setSearchPage((p) => Math.min(searchTotalPages, p + 1))}
                    disabled={searchPage >= searchTotalPages}
                    className="rounded-md border border-gray-200 bg-white px-3 py-1 text-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Next
                  </button>
                </>
              ) : (
                <>
                  <span>Page {allUsersParams.page} of {listTotalPages}</span>
                  <button
                    type="button"
                    onClick={() => handleAllUsersFilterChange("page", Math.max(1, allUsersParams.page - 1))}
                    disabled={allUsersParams.page <= 1}
                    className="rounded-md border border-gray-200 bg-white px-3 py-1 text-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Prev
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAllUsersFilterChange("page", Math.min(listTotalPages, allUsersParams.page + 1))}
                    disabled={allUsersParams.page >= listTotalPages}
                    className="rounded-md border border-gray-200 bg-white px-3 py-1 text-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Next
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {isTabLoading && <p>Loading {tabLabel}...</p>}
        {tabError && <p>Error loading {tabLabel}: {tabError.message}</p>}

        {!isTabLoading && !tabError && (
          <>
            {/* Mobile Cards */}
            <div className="md:hidden space-y-5">
              {currentData.length === 0 ? (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 text-center text-sm text-gray-500">
                  No users found.
                </div>
              ) : (
                currentData.map((user, idx) => {
                  const normalizedRole = normalizeUserRole(user?.role);
                  const roleLabel = normalizedRole
                    ? `${normalizedRole.charAt(0).toUpperCase()}${normalizedRole.slice(1)}`
                    : "-";

                  return (
                    <div key={user.id} className="bg-white rounded-2xl border border-gray-200 shadow-md hover:shadow-lg transition-shadow duration-200 overflow-hidden">

                      <div className="flex items-start gap-2 p-1 pt-2">
                        <div className="flex h-13 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-lg">
                          {user.name?.charAt(0)?.toUpperCase() || "U"}
                        </div>

                        <div className="min-w-0 flex-1 pt-0.5">
                          <h3 className="font-bold text-gray-900 text-[15px] leading-tight">
                            {/* {user.name || "-"}  */}  {user.name ? user.name.split(" ")[0] : "-"}
                          </h3>

                          <p className="mt-1 text-xs text-gray-500">
                            {user.abheepay_id || "-"}
                          </p>

                          {/* <p className="text-xs text-gray-400">
                          #{baseIndex + idx + 1}
                        </p> */}
                        </div>

                        <div className="flex shrink-0 items-center gap-2">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${user.status === "active"
                              ? "bg-green-100 text-green-700"
                              : "bg-red-100 text-red-700"
                              }`}
                          >
                            {user.status || "N/A"}
                          </span>

                          <button
                            type="button"
                            onClick={() => openMobileActionSheet(user)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                            aria-label="Open user actions"
                          >
                            <ChevronDown className="h-5 w-5" />
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 border-t border-gray-100">
                        <div className="space-y-1 border-b border-r border-gray-100 p-3.5">
                          <p className="text-xs text-gray-400">Phone</p>
                          <p className="text-sm font-semibold text-gray-900">
                            {user.mobile_number || "-"}
                          </p>
                        </div>

                        {!isEmployeeDirectory ? (
                          <div className="space-y-1 border-b border-gray-100 p-3.5">
                            <p className="text-xs text-gray-400">Role</p>
                            <p className="text-sm font-semibold text-blue-600">
                              {roleLabel}
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-1 border-b border-gray-100 p-3.5" />
                        )}

                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Desktop/Tablet Table */}
            <div className="hidden md:block">
              {console.log("columns", columns)}
              <Table
                columns={columns}
                data={tableData}
                actions={userActions()}
                actionsHeader="Quick Actions"
                actionsAlign="center"
              />
            </div>
          </>
        )}
      </div>

      {mobileActionSheet.open && mobileActionSheet.user && (
        <>
          <button
            type="button"
            aria-label="Close user actions"
            className="fixed inset-0 z-40 bg-black/40 md:hidden"
            onClick={closeMobileActionSheet}
          />

          <div className="fixed inset-x-0 bottom-0 z-50 md:hidden bg-white rounded-t-3xl shadow-2xl">
            <div className="flex justify-center pt-3 pb-2">
              <div className="h-1 w-12 rounded-full bg-gray-300" />
            </div>

            <div className="px-3 pb-8 pt-2 space-y-2.5 max-h-[75vh] overflow-y-auto">
              {(() => {
                const sheetUser = mobileActionSheet.user;
                const sheetUserKey = `${normalizeUserRole(sheetUser?.role)}-${sheetUser.id}`;
                const isSheetUserImpersonating = impersonatingUser === sheetUserKey;

                return (
                  <>
                    {canViewWalletColumn && !isEmployeeDirectory && (
                      canAdjustWallet ? (
                        <button
                          type="button"
                          onClick={() => {
                            closeMobileActionSheet();
                            openWalletModal(sheetUser, activeRole);
                          }}
                          className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gray-100 px-4 py-3.5 text-sm font-semibold text-gray-900 hover:bg-gray-200"
                        >
                          <Wallet className="h-4 w-4" />
                          Wallet ({canViewWalletAmount ? formatWalletValue(sheetUser.wallet) : "Hidden"})
                        </button>
                      ) : (
                        <div className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gray-100 px-4 py-3.5 text-sm font-semibold text-gray-900">
                          <Wallet className="h-4 w-4" />
                          Wallet ({canViewWalletAmount ? formatWalletValue(sheetUser.wallet) : "Hidden"})
                        </div>
                      )
                    )}

                    <div className="grid grid-cols-2 gap-2">
                      {canUpdateUsers && (
                        <button
                          type="button"
                          onClick={() => {
                            closeMobileActionSheet();
                            handleEditUser(sheetUser);
                          }}
                          className="w-full inline-flex items-center justify-center gap-2 rounded-xl border-2 border-primary bg-white px-4 py-3.5 text-sm font-semibold text-primary hover:bg-primary/5"
                        >
                          <SquarePen className="h-4 w-4" />
                          Edit
                        </button>
                      )}

                      {canUpdateUserStatus && !isEmployeeDirectory && (
                        <button
                          type="button"
                          onClick={() => {
                            closeMobileActionSheet();
                            handleToggleUserStatus(
                              sheetUser,
                              sheetUser?.status === "active" ? "inactive" : "active"
                            );
                          }}
                          className="w-full inline-flex items-center justify-center gap-2 rounded-xl border-2 border-red-800 bg-white px-4 py-3.5 text-sm font-semibold text-red-800 hover:bg-red-50"
                        >
                          <Ban className="h-4 w-4" />
                          {sheetUser?.status === "active" ? "Disable" : "Enable"}
                        </button>
                      )}

                      {(!isEmployeeDirectory && canImpersonateTarget(sheetUser)) || (isEmployeeDirectory && isAdmin) ? (
                        <button
                          type="button"
                          onClick={() => {
                            closeMobileActionSheet();
                            openImpersonatedDashboard(sheetUser, sheetUser.role);
                          }}
                          disabled={isSheetUserImpersonating}
                          className="w-full inline-flex items-center justify-center gap-2 rounded-xl border-2 border-primary bg-white px-4 py-3.5 text-sm font-semibold text-primary hover:bg-primary/5 disabled:opacity-60"
                        >
                          {isSheetUserImpersonating ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Opening...
                            </>
                          ) : (
                            <>
                              <LogIn className="h-4 w-4" />
                              Login
                            </>
                          )}
                        </button>
                      ) : null}

                      {canReadUsers && normalizedCurrentUserRole !== "employee" && (
                        <button
                          type="button"
                          onClick={() => {
                            closeMobileActionSheet();
                            navigate(`${redirectUrl}/${sheetUser.id}`);
                          }}
                          className="w-full inline-flex items-center justify-center gap-2 rounded-xl border-2 border-primary bg-white px-4 py-3.5 text-sm font-semibold text-primary hover:bg-primary/5"
                        >
                          <Eye className="h-4 w-4" />
                          View
                        </button>
                      )}
                    </div>

                    {!isEmployeeDirectory && (isServiceToggleRole(sheetUser) || renderSettlementShortcut(sheetUser)) && (
                      <div className="space-y-2.5 border-t border-gray-100 pt-3">
                        {getRoleSupplementaryText(sheetUser) && (
                          <p className="text-xs text-gray-500 px-1">{getRoleSupplementaryText(sheetUser)}</p>
                        )}

                        {renderSettlementShortcut(sheetUser) && (
                          <div className="rounded-xl bg-gray-50 px-4 py-3">
                            {renderSettlementShortcut(sheetUser)}
                          </div>
                        )}

                        {isServiceToggleRole(sheetUser) && (
                          <div className="rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-700">
                            <span className="font-medium">Services:</span>
                            <div className="mt-2">{renderServiceSettingsInline(sheetUser)}</div>

                            <div className="mt-3 grid grid-cols-2 gap-3">
                              <div className="space-y-1">
                                <p className="text-xs text-gray-400">KYC</p>
                                <p className={`text-sm font-semibold ${hasIpayOutlet(sheetUser) ? "text-green-600" : "text-orange-500"}`}>
                                  {hasIpayOutlet(sheetUser)
                                    ? `Verified (#${getIpayOutletId(sheetUser)})`
                                    : "Not Done"}
                                </p>
                              </div>
                              <div className="space-y-1">
                                <p className="text-xs text-gray-400">POS Count</p>
                                <p className="text-sm font-semibold text-primary">
                                  {renderPosCountCell(sheetUser.pos_machine_count, sheetUser)}
                                </p>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          </div>
        </>
      )}

      {ipayOutletModalState.open && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[1px] flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-xl shadow-xl border border-gray-100">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Set InstantPay Outlet ID</h3>
                <p className="text-xs text-gray-500 mt-1">
                  {ipayOutletModalState.user?.name || 'User'} • ID {ipayOutletModalState.user?.id}
                </p>
              </div>
              <button
                type="button"
                onClick={closeIpayOutletModal}
                disabled={isIpayOutletSubmitting}
                className="text-gray-500 hover:text-gray-700 disabled:opacity-60"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleIpayOutletSubmit} className="px-5 py-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">InstantPay Outlet ID</label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={ipayOutletModalState.outletId}
                  onChange={(event) => setIpayOutletModalState((prev) => ({ ...prev, outletId: event.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="Enter outlet ID"
                  disabled={isIpayOutletSubmitting}
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={closeIpayOutletModal}
                  disabled={isIpayOutletSubmitting}
                  className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isIpayOutletSubmitting}
                  className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-60"
                >
                  {isIpayOutletSubmitting ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isBulkSettlementConfirmOpen && (
        <Modal
          isOpen={isBulkSettlementConfirmOpen}
          onClose={closeBulkSettlementModal}
          title="Confirm bulk settlement update"
        >
          <div className="space-y-4">
            <p className="text-sm text-gray-700">
              This will update the settlement type for every merchant and franchise user.
            </p>
            <p className="text-sm text-gray-700">
              Selected settlement type: <span className="font-semibold">{bulkSettlementType === "next_day_settlement" ? "Next Day Settlement" : "Today Settlement"}</span>
            </p>
            <div className="flex justify-end gap-2 pt-4 border-t border-gray-100">
              <button
                type="button"
                onClick={closeBulkSettlementModal}
                disabled={isBulkSettlementUpdating}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmBulkSettlementUpdate}
                disabled={isBulkSettlementUpdating}
                className="px-4 py-2 bg-primary text-white rounded hover:bg-primary/90 disabled:opacity-60"
              >
                {isBulkSettlementUpdating ? "Updating..." : "Confirm Update"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {walletModalState.open && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[1px] flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-xl shadow-xl border border-gray-100">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Wallet Adjustment</h3>
                <p className="text-xs text-gray-500 mt-1">
                  {walletModalState.user?.name || "User"} ({walletModalState.role || "user"}) • ID{" "}
                  {walletModalState.user?.id}
                </p>
              </div>
              <button
                type="button"
                onClick={closeWalletModal}
                disabled={walletSubmitting}
                className="text-gray-500 hover:text-gray-700 disabled:opacity-60"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleWalletAdjustmentSubmit} className="px-5 py-4 space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Adjustment Type
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {canDebitWallet && (
                    <label
                      className={`flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 text-sm font-semibold transition ${walletModalState.action === "debit"
                        ? "border-rose-200 bg-rose-50 text-rose-700"
                        : "border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100"
                        }`}
                    >
                      <input
                        type="radio"
                        name="walletAdjustmentType"
                        checked={walletModalState.action === "debit"}
                        onChange={() =>
                          setWalletModalState((prev) => ({ ...prev, action: "debit" }))
                        }
                        disabled={walletSubmitting}
                        className="h-4 w-4 accent-rose-600"
                      />
                      <span>Debit</span>
                    </label>
                  )}
                  {canCreditWallet && (
                    <label
                      className={`flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 text-sm font-semibold transition ${walletModalState.action === "credit"
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100"
                        }`}
                    >
                      <input
                        type="radio"
                        name="walletAdjustmentType"
                        checked={walletModalState.action === "credit"}
                        onChange={() =>
                          setWalletModalState((prev) => ({ ...prev, action: "credit" }))
                        }
                        disabled={walletSubmitting}
                        className="h-4 w-4 accent-emerald-600"
                      />
                      <span>Credit</span>
                    </label>
                  )}
                </div>
              </div>

              <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                <p className="text-xs text-gray-500">Current Wallet Balance</p>
                <p className="text-sm font-semibold text-gray-800">
                  {canViewWalletAmount
                    ? walletBalanceState.loading
                      ? "Loading..."
                      : walletBalanceState.balance !== null
                        ? `₹${walletBalanceState.balance.toFixed(2)}`
                        : "N/A"
                    : "Hidden"}
                </p>
                {canViewWalletAmount && walletBalanceState.error && (
                  <p className="text-xs text-rose-600 mt-1">{walletBalanceState.error}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={walletForm.amount}
                  onChange={(event) => {
                    const nextValue = event.target.value;
                    if (nextValue === "") {
                      setWalletForm((prev) => ({ ...prev, amount: "" }));
                      return;
                    }

                    if (nextValue.startsWith("-")) {
                      return;
                    }

                    setWalletForm((prev) => ({ ...prev, amount: nextValue }));
                  }}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="Enter amount"
                  disabled={walletSubmitting}
                />
                {isAmountInvalid && (
                  <p className="text-xs text-rose-600 mt-1">Amount must be greater than 0.</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Remark (Optional)</label>
                <textarea
                  rows={3}
                  value={walletForm.reason}
                  onChange={(event) =>
                    setWalletForm((prev) => ({ ...prev, reason: event.target.value }))
                  }
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="Add remark"
                  disabled={walletSubmitting}
                />
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={closeWalletModal}
                  disabled={walletSubmitting}
                  className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm hover:bg-gray-50 disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={
                    walletSubmitting ||
                    isAmountInvalid ||
                    isDebitExceedingBalance ||
                    (walletModalState.action === "credit" ? !canCreditWallet : !canDebitWallet)
                  }
                  className={`px-4 py-2 rounded-lg text-white text-sm font-medium disabled:opacity-60 ${walletModalState.action === "debit"
                    ? "bg-rose-600 hover:bg-rose-700"
                    : "bg-emerald-600 hover:bg-emerald-700"
                    }`}
                >
                  {walletSubmitting
                    ? walletModalState.action === "debit"
                      ? "Debiting..."
                      : "Crediting..."
                    : walletModalState.action === "debit"
                      ? "Review Debit"
                      : "Review Credit"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {walletConfirmState.open && (
        <div className="fixed inset-0 z-[60] bg-black/55 backdrop-blur-[2px] flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-xl shadow-2xl border border-gray-100">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Confirm Wallet Adjustment</h3>
                <p className="text-xs text-gray-500 mt-1">
                  {walletModalState.user?.name || "User"} ({walletModalState.role || "user"}) • ID{" "}
                  {walletModalState.user?.id}
                </p>
              </div>
              <button
                type="button"
                onClick={closeWalletConfirmModal}
                disabled={walletSubmitting}
                className="text-gray-500 hover:text-gray-700 disabled:opacity-60"
              >
                ×
              </button>
            </div>

            <div className="px-5 py-4 space-y-4">
              <p className="text-sm text-gray-700">
                Are you sure you want to{" "}
                <span
                  className={`font-semibold ${walletModalState.action === "debit" ? "text-rose-700" : "text-emerald-700"
                    }`}
                >
                  {walletModalState.action}
                </span>{" "}
                ₹{Number(walletForm.amount || 0).toFixed(2)} to this user?
              </p>

              <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-gray-500">Action</span>
                  <span className="font-semibold text-gray-900 capitalize">
                    {walletModalState.action}
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <span className="text-gray-500">Amount</span>
                  <span className="font-semibold text-gray-900">
                    ₹{Number(walletForm.amount || 0).toFixed(2)}
                  </span>
                </div>
                {walletForm.reason?.trim() && (
                  <div className="mt-2">
                    <span className="text-gray-500">Remark</span>
                    <p className="mt-1 text-gray-700">{walletForm.reason.trim()}</p>
                  </div>
                )}
              </div>

              <label className="flex items-start gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={walletConfirmState.acknowledged}
                  onChange={(event) =>
                    setWalletConfirmState((prev) => ({
                      ...prev,
                      acknowledged: event.target.checked,
                    }))
                  }
                  disabled={walletSubmitting}
                  className="mt-1 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                />
                <span>
                  I confirm that I want to{" "}
                  <span className="font-semibold capitalize">{walletModalState.action}</span> this
                  money to this user.
                </span>
              </label>

              {walletModalState.action === "credit" && (
                <div className="space-y-2">
                  <div className="text-xs font-medium uppercase tracking-wide text-gray-500">
                    Type this text to credit
                  </div>
                  <div className="rounded-lg border border-dashed border-emerald-300 bg-emerald-50 px-4 py-3 font-mono text-lg font-semibold tracking-[0.35em] text-emerald-700">
                    {walletConfirmState.captchaText || "CREDIT-XXXX"}
                  </div>
                  <input
                    type="text"
                    value={walletConfirmState.captchaInput}
                    onChange={(event) =>
                      setWalletConfirmState((prev) => ({
                        ...prev,
                        captchaInput: event.target.value,
                      }))
                    }
                    disabled={walletSubmitting}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    placeholder="Enter the text above"
                  />
                </div>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={closeWalletConfirmModal}
                  disabled={walletSubmitting}
                  className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm hover:bg-gray-50 disabled:opacity-60"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleWalletAdjustmentSubmit}
                  disabled={
                    walletSubmitting ||
                    !walletConfirmState.acknowledged ||
                    (walletModalState.action === "credit" &&
                      String(walletConfirmState.captchaInput || "").trim().toUpperCase() !==
                      String(walletConfirmState.captchaText || "").trim().toUpperCase())
                  }
                  className={`px-4 py-2 rounded-lg text-white text-sm font-medium disabled:opacity-60 ${walletModalState.action === "debit"
                    ? "bg-rose-600 hover:bg-rose-700"
                    : "bg-emerald-600 hover:bg-emerald-700"
                    }`}
                >
                  {walletSubmitting
                    ? "Processing..."
                    : walletModalState.action === "debit"
                      ? "Confirm Debit"
                      : "Confirm Credit"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <Modal
        isOpen={roleConfirmState.open}
        onClose={closeRoleConfirmModal}
        title="Confirm Access Role Change"
        className="max-w-md"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-700">
            Are you sure you want to change access role for{" "}
            <span className="font-semibold text-gray-900">
              {roleConfirmState.user?.name || "this employee"}
            </span>
            ?
          </p>

          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-2 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-gray-500">Current role</span>
              <span className="font-medium text-gray-900">{roleConfirmState.currentRoleName}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-gray-500">New role</span>
              <span className="font-medium text-primary">{roleConfirmState.nextRoleName}</span>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={closeRoleConfirmModal}
              disabled={Boolean(roleUpdatingUserId)}
              className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm hover:bg-gray-50 disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmEmployeeRoleChange}
              disabled={Boolean(roleUpdatingUserId)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 disabled:opacity-60"
            >
              {roleUpdatingUserId ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                "Confirm Change"
              )}
            </button>
          </div>
        </div>
      </Modal>

      {posModalState.open && (
        <Modal
          isOpen={posModalState.open}
          onClose={closePosModal}
          title={`Assigned POS machines — ${posModalState.user?.name || "User"}`}
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600">
                Showing page {posModalState.page} of {assignedPosResponse?.totalPages ?? 1}
                {assignedPosResponse?.totalItems != null && (
                  <span className="ml-2">({assignedPosResponse.totalItems} total)</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setPosModalState((prev) => ({
                      ...prev,
                      page: Math.max(1, prev.page - 1),
                    }))
                  }
                  disabled={posModalState.page <= 1}
                  className="rounded-md border border-gray-200 bg-white px-3 py-1 text-xs text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Prev
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setPosModalState((prev) => ({
                      ...prev,
                      page: Math.min(
                        assignedPosResponse?.totalPages ?? prev.page,
                        prev.page + 1
                      ),
                    }))
                  }
                  disabled={
                    posModalState.page >= (assignedPosResponse?.totalPages ?? posModalState.page)
                  }
                  className="rounded-md border border-gray-200 bg-white px-3 py-1 text-xs text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>

            {assignedPosLoading && <p>Loading POS machines...</p>}
            {assignedPosError && (
              <p className="text-sm text-red-600">Error: {assignedPosError.message}</p>
            )}

            {!assignedPosLoading && !assignedPosError && (
              <div className="overflow-x-auto">
                <Table
                  columns={[
                    { header: "SL", key: "sl" },
                    { header: "TID", key: "tid_number" },
                    { header: "MID", key: "mid_number" },
                    { header: "Serial", key: "device_serial_number" },
                    {
                      header: "Assign Date",
                      key: "assign_date_display",
                    },
                    {
                      header: "Status",
                      key: "status",
                      render: (status) => (
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-semibold ${status === "active"
                            ? "bg-green-100 text-green-800"
                            : "bg-red-100 text-red-800"
                            }`}
                        >
                          {status}
                        </span>
                      ),
                    },
                    { header: "Remarks", key: "remarks" },
                    { header: "Company", key: "company_name" },
                  ]}
                  data={(assignedPosResponse?.data ?? []).map((pos, index) => ({
                    ...pos,
                    sl: (posModalState.page - 1) * posModalState.limit + index + 1,
                    assign_date_display: formatAssignedPosMachineDate(
                      getAssignedPosMachineDate(pos)
                    ),
                  }))}
                />
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
};

export default AdminList;
