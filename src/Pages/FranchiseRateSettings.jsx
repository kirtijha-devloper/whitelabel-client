import React, { useMemo, useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Table from "../components/Table";
import { Loader2 } from "lucide-react";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import {
  listPosRentals,
  listPayoutCharges,
  listPosTransactionCharges,
  createPosRental,
  updatePosRental,
  deletePosRental,
} from "../api/rateSettingsApi";

const FranchiseRateSettings = () => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("pos_rental"); // pos_rental | pos_txn | payout
  const [rentalForm, setRentalForm] = useState({ amount: "", status: "active" });

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
    onSuccess: () => {
      queryClient.invalidateQueries(["pos_rentals"]);
      setRentalForm({ amount: "", status: "active" });
    },
    onError: (error) => toast.error(error?.message || "Something went wrong"),
  });

  const {
    data: payoutList = [],
    isLoading: payoutLoading,
    isError: payoutError,
    error: payoutErrObj,
  } = useQuery({
    queryKey: ["payout_charges"],
    queryFn: listPayoutCharges,
    enabled: activeTab === "payout",
  });

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


  const payoutColumns = [
    { header: "Merchant ID", key: "merchant_id" },
    { header: "Merchant Name", key: "merchant_name" },
    { header: "Min", key: "min", render: (val) => `₹${val}` },
    { header: "Max", key: "max", render: (val) => `₹${val}` },
    { header: "Amount", key: "amount", render: (val) => `₹${val}` },
    { header: "Status", key: "status" },
  ];

  const posTxnColumns = [
    { header: "Merchant ID", key: "merchant_id" },
    { header: "Merchant Name", key: "merchant_name" },
    { header: "Method", key: "method" },
    { header: "Network", key: "network" },
    { header: "Card Type", key: "card_type" },
    { header: "Subtype", key: "subtype" },
    { header: "Rate %", key: "rate_percentage", render: (val) => `${val}%` },
  ];

  const resolveMerchantName = (item) => {
    if (item?.merchant?.name) return item.merchant.name;
    if (item?.is_default || item?.merchant_id === 1) return "All Merchants";
    return "-";
  };

  const rentalRates = useMemo(() => {
    const arr = Array.isArray(rentalListData?.data)
      ? rentalListData.data
      : Array.isArray(rentalListData)
      ? rentalListData
      : [];
    return arr;
  }, [rentalListData]);

  const franchiseOwnRate = rentalRates.length > 0 ? rentalRates[0] : null;

  useEffect(() => {
    if (franchiseOwnRate) {
      setRentalForm({
        amount: parseFloat(franchiseOwnRate.amount) || "",
        status: franchiseOwnRate.status || "active",
      });
    }
  }, [franchiseOwnRate?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const payouts = Array.isArray(payoutList?.data)
    ? payoutList.data
    : Array.isArray(payoutList?.charges)
    ? payoutList.charges
    : Array.isArray(payoutList)
    ? payoutList
    : [];

  const payoutsWithMerchant = useMemo(
    () => payouts.map((p) => ({ ...p, merchant_name: resolveMerchantName(p) })),
    [payouts]
  );

  const defaultPayouts = useMemo(
    () =>
      payoutsWithMerchant.filter(
        (p) => p.is_default === true || p.is_default === "true" || p.merchant_id === 1
      ),
    [payoutsWithMerchant]
  );
  const merchantPayouts = useMemo(
    () =>
      payoutsWithMerchant.filter(
        (p) => !(p.is_default === true || p.is_default === "true" || p.merchant_id === 1)
      ),
    [payoutsWithMerchant]
  );

  const posTxnCharges = Array.isArray(posTxnList?.data)
    ? posTxnList.data
    : Array.isArray(posTxnList?.charges)
    ? posTxnList.charges
    : Array.isArray(posTxnList)
    ? posTxnList
    : [];

  const posTxnChargesWithMerchant = useMemo(
    () => posTxnCharges.map((c) => ({ ...c, merchant_name: resolveMerchantName(c) })),
    [posTxnCharges]
  );

  const handleSaveRental = (e) => {
    e.preventDefault();
    const amount = parseFloat(rentalForm.amount);
    if (!rentalForm.amount || !Number.isFinite(amount) || amount <= 0) {
      toast.error("Amount must be greater than 0");
      return;
    }
    if (franchiseOwnRate) {
      updateRentalMutation.mutate({ id: franchiseOwnRate.id, payload: { amount, status: rentalForm.status } });
    } else {
      createRentalMutation.mutate({ amount, status: rentalForm.status, type: "pos" });
    }
  };

  const handleDeleteRental = () => {
    if (!franchiseOwnRate?.id) return;
    if (window.confirm("Are you sure you want to delete this rental rate?")) {
      deleteRentalMutation.mutate(franchiseOwnRate.id);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-semibold text-gray-900 mb-6">Rate Settings</h1>

        <div className="bg-white rounded-xl shadow-md mb-6">
          <div className="flex border-b">
            <button
              onClick={() => setActiveTab("pos_rental")}
              className={`px-6 py-3 font-medium ${
                activeTab === "pos_rental"
                  ? "border-b-2 border-indigo-600 text-indigo-600"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              POS Rental
            </button>
            <button
              onClick={() => setActiveTab("pos_txn")}
              className={`px-6 py-3 font-medium ${
                activeTab === "pos_txn"
                  ? "border-b-2 border-indigo-600 text-indigo-600"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              POS Transaction Charges
            </button>
            <button
              onClick={() => setActiveTab("payout")}
              className={`px-6 py-3 font-medium ${
                activeTab === "payout"
                  ? "border-b-2 border-indigo-600 text-indigo-600"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Payout Charges
            </button>
          </div>
        </div>

        {/* POS Rentals */}
        {activeTab === "pos_rental" && (
          <div className="space-y-6">
            <div className="bg-white p-4 rounded-xl shadow-md">
              <h2 className="text-lg font-semibold text-gray-800 mb-1">Monthly Rental Rate for Your Merchants</h2>
              <p className="text-sm text-gray-500 mb-4">All merchants under you are charged this amount</p>
              {rentalLoading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="animate-spin h-8 w-8 text-indigo-600" />
                </div>
              ) : rentalError ? (
                <p className="text-red-600">{rentalErrObj?.message || "Failed to load rental rate"}</p>
              ) : (
                <form onSubmit={handleSaveRental} className="flex flex-col md:flex-row items-end gap-4">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Amount (₹)</label>
                    <input
                      type="number"
                      value={rentalForm.amount}
                      onChange={(e) =>
                        setRentalForm((p) => ({ ...p, amount: e.target.value.replace(/[-+eE]/g, "") }))
                      }
                      onKeyDown={(e) => ["-", "+", "e", "E"].includes(e.key) && e.preventDefault()}
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                      placeholder="350"
                      min="0.01"
                      step="0.01"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                    <select
                      value={rentalForm.status}
                      onChange={(e) => setRentalForm((p) => ({ ...p, status: e.target.value }))}
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
                        <span className="flex items-center gap-1">
                          <Loader2 className="animate-spin" size={14} /> Saving...
                        </span>
                      ) : franchiseOwnRate ? "Update" : "Create"}
                    </button>
                    {franchiseOwnRate && (
                      <button
                        type="button"
                        onClick={handleDeleteRental}
                        disabled={deleteRentalMutation.isPending}
                        className="px-5 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 disabled:opacity-50 text-sm font-medium"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </form>
              )}
            </div>
          </div>
        )}

        {/* POS Transactions */}
        {activeTab === "pos_txn" && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-xl shadow-md">
              <h2 className="text-xl font-semibold text-gray-800 mb-4 border-b pb-2">POS Transaction Charges</h2>
              {posTxnLoading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="animate-spin h-8 w-8 text-indigo-600" />
                </div>
              ) : posTxnError ? (
                <p className="text-red-600">{posTxnErrObj?.message || "Failed to load POS transaction charges"}</p>
              ) : posTxnChargesWithMerchant.length === 0 ? (
                <p className="text-gray-500">No POS transaction charges found.</p>
              ) : (
                <Table columns={posTxnColumns} data={posTxnChargesWithMerchant} />
              )}
            </div>
          </div>
        )}

        {/* Payout Charges */}
        {activeTab === "payout" && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-xl shadow-md">
              <h2 className="text-xl font-semibold text-gray-800 mb-4 border-b pb-2">Payout Charges</h2>
              {payoutLoading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="animate-spin h-8 w-8 text-indigo-600" />
                </div>
              ) : payoutError ? (
                <p className="text-red-600">{payoutErrObj?.message || "Failed to load payout charges"}</p>
              ) : payoutsWithMerchant.length === 0 ? (
                <p className="text-gray-500">No payout charges found.</p>
              ) : (
                <>
                  <h3 className="text-lg font-semibold mb-2">Default Charges</h3>
                  <Table columns={payoutColumns} data={defaultPayouts} />
                  <h3 className="text-lg font-semibold mt-4 mb-2">Merchant-specific Charges</h3>
                  <Table columns={payoutColumns} data={merchantPayouts} />
                </>
              )}
            </div>
          </div>
        )}
      </div>
      <ToastContainer position="top-right" autoClose={3000} hideProgressBar theme="light" />
    </div>
  );
};

export default FranchiseRateSettings;

