import axios from "axios";
import { getAuthToken } from "../utils/auth";
import { BASE_URL } from "../constants";

const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

export const createChargeType = async (data) => {
  try {
    const token = getAuthToken();
    if (!token) throw new Error("Not Authorized");

    const response = await api.post("/charge/type", data, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  } catch (error) {
    throw new Error(error.response?.data?.message || "Failed to create charge type");
  }
};

export const getChargeTypes = async () => {
  try {
    const token = getAuthToken();
    if (!token) throw new Error("Not Authorized");

    const response = await api.get("/charge/type", {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data.types;
  } catch (error) {
    throw new Error(error.response?.data?.message || "Failed to fetch charge types");
  }
};

export const createChargeSlab = async (data) => {
  try {
    const token = getAuthToken();
    if (!token) throw new Error("Not Authorized");

    const response = await api.post("/charge/slab", data, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  } catch (error) {
    throw new Error(error.response?.data?.message || "Failed to create charge slab");
  }
};

export const getSlabsByCategory = async (data) => {
  console.log(data, "data for charge slab");
  try {
    const token = getAuthToken();
    if (!token) throw new Error("Not Authorized");

    const response = await api.post("/charge/slab/list", data, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data.slabs;
  } catch (error) {
    throw new Error(error.response?.data?.message || "Failed to fetch slabs by category");
  }
};

export const updateChargeSlab = async (id, data) => {
  try {
    const token = getAuthToken();
    if (!token) throw new Error("Not Authorized");

    const response = await api.put(`/charge/slab/${id}`, data, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  } catch (error) {
    throw new Error(error.response?.data?.message || "Failed to update charge slab");
  }
};

export const deleteChargeSlab = async (id) => {
  try {
    const token = getAuthToken();
    if (!token) throw new Error("Not Authorized");

    const response = await api.delete(`/charge/slab/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  } catch (error) {
    throw new Error(error.response?.data?.message || "Failed to delete charge slab");
  }
};

export const deleteChargeType = async (id) => {
  try {
    const token = getAuthToken();
    if (!token) throw new Error("Not Authorized");

    const response = await api.delete(`/charge/type/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  } catch (error) {
    throw new Error(error.response?.data?.message || "Failed to delete charge type");
  }
};

export const getSlabsById = async (id) => {
  try {
    const token = getAuthToken();
    if (!token) throw new Error("Not Authorized");

    const response = await api.get(`/charge/slab/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data.slab;
  } catch (error) {
    throw new Error(error.response?.data?.message || "Failed to fetch slab by ID");
  }
};

export const ChargesSetByUserId = async (id)=>{
  try {
    const token = getAuthToken();
    if (!token) throw new Error("Not Authorized");

    console.log("id',", id, "dsa")
    const response = await api.get(`/charge/slab/user/${id}`,{
      headers: { Authorization: `Bearer ${token}` },
    })
    console.log(response, "response for chargesdet");
    return response.data;
  }
  catch(error){
    throw new Error(error.message || 'Failed to fetch charges through user id');
  }
}
