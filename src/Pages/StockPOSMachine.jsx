import React, { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import {
  getAllPosMachines,
  markAsDelivered,
  markAsReturnInitiated,
  updatePosMachine,
  bulkCreatePosMachines,
  assignPosMachineToFranchise,
  assignPosMachineToMerchant,
  unassignPosMachine,
  deletePosMachine,
  assignPosMachineToSuperFranchise,
} from "../api/posMachine";
import { createCompanyName, getCompanyNames } from "../api/companyName";
import { getDashboard } from "../api/DashboardAndHeader";
import Modal from "../components/Modal";
import FormInput from "../components/FormInput";
import { Plus, X, Edit2, Upload, Eye, Trash2, Download } from "lucide-react";
import Loader from "../components/Loader";
import Select from "react-select";
import { FranchiseAllUsers, MerchantAllUsers, SuperFranchiseAllUsers, searchUsers } from "../api/FranchiseApi";
import { hasAnyPermission, isEmployeeUser as isEmployeeAccessUser } from "../utils/accessControl";

// const PAGE_SIZE = 500;
const PAGE_SIZE = 1000;

const PAGE_NUMBER_WINDOW = 10;

const logStockPosUi = () => {};

const COMPANY_TABS = ["All", "AGRO-AXIS", "AGRO-HDFC", "Everlife"];
const ALL_COMPANY_TOKEN = "all";
const AGRO_COMPANY_TOKEN = "agro";
const AGRO_AXIS_COMPANY_TOKEN = "agro-axis";
const AGRO_HDFC_COMPANY_TOKEN = "agro-hdfc";
const EVERLIFE_COMPANY_TOKEN = "everlife";

const ASSIGNMENT_USER_FETCH_LIMIT = 1000;
const ASSIGNMENT_REMOTE_SEARCH_MIN_LENGTH = 4;
const ASSIGNMENT_REMOTE_SEARCH_LIMIT = 50;
const ASSIGNMENT_MENU_MAX_HEIGHT = 320;
const assignmentSelectStyles = {
  control: (base, state) => ({
    ...base,
    minHeight: "42px",
    borderColor: state.isFocused ? "#00D3CD" : "#D1D5DB",
    boxShadow: state.isFocused ? "0 0 0 2px rgba(0, 211, 205, 0.2)" : "none",
    "&:hover": {
      borderColor: "#00D3CD",
    },
  }),
  menu: (base) => ({
    ...base,
    zIndex: 30,
  }),
  menuList: (base) => ({
    ...base,
    maxHeight: `${ASSIGNMENT_MENU_MAX_HEIGHT}px`,
  }),
  option: (base, state) => ({
    ...base,
    backgroundColor: state.isSelected
      ? "rgba(0, 211, 205, 0.14)"
      : state.isFocused
        ? "rgba(0, 211, 205, 0.08)"
        : "#FFFFFF",
    color: "#0F172A",
    cursor: "pointer",
  }),
  singleValue: (base) => ({
    ...base,
    color: "#111827",
  }),
};

const extractAssignmentUsers = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.rows)) return payload.rows;
  if (Array.isArray(payload?.list)) return payload.list;
  if (Array.isArray(payload?.data?.rows)) return payload.data.rows;
  if (Array.isArray(payload?.data?.list)) return payload.data.list;
  if (Array.isArray(payload?.data?.data)) return payload.data.data;
  return [];
};

const extractAssignmentTotalPages = (payload) => {
  const pagination = payload?.pagination || payload?.data?.pagination || {};
  const totalPages = Number(
    pagination.totalPages ||
      pagination.total_pages ||
      pagination.pages ||
      pagination.last_page ||
      1
  );
  return Number.isFinite(totalPages) && totalPages > 0 ? totalPages : 1;
};

const dedupeAssignmentUsers = (rows) =>
  Array.from(
    new Map(
      (Array.isArray(rows) ? rows : []).map((row, index) => [
        row?.id ?? `${row?.name || "user"}-${index}`,
        row,
      ])
    ).values()
  );

const getAssignmentUserFranchiseId = (user) =>
  user?.franchaise_id ?? user?.franchise_id ?? user?.franchiseId ?? null;

const getAssignmentUserMobile = (user) =>
  String(user?.mobile_number ?? user?.mobile ?? user?.phone_number ?? "").trim();

const getAssignmentUserUsername = (user) =>
  String(user?.username ?? user?.user_name ?? user?.userName ?? "").trim();

const getAssignmentUserName = (user) =>
  String(
    user?.name ??
      user?.full_name ??
      user?.business_name ??
      (user?.id ? `User ${user.id}` : "Unknown User")
  ).trim();

const getAssignmentUserRole = (user, fallbackRole = "") => {
  const rawRole = String(user?.__role || user?.role || fallbackRole || "")
    .trim()
    .toLowerCase();
  return rawRole === "franchaise" ? "franchise" : rawRole;
};

const getFranchiseDisplayName = (machine) => {
  const assignedUserRole = getAssignmentUserRole(machine?.assigned_user);
  if (assignedUserRole === "franchise") {
    return getAssignmentUserName(machine?.assigned_user) || machine?.assigned_to || "-";
  }

  return machine?.franchise_name || machine?.franchise?.name || "-";
};

const mapAssignmentUserWithRole = (user, fallbackRole = "") => ({
  ...user,
  __role: getAssignmentUserRole(user, fallbackRole),
});

const createAssignmentOption = (user) => {
  const name = getAssignmentUserName(user);
  const mobile = getAssignmentUserMobile(user);
  const role = getAssignmentUserRole(user);

  return {
    value: user?.id,
    label: mobile ? `${name} (${mobile})` : name,
    name,
    mobile,
    role,
    user,
  };
};

const normalizeCompanyToken = (value) =>
  String(value ?? "")
    .trim()
    .toLowerCase();

const normalizeMachineScopeToken = (value) =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-");

const getMachineCompanyBucket = (machine) => {
  const companyToken = normalizeCompanyToken(machine?.company_name);
  if (!companyToken) return "";
  if (companyToken === EVERLIFE_COMPANY_TOKEN) return EVERLIFE_COMPANY_TOKEN;
  if (companyToken !== AGRO_COMPANY_TOKEN) return companyToken;

  const sourceCandidates = [
    machine?.source,
    machine?.company_source,
    machine?.provider,
    machine?.bank_provider,
  ]
    .map((value) => normalizeMachineScopeToken(value))
    .filter(Boolean);
  const bankToken = normalizeMachineScopeToken(machine?.bank_name);

  if (
    sourceCandidates.some((value) => value.includes(AGRO_AXIS_COMPANY_TOKEN)) ||
    bankToken.includes("axis")
  ) {
    return AGRO_AXIS_COMPANY_TOKEN;
  }

  if (
    sourceCandidates.some((value) => value.includes(AGRO_HDFC_COMPANY_TOKEN)) ||
    bankToken.includes("hdfc")
  ) {
    return AGRO_HDFC_COMPANY_TOKEN;
  }

  return AGRO_AXIS_COMPANY_TOKEN;
};

const matchesCompanyTab = (machine, normalizedTab) => {
  if (!normalizedTab || normalizedTab === ALL_COMPANY_TOKEN) return true;

  const bucket = getMachineCompanyBucket(machine);
  const companyToken = normalizeCompanyToken(machine?.company_name);

  if (normalizedTab === AGRO_AXIS_COMPANY_TOKEN) {
    return bucket === AGRO_AXIS_COMPANY_TOKEN;
  }

  if (normalizedTab === AGRO_HDFC_COMPANY_TOKEN) {
    return bucket === AGRO_HDFC_COMPANY_TOKEN;
  }

  if (normalizedTab === EVERLIFE_COMPANY_TOKEN) {
    return companyToken === EVERLIFE_COMPANY_TOKEN;
  }

  return companyToken === normalizedTab;
};

const getMachineCompanyDisplayName = (machine) => {
  const bucket = getMachineCompanyBucket(machine);

  if (bucket === AGRO_AXIS_COMPANY_TOKEN) return "AGRO-AXIS";
  if (bucket === AGRO_HDFC_COMPANY_TOKEN) return "AGRO-HDFC";
  if (bucket === EVERLIFE_COMPANY_TOKEN) return "Everlife";

  return machine?.company_name || "-";
};

const resolveCompanyNameFromOptions = (companyName, companyOptions) => {
  const normalized = normalizeCompanyToken(companyName);
  if (!normalized) return companyOptions[0] || "";

  const matchedCompany = companyOptions.find(
    (option) => normalizeCompanyToken(option) === normalized
  );

  return matchedCompany || companyOptions[0] || "";
};

const StockPOSMachine = ({ currentUser }) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const normalizedRole = String(currentUser?.role || "").trim().toLowerCase();
  const isAdminUser = normalizedRole === "admin";
  const isFranchiseUser = normalizedRole === "franchise" || normalizedRole === "franchaise";
  const isSuperFranchiseUser = normalizedRole === "super_franchise";
  const isEmployeeStockViewer =
    isEmployeeAccessUser(currentUser) &&
    hasAnyPermission(currentUser, ["stock.pos.read", "stock.pos.manage"]);
  const isAdminStyleStockViewer = isAdminUser || isEmployeeStockViewer;
  const canManageStockModule = isAdminUser || isEmployeeStockViewer;
  const [serverPage, setServerPage] = useState(1);
  const [uiPage, setUiPage] = useState(1);
  const [companyTab, setCompanyTab] = useState("All");
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [bankNameFilter, setBankNameFilter] = useState("");
  const [backendSearchMachines, setBackendSearchMachines] = useState([]);
  const [showDeliveryModal, setShowDeliveryModal] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedMachine, setSelectedMachine] = useState(null);
  const [showBulkUploadModal, setShowBulkUploadModal] = useState(false); // New state for bulk upload modal
  const [showAssignModal, setShowAssignModal] = useState(false); // modal for assigning machine
  const [assignMachine, setAssignMachine] = useState(null);
  const [assignUser, setAssignUser] = useState(null);
  const [availableFranchises, setAvailableFranchises] = useState([]);
  const [availableSuperFranchises, setAvailableSuperFranchises] = useState([]);
  const [availableMerchants, setAvailableMerchants] = useState([]);
  const [assignTargetType, setAssignTargetType] = useState("franchise");
  const [fetchingUsers, setFetchingUsers] = useState(false);
  const [assignmentSearchInput, setAssignmentSearchInput] = useState("");
  const [debouncedAssignmentSearch, setDebouncedAssignmentSearch] = useState("");
  const [assignmentSearchResults, setAssignmentSearchResults] = useState([]);
  const [assignmentSearchError, setAssignmentSearchError] = useState("");
  const [isAssignmentSearchLoading, setIsAssignmentSearchLoading] = useState(false);
  const trimmedAssignmentSearch = String(assignmentSearchInput || "").trim();
  const assignmentEntityLabel = (isAdminStyleStockViewer || isSuperFranchiseUser)
    ? assignTargetType
    : "merchant";

  const availableUsers = useMemo(() => {
    if (isAdminStyleStockViewer) {
      return assignTargetType === "merchant"
        ? availableMerchants
        : assignTargetType === "super_franchise"
          ? availableSuperFranchises
          : availableFranchises;
    }
    if (isSuperFranchiseUser) {
      return assignTargetType === "merchant" ? availableMerchants : availableFranchises;
    }
    // Franchise users can only assign to merchants in their franchise
    return availableMerchants;
  }, [isAdminStyleStockViewer, isSuperFranchiseUser, assignTargetType, availableFranchises, availableMerchants, availableSuperFranchises]);

  const assignmentUserOptions = useMemo(() => {
    const hasSearchResults = debouncedAssignmentSearch.length >= ASSIGNMENT_REMOTE_SEARCH_MIN_LENGTH;
    const sourceUsers = hasSearchResults ? assignmentSearchResults : availableUsers;
    return sourceUsers.map((user) => createAssignmentOption(user));
  }, [assignmentSearchResults, availableUsers, debouncedAssignmentSearch.length]);

  const selectedAssignmentOption = useMemo(
    () =>
      assignmentUserOptions.find((option) => String(option.value) === String(assignUser?.id)) ||
      null,
    [assignmentUserOptions, assignUser]
  );

  const [remarks, setRemarks] = useState("");
  const [showCompanyModal, setShowCompanyModal] = useState(false);
  const [isCompanyConfirmStep, setIsCompanyConfirmStep] = useState(false);
  const [companyDraftName, setCompanyDraftName] = useState("");
  const [showCompanyListModal, setShowCompanyListModal] = useState(false);
  const [editFormData, setEditFormData] = useState({
    tid_number: "",
    mid_number: "",
    device_serial_number: "",
    company_name: "",
    razorpay_id: "",
    bank_name: "",
  });
  const [bulkUploadFile, setBulkUploadFile] = useState(null); // State for file input
  const [bulkUploadResult, setBulkUploadResult] = useState(null); // State for upload result
  const [isExporting, setIsExporting] = useState(false);

  const normalizedCompanyTab = useMemo(
    () => normalizeCompanyToken(companyTab),
    [companyTab]
  );
  const companyQueryName = useMemo(() => {
    if (normalizedCompanyTab === ALL_COMPANY_TOKEN) return "";
    if (
      normalizedCompanyTab === AGRO_AXIS_COMPANY_TOKEN ||
      normalizedCompanyTab === AGRO_HDFC_COMPANY_TOKEN
    ) {
      return "Agro";
    }
    if (normalizedCompanyTab === EVERLIFE_COMPANY_TOKEN) {
      return "Everlife";
    }
    return companyTab;
  }, [companyTab, normalizedCompanyTab]);

  function toNumber(value) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : 0;
  }

  const invalidateMachineViews = () => {
    queryClient.invalidateQueries({ queryKey: ["posMachines"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const { data: dashboardData } = useQuery({
    queryKey: ["dashboard"],
    queryFn: getDashboard,
  });

  // Fetch POS Machines (paginated)
  const {
    data: posMachineResponse,
    isLoading,
    isFetching,
  } = useQuery({
    queryKey: ["posMachines", serverPage, PAGE_SIZE, companyQueryName || "all"],
    queryFn: () =>
      getAllPosMachines({
        page: serverPage,
        limit: PAGE_SIZE,
        ...(companyQueryName ? { companyName: companyQueryName } : {}),
      }),
    placeholderData: (previousData) => previousData,
  });

  const { data: statsMachineResponse } = useQuery({
    queryKey: ["posMachineHeadingStats", normalizedRole, companyQueryName || "all"],
    queryFn: async () => {
      const firstPageResponse = await getAllPosMachines({
        page: 1,
        limit: PAGE_SIZE,
        ...(companyQueryName ? { companyName: companyQueryName } : {}),
      });

      const firstPageMachines = Array.isArray(firstPageResponse?.data)
        ? firstPageResponse.data
        : [];

      const headingTotal = toNumber(firstPageResponse?.pagination?.total);
      const headingTotalPages = Math.max(
        1,
        toNumber(firstPageResponse?.pagination?.totalPages),
        headingTotal > 0 ? Math.ceil(headingTotal / PAGE_SIZE) : 0
      );

      if (headingTotalPages <= 1) {
        return firstPageMachines;
      }

      const remainingPages = Array.from(
        { length: headingTotalPages - 1 },
        (_, index) => index + 2
      );

      const remainingResponses = await Promise.all(
        remainingPages.map((page) =>
          getAllPosMachines({
            page,
            limit: PAGE_SIZE,
            ...(companyQueryName ? { companyName: companyQueryName } : {}),
          })
        )
      );

      const remainingMachines = remainingResponses.flatMap((response) =>
        Array.isArray(response?.data) ? response.data : []
      );

      return [...firstPageMachines, ...remainingMachines];
    },
    staleTime: 1000 * 30,
  });

  const posMachines = useMemo(
    () =>
      Array.isArray(posMachineResponse)
        ? posMachineResponse
        : Array.isArray(posMachineResponse?.data)
          ? posMachineResponse.data
        : [],
    [posMachineResponse]
  );

  const statsMachines = useMemo(
    () =>
      Array.isArray(statsMachineResponse)
        ? statsMachineResponse
        : Array.isArray(statsMachineResponse?.data)
          ? statsMachineResponse.data
          : [],
    [statsMachineResponse]
  );

  const assignedMachineCount = useMemo(() => {
    if (!assignUser?.id) return 0;
    return posMachines.filter(
      (machine) =>
        machine?.assigned_to === assignUser.id
    ).length;
  }, [assignUser, posMachines]);

  const {
    data: companyRecords = [],
    isLoading: isCompanyNamesLoading,
    error: companyNamesError,
  } = useQuery({
    queryKey: ["companyNames"],
    queryFn: getCompanyNames,
    staleTime: 1000 * 60 * 5,
  });

  const companyOptions = useMemo(
    () => {
      const uniqueCompanyNames = new Map();

      companyRecords.forEach((company) => {
        const name = String(company?.name || "").trim();
        const token = normalizeCompanyToken(name);
        if (token && !uniqueCompanyNames.has(token)) {
          uniqueCompanyNames.set(token, name);
        }
      });

      return Array.from(uniqueCompanyNames.values());
    },
    [companyRecords]
  );

  const dashboardPosMachines = dashboardData?.data?.pos_machines || {};
  const globalActive = toNumber(dashboardPosMachines.active);
  const globalInactive = toNumber(dashboardPosMachines.inactive);
  const globalTotal =
    dashboardPosMachines.total !== undefined
      ? toNumber(dashboardPosMachines.total)
      : globalActive + globalInactive;

  const pagination = posMachineResponse?.pagination || {};
  const paginationLimit = Math.max(
    1,
    toNumber(pagination.limit || pagination.per_page || pagination.perPage || PAGE_SIZE)
  );
  const paginationTotal = toNumber(
    pagination.total ||
    pagination.count ||
    pagination.total_count ||
    pagination.totalRecords ||
    pagination.total_records
  );
  const paginationTotalPages = toNumber(
    pagination.totalPages ||
    pagination.total_pages ||
    pagination.pages ||
    pagination.last_page
  );
  const derivedTotalPages = Math.max(
    paginationTotalPages,
    paginationTotal > 0 ? Math.ceil(paginationTotal / paginationLimit) : 0,
    globalTotal > 0 ? Math.ceil(globalTotal / PAGE_SIZE) : 0,
    0
  );
  const hasKnownUpperBound = derivedTotalPages > 0;
  const totalPages = hasKnownUpperBound ? Math.max(1, derivedTotalPages) : 0;

  // Bulk Upload Mutation
  const bulkUploadMutation = useMutation({
    mutationFn: ({ file, companyList }) => bulkCreatePosMachines(file, companyList),
    onSuccess: (data) => {
      logStockPosUi("Bulk upload success", data);
      invalidateMachineViews();
      setBulkUploadResult(data); // Store the result to display in modal
      setBulkUploadFile(null); // Reset file input
      if (data?.success) {
        toast.success(data.message || "Bulk upload completed");
      }
    },
    onError: (error) => {
      logStockPosUi("Bulk upload error", {
        error: error.message,
      });
      setBulkUploadResult({
        success: false,
        message: error.message || "Failed to bulk create POS machines",
        errors: error.validationErrors || [],
      });
      toast.error(error.message || "Failed to bulk create POS machines");
    },
  });

  const createCompanyMutation = useMutation({
    mutationFn: createCompanyName,
    onSuccess: (response) => {
      logStockPosUi("Create company success", response);
      queryClient.invalidateQueries({ queryKey: ["companyNames"] });
      setShowCompanyModal(false);
      setIsCompanyConfirmStep(false);
      setCompanyDraftName("");
      toast.success(response?.message || "Company name created successfully");
    },
    onError: (error) => {
      logStockPosUi("Create company error", {
        companyName: companyDraftName,
        error: error.message,
      });
      toast.error(error.message || "Failed to create company name");
    },
  });

  // Existing mutations (unchanged)
  const deliverMutation = useMutation({
    mutationFn: markAsDelivered,
    onSuccess: () => {
      invalidateMachineViews();
      setShowDeliveryModal(false);
      setSelectedMachine(null);
    },
  });

  const returnMutation = useMutation({
    mutationFn: ({ id, remarks }) => markAsReturnInitiated(id, remarks),
    onSuccess: () => {
      invalidateMachineViews();
      setShowReturnModal(false);
      setSelectedMachine(null);
      setRemarks("");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deletePosMachine,
    onSuccess: () => {
      toast.success("POS machine deleted successfully");
      invalidateMachineViews();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to delete POS machine");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => updatePosMachine(id, data),
    onSuccess: () => {
      toast.success("POS machine updated successfully");
      invalidateMachineViews();
      setShowEditModal(false);
      setSelectedMachine(null);
      setEditFormData({
        tid_number: "",
        mid_number: "",
        device_serial_number: "",
        company_name: companyOptions[0] || "",
        razorpay_id: "",
        bank_name: "",
      });
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update POS machine");
    },
  });

  const getStatusBadgeColor = (status) => {
    const colors = {
      active: "bg-green-100 text-green-800",
      inactive: "bg-red-100 text-red-800",
      in_active: "bg-red-100 text-red-800",
      added: "bg-blue-100 text-blue-800",
      assigned: "bg-green-100 text-green-800",
      "un-assigned": "bg-gray-100 text-gray-700",
      delivered: "bg-purple-100 text-purple-800",
      "returned-initiated": "bg-yellow-100 text-yellow-800",
      return_initiated: "bg-yellow-100 text-yellow-800",
    };
    return colors[status] || "bg-gray-100 text-gray-800";
  };

  const normalizeRoleValue = (role) => {
    const raw = String(role || "").trim().toLowerCase();
    return raw === "franchaise" ? "franchise" : raw;
  };

  const isMachineAssigned = (machine) => Boolean(machine?.assigned_to);

  const getAssignmentStatusLabel = (machine) =>
    isMachineAssigned(machine) ? "assigned" : "un-assigned";

  const canShowAssignButton = (machine) => {
    if (isAdminStyleStockViewer) return true;
    if (isFranchiseUser) {
      return (
        String(machine?.assigned_to) === String(currentUser?.id) &&
        normalizeRoleValue(machine?.assigned_user?.role) === "franchise"
      );
    }
    if (isSuperFranchiseUser) {
      const assignedRole = normalizeRoleValue(machine?.assigned_user?.role);
      return (
        String(machine?.assigned_to) === String(currentUser?.id) &&
        (assignedRole === "super_franchise" || assignedRole === "superfranchise" || !assignedRole)
      );
    }
    return false;
  };

  const getMachineDisplayStatus = (machine) => {
    const rawStatus = String(machine?.status || "").trim().toLowerCase();

    if (isAdminStyleStockViewer) {
      return isMachineAssigned(machine) ? "active" : "inactive";
    }

    return rawStatus === "active" || rawStatus === "added" ? "active" : "inactive";
  };

  const companyFilteredMachines = useMemo(
    () => posMachines.filter((machine) => matchesCompanyTab(machine, normalizedCompanyTab)),
    [normalizedCompanyTab, posMachines]
  );

  const filteredStatsMachines = useMemo(
    () => statsMachines.filter((machine) => matchesCompanyTab(machine, normalizedCompanyTab)),
    [normalizedCompanyTab, statsMachines]
  );

  const filteredBackendSearchMachines = useMemo(
    () => backendSearchMachines.filter((machine) => matchesCompanyTab(machine, normalizedCompanyTab)),
    [backendSearchMachines, normalizedCompanyTab]
  );

  const bankFilteredMachines = useMemo(() => {
    const bankTerm = String(bankNameFilter || "").trim().toLowerCase();
    if (!bankTerm) return companyFilteredMachines;
    return companyFilteredMachines.filter((machine) =>
      String(machine.bank_name || "").trim().toLowerCase().includes(bankTerm)
    );
  }, [bankNameFilter, companyFilteredMachines]);

  const localSearchMachines = useMemo(() => {
    const term = String(searchTerm || "").trim().toLowerCase();
    if (!term) return bankFilteredMachines;

    const matches = bankFilteredMachines.filter((machine) => {
      const candidate = [
        machine.tid_number,
        machine.mid_number,
        machine.device_serial_number,
        machine.company_name,
        getMachineCompanyDisplayName(machine),
        machine.razorpay_id,
        machine.bank_name,
        machine.status,
      ]
        .filter(Boolean)
        .map((v) => String(v).toLowerCase());

      return candidate.some((value) => value.includes(term));
    });

    return matches;
  }, [searchTerm, bankFilteredMachines]);

  const serverPageRowCount = posMachines.length;
  const hasServerPageData = serverPageRowCount > 0;
  const [isBackendSearchLoading, setIsBackendSearchLoading] = useState(false);

  useEffect(() => {
    if (!showAssignModal) {
      setDebouncedAssignmentSearch("");
      return;
    }

    const debounceTimer = window.setTimeout(() => {
      setDebouncedAssignmentSearch(trimmedAssignmentSearch);
    }, 300);

    return () => {
      window.clearTimeout(debounceTimer);
    };
  }, [showAssignModal, trimmedAssignmentSearch]);

  useEffect(() => {
    if (!showAssignModal) {
      setAssignmentSearchResults([]);
      setAssignmentSearchError("");
      setIsAssignmentSearchLoading(false);
      return;
    }

    if (debouncedAssignmentSearch.length < ASSIGNMENT_REMOTE_SEARCH_MIN_LENGTH) {
      setAssignmentSearchResults([]);
      setAssignmentSearchError("");
      setIsAssignmentSearchLoading(false);
      return;
    }

    let didCancel = false;

    const loadAssignmentSearchResults = async () => {
      setIsAssignmentSearchLoading(true);
      setAssignmentSearchError("");

      try {
        const response = await searchUsers({
          q: debouncedAssignmentSearch,
          status: "active",
          role: assignmentEntityLabel === "franchise" ? "franchaise" : assignmentEntityLabel === "super_franchise" ? "super_franchise" : "merchant",
          page: 1,
          limit: ASSIGNMENT_REMOTE_SEARCH_LIMIT,
        });

        let results = dedupeAssignmentUsers(extractAssignmentUsers(response)).map(
          (user) => mapAssignmentUserWithRole(user, assignmentEntityLabel)
        );

        if (!isAdminUser) {
          if (isFranchiseUser) {
            const scopedFranchiseId = String(currentUser?.id ?? "");
            const hasFranchiseMetadata = results.some((user) => {
              const franchiseId = getAssignmentUserFranchiseId(user);
              return franchiseId !== null && franchiseId !== undefined && franchiseId !== "";
            });

            if (hasFranchiseMetadata) {
              results = results.filter(
                (user) => String(getAssignmentUserFranchiseId(user)) === scopedFranchiseId
              );
            }
          } else if (isSuperFranchiseUser) {
            const scopedSuperFranchiseId = String(currentUser?.id ?? "");
            results = results.filter((user) => {
              const uSfId =
                user?.super_franchise_id ??
                user?.superFranchiseId ??
                user?.super_franchise_details?.id ??
                (user?.parent_id ? String(user.parent_id) : null);
              return !uSfId || String(uSfId) === scopedSuperFranchiseId;
            });
          }
        }

        if (!didCancel) {
          setAssignmentSearchResults(results);
        }
      } catch (error) {
        if (!didCancel) {
          setAssignmentSearchResults([]);
          setAssignmentSearchError(
            error?.message ||
              `Failed to search ${assignmentEntityLabel === "franchise" ? "franchises" : "merchants"}`
          );
        }
      } finally {
        if (!didCancel) {
          setIsAssignmentSearchLoading(false);
        }
      }
    };

    loadAssignmentSearchResults();

    return () => {
      didCancel = true;
    };
  }, [
    assignmentEntityLabel,
    currentUser?.id,
    debouncedAssignmentSearch,
    isAdminUser,
    showAssignModal,
  ]);

  useEffect(() => {
    if (!searchTerm?.trim()) {
      setBackendSearchMachines([]);
      return;
    }

    if (localSearchMachines.length > 0) {
      setBackendSearchMachines([]);
      return;
    }

    let didCancel = false;

    const loadBackendSearch = async () => {
      setIsBackendSearchLoading(true);
      try {
        const resp = await getAllPosMachines({
          page: 1,
          limit: PAGE_SIZE,
          tidNumber: searchTerm.trim(),
          ...(companyQueryName ? { companyName: companyQueryName } : {}),
        });
        if (!didCancel) {
          const backendList = Array.isArray(resp?.data)
            ? resp.data
            : Array.isArray(resp?.data?.data)
            ? resp.data.data
            : [];

          setBackendSearchMachines(backendList);
        }
      } catch (err) {
        if (!didCancel) {
          setBackendSearchMachines([]);
          toast.error(err?.message || "Backend search failed");
        }
      } finally {
        if (!didCancel) {
          setIsBackendSearchLoading(false);
        }
      }
    };

    loadBackendSearch();

    return () => {
      didCancel = true;
    };
  }, [searchTerm, localSearchMachines.length, companyQueryName]);

  useEffect(() => {
    if (hasKnownUpperBound && serverPage > totalPages) {
      setServerPage(totalPages);
    }
  }, [hasKnownUpperBound, serverPage, totalPages]);

  useEffect(() => {
    if (!hasKnownUpperBound && !hasServerPageData && serverPage > 1) {
      setServerPage(1);
    }
  }, [hasKnownUpperBound, hasServerPageData, serverPage]);

  useEffect(() => {
    if (!companyOptions.length) return;

    setEditFormData((prev) => {
      const normalizedCurrent = normalizeCompanyToken(prev.company_name);
      const hasCurrentCompany = companyOptions.some(
        (company) => normalizeCompanyToken(company) === normalizedCurrent
      );

      if (normalizedCurrent && hasCurrentCompany) {
        return prev;
      }

      const nextCompanyName = selectedMachine
        ? resolveCompanyNameFromOptions(selectedMachine.company_name, companyOptions)
        : companyOptions[0];

      return {
        ...prev,
        company_name: nextCompanyName,
      };
    });
  }, [companyOptions, selectedMachine]);

  const handleSearch = () => {
    setSearchTerm(String(searchInput || "").trim());
    setUiPage(1);
  };

  const handleClearSearch = () => {
    setSearchInput("");
    setSearchTerm("");
    setBackendSearchMachines([]);
    setUiPage(1);
  };

  const handleTabSelect = (tab) => {
    setCompanyTab(tab);
    setBackendSearchMachines([]);
    setServerPage(1);
    setUiPage(1);
  };

  const handleEditClick = (machine) => {
    const newFormData = {
      tid_number: machine.tid_number || "",
      mid_number: machine.mid_number || "",
      device_serial_number: machine.device_serial_number || "",
      company_name: resolveCompanyNameFromOptions(machine.company_name, companyOptions),
      razorpay_id: machine.razorpay_id || "",
      bank_name: machine.bank_name || "",
    };
    logStockPosUi("Open edit machine modal", {
      machineId: machine?.id,
      machine,
    });
    setEditFormData(newFormData);
    setSelectedMachine(machine);
    setShowEditModal(true);
  };

  const handleDeleteClick = (machine) => {
    const confirmDelete = window.confirm(
      `Are you sure you want to delete POS machine #${machine.id}? This action cannot be undone.`
    );
    if (!confirmDelete) return;

    deleteMutation.mutate(machine.id);
  };

  const handleEditFormChange = (e) => {
    const { name, value } = e.target;
    setEditFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleEditSubmit = () => {
    if (selectedMachine) {
      logStockPosUi("Submit edit machine", {
        machineId: selectedMachine.id,
        payload: editFormData,
      });
      updateMutation.mutate({ id: selectedMachine.id, data: editFormData });
    }
  };

  const handleEditModalClose = () => {
    setShowEditModal(false);
    setSelectedMachine(null);
    setEditFormData({
      tid_number: "",
      mid_number: "",
      device_serial_number: "",
      company_name: companyOptions[0] || "",
      razorpay_id: "",
    });
  };

  const handleOpenCompanyModal = () => {
    logStockPosUi("Open add company modal", {});
    setCompanyDraftName("");
    setIsCompanyConfirmStep(false);
    setShowCompanyModal(true);
  };

  const handleCloseCompanyModal = () => {
    if (createCompanyMutation.isPending) return;

    logStockPosUi("Close add company modal", {
      step: isCompanyConfirmStep ? "confirm" : "entry",
    });
    setShowCompanyModal(false);
    setIsCompanyConfirmStep(false);
    setCompanyDraftName("");
  };

  const handleProceedCompanyConfirm = () => {
    const trimmedName = String(companyDraftName || "").trim();

    if (!trimmedName) {
      toast.error("Please enter a company name.");
      return;
    }

    const alreadyExists = companyOptions.some(
      (company) => normalizeCompanyToken(company) === normalizeCompanyToken(trimmedName)
    );
    if (alreadyExists) {
      toast.error(`Company name already exists: ${trimmedName}`);
      return;
    }

    logStockPosUi("Proceed company confirmation", {
      companyName: trimmedName,
    });
    setCompanyDraftName(trimmedName);
    setIsCompanyConfirmStep(true);
  };

  const handleConfirmCompanyCreate = () => {
    const trimmedName = String(companyDraftName || "").trim();
    if (!trimmedName) {
      toast.error("Please enter a company name.");
      return;
    }

    logStockPosUi("Confirm company create", {
      companyName: trimmedName,
    });
    createCompanyMutation.mutate(trimmedName);
  };

  const handleAssignClick = (machine) => {
    setAssignMachine(machine);
    setAssignUser(null);
    setAssignTargetType(
      isAdminStyleStockViewer
        ? "franchise"
        : isSuperFranchiseUser
          ? "franchise"
          : "merchant"
    );
    setShowAssignModal(true);
    fetchUsersForAssignment();
  };

  const handleAssignSubmit = () => {
    if (!assignMachine || !assignUser) return;
    const posId = assignMachine.id;

    const assignToFranchise =
      (isAdminStyleStockViewer || isSuperFranchiseUser) &&
      assignTargetType === "franchise";

    const assignToSuperFranchise =
      isAdminStyleStockViewer && assignTargetType === "super_franchise";

    const assignPromise = assignToFranchise
      ? assignPosMachineToFranchise([posId], assignUser.id)
      : assignToSuperFranchise
        ? assignPosMachineToSuperFranchise(posId, assignUser.id)
        : assignPosMachineToMerchant(posId, assignUser.id);

    assignPromise
      .then(() => {
        toast.success(
          `POS machine assigned to ${
            assignTargetType === "franchise"
              ? "Franchise"
              : assignTargetType === "super_franchise"
                ? "Super Franchise"
                : "Merchant"
          } successfully`
        );
        invalidateMachineViews();
        setShowAssignModal(false);
        setAssignMachine(null);
        setAssignUser(null);
      })
      .catch((e) => {
        toast.error(e?.message || "Failed to assign POS machine");
      });
  };

  const handleUnassign = () => {
    if (!assignMachine) return;

    const confirmed = window.confirm(
      `Are you sure you want to deassign POS #${assignMachine.id} from its current user?`
    );
    if (!confirmed) return;

    unassignPosMachine(assignMachine.id)
      .then(() => {
        toast.success("POS machine deassigned successfully");
        invalidateMachineViews();
        setShowAssignModal(false);
        setAssignMachine(null);
        setAssignUser(null);
      })
      .catch((e) => {
        console.error("Deassign failed", e);
        toast.error(
          e?.response?.data?.message || e?.message || "Failed to deassign POS machine"
        );
      });
  };

  const handleAssignModalClose = () => {
    setShowAssignModal(false);
    setAssignMachine(null);
    setAssignUser(null);
    setAssignmentSearchInput("");
    setDebouncedAssignmentSearch("");
    setAssignmentSearchResults([]);
    setAssignmentSearchError("");
    setIsAssignmentSearchLoading(false);
  };

  // Handle file selection for bulk upload
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    const fileName = String(file?.name || "").toLowerCase();
    const isValidFile =
      fileName.endsWith(".xlsx") ||
      fileName.endsWith(".xls");

    logStockPosUi("Bulk upload file selection", {
      fileName: file?.name || null,
      isValidFile,
    });

    if (file && isValidFile) {
      setBulkUploadFile(file);
      setBulkUploadResult(null); // Reset previous result
    } else {
      setBulkUploadResult({
        success: false,
        message: "Please upload a valid Excel file (.xlsx, .xls)",
        errors: [],
      });
      setBulkUploadFile(null);
    }
  };

  // Handle bulk upload submission
  const handleBulkUploadSubmit = () => {
    if (!companyRecords.length) {
      toast.error("No company names are available. Add company names before bulk upload.");
      return;
    }

    if (bulkUploadFile) {
      logStockPosUi("Bulk upload submit", {
        fileName: bulkUploadFile.name,
        companyCount: companyRecords.length,
      });
      bulkUploadMutation.mutate({
        file: bulkUploadFile,
        companyList: companyRecords,
      });
    }
  };

  // Close bulk upload modal and reset state
  const handleBulkUploadModalClose = () => {
    setShowBulkUploadModal(false);
    setBulkUploadFile(null);
    setBulkUploadResult(null);
  };

  const handleDownloadSampleFormat = () => {
    try {
      const headers = [["SL", "Company Name", "Device SL No", "TID", "MID", "Bank Name"]];
      const worksheet = XLSX.utils.aoa_to_sheet(headers);
      worksheet["!cols"] = [
        { wch: 8 },
        { wch: 20 },
        { wch: 20 },
        { wch: 18 },
        { wch: 18 },
        { wch: 18 },
      ];
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Bulk_Upload_Format");
      const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
      const blob = new Blob([excelBuffer], { type: "application/octet-stream" });
      saveAs(blob, "POS_Machine_Bulk_Upload_Format.xlsx");
      toast.success("Excel format downloaded successfully");
    } catch (error) {
      console.error("Format download failed", error);
      toast.error("Failed to download Excel format");
    }
  };

  const handleExportToExcel = () => {
    const exportData = effectiveMachines.map((machine, index) => ({
      "SL No": index + 1,
      "Company Name": getMachineCompanyDisplayName(machine),
      "Bank Name": machine.bank_name || "-",
      "Device Serial Number": machine.device_serial_number || "-",
      "TID Number": machine.tid_number || "-",
      "MID Number": machine.mid_number || "-",
      "Status": machine.status || "-",
      "Assigned Name": machine?.assigned_user?.name || "-",
      "Assigned Username": machine?.assigned_user?.username || machine?.assigned_user?.user_name || machine?.assigned_user?.userName || "-",
      "Assigned Mobile": machine?.assigned_user?.mobile_number || machine?.assigned_user?.mobile || machine?.assigned_user?.phone_number || "-",
      "Razorpay ID": machine.razorpay_id || "-",
      "Remarks": machine.remarks || "-",
      "Created At": machine.createdAt || machine?.created_at || "-",
      "Updated At": machine.updatedAt || machine?.updated_at || "-",
    }));

    if (!exportData.length) {
      toast.info("No POS machines available to export.");
      return;
    }

    setIsExporting(true);
    try {
      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "POS_Machines");
      const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
      const blob = new Blob([excelBuffer], { type: "application/octet-stream" });
      saveAs(blob, `POS_Machines_${new Date().getTime()}.xlsx`);
      toast.success("POS export started.");
    } catch (error) {
      console.error("POS export failed", error);
      toast.error("Failed to export POS machines.");
    } finally {
      setIsExporting(false);
    }
  };

  const redirectUrl = isFranchiseUser ? '/franchise/stock-pos/add' : '/admin/stock-pos/add';

  const effectiveMachines = useMemo(() => {
    if (!searchTerm?.trim()) return bankFilteredMachines;
    if (localSearchMachines.length > 0) return localSearchMachines;
    return filteredBackendSearchMachines.length > 0 ? filteredBackendSearchMachines : [];
  }, [searchTerm, localSearchMachines, filteredBackendSearchMachines, bankFilteredMachines]);

  const scopedMachines = searchTerm?.trim() ? effectiveMachines : bankFilteredMachines;

  const pageScopeLabel = searchTerm
    ? localSearchMachines.length > 0
      ? "Local search in 500"
      : "Backend search"
    : "This page";
  const pageRowsLabel = "Rows this page";

  const currentPageTotal = effectiveMachines.length;
  const currentPageActive = effectiveMachines.filter((m) => getMachineDisplayStatus(m) === "active").length;
  const currentPageInactive = effectiveMachines.filter((m) => getMachineDisplayStatus(m) !== "active").length;

  const headingMachines = filteredStatsMachines.length > 0 ? filteredStatsMachines : bankFilteredMachines;
  const totalMachinesValue = headingMachines.length;
  const totalActiveValue = headingMachines.filter((m) => getMachineDisplayStatus(m) === "active").length;
  const totalInactiveValue = headingMachines.filter((m) => getMachineDisplayStatus(m) !== "active").length;

  const totalUiPages = Math.max(1, Math.ceil(currentPageTotal / 50));

  const paginatedMachines = useMemo(() => {
    const start = (uiPage - 1) * 50;
    return effectiveMachines.slice(start, start + 50);
  }, [effectiveMachines, uiPage]);

  const goToPage = (nextPage) => {
    const safePage = Math.max(1, Math.min(totalUiPages, Number(nextPage) || 1));
    setUiPage(safePage);
  };

  const pageWindowStart = Math.floor((uiPage - 1) / PAGE_NUMBER_WINDOW) * PAGE_NUMBER_WINDOW + 1;
  const pageWindowEnd = Math.min(totalUiPages, pageWindowStart + PAGE_NUMBER_WINDOW - 1);

  const visiblePageNumbers = useMemo(() => {
    const pages = [];
    for (let i = pageWindowStart; i <= pageWindowEnd; i += 1) {
      pages.push(i);
    }
    return pages;
  }, [pageWindowStart, pageWindowEnd]);

  const canJumpBackTen = uiPage > 1;
  const canJumpForwardTen = uiPage < totalUiPages;

  // prepare user list when assign modal opens
  const fetchUsersForAssignment = async () => {
    setFetchingUsers(true);
    try {
      // normalize role value (backend sometimes returns 'franchaise')
      const rawRole = String(currentUser.role || "").trim().toLowerCase();
      const role = rawRole === "franchaise" ? "franchise" : rawRole;

      // admin: load both franchises and merchants (only those not under a franchise)
      if (isAdminStyleStockViewer) {
        const fetchAllUsers = async (fetcher, params = {}) => {
          const firstPage = await fetcher({
            page: 1,
            limit: ASSIGNMENT_USER_FETCH_LIMIT,
            ...params,
          });

          const firstRows = extractAssignmentUsers(firstPage);
          const totalPages = extractAssignmentTotalPages(firstPage);

          if (totalPages <= 1) {
            return dedupeAssignmentUsers(firstRows);
          }

          const remainingPages = await Promise.all(
            Array.from({ length: totalPages - 1 }, (_, index) =>
              fetcher({
                page: index + 2,
                limit: ASSIGNMENT_USER_FETCH_LIMIT,
                ...params,
              })
            )
          );

          return dedupeAssignmentUsers([
            ...firstRows,
            ...remainingPages.flatMap(extractAssignmentUsers),
          ]);
        };

        const [franList, superFranList, merchantList] = await Promise.all([
          fetchAllUsers(FranchiseAllUsers),
          fetchAllUsers(SuperFranchiseAllUsers),
          fetchAllUsers(MerchantAllUsers),
        ]);

        setAvailableFranchises(
          franList.map((u) => mapAssignmentUserWithRole(u, "franchise"))
        );
        setAvailableSuperFranchises(
          superFranList.map((u) => mapAssignmentUserWithRole(u, "super_franchise"))
        );
        setAvailableMerchants(
          merchantList.map((u) => mapAssignmentUserWithRole(u, "merchant"))
        );
      } else if (role === "super_franchise") {
        const fetchAllUsers = async (fetcher, params = {}) => {
          const firstPage = await fetcher({
            page: 1,
            limit: ASSIGNMENT_USER_FETCH_LIMIT,
            ...params,
          });

          const firstRows = extractAssignmentUsers(firstPage);
          const totalPages = extractAssignmentTotalPages(firstPage);

          if (totalPages <= 1) {
            return dedupeAssignmentUsers(firstRows);
          }

          const remainingPages = await Promise.all(
            Array.from({ length: totalPages - 1 }, (_, index) =>
              fetcher({
                page: index + 2,
                limit: ASSIGNMENT_USER_FETCH_LIMIT,
                ...params,
              })
            )
          );

          return dedupeAssignmentUsers([
            ...firstRows,
            ...remainingPages.flatMap(extractAssignmentUsers),
          ]);
        };

        const [franList, merchantList] = await Promise.all([
          fetchAllUsers(FranchiseAllUsers),
          fetchAllUsers(MerchantAllUsers),
        ]);

        setAvailableFranchises(
          franList.map((u) => mapAssignmentUserWithRole(u, "franchise"))
        );
        setAvailableMerchants(
          merchantList.map((u) => mapAssignmentUserWithRole(u, "merchant"))
        );
      } else if (role === "franchise") {
        const merchants = await MerchantAllUsers({
          franchiseId: currentUser.id,
          page: 1,
          limit: ASSIGNMENT_USER_FETCH_LIMIT,
        });
        const list = extractAssignmentUsers(merchants);
        const totalPages = extractAssignmentTotalPages(merchants);

        const extraPages =
          totalPages > 1
            ? await Promise.all(
                Array.from({ length: totalPages - 1 }, (_, index) =>
                  MerchantAllUsers({
                    franchiseId: currentUser.id,
                    page: index + 2,
                    limit: ASSIGNMENT_USER_FETCH_LIMIT,
                  })
                )
              )
            : [];

        setAvailableMerchants(
          dedupeAssignmentUsers([
            ...list,
            ...extraPages.flatMap(extractAssignmentUsers),
          ]).map((u) => mapAssignmentUserWithRole(u, "merchant"))
        );
      }
    } catch (err) {
      toast.error(err?.message || "Failed to fetch users");
      setAvailableFranchises([]);
      setAvailableMerchants([]);
      setAvailableSuperFranchises([]);
    } finally {
      setFetchingUsers(false);
    }
  };

  if (isLoading) {
    return <Loader />;
  }

  return (
    <div className="bg-gray-50 p-3 md:p-4">
      <div className="mx-auto">
        <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-6 md:mb-8">
          <h1 className="text-[30px] font-bold text-gray-900 leading-tight md:text-2xl">POS Machine Inventory</h1>
          <div className="w-full md:w-auto grid grid-cols-2 gap-3 md:flex md:flex-wrap md:gap-4">
            {isAdminStyleStockViewer && (
              <button
                onClick={handleOpenCompanyModal}
                className="w-full md:w-auto flex items-center justify-center gap-2 bg-[#00D3CD] text-white px-4 py-2 rounded-lg hover:bg-[#00bdb7] transition-colors"
              >
                <Plus className="w-5 h-5" />
                Add Company Name
              </button>
            )}
            {!isFranchiseUser && canManageStockModule && (
              <>
                <button
                  onClick={() => navigate(redirectUrl)}
                  className={`${isAdminStyleStockViewer ? "" : "col-span-2 "}w-full md:w-auto flex items-center justify-center gap-2 bg-[#00D3CD] text-white px-4 py-2 rounded-lg hover:bg-[#00bdb7] transition-colors`}
                >
                  <Plus className="w-5 h-5" />
                  Add New Machine
                </button>
              </>
            )}
            {isAdminStyleStockViewer && (
              <>
                <button
                  onClick={() => setShowBulkUploadModal(true)}
                  className="w-full md:w-auto flex items-center justify-center gap-2 bg-[#00D3CD] text-white px-4 py-2 rounded-lg hover:bg-[#00bdb7] transition-colors"
                >
                  <Upload className="w-5 h-5" />
                  Bulk Upload
                </button>
                <button
                  type="button"
                  onClick={handleExportToExcel}
                  disabled={isExporting}
                  className="w-full md:w-auto flex items-center justify-center gap-2 bg-[#2563EB] text-white px-4 py-2 rounded-lg hover:bg-[#1D4ED8] transition-colors disabled:opacity-50"
                >
                  {isExporting ? "Exporting..." : "Export Excel"}
                </button>
                <button
                  onClick={() => navigate('/admin/stock-pos/add-to-franchise')}
                  className="w-full md:w-auto flex items-center justify-center gap-2 bg-[#00D3CD] text-white px-4 py-2 rounded-lg hover:bg-[#00bdb7] transition-colors"
                >
                  <Plus className="w-5 h-5" />
                  Assign To Franchise
                </button>
              </>
            )}
          </div>
        </div>

        {/* Stats Section */}
        <div className={`grid grid-cols-1 ${isAdminStyleStockViewer ? "md:grid-cols-4" : "md:grid-cols-3"} gap-4 mb-6 md:mb-8`}>
          {isAdminStyleStockViewer && (
            <div className="rounded-xl p-3 text-white bg-[#14b8a6]">
              <h3 className="text-[1.05rem] font-semibold">Total Company</h3>
              <p className="mt-0.5 text-2xl font-bold leading-none">{companyOptions.length}</p>
              <div className="mt-1 flex items-center justify-between gap-3">
                <p className="text-xs text-white/90">Master company list</p>
                <button
                  type="button"
                  onClick={() => setShowCompanyListModal(true)}
                  disabled={!companyOptions.length}
                  className="inline-flex items-center gap-1 rounded-full border border-white/50 px-3 py-1 text-xs font-semibold text-white hover:bg-white/10 disabled:opacity-50"
                >
                  <Eye className="h-3.5 w-3.5" />
                  View
                </button>
              </div>
            </div>
          )}
          {[
            {
              label: "Total Machines",
              value: totalMachinesValue,
              pageValue: currentPageTotal,
              color: "bg-blue-500",
            },
            {
              label: "Total Active",
              value: totalActiveValue,
              pageValue: currentPageActive,
              color: "bg-green-500",
            },
            {
              label: "Total Inactive",
              value: totalInactiveValue,
              pageValue: currentPageInactive,
              color: "bg-red-500",
            },
          ].map((stat, index) => (
            <div key={index} className={`${stat.color} rounded-xl p-3 text-white`}>
              <h3 className="text-[1.05rem] font-semibold">{stat.label}</h3>
              <p className="mt-0.5 text-2xl font-bold leading-none">{stat.value}</p>
              <p className="mt-1 text-xs text-white/90">{pageScopeLabel}: {stat.pageValue}</p>
            </div>
          ))}
        </div>

        {/* Company Tabs */}
        <div className="mb-4 flex gap-2">
          {COMPANY_TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => handleTabSelect(tab)}
              className={`px-4 py-2 rounded-lg font-medium ${
                companyTab === tab ? 'bg-[#00D3CD] text-white' : 'bg-white text-gray-700 border border-gray-300'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Search Section */}
        <div className="mb-6 space-y-2">
          <div className="flex flex-col md:flex-row md:items-center md:gap-2">
            <input
              type="text"
              placeholder="Search by TID, MID, serial, status, RazorPay ID..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full md:w-72 rounded-lg border border-gray-300 px-3 py-2 text-sm"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleSearch();
                }
              }}
            />
            <input
              type="text"
              placeholder="Bank Name"
              value={bankNameFilter}
              onChange={(e) => setBankNameFilter(e.target.value)}
              className="w-full md:w-56 rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={handleSearch}
              className="bg-[#00D3CD] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#00bdb7]"
            >
              Search
            </button>
            <button
              type="button"
              onClick={handleClearSearch}
              className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-300"
            >
              Clear
            </button>
          </div>
          {searchTerm && !localSearchMachines.length && isBackendSearchLoading && (
            <p className="text-sm text-gray-500">Searching backend for "{searchTerm}" ...</p>
          )}
          {searchTerm && !localSearchMachines.length && !isBackendSearchLoading && filteredBackendSearchMachines.length > 0 && (
            <p className="text-sm text-gray-500">Showing backend search results for "{searchTerm}" ({filteredBackendSearchMachines.length} found)</p>
          )}
          {searchTerm && localSearchMachines.length > 0 && (
            <p className="text-sm text-gray-500">Showing local search results for "{searchTerm}" ({localSearchMachines.length} within current 500)</p>
          )}
        </div>

        {companyNamesError && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {companyNamesError.message || "Unable to load company names."}
          </div>
        )}

        {/* Mobile Cards */}
        <div className="md:hidden space-y-3">
          {paginatedMachines.map((machine, index) => {
            const serialNumber = (uiPage - 1) * 50 + index + 1;
            const assignmentStatusLabel = getAssignmentStatusLabel(machine);
            return (
              <div key={machine.id} className="bg-white rounded-xl shadow-sm p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-gray-900">SL {serialNumber}</p>
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-semibold ${getStatusBadgeColor(
                      assignmentStatusLabel
                    )}`}
                  >
                    {assignmentStatusLabel}
                  </span>
                </div>

              <div className="grid grid-cols-1 gap-2 text-sm">
                <p className="text-gray-700"><span className="font-medium">Company:</span> {getMachineCompanyDisplayName(machine)}</p>
                <p className="text-gray-700"><span className="font-medium">Bank:</span> {machine.bank_name || "-"}</p>
                <p className="text-gray-700"><span className="font-medium">Device Serial:</span> {machine.device_serial_number || "-"}</p>
                <p className="text-gray-700"><span className="font-medium">TID:</span> {machine.tid_number || "-"}</p>
                <p className="text-gray-700"><span className="font-medium">MID:</span> {machine.mid_number || "-"}</p>
                <div className="text-gray-700">
                  <span className="font-medium">Franchise:</span>
                  <div>{getFranchiseDisplayName(machine)}</div>
                  {getAssignmentUserRole(machine?.assigned_user) === "franchise" && (
                    <div className="text-xs text-gray-500">
                      {getAssignmentUserUsername(machine?.assigned_user) || ""}
                      {getAssignmentUserUsername(machine?.assigned_user) && getAssignmentUserMobile(machine?.assigned_user) ? " | " : ""}
                      {getAssignmentUserMobile(machine?.assigned_user) || ""}
                    </div>
                  )}
                </div>
                <div className="text-gray-700">
                  <span className="font-medium">Assign To:</span>
                  {machine?.assigned_to ? (
                    <>
                      <div>{machine?.assigned_user?.name || "(unknown)"}</div>
                      <div className="text-xs text-gray-500">
                        {getAssignmentUserUsername(machine?.assigned_user) || ""}
                        {getAssignmentUserUsername(machine?.assigned_user) && getAssignmentUserMobile(machine?.assigned_user) ? " | " : ""}
                        {getAssignmentUserMobile(machine?.assigned_user) || machine?.assigned_to || ""}
                      </div>
                    </>
                  ) : (
                    " - "
                  )}
                </div>
              </div>

              <div className="flex flex-col items-start gap-2 pt-1">
                <div className="flex flex-wrap gap-2">
                  {canShowAssignButton(machine) && (
                    <button
                      onClick={() => handleAssignClick(machine)}
                      className="px-2 py-1 font-semibold text-indigo-600 hover:bg-indigo-200 flex gap-1 items-center border border-indigo-600 rounded-full text-xs"
                      title="Assign"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Assign</span>
                    </button>
                  )}
                  {canManageStockModule && (
                    <button
                      onClick={() => handleEditClick(machine)}
                      className="px-2 py-1 font-semibold text-blue-600 hover:bg-blue-200 flex gap-1 items-center border border-blue-600 rounded-full text-xs"
                      title="Edit"
                    >
                      <Edit2 className="w-4 h-4" />
                      <span>Edit</span>
                    </button>
                  )}
                </div>
                {canManageStockModule && (
                  <div className="flex">
                    <button
                      onClick={() => handleDeleteClick(machine)}
                      disabled={deleteMutation.isLoading}
                      className="px-2 py-1 font-semibold text-red-600 hover:bg-red-200 flex gap-1 items-center border border-red-600 rounded-full text-xs disabled:opacity-50"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>Delete</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
          {paginatedMachines.length === 0 && (
            <div className="bg-white rounded-xl shadow-sm p-6 text-center text-sm text-gray-500">
              No POS machines found.
            </div>
          )}
        </div>

        {/* POS Machines Table */}
        <div className="hidden md:block bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    SL no.
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Company Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Bank Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Device Serial Number
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    TID Number
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    MID Number
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Franchise Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Assign To
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {paginatedMachines.map((machine, index) => {
                  const serialNumber = (uiPage - 1) * 50 + index + 1;
                  const assignmentStatusLabel = getAssignmentStatusLabel(machine);
                  return (
                    <tr key={machine.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">{serialNumber}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{getMachineCompanyDisplayName(machine)}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{machine.bank_name || "-"}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{machine.device_serial_number}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{machine.tid_number}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{machine.mid_number}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-semibold ${getStatusBadgeColor(
                          assignmentStatusLabel
                        )}`}
                      >
                        {assignmentStatusLabel}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap align-middle">
                      <div className="flex flex-col items-center gap-2">
                        <div className="flex justify-center gap-2">
                          {canShowAssignButton(machine) && (
                            <button
                              onClick={() => handleAssignClick(machine)}
                              className="px-2 py-0.5 font-semibold text-indigo-600 hover:bg-indigo-200 flex gap-0.5 items-center border border-indigo-600 rounded-full text-xs"
                              title="Assign"
                            >
                              <Plus className="w-5 h-5" />
                              <span>Assign</span>
                            </button>
                          )}
                          {canManageStockModule && (
                            <button
                              onClick={() => handleEditClick(machine)}
                              className="px-2 py-0.5 font-semibold text-blue-600 hover:bg-blue-200 flex gap-0.5 items-center border border-blue-600 rounded-full text-xs"
                              title="Edit"
                            >
                              <Edit2 className="w-5 h-5" />
                              <span>Edit</span>
                            </button>
                          )}
                        </div>

                        {canManageStockModule && (
                          <div className="flex justify-center gap-2">
                            <button
                              onClick={() => handleDeleteClick(machine)}
                              disabled={deleteMutation.isLoading}
                              className="px-2 py-0.5 font-semibold text-red-600 hover:bg-red-200 flex gap-0.5 items-center border border-red-600 rounded-full text-xs disabled:opacity-50"
                              title="Delete"
                            >
                              <Trash2 className="w-5 h-5" />
                              <span>Delete</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                    <td>
                      <div className="text-center text-sm">
                        <div>{getFranchiseDisplayName(machine)}</div>
                        {getAssignmentUserRole(machine?.assigned_user) === "franchise" && (
                          <div className="text-xs text-gray-500">
                            {getAssignmentUserUsername(machine?.assigned_user) || ""}
                            {getAssignmentUserUsername(machine?.assigned_user) && getAssignmentUserMobile(machine?.assigned_user) ? " | " : ""}
                            {getAssignmentUserMobile(machine?.assigned_user) || ""}
                          </div>
                        )}
                      </div>
                    </td>
                    <td>
                      <div className="text-center text-sm">
                        {machine?.assigned_to ? (
                          <>
                            <div>{machine?.assigned_user?.name || "(unknown)"}</div>
                            <div className="text-xs text-gray-500">
                              {getAssignmentUserUsername(machine?.assigned_user) || ""}
                              {getAssignmentUserUsername(machine?.assigned_user) && getAssignmentUserMobile(machine?.assigned_user) ? " | " : ""}
                              {getAssignmentUserMobile(machine?.assigned_user) || machine?.assigned_to || ""}
                            </div>
                          </>
                        ) : (
                          "-"
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <p className="text-sm text-gray-600">
            Page {uiPage} of {totalUiPages} | {pageRowsLabel}: {currentPageTotal}
            {isFetching || isBackendSearchLoading ? " | Updating..." : ""}
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => goToPage(uiPage - 1)}
              disabled={uiPage <= 1 || isFetching || isBackendSearchLoading}
              className="px-3 py-1.5 rounded-md border border-gray-300 text-sm text-gray-700 disabled:opacity-50"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => goToPage(uiPage - PAGE_NUMBER_WINDOW)}
              disabled={!canJumpBackTen || isFetching || isBackendSearchLoading}
              className="px-3 py-1.5 rounded-md border border-gray-300 text-sm text-gray-700 disabled:opacity-50"
              title="Jump 10 pages back"
            >
              -10
            </button>
            {visiblePageNumbers.map((pageNumber) => (
              <button
                type="button"
                key={pageNumber}
                onClick={() => goToPage(pageNumber)}
                disabled={isFetching || isBackendSearchLoading}
                className={`px-3 py-1.5 rounded-md text-sm border ${
                  pageNumber === uiPage
                    ? "bg-[#00D3CD] text-white border-[#00D3CD]"
                    : "border-gray-300 text-gray-700"
                }`}
              >
                {pageNumber}
              </button>
            ))}
            <button
              type="button"
              onClick={() => goToPage(uiPage + PAGE_NUMBER_WINDOW)}
              disabled={!canJumpForwardTen || isFetching || isBackendSearchLoading}
              className="px-3 py-1.5 rounded-md border border-gray-300 text-sm text-gray-700 disabled:opacity-50"
              title="Jump 10 pages forward"
            >
              +10
            </button>
            <button
              type="button"
              onClick={() => goToPage(uiPage + 1)}
              disabled={uiPage >= totalUiPages || isFetching || isBackendSearchLoading}
              className="px-3 py-1.5 rounded-md border border-gray-300 text-sm text-gray-700 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>

        <Modal
          isOpen={showCompanyListModal}
          onClose={() => setShowCompanyListModal(false)}
          title="Company Name List"
          className="max-w-xl"
        >
          <div className="space-y-4">
            <div className="rounded-lg bg-gray-50 px-4 py-3 text-sm text-gray-700">
              Total Companies: <span className="font-semibold">{companyOptions.length}</span>
            </div>
            <div className="max-h-[50vh] overflow-y-auto rounded-lg border border-gray-200">
              {companyOptions.length ? (
                <ul className="divide-y divide-gray-200">
                  {companyOptions.map((company) => (
                    <li key={company} className="px-4 py-3 text-sm text-gray-800">
                      {company}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="px-4 py-6 text-center text-sm text-gray-500">
                  No company names available.
                </p>
              )}
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setShowCompanyListModal(false)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>

        <Modal
          isOpen={showCompanyModal}
          onClose={handleCloseCompanyModal}
          title={isCompanyConfirmStep ? "Confirm Company Name" : "Add Company Name"}
          className="max-w-lg"
        >
          {isCompanyConfirmStep ? (
            <div className="space-y-4">
              <p className="text-sm text-gray-700">
                Are you sure you want to add this company name:{" "}
                <span className="font-semibold text-gray-900">{companyDraftName}</span>
              </p>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCompanyConfirmStep(false)}
                  disabled={createCompanyMutation.isPending}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleConfirmCompanyCreate}
                  disabled={createCompanyMutation.isPending}
                  className="rounded-lg bg-[#00D3CD] px-4 py-2 text-sm font-medium text-white hover:bg-[#00bdb7] disabled:opacity-50"
                >
                  {createCompanyMutation.isPending ? "Saving..." : "Yes, Add Company"}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <FormInput
                type="text"
                name="company_name"
                placeholder="Enter company name"
                value={companyDraftName}
                onChange={(e) => setCompanyDraftName(e.target.value)}
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={handleCloseCompanyModal}
                  disabled={createCompanyMutation.isPending}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleProceedCompanyConfirm}
                  disabled={createCompanyMutation.isPending}
                  className="rounded-lg bg-[#00D3CD] px-4 py-2 text-sm font-medium text-white hover:bg-[#00bdb7] disabled:opacity-50"
                >
                  Continue
                </button>
              </div>
            </div>
          )}
        </Modal>

        {/* Bulk Upload Modal */}
        <Modal
          isOpen={showBulkUploadModal}
          onClose={handleBulkUploadModalClose}
          title="Bulk Upload POS Machines"
          className="max-w-3xl max-h-[90vh] flex flex-col"
        >
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1 scrollbar-hide [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
              <div className="bg-yellow-50 border-l-4 border-yellow-400 p-3.5 rounded-r-lg">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-yellow-800">
                      Required Excel Format
                    </p>
                    <p className="text-sm text-yellow-700 mt-1 font-mono bg-yellow-100 p-2 rounded">
                      SL, Company Name, Device SL No, TID, MID, Bank Name
                    </p>
                    <p className="text-xs text-red-600 mt-1.5">
                      Only this exact header format/order is accepted for bulk upload.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleDownloadSampleFormat}
                    className="shrink-0 inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#00D3CD] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#00bdb7] transition-all shadow-sm active:scale-95"
                  >
                    <Download className="w-4 h-4" />
                    Download Format
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Upload Excel File
                </label>
                <input
                  type="file"
                  accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                  onChange={handleFileChange}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-[#00D3CD] file:text-white hover:file:bg-[#00bdb7]"
                />
                {!companyOptions.length && (
                  <p className="mt-2 text-xs text-amber-700">
                    Add at least one company name before bulk upload.
                  </p>
                )}
              </div>
              {bulkUploadResult && (
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className={`text-sm font-medium ${bulkUploadResult.success ? "text-green-600" : "text-red-600"}`}>
                    {bulkUploadResult.message}
                  </p>
                  {bulkUploadResult.created?.length > 0 && (
                    <div className="mt-2">
                      <p className="text-sm font-medium text-gray-700">Created Machines:</p>
                      <ul className="list-disc pl-5 text-sm text-gray-600">
                        {bulkUploadResult.created.map((machine, index) => (
                          <li key={index}>
                            Company: {machine.company_name || "-"}, TID: {machine.tid_number}, MID: {machine.mid_number}, Serial: {machine.device_serial_number}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {bulkUploadResult.errors?.length > 0 && (
                    <div className="mt-2">
                      <p className="text-sm font-medium text-gray-700">Errors:</p>
                      <ul className="list-disc pl-5 text-sm text-red-600">
                        {bulkUploadResult.errors.map((error, index) => (
                          <li key={index}>
                            Row (Company: {error.row?.company_name || "-"}, Bank: {error.row?.bank_name || "-"}, TID: {error.row?.tid_number || "-"}, MID: {error.row?.mid_number || "-"}): {error.error}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="mt-3 flex shrink-0 justify-end gap-2 border-t border-gray-200 pt-2">
              <button
                onClick={handleBulkUploadModalClose}
                className="px-3.5 py-1.5 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100 transition-colors"
              >
                Close
              </button>
              <button
                onClick={handleBulkUploadSubmit}
                disabled={!bulkUploadFile || bulkUploadMutation.isPending || !companyOptions.length}
                className="bg-[#00D3CD] text-white px-3.5 py-1.5 text-sm rounded-lg hover:bg-[#00bdb7] transition-colors disabled:opacity-50"
              >
                {bulkUploadMutation.isPending ? "Uploading..." : "Upload Excel"}
              </button>
            </div>
          </div>
        </Modal>

        {/* Assign POS Machine Modal */}
        <Modal
          isOpen={showAssignModal}
          onClose={handleAssignModalClose}
          title={assignMachine ? `Assign POS #${assignMachine.id}` : "Assign POS"}
          className="max-w-[45rem]"
        >
          <div className="flex min-h-[33rem] flex-col space-y-5">
            {assignMachine && (
              <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-3">
                <div className="rounded-xl bg-white px-4 py-3 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">TID</p>
                  <p className="mt-2 break-all text-base font-semibold text-slate-900">
                    {assignMachine.tid_number || "-"}
                  </p>
                </div>
                <div className="rounded-xl bg-white px-4 py-3 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">MID</p>
                  <p className="mt-2 break-all text-base font-semibold text-slate-900">
                    {assignMachine.mid_number || "-"}
                  </p>
                </div>
                <div className="rounded-xl bg-white px-4 py-3 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Serial</p>
                  <p className="mt-2 break-all text-base font-semibold text-slate-900">
                    {assignMachine.device_serial_number || "-"}
                  </p>
                </div>
              </div>
            )}
            {(isAdminStyleStockViewer || isSuperFranchiseUser) && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-700">Assign To</p>
                <div className="flex flex-wrap gap-3">
                  {isAdminStyleStockViewer && (
                    <label className="inline-flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="assignType"
                        value="super_franchise"
                        checked={assignTargetType === "super_franchise"}
                        onChange={() => {
                          setAssignTargetType("super_franchise");
                          setAssignUser(null);
                          setAssignmentSearchInput("");
                          setDebouncedAssignmentSearch("");
                          setAssignmentSearchResults([]);
                          setAssignmentSearchError("");
                        }}
                        className="h-4 w-4 text-[#00D3CD] border-gray-300"
                      />
                      <span className="text-sm">Super Franchise</span>
                    </label>
                  )}
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="assignType"
                      value="franchise"
                      checked={assignTargetType === "franchise"}
                      onChange={() => {
                        setAssignTargetType("franchise");
                        setAssignUser(null);
                        setAssignmentSearchInput("");
                        setDebouncedAssignmentSearch("");
                        setAssignmentSearchResults([]);
                        setAssignmentSearchError("");
                      }}
                      className="h-4 w-4 text-[#00D3CD] border-gray-300"
                    />
                    <span className="text-sm">Franchise</span>
                  </label>
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="assignType"
                      value="merchant"
                      checked={assignTargetType === "merchant"}
                      onChange={() => {
                        setAssignTargetType("merchant");
                        setAssignUser(null);
                        setAssignmentSearchInput("");
                        setDebouncedAssignmentSearch("");
                        setAssignmentSearchResults([]);
                        setAssignmentSearchError("");
                      }}
                      className="h-4 w-4 text-[#00D3CD] border-gray-300"
                    />
                    <span className="text-sm">Merchant</span>
                  </label>
                </div>
              </div>
            )}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Select {assignmentEntityLabel === "franchise" ? "Franchise" : assignmentEntityLabel === "super_franchise" ? "Super Franchise" : "Merchant"}
                  </label>
                  
                </div>
                <span className="inline-flex w-fit items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                  {assignmentUserOptions.length} option{assignmentUserOptions.length === 1 ? "" : "s"}
                </span>
              </div>
                <Select
                options={assignmentUserOptions}
                value={selectedAssignmentOption}
                onChange={(opt) => {
                  if (!opt) {
                    setAssignUser(null);
                    return;
                  }
                  const u = availableUsers.find((u) => String(u.id) === String(opt.value));
                  setAssignUser(u);
                }}
                placeholder={`Search ${assignmentEntityLabel}...`}
                isClearable
                className="basic-single"
                classNamePrefix="select"
                isLoading={fetchingUsers || isAssignmentSearchLoading}
                styles={assignmentSelectStyles}
                formatOptionLabel={(option) => (
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">
                        {option.name}
                      </p>
                      <p className="truncate text-xs text-slate-500">
                        {option.mobile || "Mobile not available"}
                      </p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide text-slate-600">
                      {option.role === "franchise" ? "Franchise" : option.role === "super_franchise" ? "Super Franchise" : "Merchant"}
                    </span>
                  </div>
                )}
                noOptionsMessage={() => {
                  if (fetchingUsers) return "Loading users...";
                  if (isAssignmentSearchLoading) return `Searching ${assignmentEntityLabel}s...`;
                  if (
                    trimmedAssignmentSearch &&
                    trimmedAssignmentSearch.length < ASSIGNMENT_REMOTE_SEARCH_MIN_LENGTH
                  ) {
                    return `Keep typing to search all ${assignmentEntityLabel}s`;
                  }
                  if (assignmentSearchError) return assignmentSearchError;
                  return `No ${assignmentEntityLabel}s found`;
                }}
              />
              {assignmentSearchError && (
                <p className="mt-2 text-xs text-red-600">{assignmentSearchError}</p>
              )}
              {assignUser && (
                <p className="mt-2 text-xs text-gray-600">
                  This user currently has <span className="font-semibold">{assignedMachineCount}</span> POS machine{assignedMachineCount === 1 ? "" : "s"} assigned.
                </p>
              )}
            </div>
            <div className="mt-auto flex flex-col gap-2 pt-2">
              <button
                onClick={handleAssignSubmit}
                disabled={!assignUser || !assignMachine}
                className="w-full bg-[#00D3CD] text-white py-2 rounded-lg hover:bg-[#00bdb7] transition-colors disabled:opacity-50"
              >
                Assign
              </button>
              {(isAdminStyleStockViewer || isSuperFranchiseUser) && assignMachine?.assigned_to && (
                <button
                  onClick={handleUnassign}
                  className="w-full bg-red-600 text-white py-2 rounded-lg hover:bg-red-700 transition-colors flex items-center justify-center gap-2"
                >
                  <X className="w-4 h-4" />
                  Deassign
                </button>
              )}
            </div>
          </div>
        </Modal>

        {/* Existing Modals (unchanged) */}
        <Modal
          isOpen={showDeliveryModal}
          onClose={() => setShowDeliveryModal(false)}
          title="Mark POS Machine as Delivered"
        >
          <div className="space-y-4">
            <FormInput
              type="text"
              name="device_serial_number"
              placeholder="Enter Serial Number"
              value={selectedMachine?.device_serial_number || ""}
              onChange={(e) => {
                const machine = posMachines?.find(
                  (m) => m.device_serial_number === e.target.value
                );
                setSelectedMachine(machine || null);
              }}
            />
            <button
              onClick={() => selectedMachine && deliverMutation.mutate(selectedMachine.id)}
              disabled={!selectedMachine || deliverMutation.isPending}
              className="w-full bg-[#00D3CD] text-white py-2 rounded-lg hover:bg-[#00bdb7] transition-colors disabled:opacity-50"
            >
              {deliverMutation.isPending ? "Processing..." : "Mark as Delivered"}
            </button>
          </div>
        </Modal>

        <Modal
          isOpen={showReturnModal}
          onClose={() => setShowReturnModal(false)}
          title="Mark POS Machine Return"
        >
          <div className="space-y-4">
            {selectedMachine && (
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm text-gray-500">Serial Number</p>
                <p className="font-medium">{selectedMachine.device_serial_number}</p>
              </div>
            )}
            <FormInput
              type="text"
              name="remarks"
              placeholder="Enter Return Remarks"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
            />
            <button
              onClick={() =>
                selectedMachine && returnMutation.mutate({ id: selectedMachine.id, remarks })
              }
              disabled={!selectedMachine || !remarks || returnMutation.isPending}
              className="w-full bg-[#00D3CD] text-white py-2 rounded-lg hover:bg-[#00bdb7] transition-colors disabled:opacity-50"
            >
              {returnMutation.isPending ? "Processing..." : "Mark Return Initiated"}
            </button>
          </div>
        </Modal>

        <Modal
          isOpen={showEditModal}
          onClose={handleEditModalClose}
          title="Edit POS Machine"
        >
          <div className="space-y-4">
            <FormInput
              type="text"
              name="tid_number"
              placeholder="TID Number"
              value={editFormData.tid_number}
              onChange={handleEditFormChange}
            />
            <FormInput
              type="text"
              name="mid_number"
              placeholder="MID Number"
              value={editFormData.mid_number}
              onChange={handleEditFormChange}
            />
            <FormInput
              type="text"
              name="device_serial_number"
              placeholder="Serial Number"
              value={editFormData.device_serial_number}
              onChange={handleEditFormChange}
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Company Name
              </label>
              <select
                name="company_name"
                value={editFormData.company_name}
                onChange={handleEditFormChange}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white disabled:bg-gray-100"
                disabled={isCompanyNamesLoading || !companyOptions.length}
              >
                {!companyOptions.length ? (
                  <option value="">
                    {isCompanyNamesLoading ? "Loading company names..." : "No company names available"}
                  </option>
                ) : (
                  companyOptions.map((company) => (
                    <option key={company} value={company}>
                      {company}
                    </option>
                  ))
                )}
              </select>
            </div>
            <FormInput
              type="text"
              name="razorpay_id"
              placeholder="RazorPay ID"
              value={editFormData.razorpay_id}
              onChange={handleEditFormChange}
            />
            <FormInput
              type="text"
              name="bank_name"
              placeholder="Bank Name (Optional)"
              value={editFormData.bank_name}
              onChange={handleEditFormChange}
            />
            <button
              onClick={handleEditSubmit}
              disabled={updateMutation.isPending || !companyOptions.length}
              className="w-full bg-[#00D3CD] text-white py-2 rounded-lg hover:bg-[#00bdb7] transition-colors disabled:opacity-50"
            >
              {updateMutation.isPending ? "Updating..." : "Update POS Machine"}
            </button>
          </div>
        </Modal>
      </div>
    </div>
  );
};

export default StockPOSMachine;
