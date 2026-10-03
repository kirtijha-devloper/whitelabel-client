import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Loader2, Edit, Trash, X } from "lucide-react";
import Table from "../components/Table";
import {
  createChargeType,
  getChargeTypes,
  createChargeSlab,
  getSlabsByCategory,
  updateChargeSlab,
  deleteChargeSlab,
} from "../api/chargeSet";
import DynamicForm from "../components/DynamicForm";

const ChargeSet = () => {
  const queryClient = useQueryClient();
  const [activeModal, setActiveModal] = useState(null);
  const [slabForm, setSlabForm] = useState({
    charge_type_category: "",
    min_amount: "",
    max_amount: "",
    flat_fee: "",
    percent_fee: "",
    id: null, // Add id to track editing
  });

  // Fetch charge types
  const { data: chargeTypes = [], isLoading: typesLoading } = useQuery({
    queryKey: ["chargeTypes"],
    queryFn: getChargeTypes,
  });

  // Fetch slabs for the selected category in the modal
  const selectedCategory = activeModal?.startsWith("create-slab-") ? activeModal.split("-")[2] : "";
  console.log(activeModal);
  console.log(selectedCategory, "selectedCategory");
  const { data: slabs = [], isLoading: slabsLoading } = useQuery({
    queryKey: ["chargeSlabs", selectedCategory],
    queryFn: () => getSlabsByCategory({ charge_type_category: selectedCategory }),
    enabled: !!selectedCategory,
  });

  // Mutations
  const createTypeMutation = useMutation({
    mutationFn: createChargeType,
    onSuccess: () => {
      queryClient.invalidateQueries(["chargeTypes"]);
      setActiveModal(null);
    },
    onError: (error) => alert(error.message),
  });

  const createSlabMutation = useMutation({
    mutationFn: createChargeSlab,
    onSuccess: () => {
      queryClient.invalidateQueries(["chargeSlabs", selectedCategory]);
      setSlabForm({ charge_type_category: selectedCategory, min_amount: "", max_amount: "", flat_fee: "", percent_fee: "", id: null });
    },
    onError: (error) => alert(error.message),
  });

  const updateSlabMutation = useMutation({
    mutationFn: ({ id, data }) => updateChargeSlab(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(["chargeSlabs", selectedCategory]);
      setSlabForm({ charge_type_category: selectedCategory, min_amount: "", max_amount: "", flat_fee: "", percent_fee: "", id: null }); // Clear form after update
    },
    onError: (error) => alert(error.message),
  });

  const deleteSlabMutation = useMutation({
    mutationFn: deleteChargeSlab,
    onSuccess: () => queryClient.invalidateQueries(["chargeSlabs", selectedCategory]),
    onError: (error) => alert(error.message),
  });

  // Form Fields for Charge Type
  const typeFields = [
    { label: "Name", name: "name", type: "text", required: true, placeholder: "e.g., Transaction Fee" },
    { label: "Category", name: "category", type: "text", required: true, placeholder: "e.g., POS" },
  ];

  // Table Columns for Slabs
  const slabColumns = [
    { header: "Min Amount", key: "min_amount", render: (val) => val || "0" },
    { header: "Max Amount", key: "max_amount", render: (val) => val || "Infinity" },
    { header: "Flat Fee", key: "flat_fee", render: (val) => (val ? `₹${val}` : "N/A") },
    { header: "Percent Fee", key: "percent_fee", render: (val) => (val ? `${val}%` : "N/A") },
    {
      header: "Actions",
      key: "id",
      render: (id, row) => (
        <div className="flex gap-2">
          <button
            onClick={() => {
              setSlabForm({ ...row, charge_type_category: selectedCategory, id }); // Pre-fill form with slab data
            }}
            className="text-indigo-500 hover:text-indigo-700"
          >
            <Edit size={16} />
          </button>
          <button
            onClick={() => deleteSlabMutation.mutate(id)}
            className="text-red-500 hover:text-red-700"
          >
            <Trash size={16} />
          </button>
        </div>
      ),
    },
  ];

  // Handle slab form submission
  const handleSlabSubmit = (e) => {
    e.preventDefault();
    const data = {
      charge_type_category: selectedCategory,
      min_amount: slabForm.min_amount ? parseFloat(slabForm.min_amount) : null,
      max_amount: slabForm.max_amount ? parseFloat(slabForm.max_amount) : null,
      flat_fee: slabForm.flat_fee ? parseFloat(slabForm.flat_fee) : null,
      percent_fee: slabForm.percent_fee ? parseFloat(slabForm.percent_fee) : null,
    };
    if (slabForm.id) {
      updateSlabMutation.mutate({ id: slabForm.id, data });
    } else {
      createSlabMutation.mutate(data);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-semibold text-gray-900">Charge Management</h1>
          </div>
          <button
            onClick={() => setActiveModal("create-type")}
            className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg hover:opacity-70 transition"
          >
            <Plus size={20} /> New Type
          </button>
        </div>

        {/* Charge Types */}
        <div className="bg-white p-6 rounded-xl shadow-md">
          <h2 className="text-xl font-semibold text-gray-800 mb-4 border-b pb-2">Charge Types</h2>
          {typesLoading ? (
            <Loader2 className="animate-spin h-8 w-8 text-indigo-600 mx-auto" />
          ) : chargeTypes.length === 0 ? (
            <p className="text-gray-500 text-center">No charge types found.</p>
          ) : (
            <ul className="space-y-2">
              {chargeTypes.map((type) => (
                <li
                  key={type.id}
                  className="flex justify-between items-center p-2 hover:bg-gray-50 rounded"
                >
                  <span>{type.name} ({type.category})</span>
                  <button
                    onClick={() => {
                      setActiveModal(`create-slab-${type.category}`);
                      setSlabForm({ ...slabForm, charge_type_category: type.category, id: null });
                    }}
                    className="flex items-center gap-1 text-indigo-500 hover:text-indigo-700 text-sm"
                  >
                    <Plus size={16} /> Add Slab
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Create Type Modal */}
        {activeModal === "create-type" && (
          <div className="fixed inset-0 bg-gray-800 bg-opacity-75 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-xl shadow-lg w-full max-w-md">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Create Charge Type</h2>
              <DynamicForm
                fields={typeFields}
                onSubmit={(data) => createTypeMutation.mutate(data)}
                buttonLabel="Create"
                buttonClass="bg-indigo-600 hover:bg-indigo-700 text-white"
              />
              <button
                onClick={() => setActiveModal(null)}
                className="mt-4 w-full bg-gray-300 text-gray-800 py-2 rounded-lg hover:bg-gray-400 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Create/Edit Slab Modal with Horizontal Form and Table */}
        {activeModal?.startsWith("create-slab-") && (
          <div className="fixed inset-0 bg-gray-800 bg-opacity-75 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-xl shadow-lg w-full max-w-4xl">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-semibold text-gray-900">
                  Manage Slabs for {selectedCategory}
                </h2>
                <button onClick={() => setActiveModal(null)} className="text-gray-500 hover:text-gray-700">
                  <X size={24} />
                </button>
              </div>

              {/* Horizontal Slab Form */}
              <form onSubmit={handleSlabSubmit} className="mb-6">
                <div className="flex flex-col sm:flex-row gap-4 items-end">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Min Amount</label>
                    <input
                      type="number"
                      value={slabForm.min_amount}
                      onChange={(e) => setSlabForm({ ...slabForm, min_amount: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                      placeholder="0"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Max Amount</label>
                    <input
                      type="number"
                      value={slabForm.max_amount}
                      onChange={(e) => setSlabForm({ ...slabForm, max_amount: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                      placeholder="Infinity"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Flat Fee</label>
                    <input
                      type="number"
                      value={slabForm.flat_fee}
                      onChange={(e) => setSlabForm({ ...slabForm, flat_fee: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                      placeholder="e.g., 10"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Percent Fee</label>
                    <input
                      type="number"
                      value={slabForm.percent_fee}
                      onChange={(e) => setSlabForm({ ...slabForm, percent_fee: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                      placeholder="e.g., 2.5"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={createSlabMutation.isPending || updateSlabMutation.isPending}
                    className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {createSlabMutation.isPending || updateSlabMutation.isPending ? (
                      <Loader2 className="animate-spin h-5 w-5 mx-auto" />
                    ) : slabForm.id ? "Update" : "Save"}
                  </button>
                </div>
              </form>

              {/* Slabs Table */}
              <div>
                {slabsLoading ? (
                  <Loader2 className="animate-spin h-8 w-8 text-indigo-600 mx-auto" />
                ) : slabs.length === 0 ? (
                  <p className="text-gray-500 text-center">No slabs found for this category.</p>
                ) : (
                  <Table columns={slabColumns} data={slabs} />
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChargeSet;