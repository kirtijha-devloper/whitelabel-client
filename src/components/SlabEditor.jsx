import React, { useState, useEffect } from "react";
import { Plus, Trash, Edit, Check, X } from "lucide-react";

/**
 * SlabEditor Component
 * --------------------
 * A reusable component for managing "Slab" based logic (e.g., 0-1000 = ₹10).
 * 
 * @param {Array} slabs - Array of existing slab objects { min_amount, max_amount, flat_fee, percent_fee }
 * @param {Function} onSave - Callback when a slab is added or edited. Returns the slab object.
 * @param {Function} onDelete - Callback when a slab is deleted. Returns the slab ID.
 */
const SlabEditor = ({ slabs = [], onSave, onDelete }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    id: null,
    min_amount: "",
    max_amount: "",
    flat_fee: "",
    percent_fee: "",
    type: "flat" // 'flat' (slab) or 'percent' (simple)
  });

  const resetForm = () => {
    setFormData({
      id: null,
      min_amount: "",
      max_amount: "",
      flat_fee: "",
      percent_fee: "",
      type: "flat"
    });
    setIsEditing(false);
  };

  const handlEdit = (slab) => {
    setFormData({ ...slab });
    setIsEditing(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // Basic Validation: Min < Max
    if (parseFloat(formData.min_amount) >= parseFloat(formData.max_amount)) {
      alert("Min Amount must be less than Max Amount");
      return;
    }

    onSave(formData);
    resetForm();
  };

  return (
    <div className="space-y-4">
      {/* Form Section */}
      <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">
          {isEditing ? "Edit Slab" : "Add New Slab"}
        </h3>
        <form onSubmit={handleSubmit} className="flex flex-col md:flex-row gap-3 items-end">
          <div className="flex-1">
            <label className="text-xs text-gray-500">Min Amount</label>
            <input
              type="number"
              placeholder="0"
              required
              className="w-full p-2 border rounded text-sm"
              value={formData.min_amount}
              onChange={(e) => setFormData({ ...formData, min_amount: e.target.value })}
            />
          </div>
          <div className="flex-1">
            <label className="text-xs text-gray-500">Max Amount</label>
            <input
              type="number"
              placeholder="e.g 1000"
              className="w-full p-2 border rounded text-sm"
              value={formData.max_amount}
              onChange={(e) => setFormData({ ...formData, max_amount: e.target.value })}
            />
            <span className="text-[10px] text-gray-400">Leave empty for infinite</span>
          </div>
          <div className="flex-1">
            <label className="text-xs text-gray-500">Flat Fee (₹)</label>
            <input
              type="number"
              placeholder="0"
              className="w-full p-2 border rounded text-sm"
              value={formData.flat_fee}
              onChange={(e) => setFormData({ ...formData, flat_fee: e.target.value })}
            />
          </div>
          <div className="flex-1">
            <label className="text-xs text-gray-500">Percent Fee (%)</label>
            <input
              type="number"
              placeholder="0"
              className="w-full p-2 border rounded text-sm"
              value={formData.percent_fee}
              onChange={(e) => setFormData({ ...formData, percent_fee: e.target.value })}
            />
          </div>
          <div className="flex gap-2">
            {isEditing && (
              <button
                type="button"
                onClick={resetForm}
                className="p-2 text-gray-500 hover:bg-gray-200 rounded"
              >
                <X size={18} />
              </button>
            )}
            <button
              type="submit"
              className="p-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
            >
              {isEditing ? <Check size={18} /> : <Plus size={18} />}
            </button>
          </div>
        </form>
      </div>

      {/* List Section */}
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-100 text-gray-600">
            <tr>
              <th className="p-3">Min</th>
              <th className="p-3">Max</th>
              <th className="p-3">Flat Fee</th>
              <th className="p-3">Percent</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {slabs.length === 0 ? (
              <tr>
                <td colSpan="5" className="p-4 text-center text-gray-400">
                  No slabs added yet.
                </td>
              </tr>
            ) : (
              slabs.map((slab, idx) => (
                <tr key={slab.id || idx} className="hover:bg-gray-50">
                  <td className="p-3">₹{slab.min_amount}</td>
                  <td className="p-3">{slab.max_amount ? `₹${slab.max_amount}` : "∞"}</td>
                  <td className="p-3">{slab.flat_fee ? `₹${slab.flat_fee}` : "-"}</td>
                  <td className="p-3">{slab.percent_fee ? `${slab.percent_fee}%` : "-"}</td>
                  <td className="p-3 text-right space-x-2">
                    <button
                      onClick={() => handlEdit(slab)}
                      className="text-blue-500 hover:text-blue-700"
                    >
                      <Edit size={16} />
                    </button>
                    <button
                      onClick={() => onDelete(slab.id)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <Trash size={16} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default SlabEditor;
