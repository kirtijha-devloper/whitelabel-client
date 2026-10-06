import React, { useState } from "react";
import Table from "../components/Table";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Eye, Loader2, SquarePen } from "lucide-react";
import { toast } from "react-toastify";
import { extractUsersArray, normalizeUserRole } from "../utils/userAccess";
import { hasPermission, isAdminUser } from "../utils/accessControl";
import { SERVICE_FLAG_CONFIG, normalizeServiceFlags } from "../utils/serviceFlags";
import { getAdminList, updateAdminStatus, updateAdmin } from "../api/superAdminApi";

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

const AdminList = ({ currentUser, title = "Admin List" }) => {
  const [searchInputValue, setSearchInputValue] = useState("");
  const [committedSearch, setCommittedSearch] = useState("");
  const [isExporting, setIsExporting] = useState(false);
  const [statusUpdatingId, setStatusUpdatingId] = useState(null);
  const [serviceUpdatingKey, setServiceUpdatingKey] = useState("");

  const [adminParams, setAdminParams] = useState({
    page: 1,
    limit: 10,
    status: "",
  });

  const [searchPage, setSearchPage] = useState(1);
  const searchPageSize = 10;
  const isSearchMode = Boolean(committedSearch);

  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // ── Security Checks & Role Permissions ─────────────────────────────────────
  const normalizedCurrentUserRole = normalizeUserRole(currentUser?.role);
  const isAdmin = isAdminUser(currentUser);
  const isSuperAdminViewer = normalizedCurrentUserRole === "super_admin";

  const canListUsers = isSuperAdminViewer || hasPermission(currentUser, "users.list");
  const canSearchUsers = isSuperAdminViewer || hasPermission(currentUser, "users.search");
  const canReadUsers = isSuperAdminViewer || hasPermission(currentUser, "users.read");
  const canUpdateUsers = isSuperAdminViewer || hasPermission(currentUser, "users.update");
  const canUpdateUserStatus =
    isSuperAdminViewer || hasPermission(currentUser, "users.status.update");
  const canManageUserServiceSettings =
    isSuperAdminViewer || isAdmin || hasPermission(currentUser, "users.service_settings.manage");

  // ── Main List Query (hits ONLY superAdminApi) ──────────────────────────────
  const {
    data: allAdminsResponse,
    isLoading: allAdminsLoading,
    error: allAdminsError,
    refetch: refetchAllAdmins,
  } = useQuery({
    queryKey: ["adminList", adminParams],
    queryFn: () => getAdminList(adminParams),
    enabled: !isSearchMode && canListUsers,
  });

  // ── Search Query (hits ONLY superAdminApi) ─────────────────────────────────
  const {
    data: searchResponse,
    isLoading: searchLoading,
    error: searchError,
  } = useQuery({
    queryKey: ["adminSearch", committedSearch, adminParams.status, searchPage, searchPageSize],
    queryFn: () =>
      getAdminList({
        search: committedSearch,
        status: adminParams.status,
        limit: searchPageSize,
        page: searchPage,
      }),
    enabled: isSearchMode && canSearchUsers,
    staleTime: 30 * 1000,
  });

  const allAdmins = allAdminsResponse ? extractUsersArray(allAdminsResponse) : [];
  const searchAdmins = searchResponse ? extractUsersArray(searchResponse) : [];
  const currentData = isSearchMode ? searchAdmins : allAdmins;

  const isLoading = isSearchMode ? searchLoading : allAdminsLoading;
  const isError = isSearchMode ? searchError : allAdminsError;

  const totalResults = Number(
    (isSearchMode ? searchResponse?.pagination?.total : allAdminsResponse?.pagination?.total) ??
      currentData.length
  );

  const totalPages = Number(
    (isSearchMode
      ? searchResponse?.pagination?.totalPages
      : allAdminsResponse?.pagination?.totalPages) ?? 1
  );

  const currentPage = isSearchMode ? searchPage : adminParams.page;

  // ── Handlers ───────────────────────────────────────────────────────────────
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

  const handleFilterChange = (key, value) => {
    setAdminParams((prev) => ({
      ...prev,
      [key]: value,
      page: 1,
    }));
  };

  const handlePageChange = (newPage) => {
    if (isSearchMode) {
      setSearchPage(newPage);
    } else {
      setAdminParams((prev) => ({ ...prev, page: newPage }));
    }
  };

  const handleToggleStatus = async (row, nextStatus) => {
    if (!canUpdateUserStatus || !row?.id) return;
    try {
      setStatusUpdatingId(String(row.id));
      await updateAdminStatus(row.id, nextStatus);
      toast.success(
        `${row?.name || "Admin"} status changed to ${nextStatus === "active" ? "active" : "inactive"}.`
      );
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["adminList"] }),
        queryClient.invalidateQueries({ queryKey: ["adminSearch"] }),
      ]);
      if (typeof refetchAllAdmins === "function") {
        await refetchAllAdmins();
      }
    } catch (error) {
      toast.error(error?.message || "Failed to update admin status.");
    } finally {
      setStatusUpdatingId(null);
    }
  };

  const handleToggleUserService = async (row, serviceKey, nextEnabled) => {
    if (!canManageUserServiceSettings || !row?.id) return;
    const updateKey = `${row.id}:${serviceKey}`;
    try {
      setServiceUpdatingKey(updateKey);
      const currentSettings = row.user_service_settings || {};
      const nextSettings = { ...currentSettings, [serviceKey]: nextEnabled };
      await updateAdmin(row.id, { user_service_settings: nextSettings });
      toast.success(`${USER_SERVICE_INLINE_LABELS[serviceKey] || serviceKey} updated.`);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["adminList"] }),
        queryClient.invalidateQueries({ queryKey: ["adminSearch"] }),
      ]);
      if (typeof refetchAllAdmins === "function") {
        await refetchAllAdmins();
      }
    } catch (error) {
      toast.error(error?.message || "Failed to update service.");
    } finally {
      setServiceUpdatingKey("");
    }
  };

  const handleExport = async () => {
    try {
      setIsExporting(true);
      const total = totalResults > 0 ? totalResults : 1000;
      const response = await getAdminList({
        search: isSearchMode ? committedSearch : undefined,
        status: adminParams.status,
        limit: total,
        page: 1,
      });

      const exportAdmins = extractUsersArray(response);
      if (!Array.isArray(exportAdmins) || exportAdmins.length === 0) {
        toast.info("No admin data available to export.");
        return;
      }

      const rows = exportAdmins.map((item, index) => ({
        "SL": index + 1,
        "Name": item.name || "-",
        "Email": item.email || "-",
        "Mobile": item.mobile_number || "-",
        "Username": item.username || item.abheepay_id || "-",
        "Company Name": item.company?.company_name || item.company_or_shop_name || "-",
        "Domain Name": item.company?.domain_name || "-",
        "Status": item.status || "active",
        "Created At": item.createdAt ? new Date(item.createdAt).toLocaleDateString() : "-",
      }));

      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Admins");
      const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
      const blob = new Blob([excelBuffer], { type: "application/octet-stream" });
      saveAs(blob, "AdminList.xlsx");
      toast.success("Admin list exported successfully.");
    } catch (error) {
      toast.error(error?.message || "Failed to export admin list.");
    } finally {
      setIsExporting(false);
    }
  };

  // ── Render Services Inline ─────────────────────────────────────────────────
  const renderServiceSettingsInline = (row, className = "") => {
    const rawFlags = normalizeServiceFlags(row?.user_service_settings, true);

    return (
      <div
        className={`inline-grid grid-cols-2 items-start gap-x-5 gap-y-1.5 whitespace-normal ${className}`.trim()}
      >
        {SERVICE_FLAG_CONFIG.filter(
          (service) =>
            service.key !== "user_daily_limit" && service.key !== "pos_t0_settlement"
        ).map((service) => {
          const isEnabled = Boolean(rawFlags?.[service.key]);
          const isUpdating = serviceUpdatingKey === `${row?.id}:${service.key}`;

          return (
            <div key={service.key}>
              <label className="inline-flex items-center gap-3 whitespace-nowrap rounded px-0.5 py-0.5 text-[13px] text-gray-700">
                <span className="font-medium leading-none text-gray-800">
                  {USER_SERVICE_INLINE_LABELS[service.key] || service.label}
                </span>
                <input
                  type="checkbox"
                  checked={isEnabled}
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

  // ── Table Data & Columns ───────────────────────────────────────────────────
  const baseIndex = isSearchMode
    ? (searchPage - 1) * searchPageSize
    : (adminParams.page - 1) * adminParams.limit;

  const tableData = currentData.map((row, idx) => ({
    ...row,
    sl: baseIndex + idx + 1,
  }));

  const columns = [
    { header: "SL", key: "sl" },
    {
      header: "Admin / User",
      key: "name",
      render: (name, row) => (
        <div className="space-y-0.5">
          <div className="font-medium text-gray-900">{name || "-"}</div>
          <div className="text-xs text-gray-600">{row.mobile_number || "-"}</div>
          <div className="text-xs text-gray-500">{row.username || row.abheepay_id || "-"}</div>
        </div>
      ),
    },
    {
      header: "Email",
      key: "email",
      render: (email) => <span className="text-sm text-gray-700">{email || "-"}</span>,
    },
    {
      header: "Company",
      key: "company",
      render: (_value, row) => (
        <div className="space-y-0.5">
          <div className="font-medium text-gray-900">
            {row.company?.company_name || row.company_or_shop_name || "-"}
          </div>
          <div className="text-xs text-blue-600">{row.company?.domain_name || "-"}</div>
        </div>
      ),
    },
    {
      header: "Status",
      key: "status",
      render: (status) => (
        <span
          className={`px-2 py-1 rounded-full text-xs font-semibold ${
            status === "active"
              ? "bg-green-100 text-green-800"
              : "bg-red-100 text-red-800"
          }`}
        >
          {status || "active"}
        </span>
      ),
    },
    {
      header: "Services",
      key: "user_service_settings",
      render: (_value, row) => renderServiceSettingsInline(row, "min-w-[190px]"),
    },
  ];

  // ── Action Buttons (View with Eye, Edit, Status Toggle) ─────────────────────
  const actions = [];

  if (canReadUsers) {
    actions.push({
      label: (
        <Eye className="text-blue-500 text-xl hover:text-blue-700 transition-colors" />
      ),
      onClick: (row) => navigate(`/super-admin/user/${row.id}`),
    });
  }

  if (canUpdateUsers) {
    actions.push({
      label: (
        <SquarePen className="text-primary text-xl hover:opacity-80 transition-colors" />
      ),
      onClick: (row) => navigate(`/super-admin/user/${row.id}/edit`),
    });
  }

  if (canUpdateUserStatus) {
    actions.push({
      label: (row) => {
        const isUpdating = statusUpdatingId === String(row?.id);
        const isActive = row?.status === "active";
        return (
          <span
            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors ${
              isActive
                ? "border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                : "border-green-200 bg-green-50 text-green-700 hover:bg-green-100"
            }`}
          >
            {isUpdating && <Loader2 className="h-3 w-3 animate-spin" />}
            {isActive ? "Disable" : "Enable"}
          </span>
        );
      },
      onClick: (row) =>
        handleToggleStatus(row, row?.status === "active" ? "inactive" : "active"),
    });
  }

  // ── Security Check View Block ──────────────────────────────────────────────
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
        {/* Search Bar */}
        {canSearchUsers && (
          <form onSubmit={handleSearchSubmit} className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Search Admins
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
                disabled={isLoading}
                className="rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
              >
                {isLoading && isSearchMode ? "Searching..." : "Search"}
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
                {isLoading
                  ? "Searching..."
                  : `${totalResults} result(s) for "${committedSearch}"`}
              </p>
            )}
          </form>
        )}

        {/* Filter & Pagination Controls */}
        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="flex flex-wrap gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500">Status</label>
              <select
                value={adminParams.status}
                onChange={(e) => handleFilterChange("status", e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-200 bg-white py-1.5 px-2 text-sm text-gray-700 shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">All</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>

          <div className="flex flex-col items-end gap-3 text-sm text-gray-600 md:flex-row md:items-center">
            <button
              type="button"
              onClick={handleExport}
              disabled={isExporting || isLoading}
              className="inline-flex items-center rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isExporting ? "Exporting..." : "Download Excel"}
            </button>

            <div className="flex items-center gap-2">
              <span>
                Page {currentPage} of {totalPages}
              </span>
              <button
                type="button"
                onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                disabled={currentPage <= 1 || isLoading}
                className="rounded-md border border-gray-200 bg-white px-3 py-1 text-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Prev
              </button>
              <button
                type="button"
                onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage >= totalPages || isLoading}
                className="rounded-md border border-gray-200 bg-white px-3 py-1 text-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </div>

        {/* Loading / Error States */}
        {isLoading && <p className="text-sm text-gray-500 py-4">Loading admin list...</p>}
        {isError && (
          <p className="text-sm text-red-500 py-4">
            Error loading admin list: {isError.message}
          </p>
        )}

        {!isLoading && !isError && (
          <>
            {/* Mobile Cards View */}
            <div className="md:hidden space-y-4">
              {currentData.length === 0 ? (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 text-center text-sm text-gray-500">
                  No admins found.
                </div>
              ) : (
                currentData.map((admin) => (
                  <div
                    key={admin.id}
                    className="bg-white rounded-2xl border border-gray-200 shadow-md p-4 space-y-3"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-bold text-gray-900 text-base">
                          {admin.name || "-"}
                        </h3>
                        <p className="text-xs text-gray-500">{admin.email || "-"}</p>
                        <p className="text-xs text-gray-400">
                          {admin.username || admin.abheepay_id || "-"}
                        </p>
                      </div>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          admin.status === "active"
                            ? "bg-green-100 text-green-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {admin.status || "active"}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 border-t border-gray-100 pt-2 text-xs">
                      <div>
                        <p className="text-gray-400">Phone</p>
                        <p className="font-semibold text-gray-800">
                          {admin.mobile_number || "-"}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-400">Company</p>
                        <p className="font-semibold text-blue-600">
                          {admin.company?.company_name || admin.company_or_shop_name || "-"}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between border-t border-gray-100 pt-2">
                      <div className="flex gap-2">
                        {canReadUsers && (
                          <button
                            type="button"
                            onClick={() => navigate(`/super-admin/user/${admin.id}`)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="View Admin"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        )}
                        {canUpdateUsers && (
                          <button
                            type="button"
                            onClick={() => navigate(`/super-admin/user/${admin.id}/edit`)}
                            className="p-1.5 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                            title="Edit Admin"
                          >
                            <SquarePen className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      {canUpdateUserStatus && (
                        <button
                          type="button"
                          onClick={() =>
                            handleToggleStatus(
                              admin,
                              admin.status === "active" ? "inactive" : "active"
                            )
                          }
                          className={`px-3 py-1 rounded-full text-xs font-semibold border ${
                            admin.status === "active"
                              ? "border-red-200 bg-red-50 text-red-700"
                              : "border-green-200 bg-green-50 text-green-700"
                          }`}
                        >
                          {admin.status === "active" ? "Disable" : "Enable"}
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Desktop / Tablet Table */}
            <div className="hidden md:block">
              <Table
                columns={columns}
                data={tableData}
                actions={actions}
                actionsHeader="Actions"
                actionsAlign="center"
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default AdminList;
