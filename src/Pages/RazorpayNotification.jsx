
import React, { useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, Loader2, Upload } from "lucide-react";
import Table from "../components/Table";
import Modal from "../components/Modal";
import {
  getRazorpayNotifications,
  adminProcessNotification,
  adminProcessNotificationCustom,
  previewPinelabData,
  uploadPinelabNotifications,
  processSingleNotificationRow,
} from "../api/razorpayApi";
import {
  getWorldlineNotifications,
  adminProcessWorldlineNotification,
} from "../api/worldlineApi";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import * as XLSX from "xlsx";
import { hasPermission } from "../utils/accessControl";
import {
  getRowBank,
  getRowCardClassification,
  getRowProvider,
  getRowSource,
  getSourceLabel,
  RAZORPAY_SOURCE_OPTIONS,
} from "../utils/agroScope";

const PREVIEW_TABLE_COLUMNS = [
  { header: "tid", key: "tid" },
  { header: "mid", key: "mid" },
  { header: "txn_id", key: "txn_id" },
  {
    header: "amount",
    key: "amount",
    render: (value) => (value !== null && value !== undefined ? Number(value).toFixed(2) : "-"),
  },
  {
    header: "card_type",
    key: "card_type",
    render: (value) => value || "-",
  },
  {
    header: "card_brand",
    key: "card_brand",
    render: (value) => value || "-",
  },
  {
    header: "card_sub_type",
    key: "card_sub_type",
    render: (value) => value || "-",
  },
  {
    header: "charge",
    key: "charge",
    render: (value) => (value !== null && value !== undefined ? Number(value).toFixed(2) : "-"),
  },
  {
    header: "charge_percentage",
    key: "charge_percentage",
    render: (value) => (value !== null && value !== undefined ? Number(value).toFixed(2) : "-"),
  },
  {
    header: "left_amount",
    key: "left_amount",
    render: (value) => (value !== null && value !== undefined ? Number(value).toFixed(2) : "-"),
  },
  {
    header: "date",
    key: "date",
    render: (value) => (value ? value : "-"),
  },
];

const isExcelLikeFile = (file) => {
  const fileName = String(file?.name || "").toLowerCase();
  const fileType = String(file?.type || "").toLowerCase();
  return (
    fileName.endsWith(".csv") ||
    fileName.endsWith(".xlsx") ||
    fileName.endsWith(".xls") ||
    fileType === "text/csv" ||
    fileType === "application/vnd.ms-excel" ||
    fileType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
};

const normalizeHeaderKey = (key) => {
  const k = String(key || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "_").replace(/_+/g, "_");
  if (
    ["amount", "txn_amount", "transaction_amount", "total_amount", "gross_amount", "net_amount", "paid_amount", "amt", "amount_rs", "amount_inr", "amount_pos"].includes(k) ||
    k.includes("amount") ||
    k.includes("amt")
  ) {
    return "amount";
  }
  if (
    ["txn_id", "txnid", "transaction_id", "ref_no", "rrn", "reference_no", "order_id"].includes(k) ||
    k.includes("txnid") ||
    k.includes("txn_id")
  ) {
    return "txn_id";
  }
  if (["card_type", "cardtype", "payment_mode", "mode"].includes(k)) {
    return "card_type";
  }
  if (["card_brand", "cardbrand", "brand"].includes(k)) {
    return "card_brand";
  }
  if (["card_sub_type", "cardsubtype", "sub_type"].includes(k)) {
    return "card_sub_type";
  }
  return String(key || "").trim();
};

const cleanAmountValue = (val) => {
  if (val === null || val === undefined || val === "") return "";
  if (typeof val === "number") return val;
  const str = String(val).replace(/[₹,Rs\.INR\s]/gi, "").trim();
  const num = parseFloat(str);
  return Number.isFinite(num) ? num : val;
};

const convertToPreviewCsvFile = async (file) => {
  if (!file) {
    throw new Error("Please select a file first.");
  }

  try {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });
    const sheetName =
      workbook?.SheetNames?.find((name) => {
        const sheet = workbook?.Sheets?.[name];
        if (!sheet) return false;
        const rows = XLSX.utils.sheet_to_json(sheet, {
          header: 1,
          raw: false,
          defval: "",
          blankrows: false,
        });
        return rows.length > 0;
      }) || workbook?.SheetNames?.[0];

    if (!sheetName) {
      throw new Error("The uploaded workbook does not contain a readable sheet.");
    }

    const sheet = workbook.Sheets[sheetName];
    const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

    if (!Array.isArray(rawRows) || rawRows.length === 0) {
      return file;
    }

    // Telering Reversal Logic: Find all RRNs that correspond to a REVERSAL
    const reversalRRNs = new Set();
    rawRows.forEach((row) => {
      let type = "";
      let txnId = "";
      Object.keys(row).forEach((origKey) => {
        const kLower = String(origKey || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
        const val = String(row[origKey] !== undefined && row[origKey] !== null ? row[origKey] : "").trim();
        if (kLower.includes("txnid") || kLower.includes("rrn") || kLower.includes("ref")) txnId = val;
        if (kLower.includes("type") && (kLower.includes("txn") || kLower.includes("transaction"))) type = val.toUpperCase();
      });
      if (type === "REVERSAL" && txnId) {
        reversalRRNs.add(txnId);
      }
    });

    // Filter out duplicate transaction rows (same TID + MID + Txn ID/RRN + Amount)
    const seenTxnKeys = new Set();
    const uniqueRawRows = rawRows.filter((row) => {
      let tid = "";
      let mid = "";
      let txnId = "";
      let amount = "";
      let type = "";

      Object.keys(row).forEach((origKey) => {
        const kLower = String(origKey || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
        const val = String(row[origKey] !== undefined && row[origKey] !== null ? row[origKey] : "").trim();
        if (kLower === "tid" || kLower.includes("tid")) tid = val;
        if (kLower === "mid" || kLower.includes("mid")) mid = val;
        if (kLower.includes("txnid") || kLower.includes("rrn") || kLower.includes("ref")) txnId = val;
        if (kLower.includes("amount") || kLower.includes("amt")) amount = val;
        if (kLower.includes("type") && (kLower.includes("txn") || kLower.includes("transaction"))) type = val.toUpperCase();
      });

      // Skip standalone reversals AND sales that have a matching reversal
      if (type === "REVERSAL") {
        console.warn(`Skipped REVERSAL transaction in Excel upload: TxnID=${txnId}`);
        return false;
      }
      if (txnId && reversalRRNs.has(txnId)) {
        console.warn(`Skipped SALE transaction because a REVERSAL exists: TxnID=${txnId}`);
        return false;
      }

      const uniqueKey = `${tid}_${mid}_${txnId}_${amount}`.toLowerCase();
      if (uniqueKey !== "___" && seenTxnKeys.has(uniqueKey)) {
        console.warn(`Duplicate transaction row skipped in Excel upload: TID=${tid}, MID=${mid}, TxnID=${txnId}, Amount=${amount}`);
        return false;
      }
      if (uniqueKey !== "___") {
        seenTxnKeys.add(uniqueKey);
      }
      return true;
    });

    const normalizedRows = uniqueRawRows.map((row) => {
      const newRow = {};
      Object.keys(row).forEach((origKey) => {
        const normalizedKey = normalizeHeaderKey(origKey);
        let val = row[origKey];
        
        if (
          normalizedKey === "amount" ||
          String(origKey).toLowerCase().includes("amount") ||
          String(origKey).toLowerCase().includes("amt")
        ) {
          val = cleanAmountValue(val);
        } else if (typeof val === 'number') {
          // Convert numbers to string to prevent XLSX from using scientific notation (like 6.23E+11)
          val = String(val);
        }

        // Preserve original column name from Excel/CSV
        newRow[origKey] = val;
        // Map normalized column key
        newRow[normalizedKey] = val;

        // Provide multi-case & alias column headers for backend parser compatibility
        if (normalizedKey === "amount") {
          newRow["amount"] = val;
          newRow["Amount"] = val;
          newRow["AMOUNT"] = val;
          newRow["Txn Amount"] = val;
          newRow["Transaction Amount"] = val;
          newRow["Net Amount"] = val;
          newRow["Total Amount"] = val;
        }
        if (normalizedKey === "txn_id") {
          newRow["txn_id"] = val;
          newRow["Txn ID"] = val;
          newRow["TXN_ID"] = val;
          newRow["Transaction ID"] = val;
        }
        if (normalizedKey === "card_type") {
          newRow["card_type"] = val;
          newRow["Card Type"] = val;
          newRow["CARD_TYPE"] = val;
        }
        if (normalizedKey === "card_brand") {
          newRow["card_brand"] = val;
          newRow["Card Brand"] = val;
          newRow["CARD_BRAND"] = val;
        }
      });

      // Fallback: If amount key is still missing/0/empty, search any key matching amount/amt/val
      if (
        newRow.amount === undefined ||
        newRow.amount === null ||
        newRow.amount === "" ||
        Number(newRow.amount) === 0
      ) {
        Object.keys(row).forEach((origKey) => {
          const kLower = String(origKey).toLowerCase();
          if (
            kLower.includes("amt") ||
            kLower.includes("amount") ||
            kLower.includes("val") ||
            kLower.includes("price") ||
            kLower.includes("sum")
          ) {
            const parsed = cleanAmountValue(row[origKey]);
            if (typeof parsed === "number" && parsed > 0) {
              newRow.amount = parsed;
              newRow["Amount"] = parsed;
              newRow["AMOUNT"] = parsed;
              newRow["Txn Amount"] = parsed;
              newRow["Transaction Amount"] = parsed;
            }
          }
        });
      }

      return newRow;
    });

    const normalizedSheet = XLSX.utils.json_to_sheet(normalizedRows);
    const csvContent = XLSX.utils.sheet_to_csv(normalizedSheet);

    const csvName = String(file.name || "telering-preview")
      .replace(/\.(xlsx|xls|csv)$/i, "")
      .concat(".csv");

    return new File([csvContent], csvName, { type: "text/csv" });
  } catch (err) {
    console.warn("CSV preprocessor fallback to original file:", err);
    return file;
  }
};

const buildBaseFilters = () => ({
  source: "",
  bank: "",
  provider: "",
  cardClassification: "",
  status: "",
  processing_status: "",
  processed: "",
  txn_id: "",
  mid: "",
  tid: "",
  paymentMode: "",
  deviceSerial: "",
  startDate: "",
  endDate: "",
  include_unlinked: "false",
});

const hasNotificationRows = (payload) => {
  if (Array.isArray(payload?.data)) return payload.data.length > 0;
  if (Array.isArray(payload)) return payload.length > 0;
  return false;
};

const RazorpayNotification = ({ currentUser }) => {
  const baseFilters = useMemo(() => buildBaseFilters(), []);
  const fallbackNoticeRef = useRef("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [filters, setFilters] = useState(baseFilters);
  const [appliedFilters, setAppliedFilters] = useState(baseFilters);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedRow, setSelectedRow] = useState(null);
  const canViewNotifications = hasPermission(currentUser, "razorpay.notifications.list");
  const canReadNotifications = hasPermission(currentUser, "razorpay.notifications.read");
  const [isProcessModalOpen, setIsProcessModalOpen] = useState(false);
  const [processMode, setProcessMode] = useState("rule");
  const [processingRow, setProcessingRow] = useState(null);
  const [customCharge, setCustomCharge] = useState({ charge_percent: "", charge_flat: "" });
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPreviewUploadModalOpen, setIsPreviewUploadModalOpen] = useState(false);
  const [isPreviewResultsModalOpen, setIsPreviewResultsModalOpen] = useState(false);
  const [previewFile, setPreviewFile] = useState(null);
  const [previewResult, setPreviewResult] = useState(null);
  const [uploadProvider, setUploadProvider] = useState("pinelab");
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isUploadingNotifications, setIsUploadingNotifications] = useState(false);
  const [isPreviewDebugModalOpen, setIsPreviewDebugModalOpen] = useState(false);
  const [previewDebugRow, setPreviewDebugRow] = useState(null);

  const [isSequentialProgressModalOpen, setIsSequentialProgressModalOpen] = useState(false);
  const [sequentialProgress, setSequentialProgress] = useState({
    current: 0,
    total: 0,
    insertedCount: 0,
    duplicateCount: 0,
    failedCount: 0,
    isFinished: false,
    logs: [],
  });

  const queryClient = useQueryClient();

  const isWorldlineRecord = (row) => {
    const rowSrc = String(getRowSource(row) || row?.source || "").trim().toLowerCase();
    const appliedSrc = String(appliedFilters.source || "").trim().toLowerCase();
    return rowSrc === "worldline" || appliedSrc === "worldline";
  };

  const handleWorldlineAdminProcess = async (row) => {
    const id = row?.id || row?._id || row?.txn_id || row?.rrn;
    if (!id) {
      toast.error("Cannot determine notification id.");
      return;
    }
    setIsProcessing(true);
    try {
      const result = await adminProcessWorldlineNotification(id);
      toast.success(result?.message || "Worldline notification processed successfully.");
      refetch();
      queryClient.invalidateQueries(["razorpay_notifications"]);
    } catch (err) {
      const message = err?.response?.data?.message || err.message || "Failed to process Worldline notification.";
      toast.error(message);
    } finally {
      setIsProcessing(false);
    }
  };

  const { data, isLoading, isError, error, isFetching, refetch } = useQuery({
    queryKey: ["razorpay_notifications", { page, limit, appliedFilters }],
    queryFn: async () => {
      const queryParams = Object.fromEntries(
        Object.entries(appliedFilters).filter(([key, value]) => {
          if (value === "" || value === null || value === undefined) return false;
          if (key === "include_unlinked" && value === "false") return false;
          return true;
        })
      );
      const requestedSource = String(queryParams.source || "").trim().toLowerCase();
      console.log("Querying notifications with params", { page, limit, ...queryParams });

      if (requestedSource === "worldline") {
        const response = await getWorldlineNotifications({ page, limit, ...queryParams });
        return response;
      }

      const response = await getRazorpayNotifications({ page, limit, ...queryParams });

      if (requestedSource === "agro_axis" && !hasNotificationRows(response)) {
        const fallbackResponse = await getRazorpayNotifications({
          page,
          limit,
          ...queryParams,
          source: "agro",
        });

        return {
          ...fallbackResponse,
          __legacyFallbackSource: "agro",
          __requestedSource: requestedSource,
        };
      }

      return response;
    },
    keepPreviousData: true,
    onSuccess: (res) => {
      console.log("Razorpay notifications full response:", res);
      if (!res?.data) {
        console.warn("Razorpay notifications response has no data", res);
      } else {
        console.log("Razorpay notifications sample row:", res.data[0]);
      }
      const fallbackKey = `${res?.__requestedSource || ""}->${res?.__legacyFallbackSource || ""}`;
      if (res?.__legacyFallbackSource && fallbackNoticeRef.current !== fallbackKey) {
        fallbackNoticeRef.current = fallbackKey;
        toast.info(
          `No records found for ${getSourceLabel(res.__requestedSource)}. Showing legacy AGRO records temporarily.`
        );
      }
    },
    onError: (err) => {
      toast.error(err?.message || "Failed to load notifications");
    },
  });

  const isProcessable = (row) => {
    const status = String(row?.processing_status || row?.processingStatus || "").trim().toLowerCase();
    if (status === "completed") return false;

    // Guard: Telering txns before Sep 21 2026 are already offline-settled — block manual processing
    const source = String(row?.source || "").trim().toLowerCase();
    const isTelering = source === "telering";
    if (isTelering) {
      // Use posting_date (actual txn date from file) — NOT createdAt (DB insert date)
      const txnDate = row?.posting_date || row?.postingDate;
      if (txnDate) {
        const cutoff = new Date("2026-09-21T00:00:00.000Z"); // Sep 21 IST = Sep 20 18:30 UTC ≈ Sep 21 00:00 IST
        const rowDate = new Date(txnDate);
        if (rowDate < cutoff) return false; // pre-Sep21 telering → offline settled, block
      }
    }

    return true;
  };

  const renderProcessingStatusBadge = (row) => {
    const raw = String(row?.processing_status || row?.processingStatus || "").trim().toLowerCase();
    if (raw === "completed") {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200">
          🟢 completed
        </span>
      );
    }
    if (raw === "pending") {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700 border border-amber-200">
          🟡 pending
        </span>
      );
    }
    if (["needs_admin", "needs-admin", "needsadmin", "needs admin"].includes(raw)) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-700 border border-red-200">
          🔴 needs_admin
        </span>
      );
    }
    return raw || "-";
  };

  const getProcessingError = (row) => {
    return row?.processing_error ?? row?.processingError ?? null;
  };

  const notifications = useMemo(() => {
    // Backend returns filtered/paginated results based on query params.
    // Do not re-filter in client to avoid page-scoped search mismatch.
    return Array.isArray(data?.data) ? data.data : [];
  }, [data]);

  const pagination = data?.pagination || { total: 0, page, limit, totalPages: 1 };
  const totalPages = pagination?.totalPages || 1;

  const handleFilterChange = (field, value) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
  };

  const applyFilters = (e) => {
    e.preventDefault();
    setPage(1);

    const effectiveFilters = Object.fromEntries(
      Object.entries(filters).filter(([key, value]) => {
        if (value === "" || value === null || value === undefined) return false;
        if (key === "include_unlinked" && value === "false") return false;
        return true;
      })
    );

    const searchParams = new URLSearchParams({
      page: "1",
      limit: String(limit),
      ...effectiveFilters,
    }).toString();

    console.log(`GET /razorpay/notification?${searchParams}`);

    setAppliedFilters(filters);
  };

  const clearFilters = () => {
    setFilters(baseFilters);
    setAppliedFilters(baseFilters);
    setPage(1);
  };

  const handleViewDetails = (row) => {
    if (!canReadNotifications) {
      toast.error("This account cannot view notification details.");
      return;
    }
    setSelectedRow(row);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedRow(null);
  };

  const openProcessModal = (row, mode) => {
    setProcessingRow(row);
    setProcessMode(mode);
    setCustomCharge({ charge_percent: "", charge_flat: "" });
    setIsProcessModalOpen(true);
  };

  const closeProcessModal = () => {
    setIsProcessModalOpen(false);
    setProcessingRow(null);
    setCustomCharge({ charge_percent: "", charge_flat: "" });
    setIsProcessing(false);
  };

  const getProviderLabel = (provider) => {
    if (provider === "yesbank") return "Yes Bank (Worldline)";
    if (provider === "paytm") return "Paytm";
    if (provider === "telering") return "Telering";
    return "Pine Labs";
  };

  const openPreviewModal = (provider = "pinelab") => {
    setUploadProvider(provider);
    setPreviewFile(null);
    setPreviewResult(null);
    setIsPreviewUploadModalOpen(true);
  };

  const closePreviewModal = () => {
    setIsPreviewUploadModalOpen(false);
    setPreviewFile(null);
    setIsPreviewing(false);
  };

  const closePreviewResultsModal = () => {
    setIsPreviewResultsModalOpen(false);
    setPreviewResult(null);
    setPreviewFile(null);
  };

  const closePreviewDebugModal = () => {
    setIsPreviewDebugModalOpen(false);
    setPreviewDebugRow(null);
  };

  const handlePreviewFileChange = (event) => {
    const file = event.target.files?.[0] || null;
    if (!file) {
      setPreviewFile(null);
      return;
    }

    if (!isExcelLikeFile(file)) {
      toast.error("Please upload a CSV, XLS, or XLSX file.");
      event.target.value = "";
      setPreviewFile(null);
      return;
    }

    setPreviewFile(file);
  };

  const handlePreviewSubmit = async () => {
    if (!previewFile) {
      toast.error("Please choose a file first.");
      return;
    }

    setIsPreviewing(true);

    try {
      const csvFile = await convertToPreviewCsvFile(previewFile);
      const result = await previewPinelabData(csvFile, uploadProvider);

      setPreviewResult(result);
      setIsPreviewUploadModalOpen(false);
      setIsPreviewResultsModalOpen(true);
      toast.success(result?.message || "Preview loaded successfully.");
    } catch (err) {
      const message = err?.response?.data?.message || err.message || `Failed to preview ${getProviderLabel(uploadProvider)} data.`;
      toast.error(message);
    } finally {
      setIsPreviewing(false);
    }
  };

  const handlePinelabUploadSubmit = async () => {
    if (!previewFile) {
      toast.error("Please choose a file first.");
      return;
    }

    setIsUploadingNotifications(true);

    try {
      const csvFile = await convertToPreviewCsvFile(previewFile);
      const arrayBuffer = await csvFile.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: "array" });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const rawRows = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

      if (!rawRows || rawRows.length === 0) {
        toast.error("The uploaded file is empty or could not be parsed.");
        setIsUploadingNotifications(false);
        return;
      }

      // Open Sequential Progress Overlay Modal
      setSequentialProgress({
        current: 0,
        total: rawRows.length,
        insertedCount: 0,
        duplicateCount: 0,
        failedCount: 0,
        isFinished: false,
        logs: [],
      });
      setIsSequentialProgressModalOpen(true);

      let inserted = 0;
      let duplicate = 0;
      let failed = 0;
      const logsArr = [];

      for (let i = 0; i < rawRows.length; i++) {
        const row = rawRows[i];
        try {
          const res = await processSingleNotificationRow(row, uploadProvider, i);
          if (res?.status === "inserted" || res?.status === "processed") {
            inserted++;
            logsArr.unshift(`[Row ${i + 1}] Txn: ${res.txnId || "N/A"} -> Inserted & Processed ✅`);
          } else if (res?.status === "duplicate") {
            duplicate++;
            logsArr.unshift(`[Row ${i + 1}] Txn: ${res.txnId || "N/A"} -> Duplicate (Skipped) 🟡`);
          } else if (res?.status === "skipped") {
            duplicate++;
            logsArr.unshift(`[Row ${i + 1}] Txn: ${res.txnId || "N/A"} -> Settlement Record (Skipped) 🟡`);
          } else {
            failed++;
            logsArr.unshift(`[Row ${i + 1}] Txn: ${res?.txnId || "N/A"} -> Failed: ${res?.message || "Error"} 🔴`);
          }
        } catch (err) {
          failed++;
          const errStr = err?.response?.data?.message || err.message || "Network/Server error";
          logsArr.unshift(`[Row ${i + 1}] Processing error: ${errStr} 🔴`);
        }

        setSequentialProgress({
          current: i + 1,
          total: rawRows.length,
          insertedCount: inserted,
          duplicateCount: duplicate,
          failedCount: failed,
          isFinished: i === rawRows.length - 1,
          logs: [...logsArr],
        });
      }
    } catch (err) {
      const message = err?.response?.data?.message || err.message || `Failed to process ${getProviderLabel(uploadProvider)} notifications.`;
      toast.error(message);
    } finally {
      setIsUploadingNotifications(false);
    }
  };

  const handlePreviewDebugClick = (row) => {
    setPreviewDebugRow(row);
    setIsPreviewDebugModalOpen(true);
  };

  const handleProcessSubmit = async () => {
    if (!processingRow) {
      toast.error("No notification selected for processing.");
      return;
    }

    if (processingRow.processing_status === "completed") {
      toast.info("Notification is already completed.");
      return;
    }

    const id = processingRow.id || processingRow._id || processingRow.transaction_id;
    if (!id) {
      toast.error("Cannot determine notification id.");
      return;
    }

    setIsProcessing(true);

    try {
      let result;

      if (processMode === "rule") {
        result = await adminProcessNotification(id);
      } else {
        if (!customCharge.charge_percent && !customCharge.charge_flat) {
          toast.error("Please provide charge_percent and/or charge_flat for custom processing.");
          setIsProcessing(false);
          return;
        }

        const payload = {};
        if (customCharge.charge_percent !== "") {
          payload.charge_percent = Number(customCharge.charge_percent);
        }
        if (customCharge.charge_flat !== "") {
          payload.charge_flat = Number(customCharge.charge_flat);
        }

        if (!payload.charge_percent && !payload.charge_flat) {
          toast.error("Invalid custom charge values.");
          setIsProcessing(false);
          return;
        }

        result = await adminProcessNotificationCustom(id, payload);
      }

      toast.success(result?.message || "Notification processed successfully.");
      closeProcessModal();
      refetch();
      queryClient.invalidateQueries(["razorpay_notifications"]);
    } catch (err) {
      const message = err?.response?.data?.message || err.message || "Failed to process notification.";
      toast.error(message);
    } finally {
      setIsProcessing(false);
    }
  };

  const renderValue = (value) => {
    if (value === null || value === undefined) return "-";

    const urlRegex = /^(https?:\/\/)/i;

    if (typeof value === "string") {
      if (urlRegex.test(value)) {
        return (
          <a
            href={value}
            target="_blank"
            rel="noopener noreferrer"
            className="text-indigo-600 hover:underline break-all"
          >
            {value}
          </a>
        );
      }
      return value;
    }

    if (typeof value === "number" || typeof value === "boolean") {
      return String(value);
    }

    if (Array.isArray(value)) {
      return (
        <ul className="list-disc pl-5 space-y-1">
          {value.map((item, idx) => (
            <li key={idx}>{renderValue(item)}</li>
          ))}
        </ul>
      );
    }

    if (typeof value === "object") {
      return (
        <div className="space-y-1">
          {Object.entries(value).map(([childKey, childValue]) => (
            <div key={childKey} className="flex flex-wrap gap-1 break-all">
              <span className="font-medium">{childKey}:</span>
              <span>{renderValue(childValue)}</span>
            </div>
          ))}
        </div>
      );
    }

    return String(value);
  };

  const columns = [
    {
      header: "Source",
      key: "source",
      render: (_val, row) => getSourceLabel(getRowSource(row) || appliedFilters.source),
    },
    {
      header: "Settlement Type",
      key: "settlement_type",
      render: (_val, row) => {
        const raw = row?.settlement_type || row?.settlementType;
        if (!raw) return "-";
        const lower = String(raw).toLowerCase().replace(/[^a-z0-9]+/g, '');
        if (lower === 'todaysettlement' || lower === 't0' || lower === 'samedaysettlement') {
          return <span className="inline-flex items-center rounded-full bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700">T+0</span>;
        }
        if (lower === 'nextdaysettlement' || lower === 't1' || lower === 'tplus1') {
          return <span className="inline-flex items-center rounded-full bg-purple-50 px-2.5 py-1 text-xs font-semibold text-purple-700">T+1</span>;
        }
        return String(raw);
      },
    },
    {
      header: "Card Classification",
      key: "cardClassification",
      render: (_val, row) => getRowCardClassification(row) || "-",
    },
    {
      header: "Txn ID",
      key: "txn_id",
      render: (val, row) => row?.rrn || row?.txn_id || row?.id || row?.event_json?.txnId || "-",
    },
    {
      header: "MID",
      key: "mid",
      render: (val, row) => row?.mid || row?.event_json?.mid || "-",
    },
    {
      header: "TID",
      key: "tid",
      render: (val, row) => row?.tid || row?.event_json?.tid || "-",
    },
    {
      header: "Amount",
      key: "amount",
      render: (val, row) => {
        const amount = val ?? row?.amountOriginal ?? row?.event_json?.amount ?? row?.amount;
        return amount != null ? `₹${amount}` : "-";
      },
    },
    {
      header: "Currency",
      key: "currency_code",
      render: (val, row) => row?.currency_code || row?.currencyCode || "-",
    },
    {
      header: "Mode",
      key: "payment_mode",
      render: (val, row) => row?.card_scheme || row?.payment_mode || row?.paymentMode || "-",
    },
    { header: "Status", key: "status" },
    {
      header: "Processing Status",
      key: "processing_status",
      render: (val, row) => renderProcessingStatusBadge(row),
    },
    {
      header: "Processing Error",
      key: "processing_error",
      render: (val, row) => getProcessingError(row) || "-",
    },
    {
      header: "Admin Actions",
      key: "admin_actions",
      render: (_, row) => {
        if (isWorldlineRecord(row)) {
          const rawStatus = String(row?.processing_status || row?.processingStatus || "").trim().toLowerCase();
          if (["needs_admin", "needs-admin", "needsadmin", "needs admin", "pending"].includes(rawStatus)) {
            return (
              <button
                className="px-2.5 py-1 text-xs font-semibold text-white bg-indigo-600 rounded hover:bg-indigo-700 disabled:opacity-50"
                disabled={isProcessing}
                onClick={(e) => {
                  e.stopPropagation();
                  handleWorldlineAdminProcess(row);
                }}
              >
                Admin Process
              </button>
            );
          }
          return "-";
        }

        if (!isProcessable(row)) {
          return "-";
        }
        return (
          <div className="flex flex-wrap gap-2">
            <button
              className="px-2 py-1 text-xs font-medium text-white bg-green-600 rounded hover:bg-green-700"
              onClick={(e) => {
                e.stopPropagation();
                openProcessModal(row, "rule");
              }}
            >
              Process now
            </button>
            <button
              className="px-2 py-1 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700"
              onClick={(e) => {
                e.stopPropagation();
                openProcessModal(row, "custom");
              }}
            >
              Process custom
            </button>
          </div>
        );
      },
    },
    { header: "Processed", key: "processed", render: (val, row) => String(val ?? row?.processed ?? "-") },
    {
      header: "User",
      key: "user",
      render: (user) => user?.name || "-",
    },
    {
      header: "POS Machine",
      key: "pos_machine",
      render: (pos) => pos?.mid_number || "-",
    },
    {
      header: "Posting Date",
      key: "posting_date",
      render: (val, row) => {
        const dateValue = val || row?.postingDate || row?.posting_date;
        return dateValue ? new Date(dateValue).toLocaleString() : "-";
      },
    },
    {
      header: "Created At",
      key: "created_at",
      render: (val, row) => {
        const createdValue = val || row?.createdAt || row?.created_at;
        return createdValue ? new Date(createdValue).toLocaleString() : "-";
      },
    },
  ];

  if (!canViewNotifications) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
        <h2 className="text-xl font-semibold text-gray-900">Razorpay Access Required</h2>
        <p className="mt-2 text-sm text-gray-500">
          This account does not currently have permission to open Razorpay notifications.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-gray-100 min-h-screen">
      <div className="bg-white shadow-sm rounded-lg p-4 mb-4">
        <h2 className="text-xl font-semibold mb-4">Razorpay Notification Report</h2>
        <form onSubmit={applyFilters} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <select
            className="border rounded-lg px-3 py-2"
            value={filters.source}
            onChange={(e) => handleFilterChange("source", e.target.value)}
          >
            <option value="">Source</option>
            {RAZORPAY_SOURCE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <select
            className="border rounded-lg px-3 py-2"
            value={filters.settlement_type || filters.settlementType || ""}
            onChange={(e) => handleFilterChange("settlement_type", e.target.value)}
          >
            <option value="">Settlement Type</option>
            <option value="T0">T+0 (Today Settlement)</option>
            <option value="T1">T+1 (Next Day Settlement)</option>
          </select>
          <input
            className="border rounded-lg px-3 py-2"
            placeholder="Card Classification"
            value={filters.cardClassification}
            onChange={(e) => handleFilterChange("cardClassification", e.target.value)}
          />
          <select
            className="border rounded-lg px-3 py-2"
            value={filters.status}
            onChange={(e) => handleFilterChange("status", e.target.value)}
          >
            <option value="">Status</option>
            <option value="AUTHORIZED">AUTHORIZED</option>
            <option value="FAILED">FAILED</option>
            <option value="SETTLED">SETTLED</option>
            <option value="CAPTURED">CAPTURED</option>
            <option value="PENDING">PENDING</option>
          </select>
          <select
            className="border rounded-lg px-3 py-2"
            value={filters.processing_status}
            onChange={(e) => handleFilterChange("processing_status", e.target.value)}
          >
            <option value="">Processing Status</option>
            <option value="pending">pending</option>
            <option value="completed">completed</option>
            <option value="needs_admin">needs_admin</option>
            <option value="failed">failed</option>
          </select>
          <select
            className="border rounded-lg px-3 py-2"
            value={filters.processed}
            onChange={(e) => handleFilterChange("processed", e.target.value)}
          >
            <option value="">Processed</option>
            <option value="true">true</option>
            <option value="false">false</option>
          </select>
          <input
            className="border rounded-lg px-3 py-2"
            placeholder="Txn ID"
            value={filters.txn_id}
            onChange={(e) => handleFilterChange("txn_id", e.target.value)}
          />
          <input
            className="border rounded-lg px-3 py-2"
            placeholder="MID"
            value={filters.mid}
            onChange={(e) => handleFilterChange("mid", e.target.value)}
          />
          <input
            className="border rounded-lg px-3 py-2"
            placeholder="TID"
            value={filters.tid}
            onChange={(e) => handleFilterChange("tid", e.target.value)}
          />
          <select
            className="border rounded-lg px-3 py-2"
            value={filters.paymentMode}
            onChange={(e) => handleFilterChange("paymentMode", e.target.value)}
          >
            <option value="">Payment Mode</option>
            <option value="UPI">UPI</option>
            <option value="CARD">CARD</option>
            <option value="NETBANKING">NETBANKING</option>
            <option value="WALLET">WALLET</option>
          </select>
          <input
            className="border rounded-lg px-3 py-2"
            placeholder="Device Serial"
            value={filters.deviceSerial}
            onChange={(e) => handleFilterChange("deviceSerial", e.target.value)}
          />
          <input
            type="date"
            className="border rounded-lg px-3 py-2"
            title="Start Date"
            value={filters.startDate}
            onChange={(e) => handleFilterChange("startDate", e.target.value)}
          />
          <input
            type="date"
            className="border rounded-lg px-3 py-2"
            title="End Date"
            value={filters.endDate}
            onChange={(e) => handleFilterChange("endDate", e.target.value)}
          />
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="include_unlinked"
              checked={filters.include_unlinked === "true"}
              onChange={(e) => handleFilterChange("include_unlinked", e.target.checked ? "true" : "false")}
            />
            <label htmlFor="include_unlinked" className="text-sm text-gray-700">Include Unlinked</label>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => openPreviewModal("pinelab")}
              className="px-3 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 whitespace-nowrap text-sm font-medium"
            >
              Pinelab Upload
            </button>
            <button
              type="button"
              onClick={() => openPreviewModal("yesbank")}
              className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 whitespace-nowrap text-sm font-medium"
            >
              YesBank Upload
            </button>
            <button
              type="button"
              onClick={() => openPreviewModal("paytm")}
              className="px-3 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 whitespace-nowrap text-sm font-medium"
            >
              Paytm Upload
            </button>
            <button
              type="button"
              onClick={() => openPreviewModal("telering")}
              className="px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 whitespace-nowrap text-sm font-medium"
            >
              Telering Upload
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
            >
              {isFetching ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="animate-spin" size={16} /> Applying
                </span>
              ) : (
                "Apply"
              )}
            </button>
            <button
              type="button"
              onClick={clearFilters}
              className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
            >
              Clear
            </button>
          </div>
        </form>
      </div>

      <div className="bg-white shadow-sm rounded-lg p-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-6 text-gray-600">
            <Loader2 className="animate-spin h-8 w-8" />
          </div>
        ) : isError ? (
          <p className="text-red-600">{error?.message || "Failed to load notifications"}</p>
        ) : notifications.length === 0 ? (
          <p className="text-gray-500">No records found.</p>
        ) : (
          <>
            <div className="md:hidden space-y-3">
              {notifications.map((row, index) => (
                <div key={row?.txn_id || index} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-gray-900 break-all">#{row?.rrn || row?.txn_id || row?.id || "-"}</p>
                    {canReadNotifications && (
                      <button
                        onClick={() => handleViewDetails(row)}
                        className="inline-flex items-center gap-1 text-indigo-600 text-xs font-medium border border-indigo-200 rounded-full px-2 py-1 hover:bg-indigo-50 transition"
                        title="View Details"
                      >
                        <Eye size={14} />
                        Details
                      </button>
                    )}
                  </div>
                  <div className="mt-3 space-y-1.5 text-sm text-gray-700">
                    <p className="break-all"><span className="font-medium">Source:</span> {getSourceLabel(getRowSource(row) || appliedFilters.source)}</p>
                    <p className="break-all"><span className="font-medium">Bank:</span> {getRowBank(row) || "-"}</p>
                    <p className="break-all"><span className="font-medium">Provider:</span> {getRowProvider(row) || "-"}</p>
                    <p className="break-all"><span className="font-medium">Card Classification:</span> {getRowCardClassification(row) || "-"}</p>
                    <p className="break-all"><span className="font-medium">MID:</span> {row?.mid || "-"}</p>
                    <p className="break-all"><span className="font-medium">TID:</span> {row?.tid || "-"}</p>
                    <p><span className="font-medium">Amount:</span> {row?.amount ? `${"\u20B9"}${row.amount}` : "-"}</p>
                    <p><span className="font-medium">Mode:</span> {row?.card_scheme || row?.payment_mode || "-"}</p>
                    <p><span className="font-medium">Status:</span> {row?.status || "-"}</p>
                    <div className="flex items-center gap-2"><span className="font-medium">Processing Status:</span> {renderProcessingStatusBadge(row)}</div>
                    <p className="break-all"><span className="font-medium">Processing Error:</span> {getProcessingError(row) || "-"}</p>
                    <p className="break-all"><span className="font-medium">User:</span> {row?.user?.name || "-"}</p>
                    <p><span className="font-medium">Posting Date:</span> {(row?.posting_date || row?.postingDate) ? new Date(row?.posting_date || row?.postingDate).toLocaleString() : "-"}</p>
                    <p><span className="font-medium">Created At:</span> {(row?.created_at || row?.createdAt) ? new Date(row?.created_at || row?.createdAt).toLocaleString() : "-"}</p>
                    {isWorldlineRecord(row) ? (
                      ["needs_admin", "needs-admin", "needsadmin", "needs admin", "pending"].includes(
                        String(row?.processing_status || row?.processingStatus || "").trim().toLowerCase()
                      ) && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          <button
                            onClick={() => handleWorldlineAdminProcess(row)}
                            disabled={isProcessing}
                            className="px-3 py-1 text-xs font-semibold text-white bg-indigo-600 rounded hover:bg-indigo-700 disabled:opacity-50"
                          >
                            Admin Process
                          </button>
                        </div>
                      )
                    ) : (
                      isProcessable(row) && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          <button
                            onClick={() => openProcessModal(row, "rule")}
                            className="px-3 py-1 text-xs font-semibold text-white bg-green-600 rounded hover:bg-green-700"
                          >
                            Process now (rule)
                          </button>
                          <button
                            onClick={() => openProcessModal(row, "custom")}
                            className="px-3 py-1 text-xs font-semibold text-white bg-blue-600 rounded hover:bg-blue-700"
                          >
                            Process custom
                          </button>
                        </div>
                      )
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="hidden md:block">
              <Table
                columns={columns}
                data={notifications}
                actions={
                  canReadNotifications
                    ? [
                        {
                          label: <Eye size={18} className="text-indigo-600 hover:text-indigo-800" />,
                          onClick: handleViewDetails,
                        },
                      ]
                    : null
                }
              />
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-4">
              <div className="text-sm text-gray-600 break-words">
                Page {pagination.page} of {totalPages} • Total {pagination.total} records
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50"
                >
                  Prev
                </button>
                <span className="text-sm">
                  {page} / {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => (p < totalPages ? p + 1 : p))}
                  disabled={page >= totalPages}
                  className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50"
                >
                  Next
                </button>
                <select
                  value={limit}
                  onChange={(e) => {
                    setLimit(Number(e.target.value));
                    setPage(1);
                  }}
                  className="border rounded px-2 py-1 text-sm"
                >
                  {[50, 100, 200].map((size) => (
                    <option key={size} value={size}>
                      {size} / page
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </>
        )}
      </div>
      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title="Transaction Details"
        className="max-w-3xl"
      >
        <div className="max-h-[70vh] overflow-y-auto">
          {selectedRow ? (
            <div className="space-y-3">
              {Object.entries(selectedRow).map(([key, value]) => {
                return (
                  <div key={key} className="border-b border-gray-200 pb-3 last:border-b-0">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                      <div className="md:col-span-1">
                        <span className="text-sm font-semibold text-gray-700 capitalize">
                          {key.replace(/_/g, " ")}:
                        </span>
                      </div>
                      <div className="md:col-span-2">
                        <span className="text-sm text-gray-900 break-words">
                          {renderValue(value)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-gray-500">No data available.</p>
          )}
        </div>
      </Modal>
      <Modal
        isOpen={isProcessModalOpen}
        onClose={closeProcessModal}
        title={
          processMode === "rule"
            ? "Process Notification (Rule)"
            : "Process Notification (Custom Charge)"
        }
        className="max-w-lg"
      >
        <div className="space-y-4">
          <p>
            Processing notification <span className="font-semibold">{processingRow?.txn_id || processingRow?.id || processingRow?._id || "(unknown)"}</span>
            {processingRow?.processing_status ? `, current status: ${processingRow.processing_status}` : ""}.
          </p>

          {processMode === "custom" && (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700">Charge Percent</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={customCharge.charge_percent}
                  onChange={(e) => setCustomCharge((prev) => ({ ...prev, charge_percent: e.target.value }))}
                  className="mt-1 w-full border border-gray-300 rounded px-2 py-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="e.g. 1.2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Charge Flat</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={customCharge.charge_flat}
                  onChange={(e) => setCustomCharge((prev) => ({ ...prev, charge_flat: e.target.value }))}
                  className="mt-1 w-full border border-gray-300 rounded px-2 py-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="e.g. 10.00"
                />
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <button
              onClick={closeProcessModal}
              className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
              disabled={isProcessing}
            >
              Cancel
            </button>
            <button
              onClick={handleProcessSubmit}
              className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
              disabled={isProcessing}
            >
              {isProcessing ? "Processing..." : "Confirm"}
            </button>
          </div>
        </div>
      </Modal>
      <Modal
        isOpen={isPreviewUploadModalOpen}
        onClose={closePreviewModal}
        title={`Preview ${getProviderLabel(uploadProvider)} Data`}
        className="max-w-2xl"
      >
        <div className="space-y-5">
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
            <p className="text-sm font-semibold text-emerald-900">Preview only</p>
            <p className="mt-1 text-sm text-emerald-800">
              Upload your {getProviderLabel(uploadProvider)} Excel or CSV file. The system will calculate MID/TID matching and charge preview only. Nothing will be saved to the database.
            </p>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Upload Excel or CSV File
            </label>
            <input
              type="file"
              accept=".csv,.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
              onChange={handlePreviewFileChange}
              className="block w-full rounded-lg border border-gray-300 text-sm text-gray-700 file:mr-4 file:rounded-lg file:border-0 file:bg-emerald-600 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-emerald-700"
            />
            {previewFile && (
              <p className="mt-2 text-xs text-gray-500">
                Selected file: <span className="font-medium text-gray-700">{previewFile.name}</span>
              </p>
            )}
          </div>

          <div className="flex justify-end gap-2 border-t border-gray-200 pt-3">
            <button
              onClick={closePreviewModal}
              className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100 transition-colors"
              disabled={isPreviewing}
            >
              Cancel
            </button>
            <button
              onClick={handlePreviewSubmit}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-700 disabled:opacity-50"
              disabled={!previewFile || isPreviewing}
            >
              {isPreviewing ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Previewing...
                </>
              ) : (
                <>
                  <Upload size={16} />
                  Preview
                </>
              )}
            </button>
          </div>
        </div>
      </Modal>
      <Modal
        isOpen={isPreviewResultsModalOpen}
        onClose={closePreviewResultsModal}
        title={`${getProviderLabel(uploadProvider)} Preview Results`}
        className="max-w-7xl"
      >
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-900">Preview complete</p>
            <p className="mt-1 text-sm text-slate-700">
              Rows: <span className="font-semibold">{previewResult?.count ?? previewResult?.data?.length ?? 0}</span>
              {" "} | Total amount: <span className="font-semibold">
                {previewResult?.summary?.total_amount !== undefined && previewResult?.summary?.total_amount !== null
                  ? Number(previewResult.summary.total_amount).toFixed(2)
                  : "0.00"}
              </span>
              {" "} | Total charge: <span className="font-semibold">
                {previewResult?.summary?.total_charge !== undefined && previewResult?.summary?.total_charge !== null
                  ? Number(previewResult.summary.total_charge).toFixed(2)
                  : "0.00"}
              </span>
            </p>
            <p className="mt-1 text-xs text-slate-500">
              This view is read-only. No wallet, ledger, or database updates were made.
            </p>
          </div>

          <div className="max-h-[65vh] overflow-auto rounded-xl border border-gray-200">
            {Array.isArray(previewResult?.data) && previewResult.data.length > 0 ? (
              <Table
                columns={PREVIEW_TABLE_COLUMNS}
                data={previewResult.data}
                actions={[
                  {
                    label: "Debug",
                    onClick: handlePreviewDebugClick,
                  },
                ]}
                actionsHeader="Debug"
                containerClassName="overflow-x-auto bg-white"
                headerClassName="sticky top-0 z-10"
                tableClassName="min-w-[960px] w-full divide-y divide-gray-200"
                headerCellClassName="px-4 py-3 text-left text-[11px] font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap"
                bodyCellClassName="px-4 py-3 whitespace-nowrap text-sm text-gray-900"
              />
            ) : (
              <div className="bg-white p-6 text-center text-sm text-gray-500">
                No preview rows found.
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 border-t border-gray-200 pt-3">
            <button
              onClick={closePreviewResultsModal}
              className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100 transition-colors"
              disabled={isUploadingNotifications}
            >
              Close
            </button>
            <button
              onClick={handlePinelabUploadSubmit}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-700 disabled:opacity-50 font-medium"
              disabled={!previewFile || isUploadingNotifications}
            >
              {isUploadingNotifications ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Processing to Wallet...
                </>
              ) : (
                <>
                  <Upload size={16} />
                  Save / Process {getProviderLabel(uploadProvider)} Data
                </>
              )}
            </button>
          </div>
        </div>
      </Modal>
      <Modal
        isOpen={isPreviewDebugModalOpen}
        onClose={closePreviewDebugModal}
        title="Pinelab Debug Details"
        className="max-w-4xl"
      >
        <div className="space-y-5">
          <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4">
            <p className="text-sm font-semibold text-amber-900">
              Why charge is zero
            </p>
            <p className="mt-1 text-sm text-amber-800">
              {previewDebugRow?.debug?.summary || previewDebugRow?.note || "No debug summary available."}
            </p>
          </div>

          {Array.isArray(previewDebugRow?.debug?.reasons) && previewDebugRow.debug.reasons.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-semibold text-gray-900">Reasons</h3>
              <ul className="list-disc space-y-1 pl-5 text-sm text-gray-700">
                {previewDebugRow.debug.reasons.map((reason, index) => (
                  <li key={index}>{reason}</li>
                ))}
              </ul>
            </div>
          )}

          {Array.isArray(previewDebugRow?.debug?.checks) && previewDebugRow.debug.checks.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-semibold text-gray-900">Match checks</h3>
              <div className="grid gap-3 md:grid-cols-2">
                {previewDebugRow.debug.checks.map((check, index) => (
                  <div key={index} className="rounded-xl border border-gray-200 bg-white p-3">
                    <p className="text-sm font-semibold text-gray-900">{check.step}</p>
                    <p className={`mt-1 text-sm ${check.ok ? "text-emerald-700" : "text-red-600"}`}>
                      {check.ok ? "Matched" : "Not matched"}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">{check.detail}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <h3 className="text-sm font-semibold text-gray-900">Inputs</h3>
              <div className="mt-3 space-y-2 text-sm text-gray-700">
                <p><span className="font-medium">MID:</span> {previewDebugRow?.debug?.inputs?.normalized?.mid || "-"}</p>
                <p><span className="font-medium">TID:</span> {previewDebugRow?.debug?.inputs?.normalized?.tid || "-"}</p>
                <p><span className="font-medium">Txn ID:</span> {previewDebugRow?.debug?.inputs?.normalized?.txn_id || "-"}</p>
                <p><span className="font-medium">Amount:</span> {previewDebugRow?.debug?.inputs?.normalized?.amount !== undefined && previewDebugRow?.debug?.inputs?.normalized?.amount !== null ? Number(previewDebugRow.debug.inputs.normalized.amount).toFixed(2) : "-"}</p>
                <p><span className="font-medium">Card Type:</span> {previewDebugRow?.debug?.inputs?.normalized?.card_type || "-"}</p>
                <p><span className="font-medium">Card Brand:</span> {previewDebugRow?.debug?.inputs?.normalized?.card_brand || "-"}</p>
                <p><span className="font-medium">Card Sub-Type:</span> {previewDebugRow?.debug?.inputs?.normalized?.card_sub_type || "-"}</p>
                <p><span className="font-medium">Brand candidates:</span> {(previewDebugRow?.debug?.inputs?.normalized?.card_brand_candidates || []).length > 0 ? previewDebugRow.debug.inputs.normalized.card_brand_candidates.join(", ") : "-"}</p>
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <h3 className="text-sm font-semibold text-gray-900">Match Status</h3>
              <div className="mt-3 space-y-2 text-sm text-gray-700">
                <p><span className="font-medium">Status:</span> {previewDebugRow?.debug?.match?.match_status || previewDebugRow?.match_status || "-"}</p>
                <p><span className="font-medium">Note:</span> {previewDebugRow?.debug?.match?.note || previewDebugRow?.note || "-"}</p>
                <p><span className="font-medium">POS Machine:</span> {previewDebugRow?.debug?.match?.pos_machine_id || "-"}</p>
                <p><span className="font-medium">User:</span> {previewDebugRow?.debug?.match?.user_name || "-"}</p>
                <p><span className="font-medium">User ID:</span> {previewDebugRow?.debug?.match?.user_id || "-"}</p>
              </div>
            </div>
          </div>

          {previewDebugRow?.debug?.rule ? (
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <h3 className="text-sm font-semibold text-gray-900">Matched Rule</h3>
              <div className="mt-3 grid gap-2 text-sm text-gray-700 md:grid-cols-2">
                <p><span className="font-medium">Scope:</span> {previewDebugRow.debug.rule.scope || "-"}</p>
                <p><span className="font-medium">Rule ID:</span> {previewDebugRow.debug.rule.id || "-"}</p>
                <p><span className="font-medium">Payment mode:</span> {previewDebugRow.debug.rule.payment_mode || "-"}</p>
                <p><span className="font-medium">Settlement:</span> {previewDebugRow.debug.rule.settlement_type || "-"}</p>
                <p><span className="font-medium">Card type:</span> {previewDebugRow.debug.rule.card_type || "-"}</p>
                <p><span className="font-medium">Card brand:</span> {previewDebugRow.debug.rule.card_brand || "-"}</p>
                <p><span className="font-medium">Card classification:</span> {previewDebugRow.debug.rule.card_classification || "-"}</p>
                <p><span className="font-medium">Amount slab:</span> {(previewDebugRow.debug.rule.min_amount ?? "-")} - {(previewDebugRow.debug.rule.max_amount ?? "-")}</p>
                <p><span className="font-medium">Charge %:</span> {previewDebugRow.debug.rule.charge_percent ?? "-"}</p>
                <p><span className="font-medium">Charge flat:</span> {previewDebugRow.debug.rule.charge_flat ?? "-"}</p>
              </div>
            </div>
          ) : null}

          <div className="rounded-xl border border-gray-200 bg-slate-50 p-4">
            <h3 className="text-sm font-semibold text-gray-900">Charge Result</h3>
            <div className="mt-3 grid gap-2 text-sm text-gray-700 md:grid-cols-2">
              <p><span className="font-medium">Charge:</span> {previewDebugRow?.debug?.charge?.charge !== undefined && previewDebugRow?.debug?.charge?.charge !== null ? Number(previewDebugRow.debug.charge.charge).toFixed(2) : "0.00"}</p>
              <p><span className="font-medium">Left amount:</span> {previewDebugRow?.debug?.charge?.left_amount !== undefined && previewDebugRow?.debug?.charge?.left_amount !== null ? Number(previewDebugRow.debug.charge.left_amount).toFixed(2) : "0.00"}</p>
              <p><span className="font-medium">Charge percentage:</span> {previewDebugRow?.debug?.charge?.charge_percentage !== undefined && previewDebugRow?.debug?.charge?.charge_percentage !== null ? Number(previewDebugRow.debug.charge.charge_percentage).toFixed(2) : "-"}</p>
            </div>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={isSequentialProgressModalOpen}
        onClose={() => {
          if (sequentialProgress.isFinished) {
            setIsSequentialProgressModalOpen(false);
            closePreviewResultsModal();
            refetch();
            queryClient.invalidateQueries(["razorpay_notifications"]);
          }
        }}
        title={`Processing ${getProviderLabel(uploadProvider)} Data (1 by 1)`}
        className="max-w-2xl"
      >
        <div className="space-y-5">
          <div className="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-4">
            <div className="flex items-center justify-between text-sm font-semibold text-indigo-950">
              <span>
                {sequentialProgress.isFinished ? "Processing Complete!" : "Processing Rows (1 by 1)..."}
              </span>
              <span>
                {sequentialProgress.current} / {sequentialProgress.total} ({sequentialProgress.total > 0 ? Math.round((sequentialProgress.current / sequentialProgress.total) * 100) : 0}%)
              </span>
            </div>

            <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-indigo-200">
              <div
                className="h-full bg-indigo-600 transition-all duration-300 ease-out"
                style={{ width: `${sequentialProgress.total > 0 ? (sequentialProgress.current / sequentialProgress.total) * 100 : 0}%` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-center">
              <p className="text-2xl font-bold text-emerald-700">{sequentialProgress.insertedCount}</p>
              <p className="text-xs font-medium text-emerald-800">Processed</p>
            </div>

            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-center">
              <p className="text-2xl font-bold text-amber-700">{sequentialProgress.duplicateCount}</p>
              <p className="text-xs font-medium text-amber-800">Duplicate / Skipped</p>
            </div>

            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-center">
              <p className="text-2xl font-bold text-red-700">{sequentialProgress.failedCount}</p>
              <p className="text-xs font-medium text-red-800">Failed / Errors</p>
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold text-gray-700 uppercase tracking-wider">Live Activity Log</p>
            <div className="max-h-48 overflow-y-auto rounded-xl border border-gray-200 bg-gray-900 p-3 text-xs font-mono text-gray-200 space-y-1.5 shadow-inner">
              {sequentialProgress.logs.length === 0 ? (
                <p className="text-gray-500 italic">Initializing row processing...</p>
              ) : (
                sequentialProgress.logs.map((log, idx) => (
                  <div key={idx} className={log.includes("✅") ? "text-emerald-400" : log.includes("🟡") ? "text-amber-400" : "text-red-400"}>
                    {log}
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="flex justify-end border-t border-gray-200 pt-3">
            <button
              onClick={() => {
                setIsSequentialProgressModalOpen(false);
                closePreviewResultsModal();
                refetch();
                queryClient.invalidateQueries(["razorpay_notifications"]);
              }}
              disabled={!sequentialProgress.isFinished}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-40"
            >
              {!sequentialProgress.isFinished ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Processing 1 by 1...
                </>
              ) : (
                "Done / Close"
              )}
            </button>
          </div>
        </div>
      </Modal>

      <ToastContainer position="top-right" autoClose={3000} hideProgressBar theme="light" />
    </div>
  );
};

export default RazorpayNotification;
