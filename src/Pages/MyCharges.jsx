import { createElement, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Building2,
  CircleDollarSign,
  Loader2,
  Search,
  Users,
  UserRound,
} from "lucide-react";
import { AllUsers } from "../api/FranchiseApi";
import { ChargesSetByUserId } from "../api/chargeSet";
import {
  getUserPayoutChargesByUser,
  listAllUserPayoutCharges,
} from "../api/rateSettingsApi";
import { extractUsersArray, normalizeUserRole } from "../utils/userAccess";

const USER_TYPES = [
  { value: "all", label: "All" },
  { value: "merchant", label: "Merchant" },
  { value: "franchise", label: "Franchise" },
  { value: "super_franchise", label: "Super Franchise" },
  { value: "employee", label: "Employee" },
];

const SERVICE_CATEGORIES = [
  "Payout & Banking",
  "Credit Card & Utility",
  "POS & Hardware",
  "Digital QR",
  "Payment Gateway",
  "Financial Controls",
  "Settlement & Limits",
];

const PAGE_SIZE = 1000;

const getRows = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.slabs)) return payload.slabs;
  if (Array.isArray(payload?.charges)) return payload.charges;
  return [];
};

const fetchManagedUsers = async () => {
  const firstPage = await AllUsers({ page: 1, limit: PAGE_SIZE });
  const users = extractUsersArray(firstPage);
  const reportedTotal = Number(firstPage?.pagination?.total);
  const totalPages = Math.max(
    1,
    Number(firstPage?.pagination?.totalPages) ||
      Math.ceil((reportedTotal || users.length) / PAGE_SIZE),
  );

  if (totalPages === 1) return users;

  const remainingPages = await Promise.all(
    Array.from({ length: totalPages - 1 }, (_, index) =>
      AllUsers({ page: index + 2, limit: PAGE_SIZE }),
    ),
  );

  return [...users, ...remainingPages.flatMap(extractUsersArray)];
};

const roleLabel = (role) => {
  const normalizedRole = normalizeUserRole(role);
  return (
    USER_TYPES.find((type) => type.value === normalizedRole)?.label ||
    (normalizedRole
      ? `${normalizedRole.charAt(0).toUpperCase()}${normalizedRole.slice(1)}`
      : "User")
  );
};

const getUserStatus = (user = {}) => {
  const value = user.status ?? user.user_status ?? user.is_active ?? user.active;
  const normalized = String(value ?? "").trim().toLowerCase();

  if (value === true || ["active", "enabled", "1"].includes(normalized)) {
    return "Active";
  }
  if (value === false || ["inactive", "disabled", "blocked", "0"].includes(normalized)) {
    return "Inactive";
  }
  return "Pending";
};

const getUserName = (user = {}) =>
  user.name ||
  user.username ||
  user.abheepay_id ||
  (user.id !== undefined ? `User #${user.id}` : "Unknown user");

const getCompanyName = (user = {}) =>
  user.company_or_shop_name ||
  user.company_name ||
  user.shop_name ||
  user.business_name ||
  "Company not provided";

const getHierarchyPath = (user = {}) => {
  const role = normalizeUserRole(user.role);
  const franchise = user.franchise_details || user.franchise || user.franchaise;
  const superFranchise =
    user.super_franchise_details ||
    franchise?.super_franchise_details ||
    franchise?.super_franchise;
  const path = [];

  if (superFranchise?.name || superFranchise?.abheepay_id) {
    path.push(superFranchise.name || superFranchise.abheepay_id);
  }
  if (franchise?.name || franchise?.abheepay_id) {
    path.push(franchise.name || franchise.abheepay_id);
  }
  path.push(getCompanyName(user) === "Company not provided" ? getUserName(user) : getCompanyName(user));

  if (role === "employee" || role === "super_franchise") {
    return [getCompanyName(user) === "Company not provided" ? getUserName(user) : getCompanyName(user)];
  }

  return [...new Set(path)];
};

const getRuleUserId = (rule) =>
  rule?.user_id ?? rule?.userId ?? rule?.user?.id ?? rule?.merchant_id ?? null;

const getServiceName = (rule = {}, source) =>
  rule.service_name ||
  rule.service?.name ||
  rule.service_key ||
  rule.charge_type ||
  rule.charge_type_name ||
  rule.charge_type_category ||
  rule.category ||
  (source === "payout" ? "Payout charge" : "—");

const getCategory = (rule = {}, source) =>
  rule.category ||
  rule.charge_type_category ||
  rule.service?.category ||
  (source === "payout" ? "Payout & Banking" : "—");

const getStatus = (rule = {}) => {
  const value = rule.is_active ?? rule.status ?? rule.active;
  const normalized = String(value ?? "").trim().toLowerCase();
  if (value === true || ["active", "enabled", "1"].includes(normalized)) return "Active";
  if (value === false || ["inactive", "disabled", "0"].includes(normalized)) return "Inactive";
  return "Pending";
};

const formatAmount = (value) => {
  if (value === null || value === undefined || value === "") return "—";
  const amount = Number(value);
  if (!Number.isFinite(amount)) return String(value);
  return `₹${amount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
};

const getSlabRange = (rule = {}) => {
  const min = rule.from_amount ?? rule.min_amount;
  const max = rule.to_amount ?? rule.max_amount;
  if (min === undefined && max === undefined) return "—";
  return `${formatAmount(min ?? 0)} – ${max === null ? "No upper limit" : formatAmount(max)}`;
};

const getChargeLabel = (rule = {}) => {
  const rate = rule.rate ?? rule.charge;
  const type = String(rule.rate_type || rule.fee_type || "").toLowerCase();

  if (rate !== undefined && rate !== null) {
    return type === "flat" ? `Flat ${formatAmount(rate)}` : `${rate}%`;
  }

  const flat = Number(rule.flat_fee || 0);
  const percent = Number(rule.percent_fee || 0);
  const parts = [];
  if (flat) parts.push(`Flat ${formatAmount(flat)}`);
  if (percent) parts.push(`${percent}%`);
  return parts.length ? parts.join(" + ") : "—";
};

const getGstLabel = (rule = {}) => {
  if (rule.gst_required === false) return "Not charged";
  const gst = rule.gst_percent ?? rule.gst_rate ?? rule.gst;
  if (gst === undefined || gst === null || gst === "") return "—";
  return `${gst}%${rule.is_gst_inclusive ? " (incl.)" : ""}`;
};

const getTransferMode = (rule = {}) =>
  rule.payment_mode || rule.transfer_mode || rule.method || "—";

const normalizeChargeRow = (rule, user, source) => ({
  id: `${source}-${rule.id ?? `${getRuleUserId(rule) || user?.id || "unknown"}-${rule.service_key || rule.charge_type_category || "charge"}`}`,
  userId: getRuleUserId(rule) ?? user?.id ?? null,
  user,
  role: normalizeUserRole(user?.role || rule.user?.role || rule.target_role),
  service: getServiceName(rule, source),
  category: getCategory(rule, source),
  range: getSlabRange(rule),
  charge: getChargeLabel(rule),
  gst: getGstLabel(rule),
  transferMode: getTransferMode(rule),
  status: getStatus(rule),
});

const STATUS_STYLES = {
  Active: "bg-green-100 text-green-800",
  Inactive: "bg-red-100 text-red-800",
  Pending: "bg-amber-100 text-amber-800",
};

const SummaryCard = ({ label, value, detail, icon: Icon, tone }) => (
  <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-sm font-medium text-gray-500">{label}</p>
        <p className="mt-2 text-2xl font-semibold text-gray-900">{value}</p>
        <p className="mt-1 text-xs text-gray-500">{detail}</p>
      </div>
      <span className={`rounded-lg p-2.5 ${tone}`}>
        {createElement(Icon, { className: "h-5 w-5", "aria-hidden": true })}
      </span>
    </div>
  </div>
);

const MyCharges = () => {
  const [selectedType, setSelectedType] = useState("all");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [chargeSearch, setChargeSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");

  const {
    data: users = [],
    isLoading: usersLoading,
    isError: usersError,
  } = useQuery({
    queryKey: ["admin-my-charges", "managed-users"],
    queryFn: fetchManagedUsers,
  });

  const {
    data: chargeData,
    isLoading: chargesLoading,
    isError: chargesError,
    error: chargeError,
  } = useQuery({
    queryKey: ["admin-my-charges", "rules", selectedUserId || "all"],
    queryFn: async () => {
      if (!selectedUserId) {
        return {
          payoutRules: getRows(await listAllUserPayoutCharges()),
          assignedSlabs: [],
          sourceErrors: [],
        };
      }

      const [payoutResult, slabResult] = await Promise.allSettled([
        getUserPayoutChargesByUser(selectedUserId),
        ChargesSetByUserId(selectedUserId),
      ]);

      return {
        payoutRules:
          payoutResult.status === "fulfilled" ? getRows(payoutResult.value) : [],
        assignedSlabs:
          slabResult.status === "fulfilled" ? getRows(slabResult.value) : [],
        sourceErrors: [payoutResult, slabResult]
          .filter((result) => result.status === "rejected")
          .map((result) => result.reason?.message || "Charge source unavailable."),
      };
    },
  });

  const userById = useMemo(
    () => new Map(users.map((user) => [String(user.id), user])),
    [users],
  );
  const managedUsers = useMemo(
    () =>
      users.filter((user) =>
        USER_TYPES.some(
          (type) => type.value !== "all" && type.value === normalizeUserRole(user.role),
        ),
      ),
    [users],
  );
  const selectedUser = userById.get(String(selectedUserId));

  const filteredUsers = useMemo(() => {
    const search = userSearch.trim().toLowerCase();
    return managedUsers.filter((user) => {
      const roleMatches =
        selectedType === "all" || normalizeUserRole(user.role) === selectedType;
      const statusMatches =
        selectedStatus === "all" || getUserStatus(user).toLowerCase() === selectedStatus;
      const searchMatches =
        !search ||
        [getUserName(user), getCompanyName(user), user.abheepay_id, user.mobile_number]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(search));
      return roleMatches && statusMatches && searchMatches;
    });
  }, [managedUsers, selectedStatus, selectedType, userSearch]);

  const chargeRows = useMemo(() => {
    const payoutRules = chargeData?.payoutRules || [];
    const assignedSlabs = chargeData?.assignedSlabs || [];
    const normalizeRules = (rules, source) =>
      rules.map((rule, index) => {
        const owner =
          userById.get(String(getRuleUserId(rule) || selectedUserId)) ||
          rule.user ||
          selectedUser;
        return {
          ...normalizeChargeRow(rule, owner, source),
          id: `${source}-${rule.id ?? `${getRuleUserId(rule) || selectedUserId || "unknown"}-${index}`}-${index}`,
        };
      });

    return [
      ...normalizeRules(payoutRules, "payout"),
      ...normalizeRules(assignedSlabs, "assigned"),
    ];
  }, [chargeData, selectedUser, selectedUserId, userById]);

  const visibleChargeRows = useMemo(() => {
    const search = chargeSearch.trim().toLowerCase();
    return chargeRows.filter((row) => {
      const user = row.user || {};
      const typeMatches =
        selectedType === "all" || row.role === selectedType;
      const categoryMatches =
        selectedCategory === "all" || row.category === selectedCategory;
      const statusMatches =
        selectedStatus === "all" || row.status.toLowerCase() === selectedStatus;
      const userMatches =
        !selectedUserId || String(row.userId || user.id) === String(selectedUserId);
      const searchMatches =
        !search ||
        [row.service, row.category, roleLabel(row.role), getUserName(user)]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(search));
      return typeMatches && categoryMatches && statusMatches && userMatches && searchMatches;
    });
  }, [chargeRows, chargeSearch, selectedCategory, selectedStatus, selectedType, selectedUserId]);

  const activeUserCount = managedUsers.filter(
    (user) => getUserStatus(user) === "Active",
  ).length;
  const serviceCount = new Set(
    visibleChargeRows.map((row) => row.service).filter((service) => service !== "—"),
  ).size;
  const typeCounts = managedUsers.reduce((counts, user) => {
    const role = normalizeUserRole(user.role);
    counts[role] = (counts[role] || 0) + 1;
    return counts;
  }, {});

  const handleTypeChange = (value) => {
    setSelectedType(value);
    if (selectedUser && value !== "all" && normalizeUserRole(selectedUser.role) !== value) {
      setSelectedUserId("");
    }
  };

  const handleStatusChange = (value) => {
    setSelectedStatus(value);
    if (
      selectedUser &&
      value !== "all" &&
      getUserStatus(selectedUser).toLowerCase() !== value
    ) {
      setSelectedUserId("");
    }
  };

  const displayedValue = (value, loading) => (loading ? "…" : value);

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-6">
      <div className="mx-auto max-w-7xl space-y-5">
        <header className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm md:p-6">
          <div className="flex items-center gap-3">
            <span className="rounded-lg bg-cyan-50 p-3 text-cyan-700">
              <CircleDollarSign className="h-6 w-6" aria-hidden="true" />
            </span>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">My Charges</h1>
              <p className="mt-1 text-sm text-gray-600">
                View and manage charges applicable to your users and services.
              </p>
            </div>
          </div>
        </header>

        {usersError && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800" role="alert">
            Could not load the Admin user list. {" "}
            <span>Check your access or try again later.</span>
          </div>
        )}

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Charge and user summary">
          <SummaryCard
            label="Total Users"
            value={displayedValue(managedUsers.length, usersLoading)}
            detail="Across merchants, franchises, super franchises and employees"
            icon={Users}
            tone="bg-cyan-50 text-cyan-700"
          />
          <SummaryCard
            label="Active Users"
            value={displayedValue(activeUserCount, usersLoading)}
            detail="Accounts currently marked active"
            icon={UserRound}
            tone="bg-green-50 text-green-700"
          />
          <SummaryCard
            label="Charge Rules"
            value={displayedValue(visibleChargeRows.length, chargesLoading)}
            detail={selectedUser ? `Applicable to ${getUserName(selectedUser)}` : "User payout overrides returned by the API"}
            icon={CircleDollarSign}
            tone="bg-blue-50 text-blue-700"
          />
          <SummaryCard
            label="Services"
            value={displayedValue(serviceCount, chargesLoading)}
            detail="Services with loaded applicable rules"
            icon={Building2}
            tone="bg-amber-50 text-amber-700"
          />
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm md:p-6">
          <div className="flex flex-col gap-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Users and hierarchy</h2>
              <p className="mt-1 text-sm text-gray-500">
                Select an account to view its assigned charge slabs and payout overrides.
              </p>
            </div>

            <div className="flex flex-wrap gap-2" role="group" aria-label="Filter users by type">
              {USER_TYPES.map((type) => {
                const count =
                  type.value === "all" ? managedUsers.length : typeCounts[type.value] || 0;
                const active = selectedType === type.value;
                return (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => handleTypeChange(type.value)}
                    aria-pressed={active}
                    className={`rounded-full border px-3.5 py-2 text-sm font-medium transition-colors ${
                      active
                        ? "border-cyan-700 bg-cyan-700 text-white"
                        : "border-gray-200 bg-white text-gray-600 hover:border-cyan-300 hover:text-cyan-800"
                    }`}
                  >
                    {type.label} <span className={active ? "text-cyan-100" : "text-gray-400"}>({count})</span>
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_220px_190px]">
              <label className="relative block">
                <span className="sr-only">Search users</span>
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
                <input
                  value={userSearch}
                  onChange={(event) => setUserSearch(event.target.value)}
                  placeholder="Search user or company..."
                  className="w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-9 pr-3 text-sm text-gray-900 outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100"
                />
              </label>
              <label>
                <span className="sr-only">Filter by service category</span>
                <select
                  value={selectedCategory}
                  onChange={(event) => setSelectedCategory(event.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-700 outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100"
                >
                  <option value="all">All service categories</option>
                  {SERVICE_CATEGORIES.map((category) => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
              </label>
              <label>
                <span className="sr-only">Filter by status</span>
                <select
                  value={selectedStatus}
                  onChange={(event) => handleStatusChange(event.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-700 outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100"
                >
                  <option value="all">All statuses</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="pending">Pending</option>
                </select>
              </label>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(280px,0.8fr)_minmax(0,1.7fr)]">
              <div className="overflow-hidden rounded-lg border border-gray-200">
                <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-4 py-3">
                  <h3 className="text-sm font-semibold text-gray-800">Managed users</h3>
                  <span className="text-xs text-gray-500">{filteredUsers.length} shown</span>
                </div>
                <div className="max-h-[390px] overflow-y-auto">
                  <button
                    type="button"
                    onClick={() => setSelectedUserId("")}
                    aria-pressed={!selectedUserId}
                    className={`w-full border-b border-gray-100 px-4 py-3 text-left text-sm font-medium ${
                      !selectedUserId ? "bg-cyan-50 text-cyan-900" : "text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    All Users
                    <span className="ml-2 text-xs text-gray-500">({managedUsers.length})</span>
                  </button>
                  {usersLoading ? (
                    <div className="flex items-center gap-2 px-4 py-5 text-sm text-gray-500">
                      <Loader2 className="h-4 w-4 animate-spin" /> Loading users...
                    </div>
                  ) : filteredUsers.length ? (
                    filteredUsers.map((user) => {
                      const active = String(user.id) === String(selectedUserId);
                      const status = getUserStatus(user);
                      return (
                        <button
                          key={user.id}
                          type="button"
                          onClick={() => setSelectedUserId(String(user.id))}
                          aria-pressed={active}
                          className={`w-full border-b border-gray-100 px-4 py-3 text-left last:border-b-0 ${
                            active ? "bg-cyan-50" : "hover:bg-gray-50"
                          }`}
                        >
                          <span className="flex items-start justify-between gap-3">
                            <span className="min-w-0">
                              <span className="block truncate text-sm font-semibold text-gray-900">{getUserName(user)}</span>
                              <span className="mt-0.5 block truncate text-xs text-gray-500">
                                {roleLabel(user.role)} · {getCompanyName(user)}
                              </span>
                              <span className="mt-1 block truncate text-xs text-gray-400">
                                {getHierarchyPath(user).join(" › ")}
                              </span>
                            </span>
                            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_STYLES[status]}`}>
                              {status}
                            </span>
                          </span>
                        </button>
                      );
                    })
                  ) : (
                    <p className="px-4 py-5 text-sm text-gray-500">No users match these filters.</p>
                  )}
                </div>
              </div>

              <div className="min-w-0 rounded-lg border border-gray-200 bg-gray-50 p-4 md:p-5">
                {selectedUser ? (
                  <>
                    <p className="text-xs font-semibold uppercase text-gray-500">Selected user</p>
                    <h3 className="mt-1 text-xl font-semibold text-gray-900">{getUserName(selectedUser)}</h3>
                    <p className="mt-1 text-sm text-gray-600">
                      {roleLabel(selectedUser.role)} <span className="px-1 text-gray-300">·</span> {getCompanyName(selectedUser)}
                    </p>
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      {getHierarchyPath(selectedUser).map((part, index, path) => (
                        <span key={`${part}-${index}`} className="inline-flex items-center gap-2">
                          <span className="rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700">{part}</span>
                          {index < path.length - 1 && <span className="text-gray-400" aria-hidden="true">›</span>}
                        </span>
                      ))}
                    </div>
                    <span className={`mt-4 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLES[getUserStatus(selectedUser)]}`}>
                      {getUserStatus(selectedUser)}
                    </span>
                  </>
                ) : (
                  <>
                    <p className="text-xs font-semibold uppercase text-gray-500">All managed accounts</p>
                    <h3 className="mt-1 text-xl font-semibold text-gray-900">Applicable charge rules</h3>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-600">
                      Showing user payout overrides returned by the existing API. Select an account to load its assigned charge slabs as well.
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-gray-200 p-5 md:flex-row md:items-center md:justify-between md:p-6">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Applicable charges</h2>
              <p className="mt-1 text-sm text-gray-500">
                Read-only charge assignments and user payout overrides.
              </p>
            </div>
            <label className="relative block w-full md:max-w-sm">
              <span className="sr-only">Search user, service, or category</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
              <input
                value={chargeSearch}
                onChange={(event) => setChargeSearch(event.target.value)}
                placeholder="Search user, service, category..."
                className="w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-9 pr-3 text-sm text-gray-900 outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100"
              />
            </label>
          </div>

          {chargesLoading ? (
            <div className="flex items-center justify-center gap-2 p-10 text-sm text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading applicable charges...
            </div>
          ) : chargesError ? (
            <div className="p-6 text-sm text-red-700" role="alert">
              Could not load applicable charges: {chargeError?.message || "Charge data is unavailable."}
            </div>
          ) : (
            <>
              {chargeData?.sourceErrors?.length > 0 && (
                <div className="mx-5 mt-5 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 md:mx-6">
                  Some charge sources could not be loaded. {chargeData.sourceErrors.join(" ")}
                </div>
              )}
              {!selectedUserId && (
                <div className="mx-5 mt-5 rounded-lg border border-blue-100 bg-blue-50 p-3 text-sm text-blue-900 md:mx-6">
                  Account-specific legacy slabs are loaded when you select a user. Global Set Charges defaults are not treated as user assignments.
                </div>
              )}
              <div className="overflow-x-auto">
                <table className="min-w-[1050px] w-full text-left text-sm">
                  <thead className="bg-gray-50 text-xs font-semibold uppercase text-gray-600">
                    <tr>
                      <th className="px-4 py-3">Service</th>
                      <th className="px-4 py-3">Category</th>
                      <th className="px-4 py-3">User / Role</th>
                      <th className="px-4 py-3">Slab range</th>
                      <th className="px-4 py-3">Charge</th>
                      <th className="px-4 py-3">GST</th>
                      <th className="px-4 py-3">Transfer mode</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {visibleChargeRows.map((row) => (
                      <tr key={row.id} className="align-top hover:bg-gray-50/70">
                        <td className="px-4 py-3 font-medium text-gray-900">{row.service}</td>
                        <td className="px-4 py-3 text-gray-600">{row.category}</td>
                        <td className="px-4 py-3">
                          <span className="block font-medium text-gray-900">{getUserName(row.user || {})}</span>
                          <span className="text-xs text-gray-500">{roleLabel(row.role)}</span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-gray-700">{row.range}</td>
                        <td className="whitespace-nowrap px-4 py-3 font-semibold text-blue-700">{row.charge}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-gray-700">{row.gst}</td>
                        <td className="px-4 py-3 text-gray-700">{row.transferMode}</td>
                        <td className="px-4 py-3">
                          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLES[row.status]}`}>
                            {row.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {row.userId ? (
                            <button
                              type="button"
                              onClick={() => setSelectedUserId(String(row.userId))}
                              className="text-sm font-medium text-cyan-800 hover:text-cyan-950"
                            >
                              View user
                            </button>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {visibleChargeRows.length === 0 && (
                      <tr>
                        <td colSpan={9} className="px-6 py-12 text-center">
                          <CircleDollarSign className="mx-auto h-8 w-8 text-gray-300" aria-hidden="true" />
                          <p className="mt-3 text-sm font-medium text-gray-700">No applicable charge rules found</p>
                          <p className="mt-1 text-sm text-gray-500">
                            {selectedUser
                              ? "No assigned slabs or payout overrides were returned for this account."
                              : "No user payout overrides were returned for these filters."}
                          </p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="border-t border-gray-100 px-5 py-3 text-xs text-gray-500 md:px-6">
                {visibleChargeRows.length} applicable rule{visibleChargeRows.length === 1 ? "" : "s"}
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
};

export default MyCharges;