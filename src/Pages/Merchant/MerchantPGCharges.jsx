import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import Table from '../../components/Table';
import Loader from '../../components/Loader';
import { fetchPgChargeRules } from '../../api/pgRateSettingsApi';

const DEFAULT_SETTLEMENT_FILTER = 'all';

const formatPercent = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? `${numeric.toFixed(2)}%` : 'N/A';
};

const normalizeSettlementValue = (value) => String(value ?? '').trim().toLowerCase();

const formatSettlementLabel = (value) => {
  const normalizedValue = normalizeSettlementValue(value);
  if (normalizedValue === 'today_settlement') return 'T+0';
  if (normalizedValue === 'next_day_settlement') return 'T+1';
  return value || 'Any';
};

const formatSlabRange = (min, max) => {
  const minVal = Number(min || 0);
  const minStr = `₹${minVal.toLocaleString('en-IN')}`;
  if (max !== null && max !== undefined && max !== '' && Number(max) > 0) {
    return `${minStr} – ₹${Number(max).toLocaleString('en-IN')}`;
  }
  return `${minStr} – Unlimited`;
};

const pgColumns = [
  { header: 'Method', key: 'method', render: (value) => value || 'N/A' },
  { header: 'Network', key: 'network', render: (value) => value || 'ALL' },
  { header: 'Card Type', key: 'card_type', render: (value) => value || 'N/A' },
  {
    header: 'Classification Sub Type',
    key: 'sub_type',
    render: (value) => value || 'any',
  },
  {
    header: 'Settlement',
    key: 'settlement_type',
    render: (value) => formatSettlementLabel(value),
  },
  {
    header: 'Slab Rate',
    key: 'amount_slab',
    render: (_, row) => (
      <span className="font-semibold text-gray-800">
        {formatSlabRange(row?.min_amount, row?.max_amount)}
      </span>
    ),
  },
  {
    header: 'Rate (%)',
    key: 'rate_percentage',
    render: (value) => formatPercent(value),
  },
  {
    header: 'Flat Rate (₹)',
    key: 'charge_flat',
    render: (value) =>
      value !== null && value !== undefined && Number(value) > 0
        ? `₹${Number(value).toFixed(2)}`
        : '₹0.00',
  },
  {
    header: 'GST (%)',
    key: 'gst_rate',
    render: (value) => (value === null || value === undefined ? '-' : formatPercent(value)),
  },
];

const MerchantPGChargeMobileCards = ({ rows }) => (
  <div className="space-y-3 md:hidden">
    {rows.map((row, index) => (
      <div
        key={`${row.method || 'method'}-${row.network || 'network'}-${row.card_type || 'card'}-${row.sub_type || 'any'}-${row.min_amount || '0'}-${row.max_amount || 'inf'}-${index}`}
        className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm"
      >
        <div className="grid grid-cols-3 gap-2.5">
          <div className="rounded-xl bg-slate-50 px-2.5 py-3 text-center text-[13px] font-semibold text-gray-900">
            {row.method || 'N/A'}
          </div>
          <div className="rounded-xl bg-slate-50 px-2.5 py-3 text-center text-[13px] font-semibold text-gray-900">
            {row.network || 'ALL'}
          </div>
          <div className="rounded-xl bg-slate-50 px-2.5 py-3 text-center text-[13px] font-semibold text-gray-900">
            {row.card_type || 'N/A'}
          </div>
          <div className="rounded-xl border border-gray-200 bg-white px-2.5 py-3 text-center">
            <p className="text-[10px] font-medium uppercase tracking-wide text-gray-500">Sub Type</p>
            <p className="mt-1 text-[13px] font-semibold text-gray-900">
              {row.sub_type || 'any'}
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white px-2.5 py-3 text-center">
            <p className="text-[10px] font-medium uppercase tracking-wide text-gray-500">Settlement</p>
            <p className="mt-1 text-[13px] font-semibold text-gray-900">
              {formatSettlementLabel(row.settlement_type)}
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white px-2.5 py-3 text-center">
            <p className="text-[10px] font-medium uppercase tracking-wide text-gray-500">Slab Rate</p>
            <p className="mt-1 text-[12px] font-semibold text-gray-900">
              {formatSlabRange(row.min_amount, row.max_amount)}
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white px-2.5 py-3 text-center">
            <p className="text-[10px] font-medium uppercase tracking-wide text-gray-500">Rate</p>
            <p className="mt-1 text-[13px] font-semibold text-gray-900">
              {formatPercent(row.rate_percentage)}
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white px-2.5 py-3 text-center">
            <p className="text-[10px] font-medium uppercase tracking-wide text-gray-500">Flat Rate</p>
            <p className="mt-1 text-[13px] font-semibold text-gray-900">
              {row.charge_flat !== null && row.charge_flat !== undefined && Number(row.charge_flat) > 0
                ? `₹${Number(row.charge_flat).toFixed(2)}`
                : '₹0.00'}
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white px-2.5 py-3 text-center">
            <p className="text-[10px] font-medium uppercase tracking-wide text-gray-500">GST</p>
            <p className="mt-1 text-[13px] font-semibold text-gray-900">
              {row.gst_rate === null || row.gst_rate === undefined ? '-' : formatPercent(row.gst_rate)}
            </p>
          </div>
        </div>
      </div>
    ))}
  </div>
);

const mapPgRuleToRow = (rule) => ({
  id: rule?.id,
  method: rule?.payment_mode || rule?.method || 'N/A',
  network: rule?.card_brand || rule?.network || 'ALL',
  card_type: rule?.card_type || 'N/A',
  sub_type: rule?.sub_type || rule?.card_classification || 'any',
  card_classification: rule?.card_classification || rule?.sub_type || 'any',
  settlement_type: rule?.settlement_type || null,
  gst_rate: rule?.gst_required ? Number(rule?.gst_percent ?? 18) : null,
  rate_percentage: Number(rule?.charge_percent ?? 0),
  min_amount: rule?.min_amount !== null && rule?.min_amount !== undefined ? Number(rule.min_amount) : 0,
  max_amount: rule?.max_amount !== null && rule?.max_amount !== undefined ? Number(rule.max_amount) : null,
  charge_flat: Number(rule?.charge_flat ?? 0),
});

const MerchantPGCharges = ({ currentUser }) => {
  const [settlementFilter, setSettlementFilter] = useState(DEFAULT_SETTLEMENT_FILTER);

  const {
    data: pgRulesData = [],
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ['merchant-pg-charges'],
    queryFn: async () => {
      const response = await fetchPgChargeRules().catch(() => []);
      const list = Array.isArray(response) ? response : (response?.data || []);
      return list.map(mapPgRuleToRow);
    },
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });

  if (isLoading) {
    return <div className="p-4"><Loader /></div>;
  }

  if (isError) {
    return <div className="p-4 text-rose-600">Error loading PG charges: {error?.message}</div>;
  }

  const filteredRows = pgRulesData.filter((row) => {
    if (settlementFilter === 'all') return true;
    return normalizeSettlementValue(row?.settlement_type) === settlementFilter;
  });

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div>
        <Link
          to="/merchant/charges"
          className="text-sm text-[#008c87] hover:underline font-medium inline-flex items-center gap-1 mb-2"
        >
          &larr; Back to Charges
        </Link>
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900">PG Transaction Charges</h1>
        <p className="text-sm text-gray-600 mt-1">
          Applicable Payment Gateway transaction charges and MDR matrix for your merchant account.
        </p>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col gap-2 md:flex-row md:items-end">
        <div className="w-full md:w-56">
          <label className="block text-sm font-medium text-gray-700 mb-1">Settlement</label>
          <select
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-[#00D3CD] focus:border-[#00D3CD]"
            value={settlementFilter}
            onChange={(e) => setSettlementFilter(e.target.value)}
          >
            <option value="all">All Settlements</option>
            <option value="today_settlement">Today Settlement (T+0)</option>
            <option value="next_day_settlement">Next Day Settlement (T+1)</option>
          </select>
        </div>
      </div>

      {/* Table & Cards */}
      <div className="w-full overflow-x-auto bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        {filteredRows.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-500">
            No PG charges found for the selected filter.
          </div>
        ) : (
          <>
            <MerchantPGChargeMobileCards rows={filteredRows} />
            <div className="hidden md:block">
              <Table columns={pgColumns} data={filteredRows} />
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default MerchantPGCharges;
