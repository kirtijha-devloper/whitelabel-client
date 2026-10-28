import React, { useState, useEffect } from "react";
import {
  getMerchants,
  getFranchises,
  getFranchiseManagedMerchantRates,
  updateFranchiseManagedMerchantRate,
  getFranchiseManagedAllMerchantRates,
  getFranchiseManagedDefaultRates,
  updateFranchiseManagedDefaultRate,
  getSuperFranchiseManagedDefaultRates,
  updateSuperFranchiseManagedDefaultRate,
  getSuperFranchiseManagedFranchiseRates,
  updateSuperFranchiseManagedFranchiseRate,
  getSuperFranchiseManagedMerchantRates,
  updateSuperFranchiseManagedMerchantRate,
  getSuperFranchiseManagedAllFranchiseRates,
  getSuperFranchiseManagedAllMerchantRates,
  deleteDefaultPOSRate,
} from "../api/rateSettingsApi";
import Loader from "../components/Loader";
import { toast } from "react-toastify";
import { Lock, Trash2 } from "lucide-react";

const DEFAULT_SETTLEMENT_FILTER = "today_settlement";

const FranchiseMerchantRateSetting = ({ currentUser }) => {
  const normalizedRole = String(currentUser?.role || '').trim().toLowerCase().replace(/[-_]/g, '');
  const isSuperFranchise =
    normalizedRole === "superfranchise" ||
    (typeof window !== "undefined" && window.location.pathname.includes("/super-franchise"));


  const [activeTab, setActiveTab] = useState("default"); // 'default', 'franchise', or 'specific'
  const [viewMode, setViewMode] = useState("detail"); // 'matrix' or 'detail'
  const [settlementFilter, setSettlementFilter] = useState(DEFAULT_SETTLEMENT_FILTER);

  const [franchises, setFranchises] = useState([]);
  const [selectedFranchiseId, setSelectedFranchiseId] = useState("");
  const [merchants, setMerchants] = useState([]);
  const [selectedMerchantId, setSelectedMerchantId] = useState("");
  const [rates, setRates] = useState([]);
  const [matrixData, setMatrixData] = useState({});
  const [defaultColumnStructure, setDefaultColumnStructure] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [compactColumnMode, setCompactColumnMode] = useState(false);
  const [selectedComboGroupKey, setSelectedComboGroupKey] = useState(null);
  const [selectedComboPopup, setSelectedComboPopup] = useState(null);
  const [comboPopupMethod, setComboPopupMethod] = useState("");
  const [comboPopupNetwork, setComboPopupNetwork] = useState("");
  const [comboPopupClassification, setComboPopupClassification] = useState("");

  const [loading, setLoading] = useState(false);
  const [loadingRates, setLoadingRates] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState("");
  const [editFlatValue, setEditFlatValue] = useState("");
  const [validationError, setValidationError] = useState("");
  const [flatValidationError, setFlatValidationError] = useState("");
  const [pendingDelete, setPendingDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [matrixRowsPerPage, setMatrixRowsPerPage] = useState(20);
  const [matrixPage, setMatrixPage] = useState(1);
  const [detailReadOnly, setDetailReadOnly] = useState(false);

  const getEntityPhone = (entity) => entity?.phone || entity?.mobile_number || entity?.mobile || "N/A";
  const getEntityDisplayId = (entity) =>
    entity?.custom_id ||
    entity?.abheepay_id ||
    entity?.abheepayId ||
    entity?.display_id ||
    entity?.displayId ||
    entity?.user_id ||
    entity?.userId ||
    (entity?.id ? `ID #${entity.id}` : "N/A");

  const currentFranchiseId = currentUser?.id || 1;
  const currentUserId = currentUser?.id || 1;
  const getMerchantIdentifier = (entity) => {
    const rawId =
      entity?.id ??
      entity?.merchant_id ??
      entity?.merchantId ??
      entity?.franchise_id ??
      entity?.franchiseId ??
      entity?.user_id ??
      entity?.userId;

    const parsedId = Number(rawId);
    return Number.isFinite(parsedId) ? parsedId : null;
  };
  const summarizeMerchant = (merchant) => ({
    id: merchant?.id ?? null,
    merchant_id: merchant?.merchant_id ?? null,
    merchantId: merchant?.merchantId ?? null,
    user_id: merchant?.user_id ?? null,
    userId: merchant?.userId ?? null,
    resolvedMerchantId: Number.isFinite(getMerchantIdentifier(merchant)) ? getMerchantIdentifier(merchant) : null,
    name: merchant?.name ?? null,
    franchise_id: merchant?.franchise_id ?? null,
    franchaise_id: merchant?.franchaise_id ?? null,
    franchiseId: merchant?.franchiseId ?? null,
    created_by: merchant?.created_by ?? null
  });
  const formatScopeLabel = (scope) => {
    if (scope === "franchise") return "Rate Set By Franchise";
    if (scope === "super_franchise") return "Rate Set By Super Franchise";
    if (scope === "admin") return "Rate Set By Admin";
    return "Base Rate";
  };
  const hasEditableGst = (rate) => rate?.gst_required || rate?.gst_rate !== null && rate?.gst_rate !== undefined;
  const getAdminRateValue = (rate) => {
    const val = rate?.base_rate ?? rate?.admin_rate ?? rate?.platform_default_rate ?? rate?.base_rule?.charge_percent;
    if (val !== undefined && val !== null && !isNaN(Number(val))) {
      return Number(val);
    }
    if (rate?.isInherited && rate?.charge_percent !== undefined && rate?.charge_percent !== null && !isNaN(Number(rate.charge_percent))) {
      return Number(rate.charge_percent);
    }
    return 0;
  };

  const getValidationTarget = (rate) => getAdminRateValue(rate);

  const getAdminFlatRateValue = (rate) => {
    const val = rate?.base_flat_rate ?? rate?.admin_flat_rate ?? rate?.platform_default_flat_rate ?? rate?.base_rule?.charge_flat;
    if (val !== undefined && val !== null && !isNaN(Number(val))) {
      return Number(val);
    }
    if (rate?.isInherited && rate?.charge_flat !== undefined && rate?.charge_flat !== null && !isNaN(Number(rate.charge_flat))) {
      return Number(rate.charge_flat);
    }
    return 0;
  };

  const getEditableFlatRateValue = (rate) => Number(rate?.charge_flat ?? 0);
  const getFlatValidationTarget = (rate) => getAdminFlatRateValue(rate);

  const getFlatValidationMessage = (rate) => {
    const minTarget = getFlatValidationTarget(rate);
    const minTargetDisplay = Number.isFinite(minTarget) ? `₹${minTarget.toFixed(2)}` : "inherited flat rate";
    if (isSuperFranchise) {
      if (activeTab === "default") {
        return `Downline default flat charge must be ≥ Admin flat rate (${minTargetDisplay})`;
      }
      if (activeTab === "franchise") {
        return `Franchise flat charge must be ≥ Super Franchise flat rate (${minTargetDisplay})`;
      }
      return `Merchant flat charge must be ≥ Super Franchise flat rate (${minTargetDisplay})`;
    }
    // Franchise user
    if (activeTab === "default") {
      return `Franchise default flat rate must be ≥ Super Franchise flat rate (${minTargetDisplay})`;
    }
    return `Merchant flat rate must be ≥ Franchise flat rate (${minTargetDisplay})`;
  };

  const getValidationMessage = (rate) => {
    const minTarget = getValidationTarget(rate);
    const minTargetDisplay = Number.isFinite(minTarget) ? `${minTarget.toFixed(2)}%` : "inherited rate";
    if (isSuperFranchise) {
      if (activeTab === "default") {
        return `Downline default charge must be ≥ Admin rate (${minTargetDisplay})`;
      }
      if (activeTab === "franchise") {
        return `Franchise charge must be ≥ Super Franchise rate (${minTargetDisplay})`;
      }
      return `Merchant charge must be ≥ Super Franchise rate (${minTargetDisplay})`;
    }
    // Franchise user
    if (activeTab === "default") {
      return `Franchise default rate must be ≥ Super Franchise rate (${minTargetDisplay})`;
    }
    return `Merchant rate must be ≥ Franchise rate (${minTargetDisplay})`;
  };

  const getBaseRateLabel = () => {
    if (isSuperFranchise) {
      if (activeTab === "default") return "Admin Rate (%)";
      return "Super Franchise Rate (%)";
    }
    if (activeTab === "default") {
      return "Super Franchise Rate (%)";
    }
    return "Franchise Rate (%)";
  };

  const getBaseFlatRateLabel = () => {
    if (isSuperFranchise) {
      if (activeTab === "default") return "Admin Flat Rate (₹)";
      return "Super Franchise Flat (₹)";
    }
    if (activeTab === "default") {
      return "Super Franchise Flat (₹)";
    }
    return "Franchise Flat Rate (₹)";
  };

  const getBaseRateSubtext = () => {
    if (isSuperFranchise) {
      if (activeTab === "default") return "Inherited from Admin";
      return "SF Baseline";
    }
    if (activeTab === "default") {
      return "Inherited from Super Franchise";
    }
    return "Inherited from Franchise";
  };

  const getDownlineRateLabel = () => {
    if (isSuperFranchise) {
      if (activeTab === "default") return "Set Downline Rate (%)";
      if (activeTab === "franchise") return "Set Franchise Rate (%)";
      return "Set Merchant Rate (%)";
    }
    if (activeTab === "default") return "Set Default Rate (%)";
    return "Set Merchant Rate (%)";
  };

  const getDownlineFlatRateLabel = () => {
    if (isSuperFranchise) {
      if (activeTab === "default") return "Set Downline Flat (₹)";
      if (activeTab === "franchise") return "Set Franchise Flat (₹)";
      return "Set Merchant Flat (₹)";
    }
    if (activeTab === "default") return "Set Default Flat (₹)";
    return "Set Merchant Flat (₹)";
  };

  const getEditableRateValue = (rate) => {
    if (activeTab === "default") {
      return rate.merchant_rate ?? rate.franchise_rate ?? rate.super_franchise_rate ?? rate.base_rate ?? rate.admin_rate;
    }
    if (activeTab === "franchise") {
      return rate.franchise_rate ?? rate.merchant_rate ?? rate.base_rate ?? rate.admin_rate;
    }
    return rate.merchant_rate ?? rate.franchise_rate ?? rate.base_rate ?? rate.admin_rate;
  };
  const normalizeSettlementValue = (value) => String(value ?? "").trim().toLowerCase();
  const matchesSettlementFilter = (rate) => {
    if (settlementFilter === "all") return true;
    const rateSettlement = normalizeSettlementValue(rate?.settlement_type);
    if (!rateSettlement || rateSettlement === "any" || rateSettlement === "all") return true;
    return rateSettlement === settlementFilter;
  };
  const formatSettlementLabel = (value) => {
    const normalizedValue = normalizeSettlementValue(value);
    if (normalizedValue === "today_settlement") return "Today Settlement";
    if (normalizedValue === "next_day_settlement") return "Next Day Settlement";
    return value || "Any";
  };

  useEffect(() => {
    setEditingId(null);
    setEditValue("");
    setEditFlatValue("");
    setValidationError("");
    setFlatValidationError("");
    setSelectedComboPopup(null);
  }, [settlementFilter]);

  useEffect(() => {
    setMatrixPage(1);
  }, [searchTerm, activeTab, viewMode]);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      if (activeTab === "franchise") {
        const franchisesData = await getFranchises();
        setFranchises(franchisesData);

        const matrix = await getSuperFranchiseManagedAllFranchiseRates(franchisesData, currentUserId);
        setMatrixData(matrix);

        const defaultRates = await getSuperFranchiseManagedDefaultRates(currentUserId);
        const rateMap = new Map();
        [...defaultRates, ...Object.values(matrix).flat()].forEach((rate) => {
          if (!rateMap.has(rate.rule_key)) {
            rateMap.set(rate.rule_key, rate);
          }
        });
        setDefaultColumnStructure(Array.from(rateMap.values()));
      } else if (activeTab === "specific") {
        const merchantsData = await getMerchants(isSuperFranchise ? undefined : currentUserId);
        setMerchants(merchantsData);

        const matrix = isSuperFranchise
          ? await getSuperFranchiseManagedAllMerchantRates(merchantsData, currentUserId)
          : await getFranchiseManagedAllMerchantRates(merchantsData, currentUserId);
        setMatrixData(matrix);

        const defaultRates = isSuperFranchise
          ? await getSuperFranchiseManagedDefaultRates(currentUserId)
          : await getFranchiseManagedDefaultRates(currentUserId);
        const rateMap = new Map();
        [...defaultRates, ...Object.values(matrix).flat()].forEach((rate) => {
          if (!rateMap.has(rate.rule_key)) {
            rateMap.set(rate.rule_key, rate);
          }
        });
        setDefaultColumnStructure(Array.from(rateMap.values()));
      } else if (activeTab === "default") {
        const defaultRates = isSuperFranchise
          ? await getSuperFranchiseManagedDefaultRates(currentUserId)
          : await getFranchiseManagedDefaultRates(currentUserId);
        setRates(defaultRates);
      }
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to load initial data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setEditingId(null);
    setEditValue("");
    setEditFlatValue("");
    setValidationError("");
    setFlatValidationError("");

    const scrollContainer = document.getElementById("main-content");
    if (scrollContainer) {
      scrollContainer.scrollTop = 0;
    } else {
      window.scrollTo(0, 0);
    }

    if (activeTab === "default") {
      fetchRates(currentUserId);
    } else if (activeTab === "franchise") {
      if (viewMode === "detail" && selectedFranchiseId) {
        fetchRates(selectedFranchiseId);
      } else {
        fetchInitialData();
      }
    } else if (activeTab === "specific") {
      if (viewMode === "detail" && selectedMerchantId) {
        fetchRates(selectedMerchantId);
      } else {
        fetchInitialData();
      }
    }
  }, [activeTab, viewMode, selectedFranchiseId, selectedMerchantId, currentUserId]);

  const fetchRates = async (id) => {
    setLoadingRates(true);
    try {
      let data = [];
      if (activeTab === "default") {
        data = isSuperFranchise
          ? await getSuperFranchiseManagedDefaultRates(id)
          : await getFranchiseManagedDefaultRates(id);
      } else if (activeTab === "franchise") {
        data = await getSuperFranchiseManagedFranchiseRates(id, currentUserId);
      } else if (activeTab === "specific") {
        data = isSuperFranchise
          ? await getSuperFranchiseManagedMerchantRates(id, currentUserId)
          : await getFranchiseManagedMerchantRates(id, currentUserId);
      }
      setRates(data);
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to load rates");
    } finally {
      setLoadingRates(false);
    }
  };

  const handleViewDetail = (item) => {
    const itemId = getMerchantIdentifier(item);
    if (itemId === null) {
      toast.error(`${activeTab === "franchise" ? "Franchise" : "Merchant"} ID is missing.`);
      return;
    }
    if (activeTab === "franchise") {
      setSelectedFranchiseId(itemId);
    } else {
      setSelectedMerchantId(itemId);
    }
    setDetailReadOnly(true);
    setViewMode("detail");
  };

  const handleEditDetail = (item) => {
    const itemId = getMerchantIdentifier(item);
    if (itemId === null) {
      toast.error(`${activeTab === "franchise" ? "Franchise" : "Merchant"} ID is missing.`);
      return;
    }
    if (activeTab === "franchise") {
      setSelectedFranchiseId(itemId);
    } else {
      setSelectedMerchantId(itemId);
    }
    setDetailReadOnly(false);
    setViewMode("detail");
  };

  const handleBackToMatrix = () => {
    setSelectedMerchantId("");
    setSelectedFranchiseId("");
    setViewMode("matrix");
    setDetailReadOnly(false);
    fetchInitialData();
  };

  const handleEdit = (rate) => {
    setEditingId(rate.id);
    const minRate = getValidationTarget(rate);
    const currentRate = getEditableRateValue(rate);
    const parsedRate = currentRate !== null && currentRate !== undefined && !isNaN(Number(currentRate)) ? Number(currentRate) : minRate;
    setEditValue(String(Math.max(parsedRate, minRate)));

    const minFlat = getFlatValidationTarget(rate);
    const currentFlat = getEditableFlatRateValue(rate);
    const parsedFlat = currentFlat !== null && currentFlat !== undefined && !isNaN(Number(currentFlat)) ? Number(currentFlat) : minFlat;
    setEditFlatValue(String(Math.max(parsedFlat, minFlat)));

    setValidationError("");
    setFlatValidationError("");
  };

  const canDeleteRate = (rate) => {
    if (!rate) return false;
    // An inherited rate comes from upline and cannot be deleted here
    if (rate.isInherited) return false;

    // Must have a real database rule ID to delete
    const ruleId =
      (Number.isFinite(Number(rate.rule_id)) && Number(rate.rule_id) > 0 ? Number(rate.rule_id) : null) ||
      (Number.isFinite(Number(rate.id)) && Number(rate.id) > 0 ? Number(rate.id) : null) ||
      (Number.isFinite(Number(rate.original_rule?.id)) && Number(rate.original_rule?.id) > 0 ? Number(rate.original_rule?.id) : null);
    if (!ruleId) return false;

    const rawScope = String(
      rate.scope ||
      rate.source_scope ||
      rate.original_rule?.scope ||
      ""
    ).toLowerCase();

    // Match role with scope strictly:
    if (isSuperFranchise) {
      return rawScope.startsWith("super_franchise") || rate.source_scope === "super_franchise";
    }

    // Franchise can delete entries whose scope belongs to franchise (e.g. franchise_default, franchise_merchant)
    return (rawScope.startsWith("franchise") || rate.source_scope === "franchise") && !rawScope.startsWith("super_franchise") && !rawScope.startsWith("admin");
  };

  const handleDelete = (rate) => {
    if (!rate) return;
    if (!canDeleteRate(rate)) {
      toast.info(
        isSuperFranchise
          ? "This rate is inherited from Admin/Super Admin. Only Super Franchise custom rates can be deleted."
          : "This rate is inherited from Super Franchise/Admin. Only Franchise custom rates can be deleted."
      );
      return;
    }
    setPendingDelete(rate);
  };

  const closeDeleteModal = () => {
    if (isDeleting) return;
    setPendingDelete(null);
  };

  const confirmDelete = async () => {
    const rate = pendingDelete;
    if (!rate) return;

    if (!canDeleteRate(rate)) {
      toast.error(
        isSuperFranchise
          ? "Unauthorized: You can only delete custom overrides created under Super Franchise scope."
          : "Unauthorized: You can only delete custom overrides created under Franchise scope."
      );
      setPendingDelete(null);
      return;
    }

    const deleteId =
      (Number.isFinite(Number(rate.rule_id)) && Number(rate.rule_id) > 0 ? Number(rate.rule_id) : null) ||
      (Number.isFinite(Number(rate.id)) && Number(rate.id) > 0 ? Number(rate.id) : null) ||
      (Number.isFinite(Number(rate.original_rule?.id)) && Number(rate.original_rule?.id) > 0 ? Number(rate.original_rule?.id) : null);

    if (!deleteId) {
      toast.error("Could not find a valid rule ID to delete for this entry.");
      setPendingDelete(null);
      return;
    }

    setIsDeleting(true);
    try {
      await deleteDefaultPOSRate(deleteId);
      toast.success("Rate override deleted successfully. Reverted to inherited rate.");

      if (activeTab === "default") {
        await fetchRates(currentUserId);
      } else if (activeTab === "franchise" && selectedFranchiseId) {
        await fetchRates(selectedFranchiseId);
      } else if (activeTab === "specific" && selectedMerchantId) {
        await fetchRates(selectedMerchantId);
      } else {
        await fetchInitialData();
      }
      setPendingDelete(null);
    } catch (error) {
      toast.error("Failed to delete rate: " + (error?.response?.data?.message || error.message));
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditValue("");
    setEditFlatValue("");
    setValidationError("");
    setFlatValidationError("");
  };

  const handleChange = (e, baseRate, rate) => {
    const val = e.target.value;
    setEditValue(val);
    if (val !== "" && Number(val) < Number(baseRate)) {
      setValidationError(getValidationMessage(rate || { base_rate: baseRate, admin_rate: baseRate }));
    } else {
      setValidationError("");
    }
  };

  const handleFlatChange = (e, baseFlatRate, rate) => {
    const val = e.target.value;
    setEditFlatValue(val);
    if (val !== "" && Number(val) < Number(baseFlatRate)) {
      setFlatValidationError(getFlatValidationMessage(rate || { base_flat_rate: baseFlatRate, admin_flat_rate: baseFlatRate }));
    } else if (val !== "" && Number(val) < 0) {
      setFlatValidationError("Flat rate cannot be negative");
    } else {
      setFlatValidationError("");
    }
  };

  const handleUpdate = async (rate) => {
    const threshold = getValidationTarget(rate);
    if (Number(editValue) < threshold) {
      toast.error(getValidationMessage(rate));
      return;
    }

    const flatThreshold = getFlatValidationTarget(rate);
    const parsedFlat = Number(editFlatValue || 0);
    if (parsedFlat < flatThreshold) {
      toast.error(getFlatValidationMessage(rate));
      return;
    }
    if (parsedFlat < 0) {
      toast.error("Flat rate cannot be negative");
      return;
    }

    try {
      const updates = {
        chargePercent: editValue,
        charge_percent: Number(editValue),
        chargeFlat: parsedFlat,
        charge_flat: parsedFlat
      };

      let updatedRate;
      if (activeTab === "default") {
        updatedRate = isSuperFranchise
          ? await updateSuperFranchiseManagedDefaultRate(currentUserId, rate, updates)
          : await updateFranchiseManagedDefaultRate(currentUserId, rate, updates);
      } else if (activeTab === "franchise") {
        updatedRate = await updateSuperFranchiseManagedFranchiseRate(
          selectedFranchiseId,
          rate,
          updates,
          currentUserId
        );
      } else {
        updatedRate = isSuperFranchise
          ? await updateSuperFranchiseManagedMerchantRate(
              selectedMerchantId,
              rate,
              updates,
              currentUserId
            )
          : await updateFranchiseManagedMerchantRate(
              selectedMerchantId,
              rate,
              updates,
              currentUserId
            );
      }

      toast.success("Rate updated successfully");
      setRates((prevRates) =>
        prevRates.map((r) => (r.rule_key === rate.rule_key ? { ...r, ...updatedRate, charge_flat: parsedFlat } : r))
      );
      if (activeTab === "franchise" && selectedFranchiseId) {
        setMatrixData((prevMatrix) => ({
          ...prevMatrix,
          [selectedFranchiseId]: (prevMatrix[selectedFranchiseId] || []).map((r) =>
            r.rule_key === rate.rule_key ? { ...r, ...updatedRate, charge_flat: parsedFlat } : r
          )
        }));
      } else if (activeTab === "specific" && selectedMerchantId) {
        setMatrixData((prevMatrix) => ({
          ...prevMatrix,
          [selectedMerchantId]: (prevMatrix[selectedMerchantId] || []).map((r) =>
            r.rule_key === rate.rule_key ? { ...r, ...updatedRate, charge_flat: parsedFlat } : r
          )
        }));
      }
      setEditingId(null);
      setEditValue("");
      setEditFlatValue("");
      setValidationError("");
      setFlatValidationError("");
    } catch (error) {
      toast.error("Failed to update rate: " + (error.response?.data?.message || error.message));
    }
  };

  const calculateMargin = (merchantRate, baseRate) => {
    if (baseRate === undefined || baseRate === null || baseRate === "" || isNaN(Number(baseRate))) return "-";
    if (merchantRate === undefined || merchantRate === null || merchantRate === "" || isNaN(Number(merchantRate))) return "-";
    return (Number(merchantRate) - Number(baseRate)).toFixed(2);
  };

  const calculateFlatMargin = (editableFlat, baseFlat) => {
    if (baseFlat === undefined || baseFlat === null || baseFlat === "" || isNaN(Number(baseFlat))) return "-";
    if (editableFlat === undefined || editableFlat === null || editableFlat === "" || isNaN(Number(editableFlat))) return "-";
    const diff = Number(editableFlat) - Number(baseFlat);
    return `₹${diff.toFixed(2)}`;
  };

  const formatRateValue = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed.toFixed(2) : "-";
  };

  const formatAmountRange = (rate) => {
    const min = rate?.min_amount ?? rate?.from_amount ?? rate?.original_rule?.min_amount ?? 0;
    const max = rate?.max_amount ?? rate?.to_amount ?? rate?.original_rule?.max_amount;
    if (max === null || max === undefined || max === '') return `${min}+`;
    return `${min} - ${max}`;
  };

  const formatGstValue = (rate) => hasEditableGst(rate) ? `${formatRateValue(rate.gst_rate)}%` : "-";
  const findMatchingRate = (rateList, attribute) => rateList.find((rate) => rate.rule_key === attribute.rule_key);
  const getRateMetaLine = (rate) =>
    [`${rate.card_classification || "ANY"}`, formatSettlementLabel(rate.settlement_type)]
      .filter(Boolean)
      .join(" | ");

  const buildGroupedColumns = (columns) => {
    const groups = new Map();
    columns.forEach((column) => {
      const groupKey = `${column.network}|${column.method}`;
      const existing = groups.get(groupKey);
      if (existing) {
        existing.columns.push(column);
        return;
      }
      groups.set(groupKey, {
        key: groupKey,
        network: column.network,
        method: column.method,
        columns: [column]
      });
    });
    return Array.from(groups.values());
  };

  const handleSelectComboGroup = (groupKey) => {
    setSelectedComboGroupKey(groupKey);
  };

  const openComboPopup = (entity, group, matchedRates) => {
    setComboPopupMethod("");
    setComboPopupNetwork("");
    setComboPopupClassification("");
    console.log("[rate-settings][combo-popup] opening combo popup", {
      entity,
      group,
      matchedRates
    });
    setSelectedComboPopup({ entity, merchant: entity, group, rates: matchedRates });
  };

  const closeComboPopup = () => {
    setSelectedComboPopup(null);
  };

  const clearSelectedComboGroup = () => {
    setSelectedComboGroupKey(null);
  };

  const getCompactCellValue = (merchantRates, group) => {
    const matchedRates = group.columns
      .map((column) => findMatchingRate(merchantRates, column))
      .filter(Boolean);
    if (matchedRates.length === 0) return "0 combos";
    return `${matchedRates.length} combos`;
  };

  const selectedMerchant = merchants.find((m) => getMerchantIdentifier(m) === Number(selectedMerchantId));
  const selectedFranchise = franchises.find((f) => getMerchantIdentifier(f) === Number(selectedFranchiseId));

  const filteredComboRates = selectedComboPopup?.rates.filter((rate) => {
    if (comboPopupMethod && String(rate.method || "").toLowerCase() !== comboPopupMethod.toLowerCase()) {
      return false;
    }
    if (comboPopupNetwork && String(rate.network || "").toLowerCase() !== comboPopupNetwork.toLowerCase()) {
      return false;
    }
    if (comboPopupClassification && String(rate.card_classification || "").toLowerCase() !== comboPopupClassification.toLowerCase()) {
      return false;
    }
    return true;
  }) || [];

  const renderMatrix = () => {
    if (loading) {
      return (
        <div className="flex justify-center p-8">
          <Loader />
        </div>
      );
    }

    const isFranchiseTab = activeTab === "franchise";
    const entityList = isFranchiseTab ? franchises : merchants;

    const filteredEntities = entityList.filter((entity) => {
      const entityId = getMerchantIdentifier(entity);
      const entityName = String(entity?.name || "").toLowerCase();
      const entityDisplayId = String(getEntityDisplayId(entity) || "").toLowerCase();
      const entityPhone = String(getEntityPhone(entity) || "").toLowerCase();
      const normalizedSearchTerm = searchTerm.toLowerCase();

      return (
        entityName.includes(normalizedSearchTerm) ||
        String(entityId ?? "").includes(searchTerm) ||
        entityDisplayId.includes(normalizedSearchTerm) ||
        entityPhone.includes(normalizedSearchTerm)
      );
    });

    const searchPlaceholder = isFranchiseTab
      ? "Search Franchise by Name, ID, or Phone..."
      : "Search Merchant by Name, ID, or Phone...";

    const emptyStateMessage = isFranchiseTab
      ? "No franchises found."
      : "No merchants found.";

    const totalFilteredEntities = filteredEntities.length;
    const totalMatrixPages = Math.max(1, Math.ceil(totalFilteredEntities / matrixRowsPerPage));
    const currentMatrixPage = Math.min(matrixPage, totalMatrixPages);
    const matrixStartIndex = (currentMatrixPage - 1) * matrixRowsPerPage;
    const matrixEndIndex = matrixStartIndex + matrixRowsPerPage;
    const paginatedEntities = filteredEntities.slice(matrixStartIndex, matrixEndIndex);
    const pageWindowStart = Math.max(1, currentMatrixPage - 2);
    const pageWindowEnd = Math.min(totalMatrixPages, pageWindowStart + 4);
    const visibleMatrixPages = [];

    for (let pageNumber = Math.max(1, pageWindowEnd - 4); pageNumber <= pageWindowEnd; pageNumber += 1) {
      visibleMatrixPages.push(pageNumber);
    }

    return (
      <div className="w-full pb-4">
        {/* Controls Bar */}
        <div className="p-4 bg-white border-b border-gray-200 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div className="w-full md:max-w-md">
              <input
                type="text"
                placeholder={searchPlaceholder}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-[#00D3CD] focus:border-[#00D3CD]"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="w-full md:w-auto">
              <label className="block text-sm font-medium text-gray-600 mb-1">Rows</label>
              <select
                value={matrixRowsPerPage}
                onChange={(e) => {
                  setMatrixRowsPerPage(Number(e.target.value));
                  setMatrixPage(1);
                }}
                className="w-full md:w-28 px-3 py-2 border border-gray-300 rounded-md focus:ring-[#00D3CD] focus:border-[#00D3CD]"
              >
                {[10, 20, 50].map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Mobile View */}
        <div className="block md:hidden p-4 space-y-3">
          {paginatedEntities.map((entity) => {
            const entityId = getMerchantIdentifier(entity);
            return (
              <div key={entityId} className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-[#4e73df]">{entity.name}</p>
                  </div>
                  <div className="flex flex-wrap justify-end gap-2">
                    <button
                      onClick={() => handleViewDetail(entity)}
                      className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-100"
                    >
                      View
                    </button>
                    <button
                      onClick={() => handleEditDetail(entity)}
                      className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-[#1855e4] shadow-sm transition hover:border-blue-300 hover:bg-blue-100"
                    >
                      Edit
                    </button>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <div className="rounded border border-gray-100 bg-gray-50 p-2">
                    <p className="text-[10px] uppercase tracking-wide text-gray-500">User ID</p>
                    <p className="mt-1 text-sm font-medium text-gray-900">{getEntityDisplayId(entity)}</p>
                  </div>
                  <div className="rounded border border-gray-100 bg-gray-50 p-2">
                    <p className="text-[10px] uppercase tracking-wide text-gray-500">Phone</p>
                    <p className="mt-1 text-sm font-medium text-gray-900">{getEntityPhone(entity)}</p>
                  </div>
                </div>
              </div>
            );
          })}
          {paginatedEntities.length === 0 && (
            <div className="rounded border border-gray-200 bg-white p-4 text-sm text-gray-500 text-center">
              {emptyStateMessage}
            </div>
          )}
        </div>

        {/* Desktop View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 border-collapse">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-b border-gray-200">
                  {isFranchiseTab ? "FRANCHISE" : "MERCHANT"}
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-b border-gray-200">
                  USER ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-b border-gray-200">
                  PHONE
                </th>
                <th className="px-6 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider border-b border-gray-200">
                  ACTION
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {paginatedEntities.map((entity) => {
                const entityId = getMerchantIdentifier(entity);
                return (
                  <tr key={entityId} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      <span className="text-sm font-semibold text-[#4e73df]">{entity.name}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-700">
                      {getEntityDisplayId(entity)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      {getEntityPhone(entity)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                      <div className="flex items-center justify-center gap-3">
                        <button
                          onClick={() => handleViewDetail(entity)}
                          className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-100"
                        >
                          View
                        </button>
                        <button
                          onClick={() => handleEditDetail(entity)}
                          className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-[#1855e4] shadow-sm transition hover:border-blue-300 hover:bg-blue-100"
                        >
                          Edit
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {paginatedEntities.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-4 text-center text-gray-500">
                    {emptyStateMessage}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex flex-col gap-3 px-6 py-4 md:flex-row md:items-center md:justify-between border-t border-gray-200">
          <p className="text-sm text-gray-600">
            {totalFilteredEntities > 0
              ? `Showing ${matrixStartIndex + 1}-${Math.min(matrixEndIndex, totalFilteredEntities)} of ${totalFilteredEntities}`
              : "Showing 0 results"}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setMatrixPage((prev) => Math.max(1, prev - 1))}
              disabled={currentMatrixPage <= 1}
              className="px-3 py-1.5 rounded-md border border-gray-300 text-sm text-gray-700 disabled:opacity-50 hover:bg-gray-50"
            >
              Previous
            </button>
            {visibleMatrixPages.map((pageNumber) => (
              <button
                key={pageNumber}
                type="button"
                onClick={() => setMatrixPage(pageNumber)}
                className={`px-3 py-1.5 rounded-md border text-sm ${
                  currentMatrixPage === pageNumber
                    ? "border-[#00D3CD] bg-[#00D3CD] text-white"
                    : "border-gray-300 text-gray-700 hover:bg-gray-50"
                }`}
              >
                {pageNumber}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setMatrixPage((prev) => Math.min(totalMatrixPages, prev + 1))}
              disabled={currentMatrixPage >= totalMatrixPages}
              className="px-3 py-1.5 rounded-md border border-gray-300 text-sm text-gray-700 disabled:opacity-50 hover:bg-gray-50"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderDetailTable = () => {
    const filteredRates = rates.filter(matchesSettlementFilter);
    const emptyStateMessage = settlementFilter === "all"
      ? "No rates found."
      : "No rates found for the selected settlement.";

    return (
      <div className="min-h-[400px]">
        {loadingRates ? (
          <div className="flex justify-center items-center h-64">
            <Loader />
          </div>
        ) : (
          <>
            <div className="px-4 pt-4">
              <div className="w-full md:w-56">
                <label className="block text-sm font-medium text-gray-700 mb-1">Settlement</label>
                <select
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-[#00D3CD] focus:border-[#00D3CD]"
                  value={settlementFilter}
                  onChange={(e) => setSettlementFilter(e.target.value)}
                >
                  <option value="today_settlement">Today Settlement</option>
                  <option value="next_day_settlement">Next Day Settlement</option>
                  <option value="all">All</option>
                </select>
              </div>
            </div>
            <div className="block md:hidden px-3 py-3 space-y-3">
              {filteredRates.map((rate) => {
                const marginValue =
                  editingId === rate.id
                    ? `${calculateMargin(editValue, getAdminRateValue(rate))}%`
                    : `${calculateMargin(getEditableRateValue(rate), getAdminRateValue(rate))}%`;

                const flatMarginValue =
                  editingId === rate.id
                    ? calculateFlatMargin(editFlatValue, getAdminFlatRateValue(rate))
                    : calculateFlatMargin(getEditableFlatRateValue(rate), getAdminFlatRateValue(rate));

                return (
                  <div key={rate.id} className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-lg bg-gray-50 px-2.5 py-2">
                        <p className="text-[11px] text-gray-500">Method</p>
                        <p className="text-sm font-medium text-gray-900">{rate.method}</p>
                      </div>
                      <div className="rounded-lg bg-gray-50 px-2.5 py-2">
                        <p className="text-[11px] text-gray-500">Network</p>
                        <p className="text-sm font-medium text-gray-900">{rate.network}</p>
                      </div>
                      <div className="rounded-lg bg-gray-50 px-2.5 py-2">
                        <p className="text-[11px] text-gray-500">Company</p>
                        <p className="text-sm font-medium text-gray-900 uppercase">{rate.company_name || "—"}</p>
                      </div>
                      <div className="rounded-lg bg-gray-50 px-2.5 py-2">
                        <p className="text-[11px] text-gray-500">Classification</p>
                        <p className="text-sm font-medium text-gray-900">{rate.card_classification || "ANY"}</p>
                      </div>
                      <div className="rounded-lg bg-gray-50 px-2.5 py-2">
                        <p className="text-[11px] text-gray-500">Settlement</p>
                        <p className="text-sm font-medium text-gray-900">{formatSettlementLabel(rate.settlement_type)}</p>
                      </div>
                      <div className="rounded-lg bg-gray-50 px-2.5 py-2">
                        <p className="text-[11px] text-gray-500">Amount Range</p>
                        <p className="text-sm font-medium text-gray-900">{formatAmountRange(rate)}</p>
                      </div>
                      <div className="rounded-lg bg-gray-50 px-2.5 py-2">
                        <p className="text-[11px] text-gray-500">GST (%)</p>
                        <p className="text-sm font-medium text-gray-900">{formatGstValue(rate)}</p>
                      </div>
                    </div>

                    <div className="mt-2 rounded-lg bg-gray-100/70 border border-gray-200/80 px-3 py-2 flex items-center justify-between">
                      <div>
                        <p className="text-[11px] font-semibold text-gray-600 flex items-center gap-1">
                          <Lock className="w-3 h-3 text-gray-500" />
                          {getBaseRateLabel()}
                        </p>
                        <p className="text-[10px] text-gray-500">{getBaseRateSubtext()}</p>
                      </div>
                      <span className="text-sm font-bold text-gray-800">{formatRateValue(getAdminRateValue(rate))}%</span>
                    </div>

                    <div className="mt-2 rounded-lg bg-indigo-50/50 border border-indigo-100 px-3 py-2">
                      <p className="text-[11px] font-semibold text-indigo-900">
                        {getDownlineRateLabel()}
                      </p>
                      {editingId === rate.id ? (
                        <div className="mt-1">
                          <input
                            type="number"
                            step="0.01"
                            min={getValidationTarget(rate)}
                            className={`w-full rounded border px-2 py-1.5 text-sm focus:ring-2 focus:border-transparent ${
                              validationError ? "border-red-500 focus:ring-red-500" : "border-[#00D3CD] focus:ring-[#00D3CD]"
                            }`}
                            value={editValue}
                            onChange={(e) => handleChange(e, getValidationTarget(rate), rate)}
                          />
                          {validationError && <div className="mt-1 max-w-[200px] whitespace-pre-line text-xs leading-4 text-red-500 font-medium">{validationError}</div>}
                        </div>
                      ) : (
                        <div className="flex items-center justify-between mt-1">
                          <p className="text-sm font-bold text-gray-900">
                            {formatRateValue(getEditableRateValue(rate))}%
                          </p>
                          {rate.isInherited ? (
                            <span className="text-[10px] text-gray-500 bg-gray-100 border border-gray-200 px-1.5 py-0.5 rounded">
                              Default
                            </span>
                          ) : (
                            <span className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded font-medium">
                              Configured
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="mt-2 rounded-lg bg-gray-100/70 border border-gray-200/80 px-3 py-2 flex items-center justify-between">
                      <div>
                        <p className="text-[11px] font-semibold text-gray-600 flex items-center gap-1">
                          <Lock className="w-3 h-3 text-gray-500" />
                          {getBaseFlatRateLabel()}
                        </p>
                        <p className="text-[10px] text-gray-500">{getBaseRateSubtext()}</p>
                      </div>
                      <span className="text-sm font-bold text-gray-800">₹{formatRateValue(getAdminFlatRateValue(rate))}</span>
                    </div>

                    <div className="mt-2 rounded-lg bg-indigo-50/50 border border-indigo-100 px-3 py-2">
                      <p className="text-[11px] font-semibold text-indigo-900">
                        {getDownlineFlatRateLabel()}
                      </p>
                      {editingId === rate.id ? (
                        <div className="mt-1">
                          <input
                            type="number"
                            step="0.01"
                            min={getFlatValidationTarget(rate)}
                            className={`w-full rounded border px-2 py-1.5 text-sm focus:ring-2 focus:border-transparent ${
                              flatValidationError ? "border-red-500 focus:ring-red-500" : "border-[#00D3CD] focus:ring-[#00D3CD]"
                            }`}
                            value={editFlatValue}
                            onChange={(e) => handleFlatChange(e, getFlatValidationTarget(rate), rate)}
                          />
                          {flatValidationError && (
                            <div className="mt-1 max-w-[200px] whitespace-pre-line text-xs leading-4 text-red-500 font-medium">
                              {flatValidationError}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center justify-between mt-1">
                          <p className="text-sm font-bold text-gray-900">
                            ₹{formatRateValue(getEditableFlatRateValue(rate))}
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <div className="rounded-lg bg-emerald-50/50 border border-emerald-100 px-3 py-2 flex items-center justify-between">
                        <div>
                          <p className="text-[11px] font-semibold text-emerald-800">Profit (%)</p>
                          <p className="text-[10px] text-emerald-600">Margin</p>
                        </div>
                        <p className="text-sm font-bold text-emerald-600">{marginValue}</p>
                      </div>
                      <div className="rounded-lg bg-emerald-50/50 border border-emerald-100 px-3 py-2 flex items-center justify-between">
                        <div>
                          <p className="text-[11px] font-semibold text-emerald-800">Profit (₹)</p>
                          <p className="text-[10px] text-emerald-600">Flat Margin</p>
                        </div>
                        <p className="text-sm font-bold text-emerald-600">{flatMarginValue}</p>
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2">
                      {editingId === rate.id ? (
                        <>
                          <button
                            onClick={() => handleUpdate(rate)}
                            disabled={!!validationError || !!flatValidationError}
                            className={`rounded px-3 py-2 text-sm font-semibold text-white ${
                              (validationError || flatValidationError) ? "bg-gray-400 cursor-not-allowed" : "bg-[#1cc88a] hover:bg-green-600"
                            }`}
                          >
                            Save
                          </button>
                          <button
                            onClick={handleCancel}
                            className="rounded bg-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-300"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => handleEdit(rate)}
                            className="flex-1 rounded bg-[#4e73df] px-3 py-2 text-sm font-semibold text-white hover:bg-blue-600"
                          >
                            Edit Downline Charge
                          </button>
                          {canDeleteRate(rate) && (
                            <button
                              onClick={() => handleDelete(rate)}
                              className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-100 flex items-center gap-1 shadow-sm"
                              title="Delete custom rate and reset to inherited default"
                            >
                              <Trash2 className="w-4 h-4" />
                              <span>Delete</span>
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}

              {filteredRates.length === 0 && (
                <div className="rounded-xl border border-gray-200 bg-white p-4 text-center text-sm text-gray-500">
                  {emptyStateMessage}
                </div>
              )}
            </div>
            <div className="hidden md:block overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Method</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Network</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Company</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Classification</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Settlement</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount Range</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">GST (%)</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider bg-gray-100/80 border-x border-gray-200">
                      <div className="flex items-center gap-1.5">
                        <Lock className="w-3.5 h-3.5 text-gray-500" />
                        <span>{getBaseRateLabel()}</span>
                      </div>
                      <span className="text-[10px] font-normal normal-case text-gray-500 block">{getBaseRateSubtext()}</span>
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-indigo-700 uppercase tracking-wider bg-indigo-50/60 border-r border-indigo-100">
                      <div>
                        {getDownlineRateLabel()}
                      </div>
                      <span className="text-[10px] font-normal normal-case text-indigo-500 block">Editable for Downline</span>
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider bg-gray-100/80 border-r border-gray-200">
                      <div className="flex items-center gap-1.5">
                        <Lock className="w-3.5 h-3.5 text-gray-500" />
                        <span>{getBaseFlatRateLabel()}</span>
                      </div>
                      <span className="text-[10px] font-normal normal-case text-gray-500 block">{getBaseRateSubtext()}</span>
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-indigo-700 uppercase tracking-wider bg-indigo-50/60 border-r border-indigo-100">
                      <div>
                        {getDownlineFlatRateLabel()}
                      </div>
                      <span className="text-[10px] font-normal normal-case text-indigo-500 block">Editable for Downline</span>
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-emerald-800 uppercase tracking-wider bg-emerald-50/40 border-r border-emerald-100">
                      <span>Profit Margin (%)</span>
                      <span className="text-[10px] font-normal normal-case text-emerald-600 block">Downline - Base</span>
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-emerald-800 uppercase tracking-wider bg-emerald-50/40 border-r border-emerald-100">
                      <span>Profit Flat (₹)</span>
                      <span className="text-[10px] font-normal normal-case text-emerald-600 block">Downline - Base</span>
                    </th>
                    <th className="px-5 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredRates.map((rate) => (
                    <tr key={rate.id} className="hover:bg-gray-50">
                      <td className="px-5 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">{rate.method}</td>
                      <td className="px-5 py-4 whitespace-nowrap text-sm text-gray-900">{rate.network}</td>
                      <td className="px-5 py-4 whitespace-nowrap text-sm text-gray-500 uppercase">{rate.company_name || "—"}</td>
                      <td className="px-5 py-4 whitespace-nowrap text-sm text-gray-500">{rate.card_classification || "ANY"}</td>
                      <td className="px-5 py-4 whitespace-nowrap text-sm text-gray-500">{formatSettlementLabel(rate.settlement_type)}</td>
                      <td className="px-5 py-4 whitespace-nowrap text-sm text-gray-500">{formatAmountRange(rate)}</td>
                      <td className="px-5 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatGstValue(rate)}
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap text-sm bg-gray-50/80 border-x border-gray-200">
                        <span className="inline-flex items-center gap-1.5 font-semibold text-gray-800 bg-gray-200/70 px-2.5 py-1 rounded border border-gray-300">
                          <Lock className="w-3 h-3 text-gray-500" />
                          {formatRateValue(getAdminRateValue(rate))}%
                        </span>
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap text-sm text-gray-900 bg-indigo-50/20 border-r border-indigo-100">
                        {editingId === rate.id ? (
                          <div>
                            <input
                              type="number"
                              step="0.01"
                              min={getValidationTarget(rate)}
                              className={`border rounded px-2.5 py-1 w-28 font-semibold focus:ring-2 focus:border-transparent ${
                                validationError ? "border-red-500 focus:ring-red-500" : "border-[#00D3CD] focus:ring-[#00D3CD]"
                              }`}
                              value={editValue}
                              onChange={(e) => handleChange(e, getValidationTarget(rate), rate)}
                            />
                            {validationError && (
                              <div className="mt-1 max-w-[200px] whitespace-pre-line text-xs leading-4 text-red-500 font-medium">
                                {validationError}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-gray-900">
                              {formatRateValue(getEditableRateValue(rate))}%
                            </span>
                            {rate.isInherited ? (
                              <span className="text-[11px] text-gray-500 bg-gray-100 border border-gray-200 px-1.5 py-0.5 rounded">
                                Default
                              </span>
                            ) : (
                              <span className="text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded font-medium">
                                Configured
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap text-sm bg-gray-50/80 border-r border-gray-200">
                        <span className="inline-flex items-center gap-1.5 font-semibold text-gray-800 bg-gray-200/70 px-2.5 py-1 rounded border border-gray-300">
                          <Lock className="w-3 h-3 text-gray-500" />
                          ₹{formatRateValue(getAdminFlatRateValue(rate))}
                        </span>
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap text-sm text-gray-900 bg-indigo-50/20 border-r border-indigo-100">
                        {editingId === rate.id ? (
                          <div>
                            <input
                              type="number"
                              step="0.01"
                              min={getFlatValidationTarget(rate)}
                              className={`border rounded px-2.5 py-1 w-28 font-semibold focus:ring-2 focus:border-transparent ${
                                flatValidationError ? "border-red-500 focus:ring-red-500" : "border-[#00D3CD] focus:ring-[#00D3CD]"
                              }`}
                              value={editFlatValue}
                              onChange={(e) => handleFlatChange(e, getFlatValidationTarget(rate), rate)}
                            />
                            {flatValidationError && (
                              <div className="mt-1 max-w-[200px] whitespace-pre-line text-xs leading-4 text-red-500 font-medium">
                                {flatValidationError}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-gray-900">
                              ₹{formatRateValue(getEditableFlatRateValue(rate))}
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap text-sm font-bold text-emerald-600 bg-emerald-50/10 border-r border-emerald-100">
                        {editingId === rate.id
                          ? calculateMargin(editValue, getAdminRateValue(rate))
                          : calculateMargin(getEditableRateValue(rate), getAdminRateValue(rate))}
                        %
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap text-sm font-bold text-emerald-600 bg-emerald-50/10 border-r border-emerald-100">
                        {editingId === rate.id
                          ? calculateFlatMargin(editFlatValue, getAdminFlatRateValue(rate))
                          : calculateFlatMargin(getEditableFlatRateValue(rate), getAdminFlatRateValue(rate))}
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap text-sm font-medium text-center space-x-2">
                        {detailReadOnly ? (
                          <button
                            onClick={() => {
                              setDetailReadOnly(false);
                              handleEdit(rate);
                            }}
                            className="bg-[#1855e4] px-3 py-1 rounded text-white transition-colors hover:bg-blue-700 text-xs font-semibold shadow-sm"
                          >
                            Edit
                          </button>
                        ) : editingId === rate.id ? (
                          <>
                            <button
                              onClick={() => handleUpdate(rate)}
                              disabled={!!validationError || !!flatValidationError}
                              className={`px-3 py-1 rounded transition-colors text-white ${
                                (validationError || flatValidationError) ? "bg-gray-400 cursor-not-allowed" : "bg-[#1cc88a] hover:bg-green-600"
                              } text-xs font-semibold shadow-sm`}
                            >
                              Save
                            </button>
                            <button
                              onClick={handleCancel}
                              className="text-gray-600 bg-gray-200 hover:bg-gray-300 px-3 py-1 rounded transition-colors text-xs font-semibold shadow-sm"
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <div className="inline-flex items-center gap-2">
                            <button
                              onClick={() => handleEdit(rate)}
                              className="bg-[#4e73df] px-3 py-1 rounded text-white transition-colors hover:bg-blue-600 text-xs font-semibold shadow-sm"
                            >
                              Edit
                            </button>
                            {canDeleteRate(rate) && (
                              <button
                                onClick={() => handleDelete(rate)}
                                className="bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 border border-red-200 px-2.5 py-1 rounded text-xs font-semibold inline-flex items-center gap-1 transition-colors shadow-sm"
                                title="Delete custom rate and reset to inherited default"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Delete</span>
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                  {filteredRates.length === 0 && (
                    <tr>
                      <td colSpan={13} className="px-6 py-4 text-center text-gray-500">
                        {emptyStateMessage}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    );
  };

  // The unified page content (used by both super franchise and franchise when in 'downline' mode)
  const renderDownlineContent = () => (
    <>
      {/* Header */}
      <div className="px-4 md:px-6 py-4 border-b border-gray-200 flex flex-col md:flex-row md:justify-between md:items-center gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">
            POS Transaction Charges
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            {isSuperFranchise
              ? "Default, franchise and merchant POS transaction charge settings."
              : "Default and merchant POS transaction charge settings."}
          </p>
        </div>
        {viewMode === "detail" && (activeTab === "specific" || activeTab === "franchise") && (
          <button
            onClick={handleBackToMatrix}
            className="w-full md:w-auto flex items-center justify-center text-gray-600 hover:text-gray-900 font-medium bg-white border border-gray-200 px-4 py-2 rounded shadow-sm hover:bg-gray-50 transition"
          >
            &larr; Back to List View
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="grid grid-cols-1 md:flex border-b border-gray-200">
        <button
          className={`px-4 md:px-6 py-3 text-left md:text-center font-medium text-sm focus:outline-none ${
            activeTab === "default" ? "border-b-2 border-[#00D3CD] text-[#00D3CD]" : "text-gray-500 hover:text-gray-700"
          }`}
          onClick={() => {
            setActiveTab("default");
            setViewMode("detail");
          }}
        >
          Default POS Rates
        </button>
        {isSuperFranchise && (
          <button
            className={`px-4 md:px-6 py-3 text-left md:text-center font-medium text-sm focus:outline-none ${
              activeTab === "franchise" ? "border-b-2 border-[#00D3CD] text-[#00D3CD]" : "text-gray-500 hover:text-gray-700"
            }`}
            onClick={() => {
              setActiveTab("franchise");
              setViewMode("matrix");
              setSelectedFranchiseId("");
            }}
          >
            Franchise Specific Rates
          </button>
        )}
        <button
          className={`px-4 md:px-6 py-3 text-left md:text-center font-medium text-sm focus:outline-none ${
            activeTab === "specific" ? "border-b-2 border-[#00D3CD] text-[#00D3CD]" : "text-gray-500 hover:text-gray-700"
          }`}
          onClick={() => {
            setActiveTab("specific");
            setViewMode("matrix");
            setSelectedMerchantId("");
          }}
        >
          {isSuperFranchise ? "Merchant Specific Rates" : "Specific Merchant Rates"}
        </button>
      </div>

      {/* Content */}
      <div className="p-0">
        {activeTab === "default" && renderDetailTable()}
        {activeTab === "franchise" && viewMode === "matrix" && renderMatrix()}
        {activeTab === "franchise" && viewMode === "detail" && (
          <div>
            <div className="px-4 md:px-6 py-3 bg-blue-50 border-b border-blue-100 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-blue-800">Franchise:</span>
                <span className="font-bold text-blue-900">{selectedFranchise?.name || "Unknown"}</span>
                <span className="text-xs text-blue-700">({getEntityDisplayId(selectedFranchise)} | {getEntityPhone(selectedFranchise)})</span>
                {detailReadOnly && (
                  <span className="ml-2 px-2 py-0.5 rounded text-xs bg-slate-100 border border-slate-300 text-slate-700 font-medium">
                    View Only
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={handleBackToMatrix}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50"
              >
                ← Back to List View
              </button>
            </div>
            {renderDetailTable()}
          </div>
        )}
        {activeTab === "specific" && viewMode === "matrix" && renderMatrix()}
        {activeTab === "specific" && viewMode === "detail" && (
          <div>
            <div className="px-4 md:px-6 py-3 bg-blue-50 border-b border-blue-100 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-blue-800">Merchant:</span>
                <span className="font-bold text-blue-900">{selectedMerchant?.name || "Unknown"}</span>
                <span className="text-xs text-blue-700">({getEntityDisplayId(selectedMerchant)} | {getEntityPhone(selectedMerchant)})</span>
                {detailReadOnly && (
                  <span className="ml-2 px-2 py-0.5 rounded text-xs bg-slate-100 border border-slate-300 text-slate-700 font-medium">
                    View Only
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={handleBackToMatrix}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50"
              >
                ← Back to List View
              </button>
            </div>
            {renderDetailTable()}
          </div>
        )}
      </div>
    </>
  );

  return (
    <div className="bg-gray-100 min-h-screen">
      <div className="w-full md:max-w-[95%] md:mx-auto">
        <div className="bg-white rounded-xl md:rounded-lg shadow-sm md:shadow-lg overflow-hidden">
          {renderDownlineContent()}
        </div>
      </div>
      {/* Delete Confirmation Modal */}
      {pendingDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl border border-gray-100">
            <div className="flex items-start gap-4">
              <div className="rounded-full bg-red-100 p-3 text-red-600">
                <Trash2 className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-gray-900">
                  Delete Rate Override?
                </h3>
                <p className="mt-2 text-sm text-gray-600 leading-relaxed">
                  Are you sure you want to delete this custom {isSuperFranchise ? "Super Franchise" : "Franchise"} rate for{" "}
                  <span className="font-semibold text-gray-800">
                    {pendingDelete.method} - {pendingDelete.network}
                  </span>{" "}
                  ({formatSettlementLabel(pendingDelete.settlement_type)})?
                </p>
                <p className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 p-2.5 rounded-lg">
                  This will remove your custom rate rule and revert this downline charge back to the inherited base rate of{" "}
                  <span className="font-bold">{formatRateValue(getAdminRateValue(pendingDelete))}%</span> (Flat: ₹{formatRateValue(getAdminFlatRateValue(pendingDelete))}).
                </p>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={closeDeleteModal}
                disabled={isDeleting}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={isDeleting}
                className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 transition disabled:opacity-50"
              >
                {isDeleting ? "Deleting..." : "Yes, Delete Rule"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FranchiseMerchantRateSetting;
