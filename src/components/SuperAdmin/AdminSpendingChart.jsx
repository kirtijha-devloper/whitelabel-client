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

const AdminSpendingChart = ({ spending = [] }) => {
  return (
    <div className="rounded-xl bg-white p-6 shadow-sm">

      {/* HEADER */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-800">
          Admin Spending
        </h3>

        <p className="mt-1 text-sm text-gray-500">
          Amount spent by each admin
        </p>
      </div>

      {/* CHART */}
      <div className="h-[400px] w-full">

        <ResponsiveContainer
          width="100%"
          height="100%"
        >
          <BarChart
            data={spending}
            margin={{
              top: 20,
              right: 30,
              left: 20,
              bottom: 30,
            }}
          >

            <CartesianGrid
              strokeDasharray="3 3"
            />

            <XAxis
              dataKey="adminName"
            />

            <YAxis
              tickFormatter={(value) =>
                `₹${Number(value).toLocaleString(
                  "en-IN"
                )}`
              }
            />

            <Tooltip
              formatter={(value) => [
                `₹${Number(value).toLocaleString(
                  "en-IN"
                )}`,
                "Amount Spent",
              ]}
            />

            <Bar
              dataKey="amount"
              name="Amount Spent"
              radius={[6, 6, 0, 0]}
            />

          </BarChart>
        </ResponsiveContainer>

      </div>

    </div>
  );
};

export default AdminSpendingChart;