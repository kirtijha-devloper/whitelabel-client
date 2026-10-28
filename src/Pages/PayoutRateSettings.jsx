import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Select from 'react-select';
import Loader from '../components/Loader';
import { Loader2, Plus, UserCheck, Layers, Building2, User, Search, X, CheckCircle2 } from 'lucide-react';
import { MerchantAllUsers, FranchiseAllUsers, SuperFranchiseAllUsers } from '../api/FranchiseApi';
import { getAdminList } from '../api/superAdminApi';
import { toast } from 'react-toastify';
import { getAuthToken } from '../utils/auth';
import { fetchUserDetails } from '../api/authApi';
import {
  getUserPayoutChargesByUser,
  getCompanyPayoutCharges,
  createUserPayoutCharge,
  updateUserPayoutCharge,
  deleteUserPayoutCharge,
} from '../api/rateSettingsApi';

const PayoutRateSettings = ({ isSuperAdmin = false }) => {
  const queryClient = useQueryClient();

  const { data: userProfileData } = useQuery({
    queryKey: ['userDetails'],
    queryFn: fetchUserDetails,
  });

  const currentUserId = useMemo(() => {
    if (userProfileData?.data?.id) return Number(userProfileData.data.id);
    if (userProfileData?.id) return Number(userProfileData.id);
    const token = getAuthToken();
    if (token) {
      try {
        const parts = token.split('.');
        if (parts.length >= 2) {
          const decoded = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
          return Number(decoded?.id ?? decoded?.user_id ?? decoded?.sub ?? 0) || null;
        }
      } catch (_) {}
    }
    return null;
  }, [userProfileData]);

  const [activeSubTab, setActiveSubTab] = useState('user_override'); // 'user_override' | 'global_default'
  const [selectedUserId, setSelectedUserId] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('ALL'); // 'ALL' | 'Super Franchise' | 'Franchise' | 'Merchant'
  const [searchInputVal, setSearchInputVal] = useState('');
  const [activeSearchTerm, setActiveSearchTerm] = useState('');

  // Modal Popup visibility toggle states
  const [showUserForm, setShowUserForm] = useState(false);
  const [showGlobalForm, setShowGlobalForm] = useState(false);

  // ── Admin List Query (Super Admin only) ──────────────────────────────────
  const { data: adminUsersData } = useQuery({
    queryKey: ['admin_users', 'active'],
    queryFn: () => getAdminList({ page: 1, limit: 1000 }),
    enabled: isSuperAdmin,
  });

  // ── Super Franchise List Query (Admin only) ──────────────────────────────
  const { data: superFranchisesData } = useQuery({
    queryKey: ['super_franchises', 'active'],
    queryFn: () => SuperFranchiseAllUsers({ page: 1, limit: 1000 }),
    enabled: !isSuperAdmin,
  });

  // ── Franchise List Query (Admin only) ────────────────────────────────────
  const { data: franchisesData } = useQuery({
    queryKey: ['franchises', 'active'],
    queryFn: () => FranchiseAllUsers({ page: 1, limit: 1000 }),
    enabled: !isSuperAdmin,
  });

  // ── Merchant List Query (Admin only) ─────────────────────────────────────
  const { data: merchantsData } = useQuery({
    queryKey: ['merchants', 'active'],
    queryFn: () => MerchantAllUsers({ page: 1, limit: 1000 }),
    enabled: !isSuperAdmin,
  });

  // Combine target users according to hierarchy role
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

    const superFranchisesList = (
      Array.isArray(superFranchisesData)
        ? superFranchisesData
        : Array.isArray(superFranchisesData?.data)
        ? superFranchisesData.data
        : []
    ).map((sf) => ({ ...sf, userType: 'Super Franchise' }));

    const franchisesList = (
      Array.isArray(franchisesData)
        ? franchisesData
        : Array.isArray(franchisesData?.data)
        ? franchisesData.data
        : []
    ).map((f) => ({ ...f, userType: 'Franchise' }));

    const merchantsList = (
      Array.isArray(merchantsData)
        ? merchantsData
        : Array.isArray(merchantsData?.data)
        ? merchantsData.data
        : []
    ).map((m) => ({ ...m, userType: 'Merchant' }));

    // Deduplicate: if an ID already appeared, skip the duplicate
    const seen = new Set();
    return [...superFranchisesList, ...franchisesList, ...merchantsList].filter((u) => {
      if (seen.has(u.id)) return false;
      seen.add(u.id);
      return true;
    });
  }, [isSuperAdmin, adminUsersData, superFranchisesData, franchisesData, merchantsData]);

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

  const targetUserOptions = useMemo(() => {
    return allTargetUsers.map((u) => ({
      value: String(u.id),
      label: (u.name != null) ? `${u.name || u.username} (${u.userType})` : '',
      user: u,
    }));
  }, [allTargetUsers]);

  // ── Base / Company Payout Charges Slabs Query ────────────────────────────
  const { data: globalChargesData, isLoading: globalLoading } = useQuery({
    queryKey: ['base_company_payout_charges', isSuperAdmin],
    queryFn: () => (isSuperAdmin ? getUserPayoutChargesByUser('me') : getCompanyPayoutCharges()),
  });

  const globalRules = useMemo(() => {
    if (!globalChargesData) return [];
    if (Array.isArray(globalChargesData)) return globalChargesData;
    return Array.isArray(globalChargesData.data) ? globalChargesData.data : [];
  }, [globalChargesData]);

  // ── User Payout Charges Query (returns franchise_id, super_franchise_id, user_id payouts) ──
  const { data: userChargesData, isLoading: userLoading } = useQuery({
    queryKey: ['user_payout_charges', selectedUserId],
    queryFn: () => getUserPayoutChargesByUser(selectedUserId || 'me'),
  });

  const userRules = useMemo(() => {
    if (!userChargesData) return [];
    if (Array.isArray(userChargesData)) return userChargesData;
    return Array.isArray(userChargesData.data) ? userChargesData.data : [];
  }, [userChargesData]);

  // ── Global Slab Form State & Mutations ────────────────────────────────────
  const [globalForm, setGlobalForm] = useState({
    from_amount: '',
    to_amount: '',
    rate: '',
    rate_type: 'percentage',
    is_active: true,
    description: '',
  });
  const [globalEditingId, setGlobalEditingId] = useState(null);

  const createGlobalMutation = useMutation({
    mutationFn: (payload) => createUserPayoutCharge({
      ...payload,
      user_id: selectedUserId || userForm.user_id || undefined,
    }),
    onSuccess: () => {
      toast.success('Payout charge rule created successfully!');
      queryClient.invalidateQueries(['base_company_payout_charges']);
      queryClient.invalidateQueries(['user_payout_charges']);
      setGlobalForm({ from_amount: '', to_amount: '', rate: '', rate_type: 'percentage', is_active: true, description: '' });
      setShowGlobalForm(false);
    },
    onError: (err) => toast.error(err.message || 'Failed to create payout charge rule'),
  });

  const updateGlobalMutation = useMutation({
    mutationFn: ({ id, payload }) => updateUserPayoutCharge(id, payload),
    onSuccess: () => {
      toast.success('Payout charge rule updated successfully!');
      queryClient.invalidateQueries(['base_company_payout_charges']);
      queryClient.invalidateQueries(['user_payout_charges']);
      setGlobalEditingId(null);
      setGlobalForm({ from_amount: '', to_amount: '', rate: '', rate_type: 'percentage', is_active: true, description: '' });
      setShowGlobalForm(false);
    },
    onError: (err) => toast.error(err.message || 'Failed to update payout charge rule'),
  });

  const deleteGlobalMutation = useMutation({
    mutationFn: deleteUserPayoutCharge,
    onSuccess: () => {
      toast.success('Payout charge rule deleted');
      queryClient.invalidateQueries(['base_company_payout_charges']);
      queryClient.invalidateQueries(['user_payout_charges']);
    },
    onError: (err) => toast.error(err.message || 'Failed to delete rule'),
  });

  const handleGlobalSubmit = (e) => {
    e.preventDefault();
    const payload = {
      from_amount: parseFloat(globalForm.from_amount),
      to_amount: parseFloat(globalForm.to_amount),
      rate: parseFloat(globalForm.rate),
      rate_type: globalForm.rate_type,
      is_active: globalForm.is_active,
      description: globalForm.description || null,
    };
    if (globalEditingId) {
      updateGlobalMutation.mutate({ id: globalEditingId, payload });
    } else {
      createGlobalMutation.mutate(payload);
    }
  };

  // ── User Override Slab Form State & Mutations ──────────────────────────────
  const [userForm, setUserForm] = useState({
    user_id: '',
    from_amount: '',
    to_amount: '',
    rate: '',
    rate_type: 'percentage',
    is_active: true,
    description: '',
  });
  const [userEditingId, setUserEditingId] = useState(null);

  const createUserMutation = useMutation({
    mutationFn: createUserPayoutCharge,
    onSuccess: () => {
      toast.success('User payout charge override created successfully!');
      queryClient.invalidateQueries(['user_payout_charges']);
      setUserForm({
        user_id: selectedUserId || '',
        from_amount: '',
        to_amount: '',
        rate: '',
        rate_type: 'percentage',
        is_active: true,
        description: '',
      });
      setShowUserForm(false);
    },
    onError: (err) => toast.error(err.message || 'Failed to create user payout charge override'),
  });

  const updateUserMutation = useMutation({
    mutationFn: ({ id, payload }) => updateUserPayoutCharge(id, payload),
    onSuccess: () => {
      toast.success('User payout charge override updated successfully!');
      queryClient.invalidateQueries(['user_payout_charges']);
      setUserEditingId(null);
      setUserForm({
        user_id: selectedUserId || '',
        from_amount: '',
        to_amount: '',
        rate: '',
        rate_type: 'percentage',
        is_active: true,
        description: '',
      });
      setShowUserForm(false);
    },
    onError: (err) => toast.error(err.message || 'Failed to update user payout charge override'),
  });

  const deleteUserMutation = useMutation({
    mutationFn: deleteUserPayoutCharge,
    onSuccess: () => {
      toast.success('User payout charge override deleted');
      queryClient.invalidateQueries(['user_payout_charges']);
    },
    onError: (err) => toast.error(err.message || 'Failed to delete rule'),
  });

  const handleUserSubmit = (e) => {
    e.preventDefault();
    const targetUserId = userForm.user_id || selectedUserId;
    if (!targetUserId) {
      toast.error('Please select a user first');
      return;
    }
    const payload = {
      user_id: Number(targetUserId),
      from_amount: parseFloat(userForm.from_amount),
      to_amount: parseFloat(userForm.to_amount),
      rate: parseFloat(userForm.rate),
      rate_type: userForm.rate_type,
      is_active: userForm.is_active,
      description: userForm.description || null,
    };
    if (userEditingId) {
      updateUserMutation.mutate({ id: userEditingId, payload });
    } else {
      createUserMutation.mutate(payload);
    }
  };

  const selectedUserObj = useMemo(() => {
    const targetId = selectedUserId || userForm.user_id;
    if (!targetId) return null;
    return allTargetUsers.find((u) => String(u.id) === String(targetId));
  }, [allTargetUsers, selectedUserId, userForm.user_id]);

  const selectUser = (u) => {
    setSelectedUserId(String(u.id));
    setUserForm((prev) => ({ ...prev, user_id: String(u.id) }));
    setUserEditingId(null);
  };

  const clearSelectedUser = () => {
    setSelectedUserId('');
    setUserForm((prev) => ({ ...prev, user_id: '' }));
    setUserEditingId(null);
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setActiveSearchTerm(searchInputVal);
  };

  const openNewUserForm = () => {
    setUserEditingId(null);
    setUserForm({
      user_id: selectedUserId || '',
      from_amount: '',
      to_amount: '',
      rate: '',
      rate_type: 'percentage',
      is_active: true,
      description: '',
    });
    setShowUserForm(true);
  };

  const openNewGlobalForm = () => {
    setGlobalEditingId(null);
    setGlobalForm({
      from_amount: '',
      to_amount: '',
      rate: '',
      rate_type: 'percentage',
      is_active: true,
      description: '',
    });
    setShowGlobalForm(true);
  };

  return (
    <div className="space-y-6">
      {/* Sub-Header & Sub-Tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 md:p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b">
          <div>
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Layers className="w-5 h-5 text-[#00D3CD]" />
              Payout Rate Settings
            </h2>
            <p className="text-xs md:text-sm text-gray-500 mt-1">
              Configure per-user custom payout charge overrides (Guard 1) or global default slab rules (Guard 2).
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
              User Override Rates
            </button>
            <button
              onClick={() => setActiveSubTab('global_default')}
              className={`px-4 py-2 text-xs md:text-sm font-semibold rounded-md transition ${
                activeSubTab === 'global_default'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Company Default Slabs
            </button>
          </div>
        </div>

        {/* ── USER OVERRIDE RATES TAB ───────────────────────────────────────── */}
        {activeSubTab === 'user_override' && (
          <div className="pt-6 space-y-6">
            {/* Search Users Bar + (+) Add Rule Button */}
            <div className="bg-white rounded-xl border border-gray-200 p-4 md:p-6 shadow-sm">
              <form onSubmit={handleSearchSubmit} className="space-y-4">
                <label className="block text-sm font-semibold text-gray-800">
                  Search Users
                </label>

                <div className="flex flex-col sm:flex-row gap-2 max-w-2xl items-center">
                  <select
                    value={userRoleFilter}
                    onChange={(e) => setUserRoleFilter(e.target.value)}
                    className="w-full sm:w-44 rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-[#00D3CD] focus:outline-none focus:ring-1 focus:ring-[#00D3CD]"
                  >
                    <option value="ALL">All Roles</option>
                    {isSuperAdmin ? (
                      <option value="Admin">Admin</option>
                    ) : (
                      <>
                        <option value="Super Franchise">Super Franchise</option>
                        <option value="Franchise">Franchise</option>
                        <option value="Merchant">Merchant</option>
                      </>
                    )}
                  </select>

                  <div className="relative flex-1 w-full">
                    <input
                      type="text"
                      value={searchInputVal}
                      onChange={(e) => {
                        setSearchInputVal(e.target.value);
                        setActiveSearchTerm(e.target.value);
                      }}
                      placeholder="Name, email, username or mobile..."
                      autoComplete="off"
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-[#00D3CD] focus:outline-none focus:ring-1 focus:ring-[#00D3CD]"
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

                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <button
                      type="submit"
                      className="rounded-md bg-[#00D3CD] hover:bg-[#00b8b3] px-5 py-2 text-sm font-semibold text-white transition shadow-sm"
                    >
                      Search
                    </button>

                    {/* [+] Add Rule Modal Trigger Button */}
                    <button
                      type="button"
                      onClick={openNewUserForm}
                      title="Add New User Payout Charge Override Rule"
                      className="rounded-md bg-[#00D3CD] hover:bg-[#00b8b3] px-4 py-2 text-sm font-semibold text-white transition shadow-sm flex items-center gap-1.5"
                    >
                      <Plus className="w-4 h-4 font-bold" /> Add Rule
                    </button>
                  </div>
                </div>

              </form>

               {/* Selected User Banner */}
              {selectedUserObj ? (
                <div className="mt-4 p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-emerald-950 text-sm md:text-base">
                          {selectedUserObj.name || selectedUserObj.username}
                        </span>
                        <span className="px-2 py-0.5 text-xs font-semibold rounded bg-emerald-100 text-emerald-800">
                          {selectedUserObj.userType}
                        </span>
                      </div>
                      <p className="text-xs text-emerald-800 mt-0.5">
                        {selectedUserObj.username ? selectedUserObj.username : `ID: #${selectedUserObj.id}`} | {selectedUserObj.email || 'N/A'} | {selectedUserObj.phone || selectedUserObj.mobile || 'N/A'}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={clearSelectedUser}
                    className="text-xs px-3 py-1.5 bg-white border border-emerald-300 text-emerald-800 font-semibold rounded-lg hover:bg-emerald-100 shadow-sm"
                  >
                    Change User
                  </button>
                </div>
              ) : (
                activeSearchTerm && (
                  <div className="mt-4 border rounded-xl divide-y max-h-60 overflow-y-auto bg-gray-50">
                    {filteredTargetUsers.length === 0 ? (
                      <p className="p-4 text-sm text-gray-500 text-center">No users found matching "{activeSearchTerm}".</p>
                    ) : (
                      filteredTargetUsers.map((u) => (
                        <div
                          key={`${u.userType}-${u.id}`}
                          onClick={() => selectUser(u)}
                          className="p-3 hover:bg-blue-50 cursor-pointer flex items-center justify-between transition"
                        >
                          <div className="flex items-center gap-2">
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="font-semibold text-gray-900 text-sm">{u.name || u.username}</span>
                                <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-blue-100 text-blue-800">
                                  {u.userType}
                                </span>
                              </div>
                              <span className="text-xs text-gray-500 block">
                                {u.username ? u.username : `ID: #${u.id}`} | {u.email || u.phone || u.mobile || 'No contact info'}
                              </span>
                            </div>
                          </div>
                          <span className="text-xs font-bold text-[#00D3CD] hover:underline">Select &rarr;</span>
                        </div>
                      ))
                    )}
                  </div>
                )
              )}
            </div>

            {/* ── MODAL POPUP: ADD / EDIT USER OVERRIDE RULE ─────────────────── */}
            {showUserForm && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto animate-fadeIn">
                <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-2xl w-full max-w-2xl relative my-8">
                  <div className="flex items-center justify-between pb-4 border-b mb-4">
                    <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                      <Plus className="w-5 h-5 text-[#00D3CD]" />
                      {userEditingId ? 'Edit User Payout Charge Override' : 'Add New User Payout Charge Override'}
                    </h3>
                    <button
                      type="button"
                      onClick={() => setShowUserForm(false)}
                      className="text-gray-400 hover:text-gray-600 bg-gray-100 hover:bg-gray-200 p-1.5 rounded-full transition"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <form onSubmit={handleUserSubmit} className="space-y-4">
                    {/* Target User Column / Selector */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs font-semibold text-gray-700">
                          Target User *
                        </label>
                        {selectedUserObj && (
                          <span className="text-[11px] font-medium text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                            Role: {selectedUserObj.userType}
                          </span>
                        )}
                      </div>
                      <Select
                        options={targetUserOptions}
                        value={
                          targetUserOptions.find(
                            (opt) => String(opt.value) === String(userForm.user_id || selectedUserId)
                          ) || null
                        }
                        onChange={(selected) => {
                          const newUserId = selected ? String(selected.value) : '';
                          setUserForm((prev) => ({ ...prev, user_id: newUserId }));
                          if (newUserId) {
                            setSelectedUserId(newUserId);
                          }
                        }}
                        placeholder={
                          isSuperAdmin
                            ? "Search or select Admin user..."
                            : "Search or select user (Super Franchise, Franchise, Merchant)..."
                        }
                        isClearable
                        isSearchable
                        menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
                        styles={{ menuPortal: (base) => ({ ...base, zIndex: 9999 }) }}
                        className="text-sm"
                        classNamePrefix="select"
                        noOptionsMessage={() => "No matching users found"}
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">From Amount (₹) *</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={userForm.from_amount}
                          onChange={(e) => setUserForm({ ...userForm, from_amount: e.target.value })}
                          placeholder="0.00"
                          className="w-full px-3.5 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-[#00D3CD]"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">To Amount (₹) *</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={userForm.to_amount}
                          onChange={(e) => setUserForm({ ...userForm, to_amount: e.target.value })}
                          placeholder="99999.00"
                          className="w-full px-3.5 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-[#00D3CD]"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">Rate Charge *</label>
                        <input
                          type="number"
                          step="0.0001"
                          min="0"
                          value={userForm.rate}
                          onChange={(e) => setUserForm({ ...userForm, rate: e.target.value })}
                          placeholder="15.00"
                          className="w-full px-3.5 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-[#00D3CD]"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">Rate Type *</label>
                        <select
                          value={userForm.rate_type}
                          onChange={(e) => setUserForm({ ...userForm, rate_type: e.target.value })}
                          className="w-full px-3.5 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-[#00D3CD]"
                        >
                          <option value="percentage">Percentage (%)</option>
                          <option value="flat">Flat Amount (₹)</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Description / Remarks</label>
                      <input
                        type="text"
                        value={userForm.description}
                        onChange={(e) => setUserForm({ ...userForm, description: e.target.value })}
                        placeholder="e.g. Special payout rate for user"
                        className="w-full px-3.5 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-[#00D3CD]"
                      />
                    </div>

                    <div className="flex items-center gap-2 pt-2">
                      <input
                        type="checkbox"
                        id="user-active-check-modal"
                        checked={userForm.is_active}
                        onChange={(e) => setUserForm({ ...userForm, is_active: e.target.checked })}
                        className="h-4 w-4 text-[#00D3CD] rounded border-gray-300 focus:ring-[#00D3CD]"
                      />
                      <label htmlFor="user-active-check-modal" className="text-xs font-semibold text-gray-800">
                        Rule Active
                      </label>
                    </div>

                    <div className="flex items-center justify-end gap-3 pt-4 border-t">
                      <button
                        type="button"
                        onClick={() => setShowUserForm(false)}
                        className="px-5 py-2.5 bg-gray-200 hover:bg-gray-300 text-gray-800 text-sm font-semibold rounded-lg transition"
                      >
                        Cancel
                      </button>

                      <button
                        type="submit"
                        disabled={createUserMutation.isPending || updateUserMutation.isPending || (!userForm.user_id && !selectedUserId)}
                        className="px-6 py-2.5 bg-[#00D3CD] hover:bg-[#00b8b3] text-white font-semibold text-sm rounded-lg shadow-sm transition disabled:opacity-50 flex items-center gap-2"
                      >
                        {createUserMutation.isPending || updateUserMutation.isPending ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : userEditingId ? (
                          'Update Override Rule'
                        ) : (
                          'Save User Override Rule'
                        )}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* User Override Rules Table */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 md:p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-base font-bold text-gray-900">
                  {selectedUserObj
                    ? `Override Rules for ${selectedUserObj.name || selectedUserObj.username}`
                    : 'All User Payout Charge Overrides'}
                </h3>
                <span className="text-xs text-gray-500 font-medium">Total: {userRules.length} rules</span>
              </div>

              {userLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin text-[#00D3CD]" />
                </div>
              ) : userRules.length === 0 ? (
                <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-xl">
                  <p className="text-sm">No user-specific payout charge overrides configured yet.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm border-collapse">
                    <thead>
                      <tr className="border-b bg-gray-50 text-gray-700 text-xs font-semibold uppercase">
                        <th className="p-3">User</th>
                        <th className="p-3">Amount Range (₹)</th>
                        <th className="p-3">Rate</th>
                        <th className="p-3">Type</th>
                        <th className="p-3">Status</th>
                        <th className="p-3">Description</th>
                        <th className="p-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {userRules.map((rule) => {
                        const matchedUser = allTargetUsers.find((u) => Number(u.id) === Number(rule.user_id));
                        const rawRole = matchedUser?.userType || matchedUser?.role || rule.user?.role || '';
                        const normalizedRowRole = String(rawRole).trim().toLowerCase().replace(/[-_]/g, '');

                        const isRowSuperAdmin = normalizedRowRole === 'superadmin' || normalizedRowRole === 'super_admin';
                        const isRowAdmin =
                          normalizedRowRole === 'admin' ||
                          matchedUser?.userType === 'Admin' ||
                          rule.user?.role === 'admin' ||
                          (isSuperAdmin && allTargetUsers.some((u) => Number(u.id) === Number(rule.user_id)));

                        const roleLabel = isRowSuperAdmin
                          ? 'Super Admin'
                          : isRowAdmin
                          ? 'Admin'
                          : matchedUser?.userType || rule.user?.role || 'User';

                        const isAllocatedBySuperAdmin =
                          !isSuperAdmin && ((currentUserId && Number(rule.user_id) === Number(currentUserId)) || isRowAdmin);

                        // Don't show edit and delete button if the role is super admin.
                        // Only if the row is admin (for super admin) or downline (for admin), show edit and delete button.
                        const canEditDelete = isSuperAdmin
                          ? isRowAdmin && !isRowSuperAdmin
                          : !isRowSuperAdmin && !isAllocatedBySuperAdmin;

                        return (
                          <tr key={rule.id} className="hover:bg-gray-50/50">
                            <td className="p-3 font-medium text-gray-900">
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">
                                    {matchedUser?.name || rule.user?.name || matchedUser?.username || rule.user?.username || (isSuperAdmin ? "User Under Admin" : 'User')}
                                  </span>
                                  {roleLabel && (
                                    <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded ${
                                      isRowSuperAdmin
                                        ? 'bg-purple-100 text-purple-800'
                                        : isRowAdmin
                                        ? 'bg-blue-100 text-blue-800'
                                        : 'bg-emerald-100 text-emerald-800'
                                    }`}>
                                      {roleLabel}
                                    </span>
                                  )}
                                  {isAllocatedBySuperAdmin && (
                                    <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-purple-100 text-purple-800">
                                      Super Admin Allocated
                                    </span>
                                  )}
                                  {!isAllocatedBySuperAdmin && !isRowSuperAdmin && rule.payout_type && (
                                    <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded ${
                                      rule.payout_type === 'user_id'
                                        ? 'bg-emerald-100 text-emerald-800'
                                        : rule.payout_type === 'franchise_id'
                                        ? 'bg-blue-100 text-blue-800'
                                        : rule.payout_type === 'super_franchise_id'
                                        ? 'bg-purple-100 text-purple-800'
                                        : 'bg-amber-100 text-amber-800'
                                    }`}>
                                      {rule.payout_type === 'user_id'
                                        ? 'User Override'
                                        : rule.payout_type === 'franchise_id'
                                        ? 'Franchise Payout'
                                        : rule.payout_type === 'super_franchise_id'
                                        ? 'Super Franchise Payout'
                                        : 'Company Base'}
                                    </span>
                                  )}
                                </div>
                                <span className="block text-xs text-gray-400">
                                  {matchedUser?.username || rule.user?.username || `ID: ${rule.user_id}`}
                                </span>
                              </div>
                            </td>
                            <td className="p-3 font-semibold text-gray-800">
                              ₹{parseFloat(rule.from_amount).toFixed(2)} — ₹{parseFloat(rule.to_amount).toFixed(2)}
                            </td>
                            <td className="p-3 font-bold text-blue-600">
                              {rule.rate_type === 'flat' ? `₹${rule.rate}` : `${rule.rate}%`}
                            </td>
                            <td className="p-3 capitalize text-xs font-semibold text-gray-600">{rule.rate_type}</td>
                            <td className="p-3">
                              <span
                                className={`px-2.5 py-1 text-xs font-semibold rounded-full ${
                                  rule.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                }`}
                              >
                                {rule.is_active ? 'Active' : 'Disabled'}
                              </span>
                            </td>
                            <td className="p-3 text-xs text-gray-500">{rule.description || '—'}</td>
                            <td className="p-3 text-right space-x-2">
                              {canEditDelete ? (
                                <>
                                  <button
                                    onClick={() => {
                                      setUserEditingId(rule.id);
                                      setUserForm({
                                        user_id: String(rule.user_id),
                                        from_amount: String(rule.from_amount),
                                        to_amount: String(rule.to_amount),
                                        rate: String(rule.rate),
                                        rate_type: rule.rate_type,
                                        is_active: rule.is_active,
                                        description: rule.description || '',
                                      });
                                      if (matchedUser) {
                                        setSelectedUserId(String(matchedUser.id));
                                      }
                                      setShowUserForm(true); // Open modal popup on edit
                                    }}
                                    className="text-xs px-3 py-1.5 bg-blue-50 text-blue-700 font-semibold rounded hover:bg-blue-100"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    onClick={() => {
                                      if (window.confirm('Are you sure you want to delete this user override rule?')) {
                                        deleteUserMutation.mutate(rule.id);
                                      }
                                    }}
                                    className="text-xs px-3 py-1.5 bg-red-50 text-red-700 font-semibold rounded hover:bg-red-100"
                                  >
                                    Delete
                                  </button>
                                </>
                              ) : isAllocatedBySuperAdmin ? (
                                <span
                                  className="inline-flex items-center px-2.5 py-1 text-xs font-semibold rounded-md bg-gray-100 text-gray-500 border border-gray-200"
                                  title="This rate was allocated by Super Admin and cannot be edited or deleted"
                                >
                                  Allocated by Super Admin
                                </span>
                              ) : isRowSuperAdmin ? (
                                <span
                                  className="inline-flex items-center px-2.5 py-1 text-xs font-semibold rounded-md bg-gray-100 text-gray-500 border border-gray-200"
                                  title="Super Admin rate cannot be edited or deleted"
                                >
                                  Super Admin
                                </span>
                              ) : (
                                <span
                                  className="inline-flex items-center px-2.5 py-1 text-xs font-semibold rounded-md bg-gray-100 text-gray-500 border border-gray-200"
                                >
                                  Read-only
                                </span>
                              )}
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
        )}

        {/* ── GLOBAL DEFAULT SLABS TAB ──────────────────────────────────────── */}
        {activeSubTab === 'global_default' && (
          <div className="pt-6 space-y-6">
            {!isSuperAdmin && (
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl flex items-start gap-3">
                <div className="p-1 rounded-full bg-blue-100 text-blue-700 font-bold text-xs mt-0.5">ℹ</div>
                <div>
                  <h4 className="text-sm font-bold text-blue-900">Inherited Super Admin Payout Slabs (Read-Only)</h4>
                  <p className="text-xs text-blue-800 mt-0.5">
                    These are default global payout charge slabs set by the platform Super Admin. Admins cannot alter these global rules. To configure custom rates for your downstream users, use the <strong>User Override Rates</strong> tab.
                  </p>
                </div>
              </div>
            )}
            {/* Header with [+] Add Global Rule button */}
            <div className="flex justify-between items-center bg-white p-4 rounded-xl border">
              <h3 className="text-base font-bold text-gray-900">Global Default Payout Charge Slabs</h3>
              {isSuperAdmin && (
                <button
                  type="button"
                  onClick={openNewGlobalForm}
                  className="rounded-md bg-[#00D3CD] hover:bg-[#00b8b3] px-4 py-2 text-sm font-semibold text-white transition shadow-sm flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4 font-bold" /> Add Global Rule
                </button>
              )}
            </div>

            {/* ── MODAL POPUP: ADD / EDIT GLOBAL RULE ────────────────────────── */}
            {showGlobalForm && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto animate-fadeIn">
                <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-2xl w-full max-w-2xl relative my-8">
                  <div className="flex items-center justify-between pb-4 border-b mb-4">
                    <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                      <Plus className="w-5 h-5 text-[#00D3CD]" />
                      {globalEditingId ? 'Edit Global Payout Slab Rule' : 'Add New Global Payout Slab Rule'}
                    </h3>
                    <button
                      type="button"
                      onClick={() => setShowGlobalForm(false)}
                      className="text-gray-400 hover:text-gray-600 bg-gray-100 hover:bg-gray-200 p-1.5 rounded-full transition"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <form onSubmit={handleGlobalSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">From Amount (₹) *</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={globalForm.from_amount}
                          onChange={(e) => setGlobalForm({ ...globalForm, from_amount: e.target.value })}
                          placeholder="0.00"
                          className="w-full px-3.5 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-[#00D3CD]"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">To Amount (₹) *</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={globalForm.to_amount}
                          onChange={(e) => setGlobalForm({ ...globalForm, to_amount: e.target.value })}
                          placeholder="99999.00"
                          className="w-full px-3.5 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-[#00D3CD]"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">Rate Charge *</label>
                        <input
                          type="number"
                          step="0.0001"
                          min="0"
                          value={globalForm.rate}
                          onChange={(e) => setGlobalForm({ ...globalForm, rate: e.target.value })}
                          placeholder="15.00"
                          className="w-full px-3.5 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-[#00D3CD]"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">Rate Type *</label>
                        <select
                          value={globalForm.rate_type}
                          onChange={(e) => setGlobalForm({ ...globalForm, rate_type: e.target.value })}
                          className="w-full px-3.5 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-[#00D3CD]"
                        >
                          <option value="percentage">Percentage (%)</option>
                          <option value="flat">Flat Amount (₹)</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Description / Label</label>
                      <input
                        type="text"
                        value={globalForm.description}
                        onChange={(e) => setGlobalForm({ ...globalForm, description: e.target.value })}
                        placeholder="e.g. Standard 1.5% commission for mid payouts"
                        className="w-full px-3.5 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-[#00D3CD]"
                      />
                    </div>

                    <div className="flex items-center gap-2 pt-2">
                      <input
                        type="checkbox"
                        id="global-active-check-modal"
                        checked={globalForm.is_active}
                        onChange={(e) => setGlobalForm({ ...globalForm, is_active: e.target.checked })}
                        className="h-4 w-4 text-[#00D3CD] rounded border-gray-300 focus:ring-[#00D3CD]"
                      />
                      <label htmlFor="global-active-check-modal" className="text-xs font-semibold text-gray-800">
                        Rule Active
                      </label>
                    </div>

                    <div className="flex items-center justify-end gap-3 pt-4 border-t">
                      <button
                        type="button"
                        onClick={() => setShowGlobalForm(false)}
                        className="px-5 py-2.5 bg-gray-200 hover:bg-gray-300 text-gray-800 text-sm font-semibold rounded-lg transition"
                      >
                        Cancel
                      </button>

                      <button
                        type="submit"
                        disabled={createGlobalMutation.isPending || updateGlobalMutation.isPending}
                        className="px-6 py-2.5 bg-[#00D3CD] hover:bg-[#00b8b3] text-white font-semibold text-sm rounded-lg shadow-sm transition disabled:opacity-50 flex items-center gap-2"
                      >
                        {createGlobalMutation.isPending || updateGlobalMutation.isPending ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : globalEditingId ? (
                          'Update Global Rule'
                        ) : (
                          'Save Global Rule'
                        )}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* Global Slabs Table */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 md:p-6">
              {globalLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin text-[#00D3CD]" />
                </div>
              ) : globalRules.length === 0 ? (
                <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-xl">
                  <p className="text-sm">No global payout charge slabs configured.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm border-collapse">
                    <thead>
                      <tr className="border-b bg-gray-50 text-gray-700 text-xs font-semibold uppercase">
                        <th className="p-3">ID</th>
                        <th className="p-3">Amount Range (₹)</th>
                        <th className="p-3">Rate Charge</th>
                        <th className="p-3">Rate Type</th>
                        <th className="p-3">Status</th>
                        <th className="p-3">Description</th>
                        {isSuperAdmin && <th className="p-3 text-right">Actions</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {globalRules.map((rule) => (
                        <tr key={rule.id} className="hover:bg-gray-50/50">
                          <td className="p-3 font-semibold text-gray-500">#{rule.id}</td>
                          <td className="p-3 font-semibold text-gray-800">
                            ₹{parseFloat(rule.from_amount).toFixed(2)} — ₹{parseFloat(rule.to_amount).toFixed(2)}
                          </td>
                          <td className="p-3 font-bold text-blue-600">
                            {rule.rate_type === 'flat' ? `₹${rule.rate}` : `${rule.rate}%`}
                          </td>
                          <td className="p-3 capitalize text-xs font-semibold text-gray-600">{rule.rate_type}</td>
                          <td className="p-3">
                            <span
                              className={`px-2.5 py-1 text-xs font-semibold rounded-full ${
                                rule.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                              }`}
                            >
                              {rule.is_active ? 'Active' : 'Disabled'}
                            </span>
                          </td>
                          <td className="p-3 text-xs text-gray-500">{rule.description || '—'}</td>
                          {isSuperAdmin && (
                            <td className="p-3 text-right space-x-2">
                              <button
                                onClick={() => {
                                  setGlobalEditingId(rule.id);
                                  setGlobalForm({
                                    from_amount: String(rule.from_amount),
                                    to_amount: String(rule.to_amount),
                                    rate: String(rule.rate),
                                    rate_type: rule.rate_type,
                                    is_active: rule.is_active,
                                    description: rule.description || '',
                                  });
                                  setShowGlobalForm(true); // Open modal popup on Edit
                                }}
                                className="text-xs px-3 py-1.5 bg-blue-50 text-blue-700 font-semibold rounded hover:bg-blue-100"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => {
                                  if (window.confirm('Are you sure you want to delete this global rule?')) {
                                    deleteGlobalMutation.mutate(rule.id);
                                  }
                                }}
                                className="text-xs px-3 py-1.5 bg-red-50 text-red-700 font-semibold rounded hover:bg-red-100"
                              >
                                Delete
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PayoutRateSettings;
