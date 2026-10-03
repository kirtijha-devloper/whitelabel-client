import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Table from "../../components/Table";
import { getLedgerEntries } from "../../api/ledgerApi";
import { fetchUserDetails } from "../../api/authApi";
import { Loader2, ChevronLeft, ChevronRight } from "lucide-react";

const MerchantLedgerEntries = () => {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  const { data: currentUser } = useQuery({
    queryKey: ["currentUser"],
    queryFn: fetchUserDetails,
  });

  const merchantId = currentUser?.merchant_id || currentUser?.id;

  const { data: ledgerData, isLoading } = useQuery({
    queryKey: ["ledgerEntries", page, limit, merchantId],
    queryFn: () =>
      getLedgerEntries({
        page,
        limit,
        merchant_id: merchantId,
      }),
    enabled: !!merchantId,
  });

  const entries = ledgerData?.data || [];
  const pagination = ledgerData?.pagination || { total: 0, page: 1, limit: 10, totalPages: 1 };

  const columns = [
    { header: "ID", key: "id" },
    { header: "Type", key: "type" },
    { header: "Amount", key: "amount", render: (amount) => `₹${parseFloat(amount || 0).toFixed(2)}` },
    { header: "Description", key: "description" },
    { header: "Date", key: "createdAt", render: (date) => (date ? new Date(date).toLocaleString() : "-") },
  ];

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold text-gray-900">Ledger Entries</h1>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-md mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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

        <div className="bg-white p-6 rounded-xl shadow-md overflow-x-auto">
          <h2 className="text-xl font-semibold text-gray-800 mb-4 border-b pb-2">Entries</h2>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="animate-spin h-8 w-8 text-indigo-600" />
            </div>
          ) : entries.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No entries found.</p>
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

export default MerchantLedgerEntries;

