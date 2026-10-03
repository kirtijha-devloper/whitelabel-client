import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createDefaultCommission, createUserCommission, getUserCommissions, updateUserCommission } from "../../api/commissionApi";
import { FaChevronDown } from "react-icons/fa";
import { toast } from "react-toastify";

const DEFAULT_FORM = {
  method: "Card",
  network: "VISA",
  cardType: "Credit",
  // NOTE: Flat-fee flow is temporarily disabled; keep keys for quick re-enable.
  feeType: "percent",
  commissionRate: "",
  flatFee: "",
  minAmount: "0",
  maxAmount: "1000000",
  user_id: "",
};

const getUserIdValue = (u) => String(u?.id ?? u?.user_id ?? "");
const getUserNameValue = (u) => String(u?.name ?? u?.full_name ?? u?.user_name ?? "Unknown");
const getUserMobileValue = (u) => String(u?.mobile ?? u?.mobile_number ?? u?.phone ?? "");
const getUserOptionLabel = (u) => {
  const id = getUserIdValue(u);
  const name = getUserNameValue(u);
  const mobile = getUserMobileValue(u);
  return mobile ? `${id} - ${name} (${mobile})` : `${id} - ${name}`;
};
const resolveUserIdFromText = (value, users = []) => {
  const text = String(value || "").trim().toLowerCase();
  if (!text) return "";

  const exact = users.find((u) => {
    const id = getUserIdValue(u).toLowerCase();
    const name = getUserNameValue(u).toLowerCase();
    const mobile = getUserMobileValue(u).toLowerCase();
    const label = getUserOptionLabel(u).toLowerCase();
    return text === id || text === name || text === mobile || text === label;
  });
  if (exact) return getUserIdValue(exact);

  const startsWithId = users.find((u) =>
    text.startsWith(`${getUserIdValue(u).toLowerCase()} -`)
  );
  if (startsWithId) return getUserIdValue(startsWithId);

  const prefixedIdMatch = String(value || "").trim().match(/^([A-Za-z0-9]+)\s*-/);
  if (prefixedIdMatch?.[1]) {
    const prefixedId = prefixedIdMatch[1].toLowerCase();
    const matched = users.find((u) => getUserIdValue(u).toLowerCase() === prefixedId);
    if (matched) return getUserIdValue(matched);
  }

  return "";
};

const ruleKey = (rule, index) =>
  String(rule?.id ?? `${rule?.method || "method"}-${rule?.network || "network"}-${rule?.cardType || "card"}-${index}`);

const clampPercent = (value) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return Math.min(100, Math.max(0, num));
};

const normalizePercentInput = (value) => {
  if (value === "" || value === null || value === undefined) return "";
  const num = Number(value);
  if (!Number.isFinite(num)) return "";
  return String(clampPercent(num));
};

const hasValue = (value) => value !== undefined && value !== null && String(value).trim() !== "";
const normalizeToken = (value) => String(value ?? "").trim().toUpperCase().replace(/\s+/g, "");
const normalizeAmount = (value, fallback) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};
const toFiniteNumber = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};
// NOTE: Flat-fee helpers intentionally disabled in percentage-only mode.
// const clampFlatFee = (value) => {
//   const num = Number(value);
//   if (!Number.isFinite(num)) return 0;
//   return Math.max(0, num);
// };
// const normalizeFlatInput = (value) => {
//   if (value === "" || value === null || value === undefined) return "";
//   const num = Number(value);
//   if (!Number.isFinite(num)) return "";
//   return String(clampFlatFee(num));
// };
const getRuleTypeKey = (rule) => {
  const method = normalizeToken(rule?.method);
  const isCard = method === "CARD";
  const network = isCard ? normalizeToken(rule?.network) : "*";
  const cardType = isCard ? normalizeToken(rule?.cardType) : "*";
  return `${method}|${network}|${cardType}`;
};
const rangesOverlap = (leftMin, leftMax, rightMin, rightMax) =>
  leftMin < rightMax && leftMax > rightMin;

const findGlobalRangeConflict = ({ candidate, rules, ignoreId }) => {
  const candidateType = getRuleTypeKey(candidate);
  const candidateMin = normalizeAmount(candidate?.min_amount ?? candidate?.minAmount, 0);
  const candidateMax = normalizeAmount(candidate?.max_amount ?? candidate?.maxAmount, 1000000);
  const ignoredId = ignoreId !== undefined && ignoreId !== null ? String(ignoreId) : "";

  return (Array.isArray(rules) ? rules : []).find((row) => {
    if (!row) return false;
    if (ignoredId && String(row?.id ?? "") === ignoredId) return false;
    if (getRuleTypeKey(row) !== candidateType) return false;
    const rowMin = normalizeAmount(row?.min_amount ?? row?.minAmount, 0);
    const rowMax = normalizeAmount(row?.max_amount ?? row?.maxAmount, 1000000);
    return rangesOverlap(candidateMin, candidateMax, rowMin, rowMax);
  });
};
const ruleSignature = (rule) =>
  (() => {
    const method = normalizeToken(rule?.method);
    const isCard = method === "CARD";
    const network = isCard ? normalizeToken(rule?.network) : "*";
    const cardType = isCard ? normalizeToken(rule?.cardType) : "*";
    const minAmount = normalizeAmount(rule?.min_amount ?? rule?.minAmount, 0);
    const maxAmount = normalizeAmount(rule?.max_amount ?? rule?.maxAmount, 1000000);
    return `${method}|${network}|${cardType}|${minAmount}|${maxAmount}`;
  })();
const buildUserCommissionLookup = (rows) => {
  const byDefaultId = new Map();
  const bySignature = new Map();
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const defaultId = String(row?.commission_default_id || "").trim();
    if (defaultId) {
      byDefaultId.set(defaultId, row);
    }
    bySignature.set(ruleSignature(row), row);
  });
  return { byDefaultId, bySignature };
};
const areCommissionMapsEqual = (left, right) => {
  const leftKeys = Object.keys(left || {});
  const rightKeys = Object.keys(right || {});
  if (leftKeys.length !== rightKeys.length) return false;
  for (const key of leftKeys) {
    if ((left?.[key] ?? "") !== (right?.[key] ?? "")) {
      return false;
    }
  }
  return true;
};

export const CommissionFormModal = ({
  open,
  onClose,
  mode = "global",
  users = [],
  userCommissionLabel = "Franchise",
  globalRules = [],
  editData = null,
  onEditSave = () => { },
}) => {
  const queryClient = useQueryClient();
  const methodOptions = ["Card", "UPI", "Net Banking", "Wallet", "Cash", "Prepaid", "Corporate"];
  const networkOptions = ["VISA", "MASTERCARD", "RUPAY", "AMEX", "DINERS CLUB", "OTHER"];
  const cardTypeOptions = ["Credit", "Debit", "Prepaid", "Corporate/Business", "Commercial", "Charge", "International"];

  const [form, setForm] = useState(DEFAULT_FORM);
  const [bulkCommissions, setBulkCommissions] = useState({});
  const [baselineBulkCommissions, setBaselineBulkCommissions] = useState({});
  const [userSearch, setUserSearch] = useState("");
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [validationDialog, setValidationDialog] = useState(null);
  const isEditMode = Boolean(editData);
  const isCardMethod = form.method === "Card";


  // NOTE: Percentage-only mode for now. Re-enable by restoring `form.feeType === "flat"`.
  const isFlatFeeMode = false;
  const isUserAddMode = mode === "user" && !isEditMode;
  const selectedUserId = isUserAddMode
    ? String(form.user_id || resolveUserIdFromText(userSearch, users) || "").trim()
    : "";
  const isUserSaveDisabled = isUserAddMode && (!selectedUserId || globalRules.length === 0);
  const modalTitle = isEditMode
    ? "Edit Payment Commission"
    : mode === "user"
      ? `Add ${userCommissionLabel} Commission`
      : "Add New Payment Commission";

  const { data: userCommissions } = useQuery({
    queryKey: ["user-commission", selectedUserId],
    enabled: open && isUserAddMode && hasValue(selectedUserId),
    retry: false,
    refetchOnWindowFocus: false,
    queryFn: () => getUserCommissions(selectedUserId),
  });
  const safeUserCommissions = useMemo(
    () => (Array.isArray(userCommissions) ? userCommissions : []),
    [userCommissions]
  );

  useEffect(() => {
    if (open) {
      if (editData) {
        setForm({
          method: editData?.method || "Card",
          network: editData?.network || "",
          cardType: editData?.cardType || "",
          // NOTE: Flat-fee edit mode disabled for now.
          feeType: "percent",
          commissionRate: editData?.commissionRate ?? "",
          flatFee: "",
          minAmount: String(editData?.min_amount ?? editData?.minAmount ?? 0),
          maxAmount: String(editData?.max_amount ?? editData?.maxAmount ?? 1000000),
          user_id: editData?.user_id ?? editData?.userId ?? "",
        });
      } else {
        setForm(DEFAULT_FORM);
      }
      setUserSearch("");
      setUserDropdownOpen(false);
      setValidationDialog(null);
    }
  }, [open, mode, editData]);

  useEffect(() => {
    if (!open) return;

    const { byDefaultId, bySignature } =
      isUserAddMode && hasValue(selectedUserId)
        ? buildUserCommissionLookup(safeUserCommissions)
        : { byDefaultId: new Map(), bySignature: new Map() };

    const nextCommissions = {};
    globalRules.forEach((rule, index) => {
      const key = ruleKey(rule, index);
      const defaultId = String(rule?.commission_default_id ?? rule?.id ?? "").trim();
      const matchedRow =
        (defaultId ? byDefaultId.get(defaultId) : null) ||
        bySignature.get(ruleSignature(rule));
      const finalCommission = matchedRow?.commissionRate ?? rule?.commissionRate ?? "";
      nextCommissions[key] = normalizePercentInput(finalCommission);
    });

    setBulkCommissions((prev) => (areCommissionMapsEqual(prev, nextCommissions) ? prev : nextCommissions));
    setBaselineBulkCommissions((prev) => (areCommissionMapsEqual(prev, nextCommissions) ? prev : nextCommissions));
  }, [open, globalRules, isUserAddMode, selectedUserId, safeUserCommissions]);

  const mutation = useMutation({
    mutationFn: async (payload) => {
      console.log("[Commission Save] Executing mutation with payload:", payload);
      try {
        if (isEditMode) {
          if (mode === "global") {
            // We need to import updateDefaultCommission at the top to use it here.
            // actually, wait, updateDefaultCommission is already exported from commissionApi,
            // but not imported in this file. Let's assume we can fetch it, or pass an action flag.
            // To be safe and clean, let's use the payload structure:
            if (payload.action === "updateDefault") {
              const { updateDefaultCommission } = await import("../../api/commissionApi");
              return await updateDefaultCommission(payload.id, payload.data);
            }
            if (payload.action === "updateUser") {
              return await updateUserCommission(payload.id, payload.data);
            }
          } else if (mode === "user") {
            if (payload.id) {
              return await updateUserCommission(payload.id, payload.data);
            } else {
              return await createUserCommission(payload.data);
            }
          }
        }

        if (mode === "global") {
          return await createDefaultCommission(payload);
        }
        const responses = [];
        for (const item of payload) {
          if (item?.action === "update") {
            responses.push(await updateUserCommission(item.id, item.data));
            continue;
          }
          responses.push(await createUserCommission(item.data));
        }
        return responses;
      } catch (error) {
        console.error("[Commission Save] Caught error inside mutationFn:", error);
        throw error;
      }
    },
    onSuccess: (data) => {
      console.log("[Commission Save] Server response:", data);
      if (mode === "global") {
        queryClient.invalidateQueries({ queryKey: ["global-commission"] });
      }
      queryClient.invalidateQueries({ queryKey: ["user-commission"] });
      if (isEditMode && onEditSave) {
        onEditSave(data); // Ensures parent components trigger updates/refetches
      }
      toast.success("Commission saved successfully!");
      onClose();
    },
    onError: (error) => {
      console.error("[Commission Save] Request failed:", error);
      toast.error(error?.message || "Unable to save commission right now.");
      setValidationDialog({
        title: "Save Failed",
        message: error?.message || "Unable to save commission right now.",
      });
    }
  });

  if (!open) return null;

  const normalizedSearch = userSearch.trim().toLowerCase();
  const filteredUsers = !normalizedSearch
    ? users
    : users.filter((u) => {
      const searchText = `${getUserIdValue(u)} ${getUserNameValue(u)} ${getUserMobileValue(u)}`.toLowerCase();
      return searchText.includes(normalizedSearch);
    });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className={`relative bg-white p-6 rounded-xl w-full ${isUserAddMode ? "max-w-lg" : "max-w-md"}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4">
          <h2 className="text-lg font-bold">{modalTitle}</h2>
        </div>

        {isUserAddMode && (
          <div className="mb-2 relative">
            <input
              type="text"
              className="w-full border rounded p-2 pr-10"
              placeholder="Search by Name / ID / Mobile"
              value={userSearch}
              onChange={(e) => {
                const value = e.target.value;
                setUserSearch(value);
                setUserDropdownOpen(true);
                setForm((prev) => ({
                  ...prev,
                  user_id: resolveUserIdFromText(value, users),
                }));
              }}
              onFocus={() => setUserDropdownOpen(true)}
              onBlur={() => {
                setTimeout(() => setUserDropdownOpen(false), 120);
              }}
            />
            <button
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setUserDropdownOpen((prev) => !prev)}
            >
              <FaChevronDown className="h-3 w-3" />
            </button>
            {userDropdownOpen && (
              <div className="absolute z-20 mt-1 w-full max-h-52 overflow-y-auto rounded border bg-white shadow">
                {filteredUsers.length === 0 && (
                  <div className="px-3 py-2 text-sm text-gray-500">No matching user found</div>
                )}
                {filteredUsers.map((u) => (
                  <button
                    key={getUserIdValue(u)}
                    type="button"
                    className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-100"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setUserSearch(getUserOptionLabel(u));
                      setForm((prev) => ({ ...prev, user_id: getUserIdValue(u) }));
                      setUserDropdownOpen(false);
                    }}
                  >
                    {getUserOptionLabel(u)}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {mode === "global" || isEditMode ? (
          <>
            <label className="mb-1 block text-sm font-medium text-gray-700">Method</label>
            <select
              className="mb-2 w-full rounded border p-2"
              value={form.method}
              onChange={(e) => {
                const nextMethod = e.target.value;
                const isCardOrUpi = nextMethod === "Card" || nextMethod === "UPI";
                setForm((prev) => ({
                  ...prev,
                  method: nextMethod,
                  network: isCardOrUpi ? prev.network || (nextMethod === "UPI" ? "RUPAY" : "VISA") : "",
                  cardType: isCardOrUpi ? prev.cardType || "Credit" : "",
                }));
              }}
            >
              {methodOptions.map((method) => (
                <option key={method} value={method}>
                  {method}
                </option>
              ))}
            </select>

            {(isCardMethod || form.method === "UPI") && (
              <>
                <label className="mb-1 block text-sm font-medium text-gray-700">Network</label>
                <select
                  className="mb-2 w-full rounded border p-2"
                  value={form.network}
                  onChange={(e) => setForm({ ...form, network: e.target.value })}
                >
                  {networkOptions.map((network) => (
                    <option key={network} value={network}>
                      {network}
                    </option>
                  ))}
                </select>

                <label className="mb-1 block text-sm font-medium text-gray-700">Card Type</label>
                <select
                  className="mb-2 w-full rounded border p-2"
                  value={form.cardType}
                  onChange={(e) => setForm({ ...form, cardType: e.target.value })}
                >
                  {cardTypeOptions.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </>
            )}

            <label className="mb-1 block text-sm font-medium text-gray-700">Commission</label>
            <div className="mb-2 flex items-center gap-4 rounded border p-2">
              <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="radio"
                  name="feeType"
                  checked={!isFlatFeeMode}
                  onChange={() => setForm((prev) => ({ ...prev, feeType: "percent" }))}
                />
                Percent Fee (%)
              </label>
              <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="radio"
                  name="feeType"
                  checked={false}
                  disabled
                />
                Flat Fee
              </label>
            </div>
            <input
              type="number"
              className="w-full border rounded p-2 mb-2"
              placeholder="Enter Commission %"
              min={0}
              max={100}
              step="0.01"
              value={form.commissionRate}
              onChange={(e) => setForm({ ...form, commissionRate: normalizePercentInput(e.target.value) })}
            />
            {/* NOTE: Flat-fee input is intentionally hidden in percentage-only mode.
            <input
              type="number"
              className="w-full border rounded p-2 mb-2"
              placeholder="Enter Flat Fee"
              min={0}
              step="0.01"
              value={form.flatFee}
              onChange={(e) => setForm({ ...form, flatFee: normalizeFlatInput(e.target.value) })}
            />
            */}

            <div className="mb-2 grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Min Range</label>
                <input
                  type="number"
                  className="w-full rounded border p-2"
                  placeholder="0"
                  min={0}
                  step="0.01"
                  value={form.minAmount}
                  onChange={(e) => setForm({ ...form, minAmount: e.target.value })}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Max Range</label>
                <input
                  type="number"
                  className="w-full rounded border p-2"
                  placeholder="1000000"
                  min={0}
                  step="0.01"
                  value={form.maxAmount}
                  onChange={(e) => setForm({ ...form, maxAmount: e.target.value })}
                />
              </div>
            </div>
          </>
        ) : (
          <div
            className="max-h-[55vh] overflow-y-auto pr-1 scrollbar-hide"
            style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
          >
            <p className="mb-2 text-sm font-semibold text-gray-700">Payment Method Commissions</p>
            {globalRules.length === 0 && (
              <p className="rounded border border-dashed p-2 text-sm text-gray-500">
                No global commission rules available.
              </p>
            )}
            {globalRules.map((rule, index) => {
              const key = ruleKey(rule, index);
              const methodText = rule?.method || "Method";
              const networkText = rule?.network ? ` ${rule.network}` : "";
              const cardText = rule?.cardType ? ` ${rule.cardType}` : "";
              const commissionText =
                rule?.commissionRate !== undefined && rule?.commissionRate !== null
                  ? ` - Global Commission ${rule.commissionRate}%`
                  : "";
              return (
                <div key={key} className="mb-3">
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600">
                    {`${methodText}${networkText}${cardText}${commissionText}`}
                  </label>
                  <input
                    type="number"
                    className="w-full rounded border p-2"
                    placeholder="Commission %"
                    min={0}
                    max={100}
                    step="0.01"
                    value={bulkCommissions[key] ?? ""}
                    onChange={(e) =>
                      setBulkCommissions((prev) => ({
                        ...prev,
                        [key]: normalizePercentInput(e.target.value),
                      }))
                    }
                  />
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              if (isEditMode) {
                const minAmount = toFiniteNumber(form.minAmount);
                const maxAmount = toFiniteNumber(form.maxAmount);
                if (minAmount === null || maxAmount === null) {
                  setValidationDialog({
                    title: "Invalid Range",
                    message: "Min and Max range must be valid numbers.",
                  });
                  return;
                }
                if (maxAmount <= minAmount) {
                  setValidationDialog({
                    title: "Invalid Range",
                    message: "Max range must be greater than Min range.",
                  });
                  return;
                }
                const percent = toFiniteNumber(form.commissionRate);
                if (percent === null || percent <= 0) {
                  setValidationDialog({
                    title: "Invalid Percentage",
                    message: "Percentage fee is required and must be greater than 0.",
                  });
                  return;
                }
                // NOTE: Flat-fee validation intentionally disabled.
                const payload = {
                  ...editData,
                  ...form,
                  network: isCardMethod ? form.network : "",
                  cardType: isCardMethod ? form.cardType : "",
                  feeType: "percent",
                  commissionRate: clampPercent(form.commissionRate ?? 0),
                  // NOTE: Flat-fee payload intentionally disabled.
                  // flatFee: clampFlatFee(form.flatFee ?? 0),
                  min_amount: minAmount,
                  max_amount: maxAmount,
                };
                if (mode === "global") {
                  const conflict = findGlobalRangeConflict({
                    candidate: payload,
                    rules: globalRules,
                    ignoreId: editData?.id,
                  });
                  if (conflict) {
                    setValidationDialog({
                      title: "Duplicate Range",
                      message: "Duplicate or overlapping range exists for this Method/Network/Card Type.",
                    });
                    return;
                  }

                  mutation.mutate({
                    action: "updateDefault",
                    id: editData.id,
                    data: payload
                  });

                } else {
                  mutation.mutate({
                    action: "updateUser",
                    id: editData.id,
                    data: payload
                  });
                }
                return;
              }
              if (mode === "user") {
                if (!selectedUserId || globalRules.length === 0) return;
                const { byDefaultId, bySignature } = buildUserCommissionLookup(safeUserCommissions);
                const payload = globalRules.reduce((acc, rule, index) => {
                  const key = ruleKey(rule, index);
                  const enteredCommission = normalizePercentInput(bulkCommissions[key]);
                  const baselineCommission = normalizePercentInput(baselineBulkCommissions[key]);
                  const defaultCommission = normalizePercentInput(rule?.commissionRate ?? "");
                  const finalCommission = enteredCommission === "" ? defaultCommission : enteredCommission;
                  const normalizedFinalCommission = normalizePercentInput(finalCommission);
                  const ruleLikeForMatch = {
                    method: rule?.method || "",
                    network: rule?.network || "",
                    cardType: rule?.cardType || "",
                    min_amount: Number(rule?.min_amount ?? rule?.minAmount ?? 0),
                    max_amount: Number(rule?.max_amount ?? rule?.maxAmount ?? 1000000),
                  };
                  const exactExistingRow = safeUserCommissions.find(
                    (row) =>
                      ruleSignature(row) === ruleSignature(ruleLikeForMatch) &&
                      normalizePercentInput(row?.commissionRate ?? "") === normalizedFinalCommission
                  );
                  if (exactExistingRow) {
                    return acc;
                  }
                  const defaultIdCandidate = rule?.commission_default_id ?? rule?.id;
                  const parsedDefaultId = Number(defaultIdCandidate);
                  const canLinkExistingDefault = Number.isFinite(parsedDefaultId);
                  const defaultId = String(defaultIdCandidate ?? "").trim();
                  const existingRow =
                    (defaultId ? byDefaultId.get(defaultId) : null) ||
                    bySignature.get(ruleSignature(rule));
                  const existingCommission = normalizePercentInput(existingRow?.commissionRate ?? "");

                  const isCustom = enteredCommission !== "" && enteredCommission !== defaultCommission;

                  const item = {
                    user_id: selectedUserId,
                    method: rule?.method || "",
                    network: rule?.network || "",
                    cardType: rule?.cardType || "",
                    paymentMode: rule?.paymentMode || "",
                    min_amount: Number(rule?.min_amount ?? rule?.minAmount ?? 0),
                    max_amount: Number(rule?.max_amount ?? rule?.maxAmount ?? 1000000),
                  };

                  if (existingRow?.id) {
                    if (existingCommission !== finalCommission) {
                      acc.push({
                        action: "update",
                        id: existingRow.id,
                        data: {
                          ...existingRow,
                          ...item,
                          commissionRate: clampPercent(finalCommission),
                        },
                      });
                    }
                    return acc;
                  }

                  if (canLinkExistingDefault) {
                    item.commission_default_id = parsedDefaultId;
                  }
                  if (isCustom || !canLinkExistingDefault) {
                    item.commissionRate = clampPercent(finalCommission);
                  }
                  acc.push({ action: "create", data: item });
                  return acc;
                }, []);

                if (payload.length === 0) {
                  onClose();
                  return;
                }
                mutation.mutate(payload);
                return;
              }
              const minAmount = toFiniteNumber(form.minAmount);
              const maxAmount = toFiniteNumber(form.maxAmount);
              if (minAmount === null || maxAmount === null) {
                setValidationDialog({
                  title: "Invalid Range",
                  message: "Min and Max range must be valid numbers.",
                });
                return;
              }
              if (maxAmount <= minAmount) {
                setValidationDialog({
                  title: "Invalid Range",
                  message: "Max range must be greater than Min range.",
                });
                return;
              }
              const percent = toFiniteNumber(form.commissionRate);
              if (percent === null || percent <= 0) {
                setValidationDialog({
                  title: "Invalid Percentage",
                  message: "Percentage fee is required and must be greater than 0.",
                });
                return;
              }
              // NOTE: Flat-fee validation intentionally disabled.
              const globalPayload = {
                ...form,
                network: isCardMethod ? form.network : "",
                cardType: isCardMethod ? form.cardType : "",
                feeType: "percent",
                commissionRate: clampPercent(form.commissionRate ?? 0),
                // NOTE: Flat-fee payload intentionally disabled.
                // flatFee: clampFlatFee(form.flatFee ?? 0),
                min_amount: minAmount,
                max_amount: maxAmount,
              };
              const conflict = findGlobalRangeConflict({
                candidate: globalPayload,
                rules: globalRules,
              });
              if (conflict) {
                setValidationDialog({
                  title: "Duplicate Range",
                  message: "Duplicate or overlapping range exists for this Method/Network/Card Type.",
                });
                return;
              }
              mutation.mutate({
                ...globalPayload,
              });
            }}
            disabled={mutation.isPending || isUserSaveDisabled}
            className="rounded-lg bg-[#00D3CD] px-4 py-2 text-white transition-colors hover:bg-[#00b8b3] disabled:cursor-not-allowed disabled:bg-[#00D3CD] disabled:hover:bg-[#00D3CD]"
          >
            {mutation.isPending ? "Saving..." : isEditMode ? "Update" : "Save"}
          </button>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 transition-colors hover:bg-gray-100"
          >
            Cancel
          </button>
        </div>

        {validationDialog && (
          <div className="absolute inset-0 z-20 flex items-center justify-center rounded-xl bg-black/35 p-4">
            <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-2xl">
              <h3 className="text-lg font-semibold text-gray-900">{validationDialog.title}</h3>
              <p className="mt-2 text-sm text-gray-600">{validationDialog.message}</p>
              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={() => setValidationDialog(null)}
                  className="rounded-lg bg-[#00D3CD] px-4 py-2 text-white transition-colors hover:bg-[#00b8b3]"
                >
                  OK
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
