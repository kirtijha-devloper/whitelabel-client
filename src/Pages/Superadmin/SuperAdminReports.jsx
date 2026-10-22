import React, { useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import Table from "../../components/Table";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { useQuery } from "@tanstack/react-query";
import {
  Download,
  Search,
  RefreshCw,
  Filter,
  TrendingUp,
  DollarSign,
  Activity,
  CheckCircle2,
  Layers,
  SlidersHorizontal,
  FileX2,
  Inbox,
  AlertCircle,
} from "lucide-react";
import { toast } from "react-toastify";
import { normalizeUserRole } from "../../utils/userAccess";
import {
  getAdminList,
  getSuperAdminTransactionReport,
  getSuperAdminCommissionReport,
} from "../../api/superAdminApi";
import ServiceWiseReports from "../Reports/ServiceWiseReports";
import SuperAdminServiceManagement from "./SuperAdminServiceManagement";

export default function SuperAdminReports({ currentUser }) {
  // ── Active Tab State ("transactions" | "commissions" | "service_reports" | "service_management") ──
  const [searchParams, setSearchParams] = useSearchParams();
  const urlTab = searchParams.get("tab");
  const validTabs = ["transactions", "commissions", "service_reports", "service_management"];

  const initialTab =
    urlTab === "service-wise" || urlTab === "services"
      ? "service_reports"
      : urlTab === "service-management"
      ? "service_management"
      : validTabs.includes(urlTab)
      ? urlTab
      : "transactions";

  const [activeTabState, setActiveTabState] = useState(initialTab);
  const activeTab = validTabs.includes(urlTab) ? urlTab : activeTabState;

  const handleTabSwitch = (newTab) => {
    setActiveTabState(newTab);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("tab", newTab);
      return next;
    });
    setPage(1);
  };

  // ── Filter States ──────────────────────────────────────────────────────────
  const [selectedDomain, setSelectedDomain] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [committedSearch, setCommittedSearch] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [isExporting, setIsExporting] = useState(false);

  // ── Access Verification ────────────────────────────────────────────────────
  const normalizedCurrentUserRole = normalizeUserRole(currentUser?.role);
  const isSuperAdminViewer = normalizedCurrentUserRole === "super_admin";

  // ── Fetch Partner Companies & Domains ──────────────────────────────────────
  const { data: adminsResponse } = useQuery({
    queryKey: ["superAdminCompaniesForReports"],
    queryFn: () => getAdminList({ limit: 100 }),
    enabled: isSuperAdminViewer,
  });

  const domainOptions = useMemo(() => {
    const rawUsers = adminsResponse?.data || adminsResponse?.rows || [];
    const companies = [];
    const seen = new Set();

    for (const u of rawUsers) {
      const comp = u.company;
      if (comp && comp.company_id && !seen.has(comp.company_id)) {
        seen.add(comp.company_id);
        companies.push({
          company_id: comp.company_id,
          company_name: comp.company_name || comp.name || comp.company_id,
          domain_name: comp.domain_name || comp.domain || "-",
        });
      }
    }
    return companies;
  }, [adminsResponse]);

  // ── Query Parameters ───────────────────────────────────────────────────────
  const queryParams = useMemo(
    () => ({
      page,
      limit: pageSize,
      domain: selectedDomain || undefined,
      from_date: fromDate || undefined,
      to_date: toDate || undefined,
      status: activeTab === "transactions" && selectedStatus ? selectedStatus : undefined,
      payment_method: activeTab === "commissions" && selectedPaymentMethod ? selectedPaymentMethod : undefined,
      search: committedSearch || undefined,
    }),
    [page, pageSize, selectedDomain, fromDate, toDate, selectedStatus, selectedPaymentMethod, committedSearch, activeTab]
  );

  // ── Transaction Report Query ───────────────────────────────────────────────
  const {
    data: txnReportResponse,
    isLoading: txnLoading,
    isFetching: txnFetching,
    refetch: refetchTxn,
  } = useQuery({
    queryKey: ["superAdminTransactionReport", queryParams],
    queryFn: () => getSuperAdminTransactionReport(queryParams),
    enabled: isSuperAdminViewer && activeTab === "transactions",
  });

  // ── Commission Report Query ────────────────────────────────────────────────
  const {
    data: commReportResponse,
    isLoading: commLoading,
    isFetching: commFetching,
    refetch: refetchComm,
  } = useQuery({
    queryKey: ["superAdminCommissionReport", queryParams],
    queryFn: () => getSuperAdminCommissionReport(queryParams),
    enabled: isSuperAdminViewer && activeTab === "commissions",
  });

  const isLoading = activeTab === "transactions" ? txnLoading : commLoading;
  const isFetching = activeTab === "transactions" ? txnFetching : commFetching;
  const currentResponse = activeTab === "transactions" ? txnReportResponse : commReportResponse;
  const currentData = currentResponse?.data || [];
  const summary = currentResponse?.summary || {};
  const totalPages = currentResponse?.pagination?.totalPages || 1;
  const totalRecords = currentResponse?.pagination?.total || 0;


  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setCommittedSearch(searchInput.trim());
    setPage(1);
  };

  const handleSearchClear = () => {
    setSearchInput("");
    setCommittedSearch("");
    setPage(1);
  };

  const handleResetFilters = () => {
    setSelectedDomain("");
    setFromDate("");
    setToDate("");
    setSelectedStatus("");
    setSelectedPaymentMethod("");
    setSearchInput("");
    setCommittedSearch("");
    setPage(1);
  };

  // ── Excel Export Handler ───────────────────────────────────────────────────
  const handleExport = async () => {
    try {
      setIsExporting(true);
      const exportParams = { ...queryParams, page: 1, limit: 2000 };
      const response =
        activeTab === "transactions"
          ? await getSuperAdminTransactionReport(exportParams)
          : await getSuperAdminCommissionReport(exportParams);

      const rows = response?.data || [];
      if (!rows.length) {
        toast.info("No records to export with the current filters.");
        return;
      }

      let excelRows = [];
      if (activeTab === "transactions") {
        excelRows = rows.map((r, i) => ({
          "SL No": i + 1,
          "Date & Time": r.created_at ? new Date(r.created_at).toLocaleString("en-IN") : "-",
          "Company / Domain": r.company?.domain_name ? `${r.company.domain_name} (${r.company.company_name})` : "-",
          "Transaction ID": r.txn_id || "-",
          "RRN": r.rr_number || "-",
          "Merchant": r.merchant?.name ? `${r.merchant.name} (${r.merchant.abheepay_id || r.merchant.mobile_number})` : "-",
          "POS TID": r.pos_machine?.tid_number || "-",
          "POS MID": r.pos_machine?.mid_number || "-",
          "Payment Method": r.payment_method || "-",
          "Card Type": r.card_type || "-",
          "Amount (₹)": r.amount,
          "Status": r.status || "-",
        }));
      } else {
        excelRows = rows.map((r, i) => ({
          "SL No": i + 1,
          "Date & Time": r.createdAt ? new Date(r.createdAt).toLocaleString("en-IN") : "-",
          "Company / Domain": r.company?.domain_name ? `${r.company.domain_name} (${r.company.company_name})` : "-",
          "Txn ID": r.razorpay_transaction_id || "-",
          "RRN": r.rr_number || "-",
          "Merchant": r.merchant?.name ? `${r.merchant.name} (${r.merchant.abheepay_id || r.merchant.mobile_number})` : "-",
          "Txn Amount (₹)": r.transaction_amount,
          "Comm Rate (%)": r.charge_rate,
          "Commission / Fee (₹)": r.charge_amount,
          "GST Amount (₹)": r.gst_amount,
          "Net Payout (₹)": r.net_amount,
          "Payment Method": r.payment_method || "-",
        }));
      }

      const worksheet = XLSX.utils.json_to_sheet(excelRows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(
        workbook,
        worksheet,
        activeTab === "transactions" ? "Transactions" : "Commissions"
      );
      const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
      const blob = new Blob([excelBuffer], { type: "application/octet-stream" });
      saveAs(
        blob,
        activeTab === "transactions" ? "SuperAdmin_TransactionReport.xlsx" : "SuperAdmin_CommissionReport.xlsx"
      );
      toast.success("Report exported successfully!");
    } catch (err) {
      toast.error(err.message || "Failed to export report");
    } finally {
      setIsExporting(false);
    }
  };

  // ── Table Column Configurations ────────────────────────────────────────────
  const baseIndex = (page - 1) * pageSize;

  const transactionColumns = [
    {
      header: "#",
      key: "sl",
      Header: "#",
      accessor: "sl",
      render: (_, row, index) => <span className="text-gray-500 font-medium text-xs">{baseIndex + index + 1}</span>,
      Cell: ({ row }) => <span className="text-gray-500 font-medium text-xs">{baseIndex + row.index + 1}</span>,
    },
    {
      header: "Date & Time",
      key: "created_at",
      Header: "Date & Time",
      accessor: "created_at",
      render: (value) => (
        <span className="text-xs text-gray-700 whitespace-nowrap">
          {value ? new Date(value).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" }) : "-"}
        </span>
      ),
      Cell: ({ value }) => (
        <span className="text-xs text-gray-700 whitespace-nowrap">
          {value ? new Date(value).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" }) : "-"}
        </span>
      ),
    },
    {
      header: "Domain / Company",
      key: "company",
      Header: "Domain / Company",
      accessor: "company",
      render: (value) => (
        <div className="flex flex-col min-w-[140px]">
          <span className="font-semibold text-gray-900 text-xs truncate" title={value?.domain_name}>
            {value?.domain_name || "-"}
          </span>
          <span className="text-[11px] text-gray-500 truncate" title={value?.company_name}>
            {value?.company_name || "-"}
          </span>
        </div>
      ),
      Cell: ({ value }) => (
        <div className="flex flex-col min-w-[140px]">
          <span className="font-semibold text-gray-900 text-xs truncate" title={value?.domain_name}>
            {value?.domain_name || "-"}
          </span>
          <span className="text-[11px] text-gray-500 truncate" title={value?.company_name}>
            {value?.company_name || "-"}
          </span>
        </div>
      ),
    },
    {
      header: "Txn ID / RRN",
      key: "txn_id",
      Header: "Txn ID / RRN",
      accessor: "txn_id",
      render: (_, row) => (
        <div className="flex flex-col">
          <span className="font-mono text-xs font-semibold text-gray-900 truncate" title={row?.txn_id}>
            {row?.txn_id || "-"}
          </span>
          <span className="text-[11px] font-mono text-gray-500 truncate">
            {row?.rr_number ? `RRN: ${row.rr_number}` : "-"}
          </span>
        </div>
      ),
      Cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="font-mono text-xs font-semibold text-gray-900 truncate" title={row.original.txn_id}>
            {row.original.txn_id || "-"}
          </span>
          <span className="text-[11px] font-mono text-gray-500 truncate">
            {row.original.rr_number ? `RRN: ${row.original.rr_number}` : "-"}
          </span>
        </div>
      ),
    },
    {
      header: "Merchant",
      key: "merchant",
      Header: "Merchant",
      accessor: "merchant",
      render: (value) => (
        <div className="flex flex-col min-w-[130px]">
          <span className="font-medium text-xs text-gray-900 truncate">{value?.name || "-"}</span>
          <span className="text-[11px] text-gray-500 truncate">{value?.abheepay_id || value?.mobile_number || "-"}</span>
        </div>
      ),
      Cell: ({ value }) => (
        <div className="flex flex-col min-w-[130px]">
          <span className="font-medium text-xs text-gray-900 truncate">{value?.name || "-"}</span>
          <span className="text-[11px] text-gray-500 truncate">{value?.abheepay_id || value?.mobile_number || "-"}</span>
        </div>
      ),
    },
    {
      header: "POS Machine",
      key: "pos_machine",
      Header: "POS Machine",
      accessor: "pos_machine",
      render: (value) => (
        <div className="flex flex-col text-xs">
          <span className="text-gray-800 font-medium">{value?.tid_number ? `TID: ${value.tid_number}` : "-"}</span>
          <span className="text-[11px] text-gray-500">{value?.mid_number ? `MID: ${value.mid_number}` : "-"}</span>
        </div>
      ),
      Cell: ({ value }) => (
        <div className="flex flex-col text-xs">
          <span className="text-gray-800 font-medium">{value?.tid_number ? `TID: ${value.tid_number}` : "-"}</span>
          <span className="text-[11px] text-gray-500">{value?.mid_number ? `MID: ${value.mid_number}` : "-"}</span>
        </div>
      ),
    },
    {
      header: "Payment Mode",
      key: "payment_method",
      Header: "Payment Mode",
      accessor: "payment_method",
      render: (_, row) => {
        const method = row?.payment_method || "-";
        const cardType = row?.card_type;
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-gray-100 text-gray-800 capitalize">
            {cardType ? `${method} (${cardType})` : method}
          </span>
        );
      },
      Cell: ({ row }) => {
        const method = row.original.payment_method || "-";
        const cardType = row.original.card_type;
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-gray-100 text-gray-800 capitalize">
            {cardType ? `${method} (${cardType})` : method}
          </span>
        );
      },
    },
    {
      header: "Amount (₹)",
      key: "amount",
      Header: "Amount (₹)",
      accessor: "amount",
      render: (value) => (
        <span className="font-bold text-gray-900 text-xs">
          ₹{Number(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      ),
      Cell: ({ value }) => (
        <span className="font-bold text-gray-900 text-xs">
          ₹{Number(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      ),
    },
    {
      header: "Status",
      key: "status",
      Header: "Status",
      accessor: "status",
      render: (value) => {
        const st = String(value || "").toLowerCase();
        let badgeStyle = "bg-gray-100 text-gray-700 border-gray-200";
        if (st === "completed" || st === "success" || st === "captured" || st === "authorized") {
          badgeStyle = "bg-green-50 text-green-700 border-green-200";
        } else if (st === "pending" || st === "created") {
          badgeStyle = "bg-yellow-50 text-yellow-700 border-yellow-200";
        } else if (st === "failed") {
          badgeStyle = "bg-red-50 text-red-700 border-red-200";
        }

        return (
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${badgeStyle} capitalize`}>
            {value || "Unknown"}
          </span>
        );
      },
      Cell: ({ value }) => {
        const st = String(value || "").toLowerCase();
        let badgeStyle = "bg-gray-100 text-gray-700 border-gray-200";
        if (st === "completed" || st === "success" || st === "captured" || st === "authorized") {
          badgeStyle = "bg-green-50 text-green-700 border-green-200";
        } else if (st === "pending" || st === "created") {
          badgeStyle = "bg-yellow-50 text-yellow-700 border-yellow-200";
        } else if (st === "failed") {
          badgeStyle = "bg-red-50 text-red-700 border-red-200";
        }

        return (
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${badgeStyle} capitalize`}>
            {value || "Unknown"}
          </span>
        );
      },
    },
  ];

  const commissionColumns = [
    {
      header: "#",
      key: "sl",
      Header: "#",
      accessor: "sl",
      render: (_, row, index) => <span className="text-gray-500 font-medium text-xs">{baseIndex + index + 1}</span>,
      Cell: ({ row }) => <span className="text-gray-500 font-medium text-xs">{baseIndex + row.index + 1}</span>,
    },
    {
      header: "Date & Time",
      key: "createdAt",
      Header: "Date & Time",
      accessor: "createdAt",
      render: (value) => (
        <span className="text-xs text-gray-700 whitespace-nowrap">
          {value ? new Date(value).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" }) : "-"}
        </span>
      ),
      Cell: ({ value }) => (
        <span className="text-xs text-gray-700 whitespace-nowrap">
          {value ? new Date(value).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" }) : "-"}
        </span>
      ),
    },
    {
      header: "Domain / Company",
      key: "company",
      Header: "Domain / Company",
      accessor: "company",
      render: (value) => (
        <div className="flex flex-col min-w-[140px]">
          <span className="font-semibold text-gray-900 text-xs truncate" title={value?.domain_name}>
            {value?.domain_name || "-"}
          </span>
          <span className="text-[11px] text-gray-500 truncate" title={value?.company_name}>
            {value?.company_name || "-"}
          </span>
        </div>
      ),
      Cell: ({ value }) => (
        <div className="flex flex-col min-w-[140px]">
          <span className="font-semibold text-gray-900 text-xs truncate" title={value?.domain_name}>
            {value?.domain_name || "-"}
          </span>
          <span className="text-[11px] text-gray-500 truncate" title={value?.company_name}>
            {value?.company_name || "-"}
          </span>
        </div>
      ),
    },
    {
      header: "Txn ID",
      key: "razorpay_transaction_id",
      Header: "Txn ID",
      accessor: "razorpay_transaction_id",
      render: (_, row) => (
        <div className="flex flex-col">
          <span className="font-mono text-xs font-semibold text-gray-900 truncate" title={row?.razorpay_transaction_id}>
            {row?.razorpay_transaction_id || "-"}
          </span>
          <span className="text-[11px] font-mono text-gray-500 truncate">
            {row?.rr_number ? `RRN: ${row.rr_number}` : "-"}
          </span>
        </div>
      ),
      Cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="font-mono text-xs font-semibold text-gray-900 truncate" title={row.original.razorpay_transaction_id}>
            {row.original.razorpay_transaction_id || "-"}
          </span>
          <span className="text-[11px] font-mono text-gray-500 truncate">
            {row.original.rr_number ? `RRN: ${row.original.rr_number}` : "-"}
          </span>
        </div>
      ),
    },
    {
      header: "Merchant",
      key: "merchant",
      Header: "Merchant",
      accessor: "merchant",
      render: (value) => (
        <div className="flex flex-col min-w-[130px]">
          <span className="font-medium text-xs text-gray-900 truncate">{value?.name || "-"}</span>
          <span className="text-[11px] text-gray-500 truncate">{value?.abheepay_id || value?.mobile_number || "-"}</span>
        </div>
      ),
      Cell: ({ value }) => (
        <div className="flex flex-col min-w-[130px]">
          <span className="font-medium text-xs text-gray-900 truncate">{value?.name || "-"}</span>
          <span className="text-[11px] text-gray-500 truncate">{value?.abheepay_id || value?.mobile_number || "-"}</span>
        </div>
      ),
    },
    {
      header: "Txn Amount (₹)",
      key: "transaction_amount",
      Header: "Txn Amount (₹)",
      accessor: "transaction_amount",
      render: (value) => (
        <span className="font-semibold text-gray-800 text-xs">
          ₹{Number(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      ),
      Cell: ({ value }) => (
        <span className="font-semibold text-gray-800 text-xs">
          ₹{Number(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      ),
    },
    {
      header: "Comm Rate",
      key: "charge_rate",
      Header: "Comm Rate",
      accessor: "charge_rate",
      render: (value) => (
        <span className="text-xs font-medium text-gray-700">
          {value ? `${Number(value).toFixed(2)}%` : "-"}
        </span>
      ),
      Cell: ({ value }) => (
        <span className="text-xs font-medium text-gray-700">
          {value ? `${Number(value).toFixed(2)}%` : "-"}
        </span>
      ),
    },
    {
      header: "Commission (₹)",
      key: "charge_amount",
      Header: "Commission (₹)",
      accessor: "charge_amount",
      render: (value) => (
        <span className="font-bold text-[#00D3CD] text-xs">
          ₹{Number(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      ),
      Cell: ({ value }) => (
        <span className="font-bold text-[#00D3CD] text-xs">
          ₹{Number(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      ),
    },
    {
      header: "GST (₹)",
      key: "gst_amount",
      Header: "GST (₹)",
      accessor: "gst_amount",
      render: (_, row) => (
        <span className="text-xs text-gray-600">
          ₹{Number(row?.gst_amount || 0).toFixed(2)} ({row?.gst_percent || 18}%)
        </span>
      ),
      Cell: ({ row }) => (
        <span className="text-xs text-gray-600">
          ₹{Number(row.original.gst_amount || 0).toFixed(2)} ({row.original.gst_percent || 18}%)
        </span>
      ),
    },
    {
      header: "Net Payout (₹)",
      key: "net_amount",
      Header: "Net Payout (₹)",
      accessor: "net_amount",
      render: (value) => (
        <span className="font-bold text-emerald-700 text-xs">
          ₹{Number(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      ),
      Cell: ({ value }) => (
        <span className="font-bold text-emerald-700 text-xs">
          ₹{Number(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      ),
    },
  ];

  return (
    <div className="w-full min-h-full bg-gray-50/60 p-4 sm:p-6 lg:p-8 space-y-6">
      {/* ── Page Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900">
            {activeTab === "service_reports"
              ? "Service Wise Reports"
              : activeTab === "service_management"
              ? "Service Management"
              : "Reports"}
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-gray-500">
            {activeTab === "service_reports"
              ? "Volume, success rates, charge collections, and partner commissions categorized by individual service."
              : activeTab === "service_management"
              ? "Enable or disable platform services globally across Admin, Super Franchise, Franchise, and Merchant roles."
              : "Platform-wide transaction analytics, partner domain tracking, and commission audits."}
          </p>
        </div>

        {(activeTab === "transactions" || activeTab === "commissions") && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => (activeTab === "transactions" ? refetchTxn() : refetchComm())}
              disabled={isFetching}
              className="inline-flex flex-1 sm:flex-initial items-center justify-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs sm:text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50"
              title="Refresh current report"
            >
              <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin text-[#00D3CD]" : ""}`} />
              <span>Refresh</span>
            </button>

            <button
              type="button"
              onClick={handleExport}
              disabled={isExporting || isLoading}
              className="inline-flex flex-1 sm:flex-initial items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs sm:text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              <span>{isExporting ? "Exporting..." : "Download Excel"}</span>
            </button>
          </div>
        )}
      </div>

      {/* ── Top Clickable Tab Bar ────────────────────────────────────────────── */}
      <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto p-1.5 bg-gray-200/60 rounded-2xl w-fit max-w-full no-scrollbar border border-gray-200/70">
        <button
          type="button"
          onClick={() => handleTabSwitch("transactions")}
          className={`flex shrink-0 items-center gap-2 rounded-xl px-4 py-2 sm:px-5 sm:py-2.5 text-xs sm:text-sm font-bold transition-all ${
            activeTab === "transactions"
              ? "bg-[#00D3CD] text-white shadow-md shadow-[#00D3CD]/25"
              : "text-gray-600 hover:text-gray-900 hover:bg-white/60"
          }`}
        >
          <Activity className="h-4 w-4" />
          <span>Transaction Report</span>
        </button>

        <button
          type="button"
          onClick={() => handleTabSwitch("commissions")}
          className={`flex shrink-0 items-center gap-2 rounded-xl px-4 py-2 sm:px-5 sm:py-2.5 text-xs sm:text-sm font-bold transition-all ${
            activeTab === "commissions"
              ? "bg-[#00D3CD] text-white shadow-md shadow-[#00D3CD]/25"
              : "text-gray-600 hover:text-gray-900 hover:bg-white/60"
          }`}
        >
          <DollarSign className="h-4 w-4" />
          <span>Commission Report</span>
        </button>

        {/* <button
          type="button"
          onClick={() => handleTabSwitch("service_reports")}
          className={`flex shrink-0 items-center gap-2 rounded-xl px-4 py-2 sm:px-5 sm:py-2.5 text-xs sm:text-sm font-bold transition-all ${
            activeTab === "service_reports"
              ? "bg-[#00D3CD] text-white shadow-md shadow-[#00D3CD]/25"
              : "text-gray-600 hover:text-gray-900 hover:bg-white/60"
          }`}
        >
          <Layers className="h-4 w-4" />
          <span>Service Wise Reports</span>
        </button> */}
      </div>

      {activeTab === "service_reports" && (
        <ServiceWiseReports embedded currentUser={currentUser} />
      )}

      {activeTab === "service_management" && (
        <SuperAdminServiceManagement embedded />
      )}

      {(activeTab === "transactions" || activeTab === "commissions") && (
        <>
          {/* ── Summary KPI Cards ────────────────────────────────────────────────── */}
          <div className="w-full mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {activeTab === "transactions" ? (
              <>
                {/* Total Volume */}
                <div className="relative overflow-hidden rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition-all hover:shadow-md">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Total Volume</span>
                    <span className="rounded-xl bg-[#00D3CD]/10 p-2.5 text-[#00D3CD]">
                      <TrendingUp className="h-5 w-5" />
                    </span>
                  </div>
                  <div className="mt-3">
                    <p className="text-2xl font-extrabold text-gray-900 tracking-tight">
                      ₹{Number(summary.total_volume || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-gray-400">
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#00D3CD]" />
                      Total transaction throughput
                    </p>
                  </div>
                </div>

                {/* Total Transactions */}
                <div className="relative overflow-hidden rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition-all hover:shadow-md">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Transactions</span>
                    <span className="rounded-xl bg-blue-50 p-2.5 text-blue-600">
                      <Activity className="h-5 w-5" />
                    </span>
                  </div>
                  <div className="mt-3">
                    <p className="text-2xl font-extrabold text-gray-900 tracking-tight">
                      {Number(summary.total_count || 0).toLocaleString("en-IN")}
                    </p>
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-gray-400">
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-blue-500" />
                      Total records matching filters
                    </p>
                  </div>
                </div>

                {/* Successful Txns */}
                <div className="relative overflow-hidden rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition-all hover:shadow-md">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Success Rate</span>
                    <span className="rounded-xl bg-emerald-50 p-2.5 text-emerald-600">
                      <CheckCircle2 className="h-5 w-5" />
                    </span>
                  </div>
                  <div className="mt-3">
                    <div className="flex items-baseline gap-2">
                      <p className="text-2xl font-extrabold text-emerald-600 tracking-tight">
                        {summary.success_rate || 0}%
                      </p>
                      <span className="text-xs font-medium text-emerald-700/80">
                        ({Number(summary.success_count || 0).toLocaleString("en-IN")} txns)
                      </span>
                    </div>
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-emerald-600/70">
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      Successfully captured transactions
                    </p>
                  </div>
                </div>

                {/* Failed Txns */}
                <div className="relative overflow-hidden rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition-all hover:shadow-md">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Failed Txns</span>
                    <span className="rounded-xl bg-red-50 p-2.5 text-red-600">
                      <Activity className="h-5 w-5" />
                    </span>
                  </div>
                  <div className="mt-3">
                    <p className="text-2xl font-extrabold text-red-600 tracking-tight">
                      {Number(summary.failed_count || 0).toLocaleString("en-IN")}
                    </p>
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-red-500/80">
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-red-500" />
                      Declined or aborted attempts
                    </p>
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* Gross Volume */}
                <div className="relative overflow-hidden rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition-all hover:shadow-md">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Gross Txn Volume</span>
                    <span className="rounded-xl bg-blue-50 p-2.5 text-blue-600">
                      <TrendingUp className="h-5 w-5" />
                    </span>
                  </div>
                  <div className="mt-3">
                    <p className="text-2xl font-extrabold text-gray-900 tracking-tight">
                      ₹{Number(summary.total_transaction_volume || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-gray-400">
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-blue-500" />
                      Base transactions processed
                    </p>
                  </div>
                </div>

                {/* Total Commissions */}
                <div className="relative overflow-hidden rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition-all hover:shadow-md">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Total Commissions</span>
                    <span className="rounded-xl bg-[#00D3CD]/10 p-2.5 text-[#00D3CD]">
                      <DollarSign className="h-5 w-5" />
                    </span>
                  </div>
                  <div className="mt-3">
                    <p className="text-2xl font-extrabold text-[#00D3CD] tracking-tight">
                      ₹{Number(summary.total_commission_revenue || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-gray-400">
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#00D3CD]" />
                      Net platform revenue earned
                    </p>
                  </div>
                </div>

                {/* Total GST */}
                <div className="relative overflow-hidden rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition-all hover:shadow-md">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Total GST (18%)</span>
                    <span className="rounded-xl bg-purple-50 p-2.5 text-purple-600">
                      <Activity className="h-5 w-5" />
                    </span>
                  </div>
                  <div className="mt-3">
                    <p className="text-2xl font-extrabold text-purple-700 tracking-tight">
                      ₹{Number(summary.total_gst_collected || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-purple-600/70">
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-purple-500" />
                      GST collected on fee charges
                    </p>
                  </div>
                </div>

                {/* Net Merchant Payout */}
                <div className="relative overflow-hidden rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition-all hover:shadow-md">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Net Merchant Payout</span>
                    <span className="rounded-xl bg-emerald-50 p-2.5 text-emerald-600">
                      <CheckCircle2 className="h-5 w-5" />
                    </span>
                  </div>
                  <div className="mt-3">
                    <p className="text-2xl font-extrabold text-emerald-700 tracking-tight">
                      ₹{Number(summary.total_net_payout || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-emerald-600/70">
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      Disbursed net settlement
                    </p>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* ── Filters Card ─────────────────────────────────────────────────────── */}
          <div className="w-full rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="rounded-lg bg-[#00D3CD]/10 p-1.5 text-[#00D3CD]">
                  <Filter className="h-4 w-4" />
                </span>
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-gray-900">Filter Reports</h3>
                  <p className="text-[11px] text-gray-500">Filter by domain, date range, status, or search term</p>
                </div>
              </div>

              {(selectedDomain || fromDate || toDate || selectedStatus || selectedPaymentMethod || committedSearch) && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-red-50 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-100 transition-colors"
                >
                  <span>Reset All Filters</span>
                  <span className="text-[10px] text-red-400">✕</span>
                </button>
              )}
            </div>

            <div className="w-full grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-12">
              {/* Domain / Partner Filter */}
              <div className="lg:col-span-3">
                <label className="block text-xs font-semibold text-gray-700 mb-1">Partner Domain / Company</label>
                <select
                  value={selectedDomain}
                  onChange={(e) => {
                    setSelectedDomain(e.target.value);
                    setPage(1);
                  }}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50/50 px-3 py-2 text-xs text-gray-800 shadow-sm transition-all focus:border-[#00D3CD] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#00D3CD]/20"
                >
                  <option value="">All Domains & Companies</option>
                  {domainOptions.map((opt) => (
                    <option key={opt.company_id} value={opt.domain_name !== "-" ? opt.domain_name : opt.company_id}>
                      {opt.domain_name !== "-" ? `${opt.domain_name} (${opt.company_name})` : opt.company_name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Date Range: From */}
              <div className="lg:col-span-2">
                <label className="block text-xs font-semibold text-gray-700 mb-1">From Date</label>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => {
                    setFromDate(e.target.value);
                    setPage(1);
                  }}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50/50 px-3 py-2 text-xs text-gray-800 shadow-sm transition-all focus:border-[#00D3CD] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#00D3CD]/20"
                />
              </div>

              {/* Date Range: To */}
              <div className="lg:col-span-2">
                <label className="block text-xs font-semibold text-gray-700 mb-1">To Date</label>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => {
                    setToDate(e.target.value);
                    setPage(1);
                  }}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50/50 px-3 py-2 text-xs text-gray-800 shadow-sm transition-all focus:border-[#00D3CD] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#00D3CD]/20"
                />
              </div>

              {/* Status or Payment Method */}
              <div className="lg:col-span-2">
                {activeTab === "transactions" ? (
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Status</label>
                    <select
                      value={selectedStatus}
                      onChange={(e) => {
                        setSelectedStatus(e.target.value);
                        setPage(1);
                      }}
                      className="w-full rounded-xl border border-gray-200 bg-gray-50/50 px-3 py-2 text-xs text-gray-800 shadow-sm transition-all focus:border-[#00D3CD] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#00D3CD]/20"
                    >
                      <option value="">All Statuses</option>
                      <option value="completed">Completed / Authorized</option>
                      <option value="pending">Pending</option>
                      <option value="failed">Failed</option>
                    </select>
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Payment Mode</label>
                    <select
                      value={selectedPaymentMethod}
                      onChange={(e) => {
                        setSelectedPaymentMethod(e.target.value);
                        setPage(1);
                      }}
                      className="w-full rounded-xl border border-gray-200 bg-gray-50/50 px-3 py-2 text-xs text-gray-800 shadow-sm transition-all focus:border-[#00D3CD] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#00D3CD]/20"
                    >
                      <option value="">All Modes</option>
                      <option value="card">Card</option>
                      <option value="upi">UPI</option>
                      <option value="netbanking">Net Banking</option>
                    </select>
                  </div>
                )}
              </div>

              {/* Search Box - Takes remaining 3 columns */}
              <div className="lg:col-span-3">
                <label className="block text-xs font-semibold text-gray-700 mb-1">Keyword Search</label>
                <form onSubmit={handleSearchSubmit} className="flex gap-1.5 w-full">
                  <input
                    type="text"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    placeholder="Txn ID, RRN, Merchant..."
                    className="flex-1 min-w-0 rounded-xl border border-gray-200 bg-gray-50/50 px-3 py-2 text-xs text-gray-800 shadow-sm transition-all placeholder:text-gray-400 focus:border-[#00D3CD] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#00D3CD]/20"
                  />
                  <button
                    type="submit"
                    className="flex shrink-0 items-center justify-center rounded-xl bg-[#00D3CD] px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[#00bdb7] transition-all"
                    title="Search"
                  >
                    <Search className="h-4 w-4" />
                  </button>
                  {committedSearch && (
                    <button
                      type="button"
                      onClick={handleSearchClear}
                      className="flex shrink-0 items-center justify-center rounded-xl border border-gray-200 bg-gray-100 px-2.5 text-xs text-gray-600 hover:bg-gray-200 transition-all"
                      title="Clear search"
                    >
                      ✕
                    </button>
                  )}
                </form>
              </div>
            </div>
          </div>

      {/* ── Data Table & Pagination Card ────────────────────────────────────── */}
      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
        {/* Desktop / Tablet Table View */}
        <div className="hidden md:block overflow-x-auto">
          {isLoading ? (
            <div className="flex h-72 flex-col items-center justify-center gap-3">
              <div className="h-9 w-9 animate-spin rounded-full border-4 border-gray-200 border-t-[#00D3CD]" />
              <div className="text-center">
                <p className="text-sm font-semibold text-gray-800">
                  Loading {activeTab === "transactions" ? "Transactions" : "Commissions"}
                </p>
                <p className="text-xs text-gray-400">Fetching records from server...</p>
              </div>
            </div>
          ) : currentData.length === 0 ? (
            <div className="min-w-full">
              {/* Clean Table Skeleton with Header intact */}
              <table className="min-w-full divide-y divide-gray-100">
                <thead className="bg-gray-50/80 border-b border-gray-100">
                  <tr>
                    {(activeTab === "transactions" ? transactionColumns : commissionColumns).map((col, idx) => (
                      <th
                        key={idx}
                        className="px-4 py-3.5 text-left text-[11px] font-bold text-gray-600 uppercase tracking-wider whitespace-nowrap"
                      >
                        {col.header || col.Header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td
                      colSpan={(activeTab === "transactions" ? transactionColumns : commissionColumns).length}
                      className="py-16 text-center"
                    >
                      <div className="mx-auto flex max-w-sm flex-col items-center justify-center">
                        <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#00D3CD]/10 text-[#00D3CD]">
                          <Inbox className="h-7 w-7" />
                        </div>
                        <h4 className="text-sm font-bold text-gray-900">
                          No {activeTab === "transactions" ? "Transactions" : "Commissions"} Found
                        </h4>
                        <p className="mt-1 text-xs text-gray-500 leading-relaxed">
                          {(selectedDomain || fromDate || toDate || selectedStatus || selectedPaymentMethod || committedSearch)
                            ? "No records matched your selected filters or search keyword. Try clearing or expanding your date range."
                            : `There are currently no recorded ${activeTab === "transactions" ? "transactions" : "commissions"} in the system.`}
                        </p>
                        {(selectedDomain || fromDate || toDate || selectedStatus || selectedPaymentMethod || committedSearch) && (
                          <button
                            type="button"
                            onClick={handleResetFilters}
                            className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-[#00D3CD] px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-[#00bdb7] transition-all"
                          >
                            <RefreshCw className="h-3 w-3" />
                            <span>Reset Filters</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          ) : (
            <Table
              columns={activeTab === "transactions" ? transactionColumns : commissionColumns}
              data={currentData}
              containerClassName="min-w-full overflow-x-auto"
              headerClassName="bg-gray-50/80 border-b border-gray-100"
              headerCellClassName="px-4 py-3.5 text-left text-[11px] font-bold text-gray-600 uppercase tracking-wider whitespace-nowrap"
              bodyCellClassName="px-4 py-3.5 whitespace-nowrap text-xs text-gray-800 border-b border-gray-50"
            />
          )}
        </div>

        {/* Mobile View (< md) */}
        <div className="block md:hidden">
          {isLoading ? (
            <div className="flex h-64 flex-col items-center justify-center gap-2 p-6">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-[#00D3CD]" />
              <p className="text-xs text-gray-500">Loading {activeTab} data...</p>
            </div>
          ) : currentData.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#00D3CD]/10 text-[#00D3CD]">
                <Inbox className="h-6 w-6" />
              </div>
              <h4 className="text-sm font-bold text-gray-900">
                No {activeTab === "transactions" ? "Transactions" : "Commissions"}
              </h4>
              <p className="mt-1 text-xs text-gray-500 max-w-xs">
                {(selectedDomain || fromDate || toDate || selectedStatus || selectedPaymentMethod || committedSearch)
                  ? "No results match your active filters."
                  : "No data available."}
              </p>
              {(selectedDomain || fromDate || toDate || selectedStatus || selectedPaymentMethod || committedSearch) && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-[#00D3CD] px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-[#00bdb7]"
                >
                  <RefreshCw className="h-3 w-3" />
                  <span>Reset Filters</span>
                </button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {currentData.map((row, idx) => {
                const rowKey = row.id || row.order_id || row.txn_id || row.razorpay_transaction_id || idx;
                const status = (row.status || "").toLowerCase();
                const statusBadge =
                  status === "completed" || status === "success" || status === "captured"
                    ? "bg-green-50 text-green-700 ring-1 ring-green-600/20"
                    : status === "pending" || status === "created"
                    ? "bg-yellow-50 text-yellow-700 ring-1 ring-yellow-600/20"
                    : status === "failed"
                    ? "bg-red-50 text-red-700 ring-1 ring-red-600/20"
                    : "bg-gray-100 text-gray-700 ring-1 ring-gray-400/20";

                return (
                  <div key={rowKey} className="p-4 space-y-3 bg-white hover:bg-gray-50/60 transition-colors">
                    {/* Card Header: Identifier / Service & Status */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-gray-900 truncate">
                            {activeTab === "transactions"
                              ? (row.txn_id || row.order_id || "N/A")
                              : (row.razorpay_transaction_id || "Commission")}
                          </span>
                        </div>
                        <p className="text-[11px] text-gray-500 truncate mt-0.5 font-medium">
                          {row.merchant?.name || row.merchant_name || row.company?.company_name || row.company?.domain_name || "Merchant"}
                        </p>
                      </div>
                      <span className={`inline-flex items-center shrink-0 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${statusBadge}`}>
                        {status || "N/A"}
                      </span>
                    </div>

                    {/* Card Body: Details Grid */}
                    <div className="grid grid-cols-2 gap-2.5 text-xs bg-gray-50/70 p-3 rounded-xl border border-gray-100">
                      {activeTab === "transactions" ? (
                        <>
                          <div>
                            <span className="text-[10px] uppercase font-bold text-gray-400 block tracking-wider">Amount</span>
                            <span className="font-bold text-gray-900 text-sm">
                              ₹{Number(row.amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] uppercase font-bold text-gray-400 block tracking-wider">Domain</span>
                            <span className="font-semibold text-gray-700 truncate block">
                              {row.company?.domain_name || "-"}
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] uppercase font-bold text-gray-400 block tracking-wider">Payment Mode</span>
                            <span className="font-semibold text-gray-700 uppercase">
                              {row.payment_method || "N/A"} {row.card_type ? `(${row.card_type})` : ""}
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] uppercase font-bold text-gray-400 block tracking-wider">POS TID</span>
                            <span className="font-mono text-gray-700 font-medium">
                              {row.pos_machine?.tid_number || "-"}
                            </span>
                          </div>
                        </>
                      ) : (
                        <>
                          <div>
                            <span className="text-[10px] uppercase font-bold text-gray-400 block tracking-wider">Commission</span>
                            <span className="font-bold text-[#00D3CD] text-sm">
                              ₹{Number(row.charge_amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] uppercase font-bold text-gray-400 block tracking-wider">Txn Volume</span>
                            <span className="font-bold text-gray-800">
                              ₹{Number(row.transaction_amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] uppercase font-bold text-gray-400 block tracking-wider">GST ({row.gst_percent || 18}%)</span>
                            <span className="font-semibold text-purple-600">
                              ₹{Number(row.gst_amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] uppercase font-bold text-gray-400 block tracking-wider">Net Payout</span>
                            <span className="font-bold text-emerald-600">
                              ₹{Number(row.net_amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        </>
                      )}
                    </div>

                    {/* Card Footer: Metadata / Timestamps */}
                    <div className="flex items-center justify-between text-[11px] text-gray-500 pt-1">
                      <span className="truncate max-w-[200px]">
                        RRN: <span className="font-mono text-gray-700 font-medium">{row.rr_number || "—"}</span>
                      </span>
                      <span className="shrink-0 text-gray-400 font-medium">
                        {(row.created_at || row.createdAt)
                          ? new Date(row.created_at || row.createdAt).toLocaleString("en-IN", {
                              day: "2-digit",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "—"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Table Footer & Pagination ────────────────────────────────────────── */}
        {!isLoading && currentData.length > 0 && (
          <div className="flex flex-col items-center justify-between gap-3 border-t border-gray-100 bg-gray-50/50 px-5 py-3.5 sm:flex-row">
            <span className="text-xs text-gray-500 font-medium">
              Showing page <span className="font-bold text-gray-800">{page}</span> of{" "}
              <span className="font-bold text-gray-800">{totalPages}</span> ({Number(totalRecords).toLocaleString("en-IN")} total records)
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="inline-flex items-center gap-1 rounded-xl border border-gray-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-gray-700 shadow-sm transition-all hover:bg-gray-50 hover:border-gray-300 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="inline-flex items-center gap-1 rounded-xl border border-gray-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-gray-700 shadow-sm transition-all hover:bg-gray-50 hover:border-gray-300 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
        </>
      )}
    </div>
  );
}

