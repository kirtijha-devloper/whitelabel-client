import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Loader2,
  Plus,
  Layers,
  Building2,
  User,
  Search,
  X,
  CheckCircle2,
  CreditCard,
  AlertCircle,
} from 'lucide-react';
import {
  MerchantAllUsers,
  FranchiseAllUsers,
  SuperFranchiseAllUsers,
} from '../api/FranchiseApi';
import { getAdminList } from '../api/superAdminApi';
import { toast } from 'react-toastify';
import {
  listBbpsChargeRules,
  createBbpsChargeRule,
  updateBbpsChargeRule,
  deleteBbpsChargeRule,
  fetchMyAdminApplicableCharges,
  fetchApplicableCcBillRulesForUser,
  fetchSuperAdminCcBillRules,
  createSuperAdminCcBillRule,
  updateSuperAdminCcBillRule,
  deleteSuperAdminCcBillRule,
} from '../api/rateSettingsApi';

const CcBillRateSettings = ({ isSuperAdmin = false }) => {
  const queryClient = useQueryClient();
  const [activeSubTab, setActiveSubTab] = useState('user_override'); // 'user_override' | 'company_default'
  const [selectedUserId, setSelectedUserId] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('ALL'); // 'ALL' | 'Super Franchise' | 'Franchise' | 'Merchant' (or 'Admin')
  const [searchInputVal, setSearchInputVal] = useState('');
  const [activeSearchTerm, setActiveSearchTerm] = useState('');

  // Modals visibility
  const [showUserModal, setShowUserModal] = useState(false);
  const [showDefaultModal, setShowDefaultModal] = useState(false);

  // Forms
  const [userForm, setUserForm] = useState({
    user_id: '',
    from_amount: '',
    to_amount: '',
    rate: '',
    rate_type: 'flat',
    is_active: true,
    description: '',
  });
  const [userEditingId, setUserEditingId] = useState(null);

  const [defaultForm, setDefaultForm] = useState({
    from_amount: '',
    to_amount: '',
    rate: '',
    rate_type: 'flat',
    is_active: true,
    description: '',
  });
  const [defaultEditingId, setDefaultEditingId] = useState(null);

  // ── 1. Downline Users Queries ──────────────────────────────────────────────
  const { data: superFranchisesData } = useQuery({
    queryKey: ['super_franchises', 'active'],
    queryFn: () => SuperFranchiseAllUsers({ page: 1, limit: 1000 }),
    enabled: !isSuperAdmin,
  });

  const { data: franchisesData } = useQuery({
    queryKey: ['franchises', 'active'],
    queryFn: () => FranchiseAllUsers({ page: 1, limit: 1000 }),
    enabled: !isSuperAdmin,
  });

  const { data: merchantsData } = useQuery({
    queryKey: ['merchants', 'active'],
    queryFn: () => MerchantAllUsers({ page: 1, limit: 1000 }),
    enabled: !isSuperAdmin,
  });

  const { data: adminUsersData } = useQuery({
    queryKey: ['admin_users', 'active'],
    queryFn: () => getAdminList({ page: 1, limit: 1000 }),
    enabled: isSuperAdmin,
  });

  // Combine target users & deduplicate by id
  const allTargetUsers = useMemo(() => {
    if (isSuperAdmin) {
      const list = (
        Array.isArray(adminUsersData)
          ? adminUsersData
          : Array.isArray(adminUsersData?.data)
          ? adminUsersData.data
          : []
      ).map((adm) => ({ ...adm, userType: 'Admin' }));
      return list;
    }

    const sfList = (
      Array.isArray(superFranchisesData)
        ? superFranchisesData
        : Array.isArray(superFranchisesData?.data)
        ? superFranchisesData.data
        : []
    ).map((sf) => ({ ...sf, userType: 'Super Franchise' }));

    const fList = (
      Array.isArray(franchisesData)
        ? franchisesData
        : Array.isArray(franchisesData?.data)
        ? franchisesData.data
        : []
    ).map((f) => ({ ...f, userType: 'Franchise' }));

    const mList = (
      Array.isArray(merchantsData)
        ? merchantsData
        : Array.isArray(merchantsData?.data)
        ? merchantsData.data
        : []
    ).map((m) => ({ ...m, userType: 'Merchant' }));

    const seen = new Set();
    return [...sfList, ...fList, ...mList].filter((u) => {
      if (seen.has(u.id)) return false;
      seen.add(u.id);
      return true;
    });
  }, [isSuperAdmin, superFranchisesData, franchisesData, merchantsData, adminUsersData]);

  const filteredTargetUsers = useMemo(() => {
    let list = allTargetUsers;
    if (userRoleFilter !== 'ALL') {
      list = list.filter((u) => u.userType === userRoleFilter);
    }
    const term = activeSearchTerm.trim().toLowerCase();
    if (!term) return list;

    return list.filter(
      (u) =>
        u.name?.toLowerCase().includes(term) ||
        u.email?.toLowerCase().includes(term) ||
        u.username?.toLowerCase().includes(term) ||
        u.phone?.toLowerCase().includes(term) ||
        u.mobile?.toLowerCase().includes(term) ||
        String(u.id).includes(term)
    );
  }, [allTargetUsers, userRoleFilter, activeSearchTerm]);

  const selectedUserObj = useMemo(() => {
    const targetId = selectedUserId || userForm.user_id;
    if (!targetId) return null;
    return allTargetUsers.find((u) => String(u.id) === String(targetId));
  }, [allTargetUsers, selectedUserId, userForm.user_id]);

  // ── 2. Super Admin Baseline Query (For Admins) ─────────────────────────────
  const { data: baselineChargesRes } = useQuery({
    queryKey: ['my_applicable_charges_cc'],
    queryFn: fetchMyAdminApplicableCharges,
    enabled: !isSuperAdmin,
  });

  const baselineRules = useMemo(() => {
    if (isSuperAdmin) return [];
    const cc =
      baselineChargesRes?.data?.ccBillRate ||
      baselineChargesRes?.ccBillRate ||
      baselineChargesRes?.data?.cc_bill ||
      baselineChargesRes?.data?.ccBill;
    if (Array.isArray(cc?.configuredRates)) return cc.configuredRates;
    if (Array.isArray(cc)) return cc;
    return [];
  }, [baselineChargesRes, isSuperAdmin]);

  // ── 3. Company Default CC Bill Rules Query ─────────────────────────────────
  const { data: defaultRulesRes, isLoading: loadingDefaultRules } = useQuery({
    queryKey: isSuperAdmin ? ['super_admin_cc_rules'] : ['company_default_cc_rules'],
    queryFn: isSuperAdmin
      ? fetchSuperAdminCcBillRules
      : () => listBbpsChargeRules({ user_id: 'default' }),
  });

  const companyDefaultRules = useMemo(() => {
    const raw = defaultRulesRes?.data || defaultRulesRes;
    if (Array.isArray(raw)) return raw;
    return [];
  }, [defaultRulesRes]);

  // ── 4. Selected User Override Rules Query ──────────────────────────────────
  const { data: userRulesRes, isLoading: loadingUserRules } = useQuery({
    queryKey: ['user_cc_bill_rules', selectedUserId],
    queryFn: () =>
      selectedUserId
        ? fetchApplicableCcBillRulesForUser(selectedUserId)
        : Promise.resolve({ data: [] }),
    enabled: !!selectedUserId,
  });

  const userRules = useMemo(() => {
    if (!selectedUserId) return [];
    const raw =
      userRulesRes?.data?.userRules ||
      (Array.isArray(userRulesRes?.data) ? userRulesRes.data : Array.isArray(userRulesRes) ? userRulesRes : []);
    return raw;
  }, [userRulesRes, selectedUserId]);

  // ── 5. Mutations: Company Default ──────────────────────────────────────────
  const saveDefaultMutation = useMutation({
    mutationFn: async (payload) => {
      if (isSuperAdmin) {
        if (defaultEditingId) {
          return updateSuperAdminCcBillRule(defaultEditingId, payload);
        }
        return createSuperAdminCcBillRule(payload);
      }
      if (defaultEditingId) {
        return updateBbpsChargeRule(defaultEditingId, payload);
      }
      return createBbpsChargeRule(payload);
    },
    onSuccess: () => {
      toast.success(
        defaultEditingId
          ? 'Default CC Bill rule updated successfully!'
          : 'Default CC Bill rule created successfully!'
      );
      queryClient.invalidateQueries([
        isSuperAdmin ? 'super_admin_cc_rules' : 'company_default_cc_rules',
      ]);
      setShowDefaultModal(false);
      setDefaultEditingId(null);
      setDefaultForm({
        from_amount: '',
        to_amount: '',
        rate: '',
        rate_type: 'flat',
        is_active: true,
        description: '',
      });
    },
    onError: (err) => {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to save rule');
    },
  });

  const deleteDefaultMutation = useMutation({
    mutationFn: async (id) => {
      if (isSuperAdmin) {
        return deleteSuperAdminCcBillRule(id);
      }
      return deleteBbpsChargeRule(id);
    },
    onSuccess: () => {
      toast.success('Default CC Bill rule deleted');
      queryClient.invalidateQueries([
        isSuperAdmin ? 'super_admin_cc_rules' : 'company_default_cc_rules',
      ]);
    },
    onError: (err) => {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to delete rule');
    },
  });

  const handleDefaultSubmit = (e) => {
    e.preventDefault();
    const fromVal = parseFloat(defaultForm.from_amount);
    const toVal = parseFloat(defaultForm.to_amount);
    const rateVal = parseFloat(defaultForm.rate);

    if (Number.isNaN(fromVal) || Number.isNaN(toVal) || Number.isNaN(rateVal)) {
      toast.error('From amount, to amount, and rate must be valid numbers');
      return;
    }
    if (fromVal > toVal) {
      toast.error('From amount must be less than or equal to To amount');
      return;
    }

    const payload = {
      from_amount: fromVal,
      to_amount: toVal,
      rate: rateVal,
      rate_type: defaultForm.rate_type,
      is_active: defaultForm.is_active,
      description: defaultForm.description || 'BBPS CC Bill Charge Default',
      user_id: null,
    };
    saveDefaultMutation.mutate(payload);
  };

  // ── 6. Mutations: User Override ────────────────────────────────────────────
  const saveUserMutation = useMutation({
    mutationFn: async (payload) => {
      if (isSuperAdmin) {
        if (userEditingId) {
          return updateSuperAdminCcBillRule(userEditingId, payload);
        }
        return createSuperAdminCcBillRule(payload);
      }
      if (userEditingId) {
        return updateBbpsChargeRule(userEditingId, payload);
      }
      return createBbpsChargeRule(payload);
    },
    onSuccess: () => {
      toast.success(
        userEditingId
          ? 'User override updated successfully!'
          : 'User override created successfully!'
      );
      queryClient.invalidateQueries(['user_cc_bill_rules', selectedUserId]);
      setShowUserModal(false);
      setUserEditingId(null);
      setUserForm({
        user_id: selectedUserId || '',
        from_amount: '',
        to_amount: '',
        rate: '',
        rate_type: 'flat',
        is_active: true,
        description: '',
      });
    },
    onError: (err) => {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to save override');
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (id) => {
      if (isSuperAdmin) {
        return deleteSuperAdminCcBillRule(id);
      }
      return deleteBbpsChargeRule(id);
    },
    onSuccess: () => {
      toast.success('User override removed, reverted to default rates');
      queryClient.invalidateQueries(['user_cc_bill_rules', selectedUserId]);
    },
    onError: (err) => {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to delete override');
    },
  });

  const handleUserSubmit = (e) => {
    e.preventDefault();
    const targetId = userForm.user_id || selectedUserId;
    if (!targetId) {
      toast.error('Please select a downline user first');
      return;
    }
    const fromVal = parseFloat(userForm.from_amount);
    const toVal = parseFloat(userForm.to_amount);
    const rateVal = parseFloat(userForm.rate);

    if (Number.isNaN(fromVal) || Number.isNaN(toVal) || Number.isNaN(rateVal)) {
      toast.error('From amount, to amount, and rate must be valid numbers');
      return;
    }
    if (fromVal > toVal) {
      toast.error('From amount must be less than or equal to To amount');
      return;
    }

    const payload = {
      from_amount: fromVal,
      to_amount: toVal,
      rate: rateVal,
      rate_type: userForm.rate_type,
      is_active: userForm.is_active,
      description: userForm.description || `CC Bill User Override for ${targetId}`,
      user_id: Number(targetId),
    };
    saveUserMutation.mutate(payload);
  };

  const openNewUserModal = (targetUser = null) => {
    const uid = targetUser?.id ? String(targetUser.id) : selectedUserId || '';
    setUserEditingId(null);
    setUserForm({
      user_id: uid,
      from_amount: '',
      to_amount: '',
      rate: '',
      rate_type: 'flat',
      is_active: true,
      description: '',
    });
    setShowUserModal(true);
  };

  const openEditUserModal = (rule) => {
    setUserEditingId(rule.id);
    setUserForm({
      user_id: String(rule.user_id || selectedUserId),
      from_amount: rule.from_amount ?? '',
      to_amount: rule.to_amount ?? '',
      rate: rule.rate ?? '',
      rate_type: rule.rate_type ?? 'flat',
      is_active: rule.is_active ?? true,
      description: rule.description ?? '',
    });
    setShowUserModal(true);
  };

  const openNewDefaultModal = () => {
    setDefaultEditingId(null);
    setDefaultForm({
      from_amount: '',
      to_amount: '',
      rate: '',
      rate_type: 'flat',
      is_active: true,
      description: '',
    });
    setShowDefaultModal(true);
  };

  const openEditDefaultModal = (rule) => {
    setDefaultEditingId(rule.id);
    setDefaultForm({
      from_amount: rule.from_amount ?? '',
      to_amount: rule.to_amount ?? '',
      rate: rule.rate ?? '',
      rate_type: rule.rate_type ?? 'flat',
      is_active: rule.is_active ?? true,
      description: rule.description ?? '',
    });
    setShowDefaultModal(true);
  };

  const selectUser = (u) => {
    setSelectedUserId(String(u.id));
    setUserForm((prev) => ({ ...prev, user_id: String(u.id) }));
  };

  const clearSelectedUser = () => {
    setSelectedUserId('');
    setUserForm((prev) => ({ ...prev, user_id: '' }));
  };

  return (
    <div className="space-y-6">
      {/* ── Header & Sub-Tabs ─────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 md:p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b">
          <div>
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-[#00D3CD]" />
              CC Bill Pay Charge Settings
            </h2>
            <p className="text-xs md:text-sm text-gray-500 mt-1">
              Configure CC Bill pay charges for downline users (Super Franchise, Franchise, Merchant) or set company default slabs.
            </p>
          </div>

          <div className="flex items-center bg-gray-100 p-1 rounded-lg">
            <button
              onClick={() => setActiveSubTab('user_override')}
              className={`px-4 py-2 text-xs md:text-sm font-semibold rounded-md transition ${
                activeSubTab === 'user_override'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Downline User Overrides
            </button>
            <button
              onClick={() => setActiveSubTab('company_default')}
              className={`px-4 py-2 text-xs md:text-sm font-semibold rounded-md transition ${
                activeSubTab === 'company_default'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Company Default Slabs
            </button>
          </div>
        </div>

        {/* ── Baseline Box (What Super Admin charges this Admin) ─────────────── */}
        {!isSuperAdmin && (
          <div className="mt-4 p-4 bg-indigo-50/60 rounded-xl border border-indigo-100">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-indigo-700" />
                <span className="text-xs font-bold text-indigo-950 uppercase tracking-wide">
                  Super Admin Baseline (Your Incurred Cost)
                </span>
              </div>
              <span className="text-[11px] text-indigo-700">
                Downline users inherit these slabs unless overridden.
              </span>
            </div>

            <div className="mt-2.5 flex flex-wrap gap-2">
              {baselineRules.length === 0 ? (
                <span className="text-xs text-gray-500 bg-white px-3 py-1 rounded-md border border-indigo-100">
                  Platform Default: ₹20.00 Flat
                </span>
              ) : (
                baselineRules.map((rule, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1.5 px-3 py-1 bg-white rounded-md border border-indigo-200 text-xs text-indigo-900 shadow-2xs"
                  >
                    <span className="font-medium text-gray-600">
                      ₹{Number(rule.from_amount).toLocaleString()}–₹{Number(rule.to_amount).toLocaleString()}:
                    </span>
                    <strong className="text-indigo-700 font-bold">
                      {rule.rate_type === 'flat' ? `₹${rule.rate}` : `${rule.rate}%`}
                    </strong>
                    <span className="text-[10px] text-gray-400 capitalize">({rule.rate_type})</span>
                  </span>
                ))
              )}
            </div>
          </div>
        )}

        {/* ── 1. USER OVERRIDE RATES (DOWNLINE USERS) ───────────────────────── */}
        {activeSubTab === 'user_override' && (
          <div className="pt-6 space-y-6">
            {/* Search & Filter Bar */}
            <div className="bg-white rounded-xl border border-gray-200 p-4 md:p-5 shadow-sm space-y-4">
              <label className="block text-sm font-semibold text-gray-800">
                Select Downline User to Configure CC Bill Charges
              </label>

              <div className="flex flex-col sm:flex-row gap-2 max-w-3xl items-center">
                {!isSuperAdmin && (
                  <select
                    value={userRoleFilter}
                    onChange={(e) => setUserRoleFilter(e.target.value)}
                    className="w-full sm:w-48 rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-[#00D3CD] focus:outline-none focus:ring-1 focus:ring-[#00D3CD]"
                  >
                    <option value="ALL">All Roles</option>
                    <option value="Super Franchise">Super Franchise</option>
                    <option value="Franchise">Franchise</option>
                    <option value="Merchant">Merchant</option>
                  </select>
                )}

                <div className="relative flex-1 w-full">
                  <input
                    type="text"
                    value={searchInputVal}
                    onChange={(e) => {
                      setSearchInputVal(e.target.value);
                      setActiveSearchTerm(e.target.value);
                    }}
                    placeholder="Search downline user by name, phone, email, or ID..."
                    autoComplete="off"
                    className="w-full rounded-lg border border-gray-300 pl-3 pr-8 py-2 text-sm shadow-sm focus:border-[#00D3CD] focus:outline-none focus:ring-1 focus:ring-[#00D3CD]"
                  />
                  {searchInputVal && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchInputVal('');
                        setActiveSearchTerm('');
                      }}
                      className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => openNewUserModal()}
                  disabled={!selectedUserId}
                  title={!selectedUserId ? 'Select a user below first' : 'Add custom slab override for this user'}
                  className="rounded-lg bg-[#00D3CD] hover:bg-[#00b8b3] px-4 py-2 text-sm font-semibold text-white transition shadow-sm flex items-center gap-1.5 whitespace-nowrap disabled:opacity-50"
                >
                  <Plus className="w-4 h-4 font-bold" /> Add Slab Override
                </button>
              </div>

              {/* User Selection Dropdown */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  Choose Downline User from List ({filteredTargetUsers.length} available)
                </label>
                <select
                  value={selectedUserId}
                  onChange={(e) => {
                    setSelectedUserId(e.target.value);
                    setUserForm((p) => ({ ...p, user_id: e.target.value }));
                  }}
                  className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-[#00D3CD] focus:border-transparent outline-none bg-gray-50/50"
                >
                  <option value="">-- Choose a user to view or set CC Bill charges --</option>
                  {filteredTargetUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      [{u.userType}] {u.name || u.username} {u.phone ? `(${u.phone})` : u.mobile ? `(${u.mobile})` : ''} - ID: #{u.id}
                    </option>
                  ))}
                </select>
              </div>

              {/* Selected User Banner */}
              {selectedUserObj ? (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-emerald-950 text-sm">
                          {selectedUserObj.name || selectedUserObj.username}
                        </span>
                        <span className="px-2 py-0.5 text-xs font-semibold rounded bg-emerald-100 text-emerald-800">
                          {selectedUserObj.userType}
                        </span>
                        <span className="text-xs text-gray-500 font-mono">ID: #{selectedUserObj.id}</span>
                      </div>
                      <p className="text-xs text-emerald-800 mt-0.5">
                        {selectedUserObj.email || 'No Email'} • {selectedUserObj.phone || selectedUserObj.mobile || 'No Mobile'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openNewUserModal(selectedUserObj)}
                      className="px-3 py-1.5 bg-[#00D3CD] text-white rounded-lg text-xs font-semibold hover:bg-[#00b8b3] transition flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Slab
                    </button>
                    <button
                      type="button"
                      onClick={clearSelectedUser}
                      className="px-2.5 py-1.5 text-xs text-gray-500 hover:text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition"
                    >
                      Clear
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl flex items-center gap-3 text-sm text-blue-800">
                  <AlertCircle className="w-5 h-5 text-blue-600 shrink-0" />
                  <span>
                    Select a downline user (Super Franchise, Franchise, or Merchant) from the dropdown above to view or configure their CC Bill pay charge slabs.
                  </span>
                </div>
              )}
            </div>

            {/* Overrides Table for Selected User */}
            {selectedUserId && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                <div className="flex items-center justify-between pb-3 border-b border-gray-100 mb-4">
                  <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                    <User className="w-4 h-4 text-blue-600" />
                    Custom Overrides for: {selectedUserObj?.name || `User #${selectedUserId}`}
                  </h3>
                  <span className="text-xs text-gray-500">
                    {userRules.length} override slab{userRules.length !== 1 ? 's' : ''} configured
                  </span>
                </div>

                {loadingUserRules ? (
                  <div className="flex items-center justify-center py-8 text-gray-500">
                    <Loader2 className="w-5 h-5 animate-spin mr-2 text-[#00D3CD]" />
                    Loading user rules...
                  </div>
                ) : userRules.length === 0 ? (
                  <div className="py-8 text-center text-sm text-gray-500 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                    <p className="font-semibold text-gray-700 mb-1">No custom overrides configured for this user.</p>
                    <p className="text-xs text-gray-500 mb-3">
                      This user automatically inherits your Company Default / Super Admin Baseline rates.
                    </p>
                    <button
                      type="button"
                      onClick={() => openNewUserModal(selectedUserObj)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#00D3CD] text-white text-xs font-semibold rounded-lg hover:bg-[#00b8b3] transition shadow-sm"
                    >
                      <Plus className="w-4 h-4" /> Set First Override Slab
                    </button>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 text-sm">
                      <thead className="bg-gray-50 text-xs font-semibold text-gray-600 uppercase">
                        <tr>
                          <th className="px-4 py-2.5 text-left">Amount Slab</th>
                          <th className="px-4 py-2.5 text-left">Configured Rate</th>
                          <th className="px-4 py-2.5 text-left">Type</th>
                          <th className="px-4 py-2.5 text-left">Status</th>
                          <th className="px-4 py-2.5 text-left">Description</th>
                          <th className="px-4 py-2.5 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {userRules.map((rule) => (
                          <tr key={rule.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 font-medium text-gray-900">
                              ₹{Number(rule.from_amount).toLocaleString()} – ₹{Number(rule.to_amount).toLocaleString()}
                            </td>
                            <td className="px-4 py-3 font-bold text-blue-700">
                              {rule.rate_type === 'flat' ? `₹${rule.rate}` : `${rule.rate}%`}
                            </td>
                            <td className="px-4 py-3 capitalize text-gray-600">{rule.rate_type}</td>
                            <td className="px-4 py-3">
                              <span
                                className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${
                                  rule.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                }`}
                              >
                                {rule.is_active ? 'Active' : 'Inactive'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-500">
                              {rule.description || '—'}
                            </td>
                            <td className="px-4 py-3 text-right space-x-2">
                              <button
                                onClick={() => openEditUserModal(rule)}
                                className="px-2.5 py-1 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => {
                                  if (window.confirm('Delete this user override? The user will revert to default rates.')) {
                                    deleteUserMutation.mutate(rule.id);
                                  }
                                }}
                                className="px-2.5 py-1 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded"
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── 2. COMPANY DEFAULT CC BILL SLABS ──────────────────────────────── */}
        {activeSubTab === 'company_default' && (
          <div className="pt-6 space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-gray-100 gap-3">
                <div>
                  <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-teal-600" />
                    Company Default CC Bill Slabs (Global Fallback)
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    These slab rates apply to all your Super Franchises, Franchises, and Merchants who do not have an individual override.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={openNewDefaultModal}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#00D3CD] text-white text-xs font-semibold rounded-lg hover:bg-[#00b8b3] transition shadow-sm whitespace-nowrap"
                >
                  <Plus className="w-4 h-4" /> Add Default Slab
                </button>
              </div>

              <div className="mt-4 overflow-x-auto">
                {loadingDefaultRules ? (
                  <div className="flex items-center justify-center py-6 text-gray-500">
                    <Loader2 className="w-5 h-5 animate-spin mr-2 text-[#00D3CD]" />
                    Loading default rules...
                  </div>
                ) : companyDefaultRules.length === 0 ? (
                  <div className="py-6 text-center text-sm text-gray-500 bg-gray-50 rounded-lg">
                    No company default slabs configured. All downline users currently inherit the Super Admin baseline above.
                  </div>
                ) : (
                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-gray-50 text-xs font-semibold text-gray-600 uppercase">
                      <tr>
                        <th className="px-4 py-2.5 text-left">Amount Slab</th>
                        <th className="px-4 py-2.5 text-left">Rate</th>
                        <th className="px-4 py-2.5 text-left">Type</th>
                        <th className="px-4 py-2.5 text-left">Status</th>
                        <th className="px-4 py-2.5 text-left">Description</th>
                        <th className="px-4 py-2.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {companyDefaultRules.map((rule) => (
                        <tr key={rule.id} className="hover:bg-gray-50">
                          <td className="px-4 py-2.5 font-medium text-gray-900">
                            ₹{Number(rule.from_amount).toLocaleString()} – ₹{Number(rule.to_amount).toLocaleString()}
                          </td>
                          <td className="px-4 py-2.5 font-bold text-teal-700">
                            {rule.rate_type === 'flat' ? `₹${rule.rate}` : `${rule.rate}%`}
                          </td>
                          <td className="px-4 py-2.5 capitalize text-gray-600">{rule.rate_type}</td>
                          <td className="px-4 py-2.5">
                            <span
                              className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${
                                rule.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                              }`}
                            >
                              {rule.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-xs text-gray-500">{rule.description || '—'}</td>
                          <td className="px-4 py-2.5 text-right space-x-2">
                            <button
                              onClick={() => openEditDefaultModal(rule)}
                              className="px-2.5 py-1 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => {
                                if (window.confirm('Are you sure you want to delete this default rule?')) {
                                  deleteDefaultMutation.mutate(rule.id);
                                }
                              }}
                              className="px-2.5 py-1 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Modal: User Override Slab ─────────────────────────────────────────── */}
      {showUserModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="text-base font-bold text-gray-900">
                {userEditingId ? 'Edit Downline User Override Slab' : 'Add Downline User Override Slab'}
              </h3>
              <button
                type="button"
                onClick={() => setShowUserModal(false)}
                className="text-gray-400 hover:text-gray-600 text-xl font-bold"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleUserSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Target User</label>
                <select
                  value={userForm.user_id}
                  onChange={(e) => setUserForm({ ...userForm, user_id: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-[#00D3CD] focus:border-transparent outline-none"
                  required
                >
                  <option value="">-- Select downline user --</option>
                  {allTargetUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      [{u.userType}] {u.name || u.username} {u.phone ? `(${u.phone})` : u.mobile ? `(${u.mobile})` : ''} - #{u.id}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">From Amount (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0"
                    value={userForm.from_amount}
                    onChange={(e) => setUserForm({ ...userForm, from_amount: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-[#00D3CD] focus:border-transparent outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">To Amount (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="10000"
                    value={userForm.to_amount}
                    onChange={(e) => setUserForm({ ...userForm, to_amount: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-[#00D3CD] focus:border-transparent outline-none"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Rate</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="20"
                    value={userForm.rate}
                    onChange={(e) => setUserForm({ ...userForm, rate: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-[#00D3CD] focus:border-transparent outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Rate Type</label>
                  <select
                    value={userForm.rate_type}
                    onChange={(e) => setUserForm({ ...userForm, rate_type: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-[#00D3CD] focus:border-transparent outline-none"
                  >
                    <option value="flat">Flat (₹)</option>
                    <option value="percentage">Percentage (%)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Description (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Special merchant override"
                  value={userForm.description}
                  onChange={(e) => setUserForm({ ...userForm, description: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-[#00D3CD] focus:border-transparent outline-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="userRuleActive"
                  checked={userForm.is_active}
                  onChange={(e) => setUserForm({ ...userForm, is_active: e.target.checked })}
                  className="w-4 h-4 rounded border-gray-300 text-[#00D3CD] focus:ring-[#00D3CD]"
                />
                <label htmlFor="userRuleActive" className="text-sm font-medium text-gray-700 cursor-pointer">
                  Active (Charge rule enabled)
                </label>
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t">
                <button
                  type="button"
                  onClick={() => setShowUserModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saveUserMutation.isPending}
                  className="px-5 py-2 bg-[#00D3CD] text-white rounded-lg text-sm font-semibold hover:bg-[#00b8b3] transition disabled:opacity-50 inline-flex items-center gap-1.5"
                >
                  {saveUserMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                  {userEditingId ? 'Update Override' : 'Save Override'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Company Default Slab ───────────────────────────────────────── */}
      {showDefaultModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="text-base font-bold text-gray-900">
                {defaultEditingId ? 'Edit Default CC Bill Slab' : 'Add Default CC Bill Slab'}
              </h3>
              <button
                type="button"
                onClick={() => setShowDefaultModal(false)}
                className="text-gray-400 hover:text-gray-600 text-xl font-bold"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleDefaultSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">From Amount (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0"
                    value={defaultForm.from_amount}
                    onChange={(e) => setDefaultForm({ ...defaultForm, from_amount: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-[#00D3CD] focus:border-transparent outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">To Amount (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="10000"
                    value={defaultForm.to_amount}
                    onChange={(e) => setDefaultForm({ ...defaultForm, to_amount: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-[#00D3CD] focus:border-transparent outline-none"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Rate</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="20"
                    value={defaultForm.rate}
                    onChange={(e) => setDefaultForm({ ...defaultForm, rate: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-[#00D3CD] focus:border-transparent outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Rate Type</label>
                  <select
                    value={defaultForm.rate_type}
                    onChange={(e) => setDefaultForm({ ...defaultForm, rate_type: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-[#00D3CD] focus:border-transparent outline-none"
                  >
                    <option value="flat">Flat (₹)</option>
                    <option value="percentage">Percentage (%)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Description (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Default platform charge"
                  value={defaultForm.description}
                  onChange={(e) => setDefaultForm({ ...defaultForm, description: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-[#00D3CD] focus:border-transparent outline-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="defaultRuleActive"
                  checked={defaultForm.is_active}
                  onChange={(e) => setDefaultForm({ ...defaultForm, is_active: e.target.checked })}
                  className="w-4 h-4 rounded border-gray-300 text-[#00D3CD] focus:ring-[#00D3CD]"
                />
                <label htmlFor="defaultRuleActive" className="text-sm font-medium text-gray-700 cursor-pointer">
                  Active (Charge rule enabled)
                </label>
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t">
                <button
                  type="button"
                  onClick={() => setShowDefaultModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saveDefaultMutation.isPending}
                  className="px-5 py-2 bg-[#00D3CD] text-white rounded-lg text-sm font-semibold hover:bg-[#00b8b3] transition disabled:opacity-50 inline-flex items-center gap-1.5"
                >
                  {saveDefaultMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                  {defaultEditingId ? 'Update Slab' : 'Save Slab'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CcBillRateSettings;
