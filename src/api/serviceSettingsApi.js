import axios from "axios";
import { BASE_URL } from "../constants";
import { getAuthToken } from "../utils/auth";

const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

const SERVICE_SETTINGS_BASE = "/admin/service-settings";

const getAuthHeaders = () => {
  const token = getAuthToken();
  if (!token) {
    throw new Error("No token found");
  }
  return {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };
};

const toApiError = (error, fallbackMessage) =>
  new Error(error?.response?.data?.message || error?.message || fallbackMessage);

const extractData = (payload) => {
  if (Array.isArray(payload)) {
    return payload[0]?.data || payload[0] || {};
  }
  return payload?.data || payload || {};
};

export const fetchServiceSettings = async () => {
  try {
    const response = await api.get(SERVICE_SETTINGS_BASE, getAuthHeaders());
    const data = extractData(response.data);
    return data;
  } catch (error) {
    throw toApiError(error, "Failed to load service settings");
  }
};

export const updateServiceSettings = async (payload) => {
  try {
    const response = await api.put(SERVICE_SETTINGS_BASE, payload, getAuthHeaders());
    const data = extractData(response.data);
    return data;
  } catch (error) {
    throw toApiError(error, "Failed to update service settings");
  }
};

export const updateUserServiceSettings = async (userId, payload) => {
  const numericUserId = Number(userId);
  if (!Number.isFinite(numericUserId)) {
    throw new Error("Invalid user id");
  }

  if (!payload || typeof payload !== "object" || Object.keys(payload).length === 0) {
    throw new Error("At least one service setting is required");
  }

  try {
    const response = await api.put(
      `/admin/user/${numericUserId}/service-settings`,
      payload,
      getAuthHeaders()
    );
    return extractData(response.data);
  } catch (error) {
    throw toApiError(error, "Failed to update user service settings");
  }
};

export const fetchServiceToggleAuditLogs = async (params = {}) => {
  try {
    const queryParams = new URLSearchParams();
    if (params.page) queryParams.append("page", params.page);
    if (params.limit) queryParams.append("limit", params.limit);
    if (params.service_key) queryParams.append("service_key", params.service_key);
    if (params.search) queryParams.append("search", params.search);
    if (params.start_date) queryParams.append("start_date", params.start_date);
    if (params.end_date) queryParams.append("end_date", params.end_date);
    if (params.user_id) queryParams.append("user_id", params.user_id);
    if (params.affected_user_id) queryParams.append("affected_user_id", params.affected_user_id);

    const queryString = queryParams.toString();
    const url = `/admin/service-settings/audit-logs${queryString ? `?${queryString}` : ""}`;
    const response = await api.get(url, getAuthHeaders());
    return response?.data || {};
  } catch (error) {
    throw toApiError(error, "Failed to load service audit logs");
  }
};

export const updateBulkUserServiceSettings = async (service_key, is_enabled) => {
  if (!service_key || typeof is_enabled !== "boolean") {
    throw new Error("Valid service key and status are required");
  }

  try {
    const response = await api.put(
      `/admin/user/bulk-service-settings`,
      { service_key, is_enabled },
      getAuthHeaders()
    );
    return extractData(response.data);
  } catch (error) {
    throw toApiError(error, "Failed to bulk update user service settings");
  }
};
