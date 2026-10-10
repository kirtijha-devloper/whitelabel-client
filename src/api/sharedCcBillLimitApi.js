import axios from "axios";
import { BASE_URL } from "../constants";
import { getAuthToken } from "../utils/auth";

const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

const authHeaders = () => {
  const token = getAuthToken();
  if (!token) {
    throw new Error("Not Authorized");
  }
  return {
    Authorization: `Bearer ${token}`,
  };
};

/**
 * GET /api/shared-cc-bill-limit
 * Read configured Admin daily limit, consumed amount, reserved amount, and remaining capacity.
 * For Super Admin: supports optional query params { admin_id, company_id, business_date }.
 * For Admin / SF / Franchise / Merchant: server resolves the owning Admin automatically.
 */
export const getSharedCcBillLimit = async (params = {}) => {
  try {
    const response = await api.get("/shared-cc-bill-limit", {
      headers: authHeaders(),
      params,
    });
    return response.data;
  } catch (error) {
    const message =
      error?.response?.data?.message ||
      error?.message ||
      "Failed to fetch shared CC bill limit";
    const enrichedError = new Error(message);
    enrichedError.status = error?.response?.status;
    enrichedError.code = error?.response?.data?.code;
    enrichedError.data = error?.response?.data;
    throw enrichedError;
  }
};

/**
 * PUT /api/shared-cc-bill-limit
 * Super Admin updates the daily CC bill limit for an Admin.
 * Request body: { admin_id: Number, daily_limit: Number }
 */
export const updateSharedCcBillLimit = async ({ admin_id, daily_limit, company_id }) => {
  try {
    const payload = {
      daily_limit: Number(daily_limit),
    };
    if (admin_id !== undefined && admin_id !== null) {
      payload.admin_id = Number(admin_id);
    }
    if (company_id) {
      payload.company_id = String(company_id).trim();
    }

    const response = await api.put("/shared-cc-bill-limit", payload, {
      headers: authHeaders(),
    });
    return response.data;
  } catch (error) {
    const message =
      error?.response?.data?.message ||
      error?.message ||
      "Failed to update shared CC bill limit";
    const enrichedError = new Error(message);
    enrichedError.status = error?.response?.status;
    enrichedError.code = error?.response?.data?.code;
    enrichedError.data = error?.response?.data;
    throw enrichedError;
  }
};

