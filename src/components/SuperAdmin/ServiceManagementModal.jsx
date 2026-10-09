import React, { useEffect, useState, useMemo } from "react";
import { X, Check, Loader2, Lock, SlidersHorizontal, ShieldCheck } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { getAdminServices } from "../../api/superAdminApi";
import ConfirmationModal from "../Common/ConfirmationModal";

const FALLBACK_SERVICES = [
  { key: "pos", label: "POS", category: "POS & Hardware" },
  { key: "pg", label: "Payment Gateway", category: "Payment Gateway" },
  { key: "qr", label: "QR Payments", category: "Digital QR" },
  { key: "soundbox", label: "Soundbox", category: "Digital QR" },
  { key: "dmt", label: "DMT & Payouts", category: "Payout & Banking" },
  { key: "billpayments", label: "Bill Payments", category: "Bill Payments" },
];

// Stable empty reference — prevents useQuery's `= {}` default from creating a
// new object on every render, which would cause the useEffect to loop.
const EMPTY_MAP = {};

const ServiceManagementModal = ({
  isOpen,
  onClose,
  company,
  onSave,
}) => {
  const [services, setServices] = useState({});
  const [saving, setSaving] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  // Dynamically fetch admin-specific services with Super Admin lock status
  const { data: adminServicesMap = EMPTY_MAP, isLoading: isFetchingServices } = useQuery({
    queryKey: ["adminServices", company?.id],
    queryFn: () => getAdminServices(company?.id),
    enabled: Boolean(isOpen && company?.id),
    retry: (failureCount, error) => {
      // Don't retry on 404 — resource simply doesn't exist
      if (error?.response?.status === 404) return false;
      return failureCount < 2; // retry up to 2x for other errors
    },
    staleTime: 0,
  });

  // Extract available services from the admin-specific map or fallback
  const availableServices = useMemo(() => {
    const list = Object.values(adminServicesMap || {});
    if (list.length > 0) {
      return list.map((s) => ({
        key: s.key || s.service_key,
        label: s.label || s.key,
        category: s.category || "General",
        is_globally_disabled: Boolean(s.is_super_admin_disabled),
      }));
    }
    return FALLBACK_SERVICES.map((s) => ({
      ...s,
      is_globally_disabled: false,
    }));
  }, [adminServicesMap]);

  useEffect(() => {
    if (!adminServicesMap || Object.keys(adminServicesMap).length === 0) {
      if (!company) return;
      const initial = {};
      const companyServices = company.services || {};
      // availableServices is derived from adminServicesMap — safe to read here
      // without adding it to deps (avoids double-trigger on the same data change)
      FALLBACK_SERVICES.forEach((s) => {
        if (companyServices[s.key] !== undefined) {
          initial[s.key] = Boolean(companyServices[s.key]);
        } else {
          initial[s.key] = true;
        }
      });
      setServices(initial);
      return;
    }

    const initial = {};
    Object.values(adminServicesMap).forEach((s) => {
      const sKey = s.key || s.service_key;
      if (s.is_super_admin_disabled) {
        initial[sKey] = false;
      } else {
        initial[sKey] = s.is_enabled !== false;
      }
    });

    setServices(initial);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminServicesMap, company]); // availableServices intentionally omitted — it's derived from adminServicesMap

  if (!isOpen) return null;

  const toggleService = (key, isGloballyDisabled) => {
    if (isGloballyDisabled) return;
    setServices((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleConfirmSave = async () => {
    setIsConfirmOpen(false);
    try {
      setSaving(true);
      await onSave({
        companyId: company?.id,
        company_id: company?.company_id,
        services,
      });
      onClose();
    } catch (error) {
      console.error("Service update failed:", error);
    } finally {
      setSaving(false);
    }
  };

  const categories = ["all", ...new Set(availableServices.map((s) => s.category))];

  const filteredServices =
    selectedCategory === "all"
      ? availableServices
      : availableServices.filter((s) => s.category === selectedCategory);

  return (
    <>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
        <div className="w-full max-w-xl max-h-[90vh] flex flex-col rounded-2xl bg-white shadow-2xl border border-gray-100 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          {/* HEADER */}
          <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50/80 px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-[#00D3CD]/10 border border-[#00D3CD]/20 p-2 text-[#00D3CD]">
                <SlidersHorizontal size={20} />
              </div>
              <div>
                <h2 className="text-base font-bold text-gray-900">
                  Service Management
                </h2>
                <p className="text-xs text-gray-500">
                  {company?.company_name || company?.name || "Company"} • Admin Scoped
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* CATEGORY TABS */}
          <div className="px-6 py-2.5 border-b border-gray-100 flex items-center gap-1 overflow-x-auto bg-white">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                  selectedCategory === cat
                    ? "bg-[#00D3CD] text-white shadow-sm"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                {cat === "all" ? "All Services" : cat}
              </button>
            ))}
          </div>

          {/* SERVICES LIST */}
          <div className="flex-1 overflow-y-auto p-6 space-y-2.5">
            {isFetchingServices ? (
              <div className="py-12 text-center text-gray-400">
                <Loader2 className="w-6 h-6 animate-spin mx-auto text-[#00D3CD] mb-2" />
                <p className="text-xs">Loading centralized services...</p>
              </div>
            ) : filteredServices.length > 0 ? (
              filteredServices.map((service) => {
                const isLocked = service.is_globally_disabled;
                const isEnabled = isLocked ? false : Boolean(services[service.key]);

                return (
                  <div
                    key={service.key}
                    className={`flex items-center justify-between rounded-xl border px-4 py-3 transition-all ${
                      isLocked
                        ? "border-amber-200 bg-amber-50/40 opacity-75"
                        : isEnabled
                        ? "border-gray-200 bg-white hover:border-[#00D3CD]/40"
                        : "border-gray-100 bg-gray-50/50"
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-sm text-gray-900">
                          {service.label}
                        </p>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">
                          {service.key}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[11px] font-medium text-gray-400">
                          {service.category}
                        </span>
                        {isLocked ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                            <Lock size={10} /> Locked by Super Admin
                          </span>
                        ) : (
                          <span
                            className={`text-[11px] font-bold ${
                              isEnabled ? "text-emerald-600" : "text-rose-500"
                            }`}
                          >
                            {isEnabled ? "Enabled for Tenant" : "Disabled for Tenant"}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* TOGGLE */}
                    <button
                      type="button"
                      disabled={isLocked || saving}
                      onClick={() => toggleService(service.key, isLocked)}
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
                );
              })
            ) : (
              <p className="text-center py-8 text-xs text-gray-400">No services found in this category.</p>
            )}
          </div>

          {/* FOOTER */}
          <div className="flex items-center justify-between border-t border-gray-100 bg-gray-50/80 px-6 py-4">
            <span className="text-xs text-gray-400">
              Changes apply strictly to {company?.company_name || "this admin"} and downstream users.
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="rounded-xl border border-gray-300 px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() => setIsConfirmOpen(true)}
                disabled={saving || isFetchingServices}
                className="inline-flex items-center gap-2 rounded-xl bg-[#00D3CD] hover:bg-[#00bdb7] px-5 py-2 text-xs font-semibold text-white shadow-sm transition-all disabled:opacity-50"
              >
                {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <span>{saving ? "Saving..." : "Save Changes"}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={handleConfirmSave}
        title="Update Tenant Services?"
        message={`Are you sure you want to update service availability for "${company?.company_name || "Company"}"? Enabled services will be available for this Admin and their franchises/merchants.`}
        confirmText="Yes, Update Services"
        cancelText="Review Again"
        variant="primary"
        isLoading={saving}
      />
    </>
  );
};

export default ServiceManagementModal;