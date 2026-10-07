import React from "react";
import {
  FaChartLine,
  FaCheckCircle,
  FaClock,
  FaCoins,
  FaExchangeAlt,
  FaTimesCircle,
  FaWallet,
} from "react-icons/fa";

const cardStyles = {
  business: "bg-gradient-to-br from-teal-500 to-cyan-500",
  total: "bg-blue-600",
  transactions: "bg-blue-700",
  commission: "bg-green-500",
  todayCommission: "bg-amber-700",
  pending: "bg-amber-700",
  failed: "bg-red-700",
  successful: "bg-emerald-700",
};

const cardIcons = {
  business: FaChartLine,
  total: FaWallet,
  transactions: FaExchangeAlt,
  commission: FaCoins,
  todayCommission: FaCoins,
  pending: FaClock,
  failed: FaTimesCircle,
  successful: FaCheckCircle,
};

const AdminStatCard = ({ title, value, type, subtitle }) => {
  const Icon = cardIcons[type] || FaChartLine;

  return (
    <div
      className={`group flex min-h-[145px] flex-col justify-between rounded-2xl p-5 text-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${
        cardStyles[type] || "bg-blue-600"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold leading-5">{title}</p>
          <h3 className="mt-2 break-words text-3xl font-bold leading-tight">
            {value}
          </h3>
        </div>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15 text-white">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
      </div>
      {subtitle && <p className="mt-4 text-sm leading-5 text-white/90">{subtitle}</p>}
    </div>
  );
};

export default AdminStatCard;