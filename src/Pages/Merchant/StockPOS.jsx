import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Box,
  CheckCircle2,
  AlertCircle,
  Search,
  RotateCcw,
  Download,
  Building2,
  CreditCard,
  Hash,
  Layers,
  ShieldCheck,
} from "lucide-react";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import Loader from "../../components/Loader";
import { getMerchantStockPosMachines } from "../../api/merchantStockPos";

const getStatusBadgeColor = (status) => {
  const normalized = String(status || "").toLowerCase().trim().replace(/_/g, "-");
  const colors = {
    active: "bg-green-100 text-green-800 border border-green-200",
    inactive: "bg-red-100 text-red-800 border border-red-200",
    "in-active": "bg-red-100 text-red-800 border border-red-200",
    added: "bg-blue-100 text-blue-800 border border-blue-200",
    assigned: "bg-green-100 text-green-800 border border-green-200",
    "un-assigned": "bg-gray-100 text-gray-700 border border-gray-200",
    delivered: "bg-purple-100 text-purple-800 border border-purple-200",
    "returned-initiated": "bg-yellow-100 text-yellow-800 border border-yellow-200",
    "return-initiated": "bg-yellow-100 text-yellow-800 border border-yellow-200",
  };
  return colors[normalized] || "bg-gray-100 text-gray-800 border border-gray-200";
};

const formatStatusLabel = (status) => {
  const normalized = String(status || "").toLowerCase().trim().replace(/_/g, "-");
  if (normalized === "active") return "Active";
  if (normalized === "inactive" || normalized === "in-active") return "Inactive";
  if (normalized === "delivered") return "Delivered";
  if (normalized === "return-initiated" || normalized === "returned-initiated") return "Return Initiated";
  if (normalized === "added") return "Added";
  return status || "Unknown";
};

const PAGE_SIZE = 10;

const StockPOS = ({ currentUser }) => {
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [bankNameInput, setBankNameInput] = useState("");
  const [bankNameFilter, setBankNameFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isExporting, setIsExporting] = useState(false);

  // Fetch only the logged-in merchant's assigned machines
  const {
    data: posResponse,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: [
      "merchantStockPos",
      { page, statusFilter, searchTerm, bankNameFilter, userId: currentUser?.id },
    ],
    queryFn: () =>
      getMerchantStockPosMachines({
        status: statusFilter,
        search: searchTerm,
        bankName: bankNameFilter,
        page,
        limit: PAGE_SIZE,
      }),
    keepPreviousData: true,
  });

  const machines = posResponse?.data || [];
  const summary = posResponse?.summary || {
    totalAssigned: 0,
    activeMachines: 0,
    inactiveMachines: 0,
  };
  const pagination = posResponse?.pagination || {
    total: 0,
    page: 1,
    limit: PAGE_SIZE,
    totalPages: 1,
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setSearchTerm(searchInput.trim());
    setBankNameFilter(bankNameInput.trim());
    setPage(1);
  };

  const handleClearFilters = () => {
    setSearchInput("");
    setSearchTerm("");
    setBankNameInput("");
    setBankNameFilter("");
    setStatusFilter("all");
    setPage(1);
  };

  const handleExportToExcel = () => {
    if (!machines || machines.length === 0) return;
    setIsExporting(true);
    try {
      const exportData = machines.map((machine, index) => ({
        "SL No": (page - 1) * PAGE_SIZE + index + 1,
        "Serial Number": machine.device_serial_number || "-",
        "Bank Name": machine.bank_name || "-",
        TID: machine.tid_number || "-",
        MID: machine.mid_number || "-",
        Company: machine.company_name || "-",
        Status: formatStatusLabel(machine.status),
        "Assigned Merchant": currentUser?.name || currentUser?.business_name || "Assigned",
        "Assigned Mobile": currentUser?.mobile_number || "-",
        "Assigned Date": machine.createdAt
          ? new Date(machine.createdAt).toLocaleDateString("en-IN")
          : "-",
      }));

      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Merchant_POS_Stock");
      const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
      const blob = new Blob([excelBuffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8",
      });
      saveAs(blob, `Merchant_POS_Stock_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (err) {
      console.error("Export failed:", err);
    } finally {
      setIsExporting(false);
    }
  };

  const hasActiveFilters = Boolean(searchTerm || bankNameFilter || statusFilter !== "all");

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 tracking-tight">
              Stock POS Inventory
            </h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#00D3CD]/15 text-[#009b97]">
              <ShieldCheck className="w-3.5 h-3.5" />
              Merchant View
            </span>
          </div>
          <p className="mt-1 text-sm text-gray-600">
            View POS terminals assigned to your merchant account.
          </p>
        </div>

        {/* Read-only action controls: Export Excel */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleExportToExcel}
            disabled={isExporting || machines.length === 0}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-sm font-medium rounded-lg shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="w-4 h-4" />
            {isExporting ? "Exporting..." : "Export Excel"}
          </button>
        </div>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Total Assigned POS Machines */}
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-5 text-white shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-blue-100">
              Total Assigned POS
            </p>
            <p className="mt-1 text-3xl font-extrabold">{summary.totalAssigned}</p>
            <p className="mt-1 text-xs text-blue-100">Assigned to your account</p>
          </div>
          <div className="p-3 bg-white/10 rounded-xl">
            <Box className="w-8 h-8 text-white" />
          </div>
        </div>

        {/* Active Machines */}
        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl p-5 text-white shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-emerald-100">
              Active Machines
            </p>
            <p className="mt-1 text-3xl font-extrabold">{summary.activeMachines}</p>
            <p className="mt-1 text-xs text-emerald-100">Operational & ready</p>
          </div>
          <div className="p-3 bg-white/10 rounded-xl">
            <CheckCircle2 className="w-8 h-8 text-white" />
          </div>
        </div>

        {/* Inactive Machines */}
        <div className="bg-gradient-to-br from-rose-500 to-rose-600 rounded-xl p-5 text-white shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-rose-100">
              Inactive Machines
            </p>
            <p className="mt-1 text-3xl font-extrabold">{summary.inactiveMachines}</p>
            <p className="mt-1 text-xs text-rose-100">Inactive or returned</p>
          </div>
          <div className="p-3 bg-white/10 rounded-xl">
            <AlertCircle className="w-8 h-8 text-white" />
          </div>
        </div>
      </div>

      {/* Search and Filters Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <form onSubmit={handleSearchSubmit} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Search by serial, TID, MID */}
            <div className="relative">
              <input
                type="text"
                placeholder="Search Serial, TID, MID..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#00D3CD]/50 focus:border-[#00D3CD]"
              />
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
            </div>

            {/* Bank Name Filter */}
            <div className="relative">
              <input
                type="text"
                placeholder="Filter by Bank Name..."
                value={bankNameInput}
                onChange={(e) => setBankNameInput(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#00D3CD]/50 focus:border-[#00D3CD]"
              />
              <Building2 className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
            </div>

            {/* Status Filter */}
            <div>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#00D3CD]/50 focus:border-[#00D3CD] bg-white text-gray-700"
              >
                <option value="all">All Statuses</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>

            {/* Buttons */}
            <div className="flex items-center gap-2">
              <button
                type="submit"
                className="flex-1 inline-flex items-center justify-center gap-2 bg-[#00D3CD] hover:bg-[#00bdb7] text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors shadow-sm"
              >
                <Search className="w-4 h-4" />
                Search
              </button>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={handleClearFilters}
                  className="inline-flex items-center justify-center gap-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium py-2 px-3 rounded-lg transition-colors"
                  title="Reset Filters"
                >
                  <RotateCcw className="w-4 h-4" />
                  Reset
                </button>
              )}
            </div>
          </div>

          {hasActiveFilters && (
            <div className="flex items-center gap-2 text-xs text-gray-500 pt-1">
              <span>Filtering by:</span>
              {searchTerm && (
                <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded-md font-medium">
                  Search: "{searchTerm}"
                </span>
              )}
              {bankNameFilter && (
                <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded-md font-medium">
                  Bank: "{bankNameFilter}"
                </span>
              )}
              {statusFilter !== "all" && (
                <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded-md font-medium capitalize">
                  Status: {statusFilter}
                </span>
              )}
            </div>
          )}
        </form>
      </div>

      {/* Error State */}
      {isError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 flex items-start justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-500" />
            <span>{error?.message || "Failed to load assigned POS machines."}</span>
          </div>
          <button
            type="button"
            onClick={() => refetch()}
            className="text-xs font-semibold text-red-700 underline hover:text-red-800"
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading State */}
      {isLoading ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <Loader />
        </div>
      ) : machines.length === 0 ? (
        /* Empty State */
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4 text-gray-400">
            <Box className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900">
            {hasActiveFilters ? "No matching POS machines" : "No POS machines assigned yet."}
          </h3>
          <p className="mt-1 text-sm text-gray-500 max-w-md mx-auto">
            {hasActiveFilters
              ? "We couldn't find any assigned machines matching your search or filters. Try adjusting your search query."
              : "POS terminals will appear here once assigned to your merchant account by your Admin or Franchise partner."}
          </p>
          {hasActiveFilters && (
            <div className="mt-5">
              <button
                type="button"
                onClick={handleClearFilters}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-sm font-medium text-gray-700 transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                Clear Filters
              </button>
            </div>
          )}
        </div>
      ) : (
        /* Table and Cards Display */
        <div className="space-y-4">
          {/* Desktop Table View */}
          <div className="hidden md:block bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-gray-50/80 border-b border-gray-200">
                  <tr>
                    <th className="px-5 py-3.5 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      #
                    </th>
                    <th className="px-5 py-3.5 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Serial Number
                    </th>
                    <th className="px-5 py-3.5 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Bank Name
                    </th>
                    <th className="px-5 py-3.5 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      TID
                    </th>
                    <th className="px-5 py-3.5 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      MID
                    </th>
                    <th className="px-5 py-3.5 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Machine Status
                    </th>
                    <th className="px-5 py-3.5 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Assignment Information
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {machines.map((machine, index) => {
                    const rowNumber = (page - 1) * PAGE_SIZE + index + 1;
                    return (
                      <tr key={machine.id || index} className="hover:bg-gray-50/60 transition-colors">
                        <td className="px-5 py-4 text-sm font-medium text-gray-500 whitespace-nowrap">
                          {rowNumber}
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-gray-900 text-sm">
                              {machine.device_serial_number || "-"}
                            </span>
                          </div>
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap text-sm text-gray-700">
                          <span className="inline-flex items-center gap-1.5 font-medium">
                            <Building2 className="w-3.5 h-3.5 text-gray-400" />
                            {machine.bank_name || "-"}
                          </span>
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap text-sm font-mono text-gray-800">
                          {machine.tid_number || "-"}
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap text-sm font-mono text-gray-800">
                          {machine.mid_number || "-"}
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${getStatusBadgeColor(
                              machine.status
                            )}`}
                          >
                            {formatStatusLabel(machine.status)}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-sm text-gray-700">
                          <div>
                            <span className="font-medium text-gray-900">
                              {currentUser?.name || currentUser?.business_name || "Assigned Merchant"}
                            </span>
                            <div className="text-xs text-gray-500 mt-0.5">
                              ID: {currentUser?.id || machine.assigned_to || "-"}
                              {currentUser?.mobile_number && ` • ${currentUser.mobile_number}`}
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Cards View */}
          <div className="md:hidden space-y-3">
            {machines.map((machine, index) => {
              const rowNumber = (page - 1) * PAGE_SIZE + index + 1;
              return (
                <div
                  key={machine.id || index}
                  className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm space-y-3"
                >
                  <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                    <span className="text-xs font-semibold text-gray-500">#{rowNumber}</span>
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${getStatusBadgeColor(
                        machine.status
                      )}`}
                    >
                      {formatStatusLabel(machine.status)}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5 text-xs">
                    <div>
                      <p className="text-gray-500 font-medium uppercase">Serial Number</p>
                      <p className="mt-0.5 text-sm font-semibold text-gray-900 break-all">
                        {machine.device_serial_number || "-"}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500 font-medium uppercase">Bank Name</p>
                      <p className="mt-0.5 text-sm font-medium text-gray-800">
                        {machine.bank_name || "-"}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500 font-medium uppercase">TID</p>
                      <p className="mt-0.5 font-mono text-sm text-gray-900">
                        {machine.tid_number || "-"}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500 font-medium uppercase">MID</p>
                      <p className="mt-0.5 font-mono text-sm text-gray-900">
                        {machine.mid_number || "-"}
                      </p>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-gray-100 text-xs text-gray-600">
                    <span className="font-medium text-gray-500">Assignment: </span>
                    <span className="font-semibold text-gray-900">
                      {currentUser?.name || currentUser?.business_name || "Assigned Merchant"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination Controls */}
          {pagination.totalPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-gray-200">
              <p className="text-xs text-gray-600">
                Page <span className="font-semibold text-gray-900">{pagination.page}</span> of{" "}
                <span className="font-semibold text-gray-900">{pagination.totalPages}</span> | Total
                Assigned: <span className="font-semibold text-gray-900">{pagination.total}</span>
                {isFetching && " (Updating...)"}
              </p>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
                  disabled={page <= 1 || isFetching}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Previous
                </button>
                {Array.from({ length: pagination.totalPages }, (_, i) => i + 1)
                  .filter((p) => {
                    // Show first, last, and window around current
                    return (
                      p === 1 ||
                      p === pagination.totalPages ||
                      (p >= page - 1 && p <= page + 1)
                    );
                  })
                  .map((p, idx, arr) => {
                    const prevP = arr[idx - 1];
                    const showEllipsis = prevP && p - prevP > 1;
                    return (
                      <React.Fragment key={p}>
                        {showEllipsis && <span className="px-1 text-gray-400 text-xs">...</span>}
                        <button
                          type="button"
                          onClick={() => setPage(p)}
                          disabled={isFetching}
                          className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                            p === page
                              ? "bg-[#00D3CD] text-white border-[#00D3CD]"
                              : "border-gray-300 text-gray-700 hover:bg-gray-50"
                          }`}
                        >
                          {p}
                        </button>
                      </React.Fragment>
                    );
                  })}
                <button
                  type="button"
                  onClick={() => setPage((prev) => Math.min(prev + 1, pagination.totalPages))}
                  disabled={page >= pagination.totalPages || isFetching}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default StockPOS;

