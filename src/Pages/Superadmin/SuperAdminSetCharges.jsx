import React, { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  FaMoneyBillWave,
  FaPlus,
  FaSearch,
  FaEdit,
  FaTrash,
  FaCheckCircle,
  FaTimesCircle,
  FaSlidersH,
  FaLayerGroup,
  FaShieldAlt,
  FaPercentage,
  FaCoins,
  FaArrowRight,
  FaExchangeAlt,
  FaInfoCircle,
} from "react-icons/fa";
import { toast } from "react-toastify";
import {
  getRegisteredServices,
  getServiceStatusMap,
} from "../../utils/serviceFlags";
import {
  getAllServiceCharges,
  addServiceChargeRule,
  updateServiceChargeRule,
  deleteServiceChargeRule,
  toggleServiceChargeRuleStatus,
  saveAllServiceCharges,
  DEFAULT_SERVICE_CHARGES,
} from "../../utils/serviceCharges";

const CATEGORIES = [
  "All",
  "Payout & Banking",
  "Credit Card & Utility",
  "POS & Hardware",
  "Digital QR",
  "Payment Gateway",
  "Financial Controls",
  "Settlement & Limits",
];

const SuperAdminSetCharges = () => {
  const [services, setServices] = useState([]);
  const [statusMap, setStatusMap] = useState({});
  const [chargeRules, setChargeRules] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedServiceKey, setSelectedServiceKey] = useState("all");
  const [selectedRoleFilter, setSelectedRoleFilter] = useState("all");

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    service_key: "",
    min_amount: 1,
    max_amount: 10000,
    fee_type: "flat", // flat | percentage | both
    flat_fee: 0,
    percent_fee: 0,
    gst_percent: 18,
    is_gst_inclusive: false,
    target_role: "all",
    payment_mode: "ALL",
    is_active: true,
  });

  const loadData = () => {
    const reg = getRegisteredServices();
    const stMap = getServiceStatusMap();
    const charges = getAllServiceCharges();
    setServices(reg);
    setStatusMap(stMap);
    setChargeRules(charges);
  };

  useEffect(() => {
    loadData();

    const handleChargesUpdate = () => loadData();
    const handleServiceFlagsUpdate = () => loadData();

    window.addEventListener("service_charges_updated", handleChargesUpdate);
    window.addEventListener("service_flags_updated", handleServiceFlagsUpdate);

    return () => {
      window.removeEventListener("service_charges_updated", handleChargesUpdate);
      window.removeEventListener("service_flags_updated", handleServiceFlagsUpdate);
    };
  }, []);

  // Filtered Rules
  const filteredRules = useMemo(() => {
    return chargeRules.filter((rule) => {
      const serviceMeta = services.find((s) => s.key === rule.service_key);
      const serviceName = serviceMeta?.label || rule.service_name || rule.service_key;
      const category = serviceMeta?.category || rule.category || "General";

      const matchesSearch =
        serviceName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        rule.service_key.toLowerCase().includes(searchTerm.toLowerCase()) ||
        rule.payment_mode?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesCategory =
        selectedCategory === "All" || category === selectedCategory;

      const matchesService =
        selectedServiceKey === "all" || rule.service_key === selectedServiceKey;

      const matchesRole =
        selectedRoleFilter === "all" ||
        rule.target_role === selectedRoleFilter ||
        rule.target_role === "all";

      return matchesSearch && matchesCategory && matchesService && matchesRole;
    });
  }, [chargeRules, services, searchTerm, selectedCategory, selectedServiceKey, selectedRoleFilter]);

  // Summary Metrics
  const totalRules = chargeRules.length;
  const activeRulesCount = chargeRules.filter((r) => r.is_active).length;
  const configuredServicesCount = new Set(chargeRules.map((r) => r.service_key)).size;
  const totalPlatformServices = services.length;

  const handleOpenAddModal = (defaultKey = "") => {
    setEditingRule(null);
    const initialKey = defaultKey || (services.length > 0 ? services[0].key : "");
    const foundService = services.find((s) => s.key === initialKey);

    setFormData({
      service_key: initialKey,
      min_amount: 1,
      max_amount: 10000,
      fee_type: "flat",
      flat_fee: 5,
      percent_fee: 0,
      gst_percent: 18,
      is_gst_inclusive: false,
      target_role: "all",
      payment_mode: "ALL",
      is_active: true,
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (rule) => {
    setEditingRule(rule);
    setFormData({
      service_key: rule.service_key,
      min_amount: rule.min_amount,
      max_amount: rule.max_amount,
      fee_type: rule.fee_type || "flat",
      flat_fee: rule.flat_fee || 0,
      percent_fee: rule.percent_fee || 0,
      gst_percent: rule.gst_percent !== undefined ? rule.gst_percent : 18,
      is_gst_inclusive: Boolean(rule.is_gst_inclusive),
      target_role: rule.target_role || "all",
      payment_mode: rule.payment_mode || "ALL",
      is_active: rule.is_active !== undefined ? rule.is_active : true,
    });
    setIsModalOpen(true);
  };

  const handleSubmitModal = (e) => {
    e.preventDefault();
    if (!formData.service_key) {
      toast.error("Please select a service");
      return;
    }

    if (Number(formData.min_amount) < 0 || Number(formData.max_amount) <= Number(formData.min_amount)) {
      toast.error("Max amount must be greater than Min amount");
      return;
    }

    const serviceObj = services.find((s) => s.key === formData.service_key);
    const payload = {
      ...formData,
      service_name: serviceObj?.label || formData.service_key,
      category: serviceObj?.category || "General",
      min_amount: Number(formData.min_amount),
      max_amount: Number(formData.max_amount),
      flat_fee: Number(formData.flat_fee) || 0,
      percent_fee: Number(formData.percent_fee) || 0,
      gst_percent: Number(formData.gst_percent) || 0,
    };

    if (editingRule) {
      updateServiceChargeRule(editingRule.id, payload);
      toast.success(`Charge rule for "${payload.service_name}" updated successfully!`);
    } else {
      addServiceChargeRule(payload);
      toast.success(`New charge rule added for "${payload.service_name}"!`);
    }

    setIsModalOpen(false);
    setEditingRule(null);
    loadData();
  };

  const handleDeleteRule = (id, serviceName) => {
    if (window.confirm(`Are you sure you want to delete this charge slab for ${serviceName}?`)) {
      deleteServiceChargeRule(id);
      toast.success("Charge slab removed.");
      loadData();
    }
  };

  const handleToggleStatus = (id, currentStatus, serviceName) => {
    const newStatus = !currentStatus;
    toggleServiceChargeRuleStatus(id, newStatus);
    toast.info(`Charge rule for ${serviceName} is now ${newStatus ? "Active" : "Inactive"}`);
    loadData();
  };

  const handleResetDefaults = () => {
    if (window.confirm("Reset all service charges to default platform rates? This will restore standard slabs.")) {
      saveAllServiceCharges(DEFAULT_SERVICE_CHARGES);
      toast.success("Default charges restored!");
      loadData();
    }
  };

  return (
    <div className="min-h-screen bg-gray-50/50 p-4 md:p-6 space-y-6">
      {/* HEADER SECTION */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-[#00D3CD]/10 text-[#00D3CD] rounded-xl">
              <FaMoneyBillWave className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Set Service Charges
              </h1>
              <p className="text-xs text-gray-500 mt-0.5">
                Configure platform fee slabs, transaction percentages, and pricing for services active in Service Management.
              </p>
            </div>
          </div>
        </div>

        {/* TOP ACTIONS */}
        <div className="flex flex-wrap items-center gap-3">
          <Link
            to="/super-admin/service-management"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 text-sm font-medium transition shadow-sm"
          >
            <FaSlidersH className="w-4 h-4 text-[#00D3CD]" />
            Manage Services
          </Link>

          <button
            onClick={handleResetDefaults}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 text-sm font-medium transition"
            title="Restore standard platform charge slabs"
          >
            Reset Defaults
          </button>

          <button
            onClick={() => handleOpenAddModal(selectedServiceKey !== "all" ? selectedServiceKey : "")}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#00D3CD] hover:bg-[#00b0ab] text-white text-sm font-semibold shadow-md transition-all duration-200"
          >
            <FaPlus className="w-4 h-4" /> Add Charge Slab
          </button>
        </div>
      </div>

      {/* OVERVIEW STATS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-gray-400">
              Total Services
            </p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{totalPlatformServices}</p>
            <span className="text-[11px] text-teal-600 font-medium bg-teal-50 px-2 py-0.5 rounded-md mt-1 inline-block">
              {configuredServicesCount} configured with charges
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-teal-50 flex items-center justify-center text-[#00D3CD]">
            <FaLayerGroup className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-gray-400">
              Active Charge Rules
            </p>
            <p className="text-2xl font-bold text-emerald-600 mt-1">{activeRulesCount}</p>
            <span className="text-[11px] text-emerald-600 font-medium bg-emerald-50 px-2 py-0.5 rounded-md mt-1 inline-block">
              Out of {totalRules} total slabs
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-500">
            <FaCheckCircle className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-gray-400">
              Configured Categories
            </p>
            <p className="text-2xl font-bold text-indigo-600 mt-1">7 Categories</p>
            <span className="text-[11px] text-indigo-600 font-medium bg-indigo-50 px-2 py-0.5 rounded-md mt-1 inline-block">
              Payout, CC, POS, QR, PG
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-500">
            <FaCoins className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-gray-400">
              Standard GST Rate
            </p>
            <p className="text-2xl font-bold text-blue-600 mt-1">18% GST</p>
            <span className="text-[11px] text-blue-600 font-medium bg-blue-50 px-2 py-0.5 rounded-md mt-1 inline-block">
              Govt Tax Applied on Fees
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-blue-500">
            <FaPercentage className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* SERVICE FILTER BAR & SERVICE CAROUSEL */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 space-y-4">
        {/* Category Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider mr-2">Category:</span>
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => {
                setSelectedCategory(cat);
                setSelectedServiceKey("all");
              }}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-colors ${
                selectedCategory === cat
                  ? "bg-[#00D3CD] text-white shadow-sm"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Quick Service Cards Row */}
        <div className="flex items-center gap-3 overflow-x-auto pb-2 pt-1 scrollbar-hide">
          <button
            onClick={() => setSelectedServiceKey("all")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition border whitespace-nowrap ${
              selectedServiceKey === "all"
                ? "bg-gray-900 text-white border-gray-900 shadow"
                : "bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100"
            }`}
          >
            <span>All Services</span>
            <span className="bg-white/20 px-1.5 py-0.5 rounded-full text-[10px]">
              {chargeRules.length}
            </span>
          </button>

          {services
            .filter((s) => selectedCategory === "All" || s.category === selectedCategory)
            .map((service) => {
              const ruleCount = chargeRules.filter((r) => r.service_key === service.key).length;
              const isEnabled = statusMap[service.key] ?? true;
              const isSelected = selectedServiceKey === service.key;

              return (
                <button
                  key={service.key}
                  onClick={() => setSelectedServiceKey(service.key)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium transition border whitespace-nowrap ${
                    isSelected
                      ? "bg-[#00D3CD] text-white border-[#00D3CD] shadow-sm"
                      : "bg-white text-gray-700 border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${isEnabled ? "bg-emerald-400" : "bg-rose-400"}`} />
                  <span>{service.label}</span>
                  <span
                    className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                      isSelected ? "bg-white/30 text-white" : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {ruleCount}
                  </span>
                </button>
              );
            })}
        </div>

        {/* Search & Filter inputs */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-3 pt-2 border-t border-gray-100">
          <div className="relative w-full md:w-80">
            <FaSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 w-3.5 h-3.5" />
            <input
              type="text"
              placeholder="Search service charges, slabs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-gray-200 bg-gray-50/50 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#00D3CD]/30 focus:border-[#00D3CD]"
            />
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <select
              value={selectedRoleFilter}
              onChange={(e) => setSelectedRoleFilter(e.target.value)}
              className="px-3 py-2 rounded-xl border border-gray-200 bg-white text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#00D3CD]/30"
            >
              <option value="all">Applies To: All Roles</option>
              <option value="merchant">Merchant Only</option>
              <option value="franchise">Franchise Only</option>
              <option value="super_franchise">Super Franchise</option>
              <option value="admin">Admin</option>
            </select>

            <span className="text-xs text-gray-500 whitespace-nowrap">
              Showing <strong className="text-gray-900">{filteredRules.length}</strong> rules
            </span>
          </div>
        </div>
      </div>

      {/* CHARGES DATA TABLE */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50/80 text-gray-500 font-semibold border-b border-gray-100 uppercase tracking-wider">
              <tr>
                <th className="py-3.5 px-4">Service & Category</th>
                <th className="py-3.5 px-4">Slab Range</th>
                <th className="py-3.5 px-4">Charge Structure</th>
                <th className="py-3.5 px-4">GST Tax</th>
                <th className="py-3.5 px-4">Applies To</th>
                <th className="py-3.5 px-4">Transfer Mode</th>
                <th className="py-3.5 px-4 text-center">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-gray-700">
              {filteredRules.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-gray-400">
                    <FaMoneyBillWave className="w-10 h-10 mx-auto text-gray-300 mb-3" />
                    <p className="text-sm font-medium text-gray-600">No charge rules found</p>
                    <p className="text-xs text-gray-400 mt-1">
                      Try adjusting your search filters or click "Add Charge Slab" to set new pricing.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredRules.map((rule) => {
                  const serviceMeta = services.find((s) => s.key === rule.service_key);
                  const serviceLabel = serviceMeta?.label || rule.service_name || rule.service_key;
                  const isServiceGlobalActive = statusMap[rule.service_key] ?? true;

                  return (
                    <tr
                      key={rule.id}
                      className="hover:bg-gray-50/70 transition-colors"
                    >
                      {/* Service & Category */}
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-teal-50 text-[#00D3CD] flex items-center justify-center font-bold text-xs flex-shrink-0">
                            {serviceLabel.charAt(0)}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-gray-900">{serviceLabel}</span>
                              <span
                                className={`text-[10px] px-1.5 py-0.2 rounded font-medium ${
                                  isServiceGlobalActive
                                    ? "bg-emerald-50 text-emerald-600"
                                    : "bg-rose-50 text-rose-500"
                                }`}
                                title={isServiceGlobalActive ? "Enabled in Service Management" : "Disabled in Service Management"}
                              >
                                {isServiceGlobalActive ? "Live" : "Disabled"}
                              </span>
                            </div>
                            <span className="text-[11px] text-gray-400 block mt-0.5">
                              {serviceMeta?.category || rule.category || "General"}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Slab Range */}
                      <td className="py-4 px-4 font-medium text-gray-800">
                        <div className="inline-flex items-center gap-1 bg-gray-50 px-2.5 py-1 rounded-md border border-gray-100">
                          <span>₹{Number(rule.min_amount).toLocaleString()}</span>
                          <span className="text-gray-400">→</span>
                          <span>₹{Number(rule.max_amount).toLocaleString()}</span>
                        </div>
                      </td>

                      {/* Charge Structure */}
                      <td className="py-4 px-4">
                        {rule.fee_type === "flat" && (
                          <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 font-semibold text-xs">
                            <span>Flat ₹{rule.flat_fee}</span>
                          </div>
                        )}
                        {rule.fee_type === "percentage" && (
                          <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-purple-50 text-purple-700 font-semibold text-xs">
                            <span>{rule.percent_fee}% fee</span>
                          </div>
                        )}
                        {rule.fee_type === "both" && (
                          <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-amber-50 text-amber-700 font-semibold text-xs">
                            <span>₹{rule.flat_fee} + {rule.percent_fee}%</span>
                          </div>
                        )}
                      </td>

                      {/* GST Tax */}
                      <td className="py-4 px-4">
                        <span className="text-gray-700 font-medium">
                          {rule.gst_percent || 18}% GST
                        </span>
                        <span className="block text-[10px] text-gray-400">
                          {rule.is_gst_inclusive ? "Inclusive" : "+ Exclusive"}
                        </span>
                      </td>

                      {/* Applies To */}
                      <td className="py-4 px-4">
                        <span className="capitalize px-2 py-0.5 bg-gray-100 rounded text-gray-700 font-medium text-[11px]">
                          {rule.target_role || "All Roles"}
                        </span>
                      </td>

                      {/* Transfer Mode */}
                      <td className="py-4 px-4">
                        <span className="px-2 py-0.5 bg-teal-50 text-[#00a8a3] rounded font-semibold text-[11px]">
                          {rule.payment_mode || "ALL"}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-4 px-4 text-center">
                        <button
                          onClick={() => handleToggleStatus(rule.id, rule.is_active, serviceLabel)}
                          className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                            rule.is_active ? "bg-[#00D3CD]" : "bg-gray-300"
                          }`}
                          title={rule.is_active ? "Click to Deactivate" : "Click to Activate"}
                        >
                          <span
                            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                              rule.is_active ? "translate-x-4" : "translate-x-0"
                            }`}
                          />
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-4 text-right space-x-2">
                        <button
                          onClick={() => handleOpenEditModal(rule)}
                          className="p-1.5 rounded-lg text-indigo-600 hover:bg-indigo-50 transition"
                          title="Edit slab"
                        >
                          <FaEdit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteRule(rule.id, serviceLabel)}
                          className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 transition"
                          title="Delete slab"
                        >
                          <FaTrash className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ADD / EDIT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg border border-gray-100 overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between p-5 border-b border-gray-100 bg-gray-50/50">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-[#00D3CD]/10 text-[#00D3CD] rounded-lg">
                  <FaMoneyBillWave className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-base">
                    {editingRule ? "Edit Service Charge Slab" : "Add Service Charge Slab"}
                  </h3>
                  <p className="text-xs text-gray-500">
                    Set fees and parameters for platform transactions
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 text-lg p-1"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSubmitModal} className="p-5 space-y-4">
              {/* Service Selection */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Target Service <span className="text-rose-500">*</span>
                </label>
                <select
                  value={formData.service_key}
                  onChange={(e) => setFormData({ ...formData, service_key: e.target.value })}
                  disabled={Boolean(editingRule)}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-white text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#00D3CD]/30"
                  required
                >
                  <option value="">Select a service from Service Management</option>
                  {services.map((s) => (
                    <option key={s.key} value={s.key}>
                      {s.label} ({s.category})
                    </option>
                  ))}
                </select>
              </div>

              {/* Min & Max Amount */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Min Amount (₹) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={formData.min_amount}
                    onChange={(e) => setFormData({ ...formData, min_amount: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-white text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#00D3CD]/30"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Max Amount (₹) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="any"
                    value={formData.max_amount}
                    onChange={(e) => setFormData({ ...formData, max_amount: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-white text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#00D3CD]/30"
                    required
                  />
                </div>
              </div>

              {/* Fee Type Selector */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Pricing Model
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: "flat", label: "Flat Fee (₹)" },
                    { id: "percentage", label: "Percentage (%)" },
                    { id: "both", label: "Flat + %" },
                  ].map((type) => (
                    <button
                      key={type.id}
                      type="button"
                      onClick={() => setFormData({ ...formData, fee_type: type.id })}
                      className={`py-2 px-2 rounded-xl text-xs font-medium border text-center transition ${
                        formData.fee_type === type.id
                          ? "bg-[#00D3CD]/10 border-[#00D3CD] text-[#009b96] font-semibold"
                          : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      {type.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Rate Inputs based on Fee Type */}
              <div className="grid grid-cols-2 gap-3">
                {(formData.fee_type === "flat" || formData.fee_type === "both") && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Flat Fee (₹)
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={formData.flat_fee}
                      onChange={(e) => setFormData({ ...formData, flat_fee: e.target.value })}
                      placeholder="e.g. 5.00"
                      className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-white text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#00D3CD]/30"
                    />
                  </div>
                )}
                {(formData.fee_type === "percentage" || formData.fee_type === "both") && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Percentage Fee (%)
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      max="100"
                      value={formData.percent_fee}
                      onChange={(e) => setFormData({ ...formData, percent_fee: e.target.value })}
                      placeholder="e.g. 1.25"
                      className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-white text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#00D3CD]/30"
                    />
                  </div>
                )}
              </div>

              {/* GST & Target Role */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    GST Tax (%)
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={formData.gst_percent}
                    onChange={(e) => setFormData({ ...formData, gst_percent: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-white text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#00D3CD]/30"
                  />
                  <label className="flex items-center gap-1.5 mt-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.is_gst_inclusive}
                      onChange={(e) => setFormData({ ...formData, is_gst_inclusive: e.target.checked })}
                      className="rounded text-[#00D3CD] focus:ring-[#00D3CD]"
                    />
                    <span className="text-[11px] text-gray-500">Inclusive in Fee</span>
                  </label>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Applies To Role
                  </label>
                  <select
                    value={formData.target_role}
                    onChange={(e) => setFormData({ ...formData, target_role: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-white text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#00D3CD]/30"
                  >
                    <option value="all">All Roles</option>
                    <option value="merchant">Merchant</option>
                    <option value="franchise">Franchise</option>
                    <option value="super_franchise">Super Franchise</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
              </div>

              {/* Payment Mode / Transfer Method */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Payment Mode / Routing
                </label>
                <select
                  value={formData.payment_mode}
                  onChange={(e) => setFormData({ ...formData, payment_mode: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-white text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#00D3CD]/30"
                >
                  <option value="ALL">ALL Modes</option>
                  <option value="IMPS">IMPS (Instant)</option>
                  <option value="NEFT">NEFT (Standard)</option>
                  <option value="RTGS">RTGS (High Value)</option>
                  <option value="UPI">UPI</option>
                  <option value="CARD">Debit / Credit Card</option>
                  <option value="T0">T+0 Same Day Settlement</option>
                  <option value="T1">T+1 Next Day Settlement</option>
                </select>
              </div>

              {/* Status checkbox */}
              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="active_status_chk"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="rounded text-[#00D3CD] focus:ring-[#00D3CD] w-4 h-4"
                />
                <label htmlFor="active_status_chk" className="text-xs font-medium text-gray-700 cursor-pointer">
                  Rule is Active & Enforced
                </label>
              </div>

              {/* Modal Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 text-xs font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#00D3CD] hover:bg-[#00b0ab] text-white text-xs font-semibold shadow-md transition"
                >
                  {editingRule ? "Save Changes" : "Create Charge Slab"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SuperAdminSetCharges;
