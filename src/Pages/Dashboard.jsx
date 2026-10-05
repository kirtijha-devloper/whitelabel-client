import { FaHistory } from "react-icons/fa";
import { Link, useNavigate } from "react-router-dom";
import StatCard from "../components/StatCard";
import DataCard from "../components/DataCard";
import DashboardChartLauncher from "../components/DashboardChartLauncher";

const Dashboard = ({ dashboardData = {} }) => {
  const navigate = useNavigate();
  const rawData = dashboardData?.data ?? dashboardData ?? {};
  console.log("Admin dashboard ------->>>>> ,:" , rawData);
  const merchants = rawData.merchants ?? { count: rawData.merchantCount ?? 0 };
  const franchises = rawData.franchaises ?? { count: rawData.franchiseCount ?? 0 };
  const pos_machines =
    rawData.pos_machines ??
    ({
      active: rawData.posActive ?? 0,
      inactive: rawData.posDActive ?? 0,
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
      cards: [{ title: "Merchant List", count: merchants.count || 0 }],
    },
    {
      cards: [{ title: "Franchise List", count: franchises.count || 0 }],
    },
    {
      cards: [
        {
          title: "POS Machine List",
          count: toNumber(pos_machines.active) + toNumber(pos_machines.inactive),
          link: "admin/stock-pos",
        },
        { title: "Active Machine", count: pos_machines.active || 0, link: "admin/stock-pos" },
        { title: "D-Active Machine", count: pos_machines.inactive || 0, link: "admin/stock-pos" },
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
      )
    },
    { title: "Today CC BILLPAYMENT TXN", amount: ccBillPaymentTXN },
    { title: "Today CC BILLPAYMENT Success", amount: ccBillPaymentSuccess },
    { title: "Today CC BILLPAYMENT Failed", amount: ccBillPaymentFailed },
  ];

  const mobileEntityCards = [
    { section: "Merchant", title: "Merchant List", count: merchants.count || 0 },
    { section: "Franchise", title: "Franchise List", count: franchises.count || 0 },
  ];

  const mobileMachineCards = [
    {
      title: "POS Machine List",
      count: toNumber(pos_machines.active) + toNumber(pos_machines.inactive),
      link: "/admin/stock-pos",
    },
    { title: "Active Machine", count: pos_machines.active || 0, link: "/admin/stock-pos" },
    { title: "D-Active Machine", count: pos_machines.inactive || 0, link: "/admin/stock-pos" },
  ];

  return (
    <div className="bg-gray-100 min-h-screen w-full">
      <div className="md:hidden space-y-3 pb-6">
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">Admin Dashboard</p>
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
              <p className="text-lg font-semibold text-gray-900">{formatCount(merchants.count || 0)}</p>
            </div>
            <div className="rounded-xl bg-gray-50 p-2">
              <p className="text-[10px] text-gray-500">Franchise</p>
              <p className="text-lg font-semibold text-gray-900">{formatCount(franchises.count || 0)}</p>
            </div>
            <div className="rounded-xl bg-gray-50 p-2">
              <p className="text-[10px] text-gray-500">Machines</p>
              <p className="text-lg font-semibold text-gray-900">
                {formatCount(toNumber(pos_machines.active) + toNumber(pos_machines.inactive))}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3">
          <DashboardChartLauncher
            buttonClassName="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-primary/20 bg-primary px-3 py-3 text-sm font-semibold text-white shadow-sm transition active:scale-[0.99]"
          />
          <button
            onClick={() => navigate("/admin/total-payouts")}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gray-900 px-3 py-3 text-sm font-semibold text-white shadow-sm transition active:scale-[0.99]"
          >
            <FaHistory className="text-xs" />
            Payout History
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {mobileEntityCards.map((card) => {
            const CardBody = (
              <>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{card.section}</p>
                <div className="mt-2 flex items-center justify-between rounded-xl bg-gray-50 px-3 py-2.5">
                  <span className="text-sm font-medium text-gray-700">{card.title}</span>
                  <span className="rounded-full bg-gray-900 px-2.5 py-1 text-xs font-semibold text-white">
                    {formatCount(card.count)}
                  </span>
                </div>
              </>
            );

            if (card.link) {
              return (
                <Link key={card.section} to={card.link} className="rounded-2xl border border-gray-200 bg-white p-3 shadow-sm">
                  {CardBody}
                </Link>
              );
            }

            return (
              <div key={card.section} className="rounded-2xl border border-gray-200 bg-white p-3 shadow-sm">
                {CardBody}
              </div>
            );
          })}
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
            onClick={() => navigate("/admin/total-payouts")}
          >
            <FaHistory />
            View Payout History
          </button>
        </div>
      </div>

      <div className="hidden md:block">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          {sections.map((section, index) => (
            <div key={index} className="flex flex-col space-y-4">
              {section.button && (
                <Link
                  to={`/${section.button.link}`}
                  className="bg-primary text-white py-3 px-4 rounded-lg hover:opacity-80 transition"
                >
                  {section.button.label}
                </Link>
              )}
              {section.cards.map((card, cardIndex) => (
                <StatCard key={cardIndex} title={card.title} count={card.count} link={card.link} />
              ))}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          {stats.map((item, index) => (
            <DataCard key={index} title={item.title} amount={item.amount} currency="\u20B9" />
          ))}
        </div>

        <div className="flex items-center space-x-4">
          <div className="bg-green-500 text-white p-6 rounded-lg shadow-md flex-1">
            <p className="text-sm">Today Payout</p>
            <p className="text-2xl font-bold">{"\u20B9"}{today_total_payout}</p>
          </div>
          <DashboardChartLauncher
            buttonClassName="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-white transition hover:opacity-90"
          />
          <button
            className="bg-purple-300 text-gray-800 py-2 px-4 rounded-lg hover:bg-purple-400 transition"
            onClick={() => navigate("/admin/total-payouts")} hidden
          >
            <FaHistory className="inline-block mr-2" /> Click to History Show
          </button>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
