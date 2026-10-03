  /**
 * POS Settlement Mode & Daily T0 Limit Evaluator
 *
 * Rules:
 * 1. If merchant's global settlement mode is set to T1, settlement is T1.
 * 2. If merchant's global settlement mode is T0:
 *    - Check if merchant has a configured `t0_daily_limit`.
 *    - Calculate today's projected total T0 amount: (previous_t0_today + current_amount).
 *    - If projected_t0_total > t0_daily_limit:
 *        -> Auto-shift to T1 settlement for this transaction (and subsequent transactions today).
 *        -> Apply T1 rate.
 *    - Otherwise:
 *        -> Settle as T0.
 *        -> Apply T0 rate.
 */
import { getEffectiveUserDailyLimit } from "./userLimit";
import { getServiceFlagValue } from "./serviceFlags";

export const evaluateTransactionSettlement = ({
  userSettlementType = "T0",
  t0DailyLimit = null,
  previousT0TodayTotal = 0,
  currentAmount = 0,
  userObject = null,
  childMerchants = [],
  serviceFlags = null,
}) => {
  const amount = Number(currentAmount) || 0;
  const previousTotal = Number(previousT0TodayTotal) || 0;

  const isGlobalSwitchActive = getServiceFlagValue(
    serviceFlags || userObject?.service_flags,
    "pos_t0_settlement",
    true
  );

  // If Global Switch ("POS T0/T1 Settlement & Limit") is OFF:
  // Use static DB settlement mode (userSettlementType / stored DB value) without applying dynamic limit rules.
  if (!isGlobalSwitchActive) {
    const rawMode = String(userSettlementType || "T0").toUpperCase();
    const effectiveMode = rawMode === "T1" ? "T1" : "T0";
    return {
      effectiveSettlement: effectiveMode,
      appliedRateType: effectiveMode,
      isLimitExceeded: false,
      isUnassignedOrZeroLimit: false,
      previousT0TodayTotal: previousTotal,
      projectedT0Total: previousTotal,
      t0DailyLimit: null,
      isGlobalSwitchActive: false,
      reason: `Global POS Settlement Evaluator switch is OFF. Evaluated strictly using static DB settlement mode (${effectiveMode}) without dynamic limit rules.`,
    };
  }

  // If Global Switch is ON:
  // DB static state does not matter. Dynamically evaluate T0 vs T1 based on limit, amount, and today's utilized total.

  let effectiveLimitVal = t0DailyLimit;
  if (userObject) {
    const calc = getEffectiveUserDailyLimit(userObject.id, userObject, childMerchants);
    if (calc !== "unlimited" && calc !== null && calc !== undefined && calc !== "") {
      effectiveLimitVal = calc;
    }
  }

  const isLimitAssigned =
    effectiveLimitVal !== null && effectiveLimitVal !== undefined && effectiveLimitVal !== "" && effectiveLimitVal !== "unlimited";
  const limit = isLimitAssigned ? Number(effectiveLimitVal) : null;
  const configuredSettlement = String(userSettlementType || "T0").toUpperCase();

  // If user explicitly configured T1 mode
  if (configuredSettlement === "T1") {
    return {
      effectiveSettlement: "T1",
      appliedRateType: "T1",
      isLimitExceeded: false,
      isUnassignedOrZeroLimit: false,
      previousT0TodayTotal: previousTotal,
      projectedT0Total: previousTotal,
      t0DailyLimit: limit,
      reason: "User explicitly configured for T1 Settlement Mode.",
    };
  }

  // If T0 mode, but limit is 0 or NOT assigned (null / empty)
  if (!isLimitAssigned || limit === 0) {
    return {
      effectiveSettlement: "T1",
      appliedRateType: "T1",
      isLimitExceeded: false,
      isUnassignedOrZeroLimit: true,
      previousT0TodayTotal: previousTotal,
      projectedT0Total: previousTotal,
      t0DailyLimit: limit,
      reason: !isLimitAssigned
        ? "Daily T0 limit is not assigned. Transaction amount automatically routed to T1 Settlement."
        : "Daily T0 limit is ₹0. Transaction amount automatically routed to T1 Settlement.",
    };
  }

  // If T0 mode with assigned limit > 0, check limit against current transaction amount or projected total
  const projectedTotal = previousTotal + amount;
  if (amount > limit || projectedTotal > limit) {
    return {
      effectiveSettlement: "T1",
      appliedRateType: "T1",
      isLimitExceeded: true,
      isUnassignedOrZeroLimit: false,
      previousT0TodayTotal: previousTotal,
      projectedT0Total: projectedTotal,
      t0DailyLimit: limit,
      reason: amount > limit
        ? `Transaction amount ₹${amount.toLocaleString("en-IN")} exceeds daily T0 limit ₹${limit.toLocaleString("en-IN")}. Auto-shifted to T1 Settlement.`
        : `Projected daily T0 total ₹${projectedTotal.toLocaleString("en-IN")} exceeds limit ₹${limit.toLocaleString("en-IN")}. Auto-shifted to T1 Settlement.`,
    };
  }

  // Under limit: settle as T0
  return {
    effectiveSettlement: "T0",
    appliedRateType: "T0",
    isLimitExceeded: false,
    isUnassignedOrZeroLimit: false,
    previousT0TodayTotal: previousTotal,
    projectedT0Total: projectedTotal,
    t0DailyLimit: limit,
    reason: "Within daily T0 limit. Settled under T0 Mode.",
  };
};
