import { useState } from "react";
import { Link } from "react-router-dom";
import {
  CreditCard, CheckCircle, XCircle, History,
  Eye, EyeOff, FileText, MoreHorizontal, Wallet, MessageSquareWarning, Settings,
  ChevronRight, ChevronDown, Megaphone, Star, HandCoins, BookText, ReceiptIndianRupee, FileBarChart,
} from "lucide-react";
import { normalizeServiceFlags } from "../../utils/serviceFlags";

const MerchantDashboard = ({ dashboardData, currentUser }) => {
  const data = dashboardData?.data ?? dashboardData ?? {};
  const {
    pos_machines = {},
    pos_transactions = {},
    ccBillPaymentTXN = 0,
    ccBillPaymentSuccess = 0,
    ccBillPaymentFailed = 0,
    today_total_payout,
  } = data;

  const [showCCDetails, setShowCCDetails] = useState(false);
  const [showUpdates, setShowUpdates] = useState(window.innerWidth > 768);
  const [showMoreActions, setShowMoreActions] = useState(false);
  const serviceFlags = normalizeServiceFlags(currentUser?.service_flags, true);

  const ccPaymentCards = [
    { label: "CC Bill Payment TXN", value: ccBillPaymentTXN, featured: true },
    { label: "CC Bill Payment Success", value: ccBillPaymentSuccess },
    { label: "CC Bill Payment Failed", value: ccBillPaymentFailed },
  ];

  const latestUpdates = [
    { text: "System maintenance scheduled for next week...", time: "2h ago", icon: <Megaphone className="h-4 w-4 text-[#00D3CD]" /> },
    { text: "New features coming soon...", time: "1d ago", icon: <Star className="h-4 w-4 text-[#00D3CD]" /> },
  ];

  return (
    <div>

      {/* ══════════════════════════════
          MOBILE ONLY  (hidden on md+)
      ══════════════════════════════ */}
      <div className="md:hidden space-y-3">

        {/* Quick Overview */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">Quick Overview</h2>

          </div>
          <div className="grid grid-cols-2 gap-2 font-medium" label="center ">
            <MobileOverviewCard
              title="POS Machines"
              value={pos_machines.count || 0}
              icon={<CreditCard className="h-8 w-8 text-indigo-400" />}
            />
            <MobileOverviewCard
              title="Today's Transactions"
              value={pos_transactions.total || 0}
              icon={<FileText className="h-8 w-8 text-purple-400" />}
            />
            <MobileOverviewCard
              title="Successful"
              value={pos_transactions.success || 0}
              icon={<CheckCircle className="h-8 w-8 text-green-500" />}
              valueColor="text-green-600"
            />
            <MobileOverviewCard
              title="Failed"
              value={pos_transactions.fail || 0}
              icon={<XCircle className="h-8 w-8 text-red-400" />}
              valueColor="text-red-500"
            />
          </div>
        </div>

        {/* Quick Actions */}
        <div className="rounded-2xl bg-white p-2 shadow-sm border border-gray-100">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">Quick Actions</h2>
            <button
              type="button"
              onClick={() => setShowMoreActions((prev) => !prev)}
              className="p-2 rounded-full hover:bg-gray-100"
              aria-label={showMoreActions ? "Hide more actions" : "Show more actions"}
            >
              <ChevronDown
                className={`h-5 w-5 text-gray-500 transition-transform ${showMoreActions ? "rotate-180" : ""
                  }`}
              />
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2" label="center">
            <QuickAction
              to="/merchant/cc-bill-pay"
              label="CC Bill Pay"
              icon={<CreditCard className="h-6 w-6 text-[#00D3CD]" />}
              disabled={!serviceFlags.cc_bill_pay}
            />
            <QuickAction
              to="/merchant/ba-cc-bill-pay"
              label="BA CC Bill"
              icon={<CreditCard className="h-6 w-6 text-[#00D3CD]" />}
              disabled={!serviceFlags.ba_cc_bill_pay}
            />
            {/*
            <QuickAction
              onClick={() => setShowCCDetails((p) => !p)}
              label="CC Details"
              icon={<FileText className="h-6 w-6 text-[#00D3CD]" />}
            /> */}
            <QuickAction
              to={"/merchant/vimo-payout"}
              onClick={() => { }}
              label="Payout-V"
              icon={<HandCoins className="h-6 w-6 text-[#00D3CD]" />}
              disabled={!serviceFlags.vimo_payout}
            />
          </div>

          {showMoreActions && (
            <div className="mt-3 grid grid-cols-3 gap-2 border-t border-gray-100 pt-3" label="center">
              <QuickAction
                to={"/merchant/ledger"}
                onClick={() => { }}
                label="Ledger"
                icon={<BookText className="h-6 w-6 text-[#00D3CD]" />}
              />
              <QuickAction
                to={"/merchant/charges"}
                onClick={() => { }}
                label="Charges"
                icon={<ReceiptIndianRupee className="h-6 w-6 text-[#00D3CD]" />}
              />

              <QuickAction
                to={"/merchant/reports"}
                onClick={() => { }}
                label="Reports"
                icon={<FileBarChart className="h-6 w-6 text-[#00D3CD]" />}
              />

              <QuickAction
                to={"/merchant/branchx-payout"}
                onClick={() => { }}
                label="Payout-X"
                icon={<HandCoins className="h-6 w-6 text-[#00D3CD]" />}
                disabled={!serviceFlags.branchx_payout}
              />
              <QuickAction
                to={"/merchant/sevenpay-payout"}
                onClick={() => { }}
                label="Payout-S"
                icon={<HandCoins className="h-6 w-6 text-[#00D3CD]" />}
                disabled={!serviceFlags.sevenpay_payout}
              />
              <QuickAction
                to={"/merchant/mx-payout"}
                onClick={() => { }}
                label="Payout-M-X"
                icon={<HandCoins className="h-6 w-6 text-[#00D3CD]" />}
                disabled={!serviceFlags.mx_payout}
              />
              <QuickAction
                to={"/merchant/ndia5-payout"}
                onClick={() => { }}
                label="Payout-N"
                icon={<HandCoins className="h-6 w-6 text-[#00D3CD]" />}
                disabled={!serviceFlags.ndia5_payout}
              />
              {/* <QuickAction
                to={"/merchant/complaint-box"}
                onClick={() => { }}
                label="Complaint Box"
                icon={<MessageSquareWarning className="h-6 w-6 text-[#00D3CD]" />}
              /> */}
              <QuickAction
                to={"/merchant/setting"}
                onClick={() => { }}
                label="Settings"
                icon={<Settings className="h-6 w-6 text-[#00D3CD]" />}
              />

            </div>
          )}

          {/* CC Details panel */}
          {showCCDetails && (
            <div className="mt-4 rounded-xl border border-[#00D3CD]/15 bg-[#00D3CD]/5 p-3" style={{ fontFamily: "Inter, sans-serif" }}>
              <h3 className="mb-2 text-sm font-semibold text-gray-900">CC Bill Details</h3>
              <div className="grid grid-cols-3 gap-2">
                {ccPaymentCards.map((item, i) => (
                  <div key={i} className="rounded-xl bg-white p-3 shadow-sm" style={{ fontFamily: "Inter, sans-serif" }}>
                    <p className="text-xs leading-4 text-gray-500">{item.label}</p>
                    <p className="mt-1 text-base font-semibold text-gray-900">₹{item.value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Today's Payout */}
        <div className="rounded-2xl bg-white p-4 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#00D3CD]/10">
                <Wallet className="h-5 w-5 text-[#00D3CD]" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Today's Payout</p>
                <p className="text-xl font-bold text-gray-900">₹{today_total_payout || 0}</p>
              </div>
            </div>
            {/* <button className="flex items-center gap-1 rounded-xl bg-[#00D3CD]/10 px-3 py-2 text-xs font-medium text-[#00D3CD]">
              View History <ChevronRight className="h-3 w-3" />
            </button> */}
          </div>
        </div>

      </div>

      {/* ══════════════════════════════
          DESKTOP ONLY  (hidden on mobile)
      ══════════════════════════════ */}
      <div className="hidden md:block">

        {/* Top Summary Cards */}
        <div className="mb-4 grid grid-cols-2 gap-3 sm:mb-6 lg:grid-cols-4">
          <SummaryCard
            title="POS Machines"
            value={pos_machines.count || 0}
            icon={<CreditCard className="w-6 h-6 text-[#00D3CD]" />}
            borderColor="border-[#00D3CD]"
            bgColor="bg-[#00D3CD]/10"
          />
          <SummaryCard
            title="Today's Transactions"
            value={pos_transactions.total || 0}
            icon={<CreditCard className="w-6 h-6 text-[#00D3CD]" />}
            borderColor="border-[#00D3CD]"
            bgColor="bg-[#00D3CD]/10"
          />
          <SummaryCard
            title="Successful Transactions"
            value={pos_transactions.success || 0}
            icon={<CheckCircle className="w-6 h-6 text-green-500" />}
            borderColor="border-green-500"
            bgColor="bg-green-50"
          />
          <SummaryCard
            title="Failed Transactions"
            value={pos_transactions.fail || 0}
            icon={<XCircle className="w-6 h-6 text-red-500" />}
            borderColor="border-red-500"
            bgColor="bg-red-50"
          />
        </div>

        <div className="flex flex-col gap-4 md:flex-row md:items-start">
          <div className="flex-1 md:w-3/4">
            <div className="mb-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:mb-6 sm:p-5 md:p-6">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <Link
                  to="/merchant/cc-bill-pay"
                  className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-[#00D3CD] px-3 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#00b8b3]"
                >
                  CC Bill Pay
                </Link>
                <button
                  type="button"
                  onClick={() => setShowCCDetails((prev) => !prev)}
                  className={`col-span-2 inline-flex min-h-[44px] items-center justify-center rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors sm:col-span-1 ${showCCDetails
                    ? "bg-[#00D3CD] text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                >
                  CC Details
                </button>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 sm:mt-5 md:mt-6 md:grid-cols-3">
                {ccPaymentCards.map((item, index) => (
                  <div
                    key={index}
                    className={`rounded-xl bg-slate-50 p-4 ${item.featured ? "col-span-2 md:col-span-1" : ""}`}
                  >
                    <p className="text-sm leading-5 text-gray-500">{item.label}</p>
                    <p className="mt-2 text-xl font-semibold text-gray-900">₹{item.value}</p>
                  </div>
                ))}
              </div>

              {showCCDetails && (
                <div className="mt-4 rounded-xl border border-[#00D3CD]/15 bg-[#00D3CD]/5 p-4 md:p-6">
                  <h3 className="mb-2 text-base font-semibold text-gray-900 sm:mb-3 sm:text-lg">
                    Add New CC Card
                  </h3>
                  <p className="text-gray-500">Form will be implemented here...</p>
                </div>
              )}
            </div>

            {/* Payout Box */}
            <div className="mb-4 sm:mb-6">
              <div className="flex-1 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:p-5 md:p-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Today's Payout</p>
                    <p className="mt-1 text-3xl font-bold text-gray-900">₹{today_total_payout || 0}</p>
                  </div>
                  <button className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#00D3CD]/10 px-4 py-2.5 text-sm font-medium text-[#00D3CD] transition-colors hover:bg-[#00D3CD]/20 sm:w-auto">
                    <History className="w-4 h-4" />
                    View History
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Latest Updates */}
          <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:p-5 md:w-[320px] md:p-6 lg:w-[340px]">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Latest Updates</h2>
                <p className="text-xs text-gray-500">Stay on top of what changed recently</p>
              </div>
              <button
                type="button"
                onClick={() => setShowUpdates((prev) => !prev)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-gray-600 transition-colors hover:bg-slate-200"
                aria-label={showUpdates ? "Hide updates" : "Show updates"}
              >
                {showUpdates ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {showUpdates ? (
              <div className="space-y-3">
                {latestUpdates.map((item, index) => (
                  <div key={index} className="rounded-xl bg-slate-50 p-4">
                    <p className="text-sm leading-6 text-gray-700">{item.text}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-gray-200 bg-slate-50 px-4 py-5 text-sm text-gray-500">
                Updates are hidden. Tap the eye button to view them again.
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};



const SummaryCard = ({ title, value, icon, borderColor, bgColor }) => (
  <div className={`rounded-2xl border border-gray-100 border-l-4 bg-white p-4 shadow-sm sm:p-5 ${borderColor}`}>
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm leading-5 text-gray-500">{title}</p>
        <p className="mt-1 text-2xl font-semibold text-gray-900">₹{value}</p>
      </div>
      <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${bgColor}`}>{icon}</div>
    </div>
  </div>
);

const MobileOverviewCard = ({ title, value, icon, valueColor = "text-gray-900" }) => (
  <div className="flex flex-col items-center justify-center gap-2 rounded-2xl bg-white p-3 shadow-sm border border-gray-100">
    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-50">{icon}</div>
    <p className="text-center text-[10px] leading-3 text-gray-500">{title}</p>
    <p className={`text-xl font-bold ${valueColor}`}>{value}</p>
  </div>
);

const QuickAction = ({ icon, label, to, onClick, disabled = false }) => {
  const inner = (
    <div
      className={`relative flex flex-col items-center gap-1.5 rounded-2xl px-1 py-1 ${disabled ? "opacity-45" : ""
        }`}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#00D3CD]/10">{icon}</div>
      <span className="text-[10px] font-medium text-gray-600">{label}</span>
    </div>
  );
  if (disabled) {
    return (
      <button
        type="button"
        disabled
        title="Service is temporarily unavailable"
        className="cursor-not-allowed"
      >
        {inner}
      </button>
    );
  }
  if (to) return <Link to={to}>{inner}</Link>;
  return <button type="button" onClick={onClick}>{inner}</button>;
};

export default MerchantDashboard;
