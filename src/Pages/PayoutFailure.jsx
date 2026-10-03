import { useLocation, useNavigate } from 'react-router-dom';
import { XCircle, ArrowLeft, FileText, Home } from 'lucide-react';

const InfoRow = ({ label, value }) => {
  if (!value && value !== 0) return null;
  return (
    <div className="flex justify-between py-2 border-b border-gray-100 last:border-0">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm font-medium text-gray-800 text-right max-w-[60%] break-all">{value}</span>
    </div>
  );
};

export default function PayoutFailure() {
  const { state } = useLocation();
  const navigate = useNavigate();

  const role = String(state?.role || 'merchant').trim().toLowerCase();
  const normalizedRole = role === 'franchaise' ? 'franchise' : role;
  const message = state?.errorMessage || 'Payout failed. Please try again.';
  const status = state?.errorStatus;
  const amount = state?.payoutPayload?.amount || state?.payoutData?.amount;
  const merchantRefId = state?.payoutPayload?.merchantRefId || state?.payoutData?.merchantRefId;

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-gray-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg w-full max-w-md p-6">
        <div className="flex flex-col items-center mb-6">
          <div className="bg-red-100 rounded-full p-4 mb-3">
            <XCircle className="text-red-600 w-10 h-10" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">Payout Failed</h1>
          <p className="text-sm text-gray-500 mt-1 text-center">{message}</p>
        </div>

        <div className="mb-6 rounded-2xl border border-red-100 bg-red-50 p-4">
          <InfoRow label="Status" value={status ? `Error ${status}` : 'Failed'} />
          <InfoRow label="Amount" value={amount != null ? `₹${Number(amount).toLocaleString('en-IN')}` : undefined} />
          <InfoRow label="Reference" value={merchantRefId || undefined} />
        </div>

        <div className="grid gap-3">
          <button
            type="button"
            onClick={() => navigate(`/${normalizedRole}/vimo-payout`, { replace: true })}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white py-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <ArrowLeft size={16} />
            Start Again
          </button>
          <button
            type="button"
            onClick={() => navigate(`/${normalizedRole}/reports/payout`)}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 py-3 text-sm font-medium text-white hover:bg-indigo-700"
          >
            <FileText size={16} />
            Payout Report
          </button>
          <button
            type="button"
            onClick={() => navigate(`/${normalizedRole}/dashboard`)}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white py-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <Home size={16} />
            Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
