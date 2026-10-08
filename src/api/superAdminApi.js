import axios from "axios";
import { getAuthToken } from "../utils/auth";
import { BASE_URL } from "../constants";

const api = axios.create({
  baseURL: BASE_URL + "/super-admin",
});

/**
 * Create Admin + Company
 * Super Admin creates Company and Admin User.
 * Accepts either FormData (multipart) or plain JSON object.
 */
export const createAdmin = async (data) => {
  try {
    const token = getAuthToken();

    if (!token) {
      throw new Error("Unauthorized User");
    }

    const headers = {
      Authorization: `Bearer ${token}`,
    };

    const response = await api.post("/createAdmin", data, { headers });

    return response.data;
  } catch (error) {
    console.error("[createAdmin] request failed", {
      status: error?.response?.status ?? null,
      message: error?.response?.data?.message || error?.message || null,
      details: error?.response?.data ?? null,
    });

    throw new Error(error?.response?.data?.message || "Failed to create admin");
  }
};

/**
 * Get Admin List
 * Supports pagination, status, and search filters
 */
export const getAdminList = async (params = {}) => {
  try {
    const token = getAuthToken();
    if (!token) throw new Error("Unauthorized User");

    const { page, limit, status, role, search, q } = params;
    let url = "/getAllAdmins";
    const query = [];
    if (page) query.push(`page=${encodeURIComponent(page)}`);
    if (limit) query.push(`limit=${encodeURIComponent(limit)}`);
    if (status) query.push(`status=${encodeURIComponent(status)}`);
    if (role) query.push(`role=${encodeURIComponent(role)}`);
    const searchTerm = search || q;
    if (searchTerm) query.push(`search=${encodeURIComponent(searchTerm)}`);
    if (query.length) url += `?${query.join("&")}`;

    const response = await api.get(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    return response.data;
  } catch (error) {
    console.error("[getAdminList] request failed", {
      status: error?.response?.status ?? null,
      message: error?.response?.data?.message || error?.message || null,
      details: error?.response?.data ?? null,
    });

    throw new Error(error?.response?.data?.message || "Failed to fetch admin list");
  }
};

/**
 * Get Admin Details
 * Accepts numeric ID, encrypted string ID, or raw identifier
 */
export const getAdminDetails = async (id) => {
  try {
    const token = getAuthToken();

    if (!token) {
      throw new Error("Unauthorized User");
    }

    if (!id) {
      throw new Error("Admin ID is required");
    }

    const safeId = encodeURIComponent(String(id));

    const response = await api.get(`/admin/${safeId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

   

    return response.data;
  } catch (error) {
    console.error("[getAdminDetails] request failed", {
      id,
      status: error?.response?.status ?? null,
      message: error?.response?.data?.message || error?.message || null,
      details: error?.response?.data ?? null,
    });

    throw new Error(error?.response?.data?.message || "Failed to fetch admin details");
  }
};

/**
 * Update Admin + Company
 * Accepts numeric ID, encrypted string ID, or raw identifier
 */
export const updateAdmin = async (id, data) => {
  try {
    const token = getAuthToken();

    if (!token) {
      throw new Error("Unauthorized User");
    }

    if (!id) {
      throw new Error("Admin ID is required");
    }

    const safeId = encodeURIComponent(String(id));
    const headers = {
      Authorization: `Bearer ${token}`,
    };

    const response = await api.put(`/admin/${safeId}`, data, { headers });

    return response.data;
  } catch (error) {
    console.error("[updateAdmin] request failed", {
      id,
      status: error?.response?.status ?? null,
      message: error?.response?.data?.message || error?.message || null,
      details: error?.response?.data ?? null,
    });

    throw new Error(error?.response?.data?.message || "Failed to update admin");
  }
};

/**
 * Update Admin Status
 * Accepts numeric ID, encrypted string ID, or raw identifier
 */
export const updateAdminStatus = async (id, status) => {
  try {
    const token = getAuthToken();

    if (!token) {
      throw new Error("Unauthorized User");
    }

    if (!id) {
      throw new Error("Admin ID is required");
    }

    const safeId = encodeURIComponent(String(id));

    const response = await api.patch(
      `/admin/${safeId}/status`,
      { status },
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
      message: error?.response?.data?.message || error?.message || null,
    });

    throw new Error(error?.response?.data?.message || "Failed to update admin status");
  }
};

/**
 * Get POS Inventory for Super Admin
 */
export const getSuperAdminPosInventory = async (params = {}) => {
  try {
    const token = getAuthToken();
    if (!token) throw new Error("Unauthorized User");

    const { page, limit, status, search } = params;
    let url = "/getPosInventory";
    const query = [];
    if (page) query.push(`page=${encodeURIComponent(page)}`);
    if (limit) query.push(`limit=${encodeURIComponent(limit)}`);
    if (status) query.push(`status=${encodeURIComponent(status)}`);
    if (search) query.push(`search=${encodeURIComponent(search)}`);
    if (query.length) url += `?${query.join("&")}`;

    const response = await api.get(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    return response.data;
  } catch (error) {
    console.error("[getSuperAdminPosInventory] request failed", {
      status: error?.response?.status ?? null,
      message: error?.response?.data?.message || error?.message || null,
      details: error?.response?.data ?? null,
    });

    throw new Error(error?.response?.data?.message || "Failed to fetch POS inventory");
  }
};

/**
 * Get Super Admin Transaction Report
 */
export const getSuperAdminTransactionReport = async (params = {}) => {
  try {
    const token = getAuthToken();
    if (!token) throw new Error("Unauthorized User");

    const { page, limit, domain, company_id, from_date, to_date, status, search, q } = params;
    let url = "/reports/transactions";
    const query = [];
    if (page) query.push(`page=${encodeURIComponent(page)}`);
    if (limit) query.push(`limit=${encodeURIComponent(limit)}`);
    if (domain) query.push(`domain=${encodeURIComponent(domain)}`);
    if (company_id) query.push(`company_id=${encodeURIComponent(company_id)}`);
    if (from_date) query.push(`from_date=${encodeURIComponent(from_date)}`);
    if (to_date) query.push(`to_date=${encodeURIComponent(to_date)}`);
    if (status) query.push(`status=${encodeURIComponent(status)}`);
    const searchTerm = search || q;
    if (searchTerm) query.push(`search=${encodeURIComponent(searchTerm)}`);
    if (query.length) url += `?${query.join("&")}`;

    const response = await api.get(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    return response.data;
  } catch (error) {
    console.error("[getSuperAdminTransactionReport] request failed", {
      status: error?.response?.status ?? null,
      message: error?.response?.data?.message || error?.message || null,
      details: error?.response?.data ?? null,
    });

    throw new Error(error?.response?.data?.message || "Failed to fetch transaction report");
  }
};

/**
 * Get Super Admin Commission Report
 */
export const getSuperAdminCommissionReport = async (params = {}) => {
  try {
    const token = getAuthToken();
    if (!token) throw new Error("Unauthorized User");

    const { page, limit, domain, company_id, from_date, to_date, payment_method, search, q } = params;
    let url = "/reports/commissions";
    const query = [];
    if (page) query.push(`page=${encodeURIComponent(page)}`);
    if (limit) query.push(`limit=${encodeURIComponent(limit)}`);
    if (domain) query.push(`domain=${encodeURIComponent(domain)}`);
    if (company_id) query.push(`company_id=${encodeURIComponent(company_id)}`);
    if (from_date) query.push(`from_date=${encodeURIComponent(from_date)}`);
    if (to_date) query.push(`to_date=${encodeURIComponent(to_date)}`);
    if (payment_method) query.push(`payment_method=${encodeURIComponent(payment_method)}`);
    const searchTerm = search || q;
    if (searchTerm) query.push(`search=${encodeURIComponent(searchTerm)}`);
    if (query.length) url += `?${query.join("&")}`;

    const response = await api.get(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    return response.data;
  } catch (error) {
    console.error("[getSuperAdminCommissionReport] request failed", {
      status: error?.response?.status ?? null,
      message: error?.response?.data?.message || error?.message || null,
      details: error?.response?.data ?? null,
    });

    throw new Error(error?.response?.data?.message || "Failed to fetch commission report");
  }
};

/**
 * Get Super Admin Service-Wise Report
 */
export const getSuperAdminServiceWiseReport = async (params = {}) => {
  try {
    const token = getAuthToken();
    if (!token) throw new Error("Unauthorized User");

    const { category, search, q } = params;
    let url = "/reports/service-wise";
    const query = [];
    if (category) query.push(`category=${encodeURIComponent(category)}`);
    const searchTerm = search || q;
    if (searchTerm) query.push(`search=${encodeURIComponent(searchTerm)}`);
    if (query.length) url += `?${query.join("&")}`;

    const response = await api.get(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    return response.data;
  } catch (error) {
    console.error("[getSuperAdminServiceWiseReport] request failed", {
      status: error?.response?.status ?? null,
      message: error?.response?.data?.message || error?.message || null,
      details: error?.response?.data ?? null,
    });

    throw new Error(error?.response?.data?.message || "Failed to fetch service wise report");
  }
};

/**
 * Get Super Admin Services List from backend DB
 */
export const getSuperAdminServices = async () => {
  try {
    const token = getAuthToken();
    if (!token) throw new Error("Unauthorized User");

    const response = await api.get("/services", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    return response.data?.data || response.data || [];
  } catch (error) {
    console.error("[getSuperAdminServices] request failed", {
      status: error?.response?.status ?? null,
      message: error?.response?.data?.message || error?.message || null,
    });
    throw new Error(error?.response?.data?.message || "Failed to fetch services");
  }
};

/**
 * Update Super Admin Service Status in backend DB
 */
export const updateSuperAdminServiceStatus = async (serviceKey, isEnabled) => {
  try {
    const token = getAuthToken();
    if (!token) throw new Error("Unauthorized User");

    const response = await api.put(
      `/services/${encodeURIComponent(serviceKey)}/status`,
      { is_enabled: Boolean(isEnabled) },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    return response.data;
  } catch (error) {
    console.error("[updateSuperAdminServiceStatus] request failed", {
      status: error?.response?.status ?? null,
      message: error?.response?.data?.message || error?.message || null,
    });
    throw new Error(error?.response?.data?.message || "Failed to update service status");
  }
};

/**
 * Create or Update Custom Service in backend DB
 */
export const createSuperAdminService = async (payload) => {
  try {
    const token = getAuthToken();
    if (!token) throw new Error("Unauthorized User");

    const response = await api.post("/services/create", payload, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    return response.data;
  } catch (error) {
    console.error("[createSuperAdminService] request failed", {
      status: error?.response?.status ?? null,
      message: error?.response?.data?.message || error?.message || null,
    });
    throw new Error(error?.response?.data?.message || "Failed to create service");
  }
};