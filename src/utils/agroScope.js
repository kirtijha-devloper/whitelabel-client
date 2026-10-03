const EMPTY_VALUE_TOKENS = new Set(["", "-", "null", "undefined", "n/a", "na"]);

export const RAZORPAY_SOURCE_OPTIONS = [
  { value: "agro_axis", label: "AGRO-AXIS" },
  { value: "agro_hdfc", label: "AGRO-HDFC" },
  { value: "everlife", label: "EVERLIFE" },
  { value: "worldline", label: "WORLDLINE" },
  { value: "pinelab_manual", label: "PINELAB MANUAL" },
  { value: "telering", label: "TELERING" },
  { value: "UNKNOWN", label: "UNKNOWN" },
];

const cleanValue = (value) => {
  if (value === null || value === undefined) return "";
  return String(value).trim();
};

const pickFirstValue = (...values) => {
  for (const value of values) {
    if (Array.isArray(value)) {
      const resolved = pickFirstValue(...value);
      if (resolved) return resolved;
      continue;
    }

    const cleaned = cleanValue(value);
    if (!cleaned) continue;
    if (EMPTY_VALUE_TOKENS.has(cleaned.toLowerCase())) continue;
    return cleaned;
  }

  return "";
};

export const getSourceLabel = (value) => {
  const normalized = cleanValue(value);
  const match = RAZORPAY_SOURCE_OPTIONS.find((option) => option.value === normalized);
  return match?.label || normalized || "-";
};

export const getRowSource = (row = {}) =>
  pickFirstValue(
    row.source,
    row.event_json?.source,
    row.metadata?.source,
    row.transaction?.source
  );

export const getRowBank = (row = {}) =>
  pickFirstValue(
    row.bank,
    row.bank_name,
    row.issuer_bank,
    row.event_json?.bank,
    row.event_json?.bank_name,
    row.metadata?.bank,
    row.metadata?.bank_name,
    row.transaction?.bank
  );

export const getRowProvider = (row = {}) =>
  pickFirstValue(
    row.provider,
    row.provider_name,
    row.payout_provider,
    row.event_json?.provider,
    row.metadata?.provider,
    row.transaction?.provider
  );

export const getRowCardClassification = (row = {}) =>
  pickFirstValue(
    row.cardClassification,
    row.card_classification,
    row.cardClassificationType,
    row.payment_card_type,
    row.paymentCardType,
    row.event_json?.cardClassification,
    row.event_json?.card_classification,
    row.metadata?.cardClassification,
    row.metadata?.card_classification,
    row.transaction?.cardClassification
  );

export const getRowReference = (row = {}) =>
  pickFirstValue(
    row.reference_id,
    row.referenceId,
    row.utr_no,
    row.transaction_id,
    row.txn_id,
    row.id,
    row._id
  );
