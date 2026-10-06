import React from "react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

const serviceData = [
  {
    name: "POS",
    value: 30,
  },
  {
    name: "PG",
    value: 20,
  },
  {
    name: "QR",
    value: 15,
  },
  {
    name: "Soundbox",
    value: 10,
  },
  {
    name: "DMT",
    value: 15,
  },
  {
    name: "Bill Payments",
    value: 10,
  },
];

const COLORS = [
  "#2563eb",
  "#7c3aed",
  "#059669",
  "#f59e0b",
  "#dc2626",
  "#0891b2",
];

/* =========================================
   PIE CHART LABEL
   ========================================= */

const renderCustomizedLabel = ({
  cx,
  cy,
  midAngle,
  innerRadius,
  outerRadius,
  percent,
}) => {
  const RADIAN = Math.PI / 180;

  const radius =
    innerRadius + (outerRadius - innerRadius) * 0.55;

  const x =
    cx + radius * Math.cos(-midAngle * RADIAN);

  const y =
    cy + radius * Math.sin(-midAngle * RADIAN);

  return (
    <text
      x={x}
      y={y}
      fill="white"
      textAnchor={x > cx ? "start" : "end"}
      dominantBaseline="central"
      fontSize={13}
      fontWeight="700"
    >
      {`${(percent * 100).toFixed(0)}%`}
    </text>
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
      </p>
    </div>
  );
};

/* =========================================
   SERVICE USAGE CHART
   ========================================= */

const ServiceUsageChart = () => {
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

      {/* CHART */}
      <div className="h-[360px] w-full">
        <ResponsiveContainer
          width="100%"
          height="100%"
        >
          <PieChart>

            <Pie
              data={serviceData}
              cx="50%"
              cy="45%"
              innerRadius={70}
              outerRadius={120}
              paddingAngle={3}
              dataKey="value"
              nameKey="name"

              /* PERMANENT PERCENTAGE */
              label={renderCustomizedLabel}
              labelLine={false}
            >
              {serviceData.map((entry, index) => (
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

    </div>
  );
};

export default ServiceUsageChart;