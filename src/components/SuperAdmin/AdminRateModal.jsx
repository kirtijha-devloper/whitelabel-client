import React, { useState, useEffect } from "react";
import {
  X,
  Percent,
  Sliders,
  CheckCircle2,
  Loader2,
  Plus,
  Trash2,
  Info,
  DollarSign,
  ShieldCheck,
} from "lucide-react";
import { toast } from "react-toastify";

const DEFAULT_ADMIN_RATES = [
  {
    id: "rate_pos_card",
    service: "POS Debit / Credit Card",
    category: "POS & Hardware",
    minAmount: 1,
    maxAmount: 100000,
    feeType: "percentage",
    feeValue: 1.25,
    gstPercent: 18,
    isGstInclusive: false,
    isActive: true,
  },
  {
    id: "rate_pos_upi",
    service: "POS UPI Transaction",
    category: "POS & Hardware",
    minAmount: 1,
    maxAmount: 100000,
    feeType: "flat",
    feeValue: 0.0,
    gstPercent: 18,
    isGstInclusive: true,
    isActive: true,
  },
  {
    id: "rate_payout_imps",
    service: "Instant Payout (IMPS)",
    category: "Payout & Banking",
    minAmount: 1,
    maxAmount: 25000,
    feeType: "flat",
    feeValue: 6.5,
    gstPercent: 18,
    isGstInclusive: false,
    isActive: true,
  },
  {
    id: "rate_payout_neft",
    service: "Direct Payout (NEFT)",
    category: "Payout & Banking",
    minAmount: 1,
    maxAmount: 200000,
    feeType: "flat",
    feeValue: 3.5,
    gstPercent: 18,
    isGstInclusive: false,
    isActive: true,
  },
  {
    id: "rate_qr_soundbox",
    service: "Dynamic QR & Soundbox",
    category: "Digital QR",
    minAmount: 1,
    maxAmount: 50000,
    feeType: "percentage",
    feeValue: 0.0,
    gstPercent: 18,
    isGstInclusive: true,
    isActive: true,
  },
  {
    id: "rate_bbps",
    service: "BBPS Bill Payments",
    category: "Bill Payments",
    minAmount: 10,
    maxAmount: 50000,
    feeType: "flat",
    feeValue: 2.0,
    gstPercent: 18,
    isGstInclusive: false,
    isActive: true,
  },
];

const AdminRateModal = ({ isOpen, onClose, admin, onSuccess }) => {
  const [rates, setRates] = useState([]);
  const [activeTab, setActiveTab] = useState("all");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!admin) return;
    // Load existing admin custom rates from local storage or defaults
    try {
      const storageKey = `admin_rates_${admin.id}`;
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        setRates(JSON.parse(saved));
      } else {
        setRates(DEFAULT_ADMIN_RATES);
      }
    } catch {
      setRates(DEFAULT_ADMIN_RATES);
    }
  }, [admin]);

  if (!isOpen || !admin) return null;

  const adminName = admin.name || "Administrator";
  const companyName =
    admin.company?.company_name ||
    admin.company_or_shop_name ||
    "Company Not Specified";
  const domainName = admin.company?.domain_name || "Platform Admin";

  const handleRateChange = (index, field, value) => {
    setRates((prev) => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        [field]: value,
      };
      return updated;
    });
  };

  const handleToggleActive = (index) => {
    setRates((prev) => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        isActive: !updated[index].isActive,
      };
      return updated;
    });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      // Persist admin rates
      const storageKey = `admin_rates_${admin.id}`;
      localStorage.setItem(storageKey, JSON.stringify(rates));

      toast.success(
        `Rate settings for ${adminName} (${companyName}) updated successfully.`
      );

      if (typeof onSuccess === "function") {
        onSuccess(rates);
      }
      onClose();
    } catch (err) {
      console.error("[AdminRateModal] Error saving rates:", err);
      toast.error(err?.message || "Failed to update rate settings.");
    } finally {
      setSubmitting(false);
    }
  };

  const filteredRates =
    activeTab === "all"
      ? rates
      : rates.filter((r) => r.category.toLowerCase().includes(activeTab.toLowerCase()));

  const categories = ["all", "POS & Hardware", "Payout & Banking", "Digital QR", "Bill Payments"];

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl bg-white shadow-2xl border border-gray-100 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* HEADER */}
        <div className="flex items-start justify-between border-b border-gray-100 bg-gray-50/80 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-[#00D3CD]/10 border border-[#00D3CD]/20 p-2 text-[#00D3CD]">
              <Percent size={22} />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">
                Rate & Slab Management
              </h2>
              <p className="text-xs text-gray-500">
                {adminName} • {companyName} • {domainName}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* HERO BANNER */}
        <div className="bg-gradient-to-br from-[#00D3CD] to-[#00a8a3] px-6 py-4 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wider text-teal-100 font-semibold">
                Company Commission & Charge Slabs
              </p>
              <h3 className="text-lg font-bold mt-0.5">
                {companyName}
              </h3>
            </div>
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-white/20 backdrop-blur-md text-white border border-white/20">
              Admin Specific
            </span>
          </div>
        </div>

        {/* CATEGORY TABS */}
        <div className="px-6 pt-3 pb-2 border-b border-gray-100 flex items-center gap-1 overflow-x-auto">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveTab(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap capitalize transition-all ${
                activeTab === cat
                  ? "bg-[#00D3CD] text-white shadow-sm"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
              }`}
            >
              {cat === "all" ? "All Services" : cat}
            </button>
          ))}
        </div>

        {/* RATE SLABS LIST */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="space-y-3">
            {filteredRates.map((rate) => {
              const actualIdx = rates.findIndex((r) => r.id === rate.id);

              return (
                <div
                  key={rate.id}
                  className={`p-4 rounded-xl border transition-all ${
                    rate.isActive
                      ? "border-gray-200 bg-white hover:border-[#00D3CD]/50"
                      : "border-gray-100 bg-gray-50/60 opacity-60"
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <button
                        type="button"
                        onClick={() => handleToggleActive(actualIdx)}
                        className={`w-5 h-5 rounded-md flex items-center justify-center border transition-colors ${
                          rate.isActive
                            ? "bg-[#00D3CD] border-[#00D3CD] text-white"
                            : "border-gray-300 bg-white"
                        }`}
                      >
                        {rate.isActive && <CheckCircle2 size={14} />}
                      </button>
                      <div>
                        <h4 className="text-sm font-bold text-gray-900">
                          {rate.service}
                        </h4>
                        <span className="text-[11px] text-gray-400 font-medium">
                          {rate.category} • Range: ₹{rate.minAmount.toLocaleString()} - ₹{rate.maxAmount.toLocaleString()}
                        </span>
                      </div>
                    </div>

                    {/* FEE INPUTS */}
                    <div className="flex items-center gap-3">
                      {/* Fee Type Toggle */}
                      <select
                        value={rate.feeType}
                        onChange={(e) =>
                          handleRateChange(actualIdx, "feeType", e.target.value)
                        }
                        className="text-xs border border-gray-300 rounded-lg px-2 py-1.5 bg-white text-gray-700 font-medium focus:ring-1 focus:ring-[#00D3CD]"
                      >
                        <option value="percentage">Percent (%)</option>
                        <option value="flat">Flat (₹)</option>
                      </select>

                      {/* Fee Value Input */}
                      <div className="relative w-24">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={rate.feeValue}
                          onChange={(e) =>
                            handleRateChange(
                              actualIdx,
                              "feeValue",
                              parseFloat(e.target.value) || 0
                            )
                          }
                          className="w-full text-xs font-semibold border border-gray-300 rounded-lg px-2 py-1.5 text-right focus:outline-none focus:ring-1 focus:ring-[#00D3CD]"
                        />
                        <span className="absolute left-2 top-1.5 text-xs text-gray-400 font-medium">
                          {rate.feeType === "percentage" ? "%" : "₹"}
                        </span>
                      </div>

                      {/* GST Tag */}
                      <span className="text-[10px] font-semibold text-gray-500 bg-gray-100 px-2 py-1 rounded-md">
                        +18% GST
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* FOOTER ACTIONS */}
          <div className="flex items-center justify-between pt-4 border-t border-gray-100">
            <span className="text-xs text-gray-400">
              Rates apply to all downstream franchises & merchants under {companyName}.
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-100 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-2 px-5 py-2 text-xs font-semibold rounded-xl bg-[#00D3CD] hover:bg-[#00bdb7] text-white shadow-sm transition-all disabled:opacity-50"
              >
                {submitting ? <Loader2 size={14} className="animate-spin" /> : null}
                <span>Save Rate Changes</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AdminRateModal;
