const AUTH_TOKEN_KEY = 'token';
const SDDS_TOKEN_KEY = 'sddsToken';
const SESSION_ONLY_AUTH_KEY = 'auth:session-only';
const LOGIN_POPUPS_PENDING_KEY = 'login-popups:pending';

export const isSessionOnlyAuth = () =>
  sessionStorage.getItem(SESSION_ONLY_AUTH_KEY) === '1';

const migrateLegacyTokenToSession = (storageKey) => {
  const legacyToken = localStorage.getItem(storageKey);
  if (!legacyToken) return null;

  sessionStorage.setItem(storageKey, legacyToken);
  localStorage.removeItem(storageKey);
  return legacyToken;
};

export const setAuthToken = (token) => {
  if (!token) return;

  // Keep auth token scoped to the current browser tab/session.
  sessionStorage.setItem(AUTH_TOKEN_KEY, token);
  sessionStorage.setItem(SESSION_ONLY_AUTH_KEY, '1');
  localStorage.removeItem(AUTH_TOKEN_KEY);
};

export const getAuthToken = () => {
  const sessionToken = sessionStorage.getItem(AUTH_TOKEN_KEY);
  if (sessionToken) return sessionToken;

  // Legacy migration: move previously persisted token to sessionStorage once.
  const legacyToken = migrateLegacyTokenToSession(AUTH_TOKEN_KEY);
  if (legacyToken) {
    sessionStorage.setItem(SESSION_ONLY_AUTH_KEY, '1');
    return legacyToken;
  }

  return null;
};

export const removeAuthToken = (options = {}) => {
  const {
    clearPersistent = true,
    clearSessionMode = true,
  } = options;

  sessionStorage.removeItem(AUTH_TOKEN_KEY);
  sessionStorage.removeItem(SDDS_TOKEN_KEY);
  sessionStorage.removeItem(LOGIN_POPUPS_PENDING_KEY);

  if (clearPersistent) {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(SDDS_TOKEN_KEY);
  }

  if (clearSessionMode) {
    sessionStorage.removeItem(SESSION_ONLY_AUTH_KEY);
  }
};

export const logoutCurrentSession = () => {
  const sessionOnly = isSessionOnlyAuth();
  removeAuthToken({
    clearPersistent: !sessionOnly,
    clearSessionMode: !sessionOnly,
  });
};

export const setSddsToken = (token, options = {}) => {
  if (!token) return;

  const { persist = false } = options;
  sessionStorage.setItem(SDDS_TOKEN_KEY, token);

  if (!persist) {
    localStorage.removeItem(SDDS_TOKEN_KEY);
    return;
  }

  if (persist) {
    localStorage.setItem(SDDS_TOKEN_KEY, token);
  }
};

export const getSddsToken = () => {
  const sessionToken = sessionStorage.getItem(SDDS_TOKEN_KEY);
  if (sessionToken) return sessionToken;

  // Legacy migration for previously persisted sdds token.
  const legacyToken = migrateLegacyTokenToSession(SDDS_TOKEN_KEY);
  if (legacyToken) {
    return legacyToken;
  }

  return null;
};

export const seedSessionAuthInWindow = (targetWindow, token) => {
  if (!targetWindow || !token) return false;

  try {
    targetWindow.sessionStorage.setItem(AUTH_TOKEN_KEY, token);
    targetWindow.sessionStorage.setItem(SESSION_ONLY_AUTH_KEY, '1');
    targetWindow.sessionStorage.setItem(LOGIN_POPUPS_PENDING_KEY, '1');
    targetWindow.sessionStorage.removeItem(SDDS_TOKEN_KEY);
    targetWindow.localStorage.removeItem(AUTH_TOKEN_KEY);
    targetWindow.localStorage.removeItem(SDDS_TOKEN_KEY);
    return true;
  } catch {
    return false;
  }
};
  
