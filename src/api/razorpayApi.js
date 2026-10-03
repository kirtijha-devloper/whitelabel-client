import axios from "axios";
import { getAuthToken } from "../utils/auth";
import { BASE_URL } from "../constants";

const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

export const getRazorpayNotifications = async (params = {}) => {
  const token = getAuthToken();
  if (!token) throw new Error("Not Authorized");

  try {
    const response = await api.get("/razorpay/notification", {
      headers: { Authorization: `Bearer ${token}` },
      params,
    });
    console.log("Razorpay API primary response:", response.data);
    return response.data;
  } catch (err) {
    console.warn("Primary /razorpay/notification failed", err?.response?.status, err?.message);
    if (err?.response?.status === 404) {
      // fallback to old webhook endpoint or report endpoint if new one isn't available
      try {
        const response = await api.get("/razorpay/webhook/notification", {
          headers: { Authorization: `Bearer ${token}` },
          params,
        });
        console.log("Razorpay API webhook fallback response:", response.data);
        return response.data;
      } catch (nestedErr) {
        console.warn("Webhook fallback failed", nestedErr?.response?.status, nestedErr?.message);
        const response = await api.get("/report/razorpay/all", {
          headers: { Authorization: `Bearer ${token}` },
          params,
        });
        console.log("Razorpay report fallback response:", response.data);
        return response.data;
      }
    }
    throw err;
  }
};

export const getRazorpayNotificationById = async (id) => {
  if (!id) throw new Error("Notification id is required");
  const token = getAuthToken();
  if (!token) throw new Error("Not Authorized");

  const response = await api.get(`/razorpay/notification/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  return response.data;
};

export const adminProcessNotification = async (id) => {
  if (!id) throw new Error("Notification id is required");
  const token = getAuthToken();
  if (!token) throw new Error("Not Authorized");

  const response = await api.post(`/razorpay/notification/${id}/admin-process`, null, {
    headers: { Authorization: `Bearer ${token}` },
  });

  return response.data;
};

export const adminProcessNotificationCustom = async (id, data = {}) => {
  if (!id) throw new Error("Notification id is required");
  const token = getAuthToken();
  if (!token) throw new Error("Not Authorized");

  const response = await api.post(
    `/razorpay/notification/${id}/admin-process-custom-charge`,
    data,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  return response.data;
};

export const previewPinelabData = async (file, provider = "pinelab") => {
  if (!file) throw new Error("File is required");

  const token = getAuthToken();
  if (!token) throw new Error("Not Authorized");

  const formData = new FormData();
  formData.append("file", file);
  formData.append("provider", provider);

  const response = await api.post("/transaction/upload-csv-preview", formData, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "multipart/form-data",
    },
    params: { provider },
  });

  return response.data;
};

export const uploadPinelabNotifications = async (file, provider = "pinelab") => {
  if (!file) throw new Error("File is required");

  const token = getAuthToken();
  if (!token) throw new Error("Not Authorized");

  const formData = new FormData();
  formData.append("file", file);
  formData.append("provider", provider);

  const response = await api.post("/transaction/upload-pinelab-notifications", formData, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "multipart/form-data",
    },
    params: { provider },
  });

  return response.data;
};

export const previewTeleringData = (file) => previewPinelabData(file, "telering");
export const uploadTeleringNotifications = (file) => uploadPinelabNotifications(file, "telering");

export const processSingleNotificationRow = async (row, provider = "telering", index = 0) => {
  const token = getAuthToken();
  if (!token) throw new Error("Not Authorized");

  const response = await api.post(
    "/transaction/process-single-notification",
    { row, provider, index },
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  return response.data;
};




