export const normalizeUserRole = (value) => {
  let roleValue = value;

  if (roleValue && typeof roleValue === "object") {
    roleValue = roleValue.name ?? roleValue.role ?? "";
  }

  const normalized = String(roleValue || "").trim().toLowerCase();
  if (normalized === "franchaise") return "franchise";
  if (normalized === "superfranchise" || normalized === "super_franchise" || normalized === "super-franchise") return "super_franchise";
  return normalized;
};

export const extractUsersArray = (response) => {
  if (Array.isArray(response)) {
    return response;
  }

  if (Array.isArray(response?.data)) {
    return response.data;
  }

  if (Array.isArray(response?.data?.data)) {
    return response.data.data;
  }

  return [];
};

export const maskEmail = (email) => {
  if (!email || typeof email !== "string") return email || "-";
  const trimmed = email.trim();
  const atIndex = trimmed.indexOf("@");
  if (atIndex <= 0) return trimmed;

  const namePart = trimmed.slice(0, atIndex);
  const domainPart = trimmed.slice(atIndex);

  if (namePart.length <= 2) {
    return `${namePart[0]}***${domainPart}`;
  }

  const firstChar = namePart[0];
  const lastChar = namePart[namePart.length - 1];
  const maskedMiddle = "*".repeat(namePart.length - 2);
  return `${firstChar}${maskedMiddle}${lastChar}${domainPart}`;
};

export const isSuperAdmin = (user) => {
  if (!user || String(user.role || "").toLowerCase() !== "admin") return false;
  const idStr = String(user.id || "");
  const abheepayIdStr = String(user.abheepay_id || "").toUpperCase();
  const mobileStr = String(user.mobile_number || user.mobile || "");
  const emailStr = String(user.email || "").toLowerCase();
  const primaryList = ["APA00001", "8119865074", "9990450938", "admin@abheepay.com", "1"];
  return primaryList.some((item) => {
    const norm = String(item).trim();
    return (
      idStr === norm ||
      abheepayIdStr === norm.toUpperCase() ||
      mobileStr === norm ||
      emailStr === norm.toLowerCase()
    );
  });
};

export const maskEmailForUser = (email, currentUser) => {
  if (!email) return "-";
  if (isSuperAdmin(currentUser)) {
    return email;
  }
  return maskEmail(email);
};

export const getParentFranchiseId = (user = {}) => {
  const candidate =
    user?.franchise_id ??
    user?.franchaise_id ??
    user?.franchiseId ??
    user?.franchise_details?.id ??
    user?.parent_id ??
    null;
  const num = Number(candidate);
  return Number.isFinite(num) && num > 0 ? num : null;
};

export const isDirectAdminUser = (user = {}) => {
  const normRole = normalizeUserRole(user?.role);
  if (normRole === "franchise") return true;
  if (normRole === "admin") return false;
  const parentId = getParentFranchiseId(user);
  return parentId === null;
};
