import React, { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CreditCard,
  ArrowUpRight,
  ShieldCheck,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertCircle,
  Info,
  Layers,
  Sparkles,
  Zap,
  Building2,
  Clock,
  ArrowRight,
} from "lucide-react";
import { fetchMyAdminApplicableCharges } from "../api/rateSettingsApi";

const CATEGORIES = [
  { id: "pos", label: "POS Rate", icon: CreditCard, description: "Card, UPI & Terminal transaction charges" },
  { id: "pay", label: "Pay Rate", icon: ArrowUpRight, description: "Payout & Banking transfer slab rates" },
  { id: "cc-bill", label: "CC Bill Rate", icon: ShieldCheck, description: "BBPS Credit card bill payment charges" },
];

const formatCurrency = (val) => {
  if (val === null || val === undefined || val === "" || isNaN(Number(val))) return "—";
  const num = Number(val);
  return `₹${num.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
};

const formatSlabRange = (min, max) => {
  const minStr = min !== null && min !== undefined ? formatCurrency(min) : "₹0";
  const maxStr = max !== null && max !== undefined && Number(max) > 0 ? formatCurrency(max) : "Unlimited";
  return `${minStr} – ${maxStr}`;
};

const formatSettlement = (type) => {
  if (!type || type === "ANY" || type === "any") return "Standard Settlement";
  const lower = String(type).toLowerCase();
  if (lower === "today_settlement" || lower === "t0") return "Today Settlement (T0)";
  if (lower === "next_day_settlement" || lower === "t1") return "Next Day (T1)";
  return String(type);
};

export default function MyCharges() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("pos");
  const [searchTerm, setSearchTerm] = useState("");
  const [sourceFilter, setSourceFilter] = useState("ALL"); // ALL | override | default

  // Fetch only the authenticated Admin's applicable rates from backend
  const {
    data: apiResponse,
    isLoading,
    isError,
    error,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ["admin-my-applicable-charges"],
    queryFn: fetchMyAdminApplicableCharges,
    staleTime: 60 * 1000,
    retry: 1,
  });

  const responseData = apiResponse?.data || apiResponse || {};
  const adminInfo = apiResponse?.admin || null;

  // Resolved categorized lists from backend
  const posRates = useMemo(() => {
    const list = responseData.pos || responseData.categories?.pos || [];
    return Array.isArray(list) ? list : [];
  }, [responseData]);

  const payRates = useMemo(() => {
    const list = responseData.payout || responseData.pay || responseData.categories?.payout || [];
    return Array.isArray(list) ? list : [];
  }, [responseData]);

  const ccBillRates = useMemo(() => {
    const list = responseData.cc_bill || responseData.ccBill || responseData.categories?.cc_bill || [];
    return Array.isArray(list) ? list : [];
  }, [responseData]);

  // Active rate list
  const activeRateList = useMemo(() => {
    if (activeTab === "pos") return posRates;
    if (activeTab === "pay") return payRates;
    if (activeTab === "cc-bill") return ccBillRates;
    return [];
  }, [activeTab, posRates, payRates, ccBillRates]);

  // Filtered rows for currently active category
  const filteredRows = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return activeRateList.filter((row) => {
      // Source filter
      if (sourceFilter === "override" && !row.is_override) return false;
      if (sourceFilter === "default" && row.is_override) return false;

      // Text search
      if (!term) return true;
      const fieldsToSearch = [
        row.service_name,
        row.payment_mode,
        row.transfer_mode,
        row.card_brand,
        row.card_type,
        row.card_classification,
        row.company_name,
        row.description,
        row.rate_source,
        row.source_label,
      ].filter(Boolean);

      return fieldsToSearch.some((f) => String(f).toLowerCase().includes(term));
    });
  }, [activeRateList, searchTerm, sourceFilter]);

  // Counts summary
  const counts = useMemo(
    () => ({
      pos: posRates.length,
      pay: payRates.length,
      ccBill: ccBillRates.length,
    }),
    [posRates, payRates, ccBillRates],
  );

  const activeCategoryMeta = CATEGORIES.find((c) => c.id === activeTab);

  return (
    <div className="min-h-screen bg-slate-50/60 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Page Header */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3.5">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-[#00A39D] to-[#00D3CD] text-white shadow-sm">
                <Layers className="h-6 w-6" aria-hidden="true" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-bold tracking-tight text-slate-900">My Charges</h1>
                  <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
                    Effective Rates
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate-500">
                  Rates configured by your Super Admin
                </p>
              </div>
            </div>

            {/* Header Right Actions */}
            <div className="flex flex-wrap items-center gap-2.5">
              {adminInfo?.name && (
                <div className="hidden rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-600 md:block">
                  <span className="font-medium text-slate-900">{adminInfo.name}</span>
                  {adminInfo.username && <span className="ml-1 text-slate-400">({adminInfo.username})</span>}
                </div>
              )}
              <button
                type="button"
                onClick={() => {
                  queryClient.invalidateQueries({ queryKey: ["admin-my-applicable-charges"] });
                  refetch();
                }}
                disabled={isFetching}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-60"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin text-[#00A39D]" : "text-slate-500"}`} />
                <span>{isFetching ? "Refreshing..." : "Refresh Rates"}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Category Navigation Tabs */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            const count = counts[cat.id === "cc-bill" ? "ccBill" : cat.id] || 0;
            const isSelected = activeTab === cat.id;

            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => {
                  setActiveTab(cat.id);
                  setSearchTerm("");
                  setSourceFilter("ALL");
                }}
                className={`relative flex items-center justify-between rounded-2xl border p-4 text-left transition-all duration-200 ${
                  isSelected
                    ? "border-[#00D3CD] bg-white shadow-sm ring-2 ring-[#00D3CD]/20"
                    : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition ${
                      isSelected
                        ? "bg-[#00D3CD]/15 text-[#008c87]"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-slate-900">{cat.label}</h2>
                    <p className="line-clamp-1 text-xs text-slate-500">{cat.description}</p>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <span
                    className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      isSelected
                        ? "bg-[#00D3CD]/20 text-[#00736e]"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {isLoading ? "…" : `${count} rule${count !== 1 ? "s" : ""}`}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Content Box */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {/* Subheader / Filter Bar */}
          <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold text-slate-900">
                  {activeCategoryMeta?.label} Configuration
                </h3>
                <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                  Read Only
                </span>
              </div>
              <p className="mt-0.5 text-xs text-slate-500">
                Displaying only applicable charge rules configured by your Super Admin.
              </p>
            </div>

            {/* Search & Source Filter */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-[200px] flex-1 sm:w-64 sm:flex-none">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filter rules..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/70 py-1.5 pl-8 pr-3 text-xs text-slate-900 placeholder-slate-400 focus:border-[#00D3CD] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#00D3CD]/20"
                />
              </div>

              {/* Source Filter Select */}
              <select
                value={sourceFilter}
                onChange={(e) => setSourceFilter(e.target.value)}
                className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-1.5 text-xs font-medium text-slate-700 focus:border-[#00D3CD] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#00D3CD]/20"
              >
                <option value="ALL">All Sources</option>
                <option value="override">Admin Override Only</option>
                <option value="default">Inherited Default Only</option>
              </select>
            </div>
          </div>

          {/* Loading State */}
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="relative flex h-12 w-12 items-center justify-center">
                <div className="absolute h-12 w-12 animate-ping rounded-full bg-[#00D3CD]/20" />
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-[#00A39D]" />
              </div>
              <p className="mt-4 text-sm font-medium text-slate-700">Loading your applicable charges...</p>
              <p className="mt-1 text-xs text-slate-400">Fetching Super Admin configured rate records</p>
            </div>
          )}

          {/* Error State */}
          {!isLoading && isError && (
            <div className="p-8">
              <div className="mx-auto max-w-md rounded-2xl border border-rose-200 bg-rose-50/60 p-6 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-rose-100 text-rose-600">
                  <AlertCircle className="h-6 w-6" />
                </div>
                <h4 className="mt-3 text-sm font-semibold text-rose-900">Failed to Load Charges</h4>
                <p className="mt-1.5 text-xs text-rose-700">
                  {error?.message || "Could not retrieve applicable charges from backend. Please verify authentication or try again."}
                </p>
                <button
                  type="button"
                  onClick={() => refetch()}
                  className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-rose-700"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Retry Request
                </button>
              </div>
            </div>
          )}

          {/* Empty State */}
          {!isLoading && !isError && filteredRows.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                <Layers className="h-6 w-6" />
              </div>
              <h4 className="mt-3 text-sm font-semibold text-slate-800">
                No Applicable Rates Found
              </h4>
              <p className="mt-1 max-w-sm text-xs text-slate-500">
                {searchTerm || sourceFilter !== "ALL"
                  ? "No rules matched your search or source filters. Try resetting the filters."
                  : `No ${activeCategoryMeta?.label} rules configured by your Super Admin. Please contact your Super Admin to assign applicable charges.`}
              </p>
              {(searchTerm || sourceFilter !== "ALL") && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchTerm("");
                    setSourceFilter("ALL");
                  }}
                  className="mt-3 text-xs font-semibold text-[#008c87] hover:underline"
                >
                  Clear search & filters
                </button>
              )}
            </div>
          )}

          {/* Rate Tables */}
          {!isLoading && !isError && filteredRows.length > 0 && (
            <div className="overflow-x-auto">
              {activeTab === "pos" && (
                <table className="w-full text-left text-xs text-slate-600">
                  <thead className="border-b border-slate-100 bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    <tr>
                      <th scope="col" className="px-5 py-3.5">Service & Mode</th>
                      <th scope="col" className="px-4 py-3.5">Network & Type</th>
                      <th scope="col" className="px-4 py-3.5">Card Classification</th>
                      <th scope="col" className="px-4 py-3.5">Amount Slab</th>
                      <th scope="col" className="px-4 py-3.5">Settlement Type</th>
                      <th scope="col" className="px-4 py-3.5">Charge Rate</th>
                      <th scope="col" className="px-4 py-3.5">GST</th>
                      <th scope="col" className="px-5 py-3.5 text-right">Rate Source</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredRows.map((row) => {
                      const isCard = row.payment_mode === "CARD";
                      const isOverride = Boolean(row.is_override);

                      return (
                        <tr
                          key={`pos-${row.id}-${row.rule_key || row.service_name}`}
                          className="transition hover:bg-slate-50/60"
                        >
                          {/* Service & Mode */}
                          <td className="px-5 py-4 font-medium text-slate-900">
                            <div className="flex items-center gap-2">
                              <span
                                className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase ${
                                  row.payment_mode === "UPI"
                                    ? "bg-purple-50 text-purple-700 ring-1 ring-inset ring-purple-600/20"
                                    : "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-600/20"
                                }`}
                              >
                                {row.payment_mode || "CARD"}
                              </span>
                              <span>{row.service_name || "POS Charge"}</span>
                            </div>
                            {row.company_name && row.company_name !== "ANY" && (
                              <span className="mt-1 block text-[10px] text-slate-400">
                                Terminal Provider: <span className="uppercase text-slate-600">{row.company_name}</span>
                              </span>
                            )}
                          </td>

                          {/* Network & Card Type */}
                          <td className="px-4 py-4">
                            {isCard ? (
                              <div className="space-y-0.5">
                                <span className="font-medium text-slate-800">
                                  {row.card_brand || "ANY"}
                                </span>
                                <span className="block text-[11px] text-slate-500">
                                  {row.card_type || "ANY"}
                                </span>
                              </div>
                            ) : (
                              <span className="text-slate-400">N/A (UPI)</span>
                            )}
                          </td>

                          {/* Card Classification */}
                          <td className="px-4 py-4">
                            <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                              {row.card_classification || "ANY"}
                            </span>
                          </td>

                          {/* Amount Slab */}
                          <td className="px-4 py-4 font-medium text-slate-700">
                            {formatSlabRange(row.min_amount, row.max_amount)}
                          </td>

                          {/* Settlement Type */}
                          <td className="px-4 py-4 text-slate-600">
                            <span className="inline-flex items-center gap-1">
                              <Clock className="h-3 w-3 text-slate-400" />
                              {formatSettlement(row.settlement_type)}
                            </span>
                          </td>

                          {/* Charge Rate */}
                          <td className="px-4 py-4 font-semibold text-slate-900">
                            {row.charge_percent !== null && Number(row.charge_percent) > 0 ? (
                              <span className="text-[#008782]">{row.charge_percent}%</span>
                            ) : row.charge_flat !== null && Number(row.charge_flat) > 0 ? (
                              <span className="text-[#008782]">Flat {formatCurrency(row.charge_flat)}</span>
                            ) : (
                              <span className="text-slate-400">0.00%</span>
                            )}
                            {Number(row.charge_flat) > 0 && Number(row.charge_percent) > 0 && (
                              <span className="ml-1 text-[11px] font-normal text-slate-500">
                                + Flat {formatCurrency(row.charge_flat)}
                              </span>
                            )}
                          </td>

                          {/* GST */}
                          <td className="px-4 py-4">
                            {row.gst_required ? (
                              <span className="rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 ring-1 ring-inset ring-amber-600/20">
                                {row.gst_percent ? `${row.gst_percent}%` : "18%"}
                              </span>
                            ) : (
                              <span className="text-slate-400">Exempt</span>
                            )}
                          </td>

                          {/* Rate Source */}
                          <td className="px-5 py-4 text-right">
                            {isOverride ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2.5 py-1 text-[11px] font-semibold text-violet-700 ring-1 ring-inset ring-violet-700/20">
                                <Sparkles className="h-3 w-3 text-violet-600" />
                                Admin Override
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600">
                                <CheckCircle2 className="h-3 w-3 text-slate-400" />
                                Inherited Default
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}

              {activeTab === "pay" && (
                <table className="w-full text-left text-xs text-slate-600">
                  <thead className="border-b border-slate-100 bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    <tr>
                      <th scope="col" className="px-5 py-3.5">Service Description</th>
                      <th scope="col" className="px-4 py-3.5">Transfer Mode</th>
                      <th scope="col" className="px-4 py-3.5">Amount Slab Range</th>
                      <th scope="col" className="px-4 py-3.5">Applicable Charge</th>
                      <th scope="col" className="px-4 py-3.5">GST</th>
                      <th scope="col" className="px-4 py-3.5">Settlement Speed</th>
                      <th scope="col" className="px-5 py-3.5 text-right">Rate Source</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredRows.map((row) => {
                      const isOverride = Boolean(row.is_override);
                      const isFlat = String(row.rate_type).toLowerCase() === "flat";

                      return (
                        <tr
                          key={`pay-${row.id}-${row.slab_key || row.from_amount}`}
                          className="transition hover:bg-slate-50/60"
                        >
                          {/* Service Description */}
                          <td className="px-5 py-4 font-medium text-slate-900">
                            <div className="flex items-center gap-2">
                              <span className="inline-flex items-center rounded-md bg-indigo-50 px-2 py-0.5 text-[10px] font-bold uppercase text-indigo-700 ring-1 ring-inset ring-indigo-600/20">
                                Payout
                              </span>
                              <span>{row.service_name || "Payout Bank Transfer"}</span>
                            </div>
                            {row.description && row.description !== row.service_name && (
                              <span className="mt-0.5 block text-[11px] text-slate-400">
                                {row.description}
                              </span>
                            )}
                          </td>

                          {/* Transfer Mode */}
                          <td className="px-4 py-4">
                            <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                              {row.payment_mode || row.transfer_mode || "IMPS / NEFT / RTGS"}
                            </span>
                          </td>

                          {/* Amount Slab */}
                          <td className="px-4 py-4 font-medium text-slate-800">
                            {formatSlabRange(row.from_amount, row.to_amount)}
                          </td>

                          {/* Applicable Charge */}
                          <td className="px-4 py-4 font-semibold text-slate-900">
                            <span className="text-[#008782]">
                              {isFlat ? `Flat ${formatCurrency(row.rate)}` : `${row.rate}%`}
                            </span>
                          </td>

                          {/* GST */}
                          <td className="px-4 py-4">
                            <span className="text-slate-400">Included / Exempt</span>
                          </td>

                          {/* Settlement Speed */}
                          <td className="px-4 py-4 text-slate-600">
                            <span className="inline-flex items-center gap-1 font-medium text-emerald-700">
                              <Zap className="h-3 w-3 text-emerald-500" />
                              {row.settlement_type || "Instant (24x7)"}
                            </span>
                          </td>

                          {/* Rate Source */}
                          <td className="px-5 py-4 text-right">
                            {isOverride ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2.5 py-1 text-[11px] font-semibold text-violet-700 ring-1 ring-inset ring-violet-700/20">
                                <Sparkles className="h-3 w-3 text-violet-600" />
                                Admin Override
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600">
                                <CheckCircle2 className="h-3 w-3 text-slate-400" />
                                Inherited Default
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}

              {activeTab === "cc-bill" && (
                <table className="w-full text-left text-xs text-slate-600">
                  <thead className="border-b border-slate-100 bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    <tr>
                      <th scope="col" className="px-5 py-3.5">Service</th>
                      <th scope="col" className="px-4 py-3.5">Bill Payment Method</th>
                      <th scope="col" className="px-4 py-3.5">Amount Slab Range</th>
                      <th scope="col" className="px-4 py-3.5">Applicable Charge</th>
                      <th scope="col" className="px-4 py-3.5">GST</th>
                      <th scope="col" className="px-4 py-3.5">Settlement Channel</th>
                      <th scope="col" className="px-5 py-3.5 text-right">Rate Source</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredRows.map((row) => {
                      const isOverride = Boolean(row.is_override);
                      const isFlat = String(row.rate_type).toLowerCase() === "flat";

                      return (
                        <tr
                          key={`cc-${row.id}-${row.slab_key || row.from_amount}`}
                          className="transition hover:bg-slate-50/60"
                        >
                          {/* Service */}
                          <td className="px-5 py-4 font-medium text-slate-900">
                            <div className="flex items-center gap-2">
                              <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
                                BBPS
                              </span>
                              <span>{row.service_name || "BBPS Credit Card Bill Payment"}</span>
                            </div>
                            {row.description && row.description !== row.service_name && (
                              <span className="mt-0.5 block text-[11px] text-slate-400">
                                {row.description}
                              </span>
                            )}
                          </td>

                          {/* Method */}
                          <td className="px-4 py-4">
                            <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                              BBPS CC Bill
                            </span>
                          </td>

                          {/* Amount Slab */}
                          <td className="px-4 py-4 font-medium text-slate-800">
                            {formatSlabRange(row.from_amount, row.to_amount)}
                          </td>

                          {/* Applicable Charge */}
                          <td className="px-4 py-4 font-semibold text-slate-900">
                            <span className="text-[#008782]">
                              {isFlat ? `Flat ${formatCurrency(row.rate)}` : `${row.rate}%`}
                            </span>
                          </td>

                          {/* GST */}
                          <td className="px-4 py-4">
                            <span className="text-slate-400">Included / Exempt</span>
                          </td>

                          {/* Settlement Channel */}
                          <td className="px-4 py-4 text-slate-600">
                            <span className="inline-flex items-center gap-1 font-medium text-slate-700">
                              <ShieldCheck className="h-3 w-3 text-emerald-500" />
                              {row.settlement_type || "Standard BBPS"}
                            </span>
                          </td>

                          {/* Rate Source */}
                          <td className="px-5 py-4 text-right">
                            {isOverride ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2.5 py-1 text-[11px] font-semibold text-violet-700 ring-1 ring-inset ring-violet-700/20">
                                <Sparkles className="h-3 w-3 text-violet-600" />
                                Admin Override
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600">
                                <CheckCircle2 className="h-3 w-3 text-slate-400" />
                                Inherited Default
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* Footer Information Legend */}
          <div className="border-t border-slate-100 bg-slate-50/50 p-4 sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between text-xs text-slate-500">
              <div className="flex flex-wrap items-center gap-4">
                <span className="font-semibold text-slate-700">Source Legend:</span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="inline-flex h-2 w-2 rounded-full bg-violet-600" />
                  <span className="font-medium text-slate-800">Admin Override:</span> Rate configured specifically for your Admin account by Super Admin
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="inline-flex h-2 w-2 rounded-full bg-slate-400" />
                  <span className="font-medium text-slate-800">Inherited Default:</span> Standard platform default rate
                </span>
              </div>
              <div className="text-slate-400 text-[11px]">
                Showing {filteredRows.length} of {activeRateList.length} rules
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}