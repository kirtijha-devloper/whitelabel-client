import { normalizeUserRole } from "./userAccess";

export const EMPLOYEE_PERMISSION_MODULES = [
  {
    key: "create-user",
    section: "Users",
    label: "Create User",
    description: "Allow employee to open the create user flow.",
    permissions: ["users.create"],
    landingPath: "/admin/create-user",
  },
  {
    key: "user-list",
    section: "Users",
    label: "User List",
    description:
      "Allow employee to access the full user list workflow, including search, view, edit, settlement shortcut updates, and status updates.",
    permissions: [
      "users.list",
      "users.search",
      "users.read",
      "users.update",
      "users.settlement.update",
      "users.status.update",
    ],
    landingPath: "/admin/list",
  },
  {
    key: "user-impersonate",
    section: "Users",
    label: "Impersonate Login",
    description:
      "Allow employee to open merchant and franchise dashboards through impersonate login.",
    permissions: ["users.impersonate"],
    landingPath: null,
  },
  {
    key: "user-service-settings",
    section: "Users",
    label: "Manage Services",
    description:
      "Allow employee to turn user-specific service settings on or off for merchant and franchise users.",
    permissions: ["users.service_settings.manage"],
    landingPath: null,
  },
  {
    key: "stock-pos",
    section: "Stock POS",
    label: "Stock POS",
    description: "Allow employee to view and manage the stock POS module.",
    permissions: ["stock.pos.read", "stock.pos.manage"],
    landingPath: "/admin/stock-pos",
  },
  {
    key: "wallet",
    section: "Wallet",
    label: "Wallet",
    description: "Allow employee to view wallet balances.",
    permissions: ["wallet.read"],
    landingPath: "/admin/wallet",
  },
  {
    key: "wallet-credit",
    section: "Wallet",
    label: "Wallet Credit",
    description: "Allow employee to credit user wallets.",
    permissions: ["wallet.credit"],
    landingPath: null,
  },
  {
    key: "wallet-debit",
    section: "Wallet",
    label: "Wallet Debit",
    description: "Allow employee to debit user wallets.",
    permissions: ["wallet.debit"],
    landingPath: null,
  },
  {
    key: "reports",
    section: "Reports",
    label: "Reports",
    description: "Allow employee to access admin reports.",
    permissions: ["reports.read"],
    landingPath: "/admin/reports",
  },
  {
    key: "payout",
    section: "Payout",
    label: "Payout",
    description: "Allow employee to access payout reports.",
    permissions: ["payout.read"],
    landingPath: "/admin/total-payouts",
  },
  {
    key: "ledger",
    section: "Ledger",
    label: "Ledger",
    description:
      "Allow employee to view and manage ledger pages, including starting wallet/ledger from the user profile screen.",
    permissions: ["ledger.read", "ledger.manage"],
    landingPath: "/admin/ledger",
  },
  {
    key: "complaint",
    section: "Complaint",
    label: "Complaint",
    description: "Allow employee to access complaint pages.",
    permissions: ["complaints.read", "complaints.manage"],
    landingPath: "/admin/complaint",
  },
  {
    key: "rate-setting",
    section: "Rate Setting",
    label: "Rate Setting",
    description: "Allow employee to view and manage rate settings.",
    permissions: ["rate.settings.read", "rate.settings.manage"],
    landingPath: "/admin/rate-setting",
  },
  {
    key: "razorpay-notifications",
    section: "Razorpay Notifications",
    label: "Razorpay Notifications",
    description: "Allow employee to list and view Razorpay notifications.",
    permissions: ["razorpay.notifications.list", "razorpay.notifications.read"],
    landingPath: "/admin/razorpay-notifications",
  },
  {
    key: "set-limit",
    section: "Set Limit",
    label: "Set Limit Page Access",
    description: "Allow employee to access and view the Set Limit page.",
    permissions: ["set_limit.read"],
    landingPath: "/admin/set-limit",
  },
  {
    key: "set-limit-manual",
    section: "Set Limit",
    label: "Manual Limit Override",
    description: "Allow employee to manually set or edit custom daily payout limit for individual users.",
    permissions: ["set_limit.manual"],
    landingPath: null,
  },
  {
    key: "set-limit-excel",
    section: "Set Limit",
    label: "Excel Limit Upload",
    description: "Allow employee to upload Excel files to update daily limits in bulk.",
    permissions: ["set_limit.excel"],
    landingPath: null,
  },
  {
    key: "set-limit-free-will",
    section: "Set Limit",
    label: "Give Free Will (Full Wallet)",
    description: "Allow employee to give Free Will / Full Wallet payout access to users without daily payout cap.",
    permissions: ["set_limit.free_will"],
    landingPath: null,
  },
  {
    key: "set-limit-global-free-will",
    section: "Set Limit",
    label: "Global Free Will To All Users",
    description: "Allow employee to toggle Global Free Will To All Users ON or OFF.",
    permissions: ["set_limit.global_free_will"],
    landingPath: null,
  },
  {
    key: "pos-settlement",
    section: "Settlement",
    label: "POS Settlement & Daily Limits",
    description: "Allow employee to access the Settlement page, set/override user daily limits, and manage settlement modes.",
    permissions: ["pos.settlement.read", "pos.settlement.manage"],
    landingPath: "/admin/pos-setting",
  },
];

const PERMISSION_LABELS = new Map(
  EMPLOYEE_PERMISSION_MODULES.flatMap((module) =>
    module.permissions.map((permission) => [permission, module.label])
  )
);

const EMPLOYEE_PERMISSION_SET = new Set(
  EMPLOYEE_PERMISSION_MODULES.flatMap((module) => module.permissions)
);

const USER_LIST_IMPLIED_PERMISSIONS = new Set([
  "users.search",
  "users.read",
  "users.update",
  "users.status.update",
]);

export const normalizePermissions = (value) => {
  let rawPermissions = value;

  if (typeof rawPermissions === "string") {
    try {
      rawPermissions = JSON.parse(rawPermissions);
    } catch {
      rawPermissions = rawPermissions
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
    }
  }

  if (!Array.isArray(rawPermissions)) {
    return [];
  }

  return Array.from(
    new Set(
      rawPermissions
        .map((permission) => String(permission || "").trim())
        .filter((permission) => EMPLOYEE_PERMISSION_SET.has(permission) || permission.startsWith("set_limit"))
    )
  );
};

export const isAdminUser = (user) => normalizeUserRole(user?.role) === "admin";

export const isEmployeeUser = (user) => normalizeUserRole(user?.role) === "employee";

const getResolvedUserPermissions = (user) => {
  const base = normalizePermissions(
    user?.permissions ??
      user?.employee_access_role?.permissions ??
      user?.employeeAccessRole?.permissions ??
      user?.employee_access_role?.role_permissions ??
      user?.employeeAccessRole?.role_permissions ??
      []
  );

  const roleId =
    user?.employee_access_role?.id ||
    user?.employeeAccessRole?.id ||
    user?.role_id;

  if (roleId) {
    try {
      const rawStored = localStorage.getItem(`role_custom_permissions_${roleId}`);
      if (rawStored) {
        const storedPermissions = JSON.parse(rawStored);
        if (Array.isArray(storedPermissions)) {
          return Array.from(new Set([...base, ...storedPermissions]));
        }
      }
    } catch (e) {}
  }

  return base;
};

export const hasPermission = (user, permission) => {
  if (!permission) return false;
  if (isAdminUser(user)) return true;
  if (!isEmployeeUser(user)) return false;

  const normalized = getResolvedUserPermissions(user);

  if (normalized.includes(permission)) {
    return true;
  }

  if (normalized.includes("users.list") && USER_LIST_IMPLIED_PERMISSIONS.has(permission)) {
    return true;
  }

  if (
    permission === "razorpay.notifications.read" &&
    normalized.includes("razorpay.notifications.list")
  ) {
    return true;
  }

  return false;
};

export const hasAnyPermission = (user, permissions = []) => {
  if (isAdminUser(user)) return true;
  if (!isEmployeeUser(user)) return false;
  return permissions.some((permission) => hasPermission(user, permission));
};

export const hasAllPermissions = (user, permissions = []) => {
  if (isAdminUser(user)) return true;
  if (!isEmployeeUser(user)) return false;
  return permissions.every((permission) => hasPermission(user, permission));
};

export const getPermissionModuleByKey = (moduleKey) =>
  EMPLOYEE_PERMISSION_MODULES.find((module) => module.key === moduleKey) || null;

export const getSelectedPermissionModules = (permissions) => {
  const normalizedPermissions = normalizePermissions(permissions);
  return EMPLOYEE_PERMISSION_MODULES.filter((module) =>
    module.permissions.some((permission) => normalizedPermissions.includes(permission))
  );
};

export const buildPermissionsFromModuleKeys = (moduleKeys = []) => {
  const permissionList = EMPLOYEE_PERMISSION_MODULES.filter((module) =>
    moduleKeys.includes(module.key)
  ).flatMap((module) => module.permissions);

  return normalizePermissions(permissionList);
};

export const getAdminLandingPathForUser = (user) => {
  if (isAdminUser(user) || isEmployeeUser(user)) {
    return "/admin/dashboard";
  }

  const matchingModule = EMPLOYEE_PERMISSION_MODULES.find(
    (module) => module.landingPath && hasAnyPermission(user, module.permissions)
  );

  return matchingModule?.landingPath || "/admin/no-access";
};

export const formatPermissionList = (permissions) => {
  const normalizedPermissions = normalizePermissions(permissions);

  if (normalizedPermissions.length === 0) {
    return "No permissions";
  }

  const selectedModules = getSelectedPermissionModules(normalizedPermissions);
  const consumedPermissions = new Set(
    selectedModules.flatMap((module) => module.permissions)
  );

  const labels = [
    ...selectedModules.map((module) => module.label),
    ...normalizedPermissions
      .filter((permission) => !consumedPermissions.has(permission))
      .map((permission) => PERMISSION_LABELS.get(permission) || permission),
  ];

  return Array.from(new Set(labels)).join(", ");
};
