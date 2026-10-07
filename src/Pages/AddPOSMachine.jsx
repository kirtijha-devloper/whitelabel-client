import React, { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { createPosMachine } from "../api/posMachine";
import { getCompanyNames } from "../api/companyName";
import FormInput from "../components/FormInput";

const logStockPosCreateUi = () => {};

const AddPOSMachine = ({ currentUser }) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    tid_number: "",
    mid_number: "",
    device_serial_number: "",
    company_name: "",
    remarks: "",
    razorpay_id: "",
    bank_name: "",
  });

  const normalizedRole = String(currentUser?.role || "").trim().toLowerCase();
  const redirectUrl = normalizedRole === "admin"
    ? "/admin/stock-pos"
    : normalizedRole === "super_admin"
      ? "/super-admin/inventory/pos"
      : "/franchise/stock-pos";

  const {
    data: companyRecords = [],
    isLoading: isCompanyNamesLoading,
    error: companyNamesError,
  } = useQuery({
    queryKey: ["companyNames"],
    queryFn: getCompanyNames,
    staleTime: 1000 * 60 * 5,
  });

  const companyOptions = useMemo(
    () =>
      companyRecords
        .map((company) => String(company?.name || "").trim())
        .filter(Boolean),
    [companyRecords]
  );

  useEffect(() => {
    if (!companyOptions.length) return;

    setFormData((prev) => {
      const nextCompany = companyOptions.includes(prev.company_name)
        ? prev.company_name
        : companyOptions[0];

      if (nextCompany === prev.company_name) {
        return prev;
      }

      return {
        ...prev,
        company_name: nextCompany,
      };
    });
  }, [companyOptions]);

  const createMutation = useMutation({
    mutationFn: createPosMachine,
    onSuccess: (response) => {
      logStockPosCreateUi("Create machine success", response);
      queryClient.invalidateQueries({ queryKey: ["posMachines"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success(response?.message || "POS machine created successfully");
      navigate(redirectUrl);
    },
    onError: (error) => {
      logStockPosCreateUi("Create machine error", {
        payload: formData,
        error: error.message,
      });
      toast.error(error.message || "Failed to create POS machine");
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!formData.company_name) {
      toast.error("Please select a company name before saving.");
      return;
    }

    if (!String(formData.bank_name || "").trim()) {
      toast.error("Bank name is required so Agro machines can be separated correctly.");
      return;
    }

    logStockPosCreateUi("Create machine submit", formData);
    createMutation.mutate({
      ...formData,
      bank_name: String(formData.bank_name || "").trim(),
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">Add New POS Machine</h1>

          <form onSubmit={handleSubmit} className="space-y-4">
            <FormInput
              label="TID Number"
              placeholder="Enter TID Number"
              value={formData.tid_number}
              onChange={(e) => setFormData({ ...formData, tid_number: e.target.value })}
              required
            />
            <FormInput
              label="MID Number"
              placeholder="Enter MID Number"
              value={formData.mid_number}
              onChange={(e) => setFormData({ ...formData, mid_number: e.target.value })}
              required
            />
            <FormInput
              label="Device Serial Number"
              placeholder="Enter Device Serial Number"
              value={formData.device_serial_number}
              onChange={(e) => setFormData({ ...formData, device_serial_number: e.target.value })}
              required
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Company Name
              </label>
              <select
                value={formData.company_name}
                onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white disabled:bg-gray-100"
                disabled={isCompanyNamesLoading || !companyOptions.length}
                required
              >
                {!companyOptions.length ? (
                  <option value="">
                    {isCompanyNamesLoading ? "Loading company names..." : "No company names available"}
                  </option>
                ) : (
                  companyOptions.map((company) => (
                    <option key={company} value={company}>
                      {company}
                    </option>
                  ))
                )}
              </select>
              {companyNamesError && (
                <p className="mt-1 text-xs text-red-600">
                  {companyNamesError.message || "Unable to load company names."}
                </p>
              )}
              {!companyNamesError && !isCompanyNamesLoading && !companyOptions.length && (
                <p className="mt-1 text-xs text-amber-600">
                  No company name exists in the master list. Add one from the Stock POS page first.
                </p>
              )}
            </div>
            <FormInput
              label="Razorpay ID"
              placeholder="Enter Razorpay ID"
              value={formData.razorpay_id}
              onChange={(e) => setFormData({ ...formData, razorpay_id: e.target.value })}
            />
            <FormInput
              label="Bank Name"
              placeholder="Enter Bank Name"
              value={formData.bank_name}
              onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
              required
            />
            <FormInput
              label="Remarks"
              placeholder="Enter Remarks (Optional)"
              value={formData.remarks}
              onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
            />

            <button
              type="submit"
              disabled={createMutation.isPending || !companyOptions.length}
              className="w-full bg-[#00D3CD] text-white py-3 rounded-lg hover:bg-[#00bdb7] transition-colors disabled:opacity-50"
            >
              {createMutation.isPending ? "Adding..." : "Add POS Machine"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AddPOSMachine;
