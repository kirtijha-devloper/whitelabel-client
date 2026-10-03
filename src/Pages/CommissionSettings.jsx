import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CommissionTable } from "../components/Commission/CommissionTable";
import { CommissionFormModal } from "../components/Commission/CommissionFormModal";
import { UserAssignmentView } from "../components/Commission/UserAssignmentView";
import {
  getDefaultCommissions,
  updateDefaultCommission, // Used for global edits
  deleteDefaultCommission, // Used for global deletes
} from "../api/commissionApi";
import {
  GetAllFranchises,
  GetAllMerchants
} from "../api/FranchiseApi";

const toArray = (value) => {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.data)) return value.data;
  if (Array.isArray(value?.list)) return value.list;
  return [];
};

const rowKey = (row) => {
  return `${row?.id}`;
};

const clampPercent = (value) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return Math.min(100, Math.max(0, num));
};

export default function CommissionSettings() {
  const [activeTab, setActiveTab] = useState("global"); // 'global' | 'user'

  // Global Tab States
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRow, setEditingRow] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);

  // --- Queries ---

  const { data: globalCommissions, refetch: refetchGlobal } = useQuery({
    queryKey: ["global-commission"],
    queryFn: getDefaultCommissions,
    retry: false,
  });

  const { data: assignmentUsers = [] } = useQuery({
    queryKey: ["commission-assignment-users"],
    retry: false,
    queryFn: async () => {
      const [franchises, merchants] = await Promise.all([
        GetAllFranchises(),
        GetAllMerchants()
      ]);

      const extractArray = (payload) => {
        if (Array.isArray(payload)) return payload;
        if (Array.isArray(payload?.data)) return payload.data;
        if (Array.isArray(payload?.users)) return payload.users;
        if (Array.isArray(payload?.franchises)) return payload.franchises;
        if (Array.isArray(payload?.merchants)) return payload.merchants;
        if (Array.isArray(payload?.result)) return payload.result;
        return [];
      };

      const normalize = (u, type) => ({
        id: u.id || u._id,
        name: u.name,
        mobile: u.mobile_number || u.phone || u.mobile,
        type
      });

      const franchiseList = extractArray(franchises);
      const merchantList = extractArray(merchants);

      console.log(`DEBUG: Found ${franchiseList.length} franchises and ${merchantList.length} merchants`);

      return [
        ...franchiseList.map(u => normalize(u, 'Franchise')),
        ...merchantList.map(u => normalize(u, 'Merchant'))
      ];
    },
  });

  // --- Global Rules Handlers ---

  const globalRows = toArray(globalCommissions);

  const handleGlobalEdit = (row) => {
    setEditingRow(row);
    setModalOpen(true);
  };

  const handleGlobalDelete = (row) => {
    setPendingDelete(row);
  };

  const confirmGlobalDelete = async () => {
    if (!pendingDelete?.id) return;
    try {
      await deleteDefaultCommission(pendingDelete.id);
      refetchGlobal();
      setPendingDelete(null);
    } catch (error) {
      window.alert(error.message || "Delete failed");
    }
  };

  const handleGlobalSave = async (updatedData) => {
    // The Modal handles the mutation properly for both create and update if we pass the right callbacks 
    // OR we can just let the Modal do the mutation logic as it currently does (it has useMutation inside it).
    // CommissionFormModal calls createDefaultCommission or updateDefaultCommission internally.
    // So we just need to refresh local data.
    refetchGlobal();
  };

  return (
    <div className="bg-gray-100 min-h-screen">

      {/* Header & Tabs */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Commission Settings</h1>
          <p className="text-sm text-gray-500 mt-1">Manage global rules and user-specific overrides</p>
        </div>

        <div className="grid grid-cols-2 bg-white p-1 rounded-lg border border-gray-200 shadow-sm">
          <button
            onClick={() => setActiveTab("global")}
            className={`px-3 py-2 text-sm font-medium rounded-md transition-all ${activeTab === 'global'
                ? 'bg-gray-100 text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
              }`}
          >
            Global Rules
          </button>
          <button
            onClick={() => setActiveTab("user")}
            className={`px-3 py-2 text-sm font-medium rounded-md transition-all ${activeTab === 'user'
                ? 'bg-gray-100 text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
              }`}
          >
            User Assignment
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div>
        {activeTab === 'global' && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <button
                onClick={() => {
                  setEditingRow(null);
                  setModalOpen(true);
                }}
                className="w-full sm:w-auto rounded-lg bg-[#00D3CD] px-4 py-2 text-white transition-colors hover:bg-[#00b8b3] shadow-sm font-medium"
              >
                Add New Rule
              </button>
            </div>

            <CommissionTable
              data={globalRows}
              onEdit={handleGlobalEdit}
              onDelete={handleGlobalDelete}
            />

            {/* Reuse the existing Modal logic for Global Rules */}
            <CommissionFormModal
              open={modalOpen}
              onClose={() => {
                setModalOpen(false);
                setEditingRow(null);
              }}
              mode="global"
              users={[]} // Not needed for global
              globalRules={globalRows}
              editData={editingRow}
              onEditSave={handleGlobalSave}
            />

            {/* Delete Confirmation */}
            {pendingDelete && (
              <div
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
                onClick={() => setPendingDelete(null)}
              >
                <div
                  className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
                  onClick={(e) => e.stopPropagation()}
                >
                  <h2 className="text-xl font-semibold text-gray-900 mb-2">Delete Rule?</h2>
                  <p className="text-gray-600 mb-6">
                    Are you sure you want to delete this commission rule? This will remove the default rate for all users who don't have an override.
                  </p>
                  <div className="flex justify-end gap-3">
                    <button
                      onClick={() => setPendingDelete(null)}
                      className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={confirmGlobalDelete}
                      className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 font-medium"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'user' && (
          <UserAssignmentView
            users={assignmentUsers}
            globalRules={globalRows}
          />
        )}
      </div>
    </div>
  );
}
