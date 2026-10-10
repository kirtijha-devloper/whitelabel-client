import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  FaCheckCircle,
  FaCopy,
  FaExclamationCircle,
  FaRegClock,
  FaTimesCircle,
} from "react-icons/fa";
import { useLocation, useNavigate } from "react-router-dom";
import Select from "react-select";
import { toast } from "react-toastify";
import {
  fetchCcBill,
  getCcBillBanks,
  submitCcBillPayment,
  getCcBillPaymentStatus,
} from "../api/ccBillPayApi";
import {
  getServiceDisabledMessage,
  getServiceFlagValue,
} from "../utils/serviceFlags";
import { getSharedCcBillLimit } from "../api/sharedCcBillLimitApi";

const getUserIdValue = (u) => String(u?.id ?? u?.user_id ?? "").trim();
const getUserNameValue = (u) => String(u?.name ?? u?.full_name ?? u?.user_name ?? "Unknown");
const getUserOptionLabel = (u) => {
  const id = getUserIdValue(u);
  const name = getUserNameValue(u);
  const mobile = String(u?.mobile ?? u?.mobile_number ?? u?.phone ?? "");
  return mobile ? `${id} - ${name} (${mobile})` : `${id} - ${name}`;
};
const getBankCodeValue = (bank) => String(bank?.code ?? "").trim().toUpperCase();
const getBankLogoValue = (bank) =>
  String(bank?.logoUrl ?? bank?.logo ?? bank?.icon ?? bank?.image ?? "").trim();
const getBankKey = (bank) =>
  String(bank?.id || getBankCodeValue(bank) || bank?.name || "").trim().toLowerCase();
const BANK_LOGO_DOMAIN_BY_KEY = {
  icici: "icicibank.com",
  hdfc: "hdfcbank.com",
  sbi: "onlinesbi.sbi",
  axis: "axisbank.com",
  kotak: "kotak.com",
  bob: "bankofbaroda.in",
  pnb: "pnbindia.in",
  idfc: "idfcfirstbank.com",
  indusind: "indusind.com",
  yes: "yesbank.in",
  au: "aubank.in",
  federal: "federalbank.co.in",
  canara: "canarabank.com",
  union: "unionbankofindia.co.in",
};

const resolveBankDomain = (bank) => {
  const code = getBankCodeValue(bank).toLowerCase();
  const name = String(bank?.name || "").toLowerCase();
  if (BANK_LOGO_DOMAIN_BY_KEY[code]) return BANK_LOGO_DOMAIN_BY_KEY[code];
  const matchByNameKey = Object.keys(BANK_LOGO_DOMAIN_BY_KEY).find(
    (key) => name.includes(key)
  );
  if (matchByNameKey) return BANK_LOGO_DOMAIN_BY_KEY[matchByNameKey];
  return "";
};

const getBankLogoCandidates = (bank) => {
  const explicitLogo = getBankLogoValue(bank);
  const domain = resolveBankDomain(bank);
  const candidates = [
    explicitLogo,
    domain ? `https://logo.clearbit.com/${domain}` : "",
    domain ? `https://www.google.com/s2/favicons?domain=${domain}&sz=128` : "",
  ].filter(Boolean);
  return Array.from(new Set(candidates));
};

const getBankInitials = (bank) => {
  const code = getBankCodeValue(bank);
  if (code) return code.slice(0, 2);
  const nameParts = String(bank?.name ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (nameParts.length === 0) return "BK";
  if (nameParts.length === 1) return nameParts[0].slice(0, 2).toUpperCase();
  return `${nameParts[0][0] || ""}${nameParts[1][0] || ""}`.toUpperCase();
};

const toNumber = (value, fallback = null) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

const formatAmount = (value) => {
  const num = toNumber(value);
  if (!Number.isFinite(num)) return "N/A";
  return `Rs. ${num.toFixed(2)}`;
};

const parseDisplayDateValue = (value) => {
  if (!value) return null;
  const rawValue = String(value).trim();
  const slashMatch = rawValue.match(/^(\d{2})[/-](\d{2})[/-](\d{4})$/);
  const date = slashMatch
    ? new Date(Number(slashMatch[3]), Number(slashMatch[2]) - 1, Number(slashMatch[1]))
    : new Date(rawValue);
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatDisplayDate = (value) => {
  if (!value) return "N/A";
  const date = parseDisplayDateValue(value);
  if (!date) return String(value);
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
};

const formatDisplayDateTime = (value) => {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

const getDueMeta = (dueDateValue) => {
  if (!dueDateValue) return { text: "Due date unavailable", tone: "neutral" };
  const dueDate = parseDisplayDateValue(dueDateValue);
  if (!dueDate) return { text: "Due date unavailable", tone: "neutral" };
  dueDate.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round((dueDate.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
  if (diffDays < 0) return { text: `${Math.abs(diffDays)} day(s) overdue`, tone: "danger" };
  if (diffDays === 0) return { text: "Due today", tone: "warn" };
  if (diffDays <= 3) return { text: `Due in ${diffDays} day(s)`, tone: "warn" };
  return { text: `Due in ${diffDays} day(s)`, tone: "ok" };
};

const getStatusTone = (status) => {
  const normalized = String(status || "").toUpperCase();
  if (normalized === "SUCCESS") {
    return {
      icon: FaCheckCircle,
      badgeClass: "bg-green-100 text-green-700 border-green-200",
      ringClass: "ring-green-200/70",
    };
  }
  if (normalized === "PENDING") {
    return {
      icon: FaRegClock,
      badgeClass: "bg-amber-100 text-amber-700 border-amber-200",
      ringClass: "ring-amber-200/70",
    };
  }
  if (normalized === "FAILED") {
    return {
      icon: FaTimesCircle,
      badgeClass: "bg-red-100 text-red-700 border-red-200",
      ringClass: "ring-red-200/70",
    };
  }
  return {
    icon: FaExclamationCircle,
    badgeClass: "bg-gray-100 text-gray-700 border-gray-200",
    ringClass: "ring-gray-200/70",
  };
};

const labelClass = "mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600";
const inputClass =
  "w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition-colors focus:border-[#00D3CD] focus:ring-2 focus:ring-[#00D3CD]/20";
const FETCH_BILL_ENQUIRY_AMOUNT = "1";

const sanitizePanNumber = (value = "") => {
  const normalizedValue = String(value).toUpperCase().replace(/[^A-Z0-9]/g, "");
  let nextValue = "";

  for (const character of normalizedValue) {
    const currentIndex = nextValue.length;

    if (currentIndex < 5) {
      if (/[A-Z]/.test(character)) nextValue += character;
      continue;
    }

    if (currentIndex < 9) {
      if (/[0-9]/.test(character)) nextValue += character;
      continue;
    }

    if (currentIndex === 9 && /[A-Z]/.test(character)) {
      nextValue += character;
    }

    if (nextValue.length === 10) break;
  }

  return nextValue;
};

const isValidPanNumber = (value = "") => /^[A-Z]{5}\d{4}[A-Z]$/.test(value);

export default function CCBillPay({ currentUser }) {
  // Route stage detection: base form -> review -> result
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isReviewRoute = location.pathname.endsWith("/review");
  const isResultRoute = location.pathname.endsWith("/result");
  const routeState =
    location.state && typeof location.state === "object" ? location.state : null;
  const billBasePath = location.pathname.replace(/\/(review|result)$/, "");

  const userRole = String(currentUser?.role || "").toLowerCase();
  const isCcBillPayEnabled = getServiceFlagValue(
    currentUser?.service_flags,
    "cc_bill_pay",
    true
  );
  const ipayOutletRaw =
    currentUser?.ipay_outlet_id ??
    currentUser?.ipayOutletId ??
    currentUser?.outletId ??
    currentUser?.outlet_id;
  const hasIpayOutlet = ipayOutletRaw !== undefined && ipayOutletRaw !== null && `${ipayOutletRaw}`.trim() !== "";
  const kycRoute = `${billBasePath}/kyc`;

  // Settlement hold balances
  const walletNum = parseFloat(currentUser?.wallet ?? 0);
  const availableBalanceNum =
    currentUser?.available_balance !== undefined
      ? parseFloat(currentUser.available_balance)
      : walletNum;
  const settlementHoldNum = Math.max(0, walletNum - availableBalanceNum);

  const { data: sharedCcBillLimitResp } = useQuery({
    queryKey: ["sharedCcBillLimit"],
    queryFn: () => getSharedCcBillLimit(),
    staleTime: 10 * 1000,
    refetchInterval: 30 * 1000,
    refetchOnWindowFocus: true,
  });
  const sharedLimit = sharedCcBillLimitResp?.data || null;

  // CC Bill Pay is self-pay only for franchise/merchant; user selection is intentionally hidden.
  const isSelfPayRole =
    userRole === "merchant" || userRole === "franchise" || userRole === "franchaise";
  const fixedPayingUser = useMemo(
    () =>
      isSelfPayRole
        ? {
            id: currentUser?.id ?? currentUser?.user_id ?? "",
            name: currentUser?.name ?? currentUser?.full_name ?? currentUser?.user_name ?? "User",
            mobile: currentUser?.mobile ?? currentUser?.mobile_number ?? currentUser?.phone ?? "",
          }
        : null,
    [currentUser, isSelfPayRole]
  );

  const [selectedBankId, setSelectedBankId] = useState(
    () => String(routeState?.selectedBankId || routeState?.selectedBank?.id || "")
  );
  const [selectedBankSnapshot] = useState(() => routeState?.selectedBank || null);
  const [cardLast4, setCardLast4] = useState(() => String(routeState?.cardLast4 || ""));
  const [mobileNumber, setMobileNumber] = useState(() => String(routeState?.mobileNumber || ""));
  const estimatedAmount = FETCH_BILL_ENQUIRY_AMOUNT;

  const [billData, setBillData] = useState(() => routeState?.billData || null);
  const [paymentModes, setPaymentModes] = useState(() =>
    Array.isArray(routeState?.paymentModes) ? routeState.paymentModes : []
  );
  const [paymentChoice, setPaymentChoice] = useState(() => routeState?.paymentChoice || "total");
  const [customAmount, setCustomAmount] = useState(() => String(routeState?.customAmount || ""));
  const [selectedPaymentModeId, setSelectedPaymentModeId] = useState(
    () => String(routeState?.selectedPaymentModeId || "")
  );
  const [customerPan, setCustomerPan] = useState(() => String(routeState?.customerPan || ""));

  // Server response state for result page
  const [paymentResult, setPaymentResult] = useState(() => routeState?.paymentResult || null);
  const [statusResult, setStatusResult] = useState(() => routeState?.statusResult || null);
  const [bankLogoAttemptIndex, setBankLogoAttemptIndex] = useState({});
  const [copiedField, setCopiedField] = useState("");

  // Geolocation — required by InstantPay before payment can be submitted
  const [geoCode, setGeoCode] = useState("");
  const [geoStatus, setGeoStatus] = useState("idle"); // idle | requesting | granted | denied

  // Bank list source for CC issuer selection
  const {
    data: banks = [],
    isLoading: banksLoading,
    error: banksError,
    refetch: refetchBanks,
  } = useQuery({
    queryKey: ["instantpay-cc-banks"],
    queryFn: getCcBillBanks,
    retry: false,
    enabled: hasIpayOutlet,
  });

  useEffect(() => {
    if (banksLoading) {
      console.log("[CCBillPay] biller list loading...");
      return;
    }
    if (banksError) {
      console.error("[CCBillPay] biller list error", banksError);
      return;
    }
    console.log("[CCBillPay] biller list loaded", {
      count: banks.length,
      sample: banks.slice(0, 3),
    });
  }, [banks, banksError, banksLoading]);

  const selectedUser = useMemo(() => {
    if (isSelfPayRole) return fixedPayingUser;
    return null;
  }, [fixedPayingUser, isSelfPayRole]);

  const selectedBank = useMemo(() => {
    const fromList = banks.find((bank) => String(bank.id) === String(selectedBankId));
    if (fromList) return fromList;
    if (selectedBankSnapshot && String(selectedBankSnapshot.id) === String(selectedBankId)) {
      return selectedBankSnapshot;
    }
    return null;
  }, [banks, selectedBankId, selectedBankSnapshot]);

  const bankOptions = useMemo(
    () =>
      banks.map((bank) => ({
        value: String(bank.id),
        label: String(bank.name || bank.code || "Unknown Bank"),
        bank,
      })),
    [banks]
  );

  const selectedBankOption = useMemo(() => {
    if (!selectedBank) return null;
    return {
      value: String(selectedBank.id),
      label: String(selectedBank.name || selectedBank.code || "Unknown Bank"),
      bank: selectedBank,
    };
  }, [selectedBank]);

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

  const totalDueAmount = toNumber(
    billData?.totalDueAmount ?? billData?.outstandingAmount ?? billData?.raw?.amount,
    null
  );
  const minimumDueAmount = toNumber(billData?.minimumDueAmount, null);

  const selectedPaymentMode = useMemo(() => {
    return paymentModes.find((mode) => mode.id === selectedPaymentModeId) || null;
  }, [paymentModes, selectedPaymentModeId]);
  const paymentModeOptions = useMemo(
    () =>
      paymentModes.map((mode) => ({
        value: mode.id,
        label: mode.label,
      })),
    [paymentModes]
  );
  const selectedPaymentModeOption = useMemo(
    () => paymentModeOptions.find((option) => option.value === selectedPaymentModeId) || null,
    [paymentModeOptions, selectedPaymentModeId]
  );

  const bumpBankLogoCandidate = (bank) => {
    const key = getBankKey(bank);
    const candidateCount = getBankLogoCandidates(bank).length;
    if (!key || candidateCount === 0) return;
    setBankLogoAttemptIndex((prev) => {
      const nextValue = Math.min((prev[key] ?? 0) + 1, candidateCount);
      if (nextValue === (prev[key] ?? 0)) return prev;
      return { ...prev, [key]: nextValue };
    });
  };

  const renderBankLogo = (bank, sizeClass = "h-8 w-8") => {
    const bankKey = getBankKey(bank);
    const candidates = getBankLogoCandidates(bank);
    const selectedIndex = bankLogoAttemptIndex[bankKey] ?? 0;
    const logoUrl = selectedIndex < candidates.length ? candidates[selectedIndex] : "";
    const showImage = Boolean(logoUrl);
    return (
      <span
        className={`${sizeClass} flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-gray-200 bg-white text-[10px] font-semibold uppercase tracking-wide text-gray-600`}
      >
        {showImage ? (
          <img
            src={logoUrl}
            alt={`${bank?.name || "Bank"} logo`}
            className="h-full w-full object-contain p-1"
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={() => bumpBankLogoCandidate(bank)}
          />
        ) : (
          <span>{getBankInitials(bank)}</span>
        )}
      </span>
    );
  };

  const handleCopyField = async (key, value) => {
    if (!value) return;
    try {
      if (!navigator?.clipboard?.writeText) {
        throw new Error("Clipboard unavailable");
      }
      await navigator.clipboard.writeText(String(value));
      setCopiedField(key);
      toast.success("Copied");
      setTimeout(() => {
        setCopiedField((prev) => (prev === key ? "" : prev));
      }, 1400);
    } catch {
      toast.error("Unable to copy");
    }
  };

  const payableAmount = useMemo(() => {
    if (paymentChoice === "minimum") return minimumDueAmount;
    if (paymentChoice === "custom") return toNumber(customAmount, null);
    return totalDueAmount;
  }, [customAmount, minimumDueAmount, paymentChoice, totalDueAmount]);

  // Step 1: fetch bill details from API layer
  const fetchBillMutation = useMutation({
    mutationFn: async () => {
      return fetchCcBill({
        bank: selectedBank,
        cardLast4,
        mobile: mobileNumber,
        user: selectedUser,
        transactionAmount: estimatedAmount,
      });
    },
    onSuccess: (response) => {
      const modes = Array.isArray(response.paymentModes) ? response.paymentModes : [];
      const fetchedTotalDue = toNumber(
        response?.bill?.totalDueAmount ?? response?.bill?.outstandingAmount,
        null
      );
      const defaultPaymentChoice =
        Number.isFinite(fetchedTotalDue) && fetchedTotalDue > 0 ? "total" : "custom";
      const nextState = {
        selectedUserId: getUserIdValue(selectedUser),
        userSearch: getUserOptionLabel(selectedUser),
        selectedBankId: String(selectedBank?.id || ""),
        selectedBank,
        cardLast4,
        mobileNumber,
        estimatedAmount,
        billData: response.bill,
        paymentModes: modes,
        selectedPaymentModeId: modes[0]?.id || "",
        paymentChoice: defaultPaymentChoice,
        customAmount: "",
      };
      setBillData(response.bill);
      setPaymentModes(modes);
      setSelectedPaymentModeId(modes[0]?.id || "");
      setPaymentChoice(defaultPaymentChoice);
      setCustomAmount("");
      setPaymentResult(null);
      toast.success(response.message || "Bill fetched successfully");
      navigate(`${billBasePath}/review`, { state: nextState });
    },
    onError: (error) => {
      toast.error(error.message || "Unable to fetch bill");
    },
  });

  // Step 2: submit payment request from review page
  const payBillMutation = useMutation({
    mutationFn: async () => {
      return submitCcBillPayment({
        amount: payableAmount,
        biller: selectedBank || selectedBankSnapshot,
        cardLast4,
        mobile: mobileNumber,
        paymentMode: selectedPaymentMode,
        billData,
        enquiryReferenceId: billData?.raw?.enquiryReferenceId || billData?.enquiryReferenceId,
        geoCode,
        customerPan: normalizedCustomerPan,
      });
    },
    onSuccess: async (response) => {
      const nextState = {
        selectedUserId: getUserIdValue(selectedUser),
        userSearch: getUserOptionLabel(selectedUser),
        selectedBankId: String(selectedBank?.id || selectedBankSnapshot?.id || ""),
        selectedBank: selectedBank || selectedBankSnapshot || null,
        cardLast4,
        mobileNumber,
        billData,
        customerPan: normalizedCustomerPan,
        paymentResult: response.payment,
      };
      setPaymentResult(response.payment);
      try {
        // Refresh the header wallet and shared CC bill limit from the backend
        await Promise.allSettled([
          queryClient.invalidateQueries({ queryKey: ["currentUser"] }),
          queryClient.invalidateQueries({ queryKey: ["sharedCcBillLimit"] }),
        ]);
      } catch (refreshError) {
        console.error("[cc-bill] failed to refresh current user balance", refreshError);
      }
      toast.success(response.payment?.message || "Payment request submitted");
      navigate(`${billBasePath}/result`, { state: nextState, replace: true });
    },
    onError: async (error) => {
      await queryClient.invalidateQueries({ queryKey: ["sharedCcBillLimit"] }).catch(() => {});
      const errMsg =
        error?.code === "CC_BILL_DAILY_LIMIT_EXCEEDED" || error?.response?.data?.code === "CC_BILL_DAILY_LIMIT_EXCEEDED"
          ? (error?.response?.data?.message || error?.message || "Daily CC bill payment limit exceeded.")
          : getServiceDisabledMessage(error, "Payment request failed");
      toast.error(errMsg);
    },
  });

  // Step 3: check transaction status on result page
  const statusMutation = useMutation({
    mutationFn: async () => {
      const referenceId =
        paymentResult?.referenceId || paymentResult?.transactionId || billData?.referenceId || "";
      return getCcBillPaymentStatus({
        referenceId,
      });
    },
    onSuccess: (response) => {
      setStatusResult(response.payment);
      toast.success(response.payment?.message || "Status fetched");
    },
    onError: (error) => {
      toast.error(error.message || "Unable to fetch status");
    },
  });

  // Auto-request geolocation when the user reaches the review step.
  useEffect(() => {
    if (!isReviewRoute) return;
    if (geoCode) return; // already have it
    if (!navigator?.geolocation) {
      // Browser doesn't support geolocation — use India fallback silently
      setGeoCode("20.5937,78.9629");
      setGeoStatus("granted");
      return;
    }
    setGeoStatus("requesting");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeoCode(`${pos.coords.latitude.toFixed(6)},${pos.coords.longitude.toFixed(6)}`);
        setGeoStatus("granted");
      },
      () => {
        // Permission denied — fall back to India centre so payment can still proceed
        setGeoCode("20.5937,78.9629");
        setGeoStatus("denied");
      },
      { timeout: 10000, enableHighAccuracy: false }
    );
  }, [isReviewRoute, geoCode]);

  const mobileValid = /^\d{10}$/.test(mobileNumber.trim());
  const fetchDisabled =
    !selectedUser || !selectedBank || cardLast4.trim().length < 4 || !mobileValid;

  // Available-balance pre-check for payment
  const estimatedPayAmount = Number.isFinite(payableAmount) && payableAmount > 0 ? payableAmount : 0;
  const minRequiredBalance = estimatedPayAmount + 30; // ₹30 buffer
  const hasInsufficientAvailable =
    estimatedPayAmount > 0 && availableBalanceNum < minRequiredBalance;

  // Shared daily CC bill limit pre-check
  const isDailyLimitExceeded = Boolean(
    sharedLimit &&
    Number(sharedLimit.daily_limit) > 0 &&
    Number.isFinite(payableAmount) &&
    payableAmount > Number(sharedLimit.remaining_amount ?? 0)
  );

  const panRequired = Number.isFinite(payableAmount) && payableAmount > 50000;
  const normalizedCustomerPan = sanitizePanNumber(customerPan);
  const panValid = !panRequired || isValidPanNumber(normalizedCustomerPan);

  const payDisabled =
    !billData ||
    !Number.isFinite(payableAmount) ||
    payableAmount <= 0 ||
    payBillMutation.isPending ||
    (paymentModes.length > 0 && !selectedPaymentMode) ||
    geoStatus === "requesting" ||
    !geoCode ||
    hasInsufficientAvailable ||
    isDailyLimitExceeded ||
    !panValid;
  const currentStep = isResultRoute ? 3 : isReviewRoute ? 2 : 1;
  const flowSteps = [
    { id: 1, title: "Fetch Bill" },
    { id: 2, title: "Review" },
    { id: 3, title: "Result" },
  ];
  const paymentStatusMeta = getStatusTone(paymentResult?.status);
  const PaymentStatusIcon = paymentStatusMeta.icon;
  const activeBankForLogo = selectedBank || selectedBankSnapshot || null;
  const dueMeta = getDueMeta(billData?.dueDate);
  const resultCustomerName = billData?.customerName || "N/A";
  const resultCustomerMobile = billData?.mobileNumber || mobileNumber || "N/A";
  const resultAmount = toNumber(paymentResult?.amount, null);
  const resultStatus = paymentResult?.status || "UNKNOWN";
  const resultStatusLabel =
    resultStatus === "SUCCESS"
      ? "Payment Successful"
      : resultStatus === "FAILED"
        ? "Payment Failed"
        : resultStatus === "PENDING"
          ? "Payment Pending"
          : "Payment Status";
  const resultProcessedAt = paymentResult?.processedAt || new Date().toISOString();
  const resultMessage =
    paymentResult?.providerStatus || paymentResult?.message || "Payment response received";
  const resultSummaryRows = [
    { label: "Customer Name", value: resultCustomerName },
    { label: "Customer Number", value: resultCustomerMobile },
    { label: "Amount", value: formatAmount(resultAmount) },
    { label: "Date", value: formatDisplayDateTime(resultProcessedAt) },
    { label: "Status", value: resultStatusLabel },
    { label: "Biller", value: billData?.bankName || selectedBank?.name || selectedBankSnapshot?.name || "N/A" },
    { label: "Card", value: billData?.cardNumberMasked || "N/A" },
    { label: "Status Code", value: paymentResult?.statusCode || "N/A" },
  ];

  const statusResultMeta = getStatusTone(statusResult?.status);
  const LatestStatusIcon = statusResultMeta.icon;
  const canCheckStatus = Boolean(
    paymentResult?.referenceId || paymentResult?.transactionId || billData?.referenceId,
  );

  if (!hasIpayOutlet) {
    return (
      <div className="mx-auto max-w-3xl p-4">
        <div className="rounded-xl border border-yellow-300 bg-yellow-50 p-8 text-center">
          <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-yellow-100 text-yellow-700">
            <FaExclamationCircle className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">KYC Required</h1>
          <p className="text-gray-700 mb-6">
            To use CC Bill Pay, you need to complete KYC verification first. This enables
            your outlet to be registered with the payment provider.
          </p>
          <button
            type="button"
            onClick={() => navigate(kycRoute)}
            className="rounded-lg bg-primary px-6 py-3 text-white font-semibold shadow hover:opacity-90"
          >
            Complete KYC Now
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl p-4">
      <h1 className="mb-4 text-2xl font-semibold text-gray-900">CC Bill Pay</h1>
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

      {!isCcBillPayEnabled && (
        <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
          <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-700">
            <FaExclamationCircle className="h-6 w-6" />
          </div>
          <h2 className="mb-2 text-xl font-semibold text-gray-900">CC Bill Pay Disabled</h2>
          <p className="text-sm text-gray-600">
            This service is currently disabled by admin. Please try again later.
          </p>
        </div>
      )}

      {isCcBillPayEnabled && !isReviewRoute && !isResultRoute && (
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="bg-[#00B9B2] px-4 py-3">
            <h2 className="text-center text-base font-semibold text-white">Credit Card Bill Payment</h2>
          </div>
          {/* Settlement hold warning */}
          {settlementHoldNum > 0 && (
            <div className="mx-4 mt-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm">
              <span className="mt-0.5 text-amber-500 shrink-0">⚠</span>
              <span className="text-amber-700">
                ₹{settlementHoldNum.toFixed(2)} of your balance is on settlement hold until tomorrow 10:30 AM.{" "}
                Available for payment: <strong>₹{availableBalanceNum.toFixed(2)}</strong>
              </span>
            </div>
          )}
          <div className="space-y-4 p-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <label className={labelClass}>Select Credit Card Biller</label>
                  <button
                    type="button"
                    onClick={() => refetchBanks()}
                    className="rounded border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Refresh
                  </button>
                </div>
                <Select
                  className="text-sm"
                  classNamePrefix="cc-bank-select"
                  options={bankOptions}
                  value={selectedBankOption}
                  onChange={(option) => setSelectedBankId(option?.value || "")}
                  placeholder={banksLoading ? "Loading biller list..." : "Select biller"}
                  isDisabled={banksLoading}
                  isClearable={false}
                  isSearchable
                  formatOptionLabel={(option) => (
                    <div className="flex items-center gap-2 py-0.5">
                      {renderBankLogo(option.bank)}
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-gray-900">{option.label}</p>
                        <p className="text-xs text-gray-500">{getBankCodeValue(option.bank) || "BANK"}</p>
                      </div>
                    </div>
                  )}
                  styles={{
                    control: (base, state) => ({
                      ...base,
                      minHeight: "42px",
                      borderColor: state.isFocused ? "#00B9B2" : "#D1D5DB",
                      boxShadow: state.isFocused ? "0 0 0 2px rgba(0, 185, 178, 0.2)" : "none",
                      "&:hover": {
                        borderColor: "#00B9B2",
                      },
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
                    singleValue: (base) => ({
                      ...base,
                      color: "#111827",
                    }),
                    menu: (base) => ({
                      ...base,
                      zIndex: 20,
                    }),
                    menuPortal: (base) => ({
                      ...base,
                      zIndex: 40,
                    }),
                  }}
                  menuPortalTarget={typeof window !== "undefined" ? window.document.body : null}
                  menuPosition="fixed"
                />
                {selectedBank && (
                  <div className="mt-2 flex items-center gap-2 rounded border border-gray-200 bg-gray-50 px-2 py-2 text-xs text-gray-600">
                    {renderBankLogo(selectedBank, "h-7 w-7")}
                    <span>
                      Selected biller: <span className="font-semibold text-gray-800">{selectedBank.name}</span>
                    </span>
                  </div>
                )}
                {banksError && (
                  <p className="mt-1 text-sm text-red-600">
                    {banksError.message || "Unable to fetch biller list"}
                  </p>
                )}
              </div>

              <div>
                <label className={labelClass}>Enter Credit Card Number (Last 4 digits)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={19}
                  className={inputClass}
                  value={cardLast4}
                  onChange={(event) => {
                    const value = event.target.value.replace(/\D/g, "");
                    setCardLast4(value);
                  }}
                  placeholder="Enter last 4 digits"
                />
                <p className="mt-1 text-xs text-gray-500">Enter the last 4 digits of the credit card used for this bill.</p>
              </div>

              <div>
                <label className={labelClass}>Enter Mobile Number Linked To This Credit Card</label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={10}
                  className={inputClass}
                  value={mobileNumber}
                  onChange={(event) => {
                    const value = event.target.value.replace(/\D/g, "");
                    setMobileNumber(value);
                  }}
                  placeholder="Enter 10 digit mobile number"
                />
                <p className="mt-1 text-xs text-gray-500">Registered number required for bill lookup.</p>
                {mobileNumber !== "" && !mobileValid && (
                  <p className="mt-1 text-xs text-red-600">Enter a valid 10 digit mobile number.</p>
                )}
              </div>

            </div>
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

      {isCcBillPayEnabled && isReviewRoute && billData && (
        <div className="mt-6 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-gray-200">
          <div className="bg-gradient-to-r from-[#00B9B2] to-[#15A5CF] px-4 py-3">
            <h3 className="text-center text-base font-semibold text-white">Biller Information</h3>
          </div>
          {/* Settlement hold warning on review page */}
          {settlementHoldNum > 0 && (
            <div className="mx-4 mt-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm">
              <span className="mt-0.5 text-amber-500 shrink-0">⚠</span>
              <span className="text-amber-700">
                ₹{settlementHoldNum.toFixed(2)} of your balance is on settlement hold until tomorrow 10:30 AM.{" "}
                Available for payment: <strong>₹{availableBalanceNum.toFixed(2)}</strong>
              </span>
            </div>
          )}

          <div className="grid gap-4 p-4 lg:grid-cols-[1.05fr_1fr]">
            <div className="space-y-4">
              <div className="rounded-xl border border-gray-200 bg-gradient-to-b from-[#f7fffe] to-[#ffffff] p-4">
                <div className="mb-3 flex items-center gap-3">
                  {activeBankForLogo ? renderBankLogo(activeBankForLogo, "h-10 w-10") : null}
                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      {billData.customerName || "Customer"}
                    </p>
                    <p className="text-xs text-gray-500">
                      {billData.bankName || selectedBank?.name || selectedBankSnapshot?.name || "N/A"}
                    </p>
                  </div>
                </div>
                <div className="grid gap-2 text-sm text-gray-700 sm:grid-cols-2">
                  <div className="rounded border border-gray-100 bg-white p-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Card</p>
                    <p className="font-medium text-gray-900">{billData.cardNumberMasked || "N/A"}</p>
                  </div>
                  <div className="rounded border border-gray-100 bg-white p-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Mobile</p>
                    <p className="font-medium text-gray-900">{billData.mobileNumber || mobileNumber || "N/A"}</p>
                  </div>
                  <div className="rounded border border-gray-100 bg-white p-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Bill Date</p>
                    <p className="font-medium text-gray-900">{formatDisplayDate(billData.billDate)}</p>
                  </div>
                  <div className="rounded border border-gray-100 bg-white p-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Due Date</p>
                    <p className="font-medium text-gray-900">{formatDisplayDate(billData.dueDate)}</p>
                  </div>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-gray-200 bg-white p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Outstanding</p>
                  <p className="mt-1 text-lg font-semibold text-gray-900">{formatAmount(billData.outstandingAmount)}</p>
                </div>
                {billData.currentOutstandingAmount !== undefined && billData.currentOutstandingAmount !== null && (
                  <div className="rounded-lg border border-gray-200 bg-white p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Current Outstanding Amount</p>
                    <p className="mt-1 text-lg font-semibold text-gray-900">{formatAmount(billData.currentOutstandingAmount)}</p>
                  </div>
                )}
                <div
                  className={`rounded-lg border p-3 ${
                    dueMeta.tone === "danger"
                      ? "border-red-200 bg-red-50"
                      : dueMeta.tone === "warn"
                        ? "border-amber-200 bg-amber-50"
                        : dueMeta.tone === "ok"
                          ? "border-emerald-200 bg-emerald-50"
                          : "border-gray-200 bg-gray-50"
                  }`}
                >
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Due Status</p>
                  <p className="mt-1 text-sm font-semibold text-gray-900">{dueMeta.text}</p>
                </div>
              </div>
            </div>

            <div className="space-y-4 rounded-xl border border-gray-200 bg-gray-50/70 p-4">
              <p className={labelClass}>Payment Amount</p>
              <div className="space-y-2">
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
                      name="payment-choice"
                      value="total"
                      checked={paymentChoice === "total"}
                      onChange={() => setPaymentChoice("total")}
                    />
                    Pay Total Due
                  </span>
                  <span className="font-semibold text-gray-900">{formatAmount(totalDueAmount)}</span>
                </label>

                <label
                  className={`flex cursor-pointer items-center justify-between gap-3 rounded-lg border p-3 text-sm transition ${
                    paymentChoice === "minimum"
                      ? "border-[#00B9B2] bg-[#EFFFFE]"
                      : "border-gray-200 bg-white hover:border-[#00B9B2]/50"
                  } ${!Number.isFinite(minimumDueAmount) ? "opacity-50" : ""}`}
                >
                  <span className="flex items-center gap-2 text-gray-700">
                    <input
                      type="radio"
                      name="payment-choice"
                      value="minimum"
                      checked={paymentChoice === "minimum"}
                      onChange={() => setPaymentChoice("minimum")}
                      disabled={!Number.isFinite(minimumDueAmount)}
                    />
                    Pay Minimum Due
                  </span>
                  <span className="font-semibold text-gray-900">{formatAmount(minimumDueAmount)}</span>
                </label>

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
                      name="payment-choice"
                      value="custom"
                      checked={paymentChoice === "custom"}
                      onChange={() => setPaymentChoice("custom")}
                    />
                    Enter Custom Amount
                  </span>
                </label>
              </div>

              {paymentChoice === "custom" && (
                <div className="rounded-lg border border-[#00B9B2]/30 bg-white p-3">
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Custom Amount
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-500">Rs.</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={customAmount}
                      onChange={(event) => setCustomAmount(event.target.value)}
                      className={inputClass}
                      placeholder="Enter amount"
                    />
                  </div>
                </div>
              )}

              {paymentModes.length > 0 && (
                <div>
                  <label className={labelClass}>Payment Mode</label>
                  <Select
                    className="text-sm"
                    classNamePrefix="cc-payment-mode"
                    options={paymentModeOptions}
                    value={selectedPaymentModeOption}
                    onChange={(option) => setSelectedPaymentModeId(option?.value || "")}
                    isSearchable={false}
                    styles={{
                      control: (base, state) => ({
                        ...base,
                        minHeight: "42px",
                        borderColor: state.isFocused ? "#00B9B2" : "#D1D5DB",
                        backgroundColor: "#FFFFFF",
                        boxShadow: state.isFocused ? "0 0 0 2px rgba(0, 185, 178, 0.2)" : "none",
                        "&:hover": {
                          borderColor: "#00B9B2",
                        },
                      }),
                      option: (base, state) => ({
                        ...base,
                        backgroundColor: state.isSelected
                          ? "rgba(0, 185, 178, 0.16)"
                          : state.isFocused
                            ? "rgba(0, 185, 178, 0.1)"
                            : "#FFFFFF",
                        color: "#1F2937",
                        cursor: "pointer",
                      }),
                      singleValue: (base) => ({
                        ...base,
                        color: "#111827",
                      }),
                      menu: (base) => ({
                        ...base,
                        zIndex: 20,
                      }),
                    }}
                  />
                </div>
              )}

              {selectedPaymentMode && (
                <div className="rounded-lg border border-gray-200 bg-white p-3 text-sm text-gray-700">
                  <p>
                    <span className="font-semibold text-gray-900">Selected Mode:</span> {selectedPaymentMode.label}
                  </p>
                  {selectedPaymentMode.remarks && (
                    <p className="mt-1 text-gray-600">{selectedPaymentMode.remarks}</p>
                  )}
                </div>
              )}

              {panRequired && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <label className={labelClass}>PAN Number *</label>
                  <input
                    type="text"
                    inputMode="text"
                    maxLength={10}
                    value={customerPan}
                    onChange={(event) => setCustomerPan(sanitizePanNumber(event.target.value))}
                    className={inputClass}
                    placeholder="Enter PAN number"
                  />
                  <p className="mt-1 text-xs text-amber-700">
                    PAN is required for CC bill payments above Rs. 50,000.
                  </p>
                  {customerPan !== "" && !panValid && (
                    <p className="mt-1 text-xs text-red-600">
                      Enter a valid PAN in format `ABCDE1234F`.
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-3 border-t border-gray-200 px-4 pb-4 pt-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-2">
              <div className="rounded-lg border border-[#00B9B2]/30 bg-[#EFFFFE] px-3 py-2 text-sm flex items-center justify-between">
                <div>
                  <span className="text-gray-600">Payable Amount:</span>{" "}
                  <span className="font-semibold text-gray-900">{formatAmount(payableAmount)}</span>
                </div>
                {sharedLimit && Number(sharedLimit.daily_limit) > 0 && (
                  <div className="text-xs text-gray-500">
                    Daily Limit Remaining:{" "}
                    <strong className={isDailyLimitExceeded ? "text-red-600" : "text-emerald-700"}>
                      ₹{Number(sharedLimit.remaining_amount ?? 0).toLocaleString("en-IN")}
                    </strong>
                  </div>
                )}
              </div>
              {settlementHoldNum > 0 && (
                <div className="flex items-start gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                  <span className="shrink-0">⚠</span>
                  <span>
                    ₹{settlementHoldNum.toFixed(2)} on settlement hold until tomorrow 10:30 AM.{" "}
                    Available now: <strong>₹{availableBalanceNum.toFixed(2)}</strong>
                  </span>
                </div>
              )}
              {hasInsufficientAvailable && (
                <div className="flex items-start gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  <span className="shrink-0">✕</span>
                  <span>
                    Insufficient available balance.
                    {settlementHoldNum > 0
                      ? ` ₹${settlementHoldNum.toFixed(2)} is on hold and will be available tomorrow at 10:30 AM. Available now: ₹${availableBalanceNum.toFixed(2)}.`
                      : " Please add funds to continue."}
                  </span>
                </div>
              )}
              {isDailyLimitExceeded && (
                <div className="flex items-start gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  <span className="shrink-0">✕</span>
                  <span>
                    Daily CC bill payment limit exceeded for your company. Available limit remaining today:{" "}
                    <strong>₹{Number(sharedLimit?.remaining_amount ?? 0).toLocaleString("en-IN")}</strong>.
                  </span>
                </div>
              )}
            </div>
            <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center">
              {geoStatus === "requesting" && (
                <span className="text-xs text-amber-600 font-medium">
                  Waiting for location permission…
                </span>
              )}
              {geoStatus === "denied" && (
                <button
                  type="button"
                  onClick={() => {
                    setGeoCode("");
                    setGeoStatus("idle");
                  }}
                  className="rounded border border-amber-400 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-100"
                >
                  Location denied — click to retry
                </button>
              )}
              <button
                type="button"
                onClick={() => payBillMutation.mutate()}
                disabled={payDisabled}
                className="w-full rounded bg-[#61C248] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#4cab34] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
              >
                {geoStatus === "requesting"
                  ? "Acquiring location…"
                  : payBillMutation.isPending
                    ? "Processing..."
                    : "Submit Payment"}
              </button>
            </div>
          </div>
        </div>
      )}

      {isCcBillPayEnabled && isResultRoute && paymentResult && (
        <div className={`mt-6 overflow-hidden rounded-2xl bg-white p-4 shadow-sm ring-1 ${paymentStatusMeta.ringClass}`}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <PaymentStatusIcon className="h-5 w-5 text-gray-700" />
              <h4 className="text-base font-semibold text-gray-900">Payment Response</h4>
            </div>
            <span
              className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-wide ${paymentStatusMeta.badgeClass}`}
            >
              {paymentResult.status || "Unknown"}
            </span>
          </div>
          {resultMessage && (
            <p className="mb-4 text-sm text-gray-600">{resultMessage}</p>
          )}

          <div className="grid gap-4 px-5 py-5 sm:px-6 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-3">
                {activeBankForLogo ? renderBankLogo(activeBankForLogo, "h-11 w-11") : null}
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">
                    Customer Details
                  </p>
                  <h4 className="mt-1 text-lg font-semibold text-gray-900">{resultCustomerName}</h4>
                  <p className="text-sm text-gray-500">{resultCustomerMobile}</p>
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {resultSummaryRows.map((row) => (
                  <div key={row.label} className="rounded-xl border border-gray-100 bg-slate-50 px-3 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">
                      {row.label}
                    </p>
                    <p className="mt-1 text-sm font-medium text-gray-900">{row.value || "N/A"}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-gray-200 bg-slate-950 px-4 py-4 text-white shadow-sm">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-300">
                      Transaction References
                    </p>
                    <p className="mt-1 text-sm text-slate-400">
                      Keep these IDs for support, reconciliation, and dispute follow-up.
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                        Transaction ID
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopyField("txnId", paymentResult.transactionId)}
                        className="inline-flex items-center gap-1 rounded border border-slate-700 px-2 py-1 text-[11px] font-medium text-slate-200 hover:bg-slate-800"
                      >
                        <FaCopy className="h-3 w-3" />
                        {copiedField === "txnId" ? "Copied" : "Copy"}
                      </button>
                    </div>
                    <p className="mt-2 break-all font-mono text-sm text-white">
                      {paymentResult.transactionId || "N/A"}
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                        Reference ID
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopyField("refId", paymentResult.referenceId)}
                        className="inline-flex items-center gap-1 rounded border border-slate-700 px-2 py-1 text-[11px] font-medium text-slate-200 hover:bg-slate-800"
                      >
                        <FaCopy className="h-3 w-3" />
                        {copiedField === "refId" ? "Copied" : "Copy"}
                      </button>
                    </div>
                    <p className="mt-2 break-all font-mono text-sm text-white">
                      {paymentResult.referenceId || "N/A"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => statusMutation.mutate()}
              disabled={!canCheckStatus}
              className="rounded bg-[#4F6BEA] px-4 py-2 text-sm font-semibold text-white hover:bg-[#425bd0] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {statusMutation.isPending ? "Checking..." : "Check Status"}
            </button>
            <button
              type="button"
              onClick={() => navigate(billBasePath, { replace: true })}
              className="rounded border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              Back to CC Bill Pay
            </button>
          </div>
        </div>
      )}

      {isCcBillPayEnabled && isResultRoute && statusResult && (
        <div className={`mt-4 rounded-xl bg-white p-4 shadow-sm ring-1 ${statusResultMeta.ringClass}`}>
          <div className="mb-3 flex items-center gap-2">
            <LatestStatusIcon className="h-5 w-5 text-gray-700" />
            <h4 className="text-base font-semibold text-gray-900">Latest Transaction Status</h4>
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
            <div className="rounded-lg border border-gray-200 bg-white p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Transaction ID</p>
              <p className="mt-1 break-all font-medium text-gray-800">{statusResult.transactionId || "N/A"}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 border-t border-gray-200 px-5 py-4 sm:px-6">
            <button
              type="button"
              onClick={() => navigate(billBasePath, { replace: true })}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              Back to CC Bill Pay
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
