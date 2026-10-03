import axios from "axios";
import { getAuthToken } from "../utils/auth";
import { BASE_URL } from '../constants';

const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

const inferRoleFromAbheepayId = (abheepayId = "") => {
  const normalized = String(abheepayId || "").toUpperCase();
  if (normalized.startsWith("APM")) return "merchant";
  if (normalized.startsWith("APF")) return "franchise";
  return null;
};

const normalizeLedgerRow = (row = {}) => ({
  ...row,
  type: row.type ?? row.transaction_type ?? row.description ?? "N/A",
  createdAt: row.createdAt ?? row.date ?? row.date_and_time ?? null,
  date_and_time: row.date_and_time ?? row.date ?? row.createdAt ?? null,
  user_role:
    row.user_role ??
    row.role ??
    row.user?.role ??
    inferRoleFromAbheepayId(row.user?.abheepay_id),
  merchant_id: row.merchant_id ?? row.user_id ?? row.user?.id ?? null,
  requested_by: row.requested_by ?? row.user?.name ?? row.metadata?.admin_name ?? "-",
  approved_by: row.approved_by ?? row.metadata?.admin_name ?? "-",
  reason: row.reason ?? row.metadata?.reason ?? row.description ?? "-",
  opening_balance: row.opening_balance ?? row.balance_before ?? 0,
  balance: row.balance ?? row.balance_after ?? 0,
  utr_no: row.utr_no ?? row.transaction_id ?? row.reference_id ?? "",
  reference_id:
    row.reference_id ??
    row.referenceId ??
    row.utr_no ??
    row.transaction_id ??
    row.metadata?.reference_id ??
    "",
  source:
    row.source ??
    row.metadata?.source ??
    row.transaction?.source ??
    row.event_json?.source ??
    "",
  bank:
    row.bank ??
    row.bank_name ??
    row.metadata?.bank ??
    row.metadata?.bank_name ??
    row.transaction?.bank ??
    row.event_json?.bank ??
    "",
  provider:
    row.provider ??
    row.provider_name ??
    row.metadata?.provider ??
    row.transaction?.provider ??
    row.event_json?.provider ??
    row.payout_provider ??
    "",
  cardClassification:
    row.cardClassification ??
    row.card_classification ??
    row.cardClassificationType ??
    row.paymentCardType ??
    row.payment_card_type ??
    row.metadata?.cardClassification ??
    row.metadata?.card_classification ??
    row.transaction?.cardClassification ??
    row.event_json?.cardClassification ??
    "",
  service: row.service ?? row.transaction_type ?? row.description ?? "General",
});

const normalizeLedgerResponse = (payload) => {
  const safePayload =
    payload && typeof payload === "object" && !Array.isArray(payload) ? payload : {};

  const rawRows =
    (Array.isArray(safePayload.transactions) && safePayload.transactions) ||
    (Array.isArray(safePayload.data) && safePayload.data) ||
    (Array.isArray(safePayload.rows) && safePayload.rows) ||
    (Array.isArray(payload) && payload) ||
    [];

  const rows = rawRows.map(normalizeLedgerRow);

  return {
    ...safePayload,
    transactions: rows,
    data: rows,
    count: safePayload.count ?? rows.length,
  };
};

export const getLedgerStatements = async (filters = {}) => {
  try {
    const token = getAuthToken();
    if (!token) throw new Error("No token found");

    const {
      searched_role,
      from_date,
      to_date,
      start_date,
      end_date,
      startDate,
      endDate,
      __debug,
      transaction_type,
      ...restFilters
    } = filters;
    const normalizedFromDate = from_date ?? start_date ?? startDate;
    const normalizedToDate = to_date ?? end_date ?? endDate;
    const requestParams = {
      ...restFilters,
      ...(transaction_type
        ? {
            transaction_type: Array.isArray(transaction_type)
              ? transaction_type.filter(Boolean).join(",")
              : transaction_type,
          }
        : {}),
      ...(normalizedFromDate ? { from_date: normalizedFromDate } : {}),
      ...(normalizedToDate ? { to_date: normalizedToDate } : {}),
      ...(searched_role ? { role: searched_role, searched_role } : {}),
    };

    const response = await api.get("/report/ledger", {
      headers: { Authorization: `Bearer ${token}` },
      params: requestParams,
    });

    if (__debug) {
      const rawRows = Array.isArray(response?.data?.data)
        ? response.data.data
        : Array.isArray(response?.data?.transactions)
          ? response.data.transactions
          : [];

      console.groupCollapsed("[ledgerApi] GET /report/ledger");
      console.info("requestParams", requestParams);
      console.info("rawResponse", response.data);
      console.info(
        "statusPreview",
        rawRows.slice(0, 10).map((row) => ({
          id: row?.id,
          status: row?.status,
          transaction_type: row?.transaction_type,
        }))
      );
      console.groupEnd();
    }

    return normalizeLedgerResponse(response.data);
  } catch (error) {
    console.error("Error fetching ledger statements:", error);
    throw new Error(error.response?.data?.message || "Failed to fetch ledger statements");
  }
};

export const getLedgerEntries = async (params = {}) => {
  try {
    const token = getAuthToken();
    if (!token) throw new Error("No token found");

    const { start_date, end_date, transaction_type, status, page, limit } = params;

    const response = await api.get("/ledger/entries", {
      headers: { Authorization: `Bearer ${token}` },
      params: {
        page: page || 1,
        limit: limit || 50,
        ...(start_date ? { start_date } : {}),
        ...(end_date ? { end_date } : {}),
        ...(transaction_type ? { transaction_type } : {}),
        ...(status ? { status } : {}),
      },
    });
    return response.data;
  } catch (error) {
    console.error("Error fetching ledger entries:", error);
    throw new Error(error.response?.data?.message || "Failed to fetch ledger entries");
  }
};

export const getAllLedgerEntries = async (params = {}, options = {}) => {
  try {
    const token = getAuthToken();
    if (!token) throw new Error("No token found");

    const requestedLimit = Number(options.limit) > 0 ? Number(options.limit) : 200;
    const baseParams = {
      ...params,
      page: 1,
      limit: requestedLimit,
    };

    const firstResponse = await api.get("/ledger/entries", {
      headers: { Authorization: `Bearer ${token}` },
      params: baseParams,
    });

    const firstData = Array.isArray(firstResponse?.data?.data) ? firstResponse.data.data : [];
    const pagination = firstResponse?.data?.pagination || {};
    const totalPages = Number(pagination.totalPages || 1);

    if (totalPages <= 1) {
      return {
        ...firstResponse.data,
        data: firstData,
      };
    }

    const remainingPages = await Promise.all(
      Array.from({ length: totalPages - 1 }, (_, index) => {
        const page = index + 2;
        return api
          .get("/ledger/entries", {
            headers: { Authorization: `Bearer ${token}` },
            params: {
              ...params,
              page,
              limit: requestedLimit,
            },
          })
          .then((response) => (Array.isArray(response?.data?.data) ? response.data.data : []));
      })
    );

    return {
      ...firstResponse.data,
      data: [firstData, ...remainingPages].flat(),
      pagination: {
        ...pagination,
        totalPages,
      },
    };
  } catch (error) {
    console.error("Error fetching all ledger entries:", error);
    throw new Error(error.response?.data?.message || "Failed to fetch ledger entries");
  }
};
