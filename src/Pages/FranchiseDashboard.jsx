import React from "react";
import { FaArrowRight, FaHistory } from "react-icons/fa";
import { Link, useNavigate } from "react-router-dom";
import StatCard from "../components/StatCard";
import DataCard from "../components/DataCard";
import DashboardChartLauncher from "../components/DashboardChartLauncher";

const FranchiseDashboard = ({ dashboardData = {} }) => {
  const navigate = useNavigate();
  const data = dashboardData?.data ?? dashboardData ?? {};
  const { assigned_merchants = {}, pos_machines = {}, pos_transactions = {}, today_total_payout } = data;
  const ccBillPaymentTXN = data.ccBillPaymentTXN ?? 0;
  const ccBillPaymentSuccess = data.ccBillPaymentSuccess ?? 0;
  const ccBillPaymentFailed = data.ccBillPaymentFailed ?? 0;

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
  const machineTotal = toNumber(pos_machines.count ?? assignedToFranchiseCount + assignedToMerchantCount);

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
      button: { label: "Create Merchant", link: "franchise/create-user" },
      cards: [{ title: "Merchant List", count: assigned_merchants.count || 0, link: "franchise/list" }],
    },
    {
      cards: [
        { title: "POS Machine List", count: machineTotal, link: "franchise/stock-pos" },
        { title: "Assigned to Franchise", count: assignedToFranchiseCount, link: "franchise/stock-pos" },
        { title: "Assigned to Merchants", count: assignedToMerchantCount, link: "franchise/stock-pos" },
      ],
    },
  ];

  const transactionStats = [
    { title: "Today POS", amount: pos_transactions.total || 0 },
    { title: "Today POS Success", amount: pos_transactions.success || 0 },
    {
      title: "Today POS T0 / T+1",
      amount: (
        <div className="flex flex-col text-[13px] md:text-sm font-semibold space-y-1 mt-1 leading-tight text-gray-800">
          <div>T0: ₹{formatAmount(pos_transactions.t0_amount)}</div>
          <div>T+1: ₹{formatAmount(pos_transactions.t1_amount)}</div>
        </div>
      )
    },
  ];

  const ccBillPaymentStats = [
    { title: "Today CC Bill Payment Txn", amount: ccBillPaymentTXN },
    { title: "Today CC Bill Payment Success", amount: ccBillPaymentSuccess },
    { title: "Today CC Bill Payment Failed", amount: ccBillPaymentFailed },
  ];

  const stats = [...transactionStats, ...ccBillPaymentStats];

  const mobileQuickActions = [
    { label: "Create Merchant", link: "/franchise/create-user" },
    { label: "Merchant List", link: "/franchise/list" },
  ];

  const mobileEntityCards = [
    { section: "Merchant", title: "Merchant List", count: assigned_merchants.count || 0, link: "/franchise/list" },
    { section: "POS", title: "POS Machine List", count: machineTotal, link: "/franchise/stock-pos" },
  ];

  const mobileMachineCards = [
    { title: "POS Machine List", count: machineTotal, link: "/franchise/stock-pos" },
    { title: "Assigned to Franchise", count: assignedToFranchiseCount, link: "/franchise/stock-pos" },
    { title: "Assigned to Merchants", count: assignedToMerchantCount, link: "/franchise/stock-pos" },
  ];

  return (
    <div className="bg-gray-100 min-h-screen w-full">
      <div className="md:hidden space-y-3 pb-6">
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">Franchise Dashboard</p>
              <h2 className="mt-1 text-lg font-semibold text-gray-900">Daily Snapshot</h2>
              <p className="text-xs text-gray-500">{todayLabel}</p>
            </div>
            <div className="rounded-xl bg-primary/10 px-3 py-2 text-right">
              <p className="text-[10px] uppercase tracking-wide text-gray-500">Payout</p>
              <p className="text-sm font-semibold text-gray-900">INR {formatAmount(today_total_payout)}</p>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <div className="rounded-xl bg-gray-50 p-2">
              <p className="text-[10px] text-gray-500">Merchants</p>
              <p className="text-lg font-semibold text-gray-900">{formatCount(assigned_merchants.count || 0)}</p>
            </div>
            <div className="rounded-xl bg-gray-50 p-2">
              <p className="text-[10px] text-gray-500">Machines</p>
              <p className="text-lg font-semibold text-gray-900">{formatCount(machineTotal)}</p>
            </div>
            <div className="rounded-xl bg-gray-50 p-2">
              <p className="text-[10px] text-gray-500">Assigned to Franchise</p>
              <p className="text-lg font-semibold text-gray-900">{formatCount(assignedToFranchiseCount)}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {mobileQuickActions.map((action) => (
            <Link
              key={action.label}
              to={action.link}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-3 py-3 text-sm font-semibold text-white shadow-sm transition active:scale-[0.99]"
            >
              {action.label}
              <FaArrowRight className="text-xs" />
            </Link>
          ))}
          <DashboardChartLauncher
            buttonClassName="col-span-2 inline-flex items-center justify-center gap-2 rounded-xl border border-primary/20 bg-primary px-3 py-3 text-sm font-semibold text-white shadow-sm transition active:scale-[0.99]"
          />
          <button
            onClick={() => navigate("/franchise/total-payouts")}
            className="col-span-2 inline-flex items-center justify-center gap-2 rounded-xl bg-gray-900 px-3 py-3 text-sm font-semibold text-white shadow-sm transition active:scale-[0.99]"
          >
            <FaHistory className="text-xs" />
            Payout History
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {mobileEntityCards.map((card) => (
            <Link key={card.section} to={card.link} className="rounded-2xl border border-gray-200 bg-white p-3 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{card.section}</p>
              <div className="mt-2 flex items-center justify-between rounded-xl bg-gray-50 px-3 py-2.5">
                <span className="text-sm font-medium text-gray-700">{card.title}</span>
                <span className="rounded-full bg-gray-900 px-2.5 py-1 text-xs font-semibold text-white">
                  {formatCount(card.count)}
                </span>
              </div>
            </Link>
          ))}
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-3 shadow-sm">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">POS Machines</p>
          <div className="space-y-2">
            {mobileMachineCards.map((card) => (
              <Link
                key={card.title}
                to={card.link}
                className="flex items-center justify-between rounded-xl bg-gray-50 px-3 py-2.5 transition active:scale-[0.99]"
              >
                <span className="text-sm font-medium text-gray-700">{card.title}</span>
                <span className="rounded-full bg-gray-900 px-2.5 py-1 text-xs font-semibold text-white">
                  {formatCount(card.count)}
                </span>
              </Link>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-900">Today Activity</p>
            <p className="text-xs text-gray-500">{stats.length} metrics</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {stats.map((item, index) => (
              <div key={index} className="rounded-2xl border border-gray-200 bg-white p-3 shadow-sm">
                <p className="min-h-[2.4rem] text-[11px] font-medium leading-4 text-gray-500">{item.title}</p>
                {typeof item.amount === 'number' ? (
                  <p className="mt-1 text-base font-semibold text-gray-900">INR {formatAmount(item.amount)}</p>
                ) : (
                  <div className="mt-1">{item.amount}</div>
                )}
                <div className={`mt-2 h-1 rounded-full ${getStatTone(item.title)}`} />
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-primary/30 bg-primary/10 p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-700">Today Payout</p>
          <p className="mt-1 text-2xl font-semibold text-gray-900">INR {formatAmount(today_total_payout)}</p>
          <button
            className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gray-900 py-2.5 text-sm font-medium text-white"
            onClick={() => navigate("/franchise/total-payouts")}
          >
            <FaHistory />
            View Payout History
          </button>
        </div>
      </div>

      <div className="hidden md:block p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {sections.map((section, index) => (
            <div key={index} className="flex flex-col space-y-4">
              {section.button && (
                <Link
                  to={`/${section.button.link}`}
                  className="bg-primary text-white py-3 px-6 rounded-lg shadow-md hover:bg-indigo-700 transition duration-300 text-center font-semibold"
                >
                  {section.button.label}
                </Link>
              )}
              {section.cards.map((card, cardIndex) => (
                <StatCard
                  key={cardIndex}
                  title={card.title}
                  count={card.count}
                  link={card.link}
                  className="bg-white hover:bg-gray-50 transition"
                />
              ))}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {transactionStats.map((item, index) => (
            <DataCard
              key={index}
              title={item.title}
              amount={item.amount}
              currency="\u20B9"
              className="bg-indigo-50 text-indigo-900 hover:bg-indigo-100"
            />
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {ccBillPaymentStats.map((item, index) => (
            <DataCard
              key={index}
              title={item.title}
              amount={item.amount}
              currency="\u20B9"
              className="bg-yellow-50 text-yellow-900 hover:bg-yellow-100"
            />
          ))}
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-6 bg-white p-6 rounded-lg shadow-md">
          <div className="flex-1">
            <p className="text-sm text-gray-600">Today Payout</p>
            <p className="text-3xl font-bold text-green-600">{"\u20B9"}{formatAmount(today_total_payout)}</p>
          </div>
          <DashboardChartLauncher
            buttonClassName="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-2 text-white shadow-md transition duration-300 hover:opacity-90"
          />
          <Link
            to="/franchise/total-payouts"
            className="bg-purple-500 text-white py-2 px-6 rounded-lg shadow-md hover:bg-purple-600 transition duration-300 flex items-center gap-2"
          >
            <FaHistory />
            View History
          </Link>
        </div>
      </div>
    </div>
  );
};

export default FranchiseDashboard;
