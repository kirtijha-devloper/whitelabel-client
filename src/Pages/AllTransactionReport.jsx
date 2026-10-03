import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft, Search, RotateCcw, Download, Eye, Layers, Banknote, CreditCard, Settings, Loader2
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { toast } from 'react-toastify';
import { getLedgerStatements } from '../api/ledgerApi';

const AllTransactionReport = () => {
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('All Transactions');
  const [filters, setFilters] = useState({
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    searchQuery: ''
  });

  const { data: reportResponse, isLoading, isError, error } = useQuery({
    queryKey: ['allTransactionsReport', filters, activeTab],
    queryFn: () => getLedgerStatements({
      ...filters,
      ...(activeTab !== 'All Transactions' && { service: activeTab })
    }),
    keepPreviousData: true,
  });

  const reportData = reportResponse?.data || [];

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const resetFilters = () => {
    setFilters({
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date().toISOString().split('T')[0],
      searchQuery: ''
    });
    setActiveTab('All Transactions');
  };

  const tabs = [
    { name: 'All Transactions', icon: <Layers className="w-4 h-4" /> },
    { name: 'Payout', icon: <Banknote className="w-4 h-4" /> },
    { name: 'CC Bill Payment', icon: <CreditCard className="w-4 h-4" /> },
    { name: 'POS Settlement', icon: <Settings className="w-4 h-4" /> }
  ];

  const getServiceBadgeConfig = (service) => {
    switch (service) {
      case 'Payout': return "bg-blue-100 text-blue-800";
      case 'CC Bill Payment': return "bg-orange-100 text-orange-800";
      case 'POS Settlement': return "bg-green-100 text-green-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const handleExportCSV = () => {
    if (reportData.length === 0) {
      toast.warn("No data to export!");
      return;
    }
    const exportData = reportData.map((row) => ({
      "#": row.id,
      "Date Time": new Date(row.date_and_time).toLocaleString(),
      "User Name": row.user?.name || '',
      "User ID": row.user?.id || '',
      "Order ID": row.utr_no || '',
      "Service": row.description,
      "Opening": row.opening_balance,
      "Credit": row.credit,
      "Debit": row.debit,
      "Closing": row.balance
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "All_Transaction_Report");
    const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    const dataBlob = new Blob([excelBuffer], { type: "application/octet-stream" });
    saveAs(dataBlob, `All_Transaction_Report_${new Date().getTime()}.xlsx`);
    toast.success("CSV Export successful!");
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-full hover:bg-gray-200 transition text-gray-600"
            title="Go Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-2xl font-bold text-gray-800">All Transaction Report</h2>
            <p className="text-sm text-gray-500 mt-1">View and manage all your transactions here</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-4 border-b border-gray-200 flex flex-wrap gap-4 items-center justify-between bg-gray-50 rounded-t-lg">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-600">From:</label>
              <input
                type="date"
                name="startDate"
                value={filters.startDate}
                onChange={handleFilterChange}
                className="border border-gray-300 rounded-md px-3 py-1.5 text-sm outline-none"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-600">To:</label>
              <input
                type="date"
                name="endDate"
                value={filters.endDate}
                onChange={handleFilterChange}
                className="border border-gray-300 rounded-md px-3 py-1.5 text-sm outline-none"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                name="searchQuery"
                value={filters.searchQuery}
                onChange={handleFilterChange}
                placeholder="Search..."
                className="pl-9 pr-4 py-1.5 border border-gray-300 rounded-md text-sm w-[200px]"
              />
            </div>
            <button onClick={resetFilters} className="p-1.5 border border-gray-300 rounded-md text-gray-600 hover:bg-gray-100">
              <RotateCcw className="w-4 h-4" />
            </button>
            <button onClick={handleExportCSV} className="flex items-center gap-2 bg-[#00D3CD] text-white px-4 py-1.5 rounded-md text-sm font-medium hover:bg-[#00b8b3] transition">
              <Download className="w-4 h-4" /> Export
            </button>
          </div>
        </div>

        <div className="px-4 pt-4 flex gap-4 border-b border-gray-200">
          {tabs.map((tab) => (
            <button
              key={tab.name}
              onClick={() => setActiveTab(tab.name)}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === tab.name
                ? 'border-[#00D3CD] text-[#00D3CD]'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
            >
              {tab.icon} {tab.name}
            </button>
          ))}
        </div>

        <div className="overflow-x-auto w-full">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="animate-spin h-10 w-10 text-[#00D3CD]" />
            </div>
          ) : isError ? (
            <div className="text-center py-12 text-red-600">Error: {error.message}</div>
          ) : (
            <table className="w-full min-w-max text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-xs text-gray-500 uppercase">
                  <th className="px-4 py-3 font-medium text-center">#</th>
                  <th className="px-4 py-3 font-medium">Date & Time</th>
                  <th className="px-4 py-3 font-medium">User Details</th>
                  <th className="px-4 py-3 font-medium">Order ID</th>
                  <th className="px-4 py-3 font-medium text-center">Service</th>
                  <th className="px-4 py-3 font-medium text-right">Opening (₹)</th>
                  <th className="px-4 py-3 font-medium text-right">Credit (₹)</th>
                  <th className="px-4 py-3 font-medium text-right">Debit (₹)</th>
                  <th className="px-4 py-3 font-medium text-right">Closing (₹)</th>
                  <th className="px-4 py-3 font-medium text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white text-sm text-gray-700">
                {reportData.map(row => {
                  const badgeClasses = getServiceBadgeConfig(row.service || 'General');
                  return (
                    <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-center">{row.id}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div>{new Date(row.date_and_time).toLocaleDateString()}</div>
                        <div className="text-xs text-gray-500">{new Date(row.date_and_time).toLocaleTimeString()}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{row.user?.name || '-'}</div>
                        <div className="text-xs text-gray-500">{row.user?.id || ''}</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-gray-600">{row.utr_no}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-center">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badgeClasses}`}>
                          {row.description || 'General'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">{parseFloat(row.opening_balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      <td className="px-4 py-3 text-right text-green-600 font-medium">
                        {row.credit > 0 ? `+${parseFloat(row.credit).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-'}
                      </td>
                      <td className="px-4 py-3 text-right text-red-600 font-medium">
                        {row.debit > 0 ? `-${parseFloat(row.debit).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-'}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-900">
                        {parseFloat(row.balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button className="text-[#00D3CD] hover:text-[#00b8b3] transition">
                          <Eye className="w-4 h-4 mx-auto" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {reportData.length === 0 && (
                  <tr>
                    <td colSpan="10" className="px-4 py-8 text-center text-gray-500 bg-gray-50">
                      No transactions found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default AllTransactionReport;
