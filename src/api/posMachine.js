import axios from 'axios';
import * as XLSX from "xlsx";
import { getAuthToken } from '../utils/auth';
import { BASE_URL } from '../constants';

const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

const logStockPosApi = () => {};

const normalizeMachineStatus = (value) => {
  const raw = String(value || "").trim().toLowerCase().replace(/_/g, "-");
  if (!raw) return "";

  if (raw === "in-active" || raw === "inactive") return "inactive";
  if (raw === "return-initiated" || raw === "returned-initiated") return "returned-initiated";
  return raw;
};

const normalizeCompanyToken = (value) =>
  String(value ?? "")
    .trim()
    .toLowerCase();

const buildApprovedCompanyLookup = (companyRecords = []) => {
  const lookup = new Map();

  companyRecords.forEach((record) => {
    const rawName =
      typeof record === "string"
        ? record
        : record?.name;
    const companyName = String(rawName || "").trim();
    const token = normalizeCompanyToken(companyName);

    if (token && !lookup.has(token)) {
      lookup.set(token, companyName);
    }
  });

  return lookup;
};

// Get all POS machines
export const getAllPosMachines = async ({ tidNumber = null, companyName = null, page = 1, limit = 10 } = {}) => {
  try {
    const token = getAuthToken();
    if (!token) throw new Error("Not Authorized");

    const params = new URLSearchParams();
    if (tidNumber) params.append('tid_number', tidNumber);
    if (companyName) params.append('company_name', companyName);
    params.append('page', page);
    params.append('limit', limit);
    const listEndpoint = `/pos-machine/list?${params.toString()}`;
    const legacyEndpoint = `/pos-machine/?${params.toString()}`;
    const headers = {
      Authorization: `Bearer ${token}`,
    };

    logStockPosApi("GET request", {
      endpoint: listEndpoint,
      fallbackEndpoint: legacyEndpoint,
      params: {
        tidNumber,
        page,
        limit,
      },
    });

    const extractListData = (rawPayload) => {
      const payload = rawPayload ?? {};
      const container =
        payload?.data && typeof payload.data === "object" ? payload.data : null;

      const listData =
        Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.data)
            ? payload.data
            : Array.isArray(payload?.list)
              ? payload.list
              : Array.isArray(payload?.rows)
                ? payload.rows
                : Array.isArray(container?.list)
                  ? container.list
                  : Array.isArray(container?.rows)
                    ? container.rows
                    : Array.isArray(container?.data)
                      ? container.data
                      : [];

      return { payload, container, listData };
    };

    const hasCoreMachineFields = (machines) =>
      Array.isArray(machines) &&
      machines.every((machine) =>
        machine &&
        Object.prototype.hasOwnProperty.call(machine, "mid_number") &&
        Object.prototype.hasOwnProperty.call(machine, "device_serial_number")
      );

    let parsed;
    try {
      const response = await api.get(listEndpoint, { headers });
      logStockPosApi("GET response", {
        endpoint: listEndpoint,
        response: response?.data,
      });
      parsed = extractListData(response?.data);
    } catch (error) {
      // Backward compatibility: keep old endpoint as fallback when /list is unavailable.
      if (error?.response?.status === 404) {
        logStockPosApi("GET fallback", {
          from: listEndpoint,
          to: legacyEndpoint,
          reason: "404 from list endpoint",
        });
        const response = await api.get(legacyEndpoint, { headers });
        logStockPosApi("GET response", {
          endpoint: legacyEndpoint,
          response: response?.data,
        });
        parsed = extractListData(response?.data);
      } else {
        logStockPosApi("GET error", {
          endpoint: listEndpoint,
          error: error.response?.data || error.message,
        });
        throw error;
      }
    }

    // Some deployments return incomplete machine fields from /list.
    // If core keys are missing, prefer the legacy endpoint payload.
    if (parsed?.listData?.length && !hasCoreMachineFields(parsed.listData)) {
      try {
        const legacyResponse = await api.get(legacyEndpoint, { headers });
        logStockPosApi("GET legacy enrichment response", {
          endpoint: legacyEndpoint,
          response: legacyResponse?.data,
        });
        const legacyParsed = extractListData(legacyResponse?.data);
        if (legacyParsed?.listData?.length && hasCoreMachineFields(legacyParsed.listData)) {
          parsed = legacyParsed;
        }
      } catch {
        // Keep original /list payload when legacy endpoint is unavailable.
      }
    }

    const payload = parsed?.payload ?? {};
    const container = parsed?.container ?? null;
    const listData = parsed?.listData ?? [];

    const n = (value, fallback = 0) => {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : fallback;
    };

    const basePagination = payload?.pagination || container?.pagination || {};
    const resolvedLimit = n(
      basePagination?.limit ??
      basePagination?.per_page ??
      payload?.limit ??
      payload?.per_page ??
      container?.limit ??
      container?.per_page,
      n(limit, 10)
    );
    const resolvedTotal = n(
      basePagination?.total ??
      basePagination?.count ??
      payload?.total ??
      payload?.count ??
      payload?.total_count ??
      payload?.totalRecords ??
      container?.total ??
      container?.count ??
      container?.total_count ??
      container?.totalRecords,
      0
    );
    const pagesFromFields = n(
      basePagination?.totalPages ??
      basePagination?.total_pages ??
      basePagination?.pages ??
      basePagination?.last_page ??
      payload?.totalPages ??
      payload?.total_pages ??
      payload?.pages ??
      payload?.last_page ??
      container?.totalPages ??
      container?.total_pages ??
      container?.pages ??
      container?.last_page,
      0
    );
    const pagesFromTotal = resolvedTotal > 0 && resolvedLimit > 0
      ? Math.ceil(resolvedTotal / resolvedLimit)
      : 0;
    const resolvedTotalPages = Math.max(pagesFromFields, pagesFromTotal);
    const resolvedPage = n(
      basePagination?.page ??
      basePagination?.current_page ??
      payload?.page ??
      payload?.current_page ??
      container?.page ??
      container?.current_page,
      n(page, 1)
    );

    const normalized = {
      data: listData.map((machine) => ({
        ...machine,
        status: normalizeMachineStatus(machine?.status),
      })),
      pagination: {
        ...basePagination,
        total: resolvedTotal,
        page: resolvedPage,
        limit: resolvedLimit,
        totalPages: resolvedTotalPages,
      },
    };

    logStockPosApi("GET normalized result", {
      endpoint: listEndpoint,
      totalRecords: normalized?.pagination?.total ?? normalized?.data?.length ?? 0,
      page: normalized?.pagination?.page ?? page,
      recordsOnPage: normalized?.data?.length ?? 0,
    });

    return normalized;
  } catch (error) {
    logStockPosApi("GET failure", {
      endpoint: "/pos-machine/list",
      error: error.response?.data || error.message,
    });
    throw new Error(error.response?.data?.message || "Failed to fetch POS machines");
  }
};

// Get assigned POS machines for a user
export const getAssignedPosMachines = async ({
  userId,
  status = null,
  page = 1,
  limit = 50,
} = {}) => {
  if (!Number.isFinite(Number(userId))) {
    throw new Error("Invalid user ID");
  }

  try {
    const token = getAuthToken();
    if (!token) throw new Error("Not Authorized");

    const params = new URLSearchParams();
    if (status) params.append("status", status);
    params.append("page", page);
    params.append("limit", limit);

    const endpoint = `/pos-machine/assigned/${userId}?${params.toString()}`;

    logStockPosApi("GET request", { endpoint, params: { userId, status, page, limit } });

    const response = await api.get(endpoint, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    logStockPosApi("GET response", { endpoint, response: response?.data });

    return response.data;
  } catch (error) {
    logStockPosApi("GET error", {
      endpoint: `/pos-machine/assigned/${userId}`,
      error: error.response?.data || error.message,
    });

    throw new Error(
      error.response?.data?.message || "Failed to fetch assigned POS machines"
    );
  }
};

// Create new POS machine
export const createPosMachine = async (data) => {
  const endpoint = "/pos-machine/";

  try {
    const token = getAuthToken();
    if(!token) throw new Error("Not Authorized");

    logStockPosApi("POST request", {
      endpoint,
      payload: data,
    });

    const response = await api.post(endpoint, data, {
      headers:{
        Authorization: `Bearer ${token}`
      }
    });

    logStockPosApi("POST response", {
      endpoint,
      response: response?.data,
    });

    return response.data;
  } catch (error) {
    logStockPosApi("POST error", {
      endpoint,
      payload: data,
      error: error.response?.data || error.message,
    });
    throw new Error(error.response?.data?.message || 'Failed to create POS machine');
  }
};

// Get single POS machine
export const getPosMachine = async (id) => {
  const endpoint = `/pos-machine/${id}`;

  try {
    const token = getAuthToken();
    if(!token) throw new Error("Not Authorized");

    logStockPosApi("GET single request", { endpoint });

    const response = await api.get(endpoint,{
      headers:{
        Authorization: `Bearer ${token}`
      }
    });

    logStockPosApi("GET single response", {
      endpoint,
      response: response?.data,
    });

    return response.data;
  } catch (error) {
    logStockPosApi("GET single error", {
      endpoint,
      error: error.response?.data || error.message,
    });
    throw new Error(error.response?.data?.message || 'Failed to fetch POS machine');
  }
};

// Activate POS machine
export const activatePosMachine = async (id) => {
  const endpoint = `/pos-machine/activate/${id}`;

  try {
    const token = getAuthToken();
    if(!token) throw new Error("Not Authorized");

    logStockPosApi("PUT request", {
      endpoint,
      payload: {},
    });

    const response = await api.put(endpoint,{}, {
      headers:{
        Authorization: `Bearer ${token}`
      }
    });

    logStockPosApi("PUT response", {
      endpoint,
      response: response?.data,
    });

    return response.data;
  } catch (error) {
    logStockPosApi("PUT error", {
      endpoint,
      error: error.response?.data || error.message,
    });
    throw new Error(error.response?.data?.message || 'Failed to activate POS machine');
  }
};

// Deactivate POS machine
export const deactivatePosMachine = async (id) => {
  const endpoint = `/pos-machine/de-activate/${id}`;

  try {
    const token = getAuthToken();
    if(!token) throw new Error("Not Authorized");

    logStockPosApi("PUT request", {
      endpoint,
      payload: {},
    });

    const response = await api.put(endpoint,{},{
      headers:{
        Authorization: `Bearer ${token}`
      }
    });

    logStockPosApi("PUT response", {
      endpoint,
      response: response?.data,
    });

    return response.data;
  } catch (error) {
    logStockPosApi("PUT error", {
      endpoint,
      error: error.response?.data || error.message,
    });
    throw new Error(error.response?.data?.message || 'Failed to deactivate POS machine');
  }
};

export const deletePosMachine = async (id) => {
  const endpoint = `/pos-machine/${id}`;

  try {
    const token = getAuthToken();
    if(!token) throw new Error("Not Authorized");

    logStockPosApi("DELETE request", { endpoint });

    const response = await api.delete(endpoint, {
      headers:{
        Authorization: `Bearer ${token}`
      }
    });

    logStockPosApi("DELETE response", {
      endpoint,
      response: response?.data,
    });

    return response.data;
  } catch (error) {
    logStockPosApi("DELETE error", {
      endpoint,
      error: error.response?.data || error.message,
    });
    throw new Error(error.response?.data?.message || 'Failed to delete POS machine');
  }
};

// Mark as delivered
export const markAsDelivered = async (id) => {
  const endpoint = `/pos-machine/delivered/${id}`;

  try {
    const token = getAuthToken();
    if(!token) throw new Error("Not Authorized");

    logStockPosApi("PUT request", {
      endpoint,
      payload: {},
    });

    const response = await api.put(endpoint,{}, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    logStockPosApi("PUT response", {
      endpoint,
      response: response?.data,
    });

    return response.data;
  } catch (error) {
    logStockPosApi("PUT error", {
      endpoint,
      error: error.response?.data || error.message,
    });
    throw new Error(error.response?.data?.message || 'Failed to mark POS machine as delivered');
  }
};

// Mark return initiated
export const markAsReturnInitiated = async (id, remarks) => {
  const endpoint = `/pos-machine/returned-initiated/${id}`;

  try {
    const token = getAuthToken();
    if(!token) throw new Error("Not Authorized");

    logStockPosApi("PUT request", {
      endpoint,
      payload: { remarks },
    });

    const response = await api.put(endpoint, { remarks }, {
      headers:{
        Authorization: `Bearer ${token}`
      }
    });

    logStockPosApi("PUT response", {
      endpoint,
      response: response?.data,
    });

    return response.data;
  } catch (error) {
    logStockPosApi("PUT error", {
      endpoint,
      payload: { remarks },
      error: error.response?.data || error.message,
    });
    throw new Error(error.response?.data?.message || 'Failed to mark POS machine return');
  }
};

// Assign to franchise
export const assignToFranchise = async (ids, franchiseId) => {
  const endpoint = "/pos-machine/assign-franchise";

  try {
    const token = getAuthToken();
    if(!token) throw new Error("Not Authorized");

    logStockPosApi("POST request", {
      endpoint,
      payload: { ids, franchiseId },
    });

    const response = await api.post(endpoint, { ids, franchiseId }, {
      headers:{
        Authorization: `Bearer ${token}`
      }
    });

    logStockPosApi("POST response", {
      endpoint,
      response: response?.data,
    });

    return response.data;
  } catch (error) {
    logStockPosApi("POST error", {
      endpoint,
      payload: { ids, franchiseId },
      error: error.response?.data || error.message,
    });
    throw new Error(error.response?.data?.message || 'Failed to assign POS machines to franchise');
  }
};

// Assign to merchant
export const assignToMerchant = async (ids, merchantId) => {
  const endpoint = "/pos-machine/assign-merchant";

  try {
    const token = getAuthToken();
    if(!token) throw new Error("Not Authorized");

    logStockPosApi("POST request", {
      endpoint,
      payload: { ids, merchantId },
    });

    const response = await api.post(endpoint, { ids, merchantId }, {
      headers:{
        Authorization: `Bearer ${token}`
      }
    });

    logStockPosApi("POST response", {
      endpoint,
      response: response?.data,
    });

    return response.data;
  } catch (error) {
    logStockPosApi("POST error", {
      endpoint,
      payload: { ids, merchantId },
      error: error.response?.data || error.message,
    });
    throw new Error(error.response?.data?.message || 'Failed to assign POS machines to merchant');
  }
};


// Assign POS Machine to Merchant
export const assignPosMachineToMerchant = async (posMachineId, merchantId) => {
  const endpoint = "/pos-machine/assign-to-merchant";

  try {
    const token = getAuthToken();
    if (!token) throw new Error("Not Authorized");

    if (!posMachineId) throw new Error("No POS machine selected");

    logStockPosApi("POST request", {
      endpoint,
      payload: { id: Number(posMachineId), user_id: Number(merchantId) },
    });

    const response = await api.post(
      endpoint,
      { id: Number(posMachineId), user_id: Number(merchantId) },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    logStockPosApi("POST response", {
      endpoint,
      response: response?.data,
    });

    return response.data;
  } catch (error) {
    logStockPosApi("POST error", {
      endpoint,
      payload: { id: posMachineId, user_id: merchantId },
      error: error.response?.data || error.message,
    });
    throw new Error(error.response?.data?.message || "Failed to assign POS machine");
  }
};
export const assignPosMachineToSuperFranchise = async (posMachineId, superFranchiseId) => {
  const endpoint = "/pos-machine/assign-to-super-franchise";

  try {
    const token = getAuthToken();
    if (!token) throw new Error("Not Authorized");

    if (!posMachineId) throw new Error("No POS machine selected");

    logStockPosApi("POST request", {
      endpoint,
      payload: { id: Number(posMachineId), user_id: Number(superFranchiseId) },
    });

    const response = await api.post(
      endpoint,
      { id: Number(posMachineId), user_id: Number(superFranchiseId) },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    logStockPosApi("POST response", {
      endpoint,
      response: response?.data,
    });

    return response.data;
  } catch (error) {
    logStockPosApi("POST error", {
      endpoint,
      payload: { id: posMachineId, user_id: merchantId },
      error: error.response?.data || error.message,
    });
    throw new Error(error.response?.data?.message || "Failed to assign POS machine");
  }
};

// Assign POS Machine to Franchise
export const assignPosMachineToFranchise = async (posMachineIds, userId) => {
  const endpoint = "/pos-machine/assign";

  try {
    const token = getAuthToken();
    if (!token) throw new Error("Not Authorized");

    const ids = Array.isArray(posMachineIds) ? posMachineIds : [posMachineIds];
    const validIds = ids.filter(Boolean);
    if (!validIds.length) throw new Error("No POS machine selected");

    logStockPosApi("POST request", {
      endpoint,
      payload: {
        ids: validIds,
        user_id: userId,
      },
    });

    const response = await api.post(
      endpoint,
      { ids: validIds, user_id: userId === null ? null : Number(userId) },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    logStockPosApi("POST response", {
      endpoint,
      response: response?.data,
    });

    return response.data;
  } catch (error) {
    logStockPosApi("POST error", {
      endpoint,
      payload: {
        ids: posMachineIds,
        user_id: userId,
      },
      error: error.response?.data || error.message,
    });
    throw new Error(error.response?.data?.message || "Failed to assign POS machines to franchise");
  }
};

export const unassignPosMachine = async (posMachineId) => {
  const endpoint = `/pos-machine/unassign/${posMachineId}`;

  try {
    const token = getAuthToken();
    if (!token) throw new Error("Not Authorized");

    logStockPosApi("PUT request", {
      endpoint,
    });

    const response = await api.put(endpoint, {}, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    logStockPosApi("PUT response", {
      endpoint,
      response: response?.data,
    });

    return response.data;
  } catch (error) {
    logStockPosApi("PUT error", {
      endpoint,
      error: error.response?.data || error.message,
    });
    throw new Error(error.response?.data?.message || "Failed to unassign POS machine");
  }
};

export const updatePosMachine = async (id, data)=>{
  const endpoint = `/pos-machine/${id}`;

  try{
    const token = getAuthToken();
    if(!token) throw new Error("Not Authorized");

    logStockPosApi("PUT request", {
      endpoint,
      payload: data,
    });

    const response = await api.put(endpoint,data, {
      headers:{
        Authorization: `Bearer ${token}`
      }
    });

    logStockPosApi("PUT response", {
      endpoint,
      response: response?.data,
    });

    return response.data;
  }
  catch(error){
    logStockPosApi("PUT error", {
      endpoint,
      payload: data,
      error: error.response?.data || error.message,
    });
    throw new Error(error.response?.data?.message || "Failed to update pos machine")
  }
}

const BULK_TEMPLATE_HEADER_TOKENS_5 = ["sl", "company_name", "device_sl_no", "tid", "mid"];
const BULK_TEMPLATE_HEADER_TOKENS_6 = ["sl", "company_name", "device_sl_no", "tid", "mid", "bank_name"];
const BULK_TEMPLATE_LABEL = "SL, Company Name, Device SL No, TID, MID, Bank Name";
const BULK_CANONICAL_HEADERS = [
  "tid_number",
  "mid_number",
  "device_serial_number",
  "company_name",
];

const isExcelFile = (file) => {
  const fileName = String(file?.name || "").toLowerCase();
  const fileType = String(file?.type || "").toLowerCase();

  return (
    fileName.endsWith(".xlsx") ||
    fileName.endsWith(".xls") ||
    fileType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    fileType === "application/vnd.ms-excel"
  );
};

const normalizeHeaderToken = (headerValue) =>
  String(headerValue || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
    .replace(/[^a-z0-9_]/g, "")
    .replace(/^_+|_+$/g, "");

const expandScientificNotation = (value) => {
  const input = String(value || "").trim();
  const match = input.match(/^([+-]?)(\d+)(?:\.(\d+))?[eE]([+-]?\d+)$/);
  if (!match) return input;

  const [, sign, intPart, fracPart = "", expPart] = match;
  const exponent = Number(expPart);
  if (!Number.isInteger(exponent)) return input;

  const digits = `${intPart}${fracPart}`;
  const decimalPointIndex = intPart.length;
  const nextIndex = decimalPointIndex + exponent;

  let normalized;
  if (nextIndex <= 0) {
    normalized = `0.${"0".repeat(Math.abs(nextIndex))}${digits}`;
  } else if (nextIndex >= digits.length) {
    normalized = `${digits}${"0".repeat(nextIndex - digits.length)}`;
  } else {
    normalized = `${digits.slice(0, nextIndex)}.${digits.slice(nextIndex)}`;
  }

  const withoutTrailingZeros = normalized
    .replace(/\.0+$/, "")
    .replace(/(\.\d*?[1-9])0+$/, "$1");

  const safeNormalized = withoutTrailingZeros || "0";
  return `${sign}${safeNormalized}`;
};

const normalizeIdentifierValue = (value) => {
  const raw = String(value ?? "").trim().replace(/^'+/, "");
  if (!raw) return "";

  const withoutSeparators = raw.replace(/,/g, "");
  const expanded = expandScientificNotation(withoutSeparators);

  if (/^\d+\.0+$/.test(expanded)) {
    return expanded.replace(/\.0+$/, "");
  }

  return expanded;
};

const toCsvValue = (value) => {
  const cell = String(value ?? "");
  if (/[",\n\r]/.test(cell)) {
    return `"${cell.replace(/"/g, '""')}"`;
  }
  return cell;
};

const readWorkbookFromUploadFile = async (file) => {
  const buffer = await file.arrayBuffer();
  return XLSX.read(buffer, { type: "array" });
};

const getPrimarySheet = (workbook) => {
  const names = workbook?.SheetNames || [];
  for (const sheetName of names) {
    const sheet = workbook?.Sheets?.[sheetName];
    if (!sheet) continue;
    const rows = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      raw: false,
      defval: "",
      blankrows: false,
    });
    if (rows.length > 0) {
      return sheet;
    }
  }
  return null;
};

const buildCanonicalBulkCsv = (sheet, companyRecords = []) => {
  const rows = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    raw: false,
    defval: "",
    blankrows: false,
  });

  if (!rows.length) {
    throw new Error("Upload file is empty");
  }

  const approvedCompanies = buildApprovedCompanyLookup(companyRecords);
  if (!approvedCompanies.size) {
    throw new Error("No company names are available for validation. Add a company name first.");
  }

  const headerRow = Array.isArray(rows[0]) ? rows[0] : [];
  const normalizedHeaders = headerRow.map(normalizeHeaderToken).filter(Boolean);
  const is5HeaderFormat =
    normalizedHeaders.length === 5 &&
    BULK_TEMPLATE_HEADER_TOKENS_5.every((token, index) => normalizedHeaders[index] === token);
  const is6HeaderFormat =
    normalizedHeaders.length === 6 &&
    BULK_TEMPLATE_HEADER_TOKENS_6.every((token, index) => normalizedHeaders[index] === token);

  if (!is5HeaderFormat && !is6HeaderFormat) {
    throw new Error(`Invalid Excel header format. Expected exact headers/order: ${BULK_TEMPLATE_LABEL}`);
  }

  const dataRows = [];
  const validationErrors = [];
  for (let i = 1; i < rows.length; i += 1) {
    const row = Array.isArray(rows[i]) ? rows[i] : [];

    const sl = String(row[0] ?? "").trim();
    const companyName = String(row[1] ?? "").trim();
    const deviceSerial = normalizeIdentifierValue(row[2]);
    const tid = normalizeIdentifierValue(row[3]);
    const mid = normalizeIdentifierValue(row[4]);

    const hasAnyValue = [sl, companyName, deviceSerial, tid, mid].some((v) => String(v).trim() !== "");
    if (!hasAnyValue) continue;

    if (!deviceSerial || !tid || !mid) {
      throw new Error(`Invalid row ${i + 1}. Required values: Device SL No, TID, MID`);
    }

    if (!companyName) {
      validationErrors.push({
        row: {
          company_name: companyName,
          device_serial_number: deviceSerial,
          tid_number: tid,
          mid_number: mid,
          serial_number: deviceSerial,
        },
        error: "Company name is required.",
      });
      continue;
    }

    const companyToken = normalizeCompanyToken(companyName);
    const matchedCompanyName = approvedCompanies.get(companyToken);

    if (!matchedCompanyName) {
      validationErrors.push({
        row: {
          company_name: companyName,
          device_serial_number: deviceSerial,
          tid_number: tid,
          mid_number: mid,
          serial_number: deviceSerial,
        },
        error: `Invalid company name: ${companyName}. Please use an approved company name.`,
      });
      continue;
    }

    dataRows.push([tid, mid, deviceSerial, matchedCompanyName]);
  }

  if (!dataRows.length) {
    const validationError = new Error(
      validationErrors.length
        ? "No valid rows found. All rows were skipped because company names were missing or invalid."
        : "Upload file has no valid data rows"
    );
    validationError.validationErrors = validationErrors;
    throw validationError;
  }

  const csvRows = [BULK_CANONICAL_HEADERS, ...dataRows];
  const canonicalCsv = csvRows
    .map((row) => row.map(toCsvValue).join(","))
    .join("\n");

  logStockPosApi("Bulk upload validation summary", {
    totalDataRows: rows.length - 1,
    validRows: dataRows.length,
    skippedRows: validationErrors.length,
    validationErrors,
  });

  return {
    canonicalCsv,
    validationErrors,
  };
};

const normalizeBulkUploadFile = async (file, companyRecords = []) => {
  if (!file) {
    throw new Error("Please select an Excel file");
  }

  if (!isExcelFile(file)) {
    throw new Error("Please upload a valid Excel file (.xlsx or .xls)");
  }

  const workbook = await readWorkbookFromUploadFile(file);
  const sheet = getPrimarySheet(workbook);

  if (!sheet) {
    throw new Error("Upload file has no readable sheet");
  }

  const { canonicalCsv, validationErrors } = buildCanonicalBulkCsv(sheet, companyRecords);
  const csvName = String(file.name || "bulk-upload")
    .replace(/\.(xlsx|xls)$/i, "")
    .concat(".csv");

  return {
    normalizedFile: new File([canonicalCsv], csvName, { type: "text/csv" }),
    validationErrors,
  };
};

export const bulkCreatePosMachines = async (file, companyRecords = []) => {
  const endpoint = "/pos-machine/bulk-create";

  try {
    const token = getAuthToken();
    if (!token) throw new Error("Not Authorized");

    logStockPosApi("POST request", {
      endpoint,
      fileName: file?.name || null,
      approvedCompanyCount: companyRecords.length,
    });

    const { normalizedFile, validationErrors } = await normalizeBulkUploadFile(file, companyRecords);

    // Create FormData object for file upload
    const formData = new FormData();
    formData.append("file", normalizedFile);

    const response = await api.post(endpoint, formData, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "multipart/form-data",
      },
    });

    const responseData = response?.data || {};
    const mergedErrors = [
      ...(Array.isArray(responseData?.errors) ? responseData.errors : []),
      ...validationErrors,
    ];
    const invalidCompanyRows = validationErrors.length;
    const summaryMessage = invalidCompanyRows
      ? `${responseData.message || "Bulk upload completed"} Skipped ${invalidCompanyRows} row${invalidCompanyRows > 1 ? "s" : ""} due to missing or invalid company name.`
      : responseData.message || "Bulk upload completed";

    const finalResponse = {
      ...responseData,
      message: summaryMessage,
      errors: mergedErrors,
    };

    logStockPosApi("POST response", {
      endpoint,
      response: finalResponse,
    });

    return finalResponse;
  } catch (error) {
    logStockPosApi("POST error", {
      endpoint,
      fileName: file?.name || null,
      error: error.response?.data || error.message,
    });
    const wrappedError = new Error(
      error.response?.data?.message || error.message || "Failed to bulk create POS machines"
    );
    wrappedError.validationErrors = error.validationErrors || [];
    throw wrappedError;
  }
};

// export const assignPosMachineToUserID = async(posMachineIds)=>{
//   try{
//     const token = getAuthToken();
//     if (!token) throw new Error("Not Authorized");

//     const response = await api.post(`/pos-machine/assign`,)
//   }
// }
