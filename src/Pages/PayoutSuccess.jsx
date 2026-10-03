import { useLocation, useNavigate } from 'react-router-dom';
import { CheckCircle, ArrowLeft, FileText } from 'lucide-react';

const Field = ({ label, value }) => {
  if (!value && value !== 0) return null;
  return (
    <div className="flex justify-between py-2 border-b border-gray-100 last:border-0">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm font-medium text-gray-800 text-right max-w-[60%] break-all">{value}</span>
    </div>
  );
};

export default function PayoutSuccess() {
  const { state } = useLocation();
  const navigate = useNavigate();

  const data = state?.payoutData ?? {};
  const payload = state?.payoutPayload ?? {};
  const role = String(state?.role || 'merchant').trim().toLowerCase();
  const normalizedRole = role === 'franchaise' ? 'franchise' : role;

  const txnId = data?.transaction_id ?? data?.txnId ?? data?.transactionId ?? data?.refId ?? payload?.merchantRefId ?? '—';
  const status = data?.status ?? data?.txnStatus ?? 'Processing';
  const amount = data?.amount ?? payload?.amount;
  const beneficiaryName = data?.beneficiaryName ?? payload?.beneficiaryName ?? '—';
  const accountNumber = data?.beneficiaryAccountNumber ?? payload?.beneficiaryAccountNumber ?? '—';
  const ifsc = data?.beneficiaryIFSC ?? payload?.beneficiaryIFSC ?? '—';
  const bank = data?.beneficiaryBank ?? payload?.beneficiaryBank ?? '—';
  const mobile = data?.beneficiaryMobileNumber ?? payload?.beneficiaryMobileNumber ?? '—';
  const message = data?.message ?? 'Payout submitted successfully';

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-gray-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg w-full max-w-md p-6">
        {/* Success header */}
        <div className="flex flex-col items-center mb-6">
          <div className="bg-emerald-100 rounded-full p-4 mb-3">
            <CheckCircle className="text-emerald-600 w-10 h-10" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">Payout Submitted</h1>
          <p className="text-sm text-gray-500 mt-1 text-center">{message}</p>
          <p className="text-sm text-gray-500 mt-2 text-center">
            Your payout request is successfully submitted and is being processed securely.
          </p>
        </div>

        {/* Amount highlight */}
        {amount != null && (
          <div className="bg-emerald-50 rounded-xl py-4 text-center mb-5">
            <p className="text-xs uppercase tracking-widest text-emerald-600 mb-1">Amount Transferred</p>
            <p className="text-3xl font-bold text-emerald-700">₹{Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
          </div>
        )}

        {/* Transaction details */}
        <div className="mb-6">
          <Field label="Transaction / Ref ID" value={txnId} />
          <Field label="Status" value={status} />
          <Field label="Beneficiary Name" value={beneficiaryName} />
          <Field label="Account Number" value={accountNumber} />
          <Field label="IFSC Code" value={ifsc} />
          <Field label="Bank" value={bank} />
          <Field label="Mobile" value={mobile} />
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => navigate(state?.returnPath || `/${normalizedRole}/vimo-payout`)}
            className="flex-1 flex items-center justify-center gap-2 rounded-lg border border-gray-300 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <ArrowLeft size={16} />
            New Payout
          </button>
          <button
            type="button"
            onClick={() => navigate(`/${normalizedRole}/reports/payout`)}
            className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-indigo-600 py-2.5 text-sm font-medium text-white hover:bg-indigo-700"
          >
            <FileText size={16} />
            Payout Report
          </button>
        </div>
      </div>
    </div>
  );
}
