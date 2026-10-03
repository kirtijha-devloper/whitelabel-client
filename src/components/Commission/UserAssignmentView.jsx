import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getUserCommissions } from "../../api/commissionApi";
import { FaSearch, FaUser, FaCreditCard, FaMobileAlt, FaWallet, FaMoneyBillWave, FaExchangeAlt, FaBriefcase } from "react-icons/fa";
import { CommissionFormModal } from "./CommissionFormModal";

// --- Helpers ---

const getMethodIcon = (method) => {
  const m = String(method || "").toLowerCase();
  if (m.includes("card")) return <FaCreditCard className="text-blue-500" />;
  if (m.includes("upi")) return <FaMobileAlt className="text-green-500" />;
  if (m.includes("wallet")) return <FaWallet className="text-purple-500" />;
  if (m.includes("cash")) return <FaMoneyBillWave className="text-green-600" />;
  if (m.includes("net") || m.includes("banking")) return <FaBriefcase className="text-orange-500" />;
  return <FaExchangeAlt className="text-gray-500" />;
};

const normalizeRule = (rule, source) => {
  return {
    ...rule,
    source, // 'global' or 'user'
    // Ensure we have standard fields for display
    displayMethod: rule.method,
    displaySubtext: [rule.network, rule.cardType].filter(Boolean).join(" • ") || "—",
    min: Number(rule.min_amount ?? rule.minAmount ?? 0),
    max: Number(rule.max_amount ?? rule.maxAmount ?? 0),
    rate: Number(rule.commissionRate ?? rule.percent_fee ?? 0),
  };
};

const resolveEffectiveRules = (globalRules, userRules) => {
  // 1. Create a map of global rules by signature
  // Signature: Method|Network|CardType|Min|Max
  // Ideally, user overrides match the global rule structure or replace it.
  // For this UI, we want to show:
  // - All Global Rules (if not overridden, show Global, else show User)
  // - Plus any User-specific rules that don't match a global rule (custom additions)

  const map = new Map();

  // Helper to generate a unique key for matching logic
  // We match primarily on Method + Network + CardType to group them
  // But strictly, an override might be precise range match or just "same slot".
  // For simplicity: We list ALL Global rules as potential slots.

  const processed = [];

  // A. Process Global Rules First
  globalRules.forEach(gRule => {
    // Try to find a matching user rule (exact range match preferred)
    const userMatch = userRules.find(uRule =>
      uRule.method === gRule.method &&
      uRule.network === gRule.network &&
      uRule.cardType === gRule.cardType &&
      Number(uRule.min_amount) === Number(gRule.min_amount) &&
      Number(uRule.max_amount) === Number(gRule.max_amount)
    );

    if (userMatch) {
      processed.push(normalizeRule(userMatch, 'user-override'));
    } else {
      processed.push(normalizeRule(gRule, 'global'));
    }
  });

  // B. valid unused user rules (custom ones that didn't match a global range exactly)
  // This might duplicate if ranges are slightly different. 
  // For now, let's just add any user rule that wasn't used in step A?
  // Actually, simplistic matching above might miss "User has 3 rules, Global has 1". 
  // Let's rely on the simple matching for now.

  // Find user rules not included yet
  userRules.forEach(uRule => {
    // Check if we already processed this EXACT user rule object
    const isProcessed = processed.some(p => p.id === uRule.id && p.source === 'user-override');
    if (!isProcessed) {
      // Double check it wasn't a match by logic
      const alreadyMatched = processed.find(p =>
        p.source === 'user-override' &&
        p.method === uRule.method &&
        Number(p.min) === Number(Number(uRule.min_amount ?? 0))
      );
      if (!alreadyMatched) {
        processed.push(normalizeRule(uRule, 'user-custom'));
      }
    }
  });

  return processed;
};


export const UserAssignmentView = ({ users, globalRules, onUpdate }) => {
  const [selectedUser, setSelectedUser] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editRule, setEditRule] = useState(null);

  // Filter Users
  const filteredUsers = useMemo(() => {
    if (!searchTerm) return users;
    const lower = searchTerm.toLowerCase();
    return users.filter(u =>
      u.name?.toLowerCase().includes(lower) ||
      String(u.id).includes(lower) ||
      String(u.mobile).includes(lower)
    );
  }, [users, searchTerm]);

  // Fetch User Commissions
  const { data: userRawRules = [], refetch: refetchUserRules } = useQuery({
    queryKey: ["user-commission", selectedUser?.id],
    enabled: !!selectedUser,
    queryFn: () => getUserCommissions(selectedUser?.id),
  });

  // Calculate Effective Rates
  const effectiveRules = useMemo(() => {
    if (!selectedUser) return [];
    return resolveEffectiveRules(globalRules, userRawRules);
  }, [globalRules, userRawRules, selectedUser]);

  const handleOverride = (rule) => {
    // Prepare data for the modal
    // If Global -> We are creating a NEW user rule based on this global one.
    // If User -> We are editing an EXISTING user rule.

    const isGlobal = rule.source === 'global';

    const data = {
      ...rule,
      // vital: ensure checking correct ID
      id: isGlobal ? undefined : rule.id,
      user_id: selectedUser.id,
      // Ensure format matches what Modal expects
      minAmount: rule.min,
      maxAmount: rule.max,
      commissionRate: rule.rate,
      target_default_id: isGlobal ? rule.id : rule.commission_default_id
    };

    setEditRule(data);
    setModalOpen(true);
  };

  const handleModalSave = () => {
    refetchUserRules();
    if (onUpdate) onUpdate();
  };

  return (
    <div className="flex flex-col lg:flex-row h-auto lg:h-[calc(100vh-200px)] min-h-0 lg:min-h-[600px] w-full gap-4 lg:gap-6">

      {/* Left Pane: User List */}
      <div className="flex w-full lg:w-1/3 flex-col rounded-xl bg-white shadow-sm border border-gray-100 overflow-hidden max-h-[360px] lg:max-h-none">
        <div className="border-b p-4">
          <h3 className="mb-3 text-lg font-semibold text-gray-800 flex items-center gap-2">
            <FaUser className="text-[#00D3CD]" /> Find User
          </h3>
          <div className="relative">
            <input
              type="text"
              placeholder="Search by name or ID..."
              className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-[#00D3CD] focus:ring-1 focus:ring-[#00D3CD]"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <FaSearch className="absolute left-3.5 top-3 text-gray-400" />
          </div>
          <button className="mt-3 w-full rounded-lg bg-[#111827] py-2 text-sm font-medium text-white hover:bg-gray-800 transition-colors">
            Search
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {filteredUsers.map((user) => (
            <div
              key={user.id}
              onClick={() => setSelectedUser(user)}
              className={`cursor-pointer rounded-lg p-3 transition-all ${selectedUser?.id === user.id
                  ? "bg-[#E6FFFA] ring-1 ring-[#00D3CD]"
                  : "hover:bg-gray-50"
                }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">{user.name}</p>
                  <p className="text-xs text-gray-500 capitalize">• {user.type}</p>
                </div>
                {selectedUser?.id === user.id && (
                  <div className="h-2 w-2 rounded-full bg-[#00D3CD]" />
                )}
              </div>
            </div>
          ))}
          {filteredUsers.length === 0 && (
            <div className="p-4 text-center text-sm text-gray-500">No users found</div>
          )}
        </div>
      </div>

      {/* Right Pane: Effective Rates */}
      <div className="flex-1 rounded-xl bg-white shadow-sm border border-gray-100 overflow-hidden flex flex-col min-h-[420px] lg:min-h-0">
        {selectedUser ? (
          <>
            <div className="border-b px-6 py-5">
              <h2 className="text-xl font-bold text-gray-800">{selectedUser.name}</h2>
              <p className="text-sm text-gray-500">Effective Commission Rates</p>
            </div>

            <div className="flex-1 overflow-y-auto">
              <div className="md:hidden p-4 space-y-3">
                {effectiveRules.length === 0 ? (
                  <div className="text-center text-sm text-gray-500 py-6">
                    No commission rules found for this user.
                  </div>
                ) : (
                  effectiveRules.map((rule, idx) => (
                    <div key={idx} className="rounded-xl border border-gray-100 p-4 shadow-sm">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${rule.source === 'global'
                            ? 'bg-gray-100 text-gray-600'
                            : 'bg-blue-50 text-blue-700'
                          }`}>
                          {rule.source === 'global' ? 'Default' : 'Custom'}
                        </span>
                        <button
                          onClick={() => handleOverride(rule)}
                          className="text-sm font-medium text-[#00D3CD] hover:text-[#00b8b3]"
                        >
                          {rule.source === 'global' ? 'Override' : 'Edit'}
                        </button>
                      </div>

                      <div className="flex items-center gap-3 mb-2">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-50">
                          {getMethodIcon(rule.displayMethod)}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 text-sm">{rule.displayMethod}</p>
                          <p className="text-xs text-gray-500 uppercase">{rule.displaySubtext}</p>
                        </div>
                      </div>

                      <p className="text-sm text-gray-700">
                        <span className="font-medium">Range:</span> {rule.min.toFixed(2)} - {rule.max.toFixed(2)}
                      </p>
                      <p className="text-sm text-gray-700">
                        <span className="font-medium">Rate:</span> {rule.rate}%
                      </p>
                    </div>
                  ))
                )}
              </div>

              <div className="hidden md:block overflow-x-auto">
                <table className="w-full min-w-[720px] text-left bg-white">
                  <thead className="sticky top-0 bg-gray-50 text-xs font-semibold uppercase text-gray-500 tracking-wider">
                    <tr>
                      <th className="px-6 py-3">Source</th>
                      <th className="px-6 py-3">Rule Type</th>
                      <th className="px-6 py-3">Range</th>
                      <th className="px-6 py-3">Rate</th>
                      <th className="px-6 py-3 text-right">Edit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {effectiveRules.map((rule, idx) => (
                      <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${rule.source === 'global'
                              ? 'bg-gray-100 text-gray-600'
                              : 'bg-blue-50 text-blue-700'
                            }`}>
                            {rule.source === 'global' ? 'Default' : 'Custom'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-50">
                              {getMethodIcon(rule.displayMethod)}
                            </div>
                            <div>
                              <p className="font-medium text-gray-900 text-sm">{rule.displayMethod}</p>
                              <p className="text-xs text-gray-500 uppercase">{rule.displaySubtext}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {rule.min.toFixed(2)} - {rule.max.toFixed(2)}
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm font-bold text-gray-900">{rule.rate}%</span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => handleOverride(rule)}
                            className="text-sm font-medium text-[#00D3CD] hover:text-[#00b8b3] underline decoration-transparent hover:decoration-current transition-all"
                          >
                            {rule.source === 'global' ? 'Override' : 'Edit'}
                          </button>
                        </td>
                      </tr>
                    ))}
                    {effectiveRules.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                          No commission rules found for this user.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : (
          <div className="flex h-full flex-col items-center justify-center p-8 text-center text-gray-400">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-50">
              <FaUser className="h-8 w-8 text-gray-300" />
            </div>
            <h3 className="text-lg font-medium text-gray-900">No User Selected</h3>
            <p className="mt-1 max-w-xs text-sm">Select a user from the list on the left to view and manage their commission rates.</p>
          </div>
        )}
      </div>

      <CommissionFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        mode="user"
        users={[selectedUser]} // Restrict modal to just this user to prevent confusion
        userCommissionLabel={selectedUser?.type}
        globalRules={globalRules}
        editData={editRule}
        onEditSave={handleModalSave}
      />
    </div>
  );
};
