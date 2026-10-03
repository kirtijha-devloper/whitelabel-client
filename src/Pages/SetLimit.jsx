import React, { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { AllUsers, searchUsers } from "../api/FranchiseApi";
import { fetchServiceSettings } from "../api/serviceSettingsApi";
import { useServiceSettingsPolling } from "../hooks/useServiceSettingsPolling";
import { getServiceFlagValue } from "../utils/serviceFlags";
import {
  getAllUserDailyLimits,
  setUserDailyLimit,
  getDefaultDailyLimit,
  setDefaultDailyLimit,
  getUserTodayUtilized,
  getEffectiveUserDailyLimit,
  recordLimitAuditLog,
  getGlobalFreeWill,
  setGlobalFreeWill,
} from "../utils/userLimit";
import {
  extractUsersArray,
  maskEmailForUser,
  normalizeUserRole,
} from "../utils/userAccess";
import { hasPermission } from "../utils/accessControl";
import { toast } from "react-toastify";
import { Search, Save, CheckCircle2, AlertCircle, Settings, Loader2, X, ShieldAlert, Globe, Upload, Download, FileSpreadsheet, Zap } from "lucide-react";

export default function SetLimit({ currentUser }) {
  const queryClient = useQueryClient();
  const canManualOverride = hasPermission(currentUser, "set_limit.manual");
  const canExcelUpload = hasPermission(currentUser, "set_limit.excel");
  const canFreeWill = hasPermission(currentUser, "set_limit.free_will");
  const canGlobalFreeWill = hasPermission(currentUser, "set_limit.global_free_will") || canFreeWill;

  // Search state
  const [searchInput, setSearchInput] = useState("");
  const [appliedSearchTerm, setAppliedSearchTerm] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [isSuggestionsOpen, setIsSuggestionsOpen] = useState(false);
  const searchContainerRef = useRef(null);

  // Role filter: 'all' | 'franchise' | 'merchant' | 'employee'
  const [roleFilter, setRoleFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  // Default Limit State
  const [defaultLimitInput, setDefaultLimitInput] = useState("");
  const [savingDefault, setSavingDefault] = useState(false);

  // Local state for limit inputs per user { [userId]: stringAmount }
  const [limitInputs, setLimitInputs] = useState({});
  const [savingUserId, setSavingUserId] = useState(null);

  // Confirmation Modal state { type: 'user' | 'default', user?: object, amount: string|number }
  const [confirmModalData, setConfirmModalData] = useState(null);

  // Excel Import & Export State & Ref
  const fileInputRef = useRef(null);
  const [isUploadingExcel, setIsUploadingExcel] = useState(false);
  const [isExportingCSV, setIsExportingCSV] = useState(false);

  // Download all system users with their current daily limits as Excel/CSV format
  const handleDownloadUserLimitsCSV = async () => {
    try {
      setIsExportingCSV(true);
      const response = await AllUsers({ page: 1, limit: 10000 });
      const allSystemUsers = extractUsersArray(response) || [];
      const nonEmployeeUsers = allSystemUsers.filter(
        (u) => normalizeUserRole(u.role) !== "employee"
      );

      if (nonEmployeeUsers.length === 0) {
        toast.warn("No users found to export.");
        setIsExportingCSV(false);
        return;
      }

      const savedLimits = getAllUserDailyLimits();
      const currentDefault = getDefaultDailyLimit();

      const exportRows = nonEmployeeUsers.map((user) => {
        const customVal = savedLimits[user.id] ?? "";
        let limitVal = "";
        if (customVal === "unlimited") {
          limitVal = "unlimited";
        } else if (customVal !== "" && customVal !== null && customVal !== undefined) {
          limitVal = Number(customVal);
        } else if (currentDefault !== "" && currentDefault !== null && currentDefault !== undefined) {
          limitVal = Number(currentDefault);
        } else {
          limitVal = "";
        }

        return {
          "AbheePay ID": user.abheepay_id || user.id || "",
          "User Name": user.name || user.full_name || user.user_name || "",
          "Mobile Number": user.mobile_number || user.mobile || "",
          "Role": normalizeUserRole(user.role).toUpperCase(),
          "Daily Limit (₹)": limitVal,
        };
      });

      const worksheet = XLSX.utils.json_to_sheet(exportRows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "User Payout Limits");
      const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
      const blob = new Blob([excelBuffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      saveAs(blob, "User_Daily_Payout_Limits.xlsx");
      toast.success(`Exported ${exportRows.length} users with current daily limits to Excel/CSV!`);
    } catch (error) {
      console.error("Failed to export users CSV:", error);
      toast.error("Failed to export user daily limits.");
    } finally {
      setIsExportingCSV(false);
    }
  };

  // Process uploaded Excel file
  const handleExcelFileUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const fileName = file.name.toLowerCase();
    if (!fileName.endsWith(".xlsx") && !fileName.endsWith(".xls") && !fileName.endsWith(".csv")) {
      toast.error("Please upload a valid Excel or CSV file (.xlsx, .xls, .csv)");
      event.target.value = "";
      return;
    }

    try {
      setIsUploadingExcel(true);
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: "array" });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const rawRows = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

      if (!rawRows || rawRows.length === 0) {
        toast.error("The uploaded Excel file is empty.");
        setIsUploadingExcel(false);
        event.target.value = "";
        return;
      }

      // Fetch all system users to match against AbheePay ID, User ID, Mobile or Email
      const response = await AllUsers({ page: 1, limit: 10000 });
      const allSystemUsers = extractUsersArray(response) || [];

      let successCount = 0;
      let notFoundCount = 0;

      rawRows.forEach((row) => {
        const rawUserKey =
          row["AbheePay ID"] ||
          row["abheepay_id"] ||
          row["Abheepay ID"] ||
          row["User ID"] ||
          row["user_id"] ||
          row["ID"] ||
          row["id"] ||
          row["Mobile Number"] ||
          row["mobile_number"] ||
          row["Mobile"] ||
          row["mobile"] ||
          row["Email"] ||
          row["email"] ||
          "";

        const rawLimitVal =
          row["Daily Limit (₹)"] ||
          row["Daily Limit"] ||
          row["daily_limit"] ||
          row["Limit"] ||
          row["limit"] ||
          row["Amount"] ||
          row["amount"] ||
          "";

        const userIdentifier = String(rawUserKey).trim();
        const rawLimitStr = String(rawLimitVal).trim().toLowerCase();
        const sanitizedAmount =
          rawLimitStr === "unlimited" ||
          rawLimitStr === "freewill" ||
          rawLimitStr === "free will" ||
          rawLimitStr === "no limit"
            ? "unlimited"
            : String(rawLimitVal).replace(/\D/g, "");

        if (!userIdentifier) return;

        const matchedUser = allSystemUsers.find((u) => {
          const uId = String(u.id || "");
          const uAbheeId = String(u.abheepay_id || "").toUpperCase();
          const uMobile = String(u.mobile_number || u.mobile || "");
          const uEmail = String(u.email || "").toLowerCase();
          const searchNorm = userIdentifier.toUpperCase();

          return (
            uId === userIdentifier ||
            uAbheeId === searchNorm ||
            uMobile === userIdentifier ||
            uEmail === userIdentifier.toLowerCase()
          );
        });

        if (matchedUser && normalizeUserRole(matchedUser.role) !== "employee") {
          const prevVal = getEffectiveUserDailyLimit(matchedUser.id);
          const previousStateStr =
            String(prevVal).toLowerCase() === "unlimited"
              ? "⚡ Unlimited (Free Will)"
              : prevVal !== "" && prevVal !== null && prevVal !== undefined
              ? `₹${Number(prevVal).toLocaleString("en-IN")}`
              : "Default Limit";

          const newStateStr =
            sanitizedAmount === "unlimited"
              ? "⚡ Unlimited (Free Will)"
              : `₹${Number(sanitizedAmount).toLocaleString("en-IN")}`;

          setUserDailyLimit(matchedUser.id, sanitizedAmount);
          setLimitInputs((prev) => ({
            ...prev,
            [matchedUser.id]: sanitizedAmount,
          }));

          recordLimitAuditLog({
            performingUser: currentUser,
            affectedUser: matchedUser,
            previousState: previousStateStr,
            newState: newStateStr,
            action: "EXCEL_BULK_UPLOAD",
          });

          successCount++;
        } else {
          notFoundCount++;
        }
      });

      if (successCount > 0) {
        setGlobalFreeWill(false);
        setIsGlobalFreeWillActive(false);
        toast.success(`Limits updated successfully for ${successCount} users from Excel!`);
        refetch();
      } else {
        toast.warn("No matching users were found in the uploaded file.");
      }
    } catch (error) {
      console.error("Excel import error:", error);
      toast.error("Failed to parse Excel file. Please verify column structure.");
    } finally {
      setIsUploadingExcel(false);
      event.target.value = "";
    }
  };

  // Debounce query for live search suggestions
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchInput.trim());
    }, 250);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Click outside listener to close search suggestions dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target)) {
        setIsSuggestionsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch live search suggestions when typing
  const { data: suggestionsData, isLoading: isSuggestionsLoading } = useQuery({
    queryKey: ["setLimitSearchSuggestions", debouncedQuery],
    queryFn: () => searchUsers({ q: debouncedQuery, limit: 8 }),
    enabled: isSuggestionsOpen && debouncedQuery.length > 0,
    staleTime: 20 * 1000,
  });

  const suggestions = (extractUsersArray(suggestionsData) || []).filter(
    (u) => normalizeUserRole(u.role) !== "employee"
  );

  // Fetch Global Service Settings to check if Daily Limit is enabled globally
  const { data: serviceSettingsData } = useQuery({
    queryKey: ["admin-service-settings"],
    queryFn: fetchServiceSettings,
  });

  useServiceSettingsPolling();

  const isGlobalLimitActive = getServiceFlagValue(serviceSettingsData, "user_daily_limit", true);

  // Map roleFilter to backend API role parameter
  const apiRoleParam = roleFilter !== "all" ? roleFilter : "";

  // Fetch main users table data
  const {
    data: usersData,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["set-limit-users", currentPage, roleFilter, appliedSearchTerm],
    queryFn: () =>
      appliedSearchTerm
        ? searchUsers({
            q: appliedSearchTerm,
            page: currentPage,
            limit: pageSize,
            role: apiRoleParam,
          })
        : AllUsers({
            page: currentPage,
            limit: pageSize,
            role: apiRoleParam,
          }),
    keepPreviousData: true,
  });

  // Global Free Will state for all users
  const [isGlobalFreeWillActive, setIsGlobalFreeWillActive] = useState(() => getGlobalFreeWill());

  // Sync limits from storage and listen for live updates
  useEffect(() => {
    const syncLimits = () => {
      const savedLimits = getAllUserDailyLimits();
      setLimitInputs(savedLimits);
      const currentDefault = getDefaultDailyLimit();
      setDefaultLimitInput(currentDefault !== "" && currentDefault !== null ? String(currentDefault) : "");
      setIsGlobalFreeWillActive(getGlobalFreeWill());
    };

    syncLimits();

    window.addEventListener("userDailyLimitUpdated", syncLimits);
    window.addEventListener("storage", syncLimits);
    return () => {
      window.removeEventListener("userDailyLimitUpdated", syncLimits);
      window.removeEventListener("storage", syncLimits);
    };
  }, []);

  const handleToggleGlobalFreeWill = () => {
    if (!canGlobalFreeWill) {
      toast.error("You do not have permission to toggle Global Free Will!");
      return;
    }
    const nextState = !isGlobalFreeWillActive;
    setConfirmModalData({
      type: "global_free_will",
      nextState,
    });
  };

  const rawUsersList = extractUsersArray(usersData) || [];

  const filteredUsers = React.useMemo(() => {
    let list = rawUsersList.filter((u) => normalizeUserRole(u.role) !== "employee");
    if (!appliedSearchTerm) return list;
    const term = appliedSearchTerm.toLowerCase();
    return list.filter((u) => {
      const name = String(u.name || u.full_name || u.user_name || "").toLowerCase();
      const abheepayId = String(u.abheepay_id || u.id || "").toLowerCase();
      const mobile = String(u.mobile_number || u.mobile || "").toLowerCase();
      const email = String(u.email || "").toLowerCase();
      return (
        name.includes(term) ||
        abheepayId.includes(term) ||
        mobile.includes(term) ||
        email.includes(term)
      );
    });
  }, [rawUsersList, appliedSearchTerm]);

  const pagination = usersData?.data?.pagination || usersData?.pagination || {};
  const totalPages = pagination.totalPages || pagination.pages || (filteredUsers.length > pageSize ? Math.ceil(filteredUsers.length / pageSize) : 1);

  // Execute search filtering
  const handleExecuteSearch = (termToApply = searchInput) => {
    setAppliedSearchTerm(termToApply.trim());
    setCurrentPage(1);
    setIsSuggestionsOpen(false);
  };

  // Select item from live search suggestion list
  const handleSelectSuggestion = (user) => {
    const term = user.name || user.full_name || user.abheepay_id || user.mobile_number || "";
    setSearchInput(term);
    handleExecuteSearch(term);
  };

  // Clear search input and filter
  const handleClearSearch = () => {
    setSearchInput("");
    setAppliedSearchTerm("");
    setCurrentPage(1);
    setIsSuggestionsOpen(false);
  };

  // Strictly sanitize input to ONLY allow positive numbers (digits 0-9 only), or 'unlimited'
  const sanitizeDigitsOnly = (val) => {
    if (val === "" || val === null || val === undefined) return "";
    if (val === "unlimited") return "unlimited";
    return String(val).replace(/\D/g, "");
  };

  const handleInputChange = (userId, value) => {
    setLimitInputs((prev) => ({
      ...prev,
      [userId]: sanitizeDigitsOnly(value),
    }));
  };

  // Open confirmation modal for user limit
  const handleOpenUserConfirmModal = (user, explicitAmount = null) => {
    const amount = explicitAmount !== null ? explicitAmount : (limitInputs[user.id] ?? "");
    setConfirmModalData({ type: "user", user, amount: sanitizeDigitsOnly(amount) });
  };

  // Open confirmation modal for default limit
  const handleOpenDefaultConfirmModal = () => {
    setConfirmModalData({ type: "default", amount: sanitizeDigitsOnly(defaultLimitInput) });
  };

  // Final execution after admin confirms in pop-up modal
  const handleFinalSave = () => {
    if (!confirmModalData) return;

    if (confirmModalData.type === "global_free_will") {
      const nextState = confirmModalData.nextState;
      setConfirmModalData(null);

      setGlobalFreeWill(nextState);
      setIsGlobalFreeWillActive(nextState);

      recordLimitAuditLog({
        performingUser: currentUser,
        affectedUser: { name: "ALL USERS", abheepay_id: "GLOBAL", role: "ALL" },
        previousState: nextState ? "Individual Daily Limits" : "⚡ FREE WILL FOR ALL USERS",
        newState: nextState ? "⚡ FREE WILL FOR ALL USERS" : "Individual Daily Limits",
        action: nextState ? "GLOBAL_FREE_WILL_ENABLED" : "GLOBAL_FREE_WILL_DISABLED",
      });

      toast.success(
        nextState
          ? "⚡ Free Will enabled for ALL users! Everyone can now use their full wallet."
          : "Free Will disabled for all users. System returned to individual limits."
      );
      refetch();
      return;
    }

    if (confirmModalData.type === "default") {
      const amount = confirmModalData.amount;
      setConfirmModalData(null);
      setDefaultDailyLimit(amount);
      const formatted = amount ? `₹${Number(amount).toLocaleString("en-IN")}` : "No Limit";
      toast.success(
        amount
          ? `Default Daily Limit of ${formatted} applied for all unconfigured users.`
          : `Default Daily Limit cleared.`
      );
      refetch();
      return;
    }

    if (confirmModalData.type === "user") {
      const { user, amount } = confirmModalData;
      const userId = user.id;

      // Validate that limit cannot be reduced below what the user has already utilized today
      const userUsedToday = getUserTodayUtilized(userId, user);
      const proposedLimitNum = amount !== "" && amount !== null && amount !== undefined && amount !== "unlimited" ? Number(amount) : 0;
      if (amount !== "unlimited" && userUsedToday > 0 && proposedLimitNum < userUsedToday) {
        const nameStr = user.name || user.full_name || user.business_name || `User #${userId}`;
        toast.error(
          `Cannot reduce limit of ${nameStr} to ₹${proposedLimitNum.toLocaleString("en-IN")}! Merchant has already used ₹${userUsedToday.toLocaleString("en-IN")} today. Minimum limit allowed is ₹${userUsedToday.toLocaleString("en-IN")}.`
        );
        setConfirmModalData(null);
        return;
      }

      setConfirmModalData(null);

      const prevVal = getEffectiveUserDailyLimit(userId);
      const previousStateStr =
        String(prevVal).toLowerCase() === "unlimited"
          ? "⚡ Unlimited (Free Will)"
          : prevVal !== "" && prevVal !== null && prevVal !== undefined
          ? `₹${Number(prevVal).toLocaleString("en-IN")}`
          : "Default Limit";

      const newStateStr =
        amount === "unlimited"
          ? "⚡ Unlimited (Free Will)"
          : amount !== "" && amount !== null && amount !== undefined
          ? `₹${Number(amount).toLocaleString("en-IN")}`
          : "Default Limit";

      const actionType =
        amount === "unlimited"
          ? "FREE_WILL"
          : amount !== "" && amount !== null && amount !== undefined
          ? "LIMIT_SET"
          : "RESET";

      // Save limit immediately synchronously
      setUserDailyLimit(userId, amount);
      setLimitInputs((prev) => {
        const next = { ...prev };
        if (amount === "" || amount === null || amount === undefined) {
          delete next[userId];
        } else {
          next[userId] = amount;
        }
        return next;
      });

      recordLimitAuditLog({
        performingUser: currentUser,
        affectedUser: user,
        previousState: previousStateStr,
        newState: newStateStr,
        action: actionType,
      });

      const formattedAmount =
        amount === "unlimited"
          ? "⚡ Unlimited (Full Wallet)"
          : amount
          ? `₹${Number(amount).toLocaleString("en-IN")}`
          : "Default Limit";

      toast.success(
        amount === "unlimited"
          ? `⚡ Free Will enabled for ${user.name || "user"}! They can now use their full wallet amount.`
          : amount
          ? `Custom daily payout limit of ${formattedAmount} set for ${user.name || "user"}`
          : `Custom limit cleared for ${user.name || "user"}. User will now use Default Daily Limit.`
      );

      // Instant live refetch for users query
      refetch();
      queryClient.invalidateQueries(["allUsers"]);
      queryClient.invalidateQueries(["allUsersListForPosSetting"]);
      queryClient.invalidateQueries(["posSettings"]);
      queryClient.invalidateQueries(["userSearch"]);
      queryClient.invalidateQueries(["dashboard"]);
    }
  };

  const getRoleBadgeColor = (role) => {
    const norm = normalizeUserRole(role);
    if (norm === "admin") return "bg-purple-100 text-purple-800 border-purple-200";
    if (norm === "franchise") return "bg-emerald-100 text-emerald-800 border-emerald-200";
    if (norm === "merchant") return "bg-blue-100 text-blue-800 border-blue-200";
    if (norm === "employee") return "bg-amber-100 text-amber-800 border-amber-200";
    return "bg-gray-100 text-gray-800 border-gray-200";
  };

  const storedDefaultLimit = getDefaultDailyLimit();

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">User Payout Limit Setting</h1>
          <p className="text-sm text-gray-500 mt-1">
            Configure daily payout transaction limits for all users (Distributors & Merchants).
          </p>
        </div>

        {/* Global Limit Status Banner */}
        <div
          className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border text-sm font-medium ${
            isGlobalLimitActive
              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
              : "bg-amber-50 text-amber-800 border-amber-200"
          }`}
        >
          {isGlobalLimitActive ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
          )}
          <div>
            <span className="font-semibold">
              Global Limit Enforcement: {isGlobalLimitActive ? "ENABLED" : "DISABLED"}
            </span>
            {!isGlobalLimitActive && (
              <p className="text-xs text-amber-700">
                Limits won't apply until enabled in{" "}
                <Link to="/admin/setting" className="underline font-bold hover:text-amber-900">
                  Settings
                </Link>
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Free Will To All Users Global Toggle Card */}
      <div
        className={`p-5 rounded-2xl border shadow-sm transition-all duration-300 flex flex-col sm:flex-row items-center justify-between gap-4 ${
          isGlobalFreeWillActive
            ? "bg-gradient-to-r from-cyan-500/10 via-emerald-500/10 to-teal-500/10 border-[#00D3CD]/50 ring-1 ring-[#00D3CD]/30"
            : "bg-white border-gray-200"
        }`}
      >
        <div className="flex items-center gap-3.5">
          <div
            className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-sm flex-shrink-0 transition-colors ${
              isGlobalFreeWillActive ? "bg-[#00D3CD] text-white" : "bg-gray-100 text-gray-500"
            }`}
          >
            <Zap className="w-6 h-6 fill-current" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-bold text-gray-900">⚡ FREE WILL TO ALL USERS</h3>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-extrabold uppercase border ${
                  isGlobalFreeWillActive
                    ? "bg-[#00D3CD]/15 text-[#008f8b] border-[#00D3CD]/30"
                    : "bg-gray-100 text-gray-500 border-gray-200"
                }`}
              >
                {isGlobalFreeWillActive ? "GLOBAL FREE WILL ACTIVE (ALL ON)" : "OFF (INDIVIDUAL LIMITS)"}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              Turn ON to grant full wallet usage without any daily payout limits for ALL merchants & distributors across the system instantly.
            </p>
          </div>
        </div>

        {/* Toggle Switch */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">
            {isGlobalFreeWillActive ? "FREE WILL ALL ON" : "FREE WILL ALL OFF"}
          </span>
          <button
            type="button"
            disabled={!canFreeWill}
            onClick={handleToggleGlobalFreeWill}
            className={`relative inline-flex h-8 w-16 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#00D3CD] focus:ring-offset-2 ${
              isGlobalFreeWillActive ? "bg-[#00D3CD]" : "bg-gray-300"
            } ${!canFreeWill ? "opacity-50 cursor-not-allowed" : ""}`}
            title={canFreeWill ? "Toggle Free Will for All Users" : "No permission for Free Will"}
          >
            <span
              className={`pointer-events-none inline-block h-7 w-7 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                isGlobalFreeWillActive ? "translate-x-8" : "translate-x-0"
              }`}
            />
          </button>
        </div>
      </div>

      {/* Default Daily Limit For All Users Card (Hidden as requested) */}

      {/* Filters & Interactive Search with Suggestions */}
      <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm flex flex-col md:flex-row gap-4 justify-between items-center">
        <div ref={searchContainerRef} className="relative flex-1 w-full flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, email, username or mobile..."
              value={searchInput}
              onFocus={() => setIsSuggestionsOpen(true)}
              onChange={(e) => {
                setSearchInput(e.target.value);
                setIsSuggestionsOpen(true);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleExecuteSearch();
                }
              }}
              className="w-full pl-10 pr-9 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#00D3CD]/50 focus:border-[#00D3CD]"
            />
            {searchInput && (
              <button
                type="button"
                onClick={handleClearSearch}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5"
                title="Clear search"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => handleExecuteSearch()}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#00D3CD] hover:bg-[#00b8b2] text-white rounded-xl text-xs font-semibold shadow-sm transition-colors flex-shrink-0"
          >
            <Search className="w-3.5 h-3.5" />
            Search
          </button>

          {/* Auto-complete Suggestions Dropdown */}
          {isSuggestionsOpen && debouncedQuery.length > 0 && (
            <div className="absolute left-0 right-28 top-full mt-1.5 z-30 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden max-h-72 overflow-y-auto">
              {isSuggestionsLoading ? (
                <div className="p-4 text-center text-xs text-gray-500 flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-[#00D3CD]" />
                  <span>Searching user suggestions...</span>
                </div>
              ) : suggestions.length === 0 ? (
                <div className="p-4 text-center text-xs text-gray-500">
                  No user suggestions found for "{debouncedQuery}"
                </div>
              ) : (
                <ul className="divide-y divide-gray-100 text-sm">
                  {suggestions.map((user) => (
                    <li
                      key={user.id}
                      onClick={() => handleSelectSuggestion(user)}
                      className="p-3 hover:bg-cyan-50/60 cursor-pointer flex items-center justify-between transition-colors"
                    >
                      <div className="flex flex-col">
                        <span className="font-semibold text-gray-900 text-xs">
                          {user.name || user.full_name || user.user_name || "N/A"}
                        </span>
                        <span className="text-[11px] text-gray-500">
                          ID: {user.abheepay_id || user.id || "-"} | Mobile: {user.mobile_number || user.mobile || "-"}
                        </span>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${getRoleBadgeColor(
                          normalizeUserRole(user.role)
                        )} uppercase`}
                      >
                        {normalizeUserRole(user.role) || "User"}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        {/* Role Filter Select & Excel Actions */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <select
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#00D3CD]/50"
          >
            <option value="all">All Roles</option>
            <option value="super_franchise">Super Franchise</option>
            <option value="franchise">Distributors (Franchise)</option>
            <option value="merchant">Merchants</option>
          </select>

          {/* Hidden File Input */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleExcelFileUpload}
            accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
            className="hidden"
          />

          {/* Upload Excel Button */}
          <button
            type="button"
            onClick={() => canExcelUpload && fileInputRef.current?.click()}
            disabled={isUploadingExcel || !canExcelUpload}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm disabled:opacity-50 flex-shrink-0"
            title={!canExcelUpload ? "No permission to upload Excel limit" : "Upload Excel file to set daily limits in bulk"}
          >
            {isUploadingExcel ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Upload className="w-4 h-4" />
            )}
            <span>{isUploadingExcel ? "Uploading Excel..." : "Upload Excel Limit"}</span>
          </button>

          {/* Download / Export Users Limits CSV Button */}
          <button
            type="button"
            onClick={handleDownloadUserLimitsCSV}
            disabled={isExportingCSV}
            className="flex items-center justify-center gap-1.5 px-3.5 py-2 bg-[#00D3CD]/10 hover:bg-[#00D3CD]/20 text-[#008f8b] border border-[#00D3CD]/30 rounded-xl text-xs font-bold transition-colors flex-shrink-0 disabled:opacity-50"
            title="Download CSV containing all users and their current daily payout limits"
          >
            {isExportingCSV ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <FileSpreadsheet className="w-3.5 h-3.5 text-[#00D3CD]" />
            )}
            <span>{isExportingCSV ? "Exporting CSV..." : "Download User Limits CSV"}</span>
          </button>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50/80 border-b border-gray-200 text-gray-600 font-semibold uppercase text-xs tracking-wider">
              <tr>
                <th className="px-6 py-4 w-16">SL</th>
                <th className="px-6 py-4">USER</th>
                <th className="px-6 py-4 w-36">ROLE & TYPE</th>
                <th className="px-6 py-4 w-60">SET LIMIT (₹ TODAY)</th>
                <th className="px-6 py-4 w-52 text-center">FREE WILL (FULL WALLET)</th>
                <th className="px-6 py-4 w-40">LIMIT UTILIZED</th>
                <th className="px-6 py-4 w-40">LIMIT LEFT</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center text-gray-500">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="w-5 h-5 animate-spin text-[#00D3CD]" />
                      <span>Loading user list...</span>
                    </div>
                  </td>
                </tr>
              ) : isError ? (
                <tr>
                  <td colSpan="7" className="px-6 py-8 text-center text-red-500">
                    Failed to load users.{" "}
                    <button onClick={() => refetch()} className="underline font-semibold">
                      Retry
                    </button>
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-8 text-center text-gray-500">
                    No matching users found.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user, index) => {
                  const sl = (currentPage - 1) * pageSize + index + 1;
                  const currentCustomVal = limitInputs[user.id] ?? "";
                  const hasCustomLimit = currentCustomVal !== "" && currentCustomVal !== null;
                  const roleName = normalizeUserRole(user.role);
                  const isUserFreeWillActive = isGlobalFreeWillActive || currentCustomVal === "unlimited";

                  // Calculate effective limit, utilized amount & limit left
                  const effectiveLimitNum = isUserFreeWillActive
                    ? null
                    : hasCustomLimit
                    ? Number(currentCustomVal)
                    : storedDefaultLimit !== ""
                    ? Number(storedDefaultLimit)
                    : null;

                  const utilizedAmount = getUserTodayUtilized(user.id, user);
                  const limitLeft =
                    isUserFreeWillActive
                      ? null
                      : effectiveLimitNum !== null && Number.isFinite(effectiveLimitNum)
                      ? Math.max(0, effectiveLimitNum - utilizedAmount)
                      : null;

                  return (
                    <tr key={user.id} className="hover:bg-gray-50/60 transition-colors">
                      {/* SL */}
                      <td className="px-6 py-4 font-semibold text-gray-500">{sl}</td>

                      {/* USER */}
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="font-semibold text-gray-900">
                            {user.name || user.full_name || user.user_name || "N/A"}
                          </span>
                          <span className="text-xs text-gray-500">
                            ID: {user.abheepay_id || user.id || "-"} | Mobile:{" "}
                            {user.mobile_number || user.mobile || "-"}
                          </span>
                          {user.email && (
                            <span className="text-xs text-gray-400">
                              {maskEmailForUser(user.email, currentUser)}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* ROLE & TYPE */}
                      <td className="px-6 py-4">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getRoleBadgeColor(
                            roleName
                          )} uppercase`}
                        >
                          {roleName || "User"}
                        </span>
                      </td>

                      {/* SET LIMIT */}
                      <td className="px-6 py-4">
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2">
                            <div className="relative flex-1">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-bold">
                                ₹
                              </span>
                              <input
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                disabled={!canManualOverride || isGlobalFreeWillActive}
                                placeholder={
                                  isUserFreeWillActive
                                    ? "⚡ Unlimited (Free Will Active)"
                                    : storedDefaultLimit !== ""
                                    ? `Default (₹${Number(storedDefaultLimit).toLocaleString("en-IN")})`
                                    : "No limit"
                                }
                                onWheel={(e) => e.target.blur()}
                                onKeyDown={(e) => {
                                  if (e.key === "-" || e.key === "." || e.key === "e" || e.key === "E") {
                                    e.preventDefault();
                                  }
                                }}
                                onChange={(e) => handleInputChange(user.id, e.target.value)}
                                className={`w-full pl-7 pr-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#00D3CD]/50 focus:border-[#00D3CD] focus:bg-white transition-all font-medium [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
                                  !canManualOverride || isGlobalFreeWillActive ? "opacity-60 cursor-not-allowed" : ""
                                }`}
                              />
                            </div>
                            <button
                              onClick={() => handleOpenUserConfirmModal(user)}
                              disabled={savingUserId === user.id || !canManualOverride || isGlobalFreeWillActive}
                              title={!canManualOverride ? "No permission to edit limit" : "Save Limit"}
                              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#00D3CD] hover:bg-[#00b8b2] text-white rounded-xl text-xs font-semibold transition-colors shadow-sm disabled:opacity-50 flex-shrink-0"
                            >
                              {savingUserId === user.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Save className="w-3.5 h-3.5" />
                              )}
                              Save
                            </button>
                          </div>

                          {/* Status Subtext */}
                          <div className="text-[11px]">
                            {isGlobalFreeWillActive ? (
                              <span className="font-extrabold text-[#008f8b]">⚡ Global Free Will Active</span>
                            ) : currentCustomVal === "unlimited" ? (
                              <span className="font-bold text-cyan-700">⚡ User Free Will Active</span>
                            ) : hasCustomLimit ? (
                              <span className="font-semibold text-cyan-700">★ Custom Limit Active</span>
                            ) : storedDefaultLimit !== "" ? (
                              <span className="text-gray-500">
                                Default:{" "}
                                <strong className="text-gray-700">
                                  ₹{Number(storedDefaultLimit).toLocaleString("en-IN")}
                                </strong>
                              </span>
                            ) : (
                              <span className="text-gray-400">No Limit Configured</span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* FREE WILL (FULL WALLET) - DEDICATED COLUMN */}
                      <td className="px-6 py-4 text-center">
                        {isGlobalFreeWillActive ? (
                          <div className="flex flex-col items-center gap-1">
                            <span className="inline-flex items-center gap-1 font-extrabold text-white bg-[#00D3CD] px-3 py-1 rounded-xl text-xs shadow-sm">
                              ⚡ Global Free Will ON
                            </span>
                            <span className="text-[10px] text-[#008f8b] font-medium">All Users Free Will Active</span>
                          </div>
                        ) : currentCustomVal === "unlimited" ? (
                          <div className="flex flex-col items-center gap-1">
                            <span className="inline-flex items-center gap-1 font-bold text-cyan-800 bg-cyan-50 px-2.5 py-1 rounded-lg border border-cyan-200 text-xs">
                              ⚡ Free Will Active
                            </span>
                            <button
                              type="button"
                              disabled={!canFreeWill}
                              onClick={() => handleOpenUserConfirmModal(user, "")}
                              className={`text-xs underline font-semibold mt-0.5 ${
                                !canFreeWill ? "text-gray-400 cursor-not-allowed opacity-60" : "text-red-600 hover:text-red-800"
                              }`}
                              title={!canFreeWill ? "No permission to reset Free Will limit" : "Reset/Remove Free Will limit"}
                            >
                              Reset Limit
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            disabled={!canFreeWill}
                            onClick={() => handleOpenUserConfirmModal(user, "unlimited")}
                            className="w-full px-3 py-1.5 bg-[#00D3CD] hover:bg-[#00b8b2] text-white font-bold rounded-xl text-xs shadow-sm transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                            title={!canFreeWill ? "No permission to grant Free Will" : "Give Free Will to use full wallet without daily payout cap"}
                          >
                            ⚡ Free Will (Full Wallet)
                          </button>
                        )}
                      </td>

                      {/* LIMIT UTILIZED */}
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span
                            className={`inline-block px-2.5 py-1 rounded-lg text-xs font-semibold w-max border ${
                              utilizedAmount > 0
                                ? "bg-amber-50 text-amber-800 border-amber-200"
                                : "bg-gray-100 text-gray-700 border-gray-200"
                            }`}
                          >
                            ₹{utilizedAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                          </span>
                          <span className="text-[10px] text-gray-400 mt-1">Used Today</span>
                        </div>
                      </td>

                      {/* LIMIT LEFT */}
                      <td className="px-6 py-4">
                        {isUserFreeWillActive ? (
                          <div className="flex flex-col">
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-extrabold bg-cyan-50 text-cyan-800 shadow-sm border border-cyan-300">
                              ⚡ Full Wallet (No Cap)
                            </span>
                            <span className="text-[10px] text-cyan-700 font-medium mt-1">
                              {isGlobalFreeWillActive ? "Global Free Will Active" : "Free Will Granted"}
                            </span>
                          </div>
                        ) : limitLeft !== null ? (
                          <div className="flex flex-col">
                            <span
                              className={`inline-block px-2.5 py-1 rounded-lg text-xs font-bold w-max border ${
                                limitLeft > 0
                                  ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                                  : "bg-red-50 text-red-800 border-red-200"
                              }`}
                            >
                              ₹{limitLeft.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                            </span>
                            <span className="text-[10px] text-gray-400 mt-1">
                              {limitLeft > 0 ? "Remaining Today" : "Limit Reached"}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400 italic">No Limit Set</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between p-4 border-t border-gray-200 bg-gray-50/50">
            <span className="text-xs text-gray-500">
              Page {currentPage} of {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 bg-white border border-gray-200 text-gray-700 text-xs font-medium rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => p + 1)}
                className="px-3 py-1.5 bg-white border border-gray-200 text-gray-700 text-xs font-medium rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Confirmation Pop-up Modal */}
      {confirmModalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 border border-gray-100">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-gray-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-100 text-amber-600">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">
                    {confirmModalData.type === "global_free_will"
                      ? confirmModalData.nextState
                        ? "Confirm Enable ⚡ Free Will For All"
                        : "Confirm Disable Global Free Will"
                      : confirmModalData.type === "default"
                      ? "Confirm Default Daily Limit"
                      : confirmModalData.amount === "unlimited"
                      ? "Confirm ⚡ Free Will Access"
                      : "Confirm Custom Daily Payout Limit"}
                  </h3>
                  <p className="text-xs text-gray-500">Please review details before applying limit</p>
                </div>
              </div>
              <button
                onClick={() => setConfirmModalData(null)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body / Details */}
            {confirmModalData.type === "global_free_will" ? (
              <div className="bg-[#00D3CD]/10 border border-[#00D3CD]/30 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2 text-[#008f8b] font-bold text-sm">
                  <Zap className="w-5 h-5 fill-current" />
                  <span>
                    {confirmModalData.nextState
                      ? "Enable Free Will for ALL System Users"
                      : "Disable Global Free Will"}
                  </span>
                </div>
                <p className="text-xs text-gray-700 leading-relaxed">
                  {confirmModalData.nextState
                    ? "Are you sure you want to enable Free Will for ALL Merchants & Distributors across the system? Every user will be able to perform payouts up to their full available wallet balance without any daily limit caps."
                    : "Are you sure you want to turn off Global Free Will? All users will revert back to their individual configured limits or default daily limit."}
                </p>
              </div>
            ) : confirmModalData.type === "default" ? (
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-200/80 space-y-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-500">Scope:</span>
                  <span className="font-semibold text-gray-900">All System Users</span>
                </div>
                <div className="border-t border-gray-200 pt-3 flex justify-between items-center">
                  <span className="text-gray-700 font-medium">New Default Limit Today:</span>
                  <span className="text-base font-extrabold text-[#00D3CD]">
                    {confirmModalData.amount
                      ? `₹${Number(confirmModalData.amount).toLocaleString("en-IN")}`
                      : "No Default Limit"}
                  </span>
                </div>
              </div>
            ) : (
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-200/80 space-y-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-500">User Name:</span>
                  <span className="font-semibold text-gray-900">
                    {confirmModalData.user.name || confirmModalData.user.full_name || "N/A"}
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-500">AbheePay ID:</span>
                  <span className="font-semibold text-gray-700">
                    {confirmModalData.user.abheepay_id || confirmModalData.user.id || "-"}
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-500">Role:</span>
                  <span className="capitalize font-semibold text-gray-700">
                    {normalizeUserRole(confirmModalData.user.role)}
                  </span>
                </div>
                <div className="border-t border-gray-200 pt-3 flex justify-between items-center">
                  <span className="text-gray-700 font-medium">Custom Daily Limit Today:</span>
                  <span className="text-base font-extrabold text-[#00D3CD]">
                    {confirmModalData.amount === "unlimited"
                      ? "⚡ Unlimited (Full Wallet)"
                      : confirmModalData.amount
                      ? `₹${Number(confirmModalData.amount).toLocaleString("en-IN")}`
                      : "Default Limit"}
                  </span>
                </div>
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setConfirmModalData(null)}
                className="flex-1 py-2.5 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl text-xs transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleFinalSave}
                className="flex-1 py-2.5 px-4 bg-[#00D3CD] hover:bg-[#00b8b2] text-white font-bold rounded-xl text-xs transition-colors shadow-sm"
              >
                {confirmModalData.type === "global_free_will"
                  ? confirmModalData.nextState
                    ? "Confirm & Enable Free Will"
                    : "Confirm & Disable Free Will"
                  : "Confirm & Set Limit"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
