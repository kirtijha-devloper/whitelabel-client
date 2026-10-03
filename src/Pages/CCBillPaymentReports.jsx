import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "react-router-dom";
import { getAllCCBillPaymentReport, getCCBillPaymentReport, manualRefundCCBillPayment } from "../api/reportsApi";
import Table from "../components/Table";
import { Download, RefreshCcw, Eye, X, Clock, CheckCircle2, AlertTriangle, ArrowRight } from "lucide-react";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { toast } from "react-toastify";
import ReportTabs from "../components/Reports/ReportTabs";
import CombinedReportDownloadButton from "../components/Reports/CombinedReportDownloadButton";
import UserSelectWithSuggestions from "../components/Reports/UserSelectWithSuggestions";

const PAGE_SIZE = 50;
const EXPORT_FETCH_LIMIT = 200;

const inputClassName =
  "w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-[#00D3CD] outline-none";
const compactInputClassName =
  "w-full rounded-lg border border-gray-200 bg-white px-2 py-2 text-xs focus:ring-2 focus:ring-[#00D3CD] outline-none";
const STATUS_FILTER_OPTIONS = [
  { value: "", label: "All" },
  { value: "SUCCESS", label: "Success" },
  { value: "REFUNDED", label: "Refunded" },
  { value: "REFUND_PENDING", label: "Refund Pending" },
  { value: "FAILED", label: "Failed" },
  { value: "PENDING", label: "Pending" },
];
const CC_BILL_SUCCESS_STATUS_CODES = new Set(["TXN", "TUP"]);
const CC_BILL_PENDING_STATUS_CODES = new Set([
  "PEN",
  "PENDING",
  "PROCESSING",
  "INP",
  "INIT",
  "INITIATED",
]);
const CC_BILL_FAILED_STATUS_CODES = new Set([
  "ERR",
  "ERROR",
  "FAIL",
  "FAILED",
  "FAILURE",
  "REJECTED",
  "DECLINED",
]);

const formatDateTime = (value) => {
  if (!value) return "-";

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) return "-";

  return parsedDate.toLocaleString("en-IN");
};

const formatCurrency = (value) =>
  `\u20B9${parseFloat(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const getNormalizedCcBillStatus = (txn = {}) => {
  const statusCode = String(txn?.statuscode || "").trim().toUpperCase();
  const statusText = String(txn?.status || "").trim().toLowerCase();

  // Explicit failure status codes (e.g. ERR, ERROR, FAIL)
  if (CC_BILL_FAILED_STATUS_CODES.has(statusCode)) {
    return "FAILED";
  }

  if (
    CC_BILL_SUCCESS_STATUS_CODES.has(statusCode) ||
    statusText.includes("success") ||
    statusText.includes("completed")
  ) {
    return "SUCCESS";
  }

  if (
    CC_BILL_PENDING_STATUS_CODES.has(statusCode) ||
    (statusCode === "" && /^(pending|processing|initiated|in progress|queued)$/i.test(statusText))
  ) {
    return "PENDING";
  }

  return "FAILED";
};

const getCcBillDisplayStatus = (txn = {}) => {
  if (txn?.refund_status === "REFUNDED") {
    return { status: "REFUNDED", label: "REFUNDED", toneClass: "bg-emerald-100 text-emerald-800 border border-emerald-300 font-semibold" };
  }
  if (txn?.refund_status === "REFUND_PENDING") {
    return { status: "REFUND_PENDING", label: "REFUND PENDING", toneClass: "bg-amber-100 text-amber-900 border border-amber-400 font-bold" };
  }
  const norm = getNormalizedCcBillStatus(txn);
  if (norm === "SUCCESS") {
    return { status: "SUCCESS", label: "SUCCESS", toneClass: "bg-green-100 text-green-800 font-semibold" };
  }
  if (norm === "PENDING") {
    return { status: "PENDING", label: "PENDING", toneClass: "bg-yellow-100 text-yellow-800 font-semibold" };
  }
  return { status: "FAILED", label: "FAILED", toneClass: "bg-red-100 text-red-800 font-semibold" };
};

const mapCcBillRowsToExport = (rows = [], startIndex = 1) =>
  rows.map((txn, index) => {
    const disp = getCcBillDisplayStatus(txn);
    return {
      "#": startIndex + index,
      "Date & Time": formatDateTime(txn.date || txn.date_and_time),
      "User Name": txn.user?.name || "-",
      "User ID": txn.user?.abheepay_id || txn.user?.id || "",
      "Order ID": txn.external_ref || txn.utr_no || "-",
      "Description": txn.description || "",
      "Amount (Rs)": parseFloat(txn.amount || txn.debit || 0).toFixed(2),
      "Closing Balance (Rs)": parseFloat(txn.balance_after ?? txn.balance ?? 0).toFixed(2),
      "Status Badge": disp.label,
      "Balance Deducted At": formatDateTime(txn.deducted_at || txn.date),
      "Refund Status": txn.refund_status || "N/A",
      "Refunded At": txn.refund_details?.refunded_at ? formatDateTime(txn.refund_details.refunded_at) : (disp.status === "REFUND_PENDING" ? "REFUND PENDING" : "-"),
    };
  });

const CCBillPaymentReports = () => {
  const location = useLocation();
  const reportsBasePath = location.pathname.startsWith("/franchise")
    ? "/franchise/reports"
    : location.pathname.startsWith("/merchant")
      ? "/merchant/reports"
      : "/admin/reports";
  const canSelectUser = location.pathname.startsWith("/admin") || location.pathname.startsWith("/employee");
  const today = new Date().toISOString().split("T")[0];
  const [selectedUser, setSelectedUser] = useState(null);
  const [filters, setFilters] = useState({
    startDate: today,
    endDate: today,
    status: "",
    userSearch: "",
    page: 1,
    limit: PAGE_SIZE,
  });
  const [isExporting, setIsExporting] = useState(false);
  const [selectedDbRecord, setSelectedDbRecord] = useState(null);
  const [confirmRefundRecord, setConfirmRefundRecord] = useState(null);
  const [isRefunding, setIsRefunding] = useState(false);

  const handleUserSelect = (user) => {
    setSelectedUser(user);
    const searchVal = user ? (user.name || user.abheepay_id || user.mobile_number || user.id) : "";
    setFilters((prev) => ({
      ...prev,
      userSearch: searchVal,
      page: 1,
    }));
  };

  const { data: reportResponse, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["ccBillPaymentReport", filters],
    queryFn: () => getCCBillPaymentReport(filters),
    keepPreviousData: true,
  });

  const reportData = Array.isArray(reportResponse?.data) ? reportResponse.data : [];
  const pagination = reportResponse?.pagination || {
    total: reportData.length,
    page: filters.page,
    limit: filters.limit,
    totalPages: Math.max(1, Math.ceil(reportData.length / filters.limit)),
  };

  const handleExecuteRefund = async () => {
    if (!confirmRefundRecord || isRefunding) return;
    try {
      setIsRefunding(true);
      const res = await manualRefundCCBillPayment({
        reference_id: confirmRefundRecord.reference_id,
        ledger_id: confirmRefundRecord.id,
        reason: "Admin/Employee manual refund for failed CC bill payment",
      });
      toast.success(res?.message || "Refund issued successfully!");
      setConfirmRefundRecord(null);
      setSelectedDbRecord(null);
      refetch();
    } catch (err) {
      toast.error(err?.message || "Failed to process manual refund");
    } finally {
      setIsRefunding(false);
    }
  };

  const filteredReportData = useMemo(() => {
    let result = reportData;

    if (filters.status) {
      const selectedStatus = String(filters.status).toUpperCase();
      result = result.filter((row) => {
        const displayStatus = getCcBillDisplayStatus(row).status;
        if (selectedStatus === "REFUNDED") return displayStatus === "REFUNDED";
        if (selectedStatus === "REFUND_PENDING") return displayStatus === "REFUND_PENDING";
        return getNormalizedCcBillStatus(row) === selectedStatus;
      });
    }

    if (filters.userSearch && String(filters.userSearch).trim()) {
      const q = String(filters.userSearch).trim().toLowerCase();
      result = result.filter((row) => {
        const uName = String(row.user?.name || "").toLowerCase();
        const uId = String(row.user?.abheepay_id || row.user?.id || "").toLowerCase();
        const uMobile = String(row.user?.mobile_number || "").toLowerCase();
        return uName.includes(q) || uId.includes(q) || uMobile.includes(q);
      });
    }

    return result;
  }, [reportData, filters.status, filters.userSearch]);

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters((prev) => ({ ...prev, [name]: value, page: 1 }));
  };

  const handlePageChange = (page) => {
    const nextPage = Number(page);

    if (!Number.isFinite(nextPage)) return;
    if (nextPage < 1 || nextPage > pagination.totalPages || nextPage === pagination.page) {
      return;
    }

    setFilters((prev) => ({ ...prev, page: nextPage }));
  };

  const handleExport = async () => {
    if (isExporting) return;

    try {
      setIsExporting(true);

      const allRows = await getAllCCBillPaymentReport(
        {
          startDate: filters.startDate,
          endDate: filters.endDate,
          status: filters.status,
        },
        { limit: EXPORT_FETCH_LIMIT }
      );

      if (allRows.length === 0) {
        toast.warn("No data to export");
        return;
      }

      const worksheet = XLSX.utils.json_to_sheet(mapCcBillRowsToExport(allRows));
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "CC Bill Payments");
      const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
      const blob = new Blob([excelBuffer], { type: "application/octet-stream" });
      saveAs(blob, `CC_Bill_Payment_Report_${Date.now()}.xlsx`);
      toast.success("Report exported successfully");
    } catch (exportError) {
      toast.error(exportError?.message || "Failed to export CC bill payment report");
    } finally {
      setIsExporting(false);
    }
  };

  const reportColumns = [
    {
      header: "#",
      key: "id",
      render: (_, __, rowIndex) => (pagination.page - 1) * pagination.limit + rowIndex + 1,
    },
    {
      header: "Date & Time",
      key: "date",
      render: (date, row) => formatDateTime(date || row.date_and_time),
    },
    {
      header: "User Details",
      key: "user",
      render: (user) => (
        <div className="flex flex-col">
          <span className="font-medium text-gray-900">{user?.name || "-"}</span>
          <span className="text-xs text-gray-500">ID: {user?.abheepay_id || user?.id || ""}</span>
        </div>
      ),
    },
    {
      header: "Order ID",
      key: "external_ref",
      render: (ref, row) => ref || row.utr_no || "-",
    },
    { header: "Description", key: "description" },
    {
      header: "Amount (Rs)",
      key: "amount",
      render: (amount, row) => (
        <span className="text-red-600 font-medium">
          {formatCurrency(amount || row.debit || 0)}
        </span>
      ),
    },
    {
      header: "Closing Balance (Rs)",
      key: "balance_after",
      render: (balance, row) => formatCurrency(balance ?? row.balance ?? 0),
    },
    {
      header: "Status",
      key: "status",
      render: (_, row) => {
        const primaryStatus = getNormalizedCcBillStatus(row);
        const primaryTone =
          primaryStatus === "SUCCESS"
            ? "bg-green-100 text-green-800 font-semibold"
            : primaryStatus === "FAILED"
              ? "bg-red-100 text-red-800 font-semibold"
              : "bg-yellow-100 text-yellow-800 font-semibold";

        const refundStatus = row.refund_status;

        return (
          <div className="flex flex-col items-center gap-1 text-center">
            {/* Line 1: Primary Status [FAILED / SUCCESS / PENDING] */}
            <span className={`px-2.5 py-0.5 rounded-full text-xs ${primaryTone}`}>
              {primaryStatus}
            </span>

            {/* Line 2: Refund Sub-Message */}
            {refundStatus === "REFUNDED" && (
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                REFUNDED
              </span>
            )}
            {refundStatus === "REFUND_PENDING" && (
              <button
                onClick={() => setConfirmRefundRecord(row)}
                className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-400 hover:bg-amber-200 transition shadow-sm flex items-center gap-1 cursor-pointer"
                title="Click to issue manual refund for this transaction"
              >
                <span>⚠️ REFUND PENDING</span>
              </button>
            )}
            {primaryStatus === "FAILED" && refundStatus === "NO_DEBIT" && (
              <span className="text-[10px] text-gray-400 font-medium">
                (NO DEBIT)
              </span>
            )}

            {/* Line 3: View DB Button */}
            <button
              onClick={() => setSelectedDbRecord(row)}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 hover:text-blue-800 transition hover:underline mt-0.5"
              title="View exact raw database record and audit timeline"
            >
              <Eye className="w-3 h-3" />
              <span>View DB</span>
            </button>
          </div>
        );
      },
    },
  ];

  const showingFrom = reportData.length === 0 ? 0 : (pagination.page - 1) * pagination.limit + 1;
  const showingTo = reportData.length === 0
    ? 0
    : Math.min((pagination.page - 1) * pagination.limit + reportData.length, pagination.total);
  const shouldShowPagination = pagination.totalPages > 1 && pagination.total > PAGE_SIZE;

  return (
    <div className="min-h-screen bg-transparent px-0 py-1 sm:bg-gray-50 sm:p-6">
      <h1 className="mb-4 text-2xl font-bold text-gray-800">Reports</h1>
      <ReportTabs
        basePath={reportsBasePath}
        activeTab="cc-bill"
        trailingAction={<CombinedReportDownloadButton />}
      />
      <h2 className="mb-6 text-2xl font-bold text-gray-800">CC Bill Payment Report</h2>

      <div className="mb-6 rounded-2xl bg-white p-4 shadow-sm md:rounded-xl md:p-6">
        <div className="space-y-3 md:hidden">
          <div className="grid grid-cols-2 gap-2">
            <div className="min-w-0">
              <label className="mb-1 block text-xs font-medium text-gray-700">From Date</label>
              <input
                type="date"
                name="startDate"
                value={filters.startDate}
                onChange={handleFilterChange}
                className={compactInputClassName}
              />
            </div>
            <div className="min-w-0">
              <label className="mb-1 block text-xs font-medium text-gray-700">To Date</label>
              <input
                type="date"
                name="endDate"
                value={filters.endDate}
                onChange={handleFilterChange}
                className={compactInputClassName}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div className="min-w-0">
              {canSelectUser ? (
                <UserSelectWithSuggestions
                  selectedUser={selectedUser}
                  onSelectUser={handleUserSelect}
                  label="Select User"
                />
              ) : (
                <>
                  <label className="mb-1 block text-xs font-medium text-gray-700">User (ID / Name / Mobile)</label>
                  <input
                    type="text"
                    name="userSearch"
                    value={filters.userSearch}
                    onChange={handleFilterChange}
                    placeholder="Name / ID / Mobile"
                    className={compactInputClassName}
                  />
                </>
              )}
            </div>
            <div className="min-w-0">
              <label className="mb-1 block text-xs font-medium text-gray-700">Status</label>
              <select
                name="status"
                value={filters.status}
                onChange={handleFilterChange}
                className={compactInputClassName}
              >
                {STATUS_FILTER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => refetch()}
              className="flex items-center gap-2 rounded-lg bg-gray-100 px-4 py-2 text-sm text-gray-700 transition hover:bg-gray-200"
            >
              <RefreshCcw className="w-4 h-4" />
              Refresh
            </button>
            <button
              onClick={handleExport}
              disabled={isExporting}
              className="flex items-center gap-2 rounded-lg bg-[#00D3CD] px-4 py-2 text-sm text-white transition hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Download className="w-4 h-4" />
              {isExporting ? "Exporting..." : "Export Excel"}
            </button>
          </div>
        </div>

        <div className="hidden flex-wrap items-end gap-4 md:flex">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">From Date</label>
            <input
              type="date"
              name="startDate"
              value={filters.startDate}
              onChange={handleFilterChange}
              className={inputClassName}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">To Date</label>
            <input
              type="date"
              name="endDate"
              value={filters.endDate}
              onChange={handleFilterChange}
              className={inputClassName}
            />
          </div>
          <div className="w-64">
            {canSelectUser ? (
              <UserSelectWithSuggestions
                selectedUser={selectedUser}
                onSelectUser={handleUserSelect}
                label="Select User"
              />
            ) : (
              <>
                <label className="block text-sm font-medium text-gray-700 mb-1">User (ID / Name / Mobile)</label>
                <input
                  type="text"
                  name="userSearch"
                  value={filters.userSearch}
                  onChange={handleFilterChange}
                  placeholder="Name / ID / Mobile"
                  className={inputClassName}
                />
              </>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              name="status"
              value={filters.status}
              onChange={handleFilterChange}
              className={inputClassName}
            >
              {STATUS_FILTER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => refetch()}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
            >
              <RefreshCcw className="w-4 h-4" />
              Refresh
            </button>
            <button
              onClick={handleExport}
              disabled={isExporting}
              className="flex items-center gap-2 px-4 py-2 bg-[#00D3CD] text-white rounded-lg hover:shadow-lg transition disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Download className="w-4 h-4" />
              {isExporting ? "Exporting..." : "Export Excel"}
            </button>
          </div>
        </div>
      </div>

      {!isLoading && !isError && filteredReportData.length > 0 && (
        <div className="mb-4 flex flex-col gap-3 text-sm text-gray-500 md:flex-row md:items-center md:justify-between">
          <span>
            Showing {showingFrom} to {showingTo} of {pagination.total} records
          </span>
          {shouldShowPagination && (
            <div className="flex flex-wrap items-center gap-2 md:justify-end">
              <button
                onClick={() => handlePageChange(pagination.page - 1)}
                disabled={pagination.page <= 1}
                className="px-3 py-1 rounded border disabled:opacity-40 hover:bg-gray-100 transition"
              >
                Previous
              </button>
              {Array.from({ length: Math.min(pagination.totalPages, 7) }, (_, index) => {
                const page = index + 1;

                return (
                  <button
                    key={page}
                    onClick={() => handlePageChange(page)}
                    className={`px-3 py-1 rounded border transition ${page === pagination.page
                        ? "bg-[#00D3CD] text-white border-[#00D3CD]"
                        : "hover:bg-gray-100"
                      }`}
                  >
                    {page}
                  </button>
                );
              })}
              <button
                onClick={() => handlePageChange(pagination.page + 1)}
                disabled={pagination.page >= pagination.totalPages}
                className="px-3 py-1 rounded border disabled:opacity-40 hover:bg-gray-100 transition"
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}

      <div className="overflow-hidden rounded-2xl bg-white shadow-sm md:rounded-xl">
        {isLoading ? (
          <div className="p-12 text-center text-gray-500">Loading transactions...</div>
        ) : isError ? (
          <div className="p-12 text-center text-red-500">Error: {error.message}</div>
        ) : filteredReportData.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            No CC Bill Payment transactions found for the selected period.
          </div>
        ) : (
          <Table columns={reportColumns} data={filteredReportData} />
        )}
      </div>

      {/* DB Record & Life-Cycle Inspector Modal */}
      {selectedDbRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl transition-all">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <h3 className="text-lg font-bold text-gray-900">
                  Transaction & Refund Life-Cycle Details
                </h3>
                <p className="text-xs text-gray-500">
                  Ledger Entry #{selectedDbRecord.id} | Order ID: {selectedDbRecord.external_ref || selectedDbRecord.utr_no || "N/A"}
                </p>
              </div>
              <button
                onClick={() => setSelectedDbRecord(null)}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Life-Cycle Timeline */}
            <div className="mt-4 rounded-xl border border-gray-200 bg-slate-50 p-4">
              <h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-gray-700 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-blue-600" />
                Transaction Audit Timeline
              </h4>

              <div className="space-y-3 relative before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-300">
                {/* Step 1: Initiated */}
                <div className="relative flex items-start gap-3 pl-7">
                  <div className="absolute left-1 top-1 h-4 w-4 rounded-full bg-blue-500 ring-4 ring-white flex items-center justify-center text-white text-[10px] font-bold">
                    1
                  </div>
                  <div>
                    <span className="text-xs font-bold text-gray-800">1. Transaction Initiated</span>
                    <span className="block text-[11px] text-gray-500">
                      {formatDateTime(selectedDbRecord.initiated_at || selectedDbRecord.date)}
                    </span>
                    <span className="block text-[11px] text-gray-600 font-mono mt-0.5">
                      Biller: {selectedDbRecord.biller_id || "N/A"} | Mobile: {selectedDbRecord.customer_mobile || "N/A"}
                    </span>
                  </div>
                </div>

                {/* Step 2: Ledger Balance Deducted */}
                <div className="relative flex items-start gap-3 pl-7">
                  <div className="absolute left-1 top-1 h-4 w-4 rounded-full bg-orange-500 ring-4 ring-white flex items-center justify-center text-white text-[10px] font-bold">
                    2
                  </div>
                  <div>
                    <span className="text-xs font-bold text-gray-800">2. Ledger Balance Deducted</span>
                    <span className="block text-[11px] text-gray-500">
                      {formatDateTime(selectedDbRecord.deducted_at || selectedDbRecord.date)}
                    </span>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="text-xs font-bold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded">
                        - {formatCurrency(selectedDbRecord.amount)}
                      </span>
                      <span className="text-[11px] text-gray-500 font-mono">
                        Ledger #{selectedDbRecord.id}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Step 3: Refund / Status Outcome */}
                <div className="relative flex items-start gap-3 pl-7">
                  {selectedDbRecord.refund_status === "REFUNDED" ? (
                    <>
                      <div className="absolute left-1 top-1 h-4 w-4 rounded-full bg-emerald-500 ring-4 ring-white flex items-center justify-center text-white text-[10px] font-bold">
                        3
                      </div>
                      <div>
                        <span className="text-xs font-bold text-emerald-800 flex items-center gap-1">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          3. Refunded to User Wallet
                        </span>
                        <span className="block text-[11px] text-gray-500">
                          {formatDateTime(selectedDbRecord.refund_details?.refunded_at)}
                        </span>
                        <div className="mt-1 flex items-center gap-2">
                          <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                            + {formatCurrency(selectedDbRecord.refund_details?.credit || selectedDbRecord.amount)}
                          </span>
                          <span className="text-[11px] text-gray-500 font-mono">
                            Reversal Ledger #{selectedDbRecord.refund_details?.id}
                          </span>
                        </div>
                        {selectedDbRecord.refund_details?.description && (
                          <span className="block text-[11px] text-gray-600 italic mt-0.5">
                            {selectedDbRecord.refund_details.description}
                          </span>
                        )}
                      </div>
                    </>
                  ) : selectedDbRecord.refund_status === "REFUND_PENDING" ? (
                    <>
                      <div className="absolute left-1 top-1 h-4 w-4 rounded-full bg-amber-500 ring-4 ring-white flex items-center justify-center text-white text-[10px] font-bold">
                        !
                      </div>
                      <div className="w-full">
                        <span className="text-xs font-bold text-amber-900 flex items-center gap-1">
                          <AlertTriangle className="w-4 h-4 text-amber-600" />
                          3. ⚠️ REFUND PENDING AT ADMIN END
                        </span>
                        <div className="mt-1.5 rounded-lg bg-amber-50 border border-amber-300 p-2.5 text-xs text-amber-900">
                          Balance of <strong>{formatCurrency(selectedDbRecord.amount)}</strong> was deducted on{" "}
                          {formatDateTime(selectedDbRecord.deducted_at || selectedDbRecord.date)}, but transaction failed and reversal credit entry was NOT found in Ledger.
                        </div>
                        <div className="mt-2.5 flex justify-start">
                          <button
                            onClick={() => setConfirmRefundRecord(selectedDbRecord)}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white shadow hover:bg-emerald-700 transition"
                          >
                            <AlertTriangle className="w-3.5 h-3.5" />
                            <span>Issue Manual Refund Now 💸</span>
                          </button>
                        </div>
                      </div>
                    </>
                  ) : selectedDbRecord.refund_status === "SUCCESS" ? (
                    <>
                      <div className="absolute left-1 top-1 h-4 w-4 rounded-full bg-green-500 ring-4 ring-white flex items-center justify-center text-white text-[10px] font-bold">
                        3
                      </div>
                      <div>
                        <span className="text-xs font-bold text-green-800 flex items-center gap-1">
                          <CheckCircle2 className="w-4 h-4 text-green-600" />
                          3. Transaction Successful (No Refund Required)
                        </span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="absolute left-1 top-1 h-4 w-4 rounded-full bg-gray-400 ring-4 ring-white flex items-center justify-center text-white text-[10px] font-bold">
                        3
                      </div>
                      <div>
                        <span className="text-xs font-bold text-gray-700">
                          3. Payment Failed (No Balance Was Deducted)
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Quick Grid Info */}
            <div className="mt-4 grid grid-cols-2 gap-3 text-xs md:grid-cols-3">
              <div className="rounded-lg bg-gray-50 p-2.5">
                <span className="block text-[11px] text-gray-500 font-medium">User</span>
                <span className="font-semibold text-gray-800">{selectedDbRecord.user?.name || "N/A"}</span>
                <span className="block text-[10px] text-gray-400">ID: {selectedDbRecord.user?.abheepay_id || selectedDbRecord.user_id}</span>
              </div>

              <div className="rounded-lg bg-gray-50 p-2.5">
                <span className="block text-[11px] text-gray-500 font-medium">DB Status Code</span>
                <code className="mt-0.5 inline-block font-mono text-xs font-bold text-purple-700">
                  {selectedDbRecord.statuscode || "N/A"}
                </code>
              </div>

              <div className="rounded-lg bg-gray-50 p-2.5">
                <span className="block text-[11px] text-gray-500 font-medium">DB Status Text</span>
                <code className="mt-0.5 inline-block font-mono text-xs font-bold text-blue-700">
                  {selectedDbRecord.status || "N/A"}
                </code>
              </div>

              <div className="rounded-lg bg-gray-50 p-2.5">
                <span className="block text-[11px] text-gray-500 font-medium">Amount</span>
                <span className="font-bold text-red-600">{formatCurrency(selectedDbRecord.amount)}</span>
              </div>

              <div className="rounded-lg bg-gray-50 p-2.5">
                <span className="block text-[11px] text-gray-500 font-medium">Reference Table</span>
                <span className="font-mono text-xs text-gray-700">{selectedDbRecord.reference_table || "CcBillPayments"}</span>
              </div>

              <div className="rounded-lg bg-gray-50 p-2.5">
                <span className="block text-[11px] text-gray-500 font-medium">Reference ID</span>
                <span className="font-mono text-xs text-gray-700">{selectedDbRecord.reference_id || "N/A"}</span>
              </div>
            </div>

            {/* Exact JSON View */}
            <div className="mt-4">
              <div className="mb-1 text-xs font-bold text-gray-700">
                Exact Database JSON Payload (As-It-Is):
              </div>
              <pre className="max-h-56 overflow-x-auto rounded-xl bg-slate-900 p-4 font-mono text-xs text-emerald-400 shadow-inner">
                {JSON.stringify(selectedDbRecord, null, 2)}
              </pre>
            </div>

            <div className="mt-5 flex justify-end">
              <button
                onClick={() => setSelectedDbRecord(null)}
                className="rounded-lg bg-gray-800 px-5 py-2 text-xs font-medium text-white transition hover:bg-gray-900"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Refund Confirmation Modal */}
      {confirmRefundRecord && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl transition-all border border-amber-200">
            <div className="flex items-center gap-3 border-b border-gray-100 pb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-amber-600">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900">
                  Confirm Manual Refund
                </h3>
                <p className="text-xs text-gray-500">
                  Reversal credit entry will be created in user's wallet
                </p>
              </div>
            </div>

            <div className="mt-4 space-y-2 text-xs text-gray-700 bg-amber-50/70 p-3.5 rounded-xl border border-amber-200/80">
              <div className="flex justify-between">
                <span className="text-gray-500">User:</span>
                <span className="font-semibold text-gray-900">{confirmRefundRecord.user?.name || "N/A"} ({confirmRefundRecord.user?.abheepay_id || confirmRefundRecord.user_id})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Order ID:</span>
                <span className="font-mono font-medium text-gray-800">{confirmRefundRecord.external_ref || confirmRefundRecord.utr_no || "N/A"}</span>
              </div>
              <div className="flex justify-between border-t border-amber-200/60 pt-2">
                <span className="font-medium text-gray-700">Refund Amount:</span>
                <span className="font-bold text-emerald-700 text-sm">{formatCurrency(confirmRefundRecord.amount)}</span>
              </div>
            </div>

            <p className="mt-3 text-[11px] text-gray-600 italic">
              Are you sure you want to refund <strong>{formatCurrency(confirmRefundRecord.amount)}</strong> to this user's wallet? This action will log a reversal ledger entry with your Admin/Employee ID.
            </p>

            <div className="mt-5 flex items-center justify-end gap-2.5">
              <button
                onClick={() => setConfirmRefundRecord(null)}
                disabled={isRefunding}
                className="rounded-lg border border-gray-300 px-4 py-2 text-xs font-medium text-gray-700 hover:bg-gray-100 transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteRefund}
                disabled={isRefunding}
                className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow hover:bg-emerald-700 transition disabled:opacity-50 cursor-pointer"
              >
                {isRefunding ? "Processing..." : "Confirm & Refund 💸"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default CCBillPaymentReports;
