import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle2, Clock, XCircle, ArrowRight, RefreshCw, Home } from "lucide-react";
import { getPgOrderStatus } from "../api/pgApi";

const PGPaymentReturn = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [orderData, setOrderData] = useState(null);
  const [pollCount, setPollCount] = useState(0);

  const orderId = searchParams.get("order_id") || searchParams.get("orderId");
  const queryStatus = searchParams.get("status");

  useEffect(() => {
    let isMounted = true;
    let timer = null;

    if (!orderId) {
      setLoading(false);
      return;
    }

    const checkStatus = async () => {
      try {
        const res = await getPgOrderStatus(orderId);
        if (isMounted && res?.data) {
          setOrderData(res.data);
          // If transaction reached a final state (success or failed), stop polling
          if (res.data.status === "success" || res.data.status === "failed") {
            setLoading(false);
            return;
          }
        }
      } catch (e) {
        // ignore fetch error
      }

      // If still pending and under 5 poll attempts, check again in 2 seconds
      if (isMounted && pollCount < 5) {
        timer = setTimeout(() => {
          setPollCount((prev) => prev + 1);
        }, 2000);
      } else if (isMounted) {
        setLoading(false);
      }
    };

    checkStatus();

    return () => {
      isMounted = false;
      if (timer) clearTimeout(timer);
    };
  }, [orderId, pollCount]);

  const status = String(orderData?.status || queryStatus || "pending").toLowerCase();

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl p-6 sm:p-8 shadow-xl border border-gray-200 text-center space-y-6">
        {loading ? (
          <div className="py-12 space-y-3">
            <RefreshCw className="w-10 h-10 text-[#00D3CD] animate-spin mx-auto" />
            <p className="text-sm text-gray-500 font-medium">Verifying payment status with gateway...</p>
          </div>
        ) : status === "success" ? (
          <>
            <div className="w-16 h-16 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-500 flex items-center justify-center mx-auto shadow-inner">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <div className="space-y-1">
              <h1 className="text-2xl font-bold text-gray-900">Payment Successful</h1>
              <p className="text-xs text-gray-500">
                Your transaction has been captured and wallet credited.
              </p>
            </div>

            {orderData && (
              <div className="p-4 rounded-2xl bg-slate-50 border border-gray-100 text-left space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-gray-200/60">
                  <span className="text-gray-500">Order ID</span>
                  <span className="font-mono font-semibold text-gray-900">{orderData.order_id}</span>
                </div>
                {orderData.payment_id && (
                  <div className="flex justify-between py-1 border-b border-gray-200/60">
                    <span className="text-gray-500">Payment ID</span>
                    <span className="font-mono text-gray-800">{orderData.payment_id}</span>
                  </div>
                )}
                <div className="flex justify-between py-1 border-b border-gray-200/60">
                  <span className="text-gray-500">Amount Paid</span>
                  <span className="font-bold text-gray-900">₹{parseFloat(orderData.amount).toFixed(2)}</span>
                </div>
                <div className="flex justify-between py-1 pt-2">
                  <span className="text-gray-500">Net Credited</span>
                  <span className="font-bold text-emerald-600">₹{parseFloat(orderData.net_amount).toFixed(2)}</span>
                </div>
              </div>
            )}
          </>
        ) : status === "failed" ? (
          <>
            <div className="w-16 h-16 rounded-full bg-rose-50 border border-rose-200 text-rose-500 flex items-center justify-center mx-auto shadow-inner">
              <XCircle className="w-10 h-10" />
            </div>
            <div className="space-y-1">
              <h1 className="text-2xl font-bold text-gray-900">Payment Incomplete</h1>
              <p className="text-xs text-gray-500">
                The payment was canceled or could not be verified by the gateway.
              </p>
            </div>
          </>
        ) : (
          <>
            <div className="w-16 h-16 rounded-full bg-amber-50 border border-amber-200 text-amber-500 flex items-center justify-center mx-auto shadow-inner">
              <Clock className="w-10 h-10" />
            </div>
            <div className="space-y-1">
              <h1 className="text-2xl font-bold text-gray-900">Processing Payment</h1>
              <p className="text-xs text-gray-500">
                Your payment confirmation is being synchronized via server webhook.
              </p>
            </div>
          </>
        )}

        <div className="pt-2 flex flex-col gap-2">
          <button
            onClick={() => navigate("/merchant/dashboard")}
            className="w-full py-3 px-4 rounded-xl bg-[#00D3CD] hover:bg-[#00D3CD]/90 text-slate-900 font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            Go to Dashboard
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default PGPaymentReturn;
