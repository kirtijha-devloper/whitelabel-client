import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "react-router-dom";
import { getBillAvenuePayments, getAllBillAvenuePayments, checkBillAvenueStatus } from "../api/billAvenueApi";
import Table from "../components/Table";
import { Download, RefreshCcw } from "lucide-react";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { toast } from "react-toastify";
import ReportTabs from "../components/Reports/ReportTabs";
import CombinedReportDownloadButton from "../components/Reports/CombinedReportDownloadButton";
import UserSelectWithSuggestions from "../components/Reports/UserSelectWithSuggestions";

const inputClassName =
  "w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-[#00D3CD] outline-none";
const compactInputClassName =
  "w-full rounded-lg border border-gray-200 bg-white px-2 py-2 text-xs focus:ring-2 focus:ring-[#00D3CD] outline-none";

const STATUS_BADGE = {
  success: "bg-green-100 text-green-700",
  failed: "bg-red-100 text-red-700",
  pending: "bg-amber-100 text-amber-700",
};

const BillAvenueCCBillPayReports = () => {
  const location = useLocation();
  const reportsBasePath = location.pathname.startsWith("/franchise")
    ? "/franchise/reports"
    : location.pathname.startsWith("/merchant")
      ? "/merchant/reports"
      : "/admin/reports";

  const getTodayDate = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const [filters, setFilters] = useState(() => {
    const today = getTodayDate();
    return {
      status: "",
      billerId: "",
      transactionRefId: "",
      startDate: today,
      endDate: today,
      page: 1,
      limit: 25,
    };
  });

  const { data: response, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["billavenue-payments", filters],
    queryFn: () => getBillAvenuePayments(filters),
    keepPreviousData: true,
  });

  const records = response?.data || [];
  const totalCount = response?.count ?? records.length;

  const [statusCheckingId, setStatusCheckingId] = useState(null);
  const [statusModalData, setStatusModalData] = useState(null);

  const [selectedUser, setSelectedUser] = useState(null);
  const isAdminOrEmployee =
    !location.pathname.startsWith("/franchise") &&
    !location.pathname.startsWith("/merchant");

  const handleUserSelect = (user) => {
    setSelectedUser(user);
    const searchVal = user ? (user.name || user.abheepay_id || user.mobile_number || user.id) : "";
    setFilters((prev) => ({
      ...prev,
      userSearch: searchVal,
      userId: user ? user.id : "",
      page: 1,
    }));
  };

  const handleCheckStatus = async (row) => {
    const refId = row.transaction_ref_id || "";
    const rowId = row.id;

    try {
      setStatusCheckingId(rowId);
      const res = await checkBillAvenueStatus(refId, rowId);
      setStatusModalData({
        title: `BillAvenue Status Check Reply (ID: ${rowId}${refId ? `, Ref: ${refId}` : ""})`,
        data: res,
      });
    } catch (err) {
      setStatusModalData({
        title: `BillAvenue Status Check Reply (ID: ${rowId})`,
        error: err.message || "Failed to check status",
        data: err.responseData || null,
      });
    } finally {
      setStatusCheckingId(null);
    }
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters((prev) => ({ ...prev, [name]: value, page: 1 }));
  };

  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    if (isExporting) return;

    try {
      setIsExporting(true);
      toast.info("Fetching all matching records for Excel export...");

      const allRows = await getAllBillAvenuePayments({
        startDate: filters.startDate,
        endDate: filters.endDate,
        status: filters.status,
        billerId: filters.billerId,
        transactionRefId: filters.transactionRefId,
      });

      if (!allRows || allRows.length === 0) {
        toast.warn("No data to export for selected filters");
        return;
      }

      const exportData = allRows.map((r, index) => {
        const respObj = r.response;
        const reqId =
          respObj?._requestId ||
          respObj?.requestId ||
          respObj?.data?._requestId ||
          respObj?.data?.requestId ||
          respObj?.transactionStatusResp?.payRequestId ||
          "";

        return {
          "#": index + 1,
          "Date": new Date(r.createdAt).toLocaleString("en-IN"),
          "User Name": r.user?.name || "—",
          "User Abheepay ID": r.user?.abheepay_id || r.user?.id || "—",
          "Biller ID": r.biller_id,
          "Amount (₹)": parseFloat(r.transaction_amount || 0).toFixed(2),
          "Charge (₹)": parseFloat(r.charge_amount || 0).toFixed(2),
          "Request ID (35-digit)": reqId || "—",
          "BillAvenue Txn Ref ID": r.transaction_ref_id || "—",
          "Status": r.status,
        };
      });

      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "BillAvenue CC Payments");
      const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
      const blob = new Blob([excelBuffer], { type: "application/octet-stream" });
      const dateRangeSuffix =
        filters.startDate && filters.endDate ? `_${filters.startDate}_to_${filters.endDate}` : "";
      saveAs(blob, `BillAvenue_CC_Payment_Report${dateRangeSuffix}.xlsx`);
      toast.success(`Successfully exported ${allRows.length} records to Excel!`);
    } catch (err) {
      console.error("Export error:", err);
      toast.error(err?.message || "Failed to export report to Excel");
    } finally {
      setIsExporting(false);
    }
  };

  const columns = [
    { header: "#", key: "id" },
    {
      header: "Date",
      key: "createdAt",
      render: (val) => new Date(val).toLocaleString("en-IN"),
    },
    {
      header: "User Details",
      key: "user",
      render: (user) => (
        <div className="flex flex-col">
          <span className="font-semibold text-gray-900 text-xs uppercase">{user?.name || "—"}</span>
          <span className="text-xs text-gray-500">{user?.abheepay_id ? `ID: ${user.abheepay_id}` : user?.id ? `ID: ${user.id}` : "—"}</span>
        </div>
      ),
    },
    {
      header: "Biller",
      key: "biller_id",
      render: (val) => (
        <span className="font-medium text-gray-800 text-xs">{val || "—"}</span>
      ),
    },
    {
      header: "Amount (₹)",
      key: "transaction_amount",
      render: (val) => (
        <span className="font-medium text-red-600">
          ₹{parseFloat(val || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
        </span>
      ),
    },
    {
      header: "Charge (₹)",
      key: "charge_amount",
      render: (val) => `₹${parseFloat(val || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`,
    },
    {
      header: "Txn Ref ID",
      key: "transaction_ref_id",
      render: (val, row) => {
        const respObj = row?.response;
        const reqId =
          respObj?._requestId ||
          respObj?.requestId ||
          respObj?.data?._requestId ||
          respObj?.data?.requestId ||
          respObj?.transactionStatusResp?.payRequestId;

        return (
          <div className="flex flex-col space-y-0.5 max-w-[240px]">
            <span className="font-mono text-xs text-gray-800 break-all">
              {reqId || "—"}
            </span>
            {val && (
              <span className="font-mono text-xs font-semibold text-blue-600 break-all">
                {val}
              </span>
            )}
          </div>
        );
      },
    },
    {
      header: "Status",
      key: "status",
      render: (val, row) => {
        const cls = STATUS_BADGE[String(val).toLowerCase()] || "bg-gray-100 text-gray-700";
        return (
          <button
            type="button"
            onClick={() => {
              setStatusModalData({
                title: `Initial Payment Response (Txn ID: ${row.id})`,
                data: row.response || { message: "No initial response data stored for this transaction" },
              });
            }}
            title="Click to view initial payment response"
            className={`px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize transition hover:opacity-80 hover:scale-105 ${cls}`}
          >
            {val || "—"}
          </button>
        );
      },
    },
    {
      header: "Action",
      key: "action",
      render: (_, row) => {
        const isLoadingThis = statusCheckingId === row.id;

        return (
          <button
            type="button"
            onClick={() => handleCheckStatus(row)}
            disabled={isLoadingThis}
            className="rounded bg-[#4F6BEA] px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-[#3b55ce] disabled:opacity-50"
          >
            {isLoadingThis ? "Checking..." : "Check Status"}
          </button>
        );
      },
    },
  ];

  const totalPages = Math.ceil(totalCount / filters.limit) || 1;

  return (
    <div className="min-h-screen bg-transparent px-0 py-1 sm:bg-gray-50 sm:p-6">
      <h1 className="mb-4 text-2xl font-bold text-gray-800">Reports</h1>
      <ReportTabs
        basePath={reportsBasePath}
        activeTab="ba-cc-bill"
        trailingAction={<CombinedReportDownloadButton />}
      />
      <h2 className="mb-6 text-2xl font-bold text-gray-800">BillAvenue CC Payment Report</h2>

      {/* Filters */}
      <div className="mb-6 rounded-2xl bg-white p-4 shadow-sm md:rounded-xl md:p-6">
        <div className="space-y-3 md:hidden">
          <div className="grid grid-cols-2 gap-2">
            <div className="min-w-0">
              <label className="mb-1 block text-xs font-medium text-gray-700">Status</label>
              <select
                name="status"
                value={filters.status}
                onChange={handleFilterChange}
                className={compactInputClassName}
              >
                <option value="">All</option>
                <option value="success">Success</option>
                <option value="failed">Failed</option>
                <option value="pending">Pending</option>
              </select>
            </div>

            <div className="min-w-0">
              <label className="mb-1 block text-xs font-medium text-gray-700">Biller ID</label>
              <input
                type="text"
                name="billerId"
                value={filters.billerId}
                onChange={handleFilterChange}
                placeholder="e.g. HDFC000CC00ANZ"
                className={compactInputClassName}
              />
            </div>
          </div>

          <div className="grid grid-cols-[minmax(0,1fr)_96px] gap-2">
            <div className="min-w-0">
              <label className="mb-1 block text-xs font-medium text-gray-700">Txn Ref ID</label>
              <input
                type="text"
                name="transactionRefId"
                value={filters.transactionRefId}
                onChange={handleFilterChange}
                placeholder="Partial search"
                className={compactInputClassName}
              />
            </div>

            <div className="min-w-0">
              <label className="mb-1 block text-xs font-medium text-gray-700">Per Page</label>
              <select
                name="limit"
                value={filters.limit}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, limit: Number(e.target.value), page: 1 }))
                }
                className={compactInputClassName}
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
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
              className="flex items-center gap-2 rounded-lg bg-[#00D3CD] px-4 py-2 text-sm text-white transition hover:shadow-lg disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              {isExporting ? "Exporting..." : "Export Excel"}
            </button>
          </div>
        </div>

        <div className="hidden flex-wrap items-end gap-4 md:flex">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
            <input
              type="date"
              name="startDate"
              value={filters.startDate || ""}
              onChange={handleFilterChange}
              className={inputClassName}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
            <input
              type="date"
              name="endDate"
              value={filters.endDate || ""}
              onChange={handleFilterChange}
              className={inputClassName}
            />
          </div>

          {isAdminOrEmployee && (
            <div className="w-64">
              <UserSelectWithSuggestions
                selectedUser={selectedUser}
                onSelectUser={handleUserSelect}
                label="Select User"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Biller ID</label>
            <input
              type="text"
              name="billerId"
              value={filters.billerId}
              onChange={handleFilterChange}
              placeholder="e.g. HDFC000CC00ANZ"
              className={inputClassName}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Txn Ref ID</label>
            <input
              type="text"
              name="transactionRefId"
              value={filters.transactionRefId}
              onChange={handleFilterChange}
              placeholder="Partial search"
              className={inputClassName}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              name="status"
              value={filters.status}
              onChange={handleFilterChange}
              className={inputClassName}
            >
              <option value="">All</option>
              <option value="success">Success</option>
              <option value="failed">Failed</option>
              <option value="pending">Pending</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Per Page</label>
            <select
              name="limit"
              value={filters.limit}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, limit: Number(e.target.value), page: 1 }))
              }
              className={inputClassName}
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
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
              className="flex items-center gap-2 px-4 py-2 bg-[#00D3CD] text-white rounded-lg hover:shadow-lg transition disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              {isExporting ? "Exporting..." : "Export Excel"}
            </button>
          </div>
        </div>
      </div>

      {/* Summary */}
      {!isLoading && !isError && (
        <div className="mb-4 text-sm text-gray-500">
          Showing {records.length} of {totalCount} record{totalCount !== 1 ? "s" : ""}
        </div>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-2xl bg-white shadow-sm md:rounded-xl">
        {isLoading ? (
          <div className="p-12 text-center text-gray-500">Loading transactions...</div>
        ) : isError ? (
          <div className="p-12 text-center text-red-500">Error: {error.message}</div>
        ) : records.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            No BillAvenue CC payment transactions found.
          </div>
        ) : (
          <Table columns={columns} data={records} />
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2">
          <button
            onClick={() => setFilters((prev) => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
            disabled={filters.page <= 1}
            className="px-3 py-1 rounded border text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-40"
          >
            Previous
          </button>
          <span className="text-sm text-gray-600">
            Page {filters.page} of {totalPages}
          </span>
          <button
            onClick={() =>
              setFilters((prev) => ({ ...prev, page: Math.min(totalPages, prev.page + 1) }))
            }
            disabled={filters.page >= totalPages}
            className="px-3 py-1 rounded border text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}

      {/* ── Status Debug Modal ────────────────────────────────────────────── */}
      {statusModalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="relative w-full max-w-3xl max-h-[85vh] flex flex-col rounded-xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <h3 className="text-base font-semibold text-gray-900">
                {statusModalData.title}
              </h3>
              <button
                onClick={() => setStatusModalData(null)}
                className="text-gray-400 hover:text-gray-600 focus:outline-none text-lg font-bold"
              >
                ✕
              </button>
            </div>
            <div className="overflow-y-auto p-6 text-sm text-gray-800 space-y-3">
              {statusModalData.error && (
                <div className="rounded border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                  <span className="font-semibold">Error: </span>
                  {statusModalData.error}
                </div>
              )}
              <pre className="whitespace-pre-wrap rounded bg-gray-50 p-4 border border-gray-200 text-xs text-gray-800 font-mono">
                {JSON.stringify(statusModalData.data || statusModalData, null, 2)}
              </pre>
            </div>
            <div className="border-t bg-gray-50 px-6 py-4 flex justify-end rounded-b-xl">
              <button
                onClick={() => setStatusModalData(null)}
                className="rounded bg-gray-200 px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-300"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BillAvenueCCBillPayReports;
