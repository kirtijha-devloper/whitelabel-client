import React, { useState, useMemo, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import {
  Users,
  Zap,
  Sliders,
  Search,
  CheckCircle2,
  RefreshCw,
  Info,
  ArrowRightLeft,
  AlertTriangle,
  CreditCard,
  ShieldCheck,
  Upload,
  FileSpreadsheet,
  Building2,
  ChevronDown,
  ChevronRight,
  UserCheck,
  Trash2,
  ArrowDownLeft,
  ArrowUpRight,
} from "lucide-react";
import Loader from "../components/Loader";
import {
  fetchPosSettings,
  updateCustomerT0Limit,
  updateUserSettlementType,
  bulkSetSettlementType,
} from "../api/posSettingApi";
import { AllUsers } from "../api/FranchiseApi";
import { getAllPosTransactionReport } from "../api/reportsApi";
import { extractUsersArray, getParentFranchiseId, normalizeUserRole } from "../utils/userAccess";
import { getServiceFlagValue } from "../utils/serviceFlags";
import { recordLimitAuditLog, calculateFranchisePoolStats, dispatchLimitChangeEvent, getUserTodayUtilized, setUserDailyLimit } from "../utils/userLimit";
import { clearAllTestTransactionData, getTodayDateKey, dispatchSettlementChangeEvent } from "../utils/userSettlement";
import { fetchServiceSettings } from "../api/serviceSettingsApi";
import { getSharedCcBillLimit } from "../api/sharedCcBillLimitApi";
import { useServiceSettingsPolling } from "../hooks/useServiceSettingsPolling";
import { hasAnyPermission, hasPermission } from "../utils/accessControl";

export default function PosSetting({ currentUser }) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef(null);

  const userRole = normalizeUserRole(currentUser?.role);
  const isAdmin = userRole === "admin";
  const isEmployee = userRole === "employee";
  const isSuperFranchise = userRole === "super_franchise";
  const isFranchise = userRole === "franchise";
  const canManageSettlement = isAdmin || hasPermission(currentUser, "settlement.manage");
  const canViewSettlement = isAdmin || hasAnyPermission(currentUser, ["settlement.read", "settlement.manage"]);
  const canReadServiceSettings = isAdmin || hasPermission(currentUser, "rate.settings.read");

  // Fetch global service settings with direct 5s polling for instant cross-tab disable/enable
  const { data: serviceSettingsData, refetch: refetchServiceSettings } = useQuery({
    queryKey: ["admin-service-settings"],
    queryFn: fetchServiceSettings,
    enabled: canReadServiceSettings,
    refetchInterval: 5000,
    staleTime: 3 * 1000,
    refetchOnWindowFocus: true,
  });

  useServiceSettingsPolling(canReadServiceSettings);

  const { data: sharedCcBillLimitResp } = useQuery({
    queryKey: ["sharedCcBillLimit", currentUser?.id],
    queryFn: () => getSharedCcBillLimit(),
    enabled: Boolean(isAdmin || isEmployee),
    staleTime: 10 * 1000,
    refetchInterval: 30 * 1000,
    refetchOnWindowFocus: true,
  });

  const { data: posTodayTxns } = useQuery({
    queryKey: ["posSettingTodayTxns", currentUser?.id],
    queryFn: async () => {
      const todayStr = getTodayDateKey();
      const rows = await getAllPosTransactionReport({ from_date: todayStr, to_date: todayStr }).catch(() => []);
      return rows || [];
    },
    staleTime: 5 * 1000,
    refetchInterval: 3000,
    refetchOnWindowFocus: true,
  });

  const todayPosT0Sum = useMemo(() => {
    if (!posTodayTxns || !Array.isArray(posTodayTxns)) return 0;
    let sum = 0;
    const curIdStr = String(currentUser?.id || "");
    const curAbheeId = String(currentUser?.abheepay_id || "");

    posTodayTxns.forEach((row) => {
      const rawSettlement = String(row?.settlement_type || "").trim().toLowerCase();
      const isT0 =
        rawSettlement.includes("today") ||
        rawSettlement.includes("t0") ||
        rawSettlement.includes("t+0") ||
        rawSettlement.includes("same_day") ||
        rawSettlement === "samedaysettlement";

      if (isT0) {
        const rowUId = String(row?.user_id || row?.merchant_id || row?.franchise_id || "");
        if (rowUId && (rowUId === curIdStr || rowUId === curAbheeId)) {
          const amt = Number(row?.amount || row?.txn_amount || row?.total_amount || 0);
          if (Number.isFinite(amt) && amt > 0) {
            sum += amt;
          }
        }
      }
    });
    return sum;
  }, [posTodayTxns, currentUser]);

  const getUserSpecificTodayT0Sum = (targetUser) => {
    if (!targetUser || !posTodayTxns || !Array.isArray(posTodayTxns)) return 0;
    let sum = 0;
    const uIdStr = String(targetUser.id || "");
    const uAbheeId = String(targetUser.abheepay_id || "");
    const uMobile = String(targetUser.mobile_number || targetUser.mobile || targetUser.username || "");

    const seenTxnKeys = new Set();

    posTodayTxns.forEach((row) => {
      const rawSettlement = String(row?.settlement_type || "").trim().toLowerCase();
      const isT0 =
        rawSettlement.includes("today") ||
        rawSettlement.includes("t0") ||
        rawSettlement.includes("t+0") ||
        rawSettlement.includes("same_day") ||
        rawSettlement === "samedaysettlement";

      if (isT0) {
        const rowUId = String(row?.user_id || row?.merchant_id || row?.franchise_id || "");
        const rowMobile = String(row?.mobile || row?.username || "");
        if (
          (rowUId && (rowUId === uIdStr || rowUId === uAbheeId)) ||
          (rowMobile && uMobile && rowMobile === uMobile)
        ) {
          const txnKey = String(
            row?.rrn ||
            row?.txn_id ||
            row?.reference_no ||
            row?.transaction_id ||
            `${row?.tid || ""}_${row?.mid || ""}_${row?.amount || ""}_${row?.created_at || row?.date || ""}`
          ).trim().toLowerCase();

          if (txnKey && seenTxnKeys.has(txnKey)) return;
          if (txnKey) seenTxnKeys.add(txnKey);

          const amt = Number(row?.amount || row?.txn_amount || row?.total_amount || 0);
          if (Number.isFinite(amt) && amt > 0) {
            sum += amt;
          }
        }
      }
    });
    console.log(`User ${targetUser?.id || targetUser?.abheepay_id || targetUser?.username || ""} utilized today: ₹${sum.toLocaleString("en-IN")}`);
    return sum;
  };

  const [searchTerm, setSearchTerm] = useState("");
  const [settlementFilter, setSettlementFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");
  const [expandedFranchiseMap, setExpandedFranchiseMap] = useState({});
  const [franchiseMerchantSearchMap, setFranchiseMerchantSearchMap] = useState({});
  const [editingLimitMap, setEditingLimitMap] = useState({});
  const [isProcessingExcel, setIsProcessingExcel] = useState(false);

  // Pre-Save & Post-Save Confirmation Modal States
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: "",
    message: "",
    user: null,
    previousState: "",
    newState: "",
    actionType: "", // "LIMIT" | "SETTLEMENT" | "BULK"
    onConfirm: null,
  });

  const [successModal, setSuccessModal] = useState({
    isOpen: false,
    title: "",
    message: "",
    userName: "",
    changeSummary: "",
  });

  // Excel Upload Preview Modal State
  const [excelPreviewModal, setExcelPreviewModal] = useState({
    isOpen: false,
    fileName: "",
    totalRowsCount: 0,
    matchedRows: [],
    unmatchedRowsCount: 0,
    unmatchedRowsDetails: [],
  });

  // Fetch POS Settings Data (Auto-polls every 3 seconds for instant live updates)
  const { data: posData, isLoading: isPosLoading, error: posError, refetch: refetchPos } = useQuery({
    queryKey: ["posSettings"],
    queryFn: fetchPosSettings,
    refetchInterval: 3000,
    refetchOnWindowFocus: true,
  });

  const posSettlementEnabled =
    posData?.data?.summary?.is_pos_t0_settlement_enabled ??
    posData?.stats?.is_pos_t0_settlement_enabled;
  const serviceSettingsForPos = canReadServiceSettings
    ? serviceSettingsData
    : { pos_t0_settlement: posSettlementEnabled };
  const isPosServiceActive = getServiceFlagValue(serviceSettingsForPos, "pos_t0_settlement", true);

  // Fetch All Users List from System (Auto-polls every 3 seconds)
  const { data: allUsersData, isLoading: isUsersLoading, error: usersError, refetch: refetchUsers } = useQuery({
    queryKey: ["allUsersListForPosSetting"],
    queryFn: () => AllUsers({ limit: 1000 }),
    enabled: !isEmployee,
    refetchInterval: 3000,
    refetchOnWindowFocus: true,
  });

  const refetchAll = () => {
    refetchPos();
    refetchUsers();
  };

  useEffect(() => {
    try {
      localStorage.removeItem("pos_user_overrides_map");
      localStorage.removeItem("user_daily_payout_limits");
      localStorage.removeItem("global_pos_t0_settlement_active");
    } catch {}

    const channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("pos_limits_channel") : null;
    if (channel) {
      channel.onmessage = () => {
        refetchPos();
        refetchUsers();
        queryClient.invalidateQueries({ queryKey: ["admin-service-settings"] });
      };
    }

    const handleStorage = () => {
      refetchPos();
      refetchUsers();
      queryClient.invalidateQueries({ queryKey: ["admin-service-settings"] });
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener("userDailyLimitUpdated", handleStorage);
    window.addEventListener("userSettlementUpdated", handleStorage);

    return () => {
      if (channel) channel.close();
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("userDailyLimitUpdated", handleStorage);
      window.removeEventListener("userSettlementUpdated", handleStorage);
    };
  }, [refetchPos, refetchUsers]);

  // Update Customer T0 Limit Mutation
  // Update Customer T0 Limit Mutation
  const updateLimitMutation = useMutation({
    mutationFn: ({ id, t0_daily_limit }) => updateCustomerT0Limit(id, t0_daily_limit),
    onMutate: async (variables) => {
      const targetId = variables?.id;
      const newLimitNum =
        variables?.t0_daily_limit !== "" && variables?.t0_daily_limit !== null && variables?.t0_daily_limit !== undefined
          ? Number(variables.t0_daily_limit)
          : null;
      const newLimitStr = newLimitNum !== null ? String(newLimitNum) : null;

      // 1. Immediately remove from editingLimitMap so UI switches out of edit mode instantly
      if (targetId) {
        setEditingLimitMap((prev) => {
          const next = { ...prev };
          delete next[targetId];
          return next;
        });
      }

      // 2. Snapshot previous values for rollback on error
      const previousPosData = queryClient.getQueryData(["posSettings"]);
      const previousUsersData = queryClient.getQueryData(["allUsersListForPosSetting"]);

      // 3. Instant optimistic cache update for posSettings
      queryClient.setQueryData(["posSettings"], (old) => {
        if (!old) return old;
        const updateList = (list) =>
          Array.isArray(list)
            ? list.map((item) =>
                Number(item.id) === Number(targetId)
                  ? { ...item, t0_daily_limit: newLimitStr }
                  : item
              )
            : list;

        return {
          ...old,
          data: {
            ...old.data,
            customers: updateList(old.data?.customers),
            merchants: updateList(old.data?.merchants),
          },
          customers: updateList(old.customers),
        };
      });

      // 4. Instant optimistic cache update for allUsersListForPosSetting
      queryClient.setQueryData(["allUsersListForPosSetting"], (old) => {
        if (!old) return old;
        if (Array.isArray(old)) {
          return old.map((u) =>
            Number(u.id) === Number(targetId) ? { ...u, t0_daily_limit: newLimitStr } : u
          );
        }
        if (old.data && Array.isArray(old.data)) {
          return {
            ...old,
            data: old.data.map((u) =>
              Number(u.id) === Number(targetId) ? { ...u, t0_daily_limit: newLimitStr } : u
            ),
          };
        }
        if (old.users && Array.isArray(old.users)) {
          return {
            ...old,
            users: old.users.map((u) =>
              Number(u.id) === Number(targetId) ? { ...u, t0_daily_limit: newLimitStr } : u
            ),
          };
        }
        return old;
      });

      return { previousPosData, previousUsersData, targetId };
    },
    onSuccess: (data, variables) => {
      toast.success(data?.message || "T0 daily limit updated successfully!");

      const targetId = variables?.id;
      const newLimitNum =
        variables?.t0_daily_limit !== "" && variables?.t0_daily_limit !== null && variables?.t0_daily_limit !== undefined
          ? Number(variables.t0_daily_limit)
          : null;
      const newLimitStr = newLimitNum !== null ? String(newLimitNum) : null;

      // Keep confirmed value in cache
      queryClient.setQueryData(["posSettings"], (old) => {
        if (!old) return old;
        const updateList = (list) =>
          Array.isArray(list)
            ? list.map((item) =>
                Number(item.id) === Number(targetId)
                  ? { ...item, t0_daily_limit: newLimitStr }
                  : item
              )
            : list;

        return {
          ...old,
          data: {
            ...old.data,
            customers: updateList(old.data?.customers),
            merchants: updateList(old.data?.merchants),
          },
          customers: updateList(old.customers),
        };
      });

      queryClient.setQueryData(["allUsersListForPosSetting"], (old) => {
        if (!old) return old;
        if (Array.isArray(old)) {
          return old.map((u) =>
            Number(u.id) === Number(targetId) ? { ...u, t0_daily_limit: newLimitStr } : u
          );
        }
        if (old.data && Array.isArray(old.data)) {
          return {
            ...old,
            data: old.data.map((u) =>
              Number(u.id) === Number(targetId) ? { ...u, t0_daily_limit: newLimitStr } : u
            ),
          };
        }
        if (old.users && Array.isArray(old.users)) {
          return {
            ...old,
            users: old.users.map((u) =>
              Number(u.id) === Number(targetId) ? { ...u, t0_daily_limit: newLimitStr } : u
            ),
          };
        }
        return old;
      });

      queryClient.invalidateQueries({ queryKey: ["posSettings"] });
      queryClient.invalidateQueries({ queryKey: ["allUsersListForPosSetting"] });
      queryClient.invalidateQueries({ queryKey: ["allUsers"] });
      queryClient.invalidateQueries({ queryKey: ["userSearch"] });
      queryClient.invalidateQueries({ queryKey: ["currentUser"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (error, variables, context) => {
      if (context?.previousPosData) {
        queryClient.setQueryData(["posSettings"], context.previousPosData);
      }
      if (context?.previousUsersData) {
        queryClient.setQueryData(["allUsersListForPosSetting"], context.previousUsersData);
      }
      toast.error(error?.message || "Failed to update T0 limit");
    },
  });

  // Update Single User Settlement Type Toggle Mutation
  const updateSettlementMutation = useMutation({
    mutationFn: ({ id, settlement_type }) => updateUserSettlementType(id, settlement_type),
    onSuccess: (data, variables) => {
      toast.success(data?.message || `Settlement mode updated to ${variables.settlement_type}!`);
      queryClient.invalidateQueries({ queryKey: ["posSettings"] });
      queryClient.invalidateQueries({ queryKey: ["allUsersListForPosSetting"] });
      queryClient.invalidateQueries({ queryKey: ["allUsers"] });
      queryClient.invalidateQueries({ queryKey: ["userSearch"] });
      queryClient.invalidateQueries({ queryKey: ["currentUser"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      refetchPos();
      refetchUsers();
      dispatchLimitChangeEvent();
      dispatchSettlementChangeEvent();
    },
    onError: (error) => {
      toast.error(error?.message || "Failed to update settlement mode");
    },
  });

  // Bulk Settlement Type Mutation
  const bulkSettlementMutation = useMutation({
    mutationFn: (settlementType) => bulkSetSettlementType(settlementType),
    onSuccess: (data, variables) => {
      toast.success(data?.message || `All users updated to ${variables} settlement mode`);
      queryClient.invalidateQueries({ queryKey: ["posSettings"] });
      queryClient.invalidateQueries({ queryKey: ["allUsersListForPosSetting"] });
      queryClient.invalidateQueries({ queryKey: ["allUsers"] });
      queryClient.invalidateQueries({ queryKey: ["userSearch"] });
      queryClient.invalidateQueries({ queryKey: ["currentUser"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      refetchPos();
      refetchUsers();
      dispatchLimitChangeEvent();
      dispatchSettlementChangeEvent();
    },
    onError: (error) => {
      toast.error(error?.message || "Failed to update bulk settlement type");
    },
  });

  const rawUsersList = useMemo(() => {
    const fromPos = Array.isArray(posData?.data?.customers)
      ? posData.data.customers
      : Array.isArray(posData?.customers)
        ? posData.customers
        : [];
    const fromAllUsers = extractUsersArray(allUsersData);

    const baseList = isEmployee ? fromPos : fromAllUsers.length > 0 ? fromAllUsers : fromPos;
    const posMap = new Map(fromPos.map((item) => [String(item.id), item]));

    // Exclude admin, superadmin, subadmin, employee, and staff accounts completely from Settlement Page
    const filteredBaseList = baseList.filter((u) => {
      const r = String(u.role || "").toLowerCase();
      return (
        r !== "admin" &&
        r !== "superadmin" &&
        r !== "subadmin" &&
        r !== "employee" &&
        r !== "staff"
      );
    });

    return filteredBaseList.map((u) => {
      const posItem = posMap.get(String(u.id)) || {};

      return {
        ...u,
        settlement_type: posItem.settlement_type ?? u.settlement_type ?? "T0",
        t0_daily_limit:
          posItem.t0_daily_limit !== undefined
            ? posItem.t0_daily_limit
            : (u.t0_daily_limit ?? null),
      };
    });
  }, [posData?.data?.customers, posData?.customers, allUsersData, isEmployee]);

  // Map of Franchise ID -> array of child Merchants
  const franchiseMerchantsMap = useMemo(() => {
    const map = new Map();
    rawUsersList.forEach((u) => {
      const uRole = normalizeUserRole(u.role);
      if (uRole === "admin" || uRole === "super_franchise" || uRole === "franchise" || uRole === "employee" || uRole === "staff") return;
      const parentId = getParentFranchiseId(u);
      if (parentId) {
        const key = String(parentId);
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(u);
      }
    });
    return map;
  }, [rawUsersList]);

  // Map of Super Franchise ID -> array of child Franchises
  const superFranchiseChildrenMap = useMemo(() => {
    const map = new Map();
    rawUsersList.forEach((u) => {
      const uRole = normalizeUserRole(u.role);
      if (uRole !== "franchise") return;
      const sfId =
        u?.super_franchise_id ??
        u?.superFranchiseId ??
        u?.super_franchise_details?.id ??
        null;
      if (sfId) {
        const key = String(sfId);
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(u);
      }
    });
    return map;
  }, [rawUsersList]);

  // Hierarchical Scoped User List (Excluding Admin and Employee roles)
  const scopedUsersList = useMemo(() => {
    if (isSuperFranchise) {
      const currentSfId = Number(currentUser?.id);
      // Directly show the Franchises belonging to this Super Franchise
      return rawUsersList.filter((u) => {
        const uRole = normalizeUserRole(u.role);
        if (uRole !== "franchise") return false;
        const sfId =
          u?.super_franchise_id ??
          u?.superFranchiseId ??
          u?.super_franchise_details?.id ??
          null;
        return Number(sfId) === currentSfId || String(u.super_franchise_id) === String(currentUser?.id);
      });
    }

    if (isFranchise) {
      const currentFranchiseId = Number(currentUser?.id);
      return rawUsersList.filter((u) => {
        const uRole = normalizeUserRole(u.role);
        if (
          uRole === "admin" ||
          uRole === "super_franchise" ||
          uRole === "superadmin" ||
          uRole === "subadmin" ||
          uRole === "employee" ||
          uRole === "staff" ||
          uRole === "franchise"
        ) {
          return false;
        }
        const parentId = getParentFranchiseId(u);
        return (
          parentId === currentFranchiseId ||
          String(u.franchise_id) === String(currentUser?.id) ||
          String(u.parent_id) === String(currentUser?.id)
        );
      });
    }

    if (isAdmin || isEmployee) {
      // Direct admin/employee children: Super Franchises + standalone Franchises + Direct Merchants
      return rawUsersList.filter((u) => {
        const uRole = normalizeUserRole(u.role);
        if (
          uRole === "admin" ||
          uRole === "superadmin" ||
          uRole === "subadmin" ||
          uRole === "employee" ||
          uRole === "staff"
        ) {
          return false;
        }
        if (uRole === "super_franchise") return true;
        if (uRole === "franchise") {
          const sfId = u?.super_franchise_id ?? u?.superFranchiseId ?? u?.super_franchise_details?.id ?? null;
          return !sfId;
        }
        const parentId = getParentFranchiseId(u);
        return parentId === null;
      });
    }

    return rawUsersList.filter((u) => {
      const uRole = normalizeUserRole(u.role);
      return (
        uRole !== "admin" &&
        uRole !== "superadmin" &&
        uRole !== "subadmin" &&
        uRole !== "employee" &&
        uRole !== "staff"
      );
    });
  }, [rawUsersList, isSuperFranchise, isFranchise, isAdmin, isEmployee, currentUser?.id]);

  const stats = useMemo(() => {
    const total = scopedUsersList.length;
    let t0Count = 0;
    let t1Count = 0;
    let limitConfigured = 0;

    scopedUsersList.forEach((c) => {
      const mode = String(c.settlement_type || "T0").toUpperCase();
      if (mode === "T1") t1Count += 1;
      else t0Count += 1;

      if (c.t0_daily_limit !== null && c.t0_daily_limit !== undefined && c.t0_daily_limit !== "") {
        limitConfigured += 1;
      }
    });

    return {
      total_customers: total,
      t0_active_count: t0Count,
      t1_active_count: t1Count,
      t0_limit_configured_count: limitConfigured,
    };
  }, [scopedUsersList]);

  const filteredUsers = useMemo(() => {
    return scopedUsersList.filter((cust) => {
      const name = String(cust?.name || cust?.full_name || cust?.business_name || "").toLowerCase();
      const username = String(cust?.username || cust?.user_id || cust?.mobile_number || cust?.mobile || cust?.email || "").toLowerCase();
      const roleStr = String(cust?.role || "").toLowerCase();
      const term = searchTerm.toLowerCase().trim();

      let matchesSearch = !term || name.includes(term) || username.includes(term) || roleStr.includes(term);

      // If cust is a franchise, check if any of its child merchants match search
      if (!matchesSearch && term && roleStr === "franchise") {
        const childMerchants = franchiseMerchantsMap.get(String(cust.id)) || [];
        matchesSearch = childMerchants.some((m) => {
          const mName = String(m.name || m.full_name || m.business_name || "").toLowerCase();
          const mUser = String(m.username || m.mobile_number || m.mobile || m.email || "").toLowerCase();
          return mName.includes(term) || mUser.includes(term);
        });
      }

      // If cust is a super_franchise, check if any of its child franchises match search
      if (!matchesSearch && term && roleStr === "super_franchise") {
        const childFranchises = superFranchiseChildrenMap.get(String(cust.id)) || [];
        matchesSearch = childFranchises.some((f) => {
          const fName = String(f.name || f.full_name || f.business_name || "").toLowerCase();
          const fUser = String(f.username || f.mobile_number || f.mobile || f.email || "").toLowerCase();
          return fName.includes(term) || fUser.includes(term);
        });
      }

      const rawSettlement = String(cust?.settlement_type || "T0").toUpperCase();
      const rawLimit = cust?.t0_daily_limit;
      const isLimitSet = rawLimit !== null && rawLimit !== undefined && rawLimit !== "";
      const isZeroLimit = isLimitSet && Number(rawLimit) === 0;
      const isUnassignedLimit = !isLimitSet;

      const effectiveSettlement = rawSettlement === "T1" || isZeroLimit || isUnassignedLimit ? "T1" : "T0";

      const matchesSettlementFilter =
        settlementFilter === "all" ||
        (settlementFilter === "T0" && effectiveSettlement === "T0") ||
        (settlementFilter === "T1" && effectiveSettlement === "T1") ||
        (settlementFilter === "limit_configured" && isLimitSet);

      const matchesRoleFilter =
        roleFilter === "all" ||
        roleStr === roleFilter.toLowerCase();

      return matchesSearch && matchesSettlementFilter && matchesRoleFilter;
    });
  }, [scopedUsersList, searchTerm, settlementFilter, roleFilter, franchiseMerchantsMap, superFranchiseChildrenMap]);

  const toggleFranchiseExpand = (franchiseId) => {
    setExpandedFranchiseMap((prev) => ({
      ...prev,
      [franchiseId]: !prev[franchiseId],
    }));
  };

  const handleLimitInputChange = (customerId, value) => {
    const sanitized = value === "" ? "" : String(value).replace(/\D/g, "");
    setEditingLimitMap((prev) => ({
      ...prev,
      [customerId]: sanitized,
    }));
  };

  const franchiseSelfPoolStats = useMemo(() => {
    if (!isFranchise && !isSuperFranchise) return null;
    const parentUser = rawUsersList.find((u) => Number(u.id) === Number(currentUser?.id)) || currentUser;
    const pUsed = getUserTodayUtilized(parentUser?.id, parentUser, getUserSpecificTodayT0Sum(parentUser));
    return calculateFranchisePoolStats(parentUser, scopedUsersList, pUsed);
  }, [isFranchise, isSuperFranchise, rawUsersList, currentUser, scopedUsersList, posTodayTxns]);

  const adminLimitsStats = useMemo(() => {
    if (!isAdmin && !isEmployee) return null;

    const backendAdminLimits = posData?.data?.admin_limits;

    const rawPayinLimit =
      backendAdminLimits?.payin_limit !== undefined && backendAdminLimits?.payin_limit !== null
        ? backendAdminLimits.payin_limit
        : (currentUser?.t0_daily_limit !== undefined && currentUser?.t0_daily_limit !== null
            ? currentUser.t0_daily_limit
            : backendAdminLimits?.payin_limit);

    const isPayinNotSet =
      rawPayinLimit === null || rawPayinLimit === undefined || rawPayinLimit === "";
    const isPayinUnlimited =
      !isPayinNotSet && String(rawPayinLimit).toLowerCase() === "unlimited";
    const payinLimitNum =
      !isPayinNotSet && !isPayinUnlimited ? Number(rawPayinLimit) || 0 : null;

    const payoutLimitNum =
      backendAdminLimits?.payout_limit !== undefined
        ? Number(backendAdminLimits.payout_limit) || 0
        : Number(currentUser?.payout_limit ?? currentUser?.company?.payout_limit) || 0;

    const ccBillLimitNum =
      sharedCcBillLimitResp?.data?.daily_limit !== undefined && sharedCcBillLimitResp?.data?.daily_limit !== null
        ? Number(sharedCcBillLimitResp.data.daily_limit) || 0
        : backendAdminLimits?.cc_bill_limit !== undefined
        ? Number(backendAdminLimits.cc_bill_limit) || 0
        : Number(currentUser?.bill_payment_limit ?? currentUser?.company?.bill_payment_limit) || 0;

    // Calculate total allocated to top-level scoped users under Admin (Super Franchise, Standalone Franchise, Direct Merchant)
    let allocatedToUsers = 0;
    scopedUsersList.forEach((u) => {
      const l = Number(u.t0_daily_limit);
      if (Number.isFinite(l) && l > 0) {
        allocatedToUsers += l;
      }
    });

    const remainingPayin = isPayinNotSet
      ? null
      : isPayinUnlimited
      ? "unlimited"
      : Math.max(0, (payinLimitNum || 0) - allocatedToUsers);

    return {
      isPayinNotSet,
      isPayinUnlimited,
      payinLimit: isPayinNotSet ? null : isPayinUnlimited ? "unlimited" : payinLimitNum,
      payoutLimit: payoutLimitNum,
      ccBillLimit: ccBillLimitNum,
      allocatedToUsers,
      remainingPayin,
    };
  }, [isAdmin, isEmployee, posData?.data?.admin_limits, currentUser, scopedUsersList, sharedCcBillLimitResp]);

  const executeSaveCustomerLimit = (customer, valToSave, finalLimitVal, previousState, newState) => {
    recordLimitAuditLog({
      performingUser: currentUser,
      affectedUser: customer,
      previousState,
      newState,
      action: "LIMIT_SET",
      serviceKey: "user_daily_limit",
    });

    updateLimitMutation.mutate({
      id: customer.id,
      t0_daily_limit: valToSave,
    });
  };

  const handleSaveCustomerLimit = (customer) => {
    const rawVal = editingLimitMap[customer.id];
    const valToSave = rawVal !== undefined ? rawVal : customer.t0_daily_limit;
    const finalLimitVal = valToSave !== "" && valToSave !== null && valToSave !== undefined ? Math.floor(Number(valToSave)) : null;

    // Validate that limit cannot be reduced below what the user has already utilized/processed in T0 today
    const customerUsedToday = getUserTodayUtilized(customer.id, customer, getUserSpecificTodayT0Sum(customer));
    const proposedLimitNum = finalLimitVal !== null ? Number(finalLimitVal) : 0;
    if (customerUsedToday > 0 && proposedLimitNum < customerUsedToday) {
      const nameStr = customer.name || customer.full_name || customer.business_name || `User #${customer.id}`;
      const rStr = String(customer.role || "").toLowerCase();
      const roleLabel =
        rStr === "super_franchise" || rStr === "superfranchise"
          ? "Super Franchise"
          : rStr === "franchise" || rStr === "franchaise"
          ? "Franchise"
          : rStr === "employee" || rStr === "staff"
          ? "Employee"
          : "Merchant";
      toast.error(
        `Cannot reduces limit of ${nameStr} to ₹${proposedLimitNum.toLocaleString("en-IN")}! ${roleLabel} has already used ₹${customerUsedToday.toLocaleString("en-IN")} in T0 today. Minimum limit allowed is ₹${customerUsedToday.toLocaleString("en-IN")}.`
      );
      return;
    }

    const roleStr = String(customer.role || "").toLowerCase();
    const isSuperFranchiseRole = roleStr === "super_franchise" || roleStr === "superfranchise";
    const isFranchiseRole = roleStr === "franchise" || roleStr === "franchaise";

    // Helper to get all downstream users (franchises, employees, staff) belonging to a Super Franchise
    const getDownstreamUsersForSuperFranchise = (sfId) => {
      const sfIdStr = String(sfId);
      const userMap = new Map();

      const allRaw = extractUsersArray(allUsersData);
      allRaw.forEach((u) => {
        if (u && u.id) userMap.set(String(u.id), u);
      });
      rawUsersList.forEach((u) => {
        if (u && u.id) userMap.set(String(u.id), { ...(userMap.get(String(u.id)) || {}), ...u });
      });

      const children = [];
      userMap.forEach((u) => {
        if (String(u.id) === sfIdStr) return;
        const uRole = normalizeUserRole(u.role);
        if (uRole === "admin" || uRole === "superadmin" || uRole === "super_franchise") return;

        const uSfId =
          u?.super_franchise_id ??
          u?.superFranchiseId ??
          u?.super_franchise_details?.id ??
          (u?.parent_id ? String(u.parent_id) : null);

        if (String(uSfId) === sfIdStr) {
          children.push(u);
        }
      });
      return children;
    };

    // 0. Validate against Admin Payin Limit pool (for top-level accounts: Super Franchise, Standalone Franchise, Direct Merchant)
    if (isAdmin || isEmployee) {
      const isTopLevelAccount =
        isSuperFranchiseRole ||
        (isFranchiseRole && !customer?.super_franchise_id && !customer?.superFranchiseId) ||
        (!isSuperFranchiseRole && !isFranchiseRole && !getParentFranchiseId(customer) && !customer?.super_franchise_id);

      if (isTopLevelAccount) {
        const rawAdminPayin = adminLimitsStats?.payinLimit;
        const isPayinNotSet = adminLimitsStats?.isPayinNotSet;
        const isPayinUnlimited = adminLimitsStats?.isPayinUnlimited;
        const proposedVal = finalLimitVal !== null ? Number(finalLimitVal) : 0;

        if (isPayinNotSet && proposedVal > 0) {
          toast.error(
            "Cannot assign T0 limit! Admin has no Payin (T0) limit pool assigned by Super Admin (Not Set / ₹0). Super Admin must assign a Payin limit first."
          );
          return;
        }

        if (!isPayinNotSet && !isPayinUnlimited) {
          const adminPool = Number(rawAdminPayin) || 0;
          if (adminPool <= 0 && proposedVal > 0) {
            toast.error(
              "Cannot assign T0 limit! Admin Payin limit is ₹0. Super Admin must increase Admin's Payin limit first."
            );
            return;
          }

          let otherTopLevelAllocated = 0;
          scopedUsersList.forEach((u) => {
            if (String(u.id) !== String(customer.id)) {
              const l = Number(u.t0_daily_limit);
              if (Number.isFinite(l) && l > 0) {
                otherTopLevelAllocated += l;
              }
            }
          });

          const maxAvailableFromAdmin = Math.max(0, adminPool - otherTopLevelAllocated);

          if (proposedVal > maxAvailableFromAdmin) {
            toast.error(
              `Admin Payin limit pool (₹${adminPool.toLocaleString("en-IN")}) exceeded! Total allocated limit (₹${(otherTopLevelAllocated + proposedVal).toLocaleString("en-IN")}) cannot exceed Admin Payin limit. Maximum available limit to assign is ₹${maxAvailableFromAdmin.toLocaleString("en-IN")}.`
            );
            return;
          }
        }
      }
    }

    // 1. Validate if updated user IS a Super Franchise:
    // Admin cannot reduce Super Franchise limit below (total allocated to child franchises + employees combined + self-utilized)
    if (isSuperFranchiseRole) {
      const downstreamChildren = getDownstreamUsersForSuperFranchise(customer.id);
      let totalAllocatedToFranchises = 0;
      let totalAllocatedToEmployees = 0;
      let totalAllocatedToOthers = 0;

      downstreamChildren.forEach((child) => {
        const cLimit = Number(child.t0_daily_limit);
        if (Number.isFinite(cLimit) && cLimit > 0) {
          const cRole = normalizeUserRole(child.role);
          if (cRole === "franchise") {
            totalAllocatedToFranchises += cLimit;
          } else if (cRole === "employee" || cRole === "staff") {
            totalAllocatedToEmployees += cLimit;
          } else {
            totalAllocatedToOthers += cLimit;
          }
        }
      });

      const totalDownstreamAllocated = totalAllocatedToFranchises + totalAllocatedToEmployees + totalAllocatedToOthers;
      const totalCommittedSuperFranchise = totalDownstreamAllocated + customerUsedToday;
      const proposedPool = finalLimitVal !== null ? Number(finalLimitVal) : 0;

      if (proposedPool < totalCommittedSuperFranchise) {
        const nameStr = customer.name || customer.full_name || customer.business_name || `Super Franchise #${customer.id}`;
        const details = [];
        if (totalAllocatedToFranchises > 0) {
          details.push(`allocated ₹${totalAllocatedToFranchises.toLocaleString("en-IN")} to child franchises`);
        }
        if (totalAllocatedToEmployees > 0) {
          details.push(`allocated ₹${totalAllocatedToEmployees.toLocaleString("en-IN")} to employees`);
        }
        if (totalAllocatedToOthers > 0) {
          details.push(`allocated ₹${totalAllocatedToOthers.toLocaleString("en-IN")} to downstream accounts`);
        }
        if (customerUsedToday > 0) {
          details.push(`self-utilized ₹${customerUsedToday.toLocaleString("en-IN")} in T0 today`);
        }
        const reasonText = details.length > 0 ? details.join(" and ") : "committed funds";

        toast.error(
          `Cannot reduce limit of ${nameStr} to ₹${proposedPool.toLocaleString("en-IN")}! Super Franchise has ${reasonText} (Total committed: ₹${totalCommittedSuperFranchise.toLocaleString("en-IN")}). Minimum limit allowed is ₹${totalCommittedSuperFranchise.toLocaleString("en-IN")}.`
        );
        return;
      }
    }

    // 2. Validate if updated user IS a Franchise:
    // Admin / Super Franchise cannot reduce Franchise limit below (total allocated to merchants + self-utilized)
    if (isFranchiseRole) {
      const childMerchants = franchiseMerchantsMap.get(String(customer.id)) || [];
      let totalAllocatedToMerchants = 0;
      childMerchants.forEach((m) => {
        const mLimit = Number(m.t0_daily_limit);
        if (Number.isFinite(mLimit) && mLimit > 0) {
          totalAllocatedToMerchants += mLimit;
        }
      });

      const totalCommittedFranchise = totalAllocatedToMerchants + customerUsedToday;
      const proposedPool = finalLimitVal !== null ? Number(finalLimitVal) : 0;

      if (proposedPool < totalCommittedFranchise) {
        const nameStr = customer.name || customer.full_name || `Franchise #${customer.id}`;
        const details = [];
        if (totalAllocatedToMerchants > 0) {
          details.push(`allocated ₹${totalAllocatedToMerchants.toLocaleString("en-IN")} to downstream merchants`);
        }
        if (customerUsedToday > 0) {
          details.push(`self-utilized ₹${customerUsedToday.toLocaleString("en-IN")} in T0 today`);
        }
        const reasonText = details.length > 0 ? details.join(" and ") : "committed funds";

        toast.error(
          `Cannot reduce limit of ${nameStr} to ₹${proposedPool.toLocaleString("en-IN")}! Franchise has ${reasonText} (Total committed: ₹${totalCommittedFranchise.toLocaleString("en-IN")}). Minimum limit allowed is ₹${totalCommittedFranchise.toLocaleString("en-IN")}.`
        );
        return;
      }
    }

    // 3. Validate sub-allocation against Super Franchise assigned pool (if customer is a Franchise or Employee under a Super Franchise)
    const sfParentId =
      customer?.super_franchise_id ??
      customer?.superFranchiseId ??
      customer?.super_franchise_details?.id ??
      (isSuperFranchise ? Number(currentUser?.id) : null);
    const parentSuperFranchiseId =
      !isSuperFranchiseRole && sfParentId ? Number(sfParentId) : null;

    if (parentSuperFranchiseId && String(customer.id) !== String(parentSuperFranchiseId)) {
      const parentSuperFranchise =
        rawUsersList.find((u) => Number(u.id) === Number(parentSuperFranchiseId)) ||
        extractUsersArray(allUsersData).find((u) => Number(u.id) === Number(parentSuperFranchiseId)) ||
        (Number(currentUser?.id) === Number(parentSuperFranchiseId) ? currentUser : null);
      const rawParentSfLimit = parentSuperFranchise?.t0_daily_limit;

      const isParentSfNotSet =
        rawParentSfLimit === null ||
        rawParentSfLimit === undefined ||
        rawParentSfLimit === "";
      const isParentSfZero = !isParentSfNotSet && Number(rawParentSfLimit) === 0;
      const isParentSfUnlimited =
        !isParentSfNotSet && String(rawParentSfLimit).toLowerCase() === "unlimited";

      const proposedVal = finalLimitVal !== null ? Number(finalLimitVal) : 0;

      if ((isParentSfNotSet || isParentSfZero) && proposedVal > 0) {
        const sfName = parentSuperFranchise?.name || parentSuperFranchise?.full_name || parentSuperFranchise?.business_name || `Super Franchise #${parentSuperFranchiseId}`;
        toast.error(
          `Cannot assign limit! ${sfName} has no T0 Daily Limit pool assigned by Admin (Not Set / ₹0). Admin must assign a T0 Limit pool to Super Franchise first.`
        );
        return;
      }

      if (!isParentSfUnlimited && !isParentSfNotSet && !isParentSfZero) {
        const parentSfTotalPool = Number(rawParentSfLimit) || 0;

        if (proposedVal > parentSfTotalPool) {
          const sfName = parentSuperFranchise?.name || parentSuperFranchise?.full_name || parentSuperFranchise?.business_name || `Super Franchise #${parentSuperFranchiseId}`;
          const childRole = normalizeUserRole(customer.role);
          const childRoleLabel = childRole === "employee" ? "employee" : "franchise";
          toast.error(
            `Limit pool of ${sfName} (₹${parentSfTotalPool.toLocaleString("en-IN")}) exceeded! ${childRoleLabel.charAt(0).toUpperCase() + childRoleLabel.slice(1)} limit (₹${proposedVal.toLocaleString("en-IN")}) cannot exceed Super Franchise limit (₹${parentSfTotalPool.toLocaleString("en-IN")}).`
          );
          return;
        }

        const downstreamChildren = getDownstreamUsersForSuperFranchise(parentSuperFranchiseId);

        let otherChildrenAllocatedSum = 0;
        downstreamChildren.forEach((child) => {
          if (String(child.id) !== String(customer.id)) {
            const cLimit = Number(child.t0_daily_limit);
            if (Number.isFinite(cLimit) && cLimit > 0) {
              otherChildrenAllocatedSum += cLimit;
            }
          }
        });

        const parentSfUsedToday = getUserTodayUtilized(parentSuperFranchiseId, parentSuperFranchise, getUserSpecificTodayT0Sum(parentSuperFranchise));
        console.log("parent use -> ",parentSfUsedToday);
        const maxAvailableForThisChild = Math.max(0, parentSfTotalPool - otherChildrenAllocatedSum - parentSfUsedToday);

        if (proposedVal > maxAvailableForThisChild) {
          const sfName = parentSuperFranchise?.name || parentSuperFranchise?.full_name || parentSuperFranchise?.business_name || `Super Franchise #${parentSuperFranchiseId}`;
          const usedText = parentSfUsedToday > 0 ? ` (Parent Super Franchise has already used ₹${parentSfUsedToday.toLocaleString("en-IN")} today)` : "";
          const childRole = normalizeUserRole(customer.role);
          const childRoleLabel = childRole === "employee" ? "employee" : "franchise";
          toast.error(
            `Limit pool of ${sfName} (₹${parentSfTotalPool.toLocaleString("en-IN")}) exceeded!${usedText} Maximum limit available to assign to this ${childRoleLabel} is ₹${maxAvailableForThisChild.toLocaleString("en-IN")}.`
          );
          return;
        }
      }
    }

    // 4. Validate sub-allocation against Franchise and Super Franchise assigned pools (for Merchant)
    const isMerchantRole = !isFranchiseRole && !isSuperFranchiseRole;
    if (isMerchantRole) {
      const parentFranchiseId = getParentFranchiseId(customer) || (isFranchise ? Number(currentUser?.id) : null);
      const parentFranchise = parentFranchiseId
        ? rawUsersList.find((u) => Number(u.id) === Number(parentFranchiseId)) ||
          extractUsersArray(allUsersData).find((u) => Number(u.id) === Number(parentFranchiseId)) ||
          (Number(currentUser?.id) === Number(parentFranchiseId) ? currentUser : null)
        : null;

      const merchantSuperFranchiseId =
        customer?.super_franchise_id ??
        customer?.superFranchiseId ??
        customer?.super_franchise_details?.id ??
        parentFranchise?.super_franchise_id ??
        parentFranchise?.superFranchiseId ??
        parentFranchise?.super_franchise_details?.id ??
        (isSuperFranchise ? Number(currentUser?.id) : null);

      const proposedVal = finalLimitVal !== null ? Number(finalLimitVal) : 0;

      // If proposed limit > 0, check hierarchy restrictions
      if (proposedVal > 0) {
        // Rule: If hierarchy has a Super Franchise, Merchant CANNOT have limit set directly without a Franchise
        if (merchantSuperFranchiseId && (!parentFranchiseId || !parentFranchise)) {
          toast.error(
            "Cannot set Merchant limit directly! Merchant must belong to a Franchise. Please assign a Franchise first before allocating a limit."
          );
          return;
        }

        // Rule: If Franchise is not set (Not Set / ₹0), we CANNOT set limit of Merchant directly
        if (parentFranchiseId) {
          const rawFranchiseLimit = parentFranchise?.t0_daily_limit;
          const isFranchiseNotSet =
            rawFranchiseLimit === null ||
            rawFranchiseLimit === undefined ||
            rawFranchiseLimit === "";
          const isFranchiseZero = !isFranchiseNotSet && Number(rawFranchiseLimit) === 0;

          if (isFranchiseNotSet || isFranchiseZero) {
            const franchiseName =
              parentFranchise?.name ||
              parentFranchise?.full_name ||
              parentFranchise?.business_name ||
              `Franchise #${parentFranchiseId}`;
            toast.error(
              `Cannot set Merchant limit directly! Franchise (${franchiseName}) has no T0 Daily Limit pool set (Not Set / ₹0). Franchise limit must be configured first.`
            );
            return;
          }
        }

        // Rule: Merchant cannot exceed Super Franchise pool
        if (merchantSuperFranchiseId) {
          const parentSuperFranchise =
            rawUsersList.find((u) => Number(u.id) === Number(merchantSuperFranchiseId)) ||
            extractUsersArray(allUsersData).find((u) => Number(u.id) === Number(merchantSuperFranchiseId)) ||
            (Number(currentUser?.id) === Number(merchantSuperFranchiseId) ? currentUser : null);
          const rawParentSfLimit = parentSuperFranchise?.t0_daily_limit;

          const isSfNotSet =
            rawParentSfLimit === null ||
            rawParentSfLimit === undefined ||
            rawParentSfLimit === "";
          const isSfZero = !isSfNotSet && Number(rawParentSfLimit) === 0;
          const isSfUnlimited =
            !isSfNotSet && String(rawParentSfLimit).toLowerCase() === "unlimited";

          if (isSfNotSet || isSfZero) {
            const sfName =
              parentSuperFranchise?.name ||
              parentSuperFranchise?.full_name ||
              parentSuperFranchise?.business_name ||
              `Super Franchise #${merchantSuperFranchiseId}`;
            toast.error(
              `Cannot assign limit! Super Franchise (${sfName}) has no T0 Daily Limit pool assigned by Admin (Not Set / ₹0). Super Franchise pool must be set first.`
            );
            return;
          }

          if (!isSfUnlimited && !isSfNotSet && !isSfZero) {
            const sfTotalPool = Number(rawParentSfLimit) || 0;
            if (proposedVal > sfTotalPool) {
              const sfName =
                parentSuperFranchise?.name ||
                parentSuperFranchise?.full_name ||
                parentSuperFranchise?.business_name ||
                `Super Franchise #${merchantSuperFranchiseId}`;
              toast.error(
                `Limit pool of Super Franchise ${sfName} (₹${sfTotalPool.toLocaleString("en-IN")}) exceeded! Merchant limit (₹${proposedVal.toLocaleString("en-IN")}) cannot exceed Super Franchise limit (₹${sfTotalPool.toLocaleString("en-IN")}).`
              );
              return;
            }
          }
        }
      }

      // Check sub-allocation against Franchise assigned pool
      if (parentFranchiseId) {
        const rawParentLimit = parentFranchise?.t0_daily_limit;
        const isParentNotSet =
          rawParentLimit === null ||
          rawParentLimit === undefined ||
          rawParentLimit === "";
        const isParentZero = !isParentNotSet && Number(rawParentLimit) === 0;
        const isParentUnlimited =
          !isParentNotSet && String(rawParentLimit).toLowerCase() === "unlimited";

        if (!isParentUnlimited && !isParentNotSet && !isParentZero) {
          const parentTotalPool = Number(rawParentLimit) || 0;

          // Merchant limit cannot exceed Franchise limit
          if (proposedVal > parentTotalPool) {
            const franchiseName =
              parentFranchise?.name ||
              parentFranchise?.full_name ||
              parentFranchise?.business_name ||
              `Franchise #${parentFranchiseId}`;
            toast.error(
              `Limit pool of Franchise ${franchiseName} (₹${parentTotalPool.toLocaleString("en-IN")}) exceeded! Merchant limit (₹${proposedVal.toLocaleString("en-IN")}) cannot exceed Franchise limit (₹${parentTotalPool.toLocaleString("en-IN")}).`
            );
            return;
          }

          const siblingMerchants =
            franchiseMerchantsMap.get(String(parentFranchiseId)) ||
            (isFranchise ? scopedUsersList : []);

          let otherMerchantsAllocatedSum = 0;
          siblingMerchants.forEach((m) => {
            if (String(m.id) !== String(customer.id)) {
              const mLimit = Number(m.t0_daily_limit);
              if (Number.isFinite(mLimit) && mLimit > 0) {
                otherMerchantsAllocatedSum += mLimit;
              }
            }
          });

          const parentFranchiseUsedToday = getUserTodayUtilized(
            parentFranchiseId,
            parentFranchise,
            getUserSpecificTodayT0Sum(parentFranchise)
          );
          const maxAvailableForThisMerchant = Math.max(
            0,
            parentTotalPool - otherMerchantsAllocatedSum - parentFranchiseUsedToday
          );

          if (proposedVal > maxAvailableForThisMerchant) {
            const franchiseName =
              parentFranchise?.name ||
              parentFranchise?.full_name ||
              parentFranchise?.business_name ||
              `Franchise #${parentFranchiseId}`;
            const usedText =
              parentFranchiseUsedToday > 0
                ? ` (Parent Franchise has already used ₹${parentFranchiseUsedToday.toLocaleString("en-IN")} today)`
                : "";
            toast.error(
              `Limit pool of ${franchiseName} (₹${parentTotalPool.toLocaleString("en-IN")}) exceeded!${usedText} Maximum limit available to assign to this merchant is ₹${maxAvailableForThisMerchant.toLocaleString("en-IN")}.`
            );
            return;
          }
        }
      }
    }

    const prevLimitVal = customer.t0_daily_limit;
    const previousState = prevLimitVal !== null && prevLimitVal !== undefined && prevLimitVal !== "" ? `₹${prevLimitVal}` : "Unassigned (T1)";
    const newState = finalLimitVal !== null ? `₹${finalLimitVal}` : "Unassigned (T1)";

    // Directly save limit without any confirmation modal
    executeSaveCustomerLimit(customer, valToSave, finalLimitVal, previousState, newState);
  };

  const executeToggleSettlement = (user, currentEffectiveSettlement, nextSettlementMode) => {
    setUserOverridesMap((prev) => {
      const updated = {
        ...prev,
        [user.id]: {
          ...(prev[user.id] || {}),
          settlement_type: nextSettlementMode,
        },
      };
      try {
        localStorage.setItem("pos_user_overrides_map", JSON.stringify(updated));
      } catch { }
      return updated;
    });

    recordLimitAuditLog({
      performingUser: currentUser,
      affectedUser: user,
      previousState: currentEffectiveSettlement,
      newState: nextSettlementMode,
      action: nextSettlementMode,
      serviceKey: "settlement_type",
    });

    dispatchLimitChangeEvent({ type: "settlement_toggle", userId: user.id });

    updateSettlementMutation.mutate({
      id: user.id,
      settlement_type: nextSettlementMode,
    });

    const nameStr = user.name || user.full_name || user.business_name || `User #${user.id}`;
    setSuccessModal({
      isOpen: true,
      title: "Settlement Mode Updated!",
      message: `Settlement Mode for ${nameStr} has been updated to ${nextSettlementMode}.`,
      userName: nameStr,
      changeSummary: `${currentEffectiveSettlement} Mode → ${nextSettlementMode} Mode`,
    });
  };

  const handleToggleSettlement = (user, currentEffectiveSettlement) => {
    const nextSettlementMode = currentEffectiveSettlement === "T0" ? "T1" : "T0";

    setConfirmModal({
      isOpen: true,
      title: "Confirm Settlement Mode Switch",
      message: `Are you sure you want to switch settlement mode for ${user.name || user.full_name || 'User'}?`,
      user,
      previousState: `${currentEffectiveSettlement} Mode`,
      newState: `${nextSettlementMode} Mode`,
      actionType: "SETTLEMENT",
      onConfirm: () => executeToggleSettlement(user, currentEffectiveSettlement, nextSettlementMode),
    });
  };

  const executeBulkSet = (settlementType) => {
    bulkSettlementMutation.mutate(settlementType);

    filteredUsers.forEach((u) => {
      recordLimitAuditLog({
        performingUser: currentUser,
        affectedUser: u,
        previousState: u.settlement_type || "T0",
        newState: settlementType,
        action: `BULK_${settlementType}_SET`,
        serviceKey: "settlement_type",
      });
    });

    setSuccessModal({
      isOpen: true,
      title: "Bulk Settlement Mode Updated!",
      message: `Successfully set settlement mode to ${settlementType} for all ${filteredUsers.length} displayed users.`,
      userName: `All ${filteredUsers.length} Displayed Users`,
      changeSummary: `Bulk Set → ${settlementType} Mode`,
    });
  };

  const handleBulkSet = (settlementType) => {
    setConfirmModal({
      isOpen: true,
      title: "Confirm Bulk Settlement Update",
      message: `Are you sure you want to update all ${filteredUsers.length} displayed users to ${settlementType} Settlement Mode?`,
      user: null,
      previousState: "Mixed Modes",
      newState: `${settlementType} Mode`,
      actionType: "BULK",
      onConfirm: () => executeBulkSet(settlementType),
    });
  };

  // Download Sample Excel Template
  const handleDownloadFormat = () => {
    try {
      const headers = [["User ID", "Daily Limit (₹)"]];
      const worksheet = XLSX.utils.aoa_to_sheet(headers);
      worksheet["!cols"] = [
        { wch: 22 },
        { wch: 20 },
      ];
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Limit_Template");
      const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
      const blob = new Blob([excelBuffer], { type: "application/octet-stream" });
      saveAs(blob, "User_Daily_Limit_Upload_Format.xlsx");
      toast.success("Excel upload template downloaded successfully!");
    } catch (err) {
      toast.error("Failed to download Excel template");
    }
  };

  // Process Uploaded Excel File & Show Confirmation Preview Modal
  const handleExcelUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessingExcel(true);
    const reader = new FileReader();

    reader.onload = async (evt) => {
      try {
        const buffer = evt.target?.result;
        const workbook = XLSX.read(buffer, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        const rows = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

        if (!rows || rows.length === 0) {
          toast.error("The uploaded Excel sheet contains no data rows.");
          setIsProcessingExcel(false);
          if (fileInputRef.current) fileInputRef.current.value = "";
          return;
        }

        // Strict Header Check for Settlement Page Excel Upload:
        // Accept ONLY official template format with "User ID" & "Daily Limit (₹)" headers.
        const firstRowKeys = Object.keys(rows[0] || {});
        const cleanKeys = firstRowKeys.map((k) =>
          String(k || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "")
        );

        const hasUserIdHeader = cleanKeys.some(
          (k) => k === "userid" || k === "id" || k === "abheepayid"
        );
        const hasLimitHeader = cleanKeys.some(
          (k) => k.includes("limit") || k.includes("amount") || k.includes("t0")
        );
        const hasForbiddenHeader = cleanKeys.some(
          (k) => k.includes("mobile") || k.includes("phone") || k.includes("name")
        );

        if (!hasUserIdHeader || !hasLimitHeader || hasForbiddenHeader) {
          toast.error(
            "Invalid Excel format! Only official format with 'User ID' and 'Daily Limit (₹)' headers is accepted. Files with mobile numbers or names will not be accepted."
          );
          setIsProcessingExcel(false);
          if (fileInputRef.current) fileInputRef.current.value = "";
          return;
        }

        const matchedRows = [];
        const unmatchedRowsDetails = [];

        rows.forEach((row, index) => {
          if (!row || typeof row !== "object") return;

          let identifierVal = "";
          let rawLimitVal = "";

          Object.keys(row).forEach((key) => {
            const cleanKey = String(key || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
            const val = String(row[key] !== undefined && row[key] !== null ? row[key] : "").trim();

            if (!identifierVal && val) {
              if (cleanKey === "userid" || cleanKey === "id" || cleanKey === "abheepayid") {
                identifierVal = val;
              }
            }

            if (rawLimitVal === "" && val !== "") {
              if (cleanKey.includes("limit") || cleanKey.includes("amount") || cleanKey.includes("t0")) {
                rawLimitVal = val;
              }
            }
          });

          if (!identifierVal) {
            identifierVal = String(row["User ID"] || row["ID"] || row["Abheepay ID"] || "").trim();
          }

          if (rawLimitVal === "") {
            rawLimitVal = String(
              row["Daily Limit (₹)"] ?? row["Daily Limit"] ?? row["Limit"] ?? ""
            ).trim();
          }

          if (!identifierVal) return;

          const identifierLower = identifierVal.toLowerCase();
          const cleanIdentifier = identifierLower.replace(/[^a-z0-9]/g, "");

          // STRICT User ID matching ONLY (abheepay_id, user_id, or primary database ID)
          let matchedUser = rawUsersList.find((u) => {
            const uId = String(u.id || "").trim().toLowerCase();
            const uUserId = String(u.user_id || u.userId || u.user_code || "").trim().toLowerCase();
            const uAbheeId = String(u.abheepay_id || u.abhee_pay_id || "").trim().toLowerCase();

            const cleanUUserId = uUserId.replace(/[^a-z0-9]/g, "");
            const cleanUAbheeId = uAbheeId.replace(/[^a-z0-9]/g, "");

            return (
              (uAbheeId && (uAbheeId === identifierLower || cleanUAbheeId === cleanIdentifier)) ||
              (uUserId && (uUserId === identifierLower || cleanUUserId === cleanIdentifier)) ||
              (uId && (uId === identifierLower || uId === cleanIdentifier))
            );
          });

          // Numeric ID fallback ONLY if purely numeric string (e.g. "2" or "1002") and no exact text match was found
          if (!matchedUser && /^\d+$/.test(identifierVal)) {
            const numericId = String(Number(identifierVal));
            matchedUser = rawUsersList.find((u) => {
              const uId = String(u.id || "").trim();
              const uUserIdDigits = String(u.user_id || "").replace(/\D/g, "");
              const uAbheeIdDigits = String(u.abheepay_id || "").replace(/\D/g, "");

              return (
                uId === numericId ||
                (uUserIdDigits && uUserIdDigits === numericId) ||
                (uAbheeIdDigits && uAbheeIdDigits === numericId)
              );
            });
          }

          const limitVal = rawLimitVal !== "" && !isNaN(Number(rawLimitVal)) ? Math.floor(Number(rawLimitVal)) : null;

          if (matchedUser && limitVal !== null) {
            const prevVal = matchedUser.t0_daily_limit;
            const previousStateStr = prevVal !== null && prevVal !== undefined && prevVal !== "" ? `₹${Number(prevVal).toLocaleString("en-IN")}` : "Unassigned (T1)";
            const newStateStr = `₹${limitVal.toLocaleString("en-IN")}`;

            const customerUsedToday = getUserTodayUtilized(matchedUser.id, matchedUser, getUserSpecificTodayT0Sum(matchedUser));
            let isWarning = false;
            let warningMessage = "";

            if (customerUsedToday > 0 && limitVal < customerUsedToday) {
              isWarning = true;
              warningMessage = `Below used today (₹${customerUsedToday.toLocaleString("en-IN")})`;
            }

            matchedRows.push({
              matchedUser,
              identifierVal,
              limitVal,
              previousStateStr,
              newStateStr,
              isWarning,
              warningMessage,
            });
          } else {
            unmatchedRowsDetails.push({
              rowNum: index + 1,
              identifierVal: identifierVal || "N/A",
              rawLimitVal: rawLimitVal || "N/A",
              reason: !matchedUser ? "User ID not found in system" : "Invalid limit amount",
            });
          }
        });

        if (matchedRows.length === 0 && unmatchedRowsDetails.length === 0) {
          toast.error("No valid user IDs or limit columns found in Excel file.");
          setIsProcessingExcel(false);
          if (fileInputRef.current) fileInputRef.current.value = "";
          return;
        }

        setExcelPreviewModal({
          isOpen: true,
          fileName: file.name,
          totalRowsCount: rows.length,
          matchedRows,
          unmatchedRowsCount: unmatchedRowsDetails.length,
          unmatchedRowsDetails,
        });
      } catch (err) {
        console.error("Excel processing failed", err);
        toast.error("Failed to parse Excel file. Please verify column format.");
        if (fileInputRef.current) fileInputRef.current.value = "";
      } finally {
        setIsProcessingExcel(false);
      }
    };

    reader.readAsArrayBuffer(file);
  };

  // Confirm and Execute Excel Limit Upload Updates
  const handleConfirmExcelApply = async () => {
    const { matchedRows } = excelPreviewModal;
    if (!matchedRows || matchedRows.length === 0) {
      toast.error("No matched users to apply limits.");
      setExcelPreviewModal((prev) => ({ ...prev, isOpen: false }));
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    if (isAdmin || isEmployee) {
      if (adminLimitsStats?.payinLimit !== null && !adminLimitsStats?.isPayinUnlimited) {
        const adminPool = Number(adminLimitsStats?.payinLimit) || 0;
        const newLimitsMap = new Map();
        matchedRows.forEach((r) => {
          if (r.matchedUser && r.limitVal !== null) {
            newLimitsMap.set(String(r.matchedUser.id), Number(r.limitVal) || 0);
          }
        });

        let projectedTopLevelTotal = 0;
        scopedUsersList.forEach((u) => {
          const uId = String(u.id);
          const limit = newLimitsMap.has(uId) ? newLimitsMap.get(uId) : (Number(u.t0_daily_limit) || 0);
          projectedTopLevelTotal += limit;
        });

        if (projectedTopLevelTotal > adminPool) {
          toast.error(
            `Cannot apply Excel limits! Total top-level allocation would be ₹${projectedTopLevelTotal.toLocaleString("en-IN")}, exceeding Admin Payin limit pool of ₹${adminPool.toLocaleString("en-IN")}.`
          );
          return;
        }
      }
    }

    setIsProcessingExcel(true);
    let updatedCount = 0;
    const updatePromises = [];

    matchedRows.forEach((item) => {
      const { matchedUser, limitVal } = item;

      updatePromises.push(
        updateCustomerT0Limit(matchedUser.id, limitVal).catch((err) => {
          console.error(`Failed to update T0 limit for user ID ${matchedUser.id}:`, err);
        })
      );

      recordLimitAuditLog({
        performingUser: currentUser,
        affectedUser: matchedUser,
        previousState: item.previousStateStr,
        newState: item.newStateStr,
        action: "EXCEL_BULK_UPLOAD",
        serviceKey: "user_daily_limit",
      });

      updatedCount += 1;
    });

    setExcelPreviewModal((prev) => ({ ...prev, isOpen: false }));

    if (updatePromises.length > 0) {
      await Promise.all(updatePromises);
    }

    if (fileInputRef.current) fileInputRef.current.value = "";

    await queryClient.invalidateQueries({ queryKey: ["posSettings"] });
    await queryClient.invalidateQueries({ queryKey: ["allUsersListForPosSetting"] });
    await refetchAll();
    dispatchLimitChangeEvent({ type: "excel_upload", count: updatedCount });

    setSuccessModal({
      isOpen: true,
      title: "Excel Limits Applied Successfully!",
      message: `Updated T0 daily limits for ${updatedCount} user(s) as per uploaded Excel file.`,
      userName: `${updatedCount} Users Updated`,
      changeSummary: `Excel Import → ${updatedCount} Users`,
    });
    setIsProcessingExcel(false);
  };

  const renderSingleUserRow = (user, index, isChildOfFranchise = false) => {
    const rawSettlement = String(user.settlement_type || "T0").toUpperCase();
    const rawLimit = user.t0_daily_limit;
    const isLimitSet = rawLimit !== null && rawLimit !== undefined && rawLimit !== "";
    const isZeroLimit = isLimitSet && Number(rawLimit) === 0;
    const isUnassignedLimit = !isLimitSet;

    const effectiveSettlement = rawSettlement === "T1" || isZeroLimit || isUnassignedLimit ? "T1" : "T0";
    const isAutoShifted = rawSettlement === "T0" && (isZeroLimit || isUnassignedLimit);

    const currentEditValue =
      editingLimitMap[user.id] !== undefined
        ? editingLimitMap[user.id]
        : rawLimit !== null && rawLimit !== undefined
          ? rawLimit
          : "";

    const normRole = normalizeUserRole(user.role);
    const isSuperFranchiseRole = normRole === "super_franchise";
    const isFranchiseRole = normRole === "franchise";

    const childUsers = isSuperFranchiseRole
      ? superFranchiseChildrenMap.get(String(user.id)) || []
      : isFranchiseRole
        ? franchiseMerchantsMap.get(String(user.id)) || []
        : [];
    const hasChildUsers = childUsers.length > 0;
    const canExpand = (isAdmin || isSuperFranchise || (isEmployee && canViewSettlement)) && (isSuperFranchiseRole || isFranchiseRole) && hasChildUsers;
    const isExpanded = Boolean(canExpand && (expandedFranchiseMap[user.id] || (searchTerm && childUsers.length > 0)));

    const childRoleLabel = isSuperFranchiseRole ? "Franchises" : "Merchants";
    const childSingularLabel = isSuperFranchiseRole ? "Franchise" : "Merchant";
    const roleBadgeLabel = isSuperFranchiseRole ? "SUPER FRANCHISE" : isFranchiseRole ? "FRANCHISE" : user.role || normRole;

    return (
      <React.Fragment key={user.id}>
        <tr
          className={`transition-colors ${isChildOfFranchise
              ? "bg-cyan-50/40 hover:bg-cyan-50/70"
              : isSuperFranchiseRole
                ? "bg-purple-50/30 hover:bg-purple-50/70 font-medium"
                : isFranchiseRole
                  ? "bg-cyan-50/20 hover:bg-cyan-50/60 font-medium"
                  : "hover:bg-slate-50/80"
            }`}
        >
          <td className="p-3.5 font-medium text-slate-400">
            {isChildOfFranchise ? `↳` : index + 1}
          </td>
          <td className="p-3.5 font-mono text-slate-700 font-semibold text-xs">
            {user.user_id || user.abheepay_id || user.id || "-"}
          </td>
          <td
            className={`p-3.5 ${canExpand ? "cursor-pointer select-none hover:bg-cyan-100/60 transition rounded-xl" : ""}`}
            onClick={canExpand ? () => toggleFranchiseExpand(user.id) : undefined}
          >
            <div className="flex items-center gap-2">
              {canExpand ? (
                <div className="flex items-center gap-2.5 group">
                  <span className={`p-1.5 rounded-lg shadow-sm transition flex items-center justify-center ${isExpanded ? "bg-[#00D3CD] text-white" : "bg-[#00D3CD] text-white group-hover:bg-[#00bdb7]"
                    }`}>
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 stroke-[3]" />
                    ) : (
                      <ChevronRight className="w-4 h-4 stroke-[3]" />
                    )}
                  </span>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-sm group-hover:text-[#00D3CD] transition">
                        {user.name || user.full_name || user.business_name || `${childSingularLabel} #${user.id}`}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                        isSuperFranchiseRole
                          ? "bg-purple-100 text-purple-900 border border-purple-200"
                          : "bg-cyan-100 text-cyan-900 border border-cyan-200"
                      }`}>
                        {roleBadgeLabel}
                      </span>
                    </div>
                    <span className="text-[11px] font-extrabold text-[#00D3CD] flex items-center gap-1.5 mt-0.5">
                      <span>{isExpanded ? `▲ Hide ${childRoleLabel}` : `▼ Tap to view & edit ${childRoleLabel.toLowerCase()}`}</span>
                      <span className="bg-cyan-100 text-cyan-900 px-2 py-0.2 rounded-full font-black text-[10px] border border-cyan-200">
                        ({childUsers.length} {childRoleLabel})
                      </span>
                    </span>
                  </div>
                </div>
              ) : (
                <>
                  <span className={`font-semibold ${isChildOfFranchise ? "text-slate-800" : "text-slate-900"}`}>
                    {user.name || user.full_name || user.business_name || `User #${user.id}`}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                      normRole === "super_franchise"
                        ? "bg-purple-100 text-purple-900 border border-purple-200"
                        : normRole === "merchant"
                          ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                          : normRole === "franchise"
                            ? "bg-cyan-100 text-cyan-900 border border-cyan-200"
                            : normRole === "employee"
                              ? "bg-blue-100 text-blue-800 border border-blue-200"
                              : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {roleBadgeLabel}
                  </span>
                </>
              )}
            </div>
          </td>



          {/* Applied Rate Indicator */}
          {/* <td className="p-3.5">
            {effectiveSettlement === "T0" ? (
              <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                Dynamic Rate Applied
              </span>
            ) : isAutoShifted ? (
              <span className="inline-flex items-center gap-1 font-semibold text-cyan-800">
                <Info className="w-3.5 h-3.5 text-[#00D3CD]" />
                T1 Rate ({isZeroLimit ? "Limit ₹0 Shift" : "Unassigned Shift"})
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 font-semibold text-slate-700">
                <Info className="w-3.5 h-3.5 text-slate-400" />
                T1 Rate Applied
              </span>
            )}
          </td> */}

          {/* T0 Daily Limit */}
          <td className="p-3.5">
            {
              <div className="flex items-center gap-1.5 max-w-[180px]">
                <span className="text-slate-400 font-semibold text-xs">₹</span>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder="Unassigned (T1)"
                  value={currentEditValue}
                  onChange={(e) => handleLimitInputChange(user.id, e.target.value)}
                  onWheel={(e) => e.target.blur()}
                  onKeyDown={(e) => {
                    if (e.key === "-" || e.key === "." || e.key === "e" || e.key === "E") {
                      e.preventDefault();
                    }
                  }}
                  disabled={!isPosServiceActive}
                  className={`w-full px-2.5 py-1 text-xs font-mono border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#00D3CD] focus:outline-none ${!isPosServiceActive ? "opacity-50 cursor-not-allowed bg-slate-100" : ""}`}
                  title={!isPosServiceActive ? "Service is currently disabled by Admin" : ""}
                />
              </div>
            }
          </td>

          {/* Action */}
          <td className="p-3.5 text-right">
            { 
              <button
                onClick={() => handleSaveCustomerLimit(user)}
                disabled={updateLimitMutation.isPending || !isPosServiceActive}
                className={`px-3.5 py-1.5 text-xs font-semibold text-white bg-[#00D3CD] hover:bg-[#00bdb7] rounded-lg transition-colors shadow-sm disabled:opacity-50 ${!isPosServiceActive ? "cursor-not-allowed" : ""}`}
                title={!isPosServiceActive ? "Service is currently disabled by Admin" : ""}
              >
                Save Limit
              </button>
            }
          </td>
        </tr>

        {/* Expanded Row for Child Users (Merchants under Franchise OR Franchises under Super Franchise) */}
        {canExpand && isExpanded && (() => {
          const parentUsed = getUserTodayUtilized(user.id, user, getUserSpecificTodayT0Sum(user));
          const poolStats = calculateFranchisePoolStats(user, childUsers, parentUsed);
          const cSearchTerm = (franchiseMerchantSearchMap[user.id] || "").trim().toLowerCase();
          const filteredChildUsers = childUsers.filter((c) => {
            if (!cSearchTerm) return true;
            const cName = String(c.name || c.full_name || c.business_name || "").toLowerCase();
            const cContact = String(c.mobile_number || c.mobile || c.username || c.user_id || c.email || "").toLowerCase();
            return cName.includes(cSearchTerm) || cContact.includes(cSearchTerm);
          });

          return (
            <tr className="bg-cyan-50/20">
              <td colSpan="6" className="p-3 pl-8 sm:pl-12">
                <div className="bg-white rounded-xl border border-cyan-200 p-4 shadow-sm space-y-3">
                  <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-cyan-100 pb-2.5 gap-2.5">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                      <div className="flex items-center gap-2 text-cyan-950 font-bold text-xs">
                        <Building2 className="w-4 h-4 text-[#00D3CD]" />
                        <span>
                          {childRoleLabel} under {roleBadgeLabel}{" "}
                          <strong className="underline text-slate-900">{user.name || user.full_name || `${childSingularLabel} #${user.id}`}</strong>
                        </span>
                      </div>

                      {/* Search Box for Children */}
                      <div className="relative w-full sm:w-60">
                        <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-slate-400" />
                        <input
                          type="text"
                          placeholder={`Search ${childUsers.length} ${childRoleLabel.toLowerCase()}...`}
                          value={franchiseMerchantSearchMap[user.id] || ""}
                          onChange={(e) =>
                            setFranchiseMerchantSearchMap((prev) => ({
                              ...prev,
                              [user.id]: e.target.value,
                            }))
                          }
                          className="w-full pl-8 pr-7 py-1 text-xs border border-cyan-200 rounded-lg focus:ring-2 focus:ring-[#00D3CD] focus:outline-none bg-white shadow-2xs"
                        />
                        {franchiseMerchantSearchMap[user.id] && (
                          <button
                            type="button"
                            onClick={() =>
                              setFranchiseMerchantSearchMap((prev) => ({
                                ...prev,
                                [user.id]: "",
                              }))
                            }
                            className="absolute right-2 top-1 text-slate-400 hover:text-slate-600 font-bold text-xs p-0.5"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold">
                      <span className="bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-md border border-slate-200">
                        Assigned Pool: {poolStats.isUnlimited ? "Unlimited" : `₹${poolStats.totalAssignedPool?.toLocaleString("en-IN")}`}
                      </span>
                      <span className="bg-cyan-100 text-cyan-900 px-2.5 py-0.5 rounded-md border border-cyan-200">
                        Allocated: ₹{poolStats.allocatedToMerchants?.toLocaleString("en-IN")}
                      </span>
                      {poolStats.franchiseUsedToday > 0 && (
                        <span className="bg-amber-100 text-amber-900 px-2.5 py-0.5 rounded-md border border-amber-200">
                          Self-Used Today: ₹{poolStats.franchiseUsedToday?.toLocaleString("en-IN")}
                        </span>
                      )}
                      <span className="bg-emerald-100 text-emerald-900 px-2.5 py-0.5 rounded-md border border-emerald-200">
                        Remaining Self-Limit: {poolStats.isUnlimited ? "Unlimited" : `₹${poolStats.remainingSelfLimitLeft?.toLocaleString("en-IN")}`}
                      </span>
                    </div>
                  </div>

                  <div className="overflow-x-auto rounded-lg border border-cyan-100">
                    <table className="w-full text-left text-xs text-slate-700">
                      <thead className="bg-cyan-50/80 text-cyan-900 font-semibold border-b border-cyan-100 uppercase text-[10px]">
                        <tr>
                          <th className="p-2.5">#</th>
                          <th className="p-2.5">User ID</th>
                          <th className="p-2.5">{childSingularLabel} Name</th>
                          {/* <th className="p-2.5">Applied Rate</th> */}
                          <th className="p-2.5">T0 Daily Limit (₹)</th>
                          <th className="p-2.5 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-cyan-50">
                        {filteredChildUsers.length === 0 ? (
                          <tr>
                            <td colSpan="6" className="p-6 text-center text-slate-400 font-medium italic">
                              No {childRoleLabel.toLowerCase()} found matching "{franchiseMerchantSearchMap[user.id]}" under this {childSingularLabel.toLowerCase()}.
                            </td>
                          </tr>
                        ) : (
                          filteredChildUsers.map((child, cIdx) => (
                            <React.Fragment key={child.id}>
                              {renderSingleUserRow(child, cIdx, true)}
                            </React.Fragment>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </td>
            </tr>
          );
        })()}
      </React.Fragment>
    );
  };

  const isLoading = isEmployee ? isPosLoading : isPosLoading && isUsersLoading;

  if (posError || (!isEmployee && usersError)) {
    const error = posError || usersError;
    return (
      <div className="m-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700" role="alert">
        Failed to load Settlement data: {error.message || "Please try again."}
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 sm:p-6 max-w-7xl mx-auto">
      {/* Hidden File Input for Excel Upload */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleExcelUpload}
        accept=".xlsx, .xls, .csv"
        className="hidden"
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2.5">
            <Sliders className="w-7 h-7 text-[#00D3CD]" />
            {isSuperFranchise
              ? "Franchise POS Settlement & Daily Limit Settings"
              : isFranchise
                ? "Merchant POS Settlement & Daily Limit Settings"
                : "POS T0 / T1 Settlement & User Daily Limit Settings"}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {isSuperFranchise
              ? "View and configure POS Settlement Modes & T0 daily limits for your Franchises. Tap a Franchise to expand and edit their Merchants."
              : isFranchise
                ? "View and configure POS Settlement Modes & T0 daily limits for your Merchants."
                : "Manage Settlement Modes & T0 daily limits for Franchises & Direct Merchants. Tap a Franchise to expand and overwrite their Merchants."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {canManageSettlement && (
            <>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isProcessingExcel || !isPosServiceActive}
                className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors shadow-sm disabled:opacity-50 ${!isPosServiceActive ? "cursor-not-allowed" : ""}`}
                title={!isPosServiceActive ? "Service is currently disabled by Admin" : ""}
              >
                <Upload className="w-4 h-4" />
                {isProcessingExcel ? "Uploading Excel..." : "Upload Excel Limits"}
              </button>
              <button
                onClick={handleDownloadFormat}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors border border-slate-200"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                Download Format
              </button>
            </>
          )}
        </div>
      </div>

      {/* Admin Settlement Limits Overview Card (Admin / Employee) */}
      {(isAdmin || isEmployee) && adminLimitsStats && (
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-[#00D3CD] text-white rounded-xl shadow-sm">
                <Building2 className="w-5 h-5 font-bold" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  Admin Settlement & Master Limits
                  <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-cyan-50 text-cyan-800 border border-cyan-200">
                    Assigned by Super Admin
                  </span>
                </h3>
                <p className="text-xs text-slate-500">
                  Daily master limits configured by Super Admin: Payin (T0 Pool), Payout Limit, and Credit Card Bill Payment Limit.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            {/* 1. PAYIN / T0 SETTLEMENT POOL */}
            <div className="bg-gradient-to-br from-cyan-50/70 via-teal-50/30 to-white p-4 rounded-xl border border-cyan-200 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600 font-bold uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                    <ArrowDownLeft className="w-3.5 h-3.5 text-[#00D3CD]" />
                    Payin Total Limit (T0 Pool)
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-cyan-100 text-cyan-800 border border-cyan-200">
                    Master Cap
                  </span>
                </div>
                <span className="text-2xl font-black text-slate-900 mt-2 block">
                  {adminLimitsStats.isPayinUnlimited
                    ? "Unlimited"
                    : adminLimitsStats.isPayinNotSet || adminLimitsStats.payinLimit === null
                    ? "Not Set (T1)"
                    : `₹${adminLimitsStats.payinLimit?.toLocaleString("en-IN")}`}
                </span>
              </div>

              <div className="mt-3 pt-2.5 border-t border-cyan-100 text-xs space-y-1.5">
                <div className="flex justify-between items-center text-slate-600">
                  <span className="text-slate-500 font-medium">Allocated to Users:</span>
                  <strong className="text-slate-900 font-bold">
                    ₹{adminLimitsStats.allocatedToUsers?.toLocaleString("en-IN")}
                  </strong>
                </div>
                <div className="flex justify-between items-center text-slate-600">
                  <span className="text-slate-500 font-medium">Remaining Available:</span>
                  <strong
                    className={`font-bold ${
                      adminLimitsStats.remainingPayin === 0 || adminLimitsStats.remainingPayin === null
                        ? "text-rose-600"
                        : "text-emerald-600"
                    }`}
                  >
                    {adminLimitsStats.isPayinUnlimited
                      ? "Unlimited"
                      : adminLimitsStats.isPayinNotSet || adminLimitsStats.remainingPayin === null
                      ? "₹0"
                      : `₹${adminLimitsStats.remainingPayin?.toLocaleString("en-IN")}`}
                  </strong>
                </div>
              </div>
            </div>

            {/* 2. PAYOUT LIMIT */}
            <div className="bg-gradient-to-br from-blue-50/60 via-slate-50/30 to-white p-4 rounded-xl border border-blue-200/80 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600 font-bold uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                    <ArrowUpRight className="w-3.5 h-3.5 text-blue-600" />
                    Payout Limit
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800 border border-blue-200">
                    Company
                  </span>
                </div>
                <span className="text-2xl font-black text-slate-900 mt-2 block">
                  ₹{adminLimitsStats.payoutLimit?.toLocaleString("en-IN")}
                </span>
              </div>
              <p className="mt-3 pt-2.5 border-t border-blue-100/70 text-[11px] text-slate-500">
                Maximum daily payout transaction volume permitted for your company.
              </p>
            </div>

            {/* 3. CC BILL PAYMENT LIMIT */}
            <div className="bg-gradient-to-br from-amber-50/60 via-orange-50/20 to-white p-4 rounded-xl border border-amber-200/80 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600 font-bold uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                    <CreditCard className="w-3.5 h-3.5 text-amber-600" />
                    CC Bill Limit
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
                    Company
                  </span>
                </div>
                <span className="text-2xl font-black text-slate-900 mt-2 block">
                  ₹{adminLimitsStats.ccBillLimit?.toLocaleString("en-IN")}
                </span>
              </div>
              <p className="mt-3 pt-2.5 border-t border-amber-100/70 text-[11px] text-slate-500">
                Maximum daily credit card bill payment volume permitted for your company.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Self-Limit Pool Breakdown Card (Franchise or Super Franchise) */}
      {(isFranchise || isSuperFranchise) && franchiseSelfPoolStats && (
        <div className="bg-gradient-to-r from-cyan-50 to-teal-50 p-5 rounded-2xl border border-cyan-200 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-cyan-200/60 pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-[#00D3CD] text-white rounded-xl shadow-sm">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {isSuperFranchise ? "Your Super Franchise Daily Limit Pool Breakdown" : "Your Franchise Daily Limit Pool Breakdown"}
                </h3>
                <p className="text-xs text-slate-500">
                  {isSuperFranchise
                    ? "Limit assigned by Admin is split between your downstream franchises and your remaining self-limit."
                    : "Limit assigned by Admin is split between your downstream merchants and your remaining self-limit."}
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-semibold">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-slate-400 font-medium uppercase tracking-wider block text-[10px]">Total Assigned Pool (by Admin)</span>
              <span className="text-xl font-black text-slate-900 mt-1 block">
                {franchiseSelfPoolStats.isUnlimited
                  ? "Unlimited"
                  : franchiseSelfPoolStats.isNotSet || franchiseSelfPoolStats.totalAssignedPool === null
                    ? "Not Set (T1)"
                    : `₹${franchiseSelfPoolStats.totalAssignedPool?.toLocaleString("en-IN")}`}
              </span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-cyan-200 shadow-2xs">
              <span className="text-slate-400 font-medium uppercase tracking-wider block text-[10px]">
                {isSuperFranchise ? "Allocated to Franchises" : "Allocated to Merchants"}
              </span>
              <span className="text-xl font-black text-[#00D3CD] mt-1 block">
                ₹{franchiseSelfPoolStats.allocatedToMerchants?.toLocaleString("en-IN")}
              </span>
            </div>

            <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-200 shadow-2xs flex flex-col justify-between">
              <div>
                <span className="text-emerald-700 font-medium uppercase tracking-wider block text-[10px]">Remaining Self-Limit (Your T0 POS Payin Cap)</span>
                <span className="text-xl font-black text-emerald-800 mt-1 block">
                  {franchiseSelfPoolStats.isUnlimited
                    ? "Unlimited"
                    : franchiseSelfPoolStats.isNotSet || franchiseSelfPoolStats.remainingSelfLimit === null
                      ? "Not Set (T1)"
                      : `₹${franchiseSelfPoolStats.remainingSelfLimit?.toLocaleString("en-IN")}`}
                </span>
              </div>
              {(() => {
                const selfUsed = franchiseSelfPoolStats.franchiseUsedToday;
                const selfLeft = franchiseSelfPoolStats.isUnlimited
                  ? "Unlimited"
                  : franchiseSelfPoolStats.isNotSet || franchiseSelfPoolStats.remainingSelfLimitLeft === null
                    ? "Not Set (T1)"
                    : `₹${franchiseSelfPoolStats.remainingSelfLimitLeft?.toLocaleString("en-IN")}`;

                return (
                  <div className="flex justify-between items-center text-[10.5px] border-t border-emerald-200/80 pt-1.5 mt-2 font-semibold">
                    <span className="text-slate-600">Used Today: <strong className="text-slate-900">₹{selfUsed.toLocaleString("en-IN")}</strong></span>
                    <span className="text-emerald-800">Left Today: <strong className="text-emerald-900">{selfLeft}</strong></span>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Globally Disabled Banner */}
      {!isPosServiceActive && (
        <div className="flex items-center gap-3.5 bg-amber-50 border border-amber-200 text-amber-900 p-4.5 rounded-2xl shadow-sm">
          <AlertTriangle className="w-6 h-6 shrink-0 text-amber-600" />
          <div>
            <h4 className="text-sm font-bold">Global POS Settlement Evaluator is Disabled</h4>
            <p className="text-xs text-amber-800 mt-0.5">
              Money-In events (Razorpay Webhook / Excel Upload) bypass dynamic limit evaluation and use <strong>Static DB Settlement Mode (`user.settlement_type`)</strong> directly. Turn ON the <strong>"POS Settlement Evaluator"</strong> master switch in <strong>Service Control Settings (Settings Page)</strong> to enable dynamic limit rules.
            </p>
          </div>
        </div>
      )}

      {/* Stats Summary Cards — HIDDEN (kept for future use) */}
      {false && (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Users Card */}
        <button
          type="button"
          onClick={() => setSettlementFilter("all")}
          className={`text-left w-full rounded-2xl p-5 text-white shadow-md transition-all transform hover:-translate-y-1 hover:shadow-xl cursor-pointer ${settlementFilter === "all"
              ? "bg-gradient-to-br from-cyan-500 to-teal-600 ring-4 ring-[#00D3CD]/50 scale-[1.02]"
              : "bg-gradient-to-br from-cyan-600 to-teal-700 opacity-90"
            }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold tracking-wider uppercase opacity-80">Total Users</span>
            <div className="p-2 bg-white/20 rounded-xl">
              <Users className="w-5 h-5 text-white" />
            </div>
          </div>
          <p className="mt-3 text-3xl font-extrabold">{stats.total_customers || 0}</p>
          <p className="mt-1 text-xs opacity-90 flex items-center justify-between">
            <span>Scoped User Accounts</span>
            <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full font-bold">Tap to Filter</span>
          </p>
        </button>

        {/* T0 Active Card */}
        <button
          type="button"
          onClick={() => setSettlementFilter("T0")}
          className={`text-left w-full bg-white rounded-2xl p-5 border transition-all transform hover:-translate-y-1 hover:shadow-lg cursor-pointer ${settlementFilter === "T0"
              ? "border-cyan-500 ring-4 ring-cyan-500/20 scale-[1.02] shadow-md"
              : "border-slate-200 hover:border-cyan-300"
            }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold tracking-wider uppercase text-slate-500">T0 Active</span>
            <div className="p-2 bg-cyan-50 rounded-xl">
              <Zap className="w-5 h-5 text-cyan-600" />
            </div>
          </div>
          <p className="mt-3 text-3xl font-extrabold text-slate-900">{stats.t0_active_count || 0}</p>
          <p className="mt-1 text-xs text-slate-500 flex items-center justify-between">
            <span>Same-Day Settlement</span>
            <span className="text-[10px] bg-cyan-100 text-cyan-800 px-2 py-0.5 rounded-full font-bold">Tap to Filter</span>
          </p>
        </button>

        {/* T1 Active Card */}
        <button
          type="button"
          onClick={() => setSettlementFilter("T1")}
          className={`text-left w-full bg-white rounded-2xl p-5 border transition-all transform hover:-translate-y-1 hover:shadow-lg cursor-pointer ${settlementFilter === "T1"
              ? "border-[#00D3CD] ring-4 ring-[#00D3CD]/20 scale-[1.02] shadow-md"
              : "border-slate-200 hover:border-cyan-300"
            }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold tracking-wider uppercase text-slate-500">T1 Active</span>
            <div className="p-2 bg-cyan-50 rounded-xl">
              <ArrowRightLeft className="w-5 h-5 text-[#00D3CD]" />
            </div>
          </div>
          <p className="mt-3 text-3xl font-extrabold text-slate-900">{stats.t1_active_count || 0}</p>
          <p className="mt-1 text-xs text-slate-500 flex items-center justify-between">
            <span>Next-Day Settlement</span>
            <span className="text-[10px] bg-cyan-100 text-cyan-800 px-2 py-0.5 rounded-full font-bold">Tap to Filter</span>
          </p>
        </button>

        {/* T0 Limits Set Card */}
        <button
          type="button"
          onClick={() => setSettlementFilter("limit_configured")}
          className={`text-left w-full bg-white rounded-2xl p-5 border transition-all transform hover:-translate-y-1 hover:shadow-lg cursor-pointer ${settlementFilter === "limit_configured"
              ? "border-emerald-500 ring-4 ring-emerald-500/20 scale-[1.02] shadow-md"
              : "border-slate-200 hover:border-emerald-300"
            }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold tracking-wider uppercase text-slate-500">T0 Limits Set</span>
            <div className="p-2 bg-emerald-50 rounded-xl">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
            </div>
          </div>
          <p className="mt-3 text-3xl font-extrabold text-slate-900">{stats.t0_limit_configured_count || 0}</p>
          <p className="mt-1 text-xs text-slate-500 flex items-center justify-between">
            <span>Custom Daily Limits</span>
            <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold">Tap to Filter</span>
          </p>
        </button>
      </div>
      )}


      {/* User T0 Daily Limit Table & Controls */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
        {/* Controls Row */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full justify-end">
            {/* Search */}
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search user name, mobile, username..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#00D3CD] focus:outline-none"
              />
            </div>

            {/* Settlement Filter & Role Filter hidden as requested */}
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 uppercase tracking-wider">
              <tr>
                <th className="p-3.5">#</th>
                <th className="p-3.5">User ID</th>
                <th className="p-3.5">User Name & Role</th>
                {/* <th className="p-3.5">Applied Rate Mode</th> */}
                <th className="p-3.5">T0 Daily Limit (₹)</th>
                <th className="p-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan="6" className="p-8 text-center text-slate-400 font-medium">
                    No users found matching your search criteria.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user, index) => renderSingleUserRow(user, index, false))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Excel Upload Confirmation Preview Modal */}
      {excelPreviewModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-cyan-50 text-[#00D3CD] rounded-xl border border-cyan-100">
                  <FileSpreadsheet className="w-5 h-5 stroke-[2.2]" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <span>Excel Upload Preview & Confirmation</span>
                  </h3>
                  <p className="text-xs text-slate-500 truncate max-w-md">
                    File: <span className="font-semibold text-slate-700">{excelPreviewModal.fileName}</span>
                  </p>
                </div>
              </div>

              {/* Stats Summary Badges */}
              <div className="flex items-center gap-2 text-xs font-bold">
                <span className="bg-slate-100 text-slate-700 px-2.5 py-1 rounded-lg border border-slate-200">
                  Total Rows: {excelPreviewModal.totalRowsCount}
                </span>
                <span className="bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-lg border border-emerald-200">
                  ✓ Matched: {excelPreviewModal.matchedRows.length}
                </span>
                {excelPreviewModal.unmatchedRowsCount > 0 && (
                  <span className="bg-amber-100 text-amber-900 px-2.5 py-1 rounded-lg border border-amber-200">
                    ⚠ Skipped: {excelPreviewModal.unmatchedRowsCount}
                  </span>
                )}
              </div>
            </div>

            {/* Modal Body / Scrollable Content */}
            <div className="overflow-y-auto space-y-4 pr-1 flex-1">
              {/* Matched Users Table */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                    <UserCheck className="w-4 h-4 text-emerald-600" />
                    <span>Users & Limits to be Updated ({excelPreviewModal.matchedRows.length})</span>
                  </h4>
                </div>

                {excelPreviewModal.matchedRows.length === 0 ? (
                  <div className="p-6 text-center bg-slate-50 rounded-xl border border-dashed border-slate-300 text-slate-500 text-xs font-medium">
                    No matching users found for the IDs in this Excel file.
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-slate-200 max-h-64 shadow-xs">
                    <table className="w-full text-left text-xs text-slate-700">
                      <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 uppercase tracking-wider sticky top-0 z-10">
                        <tr>
                          <th className="p-2.5">#</th>
                          <th className="p-2.5">Excel User ID</th>
                          <th className="p-2.5">Matched System User</th>
                          <th className="p-2.5">Current Limit</th>
                          <th className="p-2.5">New Limit (Proposed)</th>
                          <th className="p-2.5 text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white font-mono text-[11px]">
                        {excelPreviewModal.matchedRows.map((item, idx) => (
                          <tr key={idx} className="hover:bg-cyan-50/40">
                            <td className="p-2.5 font-sans font-medium text-slate-400">{idx + 1}</td>
                            <td className="p-2.5 font-bold text-slate-800">{item.identifierVal}</td>
                            <td className="p-2.5 font-sans">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-slate-900">
                                  {item.matchedUser.name || item.matchedUser.full_name || `User #${item.matchedUser.id}`}
                                </span>
                                <span className="uppercase text-[9px] bg-slate-100 px-1.5 py-0.2 rounded font-bold text-slate-600">
                                  {item.matchedUser.role || "User"}
                                </span>
                              </div>
                            </td>
                            <td className="p-2.5 text-slate-500">{item.previousStateStr}</td>
                            <td className="p-2.5 font-bold text-emerald-700 bg-emerald-50/50">{item.newStateStr}</td>
                            <td className="p-2.5 text-right font-sans">
                              {item.isWarning ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-200">
                                  <AlertTriangle className="w-3 h-3 text-amber-600" />
                                  {item.warningMessage}
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                  Ready
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Unmatched / Skipped Rows Details */}
              {excelPreviewModal.unmatchedRowsCount > 0 && (
                <div className="bg-amber-50/80 rounded-xl border border-amber-200 p-3.5 space-y-2 text-xs">
                  <div className="flex items-center justify-between text-amber-900 font-bold">
                    <span className="flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
                      <span>Skipped / Unmatched Rows ({excelPreviewModal.unmatchedRowsCount})</span>
                    </span>
                    <span className="text-[11px] font-normal text-amber-700">These rows will be ignored during import.</span>
                  </div>
                  <div className="max-h-28 overflow-y-auto space-y-1 pr-1 font-mono text-[11px]">
                    {excelPreviewModal.unmatchedRowsDetails.map((unmatched, uIdx) => (
                      <div key={uIdx} className="bg-white/80 p-2 rounded-lg border border-amber-200/80 flex items-center justify-between text-amber-950">
                        <span>Row #{unmatched.rowNum}: Identifier <strong>"{unmatched.identifierVal}"</strong> (Limit: {unmatched.rawLimitVal})</span>
                        <span className="text-[10px] text-amber-700 font-bold font-sans bg-amber-100 px-2 py-0.5 rounded">{unmatched.reason}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer Controls */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-100 flex-shrink-0">
              <span className="text-xs text-slate-500 font-medium">
                {excelPreviewModal.matchedRows.length > 0
                  ? `Ready to update limits for ${excelPreviewModal.matchedRows.length} user(s).`
                  : "No valid users to update."}
              </span>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setExcelPreviewModal((prev) => ({ ...prev, isOpen: false }));
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors border border-slate-200"
                >
                  Cancel & Discard
                </button>
                <button
                  type="button"
                  disabled={excelPreviewModal.matchedRows.length === 0 || isProcessingExcel}
                  onClick={handleConfirmExcelApply}
                  className="px-5 py-2 text-xs font-bold text-white bg-[#00D3CD] hover:bg-[#00bdb7] rounded-xl transition-colors shadow-md flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {isProcessingExcel ? "Applying Limits..." : `Confirm & Apply Limits (${excelPreviewModal.matchedRows.length})`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Pre-Save Confirmation Pop-up Modal */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
              <div className="p-2.5 bg-cyan-50 text-[#00D3CD] rounded-xl">
                <Sliders className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">{confirmModal.title}</h3>
                <p className="text-xs text-slate-500">Please review your changes before confirming.</p>
              </div>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2.5 text-xs">
              <p className="text-slate-700 font-medium">{confirmModal.message}</p>

              {confirmModal.user && (
                <div className="flex items-center justify-between text-slate-700 bg-white p-2.5 rounded-lg border border-slate-200 font-mono text-[11px]">
                  <span>User: <strong>{confirmModal.user.name || confirmModal.user.full_name || `User #${confirmModal.user.id}`}</strong></span>
                  <span className="uppercase text-[10px] bg-slate-100 px-2 py-0.5 rounded font-bold">{confirmModal.user.role || 'User'}</span>
                </div>
              )}

              <div className="flex items-center justify-between bg-white p-2.5 rounded-lg border border-slate-200">
                <span className="text-slate-500 font-medium">Previous State:</span>
                <span className="font-mono font-bold text-slate-700">{confirmModal.previousState}</span>
              </div>

              <div className="flex items-center justify-between bg-cyan-50 p-2.5 rounded-lg border border-cyan-200">
                <span className="text-cyan-900 font-bold">New Proposed State:</span>
                <span className="font-mono font-black text-[#00D3CD]">{confirmModal.newState}</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
                className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors border border-slate-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (confirmModal.onConfirm) confirmModal.onConfirm();
                  setConfirmModal((prev) => ({ ...prev, isOpen: false }));
                }}
                className="px-5 py-2 text-xs font-bold text-white bg-[#00D3CD] hover:bg-[#00bdb7] rounded-xl transition-colors shadow-md flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                {confirmModal.actionType === "LIMIT"
                  ? "Confirm & Save Limit"
                  : confirmModal.actionType === "SETTLEMENT"
                    ? "Confirm Mode Switch"
                    : "Confirm Bulk Update"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Post-Save Success Confirmation Modal */}
      {successModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-emerald-100 space-y-4 text-center">
            <div className="mx-auto w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center shadow-inner">
              <CheckCircle2 className="w-7 h-7 stroke-[2.5]" />
            </div>

            <div className="space-y-1">
              <h3 className="text-lg font-bold text-slate-900">{successModal.title}</h3>
              <p className="text-xs text-slate-600">{successModal.message}</p>
            </div>

            {successModal.changeSummary && (
              <div className="bg-emerald-50/80 p-3 rounded-xl border border-emerald-200 text-xs font-mono font-bold text-emerald-900 flex items-center justify-center gap-2">
                <span>{successModal.changeSummary}</span>
              </div>
            )}

            <p className="text-[11px] text-slate-400">
              ✓ Changes saved to system and audit-logged in System Activity Log.
            </p>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => setSuccessModal((prev) => ({ ...prev, isOpen: false }))}
                className="w-full py-2.5 text-xs font-bold text-white bg-[#00D3CD] hover:bg-[#00bdb7] rounded-xl transition-colors shadow-md"
              >
                Done & Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
