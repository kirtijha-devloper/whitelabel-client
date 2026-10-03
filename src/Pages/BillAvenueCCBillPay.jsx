import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  FaCheckCircle,
  FaCopy,
  FaExclamationCircle,
  FaRegClock,
  FaTimesCircle,
  FaTimes,
} from "react-icons/fa";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import Select from "react-select";
import { toast } from "react-toastify";
import bharatConnectLogo from "../assets/bharat-connect-primary-logo.svg";
import BillAvenueCCBill3Flow from "./BillAvenueCCBill3Flow";
import {
  checkBillAvenueStatus,
  extractBillerInputParams,
  fetchBillAvenueBill,
  getBillAvenueBillers,
  getBillAvenueBillerInfo,
  registerBillAvenueComplaint,
  submitBillAvenuePayment,
} from "../api/billAvenueApi";
import {
  getServiceDisabledMessage,
  getServiceFlagValue,
} from "../utils/serviceFlags";

// ─── helpers ────────────────────────────────────────────────────────────────

const toNumber = (value, fallback = null) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

const formatAmount = (value) => {
  const num = toNumber(value);
  if (!Number.isFinite(num)) return "N/A";
  return `₹${num.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatDisplayDate = (value) => {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
};

const getStatusTone = (status) => {
  const s = String(status || "").toUpperCase();
  if (s === "SUCCESS")
    return {
      icon: FaCheckCircle,
      badgeClass: "bg-green-100 text-green-700 border-green-200",
      ringClass: "ring-green-200/70",
    };
  if (s === "PENDING")
    return {
      icon: FaRegClock,
      badgeClass: "bg-amber-100 text-amber-700 border-amber-200",
      ringClass: "ring-amber-200/70",
    };
  if (s === "FAILED")
    return {
      icon: FaTimesCircle,
      badgeClass: "bg-red-100 text-red-700 border-red-200",
      ringClass: "ring-red-200/70",
    };
  return {
    icon: FaExclamationCircle,
    badgeClass: "bg-gray-100 text-gray-700 border-gray-200",
    ringClass: "ring-gray-200/70",
  };
};

const normalizePaymentResult = (data) => {
  if (!data) return null;
  const isSuccess = data.success === true && String(data.responseCode || "").trim() === "000";
  return {
    status: isSuccess ? "SUCCESS" : "FAILED",
    message: String(data.message || (isSuccess ? "Payment successful" : "Payment failed")),
    transactionRefId: String(data.transactionRefId || ""),
    responseCode: String(data.responseCode || ""),
    raw: data,
  };
};

const labelClass = "mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600";
const inputClass =
  "w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition-colors focus:border-[#00D3CD] focus:ring-2 focus:ring-[#00D3CD]/20";

const selectStyles = {
  control: (base, state) => ({
    ...base,
    minHeight: "42px",
    borderColor: state.isFocused ? "#00B9B2" : "#D1D5DB",
    boxShadow: state.isFocused ? "0 0 0 2px rgba(0, 185, 178, 0.2)" : "none",
    "&:hover": { borderColor: "#00B9B2" },
  }),
  option: (base, state) => ({
    ...base,
    backgroundColor: state.isSelected
      ? "rgba(0, 185, 178, 0.14)"
      : state.isFocused
        ? "rgba(0, 185, 178, 0.08)"
        : "#FFFFFF",
    color: "#1F2937",
    cursor: "pointer",
  }),
  singleValue: (base) => ({ ...base, color: "#111827" }),
  menu: (base) => ({ ...base, zIndex: 20 }),
  menuPortal: (base) => ({ ...base, zIndex: 40 }),
};

// ─── component ──────────────────────────────────────────────────────────────

export default function BillAvenueCCBillPay({ currentUser }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const isReviewRoute = location.pathname.endsWith("/review");
  const isResultRoute = location.pathname.endsWith("/result");
  const routeState =
    location.state && typeof location.state === "object" ? location.state : null;
  const isCcBill3Flow =
    searchParams.get("flow") === "cc-bill-3" ||
    routeState?.flowVariant === "cc-bill-3";
  const billBasePath = useMemo(
    () => location.pathname.replace(/\/(review|result)$/, ""),
    [location.pathname]
  );
  const isBillAvenueCcBillPayEnabled = getServiceFlagValue(
    currentUser?.service_flags,
    "ba_cc_bill_pay",
    true
  );
  const isCcBill3Enabled = getServiceFlagValue(
    currentUser?.service_flags,
    "cc_bill_3",
    true
  );

  useEffect(() => {
    if (searchParams.get("flow") === "cc-bill-3") return;
    if (routeState?.flowVariant !== "cc-bill-3") return;

    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("flow", "cc-bill-3");
    setSearchParams(nextParams, { replace: true });
    navigate(
      {
        pathname: location.pathname,
        search: `?${nextParams.toString()}`,
      },
      {
        replace: true,
        state: routeState,
      }
    );
  }, [location.pathname, navigate, routeState, searchParams, setSearchParams]);

  useEffect(() => {
    if (isCcBill3Flow) return;
    if (isReviewRoute || isResultRoute) return;
    if (isBillAvenueCcBillPayEnabled) return;
    if (!isCcBill3Enabled) return;

    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("flow", "cc-bill-3");
    setSearchParams(nextParams, { replace: true });
    navigate(
      {
        pathname: billBasePath,
        search: `?${nextParams.toString()}`,
      },
      { replace: true }
    );
  }, [
    billBasePath,
    isBillAvenueCcBillPayEnabled,
    isCcBill3Enabled,
    isCcBill3Flow,
    isResultRoute,
    isReviewRoute,
    navigate,
    searchParams,
    setSearchParams,
  ]);

  // Wallet / balance info
  const walletNum = parseFloat(currentUser?.wallet ?? 0);
  const availableBalanceNum =
    currentUser?.available_balance !== undefined
      ? parseFloat(currentUser.available_balance)
      : walletNum;
  const settlementHoldNum = Math.max(0, walletNum - availableBalanceNum);

  // ── form state (persisted across steps via route state) ──────────────────
  const [selectedBillerId, setSelectedBillerId] = useState(
    () => String(routeState?.selectedBillerId || "")
  );
  const [selectedBillerSnapshot] = useState(() => routeState?.selectedBiller || null);
  const [selectedBillerInfo, setSelectedBillerInfo] = useState(
    () => routeState?.selectedBillerInfo || null
  );
  const [billerSearch, setBillerSearch] = useState("");

  // customerParams: { [key]: value }
  const [customerParamsValues, setCustomerParamsValues] = useState(
    () => routeState?.customerParamsValues || {}
  );
  const [fetchAmount, setFetchAmount] = useState(() => String(routeState?.fetchAmount || ""));
  const [customAmount, setCustomAmount] = useState(() => String(routeState?.customAmount || ""));
  const [paymentChoice, setPaymentChoice] = useState(() => routeState?.paymentChoice || "total");
  const [selectedPaymentMode, setSelectedPaymentMode] = useState("");
  const [selectedChannel, setSelectedChannel] = useState(() => routeState?.selectedChannel || "AGT");
  const [customerPan, setCustomerPan] = useState(() => String(routeState?.customerPan || ""));

  // Data returned from fetch-bill
  const [billData, setBillData] = useState(() => routeState?.billData || null);

  // Result / status state
  const [paymentResult, setPaymentResult] = useState(() => routeState?.paymentResult || null);
  const [statusResult, setStatusResult] = useState(() => routeState?.statusResult || null);
  const [copiedField, setCopiedField] = useState("");
  const [showLogModal, setShowLogModal] = useState(false);

  // Complaint inline form
  const [showComplaintForm, setShowComplaintForm] = useState(false);
  const [complaintReason, setComplaintReason] = useState("Transaction Failed");
  const [complaintDescription, setComplaintDescription] = useState("");

  // ── biller list ──────────────────────────────────────────────────────────
  const {
    data: billers = [],
    isLoading: billersLoading,
    error: billersError,
    refetch: refetchBillers,
  } = useQuery({
    queryKey: ["billavenue-billers"],
    queryFn: getBillAvenueBillers,
    retry: false,
  });

  const selectedBiller = useMemo(() => {
    const fromList = billers.find((b) => b.id === selectedBillerId);
    if (fromList) return fromList;
    if (selectedBillerSnapshot && selectedBillerSnapshot.id === selectedBillerId)
      return selectedBillerSnapshot;
    return null;
  }, [billers, selectedBillerId, selectedBillerSnapshot]);

  const billerOptions = useMemo(
    () =>
      billers.map((b) => ({
        value: b.id,
        label: b.name || b.id || "Unknown Biller",
        biller: b,
      })),
    [billers]
  );

  const filteredBillers = useMemo(() => {
    const q = (billerSearch || "").trim().toLowerCase();
    if (!q) return billers;
    return billers.filter((b) => {
      const n = (b.name || "").toLowerCase();
      const id = (b.id || "").toLowerCase();
      const cat = (b.raw?.category || b.raw?.blr_category_name || "").toLowerCase();
      const cov = (b.raw?.serviceType || b.raw?.blr_coverage || "").toLowerCase();
      const circ = (b.raw?.circle || "").toLowerCase();
      const st = (b.raw?.state || "").toLowerCase();
      return (
        n.includes(q) ||
        id.includes(q) ||
        cat.includes(q) ||
        cov.includes(q) ||
        circ.includes(q) ||
        st.includes(q)
      );
    });
  }, [billerSearch, billers]);

  const selectedBillerOption = useMemo(
    () => (selectedBiller ? { value: selectedBiller.id, label: selectedBiller.name, biller: selectedBiller } : null),
    [selectedBiller]
  );

  useEffect(() => {
    if (!selectedBillerId) {
      setSelectedBillerInfo(null);
      return;
    }

    let isCurrent = true;
    const fetchInfo = async () => {
      try {
        const info = await getBillAvenueBillerInfo(selectedBillerId);
        if (!isCurrent) return;
        setSelectedBillerInfo(info);
        console.log("[BillAvenue] selected biller info:", info);
      } catch (error) {
        if (!isCurrent) return;
        console.error("[BillAvenue] failed to fetch biller info:", error);
        setSelectedBillerInfo(null);
      }
    };

    fetchInfo();
    return () => {
      isCurrent = false;
    };
  }, [selectedBillerId]);

  // Input params for the selected biller
  const billerInputParams = useMemo(() => {
    const infoData = selectedBillerInfo?.data;
    const detailedParams =
      infoData?.billerInfoResponse?.biller?.billerInputParams?.paramInfo ||
      infoData?.parameters ||
      selectedBillerInfo?.parameters ||
      selectedBiller?.raw?.metadata?.parameters ||
      selectedBiller?.raw?.parameters;

    if (Array.isArray(detailedParams) && detailedParams.length > 0) {
      return detailedParams.map((p) => {
        const fieldName = p.desc || p.paramName || (p.name && !p.name.startsWith('param') ? p.name : '') || p.label || "Card Reference Number";
        return {
          key: fieldName,
          label: fieldName,
          type: p.inputType || p.dataType || p.paramType || p.type || "ALPHANUMERIC",
          minLength: p.minLength || p.minLen || null,
          maxLength: p.maxLength || p.maxLen || null,
          optional: String(p.isOptional || "false").toLowerCase() === "true" || p.mandatory === 0,
          regex: p.regex || p.regEx || null,
        };
      });
    }
    return extractBillerInputParams(selectedBiller);
  }, [selectedBiller, selectedBillerInfo]);

  // ── guard: redirect if arriving at review/result without state ────────────
  useEffect(() => {
    if (!isReviewRoute) return;
    if (routeState?.billData) return;
    navigate(billBasePath, { replace: true });
  }, [billBasePath, isReviewRoute, navigate, routeState]);

  useEffect(() => {
    if (!isResultRoute) return;
    if (routeState?.paymentResult) return;
    navigate(billBasePath, { replace: true });
  }, [billBasePath, isResultRoute, navigate, routeState]);

  // ── reset customerParams keys when biller changes ────────────────────────
  useEffect(() => {
    if (!selectedBiller || isReviewRoute || isResultRoute) return;
    const defaultValues = {};
    billerInputParams.forEach((p) => {
      defaultValues[p.key] = customerParamsValues[p.key] || "";
    });
    setCustomerParamsValues(defaultValues);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBiller?.id]);

  const bRes = billData?.data?.billFetchResponse?.billerResponse || billData?.data?.billerResponse || billData?.data || {};
  const rawDueAmount = toNumber(
    bRes.amountDue ?? bRes.billAmount ?? bRes.dueAmount ?? bRes.amount ?? bRes.totalDueAmount,
    null
  );
  const totalDueAmount = Number.isFinite(rawDueAmount) ? rawDueAmount / 100 : null;
  const payableAmount = useMemo(() => {
    if (paymentChoice === "custom") return toNumber(customAmount, null);
    return totalDueAmount;
  }, [customAmount, paymentChoice, totalDueAmount]);

  const estimatedPayAmount = Number.isFinite(payableAmount) && payableAmount > 0 ? payableAmount : 0;
  const minRequiredBalance = estimatedPayAmount + 30;
  const hasInsufficientAvailable = estimatedPayAmount > 0 && availableBalanceNum < minRequiredBalance;

  // ── validation ────────────────────────────────────────────────────────────
  const allParamsFilled = billerInputParams.every(
    (p) => p.optional || String(customerParamsValues[p.key] || "").trim() !== ""
  );
  const fetchDisabled = !selectedBiller || !allParamsFilled;

  const allowedPaymentModes = useMemo(() => {
    const rawInfo = 
      selectedBillerInfo?.data?.billerInfoResponse?.biller || 
      selectedBillerInfo?.billerInfoResponse?.biller || 
      selectedBillerInfo?.data?.biller || 
      selectedBillerInfo?.biller || 
      selectedBiller?.raw || 
      selectedBillerSnapshot?.raw || 
      {};
      
    let modes = [];
    
    // Also check billerPaymentModes just in case it's named differently
    const pm = rawInfo.paymentModes || rawInfo.billerPaymentModes || rawInfo.paymentModesAllowed;
    
    if (pm) {
      if (Array.isArray(pm.paymentMode)) {
        modes = pm.paymentMode;
      } else if (typeof pm.paymentMode === "string") {
        modes = [pm.paymentMode];
      } else if (Array.isArray(pm)) {
        modes = pm;
      } else if (typeof pm === "string") {
        modes = pm.split(",");
      }
    }
    
    // Safety fallback: if modes is still empty, scan the entire JSON string for common modes
    if (modes.length === 0) {
      const stringified = JSON.stringify(rawInfo).toLowerCase();
      const allPossible = ["Wallet", "InternetBanking", "UPI", "DebitCard", "CreditCard", "Cash", "PrepaidCard", "IMPS", "AEPS", "NEFT"];
      modes = allPossible.filter(m => stringified.includes(m.toLowerCase()));
    }

    return modes.length > 0 ? modes : ["Cash"];
  }, [selectedBillerInfo, selectedBiller, selectedBillerSnapshot]);

  useEffect(() => {
    const defaultMode = allowedPaymentModes.includes("Cash")
      ? "Cash"
      : allowedPaymentModes[0] || "Cash";
    if (defaultMode && selectedPaymentMode !== defaultMode) {
      setSelectedPaymentMode(defaultMode);
    }
  }, [allowedPaymentModes]);

  const isPanRequired = Number.isFinite(payableAmount) && payableAmount >= 50000;
  const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
  const isPanValid = !isPanRequired || panRegex.test(String(customerPan).trim().toUpperCase());

  const payDisabled =
    !billData ||
    !Number.isFinite(payableAmount) ||
    payableAmount <= 0 ||
    hasInsufficientAvailable ||
    !selectedPaymentMode ||
    !isPanValid;

  // ── mutations ─────────────────────────────────────────────────────────────
  const fetchBillMutation = useMutation({
    mutationFn: async () => {
      const params = {};
      billerInputParams.forEach((p) => {
        const val = String(customerParamsValues[p.key] || "").trim();
        if (val) params[p.key] = val;
      });
      return fetchBillAvenueBill({
        billerId: selectedBiller.id,
        customerParams: params,
        amount: toNumber(fetchAmount, null),
        initChannel: selectedChannel,
      });
    },
    onSuccess: (response) => {
      const params = {};
      billerInputParams.forEach((p) => {
        const val = String(customerParamsValues[p.key] || "").trim();
        if (val) params[p.key] = val;
      });
      const bRes = response?.data?.billFetchResponse?.billerResponse || response?.data?.billerResponse || response?.data || {};
      const rawDue = toNumber(
        bRes.amountDue ?? bRes.billAmount ?? bRes.dueAmount ?? bRes.amount ?? bRes.totalDueAmount,
        null
      );
      const fetchedDue = Number.isFinite(rawDue) ? rawDue / 100 : null;
      const nextPaymentChoice = Number.isFinite(fetchedDue) && fetchedDue > 0 ? "total" : "custom";
      const nextState = {
        selectedBillerId: selectedBiller.id,
        selectedBiller,
        customerParamsValues: { ...params },
        fetchAmount,
        billData: response,
        paymentChoice: nextPaymentChoice,
        customAmount: "",
        selectedChannel,
      };
      setBillData(response);
      setPaymentChoice(nextPaymentChoice);
      setCustomAmount("");
      setPaymentResult(null);
      setStatusResult(null);
      toast.success("Bill fetched successfully");
      navigate(`${billBasePath}/review`, { state: nextState });
    },
    onError: (error) => {
      toast.error(error.message || "Unable to fetch bill");
    },
  });

  const payBillMutation = useMutation({
    mutationFn: async () => {
      const params = {};
      billerInputParams.forEach((p) => {
        const val = String(customerParamsValues[p.key] || "").trim();
        if (val) params[p.key] = val;
      });
      const bRes = billData?.data?.billFetchResponse?.billerResponse || billData?.data?.billerResponse;
      const addInfo = billData?.data?.billFetchResponse?.additionalInfo || billData?.data?.additionalInfo;

      return submitBillAvenuePayment({
        billerId: selectedBiller?.id || selectedBillerSnapshot?.id,
        customerParams: params,
        amount: payableAmount,
        paymentMode: selectedPaymentMode || "Cash",
        quickPay: "N",
        billerResponseInfo: bRes ? bRes : undefined,
        additionalInfo: addInfo ? addInfo : undefined,
        requestId: billData?.data?._requestId,
        initChannel: selectedChannel,
        customerPan: customerPan ? String(customerPan).trim().toUpperCase() : undefined,
      });
    },
    onSuccess: (data) => {
      const result = normalizePaymentResult(data);
      const nextState = {
        selectedBillerId: selectedBiller?.id || selectedBillerSnapshot?.id || "",
        selectedBiller: selectedBiller || selectedBillerSnapshot || null,
        customerParamsValues: { ...customerParamsValues },
        billData,
        paymentResult: result,
        statusResult: null,
        selectedChannel,
      };
      setPaymentResult(result);
      setStatusResult(null);
      toast[result.status === "SUCCESS" ? "success" : "error"](result.message || "Payment submitted");
      navigate(`${billBasePath}/result`, { state: nextState, replace: true });
    },
    onError: (error) => {
      toast.error(getServiceDisabledMessage(error, "Payment request failed"));
    },
  });

  const statusMutation = useMutation({
    mutationFn: async () => {
      const refId = paymentResult?.transactionRefId || "";
      if (!refId) throw new Error("No transaction reference ID available");
      return checkBillAvenueStatus(refId);
    },
    onSuccess: (response) => {
      console.log("[BillAvenue] checkStatus response:", response);
      const payload = response?.data || response;
      const statusObj =
        payload?.transactionStatusResp ||
        payload?.transactionStatusResponse ||
        payload?.extTransactionStatusResponse ||
        payload?.ExtTransactionStatusResponse ||
        payload?.data?.transactionStatusResp ||
        payload?.data?.transactionStatusResponse ||
        payload?.data ||
        payload;
      
      const txnList = statusObj?.txnList;
      const txnItem = Array.isArray(txnList) ? txnList[0] : (txnList || statusObj);

      const resCode = String(
        statusObj?.responseCode || txnItem?.responseCode || statusObj?.code || ""
      );
      const resReason =
        statusObj?.responseReason ||
        txnItem?.responseReason ||
        statusObj?.message ||
        "";
      const rawStatus = String(
        txnItem?.txnStatus || statusObj?.txnStatus || statusObj?.status || ""
      ).toUpperCase();

      let txnStatus = rawStatus;
      if (!txnStatus || txnStatus === "UNKNOWN") {
        if (resCode === "000" || resCode === "00") {
          txnStatus = "SUCCESS";
        } else if (resCode) {
          txnStatus = "FAILED";
        } else {
          txnStatus = "UNKNOWN";
        }
      }

      const isSuccess = txnStatus === "SUCCESS";
      
      const normalized = {
        status: txnStatus || "UNKNOWN",
        message:
          resReason ||
          (isSuccess ? "Transaction Successful" : "Transaction Failed or Pending"),
        transactionRefId:
          statusObj?.txnReferenceId ||
          statusObj?.transactionRefId ||
          paymentResult?.transactionRefId ||
          "",
        responseCode: resCode,
        raw: response,
      };

      setStatusResult(normalized);
      toast.success("Status fetched");
    },
    onError: (error) => {
      toast.error(error.message || "Unable to fetch status");
    },
  });

  const complaintMutation = useMutation({
    mutationFn: async () => {
      return registerBillAvenueComplaint({
        billerId: selectedBiller?.id || selectedBillerSnapshot?.id || "",
        transactionRefId: paymentResult?.transactionRefId || "",
        reason: complaintReason || "Transaction Failed",
        description: complaintDescription,
      });
    },
    onSuccess: () => {
      toast.success("Complaint registered successfully");
      setShowComplaintForm(false);
      setComplaintReason("Transaction Failed");
      setComplaintDescription("");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to register complaint");
    },
  });

  // ── helpers ───────────────────────────────────────────────────────────────
  const handleCopyField = async (key, value) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(String(value));
      setCopiedField(key);
      toast.success("Copied");
      setTimeout(() => setCopiedField((prev) => (prev === key ? "" : prev)), 1400);
    } catch {
      toast.error("Unable to copy");
    }
  };

  const currentStep = isResultRoute ? 3 : isReviewRoute ? 2 : 1;
  const flowSteps = [
    { id: 1, title: "Fetch Bill" },
    { id: 2, title: "Review" },
    { id: 3, title: "Result" },
  ];

  const paymentStatusMeta = getStatusTone(paymentResult?.status);
  const statusResultMeta = getStatusTone(statusResult?.status);
  const PaymentStatusIcon = paymentStatusMeta.icon;
  const LatestStatusIcon = statusResultMeta.icon;

  const activeBiller = selectedBiller || selectedBillerSnapshot;

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-5xl p-4">
      {isCcBill3Flow ? (
        isCcBill3Enabled ? (
          <BillAvenueCCBill3Flow
            currentUser={currentUser}
            onExitFlow={() => {
              const nextParams = new URLSearchParams(searchParams);
              nextParams.delete("flow");
              setSearchParams(nextParams, { replace: true });
              navigate(
                {
                  pathname: billBasePath,
                  search: nextParams.toString() ? `?${nextParams.toString()}` : "",
                },
                { replace: true }
              );
            }}
          />
        ) : (
          <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
            <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-700">
              <FaExclamationCircle className="h-6 w-6" />
            </div>
            <h2 className="mb-2 text-xl font-semibold text-gray-900">CC Bill 3 Disabled</h2>
            <p className="text-sm text-gray-600">
              This service is currently disabled by admin. Please try again later.
            </p>
          </div>
        )
      ) : (
        <>
      <h1 className="mb-4 text-2xl font-semibold text-gray-900">
        BillAvenue CC Bill Pay
      </h1>

      <div className="mb-4 overflow-hidden rounded-2xl border border-[#00B9B2]/20 bg-[#00B9B2] shadow-sm">
        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-100/90">
              Additional Flow
            </p>
            <p className="mt-1 text-lg font-semibold text-white">BA CC Bill Pay</p>
          </div>
          <button
            type="button"
            onClick={() => {
              const nextParams = new URLSearchParams(searchParams);
              nextParams.set("flow", "cc-bill-3");
              setSearchParams(nextParams, { replace: true });
              navigate(
                {
                  pathname: billBasePath,
                  search: `?${nextParams.toString()}`,
                },
                { replace: true }
              );
            }}
            className="rounded-xl border border-white/25 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/20"
          >
            Open CC Bill 3
          </button>
        </div>
      </div>

      {/* Step indicator */}
      <div className="mb-4 rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          {flowSteps.map((step) => {
            const isDone = step.id < currentStep;
            const isActive = step.id === currentStep;
            return (
              <div key={step.id} className="flex min-w-0 flex-1 items-center gap-2">
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                    isDone
                      ? "bg-[#00B9B2] text-white"
                      : isActive
                        ? "bg-[#4F6BEA] text-white"
                        : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {step.id}
                </span>
                <span
                  className={`truncate text-xs font-semibold uppercase tracking-wide ${
                    isDone || isActive ? "text-gray-800" : "text-gray-400"
                  }`}
                >
                  {step.title}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── STEP 1: Fetch Bill ─────────────────────────────────────────────── */}
      {!isBillAvenueCcBillPayEnabled && (
        <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
          <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-700">
            <FaExclamationCircle className="h-6 w-6" />
          </div>
          <h2 className="mb-2 text-xl font-semibold text-gray-900">BA CC Bill Pay Disabled</h2>
          <p className="text-sm text-gray-600">
            This service is currently disabled by admin. Please try again later.
          </p>
        </div>
      )}

      {isBillAvenueCcBillPayEnabled && !isReviewRoute && !isResultRoute && (
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="bg-[#00B9B2] px-4 py-3">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-base font-semibold text-white">
                Credit Card Bill Payment (BillAvenue)
              </h2>
              <div className="rounded-lg bg-white px-3 py-2 shadow-sm ring-1 ring-white/70">
                <img
                  src={bharatConnectLogo}
                  alt="Bharat Connect BBPS"
                  className="block h-auto w-24 bg-white object-contain sm:w-[120px]"
                />
              </div>
            </div>
          </div>

          {/* Settlement hold warning */}
          {settlementHoldNum > 0 && (
            <div className="mx-4 mt-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm">
              <span className="mt-0.5 shrink-0 text-amber-500">⚠</span>
              <span className="text-amber-700">
                ₹{settlementHoldNum.toFixed(2)} of your balance is on settlement hold until tomorrow
                10:30 AM. Available for payment:{" "}
                <strong>₹{availableBalanceNum.toFixed(2)}</strong>
              </span>
            </div>
          )}

          <div className="space-y-4 p-4">
            {/* Biller select */}
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={() => refetchBillers()}
                className="rounded border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
              >
                Refresh
              </button>
              <div className="min-w-0 flex-1">
                <Select
                  className="text-sm"
                  classNamePrefix="ba-biller-select"
                  options={billerOptions}
                  value={selectedBillerOption}
                  onChange={(option) => {
                    setSelectedBillerId(option?.value || "");
                    setCustomerParamsValues({});
                  }}
                  placeholder={billersLoading ? "Loading biller list..." : "Select biller"}
                  isDisabled={billersLoading}
                  isClearable={false}
                  isSearchable
                  styles={selectStyles}
                  menuPortalTarget={typeof window !== "undefined" ? window.document.body : null}
                  menuPosition="fixed"
                />
              </div>
            </div>

            {billersError && (
              <p className="mt-1 text-sm text-red-600">
                {billersError.message || "Unable to fetch biller list"}
              </p>
            )}

            {selectedBiller && (
              <div className="mt-2 flex items-center gap-2 rounded border border-gray-200 bg-gray-50 px-2 py-2 text-xs text-gray-600">
                <span>
                  Selected: {" "}
                  <span className="font-semibold text-gray-800">{selectedBiller.name}</span>
                  <span className="ml-1 text-gray-400">({selectedBiller.id})</span>
                </span>
              </div>
            )}

        
            {/* Dynamic customerParams inputs */}
            {selectedBiller && (
              <div className="grid gap-4 md:grid-cols-2">
                {billerInputParams.map((param) => (
                  <div key={param.key}>
                    <label className={labelClass}>
                      {param.label}
                      {!param.optional && (
                        <span className="ml-1 text-red-500">*</span>
                      )}
                    </label>
                    <input
                      type={param.type === "NUMERIC" ? "text" : "text"}
                      inputMode={param.type === "NUMERIC" ? "numeric" : "text"}
                      maxLength={param.maxLength || undefined}
                      className={inputClass}
                      value={customerParamsValues[param.key] || ""}
                      onChange={(e) => {
                        const val =
                          param.type === "NUMERIC"
                            ? e.target.value.replace(/\D/g, "")
                            : e.target.value;
                        setCustomerParamsValues((prev) => ({ ...prev, [param.key]: val }));
                      }}
                      placeholder={`Enter ${param.label}`}
                    />
                  </div>
                ))}

              </div>
            )}
          </div>

          <div className="border-t border-gray-200 px-4 pb-4 pt-1">
            <button
              type="button"
              className="w-full rounded bg-[#4F6BEA] px-4 py-2 text-sm font-semibold text-white hover:bg-[#425bd0] disabled:cursor-not-allowed disabled:opacity-60 md:w-auto"
              onClick={() => fetchBillMutation.mutate()}
              disabled={fetchBillMutation.isPending || fetchDisabled}
            >
              {fetchBillMutation.isPending ? "Fetching..." : "Fetch Bill"}
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 2: Review ────────────────────────────────────────────────── */}
      {isBillAvenueCcBillPayEnabled && isReviewRoute && billData && (
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="bg-gradient-to-r from-[#00B9B2] to-[#15A5CF] px-4 py-3">
            <h3 className="text-center text-base font-semibold text-white">
              Review &amp; Confirm Payment
            </h3>
          </div>

          {/* Settlement hold warning */}
          {settlementHoldNum > 0 && (
            <div className="mx-4 mt-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm">
              <span className="mt-0.5 shrink-0 text-amber-500">⚠</span>
              <span className="text-amber-700">
                ₹{settlementHoldNum.toFixed(2)} on settlement hold until tomorrow 10:30 AM.
                Available: <strong>₹{availableBalanceNum.toFixed(2)}</strong>
              </span>
            </div>
          )}

          <div className="grid gap-4 p-4 lg:grid-cols-2">
            {/* Left: biller + customer details summary */}
            <div className="space-y-4">
              <div className="rounded-xl border border-gray-200 bg-gradient-to-b from-[#f7fffe] to-white p-4">
                <div className="mb-3">
                  <p className="text-sm font-semibold text-gray-900">
                    {activeBiller?.name || "Biller"}
                  </p>
                  <p className="text-xs text-gray-500">{activeBiller?.id || ""}</p>
                </div>
                <div className="grid gap-2 text-sm text-gray-700 sm:grid-cols-2">
                  {Object.entries(customerParamsValues).map(([key, val]) => (
                    <div key={key} className="rounded border border-gray-100 bg-white p-2">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                        {key}
                      </p>
                      <p className="font-medium text-gray-900 break-all">{val || "N/A"}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Fetched bill info (if available) */}
              {billData?.data && Object.keys(billData.data).length > 0 && (
                <div className="rounded-xl border border-gray-200 bg-white p-4 text-sm">
                  <p className={`${labelClass} mb-2`}>Fetched Bill Details</p>
                  
                  {(() => {
                    const errorObj = billData.data.billFetchResponse?.errorInfo?.error || billData.data.errorInfo?.error;
                    const errorMsg = errorObj?.errorMessage || errorObj?.message;
                    const errorCode = errorObj?.errorCode;
                    
                    const extractedBRes = billData.data.billFetchResponse?.billerResponse || billData.data.billerResponse || billData.data;
                    const cName = extractedBRes.customerName || extractedBRes.billerName;
                    const dDate = extractedBRes.dueDate || extractedBRes.billDate;
                    
                    const hasBillDetails = totalDueAmount != null || dDate || cName || (extractedBRes?.billerAdditionalInfo?.info && extractedBRes.billerAdditionalInfo.info.length > 0);
                    
                    if (errorMsg) {
                      return (
                        <div className="rounded border border-amber-200 bg-amber-50 p-3 text-amber-800">
                          <p className="font-semibold mb-1">Biller Message: {errorCode ? `(${errorCode})` : ''}</p>
                          <p>{errorMsg}</p>
                        </div>
                      );
                    } else if (hasBillDetails) {
                      return (
                        <div className="grid gap-2 sm:grid-cols-2">
                          {totalDueAmount != null && (
                            <div className="rounded border border-gray-100 bg-gray-50 p-2">
                              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                                Due Amount
                              </p>
                              <p className="font-semibold text-gray-900">
                                {formatAmount(totalDueAmount)}
                              </p>
                            </div>
                          )}
                          {dDate && (
                            <div className="rounded border border-gray-100 bg-gray-50 p-2">
                              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                                Date
                              </p>
                              <p className="font-medium text-gray-900">
                                {formatDisplayDate(dDate)}
                              </p>
                            </div>
                          )}
                          {cName && (
                            <div className="rounded border border-gray-100 bg-gray-50 p-2 sm:col-span-2">
                              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                                Customer Name
                              </p>
                              <p className="font-medium text-gray-900">{cName}</p>
                            </div>
                          )}
                          
                          {extractedBRes?.billerAdditionalInfo?.info && 
                            (() => {
                              const infoData = extractedBRes.billerAdditionalInfo.info;
                              const infoArray = Array.isArray(infoData) ? infoData : [infoData];
                              return infoArray.map((item, idx) => {
                                const attrs = item.$ || item;
                                const iName = attrs.infoName || attrs.paramName;
                                const iValue = attrs.infoValue || attrs.paramValue;
                                
                                if (!iName) return null;
                                
                                return (
                                  <div key={idx} className="rounded border border-gray-100 bg-gray-50 p-2">
                                    <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                                      {iName}
                                    </p>
                                    <p className="font-semibold text-gray-900">
                                      {iName.toLowerCase().includes('amount') || iName.toLowerCase().includes('due') || iName.toLowerCase().includes('charge') || iName.toLowerCase().includes('fee')
                                        ? formatAmount(toNumber(iValue, 0) / 100) 
                                        : (iValue || "N/A")}
                                    </p>
                                  </div>
                                );
                              });
                            })()
                          }
                        </div>
                      );
                    } else {
                      return (
                        <div className="rounded border border-gray-100 bg-gray-50 p-3 text-gray-500">
                          <p>No extra bill details returned for this biller. You may proceed with a custom amount.</p>
                        </div>
                      );
                    }
                  })()}
                </div>
              )}
            </div>

            {/* Right: amount selection */}
            <div className="space-y-4 rounded-xl border border-gray-200 bg-gray-50/70 p-4">
              <p className={labelClass}>Payment Amount</p>

              {Number.isFinite(totalDueAmount) && totalDueAmount > 0 && (
                <label
                  className={`flex cursor-pointer items-center justify-between gap-3 rounded-lg border p-3 text-sm transition ${
                    paymentChoice === "total"
                      ? "border-[#00B9B2] bg-[#EFFFFE]"
                      : "border-gray-200 bg-white hover:border-[#00B9B2]/50"
                  }`}
                >
                  <span className="flex items-center gap-2 text-gray-700">
                    <input
                      type="radio"
                      name="ba-payment-choice"
                      value="total"
                      checked={paymentChoice === "total"}
                      onChange={() => setPaymentChoice("total")}
                    />
                    Pay Due Amount
                  </span>
                  <span className="font-semibold text-gray-900">
                    {formatAmount(totalDueAmount)}
                  </span>
                </label>
              )}

              <label
                className={`flex cursor-pointer items-center justify-between gap-3 rounded-lg border p-3 text-sm transition ${
                  paymentChoice === "custom"
                    ? "border-[#00B9B2] bg-[#EFFFFE]"
                    : "border-gray-200 bg-white hover:border-[#00B9B2]/50"
                }`}
              >
                <span className="flex items-center gap-2 text-gray-700">
                  <input
                    type="radio"
                    name="ba-payment-choice"
                    value="custom"
                    checked={paymentChoice === "custom"}
                    onChange={() => setPaymentChoice("custom")}
                  />
                  Enter Custom Amount
                </span>
              </label>

              {paymentChoice === "custom" && (
                <div className="rounded-lg border border-[#00B9B2]/30 bg-white p-3">
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Custom Amount
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-500">₹</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={customAmount}
                        onChange={(e) => setCustomAmount(e.target.value)}
                        onWheel={(e) => e.target.blur()}
                        onKeyDown={(e) => {
                          if (e.key === "ArrowUp" || e.key === "ArrowDown") {
                            e.preventDefault();
                          }
                        }}
                        className={`${inputClass} [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`}
                        placeholder="Enter amount"
                      />
                  </div>
                </div>
              )}

              <div className="rounded-lg border border-[#00B9B2]/30 bg-white p-3">
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Payment Mode
                </label>
                {allowedPaymentModes.length > 1 ? (
                  <select
                    value={selectedPaymentMode}
                    onChange={(e) => setSelectedPaymentMode(e.target.value)}
                    className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition-colors focus:border-[#00B9B2]"
                  >
                    {allowedPaymentModes.map((mode, i) => (
                      <option key={i} value={mode}>
                        {mode}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="w-full rounded border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-medium text-gray-800">
                    {selectedPaymentMode || allowedPaymentModes[0] || "Cash"}
                  </div>
                )}
              </div>


              {isPanRequired && (
                <div className="rounded-lg border border-amber-200 bg-amber-50/80 p-3 space-y-1.5">
                  <label className="block text-xs font-semibold uppercase tracking-wide text-amber-900">
                    PAN Card Number <span className="text-red-500">*</span> (Required for ₹50,000 & above)
                  </label>
                  <input
                    type="text"
                    maxLength={10}
                    value={customerPan}
                    onChange={(e) => setCustomerPan(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
                    placeholder="e.g. ABCDE1234F"
                    className="w-full rounded border border-amber-300 bg-white px-3 py-2 text-sm font-mono uppercase text-gray-900 focus:border-[#00B9B2] focus:outline-none"
                  />
                  {customerPan && !panRegex.test(customerPan) ? (
                    <p className="text-[11px] font-medium text-red-600">Please enter a valid 10-character PAN (e.g. ABCDE1234F)</p>
                  ) : (
                    <p className="text-[11px] text-amber-700">As per regulations, a valid PAN is mandatory for transactions ₹50,000 or above.</p>
                  )}
                </div>
              )}

              <div className="rounded-lg border border-[#00B9B2]/30 bg-[#EFFFFE] px-3 py-2 text-sm">
                <span className="text-gray-600">Payable Amount: </span>
                <span className="font-semibold text-gray-900">{formatAmount(payableAmount)}</span>
              </div>

              {hasInsufficientAvailable && (
                <div className="flex items-start gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  <span className="shrink-0">✕</span>
                  <span>
                    Insufficient available balance.{" "}
                    {settlementHoldNum > 0
                      ? `₹${settlementHoldNum.toFixed(2)} is on hold and will be available tomorrow at 10:30 AM. Available now: ₹${availableBalanceNum.toFixed(2)}.`
                      : "Please add funds to continue."}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-3 border-t border-gray-200 px-4 pb-4 pt-3 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              onClick={() => navigate(billBasePath, { replace: true })}
              className="rounded border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              ← Back
            </button>
            <button
              type="button"
              onClick={() => payBillMutation.mutate()}
              disabled={payDisabled || payBillMutation.isPending}
              className="w-full rounded bg-[#61C248] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#4cab34] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            >
              {payBillMutation.isPending ? "Processing..." : "Confirm & Pay"}
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 3: Result ────────────────────────────────────────────────── */}
      {isBillAvenueCcBillPayEnabled && isResultRoute && paymentResult && (
        <div
          className={`mt-6 overflow-hidden rounded-2xl bg-white p-4 shadow-sm ring-1 ${paymentStatusMeta.ringClass}`}
        >
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <PaymentStatusIcon className="h-5 w-5 text-gray-700" />
              <h4 className="text-base font-semibold text-gray-900">Payment Response</h4>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowLogModal(true)}
                className="inline-flex items-center rounded border border-gray-300 bg-white px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#00D3CD]/20"
              >
                View Log
              </button>
              <span
                className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-wide ${paymentStatusMeta.badgeClass}`}
              >
                {paymentResult.status || "Unknown"}
              </span>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
                Message
              </p>
              <p className="font-medium text-gray-800">{paymentResult.message || "N/A"}</p>
            </div>

            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
                Response Code
              </p>
              <p className="font-semibold text-gray-800">
                {paymentResult.responseCode || "N/A"}
                {paymentResult.responseCode === "000" && (
                  <span className="ml-2 text-green-600">(Success)</span>
                )}
              </p>
            </div>

            <div className="space-y-2 rounded-lg border border-gray-200 bg-white p-3 text-sm md:col-span-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Transaction Ref ID
                </span>
                <button
                  type="button"
                  onClick={() => handleCopyField("refId", paymentResult.transactionRefId)}
                  className="inline-flex items-center gap-1 rounded border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                >
                  <FaCopy className="h-3 w-3" />
                  {copiedField === "refId" ? "Copied" : "Copy"}
                </button>
              </div>
              <p className="break-all font-medium text-gray-800">
                {paymentResult.transactionRefId || "N/A"}
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="mt-5 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => statusMutation.mutate()}
              disabled={!paymentResult.transactionRefId || statusMutation.isPending}
              className="rounded bg-[#4F6BEA] px-4 py-2 text-sm font-semibold text-white hover:bg-[#425bd0] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {statusMutation.isPending ? "Checking..." : "Check Status"}
            </button>

            {paymentResult.status === "FAILED" && (
              <button
                type="button"
                onClick={() => setShowComplaintForm((v) => !v)}
                className="rounded border border-red-300 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100"
              >
                Register Complaint
              </button>
            )}

            <button
              type="button"
              onClick={() => navigate(billBasePath, { replace: true })}
              className="rounded border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              New Payment
            </button>
          </div>

          {/* Inline complaint form */}
          {showComplaintForm && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm">
              <p className="mb-3 font-semibold text-red-700">Register a Complaint</p>
              <div className="space-y-3">
                <div>
                  <label className={labelClass}>Reason</label>
                  <input
                    type="text"
                    className={inputClass}
                    value={complaintReason}
                    onChange={(e) => setComplaintReason(e.target.value)}
                    placeholder="Short reason"
                  />
                </div>
                <div>
                  <label className={labelClass}>Description</label>
                  <textarea
                    className={`${inputClass} resize-none`}
                    rows={3}
                    value={complaintDescription}
                    onChange={(e) => setComplaintDescription(e.target.value)}
                    placeholder="Describe the issue in detail"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => complaintMutation.mutate()}
                    disabled={complaintMutation.isPending}
                    className="rounded bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                  >
                    {complaintMutation.isPending ? "Submitting..." : "Submit Complaint"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowComplaintForm(false)}
                    className="rounded border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Latest status result */}
      {isBillAvenueCcBillPayEnabled && isResultRoute && statusResult && (
        <div
          className={`mt-4 rounded-xl bg-white p-4 shadow-sm ring-1 ${statusResultMeta.ringClass}`}
        >
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <LatestStatusIcon className="h-5 w-5 text-gray-700" />
              <h4 className="text-base font-semibold text-gray-900">Latest Transaction Status</h4>
            </div>
            <button
              type="button"
              onClick={() => setShowLogModal("status")}
              className="inline-flex items-center rounded border border-gray-300 bg-white px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#00D3CD]/20"
            >
              View Log
            </button>
          </div>
          <div className="grid gap-3 text-sm text-gray-700 md:grid-cols-2">
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Status</p>
              <p className="mt-1 font-semibold text-gray-900">{statusResult.status || "N/A"}</p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Message</p>
              <p className="mt-1 font-medium text-gray-900">{statusResult.message || "N/A"}</p>
            </div>
          </div>
        </div>
      )}

      {/* ── LOG MODAL ──────────────────────────────────────────────────────── */}
      {showLogModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="relative w-full max-w-4xl max-h-[90vh] flex flex-col rounded-xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <h3 className="text-lg font-semibold text-gray-900">
                {showLogModal === "status" ? "Status Check Log" : "Transaction Log"}
              </h3>
              <button
                onClick={() => setShowLogModal(false)}
                className="text-gray-400 hover:text-gray-600 focus:outline-none"
              >
                <FaTimes className="h-5 w-5" />
              </button>
            </div>
            <div className="overflow-y-auto p-6 text-sm text-gray-800">
              <pre className="whitespace-pre-wrap rounded bg-gray-50 p-4 border border-gray-200 text-xs text-gray-700 font-mono">
                {JSON.stringify(
                  showLogModal === "status"
                    ? statusResult?.raw?.data || statusResult?.raw || statusResult
                    : paymentResult?.raw?.data || paymentResult?.raw || paymentResult,
                  null,
                  2
                )}
              </pre>
            </div>
            <div className="border-t bg-gray-50 px-6 py-4 flex justify-end rounded-b-xl">
              <button
                onClick={() => setShowLogModal(false)}
                className="rounded bg-gray-200 px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-300"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

        </>
      )}
    </div>
  );
}
