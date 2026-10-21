import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  getSuperFranchises,
  getSuperFranchiseRates,
  updateSuperFranchiseRate,
  getAllSuperFranchiseRates,
  getFranchises,
  getFranchiseRates,
  updateFranchiseRate,
  getAllFranchiseRates,
  createDefaultFranchiseRate,
  deleteDefaultPOSRate,
  getGlobalPOSRate,
  updateGlobalPOSRate,
  getUnassignedMerchants,
  getMerchantRates,
  updateMerchantRate,
  getAllMerchantRates,
} from '../api/rateSettingsApi';
import {
  fetchMyAdminApplicableCharges,
  listBbpsChargeRules,
  createBbpsChargeRule,
  updateBbpsChargeRule,
  deleteBbpsChargeRule,
  fetchApplicableCcBillRulesForUser,
  createUserPayoutCharge,
  updateUserPayoutCharge,
  deleteUserPayoutCharge,
  fetchApplicableUserPayoutCharges,
  listPosRentals,
  createPosRental,
  updatePosRental,
  createPlatformDefaultPosRule,
  updatePlatformDefaultPosRule,
  deletePlatformDefaultPosRule,
  fetchPlatformDefaultPosRules,
  fetchSuperAdminAdminsPosMatrix,
  fetchAdminPosRules,
  createAdminPosRule,
  updateAdminPosRule,
  deleteAdminPosRule,
  mapRuleToAdminFormat,
  buildAdminEffectiveRules,
  fetchSuperAdminRentalRates,
  createSuperAdminRentalRate,
  updateSuperAdminRentalRate,
  deleteSuperAdminRentalRate,
  fetchSuperAdminCcBillRules,
  createSuperAdminCcBillRule,
  updateSuperAdminCcBillRule,
  deleteSuperAdminCcBillRule,
  fetchSuperAdminPayoutRules,
  createSuperAdminPayoutRule,
  updateSuperAdminPayoutRule,
  deleteSuperAdminPayoutRule,
  getSuperAdminGlobalPosRate,
  updateSuperAdminGlobalPosRate,
} from '../api/rateSettingsApi';
import { getAdminList } from '../api/superAdminApi';
import { FranchiseAllUsers, MerchantAllUsers, SuperFranchiseAllUsers, searchUsers } from '../api/FranchiseApi';
import {
  Loader2,
  Plus,
  Edit2,
  Trash2,
  RotateCcw,
  CheckCircle2,
  ShieldCheck,
  Layers,
  Info,
  User,
  Building2,
  Search,
  X,
  AlertCircle,
  Lock,
  Sliders,
} from 'lucide-react';

import Loader from '../components/Loader';
import { toast } from 'react-toastify';

const INITIAL_NEW_RATE_FORM = {
  method: 'CARD',
  network: 'VISA',
  cardType: 'CREDIT',
  cardClassification: 'ANY',
  settlementType: '',
  minAmount: '0',
  maxAmount: '',
  chargePercent: '',
  chargeFlat: '',
  gstRequired: false,
  gstPercent: '18',
  companyName: '',
};
const DEFAULT_SPECIFIC_SETTLEMENT_FILTER = 'all';

const extractSearchUsersArray = (payload) => {
  const candidates = [
    payload?.data,
    payload?.users,
    payload?.data?.users,
    payload?.data?.data,
    payload,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate;
    }
  }

  return [];
};

const getSearchEntityFranchiseId = (entity) =>
  entity?.franchaise_id ?? entity?.franchise_id ?? entity?.franchiseId ?? null;

const AdminRateSetting = ({ mode = 'full', initialTab = 'specific', isSuperAdmin = false }) => {
  const location = useLocation();
  const isPosTxnMode = mode === 'pos_txn';
  const effectiveInitialTab = isSuperAdmin ? 'default' : initialTab;
  const [activeTab, setActiveTab] = useState(effectiveInitialTab); // 'default' | 'specific' | 'unassigned' | 'rental' | 'cc_bill' | 'payout'
  const [viewMode, setViewMode] = useState(effectiveInitialTab === 'default' ? 'detail' : 'matrix'); // 'matrix' or 'detail'
  const [specificSettlementFilter, setSpecificSettlementFilter] = useState(DEFAULT_SPECIFIC_SETTLEMENT_FILTER);

  useEffect(() => {
    const tabToSet = isSuperAdmin ? 'default' : initialTab;
    setActiveTab(tabToSet);
    setViewMode(tabToSet === 'default' ? 'detail' : 'matrix');
    setSpecificSettlementFilter(DEFAULT_SPECIFIC_SETTLEMENT_FILTER);
  }, [initialTab, isSuperAdmin]);

  useEffect(() => {
    if (isSuperAdmin && ['super_franchise', 'unassigned'].includes(activeTab)) {
      setActiveTab('default');
      setViewMode('detail');
    }
  }, [isSuperAdmin, activeTab]);

  const [superFranchises, setSuperFranchises] = useState([]);
  const [franchises, setFranchises] = useState([]);
  const [unassignedMerchants, setUnassignedMerchants] = useState([]);
  const [selectedSuperFranchiseId, setSelectedSuperFranchiseId] = useState('');
  const [selectedFranchiseId, setSelectedFranchiseId] = useState('');
  const [selectedAdminId, setSelectedAdminId] = useState('');
  const [selectedMerchantId, setSelectedMerchantId] = useState('');
  const [rates, setRates] = useState([]);
  const [superFranchiseMatrixData, setSuperFranchiseMatrixData] = useState({}); // { superFranchiseId: [rates] }
  const [matrixData, setMatrixData] = useState({}); // { franchiseId: [rates] }
  const [unassignedMerchantMatrixData, setUnassignedMerchantMatrixData] = useState({}); // { merchantId: [rates] }
  const [defaultRatesAttributes, setDefaultRatesAttributes] = useState([]); // structure of columns
  const [defaultPagination, setDefaultPagination] = useState({
    total: 0,
    page: 1,
    limit: 100,
    totalPages: 1
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [matrixSearchResults, setMatrixSearchResults] = useState([]);
  const [matrixSearchLoading, setMatrixSearchLoading] = useState(false);
  const [matrixSearchError, setMatrixSearchError] = useState('');
  const [matrixPage, setMatrixPage] = useState(1);
  const [matrixRowsPerPage, setMatrixRowsPerPage] = useState(20);

  const [loading, setLoading] = useState(false);
  const [loadingRates, setLoadingRates] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [editGstValue, setEditGstValue] = useState('');
  const [detailReadOnly, setDetailReadOnly] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null); // { rate, tab }
  const [isDeleting, setIsDeleting] = useState(false);

  // Add Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newRateForm, setNewRateForm] = useState(INITIAL_NEW_RATE_FORM);
  const [isSaving, setIsSaving] = useState(false);

  // POS Txn Edit Modal State
  const [isPosTxnEditModalOpen, setIsPosTxnEditModalOpen] = useState(false);
  const [posTxnEditRate, setPosTxnEditRate] = useState(null);
  const [posTxnEditForm, setPosTxnEditForm] = useState(INITIAL_NEW_RATE_FORM);

  // Global Fallback Rate State
  const [globalRate, setGlobalRate] = useState(null);
  const [isEditingGlobal, setIsEditingGlobal] = useState(false);
  const [globalRateInput, setGlobalRateInput] = useState('');
  const [loadingGlobal, setLoadingGlobal] = useState(false);

  // ── CC Bill Pay State ────────────────────────────────────────────────────────
  const [adminCcBaseline, setAdminCcBaseline] = useState([]);
  const [companyDefaultCcRules, setCompanyDefaultCcRules] = useState([]);
  const [loadingCcRules, setLoadingCcRules] = useState(false);
  const [ccUsers, setCcUsers] = useState([]);
  const [ccUserSearch, setCcUserSearch] = useState('');
  const [selectedCcUserId, setSelectedCcUserId] = useState('');
  const [selectedCcUserRules, setSelectedCcUserRules] = useState([]);
  const [loadingSelectedCcUser, setLoadingSelectedCcUser] = useState(false);
  const [isCcModalOpen, setIsCcModalOpen] = useState(false);
  const [ccModalMode, setCcModalMode] = useState('company_default'); // 'company_default' | 'user_override'
  const [editingCcRule, setEditingCcRule] = useState(null);
  const [ccForm, setCcForm] = useState({
    from_amount: '',
    to_amount: '',
    rate: '',
    rate_type: 'flat',
    is_active: true,
    description: '',
  });
  const [isSavingCc, setIsSavingCc] = useState(false);

  // ── Payout State ─────────────────────────────────────────────────────────────
  const [adminPayoutBaseline, setAdminPayoutBaseline] = useState([]);
  const [payoutUsers, setPayoutUsers] = useState([]);
  const [payoutUserSearch, setPayoutUserSearch] = useState('');
  const [selectedPayoutUserId, setSelectedPayoutUserId] = useState('');
  const [selectedPayoutUserData, setSelectedPayoutUserData] = useState(null);
  const [loadingSelectedPayoutUser, setLoadingSelectedPayoutUser] = useState(false);
  const [isPayoutModalOpen, setIsPayoutModalOpen] = useState(false);
  const [editingPayoutRule, setEditingPayoutRule] = useState(null);
  const [payoutForm, setPayoutForm] = useState({
    from_amount: '',
    to_amount: '',
    rate: '',
    rate_type: 'flat',
    is_active: true,
    description: '',
  });
  const [isSavingPayout, setIsSavingPayout] = useState(false);

  // ── Rental State ─────────────────────────────────────────────────────────────
  const [rentalList, setRentalList] = useState([]);
  const [loadingRental, setLoadingRental] = useState(false);
  const [rentalForm, setRentalForm] = useState({ super_franchise_rate: '', franchise_rate: '', merchant_rate: '', is_active: true });
  const [isSavingRental, setIsSavingRental] = useState(false);

  const methodOptions = ["CARD", "UPI"];
  const networkOptions = ["MASTER_CARD", "VISA", "RUPAY", "AMEX", "DINERS", " "];
  const cardTypeOptions = ["CREDIT", "DEBIT", "PREPAID", "UNKNOWN"];
  const cardClassificationOptions = [
    "SIGNATURE",
    "Mastercard World",
    "WORLD CARD",
    "TITANIUM",
    "Infinite",
    "NULL",
    "PREPAID",
    "MPL",
    "Signature",
    "GOLD",
    "ELECTRON",
    "Select",
    "BUSINESS",
    "Platinum",
    "INFINITE",
    "Classic",
    "Rewards",
    "Fpaydefaul",
    "PLATINUM",
    "CLASSIC",
    "ANY",
    "GOLD/PREM",
    "WORLD FOR",
    "CORPORATE",
    "STANDARD",
  ];
  const backButtonClass = "w-full md:w-auto inline-flex items-center justify-center gap-2 bg-gradient-to-r from-[#1855e4] to-[#00D3CD] text-white px-4 py-2 rounded-lg text-sm font-semibold shadow hover:shadow-md hover:brightness-105 transition";
  const getRateValue = (rate) => rate?.merchant_rate ?? rate?.base_rate ?? null;
  const hasEditableGst = (rate) => rate?.gst_required || rate?.gst_rate !== null && rate?.gst_rate !== undefined;
  const formatPercent = (value) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? `${numeric}%` : '-';
  };
  const formatRateValue = (rate) => {
    const value = getRateValue(rate);
    return value === null ? '-' : formatPercent(value);
  };
  const formatGstValue = (rate) => hasEditableGst(rate) ? formatPercent(rate.gst_rate) : '-';
  const normalizeSettlementValue = (value) => String(value ?? '').trim().toLowerCase();
  const getRateKey = (rate) => rate?.rule_key || `${rate?.method}-${rate?.network}-${rate?.card_type}-${rate?.sub_type}-${rate?.card_classification}`;
  const sortRates = (items) =>
    [...items].sort((left, right) =>
      [
        left.method,
        left.network,
        left.card_type,
        left.sub_type,
        left.card_classification,
        String(left.min_amount ?? 0),
        String(left.max_amount ?? '')
      ].join('|').localeCompare(
        [
          right.method,
          right.network,
          right.card_type,
          right.sub_type,
          right.card_classification,
          String(right.min_amount ?? 0),
          String(right.max_amount ?? '')
        ].join('|')
      )
    );
  const buildColumnStructure = (...collections) => {
    const rateMap = new Map();

    collections
      .flat()
      .filter(Boolean)
      .forEach((rate) => {
        const key = getRateKey(rate);
        if (!rateMap.has(key)) {
          rateMap.set(key, rate);
        }
      });

    return sortRates(Array.from(rateMap.values()));
  };
  const findMatchingRate = (rateList, attribute) =>
    rateList.find((rate) => getRateKey(rate) === getRateKey(attribute));
  const getRateMetaLine = (rate) =>
    [`${rate.card_type} ${rate.sub_type}`, `Class: ${rate.card_classification || 'ANY'}`, `GST: ${formatGstValue(rate)}`]
      .filter(Boolean)
      .join(' | ');
  const getEntityPhone = (entity) => entity?.phone || entity?.mobile_number || 'N/A';
  const getEntityDisplayId = (entity) =>
    entity?.abheepay_id ||
    entity?.abheepayId ||
    entity?.display_id ||
    entity?.displayId ||
    entity?.id ||
    'N/A';
  const isUpiMethod = newRateForm.method === 'UPI';
  const isCardMethod = newRateForm.method === 'CARD';
  const showNetworkAndCardType = isCardMethod || isUpiMethod;
  const showGSTInput = newRateForm.gstRequired;

  // Initial Load
  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    setMatrixPage(1);
  }, [searchTerm, activeTab, viewMode]);

  useEffect(() => {
    if (activeTab === 'default') {
      setDefaultPagination((prev) => ({ ...prev, page: 1 }));
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== 'default') {
      return;
    }

    fetchFranchiseRates('default', defaultPagination.page, defaultPagination.limit);
  }, [activeTab, defaultPagination.page, defaultPagination.limit]);

  useEffect(() => {
    if (activeTab === 'cc_bill') {
      fetchCcData();
    } else if (activeTab === 'payout') {
      fetchPayoutData();
    } else if (activeTab === 'rental') {
      fetchRentalData();
    }
  }, [activeTab]);

  useEffect(() => {
    if (selectedCcUserId) {
      fetchSelectedUserCcRules(selectedCcUserId);
    }
  }, [selectedCcUserId]);

  useEffect(() => {
    if (selectedPayoutUserId) {
      fetchSelectedUserPayoutRules(selectedPayoutUserId);
    }
  }, [selectedPayoutUserId]);

  useEffect(() => {
    if (activeTab === 'super_franchise' && selectedSuperFranchiseId) {
      fetchSuperFranchiseRates(selectedSuperFranchiseId);
    }
  }, [activeTab, selectedSuperFranchiseId]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm.trim());
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchTerm]);

  useEffect(() => {
    const canUseRemoteSearch =
      viewMode === 'matrix' && (activeTab === 'super_franchise' || activeTab === 'specific' || activeTab === 'unassigned');

    if (!canUseRemoteSearch || !debouncedSearchTerm) {
      setMatrixSearchResults([]);
      setMatrixSearchLoading(false);
      setMatrixSearchError('');
      return;
    }

    let isCancelled = false;

    const runSearch = async () => {
      setMatrixSearchLoading(true);
      setMatrixSearchError('');

      try {
        const role = activeTab === 'super_franchise'
          ? 'super_franchise'
          : activeTab === 'specific'
            ? 'franchaise'
            : 'merchant';
        const response = await searchUsers({
          q: debouncedSearchTerm,
          status: 'active',
          role,
          page: 1,
          limit: 50,
        });

        let results = extractSearchUsersArray(response);

        if (activeTab === 'unassigned') {
          const unassignedIds = new Set(
            unassignedMerchants
              .map((merchant) => merchant?.id)
              .filter((id) => id !== undefined && id !== null)
              .map((id) => String(id))
          );

          results = results.filter((merchant) => {
            const merchantId = merchant?.id;
            if (merchantId !== undefined && merchantId !== null && unassignedIds.size > 0) {
              return unassignedIds.has(String(merchantId));
            }

            const franchiseId = getSearchEntityFranchiseId(merchant);
            return franchiseId === null || franchiseId === undefined || franchiseId === '';
          });
        }

        if (!isCancelled) {
          setMatrixSearchResults(results);
        }
      } catch (error) {
        if (!isCancelled) {
          setMatrixSearchResults([]);
          setMatrixSearchError(error.message || 'Failed to search users');
        }
      } finally {
        if (!isCancelled) {
          setMatrixSearchLoading(false);
        }
      }
    };

    runSearch();

    return () => {
      isCancelled = true;
    };
  }, [activeTab, debouncedSearchTerm, unassignedMerchants, viewMode]);

  // Fetch Logic
  const fetchInitialData = async () => {
    setLoading(true);
    try {
      if (isSuperAdmin) {
        const [adminsRes, defaultRules] = await Promise.all([
          fetchSuperAdminAdminsPosMatrix().catch(() => ({ data: [] })),
          fetchPlatformDefaultPosRules().catch(() => []),
        ]);
        const adminRows = adminsRes?.data || [];
        const admMatrix = {};
        const adminUsers = [];
        adminRows.forEach((item) => {
          const adm = item?.admin;
          if (adm?.id) {
            adminUsers.push(adm);
            admMatrix[adm.id] = (item.overrides || []).map((r) =>
              mapRuleToAdminFormat(r, {
                adminId: adm.id,
                isInherited: false,
              })
            );
          }
        });

        if (adminUsers.length === 0) {
          const fallbackAdmins = await getAdminList({ limit: 1000 }).catch(() => ({ data: [] }));
          const list = fallbackAdmins?.data || fallbackAdmins?.users || (Array.isArray(fallbackAdmins) ? fallbackAdmins : []);
          list.forEach((adm) => {
            if (adm?.id) {
              adminUsers.push(adm);
              admMatrix[adm.id] = [];
            }
          });
        }

        const mappedDefaults = (defaultRules || []).map((r) =>
          mapRuleToAdminFormat(r, {
            isInherited: false,
          })
        );

        setSuperFranchises([]);
        setFranchises(adminUsers);
        setUnassignedMerchants([]);
        setRates(mappedDefaults);
        setDefaultRatesAttributes(
          buildColumnStructure(
            mappedDefaults,
            ...Object.values(admMatrix)
          )
        );
        setMatrixData(admMatrix);
        fetchGlobalRate();
        return;
      }

      const [superFranchisesData, franchisesData, defaults, unassignedMerchantsData] = await Promise.all([
        getSuperFranchises(),
        getFranchises(),
        getFranchiseRates('default'),
        getUnassignedMerchants(),
      ]);

      setSuperFranchises(superFranchisesData);
      setFranchises(franchisesData);
      setUnassignedMerchants(unassignedMerchantsData);

      const [sfMatrix, matrix, unassignedMerchantMatrix] = await Promise.all([
        getAllSuperFranchiseRates(superFranchisesData),
        getAllFranchiseRates(franchisesData),
        getAllMerchantRates(unassignedMerchantsData),
      ]);

      setDefaultRatesAttributes(
        buildColumnStructure(
          defaults,
          ...Object.values(sfMatrix),
          ...Object.values(matrix),
          ...Object.values(unassignedMerchantMatrix)
        )
      );
      setSuperFranchiseMatrixData(sfMatrix);
      setMatrixData(matrix);
      setUnassignedMerchantMatrixData(unassignedMerchantMatrix);

      // Get Global Fallback Rate
      fetchGlobalRate();
    } catch (error) {
      console.error('Failed to load initial data', error);
      toast.error('Failed to load initial data');
    } finally {
      setLoading(false);
    }
  };

  const fetchSuperFranchiseRates = async (sfId) => {
    setLoadingRates(true);
    try {
      const data = await getSuperFranchiseRates(sfId);
      setRates(data);
    } catch (error) {
      console.error('Failed to load super franchise rates', error);
      toast.error('Failed to load rates');
    } finally {
      setLoadingRates(false);
    }
  };

  const fetchGlobalRate = async () => {
    setLoadingGlobal(true);
    try {
      const data = isSuperAdmin ? await getSuperAdminGlobalPosRate() : await getGlobalPOSRate();
      const val = data?.data?.percent_fee ?? data?.percent_fee ?? (typeof data === 'number' ? data : null);
      if (val !== null && val !== undefined) {
        setGlobalRate(val);
      }
    } catch (error) {
      console.error("Failed to load global rate", error);
    } finally {
      setLoadingGlobal(false);
    }
  };

  const handleUpdateGlobalRate = async () => {
    if (!globalRateInput) {
      toast.error("Please enter a valid global rate.");
      return;
    }
    setLoadingGlobal(true);
    try {
      const res = isSuperAdmin
        ? await updateSuperAdminGlobalPosRate(globalRateInput)
        : await updateGlobalPOSRate(globalRateInput);
      toast.success("Global Fallback Rate updated successfully!");
      const updatedVal = res?.data?.percent_fee ?? res?.record?.percent_fee ?? globalRateInput;
      setGlobalRate(updatedVal);
      setIsEditingGlobal(false);
      setGlobalRateInput('');
    } catch (error) {
      toast.error("Failed to update global rate. " + (error.response?.data?.message || error.message));
    } finally {
      setLoadingGlobal(false);
    }
  };

  // ── CC Bill Pay Handlers ─────────────────────────────────────────────────────
  const fetchCcData = async () => {
    setLoadingCcRules(true);
    try {
      if (isSuperAdmin) {
        const [rulesRes, adminsRes] = await Promise.all([
          fetchSuperAdminCcBillRules(),
          getAdminList({ page: 1, limit: 1000 }).catch(() => ({ data: [] })),
        ]);
        const rules = rulesRes?.data || [];
        setAdminCcBaseline(rules.filter((r) => !r.user_id));
        setCompanyDefaultCcRules(rules);
        const adminUsers = (adminsRes?.data || []).map((m) => ({ ...m, userType: 'Admin' }));
        setCcUsers(adminUsers);
        return;
      }

      const [applicableChargesRes, defaultRulesRes, merchantsRes, franchisesRes, superFranchisesRes] = await Promise.all([
        fetchMyAdminApplicableCharges().catch(() => null),
        listBbpsChargeRules({ user_id: 'default' }).catch(() => ({ data: [] })),
        MerchantAllUsers({ page: 1, limit: 1000 }).catch(() => ({ data: [] })),
        FranchiseAllUsers({ page: 1, limit: 1000 }).catch(() => ({ data: [] })),
        SuperFranchiseAllUsers({ page: 1, limit: 1000 }).catch(() => ({ data: [] })),
      ]);

      const cc = applicableChargesRes?.data?.ccBillRate || applicableChargesRes?.ccBillRate || applicableChargesRes?.data?.cc_bill || applicableChargesRes?.data?.ccBill;
      const baseline = Array.isArray(cc?.configuredRates) ? cc.configuredRates : (Array.isArray(cc) ? cc : []);
      setAdminCcBaseline(baseline);

      const defRules = Array.isArray(defaultRulesRes?.data) ? defaultRulesRes.data : Array.isArray(defaultRulesRes) ? defaultRulesRes : [];
      setCompanyDefaultCcRules(defRules);

      const sfList = (Array.isArray(superFranchisesRes?.data) ? superFranchisesRes.data : Array.isArray(superFranchisesRes) ? superFranchisesRes : []).map(sf => ({ ...sf, userType: 'Super Franchise' }));
      const mList = (Array.isArray(merchantsRes?.data) ? merchantsRes.data : Array.isArray(merchantsRes) ? merchantsRes : []).map(m => ({ ...m, userType: 'Merchant' }));
      const fList = (Array.isArray(franchisesRes?.data) ? franchisesRes.data : Array.isArray(franchisesRes) ? franchisesRes : []).map(f => ({ ...f, userType: 'Franchise' }));
      setCcUsers([...sfList, ...fList, ...mList]);
    } catch (err) {
      console.error('Failed to load CC Bill data', err);
    } finally {
      setLoadingCcRules(false);
    }
  };

  const fetchSelectedUserCcRules = async (userId) => {
    if (!userId) {
      setSelectedCcUserRules([]);
      return;
    }
    setLoadingSelectedCcUser(true);
    try {
      const res = await fetchApplicableCcBillRulesForUser(userId);
      const userRules = res?.data?.userRules || (Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []));
      setSelectedCcUserRules(userRules);
    } catch (err) {
      console.error('Failed to fetch user CC rules', err);
    } finally {
      setLoadingSelectedCcUser(false);
    }
  };

  const handleOpenAddCcModal = (mode, rule = null) => {
    setCcModalMode(mode);
    setEditingCcRule(rule);
    if (rule) {
      setCcForm({
        from_amount: rule.from_amount ?? '',
        to_amount: rule.to_amount ?? '',
        rate: rule.rate ?? '',
        rate_type: rule.rate_type ?? 'flat',
        is_active: rule.is_active ?? true,
        description: rule.description ?? '',
      });
    } else {
      setCcForm({
        from_amount: '',
        to_amount: '',
        rate: '',
        rate_type: 'flat',
        is_active: true,
        description: '',
      });
    }
    setIsCcModalOpen(true);
  };

  const handleSaveCcRule = async (e) => {
    e?.preventDefault();
    if (!ccForm.from_amount || !ccForm.to_amount || !ccForm.rate) {
      toast.error('From amount, to amount, and rate are required');
      return;
    }
    setIsSavingCc(true);
    try {
      const payload = {
        from_amount: parseFloat(ccForm.from_amount),
        to_amount: parseFloat(ccForm.to_amount),
        rate: parseFloat(ccForm.rate),
        rate_type: ccForm.rate_type,
        is_active: ccForm.is_active,
        description: ccForm.description || 'BBPS CC Bill Charge',
        user_id: ccModalMode === 'user_override' ? selectedCcUserId : null,
      };

      if (isSuperAdmin) {
        if (editingCcRule?.id) {
          await updateSuperAdminCcBillRule(editingCcRule.id, payload);
          toast.success('CC Bill rule updated successfully');
        } else {
          await createSuperAdminCcBillRule(payload);
          toast.success(ccModalMode === 'user_override' ? 'Admin override created successfully' : 'Default platform rate created successfully');
        }
        setIsCcModalOpen(false);
        setEditingCcRule(null);
        fetchCcData();
        return;
      }

      if (editingCcRule?.id) {
        await updateBbpsChargeRule(editingCcRule.id, payload);
        toast.success('CC Bill rule updated successfully');
      } else {
        await createBbpsChargeRule(payload);
        toast.success(ccModalMode === 'user_override' ? 'User override created successfully' : 'Company default rate created successfully');
      }

      setIsCcModalOpen(false);
      setEditingCcRule(null);
      if (ccModalMode === 'user_override' && selectedCcUserId) {
        fetchSelectedUserCcRules(selectedCcUserId);
      } else {
        const defRulesRes = await listBbpsChargeRules({ user_id: 'default' });
        setCompanyDefaultCcRules(Array.isArray(defRulesRes?.data) ? defRulesRes.data : []);
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to save CC rule');
    } finally {
      setIsSavingCc(false);
    }
  };

  const handleDeleteCcRule = async (id, isUserRule = false) => {
    if (!window.confirm('Are you sure you want to delete this rule?')) return;
    try {
      if (isSuperAdmin) {
        await deleteSuperAdminCcBillRule(id);
        toast.success('CC Bill rule deleted successfully');
        fetchCcData();
        return;
      }
      await deleteBbpsChargeRule(id);
      toast.success('CC Bill rule deleted successfully');
      if (isUserRule && selectedCcUserId) {
        fetchSelectedUserCcRules(selectedCcUserId);
      } else {
        const defRulesRes = await listBbpsChargeRules({ user_id: 'default' });
        setCompanyDefaultCcRules(Array.isArray(defRulesRes?.data) ? defRulesRes.data : []);
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to delete rule');
    }
  };

  // ── Payout Handlers ──────────────────────────────────────────────────────────
  const fetchPayoutData = async () => {
    try {
      if (isSuperAdmin) {
        const [rulesRes, adminsRes] = await Promise.all([
          fetchSuperAdminPayoutRules(),
          getAdminList({ page: 1, limit: 1000 }).catch(() => ({ data: [] })),
        ]);
        const defaults = rulesRes?.defaults || rulesRes?.data || [];
        setAdminPayoutBaseline(defaults);
        const adminUsers = (adminsRes?.data || []).map((a) => ({ ...a, userType: 'Admin' }));
        setPayoutUsers(adminUsers);
        return;
      }

      const [applicableChargesRes, merchantsRes, franchisesRes] = await Promise.all([
        fetchMyAdminApplicableCharges().catch(() => null),
        MerchantAllUsers({ page: 1, limit: 1000 }).catch(() => ({ data: [] })),
        FranchiseAllUsers({ page: 1, limit: 1000 }).catch(() => ({ data: [] })),
      ]);

      const pay = applicableChargesRes?.data?.payRate || applicableChargesRes?.payRate || applicableChargesRes?.data?.payout || applicableChargesRes?.data?.pay;
      const baseline = Array.isArray(pay?.configuredRates) ? pay.configuredRates : (Array.isArray(pay) ? pay : []);
      setAdminPayoutBaseline(baseline);

      const mList = (Array.isArray(merchantsRes?.data) ? merchantsRes.data : Array.isArray(merchantsRes) ? merchantsRes : []).map(m => ({ ...m, userType: 'Merchant' }));
      const fList = (Array.isArray(franchisesRes?.data) ? franchisesRes.data : Array.isArray(franchisesRes) ? franchisesRes : []).map(f => ({ ...f, userType: 'Franchise' }));
      setPayoutUsers([...fList, ...mList]);
    } catch (err) {
      console.error('Failed to load Payout data', err);
    }
  };

  const fetchSelectedUserPayoutRules = async (userId) => {
    if (!userId) {
      setSelectedPayoutUserData(null);
      return;
    }
    setLoadingSelectedPayoutUser(true);
    try {
      const res = await fetchApplicableUserPayoutCharges(userId);
      setSelectedPayoutUserData(res?.data || null);
    } catch (err) {
      console.error('Failed to fetch user payout charges', err);
    } finally {
      setLoadingSelectedPayoutUser(false);
    }
  };

  const handleOpenAddPayoutModal = (rule = null) => {
    setEditingPayoutRule(rule);
    if (rule) {
      setPayoutForm({
        from_amount: rule.from_amount ?? '',
        to_amount: rule.to_amount ?? '',
        rate: rule.rate ?? '',
        rate_type: rule.rate_type ?? 'flat',
        is_active: rule.is_active ?? true,
        description: rule.description ?? '',
      });
    } else {
      setPayoutForm({
        from_amount: '',
        to_amount: '',
        rate: '',
        rate_type: 'flat',
        is_active: true,
        description: '',
      });
    }
    setIsPayoutModalOpen(true);
  };

  const handleSavePayoutRule = async (e) => {
    e?.preventDefault();
    if (!selectedPayoutUserId) {
      toast.error('Please select a target user first');
      return;
    }
    if (!payoutForm.from_amount || !payoutForm.to_amount || !payoutForm.rate) {
      toast.error('From amount, to amount, and rate are required');
      return;
    }
    setIsSavingPayout(true);
    try {
      const payload = {
        user_id: parseInt(selectedPayoutUserId, 10),
        from_amount: parseFloat(payoutForm.from_amount),
        to_amount: parseFloat(payoutForm.to_amount),
        rate: parseFloat(payoutForm.rate),
        rate_type: payoutForm.rate_type,
        is_active: payoutForm.is_active,
        description: payoutForm.description || (isSuperAdmin ? 'Admin Payout Charge' : 'User Payout Charge'),
      };

      if (isSuperAdmin) {
        if (editingPayoutRule?.id) {
          await updateSuperAdminPayoutRule(editingPayoutRule.id, {
            ...payload,
            is_admin_override: Boolean(selectedPayoutUserId),
          });
          toast.success('Payout charge updated successfully');
        } else {
          await createSuperAdminPayoutRule(payload);
          toast.success('Payout charge configured successfully');
        }
        setIsPayoutModalOpen(false);
        setEditingPayoutRule(null);
        if (selectedPayoutUserId) {
          fetchSelectedUserPayoutRules(selectedPayoutUserId);
        } else {
          fetchPayoutData();
        }
        return;
      }

      if (editingPayoutRule?.id) {
        await updateUserPayoutCharge(editingPayoutRule.id, payload);
        toast.success('Payout charge updated successfully');
      } else {
        await createUserPayoutCharge(payload);
        toast.success('User payout charge configured successfully');
      }

      setIsPayoutModalOpen(false);
      setEditingPayoutRule(null);
      fetchSelectedUserPayoutRules(selectedPayoutUserId);
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to save payout charge');
    } finally {
      setIsSavingPayout(false);
    }
  };

  const handleDeletePayoutRule = async (id) => {
    if (!window.confirm(isSuperAdmin ? 'Reset this rate to inherit from platform baseline?' : 'Reset this rate to inherit from Super Admin baseline?')) return;
    try {
      if (isSuperAdmin) {
        await deleteSuperAdminPayoutRule(id, { is_admin_override: Boolean(selectedPayoutUserId) });
        toast.success('Payout charge reset successfully');
        if (selectedPayoutUserId) {
          fetchSelectedUserPayoutRules(selectedPayoutUserId);
        } else {
          fetchPayoutData();
        }
        return;
      }
      await deleteUserPayoutCharge(id);
      toast.success('Rule reset to inherited baseline successfully');
      if (selectedPayoutUserId) {
        fetchSelectedUserPayoutRules(selectedPayoutUserId);
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to reset payout charge');
    }
  };

  // ── Rental Handlers ──────────────────────────────────────────────────────────
  const fetchRentalData = async () => {
    setLoadingRental(true);
    try {
      const res = isSuperAdmin ? await fetchSuperAdminRentalRates({ limit: 100 }) : await listPosRentals({ limit: 100 });
      const rows = res?.data || (Array.isArray(res) ? res : []);
      setRentalList(rows);
      if (rows.length > 0) {
        const item = rows[0];
        setRentalForm({
          super_franchise_rate: item.super_franchise_rate ?? rows.find(r => r.target_user_type === 'super_franchise')?.amount ?? '',
          franchise_rate: item.franchise_rate ?? rows.find(r => r.target_user_type === 'franchise')?.amount ?? item.amount ?? '',
          merchant_rate: item.merchant_rate ?? rows.find(r => r.target_user_type === 'merchant')?.amount ?? '',
          is_active: item.status === 'active' || item.is_active === true,
        });
      }
    } catch (err) {
      console.error('Failed to load rental data', err);
    } finally {
      setLoadingRental(false);
    }
  };

  const handleSaveRental = async (e) => {
    e?.preventDefault();
    setIsSavingRental(true);
    try {
      if (isSuperAdmin) {
        const payload = {
          amount: parseFloat(rentalForm.franchise_rate || rentalForm.amount || 0),
          target_user_type: 'admin',
          status: rentalForm.is_active ? 'active' : 'inactive',
          type: 'pos',
        };
        if (rentalList.length > 0 && rentalList[0].id) {
          await updateSuperAdminRentalRate(rentalList[0].id, payload);
          toast.success('Rental rates updated successfully');
        } else {
          await createSuperAdminRentalRate(payload);
          toast.success('Rental rates configured successfully');
        }
        fetchRentalData();
        return;
      }

      const payload = {
        super_franchise_rate: parseFloat(rentalForm.super_franchise_rate || 0),
        franchise_rate: parseFloat(rentalForm.franchise_rate || 0),
        merchant_rate: parseFloat(rentalForm.merchant_rate || 0),
        status: rentalForm.is_active ? 'active' : 'inactive',
      };
      if (rentalList.length > 0) {
        await updatePosRental(rentalList[0].id, payload);
        toast.success('Rental rates updated successfully');
      } else {
        await createPosRental(payload);
        toast.success('Rental rates configured successfully');
      }
      fetchRentalData();
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to save rental rates');
    } finally {
      setIsSavingRental(false);
    }
  };

  // Effect for Switching Tabs or View Modes
  useEffect(() => {
    // Scroll to top whenever tab or view mode changes
    const scrollContainer = document.getElementById('main-content');
    if (scrollContainer) {
      scrollContainer.scrollTop = 0;
    } else {
      window.scrollTo(0, 0);
    }

    if (activeTab === 'rental' || activeTab === 'cc_bill' || activeTab === 'payout') {
      return;
    }

    if (activeTab === 'default') {
      return;
    }

    if (activeTab === 'specific') {
      if (viewMode === 'detail' && selectedFranchiseId) {
        fetchFranchiseRates(selectedFranchiseId);
      } else {
        fetchInitialData();
      }
      return;
    }

    if (activeTab === 'unassigned') {
      if (viewMode === 'detail' && selectedMerchantId) {
        fetchMerchantRates(selectedMerchantId);
      } else {
        fetchInitialData();
      }
    }
  }, [activeTab, viewMode, selectedFranchiseId, selectedMerchantId]);

  const fetchFranchiseRates = async (id, page = 1, limit = 100) => {
    setLoadingRates(true);
    try {
      if (isSuperAdmin) {
        if (id === 'default') {
          const defaultRules = await fetchPlatformDefaultPosRules();
          const mapped = (defaultRules || []).map((rule) =>
            mapRuleToAdminFormat(rule, {
              isInherited: false,
            })
          );
          setRates(mapped);
        } else {
          const [adminOverrides, defaultRules] = await Promise.all([
            fetchAdminPosRules(id),
            fetchPlatformDefaultPosRules(),
          ]);
          const mapped = buildAdminEffectiveRules(defaultRules, adminOverrides, id);
          setRates(mapped);
        }
        return;
      }

      const data = await getFranchiseRates(id, {
        paginate: id === 'default',
        page,
        limit
      });

      if (id === 'default') {
        const list = Array.isArray(data) ? data : (data?.rates || []);
        setRates(list);
        if (data?.pagination) {
          setDefaultPagination((prev) => ({
            ...prev,
            ...data.pagination,
            page: data.pagination?.page ?? prev.page,
            limit: data.pagination?.limit ?? prev.limit,
            totalPages: data.pagination?.totalPages ?? prev.totalPages,
            total: data.pagination?.total ?? prev.total
          }));
        }
      } else {
        setRates(data);
      }
    } catch (error) {
      console.error('Failed to load franchise rates', error);
      toast.error('Failed to load rates');
    } finally {
      setLoadingRates(false);
    }
  };

  const fetchMerchantRates = async (id) => {
    setLoadingRates(true);
    try {
      const data = await getMerchantRates(id);
      setRates(data);
    } catch (error) {
      console.error('Failed to load merchant rates', error);
      toast.error('Failed to load rates');
    } finally {
      setLoadingRates(false);
    }
  };

  const refreshAfterUpdate = async () => {
    if (activeTab === 'default') {
      await fetchFranchiseRates('default', defaultPagination.page, defaultPagination.limit);
      await fetchInitialData();
      return;
    }

    if(activeTab === "specific" && isSuperAdmin) {
      const id = selectedFranchiseId;
      const [adminOverrides, defaultRules] = await Promise.all([
        fetchAdminPosRules(id),
        fetchPlatformDefaultPosRules(),
      ]);
      const mapped = buildAdminEffectiveRules(defaultRules, adminOverrides, id);
      setRates(mapped);
      return;
    }

    if (activeTab === 'super_franchise' && selectedSuperFranchiseId) {
      await fetchSuperFranchiseRates(selectedSuperFranchiseId);
      await fetchInitialData();
      return;
    }

    if (activeTab === 'specific' && selectedFranchiseId) {
      await fetchFranchiseRates(selectedFranchiseId);
      await fetchInitialData();
      return;
    }

    if (activeTab === 'unassigned' && selectedMerchantId) {
      await fetchMerchantRates(selectedMerchantId);
      await fetchInitialData();
    }
  };

  const handleEditSuperFranchiseDetail = (sfId) => {
    setSelectedSuperFranchiseId(sfId);
    setSelectedFranchiseId('');
    setSelectedMerchantId('');
    setDetailReadOnly(false);
    setEditingId(null);
    setEditValue('');
    setEditGstValue('');
    setSpecificSettlementFilter(DEFAULT_SPECIFIC_SETTLEMENT_FILTER);
    setViewMode('detail');
  };

  const handleViewSuperFranchiseDetail = (sfId) => {
    setSelectedSuperFranchiseId(sfId);
    setSelectedFranchiseId('');
    setSelectedMerchantId('');
    setDetailReadOnly(true);
    setEditingId(null);
    setEditValue('');
    setEditGstValue('');
    setSpecificSettlementFilter(DEFAULT_SPECIFIC_SETTLEMENT_FILTER);
    setViewMode('detail');
  };

  const handleEditFranchiseDetail = (franchiseId) => {
    setSelectedFranchiseId(franchiseId);
    setSelectedSuperFranchiseId('');
    setSelectedMerchantId('');
    setDetailReadOnly(false);
    setEditingId(null);
    setEditValue('');
    setEditGstValue('');
    setSpecificSettlementFilter(DEFAULT_SPECIFIC_SETTLEMENT_FILTER);
    setViewMode('detail');
  };

  const handleEditMerchantDetail = (merchantId) => {
    setSelectedMerchantId(merchantId);
    setSelectedSuperFranchiseId('');
    setSelectedFranchiseId('');
    setDetailReadOnly(false);
    setEditingId(null);
    setEditValue('');
    setEditGstValue('');
    setSpecificSettlementFilter(DEFAULT_SPECIFIC_SETTLEMENT_FILTER);
    setViewMode('detail');
  };

  const handleViewFranchiseDetail = (franchiseId) => {
    setSelectedFranchiseId(franchiseId);
    setSelectedSuperFranchiseId('');
    setSelectedMerchantId('');
    setDetailReadOnly(true);
    setEditingId(null);
    setEditValue('');
    setEditGstValue('');
    setSpecificSettlementFilter(DEFAULT_SPECIFIC_SETTLEMENT_FILTER);
    setViewMode('detail');
  };

  const handleViewMerchantDetail = (merchantId) => {
    setSelectedMerchantId(merchantId);
    setSelectedSuperFranchiseId('');
    setSelectedFranchiseId('');
    setDetailReadOnly(true);
    setEditingId(null);
    setEditValue('');
    setEditGstValue('');
    setSpecificSettlementFilter(DEFAULT_SPECIFIC_SETTLEMENT_FILTER);
    setViewMode('detail');
  };

  const handleBackToMatrix = () => {
    setSelectedSuperFranchiseId('');
    setSelectedFranchiseId('');
    setSelectedMerchantId('');
    setDetailReadOnly(false);
    setEditingId(null);
    setEditValue('');
    setEditGstValue('');
    setSpecificSettlementFilter(DEFAULT_SPECIFIC_SETTLEMENT_FILTER);
    setViewMode('matrix');
    fetchInitialData(); // Refresh matrix data on return
  };

  const handleEditRate = (rate) => {
    setEditingId(rate.id);
    const currentRate = getRateValue(rate);
    setEditValue(currentRate !== null ? String(currentRate) : '');
    setEditGstValue(hasEditableGst(rate) ? String(rate.gst_rate ?? 18) : '');
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditValue('');
    setEditGstValue('');
  };

  const handleUpdate = async (rate) => {
    if (isSuperAdmin && activeTab !== 'default') {
      toast.error('Unauthorized: Super Admin can only configure default/admin-level rates.');
      return;
    }
    if (!isSuperAdmin && activeTab === 'default') {
      toast.error('Admins cannot modify Super Admin default rates. Please configure downstream rates.');
      return;
    }
    if (editValue === '') {
      toast.error('Please enter a valid rate.');
      return;
    }

    if (hasEditableGst(rate) && editGstValue === '') {
      toast.error('Please enter a valid GST rate.');
      return;
    }

    // ── Minimum rate guard: admin cannot charge downstream users less than their own cost ──
    if (!isSuperAdmin && activeTab !== 'default') {
      const adminCost = rate.platform_default_rate ?? rate.admin_rate ?? null;
      const enteredRate = parseFloat(editValue);
      if (adminCost !== null && !isNaN(enteredRate) && enteredRate < adminCost) {
        toast.error(
          `Rate cannot be less than your applicable rate of ${adminCost}% for this rule. You must charge at least ${adminCost}%.`
        );
        return;
      }
    }

    try {
      const updates = {
        chargePercent: editValue
      };

      if (hasEditableGst(rate)) {
        updates.gstPercent = editGstValue;
      }

      let updatedRate;
      if (activeTab === 'default') {
        updatedRate = await updateFranchiseRate('default', rate, updates);
      } else if (activeTab === 'super_franchise') {
        updatedRate = await updateSuperFranchiseRate(selectedSuperFranchiseId, rate, updates);
      } else if (activeTab === 'specific') {
        updatedRate = await updateFranchiseRate(selectedFranchiseId, rate, updates);
      } else {
        updatedRate = await updateMerchantRate(selectedMerchantId, rate, updates);
      }

      setRates((prevRates) =>
        prevRates.map((r) =>
          getRateKey(r) === getRateKey(rate)
            ? { ...r, ...updatedRate }
            : r
        )
      );
      setEditingId(null);
      setEditValue('');
      setEditGstValue('');
      await refreshAfterUpdate();
      toast.success('Rate updated successfully');
    } catch (error) {
      console.error('[rate-settings][admin-ui] update:error', {
        activeTab,
        selectedFranchiseId,
        selectedMerchantId,
        message: error?.message,
        status: error?.response?.status,
        responseData: error?.response?.data || null
      });
      toast.error('Failed to update rate: ' + (error.response?.data?.message || error.message));
    }
  };

  const handleCreateNewRate = async () => {
    if ((newRateForm.chargePercent === '' || newRateForm.chargePercent === undefined) &&
        (newRateForm.chargeFlat === '' || newRateForm.chargeFlat === undefined)) {
      toast.error("Please enter a rate percentage or flat charge amount.");
      return;
    }
    if (showGSTInput && !newRateForm.gstPercent) {
      toast.error("Please enter a GST percentage.");
      return;
    }
    setIsSaving(true);
    try {
      const payload = {
        method: newRateForm.method,
        network: newRateForm.network || null,
        card_type: newRateForm.cardType || null,
        card_classification: newRateForm.cardClassification || null,
        settlement_type: newRateForm.settlementType || null,
        min_amount: newRateForm.minAmount || '0',
        max_amount: newRateForm.maxAmount || null,
        charge_flat: newRateForm.chargeFlat !== '' && newRateForm.chargeFlat !== null && newRateForm.chargeFlat !== undefined ? String(newRateForm.chargeFlat) : '0',
        gst_required: newRateForm.gstRequired,
        gst_rate: newRateForm.gstRequired ? newRateForm.gstPercent : '0',
        base_rate: newRateForm.chargePercent !== '' && newRateForm.chargePercent !== null && newRateForm.chargePercent !== undefined ? String(newRateForm.chargePercent) : '0',
        company_name: newRateForm.companyName || null
      };

      if (isSuperAdmin && activeTab === 'default') {
        await createPlatformDefaultPosRule({
          payment_mode: payload.method,
          card_brand: payload.network,
          card_type: payload.card_type,
          card_classification: payload.card_classification,
          settlement_type: payload.settlement_type,
          min_amount: payload.min_amount,
          max_amount: payload.max_amount,
          charge_percent: payload.base_rate,
          charge_flat: payload.charge_flat,
          gst_required: payload.gst_required,
          gst_percent: payload.gst_rate,
          company_name: payload.company_name,
        });
        toast.success("New platform default rate created successfully.");
      } else if (isSuperAdmin && activeTab === 'specific' && selectedFranchiseId) {
        await createAdminPosRule({
          user_id: selectedFranchiseId,
          payment_mode: payload.method,
          card_brand: payload.network,
          card_type: payload.card_type,
          card_classification: payload.card_classification,
          settlement_type: payload.settlement_type,
          min_amount: payload.min_amount,
          max_amount: payload.max_amount,
          charge_percent: payload.base_rate,
          charge_flat: payload.charge_flat,
          gst_required: payload.gst_required,
          gst_percent: payload.gst_rate,
          company_name: payload.company_name,
        });
        toast.success("Admin rate override created successfully.");
      } else {
        await createDefaultFranchiseRate(payload);
        toast.success("New default rate created successfully.");
      }
      setIsModalOpen(false);

      // Reset form
      setNewRateForm(INITIAL_NEW_RATE_FORM);
      // Refresh Data
      fetchInitialData();
      if (activeTab === 'default') {
        fetchFranchiseRates('default');
      } else if (activeTab === 'specific' && selectedFranchiseId) {
        fetchFranchiseRates(selectedFranchiseId);
      }
    } catch (error) {
      toast.error('Failed to create rate: ' + (error.response?.data?.message || error.message));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = (rate) => {
    if (!rate?.id) return;
    if (activeTab !== 'default' && rate.isInherited) {
      toast.info('This rate is inherited from Default Rates. Delete it from the Default Rates tab.');
      return;
    }
    setPendingDelete({ rate, tab: activeTab });
  };

  const closeDeleteModal = () => {
    if (isDeleting) return;
    setPendingDelete(null);
  };

  const confirmDelete = async () => {
    const rate = pendingDelete?.rate;
    const tab = pendingDelete?.tab;
    if (isSuperAdmin && tab !== 'default' && tab !== 'specific') {
      toast.error('Unauthorized: Super Admin can only delete default or admin-level rates.');
      setPendingDelete(null);
      return;
    }
    if (!rate?.id) return;

    const deleteId = rate.rule_id || rate.id;
    setIsDeleting(true);
    try {
      if (isSuperAdmin && tab === 'default') {
        await deletePlatformDefaultPosRule(deleteId);
        toast.success('Platform default rate deleted successfully');
      } else if (isSuperAdmin && tab === 'specific') {
        await deleteAdminPosRule(deleteId);
        toast.success('Admin rate override reset to platform default');
      } else {
        await deleteDefaultPOSRate(deleteId);
        toast.success('Rate deleted successfully');
      }

      if (tab === 'default') {
        await fetchFranchiseRates('default');
      } else if (tab === 'specific' && selectedFranchiseId) {
        await fetchFranchiseRates(selectedFranchiseId);
      } else if (tab === 'unassigned' && selectedMerchantId) {
        await fetchMerchantRates(selectedMerchantId);
      }
      await refreshAfterUpdate();
      setEditingId(null);
      setEditValue('');
      setEditGstValue('');
      setPendingDelete(null);
    } catch (error) {
      toast.error('Failed to delete rate: ' + (error.response?.data?.message || error.message));
    } finally {
      setIsDeleting(false);
    }
  };

  const openCreateRateModal = () => {
    setNewRateForm(INITIAL_NEW_RATE_FORM);
    setIsModalOpen(true);
  };

  const closeCreateRateModal = () => {
    setNewRateForm(INITIAL_NEW_RATE_FORM);
    setIsModalOpen(false);
  };

  const handleOpenPosTxnEditModal = (rate) => {
    setPosTxnEditRate(rate);
    const method = String(rate.method || 'CARD').toUpperCase();
    const isUPI = method === 'UPI';
    const flatVal = rate.charge_flat !== null && rate.charge_flat !== undefined ? String(rate.charge_flat) : '';
    const pctVal = getRateValue(rate) !== null && getRateValue(rate) !== undefined ? String(getRateValue(rate)) : '';
    setPosTxnEditForm({
      method,
      network: isUPI ? '' : (String(rate.network || 'VISA').toUpperCase()),
      cardType: isUPI ? 'UNKNOWN' : (String(rate.card_type || 'CREDIT').toUpperCase()),
      cardClassification: isUPI ? 'ANY' : (String(rate.card_classification || 'ANY').toUpperCase()),
      settlementType: rate.settlement_type || '',
      minAmount: String(rate.min_amount ?? '0'),
      maxAmount: rate.max_amount !== null && rate.max_amount !== undefined ? String(rate.max_amount) : '',
      chargePercent: pctVal,
      chargeFlat: flatVal,
      gstRequired: Boolean(rate.gst_required),
      gstPercent: String(rate.gst_rate ?? rate.gst_percent ?? '18'),
      companyName: rate.company_name || '',
    });
    setIsPosTxnEditModalOpen(true);
  };

  const handleSavePosTxnEdit = async () => {
    if (isSuperAdmin && activeTab !== 'default' && activeTab !== 'specific') {
      toast.error('Unauthorized: Super Admin can only edit default or admin-level rates.');
      setIsPosTxnEditModalOpen(false);
      return;
    }
    if ((posTxnEditForm.chargePercent === '' || posTxnEditForm.chargePercent === undefined) &&
        (posTxnEditForm.chargeFlat === '' || posTxnEditForm.chargeFlat === undefined)) {
      toast.error('Please enter a charge percentage or flat amount.');
      return;
    }

    // ── Minimum rate guard: admin cannot charge downstream users less than their own cost ──
    if (!isSuperAdmin && activeTab !== 'default' && posTxnEditRate) {
      const adminCost = posTxnEditRate.platform_default_rate ?? posTxnEditRate.admin_rate ?? null;
      const enteredRate = parseFloat(posTxnEditForm.chargePercent || '0');
      if (adminCost !== null && !isNaN(enteredRate) && enteredRate < adminCost) {
        toast.error(
          `Rate cannot be less than your applicable rate of ${adminCost}% for this rule. You must charge at least ${adminCost}%.`
        );
        return;
      }
    }
    setIsSaving(true);
    try {
      const updates = {
        payment_mode: posTxnEditForm.method,
        card_brand: posTxnEditForm.network || null,
        card_type: posTxnEditForm.cardType || null,
        card_classification: posTxnEditForm.cardClassification || null,
        settlement_type: posTxnEditForm.settlementType || null,
        min_amount: posTxnEditForm.minAmount || '0',
        max_amount: posTxnEditForm.maxAmount || null,
        charge_flat: posTxnEditForm.chargeFlat !== '' && posTxnEditForm.chargeFlat !== null && posTxnEditForm.chargeFlat !== undefined ? String(posTxnEditForm.chargeFlat) : '0',
        gst_required: posTxnEditForm.gstRequired,
        gst_percent: posTxnEditForm.gstRequired ? posTxnEditForm.gstPercent : '0',
        chargePercent: posTxnEditForm.chargePercent !== '' && posTxnEditForm.chargePercent !== null && posTxnEditForm.chargePercent !== undefined ? String(posTxnEditForm.chargePercent) : '0',
        charge_percent: posTxnEditForm.chargePercent !== '' && posTxnEditForm.chargePercent !== null && posTxnEditForm.chargePercent !== undefined ? String(posTxnEditForm.chargePercent) : '0',
        company_name: posTxnEditForm.companyName || null
      };
      if (activeTab === 'default') {
        if (!isSuperAdmin) {
          toast.error('Admins cannot modify Super Admin default rates.');
          return;
        }
        await updatePlatformDefaultPosRule(posTxnEditRate.rule_id || posTxnEditRate.id, updates);
        toast.success('Platform default rate updated successfully.');
      } else if (isSuperAdmin && activeTab === 'specific') {
        const ruleId = posTxnEditRate.rule_id || posTxnEditRate.id;
        if (posTxnEditRate.isInherited) {
          await createAdminPosRule({
            ...updates,
            user_id: selectedFranchiseId,
          });
        } else {
          await updateAdminPosRule(ruleId, updates);
        }
        toast.success('Admin rate rule updated successfully.');
      } else if (activeTab === 'super_franchise') {
        await updateSuperFranchiseRate(selectedSuperFranchiseId, posTxnEditRate, updates);
        toast.success('Rule updated successfully.');
      } else if (activeTab === 'specific') {
        await updateFranchiseRate(selectedFranchiseId, posTxnEditRate, updates);
        toast.success('Rule updated successfully.');
      } else {
        await updateMerchantRate(selectedMerchantId, posTxnEditRate, updates);
        toast.success('Rule updated successfully.');
      }
      setIsPosTxnEditModalOpen(false);
      setPosTxnEditRate(null);
      await refreshAfterUpdate();
    } catch (error) {
      toast.error('Failed to update rule: ' + (error.response?.data?.message || error.message));
    } finally {
      setIsSaving(false);
    }
  };

  // --- RENDER HELPERS ---

  const renderMatrix = () => {
    if (loading) return <div className="flex justify-center p-8"><Loader /></div>;
    const isSuperFranchiseTab = activeTab === 'super_franchise';
    const isUnassignedTab = activeTab === 'unassigned';
    const showMatrixRateColumns = !isPosTxnMode;
    const baseEntities = isSuperFranchiseTab
      ? superFranchises
      : isUnassignedTab
        ? unassignedMerchants
        : franchises;
    const matrixSource = isSuperFranchiseTab
      ? superFranchiseMatrixData
      : isUnassignedTab
        ? unassignedMerchantMatrixData
        : matrixData;
    const entityLabel = isSuperFranchiseTab
      ? 'Super Franchise'
      : isUnassignedTab
        ? 'Merchant'
        : isSuperAdmin
          ? 'Admin'
          : 'Franchise';
    const matrixAttributes = buildColumnStructure(
      defaultRatesAttributes.filter((rate) => rate.source_scope === 'admin'),
      ...Object.values(matrixSource)
    );
    const searchPlaceholder = isSuperFranchiseTab
      ? 'Search Super Franchise by Name, ID, or Phone...'
      : isUnassignedTab
        ? 'Search Merchant by Name, ID, or Phone...'
        : isSuperAdmin
          ? 'Search Admin by Name, ID, or Phone...'
          : 'Search Franchise by Name, ID, or Phone...';
    const shouldUseRemoteSearch =
      viewMode === 'matrix' &&
      (activeTab === 'super_franchise' || activeTab === 'specific' || activeTab === 'unassigned') &&
      searchTerm.trim().length > 0;
    const remoteSearchPending = shouldUseRemoteSearch && (
      matrixSearchLoading || debouncedSearchTerm !== searchTerm.trim()
    );
    const filteredEntities = shouldUseRemoteSearch
      ? (remoteSearchPending || matrixSearchError ? [] : matrixSearchResults)
      : baseEntities.filter((entity) => {
        const normalizedSearch = searchTerm.toLowerCase();
        const normalizedName = String(entity?.name || '').toLowerCase();
        const normalizedDisplayId = String(getEntityDisplayId(entity) || '').toLowerCase();
        const normalizedRawId = String(entity?.id || '').toLowerCase();
        const normalizedPhone = String(getEntityPhone(entity)).toLowerCase();

        return (
          normalizedName.includes(normalizedSearch) ||
          normalizedDisplayId.includes(normalizedSearch) ||
          normalizedRawId.includes(normalizedSearch) ||
          normalizedPhone.includes(normalizedSearch)
        );
      });
    const emptyStateMessage = matrixSearchError
      ? matrixSearchError
      : remoteSearchPending
        ? `Searching ${isSuperFranchiseTab ? 'super franchises' : isUnassignedTab ? 'merchants' : 'franchises'}...`
        : shouldUseRemoteSearch
          ? `No matching ${isSuperFranchiseTab ? 'super franchises' : isUnassignedTab ? 'merchants' : 'franchises'} found.`
          : isSuperFranchiseTab
            ? 'No super franchises found.'
            : isUnassignedTab
              ? 'No unassigned merchants found.'
              : 'No franchises found.';

    const totalFilteredEntities = filteredEntities.length;
    const totalMatrixPages = Math.max(1, Math.ceil(totalFilteredEntities / matrixRowsPerPage));
    const currentMatrixPage = Math.min(matrixPage, totalMatrixPages);
    const matrixStartIndex = (currentMatrixPage - 1) * matrixRowsPerPage;
    const matrixEndIndex = matrixStartIndex + matrixRowsPerPage;
    const paginatedEntities = filteredEntities.slice(matrixStartIndex, matrixEndIndex);
    const pageWindowStart = Math.max(1, currentMatrixPage - 2);
    const pageWindowEnd = Math.min(totalMatrixPages, pageWindowStart + 4);
    const visibleMatrixPages = [];

    for (let pageNumber = Math.max(1, pageWindowEnd - 4); pageNumber <= pageWindowEnd; pageNumber += 1) {
      visibleMatrixPages.push(pageNumber);
    }

    return (
      <div className="w-full pb-4">
        <div className="p-4 bg-white border-b border-gray-200 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div className="w-full md:max-w-md">
              <input
                type="text"
                placeholder={searchPlaceholder}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-[#00D3CD] focus:border-[#00D3CD]"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="w-full md:w-auto">
              <label className="block text-sm font-medium text-gray-600 mb-1">Rows</label>
              <select
                value={matrixRowsPerPage}
                onChange={(e) => {
                  setMatrixRowsPerPage(Number(e.target.value));
                  setMatrixPage(1);
                }}
                className="w-full md:w-28 px-3 py-2 border border-gray-300 rounded-md focus:ring-[#00D3CD] focus:border-[#00D3CD]"
              >
                {[10, 20, 50].map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="block md:hidden p-4 space-y-3">
          {paginatedEntities.map((entity) => {
            const entityRates = matrixSource[entity.id] || [];
            return (
              <div key={entity.id} className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-[#4e73df]">{entity.name}</p>
                  </div>
                  <div className="flex flex-wrap justify-end gap-2">
                    <button
                      onClick={() => {
                        if (isSuperFranchiseTab) handleViewSuperFranchiseDetail(entity.id);
                        else if (isUnassignedTab) handleViewMerchantDetail(entity.id);
                        else handleViewFranchiseDetail(entity.id);
                      }}
                      className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-100"
                    >
                      View
                    </button>
                    <button
                      onClick={() => {
                        if (isSuperFranchiseTab) handleEditSuperFranchiseDetail(entity.id);
                        else if (isUnassignedTab) handleEditMerchantDetail(entity.id);
                        else handleEditFranchiseDetail(entity.id);
                      }}
                      className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-[#1855e4] shadow-sm transition hover:border-blue-300 hover:bg-blue-100"
                    >
                      Edit
                    </button>
                  </div>
                </div>
                {!showMatrixRateColumns && (
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <div className="rounded border border-gray-100 bg-gray-50 p-2">
                      <p className="text-[10px] uppercase tracking-wide text-gray-500">User ID</p>
                      <p className="mt-1 text-sm font-medium text-gray-900">{getEntityDisplayId(entity)}</p>
                    </div>
                    <div className="rounded border border-gray-100 bg-gray-50 p-2">
                      <p className="text-[10px] uppercase tracking-wide text-gray-500">Phone</p>
                      <p className="mt-1 text-sm font-medium text-gray-900">{getEntityPhone(entity)}</p>
                    </div>
                  </div>
                )}
                {showMatrixRateColumns && (
                  <div className="mt-3 grid grid-cols-1 gap-2">
                    {matrixAttributes.map((attr) => {
                      const rate = findMatchingRate(entityRates, attr);
                      return (
                        <div key={`${entity.id}-${getRateKey(attr)}`} className="rounded border border-gray-100 bg-gray-50 p-2">
                          <p className="text-[11px] font-semibold text-gray-700">
                            {attr.network} - {attr.method}
                          </p>
                          <p className="text-[10px] text-gray-500 mt-1">{getRateMetaLine(attr)}</p>
                          <p className="text-sm text-gray-900 mt-0.5">{rate ? formatRateValue(rate) : '-'}</p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
          {paginatedEntities.length === 0 && (
            <div className="rounded border border-gray-200 bg-white p-4 text-sm text-gray-500 text-center">
              {emptyStateMessage}
            </div>
          )}
        </div>

        <div className="hidden md:block overflow-x-auto">
          <table className="min-w-max divide-y divide-gray-200 border-collapse">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider sticky left-0 bg-gray-50 z-20 border-b border-gray-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                  {entityLabel}
                </th>
                {!showMatrixRateColumns && (
                  <>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-b border-gray-200">
                      User ID
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-b border-gray-200">
                      Phone
                    </th>
                  </>
                )}
                {showMatrixRateColumns && matrixAttributes.map(attr => (
                  <th key={getRateKey(attr)} className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap border-b border-gray-200 min-w-[180px]">
                    {attr.network} <br />
                    <span className="text-[10px] text-gray-400">{attr.method}</span>
                    <div className="text-[10px] normal-case text-gray-400 mt-1">{getRateMetaLine(attr)}</div>
                  </th>
                ))}
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider sticky right-0 bg-gray-50 z-20 border-b border-gray-200 shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {paginatedEntities.map((entity) => {
                const entityRates = matrixSource[entity.id] || [];
                return (
                  <tr key={entity.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900 sticky left-0 bg-white z-10 border-r border-gray-100 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                      <span className="text-base font-semibold text-[#4e73df]">{entity.name}</span>
                    </td>
                    {!showMatrixRateColumns && (
                      <>
                        <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-700">{getEntityDisplayId(entity)}</td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700">{getEntityPhone(entity)}</td>
                      </>
                    )}
                    {showMatrixRateColumns && matrixAttributes.map(attr => {
                      const rate = findMatchingRate(entityRates, attr);
                      return (
                        <td key={`${entity.id}-${getRateKey(attr)}`} className="px-4 py-4 whitespace-nowrap text-sm text-center text-gray-700">
                          {rate ? formatRateValue(rate) : '-'}
                        </td>
                      );
                    })}
                    <td className="px-4 py-4 whitespace-nowrap text-center text-sm font-medium sticky right-0 bg-white z-10 border-l border-gray-100 shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                      <div className="flex items-center justify-center gap-3">
                        <button
                          onClick={() => {
                            if (isSuperFranchiseTab) handleViewSuperFranchiseDetail(entity.id);
                            else if (isUnassignedTab) handleViewMerchantDetail(entity.id);
                            else handleViewFranchiseDetail(entity.id);
                          }}
                          className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-100"
                        >
                          View
                        </button>
                        <button
                          onClick={() => {
                            if (isSuperFranchiseTab) handleEditSuperFranchiseDetail(entity.id);
                            else if (isUnassignedTab) handleEditMerchantDetail(entity.id);
                            else handleEditFranchiseDetail(entity.id);
                          }}
                          className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-[#1855e4] shadow-sm transition hover:border-blue-300 hover:bg-blue-100"
                        >
                          Edit
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {paginatedEntities.length === 0 && (
                <tr>
                  <td colSpan={showMatrixRateColumns ? matrixAttributes.length + 2 : 4} className="px-6 py-4 text-center text-gray-500">
                    {emptyStateMessage}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-3 px-4 py-4 md:flex-row md:items-center md:justify-between">
          <p className="text-sm text-gray-600">
            {totalFilteredEntities > 0
              ? `Showing ${matrixStartIndex + 1}-${Math.min(matrixEndIndex, totalFilteredEntities)} of ${totalFilteredEntities}`
              : 'Showing 0 results'}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setMatrixPage((prev) => Math.max(1, prev - 1))}
              disabled={currentMatrixPage <= 1}
              className="px-3 py-1.5 rounded-md border border-gray-300 text-sm text-gray-700 disabled:opacity-50"
            >
              Previous
            </button>
            {visibleMatrixPages.map((pageNumber) => (
              <button
                key={pageNumber}
                type="button"
                onClick={() => setMatrixPage(pageNumber)}
                className={`px-3 py-1.5 rounded-md border text-sm ${currentMatrixPage === pageNumber
                    ? 'border-[#00D3CD] bg-[#00D3CD] text-white'
                    : 'border-gray-300 text-gray-700'
                  }`}
              >
                {pageNumber}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setMatrixPage((prev) => Math.min(totalMatrixPages, prev + 1))}
              disabled={currentMatrixPage >= totalMatrixPages}
              className="px-3 py-1.5 rounded-md border border-gray-300 text-sm text-gray-700 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    );
  };

  const SCOPE_BADGES = {
    super_admin_default: { label: 'Global Default', color: 'bg-indigo-100 text-indigo-800' },
    super_admin_admin: { label: 'SuperAdmin→Admin', color: 'bg-indigo-100 text-indigo-800' },
    admin_default: { label: 'Platform Default', color: 'bg-blue-100 text-blue-800' },
    admin_super_franchise: { label: 'Admin→SuperFranchise', color: 'bg-emerald-100 text-emerald-800' },
    admin_franchise: { label: 'Admin→Franchise', color: 'bg-purple-100 text-purple-800' },
    admin_merchant: { label: 'Admin→Merchant', color: 'bg-orange-100 text-orange-800' },
    franchise_default: { label: 'Franchise Default', color: 'bg-green-100 text-green-800' },
    franchise_merchant: { label: 'Franchise→Merchant', color: 'bg-teal-100 text-teal-800' },
  };
  const formatAmountRange = (rate) => {
    const min = rate.min_amount ?? 0;
    const max = rate.max_amount;
    if (max === null || max === undefined || max === '') return `${min}+`;
    return `${min} – ${max}`;
  };
  const getScopeBadge = (rate) => {
    const rawScope = rate.original_rule?.scope || rate.scope || rate.source_scope;
    return SCOPE_BADGES[rawScope] || null;
  };

  const renderDetailTable = () => {
    const isReadOnlyDetail = (detailReadOnly && activeTab !== 'default') || (!isSuperAdmin && activeTab === 'default');
    const shouldShowSpecificSettlementFilter =
      isPosTxnMode &&
      viewMode === 'detail' &&
      (activeTab === 'super_franchise' || activeTab === 'specific' || activeTab === 'unassigned');
    const filteredRates = shouldShowSpecificSettlementFilter
      ? rates.filter((rate) =>
        specificSettlementFilter === 'all'
          ? true
          : normalizeSettlementValue(rate.settlement_type) === specificSettlementFilter
      )
      : rates;
    const emptyStateMessage =
      shouldShowSpecificSettlementFilter && specificSettlementFilter !== 'all'
        ? 'No rates found for the selected settlement.'
        : 'No rates found.';
    const detailColSpan = isPosTxnMode
      ? (isReadOnlyDetail ? 11 : 12)
      : (isReadOnlyDetail ? 7 : 8);

    return (
      <div className="min-h-[400px]">
        {shouldShowSpecificSettlementFilter && (
          <div className="px-4 pt-4">
            <div className="w-full md:w-72">
              <label className="block text-sm font-medium text-gray-700 mb-1">Settlement</label>
              <select
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-[#00D3CD] focus:border-[#00D3CD]"
                value={specificSettlementFilter}
                onChange={(e) => setSpecificSettlementFilter(e.target.value)}
              >
                <option value="all">All</option>
                <option value="today_settlement">Today Settlement</option>
                <option value="next_day_settlement">Next Day Settlement</option>
              </select>
            </div>
          </div>
        )}
        {activeTab === 'default' && !isSuperAdmin && (
          <div className="mx-4 mt-4 p-3.5 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-2.5 text-blue-900 text-sm">
            <Info className="w-5 h-5 flex-shrink-0 text-blue-600 mt-0.5" />
            <div>
              <p className="font-semibold text-blue-950">Inherited from Super Admin (Read-Only)</p>
              <p className="text-xs text-blue-800 mt-0.5">
                These are global platform default POS rates set by Super Admin. Admins inherit these defaults and cannot alter them directly. To configure custom rates for your downstream users, switch to the <strong>Super Franchise Specific Rates</strong>, <strong>Franchise Specific Rates</strong>, or <strong>Merchants Under Admin Rates</strong> tabs.
              </p>
            </div>
          </div>
        )}
        {activeTab === 'default' && isSuperAdmin && (
          <div className="flex justify-stretch md:justify-end p-4 pb-0">
            <button
              onClick={openCreateRateModal}
              className="w-full md:w-auto bg-[#00D3CD] text-white px-4 py-2 rounded shadow hover:bg-[#00b8b3] transition-colors font-medium"
            >
              + Add New Rule
            </button>
          </div>
        )}
        {loadingRates ? (
          <div className="flex justify-center items-center h-64">
            <Loader />
          </div>
        ) : (
          <>
            {/* Mobile cards */}
            <div className="block md:hidden p-4 space-y-3">
              {filteredRates.map((rate) => {
                const scopeBadge = getScopeBadge(rate);
                return (
                  <div key={rate.id} className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
                    <div className="flex items-start justify-between mb-2">
                      {isPosTxnMode && scopeBadge && (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${scopeBadge.color}`}>
                          {scopeBadge.label}
                        </span>
                      )}
                      {rate.isInherited && <span className="text-[10px] text-gray-400 italic ml-auto">Inherited</span>}
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {isPosTxnMode && (
                        <div>
                          <p className="text-gray-500">Company</p>
                          <p className="font-medium text-gray-900 uppercase">{rate.company_name || '—'}</p>
                        </div>
                      )}
                      <div>
                        <p className="text-gray-500">Method</p>
                        <p className="font-medium text-gray-900">{rate.method}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Network</p>
                        <p className="font-medium text-gray-900">{rate.network || '—'}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Card Type</p>
                        <p className="font-medium text-gray-900">{rate.card_type}</p>
                      </div>
                      {!isPosTxnMode && (
                        <div>
                          <p className="text-gray-500">Sub Type</p>
                          <p className="font-medium text-gray-900">{rate.sub_type}</p>
                        </div>
                      )}
                      <div>
                        <p className="text-gray-500">Classification</p>
                        <p className="font-medium text-gray-900">{rate.card_classification || 'ANY'}</p>
                      </div>
                      {isPosTxnMode && (
                        <>
                          <div>
                            <p className="text-gray-500">Settlement</p>
                            <p className="font-medium text-gray-900">{rate.settlement_type || 'Any'}</p>
                          </div>
                          <div>
                            <p className="text-gray-500">Amount Range</p>
                            <p className="font-medium text-gray-900">{formatAmountRange(rate)}</p>
                          </div>
                          <div>
                            <p className="text-gray-500">Flat Charge</p>
                            <p className="font-medium text-gray-900">{rate.charge_flat ? `₹${rate.charge_flat}` : '—'}</p>
                          </div>
                        </>
                      )}
                      <div>
                        <p className="text-gray-500">GST (%)</p>
                        <p className="font-medium text-gray-900">{formatGstValue(rate)}</p>
                      </div>
                    </div>
                    <div className="mt-3 space-y-2">
                      <p className="text-gray-500 text-xs">
                        {activeTab === 'default'
                          ? 'Default Base Rate (%)'
                          : activeTab === 'super_franchise'
                            ? 'Super Franchise Base Rate (%)'
                            : activeTab === 'specific'
                              ? 'Override Rate (%)'
                              : 'Merchant Base Rate (%)'}
                      </p>
                      {!isPosTxnMode && editingId === rate.id ? (
                        <>
                          <input
                            type="number"
                            step="0.01"
                            className="border border-gray-300 rounded px-2 py-1 w-full mt-1 focus:ring-2 focus:ring-[#00D3CD] focus:border-transparent"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                          />
                          {hasEditableGst(rate) && (
                            <div>
                              <p className="text-gray-500 text-xs mt-2">GST (%)</p>
                              <input
                                type="number"
                                step="0.01"
                                className="border border-gray-300 rounded px-2 py-1 w-full mt-1 focus:ring-2 focus:ring-[#00D3CD] focus:border-transparent"
                                value={editGstValue}
                                onChange={(e) => setEditGstValue(e.target.value)}
                              />
                            </div>
                          )}
                        </>
                      ) : (
                        <p className="font-semibold text-gray-900 mt-1">
                          {formatRateValue(rate)} {rate.isInherited && <span className="text-xs text-gray-400 italic">(Default)</span>}
                        </p>
                      )}
                    </div>
                    {!isReadOnlyDetail && (
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        {isPosTxnMode ? (
                          <>
                            <button
                              onClick={() => handleOpenPosTxnEditModal(rate)}
                              className="text-white bg-[#4e73df] hover:bg-blue-600 px-3 py-1.5 rounded transition-colors text-sm"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDelete(rate)}
                              className="text-white bg-[#e74a3b] hover:bg-red-600 px-3 py-1.5 rounded transition-colors text-sm"
                            >
                              Delete
                            </button>
                          </>
                        ) : editingId === rate.id ? (
                          <>
                            <button
                              onClick={() => handleUpdate(rate)}
                              className="text-white bg-[#1cc88a] hover:bg-green-600 px-3 py-1.5 rounded transition-colors text-sm"
                            >
                              Update
                            </button>
                            <button
                              onClick={handleCancelEdit}
                              className="text-gray-600 bg-gray-200 hover:bg-gray-300 px-3 py-1.5 rounded transition-colors text-sm"
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => handleEditRate(rate)}
                              className="text-white bg-[#4e73df] hover:bg-blue-600 px-3 py-1.5 rounded transition-colors text-sm"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDelete(rate)}
                              className="text-white bg-[#e74a3b] hover:bg-red-600 px-3 py-1.5 rounded transition-colors text-sm"
                            >
                              Delete
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              {filteredRates.length === 0 && (
                <div className="rounded border border-gray-200 bg-white p-4 text-sm text-gray-500 text-center">
                  {emptyStateMessage}
                </div>
              )}
            </div>

            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    {isPosTxnMode && (
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Scope</th>
                    )}
                    {isPosTxnMode && (
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Company</th>
                    )}
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Method</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Network</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Card Type</th>
                    {!isPosTxnMode && (
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sub Type</th>
                    )}
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Classification</th>
                    {isPosTxnMode && (
                      <>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Settlement</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount Range</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Flat (₹)</th>
                      </>
                    )}
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">GST (%)</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {activeTab === 'default'
                        ? 'Default Base Rate (%)'
                        : activeTab === 'super_franchise'
                          ? 'Super Franchise Base Rate (%)'
                          : activeTab === 'specific'
                            ? 'Override Rate (%)'
                            : 'Merchant Base Rate (%)'}
                    </th>
                    {!isReadOnlyDetail && (
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    )}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredRates.map((rate) => {
                    const scopeBadge = getScopeBadge(rate);
                    return (
                      <tr key={rate.id} className="hover:bg-gray-50">
                        {isPosTxnMode && (
                          <td className="px-4 py-4 whitespace-nowrap text-sm">
                            {scopeBadge ? (
                              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${scopeBadge.color}`}>
                                {scopeBadge.label}
                              </span>
                            ) : '—'}
                          </td>
                        )}
                        {isPosTxnMode && (
                          <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 uppercase">{rate.company_name || '—'}</td>
                        )}
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{rate.method}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{rate.network || '—'}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{rate.card_type}</td>
                        {!isPosTxnMode && (
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{rate.sub_type}</td>
                        )}
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{rate.card_classification || 'ANY'}</td>
                        {isPosTxnMode && (
                          <>
                            <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">{rate.settlement_type || 'Any'}</td>
                            <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">{formatAmountRange(rate)}</td>
                            <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">{rate.charge_flat ? `₹${rate.charge_flat}` : '—'}</td>
                          </>
                        )}
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {!isPosTxnMode && editingId === rate.id && hasEditableGst(rate) ? (
                            <input
                              type="number"
                              step="0.01"
                              className="border border-gray-300 rounded px-2 py-1 w-24 focus:ring-2 focus:ring-[#00D3CD] focus:border-transparent"
                              value={editGstValue}
                              onChange={(e) => setEditGstValue(e.target.value)}
                            />
                          ) : (
                            formatGstValue(rate)
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {!isPosTxnMode && editingId === rate.id ? (
                            <input
                              type="number"
                              step="0.01"
                              className="border border-gray-300 rounded px-2 py-1 w-24 focus:ring-2 focus:ring-[#00D3CD] focus:border-transparent"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                            />
                          ) : (
                            <span>{formatRateValue(rate)} {rate.isInherited && <span className="text-xs text-gray-400 italic">(Default)</span>}</span>
                          )}
                        </td>
                        {!isReadOnlyDetail && (
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                            {isPosTxnMode ? (
                              <>
                                <button
                                  onClick={() => handleOpenPosTxnEditModal(rate)}
                                  className="text-white bg-[#4e73df] hover:bg-blue-600 px-3 py-1 rounded transition-colors"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => handleDelete(rate)}
                                  className="text-white bg-[#e74a3b] hover:bg-red-600 px-3 py-1 rounded transition-colors"
                                >
                                  Delete
                                </button>
                              </>
                            ) : editingId === rate.id ? (
                              <>
                                <button
                                  onClick={() => handleUpdate(rate)}
                                  className="text-white bg-[#1cc88a] hover:bg-green-600 px-3 py-1 rounded transition-colors"
                                >
                                  Update
                                </button>
                                <button
                                  onClick={handleCancelEdit}
                                  className="text-gray-600 bg-gray-200 hover:bg-gray-300 px-3 py-1 rounded transition-colors"
                                >
                                  Cancel
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={() => handleEditRate(rate)}
                                  className="text-white bg-[#4e73df] hover:bg-blue-600 px-3 py-1 rounded transition-colors"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => handleDelete(rate)}
                                  className="text-white bg-[#e74a3b] hover:bg-red-600 px-3 py-1 rounded transition-colors"
                                >
                                  Delete
                                </button>
                              </>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                  {filteredRates.length === 0 && (
                    <tr>
                      <td colSpan={detailColSpan} className="px-6 py-4 text-center text-gray-500">{emptyStateMessage}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {activeTab === 'default' && (
              <div className="flex flex-col md:flex-row items-center justify-between gap-3 px-4 py-3 bg-white border-t border-gray-200">
                <div className="text-sm text-gray-600">
                  Showing page {defaultPagination.page} of {defaultPagination.totalPages} — {defaultPagination.total} rules
                </div>
                <div className="flex items-center gap-2">
                  <button
                    disabled={defaultPagination.page <= 1}
                    onClick={() => setDefaultPagination((prev) => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                    className="rounded bg-[#00D3CD] px-3 py-1 text-sm font-medium text-white disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Prev
                  </button>
                  <span className="text-sm text-gray-700">Page {defaultPagination.page} of {defaultPagination.totalPages}</span>
                  <button
                    disabled={defaultPagination.page >= defaultPagination.totalPages}
                    onClick={() => setDefaultPagination((prev) => ({ ...prev, page: Math.min(prev.totalPages, prev.page + 1) }))}
                    className="rounded bg-[#00D3CD] px-3 py-1 text-sm font-medium text-white disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  // ── Native CC Bill Tab ───────────────────────────────────────────────────────
  const renderCcBillTab = () => {
    const filteredCcUsers = ccUsers.filter((u) => {
      const term = ccUserSearch.toLowerCase().trim();
      if (!term) return true;
      return (
        u.name?.toLowerCase().includes(term) ||
        u.email?.toLowerCase().includes(term) ||
        u.username?.toLowerCase().includes(term) ||
        u.phone?.toLowerCase().includes(term) ||
        String(u.id).includes(term)
      );
    });

    const selectedCcUserObj = ccUsers.find((u) => String(u.id) === String(selectedCcUserId));

    return (
      <div className="p-4 md:p-6 space-y-6">
        {/* 1. Super Admin Configured Baseline */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between pb-3 border-b border-gray-100 gap-2">
            <div>
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Layers className="w-5 h-5 text-indigo-600" />
                Super Admin Configured CC Bill Rates (Your Baseline)
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                These rates are configured for your account by Super Admin. All your merchants and franchises inherit these rates by default unless overridden.
              </p>
            </div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-50 text-indigo-700 text-xs font-semibold rounded-full border border-indigo-200">
              <CheckCircle2 className="w-3.5 h-3.5" /> Super Admin Baseline
            </span>
          </div>

          <div className="mt-4 overflow-x-auto">
            {adminCcBaseline.length === 0 ? (
              <div className="py-4 text-center text-sm text-gray-500">
                No custom baseline configured. Platform default (₹20.00 Flat) applies.
              </div>
            ) : (
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50 text-xs font-semibold text-gray-600 uppercase">
                  <tr>
                    <th className="px-4 py-2 text-left">Amount Slab</th>
                    <th className="px-4 py-2 text-left">Configured Rate</th>
                    <th className="px-4 py-2 text-left">Rate Type</th>
                    <th className="px-4 py-2 text-left">Source</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {adminCcBaseline.map((rule, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 font-medium text-gray-900">
                        ₹{Number(rule.from_amount).toLocaleString()} – ₹{Number(rule.to_amount).toLocaleString()}
                      </td>
                      <td className="px-4 py-2.5 font-bold text-indigo-700">
                        {rule.rate_type === 'flat' ? `₹${rule.rate}` : `${rule.rate}%`}
                      </td>
                      <td className="px-4 py-2.5 capitalize text-gray-600">{rule.rate_type}</td>
                      <td className="px-4 py-2.5">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-800">
                          {rule.source || 'Super Admin'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* 2. Admin Global Company Default Rates (For Every User Under Admin) */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-gray-100 gap-3">
            <div>
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-teal-600" />
                Company Default CC Bill Rates (Global for Every User)
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Set default rates for all merchants and franchises in your company. Every user without an individual override automatically inherits these slabs.
              </p>
            </div>
            <button
              onClick={() => handleOpenAddCcModal('company_default')}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#00D3CD] text-white text-xs font-semibold rounded-lg hover:bg-[#00b8b3] transition shadow-sm"
            >
              <Plus className="w-4 h-4" /> Add Company Default Slab
            </button>
          </div>

          <div className="mt-4 overflow-x-auto">
            {loadingCcRules ? (
              <div className="flex items-center justify-center py-6 text-gray-500">
                <Loader2 className="w-5 h-5 animate-spin mr-2 text-[#00D3CD]" /> Loading company rules...
              </div>
            ) : companyDefaultCcRules.length === 0 ? (
              <div className="py-6 text-center text-sm text-gray-500 bg-gray-50 rounded-lg">
                No company default rates configured yet. All your users currently inherit the Super Admin baseline above.
              </div>
            ) : (
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50 text-xs font-semibold text-gray-600 uppercase">
                  <tr>
                    <th className="px-4 py-2 text-left">Amount Slab</th>
                    <th className="px-4 py-2 text-left">Rate</th>
                    <th className="px-4 py-2 text-left">Type</th>
                    <th className="px-4 py-2 text-left">Status</th>
                    <th className="px-4 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {companyDefaultCcRules.map((rule) => (
                    <tr key={rule.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 font-medium text-gray-900">
                        ₹{Number(rule.from_amount).toLocaleString()} – ₹{Number(rule.to_amount).toLocaleString()}
                      </td>
                      <td className="px-4 py-2.5 font-bold text-teal-700">
                        {rule.rate_type === 'flat' ? `₹${rule.rate}` : `${rule.rate}%`}
                      </td>
                      <td className="px-4 py-2.5 capitalize text-gray-600">{rule.rate_type}</td>
                      <td className="px-4 py-2.5">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${rule.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                          {rule.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right space-x-2">
                        <button
                          onClick={() => handleOpenAddCcModal('company_default', rule)}
                          className="px-2.5 py-1 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteCcRule(rule.id, false)}
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

        {/* 3. User-Specific CC Bill Overrides */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between pb-3 border-b border-gray-100 gap-3">
            <div>
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <User className="w-5 h-5 text-blue-600" />
                User-Specific CC Bill Overrides (Super Franchises, Franchises & Merchants)
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Configure customized CC bill charges for specific super franchises, franchises, or merchants in your company.
              </p>
            </div>
            {selectedCcUserId && (
              <button
                onClick={() => handleOpenAddCcModal('user_override')}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 transition shadow-sm"
              >
                <Plus className="w-4 h-4" /> Add User Override
              </button>
            )}
          </div>

          {/* User Selector */}
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Select User (Super Franchise, Franchise, or Merchant)</label>
              <select
                className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-[#00D3CD] focus:border-transparent outline-none"
                value={selectedCcUserId}
                onChange={(e) => setSelectedCcUserId(e.target.value)}
              >
                <option value="">-- Choose a user to configure override --</option>
                {filteredCcUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    [{u.userType}] {u.name || u.username} {u.phone ? `(${u.phone})` : ''} - ID: {u.id}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Filter User List</label>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search user by name, phone, or ID..."
                  value={ccUserSearch}
                  onChange={(e) => setCcUserSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#00D3CD] focus:border-transparent outline-none"
                />
              </div>
            </div>
          </div>

          {/* Selected User Table */}
          {selectedCcUserId && (
            <div className="mt-5 border-t pt-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold text-gray-800">
                  Applicable Rates for: <span className="text-blue-700 font-bold">{selectedCcUserObj?.name || `User #${selectedCcUserId}`}</span> ({selectedCcUserObj?.userType || 'User'})
                </span>
              </div>

              {loadingSelectedCcUser ? (
                <div className="flex items-center justify-center py-6 text-gray-500">
                  <Loader2 className="w-5 h-5 animate-spin mr-2 text-blue-600" /> Loading user rates...
                </div>
              ) : selectedCcUserRules.length === 0 ? (
                <div className="py-6 text-center text-sm text-gray-500 bg-gray-50 rounded-lg">
                  No individual overrides configured for this user. This user inherits your Company Default / Super Admin Baseline rates.
                </div>
              ) : (
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50 text-xs font-semibold text-gray-600 uppercase">
                    <tr>
                      <th className="px-4 py-2 text-left">Amount Slab</th>
                      <th className="px-4 py-2 text-left">User Override Rate</th>
                      <th className="px-4 py-2 text-left">Type</th>
                      <th className="px-4 py-2 text-left">Status</th>
                      <th className="px-4 py-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {selectedCcUserRules.map((rule) => (
                      <tr key={rule.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5 font-medium text-gray-900">
                          ₹{Number(rule.from_amount).toLocaleString()} – ₹{Number(rule.to_amount).toLocaleString()}
                        </td>
                        <td className="px-4 py-2.5 font-bold text-blue-700">
                          {rule.rate_type === 'flat' ? `₹${rule.rate}` : `${rule.rate}%`}
                        </td>
                        <td className="px-4 py-2.5 capitalize text-gray-600">{rule.rate_type}</td>
                        <td className="px-4 py-2.5">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${rule.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                            {rule.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right space-x-2">
                          <button
                            onClick={() => handleOpenAddCcModal('user_override', rule)}
                            className="px-2.5 py-1 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteCcRule(rule.id, true)}
                            className="px-2.5 py-1 text-xs font-medium text-orange-600 bg-orange-50 hover:bg-orange-100 rounded"
                          >
                            Reset to Default
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  // ── Native Payout Tab ────────────────────────────────────────────────────────
  const renderPayoutTab = () => {
    const filteredPayoutUsers = payoutUsers.filter((u) => {
      const term = payoutUserSearch.toLowerCase().trim();
      if (!term) return true;
      return (
        u.name?.toLowerCase().includes(term) ||
        u.email?.toLowerCase().includes(term) ||
        u.username?.toLowerCase().includes(term) ||
        u.phone?.toLowerCase().includes(term) ||
        String(u.id).includes(term)
      );
    });

    const selectedPayoutUserObj = payoutUsers.find((u) => String(u.id) === String(selectedPayoutUserId));
    const comparisonRules = selectedPayoutUserData?.comparison || [];

    return (
      <div className="p-4 md:p-6 space-y-6">
        {/* 1. Super Admin Baseline */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between pb-3 border-b border-gray-100 gap-2">
            <div>
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Layers className="w-5 h-5 text-indigo-600" />
                Super Admin Configured Payout Rates (Your Baseline)
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                These rates are configured for your account by Super Admin. All your merchants and franchises inherit these rates by default unless overridden.
              </p>
            </div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-50 text-indigo-700 text-xs font-semibold rounded-full border border-indigo-200">
              <CheckCircle2 className="w-3.5 h-3.5" /> Super Admin Baseline
            </span>
          </div>

          <div className="mt-4 overflow-x-auto">
            {adminPayoutBaseline.length === 0 ? (
              <div className="py-4 text-center text-sm text-gray-500">
                No custom baseline configured. Platform default payout charges apply.
              </div>
            ) : (
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50 text-xs font-semibold text-gray-600 uppercase">
                  <tr>
                    <th className="px-4 py-2 text-left">Amount Slab</th>
                    <th className="px-4 py-2 text-left">Configured Rate</th>
                    <th className="px-4 py-2 text-left">Rate Type</th>
                    <th className="px-4 py-2 text-left">Source</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {adminPayoutBaseline.map((rule, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 font-medium text-gray-900">
                        ₹{Number(rule.from_amount).toLocaleString()} – ₹{Number(rule.to_amount).toLocaleString()}
                      </td>
                      <td className="px-4 py-2.5 font-bold text-indigo-700">
                        {rule.rate_type === 'flat' ? `₹${rule.rate}` : `${rule.rate}%`}
                      </td>
                      <td className="px-4 py-2.5 capitalize text-gray-600">{rule.rate_type}</td>
                      <td className="px-4 py-2.5">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-800">
                          {rule.source || 'Super Admin'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* 2. User Payout Rates & Overrides */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between pb-3 border-b border-gray-100 gap-3">
            <div>
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <User className="w-5 h-5 text-blue-600" />
                Configure User Payout Rates (Merchants & Franchises)
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Select a user to configure customized payout slab rates or view effective rate comparison.
              </p>
            </div>
            {selectedPayoutUserId && (
              <button
                onClick={() => handleOpenAddPayoutModal()}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 transition shadow-sm"
              >
                <Plus className="w-4 h-4" /> Add Payout Slab Override
              </button>
            )}
          </div>

          {/* User Selector */}
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Select User (Franchise or Merchant)</label>
              <select
                className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-[#00D3CD] focus:border-transparent outline-none"
                value={selectedPayoutUserId}
                onChange={(e) => setSelectedPayoutUserId(e.target.value)}
              >
                <option value="">-- Choose a user to view/set payout rates --</option>
                {filteredPayoutUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    [{u.userType}] {u.name || u.username} {u.phone ? `(${u.phone})` : ''} - ID: {u.id}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Filter User List</label>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search user by name, phone, or ID..."
                  value={payoutUserSearch}
                  onChange={(e) => setPayoutUserSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#00D3CD] focus:border-transparent outline-none"
                />
              </div>
            </div>
          </div>

          {/* Selected User Table */}
          {selectedPayoutUserId && (
            <div className="mt-5 border-t pt-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold text-gray-800">
                  Rate Comparison for: <span className="text-blue-700 font-bold">{selectedPayoutUserObj?.name || `User #${selectedPayoutUserId}`}</span> ({selectedPayoutUserObj?.userType || 'User'})
                </span>
              </div>

              {loadingSelectedPayoutUser ? (
                <div className="flex items-center justify-center py-6 text-gray-500">
                  <Loader2 className="w-5 h-5 animate-spin mr-2 text-blue-600" /> Loading user payout rates...
                </div>
              ) : comparisonRules.length === 0 ? (
                <div className="py-6 text-center text-sm text-gray-500 bg-gray-50 rounded-lg">
                  No rate slabs found. User inherits Super Admin platform default charges.
                </div>
              ) : (
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50 text-xs font-semibold text-gray-600 uppercase">
                    <tr>
                      <th className="px-4 py-2 text-left">Amount Range</th>
                      <th className="px-4 py-2 text-left">Super Admin Baseline</th>
                      <th className="px-4 py-2 text-left">User Configured Rate</th>
                      <th className="px-4 py-2 text-left">Effective Rate</th>
                      <th className="px-4 py-2 text-left">Source</th>
                      <th className="px-4 py-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {comparisonRules.map((row, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5 font-medium text-gray-900">
                          ₹{Number(row.from_amount).toLocaleString()} – ₹{Number(row.to_amount).toLocaleString()}
                        </td>
                        <td className="px-4 py-2.5 text-gray-600">
                          {row.baselineRule ? `${row.baselineRule.rate_type === 'flat' ? '₹' : ''}${row.baselineRule.rate}${row.baselineRule.rate_type === 'percentage' ? '%' : ''}` : '₹20.00 Flat'}
                        </td>
                        <td className="px-4 py-2.5 font-bold text-blue-700">
                          {row.userRule ? `${row.userRule.rate_type === 'flat' ? '₹' : ''}${row.userRule.rate}${row.userRule.rate_type === 'percentage' ? '%' : ''}` : '— (Inherited)'}
                        </td>
                        <td className="px-4 py-2.5 font-bold text-gray-900">
                          {row.effectiveRate}
                        </td>
                        <td className="px-4 py-2.5">
                          <span className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold ${row.hasOverride ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-700'}`}>
                            {row.source}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right space-x-2">
                          <button
                            onClick={() => handleOpenAddPayoutModal(row.userRule || { from_amount: row.from_amount, to_amount: row.to_amount, rate: row.baselineRule?.rate || '', rate_type: row.baselineRule?.rate_type || 'flat' })}
                            className="px-2.5 py-1 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded"
                          >
                            {row.hasOverride ? 'Edit' : 'Set Override'}
                          </button>
                          {row.hasOverride && (
                            <button
                              onClick={() => handleDeletePayoutRule(row.userRule.id)}
                              className="px-2.5 py-1 text-xs font-medium text-orange-600 bg-orange-50 hover:bg-orange-100 rounded"
                            >
                              Reset
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  // ── Native Rental Tab ────────────────────────────────────────────────────────
  const renderRentalTab = () => {
    return (
      <div className="p-4 md:p-6 space-y-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 max-w-2xl">
          <div className="pb-3 border-b border-gray-100 mb-4">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-indigo-600" />
              POS Machine Rental Charges
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Configure monthly rental rates charged to your franchises and merchants for POS terminals.
            </p>
          </div>

          {loadingRental ? (
            <div className="py-6 flex items-center justify-center text-gray-500">
              <Loader2 className="w-5 h-5 animate-spin mr-2 text-indigo-600" /> Loading rental charges...
            </div>
          ) : (
            <form onSubmit={handleSaveRental} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Super Franchise Monthly Rental (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="e.g. 400"
                  className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-[#00D3CD] focus:border-transparent outline-none"
                  value={rentalForm.super_franchise_rate}
                  onChange={(e) => setRentalForm({ ...rentalForm, super_franchise_rate: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Franchise Monthly Rental (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="e.g. 500"
                  className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-[#00D3CD] focus:border-transparent outline-none"
                  value={rentalForm.franchise_rate}
                  onChange={(e) => setRentalForm({ ...rentalForm, franchise_rate: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Merchant Monthly Rental (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="e.g. 700"
                  className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-[#00D3CD] focus:border-transparent outline-none"
                  value={rentalForm.merchant_rate}
                  onChange={(e) => setRentalForm({ ...rentalForm, merchant_rate: e.target.value })}
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="rentalActive"
                  className="w-4 h-4 rounded border-gray-300 text-[#00D3CD] focus:ring-[#00D3CD]"
                  checked={rentalForm.is_active}
                  onChange={(e) => setRentalForm({ ...rentalForm, is_active: e.target.checked })}
                />
                <label htmlFor="rentalActive" className="text-sm font-medium text-gray-700 cursor-pointer">
                  Active (Rental charges enabled)
                </label>
              </div>

              <div className="pt-3">
                <button
                  type="submit"
                  disabled={isSavingRental}
                  className="px-6 py-2.5 bg-[#00D3CD] text-white rounded-lg text-sm font-semibold hover:bg-[#00b8b3] transition disabled:opacity-50 inline-flex items-center gap-2"
                >
                  {isSavingRental ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Saving...
                    </>
                  ) : (
                    'Save Rental Settings'
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="bg-gray-100 min-h-screen">
      <div> {/* Wider for Matrix */}
        <div className="bg-white rounded-lg shadow-sm">

          {/* Header */}
          <div className="px-4 md:px-6 py-4 border-b border-gray-200 flex flex-col md:flex-row md:justify-between md:items-center gap-3 bg-gray-50/50 rounded-t-lg">
            <div>
              <div className="mb-2">
                <Link
                  to={location.pathname.startsWith('/super-admin') || isSuperAdmin ? '/super-admin/rate-setting' : '/admin/rate-setting'}
                  className="text-sm text-[#1855e4] hover:text-blue-800 font-medium"
                >
                  &larr; Rate Settings Home
                </Link>
              </div>
              <h1 className="text-xl md:text-2xl font-bold text-gray-900">
                {isPosTxnMode ? 'POS Transaction Charges' : 'Admin Rate Setting'}
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                {isPosTxnMode
                  ? 'Default, franchise and unassigned merchant POS transaction charge settings.'
                  : 'Set base cost for franchises, unassigned merchants, rental, CC bill and payout charges.'}
              </p>
            </div>
            {viewMode === 'detail' && activeTab !== 'default' && (
              <button
                onClick={handleBackToMatrix}
                className={backButtonClass}
              >
                &larr; Back
              </button>
            )}
          </div>

          {/* Global POS Rate Section */}
          {!isPosTxnMode && (
            <div className="px-4 md:px-6 py-5 border-b border-gray-200 bg-[#f8fbff] flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-lg font-bold text-[#112a46]">Global Fallback POS Rate</h3>
                  <span className="bg-blue-100 text-blue-800 text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border border-blue-200">Master Level</span>
                </div>
                <p className="text-xs text-gray-600">This charge is applied if no specific franchise or default rules match the transaction.</p>
              </div>

              <div className="w-full md:w-auto flex flex-col sm:flex-row md:items-center gap-3">
                <div className="bg-white border border-blue-100 px-4 py-2 rounded-lg shadow-sm flex items-center min-w-[120px] justify-between w-full sm:w-auto">
                  <span className="text-sm font-semibold text-gray-500">Current:</span>
                  {loadingGlobal ? (
                    <span className="text-sm font-bold text-gray-400 animate-pulse">Wait...</span>
                  ) : (
                    <span className="text-lg font-extrabold text-[#00D3CD] ml-2">
                      {globalRate !== null ? `${globalRate}%` : 'Not Set'}
                    </span>
                  )}
                </div>

                {isEditingGlobal ? (
                  <div className="w-full sm:w-auto flex flex-col sm:flex-row items-stretch sm:items-center gap-2 bg-white border border-gray-200 p-1.5 rounded-lg shadow-sm">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="New Rate %"
                      className="border border-gray-300 rounded px-3 py-1.5 w-full sm:w-28 text-sm focus:ring-2 focus:ring-[#00D3CD] focus:border-transparent outline-none"
                      value={globalRateInput}
                      onChange={(e) => setGlobalRateInput(e.target.value)}
                    />
                    <button
                      onClick={handleUpdateGlobalRate}
                      disabled={loadingGlobal}
                      className="bg-[#00D3CD] text-white px-4 py-1.5 rounded text-sm font-medium hover:bg-[#00b8b3] transition disabled:opacity-50"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => { setIsEditingGlobal(false); setGlobalRateInput(''); }}
                      className="bg-gray-100 text-gray-600 px-3 py-1.5 rounded text-sm font-medium hover:bg-gray-200 transition"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setIsEditingGlobal(true)}
                    className="w-full sm:w-auto bg-[#1855e4] text-white px-5 py-2 rounded-lg text-sm font-bold shadow hover:bg-blue-700 transition"
                  >
                    Change Global Rate
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Tabs */}
          <div className="grid grid-cols-1 md:flex border-b border-gray-200 overflow-x-auto">
            <button
              className={`px-4 md:px-6 py-3 font-medium text-sm focus:outline-none text-left md:text-center whitespace-nowrap ${activeTab === 'default' ? 'border-b-2 border-[#00D3CD] text-[#00D3CD]' : 'text-gray-500 hover:text-gray-700'}`}
              onClick={() => {
                setActiveTab('default');
                setViewMode('detail');
                setDetailReadOnly(false);
                setSearchTerm('');
                setSpecificSettlementFilter(DEFAULT_SPECIFIC_SETTLEMENT_FILTER);
                setSelectedSuperFranchiseId('');
                setSelectedFranchiseId('');
                setSelectedMerchantId('');
              }}
            >
              {isSuperAdmin ? 'Default POS Rates (Global for Every User)' : 'Default POS Rates (Inherited)'}
            </button>
            {!isSuperAdmin && (
              <button
                className={`px-4 md:px-6 py-3 font-medium text-sm focus:outline-none text-left md:text-center whitespace-nowrap ${activeTab === 'super_franchise' ? 'border-b-2 border-[#00D3CD] text-[#00D3CD]' : 'text-gray-500 hover:text-gray-700'}`}
                onClick={() => {
                  setActiveTab('super_franchise');
                  setViewMode('matrix');
                  setDetailReadOnly(false);
                  setSearchTerm('');
                  setSpecificSettlementFilter(DEFAULT_SPECIFIC_SETTLEMENT_FILTER);
                  setSelectedSuperFranchiseId('');
                  setSelectedFranchiseId('');
                  setSelectedMerchantId('');
                }}
              >
                Super Franchise Specific Rates
              </button>
            )}
            {isSuperAdmin && (
              <button
                className={`px-4 md:px-6 py-3 font-medium text-sm focus:outline-none text-left md:text-center whitespace-nowrap ${activeTab === 'specific' ? 'border-b-2 border-[#00D3CD] text-[#00D3CD]' : 'text-gray-500 hover:text-gray-700'}`}
                onClick={() => {
                  setActiveTab('specific');
                  setViewMode('matrix');
                  setDetailReadOnly(false);
                  setSearchTerm('');
                  setSpecificSettlementFilter(DEFAULT_SPECIFIC_SETTLEMENT_FILTER);
                  setSelectedSuperFranchiseId('');
                  setSelectedFranchiseId('');
                  setSelectedMerchantId('');
                }}
              >
                Admin Specific Rates
              </button>
            )}
            {!isSuperAdmin && (
              <button
                className={`px-4 md:px-6 py-3 font-medium text-sm focus:outline-none text-left md:text-center whitespace-nowrap ${activeTab === 'specific' ? 'border-b-2 border-[#00D3CD] text-[#00D3CD]' : 'text-gray-500 hover:text-gray-700'}`}
                onClick={() => {
                  setActiveTab('specific');
                  setViewMode('matrix');
                  setDetailReadOnly(false);
                  setSearchTerm('');
                  setSpecificSettlementFilter(DEFAULT_SPECIFIC_SETTLEMENT_FILTER);
                  setSelectedSuperFranchiseId('');
                  setSelectedFranchiseId('');
                  setSelectedMerchantId('');
                }}
              >
                Franchise Specific Rates
              </button>
            )}
            {!isSuperAdmin && (
              <button
                className={`px-4 md:px-6 py-3 font-medium text-sm focus:outline-none text-left md:text-center whitespace-nowrap ${activeTab === 'unassigned' ? 'border-b-2 border-[#00D3CD] text-[#00D3CD]' : 'text-gray-500 hover:text-gray-700'}`}
                onClick={() => {
                  setActiveTab('unassigned');
                  setViewMode('matrix');
                  setDetailReadOnly(false);
                  setSearchTerm('');
                  setSpecificSettlementFilter(DEFAULT_SPECIFIC_SETTLEMENT_FILTER);
                  setSelectedSuperFranchiseId('');
                  setSelectedFranchiseId('');
                  setSelectedMerchantId('');
                }}
              >
                Merchants Under Admin Rates
              </button>
            )}
            {!isPosTxnMode && (
              <button
                className={`px-4 md:px-6 py-3 font-medium text-sm focus:outline-none text-left md:text-center whitespace-nowrap ${activeTab === 'cc_bill' ? 'border-b-2 border-[#00D3CD] text-[#00D3CD]' : 'text-gray-500 hover:text-gray-700'}`}
                onClick={() => {
                  setActiveTab('cc_bill');
                  setDetailReadOnly(false);
                  setSearchTerm('');
                  setSelectedSuperFranchiseId('');
                  setSelectedFranchiseId('');
                  setSelectedMerchantId('');
                }}
              >
                CC Bill Pay Charges
              </button>
            )}
            {!isPosTxnMode && (
              <button
                className={`px-4 md:px-6 py-3 font-medium text-sm focus:outline-none text-left md:text-center whitespace-nowrap ${activeTab === 'payout' ? 'border-b-2 border-[#00D3CD] text-[#00D3CD]' : 'text-gray-500 hover:text-gray-700'}`}
                onClick={() => {
                  setActiveTab('payout');
                  setDetailReadOnly(false);
                  setSearchTerm('');
                  setSelectedSuperFranchiseId('');
                  setSelectedFranchiseId('');
                  setSelectedMerchantId('');
                }}
              >
                Payout Rates
              </button>
            )}
            {!isPosTxnMode && (
              <button
                className={`px-4 md:px-6 py-3 font-medium text-sm focus:outline-none text-left md:text-center whitespace-nowrap ${activeTab === 'rental' ? 'border-b-2 border-[#00D3CD] text-[#00D3CD]' : 'text-gray-500 hover:text-gray-700'}`}
                onClick={() => {
                  setActiveTab('rental');
                  setDetailReadOnly(false);
                  setSearchTerm('');
                  setSelectedSuperFranchiseId('');
                  setSelectedFranchiseId('');
                  setSelectedMerchantId('');
                }}
              >
                Rental Rate
              </button>
            )}
          </div>

          {/* Content */}
          <div className="p-0">
            {activeTab === 'default' && renderDetailTable()}
            {activeTab === 'super_franchise' && viewMode === 'matrix' && renderMatrix()}
            {activeTab === 'super_franchise' && viewMode === 'detail' && (
              <div>
                <div className="px-4 md:px-6 py-3 bg-blue-50 border-b border-blue-100 flex items-center justify-between">
                  <div className="flex items-center">
                    <span className="font-semibold text-blue-800">Super Franchise: </span>
                    <span className="ml-2 text-blue-900">{superFranchises.find(sf => sf.id === Number(selectedSuperFranchiseId))?.name || 'Unknown'}</span>
                  </div>
                  <button
                    onClick={handleBackToMatrix}
                    className="text-xs font-semibold text-blue-700 hover:text-blue-900 flex items-center gap-1 bg-white px-2.5 py-1 rounded border border-blue-200 hover:bg-blue-50 transition"
                  >
                    ← Back to Matrix
                  </button>
                </div>
                {renderDetailTable()}
              </div>
            )}
            {activeTab === 'specific' && viewMode === 'matrix' && renderMatrix()}
            {activeTab === 'specific' && viewMode === 'detail' && (
              <div>
                <div className="px-4 md:px-6 py-3 bg-blue-50 border-b border-blue-100 flex items-center justify-between">
                  <div className="flex items-center">
                    <span className="font-semibold text-blue-800">{isSuperAdmin ? 'Admin: ' : 'Franchise: '}</span>
                    <span className="ml-2 text-blue-900">{franchises.find(f => f.id === Number(selectedFranchiseId))?.name || 'Unknown'}</span>
                  </div>
                  <button
                    onClick={handleBackToMatrix}
                    className="text-xs font-semibold text-blue-700 hover:text-blue-900 flex items-center gap-1 bg-white px-2.5 py-1 rounded border border-blue-200 hover:bg-blue-50 transition"
                  >
                    ← Back to Matrix
                  </button>
                </div>
                {renderDetailTable()}
              </div>
            )}
            {activeTab === 'unassigned' && viewMode === 'matrix' && renderMatrix()}
            {activeTab === 'unassigned' && viewMode === 'detail' && (
              <div>
                <div className="px-4 md:px-6 py-3 bg-blue-50 border-b border-blue-100 flex items-center justify-between">
                  <div className="flex items-center">
                    <span className="font-semibold text-blue-800">Merchant: </span>
                    <span className="ml-2 text-blue-900">{unassignedMerchants.find((m) => m.id === Number(selectedMerchantId))?.name || 'Unknown'}</span>
                  </div>
                  <button
                    onClick={handleBackToMatrix}
                    className="text-xs font-semibold text-blue-700 hover:text-blue-900 flex items-center gap-1 bg-white px-2.5 py-1 rounded border border-blue-200 hover:bg-blue-50 transition"
                  >
                    ← Back to Matrix
                  </button>
                </div>
                {renderDetailTable()}
              </div>
            )}
            {activeTab === 'payout' && renderPayoutTab()}
            {activeTab === 'rental' && renderRentalTab()}
            {activeTab === 'cc_bill' && renderCcBillTab()}
          </div>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4 py-6">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-full">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50 shrink-0">
              <h3 className="text-lg font-bold text-gray-800">Add New Default Rate</h3>
              <button onClick={closeCreateRateModal} className="text-gray-400 hover:text-gray-600 transition text-xl leading-none">&times;</button>
            </div>
            <div className="p-6 space-y-4 overflow-y-auto">
              {/* Method */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
                <select
                  className="w-full border border-gray-300 rounded p-2 focus:ring-2 focus:ring-[#00D3CD] focus:border-transparent"
                  value={newRateForm.method}
                  onChange={(e) => {
                    const method = e.target.value;
                    const isUPI = method === 'UPI';
                    setNewRateForm(prev => ({
                      ...prev,
                      method,
                      network: isUPI ? '' : prev.network,
                      cardType: isUPI ? 'UNKNOWN' : prev.cardType,
                      cardClassification: isUPI ? 'ANY' : prev.cardClassification,
                    }));
                  }}
                >
                  {methodOptions.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>

              {/* Company Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Company Name <span className="text-gray-400 font-normal">(optional)</span></label>
                <select
                  className="w-full border border-gray-300 rounded p-2 focus:ring-2 focus:ring-[#00D3CD] focus:border-transparent"
                  value={newRateForm.companyName}
                  onChange={(e) => setNewRateForm({ ...newRateForm, companyName: e.target.value })}
                >
                  <option value="">— Any —</option>
                  <option value="paytm">Paytm</option>
                  <option value="telering">Telering</option>
                  <option value="pinelab">Pinelab</option>
                  <option value="yesbank">Yes Bank (Worldline)</option>
                </select>
              </div>

              {showNetworkAndCardType && (
                <>
                  {/* Network */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Network / Card Brand
                      {isUpiMethod && <span className="ml-2 text-xs text-gray-400">(not applicable for UPI)</span>}
                    </label>
                    <select
                      className={`w-full border rounded p-2 focus:ring-2 focus:ring-[#00D3CD] focus:border-transparent ${isUpiMethod ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed' : 'border-gray-300'}`}
                      value={newRateForm.network}
                      disabled={isUpiMethod}
                      onChange={(e) => setNewRateForm({ ...newRateForm, network: e.target.value })}
                    >
                      <option value="">— Any —</option>
                      {networkOptions.filter(n => n.trim()).map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>
                  {/* Card Type */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Card Type
                      {isUpiMethod && <span className="ml-2 text-xs text-gray-400">(fixed to UNKNOWN for UPI)</span>}
                    </label>
                    <select
                      className={`w-full border rounded p-2 focus:ring-2 focus:ring-[#00D3CD] focus:border-transparent ${isUpiMethod ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed' : 'border-gray-300'}`}
                      value={newRateForm.cardType}
                      disabled={isUpiMethod}
                      onChange={(e) => setNewRateForm({ ...newRateForm, cardType: e.target.value })}
                    >
                      {cardTypeOptions.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  {/* Card Classification */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Card Classification
                      {isUpiMethod && <span className="ml-2 text-xs text-gray-400">(fixed to ANY for UPI)</span>}
                    </label>
                    <select
                      className={`w-full border rounded p-2 focus:ring-2 focus:ring-[#00D3CD] focus:border-transparent ${isUpiMethod ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed' : 'border-gray-300'}`}
                      value={newRateForm.cardClassification}
                      disabled={isUpiMethod}
                      onChange={(e) => setNewRateForm((prev) => ({ ...prev, cardClassification: e.target.value }))}
                    >
                      {cardClassificationOptions.map((cl) => <option key={cl} value={cl}>{cl}</option>)}
                    </select>
                  </div>
                </>
              )}

              {/* Settlement Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Settlement Type <span className="text-gray-400 font-normal">(optional)</span></label>
                <select
                  className="w-full border border-gray-300 rounded p-2 focus:ring-2 focus:ring-[#00D3CD] focus:border-transparent"
                  value={newRateForm.settlementType}
                  onChange={(e) => setNewRateForm({ ...newRateForm, settlementType: e.target.value })}
                >
                  <option value="">— Any —</option>
                  <option value="today_settlement">Today Settlement</option>
                  <option value="next_day_settlement">Next Day Settlement</option>
                </select>
              </div>

              {/* Amount Slab */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Min Amount (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="w-full border border-gray-300 rounded p-2 focus:ring-2 focus:ring-[#00D3CD] focus:border-transparent"
                    placeholder="0"
                    value={newRateForm.minAmount}
                    onChange={(e) => setNewRateForm({ ...newRateForm, minAmount: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Max Amount (₹) <span className="text-gray-400 font-normal">optional</span></label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="w-full border border-gray-300 rounded p-2 focus:ring-2 focus:ring-[#00D3CD] focus:border-transparent"
                    placeholder="No limit"
                    value={newRateForm.maxAmount}
                    onChange={(e) => setNewRateForm({ ...newRateForm, maxAmount: e.target.value })}
                  />
                </div>
              </div>

              {/* Charge Inputs: Rate (%) and Flat (₹) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {activeTab === 'specific' ? 'Override Rate (%)' : activeTab === 'default' ? 'Default Base Rate (%)' : 'Rate (%)'}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="w-full border border-gray-300 rounded p-2 focus:ring-2 focus:ring-[#00D3CD] focus:border-transparent"
                    placeholder="e.g. 1.7"
                    value={newRateForm.chargePercent}
                    onChange={(e) => setNewRateForm({ ...newRateForm, chargePercent: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Flat Charge (₹) <span className="text-gray-400 font-normal">optional</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="w-full border border-gray-300 rounded p-2 focus:ring-2 focus:ring-[#00D3CD] focus:border-transparent"
                    placeholder="e.g. 2"
                    value={newRateForm.chargeFlat}
                    onChange={(e) => setNewRateForm({ ...newRateForm, chargeFlat: e.target.value })}
                  />
                </div>
              </div>

              {/* GST Required */}
              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded border-gray-300 text-[#00D3CD] focus:ring-[#00D3CD]"
                    checked={newRateForm.gstRequired}
                    onChange={(e) => setNewRateForm({ ...newRateForm, gstRequired: e.target.checked })}
                  />
                  <span className="text-sm font-medium text-gray-700">GST Applicable</span>
                </label>
              </div>

              {/* GST Percent */}
              {showGSTInput && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">GST (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    className="w-full border border-gray-300 rounded p-2 focus:ring-2 focus:ring-[#00D3CD] focus:border-transparent"
                    value={newRateForm.gstPercent}
                    onChange={(e) => setNewRateForm((prev) => ({ ...prev, gstPercent: e.target.value }))}
                    placeholder="18"
                  />
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3 shrink-0">
              <button
                onClick={closeCreateRateModal}
                className="px-4 py-2 border border-gray-300 rounded text-gray-700 font-medium hover:bg-gray-100 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateNewRate}
                disabled={isSaving}
                className="px-4 py-2 bg-[#00D3CD] text-white rounded font-medium hover:bg-[#00b8b3] transition disabled:opacity-50"
              >
                {isSaving ? 'Saving...' : 'Save Rule'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* POS Txn Edit Modal */}
      {isPosTxnEditModalOpen && posTxnEditRate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4 py-6">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-full">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50 shrink-0">
              <div>
                <h3 className="text-lg font-bold text-gray-800">Edit Charge Rule</h3>
                {(() => {
                  const badge = SCOPE_BADGES[posTxnEditRate?.original_rule?.scope || posTxnEditRate?.scope || posTxnEditRate?.source_scope];
                  return badge ? (
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${badge.color}`}>{badge.label}</span>
                  ) : null;
                })()}
              </div>
              <button onClick={() => { setIsPosTxnEditModalOpen(false); setPosTxnEditRate(null); }} className="text-gray-400 hover:text-gray-600 transition text-xl leading-none">&times;</button>
            </div>
            <div className="p-6 space-y-4 overflow-y-auto">
              {/* Method */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
                <select
                  className="w-full border border-gray-300 rounded p-2 focus:ring-2 focus:ring-[#00D3CD] focus:border-transparent"
                  value={posTxnEditForm.method}
                  onChange={(e) => {
                    const method = e.target.value;
                    const isUPI = method === 'UPI';
                    setPosTxnEditForm(prev => ({
                      ...prev,
                      method,
                      network: isUPI ? '' : prev.network,
                      cardType: isUPI ? 'UNKNOWN' : prev.cardType,
                      cardClassification: isUPI ? 'ANY' : prev.cardClassification,
                    }));
                  }}
                >
                  {methodOptions.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              {/* Company Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Company Name <span className="text-gray-400 font-normal">(optional)</span></label>
                <select
                  className="w-full border border-gray-300 rounded p-2 focus:ring-2 focus:ring-[#00D3CD] focus:border-transparent"
                  value={posTxnEditForm.companyName}
                  onChange={(e) => setPosTxnEditForm({ ...posTxnEditForm, companyName: e.target.value })}
                >
                  <option value="">— Any —</option>
                  <option value="paytm">Paytm</option>
                  <option value="telering">Telering</option>
                  <option value="pinelab">Pinelab</option>
                  <option value="yesbank">Yes Bank (Worldline)</option>
                </select>
              </div>
              {/* Network */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Network / Card Brand
                  {posTxnEditForm.method === 'UPI' && <span className="ml-2 text-xs text-gray-400">(not applicable for UPI)</span>}
                </label>
                <select
                  className={`w-full border rounded p-2 focus:ring-2 focus:ring-[#00D3CD] focus:border-transparent ${posTxnEditForm.method === 'UPI' ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed' : 'border-gray-300'}`}
                  value={posTxnEditForm.network}
                  disabled={posTxnEditForm.method === 'UPI'}
                  onChange={(e) => setPosTxnEditForm({ ...posTxnEditForm, network: e.target.value })}
                >
                  <option value="">— Any —</option>
                  {networkOptions.filter(n => n.trim()).map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              {/* Card Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Card Type
                  {posTxnEditForm.method === 'UPI' && <span className="ml-2 text-xs text-gray-400">(fixed to UNKNOWN for UPI)</span>}
                </label>
                <select
                  className={`w-full border rounded p-2 focus:ring-2 focus:ring-[#00D3CD] focus:border-transparent ${posTxnEditForm.method === 'UPI' ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed' : 'border-gray-300'}`}
                  value={posTxnEditForm.cardType}
                  disabled={posTxnEditForm.method === 'UPI'}
                  onChange={(e) => setPosTxnEditForm({ ...posTxnEditForm, cardType: e.target.value })}
                >
                  {cardTypeOptions.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              {/* Card Classification */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Card Classification
                  {posTxnEditForm.method === 'UPI' && <span className="ml-2 text-xs text-gray-400">(fixed to ANY for UPI)</span>}
                </label>
                <select
                  className={`w-full border rounded p-2 focus:ring-2 focus:ring-[#00D3CD] focus:border-transparent ${posTxnEditForm.method === 'UPI' ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed' : 'border-gray-300'}`}
                  value={posTxnEditForm.cardClassification}
                  disabled={posTxnEditForm.method === 'UPI'}
                  onChange={(e) => setPosTxnEditForm({ ...posTxnEditForm, cardClassification: e.target.value })}
                >
                  {cardClassificationOptions.map((cl) => <option key={cl} value={cl}>{cl}</option>)}
                </select>
              </div>
              {/* Settlement Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Settlement Type <span className="text-gray-400 font-normal">(optional)</span></label>
                <select
                  className="w-full border border-gray-300 rounded p-2 focus:ring-2 focus:ring-[#00D3CD] focus:border-transparent"
                  value={posTxnEditForm.settlementType}
                  onChange={(e) => setPosTxnEditForm({ ...posTxnEditForm, settlementType: e.target.value })}
                >
                  <option value="">— Any —</option>
                  <option value="today_settlement">Today Settlement</option>
                  <option value="next_day_settlement">Next Day Settlement</option>
                </select>
              </div>
              {/* Amount Slab */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Min Amount (₹)</label>
                  <input
                    type="number" step="0.01" min="0"
                    className="w-full border border-gray-300 rounded p-2 focus:ring-2 focus:ring-[#00D3CD] focus:border-transparent"
                    placeholder="0"
                    value={posTxnEditForm.minAmount}
                    onChange={(e) => setPosTxnEditForm({ ...posTxnEditForm, minAmount: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Max Amount (₹) <span className="text-gray-400 font-normal">optional</span></label>
                  <input
                    type="number" step="0.01" min="0"
                    className="w-full border border-gray-300 rounded p-2 focus:ring-2 focus:ring-[#00D3CD] focus:border-transparent"
                    placeholder="No limit"
                    value={posTxnEditForm.maxAmount}
                    onChange={(e) => setPosTxnEditForm({ ...posTxnEditForm, maxAmount: e.target.value })}
                  />
                </div>
              </div>
              {/* Charge Inputs: Rate (%) and Flat (₹) */}
              {/* Minimum rate hint — shown when admin is editing a downstream user rate */}
              {!isSuperAdmin && activeTab !== 'default' && posTxnEditRate && (() => {
                const minRate = posTxnEditRate.platform_default_rate ?? posTxnEditRate.admin_rate ?? null;
                return minRate !== null ? (
                  <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    <span className="mt-0.5 text-amber-500 shrink-0">⚠</span>
                    <span>
                      Your applicable rate for this rule is <strong>{minRate}%</strong>. You must set a rate{' '}
                      <strong>≥ {minRate}%</strong> to avoid loss.
                    </span>
                  </div>
                ) : null;
              })()}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {activeTab === 'specific' ? 'Override Rate (%)' : activeTab === 'default' ? 'Default Base Rate (%)' : 'Rate (%)'}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min={!isSuperAdmin && activeTab !== 'default' && posTxnEditRate ? (posTxnEditRate.platform_default_rate ?? posTxnEditRate.admin_rate ?? 0) : 0}
                    className="w-full border border-gray-300 rounded p-2 focus:ring-2 focus:ring-[#00D3CD] focus:border-transparent"
                    placeholder="e.g. 1.7"
                    value={posTxnEditForm.chargePercent}
                    onChange={(e) => setPosTxnEditForm({ ...posTxnEditForm, chargePercent: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Flat Charge (₹) <span className="text-gray-400 font-normal">optional</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="w-full border border-gray-300 rounded p-2 focus:ring-2 focus:ring-[#00D3CD] focus:border-transparent"
                    placeholder="e.g. 2"
                    value={posTxnEditForm.chargeFlat}
                    onChange={(e) => setPosTxnEditForm({ ...posTxnEditForm, chargeFlat: e.target.value })}
                  />
                </div>
              </div>
              {/* GST Required */}
              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded border-gray-300 text-[#00D3CD] focus:ring-[#00D3CD]"
                    checked={posTxnEditForm.gstRequired}
                    onChange={(e) => setPosTxnEditForm({ ...posTxnEditForm, gstRequired: e.target.checked })}
                  />
                  <span className="text-sm font-medium text-gray-700">GST Applicable</span>
                </label>
              </div>
              {posTxnEditForm.gstRequired && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">GST (%)</label>
                  <input
                    type="number" step="0.01" min="0" max="100"
                    className="w-full border border-gray-300 rounded p-2 focus:ring-2 focus:ring-[#00D3CD] focus:border-transparent"
                    placeholder="18"
                    value={posTxnEditForm.gstPercent}
                    onChange={(e) => setPosTxnEditForm({ ...posTxnEditForm, gstPercent: e.target.value })}
                  />
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3 shrink-0">
              <button
                onClick={() => { setIsPosTxnEditModalOpen(false); setPosTxnEditRate(null); }}
                className="px-4 py-2 border border-gray-300 rounded text-gray-700 font-medium hover:bg-gray-100 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSavePosTxnEdit}
                disabled={isSaving}
                className="px-4 py-2 bg-[#00D3CD] text-white rounded font-medium hover:bg-[#00b8b3] transition disabled:opacity-50"
              >
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CC Bill Modal */}
      {isCcModalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4 py-6">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
              <h3 className="text-base font-bold text-gray-800">
                {editingCcRule?.id ? 'Edit CC Bill Slab' : ccModalMode === 'company_default' ? 'Add Company Default CC Bill Slab' : 'Add User CC Bill Override'}
              </h3>
              <button onClick={() => { setIsCcModalOpen(false); setEditingCcRule(null); }} className="text-gray-400 hover:text-gray-600 text-xl font-bold">&times;</button>
            </div>
            <form onSubmit={handleSaveCcRule} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">From Amount (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0"
                    required
                    className="w-full border border-gray-300 rounded p-2 text-sm focus:ring-2 focus:ring-[#00D3CD] outline-none"
                    value={ccForm.from_amount}
                    onChange={(e) => setCcForm({ ...ccForm, from_amount: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">To Amount (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="10000"
                    required
                    className="w-full border border-gray-300 rounded p-2 text-sm focus:ring-2 focus:ring-[#00D3CD] outline-none"
                    value={ccForm.to_amount}
                    onChange={(e) => setCcForm({ ...ccForm, to_amount: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Rate Type</label>
                <div className="flex rounded-md border border-gray-200 p-1 bg-gray-50">
                  <button
                    type="button"
                    onClick={() => setCcForm({ ...ccForm, rate_type: 'flat' })}
                    className={`flex-1 py-1.5 text-xs font-semibold rounded ${ccForm.rate_type === 'flat' ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}
                  >
                    Flat (₹)
                  </button>
                  <button
                    type="button"
                    onClick={() => setCcForm({ ...ccForm, rate_type: 'percentage' })}
                    className={`flex-1 py-1.5 text-xs font-semibold rounded ${ccForm.rate_type === 'percentage' ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}
                  >
                    Percentage (%)
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Rate Value ({ccForm.rate_type === 'flat' ? '₹' : '%'})</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder={ccForm.rate_type === 'flat' ? 'e.g. 5.00' : 'e.g. 0.5'}
                  required
                  className="w-full border border-gray-300 rounded p-2 text-sm focus:ring-2 focus:ring-[#00D3CD] outline-none"
                  value={ccForm.rate}
                  onChange={(e) => setCcForm({ ...ccForm, rate: e.target.value })}
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="ccActive"
                  className="w-4 h-4 rounded border-gray-300 text-[#00D3CD] focus:ring-[#00D3CD]"
                  checked={ccForm.is_active}
                  onChange={(e) => setCcForm({ ...ccForm, is_active: e.target.checked })}
                />
                <label htmlFor="ccActive" className="text-xs font-medium text-gray-700 cursor-pointer">
                  Active
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => { setIsCcModalOpen(false); setEditingCcRule(null); }}
                  className="px-4 py-2 border rounded text-xs font-semibold text-gray-600 hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingCc}
                  className="px-4 py-2 bg-[#00D3CD] text-white rounded text-xs font-semibold hover:bg-[#00b8b3] disabled:opacity-50"
                >
                  {isSavingCc ? 'Saving...' : 'Save Rule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Payout Modal */}
      {isPayoutModalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4 py-6">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
              <h3 className="text-base font-bold text-gray-800">
                {editingPayoutRule?.id ? 'Edit Payout Charge Slab' : 'Add User Payout Charge Slab'}
              </h3>
              <button onClick={() => { setIsPayoutModalOpen(false); setEditingPayoutRule(null); }} className="text-gray-400 hover:text-gray-600 text-xl font-bold">&times;</button>
            </div>
            <form onSubmit={handleSavePayoutRule} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">From Amount (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0"
                    required
                    className="w-full border border-gray-300 rounded p-2 text-sm focus:ring-2 focus:ring-[#00D3CD] outline-none"
                    value={payoutForm.from_amount}
                    onChange={(e) => setPayoutForm({ ...payoutForm, from_amount: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">To Amount (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="10000"
                    required
                    className="w-full border border-gray-300 rounded p-2 text-sm focus:ring-2 focus:ring-[#00D3CD] outline-none"
                    value={payoutForm.to_amount}
                    onChange={(e) => setPayoutForm({ ...payoutForm, to_amount: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Rate Type</label>
                <div className="flex rounded-md border border-gray-200 p-1 bg-gray-50">
                  <button
                    type="button"
                    onClick={() => setPayoutForm({ ...payoutForm, rate_type: 'flat' })}
                    className={`flex-1 py-1.5 text-xs font-semibold rounded ${payoutForm.rate_type === 'flat' ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}
                  >
                    Flat (₹)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPayoutForm({ ...payoutForm, rate_type: 'percentage' })}
                    className={`flex-1 py-1.5 text-xs font-semibold rounded ${payoutForm.rate_type === 'percentage' ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}
                  >
                    Percentage (%)
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Rate Value ({payoutForm.rate_type === 'flat' ? '₹' : '%'})</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder={payoutForm.rate_type === 'flat' ? 'e.g. 10.00' : 'e.g. 1.2'}
                  required
                  className="w-full border border-gray-300 rounded p-2 text-sm focus:ring-2 focus:ring-[#00D3CD] outline-none"
                  value={payoutForm.rate}
                  onChange={(e) => setPayoutForm({ ...payoutForm, rate: e.target.value })}
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="payoutActive"
                  className="w-4 h-4 rounded border-gray-300 text-[#00D3CD] focus:ring-[#00D3CD]"
                  checked={payoutForm.is_active}
                  onChange={(e) => setPayoutForm({ ...payoutForm, is_active: e.target.checked })}
                />
                <label htmlFor="payoutActive" className="text-xs font-medium text-gray-700 cursor-pointer">
                  Active
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => { setIsPayoutModalOpen(false); setEditingPayoutRule(null); }}
                  className="px-4 py-2 border rounded text-xs font-semibold text-gray-600 hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingPayout}
                  className="px-4 py-2 bg-[#00D3CD] text-white rounded text-xs font-semibold hover:bg-[#00b8b3] disabled:opacity-50"
                >
                  {isSavingPayout ? 'Saving...' : 'Save Rule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {pendingDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={closeDeleteModal}
        >
          <div
            className="w-full max-w-md rounded-xl bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-bold text-gray-900">Delete Rate Rule</h3>
              <p className="mt-1 text-sm text-gray-600">
                {pendingDelete.tab === 'default'
                  ? 'This will permanently delete the selected default rate rule.'
                  : 'This will permanently delete the selected override rule and fall back to the default rate.'}
              </p>
            </div>
            <div className="px-6 py-4 flex justify-end gap-3">
              <button
                onClick={closeDeleteModal}
                disabled={isDeleting}
                className="px-4 py-2 border border-gray-300 rounded text-gray-700 font-medium hover:bg-gray-100 transition disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={isDeleting}
                className="px-4 py-2 bg-[#e74a3b] text-white rounded font-medium hover:bg-red-600 transition disabled:opacity-60 inline-flex items-center gap-2"
              >
                {isDeleting ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Deleting...
                  </>
                ) : (
                  'Delete'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminRateSetting;
