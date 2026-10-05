import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Table from "../components/Table";
import { useNavigate, useLocation } from "react-router-dom";
import { getPosTransactionReport } from "../api/reportsApi";
import { Loader2 } from "lucide-react";

const AllPOSTxnReport = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const reportsHomePath = location.pathname.startsWith('/super-franchise')
    ? '/super-franchise/reports'
    : location.pathname.startsWith('/franchise')
      ? '/franchise/reports'
      : location.pathname.startsWith('/merchant')
        ? '/merchant/reports'
        : '/admin/reports';
  const [filters, setFilters] = useState({
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    status: "",
    cardHolderName: "",
    posTxnNo: "",
    deviceNo: "",
  });

  const { data: reportResponse, isLoading, isError, error } = useQuery({
    queryKey: ['posTransactionReport', filters],
    queryFn: () => getPosTransactionReport(filters),
    keepPreviousData: true,
  });

  const reportData = reportResponse?.data || [];

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  const reportColumns = [
    { header: "ID", key: "id" },
    {
      header: "Date",
      key: "Date",
      render: (date) => (date ? new Date(date).toLocaleDateString() : "-"),
    },
    { header: "Amount", key: "Amount", render: (amount) => (amount ? `₹${parseFloat(amount).toFixed(2)}` : "-") },
    { header: "Consumer", key: "Consumer" },
    {
      header: "Status",
      key: "Status",
      render: (status) => (
        <span
          className={`px-2 py-1 rounded-full text-xs font-semibold ${status?.toLowerCase() === "completed" || status?.toLowerCase() === "success"
              ? "bg-green-100 text-green-800"
              : "bg-red-100 text-red-800"
            }`}
        >
          {status || "N/A"}
        </span>
      ),
    },
    { header: "Invoice", key: "Invoice" },
    { header: "Device Serial", key: "DeviceSerial" },
  ];

  return (
    <div className="p-6 bg-gray-100 min-h-screen">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">All POS Txn Report</h1>
        <button
          onClick={() => navigate(reportsHomePath)}
          className="bg-gray-500 text-white py-2 px-4 rounded-md hover:bg-gray-600 transition"
        >
          Back to Reports
        </button>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-md mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
            <input
              type="date"
              name="startDate"
              value={filters.startDate}
              onChange={handleFilterChange}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
            <input
              type="date"
              name="endDate"
              value={filters.endDate}
              onChange={handleFilterChange}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              name="status"
              value={filters.status}
              onChange={handleFilterChange}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">All</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="animate-spin h-8 w-8 text-indigo-600" />
          </div>
        ) : isError ? (
          <p className="text-red-600">Error: {error.message}</p>
        ) : reportData.length === 0 ? (
          <p className="text-gray-500 text-center py-6">No data available</p>
        ) : (
          <Table columns={reportColumns} data={reportData} />
        )}
      </div>
    </div>
  );
};

export default AllPOSTxnReport;
