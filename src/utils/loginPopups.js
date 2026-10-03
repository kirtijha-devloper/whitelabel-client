const LOGIN_POPUPS_PENDING_KEY = "login-popups:pending";

export const markLoginPopupsPending = () => {
  sessionStorage.setItem(LOGIN_POPUPS_PENDING_KEY, "1");
};

export const hasPendingLoginPopups = () =>
  sessionStorage.getItem(LOGIN_POPUPS_PENDING_KEY) === "1";

export const clearPendingLoginPopups = () => {
  sessionStorage.removeItem(LOGIN_POPUPS_PENDING_KEY);
};
