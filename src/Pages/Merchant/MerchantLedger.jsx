import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Table from "../../components/Table";
import { getAllLedgerEntries, getLedgerEntries } from "../../api/ledgerApi";
import { Loader2, RefreshCcw, Download } from "lucide-react";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { toast } from "react-toastify";
import {
  isMdrCutTransaction,
  sanitizeCcBill3ProviderText,
} from "../../utils/ledgerDisplay";
import Modal from "../../components/Modal";

const RUPEE = "\u20B9";

const getTransactionText = (description, transactionType) => {
  const safeDescription = sanitizeCcBill3ProviderText(description);
  return transactionType ? `${transactionType}: ${safeDescription}` : safeDescription || "-";
};

const formatCurrency = (value) =>
  `${RUPEE}${parseFloat(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
  })}`;

const formatSignedCurrency = (value, sign) =>
  `${sign}${parseFloat(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
  })}`;

const formatDateTime = (value) => (value ? new Date(value).toLocaleString("en-IN") : "-");

const formatDate = (value) => (value ? new Date(value).toLocaleDateString("en-IN") : "-");

const formatTime = (value) => (value ? new Date(value).toLocaleTimeString("en-IN") : "");

const TransactionPreview = ({
  description,
  transactionType,
  onOpen,
  widthClass = "w-full",
}) => {
  const transactionText = getTransactionText(description, transactionType);
  const previewLength = Math.max(24, Math.ceil((transactionText?.length || 0) * 0.35));
  const previewText =
    transactionText && transactionText.length > previewLength
      ? `${transactionText.slice(0, previewLength).trimEnd()}...`
      : transactionText;

  return (
    <div className={`whitespace-normal ${widthClass}`}>
      <button
        type="button"
        onClick={onOpen}
        className="w-full text-left"
        title="View full description"
      >
        <p className="overflow-hidden whitespace-normal break-words text-sm leading-6 text-gray-900">
          {previewText}
        </p>
        <span className="mt-1 inline-block text-xs font-medium text-[#00B8B3] hover:text-[#009d98]">
          View details
        </span>
      </button>
    </div>
  );
};

const MobileLedgerCard = ({ tx, index, onOpenDescription }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const creditValue = parseFloat(tx.credit || 0);
  const debitValue = parseFloat(tx.debit || 0);
  const debitTextClass = isMdrCutTransaction(tx) ? "text-[#FF00FF]" : "text-red-600";

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-gray-500">#{index}</p>
          <p className="mt-1 text-sm font-semibold text-gray-900">{formatDateTime(tx.created_at)}</p>
        </div>
      </div>

      {!isExpanded ? (
        <>
          <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
            <div className="rounded-xl bg-slate-50 px-3 py-2.5">
              <p className="text-gray-500">Date</p>
              <p className="mt-1 font-medium text-gray-900">{formatDateTime(tx.created_at)}</p>
            </div>
            <div className="rounded-xl bg-slate-50 px-3 py-2.5">
              <p className="text-gray-500">Credit</p>
              <p className="mt-1 font-medium text-green-600">
                {creditValue > 0 ? formatSignedCurrency(tx.credit, "+") : "-"}
              </p>
            </div>
            <div className="rounded-xl bg-slate-50 px-3 py-2.5">
              <p className="text-gray-500">Bal. Before</p>
              <p className="mt-1 font-medium text-gray-900">{formatCurrency(tx.balance_before)}</p>
            </div>
            <div className="rounded-xl bg-slate-50 px-3 py-2.5">
              <p className="text-gray-500">Bal. After</p>
              <p className="mt-1 font-medium text-gray-900">{formatCurrency(tx.balance_after)}</p>
            </div>
            {debitValue > 0 && (
              <div className="rounded-xl bg-slate-50 px-3 py-2.5">
                <p className="text-gray-500">Debit</p>
                <p className={`mt-1 font-medium ${debitTextClass}`}>{formatSignedCurrency(tx.debit, "-")}</p>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => setIsExpanded(true)}
            className="mt-3 text-xs font-semibold text-[#00B8B3] hover:text-[#009d98]"
          >
            View details
          </button>
        </>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
            <div>
              <p className="text-gray-500">Date</p>
              <p className="mt-1 font-medium text-gray-900">{formatDate(tx.created_at)}</p>
            </div>
            <div>
              <p className="text-gray-500">Time</p>
              <p className="mt-1 font-medium text-gray-900">{formatTime(tx.created_at)}</p>
            </div>
            <div>
              <p className="text-gray-500">Type</p>
              <p className="mt-1 font-medium capitalize text-gray-900">{tx.transaction_type || "-"}</p>
            </div>
            <div>
              <p className="text-gray-500">Credit</p>
              <p className="mt-1 font-medium text-green-600">
                {creditValue > 0 ? formatSignedCurrency(tx.credit, "+") : "-"}
              </p>
            </div>
            <div className="col-span-2">
              <p className="text-gray-500">Description</p>
              <div className="mt-1">
                <TransactionPreview
                  description={tx.description}
                  transactionType={tx.transaction_type}
                  onOpen={() => onOpenDescription(tx)}
                  widthClass="w-full max-w-full"
                />
              </div>
            </div>
            <div>
              <p className="text-gray-500">Debit</p>
              <p className={`mt-1 font-medium ${debitTextClass}`}>
                {debitValue > 0 ? formatSignedCurrency(tx.debit, "-") : "-"}
              </p>
            </div>
            <div>
              <p className="text-gray-500">Credit</p>
              <p className="mt-1 font-medium text-green-600">
                {creditValue > 0 ? formatSignedCurrency(tx.credit, "+") : "-"}
              </p>
            </div>
            <div>
              <p className="text-gray-500">Bal. Before</p>
              <p className="mt-1 font-medium text-gray-900">{formatCurrency(tx.balance_before)}</p>
            </div>
            <div>
              <p className="text-gray-500">Bal. After</p>
              <p className="mt-1 font-medium text-gray-900">{formatCurrency(tx.balance_after)}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsExpanded(false)}
            className="mt-3 text-xs font-semibold text-[#00B8B3] hover:text-[#009d98]"
          >
            Read less
          </button>
        </>
      )}
    </div>
  );
};

const MerchantLedger = () => {
  const today = new Date().toISOString().split("T")[0];

  const [filters, setFilters] = useState({
    start_date: today,
    end_date: today,
    transaction_type: "",
    page: 1,
    limit: 50,
  });
  const [selectedDescriptionEntry, setSelectedDescriptionEntry] = useState(null);

  const { data: ledgerData, isLoading, isError } = useQuery({
    queryKey: ["ledgerEntries", filters],
    queryFn: () => getLedgerEntries(filters),
    keepPreviousData: true,
  });

  const entries = ledgerData?.data || [];
  const pagination = ledgerData?.pagination || { total: 0, page: 1, limit: 50, totalPages: 1 };
  const currentBalance = ledgerData?.current_balance ?? null;
  const userInfo = ledgerData?.user || null;

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters((prev) => ({
      ...prev,
      [name]: name === "limit" ? Number(value) : value,
      page: 1,
    }));
  };

  const resetFilters = () => {
    setFilters({
      start_date: today,
      end_date: today,
      transaction_type: "",
      page: 1,
      limit: 50,
    });
  };

  const handleExport = async () => {
    try {
      const exportFilters = {
        start_date: filters.start_date,
        end_date: filters.end_date,
        transaction_type: filters.transaction_type,
      };

      const allLedgerData = await getAllLedgerEntries(exportFilters, { limit: 200 });
      const exportRows = Array.isArray(allLedgerData?.data) ? allLedgerData.data : [];

      if (exportRows.length === 0) {
        toast.warn("No data to export!");
        return;
      }

      const exportData = exportRows.map((row, idx) => ({
        "#": idx + 1,
        Date: formatDateTime(row.created_at),
        Type: row.transaction_type,
        Description: sanitizeCcBill3ProviderText(row.description),
        [`Debit (${RUPEE})`]: parseFloat(row.debit || 0).toFixed(2),
        [`Credit (${RUPEE})`]: parseFloat(row.credit || 0).toFixed(2),
        [`Txn Amount (${RUPEE})`]: parseFloat(row.transaction_amount || 0).toFixed(2),
        [`Bal. Before (${RUPEE})`]: parseFloat(row.balance_before || 0).toFixed(2),
        [`Bal. After (${RUPEE})`]: parseFloat(row.balance_after || 0).toFixed(2),
      }));

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Ledger");
      const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      const fromDate = filters.start_date || today;
      const toDate = filters.end_date || today;
      const fileSuffix = fromDate === toDate ? fromDate : `${fromDate}_to_${toDate}`;
      saveAs(new Blob([buf], { type: "application/octet-stream" }), `Ledger_${fileSuffix}.xlsx`);
      toast.success("Export successful!");
    } catch (error) {
      console.error("Failed to export merchant ledger:", error);
      toast.error("Failed to export ledger data.");
    }
  };

  const openDescriptionModal = (entry) => setSelectedDescriptionEntry(entry);
  const closeDescriptionModal = () => setSelectedDescriptionEntry(null);

  const columns = [
    {
      header: "#",
      key: "id",
      render: (_, _row, idx) => (pagination.page - 1) * pagination.limit + idx + 1,
    },
    {
      header: "Date & Time",
      key: "created_at",
      render: (dt) => (
        <>
          <div>{formatDate(dt)}</div>
          <div className="text-xs text-gray-500">{formatTime(dt)}</div>
        </>
      ),
    },
    {
      header: "Description",
      key: "description",
      render: (desc, row) => (
        <TransactionPreview
          description={desc}
          transactionType={row.transaction_type}
          onOpen={() => openDescriptionModal(row)}
        />
      ),
    },
    {
      header: `Debit (${RUPEE})`,
      key: "debit",
      render: (v, row) =>
        parseFloat(v || 0) > 0 ? (
          <span className={`font-medium ${isMdrCutTransaction(row) ? "text-[#FF00FF]" : "text-red-600"}`}>
            {formatSignedCurrency(v, "-")}
          </span>
        ) : (
          <span className="text-gray-400">-</span>
        ),
    },
    {
      header: `Credit (${RUPEE})`,
      key: "credit",
      render: (v) =>
        parseFloat(v || 0) > 0 ? (
          <span className="font-medium text-green-600">{formatSignedCurrency(v, "+")}</span>
        ) : (
          <span className="text-gray-400">-</span>
        ),
    },
    {
      header: `Bal. Before (${RUPEE})`,
      key: "balance_before",
      render: (v) => parseFloat(v || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 }),
    },
    {
      header: `Bal. After (${RUPEE})`,
      key: "balance_after",
      render: (v) => parseFloat(v || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 }),
    },
  ];

  return (
    <div className="pb-1">
      <div className="w-full">
        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0 flex-1">
            <h1 className="text-[2rem] font-semibold leading-tight text-gray-900">Passbook / Ledger</h1>
          </div>

          {currentBalance !== null && (
            <div className="w-full max-w-[220px] rounded-2xl border-l-4 border-indigo-500 bg-white px-4 py-3 shadow-sm md:w-auto md:max-w-none md:min-w-[132px]">
              <p className="text-[10px] uppercase tracking-wide text-gray-500">Current Balance</p>
              <p className="mt-1 text-2xl font-bold text-indigo-700">{formatCurrency(currentBalance)}</p>
            </div>
          )}
        </div>

        <div className="mb-6 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:p-5">
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">From Date</label>
                <input
                  type="date"
                  name="start_date"
                  value={filters.start_date}
                  onChange={handleFilterChange}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm shadow-sm outline-none transition-colors focus:border-[#00D3CD]"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">To Date</label>
                <input
                  type="date"
                  name="end_date"
                  value={filters.end_date}
                  onChange={handleFilterChange}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm shadow-sm outline-none transition-colors focus:border-[#00D3CD]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Transaction Type</label>
                <select
                  name="transaction_type"
                  value={filters.transaction_type}
                  onChange={handleFilterChange}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm shadow-sm outline-none transition-colors focus:border-[#00D3CD]"
                >
                  <option value="">All Types</option>
                  <option value="payout">Payout</option>
                  <option value="pos">POS</option>
                  <option value="bbps_payment">BBPS Payment</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-end gap-3">
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <span className="shrink-0">Rows per page:</span>
                <select
                  name="limit"
                  value={filters.limit}
                  onChange={handleFilterChange}
                  className="min-w-[74px] rounded-xl border border-gray-200 px-2 py-2 text-sm shadow-sm outline-none transition-colors focus:border-[#00D3CD]"
                >
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>

              <button
                onClick={resetFilters}
                className="inline-flex items-center justify-center gap-1 rounded-xl border border-gray-200 px-3 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
              >
                <RefreshCcw className="h-4 w-4" />
                Reset
              </button>

              <button
                onClick={handleExport}
                className="inline-flex items-center justify-center gap-1 rounded-xl bg-indigo-600 px-3 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-700"
              >
                <Download className="h-4 w-4" />
                Export
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-gray-100 p-5">
            <h2 className="text-lg font-semibold text-gray-800">Ledger Entries</h2>
            <span className="text-sm text-gray-500">{pagination.total} records</span>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-gray-500">
              <Loader2 className="mr-2 h-6 w-6 animate-spin" />
              Loading...
            </div>
          ) : isError ? (
            <div className="py-16 text-center text-red-500">Failed to load ledger entries.</div>
          ) : entries.length === 0 ? (
            <p className="py-16 text-center text-gray-400">No entries found for the selected filters.</p>
          ) : (
            <>
              <div className="space-y-3 p-4 md:hidden">
                {entries.map((tx, idx) => (
                  <MobileLedgerCard
                    key={tx.id}
                    tx={tx}
                    index={(pagination.page - 1) * pagination.limit + idx + 1}
                    onOpenDescription={openDescriptionModal}
                  />
                ))}
              </div>

              <div className="hidden overflow-x-auto md:block">
                <Table columns={columns} data={entries} />
              </div>
            </>
          )}
        </div>

        {pagination.totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between text-sm text-gray-600">
            <span>
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setFilters((prev) => ({ ...prev, page: prev.page - 1 }))}
                disabled={pagination.page <= 1}
                className="rounded border px-3 py-1 transition hover:bg-gray-100 disabled:opacity-40"
              >
                Previous
              </button>
              <button
                onClick={() => setFilters((prev) => ({ ...prev, page: prev.page + 1 }))}
                disabled={pagination.page >= pagination.totalPages}
                className="rounded border px-3 py-1 transition hover:bg-gray-100 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}

        <Modal
          isOpen={!!selectedDescriptionEntry}
          onClose={closeDescriptionModal}
          title="Ledger Description"
          className="max-w-3xl"
        >
          {selectedDescriptionEntry && (
            <div className="space-y-4">
              <div className="grid gap-3 rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700 sm:grid-cols-2">
                <div>
                  <p className="text-xs uppercase text-gray-500">Date & Time</p>
                  <p className="mt-1 text-gray-900">{formatDateTime(selectedDescriptionEntry.created_at)}</p>
                </div>
                <div>
                  <p className="text-xs uppercase text-gray-500">Type</p>
                  <p className="mt-1 text-gray-900">{selectedDescriptionEntry.transaction_type || "-"}</p>
                </div>
              </div>
              <div className="rounded-2xl border border-gray-200 bg-white p-4">
                <p className="text-xs uppercase text-gray-500">Full Description</p>
                <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-7 text-gray-900">
                  {getTransactionText(
                    selectedDescriptionEntry.description,
                    selectedDescriptionEntry.transaction_type
                  )}
                </p>
              </div>
            </div>
          )}
        </Modal>
      </div>
    </div>
  );
};

export default MerchantLedger;
