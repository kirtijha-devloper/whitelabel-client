const envFlag = String(import.meta.env.VITE_UI_ONLY_MODE || "").toLowerCase();

export const UI_ONLY_MODE =
  envFlag === "1" || envFlag === "true" || envFlag === "yes";

export const getUiOnlyUser = (role = "merchant") => ({
  id: 0,
  role,
  name: `${role} demo`,
});

export const getUiOnlyDashboard = () => ({
  totalTxn: 0,
  totalAmount: 0,
  successTxn: 0,
  failedTxn: 0,
});
