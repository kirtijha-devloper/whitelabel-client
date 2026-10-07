import React, { useEffect, useState } from "react";
import AdminStatCard from "../../components/SuperAdmin/AdminStatCard";
import ServiceUsageChart from "../../components/SuperAdmin/ServiceUsageChart";
import AdminSpendingChart from "../../components/SuperAdmin/AdminSpendingChart";

const SuperAdminDashboard = () => {
  const [dashboardData, setDashboardData] = useState({
    todaysBusiness: 0,
    totalBusiness: 0,
    totalTransactions: 0,
    totalCommission: 0,
    todaysCommission: 0,
    pendingTransactions: 0,
    failedTransactions: 0,
    successfulTransactions: 0,
    spending: [],
  });

  useEffect(() => {
    // Temporary data
    // Replace with API later
    setDashboardData({
      todaysBusiness: 125000,
      totalBusiness: 1850000,
      totalTransactions: 2450,
      totalCommission: 92500,
      todaysCommission: 6200,

      pendingTransactions: 35,
      failedTransactions: 18,
      successfulTransactions: 2397,

      spending: [
        {
          adminName: "Admin 1",
          amount: 25000,
        },
        {
          adminName: "Admin 2",
          amount: 18000,
        },
        {
          adminName: "Admin 3",
          amount: 42000,
        },
        {
          adminName: "Admin 4",
          amount: 12000,
        },
        {
          adminName: "Admin 5",
          amount: 30000,
        },
      ],
    });
  }, []);

  return (
    <div className="min-h-screen bg-[#f5f7fb] p-4 sm:p-6 lg:p-7">

      {/* ================= HEADER ================= */}
      <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

        <div>
          <p className="mb-1 text-sm font-medium text-cyan-600">
            Overview
          </p>

          <h2 className="text-2xl font-bold tracking-tight text-slate-800">
            Super Admin Dashboard
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Monitor your business, transactions and commissions
          </p>
        </div>

        {/* Date */}
        <div className="flex w-fit items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-50 text-cyan-600">
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M8 7V3m8 4V3m-9 8h10M5 5h14a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2z"
              />
            </svg>
          </div>

          <div>
            <p className="text-xs text-slate-400">
              Today
            </p>

            <p className="text-sm font-semibold text-slate-700">
              October 7, 2026
            </p>
          </div>
        </div>
      </div>


      {/* ================= MAIN STAT CARDS ================= */}
      <div className="mb-7 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">

        <AdminStatCard
          title="Today's Business"
          value={`₹${dashboardData.todaysBusiness.toLocaleString()}`}
          type="business"
          subtitle="Business generated today"
        />

        <AdminStatCard
          title="Total Business"
          value={`₹${dashboardData.totalBusiness.toLocaleString()}`}
          type="total"
          subtitle="Overall business volume"
        />

        <AdminStatCard
          title="Total Transactions"
          value={dashboardData.totalTransactions.toLocaleString()}
          type="transactions"
          subtitle="All transactions"
        />

        <AdminStatCard
          title="Total Commission"
          value={`₹${dashboardData.totalCommission.toLocaleString()}`}
          type="commission"
          subtitle="Total commission earned"
        />

        <AdminStatCard
          title="Today's Commission"
          value={`₹${dashboardData.todaysCommission.toLocaleString()}`}
          type="todayCommission"
          subtitle="Commission generated today"
        />

      </div>


      {/* ================= TRANSACTION STATUS ================= */}
      <div className="mb-7">

        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-800">
              Transaction Status
            </h3>

            <p className="mt-1 text-sm text-slate-500">
              Current transaction performance
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <AdminStatCard
            title="Pending Transactions"
            value={dashboardData.pendingTransactions.toLocaleString()}
            type="pending"
            subtitle="Requires attention"
          />
          <AdminStatCard
            title="Failed Transactions"
            value={dashboardData.failedTransactions.toLocaleString()}
            type="failed"
            subtitle="Failed payments"
          />
          <AdminStatCard
            title="Successful Transactions"
            value={dashboardData.successfulTransactions.toLocaleString()}
            type="successful"
            subtitle="Successfully completed"
          />

        </div>
      </div>


      {/* ================= ANALYTICS ================= */}
      <div>

        <div className="mb-4">
          <h3 className="text-lg font-bold text-slate-800">
            Analytics
          </h3>

          <p className="mt-1 text-sm text-slate-500">
            Business and service performance overview
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">

          {/* Service Usage */}
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md">
            <ServiceUsageChart />
          </div>

          {/* Admin Spending */}
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md">
            <AdminSpendingChart />
          </div>

        </div>

      </div>

    </div>
  );
};

export default SuperAdminDashboard;