import axios from 'axios';
import { getAuthToken } from '../utils/auth';
import { BASE_URL } from '../constants';

const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

const normalizeReportFilters = (filters = {}) => {
  const {
    startDate,
    endDate,
    start_date,
    end_date,
    cardHolderName,
    card_holder_name,
    cardNumber,
    card_number,
    posTxnNo,
    pos_txn_no,
    deviceNo,
    device_no,
    userId,
    user_id,
    userSearch,
    user_search,
    ...rest
  } = filters || {};

  const normalized = { ...rest };

  const resolvedStartDate = start_date ?? startDate;
  const resolvedEndDate = end_date ?? endDate;
  const resolvedCardHolderName = card_holder_name ?? cardHolderName;
  const resolvedCardNumber = card_number ?? cardNumber;
  const resolvedPosTxnNo = pos_txn_no ?? posTxnNo;
  const resolvedDeviceNo = device_no ?? deviceNo;
  const resolvedUserId = user_id ?? userId;
  const resolvedUserSearch = user_search ?? userSearch;

  if (resolvedStartDate) {
    normalized.start_date = resolvedStartDate;
    normalized.from_date = resolvedStartDate;
  }
  if (resolvedEndDate) {
    normalized.end_date = resolvedEndDate;
    normalized.to_date = resolvedEndDate;
  }
  if (resolvedCardHolderName) normalized.card_holder_name = resolvedCardHolderName;
  if (resolvedCardNumber) normalized.card_number = resolvedCardNumber;
  if (resolvedPosTxnNo) normalized.pos_txn_no = resolvedPosTxnNo;
  if (resolvedDeviceNo) normalized.device_no = resolvedDeviceNo;
  if (resolvedUserId !== undefined && resolvedUserId !== null && resolvedUserId !== '') {
    normalized.user_id = resolvedUserId;
  }
  if (resolvedUserSearch) {
    normalized.user_search = resolvedUserSearch;
  }

  return normalized;
};

// Fetch POS Transaction Report (now using Razorpay endpoint)
export const getPosTransactionReport = async (filters = {}) => {
  // The backend moved POS txn report to razorpay notifications endpoint
  try {
    const token = getAuthToken();
    if (!token) throw new Error('No token found');

    const normalizedFilters = normalizeReportFilters(filters);
    const response = await api.get('/report/razorpay', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      params: normalizedFilters,
    });

    return response.data;
  } catch (error) {
    throw new Error(error.response?.data?.message || 'Failed to fetch POS (Razorpay) report');
  }
};

const extractRows = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.rows)) return payload.rows;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
};

const extractPagination = (payload, fallbackPage = 1, fallbackLimit = 200) => {
  const pagination = payload?.pagination || payload?.data?.pagination || {};
  const limit = Number(
    pagination.limit ||
    pagination.per_page ||
    pagination.perPage ||
    payload?.limit ||
    fallbackLimit
  );
  const total = Number(
    pagination.total ||
    pagination.count ||
    pagination.total_count ||
    pagination.totalRecords ||
    payload?.total
  );
  const page = Number(pagination.page || payload?.page || fallbackPage);
  const totalPages = Number(
    pagination.totalPages ||
    pagination.total_pages ||
    pagination.pages ||
    pagination.last_page ||
    (Number.isFinite(total) && Number.isFinite(limit) && limit > 0 ? Math.ceil(total / limit) : 1)
  );

  return {
    total: Number.isFinite(total) ? total : extractRows(payload).length,
    page: Number.isFinite(page) && page > 0 ? page : fallbackPage,
    limit: Number.isFinite(limit) && limit > 0 ? limit : fallbackLimit,
    totalPages: Number.isFinite(totalPages) && totalPages > 0 ? totalPages : 1,
  };
};

export const getAllPosTransactionReport = async (filters = {}, options = {}) => {
  const requestedLimit = Number(options.limit) > 0 ? Number(options.limit) : 200;
  const firstResponse = await getPosTransactionReport({
    ...filters,
    page: 1,
    limit: requestedLimit,
  });

  const firstRows = extractRows(firstResponse);
  const pagination = extractPagination(firstResponse, 1, requestedLimit);

  if (pagination.totalPages <= 1) {
    return firstRows;
  }

  const remainingResponses = await Promise.all(
    Array.from({ length: pagination.totalPages - 1 }, (_, index) =>
      getPosTransactionReport({
        ...filters,
        page: index + 2,
        limit: requestedLimit,
      })
    )
  );

  return [firstRows, ...remainingResponses.map(extractRows)].flat();
};

const getCcBillRowSignature = (row = {}) =>
  [
    row?.id,
    row?.external_ref,
    row?.utr_no,
    row?.date,
    row?.date_and_time,
    row?.amount,
  ]
    .filter((value) => value !== undefined && value !== null && value !== '')
    .join('|');

// Fetch Wallet Transaction Report
export const getWalletReport = async (userId, filters = {}) => {
  try {
    const token = getAuthToken();
    if (!token) throw new Error('No token found');

    const normalizedFilters = normalizeReportFilters(filters);
    const response = await api.get('/report/wallet', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      params: {
        ...normalizedFilters,
        ...(userId !== undefined && userId !== null && userId !== '' ? { user_id: userId, userId } : {}),
      },
    });

    return response.data;
  } catch (error) {
    throw new Error(error.response?.data?.message || 'Failed to fetch wallet report');
  }
};

// Fetch Payout Transaction Report
export const getPayoutReport = async (filters = {}) => {
  try {
    const token = getAuthToken();
    if (!token) throw new Error('No token found');

    const normalizedFilters = normalizeReportFilters(filters);
    const response = await api.get('/report/payout', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      params: normalizedFilters,
    });

    return response.data;
  } catch (error) {
    throw new Error(error.response?.data?.message || 'Failed to fetch payout report');
  }
};

// Fetch CC Bill Payment Report (BBPS)
export const getCCBillPaymentReport = async (filters = {}) => {
  try {
    const token = getAuthToken();
    if (!token) throw new Error('No token found');

    const normalizedFilters = normalizeReportFilters(filters);
    const fallbackPage = Number(normalizedFilters.page) > 0 ? Number(normalizedFilters.page) : 1;
    const fallbackLimit = Number(normalizedFilters.limit) > 0 ? Number(normalizedFilters.limit) : 50;

    const response = await api.get('/report/bbps', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      params: normalizedFilters,
    });

    const payload = response?.data;
    const rows = extractRows(payload);
    const pagination = extractPagination(payload, fallbackPage, fallbackLimit);

    if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
      return {
        ...payload,
        data: rows,
        pagination,
      };
    }

    return {
      data: rows,
      pagination,
    };
  } catch (error) {
    console.error('[getCCBillPaymentReport] API Error:', {
      message: error?.message,
      status: error?.response?.status,
      responseData: error?.response?.data,
    });
    throw new Error(error.response?.data?.message || 'Failed to fetch CC bill payment report');
  }
};

// Execute manual refund for a failed CC Bill Payment
export const manualRefundCCBillPayment = async ({ reference_id, ledger_id, reason } = {}) => {
  try {
    const token = getAuthToken();
    if (!token) throw new Error('No token found');

    const response = await api.post(
      '/bbps-cc/manual-refund',
      { reference_id, ledger_id, reason },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    return response.data;
  } catch (error) {
    throw new Error(error.response?.data?.message || 'Manual refund failed');
  }
};

export const getAllCCBillPaymentReport = async (filters = {}, options = {}) => {
  const requestedLimit = Number(options.limit) > 0 ? Number(options.limit) : 200;
  const firstResponse = await getCCBillPaymentReport({
    ...filters,
    page: 1,
    limit: requestedLimit,
  });

  const firstRows = Array.isArray(firstResponse?.data) ? firstResponse.data : [];
  const pagination = extractPagination(firstResponse, 1, requestedLimit);

  if (pagination.totalPages > 1) {
    const remainingResponses = await Promise.all(
      Array.from({ length: pagination.totalPages - 1 }, (_, index) =>
        getCCBillPaymentReport({
          ...filters,
          page: index + 2,
          limit: requestedLimit,
        })
      )
    );

    return [firstRows, ...remainingResponses.map((response) => extractRows(response))].flat();
  }

  if (firstRows.length < requestedLimit) {
    return firstRows;
  }

  const allRows = [...firstRows];
  const previousPageSignatures = [firstRows.map(getCcBillRowSignature).join('||')];
  const maxPagesWithoutMetadata = 25;

  for (let page = 2; page <= maxPagesWithoutMetadata; page += 1) {
    const response = await getCCBillPaymentReport({
      ...filters,
      page,
      limit: requestedLimit,
    });
    const nextRows = Array.isArray(response?.data) ? response.data : [];

    if (nextRows.length === 0) {
      break;
    }

    const nextPageSignature = nextRows.map(getCcBillRowSignature).join('||');
    if (previousPageSignatures.includes(nextPageSignature)) {
      break;
    }

    previousPageSignatures.push(nextPageSignature);
    allRows.push(...nextRows);

    if (nextRows.length < requestedLimit) {
      break;
    }
  }

  return allRows;
};

export const getUserReport = async (filters = {}) => {
  try {
    const token = getAuthToken();
    if (!token) throw new Error('No token found');

    const response = await api.get('/report/users', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      params: filters,
    });

    return response.data;
  } catch (error) {
    throw new Error(error.response?.data?.message || 'Failed to fetch user report');
  }
};

const getAllUserReportRows = async (filters = {}, options = {}) => {
  const requestedLimit = Number(options.limit) > 0 ? Number(options.limit) : 500;
  const firstResponse = await getUserReport({
    ...filters,
    page: 1,
    limit: requestedLimit,
  });

  const firstRows = extractRows(firstResponse);
  const pagination = extractPagination(firstResponse, 1, requestedLimit);

  if (pagination.totalPages <= 1) {
    return firstRows;
  }

  const remainingResponses = await Promise.all(
    Array.from({ length: pagination.totalPages - 1 }, (_, index) =>
      getUserReport({
        ...filters,
        page: index + 2,
        limit: requestedLimit,
      })
    )
  );

  return [firstRows, ...remainingResponses.map(extractRows)].flat();
};

const getAllPayoutReportRows = async (filters = {}, options = {}) => {
  const requestedLimit = Number(options.limit) > 0 ? Number(options.limit) : 200;
  const firstResponse = await getPayoutReport({
    ...filters,
    page: 1,
    limit: requestedLimit,
  });

  const firstRows = extractRows(firstResponse);
  const pagination = extractPagination(firstResponse, 1, requestedLimit);

  if (pagination.totalPages <= 1) {
    return firstRows;
  }

  const remainingResponses = await Promise.all(
    Array.from({ length: pagination.totalPages - 1 }, (_, index) =>
      getPayoutReport({
        ...filters,
        page: index + 2,
        limit: requestedLimit,
      })
    )
  );

  return [firstRows, ...remainingResponses.map(extractRows)].flat();
};

const getAllBbpsReportRows = async (filters = {}, options = {}) => {
  const requestedLimit = Number(options.limit) > 0 ? Number(options.limit) : 200;
  const firstResponse = await getCCBillPaymentReport({
    ...filters,
    page: 1,
    limit: requestedLimit,
  });

  const firstRows = extractRows(firstResponse);
  const pagination = extractPagination(firstResponse, 1, requestedLimit);

  if (pagination.totalPages <= 1) {
    return firstRows;
  }

  const remainingResponses = await Promise.all(
    Array.from({ length: pagination.totalPages - 1 }, (_, index) =>
      getCCBillPaymentReport({
        ...filters,
        page: index + 2,
        limit: requestedLimit,
      })
    )
  );

  return [firstRows, ...remainingResponses.map(extractRows)].flat();
};

const FAILED_PAYOUT_STATUSES = new Set(['FAILED', 'FAILURE', 'REJECTED', 'CANCELLED', 'REVERSED']);
const SUCCESS_PAYOUT_STATUSES = new Set(['SUCCESS', 'COMPLETED']);
const PENDING_PAYOUT_STATUSES = new Set(['PENDING', 'PROCESSING', 'IN_PROGRESS', 'INPROCESS', 'INITIATED', 'INIT']);

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeUpperValue = (value) => String(value || '').trim().toUpperCase();
const normalizeLowerValue = (value) => String(value || '').trim().toLowerCase();
const normalizeTokenValue = (value) => String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
const formatChartDate = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getLastFiveDaysRange = () => {
  const end = new Date();
  end.setHours(0, 0, 0, 0);
  const start = new Date(end);
  start.setDate(start.getDate() - 4);

  return {
    from_date: formatChartDate(start),
    to_date: formatChartDate(end),
  };
};

const getRowDateKey = (row = {}) => {
  const candidates = [
    row?.date,
    row?.Date,
    row?.created_at,
    row?.createdAt,
    row?.updated_at,
    row?.updatedAt,
    row?.date_and_time,
  ];

  for (const value of candidates) {
    if (!value) continue;
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return formatChartDate(parsed);
    }
  }

  return '';
};

const getShortDisplayDate = (dateKey) => {
  if (!dateKey) return '';
  const parsed = new Date(`${dateKey}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return dateKey;

  return parsed.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
  });
};

const getNormalizedPayoutStatusKey = (status) => {
  const normalized = normalizeUpperValue(status);
  if (!normalized) return '';
  if (normalized === 'COMPLETED') return 'SUCCESS';
  if (normalized === 'PROCESSING' || normalized === 'IN_PROGRESS' || normalized === 'INPROCESS') {
    return 'PENDING';
  }
  return normalized;
};

const isProcessedPosTransaction = (row = {}) => {
  const normalizedStatus = normalizeLowerValue(row?.status || row?.Status);
  return (
    normalizedStatus === 'settled' ||
    normalizedStatus === 'success' ||
    normalizedStatus === 'captured' ||
    normalizedStatus === 'completed' ||
    normalizedStatus === 'paid'
  );
};

const createDailyBucket = (dateKey) => ({
  dateKey,
  label: getShortDisplayDate(dateKey),
  posTransactions: {
    t0Pos: 0,
    t0PosAmount: 0,
    t1Pos: 0,
    t1PosAmount: 0,
    totalPayouts: 0,
    totalPayoutsAmount: 0,
    processedPayouts: 0,
    processedPayoutsAmount: 0,
    unprocessedPayouts: 0,
    unprocessedPayoutsAmount: 0,
  },
  payouts: {
    branchx: {
      success: 0,
      successAmount: 0,
      failed: 0,
      failedAmount: 0,
      pending: 0,
      pendingAmount: 0,
    },
    vimo: {
      success: 0,
      successAmount: 0,
      failed: 0,
      failedAmount: 0,
      pending: 0,
      pendingAmount: 0,
    },
  },
});

const normalizeSettlementType = (value) => {
  const normalized = normalizeTokenValue(value);

  if (normalized === 'nextdaysettlement' || normalized === 't1' || normalized === 'tplus1') {
    return 'next_day_settlement';
  }

  if (normalized === 'todaysettlement' || normalized === 't0' || normalized === 't' || normalized === 'samedaysettlement') {
    return 'today_settlement';
  }

  return '';
};

const classifyPayoutProvider = (row = {}) => {
  const providerToken = normalizeTokenValue(row?.payout_provider);
  const referenceId = normalizeUpperValue(row?.reference_id);

  if (providerToken.includes('branchx')) return 'branchx';
  if (providerToken.includes('vimo')) return 'vimo';
  if (providerToken.includes('credxpay')) return 'credxpay';

  // Legacy payout rows may miss provider tagging, but the generated reference
  // prefixes still identify the provider family.
  if (referenceId.startsWith('APB')) return 'branchx';
  if (referenceId.startsWith('APV')) return 'vimo';
  if (referenceId.startsWith('APC') || referenceId.startsWith('PX')) return 'credxpay';

  return providerToken || '';
};

const getCurrentUserProfile = async () => {
  try {
    const token = getAuthToken();
    if (!token) throw new Error('No token found');

    const response = await api.get('/user/current', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    return response.data;
  } catch (error) {
    throw new Error(error.response?.data?.message || 'Failed to fetch current user details');
  }
};

export const getPosDashboardChartData = async (filters = {}) => {
  const normalizedFilters = normalizeReportFilters(filters);
  const lastFiveDays = getLastFiveDaysRange();
  const dateFilters = {
    from_date: normalizedFilters.from_date || lastFiveDays.from_date,
    to_date: normalizedFilters.to_date || lastFiveDays.to_date,
  };

  const [razorpayRows, payoutRows, bbpsRows] = await Promise.all([
    getAllPosTransactionReport(dateFilters, { limit: 200 }),
    getAllPayoutReportRows(dateFilters, { limit: 200 }),
    getAllBbpsReportRows(dateFilters, { limit: 200 }),
  ]);

  const dailyBuckets = [];
  const dailyBucketMap = new Map();
  const startDate = new Date(`${dateFilters.from_date}T00:00:00`);
  const endDate = new Date(`${dateFilters.to_date}T00:00:00`);

  for (let cursor = new Date(startDate); cursor <= endDate; cursor.setDate(cursor.getDate() + 1)) {
    const dateKey = formatChartDate(cursor);
    const bucket = createDailyBucket(dateKey);
    dailyBuckets.push(bucket);
    dailyBucketMap.set(dateKey, bucket);
  }

  let t0Pos = 0;
  let t1Pos = 0;

  razorpayRows.forEach((row) => {
    const rawSettlement = row?.settlement_type;
    const settlementType = normalizeSettlementType(rawSettlement);
    const amount = toNumber(row?.amount);

    const isT1 = settlementType === 'next_day_settlement';
    const isT0 = settlementType === 'today_settlement';

    if (isT0) {
      t0Pos += amount;
    } else if (isT1) {
      t1Pos += amount;
    }

    const rowDateKey = getRowDateKey(row);
    const bucket = dailyBucketMap.get(rowDateKey);
    if (!bucket) {
      return;
    }

    if (isT0) {
      bucket.posTransactions.t0Pos += 1;
      bucket.posTransactions.t0PosAmount += amount;
    } else if (isT1) {
      bucket.posTransactions.t1Pos += 1;
      bucket.posTransactions.t1PosAmount += amount;
    }

    bucket.posTransactions.totalPayouts += 1;
    bucket.posTransactions.totalPayoutsAmount += amount;

    if (isProcessedPosTransaction(row)) {
      bucket.posTransactions.processedPayouts += 1;
      bucket.posTransactions.processedPayoutsAmount += amount;
    } else {
      bucket.posTransactions.unprocessedPayouts += 1;
      bucket.posTransactions.unprocessedPayoutsAmount += amount;
    }
  });

  let payoutVimo = 0;
  let payoutBranchx = 0;

  payoutRows.forEach((row) => {
    const provider = classifyPayoutProvider(row);
    const amount = toNumber(row?.amount);
    const aggregateStatus = normalizeUpperValue(row?.status);

    if (provider === 'vimo' && !FAILED_PAYOUT_STATUSES.has(aggregateStatus)) {
      payoutVimo += amount;
    }

    if (provider === 'branchx' && !FAILED_PAYOUT_STATUSES.has(aggregateStatus)) {
      payoutBranchx += amount;
    }

    const rowDateKey = getRowDateKey(row);
    const bucket = dailyBucketMap.get(rowDateKey);
    if (!bucket) {
      return;
    }

    const normalizedStatus = getNormalizedPayoutStatusKey(row?.status);
    const providerBucket = bucket.payouts[provider];

    if (!providerBucket) {
      return;
    }

    if (SUCCESS_PAYOUT_STATUSES.has(normalizedStatus)) {
      providerBucket.success += 1;
      providerBucket.successAmount += amount;
      return;
    }

    if (FAILED_PAYOUT_STATUSES.has(normalizedStatus)) {
      providerBucket.failed += 1;
      providerBucket.failedAmount += amount;
      return;
    }

    if (PENDING_PAYOUT_STATUSES.has(normalizedStatus)) {
      providerBucket.pending += 1;
      providerBucket.pendingAmount += amount;
      return;
    }

    providerBucket.pending += 1;
    providerBucket.pendingAmount += amount;
  });

  const bbps = bbpsRows.reduce((sum, row) => sum + toNumber(row?.amount), 0);
  const bars = [
    { key: 't0_pos', label: 'T+0 POS', value: t0Pos },
    { key: 't1_pos', label: 'T+1 POS', value: t1Pos },
    { key: 'payout_vimo', label: 'PAYOUT VIMO', value: payoutVimo },
    { key: 'payout_branchx', label: 'PAYOUT BRANCHX', value: payoutBranchx },
    { key: 'bbps', label: 'BBPS', value: bbps },
  ];

  return {
    from_date: dateFilters.from_date || null,
    to_date: dateFilters.to_date || null,
    bars,
    daily: dailyBuckets,
  };
};
