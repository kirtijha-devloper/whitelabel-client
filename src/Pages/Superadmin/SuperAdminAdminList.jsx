import React, { useState } from "react";
import Table from "../../components/Table";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Eye, Loader2, SquarePen, Users, Download, Search, ShieldCheck, MoreHorizontal } from "lucide-react";
import { toast } from "react-toastify";
import { extractUsersArray, normalizeUserRole } from "../../utils/userAccess";
import { getAdminList, updateAdminStatus, updateAdmin } from "../../api/superAdminApi";
import AdminActionMenuModal from "../../components/SuperAdmin/AdminActionMenuModal";
import ServiceManagementModal from "../../components/SuperAdmin/ServiceManagementModal";
import AdminWalletModal from "../../components/SuperAdmin/AdminWalletModal";
import AdminRateModal from "../../components/SuperAdmin/AdminRateModal";
import ConfirmationModal from "../../components/Common/ConfirmationModal";

const SuperAdminAdminList = ({ currentUser }) => {
  const [searchInputValue, setSearchInputValue] = useState("");
  const [committedSearch, setCommittedSearch] = useState("");
  const [isExporting, setIsExporting] = useState(false);
  const [statusUpdatingId, setStatusUpdatingId] = useState(null);

  // Management Modals
  const [isAdminActionMenuOpen, setIsAdminActionMenuOpen] = useState(false);
  const [selectedAdminForAction, setSelectedAdminForAction] = useState(null);
  const [isServiceModalOpen, setIsServiceModalOpen] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
  const [isRateModalOpen, setIsRateModalOpen] = useState(false);

  const [confirmConfig, setConfirmConfig] = useState({
    isOpen: false,
    title: "",
    message: "",
    confirmText: "Confirm",
    cancelText: "Cancel",
    variant: "primary",
    onConfirm: () => {},
  });

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

  // ── Action Handlers ───────────────────────────────────────────────────────
  const handleOpenAdminActionMenu = (row) => {
    setSelectedAdminForAction(row);
    setIsAdminActionMenuOpen(true);
  };

  const handleSelectServiceManagement = (admin) => {
    setIsAdminActionMenuOpen(false);
    const target = admin || selectedAdminForAction;
    if (!target) return;

    const companyData = {
      id: target.id, // Admin user's own User table PK — required by findAdminUser() on backend
      company_id: target.company?.company_id || target.company_id || "",
      company_name: target.company?.company_name || target.company_or_shop_name || target.name || "Company",
      services: target.company?.services || target.services || {
        pos: true,
        pg: true,
        qr: true,
        soundbox: true,
        dmt: true,
        billpayments: true,
      },
    };
    setSelectedCompany(companyData);
    setIsServiceModalOpen(true);
  };

  const handleSelectRateManagement = (admin) => {
    setIsAdminActionMenuOpen(false);
    setSelectedAdminForAction(admin || selectedAdminForAction);
    setIsRateModalOpen(true);
  };

  const handleCloseRateModal = () => {
    setIsRateModalOpen(false);
  };

  const handleSelectWalletManagement = (admin) => {
    setIsAdminActionMenuOpen(false);
    setSelectedAdminForAction(admin || selectedAdminForAction);
    setIsWalletModalOpen(true);
  };

  const handleSaveServices = async ({ companyId, company_id, services }) => {
    try {
      await updateAdmin(companyId, {
        services,
        company_id,
      });
      toast.success("Admin services updated successfully.");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["superAdminAdminsList"] }),
        queryClient.invalidateQueries({ queryKey: ["superAdminAdminsSearch"] }),
        queryClient.invalidateQueries({ queryKey: ["adminServices"] }),
        queryClient.invalidateQueries({ queryKey: ["superAdminServices"] }),
      ]);
      if (typeof refetchAllAdmins === "function") {
        await refetchAllAdmins();
      }
      setIsServiceModalOpen(false);
      setSelectedCompany(null);
    } catch (error) {
      console.error("Save services error:", error);
      toast.error(error?.message || "Failed to update admin services");
    }
  };

  const handleWalletSuccess = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["superAdminAdminsList"] }),
      queryClient.invalidateQueries({ queryKey: ["superAdminAdminsSearch"] }),
    ]);
    if (typeof refetchAllAdmins === "function") {
      await refetchAllAdmins();
    }
  };

  // ── Access Check ─────────────────────────────────────────────────────────
  const normalizedCurrentUserRole = normalizeUserRole(currentUser?.role);
  const isSuperAdminViewer = normalizedCurrentUserRole === "super_admin";

  // ── Main Query (Exclusively hits superAdminApi) ───────────────────────────
  const {
    data: allAdminsResponse,
    isLoading: allAdminsLoading,
    error: allAdminsError,
    refetch: refetchAllAdmins,
  } = useQuery({
    queryKey: ["superAdminAdminsList", adminParams],
    queryFn: () => getAdminList(adminParams),
    enabled: !isSearchMode && isSuperAdminViewer,
  });

  // ── Search Query (Exclusively hits superAdminApi) ─────────────────────────
  const {
    data: searchResponse,
    isLoading: searchLoading,
    error: searchError,
  } = useQuery({
    queryKey: ["superAdminAdminsSearch", committedSearch, adminParams.status, searchPage, searchPageSize],
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

  const allAdmins = allAdminsResponse ? extractUsersArray(allAdminsResponse) : [];
  const searchAdmins = searchResponse ? extractUsersArray(searchResponse) : [];
  const currentData = isSearchMode ? searchAdmins : allAdmins;

  const isLoading = isSearchMode ? searchLoading : allAdminsLoading;
  const isError = isSearchMode ? searchError : allAdminsError;

  const totalResults = Number(
    (isSearchMode ? searchResponse?.pagination?.total : allAdminsResponse?.pagination?.total) ??
      currentData.length
  );

  const effectivePage = isSearchMode ? searchPage : adminParams.page;
  const effectiveLimit = isSearchMode ? searchPageSize : adminParams.limit;
  const totalPages = Math.max(1, Math.ceil(totalResults / effectiveLimit));

  // ── Search Handlers ───────────────────────────────────────────────────────
  const handleSearchSubmit = (e) => {
    e.preventDefault();
    const query = searchInputValue.trim();
    setCommittedSearch(query);
    setSearchPage(1);
  };

  const handleClearSearch = () => {
    setSearchInputValue("");
    setCommittedSearch("");
    setSearchPage(1);
  };

  // ── Status Toggle ─────────────────────────────────────────────────────────
  const executeToggleAdminStatus = async (admin, nextStatus) => {
    setStatusUpdatingId(admin.id);
    try {
      await updateAdminStatus(admin.id, nextStatus);
      toast.success(`Admin status updated to ${nextStatus}`);
      queryClient.invalidateQueries({ queryKey: ["superAdminAdminsList"] });
      queryClient.invalidateQueries({ queryKey: ["superAdminAdminsSearch"] });
    } catch (err) {
      console.error("Status update error:", err);
      toast.error(err?.message || "Failed to update admin status");
    } finally {
      setStatusUpdatingId(null);
    }
  };

  const handleToggleAdminStatus = (admin) => {
    const nextStatus = admin.status === "active" ? "inactive" : "active";
    setConfirmConfig({
      isOpen: true,
      title: `${nextStatus === "active" ? "Activate" : "Deactivate"} Administrator?`,
      message: `Are you sure you want to mark admin "${admin.name || admin.username}" as ${nextStatus}? ${
        nextStatus === "inactive"
          ? "This will prevent access to their white-label platform and associated services."
          : "This will restore full access to their white-label platform."
      }`,
      confirmText: nextStatus === "active" ? "Activate Admin" : "Deactivate Admin",
      cancelText: "Cancel",
      variant: nextStatus === "active" ? "success" : "danger",
      onConfirm: async () => {
        setConfirmConfig((prev) => ({ ...prev, isOpen: false }));
        await executeToggleAdminStatus(admin, nextStatus);
      },
    });
  };

  // ── Excel Export ──────────────────────────────────────────────────────────
  const handleExportExcel = async () => {
    setIsExporting(true);
    try {
      const res = await getAdminList({
        page: 1,
        limit: 1000,
        status: adminParams.status || undefined,
        search: committedSearch || undefined,
      });

      const list = extractUsersArray(res) || [];
      if (list.length === 0) {
        toast.info("No admin records to export.");
        return;
      }

      const rows = list.map((a, idx) => ({
        "SL No": idx + 1,
        "Admin ID": a.abheepay_id || a.username || "N/A",
        "Name": a.name || "N/A",
        "Email": a.email || "N/A",
        "Mobile": a.mobile_number || "N/A",
        "Company Name": a.company?.company_name || a.company_or_shop_name || "N/A",
        "Domain": a.company?.domain_name || "N/A",
        "Wallet Balance": Number(a.wallet_balance || a.wallet || 0).toFixed(2),
        "POS Count": a.pos_machine_count || 0,
        "Status": a.status || "active",
      }));

      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Admins");
      const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
      const blob = new Blob([excelBuffer], { type: "application/octet-stream" });
      saveAs(blob, `SuperAdmin_AdminList_${Date.now()}.xlsx`);
      toast.success("Admins exported successfully");
    } catch (err) {
      console.error("Export error:", err);
      toast.error(err?.message || "Failed to export admins");
    } finally {
      setIsExporting(false);
    }
  };

  // ── Table Columns ─────────────────────────────────────────────────────────
  const columns = [
    {
      header: "SL",
      key: "sl",
      render: (_, __, index) => (effectivePage - 1) * effectiveLimit + index + 1,
    },
    {
      header: "Admin ID",
      key: "abheepay_id",
      render: (_, row) => (
        <span className="font-semibold text-gray-900">
          {row.abheepay_id || row.username || "—"}
        </span>
      ),
    },
    {
      header: "Admin / Director",
      key: "name",
      render: (_, row) => (
        <div>
          <div className="font-medium text-gray-900">{row.name || "—"}</div>
          <div className="text-xs text-gray-500">{row.email || "—"}</div>
        </div>
      ),
    },
    {
      header: "Mobile",
      key: "mobile_number",
      render: (mob) => mob || "—",
    },
    {
      header: "Company & Domain",
      key: "company_details",
      render: (_, row) => (
        <div>
          <div className="font-medium text-gray-800">
            {row.company?.company_name || row.company_or_shop_name || "—"}
          </div>
          <div className="text-xs text-indigo-600 font-mono">
            {row.company?.domain_name || "—"}
          </div>
        </div>
      ),
    },
    {
      header: "Wallet Balance",
      key: "wallet",
      render: (_, row) => (
        <span className="font-semibold text-emerald-700">
          ₹{Number(row.wallet_balance ?? row.wallet ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
        </span>
      ),
    },
    {
      header: "POS Machines",
      key: "pos_machine_count",
      render: (cnt) => (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
          {cnt || 0} POS
        </span>
      ),
    },
    {
      header: "Status",
      key: "status",
      render: (status, row) => {
        const isActive = status === "active";
        const isBusy = statusUpdatingId === row.id;

        return (
          <button
            type="button"
            disabled={isBusy}
            onClick={() => handleToggleAdminStatus(row)}
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all ${
              isActive
                ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                : "bg-rose-100 text-rose-800 hover:bg-rose-200"
            }`}
          >
            {isBusy ? <Loader2 size={12} className="animate-spin" /> : null}
            <span>{isActive ? "Active" : "Inactive"}</span>
          </button>
        );
      },
    },
    {
      header: "Actions",
      key: "actions",
      render: (_, row) => (
        <div className="flex items-center gap-2">
          {/* View Profile */}
          <button
            type="button"
            title="View Admin Profile"
            onClick={() => navigate(`/super-admin/admin/${row.id}`)}
            className="p-1.5 rounded-md border border-gray-200 text-gray-700 hover:bg-primary hover:text-white hover:border-primary transition-colors"
          >
            <Eye size={16} />
          </button>

          {/* Edit Admin */}
          <button
            type="button"
            title="Edit Admin"
            onClick={() => navigate(`/super-admin/create-admin/${row.id}`)}
            className="p-1.5 rounded-md border border-gray-200 text-gray-700 hover:bg-primary hover:text-white hover:border-primary transition-colors"
          >
            <SquarePen size={16} />
          </button>

          {/* Action Menu (3 Dots) */}
          <button
            type="button"
            title="Admin Management Menu"
            onClick={() => handleOpenAdminActionMenu(row)}
            className="p-1.5 rounded-md border border-gray-200 text-gray-700 hover:bg-primary hover:text-white hover:border-primary transition-colors"
          >
            <MoreHorizontal size={16} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-primary text-white p-2.5 rounded-xl shadow-sm">
            <ShieldCheck size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Admin Management</h1>
            <p className="text-sm text-gray-500">
              Super Admin view: Manage all white-label company administrators
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Create Admin Button */}
          <button
            type="button"
            onClick={() => navigate("/super-admin/create-admin")}
            className="px-4 py-2 bg-primary text-white font-medium rounded-lg hover:bg-primary-hover shadow-sm transition-colors text-sm"
          >
            + Create Admin
          </button>

          {/* Export to Excel */}
          <button
            type="button"
            onClick={handleExportExcel}
            disabled={isExporting}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            {isExporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
            <span>Export</span>
          </button>
        </div>
      </div>

      {/* ── Filters & Search ──────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <form onSubmit={handleSearchSubmit} className="flex flex-col md:flex-row gap-3 items-center justify-between">
          <div className="relative w-full md:w-96">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchInputValue}
              onChange={(e) => setSearchInputValue(e.target.value)}
              placeholder="Search by name, email, mobile, ID, company..."
              className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            {/* Status Filter */}
            <select
              value={adminParams.status}
              onChange={(e) => {
                setAdminParams((prev) => ({ ...prev, status: e.target.value, page: 1 }));
                setSearchPage(1);
              }}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:outline-none"
            >
              <option value="">All Statuses</option>
              <option value="active">Active Only</option>
              <option value="inactive">Inactive Only</option>
            </select>

            <button
              type="submit"
              className="px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary-hover transition-colors"
            >
              Search
            </button>

            {committedSearch && (
              <button
                type="button"
                onClick={handleClearSearch}
                className="px-3 py-2 border border-gray-300 text-sm font-medium text-gray-600 rounded-lg hover:bg-gray-50"
              >
                Clear
              </button>
            )}
          </div>
        </form>
      </div>

      {/* ── Table Card ─────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center">
            <Loader2 size={32} className="animate-spin text-primary mx-auto mb-3" />
            <p className="text-sm text-gray-500">Loading administrators...</p>
          </div>
        ) : isError ? (
          <div className="p-8 text-center text-rose-600">
            <p className="font-medium">Failed to load administrators.</p>
            <p className="text-xs mt-1 text-gray-500">{allAdminsError?.message || searchError?.message}</p>
            <button
              type="button"
              onClick={() => refetchAllAdmins()}
              className="mt-3 px-4 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs rounded-lg"
            >
              Retry
            </button>
          </div>
        ) : currentData.length === 0 ? (
          <div className="p-12 text-center">
            <Users size={36} className="text-gray-300 mx-auto mb-2" />
            <p className="text-base font-medium text-gray-800">No administrators found</p>
            <p className="text-sm text-gray-500 mt-1">
              {committedSearch ? "Try adjusting your search query or filters" : "Create your first administrator to get started"}
            </p>
          </div>
        ) : (
          <div>
            <Table columns={columns} data={currentData} />

            {/* Pagination */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50/50">
              <span className="text-xs text-gray-500">
                Showing {currentData.length} of {totalResults} administrators
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={effectivePage <= 1}
                  onClick={() => {
                    if (isSearchMode) setSearchPage((p) => Math.max(1, p - 1));
                    else setAdminParams((p) => ({ ...p, page: Math.max(1, p.page - 1) }));
                  }}
                  className="px-3 py-1.5 border border-gray-300 rounded-md text-xs font-medium text-gray-700 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Previous
                </button>

                <span className="text-xs text-gray-600 font-medium px-2">
                  Page {effectivePage} of {totalPages}
                </span>

                <button
                  type="button"
                  disabled={effectivePage >= totalPages}
                  onClick={() => {
                    if (isSearchMode) setSearchPage((p) => Math.min(totalPages, p + 1));
                    else setAdminParams((p) => ({ ...p, page: Math.min(totalPages, p.page + 1) }));
                  }}
                  className="px-3 py-1.5 border border-gray-300 rounded-md text-xs font-medium text-gray-700 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Admin Action Menu Modal (Three Dots) ── */}
      <AdminActionMenuModal
        isOpen={isAdminActionMenuOpen}
        onClose={() => {
          setIsAdminActionMenuOpen(false);
          setSelectedAdminForAction(null);
        }}
        admin={selectedAdminForAction}
        onSelectServiceManagement={handleSelectServiceManagement}
        onSelectRateManagement={handleSelectRateManagement}
        onSelectWalletManagement={handleSelectWalletManagement}
      />

      {/* ── Admin-based Service Management Modal ── */}
      <ServiceManagementModal
        isOpen={isServiceModalOpen}
        onClose={() => {
          setIsServiceModalOpen(false);
          setSelectedCompany(null);
        }}
        company={selectedCompany}
        onSave={handleSaveServices}
      />

      {/* ── Admin Wallet Adjustment Modal ── */}
      <AdminWalletModal
        isOpen={isWalletModalOpen}
        onClose={() => {
          setIsWalletModalOpen(false);
          setSelectedAdminForAction(null);
        }}
        admin={selectedAdminForAction}
        onSuccess={handleWalletSuccess}
      />

      {/* ── Admin Rate Management Modal (In-Place Modal) ── */}
      <AdminRateModal
        isOpen={isRateModalOpen}
        onClose={handleCloseRateModal}
        admin={selectedAdminForAction}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["superAdminAdminsList"] });
          queryClient.invalidateQueries({ queryKey: ["superAdminAdminsSearch"] });
        }}
      />

      {/* ── Confirmation Modal ── */}
      <ConfirmationModal
        isOpen={confirmConfig.isOpen}
        onClose={() => setConfirmConfig((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={confirmConfig.onConfirm}
        title={confirmConfig.title}
        message={confirmConfig.message}
        confirmText={confirmConfig.confirmText}
        cancelText={confirmConfig.cancelText}
        variant={confirmConfig.variant}
      />
    </div>
  );
};

export default SuperAdminAdminList;
