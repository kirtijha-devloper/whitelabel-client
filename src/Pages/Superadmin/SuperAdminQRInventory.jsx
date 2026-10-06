import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaArrowLeft,
  FaQrcode,
  FaSearch,
  FaPlus,
  FaCheckCircle,
  FaExclamationTriangle,
  FaEye,
  FaVolumeUp,
  FaLayerGroup,
  FaTag,
} from "react-icons/fa";
import { toast } from "react-toastify";

const SuperAdminQRInventory = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedQR, setSelectedQR] = useState(null);

  // Mock QR Stock Data
  const [qrList, setQrList] = useState([
    {
      id: "qr-1001",
      qr_code: "QR-ABHEE-9011",
      type: "Acrylic Standee",
      vpa_id: "abheepay.mmerchant01@hdfcbank",
      partner_bank: "HDFC Bank",
      assigned_to: "Admin Alpha (Global Pay)",
      status: "active",
      created_at: "2026-09-10",
    },
    {
      id: "qr-1002",
      qr_code: "QR-ABHEE-9012",
      type: "4G Soundbox",
      vpa_id: "abheepay.soundbox02@icici",
      partner_bank: "ICICI Bank",
      assigned_to: "Super Franchise West",
      status: "active",
      created_at: "2026-09-12",
    },
    {
      id: "qr-1003",
      qr_code: "QR-ABHEE-9013",
      type: "Acrylic Standee",
      vpa_id: "unassigned.qr03@abheepay",
      partner_bank: "Axis Bank",
      assigned_to: "Unassigned",
      status: "unassigned",
      created_at: "2026-09-15",
    },
    {
      id: "qr-1004",
      qr_code: "QR-ABHEE-9014",
      type: "NFC QR Card",
      vpa_id: "abheepay.card04@yesbank",
      partner_bank: "Yes Bank",
      assigned_to: "Merchant Food Hub",
      status: "active",
      created_at: "2026-09-18",
    },
    {
      id: "qr-1005",
      qr_code: "QR-ABHEE-9015",
      type: "4G Soundbox",
      vpa_id: "unassigned.soundbox05@abheepay",
      partner_bank: "HDFC Bank",
      assigned_to: "Unassigned",
      status: "unassigned",
      created_at: "2026-09-20",
    },
    {
      id: "qr-1006",
      qr_code: "QR-ABHEE-9016",
      type: "Sticker",
      vpa_id: "damaged.qr06@abheepay",
      partner_bank: "ICICI Bank",
      assigned_to: "Returned - Print Fault",
      status: "damaged",
      created_at: "2026-09-22",
    },
  ]);

  const [formData, setFormData] = useState({
    qr_code: "",
    vpa_id: "",
    type: "Acrylic Standee",
    partner_bank: "HDFC Bank",
    status: "unassigned",
  });

  const handleAddSubmit = (e) => {
    e.preventDefault();
    if (!formData.qr_code || !formData.vpa_id) {
      toast.error("Please fill in QR Code ID and VPA ID");
      return;
    }

    const newEntry = {
      id: `qr-${Date.now()}`,
      ...formData,
      assigned_to: "Unassigned",
      created_at: new Date().toISOString().split("T")[0],
    };

    setQrList([newEntry, ...qrList]);
    toast.success("QR Standee / Soundbox added to inventory successfully!");
    setIsAddModalOpen(false);
    setFormData({
      qr_code: "",
      vpa_id: "",
      type: "Acrylic Standee",
      partner_bank: "HDFC Bank",
      status: "unassigned",
    });
  };

  const filteredQr = qrList.filter((item) => {
    const matchesSearch =
      item.qr_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.vpa_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.partner_bank?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.assigned_to?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesType = typeFilter === "all" || item.type === typeFilter;
    const matchesStatus =
      statusFilter === "all" || item.status === statusFilter;

    return matchesSearch && matchesType && matchesStatus;
  });

  const getStatusBadge = (status) => {
    switch (status) {
      case "active":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <FaCheckCircle className="w-3 h-3 text-emerald-500" /> Active VPA
          </span>
        );
      case "unassigned":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">
            <FaLayerGroup className="w-3 h-3 text-purple-500" /> Stock Ready
          </span>
        );
      case "damaged":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <FaExclamationTriangle className="w-3 h-3 text-rose-500" /> Damaged / Defect
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
            <div className="p-3 bg-purple-50 text-purple-600 rounded-xl">
              <FaQrcode className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                QR & Soundbox Inventory
              </h1>
              <p className="text-xs text-gray-500 mt-0.5">
                Manage physical QR standees, 4G voice soundboxes, NFC cards, and merchant VPA mappings.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold shadow-md transition-all"
          >
            <FaPlus className="w-4 h-4" /> Add QR Stock
          </button>
        </div>
      </div>

      {/* STATS OVERVIEW */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <p className="text-xs text-gray-400 font-medium">Total QR Stock</p>
          <p className="text-xl font-bold text-gray-900 mt-1">{qrList.length}</p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <p className="text-xs text-gray-400 font-medium">Active VPAs</p>
          <p className="text-xl font-bold text-emerald-600 mt-1">
            {qrList.filter((q) => q.status === "active").length}
          </p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <p className="text-xs text-gray-400 font-medium">Unassigned Stock</p>
          <p className="text-xl font-bold text-purple-600 mt-1">
            {qrList.filter((q) => q.status === "unassigned").length}
          </p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <p className="text-xs text-gray-400 font-medium">Voice Soundboxes</p>
          <p className="text-xl font-bold text-indigo-600 mt-1">
            {qrList.filter((q) => q.type.includes("Soundbox")).length}
          </p>
        </div>
      </div>

      {/* FILTERS & SEARCH */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:w-80">
          <FaSearch className="absolute left-3.5 top-3 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Search QR Code, VPA, Bank..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto">
          {["all", "Acrylic Standee", "4G Soundbox", "NFC QR Card", "Sticker"].map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
                typeFilter === t
                  ? "bg-purple-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {t === "all" ? "All Media" : t}
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
                <th className="px-6 py-4">QR Code ID</th>
                <th className="px-6 py-4">Media Type</th>
                <th className="px-6 py-4">VPA / UPI ID</th>
                <th className="px-6 py-4">Partner Bank</th>
                <th className="px-6 py-4">Assigned Entity</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredQr.length > 0 ? (
                filteredQr.map((q) => (
                  <tr key={q.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4 font-mono font-bold text-gray-900">
                      {q.qr_code}
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-purple-50 text-purple-700">
                        {q.type.includes("Soundbox") && (
                          <FaVolumeUp className="w-3 h-3 text-purple-600" />
                        )}
                        {q.type}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-gray-700">
                      {q.vpa_id}
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 rounded text-xs font-bold bg-gray-100 text-gray-800">
                        {q.partner_bank}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-600">{q.assigned_to}</td>
                    <td className="px-6 py-4">{getStatusBadge(q.status)}</td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => setSelectedQR(q)}
                        className="p-1.5 rounded-lg text-gray-500 hover:text-purple-600 hover:bg-purple-50 transition-colors"
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
                    No QR items found matching filter criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ADD QR MODAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-xl p-6 space-y-4">
            <h3 className="text-lg font-bold text-gray-900 border-b pb-3">
              Add New QR Standee / Soundbox
            </h3>

            <form onSubmit={handleAddSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  QR Code Identifier *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. QR-ABHEE-9981"
                  value={formData.qr_code}
                  onChange={(e) =>
                    setFormData({ ...formData, qr_code: e.target.value })
                  }
                  className="w-full px-3 py-2 text-sm border rounded-xl focus:ring-2 focus:ring-purple-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  VPA / UPI ID String *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. merchant@hdfcbank"
                  value={formData.vpa_id}
                  onChange={(e) =>
                    setFormData({ ...formData, vpa_id: e.target.value })
                  }
                  className="w-full px-3 py-2 text-sm border rounded-xl focus:ring-2 focus:ring-purple-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Media Type
                  </label>
                  <select
                    value={formData.type}
                    onChange={(e) =>
                      setFormData({ ...formData, type: e.target.value })
                    }
                    className="w-full px-3 py-2 text-sm border rounded-xl focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  >
                    <option value="Acrylic Standee">Acrylic Standee</option>
                    <option value="4G Soundbox">4G Soundbox</option>
                    <option value="NFC QR Card">NFC QR Card</option>
                    <option value="Sticker">Sticker</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Partner Bank
                  </label>
                  <select
                    value={formData.partner_bank}
                    onChange={(e) =>
                      setFormData({ ...formData, partner_bank: e.target.value })
                    }
                    className="w-full px-3 py-2 text-sm border rounded-xl focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  >
                    <option value="HDFC Bank">HDFC Bank</option>
                    <option value="ICICI Bank">ICICI Bank</option>
                    <option value="Axis Bank">Axis Bank</option>
                    <option value="Yes Bank">Yes Bank</option>
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
                  className="px-5 py-2 text-sm bg-purple-600 text-white font-semibold rounded-xl hover:bg-purple-700"
                >
                  Save QR Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VIEW DETAILS MODAL */}
      {selectedQR && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-xl p-6 space-y-4">
            <h3 className="text-lg font-bold text-gray-900 border-b pb-3 flex items-center justify-between">
              <span>QR Item Details</span>
              <button
                onClick={() => setSelectedQR(null)}
                className="text-gray-400 hover:text-gray-600 text-sm"
              >
                ✕
              </button>
            </h3>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between border-b pb-2">
                <span className="text-gray-500">QR Code ID:</span>
                <span className="font-bold text-gray-900 font-mono">
                  {selectedQR.qr_code}
                </span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-gray-500">Media Type:</span>
                <span className="font-semibold text-purple-700">
                  {selectedQR.type}
                </span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-gray-500">VPA String:</span>
                <span className="font-mono text-xs text-gray-800">
                  {selectedQR.vpa_id}
                </span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-gray-500">Partner Bank:</span>
                <span className="font-semibold text-gray-800">
                  {selectedQR.partner_bank}
                </span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-gray-500">Assigned Entity:</span>
                <span className="font-semibold text-gray-800">
                  {selectedQR.assigned_to}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Status:</span>
                <span>{getStatusBadge(selectedQR.status)}</span>
              </div>
            </div>

            <div className="pt-4 border-t flex justify-end">
              <button
                onClick={() => setSelectedQR(null)}
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

export default SuperAdminQRInventory;
