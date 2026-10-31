import React, { useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { isChildRole } from "../../utils/serviceDisplayNames";

const REPORT_TAB_CONFIG = [
  { key: "pos", label: "POS Transactions" },
  { key: "wallet", label: "Wallet Transactions" },
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

  // if (tabKey === "all-transactions") {
  //   return `${safeBase}/transactions`;
  // }

  // if (tabKey === "commission") {
  //   return `${safeBase}/commission`;
  // }

  // if (tabKey === "service-wise") {
  //   return `${safeBase}/service-wise`;
  // }

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
  const activeTabRef = useRef(null);

  useEffect(() => {
    if (activeTabRef.current) {
      activeTabRef.current.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "nearest",
      });
    }
  }, [activeTab]);

  return (
    <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="min-w-0 flex-1 overflow-x-auto py-1.5 pr-3 sm:pr-4 report-tabs-scrollbar">
        <div className="flex items-center gap-2 sm:gap-2.5">
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
                ref={isActive ? activeTabRef : null}
                type="button"
                onClick={() => navigate(getTargetPath(basePath, tab.key))}
                className={`h-10 shrink-0 whitespace-nowrap rounded-lg border px-4 text-sm font-medium transition-all inline-flex items-center justify-center ${
                  isActive
                    ? "border-primary bg-primary text-white shadow-sm"
                    : "border-gray-200 bg-white text-gray-700 hover:border-primary hover:text-primary hover:bg-gray-50/50"
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
      </div>
      {trailingAction ? (
        <div className="shrink-0 flex items-center py-1.5">
          {trailingAction}
        </div>
      ) : null}
    </div>
  );
};

export default ReportTabs;
