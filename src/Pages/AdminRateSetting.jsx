import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
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
import { searchUsers } from '../api/FranchiseApi';
import RateSettings from './RateSettings';
import PayoutRateSettings from './PayoutRateSettings';

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
  chargeType: 'percent', // 'percent' | 'flat'
  chargeValue: '',
  gstRequired: false,
  gstPercent: '18',
  companyName: '',
};
const DEFAULT_SPECIFIC_SETTLEMENT_FILTER = 'today_settlement';

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

const AdminRateSetting = ({ mode = 'full', initialTab = 'specific' }) => {
  const isPosTxnMode = mode === 'pos_txn';
  const [activeTab, setActiveTab] = useState(initialTab); // 'default' | 'specific' | 'unassigned' | 'rental' | 'cc_bill' | 'payout'
  const [viewMode, setViewMode] = useState(initialTab === 'default' ? 'detail' : 'matrix'); // 'matrix' or 'detail'
  const [specificSettlementFilter, setSpecificSettlementFilter] = useState(DEFAULT_SPECIFIC_SETTLEMENT_FILTER);

  useEffect(() => {
    setActiveTab(initialTab);
    setViewMode(initialTab === 'default' ? 'detail' : 'matrix');
    setSpecificSettlementFilter(DEFAULT_SPECIFIC_SETTLEMENT_FILTER);
  }, [initialTab]);

  const [franchises, setFranchises] = useState([]);
  const [unassignedMerchants, setUnassignedMerchants] = useState([]);
  const [selectedFranchiseId, setSelectedFranchiseId] = useState('');
  const [selectedMerchantId, setSelectedMerchantId] = useState('');
  const [rates, setRates] = useState([]);
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
    const timeoutId = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm.trim());
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchTerm]);

  useEffect(() => {
    const canUseRemoteSearch =
      viewMode === 'matrix' && (activeTab === 'specific' || activeTab === 'unassigned');

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
        const role = activeTab === 'specific' ? 'franchaise' : 'merchant';
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
      const [franchisesData, defaults, unassignedMerchantsData] = await Promise.all([
        getFranchises(),
        getFranchiseRates('default'),
        getUnassignedMerchants(),
      ]);

      setFranchises(franchisesData);
      setUnassignedMerchants(unassignedMerchantsData);

      const [matrix, unassignedMerchantMatrix] = await Promise.all([
        getAllFranchiseRates(franchisesData),
        getAllMerchantRates(unassignedMerchantsData),
      ]);

      setDefaultRatesAttributes(
        buildColumnStructure(
          defaults,
          ...Object.values(matrix),
          ...Object.values(unassignedMerchantMatrix)
        )
      );
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

  const fetchGlobalRate = async () => {
    setLoadingGlobal(true);
    try {
      const data = await getGlobalPOSRate();
      if (data) {
        setGlobalRate(data.percent_fee);
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
      const res = await updateGlobalPOSRate(globalRateInput);
      toast.success("Global Fallback Rate updated successfully!");
      setGlobalRate(res.record ? res.record.percent_fee : globalRateInput);
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

    if (activeTab === 'rental') {
      // Rental tab renders a separate component; no data fetching needed here
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
      const data = await getFranchiseRates(id, {
        paginate: id === 'default',
        page,
        limit
      });

      if (id === 'default' && data?.rates) {
        setRates(data.rates);
        setDefaultPagination((prev) => ({
          ...prev,
          ...data.pagination,
          page: data.pagination?.page ?? prev.page,
          limit: data.pagination?.limit ?? prev.limit,
          totalPages: data.pagination?.totalPages ?? prev.totalPages,
          total: data.pagination?.total ?? prev.total
        }));
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

  const handleEditFranchiseDetail = (franchiseId) => {
    setSelectedFranchiseId(franchiseId);
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
    setSelectedFranchiseId('');
    setDetailReadOnly(true);
    setEditingId(null);
    setEditValue('');
    setEditGstValue('');
    setSpecificSettlementFilter(DEFAULT_SPECIFIC_SETTLEMENT_FILTER);
    setViewMode('detail');
  };

  const handleBackToMatrix = () => {
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
    if (editValue === '') {
      toast.error('Please enter a valid rate.');
      return;
    }

    if (hasEditableGst(rate) && editGstValue === '') {
      toast.error('Please enter a valid GST rate.');
      return;
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
    if (!newRateForm.chargeValue) {
      toast.error(`Please enter a ${newRateForm.chargeType === 'flat' ? 'flat charge amount' : 'charge percentage'}.`);
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
        charge_flat: newRateForm.chargeType === 'flat' ? newRateForm.chargeValue : '0',
        gst_required: newRateForm.gstRequired,
        gst_rate: newRateForm.gstRequired ? newRateForm.gstPercent : '0',
        base_rate: newRateForm.chargeType === 'percent' ? newRateForm.chargeValue : '0',
        company_name: newRateForm.companyName || null
      };
      await createDefaultFranchiseRate(payload);
      toast.success("New default rate created successfully.");
      setIsModalOpen(false);

      // Reset form
      setNewRateForm(INITIAL_NEW_RATE_FORM);
      // Refresh Data
      fetchInitialData();
      if (activeTab === 'default') {
        fetchFranchiseRates('default');
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
    if (!rate?.id) return;

    const deleteId = rate.rule_id || rate.id;
    setIsDeleting(true);
    try {
      await deleteDefaultPOSRate(deleteId);
      toast.success('Rate deleted successfully');

      if (tab === 'default') {
        await fetchFranchiseRates('default');
      } else if (tab === 'specific' && selectedFranchiseId) {
        await fetchFranchiseRates(selectedFranchiseId);
      } else if (tab === 'unassigned' && selectedMerchantId) {
        await fetchMerchantRates(selectedMerchantId);
      }
      await fetchInitialData();
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
    const flatVal = parseFloat(rate.charge_flat ?? 0);
    const pctVal = parseFloat(getRateValue(rate) ?? 0);
    const chargeType = flatVal > 0 && pctVal === 0 ? 'flat' : 'percent';
    setPosTxnEditForm({
      method,
      network: isUPI ? '' : (String(rate.network || 'VISA').toUpperCase()),
      cardType: isUPI ? 'UNKNOWN' : (String(rate.card_type || 'CREDIT').toUpperCase()),
      cardClassification: isUPI ? 'ANY' : (String(rate.card_classification || 'ANY').toUpperCase()),
      settlementType: rate.settlement_type || '',
      minAmount: String(rate.min_amount ?? '0'),
      maxAmount: rate.max_amount !== null && rate.max_amount !== undefined ? String(rate.max_amount) : '',
      chargeType,
      chargeValue: chargeType === 'flat' ? String(flatVal) : String(pctVal),
      gstRequired: Boolean(rate.gst_required),
      gstPercent: String(rate.gst_rate ?? '18'),
      companyName: rate.company_name || '',
    });
    setIsPosTxnEditModalOpen(true);
  };

  const handleSavePosTxnEdit = async () => {
    if (!posTxnEditForm.chargeValue) {
      toast.error('Please enter a charge amount.');
      return;
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
        charge_flat: posTxnEditForm.chargeType === 'flat' ? posTxnEditForm.chargeValue : '0',
        gst_required: posTxnEditForm.gstRequired,
        gst_percent: posTxnEditForm.gstRequired ? posTxnEditForm.gstPercent : '0',
        chargePercent: posTxnEditForm.chargeType === 'percent' ? posTxnEditForm.chargeValue : '0',
        company_name: posTxnEditForm.companyName || null
      };
      if (activeTab === 'default') {
        await updateFranchiseRate('default', posTxnEditRate, updates);
      } else if (activeTab === 'specific') {
        await updateFranchiseRate(selectedFranchiseId, posTxnEditRate, updates);
      } else {
        await updateMerchantRate(selectedMerchantId, posTxnEditRate, updates);
      }
      toast.success('Rule updated successfully.');
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
    const isUnassignedTab = activeTab === 'unassigned';
    const showMatrixRateColumns = !isPosTxnMode;
    const baseEntities = isUnassignedTab ? unassignedMerchants : franchises;
    const matrixSource = isUnassignedTab ? unassignedMerchantMatrixData : matrixData;
    const entityLabel = isUnassignedTab ? 'Merchant' : 'Franchise';
    const matrixAttributes = buildColumnStructure(
      defaultRatesAttributes.filter((rate) => rate.source_scope === 'admin'),
      ...Object.values(matrixSource)
    );
    const searchPlaceholder = isUnassignedTab
      ? 'Search Merchant by Name, ID, or Phone...'
      : 'Search Franchise by Name, ID, or Phone...';
    const shouldUseRemoteSearch =
      viewMode === 'matrix' &&
      (activeTab === 'specific' || activeTab === 'unassigned') &&
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
        ? `Searching ${isUnassignedTab ? 'merchants' : 'franchises'}...`
        : shouldUseRemoteSearch
          ? `No matching ${isUnassignedTab ? 'merchants' : 'franchises'} found.`
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
                      onClick={() => isUnassignedTab ? handleViewMerchantDetail(entity.id) : handleViewFranchiseDetail(entity.id)}
                      className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-100"
                    >
                      View
                    </button>
                    <button
                      onClick={() => isUnassignedTab ? handleEditMerchantDetail(entity.id) : handleEditFranchiseDetail(entity.id)}
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
                          onClick={() => isUnassignedTab ? handleViewMerchantDetail(entity.id) : handleViewFranchiseDetail(entity.id)}
                          className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-100"
                        >
                          View
                        </button>
                        <button
                          onClick={() => isUnassignedTab ? handleEditMerchantDetail(entity.id) : handleEditFranchiseDetail(entity.id)}
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
    admin_default: { label: 'Global Default', color: 'bg-blue-100 text-blue-800' },
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
    const isReadOnlyDetail = detailReadOnly && activeTab !== 'default';
    const shouldShowSpecificSettlementFilter =
      isPosTxnMode &&
      viewMode === 'detail' &&
      (activeTab === 'specific' || activeTab === 'unassigned');
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
                <option value="today_settlement">Today Settlement</option>
                <option value="next_day_settlement">Next Day Settlement</option>
                <option value="all">All</option>
              </select>
            </div>
          </div>
        )}
        {activeTab === 'default' && (
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
                          : activeTab === 'specific'
                            ? 'Franchise Base Rate (%)'
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
                        : activeTab === 'specific'
                          ? 'Franchise Base Rate (%)'
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

  return (
    <div className="bg-gray-100 min-h-screen">
      <div> {/* Wider for Matrix */}
        <div className="bg-white rounded-lg shadow-sm">
          {/* Header */}
          <div className="px-4 md:px-6 py-4 border-b border-gray-200 flex flex-col md:flex-row md:justify-between md:items-center gap-3 bg-gray-50/50 rounded-t-lg">
            <div>
              <div className="mb-2">
                <Link to="/admin/rate-setting" className="text-sm text-[#1855e4] hover:text-blue-800 font-medium">
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
          <div className="grid grid-cols-1 md:flex border-b border-gray-200">
            <button
              className={`px-4 md:px-6 py-3 font-medium text-sm focus:outline-none text-left md:text-center ${activeTab === 'default' ? 'border-b-2 border-[#00D3CD] text-[#00D3CD]' : 'text-gray-500 hover:text-gray-700'}`}
              onClick={() => {
                setActiveTab('default');
                setViewMode('detail');
                setDetailReadOnly(false);
                setSearchTerm('');
                setSpecificSettlementFilter(DEFAULT_SPECIFIC_SETTLEMENT_FILTER);
                setSelectedFranchiseId('');
                setSelectedMerchantId('');
              }}
            >
              Default Rates
            </button>
            <button
              className={`px-4 md:px-6 py-3 font-medium text-sm focus:outline-none text-left md:text-center ${activeTab === 'specific' ? 'border-b-2 border-[#00D3CD] text-[#00D3CD]' : 'text-gray-500 hover:text-gray-700'}`}
              onClick={() => {
                setActiveTab('specific');
                setViewMode('matrix');
                setDetailReadOnly(false);
                setSearchTerm('');
                setSpecificSettlementFilter(DEFAULT_SPECIFIC_SETTLEMENT_FILTER);
                setSelectedMerchantId('');
              }}
            >
              Franchise Rates
            </button>
            <button
              className={`px-4 md:px-6 py-3 font-medium text-sm focus:outline-none text-left md:text-center ${activeTab === 'unassigned' ? 'border-b-2 border-[#00D3CD] text-[#00D3CD]' : 'text-gray-500 hover:text-gray-700'}`}
              onClick={() => {
                setActiveTab('unassigned');
                setViewMode('matrix');
                setDetailReadOnly(false);
                setSearchTerm('');
                setSpecificSettlementFilter(DEFAULT_SPECIFIC_SETTLEMENT_FILTER);
                setSelectedFranchiseId('');
              }}
            >
              Merchants under admin rates
            </button>
            <button
              className={`px-4 md:px-6 py-3 font-medium text-sm focus:outline-none text-left md:text-center ${activeTab === 'payout' ? 'border-b-2 border-[#00D3CD] text-[#00D3CD]' : 'text-gray-500 hover:text-gray-700'}`}
              onClick={() => {
                setActiveTab('payout');
                setDetailReadOnly(false);
                setSearchTerm('');
                setSelectedFranchiseId('');
                setSelectedMerchantId('');
              }}
            >
              Payout Rates
            </button>

            {!isPosTxnMode && (
              <>
                <button
                  className={`px-4 md:px-6 py-3 font-medium text-sm focus:outline-none text-left md:text-center ${activeTab === 'rental' ? 'border-b-2 border-[#00D3CD] text-[#00D3CD]' : 'text-gray-500 hover:text-gray-700'}`}
                  onClick={() => {
                    setActiveTab('rental');
                    setDetailReadOnly(false);
                    setSearchTerm('');
                    setSelectedFranchiseId('');
                    setSelectedMerchantId('');
                  }}
                >
                  Rental Rate
                </button>
                <button
                  className={`px-4 md:px-6 py-3 font-medium text-sm focus:outline-none text-left md:text-center ${activeTab === 'cc_bill' ? 'border-b-2 border-[#00D3CD] text-[#00D3CD]' : 'text-gray-500 hover:text-gray-700'}`}
                  onClick={() => {
                    setActiveTab('cc_bill');
                    setDetailReadOnly(false);
                    setSearchTerm('');
                    setSelectedFranchiseId('');
                    setSelectedMerchantId('');
                  }}
                >
                  CC Bill Pay Charges
                </button>
              </>
            )}
          </div>

          {/* Content */}
          <div className="p-0">
            {activeTab === 'default' && renderDetailTable()}
            {activeTab === 'specific' && viewMode === 'matrix' && renderMatrix()}
            {activeTab === 'specific' && viewMode === 'detail' && (
              <div>
                <div className="px-4 md:px-6 py-3 bg-blue-50 border-b border-blue-100 flex items-center">
                  <div className="flex items-center">
                    <span className="font-semibold text-blue-800">Franchise: </span>
                    <span className="ml-2 text-blue-900">{franchises.find(f => f.id === Number(selectedFranchiseId))?.name || 'Unknown'}</span>
                  </div>
                </div>
                {renderDetailTable()}
              </div>
            )}
            {activeTab === 'unassigned' && viewMode === 'matrix' && renderMatrix()}
            {activeTab === 'unassigned' && viewMode === 'detail' && (
              <div>
                <div className="px-4 md:px-6 py-3 bg-blue-50 border-b border-blue-100 flex items-center">
                  <div className="flex items-center">
                    <span className="font-semibold text-blue-800">Merchant: </span>
                    <span className="ml-2 text-blue-900">{unassignedMerchants.find((m) => m.id === Number(selectedMerchantId))?.name || 'Unknown'}</span>
                  </div>
                </div>
                {renderDetailTable()}
              </div>
            )}
            {activeTab === 'payout' && (
              <div className="pt-6">
                <PayoutRateSettings />
              </div>
            )}
            {activeTab === 'rental' && (
              <div className="pt-6">
                <RateSettings hideTabs />
              </div>
            )}
            {activeTab === 'cc_bill' && (
              <div className="pt-6">
                <RateSettings hideTabs initialTab="bbps_cc" />
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

              {/* Charge Type toggle + single value */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Charge Type</label>
                <div className="flex rounded overflow-hidden border border-gray-300">
                  <button
                    type="button"
                    onClick={() => setNewRateForm({ ...newRateForm, chargeType: 'percent', chargeValue: '' })}
                    className={`flex-1 py-2 text-sm font-medium transition ${newRateForm.chargeType === 'percent'
                        ? 'bg-[#00D3CD] text-white'
                        : 'bg-white text-gray-600 hover:bg-gray-50'
                      }`}
                  >
                    Percentage (%)
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewRateForm({ ...newRateForm, chargeType: 'flat', chargeValue: '' })}
                    className={`flex-1 py-2 text-sm font-medium transition ${newRateForm.chargeType === 'flat'
                        ? 'bg-[#00D3CD] text-white'
                        : 'bg-white text-gray-600 hover:bg-gray-50'
                      }`}
                  >
                    Flat (₹)
                  </button>
                </div>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max={newRateForm.chargeType === 'percent' ? '100' : undefined}
                  className="w-full mt-2 border border-gray-300 rounded p-2 focus:ring-2 focus:ring-[#00D3CD] focus:border-transparent"
                  placeholder={newRateForm.chargeType === 'percent' ? 'e.g. 1.7' : 'e.g. 10'}
                  value={newRateForm.chargeValue}
                  onChange={(e) => setNewRateForm({ ...newRateForm, chargeValue: e.target.value })}
                />
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
              {/* Charge Type toggle + single value */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Charge Type</label>
                <div className="flex rounded overflow-hidden border border-gray-300">
                  <button
                    type="button"
                    onClick={() => setPosTxnEditForm({ ...posTxnEditForm, chargeType: 'percent', chargeValue: '' })}
                    className={`flex-1 py-2 text-sm font-medium transition ${posTxnEditForm.chargeType === 'percent'
                        ? 'bg-[#00D3CD] text-white'
                        : 'bg-white text-gray-600 hover:bg-gray-50'
                      }`}
                  >
                    Percentage (%)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPosTxnEditForm({ ...posTxnEditForm, chargeType: 'flat', chargeValue: '' })}
                    className={`flex-1 py-2 text-sm font-medium transition ${posTxnEditForm.chargeType === 'flat'
                        ? 'bg-[#00D3CD] text-white'
                        : 'bg-white text-gray-600 hover:bg-gray-50'
                      }`}
                  >
                    Flat (₹)
                  </button>
                </div>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max={posTxnEditForm.chargeType === 'percent' ? '100' : undefined}
                  className="w-full mt-2 border border-gray-300 rounded p-2 focus:ring-2 focus:ring-[#00D3CD] focus:border-transparent"
                  placeholder={posTxnEditForm.chargeType === 'percent' ? 'e.g. 1.7' : 'e.g. 10'}
                  value={posTxnEditForm.chargeValue}
                  onChange={(e) => setPosTxnEditForm({ ...posTxnEditForm, chargeValue: e.target.value })}
                />
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
