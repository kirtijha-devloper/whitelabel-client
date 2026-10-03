import React, { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "react-router-dom";
import Select from "react-select";
import { getLedgerStatements } from "../api/ledgerApi";
import Modal from "../components/Modal";
import { Loader2, Download } from "lucide-react";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { toast } from "react-toastify";
import { isMdrCutTransaction } from "../utils/ledgerDisplay";
import UserSelectWithSuggestions from "../components/Reports/UserSelectWithSuggestions";
import {
  getRowBank,
  getRowCardClassification,
  getRowProvider,
  getRowReference,
  getRowSource,
  getSourceLabel,
} from "../utils/agroScope";

const ADMIN_TRANSACTION_COMBO_VALUE = "__admin_debit_admin_credit__";

const DescriptionCell = ({ value }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const text = String(value || "-");
  const maxLength = 110;
  const isTruncated = text.length > maxLength;

  const displayContent = (!isTruncated || isExpanded) ? text : `${text.slice(0, maxLength)}...`;

  return (
    <div
      className={`max-w-[30rem] whitespace-pre-wrap break-words leading-6 text-sm text-gray-800 ${isTruncated ? "cursor-pointer" : ""}`}
      title={isTruncated ? (isExpanded ? "Click to collapse" : "Click to expand") : text}
      onClick={() => {
        if (isTruncated) {
          setIsExpanded(!isExpanded);
          console.log("Full Description:", text);
        }
      }}
    >
      {displayContent}
    </div>
  );
};

const getTransactionTypeBadgeClasses = (transactionType) => {
  const type = String(transactionType || "").trim().toLowerCase();
  switch (type) {
    case "pos_charge":
    case "razorpay_charge":
      return "bg-red-100 text-red-700 border-red-200";
    case "pos_credit":
      return "bg-emerald-100 text-emerald-700 border-emerald-200";
    case "pos_franchise_earning":
    case "razorpay_franchise_earning":
      return "bg-teal-100 text-teal-700 border-teal-200";
    case "razorpay_settlement":
      return "bg-green-100 text-green-700 border-green-200";
    case "wallet_topup":
      return "bg-blue-100 text-blue-700 border-blue-200";
    case "refund":
      return "bg-purple-100 text-purple-700 border-purple-200";
    case "fee":
      return "bg-yellow-100 text-yellow-700 border-yellow-200";
    default:
      return "bg-slate-100 text-slate-800 border-slate-200";
  }
};

const renderTransactionTypeBadge = (transactionType) => {
  const classes = getTransactionTypeBadgeClasses(transactionType);
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-1 text-xs font-semibold ${classes}`}
    >
      {transactionType || "N/A"}
    </span>
  );
};

const ledgerSelectStyles = {
  menu: (base) => ({
    ...base,
    zIndex: 20,
  }),
  menuPortal: (base) => ({
    ...base,
    zIndex: 40,
  }),
};

const StickyLedgerTable = ({ columns, data }) => {
  const headerScrollRef = useRef(null);
  const bodyScrollRef = useRef(null);
  const isSyncingScrollRef = useRef(false);
  const tableWidth = useMemo(
    () =>
      columns.reduce((total, column) => {
        const width = Number.parseFloat(column.width || 0);
        return total + (Number.isFinite(width) ? width : 0);
      }, 0),
    [columns]
  );

  useEffect(() => {
    const headerScrollEl = headerScrollRef.current;
    const bodyScrollEl = bodyScrollRef.current;

    if (!headerScrollEl || !bodyScrollEl) return undefined;

    const syncScrollLeft = (sourceEl, targetEl) => {
      if (isSyncingScrollRef.current) return;

      isSyncingScrollRef.current = true;
      targetEl.scrollLeft = sourceEl.scrollLeft;
      window.requestAnimationFrame(() => {
        isSyncingScrollRef.current = false;
      });
    };

    const handleHeaderScroll = () => syncScrollLeft(headerScrollEl, bodyScrollEl);
    const handleBodyScroll = () => syncScrollLeft(bodyScrollEl, headerScrollEl);

    headerScrollEl.addEventListener("scroll", handleHeaderScroll, { passive: true });
    bodyScrollEl.addEventListener("scroll", handleBodyScroll, { passive: true });

    return () => {
      headerScrollEl.removeEventListener("scroll", handleHeaderScroll);
      bodyScrollEl.removeEventListener("scroll", handleBodyScroll);
    };
  }, []);

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-md">
      <div className="sticky top-[-1rem] z-30 rounded-t-xl border-b border-gray-200 bg-gray-100">
        <div ref={headerScrollRef} className="ledger-horizontal-scrollbar max-w-full overflow-x-auto">
          <table
            className="table-fixed border-collapse"
            style={tableWidth ? { width: `${tableWidth}px` } : undefined}
          >
            <colgroup>
              {columns.map((column) => (
                <col key={column.key} style={column.width ? { width: column.width } : undefined} />
              ))}
            </colgroup>
            <thead>
              <tr>
                {columns.map((column) => (
                  <th
                    key={column.key}
                    className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider whitespace-nowrap text-gray-700 ${
                      column.headerClassName || ""
                    }`.trim()}
                  >
                    {column.header}
                  </th>
                ))}
              </tr>
            </thead>
          </table>
        </div>
      </div>

      <div
        ref={bodyScrollRef}
        className="ledger-horizontal-scrollbar max-w-full overflow-x-auto rounded-b-xl bg-white"
      >
        <table
          className="table-fixed border-collapse"
          style={tableWidth ? { width: `${tableWidth}px` } : undefined}
        >
          <colgroup>
            {columns.map((column) => (
              <col key={column.key} style={column.width ? { width: column.width } : undefined} />
            ))}
          </colgroup>
          <tbody className="divide-y divide-gray-200">
            {data.map((row, rowIndex) => (
              <tr key={row.id ?? rowIndex} className="hover:bg-gray-50">
                {columns.map((column, colIndex) => (
                  <td
                    key={column.key || colIndex}
                    className={`px-6 py-4 align-top text-sm text-gray-900 ${
                      column.cellClassName || ""
                    }`.trim()}
                  >
                    {column.render
                      ? column.render(row[column.key], row, rowIndex)
                      : row[column.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const buildLedgerExportRows = (rows = []) =>
  rows.map((tx, idx) => {
    const desc = tx.description || "";
    
    let txnId = "";
    const txnMatch = desc.match(/(?:Txn|Razorpay Transaction)\s*:\s*([^|\n]+)/i);
    if (txnMatch && txnMatch[1]) {
      txnId = txnMatch[1].trim();
    }
    
    let rrn = "";
    // Use dedicated rr_number field from API if available (covers pos_credit, pos_charge etc.)
    if (tx.rr_number) {
      rrn = String(tx.rr_number).trim();
    } else {
      // Fallback: parse from description text (for pos_franchise_earning entries)
      const rrnMatch = desc.match(/RRN\s*:\s*([^|\n]+)/i);
      if (rrnMatch && rrnMatch[1]) {
        rrn = rrnMatch[1].trim();
      }
    }


    return {
      "#": idx + 1,
      "Date & Time": tx.date_and_time ? new Date(tx.date_and_time).toLocaleString("en-IN") : "-",
      "User Name": tx.user?.name || "-",
      "Mobile Number": tx.user?.mobile_number || "-",
      "User Role": tx.user_role || tx.user?.role || "-",
      Type: tx.transaction_type || "-",
      Description: desc || "-",
      Source: getSourceLabel(getRowSource(tx)),
      Bank: getRowBank(tx) || "-",
      Provider: getRowProvider(tx) || "-",
      "Card Classification": getRowCardClassification(tx) || "-",
      Reference: getRowReference(tx) || "-",
      "Txn ID": txnId || tx.txn_id || "-",
      "RRN": rrn,
      "Opening (INR)": parseFloat(tx.opening_balance || 0).toFixed(2),
      "Credit (INR)": parseFloat(tx.credit || 0).toFixed(2),
      "Debit (INR)": parseFloat(tx.debit || 0).toFixed(2),
      "Balance (INR)": parseFloat(tx.balance || 0).toFixed(2),
    };
  });

const exportLedgerRowsToExcel = (rows, scopeLabel, today) => {
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(buildLedgerExportRows(rows));
  XLSX.utils.book_append_sheet(workbook, worksheet, "Ledger_Report");
  const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  const safeScope = String(scopeLabel || "filtered").replace(/\s+/g, "_");

  saveAs(
    new Blob([excelBuffer], { type: "application/octet-stream" }),
    `Ledger_Report_${safeScope}_${today}.xlsx`
  );
};

const formatLedgerDate = (dateTime) => {
  if (!dateTime) return "-";
  const date = new Date(dateTime);
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = date.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
};

const resolveTransactionTypeFilterValues = (values = []) =>
  Array.from(
    new Set(
      values.flatMap((value) =>
        value === ADMIN_TRANSACTION_COMBO_VALUE
          ? ["admin_debit", "admin_credit"]
          : [value]
      )
    )
  );

const normalizeTransactionTypeSelection = (values = []) => {
  const uniqueValues = Array.from(new Set(values.filter(Boolean)));
  const hasCombo = uniqueValues.includes(ADMIN_TRANSACTION_COMBO_VALUE);

  if (hasCombo) {
    return uniqueValues.filter(
      (value) => value !== "admin_debit" && value !== "admin_credit"
    );
  }

  if (uniqueValues.includes("admin_debit") && uniqueValues.includes("admin_credit")) {
    return [
      ...uniqueValues.filter(
        (value) => value !== "admin_debit" && value !== "admin_credit"
      ),
      ADMIN_TRANSACTION_COMBO_VALUE,
    ];
  }

  return uniqueValues;
};

const buildLedgerBaseFilters = (today) => ({
  searched_role: null,
  from_date: today,
  to_date: today,
  transaction_type: [],
  source: "",
  bank: "",
  provider: "",
  cardClassification: "",
  user_id: "",
  userId: "",
  userSearch: "",
});

const Ledger = ({ currentUser }) => {
  const location = useLocation();
  const today = new Date().toISOString().split("T")[0];
  const [filters, setFilters] = useState(() => buildLedgerBaseFilters(today));
  const [selectedUser, setSelectedUser] = useState(null);
  const [ledgerPage, setLedgerPage] = useState(1);
  const ledgerPageSize = 200;
  const [exportScope, setExportScope] = useState("filtered");
  const [isExporting, setIsExporting] = useState(false);
  const [metadataModalOpen, setMetadataModalOpen] = useState(false);
  const [selectedMetadata, setSelectedMetadata] = useState(null);
  const [selectedMetadataTransactionId, setSelectedMetadataTransactionId] = useState(null);
  const resolvedTransactionTypeFilters = resolveTransactionTypeFilterValues(filters.transaction_type);

  const userRole = String(currentUser?.role || "").trim().toLowerCase();
  const canSelectUser =
    location.pathname.startsWith("/admin") ||
    location.pathname.startsWith("/employee") ||
    ["admin", "employee"].includes(userRole);

  const handleUserSelect = (user) => {
    setSelectedUser(user);
    setLedgerPage(1);
    const searchVal = user ? (user.name || user.abheepay_id || user.mobile_number || user.id) : "";
    setFilters((prev) => ({
      ...prev,
      userSearch: searchVal,
      user_id: user ? user.id : "",
      userId: user ? user.id : "",
    }));
  };

  const { data: ledgerData, isLoading, refetch: refetchLedger } = useQuery({
    queryKey: ["ledgerStatements", filters],
    queryFn: () =>
      getLedgerStatements({
        ...filters,
        transaction_type: resolvedTransactionTypeFilters,
        __debug: true,
      }),
    refetchInterval: 3000,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    const handleSync = () => {
      refetchLedger();
    };
    window.addEventListener("userSettlementUpdated", handleSync);
    window.addEventListener("userDailyLimitUpdated", handleSync);
    window.addEventListener("storage", handleSync);

    return () => {
      window.removeEventListener("userSettlementUpdated", handleSync);
      window.removeEventListener("userDailyLimitUpdated", handleSync);
      window.removeEventListener("storage", handleSync);
    };
  }, [refetchLedger]);

  const transactions = ledgerData?.transactions || [];
  const selectedRole = String(filters.searched_role || "").trim().toLowerCase();
  const visibleTransactions = transactions.filter((tx) => {
    const txRole = String(tx.user_role || "").trim().toLowerCase();
    const roleMatches = !selectedRole || txRole === selectedRole;
    if (!roleMatches) return false;
    if (selectedUser?.id) {
      const txUserId = String(tx.user?.id || tx.merchant_id || tx.user_id || "");
      if (txUserId && txUserId !== String(selectedUser.id)) {
        return false;
      }
    }
    return true;
  });
  const totalLedgerRows = visibleTransactions.length;
  const totalLedgerPages = Math.max(1, Math.ceil(totalLedgerRows / ledgerPageSize));
  const ledgerPageSafe = Math.min(Math.max(ledgerPage, 1), totalLedgerPages);
  const pagedVisibleTransactions = useMemo(() => {
    const startIndex = (ledgerPageSafe - 1) * ledgerPageSize;
    return visibleTransactions.slice(startIndex, startIndex + ledgerPageSize);
  }, [ledgerPageSafe, ledgerPageSize, visibleTransactions]);

  const roleOptions = [
    { value: "merchant", label: "Merchant" },
    { value: "franchise", label: "Franchise" },
  ];

  const transactionTypeOptions = [
    { value: "pos_credit", label: "pos_credit" },
    { value: "pos_charge", label: "pos_charge" },
    { value: "razorpay_commission", label: "razorpay_commission" },
    { value: "payout", label: "payout" },
    { value: "direct_transfer", label: "direct_transfer" },
    { value: "bbps_payment", label: "bbps_payment" },
    { value: "wallet_credit", label: "wallet_credit" },
    { value: "wallet_debit", label: "wallet_debit" },
    { value: "admin_debit", label: "admin_debit" },
    { value: "admin_credit", label: "admin_credit" },
    { value: ADMIN_TRANSACTION_COMBO_VALUE, label: "admin_debit & admin_credit" },
    { value: "rental_charge", label: "rental_charge" },
  ];

  const filteredRoleOptions =
    userRole === "merchant"
      ? roleOptions.filter((option) => option.value === "merchant")
      : roleOptions;

  useEffect(() => {
    setLedgerPage(1);
  }, [filters]);

  const handleExportToExcel = async () => {
    try {
      setIsExporting(true);

      let rowsToExport = visibleTransactions;
      let scopeLabel = "filtered_data";

      if (exportScope === "all") {
        const fullLedgerData = await getLedgerStatements({});
        rowsToExport = fullLedgerData?.transactions || [];
        scopeLabel = "all_data";
      } else {
        const filteredLedgerData = await getLedgerStatements({
          ...filters,
          transaction_type: resolvedTransactionTypeFilters,
        });
        const fetchedRows = filteredLedgerData?.transactions || [];
        rowsToExport = !selectedRole
          ? fetchedRows
          : fetchedRows.filter((tx) => {
              const txRole = String(tx.user_role || "").trim().toLowerCase();
              return txRole === selectedRole;
            });
      }

      if (!rowsToExport.length) {
        toast.warn(
          exportScope === "all"
            ? "No ledger data available to export."
            : "No filtered ledger data to export."
        );
        return;
      }

      exportLedgerRowsToExcel(rowsToExport, scopeLabel, today);
      toast.success(
        exportScope === "all"
          ? "All ledger data exported to Excel."
          : "Filtered ledger data exported to Excel."
      );
    } catch (error) {
      console.error("Failed to export ledger data:", error);
      toast.error("Failed to export ledger data.");
    } finally {
      setIsExporting(false);
    }
  };

  const columns = [
    { header: "#", key: "id", width: "72px", headerClassName: "text-center", cellClassName: "text-center font-medium" },
    {
      header: "Date & Time",
      key: "date_and_time",
      width: "150px",
      render: (dateTime) => (
        <>
          <div>{formatLedgerDate(dateTime)}</div>
          <div className="text-xs text-gray-500">
            {dateTime ? new Date(dateTime).toLocaleTimeString() : ""}
          </div>
        </>
      ),
      cellClassName: "whitespace-normal text-gray-700",
    },
    {
      header: "User Details",
      key: "user",
      width: "240px",
      render: (user) => (
        <>
          <div className="font-medium text-gray-900">{user?.name || "-"}</div>
          <div className="text-xs text-gray-500">{user?.mobile_number || user?.id || ""}</div>
        </>
      ),
      cellClassName: "whitespace-normal",
    },
    {
      header: "Reference",
      key: "reference_id",
      width: "220px",
      render: (_value, row) => getRowReference(row) || "-",
      cellClassName: "whitespace-nowrap",
    },
    {
      header: "Type",
      key: "transaction_type",
      width: "180px",
      render: (type) => renderTransactionTypeBadge(type),
      cellClassName: "whitespace-normal",
    },
    {
      header: "Description",
      key: "description",
      width: "520px",
      render: (desc) => <DescriptionCell value={desc} />,
      cellClassName: "whitespace-normal break-words",
    },
    {
      header: "Opening (9)",
      key: "opening_balance",
      width: "140px",
      headerClassName: "text-right",
      render: (value) =>
        parseFloat(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 }),
      cellClassName: "whitespace-nowrap text-right tabular-nums",
    },
    {
      header: "Credit (9)",
      key: "credit",
      width: "140px",
      headerClassName: "text-right",
      render: (value) =>
        value > 0 ? (
          <span className="font-medium text-green-600">
            {parseFloat(value).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </span>
        ) : (
          ""
        ),
      cellClassName: "whitespace-nowrap text-right tabular-nums",
    },
    {
      header: "Debit (9)",
      key: "debit",
      width: "140px",
      headerClassName: "text-right",
      render: (value, row) =>
        value > 0 ? (
          <span
            className={`font-medium ${isMdrCutTransaction(row) ? "text-[#FF00FF]" : "text-red-600"}`}
          >
            {parseFloat(value).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </span>
        ) : (
          ""
        ),
      cellClassName: "whitespace-nowrap text-right tabular-nums",
    },
    {
      header: "Balance (9)",
      key: "balance",
      width: "140px",
      headerClassName: "text-right",
      render: (value) =>
        parseFloat(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 }),
      cellClassName: "whitespace-nowrap text-right tabular-nums font-medium",
    },
    {
      header: "More",
      key: "metadata",
      width: "120px",
      render: (_value, row) => (
        <button
          type="button"
          onClick={() => {
            setSelectedMetadata(row.metadata || {});
            setSelectedMetadataTransactionId(row.id);
            setMetadataModalOpen(true);
          }}
          className="rounded-lg border border-gray-300 bg-white px-3 py-1 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
        >
          More
        </button>
      ),
      cellClassName: "whitespace-nowrap text-left",
    },
  ];

  return (
    <div className="min-h-screen bg-gray-100">
      <div>
        <div className="mb-4 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <h1 className="text-3xl font-semibold text-gray-900">Ledger Statements</h1>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="min-w-[12rem]">
              <label className="mb-2 block text-sm font-medium text-gray-700">Export Scope</label>
              <select
                value={exportScope}
                onChange={(event) => setExportScope(event.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="filtered">Filtered Data</option>
                <option value="all">All Data</option>
              </select>
            </div>
            <button
              type="button"
              onClick={handleExportToExcel}
              disabled={isExporting}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#00D3CD] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#00b8b3] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isExporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
              {isExporting ? "Exporting..." : "Export Excel"}
            </button>
          </div>
        </div>

        {!isLoading && currentUser && (() => {
          const walletNum = parseFloat(currentUser?.wallet ?? 0);
          const availableNum =
            currentUser?.available_balance !== undefined
              ? parseFloat(currentUser.available_balance)
              : walletNum;
          const holdNum = Math.max(0, walletNum - availableNum);

          return (
            <div className="mb-4 rounded-xl bg-white p-4 shadow-sm">
              <div className="flex flex-wrap gap-6">
                <div className="flex flex-col">
                  <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
                    Total Balance
                  </span>
                  <span className="text-lg font-semibold text-gray-900">
                    {"\u20B9"}
                    {walletNum.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </span>
                </div>
                {holdNum > 0 && (
                  <div
                    className="flex flex-col"
                    title="POS earnings from today. Available tomorrow at 10:30 AM."
                  >
                    <span className="text-xs font-medium uppercase tracking-wide text-amber-600">
                      On Settlement Hold
                    </span>
                    <span className="text-lg font-semibold text-amber-600">
                      {`- \u20B9${holdNum.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`}
                    </span>
                    <span className="text-[11px] text-amber-500">Releases tomorrow 10:30 AM</span>
                  </div>
                )}
                <div className="flex flex-col">
                  <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
                    Available Balance
                  </span>
                  <span className="text-lg font-semibold text-green-700">
                    {"\u20B9"}
                    {availableNum.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>
          );
        })()}

        <div className="mb-4 rounded-xl bg-white p-4 shadow-sm">
          <div className={`grid grid-cols-2 gap-6 ${canSelectUser ? "md:grid-cols-5" : "md:grid-cols-4"}`}>
            {canSelectUser && (
              <div className="min-w-0 col-span-2 md:col-span-1">
                <UserSelectWithSuggestions
                  selectedUser={selectedUser}
                  onSelectUser={handleUserSelect}
                  label="Select User"
                />
              </div>
            )}
            <div className="min-w-0">
              <label className="mb-2 block text-sm font-medium text-gray-700">Search by Role</label>
              <Select
                options={filteredRoleOptions}
                value={filteredRoleOptions.find((option) => option.value === filters.searched_role)}
                onChange={(selected) =>
                  setFilters((prev) => ({ ...prev, searched_role: selected?.value || null }))
                }
                placeholder="Select role..."
                isClearable
                className="basic-single"
                classNamePrefix="select"
                isDisabled={userRole === "merchant"}
                styles={ledgerSelectStyles}
                menuPortalTarget={typeof window !== "undefined" ? window.document.body : null}
                menuPosition="fixed"
              />
            </div>
            <div className="min-w-0">
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Transaction Type
              </label>
              <Select
                options={transactionTypeOptions}
                value={transactionTypeOptions.filter((option) =>
                  filters.transaction_type.includes(option.value)
                )}
                onChange={(selected) =>
                  setFilters((prev) => ({
                    ...prev,
                    transaction_type: normalizeTransactionTypeSelection(
                      Array.isArray(selected) ? selected.map((item) => item.value) : []
                    ),
                  }))
                }
                placeholder="Select types..."
                isClearable
                isMulti
                className="basic-multi-select"
                classNamePrefix="select"
                styles={ledgerSelectStyles}
                menuPortalTarget={typeof window !== "undefined" ? window.document.body : null}
                menuPosition="fixed"
              />
            </div>
            <div className="min-w-0">
              <label className="mb-2 block text-sm font-medium text-gray-700">Start Date</label>
              <input
                type="date"
                value={filters.from_date}
                onChange={(event) =>
                  setFilters((prev) => ({ ...prev, from_date: event.target.value }))
                }
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div className="min-w-0">
              <label className="mb-2 block text-sm font-medium text-gray-700">End Date</label>
              <input
                type="date"
                value={filters.to_date}
                onChange={(event) =>
                  setFilters((prev) => ({ ...prev, to_date: event.target.value }))
                }
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </div>
          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-4">
            <div className="min-w-0">
              <label className="mb-2 block text-sm font-medium text-gray-700">Source</label>
              <input
                type="text"
                value={filters.source}
                onChange={(event) =>
                  setFilters((prev) => ({ ...prev, source: event.target.value }))
                }
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="agro_axis, agro_hdfc, etc."
              />
            </div>
            <div className="min-w-0">
              <label className="mb-2 block text-sm font-medium text-gray-700">Bank</label>
              <input
                type="text"
                value={filters.bank}
                onChange={(event) =>
                  setFilters((prev) => ({ ...prev, bank: event.target.value }))
                }
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="Axis, HDFC, etc."
              />
            </div>
            <div className="min-w-0">
              <label className="mb-2 block text-sm font-medium text-gray-700">Provider</label>
              <input
                type="text"
                value={filters.provider}
                onChange={(event) =>
                  setFilters((prev) => ({ ...prev, provider: event.target.value }))
                }
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="Provider"
              />
            </div>
            <div className="min-w-0">
              <label className="mb-2 block text-sm font-medium text-gray-700">Card Classification</label>
              <input
                type="text"
                value={filters.cardClassification}
                onChange={(event) =>
                  setFilters((prev) => ({ ...prev, cardClassification: event.target.value }))
                }
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="Card Classification"
              />
            </div>
          </div>
        </div>

        <div className="min-w-0 rounded-xl bg-white p-4 shadow-sm">
          <h2 className="mb-4 border-b pb-2 text-xl font-semibold text-gray-800">
            Transaction List
          </h2>
          {isLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
            </div>
          ) : visibleTransactions.length === 0 ? (
            <p className="py-4 text-center text-gray-500">No transactions found.</p>
          ) : (
            <>
              {totalLedgerRows > ledgerPageSize && (
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3 text-sm text-gray-600">
                  <div>
                    Showing {Math.min((ledgerPageSafe - 1) * ledgerPageSize + 1, totalLedgerRows)}-
                    {Math.min(ledgerPageSafe * ledgerPageSize, totalLedgerRows)} of {totalLedgerRows}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setLedgerPage((prev) => Math.max(1, prev - 1))}
                      disabled={ledgerPageSafe <= 1}
                      className="rounded-lg border border-gray-200 px-3 py-1 text-sm text-gray-700 disabled:cursor-not-allowed disabled:text-gray-400"
                    >
                      Prev
                    </button>
                    <span className="text-gray-700">
                      Page {ledgerPageSafe} of {totalLedgerPages}
                    </span>
                    <button
                      type="button"
                      onClick={() => setLedgerPage((prev) => Math.min(totalLedgerPages, prev + 1))}
                      disabled={ledgerPageSafe >= totalLedgerPages}
                      className="rounded-lg border border-gray-200 px-3 py-1 text-sm text-gray-700 disabled:cursor-not-allowed disabled:text-gray-400"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
              <div className="space-y-3 md:hidden">
                {pagedVisibleTransactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm"
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-sm font-semibold text-gray-900">#{tx.id}</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <p className="text-gray-500">Date</p>
                        <p className="font-medium text-gray-900">
                          {formatLedgerDate(tx.date_and_time)}
                        </p>
                        <p className="text-gray-500">Time</p>
                        <p className="font-medium text-gray-900">
                          {tx.date_and_time ? new Date(tx.date_and_time).toLocaleTimeString() : ""}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500">User</p>
                        <p className="font-medium text-gray-900">{tx.user?.name || "-"}</p>
                        <p className="text-xs text-gray-500">
                          {tx.user?.mobile_number || tx.user?.id || ""}
                        </p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-gray-500">Type</p>
                        <div className="mt-1">{renderTransactionTypeBadge(tx.transaction_type)}</div>
                        <p className="mt-2 text-gray-500">Description</p>
                        <DescriptionCell value={tx.description} />
                      </div>
                      <div>
                        <p className="text-gray-500">Opening</p>
                        <p className="font-medium text-gray-900">
                          {parseFloat(tx.opening_balance || 0).toLocaleString("en-IN", {
                            minimumFractionDigits: 2,
                          })}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500">Credit</p>
                        <p className="font-medium text-green-600">
                          {tx.credit > 0
                            ? parseFloat(tx.credit).toLocaleString("en-IN", {
                                minimumFractionDigits: 2,
                              })
                            : ""}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500">Debit</p>
                        <p
                          className={`font-medium ${isMdrCutTransaction(tx) ? "text-[#FF00FF]" : "text-red-600"}`}
                        >
                          {tx.debit > 0
                            ? parseFloat(tx.debit).toLocaleString("en-IN", {
                                minimumFractionDigits: 2,
                              })
                            : ""}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500">Balance</p>
                        <p className="font-medium text-gray-900">
                          {parseFloat(tx.balance || 0).toLocaleString("en-IN", {
                            minimumFractionDigits: 2,
                          })}
                        </p>
                      </div>
                      <div className="col-span-2 flex justify-end">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedMetadata(tx.metadata || {});
                            setSelectedMetadataTransactionId(tx.id);
                            setMetadataModalOpen(true);
                          }}
                          className="rounded-lg border border-gray-300 bg-white px-3 py-1 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                        >
                          More
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="hidden md:block">
                <StickyLedgerTable columns={columns} data={pagedVisibleTransactions} />
              </div>
            </>
          )}
        </div>
      </div>
      <Modal
        isOpen={metadataModalOpen}
        onClose={() => setMetadataModalOpen(false)}
        title={`Metadata for transaction #${selectedMetadataTransactionId || ""}`}
      >
        {selectedMetadata && Object.keys(selectedMetadata).length > 0 ? (
          <pre className="whitespace-pre-wrap break-words rounded-xl border border-gray-200 bg-slate-50 p-4 text-sm text-gray-800">
            {JSON.stringify(selectedMetadata, null, 2)}
          </pre>
        ) : (
          <p className="text-sm text-gray-500">No metadata available for this transaction.</p>
        )}
      </Modal>
    </div>
  );
};

export default Ledger;
