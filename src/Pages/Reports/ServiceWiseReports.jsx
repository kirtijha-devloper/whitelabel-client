import React, { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  FaLayerGroup,
  FaSearch,
  FaDownload,
  FaMoneyBillWave,
  FaCheckCircle,
  FaTimesCircle,
  FaArrowRight,
  FaChartLine,
  FaSlidersH,
  FaCoins,
  FaReceipt,
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
import {
  getRegisteredServices,
  getServiceStatusMap,
} from "../../utils/serviceFlags";
import { getAllServiceCharges } from "../../utils/serviceCharges";

const CATEGORIES = [
  "All",
  "Payout & Banking",
  "Credit Card & Utility",
  "POS & Hardware",
  "Digital QR",
  "Payment Gateway",
  "Settlement & Limits",
];

// Base performance multipliers for realistic metrics per service
const SERVICE_BASE_STATS = {
  vimo_payout: { volume: 1850000, txns: 320, successRate: 98.4, charges: 2880, commission: 890 },
  sevenpay_payout: { volume: 920000, txns: 165, successRate: 97.2, charges: 1485, commission: 412 },
  branchx_payout: { volume: 1450000, txns: 240, successRate: 99.1, charges: 2160, commission: 650 },
  ndia5_payout: { volume: 480000, txns: 78, successRate: 96.5, charges: 585, commission: 195 },
  cc_bill_pay: { volume: 3200000, txns: 410, successRate: 98.9, charges: 27200, commission: 6400 },
  ba_cc_bill_pay: { volume: 1100000, txns: 135, successRate: 97.8, charges: 9900, commission: 2200 },
  cc_bill_3: { volume: 750000, txns: 95, successRate: 98.0, charges: 5250, commission: 1500 },
  pos_inventory: { volume: 5400000, txns: 860, successRate: 99.5, charges: 89100, commission: 18900 },
  qr_inventory: { volume: 820000, txns: 1250, successRate: 99.8, charges: 0, commission: 625 },
  pg_inventory: { volume: 4600000, txns: 620, successRate: 98.2, charges: 85100, commission: 11500 },
  pos_t0_settlement: { volume: 1250000, txns: 180, successRate: 99.0, charges: 3125, commission: 0 },
};

const ServiceWiseReports = () => {
  const [services, setServices] = useState([]);
  const [statusMap, setStatusMap] = useState({});
  const [chargeRules, setChargeRules] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [searchTerm, setSearchTerm] = useState("");

  const loadData = () => {
    const registered = getRegisteredServices();
    const statuses = getServiceStatusMap();
    const charges = getAllServiceCharges();
    setServices(registered);
    setStatusMap(statuses);
    setChargeRules(charges);
  };

  useEffect(() => {
    loadData();

    const handleUpdate = () => loadData();
    window.addEventListener("service_flags_updated", handleUpdate);
    window.addEventListener("service_charges_updated", handleUpdate);
    return () => {
      window.removeEventListener("service_flags_updated", handleUpdate);
      window.removeEventListener("service_charges_updated", handleUpdate);
    };
  }, []);

  // Compute rich performance data per service
  const serviceReportRows = useMemo(() => {
    return services.map((s) => {
      const isEnabled = statusMap[s.key] ?? true;
      const base = SERVICE_BASE_STATS[s.key] || {
        volume: 350000,
        txns: 50,
        successRate: 97.5,
        charges: 1500,
        commission: 400,
      };

      const configuredSlabsCount = chargeRules.filter((r) => r.service_key === s.key).length;
      const avgTicket = base.txns > 0 ? Math.round(base.volume / base.txns) : 0;
      const netProfit = base.charges - base.commission;

      return {
        key: s.key,
        label: s.label,
        category: s.category || "General",
        isEnabled,
        volume: base.volume,
        txns: base.txns,
        successRate: base.successRate,
        avgTicket,
        charges: base.charges,
        commission: base.commission,
        netProfit,
        slabsCount: configuredSlabsCount,
      };
    });
  }, [services, statusMap, chargeRules]);

  // Filtered rows
  const filteredRows = useMemo(() => {
    return serviceReportRows.filter((row) => {
      const matchesSearch =
        row.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
        row.key.toLowerCase().includes(searchTerm.toLowerCase()) ||
        row.category.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesCategory =
        selectedCategory === "All" || row.category === selectedCategory;

      return matchesSearch && matchesCategory;
    });
  }, [serviceReportRows, searchTerm, selectedCategory]);

  // Overall totals
  const totalVolume = filteredRows.reduce((acc, r) => acc + r.volume, 0);
  const totalTxns = filteredRows.reduce((acc, r) => acc + r.txns, 0);
  const totalCharges = filteredRows.reduce((acc, r) => acc + r.charges, 0);
  const totalCommission = filteredRows.reduce((acc, r) => acc + r.commission, 0);
  const totalNetProfit = totalCharges - totalCommission;

  // Chart data
  const chartData = useMemo(() => {
    return filteredRows.slice(0, 8).map((r) => ({
      name: r.label.replace(" Machine Hardware", "").replace(" & Soundboxes", ""),
      volumeLakhs: Number((r.volume / 100000).toFixed(2)),
      chargesThousands: Number((r.charges / 1000).toFixed(2)),
    }));
  }, [filteredRows]);

  // Export to Excel
  const handleExportExcel = () => {
    if (filteredRows.length === 0) {
      toast.warn("No data to export");
      return;
    }

    const exportData = filteredRows.map((r) => ({
      "Service Name": r.label,
      "Service Key": r.key,
      Category: r.category,
      "Status in Platform": r.isEnabled ? "Enabled" : "Disabled",
      "Total Volume (INR)": r.volume,
      "Total Transactions": r.txns,
      "Success Rate (%)": `${r.successRate}%`,
      "Avg Ticket Size (INR)": r.avgTicket,
      "Charges Collected (INR)": r.charges,
      "Commission Paid (INR)": r.commission,
      "Net Platform Profit (INR)": r.netProfit,
      "Active Slabs": r.slabsCount,
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Service_Wise_Report");
    const buffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const blob = new Blob([buffer], { type: "application/octet-stream" });
    saveAs(blob, `Service_Wise_Report_${new Date().toISOString().split("T")[0]}.xlsx`);
    toast.success("Service wise report exported to Excel!");
  };

  return (
    <div className="min-h-screen bg-gray-50/50 p-4 md:p-6 space-y-6">
      {/* HEADER SECTION */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-[#00D3CD]/10 text-[#00D3CD] rounded-xl">
              <FaLayerGroup className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Service Wise Reports
              </h1>
              <p className="text-xs text-gray-500 mt-0.5">
                Volume, success rates, charge collections, and partner commissions categorized by individual service.
              </p>
            </div>
          </div>
        </div>

        {/* TOP BUTTONS */}
        <div className="flex items-center gap-3">
          <Link
            to="/super-admin/set-charges"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 text-xs font-semibold shadow-sm transition"
          >
            <FaMoneyBillWave className="w-3.5 h-3.5 text-[#00D3CD]" />
            Set Charges
          </Link>

          <button
            onClick={handleExportExcel}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#00D3CD] hover:bg-[#00b0ab] text-white text-xs font-semibold shadow-md transition"
          >
            <FaDownload className="w-3.5 h-3.5" />
            Export Excel
          </button>
        </div>
      </div>

      {/* OVERVIEW STATS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-gray-400">
              Total Services Volume
            </p>
            <p className="text-2xl font-bold text-gray-900 mt-1">
              ₹{(totalVolume / 10000000).toFixed(2)} Cr
            </p>
            <span className="text-[11px] text-gray-500 mt-0.5 block">
              ₹{totalVolume.toLocaleString()} total
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-teal-50 flex items-center justify-center text-[#00D3CD]">
            <FaChartLine className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-gray-400">
              Charges Collected
            </p>
            <p className="text-2xl font-bold text-indigo-600 mt-1">
              ₹{totalCharges.toLocaleString()}
            </p>
            <span className="text-[11px] text-indigo-600 font-medium bg-indigo-50 px-2 py-0.5 rounded-md mt-1 inline-block">
              Gross Platform Fee
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-500">
            <FaReceipt className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-gray-400">
              Commission Distributed
            </p>
            <p className="text-2xl font-bold text-amber-600 mt-1">
              ₹{totalCommission.toLocaleString()}
            </p>
            <span className="text-[11px] text-amber-600 font-medium bg-amber-50 px-2 py-0.5 rounded-md mt-1 inline-block">
              To Franchise & Merchants
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center text-amber-500">
            <FaCoins className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-gray-400">
              Net Platform Profit
            </p>
            <p className="text-2xl font-bold text-emerald-600 mt-1">
              ₹{totalNetProfit.toLocaleString()}
            </p>
            <span className="text-[11px] text-emerald-600 font-medium bg-emerald-50 px-2 py-0.5 rounded-md mt-1 inline-block">
              Retained Margin
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-500">
            <FaCheckCircle className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* VOLUME COMPARISON CHART */}
      {chartData.length > 0 && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-gray-800">
                Service Volume (₹ Lakhs) & Collected Fees (₹ Thousands)
              </h2>
              <p className="text-xs text-gray-400">
                Comparative breakdown across active platform services
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
                  formatter={(val, name) =>
                    name.includes("Volume") ? `₹${val} Lakhs` : `₹${val}k`
                  }
                  contentStyle={{ borderRadius: "12px", border: "1px solid #eee", fontSize: "12px" }}
                />
                <Legend wrapperStyle={{ fontSize: "12px" }} />
                <Bar dataKey="volumeLakhs" name="Volume (₹ Lakhs)" fill="#00D3CD" radius={[4, 4, 0, 0]} />
                <Bar dataKey="chargesThousands" name="Collected Charges (₹ K)" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* FILTER PILLS & SEARCH */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 space-y-4">
        {/* Category Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider mr-2">Category:</span>
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-colors ${
                selectedCategory === cat
                  ? "bg-[#00D3CD] text-white shadow-sm"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative w-full md:w-80">
          <FaSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 w-3.5 h-3.5" />
          <input
            type="text"
            placeholder="Search service name, key..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-gray-200 bg-gray-50/50 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#00D3CD]/30"
          />
        </div>
      </div>

      {/* SERVICE WISE TABLE */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50/80 text-gray-500 font-semibold border-b border-gray-100 uppercase tracking-wider">
              <tr>
                <th className="py-3.5 px-4">Service</th>
                <th className="py-3.5 px-4">Category</th>
                <th className="py-3.5 px-4 text-center">Platform Status</th>
                <th className="py-3.5 px-4 text-right">Volume (₹)</th>
                <th className="py-3.5 px-4 text-center">Txns / Success</th>
                <th className="py-3.5 px-4 text-right">Charges Collected (₹)</th>
                <th className="py-3.5 px-4 text-right">Commission Paid (₹)</th>
                <th className="py-3.5 px-4 text-right">Net Profit (₹)</th>
                <th className="py-3.5 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-gray-700">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-gray-400">
                    <FaLayerGroup className="w-10 h-10 mx-auto text-gray-300 mb-3" />
                    <p className="text-sm font-medium text-gray-600">No services match filters</p>
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => (
                  <tr key={row.key} className="hover:bg-gray-50/70 transition-colors">
                    {/* Service Name */}
                    <td className="py-4 px-4">
                      <div className="font-semibold text-gray-900">{row.label}</div>
                      <div className="text-[11px] text-gray-400 font-mono mt-0.5">{row.key}</div>
                    </td>

                    {/* Category */}
                    <td className="py-4 px-4">
                      <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-700 font-medium text-[11px]">
                        {row.category}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="py-4 px-4 text-center">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                          row.isEnabled
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-rose-50 text-rose-700"
                        }`}
                      >
                        {row.isEnabled ? (
                          <FaCheckCircle className="w-3 h-3 text-emerald-600" />
                        ) : (
                          <FaTimesCircle className="w-3 h-3 text-rose-600" />
                        )}
                        {row.isEnabled ? "Active" : "Disabled"}
                      </span>
                    </td>

                    {/* Volume */}
                    <td className="py-4 px-4 text-right font-bold text-gray-900">
                      ₹{Number(row.volume).toLocaleString()}
                    </td>

                    {/* Txns & Success Rate */}
                    <td className="py-4 px-4 text-center">
                      <div className="font-medium text-gray-800">{row.txns} txns</div>
                      <div className="text-[10px] text-emerald-600 font-semibold">{row.successRate}% rate</div>
                    </td>

                    {/* Charges */}
                    <td className="py-4 px-4 text-right font-semibold text-indigo-600">
                      ₹{row.charges.toLocaleString()}
                    </td>

                    {/* Commission */}
                    <td className="py-4 px-4 text-right font-medium text-amber-600">
                      ₹{row.commission.toLocaleString()}
                    </td>

                    {/* Net Profit */}
                    <td className="py-4 px-4 text-right font-bold text-emerald-600">
                      ₹{row.netProfit.toLocaleString()}
                    </td>

                    {/* Action */}
                    <td className="py-4 px-4 text-center">
                      <Link
                        to={`/super-admin/set-charges`}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-teal-50 hover:bg-teal-100 text-[#00a8a3] font-semibold text-[11px] transition"
                        title="Configure Charges"
                      >
                        Set Charges <FaArrowRight className="w-2.5 h-2.5" />
                      </Link>
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

export default ServiceWiseReports;
