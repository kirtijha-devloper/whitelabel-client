import axios from "axios";
import { getAuthToken } from "../utils/auth";
import { BASE_URL } from "../constants";

const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

export const uploadCSV = async (file) => {
  try {
    const token = getAuthToken();
    if (!token) throw new Error("No token found");

    const formData = new FormData();
    formData.append("file", file);
    console.log(formData, "formData");

    const response = await api.post(`/transaction/upload-csv`, formData, {
    // const response = await api.post(`/transaction/upload-test`, formData, {

      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "multipart/form-data",
      },
    });
    console.log(response, "response");
    return response.data;
  } catch (error) {
    console.error("Error uploading CSV:", error);
    throw new Error(error.response?.data?.message || "Failed to upload CSV");
  }
};

export const getAllTransactions = async () => {
  try {
    const token = getAuthToken();
    if (!token) throw new Error("No token found");

    const response = await api.get(`/transaction/`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data.list;
  } catch (error) {
    console.error("Error fetching all transactions:", error);
    throw new Error(error.response?.data?.message || "Failed to fetch transactions");
  }
};

export const getTransactionById = async (id) => {
  try {
    const token = getAuthToken();
    if (!token) throw new Error("No token found");

    const response = await api.get(`/transaction/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  } catch (error) {
    console.error(`Error fetching transaction with ID ${id}:`, error);
    throw new Error(error.response?.data?.message || "Failed to fetch transaction");
  }
};

export const getAllFileUploads = async () => {
  try {
    const token = getAuthToken();
    if (!token) throw new Error("No token found");

    const response = await api.get(`/transaction/file-uploaded`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data.files;
  } catch (error) {
    console.error("Error fetching uploaded files:", error);
    throw new Error(error.response?.data?.message || "Failed to fetch uploaded files");
  }
};

export const getFilteredTransactions = async (filters) => {
  try {
    const token = getAuthToken();
    if (!token) throw new Error("No token found");

    const response = await api.get(`/transaction/filter`, {
      headers: { Authorization: `Bearer ${token}` },
      params: filters,
    });
    return response.data.data;
  } catch (error) {
    console.error("Error fetching filtered transactions:", error);
    throw new Error(error.response?.data?.message || "Failed to fetch filtered transactions");
  }
};