import React from "react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

import { PieChart as PieChartIcon } from "lucide-react";

const COLORS = [
  "#00D3CD", // Brand Primary Teal
  "#0284c7", // POS T0 Sky Blue
  "#8b5cf6", // POS T1 Purple
  "#10b981", // Emerald Green
  "#f59e0b", // Amber Warning
  "#6366f1", // Indigo Accent
];


/* =========================================
   PERCENTAGE OUTSIDE PIE
   ========================================= */

const renderCustomizedLabel = ({
  cx,
  cy,
  midAngle,
  outerRadius,
  percent,
  index,
}) => {
  const RADIAN = Math.PI / 180;

  // Percentage position
  const labelRadius = outerRadius + 28;

  const x =
    cx + labelRadius * Math.cos(-midAngle * RADIAN);

  const y =
    cy + labelRadius * Math.sin(-midAngle * RADIAN);

  // Line start
  const lineStartRadius = outerRadius + 5;

  const lineStartX =
    cx + lineStartRadius * Math.cos(-midAngle * RADIAN);

  const lineStartY =
    cy + lineStartRadius * Math.sin(-midAngle * RADIAN);

  // Line end
  const lineEndRadius = outerRadius + 18;

  const lineEndX =
    cx + lineEndRadius * Math.cos(-midAngle * RADIAN);

  const lineEndY =
    cy + lineEndRadius * Math.sin(-midAngle * RADIAN);

  return (
    <g>
      {/* Connector line */}
      <line
        x1={lineStartX}
        y1={lineStartY}
        x2={lineEndX}
        y2={lineEndY}
        stroke={COLORS[index % COLORS.length]}
        strokeWidth={1.5}
      />

      {/* Percentage */}
      <text
        x={x}
        y={y}
        fill="#374151"
        textAnchor={x > cx ? "start" : "end"}
        dominantBaseline="central"
        fontSize={13}
        fontWeight="700"
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    </g>
  );
};

/* =========================================
   HOVER TOOLTIP
   ========================================= */

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload || !payload.length) {
    return null;
  }

  const data = payload[0];
  const count = data.payload?.count;

  return (
    <div className="rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-lg">
      <p className="font-semibold text-gray-800">
        {data.name}
      </p>

      <p className="text-sm text-gray-600">
        Usage:{" "}
        <span className="font-semibold text-gray-900">
          {data.value}%
        </span>
        {count !== undefined && (
          <span className="text-xs text-gray-500 ml-1.5 font-normal">
            ({Number(count).toLocaleString("en-IN")} {Number(count) === 1 ? "txn" : "txns"})
          </span>
        )}
      </p>
    </div>
  );
};

/* =========================================
   SERVICE USAGE CHART
   ========================================= */

const ServiceUsageChart = ({ data }) => {
  const chartData = React.useMemo(() => {
    if (!Array.isArray(data)) return [];
    return data.map((item) => ({
      ...item,
      name:
        String(item?.name || "").trim().toLowerCase() === "payout / dmt"
          ? "Payout"
          : item?.name,
    }));
  }, [data]);

  const hasData =
    Array.isArray(chartData) &&
    chartData.length > 0 &&
    chartData.some((item) => Number(item?.value) > 0);
  return (
    <div className="w-full rounded-2xl bg-white p-6 shadow-sm">

      {/* HEADER */}
      <div className="mb-5">
        <h3 className="text-xl font-semibold text-gray-900">
          Service Usage
        </h3>

        <p className="mt-1 text-sm text-gray-500">
          Percentage of services used
        </p>
      </div>

      {/* CHART OR EMPTY STATE*/}
      {hasData ? (
        <div className="h-[360px] w-full">
          <ResponsiveContainer
            width="100%"
            height="100%"
          >
            <PieChart>

              <Pie
                data={chartData}
                cx="50%"
                cy="45%"
                innerRadius={70}
                outerRadius={120}
                paddingAngle={chartData.length > 1 ? 3 : 0}
                dataKey="value"
                nameKey="name"

                /* PERCENTAGE OUTSIDE */
                label={renderCustomizedLabel}
                labelLine={false}
              >
                {chartData.map((entry, index) => (
                  <Cell
                    key={`service-${index}`}
                    fill={
                      COLORS[index % COLORS.length]
                    }
                  />
                ))}
              </Pie>

              {/* HOVER */}
              <Tooltip
                content={<CustomTooltip />}
              />

              {/* LEGEND */}
              <Legend
                verticalAlign="bottom"
                height={50}
                iconType="circle"
              />

            </PieChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="flex h-[360px] flex-col items-center justify-center text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-50 border border-gray-100 text-gray-400 mb-3">
            <PieChartIcon className="h-6 w-6" />
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

export default ServiceUsageChart;