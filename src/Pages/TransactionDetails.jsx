import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2 } from "lucide-react";
import { getTransactionById } from "../api/transactionApi";

const TransactionDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data: transaction, isLoading, error } = useQuery({
    queryKey: ["transaction", id],
    queryFn: () => getTransactionById(id),
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="flex items-center gap-2 text-gray-600">
          <Loader2 className="animate-spin h-8 w-8" />
          <span>Loading transaction details...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="bg-red-50 p-4 rounded-lg text-red-600">
          Error: {error.message}
        </div>
      </div>
    );
  }

  const Card = ({ title, children }) => (
    <div className="bg-white rounded-xl shadow-md p-6">
      <h2 className="text-xl font-semibold text-gray-800 mb-4 border-b pb-2">{title}</h2>
      <div className="space-y-3">{children}</div>
    </div>
  );

  const InfoField = ({ label, value }) => (
    <div className="flex justify-between items-center py-2">
      <span className="font-medium text-gray-700">{label}:</span>
      <span className="text-gray-900">{value || "N/A"}</span>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-100 to-gray-200 p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8 bg-white p-4 rounded-t-xl shadow-md">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(-1)}
              className="p-2 rounded-full bg-indigo-100 text-indigo-600 hover:bg-indigo-200 transition"
            >
              <ArrowLeft size={24} />
            </button>
            <h1 className="text-3xl font-extrabold text-primary">
              Transaction Details (ID: {transaction.ID})
            </h1>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Basic Info */}
          <Card title="Basic Information">
            <InfoField label="Transaction ID" value={transaction.ID} />
            <InfoField
              label="Date"
              value={transaction.Date ? new Date(transaction.Date).toLocaleString() : "N/A"}
            />
            <InfoField label="Amount" value={`₹${parseFloat(transaction.Amount || 0).toFixed(2)}`} />
            <InfoField label="Status" value={transaction.Status} />
            <InfoField label="Mobile" value={transaction.Mobile} />
            <InfoField label="Email" value={transaction.Email} />
            <InfoField label="Consumer" value={transaction.Consumer} />
            <InfoField label="Username" value={transaction.Username} />
          </Card>

          {/* Payment Details */}
          <Card title="Payment Details">
            <InfoField label="Type" value={transaction.Type} />
            <InfoField label="Mode" value={transaction.Mode} />
            <InfoField label="MID" value={transaction.MID} />
            <InfoField label="TID" value={transaction.TID} />
            <InfoField label="Auth Code" value={transaction.AuthCode} />
            <InfoField label="Card" value={transaction.Card} />
            <InfoField label="Card Type" value={transaction.CardType} />
            <InfoField label="Brand Type" value={transaction.BrandType} />
            <InfoField label="Card Classification" value={transaction.CardClassification} />
            <InfoField label="Card Txn Type" value={transaction.CardTxnType} />
          </Card>

          {/* Additional Info */}
          <Card title="Additional Information">
            <InfoField label="Tip" value={transaction.Tip ? `₹${transaction.Tip}` : "N/A"} />
            <InfoField label="Cash at POS" value={transaction.CashAtPOS ? `₹${transaction.CashAtPOS}` : "N/A"} />
            <InfoField label="RRN" value={transaction.RRN} />
            <InfoField label="Invoice #" value={transaction.Invoice} />
            <InfoField label="Device Serial" value={transaction.DeviceSerial} />
            <InfoField
              label="Settled On"
              value={transaction.SettledOn ? new Date(transaction.SettledOn).toLocaleString() : "N/A"}
            />
            <InfoField label="Labels" value={transaction.Labels} />
            <InfoField label="Batch #" value={transaction.Batch} />
            <InfoField label="Receipt No" value={transaction.ReceiptNo} />
            <InfoField label="Error Code" value={transaction.ErrorCode} />
            <InfoField label="PG Error Code" value={transaction.PGErrorCode} />
            <InfoField label="PG Error Message" value={transaction.PGErrorMessage} />
          </Card>

          {/* EMI & Cashback */}
          <Card title="EMI & Cashback">
            <InfoField label="EMI Tenure" value={transaction.EMITenure} />
            <InfoField label="EMI Interest Rate" value={transaction.EMIInterestRate ? `${transaction.EMIInterestRate}%` : "N/A"} />
            <InfoField label="EMI Amount" value={transaction.EMIAmt ? `₹${transaction.EMIAmt}` : "N/A"} />
            <InfoField label="Total Amount (With Interest)" value={transaction.TotalAmtWithIntr ? `₹${transaction.TotalAmtWithIntr}` : "N/A"} />
            <InfoField label="Cashback %" value={transaction.CashbackPercent ? `${transaction.CashbackPercent}%` : "N/A"} />
            <InfoField label="Cashback Amount" value={transaction.CashbackAmt ? `₹${transaction.CashbackAmt}` : "N/A"} />
            <InfoField label="Payback %" value={transaction.PaybackPercent ? `${transaction.PaybackPercent}%` : "N/A"} />
            <InfoField label="Payback Amount" value={transaction.PaybackAmt ? `₹${transaction.PaybackAmt}` : "N/A"} />
            <InfoField label="Instant EMI Discount %" value={transaction.InstantEMIDiscountPercent ? `${transaction.InstantEMIDiscountPercent}%` : "N/A"} />
            <InfoField label="Instant EMI Discount" value={transaction.InstantEMIDiscount ? `₹${transaction.InstantEMIDiscount}` : "N/A"} />
            <InfoField label="Net Cost" value={transaction.NetCost ? `₹${transaction.NetCost}` : "N/A"} />
            <InfoField label="EMI Status" value={transaction.EMIStatus} />
          </Card>

          {/* Location & Product */}
          <Card title="Location & Product">
            <InfoField label="Latitude" value={transaction.Latitude} />
            <InfoField label="Longitude" value={transaction.Longitude} />
            <InfoField label="Payer" value={transaction.Payer} />
            <InfoField label="TID Location" value={transaction.TIDLocation} />
            <InfoField label="DX Mode" value={transaction.DXMode} />
            <InfoField label="Acquiring Bank" value={transaction.AcquiringBank} />
            <InfoField label="Issuing Bank" value={transaction.IssuingBank} />
            <InfoField label="Manufacturer" value={transaction.Manufacturer} />
            <InfoField label="Product Name" value={transaction.ProductName} />
            <InfoField label="SKU Code" value={transaction.SkuCode} />
            <InfoField label="Product Serial" value={transaction.ProductSerial} />
            <InfoField label="Scheme Name" value={transaction.SchemeName} />
            <InfoField label="Receipt URL" value={transaction.ReceiptURL} />
          </Card>
        </div>
      </div>
    </div>
  );
};

export default TransactionDetails;
