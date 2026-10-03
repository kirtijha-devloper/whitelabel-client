import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Table from "../../components/Table";
import { Loader2 } from "lucide-react";
import {
  listPosRentals,
  listPayoutCharges,
  listPosTransactionCharges,
} from "../../api/rateSettingsApi";
import { fetchUserDetails } from "../../api/authApi";

const MerchantRateSettings = () => {
  const [activeTab, setActiveTab] = useState("pos_rental"); // pos_rental | pos_txn | payout

  const { data: currentUser } = useQuery({
    queryKey: ["currentUser"],
    queryFn: fetchUserDetails,
  });

  const merchantId = currentUser?.merchant_id || currentUser?.id;

  const {
    data: rentalList = [],
    isLoading: rentalLoading,
    isError: rentalError,
    error: rentalErrObj,
  } = useQuery({
    queryKey: ["pos_rentals", merchantId],
    queryFn: listPosRentals,
    enabled: activeTab === "pos_rental" && !!merchantId,
  });

  const {
    data: payoutList = [],
    isLoading: payoutLoading,
    isError: payoutError,
    error: payoutErrObj,
  } = useQuery({
    queryKey: ["payout_charges", merchantId],
    queryFn: listPayoutCharges,
    enabled: activeTab === "payout" && !!merchantId,
  });

  const {
    data: posTxnList = [],
    isLoading: posTxnLoading,
    isError: posTxnError,
    error: posTxnErrObj,
  } = useQuery({
    queryKey: ["pos_transaction_charges", merchantId],
    queryFn: listPosTransactionCharges,
    enabled: activeTab === "pos_txn" && !!merchantId,
  });

  const rentalColumns = [
    { header: "Amount", key: "amount", render: (val) => `₹${val}` },
    { header: "Applies To", key: "target_user_type" },
    { header: "Status", key: "status" },
  ];

  const payoutColumns = [
    { header: "Min", key: "min", render: (val) => `₹${val}` },
    { header: "Max", key: "max", render: (val) => `₹${val}` },
    { header: "Amount", key: "amount", render: (val) => `₹${val}` },
    { header: "Status", key: "status" },
  ];

  const posTxnColumns = [
    { header: "Method", key: "method" },
    { header: "Network", key: "network" },
    { header: "Card Type", key: "card_type" },
    { header: "Subtype", key: "subtype" },
    { header: "Rate %", key: "rate_percentage", render: (val) => `${val}%` },
  ];

  const rentals = Array.isArray(rentalList?.data)
    ? rentalList.data
    : Array.isArray(rentalList?.rentals)
    ? rentalList.rentals
    : Array.isArray(rentalList)
    ? rentalList
    : [];

  const merchantRentals = useMemo(
    () => rentals.filter((r) => r.target_user_type === "merchant"),
    [rentals]
  );

  const payouts = Array.isArray(payoutList?.data)
    ? payoutList.data
    : Array.isArray(payoutList?.charges)
    ? payoutList.charges
    : Array.isArray(payoutList)
    ? payoutList
    : [];

  const merchantPayouts = useMemo(
    () => payouts.filter((p) => Number(p.merchant_id) === merchantId),
    [payouts, merchantId]
  );

  const posTxnCharges = Array.isArray(posTxnList?.data)
    ? posTxnList.data
    : Array.isArray(posTxnList?.charges)
    ? posTxnList.charges
    : Array.isArray(posTxnList)
    ? posTxnList
    : [];

  const merchantPosTxns = useMemo(
    () => posTxnCharges.filter((c) => Number(c.merchant_id) === merchantId),
    [posTxnCharges, merchantId]
  );

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
            <div className="bg-white p-6 rounded-xl shadow-md">
              <h2 className="text-xl font-semibold text-gray-800 mb-4 border-b pb-2">POS Rentals</h2>
              {rentalLoading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="animate-spin h-8 w-8 text-indigo-600" />
                </div>
              ) : rentalError ? (
                <p className="text-red-600">{rentalErrObj?.message || "Failed to load POS rentals"}</p>
              ) : merchantRentals.length === 0 ? (
                <p className="text-gray-500">No POS rentals found.</p>
              ) : (
                <Table columns={rentalColumns} data={merchantRentals} />
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
              ) : merchantPosTxns.length === 0 ? (
                <p className="text-gray-500">No POS transaction charges found.</p>
              ) : (
                <Table columns={posTxnColumns} data={merchantPosTxns} />
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
              ) : merchantPayouts.length === 0 ? (
                <p className="text-gray-500">No payout charges found.</p>
              ) : (
                <Table columns={payoutColumns} data={merchantPayouts} />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MerchantRateSettings;

