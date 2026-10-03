import React, { useState, useEffect } from "react";
import {
  getMerchants,
  getFranchiseManagedMerchantRates,
  updateFranchiseManagedMerchantRate,
  getFranchiseManagedAllMerchantRates,
  getFranchiseManagedDefaultRates,
  updateFranchiseManagedDefaultRate,
} from "../api/rateSettingsApi";
import Loader from "../components/Loader";
import { toast } from "react-toastify";

const DEFAULT_SETTLEMENT_FILTER = "today_settlement";

const FranchiseMerchantRateSetting = ({ currentUser }) => {
  const [activeTab, setActiveTab] = useState("default"); // 'default' or 'specific'
  const [viewMode, setViewMode] = useState("detail"); // 'matrix' or 'detail'
  const [settlementFilter, setSettlementFilter] = useState(DEFAULT_SETTLEMENT_FILTER);

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
  const [validationError, setValidationError] = useState("");

  const currentFranchiseId = currentUser?.id || 1;
  const getMerchantIdentifier = (merchant) => {
    const rawId =
      merchant?.id ??
      merchant?.merchant_id ??
      merchant?.merchantId ??
      merchant?.user_id ??
      merchant?.userId;

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
    if (scope === "admin") return "Rate Set By Admin";
    return "Base Rate";
  };
  const hasEditableGst = (rate) => rate?.gst_required || rate?.gst_rate !== null && rate?.gst_rate !== undefined;
  const getAdminRateValue = (rate) => Number(rate?.admin_rate ?? rate?.base_rate ?? 0);
  const getValidationTarget = (rate) => Number(rate.admin_rate ?? rate.base_rate ?? 0);
  const getValidationMessage = (rate) => {
    if (activeTab === "default") {
      return "Franchise default rate must be\ngreater than rate set by admin";
    }
    return "Merchant rate must be\ngreater than rate set by admin";
  };
  const getBaseRateLabel = () => "Rate Set By Admin (%)";
  const getEditableRateValue = (rate) => (
    activeTab === "default"
      ? rate.merchant_rate ?? rate.franchise_rate ?? rate.base_rate
      : rate.merchant_rate
  );
  const normalizeSettlementValue = (value) => String(value ?? "").trim().toLowerCase();
  const matchesSettlementFilter = (rate) => (
    settlementFilter === "all"
      ? true
      : normalizeSettlementValue(rate?.settlement_type) === settlementFilter
  );
  const formatSettlementLabel = (value) => {
    const normalizedValue = normalizeSettlementValue(value);
    if (normalizedValue === "today_settlement") return "Today Settlement";
    if (normalizedValue === "next_day_settlement") return "Next Day Settlement";
    return value || "Any";
  };

  useEffect(() => {
    fetchInitialData();
  }, [currentFranchiseId]);

  useEffect(() => {
    setEditingId(null);
    setEditValue("");
    setValidationError("");
    setSelectedComboPopup(null);
  }, [settlementFilter]);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const merchantsData = await getMerchants(currentFranchiseId);
      setMerchants(merchantsData);
      console.info("[rate-settings][franchise-ui] merchants:loaded", {
        currentFranchiseId,
        count: merchantsData.length,
        merchants: merchantsData.map(summarizeMerchant)
      });
      console.info("[rate-settings][franchise-ui] merchants:loaded:raw", merchantsData);

      const matrix = await getFranchiseManagedAllMerchantRates(merchantsData, currentFranchiseId);
      setMatrixData(matrix);

      const defaultRates = await getFranchiseManagedDefaultRates(currentFranchiseId);
      const rateMap = new Map();

      [...defaultRates, ...Object.values(matrix).flat()].forEach((rate) => {
        if (!rateMap.has(rate.rule_key)) {
          rateMap.set(rate.rule_key, rate);
        }
      });

      setDefaultColumnStructure(Array.from(rateMap.values()));
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to load initial data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setEditingId(null);
    setEditValue("");
    setValidationError("");

    const scrollContainer = document.getElementById("main-content");
    if (scrollContainer) {
      scrollContainer.scrollTop = 0;
    } else {
      window.scrollTo(0, 0);
    }

    if (activeTab === "default") {
      fetchRates(currentFranchiseId);
    } else if (activeTab === "specific") {
      if (viewMode === "detail" && selectedMerchantId) {
        fetchRates(selectedMerchantId);
      } else {
        fetchInitialData();
      }
    }
  }, [activeTab, viewMode, selectedMerchantId]);

  const fetchRates = async (id) => {
    setLoadingRates(true);
    try {
      if (activeTab === "specific") {
        console.info("[rate-settings][franchise-ui] merchant-rates:load:start", {
          currentFranchiseId,
          selectedMerchantId: id,
          selectedMerchant: summarizeMerchant(
            merchants.find((merchant) => getMerchantIdentifier(merchant) === Number(id))
          )
        });
      }
      const data = activeTab === "default"
        ? await getFranchiseManagedDefaultRates(id)
        : await getFranchiseManagedMerchantRates(id, currentFranchiseId);
      if (activeTab === "specific") {
        console.info("[rate-settings][franchise-ui] merchant-rates:load:success", {
          currentFranchiseId,
          selectedMerchantId: id,
          count: data.length,
          sample: data.slice(0, 5)
        });
      }
      console.log("[rate-settings][fetchRates] raw fetched data", data);
      setRates(data);
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to load rates");
    } finally {
      setLoadingRates(false);
    }
  };

  const handleEditDetail = (merchant) => {
    const merchantId = getMerchantIdentifier(merchant);
    if (merchantId === null) {
      console.error("[rate-settings][franchise-ui] merchant:selected:missing-id", {
        currentFranchiseId,
        merchant,
        merchantSummary: summarizeMerchant(merchant)
      });
      toast.error("Merchant ID is missing. Check merchant payload in console.");
      return;
    }
    console.info("[rate-settings][franchise-ui] merchant:selected", {
      currentFranchiseId,
      merchant: summarizeMerchant(merchant),
      selectedMerchantId: merchantId
    });
    setSelectedMerchantId(merchantId);
    setViewMode("detail");
  };

  const handleBackToMatrix = () => {
    setSelectedMerchantId("");
    setViewMode("matrix");
    fetchInitialData();
  };

  const handleEdit = (rate) => {
    setEditingId(rate.id);
    setEditValue(String(getEditableRateValue(rate) ?? ""));
    setValidationError("");
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditValue("");
    setValidationError("");
  };

  const handleChange = (e, baseRate) => {
    const val = e.target.value;
    setEditValue(val);
    if (Number(val) <= Number(baseRate)) {
      setValidationError(getValidationMessage({}));
    } else {
      setValidationError("");
    }
  };

  const handleUpdate = async (rate) => {
    const threshold = getValidationTarget(rate);
    if (Number(editValue) <= threshold) {
      toast.error(getValidationMessage(rate));
      return;
    }

    try {
      const selectedMerchantRecord = activeTab === "specific"
        ? merchants.find((merchant) => getMerchantIdentifier(merchant) === Number(selectedMerchantId))
        : null;
      const updates = {
        chargePercent: editValue
      };

      console.info("[rate-settings][franchise-ui] update:start", {
        activeTab,
        viewMode,
        currentFranchiseId,
        selectedMerchantId,
        threshold,
        editValue,
        updates,
        selectedMerchant: selectedMerchantRecord ? summarizeMerchant(selectedMerchantRecord) : null,
        rate: {
          id: rate?.id,
          rule_id: rate?.rule_id,
          rule_key: rate?.rule_key,
          isInherited: rate?.isInherited,
          source_scope: rate?.source_scope,
          base_source_scope: rate?.base_source_scope,
          base_rate: rate?.base_rate,
          admin_rate: rate?.admin_rate,
          merchant_rate: rate?.merchant_rate,
          franchiseId: rate?.franchiseId,
          franchaise_id: rate?.franchaise_id,
          merchantId: rate?.merchantId,
          method: rate?.method,
          network: rate?.network,
          card_type: rate?.card_type,
          card_classification: rate?.card_classification
        }
      });

      const updatedRate = activeTab === "default"
        ? await updateFranchiseManagedDefaultRate(currentFranchiseId, rate, updates)
        : await updateFranchiseManagedMerchantRate(
            selectedMerchantId,
            rate,
            updates,
            currentFranchiseId
          );
      console.info("[rate-settings][franchise-ui] update:success", {
        activeTab,
        currentFranchiseId,
        selectedMerchantId,
        updatedRate
      });
      toast.success("Rate updated successfully");
      setRates((prevRates) =>
        prevRates.map((r) => (r.rule_key === rate.rule_key ? { ...r, ...updatedRate } : r))
      );
      if (activeTab === "specific" && selectedMerchantId) {
        setMatrixData((prevMatrix) => ({
          ...prevMatrix,
          [selectedMerchantId]: (prevMatrix[selectedMerchantId] || []).map((r) =>
            r.rule_key === rate.rule_key ? { ...r, ...updatedRate } : r
          )
        }));
      }
      setEditingId(null);
      setEditValue("");
    } catch (error) {
      console.error("[rate-settings][franchise-ui] update:error", {
        activeTab,
        viewMode,
        currentFranchiseId,
        selectedMerchantId,
        threshold,
        editValue,
        message: error?.message,
        status: error?.response?.status,
        responseData: error?.response?.data || null
      });
      toast.error("Failed to update rate: " + (error.response?.data?.message || error.message));
    }
  };

  const calculateMargin = (merchantRate, baseRate) => {
    if (!baseRate && activeTab === "default") return "-";
    return (Number(merchantRate) - Number(baseRate)).toFixed(2);
  };

  const formatRateValue = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed.toFixed(2) : "-";
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

  const openComboPopup = (merchant, group, matchedRates) => {
    setComboPopupMethod("");
    setComboPopupNetwork("");
    setComboPopupClassification("");
    console.log("[rate-settings][combo-popup] opening combo popup", {
      merchant,
      group,
      matchedRates
    });
    setSelectedComboPopup({ merchant, group, rates: matchedRates });
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

    const filteredMerchants = merchants.filter((merchant) => {
      const merchantId = getMerchantIdentifier(merchant);
      const merchantName = String(merchant?.name || "").toLowerCase();
      const merchantPhone = String(merchant?.phone || "");
      const normalizedSearchTerm = searchTerm.toLowerCase();

      return (
        merchantName.includes(normalizedSearchTerm) ||
        String(merchantId ?? "").includes(searchTerm) ||
        merchantPhone.includes(searchTerm)
      );
    });

    const filteredColumns = defaultColumnStructure.filter(matchesSettlementFilter);
    const groupedColumns = buildGroupedColumns(filteredColumns);
    const selectedGroup = selectedComboGroupKey
      ? groupedColumns.find((group) => group.key === selectedComboGroupKey)
      : null;
    const displayedMatrixColumns = !compactColumnMode
      ? filteredColumns
      : selectedGroup
        ? selectedGroup.columns
        : groupedColumns;
    const emptySettlementMessage = settlementFilter === "all"
      ? "No rate combos found."
      : "No rate combos found for the selected settlement.";

    return (
      <div className="w-full pb-4">
        <div className="bg-white border-b border-gray-200 px-4 py-4 shadow-sm space-y-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex flex-col gap-3 md:flex-row md:items-end">
              <input
                type="text"
                placeholder="Search Merchant by Name, ID, or Phone..."
                className="w-full md:min-w-[320px] md:max-w-md px-4 py-2 border border-gray-300 rounded-md focus:ring-[#00D3CD] focus:border-[#00D3CD]"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
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
            <button
              type="button"
              onClick={() => setCompactColumnMode((prev) => !prev)}
              className="inline-flex items-center justify-center rounded-md border border-[#00D3CD] bg-white px-4 py-2 text-sm font-medium text-[#0f766e] hover:bg-[#ecfdf5]"
            >
              {compactColumnMode ? 'Expanded columns' : 'Collapsed combos'}
            </button>
          </div>
          <div className="rounded-lg border border-[#d1f2ef] bg-[#f2fbf9] px-4 py-3 text-sm text-[#0f766e]">
            <p className="font-semibold">Matrix mode</p>
            <p className="mt-1">
              {compactColumnMode
                ? 'Columns are grouped by network + method to reduce horizontal width. Use the detail view for individual combos.'
                : 'Full combo mode shows every rate combination separately.'}
            </p>
          </div>
        </div>

        {selectedGroup && (
          <div className="bg-blue-50 border border-blue-100 px-4 py-3 text-sm text-blue-900">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="font-semibold">Showing combos for:</p>
                <p>{selectedGroup.network} {selectedGroup.method} — {selectedGroup.columns.length} combos</p>
              </div>
              <button
                type="button"
                onClick={clearSelectedComboGroup}
                className="rounded-md border border-blue-200 bg-white px-3 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-50"
              >
                Show all groups
              </button>
            </div>
          </div>
        )}
        {displayedMatrixColumns.length === 0 ? (
          <div className="px-4 py-6">
            <div className="rounded-xl border border-gray-200 bg-white p-4 text-center text-sm text-gray-500">
              {emptySettlementMessage}
            </div>
          </div>
        ) : (
          <>
            <div className="block md:hidden px-3 py-3 space-y-3">
              {filteredMerchants.map((merchant) => {
                const merchantId = getMerchantIdentifier(merchant);
                const merchantRates = (matrixData[merchantId] || []).filter(matchesSettlementFilter);
                return (
                  <div key={merchantId} className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-[#4e73df]">{merchant.name}</p>
                        <p className="text-xs text-gray-500">ID: {merchantId}</p>
                        <p className="text-xs text-gray-500">Ph: {merchant.phone || "N/A"}</p>
                      </div>
                      <button
                        onClick={() => handleEditDetail(merchant)}
                        className="rounded-md border border-blue-100 px-2.5 py-1 text-xs font-semibold text-[#4e73df] hover:text-blue-800"
                      >
                        Edit
                      </button>
                    </div>

                    <div className="mt-3 space-y-2">
                      {filteredColumns.map((attr, idx) => {
                        const rate = findMatchingRate(merchantRates, attr);
                        return (
                          <div
                            key={`merchant-rate-${merchantId}-${attr.rule_key || idx}`}
                            className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-3 py-2"
                          >
                            <p className="text-[11px] font-medium leading-4 text-gray-600">
                              {attr.network} {attr.method}
                            </p>
                            <p className="max-w-[65%] text-[10px] leading-4 text-gray-400">{getRateMetaLine(attr)}</p>
                            <span className="rounded-full bg-gray-900 px-2.5 py-1 text-[11px] font-semibold text-white">
                              {rate ? `${formatRateValue(rate.merchant_rate)}%` : "-"}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {filteredMerchants.length === 0 && (
                <div className="rounded-xl border border-gray-200 bg-white p-4 text-center text-sm text-gray-500">
                  No merchants found.
                </div>
              )}
            </div>

            <div className="hidden md:block overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 border-collapse">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider sticky left-0 bg-gray-50 z-10 border-b border-gray-200">
                      Merchant
                    </th>
                    {displayedMatrixColumns.map((group, idx) => {
                      const isGrouped = compactColumnMode && !selectedComboGroupKey;
                      const title = `${group.network}`;
                      const subtitle = group.method;
                      return (
                        <th
                          key={`col-${isGrouped ? `${group.key}` : group.rule_key || idx}`}
                          className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-200 min-w-[180px]"
                        >
                          {title} <br />
                          <span className="text-[10px] text-gray-400">{subtitle}</span>
                          {isGrouped && (
                            <div className="mt-1 text-[10px] normal-case text-gray-400">
                              {group.columns.length} combos
                            </div>
                          )}
                          {!isGrouped && (
                            <div className="mt-1 text-[10px] normal-case text-gray-400">{getRateMetaLine(group)}</div>
                          )}
                        </th>
                      );
                    })}
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider border-b border-gray-200">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredMerchants.map((merchant) => {
                    const merchantId = getMerchantIdentifier(merchant);
                    const merchantRates = (matrixData[merchantId] || []).filter(matchesSettlementFilter);
                    return (
                      <tr key={merchantId} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900 sticky left-0 bg-white z-10 border-r border-gray-100 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                          <div className="flex flex-col">
                            <span className="text-base font-semibold text-[#4e73df]">{merchant.name}</span>
                            <span className="text-xs text-gray-500">ID: {merchantId}</span>
                            <span className="text-xs text-gray-500">Ph: {merchant.phone || "N/A"}</span>
                          </div>
                        </td>
                        {displayedMatrixColumns.map((group, idx) => {
                          const isGrouped = compactColumnMode && !selectedComboGroupKey;
                          const cellValue = isGrouped
                            ? getCompactCellValue(merchantRates, group)
                            : (() => {
                                const rate = findMatchingRate(merchantRates, group);
                                return rate ? `${formatRateValue(rate.merchant_rate)}%` : "-";
                              })();
                          return (
                            <td key={`cell-${merchantId}-${isGrouped ? group.key : group.rule_key || idx}`} className="px-4 py-4 whitespace-nowrap text-sm text-center text-gray-700">
                              {isGrouped ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const matchedRates = group.columns
                                      .map((column) => findMatchingRate(merchantRates, column))
                                      .filter(Boolean);
                                    openComboPopup(merchant, group, matchedRates);
                                  }}
                                  className="rounded-md border border-[#e2e8f0] bg-white px-3 py-1 text-xs font-semibold text-[#2563eb] hover:bg-[#eff6ff]"
                                >
                                  {cellValue}
                                </button>
                              ) : (
                                cellValue
                              )}
                            </td>
                          );
                        })}
                        <td className="px-4 py-4 whitespace-nowrap text-center text-sm font-medium">
                          <button
                            onClick={() => handleEditDetail(merchant)}
                            className="text-[#4e73df] hover:text-blue-800 font-semibold"
                          >
                            Edit
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
        {selectedComboPopup && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-3xl overflow-hidden rounded-3xl bg-white shadow-2xl">
              <div className="flex flex-col gap-3 border-b px-6 py-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-lg font-semibold text-gray-900">{selectedComboPopup.group.network} {selectedComboPopup.group.method}</p>
                  <p className="text-sm text-gray-500">{selectedComboPopup.group.columns.length} combo rates for {selectedComboPopup.merchant.name}</p>
                </div>
                <button
                  type="button"
                  onClick={closeComboPopup}
                  className="rounded-md border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Close
                </button>
              </div>
              <div className="max-h-[70vh] overflow-y-auto px-6 py-5">
                <div className="grid gap-4 md:grid-cols-4 mb-4">
                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-600">Method</label>
                    <select
                      value={comboPopupMethod}
                      onChange={(e) => setComboPopupMethod(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-[#00D3CD] focus:outline-none focus:ring-2 focus:ring-[#00D3CD]/20"
                    >
                      <option value="">All Methods</option>
                      {Array.from(new Set((selectedComboPopup?.rates || []).map((rate) => rate.method || ""))).filter(Boolean).map((method) => (
                        <option key={method} value={method}>{method}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-600">Brand</label>
                    <select
                      value={comboPopupNetwork}
                      onChange={(e) => setComboPopupNetwork(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-[#00D3CD] focus:outline-none focus:ring-2 focus:ring-[#00D3CD]/20"
                    >
                      <option value="">All Brands</option>
                      {Array.from(new Set((selectedComboPopup?.rates || []).map((rate) => rate.network || ""))).filter(Boolean).map((network) => (
                        <option key={network} value={network}>{network}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-600">Classification</label>
                    <select
                      value={comboPopupClassification}
                      onChange={(e) => setComboPopupClassification(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-[#00D3CD] focus:outline-none focus:ring-2 focus:ring-[#00D3CD]/20"
                    >
                      <option value="">All Classifications</option>
                      {Array.from(new Set((selectedComboPopup?.rates || []).map((rate) => rate.card_classification || ""))).filter(Boolean).map((classification) => (
                        <option key={classification} value={classification}>{classification}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  {filteredComboRates.length > 0 ? filteredComboRates.map((rate) => (
                    <div key={rate.rule_key || rate.id} className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                      <p className="text-sm font-semibold text-gray-900">{rate.method || 'CARD'} | {rate.network || 'VISA'} | {rate.card_classification || 'ANY'}</p>
                      <div className="mt-3 space-y-2 text-sm text-gray-600">
                        <div className="flex justify-between">
                          <span>Merchant Rate</span>
                          <span className="font-semibold text-gray-900">{formatRateValue(rate.merchant_rate)}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Admin Rate</span>
                          <span className="font-semibold text-gray-900">{formatRateValue(getAdminRateValue(rate))}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span>GST</span>
                          <span className="font-semibold text-gray-900">{formatGstValue(rate)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Profit Margin</span>
                          <span className="font-semibold text-gray-900">{calculateMargin(getEditableRateValue(rate), getAdminRateValue(rate))}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Settlement</span>
                          <span className="font-semibold text-gray-900">{rate.settlement_type || 'N/A'}</span>
                        </div>
                      </div>
                    </div>
                  )) : (
                    <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-6 text-center text-sm text-gray-500">
                      No combo rates available for this group.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
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
                        <p className="text-[11px] text-gray-500">GST (%)</p>
                        <p className="text-sm font-medium text-gray-900">{formatGstValue(rate)}</p>
                      </div>
                    </div>

                    {activeTab === "default" && (
                      <div className="mt-2 rounded-lg bg-gray-50 px-3 py-2">
                        <p className="text-[11px] text-gray-500">{getBaseRateLabel(rate)}</p>
                        <p className="text-sm font-semibold text-gray-900">{formatRateValue(getAdminRateValue(rate))}%</p>
                      </div>
                    )}

                    {activeTab === "specific" && (
                      <div className="mt-2 rounded-lg bg-gray-50 px-3 py-2">
                        <p className="text-[11px] text-gray-500">{getBaseRateLabel(rate)}</p>
                        <p className="text-sm font-semibold text-gray-900">{formatRateValue(getAdminRateValue(rate))}%</p>
                      </div>
                    )}

                    <div className="mt-2 rounded-lg bg-gray-50 px-3 py-2">
                      <p className="text-[11px] text-gray-500">
                        {activeTab === "default" ? "Default Merchant Rate (%)" : "Merchant Rate (%)"}
                      </p>
                      {editingId === rate.id ? (
                        <div className="mt-1">
                          <input
                            type="number"
                            step="0.01"
                            className={`w-full rounded border px-2 py-1.5 text-sm focus:ring-2 focus:border-transparent ${
                              validationError ? "border-red-500 focus:ring-red-500" : "border-gray-300 focus:ring-[#00D3CD]"
                            }`}
                            value={editValue}
                            onChange={(e) => handleChange(e, getValidationTarget(rate))}
                          />
                          {validationError && <div className="mt-1 max-w-[200px] whitespace-pre-line text-xs leading-4 text-red-500">{validationError}</div>}
                        </div>
                        ) : (
                          <p className="text-sm font-semibold text-gray-900 mt-0.5">
                          {formatRateValue(getEditableRateValue(rate))}%
                          {rate.isInherited && activeTab === "specific" && (
                            <span className="ml-1 text-xs text-gray-400 italic">(Default)</span>
                          )}
                        </p>
                      )}
                    </div>

                    {hasEditableGst(rate) && (
                      <div className="mt-2 rounded-lg bg-gray-50 px-3 py-2">
                        <p className="text-[11px] text-gray-500">GST (%)</p>
                        <p className="text-sm font-semibold text-gray-900 mt-0.5">{formatGstValue(rate)}</p>
                      </div>
                    )}

                    {activeTab === "specific" && (
                      <div className="mt-2 rounded-lg bg-gray-50 px-3 py-2">
                        <p className="text-[11px] text-gray-500">Profit Margin (%)</p>
                        <p className="text-sm font-semibold text-gray-900">{marginValue}</p>
                      </div>
                    )}

                    <div className="mt-3 grid grid-cols-2 gap-2">
                      {editingId === rate.id ? (
                        <>
                          <button
                            onClick={() => handleUpdate(rate)}
                            disabled={!!validationError}
                            className={`rounded px-3 py-2 text-sm font-semibold text-white ${
                              validationError ? "bg-gray-400 cursor-not-allowed" : "bg-[#1cc88a] hover:bg-green-600"
                            }`}
                          >
                            Update
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
                            className="col-span-2 rounded bg-[#4e73df] px-3 py-2 text-sm font-semibold text-white hover:bg-blue-600"
                          >
                            Edit
                          </button>
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
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Method</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Network</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Company</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Classification</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Settlement</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">GST (%)</th>
                    {activeTab === "default" && (
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rate Set By Admin (%)</th>
                    )}
                    {activeTab === "specific" && (
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rate Set By Admin (%)</th>
                    )}
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {activeTab === "default" ? "Default Merchant Rate (%)" : "Merchant Rate (%)"}
                    </th>
                    {activeTab === "specific" && (
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Profit Margin (%)</th>
                    )}
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredRates.map((rate) => (
                    <tr key={rate.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{rate.method}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{rate.network}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 uppercase">{rate.company_name || "—"}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{rate.card_classification || "ANY"}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatSettlementLabel(rate.settlement_type)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatGstValue(rate)}
                      </td>
                      {activeTab === "default" && (
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatRateValue(getAdminRateValue(rate))}%</td>
                      )}
                      {activeTab === "specific" && (
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatRateValue(getAdminRateValue(rate))}%</td>
                      )}
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {editingId === rate.id ? (
                          <div>
                            <input
                              type="number"
                              step="0.01"
                              className={`border rounded px-2 py-1 w-24 focus:ring-2 focus:border-transparent ${
                                validationError ? "border-red-500 focus:ring-red-500" : "border-gray-300 focus:ring-[#00D3CD]"
                              }`}
                              value={editValue}
                              onChange={(e) => handleChange(e, getValidationTarget(rate))}
                            />
                            {validationError && <div className="mt-1 max-w-[200px] whitespace-pre-line text-xs leading-4 text-red-500">{validationError}</div>}
                          </div>
                        ) : (
                          <span>
                            {formatRateValue(getEditableRateValue(rate))}%{" "}
                            {rate.isInherited && activeTab === "specific" && (
                              <span className="text-xs text-gray-400 italic">(Default)</span>
                            )}
                          </span>
                        )}
                      </td>
                      {activeTab === "specific" && (
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                          {editingId === rate.id
                            ? calculateMargin(editValue, getAdminRateValue(rate))
                            : calculateMargin(getEditableRateValue(rate), getAdminRateValue(rate))}
                          %
                        </td>
                      )}
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                        {editingId === rate.id ? (
                          <>
                            <button
                              onClick={() => handleUpdate(rate)}
                              disabled={!!validationError}
                              className={`px-3 py-1 rounded transition-colors text-white ${
                                validationError ? "bg-gray-400 cursor-not-allowed" : "bg-[#1cc88a] hover:bg-green-600"
                              }`}
                            >
                              Update
                            </button>
                            <button
                              onClick={handleCancel}
                              className="text-gray-600 bg-gray-200 hover:bg-gray-300 px-3 py-1 rounded transition-colors"
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => handleEdit(rate)}
                            className="bg-[#4e73df] px-3 py-1 rounded text-white transition-colors hover:bg-blue-600"
                          >
                            Edit
                          </button>
                        )}
                      </td>
                  </tr>
                  ))}
                  {filteredRates.length === 0 && (
                    <tr>
                      <td colSpan={activeTab === "specific" ? 9 : 8} className="px-6 py-4 text-center text-gray-500">
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

  return (
    <div className="bg-gray-100 min-h-screen">
      <div className="w-full md:max-w-[95%] md:mx-auto">
        <div className="bg-white rounded-xl md:rounded-lg shadow-sm md:shadow-lg overflow-hidden">
          <div className="px-4 md:px-6 py-4 border-b border-gray-200 flex flex-col md:flex-row md:justify-between md:items-center gap-3">
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-gray-900">POS charges for you and your merchant</h1>
              <p className="text-sm text-gray-600 mt-1">Set Merchant Rates and View Profit Margins</p>
            </div>
            {viewMode === "detail" && activeTab === "specific" && (
              <button
                onClick={handleBackToMatrix}
                className="w-full md:w-auto flex items-center justify-center text-gray-600 hover:text-gray-900 font-medium bg-white border border-gray-200 px-4 py-2 rounded shadow-sm"
              >
                &larr; Back to Matrix View
              </button>
            )}
          </div>

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
              Default Rates
            </button>
            <button
              className={`px-4 md:px-6 py-3 text-left md:text-center font-medium text-sm focus:outline-none ${
                activeTab === "specific" ? "border-b-2 border-[#00D3CD] text-[#00D3CD]" : "text-gray-500 hover:text-gray-700"
              }`}
              onClick={() => {
                setActiveTab("specific");
                setViewMode("matrix");
              }}
            >
              Specific Merchant Rates (Matrix)
            </button>
          </div>

          <div className="p-0">
            {activeTab === "default" && renderDetailTable()}
            {activeTab === "specific" && viewMode === "matrix" && renderMatrix()}
            {activeTab === "specific" && viewMode === "detail" && (
              <div>
                <div className="px-4 md:px-6 py-3 bg-blue-50 border-b border-blue-100 flex items-center">
                  <span className="font-semibold text-blue-800">Merchant:</span>
                  <span className="ml-2 text-blue-900">{selectedMerchant?.name || "Unknown"}</span>
                </div>
                {renderDetailTable()}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FranchiseMerchantRateSetting;
