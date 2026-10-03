import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  RefreshCcw,
  ChevronLeft,
  ChevronRight,
  Filter,
  User,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  Clock,
  Globe,
  SlidersHorizontal,
  Search,
  X,
  Calendar,
} from "lucide-react";
import { fetchServiceToggleAuditLogs } from "../api/serviceSettingsApi";
import { getLocalLimitAuditLogs } from "../utils/userLimit";

const SERVICE_LABEL_MAP = {
  complaint_ticket: "Help & Complaints",
  vimo_payout: "Vimo Payout",
  branchx_payout: "BranchX Payout",
  sevenpay_payout: "SevenPay Payout",
  mx_payout: "Payout MX",
  ndia5_payout: "PAYOUT-N",
  cc_bill_pay: "CC Bill",
  ba_cc_bill_pay: "BA CC Bill",
  cc_bill_3: "CC Bill 3",
  admin_credit: "Admin Credit",
  admin_debit: "Admin Debit",
  settlement_type: "Settlement Type",
  user_daily_limit: "User Daily Limit",
  pos_t0_settlement: "POS Settlement Evaluator",
  telering_manual: "Telering Manual",
};

const SERVICE_OPTIONS = [
  { value: "", label: "All Services" },
  { value: "complaint_ticket", label: "Help & Complaints" },
  { value: "pos_t0_settlement", label: "POS Settlement Evaluator" },
  { value: "user_daily_limit", label: "User Daily Limit" },
  { value: "vimo_payout", label: "Vimo Payout" },
  { value: "sevenpay_payout", label: "SevenPay Payout" },
  { value: "ndia5_payout", label: "PAYOUT-N (ndia5)" },
  { value: "branchx_payout", label: "BranchX Payout" },
  { value: "mx_payout", label: "Payout MX" },
  { value: "cc_bill_pay", label: "CC Bill" },
  { value: "ba_cc_bill_pay", label: "BA CC Bill" },
  { value: "cc_bill_3", label: "CC Bill 3" },
  { value: "admin_credit", label: "Admin Credit" },
  { value: "admin_debit", label: "Admin Debit" },
  { value: "settlement_type", label: "Settlement Type" },
  { value: "telering_manual", label: "Telering Manual" },
];

const PAGE_LIMIT_OPTIONS = [25, 50, 100];

const getTodayDateString = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export default function SystemActivityLog() {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [serviceKey, setServiceKey] = useState("");
  const [searchInputValue, setSearchInputValue] = useState("");
  const [committedSearch, setCommittedSearch] = useState("");
  const [startDate, setStartDate] = useState(getTodayDateString());
  const [endDate, setEndDate] = useState(getTodayDateString());

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["serviceToggleAuditLogs", page, limit, serviceKey, committedSearch, startDate, endDate],
    queryFn: async () => {
      let apiLogs = [];
      try {
        const res = await fetchServiceToggleAuditLogs({
          page: 1,
          limit: 1000,
          service_key: serviceKey,
          search: committedSearch,
          start_date: startDate,
          end_date: endDate,
        });
        apiLogs = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
      } catch (e) {
        console.warn("API audit logs fetch warning:", e);
      }

      let localLogs = getLocalLimitAuditLogs();

      if (serviceKey) {
        localLogs = localLogs.filter((l) => l.service_key === serviceKey);
      }

      if (committedSearch) {
        const term = committedSearch.toLowerCase();
        localLogs = localLogs.filter((l) => {
          const perfName = String(l.performingUser?.name || l.user?.name || "").toLowerCase();
          const perfAbhee = String(l.performingUser?.abheepay_id || l.user?.abheepay_id || "").toLowerCase();
          const affName = String(l.affectedUser?.name || l.affected_user?.name || "").toLowerCase();
          const affAbhee = String(l.affectedUser?.abheepay_id || l.affected_user?.abheepay_id || "").toLowerCase();
          return (
            perfName.includes(term) ||
            perfAbhee.includes(term) ||
            affName.includes(term) ||
            affAbhee.includes(term)
          );
        });
      }

      if (startDate || endDate) {
        localLogs = localLogs.filter((l) => {
          const logDateStr = l.createdAt ? l.createdAt.split("T")[0] : "";
          if (!logDateStr) return true;
          if (startDate && logDateStr < startDate) return false;
          if (endDate && logDateStr > endDate) return false;
          return true;
        });
      }

      // Merge API logs (from server database, visible on all admin desktops) with local logs
      const combinedMap = new Map();
      
      apiLogs.forEach((item) => {
        const key = item.id || `${item.service_key}_${item.createdAt}_${item.user_id || item.user?.id || ''}_${item.affected_user_id || item.affected_user?.id || ''}`;
        combinedMap.set(String(key), item);
      });

      localLogs.forEach((item) => {
        const key = item.id || `${item.service_key}_${item.createdAt}_${item.performingUser?.id || ''}_${item.affectedUser?.id || ''}`;
        if (!combinedMap.has(String(key))) {
          combinedMap.set(String(key), item);
        }
      });

      const merged = Array.from(combinedMap.values());
      merged.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

      const totalCount = merged.length;
      const totalPages = Math.max(1, Math.ceil(totalCount / limit));
      const startIndex = (page - 1) * limit;
      const paginatedLogs = merged.slice(startIndex, startIndex + limit);

      return {
        data: paginatedLogs,
        count: totalCount,
        totalPages,
      };
    },
    keepPreviousData: true,
  });

  const logs = Array.isArray(data?.data) ? data.data : [];
  const totalCount = Number(data?.count) || 0;
  const totalPages = Number(data?.totalPages) || Math.max(1, Math.ceil(totalCount / limit));

  const handleServiceChange = (e) => {
    setServiceKey(e.target.value);
    setPage(1);
  };

  const handleLimitChange = (e) => {
    setLimit(Number(e.target.value));
    setPage(1);
  };

  const handleSearchChange = (e) => {
    const val = e.target.value;
    setSearchInputValue(val);
    setCommittedSearch(val.trim());
    setPage(1);
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setCommittedSearch(searchInputValue.trim());
    setPage(1);
  };

  const handleSearchClear = () => {
    setSearchInputValue("");
    setCommittedSearch("");
    setPage(1);
  };

  const handleStartDateChange = (e) => {
    setStartDate(e.target.value);
    setPage(1);
  };

  const handleEndDateChange = (e) => {
    setEndDate(e.target.value);
    setPage(1);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "-";
    try {
      const date = new Date(dateStr);
      if (Number.isNaN(date.getTime())) return String(dateStr);
      return date.toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      });
    } catch (_e) {
      return String(dateStr);
    }
  };

  const formatIpAddress = (ip) => {
    if (!ip) return "Local";
    const str = String(ip).trim();
    if (str === "::1" || str === "::ffff:127.0.0.1") return "127.0.0.1";
    if (str.startsWith("::ffff:")) return str.replace("::ffff:", "");
    return str;
  };

  const renderStateBadge = (isEnabled) => {
    if (isEnabled) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
          ENABLED
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
        <XCircle className="w-3.5 h-3.5 text-rose-500" />
        DISABLED
      </span>
    );
  };

  const renderActionBadge = (log) => {
    const actionStr = typeof log === "object" ? log?.action : log;
    const actUpper = String(actionStr || "").toUpperCase();

    const balanceBefore = typeof log === "object" && log?.balance_before !== null && log?.balance_before !== undefined
      ? Number(log.balance_before)
      : null;
    const balanceAfter = typeof log === "object" && log?.balance_after !== null && log?.balance_after !== undefined
      ? Number(log.balance_after)
      : null;

    let amountDiff = null;
    if (balanceBefore !== null && balanceAfter !== null) {
      amountDiff = Math.abs(balanceAfter - balanceBefore);
    }

    if (actUpper === "SUBMIT" || actUpper === "TICKET_RAISED") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider bg-purple-100 text-purple-800 border border-purple-200">
          🎟️ TICKET RAISED
        </span>
      );
    }

    if (actUpper === "ADMIN_REPLY") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider bg-blue-100 text-blue-800 border border-blue-200">
          💬 ADMIN REPLY
        </span>
      );
    }

    if (actUpper === "CLOSED" || actUpper === "TICKET_CLOSED") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider bg-gray-100 text-gray-700 border border-gray-300">
          🔒 TICKET CLOSED
        </span>
      );
    }

    if (actUpper === "RESOLVED" || actUpper === "TICKET_RESOLVED") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300">
          ✅ RESOLVED
        </span>
      );
    }

    if (actUpper === "STATUS_UPDATE") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-200">
          📝 STATUS UPDATE
        </span>
      );
    }

    if (actUpper === "FREE_WILL") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-extrabold uppercase tracking-wider bg-[#00D3CD] text-white shadow-sm">
          ⚡ FREE WILL
        </span>
      );
    }

    if (actUpper === "LIMIT_SET") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider bg-blue-100 text-blue-800 border border-blue-200">
          LIMIT SET
        </span>
      );
    }

    if (actUpper === "RESET" || actUpper === "RESET_LIMIT") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-200">
          RESET
        </span>
      );
    }

    if (actUpper === "EXCEL_BULK_UPLOAD") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300">
          EXCEL IMPORT
        </span>
      );
    }

    if (actUpper === "CREDIT") {
      return (
        <div className="flex flex-col items-center gap-0.5">
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-extrabold uppercase tracking-wider bg-emerald-600 text-white shadow-sm">
            CREDIT
          </span>
          {amountDiff !== null && (
            <span className="text-xs font-bold text-emerald-600 font-mono">
              +₹{amountDiff.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          )}
        </div>
      );
    }

    if (actUpper === "DEBIT") {
      return (
        <div className="flex flex-col items-center gap-0.5">
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-extrabold uppercase tracking-wider bg-rose-600 text-white shadow-sm">
            DEBIT
          </span>
          {amountDiff !== null && (
            <span className="text-xs font-bold text-rose-600 font-mono">
              -₹{amountDiff.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          )}
        </div>
      );
    }

    if (actUpper === "ENABLE") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300">
          ENABLE
        </span>
      );
    }

    if (actUpper === "DISABLE") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider bg-rose-100 text-rose-800 border border-rose-200">
          DISABLE
        </span>
      );
    }

    if (actUpper === "T0" || actUpper === "T") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-extrabold uppercase tracking-wider bg-teal-600 text-white shadow-sm">
          T0
        </span>
      );
    }

    if (actUpper === "T+1" || actUpper === "T1") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-extrabold uppercase tracking-wider bg-indigo-600 text-white shadow-sm">
          T+1
        </span>
      );
    }

    if (actUpper === "UPLOAD") {
      return (
        <div className="flex flex-col items-center gap-0.5">
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-extrabold uppercase tracking-wider bg-gray-100 text-gray-700 border border-gray-200 shadow-sm">
            UPLOAD
          </span>
          {amountDiff !== null && (
            <span className="text-xs font-bold text-emerald-600 font-mono">
              +₹{amountDiff.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          )}
        </div>
      );
    }

    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider bg-gray-100 text-gray-700 border border-gray-200">
        {actUpper || "-"}
      </span>
    );
  };

  const renderUserBadge = (user, fallbackText = "Global Setting") => {
    if (!user) {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
          <Globe className="w-3 h-3 text-gray-400" />
          {fallbackText}
        </span>
      );
    }

    const roleName = user.role
      ? `${user.role.charAt(0).toUpperCase()}${user.role.slice(1)}`
      : "";

    return (
      <div className="space-y-0.5">
        <div className="font-medium text-gray-900 text-sm">{user.name || "-"}</div>
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <span className="font-mono text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded">
            {user.abheepay_id || `#${user.id}`}
          </span>
          {roleName && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase bg-blue-50 text-blue-700 border border-blue-100">
              {roleName}
            </span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="p-4 sm:p-6 max-w-[1600px] mx-auto space-y-6">
      {/* Control Bar: Service Filter, Targeted User Search, Page Size & Refresh Log */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4 flex-1">
          {/* Service Filter */}
          <div className="flex items-center gap-2 min-w-[200px]">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              value={serviceKey}
              onChange={handleServiceChange}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#00D3CD]/30 focus:border-[#00D3CD] transition"
            >
              {SERVICE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Targeted User Search */}
          <form onSubmit={handleSearchSubmit} className="relative flex items-center min-w-[260px] max-w-[360px] flex-1">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 pointer-events-none" />
            <input
              type="text"
              value={searchInputValue}
              onChange={handleSearchChange}
              placeholder="Search target user (name, mobile, APM/APF ID)..."
              className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-9 pr-8 py-2 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#00D3CD]/30 focus:border-[#00D3CD] transition"
            />
            {searchInputValue && (
              <button
                type="button"
                onClick={handleSearchClear}
                className="absolute right-2.5 text-gray-400 hover:text-gray-600 p-0.5 rounded-full hover:bg-gray-200 transition"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </form>

          {/* Start Date & End Date Filters */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5 text-xs text-gray-600 focus-within:ring-2 focus-within:ring-[#00D3CD]/30 focus-within:border-[#00D3CD] transition">
              <Calendar className="w-3.5 h-3.5 text-[#00D3CD]" />
              <span className="font-medium text-gray-500">From:</span>
              <input
                type="date"
                value={startDate}
                onChange={handleStartDateChange}
                className="bg-transparent text-gray-800 font-semibold text-xs focus:outline-none cursor-pointer"
              />
            </div>
            <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5 text-xs text-gray-600 focus-within:ring-2 focus-within:ring-[#00D3CD]/30 focus-within:border-[#00D3CD] transition">
              <Calendar className="w-3.5 h-3.5 text-[#00D3CD]" />
              <span className="font-medium text-gray-500">To:</span>
              <input
                type="date"
                value={endDate}
                onChange={handleEndDateChange}
                className="bg-transparent text-gray-800 font-semibold text-xs focus:outline-none cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Page Limit Selector & Refresh Button */}
        <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-gray-400" />
            <span>Show per page:</span>
            <select
              value={limit}
              onChange={handleLimitChange}
              className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5 text-sm font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#00D3CD]/30 focus:border-[#00D3CD] transition"
            >
              {PAGE_LIMIT_OPTIONS.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="inline-flex items-center justify-center gap-2 px-3.5 py-1.5 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition font-medium text-sm disabled:opacity-50"
          >
            <RefreshCcw className={`w-4 h-4 ${isFetching ? "animate-spin text-[#00D3CD]" : ""}`} />
            Refresh Log
          </button>
        </div>
      </div>

      {/* Main Table Container */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-gray-500">
            <RefreshCcw className="w-8 h-8 animate-spin mx-auto text-[#00D3CD] mb-3" />
            <p className="font-medium text-gray-600">Loading system activity logs...</p>
          </div>
        ) : isError ? (
          <div className="p-12 text-center">
            <ShieldAlert className="w-10 h-10 text-rose-500 mx-auto mb-3" />
            <p className="font-semibold text-gray-800">Failed to load system logs</p>
            <p className="text-sm text-gray-500 mt-1">{error?.message || "Something went wrong."}</p>
            <button
              onClick={() => refetch()}
              className="mt-4 px-4 py-2 bg-rose-50 text-rose-600 rounded-xl text-sm font-semibold hover:bg-rose-100 transition"
            >
              Try Again
            </button>
          </div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center">
            <Activity className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="font-semibold text-gray-700">No activity logs found</p>
            <p className="text-sm text-gray-500 mt-1">
              No service toggle actions have been recorded for the selected filter.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/80 border-b border-gray-100 text-xs font-bold uppercase tracking-wider text-gray-500">
                  <th className="py-3.5 px-4 text-center w-12">#</th>
                  <th className="py-3.5 px-4">Admin / Employee</th>
                  <th className="py-3.5 px-4">Targeted User</th>
                  <th className="py-3.5 px-4">Service</th>
                  <th className="py-3.5 px-4 text-center">Prev State</th>
                  <th className="py-3.5 px-4 text-center">Change To</th>
                  <th className="py-3.5 px-4 text-center">Action</th>
                  <th className="py-3.5 px-4">Time</th>
                  <th className="py-3.5 px-4 text-right">IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {logs.map((log, index) => {
                  const slNo = (page - 1) * limit + index + 1;
                  const serviceLabel =
                    SERVICE_LABEL_MAP[log.service_key] || log.service_key || "-";

                  return (
                    <tr
                      key={log.id || index}
                      className="hover:bg-gray-50/60 transition-colors"
                    >
                      {/* SL No */}
                      <td className="py-3.5 px-4 text-center font-mono text-xs font-semibold text-gray-400">
                        {slNo}
                      </td>

                      {/* Performing User (Admin/Employee) */}
                      <td className="py-3.5 px-4">
                        {renderUserBadge(log.performingUser || log.user || log.admin_user || log.performing_user, "System / Admin")}
                      </td>

                      {/* Targeted User */}
                      <td className="py-3.5 px-4">
                        {renderUserBadge(log.affectedUser || log.affected_user || log.target_user, "Global Service Setting")}
                      </td>

                      {/* Service Name */}
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-gray-800 text-sm">
                          {serviceLabel}
                        </div>
                        <span className="text-[11px] font-mono text-gray-400">
                          {log.service_key}
                        </span>
                      </td>

                      {/* Prev State */}
                      <td className="py-3.5 px-4 text-center">
                        {log.service_key === "user_daily_limit" || typeof log.previous_state === "string" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700 border border-gray-200">
                            {log.previous_state || "Default Limit"}
                          </span>
                        ) : log.service_key === "settlement_type" ? (
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold font-mono ${log.previous_state ? "bg-teal-50 text-teal-700 border border-teal-200" : "bg-indigo-50 text-indigo-700 border border-indigo-200"}`}>
                            {log.previous_state ? "T0" : "T+1"}
                          </span>
                        ) : log.balance_before !== null && log.balance_before !== undefined ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700 border border-gray-200 font-mono">
                            ₹{Number(log.balance_before).toFixed(2)}
                          </span>
                        ) : (
                          renderStateBadge(log.previous_state)
                        )}
                      </td>

                      {/* Change To */}
                      <td className="py-3.5 px-4 text-center">
                        {log.service_key === "user_daily_limit" || typeof log.new_state === "string" ? (
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                            String(log.new_state).includes("Free Will") || String(log.new_state).includes("Unlimited")
                              ? "bg-cyan-50 text-cyan-800 border border-cyan-300"
                              : "bg-blue-50 text-blue-800 border border-blue-200"
                          }`}>
                            {log.new_state || "Default Limit"}
                          </span>
                        ) : log.service_key === "settlement_type" ? (
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold font-mono ${log.new_state ? "bg-teal-50 text-teal-700 border border-teal-200" : "bg-indigo-50 text-indigo-700 border border-indigo-200"}`}>
                            {log.new_state ? "T0" : "T+1"}
                          </span>
                        ) : log.balance_after !== null && log.balance_after !== undefined ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 font-mono">
                            ₹{Number(log.balance_after).toFixed(2)}
                          </span>
                        ) : (
                          renderStateBadge(log.new_state)
                        )}
                      </td>

                      {/* Action */}
                      <td className="py-3.5 px-4 text-center">
                        {renderActionBadge(log)}
                      </td>

                      {/* Time */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 text-xs text-gray-700 font-medium">
                          <Clock className="w-3.5 h-3.5 text-gray-400" />
                          {formatDate(log.createdAt)}
                        </div>
                      </td>

                      {/* Details (IP & User Agent) */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1 text-xs font-mono text-gray-500 bg-gray-100 px-2 py-1 rounded">
                          <Globe className="w-3 h-3 text-gray-400" />
                          {formatIpAddress(log.ip_address)}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {logs.length > 0 && (
          <div className="p-4 border-t border-gray-100 bg-gray-50/50 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-xs text-gray-500">
              Showing <span className="font-semibold text-gray-800">{(page - 1) * limit + 1}</span> to{" "}
              <span className="font-semibold text-gray-800">
                {Math.min(page * limit, totalCount)}
              </span>{" "}
              of <span className="font-semibold text-gray-800">{totalCount}</span> log entries
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                disabled={page <= 1 || isFetching}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-gray-200 bg-white text-xs font-medium text-gray-700 hover:bg-gray-50 transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
                Previous
              </button>

              <span className="text-xs font-semibold px-3 py-1.5 bg-white border border-gray-200 rounded-xl text-gray-700">
                Page {page} of {totalPages}
              </span>

              <button
                onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={page >= totalPages || isFetching}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-gray-200 bg-white text-xs font-medium text-gray-700 hover:bg-gray-50 transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
