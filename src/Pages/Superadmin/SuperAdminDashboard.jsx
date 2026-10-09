import React, { useEffect, useState } from "react";
import { Calendar } from "lucide-react";
import AdminStatCard from "../../components/SuperAdmin/AdminStatCard";
import ServiceUsageChart from "../../components/SuperAdmin/ServiceUsageChart";
import AdminSpendingChart from "../../components/SuperAdmin/AdminSpendingChart";
import { getSuperAdminDashboardData } from "../../api/superAdminApi";

const SuperAdminDashboard = () => {
  const [loading, setLoading] = useState(true);
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
    const fetchDashboard = async () => {
      try {
        setLoading(true);
        const res = await getSuperAdminDashboardData();
        if (res) {
          setDashboardData({
            todaysBusiness: res.todaysBusiness || 0,
            totalBusiness: res.totalBusiness || 0,
            totalTransactions: res.totalTransactions || 0,
            totalCommission: res.totalCommission || 0,
            todaysCommission: res.todaysCommission || 0,
            pendingTransactions: res.pendingTransactions || 0,
            failedTransactions: res.failedTransactions || 0,
            successfulTransactions: res.successfulTransactions || 0,
            spending: res.spending || [],
          });
        }

      } catch (err) {
        console.error("Dashboard fetch error : ", err);
      } finally {
        setLoading(false);
      }
    };
    fetchDashboard(); // calling dashboard
  }, []);

  const todayFormatted = new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#00D3CD] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8 space-y-8">
      {/* ================= HEADER ================= */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-gray-100 pb-6">
        <div>
          <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-[#00D3CD]/10 text-[#00a8a3] border border-[#00D3CD]/20 mb-2">
            Super Admin Overview
          </span>

          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">
            Super Admin Dashboard
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            Real-time business performance, transactions, and revenue metrics
          </p>
        </div>

        {/* Date Display */}
        <div className="flex w-fit items-center gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-2.5 shadow-sm">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#00D3CD]/10 text-[#00D3CD]">
            <Calendar className="h-5 w-5" />
          </div>

          <div>
            <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">
              Today
            </p>
            <p className="text-sm font-semibold text-gray-800">
              {todayFormatted}
            </p>
          </div>
        </div>
      </div>

      {/* ================= MAIN STAT CARDS ================= */}
      <div>
        <div className="mb-4">
          <h3 className="text-lg font-bold text-gray-900">
            Business Volume & Earnings
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Overview of total volume and commission generation
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <AdminStatCard
            title="Today's Business"
            value={`₹${dashboardData.todaysBusiness.toLocaleString("en-IN")}`}
            type="business"
            subtitle="Volume generated today"
          />

          <AdminStatCard
            title="Total Business"
            value={`₹${dashboardData.totalBusiness.toLocaleString("en-IN")}`}
            type="total"
            subtitle="Overall platform volume"
          />

          <AdminStatCard
            title="Total Transactions"
            value={dashboardData.totalTransactions.toLocaleString("en-IN")}
            type="transactions"
            subtitle="All processed transactions"
          />

          <AdminStatCard
            title="Total Commission"
            value={`₹${dashboardData.totalCommission.toLocaleString("en-IN")}`}
            type="commission"
            subtitle="Total earnings recorded"
          />

          <AdminStatCard
            title="Today's Commission"
            value={`₹${dashboardData.todaysCommission.toLocaleString("en-IN")}`}
            type="todayCommission"
            subtitle="Earnings generated today"
          />
        </div>
      </div>

      {/* ================= TRANSACTION STATUS ================= */}
      <div>
        <div className="mb-4">
          <h3 className="text-lg font-bold text-gray-900">
            Transaction Health & Status
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Operational status breakdown of all processed requests
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <AdminStatCard
            title="Successful Transactions"
            value={dashboardData.successfulTransactions.toLocaleString("en-IN")}
            type="successful"
            subtitle="Completed without issues"
          />

          <AdminStatCard
            title="Pending Transactions"
            value={dashboardData.pendingTransactions.toLocaleString("en-IN")}
            type="pending"
            subtitle="Processing / requires attention"
          />

          <AdminStatCard
            title="Failed Transactions"
            value={dashboardData.failedTransactions.toLocaleString("en-IN")}
            type="failed"
            subtitle="Failed or rejected requests"
          />
        </div>
      </div>

      {/* ================= ANALYTICS ================= */}
      <div>
        <div className="mb-4">
          <h3 className="text-lg font-bold text-gray-900">
            Platform Analytics
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Distribution across services and top user spending
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          {/* Service Usage Chart */}
          <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm transition-shadow hover:shadow-md">
            <ServiceUsageChart />
          </div>

          {/* Admin Spending Chart */}
          <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm transition-shadow hover:shadow-md">
            <AdminSpendingChart />
          </div>
        </div>
      </div>
    </div>
  );
};

export default SuperAdminDashboard;