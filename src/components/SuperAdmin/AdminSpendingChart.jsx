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

import { BarChart2 } from "lucide-react";

const AdminSpendingChart = ({ data }) => {
  const hasData = Array.isArray(data) && data.length > 0;

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
      {hasData ? (
        <div className="h-[360px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
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
                stroke="#f1f5f9"
              />

              <XAxis
                dataKey="adminName"
                axisLine={{ stroke: "#e2e8f0" }}
                tickLine={false}
                tick={{
                  fontSize: 12,
                  fill: "#64748b",
                }}
              />

              <YAxis
                tickFormatter={formatCurrency}
                axisLine={false}
                tickLine={false}
                tick={{
                  fontSize: 12,
                  fill: "#64748b",
                }}
              />

              <Tooltip
                contentStyle={{
                  backgroundColor: "#ffffff",
                  borderRadius: "12px",
                  border: "1px solid #e2e8f0",
                  boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                  fontSize: "12px",
                }}
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
                barSize={42}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="flex h-[360px] flex-col items-center justify-center text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-50 border border-gray-100 text-gray-400 mb-3">
            <BarChart2 className="h-6 w-6" />
          </div>
          <p className="text-sm font-semibold text-gray-700">No Data Available</p>
          <p className="text-xs text-gray-400 mt-1">
            Data will appear here once transactions are recorded
          </p>
        </div>
      )}
    </div>
  );
};

export default AdminSpendingChart;