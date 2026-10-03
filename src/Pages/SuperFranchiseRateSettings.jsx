import React, { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import Loader from "../components/Loader";
import Table from "../components/Table";
import {
  getSuperFranchiseManagedDefaultRates,
  updateSuperFranchiseManagedDefaultRate,
  getSuperFranchiseManagedFranchiseRates,
  updateSuperFranchiseManagedFranchiseRate,
  getSuperFranchiseManagedMerchantRates,
  updateSuperFranchiseManagedMerchantRate,
  getSuperFranchiseManagedAllFranchiseRates,
  getSuperFranchiseManagedAllMerchantRates,
  getFranchises,
  getMerchants,
  listPosRentals,
  createPosRental,
  updatePosRental,
  deletePosRental,
} from "../api/rateSettingsApi";

const DEFAULT_SETTLEMENT_FILTER = "today_settlement";

const SuperFranchiseRateSettings = ({ currentUser }) => {
  const queryClient = useQueryClient();
  const currentSfId = currentUser?.id || 1;

  // Main Tabs: 'pos_rules' | 'pos_rental'
  const [mainTab, setMainTab] = useState("pos_rules");

  // Charge Rules Sub-Tabs: 'default' | 'franchises' | 'merchants'
  const [chargeSubTab, setChargeSubTab] = useState("default");

  // View mode for Franchise & Merchant subtabs: 'matrix' | 'detail'
  const [viewMode, setViewMode] = useState("detail");
  const [settlementFilter, setSettlementFilter] = useState(DEFAULT_SETTLEMENT_FILTER);

  // Selected entities for detail view
  const [franchises, setFranchises] = useState([]);
  const [merchants, setMerchants] = useState([]);
  const [selectedFranchiseId, setSelectedFranchiseId] = useState("");
  const [selectedMerchantId, setSelectedMerchantId] = useState("");

  // Rate data
  const [rates, setRates] = useState([]);
  const [matrixData, setMatrixData] = useState({});
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingRates, setLoadingRates] = useState(false);

  // Editing state
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState("");
  const [validationError, setValidationError] = useState("");

  // Rental forms state
  const [franchiseRentalForm, setFranchiseRentalForm] = useState({ amount: "", status: "active" });
  const [merchantRentalForm, setMerchantRentalForm] = useState({ amount: "", status: "active" });

  // ---------------------------------------------------------------------------
  // Queries & Mutations for POS Rentals
  // ---------------------------------------------------------------------------
  const {
    data: rentalListData,
    isLoading: rentalLoading,
    isError: rentalError,
    error: rentalErrObj,
  } = useQuery({
    queryKey: ["pos_rentals_sf"],
    queryFn: () => listPosRentals(),
    enabled: mainTab === "pos_rental",
  });

  const createRentalMutation = useMutation({
    mutationFn: createPosRental,
    onSuccess: () => queryClient.invalidateQueries(["pos_rentals_sf"]),
    onError: (error) => toast.error(error?.message || "Something went wrong"),
  });

  const updateRentalMutation = useMutation({
    mutationFn: ({ id, payload }) => updatePosRental(id, payload),
    onSuccess: () => queryClient.invalidateQueries(["pos_rentals_sf"]),
    onError: (error) => toast.error(error?.message || "Something went wrong"),
  });

  const deleteRentalMutation = useMutation({
    mutationFn: deletePosRental,
    onSuccess: () => {
      queryClient.invalidateQueries(["pos_rentals_sf"]);
    },
    onError: (error) => toast.error(error?.message || "Something went wrong"),
  });

  const rentalRates = useMemo(() => {
    const arr = Array.isArray(rentalListData?.data)
      ? rentalListData.data
      : Array.isArray(rentalListData)
      ? rentalListData
      : [];
    return arr;
  }, [rentalListData]);

  // Separate rentals by target_user_type & super_franchise_id
  const sfFranchiseRental = useMemo(
    () => rentalRates.find((r) => r.super_franchise_id === currentSfId && r.target_user_type === "franchise"),
    [rentalRates, currentSfId]
  );
  const sfMerchantRental = useMemo(
    () => rentalRates.find((r) => r.super_franchise_id === currentSfId && r.target_user_type === "merchant"),
    [rentalRates, currentSfId]
  );
  const adminRental = useMemo(
    () => rentalRates.find((r) => r.super_franchise_id === null && r.franchaise_id === null),
    [rentalRates]
  );

  useEffect(() => {
    if (sfFranchiseRental) {
      setFranchiseRentalForm({
        amount: parseFloat(sfFranchiseRental.amount) || "",
        status: sfFranchiseRental.status || "active",
      });
    }
  }, [sfFranchiseRental?.id]);

  useEffect(() => {
    if (sfMerchantRental) {
      setMerchantRentalForm({
        amount: parseFloat(sfMerchantRental.amount) || "",
        status: sfMerchantRental.status || "active",
      });
    }
  }, [sfMerchantRental?.id]);

  // ---------------------------------------------------------------------------
  // Fetching Logic for Charge Rules
  // ---------------------------------------------------------------------------
  const fetchInitialData = async () => {
    setLoading(true);
    try {
      if (chargeSubTab === "franchises") {
        const fData = await getFranchises();
        setFranchises(fData);
        const matrix = await getSuperFranchiseManagedAllFranchiseRates(fData, currentSfId);
        setMatrixData(matrix);
      } else if (chargeSubTab === "merchants") {
        const mData = await getMerchants();
        setMerchants(mData);
        const matrix = await getSuperFranchiseManagedAllMerchantRates(mData, currentSfId);
        setMatrixData(matrix);
      }
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to load network data");
    } finally {
      setLoading(false);
    }
  };

  const fetchSubTabRates = async () => {
    setLoadingRates(true);
    try {
      if (chargeSubTab === "default") {
        const data = await getSuperFranchiseManagedDefaultRates(currentSfId);
        setRates(data);
      } else if (chargeSubTab === "franchises" && selectedFranchiseId) {
        const data = await getSuperFranchiseManagedFranchiseRates(selectedFranchiseId, currentSfId);
        setRates(data);
      } else if (chargeSubTab === "merchants" && selectedMerchantId) {
        const data = await getSuperFranchiseManagedMerchantRates(selectedMerchantId, currentSfId);
        setRates(data);
      }
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to load rates");
    } finally {
      setLoadingRates(false);
    }
  };

  useEffect(() => {
    if (mainTab !== "pos_rules") return;
    setEditingId(null);
    setEditValue("");
    setValidationError("");

    if (chargeSubTab === "default") {
      fetchSubTabRates();
    } else if (chargeSubTab === "franchises") {
      if (viewMode === "detail" && selectedFranchiseId) {
        fetchSubTabRates();
      } else {
        fetchInitialData();
      }
    } else if (chargeSubTab === "merchants") {
      if (viewMode === "detail" && selectedMerchantId) {
        fetchSubTabRates();
      } else {
        fetchInitialData();
      }
    }
  }, [mainTab, chargeSubTab, viewMode, selectedFranchiseId, selectedMerchantId, currentSfId]);

  // Helpers
  const formatRateValue = (val) => {
    const num = Number(val);
    return Number.isFinite(num) ? num.toFixed(2) : "-";
  };

  const normalizeSettlementValue = (value) => String(value ?? "").trim().toLowerCase();

  const matchesSettlementFilter = (rate) =>
    settlementFilter === "all"
      ? true
      : normalizeSettlementValue(rate?.settlement_type) === settlementFilter;

  const calculateMargin = (sfRate, adminRate) => {
    if (!adminRate && adminRate !== 0) return "-";
    return (Number(sfRate) - Number(adminRate)).toFixed(2);
  };

  const handleEditRate = (rate) => {
    setEditingId(rate.id);
    setEditValue(String(rate.merchant_rate ?? rate.franchise_rate ?? rate.base_rate ?? ""));
    setValidationError("");
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditValue("");
    setValidationError("");
  };

  const handleSaveRate = async (rate) => {
    const adminRate = Number(rate.admin_rate ?? rate.base_rate ?? 0);
    const newRate = Number(editValue);

    if (newRate < adminRate) {
      toast.error(`Super Franchise rate must be greater than or equal to Admin base rate (${adminRate}%)`);
      return;
    }

    try {
      let updated;
      if (chargeSubTab === "default") {
        updated = await updateSuperFranchiseManagedDefaultRate(currentSfId, rate, { chargePercent: editValue });
      } else if (chargeSubTab === "franchises" && selectedFranchiseId) {
        updated = await updateSuperFranchiseManagedFranchiseRate(selectedFranchiseId, rate, { chargePercent: editValue }, currentSfId);
      } else if (chargeSubTab === "merchants" && selectedMerchantId) {
        updated = await updateSuperFranchiseManagedMerchantRate(selectedMerchantId, rate, { chargePercent: editValue }, currentSfId);
      }

      toast.success("Rate updated successfully");
      setRates((prev) => prev.map((r) => (r.rule_key === rate.rule_key ? { ...r, ...updated } : r)));
      setEditingId(null);
      setEditValue("");
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to update rate");
    }
  };

  // Rental Handlers
  const handleSaveFranchiseRental = (e) => {
    e.preventDefault();
    const amount = parseFloat(franchiseRentalForm.amount);
    if (!franchiseRentalForm.amount || !Number.isFinite(amount) || amount <= 0) {
      toast.error("Amount must be greater than 0");
      return;
    }
    if (sfFranchiseRental) {
      updateRentalMutation.mutate({ id: sfFranchiseRental.id, payload: { amount, status: franchiseRentalForm.status } });
    } else {
      createRentalMutation.mutate({ amount, target_user_type: "franchise", status: franchiseRentalForm.status, type: "pos" });
    }
  };

  const handleSaveMerchantRental = (e) => {
    e.preventDefault();
    const amount = parseFloat(merchantRentalForm.amount);
    if (!merchantRentalForm.amount || !Number.isFinite(amount) || amount <= 0) {
      toast.error("Amount must be greater than 0");
      return;
    }
    if (sfMerchantRental) {
      updateRentalMutation.mutate({ id: sfMerchantRental.id, payload: { amount, status: merchantRentalForm.status } });
    } else {
      createRentalMutation.mutate({ amount, target_user_type: "merchant", status: merchantRentalForm.status, type: "pos" });
    }
  };

  const filteredRates = useMemo(() => rates.filter(matchesSettlementFilter), [rates, settlementFilter]);

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">Super Franchise Rate & Rental Settings</h1>

        {/* Top-Level Tabs */}
        <div className="bg-white rounded-xl shadow-md mb-6 p-2 flex space-x-2">
          <button
            onClick={() => setMainTab("pos_rules")}
            className={`flex-1 py-3 px-6 rounded-lg font-semibold transition ${
              mainTab === "pos_rules"
                ? "bg-[#00D3CD] text-white shadow-md"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            POS Transaction Charge Rules
          </button>
          <button
            onClick={() => setMainTab("pos_rental")}
            className={`flex-1 py-3 px-6 rounded-lg font-semibold transition ${
              mainTab === "pos_rental"
                ? "bg-[#00D3CD] text-white shadow-md"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            POS Machine Rental Rates
          </button>
        </div>

        {/* Main Tab: POS Charge Rules */}
        {mainTab === "pos_rules" && (
          <div className="space-y-6">
            {/* Sub-Tabs */}
            <div className="bg-white rounded-xl shadow-sm p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex border-b md:border-b-0 space-x-4">
                <button
                  onClick={() => {
                    setChargeSubTab("default");
                    setViewMode("detail");
                  }}
                  className={`py-2 px-4 font-semibold text-sm rounded-lg transition ${
                    chargeSubTab === "default"
                      ? "bg-indigo-50 text-indigo-600 border border-indigo-200"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  Network Default Rates
                </button>
                <button
                  onClick={() => {
                    setChargeSubTab("franchises");
                    setViewMode("matrix");
                    setSelectedFranchiseId("");
                  }}
                  className={`py-2 px-4 font-semibold text-sm rounded-lg transition ${
                    chargeSubTab === "franchises"
                      ? "bg-indigo-50 text-indigo-600 border border-indigo-200"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  Franchise Rates
                </button>
                <button
                  onClick={() => {
                    setChargeSubTab("merchants");
                    setViewMode("matrix");
                    setSelectedMerchantId("");
                  }}
                  className={`py-2 px-4 font-semibold text-sm rounded-lg transition ${
                    chargeSubTab === "merchants"
                      ? "bg-indigo-50 text-indigo-600 border border-indigo-200"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  Merchant Rates
                </button>
              </div>

              {/* Settlement Filter */}
              <div className="flex items-center space-x-2">
                <label className="text-xs font-semibold text-gray-500 uppercase">Settlement:</label>
                <select
                  value={settlementFilter}
                  onChange={(e) => setSettlementFilter(e.target.value)}
                  className="px-3 py-1.5 border rounded-lg text-sm bg-white focus:ring-2 focus:ring-[#00D3CD]"
                >
                  <option value="today_settlement">Today Settlement (T0)</option>
                  <option value="next_day_settlement">Next Day Settlement (T+1)</option>
                  <option value="all">All Settlements</option>
                </select>
              </div>
            </div>

            {/* Franchise or Merchant Selector in Detail View */}
            {chargeSubTab === "franchises" && (
              <div className="bg-white p-4 rounded-xl shadow-sm flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <label className="text-sm font-semibold text-gray-700">Select Franchise:</label>
                  <select
                    value={selectedFranchiseId}
                    onChange={(e) => {
                      setSelectedFranchiseId(e.target.value);
                      setViewMode(e.target.value ? "detail" : "matrix");
                    }}
                    className="px-4 py-2 border rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500 min-w-[220px]"
                  >
                    <option value="">-- All Franchises (Matrix View) --</option>
                    {franchises.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name || f.organization_name || `Franchise #${f.id}`}
                      </option>
                    ))}
                  </select>
                </div>
                {selectedFranchiseId && (
                  <button
                    onClick={() => {
                      setSelectedFranchiseId("");
                      setViewMode("matrix");
                    }}
                    className="text-sm font-semibold text-indigo-600 hover:text-indigo-800"
                  >
                    ← Back to Matrix View
                  </button>
                )}
              </div>
            )}

            {chargeSubTab === "merchants" && (
              <div className="bg-white p-4 rounded-xl shadow-sm flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <label className="text-sm font-semibold text-gray-700">Select Merchant:</label>
                  <select
                    value={selectedMerchantId}
                    onChange={(e) => {
                      setSelectedMerchantId(e.target.value);
                      setViewMode(e.target.value ? "detail" : "matrix");
                    }}
                    className="px-4 py-2 border rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500 min-w-[220px]"
                  >
                    <option value="">-- All Merchants (Matrix View) --</option>
                    {merchants.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name || m.organization_name || `Merchant #${m.id}`}
                      </option>
                    ))}
                  </select>
                </div>
                {selectedMerchantId && (
                  <button
                    onClick={() => {
                      setSelectedMerchantId("");
                      setViewMode("matrix");
                    }}
                    className="text-sm font-semibold text-indigo-600 hover:text-indigo-800"
                  >
                    ← Back to Matrix View
                  </button>
                )}
              </div>
            )}

            {/* Matrix View for Franchises or Merchants */}
            {viewMode === "matrix" && (chargeSubTab === "franchises" || chargeSubTab === "merchants") && (
              <div className="bg-white p-6 rounded-xl shadow-md space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold text-gray-800">
                    {chargeSubTab === "franchises" ? "Franchise Rate Matrix" : "Merchant Rate Matrix"}
                  </h2>
                  <input
                    type="text"
                    placeholder="Search by Name or ID..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="px-3 py-1.5 border rounded-lg text-sm w-64"
                  />
                </div>
                {loading ? (
                  <div className="py-8 flex justify-center"><Loader /></div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 border">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Entity Name</th>
                          <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Role / ID</th>
                          <th className="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase">Configured Rates</th>
                          <th className="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase">Action</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {(chargeSubTab === "franchises" ? franchises : merchants)
                          .filter((item) =>
                            String(item.name || item.organization_name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
                            String(item.id).includes(searchTerm)
                          )
                          .map((item) => {
                            const itemRates = (matrixData[item.id] || []).filter(matchesSettlementFilter);
                            const customCount = itemRates.filter((r) => !r.isInherited).length;
                            return (
                              <tr key={item.id} className="hover:bg-gray-50">
                                <td className="px-4 py-3 text-sm font-semibold text-gray-900">
                                  {item.name || item.organization_name || `ID #${item.id}`}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-500">
                                  ID: {item.id} | {item.phone || item.mobile_number || "N/A"}
                                </td>
                                <td className="px-4 py-3 text-center text-sm">
                                  <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${
                                    customCount > 0 ? "bg-emerald-100 text-emerald-800" : "bg-gray-100 text-gray-600"
                                  }`}>
                                    {customCount > 0 ? `${customCount} Custom Overrides` : "Inherited Default"}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <button
                                    onClick={() => {
                                      if (chargeSubTab === "franchises") {
                                        setSelectedFranchiseId(item.id);
                                      } else {
                                        setSelectedMerchantId(item.id);
                                      }
                                      setViewMode("detail");
                                    }}
                                    className="px-3 py-1 bg-indigo-600 text-white text-xs font-semibold rounded hover:bg-indigo-700"
                                  >
                                    View / Edit Rates
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Detail Rate Rules Table */}
            {(viewMode === "detail" || chargeSubTab === "default") && (
              <div className="bg-white p-6 rounded-xl shadow-md space-y-4">
                <div className="flex items-center justify-between border-b pb-4">
                  <div>
                    <h2 className="text-xl font-bold text-gray-800">
                      {chargeSubTab === "default"
                        ? "Super Franchise Default Network Rates"
                        : chargeSubTab === "franchises"
                        ? `Franchise Rate Overrides`
                        : `Merchant Rate Overrides`}
                    </h2>
                    <p className="text-sm text-gray-500">
                      {chargeSubTab === "default"
                        ? "Applies to all franchises and merchants under your network unless overridden."
                        : "Configure custom charge rules for this specific entity."}
                    </p>
                  </div>
                </div>

                {loadingRates ? (
                  <div className="py-8 flex justify-center"><Loader /></div>
                ) : filteredRates.length === 0 ? (
                  <div className="p-6 text-center text-gray-500">No charge rules found for the selected filter.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 border">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Payment Mode</th>
                          <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Card Brand / Type</th>
                          <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Classification</th>
                          <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Settlement</th>
                          <th className="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase">Admin Base Rate (%)</th>
                          <th className="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase">Super Franchise Rate (%)</th>
                          <th className="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase">Margin (%)</th>
                          <th className="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase">Status</th>
                          <th className="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase">Action</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {filteredRates.map((rate) => {
                          const isEditing = editingId === rate.id;
                          const adminRateVal = formatRateValue(rate.admin_rate ?? rate.base_rate);
                          const currentSfRateVal = formatRateValue(rate.merchant_rate ?? rate.franchise_rate ?? rate.base_rate);
                          const marginVal = isEditing
                            ? calculateMargin(editValue, rate.admin_rate ?? rate.base_rate)
                            : calculateMargin(currentSfRateVal, rate.admin_rate ?? rate.base_rate);

                          return (
                            <tr key={rate.id} className="hover:bg-gray-50">
                              <td className="px-4 py-3 text-sm font-semibold text-gray-900">{rate.method}</td>
                              <td className="px-4 py-3 text-sm text-gray-600">
                                {rate.network} ({rate.card_type})
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-600">{rate.card_classification || "ANY"}</td>
                              <td className="px-4 py-3 text-sm text-gray-600 font-mono">{rate.settlement_type || "Standard"}</td>
                              <td className="px-4 py-3 text-center text-sm font-semibold text-gray-500 bg-gray-50">
                                {adminRateVal}%
                              </td>
                              <td className="px-4 py-3 text-center text-sm">
                                {isEditing ? (
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={editValue}
                                    onChange={(e) => setEditValue(e.target.value)}
                                    className="w-24 px-2 py-1 border rounded text-center focus:ring-2 focus:ring-indigo-500 font-semibold"
                                  />
                                ) : (
                                  <span className={`font-semibold ${rate.isInherited ? "text-gray-600" : "text-emerald-700"}`}>
                                    {currentSfRateVal}%
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-center text-sm font-bold text-blue-600">
                                {marginVal}%
                              </td>
                              <td className="px-4 py-3 text-center">
                                <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                                  rate.isInherited ? "bg-gray-100 text-gray-600" : "bg-emerald-100 text-emerald-800"
                                }`}>
                                  {rate.isInherited ? "Inherited Base" : "Custom Override"}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-center">
                                {isEditing ? (
                                  <div className="flex items-center justify-center space-x-2">
                                    <button
                                      onClick={() => handleSaveRate(rate)}
                                      className="px-3 py-1 bg-green-600 text-white text-xs font-semibold rounded hover:bg-green-700"
                                    >
                                      Save
                                    </button>
                                    <button
                                      onClick={handleCancelEdit}
                                      className="px-3 py-1 bg-gray-300 text-gray-700 text-xs font-semibold rounded hover:bg-gray-400"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => handleEditRate(rate)}
                                    className="px-3 py-1 bg-indigo-50 text-indigo-600 text-xs font-semibold rounded hover:bg-indigo-100 border border-indigo-200"
                                  >
                                    Edit Rate
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Main Tab: POS Machine Rental Rates */}
        {mainTab === "pos_rental" && (
          <div className="space-y-6">
            {/* Admin Base Rental (Read-Only Reference) */}
            <div className="bg-white p-4 rounded-xl shadow-md border-l-4 border-gray-400">
              <h2 className="text-md font-bold text-gray-800">Admin Platform Base Rental Rate</h2>
              <p className="text-xs text-gray-500 mb-2">Base rental charged to your Super Franchise account by Admin</p>
              <div className="text-xl font-extrabold text-gray-900">
                ₹{adminRental?.amount ? parseFloat(adminRental.amount).toFixed(2) : "0.00"} <span className="text-xs font-normal text-gray-500">/ machine / month</span>
              </div>
            </div>

            {/* Franchise Monthly Rental Form */}
            <div className="bg-white p-6 rounded-xl shadow-md border-t-4 border-indigo-600">
              <h2 className="text-lg font-bold text-gray-800 mb-1">Monthly Rental Rate for Your Franchises</h2>
              <p className="text-sm text-gray-500 mb-4">All franchises under your Super Franchise network are billed this rental amount per POS machine.</p>
              <form onSubmit={handleSaveFranchiseRental} className="flex flex-col md:flex-row items-end gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Amount (₹)</label>
                  <input
                    type="number"
                    value={franchiseRentalForm.amount}
                    onChange={(e) => setFranchiseRentalForm((p) => ({ ...p, amount: e.target.value }))}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                    placeholder="e.g. 450"
                    min="0.01"
                    step="0.01"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select
                    value={franchiseRentalForm.status}
                    onChange={(e) => setFranchiseRentalForm((p) => ({ ...p, status: e.target.value }))}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={createRentalMutation.isPending || updateRentalMutation.isPending}
                    className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-semibold disabled:opacity-50"
                  >
                    {sfFranchiseRental ? "Update Rate" : "Create Rate"}
                  </button>
                  {sfFranchiseRental && (
                    <button
                      type="button"
                      onClick={() => deleteRentalMutation.mutate(sfFranchiseRental.id)}
                      disabled={deleteRentalMutation.isPending}
                      className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 text-sm font-semibold"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </form>
            </div>

            {/* Merchant Monthly Rental Form */}
            <div className="bg-white p-6 rounded-xl shadow-md border-t-4 border-emerald-600">
              <h2 className="text-lg font-bold text-gray-800 mb-1">Monthly Rental Rate for Your Merchants</h2>
              <p className="text-sm text-gray-500 mb-4">All standalone merchants directly under your Super Franchise network are billed this rental amount per POS machine.</p>
              <form onSubmit={handleSaveMerchantRental} className="flex flex-col md:flex-row items-end gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Amount (₹)</label>
                  <input
                    type="number"
                    value={merchantRentalForm.amount}
                    onChange={(e) => setMerchantRentalForm((p) => ({ ...p, amount: e.target.value }))}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500"
                    placeholder="e.g. 350"
                    min="0.01"
                    step="0.01"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select
                    value={merchantRentalForm.status}
                    onChange={(e) => setMerchantRentalForm((p) => ({ ...p, status: e.target.value }))}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={createRentalMutation.isPending || updateRentalMutation.isPending}
                    className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-semibold disabled:opacity-50"
                  >
                    {sfMerchantRental ? "Update Rate" : "Create Rate"}
                  </button>
                  {sfMerchantRental && (
                    <button
                      type="button"
                      onClick={() => deleteRentalMutation.mutate(sfMerchantRental.id)}
                      disabled={deleteRentalMutation.isPending}
                      className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 text-sm font-semibold"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
      <ToastContainer position="top-right" autoClose={3000} hideProgressBar theme="light" />
    </div>
  );
};

export default SuperFranchiseRateSettings;
