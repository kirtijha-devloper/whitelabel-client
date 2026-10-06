import React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const adminSpendingData = [
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
];

const AdminSpendingChart = () => {
  const formatCurrency = (value) => {
    return `₹${Number(value).toLocaleString("en-IN")}`;
  };

  return (
    <div className="w-full rounded-2xl bg-white p-6 shadow-sm">
      {/* HEADER */}
      <div className="mb-5">
        <h3 className="text-xl font-semibold text-gray-900">
          User Spending
        </h3>

        <p className="mt-1 text-sm text-gray-500">
          Amount spent by each admin
        </p>
      </div>

      {/* CHART */}
      <div className="h-[360px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={adminSpendingData}
            margin={{
              top: 20,
              right: 20,
              left: 10,
              bottom: 20,
            }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
            />

            <XAxis
              dataKey="adminName"
              tick={{
                fontSize: 12,
              }}
            />

            <YAxis
              tickFormatter={formatCurrency}
              tick={{
                fontSize: 12,
              }}
            />

            <Tooltip
              formatter={(value) => [
                formatCurrency(value),
                "Amount Spent",
              ]}
            />

            <Bar
              dataKey="amount"
              name="Amount Spent"
              fill="#00D3CD"
              radius={[6, 6, 0, 0]}
              barSize={45}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default AdminSpendingChart;