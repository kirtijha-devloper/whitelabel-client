import React from "react";
import { useNavigate } from "react-router-dom";
import { isChildRole } from "../../utils/serviceDisplayNames";

const REPORT_TAB_CONFIG = [
  { key: "pos", label: "POS Transactions" },
  { key: "wallet", label: "Wallet Transactions" },
  { key: "all-transactions", label: "Transaction Reports" },
  { key: "commission", label: "Commission Report" },
  { key: "service-wise", label: "Service Wise Reports" },
  { key: "cc-bill", label: "CC Bill Payment" },
  { key: "ba-cc-bill", label: "BA CC Bill Payment" },
  { key: "cc-bill-3", label: "CC Bill 3" },
  { key: "payout", label: "Payout Report" },
];

const getTargetPath = (basePath, tabKey) => {
  const safeBase =
    basePath ||
    (typeof window !== "undefined" && window.location?.pathname?.startsWith("/super-admin")
      ? "/super-admin/reports"
      : "/admin/reports");
  if (tabKey === "pos" || tabKey === "wallet") {
    return `${safeBase}?tab=${tabKey}`;
  }

  if (tabKey === "all-transactions") {
    return `${safeBase}/transactions`;
  }

  if (tabKey === "commission") {
    return `${safeBase}/commission`;
  }

  if (tabKey === "service-wise") {
    return `${safeBase}/service-wise`;
  }

  if (tabKey === "payout") {
    return `${safeBase}/payout`;
  }

  if (tabKey === "cc-bill") {
    return `${safeBase}/cc-bill`;
  }

  if (tabKey === "ba-cc-bill") {
    return `${safeBase}/ba-cc-bill`;
  }

  if (tabKey === "cc-bill-3") {
    return `${safeBase}/cc-bill-3`;
  }

  return safeBase;
};

const ReportTabs = ({ basePath, activeTab, trailingAction = null, tabs = REPORT_TAB_CONFIG, currentUser }) => {
  const navigate = useNavigate();

  return (
    <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
      <div className="flex flex-wrap gap-3 md:flex-nowrap md:gap-4">
        {tabs.map((tab) => {
          if((tab.key === "cc-bill-3" || tab.key === "ba-cc-bill" || tab.key === "cc-bill" || tab.key === "payout" || tab.key === "pos" || tab.key === "wallet") && currentUser?.role === "super_admin") {
            return null; 
          }
          if((tab.key === "service-wise" || tab.key === "all-transactions" || tab.key === "commission") && currentUser?.role !== "super_admin" && currentUser?.role !== "admin") {
            return null; 
          }
          const isActive = activeTab === tab.key;

          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => navigate(getTargetPath(basePath, tab.key))}
              className={`w-[calc(50%-0.375rem)] rounded-md border px-3 py-2 font-medium transition md:w-auto md:px-4 ${
                isActive
                  ? "border-[#00D3CD] bg-[#00D3CD] text-white"
                  : "border-gray-300 bg-white text-gray-600 hover:border-[#00D3CD] hover:text-[#00D3CD]"
              }`}
            >
              {isChildRole(currentUser) && tab.key === "cc-bill"
                ? "CC Bill 1 Payment"
                : isChildRole(currentUser) && tab.key === "ba-cc-bill"
                ? "CC Bill 2 Payment"
                : tab.label}
            </button>
          );
        })}
      </div>
      {trailingAction ? <div className="w-full md:w-auto md:shrink-0">{trailingAction}</div> : null}
    </div>
  );
};

export default ReportTabs;
