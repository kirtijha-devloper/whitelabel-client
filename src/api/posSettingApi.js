import axios from "axios";
import { BASE_URL } from "../constants";
import { getAuthToken } from "../utils/auth";

const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

const getAuthHeaders = () => {
  const token = getAuthToken();
  if (!token) {
    throw new Error("Not Authorized");
  }
  return {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };
};

/**
 * Fetch POS Settings summary stats and customer settlement details.
 */
export const fetchPosSettings = async () => {
  try {
    // Try primary POS Setting endpoint
    try {
      const response = await api.get("/admin/pos-setting", getAuthHeaders());
      if (response.data?.success === false) {
        throw new Error(response.data?.message || "Failed to fetch Settlement data");
      }
      return response.data;
    } catch (err) {
      try {
        const pgResp = await api.get("/admin/pg-setting", getAuthHeaders());
        if (pgResp.data?.success === false) {
          throw new Error(pgResp.data?.message || "Failed to fetch Settlement data");
        }
        return pgResp.data;
      } catch (fallbackError) {
        throw fallbackError;
      }
    }
  } catch (error) {
    throw error;
  }
};

/**
 * Update single customer T0 Daily Limit
 */
export const updateCustomerT0Limit = async (customerId, t0DailyLimit) => {
  const token = getAuthToken();
  const numericLimit = t0DailyLimit !== "" && t0DailyLimit !== null ? Number(t0DailyLimit) : null;

  try {
    // 1. Try POS endpoint
    try {
      const response = await api.post(
        "/admin/pos-setting/update-t0-limit",
        { id: customerId, t0_daily_limit: numericLimit },
        getAuthHeaders()
      );
      return response.data;
    } catch (err) {
      // 2. Try PG endpoint
      try {
        const pgResp = await api.post(
          "/admin/pg-setting/updateT0Limit",
          { id: customerId, t0_daily_limit: numericLimit },
          getAuthHeaders()
        );
        return pgResp.data;
      } catch (err2) {
        // 3. Fallback user update route (authorized for both admin and franchise)
        const userResp = await api.put(
          `/user/${customerId}`,
          { t0_daily_limit: numericLimit },
          getAuthHeaders()
        );
        return userResp.data;
      }
    }
  } catch (error) {
    console.error("Failed to update T0 limit on server:", error);
    throw error;
  }
};

/**
 * Update single user settlement mode (T0 or T1)
 */
export const updateUserSettlementType = async (customerId, settlementType) => {
  const token = getAuthToken();

  try {
    // 1. Try POS endpoint
    try {
      const response = await api.post(
        "/admin/pos-setting/update-settlement-type",
        { id: customerId, settlement_type: settlementType },
        getAuthHeaders()
      );
      return response.data;
    } catch (err) {
      // 2. Try PG endpoint
      try {
        const pgResp = await api.post(
          "/admin/pg-setting/updateT0Limit",
          { id: customerId, settlement_type: settlementType },
          getAuthHeaders()
        );
        return pgResp.data;
      } catch (err2) {
        // 3. Fallback user update route (authorized for both admin and franchise)
        const userResp = await api.put(
          `/user/${customerId}`,
          { settlement_type: settlementType, pos_settlement_type: settlementType },
          getAuthHeaders()
        );
        return userResp.data;
      }
    }
  } catch (error) {
    console.error("Failed to update settlement type on server:", error);
    throw error;
  }
};

/**
 * Bulk set settlement type (T0 or T1) for all customers
 */
export const bulkSetSettlementType = async (settlementType) => {
  try {
    try {
      const response = await api.post(
        "/admin/pos-setting/bulk-settlement",
        { settlement_type: settlementType },
        getAuthHeaders()
      );
      return response.data;
    } catch (err) {
      const userResp = await api.put(
        "/admin/users/settlement-type",
        { settlement_type: settlementType },
        getAuthHeaders()
      );
      return userResp.data;
    }
  } catch (error) {
    throw error;
  }
};
