import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import {
  Wallet,
  RefreshCw,
  Download,
  Search,
  CheckCircle2,
  Clock,
  XCircle,
  Copy,
  Printer,
  Eye,
  FileText,
  ChevronRight,
  ChevronLeft,
  X,
  RotateCcw
} from 'lucide-react';

import { getPayoutReport } from '../api/reportsApi';
import { checkBranchXPayoutStatus, getBranchXPayoutAuditLogsByPayout } from '../api/branchxApi';
import { checkVimoPayoutStatus, getVimoPayoutAuditLogsByReference } from '../api/vimoApi';
import { checkSevenPayPayoutStatus, getSevenPayPayoutAuditLogsByPayout } from '../api/sevenpayApi';
import { checkMxPayoutStatus, getMxPayoutAuditLogsByPayout } from '../api/mxPayoutApi';
import { checkNdia5DebugStatus, getNdia5PayoutAuditLogsByPayout } from '../api/ndia5Api';
import { fetchUserDetails } from '../api/authApi';
import Modal from '../components/Modal';
import Loader from '../components/Loader';

// Helper: Format Currency (₹)
const formatCurrency = (amount, decimals = 2) => {
  const num = Number(amount || 0);
  return '₹' + num.toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
};

// Helper: Format Date & Time (IST)
const formatDateTime = (dateStr) => {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '-';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  let h = d.getHours();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  const min = String(d.getMinutes()).padStart(2, '0');
  const sec = String(d.getSeconds()).padStart(2, '0');
  return `${dd}-${mm}-${yyyy} ${h}:${min}:${sec} ${ampm}`;
};

const formatDateOnly = (dateStr) => {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '-';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
};

// Helper: Format date input YYYY-MM-DD
const toInputDate = (d) => {
  if (!d) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Status normalizer
const normalizePayoutStatus = (status) => {
  const s = String(status || '').trim().toUpperCase();
  if (s === 'COMPLETED' || s === 'SUCCESS' || s === 'PAID') return 'SUCCESS';
  if (s === 'PROCESSING' || s === 'IN_PROGRESS' || s === 'PENDING' || s === 'INITIATED') return 'PENDING';
  if (s === 'FAILED' || s === 'REJECTED' || s === 'CANCELLED' || s === 'FAILURE') return 'FAILED';
  return s || 'PENDING';
};

// Provider Normalizer
const getProviderKey = (row) => {
  const p = String(row?.payout_provider || row?.provider || '').trim().toLowerCase();
  const ref = String(row?.reference_id || row?.referenceId || '').trim().toUpperCase();

  if (p.includes('branchx') || ref.startsWith('APB')) return 'branchx';
  if (p.includes('vimo') || ref.startsWith('APV')) return 'vimo';
  if (p.includes('sevenpay') || ref.startsWith('APS')) return 'sevenpay';
  if (p.includes('mx') || ref.startsWith('APM')) return 'mx_payout';
  if (p.includes('ndia5') || ref.startsWith('APN')) return 'ndia5_payout';
  return p || 'branchx';
};

// Provider display config
const PROVIDERS_CONFIG = {
  branchx: {
    label: 'BranchX',
    badge: 'Payout 3',
    color: '#0EA5E9',
    bg: 'bg-sky-50 text-sky-700 border-sky-200',
  },
  vimo: {
    label: 'Vimo',
    badge: 'Payout 1',
    color: '#00B9B2',
    bg: 'bg-teal-50 text-teal-700 border-teal-200',
  },
  sevenpay: {
    label: 'SevenPay',
    badge: 'Payout-S',
    color: '#7C3AED',
    bg: 'bg-purple-50 text-purple-700 border-purple-200',
  },
  ndia5_payout: {
    label: 'NDIA5',
    badge: 'Payout-N',
    color: '#F59E0B',
    bg: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  mx_payout: {
    label: 'Payout MX',
    badge: 'Payout 5',
    color: '#EF4444',
    bg: 'bg-rose-50 text-rose-700 border-rose-200',
  },
};

const TodayPayouts = ({ currentUser }) => {
  // User details
  const { data: userProfile } = useQuery({
    queryKey: ['currentUser'],
    queryFn: fetchUserDetails,
    initialData: currentUser,
  });

  const effectiveUser = userProfile || currentUser;
  const role = String(effectiveUser?.role || '').trim().toLowerCase();
  const isAdmin = role === 'admin' || role === 'super_admin';
  const walletBalance = Number(effectiveUser?.available_balance ?? effectiveUser?.wallet ?? 0);

  // ── Filters State ────────────────────────────────────────────────────────
  const todayObj = new Date();
  const [datePreset, setDatePreset] = useState('today');
  const [fromDate, setFromDate] = useState(toInputDate(todayObj));
  const [toDate, setToDate] = useState(toInputDate(todayObj));
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [selectedProvider, setSelectedProvider] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);

  // Apply Date Preset
  const handlePresetChange = (preset) => {
    setDatePreset(preset);
    const now = new Date();
    setPage(1);

    if (preset === 'today') {
      const todayStr = toInputDate(now);
      setFromDate(todayStr);
      setToDate(todayStr);
    } else if (preset === 'yesterday') {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      const yStr = toInputDate(y);
      setFromDate(yStr);
      setToDate(yStr);
    } else if (preset === 'last7') {
      const last7 = new Date(now);
      last7.setDate(last7.getDate() - 6);
      setFromDate(toInputDate(last7));
      setToDate(toInputDate(now));
    } else if (preset === 'thisMonth') {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      setFromDate(toInputDate(monthStart));
      setToDate(toInputDate(now));
    } else if (preset === 'all') {
      setFromDate('');
      setToDate('');
    }
  };

  // ── Fetch Payout History ─────────────────────────────────────────────────
  const reportFilters = useMemo(() => {
    const f = {
      page,
      limit,
    };
    if (fromDate) f.from_date = fromDate;
    if (toDate) f.to_date = toDate;
    if (selectedStatus !== 'ALL') f.status = selectedStatus;
    if (selectedProvider !== 'ALL') f.payout_provider = selectedProvider;
    return f;
  }, [page, limit, fromDate, toDate, selectedStatus, selectedProvider]);

  const {
    data: payoutResponse,
    isLoading: isHistoryLoading,
    isFetching: isHistoryFetching,
    refetch: refetchHistory,
  } = useQuery({
    queryKey: ['todayPayoutsReport', reportFilters],
    queryFn: () => getPayoutReport(reportFilters),
    refetchOnWindowFocus: false,
  });

  const payoutRows = useMemo(() => {
    if (Array.isArray(payoutResponse?.data)) {
      return payoutResponse.data;
    }
    return [];
  }, [payoutResponse]);

  const pagination = payoutResponse?.pagination || {
    total: payoutRows.length,
    page: 1,
    limit: 25,
    totalPages: 1,
  };

  // Local filter for search query
  const filteredRows = useMemo(() => {
    if (!searchQuery.trim()) return payoutRows;
    const q = searchQuery.toLowerCase().trim();
    return payoutRows.filter((row) => {
      const ref = String(row.reference_id || '').toLowerCase();
      const rrn = String(row.rrn || row.utr || '').toLowerCase();
      const beneName = String(row.beneficiary?.beneficiary_name || row.beneficiary_name || '').toLowerCase();
      const beneAcc = String(row.beneficiary?.account_number || '').toLowerCase();
      const merchantName = String(row.merchant?.name || '').toLowerCase();
      const provider = String(row.payout_provider || '').toLowerCase();
      return (
        ref.includes(q) ||
        rrn.includes(q) ||
        beneName.includes(q) ||
        beneAcc.includes(q) ||
        merchantName.includes(q) ||
        provider.includes(q)
      );
    });
  }, [payoutRows, searchQuery]);

  // Summary Metrics Computation
  const summaryStats = useMemo(() => {
    let totalAmt = 0;
    let totalCount = 0;
    let successAmt = 0;
    let successCount = 0;
    let pendingAmt = 0;
    let pendingCount = 0;
    let failedAmt = 0;
    let failedCount = 0;

    filteredRows.forEach((r) => {
      const amt = Number(r.amount || 0);
      const st = normalizePayoutStatus(r.status);
      totalAmt += amt;
      totalCount += 1;

      if (st === 'SUCCESS') {
        successAmt += amt;
        successCount += 1;
      } else if (st === 'PENDING') {
        pendingAmt += amt;
        pendingCount += 1;
      } else if (st === 'FAILED') {
        failedAmt += amt;
        failedCount += 1;
      }
    });

    return {
      totalAmt,
      totalCount,
      successAmt,
      successCount,
      pendingAmt,
      pendingCount,
      failedAmt,
      failedCount,
    };
  }, [filteredRows]);

  // ── Modal States ─────────────────────────────────────────────────────────
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [selectedAuditLog, setSelectedAuditLog] = useState(null);
  const [auditLogData, setAuditLogData] = useState(null);
  const [auditLogLoading, setAuditLogLoading] = useState(false);
  const [statusCheckingId, setStatusCheckingId] = useState(null);

  // Status check action
  const handleCheckStatus = async (row) => {
    const prov = getProviderKey(row);
    const id = row.id;
    const ref = row.reference_id;
    setStatusCheckingId(id);

    try {
      let res = null;
      if (prov === 'branchx') {
        res = await checkBranchXPayoutStatus({ reference_id: ref, payout_transaction_id: id });
      } else if (prov === 'vimo') {
        res = await checkVimoPayoutStatus({ reference_id: ref });
      } else if (prov === 'sevenpay') {
        res = await checkSevenPayPayoutStatus({ reference_id: ref });
      } else if (prov === 'mx_payout') {
        res = await checkMxPayoutStatus({ reference_id: ref });
      } else if (prov === 'ndia5_payout') {
        res = await checkNdia5DebugStatus({ reference_id: ref });
      } else {
        res = await checkBranchXPayoutStatus({ reference_id: ref, payout_transaction_id: id });
      }

      toast.success(res?.message || 'Payout status updated successfully');
      await refetchHistory();
    } catch (err) {
      toast.error(err?.message || 'Failed to check status');
    } finally {
      setStatusCheckingId(null);
    }
  };

  // Open Audit Log
  const handleOpenAuditLog = async (row) => {
    setSelectedAuditLog(row);
    setAuditLogLoading(true);
    setAuditLogData(null);
    const prov = getProviderKey(row);
    const ref = row.reference_id || row.id;

    try {
      let logs = null;
      if (prov === 'branchx') {
        logs = await getBranchXPayoutAuditLogsByPayout({ reference_id: ref, payout_id: row.id });
      } else if (prov === 'vimo') {
        logs = await getVimoPayoutAuditLogsByReference({ reference_id: ref });
      } else if (prov === 'sevenpay') {
        logs = await getSevenPayPayoutAuditLogsByPayout({ reference_id: ref });
      } else if (prov === 'mx_payout') {
        logs = await getMxPayoutAuditLogsByPayout({ reference_id: ref });
      } else if (prov === 'ndia5_payout') {
        logs = await getNdia5PayoutAuditLogsByPayout({ reference_id: ref });
      }
      setAuditLogData(logs?.data || logs || []);
    } catch (e) {
      setAuditLogData([]);
      toast.info('No audit log records available for this transaction.');
    } finally {
      setAuditLogLoading(false);
    }
  };

  // Export to Excel
  const handleExportExcel = () => {
    if (!filteredRows.length) {
      toast.warn('No payout records to export');
      return;
    }

    const exportData = filteredRows.map((r, i) => ({
      '#': i + 1,
      'Date & Time': formatDateTime(r.date || r.createdAt),
      'Reference ID': r.reference_id || '-',
      'Provider': r.payout_provider || 'BranchX',
      'Merchant / User': r.merchant?.name || `ID: ${r.merchant_id || '-'}`,
      'Beneficiary Name': r.beneficiary?.beneficiary_name || r.beneficiary_name || '-',
      'Account Number': r.beneficiary?.account_number || '-',
      'Bank Name': r.beneficiary?.bank_name || '-',
      'IFSC Code': r.beneficiary?.ifsc_code || '-',
      'Amount (Rs)': Number(r.amount || 0).toFixed(2),
      'Service Charge (Rs)': Number(r.service_charge || 0).toFixed(2),
      'Total Deducted (Rs)': Number(r.total_deducted || r.amount || 0).toFixed(2),
      'RRN': r.rrn || '-',
      'UTR': r.utr || '-',
      'Status': normalizePayoutStatus(r.status),
      'Balance Before (Rs)': r.balance_before !== null ? Number(r.balance_before).toFixed(2) : '-',
      'Balance After (Rs)': r.balance_after !== null ? Number(r.balance_after).toFixed(2) : '-',
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Payout History');
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], { type: 'application/octet-stream' });
    saveAs(blob, `payout_history_${fromDate || 'all'}_to_${toDate || 'now'}.xlsx`);
    toast.success('Payout report exported successfully');
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 bg-gray-50 min-h-screen">
      {/* ── HEADER BANNER ──────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-[#00D3CD]/10 border border-[#00D3CD]/20 flex items-center justify-center text-[#009B96] shrink-0">
            <Wallet className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-extrabold tracking-tight text-gray-900">
                Payout History
              </h1>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold">
                Live Status
              </span>
            </div>
            <p className="text-xs sm:text-sm text-gray-500 mt-1">
              Live settlement monitoring, complete payout transaction records, and status reconciliation.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => refetchHistory()}
            disabled={isHistoryFetching}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 font-semibold text-sm shadow-sm transition active:scale-95"
            title="Refresh Payout Data"
          >
            <RefreshCw className={`w-4 h-4 text-gray-500 ${isHistoryFetching ? 'animate-spin text-[#00D3CD]' : ''}`} />
            Refresh
          </button>
          <button
            onClick={handleExportExcel}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 font-semibold text-sm shadow-sm transition active:scale-95"
            title="Export Excel Report"
          >
            <Download className="w-4 h-4 text-gray-500" />
            Export Excel
          </button>
        </div>
      </div>

      {/* ── SECTION 1: SUMMARY METRICS CARDS ─────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Total Payout */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Total Payouts</span>
            <div className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center text-gray-600">
              <RotateCcw className="w-4 h-4" />
            </div>
          </div>
          <p className="mt-3 text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
            {formatCurrency(summaryStats.totalAmt)}
          </p>
          <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
            <span>{summaryStats.totalCount} records total</span>
            <span className="text-gray-400">All channels</span>
          </div>
        </div>

        {/* Success Settled */}
        <div className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Success Settled</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <p className="mt-3 text-2xl sm:text-3xl font-extrabold text-emerald-600 tracking-tight">
            {formatCurrency(summaryStats.successAmt)}
          </p>
          <div className="mt-2 flex items-center justify-between text-xs text-emerald-600/80">
            <span>{summaryStats.successCount} settled</span>
            <span className="font-bold">
              {summaryStats.totalCount > 0 ? Math.round((summaryStats.successCount / summaryStats.totalCount) * 100) : 0}% success
            </span>
          </div>
        </div>

        {/* Pending / In Process */}
        <div className="rounded-2xl border border-amber-100 bg-white p-5 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-700">Processing</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <p className="mt-3 text-2xl sm:text-3xl font-extrabold text-amber-600 tracking-tight">
            {formatCurrency(summaryStats.pendingAmt)}
          </p>
          <div className="mt-2 flex items-center justify-between text-xs text-amber-600/80">
            <span>{summaryStats.pendingCount} pending</span>
            <span>Awaiting bank callback</span>
          </div>
        </div>

        {/* Failed */}
        <div className="rounded-2xl border border-red-100 bg-white p-5 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-red-700">Failed</span>
            <div className="w-8 h-8 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center text-red-600">
              <XCircle className="w-4 h-4" />
            </div>
          </div>
          <p className="mt-3 text-2xl sm:text-3xl font-extrabold text-red-600 tracking-tight">
            {formatCurrency(summaryStats.failedAmt)}
          </p>
          <div className="mt-2 flex items-center justify-between text-xs text-red-600/80">
            <span>{summaryStats.failedCount} failed</span>
            <span>Refundable</span>
          </div>
        </div>

        {/* Available Wallet Balance */}
        <div className="rounded-2xl border border-[#00D3CD]/30 bg-gradient-to-br from-white to-[#00D3CD]/5 p-5 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#008f8a]">Wallet Balance</span>
            <div className="w-8 h-8 rounded-xl bg-[#00D3CD]/15 flex items-center justify-center text-[#008f8a]">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <p className="mt-3 text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
            {formatCurrency(walletBalance)}
          </p>
          <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
            <span>Available Balance</span>
            <span className="px-1.5 py-0.5 rounded bg-gray-100 font-semibold uppercase text-[10px] text-gray-600">
              {role}
            </span>
          </div>
        </div>
      </div>

      {/* ── SECTION 2: FILTERS & CONTROLS TOOLBAR ────────────────────────────── */}
      <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm space-y-4">
        {/* Row 1: Date Preset Buttons & Search */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-1.5 bg-gray-100 p-1.5 rounded-xl border border-gray-200/80">
            {[
              { id: 'today', label: 'Today' },
              { id: 'yesterday', label: 'Yesterday' },
              { id: 'last7', label: 'Last 7 Days' },
              { id: 'thisMonth', label: 'This Month' },
              { id: 'all', label: 'All Time' },
            ].map((preset) => (
              <button
                key={preset.id}
                onClick={() => handlePresetChange(preset.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  datePreset === preset.id
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>

          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search reference ID, RRN, beneficiary name, account..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 text-xs sm:text-sm rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#00D3CD]/30 focus:border-[#00D3CD] transition"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Row 2: Date pickers, Status, Provider, Rows per page */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-2 border-t border-gray-100 text-xs">
          <div>
            <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">
              From Date
            </label>
            <div className="relative">
              <input
                type="date"
                value={fromDate}
                onChange={(e) => {
                  setFromDate(e.target.value);
                  setDatePreset('custom');
                  setPage(1);
                }}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 text-gray-800 focus:outline-none focus:border-[#00D3CD]"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">
              To Date
            </label>
            <div className="relative">
              <input
                type="date"
                value={toDate}
                onChange={(e) => {
                  setToDate(e.target.value);
                  setDatePreset('custom');
                  setPage(1);
                }}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 text-gray-800 focus:outline-none focus:border-[#00D3CD]"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">
              Status
            </label>
            <select
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-white text-gray-800 focus:outline-none focus:border-[#00D3CD]"
            >
              <option value="ALL">All Statuses</option>
              <option value="SUCCESS">Success</option>
              <option value="PENDING">Pending / Processing</option>
              <option value="FAILED">Failed</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">
              Provider Channel
            </label>
            <select
              value={selectedProvider}
              onChange={(e) => {
                setSelectedProvider(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-white text-gray-800 focus:outline-none focus:border-[#00D3CD]"
            >
              <option value="ALL">All Providers</option>
              <option value="BranchX">BranchX</option>
              <option value="Vimo">Vimo</option>
              <option value="SevenPay">SevenPay</option>
              <option value="Payout-M-X">Payout MX</option>
              <option value="ndia5">NDIA5</option>
            </select>
          </div>

          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                Rows / Page
              </label>
              <select
                value={limit}
                onChange={(e) => {
                  setLimit(Number(e.target.value));
                  setPage(1);
                }}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-white text-gray-800 focus:outline-none focus:border-[#00D3CD]"
              >
                <option value={10}>10 rows</option>
                <option value={25}>25 rows</option>
                <option value={50}>50 rows</option>
                <option value={100}>100 rows</option>
              </select>
            </div>
            <button
              onClick={() => {
                setDatePreset('today');
                setFromDate(toInputDate(new Date()));
                setToDate(toInputDate(new Date()));
                setSelectedStatus('ALL');
                setSelectedProvider('ALL');
                setSearchQuery('');
                setPage(1);
              }}
              className="px-3 py-2 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-100 font-semibold transition"
              title="Reset all filters"
            >
              Reset
            </button>
          </div>
        </div>
      </div>

      {/* ── SECTION 3: PAYOUT TRANSACTIONS TABLE ──────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-gray-900">Payout Transaction Records</h2>
            <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 text-xs font-semibold">
              {filteredRows.length} records
            </span>
          </div>
          <div className="text-xs text-gray-500">
            Showing page {pagination.page || page} of {pagination.totalPages || 1}
          </div>
        </div>

        {isHistoryLoading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3">
            <Loader />
            <p className="text-sm text-gray-500">Loading payout records...</p>
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="py-20 text-center flex flex-col items-center justify-center">
            <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center text-gray-400 mb-3">
              <FileText className="w-7 h-7" />
            </div>
            <h3 className="text-base font-bold text-gray-800">No Payout Records Found</h3>
            <p className="text-xs text-gray-500 max-w-sm mt-1">
              There are no payout transactions matching the selected date range and filter criteria.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-gray-50/80 border-b border-gray-200 text-gray-500 font-semibold tracking-wider uppercase text-[11px]">
                  <th className="py-3 px-4">#</th>
                  <th className="py-3 px-4">Date & Time</th>
                  <th className="py-3 px-4">Reference & Channel</th>
                  <th className="py-3 px-4">Beneficiary Account</th>
                  {isAdmin && <th className="py-3 px-4">Merchant / User</th>}
                  <th className="py-3 px-4">Amount</th>
                  <th className="py-3 px-4">Fee / Debit</th>
                  <th className="py-3 px-4">RRN / UTR</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-700">
                {filteredRows.map((row, idx) => {
                  const provKey = getProviderKey(row);
                  const provConf = PROVIDERS_CONFIG[provKey] || PROVIDERS_CONFIG.branchx;
                  const status = normalizePayoutStatus(row.status);
                  const isPending = status === 'PENDING';
                  const isSuccess = status === 'SUCCESS';
                  const isFailed = status === 'FAILED';

                  return (
                    <tr key={row.id || idx} className="hover:bg-gray-50/70 transition-colors">
                      <td className="py-3.5 px-4 text-gray-400 font-medium">
                        {(page - 1) * limit + idx + 1}
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="font-semibold text-gray-900">{formatDateOnly(row.date || row.createdAt)}</div>
                        <div className="text-[11px] text-gray-400">
                          {row.date || row.createdAt ? new Date(row.date || row.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }) : '-'}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 font-mono text-gray-900 font-medium">
                          <span>{row.reference_id || `TXN-${row.id}`}</span>
                          {row.reference_id && (
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(row.reference_id);
                                toast.info('Reference ID copied');
                              }}
                              className="text-gray-400 hover:text-gray-700"
                              title="Copy Reference ID"
                            >
                              <Copy className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                        <div className="mt-1">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${provConf.bg}`}>
                            {row.payout_provider || provConf.label}
                          </span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-gray-900">
                          {row.beneficiary?.beneficiary_name || row.beneficiary_name || 'Beneficiary'}
                        </div>
                        <div className="text-[11px] text-gray-500 font-mono">
                          {row.beneficiary?.account_number || '-'} · {row.beneficiary?.ifsc_code || '-'}
                        </div>
                        <div className="text-[10px] text-gray-400">
                          {row.beneficiary?.bank_name || '-'}
                        </div>
                      </td>

                      {isAdmin && (
                        <td className="py-3.5 px-4">
                          <div className="font-medium text-gray-900">
                            {row.merchant?.name || `ID: ${row.merchant_id || '-'}`}
                          </div>
                          <div className="text-[11px] text-gray-400">
                            {row.merchant?.mobile_number || ''}
                          </div>
                        </td>
                      )}

                      <td className="py-3.5 px-4 whitespace-nowrap font-bold text-gray-900">
                        {formatCurrency(row.amount)}
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="text-red-600 font-semibold font-mono">
                          {formatCurrency(row.total_deducted || row.amount)}
                        </div>
                        <div className="text-[10px] text-gray-400">
                          Fee: {formatCurrency(row.service_charge || 0)}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap font-mono text-[11px] text-gray-600">
                        {row.rrn || row.utr || '-'}
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                            isSuccess
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : isPending
                              ? 'bg-amber-50 text-amber-700 border-amber-200 animate-pulse'
                              : 'bg-red-50 text-red-700 border-red-200'
                          }`}
                        >
                          {isSuccess && <CheckCircle2 className="w-3 h-3" />}
                          {isPending && <Clock className="w-3 h-3" />}
                          {isFailed && <XCircle className="w-3 h-3" />}
                          {status}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* Status Check button */}
                          <button
                            onClick={() => handleCheckStatus(row)}
                            disabled={statusCheckingId === row.id}
                            className="p-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition"
                            title="Check Status from Bank Gateway"
                          >
                            <RefreshCw
                              className={`w-3.5 h-3.5 ${statusCheckingId === row.id ? 'animate-spin text-[#00D3CD]' : ''}`}
                            />
                          </button>

                          {/* View Receipt */}
                          <button
                            onClick={() => setSelectedReceipt(row)}
                            className="p-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-[#00D3CD]/10 hover:text-[#008f8a] hover:border-[#00D3CD]/30 transition"
                            title="View Receipt"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {/* View Audit Log */}
                          <button
                            onClick={() => handleOpenAuditLog(row)}
                            className="p-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition"
                            title="View Audit Trail"
                          >
                            <FileText className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        {pagination.totalPages > 1 && (
          <div className="px-6 py-4 bg-gray-50/50 border-t border-gray-200 flex items-center justify-between text-xs text-gray-600">
            <div>
              Showing records {(page - 1) * limit + 1} to{' '}
              {Math.min(page * limit, pagination.total || filteredRows.length)} of{' '}
              {pagination.total || filteredRows.length}
            </div>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="p-2 rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="font-semibold text-gray-900">
                Page {page} of {pagination.totalPages}
              </span>
              <button
                disabled={page >= pagination.totalPages}
                onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                className="p-2 rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── RECEIPT MODAL ────────────────────────────────────────────────────── */}
      <Modal
        isOpen={Boolean(selectedReceipt)}
        onClose={() => setSelectedReceipt(null)}
        title="Payout Transaction Receipt"
      >
        {selectedReceipt && (
          <div className="space-y-6 text-xs sm:text-sm">
            {/* Printable Receipt Card */}
            <div id="payout-receipt-print" className="p-6 bg-white rounded-2xl border border-gray-200 shadow-sm space-y-6">
              {/* Receipt Header */}
              <div className="flex items-center justify-between pb-4 border-b border-gray-200">
                <div>
                  <h3 className="text-lg font-black text-gray-900 tracking-tight">ABHEEPAY SETTLEMENT</h3>
                  <p className="text-xs text-gray-400">Electronic Fund Transfer Confirmation</p>
                </div>
                <div className="text-right">
                  <span
                    className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-extrabold border ${
                      normalizePayoutStatus(selectedReceipt.status) === 'SUCCESS'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : normalizePayoutStatus(selectedReceipt.status) === 'PENDING'
                        ? 'bg-amber-50 text-amber-700 border-amber-200'
                        : 'bg-red-50 text-red-700 border-red-200'
                    }`}
                  >
                    {normalizePayoutStatus(selectedReceipt.status)}
                  </span>
                </div>
              </div>

              {/* Amount Display */}
              <div className="text-center py-4 bg-gray-50 rounded-2xl border border-gray-100">
                <span className="text-xs text-gray-500 font-semibold uppercase tracking-wider block mb-1">
                  Transferred Amount
                </span>
                <span className="text-3xl font-black text-gray-900 tracking-tight">
                  {formatCurrency(selectedReceipt.amount)}
                </span>
                <p className="text-xs text-gray-400 mt-1">
                  Total Deducted: {formatCurrency(selectedReceipt.total_deducted || selectedReceipt.amount)} (Fee: {formatCurrency(selectedReceipt.service_charge || 0)})
                </p>
              </div>

              {/* Key Details Grid */}
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Date & Time</p>
                  <p className="font-semibold text-gray-900 mt-0.5">{formatDateTime(selectedReceipt.date || selectedReceipt.createdAt)}</p>
                </div>
                <div>
                  <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Reference ID</p>
                  <p className="font-mono font-semibold text-gray-900 mt-0.5 break-all">{selectedReceipt.reference_id || '-'}</p>
                </div>
                <div>
                  <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Bank RRN / UTR</p>
                  <p className="font-mono font-semibold text-gray-900 mt-0.5">{selectedReceipt.rrn || selectedReceipt.utr || '-'}</p>
                </div>
                <div>
                  <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Payout Gateway</p>
                  <p className="font-semibold text-gray-900 mt-0.5">{selectedReceipt.payout_provider || 'BranchX'}</p>
                </div>
              </div>

              {/* Beneficiary Details Card */}
              <div className="p-4 rounded-xl bg-gray-50 border border-gray-200 space-y-1.5 text-xs">
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Beneficiary Information</p>
                <p className="font-bold text-gray-900 text-sm">{selectedReceipt.beneficiary?.beneficiary_name || selectedReceipt.beneficiary_name || 'Account Holder'}</p>
                <p className="font-mono text-gray-600">
                  Acc: {selectedReceipt.beneficiary?.account_number || '-'} · IFSC: {selectedReceipt.beneficiary?.ifsc_code || '-'}
                </p>
                <p className="text-gray-500">{selectedReceipt.beneficiary?.bank_name || '-'}</p>
              </div>

              {selectedReceipt.purpose && (
                <div className="text-xs text-gray-500">
                  <span className="font-semibold text-gray-700">Purpose / Narration:</span> {selectedReceipt.purpose}
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(
                    `Payout Receipt\nRef: ${selectedReceipt.reference_id}\nAmount: ${formatCurrency(selectedReceipt.amount)}\nBeneficiary: ${selectedReceipt.beneficiary?.beneficiary_name || '-'}\nAcc: ${selectedReceipt.beneficiary?.account_number || '-'}\nIFSC: ${selectedReceipt.beneficiary?.ifsc_code || '-'}\nRRN: ${selectedReceipt.rrn || '-'}\nStatus: ${normalizePayoutStatus(selectedReceipt.status)}`
                  );
                  toast.success('Receipt details copied to clipboard');
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 text-xs font-semibold"
              >
                <Copy className="w-3.5 h-3.5" />
                Copy Details
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gray-900 text-white text-xs font-semibold hover:bg-gray-800"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Print Receipt
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedReceipt(null)}
                  className="px-4 py-2 rounded-xl border border-gray-200 bg-gray-100 text-gray-700 text-xs font-semibold hover:bg-gray-200"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* ── AUDIT LOG MODAL ──────────────────────────────────────────────────── */}
      <Modal
        isOpen={Boolean(selectedAuditLog)}
        onClose={() => {
          setSelectedAuditLog(null);
          setAuditLogData(null);
        }}
        title="Payout Audit Trail & Gateway Logs"
      >
        <div className="space-y-4 text-xs">
          <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 flex items-center justify-between">
            <div>
              <span className="text-gray-500 font-semibold">Ref:</span>{' '}
              <span className="font-mono font-bold text-gray-900">{selectedAuditLog?.reference_id || selectedAuditLog?.id}</span>
            </div>
            <div>
              <span className="text-gray-500 font-semibold">Gateway:</span>{' '}
              <span className="font-bold text-gray-900">{selectedAuditLog?.payout_provider || 'BranchX'}</span>
            </div>
          </div>

          {auditLogLoading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2">
              <Loader />
              <p className="text-gray-500">Fetching audit logs from gateway...</p>
            </div>
          ) : !auditLogData || auditLogData.length === 0 ? (
            <div className="py-12 text-center text-gray-400">
              No audit log entries recorded for this payout transaction.
            </div>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
              {Array.isArray(auditLogData) ? (
                auditLogData.map((log, i) => (
                  <div key={i} className="p-3 bg-gray-50 rounded-xl border border-gray-200 space-y-1">
                    <div className="flex items-center justify-between text-[11px] text-gray-400">
                      <span>{log.createdAt ? formatDateTime(log.createdAt) : `Event #${i + 1}`}</span>
                      <span className="font-bold text-gray-700">{log.action || log.event || log.status || 'LOG'}</span>
                    </div>
                    <pre className="text-[11px] font-mono text-gray-800 bg-white p-2 rounded border border-gray-100 overflow-x-auto">
                      {typeof log === 'string' ? log : JSON.stringify(log, null, 2)}
                    </pre>
                  </div>
                ))
              ) : (
                <pre className="text-[11px] font-mono text-gray-800 bg-gray-50 p-3 rounded-xl border border-gray-200 overflow-x-auto">
                  {JSON.stringify(auditLogData, null, 2)}
                </pre>
              )}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};

export default TodayPayouts;
