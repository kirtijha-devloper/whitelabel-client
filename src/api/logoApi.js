import axios from "axios";
import { getAuthToken } from "../utils/auth";
import { BASE_URL } from "../constants";

const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

export const getLogo = async () => {
  try {
    const response = await api.get("/logo");
    return response.data;
  } catch (error) {
    throw new Error(error.response?.data?.message || "Failed to fetch logo");
  }
};
