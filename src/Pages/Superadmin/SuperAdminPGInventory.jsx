import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaArrowLeft,
  FaServer,
  FaSearch,
  FaPlus,
  FaCheckCircle,
  FaExclamationTriangle,
  FaEye,
  FaShieldAlt,
  FaSlidersH,
} from "react-icons/fa";
import { toast } from "react-toastify";

const SuperAdminPGInventory = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [providerFilter, setProviderFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedPG, setSelectedPG] = useState(null);

  // Mock PG Inventory Data
  const [pgList, setPgList] = useState([
    {
      id: "pg-201",
      mid: "MID-RZP-998201",
      gateway: "Razorpay PG",
      title: "Primary Retail HDFC Aggregator",
      company_name: "AGRO-AXIS Admin Pool",
      daily_limit: "₹ 50,00,000",
      status: "active",
      created_at: "2026-08-10",
    },
    {
      id: "pg-202",
      mid: "MID-CF-441092",
      gateway: "Cashfree PG",
      title: "Instant Payout & Collection Channel",
      company_name: "Global Pay Solutions",
      daily_limit: "₹ 1,00,00,000",
      status: "active",
      created_at: "2026-08-15",
    },
    {
      id: "pg-203",
      mid: "MID-WL-112048",
      gateway: "Worldline",
      title: "Unallocated Backup Gateway MID",
      company_name: "Unallocated Stock",
      daily_limit: "₹ 25,00,000",
      status: "unallocated",
      created_at: "2026-08-20",
    },
    {
      id: "pg-204",
      mid: "MID-HDFC-882103",
      gateway: "HDFC PG Direct",
      title: "Corporate Merchant MID Channel",
      company_name: "Everlife Admin",
      daily_limit: "Unlimited",
      status: "active",
      created_at: "2026-09-01",
    },
    {
      id: "pg-205",
      mid: "MID-PPE-554201",
      gateway: "PhonePe PG",
      title: "Sandbox Testing Channel",
      company_name: "Internal Sandbox Pool",
      daily_limit: "₹ 1,00,000",
      status: "sandbox",
      created_at: "2026-09-10",
    },
  ]);

  const [formData, setFormData] = useState({
    mid: "",
    gateway: "Razorpay PG",
    title: "",
    company_name: "AGRO-AXIS Admin Pool",
    daily_limit: "₹ 50,00,000",
    status: "unallocated",
  });

  const handleAddSubmit = (e) => {
    e.preventDefault();
    if (!formData.mid || !formData.title) {
      toast.error("Please fill in MID String and Account Title");
      return;
    }

    const newEntry = {
      id: `pg-${Date.now()}`,
      ...formData,
      created_at: new Date().toISOString().split("T")[0],
    };

    setPgList([newEntry, ...pgList]);
    toast.success("PG MID added to Inventory successfully!");
    setIsAddModalOpen(false);
    setFormData({
      mid: "",
      gateway: "Razorpay PG",
      title: "",
      company_name: "AGRO-AXIS Admin Pool",
      daily_limit: "₹ 50,00,000",
      status: "unallocated",
    });
  };

  const filteredPg = pgList.filter((item) => {
    const matchesSearch =
      item.mid?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.company_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.gateway?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesProvider =
      providerFilter === "all" || item.gateway === providerFilter;
    const matchesStatus =
      statusFilter === "all" || item.status === statusFilter;

    return matchesSearch && matchesProvider && matchesStatus;
  });

  const getStatusBadge = (status) => {
    switch (status) {
      case "active":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <FaCheckCircle className="w-3 h-3 text-emerald-500" /> Active MID
          </span>
        );
      case "unallocated":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            <FaShieldAlt className="w-3 h-3 text-blue-500" /> Unallocated
          </span>
        );
      case "sandbox":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <FaSlidersH className="w-3 h-3 text-amber-500" /> Sandbox / Testing
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
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
      {/* BREADCRUMB & HEADER */}
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
        <div>
          <button
            onClick={() => navigate("/super-admin/inventory")}
            className="inline-flex items-center gap-2 text-xs font-semibold text-gray-500 hover:text-cyan-600 mb-2 transition-colors"
          >
            <FaArrowLeft className="w-3 h-3" /> Back to Inventory Overview
          </button>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-cyan-50 text-cyan-600 rounded-xl">
              <FaServer className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                PG MID & Gateway Inventory
              </h1>
              <p className="text-xs text-gray-500 mt-0.5">
                Manage Payment Gateway MIDs, Aggregator API Accounts, and merchant routing pools.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-cyan-500 hover:bg-cyan-600 text-white font-semibold transition-all shadow-sm"
          >
            <FaPlus className="w-4 h-4" /> Add PG MID
          </button>
        </div>
      </div>

      {/* STATS OVERVIEW */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mt-6">
        <div className="rounded-2xl bg-gradient-to-br from-teal-500 to-cyan-500 text-white p-5 min-h-[145px]">
          <p className="text-sm font-semibold">Total PG MIDs</p>
          <p className="text-3xl font-bold mt-2">{pgList.length}</p>
        </div>
        <div className="rounded-2xl bg-green-500 text-white p-5 min-h-[145px]">
          <p className="text-sm font-semibold">Active Channels</p>
          <p className="text-3xl font-bold mt-2">
            {pgList.filter((p) => p.status === "active").length}
          </p>
        </div>
        <div className="rounded-2xl bg-blue-600 text-white p-5 min-h-[145px]">
          <p className="text-sm font-semibold">Unallocated MIDs</p>
          <p className="text-3xl font-bold mt-2">
            {pgList.filter((p) => p.status === "unallocated").length}
          </p>
        </div>
        <div className="rounded-2xl bg-red-500 text-white p-5 min-h-[145px]">
          <p className="text-sm font-semibold">Sandbox / Testing</p>
          <p className="text-3xl font-bold mt-2">
            {pgList.filter((p) => p.status === "sandbox").length}
          </p>
        </div>
      </div>
      </div>

      {/* FILTERS & SEARCH */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="relative w-full md:max-w-md">
          <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search MID, Title, Company..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-11 pr-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-transparent"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto overflow-x-auto">
          {["all", "Razorpay PG", "Cashfree PG", "Worldline", "HDFC PG Direct", "PhonePe PG"].map((p) => (
            <button
              key={p}
              onClick={() => setProviderFilter(p)}
              className={`px-5 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition ${
                providerFilter === p
                  ? "bg-gray-900 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {p === "all" ? "All Providers" : p}
            </button>
          ))}
        </div>
      </div>
      </div>

      {/* DATA TABLE */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">MID String</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Gateway Provider</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Account Title</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Assigned Company / Pool</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Daily Cap</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Status</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredPg.length > 0 ? (
                filteredPg.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4 font-mono font-bold text-gray-900">
                      {p.mid}
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-blue-50 text-blue-800">
                        {p.gateway}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-medium text-gray-800">
                      {p.title}
                    </td>
                    <td className="px-6 py-4 text-gray-600">{p.company_name}</td>
                    <td className="px-6 py-4 font-mono font-medium text-gray-900">
                      {p.daily_limit}
                    </td>
                    <td className="px-6 py-4">{getStatusBadge(p.status)}</td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => setSelectedPG(p)}
                        className="p-1.5 rounded-lg text-gray-500 hover:text-cyan-700 hover:bg-cyan-50 transition-colors"
                        title="View Details"
                      >
                        <FaEye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" className="px-6 py-10 text-center text-gray-500">
                    No PG MIDs found matching criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ADD PG MID MODAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-xl p-6 space-y-4">
            <h3 className="text-lg font-bold text-gray-900 border-b pb-3">
              Add New Payment Gateway MID
            </h3>

            <form onSubmit={handleAddSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  MID Identifier String *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. MID-RZP-99120"
                  value={formData.mid}
                  onChange={(e) =>
                    setFormData({ ...formData, mid: e.target.value })
                  }
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-cyan-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Account Title / Channel Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Retail Fast Pay MID Pool"
                  value={formData.title}
                  onChange={(e) =>
                    setFormData({ ...formData, title: e.target.value })
                  }
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-cyan-400 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Gateway Provider
                  </label>
                  <select
                    value={formData.gateway}
                    onChange={(e) =>
                      setFormData({ ...formData, gateway: e.target.value })
                    }
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-cyan-400 focus:outline-none"
                  >
                    <option value="Razorpay PG">Razorpay PG</option>
                    <option value="Cashfree PG">Cashfree PG</option>
                    <option value="Worldline">Worldline</option>
                    <option value="HDFC PG Direct">HDFC PG Direct</option>
                    <option value="PhonePe PG">PhonePe PG</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Daily Cap Limit
                  </label>
                  <select
                    value={formData.daily_limit}
                    onChange={(e) =>
                      setFormData({ ...formData, daily_limit: e.target.value })
                    }
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-cyan-400 focus:outline-none"
                  >
                    <option value="₹ 25,00,000">₹ 25 Lakhs</option>
                    <option value="₹ 50,00,000">₹ 50 Lakhs</option>
                    <option value="₹ 1,00,00,000">₹ 1 Crore</option>
                    <option value="Unlimited">Unlimited</option>
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
                  className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-cyan-500 hover:bg-cyan-600 text-white font-semibold transition-all shadow-sm"
                >
                  Save PG MID
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VIEW DETAILS MODAL */}
      {selectedPG && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-xl p-6 space-y-4">
            <h3 className="text-lg font-bold text-gray-900 border-b pb-3 flex items-center justify-between">
              <span>PG Account Details</span>
              <button
                onClick={() => setSelectedPG(null)}
                className="text-gray-400 hover:text-gray-600 text-sm"
              >
                ✕
              </button>
            </h3>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between border-b pb-2">
                <span className="text-gray-500">MID String:</span>
                <span className="font-bold text-gray-900 font-mono">
                  {selectedPG.mid}
                </span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-gray-500">Gateway Provider:</span>
                <span className="font-semibold text-blue-700">
                  {selectedPG.gateway}
                </span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-gray-500">Account Title:</span>
                <span className="font-semibold text-gray-800">
                  {selectedPG.title}
                </span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-gray-500">Assigned Pool:</span>
                <span className="font-semibold text-gray-800">
                  {selectedPG.company_name}
                </span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-gray-500">Daily Limit:</span>
                <span className="font-bold font-mono text-gray-900">
                  {selectedPG.daily_limit}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Status:</span>
                <span>{getStatusBadge(selectedPG.status)}</span>
              </div>
            </div>

            <div className="pt-4 border-t flex justify-end">
              <button
                onClick={() => setSelectedPG(null)}
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

export default SuperAdminPGInventory;
