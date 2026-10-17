import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CreditCard,
  Building2,
  ArrowUpRight,
  ShieldCheck,
  RefreshCw,
  Search,
  Lock,
  Info,
  Layers,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { fetchMyAdminApplicableCharges } from '../../api/rateSettingsApi';

const CATEGORIES = [
  { id: 'pos', label: 'POS Transactions', icon: CreditCard, description: 'Card & UPI terminal transaction rates' },
  { id: 'rental', label: 'POS Rental', icon: Building2, description: 'Monthly POS machine terminal rental' },
  { id: 'cc-bill', label: 'CC Bill Pay', icon: ShieldCheck, description: 'BBPS Credit Card Bill payment fees' },
  { id: 'pay', label: 'Payout Rates', icon: ArrowUpRight, description: 'Banking & Payout transfer slab fees' },
];

const formatCurrency = (val) => {
  if (val === null || val === undefined || val === '' || isNaN(Number(val))) return '—';
  const num = Number(val);
  return `₹${num.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
};

const formatSlabRange = (min, max) => {
  const minStr = min !== null && min !== undefined ? formatCurrency(min) : '₹0';
  const maxStr = max !== null && max !== undefined && Number(max) > 0 ? formatCurrency(max) : 'Unlimited';
  return `${minStr} – ${maxStr}`;
};

const formatSettlement = (type) => {
  if (!type || type === 'ANY' || type === 'any') return 'Standard (T0 / T1)';
  const lower = String(type).toLowerCase();
  if (lower === 'today_settlement' || lower === 't0') return 'Today Settlement (T0)';
  if (lower === 'next_day_settlement' || lower === 't1') return 'Next Day (T1)';
  return String(type);
};

export default function InheritedRatesView({
  uplineRoleName = 'Upline',
  currentRoleName = 'Your Account',
}) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('pos');
  const [searchTerm, setSearchTerm] = useState('');

  const {
    data: apiResponse,
    isLoading,
    isFetching,
    refetch,
    isError,
    error,
  } = useQuery({
    queryKey: ['my-applicable-charges', currentRoleName],
    queryFn: fetchMyAdminApplicableCharges,
    staleTime: 60 * 1000,
    retry: 1,
  });

  const responseData = apiResponse?.data || apiResponse || {};

  const posRates = useMemo(() => {
    const list = responseData.pos || responseData.categories?.pos || [];
    return Array.isArray(list) ? list : [];
  }, [responseData]);

  const rentalRates = useMemo(() => {
    const list = responseData.rental || responseData.categories?.rental || [];
    if (Array.isArray(list)) return list;
    if (responseData.rental && typeof responseData.rental === 'object') return [responseData.rental];
    return [];
  }, [responseData]);

  const payRates = useMemo(() => {
    const list = responseData.payout || responseData.pay || responseData.categories?.payout || [];
    return Array.isArray(list) ? list : [];
  }, [responseData]);

  const ccBillRates = useMemo(() => {
    const list = responseData.cc_bill || responseData.ccBill || responseData.categories?.cc_bill || [];
    return Array.isArray(list) ? list : [];
  }, [responseData]);

  const activeRateList = useMemo(() => {
    if (activeTab === 'pos') return posRates;
    if (activeTab === 'rental') return rentalRates;
    if (activeTab === 'pay') return payRates;
    if (activeTab === 'cc-bill') return ccBillRates;
    return [];
  }, [activeTab, posRates, rentalRates, payRates, ccBillRates]);

  const filteredRows = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return activeRateList;
    return activeRateList.filter((row) => {
      const fields = [
        row.service_name,
        row.payment_mode,
        row.transfer_mode,
        row.card_brand,
        row.card_type,
        row.card_classification,
        row.company_name,
        row.description,
        row.settlement_type,
        row.rate_source,
      ].filter(Boolean);
      return fields.some((f) => String(f).toLowerCase().includes(term));
    });
  }, [activeRateList, searchTerm]);

  const counts = useMemo(
    () => ({
      pos: posRates.length,
      rental: rentalRates.length,
      pay: payRates.length,
      ccBill: ccBillRates.length,
    }),
    [posRates, rentalRates, payRates, ccBillRates]
  );

  return (
    <div className="space-y-6">
      {/* Informational Header Card */}
      <div className="rounded-2xl border border-slate-200 bg-gradient-to-r from-slate-50 via-white to-slate-50 p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3.5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white shadow-sm">
              <Lock className="h-6 w-6 text-amber-400" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-bold tracking-tight text-slate-900">
                  Inherited Rates
                </h2>
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-800 ring-1 ring-inset ring-amber-600/20">
                  <Lock className="h-3 w-3" />
                  Read-Only (Upline: {uplineRoleName})
                </span>
              </div>
              <p className="mt-1 text-sm text-slate-500">
                These rates were configured by your upline ({uplineRoleName}) for {currentRoleName}. These represent your base cost price and cannot be modified.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              queryClient.invalidateQueries({ queryKey: ['my-applicable-charges', currentRoleName] });
              refetch();
            }}
            disabled={isFetching}
            className="inline-flex items-center gap-1.5 self-start sm:self-auto rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-60"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin text-[#00A39D]' : 'text-slate-500'}`} />
            <span>{isFetching ? 'Refreshing...' : 'Refresh Inherited Rates'}</span>
          </button>
        </div>

        {/* Notice Alert */}
        <div className="mt-4 flex items-center gap-2 rounded-xl bg-blue-50/70 border border-blue-200/60 px-4 py-2.5 text-xs text-blue-800">
          <Info className="h-4 w-4 shrink-0 text-blue-600" />
          <span>
            <strong>Margin Guideline:</strong> When setting rates for your downline in the <em>Set Downline Rates</em> tab, ensure your downline rates are equal to or higher than these inherited rates to protect your margin.
          </span>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          const count = counts[cat.id === 'cc-bill' ? 'ccBill' : cat.id] || 0;
          const isSelected = activeTab === cat.id;

          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => {
                setActiveTab(cat.id);
                setSearchTerm('');
              }}
              className={`flex items-center justify-between rounded-2xl border p-4 text-left transition-all ${
                isSelected
                  ? 'border-[#00D3CD] bg-white shadow-sm ring-2 ring-[#00D3CD]/20'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50'
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition ${
                    isSelected ? 'bg-[#00D3CD]/15 text-[#008c87]' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">{cat.label}</h3>
                  <p className="line-clamp-1 text-xs text-slate-500">{cat.description}</p>
                </div>
              </div>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  isSelected ? 'bg-[#00D3CD]/20 text-[#00736e]' : 'bg-slate-100 text-slate-600'
                }`}
              >
                {isLoading ? '…' : `${count} rule${count !== 1 ? 's' : ''}`}
              </span>
            </button>
          );
        })}
      </div>

      {/* Rates Table Card */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {/* Table Filter / Search Header */}
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-slate-900">
              {CATEGORIES.find((c) => c.id === activeTab)?.label} (Inherited from {uplineRoleName})
            </h3>
            <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
              {filteredRows.length} item{filteredRows.length !== 1 ? 's' : ''}
            </span>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search inherited rates..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-4 text-xs text-slate-800 placeholder-slate-400 transition focus:border-[#00D3CD] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#00D3CD]/20"
            />
          </div>
        </div>

        {/* Content Table */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center p-12 text-slate-500">
            <RefreshCw className="h-8 w-8 animate-spin text-[#00A39D] mb-3" />
            <p className="text-sm font-medium">Loading inherited rates from {uplineRoleName}...</p>
          </div>
        ) : isError ? (
          <div className="p-8 text-center text-rose-600">
            <AlertTriangle className="mx-auto h-8 w-8 text-rose-500 mb-2" />
            <p className="font-semibold">{error?.message || 'Failed to load inherited rates.'}</p>
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <Layers className="mx-auto h-10 w-10 text-slate-300 mb-2" />
            <p className="text-sm font-medium text-slate-700">No inherited rules found for this category.</p>
            <p className="text-xs text-slate-400 mt-1">
              Your upline ({uplineRoleName}) has not configured custom overrides for this category yet (or default rates apply).
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            {activeTab === 'pos' && (
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Payment Method</th>
                    <th className="px-4 py-3">Card Network</th>
                    <th className="px-4 py-3">Card Type</th>
                    <th className="px-4 py-3">Classification</th>
                    <th className="px-4 py-3">Settlement</th>
                    <th className="px-4 py-3">Slab Range</th>
                    <th className="px-4 py-3">Your Cost (Fee)</th>
                    <th className="px-4 py-3">GST Applied</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {filteredRows.map((row, idx) => (
                    <tr key={row.id || idx} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-4 py-3 font-semibold text-slate-900">{row.payment_mode || row.method || 'CARD'}</td>
                      <td className="px-4 py-3">{row.card_brand || row.network || 'ALL'}</td>
                      <td className="px-4 py-3">{row.card_type || 'ANY'}</td>
                      <td className="px-4 py-3">{row.card_classification || 'ANY'}</td>
                      <td className="px-4 py-3">{formatSettlement(row.settlement_type)}</td>
                      <td className="px-4 py-3">{formatSlabRange(row.min_amount, row.max_amount)}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 border border-emerald-200/60">
                          {row.charge_type === 'flat' ? `₹${row.charge_value || 0}` : `${row.charge_value || row.rate || 0}%`}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {row.gst_required ? (
                          <span className="text-emerald-700 font-semibold">Yes ({row.gst_percent || 18}%)</span>
                        ) : (
                          <span className="text-slate-400">No</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {activeTab === 'rental' && (
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Terminal Type / Description</th>
                    <th className="px-4 py-3">Monthly Rental (Base Cost)</th>
                    <th className="px-4 py-3">Billing Cycle</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {filteredRows.map((row, idx) => (
                    <tr key={row.id || idx} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-4 py-3 font-semibold text-slate-900">
                        {row.description || row.machine_type || 'Standard POS Terminal'}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 border border-emerald-200/60">
                          {formatCurrency(row.amount || row.franchise_rate || row.rental_amount || row.merchant_rate)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600">Monthly</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                          <CheckCircle2 className="h-3 w-3" />
                          Active
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {activeTab === 'cc-bill' && (
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Service Name</th>
                    <th className="px-4 py-3">Transaction Slab Range</th>
                    <th className="px-4 py-3">Base Cost Fee</th>
                    <th className="px-4 py-3">Fee Type</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {filteredRows.map((row, idx) => (
                    <tr key={row.id || idx} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-4 py-3 font-semibold text-slate-900">{row.service_name || 'BBPS CC Bill Pay'}</td>
                      <td className="px-4 py-3">{formatSlabRange(row.from_amount || row.min_amount, row.to_amount || row.max_amount)}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 border border-emerald-200/60">
                          {row.rate_type === 'flat' ? `₹${row.rate || 0}` : `${row.rate || 0}%`}
                        </span>
                      </td>
                      <td className="px-4 py-3 uppercase text-slate-600 font-semibold">{row.rate_type || 'flat'}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                          <CheckCircle2 className="h-3 w-3" />
                          Active
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {activeTab === 'pay' && (
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Payout Transfer Mode</th>
                    <th className="px-4 py-3">Slab Range</th>
                    <th className="px-4 py-3">Base Cost Fee</th>
                    <th className="px-4 py-3">Fee Type</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {filteredRows.map((row, idx) => (
                    <tr key={row.id || idx} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-4 py-3 font-semibold text-slate-900">{row.transfer_mode || row.service_name || 'IMPS / NEFT / RTGS'}</td>
                      <td className="px-4 py-3">{formatSlabRange(row.from_amount || row.min_amount, row.to_amount || row.max_amount)}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 border border-emerald-200/60">
                          {row.rate_type === 'percent' ? `${row.rate || 0}%` : `₹${row.rate || 0}`}
                        </span>
                      </td>
                      <td className="px-4 py-3 uppercase text-slate-600 font-semibold">{row.rate_type || 'flat'}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                          <CheckCircle2 className="h-3 w-3" />
                          Active
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
