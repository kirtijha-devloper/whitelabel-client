import React, { useState, useMemo } from "react";
import { useParams, useNavigate, useLocation, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CreditCard,
  ArrowUpRight,
  ShieldCheck,
  ArrowLeft,
  Search,
  Plus,
  Edit2,
  RotateCcw,
  Sliders,
  CheckCircle2,
  XCircle,
  Building,
  Globe,
  User,
  Loader2,
  Info,
  DollarSign,
  Percent,
  Layers,
  ChevronRight,
  AlertCircle,
} from "lucide-react";
import { toast } from "react-toastify";
import { getAdminDetails } from "../../api/superAdminApi";
import {
  fetchPlatformDefaultPosRules,
  fetchAdminPosRules,
  createAdminPosRule,
  updateAdminPosRule,
  deleteAdminPosRule,
  listPayoutCharges,
  getUserPayoutChargesByUser,
  createUserPayoutCharge,
  updateUserPayoutCharge,
  deleteUserPayoutCharge,
  listBbpsChargeRules,
  createBbpsChargeRule,
  updateBbpsChargeRule,
  deleteBbpsChargeRule,
} from "../../api/rateSettingsApi";

const AdminSpecificRateManagement = ({ currentUser }) => {
  const { adminId, category } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();

  // Active view: 'overview' (the 3 cards) | 'pos' | 'payout' | 'cc-bill'
  const activeCategory = useMemo(() => {
    if (!category) return "overview";
    const lower = category.toLowerCase();
    if (lower === "pos") return "pos";
    if (lower === "pay" || lower === "payout") return "payout";
    if (lower === "cc" || lower === "cc-bill" || lower === "ccbill") return "cc-bill";
    return "overview";
  }, [category]);

  // Search & filter states
  const [searchTerm, setSearchTerm] = useState("");
  const [filterMethod, setFilterMethod] = useState("ALL");
  const [filterSettlement, setFilterSettlement] = useState("ALL");

  // Modals state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  const [selectedRuleToEdit, setSelectedRuleToEdit] = useState(null);
  const [selectedRuleToReset, setSelectedRuleToReset] = useState(null);

  // Form states for editing/adding
  const [posForm, setPosForm] = useState({
    payment_mode: "CARD",
    card_type: "CREDIT",
    card_brand: "VISA",
    card_classification: "ANY",
    settlement_type: "today_settlement",
    min_amount: "0",
    max_amount: "100000",
    charge_percent: "",
    charge_flat: "0",
    gst_required: true,
    gst_percent: "18",
    company_name: "ANY",
    is_active: true,
  });

  const [slabForm, setSlabForm] = useState({
    from_amount: "",
    to_amount: "",
    rate: "",
    rate_type: "flat", // 'flat' | 'percentage'
    is_active: true,
    description: "",
  });

  // ── 1. Fetch Selected Admin Details ──────────────────────────────────────────
  const passedAdmin = location.state?.admin;
  const {
    data: adminData,
    isLoading: adminLoading,
    isError: adminError,
  } = useQuery({
    queryKey: ["superAdminAdminDetails", adminId],
    queryFn: () => getAdminDetails(adminId),
    enabled: !!adminId,
    initialData: passedAdmin ? { data: passedAdmin } : undefined,
  });

  const admin = adminData?.data || adminData?.admin || adminData || passedAdmin;

  // ── 2. Fetch POS Rates ───────────────────────────────────────────────────────
  const {
    data: defaultPosRules = [],
    isLoading: defaultPosLoading,
  } = useQuery({
    queryKey: ["defaultPosRules"],
    queryFn: fetchPlatformDefaultPosRules,
    enabled: activeCategory === "overview" || activeCategory === "pos",
  });

  const {
    data: adminPosRules = [],
    isLoading: adminPosLoading,
  } = useQuery({
    queryKey: ["adminPosRules", adminId],
    queryFn: () => fetchAdminPosRules(adminId),
    enabled: (activeCategory === "overview" || activeCategory === "pos") && !!adminId,
  });

  // ── 3. Fetch Payout Rates ────────────────────────────────────────────────────
  const {
    data: defaultPayoutData,
    isLoading: defaultPayoutLoading,
  } = useQuery({
    queryKey: ["defaultPayoutRules"],
    queryFn: listPayoutCharges,
    enabled: activeCategory === "overview" || activeCategory === "payout",
  });

  const defaultPayoutRules = useMemo(() => {
    if (!defaultPayoutData) return [];
    if (Array.isArray(defaultPayoutData)) return defaultPayoutData;
    return Array.isArray(defaultPayoutData.data) ? defaultPayoutData.data : [];
  }, [defaultPayoutData]);

  const {
    data: adminPayoutData,
    isLoading: adminPayoutLoading,
  } = useQuery({
    queryKey: ["adminPayoutRules", adminId],
    queryFn: () => getUserPayoutChargesByUser(adminId),
    enabled: (activeCategory === "overview" || activeCategory === "payout") && !!adminId,
  });

  const adminPayoutRules = useMemo(() => {
    if (!adminPayoutData) return [];
    if (Array.isArray(adminPayoutData)) return adminPayoutData;
    return Array.isArray(adminPayoutData.data) ? adminPayoutData.data : [];
  }, [adminPayoutData]);

  // ── 4. Fetch CC Bill Rates ───────────────────────────────────────────────────
  const {
    data: defaultCcBillData,
    isLoading: defaultCcBillLoading,
  } = useQuery({
    queryKey: ["defaultCcBillRules"],
    queryFn: () => listBbpsChargeRules({ user_id: "default" }),
    enabled: activeCategory === "overview" || activeCategory === "cc-bill",
  });

  const defaultCcBillRules = useMemo(() => {
    if (!defaultCcBillData) return [];
    if (Array.isArray(defaultCcBillData)) return defaultCcBillData;
    return Array.isArray(defaultCcBillData.data) ? defaultCcBillData.data : [];
  }, [defaultCcBillData]);

  const {
    data: adminCcBillData,
    isLoading: adminCcBillLoading,
  } = useQuery({
    queryKey: ["adminCcBillRules", adminId],
    queryFn: () => listBbpsChargeRules({ user_id: adminId }),
    enabled: (activeCategory === "overview" || activeCategory === "cc-bill") && !!adminId,
  });

  const adminCcBillRules = useMemo(() => {
    if (!adminCcBillData) return [];
    if (Array.isArray(adminCcBillData)) return adminCcBillData;
    return Array.isArray(adminCcBillData.data) ? adminCcBillData.data : [];
  }, [adminCcBillData]);

  // ── Helpers & Mappers ────────────────────────────────────────────────────────
  const getRuleKey = (r) => {
    if (!r) return "";
    const mode = String(r.payment_mode || "CARD").trim().toUpperCase();
    const brand = String(r.card_brand || "ANY").trim().toUpperCase();
    const type = String(r.card_type || "ANY").trim().toUpperCase();
    const classf = String(r.card_classification || "ANY").trim().toUpperCase();
    const st = String(r.settlement_type || "ANY").trim().toLowerCase();
    const comp = String(r.company_name || "ANY").trim().toUpperCase();
    return `${mode}|${brand}|${type}|${classf}|${st}|${comp}`;
  };

  // Build unified POS comparison rows
  const posComparisonRows = useMemo(() => {
    const adminRuleMap = new Map();
    adminPosRules.forEach((ar) => {
      adminRuleMap.set(getRuleKey(ar), ar);
    });

    const rows = [];
    const matchedAdminIds = new Set();

    defaultPosRules.forEach((dr) => {
      const key = getRuleKey(dr);
      const adminRule = adminRuleMap.get(key) || null;
      if (adminRule) {
        matchedAdminIds.add(adminRule.id);
      }
      rows.push({
        id: adminRule ? adminRule.id : `default-${dr.id}`,
        key,
        defaultRule: dr,
        adminRule,
        isOverridden: !!adminRule,
        payment_mode: dr.payment_mode || "CARD",
        card_brand: dr.card_brand || "ANY",
        card_type: dr.card_type || "ANY",
        card_classification: dr.card_classification || "ANY",
        settlement_type: dr.settlement_type || "today_settlement",
        min_amount: dr.min_amount ?? 0,
        max_amount: dr.max_amount ?? "Unlimited",
        company_name: dr.company_name || "ANY",
        defaultRate: Number(dr.charge_percent ?? 0),
        defaultFlat: Number(dr.charge_flat ?? 0),
        defaultGst: dr.gst_required ? Number(dr.gst_percent ?? 18) : null,
        adminRate: adminRule ? Number(adminRule.charge_percent ?? 0) : null,
        adminFlat: adminRule ? Number(adminRule.charge_flat ?? 0) : null,
        adminGst: adminRule ? (adminRule.gst_required ? Number(adminRule.gst_percent ?? 18) : null) : null,
        effectiveRate: adminRule ? Number(adminRule.charge_percent ?? 0) : Number(dr.charge_percent ?? 0),
        effectiveFlat: adminRule ? Number(adminRule.charge_flat ?? 0) : Number(dr.charge_flat ?? 0),
        effectiveGst: adminRule
          ? adminRule.gst_required ? Number(adminRule.gst_percent ?? 18) : null
          : dr.gst_required ? Number(dr.gst_percent ?? 18) : null,
        isActive: adminRule ? adminRule.is_active : dr.is_active,
      });
    });

    // Add extra custom admin rules that didn't match a platform default
    adminPosRules.forEach((ar) => {
      if (!matchedAdminIds.has(ar.id)) {
        rows.push({
          id: ar.id,
          key: getRuleKey(ar),
          defaultRule: null,
          adminRule: ar,
          isOverridden: true,
          isStandaloneCustom: true,
          payment_mode: ar.payment_mode || "CARD",
          card_brand: ar.card_brand || "ANY",
          card_type: ar.card_type || "ANY",
          card_classification: ar.card_classification || "ANY",
          settlement_type: ar.settlement_type || "today_settlement",
          min_amount: ar.min_amount ?? 0,
          max_amount: ar.max_amount ?? "Unlimited",
          company_name: ar.company_name || "ANY",
          defaultRate: null,
          defaultFlat: null,
          defaultGst: null,
          adminRate: Number(ar.charge_percent ?? 0),
          adminFlat: Number(ar.charge_flat ?? 0),
          adminGst: ar.gst_required ? Number(ar.gst_percent ?? 18) : null,
          effectiveRate: Number(ar.charge_percent ?? 0),
          effectiveFlat: Number(ar.charge_flat ?? 0),
          effectiveGst: ar.gst_required ? Number(ar.gst_percent ?? 18) : null,
          isActive: ar.is_active,
        });
      }
    });

    return rows;
  }, [defaultPosRules, adminPosRules]);

  // Build unified Payout comparison rows
  const payoutComparisonRows = useMemo(() => {
    const adminSlabMap = new Map();
    adminPayoutRules.forEach((ar) => {
      const slabKey = `${Number(ar.from_amount).toFixed(2)}-${Number(ar.to_amount).toFixed(2)}`;
      adminSlabMap.set(slabKey, ar);
    });

    const rows = [];
    const matchedAdminIds = new Set();

    defaultPayoutRules.forEach((dr) => {
      const slabKey = `${Number(dr.from_amount).toFixed(2)}-${Number(dr.to_amount).toFixed(2)}`;
      const adminRule = adminSlabMap.get(slabKey) || null;
      if (adminRule) {
        matchedAdminIds.add(adminRule.id);
      }
      rows.push({
        id: adminRule ? adminRule.id : `default-payout-${dr.id}`,
        slabKey,
        from_amount: Number(dr.from_amount),
        to_amount: Number(dr.to_amount),
        defaultRule: dr,
        adminRule,
        isOverridden: !!adminRule,
        defaultRate: Number(dr.rate),
        defaultRateType: dr.rate_type,
        adminRate: adminRule ? Number(adminRule.rate) : null,
        adminRateType: adminRule ? adminRule.rate_type : null,
        effectiveRate: adminRule ? Number(adminRule.rate) : Number(dr.rate),
        effectiveRateType: adminRule ? adminRule.rate_type : dr.rate_type,
        description: adminRule?.description || dr.description || "Payout Bank Transfer",
        isActive: adminRule ? adminRule.is_active : dr.is_active,
      });
    });

    adminPayoutRules.forEach((ar) => {
      if (!matchedAdminIds.has(ar.id)) {
        rows.push({
          id: ar.id,
          slabKey: `${Number(ar.from_amount).toFixed(2)}-${Number(ar.to_amount).toFixed(2)}`,
          from_amount: Number(ar.from_amount),
          to_amount: Number(ar.to_amount),
          defaultRule: null,
          adminRule: ar,
          isOverridden: true,
          isStandaloneCustom: true,
          defaultRate: null,
          defaultRateType: null,
          adminRate: Number(ar.rate),
          adminRateType: ar.rate_type,
          effectiveRate: Number(ar.rate),
          effectiveRateType: ar.rate_type,
          description: ar.description || "Custom Payout Slab",
          isActive: ar.is_active,
        });
      }
    });

    return rows.sort((a, b) => a.from_amount - b.from_amount);
  }, [defaultPayoutRules, adminPayoutRules]);

  // Build unified CC Bill comparison rows
  const ccBillComparisonRows = useMemo(() => {
    const adminSlabMap = new Map();
    adminCcBillRules.forEach((ar) => {
      const slabKey = `${Number(ar.from_amount).toFixed(2)}-${Number(ar.to_amount).toFixed(2)}`;
      adminSlabMap.set(slabKey, ar);
    });

    const rows = [];
    const matchedAdminIds = new Set();

    defaultCcBillRules.forEach((dr) => {
      const slabKey = `${Number(dr.from_amount).toFixed(2)}-${Number(dr.to_amount).toFixed(2)}`;
      const adminRule = adminSlabMap.get(slabKey) || null;
      if (adminRule) {
        matchedAdminIds.add(adminRule.id);
      }
      rows.push({
        id: adminRule ? adminRule.id : `default-cc-${dr.id}`,
        slabKey,
        from_amount: Number(dr.from_amount),
        to_amount: Number(dr.to_amount),
        defaultRule: dr,
        adminRule,
        isOverridden: !!adminRule,
        defaultRate: Number(dr.rate),
        defaultRateType: dr.rate_type,
        adminRate: adminRule ? Number(adminRule.rate) : null,
        adminRateType: adminRule ? adminRule.rate_type : null,
        effectiveRate: adminRule ? Number(adminRule.rate) : Number(dr.rate),
        effectiveRateType: adminRule ? adminRule.rate_type : dr.rate_type,
        description: adminRule?.description || dr.description || "BBPS Credit Card Bill Payment",
        isActive: adminRule ? adminRule.is_active : dr.is_active,
      });
    });

    adminCcBillRules.forEach((ar) => {
      if (!matchedAdminIds.has(ar.id)) {
        rows.push({
          id: ar.id,
          slabKey: `${Number(ar.from_amount).toFixed(2)}-${Number(ar.to_amount).toFixed(2)}`,
          from_amount: Number(ar.from_amount),
          to_amount: Number(ar.to_amount),
          defaultRule: null,
          adminRule: ar,
          isOverridden: true,
          isStandaloneCustom: true,
          defaultRate: null,
          defaultRateType: null,
          adminRate: Number(ar.rate),
          adminRateType: ar.rate_type,
          effectiveRate: Number(ar.rate),
          effectiveRateType: ar.rate_type,
          description: ar.description || "Custom CC Bill Slab",
          isActive: ar.is_active,
        });
      }
    });

    return rows.sort((a, b) => a.from_amount - b.from_amount);
  }, [defaultCcBillRules, adminCcBillRules]);

  // Filtering POS rows
  const filteredPosRows = useMemo(() => {
    return posComparisonRows.filter((row) => {
      if (filterMethod !== "ALL" && row.payment_mode !== filterMethod) return false;
      if (filterSettlement !== "ALL") {
        const rowSt = String(row.settlement_type).toLowerCase();
        if (filterSettlement === "T0" && !rowSt.includes("today") && !rowSt.includes("t0")) return false;
        if (filterSettlement === "T1" && !rowSt.includes("next") && !rowSt.includes("t1")) return false;
      }
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const searchTarget = `${row.payment_mode} ${row.card_brand} ${row.card_type} ${row.card_classification} ${row.company_name}`.toLowerCase();
        if (!searchTarget.includes(term)) return false;
      }
      return true;
    });
  }, [posComparisonRows, filterMethod, filterSettlement, searchTerm]);

  // Filtering Payout rows
  const filteredPayoutRows = useMemo(() => {
    return payoutComparisonRows.filter((row) => {
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const searchTarget = `₹${row.from_amount} - ₹${row.to_amount} ${row.description} ${row.effectiveRateType}`.toLowerCase();
        if (!searchTarget.includes(term)) return false;
      }
      return true;
    });
  }, [payoutComparisonRows, searchTerm]);

  // Filtering CC Bill rows
  const filteredCcBillRows = useMemo(() => {
    return ccBillComparisonRows.filter((row) => {
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const searchTarget = `₹${row.from_amount} - ₹${row.to_amount} ${row.description} ${row.effectiveRateType}`.toLowerCase();
        if (!searchTarget.includes(term)) return false;
      }
      return true;
    });
  }, [ccBillComparisonRows, searchTerm]);

  // ── Stats Summary ────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const posTotal = posComparisonRows.length;
    const posOverridden = posComparisonRows.filter((r) => r.isOverridden).length;
    const payoutTotal = payoutComparisonRows.length;
    const payoutOverridden = payoutComparisonRows.filter((r) => r.isOverridden).length;
    const ccTotal = ccBillComparisonRows.length;
    const ccOverridden = ccBillComparisonRows.filter((r) => r.isOverridden).length;

    return {
      pos: { total: posTotal, overridden: posOverridden, inherited: posTotal - posOverridden },
      payout: { total: payoutTotal, overridden: payoutOverridden, inherited: payoutTotal - payoutOverridden },
      cc: { total: ccTotal, overridden: ccOverridden, inherited: ccTotal - ccOverridden },
    };
  }, [posComparisonRows, payoutComparisonRows, ccBillComparisonRows]);

  // ── Handlers for Modal Opening ───────────────────────────────────────────────
  const handleOpenEditPos = (row) => {
    setSelectedRuleToEdit(row);
    const rule = row.adminRule || row.defaultRule;
    setPosForm({
      payment_mode: rule.payment_mode || "CARD",
      card_type: rule.card_type || "CREDIT",
      card_brand: rule.card_brand || "VISA",
      card_classification: rule.card_classification || "ANY",
      settlement_type: rule.settlement_type || "today_settlement",
      min_amount: String(rule.min_amount ?? 0),
      max_amount: rule.max_amount !== null && rule.max_amount !== undefined ? String(rule.max_amount) : "100000",
      charge_percent: String(row.adminRate !== null ? row.adminRate : row.defaultRate ?? ""),
      charge_flat: String(row.adminFlat !== null ? row.adminFlat : row.defaultFlat ?? "0"),
      gst_required: row.adminRule ? row.adminRule.gst_required : (row.defaultRule?.gst_required ?? true),
      gst_percent: String(row.adminGst !== null ? row.adminGst : (row.defaultGst ?? "18")),
      company_name: rule.company_name || "ANY",
      is_active: row.isActive ?? true,
    });
    setIsEditModalOpen(true);
  };

  const handleOpenEditSlab = (row) => {
    setSelectedRuleToEdit(row);
    setSlabForm({
      from_amount: String(row.from_amount ?? 0),
      to_amount: String(row.to_amount ?? 1000),
      rate: String(row.adminRate !== null ? row.adminRate : row.defaultRate ?? ""),
      rate_type: row.adminRateType || row.defaultRateType || "flat",
      is_active: row.isActive ?? true,
      description: row.description || "",
    });
    setIsEditModalOpen(true);
  };

  const handleOpenAddModal = () => {
    if (activeCategory === "pos") {
      setPosForm({
        payment_mode: "CARD",
        card_type: "CREDIT",
        card_brand: "VISA",
        card_classification: "ANY",
        settlement_type: "today_settlement",
        min_amount: "0",
        max_amount: "100000",
        charge_percent: "1.25",
        charge_flat: "0",
        gst_required: true,
        gst_percent: "18",
        company_name: "ANY",
        is_active: true,
      });
    } else {
      setSlabForm({
        from_amount: "0",
        to_amount: "1000",
        rate: "5.00",
        rate_type: "flat",
        is_active: true,
        description: activeCategory === "payout" ? "Custom Payout Slab" : "Custom CC Bill Slab",
      });
    }
    setIsAddModalOpen(true);
  };

  const handleOpenResetConfirm = (row) => {
    setSelectedRuleToReset(row);
    setIsResetConfirmOpen(true);
  };

  // ── Save POS Rule Mutation ───────────────────────────────────────────────────
  const savePosMutation = useMutation({
    mutationFn: async ({ isNew, row, form }) => {
      const payload = {
        user_id: parseInt(adminId, 10),
        payment_mode: form.payment_mode,
        card_type: form.card_type,
        card_brand: form.card_brand,
        card_classification: form.card_classification,
        settlement_type: form.settlement_type,
        min_amount: parseFloat(form.min_amount) || 0,
        max_amount: form.max_amount ? parseFloat(form.max_amount) : null,
        charge_percent: parseFloat(form.charge_percent),
        charge_flat: parseFloat(form.charge_flat) || 0,
        gst_required: Boolean(form.gst_required),
        gst_percent: form.gst_required ? parseFloat(form.gst_percent) || 0 : 0,
        company_name: form.company_name || null,
        is_active: Boolean(form.is_active),
      };

      if (isNaN(payload.charge_percent) || payload.charge_percent < 0 || payload.charge_percent > 100) {
        throw new Error("Charge percentage must be a number between 0 and 100.");
      }

      if (row?.adminRule?.id) {
        return updateAdminPosRule(row.adminRule.id, payload);
      } else {
        return createAdminPosRule(payload);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminPosRules", adminId] });
      toast.success("Admin POS rate updated successfully!");
      setIsEditModalOpen(false);
      setIsAddModalOpen(false);
    },
    onError: (err) => {
      toast.error(err.message || "Failed to save POS rate.");
    },
  });

  // ── Save Payout Slab Mutation ────────────────────────────────────────────────
  const savePayoutMutation = useMutation({
    mutationFn: async ({ row, form }) => {
      const fromAmount = parseFloat(form.from_amount);
      const toAmount = parseFloat(form.to_amount);
      const rateVal = parseFloat(form.rate);

      if (isNaN(fromAmount) || isNaN(toAmount) || fromAmount >= toAmount) {
        throw new Error("From Amount must be strictly less than To Amount.");
      }
      if (isNaN(rateVal) || rateVal < 0) {
        throw new Error("Rate must be a non-negative number.");
      }

      const payload = {
        user_id: parseInt(adminId, 10),
        from_amount: fromAmount,
        to_amount: toAmount,
        rate: rateVal,
        rate_type: form.rate_type,
        is_active: Boolean(form.is_active),
        description: form.description || null,
      };

      if (row?.adminRule?.id) {
        return updateUserPayoutCharge(row.adminRule.id, payload);
      } else {
        return createUserPayoutCharge(payload);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminPayoutRules", adminId] });
      toast.success("Admin payout rate saved successfully!");
      setIsEditModalOpen(false);
      setIsAddModalOpen(false);
    },
    onError: (err) => {
      toast.error(err.message || "Failed to save payout rate.");
    },
  });

  // ── Save CC Bill Slab Mutation ───────────────────────────────────────────────
  const saveCcBillMutation = useMutation({
    mutationFn: async ({ row, form }) => {
      const fromAmount = parseFloat(form.from_amount);
      const toAmount = parseFloat(form.to_amount);
      const rateVal = parseFloat(form.rate);

      if (isNaN(fromAmount) || isNaN(toAmount) || fromAmount >= toAmount) {
        throw new Error("From Amount must be strictly less than To Amount.");
      }
      if (isNaN(rateVal) || rateVal < 0) {
        throw new Error("Rate must be a non-negative number.");
      }

      const payload = {
        user_id: parseInt(adminId, 10),
        from_amount: fromAmount,
        to_amount: toAmount,
        rate: rateVal,
        rate_type: form.rate_type,
        is_active: Boolean(form.is_active),
        description: form.description || null,
      };

      if (row?.adminRule?.id) {
        return updateBbpsChargeRule(row.adminRule.id, payload);
      } else {
        return createBbpsChargeRule(payload);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminCcBillRules", adminId] });
      toast.success("Admin CC Bill rate saved successfully!");
      setIsEditModalOpen(false);
      setIsAddModalOpen(false);
    },
    onError: (err) => {
      toast.error(err.message || "Failed to save CC Bill rate.");
    },
  });

  // ── Reset to Default Mutation ────────────────────────────────────────────────
  const resetMutation = useMutation({
    mutationFn: async (row) => {
      if (!row?.adminRule?.id) return;
      if (activeCategory === "pos") {
        return deleteAdminPosRule(row.adminRule.id);
      } else if (activeCategory === "payout") {
        return deleteUserPayoutCharge(row.adminRule.id);
      } else if (activeCategory === "cc-bill") {
        return deleteBbpsChargeRule(row.adminRule.id);
      }
    },
    onSuccess: () => {
      if (activeCategory === "pos") {
        queryClient.invalidateQueries({ queryKey: ["adminPosRules", adminId] });
      } else if (activeCategory === "payout") {
        queryClient.invalidateQueries({ queryKey: ["adminPayoutRules", adminId] });
      } else if (activeCategory === "cc-bill") {
        queryClient.invalidateQueries({ queryKey: ["adminCcBillRules", adminId] });
      }
      toast.success("Admin override removed! Reverted to Platform Default.");
      setIsResetConfirmOpen(false);
      setSelectedRuleToReset(null);
    },
    onError: (err) => {
      toast.error(err.message || "Failed to reset rate to default.");
    },
  });

  const handleSaveForm = (e) => {
    e.preventDefault();
    if (activeCategory === "pos") {
      savePosMutation.mutate({ isNew: isAddModalOpen, row: selectedRuleToEdit, form: posForm });
    } else if (activeCategory === "payout") {
      savePayoutMutation.mutate({ row: selectedRuleToEdit, form: slabForm });
    } else if (activeCategory === "cc-bill") {
      saveCcBillMutation.mutate({ row: selectedRuleToEdit, form: slabForm });
    }
  };

  const handleConfirmReset = () => {
    if (selectedRuleToReset) {
      resetMutation.mutate(selectedRuleToReset);
    }
  };

  if (adminLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-[#00D3CD]" />
      </div>
    );
  }

  if (adminError || !admin) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-red-500 mb-3" />
          <h2 className="text-lg font-bold text-red-800">Admin Account Not Found</h2>
          <p className="text-sm text-red-600 mt-1">
            Could not retrieve details for Admin ID: {adminId}. Please ensure the admin exists.
          </p>
          <button
            onClick={() => navigate("/super-admin/admin-list")}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
          >
            <ArrowLeft size={16} /> Return to Admin List
          </button>
        </div>
      </div>
    );
  }

  const adminName = admin.name || "Administrator";
  const adminCode = admin.abheepay_id || admin.username || `ID: #${admin.id}`;
  const companyName = admin.company?.company_name || admin.company_or_shop_name || "Company Not Specified";
  const domainName = admin.company?.domain_name || "Platform Admin";

  return (
    <div className="min-h-screen bg-gray-50/50 p-4 md:p-6 lg:p-8 space-y-6">
      {/* ── BREADCRUMB & HEADER ───────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
            <Link to="/super-admin/admin-list" className="hover:text-gray-900 transition-colors">
              Admin List
            </Link>
            <ChevronRight size={12} />
            <span className="font-medium text-gray-700">{adminName}</span>
            <ChevronRight size={12} />
            <Link
              to={`/super-admin/admin/${adminId}/rates`}
              className={`hover:text-gray-900 transition-colors ${
                activeCategory === "overview" ? "font-semibold text-gray-900" : ""
              }`}
            >
              Rate Management
            </Link>
            {activeCategory !== "overview" && (
              <>
                <ChevronRight size={12} />
                <span className="font-semibold text-[#00a8a3] uppercase tracking-wider">
                  {activeCategory === "pos" ? "POS Rate" : activeCategory === "payout" ? "Pay Rate" : "CC Bill Rate"}
                </span>
              </>
            )}
          </div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
            {activeCategory === "overview"
              ? "Admin Rate Management"
              : activeCategory === "pos"
              ? "POS Transaction Charges"
              : activeCategory === "payout"
              ? "Payout & Banking Rates"
              : "Credit Card Bill Payment Rates"}
          </h1>
        </div>

        <div className="flex items-center gap-3">
          {activeCategory !== "overview" && (
            <button
              onClick={() => navigate(`/super-admin/admin/${adminId}/rates`)}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50 transition"
            >
              <ArrowLeft size={16} /> All Rate Cards
            </button>
          )}
          <button
            onClick={() => navigate("/super-admin/admin-list")}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50 transition"
          >
            <ArrowLeft size={16} /> Back to Admin List
          </button>
        </div>
      </div>

      {/* ── ADMIN DETAILS CONTEXT BANNER ──────────────────────────────────────── */}
      <div className="rounded-2xl border border-gray-200/80 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-[#00D3CD] to-[#1855e4] text-white shadow-md shadow-[#00D3CD]/20 font-bold text-xl">
              {adminName.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-lg font-bold text-gray-900">{adminName}</h2>
                <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200">
                  {admin.status || "active"}
                </span>
                <span className="rounded-md bg-gray-100 px-2 py-0.5 text-xs font-mono font-medium text-gray-600">
                  {adminCode}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500 mt-1.5">
                <span className="inline-flex items-center gap-1 font-medium text-gray-700">
                  <Building size={13} className="text-[#00D3CD]" />
                  {companyName}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Globe size={13} className="text-blue-500" />
                  {domainName}
                </span>
                {admin.email && (
                  <span className="text-gray-500">{admin.email}</span>
                )}
                {admin.mobile_number && (
                  <span className="text-gray-500">• +91 {admin.mobile_number}</span>
                )}
              </div>
            </div>
          </div>

          {/* QUICK CATEGORY SWITCHER PILLS */}
          <div className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-gray-50/70 p-1 self-start md:self-auto overflow-x-auto max-w-full">
            <button
              onClick={() => navigate(`/super-admin/admin/${adminId}/rates`)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                activeCategory === "overview"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Overview Cards
            </button>
            <button
              onClick={() => navigate(`/super-admin/admin/${adminId}/rates/pos`)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                activeCategory === "pos"
                  ? "bg-[#00D3CD] text-white shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              POS Rate {stats.pos.overridden > 0 && `(${stats.pos.overridden})`}
            </button>
            <button
              onClick={() => navigate(`/super-admin/admin/${adminId}/rates/payout`)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                activeCategory === "payout"
                  ? "bg-[#1855e4] text-white shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Pay Rate {stats.payout.overridden > 0 && `(${stats.payout.overridden})`}
            </button>
            <button
              onClick={() => navigate(`/super-admin/admin/${adminId}/rates/cc-bill`)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                activeCategory === "cc-bill"
                  ? "bg-purple-600 text-white shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              CC Bill Rate {stats.cc.overridden > 0 && `(${stats.cc.overridden})`}
            </button>
          </div>
        </div>
      </div>

      {/* =========================================================================
          STEP 2: RATE CATEGORY SELECTION (THREE CLICKABLE CARDS)
      ========================================================================= */}
      {activeCategory === "overview" && (
        <div className="space-y-6 animate-in fade-in duration-150">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Select Rate Category</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Choose a category to inspect platform default rates and configure custom overrides for {adminName}.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* CARD 1: POS RATE */}
            <div
              onClick={() => navigate(`/super-admin/admin/${adminId}/rates/pos`)}
              className="group cursor-pointer rounded-2xl border border-gray-200 bg-white p-6 shadow-sm hover:border-[#00D3CD] hover:shadow-lg transition-all duration-200 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between">
                  <div className="rounded-xl bg-[#00D3CD]/10 p-3 text-[#00a8a3] group-hover:scale-105 group-hover:bg-[#00D3CD] group-hover:text-white transition-all">
                    <CreditCard size={26} />
                  </div>
                  <span className="rounded-full bg-[#00D3CD]/10 px-2.5 py-1 text-xs font-semibold text-[#00a8a3]">
                    POS & Card Rules
                  </span>
                </div>

                <h3 className="text-xl font-bold text-gray-900 mt-5 group-hover:text-[#00a8a3] transition-colors">
                  POS Rate
                </h3>
                <p className="text-sm text-gray-500 mt-2 line-clamp-3 leading-relaxed">
                  Manage POS card transaction charges, applicable transaction methods, card networks, classifications,
                  amount ranges, settlement types (T0/T1), flat charges, GST, and percentage rates.
                </p>

                <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between text-xs text-gray-600">
                  <span>Platform Defaults: <strong className="text-gray-900">{stats.pos.total}</strong></span>
                  <span>Overrides: <strong className="text-emerald-600">{stats.pos.overridden}</strong></span>
                </div>
              </div>

              <div className="mt-6 flex items-center justify-between pt-4 border-t border-gray-100 font-semibold text-sm text-[#00a8a3] group-hover:translate-x-1 transition-transform">
                <span>Configure POS Rates</span>
                <ChevronRight size={18} />
              </div>
            </div>

            {/* CARD 2: PAY RATE */}
            <div
              onClick={() => navigate(`/super-admin/admin/${adminId}/rates/payout`)}
              className="group cursor-pointer rounded-2xl border border-gray-200 bg-white p-6 shadow-sm hover:border-[#1855e4] hover:shadow-lg transition-all duration-200 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between">
                  <div className="rounded-xl bg-[#1855e4]/10 p-3 text-[#1855e4] group-hover:scale-105 group-hover:bg-[#1855e4] group-hover:text-white transition-all">
                    <ArrowUpRight size={26} />
                  </div>
                  <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                    Payout & Banking
                  </span>
                </div>

                <h3 className="text-xl font-bold text-gray-900 mt-5 group-hover:text-[#1855e4] transition-colors">
                  Pay Rate
                </h3>
                <p className="text-sm text-gray-500 mt-2 line-clamp-3 leading-relaxed">
                  Manage the applicable payout and banking transaction charges. Configure slab-wise flat or percentage
                  fees across Instant Payout (IMPS), NEFT, and RTGS methods.
                </p>

                <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between text-xs text-gray-600">
                  <span>Platform Slabs: <strong className="text-gray-900">{stats.payout.total}</strong></span>
                  <span>Overrides: <strong className="text-emerald-600">{stats.payout.overridden}</strong></span>
                </div>
              </div>

              <div className="mt-6 flex items-center justify-between pt-4 border-t border-gray-100 font-semibold text-sm text-[#1855e4] group-hover:translate-x-1 transition-transform">
                <span>Configure Pay Rates</span>
                <ChevronRight size={18} />
              </div>
            </div>

            {/* CARD 3: CC BILL RATE */}
            <div
              onClick={() => navigate(`/super-admin/admin/${adminId}/rates/cc-bill`)}
              className="group cursor-pointer rounded-2xl border border-gray-200 bg-white p-6 shadow-sm hover:border-purple-600 hover:shadow-lg transition-all duration-200 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between">
                  <div className="rounded-xl bg-purple-50 p-3 text-purple-600 group-hover:scale-105 group-hover:bg-purple-600 group-hover:text-white transition-all">
                    <ShieldCheck size={26} />
                  </div>
                  <span className="rounded-full bg-purple-50 px-2.5 py-1 text-xs font-semibold text-purple-700">
                    BBPS & CC Utility
                  </span>
                </div>

                <h3 className="text-xl font-bold text-gray-900 mt-5 group-hover:text-purple-600 transition-colors">
                  CC Bill Rate
                </h3>
                <p className="text-sm text-gray-500 mt-2 line-clamp-3 leading-relaxed">
                  Manage the applicable credit card bill payment charges. Configure slab-wise service charges, percentage
                  and flat rate configurations for credit card bill settlements.
                </p>

                <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between text-xs text-gray-600">
                  <span>Platform Slabs: <strong className="text-gray-900">{stats.cc.total}</strong></span>
                  <span>Overrides: <strong className="text-emerald-600">{stats.cc.overridden}</strong></span>
                </div>
              </div>

              <div className="mt-6 flex items-center justify-between pt-4 border-t border-gray-100 font-semibold text-sm text-purple-600 group-hover:translate-x-1 transition-transform">
                <span>Configure CC Bill Rates</span>
                <ChevronRight size={18} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          STEP 3: CATEGORY VIEW WITH DEFAULT-VS-ADMIN COMPARISON
      ========================================================================= */}
      {activeCategory !== "overview" && (
        <div className="space-y-4 animate-in fade-in duration-150">
          {/* TOOLBAR: SEARCH, FILTERS & ADD BUTTON */}
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative min-w-[240px]">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search rules, networks, slabs..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 pl-9 pr-3 py-2 text-sm focus:border-[#00D3CD] focus:outline-none focus:ring-1 focus:ring-[#00D3CD]"
                />
              </div>

              {activeCategory === "pos" && (
                <>
                  <select
                    value={filterMethod}
                    onChange={(e) => setFilterMethod(e.target.value)}
                    className="rounded-xl border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 focus:border-[#00D3CD] focus:outline-none"
                  >
                    <option value="ALL">All Methods</option>
                    <option value="CARD">Card Transactions</option>
                    <option value="UPI">UPI Transactions</option>
                  </select>

                  <select
                    value={filterSettlement}
                    onChange={(e) => setFilterSettlement(e.target.value)}
                    className="rounded-xl border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 focus:border-[#00D3CD] focus:outline-none"
                  >
                    <option value="ALL">All Settlements</option>
                    <option value="T0">Today Settlement (T0)</option>
                    <option value="T1">Next Day Settlement (T1)</option>
                  </select>
                </>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleOpenAddModal}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#00D3CD] to-[#1855e4] px-4 py-2 text-sm font-semibold text-white shadow hover:opacity-95 transition"
              >
                <Plus size={16} /> Add Custom Rule
              </button>
            </div>
          </div>

          {/* RATE COMPARISON TABLE: POS RATE */}
          {activeCategory === "pos" && (
            <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="font-bold text-gray-900">POS Rate Rules Comparison</span>
                  <span className="text-xs text-gray-500">
                    Showing {filteredPosRows.length} rule(s) • Platform Defaults remain reference standards
                  </span>
                </div>
                <div className="flex items-center gap-4 text-xs font-medium">
                  <span className="inline-flex items-center gap-1.5 text-gray-600">
                    <span className="h-2 w-2 rounded-full bg-blue-500" /> Platform Default
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-gray-600">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" /> Admin Override
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-gray-600">
                    <span className="h-2 w-2 rounded-full bg-gray-300" /> Inherited Default
                  </span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50/80 text-[11px] font-bold uppercase tracking-wider text-gray-600">
                      <th className="py-3.5 px-4">Transaction / Method</th>
                      <th className="py-3.5 px-4">Network & Type</th>
                      <th className="py-3.5 px-4">Classification</th>
                      <th className="py-3.5 px-4">Settlement</th>
                      <th className="py-3.5 px-4">Amount Slab</th>
                      <th className="py-3.5 px-4 bg-blue-50/40 text-blue-900 border-l border-blue-100">
                        Platform Default Rate
                      </th>
                      <th className="py-3.5 px-4 bg-emerald-50/40 text-emerald-900 border-l border-emerald-100">
                        Selected Admin Rate
                      </th>
                      <th className="py-3.5 px-4 bg-gray-50 text-gray-800 border-l border-gray-200">
                        Effective Rate
                      </th>
                      <th className="py-3.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-gray-700">
                    {filteredPosRows.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-12 text-center text-gray-400">
                          No matching POS rate rules found.
                        </td>
                      </tr>
                    ) : (
                      filteredPosRows.map((row) => (
                        <tr key={row.id} className="hover:bg-gray-50/60 transition-colors">
                          <td className="py-3.5 px-4 font-semibold text-gray-900">
                            <span className="inline-flex items-center gap-1.5">
                              {row.payment_mode === "CARD" ? (
                                <CreditCard size={15} className="text-[#00a8a3]" />
                              ) : (
                                <Percent size={15} className="text-blue-600" />
                              )}
                              {row.payment_mode}
                            </span>
                            {row.company_name && row.company_name !== "ANY" && (
                              <span className="block text-[10px] text-gray-400 font-mono">
                                Provider: {row.company_name}
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="font-medium text-gray-800">{row.card_brand}</span>
                            <span className="block text-xs text-gray-500">{row.card_type}</span>
                          </td>
                          <td className="py-3.5 px-4 text-xs font-mono text-gray-600">
                            {row.card_classification}
                          </td>
                          <td className="py-3.5 px-4 text-xs">
                            <span
                              className={`rounded-full px-2 py-0.5 font-medium ${
                                String(row.settlement_type).toLowerCase().includes("today") ||
                                String(row.settlement_type).toUpperCase() === "T0"
                                  ? "bg-amber-50 text-amber-700 border border-amber-200"
                                  : "bg-blue-50 text-blue-700 border border-blue-200"
                              }`}
                            >
                              {row.settlement_type}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-xs font-mono text-gray-600">
                            ₹{row.min_amount} – {row.max_amount ? `₹${row.max_amount}` : "Max"}
                          </td>
                          {/* PLATFORM DEFAULT COLUMN */}
                          <td className="py-3.5 px-4 bg-blue-50/20 border-l border-blue-100 font-mono text-xs">
                            {row.defaultRule ? (
                              <div>
                                <span className="font-bold text-gray-900">{row.defaultRate.toFixed(2)}%</span>
                                {row.defaultFlat > 0 && (
                                  <span className="text-gray-500"> + ₹{row.defaultFlat.toFixed(2)}</span>
                                )}
                                {row.defaultGst !== null && (
                                  <span className="block text-[10px] text-gray-500">GST: {row.defaultGst}%</span>
                                )}
                                <span className="mt-1 inline-block rounded bg-blue-100 px-1.5 py-0.5 text-[9px] font-bold text-blue-800">
                                  Default
                                </span>
                              </div>
                            ) : (
                              <span className="text-gray-400 italic">No Default Rule</span>
                            )}
                          </td>
                          {/* SELECTED ADMIN RATE COLUMN */}
                          <td className="py-3.5 px-4 bg-emerald-50/20 border-l border-emerald-100 text-xs font-mono">
                            {row.isOverridden ? (
                              <div>
                                <span className="font-bold text-emerald-700 text-sm">{row.adminRate.toFixed(2)}%</span>
                                {row.adminFlat > 0 && (
                                  <span className="text-emerald-600 font-semibold"> + ₹{row.adminFlat.toFixed(2)}</span>
                                )}
                                {row.adminGst !== null && (
                                  <span className="block text-[10px] text-emerald-600">GST: {row.adminGst}%</span>
                                )}
                                <span className="mt-1 inline-block rounded bg-emerald-100 px-1.5 py-0.5 text-[9px] font-bold text-emerald-800">
                                  Admin Override
                                </span>
                              </div>
                            ) : (
                              <div>
                                <span className="text-gray-500 italic">Inherited from default</span>
                                <span className="block text-gray-700 font-medium">({row.defaultRate.toFixed(2)}%)</span>
                                <span className="mt-1 inline-block rounded bg-gray-100 px-1.5 py-0.5 text-[9px] font-semibold text-gray-600">
                                  Inherited
                                </span>
                              </div>
                            )}
                          </td>
                          {/* EFFECTIVE RATE COLUMN */}
                          <td className="py-3.5 px-4 bg-gray-50/50 border-l border-gray-200 text-xs font-mono font-bold">
                            <span
                              className={`rounded-lg px-2.5 py-1 inline-block ${
                                row.isOverridden
                                  ? "bg-emerald-600 text-white shadow-sm"
                                  : "bg-gray-200 text-gray-800"
                              }`}
                            >
                              {row.effectiveRate.toFixed(2)}%
                              {row.effectiveFlat > 0 ? ` + ₹${row.effectiveFlat}` : ""}
                            </span>
                          </td>
                          {/* ACTIONS */}
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleOpenEditPos(row)}
                                className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs font-semibold text-gray-700 hover:border-[#00D3CD] hover:text-[#00a8a3] transition"
                                title="Edit or Configure Override"
                              >
                                <Edit2 size={13} />
                                {row.isOverridden ? "Edit" : "Override"}
                              </button>
                              {row.isOverridden && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenResetConfirm(row)}
                                  className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50/50 px-2.5 py-1 text-xs font-semibold text-red-600 hover:bg-red-100 transition"
                                  title="Reset to Platform Default"
                                >
                                  <RotateCcw size={13} />
                                  Reset
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* RATE COMPARISON TABLE: PAY RATE */}
          {activeCategory === "payout" && (
            <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="font-bold text-gray-900">Payout & Banking Charges Slabs</span>
                  <span className="text-xs text-gray-500">
                    Showing {filteredPayoutRows.length} slab rule(s) • Inherited from PayoutCharges platform default
                  </span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50/80 text-[11px] font-bold uppercase tracking-wider text-gray-600">
                      <th className="py-3.5 px-4">Amount Slab Range</th>
                      <th className="py-3.5 px-4">Service Description</th>
                      <th className="py-3.5 px-4 bg-blue-50/40 text-blue-900 border-l border-blue-100">
                        Platform Default Rate
                      </th>
                      <th className="py-3.5 px-4 bg-emerald-50/40 text-emerald-900 border-l border-emerald-100">
                        Selected Admin Rate
                      </th>
                      <th className="py-3.5 px-4 bg-gray-50 text-gray-800 border-l border-gray-200">
                        Effective Rate
                      </th>
                      <th className="py-3.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-gray-700">
                    {filteredPayoutRows.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-gray-400">
                          No payout slab rules found.
                        </td>
                      </tr>
                    ) : (
                      filteredPayoutRows.map((row) => (
                        <tr key={row.id} className="hover:bg-gray-50/60 transition-colors">
                          <td className="py-3.5 px-4 font-bold font-mono text-gray-900">
                            ₹{row.from_amount.toLocaleString("en-IN")} – ₹{row.to_amount.toLocaleString("en-IN")}
                          </td>
                          <td className="py-3.5 px-4 text-xs text-gray-600">
                            {row.description}
                          </td>
                          {/* PLATFORM DEFAULT */}
                          <td className="py-3.5 px-4 bg-blue-50/20 border-l border-blue-100 font-mono text-xs">
                            {row.defaultRule ? (
                              <div>
                                <span className="font-bold text-gray-900">
                                  {row.defaultRateType === "flat" ? `₹${row.defaultRate.toFixed(2)}` : `${row.defaultRate.toFixed(2)}%`}
                                </span>
                                <span className="text-gray-500 capitalize"> ({row.defaultRateType})</span>
                                <span className="mt-1 block w-fit rounded bg-blue-100 px-1.5 py-0.5 text-[9px] font-bold text-blue-800">
                                  Default
                                </span>
                              </div>
                            ) : (
                              <span className="text-gray-400 italic">No Default Slab</span>
                            )}
                          </td>
                          {/* SELECTED ADMIN RATE */}
                          <td className="py-3.5 px-4 bg-emerald-50/20 border-l border-emerald-100 text-xs font-mono">
                            {row.isOverridden ? (
                              <div>
                                <span className="font-bold text-emerald-700 text-sm">
                                  {row.adminRateType === "flat" ? `₹${row.adminRate.toFixed(2)}` : `${row.adminRate.toFixed(2)}%`}
                                </span>
                                <span className="text-emerald-600 capitalize font-medium"> ({row.adminRateType})</span>
                                <span className="mt-1 block w-fit rounded bg-emerald-100 px-1.5 py-0.5 text-[9px] font-bold text-emerald-800">
                                  Admin Override
                                </span>
                              </div>
                            ) : (
                              <div>
                                <span className="text-gray-500 italic">Inherited (Default)</span>
                                <span className="mt-1 block w-fit rounded bg-gray-100 px-1.5 py-0.5 text-[9px] font-semibold text-gray-600">
                                  Inherited
                                </span>
                              </div>
                            )}
                          </td>
                          {/* EFFECTIVE RATE */}
                          <td className="py-3.5 px-4 bg-gray-50/50 border-l border-gray-200 text-xs font-mono font-bold">
                            <span
                              className={`rounded-lg px-2.5 py-1 inline-block ${
                                row.isOverridden
                                  ? "bg-emerald-600 text-white shadow-sm"
                                  : "bg-gray-200 text-gray-800"
                              }`}
                            >
                              {row.effectiveRateType === "flat" ? `₹${row.effectiveRate.toFixed(2)} Flat` : `${row.effectiveRate.toFixed(2)}%`}
                            </span>
                          </td>
                          {/* ACTIONS */}
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleOpenEditSlab(row)}
                                className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs font-semibold text-gray-700 hover:border-[#1855e4] hover:text-[#1855e4] transition"
                              >
                                <Edit2 size={13} />
                                {row.isOverridden ? "Edit" : "Override"}
                              </button>
                              {row.isOverridden && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenResetConfirm(row)}
                                  className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50/50 px-2.5 py-1 text-xs font-semibold text-red-600 hover:bg-red-100 transition"
                                >
                                  <RotateCcw size={13} />
                                  Reset
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* RATE COMPARISON TABLE: CC BILL RATE */}
          {activeCategory === "cc-bill" && (
            <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="font-bold text-gray-900">BBPS Credit Card Bill Payment Slabs</span>
                  <span className="text-xs text-gray-500">
                    Showing {filteredCcBillRows.length} slab rule(s) • Inherited from BbpsCcChargeRules platform default
                  </span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50/80 text-[11px] font-bold uppercase tracking-wider text-gray-600">
                      <th className="py-3.5 px-4">Amount Slab Range</th>
                      <th className="py-3.5 px-4">Service Description</th>
                      <th className="py-3.5 px-4 bg-blue-50/40 text-blue-900 border-l border-blue-100">
                        Platform Default Rate
                      </th>
                      <th className="py-3.5 px-4 bg-emerald-50/40 text-emerald-900 border-l border-emerald-100">
                        Selected Admin Rate
                      </th>
                      <th className="py-3.5 px-4 bg-gray-50 text-gray-800 border-l border-gray-200">
                        Effective Rate
                      </th>
                      <th className="py-3.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-gray-700">
                    {filteredCcBillRows.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-gray-400">
                          No CC Bill slab rules found.
                        </td>
                      </tr>
                    ) : (
                      filteredCcBillRows.map((row) => (
                        <tr key={row.id} className="hover:bg-gray-50/60 transition-colors">
                          <td className="py-3.5 px-4 font-bold font-mono text-gray-900">
                            ₹{row.from_amount.toLocaleString("en-IN")} – ₹{row.to_amount.toLocaleString("en-IN")}
                          </td>
                          <td className="py-3.5 px-4 text-xs text-gray-600">
                            {row.description}
                          </td>
                          {/* PLATFORM DEFAULT */}
                          <td className="py-3.5 px-4 bg-blue-50/20 border-l border-blue-100 font-mono text-xs">
                            {row.defaultRule ? (
                              <div>
                                <span className="font-bold text-gray-900">
                                  {row.defaultRateType === "flat" ? `₹${row.defaultRate.toFixed(2)}` : `${row.defaultRate.toFixed(2)}%`}
                                </span>
                                <span className="text-gray-500 capitalize"> ({row.defaultRateType})</span>
                                <span className="mt-1 block w-fit rounded bg-blue-100 px-1.5 py-0.5 text-[9px] font-bold text-blue-800">
                                  Default
                                </span>
                              </div>
                            ) : (
                              <span className="text-gray-400 italic">No Default Slab</span>
                            )}
                          </td>
                          {/* SELECTED ADMIN RATE */}
                          <td className="py-3.5 px-4 bg-emerald-50/20 border-l border-emerald-100 text-xs font-mono">
                            {row.isOverridden ? (
                              <div>
                                <span className="font-bold text-emerald-700 text-sm">
                                  {row.adminRateType === "flat" ? `₹${row.adminRate.toFixed(2)}` : `${row.adminRate.toFixed(2)}%`}
                                </span>
                                <span className="text-emerald-600 capitalize font-medium"> ({row.adminRateType})</span>
                                <span className="mt-1 block w-fit rounded bg-emerald-100 px-1.5 py-0.5 text-[9px] font-bold text-emerald-800">
                                  Admin Override
                                </span>
                              </div>
                            ) : (
                              <div>
                                <span className="text-gray-500 italic">Inherited (Default)</span>
                                <span className="mt-1 block w-fit rounded bg-gray-100 px-1.5 py-0.5 text-[9px] font-semibold text-gray-600">
                                  Inherited
                                </span>
                              </div>
                            )}
                          </td>
                          {/* EFFECTIVE RATE */}
                          <td className="py-3.5 px-4 bg-gray-50/50 border-l border-gray-200 text-xs font-mono font-bold">
                            <span
                              className={`rounded-lg px-2.5 py-1 inline-block ${
                                row.isOverridden
                                  ? "bg-emerald-600 text-white shadow-sm"
                                  : "bg-gray-200 text-gray-800"
                              }`}
                            >
                              {row.effectiveRateType === "flat" ? `₹${row.effectiveRate.toFixed(2)} Flat` : `${row.effectiveRate.toFixed(2)}%`}
                            </span>
                          </td>
                          {/* ACTIONS */}
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleOpenEditSlab(row)}
                                className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs font-semibold text-gray-700 hover:border-purple-600 hover:text-purple-600 transition"
                              >
                                <Edit2 size={13} />
                                {row.isOverridden ? "Edit" : "Override"}
                              </button>
                              {row.isOverridden && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenResetConfirm(row)}
                                  className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50/50 px-2.5 py-1 text-xs font-semibold text-red-600 hover:bg-red-100 transition"
                                >
                                  <RotateCcw size={13} />
                                  Reset
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          MODAL: EDIT OR OVERRIDE RATE
      ========================================================================= */}
      {(isEditModalOpen || isAddModalOpen) && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-gray-100 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4 bg-gray-50/70">
              <div className="flex items-center gap-2">
                <span className="rounded-lg bg-[#00D3CD]/15 p-1.5 text-[#00a8a3]">
                  <Sliders size={18} />
                </span>
                <h3 className="text-lg font-bold text-gray-900">
                  {isAddModalOpen
                    ? `Add Custom ${activeCategory === "pos" ? "POS" : activeCategory === "payout" ? "Payout" : "CC Bill"} Rule`
                    : `Configure Admin Override Rate`}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsEditModalOpen(false);
                  setIsAddModalOpen(false);
                }}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveForm} className="p-6 space-y-4">
              <div className="rounded-xl bg-blue-50/60 p-3 text-xs text-blue-800 flex items-start gap-2 border border-blue-100">
                <Info size={16} className="text-blue-500 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Target Admin: {adminName} ({adminCode})</p>
                  <p className="text-blue-700 mt-0.5">
                    Changes made here apply strictly to this admin. Platform defaults remain preserved as system standards.
                  </p>
                </div>
              </div>

              {activeCategory === "pos" ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Payment Method</label>
                      <select
                        value={posForm.payment_mode}
                        onChange={(e) => setPosForm({ ...posForm, payment_mode: e.target.value })}
                        disabled={!isAddModalOpen}
                        className="w-full rounded-xl border border-gray-300 p-2 text-xs focus:ring-1 focus:ring-[#00D3CD]"
                      >
                        <option value="CARD">CARD</option>
                        <option value="UPI">UPI</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Network</label>
                      <select
                        value={posForm.card_brand}
                        onChange={(e) => setPosForm({ ...posForm, card_brand: e.target.value })}
                        disabled={!isAddModalOpen}
                        className="w-full rounded-xl border border-gray-300 p-2 text-xs focus:ring-1 focus:ring-[#00D3CD]"
                      >
                        <option value="VISA">VISA</option>
                        <option value="MASTER_CARD">MASTER_CARD</option>
                        <option value="RUPAY">RUPAY</option>
                        <option value="AMEX">AMEX</option>
                        <option value="DINERS">DINERS</option>
                        <option value="ANY">ANY</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Card Type</label>
                      <select
                        value={posForm.card_type}
                        onChange={(e) => setPosForm({ ...posForm, card_type: e.target.value })}
                        disabled={!isAddModalOpen}
                        className="w-full rounded-xl border border-gray-300 p-2 text-xs focus:ring-1 focus:ring-[#00D3CD]"
                      >
                        <option value="CREDIT">CREDIT</option>
                        <option value="DEBIT">DEBIT</option>
                        <option value="PREPAID">PREPAID</option>
                        <option value="ANY">ANY</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Settlement Type</label>
                      <select
                        value={posForm.settlement_type}
                        onChange={(e) => setPosForm({ ...posForm, settlement_type: e.target.value })}
                        disabled={!isAddModalOpen}
                        className="w-full rounded-xl border border-gray-300 p-2 text-xs focus:ring-1 focus:ring-[#00D3CD]"
                      >
                        <option value="today_settlement">Today Settlement (T0)</option>
                        <option value="next_day_settlement">Next Day Settlement (T1)</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        Admin Charge Rate (%) <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        required
                        value={posForm.charge_percent}
                        onChange={(e) => setPosForm({ ...posForm, charge_percent: e.target.value })}
                        className="w-full rounded-xl border border-gray-300 p-2 text-sm font-semibold text-emerald-700 focus:ring-2 focus:ring-[#00D3CD]"
                        placeholder="e.g. 1.25"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Flat Charge (₹)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={posForm.charge_flat}
                        onChange={(e) => setPosForm({ ...posForm, charge_flat: e.target.value })}
                        className="w-full rounded-xl border border-gray-300 p-2 text-sm focus:ring-1 focus:ring-[#00D3CD]"
                        placeholder="e.g. 0.00"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="gstRequired"
                        checked={posForm.gst_required}
                        onChange={(e) => setPosForm({ ...posForm, gst_required: e.target.checked })}
                        className="h-4 w-4 rounded text-[#00D3CD] focus:ring-[#00D3CD]"
                      />
                      <label htmlFor="gstRequired" className="text-xs font-semibold text-gray-700 cursor-pointer">
                        GST Applicable
                      </label>
                    </div>

                    {posForm.gst_required && (
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">GST Rate (%)</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          max="100"
                          value={posForm.gst_percent}
                          onChange={(e) => setPosForm({ ...posForm, gst_percent: e.target.value })}
                          className="w-full rounded-xl border border-gray-300 p-2 text-xs focus:ring-1 focus:ring-[#00D3CD]"
                          placeholder="18"
                        />
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                /* SLAB FORM FOR PAYOUT OR CC BILL */
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        From Amount (₹) <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        required
                        disabled={!isAddModalOpen}
                        value={slabForm.from_amount}
                        onChange={(e) => setSlabForm({ ...slabForm, from_amount: e.target.value })}
                        className="w-full rounded-xl border border-gray-300 p-2 text-sm font-mono focus:ring-1 focus:ring-[#00D3CD]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        To Amount (₹) <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        required
                        disabled={!isAddModalOpen}
                        value={slabForm.to_amount}
                        onChange={(e) => setSlabForm({ ...slabForm, to_amount: e.target.value })}
                        className="w-full rounded-xl border border-gray-300 p-2 text-sm font-mono focus:ring-1 focus:ring-[#00D3CD]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Rate Type</label>
                      <select
                        value={slabForm.rate_type}
                        onChange={(e) => setSlabForm({ ...slabForm, rate_type: e.target.value })}
                        className="w-full rounded-xl border border-gray-300 p-2 text-xs focus:ring-1 focus:ring-[#00D3CD]"
                      >
                        <option value="flat">Flat Fee (₹)</option>
                        <option value="percentage">Percentage (%)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        Admin Rate Value <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        required
                        value={slabForm.rate}
                        onChange={(e) => setSlabForm({ ...slabForm, rate: e.target.value })}
                        className="w-full rounded-xl border border-gray-300 p-2 text-sm font-semibold text-emerald-700 focus:ring-2 focus:ring-[#00D3CD]"
                        placeholder={slabForm.rate_type === "flat" ? "e.g. 5.00" : "e.g. 1.50"}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Description</label>
                    <input
                      type="text"
                      value={slabForm.description}
                      onChange={(e) => setSlabForm({ ...slabForm, description: e.target.value })}
                      className="w-full rounded-xl border border-gray-300 p-2 text-xs focus:ring-1 focus:ring-[#00D3CD]"
                      placeholder="e.g. Standard settlement rate"
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditModalOpen(false);
                    setIsAddModalOpen(false);
                  }}
                  className="rounded-xl border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={
                    savePosMutation.isPending || savePayoutMutation.isPending || saveCcBillMutation.isPending
                  }
                  className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#00D3CD] to-[#1855e4] px-5 py-2 text-xs font-semibold text-white shadow hover:opacity-95 transition disabled:opacity-50"
                >
                  {(savePosMutation.isPending || savePayoutMutation.isPending || saveCcBillMutation.isPending) && (
                    <Loader2 size={14} className="animate-spin" />
                  )}
                  Save Admin Override
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: RESET TO DEFAULT CONFIRMATION
      ========================================================================= */}
      {isResetConfirmOpen && selectedRuleToReset && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-gray-100 animate-in fade-in zoom-in-95 duration-150 space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-100 text-red-600 shrink-0">
                <RotateCcw size={22} />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900">Reset to Platform Default?</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Are you sure you want to remove the admin-specific override for {adminName}?
                </p>
              </div>
            </div>

            <div className="rounded-xl bg-gray-50 p-3.5 border border-gray-200 text-xs text-gray-600 space-y-1">
              <p>
                <strong>Category:</strong>{" "}
                {activeCategory === "pos" ? "POS Transaction Charges" : activeCategory === "payout" ? "Pay Rate" : "CC Bill Rate"}
              </p>
              <p>
                <strong>Status:</strong> The admin override record will be permanently deleted.
              </p>
              <p className="text-emerald-700 font-semibold">
                ✓ Platform default rate is preserved and will become the effective rate.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsResetConfirmOpen(false);
                  setSelectedRuleToReset(null);
                }}
                className="rounded-xl border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmReset}
                disabled={resetMutation.isPending}
                className="inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-4 py-2 text-xs font-semibold text-white shadow hover:bg-red-700 disabled:opacity-50"
              >
                {resetMutation.isPending && <Loader2 size={13} className="animate-spin" />}
                Confirm Reset
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminSpecificRateManagement;
