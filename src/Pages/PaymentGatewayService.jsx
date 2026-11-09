import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import {
  CreditCard,
  ShieldCheck,
  Zap,
  ArrowRight,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  Search,
  ExternalLink,
  Loader2
} from "lucide-react";
import { createPgOrder, getPgTransactions } from "../api/pgApi";

const QUICK_AMOUNTS = [100, 500, 1000, 2500, 5000, 10000];

const PaymentGatewayService = ({ serviceName = "PG 1", currentUser }) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [amount, setAmount] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const gatewayKey = serviceName.toLowerCase().replace(/\s+/g, "_"); // "pg_1" or "pg_2"
  const role = String(currentUser?.role || "merchant").toLowerCase();
  const dashboardPath = `/${role === "franchaise" ? "franchise" : role}/dashboard`;

  // Fetch transactions for this gateway
  const {
    data: txnResponse,
    isLoading: isLoadingTxns,
    isRefetching: isRefetchingTxns,
    refetch: refetchTxns
  } = useQuery({
    queryKey: ["pgTransactions", gatewayKey, statusFilter, searchTerm],
    queryFn: () =>
      getPgTransactions({
        gateway: gatewayKey,
        status: statusFilter === "all" ? undefined : statusFilter,
        search: searchTerm || undefined,
        limit: 50
      }),
    refetchInterval: 15000
  });

  const transactions = txnResponse?.data || [];

  // Mutation to initiate payment
  const createOrderMutation = useMutation({
    mutationFn: (payAmount) =>
      createPgOrder({
        gateway: gatewayKey,
        amount: parseFloat(payAmount)
      }),
    onSuccess: (data) => {
      const paymentUrl = data?.data?.payment_url;
      if (paymentUrl) {
        toast.info("Redirecting to secure payment checkout...");
        window.location.href = paymentUrl;
      } else {
        toast.error("Gateway did not return a valid payment checkout URL");
      }
    },
    onError: (err) => {
      toast.error(err.message || "Failed to initiate payment");
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    const num = parseFloat(amount);
    if (isNaN(num) || num < 10) {
      toast.error("Please enter a valid amount (minimum ₹10.00)");
      return;
    }
    createOrderMutation.mutate(num);
  };

  const getStatusBadge = (status) => {
    switch (String(status).toLowerCase()) {
      case "success":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Success
          </span>
        );
      case "pending":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="w-3.5 h-3.5" />
            Pending
          </span>
        );
      case "failed":
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <XCircle className="w-3.5 h-3.5" />
            Failed
          </span>
        );
    }
  };

  return (
  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
    {/* Payment Initiation Card (Left Column) */}
    <div className="lg:col-span-1 bg-white rounded-2xl p-6 shadow-sm border border-gray-200 space-y-5">
      <div className="flex items-center gap-3 pb-3 border-b border-gray-100">
        <div className="w-10 h-10 rounded-xl bg-slate-100 border border-gray-200 flex items-center justify-center text-[#00D3CD]">
          <Zap className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-gray-900">{serviceName}</h1>
          <h2 className="text-base font-bold text-gray-900">Initiate Checkout</h2>
          <p className="text-xs text-gray-500">Redirected to 3D-Secure hosted page</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-1">
            Amount (INR)
          </label>
          <div className="relative rounded-xl shadow-sm">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-gray-500 font-bold">
              ₹
            </div>
            <input
              type="number"
              min="10"
              step="0.01"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="block w-full rounded-xl border border-gray-200 bg-slate-50 pl-9 pr-4 py-3 text-base font-semibold text-gray-900 outline-none transition focus:border-[#00D3CD] focus:bg-white focus:ring-2 focus:ring-[#00D3CD]/20"
            />
          </div>
          <p className="text-[11px] text-gray-500 mt-1 flex items-center gap-1">
            <AlertCircle className="w-3.5 h-3.5 text-gray-400" />
            Minimum transaction amount: ₹10.00
          </p>
        </div>

        {/* Quick Amount Chips */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-2">
            Quick Select
          </label>
          <div className="grid grid-cols-3 gap-2">
            {QUICK_AMOUNTS.map((amt) => (
              <button
                key={amt}
                type="button"
                onClick={() => setAmount(String(amt))}
                className={`py-1.5 text-xs font-medium rounded-lg border transition-all ${parseFloat(amount) === amt
                    ? "bg-[#00D3CD]/10 text-gray-900 border-[#00D3CD] font-bold"
                    : "bg-slate-50 hover:bg-gray-100 text-gray-700 border-gray-200"
                  }`}
              >
                ₹{amt}
              </button>
            ))}
          </div>
        </div>

        <button
          type="submit"
          disabled={createOrderMutation.isPending || !amount || parseFloat(amount) < 10}
          className="w-full mt-2 py-3 px-4 rounded-xl bg-[#00D3CD] hover:bg-[#00D3CD]/90 text-slate-900 font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          {createOrderMutation.isPending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Generating Checkout...
            </>
          ) : (
            <>
              Proceed to Pay
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>

      {/* Security Note */}
      <div className="p-3.5 rounded-xl bg-slate-50 border border-gray-200/80 flex items-start gap-2.5">
        <ShieldCheck className="w-4 h-4 text-[#00D3CD] flex-shrink-0 mt-0.5" />
        <p className="text-[11px] text-gray-600 leading-relaxed">
          Payments are verified via bank-level 3D-Secure OTP. Upon successful capture, funds are credited directly to your main wallet balance.
        </p>
      </div>
    </div>

    {/* Transaction History & Live Status (Right 2 Columns) */}
    <div className="lg:col-span-2 bg-white rounded-2xl p-6 shadow-sm border border-gray-200 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-gray-100">
        <div>
          <h2 className="text-base font-bold text-gray-900">Transaction History</h2>
          <p className="text-xs text-gray-500">Live records processed on {serviceName}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => refetchTxns()}
            disabled={isRefetchingTxns}
            className="p-2 rounded-lg bg-slate-50 border border-gray-200 hover:bg-gray-100 text-gray-600 transition"
            title="Refresh Transactions"
          >
            <RefreshCw className={`w-4 h-4 ${isRefetchingTxns ? "animate-spin text-[#00D3CD]" : ""}`} />
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by Order ID or Payment ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-gray-200 bg-slate-50 focus:bg-white focus:border-[#00D3CD] outline-none"
          />
        </div>
        <div className="flex items-center gap-1.5">
          {["all", "success", "pending", "failed"].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg capitalize border transition ${statusFilter === st
                  ? "bg-slate-900 text-white border-slate-900"
                  : "bg-slate-50 text-gray-600 border-gray-200 hover:bg-gray-100"
                }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Table Container */}
      <div className="overflow-x-auto rounded-xl border border-gray-200">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-50 border-b border-gray-200 text-gray-600 font-semibold uppercase tracking-wider">
              <th className="py-3 px-3.5">Date</th>
              <th className="py-3 px-3.5">Order / Payment ID</th>
              <th className="py-3 px-3.5 text-right">Gross</th>
              <th className="py-3 px-3.5 text-right">Fee + GST</th>
              <th className="py-3 px-3.5 text-right">Net Credited</th>
              <th className="py-3 px-3.5 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoadingTxns ? (
              <tr>
                <td colSpan="6" className="py-10 text-center text-gray-500">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto text-[#00D3CD] mb-2" />
                  Loading records...
                </td>
              </tr>
            ) : transactions.length === 0 ? (
              <tr>
                <td colSpan="6" className="py-10 text-center text-gray-500">
                  <CreditCard className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  No transactions recorded yet for {serviceName}.
                </td>
              </tr>
            ) : (
              transactions.map((txn) => (
                <tr key={txn.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3 px-3.5 text-gray-500 whitespace-nowrap">
                    {new Date(txn.created_at || txn.createdAt).toLocaleString("en-IN", {
                      dateStyle: "medium",
                      timeStyle: "short"
                    })}
                  </td>
                  <td className="py-3 px-3.5">
                    <div className="font-semibold text-gray-900 font-mono text-[11px]">
                      {txn.order_id}
                    </div>
                    {txn.payment_id && (
                      <div className="text-[10px] text-gray-500 font-mono">
                        Pay: {txn.payment_id}
                      </div>
                    )}
                    {txn.card_network && (
                      <span className="inline-block mt-0.5 text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-gray-600 border border-gray-200">
                        {txn.card_network} {txn.card_type}
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-3.5 text-right font-semibold text-gray-900 whitespace-nowrap">
                    ₹{parseFloat(txn.amount || 0).toFixed(2)}
                  </td>
                  <td className="py-3 px-3.5 text-right text-gray-500 whitespace-nowrap">
                    ₹{(parseFloat(txn.fee_amount || 0) + parseFloat(txn.gst_amount || 0)).toFixed(2)}
                  </td>
                  <td className="py-3 px-3.5 text-right font-bold text-emerald-600 whitespace-nowrap">
                    ₹{parseFloat(txn.net_amount || 0).toFixed(2)}
                  </td>
                  <td className="py-3 px-3.5 text-center whitespace-nowrap">
                    {getStatusBadge(txn.status)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  </div>
  );
};

export default PaymentGatewayService;
