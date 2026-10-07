import React, { useState } from "react";
import { X, Wallet, ArrowDownRight, ArrowUpRight, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "react-toastify";
import { adminWalletCredit, adminWalletDebit } from "../../api/WalletApi";

const QUICK_AMOUNTS = [500, 1000, 5000, 10000, 50000];

const AdminWalletModal = ({ isOpen, onClose, admin, onSuccess }) => {
  const [action, setAction] = useState("credit"); // 'credit' | 'debit'
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen || !admin) return null;

  const currentBalance = Number(admin.wallet_balance ?? admin.wallet ?? 0);
  const parsedAmount = Number(amount);
  const isValidAmount = Number.isFinite(parsedAmount) && parsedAmount > 0;
  const isDebitExceeding = action === "debit" && isValidAmount && parsedAmount > currentBalance;

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!isValidAmount) {
      toast.error("Please enter a valid amount greater than 0.");
      return;
    }

    if (isDebitExceeding) {
      toast.error(
        `Debit amount (₹${parsedAmount.toLocaleString("en-IN")}) exceeds available balance (₹${currentBalance.toLocaleString("en-IN")}).`
      );
      return;
    }

    try {
      setSubmitting(true);
      const idempotencyKey = `admin-wallet-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const payload = {
        user_id: Number(admin.id),
        amount: parsedAmount,
        reason: reason.trim() || `Admin manual ${action} by Super Admin`,
        idempotency_key: idempotencyKey,
      };

      const res =
        action === "debit"
          ? await adminWalletDebit(payload)
          : await adminWalletCredit(payload);

      toast.success(
        res?.message ||
          `Successfully ${action === "credit" ? "credited" : "debited"} ₹${parsedAmount.toLocaleString("en-IN")} to ${admin.name || "Admin"}.`
      );

      setAmount("");
      setReason("");
      if (typeof onSuccess === "function") {
        onSuccess();
      }
      onClose();
    } catch (err) {
      console.error("[AdminWalletModal] Error adjusting wallet:", err);
      toast.error(err?.message || `Failed to ${action} wallet.`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-[1px] p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl border border-gray-100 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* HEADER */}
        <div className="flex items-start justify-between border-b border-gray-100 bg-gray-50/80 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="rounded-xl bg-blue-50 border border-blue-200 p-2 text-blue-600">
              <Wallet size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">Wallet Management</h2>
              <p className="text-xs text-gray-500">
                {admin.name || "Admin"} • {admin.username || admin.abheepay_id || `ID: ${admin.id}`}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* CURRENT BALANCE BANNER */}
        <div className="bg-gradient-to-br from-blue-600 to-indigo-700 px-6 py-4 text-white">
          <p className="text-xs uppercase tracking-wider text-blue-100 font-medium">
            Current Wallet Balance
          </p>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold tracking-tight">
              ₹{currentBalance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-blue-200">
            Company: {admin.company?.company_name || admin.company_or_shop_name || "N/A"}
          </p>
        </div>

        {/* ADJUSTMENT FORM */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* ACTION SELECTOR (CREDIT / DEBIT) */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
              Adjustment Type
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setAction("credit")}
                className={`flex items-center justify-center gap-2 rounded-xl border p-3 text-sm font-bold transition-all ${
                  action === "credit"
                    ? "border-emerald-500 bg-emerald-50/80 text-emerald-700 shadow-sm ring-2 ring-emerald-400/20"
                    : "border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100"
                }`}
              >
                <ArrowDownRight size={18} className="text-emerald-600" />
                Credit (+)
              </button>

              <button
                type="button"
                onClick={() => setAction("debit")}
                className={`flex items-center justify-center gap-2 rounded-xl border p-3 text-sm font-bold transition-all ${
                  action === "debit"
                    ? "border-rose-500 bg-rose-50/80 text-rose-700 shadow-sm ring-2 ring-rose-400/20"
                    : "border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100"
                }`}
              >
                <ArrowUpRight size={18} className="text-rose-600" />
                Debit (-)
              </button>
            </div>
          </div>

          {/* AMOUNT INPUT */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              Amount (₹) <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-base font-bold text-gray-400">
                ₹
              </span>
              <input
                type="number"
                step="any"
                min="1"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Enter adjustment amount"
                required
                className={`w-full rounded-xl border pl-8 pr-4 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 ${
                  isDebitExceeding
                    ? "border-rose-300 focus:ring-rose-400"
                    : "border-gray-300 focus:border-[#00D3CD] focus:ring-[#00D3CD]/20"
                }`}
              />
            </div>

            {isDebitExceeding && (
              <p className="mt-1 text-xs text-rose-600">
                Debit amount exceeds the available balance (₹{currentBalance.toLocaleString("en-IN")}).
              </p>
            )}

            {/* QUICK AMOUNT BUTTONS */}
            <div className="mt-2 flex flex-wrap gap-1.5">
              {QUICK_AMOUNTS.map((quick) => (
                <button
                  key={quick}
                  type="button"
                  onClick={() => setAmount(String(quick))}
                  className="rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-semibold text-gray-600 hover:border-gray-300 hover:bg-gray-100 transition-colors"
                >
                  +₹{quick.toLocaleString("en-IN")}
                </button>
              ))}
            </div>
          </div>

          {/* REASON / REMARKS */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              Reason / Remarks (Optional)
            </label>
            <textarea
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Manual top-up, settlement adjustment, bonus..."
              className="w-full rounded-xl border border-gray-300 p-2.5 text-xs text-gray-800 placeholder-gray-400 focus:border-[#00D3CD] focus:outline-none focus:ring-2 focus:ring-[#00D3CD]/20"
            />
          </div>

          {/* SUBMIT BUTTON */}
          <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded-xl border border-gray-300 px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={submitting || !isValidAmount || isDebitExceeding}
              className={`inline-flex items-center gap-1.5 rounded-xl px-5 py-2 text-xs font-bold text-white shadow-sm transition-all disabled:cursor-not-allowed disabled:opacity-50 ${
                action === "credit"
                  ? "bg-emerald-600 hover:bg-emerald-700"
                  : "bg-rose-600 hover:bg-rose-700"
              }`}
            >
              {submitting ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <CheckCircle2 size={14} />
                  {action === "credit" ? "Credit Funds" : "Debit Funds"}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AdminWalletModal;

