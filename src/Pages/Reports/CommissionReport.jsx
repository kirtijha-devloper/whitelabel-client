import React, { useState, useMemo } from "react";
import {
  FaPercentage,
  FaSearch,
  FaDownload,
  FaCoins,
  FaUserTie,
  FaStore,
  FaChartPie,
  FaCheckCircle,
  FaClock,
} from "react-icons/fa";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { toast } from "react-toastify";

// Comprehensive Mock fallback data for rich presentation
const SAMPLE_COMMISSIONS = [
  {
    id: "COM-9812",
    date: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    user_name: "Metro Digital Pay",
    user_id: "FRN-305",
    role: "Franchise",
    service: "POS Machine Hardware",
    mode: "CARD (Visa)",
    volume: 125000,
    rate: "0.35%",
    commission_earned: 437.5,
    platform_margin: 218.75,
    status: "CREDITED",
  },
  {
    id: "COM-9811",
    date: new Date(Date.now() - 1000 * 60 * 65).toISOString(),
    user_name: "Apex Retail Solutions",
    user_id: "MRC-401",
    role: "Merchant",
    service: "Vimo Payout",
    mode: "IMPS",
    volume: 45000,
    rate: "₹2.50 Flat",
    commission_earned: 25.0,
    platform_margin: 40.0,
    status: "CREDITED",
  },
  {
    id: "COM-9810",
    date: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
    user_name: "Citylink Super Franchise",
    user_id: "SFR-502",
    role: "Super Franchise",
    service: "CC Bill Pay",
    mode: "CARD",
    volume: 85000,
    rate: "0.20%",
    commission_earned: 170.0,
    platform_margin: 127.5,
    status: "CREDITED",
  },
  {
    id: "COM-9809",
    date: new Date(Date.now() - 1000 * 60 * 190).toISOString(),
    user_name: "Kisan Mart",
    user_id: "MRC-115",
    role: "Merchant",
    service: "SevenPay Payout",
    mode: "IMPS",
    volume: 38000,
    rate: "₹2.00 Flat",
    commission_earned: 16.0,
    platform_margin: 36.0,
    status: "CREDITED",
  },
  {
    id: "COM-9808",
    date: new Date(Date.now() - 1000 * 60 * 250).toISOString(),
    user_name: "BlueSky Enterprise",
    user_id: "FRN-214",
    role: "Franchise",
    service: "POS Machine Hardware",
    mode: "CARD (MasterCard)",
    volume: 210000,
    rate: "0.40%",
    commission_earned: 840.0,
    platform_margin: 378.0,
    status: "CREDITED",
  },
  {
    id: "COM-9807",
    date: new Date(Date.now() - 1000 * 60 * 360).toISOString(),
    user_name: "Royal Telecom",
    user_id: "MRC-209",
    role: "Merchant",
    service: "QR Standees & Soundboxes",
    mode: "UPI",
    volume: 18500,
    rate: "₹0.50/txn",
    commission_earned: 42.0,
    platform_margin: 21.0,
    status: "PENDING",
  },
  {
    id: "COM-9806",
    date: new Date(Date.now() - 1000 * 60 * 480).toISOString(),
    user_name: "Sharma General Store",
    user_id: "MRC-102",
    role: "Merchant",
    service: "BranchX Payout",
    mode: "NEFT",
    volume: 92000,
    rate: "₹3.00 Flat",
    commission_earned: 36.0,
    platform_margin: 72.0,
    status: "CREDITED",
  },
  {
    id: "COM-9805",
    date: new Date(Date.now() - 1000 * 60 * 600).toISOString(),
    user_name: "Capital Super Franchise",
    user_id: "SFR-101",
    role: "Super Franchise",
    service: "PG MID Routing",
    mode: "NetBanking",
    volume: 340000,
    rate: "0.25%",
    commission_earned: 850.0,
    platform_margin: 595.0,
    status: "CREDITED",
  },
];

const SERVICE_OPTIONS = [
  "All Services",
  "POS Machine Hardware",
  "Vimo Payout",
  "SevenPay Payout",
  "BranchX Payout",
  "CC Bill Pay",
  "QR Standees & Soundboxes",
  "PG MID Routing",
];

const CommissionReport = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRole, setSelectedRole] = useState("ALL");
  const [selectedService, setSelectedService] = useState("All Services");
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0],
    endDate: new Date().toISOString().split("T")[0],
  });

  // Filtered Commission List
  const filteredCommissions = useMemo(() => {
    return SAMPLE_COMMISSIONS.filter((row) => {
      const matchesSearch =
        row.user_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        row.user_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        row.id.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesRole =
        selectedRole === "ALL" || row.role.toLowerCase() === selectedRole.toLowerCase();

      const matchesService =
        selectedService === "All Services" || row.service === selectedService;

      return matchesSearch && matchesRole && matchesService;
    });
  }, [searchTerm, selectedRole, selectedService]);

  // Aggregate Metrics
  const totalCommissionDistributed = filteredCommissions.reduce((acc, c) => acc + c.commission_earned, 0);
  const totalPlatformMargin = filteredCommissions.reduce((acc, c) => acc + c.platform_margin, 0);
  const totalQualifyingVolume = filteredCommissions.reduce((acc, c) => acc + c.volume, 0);

  // Chart Data by Service
  const chartData = useMemo(() => {
    const serviceMap = {};
    filteredCommissions.forEach((c) => {
      if (!serviceMap[c.service]) {
        serviceMap[c.service] = {
          name: c.service.replace(" Machine Hardware", "").replace(" & Soundboxes", ""),
          partnerCommission: 0,
          platformMargin: 0,
        };
      }
      serviceMap[c.service].partnerCommission += c.commission_earned;
      serviceMap[c.service].platformMargin += c.platform_margin;
    });
    return Object.values(serviceMap);
  }, [filteredCommissions]);

  // Excel Export
  const handleExportExcel = () => {
    if (filteredCommissions.length === 0) {
      toast.warn("No commission records to export");
      return;
    }

    const exportData = filteredCommissions.map((c) => ({
      "Commission ID": c.id,
      "Date Time": new Date(c.date).toLocaleString(),
      "User / Partner Name": c.user_name,
      "User ID": c.user_id,
      "Partner Role": c.role,
      Service: c.service,
      Mode: c.mode,
      "Transaction Volume (INR)": c.volume,
      "Commission Rate": c.rate,
      "Partner Commission (INR)": c.commission_earned,
      "Platform Margin (INR)": c.platform_margin,
      Status: c.status,
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Commission_Report");
    const buffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const blob = new Blob([buffer], { type: "application/octet-stream" });
    saveAs(blob, `Commission_Report_${new Date().toISOString().split("T")[0]}.xlsx`);
    toast.success("Commission report exported successfully!");
  };

  return (
    <div className="min-h-screen bg-gray-50/50 p-4 md:p-6 space-y-6">
      {/* HEADER SECTION */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-[#00D3CD]/10 text-[#00D3CD] rounded-xl">
              <FaPercentage className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Commission Report</h1>
              <p className="text-xs text-gray-500 mt-0.5">
                Monitor distributor payouts, franchise margins, merchant incentives, and net platform profitability.
              </p>
            </div>
          </div>
        </div>

        {/* ACTIONS */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleExportExcel}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 text-xs font-semibold shadow-sm transition"
          >
            <FaDownload className="w-3.5 h-3.5 text-[#00D3CD]" />
            Export Excel
          </button>
        </div>
      </div>

      {/* OVERVIEW STATS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-gray-400">
              Commission Distributed
            </p>
            <p className="text-2xl font-bold text-gray-900 mt-1">
              ₹{totalCommissionDistributed.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
            <span className="text-[11px] text-emerald-600 font-medium bg-emerald-50 px-2 py-0.5 rounded-md mt-1 inline-block">
              Paid to Partners
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-teal-50 flex items-center justify-center text-[#00D3CD]">
            <FaCoins className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-gray-400">
              Platform Net Margin
            </p>
            <p className="text-2xl font-bold text-indigo-600 mt-1">
              ₹{totalPlatformMargin.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
            <span className="text-[11px] text-indigo-600 font-medium bg-indigo-50 px-2 py-0.5 rounded-md mt-1 inline-block">
              Retained Platform Share
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-500">
            <FaPercentage className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-gray-400">
              Commission Volume
            </p>
            <p className="text-2xl font-bold text-blue-600 mt-1">
              ₹{totalQualifyingVolume.toLocaleString()}
            </p>
            <span className="text-[11px] text-blue-600 font-medium bg-blue-50 px-2 py-0.5 rounded-md mt-1 inline-block">
              Qualifying Transactions
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-blue-500">
            <FaStore className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-gray-400">
              Active Partners
            </p>
            <p className="text-2xl font-bold text-purple-600 mt-1">
              {new Set(filteredCommissions.map((c) => c.user_id)).size} Partners
            </p>
            <span className="text-[11px] text-purple-600 font-medium bg-purple-50 px-2 py-0.5 rounded-md mt-1 inline-block">
              Franchise & Merchants
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-purple-50 flex items-center justify-center text-purple-500">
            <FaUserTie className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* CHART SECTION */}
      {chartData.length > 0 && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-gray-800">
                Commission vs Platform Margin by Service
              </h2>
              <p className="text-xs text-gray-400">
                Comparison of partner payouts vs retained earnings
              </p>
            </div>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(val) => `₹${Number(val).toFixed(2)}`}
                  contentStyle={{ borderRadius: "12px", border: "1px solid #eee", fontSize: "12px" }}
                />
                <Legend wrapperStyle={{ fontSize: "12px" }} />
                <Bar dataKey="partnerCommission" name="Partner Commission (₹)" fill="#00D3CD" radius={[4, 4, 0, 0]} />
                <Bar dataKey="platformMargin" name="Platform Margin (₹)" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* FILTERS TOOLBAR */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search */}
          <div className="relative">
            <FaSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 w-3.5 h-3.5" />
            <input
              type="text"
              placeholder="Search partner, user ID, ref..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-gray-200 bg-gray-50/50 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#00D3CD]/30"
            />
          </div>

          {/* Role Filter */}
          <div>
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-white text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#00D3CD]/30"
            >
              <option value="ALL">All Partner Roles</option>
              <option value="Franchise">Franchise</option>
              <option value="Merchant">Merchant</option>
              <option value="Super Franchise">Super Franchise</option>
            </select>
          </div>

          {/* Service Filter */}
          <div>
            <select
              value={selectedService}
              onChange={(e) => setSelectedService(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-white text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#00D3CD]/30"
            >
              {SERVICE_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>

          {/* Date Range */}
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={dateRange.startDate}
              onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
              className="w-1/2 px-2.5 py-2 rounded-xl border border-gray-200 bg-white text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#00D3CD]/30"
            />
            <span className="text-gray-400 text-xs">to</span>
            <input
              type="date"
              value={dateRange.endDate}
              onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
              className="w-1/2 px-2.5 py-2 rounded-xl border border-gray-200 bg-white text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#00D3CD]/30"
            />
          </div>
        </div>
      </div>

      {/* COMMISSION TABLE */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50/80 text-gray-500 font-semibold border-b border-gray-100 uppercase tracking-wider">
              <tr>
                <th className="py-3.5 px-4">Commission ID</th>
                <th className="py-3.5 px-4">Partner Name & Role</th>
                <th className="py-3.5 px-4">Service & Mode</th>
                <th className="py-3.5 px-4 text-right">Volume (₹)</th>
                <th className="py-3.5 px-4 text-center">Rate / Slab</th>
                <th className="py-3.5 px-4 text-right">Commission (₹)</th>
                <th className="py-3.5 px-4 text-right">Platform Net (₹)</th>
                <th className="py-3.5 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-gray-700">
              {filteredCommissions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-gray-400">
                    <FaPercentage className="w-10 h-10 mx-auto text-gray-300 mb-3" />
                    <p className="text-sm font-medium text-gray-600">No commission records found</p>
                    <p className="text-xs text-gray-400 mt-1">
                      Try adjusting the filter options or date range above.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredCommissions.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50/70 transition-colors">
                    {/* ID & Date */}
                    <td className="py-4 px-4">
                      <span className="font-semibold text-gray-900 block">{row.id}</span>
                      <span className="text-[11px] text-gray-400">
                        {new Date(row.date).toLocaleDateString()}
                      </span>
                    </td>

                    {/* Partner */}
                    <td className="py-4 px-4">
                      <div className="font-medium text-gray-900">{row.user_name}</div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[10px] text-gray-400">{row.user_id}</span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-purple-50 text-purple-700 font-medium">
                          {row.role}
                        </span>
                      </div>
                    </td>

                    {/* Service */}
                    <td className="py-4 px-4">
                      <span className="font-medium text-gray-800 block">{row.service}</span>
                      <span className="text-[10px] text-teal-600 bg-teal-50 px-1.5 py-0.2 rounded inline-block mt-0.5">
                        {row.mode}
                      </span>
                    </td>

                    {/* Volume */}
                    <td className="py-4 px-4 text-right font-medium text-gray-900">
                      ₹{Number(row.volume).toLocaleString()}
                    </td>

                    {/* Rate */}
                    <td className="py-4 px-4 text-center">
                      <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-700 font-mono text-[11px]">
                        {row.rate}
                      </span>
                    </td>

                    {/* Commission */}
                    <td className="py-4 px-4 text-right font-bold text-emerald-600">
                      ₹{row.commission_earned.toFixed(2)}
                    </td>

                    {/* Platform Net */}
                    <td className="py-4 px-4 text-right font-semibold text-indigo-600">
                      ₹{row.platform_margin.toFixed(2)}
                    </td>

                    {/* Status */}
                    <td className="py-4 px-4 text-center">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                          row.status === "CREDITED"
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-amber-50 text-amber-700"
                        }`}
                      >
                        {row.status === "CREDITED" ? (
                          <FaCheckCircle className="w-3 h-3 text-emerald-600" />
                        ) : (
                          <FaClock className="w-3 h-3 text-amber-600" />
                        )}
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default CommissionReport;
