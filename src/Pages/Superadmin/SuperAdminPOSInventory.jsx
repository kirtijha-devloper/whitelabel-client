import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
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
import { bulkCreatePosMachines, getPosMachine } from "../../api/posMachine";
import { createCompanyName, getCompanyNames } from "../../api/companyName";
import Modal from "../../components/Modal";
import FormInput from "../../components/FormInput";

const INVENTORY_FETCH_LIMIT = 1000;

const extractMachineRows = (response) => {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.rows)) return response.rows;
  if (Array.isArray(response?.list)) return response.list;
  if (Array.isArray(response?.data?.rows)) return response.data.rows;
  if (Array.isArray(response?.data?.list)) return response.data.list;
  if (Array.isArray(response?.data?.data)) return response.data.data;
  return [];
};

const extractInventoryPagination = (response) =>
  response?.pagination || response?.data?.pagination || {};

const getResponseTotalPages = (response, rowCount, limit) => {
  const pagination = extractInventoryPagination(response);
  const pages = Number(
    pagination.totalPages || pagination.total_pages || pagination.pages || pagination.last_page
  );
  if (Number.isFinite(pages) && pages > 0) return pages;
  const total = Number(pagination.total || pagination.count || rowCount || 0);
  return total > 0 ? Math.ceil(total / limit) : 1;
};

const getAssignedMachineName = (machine) =>
  machine?.assigned_user?.name ||
  machine?.franchise_name ||
  machine?.franchise?.name ||
  machine?.assigned_to ||
  "Unassigned";

const SuperAdminPOSInventory = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [machines, setMachines] = useState([]);
  const [inventoryTotal, setInventoryTotal] = useState(0);
  const [selectedMachine, setSelectedMachine] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [companyRecords, setCompanyRecords] = useState([]);
  const [companyName, setCompanyName] = useState("");
  const [showCompanyModal, setShowCompanyModal] = useState(false);
  const [showCompanyConfirmation, setShowCompanyConfirmation] = useState(false);
  const [showBulkUploadModal, setShowBulkUploadModal] = useState(false);
  const [bulkUploadFile, setBulkUploadFile] = useState(null);
  const [bulkUploadResult, setBulkUploadResult] = useState(null);
  const [isBulkUploading, setIsBulkUploading] = useState(false);
  const [isCreatingCompany, setIsCreatingCompany] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const companyOptions = useMemo(
    () => Array.from(new Set(companyRecords.map((company) => String(company?.name || "").trim()).filter(Boolean))),
    [companyRecords]
  );

  const getSerialNumber = (machine) => machine?.device_serial_number || machine?.serial_number || "-";
  const getMachineModel = (machine) => machine?.model || machine?.device_model || "-";
  const getMachineStatus = (machine) =>
    String(machine?.status || (machine?.assigned_to ? "active" : "available"))
      .trim()
      .toLowerCase()
      .replace(/_/g, "-");

  const fetchPosData = useCallback(async () => {
    setLoading(true);
    setLoadError("");

    try {
      const params = {
        page: 1,
        limit: INVENTORY_FETCH_LIMIT,
        ...(searchTerm ? { search: searchTerm } : {}),
        ...(statusFilter !== "all" ? { status: statusFilter } : {}),
      };
      const firstResponse = await getSuperAdminPosInventory(params);
      const firstRows = extractMachineRows(firstResponse);
      const totalPages = getResponseTotalPages(firstResponse, firstRows.length, INVENTORY_FETCH_LIMIT);
      const remainingPages = await Promise.all(
        Array.from({ length: Math.max(0, totalPages - 1) }, (_, index) =>
          getSuperAdminPosInventory({ ...params, page: index + 2 })
        )
      );
      const allMachines = [...firstRows, ...remainingPages.flatMap(extractMachineRows)];
      setMachines(allMachines);
      const pagination = extractInventoryPagination(firstResponse);
      setInventoryTotal(Number(pagination.total || pagination.count || allMachines.length));
    } catch (error) {
      setMachines([]);
      setInventoryTotal(0);
      setLoadError(error?.message || "Failed to fetch POS inventory");
    } finally {
      setLoading(false);
    }
  }, [searchTerm, statusFilter]);

  useEffect(() => {
    const timer = window.setTimeout(() => setSearchTerm(searchInput.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    fetchPosData();
  }, [fetchPosData]);

  useEffect(() => {
    let cancelled = false;
    getCompanyNames()
      .then((records) => {
        if (!cancelled) setCompanyRecords(Array.isArray(records) ? records : []);
      })
      .catch((error) => {
        if (!cancelled) toast.error(error?.message || "Unable to load company names");
      });
    return () => { cancelled = true; };
  }, []);

  const filteredMachines = useMemo(() => {
    const search = searchTerm.toLowerCase();
    return machines.filter((machine) => {
      const values = [
        machine?.tid_number,
        machine?.mid_number,
        machine?.device_serial_number,
        machine?.company_name,
        machine?.bank_name,
        machine?.razorpay_id,
        machine?.status,
        machine?.remarks,
        machine?.assigned_user?.name,
        machine?.assigned_to,
      ];
      const matchesSearch = !search || values.some((value) => String(value || "").toLowerCase().includes(search));
      const status = getMachineStatus(machine);
      const matchesStatus = statusFilter === "all" ||
        (statusFilter === "available" ? !machine?.assigned_to && !status.includes("return") :
          statusFilter === "active" ? Boolean(machine?.assigned_to) || status === "active" :
            statusFilter === "returned" ? status.includes("return") : status === statusFilter);
      return matchesSearch && matchesStatus;
    });
  }, [machines, searchTerm, statusFilter]);

  const totalMachines = inventoryTotal || machines.length;
  const totalCompanies = companyOptions.length;
  const totalActive = machines.filter((machine) => getMachineStatus(machine) === "active").length;
  const totalInactive = machines.filter((machine) => {
    const status = getMachineStatus(machine);
    return status !== "active" && status !== "available" && !status.includes("return");
  }).length;
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
    setCompanyName("");
    setShowCompanyConfirmation(false);
    setShowCompanyModal(true);
  };

  const handleCreateCompany = async () => {
    const trimmedName = companyName.trim();
    if (!trimmedName) {
      toast.error("Please enter a company name.");
      return;
    }
    if (companyOptions.some((name) => name.toLowerCase() === trimmedName.toLowerCase())) {
      toast.error(`Company name already exists: ${trimmedName}`);
      return;
    }

    setIsCreatingCompany(true);
    try {
      const response = await createCompanyName(trimmedName);
      const refreshedCompanies = await getCompanyNames();
      setCompanyRecords(Array.isArray(refreshedCompanies) ? refreshedCompanies : []);
      setShowCompanyModal(false);
      setShowCompanyConfirmation(false);
      setCompanyName("");
      toast.success(response?.message || "Company name created successfully");
    } catch (error) {
      toast.error(error?.message || "Failed to create company name");
    } finally {
      setIsCreatingCompany(false);
    }
  };

  const handleBulkUpload = () => {
    setBulkUploadFile(null);
    setBulkUploadResult(null);
    setShowBulkUploadModal(true);
  };

  const handleFileChange = (event) => {
    const file = event.target.files?.[0] || null;
    const fileName = String(file?.name || "").toLowerCase();
    if (file && (fileName.endsWith(".xlsx") || fileName.endsWith(".xls"))) {
      setBulkUploadFile(file);
      setBulkUploadResult(null);
    } else {
      setBulkUploadFile(null);
      setBulkUploadResult({
        success: false,
        message: "Please upload a valid Excel file (.xlsx, .xls)",
        errors: [],
      });
    }
  };

  const handleBulkUploadSubmit = async () => {
    if (!companyRecords.length) {
      toast.error("No company names are available. Add company names before bulk upload.");
      return;
    }
    if (!bulkUploadFile) {
      toast.error("Please select an Excel file.");
      return;
    }

    setIsBulkUploading(true);
    try {
      const response = await bulkCreatePosMachines(bulkUploadFile, companyRecords);
      setBulkUploadResult(response);
      setBulkUploadFile(null);
      await fetchPosData();
      if (response?.success === false) {
        toast.error(response?.message || "Bulk upload completed with errors");
      } else {
        toast.success(response?.message || "Bulk upload completed");
      }
    } catch (error) {
      const result = {
        success: false,
        message: error?.message || "Failed to bulk create POS machines",
        errors: error?.validationErrors || [],
      };
      setBulkUploadResult(result);
      toast.error(result.message);
    } finally {
      setIsBulkUploading(false);
    }
  };

  const handleDownloadSampleFormat = () => {
    try {
      const worksheet = XLSX.utils.aoa_to_sheet([
        ["SL", "Company Name", "Device SL No", "TID", "MID", "Bank Name"],
      ]);
      worksheet["!cols"] = [
        { wch: 8 }, { wch: 20 }, { wch: 20 }, { wch: 18 }, { wch: 18 }, { wch: 18 },
      ];
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Bulk_Upload_Format");
      const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
      saveAs(new Blob([buffer], { type: "application/octet-stream" }), "POS_Machine_Bulk_Upload_Format.xlsx");
      toast.success("Excel format downloaded successfully");
    } catch {
      toast.error("Failed to download Excel format");
    }
  };

  const handleExportExcel = () => {
    if (!filteredMachines.length) {
      toast.info("No POS machines available to export.");
      return;
    }
    setIsExporting(true);
    try {
      const exportData = filteredMachines.map((machine, index) => ({
        "SL No": index + 1,
        "Company Name": machine.company_name || "-",
        "Bank Name": machine.bank_name || "-",
        "Device Serial Number": machine.device_serial_number || "-",
        "TID Number": machine.tid_number || "-",
        "MID Number": machine.mid_number || "-",
        Status: machine.status || "-",
        "Assigned To": machine.assigned_user?.name || machine.assigned_to || "Unassigned",
        "Razorpay ID": machine.razorpay_id || "-",
        Remarks: machine.remarks || "-",
        "Created At": machine.created_at || machine.createdAt || "-",
      }));
      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "POS_Machines");
      const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
      saveAs(new Blob([buffer], { type: "application/octet-stream" }), `POS_Machines_${Date.now()}.xlsx`);
      toast.success("POS export started.");
    } catch {
      toast.error("Failed to export POS machines.");
    } finally {
      setIsExporting(false);
    }
  };

  const handleViewMachine = async (machine) => {
    setSelectedMachine(machine);
    if (!machine?.id) return;
    setDetailLoading(true);
    try {
      const response = await getPosMachine(machine.id);
      const details = response?.data?.data || response?.data || response;
      if (details && typeof details === "object") setSelectedMachine(details);
    } catch (error) {
      toast.error(error?.message || "Unable to load POS machine details");
    } finally {
      setDetailLoading(false);
    }
  };

  const handleAssignFranchise = () => {
    navigate("/super-admin/inventory/pos/add-to-franchise");
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
              onClick={() => navigate("/super-admin/inventory/pos/add")}
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
              disabled={isExporting}
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
                filteredMachines.filter((machine) => getMachineStatus(machine) === "active").length
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
                filteredMachines.filter((machine) => {
                  const status = getMachineStatus(machine);
                  return status !== "active" && status !== "available" && !status.includes("return");
                }).length
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
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
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
              ) : loadError ? (
                <tr>
                  <td colSpan="7" className="px-6 py-10 text-center text-red-600">
                    {loadError}
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
                      {getSerialNumber(machine)}
                    </td>

                    {/* MODEL */}
                    <td className="px-6 py-5 text-gray-900">
                      {getMachineModel(machine)}
                    </td>

                    {/* COMPANY */}
                    <td className="px-6 py-5">
                      <span className="inline-flex px-3 py-1 rounded-md bg-gray-100 text-gray-800 text-sm font-semibold">
                        {machine.company_name || "-"}
                      </span>
                    </td>

                    {/* ASSIGNED TO */}
                    <td className="px-6 py-5 text-gray-700">
                      {getAssignedMachineName(machine)}
                    </td>

                    {/* STATUS */}
                    <td className="px-6 py-5">
                      {getStatusBadge(getMachineStatus(machine))}
                    </td>

                    {/* ACTION */}
                    <td className="px-6 py-5 text-center">

                      <button
                        type="button"
                        onClick={() => handleViewMachine(machine)}
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

      <Modal
        isOpen={showCompanyModal}
        onClose={() => { setShowCompanyModal(false); setShowCompanyConfirmation(false); }}
        title={showCompanyConfirmation ? "Confirm Company Name" : "Add Company Name"}
        className="max-w-lg"
      >
        {showCompanyConfirmation ? (
          <div className="space-y-4">
            <p className="text-sm text-gray-700">Are you sure you want to add <strong>{companyName.trim()}</strong>?</p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowCompanyConfirmation(false)} disabled={isCreatingCompany} className="rounded-lg border px-4 py-2 text-sm">Back</button>
              <button type="button" onClick={handleCreateCompany} disabled={isCreatingCompany} className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{isCreatingCompany ? "Saving..." : "Yes, Add Company"}</button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <FormInput type="text" name="company_name" placeholder="Enter company name" value={companyName} onChange={(event) => setCompanyName(event.target.value)} />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowCompanyModal(false)} className="rounded-lg border px-4 py-2 text-sm">Cancel</button>
              <button type="button" onClick={() => {
                const trimmedName = companyName.trim();
                if (!trimmedName) {
                  toast.error("Please enter a company name.");
                  return;
                }
                if (companyOptions.some((name) => name.toLowerCase() === trimmedName.toLowerCase())) {
                  toast.error(`Company name already exists: ${trimmedName}`);
                  return;
                }
                setCompanyName(trimmedName);
                setShowCompanyConfirmation(true);
              }} className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-medium text-white">Continue</button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={showBulkUploadModal}
        onClose={() => { setShowBulkUploadModal(false); setBulkUploadFile(null); setBulkUploadResult(null); }}
        title="Bulk Upload POS Machines"
        className="max-w-3xl max-h-[90vh] flex flex-col"
      >
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
          <div className="rounded-r-lg border-l-4 border-yellow-400 bg-yellow-50 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-yellow-800">Required Excel Format</p>
                <p className="mt-1 rounded bg-yellow-100 p-2 font-mono text-sm text-yellow-700">SL, Company Name, Device SL No, TID, MID, Bank Name</p>
                <p className="mt-1 text-xs text-red-600">Use the exact header order shown. The Admin upload service validates the workbook.</p>
              </div>
              <button type="button" onClick={handleDownloadSampleFormat} className="inline-flex items-center gap-2 rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-white"><FaDownload />Download Format</button>
            </div>
          </div>
          <label className="block text-sm font-medium text-gray-700">
            Upload Excel File
            <input type="file" accept=".xlsx,.xls" onChange={handleFileChange} className="mt-2 block w-full text-sm" />
          </label>
          {!companyOptions.length && <p className="text-xs text-amber-700">Add at least one company name before bulk upload.</p>}
          {bulkUploadResult && (
            <div className={`rounded-lg p-4 text-sm ${bulkUploadResult.success === false ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>
              <p>{bulkUploadResult.message}</p>
              {bulkUploadResult.errors?.length > 0 && <ul className="mt-2 list-disc pl-5">{bulkUploadResult.errors.map((item, index) => <li key={index}>{item.error || item.message || String(item)}</li>)}</ul>}
            </div>
          )}
          <div className="mt-auto flex justify-end gap-2 border-t pt-3">
            <button type="button" onClick={() => setShowBulkUploadModal(false)} className="rounded-lg border px-4 py-2 text-sm">Close</button>
            <button type="button" onClick={handleBulkUploadSubmit} disabled={!bulkUploadFile || !companyOptions.length || isBulkUploading} className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{isBulkUploading ? "Uploading..." : "Upload Excel"}</button>
          </div>
        </div>
      </Modal>

      {/* VIEW MACHINE MODAL */}

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
                  {selectedMachine.tid_number || "-"}
                </span>
              </div>

              <div className="flex justify-between border-b pb-3">
                <span className="text-gray-500">
                  Serial Number
                </span>

                <span className="font-semibold">
                  {getSerialNumber(selectedMachine)}
                </span>
              </div>

              <div className="flex justify-between border-b pb-3">
                <span className="text-gray-500">
                  Model
                </span>

                <span className="font-semibold">
                  {getMachineModel(selectedMachine)}
                </span>
              </div>

              <div className="flex justify-between border-b pb-3">
                <span className="text-gray-500">Company Provider</span>
                <span className="font-semibold">{selectedMachine.company_name || "-"}</span>
              </div>

              <div className="flex justify-between border-b pb-3">
                <span className="text-gray-500">
                  Assigned To
                </span>

                <span className="font-semibold">
                  {getAssignedMachineName(selectedMachine)}
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-gray-500">
                  Status
                </span>

                {detailLoading ? <span className="text-sm text-gray-500">Loading details...</span> : getStatusBadge(getMachineStatus(selectedMachine))}
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
