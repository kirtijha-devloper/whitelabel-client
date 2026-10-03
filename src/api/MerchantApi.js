import axios from "axios";
import { getAuthToken } from "../utils/auth";
import { BASE_URL } from "../constants";

const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

export const getMerchantTransactionCharges = async (params = {}) => {
  try {
    const token = getAuthToken();
    if (!token) throw new Error("Not Authorized");

    const response = await api.get("/merchant/transaction-charges", {
      headers: { Authorization: `Bearer ${token}` },
      params: {
        page: params.page || 1,
        limit: params.limit || 10,
        ...(params.merchant_id && { merchant_id: params.merchant_id }),
      },
    });
    return response.data;
  } catch (error) {
    throw new Error(error.response?.data?.message || "Failed to fetch merchant transaction charges");
  }
};

