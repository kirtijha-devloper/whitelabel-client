import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'react-router-dom';
import { Download, RefreshCcw, Loader2 } from 'lucide-react';
import { getAllCCBillPaymentReport, getPayoutReport } from '../api/reportsApi';
import { getAllBillAvenuePayments, getBillAvenueCcBill3PaymentById } from '../api/billAvenueApi';
import { checkBranchXPayoutStatus, getBranchXPayoutAuditLogsByPayout, manualBranchXPayoutRefund } from '../api/branchxApi';
import { checkSevenPayPayoutStatus, getSevenPayPayoutAuditLogsByPayout, manualSevenPayPayoutRefund } from '../api/sevenpayApi';
import { checkMxPayoutStatus, getMxPayoutAuditLogsByPayout, manualMxPayoutRefund } from '../api/mxPayoutApi';
import { checkNdia5DebugStatus, manualNdia5PayoutRefund, getNdia5PayoutAuditLogsByPayout } from '../api/ndia5Api';
import { checkVimoPayoutStatus, failVimoPayout, getVimoPayoutAuditLogsByReference } from '../api/vimoApi';
import { fetchUserDetails } from '../api/authApi';
import Table from '../components/Table';
import Modal from '../components/Modal';
import { toast } from 'react-toastify';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import ReportTabs from '../components/Reports/ReportTabs';
import UserSelectWithSuggestions from '../components/Reports/UserSelectWithSuggestions';

const inputClassName =
  'w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent';
const compactInputClassName =
  'w-full rounded-lg border border-gray-200 bg-white px-2 py-2 text-xs focus:ring-2 focus:ring-indigo-500 focus:border-transparent';

const formatCurrency = (value, minimumFractionDigits = 2) =>
  `${'\u20B9'}${parseFloat(value || 0).toLocaleString('en-IN', { minimumFractionDigits })}`;

const formatPayoutDate = (value) => {
  if (!value) return '-';
  const d = new Date(value);
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

const formatPayoutDateOnly = (value) => {
  if (!value) return '-';
  const d = new Date(value);
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

const formatPayoutTimeOnly = (value) => {
  if (!value) return '-';
  const d = new Date(value);
  return d.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
};

const formatDateTime = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
};

const VIMO_FAIL_MINUTES = 10;
const VIMO_FAIL_WINDOW_MS = VIMO_FAIL_MINUTES * 60 * 1000;
const BRANCHX_MANUAL_REFUND_MINUTES = 10;
const BRANCHX_MANUAL_REFUND_WINDOW_MS = BRANCHX_MANUAL_REFUND_MINUTES * 60 * 1000;
const BRANCHX_MANUAL_REFUND_CUTOFF_DATE = new Date('2026-04-26T00:00:00Z');
const PAYOUT_EXPORT_FETCH_LIMIT = 200;
const COMBINED_EXPORT_FETCH_LIMIT = 200;
const CC_BILL_SUCCESS_STATUS_CODES = new Set(['TXN', 'TUP']);
const CC_BILL_PENDING_STATUS_CODES = new Set(['PEN', 'PENDING', 'PROCESSING', 'INP', 'INIT', 'INITIATED']);

const getNormalizedPayoutStatusKey = (status) => {
  const normalized = String(status || '').trim().toUpperCase();
  if (!normalized) return '';
  if (normalized === 'COMPLETED') return 'SUCCESS';
  if (normalized === 'PROCESSING' || normalized === 'IN_PROGRESS' || normalized === 'INPROCESS') {
    return 'PENDING';
  }
  return normalized;
};

const normalizePayoutStatus = (status) => getNormalizedPayoutStatusKey(status) || '-';

const getStatusBadgeClass = (status) => {
  const normalized = normalizePayoutStatus(status);
  if (normalized === 'SUCCESS') return 'bg-green-100 text-green-700';
  if (normalized === 'PENDING') return 'bg-yellow-100 text-yellow-700';
  return 'bg-red-100 text-red-700';
};

const normalizePayoutProvider = (provider) => String(provider || '').trim().toLowerCase();
const getNormalizedPayoutProviderKey = (rowOrProvider) => {
  const row = rowOrProvider && typeof rowOrProvider === 'object' ? rowOrProvider : null;
  const provider = normalizePayoutProvider(row ? row?.payout_provider : rowOrProvider);
  const referenceId = String(row?.reference_id || row?.referenceId || '').trim().toUpperCase();

  if (provider.includes('branchx')) return 'branchx';
  if (provider.includes('sevenpay')) return 'sevenpay';
  if (provider.includes('ndia5')) return 'ndia5_payout';
  if (provider.includes('vimo')) return 'vimo';
  if (provider.includes('credxpay')) return 'credxpay';
  if (provider.includes('payout-m-x') || provider.includes('mx') || provider.includes('merorecharge')) return 'mx_payout';

  if (referenceId.startsWith('APB')) return 'branchx';
  if (referenceId.startsWith('APS')) return 'sevenpay';
  if (referenceId.startsWith('APN')) return 'ndia5_payout';
  if (referenceId.startsWith('APV')) return 'vimo';
  if (referenceId.startsWith('APC') || referenceId.startsWith('PX')) return 'credxpay';
  if (referenceId.startsWith('APM')) return 'mx_payout';

  return provider;
};
const isBranchXPayout = (rowOrProvider) => getNormalizedPayoutProviderKey(rowOrProvider) === 'branchx';
const isSevenPayPayout = (rowOrProvider) => getNormalizedPayoutProviderKey(rowOrProvider) === 'sevenpay';
const isNdia5Payout = (rowOrProvider) => getNormalizedPayoutProviderKey(rowOrProvider) === 'ndia5_payout';
const isVimoPayout = (rowOrProvider) => getNormalizedPayoutProviderKey(rowOrProvider) === 'vimo';
const isMxPayout = (rowOrProvider) => getNormalizedPayoutProviderKey(rowOrProvider) === 'mx_payout';

const getMxLocalRequestId = (row) => {
  if (!row?.data) return null;
  try {
    const parsed = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
    return parsed?.localRequestId || null;
  } catch (_) {
    return null;
  }
};

const normalizeReportText = (value) => String(value || '').trim().toLowerCase();

const isCcBill3Payout = (row = {}) => {
  const providerKey = getNormalizedPayoutProviderKey(row);
  if (['branchx', 'sevenpay', 'vimo', 'credxpay', 'mx_payout', 'ndia5_payout'].includes(providerKey)) {
    return false;
  }

  const searchableValues = [
    row?.purpose,
    row?.remarks,
    row?.remark,
    row?.description,
    row?.narration,
    row?.note,
    row?.beneficiary?.beneficiary_name,
    row?.beneficiary?.name,
    row?.beneficiary_name,
    row?.beneficiaryName,
    row?.metadata?.purpose,
    row?.metadata?.description,
    row?.details?.purpose,
    row?.details?.description,
    row?.details?.beneficiaryName,
  ]
    .map(normalizeReportText)
    .filter(Boolean);

  return searchableValues.some(
    (value) =>
      value.includes('cc bill') ||
      value.includes('credit card bill') ||
      value.includes('bill payment')
  );
};

const getVisibleCcBill3ProviderLabel = (row, { isAdmin = false } = {}) => {
  if (isAdmin || !isCcBill3Payout(row)) {
    return row?.payout_provider || 'Legacy';
  }

  return 'CC Bill 3';
};

const getCcBill3StatusRecordId = (row = {}) =>
  row?.payment_id ||
  row?.paymentId ||
  row?.cc_bill_3_payment_id ||
  row?.ccBill3PaymentId ||
  row?.metadata?.payment_id ||
  row?.metadata?.paymentId ||
  row?.metadata?.cc_bill_3_payment_id ||
  row?.metadata?.ccBill3PaymentId ||
  row?.details?.payment_id ||
  row?.details?.paymentId ||
  row?.details?.cc_bill_3_payment_id ||
  row?.details?.ccBill3PaymentId ||
  row?.id ||
  null;

const normalizeCcBill3StatusResult = (payload) => {
  const source =
    payload?.data?.payment ||
    payload?.data?.data ||
    payload?.data ||
    payload?.payment ||
    payload ||
    {};

  const normalizedStatus = String(
    source?.status ||
      source?.paymentStatus ||
      source?.txnStatus ||
      source?.transactionStatus ||
      ''
  )
    .trim()
    .toUpperCase();

  const status =
    normalizedStatus === 'SUCCESS' || normalizedStatus === 'FAILED'
      ? normalizedStatus
      : 'PROCESSING';

  return {
    status,
    message:
      String(source?.message || source?.statusMessage || payload?.message || '').trim() ||
      (status === 'SUCCESS'
        ? 'Payment completed successfully'
        : status === 'FAILED'
          ? 'Payment failed'
          : 'Waiting for bank callback'),
    referenceId: String(
      source?.referenceId ||
        source?.transactionRefId ||
        source?.txnReferenceId ||
        source?.bankReferenceId ||
        source?.rrn ||
        ''
    ).trim(),
    raw: payload,
  };
};

const parseRowTimestamp = (row) => {
  const candidates = [
    row?.processing_since,
    row?.processingSince,
    row?.updated_at,
    row?.updatedAt,
    row?.created_at,
    row?.createdAt,
    row?.date,
  ];

  for (const value of candidates) {
    if (!value) continue;
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  return null;
};

const getPayoutCreatedAt = (row) => {
  const createdCandidates = [row.created_at, row.createdAt, row.date];
  for (const value of createdCandidates) {
    if (!value) continue;
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }
  return null;
};

const getBranchXManualRefundEligibility = (row) => {
  if (!isBranchXPayout(row)) return { canShow: false, ageMs: null, createdOnOrAfter: false, identifier: null };
  const normalized = normalizePayoutStatus(row.status);
  const timestamp = parseRowTimestamp(row);
  const ageMs = timestamp ? Date.now() - timestamp.getTime() : null;
  const createdAt = getPayoutCreatedAt(row);
  const createdOnOrAfter = createdAt ? createdAt >= BRANCHX_MANUAL_REFUND_CUTOFF_DATE : false;
  const identifier = row.reference_id || extractRequestId(row) || row.id;
  const hasBeenRefunded = row.is_refunded === true;
  return {
    canShow:
      normalized === 'PENDING' &&
      !hasBeenRefunded &&
      ageMs != null &&
      ageMs >= BRANCHX_MANUAL_REFUND_WINDOW_MS &&
      createdOnOrAfter &&
      Boolean(identifier),
    ageMs,
    createdOnOrAfter,
    identifier,
  };
};

const getSevenPayStatusCheckEligibility = (row) => {
  if (!isSevenPayPayout(row)) return { canShow: false, identifier: null };
  const identifier = row.reference_id || extractRequestId(row) || row.id;

  return {
    canShow: Boolean(identifier),
    identifier,
  };
};

const getSevenPayManualRefundEligibility = (row) => {
  if (!isSevenPayPayout(row)) return { canShow: false, identifier: null };
  const normalized = normalizePayoutStatus(row.status);
  const identifier = row.reference_id || extractRequestId(row) || row.id;

  let hasBeenRefunded = row.is_refunded === true;
  if (!hasBeenRefunded && row.data) {
    try {
      const parsedData = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
      if (parsedData?.manualRefund) {
        hasBeenRefunded = true;
      }
    } catch (e) {}
  }

  return {
    canShow: normalized === 'FAILED' && !hasBeenRefunded && Boolean(identifier),
    identifier,
  };
};

const getMxStatusCheckEligibility = (row) => {
  if (!isMxPayout(row)) return { canShow: false, identifier: null };
  const identifier = row.reference_id || extractRequestId(row) || row.id;

  return {
    canShow: Boolean(identifier),
    identifier,
  };
};

const getNdia5StatusCheckEligibility = (row) => {
  if (!isNdia5Payout(row)) return { canShow: false, identifier: null };
  const identifier = row.reference_id || extractRequestId(row) || row.id;

  return {
    canShow: Boolean(identifier),
    identifier,
  };
};

const getMxManualRefundEligibility = (row) => {
  if (!isMxPayout(row)) return { canShow: false, identifier: null };
  const normalized = normalizePayoutStatus(row.status);
  const identifier = row.reference_id || extractRequestId(row) || row.id;

  let hasBeenRefunded = row.is_refunded === true;
  if (!hasBeenRefunded && row.data) {
    try {
      const parsedData = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
      if (parsedData?.manualRefund) {
        hasBeenRefunded = true;
      }
    } catch (e) {}
  }

  return {
    canShow: normalized === 'FAILED' && !hasBeenRefunded && Boolean(identifier),
    identifier,
  };
};

const getNdia5ManualRefundEligibility = (row) => {
  if (!isNdia5Payout(row)) return { canShow: false, identifier: null };
  const normalized = normalizePayoutStatus(row.status);
  const identifier = row.reference_id || extractRequestId(row) || row.id;

  let hasBeenRefunded = row.is_refunded === true;
  if (!hasBeenRefunded && row.data) {
    try {
      const parsedData = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
      if (parsedData?.manualRefund) {
        hasBeenRefunded = true;
      }
    } catch (e) {}
  }

  return {
    canShow: normalized === 'FAILED' && !hasBeenRefunded && Boolean(identifier),
    identifier,
  };
};

const buildBranchXReferencePayload = (row) => {
  const referenceId = row.reference_id || extractRequestId(row) || row.id;
  if (referenceId) {
    return { reference_id: referenceId };
  }

  const error = new Error('reference_id is required');
  error.status = 400;
  throw error;
};

const buildSevenPayReferencePayload = (row) => {
  const referenceId = row.reference_id || extractRequestId(row) || row.id;
  if (referenceId) {
    return { reference_id: referenceId };
  }

  const error = new Error('reference_id is required');
  error.status = 400;
  throw error;
};

const buildMxReferencePayload = (row) => {
  const referenceId = row.reference_id || extractRequestId(row) || row.id;
  if (referenceId) {
    return { reference_id: referenceId };
  }

  const error = new Error('reference_id is required');
  error.status = 400;
  throw error;
};

const buildNdia5ReferencePayload = (row) => {
  const referenceId = row.reference_id || extractRequestId(row) || row.id;
  if (referenceId) {
    return { reference_id: referenceId };
  }

  const error = new Error('reference_id is required');
  error.status = 400;
  throw error;
};

const getBranchXReferenceId = (row) =>
  row?.reference_id || extractRequestId(row) || row?.id || null;

const getVimoReferenceId = (row) =>
  row?.reference_id || row?.merchantRefId || row?.referenceId || null;

const getVimoTxnId = (row) => {
  if (!row) return null;
  if (row.txnId) return row.txnId;
  if (row.txn_id) return row.txn_id;
  if (row.data) {
    try {
      const parsedData = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
      return (
        parsedData?.txnId ||
        parsedData?.txn_id ||
        parsedData?.sanitizedResponse?.txnId ||
        parsedData?.sanitizedResponse?.txn_id ||
        parsedData?.decryptedResponse?.data?.txnId ||
        parsedData?.data?.txnId ||
        null
      );
    } catch (e) {
      // ignore
    }
  }
  return null;
};

const getPayoutRrn = (row) =>
  row?.rrn ||
  row?.RRN ||
  row?.bank_rrn ||
  row?.bankRrn ||
  row?.response_rrn ||
  row?.responseRrn ||
  row?.details?.rrn ||
  row?.details?.RRN ||
  null;

const getPayoutUtr = (row) =>
  row?.utr ||
  row?.UTR ||
  row?.utr_no ||
  row?.utrNo ||
  row?.bank_utr ||
  row?.bankUtr ||
  row?.details?.utr ||
  row?.details?.UTR ||
  null;

const getBranchXRawStatus = (response) => {
  if (!response?.data || typeof response.data !== 'object') return null;
  const rawStatus = response.data.status || response.data.Status;
  return rawStatus ? String(rawStatus).trim().toUpperCase() : null;
};

const isBranchXRawFailed = (response) => {
  return getBranchXRawStatus(response) === 'FAILED';
};

const getBranchXEffectiveStatus = (response) => {
  const branchxStatus = String(response?.branchxStatus || response?.status || '').trim().toUpperCase();
  if (branchxStatus === 'UNKNOWN' && isBranchXRawFailed(response)) {
    return 'FAILED';
  }
  return branchxStatus || null;
};

const isPendingLikePayoutStatus = (status) => {
  const raw = String(status || '').trim().toUpperCase();
  const normalized = normalizePayoutStatus(status);
  return normalized === 'PENDING' || raw === 'PROCESSING';
};

const getVimoFailEligibility = (row) => {
  const isEligibleStatus = isPendingLikePayoutStatus(row?.status);
  const timestamp = parseRowTimestamp(row);
  const ageMs = timestamp ? Date.now() - timestamp.getTime() : null;
  const hasTenMinutesElapsed = ageMs == null ? true : ageMs >= VIMO_FAIL_WINDOW_MS;

  return {
    canShow:
      isVimoPayout(row) &&
      isEligibleStatus &&
      hasTenMinutesElapsed &&
      Boolean(getVimoReferenceId(row)),
    hasTenMinutesElapsed,
    ageMs,
  };
};

const getVimoTooSoonMessage = () =>
  `This payout can only be failed after ${VIMO_FAIL_MINUTES} minutes in Processing state.`;

const fetchAllPayoutReportRows = async (filters = {}) => {
  const firstResponse = await getPayoutReport({
    ...filters,
    page: 1,
    limit: PAYOUT_EXPORT_FETCH_LIMIT,
  });

  const firstRows = Array.isArray(firstResponse?.data) ? firstResponse.data : [];
  const totalPages = Number(firstResponse?.pagination?.totalPages || 1);

  if (totalPages <= 1) {
    return firstRows;
  }

  const remainingPages = await Promise.all(
    Array.from({ length: totalPages - 1 }, (_, index) => {
      const page = index + 2;
      return getPayoutReport({
        ...filters,
        page,
        limit: PAYOUT_EXPORT_FETCH_LIMIT,
      }).then((response) => (Array.isArray(response?.data) ? response.data : []));
    })
  );

  return [firstRows, ...remainingPages].flat();
};

const mapPayoutRowsToExport = (rows = [], startIndex = 1) =>
  rows.map((row, idx) => ({
    '#': startIndex + idx,
    'Date': formatPayoutDate(row.date),
    'Merchant ID': row.merchant_id,
    'Merchant Name': row.merchant?.name || '',
    'Merchant Mobile': row.merchant?.mobile_number || '',
    'Reference ID': row.reference_id,
    'RRN': getPayoutRrn(row) || '-',
    'Payout Provider': row.payout_provider || 'Legacy',
    'Beneficiary Name': row.beneficiary?.beneficiary_name || '',
    'Account Number': row.beneficiary?.account_number || '',
    'Bank': row.beneficiary?.bank_name || '',
    'IFSC': row.beneficiary?.ifsc_code || '',
    'Beneficiary Mobile': row.beneficiary?.mobile_number || '',
    'Amount (Rs)': parseFloat(row.amount || 0).toFixed(2),
    'Service Charge (Rs)': parseFloat(row.service_charge || 0).toFixed(2),
    'Total Deducted (Rs)': parseFloat(row.total_deducted || 0).toFixed(2),
    'Purpose': row.purpose,
    'Status': normalizePayoutStatus(row.status),
    'Balance Before (Rs)': parseFloat(row.balance_before || 0).toFixed(2),
    'Balance After (Rs)': parseFloat(row.balance_after || 0).toFixed(2),
  }));

const getNormalizedCcBillStatus = (txn = {}) => {
  const statusCode = String(txn?.statuscode || '').trim().toUpperCase();
  const statusText = String(txn?.status || '').trim().toLowerCase();

  if (CC_BILL_SUCCESS_STATUS_CODES.has(statusCode) || statusText.includes('success')) {
    return 'SUCCESS';
  }

  if (
    CC_BILL_PENDING_STATUS_CODES.has(statusCode) ||
    /(pending|processing|initiated|in progress|queued)/.test(statusText)
  ) {
    return 'PENDING';
  }

  return 'FAILED';
};

const mapCcBillRowsToExport = (rows = [], startIndex = 1) =>
  rows.map((txn, index) => ({
    '#': startIndex + index,
    'Date & Time': formatDateTime(txn.date || txn.date_and_time),
    'User Name': txn.user?.name || '-',
    'User ID': txn.user?.abheepay_id || txn.user?.id || '',
    'Order ID': txn.external_ref || txn.utr_no || '-',
    'Description': txn.description || '',
    'Amount (Rs)': parseFloat(txn.amount || txn.debit || 0).toFixed(2),
    'Closing Balance (Rs)': parseFloat(txn.balance_after ?? txn.balance ?? 0).toFixed(2),
    'Status': getNormalizedCcBillStatus(txn),
  }));

const mapBillAvenueRowsToExport = (rows = [], startIndex = 1) =>
  rows.map((row, index) => ({
    '#': startIndex + index,
    'ID': row.id,
    'Date': row.createdAt ? new Date(row.createdAt).toLocaleString('en-IN') : '-',
    'Biller ID': row.biller_id,
    'Customer Params': JSON.stringify(row.customer_params || {}),
    'Amount (Rs)': parseFloat(row.transaction_amount || 0).toFixed(2),
    'Charge (Rs)': parseFloat(row.charge_amount || 0).toFixed(2),
    'Payment Mode': row.payment_mode || '',
    'Transaction Ref ID': row.transaction_ref_id || '',
    'Response Code': row.response_code || '',
    'Status': row.status || '',
  }));

const getSheetRowsOrPlaceholder = (rows = [], mapper) =>
  rows.length > 0 ? mapper(rows) : [{ Message: 'No records found' }];

const buildServerPayoutFilters = (filters = {}, options = {}) => {
  const {
    includeStatus = true,
    includeProvider = true,
  } = options;

  const nextFilters = { ...filters };

  if (!includeStatus) {
    delete nextFilters.status;
  }

  if (!includeProvider) {
    delete nextFilters.payout_provider;
  }

  return nextFilters;
};

const formatLogTime = (date = new Date()) =>
  date.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

const renderKeyValue = (label, value) => {
  if (value == null || value === '') return null;
  return (
    <div>
      <p className="text-xs uppercase text-gray-500">{label}</p>
      <p className="mt-1 text-gray-900">{String(value)}</p>
    </div>
  );
};

const extractRequestId = (entity) => {
  if (!entity) return null;
  if (entity.request_id) return entity.request_id;
  if (entity.requestId) return entity.requestId;
  if (entity.reference_id) return entity.reference_id;
  if (entity.referenceId) return entity.referenceId;
  const details = entity.details || {};
  return (
    details.requestId ||
    details.request_id ||
    details.reference_id ||
    details.branchxResponse?.data?.requestId ||
    null
  );
};

const PayoutMobileCard = ({
  row,
  canFilterByUser,
  isExpanded,
  onToggle,
  isAdmin,
  canShowCcBill3StatusAction,
  canShowVimoFailAction,
  canShowBranchXManualRefundAction,
  canShowSevenPayRefundAction,
  canShowSevenPayStatusCheckAction,
  canShowMxRefundAction,
  canShowMxStatusCheckAction,
  canShowNdia5RefundAction,
  canShowNdia5StatusCheckAction,
  onCheckCcBill3Status,
  onMarkVimoFailed,
  onVimoStatusCheck,
  onBranchXStatusCheck,
  onBranchXManualRefund,
  onSevenPayRefund,
  onSevenPayStatusCheck,
  onMxRefund,
  onMxStatusCheck,
  onNdia5Refund,
  onNdia5StatusCheck,
  onOpenAuditLog,
  isActionPending,
}) => {
  const normalizedStatus = normalizePayoutStatus(row.status);

  return (
  <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Date</p>
        <p className="mt-1 text-sm font-semibold text-gray-900">{formatPayoutDate(row.date)}</p>
      </div>
      <span
        className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusBadgeClass(
          normalizedStatus
        )}`}
      >
        {normalizedStatus}
      </span>
    </div>

    <div className="mt-3 grid grid-cols-3 gap-2">
      <div className="rounded-xl bg-gray-50 p-3">
        <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500">Amount</p>
        <p className="mt-1 text-sm font-semibold text-gray-900">{formatCurrency(row.amount)}</p>
      </div>
      <div className="rounded-xl bg-gray-50 p-3">
        <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500">Debit</p>
        <p className="mt-1 text-sm font-semibold text-red-600">{formatCurrency(row.total_deducted)}</p>
      </div>
      <div className="rounded-xl bg-gray-50 p-3">
        <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500">Bal. After</p>
        <p className="mt-1 text-sm font-semibold text-gray-900">{formatCurrency(row.balance_after)}</p>
      </div>
    </div>

    {isExpanded && (
      <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
        {canFilterByUser && (
          <div className="rounded-xl bg-gray-50 p-3 col-span-2">
            <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500">Merchant</p>
            <p className="mt-1 font-semibold text-gray-900">{row.merchant?.name || `ID: ${row.merchant_id}`}</p>
            <p className="text-xs text-gray-500">{row.merchant?.mobile_number || ''}</p>
          </div>
        )}
        <div className="rounded-xl bg-gray-50 p-3">
          <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500">Ref ID</p>
          <p className="mt-1 break-all font-semibold text-gray-900">{row.reference_id || '-'}</p>
          {getNormalizedPayoutProviderKey(row) === 'mx_payout' && getMxLocalRequestId(row) && (
            <p className="mt-1 break-all text-xs font-semibold text-[#00D3CD]">{getMxLocalRequestId(row)}</p>
          )}
        </div>
        <div className="rounded-xl bg-gray-50 p-3">
          <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500">Provider</p>
          <p className="mt-1 font-medium text-gray-900">
            {getVisibleCcBill3ProviderLabel(row, { isAdmin })}
          </p>
        </div>
        <div className="rounded-xl bg-gray-50 p-3">
          <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500">RRN</p>
          <p className="mt-1 break-all font-medium text-gray-900">{getPayoutRrn(row) || '-'}</p>
        </div>
        {(isBranchXPayout(row.payout_provider) || isSevenPayPayout(row.payout_provider) || isVimoPayout(row.payout_provider) || isMxPayout(row.payout_provider) || isNdia5Payout(row.payout_provider)) && (extractRequestId(row) || row.merchantRefId || row.referenceId) && (
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Log</p>
            <button
              type="button"
              onClick={() => onOpenAuditLog(row)}
              className="mt-2 inline-flex items-center justify-center rounded-lg bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-200"
            >
              Log
            </button>
          </div>
        )}
        <div className="rounded-xl bg-gray-50 p-3 col-span-2">
          <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500">Beneficiary</p>
          <p className="mt-1 font-semibold text-gray-900">{row.beneficiary?.beneficiary_name || `ID: ${row.beneficiary_id}`}</p>
          <p className="text-xs text-gray-500">{row.beneficiary?.account_number ? `Acc: ${row.beneficiary.account_number}` : ''}</p>
          <p className="text-xs text-gray-500">{row.beneficiary?.bank_name || ''} {row.beneficiary?.ifsc_code ? `· ${row.beneficiary.ifsc_code}` : ''}</p>
        </div>
        <div className="rounded-xl bg-gray-50 p-3">
          <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500">Service Charge</p>
          <p className="mt-1 font-medium text-gray-900">{formatCurrency(row.service_charge)}</p>
        </div>
        <div className="rounded-xl bg-gray-50 p-3">
          <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500">Bal. Before</p>
          <p className="mt-1 font-medium text-gray-900">{formatCurrency(row.balance_before)}</p>
        </div>
        <div className="rounded-xl bg-gray-50 p-3">
          <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500">Purpose</p>
          <p className="mt-1 font-medium text-gray-900">{row.purpose || '-'}</p>
        </div>
        {isAdmin && canShowBranchXManualRefundAction ? (
          <div className="col-span-2 rounded-xl border border-red-200 bg-red-50 p-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-red-600">BranchX Action</p>
            <div className="mt-2 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => onBranchXStatusCheck(row)}
                disabled={isActionPending}
                title="Run status check to verify latest BranchX status."
                className="inline-flex w-full items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isActionPending ? 'Checking...' : 'Check Status'}
              </button>
              {/*
              <button
                type="button"
                onClick={() => onBranchXManualRefund(row)}
                disabled={isActionPending}
                title="Run status check first. Refund is allowed only when BranchX status is FAILED."
                className="inline-flex w-full items-center justify-center rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isActionPending ? 'Processing...' : 'Fail + Refund'}
              </button>
              */}
            </div>
          </div>
        ) : null}
        {isVimoPayout(row) &&
        (canShowCcBill3StatusAction ||
          isPendingLikePayoutStatus(row.status) ||
          (isAdmin && canShowVimoFailAction)) ? (
          <div className="col-span-2 rounded-xl border border-red-200 bg-red-50 p-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-red-600">
              {canShowCcBill3StatusAction && !(isAdmin && canShowVimoFailAction) ? 'Action' : 'Vimo Action'}
            </p>
            <div className="mt-2 flex flex-col gap-2">
              {canShowCcBill3StatusAction ? (
                <button
                  type="button"
                  onClick={() => onCheckCcBill3Status(row)}
                  disabled={isActionPending}
                  className="inline-flex w-full items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isActionPending ? 'Checking...' : 'Check Status'}
                </button>
              ) : isPendingLikePayoutStatus(row.status) ? (
                <button
                  type="button"
                  onClick={() => onVimoStatusCheck(row)}
                  disabled={isActionPending}
                  className="inline-flex w-full items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Check Status
                </button>
              ) : null}
              {isAdmin && canShowVimoFailAction ? (
                <button
                  type="button"
                  onClick={() => onMarkVimoFailed(row)}
                  disabled={isActionPending}
                  className="inline-flex w-full items-center justify-center rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isActionPending ? 'Processing...' : 'Mark Failed'}
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
        {isAdmin && (canShowSevenPayRefundAction || canShowSevenPayStatusCheckAction) ? (
          <div className="col-span-2 rounded-xl border border-orange-200 bg-orange-50 p-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-orange-600">SevenPay Action</p>
            <div className="mt-2 flex flex-col gap-2">
              {canShowSevenPayStatusCheckAction && (
                <button
                  type="button"
                  onClick={() => onSevenPayStatusCheck(row)}
                  disabled={isActionPending}
                  className="inline-flex w-full items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isActionPending ? 'Checking...' : 'Check Status'}
                </button>
              )}
              {canShowSevenPayRefundAction && (
                <button
                  type="button"
                  onClick={() => onSevenPayRefund(row)}
                  disabled={isActionPending}
                  className="inline-flex w-full items-center justify-center rounded-lg bg-orange-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isActionPending ? 'Processing...' : 'Refund'}
                </button>
              )}
            </div>
          </div>
        ) : null}
        {isAdmin && (canShowMxRefundAction || canShowMxStatusCheckAction) ? (
          <div className="col-span-2 rounded-xl border border-cyan-200 bg-cyan-50 p-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-cyan-600">Payout MX Action</p>
            <div className="mt-2 flex flex-col gap-2">
              {canShowMxStatusCheckAction && (
                <button
                  type="button"
                  onClick={() => onMxStatusCheck(row)}
                  disabled={isActionPending}
                  className="inline-flex w-full items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isActionPending ? 'Checking...' : 'Check Status'}
                </button>
              )}
              {canShowMxRefundAction && (
                <button
                  type="button"
                  onClick={() => onMxRefund(row)}
                  disabled={isActionPending}
                  className="inline-flex w-full items-center justify-center rounded-lg bg-cyan-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isActionPending ? 'Processing...' : 'Refund'}
                </button>
              )}
            </div>
          </div>
        ) : null}
        {isAdmin && (canShowNdia5RefundAction || canShowNdia5StatusCheckAction) ? (
          <div className="col-span-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-amber-600">NDIA5 Action</p>
            <div className="mt-2 flex flex-col gap-2">
              {canShowNdia5StatusCheckAction && (
                <button
                  type="button"
                  onClick={() => onNdia5StatusCheck(row)}
                  disabled={isActionPending}
                  className="inline-flex w-full items-center justify-center rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm font-semibold text-amber-700 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isActionPending ? 'Checking...' : 'Check Status'}
                </button>
              )}
              {canShowNdia5RefundAction && (
                <button
                  type="button"
                  onClick={() => onNdia5Refund(row)}
                  disabled={isActionPending}
                  className="inline-flex w-full items-center justify-center rounded-lg bg-amber-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isActionPending ? 'Processing...' : 'Refund'}
                </button>
              )}
            </div>
          </div>
        ) : null}
      </div>
    )}

    <button
      type="button"
      onClick={onToggle}
      className="mt-3 text-sm font-semibold text-[#00D3CD] transition hover:opacity-80"
    >
      {isExpanded ? 'View less' : 'View more'}
    </button>
  </div>
  );
};

const PayoutReport = ({ reportVariant = 'payout' }) => {
  const location = useLocation();
  const isCcBill3Report = reportVariant === 'cc-bill-3';

  const isFranchise = location.pathname.startsWith('/franchise');
  const isMerchant = location.pathname.startsWith('/merchant');
  const canFilterByUser = !isMerchant; // admin and franchise can filter by merchant user_id
  const canSelectUserSuggestions = location.pathname.startsWith('/admin') || location.pathname.startsWith('/employee');
  const reportsBasePath = isFranchise
    ? '/franchise/reports'
    : isMerchant
      ? '/merchant/reports'
      : '/admin/reports';

  const today = new Date().toISOString().split('T')[0];
  const [selectedUser, setSelectedUser] = useState(null);

  const [filters, setFilters] = useState({
    from_date: today,
    to_date: today,
    user_id: '',
    status: '',
    payout_provider: isCcBill3Report ? 'vimo' : '',
    page: 1,
    limit: 50,
  });

  const handleUserSelect = (user) => {
    setSelectedUser(user);
    setFilters((prev) => ({
      ...prev,
      user_id: user ? user.id : '',
      page: 1,
    }));
  };
  const [expandedRows, setExpandedRows] = useState({});
  const [manualProcessRunning, setManualProcessRunning] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [combinedExportModalOpen, setCombinedExportModalOpen] = useState(false);
  const [combinedExportFilters, setCombinedExportFilters] = useState({
    from_date: today,
    to_date: today,
  });
  const [isCombinedExporting, setIsCombinedExporting] = useState(false);
  const [auditModalOpen, setAuditModalOpen] = useState(false);
  const [auditRequestId, setAuditRequestId] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditLogCount, setAuditLogCount] = useState(null);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState(null);
  const [vimoFailModalOpen, setVimoFailModalOpen] = useState(false);
  const [selectedVimoRow, setSelectedVimoRow] = useState(null);
  const [selectedCcBill3StatusRow, setSelectedCcBill3StatusRow] = useState(null);
  const [branchXRefundModalOpen, setBranchXRefundModalOpen] = useState(false);
  const [selectedBranchXRefundRow, setSelectedBranchXRefundRow] = useState(null);
  const [branchXStatusModalOpen, setBranchXStatusModalOpen] = useState(false);
  const [selectedBranchXStatusRow, setSelectedBranchXStatusRow] = useState(null);
  const [branchXStatusResponse, setBranchXStatusResponse] = useState(null);
  const [branchXStatusError, setBranchXStatusError] = useState(null);
  const [branchXRefundConfirmed, setBranchXRefundConfirmed] = useState(false);
  const [sevenPayRefundModalOpen, setSevenPayRefundModalOpen] = useState(false);
  const [selectedSevenPayRefundRow, setSelectedSevenPayRefundRow] = useState(null);
  const [sevenPayRefundConfirmed, setSevenPayRefundConfirmed] = useState(false);
  const [sevenPayStatusModalOpen, setSevenPayStatusModalOpen] = useState(false);
  const [selectedSevenPayStatusRow, setSelectedSevenPayStatusRow] = useState(null);
  const [sevenPayStatusResponse, setSevenPayStatusResponse] = useState(null);
  const [sevenPayStatusError, setSevenPayStatusError] = useState(null);
  const [mxRefundModalOpen, setMxRefundModalOpen] = useState(false);
  const [selectedMxRefundRow, setSelectedMxRefundRow] = useState(null);
  const [mxRefundConfirmed, setMxRefundConfirmed] = useState(false);
  const [ndia5RefundModalOpen, setNdia5RefundModalOpen] = useState(false);
  const [selectedNdia5RefundRow, setSelectedNdia5RefundRow] = useState(null);
  const [ndia5RefundConfirmed, setNdia5RefundConfirmed] = useState(false);
  const [mxStatusModalOpen, setMxStatusModalOpen] = useState(false);
  const [selectedMxStatusRow, setSelectedMxStatusRow] = useState(null);
  const [mxStatusResponse, setMxStatusResponse] = useState(null);
  const [mxStatusError, setMxStatusError] = useState(null);
  const [vimoStatusModalOpen, setVimoStatusModalOpen] = useState(false);
  const [selectedVimoStatusRow, setSelectedVimoStatusRow] = useState(null);
  const [vimoStatusResponse, setVimoStatusResponse] = useState(null);
  const [vimoStatusError, setVimoStatusError] = useState(null);
  const [vimoStatusRequestPayload, setVimoStatusRequestPayload] = useState(null);
  
  const [ndia5StatusModalOpen, setNdia5StatusModalOpen] = useState(false);
  const [selectedNdia5StatusRow, setSelectedNdia5StatusRow] = useState(null);
  const [ndia5StatusResponse, setNdia5StatusResponse] = useState(null);
  const [ndia5StatusError, setNdia5StatusError] = useState(null);

  const queryClient = useQueryClient();
  const isAdmin = location.pathname.startsWith('/admin');

  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: fetchUserDetails,
    staleTime: 5 * 60 * 1000,
    cacheTime: 10 * 60 * 1000,
  });

  const isVimoFailAuthorizedEmployee = (user) => {
    const userId = String(user?.user_id ?? user?.username ?? user?.userId ?? '').trim();
    return ['APE00002', 'APE00003'].includes(userId);
  };

  const canUserMarkVimoFail = isAdmin || isVimoFailAuthorizedEmployee(currentUser);

  const openAuditModal = async (row) => {
    const provider = normalizePayoutProvider(row.payout_provider);
    const payoutId = row.payout_id || row.id || null;
    const requestId = extractRequestId(row);
    const vimoReferenceId = getVimoReferenceId(row);
    let params = null;
    let fetchAuditLogs = null;

    if (isBranchXPayout(provider) || isSevenPayPayout(provider) || isMxPayout(provider) || isNdia5Payout(provider)) {
      params = payoutId
        ? {
            payout_id: payoutId,
            ...(filters.from_date ? { fromDate: filters.from_date } : {}),
            ...(filters.to_date ? { toDate: filters.to_date } : {}),
          }
        : requestId
        ? {
            requestId,
            ...(filters.from_date ? { fromDate: filters.from_date } : {}),
            ...(filters.to_date ? { toDate: filters.to_date } : {}),
          }
        : null;
      fetchAuditLogs = isSevenPayPayout(provider)
        ? getSevenPayPayoutAuditLogsByPayout
        : isMxPayout(provider)
        ? getMxPayoutAuditLogsByPayout
        : isNdia5Payout(provider)
        ? getNdia5PayoutAuditLogsByPayout
        : getBranchXPayoutAuditLogsByPayout;
    } else if (isVimoPayout(provider)) {
      params = vimoReferenceId
        ? { reference_id: vimoReferenceId }
        : row.merchantRefId
        ? { merchantRefId: row.merchantRefId }
        : row.referenceId
        ? { referenceId: row.referenceId }
        : null;
      fetchAuditLogs = getVimoPayoutAuditLogsByReference;
    }

    if (!params || !fetchAuditLogs) {
      toast.error('Payout identifier is required to load audit logs.');
      return;
    }

    setAuditRequestId(requestId || vimoReferenceId || `Payout ${payoutId || row.id || 'Unknown'}`);
    setAuditModalOpen(true);
    setAuditLoading(true);
    setAuditError(null);
    setAuditLogs([]);
    setAuditLogCount(null);

    try {
      const result = await fetchAuditLogs(params);
      setAuditLogCount(Number(result?.totalLogs ?? (Array.isArray(result?.data) ? result.data.length : 0)));
      setAuditLogs(Array.isArray(result?.data) ? result.data : []);
    } catch (error) {
      if (Number(error?.status) === 404) {
        setAuditError(error?.response?.data?.message || 'No audit logs found for this payout.');
      } else {
        setAuditError(error?.message || 'Failed to load audit logs.');
      }
    } finally {
      setAuditLoading(false);
    }
  };

  const closeAuditModal = () => {
    setAuditModalOpen(false);
    setAuditRequestId(null);
    setAuditLogs([]);
    setAuditLogCount(null);
    setAuditError(null);
  };

  const closeVimoFailModal = () => {
    setVimoFailModalOpen(false);
    setSelectedVimoRow(null);
  };

  const openCcBill3StatusCheck = (row) => {
    const paymentId = getCcBill3StatusRecordId(row);
    if (!paymentId) {
      toast.error('CC Bill 3 payment ID is required for status check.');
      return;
    }

    setSelectedCcBill3StatusRow(row);
    ccBill3StatusCheckMutation.mutate(row);
  };

  const openBranchXRefundConfirmation = (row) => {
    if (!canUserMarkVimoFail) {
      toast.error('You are not authorized to perform BranchX manual refunds.');
      return;
    }

    const eligibility = getBranchXManualRefundEligibility(row);
    if (!eligibility.canShow) {
      toast.info(
        'Manual refund is available only for BranchX payouts in Processing/Pending for more than 10 minutes and created on or after 2026-04-26.'
      );
      return;
    }

    setSelectedBranchXRefundRow(row);
    setBranchXRefundModalOpen(true);
  };

  const closeBranchXRefundModal = () => {
    setBranchXRefundModalOpen(false);
    setSelectedBranchXRefundRow(null);
    setBranchXRefundConfirmed(false);
  };

  const openSevenPayRefundConfirmation = (row) => {
    if (!isAdmin) {
      toast.error('Only admin can perform SevenPay refunds.');
      return;
    }

    const eligibility = getSevenPayManualRefundEligibility(row);
    if (!eligibility.canShow) {
      toast.info('Refund is available only for SevenPay payouts with FAILED status.');
      return;
    }

    setSelectedSevenPayRefundRow(row);
    setSevenPayRefundModalOpen(true);
  };

  const closeSevenPayRefundModal = () => {
    setSevenPayRefundModalOpen(false);
    setSelectedSevenPayRefundRow(null);
    setSevenPayRefundConfirmed(false);
  };

  const openSevenPayStatusCheck = (row) => {
    if (!isAdmin) {
      toast.error('Only admin can perform SevenPay status check.');
      return;
    }

    const eligibility = getSevenPayStatusCheckEligibility(row);
    if (!eligibility.canShow) {
      toast.info('Status check is not available for this transaction.');
      return;
    }

    setSelectedSevenPayStatusRow(row);
    setSevenPayStatusModalOpen(true);
    setSevenPayStatusResponse(null);
    setSevenPayStatusError(null);
    sevenPayStatusCheckMutation.mutate(row);
  };

  const closeSevenPayStatusModal = () => {
    setSevenPayStatusModalOpen(false);
  };

  const openMxStatusCheck = (row) => {
    if (!isAdmin) {
      toast.error('Only admin can perform Payout MX status check.');
      return;
    }

    const eligibility = getMxStatusCheckEligibility(row);
    if (!eligibility.canShow) {
      toast.info('Status check is not available for this transaction.');
      return;
    }

    setSelectedMxStatusRow(row);
    setMxStatusModalOpen(true);
    setMxStatusResponse(null);
    setMxStatusError(null);
    mxStatusCheckMutation.mutate(row);
  };

  const closeMxStatusModal = () => {
    setMxStatusModalOpen(false);
  };

  const openNdia5StatusCheck = (row) => {
    if (!isAdmin) {
      toast.error('Only admin can perform NDIA5 debug status check.');
      return;
    }
    setSelectedNdia5StatusRow(row);
    setNdia5StatusModalOpen(true);
    setNdia5StatusResponse(null);
    setNdia5StatusError(null);
    ndia5StatusCheckMutation.mutate(row);
  };

  const closeNdia5StatusModal = () => {
    setNdia5StatusModalOpen(false);
  };

  const openNdia5RefundConfirmation = (row) => {
    if (!isAdmin) {
      toast.error('Only admin can perform NDIA5 refunds.');
      return;
    }

    const eligibility = getNdia5ManualRefundEligibility(row);
    if (!eligibility.canShow) {
      toast.info('Refund is available only for NDIA5 payouts with FAILED status.');
      return;
    }

    setSelectedNdia5RefundRow(row);
    setNdia5RefundModalOpen(true);
    setNdia5RefundConfirmed(false);
  };

  const closeNdia5RefundModal = () => {
    setNdia5RefundModalOpen(false);
    setSelectedNdia5RefundRow(null);
    setNdia5RefundConfirmed(false);
  };

  const openMxRefundConfirmation = (row) => {
    if (!isAdmin) {
      toast.error('Only admin can perform Payout MX refunds.');
      return;
    }

    const eligibility = getMxManualRefundEligibility(row);
    if (!eligibility.canShow) {
      toast.info('Refund is available only for Payout MX payouts with FAILED status.');
      return;
    }

    setSelectedMxRefundRow(row);
    setMxRefundModalOpen(true);
    setMxRefundConfirmed(false);
  };

  const closeMxRefundModal = () => {
    setMxRefundModalOpen(false);
    setSelectedMxRefundRow(null);
    setMxRefundConfirmed(false);
  };

  const openBranchXStatusModal = (row) => {
    if (!canUserMarkVimoFail) {
      toast.error('You are not authorized to perform BranchX manual refunds.');
      return;
    }

    const eligibility = getBranchXManualRefundEligibility(row);
    if (!eligibility.canShow) {
      toast.info(
        'Manual refund is available only for BranchX payouts in Processing/Pending for more than 10 minutes and created on or after 2026-04-26.'
      );
      return;
    }

    setSelectedBranchXStatusRow(row);
    setBranchXStatusModalOpen(true);
    setBranchXStatusResponse(null);
    setBranchXStatusError(null);
    branchXStatusCheckMutation.mutate(row);
  };

  const closeBranchXStatusModal = () => {
    setBranchXStatusModalOpen(false);
  };

  const openVimoStatusModal = (row) => {
    setSelectedVimoStatusRow(row);
    setVimoStatusModalOpen(true);
    setVimoStatusResponse(null);
    setVimoStatusError(null);
    setVimoStatusRequestPayload(null);
    vimoStatusCheckMutation.mutate(row);
  };

  const closeVimoStatusModal = () => {
    setVimoStatusModalOpen(false);
  };

  const sortedAuditLogs = [...auditLogs].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

  const activeProviderFilter = getNormalizedPayoutProviderKey(filters.payout_provider);
  const activeStatusFilter = getNormalizedPayoutStatusKey(filters.status);
  const useClientSideFiltering = Boolean(activeProviderFilter || activeStatusFilter || isCcBill3Report);
  const serverFilters = useClientSideFiltering
    ? buildServerPayoutFilters(filters, {
        includeStatus: false,
        includeProvider: false,
      })
    : filters;
  const reportQueryFilters = useClientSideFiltering
    ? {
        ...serverFilters,
        page: 'all',
        limit: filters.limit,
        client_status: activeStatusFilter,
        client_provider: activeProviderFilter,
        report_variant: reportVariant,
      }
    : filters;

  const { data: reportResponse, isLoading, isError } = useQuery({
    queryKey: ['payoutReport', reportQueryFilters],
    queryFn: () =>
      useClientSideFiltering
        ? fetchAllPayoutReportRows(serverFilters)
        : getPayoutReport(filters),
    keepPreviousData: true,
  });

  const reportRows = Array.isArray(reportResponse)
    ? reportResponse
    : reportResponse?.data || [];
  const filteredRows = reportRows.filter((row) => {
    if (isCcBill3Report && !isCcBill3Payout(row)) {
      return false;
    }

    if (!isCcBill3Report && isCcBill3Payout(row)) {
      return false;
    }

    if (activeStatusFilter && getNormalizedPayoutStatusKey(row.status) !== activeStatusFilter) {
      return false;
    }

    if (activeProviderFilter && getNormalizedPayoutProviderKey(row) !== activeProviderFilter) {
      return false;
    }

    return true;
  });
  const pageLimit = Math.max(Number(filters.limit) || 1, 1);
  const localTotalPages = Math.max(1, Math.ceil(filteredRows.length / pageLimit));
  const currentPage = Math.min(Math.max(Number(filters.page) || 1, 1), localTotalPages);
  const visibleRows = useClientSideFiltering
    ? filteredRows.slice((currentPage - 1) * pageLimit, currentPage * pageLimit)
    : filteredRows;
  const pagination = useClientSideFiltering
    ? {
        total: filteredRows.length,
        page: currentPage,
        limit: pageLimit,
        totalPages: localTotalPages,
      }
    : reportResponse?.pagination || { total: 0, page: 1, limit: 50, totalPages: 1 };
  const totalCount = filteredRows.length;
  const pendingBranchxRows = visibleRows.filter(
    (row) => normalizePayoutStatus(row.status) === 'PENDING' && isBranchXPayout(row)
  );
  const reportTitle = isCcBill3Report ? 'CC Bill 3 Report' : 'Payout Report';
  const activeTab = isCcBill3Report ? 'cc-bill-3' : 'payout';

  const selectedVimoReferenceId = getVimoReferenceId(selectedVimoRow);

  const failVimoMutation = useMutation({
    mutationFn: (referenceId) => failVimoPayout({ reference_id: referenceId }),
    onSuccess: async (data) => {
      const refundAmount = data?.refundAmount;
      toast.success(
        refundAmount != null
          ? `Vimo payout marked failed. Refund processed: Rs. ${refundAmount}`
          : data?.message || 'Vimo payout marked failed successfully.'
      );
      closeVimoFailModal();
      await queryClient.invalidateQueries(['payoutReport']);
      await queryClient.invalidateQueries(['currentUser']);
    },
    onError: async (error) => {
      const message = error?.message || 'Failed to mark Vimo payout as failed';
      const status = Number(error?.status || error?.response?.status || 0);

      if (status === 400 && /10 minutes/i.test(message)) {
        toast.info(getVimoTooSoonMessage());
        return;
      }

      if (status === 400 && /reference_id|merchantRefId/i.test(message)) {
        toast.error('Unable to mark payout failed because the payout reference is missing.');
        console.error('[vimo-admin-fail] invalid payload', {
          reference_id: selectedVimoReferenceId,
          message,
        });
        return;
      }

      if (status === 403) {
        toast.error('Admin access required.');
        return;
      }

      if (status === 404) {
        toast.info(message || 'Payout state changed. Refreshing the latest status.');
        closeVimoFailModal();
        await queryClient.invalidateQueries(['payoutReport']);
        return;
      }

      if (status === 409) {
        toast.info(message || 'Payout status changed. Refreshing the latest status.');
        closeVimoFailModal();
        await queryClient.invalidateQueries(['payoutReport']);
        return;
      }

      toast.error(message || 'Failed to mark Vimo payout as failed');
    },
  });

  const vimoStatusCheckMutation = useMutation({
    mutationFn: async (row) => {
      const referenceId = getVimoReferenceId(row);
      const txnId = getVimoTxnId(row);
      if (!referenceId && !txnId) throw new Error('Vimo Reference ID or Txn ID is missing');
      
      const payload = {};
      // Prioritize txnId: if txnId is present, pass ONLY txnId so backend falls back to it.
      if (txnId) {
        payload.txnId = txnId;
      } else {
        payload.merchantRefId = referenceId;
      }
      
      setVimoStatusRequestPayload(payload);
      return await checkVimoPayoutStatus(payload);
    },
    onSuccess: (data) => {
      setVimoStatusResponse(data);
      setVimoStatusError(null);
      toast.success(data?.message || 'Vimo status check completed successfully.');
    },
    onError: (error) => {
      setVimoStatusError(error?.message || 'Failed to check Vimo status');
      setVimoStatusResponse(null);
    },
  });

  const ccBill3StatusCheckMutation = useMutation({
    mutationFn: async (row) => {
      const paymentId = getCcBill3StatusRecordId(row);
      if (!paymentId) {
        const error = new Error('CC Bill 3 payment ID is required');
        error.status = 400;
        throw error;
      }

      return await getBillAvenueCcBill3PaymentById(paymentId);
    },
    onSuccess: async (data) => {
      const result = normalizeCcBill3StatusResult(data);
      const statusLabel =
        result.status === 'PROCESSING' ? 'PENDING' : result.status;

      toast[result.status === 'SUCCESS' ? 'success' : result.status === 'FAILED' ? 'error' : 'info'](
        result.referenceId
          ? `${statusLabel}: ${result.message} | Ref: ${result.referenceId}`
          : `${statusLabel}: ${result.message}`
      );

      await queryClient.invalidateQueries(['payoutReport']);
    },
    onError: (error) => {
      toast.error(error?.message || 'Failed to check CC Bill 3 status');
    },
  });

  const branchXStatusCheckMutation = useMutation({
    mutationFn: async (row) => {
      const statusPayload = buildBranchXReferencePayload(row);
      return await checkBranchXPayoutStatus(statusPayload);
    },
    onSuccess: async (data) => {
      setBranchXStatusResponse(data);
      setBranchXStatusError(null);
      const effectiveStatus = getBranchXEffectiveStatus(data);
      if (effectiveStatus === 'SUCCESS' || effectiveStatus === 'PENDING') {
        toast.success(data?.message || 'Status check completed successfully');
        await queryClient.invalidateQueries(['payoutReport']);
      } else if (effectiveStatus === 'FAILED') {
        toast.info(data?.message || 'BranchX status check completed: FAILED. Manual refund may be issued.');
      } else {
        toast.info(data?.message || 'Status check completed successfully');
      }
    },
    onError: (error) => {
      setBranchXStatusError(error?.message || 'Failed to check BranchX status');
      setBranchXStatusResponse(null);
    },
  });

  const sevenPayStatusCheckMutation = useMutation({
    mutationFn: async (row) => {
      const statusPayload = buildSevenPayReferencePayload(row);
      return await checkSevenPayPayoutStatus(statusPayload);
    },
    onSuccess: async (data) => {
      setSevenPayStatusResponse(data);
      setSevenPayStatusError(null);
      const effectiveStatus = data?.data?.status ? String(data.data.status).toUpperCase() : null;
      if (effectiveStatus === 'SUCCESS') {
        toast.success(data?.message || 'SevenPay status check completed: SUCCESS.');
        await queryClient.invalidateQueries(['payoutReport']);
      } else if (effectiveStatus === 'FAILED') {
        toast.info(data?.message || 'SevenPay status check completed: FAILED.');
        await queryClient.invalidateQueries(['payoutReport']);
      } else {
        toast.info(data?.message || 'SevenPay status check completed successfully.');
      }
    },
    onError: (error) => {
      setSevenPayStatusError(error?.message || 'Failed to check SevenPay status');
      setSevenPayStatusResponse(null);
    },
  });

  const branchXManualRefundMutation = useMutation({
    mutationFn: async (row) => {
      const refundPayload = buildBranchXReferencePayload(row);
      return await manualBranchXPayoutRefund(refundPayload);
    },
    onSuccess: async (data) => {
      if (data?.refundCreated === false) {
        toast.info(data?.message || 'Refund already exists; no action was taken.');
      } else {
        toast.success(data?.message || 'Manual BranchX refund created successfully.');
      }
      closeBranchXRefundModal();
      await queryClient.invalidateQueries(['payoutReport']);
    },
    onError: async (error) => {
      const message = error?.message || 'Failed to issue BranchX manual refund';
      const status = Number(error?.status || error?.response?.status || 0);

      if (status === 400 && /reference_id is required/i.test(message)) {
        toast.error('reference_id is required');
        return;
      }

      if (status === 400 && /stored BranchX status must be FAILED/i.test(message)) {
        toast.error(message);
        return;
      }

      if (status === 400 && /manual refund is allowed only for payouts created on or after/i.test(message)) {
        toast.error('Manual refund is allowed only for payouts created on or after 2026-04-26.');
        return;
      }

      if (status === 403) {
        toast.error('Admin or authorized employee access required');
        return;
      }

      if (status === 404) {
        toast.error(message || 'Payout transaction not found');
        return;
      }

      toast.error(message);
    },
  });

  const sevenPayManualRefundMutation = useMutation({
    mutationFn: async (row) => {
      const refundPayload = buildSevenPayReferencePayload(row);
      return await manualSevenPayPayoutRefund(refundPayload);
    },
    onSuccess: async (data) => {
      if (data?.refundCreated === false) {
        toast.info(data?.message || 'Refund already exists; no action was taken.');
      } else {
        toast.success('Refund processed successfully.');
      }
      closeSevenPayRefundModal();
      await queryClient.invalidateQueries(['payoutReport']);
    },
    onError: async (error) => {
      const message = error?.message || 'Failed to issue SevenPay refund';
      const status = Number(error?.status || error?.response?.status || 0);

      if (status === 400 && /reference_id is required/i.test(message)) {
        toast.error('reference_id is required');
        return;
      }

      if (status === 403) {
        toast.error('Admin access required');
        return;
      }

      if (status === 404) {
        toast.error(message || 'Payout transaction not found');
        return;
      }

      toast.error(message);
    },
  });

  const ndia5StatusCheckMutation = useMutation({
    mutationFn: async (row) => {
      return await checkNdia5DebugStatus({ referenceId: extractRequestId(row) });
    },
    onSuccess: (data) => {
      setNdia5StatusResponse(data);
      setNdia5StatusError(null);
      toast.success(data?.message || 'NDIA5 status check completed.');
    },
    onError: (error) => {
      setNdia5StatusError(error?.message || 'Failed to check NDIA5 status');
      setNdia5StatusResponse(null);
    },
  });

  const mxStatusCheckMutation = useMutation({
    mutationFn: async (row) => {
      const statusPayload = buildMxReferencePayload(row);
      return await checkMxPayoutStatus(statusPayload);
    },
    onSuccess: async (data) => {
      setMxStatusResponse(data);
      setMxStatusError(null);
      const effectiveStatus = data?.status ? String(data.status).toUpperCase() : null;
      if (effectiveStatus === 'SUCCESS') {
        toast.success(data?.message || 'Payout MX status check completed: SUCCESS.');
        await queryClient.invalidateQueries(['payoutReport']);
      } else if (effectiveStatus === 'FAILED') {
        toast.info(data?.message || 'Payout MX status check completed: FAILED.');
        await queryClient.invalidateQueries(['payoutReport']);
      } else {
        toast.info(data?.message || 'Payout MX status check completed successfully.');
      }
    },
    onError: (error) => {
      setMxStatusError(error?.message || 'Failed to check Payout MX status');
      setMxStatusResponse(null);
    },
  });

  const ndia5ManualRefundMutation = useMutation({
    mutationFn: async (row) => {
      const refundPayload = buildNdia5ReferencePayload(row);
      return await manualNdia5PayoutRefund(refundPayload);
    },
    onSuccess: async (data) => {
      if (data?.refundCreated === false) {
        toast.info(data?.message || 'Refund already exists; no action was taken.');
      } else {
        toast.success('Refund processed successfully.');
      }
      closeNdia5RefundModal();
      await queryClient.invalidateQueries(['payoutReport']);
    },
    onError: async (error) => {
      const message = error?.message || 'Failed to issue NDIA5 refund';
      const status = Number(error?.status || error?.response?.status || 0);

      if (status === 400 && /reference_id is required/i.test(message)) {
        toast.error('reference_id is required');
        return;
      }

      if (status === 403) {
        toast.error('Admin access required');
        return;
      }

      if (status === 404) {
        toast.error(message || 'Payout transaction not found');
        return;
      }

      toast.error(message);
    },
  });

  const mxManualRefundMutation = useMutation({
    mutationFn: async (row) => {
      const refundPayload = buildMxReferencePayload(row);
      return await manualMxPayoutRefund(refundPayload);
    },
    onSuccess: async (data) => {
      if (data?.refundCreated === false) {
        toast.info(data?.message || 'Refund already exists; no action was taken.');
      } else {
        toast.success('Refund processed successfully.');
      }
      closeMxRefundModal();
      await queryClient.invalidateQueries(['payoutReport']);
    },
    onError: async (error) => {
      const message = error?.message || 'Failed to issue Payout MX refund';
      const status = Number(error?.status || error?.response?.status || 0);

      if (status === 400 && /reference_id is required/i.test(message)) {
        toast.error('reference_id is required');
        return;
      }

      if (status === 403) {
        toast.error('Admin access required');
        return;
      }

      if (status === 404) {
        toast.error(message || 'Payout transaction not found');
        return;
      }

      toast.error(message);
    },
  });

  const successAmount = filteredRows
    .filter((r) => normalizePayoutStatus(r.status) === 'SUCCESS')
    .reduce((sum, r) => sum + parseFloat(r.amount || 0), 0);
  const pendingAmount = filteredRows
    .filter((r) => normalizePayoutStatus(r.status) === 'PENDING')
    .reduce((sum, r) => sum + parseFloat(r.amount || 0), 0);
  const failedAmount = filteredRows
    .filter((r) => normalizePayoutStatus(r.status) === 'FAILED')
    .reduce((sum, r) => sum + parseFloat(r.amount || 0), 0);
  const totalAmount = filteredRows.reduce((sum, r) => sum + parseFloat(r.total_deducted || 0), 0);

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value, page: 1 }));
  };

  const openCombinedExportModal = () => {
    setCombinedExportFilters({
      from_date: filters.from_date || today,
      to_date: filters.to_date || today,
    });
    setCombinedExportModalOpen(true);
  };

  const closeCombinedExportModal = () => {
    if (isCombinedExporting) return;
    setCombinedExportModalOpen(false);
  };

  const handleCombinedExportFilterChange = (e) => {
    const { name, value } = e.target;
    setCombinedExportFilters((prev) => ({ ...prev, [name]: value }));
  };

  const resetFilters = () => {
    setFilters({
      from_date: today,
      to_date: today,
      user_id: '',
      status: '',
      payout_provider: isCcBill3Report ? 'vimo' : '',
      page: 1,
      limit: 50,
    });
  };

  const handlePageChange = (newPage) => {
    setFilters(prev => ({ ...prev, page: newPage }));
  };

  const toggleRowExpansion = (rowKey) => {
    setExpandedRows((prev) => ({
      ...prev,
      [rowKey]: !prev[rowKey],
    }));
  };

  const pushManualLog = (message) => {
    console.log(`[Payout Manual] ${formatLogTime()} | ${message}`);
  };

  const processPendingBranchxManually = async () => {
    if (manualProcessRunning) return;

    if (pendingBranchxRows.length === 0) {
      toast.info('No pending BranchX payouts on the current page.');
      pushManualLog('No pending BranchX payouts found on the current page.');
      return;
    }

    setManualProcessRunning(true);
    pushManualLog(`Starting manual processing for ${pendingBranchxRows.length} pending BranchX payout(s).`);

    let changedSomething = false;

    try {
      for (const [index, row] of pendingBranchxRows.entries()) {
        const seq = `${index + 1}/${pendingBranchxRows.length}`;
        const refId = row.reference_id || row.referenceId || row.merchantRefId || `row-${row.id}`;
        const payload = row.id
          ? { payout_transaction_id: Number(row.id) }
          : row.reference_id
            ? { requestId: row.reference_id }
            : null;

        if (!payload) {
          pushManualLog(`${seq} ref=${refId} skipped: missing payout reference.`);
          continue;
        }

        const startedAt = Date.now();
        pushManualLog(`${seq} ref=${refId} start.`);

        try {
          const res = await checkBranchXPayoutStatus(payload);
          const statusRaw = res?.data?.data?.status || res?.data?.status || 'PENDING';
          const normalizedStatus = String(statusRaw).trim().toUpperCase() || 'PENDING';
          const providerMessage = res?.data?.data?.message || res?.data?.message || 'no message';
          const durationSec = ((Date.now() - startedAt) / 1000).toFixed(2);

          pushManualLog(`${seq} ref=${refId} -> ${normalizedStatus} in ${durationSec}s | ${providerMessage}`);
          changedSomething = true;
        } catch (error) {
          const durationSec = ((Date.now() - startedAt) / 1000).toFixed(2);
          const errorMessage = error?.message || 'request failed';
          pushManualLog(`${seq} ref=${refId} -> ERROR in ${durationSec}s | ${errorMessage}`);
        }
      }

      pushManualLog('Manual processing finished.');
      toast.success(`Manual processing finished for ${pendingBranchxRows.length} payout(s).`);

      await queryClient.invalidateQueries(['payoutReport']);
      if (changedSomething) {
        await queryClient.invalidateQueries(['currentUser']);
      }
    } finally {
      setManualProcessRunning(false);
    }
  };

  const handleExportExcel = async () => {
    if (isExporting) return;

    try {
      setIsExporting(true);

      const allRows = await fetchAllPayoutReportRows(
        buildServerPayoutFilters(filters, {
          includeStatus: false,
          includeProvider: false,
        })
      );
      const filteredRows = allRows.filter((row) => {
        if (isCcBill3Report && !isCcBill3Payout(row)) {
          return false;
        }

        if (!isCcBill3Report && isCcBill3Payout(row)) {
          return false;
        }

        if (activeStatusFilter && getNormalizedPayoutStatusKey(row.status) !== activeStatusFilter) {
          return false;
        }

        if (activeProviderFilter && getNormalizedPayoutProviderKey(row) !== activeProviderFilter) {
          return false;
        }

        return true;
      });

      if (filteredRows.length === 0) {
        toast.warn('No data to export!');
        return;
      }

      const exportData = mapPayoutRowsToExport(filteredRows, 1);
      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(
        workbook,
        worksheet,
        isCcBill3Report ? 'CC_Bill_3_Report' : 'Payout_Report'
      );
      const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
      const dataBlob = new Blob([excelBuffer], { type: 'application/octet-stream' });
      saveAs(
        dataBlob,
        `${isCcBill3Report ? 'CC_Bill_3_Report' : 'Payout_Report'}_${new Date().getTime()}.xlsx`
      );
      toast.success('Export successful!');
    } catch (error) {
      toast.error(error?.message || 'Failed to export payout report');
    } finally {
      setIsExporting(false);
    }
  };

  const handleCombinedExport = async () => {
    if (isCombinedExporting) return;

    const { from_date, to_date } = combinedExportFilters;
    if (!from_date || !to_date) {
      toast.warn('Please select both From Date and To Date.');
      return;
    }

    if (new Date(from_date) > new Date(to_date)) {
      toast.warn('From Date cannot be after To Date.');
      return;
    }

    try {
      setIsCombinedExporting(true);

      const payoutFilters = { from_date, to_date };
      const [allPayoutRows, ccBillRows, billAvenueRows] = await Promise.all([
        fetchAllPayoutReportRows(payoutFilters),
        getAllCCBillPaymentReport(
          {
            startDate: from_date,
            endDate: to_date,
          },
          { limit: COMBINED_EXPORT_FETCH_LIMIT }
        ),
        getAllBillAvenuePayments({}, { limit: COMBINED_EXPORT_FETCH_LIMIT }),
      ]);

      const vimoPayoutRows = allPayoutRows.filter((row) => getNormalizedPayoutProviderKey(row) === 'vimo');
      const sevenPayPayoutRows = allPayoutRows.filter((row) => getNormalizedPayoutProviderKey(row) === 'sevenpay');
      const branchXPayoutRows = allPayoutRows.filter((row) => getNormalizedPayoutProviderKey(row) === 'branchx');
      const mxPayoutRows = allPayoutRows.filter((row) => getNormalizedPayoutProviderKey(row) === 'mx_payout');
      const ccBill3Rows = allPayoutRows.filter((row) => isCcBill3Payout(row));

      const workbookSheets = [
        { name: 'Total_Payout', rawRows: allPayoutRows, exportRows: getSheetRowsOrPlaceholder(allPayoutRows, mapPayoutRowsToExport) },
        { name: 'Vimo_Payout', rawRows: vimoPayoutRows, exportRows: getSheetRowsOrPlaceholder(vimoPayoutRows, mapPayoutRowsToExport) },
        { name: 'CC_Bill_3', rawRows: ccBill3Rows, exportRows: getSheetRowsOrPlaceholder(ccBill3Rows, mapPayoutRowsToExport) },
        { name: 'SevenPay_Payout', rawRows: sevenPayPayoutRows, exportRows: getSheetRowsOrPlaceholder(sevenPayPayoutRows, mapPayoutRowsToExport) },
        { name: 'Branchx_Payout', rawRows: branchXPayoutRows, exportRows: getSheetRowsOrPlaceholder(branchXPayoutRows, mapPayoutRowsToExport) },
        { name: 'Payout_MX_Payout', rawRows: mxPayoutRows, exportRows: getSheetRowsOrPlaceholder(mxPayoutRows, mapPayoutRowsToExport) },
        { name: 'CC_Bill_Payment', rawRows: ccBillRows, exportRows: getSheetRowsOrPlaceholder(ccBillRows, mapCcBillRowsToExport) },
        { name: 'BA_CC_Bill_Payment', rawRows: billAvenueRows, exportRows: getSheetRowsOrPlaceholder(billAvenueRows, mapBillAvenueRowsToExport) },
      ];

      if (workbookSheets.every((sheet) => sheet.rawRows.length === 0)) {
        toast.warn('No data found to export.');
        return;
      }

      const workbook = XLSX.utils.book_new();
      workbookSheets.forEach((sheet) => {
        const worksheet = XLSX.utils.json_to_sheet(sheet.exportRows);
        XLSX.utils.book_append_sheet(workbook, worksheet, sheet.name);
      });

      const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
      const dataBlob = new Blob([excelBuffer], { type: 'application/octet-stream' });
      saveAs(dataBlob, `Combined_Payout_Report_${new Date().getTime()}.xlsx`);
      toast.success('Combined report exported successfully!');
      setCombinedExportModalOpen(false);
    } catch (error) {
      toast.error(error?.message || 'Failed to export combined report');
    } finally {
      setIsCombinedExporting(false);
    }
  };

  const openVimoFailConfirmation = (row) => {
    if (!canUserMarkVimoFail) {
      toast.error('You are not authorized to mark this payout as failed.');
      return;
    }

    const referenceId = getVimoReferenceId(row);
    if (!referenceId) {
      toast.error('Payout reference is required to mark this payout as failed.');
      return;
    }

    const eligibility = getVimoFailEligibility(row);
    if (!eligibility.hasTenMinutesElapsed) {
      toast.info(getVimoTooSoonMessage());
      return;
    }

    setSelectedVimoRow(row);
    setVimoFailModalOpen(true);
  };

  const confirmVimoFail = async () => {
    if (!selectedVimoReferenceId || failVimoMutation.isPending) return;
    await failVimoMutation.mutateAsync(selectedVimoReferenceId);
  };

  const columns = [
    {
      header: '#',
      key: 'id',
      render: (_, row, idx) => (pagination.page - 1) * pagination.limit + idx + 1,
    },
    {
      header: 'Date & Time',
      key: 'date',
      render: (val) => (
        <div className="text-sm leading-tight">
          <div>{formatPayoutDateOnly(val)}</div>
          <div className="text-xs text-slate-500">{formatPayoutTimeOnly(val)}</div>
        </div>
      ),
    },
    ...(canFilterByUser
      ? [{
          header: 'Merchant',
          key: 'merchant',
          render: (val, row) => (
            <div className="text-xs leading-snug">
              <p className="font-semibold text-gray-800">{val?.name || `ID: ${row.merchant_id}`}</p>
              <p className="text-gray-500">{val?.mobile_number || ''}</p>
            </div>
          ),
        }]
      : []),
    {
      header: 'Ref ID',
      key: 'reference_id',
      render: (val, row) => {
        const localMxId = getNormalizedPayoutProviderKey(row) === 'mx_payout' ? getMxLocalRequestId(row) : null;
        return (
          <div className="text-sm leading-tight">
            <div className="font-semibold text-gray-900 break-all">{val || extractRequestId(row) || row.id || '-'}</div>
            {localMxId && (
              <div className="mt-0.5 break-all text-xs font-semibold text-[#00D3CD]">
                {localMxId}
              </div>
            )}
            <div className="mt-0.5 text-xs text-slate-500 uppercase tracking-wide">
              {getVisibleCcBill3ProviderLabel(row, { isAdmin })}
            </div>
          </div>
        );
      },
    },
    {
      header: 'Beneficiary',
      key: 'beneficiary',
      render: (val, row) => (
        <div className="text-xs leading-snug">
          <p className="font-semibold text-gray-800">{val?.beneficiary_name || `ID: ${row.beneficiary_id}`}</p>
          <p className="text-gray-500">{val?.account_number ? `Acc: ${val.account_number}` : ''}</p>
          <p className="text-gray-500">{val?.bank_name || ''}</p>
        </div>
      ),
    },
    {
      header: 'RRN',
      key: 'rrn',
      render: (_, row) => (
        <div className="text-sm leading-tight">
          <div className="font-medium break-all">{getPayoutRrn(row) || '-'}</div>
        </div>
      ),
    },
    {
      header: 'Amount (Rs)',
      key: 'amount',
      render: (val, row) => (
        <div className="text-sm leading-tight">
          <div className="font-medium">{formatCurrency(val)}</div>
          <div className="text-xs text-slate-500">Service Charge: {formatCurrency(row.service_charge)}</div>
          <div className="text-xs text-red-600">Total Deducted: {formatCurrency(row.total_deducted)}</div>
        </div>
      ),
    },
    {
      header: 'Status',
      key: 'status',
      render: (status) => (
        <span
          className={`px-2 py-1 rounded-full text-xs font-semibold ${
            normalizePayoutStatus(status) === 'SUCCESS'
              ? 'bg-green-100 text-green-700'
              : normalizePayoutStatus(status) === 'PENDING'
              ? 'bg-yellow-100 text-yellow-700'
              : 'bg-red-100 text-red-700'
          }`}
        >
          {normalizePayoutStatus(status)}
        </span>
      ),
    },
    {
      header: 'Log',
      key: 'audit_log',
      render: (_, row) => {
        const auditIdentifier = extractRequestId(row) || row.merchantRefId || row.referenceId;
        if (!(isBranchXPayout(row.payout_provider) || isSevenPayPayout(row.payout_provider) || isVimoPayout(row.payout_provider) || isMxPayout(row.payout_provider) || isNdia5Payout(row.payout_provider)) || !auditIdentifier) {
          return '-';
        }
        return (
          <button
            type="button"
            onClick={() => openAuditModal(row)}
            className="rounded-lg bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700 transition hover:bg-slate-200"
          >
            View Log
          </button>
        );
      },
    },
    {
      header: 'Action',
      key: 'admin_action',
      render: (_, row) => {
        if (isBranchXPayout(row.payout_provider)) {
          if (!canUserMarkVimoFail) return '-';
          const branchXEligibility = getBranchXManualRefundEligibility(row);
          if (!branchXEligibility.canShow) return '-';
          const currentIdentifier = extractRequestId(row) || row.reference_id || row.payout_id || row.id;
          const selectedRefundIdentifier =
            selectedBranchXRefundRow &&
            (extractRequestId(selectedBranchXRefundRow) || selectedBranchXRefundRow?.reference_id || selectedBranchXRefundRow?.payout_id || selectedBranchXRefundRow?.id);
          const selectedStatusIdentifier =
            selectedBranchXStatusRow &&
            (extractRequestId(selectedBranchXStatusRow) || selectedBranchXStatusRow?.reference_id || selectedBranchXStatusRow?.payout_id || selectedBranchXStatusRow?.id);
          return (
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => openBranchXStatusModal(row)}
                title="Run status check to verify latest BranchX status."
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                {branchXStatusCheckMutation.isPending && selectedStatusIdentifier === currentIdentifier
                  ? 'Checking...'
                  : 'Check Status'}
              </button>
              {/*
              <button
                type="button"
                onClick={() => openBranchXRefundConfirmation(row)}
                title="Run status check first. Refund is allowed only when BranchX status is FAILED."
                className="w-full rounded-lg bg-red-100 px-3 py-1 text-sm font-semibold text-red-700 transition hover:bg-red-200"
              >
                {branchXManualRefundMutation.isPending && selectedRefundIdentifier === currentIdentifier
                  ? 'Processing...'
                  : 'Fail + Refund'}
              </button>
              */}
            </div>
          );
        }

        if (isVimoPayout(row.payout_provider)) {
          const eligibility = getVimoFailEligibility(row);
          const isPending = isPendingLikePayoutStatus(row.status);
          const currentIdentifier = getVimoReferenceId(row);

          const canShowCcBill3StatusAction =
            isCcBill3Payout(row) &&
            normalizePayoutStatus(row.status) === 'PENDING' &&
            Boolean(getCcBill3StatusRecordId(row));

          if (!isPending && !eligibility.canShow && !canShowCcBill3StatusAction) return '-';

          const ccBill3CurrentIdentifier =
            getCcBill3StatusRecordId(row) ||
            extractRequestId(row) ||
            row.reference_id ||
            row.payout_id ||
            row.id;
          const selectedCcBill3Identifier =
            selectedCcBill3StatusRow &&
            (getCcBill3StatusRecordId(selectedCcBill3StatusRow) ||
              extractRequestId(selectedCcBill3StatusRow) ||
              selectedCcBill3StatusRow?.reference_id ||
              selectedCcBill3StatusRow?.payout_id ||
              selectedCcBill3StatusRow?.id);

          return (
            <div className="flex flex-col gap-2">
              {canShowCcBill3StatusAction ? (
                <button
                  type="button"
                  onClick={() => openCcBill3StatusCheck(row)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  {ccBill3StatusCheckMutation.isPending &&
                  selectedCcBill3Identifier === ccBill3CurrentIdentifier
                    ? 'Checking...'
                    : 'Check Status'}
                </button>
              ) : isPending ? (
                <button
                  type="button"
                  onClick={() => openVimoStatusModal(row)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  {vimoStatusCheckMutation.isPending && selectedVimoStatusRow?.id === row.id
                    ? 'Checking...'
                    : 'Check Status'}
                </button>
              ) : null}
              {eligibility.canShow && (
                <button
                  type="button"
                  onClick={() => openVimoFailConfirmation(row)}
                  className="w-full rounded-lg bg-red-100 px-3 py-1 text-sm font-semibold text-red-700 transition hover:bg-red-200"
                >
                  {failVimoMutation.isPending && selectedVimoReferenceId === currentIdentifier
                    ? 'Marking...'
                    : 'Mark Failed'}
                </button>
              )}
            </div>
          );
        }

        if (isSevenPayPayout(row.payout_provider)) {
          if (!isAdmin) return '-';
          const refundEligibility = getSevenPayManualRefundEligibility(row);
          const statusEligibility = getSevenPayStatusCheckEligibility(row);

          if (!refundEligibility.canShow && !statusEligibility.canShow) return '-';
          const currentIdentifier = extractRequestId(row) || row.reference_id || row.payout_id || row.id;
          const selectedRefundIdentifier =
            selectedSevenPayRefundRow &&
            (extractRequestId(selectedSevenPayRefundRow) || selectedSevenPayRefundRow?.reference_id || selectedSevenPayRefundRow?.payout_id || selectedSevenPayRefundRow?.id);

          return (
            <div className="flex flex-col gap-2">
              {statusEligibility.canShow && (
                <button
                  type="button"
                  onClick={() => openSevenPayStatusCheck(row)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  {sevenPayStatusCheckMutation.isPending
                    ? 'Checking...'
                    : 'Check Status'}
                </button>
              )}
              {refundEligibility.canShow && (
                <button
                  type="button"
                  onClick={() => openSevenPayRefundConfirmation(row)}
                  className="w-full rounded-lg bg-orange-100 px-3 py-1 text-sm font-semibold text-orange-700 transition hover:bg-orange-200"
                >
                  {sevenPayManualRefundMutation.isPending && selectedRefundIdentifier === currentIdentifier
                    ? 'Processing...'
                    : 'Refund'}
                </button>
              )}
            </div>
          );
        }

        if (isMxPayout(row.payout_provider)) {
          if (!isAdmin) return '-';
          const refundEligibility = getMxManualRefundEligibility(row);
          const statusEligibility = getMxStatusCheckEligibility(row);

          if (!refundEligibility.canShow && !statusEligibility.canShow) return '-';
          const currentIdentifier = extractRequestId(row) || row.reference_id || row.payout_id || row.id;
          const selectedRefundIdentifier =
            selectedMxRefundRow &&
            (extractRequestId(selectedMxRefundRow) || selectedMxRefundRow?.reference_id || selectedMxRefundRow?.payout_id || selectedMxRefundRow?.id);

          return (
            <div className="flex flex-col gap-2 min-w-[120px]">
              {statusEligibility.canShow && (
                <button
                  onClick={() => openMxStatusCheck(row)}
                  disabled={mxStatusCheckMutation.isPending && selectedMxStatusRow?.id === row.id}
                  className="inline-flex w-full items-center justify-center rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {mxStatusCheckMutation.isPending && selectedMxStatusRow?.id === row.id
                    ? 'Checking...'
                    : 'Check Status'}
                </button>
              )}
              {refundEligibility.canShow && (
                <button
                  type="button"
                  onClick={() => openMxRefundConfirmation(row)}
                  className="w-full rounded-lg bg-cyan-100 px-3 py-1 text-sm font-semibold text-cyan-700 transition hover:bg-cyan-200"
                >
                  {mxManualRefundMutation.isPending && selectedRefundIdentifier === currentIdentifier
                    ? 'Processing...'
                    : 'Refund'}
                </button>
              )}
            </div>
          );
        }

        if (isNdia5Payout(row.payout_provider)) {
          if (!isAdmin) return '-';
          const statusEligibility = getNdia5StatusCheckEligibility(row);
          const refundEligibility = getNdia5ManualRefundEligibility(row);

          if (!statusEligibility.canShow && !refundEligibility.canShow) return '-';

          return (
            <div className="flex flex-col gap-2 min-w-[120px]">
              {statusEligibility.canShow && (
                <button
                  onClick={() => openNdia5StatusCheck(row)}
                  disabled={ndia5StatusCheckMutation.isPending && selectedNdia5StatusRow?.id === row.id}
                  className="inline-flex w-full items-center justify-center rounded-md border border-amber-200 bg-white px-3 py-1.5 text-xs font-medium text-amber-700 shadow-sm transition-colors hover:bg-amber-50 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {ndia5StatusCheckMutation.isPending && selectedNdia5StatusRow?.id === row.id
                    ? 'Checking...'
                    : 'Check Status'}
                </button>
              )}
              {refundEligibility.canShow && (
                <button
                  onClick={() => openNdia5RefundConfirmation(row)}
                  disabled={ndia5ManualRefundMutation.isPending && selectedNdia5RefundRow?.id === row.id}
                  className="inline-flex w-full items-center justify-center rounded-md bg-amber-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm transition-colors hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {ndia5ManualRefundMutation.isPending && selectedNdia5RefundRow?.id === row.id
                    ? 'Processing...'
                    : 'Refund'}
                </button>
              )}
            </div>
          );
        }

        return '-';
      },
    },
  ];

  return (
    <div className="min-h-screen bg-transparent px-0 py-1 sm:bg-gray-50 sm:p-6">
      <h1 className="mb-4 text-2xl font-bold text-gray-800">Reports</h1>
      <ReportTabs
        basePath={reportsBasePath}
        activeTab={activeTab}
        trailingAction={(
          <button
            type="button"
            onClick={openCombinedExportModal}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 md:w-auto"
          >
            <Download className="h-4 w-4" />
            DOWNLOAD ALL DATA
          </button>
        )}
      />
      <h2 className="mb-6 text-2xl font-bold text-gray-800">{reportTitle}</h2>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white p-5 rounded-lg shadow-sm border-l-4 border-blue-500">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Total Records</p>
          <p className="text-2xl font-bold mt-1">{totalCount}</p>
          <p className="text-sm text-gray-500 mt-1">{formatCurrency(totalAmount)} total</p>
          {!isCcBill3Report && (
            <button
              type="button"
              onClick={processPendingBranchxManually}
              disabled={manualProcessRunning || pendingBranchxRows.length === 0}
              title={`Processes ${pendingBranchxRows.length} pending BranchX payout(s) on the current page one by one`}
              className="mt-3 inline-flex items-center justify-center rounded-lg bg-[#00D3CD] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {manualProcessRunning ? 'Processing...' : 'Process Manually'}
            </button>
          )}
        </div>
        <div className="bg-white p-5 rounded-lg shadow-sm border-l-4 border-green-500">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Success Amount</p>
          <p className="text-2xl font-bold mt-1 text-green-600">{formatCurrency(successAmount)}</p>
          {pendingAmount > 0 ? (
            <p className="text-sm text-amber-600 mt-1">{formatCurrency(pendingAmount)} pending</p>
          ) : (
            <p className="text-sm text-gray-400 mt-1">No pending amount</p>
          )}
        </div>
        <div className="bg-white p-5 rounded-lg shadow-sm border-l-4 border-red-500">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Failed Amount</p>
          <p className="text-2xl font-bold mt-1 text-red-600">{formatCurrency(failedAmount)}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 rounded-2xl bg-white p-4 shadow-sm md:rounded-lg md:p-5">
        <div className="mb-4 space-y-3 md:hidden">
          <div className="grid grid-cols-2 gap-2">
            <div className="min-w-0">
              <label className="mb-1 block text-xs font-medium text-gray-700">From Date</label>
              <input
                type="date"
                name="from_date"
                value={filters.from_date}
                onChange={handleFilterChange}
                className={compactInputClassName}
              />
            </div>
            <div className="min-w-0">
              <label className="mb-1 block text-xs font-medium text-gray-700">To Date</label>
              <input
                type="date"
                name="to_date"
                value={filters.to_date}
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
                <option value="SUCCESS">SUCCESS</option>
                <option value="FAILED">FAILED</option>
                <option value="PENDING">PENDING</option>
              </select>
            </div>
          </div>

          <div className={`grid gap-2 ${canFilterByUser ? 'grid-cols-2' : 'grid-cols-1'}`}>
            {!isCcBill3Report && (
              <div className="min-w-0">
                <label className="mb-1 block text-xs font-medium text-gray-700">Provider</label>
                <select
                  name="payout_provider"
                  value={filters.payout_provider}
                  onChange={handleFilterChange}
                  className={compactInputClassName}
                >
                  <option value="">All</option>
                  <option value="branchx">BranchX</option>
                  <option value="sevenpay">SevenPay</option>
                  <option value="vimo">Vimo</option>
                  <option value="mx_payout">Payout MX</option>
                  <option value="ndia5_payout">India5</option>
                </select>
              </div>
            )}
            {canFilterByUser && (
              <div className="min-w-0">
                {canSelectUserSuggestions ? (
                  <UserSelectWithSuggestions
                    selectedUser={selectedUser}
                    onSelectUser={handleUserSelect}
                    label="Select User"
                  />
                ) : (
                  <>
                    <label className="mb-1 block text-xs font-medium text-gray-700">Merchant ID</label>
                    <input
                      type="number"
                      name="user_id"
                      value={filters.user_id}
                      onChange={handleFilterChange}
                      placeholder="Filter by merchant"
                      className={inputClassName}
                    />
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        <div
          className={`mb-4 hidden gap-4 md:grid md:grid-cols-2 ${
            canFilterByUser
              ? isCcBill3Report
                ? 'xl:grid-cols-4'
                : 'xl:grid-cols-5'
              : isCcBill3Report
                ? 'xl:grid-cols-3'
                : 'xl:grid-cols-4'
          }`}
        >
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">From Date</label>
            <input
              type="date"
              name="from_date"
              value={filters.from_date}
              onChange={handleFilterChange}
              className={inputClassName}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">To Date</label>
            <input
              type="date"
              name="to_date"
              value={filters.to_date}
              onChange={handleFilterChange}
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
              <option value="">All Statuses</option>
              <option value="SUCCESS">SUCCESS</option>
              <option value="FAILED">FAILED</option>
              <option value="PENDING">PENDING</option>
            </select>
          </div>
          {!isCcBill3Report && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Provider</label>
              <select
                name="payout_provider"
                value={filters.payout_provider}
                onChange={handleFilterChange}
                className={inputClassName}
              >
                <option value="">All</option>
                <option value="branchx">BranchX</option>
                <option value="sevenpay">SevenPay</option>
                <option value="vimo">Vimo</option>
                <option value="mx_payout">Payout MX</option>
                <option value="ndia5_payout">India5</option>
              </select>
            </div>
          )}
          {canFilterByUser && (
            <div>
              {canSelectUserSuggestions ? (
                <UserSelectWithSuggestions
                  selectedUser={selectedUser}
                  onSelectUser={handleUserSelect}
                  label="Select User"
                />
              ) : (
                <>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Merchant ID</label>
                  <input
                    type="number"
                    name="user_id"
                    value={filters.user_id}
                    onChange={handleFilterChange}
                    placeholder="Filter by merchant"
                    className={inputClassName}
                  />
                </>
              )}
            </div>
          )}
        </div>
        <div className="flex flex-wrap justify-between items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span>Rows per page:</span>
            <select
              name="limit"
              value={filters.limit}
              onChange={handleFilterChange}
              className="border rounded px-2 py-1 text-sm"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={200}>200</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button
              onClick={resetFilters}
              className="flex items-center gap-1 px-3 py-2 rounded-lg border text-sm text-gray-700 hover:bg-gray-50 transition"
            >
              <RefreshCcw className="w-4 h-4" />
              Reset
            </button>
            <button
              onClick={handleExportExcel}
              disabled={isExporting}
              className="flex items-center gap-1 px-3 py-2 rounded-lg bg-primary text-white text-sm hover:opacity-90 transition disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Download className="w-4 h-4" />
              {isExporting ? 'Exporting...' : 'Export Excel'}
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl bg-white p-4 shadow-sm md:rounded-lg">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-gray-500">
            <Loader2 className="w-6 h-6 animate-spin mr-2" />
            Loading...
          </div>
        ) : isError ? (
          <div className="text-center py-16 text-red-500">Failed to load payout report.</div>
        ) : visibleRows.length === 0 ? (
          <div className="text-center py-16 text-gray-400">No records found for the selected filters.</div>
        ) : (
          <>
            <div className="space-y-3 md:hidden">
              {visibleRows.map((row, idx) => {
                const rowKey = row.reference_id || row.id || `${row.date}-${idx}`;
                return (
                  <PayoutMobileCard
                    key={rowKey}
                    row={row}
                    canFilterByUser={canFilterByUser}
                    isExpanded={!!expandedRows[rowKey]}
                    onToggle={() => toggleRowExpansion(rowKey)}
                    isAdmin={isAdmin || isVimoFailAuthorizedEmployee(currentUser)}
                    canShowCcBill3StatusAction={
                      isCcBill3Payout(row) &&
                      normalizePayoutStatus(row.status) === 'PENDING' &&
                      Boolean(getCcBill3StatusRecordId(row))
                    }
                    canShowVimoFailAction={canUserMarkVimoFail && getVimoFailEligibility(row).canShow}
                    canShowBranchXManualRefundAction={getBranchXManualRefundEligibility(row).canShow}
                    canShowSevenPayRefundAction={isAdmin && getSevenPayManualRefundEligibility(row).canShow}
                    canShowSevenPayStatusCheckAction={isAdmin && getSevenPayStatusCheckEligibility(row).canShow}
                    canShowMxRefundAction={isAdmin && getMxManualRefundEligibility(row).canShow}
                    canShowMxStatusCheckAction={isAdmin && getMxStatusCheckEligibility(row).canShow}
                    canShowNdia5RefundAction={isAdmin && getNdia5ManualRefundEligibility(row).canShow}
                    canShowNdia5StatusCheckAction={isAdmin && getNdia5StatusCheckEligibility(row).canShow}
                    onCheckCcBill3Status={openCcBill3StatusCheck}
                    onMarkVimoFailed={openVimoFailConfirmation}
                    onVimoStatusCheck={openVimoStatusModal}
                    onBranchXStatusCheck={openBranchXStatusModal}
                    onBranchXManualRefund={openBranchXRefundConfirmation}
                    onSevenPayRefund={openSevenPayRefundConfirmation}
                    onSevenPayStatusCheck={openSevenPayStatusCheck}
                    onMxRefund={openMxRefundConfirmation}
                    onMxStatusCheck={openMxStatusCheck}
                    onNdia5Refund={openNdia5RefundConfirmation}
                    onNdia5StatusCheck={openNdia5StatusCheck}
                    onOpenAuditLog={openAuditModal}
                    isActionPending={
                      (failVimoMutation.isPending && selectedVimoReferenceId === getVimoReferenceId(row)) ||
                      (vimoStatusCheckMutation.isPending && selectedVimoStatusRow?.id === row.id) ||
                      (mxStatusCheckMutation.isPending && selectedMxStatusRow?.id === row.id) ||
                      (mxManualRefundMutation.isPending && selectedMxRefundRow?.id === row.id) ||
                      (ndia5StatusCheckMutation.isPending && selectedNdia5StatusRow?.id === row.id) ||
                      (ndia5ManualRefundMutation.isPending && selectedNdia5RefundRow?.id === row.id) ||
                      (sevenPayManualRefundMutation.isPending &&
                        (extractRequestId(selectedSevenPayRefundRow) || selectedSevenPayRefundRow?.reference_id || selectedSevenPayRefundRow?.payout_id || selectedSevenPayRefundRow?.id) ===
                        (extractRequestId(row) || row.reference_id || row.payout_id || row.id)) ||
                      (branchXManualRefundMutation.isPending &&
                        (extractRequestId(selectedBranchXRefundRow) || selectedBranchXRefundRow?.reference_id || selectedBranchXRefundRow?.payout_id || selectedBranchXRefundRow?.id) ===
                        (extractRequestId(row) || row.reference_id || row.payout_id || row.id)) ||
                      (branchXStatusCheckMutation.isPending &&
                        (extractRequestId(selectedBranchXStatusRow) || selectedBranchXStatusRow?.reference_id || selectedBranchXStatusRow?.payout_id || selectedBranchXStatusRow?.id) ===
                        (extractRequestId(row) || row.reference_id || row.payout_id || row.id)) ||
                      (ccBill3StatusCheckMutation.isPending &&
                        (getCcBill3StatusRecordId(selectedCcBill3StatusRow) ||
                          extractRequestId(selectedCcBill3StatusRow) ||
                          selectedCcBill3StatusRow?.reference_id ||
                          selectedCcBill3StatusRow?.payout_id ||
                          selectedCcBill3StatusRow?.id) ===
                        (getCcBill3StatusRecordId(row) ||
                          extractRequestId(row) ||
                          row.reference_id ||
                          row.payout_id ||
                          row.id))
                    }
                  />
                );
              })}
            </div>
            <div className="hidden md:block max-h-[640px] overflow-auto border border-gray-200 rounded-lg">
              <Table
                columns={columns}
                data={visibleRows}
                containerClassName="overflow-x-auto bg-white shadow-md rounded-lg"
                headerClassName="sticky top-0 z-10 bg-white"
                tableClassName="min-w-max divide-y divide-gray-200"
              />
            </div>
          </>
        )}
      </div>

      <Modal
        isOpen={combinedExportModalOpen}
        onClose={closeCombinedExportModal}
        title="Download Combined Excel Report"
        className="max-w-xl"
      >
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">From Date</label>
              <input
                type="date"
                name="from_date"
                value={combinedExportFilters.from_date}
                onChange={handleCombinedExportFilterChange}
                className={inputClassName}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">To Date</label>
              <input
                type="date"
                name="to_date"
                value={combinedExportFilters.to_date}
                onChange={handleCombinedExportFilterChange}
                className={inputClassName}
              />
            </div>
          </div>

          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            <span className="font-semibold">BA_CC_Bill_Payment</span> currently uses the available
            BillAvenue listing data and may not follow the selected date range.
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={closeCombinedExportModal}
              disabled={isCombinedExporting}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleCombinedExport}
              disabled={isCombinedExporting}
              className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isCombinedExporting ? 'Downloading...' : 'Download'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={auditModalOpen} onClose={closeAuditModal} title={`Audit Logs for ${auditRequestId || 'Request'}`}>
        <div className="space-y-4">
          {auditLoading ? (
            <div className="flex items-center justify-center py-8 text-gray-500">
              <Loader2 className="w-6 h-6 animate-spin mr-2" />
              Loading audit logs...
            </div>
          ) : auditError ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {auditError}
            </div>
          ) : auditLogs.length === 0 ? (
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
              No audit logs were found for this request ID.
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <p className="text-sm text-gray-500">Request ID</p>
                <p className="mt-2 text-lg font-bold text-gray-900">{auditRequestId}</p>
                {auditLogCount != null && (
                  <p className="text-xs text-gray-500 mt-2">{auditLogCount} log{auditLogCount === 1 ? '' : 's'} found</p>
                )}
              </div>
              {sortedAuditLogs.map((log) => {
                const details = log.details || {};
                return (
                  <div key={log.id} className="rounded-2xl border border-gray-200 bg-white p-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="text-sm font-semibold text-gray-900">{log.action || 'Unknown action'}</div>
                        <div className="text-xs text-gray-500">{formatDateTime(log.created_at)}</div>
                      </div>
                      <div className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-gray-700 shadow-sm">
                        Log ID: {log.id}
                      </div>
                    </div>
                    <div className="mt-4 rounded-2xl bg-gray-50 p-4 border border-gray-200">
                      <div className="text-xs uppercase text-gray-500">Details</div>
                      <pre className="mt-3 overflow-x-auto text-xs text-gray-700 whitespace-pre-wrap">{JSON.stringify(details, null, 2)}</pre>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Modal>

      <Modal isOpen={vimoFailModalOpen} onClose={closeVimoFailModal} title="Mark Vimo payout as failed?">
        <div className="space-y-4">
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            This will mark the payout as FAILED and refund the payout amount plus service charge to the merchant wallet.
          </div>

          <div className="grid gap-3 rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700 sm:grid-cols-2">
            {renderKeyValue('Reference ID', selectedVimoReferenceId)}
            {renderKeyValue('Provider', selectedVimoRow?.payout_provider || 'Vimo')}
            {renderKeyValue('Status', normalizePayoutStatus(selectedVimoRow?.status))}
            {renderKeyValue('Amount', formatCurrency(selectedVimoRow?.amount))}
            {renderKeyValue('Service Charge', formatCurrency(selectedVimoRow?.service_charge))}
            {renderKeyValue('Total Deducted', formatCurrency(selectedVimoRow?.total_deducted))}
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={closeVimoFailModal}
              disabled={failVimoMutation.isPending}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmVimoFail}
              disabled={failVimoMutation.isPending || !selectedVimoReferenceId}
              className="inline-flex items-center justify-center rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {failVimoMutation.isPending ? 'Marking...' : 'Mark Failed'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={branchXRefundModalOpen}
        onClose={closeBranchXRefundModal}
        title="Confirm BranchX Fail + Refund"
      >
        <div className="space-y-4">
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            This will mark the payout transaction as FAILED and refund the payout amount plus service charge back to the user.
          </div>

          <div className="grid gap-3 rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700 sm:grid-cols-2">
            {renderKeyValue('Reference ID', extractRequestId(selectedBranchXRefundRow) || selectedBranchXRefundRow?.reference_id || selectedBranchXRefundRow?.payout_id)}
            {renderKeyValue('Provider', selectedBranchXRefundRow?.payout_provider || 'BranchX')}
            {renderKeyValue('Status', normalizePayoutStatus(selectedBranchXRefundRow?.status))}
            {renderKeyValue('Amount', formatCurrency(selectedBranchXRefundRow?.amount))}
            {renderKeyValue('Service Charge', formatCurrency(selectedBranchXRefundRow?.service_charge))}
            {renderKeyValue('Total Deducted', formatCurrency(selectedBranchXRefundRow?.total_deducted))}
          </div>

          <div className="rounded-2xl border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-700">
            <label className="flex items-start gap-3">
              <input
                id="branchxRefundConfirm"
                type="checkbox"
                checked={branchXRefundConfirmed}
                onChange={(e) => setBranchXRefundConfirmed(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span>
                I confirm that this BranchX payout should be marked FAILED and refunded.
              </span>
            </label>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
            {selectedBranchXRefundRow && getBranchXReferenceId(selectedBranchXRefundRow) !== getBranchXReferenceId(selectedBranchXStatusRow) ? (
              <p>Please run BranchX status check for this payout first before issuing a manual refund.</p>
            ) : branchXStatusResponse && getBranchXEffectiveStatus(branchXStatusResponse) !== 'FAILED' ? (
              <p>
                Manual refund can only be issued after a failed BranchX status check. Current status: <strong>{String(getBranchXEffectiveStatus(branchXStatusResponse) || 'UNKNOWN').toUpperCase()}</strong>.
              </p>
            ) : (
              <p>You may confirm refund now. A prior status-check has been completed for this payout.</p>
            )}
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={closeBranchXRefundModal}
              disabled={branchXManualRefundMutation.isPending}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => branchXManualRefundMutation.mutate(selectedBranchXRefundRow)}
              disabled={
                branchXManualRefundMutation.isPending ||
                !selectedBranchXRefundRow ||
                !branchXRefundConfirmed ||
                getBranchXReferenceId(selectedBranchXRefundRow) !== getBranchXReferenceId(selectedBranchXStatusRow) ||
                getBranchXEffectiveStatus(branchXStatusResponse) !== 'FAILED'
              }
              className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {branchXManualRefundMutation.isPending ? 'Processing...' : 'Confirm Refund'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={sevenPayRefundModalOpen}
        onClose={closeSevenPayRefundModal}
        title="Confirm SevenPay Refund"
      >
        <div className="space-y-4">
          <div className="rounded-2xl border border-orange-200 bg-orange-50 p-4 text-sm text-orange-700">
            This will create a refund for the selected SevenPay payout and return the deducted amount back to the user wallet.
          </div>

          <div className="grid gap-3 rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700 sm:grid-cols-2">
            {renderKeyValue('Reference ID', extractRequestId(selectedSevenPayRefundRow) || selectedSevenPayRefundRow?.reference_id || selectedSevenPayRefundRow?.payout_id)}
            {renderKeyValue('Provider', selectedSevenPayRefundRow?.payout_provider || 'SevenPay')}
            {renderKeyValue('Status', normalizePayoutStatus(selectedSevenPayRefundRow?.status))}
            {renderKeyValue('Amount', formatCurrency(selectedSevenPayRefundRow?.amount))}
            {renderKeyValue('Service Charge', formatCurrency(selectedSevenPayRefundRow?.service_charge))}
            {renderKeyValue('Total Deducted', formatCurrency(selectedSevenPayRefundRow?.total_deducted))}
          </div>

          <div className="rounded-2xl border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-700">
            <label className="flex items-start gap-3">
              <input
                id="sevenpayRefundConfirm"
                type="checkbox"
                checked={sevenPayRefundConfirmed}
                onChange={(e) => setSevenPayRefundConfirmed(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
              />
              <span>
                I confirm that this SevenPay payout should be refunded.
              </span>
            </label>
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={closeSevenPayRefundModal}
              disabled={sevenPayManualRefundMutation.isPending}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => sevenPayManualRefundMutation.mutate(selectedSevenPayRefundRow)}
              disabled={
                sevenPayManualRefundMutation.isPending ||
                !selectedSevenPayRefundRow ||
                !sevenPayRefundConfirmed
              }
              className="inline-flex items-center justify-center rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {sevenPayManualRefundMutation.isPending ? 'Processing...' : 'Confirm Refund'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={sevenPayStatusModalOpen}
        onClose={closeSevenPayStatusModal}
        title="SevenPay Status Check"
      >
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
            {selectedSevenPayStatusRow ? (
              <>
                <p className="font-medium text-slate-900">Response from status check</p>
                <p className="text-xs text-slate-500 mt-2">
                  This is the backend payload returned by the SevenPay status-check endpoint.
                </p>
              </>
            ) : (
              <p className="font-medium text-slate-900">Status check request initialized.</p>
            )}
          </div>

          {sevenPayStatusCheckMutation.isPending ? (
            <div className="flex items-center justify-center py-8 text-gray-500">
              <Loader2 className="w-6 h-6 animate-spin mr-2" />
              Checking status...
            </div>
          ) : sevenPayStatusError ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {sevenPayStatusError}
            </div>
          ) : sevenPayStatusResponse ? (
            <pre className="max-h-96 overflow-auto rounded-2xl border border-gray-200 bg-white p-4 text-xs text-gray-700">
              {JSON.stringify(sevenPayStatusResponse, null, 2)}
            </pre>
          ) : (
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
              The response will appear here once the backend returns it.
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="button"
              onClick={closeSevenPayStatusModal}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
            >
              Close
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={branchXStatusModalOpen}
        onClose={closeBranchXStatusModal}
        title="BranchX Status Check"
      >
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
            {selectedBranchXStatusRow ? (
              <>
                <p className="font-medium text-slate-900">Response from status check</p>
                <p className="text-xs text-slate-500 mt-2">
                  This is the backend payload returned by the BranchX status-check endpoint.
                </p>
              </>
            ) : (
              <p className="font-medium text-slate-900">Status check request initialized.</p>
            )}
          </div>

          {branchXStatusCheckMutation.isPending ? (
            <div className="flex items-center justify-center py-8 text-gray-500">
              <Loader2 className="w-6 h-6 animate-spin mr-2" />
              Checking status...
            </div>
          ) : branchXStatusError ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {branchXStatusError}
            </div>
          ) : branchXStatusResponse ? (
            <pre className="max-h-96 overflow-auto rounded-2xl border border-gray-200 bg-white p-4 text-xs text-gray-700">
              {JSON.stringify(branchXStatusResponse, null, 2)}
            </pre>
          ) : (
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
              The response will appear here once the backend returns it.
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="button"
              onClick={closeBranchXStatusModal}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
            >
              Close
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={mxRefundModalOpen}
        onClose={closeMxRefundModal}
        title="Confirm Payout MX Refund"
      >
        <div className="space-y-4">
          <div className="rounded-2xl border border-cyan-200 bg-cyan-50 p-4 text-sm text-cyan-700">
            This will create a refund for the selected Payout MX payout and return the deducted amount back to the user wallet.
          </div>

          <div className="grid gap-3 rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700 sm:grid-cols-2">
            {renderKeyValue('Reference ID', extractRequestId(selectedMxRefundRow) || selectedMxRefundRow?.reference_id || selectedMxRefundRow?.id)}
            {renderKeyValue('Provider', selectedMxRefundRow?.payout_provider || 'Payout-M-X')}
            {renderKeyValue('Status', normalizePayoutStatus(selectedMxRefundRow?.status))}
            {renderKeyValue('Amount', formatCurrency(selectedMxRefundRow?.amount))}
            {renderKeyValue('Service Charge', formatCurrency(selectedMxRefundRow?.service_charge))}
            {renderKeyValue('Total Deducted', formatCurrency(selectedMxRefundRow?.total_deducted))}
          </div>

          <div className="rounded-2xl border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-700">
            <label className="flex items-start gap-3">
              <input
                id="mxRefundConfirm"
                type="checkbox"
                checked={mxRefundConfirmed}
                onChange={(e) => setMxRefundConfirmed(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-gray-300 text-cyan-600 focus:ring-cyan-500"
              />
              <span>
                I confirm that this Payout MX payout should be refunded.
              </span>
            </label>
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={closeMxRefundModal}
              disabled={mxManualRefundMutation.isPending}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => mxManualRefundMutation.mutate(selectedMxRefundRow)}
              disabled={
                mxManualRefundMutation.isPending ||
                !selectedMxRefundRow ||
                !mxRefundConfirmed
              }
              className="inline-flex items-center justify-center rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {mxManualRefundMutation.isPending ? 'Processing...' : 'Confirm Refund'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={ndia5RefundModalOpen}
        onClose={closeNdia5RefundModal}
        title="NDIA5 Manual Refund"
      >
        <div className="space-y-4">
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            <p className="font-semibold text-amber-900 mb-1">Confirm Manual Refund</p>
            <p>
              Are you sure you want to manually refund this NDIA5 payout transaction? This action will
              credit the user's wallet with the payout amount.
            </p>
            {selectedNdia5RefundRow && (
              <div className="mt-3 bg-white border border-amber-200 p-3 rounded-xl">
                <p>
                  <span className="font-semibold">Amount:</span>{' '}
                  {formatCurrency(selectedNdia5RefundRow.amount)}
                </p>
                <p className="mt-1">
                  <span className="font-semibold">Reference ID:</span>{' '}
                  {extractRequestId(selectedNdia5RefundRow) || selectedNdia5RefundRow.reference_id || selectedNdia5RefundRow.id}
                </p>
              </div>
            )}
          </div>
          
          <label className="flex items-center space-x-3 rounded-xl border border-gray-200 p-4 cursor-pointer hover:bg-gray-50 transition">
            <input
              type="checkbox"
              className="h-5 w-5 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
              checked={ndia5RefundConfirmed}
              onChange={(e) => setNdia5RefundConfirmed(e.target.checked)}
            />
            <span className="text-sm font-medium text-gray-700">
              I confirm that I want to process this refund manually.
            </span>
          </label>

          <div className="flex justify-end gap-3 mt-6">
            <button
              type="button"
              onClick={closeNdia5RefundModal}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => ndia5ManualRefundMutation.mutate(selectedNdia5RefundRow)}
              disabled={
                ndia5ManualRefundMutation.isPending ||
                !selectedNdia5RefundRow ||
                !ndia5RefundConfirmed
              }
              className="inline-flex items-center justify-center rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {ndia5ManualRefundMutation.isPending ? 'Processing...' : 'Confirm Refund'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={mxStatusModalOpen}
        onClose={closeMxStatusModal}
        title="Payout MX Status Check"
      >
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
            {selectedMxStatusRow ? (
              <>
                <p className="font-medium text-slate-900">Response from status check</p>
                <p className="text-xs text-slate-500 mt-2">
                  This is the backend payload returned by the Payout MX status-check endpoint.
                </p>
              </>
            ) : (
              <p className="font-medium text-slate-900">Status check request initialized.</p>
            )}
          </div>

          {mxStatusCheckMutation.isPending ? (
            <div className="flex items-center justify-center py-8 text-gray-500">
              <Loader2 className="w-6 h-6 animate-spin mr-2" />
              Checking status...
            </div>
          ) : mxStatusError ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {mxStatusError}
            </div>
          ) : mxStatusResponse ? (
            <pre className="max-h-96 overflow-auto rounded-2xl border border-gray-200 bg-white p-4 text-xs text-gray-700">
              {JSON.stringify(mxStatusResponse, null, 2)}
            </pre>
          ) : (
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
              The response will appear here once the backend returns it.
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="button"
              onClick={closeMxStatusModal}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
            >
              Close
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={vimoStatusModalOpen}
        onClose={closeVimoStatusModal}
        title="Vimo Status Check"
      >
        <div className="space-y-4">
          {vimoStatusRequestPayload && (
            <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">Request Sent</p>
              <pre className="mt-2 overflow-auto text-xs text-blue-900 bg-white border border-blue-150 p-3 rounded-xl font-mono">
                {JSON.stringify(vimoStatusRequestPayload, null, 2)}
              </pre>
            </div>
          )}

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
            {selectedVimoStatusRow ? (
              <>
                <p className="font-medium text-slate-900">Response from status check</p>
                <p className="text-xs text-slate-500 mt-2">
                  This is the backend payload returned by the Vimo status-check endpoint.
                </p>
              </>
            ) : (
              <p className="font-medium text-slate-900">Status check request initialized.</p>
            )}
          </div>

          {vimoStatusCheckMutation.isPending ? (
            <div className="flex items-center justify-center py-8 text-gray-500">
              <Loader2 className="w-6 h-6 animate-spin mr-2" />
              Checking status...
            </div>
          ) : vimoStatusError ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {vimoStatusError}
            </div>
          ) : vimoStatusResponse ? (
            <pre className="max-h-96 overflow-auto rounded-2xl border border-gray-200 bg-white p-4 text-xs text-gray-700">
              {JSON.stringify(vimoStatusResponse, null, 2)}
            </pre>
          ) : (
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
              The response will appear here once the backend returns it.
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="button"
              onClick={closeVimoStatusModal}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
            >
              Close
            </button>
          </div>
        </div>
      </Modal>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm text-gray-600">
          <span>
            Page {pagination.page} of {pagination.totalPages} &nbsp;&bull;&nbsp; {pagination.total} total records
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => handlePageChange(pagination.page - 1)}
              disabled={pagination.page <= 1}
              className="px-3 py-1 rounded border disabled:opacity-40 hover:bg-gray-100 transition"
            >
              Previous
            </button>
            {Array.from({ length: Math.min(pagination.totalPages, 7) }, (_, i) => {
              const page = i + 1;
              return (
                <button
                  key={page}
                  onClick={() => handlePageChange(page)}
                  className={`px-3 py-1 rounded border transition ${
                    page === pagination.page
                      ? 'bg-primary text-white border-primary'
                      : 'hover:bg-gray-100'
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
        </div>
      )}

      <Modal
        isOpen={ndia5StatusModalOpen}
        onClose={closeNdia5StatusModal}
        title="NDIA5 Status Check"
      >
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
            <div className="flex items-center gap-2 font-medium mb-3">
              <span>Merchant Reference:</span>
              <span className="bg-white border border-slate-200 px-2 py-0.5 rounded text-slate-900 shadow-sm">
                {extractRequestId(selectedNdia5StatusRow) || selectedNdia5StatusRow?.reference_id}
              </span>
            </div>
          </div>

          {ndia5StatusCheckMutation.isPending && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
            </div>
          )}

          {ndia5StatusError && (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">
              <p className="font-semibold text-sm uppercase tracking-wide">Status Check Failed</p>
              <p className="mt-1 text-sm">{ndia5StatusError}</p>
            </div>
          )}

          {ndia5StatusResponse && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-600">Response</p>
              <pre className="mt-2 overflow-auto text-xs text-amber-900 bg-white border border-amber-150 p-3 rounded-xl font-mono">
                {JSON.stringify(ndia5StatusResponse, null, 2)}
              </pre>
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="button"
              onClick={closeNdia5StatusModal}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
            >
              Close
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default PayoutReport;
