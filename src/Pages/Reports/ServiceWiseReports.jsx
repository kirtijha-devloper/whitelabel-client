import React, { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  FaLayerGroup,
  FaSearch,
  FaDownload,
  FaMoneyBillWave,
  FaCheckCircle,
  FaTimesCircle,
  FaArrowRight,
  FaCoins,
  FaReceipt,
  FaSyncAlt,
} from "react-icons/fa";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { toast } from "react-toastify";
import { useQuery } from "@tanstack/react-query";
import { getSuperAdminServiceWiseReport } from "../../api/superAdminApi";
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

const ServiceWiseReports = ({ embedded = false, currentUser }) => {
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [searchTerm, setSearchTerm] = useState("");

  // Charge rules for slab counts
  const chargeRules = useMemo(() => {
    try {
      return getAllServiceCharges() || [];
    } catch (_) {
      return [];
    }
  }, []);

  // Fetch real aggregated service data from backend (NO mock / dummy data)
  const {
    data: reportResponse,
    isLoading,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ["superAdminServiceWiseReport", selectedCategory, searchTerm],
    queryFn: () =>
      getSuperAdminServiceWiseReport({
        category: selectedCategory !== "All" ? selectedCategory : undefined,
        search: searchTerm.trim() || undefined,
      }),
  });

  const rawRows = reportResponse?.data || [];
  const backendSummary = reportResponse?.summary || {};

  // Compute rich real rows
  const displayRows = useMemo(() => {
    return rawRows.map((r) => {
      const configuredSlabsCount = chargeRules.filter(
        (rule) => rule.service_key === r.key
      ).length;

      const volume = Number(r.volume || 0);
      const txns = Number(r.txns || 0);
      const charges = Number(r.charges || 0);
      const commission = Number(r.commission || 0);
      const netProfit = Number(r.netProfit ?? (charges - commission));
      const avgTicket = txns > 0 ? Math.round(volume / txns) : 0;
      const successRate = r.successRate !== undefined ? Number(r.successRate) : 100;

      return {
        key: r.key,
        label: r.label || r.key,
        category: r.category || "General",
        isEnabled: Boolean(r.isEnabled),
        volume,
        txns,
        successRate,
        avgTicket,
        charges,
        commission,
        netProfit,
        slabsCount: configuredSlabsCount,
      };
    });
  }, [rawRows, chargeRules]);

  // Overall totals from real data
  const totalVolume = Number(backendSummary.total_volume ?? displayRows.reduce((acc, r) => acc + r.volume, 0));
  const totalTxns = Number(backendSummary.total_txns ?? displayRows.reduce((acc, r) => acc + r.txns, 0));
  const totalCharges = Number(backendSummary.total_charges ?? displayRows.reduce((acc, r) => acc + r.charges, 0));
  const totalCommission = Number(backendSummary.total_commission ?? displayRows.reduce((acc, r) => acc + r.commission, 0));
  const totalNetProfit = Number(backendSummary.total_net_profit ?? (totalCharges - totalCommission));

  // Export to Excel
  const handleExportExcel = () => {
    if (displayRows.length === 0) {
      toast.warn("No data to export");
      return;
    }

    const exportData = displayRows.map((r) => ({
      "Service Name": r.label,
      "Service Key": r.key,
      Category: r.category,
      "Status in Platform": r.isEnabled ? "Active" : "Disabled",
      "Total Volume (INR)": r.volume,
      "Total Transactions": r.txns,
      "Success Rate (%)": `${r.successRate}%`,
      "Avg Ticket Size (INR)": r.avgTicket,
      "Charges Collected (INR)": r.charges,
      "Commission Paid (INR)": r.commission,
      "Net Platform Profit (INR)": r.netProfit,
      "Configured Slabs": r.slabsCount,
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
    <div className={embedded ? "space-y-6" : "min-h-screen bg-gray-50 p-4 md:p-6 space-y-6"}>
      {/* ── Header Card ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-white p-5 md:p-6 rounded-2xl shadow-sm border border-gray-200">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-[#00D3CD]/10 text-[#00D3CD] rounded-xl">
            <FaLayerGroup className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-gray-900">
              Service Wise Reports
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">
              Real-time platform throughput, charges, and commission audits by service category.
            </p>
          </div>
        </div>

        {/* Top Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 text-xs font-semibold shadow-sm transition disabled:opacity-50"
            title="Refresh Data"
          >
            <FaSyncAlt className={`w-3.5 h-3.5 ${isFetching ? "animate-spin text-[#00D3CD]" : ""}`} />
            <span>Refresh</span>
          </button>

          <Link
            to="/super-admin/set-charges"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 text-xs font-semibold shadow-sm transition"
          >
            <FaMoneyBillWave className="w-3.5 h-3.5 text-[#00D3CD]" />
            <span>Set Charges</span>
          </Link>

          <button
            type="button"
            onClick={handleExportExcel}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#00D3CD] hover:bg-[#00bdb7] text-white text-xs font-semibold shadow-sm transition"
          >
            <FaDownload className="w-3.5 h-3.5" />
            <span>Export Excel</span>
          </button>
        </div>
      </div>

      {/* ── Summary KPI Cards (AbheePay Brand Tokens) ────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Total Volume */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Total Volume
            </span>
            <span className="p-2 rounded-lg bg-[#00D3CD]/10 text-[#00D3CD]">
              <FaLayerGroup className="w-4 h-4" />
            </span>
          </div>
          <p className="mt-2 text-xl font-bold text-gray-900">
            ₹{totalVolume.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <span className="text-[11px] text-gray-400 mt-0.5 block">
            Real platform throughput
          </span>
        </div>

        {/* Total Transactions */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Total Txns
            </span>
            <span className="p-2 rounded-lg bg-blue-50 text-blue-600">
              <FaSyncAlt className="w-4 h-4" />
            </span>
          </div>
          <p className="mt-2 text-xl font-bold text-gray-900">
            {totalTxns.toLocaleString()}
          </p>
          <span className="text-[11px] text-gray-400 mt-0.5 block">
            Completed transactions
          </span>
        </div>

        {/* Charges Collected */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Charges Collected
            </span>
            <span className="p-2 rounded-lg bg-[#00D3CD]/10 text-[#00D3CD]">
              <FaReceipt className="w-4 h-4" />
            </span>
          </div>
          <p className="mt-2 text-xl font-bold text-gray-900">
            ₹{totalCharges.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <span className="text-[11px] text-gray-400 mt-0.5 block">
            Gross platform fee revenue
          </span>
        </div>

        {/* Commission Distributed */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Commissions
            </span>
            <span className="p-2 rounded-lg bg-amber-50 text-amber-600">
              <FaCoins className="w-4 h-4" />
            </span>
          </div>
          <p className="mt-2 text-xl font-bold text-gray-900">
            ₹{totalCommission.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <span className="text-[11px] text-gray-400 mt-0.5 block">
            Distributed to partners
          </span>
        </div>

        {/* Net Margin / Profit */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Net Profit
            </span>
            <span className="p-2 rounded-lg bg-green-50 text-green-700">
              <FaCheckCircle className="w-4 h-4" />
            </span>
          </div>
          <p className="mt-2 text-xl font-bold text-green-700">
            ₹{totalNetProfit.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <span className="text-[11px] text-green-600 mt-0.5 block">
            Retained platform margin
          </span>
        </div>
      </div>

      {/* ── Category Pills & Search Filter ──────────────────────────────────── */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Category Pills */}
        <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-1 scrollbar-hide">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider mr-1">
            Category:
          </span>
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                selectedCategory === cat
                  ? "bg-[#00D3CD] text-white shadow-sm ring-1 ring-[#00D3CD]"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Live Search */}
        <div className="relative w-full md:w-72">
          <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-3.5 h-3.5" />
          <input
            type="text"
            placeholder="Search service name, key..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00D3CD] focus:border-[#00D3CD]"
          />
        </div>
      </div>

      {/* ── Service Table ────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 text-gray-500 font-semibold border-b border-gray-200 uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Service</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Volume (₹)</th>
                <th className="py-3 px-4 text-center">Txns / Success</th>
                <th className="py-3 px-4 text-right">Charges (₹)</th>
                <th className="py-3 px-4 text-right">Commission (₹)</th>
                <th className="py-3 px-4 text-right">Net Profit (₹)</th>
                <th className="py-3 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-gray-700">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-gray-400">
                    <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-[#00D3CD] border-t-transparent mb-2" />
                    <p className="text-xs">Loading real service statistics...</p>
                  </td>
                </tr>
              ) : displayRows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-gray-400">
                    <FaLayerGroup className="w-8 h-8 mx-auto text-gray-300 mb-2" />
                    <p className="text-sm font-semibold text-gray-600">No services found</p>
                    <p className="text-xs text-gray-400 mt-0.5">Try selecting another category or clearing search</p>
                  </td>
                </tr>
              ) : (
                displayRows.map((row) => (
                  <tr key={row.key} className="hover:bg-gray-50/80 transition-colors">
                    {/* Service Name */}
                    <td className="py-3 px-4">
                      <div className="font-semibold text-gray-900">{row.label}</div>
                      <div className="text-[11px] text-gray-400 font-mono mt-0.5">{row.key}</div>
                    </td>

                    {/* Category */}
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-700 font-medium text-[11px]">
                        {row.category}
                      </span>
                    </td>

                    {/* Status Pill (SKILL.md) */}
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                          row.isEnabled
                            ? "bg-green-50 text-green-700 border-green-200"
                            : "bg-red-50 text-red-700 border-red-200"
                        }`}
                      >
                        {row.isEnabled ? (
                          <FaCheckCircle className="w-3 h-3 text-green-600" />
                        ) : (
                          <FaTimesCircle className="w-3 h-3 text-red-600" />
                        )}
                        {row.isEnabled ? "Active" : "Disabled"}
                      </span>
                    </td>

                    {/* Volume */}
                    <td className="py-3 px-4 text-right font-bold text-gray-900">
                      ₹{row.volume.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>

                    {/* Txns & Success */}
                    <td className="py-3 px-4 text-center">
                      <div className="font-semibold text-gray-800">{row.txns} txns</div>
                      <div className="text-[10px] text-green-700 font-semibold">{row.successRate}% rate</div>
                    </td>

                    {/* Charges */}
                    <td className="py-3 px-4 text-right font-semibold text-gray-900">
                      ₹{row.charges.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>

                    {/* Commission */}
                    <td className="py-3 px-4 text-right text-gray-700">
                      ₹{row.commission.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>

                    {/* Net Profit */}
                    <td className="py-3 px-4 text-right font-bold text-green-700">
                      ₹{row.netProfit.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>

                    {/* Action */}
                    <td className="py-3 px-4 text-center">
                      <Link
                        to="/super-admin/set-charges"
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#00D3CD]/10 text-[#00a8a3] hover:bg-[#00D3CD]/20 font-semibold text-[11px] transition"
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
