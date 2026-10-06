import React, { useState, useEffect } from "react";
import {
  FaSearch,
  FaPlus,
  FaDownload,
  FaCheckCircle,
  FaExclamationTriangle,
  FaEye,
  FaBox,
} from "react-icons/fa";
import { toast } from "react-toastify";
import { getSuperAdminPosInventory } from "../../api/superAdminApi";

const SuperAdminPOSInventory = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(false);
  const [machines, setMachines] = useState([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedMachine, setSelectedMachine] = useState(null);

  const [formData, setFormData] = useState({
    tid_number: "",
    serial_number: "",
    model: "Pax A920",
    company_name: "AGRO-AXIS",
    status: "available",
  });

  // MOCK DATA

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

  // FETCH INVENTORY

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
    } catch (error) {
      console.warn("Using fallback POS inventory data", error);
      setMachines(mockMachines);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPosData();
  }, [statusFilter]);

  // ADD MACHINE

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

    setMachines((prev) => [newEntry, ...prev]);

    toast.success("POS Machine added successfully!");

    setIsAddModalOpen(false);

    setFormData({
      tid_number: "",
      serial_number: "",
      model: "Pax A920",
      company_name: "AGRO-AXIS",
      status: "available",
    });
  };

  // FILTER

  const filteredMachines = machines.filter((item) => {
    const search = searchTerm.toLowerCase();

    const matchesSearch =
      item.tid_number?.toLowerCase().includes(search) ||
      item.serial_number?.toLowerCase().includes(search) ||
      item.company_name?.toLowerCase().includes(search) ||
      item.model?.toLowerCase().includes(search) ||
      item.assigned_to?.toLowerCase().includes(search);

    const matchesStatus =
      statusFilter === "all" || item.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  // STATS

  const totalCompanies = new Set(
    machines.map((machine) => machine.company_name)
  ).size;

  const totalMachines = machines.length;

  const totalActive = machines.filter(
    (machine) => machine.status === "active"
  ).length;

  const totalInactive = machines.filter(
    (machine) =>
      machine.status !== "active" &&
      machine.status !== "available" &&
      !machine.status?.includes("return")
  ).length;
  // STATUS BADGE

  const getStatusBadge = (status) => {
    switch (status) {
      case "active":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <FaCheckCircle className="w-3 h-3 text-emerald-500" />
            Active
          </span>
        );

      case "available":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            <FaBox className="w-3 h-3 text-blue-500" />
            Available
          </span>
        );

      case "returned-initiated":
      case "returned":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <FaExclamationTriangle className="w-3 h-3 text-amber-500" />
            Returned
          </span>
        );

      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700">
            {status || "Unknown"}
          </span>
        );
    }
  };

  // ACTION HANDLERS

  const handleAddCompany = () => {
    toast.info("Add Company Name functionality coming soon.");
  };

  const handleBulkUpload = () => {
    toast.info("Bulk Upload functionality coming soon.");
  };

  const handleExportExcel = () => {
    toast.info("Export Excel functionality coming soon.");
  };

  const handleAssignFranchise = () => {
    toast.info("Assign To Franchise functionality coming soon.");
  };


  return (
    <div className="min-h-screen bg-gray-50/50 p-6 space-y-6">

      {/* main inventory card */}

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">

        {/* HEADER */}
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">

          {/* TITLE */}
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              POS Machine  Inventory
            </h1>
          </div>

          {/* ACTION BUTTONS */}
          <div className="flex flex-wrap items-center gap-3">

            {/* ADD COMPANY */}
            <button
              type="button"
              onClick={handleAddCompany}
              className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-cyan-500 hover:bg-cyan-600 text-white font-semibold transition-all shadow-sm"
            >
              <FaPlus />
              Add Company Name
            </button>

            {/* ADD MACHINE */}
            <button
              type="button"
              onClick={() => setIsAddModalOpen(true)}
              className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-cyan-500 hover:bg-cyan-600 text-white font-semibold transition-all shadow-sm"
            >
              <FaPlus />
              Add New Machine
            </button>

            {/* BULK UPLOAD */}
            <button
              type="button"
              onClick={handleBulkUpload}
              className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-cyan-500 hover:bg-cyan-600 text-white font-semibold transition-all shadow-sm"
            >
              <FaDownload />
              Bulk Upload
            </button>

            {/* EXPORT */}
            <button
              type="button"
              onClick={handleExportExcel}
              className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold transition-all shadow-sm"
            >
              <FaDownload />
              Export Excel
            </button>

            {/* ASSIGN TO FRANCHISE */}
            <button
              type="button"
              onClick={handleAssignFranchise}
              className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-cyan-500 hover:bg-cyan-600 text-white font-semibold transition-all shadow-sm"
            >
              <FaPlus />
              Assign To Franchise
            </button>
          </div>
        </div>

        {/* STATS */}

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mt-6">

          {/* TOTAL COMPANY */}
          <div className="rounded-2xl bg-gradient-to-br from-teal-500 to-cyan-500 text-white p-5 min-h-[145px]">
            <p className="text-sm font-semibold">
              Total Company
            </p>

            <h2 className="text-3xl font-bold mt-2">
              {totalCompanies}
            </h2>

            <div className="flex items-center justify-between mt-4">
              <span className="text-sm">
                Master company list
              </span>

              <button
                type="button"
                onClick={handleAddCompany}
                className="px-4 py-1.5 rounded-full border border-white/50 text-sm font-semibold hover:bg-white/10"
              >
                View
              </button>
            </div>
          </div>

          {/* TOTAL MACHINES */}
          <div className="rounded-2xl bg-blue-600 text-white p-5 min-h-[145px]">
            <p className="text-sm font-semibold">
              Total Machines
            </p>

            <h2 className="text-3xl font-bold mt-2">
              {totalMachines}
            </h2>

            <p className="text-sm mt-4">
              This page: {filteredMachines.length}
            </p>
          </div>

          {/* ACTIVE */}
          <div className="rounded-2xl bg-green-500 text-white p-5 min-h-[145px]">
            <p className="text-sm font-semibold">
              Total Active
            </p>

            <h2 className="text-3xl font-bold mt-2">
              {totalActive}
            </h2>

            <p className="text-sm mt-4">
              This page:{" "}
              {
                filteredMachines.filter(
                  (machine) => machine.status === "active"
                ).length
              }
            </p>
          </div>

          {/* INACTIVE */}
          <div className="rounded-2xl bg-red-500 text-white p-5 min-h-[145px]">
            <p className="text-sm font-semibold">
              Total Inactive
            </p>

            <h2 className="text-3xl font-bold mt-2">
              {totalInactive}
            </h2>

            <p className="text-sm mt-4">
              This page:{" "}
              {
                filteredMachines.filter(
                  (machine) =>
                    machine.status !== "active" &&
                    machine.status !== "available" &&
                    !machine.status?.includes("return")
                ).length
              }
            </p>
          </div>
        </div>
      </div>

      {/* == SEARCH + STATUS FILTER== */}

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">

          {/* SEARCH */}
          <div className="relative w-full md:max-w-md">

            <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />

            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search TID, Serial No, Company..."
              className="w-full pl-11 pr-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-transparent"
            />
          </div>

          {/* STATUS FILTER */}
          <div className="flex flex-wrap items-center gap-2">

            <button
              type="button"
              onClick={() => setStatusFilter("all")}
              className={`px-5 py-2 rounded-full text-sm font-semibold transition ${
                statusFilter === "all"
                  ? "bg-gray-900 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              All
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter("available")}
              className={`px-5 py-2 rounded-full text-sm font-semibold transition ${
                statusFilter === "available"
                  ? "bg-gray-900 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              Available
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter("active")}
              className={`px-5 py-2 rounded-full text-sm font-semibold transition ${
                statusFilter === "active"
                  ? "bg-gray-900 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              Active
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter("returned")}
              className={`px-5 py-2 rounded-full text-sm font-semibold transition ${
                statusFilter === "returned"
                  ? "bg-gray-900 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              Returned
            </button>
          </div>
        </div>
      </div>

      {/* table */}

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">

        <div className="overflow-x-auto">

          <table className="w-full text-left">

            <thead className="bg-gray-50 border-b border-gray-100">

              <tr>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">
                  TID Number
                </th>

                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">
                  Serial Number
                </th>

                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">
                  Model
                </th>

                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">
                  Company Provider
                </th>

                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">
                  Assigned To
                </th>

                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">
                  Status
                </th>

                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase text-center">
                  Actions
                </th>
              </tr>

            </thead>

            <tbody className="divide-y divide-gray-100">

              {loading ? (
                <tr>
                  <td
                    colSpan="7"
                    className="px-6 py-10 text-center text-gray-500"
                  >
                    Loading POS inventory...
                  </td>
                </tr>
              ) : filteredMachines.length === 0 ? (
                <tr>
                  <td
                    colSpan="7"
                    className="px-6 py-10 text-center text-gray-500"
                  >
                    No POS machines found.
                  </td>
                </tr>
              ) : (
                filteredMachines.map((machine) => (
                  <tr
                    key={machine.id}
                    className="hover:bg-gray-50 transition"
                  >

                    {/* TID */}
                    <td className="px-6 py-5">
                      <span className="font-semibold text-gray-900">
                        {machine.tid_number}
                      </span>
                    </td>

                    {/* SERIAL */}
                    <td className="px-6 py-5 text-gray-600">
                      {machine.serial_number}
                    </td>

                    {/* MODEL */}
                    <td className="px-6 py-5 text-gray-900">
                      {machine.model}
                    </td>

                    {/* COMPANY */}
                    <td className="px-6 py-5">
                      <span className="inline-flex px-3 py-1 rounded-md bg-gray-100 text-gray-800 text-sm font-semibold">
                        {machine.company_name}
                      </span>
                    </td>

                    {/* ASSIGNED TO */}
                    <td className="px-6 py-5 text-gray-700">
                      {machine.assigned_to || "Unassigned"}
                    </td>

                    {/* STATUS */}
                    <td className="px-6 py-5">
                      {getStatusBadge(machine.status)}
                    </td>

                    {/* ACTION */}
                    <td className="px-6 py-5 text-center">

                      <button
                        type="button"
                        onClick={() => setSelectedMachine(machine)}
                        className="inline-flex items-center justify-center w-9 h-9 rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition"
                        title="View Machine"
                      >
                        <FaEye />
                      </button>

                    </td>
                  </tr>
                ))
              )}

            </tbody>
          </table>
        </div>
      </div>

      {/* add model */}

      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">

          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl">

            {/* MODAL HEADER */}
            <div className="flex items-center justify-between px-6 py-5 border-b">

              <h2 className="text-xl font-bold text-gray-900">
                Add New POS Machine
              </h2>

              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="text-gray-400 hover:text-gray-700 text-2xl"
              >
                ×
              </button>

            </div>

            {/* FORM */}
            <form
              onSubmit={handleAddSubmit}
              className="p-6 space-y-5"
            >

              {/* TID */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  TID Number
                </label>

                <input
                  type="text"
                  value={formData.tid_number}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      tid_number: e.target.value,
                    })
                  }
                  placeholder="Enter TID Number"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-400"
                />
              </div>

              {/* SERIAL */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Serial Number
                </label>

                <input
                  type="text"
                  value={formData.serial_number}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      serial_number: e.target.value,
                    })
                  }
                  placeholder="Enter Serial Number"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-400"
                />
              </div>

              {/* MODEL */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Model
                </label>

                <select
                  value={formData.model}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      model: e.target.value,
                    })
                  }
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-400"
                >
                  <option value="Pax A920">Pax A920</option>
                  <option value="Verifone X990">
                    Verifone X990
                  </option>
                  <option value="MoreFun POS">
                    MoreFun POS
                  </option>
                  <option value="Ingenico DX8000">
                    Ingenico DX8000
                  </option>
                </select>
              </div>

              {/* COMPANY */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Company Provider
                </label>

                <select
                  value={formData.company_name}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      company_name: e.target.value,
                    })
                  }
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-400"
                >
                  <option value="AGRO-AXIS">
                    AGRO-AXIS
                  </option>

                  <option value="AGRO-HDFC">
                    AGRO-HDFC
                  </option>

                  <option value="Everlife">
                    Everlife
                  </option>
                </select>
              </div>

              {/* STATUS */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Status
                </label>

                <select
                  value={formData.status}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      status: e.target.value,
                    })
                  }
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-400"
                >
                  <option value="available">
                    Available
                  </option>

                  <option value="active">
                    Active
                  </option>

                  <option value="returned">
                    Returned
                  </option>
                </select>
              </div>

              {/* BUTTONS */}
              <div className="flex justify-end gap-3 pt-3">

                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-5 py-3 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="px-5 py-3 rounded-xl bg-cyan-500 hover:bg-cyan-600 text-white font-semibold"
                >
                  Add Machine
                </button>

              </div>

            </form>
          </div>
        </div>
      )}

      {/* =====================================================
          VIEW MACHINE MODAL
      ====================================================== */}

      {selectedMachine && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">

          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl">

            {/* HEADER */}
            <div className="flex items-center justify-between px-6 py-5 border-b">

              <h2 className="text-xl font-bold text-gray-900">
                POS Machine Details
              </h2>

              <button
                type="button"
                onClick={() => setSelectedMachine(null)}
                className="text-gray-400 hover:text-gray-700 text-2xl"
              >
                ×
              </button>

            </div>

            {/* DETAILS */}
            <div className="p-6 space-y-4">

              <div className="flex justify-between border-b pb-3">
                <span className="text-gray-500">
                  TID Number
                </span>

                <span className="font-semibold">
                  {selectedMachine.tid_number}
                </span>
              </div>

              <div className="flex justify-between border-b pb-3">
                <span className="text-gray-500">
                  Serial Number
                </span>

                <span className="font-semibold">
                  {selectedMachine.serial_number}
                </span>
              </div>

              <div className="flex justify-between border-b pb-3">
                <span className="text-gray-500">
                  Model
                </span>

                <span className="font-semibold">
                  {selectedMachine.model}
                </span>
              </div>

              <div className="flex justify-between border-b pb-3">
                <span className="text-gray-500">
                  Company Provider
                </span>

                <span className="font-semibold">
                  {selectedMachine.company_name}
                </span>
              </div>

              <div className="flex justify-between border-b pb-3">
                <span className="text-gray-500">
                  Assigned To
                </span>

                <span className="font-semibold">
                  {selectedMachine.assigned_to || "Unassigned"}
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-gray-500">
                  Status
                </span>

                {getStatusBadge(selectedMachine.status)}
              </div>

            </div>

            {/* FOOTER */}
            <div className="px-6 pb-6 flex justify-end">

              <button
                type="button"
                onClick={() => setSelectedMachine(null)}
                className="px-5 py-3 rounded-xl bg-gray-900 text-white font-semibold hover:bg-gray-800"
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
