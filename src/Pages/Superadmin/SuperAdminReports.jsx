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
      Header: "#",
      accessor: "sl",
      Cell: ({ row }) => <span className="text-gray-500 font-medium text-xs">{baseIndex + row.index + 1}</span>,
    },
    {
      Header: "Date & Time",
      accessor: "created_at",
      Cell: ({ value }) => (
        <span className="text-xs text-gray-700 whitespace-nowrap">
          {value ? new Date(value).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" }) : "-"}
        </span>
      ),
    },
    {
      Header: "Domain / Company",
      accessor: "company",
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
      Header: "Txn ID / RRN",
      accessor: "txn_id",
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
      Header: "Merchant",
      accessor: "merchant",
      Cell: ({ value }) => (
        <div className="flex flex-col min-w-[130px]">
          <span className="font-medium text-xs text-gray-900 truncate">{value?.name || "-"}</span>
          <span className="text-[11px] text-gray-500 truncate">{value?.abheepay_id || value?.mobile_number || "-"}</span>
        </div>
      ),
    },
    {
      Header: "POS Machine",
      accessor: "pos_machine",
      Cell: ({ value }) => (
        <div className="flex flex-col text-xs">
          <span className="text-gray-800 font-medium">{value?.tid_number ? `TID: ${value.tid_number}` : "-"}</span>
          <span className="text-[11px] text-gray-500">{value?.mid_number ? `MID: ${value.mid_number}` : "-"}</span>
        </div>
      ),
    },
    {
      Header: "Payment Mode",
      accessor: "payment_method",
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
      Header: "Amount (₹)",
      accessor: "amount",
      Cell: ({ value }) => (
        <span className="font-bold text-gray-900 text-xs">
          ₹{Number(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      ),
    },
    {
      Header: "Status",
      accessor: "status",
      Cell: ({ value }) => {
        const st = String(value || "").toLowerCase();
        let badgeStyle = "bg-gray-100 text-gray-700 border-gray-200";
        if (st === "completed" || st === "success" || st === "captured") {
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
      Header: "#",
      accessor: "sl",
      Cell: ({ row }) => <span className="text-gray-500 font-medium text-xs">{baseIndex + row.index + 1}</span>,
    },
    {
      Header: "Date & Time",
      accessor: "createdAt",
      Cell: ({ value }) => (
        <span className="text-xs text-gray-700 whitespace-nowrap">
          {value ? new Date(value).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" }) : "-"}
        </span>
      ),
    },
    {
      Header: "Domain / Company",
      accessor: "company",
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
      Header: "Txn ID",
      accessor: "razorpay_transaction_id",
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
      Header: "Merchant",
      accessor: "merchant",
      Cell: ({ value }) => (
        <div className="flex flex-col min-w-[130px]">
          <span className="font-medium text-xs text-gray-900 truncate">{value?.name || "-"}</span>
          <span className="text-[11px] text-gray-500 truncate">{value?.abheepay_id || value?.mobile_number || "-"}</span>
        </div>
      ),
    },
    {
      Header: "Txn Amount (₹)",
      accessor: "transaction_amount",
      Cell: ({ value }) => (
        <span className="font-semibold text-gray-800 text-xs">
          ₹{Number(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      ),
    },
    {
      Header: "Comm Rate",
      accessor: "charge_rate",
      Cell: ({ value }) => (
        <span className="text-xs font-medium text-gray-700">
          {value ? `${Number(value).toFixed(2)}%` : "-"}
        </span>
      ),
    },
    {
      Header: "Commission (₹)",
      accessor: "charge_amount",
      Cell: ({ value }) => (
        <span className="font-bold text-[#00D3CD] text-xs">
          ₹{Number(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      ),
    },
    {
      Header: "GST (₹)",
      accessor: "gst_amount",
      Cell: ({ row }) => (
        <span className="text-xs text-gray-600">
          ₹{Number(row.original.gst_amount || 0).toFixed(2)} ({row.original.gst_percent || 18}%)
        </span>
      ),
    },
    {
      Header: "Net Payout (₹)",
      accessor: "net_amount",
      Cell: ({ value }) => (
        <span className="font-bold text-emerald-700 text-xs">
          ₹{Number(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      {/* ── Page Header ──────────────────────────────────────────────────────── */}
      <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">
            {activeTab === "service_reports"
              ? "Service Wise Reports"
              : activeTab === "service_management"
              ? "Service Management"
              : "Reports"}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {activeTab === "service_reports"
              ? "Volume, success rates, charge collections, and partner commissions categorized by individual service."
              : activeTab === "service_management"
              ? "Enable or disable platform services globally across Admin, Super Franchise, Franchise, and Merchant roles."
              : "Platform-wide transaction analytics, partner domain tracking, and commission audits."}
          </p>
        </div>

        {(activeTab === "transactions" || activeTab === "commissions") && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => (activeTab === "transactions" ? refetchTxn() : refetchComm())}
              disabled={isFetching}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50"
              title="Refresh current report"
            >
              <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin text-[#00D3CD]" : ""}`} />
              <span>Refresh</span>
            </button>

            <button
              type="button"
              onClick={handleExport}
              disabled={isExporting || isLoading}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              <span>{isExporting ? "Exporting..." : "Download Excel"}</span>
            </button>
          </div>
        )}
      </div>

      {/* ── Top Clickable Tab Bar ────────────────────────────────────────────── */}
      <div className="mb-6 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => handleTabSwitch("transactions")}
          className={`flex items-center gap-2 rounded-lg border px-5 py-2.5 text-sm font-semibold transition-all shadow-sm ${
            activeTab === "transactions"
              ? "border-[#00D3CD] bg-[#00D3CD] text-white ring-2 ring-[#00D3CD]/20"
              : "border-gray-300 bg-white text-gray-700 hover:border-[#00D3CD] hover:text-[#00D3CD]"
          }`}
        >
          <Activity className="h-4 w-4" />
          <span>Transaction Report</span>
        </button>

        <button
          type="button"
          onClick={() => handleTabSwitch("commissions")}
          className={`flex items-center gap-2 rounded-lg border px-5 py-2.5 text-sm font-semibold transition-all shadow-sm ${
            activeTab === "commissions"
              ? "border-[#00D3CD] bg-[#00D3CD] text-white ring-2 ring-[#00D3CD]/20"
              : "border-gray-300 bg-white text-gray-700 hover:border-[#00D3CD] hover:text-[#00D3CD]"
          }`}
        >
          <DollarSign className="h-4 w-4" />
          <span>Commission Report</span>
        </button>

        <button
          type="button"
          onClick={() => handleTabSwitch("service_reports")}
          className={`flex items-center gap-2 rounded-lg border px-5 py-2.5 text-sm font-semibold transition-all shadow-sm ${
            activeTab === "service_reports"
              ? "border-[#00D3CD] bg-[#00D3CD] text-white ring-2 ring-[#00D3CD]/20"
              : "border-gray-300 bg-white text-gray-700 hover:border-[#00D3CD] hover:text-[#00D3CD]"
          }`}
        >
          <Layers className="h-4 w-4" />
          <span>Service Wise Reports</span>
        </button>

        {/* <button
          type="button"
          onClick={() => handleTabSwitch("service_management")}
          className={`flex items-center gap-2 rounded-lg border px-5 py-2.5 text-sm font-semibold transition-all shadow-sm ${
            activeTab === "service_management"
              ? "border-[#00D3CD] bg-[#00D3CD] text-white ring-2 ring-[#00D3CD]/20"
              : "border-gray-300 bg-white text-gray-700 hover:border-[#00D3CD] hover:text-[#00D3CD]"
          }`}
        >
          <SlidersHorizontal className="h-4 w-4" />
          <span>Service Management</span>
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
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {activeTab === "transactions" ? (
          <>
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Total Volume</span>
                <span className="rounded-lg bg-[#00D3CD]/10 p-2 text-[#00D3CD]">
                  <TrendingUp className="h-5 w-5" />
                </span>
              </div>
              <p className="mt-2 text-2xl font-bold text-gray-900">
                ₹{Number(summary.total_volume || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </p>
              <p className="mt-1 text-xs text-gray-400">Total transaction throughput</p>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Total Transactions</span>
                <span className="rounded-lg bg-blue-50 p-2 text-blue-600">
                  <Activity className="h-5 w-5" />
                </span>
              </div>
              <p className="mt-2 text-2xl font-bold text-gray-900">{summary.total_count || 0}</p>
              <p className="mt-1 text-xs text-gray-400">Total records matching filters</p>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Successful Txns</span>
                <span className="rounded-lg bg-green-50 p-2 text-green-600">
                  <CheckCircle2 className="h-5 w-5" />
                </span>
              </div>
              <p className="mt-2 text-2xl font-bold text-green-700">{summary.success_count || 0}</p>
              <p className="mt-1 text-xs text-green-600">Success rate: {summary.success_rate || 0}%</p>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Failed Txns</span>
                <span className="rounded-lg bg-red-50 p-2 text-red-600">
                  <Activity className="h-5 w-5" />
                </span>
              </div>
              <p className="mt-2 text-2xl font-bold text-red-600">{summary.failed_count || 0}</p>
              <p className="mt-1 text-xs text-red-500">Declined or aborted attempts</p>
            </div>
          </>
        ) : (
          <>
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Gross Txn Volume</span>
                <span className="rounded-lg bg-blue-50 p-2 text-blue-600">
                  <TrendingUp className="h-5 w-5" />
                </span>
              </div>
              <p className="mt-2 text-2xl font-bold text-gray-900">
                ₹{Number(summary.total_transaction_volume || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </p>
              <p className="mt-1 text-xs text-gray-400">Base transactions charged</p>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Total Commissions</span>
                <span className="rounded-lg bg-[#00D3CD]/10 p-2 text-[#00D3CD]">
                  <DollarSign className="h-5 w-5" />
                </span>
              </div>
              <p className="mt-2 text-2xl font-bold text-[#00D3CD]">
                ₹{Number(summary.total_commission_revenue || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </p>
              <p className="mt-1 text-xs text-gray-400">Total fees earned</p>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Total GST</span>
                <span className="rounded-lg bg-purple-50 p-2 text-purple-600">
                  <Activity className="h-5 w-5" />
                </span>
              </div>
              <p className="mt-2 text-2xl font-bold text-purple-700">
                ₹{Number(summary.total_gst_collected || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </p>
              <p className="mt-1 text-xs text-gray-400">18% GST collected on fees</p>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Net Merchant Payout</span>
                <span className="rounded-lg bg-emerald-50 p-2 text-emerald-600">
                  <CheckCircle2 className="h-5 w-5" />
                </span>
              </div>
              <p className="mt-2 text-2xl font-bold text-emerald-700">
                ₹{Number(summary.total_net_payout || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </p>
              <p className="mt-1 text-xs text-gray-400">Disbursed to merchants</p>
            </div>
          </>
        )}
      </div>

      {/* ── Filters Card ─────────────────────────────────────────────────────── */}
      <div className="mb-6 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-[#00D3CD]" />
            <span className="text-xs font-bold uppercase tracking-wide text-gray-700">Filter Reports</span>
          </div>

          <button
            type="button"
            onClick={handleResetFilters}
            className="text-xs font-medium text-gray-500 hover:text-[#00D3CD]"
          >
            Reset Filters
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {/* Domain / Partner Filter */}
          <div>
            <label className="block text-xs font-medium text-gray-600">Partner Domain / Company</label>
            <select
              value={selectedDomain}
              onChange={(e) => {
                setSelectedDomain(e.target.value);
                setPage(1);
              }}
              className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs text-gray-800 shadow-sm focus:border-[#00D3CD] focus:outline-none focus:ring-1 focus:ring-[#00D3CD]"
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
          <div>
            <label className="block text-xs font-medium text-gray-600">From Date</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => {
                setFromDate(e.target.value);
                setPage(1);
              }}
              className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs text-gray-800 shadow-sm focus:border-[#00D3CD] focus:outline-none focus:ring-1 focus:ring-[#00D3CD]"
            />
          </div>

          {/* Date Range: To */}
          <div>
            <label className="block text-xs font-medium text-gray-600">To Date</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => {
                setToDate(e.target.value);
                setPage(1);
              }}
              className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs text-gray-800 shadow-sm focus:border-[#00D3CD] focus:outline-none focus:ring-1 focus:ring-[#00D3CD]"
            />
          </div>

          {/* Status or Payment Method */}
          {activeTab === "transactions" ? (
            <div>
              <label className="block text-xs font-medium text-gray-600">Status</label>
              <select
                value={selectedStatus}
                onChange={(e) => {
                  setSelectedStatus(e.target.value);
                  setPage(1);
                }}
                className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs text-gray-800 shadow-sm focus:border-[#00D3CD] focus:outline-none focus:ring-1 focus:ring-[#00D3CD]"
              >
                <option value="">All Statuses</option>
                <option value="completed">Completed / Success</option>
                <option value="pending">Pending</option>
                <option value="failed">Failed</option>
              </select>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-medium text-gray-600">Payment Mode</label>
              <select
                value={selectedPaymentMethod}
                onChange={(e) => {
                  setSelectedPaymentMethod(e.target.value);
                  setPage(1);
                }}
                className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs text-gray-800 shadow-sm focus:border-[#00D3CD] focus:outline-none focus:ring-1 focus:ring-[#00D3CD]"
              >
                <option value="">All Modes</option>
                <option value="card">Card</option>
                <option value="upi">UPI</option>
                <option value="netbanking">Net Banking</option>
              </select>
            </div>
          )}

          {/* Search Box */}
          <div>
            <label className="block text-xs font-medium text-gray-600">Keyword Search</label>
            <form onSubmit={handleSearchSubmit} className="mt-1 flex gap-1">
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Txn ID, RRN, Merchant..."
                className="w-full rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs text-gray-800 shadow-sm focus:border-[#00D3CD] focus:outline-none focus:ring-1 focus:ring-[#00D3CD]"
              />
              <button
                type="submit"
                className="rounded-lg bg-[#00D3CD] px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-[#00bdb7]"
                title="Search"
              >
                <Search className="h-3.5 w-3.5" />
              </button>
              {committedSearch && (
                <button
                  type="button"
                  onClick={handleSearchClear}
                  className="rounded-lg border border-gray-300 bg-gray-100 px-2 text-xs text-gray-600 hover:bg-gray-200"
                >
                  ✕
                </button>
              )}
            </form>
          </div>
        </div>
      </div>

      {/* ── Data Table & Pagination ──────────────────────────────────────────── */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="flex flex-col items-center gap-2">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-[#00D3CD]" />
              <p className="text-xs text-gray-500">Loading {activeTab} data...</p>
            </div>
          </div>
        ) : currentData.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center p-6 text-center">
            <div className="rounded-full bg-gray-100 p-3 text-gray-400">
              <Filter className="h-6 w-6" />
            </div>
            <h3 className="mt-3 text-sm font-semibold text-gray-900">No records found</h3>
            <p className="mt-1 text-xs text-gray-500 max-w-sm">
              No {activeTab} match the chosen filters or domain. Try clearing filters or picking a different date range.
            </p>
            <button
              type="button"
              onClick={handleResetFilters}
              className="mt-4 rounded-lg bg-[#00D3CD] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#00bdb7]"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table
              columns={activeTab === "transactions" ? transactionColumns : commissionColumns}
              data={currentData}
            />
          </div>
        )}

        {/* ── Table Footer & Pagination ────────────────────────────────────────── */}
        {!isLoading && currentData.length > 0 && (
          <div className="flex flex-col items-center justify-between gap-3 border-t border-gray-200 px-4 py-3 sm:flex-row">
            <span className="text-xs text-gray-600">
              Showing page <span className="font-semibold">{page}</span> of{" "}
              <span className="font-semibold">{totalPages}</span> ({totalRecords} records)
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="rounded-lg border border-gray-300 bg-white px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="rounded-lg border border-gray-300 bg-white px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
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

