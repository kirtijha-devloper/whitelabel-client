import React, { useState } from "react";
import {
  FaSlidersH,
  FaPlus,
  FaSearch,
  FaCheckCircle,
  FaTimesCircle,
  FaTrash,
  FaEdit,
  FaLayerGroup,
  FaUsers,
  FaInfoCircle,
  FaSyncAlt,
} from "react-icons/fa";
import { toast } from "react-toastify";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getSuperAdminServices,
  updateSuperAdminServiceStatus,
  createSuperAdminService,
} from "../../api/superAdminApi";

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

  // Form State
  const [formData, setFormData] = useState({
    key: "",
    label: "",
    category: "Payout & Banking",
    description: "",
    enabled: true,
    target_roles: ["admin", "franchise", "merchant", "super_franchise"],
  });

  // Load real services from backend DB
  const {
    data: services = [],
    isLoading,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ["superAdminServicesList"],
    queryFn: getSuperAdminServices,
  });

  // Toggle Mutation
  const toggleMutation = useMutation({
    mutationFn: ({ key, newStatus }) =>
      updateSuperAdminServiceStatus(key, newStatus),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries(["superAdminServicesList"]);
      queryClient.invalidateQueries(["superAdminServiceWiseReport"]);
      if (variables.newStatus) {
        toast.success(`Service "${variables.key}" is now ENABLED.`);
      } else {
        toast.info(`Service "${variables.key}" is now DISABLED.`);
      }
    },
    onError: (err) => {
      toast.error(err.message || "Failed to update service status");
    },
  });

  // Create / Update Mutation
  const saveMutation = useMutation({
    mutationFn: (payload) => createSuperAdminService(payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries(["superAdminServicesList"]);
      queryClient.invalidateQueries(["superAdminServiceWiseReport"]);
      toast.success(data?.message || "Service saved successfully!");
      setIsAddModalOpen(false);
      setEditingService(null);
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
    toggleMutation.mutate({ key, newStatus: !currentStatus });
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

  const filteredServices = services.filter((s) => {
    const isEnabled = s.is_enabled !== false;
    const key = s.key || s.service_key || "";
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
    <div className={embedded ? "space-y-6" : "min-h-screen bg-gray-50 p-4 md:p-6 space-y-6"}>
      {/* ── Header Section ──────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-5 md:p-6 rounded-2xl shadow-sm border border-gray-200">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-[#00D3CD]/10 text-[#00D3CD] rounded-xl">
              <FaSlidersH className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-gray-900">
                Service Management
              </h1>
              <p className="text-xs text-gray-500 mt-0.5">
                Enable or disable platform services globally across Admin, Franchise, and Merchant roles.
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 text-xs font-semibold shadow-sm transition disabled:opacity-50"
            title="Refresh Services"
          >
            <FaSyncAlt className={`w-3.5 h-3.5 ${isFetching ? "animate-spin text-[#00D3CD]" : ""}`} />
            <span>Refresh</span>
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
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#00D3CD] hover:bg-[#00bdb7] text-white text-xs font-semibold shadow-sm transition-all"
          >
            <FaPlus className="w-3.5 h-3.5" />
            <span>Add New Service</span>
          </button>
        </div>
      </div>

      {/* ── Overview KPI Cards ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Total Services
            </p>
            <p className="text-xl font-bold text-gray-900 mt-1">{totalServices}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-[#00D3CD]/10 flex items-center justify-center text-[#00D3CD]">
            <FaLayerGroup className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Enabled Services
            </p>
            <p className="text-xl font-bold text-green-700 mt-1">{enabledCount}</p>
            <span className="text-[11px] text-green-700 font-medium bg-green-50 px-2 py-0.5 rounded-md mt-1 inline-block border border-green-200">
              Visible to users
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center text-green-600">
            <FaCheckCircle className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Disabled Services
            </p>
            <p className="text-xl font-bold text-red-700 mt-1">{disabledCount}</p>
            <span className="text-[11px] text-red-700 font-medium bg-red-50 px-2 py-0.5 rounded-md mt-1 inline-block border border-red-200">
              Hidden from users
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center text-red-600">
            <FaTimesCircle className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Target Audiences
            </p>
            <p className="text-xl font-bold text-gray-900 mt-1">4 Roles</p>
            <span className="text-[11px] text-gray-600 font-medium bg-gray-100 px-2 py-0.5 rounded-md mt-1 inline-block">
              Admin / SF / Franchise / Merchant
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center text-gray-600">
            <FaUsers className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* ── Search & Filter Toolbar ─────────────────────────────────────────── */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:w-80">
          <FaSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 w-3.5 h-3.5" />
          <input
            type="text"
            placeholder="Search service name, key..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00D3CD] focus:border-[#00D3CD]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Status Tabs */}
          <div className="inline-flex p-1 bg-gray-100 rounded-xl text-xs font-semibold">
            {["all", "enabled", "disabled"].map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setStatusFilter(tab)}
                className={`px-3 py-1.5 rounded-lg capitalize transition-all ${
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

      {/* ── Services Grid ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {isLoading ? (
          <div className="col-span-full bg-white p-12 rounded-xl border border-gray-200 text-center text-gray-400">
            <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-[#00D3CD] border-t-transparent mb-2" />
            <p className="text-xs">Loading services from database...</p>
          </div>
        ) : filteredServices.length > 0 ? (
          filteredServices.map((service) => {
            const isEnabled = service.is_enabled !== false;
            const key = service.key || service.service_key;

            return (
              <div
                key={key}
                className={`bg-white rounded-xl p-5 border transition-all duration-200 flex flex-col justify-between shadow-sm hover:shadow-md ${
                  isEnabled ? "border-gray-200" : "border-red-200 bg-red-50/20"
                }`}
              >
                <div>
                  {/* Top Bar with Category & Toggle */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <span className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-gray-100 text-gray-700">
                      {service.category || "General"}
                    </span>

                    {/* Enable / Disable Switch */}
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs font-bold ${
                          isEnabled ? "text-green-700" : "text-red-700"
                        }`}
                      >
                        {isEnabled ? "ACTIVE" : "DISABLED"}
                      </span>

                      <button
                        type="button"
                        onClick={() => handleToggle(key, isEnabled)}
                        disabled={toggleMutation.isPending}
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                          isEnabled ? "bg-[#00D3CD]" : "bg-gray-300"
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                            isEnabled ? "translate-x-5" : "translate-x-0"
                          }`}
                        />
                      </button>
                    </div>
                  </div>

                  {/* Title & Key */}
                  <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                    {service.label}
                  </h3>
                  <code className="text-xs text-gray-400 font-mono block mt-0.5">
                    key: {key}
                  </code>

                  <p className="text-xs text-gray-600 mt-2 line-clamp-2 leading-relaxed">
                    {service.description}
                  </p>
                </div>

                <div className="mt-4 pt-4 border-t border-gray-100 space-y-3">
                  {/* Target Roles */}
                  <div className="flex flex-wrap gap-1">
                    {(service.target_roles || ["admin", "franchise", "merchant"]).map((role) => (
                      <span
                        key={role}
                        className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-gray-100 text-gray-600"
                      >
                        {role}
                      </span>
                    ))}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-gray-400 font-medium">
                      Status: {isEnabled ? "Visible to All" : "Hidden from All"}
                    </span>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleEditClick(service)}
                        className="p-1.5 text-gray-400 hover:text-[#00D3CD] rounded-lg hover:bg-gray-100 transition-colors"
                        title="Edit Service"
                      >
                        <FaEdit className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="col-span-full bg-white p-12 rounded-xl border border-gray-200 text-center text-gray-400">
            <FaInfoCircle className="w-8 h-8 mx-auto mb-2 text-gray-300" />
            No services found matching search / filters.
          </div>
        )}
      </div>

      {/* ── Add / Edit Modal ─────────────────────────────────────────────────── */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-xl p-6 space-y-4 border border-gray-200">
            <h3 className="text-lg font-bold text-gray-900 border-b border-gray-100 pb-3 flex items-center justify-between">
              <span>{editingService ? "Edit Service" : "Add New Platform Service"}</span>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 text-sm"
              >
                ✕
              </button>
            </h3>

            <form onSubmit={handleAddSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Service Display Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. UPI Dynamic QR"
                  value={formData.label}
                  onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                  className="w-full text-xs border border-gray-300 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-[#00D3CD]"
                />
              </div>

              {!editingService && (
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Service Key (Unique Identifier)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. upi_qr_collection (auto-generated if empty)"
                    value={formData.key}
                    onChange={(e) => setFormData({ ...formData, key: e.target.value })}
                    className="w-full text-xs border border-gray-300 rounded-lg p-2.5 font-mono focus:outline-none focus:ring-2 focus:ring-[#00D3CD]"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Service Category
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full text-xs border border-gray-300 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-[#00D3CD]"
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
                  placeholder="Brief description of this platform service..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full text-xs border border-gray-300 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-[#00D3CD]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Initial Status
                </label>
                <div className="flex items-center gap-4">
                  <label className="inline-flex items-center gap-1.5 text-xs text-gray-700 cursor-pointer">
                    <input
                      type="radio"
                      name="service_status"
                      checked={formData.enabled}
                      onChange={() => setFormData({ ...formData, enabled: true })}
                      className="text-[#00D3CD] focus:ring-[#00D3CD]"
                    />
                    <span>Enabled (Active)</span>
                  </label>
                  <label className="inline-flex items-center gap-1.5 text-xs text-gray-700 cursor-pointer">
                    <input
                      type="radio"
                      name="service_status"
                      checked={!formData.enabled}
                      onChange={() => setFormData({ ...formData, enabled: false })}
                      className="text-[#00D3CD] focus:ring-[#00D3CD]"
                    />
                    <span>Disabled (Hidden)</span>
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-gray-300 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saveMutation.isPending}
                  className="px-4 py-2 rounded-lg bg-[#00D3CD] hover:bg-[#00bdb7] text-white text-xs font-semibold shadow-sm disabled:opacity-50"
                >
                  {saveMutation.isPending ? "Saving..." : editingService ? "Update Service" : "Save Service"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SuperAdminServiceManagement;
