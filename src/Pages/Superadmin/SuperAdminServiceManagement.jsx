import React, { useState, useMemo } from "react";
import {
  FaSlidersH,
  FaPlus,
  FaSearch,
  FaCheckCircle,
  FaTimesCircle,
  FaEdit,
  FaSyncAlt,
  FaLayerGroup,
  FaMoneyBillWave,
  FaCreditCard,
  FaExchangeAlt,
  FaThLarge,
  FaThList,
  FaLock,
  FaInfoCircle,
} from "react-icons/fa";
import { toast } from "react-toastify";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getSuperAdminServices,
  updateSuperAdminServiceStatus,
  createSuperAdminService,
} from "../../api/superAdminApi";
import ConfirmationModal from "../../components/Common/ConfirmationModal";

// Canonical metadata resolution for known platform services (Mapped to 3 Core Categories)
const CANONICAL_SERVICE_META = {
  // Payout Services
  vimo_payout: { label: "Vimo Payout", category: "Payout", description: "Vimo Native Payout Gateway Integration" },
  branchx_payout: { label: "BranchX Payout", category: "Payout", description: "BranchX Direct High-Speed Payout Service" },
  sevenpay_payout: { label: "SevenPay Payout", category: "Payout", description: "SevenPay Payout Gateway Integration" },
  ndia5_payout: { label: "PAYOUT-N (Ndia5)", category: "Payout", description: "NDIA5 Direct Bank Settlement Gateway" },
  mx_payout: { label: "Payout MX", category: "Payout", description: "MeroRecharge MX Payout Gateway Integration" },
  aadhaar_pay: { label: "Aadhaar Pay AEPS", category: "Payout", description: "Biometric Aadhaar cash withdrawal service" },

  // CC Bill Services
  cc_bill_pay: { label: "CC Bill Pay", category: "CC Bill", description: "InstantPay Credit Card Bill Payment Engine" },
  ba_cc_bill_pay: { label: "BA CC Bill Pay", category: "CC Bill", description: "BillAvenue BBPS Credit Card Bill Payment" },
  cc_bill_3: { label: "CC Bill 3", category: "CC Bill", description: "CC Bill 3 Bank-Callback Payment Route" },

  // Payin Services
  pos_t0_settlement: { label: "POS Settlement Evaluator", category: "Payin", description: "Dynamic Money-In T0/T1 settlement evaluation and daily limits" },
  user_daily_limit: { label: "User Daily Limit", category: "Payin", description: "Daily payout transaction volume limit enforcement across users" },
  pos_inventory: { label: "POS Machine Hardware", category: "Payin", description: "POS terminal machine inventory and merchant assignment" },
  qr_inventory: { label: "QR Standees & Soundboxes", category: "Payin", description: "Physical QR code standees and 4G voice soundbox hardware" },
  pg_inventory: { label: "PG MID Routing", category: "Payin", description: "Payment Gateway MIDs and aggregator routing services" },
  qr_payments: { label: "QR & Soundbox Payments", category: "Payin", description: "Dynamic UPI soundbox audio notifications and standee collections" },
};

// Safe Category Normalization Helper to map legacy / custom categories into the 3 Core Categories
export const normalizeCategory = (category, serviceKey = "") => {
  if (serviceKey && CANONICAL_SERVICE_META[serviceKey]) {
    return CANONICAL_SERVICE_META[serviceKey].category;
  }
  const cleanCat = String(category || "").trim().toLowerCase();
  if (cleanCat.includes("payout") || cleanCat.includes("bank") || cleanCat === "payout") {
    return "Payout";
  }
  if (cleanCat.includes("cc") || cleanCat.includes("credit") || cleanCat.includes("bill") || cleanCat === "cc bill") {
    return "CC Bill";
  }
  if (
    cleanCat.includes("payin") ||
    cleanCat.includes("pos") ||
    cleanCat.includes("qr") ||
    cleanCat.includes("gateway") ||
    cleanCat.includes("settlement") ||
    cleanCat.includes("limit") ||
    cleanCat.includes("hardware") ||
    cleanCat.includes("financial")
  ) {
    return "Payin";
  }
  return "Payin"; // Safe fallback for any custom or unknown service
};

// Recognized Service Categories with Rich Visual Metadata (Exactly 3 Categories)
const CATEGORY_DEFINITIONS = [
  {
    id: "payout",
    name: "Payout",
    shortName: "Payout",
    icon: FaMoneyBillWave,
    description: "Bank transfer & payout gateways (Vimo, BranchX, SevenPay, Ndia5, MX, Aadhaar Pay)",
    headerBg: "bg-blue-50 border-blue-200 text-blue-900",
    badgeBg: "bg-blue-50 text-blue-700 border-blue-200",
    iconColor: "text-blue-600 bg-blue-100/70",
  },
  {
    id: "cc_bill",
    name: "CC Bill",
    shortName: "CC Bill",
    icon: FaCreditCard,
    description: "Credit card bill payment routes & BBPS services (CC Bill Pay, BA CC Bill Pay, CC Bill 3)",
    headerBg: "bg-purple-50 border-purple-200 text-purple-900",
    badgeBg: "bg-purple-50 text-purple-700 border-purple-200",
    iconColor: "text-purple-600 bg-purple-100/70",
  },
  {
    id: "payin",
    name: "Payin",
    shortName: "Payin",
    icon: FaExchangeAlt,
    description: "POS Settlement, User Daily Limit, POS Hardware, QR Standees, Soundboxes, and PG Routing",
    headerBg: "bg-emerald-50 border-emerald-200 text-emerald-900",
    badgeBg: "bg-emerald-50 text-emerald-700 border-emerald-200",
    iconColor: "text-emerald-600 bg-emerald-100/70",
  },
];

// Dropdown options strictly limited to the 3 approved categories
const CATEGORY_OPTIONS = ["Payout", "CC Bill", "Payin"];

const SuperAdminServiceManagement = ({ embedded = false }) => {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [viewMode, setViewMode] = useState("grouped"); // "grouped" | "grid"

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingService, setEditingService] = useState(null);

  // Confirmation Modal State
  const [confirmConfig, setConfirmConfig] = useState({
    isOpen: false,
    title: "",
    message: "",
    confirmText: "Confirm",
    cancelText: "Cancel",
    variant: "primary",
    onConfirm: () => {},
  });

  // Form State: Defaults category to "Payout"
  const [formData, setFormData] = useState({
    key: "",
    label: "",
    category: "Payout",
    description: "",
    enabled: true,
    target_roles: ["admin", "franchise", "merchant", "super_franchise"],
  });

  // Query Services directly from PostgreSQL
  const {
    data: rawServices = [],
    isLoading,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ["superAdminServices"],
    queryFn: getSuperAdminServices,
    staleTime: 30 * 1000,
  });

  const services = useMemo(() => {
    return (rawServices || [])
      .filter((s) => (s?.key || s?.service_key) !== "mx_payout")
      .map((s) => {
        const key = s?.key || s?.service_key || "";
        const canonical = CANONICAL_SERVICE_META[key] || {};
        const resolvedCategory = normalizeCategory(s?.category, key);
        const resolvedLabel = s?.label || canonical.label || key;
        const resolvedDesc = s?.description || canonical.description || "";
        const isEnabled =
          s?.is_enabled !== undefined
            ? s.is_enabled
            : s?.enabled !== undefined
            ? s.enabled
            : true;

        return {
          ...s,
          key,
          service_key: key,
          label: resolvedLabel,
          category: resolvedCategory,
          description: resolvedDesc,
          is_enabled: isEnabled,
        };
      });
  }, [rawServices]);

  // Toggle Mutation
  const toggleMutation = useMutation({
    mutationFn: ({ key, newStatus }) =>
      updateSuperAdminServiceStatus(key, newStatus),
    onSuccess: (_, variables) => {
      toast.success(
        `Service '${variables.key}' is now ${variables.newStatus ? "enabled" : "disabled"}`
      );
      queryClient.invalidateQueries({ queryKey: ["superAdminServices"] });
      queryClient.invalidateQueries({ queryKey: ["admin-service-settings"] });
      queryClient.invalidateQueries({ queryKey: ["adminServices"] });
      queryClient.invalidateQueries({ queryKey: ["currentUser"] });
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("service_flags_updated", {
            detail: { serviceKey: variables.key, enabled: variables.newStatus },
          })
        );
      }
    },
    onError: (err) => {
      toast.error(err.message || "Failed to update service status");
    },
  });

  // Save Mutation
  const saveMutation = useMutation({
    mutationFn: (payload) => createSuperAdminService(payload),
    onSuccess: (res) => {
      toast.success(res.message || "Service saved successfully");
      setIsAddModalOpen(false);
      setEditingService(null);
      queryClient.invalidateQueries({ queryKey: ["superAdminServices"] });
      queryClient.invalidateQueries({ queryKey: ["admin-service-settings"] });
      queryClient.invalidateQueries({ queryKey: ["adminServices"] });
      queryClient.invalidateQueries({ queryKey: ["currentUser"] });
      setFormData({
        key: "",
        label: "",
        category: "Payout",
        description: "",
        enabled: true,
        target_roles: ["admin", "franchise", "merchant", "super_franchise"],
      });
    },
    onError: (err) => {
      toast.error(err.message || "Failed to save service");
    },
  });

  const handleToggle = (key, currentStatus) => {
    const nextStatus = !currentStatus;
    const serviceObj = services.find((s) => (s.key || s.service_key) === key);
    const serviceName = serviceObj?.label || key;

    setConfirmConfig({
      isOpen: true,
      title: `${nextStatus ? "Enable" : "Disable"} Service Globally?`,
      message: nextStatus
        ? `Enabling "${serviceName}" will make it available platform-wide for Admins to activate for their tenants.`
        : `Disabling "${serviceName}" will immediately lock and deactivate this service platform-wide for all Admins, Franchises, and Merchants. Admins cannot override this lock.`,
      confirmText: nextStatus ? "Enable Service" : "Disable Service",
      cancelText: "Cancel",
      variant: nextStatus ? "success" : "danger",
      onConfirm: () => {
        setConfirmConfig((prev) => ({ ...prev, isOpen: false }));
        toggleMutation.mutate({ key, newStatus: nextStatus });
      },
    });
  };

  const handleAddSubmit = (e) => {
    e.preventDefault();
    if (!formData.label.trim()) {
      toast.error("Please enter a Service Name");
      return;
    }

    const generatedKey =
      formData.key.trim().toLowerCase().replace(/\s+/g, "_") ||
      formData.label.trim().toLowerCase().replace(/\s+/g, "_");

    const payload = {
      key: generatedKey,
      service_key: generatedKey,
      label: formData.label.trim(),
      category: formData.category,
      description: formData.description.trim() || `Service: ${formData.label}`,
      is_enabled: formData.enabled,
      target_roles: formData.target_roles,
    };

    saveMutation.mutate(payload);
  };

  const handleEditClick = (service) => {
    setEditingService(service);
    setFormData({
      key: service.key || service.service_key,
      label: service.label,
      category: normalizeCategory(service.category, service.key || service.service_key),
      description: service.description || "",
      enabled: service.is_enabled ?? true,
      target_roles: service.target_roles || ["admin", "franchise", "merchant"],
    });
    setIsAddModalOpen(true);
  };

  // Filter Services
  const filteredServices = useMemo(() => {
    return services.filter((s) => {
      const key = s.key || s.service_key || "";
      const isEnabled = s.is_enabled !== false;
      const label = s.label || "";
      const category = s.category || "";
      const description = s.description || "";

      const matchesSearch =
        searchTerm === "" ||
        label.toLowerCase().includes(searchTerm.toLowerCase()) ||
        key.toLowerCase().includes(searchTerm.toLowerCase()) ||
        category.toLowerCase().includes(searchTerm.toLowerCase()) ||
        description.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "enabled" && isEnabled) ||
        (statusFilter === "disabled" && !isEnabled);

      const matchesCategory =
        selectedCategory === "all" || category === selectedCategory;

      return matchesSearch && matchesStatus && matchesCategory;
    });
  }, [services, searchTerm, statusFilter, selectedCategory]);

  // Overall Statistics
  const totalServices = services.length;
  const enabledCount = services.filter((s) => s.is_enabled !== false).length;
  const disabledCount = totalServices - enabledCount;

  // Category Stats Map for the 3 Categories
  const categoryStats = useMemo(() => {
    const stats = {};
    CATEGORY_DEFINITIONS.forEach((cat) => {
      const catServices = services.filter((s) => s.category === cat.name);
      stats[cat.name] = {
        total: catServices.length,
        enabled: catServices.filter((s) => s.is_enabled !== false).length,
      };
    });
    return stats;
  }, [services]);

  // Grouped Services for Category View (Exactly 3 Groups, No 'Other Services' group)
  const groupedServices = useMemo(() => {
    const groups = [];
    CATEGORY_DEFINITIONS.forEach((catDef) => {
      const matched = filteredServices.filter((s) => s.category === catDef.name);
      if (matched.length > 0) {
        groups.push({
          ...catDef,
          services: matched,
        });
      }
    });
    return groups;
  }, [filteredServices]);

  // Active Category Meta
  const activeCategoryMeta = useMemo(() => {
    return CATEGORY_DEFINITIONS.find((c) => c.name === selectedCategory) || null;
  }, [selectedCategory]);

  // Render a Single Service Card
  const renderServiceCard = (service) => {
    const isEnabled = service.is_enabled !== false;
    const key = service.key || service.service_key;
    const catDef = CATEGORY_DEFINITIONS.find((c) => c.name === service.category);
    const CatIcon = catDef?.icon || FaLayerGroup;

    return (
      <div
        key={key}
        className={`bg-white rounded-xl p-4 border transition-all duration-150 shadow-sm hover:shadow-md flex flex-col justify-between ${
          isEnabled
            ? "border-gray-200 hover:border-[#00D3CD]/50"
            : "border-rose-100 bg-rose-50/20"
        }`}
      >
        <div>
          {/* Top Header: Category Tag & Switch */}
          <div className="flex items-center justify-between gap-2 mb-2">
            <span
              className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${
                catDef?.badgeBg || "bg-gray-50 text-gray-700 border-gray-200"
              }`}
            >
              <CatIcon className="w-3 h-3" />
              <span>{catDef?.shortName || service.category}</span>
            </span>

            {/* Enable / Disable Switch */}
            <div className="flex items-center gap-1.5">
              <span
                className={`text-[11px] font-bold ${
                  isEnabled ? "text-emerald-600" : "text-rose-500"
                }`}
              >
                {isEnabled ? "Active" : "Disabled"}
              </span>

              <button
                type="button"
                onClick={() => handleToggle(key, isEnabled)}
                disabled={toggleMutation.isPending}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  isEnabled ? "bg-[#00D3CD]" : "bg-gray-300"
                }`}
                title={isEnabled ? "Click to Disable Globally" : "Click to Enable Globally"}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    isEnabled ? "translate-x-4" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Title & Key */}
          <h3 className="text-sm font-bold text-gray-900 leading-snug">
            {service.label}
          </h3>
          <code className="text-[11px] text-gray-400 font-mono mt-0.5 block">
            {key}
          </code>

          {/* Description */}
          {service.description && (
            <p className="text-xs text-gray-500 mt-2 line-clamp-2 leading-relaxed">
              {service.description}
            </p>
          )}

          {/* Target Roles Pills */}
          {Array.isArray(service.target_roles) && service.target_roles.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2.5">
              {service.target_roles.map((role) => (
                <span
                  key={role}
                  className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-600 capitalize"
                >
                  {role.replace(/_/g, " ")}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Bottom Bar: Action & Platform Scope */}
        <div className="mt-3 pt-2.5 border-t border-gray-100 flex items-center justify-between text-[11px]">
          <span
            className={`inline-flex items-center gap-1 font-medium ${
              isEnabled ? "text-emerald-600" : "text-rose-600 font-semibold"
            }`}
          >
            {isEnabled ? (
              <>
                <FaCheckCircle className="w-2.5 h-2.5" />
                <span>Platform Available</span>
              </>
            ) : (
              <>
                <FaLock className="w-2.5 h-2.5 text-rose-500" />
                <span>Platform Locked</span>
              </>
            )}
          </span>

          <button
            type="button"
            onClick={() => handleEditClick(service)}
            className="inline-flex items-center gap-1 px-2 py-1 text-gray-500 hover:text-[#00D3CD] rounded hover:bg-gray-100 transition-colors text-xs font-medium"
            title="Edit Service Details"
          >
            <FaEdit className="w-3 h-3" />
            <span>Edit</span>
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className={embedded ? "space-y-4" : "min-h-screen bg-gray-50 p-4 md:p-6 space-y-4"}>
      {/* ── Compact Header & Quick Stats ─────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl shadow-sm border border-gray-200">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-[#00D3CD]/10 text-[#00D3CD] rounded-xl border border-[#00D3CD]/20">
            <FaSlidersH className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-gray-900 leading-tight">
                Global Service Settings
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#00D3CD]/10 text-[#009b96] border border-[#00D3CD]/20">
                Super Admin Master Control
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              Govern platform-wide service availability across Payout, CC Bill, and Payin services
            </p>
          </div>
        </div>

        {/* Action Buttons & Quick Stats Counters */}
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          {/* Quick Counter Pills */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 rounded-lg border border-gray-100 text-xs">
            <span className="font-semibold text-gray-500">Total: {totalServices}</span>
            <span className="text-gray-300">•</span>
            <span className="font-bold text-emerald-600">{enabledCount} Active</span>
            <span className="text-gray-300">•</span>
            <span className="font-bold text-rose-500">{disabledCount} Locked</span>
          </div>

          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="p-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 text-xs transition disabled:opacity-50"
            title="Refresh Services"
          >
            <FaSyncAlt className={`w-3.5 h-3.5 ${isFetching ? "animate-spin text-[#00D3CD]" : ""}`} />
          </button>

          <button
            type="button"
            onClick={() => {
              setEditingService(null);
              setFormData({
                key: "",
                label: "",
                category: "Payout",
                description: "",
                enabled: true,
                target_roles: ["admin", "franchise", "merchant", "super_franchise"],
              });
              setIsAddModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#00D3CD] hover:bg-[#00bdb7] text-white text-xs font-semibold shadow-sm transition-all"
          >
            <FaPlus className="w-3 h-3" />
            <span>Add Service</span>
          </button>
        </div>
      </div>

      {/* ── Category Navigation Tabs (Exactly 3 Categories: Payout, CC Bill, Payin) ──────── */}
      <div className="bg-white p-2.5 rounded-xl shadow-sm border border-gray-200">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs no-scrollbar">
          {/* All Services Tab */}
          <button
            type="button"
            onClick={() => setSelectedCategory("all")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg font-semibold whitespace-nowrap transition-all ${
              selectedCategory === "all"
                ? "bg-[#00D3CD] text-white shadow-sm"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            <FaLayerGroup className="w-3.5 h-3.5" />
            <span>All Categories</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                selectedCategory === "all"
                  ? "bg-white/20 text-white"
                  : "bg-gray-200/70 text-gray-700"
              }`}
            >
              {totalServices}
            </span>
          </button>

          {/* Three Core Category Tabs */}
          {CATEGORY_DEFINITIONS.map((cat) => {
            const Icon = cat.icon;
            const stats = categoryStats[cat.name] || { total: 0, enabled: 0 };
            const isSelected = selectedCategory === cat.name;

            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.name)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg font-semibold whitespace-nowrap transition-all ${
                  isSelected
                    ? "bg-[#00D3CD] text-white shadow-sm"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
                title={cat.description}
              >
                <Icon className={`w-3.5 h-3.5 ${isSelected ? "text-white" : ""}`} />
                <span>{cat.name}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                    isSelected
                      ? "bg-white/20 text-white"
                      : "bg-gray-200/70 text-gray-700"
                  }`}
                >
                  {stats.enabled}/{stats.total}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Active Category Overview Banner (When specific category selected) ──────── */}
      {activeCategoryMeta && (
        <div className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${activeCategoryMeta.headerBg}`}>
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl shadow-sm ${activeCategoryMeta.iconColor}`}>
              <activeCategoryMeta.icon className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold leading-tight">
                  {activeCategoryMeta.name}
                </h2>
                <span className="text-[11px] font-medium opacity-75">
                  ({categoryStats[activeCategoryMeta.name]?.total || 0} Services Configured)
                </span>
              </div>
              <p className="text-xs opacity-80 mt-0.5">
                {activeCategoryMeta.description}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs font-semibold">
            <span className="px-2.5 py-1 rounded-md bg-white/70 shadow-sm text-emerald-700">
              {categoryStats[activeCategoryMeta.name]?.enabled || 0} Active Platform-wide
            </span>
            <span className="px-2.5 py-1 rounded-md bg-white/70 shadow-sm text-rose-700">
              {(categoryStats[activeCategoryMeta.name]?.total || 0) - (categoryStats[activeCategoryMeta.name]?.enabled || 0)} Locked
            </span>
          </div>
        </div>
      )}

      {/* ── Search & Filter Controls Bar ─────────────────────────────────────────── */}
      <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-200 flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative w-full md:w-80">
          <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-3.5 h-3.5" />
          <input
            type="text"
            placeholder="Search service name, key, or category..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#00D3CD]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Category Dropdown (Exactly 3 Options + All) */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="text-xs border border-gray-300 rounded-lg px-3 py-1.5 bg-white text-gray-700 font-semibold focus:ring-1 focus:ring-[#00D3CD] focus:outline-none"
          >
            <option value="all">All Categories</option>
            {CATEGORY_OPTIONS.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>

          {/* Status Tabs */}
          <div className="inline-flex p-0.5 bg-gray-100 rounded-lg text-xs font-semibold">
            {["all", "enabled", "disabled"].map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setStatusFilter(tab)}
                className={`px-3 py-1.5 rounded-md capitalize transition-all ${
                  statusFilter === tab
                    ? "bg-[#00D3CD] text-white shadow-sm"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                {tab === "enabled" ? "Active" : tab === "disabled" ? "Locked" : "All Status"}
              </button>
            ))}
          </div>

          {/* View Mode Toggle (Sections vs Flat Grid) */}
          <div className="inline-flex p-0.5 bg-gray-100 rounded-lg text-xs font-semibold">
            <button
              type="button"
              onClick={() => setViewMode("grouped")}
              className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md transition-all ${
                viewMode === "grouped"
                  ? "bg-white text-[#00D3CD] shadow-sm font-bold"
                  : "text-gray-500 hover:text-gray-800"
              }`}
              title="Group by Category"
            >
              <FaThList className="w-3 h-3" />
              <span>Sections</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md transition-all ${
                viewMode === "grid"
                  ? "bg-white text-[#00D3CD] shadow-sm font-bold"
                  : "text-gray-500 hover:text-gray-800"
              }`}
              title="Flat Grid View"
            >
              <FaThLarge className="w-3 h-3" />
              <span>Grid</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Services Content View ─────────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="bg-white p-12 rounded-xl border border-gray-200 text-center text-gray-400">
          <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-[#00D3CD] border-t-transparent mb-2" />
          <p className="text-xs font-medium">Loading centralized platform services from database...</p>
        </div>
      ) : filteredServices.length === 0 ? (
        <div className="bg-white p-12 rounded-xl border border-gray-200 text-center text-gray-400 space-y-2">
          <FaInfoCircle className="w-8 h-8 text-gray-300 mx-auto" />
          <p className="text-sm font-semibold text-gray-700">No Services Found</p>
          <p className="text-xs text-gray-400 max-w-sm mx-auto">
            No services match your search or filter criteria. Try adjusting your filters or resetting the category selection.
          </p>
          <button
            type="button"
            onClick={() => {
              setSearchTerm("");
              setStatusFilter("all");
              setSelectedCategory("all");
            }}
            className="mt-2 px-3 py-1.5 rounded-lg border border-gray-300 text-xs font-medium text-gray-600 hover:bg-gray-50 transition"
          >
            Reset Filters
          </button>
        </div>
      ) : viewMode === "grouped" ? (
        /* ── Grouped Sections View (Payout, CC Bill, Payin) ── */
        <div className="space-y-6">
          {groupedServices.map((group) => {
            const GroupIcon = group.icon;
            const activeInGroup = group.services.filter((s) => s.is_enabled !== false).length;
            const totalInGroup = group.services.length;

            return (
              <div
                key={group.id}
                className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden"
              >
                {/* Section Header */}
                <div className={`p-4 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${group.headerBg}`}>
                  <div className="flex items-center gap-2.5">
                    <div className={`p-2 rounded-lg ${group.iconColor}`}>
                      <GroupIcon className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-sm font-bold text-gray-900">
                          {group.name}
                        </h2>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-white/80 border border-gray-200/60 text-gray-700">
                          {totalInGroup} {totalInGroup === 1 ? "Service" : "Services"}
                        </span>
                      </div>
                      <p className="text-xs text-gray-600 mt-0.5">
                        {group.description}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-semibold text-emerald-700 bg-white/70 px-2.5 py-1 rounded-md shadow-sm">
                      {activeInGroup} Active
                    </span>
                    {totalInGroup - activeInGroup > 0 && (
                      <span className="font-semibold text-rose-700 bg-white/70 px-2.5 py-1 rounded-md shadow-sm">
                        {totalInGroup - activeInGroup} Locked
                      </span>
                    )}
                  </div>
                </div>

                {/* Section Grid */}
                <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 bg-gray-50/40">
                  {group.services.map((service) => renderServiceCard(service))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ── Flat Grid View ── */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredServices.map((service) => renderServiceCard(service))}
        </div>
      )}

      {/* ── Add / Edit Service Modal (Category: Payout, CC Bill, Payin) ───────────── */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-xl p-5 space-y-4 border border-gray-100 animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-base font-bold text-gray-900 border-b border-gray-100 pb-3 flex items-center justify-between">
              <span>{editingService ? "Edit Service" : "Add Platform Service"}</span>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 text-sm p-1 rounded-lg hover:bg-gray-100"
              >
                ✕
              </button>
            </h3>

            <form onSubmit={handleAddSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Service Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Vimo Payout"
                  value={formData.label}
                  onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                  className="w-full text-xs border border-gray-300 rounded-lg p-2.5 focus:ring-1 focus:ring-[#00D3CD] focus:outline-none"
                />
              </div>

              {!editingService && (
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Service Key
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. vimo_payout (optional, auto-generated)"
                    value={formData.key}
                    onChange={(e) => setFormData({ ...formData, key: e.target.value })}
                    className="w-full text-xs border border-gray-300 rounded-lg p-2.5 font-mono focus:ring-1 focus:ring-[#00D3CD] focus:outline-none"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Service Category *
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full text-xs border border-gray-300 rounded-lg p-2.5 focus:ring-1 focus:ring-[#00D3CD] focus:outline-none bg-white font-medium text-gray-800"
                >
                  {CATEGORY_OPTIONS.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  placeholder="Brief summary of service functionality..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full text-xs border border-gray-300 rounded-lg p-2.5 focus:ring-1 focus:ring-[#00D3CD] focus:outline-none resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Initial Global Status
                </label>
                <div className="flex items-center gap-4 text-xs pt-0.5">
                  <label className="inline-flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="service_status"
                      checked={formData.enabled}
                      onChange={() => setFormData({ ...formData, enabled: true })}
                      className="text-[#00D3CD]"
                    />
                    <span className="font-medium text-emerald-600">Enabled (Platform Available)</span>
                  </label>
                  <label className="inline-flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="service_status"
                      checked={!formData.enabled}
                      onChange={() => setFormData({ ...formData, enabled: false })}
                      className="text-[#00D3CD]"
                    />
                    <span className="font-medium text-rose-500">Disabled (Platform Locked)</span>
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-gray-300 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saveMutation.isPending}
                  className="px-4 py-2 rounded-lg bg-[#00D3CD] hover:bg-[#00bdb7] text-white text-xs font-semibold shadow-sm transition disabled:opacity-50"
                >
                  {saveMutation.isPending ? "Saving..." : editingService ? "Update Service" : "Save Service"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Confirmation Modal ── */}
      <ConfirmationModal
        isOpen={confirmConfig.isOpen}
        onClose={() => setConfirmConfig((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={confirmConfig.onConfirm}
        title={confirmConfig.title}
        message={confirmConfig.message}
        confirmText={confirmConfig.confirmText}
        cancelText={confirmConfig.cancelText}
        variant={confirmConfig.variant}
      />
    </div>
  );
};

export default SuperAdminServiceManagement;
