import { v4 as uuidv4 } from 'uuid';

// Initial Mock Data
// Initial Mock Data (Realistic Examples)
let COMMISSION_PLANS = [
  // 1. Standard Admin Plan (Default for new Franchises)
  {
    id: 'plan_default_admin',
    name: 'Standard Franchise Commission',
    owner_role: 'admin',
    is_default: true,
    createdAt: new Date().toISOString(),
    items: [
      { id: 'conf_1', mode: 'UPI', type: 'percentage', rules: [{ value: 0.1 }] }, // Very low for Franchise
      { id: 'conf_2', mode: 'CARD', card_type: 'CREDIT', network: 'VISA', sub_type: 'Consumer', type: 'percentage', rules: [{ value: 0.5 }] },
      { id: 'conf_3', mode: 'CARD', card_type: 'CREDIT', network: 'MASTERCARD', sub_type: 'Consumer', type: 'percentage', rules: [{ value: 0.5 }] }
    ]
  },
  // 2. High-Volume Merchant Plan (Complex Rules)
  {
    id: 'plan_premium_merchant',
    name: 'Premium Merchant (Retail)',
    owner_role: 'admin', // Created by Admin directly
    is_default: false,
    createdAt: new Date().toISOString(),
    items: [
      { id: 'conf_p1', mode: 'UPI', type: 'percentage', rules: [{ value: 0.0 }] }, // Free UPI
      // Visa Rules
      { id: 'conf_p2', mode: 'CARD', card_type: 'CREDIT', network: 'VISA', sub_type: 'Consumer', type: 'percentage', rules: [{ value: 1.2 }] },
      { id: 'conf_p3', mode: 'CARD', card_type: 'CREDIT', network: 'VISA', sub_type: 'Business', type: 'percentage', rules: [{ value: 1.8 }] },
      { id: 'conf_p4', mode: 'CARD', card_type: 'CREDIT', network: 'VISA', sub_type: 'Corporate', type: 'percentage', rules: [{ value: 2.5 }] },
      // Rupay (Slab Based)
      {
        id: 'conf_p5', mode: 'CARD', card_type: 'DEBIT', network: 'RUPAY', sub_type: 'Consumer', type: 'slab',
        rules: [
          { min_amount: 0, max_amount: 2000, value: 0, type: 'flat' }, // Free below 2k
          { min_amount: 2001, max_amount: null, value: 0.4, type: 'percent' }
        ]
      }
    ]
  },
  // 3. Franchise Created Plan for their Merchants
  {
    id: 'plan_franchise_created_1',
    name: 'Standard Merchant (Silver)',
    owner_role: 'franchise',
    is_default: true,
    createdAt: new Date().toISOString(),
    items: [
      { id: 'conf_f1', mode: 'UPI', type: 'percentage', rules: [{ value: 0.25 }] },
      { id: 'conf_f2', mode: 'CARD', card_type: 'CREDIT', type: 'percentage', rules: [{ value: 1.8 }] } // General Credit Card rate
    ]
  }
];

// Mock User Assignments (User -> Plan)
let USER_ASSIGNMENTS = [
  { user_id: 'user_m1', plan_id: 'plan_premium_merchant' }, // Sharma Stores on Premium
  { user_id: 'user_m3', plan_id: 'plan_franchise_created_1' } // City Cafe on Silver
];

// Mock User Specific Overrides
// Structure: { user_id, config_id, override_rules }
let USER_OVERRIDES = [
  // Override for Sharma Stores: Give them a special rate on Visa Corporate
  {
    user_id: 'user_m1',
    config_id: 'conf_p4',
    override_rules: [{ value: 2.2 }] // Lower than standard 2.5%
  }
];

// Mock Users for search
// Mock Users for search
const MOCK_USERS = [
  { id: 'user_f1', name: 'Alpha Franchise Solutions', role: 'franchise', mobile: '9988776655' },
  { id: 'user_f2', name: 'Beta Payments Ltd', role: 'franchise', mobile: '8877665544' },
  { id: 'user_m1', name: 'Sharma General Store', role: 'merchant', mobile: '9123411111' },
  { id: 'user_m2', name: 'Quick Mart Retail', role: 'merchant', mobile: '9123422222' },
  { id: 'user_m3', name: 'City Cafe & Lounge', role: 'merchant', mobile: '9123433333' },
  { id: 'user_m4', name: 'Tech World Electronics', role: 'merchant', mobile: '9123444444' },
  { id: 'user_m5', name: 'Fashion Hub', role: 'merchant', mobile: '9123455555' },
];

/**
 * Simulates fetching all plans available for a specific role.
 * In a real app, this would be `GET /api/commission-plans`
 */
export const getCommissionPlans = async (role) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      const plans = COMMISSION_PLANS.filter(p => p.owner_role === role);
      resolve({ success: true, data: plans });
    }, 500);
  });
};

/**
 * Simulates creating a new plan.
 * In a real app, this would be `POST /api/commission-plans`
 */
/**
 * Simulates creating a new plan.
 * In a real app, this would be `POST /api/commission-plans`
 */
export const createCommissionPlan = async (planData) => {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (!planData.name) return reject(new Error("Plan name is required"));
      if (!planData.items || planData.items.length === 0) return reject(new Error("At least one configuration rule is required"));

      const newPlan = {
        id: uuidv4(),
        ...planData,
        createdAt: new Date().toISOString(),
      };

      if (newPlan.is_default) {
        COMMISSION_PLANS.forEach(p => {
          if (p.owner_role === newPlan.owner_role) p.is_default = false;
        });
      }

      COMMISSION_PLANS.push(newPlan);
      resolve({ success: true, data: newPlan });
    }, 500);
  });
};

/**
 * Simulates updating an existing plan.
 * In a real app, this would be `PUT /api/commission-plans/:id`
 */
export const updateCommissionPlan = async (id, planData) => {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      const index = COMMISSION_PLANS.findIndex(p => p.id === id);
      if (index === -1) return reject(new Error("Plan not found"));

      if (planData.is_default) {
        COMMISSION_PLANS.forEach(p => {
          if (p.owner_role === COMMISSION_PLANS[index].owner_role && p.id !== id) p.is_default = false;
        });
      }

      COMMISSION_PLANS[index] = { ...COMMISSION_PLANS[index], ...planData };
      resolve({ success: true, data: COMMISSION_PLANS[index] });
    }, 500);
  });
};

/**
 * Fetches the currently assigned plan for a user.
 * In a real app, this might be `GET /api/users/:id/commission-plan`
 */
export const getAssignedUserPlan = async (userId) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      const assignment = USER_ASSIGNMENTS.find(a => a.user_id === userId);
      const user = MOCK_USERS.find(u => u.id === userId);

      let plan = null;
      if (assignment) {
        plan = COMMISSION_PLANS.find(p => p.id === assignment.plan_id);
      }

      resolve({ success: true, data: { user, plan } });
    }, 300);
  });
};

/**
 * Assigns a specific plan to a user.
 * In a real app, this would be `POST /api/users/:id/assign-plan`
 */
export const assignPlanToUser = async ({ userId, planId }) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      const existingIndex = USER_ASSIGNMENTS.findIndex(a => a.user_id === userId);
      if (existingIndex >= 0) {
        USER_ASSIGNMENTS[existingIndex].plan_id = planId;
      } else {
        USER_ASSIGNMENTS.push({ user_id: userId, plan_id: planId });
      }
      resolve({ success: true, message: "Plan assigned successfully" });
    }, 500);
  });
};

/**
 * Fetches the "Effective Rates" for a user.
 * This combines the User's Assigned Plan + Any specific overrides they have.
 * 
 * Returns: Array of objects { ...configItem, is_overridden: boolean, source: 'plan' | 'override' }
 */
export const getUserEffectiveRates = async (userId) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      // 1. Get Assigned Plan
      const assignment = USER_ASSIGNMENTS.find(a => a.user_id === userId);
      const user = MOCK_USERS.find(u => u.id === userId);

      if (!assignment) {
        return resolve({ success: true, data: { user, rates: [] } });
      }

      const plan = COMMISSION_PLANS.find(p => p.id === assignment.plan_id);
      if (!plan) {
        return resolve({ success: true, data: { user, rates: [] } });
      }

      // 2. Get Overrides
      const overrides = USER_OVERRIDES.filter(o => o.user_id === userId);

      // 3. Merge Plan Items with Overrides
      const effectiveRates = plan.items.map(item => {
        const override = overrides.find(o => o.config_id === item.id);
        if (override) {
          return {
            ...item,
            rules: override.override_rules,
            is_overridden: true,
            source: 'override'
          };
        }
        return { ...item, is_overridden: false, source: 'plan' };
      });

      resolve({ success: true, data: { user, plan_name: plan.name, rates: effectiveRates } });
    }, 300);
  });
};

/**
 * Saves a specific rate override for a user.
 */
export const updateUserRateOverride = async ({ userId, configId, rules }) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      const existingIndex = USER_OVERRIDES.findIndex(o => o.user_id === userId && o.config_id === configId);

      if (existingIndex >= 0) {
        // Update existing override
        USER_OVERRIDES[existingIndex].override_rules = rules;
      } else {
        // Create new override
        USER_OVERRIDES.push({
          user_id: userId,
          config_id: configId,
          override_rules: rules
        });
      }
      resolve({ success: true, message: "Rate override saved" });
    }, 300);
  });
};


export const searchUsers = async (query) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      const lowerQ = query.toLowerCase();
      const results = MOCK_USERS.filter(u =>
        u.name.toLowerCase().includes(lowerQ) ||
        u.mobile.includes(query)
      );
      resolve({ success: true, data: results });
    }, 300);
  });
};
