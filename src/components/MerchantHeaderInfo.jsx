import React, { useEffect, useState } from "react";
import { Clock, Bell, Wallet, Sliders, ArrowRightLeft } from "lucide-react";
import {
  getEffectiveUserDailyLimit,
  getUserTodayUtilized,
} from "../utils/userLimit";
import { useQuery } from "@tanstack/react-query";
import { getAllPosTransactionReport } from "../api/reportsApi";
import { AllUsers, MerchantAllUsers } from "../api/FranchiseApi";
import { normalizeUserRole, getParentFranchiseId, extractUsersArray } from "../utils/userAccess";
import {
  getT1WalletBalance,
  getPrevDaySettledBalance,
  getUserCutoffTimestamp,
  isCutoffTimestampPassed,
  getUsableMainWalletBalance,
  checkAndAutoSettleT1,
  getTodayDateKey,
} from "../utils/userSettlement";

const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 12) return "Good Morning";
  if (h < 17) return "Good Afternoon";
  return "Good Evening";
};

const MerchantHeaderInfo = ({ dashboardData, currentUser, pageTitle = "Merchant Dashboard" }) => {
  const [currentDateTime, setCurrentDateTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentDateTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formattedDate = currentDateTime.toLocaleDateString("en-IN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const {
    id: userId,
    name = "Merchant",
    role = "merchant",
    abheepay_id = "N/A",
    wallet = "0.00",
    available_balance,
    settlement_type,
  } = currentUser || {};

  const walletNum = parseFloat(wallet) || 0;

  const [limitUpdateTick, setLimitUpdateTick] = useState(0);

  useEffect(() => {
    const handleLimitUpdate = () => {
      setLimitUpdateTick((prev) => prev + 1);
    };
    window.addEventListener("userDailyLimitUpdated", handleLimitUpdate);
    window.addEventListener("userSettlementUpdated", handleLimitUpdate);
    window.addEventListener("storage", handleLimitUpdate);

    if (userId) {
      checkAndAutoSettleT1(userId, currentUser);
    }

    return () => {
      window.removeEventListener("userDailyLimitUpdated", handleLimitUpdate);
      window.removeEventListener("userSettlementUpdated", handleLimitUpdate);
      window.removeEventListener("storage", handleLimitUpdate);
    };
  }, [userId, currentUser]);

  const isFranchiseRole = (() => {
    const r = String(role || "").toLowerCase();
    return r === "franchise" || r === "franchaise" || r === "distributor";
  })();

  // Fetch child merchants using BOTH APIs for maximum reliability
  const { data: merchantApiData } = useQuery({
    queryKey: ["merchantHeaderMerchantUsers", userId],
    queryFn: () => MerchantAllUsers({ franchiseId: userId, limit: 1000 }),
    enabled: isFranchiseRole && Boolean(userId),
    staleTime: 10 * 1000,
  });

  const { data: allUsersData } = useQuery({
    queryKey: ["allUsersListForMerchantHeaderInfo", userId],
    queryFn: () => AllUsers({ limit: 1000 }),
    enabled: isFranchiseRole && Boolean(userId),
    staleTime: 10 * 1000,
  });

  const childMerchants = React.useMemo(() => {
    if (!isFranchiseRole) return [];

    const curId = Number(userId);
    const curIdStr = String(userId || "");

    // Strategy 1: Use MerchantAllUsers (backend-filtered by franchise_id) — most reliable
    const merchantList = extractUsersArray(merchantApiData);

    // Strategy 2: Use AllUsers + getParentFranchiseId (same logic as PosSetting.jsx)
    const allList = extractUsersArray(allUsersData);
    const fromAllFiltered = allList.filter((u) => {
      const uRole = normalizeUserRole(u.role);
      if (uRole === "admin" || uRole === "franchise") return false;
      if (String(u.id) === curIdStr) return false;
      const parentId = getParentFranchiseId(u);
      return (
        parentId === curId ||
        String(u.franchise_id) === curIdStr ||
        String(u.parent_id) === curIdStr
      );
    });

    // Merge both lists, deduplicate by user id
    const merged = new Map();
    [...merchantList, ...fromAllFiltered].forEach((u) => {
      if (u?.id) {
        const uRole = normalizeUserRole(u.role);
        if (uRole !== "admin" && uRole !== "franchise") {
          merged.set(String(u.id), u);
        }
      }
    });

    return Array.from(merged.values());
  }, [isFranchiseRole, merchantApiData, allUsersData, userId]);

  // Live POS T1 Transactions lookup
  const { data: posTxnRows } = useQuery({
    queryKey: ["merchantHeaderTodayPosTxnsForT1", userId],
    queryFn: async () => {
      const todayStr = getTodayDateKey();
      const rows = await getAllPosTransactionReport({ from_date: todayStr, to_date: todayStr }).catch(() => []);
      return rows || [];
    },
    enabled: Boolean(userId),
    staleTime: 15 * 1000,
  });

  const posTxnMap = React.useMemo(() => {
    const map = new Map();
    if (!posTxnRows || !Array.isArray(posTxnRows)) return map;

    posTxnRows.forEach((row) => {
      const rawSettlement = String(row?.settlement_type || "").trim().toLowerCase();
      const isT1 =
        rawSettlement.includes("next_day") ||
        rawSettlement.includes("t1") ||
        rawSettlement.includes("t+1") ||
        rawSettlement === "nextdaysettlement";

      if (isT1) {
        const grossAmt = Number(row?.amount || row?.txn_amount || row?.total_amount || 0);
        const rawNet = row?.net_credit ?? row?.netCredit ?? row?.net_amount ?? row?.netAmount ?? row?.credit_amount ?? row?.creditAmount ?? row?.settlement_amount ?? null;
        const chargeAmt = Number(row?.mdr || row?.net_charge || row?.charge_amount || row?.charges || row?.charge || row?.pos_charge || row?.fee || 0);
        const netAmt = rawNet !== null && rawNet !== undefined ? Number(rawNet) : (grossAmt > 0 ? grossAmt - chargeAmt : 0);
        const amt = Math.max(0, netAmt);

        if (Number.isFinite(amt) && amt > 0) {
          const uId = row?.user_id ? String(row.user_id) : "";
          const abheeId = row?.abheepay_id ? String(row.abheepay_id) : "";
          const mId = row?.merchant_id ? String(row.merchant_id) : "";
          const fId = row?.franchise_id ? String(row.franchise_id) : "";

          [uId, abheeId, mId, fId].forEach((key) => {
            if (key) {
              map.set(key, (map.get(key) || 0) + amt);
            }
          });
        }
      }
    });

    return map;
  }, [posTxnRows]);

  const todayPosT0Sum = React.useMemo(() => {
    if (!posTxnRows || !Array.isArray(posTxnRows)) return 0;
    let sum = 0;
    const curIdStr = String(userId || "");
    const curAbheeId = String(currentUser?.abheepay_id || "");

    posTxnRows.forEach((row) => {
      const rawSettlement = String(row?.settlement_type || "").trim().toLowerCase();
      const isT0 =
        rawSettlement.includes("today") ||
        rawSettlement.includes("t0") ||
        rawSettlement.includes("t+0") ||
        rawSettlement.includes("same_day") ||
        rawSettlement === "samedaysettlement";

      if (isT0) {
        const rowUId = String(row?.user_id || row?.merchant_id || row?.franchise_id || "");
        if (rowUId && (rowUId === curIdStr || rowUId === curAbheeId)) {
          const amt = Number(row?.amount || row?.txn_amount || row?.total_amount || 0);
          if (Number.isFinite(amt) && amt > 0) {
            sum += amt;
          }
        }
      }
    });

    return sum;
  }, [posTxnRows, userId, currentUser]);

  // Dual Wallet & Cutoff logic
  const t1Bal = getT1WalletBalance(userId, currentUser, posTxnMap, dashboardData);
  const usableBal = getUsableMainWalletBalance(userId, currentUser, posTxnMap, dashboardData);

  const settlementHoldNum = Math.max(0, walletNum - usableBal);
  const availableBalanceNum = usableBal;

  // Today's Limit Calculation
  const effectiveLimit = getEffectiveUserDailyLimit(userId, currentUser, childMerchants);
  const utilizedToday = getUserTodayUtilized(userId, currentUser, todayPosT0Sum);
  const isLimitActive =
    effectiveLimit !== "" && effectiveLimit !== null && effectiveLimit !== undefined;
  const rawNum = isLimitActive ? Number(effectiveLimit) : null;
  const limitNum = Number.isFinite(rawNum) ? rawNum : null;
  const leftNum = limitNum !== null ? Math.max(0, limitNum - utilizedToday) : null;

  return (
    <>
      {/* ── MOBILE ONLY ── */}
      <div className="md:hidden mb-4">
        <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-3 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500">{getGreeting()}</p>
              <h2 className="text-xl font-bold text-gray-800 mt-0.5">{name}</h2>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-[#00D3CD]/10 text-[#00D3CD] border border-[#00D3CD]/20 px-2.5 py-1 text-xs font-semibold uppercase">
                {role}
              </span>
            </div>
          </div>
          {abheepay_id !== "N/A" && (
            <p className="mt-1.5 text-xs text-[#00D3CD] font-medium">
              Abheepay ID: {abheepay_id}
            </p>
          )}
        </div>

        {/* Teal balance card */}
        <div
          className="relative overflow-hidden rounded-2xl p-4 shadow-md"
          style={{ background: "linear-gradient(135deg, #00D3CD 0%, #00b8b3 100%)" }}
        >
          <div className="pointer-events-none absolute -right-8 -top-8 h-36 w-36 rounded-full bg-white/10" />
          <div className="pointer-events-none absolute -bottom-6 right-10 h-24 w-24 rounded-full bg-white/10" />
          <div className="relative flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-white/80">Total Balance</p>
              <p className="mt-1 text-xl font-bold text-white">₹{walletNum.toFixed(2)}</p>
              <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white/20 px-2 py-0.5">
                <span className="text-xs text-white/80">Available Balance</span>
                <span className="rounded-full bg-white px-2.5 py-0.5 text-xs font-bold text-[#00D3CD]">
                  ₹{availableBalanceNum.toFixed(2)}
                </span>
              </div>
              {settlementHoldNum > 0 && (
                <p className="mt-1.5 text-xs text-white/70">
                  On Settlement Hold: ₹{settlementHoldNum.toFixed(2)}
                </p>
              )}
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20">
              <Wallet size={24} className="text-white" />
            </div>
          </div>
        </div>

        {settlementHoldNum > 0 && settlement_type === "next_day_settlement" && (
          <p className="mt-2 text-xs text-amber-600 px-1">
            ₹{settlementHoldNum.toFixed(2)} of your POS earnings will be available
            for withdrawal tomorrow at 10:30 AM.
          </p>
        )}
      </div>

      {/* ── DESKTOP ONLY ── */}
      <div className="hidden md:block mb-4 rounded-2xl border border-gray-100 bg-white p-4 pr-14 shadow-sm sm:mb-6 sm:p-5 sm:pr-16 md:mb-8 md:p-6 md:pr-6 md:shadow-md">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between md:gap-6">
          <div className="flex flex-col gap-2.5 sm:gap-3">
            <h2 className="text-[1.9rem] font-bold leading-tight text-gray-800 sm:text-2xl">
              Hello, {name}!
            </h2>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-gray-600">
              <span className="flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-gray-500" />
                {formattedDate}
              </span>
              <span className="rounded-full bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-700 sm:text-sm">
                Role: {role.charAt(0).toUpperCase() + role.slice(1)}
              </span>
              {abheepay_id !== "N/A" && (
                <span className="text-xs text-gray-500 sm:text-sm">
                  Abheepay ID: {abheepay_id}
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm sm:flex sm:flex-wrap items-center">
              <div className="flex items-center justify-between gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2">
                <span className="text-gray-500">Total Balance</span>
                <span className="font-semibold text-gray-800">₹{walletNum.toFixed(2)}</span>
              </div>
              {settlementHoldNum > 0 && (
                <div
                  className="col-span-2 flex items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2"
                  title="POS earnings from today. Available tomorrow at 10:30 AM."
                >
                  <span className="text-amber-600 font-medium">On Settlement Hold</span>
                  <span className="font-semibold text-amber-700">
                    - ₹{settlementHoldNum.toFixed(2)}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between gap-2 rounded-xl border border-green-200 bg-green-50 px-3 py-2">
                <span className="text-gray-500">Available</span>
                <span className="font-semibold text-green-700">₹{availableBalanceNum.toFixed(2)}</span>
              </div>

              {/* Today's T0 Payin Limit Badge in Desktop Dashboard */}
              <div
                className={`flex flex-col gap-1 rounded-xl border px-3.5 py-2 min-w-[200px] ${
                  String(effectiveLimit).toLowerCase() === "unlimited"
                    ? "border-cyan-200 bg-cyan-50/90 text-cyan-950"
                    : limitNum !== null && limitNum > 0
                      ? "border-cyan-200 bg-cyan-50/80 text-cyan-950"
                      : "border-amber-200 bg-amber-50/90 text-amber-950"
                }`}
              >
                <div className="flex items-center justify-between gap-3 text-xs">
                  <span className="font-semibold flex items-center gap-1.5 text-slate-700">
                    <Sliders size={14} className="text-[#00D3CD]" /> Today T0 Limit
                  </span>
                  <span className="font-black text-sm">
                    {String(effectiveLimit).toLowerCase() === "unlimited"
                      ? "⚡ Unlimited"
                      : limitNum !== null && limitNum > 0
                        ? `₹${limitNum.toLocaleString("en-IN")}`
                        : limitNum === 0
                          ? "₹0 (T1 Only)"
                          : "Unassigned (T1)"}
                  </span>
                </div>

                {String(effectiveLimit).toLowerCase() === "unlimited" ? (
                  <div className="flex justify-between items-center text-[10.5px] text-slate-500 border-t border-cyan-200/60 pt-1 mt-0.5">
                    <span>Used: ₹{utilizedToday.toLocaleString("en-IN")}</span>
                    <span className="text-emerald-700 font-bold">Left: Full Wallet</span>
                  </div>
                ) : limitNum !== null && limitNum > 0 ? (
                  <div className="flex justify-between items-center text-[10.5px] text-slate-600 border-t border-cyan-200/60 pt-1 mt-0.5 font-medium">
                    <span>Used: ₹{utilizedToday.toLocaleString("en-IN")}</span>
                    <span className="text-emerald-700 font-bold">Left: ₹{leftNum.toLocaleString("en-IN")}</span>
                  </div>
                ) : (
                  <div className="text-[10px] text-amber-700 font-semibold border-t border-amber-200/60 pt-1 mt-0.5">
                    ⚠️ All transactions auto-shift to T1 Settlement Mode
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default MerchantHeaderInfo;
