import axios from "axios";
import { BASE_URL } from "../constants";
import { getAuthToken } from "../utils/auth";

const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

const logCompanyApi = () => {};

const getAuthHeaders = () => {
  const token = getAuthToken();
  if (!token) {
    throw new Error("Not Authorized");
  }

  return {
    Authorization: `Bearer ${token}`,
  };
};

const normalizeCompanyRecord = (record) => ({
  id: record?.id ?? null,
  name: String(record?.name || "").trim(),
});

const extractCompanyList = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.list)) return payload.list;
  if (Array.isArray(payload?.rows)) return payload.rows;
  if (Array.isArray(payload?.data?.data)) return payload.data.data;
  if (Array.isArray(payload?.data?.list)) return payload.data.list;
  return [];
};

export const getCompanyNames = async () => {
  const endpoint = "/company-name";

  try {
    logCompanyApi("GET request", { endpoint });
    const response = await api.get(endpoint, {
      headers: getAuthHeaders(),
    });

    const companies = extractCompanyList(response?.data)
      .map(normalizeCompanyRecord)
      .filter((company) => company.name);

    logCompanyApi("GET response", {
      endpoint,
      response: response?.data,
      normalizedCount: companies.length,
    });

    return companies;
  } catch (error) {
    logCompanyApi("GET error", {
      endpoint,
      error: error.response?.data || error.message,
    });
    throw new Error(error.response?.data?.message || "Failed to fetch company names");
  }
};

export const createCompanyName = async (name) => {
  const endpoint = "/company-name";
  const payload = {
    name: String(name || "").trim(),
  };

  try {
    logCompanyApi("POST request", { endpoint, payload });
    const response = await api.post(endpoint, payload, {
      headers: getAuthHeaders(),
    });

    logCompanyApi("POST response", {
      endpoint,
      response: response?.data,
    });

    return response?.data;
  } catch (error) {
    logCompanyApi("POST error", {
      endpoint,
      payload,
      error: error.response?.data || error.message,
    });
    throw new Error(error.response?.data?.message || "Failed to create company name");
  }
};

export const updateCompanyName = async (id, name) => {
  const endpoint = `/company-name/${id}`;
  const payload = {
    name: String(name || "").trim(),
  };

  try {
    logCompanyApi("PUT request", { endpoint, payload });
    const response = await api.put(endpoint, payload, {
      headers: getAuthHeaders(),
    });

    logCompanyApi("PUT response", {
      endpoint,
      response: response?.data,
    });

    return response?.data;
  } catch (error) {
    logCompanyApi("PUT error", {
      endpoint,
      payload,
      error: error.response?.data || error.message,
    });
    throw new Error(error.response?.data?.message || "Failed to update company name");
  }
};

export const deleteCompanyName = async (id) => {
  const endpoint = `/company-name/${id}`;

  try {
    logCompanyApi("DELETE request", { endpoint });
    const response = await api.delete(endpoint, {
      headers: getAuthHeaders(),
    });

    logCompanyApi("DELETE response", {
      endpoint,
      response: response?.data,
    });

    return response?.data;
  } catch (error) {
    logCompanyApi("DELETE error", {
      endpoint,
      error: error.response?.data || error.message,
    });
    throw new Error(error.response?.data?.message || "Failed to delete company name");
  }
};
