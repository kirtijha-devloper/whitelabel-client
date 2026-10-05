import React, { useEffect, useState } from "react";
import AdminStatCard from "../../components/SuperAdmin/AdminStatCard";
import AdminSpendingChart from "../../components/SuperAdmin/AdminSpendingChart";

const SuperAdminDashboard = () => {
  const [dashboardData, setDashboardData] = useState({
    totalAdmin: 0,
    activeAdmin: 0,
    inactiveAdmin: 0,
    spending: [],
  });

  useEffect(() => {
    // Temporary data
    // Later API se aayega
    setDashboardData({
      totalAdmin: 5,
      activeAdmin: 4,
      inactiveAdmin: 1,

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
    <div className="min-h-screen bg-gray-100 p-6">

      {/* PAGE HEADER */}
      <div className="mb-6">
        <h2 className="text-2xl font-semibold text-gray-800">
          Super Admin Dashboard
        </h2>

        <p className="mt-1 text-sm text-gray-500">
          Admin overview and spending analytic
        </p>
      </div>

      {/* ADMIN SUMMARY CARDS */}
      <div className="mb-6 grid grid-cols-1 gap-5 md:grid-cols-3">

        <AdminStatCard
          title="Total Admin"
          value={dashboardData.totalAdmin}
        />

        <AdminStatCard
          title="Active Admin"
          value={dashboardData.activeAdmin}
        />

        <AdminStatCard
          title="Inactive Admin"
          value={dashboardData.inactiveAdmin}
        />

      </div>

      {/* ADMIN SPENDING */}
      <AdminSpendingChart
        spending={dashboardData.spending}
      />

    </div>
  );
};

export default SuperAdminDashboard;