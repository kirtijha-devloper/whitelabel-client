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

const cardConfig = {
  business: {
    isHero: true,
    cardClass:
      "bg-gradient-to-br from-[#00D3CD] to-[#00b8b3] text-white border border-[#00D3CD]/30 shadow-sm",
    iconBox: "bg-white/20 text-white",
    titleClass: "text-white/90",
    valueClass: "text-white",
    subClass: "text-white/80",
  },
  total: {
    isHero: false,
    cardClass: "bg-white text-gray-900 border border-gray-100 shadow-sm hover:border-gray-200",
    iconBox: "bg-[#0284c7]/10 text-[#0284c7] border border-[#0284c7]/20",
    titleClass: "text-gray-500",
    valueClass: "text-gray-900",
    subClass: "text-gray-400",
  },
  transactions: {
    isHero: false,
    cardClass: "bg-white text-gray-900 border border-gray-100 shadow-sm hover:border-gray-200",
    iconBox: "bg-indigo-50 text-indigo-600 border border-indigo-100",
    titleClass: "text-gray-500",
    valueClass: "text-gray-900",
    subClass: "text-gray-400",
  },
  commission: {
    isHero: false,
    cardClass: "bg-white text-gray-900 border border-gray-100 shadow-sm hover:border-gray-200",
    iconBox: "bg-emerald-50 text-emerald-600 border border-emerald-100",
    titleClass: "text-gray-500",
    valueClass: "text-gray-900",
    subClass: "text-gray-400",
  },
  todayCommission: {
    isHero: false,
    cardClass: "bg-white text-gray-900 border border-gray-100 shadow-sm hover:border-gray-200",
    iconBox: "bg-[#00D3CD]/10 text-[#00a8a3] border border-[#00D3CD]/20",
    titleClass: "text-gray-500",
    valueClass: "text-gray-900",
    subClass: "text-gray-400",
  },
  pending: {
    isHero: false,
    cardClass: "bg-white text-gray-900 border border-gray-100 shadow-sm hover:border-amber-200",
    iconBox: "bg-amber-50 text-amber-600 border border-amber-200",
    titleClass: "text-gray-500",
    valueClass: "text-gray-900",
    subClass: "text-amber-600 font-medium",
  },
  failed: {
    isHero: false,
    cardClass: "bg-white text-gray-900 border border-gray-100 shadow-sm hover:border-rose-200",
    iconBox: "bg-rose-50 text-rose-600 border border-rose-200",
    titleClass: "text-gray-500",
    valueClass: "text-gray-900",
    subClass: "text-rose-600 font-medium",
  },
  successful: {
    isHero: false,
    cardClass: "bg-white text-gray-900 border border-gray-100 shadow-sm hover:border-emerald-200",
    iconBox: "bg-emerald-50 text-emerald-600 border border-emerald-200",
    titleClass: "text-gray-500",
    valueClass: "text-gray-900",
    subClass: "text-emerald-600 font-medium",
  },
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
  const config = cardConfig[type] || cardConfig.total;

  return (
    <div
      className={`group flex min-h-[145px] flex-col justify-between rounded-2xl p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${config.cardClass}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p
            className={`text-xs font-semibold uppercase tracking-wider ${config.titleClass}`}
          >
            {title}
          </p>
          <h3
            className={`mt-2 break-words text-2xl sm:text-3xl font-extrabold leading-tight tracking-tight ${config.valueClass}`}
          >
            {value}
          </h3>
        </div>
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-transform group-hover:scale-105 ${config.iconBox}`}
        >
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
      </div>
      {subtitle && (
        <p className={`mt-3 text-xs leading-5 ${config.subClass}`}>
          {subtitle}
        </p>
      )}
    </div>
  );
};

export default AdminStatCard;