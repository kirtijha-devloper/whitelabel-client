export const isMdrCutTransaction = (input, fallbackTransactionType = "") => {
  const row = input && typeof input === "object" ? input : null;
  const description = row ? row.description : input;
  const transactionType = row?.transaction_type ?? row?.type ?? fallbackTransactionType;

  const normalizedType = String(transactionType || "").trim().toLowerCase();
  if (normalizedType === "pos_charge" || normalizedType === "razorpay_charge") {
    return true;
  }

  const transactionText = `${transactionType ? `${transactionType}: ` : ""}${description || ""}`
    .trim()
    .toLowerCase();

  if (transactionText.startsWith("pos_charge:") || transactionText.startsWith("razorpay_charge:")) {
    return true;
  }

  return transactionText.includes("| charge:") && transactionText.includes("| net:");
};

export const sanitizeCcBill3ProviderText = (value, { isAdmin = false } = {}) => {
  const text = String(value || "");
  if (isAdmin || !text) return text;

  return text
    .replace(/\s+via\s+vimo\b/gi, "")
    .replace(/\bvia\s+vimo\s+/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
};
