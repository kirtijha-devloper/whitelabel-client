import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Select from "react-select";
import Table from "../components/Table";
import { getMerchantTransactionCharges } from "../api/MerchantApi";
import { MerchantAllUsers } from "../api/FranchiseApi";
import { Loader2, ChevronLeft, ChevronRight } from "lucide-react";

const MerchantTransactionCharges = () => {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [selectedMerchant, setSelectedMerchant] = useState(null);

  const { data: merchantsData, isLoading: merchantsLoading } = useQuery({
    queryKey: ["merchants", "active"],
    queryFn: MerchantAllUsers,
  });

  const merchants = useMemo(() => {
    if (!merchantsData) return [];
    return Array.isArray(merchantsData.data) ? merchantsData.data : [];
  }, [merchantsData]);

  const merchantOptions = merchants.map((m) => ({
    value: m.id,
    label: `${m.name} (${m.mobile_number})`,
  }));

  const { data: chargesData, isLoading } = useQuery({
    queryKey: ["merchantTransactionCharges", page, limit, selectedMerchant?.value],
    queryFn: () =>
      getMerchantTransactionCharges({
        page,
        limit,
        merchant_id: selectedMerchant?.value,
      }),
  });

  const entries = chargesData?.data || [];
  const pagination = chargesData?.pagination || { total: 0, page: 1, limit: 10, totalPages: 1 };
  const summary = chargesData?.summary || {
    total_transactions: 0,
    total_transaction_amount: 0,
    total_charge_amount: 0,
    total_net_amount: 0,
  };

  const columns = [
    { header: "ID", key: "id" },
    {
      header: "Razorpay Txn ID",
      key: "razorpay_transaction_id",
      render: (val) => <span className="font-mono text-sm">{val || "-"}</span>,
    },
    {
      header: "Merchant",
      key: "merchant",
      render: (merchant) => merchant?.name || "-",
    },
    {
      header: "Transaction Amount",
      key: "transaction_amount",
      render: (val) => `₹${parseFloat(val || 0).toFixed(2)}`,
    },
    {
      header: "Charge Amount",
      key: "charge_amount",
      render: (val) => `₹${parseFloat(val || 0).toFixed(2)}`,
    },
    {
      header: "Net Amount",
      key: "net_amount",
      render: (val) => `₹${parseFloat(val || 0).toFixed(2)}`,
    },
    {
      header: "Charge Rate",
      key: "charge_rate",
      render: (val) => `${val || 0}%`,
    },
    {
      header: "Payment Method",
      key: "payment_method",
    },
    {
      header: "MID",
      key: "mid_number",
    },
    {
      header: "TID",
      key: "tid_number",
    },
    {
      header: "Customer Name",
      key: "customer_name",
    },
    {
      header: "Date",
      key: "createdAt",
      render: (date) => (date ? new Date(date).toLocaleString() : "-"),
    },
  ];

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold text-gray-900">Merchant Transaction Charges</h1>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white p-6 rounded-xl shadow-md">
            <p className="text-sm text-gray-600 mb-1">Total Transactions</p>
            <p className="text-2xl font-bold text-gray-900">{summary.total_transactions}</p>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-md">
            <p className="text-sm text-gray-600 mb-1">Total Transaction Amount</p>
            <p className="text-2xl font-bold text-indigo-600">
              ₹{parseFloat(summary.total_transaction_amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-md">
            <p className="text-sm text-gray-600 mb-1">Total Charge Amount</p>
            <p className="text-2xl font-bold text-red-600">
              ₹{parseFloat(summary.total_charge_amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-md">
            <p className="text-sm text-gray-600 mb-1">Total Net Amount</p>
            <p className="text-2xl font-bold text-green-600">
              ₹{parseFloat(summary.total_net_amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white p-6 rounded-xl shadow-md mb-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Filter by Merchant</label>
              <Select
                options={merchantOptions}
                value={selectedMerchant}
                onChange={(selected) => {
                  setSelectedMerchant(selected);
                  setPage(1);
                }}
                placeholder="Select merchant..."
                isClearable
                isLoading={merchantsLoading}
                className="basic-single"
                classNamePrefix="select"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Items per page</label>
              <select
                value={limit}
                onChange={(e) => {
                  setLimit(Number(e.target.value));
                  setPage(1);
                }}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white p-6 rounded-xl shadow-md overflow-x-auto">
          <h2 className="text-xl font-semibold text-gray-800 mb-4 border-b pb-2">Transaction Charges</h2>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="animate-spin h-8 w-8 text-indigo-600" />
            </div>
          ) : entries.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No transaction charges found.</p>
          ) : (
            <>
              <Table columns={columns} data={entries} />
              <div className="flex items-center justify-between mt-6 pt-4 border-t">
                <div className="text-sm text-gray-600">
                  Showing {(pagination.page - 1) * pagination.limit + 1} to{" "}
                  {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} entries
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={pagination.page === 1}
                    className="px-3 py-1 border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    <ChevronLeft size={20} />
                  </button>
                  <span className="px-4 py-1 text-sm">
                    Page {pagination.page} of {pagination.totalPages}
                  </span>
                  <button
                    onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                    disabled={pagination.page >= pagination.totalPages}
                    className="px-3 py-1 border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    <ChevronRight size={20} />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default MerchantTransactionCharges;

