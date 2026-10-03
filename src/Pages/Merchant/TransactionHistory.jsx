import React from 'react';
import { impsTransactionList } from '../../api/financialApi';
import { useQuery } from '@tanstack/react-query';
import Table from '../../components/Table';
import { useLocation, useNavigate } from 'react-router-dom';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

const TransactionHistory = () => {
  const { state } = useLocation();
  const navigate = useNavigate();
  const user = state;

  // Redirect if no remitter_id
  if (!user?.remitter_id) {
    navigate('/merchant/payout');
    toast.error('No Remitter ID provided');
    return null;
  }

  const { data: transactionsData, isLoading: transactionsLoading, error: transactionsError } = useQuery({
    queryKey: ['impsTransactionList', user.remitter_id],
    queryFn: () => impsTransactionList({ remitter_id: user.remitter_id }),
    enabled: !!user.remitter_id,
  });

  const transactions = transactionsData?.transactions?.map((txn, index) => ({
    id: txn.id || index + 1,
    txn_no: txn.txn_no,
    utr_no: txn.utr_no,
    amount: `₹${parseFloat(txn.amount || 0).toFixed(2)}`,
    bank_name: txn.bank_name,
    ifsc_code: txn.ifsc_code,
    mobile: txn.mobile_number,
    status: txn.status || 'pending',
    date: new Date(txn.date_time || Date.now()).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    }),
  })) || [];

  console.log(transactions, "all Transactions");

  const columns = [
    {
      header: 'ID',
      key: 'id',
    },
    {
      header: 'Txn No.',
      key: 'txn_no',
    },
    {
      header: 'Utr No.',
      key: 'utr_no',
    },
    {
      header: 'Amount',
      key: 'amount',
    },
    {
      header: 'Bank Name',
      key: 'bank_name',
    },
    {
      header: 'IFSC Code',
      key: 'ifsc_code',
    },
    {
      header: 'Mobile No.',
      key: 'mobile',
    },
    {
      header: 'Status',
      key: 'status',
      render: (status) => (
        <span
          className={`px-2 py-1 rounded-full text-sm ${
            status === 'completed'
              ? 'bg-green-100 text-green-700'
              : status === 'pending'
              ? 'bg-yellow-100 text-yellow-700'
              : 'bg-red-100 text-red-700'
          }`}
        >
          {status}
        </span>
      ),
    },
    {
      header: 'Date',
      key: 'date',
    },
  ];

  const handleExportToExcel = () => {
    if (transactions.length === 0) {
      toast.warn('No transactions to export');
      return;
    }

    // Prepare data for export (remove JSX from status)
    const exportData = transactions.map(({ id, txn_no, utr_no, mobile, amount, status,ifsc_code, date }) => ({
      ID: id,
      TransactionId: txn_no,
      UtrNo: utr_no,
      Amount: amount,
      Mobile: mobile,
      IFSCCode: ifsc_code,
      Status: status, 
      Date: date,
    }));

    // Create worksheet and workbook
    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Transactions');

    // Generate Excel file
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/octet-stream' });
    saveAs(blob, 'TransactionHistory.xlsx');

    toast.success('Transactions exported to Excel');
  };

  if (transactionsLoading) {
    return <div className="p-6">Loading...</div>;
  }

  if (transactionsError) {
    return <div className="p-6">Error loading transactions</div>;
  }

  return (
    <div className="overflow-x-scroll max-w-[90vw] p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">Recent Transactions</h2>
        <button
          onClick={handleExportToExcel}
          className="bg-[#00D3CD] text-white px-4 py-2 rounded-lg hover:bg-[#00bdb7] transition-colors"
        >
          Export to Excel
        </button>
      </div>
      <div>
        <Table
          columns={columns}
          data={transactions}
        />
      </div>
      <ToastContainer
        position="top-right"
        autoClose={5000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="light"
      />
    </div>
  );
};

export default TransactionHistory;