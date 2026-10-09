import React, { useState, useMemo } from "react";
import {
  FaSlidersH,
  FaSearch,
  FaCheckCircle,
  FaTimesCircle,
  FaSyncAlt,
  FaLock,
  FaShieldAlt,
} from "react-icons/fa";
import { toast } from "react-toastify";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchServiceSettings,
  updateServiceSettings,
} from "../../api/serviceSettingsApi";
import ConfirmationModal from "../../components/Common/ConfirmationModal";

const CATEGORY_ORDER = [
  "Payout & Banking",
  "Bill Payments & BBPS",
  "POS & Hardware",
  "Security & Limits",
  "General",
];

const AdminServiceManagement = () => {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedCategory, setSelectedCategory] = useState("all");

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

  // Query Admin Scoped Services from backend
  const {
    data: rawSettingsData = {},
    isLoading,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ["admin-service-settings"],
    queryFn: fetchServiceSettings,
    staleTime: 30 * 1000,
  });

  // Normalize map to array format
  const servicesList = useMemo(() => {
    if (!rawSettingsData || typeof rawSettingsData !== "object") return [];

    return Object.entries(rawSettingsData).map(([key, config]) => {
      const isObject = typeof config === "object" && config !== null;
      return {
        key,
        service_key: key,
        label: isObject && config.label ? config.label : key.replace(/_/g, " ").toUpperCase(),
        category: isObject && config.category ? config.category : "General",
        description: isObject && config.description ? config.description : "",
        is_enabled: isObject ? config.is_enabled !== false : Boolean(config),
        is_super_admin_disabled: Boolean(isObject && config.is_super_admin_disabled),
      };
    });
  }, [rawSettingsData]);

  // Dynamic Categories from Data
  const categories = useMemo(() => {
    const set = new Set(servicesList.map((s) => s.category));
    return ["all", ...Array.from(set)];
  }, [servicesList]);

  // Statistics
  const stats = useMemo(() => {
    const total = servicesList.length;
    const active = servicesList.filter((s) => s.is_enabled && !s.is_super_admin_disabled).length;
    const disabled = servicesList.filter((s) => !s.is_enabled && !s.is_super_admin_disabled).length;
    const lockedBySuperAdmin = servicesList.filter((s) => s.is_super_admin_disabled).length;
    return { total, active, disabled, lockedBySuperAdmin };
  }, [servicesList]);

  // Filtered Services
  const filteredServices = useMemo(() => {
    return servicesList.filter((s) => {
      const matchesSearch =
        searchTerm === "" ||
        s.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.key.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.category.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesCategory =
        selectedCategory === "all" || s.category === selectedCategory;

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "enabled" && s.is_enabled && !s.is_super_admin_disabled) ||
        (statusFilter === "disabled" && !s.is_enabled && !s.is_super_admin_disabled) ||
        (statusFilter === "locked" && s.is_super_admin_disabled);

      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [servicesList, searchTerm, selectedCategory, statusFilter]);

  // Toggle Mutation
  const toggleMutation = useMutation({
    mutationFn: ({ key, newStatus }) =>
      updateServiceSettings({ [key]: newStatus }),
    onSuccess: (_, variables) => {
      toast.success(
        `Service '${variables.key}' is now ${variables.newStatus ? "enabled" : "disabled"} for your organization.`
      );
      queryClient.invalidateQueries({ queryKey: ["admin-service-settings"] });
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

  const handleToggle = (service) => {
    if (service.is_super_admin_disabled) {
      toast.warning("This service has been disabled globally by Super Admin and cannot be enabled.");
      return;
    }

    const nextStatus = !service.is_enabled;
    const serviceName = service.label || service.key;

    setConfirmConfig({
      isOpen: true,
      title: `${nextStatus ? "Enable" : "Disable"} Service for Organization?`,
      message: nextStatus
        ? `Enabling "${serviceName}" will make it immediately active for your organization, including all associated franchises and merchants.`
        : `Disabling "${serviceName}" will immediately suspend this service across your organization. Franchises and merchants under your company will no longer be able to use it.`,
      confirmText: nextStatus ? "Enable Service" : "Disable Service",
      cancelText: "Cancel",
      variant: nextStatus ? "success" : "danger",
      onConfirm: () => {
        setConfirmConfig((prev) => ({ ...prev, isOpen: false }));
        toggleMutation.mutate({ key: service.key, newStatus: nextStatus });
      },
    });
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 md:p-6 pb-20">
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-[#00D3CD]/10 text-[#00D3CD] flex items-center justify-center text-xl shadow-inner border border-[#00D3CD]/20">
            <FaSlidersH />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-gray-900 tracking-tight">
                Organization Service Management
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#00D3CD]/10 text-[#00a8a3] border border-[#00D3CD]/20">
                Tenant Scoped
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Enable or disable services for your company, franchises, and merchants. Platform-locked services are governed by Super Admin.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-200 transition-colors shadow-sm disabled:opacity-50"
          >
            <FaSyncAlt className={isFetching ? "animate-spin text-[#00D3CD]" : "text-gray-500"} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* METRICS OVERVIEW CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Total Services</p>
            <p className="text-xl font-bold text-gray-900 mt-0.5">{stats.total}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-gray-50 text-gray-600 flex items-center justify-center font-bold text-sm">
            {stats.total}
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-emerald-600 uppercase tracking-wider">Active for Tenant</p>
            <p className="text-xl font-bold text-emerald-600 mt-0.5">{stats.active}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-sm">
            <FaCheckCircle />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-rose-500 uppercase tracking-wider">Disabled for Tenant</p>
            <p className="text-xl font-bold text-rose-600 mt-0.5">{stats.disabled}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-500 flex items-center justify-center font-bold text-sm">
            <FaTimesCircle />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-amber-600 uppercase tracking-wider">Super Admin Locked</p>
            <p className="text-xl font-bold text-amber-600 mt-0.5">{stats.lockedBySuperAdmin}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold text-sm">
            <FaLock />
          </div>
        </div>
      </div>

      {/* SEARCH AND FILTERS */}
      <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
          <div className="relative w-full md:w-80">
            <FaSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs" />
            <input
              type="text"
              placeholder="Search services by name, key, or category..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#00D3CD]/30 focus:border-[#00D3CD] transition-colors"
            />
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 text-xs rounded-xl border border-gray-200 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#00D3CD]/30 font-medium"
            >
              <option value="all">All Statuses</option>
              <option value="enabled">Active Only</option>
              <option value="disabled">Disabled Only</option>
              <option value="locked">Super Admin Locked Only</option>
            </select>
          </div>
        </div>

        {/* CATEGORY PILLS */}
        <div className="flex items-center gap-1.5 overflow-x-auto pt-1 pb-1 scrollbar-none">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                selectedCategory === cat
                  ? "bg-[#00D3CD] text-white shadow-sm"
                  : "bg-gray-50 text-gray-600 hover:bg-gray-100"
              }`}
            >
              {cat === "all" ? "All Categories" : cat}
            </button>
          ))}
        </div>
      </div>

      {/* SERVICES GRID */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div key={n} className="bg-white p-5 rounded-2xl border border-gray-100 animate-pulse space-y-3">
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
              <div className="h-3 bg-gray-100 rounded w-3/4"></div>
              <div className="h-8 bg-gray-100 rounded"></div>
            </div>
          ))}
        </div>
      ) : filteredServices.length === 0 ? (
        <div className="bg-white p-12 text-center rounded-2xl border border-gray-100 shadow-sm">
          <p className="text-sm font-semibold text-gray-700">No services match your criteria.</p>
          <p className="text-xs text-gray-400 mt-1">Try resetting search filters or category selections.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredServices.map((service) => {
            const isLocked = service.is_super_admin_disabled;
            const isEnabled = !isLocked && service.is_enabled;

            return (
              <div
                key={service.key}
                className={`flex flex-col justify-between rounded-2xl p-5 border transition-all ${
                  isLocked
                    ? "border-amber-200 bg-amber-50/30 shadow-sm"
                    : isEnabled
                    ? "border-gray-200 bg-white hover:border-[#00D3CD]/50 shadow-sm"
                    : "border-gray-100 bg-gray-50/60 opacity-80"
                }`}
              >
                <div>
                  {/* Top Bar: Category Pill & Status Tag */}
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-gray-100 text-gray-600">
                      {service.category}
                    </span>

                    {isLocked ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                        <FaLock size={10} /> Locked by Super Admin
                      </span>
                    ) : isEnabled ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                        <FaCheckCircle size={10} /> Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700">
                        <FaTimesCircle size={10} /> Disabled
                      </span>
                    )}
                  </div>

                  {/* Service Title & Key */}
                  <div className="space-y-1">
                    <h3 className="font-bold text-sm text-gray-900 leading-snug">
                      {service.label}
                    </h3>
                    <div className="inline-block">
                      <code className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">
                        {service.key}
                      </code>
                    </div>
                  </div>

                  {/* Description */}
                  {service.description && (
                    <p className="text-xs text-gray-500 mt-2 line-clamp-2 leading-relaxed">
                      {service.description}
                    </p>
                  )}
                </div>

                {/* Footer Switch Action */}
                <div className="pt-4 mt-4 border-t border-gray-100 flex items-center justify-between">
                  <div className="text-[11px]">
                    {isLocked ? (
                      <span className="text-amber-700 font-medium">Locked platform-wide</span>
                    ) : isEnabled ? (
                      <span className="text-emerald-700 font-semibold">Active for all your users</span>
                    ) : (
                      <span className="text-gray-500 font-medium">Suspended for your users</span>
                    )}
                  </div>

                  <button
                    type="button"
                    disabled={isLocked || toggleMutation.isPending}
                    onClick={() => handleToggle(service)}
                    title={
                      isLocked
                        ? "This service is locked globally by Super Admin."
                        : isEnabled
                        ? "Click to disable for your organization"
                        : "Click to enable for your organization"
                    }
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:cursor-not-allowed ${
                      isLocked
                        ? "bg-gray-200 opacity-60"
                        : isEnabled
                        ? "bg-[#00D3CD]"
                        : "bg-gray-300"
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                        isEnabled && !isLocked ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CONFIRMATION MODAL */}
      <ConfirmationModal
        isOpen={confirmConfig.isOpen}
        onClose={() => setConfirmConfig((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={confirmConfig.onConfirm}
        title={confirmConfig.title}
        message={confirmConfig.message}
        confirmText={confirmConfig.confirmText}
        cancelText={confirmConfig.cancelText}
        variant={confirmConfig.variant}
        isLoading={toggleMutation.isPending}
      />
    </div>
  );
};

export default AdminServiceManagement;

