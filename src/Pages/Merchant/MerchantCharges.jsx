import React from 'react';
import { useQuery } from '@tanstack/react-query';
import Table from '../../components/Table';
import Loader from '../../components/Loader';
import { getAuthenticatedMerchantChargeRules, getFranchiseAdminChargeRules } from '../../api/rateSettingsApi';

const DEFAULT_SETTLEMENT_FILTER = 'today_settlement';

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

const merchantColumns = [
  { header: 'Method', key: 'method', render: (value) => value || 'N/A' },
  { header: 'Network', key: 'network', render: (value) => value || 'ALL' },
  { header: 'Card Type', key: 'card_type', render: (value) => value || 'N/A' },
  {
    header: 'Classification',
    key: 'card_classification',
    render: (value) => value || 'ANY'
  },
  {
    header: 'Settlement',
    key: 'settlement_type',
    render: (value) => formatSettlementLabel(value)
  },
  {
    header: 'GST (%)',
    key: 'gst_rate',
    render: (value) => (value === null || value === undefined ? '-' : formatPercent(value))
  },
  {
    header: 'Rate (%)',
    key: 'rate_percentage',
    render: (value) => formatPercent(value)
  }
];

const legacyColumns = [
  { header: 'Charge Type', key: 'charge_type_category', render: (value) => value || 'N/A' },
  { header: 'Min Amount', key: 'min_amount', render: (value) => value ?? '0' },
  { header: 'Max Amount', key: 'max_amount', render: (value) => value ?? 'Infinity' },
  { header: 'Flat Fee', key: 'flat_fee', render: (value) => (value ? `Rs ${value}` : 'N/A') },
  { header: 'Percent Fee', key: 'percent_fee', render: (value) => (value ? `${value}%` : 'N/A') },
  { header: 'Created By', key: 'created_by', render: (value) => value || 'N/A' },
  {
    header: 'Created At',
    key: 'createdAt',
    render: (value) => (value ? new Date(value).toLocaleString() : 'N/A')
  }
];

const normalizeLegacyRows = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (payload && typeof payload === 'object') return [payload];
  return [];
};

const MerchantChargeMobileCards = ({ rows }) => (
  <div className="space-y-3 md:hidden">
    {rows.map((row, index) => (
      <div
        key={`${row.method || 'method'}-${row.network || 'network'}-${row.card_type || 'card'}-${index}`}
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
            <p className="text-[10px] font-medium uppercase tracking-wide text-gray-500">Classification</p>
            <p className="mt-1 text-[13px] font-semibold text-gray-900">
              {row.card_classification || 'ANY'}
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white px-2.5 py-3 text-center">
            <p className="text-[10px] font-medium uppercase tracking-wide text-gray-500">Settlement</p>
            <p className="mt-1 text-[13px] font-semibold text-gray-900">
              {formatSettlementLabel(row.settlement_type)}
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white px-2.5 py-3 text-center">
            <p className="text-[10px] font-medium uppercase tracking-wide text-gray-500">GST</p>
            <p className="mt-1 text-[13px] font-semibold text-gray-900">
              {row.gst_rate === null || row.gst_rate === undefined ? '-' : formatPercent(row.gst_rate)}
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white px-2.5 py-3 text-center">
            <p className="text-[10px] font-medium uppercase tracking-wide text-gray-500">Rate</p>
            <p className="mt-1 text-[13px] font-semibold text-gray-900">
              {formatPercent(row.rate_percentage)}
            </p>
          </div>
        </div>
      </div>
    ))}
  </div>
);

const mapAdminChargeRuleToMerchantRow = (rule) => ({
  id: rule?.id,
  method: rule?.payment_mode || 'N/A',
  network: rule?.card_brand || 'ALL',
  card_type: rule?.card_type || 'N/A',
  card_classification: rule?.card_classification || 'ANY',
  settlement_type: rule?.settlement_type || null,
  gst_rate: rule?.gst_required ? Number(rule?.gst_percent ?? 0) : null,
  rate_percentage: Number(rule?.charge_percent ?? 0)
});

const MerchantCharges = ({ currentUser }) => {
  if (!currentUser) {
    return <Loader />;
  }

  const normalizedRole = String(currentUser.role || '').trim().toLowerCase();
  const isMerchantUser = normalizedRole === 'merchant';
  const isFranchiseUser = normalizedRole === 'franchise' || normalizedRole === 'franchaise';
  const userId = currentUser.id || currentUser.merchant_id || null;
  const franchiseId =
    currentUser.franchise_id || currentUser.franchaise_id || currentUser.franchiseId || currentUser.id;

  const [activeTab, setActiveTab] = React.useState(
    isFranchiseUser ? 'posCharges' : 'chargeSet'
  );
  const [posChargeFilters, setPosChargeFilters] = React.useState({
    page: 1,
    limit: 20,
    is_active: 'true'
  });
  const [settlementFilter, setSettlementFilter] = React.useState(DEFAULT_SETTLEMENT_FILTER);

  const {
    data: chargesData = [],
    isLoading,
    isError,
    error
  } = useQuery({
    queryKey: ['charges-page', 'admin-global', activeTab],
    queryFn: async () => {
      const rules = await getAuthenticatedMerchantChargeRules(null, { is_active: 'true' });
      return (Array.isArray(rules) ? rules : []).map(mapAdminChargeRuleToMerchantRow);
    },
    enabled: isMerchantUser || (isFranchiseUser && activeTab === 'chargeSet'),
    refetchOnMount: 'always',
    refetchOnWindowFocus: true
  });

  const {
    data: posChargeData = [],
    isLoading: isPosChargesLoading,
    isError: isPosChargesError,
    error: posChargesError
  } = useQuery({
    queryKey: ['franchise-pos-charge-rules', franchiseId, posChargeFilters],
    queryFn: () => getFranchiseAdminChargeRules(franchiseId, posChargeFilters),
    enabled: isFranchiseUser && activeTab === 'posCharges' && Boolean(franchiseId),
    keepPreviousData: true,
    refetchOnWindowFocus: false
  });

  const posChargeRows = Array.isArray(posChargeData)
    ? posChargeData
    : Array.isArray(posChargeData?.data)
      ? posChargeData.data
      : [];
  const filteredPosChargeRows = posChargeRows.filter((row) => (
    settlementFilter === 'all'
      ? true
      : normalizeSettlementValue(row?.settlement_type) === settlementFilter
  ));

  const renderPosCharges = () => {
    if (isPosChargesLoading) {
      return <div className="p-4">Loading POS charge rules...</div>;
    }

    if (isPosChargesError) {
      return <div>Error loading POS charges: {posChargesError?.message}</div>;
    }

    if (filteredPosChargeRows.length === 0) {
      return <div className="p-4 text-sm text-gray-500">No admin POS charge rules found.</div>;
    }

    const posChargeColumns = [
      { header: 'Payment Mode', key: 'payment_mode', render: (value) => value || '-' },
      { header: 'Card Type', key: 'card_type', render: (value) => value || '-' },
      { header: 'Brand', key: 'card_brand', render: (value) => value || '-' },
      { header: 'Classification', key: 'card_classification', render: (value) => value || '-' },
      { header: 'Settlement', key: 'settlement_type', render: (value) => formatSettlementLabel(value) },
      {
        header: 'Charge %',
        key: 'charge_percent',
        render: (value) => (value !== null && value !== undefined ? formatPercent(value) : '-')
      },
      {
        header: 'Charge Flat',
        key: 'charge_flat',
        render: (value) =>
          value !== null && value !== undefined ? `₹${Number(value).toFixed(2)}` : '-'
      },
      {
        header: 'GST',
        key: 'gst_required',
        render: (value, row) => {
          const gstPct = row?.gst_percent;
          if (value === null || value === undefined) return '-';
          return value ? `Yes${gstPct ? ` (${Number(gstPct).toFixed(2)}%)` : ''}` : 'No';
        }
      },
      {
        header: 'Active',
        key: 'is_active',
        render: (value) => (value ? 'Yes' : 'No')
      }
    ];

    return <Table columns={posChargeColumns} data={filteredPosChargeRows} />;
  };

  if (isLoading) {
    return <div className="p-4">Loading charges...</div>;
  }

  if (isError) {
    return <div>Error loading charges: {error.message}</div>;
  }

  const rows = isMerchantUser || (isFranchiseUser && activeTab === 'chargeSet')
    ? chargesData
    : normalizeLegacyRows(chargesData);
  const isAdminGlobalChargesView = isMerchantUser || (isFranchiseUser && activeTab === 'chargeSet');
  const filteredMerchantRows = isAdminGlobalChargesView
    ? rows.filter((row) => (
        settlementFilter === 'all'
          ? true
          : normalizeSettlementValue(row?.settlement_type) === settlementFilter
      ))
    : rows;
  const columns = isAdminGlobalChargesView ? merchantColumns : legacyColumns;
  const emptyStateMessage =
    isAdminGlobalChargesView && settlementFilter !== 'all'
      ? 'No charges found for the selected settlement.'
      : 'No charges found.';

  return (
    <div className="pb-1 w-full">
      {isFranchiseUser && (
        <div className="mb-4 flex flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-md px-3 py-1 text-sm font-medium bg-indigo-600 text-white"
              onClick={() => setActiveTab('posCharges')}
            >
              POS Charges
            </button>
          </div>
          <div className="text-sm text-gray-600">
            Admin-managed POS charge rules are read-only and cannot be edited by a franchise.
          </div>

          {activeTab === 'posCharges' && (
            <div className="flex flex-wrap items-center gap-3 text-sm text-gray-700">
              <label className="flex items-center gap-2">
                <span>Status:</span>
                <select
                  className="rounded border border-gray-300 bg-white px-2 py-1 text-sm"
                  value={posChargeFilters.is_active}
                  onChange={(e) =>
                    setPosChargeFilters((prev) => ({
                      ...prev,
                      is_active: e.target.value,
                      page: 1
                    }))
                  }
                >
                  <option value="true">Active</option>
                  <option value="false">Inactive</option>
                  <option value="all">All</option>
                </select>
              </label>
              <label className="flex items-center gap-2">
                <span>Settlement:</span>
                <select
                  className="rounded border border-gray-300 bg-white px-2 py-1 text-sm"
                  value={settlementFilter}
                  onChange={(e) => setSettlementFilter(e.target.value)}
                >
                  <option value="today_settlement">T+0</option>
                  <option value="next_day_settlement">T+1</option>
                  <option value="all">All</option>
                </select>
              </label>
            </div>
          )}
        </div>
      )}

      {isAdminGlobalChargesView && (
        <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-end">
          <div className="w-full md:w-56">
            <label className="block text-sm font-medium text-gray-700 mb-1">Settlement</label>
            <select
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-[#00D3CD] focus:border-[#00D3CD]"
              value={settlementFilter}
              onChange={(e) => setSettlementFilter(e.target.value)}
            >
              <option value="today_settlement">Today Settlement</option>
              <option value="next_day_settlement">Next Day Settlement</option>
              <option value="all">All</option>
            </select>
          </div>
        </div>
      )}

      <div className="w-full overflow-x-auto">
        {isFranchiseUser && activeTab === 'posCharges' ? (
          renderPosCharges()
        ) : (
          filteredMerchantRows.length === 0 ? (
            <div className="p-4 text-sm text-gray-500">{emptyStateMessage}</div>
          ) : (
            <>
              {isAdminGlobalChargesView && <MerchantChargeMobileCards rows={filteredMerchantRows} />}
              <div className={isAdminGlobalChargesView ? 'hidden md:block' : ''}>
                <Table columns={columns} data={filteredMerchantRows} />
              </div>
            </>
          )
        )}
      </div>
    </div>
  );
};

export default MerchantCharges;
