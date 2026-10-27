import React from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  CreditCard,
  CheckCircle2,
  XCircle,
  History,
  Wallet,
  TrendingUp,
  Smartphone,
  ChevronRight,
  BookText,
  ReceiptIndianRupee,
  FileBarChart,
  HandCoins,
  Settings,
  ArrowRight,
  Layers,
  Sparkles,
} from "lucide-react";
import { normalizeServiceFlags } from "../../utils/serviceFlags";
import DashboardChartLauncher from "../../components/DashboardChartLauncher";

const MerchantDashboard = ({ dashboardData, currentUser }) => {
  const navigate = useNavigate();
  const data = (dashboardData && typeof dashboardData === "object" && "data" in dashboardData ? dashboardData.data : dashboardData) || {};
  const pos_machines = data?.pos_machines || {};
  const pos_transactions = data?.pos_transactions || {};
  const ccBillPaymentTXN = data?.ccBillPaymentTXN ?? 0;
  const ccBillPaymentSuccess = data?.ccBillPaymentSuccess ?? 0;
  const ccBillPaymentFailed = data?.ccBillPaymentFailed ?? 0;
  const today_total_payout = data?.today_total_payout ?? 0;

  const posMachineCount = pos_machines?.count ?? pos_machines?.total ?? 0;
  const posTotal = pos_transactions?.total ?? 0;
  const posSuccess = pos_transactions?.success ?? 0;
  const posFail = pos_transactions?.fail ?? 0;

  const serviceFlags = normalizeServiceFlags(currentUser?.service_flags, true);

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

  // Summary Metrics Cards (Responsive 2-col on mobile, 4-col on desktop)
  const summaryCards = [
    {
      title: "POS Machines",
      value: formatCount(posMachineCount),
      isCurrency: false,
      subtitle: "Active terminal assigned",
      icon: Smartphone,
      iconBox: "bg-[#00D3CD]/10 text-[#00a8a3] border border-[#00D3CD]/20",
      cardClass: "bg-white border-gray-100 hover:border-[#00D3CD]/40",
      isHero: false,
    },
    {
      title: "Today's Transactions",
      value: `₹${formatAmount(posTotal)}`,
      isCurrency: true,
      subtitle: "Total transaction volume today",
      icon: TrendingUp,
      iconBox: "bg-white/20 text-white",
      cardClass: "bg-gradient-to-br from-[#00D3CD] to-[#00b8b3] text-white shadow-sm border-[#00D3CD]/30",
      isHero: true,
    },
    {
      title: "Successful",
      value: `₹${formatAmount(posSuccess)}`,
      isCurrency: true,
      subtitle: "Completed & captured volume",
      badge: "Settled",
      badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
      icon: CheckCircle2,
      iconBox: "bg-emerald-50 text-emerald-600 border border-emerald-100",
      cardClass: "bg-white border-gray-100 hover:border-emerald-200",
      isHero: false,
    },
    {
      title: "Failed",
      value: `₹${formatAmount(posFail)}`,
      isCurrency: true,
      subtitle: "Declined or rejected requests",
      badge: "Failed",
      badgeClass: "bg-rose-50 text-rose-700 border-rose-200",
      icon: XCircle,
      iconBox: "bg-rose-50 text-rose-600 border border-rose-100",
      cardClass: "bg-white border-gray-100 hover:border-rose-200",
      isHero: false,
    },
  ];

  // Quick Action Services (One-tap navigation on all screens)
  const quickServices = [
    {
      label: "CC Bill 1",
      to: "/merchant/cc-bill-pay",
      icon: CreditCard,
      disabled: !serviceFlags.cc_bill_pay,
    },
    {
      label: "CC Bill 2",
      to: "/merchant/ba-cc-bill-pay",
      icon: CreditCard,
      disabled: !serviceFlags.ba_cc_bill_pay,
    },
    {
      label: "Payout Hub",
      to: "/merchant/payout-hub",
      icon: HandCoins,
      disabled: false,
    },
    {
      label: "Ledger",
      to: "/merchant/ledger",
      icon: BookText,
      disabled: false,
    },
    {
      label: "Charges",
      to: "/merchant/charges",
      icon: ReceiptIndianRupee,
      disabled: false,
    },
    {
      label: "Reports",
      to: "/merchant/reports",
      icon: FileBarChart,
      disabled: false,
    },
    {
      label: "Settings",
      to: "/merchant/setting",
      icon: Settings,
      disabled: false,
    },
  ];

  // CC Payment Breakdown Cards
  const ccPaymentCards = [
    {
      label: "Today CC Billpayment TXN",
      value: ccBillPaymentTXN,
      subtitle: "Total credit card payments initiated",
      icon: CreditCard,
      iconBox: "bg-sky-50 text-sky-600 border border-sky-100",
    },
    {
      label: "Today CC Success",
      value: ccBillPaymentSuccess,
      subtitle: "Successfully captured without biller errors",
      badge: "Success",
      badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
      icon: CheckCircle2,
      iconBox: "bg-emerald-50 text-emerald-600 border border-emerald-100",
    },
    {
      label: "Today CC Failed",
      value: ccBillPaymentFailed,
      subtitle: "Declined or rejected bill requests",
      badge: "Failed",
      badgeClass: "bg-rose-50 text-rose-700 border-rose-200",
      icon: XCircle,
      iconBox: "bg-rose-50 text-rose-600 border border-rose-100",
    },
  ];

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* ================= SECTION 1: TOP SUMMARY STATS ================= */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {summaryCards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <div
              key={idx}
              className={`group flex min-h-[125px] sm:min-h-[145px] flex-col justify-between rounded-2xl p-3.5 sm:p-5 border shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${card.cardClass}`}
            >
              <div className="flex items-start justify-between gap-2 sm:gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <p
                      className={`text-[11px] sm:text-xs font-semibold uppercase tracking-wider truncate ${
                        card.isHero ? "text-white/90" : "text-gray-500"
                      }`}
                    >
                      {card.title}
                    </p>
                    {card.badge && (
                      <span
                        className={`px-1.5 py-0.2 rounded text-[9px] sm:text-[10px] font-bold uppercase border ${card.badgeClass}`}
                      >
                        {card.badge}
                      </span>
                    )}
                  </div>
                  <h3
                    className={`mt-1.5 sm:mt-2 text-xl sm:text-2xl lg:text-3xl font-extrabold tracking-tight truncate ${
                      card.isHero ? "text-white" : "text-gray-900"
                    }`}
                  >
                    {card.value}
                  </h3>
                </div>

                <div
                  className={`flex h-9 w-9 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-xl transition-transform group-hover:scale-105 ${card.iconBox}`}
                >
                  <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
                </div>
              </div>

              <p
                className={`mt-2 sm:mt-3 text-[11px] sm:text-xs truncate ${
                  card.isHero
                    ? "text-white/80"
                    : card.badge === "Settled"
                    ? "text-emerald-600 font-medium"
                    : card.badge === "Failed"
                    ? "text-rose-600 font-medium"
                    : "text-gray-400"
                }`}
              >
                {card.subtitle}
              </p>
            </div>
          );
        })}
      </div>

      {/* ================= SECTION 2: QUICK ACTIONS STRIP ================= */}
      <div className="rounded-2xl border border-gray-100 bg-white p-3.5 sm:p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3 px-1">
          <p className="text-xs font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-[#00a8a3]" />
            Quick Services
          </p>
          <span className="text-[11px] font-medium text-gray-400 hidden sm:inline-block">
            One-tap service shortcuts
          </span>
        </div>

        <div className="grid grid-cols-4 sm:grid-cols-4 md:grid-cols-7 gap-2 sm:gap-2.5">
          {quickServices.map((service, index) => {
            const Icon = service.icon;
            const content = (
              <div
                className={`group flex flex-col items-center justify-center gap-1.5 rounded-xl p-2 sm:p-2.5 text-center transition-all duration-150 ${
                  service.disabled
                    ? "opacity-40 cursor-not-allowed bg-gray-50"
                    : "bg-gray-50/80 hover:bg-[#00D3CD]/10 hover:text-[#008b87] active:scale-95 cursor-pointer"
                }`}
              >
                <div
                  className={`flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-xl transition-colors ${
                    service.disabled
                      ? "bg-gray-200 text-gray-400"
                      : "bg-[#00D3CD]/10 text-[#00a8a3] group-hover:bg-[#00D3CD] group-hover:text-white"
                  }`}
                >
                  <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
                </div>
                <span className="text-[10px] sm:text-xs font-semibold text-gray-700 truncate w-full group-hover:text-[#008b87]">
                  {service.label}
                </span>
              </div>
            );

            if (service.disabled) {
              return (
                <div key={index} title="Service is temporarily unavailable">
                  {content}
                </div>
              );
            }

            return (
              <Link key={index} to={service.to}>
                {content}
              </Link>
            );
          })}
        </div>
      </div>

      {/* ================= SECTION 3: CREDIT CARD BILL PAYMENTS ================= */}
      <div className="rounded-2xl border border-gray-100 bg-white p-4 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 pb-4 sm:pb-5 border-b border-gray-100">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-gray-900 flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-[#00a8a3]" />
              Credit Card Bill Payments
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Process instant credit card bill payments and track daily settlement statuses
            </p>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              to="/merchant/cc-bill-pay"
              className="inline-flex h-9 sm:h-10 items-center justify-center rounded-xl bg-gradient-to-r from-[#00D3CD] to-[#00b8b3] px-3.5 sm:px-4 text-xs font-semibold text-white shadow-sm transition hover:opacity-95 active:scale-[0.98]"
            >
              CC Bill Pay
            </Link>
            <Link
              to="/merchant/ba-cc-bill-pay"
              className="inline-flex h-9 sm:h-10 items-center justify-center rounded-xl border border-gray-200 bg-white px-3.5 sm:px-4 text-xs font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50 hover:border-gray-300 active:scale-[0.98]"
            >
              BA CC Bill
            </Link>
          </div>
        </div>

        <div className="mt-4 sm:mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3.5 sm:gap-4">
          {ccPaymentCards.map((item, index) => {
            const Icon = item.icon;
            return (
              <div
                key={index}
                className="group flex min-h-[115px] sm:min-h-[130px] flex-col justify-between rounded-xl bg-gray-50/70 p-3.5 sm:p-4 border border-gray-100 transition-all duration-200 hover:bg-white hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-2 sm:gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-gray-500 truncate">
                        {item.label}
                      </p>
                      {item.badge && (
                        <span
                          className={`px-1.5 py-0.2 rounded text-[9px] sm:text-[10px] font-bold uppercase border ${item.badgeClass}`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </div>
                    <h4 className="mt-1.5 sm:mt-2 text-xl sm:text-2xl font-extrabold tracking-tight text-gray-900 truncate">
                      ₹{formatAmount(item.value)}
                    </h4>
                  </div>

                  <div
                    className={`flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl transition-transform group-hover:scale-105 ${item.iconBox}`}
                  >
                    <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
                  </div>
                </div>

                <p className="mt-2 sm:mt-3 text-[11px] sm:text-xs text-gray-400 truncate">
                  {item.subtitle}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* ================= SECTION 4: TODAY'S TOTAL PAYOUT ================= */}
      <div className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-6 lg:p-7 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4 sm:gap-6">
        <div className="flex items-center gap-3.5 sm:gap-4">
          <div className="flex h-12 w-12 sm:h-14 sm:w-14 shrink-0 items-center justify-center rounded-2xl bg-[#00D3CD]/10 text-[#00a8a3] border border-[#00D3CD]/20">
            <Wallet className="h-6 w-6 sm:h-7 sm:w-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-gray-400">
                Today's Total Payout
              </span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[9px] sm:text-[10px] font-bold">
                Wallet Settled
              </span>
            </div>
            <p className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-gray-900 mt-0.5 sm:mt-1">
              ₹{formatAmount(today_total_payout)}
            </p>
            <p className="text-[11px] sm:text-xs text-gray-500 mt-0.5 sm:mt-1">
              Total settled volume credited to your settlement account today.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
          <DashboardChartLauncher
            label="View 5-Day Charts"
            buttonClassName="inline-flex h-10 sm:h-11 items-center gap-2 px-4 sm:px-5 rounded-xl border border-gray-200 bg-white text-gray-800 text-xs sm:text-sm font-semibold shadow-sm hover:bg-gray-50 hover:border-gray-300 transition active:scale-[0.98]"
          />
          <button
            onClick={() => navigate("/merchant/total-payouts")}
            className="inline-flex h-10 sm:h-11 items-center gap-2 px-4 sm:px-5 rounded-xl bg-gray-900 hover:bg-gray-800 text-white text-xs sm:text-sm font-semibold shadow-sm transition active:scale-[0.98]"
          >
            <History className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-400" />
            Payout History
          </button>
        </div>
      </div>
    </div>
  );
};

export default MerchantDashboard;
