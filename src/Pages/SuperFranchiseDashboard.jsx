import React from "react";
import { FaArrowRight, FaHistory } from "react-icons/fa";
import { Link, useNavigate } from "react-router-dom";
import StatCard from "../components/StatCard";
import DataCard from "../components/DataCard";
import DashboardChartLauncher from "../components/DashboardChartLauncher";
import { useQuery } from "@tanstack/react-query";
import Loader from "../components/Loader";
import { getDashboard } from "../api/DashboardAndHeader";

export default function SuperFranchiseDashboard({ dashboardData: propDashboardData }) {
  const navigate = useNavigate();
  const { data: dashboardQueryData, isLoading } = useQuery({
    queryKey: ["superFranchiseDashboard"],
    queryFn: () => getDashboard(),
    initialData: propDashboardData,
  });

  if (isLoading && !propDashboardData) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader />
      </div>
    );
  }

  const rawData = dashboardQueryData?.data ?? dashboardQueryData ?? propDashboardData ?? {};
  const merchants = rawData.merchants ?? rawData.assigned_merchants ?? { count: rawData.merchant_count ?? rawData.total_merchants ?? 0 };
  const franchises = rawData.franchaises ?? { count: rawData.franchise_count ?? rawData.total_franchises ?? 0 };
  const pos_machines =
    rawData.pos_machines ??
    ({
      active: rawData.posActive ?? rawData.active_pos ?? 0,
      inactive: rawData.posDActive ?? rawData.inactive_pos ?? 0,
    });
  const pos_transactions =
    rawData.pos_transactions ??
    ({
      total: rawData.posTransactions ?? 0,
      success: rawData.posSuccess ?? 0,
      fail: rawData.posFailed ?? 0,
      t0_amount: rawData.posT0Amount ?? 0,
      t1_amount: rawData.posT1Amount ?? 0,
    });
  const today_total_payout = rawData.today_total_payout ?? rawData.todayPayout ?? 0;
  const ccBillPaymentTXN = rawData.ccBillPaymentTXN ?? 0;
  const ccBillPaymentSuccess = rawData.ccBillPaymentSuccess ?? 0;
  const ccBillPaymentFailed = rawData.ccBillPaymentFailed ?? 0;

  const toNumber = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const formatAmount = (value) =>
    toNumber(value).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  const formatCount = (value) => toNumber(value).toLocaleString("en-IN");

  const getStatTone = (title = "") => {
    const normalized = title.toLowerCase();
    if (normalized.includes("success")) return "bg-emerald-500";
    if (normalized.includes("failed") || normalized.includes("fail")) return "bg-rose-500";
    if (normalized.includes("cc")) return "bg-primary";
    return "bg-primary";
  };

  const todayLabel = new Date().toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });

  const sections = [
    {
      button: { label: "Create Franchise/User", link: "super-franchise/create-user" },
      cards: [{ title: "Franchise List", count: franchises.count || 0, link: "super-franchise/franchise-list" }],
    },
    {
      cards: [{ title: "Merchant List", count: merchants.count || 0, link: "super-franchise/list" }],
    },
    {
      cards: [
        {
          title: "POS Machine List",
          count: toNumber(pos_machines.active) + toNumber(pos_machines.inactive) || toNumber(rawData.total_pos_machines || 0),
          link: "super-franchise/stock-pos",
        },
        { title: "Active Machine", count: pos_machines.active || 0, link: "super-franchise/stock-pos" },
        { title: "D-Active Machine", count: pos_machines.inactive || 0, link: "super-franchise/stock-pos" },
      ],
    },
  ];

  const stats = [
    { title: "Today POS", amount: pos_transactions.total || 0 },
    { title: "Today POS Success", amount: pos_transactions.success || 0 },
    {
      title: "Today POS T0 / T+1",
      amount: (
        <div className="flex flex-col text-[13px] md:text-sm font-semibold space-y-1 mt-1 leading-tight text-gray-800">
          <div>T0: ₹{formatAmount(pos_transactions.t0_amount)}</div>
          <div>T+1: ₹{formatAmount(pos_transactions.t1_amount)}</div>
        </div>
      ),
    },
    { title: "Today CC BILLPAYMENT TXN", amount: ccBillPaymentTXN },
    { title: "Today CC BILLPAYMENT Success", amount: ccBillPaymentSuccess },
    { title: "Today CC BILLPAYMENT Failed", amount: ccBillPaymentFailed },
  ];

  return (
    <div className="bg-gray-100 min-h-screen w-full">
      {/* Mobile Dashboard View */}
      <div className="md:hidden space-y-3 pb-6">
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">Super Franchise Dashboard</p>
              <h2 className="mt-1 text-lg font-semibold text-gray-900">Daily Network Snapshot</h2>
              <p className="text-xs text-gray-500">{todayLabel}</p>
            </div>
            <div className="rounded-xl bg-primary/10 px-3 py-2 text-right">
              <p className="text-[10px] uppercase tracking-wide text-gray-500">Payout</p>
              <p className="text-sm font-semibold text-gray-900">INR {formatAmount(today_total_payout)}</p>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <div className="rounded-xl bg-gray-50 p-2">
              <p className="text-[10px] text-gray-500">Franchises</p>
              <p className="text-lg font-semibold text-gray-900">{formatCount(franchises.count || 0)}</p>
            </div>
            <div className="rounded-xl bg-gray-50 p-2">
              <p className="text-[10px] text-gray-500">Merchants</p>
              <p className="text-lg font-semibold text-gray-900">{formatCount(merchants.count || 0)}</p>
            </div>
            <div className="rounded-xl bg-gray-50 p-2">
              <p className="text-[10px] text-gray-500">Machines</p>
              <p className="text-lg font-semibold text-gray-900">
                {formatCount(toNumber(pos_machines.active) + toNumber(pos_machines.inactive))}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Link
            to="/super-franchise/create-user"
            className="flex items-center justify-between rounded-xl bg-primary p-3 text-xs font-semibold text-white shadow-sm"
          >
            <span>Create User</span>
            <FaArrowRight className="h-3 w-3" />
          </Link>
          <Link
            to="/super-franchise/stock-pos"
            className="flex items-center justify-between rounded-xl bg-gray-900 p-3 text-xs font-semibold text-white shadow-sm"
          >
            <span>Stock POS</span>
            <FaArrowRight className="h-3 w-3" />
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-3">
          <DashboardChartLauncher
            buttonClassName="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-primary/20 bg-primary px-3 py-3 text-sm font-semibold text-white shadow-sm transition active:scale-[0.99]"
          />
          <button
            onClick={() => navigate("/super-franchise/reports")}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gray-900 px-3 py-3 text-sm font-semibold text-white shadow-sm transition active:scale-[0.99]"
          >
            <FaHistory className="h-4 w-4" />
            <span>Reports & Logs</span>
          </button>
        </div>

        <div className="space-y-3 pt-2">
          {stats.map((item, index) => (
            <DataCard key={index} title={item.title} amount={item.amount} indicatorColor={getStatTone(item.title)} />
          ))}
        </div>
      </div>

      {/* Desktop Dashboard View */}
      <div className="hidden md:block space-y-6">
        <div className="grid grid-cols-3 gap-6">
          {sections.map((section, index) => (
            <div key={index} className="space-y-4">
              {section.button && (
                <button
                  onClick={() => navigate("/" + section.button.link)}
                  className="w-full bg-primary hover:bg-primary/90 text-white font-semibold py-2.5 px-4 rounded-lg shadow-sm transition flex items-center justify-center space-x-2 text-sm"
                >
                  <span>{section.button.label}</span>
                  <FaArrowRight className="text-xs" />
                </button>
              )}
              {section.cards.map((card, cIndex) => (
                <StatCard key={cIndex} title={card.title} count={card.count} link={card.link} />
              ))}
            </div>
          ))}
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">
              Network Analytics & Reports
            </h3>

            <div className="flex items-center space-x-3">
              <DashboardChartLauncher />
              <button
                onClick={() => navigate("/super-franchise/reports")}
                className="bg-gray-900 hover:bg-gray-800 text-white font-medium py-2 px-4 rounded-lg text-sm shadow-sm transition flex items-center space-x-2"
              >
                <FaHistory className="text-xs" />
                <span>Reports</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-6">
            {stats.map((item, index) => (
              <DataCard key={index} title={item.title} amount={item.amount} indicatorColor={getStatTone(item.title)} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
