// Pages/PosMachineList.jsx
import React, { useState, useEffect, useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Search,
  RefreshCw,
  Download,
  Smartphone,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowUpDown,
  Filter,
} from "lucide-react";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { getAllPosMachines } from "../api/posMachine";
import Loader from "../components/Loader";
import { maskEmailForUser } from "../utils/userAccess";

const PosMachineList = ({ currentUser }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  // Read status and search from URL search params
  const statusParam = (searchParams.get("status") || "all").toLowerCase().trim();
  const pageParam = Math.max(1, parseInt(searchParams.get("page") || "1", 10));

  const [searchInput, setSearchInput] = useState("");
  const [committedSearch, setCommittedSearch] = useState("");
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(pageParam);

  // Synchronize state when URL params change
  useEffect(() => {
    const pageFromUrl = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    setCurrentPage(pageFromUrl);
  }, [searchParams]);

  // Determine query status filter
  const queryStatus = useMemo(() => {
    if (statusParam === "active") return "active";
    if (statusParam === "inactive" || statusParam === "deactive" || statusParam === "in_active") return "inactive";
    return null;
  }, [statusParam]);

  // Query backend data
  const {
    data: machinesData,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ["posMachinesList", queryStatus, committedSearch, currentPage, pageSize],
    queryFn: () =>
      getAllPosMachines({
        status: queryStatus,
        search: committedSearch || null,
        page: currentPage,
        limit: pageSize,
      }),
    keepPreviousData: true,
  });

  const machines = useMemo(() => {
    if (!machinesData) return [];
    if (Array.isArray(machinesData.data)) return machinesData.data;
    if (Array.isArray(machinesData.list)) return machinesData.list;
    if (Array.isArray(machinesData.rows)) return machinesData.rows;
    return [];
  }, [machinesData]);

  const pagination = machinesData?.pagination || {};
  const totalRecords = Number(pagination.total || machines.length || 0);
  const totalPages = Math.max(1, Number(pagination.totalPages || Math.ceil(totalRecords / pageSize) || 1));

  // Determine page heading based on status filter
  const pageHeading = useMemo(() => {
    if (statusParam === "active") return "Active POS Machines";
    if (statusParam === "inactive" || statusParam === "deactive") return "De-Active POS Machines";
    return "POS Machine List";
  }, [statusParam]);

  const handleStatusTabChange = (newStatus) => {
    setCurrentPage(1);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (newStatus === "all") {
        next.delete("status");
      } else {
        next.set("status", newStatus);
      }
      next.set("page", "1");
      return next;
    });
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setCommittedSearch(searchInput.trim());
    setCurrentPage(1);
  };

  const handleSearchClear = () => {
    setSearchInput("");
    setCommittedSearch("");
    setCurrentPage(1);
  };

  const handlePageChange = (newPage) => {
    if (newPage < 1 || newPage > totalPages) return;
    setCurrentPage(newPage);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("page", String(newPage));
      return next;
    });
  };

  const handleExport = () => {
    if (!machines || machines.length === 0) return;

    const exportRows = machines.map((machine, index) => ({
      "S.No": (currentPage - 1) * pageSize + index + 1,
      "TID Number": machine.tid_number || "-",
      "MID Number": machine.mid_number || "-",
      "Device Serial Number": machine.device_serial_number || "-",
      "Razorpay ID": machine.razorpay_id || "-",
      "Company Name": machine.company_name || "-",
      "Bank Name": machine.bank_name || "-",
      "Status": machine.status || "-",
      "Assigned Name": machine?.assigned_user?.name || "-",
      "Assigned Role": machine?.assigned_user?.role || "-",
      "Assigned Username": machine?.assigned_user?.username || "-",
      "Assigned Mobile": machine?.assigned_user?.mobile_number || "-",
      "Created Date": machine.createdAt ? new Date(machine.createdAt).toLocaleString("en-IN") : "-",
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "POS_Machines");
    const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    const dataBlob = new Blob([excelBuffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    saveAs(dataBlob, `POS_Machines_${statusParam}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const getStatusBadge = (status) => {
    const s = String(status || "").toLowerCase().trim();
    if (s === "active" || s === "assigned") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
          Active
        </span>
      );
    }
    if (s === "inactive" || s === "in_active" || s === "deactive" || s === "in-active") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-200">
          <XCircle className="w-3 h-3 text-rose-600" />
          De-Active
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">
        <Clock className="w-3 h-3 text-blue-600" />
        {status || "Added"}
      </span>
    );
  };

  const getRoleBadge = (role) => {
    if (!role) return null;
    const r = String(role).toLowerCase();
    const roleColors = {
      merchant: "bg-purple-100 text-purple-800 border-purple-200",
      franchise: "bg-blue-100 text-blue-800 border-blue-200",
      franchaise: "bg-blue-100 text-blue-800 border-blue-200",
      super_franchise: "bg-amber-100 text-amber-800 border-amber-200",
      admin: "bg-emerald-100 text-emerald-800 border-emerald-200",
      employee: "bg-gray-100 text-gray-800 border-gray-200",
    };
    return (
      <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium uppercase border ${roleColors[r] || "bg-gray-100 text-gray-700"}`}>
        {r === "franchaise" ? "Franchise" : r.replace("_", " ")}
      </span>
    );
  };

  return (
    <div className="bg-gray-100 min-h-screen p-4 md:p-6 w-full space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <Smartphone className="w-6 h-6 text-primary" />
            {pageHeading}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Displaying real-time database records and machine allocation status.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 shadow-sm transition disabled:opacity-60"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${isFetching ? "animate-spin text-primary" : "text-gray-500"}`} />
            <span>Refresh</span>
          </button>

          <button
            onClick={handleExport}
            disabled={machines.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:opacity-90 shadow-sm transition disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            <span>Export Excel</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs and Search Bar */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          {/* Status Tabs */}
          <div className="inline-flex rounded-lg bg-gray-100 p-1 border border-gray-200">
            <button
              onClick={() => handleStatusTabChange("all")}
              className={`px-3.5 py-1.5 rounded-md text-sm font-semibold transition ${
                statusParam === "all" || !statusParam
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              All Machines
            </button>
            <button
              onClick={() => handleStatusTabChange("active")}
              className={`px-3.5 py-1.5 rounded-md text-sm font-semibold transition ${
                statusParam === "active"
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Active
            </button>
            <button
              onClick={() => handleStatusTabChange("inactive")}
              className={`px-3.5 py-1.5 rounded-md text-sm font-semibold transition ${
                statusParam === "inactive" || statusParam === "deactive"
                  ? "bg-rose-600 text-white shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              De-Active
            </button>
          </div>

          {/* Search Form */}
          <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 max-w-md w-full">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search by TID, MID, Serial Number..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="w-full pl-9 pr-8 py-2 text-sm rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
              {searchInput && (
                <button
                  type="button"
                  onClick={handleSearchClear}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs font-bold"
                >
                  ✕
                </button>
              )}
            </div>
            <button
              type="submit"
              className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition shadow-sm"
            >
              Search
            </button>
          </form>
        </div>

        {/* Active Filters Summary */}
        {(statusParam !== "all" || committedSearch) && (
          <div className="flex items-center gap-2 pt-2 border-t border-gray-100 text-xs text-gray-500">
            <span className="font-semibold text-gray-700">Filters:</span>
            {statusParam !== "all" && (
              <span className="bg-gray-100 px-2 py-0.5 rounded border border-gray-200 text-gray-800">
                Status: {statusParam}
              </span>
            )}
            {committedSearch && (
              <span className="bg-gray-100 px-2 py-0.5 rounded border border-gray-200 text-gray-800">
                Search: "{committedSearch}"
              </span>
            )}
            <button
              onClick={() => {
                handleStatusTabChange("all");
                handleSearchClear();
              }}
              className="text-primary hover:underline font-medium ml-2"
            >
              Reset all
            </button>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      {isLoading ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 flex flex-col items-center justify-center">
          <Loader />
          <p className="mt-4 text-sm text-gray-500">Loading POS machines from database...</p>
        </div>
      ) : isError ? (
        <div className="bg-white rounded-xl shadow-sm border border-red-200 p-8 text-center space-y-3">
          <div className="inline-flex p-3 rounded-full bg-red-100 text-red-600 mb-1">
            <XCircle className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900">Failed to load POS machines</h3>
          <p className="text-sm text-gray-500 max-w-md mx-auto">
            {error?.message || "An unexpected error occurred while communicating with the server."}
          </p>
          <button
            onClick={() => refetch()}
            className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:opacity-90 transition"
          >
            Try Again
          </button>
        </div>
      ) : machines.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center space-y-3">
          <div className="inline-flex p-4 rounded-full bg-gray-100 text-gray-400 mb-2">
            <Smartphone className="w-10 h-10" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900">No POS machines found</h3>
          <p className="text-sm text-gray-500 max-w-sm mx-auto">
            {committedSearch
              ? `No machines matched your search term "${committedSearch}". Try searching by another keyword.`
              : statusParam !== "all"
              ? `No ${statusParam} POS machines currently recorded in the database.`
              : "No POS machines are currently available in the system."}
          </p>
          {(statusParam !== "all" || committedSearch) && (
            <button
              onClick={() => {
                handleStatusTabChange("all");
                handleSearchClear();
              }}
              className="mt-2 inline-flex items-center px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-semibold hover:bg-gray-800 transition"
            >
              Clear Filters
            </button>
          )}
        </div>
      ) : (
        /* Data Table */
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600">
              <thead className="bg-gray-50 text-xs uppercase text-gray-700 font-semibold border-b border-gray-200">
                <tr>
                  <th scope="col" className="px-4 py-3.5 w-12 text-center">#</th>
                  <th scope="col" className="px-4 py-3.5">TID Number</th>
                  <th scope="col" className="px-4 py-3.5">MID Number</th>
                  <th scope="col" className="px-4 py-3.5">Device Serial</th>
                  <th scope="col" className="px-4 py-3.5">Bank / Company</th>
                  <th scope="col" className="px-4 py-3.5">Assigned User</th>
                  <th scope="col" className="px-4 py-3.5 text-center">Status</th>
                  <th scope="col" className="px-4 py-3.5">Created Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {machines.map((machine, index) => {
                  const assignedUser = machine.assigned_user;
                  const rowNumber = (currentPage - 1) * pageSize + index + 1;

                  return (
                    <tr
                      key={machine.id || index}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-4 py-3.5 text-center text-xs text-gray-400 font-mono">
                        {rowNumber}
                      </td>
                      <td className="px-4 py-3.5 font-semibold text-gray-900 font-mono text-xs">
                        {machine.tid_number || "-"}
                      </td>
                      <td className="px-4 py-3.5 font-mono text-xs text-gray-700">
                        {machine.mid_number || "-"}
                      </td>
                      <td className="px-4 py-3.5 font-mono text-xs text-gray-700">
                        {machine.device_serial_number || "-"}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="text-xs">
                          <span className="font-medium text-gray-800">{machine.bank_name || "-"}</span>
                          {machine.company_name && (
                            <span className="block text-gray-400 text-[11px] truncate max-w-[140px]">
                              {machine.company_name}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        {assignedUser ? (
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-gray-900 text-xs">
                                {assignedUser.name || "User"}
                              </span>
                              {getRoleBadge(assignedUser.role)}
                            </div>
                            <div className="text-[11px] text-gray-500 font-mono">
                              {assignedUser.username || assignedUser.email
                                ? maskEmailForUser(assignedUser.email || assignedUser.username, currentUser)
                                : "-"}
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400 italic">Unassigned (In Stock)</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        {getStatusBadge(machine.status)}
                      </td>
                      <td className="px-4 py-3.5 text-xs text-gray-500 whitespace-nowrap">
                        {machine.createdAt ? new Date(machine.createdAt).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric"
                        }) : "-"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Table Footer with Pagination */}
          <div className="px-4 py-3.5 bg-gray-50 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <span>
                Showing <strong>{(currentPage - 1) * pageSize + 1}</strong> to{" "}
                <strong>{Math.min(currentPage * pageSize, totalRecords)}</strong> of{" "}
                <strong>{totalRecords}</strong> machines
              </span>
              <span className="text-gray-300">|</span>
              <label className="text-xs text-gray-500 flex items-center gap-1">
                Per page:
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="rounded border border-gray-300 py-0.5 px-1.5 text-xs bg-white text-gray-700 focus:outline-none"
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                </select>
              </label>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage <= 1 || isFetching}
                className="px-3 py-1.5 rounded border border-gray-300 bg-white text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-40 transition"
              >
                Previous
              </button>
              <span className="px-3 py-1.5 text-xs font-medium text-gray-700">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage >= totalPages || isFetching}
                className="px-3 py-1.5 rounded border border-gray-300 bg-white text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-40 transition"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PosMachineList;