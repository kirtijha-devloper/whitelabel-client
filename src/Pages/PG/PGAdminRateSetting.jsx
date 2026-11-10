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
} from '../../api/rateSettingsApi';
import {
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
  getSuperAdminGlobalPosRate,
  updateSuperAdminGlobalPosRate,
} from '../../api/rateSettingsApi';
import {
  fetchPgChargeRules,
  createPgChargeRule,
  updatePgChargeRule,
  deletePgChargeRule,
} from '../../api/pgRateSettingsApi';
import { getAdminList } from '../../api/superAdminApi';
import { FranchiseAllUsers, MerchantAllUsers, SuperFranchiseAllUsers, searchUsers } from '../../api/FranchiseApi';
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

import Loader from '../../components/Loader';
import { toast } from 'react-toastify';
import { normalizeUserRole, isSuperAdmin as checkIsSuperAdmin } from '../../utils/userAccess';

const METHOD_OPTIONS = ['CARD', 'UPI'];
const NETWORK_OPTIONS = ['ALL', 'MASTER_CARD', 'VISA', 'RUPAY', 'AMEX', 'DINERS'];
const CARD_TYPE_OPTIONS = ['ALL', 'CREDIT', 'DEBIT', 'PREPAID', 'UNKNOWN'];
const CLASSIFICATION_SUB_TYPE_OPTIONS = ['any', 'consumer', 'business', 'corporate'];

const INITIAL_NEW_RATE_FORM = {
  method: 'CARD',
  network: 'VISA',
  cardType: 'CREDIT',
  cardClassification: 'any',
  subType: 'any',
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

const AdminRateSetting = ({
  mode = 'full',
  initialTab = 'default',
  isSuperAdmin: propIsSuperAdmin = false,
  currentUser: propsCurrentUser,
  role: propsRole,
  userRole: propsUserRole,
}) => {
  const location = useLocation();

  const storedUser = (() => {
    try {
      const u = localStorage.getItem('user');
      return u ? JSON.parse(u) : null;
    } catch {
      return null;
    }
  })();

  const effectiveUser = propsCurrentUser || storedUser;
  const pathRole = location.pathname.includes('/franchise')
    ? 'franchise'
    : location.pathname.includes('/super-franchise')
    ? 'super_franchise'
    : location.pathname.includes('/merchant')
    ? 'merchant'
    : location.pathname.includes('/superadmin') || location.pathname.includes('/super-admin')
    ? 'super_admin'
    : location.pathname.includes('/admin')
    ? 'admin'
    : null;

  const rawRole = propsRole || propsUserRole || effectiveUser?.role || pathRole || (propIsSuperAdmin ? 'super_admin' : 'admin');
  const normalizedRole = normalizeUserRole(rawRole);
  const isSuperAdmin = Boolean(propIsSuperAdmin === true || normalizedRole === 'super_admin' || normalizedRole === 'superadmin' || checkIsSuperAdmin(effectiveUser));
  const isSuperAdminUser = isSuperAdmin;
  const isAdminUser = normalizedRole === 'admin' && !isSuperAdmin;
  const isSuperFranchiseUser = normalizedRole === 'super_franchise' || normalizedRole === 'superfranchise';
  const isFranchiseUser = normalizedRole === 'franchise' || normalizedRole === 'franchaise';
  const isMerchantUser = normalizedRole === 'merchant';
  const isAdminOrSuperAdmin = isSuperAdmin || isAdminUser;

  const methodOptions = METHOD_OPTIONS;
  const networkOptions = NETWORK_OPTIONS;
  const cardTypeOptions = CARD_TYPE_OPTIONS;
  const cardClassificationOptions = CLASSIFICATION_SUB_TYPE_OPTIONS;
  const isPGTxnMode = mode === 'pg';
  const effectiveInitialTab = isMerchantUser ? 'default' : (initialTab || 'default');
  const [activeTab, setActiveTab] = useState(effectiveInitialTab); // 'default' | 'specific' | 'unassigned' 
  const [viewMode, setViewMode] = useState(effectiveInitialTab === 'default' ? 'detail' : 'matrix'); // 'matrix' or 'detail'
  const [specificSettlementFilter, setSpecificSettlementFilter] = useState(DEFAULT_SPECIFIC_SETTLEMENT_FILTER);

  useEffect(() => {
    const tabToSet = isMerchantUser ? 'default' : (initialTab || 'default');
    setActiveTab(tabToSet);
    setViewMode(tabToSet === 'default' ? 'detail' : 'matrix');
    setSpecificSettlementFilter(DEFAULT_SPECIFIC_SETTLEMENT_FILTER);
  }, [initialTab, isSuperAdmin, isMerchantUser]);

  useEffect(() => {
    if (isMerchantUser) {
      setActiveTab('default');
      setViewMode('detail');
      setDetailReadOnly(true);
    } else if (isSuperAdmin && ['super_franchise', 'unassigned'].includes(activeTab)) {
      setActiveTab('default');
      setViewMode('detail');
    }
  }, [isSuperAdmin, isMerchantUser, activeTab]);

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
  const [newRateChargeMode, setNewRateChargeMode] = useState('percent'); // 'percent' | 'flat'
  const [posEditChargeMode, setPosEditChargeMode] = useState('percent'); // 'percent' | 'flat'

  // Global Fallback Rate State
  const [globalRate, setGlobalRate] = useState(null);
  const [isEditingGlobal, setIsEditingGlobal] = useState(false);
  const [globalRateInput, setGlobalRateInput] = useState('');
  const [loadingGlobal, setLoadingGlobal] = useState(false);
  
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
  const getRateKey = (rate) =>
    rate?.rule_key ||
    `${rate?.method || rate?.payment_mode}-${rate?.network || rate?.card_brand}-${rate?.card_type}-${rate?.sub_type || rate?.card_classification || 'any'}-${rate?.settlement_type || ''}-${rate?.min_amount || 0}-${rate?.max_amount || 'OPEN'}`;

  const makePgRuleKey = (rule) => {
    const rawMethod = rule?.payment_mode || rule?.method || '';
    const method = String(rawMethod).trim().toUpperCase();
    const rawNetwork = rule?.card_brand || rule?.network || 'ALL';
    const network = String(rawNetwork).trim().toUpperCase().replace(/[\s_\\-]/g, '');
    const rawCardType = rule?.raw_card_type || rule?.card_type || 'ALL';
    const cardType = String(rawCardType).trim().toUpperCase().replace(/[\s_\\-]/g, '').replace('CARD', '');
    const subType = String(rule?.sub_type || rule?.card_classification || 'any').trim().toLowerCase();
    const settlement = String(rule?.settlement_type || '').trim().toLowerCase();
    const company = String(rule?.company_name || '').trim().toLowerCase();
    const minAmount = String(Number(rule?.min_amount || 0));
    const rawMax = rule?.max_amount ?? rule?.to_amount;
    const maxAmount = rawMax !== null && rawMax !== undefined && rawMax !== '' && !isNaN(Number(rawMax)) ? String(Number(rawMax)) : 'OPEN';

    return [method, network, cardType, subType, settlement, company, minAmount, maxAmount].join('|');
  };

  const buildPgEffectiveRules = (defaultRules = [], overrideRules = []) => {
    const defaultByKey = new Map();
    (defaultRules || []).forEach((r) => {
      if (r) defaultByKey.set(makePgRuleKey(r), r);
    });

    const overrideByKey = new Map();
    (overrideRules || []).forEach((r) => {
      if (r) overrideByKey.set(makePgRuleKey(r), r);
    });

    const allKeys = new Set([...defaultByKey.keys(), ...overrideByKey.keys()]);

    return Array.from(allKeys).map((key) => {
      const override = overrideByKey.get(key);
      const def = defaultByKey.get(key);

      if (override) {
        return mapRuleToAdminFormat(override, {
          defaultRule: def || override,
          baseRule: def,
          isInherited: override.isInherited === true,
        });
      }

      return mapRuleToAdminFormat(def, {
        defaultRule: def,
        baseRule: def,
        isInherited: true,
      });
    }).sort((a, b) => {
      const left = [a.method, a.network, a.card_type, a.sub_type, a.settlement_type, a.min_amount].join('|');
      const right = [b.method, b.network, b.card_type, b.sub_type, b.settlement_type, b.min_amount].join('|');
      return left.localeCompare(right);
    });
  };
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

  const newRateHasBoth =
    parseFloat(newRateForm.chargePercent || '0') > 0 &&
    parseFloat(newRateForm.chargeFlat || '0') > 0;

  const posTxnEditHasBoth =
    parseFloat(posTxnEditForm.chargePercent || '0') > 0 &&
    parseFloat(posTxnEditForm.chargeFlat || '0') > 0;

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
        const role = isSuperAdmin
          ? 'admin'
          : activeTab === 'super_franchise'
            ? 'super_franchise'
            : activeTab === 'specific'
              ? (isFranchiseUser ? 'merchant' : 'franchaise')
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
  }, [activeTab, debouncedSearchTerm, isSuperAdmin, unassignedMerchants, viewMode]);

  // Fetch Logic
  const fetchInitialData = async () => {
    setLoading(true);
    try {
      if (isPGTxnMode) {
        if (isSuperAdmin) {
          const pgRules = await fetchPgChargeRules({
            scope: 'super_admin_default'
          }).catch(() => []);
          const list = Array.isArray(pgRules) ? pgRules : (pgRules?.data || []);
          const mapped = list.map(rule => mapRuleToAdminFormat(rule, { isInherited: false }));
          setRates(mapped);
          setDefaultRatesAttributes(buildColumnStructure(mapped));
        } else if (isAdminUser) {
          const [superAdminRules, adminSpecificRules, adminRules] = await Promise.all([
            fetchPgChargeRules({ scope: 'super_admin_default' }).catch(() => []),
            fetchPgChargeRules({ scope: 'super_admin_admin' }).catch(() => []),
            fetchPgChargeRules({ scope: 'admin_default' }).catch(() => []),
          ]);
          const saList = Array.isArray(superAdminRules) ? superAdminRules : (superAdminRules?.data || []);
          const specificList = Array.isArray(adminSpecificRules) ? adminSpecificRules : (adminSpecificRules?.data || []);
          const admList = Array.isArray(adminRules) ? adminRules : (adminRules?.data || []);
          const baseDefaults = buildPgEffectiveRules(saList, specificList);
          const effective = buildPgEffectiveRules(baseDefaults, admList);
          setRates(effective);
          setDefaultRatesAttributes(buildColumnStructure(effective));
        } else if (isSuperFranchiseUser) {
          const [superAdminRules, adminRules, sfSpecificRules, sfDefaultRules] = await Promise.all([
            fetchPgChargeRules({ scope: 'super_admin_default' }).catch(() => []),
            fetchPgChargeRules({ scope: 'admin_default' }).catch(() => []),
            fetchPgChargeRules({ super_franchise_id: effectiveUser?.id }).catch(() => []),
            fetchPgChargeRules({ scope: 'super_franchise_default' }).catch(() => []),
          ]);
          const saList = Array.isArray(superAdminRules) ? superAdminRules : (superAdminRules?.data || []);
          const admList = Array.isArray(adminRules) ? adminRules : (adminRules?.data || []);
          const specificList = Array.isArray(sfSpecificRules) ? sfSpecificRules : (sfSpecificRules?.data || []);
          const sfList = Array.isArray(sfDefaultRules) ? sfDefaultRules : (sfDefaultRules?.data || []);
          const baseDefaults = buildPgEffectiveRules(saList, admList);
          const sfBase = buildPgEffectiveRules(baseDefaults, specificList);
          const effective = buildPgEffectiveRules(sfBase, sfList);
          setRates(effective);
          setDefaultRatesAttributes(buildColumnStructure(effective));
        } else if (isFranchiseUser) {
          const [superAdminRules, adminRules, fSpecificRules, fDefaultRules] = await Promise.all([
            fetchPgChargeRules({ scope: 'super_admin_default' }).catch(() => []),
            fetchPgChargeRules({ scope: 'admin_default' }).catch(() => []),
            fetchPgChargeRules({ franchaise_id: effectiveUser?.id }).catch(() => []),
            fetchPgChargeRules({ scope: 'franchise_default' }).catch(() => []),
          ]);
          const saList = Array.isArray(superAdminRules) ? superAdminRules : (superAdminRules?.data || []);
          const admList = Array.isArray(adminRules) ? adminRules : (adminRules?.data || []);
          const specificList = Array.isArray(fSpecificRules) ? fSpecificRules : (fSpecificRules?.data || []);
          const fList = Array.isArray(fDefaultRules) ? fDefaultRules : (fDefaultRules?.data || []);
          const baseDefaults = buildPgEffectiveRules(saList, admList);
          const fBase = buildPgEffectiveRules(baseDefaults, specificList);
          const effective = buildPgEffectiveRules(fBase, fList);
          setRates(effective);
          setDefaultRatesAttributes(buildColumnStructure(effective));
        } else {
          // Merchant: query own charge rules
          const merchantRules = await fetchPgChargeRules({ user_id: effectiveUser?.id }).catch(() => []);
          const mList = Array.isArray(merchantRules) ? merchantRules : (merchantRules?.data || []);
          const mapped = mList.map(rule => mapRuleToAdminFormat(rule, { isInherited: false }));
          setRates(mapped);
          setDefaultRatesAttributes(buildColumnStructure(mapped));
        }

        if (isSuperAdmin) {
          const adminsRes = await fetchSuperAdminAdminsPosMatrix().catch(() => ({ data: [] }));
          const adminRows = adminsRes?.data || [];
          const adminUsers = [];
          adminRows.forEach((item) => {
            if (item?.admin?.id) adminUsers.push(item.admin);
          });
          if (adminUsers.length === 0) {
            const fallbackAdmins = await getAdminList({ limit: 1000 }).catch(() => ({ data: [] }));
            const list = fallbackAdmins?.data || fallbackAdmins?.users || (Array.isArray(fallbackAdmins) ? fallbackAdmins : []);
            list.forEach((adm) => { if (adm?.id) adminUsers.push(adm); });
          }
          setFranchises(adminUsers);
        } else if (isAdminUser) {
          const [superFranchisesData, franchisesData, unassignedMerchantsData] = await Promise.all([
            getSuperFranchises().catch(() => []),
            getFranchises().catch(() => []),
            getUnassignedMerchants().catch(() => []),
          ]);
          setSuperFranchises(superFranchisesData || []);
          setFranchises(franchisesData || []);
          setUnassignedMerchants(unassignedMerchantsData || []);
        } else if (isSuperFranchiseUser) {
          const [franchisesData, merchantsData] = await Promise.all([
            getFranchises().catch(() => []),
            MerchantAllUsers().catch(() => []),
          ]);
          setFranchises(franchisesData || []);
          setUnassignedMerchants(Array.isArray(merchantsData) ? merchantsData : (merchantsData?.data || merchantsData?.users || []));
        } else if (isFranchiseUser) {
          const merchantsData = await MerchantAllUsers().catch(() => []);
          const list = Array.isArray(merchantsData) ? merchantsData : (merchantsData?.data || merchantsData?.users || []);
          setFranchises(list || []);
        } else if (isMerchantUser) {
          setDetailReadOnly(true);
        }
        return;
      }

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
      if (isPGTxnMode) {
        const [sfRulesUser, sfRulesSF, adminRules, superAdminRules] = await Promise.all([
          fetchPgChargeRules({ user_id: sfId }).catch(() => []),
          fetchPgChargeRules({ super_franchise_id: sfId }).catch(() => []),
          fetchPgChargeRules({ scope: 'admin_default' }).catch(() => []),
          fetchPgChargeRules({ scope: 'super_admin_default' }).catch(() => []),
        ]);
        const sfList = [
          ...(Array.isArray(sfRulesUser) ? sfRulesUser : (sfRulesUser?.data || [])),
          ...(Array.isArray(sfRulesSF) ? sfRulesSF : (sfRulesSF?.data || []))
        ];
        const admList = Array.isArray(adminRules) ? adminRules : (adminRules?.data || []);
        const saList = Array.isArray(superAdminRules) ? superAdminRules : (superAdminRules?.data || []);
        const baseDefaults = buildPgEffectiveRules(saList, admList);
        const effective = buildPgEffectiveRules(baseDefaults, sfList);
        setRates(effective);
        return;
      }
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
      const data = isSuperAdmin ? await getSuperAdminGlobalPosRate() : null;
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
      if (isPGTxnMode) {
        if (id === 'default') {
          if (isSuperAdmin) {
            const pgRules = await fetchPgChargeRules({
              scope: 'super_admin_default'
            }).catch(() => []);
            const list = Array.isArray(pgRules) ? pgRules : (pgRules?.data || []);
            const mapped = list.map(rule => mapRuleToAdminFormat(rule, { isInherited: false }));
            setRates(mapped);
          } else if (isAdminUser) {
            const [superAdminRules, adminSpecificRules, adminRules] = await Promise.all([
              fetchPgChargeRules({ scope: 'super_admin_default' }).catch(() => []),
              fetchPgChargeRules({ scope: 'super_admin_admin' }).catch(() => []),
              fetchPgChargeRules({ scope: 'admin_default' }).catch(() => []),
            ]);
            const saList = Array.isArray(superAdminRules) ? superAdminRules : (superAdminRules?.data || []);
            const specificList = Array.isArray(adminSpecificRules) ? adminSpecificRules : (adminSpecificRules?.data || []);
            const admList = Array.isArray(adminRules) ? adminRules : (adminRules?.data || []);
            const baseDefaults = buildPgEffectiveRules(saList, specificList);
            const effective = buildPgEffectiveRules(baseDefaults, admList);
            setRates(effective);
          } else if (isSuperFranchiseUser) {
            const [superAdminRules, adminRules, sfSpecificRules, sfDefaultRules] = await Promise.all([
              fetchPgChargeRules({ scope: 'super_admin_default' }).catch(() => []),
              fetchPgChargeRules({ scope: 'admin_default' }).catch(() => []),
              fetchPgChargeRules({ super_franchise_id: effectiveUser?.id }).catch(() => []),
              fetchPgChargeRules({ scope: 'super_franchise_default' }).catch(() => []),
            ]);
            const saList = Array.isArray(superAdminRules) ? superAdminRules : (superAdminRules?.data || []);
            const admList = Array.isArray(adminRules) ? adminRules : (adminRules?.data || []);
            const specificList = Array.isArray(sfSpecificRules) ? sfSpecificRules : (sfSpecificRules?.data || []);
            const sfList = Array.isArray(sfDefaultRules) ? sfDefaultRules : (sfDefaultRules?.data || []);
            const baseDefaults = buildPgEffectiveRules(saList, admList);
            const sfBase = buildPgEffectiveRules(baseDefaults, specificList);
            const effective = buildPgEffectiveRules(sfBase, sfList);
            setRates(effective);
          } else if (isFranchiseUser) {
            const [superAdminRules, adminRules, fSpecificRules, fDefaultRules] = await Promise.all([
              fetchPgChargeRules({ scope: 'super_admin_default' }).catch(() => []),
              fetchPgChargeRules({ scope: 'admin_default' }).catch(() => []),
              fetchPgChargeRules({ franchaise_id: effectiveUser?.id }).catch(() => []),
              fetchPgChargeRules({ scope: 'franchise_default' }).catch(() => []),
            ]);
            const saList = Array.isArray(superAdminRules) ? superAdminRules : (superAdminRules?.data || []);
            const admList = Array.isArray(adminRules) ? adminRules : (adminRules?.data || []);
            const specificList = Array.isArray(fSpecificRules) ? fSpecificRules : (fSpecificRules?.data || []);
            const fList = Array.isArray(fDefaultRules) ? fDefaultRules : (fDefaultRules?.data || []);
            const baseDefaults = buildPgEffectiveRules(saList, admList);
            const fBase = buildPgEffectiveRules(baseDefaults, specificList);
            const effective = buildPgEffectiveRules(fBase, fList);
            setRates(effective);
          } else {
            const merchantRules = await fetchPgChargeRules({ user_id: effectiveUser?.id }).catch(() => []);
            const mList = Array.isArray(merchantRules) ? merchantRules : (merchantRules?.data || []);
            const mapped = mList.map(rule => mapRuleToAdminFormat(rule, { isInherited: false }));
            setRates(mapped);
          }
        } else if (isSuperAdmin) {
          const [adminOverrides, superAdminRules] = await Promise.all([
            fetchPgChargeRules({ user_id: id }).catch(() => []),
            fetchPgChargeRules({ scope: 'super_admin_default' }).catch(() => []),
          ]);
          const uList = Array.isArray(adminOverrides) ? adminOverrides : (adminOverrides?.data || []);
          const saList = Array.isArray(superAdminRules) ? superAdminRules : (superAdminRules?.data || []);
          const effective = buildPgEffectiveRules(saList, uList);
          setRates(effective);
        } else if (isFranchiseUser) {
          const [mOverrides, fDefaultRules, adminRules, superAdminRules] = await Promise.all([
            fetchPgChargeRules({ user_id: id }).catch(() => []),
            fetchPgChargeRules({ scope: 'franchise_default' }).catch(() => []),
            fetchPgChargeRules({ scope: 'admin_default' }).catch(() => []),
            fetchPgChargeRules({ scope: 'super_admin_default' }).catch(() => []),
          ]);
          const mList = Array.isArray(mOverrides) ? mOverrides : (mOverrides?.data || []);
          const fList = Array.isArray(fDefaultRules) ? fDefaultRules : (fDefaultRules?.data || []);
          const admList = Array.isArray(adminRules) ? adminRules : (adminRules?.data || []);
          const saList = Array.isArray(superAdminRules) ? superAdminRules : (superAdminRules?.data || []);
          const baseDefaults = buildPgEffectiveRules(saList, admList);
          const fEffective = buildPgEffectiveRules(baseDefaults, fList);
          const effective = buildPgEffectiveRules(fEffective, mList);
          setRates(effective);
        } else {
          const [fRulesUser, fRulesFranchise, adminRules, superAdminRules] = await Promise.all([
            fetchPgChargeRules({ user_id: id }).catch(() => []),
            fetchPgChargeRules({ franchaise_id: id }).catch(() => []),
            fetchPgChargeRules({ scope: 'admin_default' }).catch(() => []),
            fetchPgChargeRules({ scope: 'super_admin_default' }).catch(() => []),
          ]);
          const fList = [
            ...(Array.isArray(fRulesUser) ? fRulesUser : (fRulesUser?.data || [])),
            ...(Array.isArray(fRulesFranchise) ? fRulesFranchise : (fRulesFranchise?.data || []))
          ];
          const admList = Array.isArray(adminRules) ? adminRules : (adminRules?.data || []);
          const saList = Array.isArray(superAdminRules) ? superAdminRules : (superAdminRules?.data || []);
          const baseDefaults = buildPgEffectiveRules(saList, admList);
          const effective = buildPgEffectiveRules(baseDefaults, fList);
          setRates(effective);
        }
        return;
      }

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
      if (isPGTxnMode) {
        const [mOverrides, adminRules, superAdminRules] = await Promise.all([
          fetchPgChargeRules({ user_id: id }).catch(() => []),
          fetchPgChargeRules({ scope: 'admin_default' }).catch(() => []),
          fetchPgChargeRules({ scope: 'super_admin_default' }).catch(() => []),
        ]);
        const mList = Array.isArray(mOverrides) ? mOverrides : (mOverrides?.data || []);
        const admList = Array.isArray(adminRules) ? adminRules : (adminRules?.data || []);
        const saList = Array.isArray(superAdminRules) ? superAdminRules : (superAdminRules?.data || []);
        const baseDefaults = buildPgEffectiveRules(saList, admList);
        const effective = buildPgEffectiveRules(baseDefaults, mList);
        setRates(effective);
        return;
      }
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
    if (isPGTxnMode) {
      if (activeTab === 'default') {
        await fetchFranchiseRates('default', defaultPagination.page, defaultPagination.limit);
        await fetchInitialData();
      } else if (activeTab === 'super_franchise' && selectedSuperFranchiseId) {
        await fetchSuperFranchiseRates(selectedSuperFranchiseId);
      } else if (activeTab === 'specific' && selectedFranchiseId) {
        await fetchFranchiseRates(selectedFranchiseId);
      } else if (activeTab === 'unassigned' && selectedMerchantId) {
        await fetchMerchantRates(selectedMerchantId);
      }
      return;
    }

    if (activeTab === 'default') {
      await fetchFranchiseRates('default', defaultPagination.page, defaultPagination.limit);
      await fetchInitialData();
      return;
    }

    if (activeTab === "specific" && isSuperAdmin) {
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
    if (editValue === '') {
      toast.error('Please enter a valid rate.');
      return;
    }

    if (hasEditableGst(rate) && editGstValue === '') {
      toast.error('Please enter a valid GST rate.');
      return;
    }

    // ── Minimum rate guard: admin cannot charge downstream users less than their own cost ──
    if (activeTab !== 'default' && rate) {
      const adminCost = Number(
        rate.base_rate ??
        rate.admin_rate ??
        rate.platform_default_rate ??
        (rate.isInherited ? rate.charge_percent : 0) ??
        0
      );
      const enteredRate = parseFloat(editValue || '0');
      if (adminCost > 0 && !isNaN(enteredRate) && enteredRate < adminCost) {
        toast.error(
          `Rate (%) cannot be less than default rate of ${adminCost}% for this rule. You must charge at least ${adminCost}%.`
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
      if (isPGTxnMode) {
        const pgUpdates = {
          charge_percent: editValue,
          ...(hasEditableGst(rate) && { gst_percent: editGstValue })
        };
        updatedRate = await updatePgChargeRule(rate.rule_id || rate.id, pgUpdates);
      } else if (activeTab === 'default') {
        if (isSuperAdmin) {
          updatedRate = await updatePlatformDefaultPosRule(rate.rule_id || rate.id, updates);
        } else {
          updatedRate = await updateFranchiseRate('default', rate, updates);
        }
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
    if (newRateHasBoth) {
      toast.error("Please set either Flat Rate or Base Rate (%), not both.");
      return;
    }
    if ((newRateForm.chargePercent === '' || newRateForm.chargePercent === undefined) &&
      (newRateForm.chargeFlat === '' || newRateForm.chargeFlat === undefined)) {
      toast.error("Please enter a rate percentage or flat charge amount.");
      return;
    }
    if (parseFloat(newRateForm.minAmount || '0') < 0) {
      toast.error("Min Amount cannot be negative.");
      return;
    }
    if (newRateForm.maxAmount !== '' && newRateForm.maxAmount !== null && newRateForm.maxAmount !== undefined) {
      if (parseFloat(newRateForm.maxAmount) < 0) {
        toast.error("Max Amount cannot be negative.");
        return;
      }
      if (parseFloat(newRateForm.maxAmount) < parseFloat(newRateForm.minAmount || '0')) {
        toast.error("Max Amount cannot be less than Min Amount.");
        return;
      }
    }
    if (showGSTInput && !newRateForm.gstPercent) {
      toast.error("Please enter a GST percentage.");
      return;
    }
    if (isAdminOrSuperAdmin) {
      const selectedSub = (newRateForm.subType || '').trim();
      if (!selectedSub) {
        toast.error("Classification sub type is required.");
        return;
      }
    }
    setIsSaving(true);
    try {
      const chosenSubType = newRateForm.subType || newRateForm.cardClassification || 'any';
      const payload = {
        method: newRateForm.method,
        network: newRateForm.network || null,
        card_type: newRateForm.cardType || null,
        card_classification: chosenSubType,
        sub_type: chosenSubType,
        settlement_type: newRateForm.settlementType || null,
        min_amount: newRateForm.minAmount || '0',
        max_amount: newRateForm.maxAmount || null,
        charge_flat: newRateForm.chargeFlat !== '' && newRateForm.chargeFlat !== null && newRateForm.chargeFlat !== undefined ? String(newRateForm.chargeFlat) : '0',
        gst_required: newRateForm.gstRequired,
        gst_rate: newRateForm.gstRequired ? newRateForm.gstPercent : '0',
        base_rate: newRateForm.chargePercent !== '' && newRateForm.chargePercent !== null && newRateForm.chargePercent !== undefined ? String(newRateForm.chargePercent) : '0',
        company_name: newRateForm.companyName || null
      };

      // Check for duplicate in current rates (if company, method, network, card type, classification sub type, settlement match and min/max overlap and is_active is true)
      const enteredMethod = String(payload.method || '').trim().toUpperCase();
      const enteredNetwork = String(payload.network || 'ALL').trim().toUpperCase().replace(/[\s_\\-]/g, '');
      const enteredCardType = String(payload.card_type || 'ALL').trim().toUpperCase().replace(/[\s_\\-]/g, '').replace('CARD', '');
      const enteredSubType = String(payload.card_classification || payload.sub_type || 'any').trim().toLowerCase();
      const enteredSettlement = String(payload.settlement_type || '').trim().toLowerCase();
      const enteredCompany = String(payload.company_name || '').trim().toLowerCase();
      const enteredMin = parseFloat(payload.min_amount || '0');
      const enteredMax = payload.max_amount !== null && payload.max_amount !== '' && !isNaN(parseFloat(payload.max_amount))
        ? parseFloat(payload.max_amount)
        : null;

      const m1 = enteredMin;
      const m2 = enteredMax !== null ? enteredMax : Infinity;

      const duplicateRule = rates.find((r) => {
        if (r.is_active === false) return false;

        const rMethod = String(r.payment_mode || r.method || '').trim().toUpperCase();
        const rNetwork = String(r.card_brand || r.network || 'ALL').trim().toUpperCase().replace(/[\s_\\-]/g, '');
        const rCardType = String(r.raw_card_type || r.card_type || 'ALL').trim().toUpperCase().replace(/[\s_\\-]/g, '').replace('CARD', '');
        const rSubType = String(r.sub_type || r.card_classification || 'any').trim().toLowerCase();
        const rSettlement = String(r.settlement_type || '').trim().toLowerCase();
        const rCompany = String(r.company_name || '').trim().toLowerCase();

        const specsMatch = (
          rMethod === enteredMethod &&
          (rNetwork === enteredNetwork || (!rNetwork && !enteredNetwork)) &&
          (rCardType === enteredCardType || (!rCardType && !enteredCardType)) &&
          rSubType === enteredSubType &&
          rSettlement === enteredSettlement &&
          (!enteredCompany || !rCompany || rCompany === enteredCompany)
        );

        if (!specsMatch) return false;

        const rMin = r.min_amount != null ? parseFloat(r.min_amount) : 0;
        const rawRMax = r.max_amount ?? r.to_amount;
        const rMax = rawRMax !== null && rawRMax !== undefined && rawRMax !== '' && !isNaN(parseFloat(rawRMax))
          ? parseFloat(rawRMax)
          : null;

        const s1 = rMin;
        const s2 = rMax !== null ? rMax : Infinity;

        // Check if ranges overlap: [m1, m2] and [s1, s2]
        return m1 <= s2 && m2 >= s1;
      });

      if (duplicateRule) {
        const existingRange = `${duplicateRule.min_amount != null ? duplicateRule.min_amount : 0} - ${duplicateRule.max_amount != null ? duplicateRule.max_amount : 'Open'}`;
        toast.error(`Duplicate rule: An active rate rule with matching specifications and an overlapping amount range (${existingRange}) already exists.`);
        setIsSaving(false);
        return;
      }

      if (isPGTxnMode) {
        await createPgChargeRule({
          gateway: 'ALL',
          payment_mode: payload.method,
          card_brand: payload.network,
          card_type: payload.card_type,
          card_classification: payload.card_classification,
          sub_type: payload.sub_type,
          settlement_type: payload.settlement_type,
          min_amount: payload.min_amount,
          max_amount: payload.max_amount,
          charge_percent: payload.base_rate,
          charge_flat: payload.charge_flat,
          gst_required: payload.gst_required,
          gst_percent: payload.gst_rate,
          company_name: payload.company_name,
          scope: isSuperAdmin
            ? (activeTab === 'specific' ? 'super_admin_admin' : 'super_admin_default')
            : (activeTab === 'specific'
                ? (isFranchiseUser
                    ? 'franchise_merchant'
                    : (isSuperFranchiseUser
                        ? 'super_franchise_franchise'
                        : 'admin_franchise'))
                : (activeTab === 'unassigned'
                    ? (isSuperFranchiseUser
                        ? 'super_franchise_merchant'
                        : 'admin_merchant')
                    : (activeTab === 'super_franchise'
                        ? 'admin_super_franchise'
                        : (isFranchiseUser
                            ? 'franchise_default'
                            : (isSuperFranchiseUser
                                ? 'super_franchise_default'
                                : 'admin_default'))))),
          target_user_id: activeTab === 'unassigned'
            ? selectedMerchantId
            : (activeTab === 'specific'
                ? selectedFranchiseId
                : (activeTab === 'super_franchise' ? selectedSuperFranchiseId : null)),
          target_franchise_id: (activeTab === 'specific' && !isFranchiseUser) ? selectedFranchiseId : null,
          target_super_franchise_id: activeTab === 'super_franchise' ? selectedSuperFranchiseId : null
        });
        toast.success("New PG charge rule created successfully.");
      } else if (activeTab === 'default') {
        if (isSuperAdmin) {
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
        } else {
          await createDefaultFranchiseRate({
            method: payload.method,
            network: payload.network,
            cardType: payload.card_type,
            cardClassification: payload.card_classification,
            settlementType: payload.settlement_type,
            minAmount: payload.min_amount,
            maxAmount: payload.max_amount,
            chargePercent: payload.base_rate,
            chargeFlat: payload.charge_flat,
            gstRequired: payload.gst_required,
            gstPercent: payload.gst_rate,
            companyName: payload.company_name,
          });
          toast.success("New default rate created successfully.");
        }
      } else if (isSuperAdmin && activeTab === 'specific' && selectedFranchiseId) {
        await createAdminPosRule({
          user_id: selectedFranchiseId,
          payment_mode: payload.method,
          card_brand: (!payload.network || payload.network === 'ALL') ? null : payload.network,
          card_type: (!payload.card_type || payload.card_type === 'ALL') ? null : payload.card_type,
          card_classification: (!payload.card_classification || payload.card_classification === 'ANY' || payload.card_classification === 'ALL') ? null : payload.card_classification,
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
      } else if (activeTab === 'super_franchise' && selectedSuperFranchiseId) {
        await updateSuperFranchiseRate(selectedSuperFranchiseId, { isInherited: true }, {
          payment_mode: payload.method,
          card_brand: (!payload.network || payload.network === 'ALL') ? null : payload.network,
          card_type: (!payload.card_type || payload.card_type === 'ALL') ? null : payload.card_type,
          card_classification: (!payload.card_classification || payload.card_classification === 'ANY' || payload.card_classification === 'ALL') ? null : payload.card_classification,
          settlement_type: payload.settlement_type,
          min_amount: payload.min_amount,
          max_amount: payload.max_amount,
          charge_percent: payload.base_rate,
          charge_flat: payload.charge_flat,
          gst_required: payload.gst_required,
          gst_percent: payload.gst_rate,
          company_name: payload.company_name,
        });
        toast.success("Super Franchise rate created successfully.");
      } else if (activeTab === 'specific' && selectedFranchiseId) {
        await updateFranchiseRate(selectedFranchiseId, { isInherited: true }, {
          payment_mode: payload.method,
          card_brand: (!payload.network || payload.network === 'ALL') ? null : payload.network,
          card_type: (!payload.card_type || payload.card_type === 'ALL') ? null : payload.card_type,
          card_classification: (!payload.card_classification || payload.card_classification === 'ANY' || payload.card_classification === 'ALL') ? null : payload.card_classification,
          settlement_type: payload.settlement_type,
          min_amount: payload.min_amount,
          max_amount: payload.max_amount,
          charge_percent: payload.base_rate,
          charge_flat: payload.charge_flat,
          gst_required: payload.gst_required,
          gst_percent: payload.gst_rate,
          company_name: payload.company_name,
        });
        toast.success("Franchise rate created successfully.");
      } else if (activeTab === 'unassigned' && selectedMerchantId) {
        await updateMerchantRate(selectedMerchantId, { isInherited: true }, {
          payment_mode: payload.method,
          card_brand: (!payload.network || payload.network === 'ALL') ? null : payload.network,
          card_type: (!payload.card_type || payload.card_type === 'ALL') ? null : payload.card_type,
          card_classification: (!payload.card_classification || payload.card_classification === 'ANY' || payload.card_classification === 'ALL') ? null : payload.card_classification,
          settlement_type: payload.settlement_type,
          min_amount: payload.min_amount,
          max_amount: payload.max_amount,
          charge_percent: payload.base_rate,
          charge_flat: payload.charge_flat,
          gst_required: payload.gst_required,
          gst_percent: payload.gst_rate,
          company_name: payload.company_name,
        });
        toast.success("Merchant rate created successfully.");
      } else {
        await createDefaultFranchiseRate({
          ...payload,
          card_brand: (!payload.network || payload.network === 'ALL') ? null : payload.network,
          card_type: (!payload.card_type || payload.card_type === 'ALL') ? null : payload.card_type,
          card_classification: (!payload.card_classification || payload.card_classification === 'ANY' || payload.card_classification === 'ALL') ? null : payload.card_classification,
        });
        toast.success("New default rate created successfully.");
      }
      setIsModalOpen(false);

      // Reset form
      setNewRateForm(INITIAL_NEW_RATE_FORM);
      // Refresh Data
      fetchInitialData();
      if (activeTab === 'default') {
        fetchFranchiseRates('default');
      } else if (activeTab === 'super_franchise' && selectedSuperFranchiseId) {
        fetchSuperFranchiseRates(selectedSuperFranchiseId);
      } else if (activeTab === 'specific' && selectedFranchiseId) {
        fetchFranchiseRates(selectedFranchiseId);
      } else if (activeTab === 'unassigned' && selectedMerchantId) {
        fetchMerchantRates(selectedMerchantId);
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
    if (!rate?.id && !rate?.rule_id) return;

    const deleteId =
      (Number.isFinite(Number(rate.rule_id)) && Number(rate.rule_id) > 0 ? Number(rate.rule_id) : null) ||
      (Number.isFinite(Number(rate.id)) && Number(rate.id) > 0 ? Number(rate.id) : null) ||
      (Number.isFinite(Number(rate.original_rule?.id)) && Number(rate.original_rule?.id) > 0 ? Number(rate.original_rule?.id) : null) ||
      rate.rule_id ||
      rate.id;
    setIsDeleting(true);
    try {
      if (isPGTxnMode) {
        if (rate?.isInherited) {
          toast.info('Cannot delete inherited platform default rate. You can customize it by clicking Edit.');
          setPendingDelete(null);
          setIsDeleting(false);
          return;
        }
        await deletePgChargeRule(deleteId);
        toast.success('PG charge rule override deleted. Reverted to default.');
      } else if (isSuperAdmin && tab === 'default') {
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
      } else if (tab === 'super_franchise' && selectedSuperFranchiseId) {
        await fetchSuperFranchiseRates(selectedSuperFranchiseId);
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
    if (!isAdminOrSuperAdmin) {
      toast.error('Only Admin and Super Admin can create new rules.');
      return;
    }
    setNewRateChargeMode('percent');
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
    const hasFlat = parseFloat(flatVal || '0') > 0 && parseFloat(pctVal || '0') <= 0;
    setPosEditChargeMode(hasFlat ? 'flat' : 'percent');
    const rawNetwork = rate.network || rate.card_brand;
    const networkVal = isUPI ? '' : (!rawNetwork || rawNetwork === 'ALL' ? 'ALL' : String(rawNetwork).toUpperCase());
    const rawCardType = rate.card_type;
    const cardTypeVal = isUPI ? 'UNKNOWN' : (!rawCardType || rawCardType === 'N/A' || rawCardType === 'ALL' || rawCardType === 'ANY' ? 'ALL' : String(rawCardType).toUpperCase());
    const rawClassification = rate.sub_type || rate.card_classification || 'any';
    const classificationVal = isUPI ? 'any' : String(rawClassification).toLowerCase();
    setPosTxnEditForm({
      method,
      network: networkVal,
      cardType: cardTypeVal,
      cardClassification: classificationVal,
      subType: classificationVal,
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
    if (posTxnEditHasBoth) {
      toast.error("Please set either Flat Rate or Base Rate (%), not both.");
      return;
    }
    if ((posTxnEditForm.chargePercent === '' || posTxnEditForm.chargePercent === undefined) &&
      (posTxnEditForm.chargeFlat === '' || posTxnEditForm.chargeFlat === undefined)) {
      toast.error('Please enter a charge percentage or flat amount.');
      return;
    }
    if (parseFloat(posTxnEditForm.minAmount || '0') < 0) {
      toast.error("Min Amount cannot be negative.");
      return;
    }
    if (posTxnEditForm.maxAmount !== '' && posTxnEditForm.maxAmount !== null && posTxnEditForm.maxAmount !== undefined) {
      if (parseFloat(posTxnEditForm.maxAmount) < 0) {
        toast.error("Max Amount cannot be negative.");
        return;
      }
      if (parseFloat(posTxnEditForm.maxAmount) < parseFloat(posTxnEditForm.minAmount || '0')) {
        toast.error("Max Amount cannot be less than Min Amount.");
        return;
      }
    }
    if (isAdminOrSuperAdmin) {
      const selectedSub = (posTxnEditForm.subType || '').trim();
      if (!selectedSub) {
        toast.error("Classification sub type is required.");
        return;
      }
    }

    // ── Minimum rate / slab guard: admin cannot charge downstream users less than their own cost ──
    if (activeTab !== 'default' && posTxnEditRate) {
      const adminCost = Number(
        posTxnEditRate.base_rate ??
        posTxnEditRate.admin_rate ??
        posTxnEditRate.platform_default_rate ??
        (posTxnEditRate.isInherited ? posTxnEditRate.charge_percent : 0) ??
        0
      );
      const enteredRate = parseFloat(posTxnEditForm.chargePercent || '0');
      if (adminCost > 0 && !isNaN(enteredRate) && enteredRate < adminCost) {
        toast.error(
          `Rate (%) cannot be less than default rate of ${adminCost}% for this rule. You must charge at least ${adminCost}%.`
        );
        return;
      }

      const adminFlatCost = Number(
        posTxnEditRate.base_flat_rate ??
        posTxnEditRate.admin_flat_rate ??
        posTxnEditRate.platform_default_flat_rate ??
        (posTxnEditRate.isInherited ? posTxnEditRate.charge_flat : 0) ??
        0
      );
      const enteredFlat = parseFloat(posTxnEditForm.chargeFlat || '0');
      if (adminFlatCost > 0 && !isNaN(enteredFlat) && enteredFlat > 0 && enteredFlat < adminFlatCost) {
        toast.error(
          `Flat rate (₹) cannot be less than default flat rate of ₹${adminFlatCost} for this slab. You must charge at least ₹${adminFlatCost}.`
        );
        return;
      }
    }
    setIsSaving(true);
    try {
      const chosenEditSubType = posTxnEditForm.subType || posTxnEditForm.cardClassification || 'any';
      const updates = {
        payment_mode: posTxnEditForm.method,
        card_brand: (!posTxnEditForm.network || posTxnEditForm.network === 'ALL') ? null : posTxnEditForm.network,
        card_type: (!posTxnEditForm.cardType || posTxnEditForm.cardType === 'ALL') ? null : posTxnEditForm.cardType,
        card_classification: chosenEditSubType,
        sub_type: chosenEditSubType,
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

      // Check for overlap in other existing active rates
      const editMethod = String(updates.payment_mode || '').trim().toUpperCase();
      const editNetwork = String(updates.card_brand || 'ALL').trim().toUpperCase().replace(/[\s_\\-]/g, '');
      const editCardType = String(updates.card_type || 'ALL').trim().toUpperCase().replace(/[\s_\\-]/g, '').replace('CARD', '');
      const editSubType = String(updates.card_classification || updates.sub_type || 'any').trim().toLowerCase();
      const editSettlement = String(updates.settlement_type || '').trim().toLowerCase();
      const editCompany = String(updates.company_name || '').trim().toLowerCase();
      const editMin = parseFloat(updates.min_amount || '0');
      const editMax = updates.max_amount !== null && updates.max_amount !== '' && !isNaN(parseFloat(updates.max_amount))
        ? parseFloat(updates.max_amount)
        : null;

      const em1 = editMin;
      const em2 = editMax !== null ? editMax : Infinity;

      const editConflict = rates.find((r) => {
        if (r.id === posTxnEditRate?.id) return false;
        if (r.is_active === false) return false;

        const rMethod = String(r.payment_mode || r.method || '').trim().toUpperCase();
        const rNetwork = String(r.card_brand || r.network || 'ALL').trim().toUpperCase().replace(/[\s_\\-]/g, '');
        const rCardType = String(r.raw_card_type || r.card_type || 'ALL').trim().toUpperCase().replace(/[\s_\\-]/g, '').replace('CARD', '');
        const rSubType = String(r.sub_type || r.card_classification || 'any').trim().toLowerCase();
        const rSettlement = String(r.settlement_type || '').trim().toLowerCase();
        const rCompany = String(r.company_name || '').trim().toLowerCase();

        const specsMatch = (
          rMethod === editMethod &&
          (rNetwork === editNetwork || (!rNetwork && !editNetwork)) &&
          (rCardType === editCardType || (!rCardType && !editCardType)) &&
          rSubType === editSubType &&
          rSettlement === editSettlement &&
          (!editCompany || !rCompany || rCompany === editCompany)
        );

        if (!specsMatch) return false;

        const rMin = r.min_amount != null ? parseFloat(r.min_amount) : 0;
        const rawRMax = r.max_amount ?? r.to_amount;
        const rMax = rawRMax !== null && rawRMax !== undefined && rawRMax !== '' && !isNaN(parseFloat(rawRMax))
          ? parseFloat(rawRMax)
          : null;

        const s1 = rMin;
        const s2 = rMax !== null ? rMax : Infinity;

        return em1 <= s2 && em2 >= s1;
      });

      if (editConflict) {
        const existingRange = `${editConflict.min_amount != null ? editConflict.min_amount : 0} - ${editConflict.max_amount != null ? editConflict.max_amount : 'Open'}`;
        toast.error(`Duplicate rule: An active rate rule with matching specifications and an overlapping amount range (${existingRange}) already exists.`);
        setIsSaving(false);
        return;
      }

      if (isPGTxnMode) {
        if (posTxnEditRate?.isInherited) {
          await createPgChargeRule({
            gateway: 'ALL',
            payment_mode: updates.payment_mode,
            card_brand: updates.card_brand,
            card_type: updates.card_type,
            card_classification: updates.card_classification,
            sub_type: updates.sub_type,
            settlement_type: updates.settlement_type,
            min_amount: updates.min_amount,
            max_amount: updates.max_amount,
            charge_percent: updates.charge_percent,
            charge_flat: updates.charge_flat,
            gst_required: updates.gst_required,
            gst_percent: updates.gst_percent,
            company_name: updates.company_name,
            scope: isSuperAdmin
              ? (activeTab === 'specific' ? 'super_admin_admin' : 'super_admin_default')
              : (activeTab === 'specific'
                  ? (isFranchiseUser
                      ? 'franchise_merchant'
                      : (isSuperFranchiseUser
                          ? 'super_franchise_franchise'
                          : 'admin_franchise'))
                  : (activeTab === 'unassigned'
                      ? (isSuperFranchiseUser
                          ? 'super_franchise_merchant'
                          : 'admin_merchant')
                      : (activeTab === 'super_franchise'
                          ? 'admin_super_franchise'
                          : (isFranchiseUser
                              ? 'franchise_default'
                              : (isSuperFranchiseUser
                                  ? 'super_franchise_default'
                                  : 'admin_default'))))),
            target_user_id: activeTab === 'unassigned'
              ? selectedMerchantId
              : (activeTab === 'specific'
                  ? selectedFranchiseId
                  : (activeTab === 'super_franchise' ? selectedSuperFranchiseId : null)),
            target_franchise_id: (activeTab === 'specific' && !isFranchiseUser) ? selectedFranchiseId : null,
            target_super_franchise_id: activeTab === 'super_franchise' ? selectedSuperFranchiseId : null
          });
          toast.success("PG charge rule override created successfully.");
        } else {
          await updatePgChargeRule(posTxnEditRate.rule_id || posTxnEditRate.id, updates);
          toast.success("PG charge rule updated successfully.");
        }
      } else if (activeTab === 'default') {
        if (isSuperAdmin) {
          await updatePlatformDefaultPosRule(posTxnEditRate.rule_id || posTxnEditRate.id, updates);
          toast.success('Platform default rate updated successfully.');
        } else {
          await updateFranchiseRate('default', posTxnEditRate, updates);
          toast.success('Default rate updated successfully.');
        }
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
    const showMatrixRateColumns = !isPGTxnMode;
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
          : isFranchiseUser
            ? 'Merchant'
            : 'Franchise';
    const matrixAttributes = buildColumnStructure(
      defaultRatesAttributes.filter((rate) => rate.source_scope === 'admin'),
      ...Object.values(matrixSource)
    );
    const searchPlaceholder = `Search ${entityLabel} by Name, ID, or Phone...`;
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
        ? `Searching ${entityLabel.toLowerCase()}s...`
        : shouldUseRemoteSearch
          ? `No matching ${entityLabel.toLowerCase()}s found.`
          : `No ${entityLabel.toLowerCase()}s found.`;

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
    super_admin_default: { label: 'Global Default Rate', color: 'bg-indigo-100 text-indigo-800' },
    super_admin_admin: { label: 'SuperAdmin→Admin', color: 'bg-indigo-100 text-indigo-800' },
    admin_default: { label: 'Platform Default', color: 'bg-blue-100 text-blue-800' },
    super_franchise_default: { label: 'Platform Default', color: 'bg-blue-100 text-blue-800' },
    admin_super_franchise: { label: 'Admin→SuperFranchise', color: 'bg-emerald-100 text-emerald-800' },
    admin_franchise: { label: 'Admin→Franchise', color: 'bg-purple-100 text-purple-800' },
    admin_merchant: { label: 'Admin→Merchant', color: 'bg-orange-100 text-orange-800' },
    super_franchise_franchise: { label: 'SuperFranchise→Franchise', color: 'bg-emerald-100 text-emerald-800' },
    super_franchise_merchant: { label: 'SuperFranchise→Merchant', color: 'bg-orange-100 text-orange-800' },
    franchise_default: { label: 'Platform Default', color: 'bg-blue-100 text-blue-800' },
    franchise_merchant: { label: 'Franchise→Merchant', color: 'bg-teal-100 text-teal-800' },
  };
  const formatAmountRange = (rate) => {
    const min = rate.min_amount ?? 0;
    const max = rate.max_amount;
    if (max === null || max === undefined || max === '') return `${min}+`;
    return `${min} – ${max}`;
  };
  const getScopeBadge = (rate) => {
    if (!rate) return null;
    if (activeTab === 'default') {
      if (isSuperAdmin) {
        return { label: 'Platform Default', color: 'bg-blue-100 text-blue-800' };
      }
      // If the admin not created it or super franchise not created it -> Global Default Rate
      // Platform default is what that user created
      if (rate.isInherited) {
        return { label: 'Global Default Rate', color: 'bg-indigo-100 text-indigo-800' };
      }
      return { label: 'Platform Default', color: 'bg-blue-100 text-blue-800' };
    }
    const rawScope = rate.original_rule?.scope || rate.scope || rate.source_scope;
    if (SCOPE_BADGES[rawScope]) {
      return SCOPE_BADGES[rawScope];
    }
    if (rate.isInherited) {
      return { label: 'Global Default Rate', color: 'bg-indigo-100 text-indigo-800' };
    }
    return { label: 'Platform Default', color: 'bg-blue-100 text-blue-800' };
  };

  const renderDetailTable = () => {
    const isReadOnlyDetail = (detailReadOnly && activeTab !== 'default') || isMerchantUser;
    const shouldShowSpecificSettlementFilter =
      isPGTxnMode &&
      viewMode === 'detail' &&
      (activeTab === 'super_franchise' || activeTab === 'specific' || activeTab === 'unassigned');
    const baseFiltered = shouldShowSpecificSettlementFilter
      ? rates.filter((rate) =>
        specificSettlementFilter === 'all'
          ? true
          : normalizeSettlementValue(rate.settlement_type) === specificSettlementFilter
      )
      : rates;
    const filteredRates = (activeTab === 'default' && isSuperAdmin)
      ? baseFiltered.filter((rate) => {
          if (rate.user_id || rate.franchaise_id || rate.super_franchise_id) return false;
          if (rate.scope === 'super_admin_admin' || rate.scope === 'admin_franchise' || rate.scope === 'admin_merchant' || rate.scope === 'franchise_merchant') return false;
          return true;
        })
      : baseFiltered;
    const emptyStateMessage =
      shouldShowSpecificSettlementFilter && specificSettlementFilter !== 'all'
        ? 'No rates found for the selected settlement.'
        : 'No rates found.';
    const detailColSpan = isPGTxnMode
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
        {isAdminOrSuperAdmin && activeTab === 'default' && (
          <div className="flex justify-stretch md:justify-end p-4 pb-0">
            <button
              onClick={openCreateRateModal}
              className="w-full md:w-auto bg-[#00D3CD] text-white px-4 py-2 rounded shadow hover:bg-[#00b8b3] transition-colors font-medium flex items-center justify-center gap-1.5"
            >
              <Plus className="w-4 h-4" /> Add New Rule
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
                      {isPGTxnMode && scopeBadge && (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${scopeBadge.color}`}>
                          {scopeBadge.label}
                        </span>
                      )}
                      {rate.isInherited && <span className="text-[10px] text-indigo-500 italic ml-auto font-medium">Inherited (Global Default)</span>}
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {isPGTxnMode && (
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
                      {isAdminOrSuperAdmin && (
                        <div>
                          <p className="text-gray-500">Classification Sub Type</p>
                          <p className="font-medium text-gray-900">{rate.sub_type || 'any'}</p>
                        </div>
                      )}
                      {!isPGTxnMode && (
                        <div>
                          <p className="text-gray-500">Sub Type</p>
                          <p className="font-medium text-gray-900">{rate.sub_type}</p>
                        </div>
                      )}
                      <div>
                        <p className="text-gray-500">Classification</p>
                        <p className="font-medium text-gray-900">{rate.card_classification || 'ANY'}</p>
                      </div>
                      {isPGTxnMode && (
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
                      {!isPGTxnMode && editingId === rate.id ? (
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
                          {formatRateValue(rate)} {rate.isInherited ? (
                            <span className="text-xs text-gray-400 italic">(Default)</span>
                          ) : (
                            <span className="text-xs text-emerald-600 font-semibold">(Configured)</span>
                          )}
                        </p>
                      )}
                    </div>
                    {!isReadOnlyDetail && (
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        {isPGTxnMode ? (
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
                    {isPGTxnMode && (
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Scope</th>
                    )}
                    {isPGTxnMode && (
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Company</th>
                    )}
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Method</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Network</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Card Type</th>
                    {isAdminOrSuperAdmin && (
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Classification Sub Type</th>
                    )}
                    {!isPGTxnMode && (
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sub Type</th>
                    )}
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Classification</th>
                    {isPGTxnMode && (
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
                        {isPGTxnMode && (
                          <td className="px-4 py-4 whitespace-nowrap text-sm">
                            {scopeBadge ? (
                              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${scopeBadge.color}`}>
                                {scopeBadge.label}
                              </span>
                            ) : '—'}
                          </td>
                        )}
                        {isPGTxnMode && (
                          <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 uppercase">{rate.company_name || '—'}</td>
                        )}
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{rate.method}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{rate.network || '—'}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{rate.card_type}</td>
                        {isAdminOrSuperAdmin && (
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 font-medium">
                            {rate.sub_type || 'any'}
                          </td>
                        )}
                        {!isPGTxnMode && (
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{rate.sub_type}</td>
                        )}
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{rate.card_classification || 'ANY'}</td>
                        {isPGTxnMode && (
                          <>
                            <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">{rate.settlement_type || 'Any'}</td>
                            <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">{formatAmountRange(rate)}</td>
                            <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">{rate.charge_flat ? `₹${rate.charge_flat}` : '—'}</td>
                          </>
                        )}
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {!isPGTxnMode && editingId === rate.id && hasEditableGst(rate) ? (
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
                          {!isPGTxnMode && editingId === rate.id ? (
                            <input
                              type="number"
                              step="0.01"
                              className="border border-gray-300 rounded px-2 py-1 w-24 focus:ring-2 focus:ring-[#00D3CD] focus:border-transparent"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                            />
                          ) : (
                            <span>
                              {formatRateValue(rate)}{' '}
                              {rate.isInherited ? (
                                <span className="text-xs text-indigo-500 italic font-medium">(Global Default)</span>
                              ) : (
                                <span className="text-xs text-emerald-600 font-semibold">(Platform Default)</span>
                              )}
                            </span>
                          )}
                        </td>
                        {!isReadOnlyDetail && (
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                            {isPGTxnMode ? (
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

  return (
    <div className="bg-gray-100 min-h-screen">
      <div> {/* Wider for Matrix */}
        <div className="bg-white rounded-lg shadow-sm">

          {/* Header */}
          <div className="px-4 md:px-6 py-4 border-b border-gray-200 flex flex-col md:flex-row md:justify-between md:items-center gap-3 bg-gray-50/50 rounded-t-lg">
            <div>
              <div className="mb-2">
                <Link
                  to={
                    location.pathname.startsWith('/super-admin')
                      ? '/super-admin/rate-setting'
                      : location.pathname.startsWith('/super-franchise')
                      ? '/super-franchise/rate-settings'
                      : location.pathname.startsWith('/admin')
                      ? '/admin/rate-setting'
                      : location.pathname.startsWith('/franchise')
                      ? '/franchise/rate-settings'
                      : '/merchant/charges'
                  }
                  className="text-sm text-[#008c87] hover:underline font-medium inline-flex items-center gap-1"
                >
                  &larr; Rate Settings Home
                </Link>
              </div>
              <h1 className="text-xl md:text-2xl font-bold text-gray-900">
                {isPGTxnMode ? 'PG Transaction Charges' : 'Admin Rate Setting'}
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                {isPGTxnMode
                  ? 'Payment Gateway transaction rate matrix and charge settings.'
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
          {!isPGTxnMode && (
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
                setDetailReadOnly(isMerchantUser);
                setSearchTerm('');
                setSpecificSettlementFilter(DEFAULT_SPECIFIC_SETTLEMENT_FILTER);
                setSelectedSuperFranchiseId('');
                setSelectedFranchiseId('');
                setSelectedMerchantId('');
              }}
            >
              {isMerchantUser
                ? 'My Applicable PG Charges'
                : isPGTxnMode
                  ? (isSuperAdmin ? 'Default PG Rates (Platform Global)' : 'Default PG Rates')
                  : (isSuperAdmin ? 'Default POS Rates (Global for Every User)' : 'Default POS Rates')}
            </button>

            {/* Super Admin: Admin Specific Rates */}
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

            {/* Admin: Super Franchise Specific Rates */}
            {isAdminUser && (
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

            {/* Admin & Super Franchise: Franchise Specific Rates */}
            {(isAdminUser || isSuperFranchiseUser) && (
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

            {/* Franchise: Merchant Specific Rates */}
            {isFranchiseUser && (
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
                Merchant Specific Rates
              </button>
            )}

            {/* Admin: Merchants Under Admin Rates | Super Franchise: Merchant Specific Rates */}
            {(isAdminUser || isSuperFranchiseUser) && (
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
                {isAdminUser ? 'Merchants Under Admin Rates' : 'Merchant Specific Rates'}
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
                    <span className="ml-2 text-blue-900">{superFranchises.find(sf => String(sf.id) === String(selectedSuperFranchiseId))?.name || 'Unknown'}</span>
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
                    <span className="font-semibold text-blue-800">
                      {isSuperAdmin ? 'Admin: ' : isFranchiseUser ? 'Merchant: ' : 'Franchise: '}
                    </span>
                    <span className="ml-2 text-blue-900">{franchises.find(f => String(f.id) === String(selectedFranchiseId))?.name || 'Unknown'}</span>
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
                    <span className="ml-2 text-blue-900">{unassignedMerchants.find((m) => String(m.id) === String(selectedMerchantId))?.name || 'Unknown'}</span>
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

              {/* Classification Sub Type (Required - Admin & Super Admin only, never disabled) */}
              {isAdminOrSuperAdmin && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Classification Sub Type <span className="text-rose-500 font-bold">*</span>
                  </label>
                  <select
                    required
                    className="w-full border border-gray-300 rounded p-2 focus:ring-2 focus:ring-[#00D3CD] focus:border-transparent"
                    value={newRateForm.subType || 'any'}
                    onChange={(e) => setNewRateForm((prev) => ({ ...prev, subType: e.target.value }))}
                  >
                    {CLASSIFICATION_SUB_TYPE_OPTIONS.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>
              )}

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

              {/* Charge Type Switcher Pill */}
              <div className="flex items-center justify-between pb-1">
                <span className="text-xs font-semibold text-gray-600">Charge Mode:</span>
                <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setNewRateChargeMode('percent');
                      setNewRateForm(prev => ({
                        ...prev,
                        chargeFlat: '0',
                        chargePercent: prev.chargePercent && parseFloat(prev.chargePercent) > 0 ? prev.chargePercent : ''
                      }));
                    }}
                    className={`px-3 py-1 font-medium rounded-md transition ${
                      newRateChargeMode === 'percent'
                        ? 'bg-[#00D3CD] text-white shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    % Percentage
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setNewRateChargeMode('flat');
                      setNewRateForm(prev => ({
                        ...prev,
                        chargePercent: '0',
                        chargeFlat: prev.chargeFlat && parseFloat(prev.chargeFlat) > 0 ? prev.chargeFlat : ''
                      }));
                    }}
                    className={`px-3 py-1 font-medium rounded-md transition ${
                      newRateChargeMode === 'flat'
                        ? 'bg-[#00D3CD] text-white shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    ₹ Flat Rate
                  </button>
                </div>
              </div>

              {/* Charge Input (Single: Percentage or Flat) */}
              {newRateChargeMode === 'percent' ? (
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
                    onChange={(e) => {
                      setNewRateForm(prev => ({
                        ...prev,
                        chargePercent: e.target.value,
                        chargeFlat: '0'
                      }));
                    }}
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Flat Charge (₹)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="w-full border border-gray-300 rounded p-2 focus:ring-2 focus:ring-[#00D3CD] focus:border-transparent"
                    placeholder="e.g. 2"
                    value={newRateForm.chargeFlat}
                    onChange={(e) => {
                      setNewRateForm(prev => ({
                        ...prev,
                        chargeFlat: e.target.value,
                        chargePercent: '0'
                      }));
                    }}
                  />
                </div>
              )}

              {/* Mutual Exclusivity Popup / Alert Banner */}
              {newRateHasBoth && (
                <div className="p-3 rounded-lg border border-amber-300 bg-amber-50 text-amber-900 text-xs shadow-sm">
                  <div className="flex items-start gap-2">
                    <span className="text-amber-600 text-base leading-none shrink-0 mt-0.5">⚠️</span>
                    <div className="flex-1">
                      <p className="font-bold text-amber-800">Set either Flat Rate or Base Rate (%)</p>
                      <p className="text-amber-700 mt-0.5">
                        You have entered both Base Rate and Flat Charge. Please set only one (set the other to 0 or leave empty) to save changes.
                      </p>
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        <button
                          type="button"
                          onClick={() => setNewRateForm((prev) => ({ ...prev, chargeFlat: '' }))}
                          className="px-2.5 py-1 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded font-medium text-xs transition border border-amber-300"
                        >
                          Keep Base Rate only (Clear Flat)
                        </button>
                        <button
                          type="button"
                          onClick={() => setNewRateForm((prev) => ({ ...prev, chargePercent: '' }))}
                          className="px-2.5 py-1 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded font-medium text-xs transition border border-amber-300"
                        >
                          Keep Flat Charge only (Clear Rate)
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

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
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between gap-3 shrink-0">
              {newRateHasBoth ? (
                <span className="text-xs font-semibold text-amber-700 flex items-center gap-1.5">
                  <span>⚠️</span> Set either Flat Rate or Base Rate (%)
                </span>
              ) : <div />}
              <div className="flex items-center gap-3">
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
                  const badge = getScopeBadge(posTxnEditRate);
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

              {/* Classification Sub Type (Required - Admin & Super Admin only, never disabled) */}
              {isAdminOrSuperAdmin && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Classification Sub Type <span className="text-rose-500 font-bold">*</span>
                  </label>
                  <select
                    required
                    className="w-full border border-gray-300 rounded p-2 focus:ring-2 focus:ring-[#00D3CD] focus:border-transparent"
                    value={posTxnEditForm.subType || 'any'}
                    onChange={(e) => setPosTxnEditForm({ ...posTxnEditForm, subType: e.target.value })}
                  >
                    {CLASSIFICATION_SUB_TYPE_OPTIONS.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>
              )}

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
              {/* Charge Type Switcher Pill */}
              <div className="flex items-center justify-between pb-1">
                <span className="text-xs font-semibold text-gray-600">Charge Mode:</span>
                <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setPosEditChargeMode('percent');
                      setPosTxnEditForm(prev => ({
                        ...prev,
                        chargeFlat: '0',
                        chargePercent: prev.chargePercent && parseFloat(prev.chargePercent) > 0 ? prev.chargePercent : ''
                      }));
                    }}
                    className={`px-3 py-1 font-medium rounded-md transition ${
                      posEditChargeMode === 'percent'
                        ? 'bg-[#00D3CD] text-white shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    % Percentage
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPosEditChargeMode('flat');
                      setPosTxnEditForm(prev => ({
                        ...prev,
                        chargePercent: '0',
                        chargeFlat: prev.chargeFlat && parseFloat(prev.chargeFlat) > 0 ? prev.chargeFlat : ''
                      }));
                    }}
                    className={`px-3 py-1 font-medium rounded-md transition ${
                      posEditChargeMode === 'flat'
                        ? 'bg-[#00D3CD] text-white shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    ₹ Flat Rate
                  </button>
                </div>
              </div>

              {/* Charge Input (Single: Percentage or Flat) */}
              {posEditChargeMode === 'percent' ? (
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
                    onChange={(e) => {
                      setPosTxnEditForm(prev => ({
                        ...prev,
                        chargePercent: e.target.value,
                        chargeFlat: '0'
                      }));
                    }}
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Flat Charge (₹)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="w-full border border-gray-300 rounded p-2 focus:ring-2 focus:ring-[#00D3CD] focus:border-transparent"
                    placeholder="e.g. 2"
                    value={posTxnEditForm.chargeFlat}
                    onChange={(e) => {
                      setPosTxnEditForm(prev => ({
                        ...prev,
                        chargeFlat: e.target.value,
                        chargePercent: '0'
                      }));
                    }}
                  />
                </div>
              )}

              {/* Mutual Exclusivity Popup / Alert Banner */}
              {posTxnEditHasBoth && (
                <div className="p-3 rounded-lg border border-amber-300 bg-amber-50 text-amber-900 text-xs shadow-sm">
                  <div className="flex items-start gap-2">
                    <span className="text-amber-600 text-base leading-none shrink-0 mt-0.5">⚠️</span>
                    <div className="flex-1">
                      <p className="font-bold text-amber-800">Set either Flat Rate or Base Rate (%)</p>
                      <p className="text-amber-700 mt-0.5">
                        You have entered both Base Rate and Flat Charge. Please set only one (set the other to 0 or leave empty) to save changes.
                      </p>
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        <button
                          type="button"
                          onClick={() => setPosTxnEditForm((prev) => ({ ...prev, chargeFlat: '0' }))}
                          className="px-2.5 py-1 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded font-medium text-xs transition border border-amber-300"
                        >
                          Keep Base Rate only (Clear Flat)
                        </button>
                        <button
                          type="button"
                          onClick={() => setPosTxnEditForm((prev) => ({ ...prev, chargePercent: '0' }))}
                          className="px-2.5 py-1 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded font-medium text-xs transition border border-amber-300"
                        >
                          Keep Flat Charge only (Clear Rate)
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
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
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between gap-3 shrink-0">
              {posTxnEditHasBoth ? (
                <span className="text-xs font-semibold text-amber-700 flex items-center gap-1.5">
                  <span>⚠️</span> Set either Flat Rate or Base Rate (%)
                </span>
              ) : <div />}
              <div className="flex items-center gap-3">
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
