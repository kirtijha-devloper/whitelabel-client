import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, Loader2, RefreshCw } from 'lucide-react';
import Modal from './Modal';
import { getPosDashboardChartData } from '../api/reportsApi';

const chartPalette = {
  posT0: '#0284c7',
  posT1: '#8b5cf6',
  posTotal: '#1d4ed8',
  posProcessed: '#16a34a',
  posUnprocessed: '#dc2626',
  branchxSuccess: '#0f766e',
  branchxFailed: '#f97316',
  branchxPending: '#eab308',
  vimoSuccess: '#7c3aed',
  vimoFailed: '#ec4899',
  vimoPending: '#0891b2',
};

const formatApiDate = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getDefaultRange = () => {
  const end = new Date();
  end.setHours(0, 0, 0, 0);
  const start = new Date(end);
  start.setDate(start.getDate() - 4);

  return {
    fromDate: formatApiDate(start),
    toDate: formatApiDate(end),
  };
};

const getNiceStep = (maxValue, tickCount = 5) => {
  if (!Number.isFinite(maxValue) || maxValue <= 0) return 1;

  const roughStep = maxValue / tickCount;
  const magnitude = 10 ** Math.floor(Math.log10(roughStep));
  const normalized = roughStep / magnitude;

  if (normalized <= 1) return magnitude;
  if (normalized <= 2) return 2 * magnitude;
  if (normalized <= 5) return 5 * magnitude;
  return 10 * magnitude;
};

const buildSummaryCards = (series = [], points = []) =>
  series.map((item) => ({
    key: `${item.key}-summary`,
    label: item.label,
    color: item.color,
    total: points.reduce((sum, point) => sum + Number(point?.[item.key] || 0), 0),
  }));

const formatBarValue = (value) => {
  const numericValue = Number(value || 0);
  if (!Number.isFinite(numericValue)) return '0';

  if (Math.abs(numericValue) >= 1000) {
    const formatted = (numericValue / 1000).toFixed(Number.isInteger(numericValue / 1000) ? 0 : 1);
    return `${formatted}K`;
  }

  return Number.isInteger(numericValue) ? String(numericValue) : numericValue.toFixed(2);
};

const formatCurrencyValue = (value) => {
  const numericValue = Number(value || 0);
  return new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  }).format(numericValue);
};

const GroupedBarChart = ({ title, subtitle, series, points, emptyMessage }) => {
  const chartWidth = 1040;
  const chartHeight = 430;
  const margin = { top: 52, right: 26, bottom: 88, left: 72 };
  const plotWidth = chartWidth - margin.left - margin.right;
  const plotHeight = chartHeight - margin.top - margin.bottom;
  const flatValues = points.flatMap((point) => series.map((item) => Number(point?.[item.key] || 0)));
  const maxValue = flatValues.reduce((highest, value) => Math.max(highest, value), 0);
  const tickStep = getNiceStep(maxValue > 0 ? maxValue : 500, 5);
  const chartMax = Math.max(tickStep * 5, tickStep);
  const ticks = Array.from({ length: 6 }, (_, index) => {
    const rawVal = chartMax - index * tickStep;
    return Math.round((rawVal + Number.EPSILON) * 100) / 100;
  });
  const baselineY = margin.top + plotHeight;
  const groupWidth = plotWidth / Math.max(points.length, 1);
  const innerGap = 8;
  const totalInnerGap = innerGap * Math.max(series.length - 1, 0);
  const barWidth = Math.min(28, Math.max(10, (groupWidth * 0.72 - totalInnerGap) / Math.max(series.length, 1)));
  const [hoveredBar, setHoveredBar] = useState(null);

  const tooltipWidth = 220;
  const tooltipHeight = 74;

  const getBarHeight = (value) => {
    if (!chartMax) return 0;
    return (Number(value || 0) / chartMax) * plotHeight;
  };

  return (
    <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 border-b border-slate-100 pb-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-400">{subtitle}</p>
          <h3 className="mt-1 text-2xl font-semibold text-slate-800">{title}</h3>
        </div>
        <div className="flex flex-wrap gap-3">
          {series.map((item) => (
            <div key={item.key} className="inline-flex items-center gap-2 rounded-full bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
              {item.label}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 overflow-x-auto">
        <div className="min-w-[920px]">
          <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="h-auto w-full">
            {ticks.map((tick, index) => {
              const y = margin.top + (index / (ticks.length - 1)) * plotHeight;
              const isBaseline = index === ticks.length - 1;

              return (
                <g key={`${title}-tick-${index}`}>
                  <line
                    x1={margin.left}
                    x2={chartWidth - margin.right}
                    y1={y}
                    y2={y}
                    stroke={isBaseline ? '#cbd5e1' : '#e2e8f0'}
                    strokeWidth={isBaseline ? 1.4 : 1}
                  />
                  <text
                    x={margin.left - 12}
                    y={y + 4}
                    textAnchor="end"
                    fontSize="12"
                    fontWeight="500"
                    fill="#64748b"
                  >
                    {formatBarValue(tick)}
                  </text>
                </g>
              );
            })}

            <line
              x1={margin.left}
              x2={margin.left}
              y1={margin.top}
              y2={baselineY}
              stroke="#cbd5e1"
              strokeWidth="1.4"
            />

            {points.map((point, groupIndex) => {
              const activeSeriesCount = series.length;
              const barsTotalWidth = activeSeriesCount * barWidth + Math.max(activeSeriesCount - 1, 0) * innerGap;
              const groupStartX = margin.left + groupWidth * groupIndex + (groupWidth - barsTotalWidth) / 2;

              return (
                <g key={`${title}-${point.dateKey}`}>
                  {series.map((item, seriesIndex) => {
                    const value = Number(point?.[item.key] || 0);
                    const amount = Number(point?.[item.amountKey] || 0);
                    const barHeight = getBarHeight(value);
                    const x = groupStartX + seriesIndex * (barWidth + innerGap);
                    const y = baselineY - barHeight;

                    return (
                      <g key={`${point.dateKey}-${item.key}`}>
                        <rect
                          x={x}
                          y={y}
                          width={barWidth}
                          height={Math.max(barHeight, 0)}
                          rx="4"
                          fill={item.color}
                          className="cursor-pointer transition-opacity duration-150 hover:opacity-90"
                          onMouseEnter={() =>
                            setHoveredBar({
                              x: x + barWidth / 2,
                              y,
                              color: item.color,
                              dateLabel: point.label,
                              seriesLabel: item.label,
                              value,
                              amount,
                            })
                          }
                          onMouseLeave={() => setHoveredBar(null)}
                        />
                        <text
                          x={x + barWidth / 2}
                          y={Math.max(y - 8, 14)}
                          textAnchor="middle"
                          fontSize="11"
                          fontWeight="700"
                          fill="#0f172a"
                        >
                          {formatBarValue(value)}
                        </text>
                      </g>
                    );
                  })}

                  <text
                    x={margin.left + groupWidth * groupIndex + groupWidth / 2}
                    y={baselineY + 28}
                    textAnchor="middle"
                    fontSize="12"
                    fontWeight="600"
                    fill="#475569"
                  >
                    {point.label}
                  </text>
                </g>
              );
            })}

            {hoveredBar ? (
              <g pointerEvents="none">
                {(() => {
                  const tooltipX = Math.min(
                    Math.max(hoveredBar.x - tooltipWidth / 2, margin.left + 8),
                    chartWidth - margin.right - tooltipWidth
                  );
                  const tooltipY = Math.max(hoveredBar.y - tooltipHeight - 18, margin.top - 8);

                  return (
                    <>
                <rect
                  x={tooltipX}
                  y={tooltipY}
                  width={tooltipWidth}
                  height={tooltipHeight}
                  rx="14"
                  fill="#0f172a"
                  opacity="0.97"
                />
                <circle
                  cx={tooltipX + 18}
                  cy={tooltipY + 20}
                  r="5"
                  fill={hoveredBar.color}
                />
                <text
                  x={tooltipX + 30}
                  y={tooltipY + 24}
                  fontSize="11"
                  fontWeight="700"
                  fill="#f8fafc"
                >
                  {hoveredBar.seriesLabel}
                </text>
                <text
                  x={tooltipX + 18}
                  y={tooltipY + 42}
                  fontSize="10"
                  fontWeight="500"
                  fill="#cbd5e1"
                >
                  {hoveredBar.dateLabel}
                </text>
                <text
                  x={tooltipX + 18}
                  y={tooltipY + 62}
                  fontSize="13"
                  fontWeight="700"
                  fill="#f8fafc"
                >
                  {`Amount: Rs ${formatCurrencyValue(hoveredBar.amount)}`}
                </text>
                    </>
                  );
                })()}
              </g>
            ) : null}
          </svg>
        </div>
      </div>

      {points.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
          {emptyMessage}
        </div>
      ) : null}

      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {buildSummaryCards(series, points).map((item) => (
          <div key={item.key} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{item.label}</p>
            </div>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{item.total}</p>
            <p className="text-xs text-slate-500">Last 5 days total</p>
          </div>
        ))}
      </div>
    </div>
  );
};

const DashboardChartModal = ({ isOpen, onClose }) => {
  const defaultRange = useMemo(() => getDefaultRange(), []);
  const { fromDate, toDate } = defaultRange;

  const { data, isLoading, isFetching, isError, error, refetch } = useQuery({
    queryKey: ['dashboard-chart', fromDate, toDate],
    queryFn: () =>
      getPosDashboardChartData({
        from_date: fromDate,
        to_date: toDate,
      }),
    enabled: isOpen,
    staleTime: 0,
    refetchOnMount: 'always',
  });

  const dailyRows = Array.isArray(data?.daily) ? data.daily : [];

  const posPoints = dailyRows.map((row) => ({
    dateKey: row.dateKey,
    label: row.label,
    t0Pos: Number(row?.posTransactions?.t0Pos || 0),
    t0PosAmount: Number(row?.posTransactions?.t0PosAmount || 0),
    t1Pos: Number(row?.posTransactions?.t1Pos || 0),
    t1PosAmount: Number(row?.posTransactions?.t1PosAmount || 0),
    totalPayouts: Number(row?.posTransactions?.totalPayouts || 0),
    totalPayoutsAmount: Number(row?.posTransactions?.totalPayoutsAmount || 0),
    processedPayouts: Number(row?.posTransactions?.processedPayouts || 0),
    processedPayoutsAmount: Number(row?.posTransactions?.processedPayoutsAmount || 0),
    unprocessedPayouts: Number(row?.posTransactions?.unprocessedPayouts || 0),
    unprocessedPayoutsAmount: Number(row?.posTransactions?.unprocessedPayoutsAmount || 0),
  }));

  const payoutPoints = dailyRows.map((row) => ({
    dateKey: row.dateKey,
    label: row.label,
    branchxSuccess: Number(row?.payouts?.branchx?.success || 0),
    branchxSuccessAmount: Number(row?.payouts?.branchx?.successAmount || 0),
    branchxFailed: Number(row?.payouts?.branchx?.failed || 0),
    branchxFailedAmount: Number(row?.payouts?.branchx?.failedAmount || 0),
    branchxPending: Number(row?.payouts?.branchx?.pending || 0),
    branchxPendingAmount: Number(row?.payouts?.branchx?.pendingAmount || 0),
    vimoSuccess: Number(row?.payouts?.vimo?.success || 0),
    vimoSuccessAmount: Number(row?.payouts?.vimo?.successAmount || 0),
    vimoFailed: Number(row?.payouts?.vimo?.failed || 0),
    vimoFailedAmount: Number(row?.payouts?.vimo?.failedAmount || 0),
    vimoPending: Number(row?.payouts?.vimo?.pending || 0),
    vimoPendingAmount: Number(row?.payouts?.vimo?.pendingAmount || 0),
  }));

  const posSeries = [
    { key: 't0Pos', amountKey: 't0PosAmount', label: 'T+0 POS', color: chartPalette.posT0 },
    { key: 't1Pos', amountKey: 't1PosAmount', label: 'T+1 POS', color: chartPalette.posT1 },
  ];

  const payoutSeries = [
    { key: 'branchxSuccess', amountKey: 'branchxSuccessAmount', label: 'BranchX Success', color: chartPalette.branchxSuccess },
    { key: 'branchxFailed', amountKey: 'branchxFailedAmount', label: 'BranchX Failed', color: chartPalette.branchxFailed },
    { key: 'branchxPending', amountKey: 'branchxPendingAmount', label: 'BranchX Pending', color: chartPalette.branchxPending },
    { key: 'vimoSuccess', amountKey: 'vimoSuccessAmount', label: 'Vimo Success', color: chartPalette.vimoSuccess },
    { key: 'vimoFailed', amountKey: 'vimoFailedAmount', label: 'Vimo Failed', color: chartPalette.vimoFailed },
    { key: 'vimoPending', amountKey: 'vimoPendingAmount', label: 'Vimo Pending', color: chartPalette.vimoPending },
  ];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Last 5 Days Charts" className="max-w-7xl">
      <div className="space-y-5">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-800">Showing date-wise charts for the last 5 days including today</p>
              <p className="mt-1 text-xs text-slate-500">
                Range: {fromDate} to {toDate}
              </p>
            </div>
            <button
              type="button"
              onClick={() => refetch()}
              disabled={isLoading || isFetching}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex min-h-[320px] items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white">
            <div className="flex items-center gap-3 text-slate-600">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm font-medium">Loading charts...</span>
            </div>
          </div>
        ) : null}

        {!isLoading && isError ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">
            <p className="font-semibold">Unable to load the charts.</p>
            <p className="mt-1">{error?.message || 'Something went wrong while fetching chart data.'}</p>
          </div>
        ) : null}

        {!isLoading && !isError ? (
          <>
            <GroupedBarChart
              title="POS Transactions"
              subtitle="Transactions"
              series={posSeries}
              points={posPoints}
              emptyMessage="No POS transaction records were found for the selected 5-day window."
            />
            <GroupedBarChart
              title="Payouts"
              subtitle="BranchX And Vimo"
              series={payoutSeries}
              points={payoutPoints}
              emptyMessage="No payout records were found for the selected 5-day window."
            />
          </>
        ) : null}
      </div>
    </Modal>
  );
};

const DashboardChartLauncher = ({ label = 'View Chart', buttonClassName = '' }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={buttonClassName}
      >
        <BarChart3 className="h-4 w-4" />
        {label}
      </button>

      <DashboardChartModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
};

export default DashboardChartLauncher;
