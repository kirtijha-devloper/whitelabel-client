import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle, ArrowLeft, Loader2, X, Edit, Trash, Eye, EyeOff } from "lucide-react";
import { toast } from "react-toastify";
import { userDetail, promoteMerchantToFranchise, promoteUserToSuperFranchise, enableLedger, updatePassword } from "../api/authApi";
import { MerchantAllUsers } from "../api/FranchiseApi";
import { assignPosMachineToFranchise, getAllPosMachines } from "../api/posMachine";
import {
  createChargeSlab,
  getChargeTypes,
  getSlabsByCategory,
  ChargesSetByUserId,
} from "../api/chargeSet";
import DynamicForm from "../components/DynamicForm";
import Table from "../components/Table";
import Select from "react-select";
import { BASE_SITE_URL } from "../constants";
import { extractUsersArray, normalizeUserRole, maskEmailForUser } from "../utils/userAccess";
import { hasPermission, isAdminUser } from "../utils/accessControl";


function UserDetails({ currentUser }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const normalizedCurrentUserRole = normalizeUserRole(currentUser?.role);
  const isFranchiseViewer = normalizedCurrentUserRole === "franchise";
  const currentUserId = Number(currentUser?.id);
  const viewedUserId = Number(id);
  const [showSuccess, setShowSuccess] = useState(false);
  const [editingPosId, setEditingPosId] = useState(null);
  const [activeModal, setActiveModal] = useState(null);
  const [passwordForm, setPasswordForm] = useState({
    newPassword: "",
    confirmPassword: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [posFormData, setPosFormData] = useState({
    mid_number: "",
    tid_number: "",
    device_serial_number: "",
    remarks: "",
  });
  const [slabForm, setSlabForm] = useState({
    charge_type_category: "",
    min_amount: "",
    max_amount: "",
    flat_fee: "",
    percent_fee: "",
    id: null,
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedMachines, setSelectedMachines] = useState([]);

  const {
    data: accessibleMerchantsResponse,
    isLoading: accessibleMerchantsLoading,
    error: accessibleMerchantsError,
  } = useQuery({
    queryKey: ["franchise-accessible-merchants", currentUserId],
    queryFn: () => MerchantAllUsers({ franchiseId: currentUserId, limit: 1000 }),
    enabled: isFranchiseViewer && Number.isFinite(currentUserId),
  });

  const accessibleMerchants = extractUsersArray(accessibleMerchantsResponse);
  const canViewOwnFranchiseProfile =
    isFranchiseViewer &&
    Number.isFinite(currentUserId) &&
    Number.isFinite(viewedUserId) &&
    currentUserId === viewedUserId;
  const canViewFranchiseMerchant = accessibleMerchants.some(
    (merchant) => Number(merchant?.id) === viewedUserId
  );
  const waitingForFranchiseAccess =
    isFranchiseViewer && !canViewOwnFranchiseProfile && accessibleMerchantsLoading;
  const canAccessRequestedUser =
    !isFranchiseViewer || canViewOwnFranchiseProfile || canViewFranchiseMerchant;

  const isAdmin = isAdminUser(currentUser);
  const canStartWallet = isAdmin || hasPermission(currentUser, "ledger.manage");
  const [promoteError, setPromoteError] = useState("");
  const [promoteSuccess, setPromoteSuccess] = useState("");
  const [startLedger, setStartLedger] = useState(null);
  const [ledgerEnabling, setLedgerEnabling] = useState(false);

  // Fetch user details
  const { data: userData, isLoading, error } = useQuery({
    queryKey: ["user", id],
    queryFn: () => userDetail(id),
    enabled: Number.isFinite(viewedUserId) && canAccessRequestedUser,
  });

  useEffect(() => {
    const user = userData?.user || {};
    if (typeof user.start_ledger === 'boolean') {
      setStartLedger(user.start_ledger);
    }
  }, [userData]);

  // Fetch charge types
  const { data: chargeTypes = [], isLoading: typesLoading } = useQuery({
    queryKey: ["chargeTypes"],
    queryFn: getChargeTypes,
  });

  // Fetch slabs for selected category in modal
  const selectedCategory = activeModal?.startsWith("create-slab-")
    ? activeModal.split("-")[2]
    : "";
  const { data: slabs = [], isLoading: slabsLoading } = useQuery({
    queryKey: ["chargeSlabs", selectedCategory],
    queryFn: () => getSlabsByCategory({ charge_type_category: selectedCategory }),
    enabled: !!selectedCategory,
  });

  // Fetch available POS machines
  const {
    data: posMachines = [],
    isLoading: posMachinesLoading,
    error: posMachinesError,
  } = useQuery({
    queryKey: ["posMachines", searchTerm],
    queryFn: () => getAllPosMachines(searchTerm),
    staleTime: 1000 * 60 * 5,
    enabled: activeModal === "assignPos",
    select: (res) => (Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : []),
  });

  // Mutation for updating POS machine
  const updatePosMutation = useMutation({
    mutationFn: assignPosMachineToFranchise,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user", id] });
      setShowSuccess(true);
      setEditingPosId(null);
      setTimeout(() => setShowSuccess(false), 3000);
    },
  });

  // Mutation for assigning POS machine
  const assignPosMutation = useMutation({
    mutationFn: ({ posMachineIds, userId }) =>
      assignPosMachineToFranchise(posMachineIds, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user", id] });
      queryClient.invalidateQueries({ queryKey: ["posMachines"] });
      setShowSuccess(true);
      setActiveModal(null);
      setSelectedMachines([]);
      setSearchTerm("");
      setTimeout(() => setShowSuccess(false), 3000);
    },
  });

  // Mutation for creating/assigning charge slab
  const assignSlabMutation = useMutation({
    mutationFn: createChargeSlab,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user", id] });
      queryClient.invalidateQueries({ queryKey: ["chargeSlabs"] });
      setShowSuccess(true);
      setActiveModal(null);
      setTimeout(() => setShowSuccess(false), 3000);
    },
  });

  const handlePosSubmit = (e, posId) => {
    e.preventDefault();
    updatePosMutation.mutate({ id: posId, ...posFormData });
  };

  const handleCancelEdit = () => {
    setEditingPosId(null);
    setPosFormData({
      mid_number: "",
      tid_number: "",
      device_serial_number: "",
      remarks: "",
    });
  };

  const openModal = (type, data = {}) => {
    setActiveModal(type);
    if (type === "chargeSlabs" && data) {
      setSlabForm({
        charge_type_category: data.charge_type_category || "",
        min_amount: data.min_amount || "",
        max_amount: data.max_amount || "",
        flat_fee: data.flat_fee || "",
        percent_fee: data.percent_fee || "",
        id: data.id || null,
      });
    }
  };

  const closeModal = () => {
    setActiveModal(null);
    setSlabForm({
      charge_type_category: "",
      min_amount: "",
      max_amount: "",
      flat_fee: "",
      percent_fee: "",
      id: null,
    });
    setSelectedMachines([]);
    setSearchTerm("");
  };

  const handleAssignSlab = (slab) => {
    assignSlabMutation.mutate({
      ...slab,
      user_id: id,
    });
  };

  const handleEnableLedger = async () => {
    setLedgerEnabling(true);
    try {
      await enableLedger(id);
      setStartLedger(true);
      toast.success('Ledger tracking enabled for this user.');
    } catch (err) {
      toast.error(err?.message || 'Failed to enable ledger tracking.');
    } finally {
      setLedgerEnabling(false);
    }
  };

  const promoteToFranchiseMutation = useMutation({
    mutationFn: () => promoteMerchantToFranchise(id),
    onSuccess: (response) => {
      setPromoteSuccess(response?.message || "User promoted to franchise successfully.");
      setPromoteError("");
      queryClient.invalidateQueries({ queryKey: ["user", id] });
      setTimeout(() => setPromoteSuccess(""), 5000);
    },
    onError: (err) => {
      setPromoteError(err?.message || "Failed to promote merchant to franchise.");
      setPromoteSuccess("");
    },
  });

  const promoteToSuperFranchiseMutation = useMutation({
    mutationFn: () => promoteUserToSuperFranchise(id),
    onSuccess: (response) => {
      setPromoteSuccess(response?.message || "User promoted to Super Franchise successfully.");
      setPromoteError("");
      queryClient.invalidateQueries({ queryKey: ["user", id] });
      setTimeout(() => setPromoteSuccess(""), 5000);
    },
    onError: (err) => {
      setPromoteError(err?.message || "Failed to promote user to Super Franchise.");
      setPromoteSuccess("");
    },
  });

  const handleAssignPos = () => {
    if (selectedMachines.length === 0) {
      alert("Please select at least one POS machine");
      return;
    }
    // Keep backend payload on POS machine id while showing serial number in UI.
    const posMachineIds = selectedMachines.map((machine) => machine.posMachineId ?? machine.value);
    assignPosMutation.mutate({ posMachineIds, userId: id });
  };

  const updatePasswordMutation = useMutation({
    mutationFn: ({ id, newPassword }) => updatePassword({ id, newPassword }),
    onSuccess: (response) => {
      toast.success(response?.message || 'Password updated successfully.');
      setPasswordForm({ newPassword: '', confirmPassword: '' });
      setActiveModal(null);
      queryClient.invalidateQueries({ queryKey: ["user", id] });
    },
    onError: (error) => {
      toast.error(error?.message || 'Failed to update password.');
    },
  });

  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswordForm((prev) => ({ ...prev, [name]: value }));
  };

  const handlePasswordSubmit = (e) => {
    e.preventDefault();
    const newPassword = passwordForm.newPassword.trim();
    const confirmPassword = passwordForm.confirmPassword.trim();

    if (!newPassword) {
      toast.error('Please enter a new password.');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match.');
      return;
    }

    updatePasswordMutation.mutate({ id: viewedUserId, newPassword });
  };

  const handleSearchChange = (inputValue) => {
    setSearchTerm(inputValue);
  };

  const handleSelectChange = (selected) => {
    setSelectedMachines(selected || []);
  };

  const selectOptions = posMachines
    .filter((machine) => machine.assigned_to === null)
    .map((machine) => ({
      value: machine.id ?? machine.tid_number,
      posMachineId: machine.id ?? machine.tid_number,
      tidNumber: machine.tid_number,
      serialNumber: machine.device_serial_number,
      label: `${machine.status} (Serial No.: ${machine.device_serial_number || machine.tid_number || "N/A"})`,
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

  if (!Number.isFinite(viewedUserId)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="bg-red-50 p-4 rounded-lg text-red-600">
          Invalid user id.
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="flex items-center gap-2 text-gray-600">
          <Loader2 className="animate-spin h-8 w-8" />
          <span>Loading user details...</span>
        </div>
      </div>
    );
  }

  if (waitingForFranchiseAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="flex items-center gap-2 text-gray-600">
          <Loader2 className="animate-spin h-8 w-8" />
          <span>Checking franchise access...</span>
        </div>
      </div>
    );
  }

  if (accessibleMerchantsError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="bg-red-50 p-4 rounded-lg text-red-600">
          {accessibleMerchantsError.message || "Failed to verify franchise access."}
        </div>
      </div>
    );
  }

  if (!canAccessRequestedUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
        <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-md">
          <h1 className="text-xl font-semibold text-gray-900">Access denied</h1>
          <p className="mt-2 text-sm text-gray-600">
            Franchise users can only open their own profile or merchants mapped to their franchise.
          </p>
          <button
            type="button"
            onClick={() => navigate("/franchise/list")}
            className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Back to Merchant List
          </button>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="bg-red-50 p-4 rounded-lg text-red-600">
          Error: {error.message}
        </div>
      </div>
    );
  }

  const slabColumns = [
    { header: "Min Amount", key: "min_amount", render: (val) => val || "0" },
    { header: "Max Amount", key: "max_amount", render: (val) => val || "Infinity" },
    { header: "Flat Fee", key: "flat_fee", render: (val) => (val ? `₹${val}` : "N/A") },
    { header: "Percent Fee", key: "percent_fee", render: (val) => (val ? `${val}%` : "N/A") },
    {
      header: "Actions",
      key: "id",
      render: (id, row) => (
        <div className="flex gap-2">
          <button
            onClick={() => openModal("chargeSlabs", row)}
            className="text-indigo-500 hover:text-indigo-700"
            title="Edit"
          >
            <Edit size={20} />
          </button>
          <button
            onClick={() => handleAssignSlab(row)}
            className="text-indigo-500 hover:text-indigo-700"
            title="Assign"
          >
            Assign
          </button>
        </div>
      ),
    },
  ];

  const chargeTypeColumns = [
    { header: "Name", key: "name", render: (val) => val || "N/A" },
    {
      header: "Category",
      key: "charge_type_category",
      render: (val, row) => row.charge_type_category || row.category || row.ChargeTypeCategory || "N/A",
    },
    {
      header: "Action",
      key: "id",
      render: (id, row) => (
        <button
          onClick={() => openModal(`create-slab-${row.charge_type_category || row.category}`)}
          className="px-3 py-1 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
        >
          Select
        </button>
      ),
    },
  ];

  const editSlabColumns = [
    { header: "Category", key: "charge_type_category", render: (val) => val || "N/A" },
    { header: "Min Amount", key: "min_amount", render: (val) => val || "0" },
    { header: "Max Amount", key: "max_amount", render: (val) => val || "Infinity" },
    { header: "Flat Fee", key: "flat_fee", render: (val) => (val ? `₹${val}` : "N/A") },
    { header: "Percent Fee", key: "percent_fee", render: (val) => (val ? `${val}%` : "N/A") },
    {
      header: "Action",
      key: "id",
      render: (id, row) => (
        <button
          onClick={() => assignSlabMutation.mutate({ ...row, user_id: id })}
          className="px-3 py-1 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
          disabled={assignSlabMutation.isPending}
        >
          {assignSlabMutation.isPending ? "Saving..." : "Confirm"}
        </button>
      ),
    },
  ];

  const user = userData?.user || {};

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-100 to-gray-200 p-4">
      <div className="w-full">
        {/* Header */}
        <div className="flex items-center justify-between mb-4 bg-white p-4 rounded-t-xl shadow-md">
          <div className="flex items-center justify-between w-full gap-4">
            <button
              onClick={() => navigate(-1)}
              className="p-2 rounded-full bg-indigo-100 text-indigo-600 hover:bg-indigo-200 transition"
            >
              <ArrowLeft size={24} />
            </button>
            <div>
              <h1 className="text-3xl font-bold text-primary">
                User Profile <span className="text-black text-lg font-medium">({user.role})</span>
              </h1>
            </div>
            <div className="flex flex-col gap-2">
              <p className="text-lg">
                <span className="font-semibold">Abheepay ID:</span> {user.abheepay_id}
              </p>
              {canStartWallet && startLedger !== null && (
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-semibold ${
                      startLedger
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {startLedger ? 'Ledger: Active' : 'Ledger: Inactive'}
                  </span>
                  {!startLedger && (
                    <button
                      type="button"
                      onClick={handleEnableLedger}
                      disabled={ledgerEnabling}
                      className="rounded-md bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700 disabled:opacity-50"
                    >
                      {ledgerEnabling ? 'Enabling...' : 'Start Wallet'}
                    </button>
                  )}
                </div>
              )}
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => setActiveModal('password')}
                  className="rounded-md bg-amber-600 px-4 py-2 text-sm text-white hover:bg-amber-700"
                >
                  Reset Password
                </button>
              )}
              {isAdmin && normalizeUserRole(user.role) === "merchant" && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="rounded-md bg-emerald-600 px-4 py-2 text-sm text-white hover:bg-emerald-700 disabled:bg-gray-400"
                    onClick={() => {
                      if (window.confirm("Promote this merchant to franchise?")) {
                        promoteToFranchiseMutation.mutate();
                      }
                    }}
                    disabled={promoteToFranchiseMutation.isLoading}
                  >
                    {promoteToFranchiseMutation.isLoading ? "Promoting..." : "Promote to Franchise"}
                  </button>
                </div>
              )}
              {isAdmin && ['merchant', 'franchise', 'franchaise'].includes(normalizeUserRole(user.role)) && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="rounded-md bg-purple-600 px-4 py-2 text-sm text-white hover:bg-purple-700 disabled:bg-gray-400"
                    onClick={() => {
                      if (window.confirm("Promote this user to Super Franchise?")) {
                        promoteToSuperFranchiseMutation.mutate();
                      }
                    }}
                    disabled={promoteToSuperFranchiseMutation.isLoading}
                  >
                    {promoteToSuperFranchiseMutation.isLoading ? "Promoting..." : "Promote to Super Franchise"}
                  </button>
                </div>
              )}
              {promoteSuccess && (
                <div className="rounded-md bg-emerald-50 px-3 py-2 text-emerald-700">{promoteSuccess}</div>
              )}
              {promoteError && (
                <div className="rounded-md bg-rose-50 px-3 py-2 text-rose-700">{promoteError}</div>
              )}
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Personal Info & Images */}
          <div className="lg:col-span-1 space-y-6">
            {/* Personal Info Card */}
            <Card title="Personal Information">
              <InfoField label="Name" value={user.name || user.full_name || "N/A"} />
              <InfoField label="Email" value={maskEmailForUser(user.email, currentUser) || "N/A"} />
              <InfoField
                label="Mobile"
                value={`${user.mobile_number_country_code || user.country_code || ""} ${user.mobile_number || user.mobileNumber || "N/A"}`}
              />
              <InfoField
                label="Company / Shop Name"
                value={user.company_or_shop_name || user.organization_name || user.organizationName || "N/A"}
              />
              <InfoField label="Role" value={user.role || "N/A"} />
              <InfoField label="Status" value={user.status || "N/A"} badge />
              <InfoField label="Approved" value={(user.is_approved || user.isApproved) ? "Yes" : "No"} badge />
              <InfoField label="POS Assigned" value={(user.is_pos_asigned || user.is_pos_assigned || user.isPosAssigned) ? "Yes" : "No"} badge />
            </Card>

            {/* Documents Card */}
            <Card title="Documents">
              <ImageField label="Aadhar" number={user?.aadhar_number} url={user?.aadhar_number_url} />
              <ImageField label="PAN" number={user?.pan_number} url={user?.pan_number_url} />
              <ImageField label="Bank Passbook" url={user?.bank_passbook_url} />
              <ImageField label="Shop Photo" url={user?.shop_with_photo_url} />
            </Card>
          </div>

          {/* Right Column: Additional Info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Address Card */}
            <Card title="Address Details">
              <InfoField label="Address Line 1" value={user.address1 || "N/A"} />
              <InfoField label="Address Line 2" value={user.address2 || "N/A"} />
              <InfoField label="City" value={user.city || "N/A"} />
              <InfoField label="District" value={user.district || "N/A"} />
              <InfoField label="State" value={user.state || "N/A"} />
              <InfoField label="Country" value={user.country || "N/A"} />
              <InfoField label="Pincode" value={user.pincode || "N/A"} />
            </Card>

            {/* Other Details Card */}
            <Card title="Additional Details">
              <InfoField label="Wallet Balance" value={user.wallet || user.wallet_balance || user.balance || "0.00"} />
              <InfoField label="Abheepay ID" value={user.abheepay_id || user.abheepayId || "N/A"} />
              <InfoField label="POS Settlement Mode" value={user.settlement_type || "T0"} />
              <InfoField label="T0 Daily Limit" value={user.t0_daily_limit !== null && user.t0_daily_limit !== undefined && user.t0_daily_limit !== "" ? `₹${user.t0_daily_limit}` : "Not Assigned (Routes to T1)"} />
              <InfoField label="Applied Settlement Rate" value={user.settlement_type === "T1" || user.t0_daily_limit === null || user.t0_daily_limit === undefined || user.t0_daily_limit === "" || Number(user.t0_daily_limit) === 0 ? "T1 Rate (Active - Limit 0/Unassigned)" : "T0 Rate (Active)"} />
              <InfoField
                label="Date of Birth"
                value={(user.dob || user.date_of_birth) ? new Date(user.dob || user.date_of_birth).toLocaleDateString() : "N/A"}
              />
              <InfoField label="Gender" value={user.gender || "N/A"} />
              <InfoField label="Organization" value={user.organization_name || user.organizationName || "N/A"} />
              <InfoField label="Settlement Type" value={user.settlement_type || user.settlementType || "N/A"} />
              <InfoField
                label="Created At"
                value={new Date(user.createdAt).toLocaleString() || "N/A"}
              />
              <InfoField
                label="Updated At"
                value={new Date(user.updatedAt).toLocaleString() || "N/A"}
              />
            </Card>

            {/* Pos Details Card */}
            <Card title="Pos Details">
              {userData?.pos_details && userData?.pos_details?.length > 0 ? (
                <div className="space-y-4">
                  {userData?.pos_details.map((pos) => (
                    <div key={pos.id} className="p-4 bg-gray-50 rounded-md">
                      {editingPosId === pos.id ? (
                        <form
                          onSubmit={(e) => handlePosSubmit(e, pos.id)}
                          className="space-y-4"
                        >
                          <div>
                            <label className="block text-sm font-medium text-gray-700">
                              MID Number
                            </label>
                            <input
                              type="text"
                              value={posFormData.mid_number}
                              onChange={(e) =>
                                setPosFormData({ ...posFormData, mid_number: e.target.value })
                              }
                              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                              required
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700">
                              TID Number
                            </label>
                            <input
                              type="text"
                              value={posFormData.tid_number}
                              onChange={(e) =>
                                setPosFormData({ ...posFormData, tid_number: e.target.value })
                              }
                              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                              required
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700">
                              Device Serial Number
                            </label>
                            <input
                              type="text"
                              value={posFormData.device_serial_number}
                              onChange={(e) =>
                                setPosFormData({
                                  ...posFormData,
                                  device_serial_number: e.target.value,
                                })
                              }
                              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                              required
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700">
                              Remarks
                            </label>
                            <textarea
                              value={posFormData.remarks}
                              onChange={(e) =>
                                setPosFormData({ ...posFormData, remarks: e.target.value })
                              }
                              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                            />
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="submit"
                              disabled={updatePosMutation.isPending}
                              className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
                            >
                              {updatePosMutation.isPending ? "Saving..." : "Save"}
                            </button>
                            <button
                              type="button"
                              onClick={handleCancelEdit}
                              className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
                            >
                              Cancel
                            </button>
                          </div>
                        </form>
                      ) : (
                        <div className="space-y-2">
                          <InfoField label="ID" value={pos.id} />
                          <InfoField label="MID Number" value={pos.mid_number} />
                          <InfoField label="TID Number" value={pos.tid_number} />
                          <InfoField label="Device Serial Number" value={pos.device_serial_number} />
                          <InfoField label="Remarks" value={pos.remarks || "N/A"} />
                          <InfoField label="Status" value={pos.status} badge />
                          <InfoField
                            label="Created At"
                            value={new Date(pos.createdAt).toLocaleString()}
                          />
                          <InfoField
                            label="Updated At"
                            value={new Date(pos.updatedAt).toLocaleString()}
                          />
                          {/* <button
                            onClick={() => handleEditPos(pos)}
                            className="mt-2 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
                          >
                            Edit
                          </button> */}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-gray-500">No pos machines assigned yet.</p>
                  {(normalizedCurrentUserRole === "admin" || normalizedCurrentUserRole === "franchise") && (
                    <button
                      onClick={() => openModal("assignPos")}
                      className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
                    >
                      Assign POS Machine
                    </button>
                  )}
                </div>
              )}
            </Card>

            {/* POS Rental Rates Card */}
            {userData?.charges?.rentals && userData.charges.rentals.length > 0 && (
              <Card title="POS Rental Rates">
                <div className="space-y-2">
                  {userData.charges.rentals.map((rental, index) => {
                    const rateSource = rental.franchaise_id
                      ? `Franchise-set rate (Franchise #${rental.franchaise_id})`
                      : "Platform rate (admin-defined)";
                    return (
                      <div key={rental.id ?? index} className="p-3 bg-gray-50 rounded-md">
                        <InfoField label="Amount" value={`₹${rental.amount}`} />
                        <InfoField label="Status" value={rental.status} badge />
                        <InfoField label="Applies To" value={rental.target_user_type} />
                        <InfoField label="Rate Source" value={rateSource} />
                      </div>
                    );
                  })}
                </div>
              </Card>
            )}

            {/* Charge Slabs Card */}
            <Card title="Charges">
              {userData?.pos_rental_slabs && userData?.pos_rental_slabs?.length > 0 ? (
                <div className="space-y-2">
                  {userData?.pos_rental_slabs.map((slab, index) => (
                    <div key={index} className="p-3 bg-gray-50 rounded-md">
                      <InfoField label="Category" value={slab.charge_type_category || slab.category || "—"} />
                      <InfoField label="Min Amount" value={slab.min_amount} />
                      <InfoField label="Max Amount" value={slab.max_amount} />
                      <InfoField label="Flat Fee" value={slab.flat_fee} />
                      <InfoField label="Percent Fee" value={slab.percent_fee} />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  <Link
                    to={`/${normalizedCurrentUserRole === "franchise" ? "franchise" : "admin"}/user-rate-settings/${id}`}
                    className="mt-2 text-indigo-600 hover:underline"
                  >
                    View Charges
                  </Link>
                </div>
              )}
            </Card>
          </div>
        </div>

        {/* Modal for Charge Slabs and POS Assignment */}
        {activeModal && (
          <div className="fixed inset-0 bg-gray-800 bg-opacity-75 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-xl shadow-lg w-full max-w-4xl">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-semibold text-gray-900">
                  {activeModal === "chargeSlabs"
                    ? "Edit Charge Slab"
                    : activeModal === "assignSlab"
                      ? "Select Charge Type"
                      : activeModal === "assignPos"
                        ? "Assign POS Machine"
                        : activeModal === "password"
                          ? "Reset Password"
                          : `Select Slab for ${selectedCategory}`}
                </h2>
                <button
                  onClick={closeModal}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X size={24} />
                </button>
              </div>

              {activeModal === "chargeSlabs" && (
                <div>
                  <Table
                    columns={editSlabColumns}
                    data={[slabForm]} // Display single slab for editing
                  />
                  <button
                    onClick={closeModal}
                    className="mt-4 px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
                  >
                    Cancel
                  </button>
                </div>
              )}

              {activeModal === "assignSlab" && (
                <div>
                  {typesLoading ? (
                    <Loader2 className="animate-spin h-8 w-8 text-indigo-600 mx-auto" />
                  ) : chargeTypes.length === 0 ? (
                    <p className="text-gray-500 text-center">No charge types available.</p>
                  ) : (
                    <Table columns={chargeTypeColumns} data={chargeTypes} />
                  )}
                  <button
                    onClick={closeModal}
                    className="mt-4 px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
                  >
                    Cancel
                  </button>
                </div>
              )}

              {activeModal?.startsWith("create-slab-") && (
                <div>
                  {slabsLoading ? (
                    <Loader2 className="animate-spin h-8 w-8 text-indigo-600 mx-auto" />
                  ) : slabs.length === 0 ? (
                    <p className="text-gray-500 text-center">No slabs found for this category.</p>
                  ) : (
                    <Table columns={slabColumns} data={slabs} />
                  )}
                  <button
                    onClick={closeModal}
                    className="mt-4 px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
                  >
                    Cancel
                  </button>
                </div>
              )}

              {activeModal === "password" && (
                <div>
                  <form onSubmit={handlePasswordSubmit} className="space-y-5">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        New Password
                      </label>
                      <div className="relative">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          name="newPassword"
                          value={passwordForm.newPassword}
                          onChange={handlePasswordChange}
                          className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                          placeholder="Enter new password"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((prev) => !prev)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
                          aria-label={showPassword ? 'Hide password' : 'Show password'}
                        >
                          {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Confirm Password
                      </label>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        name="confirmPassword"
                        value={passwordForm.confirmPassword}
                        onChange={handlePasswordChange}
                        className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                        placeholder="Confirm new password"
                        required
                      />
                      {passwordForm.confirmPassword && passwordForm.newPassword !== passwordForm.confirmPassword && (
                        <p className="mt-2 text-sm text-red-600">Passwords do not match.</p>
                      )}
                    </div>
                    <div className="flex justify-end gap-3">
                      <button
                        type="button"
                        onClick={() => setActiveModal(null)}
                        className="px-4 py-2 rounded-lg bg-gray-200 text-gray-800"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={updatePasswordMutation.isPending}
                        className="px-4 py-2 rounded-lg bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50"
                      >
                        {updatePasswordMutation.isPending ? 'Saving...' : 'Save'}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {activeModal === "assignPos" && (
                <div>
                  <div className="space-y-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Search and Select POS Machines
                      </label>
                      <div className="relative">
                        <Select
                          isMulti
                          name="pos_machine_ids"
                          value={selectedMachines}
                          options={selectOptions}
                          onChange={handleSelectChange}
                          onInputChange={handleSearchChange}
                          isLoading={posMachinesLoading}
                          placeholder="Search by Device Serial Number or name..."
                          className="w-full"
                          classNamePrefix="react-select"
                          noOptionsMessage={() =>
                            posMachinesError
                              ? "Error loading POS machines"
                              : "No unassigned POS machines found"
                          }
                        />
                        {posMachinesLoading && (
                          <div className="absolute right-10 top-1/2 transform -translate-y-1/2">
                            <Loader2 className="animate-spin h-5 w-5 text-gray-400" />
                          </div>
                        )}
                      </div>
                      <SelectedMachinesList />
                    </div>
                    {posMachinesError && (
                      <div className="p-4 bg-red-50 text-red-600 rounded-lg">
                        {posMachinesError.message || "Failed to load POS machines"}
                      </div>
                    )}
                    <div className="flex justify-between">
                      <button
                        onClick={closeModal}
                        className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleAssignPos}
                        disabled={assignPosMutation.isPending || selectedMachines.length === 0}
                        className={`px-4 py-2 bg-indigo-600 text-white rounded-md flex items-center gap-2 ${assignPosMutation.isPending || selectedMachines.length === 0
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
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Success/Error Messages */}
        {showSuccess && (
          <div className="fixed bottom-6 right-6 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-2 animate-fade-in">
            <CheckCircle size={20} /> Operation completed successfully!
          </div>
        )}
      </div>

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
}

// Reusable Card Component
const Card = ({ title, children, editable, onEdit }) => (
  <div className="bg-white rounded-xl shadow-md p-6">
    <div className="flex justify-between items-center mb-4">
      <h2 className="text-xl font-semibold text-gray-800 border-b pb-2">{title}</h2>
      {editable && (
        <button
          onClick={onEdit}
          className="px-3 py-1 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
        >
          Edit
        </button>
      )}
    </div>
    <div className="space-y-3">{children}</div>
  </div>
);

// Reusable Info Field Component
const InfoField = ({ label, value, badge }) => (
  <div className="flex justify-between items-center py-2">
    <span className="font-medium text-gray-700">{label}:</span>
    {badge ? (
      <span
        className={`px-2 py-1 rounded-full text-xs font-semibold ${value === "Yes" || value === "active"
          ? "bg-green-100 text-green-800"
          : "bg-red-100 text-red-800"
          }`}
      >
        {value}
      </span>
    ) : (
      <span className="text-gray-900">{value}</span>
    )}
  </div>
);

const IMAGE_FALLBACK_SRC =
  'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22320%22 height=%22180%22 viewBox=%220 0 320 180%22%3E%3Crect width=%22320%22 height=%22180%22 fill=%22%23f3f4f6%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 dominant-baseline=%22middle%22 text-anchor=%22middle%22 fill=%22%236b7280%22 font-family=%22Arial,sans-serif%22 font-size=%2214%22%3EImage not found%3C/text%3E%3C/svg%3E';

const resolveImageUrl = (rawUrl) => {
  if (!rawUrl) return null;
  const value = String(rawUrl).trim();

  if (/^https?:\/\//i.test(value)) return value;
  if (/^https\/\//i.test(value)) return value.replace(/^https\/\//i, "https://");
  if (/^http\/\//i.test(value)) return value.replace(/^http\/\//i, "http://");
  if (value.startsWith("//")) return `https:${value}`;
  if (/^[\w-]+(\.[\w-]+)+\//.test(value)) return `https://${value}`;

  const base = String(BASE_SITE_URL || "").replace(/\/+$/, "");
  const path = value.startsWith("/") ? value : `/${value}`;
  return `${base}${path}`;
};

// Reusable Image Field Component
const ImageField = ({ label, number, url }) => {
  const resolvedUrl = resolveImageUrl(url);
  return (
    <div className="py-2">
      <span className="font-medium text-gray-700">{label}:</span>
      <div className="mt-1">
        {number && <p className="text-gray-900">{number}</p>}
        {resolvedUrl ? (
          <a href={resolvedUrl} target="_blank" rel="noopener noreferrer">
            <img
              src={resolvedUrl}
              alt={`${label} preview`}
              className="mt-2 w-full max-w-xs rounded-lg shadow-sm hover:shadow-md transition"
              onError={(e) => {
                e.currentTarget.onerror = null;
                e.currentTarget.src = IMAGE_FALLBACK_SRC;
              }}
            />
          </a>
        ) : (
          <p className="text-gray-500">No image available</p>
        )}
      </div>
    </div>
  );
};

export default UserDetails;





