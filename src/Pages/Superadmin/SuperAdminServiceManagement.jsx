import React, { useState } from "react";
import {
  FaSlidersH,
  FaPlus,
  FaSearch,
  FaCheckCircle,
  FaTimesCircle,
  FaEdit,
  FaSyncAlt,
  FaLayerGroup,
} from "react-icons/fa";
import { toast } from "react-toastify";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getSuperAdminServices,
  updateSuperAdminServiceStatus,
  createSuperAdminService,
} from "../../api/superAdminApi";
import ConfirmationModal from "../../components/Common/ConfirmationModal";

const CATEGORY_OPTIONS = [
  "Payout & Banking",
  "Credit Card & Utility",
  "POS & Hardware",
  "Digital QR",
  "Payment Gateway",
  "Financial Controls",
  "Settlement & Limits",
  "Utility & Recharge",
];

const SuperAdminServiceManagement = ({ embedded = false }) => {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedCategory, setSelectedCategory] = useState("all");

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

  // Form State
  const [formData, setFormData] = useState({
    key: "",
    label: "",
    category: "Payout & Banking",
    description: "",
    enabled: true,
    target_roles: ["admin", "franchise", "merchant", "super_franchise"],
  });

  // Query Services directly from PostgreSQL
  const {
    data: services = [],
    isLoading,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ["superAdminServices"],
    queryFn: getSuperAdminServices,
    staleTime: 30 * 1000,
  });

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
      queryClient.invalidateQueries({ queryKey: ["currentUser"] });
      setFormData({
        key: "",
        label: "",
        category: "Payout & Banking",
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
        ? `Enabling "${serviceName}" will make it available platform-wide for Admins to enable for their tenants.`
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
      category: service.category || "Payout & Banking",
      description: service.description || "",
      enabled: service.is_enabled ?? true,
      target_roles: service.target_roles || ["admin", "franchise", "merchant"],
    });
    setIsAddModalOpen(true);
  };

  // Filter Services
  const filteredServices = services.filter((s) => {
    const key = s.key || s.service_key || "";
    const isEnabled = s.is_enabled !== false;
    const label = s.label || "";
    const category = s.category || "";

    const matchesSearch =
      label.toLowerCase().includes(searchTerm.toLowerCase()) ||
      key.toLowerCase().includes(searchTerm.toLowerCase()) ||
      category.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "enabled" && isEnabled) ||
      (statusFilter === "disabled" && !isEnabled);

    const matchesCategory =
      selectedCategory === "all" || category === selectedCategory;

    return matchesSearch && matchesStatus && matchesCategory;
  });

  const totalServices = services.length;
  const enabledCount = services.filter((s) => s.is_enabled !== false).length;
  const disabledCount = totalServices - enabledCount;

  return (
    <div className={embedded ? "space-y-4" : "min-h-screen bg-gray-50 p-4 md:p-6 space-y-4"}>
      {/* ── Compact Header & Quick Stats ─────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl shadow-sm border border-gray-200">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-[#00D3CD]/10 text-[#00D3CD] rounded-xl">
            <FaSlidersH className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900 leading-tight">
              Global Service Settings
            </h1>
            <p className="text-xs text-gray-400">
              Platform Master Switch • Controls global service availability
            </p>
          </div>
        </div>

        {/* Action Buttons & Counters */}
        <div className="flex items-center gap-2">
          {/* Quick Counter Pills */}
          <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 rounded-lg border border-gray-100 text-xs">
            <span className="font-semibold text-gray-500">Total: {totalServices}</span>
            <span className="text-gray-300">•</span>
            <span className="font-bold text-emerald-600">{enabledCount} Active</span>
            <span className="text-gray-300">•</span>
            <span className="font-bold text-rose-500">{disabledCount} Disabled</span>
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
                category: "Payout & Banking",
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

      {/* ── Search & Filter Bar ─────────────────────────────────────────── */}
      <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-200 flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative w-full md:w-72">
          <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-3 h-3" />
          <input
            type="text"
            placeholder="Search service or key..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#00D3CD]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Category Filter */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="text-xs border border-gray-300 rounded-lg px-2.5 py-1.5 bg-white text-gray-700 font-medium focus:ring-1 focus:ring-[#00D3CD]"
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
                className={`px-2.5 py-1 rounded-md capitalize transition-all ${
                  statusFilter === tab
                    ? "bg-[#00D3CD] text-white shadow-sm"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                {tab === "enabled" ? "Active" : tab === "disabled" ? "Disabled" : "All"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Services Grid (Clean, Compact, Minimal Text) ─────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {isLoading ? (
          <div className="col-span-full bg-white p-10 rounded-xl border border-gray-200 text-center text-gray-400">
            <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-[#00D3CD] border-t-transparent mb-2" />
            <p className="text-xs">Loading services...</p>
          </div>
        ) : filteredServices.length > 0 ? (
          filteredServices.map((service) => {
            const isEnabled = service.is_enabled !== false;
            const key = service.key || service.service_key;

            return (
              <div
                key={key}
                className={`bg-white rounded-xl p-4 border transition-all duration-150 shadow-sm hover:border-[#00D3CD]/50 flex flex-col justify-between ${
                  isEnabled ? "border-gray-200" : "border-rose-100 bg-rose-50/20"
                }`}
              >
                <div>
                  {/* Top Header: Category Tag & Switch */}
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-gray-100 text-gray-600">
                      {service.category || "General"}
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
                </div>

                {/* Bottom Bar: Action */}
                <div className="mt-3 pt-2.5 border-t border-gray-100 flex items-center justify-between text-[11px]">
                  <span className="text-gray-400">
                    {isEnabled ? "Platform-wide: Open" : "Platform-wide: Locked"}
                  </span>

                  <button
                    type="button"
                    onClick={() => handleEditClick(service)}
                    className="p-1 text-gray-400 hover:text-[#00D3CD] rounded hover:bg-gray-100 transition-colors"
                    title="Edit Service"
                  >
                    <FaEdit className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          <div className="col-span-full bg-white p-8 rounded-xl border border-gray-200 text-center text-xs text-gray-400">
            No services matching filter criteria.
          </div>
        )}
      </div>

      {/* ── Add / Edit Modal ─────────────────────────────────────────────────── */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-xl p-5 space-y-4 border border-gray-100">
            <h3 className="text-base font-bold text-gray-900 border-b border-gray-100 pb-3 flex items-center justify-between">
              <span>{editingService ? "Edit Service" : "Add Platform Service"}</span>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 text-sm"
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
                  placeholder="e.g. UPI Dynamic QR"
                  value={formData.label}
                  onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                  className="w-full text-xs border border-gray-300 rounded-lg p-2 focus:ring-1 focus:ring-[#00D3CD]"
                />
              </div>

              {!editingService && (
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Service Key
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. upi_qr_collection (optional)"
                    value={formData.key}
                    onChange={(e) => setFormData({ ...formData, key: e.target.value })}
                    className="w-full text-xs border border-gray-300 rounded-lg p-2 font-mono focus:ring-1 focus:ring-[#00D3CD]"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Category
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full text-xs border border-gray-300 rounded-lg p-2 focus:ring-1 focus:ring-[#00D3CD]"
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
                  Status
                </label>
                <div className="flex items-center gap-4 text-xs">
                  <label className="inline-flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="service_status"
                      checked={formData.enabled}
                      onChange={() => setFormData({ ...formData, enabled: true })}
                      className="text-[#00D3CD]"
                    />
                    <span>Enabled</span>
                  </label>
                  <label className="inline-flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="service_status"
                      checked={!formData.enabled}
                      onChange={() => setFormData({ ...formData, enabled: false })}
                      className="text-[#00D3CD]"
                    />
                    <span>Disabled</span>
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-1.5 rounded-lg border border-gray-300 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saveMutation.isPending}
                  className="px-4 py-1.5 rounded-lg bg-[#00D3CD] hover:bg-[#00bdb7] text-white text-xs font-semibold shadow-sm disabled:opacity-50"
                >
                  {saveMutation.isPending ? "Saving..." : editingService ? "Update" : "Save"}
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
