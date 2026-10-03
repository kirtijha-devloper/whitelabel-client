import React, { useState } from 'react';
import { Download } from 'lucide-react';
import { toast } from 'react-toastify';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import Modal from '../Modal';
import { getAllCCBillPaymentReport, getPayoutReport } from '../../api/reportsApi';
import { getAllBillAvenuePayments } from '../../api/billAvenueApi';

const inputClassName =
  'w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent';

const COMBINED_EXPORT_FETCH_LIMIT = 200;
const CC_BILL_SUCCESS_STATUS_CODES = new Set(['TXN', 'TUP']);
const CC_BILL_PENDING_STATUS_CODES = new Set(['PEN', 'PENDING', 'PROCESSING', 'INP', 'INIT', 'INITIATED']);

const formatPayoutDate = (value) => {
  if (!value) return '-';
  const d = new Date(value);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  let h = d.getHours();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  const min = String(d.getMinutes()).padStart(2, '0');
  const sec = String(d.getSeconds()).padStart(2, '0');
  return `${dd}-${mm}-${yyyy} ${h}:${min}:${sec} ${ampm}`;
};

const formatDateTime = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
};

const getNormalizedPayoutStatusKey = (status) => {
  const normalized = String(status || '').trim().toUpperCase();
  if (!normalized) return '';
  if (normalized === 'COMPLETED') return 'SUCCESS';
  if (normalized === 'PROCESSING' || normalized === 'IN_PROGRESS' || normalized === 'INPROCESS') {
    return 'PENDING';
  }
  return normalized;
};

const normalizePayoutStatus = (status) => getNormalizedPayoutStatusKey(status) || '-';

const getNormalizedPayoutProviderKey = (rowOrProvider) => {
  const row = rowOrProvider && typeof rowOrProvider === 'object' ? rowOrProvider : null;
  const provider = String(row ? row?.payout_provider : rowOrProvider || '').trim().toLowerCase();
  const referenceId = String(row?.reference_id || row?.referenceId || '').trim().toUpperCase();

  if (provider.includes('branchx')) return 'branchx';
  if (provider.includes('sevenpay')) return 'sevenpay';
  if (provider.includes('vimo')) return 'vimo';
  if (provider.includes('credxpay')) return 'credxpay';
  if (provider.includes('payout-m-x') || provider.includes('mx') || provider.includes('merorecharge')) return 'mx_payout';
  if (referenceId.startsWith('APB')) return 'branchx';
  if (referenceId.startsWith('APS')) return 'sevenpay';
  if (referenceId.startsWith('APV')) return 'vimo';
  if (referenceId.startsWith('APC') || referenceId.startsWith('PX')) return 'credxpay';
  if (referenceId.startsWith('APM')) return 'mx_payout';

  return provider;
};

const fetchAllPayoutReportRows = async (filters = {}) => {
  const firstResponse = await getPayoutReport({
    ...filters,
    page: 1,
    limit: COMBINED_EXPORT_FETCH_LIMIT,
  });

  const firstRows = Array.isArray(firstResponse?.data) ? firstResponse.data : [];
  const totalPages = Number(firstResponse?.pagination?.totalPages || 1);

  if (totalPages <= 1) {
    return firstRows;
  }

  const remainingPages = await Promise.all(
    Array.from({ length: totalPages - 1 }, (_, index) => {
      const page = index + 2;
      return getPayoutReport({
        ...filters,
        page,
        limit: COMBINED_EXPORT_FETCH_LIMIT,
      }).then((response) => (Array.isArray(response?.data) ? response.data : []));
    })
  );

  return [firstRows, ...remainingPages].flat();
};

const mapPayoutRowsToExport = (rows = [], startIndex = 1) =>
  rows.map((row, idx) => ({
    '#': startIndex + idx,
    'Date': formatPayoutDate(row.date),
    'Merchant ID': row.merchant_id,
    'Merchant Name': row.merchant?.name || '',
    'Merchant Mobile': row.merchant?.mobile_number || '',
    'Reference ID': row.reference_id,
    'Payout Provider': row.payout_provider || 'Legacy',
    'Beneficiary Name': row.beneficiary?.beneficiary_name || '',
    'Account Number': row.beneficiary?.account_number || '',
    'Bank': row.beneficiary?.bank_name || '',
    'IFSC': row.beneficiary?.ifsc_code || '',
    'Beneficiary Mobile': row.beneficiary?.mobile_number || '',
    'Amount (Rs)': parseFloat(row.amount || 0).toFixed(2),
    'Service Charge (Rs)': parseFloat(row.service_charge || 0).toFixed(2),
    'Total Deducted (Rs)': parseFloat(row.total_deducted || 0).toFixed(2),
    'Purpose': row.purpose,
    'Status': normalizePayoutStatus(row.status),
    'Balance Before (Rs)': parseFloat(row.balance_before || 0).toFixed(2),
    'Balance After (Rs)': parseFloat(row.balance_after || 0).toFixed(2),
  }));

const getNormalizedCcBillStatus = (txn = {}) => {
  const statusCode = String(txn?.statuscode || '').trim().toUpperCase();
  const statusText = String(txn?.status || '').trim().toLowerCase();

  if (CC_BILL_SUCCESS_STATUS_CODES.has(statusCode) || statusText.includes('success')) {
    return 'SUCCESS';
  }

  if (
    CC_BILL_PENDING_STATUS_CODES.has(statusCode) ||
    /(pending|processing|initiated|in progress|queued)/.test(statusText)
  ) {
    return 'PENDING';
  }

  return 'FAILED';
};

const mapCcBillRowsToExport = (rows = [], startIndex = 1) =>
  rows.map((txn, index) => ({
    '#': startIndex + index,
    'Date & Time': formatDateTime(txn.date || txn.date_and_time),
    'User Name': txn.user?.name || '-',
    'User ID': txn.user?.abheepay_id || txn.user?.id || '',
    'Order ID': txn.external_ref || txn.utr_no || '-',
    'Description': txn.description || '',
    'Amount (Rs)': parseFloat(txn.amount || txn.debit || 0).toFixed(2),
    'Closing Balance (Rs)': parseFloat(txn.balance_after ?? txn.balance ?? 0).toFixed(2),
    'Status': getNormalizedCcBillStatus(txn),
  }));

const mapBillAvenueRowsToExport = (rows = [], startIndex = 1) =>
  rows.map((row, index) => ({
    '#': startIndex + index,
    'ID': row.id,
    'Date': row.createdAt ? new Date(row.createdAt).toLocaleString('en-IN') : '-',
    'Biller ID': row.biller_id,
    'Customer Params': JSON.stringify(row.customer_params || {}),
    'Amount (Rs)': parseFloat(row.transaction_amount || 0).toFixed(2),
    'Charge (Rs)': parseFloat(row.charge_amount || 0).toFixed(2),
    'Payment Mode': row.payment_mode || '',
    'Transaction Ref ID': row.transaction_ref_id || '',
    'Response Code': row.response_code || '',
    'Status': row.status || '',
  }));

const getSheetRowsOrPlaceholder = (rows = [], mapper) =>
  rows.length > 0 ? mapper(rows) : [{ Message: 'No records found' }];

const CombinedReportDownloadButton = () => {
  const today = new Date().toISOString().split('T')[0];
  const [isOpen, setIsOpen] = useState(false);
  const [filters, setFilters] = useState({
    from_date: today,
    to_date: today,
  });
  const [isExporting, setIsExporting] = useState(false);

  const openModal = () => {
    setFilters({
      from_date: today,
      to_date: today,
    });
    setIsOpen(true);
  };

  const closeModal = () => {
    if (isExporting) return;
    setIsOpen(false);
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  const handleDownload = async () => {
    const { from_date, to_date } = filters;

    if (!from_date || !to_date) {
      toast.warn('Please select both From Date and To Date.');
      return;
    }

    if (new Date(from_date) > new Date(to_date)) {
      toast.warn('From Date cannot be after To Date.');
      return;
    }

    try {
      setIsExporting(true);

      const [allPayoutRows, ccBillRows, billAvenueRows] = await Promise.all([
        fetchAllPayoutReportRows({ from_date, to_date }),
        getAllCCBillPaymentReport(
          {
            startDate: from_date,
            endDate: to_date,
          },
          { limit: COMBINED_EXPORT_FETCH_LIMIT }
        ),
        getAllBillAvenuePayments({}, { limit: COMBINED_EXPORT_FETCH_LIMIT }),
      ]);

      const vimoPayoutRows = allPayoutRows.filter((row) => getNormalizedPayoutProviderKey(row) === 'vimo');
      const sevenPayPayoutRows = allPayoutRows.filter((row) => getNormalizedPayoutProviderKey(row) === 'sevenpay');
      const branchXPayoutRows = allPayoutRows.filter((row) => getNormalizedPayoutProviderKey(row) === 'branchx');
      const mxPayoutRows = allPayoutRows.filter((row) => getNormalizedPayoutProviderKey(row) === 'mx_payout');

      const workbookSheets = [
        { name: 'Total_Payout', rawRows: allPayoutRows, exportRows: getSheetRowsOrPlaceholder(allPayoutRows, mapPayoutRowsToExport) },
        { name: 'Vimo_Payout', rawRows: vimoPayoutRows, exportRows: getSheetRowsOrPlaceholder(vimoPayoutRows, mapPayoutRowsToExport) },
        { name: 'SevenPay_Payout', rawRows: sevenPayPayoutRows, exportRows: getSheetRowsOrPlaceholder(sevenPayPayoutRows, mapPayoutRowsToExport) },
        { name: 'Branchx_Payout', rawRows: branchXPayoutRows, exportRows: getSheetRowsOrPlaceholder(branchXPayoutRows, mapPayoutRowsToExport) },
        { name: 'Payout_MX_Payout', rawRows: mxPayoutRows, exportRows: getSheetRowsOrPlaceholder(mxPayoutRows, mapPayoutRowsToExport) },
        { name: 'CC_Bill_Payment', rawRows: ccBillRows, exportRows: getSheetRowsOrPlaceholder(ccBillRows, mapCcBillRowsToExport) },
        { name: 'BA_CC_Bill_Payment', rawRows: billAvenueRows, exportRows: getSheetRowsOrPlaceholder(billAvenueRows, mapBillAvenueRowsToExport) },
      ];

      if (workbookSheets.every((sheet) => sheet.rawRows.length === 0)) {
        toast.warn('No data found to export.');
        return;
      }

      const workbook = XLSX.utils.book_new();
      workbookSheets.forEach((sheet) => {
        const worksheet = XLSX.utils.json_to_sheet(sheet.exportRows);
        XLSX.utils.book_append_sheet(workbook, worksheet, sheet.name);
      });

      const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
      const dataBlob = new Blob([excelBuffer], { type: 'application/octet-stream' });
      saveAs(dataBlob, `Combined_Payout_Report_${Date.now()}.xlsx`);
      toast.success('Combined report exported successfully!');
      setIsOpen(false);
    } catch (error) {
      toast.error(error?.message || 'Failed to export combined report');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 md:w-auto"
      >
        <Download className="h-4 w-4" />
        DOWNLOAD ALL DATA
      </button>

      <Modal
        isOpen={isOpen}
        onClose={closeModal}
        title="Download Combined Excel Report"
        className="max-w-xl"
      >
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">From Date</label>
              <input
                type="date"
                name="from_date"
                value={filters.from_date}
                onChange={handleFilterChange}
                className={inputClassName}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">To Date</label>
              <input
                type="date"
                name="to_date"
                value={filters.to_date}
                onChange={handleFilterChange}
                className={inputClassName}
              />
            </div>
          </div>

          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            <span className="font-semibold">BA_CC_Bill_Payment</span> currently uses the available
            BillAvenue listing data and may not follow the selected date range.
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={closeModal}
              disabled={isExporting}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDownload}
              disabled={isExporting}
              className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isExporting ? 'Downloading...' : 'Download'}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
};

export default CombinedReportDownloadButton;
