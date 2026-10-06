import React, { useState, useEffect } from "react";
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
} from "react-icons/fa";
import { toast } from "react-toastify";
import {
  getRegisteredServices,
  getServiceStatusMap,
  toggleGlobalServiceStatus,
  saveCustomService,
  deleteCustomService,
} from "../../utils/serviceFlags";

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

const SuperAdminServiceManagement = () => {
  const [services, setServices] = useState([]);
  const [statusMap, setStatusMap] = useState({});
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

  const loadData = () => {
    const registered = getRegisteredServices();
    const statuses = getServiceStatusMap();
    setServices(registered);
    setStatusMap(statuses);
  };

  useEffect(() => {
    loadData();

    const handleUpdate = () => {
      loadData();
    };

    window.addEventListener("service_flags_updated", handleUpdate);
    return () => window.removeEventListener("service_flags_updated", handleUpdate);
  }, []);

  const handleToggle = (key, currentStatus) => {
    const newStatus = !currentStatus;
    toggleGlobalServiceStatus(key, newStatus);
    setStatusMap((prev) => ({ ...prev, [key]: newStatus }));

    if (newStatus) {
      toast.success(`Service "${key}" is now ENABLED. Visible to Admin & rest users.`);
    } else {
      toast.info(`Service "${key}" is now DISABLED. Hidden from all users.`);
    }
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
      label: formData.label.trim(),
      category: formData.category,
      description: formData.description.trim() || `Service: ${formData.label}`,
      enabled: formData.enabled,
      target_roles: formData.target_roles,
    };

    saveCustomService(payload);
    toast.success(`Service "${formData.label}" added successfully!`);
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
    loadData();
  };

  const handleDelete = (key, label) => {
    if (window.confirm(`Are you sure you want to remove service "${label}"?`)) {
      deleteCustomService(key);
      toast.success(`Service "${label}" removed.`);
      loadData();
    }
  };

  const handleEditClick = (service) => {
    setEditingService(service);
    setFormData({
      key: service.key,
      label: service.label,
      category: service.category || "Payout & Banking",
      description: service.description || "",
      enabled: statusMap[service.key] ?? true,
      target_roles: service.target_roles || ["admin", "franchise", "merchant"],
    });
    setIsAddModalOpen(true);
  };

  const handleRoleToggle = (role) => {
    setFormData((prev) => {
      const roles = prev.target_roles.includes(role)
        ? prev.target_roles.filter((r) => r !== role)
        : [...prev.target_roles, role];
      return { ...prev, target_roles: roles };
    });
  };

  // Filtering
  const filteredServices = services.filter((s) => {
    const isEnabled = statusMap[s.key] ?? true;
    const matchesSearch =
      s.label?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.key?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.category?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.description?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "enabled" && isEnabled) ||
      (statusFilter === "disabled" && !isEnabled);

    const matchesCategory =
      selectedCategory === "all" || s.category === selectedCategory;

    return matchesSearch && matchesStatus && matchesCategory;
  });

  const totalServices = services.length;
  const enabledCount = services.filter((s) => statusMap[s.key] ?? true).length;
  const disabledCount = totalServices - enabledCount;

  return (
    <div className="min-h-screen bg-gray-50/50 p-6 space-y-6">
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-[#00D3CD]/10 text-[#00D3CD] rounded-xl">
              <FaSlidersH className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Service Management
              </h1>
              <p className="text-xs text-gray-500 mt-0.5">
                Enable or disable platform services. Enabled services are visible to Admin and rest users; disabled services disappear from all users.
              </p>
            </div>
          </div>
        </div>

        {/* ADD NEW SERVICE BUTTON */}
        <div className="flex items-center gap-3">
          <button
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
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#00D3CD] hover:bg-[#00b0ab] text-white text-sm font-semibold shadow-md transition-all duration-200"
          >
            <FaPlus className="w-4 h-4" /> Add New Service
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
            <p className="text-2xl font-bold text-gray-900 mt-1">{totalServices}</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-teal-50 flex items-center justify-center text-[#00D3CD]">
            <FaLayerGroup className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-gray-400">
              Enabled Services
            </p>
            <p className="text-2xl font-bold text-emerald-600 mt-1">{enabledCount}</p>
            <span className="text-[11px] text-emerald-600 font-medium bg-emerald-50 px-2 py-0.5 rounded-md mt-1 inline-block">
              Visible to users
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-500">
            <FaCheckCircle className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-gray-400">
              Disabled Services
            </p>
            <p className="text-2xl font-bold text-rose-600 mt-1">{disabledCount}</p>
            <span className="text-[11px] text-rose-600 font-medium bg-rose-50 px-2 py-0.5 rounded-md mt-1 inline-block">
              Hidden from all users
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-rose-50 flex items-center justify-center text-rose-500">
            <FaTimesCircle className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-gray-400">
              Target Audiences
            </p>
            <p className="text-2xl font-bold text-purple-600 mt-1">4 Roles</p>
            <span className="text-[11px] text-purple-600 font-medium bg-purple-50 px-2 py-0.5 rounded-md mt-1 inline-block">
              Admin / SF / Franchise / Merchant
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-purple-50 flex items-center justify-center text-purple-500">
            <FaUsers className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* SEARCH AND FILTERS */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:w-80">
          <FaSearch className="absolute left-3.5 top-3 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Search service name, key..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00D3CD]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Status Tabs */}
          <div className="inline-flex p-1 bg-gray-100 rounded-xl text-xs font-semibold">
            {["all", "enabled", "disabled"].map((tab) => (
              <button
                key={tab}
                onClick={() => setStatusFilter(tab)}
                className={`px-3 py-1.5 rounded-lg capitalize transition-colors ${
                  statusFilter === tab
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                {tab === "enabled" ? "Enabled (Active)" : tab === "disabled" ? "Disabled (Hidden)" : "All"}
              </button>
            ))}
          </div>

          {/* Category Dropdown */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-2 text-xs font-semibold border border-gray-200 rounded-xl bg-white focus:ring-2 focus:ring-[#00D3CD] focus:outline-none text-gray-700"
          >
            <option value="all">All Categories</option>
            {CATEGORY_OPTIONS.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* SERVICES GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredServices.length > 0 ? (
          filteredServices.map((service) => {
            const isEnabled = statusMap[service.key] ?? true;

            return (
              <div
                key={service.key}
                className={`bg-white rounded-2xl p-5 border transition-all duration-200 flex flex-col justify-between shadow-sm hover:shadow-md ${
                  isEnabled ? "border-gray-200" : "border-rose-200 bg-rose-50/20"
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
                          isEnabled ? "text-emerald-600" : "text-rose-600"
                        }`}
                      >
                        {isEnabled ? "ENABLED" : "DISABLED"}
                      </span>

                      <button
                        type="button"
                        onClick={() => handleToggle(service.key, isEnabled)}
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                          isEnabled ? "bg-emerald-500" : "bg-gray-300"
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
                  <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                    {service.label}
                  </h3>
                  <code className="text-xs text-gray-400 font-mono block mt-0.5">
                    key: {service.key}
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
                        onClick={() => handleEditClick(service)}
                        className="p-1.5 text-gray-400 hover:text-[#00D3CD] rounded-lg hover:bg-gray-100 transition-colors"
                        title="Edit Service"
                      >
                        <FaEdit className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(service.key, service.label)}
                        className="p-1.5 text-gray-400 hover:text-rose-600 rounded-lg hover:bg-gray-100 transition-colors"
                        title="Delete Service"
                      >
                        <FaTrash className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="col-span-full bg-white p-12 rounded-2xl border text-center text-gray-400">
            <FaInfoCircle className="w-8 h-8 mx-auto mb-2 text-gray-300" />
            No services found matching search / filters.
          </div>
        )}
      </div>

      {/* ADD / EDIT SERVICE MODAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-xl p-6 space-y-4">
            <h3 className="text-lg font-bold text-gray-900 border-b pb-3 flex items-center justify-between">
              <span>{editingService ? "Edit Service" : "Add New Platform Service"}</span>
              <button
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
                  placeholder="e.g. Aadhaar Pay / Micro ATM / NFC POS"
                  value={formData.label}
                  onChange={(e) =>
                    setFormData({ ...formData, label: e.target.value })
                  }
                  className="w-full px-3 py-2 text-sm border rounded-xl focus:ring-2 focus:ring-[#00D3CD] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Service Key Identifier (slug)
                </label>
                <input
                  type="text"
                  placeholder="e.g. aadhaar_pay (leave blank to auto-generate)"
                  value={formData.key}
                  disabled={Boolean(editingService)}
                  onChange={(e) =>
                    setFormData({ ...formData, key: e.target.value })
                  }
                  className="w-full px-3 py-2 text-sm border rounded-xl focus:ring-2 focus:ring-[#00D3CD] focus:outline-none disabled:bg-gray-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Category
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) =>
                      setFormData({ ...formData, category: e.target.value })
                    }
                    className="w-full px-3 py-2 text-sm border rounded-xl focus:ring-2 focus:ring-[#00D3CD] focus:outline-none"
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
                    Initial Global Status
                  </label>
                  <select
                    value={formData.enabled ? "true" : "false"}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        enabled: e.target.value === "true",
                      })
                    }
                    className="w-full px-3 py-2 text-sm border rounded-xl focus:ring-2 focus:ring-[#00D3CD] focus:outline-none"
                  >
                    <option value="true">ENABLED (Show to Users)</option>
                    <option value="false">DISABLED (Hide from Users)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  rows="2"
                  placeholder="Brief description of the service..."
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  className="w-full px-3 py-2 text-sm border rounded-xl focus:ring-2 focus:ring-[#00D3CD] focus:outline-none"
                ></textarea>
              </div>

              {/* Roles Checkbox */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-2">
                  Target User Roles
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: "admin", label: "Admin" },
                    { id: "super_franchise", label: "Super Franchise" },
                    { id: "franchise", label: "Franchise" },
                    { id: "merchant", label: "Merchant" },
                  ].map((r) => (
                    <label
                      key={r.id}
                      className="flex items-center gap-2 text-xs font-medium text-gray-700 cursor-pointer bg-gray-50 p-2 rounded-lg border"
                    >
                      <input
                        type="checkbox"
                        checked={formData.target_roles.includes(r.id)}
                        onChange={() => handleRoleToggle(r.id)}
                        className="rounded text-[#00D3CD] focus:ring-[#00D3CD]"
                      />
                      <span>{r.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-sm bg-[#00D3CD] text-white font-semibold rounded-xl hover:bg-[#00b0ab]"
                >
                  {editingService ? "Update Service" : "Save New Service"}
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
