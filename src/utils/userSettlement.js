/**
 * Utility module for T0 (Main Wallet) & T1 Dual Wallet Management,
 * Next-day 10:00 AM T1 Auto-Settlement, Admin Cutoff Timestamps, and Fund Usage Priority.
 */

const T1_BALANCES_KEY = "user_t1_wallet_balances";
const PREV_DAY_SETTLED_KEY = "user_prev_day_settled_balances";
const CUTOFF_TIMESTAMP_KEY = "user_settlement_cutoff_timestamps";
const SETTLEMENT_AUDIT_LOG_KEY = "user_settlement_audit_logs";
const LAST_AUTO_SETTLED_DATE_KEY = "user_t1_last_auto_settled_date";

/**
 * Dispatch custom event to notify UI components to re-render in real time
 */
export const dispatchSettlementChangeEvent = (detail = {}) => {
  try {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("userSettlementUpdated", { detail }));
      window.dispatchEvent(new Event("storage"));
      if (typeof BroadcastChannel !== "undefined") {
        const channel = new BroadcastChannel("pos_limits_channel");
        channel.postMessage({ type: "SETTLEMENT_UPDATED", detail });
        channel.close();
      }
    }
  } catch (e) {
    console.error("Failed to dispatch settlement change event:", e);
  }
};

/**
 * Format today's date as YYYY-MM-DD
 */
export const getTodayDateKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/**
 * Get T1 Wallet Balance for a user ID (reads from live POS transactions map, userObject properties, settlement hold, or local storage)
 */
export const getT1WalletBalance = (userId, userObject = null, posTxnMap = null, dashboardData = null) => {
  if (!userId && !userObject && !dashboardData) return 0;

  const strId = userId ? String(userId) : "";
  const abheeId = userObject?.abheepay_id ? String(userObject.abheepay_id) : "";

  // 1. Check live POS T1 transactions map if provided
  if (posTxnMap && typeof posTxnMap.get === "function") {
    const liveT1 = (strId && posTxnMap.get(strId)) || (abheeId && posTxnMap.get(abheeId)) || 0;
    if (liveT1 && Number.isFinite(liveT1) && liveT1 > 0) {
      return liveT1;
    }
  }

  // 2. Check dashboardData if provided
  if (dashboardData) {
    const dashDataObj = dashboardData?.data ?? dashboardData ?? {};
    const posTxns = dashDataObj?.pos_transactions || {};
    const dashT1 = Number(
      posTxns.t1_amount ??
      posTxns.t1Amount ??
      posTxns.t1PosAmount ??
      dashDataObj.posT1Amount ??
      dashDataObj.t1_amount ??
      0
    );
    if (Number.isFinite(dashT1) && dashT1 > 0) {
      return dashT1;
    }
  }

  // 3. Check local storage override
  let localBal = 0;
  try {
    const raw = localStorage.getItem(T1_BALANCES_KEY);
    if (raw) {
      const map = JSON.parse(raw) || {};
      const val = Number(map[strId]);
      if (Number.isFinite(val) && val > 0) {
        localBal = val;
      }
    }
  } catch {
    localBal = 0;
  }

  if (localBal > 0) return localBal;

  // 4. Check API / userObject properties (t1_wallet, t1_balance, t1_amount, posT1Amount, etc.)
  if (userObject) {
    const rawApiVal =
      userObject.t1_wallet ??
      userObject.t1_balance ??
      userObject.t1_amount ??
      userObject.pos_t1_amount ??
      userObject.posT1Amount ??
      userObject.t1_pos_amount ??
      userObject.settlement_hold ??
      userObject.hold_balance ??
      null;

    if (rawApiVal !== null && rawApiVal !== undefined) {
      const val = Number(rawApiVal);
      if (Number.isFinite(val) && val > 0) {
        return val;
      }
    }

    // Fallback: Pending T1 Settlement Hold = Math.max(0, wallet - available_balance)
    const walletNum = parseFloat(userObject.wallet ?? 0);
    const availableNum =
      userObject.available_balance !== undefined
        ? parseFloat(userObject.available_balance)
        : walletNum;

    const holdBal = Math.max(0, walletNum - availableNum);
    if (holdBal > 0) {
      return holdBal;
    }
  }

  return 0;
};

/**
 * Set or credit T1 Wallet Balance for a user ID
 */
export const setT1WalletBalance = (userId, amount) => {
  if (!userId) return;
  const numAmount = Math.max(0, Number(amount) || 0);
  try {
    const raw = localStorage.getItem(T1_BALANCES_KEY);
    const map = raw ? JSON.parse(raw) || {} : {};
    map[String(userId)] = numAmount;
    localStorage.setItem(T1_BALANCES_KEY, JSON.stringify(map));
    dispatchSettlementChangeEvent({ type: "t1_wallet_update", userId, amount: numAmount });
  } catch (e) {
    console.error("Failed to update T1 wallet balance:", e);
  }
};

/**
 * Credit funds to user's T1 wallet
 */
export const creditT1WalletBalance = (userId, amount) => {
  if (!userId || !amount) return;
  const numAmount = Number(amount);
  if (!Number.isFinite(numAmount) || numAmount <= 0) return;
  const current = getT1WalletBalance(userId);
  setT1WalletBalance(userId, current + numAmount);
};

/**
 * Get Previous Day Settled Funds available in Main (T0) Wallet for a user ID
 */
export const getPrevDaySettledBalance = (userId, userObject = null) => {
  if (!userId) return 0;
  try {
    const raw = localStorage.getItem(PREV_DAY_SETTLED_KEY);
    if (!raw) {
      const mainWallet = parseFloat(userObject?.wallet ?? 0);
      return Math.max(0, mainWallet * 0.7); // 70% default fallback
    }
    const map = JSON.parse(raw) || {};
    const val = map[String(userId)];
    if (val !== undefined && val !== null) {
      const numVal = Number(val);
      return Number.isFinite(numVal) && numVal >= 0 ? numVal : 0;
    }
    const mainWallet = parseFloat(userObject?.wallet ?? 0);
    return Math.max(0, mainWallet * 0.7);
  } catch {
    return 0;
  }
};

/**
 * Set Previous Day Settled Funds balance for a user ID
 */
export const setPrevDaySettledBalance = (userId, amount) => {
  if (!userId) return;
  const numAmount = Math.max(0, Number(amount) || 0);
  try {
    const raw = localStorage.getItem(PREV_DAY_SETTLED_KEY);
    const map = raw ? JSON.parse(raw) || {} : {};
    map[String(userId)] = numAmount;
    localStorage.setItem(PREV_DAY_SETTLED_KEY, JSON.stringify(map));
    dispatchSettlementChangeEvent({ type: "prev_day_settled_update", userId, amount: numAmount });
  } catch (e) {
    console.error("Failed to update previous day settled balance:", e);
  }
};

const GLOBAL_CUTOFF_ENABLED_KEY = "global_cutoff_timestamp_enabled";
const GLOBAL_DEFAULT_CUTOFF_KEY = "global_default_cutoff_timestamp";

/**
 * Get Global Cutoff Timestamp Enabled status (Default: true)
 */
export const getGlobalCutoffEnabled = () => {
  try {
    const val = localStorage.getItem(GLOBAL_CUTOFF_ENABLED_KEY);
    if (val === "true") return true;
    return false;
  } catch {
    return false;
  }
};

/**
 * Set Global Cutoff Timestamp Enabled status
 */
export const setGlobalCutoffEnabled = (enabled, performingUser = null) => {
  try {
    localStorage.setItem(GLOBAL_CUTOFF_ENABLED_KEY, enabled ? "true" : "false");
    recordSettlementAuditLog({
      performingUser,
      affectedUser: { name: "All System Users (Global)" },
      previousState: `Global Cutoff: ${!enabled}`,
      newState: `Global Cutoff: ${enabled}`,
      action: "TOGGLE_GLOBAL_CUTOFF",
    });
    dispatchSettlementChangeEvent({ type: "global_cutoff_toggle", enabled });
  } catch (e) {
    console.error("Failed to set global cutoff enabled:", e);
  }
};

/**
 * Get Global Default Cutoff Timestamp (Default: "10:00")
 */
export const getGlobalDefaultCutoffTimestamp = () => {
  try {
    const val = localStorage.getItem(GLOBAL_DEFAULT_CUTOFF_KEY);
    return val && typeof val === "string" ? val : "10:00";
  } catch {
    return "10:00";
  }
};

/**
 * Set Global Default Cutoff Timestamp for all users
 */
export const setGlobalDefaultCutoffTimestamp = (timeStr, performingUser = null) => {
  if (!timeStr) return;
  try {
    const prev = getGlobalDefaultCutoffTimestamp();
    localStorage.setItem(GLOBAL_DEFAULT_CUTOFF_KEY, timeStr);
    recordSettlementAuditLog({
      performingUser,
      affectedUser: { name: "All System Users (Global)" },
      previousState: `Global Default Cutoff: ${prev}`,
      newState: `Global Default Cutoff: ${timeStr}`,
      action: "UPDATE_GLOBAL_DEFAULT_CUTOFF",
    });
    dispatchSettlementChangeEvent({ type: "global_default_cutoff_update", timeStr });
  } catch (e) {
    console.error("Failed to set global default cutoff timestamp:", e);
  }
};

/**
 * Get configured Admin Cutoff Timestamp for a user ID.
 * Returns custom time string if set, else Global Default Cutoff Timestamp.
 */
export const getUserCutoffTimestamp = (userId) => {
  const globalDefault = getGlobalDefaultCutoffTimestamp();
  if (!userId) return globalDefault;
  try {
    const raw = localStorage.getItem(CUTOFF_TIMESTAMP_KEY);
    if (!raw) return globalDefault;
    const map = JSON.parse(raw) || {};
    const val = map[String(userId)];
    return val && typeof val === "string" ? val : globalDefault;
  } catch {
    return globalDefault;
  }
};

/**
 * Check if the current local time has passed the configured cutoff timestamp for a user.
 * If global cutoff is disabled, returns true (unlocked for all users).
 */
export const isCutoffTimestampPassed = (userId) => {
  if (!getGlobalCutoffEnabled()) {
    return true; // Global cutoff OFF means unlocked for all
  }

  const cutoffStr = getUserCutoffTimestamp(userId);
  const now = new Date();

  // If HH:mm format
  if (/^\d{1,2}:\d{2}$/.test(cutoffStr)) {
    const [hours, minutes] = cutoffStr.split(":").map(Number);
    const cutoffTime = new Date();
    cutoffTime.setHours(hours, minutes, 0, 0);
    return now >= cutoffTime;
  }

  // If ISO string format
  try {
    const cutoffDate = new Date(cutoffStr);
    if (!isNaN(cutoffDate.getTime())) {
      return now >= cutoffDate;
    }
  } catch {
    // Fallthrough to default
  }

  return true;
};

/**
 * Set custom Admin Cutoff Timestamp for a user ID and record audit log
 */
export const setUserCutoffTimestamp = (userId, cutoffTime, performingUser = null, affectedUser = null) => {
  if (!userId) return;
  try {
    const raw = localStorage.getItem(CUTOFF_TIMESTAMP_KEY);
    const map = raw ? JSON.parse(raw) || {} : {};
    const prevTimestamp = map[String(userId)] || "10:00";
    map[String(userId)] = cutoffTime;
    localStorage.setItem(CUTOFF_TIMESTAMP_KEY, JSON.stringify(map));

    // Audit log
    recordSettlementAuditLog({
      performingUser,
      affectedUser: affectedUser || { id: userId },
      previousState: `Cutoff: ${prevTimestamp}`,
      newState: `Cutoff: ${cutoffTime}`,
      action: "UPDATE_CUTOFF_TIMESTAMP",
    });

    dispatchSettlementChangeEvent({ type: "cutoff_timestamp_update", userId, cutoffTime });
  } catch (e) {
    console.error("Failed to set user cutoff timestamp:", e);
  }
};

/**
 * Get effective Usable Main Wallet Balance for a user ID.
 * Rule:
 * - Up to cutoff timestamp: User can ONLY spend/withdraw Previous Day Settled Funds.
 * - After cutoff timestamp: User can spend live Available Main Wallet Balance (totalMainBalance - t1Bal).
 */
export const getUsableMainWalletBalance = (userId, userObject = null, posTxnMap = null, dashboardData = null) => {
  const totalMainBalance = parseFloat(userObject?.wallet ?? 0);
  const t1Bal = getT1WalletBalance(userId, userObject, posTxnMap, dashboardData);

  let availableBal = totalMainBalance;
  if (userObject?.available_balance !== undefined && userObject?.available_balance !== null) {
    availableBal = Math.min(totalMainBalance, parseFloat(userObject.available_balance));
  } else if (userObject?.availableBalance !== undefined && userObject?.availableBalance !== null) {
    availableBal = Math.min(totalMainBalance, parseFloat(userObject.availableBalance));
  } else if (userObject?.available !== undefined && userObject?.available !== null) {
    availableBal = Math.min(totalMainBalance, parseFloat(userObject.available));
  } else if (t1Bal > 0) {
    availableBal = Math.max(0, totalMainBalance - t1Bal);
  }

  const effectiveTotal = Math.min(totalMainBalance, availableBal);

  const cutoffPassed = isCutoffTimestampPassed(userId);

  if (cutoffPassed) {
    // After cutoff timestamp: Full available balance is usable
    return Math.max(0, effectiveTotal);
  }

  // Before cutoff timestamp: Only Previous Day Settled Funds can be used
  const prevDaySettled = getPrevDaySettledBalance(userId, userObject);
  return Math.max(0, Math.min(effectiveTotal, prevDaySettled));
};

/**
 * Trigger manual or automatic T1 to T0 Wallet Settlement.
 * Transfers entire T1 balance into T0 as Previous Day Settled Funds.
 */
export const triggerT1ToT0Settlement = (userId, userObject = null, performingUser = null) => {
  if (!userId) return { success: false, message: "Invalid User ID" };

  const t1Bal = getT1WalletBalance(userId);
  if (t1Bal <= 0) {
    return { success: false, message: "No T1 balance available to settle." };
  }

  const currentPrevDay = getPrevDaySettledBalance(userId, userObject);
  const newPrevDay = currentPrevDay + t1Bal;

  // Clear T1 Wallet
  setT1WalletBalance(userId, 0);

  // Credit Prev Day Settled Balance
  setPrevDaySettledBalance(userId, newPrevDay);

  // Record audit log
  recordSettlementAuditLog({
    performingUser,
    affectedUser: userObject || { id: userId },
    previousState: `T1 Bal: ₹${t1Bal.toFixed(2)}, Prev Day: ₹${currentPrevDay.toFixed(2)}`,
    newState: `T1 Bal: ₹0.00, Prev Day: ₹${newPrevDay.toFixed(2)}`,
    action: "T1_TO_T0_SETTLEMENT",
  });

  dispatchSettlementChangeEvent({ type: "t1_auto_settled", userId, settledAmount: t1Bal });

  return {
    success: true,
    settledAmount: t1Bal,
    message: `Successfully settled ₹${t1Bal.toFixed(2)} from T1 Wallet to Main (T0) Wallet!`,
  };
};

/**
 * Automatically check and process next-day 10:00 AM T1 Auto Settlement for a user
 */
export const checkAndAutoSettleT1 = (userId, userObject = null) => {
  if (!userId) return;
  const now = new Date();
  const currentHour = now.getHours();
  const todayKey = getTodayDateKey();

  // If current time is past 10:00 AM
  if (currentHour >= 10) {
    try {
      const raw = localStorage.getItem(LAST_AUTO_SETTLED_DATE_KEY);
      const map = raw ? JSON.parse(raw) || {} : {};
      const lastSettledDate = map[String(userId)];

      if (lastSettledDate !== todayKey) {
        const t1Bal = getT1WalletBalance(userId);
        if (t1Bal > 0) {
          triggerT1ToT0Settlement(userId, userObject, { name: "System Auto-Settlement (10:00 AM)" });
        }
        map[String(userId)] = todayKey;
        localStorage.setItem(LAST_AUTO_SETTLED_DATE_KEY, JSON.stringify(map));
      }
    } catch (e) {
      console.error("Auto settlement check error:", e);
    }
  }
};

/**
 * Record a debit transaction from Main Wallet, prioritizing Previous Day Settled Funds
 */
export const recordMainWalletDebit = (userId, amount) => {
  if (!userId || !amount) return;
  const numAmount = Math.max(0, Number(amount) || 0);
  if (numAmount <= 0) return;

  const prevDay = getPrevDaySettledBalance(userId);
  const deductedFromPrevDay = Math.min(prevDay, numAmount);
  const remainingPrevDay = Math.max(0, prevDay - deductedFromPrevDay);

  setPrevDaySettledBalance(userId, remainingPrevDay);
  dispatchSettlementChangeEvent({ type: "main_wallet_debit", userId, amount: numAmount });
};

/**
 * Record Settlement Audit Log
 */
export const recordSettlementAuditLog = ({ performingUser, affectedUser, previousState, newState, action }) => {
  try {
    const raw = localStorage.getItem(SETTLEMENT_AUDIT_LOG_KEY);
    const logs = raw ? JSON.parse(raw) || [] : [];

    const newEntry = {
      id: `settle_log_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      performingUser: performingUser
        ? {
            id: performingUser.id,
            name: performingUser.name || performingUser.full_name || performingUser.user_name || "Admin",
            role: performingUser.role || "admin",
          }
        : { name: "System Auto-Settlement" },
      affectedUser: affectedUser
        ? {
            id: affectedUser.id,
            name: affectedUser.name || affectedUser.full_name || affectedUser.user_name || "User",
            abheepay_id: affectedUser.abheepay_id || affectedUser.id || "-",
          }
        : null,
      previous_state: previousState || "-",
      new_state: newState || "-",
      action: action || "SETTLEMENT_ACTION",
      createdAt: new Date().toISOString(),
    };

    logs.unshift(newEntry);
    if (logs.length > 500) logs.length = 500;

    localStorage.setItem(SETTLEMENT_AUDIT_LOG_KEY, JSON.stringify(logs));
    dispatchSettlementChangeEvent({ type: "audit_log", entry: newEntry });
  } catch (error) {
    console.error("Failed to record settlement audit log:", error);
  }
};

/**
 * Get all settlement audit logs
 */
export const getSettlementAuditLogs = () => {
  try {
    const raw = localStorage.getItem(SETTLEMENT_AUDIT_LOG_KEY);
    return raw ? JSON.parse(raw) || [] : [];
  } catch {
    return [];
  }
};

/**
 * Clear all test settlement, limit, utilized, and override storage data
 */
export const clearAllTestTransactionData = () => {
  try {
    const keysToRemove = [];
    const allKeys = Object.keys(localStorage);
    allKeys.forEach((key) => {
      if (
        key &&
        (key.startsWith("user_daily_payout_utilized_") ||
          key.startsWith("user_t1_") ||
          key.startsWith("user_prev_day_") ||
          key.includes("audit_logs") ||
          key === "user_t1_wallet_balances" ||
          key === "user_prev_day_settled_balances" ||
          key === "user_t1_last_auto_settled_date" ||
          key === "pos_user_overrides_map" ||
          key === "user_daily_payout_limits")
      ) {
        keysToRemove.push(key);
      }
    });
    keysToRemove.forEach((k) => localStorage.removeItem(k));

    // Reset local user wallet object properties to 0.00
    const rawUser = localStorage.getItem("user");
    if (rawUser) {
      try {
        const u = JSON.parse(rawUser);
        u.wallet = "0.00";
        u.available_balance = "0.00";
        u.availableBalance = "0.00";
        u.t1_wallet = "0.00";
        localStorage.setItem("user", JSON.stringify(u));
      } catch {}
    }

    localStorage.setItem("user_wallet_zero_reset", "true");

    dispatchSettlementChangeEvent({ type: "storage_cleared" });
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("userDailyLimitUpdated", { detail: { cleared: true } }));
      window.dispatchEvent(new CustomEvent("userSettlementUpdated", { detail: { cleared: true } }));
      window.dispatchEvent(new Event("storage"));
    }
    return true;
  } catch (e) {
    console.error("Failed to clear transaction test data:", e);
    return false;
  }
};
