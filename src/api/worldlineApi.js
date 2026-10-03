import axios from "axios";
import { getAuthToken } from "../utils/auth";
import { BASE_URL } from "../constants";

const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

export const getWorldlineNotifications = async (params = {}) => {
  const token = getAuthToken();
  if (!token) throw new Error("Not Authorized");

  const queryParams = { ...params };
  if (queryParams.txn_id && !queryParams.rrn) {
    queryParams.rrn = queryParams.txn_id;
  }

  const response = await api.get("/worldline/notification", {
    headers: { Authorization: `Bearer ${token}` },
    params: queryParams,
  });

  return response.data;
};

export const getWorldlineNotificationById = async (id) => {
  if (!id) throw new Error("Notification id is required");
  const token = getAuthToken();
  if (!token) throw new Error("Not Authorized");

  const response = await api.get(`/worldline/notification/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  return response.data;
};

export const adminProcessWorldlineNotification = async (id) => {
  if (!id) throw new Error("Notification id is required");
  const token = getAuthToken();
  if (!token) throw new Error("Not Authorized");

  const response = await api.post(`/worldline/notification/${id}/admin-process`, null, {
    headers: { Authorization: `Bearer ${token}` },
  });

  return response.data;
};
