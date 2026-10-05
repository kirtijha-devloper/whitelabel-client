import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import Table from '../components/Table'; // Assuming you have a reusable Table component
import { getAllPosTransactionReport, getWalletReport } from '../api/reportsApi';
import { AllUsers } from '../api/FranchiseApi';
import { calculateFranchisePoolStats } from '../utils/userLimit';
import ReportTabs from '../components/Reports/ReportTabs';
import CombinedReportDownloadButton from '../components/Reports/CombinedReportDownloadButton';
import UserSelectWithSuggestions from '../components/Reports/UserSelectWithSuggestions';
import {
  getRowBank,
  getRowCardClassification,
  getRowProvider,
  getRowSource,
  getSourceLabel,
} from '../utils/agroScope';

const getSettlementTypeLabel = (row = {}, franchiseMerchantsMap = new Map()) => {
  const raw = row?.settlement_type || row?.settlementType;
  const user = row?.user || {};
  const role = String(user?.role || '').toLowerCase();

  let userLimit =
    row?.user?.t0_daily_limit ??
    row?.t0_daily_limit ??
    row?.user_t0_limit ??
    row?.t0Limit ??
    null;

  if (role === 'franchise' || role === 'franchaise') {
    const uId = String(user?.id || row?.user_id || row?.merchant_id || '');
    const children = franchiseMerchantsMap.get(uId) || [];
    const stats = calculateFranchisePoolStats(user, children);
    if (!stats.isUnlimited && stats.remainingSelfLimit !== null) {
      userLimit = stats.remainingSelfLimit;
    }
  }

  const amt = Number(row?.amount || row?.txn_amount || row?.total_amount || 0);

  // If T0 limit is assigned and transaction amount exceeds T0 daily limit, auto-shift to T+1 (On Hold)
  if (userLimit !== null && userLimit !== undefined && userLimit !== "" && String(userLimit).toLowerCase() !== "unlimited") {
    const limitNum = Number(userLimit);
    if (Number.isFinite(limitNum) && (limitNum === 0 || amt > limitNum)) {
      return 'T+1';
    }
  }

  if (!raw) return '-';
  const lower = String(raw).toLowerCase().replace(/[^a-z0-9]+/g, '');
  if (lower === 'todaysettlement' || lower === 't0' || lower === 'samedaysettlement') return 'T+0';
  if (lower === 'nextdaysettlement' || lower === 't1' || lower === 'tplus1') return 'T+1';
  return String(raw);
};

const inputClassName =
  'w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500';
const compactInputClassName =
  'w-full rounded-lg border border-gray-200 bg-white px-2 py-2 text-xs focus:ring-2 focus:ring-indigo-500';
const mobilePosSearchOptions = [
  {
    value: 'userSearch',
    radioLabel: 'User',
    inputLabel: 'User (ID / Name / Mobile)',
    placeholder: 'Enter User ID, Name, or Mobile',
  },
  {
    value: 'cardHolderName',
    radioLabel: 'Card Holder',
    inputLabel: 'Card Holder Name',
    placeholder: 'Enter card holder name',
  },
  {
    value: 'cardNumber',
    radioLabel: 'Card No.',
    inputLabel: 'Card Number',
    placeholder: 'Enter card number',
  },
  {
    value: 'posTxnNo',
    radioLabel: 'Txn No.',
    inputLabel: 'POS Txn No',
    placeholder: 'Enter POS Txn No',
  },
  {
    value: 'deviceNo',
    radioLabel: 'Device No.',
    inputLabel: 'Device No',
    placeholder: 'Enter Device No',
  },
];

const normalizeRole = (role) => {
  const value = String(role || '').trim().toLowerCase();
  if (value === 'franchaise') return 'franchise';
  if(value === 'super_franchise') return 'super-franchise'
  if (value === 'admin' || value === 'franchise' || value === 'merchant' || value === 'super-franchise') return value;
  return 'admin';
};

const getFirstPopulatedValue = (row, keys) => {
  for (const key of keys) {
    const value = row?.[key];
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      return value;
    }
  }
  return '';
};

const getRowCardHolderName = (row) =>
  getFirstPopulatedValue(row, [
    'card_holder_name',
    'cardHolderName',
    'holder_name',
    'holderName',
    'customer_name',
    'customerName',
  ]);

const getRowCardNumber = (row) =>
  getFirstPopulatedValue(row, [
    'card_number',
    'cardNumber',
    'masked_card_number',
    'maskedCardNumber',
    'payment_card_number',
    'paymentCardNumber',
    'card_no',
    'cardNo',
    'pan',
  ]);

const StickyPosReportTable = ({ columns, data }) => {
  const headerScrollRef = useRef(null);
  const bodyScrollRef = useRef(null);
  const isSyncingScrollRef = useRef(false);
  const tableWidth = useMemo(
    () =>
      columns.reduce((total, column) => {
        const width = Number.parseFloat(column.width || 0);
        return total + (Number.isFinite(width) ? width : 0);
      }, 0),
    [columns]
  );

  useEffect(() => {
    const headerScrollEl = headerScrollRef.current;
    const bodyScrollEl = bodyScrollRef.current;

    if (!headerScrollEl || !bodyScrollEl) return undefined;

    const syncScrollLeft = (sourceEl, targetEl) => {
      if (isSyncingScrollRef.current) return;

      isSyncingScrollRef.current = true;
      targetEl.scrollLeft = sourceEl.scrollLeft;
      window.requestAnimationFrame(() => {
        isSyncingScrollRef.current = false;
      });
    };

    const handleHeaderScroll = () => syncScrollLeft(headerScrollEl, bodyScrollEl);
    const handleBodyScroll = () => syncScrollLeft(bodyScrollEl, headerScrollEl);

    headerScrollEl.addEventListener('scroll', handleHeaderScroll, { passive: true });
    bodyScrollEl.addEventListener('scroll', handleBodyScroll, { passive: true });

    return () => {
      headerScrollEl.removeEventListener('scroll', handleHeaderScroll);
      bodyScrollEl.removeEventListener('scroll', handleBodyScroll);
    };
  }, []);

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-md">
      <div className="sticky top-[-1rem] z-30 rounded-t-xl border-b border-gray-200 bg-gray-100">
        <div ref={headerScrollRef} className="ledger-horizontal-scrollbar max-w-full overflow-x-auto">
          <table
            className="table-fixed border-collapse"
            style={tableWidth ? { width: `${tableWidth}px` } : undefined}
          >
            <colgroup>
              {columns.map((column) => (
                <col key={column.key} style={column.width ? { width: column.width } : undefined} />
              ))}
            </colgroup>
            <thead>
              <tr>
                {columns.map((column) => (
                  <th
                    key={column.key}
                    className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider whitespace-nowrap text-gray-700 ${
                      column.headerClassName || ''
                    }`.trim()}
                  >
                    {column.header}
                  </th>
                ))}
              </tr>
            </thead>
          </table>
        </div>
      </div>

      <div ref={bodyScrollRef} className="ledger-horizontal-scrollbar max-w-full overflow-x-auto rounded-b-xl bg-white">
        <table
          className="table-fixed border-collapse"
          style={tableWidth ? { width: `${tableWidth}px` } : undefined}
        >
          <colgroup>
            {columns.map((column) => (
              <col key={column.key} style={column.width ? { width: column.width } : undefined} />
            ))}
          </colgroup>
          <tbody className="divide-y divide-gray-200">
            {data.map((row, rowIndex) => (
              <tr key={row.id ?? rowIndex} className="hover:bg-gray-50">
                {columns.map((column, colIndex) => (
                  <td
                    key={column.key || colIndex}
                    className={`px-4 py-4 align-top text-sm text-gray-900 ${
                      column.cellClassName || ''
                    }`.trim()}
                  >
                    {column.render
                      ? column.render(row[column.key], row, rowIndex)
                      : row[column.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const buildBaseFilters = (today) => ({
  startDate: today,
  endDate: today,
  status: '',
  userSearch: '',
  cardHolderName: '',
  cardNumber: '',
  posTxnNo: '',
  deviceNo: '',
  source: '',
  settlementType: '',
  cardClassification: '',
});

const Reports = ({ currentUser }) => {
  const location = useLocation();
  const today = new Date().toISOString().split('T')[0];
  const roleBase = normalizeRole(currentUser?.role).replace('_', '-');
  const reportsBasePath = `/${roleBase}/reports`;
  const reportType = useMemo(() => {
    const tab = new URLSearchParams(location.search).get('tab');
    return tab === 'wallet' ? 'wallet' : 'pos';
  }, [location.search]);
  const [filters, setFilters] = useState(() => buildBaseFilters(today));
  const [selectedUser, setSelectedUser] = useState(null);
  const [posPage, setPosPage] = useState(1);
  const posPageSize = 200;
  const [mobilePosSearchField, setMobilePosSearchField] = useState('cardHolderName');
  const [isExporting, setIsExporting] = useState(false);
  const [expandedTxnId, setExpandedTxnId] = useState(null);

  const canSelectUser = ['admin', 'employee'].includes(roleBase);
  const userId = currentUser?.id;
  const walletTargetUserId = canSelectUser && selectedUser?.id ? selectedUser.id : userId;
  const activeMobilePosSearch =
    mobilePosSearchOptions.find((option) => option.value === mobilePosSearchField) ||
    mobilePosSearchOptions[0];

  // Query for POS Transaction Report
  const {
    data: posData,
    isLoading: posLoading,
    error: posError,
    refetch: refetchPosReport,
  } = useQuery({
    queryKey: ['posTransactionReport', filters],
    queryFn: () => getAllPosTransactionReport(filters, { limit: posPageSize }),
    enabled: reportType === 'pos',
    refetchInterval: 3000,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    const handleSync = () => {
      refetchPosReport();
    };
    window.addEventListener("userSettlementUpdated", handleSync);
    window.addEventListener("userDailyLimitUpdated", handleSync);
    window.addEventListener("storage", handleSync);

    return () => {
      window.removeEventListener("userSettlementUpdated", handleSync);
      window.removeEventListener("userDailyLimitUpdated", handleSync);
      window.removeEventListener("storage", handleSync);
    };
  }, [refetchPosReport]);

  // Query for All System Users (for Franchise -> Merchant child mapping)
  const { data: allUsersData } = useQuery({
    queryKey: ['allUsersForReports'],
    queryFn: () => AllUsers({ limit: 1000 }),
    staleTime: 30 * 1000,
  });

  const franchiseMerchantsMap = useMemo(() => {
    const map = new Map();
    if (!allUsersData) return map;
    const extractUsers = (data) => {
      if (Array.isArray(data)) return data;
      if (Array.isArray(data?.data)) return data.data;
      if (Array.isArray(data?.users)) return data.users;
      if (Array.isArray(data?.rows)) return data.rows;
      return [];
    };
    const list = extractUsers(allUsersData);
    list.forEach((u) => {
      const pId = String(u.parent_id || u.franchise_id || u.created_by || '');
      if (pId) {
        if (!map.has(pId)) map.set(pId, []);
        map.get(pId).push(u);
      }
    });
    return map;
  }, [allUsersData]);

  // Query for Wallet Transaction Report
  const {
    data: walletData,
    isLoading: walletLoading,
    error: walletError,
  } = useQuery({
    queryKey: ['walletReport', walletTargetUserId, filters],
    queryFn: () => getWalletReport(walletTargetUserId, filters),
    enabled: reportType === 'wallet' && !!walletTargetUserId && !!filters.startDate && !!filters.endDate,
  });

  const handleUserSelect = (user) => {
    setSelectedUser(user);
    if (reportType === 'pos') {
      setPosPage(1);
    }
    setFilters((prev) => ({
      ...prev,
      userSearch: user ? (user.name || user.abheepay_id || user.mobile_number || user.id) : '',
      userId: user ? user.id : '',
    }));
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    if (reportType === 'pos') {
      setPosPage(1);
    }
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  useEffect(() => {
    setMobilePosSearchField('cardHolderName');
    setPosPage(1);
    setFilters({
      ...buildBaseFilters(reportType === 'pos' ? today : ''),
      startDate: reportType === 'pos' ? today : '',
      endDate: reportType === 'pos' ? today : '',
    });
  }, [reportType, today]);

  const handleMobilePosSearchFieldChange = (field) => {
    setMobilePosSearchField(field);
    setFilters((prev) => ({
      ...prev,
      cardHolderName: field === 'cardHolderName' ? prev.cardHolderName : '',
      cardNumber: field === 'cardNumber' ? prev.cardNumber : '',
      posTxnNo: field === 'posTxnNo' ? prev.posTxnNo : '',
      deviceNo: field === 'deviceNo' ? prev.deviceNo : '',
    }));
  };

  const handleExportToExcel = async () => {
    let data = [];
    let fileName = '';

    if (reportType === 'pos') {
      try {
        setIsExporting(true);
        const allTransactions = Array.isArray(posData)
          ? posData
          : await getAllPosTransactionReport(filters, { limit: posPageSize });
        data = allTransactions.map((txn) => ({
        ID: txn.id,
        'Date & Time': txn.posting_date ? new Date(txn.posting_date).toLocaleString() : '',
        'User Name': txn.user?.name || '',
        'Franchise Name': txn.franchise_name || txn.franchise?.name || '',
        'User ID': txn.user?.id || '',
        'Transaction ID': txn.txn_id,
        MID: txn.mid,
        TID: txn.tid,
        'Card Holder Name': getRowCardHolderName(txn),
        'Card Number': getRowCardNumber(txn),
        'Auth Code': txn.authCode || txn.auth_code || '',
        'RR No.': txn.rrNumber || txn.rr_number || '',
        Amount: txn.amount,
        MDR: txn.mdr ?? '',
        'MDR %': txn.mdr_percent ?? txn.mdrPercent ?? '',
        'Net Credit': txn.net_credit ?? txn.netCredit ?? '',
        Status: txn.status,
        Source: getSourceLabel(getRowSource(txn)),
        'Settlement Type': getSettlementTypeLabel(txn, franchiseMerchantsMap),
        'Payment Card Type': txn.paymentCardType || txn.payment_card_type || '',
        'Card Brand': txn.payment_card_brand,
        'Card Classification': getRowCardClassification(txn),
      }));
        fileName = 'PosTransactionReport.xlsx';
      } catch (exportError) {
        toast.error(exportError?.message || 'Failed to export POS report');
        return;
      } finally {
        setIsExporting(false);
      }
    } else if (reportType === 'wallet' && walletData?.data) {
      data = walletData.data.map((txn) => ({
        ID: txn.id,
        Date: new Date(txn.date_and_time).toLocaleString(),
        UTR: txn.utr_no,
        Description: txn.description,
        Debit: txn.debit,
        Credit: txn.credit,
        Balance: txn.balance,
        Status: txn.status,
      }));
      fileName = 'WalletTransactionReport.xlsx';
    }

    if (data.length === 0) {
      toast.warn('No data to export');
      return;
    }

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Report');
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/octet-stream' });
    saveAs(blob, fileName);

    toast.success('Report exported to Excel');
  };

  // Define table columns based on report type
  const posColumns = [
    {
      header: '#',
      key: 'id',
      width: '72px',
      headerClassName: 'text-center',
      cellClassName: 'text-center font-medium whitespace-nowrap',
    },
    {
      header: 'Date & Time',
      key: 'posting_date',
      width: '150px',
      cellClassName: 'whitespace-normal text-gray-700',
      render: (dt) => {
        if (!dt) return '-';
        const date = new Date(dt);
        return (
          <div className="leading-5">
            <div>{date.toLocaleDateString()}</div>
            <div className="text-xs text-gray-500">{date.toLocaleTimeString()}</div>
          </div>
        );
      },
    },
    {
      header: 'User',
      key: 'user',
      width: '240px',
      cellClassName: 'whitespace-normal',
      render: (u) => (
        <div className="min-w-[12rem] max-w-[16rem]">
          <div className="whitespace-normal break-words font-medium text-gray-900">
            {u?.name || '-'}
          </div>
          <div className="text-xs text-gray-500">
            {u?.mobile_number || u?.id || ''}
          </div>
        </div>
      ),
    },
    {
      header: 'Txn ID',
      key: 'txn_id',
      width: '260px',
      cellClassName: 'whitespace-nowrap',
    },
    {
      header: 'Card Holder Name',
      key: 'card_holder_name',
      width: '220px',
      cellClassName: 'whitespace-nowrap',
      render: (_val, row) => getRowCardHolderName(row) || '-',
    },
    {
      header: 'Card Number',
      key: 'card_number',
      width: '180px',
      cellClassName: 'whitespace-nowrap',
      render: (_val, row) => getRowCardNumber(row) || '-',
    },
    {
      header: 'MID',
      key: 'mid',
      width: '160px',
      cellClassName: 'whitespace-nowrap',
    },
    {
      header: 'TID',
      key: 'tid',
      width: '140px',
      cellClassName: 'whitespace-nowrap',
    },
    {
      header: 'Amount',
      key: 'amount',
      width: '130px',
      headerClassName: 'text-right',
      cellClassName: 'whitespace-nowrap text-right tabular-nums',
      render: (amt) => amt ? parseFloat(amt).toLocaleString('en-IN') : '-',
    },
    {
      header: 'Status',
      key: 'status',
      width: '140px',
      headerClassName: 'text-center',
      cellClassName: 'whitespace-nowrap text-center',
    },
    {
      header: 'Source',
      key: 'source',
      width: '120px',
      headerClassName: 'text-center',
      cellClassName: 'whitespace-nowrap text-center',
      render: (_val, row) => getSourceLabel(getRowSource(row)),
    },
    {
      header: 'Settlement Type',
      key: 'settlement_type',
      width: '160px',
      headerClassName: 'text-center',
      cellClassName: 'whitespace-nowrap text-center font-medium',
      render: (_val, row) => {
        const label = getSettlementTypeLabel(row, franchiseMerchantsMap);
        if (label === 'T+0') {
          return <span className="inline-flex items-center rounded-full bg-cyan-50 border border-cyan-200 px-2.5 py-1 text-xs font-semibold text-cyan-800">T+0 (Same-Day)</span>;
        }
        if (label === 'T+1') {
          return <span className="inline-flex items-center rounded-full bg-amber-50 border border-amber-200 px-2.5 py-1 text-xs font-semibold text-amber-700">T+1 (On Hold)</span>;
        }
        return <span className="text-gray-400">-</span>;
      },
    },
    {
      header: 'Card Brand',
      key: 'payment_card_brand',
      width: '160px',
      headerClassName: 'text-center',
      cellClassName: 'whitespace-nowrap text-center',
    },
    {
      header: 'Card Classification',
      key: 'cardClassification',
      width: '180px',
      headerClassName: 'text-center',
      cellClassName: 'whitespace-nowrap text-center',
      render: (_val, row) => getRowCardClassification(row) || '-',
    },
  ];

  const walletColumns = [
    { header: 'ID', key: 'id' },
    {
      header: 'Date & Time',
      key: 'date_and_time',
      render: (date) => new Date(date).toLocaleString(),
    },
    { header: 'UTR No', key: 'utr_no' },
    { header: 'Description', key: 'description' },
    { header: 'Debit', key: 'debit' },
    { header: 'Credit', key: 'credit' },
    { header: 'Balance', key: 'balance' },
    {
      header: 'Status',
      key: 'status',
      render: (status) => (
        <span
          className={`px-2 py-1 rounded-full text-sm ${status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
            }`}
        >
          {status}
        </span>
      ),
    },
  ];

  const posRows = useMemo(() => {
    let raw = reportType === 'pos' ? (Array.isArray(posData) ? posData : []) : [];
    if (!raw.length) return [];

    const uQuery = (filters.userSearch || '').toLowerCase().trim();
    const chNameQuery = (filters.cardHolderName || '').toLowerCase().trim();
    const cNumQuery = (filters.cardNumber || '').toLowerCase().trim();
    const txnNoQuery = (filters.posTxnNo || '').toLowerCase().trim();
    const devNoQuery = (filters.deviceNo || '').toLowerCase().trim();
    const srcQuery = (filters.source || '').toLowerCase().trim();
    const stlQuery = (filters.settlementType || '').toLowerCase().trim();
    const cClassQuery = (filters.cardClassification || '').toLowerCase().trim();
    const statusQuery = (filters.status || '').toLowerCase().trim();

    return raw.filter((row) => {
      if (uQuery) {
        const name = String(row?.user?.name || '').toLowerCase();
        const mobile = String(row?.user?.mobile_number || '').toLowerCase();
        const uId = String(row?.user_id || row?.user?.id || '').toLowerCase();
        const abheeId = String(row?.user?.abheepay_id || '').toLowerCase();
        if (!name.includes(uQuery) && !mobile.includes(uQuery) && !uId.includes(uQuery) && !abheeId.includes(uQuery)) {
          return false;
        }
      }
      if (chNameQuery) {
        const cardHolder = String(getRowCardHolderName(row) || '').toLowerCase();
        if (!cardHolder.includes(chNameQuery)) return false;
      }
      if (cNumQuery) {
        const cardNum = String(getRowCardNumber(row) || '').toLowerCase();
        if (!cardNum.includes(cNumQuery)) return false;
      }
      if (txnNoQuery) {
        const txnId = String(row?.txn_id || '').toLowerCase();
        if (!txnId.includes(txnNoQuery)) return false;
      }
      if (devNoQuery) {
        const devNo = String(row?.device_serial || '').toLowerCase();
        if (!devNo.includes(devNoQuery)) return false;
      }
      if (srcQuery) {
        const src = String(row?.source || '').toLowerCase();
        if (!src.includes(srcQuery)) return false;
      }
      if (stlQuery) {
        const stl = String(row?.settlement_type || '').toLowerCase();
        if (stlQuery === 'today_settlement' && stl !== 'today_settlement') return false;
        if (stlQuery === 'next_day_settlement' && stl !== 'next_day_settlement') return false;
      }
      if (cClassQuery) {
        const cClass = String(getRowCardClassification(row) || '').toLowerCase();
        if (!cClass.includes(cClassQuery)) return false;
      }
      if (statusQuery) {
        const st = String(row?.status || '').toLowerCase();
        if (st !== statusQuery) return false;
      }
      return true;
    });
  }, [posData, reportType, filters]);
  const walletRows = reportType === 'wallet' ? walletData?.data || [] : [];
  const data = reportType === 'pos' ? posRows : walletRows;
  const posTotalRows = reportType === 'pos' ? posRows.length : 0;
  const posTotalPages = reportType === 'pos' ? Math.max(1, Math.ceil(posTotalRows / posPageSize)) : 1;
  const posPageSafe = reportType === 'pos' ? Math.min(Math.max(posPage, 1), posTotalPages) : 1;
  const pagedPosData = useMemo(() => {
    if (reportType !== 'pos') return data;
    const startIndex = (posPageSafe - 1) * posPageSize;
    return data.slice(startIndex, startIndex + posPageSize);
  }, [data, posPageSafe, posPageSize, reportType]);
  const posStart = posTotalRows > 0 ? (posPageSafe - 1) * posPageSize + 1 : 0;
  const posEnd = posTotalRows > 0 ? Math.min(posPageSafe * posPageSize, posTotalRows) : 0;
  const columns = reportType === 'pos' ? posColumns : walletColumns;
  const isLoading = reportType === 'pos' ? posLoading : walletLoading;
  const error = reportType === 'pos' ? posError : walletError;

  return (
    <div className="min-h-screen bg-transparent px-0 py-1 sm:bg-gray-100 sm:p-6">
      <h1 className="mb-5 text-2xl font-bold text-gray-800">Reports</h1>
      <ReportTabs
        basePath={reportsBasePath}
        activeTab={reportType}
        trailingAction={<CombinedReportDownloadButton />}
      />


      {reportType && (
        <div className="rounded-2xl bg-white p-4 shadow-sm md:rounded-lg md:p-6 md:shadow-md">
          <div className="mb-5 space-y-3 md:hidden">
            {reportType === 'pos' ? (
              <>
                <div className="grid grid-cols-3 gap-2">
                  <div className="min-w-0">
                    <label className="mb-1 block text-xs font-medium text-gray-700">Start Date</label>
                    <input
                      type="date"
                      name="startDate"
                      value={filters.startDate}
                      onChange={handleFilterChange}
                      className={compactInputClassName}
                    />
                  </div>
                  <div className="min-w-0">
                    <label className="mb-1 block text-xs font-medium text-gray-700">End Date</label>
                    <input
                      type="date"
                      name="endDate"
                      value={filters.endDate}
                      onChange={handleFilterChange}
                      className={compactInputClassName}
                    />
                  </div>
                  <div className="min-w-0">
                    <label className="mb-1 block text-xs font-medium text-gray-700">Status</label>
                    <select
                      name="status"
                      value={filters.status}
                      onChange={handleFilterChange}
                      className={compactInputClassName}
                    >
                      <option value="">All</option>
                      <option value="completed">Completed</option>
                      <option value="failed">Failed</option>
                    </select>
                  </div>
                </div>

                <div className="rounded-xl border border-gray-100 bg-gray-50/80 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Search by</p>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
                    {mobilePosSearchOptions.map((option) => (
                      <label
                        key={option.value}
                        className="inline-flex items-center gap-2 text-sm font-medium text-gray-700"
                      >
                        <input
                          type="radio"
                          name="mobilePosSearchField"
                          value={option.value}
                          checked={mobilePosSearchField === option.value}
                          onChange={() => handleMobilePosSearchFieldChange(option.value)}
                          className="h-4 w-4 accent-[#00D3CD]"
                        />
                        <span>{option.radioLabel}</span>
                      </label>
                    ))}
                  </div>

                  <div className="mt-3">
                    {mobilePosSearchField === 'userSearch' && canSelectUser ? (
                      <UserSelectWithSuggestions
                        selectedUser={selectedUser}
                        onSelectUser={handleUserSelect}
                        label={activeMobilePosSearch.inputLabel}
                      />
                    ) : (
                      <>
                        <label className="mb-1 block text-sm font-medium text-gray-700">
                          {activeMobilePosSearch.inputLabel}
                        </label>
                        <input
                          type="text"
                          name={mobilePosSearchField}
                          value={filters[mobilePosSearchField]}
                          onChange={handleFilterChange}
                          className={inputClassName}
                          placeholder={activeMobilePosSearch.placeholder}
                        />
                      </>
                    )}
                  </div>
                  <div className="mt-3 grid grid-cols-1 gap-2">
                    <input
                      type="text"
                      name="source"
                      value={filters.source}
                      onChange={handleFilterChange}
                      className={inputClassName}
                      placeholder="Source"
                    />
                    <select
                      name="settlementType"
                      value={filters.settlementType || ''}
                      onChange={handleFilterChange}
                      className={inputClassName}
                    >
                      <option value="">All Settlement Types</option>
                      <option value="today_settlement">T+0 (Today Settlement)</option>
                      <option value="next_day_settlement">T+1 (Next Day Settlement)</option>
                    </select>
                    <input
                      type="text"
                      name="cardClassification"
                      value={filters.cardClassification}
                      onChange={handleFilterChange}
                      className={inputClassName}
                      placeholder="Card Classification"
                    />
                  </div>
                </div>

              </>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div className="min-w-0">
                    <label className="mb-1 block text-xs font-medium text-gray-700">Start Date</label>
                    <input
                      type="date"
                      name="startDate"
                      value={filters.startDate}
                      onChange={handleFilterChange}
                      className={compactInputClassName}
                    />
                  </div>
                  <div className="min-w-0">
                    <label className="mb-1 block text-xs font-medium text-gray-700">End Date</label>
                    <input
                      type="date"
                      name="endDate"
                      value={filters.endDate}
                      onChange={handleFilterChange}
                      className={compactInputClassName}
                    />
                  </div>
                </div>
                {canSelectUser && (
                  <UserSelectWithSuggestions
                    selectedUser={selectedUser}
                    onSelectUser={handleUserSelect}
                    label="Select User"
                  />
                )}
              </div>
            )}
          </div>

          <div className="mb-6 hidden gap-4 md:grid md:grid-cols-2 xl:grid-cols-3">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Start Date</label>
              <input
                type="date"
                name="startDate"
                value={filters.startDate}
                onChange={handleFilterChange}
                className={inputClassName}
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">End Date</label>
              <input
                type="date"
                name="endDate"
                value={filters.endDate}
                onChange={handleFilterChange}
                className={inputClassName}
              />
            </div>
            {canSelectUser && reportType === 'wallet' && (
              <div>
                <UserSelectWithSuggestions
                  selectedUser={selectedUser}
                  onSelectUser={handleUserSelect}
                  label="Select User"
                />
              </div>
            )}
            {reportType === 'pos' && (
              <>
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">Status</label>
                  <select
                    name="status"
                    value={filters.status}
                    onChange={handleFilterChange}
                    className={inputClassName}
                  >
                    <option value="">All</option>
                    <option value="completed">Completed</option>
                    <option value="failed">Failed</option>
                  </select>
                </div>
                <div>
                  {canSelectUser ? (
                    <UserSelectWithSuggestions
                      selectedUser={selectedUser}
                      onSelectUser={handleUserSelect}
                      label="Select User"
                    />
                  ) : (
                    <>
                      <label className="mb-2 block text-sm font-medium text-gray-700">User (ID / Name / Mobile)</label>
                      <input
                        type="text"
                        name="userSearch"
                        value={filters.userSearch || ''}
                        onChange={handleFilterChange}
                        className={inputClassName}
                        placeholder="Enter ID, Name, or Mobile"
                      />
                    </>
                  )}
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">Card Holder Name</label>
                  <input
                    type="text"
                    name="cardHolderName"
                    value={filters.cardHolderName}
                    onChange={handleFilterChange}
                    className={inputClassName}
                    placeholder="Enter card holder name"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">Card Number</label>
                  <input
                    type="text"
                    name="cardNumber"
                    value={filters.cardNumber}
                    onChange={handleFilterChange}
                    className={inputClassName}
                    placeholder="Enter card number"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">POS Txn No</label>
                  <input
                    type="text"
                    name="posTxnNo"
                    value={filters.posTxnNo}
                    onChange={handleFilterChange}
                    className={inputClassName}
                    placeholder="Enter POS Txn No"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">Device No</label>
                  <input
                    type="text"
                    name="deviceNo"
                    value={filters.deviceNo}
                    onChange={handleFilterChange}
                    className={inputClassName}
                    placeholder="Enter Device No"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">Source</label>
                  <input
                    type="text"
                    name="source"
                    value={filters.source}
                    onChange={handleFilterChange}
                    className={inputClassName}
                    placeholder="agro_axis, agro_hdfc, etc."
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">Settlement Type</label>
                  <select
                    name="settlementType"
                    value={filters.settlementType || ''}
                    onChange={handleFilterChange}
                    className={inputClassName}
                  >
                    <option value="">All Settlement Types</option>
                    <option value="today_settlement">T+0 (Today Settlement)</option>
                    <option value="next_day_settlement">T+1 (Next Day Settlement)</option>
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">Card Classification</label>
                  <input
                    type="text"
                    name="cardClassification"
                    value={filters.cardClassification}
                    onChange={handleFilterChange}
                    className={inputClassName}
                    placeholder="Card Classification"
                  />
                </div>
              </>
            )}
          </div>

          <div className="flex justify-end mb-4">
            <button
              onClick={handleExportToExcel}
              disabled={isExporting}
              className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-opacity-90 transition"
            >
              {isExporting ? 'Exporting...' : 'Export to Excel'}
            </button>
          </div>

          {isLoading && <div className="text-center">Loading...</div>}
          {error && <div className="text-center text-red-600">Error: {error.message}</div>}
          {!isLoading && !error && data.length === 0 && (
            <div className="text-center text-gray-500">No data available</div>
          )}
          {!isLoading && !error && data.length > 0 && (
            <>
              {reportType === 'pos' && (
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3 text-sm text-gray-600">
                  <div>
                    Showing {posStart}-{posEnd} of {posTotalRows}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setPosPage((prev) => Math.max(1, prev - 1))}
                      disabled={posPageSafe <= 1}
                      className="rounded-lg border border-gray-200 px-3 py-1 text-sm text-gray-700 disabled:cursor-not-allowed disabled:text-gray-400"
                    >
                      Prev
                    </button>
                    <span className="text-gray-700">
                      Page {posPageSafe} of {posTotalPages}
                    </span>
                    <button
                      type="button"
                      onClick={() => setPosPage((prev) => Math.min(posTotalPages, prev + 1))}
                      disabled={posPageSafe >= posTotalPages}
                      className="rounded-lg border border-gray-200 px-3 py-1 text-sm text-gray-700 disabled:cursor-not-allowed disabled:text-gray-400"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}


{reportType === 'pos' ? (
  <>
    {/* Mobile Cards */}
    <div className="md:hidden space-y-3">
      {pagedPosData.map((txn, index) => {
        const isExpanded = expandedTxnId === (txn.id || txn.txn_id || index);
        const itemKey = txn.id || txn.txn_id || index;

        return (
          <div
            key={itemKey}
            className="bg-white rounded-2xl border border-gray-200 shadow-md hover:shadow-lg transition-shadow duration-200 overflow-hidden"
          >
            <div className="flex items-start gap-3 p-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setExpandedTxnId(isExpanded ? null : itemKey)}
                    className="min-w-0 text-left hover:opacity-80 transition-opacity flex items-start gap-2"
                  >
                    <div className="flex-1">
                      <p className="text-xs text-gray-400">Name</p>
                      <p className="truncate font-semibold text-gray-900">
                        {txn.user?.name || txn.cardHolderName || txn.card_holder_name || '-'}
                      </p>
                    </div>
                    <ChevronDown className="h-5 w-5 text-gray-500 flex-shrink-0 mt-5" />
                  </button>

                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-semibold ${
                        txn.status === 'completed'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {txn.status || '-'}
                    </span>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-gray-700">
                  <div>
                    <p className="text-gray-500">User</p>
                    <p className="font-medium truncate">{txn.user?.name || '-'}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Amount</p>
                    <p className="font-medium">
                      ₹{Number(txn.amount || 0).toLocaleString('en-IN')}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500">Date</p>
                    <p className="truncate">
                      {txn.posting_date ? new Date(txn.posting_date).toLocaleDateString() : '-'}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500">Time</p>
                    <p className="truncate">
                      {txn.posting_date ? new Date(txn.posting_date).toLocaleTimeString() : '-'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {isExpanded && (
              <div className="border-t border-gray-100 bg-gray-50 p-4 text-sm text-gray-700">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-gray-500">Transaction ID</p>
                    <p className="font-medium truncate">{txn.txn_id || '-'}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">TID</p>
                    <p className="font-medium truncate">{txn.tid || '-'}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Card Brand</p>
                    <p className="font-medium truncate">{txn.payment_card_brand || '-'}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-gray-500">MID</p>
                    <p className="font-medium truncate">{txn.mid || '-'}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>

    {/* Desktop Table */}
    <div className="hidden md:block">
      <StickyPosReportTable columns={columns} data={pagedPosData} />
    </div>
  </>
) : (
  <Table columns={columns} data={data} />
)}



            </>
          )}
        </div>
      )}

      <ToastContainer
        position="top-right"
        autoClose={5000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="light"
      />
    </div>
  );
};

export default Reports;
