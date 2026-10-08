import React, { useState, useEffect } from "react";
import Table from "../../components/Table";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  SlidersHorizontal,
  Building,
  Save,
  CheckCircle2,
  Loader2,
  ArrowUpRight,
  CreditCard,
  ArrowDownLeft,
} from "lucide-react";
import { toast } from "react-toastify";
import { BASE_SITE_URL } from "../../constants";
import { extractUsersArray, normalizeUserRole } from "../../utils/userAccess";
import { getAdminList, updateAdmin } from "../../api/superAdminApi";


/**
 * Resolves uploaded image path to full URL
 */
const resolveLogoUrl = (logoPath) => {
  if (!logoPath || typeof logoPath !== "string") return null;
  const trimmed = logoPath.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  const clean = trimmed.replace(/\\/g, "/");
  const slashPrefixed = clean.startsWith("/") ? clean : `/${clean}`;
  return `${BASE_SITE_URL}${slashPrefixed}`;
};

const SuperAdminsettlement = ({ currentUser }) => {
  const queryClient = useQueryClient();
  const [searchInputValue, setSearchInputValue] = useState("");
  const [committedSearch, setCommittedSearch] = useState("");
  const [adminParams, setAdminParams] = useState({
    page: 1,
    limit: 10,
    status: "",
  });
  const [searchPage, setSearchPage] = useState(1);
  const searchPageSize = 10;
  const isSearchMode = Boolean(committedSearch);

  // Limits State per admin: { [adminId]: { payout: "", ccBill: "", payin: "" } }
  const [limitsState, setLimitsState] = useState({});
  const [savingKey, setSavingKey] = useState(null); // e.g. "adminId_payout"

  // Access check
  const normalizedCurrentUserRole = normalizeUserRole(currentUser?.role);
  const isSuperAdminViewer = normalizedCurrentUserRole === "super_admin";

  // Query: Main admin list
  const {
    data: allAdminsResponse,
    isLoading: allAdminsLoading,
    error: allAdminsError,
  } = useQuery({
    queryKey: ["superAdminSettlementAdmins", adminParams],
    queryFn: () => getAdminList(adminParams),
    enabled: !isSearchMode && isSuperAdminViewer,
  });

  // Query: Search
  const {
    data: searchResponse,
    isLoading: searchLoading,
    error: searchError,
  } = useQuery({
    queryKey: [
      "superAdminSettlementSearch",
      committedSearch,
      adminParams.status,
      searchPage,
      searchPageSize,
    ],
    queryFn: () =>
      getAdminList({
        search: committedSearch,
        status: adminParams.status,
        limit: searchPageSize,
        page: searchPage,
      }),
    enabled: isSearchMode && isSuperAdminViewer,
    staleTime: 30 * 1000,
  });

  const allAdmins = allAdminsResponse
    ? extractUsersArray(allAdminsResponse)
    : [];
  const searchAdmins = searchResponse ? extractUsersArray(searchResponse) : [];
  const currentData = isSearchMode ? searchAdmins : allAdmins;

  const isLoading = isSearchMode ? searchLoading : allAdminsLoading;
  const isError = isSearchMode ? searchError : allAdminsError;

  const totalResults = Number(
    (isSearchMode
      ? searchResponse?.pagination?.total
      : allAdminsResponse?.pagination?.total) ?? currentData.length,
  );

  const effectivePage = isSearchMode ? searchPage : adminParams.page;
  const effectiveLimit = isSearchMode ? searchPageSize : adminParams.limit;
  const totalPages = Math.max(1, Math.ceil(totalResults / effectiveLimit));

  // Initialize limits inputs directly from backend database response
  useEffect(() => {
    if (!currentData || currentData.length === 0) return;

    setLimitsState((prev) => {
      const nextState = { ...prev };
      currentData.forEach((admin) => {
        const id = admin.id;
        const comp = admin.company || {};

        const serverPayout =
          comp.payout_limit !== undefined && comp.payout_limit !== null
            ? String(Number(comp.payout_limit))
            : "";
        const serverCcBill =
          comp.bill_payment_limit !== undefined && comp.bill_payment_limit !== null
            ? String(Number(comp.bill_payment_limit))
            : "";
        const serverPayin =
          admin.t0_daily_limit !== undefined && admin.t0_daily_limit !== null
            ? String(Number(admin.t0_daily_limit))
            : "";

        nextState[id] = {
          payout: prev[id]?.payout !== undefined ? prev[id].payout : serverPayout,
          ccBill: prev[id]?.ccBill !== undefined ? prev[id].ccBill : serverCcBill,
          payin: prev[id]?.payin !== undefined ? prev[id].payin : serverPayin,
        };
      });
      return nextState;
    });
  }, [currentData]);

  // Clean numbers only
  const sanitizeDigits = (val) => {
    if (val === "" || val === null || val === undefined) return "";
    return String(val).replace(/\D/g, "");
  };

  const handleLimitInputChange = (adminId, limitType, value) => {
    const cleanVal = sanitizeDigits(value);
    setLimitsState((prev) => ({
      ...prev,
      [adminId]: {
        ...(prev[adminId] || {}),
        [limitType]: cleanVal,
      },
    }));
  };

  // Save Limit Handler (Pure Backend API Call)
  const handleSaveLimit = async (admin, limitType) => {
    const adminId = admin.id;
    const saveKey = `${adminId}_${limitType}`;
    const value = limitsState[adminId]?.[limitType] ?? "";
    const numValue = value === "" ? 0 : Number(value);

    setSavingKey(saveKey);

    try {
      // Prepare payload to sync with backend database
      const payload = {};
      if (limitType === "payout") {
        payload.payout_limit = numValue;
      } else if (limitType === "ccBill") {
        payload.bill_payment_limit = numValue;
      } else if (limitType === "payin") {
        payload.t0_daily_limit = numValue;
      }

      // Call Super Admin Update API
      await updateAdmin(adminId, payload);

      const labelMap = {
        payout: "Payout",
        ccBill: "CC Bill",
        payin: "Payin",
      };

      toast.success(
        `${labelMap[limitType]} limit for ${admin.name || "Admin"} updated in database (₹${numValue.toLocaleString("en-IN")})`,
      );

      // Invalidate queries so fresh DB data is loaded
      await queryClient.invalidateQueries({ queryKey: ["superAdminSettlementAdmins"] });
      await queryClient.invalidateQueries({ queryKey: ["superAdminSettlementSearch"] });
    } catch (err) {
      console.error("Database limit save error:", err);
      toast.error(err?.message || "Failed to update limit in database");
    } finally {
      setSavingKey(null);
    }
  };

  // Search Handlers
  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setCommittedSearch(searchInputValue.trim());
    setSearchPage(1);
  };

  const handleClearSearch = () => {
    setSearchInputValue("");
    setCommittedSearch("");
    setSearchPage(1);
  };

  const handlePageChange = (newPage) => {
    if (newPage < 1 || newPage > totalPages) return;
    if (isSearchMode) {
      setSearchPage(newPage);
    } else {
      setAdminParams((prev) => ({ ...prev, page: newPage }));
    }
  };

  const handleFilterChange = (key, value) => {
    if (key === "status") {
      setAdminParams((prev) => ({ ...prev, status: value, page: 1 }));
      setSearchPage(1);
    }
  };

  const baseIndex = (effectivePage - 1) * effectiveLimit;
  const tableData = currentData.map((row, idx) => ({
    ...row,
    sl: baseIndex + idx + 1,
  }));

  // Reusable Limit Input Cell Component
  const renderLimitCell = (row, limitType, badgeLabel, icon) => {
    const adminId = row.id;
    const currentVal = limitsState[adminId]?.[limitType] ?? "";
    const isSaving = savingKey === `${adminId}_${limitType}`;

    return (
      <div className="space-y-1.5 min-w-[200px] max-w-[240px]">
        <div className="flex items-center gap-1.5">
          <div className="relative flex-1">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-semibold">
              ₹
            </span>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={currentVal}
              onChange={(e) =>
                handleLimitInputChange(adminId, limitType, e.target.value)
              }
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleSaveLimit(row, limitType);
                }
                if (e.key === "-" || e.key === "." || e.key === "e") {
                  e.preventDefault();
                }
              }}
              placeholder="Set limit..."
              className="w-full pl-6 pr-2.5 py-1.5 bg-gray-50 hover:bg-white focus:bg-white border border-gray-200 focus:border-teal-500 rounded-lg text-xs font-medium text-gray-800 focus:outline-none focus:ring-1 focus:ring-teal-500 transition-all"
            />
          </div>

          <button
            type="button"
            onClick={() => handleSaveLimit(row, limitType)}
            disabled={isSaving}
            title={`Save ${badgeLabel} Limit`}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white rounded-lg text-xs font-medium shadow-xs transition-colors disabled:opacity-50 shrink-0"
          >
            {isSaving ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            <span>Set</span>
          </button>
        </div>

        <div className="flex items-center justify-between text-[11px] text-gray-500 px-0.5">
          <span className="inline-flex items-center gap-1 font-medium text-gray-600">
            {icon}
            {badgeLabel}
          </span>
          {currentVal !== "" && Number(currentVal) > 0 ? (
            <span className="text-emerald-700 font-semibold">
              ₹{Number(currentVal).toLocaleString("en-IN")}
            </span>
          ) : (
            <span className="text-gray-400">No Limit</span>
          )}
        </div>
      </div>
    );
  };

  // Table Columns exactly requested:
  // SL | ADMIN / USER | PAYOUT | CC BILL | PAYIN
  const columns = [
    {
      header: "SL",
      key: "sl",
      headerClassName: "w-16",
      cellClassName: "w-16 font-semibold text-gray-500",
    },
    {
      header: "ADMIN / USER",
      key: "name",
      headerClassName: "min-w-[260px]",
      cellClassName: "min-w-[260px]",
      render: (name, row) => {
        const companyName =
          row.company?.company_name || row.company_or_shop_name || "-";
        const domainName = row.company?.domain_name || "-";
        const logoUrl = resolveLogoUrl(
          row.company?.company_logo || row.shop_with_photo_url,
        );

        return (
          <div className="flex items-start gap-3 py-1">
            <div className="pt-0.5">
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt={companyName}
                  className="h-9 w-9 rounded-lg object-contain border border-gray-200 bg-white p-0.5 shadow-xs shrink-0"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                    const fallback = e.currentTarget.nextElementSibling;
                    if (fallback) fallback.style.display = "flex";
                  }}
                />
              ) : null}
              <div
                className={`h-9 w-9 rounded-lg bg-teal-50 border border-teal-200 text-teal-700 font-bold text-xs flex items-center justify-center shrink-0 ${
                  logoUrl ? "hidden" : "flex"
                }`}
              >
                {companyName && companyName !== "-" ? (
                  companyName.charAt(0).toUpperCase()
                ) : (
                  <Building className="h-4 w-4 text-teal-600" />
                )}
              </div>
            </div>

            <div className="min-w-0 space-y-0.5">
              <div className="font-semibold text-gray-900 leading-tight">
                {name || "-"}
              </div>
              <div className="text-xs text-gray-600">
                {row.mobile_number || "-"}
              </div>
              <div className="text-xs text-gray-500 font-mono">
                {row.username || row.abheepay_id || "-"}
              </div>
              <div className="text-xs pt-0.5 flex items-center gap-1.5 flex-wrap">
                <span className="font-medium text-gray-800" title={companyName}>
                  {companyName}
                </span>
                {domainName && domainName !== "-" && (
                  <span className="text-blue-600 font-mono text-[11px]">
                    ({domainName})
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      },
    },
    {
      header: "PAYOUT",
      key: "payout_limit",
      headerClassName: "min-w-[220px]",
      cellClassName: "min-w-[220px]",
      render: (_val, row) =>
        renderLimitCell(
          row,
          "payout",
          "Payout",
          <ArrowUpRight className="w-3 h-3 text-indigo-500" />,
        ),
    },
    {
      header: "CC BILL",
      key: "bill_payment_limit",
      headerClassName: "min-w-[220px]",
      cellClassName: "min-w-[220px]",
      render: (_val, row) =>
        renderLimitCell(
          row,
          "ccBill",
          "CC Bill",
          <CreditCard className="w-3 h-3 text-amber-500" />,
        ),
    },
    {
      header: "PAYIN",
      key: "payin_limit",
      headerClassName: "min-w-[220px]",
      cellClassName: "min-w-[220px]",
      render: (_val, row) =>
        renderLimitCell(
          row,
          "payin",
          "Payin",
          <ArrowDownLeft className="w-3 h-3 text-emerald-500" />,
        ),
    },
  ];

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-6 space-y-4">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-white rounded-xl shadow-xs border border-gray-200 text-teal-600">
            <SlidersHorizontal className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              Super Admin Settlement Limits
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">
              Set service limits for Payout, CC Bill, and Payin
            </p>
          </div>
        </div>
      </div>

      {/* MAIN CARD */}
      <div className="rounded-xl bg-white px-3 py-5 shadow-sm md:p-6 border border-gray-200/80">
        {/* SEARCH & FILTERS */}
        <div className="mb-6 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <form onSubmit={handleSearchSubmit} className="flex-1 max-w-md">
            <label className="mb-1.5 block text-xs font-medium text-gray-600">
              Search Admins
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={searchInputValue}
                onChange={(e) => setSearchInputValue(e.target.value)}
                placeholder="Name, email, company or mobile..."
                className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-xs focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
              />
              <button
                type="submit"
                disabled={isLoading}
                className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50 transition-colors"
              >
                {isLoading && isSearchMode ? "Searching..." : "Search"}
              </button>
              {isSearchMode && (
                <button
                  type="button"
                  onClick={handleClearSearch}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Clear
                </button>
              )}
            </div>
            {isSearchMode && (
              <p className="mt-1 text-xs text-gray-500">
                {isLoading
                  ? "Searching..."
                  : `${totalResults} result(s) found for "${committedSearch}"`}
              </p>
            )}
          </form>

          {/* STATUS FILTER */}
          <div className="flex items-center gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Status
              </label>
              <select
                value={adminParams.status}
                onChange={(e) => handleFilterChange("status", e.target.value)}
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 shadow-xs focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
              >
                <option value="">All</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>
        </div>

        {/* LOADING & ERROR */}
        {isLoading && (
          <div className="py-12 text-center text-sm text-gray-500">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600 mb-2"></div>
            <p>Loading admins & settlement limits...</p>
          </div>
        )}

        {isError && (
          <div className="py-6 text-center text-sm text-red-600 bg-red-50 rounded-lg border border-red-200">
            Error loading records: {isError.message || "Failed to fetch"}
          </div>
        )}

        {/* TABLE CONTENT */}
        {!isLoading && !isError && (
          <>
            {/* Mobile View */}
            <div className="space-y-4 md:hidden">
              {currentData.length === 0 ? (
                <div className="rounded-xl border border-gray-100 bg-white p-6 text-center text-sm text-gray-500">
                  No admin records found.
                </div>
              ) : (
                currentData.map((admin, idx) => {
                  const companyName =
                    admin.company?.company_name ||
                    admin.company_or_shop_name ||
                    "-";
                  const domainName = admin.company?.domain_name || "-";

                  return (
                    <div
                      key={admin.id || idx}
                      className="rounded-xl border border-gray-200 bg-white p-4 shadow-xs space-y-4"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <span className="text-xs font-bold text-teal-600 mr-2">
                            #{baseIndex + idx + 1}
                          </span>
                          <span className="font-semibold text-gray-900 text-base">
                            {admin.name || "-"}
                          </span>
                          <p className="text-xs text-gray-500">
                            {admin.mobile_number || "-"} •{" "}
                            {admin.username || admin.abheepay_id || "-"}
                          </p>
                          <p className="text-xs text-gray-600 mt-1">
                            <span className="font-medium text-gray-800">
                              {companyName}
                            </span>{" "}
                            {domainName && domainName !== "-" && (
                              <span className="text-blue-600">
                                ({domainName})
                              </span>
                            )}
                          </p>
                        </div>
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                            admin.status === "active"
                              ? "bg-green-100 text-green-700"
                              : "bg-red-100 text-red-700"
                          }`}
                        >
                          {admin.status || "active"}
                        </span>
                      </div>

                      {/* Limit Inputs for Mobile */}
                      <div className="space-y-3 border-t border-gray-100 pt-3">
                        <div>
                          <label className="block text-xs font-semibold text-indigo-700 mb-1 flex items-center gap-1">
                            <ArrowUpRight className="w-3 h-3" /> PAYOUT LIMIT
                          </label>
                          {renderLimitCell(
                            admin,
                            "payout",
                            "Payout",
                            <ArrowUpRight className="w-3 h-3 text-indigo-500" />,
                          )}
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-amber-700 mb-1 flex items-center gap-1">
                            <CreditCard className="w-3 h-3" /> CC BILL LIMIT
                          </label>
                          {renderLimitCell(
                            admin,
                            "ccBill",
                            "CC Bill",
                            <CreditCard className="w-3 h-3 text-amber-500" />,
                          )}
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-emerald-700 mb-1 flex items-center gap-1">
                            <ArrowDownLeft className="w-3 h-3" /> PAYIN LIMIT
                          </label>
                          {renderLimitCell(
                            admin,
                            "payin",
                            "Payin",
                            <ArrowDownLeft className="w-3 h-3 text-emerald-500" />,
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <Table columns={columns} data={tableData} />
            </div>

            {/* PAGINATION CONTROLS */}
            <div className="mt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-sm text-gray-600 border-t border-gray-100 pt-4">
              <p className="text-xs text-gray-500">
                Showing Page{" "}
                <span className="font-semibold text-gray-800">
                  {effectivePage}
                </span>{" "}
                of{" "}
                <span className="font-semibold text-gray-800">
                  {totalPages}
                </span>{" "}
                ({totalResults} Total Admins)
              </p>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handlePageChange(effectivePage - 1)}
                  disabled={effectivePage <= 1 || isLoading}
                  className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Previous
                </button>
                <button
                  type="button"
                  onClick={() => handlePageChange(effectivePage + 1)}
                  disabled={effectivePage >= totalPages || isLoading}
                  className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default SuperAdminsettlement;
