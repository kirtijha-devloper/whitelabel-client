 import { updateCustomerT0Limit } from "../api/posSettingApi";

export const purgeStaleLimitLocalStorage = () => {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      localStorage.removeItem("pos_user_overrides_map");
      localStorage.removeItem("user_daily_payout_limits");
      localStorage.removeItem("global_pos_t0_settlement_active");
      localStorage.removeItem("global_free_will_all_users");
      localStorage.removeItem("default_global_daily_payout_limit");
    }
  } catch (e) {}
};

// Immediately purge stale limit keys on module load
purgeStaleLimitLocalStorage();

/**
  * Dispatch custom event & storage event to notify UI components to re-render instantly
  */
export const dispatchLimitChangeEvent = (detail = {}) => {
  try {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("userDailyLimitUpdated", { detail }));
      window.dispatchEvent(new Event("storage"));
      if (typeof BroadcastChannel !== "undefined") {
        const channel = new BroadcastChannel("pos_limits_channel");
        channel.postMessage({ type: "LIMIT_UPDATED", detail });
        channel.close();
      }
    }
  } catch (e) {
    console.error("Failed to dispatch limit change event:", e);
  }
};

/**
 * Get utilized daily payout total for a user ID for today
 */
export const getUserTodayUtilized = (userId, userObject = null, posT0Amount = 0) => {
  if (!userId) return 0;

  let localUtilized = 0;
  try {
    if (typeof window !== "undefined") {
      const today = getTodayKey();
      const rawDirect = localStorage.getItem(`${UTILIZED_STORAGE_KEY_PREFIX}${userId}_${today}`);
      if (rawDirect) {
        localUtilized = Number(rawDirect) || 0;
      } else {
        const rawMap = localStorage.getItem(`${UTILIZED_STORAGE_KEY_PREFIX}${today}`);
        if (rawMap) {
          const map = JSON.parse(rawMap);
          localUtilized = Number(map?.[String(userId)]) || 0;
        }
      }
    }
  } catch (error) {
    localUtilized = 0;
  }

  let apiUtilized = 0;
  if (userObject) {
    const rawApiVal =
      userObject.today_payout_amount ??
      userObject.today_payout ??
      userObject.utilized_limit ??
      userObject.daily_payout_used ??
      null;

    if (rawApiVal !== null && rawApiVal !== undefined) {
      const val = Number(rawApiVal);
      if (Number.isFinite(val) && val >= 0) {
        apiUtilized = val;
      }
    }
  }

  const posNum = Math.max(0, Number(posT0Amount) || 0);

  return Math.max(localUtilized, apiUtilized, posNum);
};

/**
 * Record a payout execution for a user for today
 */
export const recordUserPayoutExecution = (userId, amount) => {
  if (!userId || !amount) return;
  const numAmount = Number(amount);
  if (!Number.isFinite(numAmount) || numAmount <= 0) return;

  try {
    localStorage.removeItem("user_wallet_zero_reset");
    const key = `${UTILIZED_STORAGE_KEY_PREFIX}${getTodayKey()}`;
    const raw = localStorage.getItem(key);
    const map = raw ? JSON.parse(raw) || {} : {};
    const strId = String(userId);
    const current = Number(map[strId]) || 0;
    map[strId] = current + numAmount;
    localStorage.setItem(key, JSON.stringify(map));
    dispatchLimitChangeEvent({ type: "payout", userId, amount: numAmount });
  } catch (error) {
    console.error("Failed to record user payout execution:", error);
  }
};

/**
 * Get all stored user daily limits as an object mapping userId -> limit amount.
 * Limits remain persistently active until modified manually or via new Excel upload.
 */
export const getAllUserDailyLimits = () => {
  return {};
};

const GLOBAL_FREE_WILL_KEY = "global_free_will_all_users";

export const getGlobalFreeWill = () => {
  return false;
};

export const setGlobalFreeWill = (enabled) => {
  dispatchLimitChangeEvent({ type: "global_free_will", enabled });
};

/**
 * Get global default daily limit for all users
 */
export const getDefaultDailyLimit = () => {
  return "";
};

/**
 * Set global default daily limit for all users
 */
export const setDefaultDailyLimit = (amount) => {
  dispatchLimitChangeEvent({ type: "default", amount: amount || "" });
};

/**
 * Get explicit custom daily payout limit for a user ID
 */
export const getUserCustomDailyLimit = (userId, userObject = null) => {
  if (userObject && userObject.t0_daily_limit !== undefined && userObject.t0_daily_limit !== null && userObject.t0_daily_limit !== "") {
    return userObject.t0_daily_limit;
  }
  return "";
};

/**
 * Get effective daily payout limit for a user (custom limit if set, else global default)
 */
export const calculateFranchisePoolStats = (franchiseUser, childMerchants = [], franchiseUsedToday = 0) => {
  const rawLimit =
    franchiseUser?.t0_daily_limit !== null && franchiseUser?.t0_daily_limit !== undefined && franchiseUser?.t0_daily_limit !== ""
      ? franchiseUser.t0_daily_limit
      : null;

  const isNotSet = rawLimit === null || rawLimit === undefined || rawLimit === "";
  const normStr = String(rawLimit || "").toLowerCase();
  const isUnlimited = !isNotSet && (normStr === "unlimited" || normStr === "freewill");
  const isZero = !isNotSet && !isUnlimited && Number(rawLimit) === 0;

  const totalAssignedPool = isNotSet
    ? null
    : isUnlimited
    ? "unlimited"
    : Number(rawLimit) || 0;

  let allocatedToMerchants = 0;
  if (Array.isArray(childMerchants)) {
    childMerchants.forEach((m) => {
      const mLimitRaw =
        m?.t0_daily_limit !== null && m?.t0_daily_limit !== undefined && m?.t0_daily_limit !== ""
          ? m.t0_daily_limit
          : null;
      if (mLimitRaw !== null && mLimitRaw !== undefined && mLimitRaw !== "") {
        const mLimit = Number(mLimitRaw);
        if (Number.isFinite(mLimit) && mLimit > 0) {
          allocatedToMerchants += mLimit;
        }
      }
    });
  }

  const usedTodayNum = Math.max(0, Number(franchiseUsedToday) || 0);

  const remainingSelfLimit = isNotSet
    ? null
    : isUnlimited
    ? "unlimited"
    : Math.max(0, (Number(rawLimit) || 0) - allocatedToMerchants);

  const remainingSelfLimitLeft = isNotSet
    ? null
    : isUnlimited
    ? "unlimited"
    : Math.max(0, (typeof remainingSelfLimit === "number" ? remainingSelfLimit : 0) - usedTodayNum);

  return {
    isNotSet,
    isUnlimited,
    isZero,
    totalAssignedPool,
    allocatedToMerchants,
    franchiseUsedToday: usedTodayNum,
    remainingSelfLimit,
    remainingSelfLimitLeft,
  };
};

export const getEffectiveUserDailyLimit = (userId, userObject = null, childMerchants = []) => {
  // If userObject is provided and is a franchise, calculate remaining self-limit FIRST
  if (userObject) {
    const role = String(userObject.role || "").toLowerCase();
    if (role === "franchise" || role === "franchaise" || role === "distributor") {
      const fUsedToday = getUserTodayUtilized(userId, userObject);
      const stats = calculateFranchisePoolStats(userObject, childMerchants, fUsedToday);
      if (stats.isNotSet || stats.isZero) {
        return 0; // Not set / 0 limit => Auto-shift to T1
      }
      if (stats.isUnlimited) {
        return "unlimited";
      }
      if (stats.remainingSelfLimit !== null) {
        return stats.remainingSelfLimit;
      }
    }

    const rawLimit = userObject.t0_daily_limit;
    if (rawLimit === null || rawLimit === undefined || rawLimit === "" || Number(rawLimit) === 0) {
      return 0; // Not set or 0 => T1 mode
    }
    if (String(rawLimit).toLowerCase() === "unlimited") {
      return "unlimited";
    }
    return Number(rawLimit) || 0;
  }

  return 0; // Unassigned / Not Set default => 0 (T1 mode)
};

/**
 * Set daily payout limit for a user ID (persisted to server DB)
 */
export const setUserDailyLimit = (userId, amount, userObject = null) => {
  if (!userId && !userObject) return;
  const primaryId = userObject?.id || userId;
  if (primaryId) {
    dispatchLimitChangeEvent({ type: "user", userId: primaryId, amount });
    updateCustomerT0Limit(primaryId, amount).catch((err) => {
      console.error("Failed to sync user limit override to server:", err);
    });
  }
};

/**
 * Check if a user payout of `requestedAmount` violates their daily payout limit.
 */
export const checkUserDailyPayoutLimit = ({
  userId,
  requestedAmount = 0,
  usedTodayAmount = 0,
  isGlobalLimitActive = true,
  userObject = null,
  childMerchants = [],
}) => {
  if (!isGlobalLimitActive) {
    return { allowed: true, limitAmount: null, remainingAmount: null, isCustom: false };
  }

  const customLimit = getUserCustomDailyLimit(userId);
  const isCustom = customLimit !== "" && customLimit !== null && customLimit !== undefined;
  const rawLimit = getEffectiveUserDailyLimit(userId, userObject, childMerchants);

  if (
    String(rawLimit).toLowerCase() === "unlimited" ||
    String(customLimit).toLowerCase() === "unlimited"
  ) {
    return {
      allowed: true,
      limitAmount: "unlimited",
      remainingAmount: "unlimited",
      isCustom: true,
      isUnlimited: true,
    };
  }

  if (rawLimit !== "" && rawLimit !== null && rawLimit !== undefined) {
    const limitAmount = Number(rawLimit);
    if (Number.isFinite(limitAmount) && limitAmount > 0) {
      const reqNum = Math.max(0, Number(requestedAmount) || 0);
      const actualUsedToday = usedTodayAmount > 0 ? usedTodayAmount : getUserTodayUtilized(userId);
      const usedNum = Math.max(0, Number(actualUsedToday) || 0);
      const totalWillBe = usedNum + reqNum;
      const remainingAmount = Math.max(0, limitAmount - usedNum);

      if (totalWillBe > limitAmount) {
        const typeLabel = isCustom ? "custom limit" : "default limit";
        return {
          allowed: false,
          limitAmount,
          remainingAmount,
          isCustom,
          message: `Daily payout limit of ₹${limitAmount.toLocaleString("en-IN")} (${typeLabel}) exceeded. Available remaining limit for today: ₹${remainingAmount.toLocaleString("en-IN")}.`,
        };
      }
    }
  }

  return {
    allowed: true,
    limitAmount: null,
    remainingAmount: null,
    isCustom: false,
  };
};

const LIMIT_AUDIT_LOG_KEY = "system_limit_audit_logs";

/**
 * Record an audit log entry for Set Limit actions (manual override, free will, reset, excel import)
 */
export const recordLimitAuditLog = ({ performingUser, affectedUser, previousState, newState, action, serviceKey }) => {
  try {
    const raw = localStorage.getItem(LIMIT_AUDIT_LOG_KEY);
    const logs = raw ? JSON.parse(raw) || [] : [];

    const getRoleStr = (user) => {
      if (!user) return "";
      const r = String(user.role || "").toLowerCase();
      if (r.includes("admin")) return "admin";
      if (r.includes("employee")) return "employee";
      if (r.includes("franchise") || r.includes("distributor")) return "franchise";
      return r || "merchant";
    };

    const newEntry = {
      id: `limit_log_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      service_key: serviceKey || "user_daily_limit",
      performingUser: performingUser
        ? {
            id: performingUser.id,
            name: performingUser.name || performingUser.full_name || performingUser.user_name || "Admin/Employee",
            abheepay_id: performingUser.abheepay_id || performingUser.id || "-",
            role: getRoleStr(performingUser),
          }
        : null,
      affectedUser: affectedUser
        ? {
            id: affectedUser.id,
            name: affectedUser.name || affectedUser.full_name || affectedUser.user_name || "User",
            abheepay_id: affectedUser.abheepay_id || affectedUser.id || "-",
            role: getRoleStr(affectedUser),
          }
        : null,
      previous_state: previousState || "Default State",
      new_state: newState || "Updated State",
      action: action || "SERVICE_TOGGLE",
      createdAt: new Date().toISOString(),
      ip_address: "127.0.0.1",
    };

    logs.unshift(newEntry);
    if (logs.length > 1000) logs.length = 1000;

    localStorage.setItem(LIMIT_AUDIT_LOG_KEY, JSON.stringify(logs));
    dispatchLimitChangeEvent({ type: "audit_log", entry: newEntry });
  } catch (error) {
    console.error("Failed to record limit audit log:", error);
  }
};

/**
 * Get locally stored limit activity audit logs
 */
export const getLocalLimitAuditLogs = () => {
  try {
    const raw = localStorage.getItem(LIMIT_AUDIT_LOG_KEY);
    return raw ? JSON.parse(raw) || [] : [];
  } catch {
    return [];
  }
};
