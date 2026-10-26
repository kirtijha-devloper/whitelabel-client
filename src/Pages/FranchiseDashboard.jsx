import React from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Users,
  Smartphone,
  CheckCircle2,
  XCircle,
  ArrowRight,
  CreditCard,
  TrendingUp,
  Wallet,
  Calendar,
  Clock,
  UserPlus,
} from "lucide-react";
import { FaHistory } from "react-icons/fa";
import DashboardChartLauncher from "../components/DashboardChartLauncher";

const FranchiseDashboard = ({ dashboardData = {} }) => {
  const navigate = useNavigate();
  const rawData = dashboardData?.data ?? dashboardData ?? {};

  const assigned_merchants = rawData.assigned_merchants ?? rawData.merchants ?? { count: rawData.merchantCount ?? 0 };
  const pos_machines = rawData.pos_machines ?? {};
  const pos_transactions = rawData.pos_transactions ?? {};
  const today_total_payout = rawData.today_total_payout ?? rawData.todayPayout ?? 0;

  const ccBillPaymentTXN = rawData.ccBillPaymentTXN ?? 0;
  const ccBillPaymentSuccess = rawData.ccBillPaymentSuccess ?? 0;
  const ccBillPaymentFailed = rawData.ccBillPaymentFailed ?? 0;

  const toNumber = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const assignedToFranchiseCount = toNumber(
    pos_machines.assigned_to_franchise ??
    pos_machines.assigned_to_franchise_count ??
    pos_machines.active ??
    0
  );

  const assignedToMerchantCount = toNumber(
    pos_machines.assigned_to_merchants ??
    pos_machines.assigned_to_merchants_count ??
    pos_machines.inactive ??
    0
  );

  const machineTotal = toNumber(
    pos_machines.count ??
    pos_machines.total ??
    (assignedToFranchiseCount + assignedToMerchantCount)
  );

  const formatAmount = (value) =>
    toNumber(value).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  const formatCount = (value) => toNumber(value).toLocaleString("en-IN");

  const todayFormatted = new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  // Entity Cards (Merchants & POS Hardware)
  const entityCards = [
    {
      title: "Merchant List",
      count: assigned_merchants.count || 0,
      subtitle: "Active assigned merchants",
      link: "/franchise/list",
      icon: Users,
      iconBox: "bg-purple-50 text-purple-600 border border-purple-100",
      hoverBorder: "hover:border-purple-300",
      linkText: "View Merchant List",
    },
    {
      title: "POS Machine List",
      count: machineTotal,
      subtitle: "Total fleet inventory",
      link: "/franchise/stock-pos",
      icon: Smartphone,
      iconBox: "bg-[#00D3CD]/10 text-[#00a8a3] border border-[#00D3CD]/20",
      hoverBorder: "hover:border-[#00D3CD]/50",
      linkText: "View All Terminals",
    },
    {
      title: "Assigned to Merchants",
      count: assignedToMerchantCount,
      subtitle: "Deployed at merchant counters",
      link: "/franchise/stock-pos",
      icon: CheckCircle2,
      iconBox: "bg-emerald-50 text-emerald-600 border border-emerald-100",
      hoverBorder: "hover:border-emerald-300",
      linkText: "View Deployed Units",
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8 space-y-8">
      {/* ================= HEADER ================= */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-gray-100 pb-6">
        <div>
          <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-[#00D3CD]/10 text-[#00a8a3] border border-[#00D3CD]/20 mb-2">
            Franchise Overview
          </span>

          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">
            Franchise Dashboard
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            Real-time merchant operations, terminal distribution, and daily performance
          </p>
        </div>

        {/* Action Controls & Date */}
        <div className="flex flex-wrap items-center gap-3">
          <Link
            to="/franchise/create-user"
            className="inline-flex h-11 items-center gap-2 px-4 rounded-xl bg-gradient-to-r from-[#00D3CD] to-[#00b8b3] text-white text-sm font-semibold shadow-sm hover:opacity-95 transition active:scale-[0.98]"
          >
            <UserPlus className="h-4 w-4" />
            <span>Create Merchant</span>
          </Link>

          <div className="hidden sm:flex items-center gap-2.5 rounded-xl border border-gray-200 bg-white px-3.5 py-2 shadow-sm">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#00D3CD]/10 text-[#00a8a3]">
              <Calendar className="h-4 w-4" />
            </div>
            <span className="text-xs font-semibold text-gray-700">
              {todayFormatted}
            </span>
          </div>

          <DashboardChartLauncher
            label="Analytics"
            buttonClassName="inline-flex h-11 items-center gap-2 px-4 rounded-xl border border-gray-200 bg-white text-gray-800 text-sm font-semibold shadow-sm hover:bg-gray-50 transition active:scale-[0.98]"
          />
        </div>
      </div>

      {/* ================= SECTION 1: MERCHANTS & TERMINAL FLEET ================= */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Users className="w-5 h-5 text-[#00a8a3]" />
              Merchant & POS Terminal Inventory
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Assigned merchants, machine allocations, and deployed units
            </p>
          </div>
          <span className="text-xs font-semibold text-gray-400 hidden sm:inline-block">
            Click card to view records
          </span>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {entityCards.map((card) => {
            const Icon = card.icon;
            return (
              <Link
                key={card.title}
                to={card.link}
                className={`group flex min-h-[145px] flex-col justify-between rounded-2xl bg-white p-5 border border-gray-100 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${card.hoverBorder} active:scale-[0.99]`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                      {card.title}
                    </p>
                    <h3 className="mt-2 text-3xl font-extrabold tracking-tight text-gray-900 group-hover:text-[#00a8a3] transition-colors">
                      {formatCount(card.count)}
                    </h3>
                  </div>

                  <div
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-transform group-hover:scale-105 ${card.iconBox}`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-gray-50 flex items-center justify-between">
                  <span className="text-xs text-gray-400 group-hover:text-gray-600 transition-colors">
                    {card.subtitle}
                  </span>
                  <div className="inline-flex items-center gap-1 text-xs font-semibold text-[#00a8a3] group-hover:translate-x-1 transition-transform">
                    <span>{card.linkText}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* ================= SECTION 2: TRANSACTION ACTIVITY ================= */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-[#00a8a3]" />
              Today's Transaction Metrics
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              POS swipe volume, instant settlement, and bill payment breakdown
            </p>
          </div>
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-[#00D3CD]/10 text-[#00a8a3] border border-[#00D3CD]/20">
            Live Daily
          </span>
        </div>

        {/* First Row: POS Transactions (with Flagship Hero Card) */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-4">
          {/* Hero Card: Today POS Volume */}
          <div className="group flex min-h-[145px] flex-col justify-between rounded-2xl p-5 bg-gradient-to-br from-[#00D3CD] to-[#00b8b3] text-white shadow-sm border border-[#00D3CD]/30 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wider text-white/90">
                  Today POS Volume
                </p>
                <h3 className="mt-2 text-3xl font-extrabold tracking-tight text-white">
                  ₹{formatAmount(pos_transactions.total)}
                </h3>
              </div>
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/20 text-white transition-transform group-hover:scale-105">
                <TrendingUp className="h-5 w-5" />
              </div>
            </div>
            <p className="mt-3 text-xs text-white/80">
              Total volume processed through POS terminals today
            </p>
          </div>

          {/* Today POS Success */}
          <div className="group flex min-h-[145px] flex-col justify-between rounded-2xl p-5 bg-white text-gray-900 border border-gray-100 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-emerald-200">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Today POS Success
                  </p>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Settled
                  </span>
                </div>
                <h3 className="mt-2 text-3xl font-extrabold tracking-tight text-gray-900">
                  ₹{formatAmount(pos_transactions.success)}
                </h3>
              </div>
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 transition-transform group-hover:scale-105">
                <CheckCircle2 className="h-5 w-5" />
              </div>
            </div>
            <p className="mt-3 text-xs text-emerald-600 font-medium">
              Successfully settled & captured volume
            </p>
          </div>

          {/* POS T0 / T+1 Split */}
          <div className="group flex min-h-[145px] flex-col justify-between rounded-2xl p-5 bg-white text-gray-900 border border-gray-100 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-indigo-200">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Today POS Settlement Split
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <div className="rounded-xl bg-sky-50 px-3 py-1.5 border border-sky-100">
                    <span className="text-[10px] font-bold text-sky-700 uppercase tracking-wider block">
                      T0 Instant
                    </span>
                    <span className="text-sm font-extrabold text-gray-900 block mt-0.5">
                      ₹{formatAmount(pos_transactions.t0_amount)}
                    </span>
                  </div>
                  <div className="rounded-xl bg-violet-50 px-3 py-1.5 border border-violet-100">
                    <span className="text-[10px] font-bold text-violet-700 uppercase tracking-wider block">
                      T+1 Next Day
                    </span>
                    <span className="text-sm font-extrabold text-gray-900 block mt-0.5">
                      ₹{formatAmount(pos_transactions.t1_amount)}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100 transition-transform group-hover:scale-105">
                <Clock className="h-5 w-5" />
              </div>
            </div>
            <p className="mt-3 text-xs text-gray-400">
              Breakdown by instant vs standard settlement cycles
            </p>
          </div>
        </div>

        {/* Second Row: CC Bill Payments */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {/* CC Total */}
          <div className="group flex min-h-[145px] flex-col justify-between rounded-2xl p-5 bg-white text-gray-900 border border-gray-100 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-blue-200">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Today CC Billpayment TXN
                </p>
                <h3 className="mt-2 text-3xl font-extrabold tracking-tight text-gray-900">
                  ₹{formatAmount(ccBillPaymentTXN)}
                </h3>
              </div>
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#0284c7]/10 text-[#0284c7] border border-[#0284c7]/20 transition-transform group-hover:scale-105">
                <CreditCard className="h-5 w-5" />
              </div>
            </div>
            <p className="mt-3 text-xs text-gray-400">
              Total credit card bill payments initiated
            </p>
          </div>

          {/* CC Success */}
          <div className="group flex min-h-[145px] flex-col justify-between rounded-2xl p-5 bg-white text-gray-900 border border-gray-100 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-emerald-200">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Today CC Success
                  </p>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Success
                  </span>
                </div>
                <h3 className="mt-2 text-3xl font-extrabold tracking-tight text-gray-900">
                  ₹{formatAmount(ccBillPaymentSuccess)}
                </h3>
              </div>
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 transition-transform group-hover:scale-105">
                <CheckCircle2 className="h-5 w-5" />
              </div>
            </div>
            <p className="mt-3 text-xs text-emerald-600 font-medium">
              Completed without biller errors
            </p>
          </div>

          {/* CC Failed */}
          <div className="group flex min-h-[145px] flex-col justify-between rounded-2xl p-5 bg-white text-gray-900 border border-gray-100 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-rose-200">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Today CC Failed
                  </p>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-rose-50 text-rose-700 border border-rose-200">
                    Failed
                  </span>
                </div>
                <h3 className="mt-2 text-3xl font-extrabold tracking-tight text-gray-900">
                  ₹{formatAmount(ccBillPaymentFailed)}
                </h3>
              </div>
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-600 border border-rose-200 transition-transform group-hover:scale-105">
                <XCircle className="h-5 w-5" />
              </div>
            </div>
            <p className="mt-3 text-xs text-rose-600 font-medium">
              Failed or rejected requests
            </p>
          </div>
        </div>
      </div>

      {/* ================= SECTION 3: TODAY TOTAL PAYOUT CARD ================= */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6 sm:p-7 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#00D3CD]/10 text-[#00a8a3] border border-[#00D3CD]/20">
            <Wallet className="h-7 w-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                Today Total Payout
              </span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                Wallet Settled
              </span>
            </div>
            <p className="text-3xl sm:text-4xl font-extrabold tracking-tight text-gray-900 mt-1">
              ₹{formatAmount(today_total_payout)}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Total volume settled directly into franchise and merchant accounts today.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <DashboardChartLauncher
            label="View 5-Day Charts"
            buttonClassName="inline-flex h-11 items-center gap-2 px-5 rounded-xl border border-gray-200 bg-white text-gray-800 text-sm font-semibold shadow-sm hover:bg-gray-50 hover:border-gray-300 transition active:scale-[0.98]"
          />
          <button
            onClick={() => navigate("/franchise/total-payouts")}
            className="inline-flex h-11 items-center gap-2 px-5 rounded-xl bg-gray-900 hover:bg-gray-800 text-white text-sm font-semibold shadow-sm transition active:scale-[0.98]"
          >
            <FaHistory className="w-3.5 h-3.5 text-gray-400" />
            Payout History
          </button>
        </div>
      </div>
    </div>
  );
};

export default FranchiseDashboard;
