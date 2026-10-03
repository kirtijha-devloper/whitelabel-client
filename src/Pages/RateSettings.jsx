import React, { useMemo, useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Table from "../components/Table";
import { Loader2 } from "lucide-react";
import { MerchantAllUsers } from "../api/FranchiseApi";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import {
  createPosRental,
  listPosRentals,
  createPayoutCharge,
  listPayoutCharges,
  getPayoutChargeById,
  updatePayoutCharge,
  deletePayoutCharge,
  updatePosRental,
  deletePosRental,
  createPosTransactionCharge,
  listPosTransactionCharges,
  getPosTransactionChargeById,
  updatePosTransactionCharge,
  deletePosTransactionCharge,
  listBbpsChargeRules,
  createBbpsChargeRule,
  updateBbpsChargeRule,
  deleteBbpsChargeRule,
} from "../api/rateSettingsApi";
import PayoutRateSettings from "./PayoutRateSettings";

const RateSettings = ({ hideTabs = false, initialTab = "pos_rental" }) => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState(initialTab); // pos_rental | pos_txn | payout | bbps_cc

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  useEffect(() => {
    // Only force POS rental when tabs are hidden and no other tab is explicitly requested.
    if (hideTabs && initialTab === "pos_rental") {
      setActiveTab("pos_rental");
    }
  }, [hideTabs, initialTab]);

  // Shared merchant list
  const {
    data: merchantsData,
    isLoading: merchantsLoading,
    isError: merchantsError,
    error: merchantsErrObj,
  } = useQuery({
    queryKey: ["merchants", "active"],
    queryFn: () => MerchantAllUsers({ page: 1, limit: 1000 }), // Get all merchants for dropdown
  });

  // Extract merchants array from paginated response
  const merchants = useMemo(() => {
    if (!merchantsData) return [];
    if (Array.isArray(merchantsData)) return merchantsData;
    return Array.isArray(merchantsData.data) ? merchantsData.data : [];
  }, [merchantsData]);

  // POS Rental state — Admin: two independent cards (franchise rate + standalone merchant rate)
  const [franchiseRateForm, setFranchiseRateForm] = useState({ amount: "", status: "active" });
  const [merchantRateForm, setMerchantRateForm] = useState({ amount: "", status: "active" });

  const {
    data: rentalListData,
    isLoading: rentalLoading,
    isError: rentalError,
    error: rentalErrObj,
  } = useQuery({
    queryKey: ["pos_rentals"],
    queryFn: listPosRentals,
    enabled: activeTab === "pos_rental",
  });

  const createRentalMutation = useMutation({
    mutationFn: createPosRental,
    onSuccess: () => queryClient.invalidateQueries(["pos_rentals"]),
    onError: (error) => toast.error(error?.message || "Something went wrong"),
  });

  const updateRentalMutation = useMutation({
    mutationFn: ({ id, payload }) => updatePosRental(id, payload),
    onSuccess: () => queryClient.invalidateQueries(["pos_rentals"]),
    onError: (error) => toast.error(error?.message || "Something went wrong"),
  });

  const deleteRentalMutation = useMutation({
    mutationFn: deletePosRental,
    onSuccess: () => queryClient.invalidateQueries(["pos_rentals"]),
    onError: (error) => toast.error(error?.message || "Something went wrong"),
  });

  const formatCurrency = (val) => {
    if (val === undefined || val === null || val === "") return "-";
    const num = Number(val);
    if (Number.isNaN(num)) return val;
    return `₹${num.toFixed(2)}`;
  };

  const formatPercent = (val) => {
    if (val === undefined || val === null || val === "") return "-";
    const num = Number(val);
    if (Number.isNaN(num)) return `${val}%`;
    return `${num.toFixed(2)}%`;
  };

  // Payout charges state
  const [payoutForm, setPayoutForm] = useState({
    from_amount: "",
    to_amount: "",
    rate: "",
    rate_type: "flat",
    is_active: true,
    description: "",
  });
  const [payoutEditingId, setPayoutEditingId] = useState(null);

  const {
    data: payoutRulesData = [],
    isLoading: payoutLoading,
    isError: payoutError,
  } = useQuery({
    queryKey: ["payout_charges"],
    queryFn: listPayoutCharges,
    enabled: activeTab === "payout",
  });

  const createPayoutMutation = useMutation({
    mutationFn: createPayoutCharge,
    onSuccess: () => {
      queryClient.invalidateQueries(["payout_charges"]);
      setPayoutForm({ from_amount: "", to_amount: "", rate: "", rate_type: "flat", is_active: true, description: "" });
      setPayoutEditingId(null);
    },
    onError: (error) => toast.error(error?.message || "Something went wrong"),
  });

  const updatePayoutMutation = useMutation({
    mutationFn: ({ id, payload }) => updatePayoutCharge(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries(["payout_charges"]);
      setPayoutEditingId(null);
      setPayoutForm({ from_amount: "", to_amount: "", rate: "", rate_type: "flat", is_active: true, description: "" });
    },
    onError: (error) => toast.error(error?.message || "Something went wrong"),
  });

  const deletePayoutMutation = useMutation({
    mutationFn: deletePayoutCharge,
    onSuccess: () => {
      queryClient.invalidateQueries(["payout_charges"]);
    },
    onError: (error) => toast.error(error?.message || "Something went wrong"),
  });

  const payoutColumns = [
    { header: "From (₹)", key: "from_amount", render: (val) => formatCurrency(val) },
    { header: "To (₹)", key: "to_amount", render: (val) => formatCurrency(val) },
    { header: "Rate", key: "rate", render: (val, row) => row?.rate_type === "percentage" ? formatPercent(val) : formatCurrency(val) },
    { header: "Type", key: "rate_type", render: (val) => val === "flat" ? "Flat" : "Percentage" },
    { header: "Status", key: "is_active", render: (val) => val ? "Active" : "Inactive" },
    { header: "Description", key: "description" },
  ];

  // POS Transaction Charge state
  const [posTxnForm, setPosTxnForm] = useState({
    merchant_id: "",
    method: "card",
    network: "visa",
    card_type: "credit",
    subtype: "domestic",
    rate_percentage: "",
  });
  const [editingTxnChargeId, setEditingTxnChargeId] = useState(null);

  const [bbpsForm, setBbpsForm] = useState({
    from_amount: "",
    to_amount: "",
    rate: "",
    rate_type: "flat",
    is_active: true,
  });
  const [bbpsEditingId, setBbpsEditingId] = useState(null);

  const {
    data: posTxnList = [],
    isLoading: posTxnLoading,
    isError: posTxnError,
    error: posTxnErrObj,
  } = useQuery({
    queryKey: ["pos_transaction_charges"],
    queryFn: listPosTransactionCharges,
    enabled: activeTab === "pos_txn",
  });

  const createPosTxnMutation = useMutation({
    mutationFn: createPosTransactionCharge,
    onSuccess: () => {
      queryClient.invalidateQueries(["pos_transaction_charges"]);
      setPosTxnForm({ merchant_id: "", method: "card", network: "visa", card_type: "credit", subtype: "domestic", rate_percentage: "" });
      setEditingTxnChargeId(null);
    },
    onError: (error) => toast.error(error?.message || "Something went wrong"),
  });

  const fetchPosTxnById = useMutation({
    mutationFn: getPosTransactionChargeById,
    onSuccess: (data) => {
      const charge = data?.data || data;
      setEditingTxnChargeId(charge?.id || charge?._id || null);
      setPosTxnForm({
        merchant_id: charge?.merchant_id ?? "",
        method: charge?.method ?? "card",
        network: charge?.network ?? "visa",
        card_type: charge?.card_type ?? "credit",
        subtype: charge?.subtype ?? "domestic",
        rate_percentage: charge?.rate_percentage ?? "",
      });
    },
    onError: (error) => toast.error(error?.message || "Something went wrong"),
  });

  const updatePosTxnMutation = useMutation({
    mutationFn: ({ id, payload }) => updatePosTransactionCharge(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries(["pos_transaction_charges"]);
      setEditingTxnChargeId(null);
      setPosTxnForm({ merchant_id: "", method: "card", network: "visa", card_type: "credit", subtype: "domestic", rate_percentage: "" });
    },
    onError: (error) => toast.error(error?.message || "Something went wrong"),
  });

  const deletePosTxnMutation = useMutation({
    mutationFn: deletePosTransactionCharge,
    onSuccess: () => {
      queryClient.invalidateQueries(["pos_transaction_charges"]);
    },
    onError: (error) => toast.error(error?.message || "Something went wrong"),
  });

  const {
    data: bbpsRulesData = [],
    isLoading: bbpsLoading,
    isError: bbpsError,
  } = useQuery({
    queryKey: ["bbps_cc_charge_rules"],
    queryFn: listBbpsChargeRules,
    enabled: activeTab === "bbps_cc",
  });

  const createBbpsRuleMutation = useMutation({
    mutationFn: createBbpsChargeRule,
    onSuccess: () => {
      queryClient.invalidateQueries(["bbps_cc_charge_rules"]);
      setBbpsForm({
        from_amount: "",
        to_amount: "",
        rate: "",
        rate_type: "flat",
        is_active: true,
      });
      setBbpsEditingId(null);
    },
    onError: (error) => toast.error(error?.message || "Something went wrong"),
  });

  const updateBbpsRuleMutation = useMutation({
    mutationFn: ({ id, payload }) => updateBbpsChargeRule(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries(["bbps_cc_charge_rules"]);
      setBbpsForm({
        from_amount: "",
        to_amount: "",
        rate: "",
        rate_type: "flat",
        is_active: true,
      });
      setBbpsEditingId(null);
    },
    onError: (error) => toast.error(error?.message || "Something went wrong"),
  });

  const deleteBbpsRuleMutation = useMutation({
    mutationFn: deleteBbpsChargeRule,
    onSuccess: () => {
      queryClient.invalidateQueries(["bbps_cc_charge_rules"]);
    },
    onError: (error) => toast.error(error?.message || "Something went wrong"),
  });

  const posTxnColumns = [
    { header: "Merchant ID", key: "merchant_id" },
    { header: "Merchant Name", key: "merchant_name" },
    { header: "Method", key: "method" },
    { header: "Network", key: "network" },
    { header: "Card Type", key: "card_type" },
    { header: "Subtype", key: "subtype" },
    { header: "Rate %", key: "rate_percentage", render: (val) => formatPercent(val) },
  ];

  const bbpsColumns = [
    { header: "From (₹)", key: "from_amount", render: (val) => formatCurrency(val) },
    { header: "To (₹)", key: "to_amount", render: (val) => formatCurrency(val) },
    { header: "Rate", key: "rate", render: (val) => formatCurrency(val) },
    { header: "Type", key: "rate_type" },
  ];

  const resolveMerchantName = (item) => {
    if (item?.merchant?.name) return item.merchant.name;
    const found = merchants.find((m) => m.id === item?.merchant_id);
    if (found?.name) return found.name;
    if (item?.is_default || item?.merchant_id === 1) return "All Merchants";
    return "-";
  };

  // Admin rental: find each admin-defined rate by target_user_type
  const rentalRates = useMemo(() => {
    const arr = Array.isArray(rentalListData?.data) ? rentalListData.data : [];
    return arr.filter((r) => r.franchaise_id === null || r.franchaise_id === undefined);
  }, [rentalListData]);

  const franchiseRate = useMemo(
    () => rentalRates.find((r) => r.target_user_type === "franchise") ?? null,
    [rentalRates]
  );
  const standaloneRate = useMemo(
    () => rentalRates.find((r) => r.target_user_type === "merchant") ?? null,
    [rentalRates]
  );

  useEffect(() => {
    if (franchiseRate) {
      setFranchiseRateForm({ amount: parseFloat(franchiseRate.amount) || "", status: franchiseRate.status || "active" });
    }
  }, [franchiseRate?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (standaloneRate) {
      setMerchantRateForm({ amount: parseFloat(standaloneRate.amount) || "", status: standaloneRate.status || "active" });
    }
  }, [standaloneRate?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const payoutRules = Array.isArray(payoutRulesData?.data)
    ? payoutRulesData.data
    : Array.isArray(payoutRulesData)
    ? payoutRulesData
    : [];

  const bbpsRules = Array.isArray(bbpsRulesData?.data)
    ? bbpsRulesData.data
    : Array.isArray(bbpsRulesData)
    ? bbpsRulesData
    : [];

  const posTxnCharges = Array.isArray(posTxnList?.data)
    ? posTxnList.data
    : Array.isArray(posTxnList?.charges)
    ? posTxnList.charges
    : Array.isArray(posTxnList)
    ? posTxnList
    : [];

  const posTxnChargesWithMerchant = useMemo(
    () => posTxnCharges.map((c) => ({ ...c, merchant_name: resolveMerchantName(c) })),
    [posTxnCharges, merchants]
  );

  const handleCreateOrUpdatePosTxn = (e) => {
    e.preventDefault();
    if (!posTxnForm.merchant_id || !posTxnForm.rate_percentage) {
      toast.error("Please fill required fields");
      return;
    }
    const payload = {
      merchant_id: Number(posTxnForm.merchant_id),
      method: posTxnForm.method,
      network: posTxnForm.network,
      card_type: posTxnForm.card_type,
      subtype: posTxnForm.subtype,
      rate_percentage: parseFloat(posTxnForm.rate_percentage),
    };
    if (editingTxnChargeId) {
      updatePosTxnMutation.mutate({ id: editingTxnChargeId, payload });
    } else {
      createPosTxnMutation.mutate(payload);
    }
  };

  const handleEditPosTxn = (row) => {
    const id = row?.id || row?._id || row?.pos_transaction_charge_id;
    if (!id) return;
    fetchPosTxnById.mutate(id);
  };

  const handleDeletePosTxn = (row) => {
    const id = row?.id || row?._id || row?.pos_transaction_charge_id;
    if (!id) return;
    if (window.confirm("Are you sure you want to delete this POS transaction charge?")) {
      deletePosTxnMutation.mutate(id);
    }
  };

  const handleSaveFranchiseRate = (e) => {
    e.preventDefault();
    const amount = parseFloat(franchiseRateForm.amount);
    if (!franchiseRateForm.amount || !Number.isFinite(amount) || amount <= 0) {
      toast.error("Amount must be greater than 0");
      return;
    }
    if (franchiseRate) {
      updateRentalMutation.mutate({ id: franchiseRate.id, payload: { amount, status: franchiseRateForm.status } });
    } else {
      createRentalMutation.mutate({ amount, status: franchiseRateForm.status, type: "pos", target_user_type: "franchise" });
    }
  };

  const handleDeleteFranchiseRate = () => {
    if (!franchiseRate?.id) return;
    if (window.confirm("Are you sure you want to delete this franchise rental rate?")) {
      deleteRentalMutation.mutate(franchiseRate.id);
    }
  };

  const handleSaveMerchantRate = (e) => {
    e.preventDefault();
    const amount = parseFloat(merchantRateForm.amount);
    if (!merchantRateForm.amount || !Number.isFinite(amount) || amount <= 0) {
      toast.error("Amount must be greater than 0");
      return;
    }
    if (standaloneRate) {
      updateRentalMutation.mutate({ id: standaloneRate.id, payload: { amount, status: merchantRateForm.status } });
    } else {
      createRentalMutation.mutate({ amount, status: merchantRateForm.status, type: "pos", target_user_type: "merchant" });
    }
  };

  const handleDeleteMerchantRate = () => {
    if (!standaloneRate?.id) return;
    if (window.confirm("Are you sure you want to delete this standalone merchant rental rate?")) {
      deleteRentalMutation.mutate(standaloneRate.id);
    }
  };

  const handleCreateOrUpdatePayout = (e) => {
    e.preventDefault();
    const fromAmount = parseFloat(payoutForm.from_amount);
    const toAmount = parseFloat(payoutForm.to_amount);
    const rateRaw = payoutForm.rate;
    const rate = rateRaw === "" || rateRaw === null || rateRaw === undefined ? null : String(rateRaw).trim();

    if (Number.isNaN(fromAmount) || Number.isNaN(toAmount) || !rate || !payoutForm.rate_type) {
      toast.error("Please fill required fields");
      return;
    }

    if (fromAmount > toAmount) {
      toast.error("From amount must be less than or equal to To amount");
      return;
    }

    const payload = {
      merchant_id: 1,
      is_default: true,
      min: String(fromAmount),
      max: String(toAmount),
      from_amount: String(fromAmount),
      to_amount: String(toAmount),
      rate: String(rate),
      rate_type: payoutForm.rate_type,
      ...(payoutForm.rate_type === "percentage"
        ? { percentage: parseFloat(rate) }
        : { amount: parseFloat(rate) }),
      status: payoutForm.is_active ? "active" : "inactive",
      is_active: payoutForm.is_active,
      description: payoutForm.description,
    };

    if (payoutEditingId) {
      updatePayoutMutation.mutate({ id: payoutEditingId, payload });
    } else {
      createPayoutMutation.mutate(payload);
    }
  };

  const handleEditPayout = (rule) => {
    if (!rule?.id) return;
    setPayoutEditingId(rule.id);
    setPayoutForm({
      from_amount: rule.from_amount ?? "",
      to_amount: rule.to_amount ?? "",
      rate: rule.rate ?? "",
      rate_type: rule.rate_type ?? "flat",
      is_active: rule.is_active ?? true,
      description: rule.description ?? "",
    });
  };

  const handleDeletePayout = (rule) => {
    const id = rule?.id;
    if (!id) return;
    if (window.confirm("Are you sure you want to delete this payout charge rule?")) {
      deletePayoutMutation.mutate(id);
    }
  };

  const handleCreateOrUpdateBbpsRule = (e) => {
    e.preventDefault();
    const fromAmount = parseFloat(bbpsForm.from_amount);
    const toAmount = parseFloat(bbpsForm.to_amount);
    const rateRaw = bbpsForm.rate;
    const rate = rateRaw === "" || rateRaw === null || rateRaw === undefined ? null : String(rateRaw).trim();

    if (Number.isNaN(fromAmount) || Number.isNaN(toAmount) || !rate || !bbpsForm.rate_type) {
      toast.error("Please fill required fields");
      return;
    }

    if (fromAmount > toAmount) {
      toast.error("From amount must be less than or equal to To amount");
      return;
    }

    const payload = {
      from_amount: String(fromAmount),
      to_amount: String(toAmount),
      rate: String(rate),
      rate_type: bbpsForm.rate_type,
      is_active: bbpsForm.is_active,
    };

    // DEBUG: ensure backend receives expected payload
    console.debug("[BBPS] create/update payload", payload);

    if (bbpsEditingId) {
      updateBbpsRuleMutation.mutate({ id: bbpsEditingId, payload });
    } else {
      createBbpsRuleMutation.mutate(payload);
    }
  };

  const handleEditBbpsRule = (rule) => {
    if (!rule?.id) return;
    setBbpsEditingId(rule.id);
    setBbpsForm({
      from_amount: rule.from_amount ?? "",
      to_amount: rule.to_amount ?? "",
      rate: rule.rate ?? "",
      rate_type: rule.rate_type ?? "flat",
      is_active: rule.is_active ?? true,
    });
  };

  const handleDeleteBbpsRule = (rule) => {
    const id = rule?.id;
    if (!id) return;
    if (window.confirm("Are you sure you want to delete this charge rule?")) {
      deleteBbpsRuleMutation.mutate(id);
    }
  };

  const getStatusBadgeClass = (status) => {
    const value = String(status || "").toLowerCase();
    if (value === "active" || value === "completed") return "bg-green-100 text-green-800";
    if (value === "pending") return "bg-yellow-100 text-yellow-800";
    return "bg-red-100 text-red-800";
  };

  return (
    <div className="bg-gray-100 min-h-screen">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 mb-4">Rate Settings</h1>

        {/* Tabs */}
        {!hideTabs && (
          <div className="grid grid-cols-3 md:flex border-b border-gray-200 mb-6">
            <button
              className={`px-2 md:px-6 py-2 text-xs md:text-sm font-medium text-center leading-tight transition-all duration-200 ${
                activeTab === "pos_rental"
                  ? "border-b-2 border-gray-900 text-gray-800 bg-blue-50"
                  : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
              }`}
              onClick={() => setActiveTab("pos_rental")}
            >
              POS Rental
            </button>
            <button
              className={`px-2 md:px-6 py-2 text-xs md:text-sm font-medium text-center leading-tight transition-all duration-200 ${
                activeTab === "pos_txn"
                  ? "border-b-2 border-gray-900 text-gray-800 bg-blue-50"
                  : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
              }`}
              onClick={() => setActiveTab("pos_txn")}
            >
              POS Transactions
            </button>
            <button
              className={`px-2 md:px-6 py-2 text-xs md:text-sm font-medium text-center leading-tight transition-all duration-200 ${
                activeTab === "payout"
                  ? "border-b-2 border-gray-900 text-gray-800 bg-blue-50"
                  : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
              }`}
              onClick={() => setActiveTab("payout")}
            >
              Payout Charges
            </button>
            <button
              className={`px-2 md:px-6 py-2 text-xs md:text-sm font-medium text-center leading-tight transition-all duration-200 ${
                activeTab === "bbps_cc"
                  ? "border-b-2 border-gray-900 text-gray-800 bg-blue-50"
                  : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
              }`}
              onClick={() => setActiveTab("bbps_cc")}
            >
              CC Bill Pay Charges
            </button>
          </div>
        )}

        {/* POS Rental Content */}
        {activeTab === "pos_rental" && (
          <div className="space-y-6">
            {rentalLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="animate-spin h-8 w-8 text-indigo-600" />
              </div>
            ) : rentalError ? (
              <p className="text-red-600 px-1">{rentalErrObj?.message || "Failed to load rental rates"}</p>
            ) : (
              <>
                {/* Rate for Franchises */}
                <div className="bg-white p-4 rounded-xl shadow-sm">
                  <h2 className="text-lg font-semibold text-gray-800 mb-1">Rate for Franchises</h2>
                  <p className="text-sm text-gray-500 mb-4">Charged to all franchise accounts every 30 days</p>
                  <form onSubmit={handleSaveFranchiseRate} className="flex flex-col md:flex-row items-end gap-4">
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Amount (₹)</label>
                      <input
                        type="number"
                        value={franchiseRateForm.amount}
                        onChange={(e) =>
                          setFranchiseRateForm((p) => ({ ...p, amount: e.target.value.replace(/[-+eE]/g, "") }))
                        }
                        onKeyDown={(e) => ["-", "+", "e", "E"].includes(e.key) && e.preventDefault()}
                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                        placeholder="500"
                        min="0.01"
                        step="0.01"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                      <select
                        value={franchiseRateForm.status}
                        onChange={(e) => setFranchiseRateForm((p) => ({ ...p, status: e.target.value }))}
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
                        className="px-5 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm font-medium"
                      >
                        {createRentalMutation.isPending || updateRentalMutation.isPending ? (
                          <span className="flex items-center gap-1"><Loader2 className="animate-spin" size={14} /> Saving...</span>
                        ) : franchiseRate ? "Update" : "Create"}
                      </button>
                      {franchiseRate && (
                        <button
                          type="button"
                          onClick={handleDeleteFranchiseRate}
                          disabled={deleteRentalMutation.isPending}
                          className="px-5 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 disabled:opacity-50 text-sm font-medium"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </form>
                </div>

                {/* Rate for Standalone Merchants */}
                <div className="bg-white p-4 rounded-xl shadow-sm">
                  <h2 className="text-lg font-semibold text-gray-800 mb-1">Rate for Standalone Merchants</h2>
                  <p className="text-sm text-gray-500 mb-4">Charged to merchants not under any franchise</p>
                  <form onSubmit={handleSaveMerchantRate} className="flex flex-col md:flex-row items-end gap-4">
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Amount (₹)</label>
                      <input
                        type="number"
                        value={merchantRateForm.amount}
                        onChange={(e) =>
                          setMerchantRateForm((p) => ({ ...p, amount: e.target.value.replace(/[-+eE]/g, "") }))
                        }
                        onKeyDown={(e) => ["-", "+", "e", "E"].includes(e.key) && e.preventDefault()}
                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                        placeholder="300"
                        min="0.01"
                        step="0.01"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                      <select
                        value={merchantRateForm.status}
                        onChange={(e) => setMerchantRateForm((p) => ({ ...p, status: e.target.value }))}
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
                        className="px-5 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm font-medium"
                      >
                        {createRentalMutation.isPending || updateRentalMutation.isPending ? (
                          <span className="flex items-center gap-1"><Loader2 className="animate-spin" size={14} /> Saving...</span>
                        ) : standaloneRate ? "Update" : "Create"}
                      </button>
                      {standaloneRate && (
                        <button
                          type="button"
                          onClick={handleDeleteMerchantRate}
                          disabled={deleteRentalMutation.isPending}
                          className="px-5 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 disabled:opacity-50 text-sm font-medium"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </form>
                </div>
              </>
            )}
          </div>
        )}

        {/* POS Transactions */}
        {activeTab === "pos_txn" && (
          <div className="space-y-6">
            <div className="bg-white p-4 rounded-xl shadow-sm">
              <h2 className="text-xl font-semibold text-gray-800 mb-4 border-b pb-2">
                {editingTxnChargeId ? "Edit POS Transaction Charge" : "Create POS Transaction Charge"}
              </h2>
              <form onSubmit={handleCreateOrUpdatePosTxn} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Select Merchant</label>
                    {merchantsLoading ? (
                      <div className="flex items-center gap-2 text-gray-600">
                        <Loader2 className="animate-spin" size={16} /> Loading merchants...
                      </div>
                    ) : merchantsError ? (
                      <p className="text-red-600">{merchantsErrObj?.message || "Failed to load merchants"}</p>
                    ) : (
                      <select
                        value={posTxnForm.merchant_id}
                        onChange={(e) => setPosTxnForm({ ...posTxnForm, merchant_id: e.target.value })}
                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                        required
                      >
                        <option value="" disabled>Select merchant...</option>
                        {merchants.map((m) => (
                          <option key={m.id} value={m.id}>{m.name} ({m.mobile_number})</option>
                        ))}
                      </select>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Method</label>
                    <select
                      value={posTxnForm.method}
                      onChange={(e) => setPosTxnForm({ ...posTxnForm, method: e.target.value })}
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="card">Card</option>
                      <option value="upi">UPI</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Network</label>
                    <select
                      value={posTxnForm.network}
                      onChange={(e) => setPosTxnForm({ ...posTxnForm, network: e.target.value })}
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="visa">Visa</option>
                      <option value="mastercard">Mastercard</option>
                      <option value="rupay">RuPay</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Card Type</label>
                    <select
                      value={posTxnForm.card_type}
                      onChange={(e) => setPosTxnForm({ ...posTxnForm, card_type: e.target.value })}
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="credit">Credit</option>
                      <option value="debit">Debit</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Subtype</label>
                    <select
                      value={posTxnForm.subtype}
                      onChange={(e) => setPosTxnForm({ ...posTxnForm, subtype: e.target.value })}
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="domestic">Domestic</option>
                      <option value="international">International</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Rate Percentage</label>
                    <input
                      type="number"
                      step="0.01"
                      value={posTxnForm.rate_percentage}
                      onChange={(e) => setPosTxnForm({ ...posTxnForm, rate_percentage: e.target.value })}
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                      placeholder="2.5"
                      required
                    />
                  </div>
                </div>

                <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
                  <button
                    type="submit"
                    disabled={createPosTxnMutation.isPending || updatePosTxnMutation.isPending}
                    className="w-full md:w-auto px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                  >
                    {(createPosTxnMutation.isPending || updatePosTxnMutation.isPending) ? (
                      <div className="flex items-center gap-2">
                        <Loader2 className="animate-spin" size={16} /> Saving...
                      </div>
                    ) : (
                      editingTxnChargeId ? "Update POS Transaction Charge" : "Save POS Transaction Charge"
                    )}
                  </button>
                  {editingTxnChargeId && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingTxnChargeId(null);
                        setPosTxnForm({ merchant_id: "", method: "card", network: "visa", card_type: "credit", subtype: "domestic", rate_percentage: "" });
                      }}
                      className="w-full md:w-auto px-6 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
                    >
                      Cancel Edit
                    </button>
                  )}
                </div>
              </form>
            </div>

            <div className="bg-white p-4 rounded-xl shadow-sm">
              <h2 className="text-xl font-semibold text-gray-800 mb-4 border-b pb-2">POS Transaction Charges</h2>
              {posTxnLoading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="animate-spin h-8 w-8 text-indigo-600" />
                </div>
              ) : posTxnError ? (
                <p className="text-red-600">{posTxnErrObj?.message || "Failed to load POS transaction charges"}</p>
              ) : posTxnCharges.length === 0 ? (
                <p className="text-gray-500">No POS transaction charges found.</p>
              ) : (
                <>
                  <div className="md:hidden space-y-3">
                    {posTxnChargesWithMerchant.map((row) => (
                      <div key={row.id || row._id} className="rounded-xl border border-gray-100 p-4 shadow-sm">
                        <p className="text-sm text-gray-700"><span className="font-medium">Merchant ID:</span> {row.merchant_id}</p>
                        <p className="text-sm text-gray-700"><span className="font-medium">Merchant:</span> {row.merchant_name || "-"}</p>
                        <p className="text-sm text-gray-700"><span className="font-medium">Method:</span> {row.method}</p>
                        <p className="text-sm text-gray-700"><span className="font-medium">Network:</span> {row.network}</p>
                        <p className="text-sm text-gray-700"><span className="font-medium">Card Type:</span> {row.card_type}</p>
                        <p className="text-sm text-gray-700"><span className="font-medium">Subtype:</span> {row.subtype}</p>
                        <p className="text-sm text-gray-700"><span className="font-medium">Rate:</span> {row.rate_percentage}%</p>
                        <div className="flex gap-3 pt-3">
                          <button onClick={() => handleEditPosTxn(row)} className="text-[#00D3CD] hover:text-[#00b8b3] text-sm font-medium">Edit</button>
                          <button onClick={() => handleDeletePosTxn(row)} className="text-red-600 hover:text-red-900 text-sm font-medium">Delete</button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="hidden md:block">
                    <Table
                      columns={posTxnColumns}
                      data={posTxnChargesWithMerchant}
                      actions={[
                        { label: "Edit", onClick: handleEditPosTxn },
                        { label: "Delete", onClick: handleDeletePosTxn },
                      ]}
                    />
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Payout Charges */}
        {activeTab === "payout" && (
          <div className="space-y-6">
            <div className="bg-white p-4 rounded-xl shadow-sm">
              <h2 className="text-xl font-semibold text-gray-800 mb-4 border-b pb-2">
                {payoutEditingId ? "Edit Payout Charge Rule" : "Create Payout Charge Rule"}
              </h2>
              <form onSubmit={handleCreateOrUpdatePayout} className="space-y-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">From Amount (₹)</label>
                    <input
                      type="number"
                      value={payoutForm.from_amount}
                      onChange={(e) => setPayoutForm({ ...payoutForm, from_amount: e.target.value })}
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                      placeholder="0"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">To Amount (₹)</label>
                    <input
                      type="number"
                      value={payoutForm.to_amount}
                      onChange={(e) => setPayoutForm({ ...payoutForm, to_amount: e.target.value })}
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                      placeholder="499"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Rate</label>
                    <input
                      type="text"
                      value={payoutForm.rate}
                      onChange={(e) => setPayoutForm({ ...payoutForm, rate: e.target.value })}
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                      placeholder="20"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Rate Type</label>
                    <select
                      value={payoutForm.rate_type}
                      onChange={(e) => setPayoutForm({ ...payoutForm, rate_type: e.target.value })}
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="flat">Flat</option>
                      <option value="percentage">Percentage</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                  <input
                    type="text"
                    value={payoutForm.description}
                    onChange={(e) => setPayoutForm({ ...payoutForm, description: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                    placeholder="Optional description"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="payout-active"
                    checked={payoutForm.is_active}
                    onChange={(e) => setPayoutForm({ ...payoutForm, is_active: e.target.checked })}
                    className="h-4 w-4 text-indigo-600 border-gray-300 rounded"
                  />
                  <label htmlFor="payout-active" className="text-sm font-medium text-gray-700">
                    Active
                  </label>
                </div>

                <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
                  <button
                    type="submit"
                    disabled={createPayoutMutation.isPending || updatePayoutMutation.isPending}
                    className="w-full md:w-auto px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                  >
                    {(createPayoutMutation.isPending || updatePayoutMutation.isPending) ? (
                      <div className="flex items-center gap-2">
                        <Loader2 className="animate-spin" size={16} /> Saving...
                      </div>
                    ) : (
                      payoutEditingId ? "Update Rule" : "Save Rule"
                    )}
                  </button>
                  {payoutEditingId && (
                    <button
                      type="button"
                      onClick={() => {
                        setPayoutEditingId(null);
                        setPayoutForm({ from_amount: "", to_amount: "", rate: "", rate_type: "flat", is_active: true, description: "" });
                      }}
                      className="w-full md:w-auto px-6 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
                    >
                      Cancel Edit
                    </button>
                  )}
                </div>
              </form>
            </div>

            <div className="bg-white p-4 rounded-xl shadow-sm">
              <h2 className="text-xl font-semibold text-gray-800 mb-4 border-b pb-2">Payout Charge Rules</h2>
              {payoutLoading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="animate-spin h-8 w-8 text-indigo-600" />
                </div>
              ) : payoutError ? (
                <p className="text-red-600">Failed to load payout charge rules.</p>
              ) : payoutRules.length === 0 ? (
                <p className="text-gray-500">No charge rules found.</p>
              ) : (
                <>
                  <div className="md:hidden space-y-3">
                    {payoutRules.map((rule) => (
                      <div key={rule.id} className="rounded-xl border border-gray-100 p-4 shadow-sm">
                        <p className="text-sm font-medium text-gray-900">Amount Range</p>
                        <p className="text-sm text-gray-700">From: ₹{rule.from_amount} — To: ₹{rule.to_amount}</p>
                        <p className="text-sm text-gray-700">Rate: {rule.rate_type === "percentage" ? `${rule.rate}%` : `₹${rule.rate}`} ({rule.rate_type})</p>
                        <p className="text-sm text-gray-700">Status: {rule.is_active ? "Active" : "Inactive"}</p>
                        {rule.description && <p className="text-sm text-gray-700">Desc: {rule.description}</p>}
                        <div className="flex gap-3 pt-3">
                          <button onClick={() => handleEditPayout(rule)} className="text-[#00D3CD] hover:text-[#00b8b3] text-sm font-medium">Edit</button>
                          <button onClick={() => handleDeletePayout(rule)} className="text-red-600 hover:text-red-900 text-sm font-medium">Delete</button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="hidden md:block">
                    <Table
                      columns={payoutColumns}
                      data={payoutRules}
                      actions={[
                        { label: "Edit", onClick: handleEditPayout },
                        { label: "Delete", onClick: handleDeletePayout },
                      ]}
                    />
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* CC Bill Pay Charge Rules */}
        {activeTab === "bbps_cc" && (
          <div className="space-y-6">
            <div className="bg-white p-4 rounded-xl shadow-sm">
              <h2 className="text-xl font-semibold text-gray-800 mb-4 border-b pb-2">
                {bbpsEditingId ? "Edit CC Bill Pay Charge Rule" : "Create CC Bill Pay Charge Rule"}
              </h2>
              <form onSubmit={handleCreateOrUpdateBbpsRule} className="space-y-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">From Amount (₹)</label>
                    <input
                      type="number"
                      value={bbpsForm.from_amount}
                      onChange={(e) => setBbpsForm({ ...bbpsForm, from_amount: e.target.value })}
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                      placeholder="0"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">To Amount (₹)</label>
                    <input
                      type="number"
                      value={bbpsForm.to_amount}
                      onChange={(e) => setBbpsForm({ ...bbpsForm, to_amount: e.target.value })}
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                      placeholder="499"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Rate</label>
                    <input
                      type="text"
                      value={bbpsForm.rate}
                      onChange={(e) => setBbpsForm({ ...bbpsForm, rate: e.target.value })}
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                      placeholder="20"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Rate Type</label>
                    <select
                      value={bbpsForm.rate_type}
                      onChange={(e) => setBbpsForm({ ...bbpsForm, rate_type: e.target.value })}
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="flat">Flat</option>
                      <option value="percentage">Percentage</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="bbps-active"
                    checked={bbpsForm.is_active}
                    onChange={(e) => setBbpsForm({ ...bbpsForm, is_active: e.target.checked })}
                    className="h-4 w-4 text-indigo-600 border-gray-300 rounded"
                  />
                  <label htmlFor="bbps-active" className="text-sm font-medium text-gray-700">
                    Active
                  </label>
                </div>

                <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
                  <button
                    type="submit"
                    disabled={createBbpsRuleMutation.isPending || updateBbpsRuleMutation.isPending}
                    className="w-full md:w-auto px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                  >
                    {(createBbpsRuleMutation.isPending || updateBbpsRuleMutation.isPending) ? (
                      <div className="flex items-center gap-2">
                        <Loader2 className="animate-spin" size={16} /> Saving...
                      </div>
                    ) : (
                      bbpsEditingId ? "Update Rule" : "Save Rule"
                    )}
                  </button>
                  {bbpsEditingId && (
                    <button
                      type="button"
                      onClick={() => {
                        setBbpsEditingId(null);
                        setBbpsForm({
                          from_amount: "",
                          to_amount: "",
                          rate: "",
                          rate_type: "flat",
                          is_active: true,
                        });
                      }}
                      className="w-full md:w-auto px-6 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
                    >
                      Cancel Edit
                    </button>
                  )}
                </div>
              </form>
            </div>

            <div className="bg-white p-4 rounded-xl shadow-sm">
              <h2 className="text-xl font-semibold text-gray-800 mb-4 border-b pb-2">CC Bill Pay Charge Rules</h2>
              {bbpsLoading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="animate-spin h-8 w-8 text-indigo-600" />
                </div>
              ) : bbpsError ? (
                <p className="text-red-600">Failed to load CC bill pay charge rules.</p>
              ) : bbpsRules.length === 0 ? (
                <p className="text-gray-500">No charge rules found.</p>
              ) : (
                <>
                  <div className="md:hidden space-y-3">
                    {bbpsRules.map((rule) => (
                      <div key={rule.id} className="rounded-xl border border-gray-100 p-4 shadow-sm">
                        <p className="text-sm font-medium text-gray-900">Amount Range</p>
                        <p className="text-sm text-gray-700">From: ₹{rule.from_amount} — To: ₹{rule.to_amount}</p>
                        <p className="text-sm text-gray-700">Rate: {rule.rate} ({rule.rate_type})</p>
                        <div className="flex gap-3 pt-3">
                          <button onClick={() => handleEditBbpsRule(rule)} className="text-[#00D3CD] hover:text-[#00b8b3] text-sm font-medium">Edit</button>
                          <button onClick={() => handleDeleteBbpsRule(rule)} className="text-red-600 hover:text-red-900 text-sm font-medium">Delete</button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="hidden md:block">
                    <Table
                      columns={bbpsColumns}
                      data={bbpsRules}
                      actions={[
                        { label: "Edit", onClick: handleEditBbpsRule },
                        { label: "Delete", onClick: handleDeleteBbpsRule },
                      ]}
                    />
                  </div>
                </>
              )}
            </div>
          </div>
        )}
        {activeTab === "payout" && <PayoutRateSettings />}
      </div>
      <ToastContainer position="top-right" autoClose={3000} hideProgressBar theme="light" />
    </div>
  );
};

export default RateSettings;
