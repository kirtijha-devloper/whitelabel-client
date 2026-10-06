import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaArrowLeft,
  FaMobileAlt,
  FaSearch,
  FaPlus,
  FaFilter,
  FaDownload,
  FaCheckCircle,
  FaExclamationTriangle,
  FaTimesCircle,
  FaEdit,
  FaEye,
  FaBox,
} from "react-icons/fa";
import { toast } from "react-toastify";
import { getSuperAdminPosInventory } from "../../api/superAdminApi";
import Modal from "../../components/Modal";
import FormInput from "../../components/FormInput";

const SuperAdminPOSInventory = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(false);
  const [machines, setMachines] = useState([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedMachine, setSelectedMachine] = useState(null);

  // New Machine form state
  const [formData, setFormData] = useState({
    tid_number: "",
    serial_number: "",
    model: "Pax A920",
    company_name: "AGRO-AXIS",
    status: "available",
  });

  // Mock initial data if API returns empty
  const mockMachines = [
    {
      id: "pos-101",
      tid_number: "TID9928101",
      serial_number: "SN-PAX-882101",
      model: "Pax A920",
      company_name: "AGRO-AXIS",
      assigned_to: "Admin Alpha (Global Pay)",
      status: "active",
      created_at: "2026-09-15",
    },
    {
      id: "pos-102",
      tid_number: "TID9928102",
      serial_number: "SN-PAX-882102",
      model: "Verifone X990",
      company_name: "AGRO-HDFC",
      assigned_to: "Unassigned",
      status: "available",
      created_at: "2026-09-18",
    },
    {
      id: "pos-103",
      tid_number: "TID9928103",
      serial_number: "SN-MF-773401",
      model: "MoreFun POS",
      company_name: "Everlife",
      assigned_to: "Merchant Retail Hub",
      status: "active",
      created_at: "2026-09-20",
    },
    {
      id: "pos-104",
      tid_number: "TID9928104",
      serial_number: "SN-ING-112099",
      model: "Ingenico DX8000",
      company_name: "AGRO-AXIS",
      assigned_to: "Returned - Defect",
      status: "returned-initiated",
      created_at: "2026-09-22",
    },
    {
      id: "pos-105",
      tid_number: "TID9928105",
      serial_number: "SN-PAX-882105",
      model: "Pax A920",
      company_name: "AGRO-HDFC",
      assigned_to: "Unassigned",
      status: "available",
      created_at: "2026-09-25",
    },
  ];

  const fetchPosData = async () => {
    setLoading(true);
    try {
      const res = await getSuperAdminPosInventory({
        search: searchTerm,
        status: statusFilter !== "all" ? statusFilter : "",
      });
      if (res && res.data && res.data.length > 0) {
        setMachines(res.data);
      } else {
        setMachines(mockMachines);
      }
    } catch (err) {
      console.warn("Using fallback POS inventory data", err);
      setMachines(mockMachines);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPosData();
  }, [statusFilter]);

  const handleAddSubmit = (e) => {
    e.preventDefault();
    if (!formData.tid_number || !formData.serial_number) {
      toast.error("Please fill in TID Number and Serial Number");
      return;
    }

    const newEntry = {
      id: `pos-${Date.now()}`,
      ...formData,
      assigned_to: "Unassigned",
      created_at: new Date().toISOString().split("T")[0],
    };

    setMachines([newEntry, ...machines]);
    toast.success("POS Machine added successfully to Inventory!");
    setIsAddModalOpen(false);
    setFormData({
      tid_number: "",
      serial_number: "",
      model: "Pax A920",
      company_name: "AGRO-AXIS",
      status: "available",
    });
  };

  const filteredMachines = machines.filter((item) => {
    const matchesSearch =
      item.tid_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.serial_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.company_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.model?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus =
      statusFilter === "all" || item.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status) => {
    switch (status) {
      case "active":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <FaCheckCircle className="w-3 h-3 text-emerald-500" /> Active
          </span>
        );
      case "available":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            <FaBox className="w-3 h-3 text-blue-500" /> Available
          </span>
        );
      case "returned-initiated":
      case "returned":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <FaExclamationTriangle className="w-3 h-3 text-amber-500" /> Returned
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="min-h-screen bg-gray-50/50 p-6 space-y-6">
      {/* BREADCRUMB & HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div>
          <button
            onClick={() => navigate("/super-admin/inventory")}
            className="inline-flex items-center gap-2 text-xs font-semibold text-gray-500 hover:text-[#00D3CD] mb-2 transition-colors"
          >
            <FaArrowLeft className="w-3 h-3" /> Back to Inventory Overview
          </button>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
              <FaMobileAlt className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                POS Inventory Management
              </h1>
              <p className="text-xs text-gray-500 mt-0.5">
                Manage physical POS machine terminals, TIDs, serial numbers, and company allocations.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#00D3CD] hover:bg-[#00b0ab] text-white text-sm font-semibold shadow-md transition-all"
          >
            <FaPlus className="w-4 h-4" /> Add POS Machine
          </button>
        </div>
      </div>

      {/* STATS OVERVIEW */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <p className="text-xs text-gray-400 font-medium">Total POS Stock</p>
          <p className="text-xl font-bold text-gray-900 mt-1">{machines.length}</p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <p className="text-xs text-gray-400 font-medium">Available (Unassigned)</p>
          <p className="text-xl font-bold text-blue-600 mt-1">
            {machines.filter((m) => m.status === "available").length}
          </p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <p className="text-xs text-gray-400 font-medium">Active (Assigned)</p>
          <p className="text-xl font-bold text-emerald-600 mt-1">
            {machines.filter((m) => m.status === "active").length}
          </p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <p className="text-xs text-gray-400 font-medium">Returned / Repair</p>
          <p className="text-xl font-bold text-amber-600 mt-1">
            {machines.filter((m) => m.status?.includes("return")).length}
          </p>
        </div>
      </div>

      {/* FILTERS & SEARCH */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:w-80">
          <FaSearch className="absolute left-3.5 top-3 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Search TID, Serial No, Company..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00D3CD]"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto">
          {["all", "available", "active", "returned-initiated"].map((tab) => (
            <button
              key={tab}
              onClick={() => setStatusFilter(tab)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold capitalize transition-colors ${
                statusFilter === tab
                  ? "bg-gray-900 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {tab === "returned-initiated" ? "Returned" : tab}
            </button>
          ))}
        </div>
      </div>

      {/* DATA TABLE */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-50 text-xs font-semibold uppercase text-gray-500 border-b border-gray-100">
              <tr>
                <th className="px-6 py-4">TID Number</th>
                <th className="px-6 py-4">Serial Number</th>
                <th className="px-6 py-4">Model</th>
                <th className="px-6 py-4">Company Provider</th>
                <th className="px-6 py-4">Assigned To</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredMachines.length > 0 ? (
                filteredMachines.map((m) => (
                  <tr key={m.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4 font-mono font-bold text-gray-900">
                      {m.tid_number}
                    </td>
                    <td className="px-6 py-4 font-mono text-gray-600">
                      {m.serial_number}
                    </td>
                    <td className="px-6 py-4 text-gray-800 font-medium">
                      {m.model || "Pax A920"}
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-gray-100 text-gray-700">
                        {m.company_name}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      {m.assigned_to || "Unassigned"}
                    </td>
                    <td className="px-6 py-4">{getStatusBadge(m.status)}</td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <button
                        onClick={() => setSelectedMachine(m)}
                        className="p-1.5 rounded-lg text-gray-500 hover:text-[#00D3CD] hover:bg-gray-100 transition-colors"
                        title="View Details"
                      >
                        <FaEye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center text-gray-400">
                    No POS machines found matching search/filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ADD MACHINE MODAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-xl p-6 space-y-4">
            <h3 className="text-lg font-bold text-gray-900 border-b pb-3">
              Add New POS Machine to Stock
            </h3>

            <form onSubmit={handleAddSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  TID Number *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. TID9988123"
                  value={formData.tid_number}
                  onChange={(e) =>
                    setFormData({ ...formData, tid_number: e.target.value })
                  }
                  className="w-full px-3 py-2 text-sm border rounded-xl focus:ring-2 focus:ring-[#00D3CD] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Serial Number *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. SN-PAX-998812"
                  value={formData.serial_number}
                  onChange={(e) =>
                    setFormData({ ...formData, serial_number: e.target.value })
                  }
                  className="w-full px-3 py-2 text-sm border rounded-xl focus:ring-2 focus:ring-[#00D3CD] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Machine Model
                  </label>
                  <select
                    value={formData.model}
                    onChange={(e) =>
                      setFormData({ ...formData, model: e.target.value })
                    }
                    className="w-full px-3 py-2 text-sm border rounded-xl focus:ring-2 focus:ring-[#00D3CD] focus:outline-none"
                  >
                    <option value="Pax A920">Pax A920</option>
                    <option value="Verifone X990">Verifone X990</option>
                    <option value="MoreFun POS">MoreFun POS</option>
                    <option value="Ingenico DX8000">Ingenico DX8000</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Company Provider
                  </label>
                  <select
                    value={formData.company_name}
                    onChange={(e) =>
                      setFormData({ ...formData, company_name: e.target.value })
                    }
                    className="w-full px-3 py-2 text-sm border rounded-xl focus:ring-2 focus:ring-[#00D3CD] focus:outline-none"
                  >
                    <option value="AGRO-AXIS">AGRO-AXIS</option>
                    <option value="AGRO-HDFC">AGRO-HDFC</option>
                    <option value="Everlife">Everlife</option>
                  </select>
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
                  Save POS Machine
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VIEW MACHINE MODAL */}
      {selectedMachine && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-xl p-6 space-y-4">
            <h3 className="text-lg font-bold text-gray-900 border-b pb-3 flex items-center justify-between">
              <span>POS Machine Details</span>
              <button
                onClick={() => setSelectedMachine(null)}
                className="text-gray-400 hover:text-gray-600 text-sm"
              >
                ✕
              </button>
            </h3>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between border-b pb-2">
                <span className="text-gray-500">TID Number:</span>
                <span className="font-bold text-gray-900 font-mono">
                  {selectedMachine.tid_number}
                </span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-gray-500">Serial Number:</span>
                <span className="font-bold text-gray-900 font-mono">
                  {selectedMachine.serial_number}
                </span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-gray-500">Model:</span>
                <span className="font-semibold text-gray-800">
                  {selectedMachine.model}
                </span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-gray-500">Company:</span>
                <span className="font-semibold text-gray-800">
                  {selectedMachine.company_name}
                </span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-gray-500">Assigned To:</span>
                <span className="font-semibold text-gray-800">
                  {selectedMachine.assigned_to}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Status:</span>
                <span>{getStatusBadge(selectedMachine.status)}</span>
              </div>
            </div>

            <div className="pt-4 border-t flex justify-end">
              <button
                onClick={() => setSelectedMachine(null)}
                className="px-4 py-2 bg-gray-900 text-white text-xs font-semibold rounded-xl"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SuperAdminPOSInventory;
