import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Lock, Unlock, Send, CheckCircle, Loader2 } from "lucide-react";
import Select from "react-select";
import DynamicForm from "../components/DynamicForm";
import Table from "../components/Table";
import {
  requestFund,
  transferFund,
  holdFund,
  unholdFund,
  getUserWalletTransactions,
} from "../api/WalletApi";

const Wallet = () => {
  const queryClient = useQueryClient();
  const [activeModal, setActiveModal] = useState(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [selectedType, setSelectedType] = useState("all"); // Default to no filter
  const [selectedStatus, setSelectedStatus] = useState(null); // For react-select

  // Transaction type options
  // const typeOptions = [
  //   { value: "", label: "All" },
  //   { value: "request", label: "Request" },
  //   { value: "transfer", label: "Transfer" },
  //   { value: "hold", label: "Hold" },
  //   { value: "unhold", label: "Unhold" },
  // ];
  const transactionTypes = ["all", "request", "transfer", "hold", "unhold"];

  // Status options for react-select
  const statusOptions = [
    { value: "pending", label: "Pending" },
    { value: "completed", label: "Completed" },
  ];

  // Fetch wallet transactions with filters
  const filters = {
    type: selectedType !== "all" ? selectedType : undefined,
    status: selectedStatus?.value || undefined,
  };
  const { data: walletData, isLoading: transactionsLoading } = useQuery({
    queryKey: ["userWalletTransactions", filters],
    queryFn: () => getUserWalletTransactions(filters),
  });

  const transactions = walletData?.transactions || [];

  // Mutations
  const requestFundMutation = useMutation({
    mutationFn: requestFund,
    onSuccess: () => {
      queryClient.invalidateQueries(["userWalletTransactions"]);
      setShowSuccess(true);
      setActiveModal(null);
      setTimeout(() => setShowSuccess(false), 3000);
    },
    onError: (error) => {
      alert(`Request failed: ${error.message}`);
    },
  });

  const transferFundMutation = useMutation({
    mutationFn: transferFund,
    onSuccess: () => {
      queryClient.invalidateQueries(["userWalletTransactions"]);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    },
    onError: (error) => {
      alert(`Transfer failed: ${error.message}`);
    },
  });

  const holdFundMutation = useMutation({
    mutationFn: holdFund,
    onSuccess: () => {
      queryClient.invalidateQueries(["userWalletTransactions"]);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    },
    onError: (error) => {
      alert(`Hold failed: ${error.message}`);
    },
  });

  const unholdFundMutation = useMutation({
    mutationFn: unholdFund,
    onSuccess: () => {
      queryClient.invalidateQueries(["userWalletTransactions"]);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    },
    onError: (error) => {
      alert(`Unhold failed: ${error.message}`);
    },
  });

  // Form Fields for Request Fund
  const requestFundFields = [
    { label: "User ID", name: "user_id", type: "text", required: true, placeholder: "Enter user ID" },
    { label: "Amount", name: "amount", type: "number", required: true, min: 1, placeholder: "Enter amount" },
    { label: "Reason", name: "reason", type: "text", required: true, placeholder: "Enter reason" },
  ];

  // Table Columns with Action Buttons
  const requestColumns = [
    { header: "ID", key: "id" },
    { header: "Type", key: "type" },
    { header: "Amount", key: "amount", render: (amount) => `₹${parseFloat(amount || 0).toFixed(2)}` },
    {
      header: "Status",
      key: "status",
      render: (status) => (
        <span
          className={`px-2 py-1 rounded-full text-xs font-semibold ${status === "completed"
              ? "bg-green-100 text-green-800"
              : status === "pending"
                ? "bg-yellow-100 text-yellow-800"
                : "bg-red-100 text-red-800"
            }`}
        >
          {status || "N/A"}
        </span>
      ),
    },
    { header: "Reason", key: "reason" },
    { header: "Requested By", key: "requested_by" },
    { header: "Approved By", key: "approved_by" },
    { header: "Date", key: "createdAt", render: (date) => new Date(date).toLocaleString() },
    {
      header: "Actions",
      key: "id",
      render: (id, row) =>
        row ? (
          <div className="flex gap-2">
            {row.type?.toLowerCase() === "request" && row.status?.toLowerCase() === "pending" && (
              <button
                onClick={() => transferFundMutation.mutate(id)}
                disabled={transferFundMutation.isPending}
                className="flex items-center gap-1 bg-indigo-500 text-white px-2 py-1 rounded-md hover:bg-indigo-600 transition disabled:opacity-50"
              >
                <Send size={16} />
                Send
              </button>
            )}
            {row.type?.toLowerCase() === "request" && row.status?.toLowerCase() === "pending" && (
              <button
                onClick={() => holdFundMutation.mutate(id)}
                disabled={holdFundMutation.isPending}
                className="flex items-center gap-1 bg-yellow-500 text-white px-2 py-1 rounded-md hover:bg-yellow-600 transition disabled:opacity-50"
              >
                <Lock size={16} />
                Hold
              </button>
            )}
            {row.type?.toLowerCase() === "hold" && row.status?.toLowerCase() === "pending" && (
              <button
                onClick={() => unholdFundMutation.mutate(id)}
                disabled={unholdFundMutation.isPending}
                className="flex items-center gap-1 bg-green-500 text-white px-2 py-1 rounded-md hover:bg-green-600 transition disabled:opacity-50"
              >
                <Unlock size={16} />
                Unhold
              </button>
            )}
          </div>
        ) : null,
    },
  ];

  // Handle form submission
  const handleSubmit = (formData) => {
    requestFundMutation.mutate(formData);
  };

  const getStatusBadgeClass = (status) => {
    if (status === "completed") return "bg-green-100 text-green-800";
    if (status === "pending") return "bg-yellow-100 text-yellow-800";
    return "bg-red-100 text-red-800";
  };

  return (
    <div className="min-h-screen ">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-4  ">
          <h1 className="text-2xl font-semibold">Wallet Management</h1>
          <button
            onClick={() => setActiveModal("request")}
            className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition"
          >
            <Plus size={20} />
            Request Fund
          </button>
        </div>

        {/* Filters */}
        <div className="bg-white p-6 rounded-xl shadow-md mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            <div className="flex flex-wrap gap-2 md:gap-4 md:flex-nowrap">
              {transactionTypes.map((type) => (
                <button
                  key={type}
                  onClick={() => setSelectedType(type)}
                  className={`px-4 py-2 rounded-md text-sm font-semibold transition whitespace-nowrap ${selectedType === type
                      ? "bg-indigo-500 text-white"
                      : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                    }`}
                >
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </button>
              ))}
            </div>
            <div>
              <Select
                options={statusOptions}
                value={selectedStatus}
                onChange={setSelectedStatus}
                placeholder="Select status..."
                isClearable
                className="basic-single"
                classNamePrefix="select"
              />
            </div>
          </div>

          {/* Transactions Table */}
          <Card title="Wallet Transactions">
            {transactionsLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="animate-spin h-8 w-8 text-primary" />
              </div>
            ) : transactions.length === 0 ? (
              <p className="text-gray-500 text-center py-4">No transactions found.</p>
            ) : (
              <>
                <div className="md:hidden space-y-3">
                  {transactions.map((row) => (
                    <div key={row.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-gray-900">#{row.id}</p>
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-semibold ${getStatusBadgeClass(
                            row.status
                          )}`}
                        >
                          {row.status || "N/A"}
                        </span>
                      </div>

                      <p className="text-sm text-gray-700">
                        <span className="font-medium">Type:</span> {row.type || "N/A"}
                      </p>
                      <p className="text-sm text-gray-700">
                        <span className="font-medium">Amount:</span> {"\u20B9"}
                        {parseFloat(row.amount || 0).toFixed(2)}
                      </p>
                      <p className="text-sm text-gray-700 break-words">
                        <span className="font-medium">Reason:</span> {row.reason || "-"}
                      </p>
                      <p className="text-sm text-gray-700">
                        <span className="font-medium">Requested By:</span> {row.requested_by || "-"}
                      </p>
                      <p className="text-sm text-gray-700">
                        <span className="font-medium">Approved By:</span> {row.approved_by || "-"}
                      </p>
                      <p className="text-sm text-gray-700">
                        <span className="font-medium">Date:</span>{" "}
                        {row.createdAt ? new Date(row.createdAt).toLocaleString() : "N/A"}
                      </p>

                      <div className="flex flex-wrap gap-2 pt-1">
                        {row.type?.toLowerCase() === "request" && row.status?.toLowerCase() === "pending" && (
                          <button
                            onClick={() => transferFundMutation.mutate(row.id)}
                            disabled={transferFundMutation.isPending}
                            className="flex items-center gap-1 bg-indigo-500 text-white px-2 py-1 rounded-md hover:bg-indigo-600 transition disabled:opacity-50 text-sm"
                          >
                            <Send size={14} />
                            Send
                          </button>
                        )}
                        {row.type?.toLowerCase() === "request" && row.status?.toLowerCase() === "pending" && (
                          <button
                            onClick={() => holdFundMutation.mutate(row.id)}
                            disabled={holdFundMutation.isPending}
                            className="flex items-center gap-1 bg-yellow-500 text-white px-2 py-1 rounded-md hover:bg-yellow-600 transition disabled:opacity-50 text-sm"
                          >
                            <Lock size={14} />
                            Hold
                          </button>
                        )}
                        {row.type?.toLowerCase() === "hold" && row.status?.toLowerCase() === "pending" && (
                          <button
                            onClick={() => unholdFundMutation.mutate(row.id)}
                            disabled={unholdFundMutation.isPending}
                            className="flex items-center gap-1 bg-green-500 text-white px-2 py-1 rounded-md hover:bg-green-600 transition disabled:opacity-50 text-sm"
                          >
                            <Unlock size={14} />
                            Unhold
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="hidden md:block">
                  <Table columns={requestColumns} data={transactions} />
                </div>
              </>
            )}
          </Card>
        </div>

        {/* Modal for Request Fund */}
        {activeModal === "request" && (
          <div className="fixed inset-0 bg-gray-800 bg-opacity-75 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-xl shadow-lg w-full max-w-md">
              <h2 className="text-2xl font-semibold text-primary mb-4">Request Fund</h2>
              <DynamicForm
                fields={requestFundFields}
                onSubmit={handleSubmit}
                buttonLabel="Request"
                buttonClass="bg-primary hover:bg-indigo-700 text-white"
              />
              <button
                onClick={() => setActiveModal(null)}
                className="mt-4 w-full bg-gray-300 text-gray-800 py-2 rounded-lg hover:bg-gray-400 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Success Message */}
        {showSuccess && (
          <div className="fixed bottom-6 right-6 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-2 animate-fade-in">
            <CheckCircle size={20} /> Action completed successfully!
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

// Reusable Card Component
const Card = ({ title, children }) => (
  <div className=" py-6">
    <h2 className="text-xl font-semibold text-gray-800 mb-4 border-b pb-2">{title}</h2>
    {children}
  </div>
);

export default Wallet;
