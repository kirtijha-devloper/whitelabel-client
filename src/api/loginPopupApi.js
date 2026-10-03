import axios from "axios";
import { BASE_SITE_URL, BASE_URL } from "../constants";
import { getAuthToken } from "../utils/auth";

const api = axios.create({
  baseURL: BASE_URL,
});

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

const normalizeLoginPopup = (item = {}) => {
  const imageUrl = String(item?.image_url || item?.imageUrl || "").trim();
  const resolvedImageUrl =
    imageUrl && /^https?:\/\//i.test(imageUrl)
      ? imageUrl
      : imageUrl
      ? `${BASE_SITE_URL}${imageUrl.startsWith("/") ? "" : "/"}${imageUrl}`
      : "";

  return {
    id: item?.id ?? null,
    title: item?.title || "",
    image_url: resolvedImageUrl,
    display_order: item?.display_order ?? item?.displayOrder ?? null,
    is_active: typeof item?.is_active === "boolean" ? item.is_active : true,
    starts_at: item?.starts_at || item?.startsAt || null,
    ends_at: item?.ends_at || item?.endsAt || null,
    target_roles: Array.isArray(item?.target_roles)
      ? item.target_roles
      : Array.isArray(item?.targetRoles)
      ? item.targetRoles
      : [],
    created_at: item?.created_at || item?.createdAt || null,
    updated_at: item?.updated_at || item?.updatedAt || null,
  };
};

const extractArray = (payload) => {
  const candidates = [
    payload?.data?.rows,
    payload?.rows,
    payload?.data,
    payload,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate.map(normalizeLoginPopup);
    }
  }

  return [];
};

export const fetchAdminLoginPopups = async () => {
  try {
    const response = await api.get("/admin/login-popups", getAuthHeaders());
    return extractArray(response.data);
  } catch (error) {
    throw toApiError(error, "Failed to load login popups");
  }
};

export const uploadLoginPopup = async ({ image, title = "" }) => {
  if (!image) {
    throw new Error("Image is required");
  }

  const formData = new FormData();
  formData.append("image", image);

  const trimmedTitle = String(title || "").trim();
  if (trimmedTitle) {
    formData.append("title", trimmedTitle);
  }

  try {
    const token = getAuthToken();
    if (!token) {
      throw new Error("No token found");
    }

    const response = await api.post("/admin/login-popups", formData, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    return normalizeLoginPopup(response?.data?.data || response?.data || {});
  } catch (error) {
    throw toApiError(error, "Failed to upload login popup");
  }
};

export const deleteLoginPopup = async (popupId) => {
  const numericPopupId = Number(popupId);
  if (!Number.isFinite(numericPopupId)) {
    throw new Error("Invalid popup id");
  }

  try {
    const response = await api.delete(`/admin/login-popups/${numericPopupId}`, getAuthHeaders());
    return response.data;
  } catch (error) {
    throw toApiError(error, "Failed to delete login popup");
  }
};

export const fetchUserLoginPopups = async () => {
  try {
    const response = await api.get("/user/login-popups", getAuthHeaders());
    return extractArray(response.data);
  } catch (error) {
    throw toApiError(error, "Failed to load active login popups");
  }
};
