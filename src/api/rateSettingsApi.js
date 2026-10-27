import axios from 'axios';
import { BASE_URL } from '../constants';
import { FranchiseAllUsers, MerchantAllUsers, SuperFranchiseAllUsers, AllUsers } from './FranchiseApi';
import { getAuthToken } from '../utils/auth';

const getAuthHeaders = () => {
  const token = getAuthToken();
  return {
    headers: {
      Authorization: `Bearer ${token}`
    }
  };
};

const POS_CHARGE_RULES_BASE = `${BASE_URL}/pos-charge-rules`;
const RULE_SCOPES = {
  SUPER_ADMIN_DEFAULT: 'super_admin_default',
  SUPER_ADMIN_ADMIN: 'super_admin_admin',
  ADMIN_DEFAULT: 'admin_default',
  ADMIN_SUPER_FRANCHISE: 'admin_super_franchise',
  SUPER_FRANCHISE_DEFAULT: 'super_franchise_default',
  SUPER_FRANCHISE_FRANCHISE: 'super_franchise_franchise',
  SUPER_FRANCHISE_MERCHANT: 'super_franchise_merchant',
  ADMIN_FRANCHISE: 'admin_franchise',
  ADMIN_MERCHANT: 'admin_merchant',
  FRANCHISE_DEFAULT: 'franchise_default',
  FRANCHISE_MERCHANT: 'franchise_merchant'
};
const RATE_LOG_PREFIX = '[rate-settings]';
const RATE_LOG_ALLOWLIST = new Set([
  'franchise-rates:update-global:charge',
  'franchise-rates:update-global:request',
  'franchise-rates:update-global:success',
  'franchise-rates:update-specific:charge',
  'franchise-rates:update-specific:request',
  'franchise-rates:update-specific:success',
  'merchant-rates:update-default:charge',
  'merchant-rates:update-default:request',
  'merchant-rates:update-default:success',
  'merchant-rates:update-specific:charge',
  'merchant-rates:update-specific:request',
  'merchant-rates:update-specific:success',
  'rules:create-override:charge',
  'rules:create-override:request',
  'rules:create-override:success'
]);

const normalizeToken = (value) =>
  String(value ?? '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');

const normalizeClassificationToken = (value) =>
  String(value ?? '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .replace(/[/_\\-]/g, ' ');

const normalizeKeyToken = (value) => normalizeToken(value).replace(/[/_\\-]/g, '');

const logRateInfo = (event, payload = {}) => {
  if (!RATE_LOG_ALLOWLIST.has(event)) {
    return;
  }
  console.info(`${RATE_LOG_PREFIX} ${event}`, payload);
};

const summarizeRuleForLog = (rule) => {
  if (!rule) return null;

  return {
    id: rule.id ?? null,
    user_id: getFirstDefined(rule, ['user_id', 'userId']) ?? null,
    franchaise_id: getFirstDefined(rule, ['franchaise_id', 'franchise_id', 'franchiseId']) ?? null,
    payment_mode: getFirstDefined(rule, ['payment_mode', 'paymentMode', 'method']) ?? null,
    card_type: getFirstDefined(rule, ['card_type', 'cardType']) ?? null,
    card_brand: getFirstDefined(rule, ['card_brand', 'cardBrand', 'network']) ?? null,
    card_classification: getFirstDefined(rule, ['card_classification', 'cardClassification']) ?? null,
    min_amount: getFirstDefined(rule, ['min_amount', 'minAmount']) ?? null,
    max_amount: getFirstDefined(rule, ['max_amount', 'maxAmount']) ?? null,
    charge_percent: getFirstDefined(rule, ['charge_percent', 'chargePercent', 'base_rate', 'merchant_rate']) ?? null,
    gst_required: getFirstDefined(rule, ['gst_required', 'gstRequired']) ?? null,
    gst_percent: getFirstDefined(rule, ['gst_percent', 'gstPercent', 'gst_rate', 'gstRate']) ?? null,
    is_active: getFirstDefined(rule, ['is_active', 'isActive']) ?? null,
    company_name: getFirstDefined(rule, ['company_name', 'companyName']) ?? null,
    source_scope: rule?.source_scope ?? null,
    base_source_scope: rule?.base_source_scope ?? null,
    rule_key: rule?.rule_key ?? null
  };
};

const parseRequestData = (value) => {
  if (!value) return null;
  if (typeof value !== 'string') return value;

  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};

const logRateError = (event, error, payload = {}) => {
  console.error(`${RATE_LOG_PREFIX} ${event}`, {
    ...payload,
    message: error?.message,
    code: error?.code || null,
    status: error?.response?.status,
    responseMessage: error?.response?.data?.message,
    responseErrors: error?.response?.data?.errors || null,
    responseData: error?.response?.data || null,
    requestUrl: error?.config?.url || null,
    requestMethod: error?.config?.method ? String(error.config.method).toUpperCase() : null,
    requestParams: error?.config?.params || null,
    requestData: parseRequestData(error?.config?.data),
    hasResponse: Boolean(error?.response),
    hasRequest: Boolean(error?.request),
    requestReadyState: error?.request?.readyState ?? null,
    requestStatusText: error?.request?.statusText ?? null
  });
};

const PAYMENT_MODE_LABELS = {
  CARD: 'Card',
  UPI: 'UPI',
  NETBANKING: 'Net Banking',
  WALLET: 'Wallet',
  CASH: 'Cash',
  PREPAID: 'Prepaid',
  CORPORATE: 'Corporate'
};

const CARD_TYPE_LABELS = {
  CREDIT: 'Credit',
  DEBIT: 'Debit',
  PREPAID: 'Prepaid',
  CORPORATEBUSINESS: 'Corporate/Business',
  CORPORATE: 'Corporate/Business',
  COMMERCIAL: 'Commercial',
  CHARGE: 'Charge',
  INTERNATIONAL: 'International'
};

const CARD_BRAND_LABELS = {
  VISA: 'VISA',
  MASTERCARD: 'MASTERCARD',
  RUPAY: 'RUPAY',
  AMEX: 'AMEX',
  DINERSCLUB: 'DINERS CLUB',
  OTHER: 'OTHER'
};

const CLASSIFICATION_LABELS = {
  ANY: 'ANY',
  CLASSIC: 'Classic',
  BUSINESS: 'Business',
  REWARDS: 'Rewards',
  PLATINUM: 'Platinum',
  PREPAID: 'Prepaid'
};

const titleCase = (value) =>
  String(value ?? '')
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());

const toFiniteNumber = (value, fallback = null) => {
  if (value === null || value === undefined || value === '') return fallback;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};

const toNullableNumber = (value) => toFiniteNumber(value, null);

const getFirstDefined = (source, keys) => {
  if (!source) return undefined;
  for (const key of keys) {
    if (source[key] !== undefined) {
      return source[key];
    }
  }
  return undefined;
};

const getPreferredValue = (source, overrides, keys) => {
  const overrideValue = getFirstDefined(overrides, keys);
  return overrideValue !== undefined ? overrideValue : getFirstDefined(source, keys);
};

const stripUndefined = (value) =>
  Object.fromEntries(Object.entries(value).filter(([, current]) => current !== undefined));

const stripRuleFranchiseId = (rule = {}) => {
  if (!rule || typeof rule !== 'object') {
    return {};
  }

  const nextRule = { ...rule };
  delete nextRule.franchaise_id;
  delete nextRule.franchise_id;
  delete nextRule.franchiseId;
  return nextRule;
};

const extractArrayPayload = (payload) => {
  const candidates = [
    payload,
    payload?.data,
    payload?.data?.data,
    payload?.data?.rows,
    payload?.rows,
    payload?.records,
    payload?.items,
    payload?.rules
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate;
    }

    if (candidate && typeof candidate === 'object') {
      const groupedArrays = Object.values(candidate).filter(Array.isArray);
      if (groupedArrays.length > 0) {
        return groupedArrays.flat();
      }
    }
  }

  return [];
};

const extractPaginationPayload = (payload, fallbackPage = 1, fallbackLimit = 100) => {
  const pagination = payload?.pagination || payload?.data?.pagination || payload || {};
  const page = Number(
    pagination.page ?? pagination.current_page ?? pagination.currentPage ?? fallbackPage
  );
  const limit = Number(
    pagination.limit ?? pagination.per_page ?? pagination.perPage ?? fallbackLimit
  );
  const total = Number(
    pagination.total ?? pagination.totalRecords ?? pagination.total_count ?? pagination.count ?? 0
  );
  const totalPages = Number(
    pagination.totalPages ?? pagination.total_pages ?? pagination.pages ?? pagination.last_page ??
    (Number.isFinite(limit) && limit > 0 ? Math.ceil(total / limit) : 1)
  );

  return {
    ...pagination,
    total: Number.isFinite(total) && total >= 0 ? total : 0,
    page: Number.isFinite(page) && page > 0 ? page : fallbackPage,
    limit: Number.isFinite(limit) && limit > 0 ? limit : fallbackLimit,
    totalPages: Number.isFinite(totalPages) && totalPages > 0 ? totalPages : 1
  };
};

const extractRuleRecord = (payload) => {
  const candidates = [
    payload?.record,
    payload?.rule,
    payload?.data?.record,
    payload?.data?.rule,
    payload?.data,
    payload
  ];
  return candidates.find((candidate) => {
    if (!candidate || Array.isArray(candidate) || typeof candidate !== 'object') return false;

    return [
      'id',
      'payment_mode',
      'paymentMode',
      'charge_percent',
      'chargePercent',
      'card_brand',
      'cardBrand',
      'card_type',
      'cardType'
    ].some((key) => candidate[key] !== undefined);
  }) || null;
};

const getRuleUserId = (rule) => toNullableNumber(getFirstDefined(rule, ['user_id', 'userId']));
const getRuleFranchiseId = (rule) =>
  toNullableNumber(getFirstDefined(rule, ['franchaise_id', 'franchise_id', 'franchiseId']));
const getRuleSuperFranchiseId = (rule) =>
  toNullableNumber(getFirstDefined(rule, ['super_franchise_id', 'superFranchiseId']));
const getRawRuleScope = (rule) => {
  const scope = getFirstDefined(rule, ['scope']);
  return typeof scope === 'string' ? scope.trim().toLowerCase() : null;
};
const getEntityUserId = (entity) =>
  toNullableNumber(getFirstDefined(entity, ['id', 'merchant_id', 'merchantId', 'user_id', 'userId']));
const hasMerchantScope = (rule) => getRuleUserId(rule) !== null;
const hasFranchiseScope = (rule) => getRuleFranchiseId(rule) !== null;
const hasSuperFranchiseScope = (rule) => getRuleSuperFranchiseId(rule) !== null;
const isAdminDefaultRule = (rule) => {
  const scope = getRawRuleScope(rule);
  if (scope) return scope === RULE_SCOPES.ADMIN_DEFAULT || scope === RULE_SCOPES.SUPER_ADMIN_DEFAULT || scope === RULE_SCOPES.SUPER_ADMIN_ADMIN;
  return !hasMerchantScope(rule) && !hasFranchiseScope(rule) && !hasSuperFranchiseScope(rule);
};
const isAdminSuperFranchiseRule = (rule) => {
  const scope = getRawRuleScope(rule);
  if (scope) return scope === RULE_SCOPES.ADMIN_SUPER_FRANCHISE;
  return hasSuperFranchiseScope(rule);
};
const isAdminFranchiseRule = (rule) => {
  const scope = getRawRuleScope(rule);
  if (scope) return scope === RULE_SCOPES.ADMIN_FRANCHISE;
  return false;
};
const isAdminMerchantRule = (rule) => {
  const scope = getRawRuleScope(rule);
  if (scope) return scope === RULE_SCOPES.ADMIN_MERCHANT;
  return false;
};
const isFranchiseDefaultRule = (rule) => {
  const scope = getRawRuleScope(rule);
  if (scope) return scope === RULE_SCOPES.FRANCHISE_DEFAULT;
  return !hasMerchantScope(rule) && hasFranchiseScope(rule);
};
const isFranchiseMerchantRule = (rule) => {
  const scope = getRawRuleScope(rule);
  if (scope) return scope === RULE_SCOPES.FRANCHISE_MERCHANT;
  return hasMerchantScope(rule) && hasFranchiseScope(rule);
};
const isAdminRule = (rule) => isAdminDefaultRule(rule);
const isFranchiseRule = (rule) => isFranchiseDefaultRule(rule);
const isMerchantRule = (rule) => isAdminMerchantRule(rule) || isFranchiseMerchantRule(rule);
const getRuleScope = (rule) => {
  const scope = getRawRuleScope(rule);
  if (scope === RULE_SCOPES.ADMIN_DEFAULT || scope === RULE_SCOPES.SUPER_ADMIN_DEFAULT || scope === RULE_SCOPES.SUPER_ADMIN_ADMIN) return 'admin';
  if (scope === RULE_SCOPES.ADMIN_SUPER_FRANCHISE) return 'super_franchise';
  if (scope === RULE_SCOPES.ADMIN_FRANCHISE || scope === RULE_SCOPES.FRANCHISE_DEFAULT) return 'franchise';
  if (scope === RULE_SCOPES.ADMIN_MERCHANT || scope === RULE_SCOPES.FRANCHISE_MERCHANT) return 'merchant';
  if (isAdminSuperFranchiseRule(rule)) return 'super_franchise';
  if (isMerchantRule(rule)) return 'merchant';
  if (isFranchiseRule(rule)) return 'franchise';
  return 'admin';
};
const getEntityFranchiseId = (entity, fallback = null) =>
  toNullableNumber(
    getFirstDefined(entity, ['franchaise_id', 'franchise_id', 'franchiseId', 'created_by'])
  ) ?? fallback;
const isActiveRule = (rule) => rule?.is_active !== false;

const toApiPaymentMode = (value) => {
  const token = normalizeToken(value);
  if (!token || token === 'ALL') return null;
  if (token === 'NETBANK' || token === 'NETBANKING') return 'NETBANKING';
  if (token === 'CARD') return 'CARD';
  if (token === 'UPI') return 'UPI';
  if (token === 'WALLET') return 'WALLET';
  if (token === 'CASH') return 'CASH';
  if (token === 'PREPAID') return 'PREPAID';
  if (token === 'CORPORATE') return 'CORPORATE';
  return token;
};

const toApiCardType = (value) => {
  const token = normalizeKeyToken(value);
  if (!token || token === 'ALL' || token === 'NA') return null;
  return token;
};

const toApiCardBrand = (value) => {
  const token = normalizeToken(value);
  if (!token || token === 'ALL' || token === 'NA') return null;
  if (token === 'DINERSCLUB') return 'DINERSCLUB';
  return token;
};

const toApiCardClassification = (value) => {
  const token = normalizeClassificationToken(value);
  if (!token || token === 'ANY' || token === 'ALL' || token === 'NA') return null;
  return token;
};

const fromApiPaymentMode = (value) => {
  const token = normalizeToken(value);
  return PAYMENT_MODE_LABELS[token] || value || 'ALL';
};

const fromApiCardType = (value) => {
  const token = normalizeKeyToken(value);
  if (!token) return 'N/A';
  return CARD_TYPE_LABELS[token] || titleCase(String(value).replace(/[_-]/g, ' '));
};

const fromApiCardBrand = (value) => {
  // Use normalizeKeyToken to strip underscores/hyphens so MASTER_CARD and MASTERCARD both map to the same label
  const token = normalizeKeyToken(value);
  if (!token) return 'ALL';
  return CARD_BRAND_LABELS[token] || token;
};

const fromApiCardClassification = (value) => {
  const token = normalizeToken(value);
  if (!token) return 'ANY';
  return CLASSIFICATION_LABELS[token] || titleCase(String(value));
};

const makeRuleKey = (rule) => {
  const minAmount = toFiniteNumber(rule?.min_amount ?? rule?.from_amount, 0);
  // Parse max_amount to a number first so "500.00" and 500 both produce "500" — preventing duplicate keys
  const rawMax = rule?.max_amount ?? rule?.to_amount;
  const parsedMax = toNullableNumber(rawMax);
  const maxAmount = parsedMax === null ? 'OPEN' : String(parsedMax);

  return [
    normalizeKeyToken(rule?.payment_mode || rule?.method),
    normalizeKeyToken(rule?.card_brand || rule?.network),
    normalizeKeyToken(rule?.card_type),
    normalizeKeyToken(rule?.card_classification),
    normalizeKeyToken(rule?.settlement_type),
    normalizeKeyToken(rule?.company_name),
    String(minAmount ?? 0),
    maxAmount
  ].join('|');
};

export const sortMappedRates = (a, b) => {
  const left = [
    a.method,
    a.network,
    a.card_type,
    a.card_classification,
    String(a.min_amount ?? 0),
    String(a.max_amount ?? '')
  ].join('|');
  const right = [
    b.method,
    b.network,
    b.card_type,
    b.card_classification,
    String(b.min_amount ?? 0),
    String(b.max_amount ?? '')
  ].join('|');
  return left.localeCompare(right);
};

const normalizeRulePayload = (source = {}, overrides = {}) => {
  const paymentMode = toApiPaymentMode(getPreferredValue(source, overrides, ['payment_mode', 'paymentMode', 'method']));
  const cardType = toApiCardType(getPreferredValue(source, overrides, ['card_type', 'cardType']));
  const cardBrand = toApiCardBrand(getPreferredValue(source, overrides, ['card_brand', 'cardBrand', 'network']));
  const superFranchiseId = toNullableNumber(
    getPreferredValue(source, overrides, ['super_franchise_id', 'superFranchiseId'])
  );
  const franchiseId = toNullableNumber(
    getPreferredValue(source, overrides, ['franchaise_id', 'franchise_id', 'franchiseId'])
  );
  const cardClassification = paymentMode === 'CARD'
    ? toApiCardClassification(getPreferredValue(source, overrides, ['card_classification', 'cardClassification']))
    : null;
  const explicitGstRequired = getFirstDefined(overrides, ['gst_required', 'gstRequired']);
  const sourceGstRequired = getFirstDefined(source, ['gst_required', 'gstRequired']);
  const gstRequired = explicitGstRequired !== undefined
    ? Boolean(explicitGstRequired)
    : sourceGstRequired !== undefined
      ? Boolean(sourceGstRequired)
      : cardClassification === 'BUSINESS';
  const maxAmountValue = getPreferredValue(source, overrides, ['max_amount', 'maxAmount', 'to_amount', 'toAmount']);

  return stripUndefined({
    user_id: getPreferredValue(source, overrides, ['user_id', 'userId']) ?? null,
    super_franchise_id: superFranchiseId,
    franchaise_id: franchiseId,
    payment_mode: paymentMode,
    card_type: cardType,
    card_brand: cardBrand,
    card_classification: cardClassification,
    settlement_type: getPreferredValue(source, overrides, ['settlement_type', 'settlementType']) ?? null,
    company_name: getPreferredValue(source, overrides, ['company_name', 'companyName']) ?? null,
    min_amount: toFiniteNumber(getPreferredValue(source, overrides, ['min_amount', 'minAmount', 'from_amount', 'fromAmount']), 0),
    max_amount: maxAmountValue === undefined ? null : toNullableNumber(maxAmountValue),
    charge_percent: toFiniteNumber(getPreferredValue(source, overrides, ['charge_percent', 'chargePercent', 'base_rate', 'merchant_rate']), 0),
    charge_flat: toFiniteNumber(getPreferredValue(source, overrides, ['charge_flat', 'chargeFlat', 'flat_fee', 'flatFee']), 0),
    gst_required: gstRequired,
    gst_percent: gstRequired
      ? toFiniteNumber(getPreferredValue(source, overrides, ['gst_percent', 'gstPercent', 'gst_rate', 'gstRate']), 18)
      : 0,
    is_active: getPreferredValue(source, overrides, ['is_active', 'isActive']) ?? true
  });
};

const buildUpdatePayload = (updates = {}, currentRule = {}) => {
  return normalizeRulePayload(currentRule, updates);
};

const resolveUpdatedRuleRecord = ({ responseData, currentRule, payload, ruleId, logEvent, context = {} }) => {
  const responseRecord = extractRuleRecord(responseData);
  if (responseRecord) {
    return responseRecord;
  }

  const fallbackRecord = stripUndefined({
    ...(currentRule || {}),
    ...(payload || {}),
    id: currentRule?.id ?? ruleId
  });

  logRateInfo(`${logEvent}:empty-response-fallback`, {
    ...context,
    ruleId,
    responseData: responseData ?? null,
    fallbackRecord: summarizeRuleForLog(fallbackRecord)
  });

  return fallbackRecord;
};

const mapRuleToSuperFranchiseFormat = (rule, options = {}) => ({
  id: rule.id,
  rule_id: rule.id,
  superFranchiseId: options.superFranchiseId ?? getRuleSuperFranchiseId(rule) ?? null,
  super_franchise_id: getRuleSuperFranchiseId(rule),
  method: fromApiPaymentMode(rule.payment_mode),
  network: fromApiCardBrand(rule.card_brand),
  card_type: fromApiCardType(rule.card_type),
  sub_type: rule.sub_type || 'Consumer',
  card_classification: fromApiCardClassification(rule.card_classification),
  gst_required: Boolean(rule.gst_required),
  gst_rate: rule.gst_required ? toFiniteNumber(rule.gst_percent, 0) : null,
  base_rate: options.baseRule
    ? toFiniteNumber(options.baseRule.charge_percent, 0)
    : options.adminRule
      ? toFiniteNumber(options.adminRule.charge_percent, 0)
      : toFiniteNumber(rule.base_rate ?? rule.charge_percent, 0),
  base_flat_rate: options.baseRule ? toFiniteNumber(options.baseRule.charge_flat, 0) : toFiniteNumber(rule.base_flat_rate ?? rule.charge_flat, 0),
  admin_rate: options.adminRule
    ? toFiniteNumber(options.adminRule.charge_percent, 0)
    : options.baseRule
      ? toFiniteNumber(options.baseRule.charge_percent, 0)
      : isAdminRule(rule)
        ? toFiniteNumber(rule.charge_percent, 0)
        : toFiniteNumber(rule.admin_rate ?? rule.base_rate ?? rule.charge_percent, 0),
  admin_flat_rate: options.adminRule ? toFiniteNumber(options.adminRule.charge_flat, 0) : toFiniteNumber(options.baseRule?.charge_flat ?? rule.charge_flat, 0),
  charge_flat: toFiniteNumber(rule.charge_flat, 0) ?? 0,
  settlement_type: rule.settlement_type || null,
  company_name: rule.company_name || null,
  min_amount: toFiniteNumber(rule.min_amount, 0),
  max_amount: toNullableNumber(rule.max_amount),
  isInherited: Boolean(options.isInherited),
  default_rule_id: options.baseRule?.id ?? null,
  base_rule: options.baseRule || null,
  original_rule: rule,
  rule_key: makeRuleKey(rule),
  source_scope: getRuleScope(rule),
  base_source_scope: options.baseRule ? getRuleScope(options.baseRule) : null
});

const mapRuleToFranchiseFormat = (rule, options = {}) => ({
  id: rule.id,
  rule_id: rule.id,
  franchiseId: options.franchiseId ?? getRuleFranchiseId(rule) ?? null,
  franchaise_id: getRuleFranchiseId(rule),
  method: fromApiPaymentMode(rule.payment_mode),
  network: fromApiCardBrand(rule.card_brand),
  card_type: fromApiCardType(rule.card_type),
  sub_type: rule.sub_type || 'Consumer',
  card_classification: fromApiCardClassification(rule.card_classification),
  gst_required: Boolean(rule.gst_required),
  gst_rate: rule.gst_required ? toFiniteNumber(rule.gst_percent, 0) : null,
  base_rate: options.baseRule
    ? toFiniteNumber(options.baseRule.charge_percent, 0)
    : options.adminRule
      ? toFiniteNumber(options.adminRule.charge_percent, 0)
      : toFiniteNumber(rule.base_rate ?? rule.charge_percent, 0),
  base_flat_rate: options.baseRule ? toFiniteNumber(options.baseRule.charge_flat, 0) : toFiniteNumber(rule.base_flat_rate ?? rule.charge_flat, 0),
  admin_rate: options.adminRule
    ? toFiniteNumber(options.adminRule.charge_percent, 0)
    : options.baseRule
      ? toFiniteNumber(options.baseRule.charge_percent, 0)
      : (rule.admin_rate !== undefined && rule.admin_rate !== null)
        ? toFiniteNumber(rule.admin_rate, 0)
        : isAdminRule(rule)
          ? toFiniteNumber(rule.charge_percent, 0)
          : toFiniteNumber(rule.admin_rate ?? rule.base_rate ?? rule.charge_percent, 0),
  admin_flat_rate: options.adminRule ? toFiniteNumber(options.adminRule.charge_flat, 0) : toFiniteNumber(options.baseRule?.charge_flat ?? rule.charge_flat, 0),
  charge_flat: toFiniteNumber(rule.charge_flat, 0) ?? 0,
  settlement_type: rule.settlement_type || null,
  company_name: rule.company_name || null,
  min_amount: toFiniteNumber(rule.min_amount, 0),
  max_amount: toNullableNumber(rule.max_amount),
  isInherited: Boolean(options.isInherited),
  default_rule_id: options.baseRule?.id ?? null,
  base_rule: options.baseRule || null,
  original_rule: rule,
  rule_key: makeRuleKey(rule),
  source_scope: getRuleScope(rule),
  base_source_scope: options.baseRule ? getRuleScope(options.baseRule) : null
});

export const mapRuleToAdminFormat = (rule, options = {}) => ({
  id: rule.id,
  rule_id: rule.id,
  adminId: options.adminId ?? rule.user_id ?? null,
  user_id: options.adminId ?? rule.user_id ?? null,
  method: fromApiPaymentMode(rule.payment_mode),
  network: fromApiCardBrand(rule.card_brand),
  card_type: fromApiCardType(rule.card_type),
  sub_type: rule.sub_type || 'Consumer',
  card_classification: fromApiCardClassification(rule.card_classification),
  gst_required: Boolean(rule.gst_required),
  gst_rate: rule.gst_required ? toFiniteNumber(rule.gst_percent, 0) : null,
  base_rate: toFiniteNumber(rule.charge_percent, 0),
  merchant_rate: toFiniteNumber(rule.charge_percent, 0),
  admin_rate: toFiniteNumber(rule.charge_percent, 0),
  platform_default_rate: options.defaultRule
    ? toFiniteNumber(options.defaultRule.charge_percent, 0)
    : toFiniteNumber(rule.charge_percent, 0),
  charge_flat: toFiniteNumber(rule.charge_flat, 0) ?? 0,
  settlement_type: rule.settlement_type || null,
  company_name: rule.company_name || null,
  min_amount: toFiniteNumber(rule.min_amount, 0),
  max_amount: toNullableNumber(rule.max_amount),
  isInherited: Boolean(options.isInherited),
  default_rule_id: options.baseRule?.id ?? null,
  base_rule: options.baseRule || null,
  original_rule: rule,
  rule_key: makeRuleKey(rule),
  source_scope: getRuleScope(rule),
  base_source_scope: options.baseRule ? getRuleScope(options.baseRule) : null
});

const mapRuleToMerchantFormat = (rule, options = {}) => ({
  id: rule.id,
  rule_id: rule.id,
  merchantId: options.merchantId ?? null,
  franchiseId: options.franchiseId ?? getRuleFranchiseId(rule) ?? null,
  franchaise_id: getRuleFranchiseId(rule),
  method: fromApiPaymentMode(rule.payment_mode),
  network: fromApiCardBrand(rule.card_brand),
  card_type: fromApiCardType(rule.card_type),
  sub_type: rule.sub_type || 'Consumer',
  card_classification: fromApiCardClassification(rule.card_classification),
  gst_required: Boolean(rule.gst_required),
  gst_rate: rule.gst_required ? toFiniteNumber(rule.gst_percent, 0) : null,
  merchant_rate: toFiniteNumber(rule.charge_percent, 0),
  base_rate: options.baseRule
    ? toFiniteNumber(options.baseRule.charge_percent, 0)
    : options.franchiseRule
      ? toFiniteNumber(options.franchiseRule.charge_percent, 0)
      : options.adminRule
        ? toFiniteNumber(options.adminRule.charge_percent, 0)
        : toFiniteNumber(rule.base_rate ?? rule.charge_percent, 0),
  base_flat_rate: options.baseRule ? toFiniteNumber(options.baseRule.charge_flat, 0) : toFiniteNumber(rule.base_flat_rate ?? rule.charge_flat, 0),
  admin_rate: options.adminRule
    ? toFiniteNumber(options.adminRule.charge_percent, 0)
    : options.baseRule
      ? toFiniteNumber(options.baseRule.charge_percent, 0)
      : (rule.admin_rate !== undefined && rule.admin_rate !== null)
        ? toFiniteNumber(rule.admin_rate, 0)
        : isAdminRule(rule)
          ? toFiniteNumber(rule.charge_percent, 0)
          : toFiniteNumber(rule.admin_rate ?? rule.base_rate ?? rule.charge_percent, 0),
  admin_flat_rate: options.adminRule ? toFiniteNumber(options.adminRule.charge_flat, 0) : toFiniteNumber(options.baseRule?.charge_flat ?? rule.charge_flat, 0),
  franchise_rate: options.franchiseRule
    ? toFiniteNumber(options.franchiseRule.charge_percent, 0)
    : isFranchiseRule(rule)
      ? toFiniteNumber(rule.charge_percent, 0)
      : null,
  charge_flat: toFiniteNumber(rule.charge_flat, 0) ?? 0,
  settlement_type: rule.settlement_type || null,
  company_name: rule.company_name || null,
  min_amount: toFiniteNumber(rule.min_amount, 0),
  max_amount: toNullableNumber(rule.max_amount),
  isInherited: Boolean(options.isInherited),
  default_rule_id: options.baseRule?.id ?? null,
  base_rule: options.baseRule || null,
  original_rule: rule,
  rule_key: makeRuleKey(rule),
  source_scope: getRuleScope(rule),
  base_source_scope: options.baseRule ? getRuleScope(options.baseRule) : null
});

const enrichManagedFranchiseDefaultRate = (mappedRate, { adminRule = null, franchiseRule = null } = {}) => {
  const adminRate = adminRule
    ? toFiniteNumber(adminRule.charge_percent, 0)
    : mappedRate.admin_rate ?? mappedRate.base_rate;
  const franchiseRate = franchiseRule
    ? toFiniteNumber(franchiseRule.charge_percent, 0)
    : mappedRate.merchant_rate ?? mappedRate.franchise_rate ?? mappedRate.base_rate ?? adminRate;

  const adminFlatRate = adminRule ? toFiniteNumber(adminRule.charge_flat, 0) : mappedRate.admin_flat_rate ?? mappedRate.base_flat_rate ?? 0;
  const franchiseFlatRate = franchiseRule ? toFiniteNumber(franchiseRule.charge_flat, 0) : mappedRate.charge_flat ?? adminFlatRate;
  return {
    ...mappedRate,
    admin_rate: adminRate,
    base_rate: adminRate,
    admin_flat_rate: adminFlatRate,
    base_flat_rate: adminFlatRate,
    charge_flat: franchiseFlatRate,
    merchant_rate: franchiseRate,
    franchise_rate: franchiseRule ? franchiseRate : null,
    source_scope: franchiseRule ? 'franchise' : 'admin',
    base_source_scope: adminRule ? 'admin' : mappedRate.base_source_scope
  };
};

const fetchChargeRules = async (params = {}, { includePagination = false } = {}) => {
  const normalizedParams = { ...params };
  if (Array.isArray(normalizedParams.scope)) {
    normalizedParams.scope = normalizedParams.scope.join(',');
  }
  const requestConfig = {
    ...getAuthHeaders(),
    params: Object.fromEntries(
      Object.entries({
        limit: 2000,
        ...normalizedParams
      }).filter(([, value]) => value !== undefined && value !== null && value !== '')
    )
  };

  logRateInfo('rules:list:request', requestConfig.params);

  const response = await axios.get(`${POS_CHARGE_RULES_BASE}/list`, requestConfig);
  const rules = extractArrayPayload(response.data).filter(isActiveRule);

  logRateInfo('rules:list:success', {
    params: requestConfig.params,
    count: rules.length
  });

  if (!includePagination) {
    return rules;
  }

  const pagination = extractPaginationPayload(
    response.data,
    Number(requestConfig.params.page) || 1,
    Number(requestConfig.params.limit) || 2000
  );

  return { rules, pagination };
};

const fetchChargeRulesByAudience = async (audience, params = {}) => {
  const activeFilterValue = params?.is_active;
  const normalizedActiveFilter =
    activeFilterValue === undefined ? undefined : String(activeFilterValue).toLowerCase();

  const apiParams = { ...params };
  if (normalizedActiveFilter === 'all') {
    delete apiParams.is_active;
  }

  const requestConfig = {
    ...getAuthHeaders(),
    params: Object.fromEntries(
      Object.entries({
        limit: 2000,
        ...apiParams
      }).filter(([, value]) => value !== undefined && value !== null && value !== '')
    )
  };

  const response = await axios.get(`${POS_CHARGE_RULES_BASE}/list/${audience}`, requestConfig);
  const rules = extractArrayPayload(response.data);

  if (normalizedActiveFilter === 'false') {
    return rules.filter((rule) => rule?.is_active === false);
  }

  if (normalizedActiveFilter === 'true') {
    return rules.filter(isActiveRule);
  }

  // Default/"all" behavior
  return rules;
};

const fetchRulesByScopes = async (scopes = [], params = {}) => {
  const responses = await Promise.all(
    scopes.map((scope) => fetchChargeRules({ ...params, scope }))
  );

  const ruleMap = new Map();
  responses.flat().forEach((rule) => {
    if (rule?.id !== undefined && rule?.id !== null) {
      ruleMap.set(rule.id, rule);
      return;
    }

    ruleMap.set(`${getRawRuleScope(rule) || 'unknown'}-${makeRuleKey(rule)}`, rule);
  });

  return Array.from(ruleMap.values());
};

const isUplineRule = (rule) => {
  const scope = getRawRuleScope(rule);
  return (
    isAdminDefaultRule(rule) ||
    isAdminFranchiseRule(rule) ||
    scope === 'super_franchise_franchise' ||
    scope === 'super_franchise_default' ||
    scope === RULE_SCOPES.SUPER_FRANCHISE_FRANCHISE ||
    scope === RULE_SCOPES.SUPER_FRANCHISE_DEFAULT ||
    scope === RULE_SCOPES.ADMIN_SUPER_FRANCHISE
  );
};

const getAdminAudienceRulePriority = (rule) => {
  const scope = getRawRuleScope(rule);
  if (scope === 'super_franchise_franchise' || scope === RULE_SCOPES.SUPER_FRANCHISE_FRANCHISE) return 6;
  if (scope === 'super_franchise_default' || scope === RULE_SCOPES.SUPER_FRANCHISE_DEFAULT) return 5;
  if (scope === 'admin_super_franchise' || scope === RULE_SCOPES.ADMIN_SUPER_FRANCHISE) return 4;
  if (scope === 'admin_franchise' || scope === RULE_SCOPES.ADMIN_FRANCHISE || scope === 'admin_merchant' || scope === RULE_SCOPES.ADMIN_MERCHANT) return 3;
  if (getRuleFranchiseId(rule) !== null || getRuleUserId(rule) !== null) return 3;
  if (scope === 'super_admin_admin' || scope === RULE_SCOPES.SUPER_ADMIN_ADMIN) return 2;
  if (scope === 'admin_default' || scope === RULE_SCOPES.ADMIN_DEFAULT) return 1;
  return 0; // SUPER_ADMIN_DEFAULT
};

const getMerchantRulePriority = (rule) => {
  const scope = getRawRuleScope(rule);

  if (scope === RULE_SCOPES.FRANCHISE_MERCHANT) return 5;
  if (scope === RULE_SCOPES.ADMIN_MERCHANT) return 4;
  if (scope === RULE_SCOPES.FRANCHISE_DEFAULT) return 3;
  if (scope === RULE_SCOPES.ADMIN_FRANCHISE) return 2;
  if (scope === RULE_SCOPES.ADMIN_DEFAULT) return 1;

  if (getRuleUserId(rule) !== null && getRuleFranchiseId(rule) !== null) return 5;
  if (getRuleUserId(rule) !== null) return 4;
  if (getRuleFranchiseId(rule) !== null) return 3;
  return 1;
};

const buildPreferredRuleMap = (rules, getPriority = () => 0) => {
  const ruleMap = new Map();

  rules.forEach((rule) => {
    const key = makeRuleKey(rule);
    const existingRule = ruleMap.get(key);

    if (!existingRule || getPriority(rule) >= getPriority(existingRule)) {
      ruleMap.set(key, rule);
    }
  });

  return ruleMap;
};

const buildFranchiseEffectiveRules = (adminRules, franchiseRules, franchiseId) => {
  const resolvedFranchiseId = toNullableNumber(franchiseId) ?? franchiseId ?? null;
  const adminByKey = buildPreferredRuleMap(adminRules, getAdminAudienceRulePriority);
  const franchiseByKey = new Map(franchiseRules.map((rule) => [makeRuleKey(rule), rule]));
  const keys = new Set([...adminByKey.keys(), ...franchiseByKey.keys()]);

  return [...keys]
    .map((key) => {
      const adminRule = adminByKey.get(key) || null;
      const franchiseRule = franchiseByKey.get(key) || null;
      const effectiveRule = franchiseRule || adminRule;

      if (!effectiveRule) {
        return null;
      }

      return mapRuleToFranchiseFormat(effectiveRule, {
        franchiseId: resolvedFranchiseId,
        adminRule: adminRule || effectiveRule,
        baseRule: adminRule,
        isInherited: !franchiseRule
      });
    })
    .filter(Boolean)
    .sort(sortMappedRates);
};

export const buildAdminEffectiveRules = (defaultRules, adminRules, adminId) => {
  const resolvedAdminId = toNullableNumber(adminId) ?? adminId ?? null;
  const defaultByKey = new Map((defaultRules || []).map((rule) => [makeRuleKey(rule), rule]));
  const adminByKey = new Map((adminRules || []).map((rule) => [makeRuleKey(rule), rule]));
  const keys = new Set([...defaultByKey.keys(), ...adminByKey.keys()]);

  return [...keys]
    .map((key) => {
      const defaultRule = defaultByKey.get(key) || null;
      const adminRule = adminByKey.get(key) || null;
      const effectiveRule = adminRule || defaultRule;

      if (!effectiveRule) {
        return null;
      }

      return mapRuleToAdminFormat(effectiveRule, {
        adminId: resolvedAdminId,
        defaultRule: defaultRule || effectiveRule,
        baseRule: defaultRule,
        isInherited: !adminRule,
      });
    })
    .filter(Boolean)
    .sort(sortMappedRates);
};

const buildSuperFranchiseEffectiveRules = (adminRules, superFranchiseRules, superFranchiseId) => {
  const resolvedSuperFranchiseId = toNullableNumber(superFranchiseId) ?? superFranchiseId ?? null;
  const adminByKey = buildPreferredRuleMap(adminRules, getAdminAudienceRulePriority);
  const sfByKey = new Map(superFranchiseRules.map((rule) => [makeRuleKey(rule), rule]));
  const keys = new Set([...adminByKey.keys(), ...sfByKey.keys()]);

  return [...keys]
    .map((key) => {
      const adminRule = adminByKey.get(key) || null;
      const sfRule = sfByKey.get(key) || null;
      const effectiveRule = sfRule || adminRule;

      if (!effectiveRule) {
        return null;
      }

      return mapRuleToSuperFranchiseFormat(effectiveRule, {
        superFranchiseId: resolvedSuperFranchiseId,
        adminRule: adminRule || effectiveRule,
        baseRule: adminRule,
        isInherited: !sfRule
      });
    })
    .filter(Boolean)
    .sort(sortMappedRates);
};

const buildMerchantEffectiveRules = (adminRules, franchiseRules, merchantRules, merchantId, franchiseId = null) => {
  const resolvedMerchantId = toNullableNumber(merchantId) ?? merchantId ?? null;
  const resolvedFranchiseId = toNullableNumber(franchiseId) ?? franchiseId ?? null;
  const adminByKey = buildPreferredRuleMap(adminRules, getAdminAudienceRulePriority);
  const franchiseByKey = new Map(franchiseRules.map((rule) => [makeRuleKey(rule), rule]));
  const merchantByKey = new Map(merchantRules.map((rule) => [makeRuleKey(rule), rule]));
  const keys = new Set([
    ...adminByKey.keys(),
    ...franchiseByKey.keys(),
    ...merchantByKey.keys()
  ]);

  return [...keys]
    .map((key) => {
      const adminRule = adminByKey.get(key) || null;
      const franchiseRule = franchiseByKey.get(key) || null;
      const merchantRule = merchantByKey.get(key) || null;
      const effectiveRule = merchantRule || franchiseRule || adminRule;

      if (!effectiveRule) {
        return null;
      }

      const baseRule = merchantRule
        ? franchiseRule || adminRule || null
        : franchiseRule || adminRule || effectiveRule;

      return mapRuleToMerchantFormat(effectiveRule, {
        merchantId: resolvedMerchantId,
        franchiseId: resolvedFranchiseId,
        baseRule,
        adminRule,
        franchiseRule,
        isInherited: !merchantRule
      });
    })
    .filter(Boolean)
    .sort(sortMappedRates);
};

const buildAuthenticatedMerchantRules = (rules = []) => {
  const preferredRules = Array.from(
    buildPreferredRuleMap(rules, getMerchantRulePriority).values()
  );

  return preferredRules
    .map((rule) => ({
      id: rule.id,
      rule_id: rule.id,
      method: fromApiPaymentMode(rule.payment_mode),
      network: fromApiCardBrand(rule.card_brand),
      card_type: fromApiCardType(rule.card_type),
      card_classification: fromApiCardClassification(rule.card_classification),
      gst_rate: rule.gst_required ? toFiniteNumber(rule.gst_percent, 0) : null,
      rate_percentage: toFiniteNumber(rule.charge_percent, 0),
      min_amount: toFiniteNumber(rule.min_amount, 0),
      max_amount: toNullableNumber(rule.max_amount),
      charge_flat: toFiniteNumber(rule.charge_flat, 0) ?? 0,
      settlement_type: rule.settlement_type || null,
      scope: getRawRuleScope(rule) || null,
      rule_key: makeRuleKey(rule)
    }))
    .sort(sortMappedRates);
};

const buildFranchiseManagedDefaultRates = (adminRules, franchiseOwnedRules, franchiseId) => {
  const resolvedFranchiseId = toNullableNumber(franchiseId) ?? franchiseId ?? null;
  const adminByKey = buildPreferredRuleMap(adminRules, getAdminAudienceRulePriority);
  const franchiseDefaultByKey = new Map(
    franchiseOwnedRules
      .filter((rule) => getRuleUserId(rule) === null)
      .map((rule) => [makeRuleKey(rule), rule])
  );
  const keys = new Set([...adminByKey.keys(), ...franchiseDefaultByKey.keys()]);

  const rawResults = [...keys]
    .map((key) => {
      const adminRule = adminByKey.get(key) || null;
      const franchiseRule = franchiseDefaultByKey.get(key) || null;
      const effectiveRule = franchiseRule || adminRule;

      if (!effectiveRule) {
        return null;
      }

      const mappedRate = mapRuleToFranchiseFormat(effectiveRule, {
        franchiseId: resolvedFranchiseId,
        adminRule: adminRule || effectiveRule,
        baseRule: adminRule || null,
        isInherited: !franchiseRule
      });

      return enrichManagedFranchiseDefaultRate(mappedRate, {
        adminRule,
        franchiseRule
      });
    })
    .filter(Boolean);

  // Safety dedup: keep only the single nearest/highest-priority rule per core criteria (method|network|type|class|settlement|company)
  const coreMap = new Map();
  const getScopeRank = (r) => {
    const sc = String(r?.source_scope || r?.scope || '').toLowerCase();
    if (sc.includes('franchise_default') || !r?.isInherited) return 4;
    if (sc.includes('super_franchise')) return 3;
    if (sc.includes('admin')) return 2;
    return 1;
  };

  rawResults.forEach((r) => {
    const coreKey = [
      normalizeKeyToken(r.method || r.payment_mode),
      normalizeKeyToken(r.network || r.card_brand),
      normalizeKeyToken(r.card_type),
      normalizeKeyToken(r.card_classification),
      normalizeKeyToken(r.settlement_type),
      normalizeKeyToken(r.company_name),
    ].join('|');

    const existing = coreMap.get(coreKey);
    if (!existing || getScopeRank(r) >= getScopeRank(existing)) {
      coreMap.set(coreKey, r);
    }
  });

  return [...coreMap.values()].sort(sortMappedRates);
};

const buildFranchiseManagedMerchantRates = (
  adminRules,
  franchiseOwnedRules,
  merchantId,
  franchiseId = null
) => {
  const resolvedMerchantId = toNullableNumber(merchantId) ?? merchantId ?? null;
  const resolvedFranchiseId = toNullableNumber(franchiseId) ?? franchiseId ?? null;
  const adminByKey = buildPreferredRuleMap(adminRules, getAdminAudienceRulePriority);
  const franchiseDefaultByKey = new Map(
    franchiseOwnedRules
      .filter((rule) => getRuleUserId(rule) === null)
      .map((rule) => [makeRuleKey(rule), rule])
  );
  const merchantByKey = new Map(
    franchiseOwnedRules
      .filter((rule) => Number(getRuleUserId(rule)) === Number(resolvedMerchantId))
      .map((rule) => [makeRuleKey(rule), rule])
  );
  const keys = new Set([
    ...adminByKey.keys(),
    ...franchiseDefaultByKey.keys(),
    ...merchantByKey.keys()
  ]);

  return [...keys]
    .map((key) => {
      const adminRule = adminByKey.get(key) || null;
      const franchiseRule = franchiseDefaultByKey.get(key) || null;
      const merchantRule = merchantByKey.get(key) || null;
      const effectiveRule = merchantRule || franchiseRule || adminRule;

      if (!effectiveRule) {
        return null;
      }

      const baseRule = merchantRule
        ? franchiseRule || adminRule || null
        : franchiseRule || adminRule || effectiveRule;
      const baseFlatRate = baseRule ? toFiniteNumber(baseRule.charge_flat, 0) : 0;
      const adminFlatRate = adminRule ? toFiniteNumber(adminRule.charge_flat, 0) : baseFlatRate;

      const mappedRate = mapRuleToMerchantFormat(effectiveRule, {
        merchantId: resolvedMerchantId,
        franchiseId: resolvedFranchiseId,
        adminRule: adminRule || null,
        franchiseRule: franchiseRule || null,
        baseRule,
        isInherited: !merchantRule
      });

      return {
        ...mappedRate,
        base_flat_rate: baseFlatRate,
        admin_flat_rate: adminFlatRate,
        source_scope: merchantRule ? 'merchant' : franchiseRule ? 'franchise' : 'admin',
        base_source_scope: merchantRule
          ? franchiseRule
            ? 'franchise'
            : adminRule
              ? 'admin'
              : null
          : franchiseRule
            ? 'franchise'
            : adminRule
              ? 'admin'
              : null
      };
    })
    .filter(Boolean)
    .sort(sortMappedRates);
};

const createScopedRuleOverride = async (
  userId,
  rateObject,
  updates,
  mapper,
  entityKey,
  extraScope = {},
  resultTransformer = null
) => {
  const omitFranchiseId = Boolean(extraScope?.omitFranchiseId);
  const sourceRule = omitFranchiseId
    ? stripRuleFranchiseId(rateObject?.original_rule || rateObject?.base_rule)
    : rateObject?.original_rule || rateObject?.base_rule;
  const payloadOverrides = {
    ...updates,
    user_id: Number(userId),
    ...extraScope,
    ...(extraScope && 'user_id' in extraScope ? { user_id: extraScope.user_id } : {}),
    is_active: true
  };

  delete payloadOverrides.franchiseIdHint;
  delete payloadOverrides.omitFranchiseId;

  if (omitFranchiseId) {
    delete payloadOverrides.franchaise_id;
  }

  const payload = normalizeRulePayload(sourceRule, payloadOverrides);

  logRateInfo('rules:create-override:request', {
    userId,
    entityKey,
    extraScope,
    sourceRuleId: sourceRule?.id,
    sourceRule: summarizeRuleForLog(sourceRule),
    sourceRate: summarizeRuleForLog(rateObject),
    updates,
    payload
  });
  logRateInfo('rules:create-override:charge', {
    charge: payload.charge_percent,
    inputCharge: updates?.charge_percent ?? updates?.chargePercent ?? null
  });

  const response = await axios.post(POS_CHARGE_RULES_BASE, payload, getAuthHeaders());
  const record = extractRuleRecord(response.data);
  const resolvedFranchiseId =
    getRuleFranchiseId(record) ??
    extraScope?.franchiseIdHint ??
    extraScope?.franchaise_id ??
    rateObject?.franchaise_id ??
    rateObject?.franchiseId ??
    null;
  const adminRule = rateObject?.admin_rate !== null && rateObject?.admin_rate !== undefined
    ? { charge_percent: rateObject.admin_rate, user_id: null, franchaise_id: null }
    : null;
  const franchiseRule = rateObject?.franchise_rate !== null && rateObject?.franchise_rate !== undefined
    ? { charge_percent: rateObject.franchise_rate, user_id: null, franchaise_id: resolvedFranchiseId }
    : rateObject?.source_scope === 'franchise'
      ? rateObject?.original_rule || null
      : rateObject?.base_source_scope === 'franchise'
        ? rateObject?.base_rule || null
        : null;
  const baseRule = rateObject?.base_rule || (
    rateObject?.base_rate !== null && rateObject?.base_rate !== undefined
      ? {
        charge_percent: rateObject.base_rate,
        user_id: null,
        franchaise_id: rateObject?.base_source_scope === 'franchise' ? resolvedFranchiseId : null
      }
      : null
  );

  logRateInfo('rules:create-override:success', {
    userId,
    entityKey,
    ruleId: record?.id,
    responseData: response?.data ?? null,
    record: summarizeRuleForLog(record),
    sourceRate: summarizeRuleForLog(rateObject)
  });

  const mappedRate = mapper(record, {
    [entityKey]: Number(userId),
    franchiseId: resolvedFranchiseId,
    adminRule,
    franchiseRule,
    baseRule,
    isInherited: false
  });

  return typeof resultTransformer === 'function'
    ? resultTransformer(mappedRate, { record, adminRule, franchiseRule, baseRule, resolvedFranchiseId })
    : mappedRate;
};

export const getSuperFranchises = async () => {
  try {
    let list = [];
    try {
      const res = await SuperFranchiseAllUsers({ limit: 1000 });
      list = extractArrayPayload(res);
    } catch {
      // ignore
    }

    if (!Array.isArray(list) || list.length === 0) {
      try {
        const fallbackRes = await AllUsers({ role: 'super_franchise', limit: 1000 });
        list = extractArrayPayload(fallbackRes);
      } catch {
        // ignore
      }
    }

    return Array.isArray(list) ? list : [];
  } catch (error) {
    console.error('Error fetching super franchises:', error);
    return [];
  }
};

export const getFranchises = async () => {
  try {
    let list = [];
    try {
      const res = await FranchiseAllUsers({ limit: 1000 });
      list = extractArrayPayload(res);
    } catch {
      // ignore
    }

    if (!Array.isArray(list) || list.length === 0) {
      try {
        const fallbackRes = await AllUsers({ role: 'franchise', limit: 1000 });
        list = extractArrayPayload(fallbackRes);
      } catch {
        // ignore
      }
    }

    if (!Array.isArray(list) || list.length === 0) {
      try {
        const fallbackRes2 = await AllUsers({ role: 'franchaise', limit: 1000 });
        list = extractArrayPayload(fallbackRes2);
      } catch {
        // ignore
      }
    }

    return Array.isArray(list) ? list : [];
  } catch (error) {
    console.error('Error fetching franchises:', error);
    return [];
  }
};

export const getMerchants = async (franchiseId) => {
  try {
    const baseParams = {
      ...(franchiseId ? { franchiseId } : {}),
      page: 1,
      limit: 1000
    };
    const firstResponse = await MerchantAllUsers(baseParams);
    const extractMerchantRows = (payload) => {
      if (Array.isArray(payload)) return payload;
      if (Array.isArray(payload?.data)) return payload.data;
      if (Array.isArray(payload?.rows)) return payload.rows;
      if (Array.isArray(payload?.items)) return payload.items;
      return [];
    };
    const extractTotalPages = (payload) => {
      const pagination = payload?.pagination || payload?.data?.pagination || {};
      const totalPages = Number(
        pagination.totalPages ||
        pagination.total_pages ||
        pagination.pages ||
        pagination.last_page ||
        payload?.totalPages ||
        payload?.total_pages
      );

      return Number.isFinite(totalPages) && totalPages > 0 ? totalPages : 1;
    };

    const merchantPages = [extractMerchantRows(firstResponse)];
    const totalPages = extractTotalPages(firstResponse);

    if (totalPages > 1) {
      const remainingResponses = await Promise.all(
        Array.from({ length: totalPages - 1 }, (_, index) =>
          MerchantAllUsers({
            ...baseParams,
            page: index + 2
          })
        )
      );

      remainingResponses.forEach((response) => {
        merchantPages.push(extractMerchantRows(response));
      });
    }

    let merchants = merchantPages.flat();
    merchants = Array.from(
      new Map(
        merchants.map((merchant, index) => [
          getEntityUserId(merchant) ?? `merchant-${index}`,
          merchant
        ])
      ).values()
    );

    if (franchiseId) {
      merchants = merchants.filter((merchant) => getEntityFranchiseId(merchant) === Number(franchiseId));
    }

    if (!Array.isArray(merchants) || merchants.length === 0) {
      try {
        const fallbackRes = await AllUsers({ role: 'merchant', limit: 1000, ...(franchiseId ? { franchise_id: franchiseId } : {}) });
        const fallbackList = extractArrayPayload(fallbackRes);
        if (Array.isArray(fallbackList) && fallbackList.length > 0) {
          merchants = fallbackList;
        }
      } catch {
        // ignore
      }
    }

    return merchants;
  } catch (error) {
    console.error('Error fetching merchants:', error);
    return [];
  }
};

export const getUnassignedMerchants = async () => {
  try {
    const limit = 100;
    const firstResponse = await axios.get(`${BASE_URL}/admin/merchants/unassigned`, {
      ...getAuthHeaders(),
      params: { page: 1, limit }
    });

    const payload = firstResponse?.data;

    const extractMerchants = (data) => {
      return (
        data?.data?.merchants ||
        data?.merchants ||
        data?.data ||
        data ||
        []
      );
    };

    const extractTotalPages = (data) => {
      const pagination = data?.data || data || {};
      const totalPages = Number(
        pagination.totalPages ||
        pagination.total_pages ||
        pagination.pages ||
        pagination.last_page
      );
      return Number.isFinite(totalPages) && totalPages > 0 ? totalPages : 1;
    };

    const merchantPages = [extractMerchants(payload)];
    const totalPages = extractTotalPages(payload);

    if (totalPages > 1) {
      const remainingResponses = await Promise.all(
        Array.from({ length: totalPages - 1 }, (_, index) =>
          axios.get(`${BASE_URL}/admin/merchants/unassigned`, {
            ...getAuthHeaders(),
            params: { page: index + 2, limit }
          })
        )
      );

      remainingResponses.forEach((response) => {
        merchantPages.push(extractMerchants(response?.data));
      });
    }

    const merchants = merchantPages.flat();
    return Array.isArray(merchants) ? merchants : [];
  } catch (error) {
    console.error('Error fetching unassigned merchants:', error);
    return [];
  }
};

export const fetchBaseDefaultRules = async () => {
  try {
    const applicableRes = await fetchMyAdminApplicableCharges();
    const posRules = applicableRes?.data?.pos || [];
    if (posRules.length > 0) {
      return posRules.map((r) => ({
        ...r,
        charge_percent: r.charge_percent,
        charge_flat: r.charge_flat,
        scope: r.is_override ? 'super_admin_admin' : 'super_admin_default',
      }));
    }
  } catch (err) {
    logRateWarn('Failed to fetch admin applicable charges for base defaults', err);
  }

  const superAdminDefaults = await fetchRulesByScopes([RULE_SCOPES.SUPER_ADMIN_DEFAULT]);
  if (superAdminDefaults.length > 0) {
    return superAdminDefaults;
  }
  return await fetchRulesByScopes([RULE_SCOPES.ADMIN_DEFAULT]);
};

export const getSuperFranchiseRates = async (superFranchiseId, options = {}) => {
  try {
    const includeInherited = options?.includeInherited !== false;
    const defaultRules = await fetchBaseDefaultRules();

    if (!superFranchiseId || superFranchiseId === 'default') {
      const defaults = defaultRules
        .map((rule) =>
          mapRuleToSuperFranchiseFormat(rule, {
            adminRule: rule,
            isInherited: false
          })
        )
        .sort(sortMappedRates);

      return defaults;
    }

    const sfRules = await fetchRulesByScopes(
      [RULE_SCOPES.ADMIN_SUPER_FRANCHISE],
      { super_franchise_id: superFranchiseId }
    );
    const effectiveRules = includeInherited
      ? buildSuperFranchiseEffectiveRules(defaultRules, sfRules, superFranchiseId)
      : sfRules
        .map((rule) =>
          mapRuleToSuperFranchiseFormat(rule, {
            superFranchiseId: Number(superFranchiseId),
            adminRule: null,
            baseRule: null,
            isInherited: false
          })
        )
        .sort(sortMappedRates);

    return effectiveRules;
  } catch (error) {
    console.error('Error fetching super franchise rates:', error);
    return [];
  }
};

export const updateSuperFranchiseRate = async (superFranchiseId, rateObject, updates, options = {}) => {
  try {
    if (!superFranchiseId || superFranchiseId === 'default') {
      const payload = buildUpdatePayload(
        {
          ...updates,
          user_id: null,
          super_franchise_id: null,
          franchaise_id: null
        },
        rateObject?.original_rule
      );
      const ruleId = rateObject?.rule_id || rateObject?.id;
      const response = await axios.put(`${POS_CHARGE_RULES_BASE}/${ruleId}`, payload, getAuthHeaders());
      const record = resolveUpdatedRuleRecord({
        responseData: response.data,
        currentRule: rateObject?.original_rule,
        payload,
        ruleId,
        logEvent: 'super-franchise-rates:update-global',
        context: { superFranchiseId }
      });

      return mapRuleToSuperFranchiseFormat(record, {
        adminRule: record,
        isInherited: false
      });
    }

    if (rateObject.isInherited) {
      return createScopedRuleOverride(
        superFranchiseId,
        rateObject,
        updates,
        mapRuleToSuperFranchiseFormat,
        'superFranchiseId',
        {
          user_id: null,
          super_franchise_id: Number(superFranchiseId),
          franchaise_id: null
        }
      );
    }

    const currentRule = rateObject?.original_rule;
    const payload = buildUpdatePayload(
      {
        ...updates,
        user_id: null,
        super_franchise_id: Number(superFranchiseId),
        franchaise_id: null
      },
      currentRule
    );
    const ruleId = currentRule?.id || rateObject?.rule_id || rateObject?.id;
    const response = await axios.put(`${POS_CHARGE_RULES_BASE}/${ruleId}`, payload, getAuthHeaders());
    const record = resolveUpdatedRuleRecord({
      responseData: response.data,
      currentRule,
      payload,
      ruleId,
      logEvent: 'super-franchise-rates:update-specific',
      context: { superFranchiseId }
    });

    return mapRuleToSuperFranchiseFormat(record, {
      superFranchiseId: Number(superFranchiseId),
      adminRule: rateObject?.base_rule || null,
      baseRule: rateObject?.base_rule || null,
      isInherited: false
    });
  } catch (error) {
    console.error('Error updating super franchise rate:', error);
    throw error;
  }
};

export const getAllSuperFranchiseRates = async (superFranchises) => {
  try {
    const allRates = {};
    const [defaultRules, adminSfRules] = await Promise.all([
      fetchBaseDefaultRules(),
      fetchRulesByScopes([RULE_SCOPES.ADMIN_SUPER_FRANCHISE])
    ]);

    for (const sf of superFranchises) {
      const scopedRules = adminSfRules.filter(
        (rule) => Number(getRuleSuperFranchiseId(rule)) === Number(sf.id)
      );
      allRates[sf.id] = buildSuperFranchiseEffectiveRules(defaultRules, scopedRules, sf.id);
    }
    return allRates;
  } catch (error) {
    console.error('Error loading super franchise matrix rates:', error);
    return {};
  }
};

export const getFranchiseRates = async (franchiseId, options = {}) => {
  try {
    logRateInfo('franchise-rates:load:start', { franchiseId });
    const includeInherited = options?.includeInherited !== false;
    const defaultRules = await fetchBaseDefaultRules();

    if (!franchiseId || franchiseId === 'default') {
      try {
        const applicableRes = await fetchMyAdminApplicableCharges();
        const posRules = applicableRes?.data?.pos || [];
        if (posRules.length > 0) {
          const defaults = posRules
            .map((r) => {
              const scopeName = r.is_override ? 'super_admin_admin' : 'super_admin_default';
              const mapped = mapRuleToAdminFormat({
                ...r,
                scope: scopeName
              }, {
                isInherited: !r.is_override,
              });
              mapped.scope = scopeName;
              mapped.source_scope = scopeName;
              mapped.isInherited = !r.is_override;
              return mapped;
            })
            .sort(sortMappedRates);

          if (options.paginate) {
            return {
              rates: defaults,
              pagination: {
                total: defaults.length,
                page: options.page ?? 1,
                limit: options.limit ?? 100,
                totalPages: 1
              }
            };
          }
          return defaults;
        }
      } catch (err) {
        logRateWarn('Failed to fetch admin applicable charges, falling back to scope rules', err);
      }

      if (options.paginate) {
        const { rules, pagination } = await fetchChargeRules(
          {
            scope: options.scope || [RULE_SCOPES.ADMIN_DEFAULT, RULE_SCOPES.SUPER_ADMIN_DEFAULT],
            page: options.page ?? 1,
            limit: options.limit ?? 100
          },
          { includePagination: true }
        );

        const defaults = rules
          .map((rule) =>
            mapRuleToFranchiseFormat(rule, {
              adminRule: rule,
              isInherited: false
            })
          )
          .sort(sortMappedRates);

        logRateInfo('franchise-rates:load:success', {
          franchiseId,
          count: defaults.length,
          scope: 'admin',
          pagination
        });

        return { rates: defaults, pagination };
      }

      const defaults = defaultRules
        .map((rule) =>
          mapRuleToFranchiseFormat(rule, {
            adminRule: rule,
            isInherited: false
          })
        )
        .sort(sortMappedRates);

      logRateInfo('franchise-rates:load:success', {
        franchiseId,
        count: defaults.length,
        scope: 'admin'
      });

      return defaults;
    }

    const franchiseRules = await fetchRulesByScopes(
      [RULE_SCOPES.ADMIN_FRANCHISE],
      { franchaise_id: franchiseId }
    );
    const effectiveRules = includeInherited
      ? buildFranchiseEffectiveRules(defaultRules, franchiseRules, franchiseId)
      : franchiseRules
        .map((rule) =>
          mapRuleToFranchiseFormat(rule, {
            franchiseId: Number(franchiseId),
            adminRule: null,
            baseRule: null,
            isInherited: false
          })
        )
        .sort(sortMappedRates);

    logRateInfo('franchise-rates:load:success', {
      franchiseId,
      count: effectiveRules.length,
      overrides: franchiseRules.length,
      includeInherited
    });

    return effectiveRules;
  } catch (error) {
    logRateError('franchise-rates:load:error', error, { franchiseId });
    return [];
  }
};

export const getFranchiseManagedDefaultRates = async (franchiseId) => {
  try {
    const params = franchiseId ? { franchaise_id: franchiseId } : {};
    let [adminRules, franchiseOwnedRules] = await Promise.all([
      fetchChargeRulesByAudience('admin', params),
      fetchChargeRulesByAudience('franchise', params)
    ]);

    try {
      const applicableRes = await fetchMyAdminApplicableCharges();
      const posRules = applicableRes?.data?.pos || [];
      if (posRules.length > 0) {
        const mappedApplicable = posRules.map((r, idx) => ({
          id: r.id || `inherited-pos-${idx}`,
          rule_id: r.id || null,
          payment_mode: r.payment_mode || r.method || 'CARD',
          card_brand: r.card_brand || r.network || 'ALL',
          card_type: r.card_type || 'ANY',
          card_classification: r.card_classification || 'ANY',
          settlement_type: r.settlement_type || null,
          company_name: r.company_name || null,
          min_amount: toFiniteNumber(r.min_amount ?? r.from_amount, 0),
          max_amount: toNullableNumber(r.max_amount ?? r.to_amount),
          charge_percent: toFiniteNumber(r.charge_percent ?? r.base_rate ?? r.rate, 0),
          charge_flat: toFiniteNumber(r.charge_flat ?? r.flat_fee, 0),
          gst_required: Boolean(r.gst_required),
          gst_percent: toFiniteNumber(r.gst_percent ?? r.gst_rate, 18),
          scope: r.source_label?.toLowerCase()?.includes('super') ? 'super_franchise_default' : 'admin_default',
          source_scope: r.source_label?.toLowerCase()?.includes('super') ? 'super_franchise' : 'admin',
          is_active: r.is_active !== false,
        }));
        adminRules = [...adminRules, ...mappedApplicable];
      }
    } catch (e) {
      logRateWarn('Failed to fetch applicable charges for franchise base defaults', e);
    }

    return buildFranchiseManagedDefaultRates(
      adminRules.filter(isUplineRule),
      franchiseOwnedRules.filter((rule) => isFranchiseDefaultRule(rule) || isFranchiseMerchantRule(rule)),
      franchiseId
    );
  } catch (error) {
    logRateError('franchise-managed-rates:load:error', error, { franchiseId });
    return [];
  }
};

export const updateFranchiseRate = async (franchiseId, rateObject, updates, options = {}) => {
  try {
    const omitFranchiseId = Boolean(options?.omitFranchiseId);
    logRateInfo('franchise-rates:update:resolve-scope', {
      franchiseId,
      branch: !franchiseId || franchiseId === 'default'
        ? 'global'
        : rateObject?.isInherited
          ? 'create-override'
          : 'update-specific',
      updates,
      sourceRate: summarizeRuleForLog(rateObject),
      sourceRule: summarizeRuleForLog(rateObject?.original_rule),
      baseRule: summarizeRuleForLog(rateObject?.base_rule)
    });

    if (!franchiseId || franchiseId === 'default') {
      const payload = buildUpdatePayload(
        {
          ...updates,
          user_id: null,
          franchaise_id: null
        },
        rateObject?.original_rule
      );
      const ruleId = rateObject?.rule_id || rateObject?.id;

      logRateInfo('franchise-rates:update-global:request', {
        ruleId,
        requestMethod: 'PUT',
        requestUrl: `${POS_CHARGE_RULES_BASE}/${ruleId}`,
        payload
      });
      logRateInfo('franchise-rates:update-global:charge', {
        charge: payload.charge_percent,
        inputCharge: updates?.charge_percent ?? updates?.chargePercent ?? null
      });

      const response = await axios.put(`${POS_CHARGE_RULES_BASE}/${ruleId}`, payload, getAuthHeaders());
      const record = resolveUpdatedRuleRecord({
        responseData: response.data,
        currentRule: rateObject?.original_rule,
        payload,
        ruleId,
        logEvent: 'franchise-rates:update-global',
        context: {
          franchiseId,
          sourceRate: summarizeRuleForLog(rateObject)
        }
      });

      logRateInfo('franchise-rates:update-global:success', {
        ruleId: record?.id,
        requestPayload: payload,
        responseData: response?.data ?? null,
        record: summarizeRuleForLog(record)
      });

      return mapRuleToFranchiseFormat(record, {
        adminRule: record,
        isInherited: false
      });
    }

    if (rateObject.isInherited) {
      return createScopedRuleOverride(
        franchiseId,
        rateObject,
        updates,
        mapRuleToFranchiseFormat,
        'franchiseId',
        omitFranchiseId
          ? {
            user_id: null,
            franchiseIdHint: Number(franchiseId),
            omitFranchiseId: true
          }
          : {
            user_id: null,
            franchaise_id: Number(franchiseId)
          },
        (mappedRate, { record, adminRule }) =>
          enrichManagedFranchiseDefaultRate(mappedRate, {
            adminRule: adminRule || rateObject?.base_rule || null,
            franchiseRule: record
          })
      );
    }

    const currentRule = omitFranchiseId
      ? stripRuleFranchiseId(rateObject?.original_rule)
      : rateObject?.original_rule;
    const payload = buildUpdatePayload(
      {
        ...updates,
        user_id: null,
        ...(omitFranchiseId ? {} : { franchaise_id: Number(franchiseId) })
      },
      currentRule
    );
    const ruleId = rateObject?.rule_id || rateObject?.id;

    logRateInfo('franchise-rates:update-specific:request', {
      franchiseId,
      ruleId,
      requestMethod: 'PUT',
      requestUrl: `${POS_CHARGE_RULES_BASE}/${ruleId}`,
      payload
    });
    logRateInfo('franchise-rates:update-specific:charge', {
      charge: payload.charge_percent,
      inputCharge: updates?.charge_percent ?? updates?.chargePercent ?? null
    });

    const response = await axios.put(`${POS_CHARGE_RULES_BASE}/${ruleId}`, payload, getAuthHeaders());
    const record = resolveUpdatedRuleRecord({
      responseData: response.data,
      currentRule: rateObject?.original_rule,
      payload,
      ruleId,
      logEvent: 'franchise-rates:update-specific',
      context: {
        franchiseId,
        sourceRate: summarizeRuleForLog(rateObject)
      }
    });

    logRateInfo('franchise-rates:update-specific:success', {
      franchiseId,
      ruleId: record?.id,
      requestPayload: payload,
      responseData: response?.data ?? null,
      record: summarizeRuleForLog(record),
      sourceRate: summarizeRuleForLog(rateObject)
    });

    return enrichManagedFranchiseDefaultRate(
      mapRuleToFranchiseFormat(record, {
        franchiseId: Number(franchiseId),
        adminRule: rateObject?.base_rule || null,
        baseRule: rateObject?.base_rule || null,
        isInherited: false
      }),
      {
        adminRule: rateObject?.base_rule || null,
        franchiseRule: record
      }
    );
  } catch (error) {
    logRateError('franchise-rates:update:error', error, {
      franchiseId,
      rateId: rateObject?.id
    });
    throw error;
  }
};

export const updateFranchiseManagedDefaultRate = async (franchiseId, rateObject, updates) =>
  updateFranchiseRate(franchiseId, rateObject, updates, { omitFranchiseId: true });

export const createPOSChargeRule = async (ruleData) => {
  try {
    const payload = normalizeRulePayload(ruleData, {
      user_id: ruleData.user_id !== undefined ? ruleData.user_id : null,
      franchaise_id: ruleData.franchaise_id !== undefined ? ruleData.franchaise_id : null,
      super_franchise_id: ruleData.super_franchise_id !== undefined ? ruleData.super_franchise_id : null,
      is_active: typeof ruleData.is_active === 'boolean' ? ruleData.is_active : true
    });

    logRateInfo('pos-rates:create-rule:request', payload);

    const response = await axios.post(POS_CHARGE_RULES_BASE, payload, getAuthHeaders());
    const record = extractRuleRecord(response.data);

    logRateInfo('pos-rates:create-rule:success', {
      ruleId: record?.id
    });

    return record || response.data;
  } catch (error) {
    logRateError('pos-rates:create-rule:error', error, { ruleData });
    throw error;
  }
};

export const createDefaultFranchiseRate = async (rateData) => {
  try {
    const payload = normalizeRulePayload(rateData, {
      user_id: null,
      franchaise_id: null,
      is_active: true
    });

    logRateInfo('franchise-rates:create-default:request', payload);

    const response = await axios.post(POS_CHARGE_RULES_BASE, payload, getAuthHeaders());
    const record = extractRuleRecord(response.data);

    logRateInfo('franchise-rates:create-default:success', {
      ruleId: record?.id
    });

    return mapRuleToFranchiseFormat(record, {
      adminRule: record,
      isInherited: false
    });
  } catch (error) {
    logRateError('franchise-rates:create-default:error', error, { rateData });
    throw error;
  }
};

export const deleteDefaultPOSRate = async (id) => {
  try {
    logRateInfo('rates:delete:request', { ruleId: id });
    const response = await axios.delete(`${POS_CHARGE_RULES_BASE}/${id}`, getAuthHeaders());
    logRateInfo('rates:delete:success', { ruleId: id });
    return response.data;
  } catch (error) {
    logRateError('rates:delete:error', error, { ruleId: id });
    throw error;
  }
};

export const deleteUserPOSRate = async (id) => {
  return deleteDefaultPOSRate(id);
};

export const getAllFranchiseRates = async (franchises) => {
  try {
    const allRates = {};
    const [defaultRules, adminFranchiseRules] = await Promise.all([
      fetchBaseDefaultRules(),
      fetchRulesByScopes([RULE_SCOPES.ADMIN_FRANCHISE])
    ]);

    for (const franchise of franchises) {
      const scopedRules = adminFranchiseRules.filter(
        (rule) => Number(getRuleFranchiseId(rule)) === Number(franchise.id)
      );
      allRates[franchise.id] = buildFranchiseEffectiveRules(defaultRules, scopedRules, franchise.id);
    }

    logRateInfo('franchise-rates:matrix:success', {
      franchiseCount: franchises.length,
      adminRuleCount: defaultRules.length + adminFranchiseRules.length
    });

    return allRates;
  } catch (error) {
    logRateError('franchise-rates:matrix:error', error, {
      franchiseCount: franchises?.length || 0
    });
    return {};
  }
};

export const getMerchantRates = async (merchantId, scope = {}) => {
  try {
    const franchiseId = getEntityFranchiseId(scope, null);
    logRateInfo('merchant-rates:load:start', { merchantId, franchiseId });

    if (!merchantId || merchantId === 'default') {
      if (franchiseId === null) {
        const defaultRules = await fetchBaseDefaultRules();
        const defaults = defaultRules
          .map((rule) =>
            mapRuleToMerchantFormat(rule, {
              adminRule: rule,
              baseRule: rule,
              franchiseId: null,
              isInherited: true
            })
          )
          .sort(sortMappedRates);

        logRateInfo('merchant-rates:load:success', {
          merchantId,
          count: defaults.length,
          franchiseId,
          scope: 'admin'
        });

        return defaults;
      }

      const [adminRules, franchiseRules] = await Promise.all([
        fetchRulesByScopes([RULE_SCOPES.SUPER_ADMIN_DEFAULT, RULE_SCOPES.ADMIN_FRANCHISE], { franchaise_id: franchiseId }),
        fetchRulesByScopes([RULE_SCOPES.FRANCHISE_DEFAULT], { franchaise_id: franchiseId })
      ]);
      const defaults = buildMerchantEffectiveRules(adminRules, franchiseRules, [], 'default', franchiseId);

      logRateInfo('merchant-rates:load:success', {
        merchantId,
        count: defaults.length,
        franchiseId,
        scope: franchiseId === null ? 'admin' : 'franchise'
      });

      return defaults;
    }

    const adminRules = franchiseId === null
      ? await fetchBaseDefaultRules()
      : await fetchRulesByScopes(
        [RULE_SCOPES.SUPER_ADMIN_DEFAULT, RULE_SCOPES.ADMIN_FRANCHISE],
        { franchaise_id: franchiseId }
      );
    const franchiseRules = franchiseId === null
      ? []
      : await fetchRulesByScopes([RULE_SCOPES.FRANCHISE_DEFAULT], { franchaise_id: franchiseId });
    const merchantRules = franchiseId === null
      ? await fetchRulesByScopes([RULE_SCOPES.ADMIN_MERCHANT], { user_id: merchantId })
      : await fetchRulesByScopes(
        [RULE_SCOPES.FRANCHISE_MERCHANT],
        { user_id: merchantId, franchaise_id: franchiseId }
      );
    const effectiveRules = buildMerchantEffectiveRules(
      adminRules,
      franchiseRules,
      merchantRules,
      merchantId,
      franchiseId
    );

    logRateInfo('merchant-rates:load:success', {
      merchantId,
      franchiseId,
      count: effectiveRules.length,
      overrides: merchantRules.length
    });

    return effectiveRules;
  } catch (error) {
    logRateError('merchant-rates:load:error', error, {
      merchantId,
      franchiseId: getEntityFranchiseId(scope, null)
    });
    return [];
  }
};

export const getAuthenticatedMerchantChargeRules = async () => {
  try {
    // Primary source: /service-charge/my-applicable-charges walks the full
    // hierarchy (admin → super franchise → franchise → merchant) and returns
    // the single nearest override per criteria. This handles scopes like
    // admin_super_franchise that the old /list/merchant endpoint missed.
    let posRules = [];
    try {
      const applicableRes = await fetchMyAdminApplicableCharges();
      posRules = applicableRes?.data?.pos || [];
    } catch (err) {
      console.warn('[rate-settings] merchant-self-rates: applicable-charges fallback to list/merchant', err);
    }

    if (posRules.length > 0) {
      // data.pos already uses DB field names (payment_mode, charge_percent, …)
      // which buildAuthenticatedMerchantRules expects.
      return buildAuthenticatedMerchantRules(posRules);
    }

    // Fallback: old list/merchant endpoint (covers franchise_merchant etc.)
    const rules = await fetchChargeRulesByAudience('merchant');
    return buildAuthenticatedMerchantRules(rules);
  } catch (error) {
    logRateError('merchant-self-rates:load:error', error);
    throw new Error(error?.response?.data?.message || 'Failed to fetch merchant charge rules');
  }
};

export const getFranchiseAdminChargeRules = async (franchiseId = null, params = {}) => {
  try {
    const query = {
      ...params
    };

    if (franchiseId) {
      query.franchaise_id = franchiseId;
    }

    const rules = await fetchChargeRulesByAudience('admin', query);
    return rules;
  } catch (error) {
    logRateError('franchise-admin-rules:load:error', error, { franchiseId });
    throw new Error(error?.response?.data?.message || 'Failed to fetch admin POS charge rules');
  }
};

export const getFranchiseManagedMerchantRates = async (merchantId, franchiseId) => {
  try {
    const params = franchiseId ? { franchaise_id: franchiseId } : {};
    const [adminRules, franchiseOwnedRules] = await Promise.all([
      fetchChargeRulesByAudience('admin', params),
      fetchChargeRulesByAudience('franchise', params)
    ]);

    return buildFranchiseManagedMerchantRates(
      adminRules.filter(isUplineRule),
      franchiseOwnedRules.filter((rule) => isFranchiseDefaultRule(rule) || isFranchiseMerchantRule(rule)),
      merchantId,
      franchiseId
    );
  } catch (error) {
    logRateError('franchise-managed-merchant-rates:load:error', error, {
      merchantId,
      franchiseId
    });
    return [];
  }
};

export const updateMerchantRate = async (merchantId, rateObject, updates, scope = {}) => {
  try {
    const franchiseId = getEntityFranchiseId(scope, rateObject?.franchaise_id ?? rateObject?.franchiseId ?? null);
    const omitFranchiseId = Boolean(scope?.omitFranchiseId);
    const adminRule = rateObject?.admin_rate !== null && rateObject?.admin_rate !== undefined
      ? { charge_percent: rateObject.admin_rate, user_id: null, franchaise_id: null }
      : null;
    const franchiseRule = rateObject?.franchise_rate !== null && rateObject?.franchise_rate !== undefined
      ? { charge_percent: rateObject.franchise_rate, user_id: null, franchaise_id: franchiseId }
      : rateObject?.source_scope === 'franchise'
        ? rateObject?.original_rule || null
        : rateObject?.base_source_scope === 'franchise'
          ? rateObject?.base_rule || null
          : null;

    logRateInfo('merchant-rates:update:resolve-scope', {
      merchantId,
      franchiseId,
      branch: !merchantId || merchantId === 'default'
        ? 'default'
        : rateObject?.isInherited
          ? 'create-override'
          : 'update-specific',
      updates,
      sourceRate: summarizeRuleForLog(rateObject),
      sourceRule: summarizeRuleForLog(rateObject?.original_rule),
      baseRule: summarizeRuleForLog(rateObject?.base_rule),
      adminRule: summarizeRuleForLog(adminRule),
      franchiseRule: summarizeRuleForLog(franchiseRule)
    });

    if (!merchantId || merchantId === 'default') {
      const currentRule = omitFranchiseId
        ? stripRuleFranchiseId(rateObject?.original_rule)
        : rateObject?.original_rule;
      const payload = buildUpdatePayload(
        {
          ...updates,
          user_id: null,
          ...(!omitFranchiseId ? { franchaise_id: franchiseId } : {})
        },
        currentRule
      );
      const ruleId = rateObject?.rule_id || rateObject?.id;

      logRateInfo('merchant-rates:update-default:request', {
        ruleId,
        franchiseId,
        payload
      });
      logRateInfo('merchant-rates:update-default:charge', {
        charge: payload.charge_percent,
        inputCharge: updates?.charge_percent ?? updates?.chargePercent ?? null
      });

      const response = await axios.put(`${POS_CHARGE_RULES_BASE}/${ruleId}`, payload, getAuthHeaders());
      const record = resolveUpdatedRuleRecord({
        responseData: response.data,
        currentRule: rateObject?.original_rule,
        payload,
        ruleId,
        logEvent: 'merchant-rates:update-default',
        context: {
          merchantId,
          franchiseId,
          sourceRate: summarizeRuleForLog(rateObject)
        }
      });

      logRateInfo('merchant-rates:update-default:success', {
        ruleId: record?.id,
        requestPayload: payload,
        responseData: response?.data ?? null,
        record: summarizeRuleForLog(record),
        sourceRate: summarizeRuleForLog(rateObject)
      });

      return mapRuleToMerchantFormat(record, {
        franchiseId,
        adminRule,
        franchiseRule: record,
        baseRule: record,
        isInherited: false
      });
    }

    if (rateObject.isInherited) {
      return createScopedRuleOverride(
        merchantId,
        rateObject,
        updates,
        mapRuleToMerchantFormat,
        'merchantId',
        omitFranchiseId
          ? {
            franchiseIdHint: franchiseId,
            omitFranchiseId: true
          }
          : {
            franchaise_id: franchiseId
          }
      );
    }

    const currentRule = omitFranchiseId
      ? stripRuleFranchiseId(rateObject?.original_rule)
      : rateObject?.original_rule;
    const payload = buildUpdatePayload(
      {
        ...updates,
        ...(!omitFranchiseId ? { franchaise_id: franchiseId } : {})
      },
      currentRule
    );
    const ruleId = rateObject?.rule_id || rateObject?.id;

    logRateInfo('merchant-rates:update-specific:request', {
      merchantId,
      franchiseId,
      ruleId,
      requestMethod: 'PUT',
      requestUrl: `${POS_CHARGE_RULES_BASE}/${ruleId}`,
      payload,
      updates,
      sourceRate: summarizeRuleForLog(rateObject),
      sourceRule: summarizeRuleForLog(rateObject?.original_rule),
      baseRule: summarizeRuleForLog(rateObject?.base_rule),
      adminRule: summarizeRuleForLog(adminRule),
      franchiseRule: summarizeRuleForLog(franchiseRule),
      isInherited: Boolean(rateObject?.isInherited)
    });
    logRateInfo('merchant-rates:update-specific:charge', {
      charge: payload.charge_percent,
      inputCharge: updates?.charge_percent ?? updates?.chargePercent ?? null
    });

    const response = await axios.put(`${POS_CHARGE_RULES_BASE}/${ruleId}`, payload, getAuthHeaders());
    const record = resolveUpdatedRuleRecord({
      responseData: response.data,
      currentRule: rateObject?.original_rule,
      payload,
      ruleId,
      logEvent: 'merchant-rates:update-specific',
      context: {
        merchantId,
        franchiseId,
        sourceRate: summarizeRuleForLog(rateObject)
      }
    });

    logRateInfo('merchant-rates:update-specific:success', {
      merchantId,
      ruleId: record?.id,
      franchiseId,
      requestPayload: payload,
      responseData: response?.data ?? null,
      record: summarizeRuleForLog(record),
      sourceRate: summarizeRuleForLog(rateObject)
    });

    return mapRuleToMerchantFormat(record, {
      merchantId: Number(merchantId),
      franchiseId,
      adminRule,
      franchiseRule,
      baseRule: rateObject?.base_rule || null,
      isInherited: false
    });
  } catch (error) {
    logRateError('merchant-rates:update:error', error, {
      merchantId,
      franchiseId: getEntityFranchiseId(scope, rateObject?.franchaise_id ?? rateObject?.franchiseId ?? null),
      rateId: rateObject?.id
    });
    throw error;
  }
};

export const updateFranchiseManagedMerchantRate = async (
  merchantId,
  rateObject,
  updates,
  franchiseId
) =>
  updateMerchantRate(merchantId, rateObject, updates, {
    franchiseId,
    omitFranchiseId: true
  });

export const getAllMerchantRates = async (merchants, scope = {}) => {
  try {
    const allRates = {};
    const franchiseIdFromScope = getEntityFranchiseId(scope, null);
    const defaultRules = await fetchBaseDefaultRules();
    const adminFranchiseRules = franchiseIdFromScope === null
      ? []
      : await fetchRulesByScopes(
        [RULE_SCOPES.ADMIN_FRANCHISE],
        { franchaise_id: franchiseIdFromScope }
      );
    const adminMerchantRules = franchiseIdFromScope === null
      ? await fetchRulesByScopes([RULE_SCOPES.ADMIN_MERCHANT])
      : [];
    const franchiseDefaultRules = franchiseIdFromScope === null
      ? []
      : await fetchRulesByScopes([RULE_SCOPES.FRANCHISE_DEFAULT], { franchaise_id: franchiseIdFromScope });
    const franchiseMerchantRules = franchiseIdFromScope === null
      ? []
      : await fetchRulesByScopes([RULE_SCOPES.FRANCHISE_MERCHANT], { franchaise_id: franchiseIdFromScope });

    for (const merchant of merchants) {
      const merchantId = getEntityUserId(merchant);
      if (merchantId === null) {
        logRateInfo('merchant-rates:matrix:skip-merchant-without-id', {
          merchant
        });
        continue;
      }
      const merchantFranchiseId = getEntityFranchiseId(merchant, franchiseIdFromScope);
      const parentFranchiseRules = merchantFranchiseId === null
        ? []
        : franchiseDefaultRules.filter((rule) => Number(getRuleFranchiseId(rule)) === Number(merchantFranchiseId));

      const adminRules = merchantFranchiseId === null
        ? defaultRules
        : [
          ...defaultRules,
          ...adminFranchiseRules.filter((rule) => Number(getRuleFranchiseId(rule)) === Number(merchantFranchiseId))
        ];

      const merchantRules = merchantFranchiseId === null
        ? adminMerchantRules.filter((rule) => Number(getRuleUserId(rule)) === Number(merchantId))
        : franchiseMerchantRules.filter(
          (rule) =>
            Number(getRuleUserId(rule)) === Number(merchantId) &&
            Number(getRuleFranchiseId(rule)) === Number(merchantFranchiseId)
        );

      allRates[merchantId] = buildMerchantEffectiveRules(
        adminRules,
        parentFranchiseRules,
        merchantRules,
        merchantId,
        merchantFranchiseId
      );
    }

    logRateInfo('merchant-rates:matrix:success', {
      merchantCount: merchants.length,
      adminRuleCount: defaultRules.length,
      franchiseId: franchiseIdFromScope
    });

    return allRates;
  } catch (error) {
    logRateError('merchant-rates:matrix:error', error, {
      merchantCount: merchants?.length || 0
    });
    return {};
  }
};

export const getFranchiseManagedAllMerchantRates = async (merchants, franchiseId) => {
  try {
    const params = franchiseId ? { franchaise_id: franchiseId } : {};
    const [adminRules, franchiseOwnedRules] = await Promise.all([
      fetchChargeRulesByAudience('admin', params),
      fetchChargeRulesByAudience('franchise', params)
    ]);
    const allRates = {};

    for (const merchant of merchants) {
      const merchantId = getEntityUserId(merchant);
      if (merchantId === null) {
        continue;
      }

      allRates[merchantId] = buildFranchiseManagedMerchantRates(
        adminRules.filter(isUplineRule),
        franchiseOwnedRules.filter((rule) => isFranchiseDefaultRule(rule) || isFranchiseMerchantRule(rule)),
        merchantId,
        franchiseId
      );
    }

    return allRates;
  } catch (error) {
    logRateError('franchise-managed-merchant-rates:matrix:error', error, {
      merchantCount: merchants?.length || 0,
      franchiseId
    });
    return {};
  }
};

export const getGlobalPOSRate = async () => {
  try {
    const res = await axios.get(`${BASE_URL}/pos-charge/global-rate`, getAuthHeaders());
    return res.data;
  } catch (error) {
    if (error.response?.status === 404) {
      return null;
    }
    console.error('Error fetching global POS rate:', error);
    throw error;
  }
};

export const updateGlobalPOSRate = async (percentFee) => {
  try {
    const res = await axios.post(`${BASE_URL}/pos-charge/global-rate`, {
      percent_fee: Number(percentFee)
    }, getAuthHeaders());
    return res.data;
  } catch (error) {
    console.error('Error updating global POS rate:', error);
    throw error;
  }
};

export const createPosRental = async (payload) => {
  try {
    const res = await axios.post(`${BASE_URL}/rental`, payload, getAuthHeaders());
    return res.data;
  } catch (error) {
    throw new Error(error.response?.data?.message || 'Failed to create POS rental');
  }
};

export const listPosRentals = async (params) => {
  try {
    const res = await axios.get(`${BASE_URL}/rental/list`, { ...getAuthHeaders(), params });
    return res.data;
  } catch (error) {
    throw new Error(error.response?.data?.message || 'Failed to fetch POS rentals');
  }
};

export const getPosRentalById = async (id) => {
  try {
    const res = await axios.get(`${BASE_URL}/rental/${id}`, getAuthHeaders());
    return res.data;
  } catch (error) {
    throw new Error(error.response?.data?.message || 'Failed to fetch POS rental');
  }
};

export const updatePosRental = async (id, payload) => {
  try {
    const res = await axios.put(`${BASE_URL}/rental/${id}`, payload, getAuthHeaders());
    return res.data;
  } catch (error) {
    throw new Error(error.response?.data?.message || 'Failed to update POS rental');
  }
};

export const deletePosRental = async (id) => {
  try {
    const res = await axios.delete(`${BASE_URL}/rental/${id}`, getAuthHeaders());
    return res.data;
  } catch (error) {
    throw new Error(error.response?.data?.message || 'Failed to delete POS rental');
  }
};

export const createPayoutCharge = async (payload) => {
  try {
    const res = await axios.post(`${BASE_URL}/payout-charge`, payload, getAuthHeaders());
    return res.data;
  } catch (error) {
    throw new Error(error.response?.data?.message || 'Failed to create payout charge');
  }
};

export const listPayoutCharges = async () => {
  try {
    const res = await axios.get(`${BASE_URL}/payout-charge/list`, getAuthHeaders());
    return res.data;
  } catch (error) {
    throw new Error(error.response?.data?.message || 'Failed to fetch payout charges');
  }
};

export const listPayoutChargesWithParams = async (params) => {
  try {
    const res = await axios.get(`${BASE_URL}/payout-charge/list`, { ...getAuthHeaders(), params });
    return res.data;
  } catch (error) {
    throw new Error(error.response?.data?.message || 'Failed to fetch payout charges');
  }
};

export const getPayoutChargeById = async (id) => {
  try {
    const res = await axios.get(`${BASE_URL}/payout-charge/${id}`, getAuthHeaders());
    return res.data;
  } catch (error) {
    throw new Error(error.response?.data?.message || 'Failed to fetch payout charge');
  }
};

export const updatePayoutCharge = async (id, payload) => {
  try {
    const res = await axios.put(`${BASE_URL}/payout-charge/${id}`, payload, getAuthHeaders());
    return res.data;
  } catch (error) {
    throw new Error(error.response?.data?.message || 'Failed to update payout charge');
  }
};

export const deletePayoutCharge = async (id) => {
  try {
    const res = await axios.delete(`${BASE_URL}/payout-charge/${id}`, getAuthHeaders());
    return res.data;
  } catch (error) {
    throw new Error(error.response?.data?.message || 'Failed to delete payout charge');
  }
};

export const createPosTransactionCharge = async (payload) => {
  try {
    const res = await axios.post(`${BASE_URL}/pos-transaction-charge`, payload, getAuthHeaders());
    return res.data;
  } catch (error) {
    throw new Error(error.response?.data?.message || 'Failed to create POS transaction charge');
  }
};

export const listPosTransactionCharges = async () => {
  try {
    const res = await axios.get(`${BASE_URL}/pos-transaction-charge/list`, getAuthHeaders());
    return res.data;
  } catch (error) {
    throw new Error(error.response?.data?.message || 'Failed to fetch POS transaction charges');
  }
};

export const getPosTransactionChargeById = async (id) => {
  try {
    const res = await axios.get(`${BASE_URL}/pos-transaction-charge/${id}`, getAuthHeaders());
    return res.data;
  } catch (error) {
    throw new Error(error.response?.data?.message || 'Failed to fetch POS transaction charge');
  }
};

export const updatePosTransactionCharge = async (id, payload) => {
  try {
    const res = await axios.put(`${BASE_URL}/pos-transaction-charge/${id}`, payload, getAuthHeaders());
    return res.data;
  } catch (error) {
    throw new Error(error.response?.data?.message || 'Failed to update POS transaction charge');
  }
};

export const deletePosTransactionCharge = async (id) => {
  try {
    const res = await axios.delete(`${BASE_URL}/pos-transaction-charge/${id}`, getAuthHeaders());
    return res.data;
  } catch (error) {
    throw new Error(error.response?.data?.message || 'Failed to delete POS transaction charge');
  }
};

export const listBbpsChargeRules = async (params = {}) => {
  try {
    const res = await axios.get(`${BASE_URL}/bbps-cc/charge-rules`, { ...getAuthHeaders(), params });
    return res.data;
  } catch (error) {
    throw new Error(error.response?.data?.message || 'Failed to fetch BBPS CC bill payment charge rules');
  }
};

export const createBbpsChargeRule = async (payload) => {
  try {
    const res = await axios.post(`${BASE_URL}/bbps-cc/charge-rules`, payload, getAuthHeaders());
    return res.data;
  } catch (error) {
    throw new Error(error.response?.data?.message || 'Failed to create BBPS CC bill payment charge rule');
  }
};

export const updateBbpsChargeRule = async (id, payload) => {
  try {
    const res = await axios.put(`${BASE_URL}/bbps-cc/charge-rules/${id}`, payload, getAuthHeaders());
    return res.data;
  } catch (error) {
    throw new Error(error.response?.data?.message || 'Failed to update BBPS CC bill payment charge rule');
  }
};

export const deleteBbpsChargeRule = async (id) => {
  try {
    const res = await axios.delete(`${BASE_URL}/bbps-cc/charge-rules/${id}`, getAuthHeaders());
    return res.data;
  } catch (error) {
    throw new Error(error.response?.data?.message || 'Failed to delete BBPS CC bill payment charge rule');
  }
};

// ── User Payout Charge Overrides API ──────────────────────────────────────────
export const createUserPayoutCharge = async (payload) => {
  try {
    const res = await axios.post(`${BASE_URL}/user-payout-charge`, payload, getAuthHeaders());
    return res.data;
  } catch (error) {
    throw new Error(error.response?.data?.message || 'Failed to create user payout charge');
  }
};

export const listAllUserPayoutCharges = async (params) => {
  try {
    const res = await axios.get(`${BASE_URL}/user-payout-charge/list`, { ...getAuthHeaders(), params });
    return res.data;
  } catch (error) {
    throw new Error(error.response?.data?.message || 'Failed to fetch user payout charges');
  }
};

export const getUserPayoutChargesByUser = async (userId) => {
  try {
    const res = await axios.get(`${BASE_URL}/user-payout-charge/user/${userId}`, getAuthHeaders());
    return res.data;
  } catch (error) {
    throw new Error(error.response?.data?.message || 'Failed to fetch user payout charges');
  }
};

export const updateUserPayoutCharge = async (id, payload) => {
  try {
    const res = await axios.put(`${BASE_URL}/user-payout-charge/${id}`, payload, getAuthHeaders());
    return res.data;
  } catch (error) {
    throw new Error(error.response?.data?.message || 'Failed to update user payout charge');
  }
};

export const deleteUserPayoutCharge = async (id) => {
  try {
    const res = await axios.delete(`${BASE_URL}/user-payout-charge/${id}`, getAuthHeaders());
    return res.data;
  } catch (error) {
    throw new Error(error.response?.data?.message || 'Failed to delete user payout charge');
  }
};

// ── Super Franchise Managed Charge Rules API ────────────────────────────────

// Helper: Fetch super franchise baseline rules from upline admin AND existing SF overrides
export const fetchSuperFranchiseBaseAndDefaultRules = async (superFranchiseId) => {
  let adminRules = [];
  let sfRules = [];

  // 1. Primary source: Fetch inherited baseline POS charges from Admin via /service-charge/my-applicable-charges
  try {
    const applicableRes = await fetchMyAdminApplicableCharges();
    const posRules = applicableRes?.data?.pos || [];
    if (posRules.length > 0) {
      adminRules = posRules.map((r, idx) => ({
        id: r.id || `inherited-pos-${idx}`,
        rule_id: r.id || null,
        payment_mode: r.payment_mode || r.method || 'CARD',
        card_brand: r.card_brand || r.network || 'ALL',
        card_type: r.card_type || 'ANY',
        card_classification: r.card_classification || 'ANY',
        settlement_type: r.settlement_type || null,
        company_name: r.company_name || null,
        min_amount: toFiniteNumber(r.min_amount ?? r.from_amount, 0),
        max_amount: toNullableNumber(r.max_amount ?? r.to_amount),
        charge_percent: toFiniteNumber(r.charge_percent ?? r.base_rate ?? r.rate, 0),
        charge_flat: toFiniteNumber(r.charge_flat ?? r.flat_fee, 0),
        gst_required: Boolean(r.gst_required),
        gst_percent: toFiniteNumber(r.gst_percent ?? r.gst_rate, 18),
        scope: 'admin_default',
        is_active: r.is_active !== false,
      }));
    }
  } catch (err) {
    logRateWarn('Failed to fetch admin applicable charges for super franchise base defaults', err);
  }

  // 2. Fetch list of all POS rules from server (includes admin rules + SF created rules)
  try {
    const listRules = await fetchSuperFranchiseListRules();
    if (Array.isArray(listRules) && listRules.length > 0) {
      if (adminRules.length === 0) {
        adminRules = listRules.filter(
          r => isAdminDefaultRule(r) || isAdminSuperFranchiseRule(r) || r.scope === 'admin_default' || r.scope === 'admin_super_franchise' || r.scope === 'super_admin_default'
        );
      }
      sfRules = listRules;
    }
  } catch (err) {
    logRateWarn('Failed to fetch list rules for super franchise', err);
  }

  // 3. Fallback for admin rules if still empty
  if (adminRules.length === 0) {
    try {
      const audienceAdminRules = await fetchChargeRulesByAudience('admin');
      if (audienceAdminRules.length > 0) {
        adminRules = audienceAdminRules;
      } else {
        adminRules = await fetchRulesByScopes([RULE_SCOPES.ADMIN_DEFAULT, RULE_SCOPES.SUPER_ADMIN_DEFAULT]);
      }
    } catch (err) {
      logRateWarn('Failed fallback fetch for admin rules', err);
    }
  }

  // 4. Identify Super Franchise default rules (rules without merchant/franchise id)
  const sfDefaultRules = sfRules.filter(r => {
    const isSfScope = r.scope === 'super_franchise_default' ||
      (!hasMerchantScope(r) && !hasFranchiseScope(r) && hasSuperFranchiseScope(r));
    const matchesSfId = !superFranchiseId || Number(getRuleSuperFranchiseId(r)) === Number(superFranchiseId);
    return isSfScope && matchesSfId;
  });

  return { adminRules, sfDefaultRules, allRules: sfRules };
};

const fetchSuperFranchiseListRules = async (extraParams = {}) => {
  const apiParams = Object.fromEntries(
    Object.entries({ limit: 2000, ...extraParams })
      .filter(([, v]) => v !== undefined && v !== null && v !== '')
  );
  try {
    const response = await axios.get(`${POS_CHARGE_RULES_BASE}/list`, {
      ...getAuthHeaders(),
      params: apiParams,
    });
    return extractArrayPayload(response.data);
  } catch (err) {
    logRateWarn('Failed to fetch POS charge rules list', err);
    return [];
  }
};

export const getSuperFranchiseManagedDefaultRates = async (superFranchiseId) => {
  try {
    const { adminRules, sfDefaultRules } = await fetchSuperFranchiseBaseAndDefaultRules(superFranchiseId);

    const adminByKey = buildPreferredRuleMap(adminRules, getAdminAudienceRulePriority);
    const sfByKey = new Map(sfDefaultRules.map(r => [makeRuleKey(r), r]));

    const keys = new Set([...adminByKey.keys(), ...sfByKey.keys()]);

    const results = [...keys].map(key => {
      const adminRule = adminByKey.get(key) || null;
      const sfRule = sfByKey.get(key) || null;
      const effectiveRule = sfRule || adminRule;
      if (!effectiveRule) return null;

      const adminRate = adminRule
        ? toFiniteNumber(adminRule.charge_percent ?? adminRule.base_rate, 0)
        : toFiniteNumber(effectiveRule.charge_percent ?? effectiveRule.base_rate, 0);
      const sfRate = sfRule
        ? toFiniteNumber(sfRule.charge_percent ?? sfRule.base_rate, adminRate)
        : adminRate;
      const adminFlatRate = adminRule
        ? toFiniteNumber(adminRule.charge_flat ?? adminRule.base_flat_rate, 0)
        : toFiniteNumber(effectiveRule.charge_flat ?? effectiveRule.base_flat_rate, 0);
      const sfFlatRate = sfRule
        ? toFiniteNumber(sfRule.charge_flat ?? sfRule.base_flat_rate, adminFlatRate)
        : adminFlatRate;

      const mapped = mapRuleToFranchiseFormat(effectiveRule, {
        superFranchiseId,
        adminRule: adminRule || effectiveRule,
        baseRule: adminRule || effectiveRule,
        isInherited: !sfRule,
      });

      return {
        ...mapped,
        id: sfRule?.id || adminRule?.id || mapped.id || key,
        rule_id: sfRule?.id || null,
        admin_rate: adminRate,
        base_rate: adminRate,
        admin_flat_rate: adminFlatRate,
        base_flat_rate: adminFlatRate,
        charge_flat: sfFlatRate,
        merchant_rate: sfRate,
        franchise_rate: sfRate,
        super_franchise_rate: sfRate,
        source_scope: sfRule ? 'super_franchise' : 'admin',
        base_source_scope: adminRule ? 'admin' : mapped.base_source_scope,
        isInherited: !sfRule,
        _ruleKey: key,
      };
    }).filter(Boolean);

    // Safety dedup: keep the most specific rule per key dimension
    const finalMap = new Map();
    const priority = (r) => r.source_scope === 'super_franchise' ? 2 : 1;
    results.forEach(r => {
      const existing = finalMap.get(r._ruleKey);
      if (!existing || priority(r) >= priority(existing)) finalMap.set(r._ruleKey, r);
    });

    return [...finalMap.values()].map(r => { const { _ruleKey, ...rest } = r; return rest; }).sort(sortMappedRates);
  } catch (error) {
    logRateError('super-franchise-managed-rates:load:error', error, { superFranchiseId });
    return [];
  }
};

export const updateSuperFranchiseManagedDefaultRate = async (superFranchiseId, rateObject, updates) => {
  try {
    const isInherited = Boolean(rateObject?.isInherited) || !rateObject?.rule_id || !Number.isFinite(Number(rateObject?.rule_id));
    const adminRate = rateObject?.admin_rate ?? rateObject?.base_rate ?? 0;
    const adminFlatRate = rateObject?.admin_flat_rate ?? rateObject?.base_flat_rate ?? 0;
    const inputCharge = toFiniteNumber(updates?.chargePercent ?? updates?.charge_percent, 0);
    const inputFlatCharge = toFiniteNumber(updates?.chargeFlat ?? updates?.charge_flat, 0);

    if (isInherited) {
      const payloadOverrides = {
        ...updates,
        charge_percent: inputCharge,
        charge_flat: inputFlatCharge,
        user_id: null,
        franchaise_id: null,
        super_franchise_id: Number(superFranchiseId),
        is_active: true
      };
      const sourceRule = rateObject?.original_rule || rateObject?.base_rule || rateObject;
      const payload = normalizeRulePayload(sourceRule, payloadOverrides);
      const response = await axios.post(POS_CHARGE_RULES_BASE, payload, getAuthHeaders());
      const record = extractRuleRecord(response.data) || { ...payload, id: response.data?.id };
      const newSfRate = toFiniteNumber(record?.charge_percent ?? inputCharge, inputCharge);

      const mapped = mapRuleToFranchiseFormat(record, {
        superFranchiseId: Number(superFranchiseId),
        adminRule: rateObject?.base_rule || null,
        baseRule: rateObject?.base_rule || null,
        isInherited: false
      });
      return {
        ...mapped,
        id: record?.id || rateObject?.id,
        rule_id: record?.id,
        admin_rate: adminRate,
        base_rate: adminRate,
        admin_flat_rate: adminFlatRate,
        base_flat_rate: adminFlatRate,
        charge_flat: toFiniteNumber(record?.charge_flat ?? inputFlatCharge, inputFlatCharge),
        merchant_rate: newSfRate,
        franchise_rate: newSfRate,
        super_franchise_rate: newSfRate,
        source_scope: 'super_franchise',
        base_source_scope: 'admin',
        isInherited: false
      };
    } else {
      const ruleId = Number(rateObject?.rule_id || rateObject?.id);
      const payload = buildUpdatePayload(
        {
          ...updates,
          charge_percent: inputCharge,
          charge_flat: inputFlatCharge,
          user_id: null,
          franchaise_id: null,
          super_franchise_id: Number(superFranchiseId)
        },
        rateObject?.original_rule || rateObject
      );
      const response = await axios.put(`${POS_CHARGE_RULES_BASE}/${ruleId}`, payload, getAuthHeaders());
      const record = resolveUpdatedRuleRecord({
        responseData: response.data,
        currentRule: rateObject?.original_rule,
        payload,
        ruleId,
        logEvent: 'super-franchise-rates:update-default'
      }) || { ...payload, id: ruleId };
      const newSfRate = toFiniteNumber(record?.charge_percent ?? inputCharge, inputCharge);
      const mapped = mapRuleToFranchiseFormat(record, {
        superFranchiseId: Number(superFranchiseId),
        adminRule: rateObject?.base_rule || null,
        baseRule: rateObject?.base_rule || null,
        isInherited: false
      });
      return {
        ...mapped,
        id: ruleId,
        rule_id: ruleId,
        admin_rate: adminRate,
        base_rate: adminRate,
        merchant_rate: newSfRate,
        franchise_rate: newSfRate,
        super_franchise_rate: newSfRate,
        source_scope: 'super_franchise',
        base_source_scope: 'admin',
        isInherited: false
      };
    }
  } catch (error) {
    logRateError('super-franchise-rates:update:error', error, { superFranchiseId, rateId: rateObject?.id });
    throw error;
  }
};

export const getSuperFranchiseManagedFranchiseRates = async (franchiseId, superFranchiseId) => {
  try {
    const { adminRules, sfDefaultRules, allRules } = await fetchSuperFranchiseBaseAndDefaultRules(superFranchiseId);

    // Only include rules that are specifically for THIS franchise (check franchiseId in all cases)
    const sfFranchiseRules = (allRules || []).filter(r => {
      const matchesFranchise = Number(getRuleFranchiseId(r)) === Number(franchiseId);
      const matchesSfId = !superFranchiseId || Number(getRuleSuperFranchiseId(r)) === Number(superFranchiseId);
      const isFranchiseScoped =
        (r.scope === 'super_franchise_franchise' && matchesFranchise) ||
        (matchesFranchise && getRuleUserId(r) === null);
      return isFranchiseScoped && matchesSfId;
    });

    const adminByKey = buildPreferredRuleMap(adminRules, getAdminAudienceRulePriority);
    const sfDefaultByKey = new Map(sfDefaultRules.map(r => [makeRuleKey(r), r]));
    const sfFranchiseByKey = new Map(sfFranchiseRules.map(r => [makeRuleKey(r), r]));
    // Union of keys — after makeRuleKey normalization, same dimensions = same key = 1 entry
    const keys = new Set([...adminByKey.keys(), ...sfDefaultByKey.keys(), ...sfFranchiseByKey.keys()]);

    const results = [...keys].map(key => {
      const adminRule = adminByKey.get(key) || null;
      const sfDefaultRule = sfDefaultByKey.get(key) || null;
      const sfFranchiseRule = sfFranchiseByKey.get(key) || null;
      const effectiveRule = sfFranchiseRule || sfDefaultRule || adminRule;
      if (!effectiveRule) return null;

      const adminRate = adminRule ? toFiniteNumber(adminRule.charge_percent, 0) : toFiniteNumber(effectiveRule.charge_percent, 0);
      const sfDefaultRate = sfDefaultRule ? toFiniteNumber(sfDefaultRule.charge_percent, 0) : adminRate;
      const effectiveRateVal = sfFranchiseRule ? toFiniteNumber(sfFranchiseRule.charge_percent, sfDefaultRate) : sfDefaultRate;
      const adminFlatRate = adminRule ? toFiniteNumber(adminRule.charge_flat, 0) : toFiniteNumber(effectiveRule.charge_flat, 0);
      const sfDefaultFlatRate = sfDefaultRule ? toFiniteNumber(sfDefaultRule.charge_flat, 0) : adminFlatRate;
      const effectiveFlatVal = sfFranchiseRule ? toFiniteNumber(sfFranchiseRule.charge_flat, sfDefaultFlatRate) : sfDefaultFlatRate;

      const mapped = mapRuleToFranchiseFormat(effectiveRule, {
        franchiseId: Number(franchiseId),
        superFranchiseId: Number(superFranchiseId),
        adminRule: adminRule || effectiveRule,
        baseRule: sfDefaultRule || adminRule || effectiveRule,
        isInherited: !sfFranchiseRule
      });
      return {
        ...mapped,
        id: sfFranchiseRule?.id || sfDefaultRule?.id || adminRule?.id || mapped.id || key,
        rule_id: sfFranchiseRule?.id || null,
        admin_rate: adminRate,
        base_rate: sfDefaultRate,
        admin_flat_rate: adminFlatRate,
        base_flat_rate: sfDefaultFlatRate,
        charge_flat: effectiveFlatVal,
        merchant_rate: effectiveRateVal,
        franchise_rate: effectiveRateVal,
        super_franchise_rate: sfDefaultRate,
        source_scope: sfFranchiseRule ? 'super_franchise_franchise' : sfDefaultRule ? 'super_franchise' : 'admin',
        base_source_scope: sfDefaultRule ? 'super_franchise' : 'admin',
        isInherited: !sfFranchiseRule,
        _ruleKey: key,
      };
    }).filter(Boolean);

    // Final safety dedup: if somehow 2 entries share the same rule key, keep the most specific one
    const finalMap = new Map();
    const priority = (r) => r.source_scope === 'super_franchise_franchise' ? 3 : r.source_scope === 'super_franchise' ? 2 : 1;
    results.forEach(r => {
      const existing = finalMap.get(r._ruleKey);
      if (!existing || priority(r) >= priority(existing)) finalMap.set(r._ruleKey, r);
    });

    return [...finalMap.values()].map(r => { const { _ruleKey, ...rest } = r; return rest; }).sort(sortMappedRates);
  } catch (error) {
    logRateError('super-franchise-franchise-rates:load:error', error, { franchiseId, superFranchiseId });
    return [];
  }
};

export const updateSuperFranchiseManagedFranchiseRate = async (franchiseId, rateObject, updates, superFranchiseId) => {
  try {
    const isInherited = Boolean(rateObject?.isInherited) || !rateObject?.rule_id || !Number.isFinite(Number(rateObject?.rule_id));
    const adminRate = rateObject?.admin_rate ?? rateObject?.base_rate ?? 0;
    const baseRate = rateObject?.base_rate ?? adminRate;
    const adminFlatRate = rateObject?.admin_flat_rate ?? rateObject?.base_flat_rate ?? 0;
    const baseFlatRate = rateObject?.base_flat_rate ?? adminFlatRate;
    const inputCharge = toFiniteNumber(updates?.chargePercent ?? updates?.charge_percent, 0);
    const inputFlatCharge = toFiniteNumber(updates?.chargeFlat ?? updates?.charge_flat, 0);

    if (isInherited) {
      const payloadOverrides = {
        ...updates,
        charge_percent: inputCharge,
        charge_flat: inputFlatCharge,
        user_id: null,
        franchaise_id: Number(franchiseId),
        super_franchise_id: Number(superFranchiseId),
        is_active: true
      };
      const sourceRule = rateObject?.original_rule || rateObject?.base_rule || rateObject;
      const payload = normalizeRulePayload(sourceRule, payloadOverrides);
      const response = await axios.post(POS_CHARGE_RULES_BASE, payload, getAuthHeaders());
      const record = extractRuleRecord(response.data) || { ...payload, id: response.data?.id };
      const newRate = toFiniteNumber(record?.charge_percent ?? inputCharge, inputCharge);
      const mapped = mapRuleToFranchiseFormat(record, {
        franchiseId: Number(franchiseId),
        superFranchiseId: Number(superFranchiseId),
        adminRule: rateObject?.admin_rate !== null && rateObject?.admin_rate !== undefined ? { charge_percent: rateObject.admin_rate } : null,
        baseRule: rateObject?.base_rule || null,
        isInherited: false
      });
      return {
        ...mapped,
        id: record?.id || rateObject?.id,
        rule_id: record?.id,
        admin_rate: adminRate,
        base_rate: baseRate,
        admin_flat_rate: adminFlatRate,
        base_flat_rate: baseFlatRate,
        charge_flat: toFiniteNumber(record?.charge_flat ?? inputFlatCharge, inputFlatCharge),
        merchant_rate: newRate,
        franchise_rate: newRate,
        super_franchise_rate: baseRate,
        source_scope: 'super_franchise_franchise',
        base_source_scope: 'super_franchise',
        isInherited: false
      };
    } else {
      const ruleId = Number(rateObject?.rule_id || rateObject?.id);
      const payload = buildUpdatePayload(
        {
          ...updates,
          charge_percent: inputCharge,
          charge_flat: inputFlatCharge,
          user_id: null,
          franchaise_id: Number(franchiseId),
          super_franchise_id: Number(superFranchiseId)
        },
        rateObject?.original_rule || rateObject
      );
      const response = await axios.put(`${POS_CHARGE_RULES_BASE}/${ruleId}`, payload, getAuthHeaders());
      const record = resolveUpdatedRuleRecord({
        responseData: response.data,
        currentRule: rateObject?.original_rule,
        payload,
        ruleId,
        logEvent: 'super-franchise-rates:update-franchise'
      }) || { ...payload, id: ruleId };
      const newRate = toFiniteNumber(record?.charge_percent ?? inputCharge, inputCharge);
      const mapped = mapRuleToFranchiseFormat(record, {
        franchiseId: Number(franchiseId),
        superFranchiseId: Number(superFranchiseId),
        adminRule: rateObject?.admin_rate !== null && rateObject?.admin_rate !== undefined ? { charge_percent: rateObject.admin_rate } : null,
        baseRule: rateObject?.base_rule || null,
        isInherited: false
      });
      return {
        ...mapped,
        id: ruleId,
        rule_id: ruleId,
        admin_rate: adminRate,
        base_rate: baseRate,
        merchant_rate: newRate,
        franchise_rate: newRate,
        super_franchise_rate: baseRate,
        source_scope: 'super_franchise_franchise',
        base_source_scope: 'super_franchise',
        isInherited: false
      };
    }
  } catch (error) {
    logRateError('super-franchise-franchise-rates:update:error', error, { franchiseId, superFranchiseId });
    throw error;
  }
};

export const getSuperFranchiseManagedMerchantRates = async (merchantId, superFranchiseId) => {
  try {
    const { adminRules, sfDefaultRules, allRules } = await fetchSuperFranchiseBaseAndDefaultRules(superFranchiseId);

    // Only include rules specifically for this merchant
    const sfMerchantRules = (allRules || []).filter(r => {
      const matchesMerchant = Number(getRuleUserId(r)) === Number(merchantId);
      const matchesSfId = !superFranchiseId || Number(getRuleSuperFranchiseId(r)) === Number(superFranchiseId);
      const isMerchantScoped =
        (r.scope === 'super_franchise_merchant' && matchesMerchant) ||
        matchesMerchant;
      return isMerchantScoped && matchesSfId;
    });

    const adminByKey = buildPreferredRuleMap(adminRules, getAdminAudienceRulePriority);
    const sfDefaultByKey = new Map(sfDefaultRules.map(r => [makeRuleKey(r), r]));
    const sfMerchantByKey = new Map(sfMerchantRules.map(r => [makeRuleKey(r), r]));
    const keys = new Set([...adminByKey.keys(), ...sfDefaultByKey.keys(), ...sfMerchantByKey.keys()]);

    const results = [...keys].map(key => {
      const adminRule = adminByKey.get(key) || null;
      const sfDefaultRule = sfDefaultByKey.get(key) || null;
      const sfMerchantRule = sfMerchantByKey.get(key) || null;
      const effectiveRule = sfMerchantRule || sfDefaultRule || adminRule;
      if (!effectiveRule) return null;

      const adminRate = adminRule ? toFiniteNumber(adminRule.charge_percent, 0) : toFiniteNumber(effectiveRule.charge_percent, 0);
      const sfDefaultRate = sfDefaultRule ? toFiniteNumber(sfDefaultRule.charge_percent, 0) : adminRate;
      const effectiveRateVal = sfMerchantRule ? toFiniteNumber(sfMerchantRule.charge_percent, sfDefaultRate) : sfDefaultRate;
      const adminFlatRate = adminRule ? toFiniteNumber(adminRule.charge_flat, 0) : toFiniteNumber(effectiveRule.charge_flat, 0);
      const sfDefaultFlatRate = sfDefaultRule ? toFiniteNumber(sfDefaultRule.charge_flat, 0) : adminFlatRate;
      const effectiveFlatVal = sfMerchantRule ? toFiniteNumber(sfMerchantRule.charge_flat, sfDefaultFlatRate) : sfDefaultFlatRate;

      const mapped = mapRuleToMerchantFormat(effectiveRule, {
        merchantId: Number(merchantId),
        superFranchiseId: Number(superFranchiseId),
        adminRule: adminRule || effectiveRule,
        baseRule: sfDefaultRule || adminRule || effectiveRule,
        isInherited: !sfMerchantRule
      });
      return {
        ...mapped,
        id: sfMerchantRule?.id || sfDefaultRule?.id || adminRule?.id || mapped.id || key,
        rule_id: sfMerchantRule?.id || null,
        admin_rate: adminRate,
        base_rate: sfDefaultRate,
        admin_flat_rate: adminFlatRate,
        base_flat_rate: sfDefaultFlatRate,
        charge_flat: effectiveFlatVal,
        merchant_rate: effectiveRateVal,
        source_scope: sfMerchantRule ? 'super_franchise_merchant' : sfDefaultRule ? 'super_franchise' : 'admin',
        base_source_scope: sfDefaultRule ? 'super_franchise' : 'admin',
        isInherited: !sfMerchantRule,
        _ruleKey: key,
      };
    }).filter(Boolean);

    // Safety dedup: keep the most specific rule per key dimension
    const finalMap = new Map();
    const priority = (r) => r.source_scope === 'super_franchise_merchant' ? 3 : r.source_scope === 'super_franchise' ? 2 : 1;
    results.forEach(r => {
      const existing = finalMap.get(r._ruleKey);
      if (!existing || priority(r) >= priority(existing)) finalMap.set(r._ruleKey, r);
    });

    return [...finalMap.values()].map(r => { const { _ruleKey, ...rest } = r; return rest; }).sort(sortMappedRates);
  } catch (error) {
    logRateError('super-franchise-merchant-rates:load:error', error, { merchantId, superFranchiseId });
    return [];
  }
};

export const updateSuperFranchiseManagedMerchantRate = async (merchantId, rateObject, updates, superFranchiseId) => {
  try {
    const isInherited = Boolean(rateObject?.isInherited) || !rateObject?.rule_id || !Number.isFinite(Number(rateObject?.rule_id));
    const adminRate = rateObject?.admin_rate ?? rateObject?.base_rate ?? 0;
    const baseRate = rateObject?.base_rate ?? adminRate;
    const adminFlatRate = rateObject?.admin_flat_rate ?? rateObject?.base_flat_rate ?? 0;
    const baseFlatRate = rateObject?.base_flat_rate ?? adminFlatRate;
    const inputCharge = toFiniteNumber(updates?.chargePercent ?? updates?.charge_percent, 0);
    const inputFlatCharge = toFiniteNumber(updates?.chargeFlat ?? updates?.charge_flat, 0);

    if (isInherited) {
      const payloadOverrides = {
        ...updates,
        charge_percent: inputCharge,
        charge_flat: inputFlatCharge,
        user_id: Number(merchantId),
        super_franchise_id: Number(superFranchiseId),
        is_active: true
      };
      if (rateObject?.franchaise_id) {
        payloadOverrides.franchaise_id = Number(rateObject.franchaise_id);
      }
      const sourceRule = rateObject?.original_rule || rateObject?.base_rule || rateObject;
      const payload = normalizeRulePayload(sourceRule, payloadOverrides);
      const response = await axios.post(POS_CHARGE_RULES_BASE, payload, getAuthHeaders());
      const record = extractRuleRecord(response.data) || { ...payload, id: response.data?.id };
      const newRate = toFiniteNumber(record?.charge_percent ?? inputCharge, inputCharge);
      const mapped = mapRuleToMerchantFormat(record, {
        merchantId: Number(merchantId),
        superFranchiseId: Number(superFranchiseId),
        adminRule: rateObject?.admin_rate !== null && rateObject?.admin_rate !== undefined ? { charge_percent: rateObject.admin_rate } : null,
        baseRule: rateObject?.base_rule || null,
        isInherited: false
      });
      return {
        ...mapped,
        id: record?.id || rateObject?.id,
        rule_id: record?.id,
        admin_rate: adminRate,
        base_rate: baseRate,
        admin_flat_rate: adminFlatRate,
        base_flat_rate: baseFlatRate,
        charge_flat: toFiniteNumber(record?.charge_flat ?? inputFlatCharge, inputFlatCharge),
        merchant_rate: newRate,
        source_scope: 'super_franchise_merchant',
        base_source_scope: 'super_franchise',
        isInherited: false
      };
    } else {
      const ruleId = Number(rateObject?.rule_id || rateObject?.id);
      const payload = buildUpdatePayload(
        {
          ...updates,
          charge_percent: inputCharge,
          charge_flat: inputFlatCharge,
          user_id: Number(merchantId),
          super_franchise_id: Number(superFranchiseId)
        },
        rateObject?.original_rule || rateObject
      );
      const response = await axios.put(`${POS_CHARGE_RULES_BASE}/${ruleId}`, payload, getAuthHeaders());
      const record = resolveUpdatedRuleRecord({
        responseData: response.data,
        currentRule: rateObject?.original_rule,
        payload,
        ruleId,
        logEvent: 'super-franchise-rates:update-merchant'
      }) || { ...payload, id: ruleId };
      const newRate = toFiniteNumber(record?.charge_percent ?? inputCharge, inputCharge);
      const mapped = mapRuleToMerchantFormat(record, {
        merchantId: Number(merchantId),
        superFranchiseId: Number(superFranchiseId),
        adminRule: rateObject?.admin_rate !== null && rateObject?.admin_rate !== undefined ? { charge_percent: rateObject.admin_rate } : null,
        baseRule: rateObject?.base_rule || null,
        isInherited: false
      });
      return {
        ...mapped,
        id: ruleId,
        rule_id: ruleId,
        admin_rate: adminRate,
        base_rate: baseRate,
        merchant_rate: newRate,
        source_scope: 'super_franchise_merchant',
        base_source_scope: 'super_franchise',
        isInherited: false
      };
    }
  } catch (error) {
    logRateError('super-franchise-merchant-rates:update:error', error, { merchantId, superFranchiseId });
    throw error;
  }
};

export const getSuperFranchiseManagedAllFranchiseRates = async (franchises, superFranchiseId) => {
  try {
    const { adminRules, sfDefaultRules, allRules } = await fetchSuperFranchiseBaseAndDefaultRules(superFranchiseId);

    const sfFranchiseRules = (allRules || []).filter(
      r => r.scope === 'super_franchise_franchise' || (hasFranchiseScope(r) && !hasMerchantScope(r))
    );

    const adminByKey = buildPreferredRuleMap(adminRules, getAdminAudienceRulePriority);
    const sfDefaultByKey = new Map(sfDefaultRules.map(r => [makeRuleKey(r), r]));

    const allRates = {};
    for (const franchise of franchises) {
      const fId = franchise?.id ?? franchise?.userId ?? null;
      if (!fId) continue;

      const specificRules = sfFranchiseRules.filter(r => Number(getRuleFranchiseId(r)) === Number(fId));
      const specificByKey = new Map(specificRules.map(r => [makeRuleKey(r), r]));
      const keys = new Set([...adminByKey.keys(), ...sfDefaultByKey.keys(), ...specificByKey.keys()]);

      allRates[fId] = [...keys].map(key => {
        const adminRule = adminByKey.get(key) || null;
        const sfDefaultRule = sfDefaultByKey.get(key) || null;
        const sfFranchiseRule = specificByKey.get(key) || null;
        const effectiveRule = sfFranchiseRule || sfDefaultRule || adminRule;
        if (!effectiveRule) return null;

        const adminRate = adminRule ? toFiniteNumber(adminRule.charge_percent, 0) : toFiniteNumber(effectiveRule.charge_percent, 0);
        const sfDefaultRate = sfDefaultRule ? toFiniteNumber(sfDefaultRule.charge_percent, 0) : adminRate;
        const effectiveRateVal = sfFranchiseRule ? toFiniteNumber(sfFranchiseRule.charge_percent, sfDefaultRate) : sfDefaultRate;

        const mapped = mapRuleToFranchiseFormat(effectiveRule, {
          franchiseId: Number(fId),
          superFranchiseId: Number(superFranchiseId),
          adminRule: adminRule || effectiveRule,
          baseRule: sfDefaultRule || adminRule || effectiveRule,
          isInherited: !sfFranchiseRule
        });
        return {
          ...mapped,
          id: sfFranchiseRule?.id || sfDefaultRule?.id || adminRule?.id || mapped.id || key,
          rule_id: sfFranchiseRule?.id || null,
          admin_rate: adminRate,
          base_rate: sfDefaultRate,
          merchant_rate: effectiveRateVal,
          franchise_rate: effectiveRateVal,
          super_franchise_rate: sfDefaultRate,
          source_scope: sfFranchiseRule ? 'super_franchise_franchise' : sfDefaultRule ? 'super_franchise' : 'admin',
          base_source_scope: sfDefaultRule ? 'super_franchise' : 'admin',
          isInherited: !sfFranchiseRule
        };
      }).filter(Boolean).sort(sortMappedRates);
    }
    return allRates;
  } catch (error) {
    logRateError('super-franchise-all-franchise-rates:matrix:error', error, { superFranchiseId });
    return {};
  }
};

export const getSuperFranchiseManagedAllMerchantRates = async (merchants, superFranchiseId) => {
  try {
    const { adminRules, sfDefaultRules, allRules } = await fetchSuperFranchiseBaseAndDefaultRules(superFranchiseId);

    const sfMerchantRules = (allRules || []).filter(
      r => r.scope === 'super_franchise_merchant' || hasMerchantScope(r)
    );

    const adminByKey = buildPreferredRuleMap(adminRules, getAdminAudienceRulePriority);
    const sfDefaultByKey = new Map(sfDefaultRules.map(r => [makeRuleKey(r), r]));

    const allRates = {};
    for (const merchant of merchants) {
      const mId = merchant?.id ?? merchant?.merchant_id ?? merchant?.userId ?? null;
      if (!mId) continue;

      const specificRules = sfMerchantRules.filter(r => Number(getRuleUserId(r)) === Number(mId));
      const specificByKey = new Map(specificRules.map(r => [makeRuleKey(r), r]));
      const keys = new Set([...adminByKey.keys(), ...sfDefaultByKey.keys(), ...specificByKey.keys()]);

      allRates[mId] = [...keys].map(key => {
        const adminRule = adminByKey.get(key) || null;
        const sfDefaultRule = sfDefaultByKey.get(key) || null;
        const sfMerchantRule = specificByKey.get(key) || null;
        const effectiveRule = sfMerchantRule || sfDefaultRule || adminRule;
        if (!effectiveRule) return null;

        const adminRate = adminRule ? toFiniteNumber(adminRule.charge_percent, 0) : toFiniteNumber(effectiveRule.charge_percent, 0);
        const sfDefaultRate = sfDefaultRule ? toFiniteNumber(sfDefaultRule.charge_percent, 0) : adminRate;
        const effectiveRateVal = sfMerchantRule ? toFiniteNumber(sfMerchantRule.charge_percent, sfDefaultRate) : sfDefaultRate;

        const mapped = mapRuleToMerchantFormat(effectiveRule, {
          merchantId: Number(mId),
          superFranchiseId: Number(superFranchiseId),
          adminRule: adminRule || effectiveRule,
          baseRule: sfDefaultRule || adminRule || effectiveRule,
          isInherited: !sfMerchantRule
        });
        return {
          ...mapped,
          id: sfMerchantRule?.id || sfDefaultRule?.id || adminRule?.id || mapped.id || key,
          rule_id: sfMerchantRule?.id || null,
          admin_rate: adminRate,
          base_rate: sfDefaultRate,
          merchant_rate: effectiveRateVal,
          source_scope: sfMerchantRule ? 'super_franchise_merchant' : sfDefaultRule ? 'super_franchise' : 'admin',
          base_source_scope: sfDefaultRule ? 'super_franchise' : 'admin',
          isInherited: !sfMerchantRule
        };
      }).filter(Boolean).sort(sortMappedRates);
    }
    return allRates;
  } catch (error) {
    logRateError('super-franchise-all-merchant-rates:matrix:error', error, { superFranchiseId });
    return {};
  }
};

// ── Super Admin Admin-Specific Rate Management Helpers ───────────────────────
export const fetchPlatformDefaultPosRules = async () => {
  try {
    const res = await axios.get(`${BASE_URL}/super-admin/rate-settings/pos/defaults?limit=200`, getAuthHeaders());
    return res.data?.data || [];
  } catch (error) {
    console.error('Failed to fetch platform default POS rules:', error);
    // Fallback to legacy endpoint if super-admin route is unavailable
    try {
      const fallback = await axios.get(`${BASE_URL}/pos-charge-rules/list?scope=admin_default&limit=200`, getAuthHeaders());
      return fallback.data?.data || [];
    } catch {
      throw new Error(error.response?.data?.message || 'Failed to fetch platform default POS rules');
    }
  }
};

export const createPlatformDefaultPosRule = async (payload) => {
  try {
    const res = await axios.post(`${BASE_URL}/super-admin/rate-settings/pos/defaults`, payload, getAuthHeaders());
    return res.data;
  } catch (error) {
    throw new Error(error.response?.data?.message || error.response?.data?.errors?.join(', ') || 'Failed to create platform default POS rule');
  }
};

export const updatePlatformDefaultPosRule = async (id, payload) => {
  try {
    const res = await axios.put(`${BASE_URL}/super-admin/rate-settings/pos/defaults/${id}`, payload, getAuthHeaders());
    return res.data;
  } catch (error) {
    throw new Error(error.response?.data?.message || error.response?.data?.errors?.join(', ') || 'Failed to update platform default POS rule');
  }
};

export const deletePlatformDefaultPosRule = async (id) => {
  try {
    const res = await axios.delete(`${BASE_URL}/super-admin/rate-settings/pos/defaults/${id}`, getAuthHeaders());
    return res.data;
  } catch (error) {
    throw new Error(error.response?.data?.message || 'Failed to delete platform default POS rule');
  }
};

export const fetchSuperAdminAdminsPosMatrix = async (params = {}) => {
  try {
    const res = await axios.get(`${BASE_URL}/super-admin/rate-settings/pos/admins`, {
      ...getAuthHeaders(),
      params,
    });
    return res.data;
  } catch (error) {
    console.error('Failed to fetch super admin admins POS matrix:', error);
    throw new Error(error.response?.data?.message || 'Failed to fetch admins rate matrix');
  }
};

export const fetchAdminPosRules = async (adminId) => {
  try {
    const res = await axios.get(`${BASE_URL}/super-admin/rate-settings/pos/admin/${adminId}`, getAuthHeaders());
    return res.data?.overrides || res.data?.data || [];
  } catch (error) {
    console.error(`Failed to fetch POS rules for admin ${adminId}:`, error);
    try {
      const fallback = await axios.get(`${BASE_URL}/pos-charge-rules/list?user_id=${adminId}&limit=200`, getAuthHeaders());
      return fallback.data?.data || [];
    } catch {
      throw new Error(error.response?.data?.message || 'Failed to fetch admin POS rules');
    }
  }
};

export const createAdminPosRule = async (payload) => {
  try {
    const adminId = payload.user_id;
    const res = await axios.post(`${BASE_URL}/super-admin/rate-settings/pos/admin/${adminId}`, payload, getAuthHeaders());
    return res.data;
  } catch (error) {
    throw new Error(error.response?.data?.message || error.response?.data?.errors?.join(', ') || 'Failed to create admin POS rule');
  }
};

export const updateAdminPosRule = async (id, payload) => {
  try {
    const res = await axios.put(`${BASE_URL}/super-admin/rate-settings/pos/admin/rule/${id}`, payload, getAuthHeaders());
    return res.data;
  } catch (error) {
    throw new Error(error.response?.data?.message || error.response?.data?.errors?.join(', ') || 'Failed to update admin POS rule');
  }
};

export const deleteAdminPosRule = async (id) => {
  try {
    const res = await axios.delete(`${BASE_URL}/super-admin/rate-settings/pos/admin/rule/${id}`, getAuthHeaders());
    return res.data;
  } catch (error) {
    throw new Error(error.response?.data?.message || 'Failed to delete admin POS rule');
  }
};

export const fetchSuperAdminRentalRates = async (params = {}) => {
  try {
    const res = await axios.get(`${BASE_URL}/super-admin/rate-settings/rental`, {
      ...getAuthHeaders(),
      params,
    });
    return res.data;
  } catch (error) {
    throw new Error(error.response?.data?.message || 'Failed to fetch rental rates');
  }
};

export const createSuperAdminRentalRate = async (payload) => {
  try {
    const res = await axios.post(`${BASE_URL}/super-admin/rate-settings/rental`, payload, getAuthHeaders());
    return res.data;
  } catch (error) {
    throw new Error(error.response?.data?.message || 'Failed to create rental rate');
  }
};

export const updateSuperAdminRentalRate = async (id, payload) => {
  try {
    const res = await axios.put(`${BASE_URL}/super-admin/rate-settings/rental/${id}`, payload, getAuthHeaders());
    return res.data;
  } catch (error) {
    throw new Error(error.response?.data?.message || 'Failed to update rental rate');
  }
};

export const deleteSuperAdminRentalRate = async (id) => {
  try {
    const res = await axios.delete(`${BASE_URL}/super-admin/rate-settings/rental/${id}`, getAuthHeaders());
    return res.data;
  } catch (error) {
    throw new Error(error.response?.data?.message || 'Failed to delete rental rate');
  }
};

export const fetchSuperAdminCcBillRules = async (params = {}) => {
  try {
    const res = await axios.get(`${BASE_URL}/super-admin/rate-settings/cc-bill`, {
      ...getAuthHeaders(),
      params,
    });
    return res.data;
  } catch (error) {
    throw new Error(error.response?.data?.message || 'Failed to fetch CC bill rules');
  }
};

export const createSuperAdminCcBillRule = async (payload) => {
  try {
    const res = await axios.post(`${BASE_URL}/super-admin/rate-settings/cc-bill`, payload, getAuthHeaders());
    return res.data;
  } catch (error) {
    throw new Error(error.response?.data?.message || 'Failed to create CC bill rule');
  }
};

export const updateSuperAdminCcBillRule = async (id, payload) => {
  try {
    const res = await axios.put(`${BASE_URL}/super-admin/rate-settings/cc-bill/${id}`, payload, getAuthHeaders());
    return res.data;
  } catch (error) {
    throw new Error(error.response?.data?.message || 'Failed to update CC bill rule');
  }
};

export const deleteSuperAdminCcBillRule = async (id) => {
  try {
    const res = await axios.delete(`${BASE_URL}/super-admin/rate-settings/cc-bill/${id}`, getAuthHeaders());
    return res.data;
  } catch (error) {
    throw new Error(error.response?.data?.message || 'Failed to delete CC bill rule');
  }
};

export const fetchSuperAdminPayoutRules = async (params = {}) => {
  try {
    const res = await axios.get(`${BASE_URL}/super-admin/rate-settings/payout`, {
      ...getAuthHeaders(),
      params,
    });
    return res.data;
  } catch (error) {
    throw new Error(error.response?.data?.message || 'Failed to fetch payout rules');
  }
};

export const createSuperAdminPayoutRule = async (payload) => {
  try {
    const res = await axios.post(`${BASE_URL}/super-admin/rate-settings/payout`, payload, getAuthHeaders());
    return res.data;
  } catch (error) {
    throw new Error(error.response?.data?.message || 'Failed to create payout rule');
  }
};

export const updateSuperAdminPayoutRule = async (id, payload) => {
  try {
    const res = await axios.put(`${BASE_URL}/super-admin/rate-settings/payout/${id}`, payload, getAuthHeaders());
    return res.data;
  } catch (error) {
    throw new Error(error.response?.data?.message || 'Failed to update payout rule');
  }
};

export const deleteSuperAdminPayoutRule = async (id, params = {}) => {
  try {
    const res = await axios.delete(`${BASE_URL}/super-admin/rate-settings/payout/${id}`, {
      ...getAuthHeaders(),
      params,
    });
    return res.data;
  } catch (error) {
    throw new Error(error.response?.data?.message || 'Failed to delete payout rule');
  }
};

export const getSuperAdminGlobalPosRate = async () => {
  try {
    const res = await axios.get(`${BASE_URL}/super-admin/rate-settings/global-rate`, getAuthHeaders());
    return res.data;
  } catch (error) {
    throw new Error(error.response?.data?.message || 'Failed to fetch global POS rate');
  }
};

export const updateSuperAdminGlobalPosRate = async (percentFee) => {
  try {
    const res = await axios.post(`${BASE_URL}/super-admin/rate-settings/global-rate`, {
      percent_fee: Number(percentFee),
    }, getAuthHeaders());
    return res.data;
  } catch (error) {
    throw new Error(error.response?.data?.message || 'Failed to update global POS rate');
  }
};

// ── Admin Applicable Charges & User Overrides ───────────────────────────────
export const fetchMyAdminApplicableCharges = async () => {
  try {
    const res = await axios.get(`${BASE_URL}/service-charge/my-applicable-charges`, getAuthHeaders());
    const data = res.data?.data || res.data || {};
    const pos = Array.isArray(data.pos) ? data.pos : [];
    const pay = Array.isArray(data.payout) ? data.payout : (Array.isArray(data.pay) ? data.pay : []);
    const ccBill = Array.isArray(data.cc_bill) ? data.cc_bill : (Array.isArray(data.ccBill) ? data.ccBill : []);
    const rental = data.rental || null;

    return {
      ...res.data,
      data: {
        ...data,
        pos,
        payout: pay,
        pay,
        cc_bill: ccBill,
        ccBill,
        rental,
        ccBillRate: { configuredRates: ccBill },
        payRate: { configuredRates: pay },
      },
      rental,
      ccBillRate: { configuredRates: ccBill },
      payRate: { configuredRates: pay },
    };
  } catch (error) {
    console.error('Failed to fetch admin applicable charges:', error);
    throw new Error(error.response?.data?.message || 'Failed to fetch admin applicable charges');
  }
};

export const fetchApplicableCcBillRulesForUser = async (userId) => {
  try {
    const res = await listBbpsChargeRules({ user_id: userId });
    const rules = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
    return {
      success: true,
      data: {
        userRules: rules,
        rules,
      },
    };
  } catch (error) {
    console.error(`Failed to fetch applicable CC rules for user ${userId}:`, error);
    throw new Error(error.response?.data?.message || 'Failed to fetch user CC bill rules');
  }
};

export const fetchApplicableUserPayoutCharges = async (userId) => {
  try {
    const [userRes, applicableRes] = await Promise.all([
      getUserPayoutChargesByUser(userId).catch(() => ({ data: [] })),
      fetchMyAdminApplicableCharges().catch(() => null),
    ]);

    const userRules = Array.isArray(userRes?.data) ? userRes.data : [];
    const baselineRules = applicableRes?.data?.payout || applicableRes?.data?.pay || [];

    const userMap = new Map();
    userRules.forEach((ur) => {
      const key = `${parseFloat(ur.from_amount || 0).toFixed(2)}-${parseFloat(ur.to_amount || 0).toFixed(2)}`;
      userMap.set(key, ur);
    });

    const matchedUserIds = new Set();
    const comparison = [];

    baselineRules.forEach((br) => {
      const key = `${parseFloat(br.from_amount || 0).toFixed(2)}-${parseFloat(br.to_amount || 0).toFixed(2)}`;
      const ur = userMap.get(key) || null;
      if (ur) {
        matchedUserIds.add(ur.id);
      }
      const activeRule = ur || br;
      const rateType = activeRule.rate_type || 'flat';
      const effectiveRate = rateType === 'flat' ? `₹${activeRule.rate}` : `${activeRule.rate}%`;

      comparison.push({
        from_amount: br.from_amount,
        to_amount: br.to_amount,
        baselineRule: br,
        userRule: ur,
        effectiveRate,
        source: ur ? 'User Override' : 'Super Admin Baseline',
        hasOverride: Boolean(ur),
      });
    });

    userRules.forEach((ur) => {
      if (!matchedUserIds.has(ur.id)) {
        const rateType = ur.rate_type || 'flat';
        comparison.push({
          from_amount: ur.from_amount,
          to_amount: ur.to_amount,
          baselineRule: null,
          userRule: ur,
          effectiveRate: rateType === 'flat' ? `₹${ur.rate}` : `${ur.rate}%`,
          source: 'User Override',
          hasOverride: true,
        });
      }
    });

    comparison.sort((a, b) => Number(a.from_amount) - Number(b.from_amount));

    return {
      success: true,
      data: {
        comparison,
        userRules,
      },
    };
  } catch (error) {
    console.error(`Failed to fetch applicable user payout charges for user ${userId}:`, error);
    throw new Error(error.response?.data?.message || 'Failed to fetch user payout charges');
  }
};

