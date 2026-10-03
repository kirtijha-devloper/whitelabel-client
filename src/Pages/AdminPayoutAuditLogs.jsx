import React, { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { getBranchXPayoutAuditLogs } from '../api/branchxApi';

const formatDateTime = (value) => {
  if (!value) return '-';
  const date = new Date(value);
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

const todayValue = () => new Date().toISOString().slice(0, 10);

const extractRequestId = (log) => {
  if (!log) return null;
  if (log.request_id) return log.request_id;
  const details = log.details || {};
  return (
    details.requestId ||
    details.request_id ||
    details.reference_id ||
    details.branchxResponse?.data?.requestId ||
    null
  );
};

const renderDetailField = (label, value) => {
  if (value == null || value === '') return null;
  return (
    <div>
      <span className="font-medium text-gray-700">{label}:</span>{' '}
      <span className="text-gray-900">{String(value)}</span>
    </div>
  );
};

const renderDetailObject = (details = {}) => {
  const entries = Object.entries(details);
  if (entries.length === 0) return null;

  return (
    <div className="mt-4 rounded-2xl bg-white p-4 text-sm text-gray-700">
      <div className="font-semibold text-gray-800 mb-3">All Detail Fields</div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {entries.map(([key, value]) => (
          <div key={key} className="rounded-xl bg-gray-50 p-3">
            <p className="text-[11px] uppercase tracking-wide text-gray-500">{key}</p>
            <pre className="mt-1 overflow-x-auto whitespace-pre-wrap text-xs text-gray-900">{typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}</pre>
          </div>
        ))}
      </div>
    </div>
  );
};

const AdminPayoutAuditLogs = () => {
  const [filters, setFilters] = useState({
    fromDate: todayValue(),
    toDate: todayValue(),
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [groups, setGroups] = useState([]);
  const [meta, setMeta] = useState({});

  const fetchLogs = async (params = {}) => {
    setLoading(true);
    setError(null);
    try {
      const result = await getBranchXPayoutAuditLogs(params);
      setGroups(Array.isArray(result?.data) ? result.data : []);
      setMeta({
        fromDate: result?.fromDate || params.fromDate || todayValue(),
        toDate: result?.toDate || params.toDate || todayValue(),
        totalGroups: result?.totalGroups ?? (Array.isArray(result?.data) ? result.data.length : 0),
      });
    } catch (err) {
      setError(err?.message || 'Unable to fetch audit logs.');
      toast.error(err?.message || 'Unable to fetch audit logs.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  const handleApply = (event) => {
    event.preventDefault();
    const params = {};
    if (filters.fromDate) params.fromDate = filters.fromDate;
    if (filters.toDate) params.toDate = filters.toDate;
    fetchLogs(params);
  };

  const handleReset = () => {
    const resetValues = { fromDate: todayValue(), toDate: todayValue() };
    setFilters(resetValues);
    fetchLogs();
  };

  return (
    <div className="min-h-screen bg-transparent px-0 py-1 sm:bg-gray-50 sm:p-6">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Payout Audit Logs</h1>
          <p className="mt-2 text-sm text-gray-600 max-w-2xl">
            View BranchX payout audit activity grouped by payout transaction. Use the date filter to widen the default today range.
          </p>
        </div>
        <div className="rounded-2xl bg-white p-4 shadow-sm border border-gray-200">
          <div className="text-xs uppercase tracking-wide text-gray-500">Result summary</div>
          <div className="mt-2 text-sm text-gray-800">
            Groups: <span className="font-semibold">{meta.totalGroups ?? 0}</span>
          </div>
          <div className="mt-1 text-sm text-gray-600">
            {meta.fromDate && meta.toDate ? `${meta.fromDate} → ${meta.toDate}` : 'Default today range'}
          </div>
        </div>
      </div>

      <div className="mb-6 rounded-2xl bg-white p-5 shadow-sm">
        <form onSubmit={handleApply} className="grid gap-4 md:grid-cols-[220px_220px_auto] md:items-end">
          <div>
            <label htmlFor="fromDate" className="block text-xs font-medium text-gray-700 mb-2">
              From Date
            </label>
            <input
              id="fromDate"
              name="fromDate"
              type="date"
              value={filters.fromDate}
              onChange={handleChange}
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
          <div>
            <label htmlFor="toDate" className="block text-xs font-medium text-gray-700 mb-2">
              To Date
            </label>
            <input
              id="toDate"
              name="toDate"
              type="date"
              value={filters.toDate}
              onChange={handleChange}
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              className="rounded-lg bg-[#00D3CD] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
            >
              Apply Filter
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              Reset
            </button>
          </div>
        </form>
      </div>

      <div className="rounded-2xl bg-white p-5 shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-gray-500">
            Loading audit logs...
          </div>
        ) : error ? (
          <div className="text-center py-16 text-red-500">{error}</div>
        ) : groups.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            No audit logs found for the selected range.
          </div>
        ) : (
          <div className="space-y-6">
            {groups.map((group) => {
              const groupRequestId = extractRequestId(group.logs?.[0]) || 'Not available';
              return (
                <div key={`group-${group.payout_id ?? 'null'}`} className="rounded-3xl border border-gray-200 p-5">
                  <div className="flex flex-col gap-2 border-b border-gray-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="text-sm font-semibold text-gray-500">Payout ID</div>
                      <div className="mt-1 text-lg font-bold text-gray-900">
                        {group.payout_id != null ? group.payout_id : 'Not available'}
                      </div>
                    </div>
                    <div className="text-sm text-gray-600">
                      <div className="font-medium text-gray-700">Request ID</div>
                      <div className="mt-1">{groupRequestId}</div>
                    </div>
                  </div>

                  <div className="mt-4 space-y-4">
                    {Array.isArray(group.logs) && group.logs.map((log) => {
                      const details = log.details || {};
                      return (
                        <div key={log.id} className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <div className="text-sm font-semibold text-gray-900">{log.action || 'Unknown action'}</div>
                              <div className="text-xs text-gray-500">{formatDateTime(log.created_at)}</div>
                            </div>
                            <div className="rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase tracking-wide text-gray-700 shadow-sm">
                              Log ID: {log.id}
                            </div>
                          </div>

                          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                            {renderDetailField('Request ID', extractRequestId(log) || 'Not available')}
                            {renderDetailField('From', details.from || details.status)}
                            {renderDetailField('To', details.to || details.responseStatus)}
                            {renderDetailField('Response Status', details.responseStatus || details.rawStatus)}
                            {renderDetailField('Reason', details.reason || details.failureReason || details.message)}
                            {renderDetailField('Status Code', details.statusCode)}
                          </div>

                          {renderDetailObject(details)}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminPayoutAuditLogs;
