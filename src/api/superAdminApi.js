import axios from "axios";
import { getAuthToken } from "../utils/auth";
import { BASE_URL } from "../constants";

const api = axios.create({
  baseURL: BASE_URL,
});

/**
 * Create Admin + Company
 *
 * Super Admin creates:
 * 1. Company
 * 2. Admin User
 * 3. Company documents
 *
 * All data is sent in one multipart/form-data request.
 */
export const createAdmin = async (formData) => {
  try {
    const token = getAuthToken();

    if (!token) {
      throw new Error("Unauthorized User");
    }

    if (!(formData instanceof FormData)) {
      throw new Error("Create Admin data must be FormData");
    }

    const response = await api.post(
      "/admin/create-admin",
      formData,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    return response.data;
  } catch (error) {
    console.error("[createAdmin] request failed", {
      status: error?.response?.status ?? null,
      message:
        error?.response?.data?.message ||
        error?.message ||
        null,
      details: error?.response?.data ?? null,
    });

    throw new Error(
      error?.response?.data?.message ||
      "Failed to create admin"
    );
  }
};

/**
 * Get Admin List
 */
export const getAdminList = async () => {
  try {
    const token = getAuthToken();

    if (!token) {
      throw new Error("Unauthorized User");
    }

    const response = await api.get(
      "/admin/list",
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    return response.data;
  } catch (error) {
    console.error("[getAdminList] request failed", {
      status: error?.response?.status ?? null,
      message:
        error?.response?.data?.message ||
        error?.message ||
        null,
      details: error?.response?.data ?? null,
    });

    throw new Error(
      error?.response?.data?.message ||
      "Failed to fetch admin list"
    );
  }
};

/**
 * Get Admin Details
 */
export const getAdminDetails = async (id) => {
  try {
    const token = getAuthToken();

    if (!token) {
      throw new Error("Unauthorized User");
    }

    const adminId = Number(id);

    if (!Number.isFinite(adminId)) {
      throw new Error("Invalid admin id");
    }

    const response = await api.get(
      `/admin/${adminId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    return response.data;
  } catch (error) {
    console.error("[getAdminDetails] request failed", {
      id,
      status: error?.response?.status ?? null,
      message:
        error?.response?.data?.message ||
        error?.message ||
        null,
      details: error?.response?.data ?? null,
    });

    throw new Error(
      error?.response?.data?.message ||
      "Failed to fetch admin details"
    );
  }
};

/**
 * Update Admin + Company
 */
export const updateAdmin = async (id, formData) => {
  try {
    const token = getAuthToken();

    if (!token) {
      throw new Error("Unauthorized User");
    }

    const adminId = Number(id);

    if (!Number.isFinite(adminId)) {
      throw new Error("Invalid admin id");
    }

    if (!(formData instanceof FormData)) {
      throw new Error("Update Admin data must be FormData");
    }

    const response = await api.put(
      `/admin/${adminId}`,
      formData,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    return response.data;
  } catch (error) {
    console.error("[updateAdmin] request failed", {
      id,
      status: error?.response?.status ?? null,
      message:
        error?.response?.data?.message ||
        error?.message ||
        null,
      details: error?.response?.data ?? null,
    });

    throw new Error(
      error?.response?.data?.message ||
      "Failed to update admin"
    );
  }
};

/**
 * Update Admin Status
 */
export const updateAdminStatus = async (id, status) => {
  try {
    const token = getAuthToken();

    if (!token) {
      throw new Error("Unauthorized User");
    }

    const adminId = Number(id);

    if (!Number.isFinite(adminId)) {
      throw new Error("Invalid admin id");
    }

    const response = await api.patch(
      `/admin/${adminId}/status`,
      {
        status,
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    return response.data;
  } catch (error) {
    console.error("[updateAdminStatus] request failed", {
      id,
      status,
      responseStatus: error?.response?.status ?? null,
      message:
        error?.response?.data?.message ||
        error?.message ||
        null,
    });

    throw new Error(
      error?.response?.data?.message ||
      "Failed to update admin status"
    );
  }
};