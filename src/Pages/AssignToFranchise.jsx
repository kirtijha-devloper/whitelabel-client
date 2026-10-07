import { Loader2, X } from 'lucide-react';
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import Select from "react-select";
import { assignPosMachineToFranchise, getAllPosMachines } from '../api/posMachine';
import { useMutation, useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { FranchiseAllUsers, searchUsers } from '../api/FranchiseApi';
import { getAdminList } from '../api/superAdminApi';

const FRANCHISE_PAGE_SIZE = 10;

const normalizeArrayPayload = (payload) => {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.data)) return payload.data;
    if (Array.isArray(payload?.list)) return payload.list;
    if (Array.isArray(payload?.rows)) return payload.rows;
    if (Array.isArray(payload?.data?.list)) return payload.data.list;
    if (Array.isArray(payload?.data?.rows)) return payload.data.rows;
    if (Array.isArray(payload?.data?.data)) return payload.data.data;
    return [];
};

const extractPagination = (payload) => {
    return payload?.pagination || payload?.data?.pagination || {};
};

const AssignToFranchise = ({ returnPath, assignmentType = "franchise" }) => {
    const navigate = useNavigate();
    const isAdminAssignment = assignmentType === "admin";
    const [selectedMachines, setSelectedMachines] = useState([]);
    const [selectedFranchise, setSelectedFranchise] = useState(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [showSuccess, setShowSuccess] = useState(false);
    const [franchisePage, setFranchisePage] = useState(1);
    const [franchiseSearchTerm, setFranchiseSearchTerm] = useState("");
    const queryClient = useQueryClient();
    const trimmedFranchiseSearchTerm = franchiseSearchTerm.trim();
    const isFranchiseSearchMode = trimmedFranchiseSearchTerm.length > 0;

    const {
        data: posMachinesPages,
        isLoading: posMachinesLoading,
        error: posMachinesError,
        fetchNextPage: fetchMorePosMachines,
        hasNextPage: hasMorePosMachines,
        isFetchingNextPage: isFetchingMorePosMachines,
        refetch: refetchPosMachines,
    } = useInfiniteQuery({
        queryKey: ["posMachines", searchTerm, selectedFranchise?.value],
        queryFn: ({ pageParam = 1 }) =>
            getAllPosMachines({ tidNumber: searchTerm || null, page: pageParam, limit: 50 }),
        staleTime: 1000 * 60 * 5,
        getNextPageParam: (lastPage) => {
            const currentPage = lastPage?.pagination?.page ?? 1;
            const totalPages = lastPage?.pagination?.totalPages ?? 0;
            return currentPage < totalPages ? currentPage + 1 : undefined;
        },
        keepPreviousData: true,
    });

    const posMachines = (posMachinesPages?.pages ?? []).flatMap((page) =>
        normalizeArrayPayload(page)
    );

    const totalMachines =
        posMachinesPages?.pages?.[0]?.pagination?.total ?? posMachines.length;
    const loadedMachinesCount = posMachines.length;

    const {
        data: franchisesResponse = [],
        isLoading: franchisesLoading,
        error: franchisesError,
    } = useQuery({
        queryKey: [isAdminAssignment ? "superAdminAdminsForPos" : "franchises", franchisePage],
        queryFn: () => isAdminAssignment
            ? getAdminList({ page: franchisePage, limit: FRANCHISE_PAGE_SIZE, status: "active" })
            : FranchiseAllUsers({ page: franchisePage, limit: FRANCHISE_PAGE_SIZE }),
        enabled: !isFranchiseSearchMode,
    });

    const {
        data: searchedFranchisesResponse = [],
        isLoading: searchedFranchisesLoading,
        error: searchedFranchisesError,
    } = useQuery({
        queryKey: [isAdminAssignment ? "superAdminAdminsForPosSearch" : "franchiseSearch", trimmedFranchiseSearchTerm],
        queryFn: () => isAdminAssignment
            ? getAdminList({ search: trimmedFranchiseSearchTerm, status: "active", page: 1, limit: 50 })
            : searchUsers({
                q: trimmedFranchiseSearchTerm,
                status: "active",
                role: "franchaise",
                page: 1,
                limit: 50,
            }),
        enabled: isFranchiseSearchMode,
        staleTime: 30 * 1000,
    });

    const activeFranchiseResponse = isFranchiseSearchMode
        ? searchedFranchisesResponse
        : franchisesResponse;
    const activeFranchiseError = isFranchiseSearchMode
        ? searchedFranchisesError
        : franchisesError;
    const franchises = normalizeArrayPayload(activeFranchiseResponse);
    const franchisePagination = extractPagination(franchisesResponse);
    const franchiseTotalPages = Number(
        franchisePagination?.totalPages ||
        franchisePagination?.total_pages ||
        franchisePagination?.pages ||
        franchisePagination?.last_page ||
        0
    );
    const hasPreviousFranchisePage = franchisePage > 1;
    const hasNextFranchisePage = franchiseTotalPages > 0
        ? franchisePage < franchiseTotalPages
        : franchises.length === FRANCHISE_PAGE_SIZE;

    const assignPosMutation = useMutation({
        mutationFn: ({ posMachineIds, userId }) =>
            assignPosMachineToFranchise(posMachineIds, userId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["franchises"] });
            queryClient.invalidateQueries({ queryKey: ["superAdminAdminsForPos"] });
            queryClient.invalidateQueries({ queryKey: ["superAdminAdminsForPosSearch"] });
            queryClient.invalidateQueries({ queryKey: ["posMachines"] });
            setSelectedMachines([]);
            setSelectedFranchise(null);
            setSearchTerm("");
            if (returnPath) {
                toast.success("POS machines assigned successfully");
                navigate(returnPath);
                return;
            }
            setShowSuccess(true);
            setTimeout(() => setShowSuccess(false), 3000);
        },
        onError: (error) => {
            alert(error.message || "Failed to assign POS machines");
        },
    });

    const handleAssignPos = () => {
        if (selectedMachines.length === 0) {
            alert("Please select at least one POS machine");
            return;
        }
        if (!selectedFranchise) {
            alert(`Please select ${isAdminAssignment ? "an admin" : "a franchise"}`);
            return;
        }
        // Keep backend payload on POS machine id while showing serial number in UI.
        const posMachineIds = selectedMachines.map((machine) => machine.posMachineId ?? machine.value);
        assignPosMutation.mutate({ posMachineIds, userId: selectedFranchise.value });
    };

    const handleSearchChange = (inputValue) => {
        setSearchTerm(inputValue);
    };

    const handleFranchiseChange = (selected) => {
        setSelectedFranchise(selected);
        setSelectedMachines([]);
        setFranchiseSearchTerm("");
    };

    const handleFranchiseInputChange = (inputValue, meta) => {
        if (meta.action === "input-change") {
            setFranchiseSearchTerm(inputValue);
        }

        return inputValue;
    };

    const createMachineOption = (machine) => ({
        value: machine.id ?? machine.tid_number,
        posMachineId: machine.id ?? machine.tid_number,
        tidNumber: machine.tid_number,
        serialNumber: machine.device_serial_number,
        label: `${machine.status} (Serial No.: ${machine.device_serial_number || machine.tid_number || "N/A"})`,
    });

    const availableMachines = posMachines
        .filter((machine) => machine.assigned_to === null)
        .map(createMachineOption);

    const toggleMachine = (machineOption) => {
        setSelectedMachines((current) => {
            const already = current.find((m) => m.value === machineOption.value);
            if (already) return current.filter((m) => m.value !== machineOption.value);
            return [...current, machineOption];
        });
    };

    const franchiseOptions = franchises.map((franchise) => ({
        value: franchise.id,
        label: franchise.name || `${isAdminAssignment ? "Admin" : "Franchise"} ${franchise.id}`,
        mobileNumber: franchise.mobile_number || franchise.mobile || "",
        email: franchise.email || "",
    }));

    const SelectedMachinesList = () => {
        if (selectedMachines.length === 0) return null;

        return (
            <div className="mt-4">
                <h3 className="text-sm font-medium text-gray-700 mb-2">Selected POS Machines:</h3>
                <div className="flex flex-wrap gap-2">
                    {selectedMachines.map((machine) => (
                        <div
                            key={machine.value}
                            className="bg-indigo-100 text-indigo-600 px-3 py-1 rounded-full flex items-center gap-2"
                        >
                            <span>{machine.label}</span>
                            <button
                                type="button"
                                onClick={() => {
                                    setSelectedMachines(
                                        selectedMachines.filter((m) => m.value !== machine.value)
                                    );
                                }}
                                className="hover:text-indigo-800"
                            >
                                <X size={16} />
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    return (
        <div className="p-6 max-w-4xl mx-auto bg-white rounded-xl shadow-md space-y-6">
            <h2 className="text-2xl font-semibold text-gray-900">
                Assign POS Machines to {isAdminAssignment ? "Admin" : "Franchise"}
            </h2>

            {/* Franchise Selection */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select {isAdminAssignment ? "Admin" : "Franchise"}
                </label>
                <Select
                    name="franchise_id"
                    value={selectedFranchise}
                    options={franchiseOptions}
                    onChange={handleFranchiseChange}
                    onInputChange={handleFranchiseInputChange}
                    isLoading={franchisesLoading || searchedFranchisesLoading}
                    placeholder={`Search ${isAdminAssignment ? "admin" : "franchise"} by name, mobile, or email...`}
                    className="w-full"
                    classNamePrefix="react-select"
                    filterOption={() => true}
                    formatOptionLabel={(option, { context }) => {
                        if (context === "value") {
                            return option.label;
                        }

                        const meta = [option.mobileNumber, option.email]
                            .filter(Boolean)
                            .join(" • ");

                        return (
                            <div>
                                <div>{option.label}</div>
                                {meta ? (
                                    <div className="text-xs text-gray-500">{meta}</div>
                                ) : null}
                            </div>
                        );
                    }}
                    noOptionsMessage={() =>
                        activeFranchiseError
                            ? "Error loading franchises"
                            : isFranchiseSearchMode
                                ? "No matching franchises found"
                                : `No ${isAdminAssignment ? "admins" : "franchises"} available`
                    }
                />
                {activeFranchiseError && (
                    <div className="mt-2 p-4 bg-red-50 text-red-600 rounded-lg">
                                {activeFranchiseError.message || `Failed to load ${isAdminAssignment ? "admins" : "franchises"}`}
                    </div>
                )}
                {!isFranchiseSearchMode && !franchisesError && (
                    <div className="mt-3 flex items-center justify-between text-sm text-gray-600">
                        <span>
                            Page {franchisePage}
                            {franchiseTotalPages > 0 ? ` of ${franchiseTotalPages}` : ""}
                        </span>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => setFranchisePage((page) => Math.max(1, page - 1))}
                                disabled={franchisesLoading || !hasPreviousFranchisePage}
                                className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                Previous
                            </button>
                            <button
                                type="button"
                                onClick={() => setFranchisePage((page) => page + 1)}
                                disabled={franchisesLoading || !hasNextFranchisePage}
                                className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                Next
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* POS Machines Selection (requires franchise first) */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    Search and Select POS Machines
                </label>

                <div className="flex flex-col gap-2">
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        disabled={!selectedFranchise}
                        placeholder={
                            selectedFranchise
                                ? "Search by Device Serial Number or name..."
                                : `Select a ${isAdminAssignment ? "admin" : "franchise"} first`
                        }
                        className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:ring-indigo-500 disabled:bg-gray-100"
                    />

                    <div className="rounded-md border border-gray-200 bg-white shadow-sm">
                        {posMachinesLoading ? (
                            <div className="p-6 text-center text-sm text-gray-500">
                                <Loader2 className="inline-block animate-spin h-5 w-5 mr-2" />
                                Loading POS machines...
                            </div>
                        ) : !selectedFranchise ? (
                            <div className="p-6 text-center text-sm text-gray-500">
                                Select a {isAdminAssignment ? "admin" : "franchise"} to load POS machines.
                            </div>
                        ) : availableMachines.length === 0 ? (
                            <div className="p-6 text-center text-sm text-gray-500">
                                {posMachinesError
                                    ? "Error loading POS machines"
                                    : "No unassigned POS machines found"}
                            </div>
                        ) : (
                            <div className="max-h-64 overflow-y-auto">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Select
                                            </th>
                                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Serial / TID
                                            </th>
                                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Status
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {availableMachines.map((machine) => {
                                            const checked = selectedMachines.some(
                                                (m) => m.value === machine.value
                                            );
                                            return (
                                                <tr key={machine.value}>
                                                    <td className="px-3 py-2">
                                                        <input
                                                            type="checkbox"
                                                            checked={checked}
                                                            onChange={() => toggleMachine(machine)}
                                                            className="h-4 w-4 text-indigo-600 border-gray-300 rounded"
                                                        />
                                                    </td>
                                                    <td className="px-3 py-2 text-sm text-gray-700">
                                                        {machine.serialNumber || machine.tidNumber}
                                                    </td>
                                                    <td className="px-3 py-2 text-sm text-gray-700">
                                                        {machine.label}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>

                <SelectedMachinesList />

                {/* Load more / pagination */}
                {selectedFranchise && (
                    <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between text-sm text-gray-600">
                        <span>
                            Showing {loadedMachinesCount} of {totalMachines} unassigned machines
                        </span>
                        {hasMorePosMachines && (
                            <button
                                type="button"
                                onClick={() => fetchMorePosMachines()}
                                disabled={isFetchingMorePosMachines}
                                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition ${
                                    isFetchingMorePosMachines ? "opacity-70 cursor-not-allowed" : ""
                                }`}
                            >
                                {isFetchingMorePosMachines ? "Loading..." : "Load more"}
                            </button>
                        )}
                    </div>
                )}

                {posMachinesError && (
                    <div className="mt-2 p-4 bg-red-50 text-red-600 rounded-lg">
                        {posMachinesError.message || "Failed to load POS machines"}
                    </div>
                )}
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end">
                <button
                    onClick={handleAssignPos}
                    disabled={
                        assignPosMutation.isPending ||
                        selectedMachines.length === 0 ||
                        !selectedFranchise
                    }
                    className={`px-4 py-2 bg-indigo-600 text-white rounded-md flex items-center gap-2 ${assignPosMutation.isPending ||
                            selectedMachines.length === 0 ||
                            !selectedFranchise
                            ? "opacity-70 cursor-not-allowed"
                            : "hover:bg-indigo-700"
                        }`}
                >
                    {assignPosMutation.isPending ? (
                        <>
                            <Loader2 className="animate-spin h-5 w-5" />
                            Assigning...
                        </>
                    ) : (
                        "Assign"
                    )}
                </button>
            </div>

            {/* Success Message */}
            {showSuccess && (
                <div className="fixed bottom-6 right-6 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-2 animate-fade-in">
                    <svg
                        className="h-5 w-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        xmlns="http://www.w3.org/2000/svg"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M5 13l4 4L19 7"
                        />
                    </svg>
                    POS machines assigned successfully!
                </div>
            )}

            {/* Tailwind Animation for Fade-In */}
            <style>
                {`
                    .animate-fade-in {
                        animation: fadeIn 0.5s ease-in;
                    }
                    @keyframes fadeIn {
                        from { opacity: 0; transform: translateY(10px); }
                        to { opacity: 1; transform: translateY(0); }
                    }
                `}
            </style>
        </div>
    );
};

export default AssignToFranchise;
