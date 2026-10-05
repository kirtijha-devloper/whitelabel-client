import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Upload, Filter, CheckCircle, Loader2, Eye } from "lucide-react";
import Table from "../components/Table";
import {
  uploadCSV,
  getAllTransactions,
  getFilteredTransactions,
  getAllFileUploads,
} from "../api/transactionApi";
import { useNavigate, useLocation } from "react-router-dom";

const POSRazarpayReport = () => {
  const queryClient = useQueryClient();
  const [file, setFile] = useState(null);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [filters, setFilters] = useState({
    status: "",
    startDate: "",
    endDate: "",
    MID: "",
    TID: "",
  });
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  const navigate = useNavigate();
  const location = useLocation();
  const transactionDetailsBasePath = location.pathname.startsWith("/super-franchise")
    ? "/super-franchise/transaction"
    : location.pathname.startsWith("/franchise")
    ? "/franchise/transaction"
    : "/admin/transaction";

  // Fetch all transactions
  const { data: transactions = [], isLoading: transactionsLoading } = useQuery({
    queryKey: ["transactions", filters],
    queryFn: () => (Object.values(filters).some(Boolean) ? getFilteredTransactions(filters) : getAllTransactions()),
  });
  console.log(transactions,"transaction");

  // Fetch uploaded files
  const { data: uploadedFiles = [] } = useQuery({
    queryKey: ["uploadedFiles"],
    queryFn: getAllFileUploads,
  });

  // Upload CSV mutation
  const uploadMutation = useMutation({
    mutationFn: uploadCSV,
    onSuccess: (data) => {
      queryClient.invalidateQueries(["transactions"]);
     // queryClient.invalidateQueries(["uploadedFiles"]);
      setSuccessMessage(data?.message || "File uploaded successfully!");
      setShowSuccess(true);
      setFile(null);
      setTimeout(() => setShowSuccess(false), 5000);
    },
    onError: (error) => {
      alert(`Upload failed: ${error.message}`);
    },
  });

  // Table Columns
  const reportColumns = [
    { header: "ID", key: "ID" },
    { header: "Transaction ID", key: "ID" }, // Assuming ID is the transaction ID
    { header: "Amount", key: "Amount", render: (amount) => `₹${parseFloat(amount || 0).toFixed(2)}` },
    {
      header: "Status",
      key: "Status",
      render: (status) => (
        <span
          className={`px-2 py-1 rounded-full text-xs font-semibold ${
            status?.toLowerCase() === "settled" || status?.toLowerCase() === "success"
              ? "bg-green-100 text-green-800"
              : status?.toLowerCase() === "failed"
              ? "bg-red-100 text-red-800"
              : "bg-yellow-100 text-yellow-800"
          }`}
        >
          {status || "N/A"}
        </span>
      ),
    },
    { header: "Date", key: "Date", render: (date) => (date ? new Date(date).toLocaleDateString() : "N/A") },
    { header: "MID", key: "MID" },
    { header: "TID", key: "TID" },
    {
      header: "Details",
      key: "ID",
      render: (id) => (
        <button
          onClick={() => navigate(`${transactionDetailsBasePath}/${id}`)}
          className="text-primary hover:text-indigo-800 transition"
          title="View Details"
        >
          <Eye size={20} />
        </button>
      ),
    },
  ];

  // File Upload Handlers
  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile && (selectedFile.type === "text/csv" || selectedFile.name.endsWith(".csv"))) {
      setFile(selectedFile);
    } else {
      alert("Please upload a valid CSV file (.csv)");
    }
  };

  const handleFileUpload = () => {
    if (!file) {
      alert("Please select a file to upload");
      return;
    }
    uploadMutation.mutate(file);
  };

  // Filter Handlers
  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  const applyFilters = () => {
    queryClient.invalidateQueries(["transactions"]);
    setShowFilterModal(false);
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <div>
        {/* Header */}
        <h1 className="text-2xl font-medium mb-4">
          POS-Razorpay Report
        </h1>

        {/* Upload Section */}
        <div className="bg-white p-4 rounded-xl shadow-sm mb-4">
          <div className="flex flex-col gap-3 md:flex-row md:justify-between md:items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-800">Upload CSV File</h2>
            <button
              onClick={() => setShowFilterModal(true)}
              className="w-full md:w-auto justify-center flex items-center gap-2 bg-indigo-500 text-white px-4 py-2 rounded-lg hover:bg-indigo-600 transition"
            >
              <Filter size={20} />
              Filter
            </button>
          </div>
          <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-4">
            <input
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="w-full min-w-0 p-2 border border-gray-300 rounded-md text-gray-700"
            />
            <button
              onClick={handleFileUpload}
              disabled={uploadMutation.isPending || !file}
              className="w-full md:w-auto justify-center flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition disabled:opacity-50"
            >
              {uploadMutation.isPending ? (
                <Loader2 className="animate-spin h-5 w-5" />
              ) : (
                <Upload size={20} />
              )}
              Upload
            </button>
          </div>
          {uploadedFiles.length > 0 && (
            <div className="mt-4">
              <p className="text-sm text-gray-600 break-all">Uploaded Files: {uploadedFiles.join(", ")}</p>
            </div>
          )}
        </div>

        {/* Transactions Table */}
        <div className="bg-white p-4 rounded-xl shadow-sm">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Transaction Report</h2>
          {transactionsLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="animate-spin h-8 w-8 text-primary" />
            </div>
          ) : (
            <>
              <div className="md:hidden space-y-3">
                {transactions.length === 0 ? (
                  <div className="bg-gray-50 rounded-xl border border-gray-100 p-6 text-center text-sm text-gray-500">
                    No records found.
                  </div>
                ) : (
                  transactions.map((txn, index) => (
                    <div key={txn?.ID || index} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 space-y-2">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <p className="text-sm font-semibold text-gray-900 min-w-0 break-all">#{txn?.ID || "-"}</p>
                        <span
                          className={`inline-block px-2 py-1 rounded-full text-[10px] font-semibold leading-tight max-w-full whitespace-normal break-all ${
                            String(txn?.Status || "").toLowerCase() === "settled" || String(txn?.Status || "").toLowerCase() === "success"
                              ? "bg-green-100 text-green-800"
                              : String(txn?.Status || "").toLowerCase() === "failed"
                              ? "bg-red-100 text-red-800"
                              : "bg-yellow-100 text-yellow-800"
                          }`}
                        >
                          {txn?.Status || "N/A"}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700 break-all"><span className="font-medium">Transaction ID:</span> {txn?.ID || "-"}</p>
                      <p className="text-sm text-gray-700"><span className="font-medium">Amount:</span> {"\u20B9"}{parseFloat(txn?.Amount || 0).toFixed(2)}</p>
                      <p className="text-sm text-gray-700"><span className="font-medium">Date:</span> {txn?.Date ? new Date(txn.Date).toLocaleDateString() : "N/A"}</p>
                      <p className="text-sm text-gray-700"><span className="font-medium">MID:</span> {txn?.MID || "-"}</p>
                      <p className="text-sm text-gray-700"><span className="font-medium">TID:</span> {txn?.TID || "-"}</p>
                      <div className="pt-1">
                        <button
                          onClick={() => navigate(`${transactionDetailsBasePath}/${txn?.ID}`)}
                          className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-primary border border-primary/30 rounded-full hover:bg-primary/10 transition"
                          title="View Details"
                        >
                          <Eye size={16} />
                          View Details
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="hidden md:block">
                <Table columns={reportColumns} data={transactions} />
              </div>
            </>
          )}
        </div>

        {/* Filter Modal */}
        {showFilterModal && (
          <div className="fixed inset-0 bg-gray-800 bg-opacity-75 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-xl shadow-lg w-full max-w-md">
              <h2 className="text-2xl font-semibold text-primary mb-4">Filter Transactions</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Status</label>
                  <select
                    name="status"
                    value={filters.status}
                    onChange={handleFilterChange}
                    className="w-full p-2 border border-gray-300 rounded-md"
                  >
                    <option value="">All</option>
                    <option value="settled">Settled</option>
                    <option value="failed">Failed</option>
                    <option value="pending">Pending</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Start Date</label>
                  <input
                    type="date"
                    name="startDate"
                    value={filters.startDate}
                    onChange={handleFilterChange}
                    className="w-full p-2 border border-gray-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">End Date</label>
                  <input
                    type="date"
                    name="endDate"
                    value={filters.endDate}
                    onChange={handleFilterChange}
                    className="w-full p-2 border border-gray-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">MID</label>
                  <input
                    type="text"
                    name="MID"
                    value={filters.MID}
                    onChange={handleFilterChange}
                    className="w-full p-2 border border-gray-300 rounded-md"
                    placeholder="Enter MID"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">TID</label>
                  <input
                    type="text"
                    name="TID"
                    value={filters.TID}
                    onChange={handleFilterChange}
                    className="w-full p-2 border border-gray-300 rounded-md"
                    placeholder="Enter TID"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-4 mt-6">
                <button
                  onClick={() => setShowFilterModal(false)}
                  className="bg-gray-300 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-400 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={applyFilters}
                  className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition"
                >
                  Apply Filters
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Success Message */}
        {showSuccess && (
          <div className="fixed bottom-6 right-6 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-2 animate-fade-in">
            <CheckCircle size={20} /> {successMessage}
          </div>
        )}
      </div>

      {/* Tailwind Animation */}
      <style>
        {`
          .animate-fade-in {
            animation: fadeIn 0.5s ease-in;
          }
          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
          }
        `}
      </style>
    </div>
  );
};

export default POSRazarpayReport;
