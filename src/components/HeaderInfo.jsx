import React, { useState, useEffect } from "react";
import { Clock, LayoutDashboard, Shield, Sliders } from "lucide-react";
import { normalizeUserRole, getParentFranchiseId, extractUsersArray } from "../utils/userAccess";
import {
  getEffectiveUserDailyLimit,
  getUserTodayUtilized,
} from "../utils/userLimit";
import { useQuery } from "@tanstack/react-query";
import { getAllPosTransactionReport } from "../api/reportsApi";
import { AllUsers, MerchantAllUsers } from "../api/FranchiseApi";
import {
  getT1WalletBalance,
  getPrevDaySettledBalance,
  getUserCutoffTimestamp,
  isCutoffTimestampPassed,
  getUsableMainWalletBalance,
  checkAndAutoSettleT1,
  getTodayDateKey,
} from "../utils/userSettlement";

const HeaderInfo = ({ dashboardData, currentUser }) => {
  const [limitUpdateTick, setLimitUpdateTick] = useState(0);

  useEffect(() => {
    const handleLimitUpdate = () => {
      setLimitUpdateTick((prev) => prev + 1);
    };
    window.addEventListener("userDailyLimitUpdated", handleLimitUpdate);
    window.addEventListener("userSettlementUpdated", handleLimitUpdate);
    window.addEventListener("storage", handleLimitUpdate);

    if (currentUser?.id) {
      checkAndAutoSettleT1(currentUser.id, currentUser);
    }

    return () => {
      window.removeEventListener("userDailyLimitUpdated", handleLimitUpdate);
      window.removeEventListener("userSettlementUpdated", handleLimitUpdate);
      window.removeEventListener("storage", handleLimitUpdate);
    };
  }, [currentUser]);

  const currentDate = new Date();
  const dateString = currentDate.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const dayString = currentDate.toLocaleDateString("en-US", { weekday: "long" });

  const normalizedRole = normalizeUserRole(currentUser?.role);
  const roleLabel =
    normalizedRole === "admin"
      ? "Admin"
      : normalizedRole === "employee"
        ? "Employee" 
        : normalizedRole === "franchise" 
          ? "Franchise"
          : normalizedRole === "super_admin"
          ? "Super Admin"
          : "Super Franchise";

  const userId = currentUser?.id;

  const isFranchiseRole = (() => {
    const r = String(currentUser?.role || "").toLowerCase();
    return r === "franchise" || r === "franchaise" || r === "distributor";
  })();

  // Fetch child merchants using BOTH APIs for maximum reliability
  const { data: merchantApiData } = useQuery({
    queryKey: ["headerMerchantUsers", userId],
    queryFn: () => MerchantAllUsers({ franchiseId: userId, limit: 1000 }),
    enabled: isFranchiseRole && Boolean(userId),
    staleTime: 10 * 1000,
  });

  const { data: allUsersData } = useQuery({
    queryKey: ["allUsersListForHeaderInfo", userId],
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
      // Skip self
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
        // Only include merchants (not franchise/admin)
        if (uRole !== "admin" && uRole !== "franchise") {
          merged.set(String(u.id), u);
        }
      }
    });

    return Array.from(merged.values());
  }, [isFranchiseRole, merchantApiData, allUsersData, userId]);

  // Live POS Transactions lookup for T1 hold balance and T0 limit utilization
  const { data: posTxnRows } = useQuery({
    queryKey: ["headerTodayPosTxnsForT1", userId],
    queryFn: async () => {
      const todayStr = getTodayDateKey();
      const rows = await getAllPosTransactionReport({ from_date: todayStr, to_date: todayStr }).catch(() => []);
      return rows || [];
    },
    enabled: Boolean(userId),
    staleTime: 15 * 1000,
  });

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

  // Calculate Today's Limit information
  const effectiveLimit = getEffectiveUserDailyLimit(userId, currentUser, childMerchants);
  const utilizedToday = getUserTodayUtilized(userId, currentUser, todayPosT0Sum);
  const isLimitActive =
    effectiveLimit !== "" && effectiveLimit !== null && effectiveLimit !== undefined;
  const rawNum = isLimitActive ? Number(effectiveLimit) : null;
  const limitNum = Number.isFinite(rawNum) ? rawNum : null;
  const leftNum = limitNum !== null ? Math.max(0, limitNum - utilizedToday) : null;

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

  // Dual Wallet & Cutoff logic
  const t1Bal = getT1WalletBalance(userId, currentUser, posTxnMap, dashboardData);
  const usableBal = getUsableMainWalletBalance(userId, currentUser, posTxnMap, dashboardData);

  return (
    <div className="bg-white p-4 mb-4 rounded-2xl border border-gray-100 pr-14 lg:pr-4">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 md:gap-6">
        {/* Left Section: Dashboard Title and User Info */}
        <div className="flex items-start gap-4 sm:gap-5 min-w-0">
          <div className="relative">
            <div className="bg-primary text-white p-4 rounded-xl shadow-lg transform hover:rotate-6 transition-transform">
              <LayoutDashboard size={32} />
            </div>
            <div className="absolute -top-2 -right-2 bg-indigo-100 text-black text-xs font-bold px-2 py-1 rounded-full shadow">
              {roleLabel}
            </div>
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight break-words leading-tight">
              {currentUser?.name || dashboardData?.userName || "User"}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <p className="text-gray-500 text-xs flex items-center gap-1.5 break-all">
                <Shield size={16} className="text-green-500" />
                <span>ID: {currentUser?.abheepay_id || "N/A"}</span>
              </p>
            </div>
          </div>
        </div>

        <div className="w-full md:w-auto flex flex-col sm:flex-row gap-3 sm:gap-6 items-stretch sm:items-center">
          {/* Dual Wallet Display: T0 Main Wallet & T1 Wallet (Hidden for Admin & Employee) */}
          {!(normalizedRole === "admin" || normalizedRole === "employee") && (() => {
            const walletNum = parseFloat(currentUser?.wallet ?? 0);

            return (
              <div className="flex flex-col gap-2 min-w-[240px]">
                <div className="flex flex-col gap-1 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 p-3 shadow-sm text-xs">
                  {/* Total Row */}
                  <div className="flex justify-between items-center gap-3">
                    <span className="text-slate-500 font-medium">Total</span>
                    <span className="font-bold text-slate-900">₹{walletNum.toFixed(2)}</span>
                  </div>

                  {/* On Settlement Hold Row */}
                  {(() => {
                    const holdAmt = Math.max(0, walletNum - usableBal);
                    return holdAmt > 0 ? (
                      <div className="flex justify-between items-center gap-3">
                        <span className="text-amber-600 font-medium">On Settlement Hold</span>
                        <span className="font-bold text-amber-600">- ₹{holdAmt.toFixed(2)}</span>
                      </div>
                    ) : null;
                  })()}

                  {/* Available Row */}
                  <div className="flex justify-between items-center gap-3 pt-1 border-t border-slate-200">
                    <span className="text-emerald-700 font-medium">Available</span>
                    <span className="font-bold text-emerald-700">₹{usableBal.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Right Section: Date and Day */}
          <div className="bg-gradient-to-br from-indigo-50 to-gray-100 p-3 sm:p-4 rounded-xl shadow-md flex items-center gap-3 sm:gap-4 hover:shadow-lg transition-shadow">
            <Clock size={24} className="text-indigo-600" />
            <div className="min-w-0">
              <p className="text-gray-800 font-semibold text-sm">{dayString}</p>
              <p className="text-gray-600 text-xs">{dateString}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HeaderInfo;
