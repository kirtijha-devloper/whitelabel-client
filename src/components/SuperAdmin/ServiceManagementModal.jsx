import React, { useEffect, useState } from "react";
import { X, Check, Loader2 } from "lucide-react";

const SERVICES = [
  { key: "pos", label: "POS" },
  { key: "pg", label: "PG" },
  { key: "qr", label: "QR" },
  { key: "soundbox", label: "Soundbox" },
  { key: "dmt", label: "DMT" },
  { key: "billpayments", label: "Bill Payments" },
];

const ServiceManagementModal = ({
  isOpen,
  onClose,
  company,
  onSave,
}) => {
  const [services, setServices] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!company) return;

    setServices(
      company.services || {
        pos: true,
        pg: true,
        qr: true,
        soundbox: true,
        dmt: true,
        billpayments: true,
      }
    );
  }, [company]);

  if (!isOpen) return null;

  const toggleService = (key) => {
    setServices((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleSave = async () => {
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

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">

        {/* HEADER */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Service Management
            </h2>

            <p className="mt-1 text-xs text-gray-500">
              {company?.company_name || "Company"}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-800"
          >
            <X size={20} />
          </button>
        </div>

        {/* SERVICES */}
        <div className="space-y-3 p-6">
          {SERVICES.map((service) => {
            const enabled = Boolean(services[service.key]);

            return (
              <div
                key={service.key}
                className="flex items-center justify-between rounded-xl border border-gray-200 px-4 py-3"
              >
                <div>
                  <p className="font-medium text-gray-800">
                    {service.label}
                  </p>

                  <p
                    className={`text-xs ${
                      enabled
                        ? "text-green-600"
                        : "text-red-500"
                    }`}
                  >
                    {enabled ? "Service Enabled" : "Service Disabled"}
                  </p>
                </div>

                {/* TOGGLE */}
                <button
                  type="button"
                  onClick={() => toggleService(service.key)}
                  className={`relative h-7 w-12 rounded-full transition ${
                    enabled
                      ? "bg-green-500"
                      : "bg-gray-300"
                  }`}
                >
                  <span
                    className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${
                      enabled
                        ? "left-6"
                        : "left-1"
                    }`}
                  />

                  {enabled && (
                    <Check
                      size={12}
                      className="absolute left-[7px] top-[7px] text-white"
                    />
                  )}
                </button>
              </div>
            );
          })}
        </div>

        {/* FOOTER */}
        <div className="flex justify-end gap-3 border-t border-gray-200 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg border border-gray-300 px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
          >
            {saving && (
              <Loader2 className="h-4 w-4 animate-spin" />
            )}

            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ServiceManagementModal;