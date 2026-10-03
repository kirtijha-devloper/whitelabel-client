import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  FaCheckCircle,
  FaExclamationCircle,
  FaRegClock,
  FaTimesCircle,
} from "react-icons/fa";
import { useLocation, useNavigate } from "react-router-dom";
import Select from "react-select";
import { toast } from "react-toastify";
import bharatConnectLogo from "../assets/bharat-connect-primary-logo.svg";
import {
  extractBillerInputParams,
  fetchBillAvenueBill,
  getBillAvenueBillers,
  getBillAvenueBillerInfo,
  getBillAvenueCcBill3Banks,
  getBillAvenueCcBill3PaymentById,
  submitBillAvenueCcBill3Payment,
} from "../api/billAvenueApi";

const SUPPORTED_BANKS = [
  "HDFC BANK",
  "IDFC FIRST BANK",
  "YES BANK",
  "KOTAK MAHINDRA BANK",
];

const INDIA_GEO_FALLBACK = {
  lat: "20.5937",
  long: "78.9629",
};

const INDIA_STATE_CODES = {
  AN: "AN",
  AP: "AP",
  AR: "AR",
  AS: "AS",
  BR: "BR",
  CG: "CG",
  CH: "CH",
  DD: "DD",
  DL: "DL",
  DN: "DN",
  GA: "GA",
  GJ: "GJ",
  HR: "HR",
  HP: "HP",
  JH: "JH",
  JK: "JK",
  KA: "KA",
  KL: "KL",
  LA: "LA",
  LD: "LD",
  MH: "MH",
  ML: "ML",
  MN: "MN",
  MP: "MP",
  MZ: "MZ",
  NL: "NL",
  OD: "OD",
  OR: "OR",
  PB: "PB",
  PY: "PY",
  RJ: "RJ",
  SK: "SK",
  TN: "TN",
  TR: "TR",
  TS: "TS",
  UK: "UK",
  UP: "UP",
  WB: "WB",
  ANDAMANANDNICOBARISLANDS: "AN",
  ANDHRAPRADESH: "AP",
  ARUNACHALPRADESH: "AR",
  ASSAM: "AS",
  BIHAR: "BR",
  CHANDIGARH: "CH",
  CHHATTISGARH: "CG",
  DADRAANDNAGARHAVELIANDDAMANANDDIU: "DN",
  DAMANANDDIU: "DD",
  DELHI: "DL",
  GOA: "GA",
  GUJARAT: "GJ",
  HARYANA: "HR",
  HIMACHALPRADESH: "HP",
  JAMMUANDKASHMIR: "JK",
  JHARKHAND: "JH",
  KARNATAKA: "KA",
  KERALA: "KL",
  LADAKH: "LA",
  LAKSHADWEEP: "LD",
  MADHYAPRADESH: "MP",
  MAHARASHTRA: "MH",
  MANIPUR: "MN",
  MEGHALAYA: "ML",
  MIZORAM: "MZ",
  NAGALAND: "NL",
  ODISHA: "OD",
  PUDUCHERRY: "PY",
  PUNJAB: "PB",
  RAJASTHAN: "RJ",
  SIKKIM: "SK",
  TAMILNADU: "TN",
  TELANGANA: "TS",
  TRIPURA: "TR",
  UTTARAKHAND: "UK",
  UTTARPRADESH: "UP",
  WESTBENGAL: "WB",
};

const labelClass =
  "mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600";
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

const normalizeText = (value) => String(value ?? "").trim();

const isCardNumberParam = (param) => {
  const key = normalizeText(param?.key).toLowerCase();
  const label = normalizeText(param?.label).toLowerCase();
  const combined = `${key} ${label}`;
  return combined.includes("card") && combined.includes("number");
};

const isMobileParam = (param) => {
  const key = normalizeText(param?.key).toLowerCase();
  const label = normalizeText(param?.label).toLowerCase();
  const combined = `${key} ${label}`;
  return combined.includes("mobile");
};

const normalizeCcBill3Param = (param) => {
  if (isCardNumberParam(param)) {
    return {
      ...param,
      normalizedKey: "cardNumber",
      label: "Credit Card Number",
      type: "NUMERIC",
      minLength: Math.max(Number(param?.minLength) || 0, 12),
      maxLength: Math.max(Number(param?.maxLength) || 0, 19),
    };
  }

  if (isMobileParam(param)) {
    return {
      ...param,
      normalizedKey: "mobile",
      label: "Registered Mobile Number",
      type: "NUMERIC",
      minLength: Math.max(Number(param?.minLength) || 0, 10),
      maxLength: Math.max(Number(param?.maxLength) || 0, 10),
    };
  }

  return param;
};

const buildFetchCustomerParams = (billerInputParams, customerParamsValues) => {
  const params = {};
  billerInputParams.forEach((param) => {
    const value = normalizeText(customerParamsValues[param.key]);
    if (value) {
      params[param.key] = value;
    }
  });
  return params;
};

const buildPayCustomerParams = (billerInputParams, customerParamsValues) => {
  const params = {};
  billerInputParams.forEach((param) => {
    const value = normalizeText(customerParamsValues[param.key]);
    if (!value) return;
    const payloadKey = normalizeText(param.normalizedKey || param.key);
    params[payloadKey] = value;
  });
  return params;
};

const maskCardNumber = (value) => {
  const digits = normalizeText(value).replace(/\D/g, "");
  if (!digits) return "N/A";
  if (digits.length <= 4) return digits;
  return `•••• •••• •••• ${digits.slice(-4)}`;
};

const toNumber = (value, fallback = null) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

const formatAmount = (value) => {
  const num = toNumber(value);
  if (!Number.isFinite(num)) return "N/A";
  return `₹${num.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
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

const pickArray = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.list)) return payload.list;
  if (Array.isArray(payload?.rows)) return payload.rows;
  if (Array.isArray(payload?.result)) return payload.result;
  if (Array.isArray(payload?.data?.data)) return payload.data.data;
  return [];
};

const normalizeStateCode = (value) => {
  const direct = normalizeText(value).toUpperCase();
  if (direct && direct.length <= 3 && INDIA_STATE_CODES[direct]) {
    return INDIA_STATE_CODES[direct];
  }

  const compact = normalizeText(value)
    .toUpperCase()
    .replace(/[^A-Z]/g, "");
  return INDIA_STATE_CODES[compact] || "";
};

const extractFetchId = (payload) =>
  normalizeText(
    payload?.data?.fetchId ||
      payload?.data?.id ||
      payload?.data?._requestId ||
      payload?.data?.requestId ||
      payload?.fetchId ||
      payload?.id ||
      payload?._requestId ||
      payload?.requestId
  );

const extractPaymentId = (payload) =>
  normalizeText(
    payload?.data?.paymentId ||
      payload?.data?.id ||
      payload?.data?._id ||
      payload?.data?.payment?.id ||
      payload?.paymentId ||
      payload?.id ||
      payload?._id
  );

const normalizePollResult = (payload) => {
  const source =
    payload?.data?.payment ||
    payload?.data?.data ||
    payload?.data ||
    payload?.payment ||
    payload;
  const normalizedStatus = normalizeText(
    source?.status ||
      source?.paymentStatus ||
      source?.txnStatus ||
      source?.transactionStatus
  ).toUpperCase();

  const terminalStatus =
    normalizedStatus === "SUCCESS" || normalizedStatus === "FAILED"
      ? normalizedStatus
      : "PROCESSING";

  return {
    status: terminalStatus,
    message: normalizeText(
      source?.message || source?.statusMessage || payload?.message
    ) || (terminalStatus === "SUCCESS"
      ? "Payment completed successfully"
      : terminalStatus === "FAILED"
        ? "Payment failed"
        : "Waiting for bank callback"),
    referenceId: normalizeText(
      source?.referenceId ||
        source?.transactionRefId ||
        source?.txnReferenceId ||
        source?.bankReferenceId ||
        source?.rrn
    ),
    raw: payload,
  };
};

const getResultTone = (status) => {
  const normalized = normalizeText(status).toUpperCase();
  if (normalized === "SUCCESS") {
    return {
      icon: FaCheckCircle,
      ringClass: "ring-green-200/80",
      badgeClass: "bg-green-100 text-green-700 border-green-200",
    };
  }
  if (normalized === "FAILED") {
    return {
      icon: FaTimesCircle,
      ringClass: "ring-red-200/80",
      badgeClass: "bg-red-100 text-red-700 border-red-200",
    };
  }
  return {
    icon: FaRegClock,
    ringClass: "ring-amber-200/80",
    badgeClass: "bg-amber-100 text-amber-700 border-amber-200",
  };
};

export default function BillAvenueCCBill3Flow({
  currentUser,
  onExitFlow,
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const pollTimerRef = useRef(null);

  const isReviewRoute = location.pathname.endsWith("/review");
  const isResultRoute = location.pathname.endsWith("/result");
  const routeState =
    location.state && typeof location.state === "object" ? location.state : null;
  const billBasePath = useMemo(
    () => location.pathname.replace(/\/(review|result)$/, ""),
    [location.pathname]
  );
  const routeSuffix = location.search || "";

  const walletNum = parseFloat(currentUser?.wallet ?? 0);
  const availableBalanceNum =
    currentUser?.available_balance !== undefined
      ? parseFloat(currentUser.available_balance)
      : walletNum;
  const settlementHoldNum = Math.max(0, walletNum - availableBalanceNum);

  const [selectedBillerId, setSelectedBillerId] = useState(
    () => String(routeState?.selectedBillerId || "")
  );
  const [selectedBillerSnapshot] = useState(
    () => routeState?.selectedBiller || null
  );
  const [selectedBillerInfo, setSelectedBillerInfo] = useState(
    () => routeState?.selectedBillerInfo || null
  );
  const [customerParamsValues, setCustomerParamsValues] = useState(
    () => routeState?.customerParamsValues || {}
  );
  const [billData, setBillData] = useState(() => routeState?.billData || null);
  const [paymentChoice, setPaymentChoice] = useState(
    () => routeState?.paymentChoice || "total"
  );
  const [customAmount, setCustomAmount] = useState(
    () => String(routeState?.customAmount || "")
  );
  const [customerPan, setCustomerPan] = useState(
    () => String(routeState?.customerPan || "")
  );
  const [selectedBankName, setSelectedBankName] = useState(
    () => routeState?.selectedBankName || ""
  );
  const [beneficiaryLocation, setBeneficiaryLocation] = useState(
    () =>
      routeState?.beneficiaryLocation ||
      normalizeStateCode(currentUser?.state || currentUser?.address?.state || "")
  );
  const [geo, setGeo] = useState(() => routeState?.geo || null);
  const [geoStatus, setGeoStatus] = useState(
    () => routeState?.geoStatus || "idle"
  );
  const [pollState, setPollState] = useState(
    () =>
      routeState?.pollState || {
        status: "IDLE",
        message: "",
        referenceId: "",
        raw: null,
      }
  );
  const [paymentRecordId, setPaymentRecordId] = useState(
    () => routeState?.paymentRecordId || ""
  );

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
    const fromList = billers.find((biller) => biller.id === selectedBillerId);
    if (fromList) return fromList;
    if (
      selectedBillerSnapshot &&
      selectedBillerSnapshot.id === selectedBillerId
    ) {
      return selectedBillerSnapshot;
    }
    return null;
  }, [billers, selectedBillerId, selectedBillerSnapshot]);

  const billerOptions = useMemo(
    () =>
      billers.map((biller) => ({
        value: biller.id,
        label: biller.name || biller.id || "Unknown Biller",
        biller,
      })),
    [billers]
  );

  const selectedBillerOption = useMemo(
    () =>
      selectedBiller
        ? {
            value: selectedBiller.id,
            label: selectedBiller.name,
            biller: selectedBiller,
          }
        : null,
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
        if (isCurrent) {
          setSelectedBillerInfo(info);
        }
      } catch (error) {
        if (isCurrent) {
          console.error("[BillAvenue][CC Bill 3] failed to fetch biller info", error);
          setSelectedBillerInfo(null);
        }
      }
    };

    fetchInfo();
    return () => {
      isCurrent = false;
    };
  }, [selectedBillerId]);

  const billerInputParams = useMemo(() => {
    const detailedParams =
      selectedBillerInfo?.data?.billerInfoResponse?.biller?.billerInputParams
        ?.paramInfo;
    if (Array.isArray(detailedParams) && detailedParams.length > 0) {
      return detailedParams.map((param) =>
        normalizeCcBill3Param({
          key: param.paramName,
          label: param.paramName,
          type: param.dataType || "ALPHANUMERIC",
          minLength: param.minLength || null,
          maxLength: param.maxLength || null,
          optional:
            String(param.isOptional || "false").toLowerCase() === "true",
        })
      );
    }
    return extractBillerInputParams(selectedBiller).map(normalizeCcBill3Param);
  }, [selectedBiller, selectedBillerInfo]);

  useEffect(() => {
    if (!selectedBiller || isReviewRoute || isResultRoute) return;
    const defaultValues = {};
    billerInputParams.forEach((param) => {
      defaultValues[param.key] = customerParamsValues[param.key] || "";
    });
    setCustomerParamsValues(defaultValues);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBiller?.id]);

  const {
    data: bankPayload,
    isLoading: banksLoading,
    error: banksError,
    refetch: refetchBanks,
  } = useQuery({
    queryKey: ["billavenue-cc-bill-3-banks"],
    queryFn: getBillAvenueCcBill3Banks,
    enabled: isReviewRoute,
    retry: false,
  });

  const bankOptions = useMemo(() => {
    const rows = pickArray(bankPayload);
    return rows
      .map((row) =>
        normalizeText(
          row?.bankName || row?.name || row?.label || row?.value || row
        ).toUpperCase()
      )
      .filter((name) => SUPPORTED_BANKS.includes(name))
      .map((name) => ({ value: name, label: name }));
  }, [bankPayload]);

  useEffect(() => {
    if (selectedBankName) return;
    if (bankOptions.length === 1) {
      setSelectedBankName(bankOptions[0].value);
    }
  }, [bankOptions, selectedBankName]);

  useEffect(() => {
    if (!isReviewRoute) return;
    if (geo?.lat && geo?.long) return;

    if (!navigator?.geolocation) {
      setGeo(INDIA_GEO_FALLBACK);
      setGeoStatus("fallback");
      return;
    }

    setGeoStatus("requesting");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setGeo({
          lat: String(position.coords.latitude),
          long: String(position.coords.longitude),
        });
        setGeoStatus("granted");
      },
      () => {
        setGeo(INDIA_GEO_FALLBACK);
        setGeoStatus("fallback");
      },
      { timeout: 10000, enableHighAccuracy: false }
    );
  }, [geo?.lat, geo?.long, isReviewRoute]);

  useEffect(() => {
    if (!isReviewRoute) return;
    if (routeState?.billData) return;
    navigate(`${billBasePath}${routeSuffix}`, { replace: true });
  }, [billBasePath, isReviewRoute, navigate, routeState, routeSuffix]);

  useEffect(() => {
    if (!isResultRoute) return;
    if (routeState?.paymentRecordId || routeState?.pollState?.status) return;
    navigate(`${billBasePath}${routeSuffix}`, { replace: true });
  }, [billBasePath, isResultRoute, navigate, routeState, routeSuffix]);

  const fetchedBillResponse =
    billData?.data?.billFetchResponse?.billerResponse ||
    billData?.data?.billerResponse ||
    billData?.data ||
    {};
  const rawDueAmount = toNumber(
    fetchedBillResponse.amountDue ||
      fetchedBillResponse.billAmount ||
      fetchedBillResponse.dueAmount ||
      fetchedBillResponse.amount ||
      fetchedBillResponse.totalDueAmount,
    null
  );
  const totalDueAmount = Number.isFinite(rawDueAmount) ? rawDueAmount / 100 : null;
  const payableAmount = useMemo(() => {
    if (paymentChoice === "custom") {
      return toNumber(customAmount, null);
    }
    return totalDueAmount;
  }, [customAmount, paymentChoice, totalDueAmount]);
  const fetchId = extractFetchId(billData);
  const allParamsFilled = billerInputParams.every(
    (param) =>
      param.optional || normalizeText(customerParamsValues[param.key]).length > 0
  );
  const fetchDisabled = !selectedBiller || !allParamsFilled;

  const fetchBillMutation = useMutation({
    mutationFn: async () => {
      const params = buildFetchCustomerParams(
        billerInputParams,
        customerParamsValues
      );

      return fetchBillAvenueBill({
        billerId: selectedBiller.id,
        customerParams: params,
      });
    },
    onSuccess: (response) => {
      const params = buildFetchCustomerParams(
        billerInputParams,
        customerParamsValues
      );
      const rawFetchedDue = toNumber(
        response?.data?.billFetchResponse?.billerResponse?.amountDue ||
          response?.data?.billFetchResponse?.billerResponse?.billAmount ||
          response?.data?.billerResponse?.amountDue ||
          response?.data?.billerResponse?.billAmount ||
          response?.data?.dueAmount ||
          response?.data?.amount ||
          response?.data?.totalDueAmount,
        null
      );
      const fetchedDue = Number.isFinite(rawFetchedDue) ? rawFetchedDue / 100 : null;
      const nextPaymentChoice =
        Number.isFinite(fetchedDue) && fetchedDue > 0 ? "total" : "custom";

      const nextState = {
        selectedBillerId: selectedBiller.id,
        selectedBiller,
        selectedBillerInfo,
        customerParamsValues: params,
        billData: response,
        paymentChoice: nextPaymentChoice,
        customAmount: "",
        selectedBankName: "",
        beneficiaryLocation:
          beneficiaryLocation ||
          normalizeStateCode(currentUser?.state || currentUser?.address?.state),
        geo,
        geoStatus,
        flowVariant: "cc-bill-3",
      };

      setBillData(response);
      setPaymentChoice(nextPaymentChoice);
      setCustomAmount("");
      setSelectedBankName("");
      setPaymentRecordId("");
      setPollState({ status: "IDLE", message: "", referenceId: "", raw: null });
      toast.success("Bill fetched successfully");
      navigate(`${billBasePath}/review${routeSuffix}`, { state: nextState });
    },
    onError: (error) => {
      toast.error(error.message || "Unable to fetch bill");
    },
  });

  const payMutation = useMutation({
    mutationFn: async () => {
      const params = buildPayCustomerParams(
        billerInputParams,
        customerParamsValues
      );

      return submitBillAvenueCcBill3Payment({
        billerId: selectedBiller?.id || selectedBillerSnapshot?.id || "",
        customerParams: params,
        bankName: selectedBankName,
        amount: payableAmount,
        lat: geo?.lat,
        long: geo?.long,
        beneficiaryLocation,
      });
    },
    onSuccess: (response) => {
      const nextPaymentId = extractPaymentId(response);
      if (!nextPaymentId) {
        toast.error("Payment started but no payment ID was returned");
        return;
      }

      const nextPollState = {
        status: "PROCESSING",
        message: "Waiting for bank callback",
        referenceId: "",
        raw: response,
      };

      const nextState = {
        selectedBillerId,
        selectedBiller: selectedBiller || selectedBillerSnapshot,
        selectedBillerInfo,
        customerParamsValues,
        billData,
        paymentChoice,
        customAmount,
        selectedBankName,
        beneficiaryLocation,
        geo,
        geoStatus,
        paymentRecordId: nextPaymentId,
        pollState: nextPollState,
        flowVariant: "cc-bill-3",
      };

      setPaymentRecordId(nextPaymentId);
      setPollState(nextPollState);
      toast.info("Payment request accepted. Waiting for bank callback.");
      navigate(`${billBasePath}/result${routeSuffix}`, {
        state: nextState,
        replace: true,
      });
    },
    onError: (error) => {
      toast.error(error.message || "Unable to start CC Bill 3 payment");
    },
  });

  const isPanRequired = Number.isFinite(payableAmount) && payableAmount >= 50000;
  const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
  const isPanValid = !isPanRequired || panRegex.test(String(customerPan).trim().toUpperCase());

  const payDisabled =
    !(selectedBiller?.id || selectedBillerSnapshot?.id) ||
    !Number.isFinite(payableAmount) ||
    payableAmount <= 0 ||
    !selectedBankName ||
    !beneficiaryLocation ||
    !geo?.lat ||
    !geo?.long ||
    banksLoading ||
    !isPanValid ||
    payMutation.isPending;

  useEffect(() => {
    const clearTimer = () => {
      if (pollTimerRef.current) {
        clearTimeout(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };

    if (!isResultRoute || !paymentRecordId || pollState.status !== "PROCESSING") {
      clearTimer();
      return clearTimer;
    }

    let cancelled = false;

    const pollStatus = async () => {
      try {
        const response = await getBillAvenueCcBill3PaymentById(paymentRecordId);
        if (cancelled) return;

        const nextState = normalizePollResult(response);
        setPollState(nextState);

        if (nextState.status === "PROCESSING") {
          pollTimerRef.current = setTimeout(pollStatus, 5000);
          return;
        }

        toast[nextState.status === "SUCCESS" ? "success" : "error"](
          nextState.message
        );
      } catch (error) {
        if (cancelled) return;
        setPollState((current) => ({
          ...current,
          status: "PROCESSING",
          message:
            error.message ||
            "Unable to reach the bank callback service. Retrying...",
        }));
        pollTimerRef.current = setTimeout(pollStatus, 5000);
      }
    };

    pollTimerRef.current = setTimeout(pollStatus, 0);

    return () => {
      cancelled = true;
      clearTimer();
    };
  }, [isResultRoute, paymentRecordId, pollState.status]);

  const currentStep = isResultRoute ? 3 : isReviewRoute ? 2 : 1;
  const flowSteps = [
    { id: 1, title: "Fetch Bill" },
    { id: 2, title: "Confirm" },
    { id: 3, title: "Processing" },
  ];

  const resultTone = getResultTone(pollState.status);
  const ResultIcon = resultTone.icon;
  const activeBiller = selectedBiller || selectedBillerSnapshot;

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-2xl border border-[#00B9B2]/20 bg-[#00B9B2] shadow-sm">
        <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-100/80">
              New Flow
            </p>
            <h2 className="mt-1 text-2xl font-semibold text-white">
              CC Bill 3
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-cyan-50/85">
              Use the BillAvenue fetch-bill journey first, then complete payment
              with bank callback tracking.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-white px-3 py-2 shadow-sm ring-1 ring-white/60">
              <img
                src={bharatConnectLogo}
                alt="Bharat Connect BBPS"
                className="block h-auto w-24 bg-white object-contain sm:w-[120px]"
              />
            </div>
            <button
              type="button"
              onClick={onExitFlow}
              className="rounded-lg border border-white/30 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20"
            >
              Back to Existing Flow
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          {flowSteps.map((step) => {
            const isDone = step.id < currentStep;
            const isActive = step.id === currentStep;
            return (
              <div key={step.id} className="flex min-w-0 flex-1 items-center gap-2">
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
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

      {!isReviewRoute && !isResultRoute && (
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="bg-[#00B9B2] px-4 py-3">
            <h3 className="text-base font-semibold text-white">
              CC Bill 3 Fetch Bill
            </h3>
          </div>

          {settlementHoldNum > 0 && (
            <div className="mx-4 mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-700">
              ₹{settlementHoldNum.toFixed(2)} is on settlement hold. Available
              balance: <strong>₹{availableBalanceNum.toFixed(2)}</strong>
            </div>
          )}

          <div className="space-y-4 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
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
                    setBillData(null);
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
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-700">
                <p className="font-semibold">Unable to load billers</p>
                <p className="mt-1">{billersError.message}</p>
              </div>
            )}

            {!billersLoading && !billersError && billers.length === 0 && (
              <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-3 text-sm text-gray-700">
                <p className="font-semibold">No billers available</p>
                <p className="mt-1">
                  The biller list is empty right now. Please retry.
                </p>
              </div>
            )}

            {selectedBiller && (
              <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-700">
                Selected biller:{" "}
                <span className="font-semibold text-gray-900">
                  {selectedBiller.name}
                </span>{" "}
                <span className="text-gray-400">({selectedBiller.id})</span>
              </div>
            )}

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
                      type="text"
                      inputMode={param.type === "NUMERIC" ? "numeric" : "text"}
                      maxLength={param.maxLength || undefined}
                      className={inputClass}
                      value={customerParamsValues[param.key] || ""}
                      onChange={(event) => {
                        const nextValue =
                          param.type === "NUMERIC"
                            ? event.target.value.replace(/\D/g, "")
                            : event.target.value;
                        setCustomerParamsValues((current) => ({
                          ...current,
                          [param.key]: nextValue,
                        }));
                      }}
                      placeholder={`Enter ${param.label}`}
                    />
                    {isCardNumberParam(param) && (
                      <p className="mt-1 text-xs text-gray-500">
                        Enter full credit card number for backend processing.
                      </p>
                    )}
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

      {isReviewRoute && billData && (
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="bg-gradient-to-r from-[#00B9B2] to-[#15A5CF] px-4 py-3">
            <h3 className="text-center text-base font-semibold text-white">
              Confirm CC Bill 3 Payment
            </h3>
          </div>

          <div className="grid gap-4 p-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
            <div className="space-y-4">
              <div className="rounded-xl border border-gray-200 bg-gradient-to-b from-[#f7fffe] to-white p-4">
                <p className="text-sm font-semibold text-gray-900">
                  {activeBiller?.name || "Biller"}
                </p>
                <p className="text-xs text-gray-500">{activeBiller?.id || ""}</p>

                <div className="mt-4 grid gap-2 text-sm text-gray-700 sm:grid-cols-2">
                  {Object.entries(customerParamsValues).map(([key, value]) => (
                    <div key={key} className="rounded border border-gray-100 bg-white p-2">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                        {key}
                      </p>
                      <p className="break-all font-medium text-gray-900">
                        {isCardNumberParam({ key, label: key })
                          ? maskCardNumber(value)
                          : value || "N/A"}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-gray-200 bg-white p-4 text-sm">
                <p className={`${labelClass} mb-3`}>Fetched Bill Details</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded border border-gray-100 bg-gray-50 p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                      Fetched Amount
                    </p>
                    <p className="mt-1 font-semibold text-gray-900">
                      {formatAmount(totalDueAmount)}
                    </p>
                  </div>
                  <div className="rounded border border-gray-100 bg-gray-50 p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                      Fetch ID
                    </p>
                    <p className="mt-1 break-all font-medium text-gray-900">
                      {fetchId || "N/A"}
                    </p>
                  </div>
                  <div className="rounded border border-gray-100 bg-gray-50 p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                      Customer
                    </p>
                    <p className="mt-1 font-medium text-gray-900">
                      {fetchedBillResponse.customerName ||
                        fetchedBillResponse.billerName ||
                        "N/A"}
                    </p>
                  </div>
                  <div className="rounded border border-gray-100 bg-gray-50 p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                      Due Date
                    </p>
                    <p className="mt-1 font-medium text-gray-900">
                      {formatDisplayDate(
                        fetchedBillResponse.dueDate || fetchedBillResponse.billDate
                      )}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4 rounded-xl border border-gray-200 bg-gray-50/70 p-4">
              <div>
                <p className={labelClass}>Payment Amount</p>

                {Number.isFinite(totalDueAmount) && totalDueAmount > 0 && (
                  <label
                    className={`mb-3 flex cursor-pointer items-center justify-between gap-3 rounded-lg border p-3 text-sm transition ${
                      paymentChoice === "total"
                        ? "border-[#00B9B2] bg-[#EFFFFE]"
                        : "border-gray-200 bg-white hover:border-[#00B9B2]/50"
                    }`}
                  >
                    <span className="flex items-center gap-2 text-gray-700">
                      <input
                        type="radio"
                        name="cc-bill-3-payment-choice"
                        value="total"
                        checked={paymentChoice === "total"}
                        onChange={() => setPaymentChoice("total")}
                      />
                      Pay Fetched Amount
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
                      name="cc-bill-3-payment-choice"
                      value="custom"
                      checked={paymentChoice === "custom"}
                      onChange={() => setPaymentChoice("custom")}
                    />
                    Enter Custom Amount
                  </span>
                </label>

                {paymentChoice === "custom" && (
                  <div className="mt-3 rounded-lg border border-[#00B9B2]/30 bg-white p-3">
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
                        onChange={(event) => setCustomAmount(event.target.value)}
                        onWheel={(event) => event.target.blur()}
                        onKeyDown={(event) => {
                          if (event.key === "ArrowUp" || event.key === "ArrowDown") {
                            event.preventDefault();
                          }
                        }}
                        className={`${inputClass} [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`}
                        placeholder="Enter amount"
                      />
                    </div>
                  </div>
                )}

                {isPanRequired && (
                  <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50/80 p-3 space-y-1.5">
                    <label className="block text-xs font-semibold uppercase tracking-wide text-amber-900">
                      PAN Card Number <span className="text-red-500">*</span> (Required for ₹50,000 & above)
                    </label>
                    <input
                      type="text"
                      maxLength={10}
                      value={customerPan}
                      onChange={(event) => setCustomerPan(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
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

                <div className="mt-3 rounded-lg border border-[#00B9B2]/30 bg-[#EFFFFE] px-3 py-2 text-sm">
                  <span className="text-gray-600">Amount to be paid: </span>
                  <span className="font-semibold text-gray-900">
                    {formatAmount(payableAmount)}
                  </span>
                </div>
              </div>

              <div>
                <label className={labelClass}>Bank</label>
                {banksError ? (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                    <p className="font-semibold">Unable to load banks</p>
                    <p className="mt-1">{banksError.message}</p>
                    <button
                      type="button"
                      onClick={() => refetchBanks()}
                      className="mt-3 rounded border border-red-300 bg-white px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100"
                    >
                      Retry Banks
                    </button>
                  </div>
                ) : banksLoading ? (
                  <div className="rounded-lg border border-gray-200 bg-white px-3 py-3 text-sm text-gray-600">
                    Loading supported banks...
                  </div>
                ) : bankOptions.length === 0 ? (
                  <div className="rounded-lg border border-gray-200 bg-white px-3 py-3 text-sm text-gray-600">
                    <p className="font-semibold text-gray-800">
                      No supported banks returned
                    </p>
                    <p className="mt-1">
                      Only HDFC BANK, IDFC FIRST BANK, YES BANK, and KOTAK
                      MAHINDRA BANK are allowed for this flow.
                    </p>
                    <button
                      type="button"
                      onClick={() => refetchBanks()}
                      className="mt-3 rounded border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                    >
                      Retry Banks
                    </button>
                  </div>
                ) : (
                  <select
                    value={selectedBankName}
                    onChange={(event) => setSelectedBankName(event.target.value)}
                    className={inputClass}
                  >
                    <option value="">Select bank</option>
                    {bankOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className={labelClass}>Beneficiary State Code</label>
                <input
                  type="text"
                  maxLength={3}
                  value={beneficiaryLocation}
                  onChange={(event) =>
                    setBeneficiaryLocation(
                      event.target.value.toUpperCase().replace(/[^A-Z]/g, "")
                    )
                  }
                  className={inputClass}
                  placeholder="DL"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Example: `DL`, `JH`, `MH`
                </p>
              </div>

              <div className="rounded-lg border border-gray-200 bg-white p-3 text-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Device Location
                </p>
                {geoStatus === "requesting" && (
                  <p className="mt-1 text-gray-600">
                    Requesting device location...
                  </p>
                )}
                {geo && (
                  <p className="mt-1 break-all font-medium text-gray-900">
                    {geo.lat}, {geo.long}
                  </p>
                )}
                {geoStatus === "fallback" && (
                  <p className="mt-2 text-xs text-amber-700">
                    Browser location was unavailable, so a fallback location is
                    being used.
                  </p>
                )}
              </div>

              {settlementHoldNum > 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-700">
                  ₹{settlementHoldNum.toFixed(2)} is on hold. Available balance:
                  ₹{availableBalanceNum.toFixed(2)}
                </div>
              )}

              {!fetchId && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-700">
                  Fetch ID was not returned by the bill fetch response, so CC
                  Bill 3 payment cannot continue.
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-3 border-t border-gray-200 px-4 pb-4 pt-3 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              onClick={() => navigate(`${billBasePath}${routeSuffix}`, { replace: true })}
              className="rounded border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              ← Back
            </button>
            <button
              type="button"
              onClick={() => payMutation.mutate()}
              disabled={payDisabled}
              className="w-full rounded bg-[#61C248] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#4cab34] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            >
              {payMutation.isPending ? "Starting Payment..." : "Pay"}
            </button>
          </div>
        </div>
      )}

      {isResultRoute && (
        <div
          className={`overflow-hidden rounded-2xl bg-white p-4 shadow-sm ring-1 ${resultTone.ringClass}`}
        >
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <ResultIcon className="h-5 w-5 text-gray-700" />
              <h3 className="text-base font-semibold text-gray-900">
                CC Bill 3 Payment Status
              </h3>
            </div>
            <span
              className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-wide ${resultTone.badgeClass}`}
            >
              {pollState.status || "PROCESSING"}
            </span>
          </div>

          {pollState.status === "PROCESSING" ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-center">
              <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-amber-200 border-t-amber-500" />
              <p className="text-lg font-semibold text-gray-900">Processing</p>
              <p className="mt-2 text-sm text-gray-600">
                Waiting for bank callback
              </p>
              <p className="mt-3 text-xs text-amber-700">
                {pollState.message || "We are checking the latest status every 5 seconds."}
              </p>
            </div>
          ) : (
            <div
              className={`rounded-xl border p-5 text-center ${
                pollState.status === "SUCCESS"
                  ? "border-green-200 bg-green-50"
                  : "border-red-200 bg-red-50"
              }`}
            >
              <p className="text-lg font-semibold text-gray-900">
                {pollState.status === "SUCCESS" ? "Payment Successful" : "Payment Failed"}
              </p>
              <p className="mt-2 text-sm text-gray-700">
                {pollState.message || "No message returned"}
              </p>
              {pollState.referenceId && (
                <p className="mt-3 break-all text-sm font-semibold text-gray-900">
                  Reference ID: {pollState.referenceId}
                </p>
              )}
            </div>
          )}

          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => navigate(`${billBasePath}${routeSuffix}`, { replace: true })}
              className="rounded border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              New Payment
            </button>
            <button
              type="button"
              onClick={onExitFlow}
              className="rounded border border-[#00B9B2]/40 bg-[#EFFFFE] px-4 py-2 text-sm font-semibold text-[#0b6973] hover:bg-[#dcfffb]"
            >
              Exit CC Bill 3
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
