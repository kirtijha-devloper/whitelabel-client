import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle, ArrowLeft, Loader2, Edit, X, Eye, EyeOff, LockKeyhole, Trash2 } from 'lucide-react';
import { fetchUserDetails, approveUser, userDetail, generateTpin, verifyTPin, updatePassword, updateUserProfile } from '../api/authApi';
import { updateChargeSlab } from '../api/chargeSet';
import { fetchServiceSettings, updateServiceSettings } from '../api/serviceSettingsApi';
import { useServiceSettingsPolling } from '../hooks/useServiceSettingsPolling';
import {
  deleteLoginPopup,
  fetchAdminLoginPopups,
  uploadLoginPopup,
} from '../api/loginPopupApi';
import {
  fetchEmployeeAccessRoleMeta,
  fetchEmployeeAccessRoles,
  createEmployeeAccessRole,
  updateEmployeeAccessRole,
} from '../api/employeeAccessRoleApi';
import {
  buildPermissionsFromModuleKeys,
  EMPLOYEE_PERMISSION_MODULES,
  formatPermissionList,
  getSelectedPermissionModules,
  normalizePermissions,
} from '../utils/accessControl';
import {
  SERVICE_FLAG_CONFIG,
  SERVICE_FLAG_DEFAULTS,
  normalizeServiceFlags,
} from '../utils/serviceFlags';
import { recordLimitAuditLog } from '../utils/userLimit';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Reusable components (Card, Modal, InfoField, ImageField) remain the same as in your original code

const getUserDisplayName = (payload) => {
  const user = payload?.user || payload?.data?.user || payload?.data || payload;
  const displayName = String(
    user?.name ??
      user?.full_name ??
      user?.user_name ??
      user?.username ??
      user?.company_name ??
      user?.mobile_number ??
      ''
  ).trim();

  return displayName || null;
};

const getUpdatedByDisplayFromConfig = (config) => {
  const directName = String(
    config?.updated_by_name ??
      config?.updated_by_user?.name ??
      config?.updated_by_user?.full_name ??
      config?.updatedByName ??
      ''
  ).trim();

  return directName || null;
};

function Settings({ currentUser }) {
  const { id: routeUserId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const sessRoot = (location.pathname || '').split('/')[1] || 'admin';
  const billerUploadRoute = `/${sessRoot}/billavenue-billers-upload`;
  const isAdmin = String(currentUser?.role || '').toLowerCase() === 'admin';
  const [activeModal, setActiveModal] = useState(null);
  const [formData, setFormData] = useState({});
  const [generatedTpin, setGeneratedTpin] = useState('');
  const [roleModalMode, setRoleModalMode] = useState('create');
  const [serviceSettingsForm, setServiceSettingsForm] = useState({
    ...SERVICE_FLAG_DEFAULTS,
  });
  const [roleForm, setRoleForm] = useState({
    name: '',
    confirmName: '',
    description: '',
    status: 'active',
    permissions: [],
  });
  const [expandedRoleIds, setExpandedRoleIds] = useState({});
  const [passwordVisibility, setPasswordVisibility] = useState({
    currentPassword: false,
    newPassword: false,
    confirmPassword: false,
  });
  const [loginPopupForm, setLoginPopupForm] = useState({
    image: null,
  });
  const [loginPopupPreviewUrl, setLoginPopupPreviewUrl] = useState('');

  const selectedUserId = routeUserId || currentUser.id;
  const isEditingOtherUser = Number(selectedUserId) !== Number(currentUser.id);

  const { data: userData, isLoading, error } = useQuery({
    queryKey: ['user', selectedUserId],
    queryFn: () => userDetail(selectedUserId),
  });

  const { data: accessRoleMeta } = useQuery({
    queryKey: ['employee-access-role-meta'],
    queryFn: fetchEmployeeAccessRoleMeta,
    enabled: isAdmin,
  });

  const { data: accessRolesData, isLoading: isAccessRolesLoading } = useQuery({
    queryKey: ['employee-access-roles'],
    queryFn: fetchEmployeeAccessRoles,
    enabled: isAdmin,
  });

  const {
    data: serviceSettingsData,
    isLoading: isServiceSettingsLoading,
    error: serviceSettingsError,
    refetch: refetchServiceSettings,
  } = useQuery({
    queryKey: ['admin-service-settings'],
    queryFn: fetchServiceSettings,
    enabled: isAdmin,
  });

  useServiceSettingsPolling(isAdmin);

  const serviceUpdaterIds = useMemo(() => {
    if (!isAdmin || !serviceSettingsData) return [];

    const ids = SERVICE_FLAG_CONFIG.map((service) => {
      const config = serviceSettingsData?.[service.key];
      if (getUpdatedByDisplayFromConfig(config)) return null;

      const updatedBy = config?.updated_by;
      const numericUpdatedBy = Number(updatedBy);
      return Number.isFinite(numericUpdatedBy) ? numericUpdatedBy : null;
    }).filter((id) => id !== null);

    return Array.from(new Set(ids));
  }, [isAdmin, serviceSettingsData]);

  const { data: serviceUpdaterNameMap = {} } = useQuery({
    queryKey: ['service-setting-updater-names', serviceUpdaterIds],
    enabled: isAdmin && serviceUpdaterIds.length > 0,
    staleTime: 1000 * 60 * 5,
    queryFn: async () => {
      const entries = await Promise.all(
        serviceUpdaterIds.map(async (id) => {
          try {
            const response = await userDetail(id);
            return [String(id), getUserDisplayName(response) || String(id)];
          } catch {
            return [String(id), String(id)];
          }
        })
      );

      return Object.fromEntries(entries);
    },
  });

  const {
    data: adminLoginPopups = [],
    isLoading: isAdminLoginPopupsLoading,
    error: adminLoginPopupsError,
    refetch: refetchAdminLoginPopups,
  } = useQuery({
    queryKey: ['admin-login-popups'],
    queryFn: fetchAdminLoginPopups,
    enabled: isAdmin,
  });

  const accessRolePermissions = useMemo(() => {
    const extractCatalog = (meta) => {
      if (!meta) return [];
      const candidates = [
        meta.permissions,
        meta.permissionCatalog,
        meta.permission_catalog,
        meta.catalog,
        meta.data?.permissions,
        meta.data?.permissionCatalog,
        meta.data?.permission_catalog,
        meta.data?.catalog,
        meta.data?.permission_catalog?.permissions,
        meta.data?.permissionCatalog?.permissions,
      ];

      for (const candidate of candidates) {
        if (Array.isArray(candidate) && candidate.length) {
          return candidate;
        }
      }

      return [];
    };

    const raw = extractCatalog(accessRoleMeta);

    if (Array.isArray(raw) && raw.length > 0) {
      if (raw[0]?.module && Array.isArray(raw[0]?.permissions)) {
        return raw.flatMap((group) =>
          (group.permissions || []).map((item) => {
            const slug = item.slug || item.value || item.permission || item.code || '';
            if (!slug) return null;
            return {
              slug,
              label:
                item.label ||
                item.name ||
                slug
                  .split('.')
                  .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
                  .join(' '),
              description: item.description || null,
              category: group.label || group.module || (slug ? slug.split('.')[0] : 'general'),
            };
          })
        ).filter(Boolean);
      }

      if (typeof raw[0] === 'string') {
        return raw.map((slug) => ({
          slug,
          label: slug
            .split('.')
            .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
            .join(' '),
          description: null,
          category: slug.split('.')[0] || 'general',
        }));
      }

      if (typeof raw[0] === 'object') {
        return raw
          .map((item) => {
            const slug = item.slug || item.value || item.permission || item.code || '';
            if (!slug) return null;
            return {
              slug,
              label:
                item.label ||
                item.name ||
                slug
                  .split('.')
                  .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
                  .join(' '),
              description: item.description || null,
              category: item.category || item.group || (slug ? slug.split('.')[0] : 'general'),
            };
          })
          .filter(Boolean);
      }
    }

    return [];
  }, [accessRoleMeta]);

  const accessRoleStatusOptions = useMemo(() => {
    const raw =
      accessRoleMeta?.statuses ||
      accessRoleMeta?.data?.statuses ||
      accessRoleMeta?.data?.allowedStatuses ||
      accessRoleMeta?.allowedStatuses ||
      ['active', 'inactive'];
    return Array.isArray(raw) && raw.length ? raw : ['active', 'inactive'];
  }, [accessRoleMeta]);

  const accessRoles = useMemo(() => {
    const raw =
      accessRolesData?.data?.rows ||
      accessRolesData?.rows ||
      accessRolesData?.data ||
      accessRolesData?.roles ||
      accessRolesData ||
      [];
    return Array.isArray(raw) ? raw : [];
  }, [accessRolesData]);

  const availablePermissionModules = useMemo(() => {
    const availableSlugs = new Set(accessRolePermissions.map((permission) => permission.slug));
    if (availableSlugs.size === 0) return EMPLOYEE_PERMISSION_MODULES;
    return EMPLOYEE_PERMISSION_MODULES.filter(
      (module) =>
        module.permissions.every((permission) => availableSlugs.has(permission)) ||
        (module.key === 'pos-settlement' && module.permissions.some((permission) => availableSlugs.has(permission))) ||
        module.permissions.some((p) => String(p).startsWith('set_limit'))
    );
  }, [accessRolePermissions]);

  const permissionModulesBySection = useMemo(() => {
    return availablePermissionModules.reduce((acc, module) => {
      const section = module.section || 'Other';
      if (!acc[section]) {
        acc[section] = [];
      }
      acc[section].push(module);
      return acc;
    }, {});
  }, [availablePermissionModules]);

  const selectedRoleModuleKeys = useMemo(
    () => new Set(getSelectedPermissionModules(roleForm.permissions).map((module) => module.key)),
    [roleForm.permissions]
  );

  useEffect(() => {
    if (!isAdmin || !serviceSettingsData) return;
    setServiceSettingsForm(normalizeServiceFlags(serviceSettingsData, true));
  }, [isAdmin, serviceSettingsData]);

  useEffect(() => {
    return () => {
      if (loginPopupPreviewUrl) {
        URL.revokeObjectURL(loginPopupPreviewUrl);
      }
    };
  }, [loginPopupPreviewUrl]);

  // Mutation for generating T-PIN
  const generateTpinMutation = useMutation({
    mutationFn: ({ tpin } = {}) => generateTpin({ tpin }),
    onSuccess: (data) => {
      toast.success('T-PIN generated successfully!');
      const tpinValue = data?.tpin || '';
      setGeneratedTpin(tpinValue);
      if (tpinValue) {
        sessionStorage.setItem('generated_tpin', tpinValue);
      }
      queryClient.invalidateQueries(['user', selectedUserId]);
      setActiveModal(null);
      setFormData((prev) => ({ ...prev, tpin: '' }));
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to generate T-PIN');
    },
  });

  // Mutation for verifying T-PIN
  const verifyTpinMutation = useMutation({
    mutationFn: ({ tpin } = {}) => verifyTPin({ tpin }),
    onSuccess: () => {
      toast.success('T-PIN verified successfully!');
      queryClient.invalidateQueries(['user', selectedUserId]);
      setActiveModal(null);
      setFormData((prev) => ({ ...prev, tpin: '' }));
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to verify T-PIN');
    },
  });

  // Mutation for updating password
  const updatePasswordMutation = useMutation({
    mutationFn: ({ id, currentPassword, newPassword }) =>
      updatePassword({ id, currentPassword, newPassword }),
    onSuccess: () => {
      toast.success('Password updated successfully!');
      queryClient.invalidateQueries(['user', selectedUserId]);
      setActiveModal(null);
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to update password');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => updateUserProfile({ id, data }),
    onSuccess: () => {
      toast.success('Profile updated successfully!');
      queryClient.invalidateQueries(['user', selectedUserId]);
      setActiveModal(null);
    },
    onError: (err) => {
      toast.error(err.message || 'Update failed');
    },
  });

  const updateSlabMutation = useMutation({
    mutationFn: ({ id, data }) => updateChargeSlab(id, data),
    onSuccess: () => {
      toast.success('Charge slab updated successfully!');
      queryClient.invalidateQueries(['user', selectedUserId]);
      setActiveModal(null);
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to update charge slab');
    },
  });

  const createAccessRoleMutation = useMutation({
    mutationFn: (payload) => createEmployeeAccessRole(payload),
    onSuccess: () => {
      toast.success('Access role created successfully!');
      queryClient.invalidateQueries(['employee-access-roles']);
      setActiveModal(null);
      setRoleForm({
        name: '',
        confirmName: '',
        description: '',
        status: 'active',
        permissions: [],
      });
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to create access role');
    },
  });

  const updateAccessRoleMutation = useMutation({
    mutationFn: ({ id, payload }) => updateEmployeeAccessRole({ id, payload }),
    onSuccess: () => {
      toast.success('Access role updated successfully!');
      queryClient.invalidateQueries(['employee-access-roles']);
      setActiveModal(null);
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to update access role');
    },
  });

  const updateServiceSettingsMutation = useMutation({
    mutationFn: (payload) => updateServiceSettings(payload),
    onSuccess: (data) => {
      toast.success('Service settings updated successfully!');
      setServiceSettingsForm(normalizeServiceFlags(data, true));
      queryClient.invalidateQueries(['admin-service-settings']);
      queryClient.invalidateQueries(['currentUser']);
      setActiveModal(null);
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to update service settings');
    },
  });

  const uploadLoginPopupMutation = useMutation({
    mutationFn: uploadLoginPopup,
    onSuccess: () => {
      toast.success('Popup uploaded successfully!');
      queryClient.invalidateQueries({ queryKey: ['admin-login-popups'] });
      setActiveModal(null);
      setLoginPopupForm({ image: null });
      setLoginPopupPreviewUrl((currentPreview) => {
        if (currentPreview) {
          URL.revokeObjectURL(currentPreview);
        }
        return '';
      });
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to upload popup');
    },
  });

  const deleteLoginPopupMutation = useMutation({
    mutationFn: deleteLoginPopup,
    onSuccess: () => {
      toast.success('Popup deleted successfully!');
      queryClient.invalidateQueries({ queryKey: ['admin-login-popups'] });
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to delete popup');
    },
  });

  const currentPasswordInput = String(formData.currentPassword || '');
  const newPasswordInput = String(formData.newPassword || '');
  const confirmPasswordInput = String(formData.confirmPassword || '');
  const isPasswordMismatch =
    confirmPasswordInput.length > 0 && newPasswordInput !== confirmPasswordInput;
  const isPasswordFormComplete =
    currentPasswordInput.trim() &&
    newPasswordInput.trim() &&
    confirmPasswordInput.trim();
  const canSavePassword =
    Boolean(isPasswordFormComplete) &&
    !isPasswordMismatch &&
    !updatePasswordMutation.isPending;

  const resetLoginPopupForm = () => {
    setLoginPopupForm({ image: null });
    setLoginPopupPreviewUrl((currentPreview) => {
      if (currentPreview) {
        URL.revokeObjectURL(currentPreview);
      }
      return '';
    });
  };

  const closeAddLoginPopupModal = () => {
    resetLoginPopupForm();
    setActiveModal(null);
  };

  const togglePasswordVisibility = (field) => {
    setPasswordVisibility((prev) => ({
      ...prev,
      [field]: !prev[field],
    }));
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="flex items-center gap-2 text-gray-600">
          <Loader2 className="animate-spin h-8 w-8" />
          <span>Loading your details...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="bg-red-50 p-4 rounded-lg text-red-600">Error: {error.message}</div>
      </div>
    );
  }

  const user = userData?.user || {};

  const ipayOutletId =
    user?.ipay_outlet_id ??
    user?.ipayOutletId ??
    user?.outletId ??
    user?.outlet_id ??
    null;

  const kycDone =
    user?.isKycDone ??
    user?.kycDone ??
    user?.kyc_done ??
    false;

  const isKycVerified = Boolean(kycDone || (ipayOutletId !== null && `${ipayOutletId}`.trim() !== ''));
  const kycStatusLabel = isKycVerified
    ? `Verified (${ipayOutletId !== null ? `#${ipayOutletId}` : 'Yes'})`
    : 'Not Verified';

  const kycRoute = isAdmin && isEditingOtherUser
    ? `/${String(user?.role || '').toLowerCase()}/kyc`
    : `/${sessRoot}/kyc`;

  const canResetKyc =
    (isAdmin && isEditingOtherUser && ['merchant', 'franchise'].includes(String(user?.role || '').toLowerCase())) ||
    (!isAdmin || !isEditingOtherUser);

  const handleGotoKyc = () => {
    if (!canResetKyc) {
      toast.info('Please use the merchant/franchise settings page to reset KYC.');
      return;
    }
    navigate(kycRoute);
  };

  const handleChange = (e) => {
    const { name, value, type, files } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'file' ? files[0] : value,
    }));
  };

  const handleSubmit = (e, section) => {
    e.preventDefault();
    if (section === 'chargeSlabs') {
      const slabId = formData.id;
      updateSlabMutation.mutate({ id: slabId, data: formData });
    } else if (section === 'tpin') {
      generateTpinMutation.mutate({ tpin: formData.tpin ? String(formData.tpin).trim() : undefined });
    } else if (section === 'verifyTpin') {
      const tpinToVerify = String(formData.tpin || '').trim();
      if (!tpinToVerify) {
        toast.error('Please provide TPIN to verify.');
        return;
      }
      verifyTpinMutation.mutate({ tpin: tpinToVerify });
    } else if (section === 'password') {
      const currentPassword = (formData.currentPassword || '').trim();
      const newPassword = (formData.newPassword || '').trim();
      const confirmPassword = (formData.confirmPassword || '').trim();

      if (!currentPassword || !newPassword || !confirmPassword) {
        toast.error('Old password, new password, and confirm password are required.');
        return;
      }

      if (newPassword !== confirmPassword) {
        toast.error('New password and confirm password do not match.');
        return;
      }

      if (currentPassword === newPassword) {
        toast.error('New password must be different from old password.');
        return;
      }

      updatePasswordMutation.mutate({ id: selectedUserId, currentPassword, newPassword });
    } else {
      updateMutation.mutate({ id: selectedUserId, data: formData });
    }
  };

  const openModal = (section, data = {}) => {
    if (section === 'serviceSettings') {
      setServiceSettingsForm(normalizeServiceFlags(serviceSettingsData, true));
    } else if (section === 'addLoginPopup') {
      resetLoginPopupForm();
    } else if (section === 'password') {
      setFormData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
      setPasswordVisibility({
        currentPassword: false,
        newPassword: false,
        confirmPassword: false,
      });
    } else {
      setFormData(data);
    }
    setActiveModal(section);
  };

  const handleLoginPopupFileChange = (event) => {
    const file = event.target.files?.[0] || null;

    setLoginPopupForm({
      image: file,
    });

    setLoginPopupPreviewUrl((currentPreview) => {
      if (currentPreview) {
        URL.revokeObjectURL(currentPreview);
      }
      return file ? URL.createObjectURL(file) : '';
    });
  };

  const handleLoginPopupSubmit = (event) => {
    event.preventDefault();

    if (!loginPopupForm.image) {
      toast.error('Please select an image to upload.');
      return;
    }

    uploadLoginPopupMutation.mutate({
      image: loginPopupForm.image,
    });
  };

  const handleDeleteLoginPopup = (popupId) => {
    if (!window.confirm('Delete this popup image?')) {
      return;
    }

    deleteLoginPopupMutation.mutate(popupId);
  };

  const handleServiceSettingToggle = (serviceKey) => {
    setServiceSettingsForm((prev) => ({
      ...prev,
      [serviceKey]: !prev[serviceKey],
    }));
  };

  const handleServiceSettingsSubmit = (event) => {
    event.preventDefault();
    if (typeof serviceSettingsForm.pos_t0_settlement === 'boolean') {
      const prevVal = Boolean(serviceSettingsData?.pos_t0_settlement?.is_enabled ?? serviceSettingsData?.pos_t0_settlement ?? true);
      const newVal = Boolean(serviceSettingsForm.pos_t0_settlement);
      if (prevVal !== newVal) {
        recordLimitAuditLog({
          performingUser: currentUser,
          affectedUser: null,
          previousState: prevVal ? "ENABLED (Dynamic Mode)" : "DISABLED (Static DB Mode)",
          newState: newVal ? "ENABLED (Dynamic Mode)" : "DISABLED (Static DB Mode)",
          action: "SERVICE_TOGGLE",
          serviceKey: "pos_t0_settlement",
        });
      }
    }
    updateServiceSettingsMutation.mutate({ ...serviceSettingsForm });
  };

  const openRoleModal = (mode, role = null) => {
    setRoleModalMode(mode);
    let rolePerms = normalizePermissions(role?.permissions);
    if (role?.id) {
      try {
        const storedCustom = localStorage.getItem(`role_custom_permissions_${role.id}`);
        if (storedCustom) {
          const list = JSON.parse(storedCustom);
          if (Array.isArray(list)) {
            rolePerms = normalizePermissions([...rolePerms, ...list]);
          }
        }
      } catch (e) {}
    }

    setRoleForm({
      id: role?.id ?? null,
      name: role?.name || '',
      confirmName: role?.name || '',
      description: role?.description || '',
      status: role?.status || 'active',
      permissions: rolePerms,
    });
    setActiveModal('accessRole');
  };

  const toggleRolePermissionModule = (moduleKey) => {
    const selectedModule = EMPLOYEE_PERMISSION_MODULES.find((module) => module.key === moduleKey);
    if (!selectedModule) return;

    setRoleForm((prev) => {
      const nextPermissions = new Set(prev.permissions || []);
      const isSelected = selectedModule.permissions.some((permission) =>
        nextPermissions.has(permission)
      );

      if (isSelected) {
        selectedModule.permissions.forEach((permission) => nextPermissions.delete(permission));
      } else {
        selectedModule.permissions.forEach((permission) => nextPermissions.add(permission));
      }

      return {
        ...prev,
        permissions: normalizePermissions(Array.from(nextPermissions)),
      };
    });
  };

  const toggleRolePermissionsView = (roleId) => {
    setExpandedRoleIds((prev) => ({
      ...prev,
      [roleId]: !prev[roleId],
    }));
  };

  const handleRoleSubmit = (event) => {
    event.preventDefault();
    const trimmedName = String(roleForm.name || '').trim();
    const trimmedConfirm = String(roleForm.confirmName || '').trim();

    if (!trimmedName) {
      toast.error('Role name is required.');
      return;
    }

    if (trimmedName !== trimmedConfirm) {
      toast.error('Role name confirmation does not match.');
      return;
    }

    const moduleKeys = Array.from(selectedRoleModuleKeys);
    const selectedPermissions = buildPermissionsFromModuleKeys(moduleKeys);
    const settlementPermissions = moduleKeys.includes('pos-settlement')
      ? ['settlement.read', 'settlement.manage']
      : [];

    const saveCustomRolePermissions = (roleId) => {
      if (roleId) {
        try {
          localStorage.setItem(`role_custom_permissions_${roleId}`, JSON.stringify(selectedPermissions));
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('employeeAccessRoleUpdated'));
          }
        } catch (e) {}
      }
    };

    const validBackendSlugs = new Set(accessRolePermissions.map((p) => p.slug));
    const backendPermissions = Array.from(new Set([
      ...selectedPermissions.filter(
        (p) => validBackendSlugs.size === 0 || validBackendSlugs.has(p)
      ),
      ...settlementPermissions,
    ]));

    const payload = {
      name: trimmedName,
      description: roleForm.description ? String(roleForm.description).trim() : undefined,
      status: roleForm.status || 'active',
      permissions: backendPermissions,
    };

    if (roleModalMode === 'edit' && roleForm.id) {
      saveCustomRolePermissions(roleForm.id);
      updateAccessRoleMutation.mutate({ id: roleForm.id, payload });
      return;
    }

    createAccessRoleMutation.mutate(payload, {
      onSuccess: (data) => {
        const newRoleId = data?.id || data?.data?.id || data?.role?.id;
        if (newRoleId) {
          saveCustomRolePermissions(newRoleId);
        }
      },
    });
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="mx-auto">
        <div className="mb-4 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end sm:gap-3">
          {isAdmin && (
            <>
              <button
                onClick={() => openModal('serviceSettings')}
                className="w-full sm:w-auto bg-primary rounded-lg px-3 py-2 text-sm sm:text-base font-medium text-white hover:opacity-70 whitespace-nowrap"
              >
                Service Controls
              </button>
              <button
                onClick={() => openRoleModal('create')}
                className="w-full sm:w-auto bg-primary rounded-lg px-3 py-2 text-sm sm:text-base font-medium text-white hover:opacity-70 whitespace-nowrap"
              >
                Add Role
              </button>
              <button
                onClick={() => openModal('viewRoles')}
                className="w-full sm:w-auto bg-primary rounded-lg px-3 py-2 text-sm sm:text-base font-medium text-white hover:opacity-70 whitespace-nowrap"
              >
                View Roles
              </button>
              <button
                onClick={() => openModal('addLoginPopup')}
                className="w-full sm:w-auto bg-primary rounded-lg px-3 py-2 text-sm sm:text-base font-medium text-white hover:opacity-70 whitespace-nowrap"
              >
                Add Popup
              </button>
              <button
                onClick={() => openModal('viewLoginPopups')}
                className="w-full sm:w-auto bg-primary rounded-lg px-3 py-2 text-sm sm:text-base font-medium text-white hover:opacity-70 whitespace-nowrap"
              >
                View Popups
              </button>
            </>
          )}
          <button
            onClick={() => openModal('password')}
            className="w-full sm:w-auto bg-primary rounded-lg px-3 py-2 text-sm sm:text-base font-medium text-white hover:opacity-70 whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isEditingOtherUser}
          >
            Update Password
          </button>
          <button
            onClick={() => openModal('tpin')}
            className="w-full sm:w-auto bg-primary rounded-lg px-3 py-2 text-sm sm:text-base font-medium text-white hover:opacity-70 whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isEditingOtherUser}
          >
            Generate T-PIN
          </button>
          <button
            onClick={() => openModal('verifyTpin')}
            className="col-span-2 sm:col-span-1 w-full sm:w-auto bg-primary rounded-lg px-3 py-2 text-sm sm:text-base font-medium text-white hover:opacity-70 whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isEditingOtherUser}
          >
            Verify T-PIN
          </button>
          {isAdmin && (
            <>
              {/* Upload BillAvenue Billers is temporarily hidden here. */}
              {/* <button
                onClick={() => navigate(billerUploadRoute)}
                className="col-span-2 sm:col-span-1 w-full sm:w-auto bg-cyan-600 rounded-lg px-3 py-2 text-sm sm:text-base font-medium text-white hover:opacity-70 whitespace-nowrap"
              >
                Upload BillAvenue Billers
              </button> */}
            </>
          )}
        </div>
        <div className="flex items-center justify-between mb-4 bg-white py-3 px-2 rounded-t-xl shadow-md">
          <div className="flex items-center justify-between w-full gap-4">
            <button
              onClick={() => navigate(-1)}
              className="p-2 rounded-full bg-indigo-100 text-indigo-600 hover:bg-indigo-200 transition"
            >
              <ArrowLeft size={24} />
            </button>
            <div>
              <h1 className="text-3xl font-bold text-primary">
                Profile <span className="text-black text-lg font-medium">({user.role})</span>
              </h1>
            </div>
            <p className="text-lg">
              <span className="font-semibold">Abheepay ID:</span> {user.abheepay_id}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-6">
            <Card title="Personal Information">
              <InfoField label="Name" value={user.name || 'N/A'} />
              <InfoField label="Email" value={user.email || 'N/A'} />
              <InfoField label="Mobile" value={` ${user.mobile_number || 'N/A'}`} />
              <InfoField label="Role" value={user.role || 'N/A'} />
              <InfoField label="Status" value={user.status || 'N/A'} badge />
              <InfoField label="Approved" value={user.is_approved ? 'Yes' : 'No'} badge />
              <InfoField label="POS Assigned" value={user.is_pos_asigned ? 'Yes' : 'No'} badge />
            </Card>

            <Card title="Documents">
              <ImageField label="Aadhar" number={user?.aadhar_number} url={user?.aadhar_number_url} />
              <ImageField label="PAN" number={user?.pan_number} url={user?.pan_number_url} />
              <ImageField label="Shop Photo" url={user?.shop_with_photo_url} />
            </Card>
          </div>

          <div className="lg:col-span-1 space-y-6">
            <Card title="Address Details">
              <InfoField label="Address Line 1" value={user.address1 || 'N/A'} />
              <InfoField label="Address Line 2" value={user.address2 || 'N/A'} />
              <InfoField label="City" value={user.city || 'N/A'} />
              <InfoField label="District" value={user.district || 'N/A'} />
              <InfoField label="State" value={user.state || 'N/A'} />
              <InfoField label="Pincode" value={user.pincode || 'N/A'} />
            </Card>

            <Card
              title="Additional Details"
              editable={isEditingOtherUser && String(currentUser?.role || '').toLowerCase() === 'admin'}
              onEdit={() => openModal('settlementType', { settlement_type: user.settlement_type || 'today_settlement' })}
            >
              <InfoField label="Wallet Balance" value={user.wallet || '0.00'} />
              <InfoField label="Abheepay ID" value={user.abheepay_id || 'N/A'} />
              <InfoField label="Date of Birth" value={user.dob ? new Date(user.dob).toLocaleDateString() : 'N/A'} />
              <InfoField label="Gender" value={user.gender || 'N/A'} />
              <InfoField label="Organization" value={user.organization_name || 'N/A'} />
              <InfoField label="Settlement Type" value={user.settlement_type || 'N/A'} />
              <InfoField label="Created At" value={new Date(user.createdAt).toLocaleString() || 'N/A'} />
              <InfoField label="Updated At" value={new Date(user.updatedAt).toLocaleString() || 'N/A'} />
            </Card>

            <Card title="Charge Slabs">
              {userData?.pos_rental_slabs && userData?.pos_rental_slabs?.length > 0 ? (
                <div className="space-y-2">
                  {userData?.pos_rental_slabs.map((slab, index) => (
                    <div key={index} className="p-3 bg-gray-50 rounded-md">
                      <p>Category: {slab.charge_type_category}</p>
                      <p>Min Amount: {slab.min_amount}</p>
                      <p>Max Amount: {slab.max_amount}</p>
                      <p>Flat Fee: {slab.flat_fee}</p>
                      <p>Percent Fee: {slab.percent_fee}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500">No charge slabs assigned yet.</p>
              )}
            </Card>
          </div>

          <div className="lg:col-span-1 space-y-6">
            <Card title="InstantPay / KYC">
              <InfoField label="KYC Status" value={kycStatusLabel} badge />
              <InfoField label="Outlet ID" value={ipayOutletId !== null ? String(ipayOutletId) : 'N/A'} />
              <div className="mt-4">
                <button
                  type="button"
                  onClick={handleGotoKyc}
                  className="w-full rounded-lg bg-primary text-white px-4 py-3 text-sm font-medium transition hover:opacity-90"
                >
                  {isKycVerified ? 'Re-initiate InstantPay KYC' : 'Start InstantPay KYC'}
                </button>
                <p className="mt-3 text-sm text-gray-500">
                  Use this setting to restart InstantPay onboarding and reset your InstantPay outlet ID if required.
                </p>
              </div>
            </Card>

            <Card title="T-PIN">
              <InfoField label="T-PIN Status" value={user.tpin ? 'Set' : 'Not Set'} badge />
            </Card>
          </div>
        </div>

        {/* Modals */}
        {activeModal === 'personal' && (
          <Modal title="Edit Personal Information" onClose={() => setActiveModal(null)}>
            <form onSubmit={(e) => handleSubmit(e, 'personal')} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name || ''}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email || ''}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Mobile Number</label>
                  <input
                    type="text"
                    name="mobile_number"
                    value={formData.mobile_number || ''}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">Gender</label>
                <div className="flex gap-4">
                  {['male', 'female', 'other'].map((g) => (
                    <label key={g} className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="gender"
                        value={g}
                        checked={formData.gender === g}
                        onChange={handleChange}
                      />
                      {g.charAt(0).toUpperCase() + g.slice(1)}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Date of Birth</label>
                <input
                  type="date"
                  name="dob"
                  value={formData.dob || ''}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="flex justify-end gap-4">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="px-4 py-2 bg-gray-200 rounded-lg"
                >
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg">
                  Save
                </button>
              </div>
            </form>
          </Modal>
        )}

        {activeModal === 'address' && (
          <Modal title="Edit Address Details" onClose={() => setActiveModal(null)}>
            <form onSubmit={(e) => handleSubmit(e, 'address')} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Address Line 1</label>
                  <input
                    type="text"
                    name="address1"
                    value={formData.address1 || ''}


                    onChange={handleChange}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Address Line 2</label>
                  <input
                    type="text"
                    name="address2"
                    value={formData.address2 || ''}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">City</label>
                  <input
                    type="text"
                    name="city"
                    value={formData.city || ''}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">District</label>
                  <input
                    type="text"
                    name="district"
                    value={formData.district || ''}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">State</label>
                  <input
                    type="text"
                    name="state"
                    value={formData.state || ''}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Pincode</label>
                  <input
                    type="text"
                    name="pincode"
                    value={formData.pincode || ''}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-4">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="px-4 py-2 bg-gray-200 rounded-lg"
                >
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg">
                  Save
                </button>
              </div>
            </form>
          </Modal>
        )}

        {activeModal === 'documents' && (
          <Modal title="Edit Documents" onClose={() => setActiveModal(null)}>
            <form onSubmit={(e) => handleSubmit(e, 'documents')} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Aadhar Card Number</label>
                  <input
                    type="text"
                    name="aadhar_number"
                    value={formData.aadhar_number || ''}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">PAN Card Number</label>
                  <input
                    type="text"
                    name="pan_number"
                    value={formData.pan_number || ''}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Aadhar Card Image</label>
                  <input
                    type="file"
                    name="aadhar_photo"
                    onChange={handleChange}
                    accept="image/*"
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">PAN Card Image</label>
                  <input
                    type="file"
                    name="pan_photo"
                    onChange={handleChange}
                    accept="image/*"
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Shop Photo URL</label>
                  <input
                    type="file"
                    name="shop_photo"
                    onChange={handleChange}
                    accept="image/*"
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-4">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="px-4 py-2 bg-gray-200 rounded-lg"
                >
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg">
                  Save
                </button>
              </div>
            </form>
          </Modal>
        )}

        {activeModal === 'tpin' && (
          <Modal title="Set / Generate T-PIN" onClose={() => setActiveModal(null)}>
            <form onSubmit={(e) => handleSubmit(e, 'tpin')} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">T-PIN (optional)</label>
                <input
                  type="text"
                  name="tpin"
                  value={formData.tpin || ''}
                  onChange={handleChange}
                  placeholder="Enter 6-digit TPIN or leave empty to auto-generate"
                  maxLength={6}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
                <p className="text-xs text-gray-500 mt-1">If empty, backend will create a random 6-digit T-PIN.</p>
              </div>

              {generatedTpin && (
                <div className="rounded-lg bg-green-50 border border-green-200 p-3">
                  <p className="text-sm text-green-700">Generated T-PIN: <span className="font-semibold tracking-widest">{generatedTpin}</span></p>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(generatedTpin);
                      toast.success('T-PIN copied to clipboard. Keep it safe.');
                    }}
                    className="mt-2 px-3 py-2 text-sm bg-green-600 text-white rounded-lg"
                  >
                    Copy TPIN
                  </button>
                </div>
              )}

              <div className="flex justify-end gap-4">
                <button type="button" onClick={() => setActiveModal(null)} className="px-4 py-2 bg-gray-200 rounded-lg">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg">Generate / Update</button>
              </div>
            </form>
          </Modal>
        )}

        {activeModal === 'verifyTpin' && (
          <Modal title="Verify T-PIN" onClose={() => setActiveModal(null)}>
            <form onSubmit={(e) => handleSubmit(e, 'verifyTpin')} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Enter T-PIN</label>
                <input
                  type="text"
                  name="tpin"
                  value={formData.tpin || ''}
                  onChange={handleChange}
                  placeholder="Enter your 6-digit T-PIN"
                  maxLength={6}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="flex justify-end gap-4">
                <button type="button" onClick={() => setActiveModal(null)} className="px-4 py-2 bg-gray-200 rounded-lg">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg">Verify</button>
              </div>
            </form>
          </Modal>
        )}

        {activeModal === 'serviceSettings' && isAdmin && (
          <Modal title="Service Controls" onClose={() => setActiveModal(null)} scrollable>
            {isServiceSettingsLoading ? (
              <div className="flex items-center justify-center gap-3 py-10 text-gray-600">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Loading service controls...</span>
              </div>
            ) : serviceSettingsError ? (
              <div className="space-y-4">
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {serviceSettingsError.message || 'Unable to load service settings.'}
                </div>
                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => refetchServiceSettings()}
                    className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Retry
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveModal(null)}
                    className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90"
                  >
                    Close
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleServiceSettingsSubmit} className="space-y-5">
                <div className="rounded-xl border border-cyan-100 bg-cyan-50 px-4 py-3 text-sm text-cyan-800">
                  These master switches control whether payout and bill-pay services are available
                  across merchant and franchise users. Changes apply to the sidebar and in-page
                  actions.
                </div>

                <div className="space-y-3">
                  {SERVICE_FLAG_CONFIG.filter((service) => service.key !== "user_daily_limit").map((service) => {
                    const currentConfig = serviceSettingsData?.[service.key];
                    const isEnabled = Boolean(serviceSettingsForm?.[service.key]);
                    const updatedAt = currentConfig?.updated_at
                      ? new Date(currentConfig.updated_at).toLocaleString()
                      : 'Not updated yet';
                    const directUpdatedByName = getUpdatedByDisplayFromConfig(currentConfig);
                    const updatedById = currentConfig?.updated_by;
                    const updatedBy =
                      directUpdatedByName ||
                      (updatedById !== null && updatedById !== undefined
                        ? serviceUpdaterNameMap[String(updatedById)] || String(updatedById)
                        : 'System default');

                    return (
                      <label
                        key={service.key}
                        className="flex cursor-pointer items-start gap-4 rounded-xl border border-gray-200 bg-white px-4 py-4 shadow-sm transition hover:border-[#00D3CD]/50"
                      >
                        <input
                          type="checkbox"
                          checked={isEnabled}
                          onChange={() => handleServiceSettingToggle(service.key)}
                          className="mt-1 h-4 w-4 rounded border-gray-300 text-[#00D3CD] focus:ring-[#00D3CD]"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <p className="text-sm font-semibold text-gray-900">{service.label}</p>
                              <p className="mt-1 text-sm text-gray-600">{service.description}</p>
                            </div>
                            <span
                              className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                                isEnabled
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-red-100 text-red-700'
                              }`}
                            >
                              {isEnabled ? 'Enabled' : 'Disabled'}
                            </span>
                          </div>
                          <p className="mt-2 text-xs text-gray-500">
                            Last update: {updatedAt} | Updated by: {updatedBy}
                          </p>
                        </div>
                      </label>
                    );
                  })}
                </div>

                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setActiveModal(null)}
                    className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={updateServiceSettingsMutation.isPending}
                    className="inline-flex items-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {updateServiceSettingsMutation.isPending && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Save Changes
                  </button>
                </div>
              </form>
            )}
          </Modal>
        )}

        {activeModal === 'addLoginPopup' && isAdmin && (
          <Modal title="Add Login Popup" onClose={closeAddLoginPopupModal}>
            <form onSubmit={handleLoginPopupSubmit} className="space-y-5">
              <div className="rounded-xl border border-cyan-100 bg-cyan-50 px-4 py-3 text-sm text-cyan-800">
                Upload an image that should appear once after login. If multiple active images are
                uploaded, they will be shown one by one.
              </div>

              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-700">Popup Image</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleLoginPopupFileChange}
                  className="block w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700"
                />
              </div>

              <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-4">
                {loginPopupPreviewUrl ? (
                  <div className="mx-auto aspect-square max-w-sm overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                    <img
                      src={loginPopupPreviewUrl}
                      alt="Login popup preview"
                      className="h-full w-full object-contain"
                    />
                  </div>
                ) : (
                  <div className="flex aspect-square max-w-sm items-center justify-center rounded-2xl border border-gray-200 bg-white text-sm text-gray-400">
                    Image preview will appear here
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={closeAddLoginPopupModal}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploadLoginPopupMutation.isPending || !loginPopupForm.image}
                  className="inline-flex items-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {uploadLoginPopupMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Add Popup
                </button>
              </div>
            </form>
          </Modal>
        )}

        {activeModal === 'viewLoginPopups' && isAdmin && (
          <Modal title="View Login Popups" onClose={() => setActiveModal(null)} wide scrollable>
            <div className="space-y-4">
              {isAdminLoginPopupsLoading ? (
                <div className="flex items-center justify-center gap-3 py-10 text-gray-600">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>Loading login popups...</span>
                </div>
              ) : adminLoginPopupsError ? (
                <div className="space-y-4">
                  <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {adminLoginPopupsError.message || 'Unable to load login popups.'}
                  </div>
                  <div className="flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => refetchAdminLoginPopups()}
                      className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      Retry
                    </button>
                    <button
                      type="button"
                      onClick={() => openModal('addLoginPopup')}
                      className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90"
                    >
                      Upload New
                    </button>
                  </div>
                </div>
              ) : adminLoginPopups.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-6 py-12 text-center">
                  <p className="text-sm text-gray-500">No popup images uploaded yet.</p>
                  <button
                    type="button"
                    onClick={() => openModal('addLoginPopup')}
                    className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90"
                  >
                    Upload First Popup
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between gap-4">
                    <p className="text-sm text-gray-500">
                      Active and inactive popup images are listed below.
                    </p>
                    <button
                      type="button"
                      onClick={() => openModal('addLoginPopup')}
                      className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90"
                    >
                      Upload New
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
                    {adminLoginPopups.map((popup) => (
                      <div
                        key={popup.id}
                        className="group overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm"
                      >
                        <div className="relative aspect-square overflow-hidden bg-gray-50">
                          <img
                            src={popup.image_url}
                            alt={popup.title || `Popup ${popup.id}`}
                            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
                          />
                          <button
                            type="button"
                            onClick={() => handleDeleteLoginPopup(popup.id)}
                            disabled={deleteLoginPopupMutation.isPending}
                            className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/95 text-rose-600 shadow-sm transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                            aria-label={`Delete popup ${popup.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                        <div className="space-y-1 px-3 py-3">
                          <p className="truncate text-sm font-semibold text-gray-900">
                            {popup.title || `Popup #${popup.id}`}
                          </p>
                          <p className="text-xs text-gray-500">
                            Order: {popup.display_order ?? '-'} | {popup.is_active ? 'Active' : 'Inactive'}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </Modal>
        )}

        {activeModal === 'accessRole' && (
          <Modal
            title={roleModalMode === 'edit' ? 'Edit Access Role' : 'Add Access Role'}
            onClose={() => setActiveModal(null)}
            wide
            scrollable
          >
            <form onSubmit={handleRoleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Role Name</label>
                  <input
                    type="text"
                    value={roleForm.name || ''}
                    onChange={(e) => setRoleForm((prev) => ({ ...prev, name: e.target.value }))}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                    placeholder="Accounts"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Confirm Name</label>
                  <input
                    type="text"
                    value={roleForm.confirmName || ''}
                    onChange={(e) => setRoleForm((prev) => ({ ...prev, confirmName: e.target.value }))}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                    placeholder="Re-enter role name"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                  <input
                    type="text"
                    value={roleForm.description || ''}
                    onChange={(e) => setRoleForm((prev) => ({ ...prev, description: e.target.value }))}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                    placeholder="Handles wallet and reports"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                  <select
                    value={roleForm.status || 'active'}
                    onChange={(e) => setRoleForm((prev) => ({ ...prev, status: e.target.value }))}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                  >
                    {accessRoleStatusOptions.map((status) => (
                      <option key={status} value={status}>
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-gray-800">Allow Permissions</p>
                <span className="text-xs text-gray-500">
                  {selectedRoleModuleKeys.size || 0} selected
                </span>
              </div>

              {availablePermissionModules.length === 0 ? (
                <div className="text-sm text-gray-500">No permission catalog available.</div>
              ) : (
                <div className="space-y-4">
                  {Object.entries(permissionModulesBySection).map(([section, modules]) => (
                    <div key={section} className="rounded-lg border border-gray-200 p-3">
                      <p className="text-sm font-semibold text-gray-700">{section}</p>
                      <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                        {modules.map((module) => (
                          <label
                            key={module.key}
                            className={`flex items-start gap-3 rounded-lg border px-3 py-2 cursor-pointer transition ${
                              selectedRoleModuleKeys.has(module.key)
                                ? 'border-indigo-400 bg-indigo-50'
                                : 'border-gray-200 hover:border-indigo-200'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={selectedRoleModuleKeys.has(module.key)}
                              onChange={() => toggleRolePermissionModule(module.key)}
                              className="mt-1"
                            />
                            <div>
                              <p className="text-sm font-medium text-gray-900">{module.label}</p>
                              {module.description && (
                                <p className="text-xs text-gray-500">{module.description}</p>
                              )}
                              <p className="text-[11px] text-gray-400 mt-1">
                                {module.permissions.join(', ')}
                              </p>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex justify-end gap-4">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="px-4 py-2 bg-gray-200 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg disabled:opacity-60"
                  disabled={createAccessRoleMutation.isPending || updateAccessRoleMutation.isPending}
                >
                  {roleModalMode === 'edit' ? 'Update Role' : 'Add Role'}
                </button>
              </div>
            </form>
          </Modal>
        )}

        {activeModal === 'viewRoles' && (
          <Modal title="Employee Access Roles" onClose={() => setActiveModal(null)} wide scrollable>
            <div className="space-y-4">
              {isAccessRolesLoading ? (
                <div className="flex items-center gap-2 text-gray-600">
                  <Loader2 className="animate-spin h-5 w-5" />
                  <span>Loading roles...</span>
                </div>
              ) : accessRoles.length === 0 ? (
                <p className="text-sm text-gray-500">No access roles created yet.</p>
              ) : (
                accessRoles.map((role) => (
                  <div key={role.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-base font-semibold text-gray-900">{role.name || 'Untitled role'}</p>
                        <p className="text-xs text-gray-500 mt-1">Status: {role.status || 'active'}</p>
                        {role.description && (
                          <p className="text-sm text-gray-600 mt-2">{role.description}</p>
                        )}
                      </div>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <button
                          type="button"
                          onClick={() => toggleRolePermissionsView(role.id)}
                          className="px-3 py-2 text-sm border border-gray-200 rounded-lg hover:border-indigo-300"
                        >
                          {expandedRoleIds[role.id] ? 'Hide Permissions' : 'Show Permissions'}
                        </button>
                        <button
                          type="button"
                          onClick={() => openRoleModal('edit', role)}
                          className="px-3 py-2 text-sm bg-indigo-600 text-white rounded-lg"
                        >
                          Edit
                        </button>
                      </div>
                    </div>
                    {expandedRoleIds[role.id] && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {(role.permissions || []).length === 0 ? (
                          <span className="text-xs text-gray-500">No permissions assigned.</span>
                        ) : (
                          formatPermissionList(role.permissions)
                            .split(', ')
                            .filter(Boolean)
                            .map((perm) => (
                            <span
                              key={perm}
                              className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-700"
                            >
                              {perm}
                            </span>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </Modal>
        )}

        {activeModal === 'chargeSlabs' && (currentUser.role === 'admin' || currentUser.role === 'franchise') && (
          <Modal title="Edit Charge Slab" onClose={() => setActiveModal(null)}>
            <form onSubmit={(e) => handleSubmit(e, 'chargeSlabs')} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                  <input
                    type="text"
                    name="charge_type_category"
                    value={formData.charge_type_category || ''}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                    disabled
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Min Amount</label>
                  <input
                    type="number"
                    name="min_amount"
                    value={formData.min_amount || ''}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Max Amount</label>
                  <input
                    type="number"
                    name="max_amount"
                    value={formData.max_amount || ''}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Flat Fee</label>
                  <input
                    type="number"
                    name="flat_fee"
                    value={formData.flat_fee || ''}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Percent Fee</label>
                  <input
                    type="number"
                    name="percent_fee"
                    value={formData.percent_fee || ''}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-4">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="px-4 py-2 bg-gray-200 rounded-lg"
                >
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg">
                  Save
                </button>
              </div>
            </form>
          </Modal>
        )}

        {activeModal === 'tpin' && (
          <Modal title="Generate T-PIN" onClose={() => setActiveModal(null)}>
            <form onSubmit={(e) => handleSubmit(e, 'tpin')} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Enter T-PIN</label>
                <input
                  type="text"
                  name="tpin"
                  value={formData.tpin || ''}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                  maxLength="4"
                  pattern="\d{4}"
                  title="T-PIN must be a 4-digit number"
                  required
                />
              </div>
              <div className="flex justify-end gap-4">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="px-4 py-2 bg-gray-200 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg"
                  disabled={generateTpinMutation.isLoading}
                >
                  {generateTpinMutation.isLoading ? 'Generating...' : 'Generate'}
                </button>
              </div>
            </form>
          </Modal>
        )}

        {activeModal === 'verifyTpin' && (
          <Modal title="Verify T-PIN" onClose={() => setActiveModal(null)}>
            <form onSubmit={(e) => handleSubmit(e, 'verifyTpin')} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Enter T-PIN</label>
                <input
                  type="text"
                  name="tpin"
                  value={formData.tpin || ''}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                  maxLength="4"
                  pattern="\d{4}"
                  title="T-PIN must be a 4-digit number"
                  required
                />
              </div>
              <div className="flex justify-end gap-4">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="px-4 py-2 bg-gray-200 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg"
                  disabled={verifyTpinMutation.isLoading}
                >
                  {verifyTpinMutation.isLoading ? 'Verifying...' : 'Verify'}
                </button>
              </div>
            </form>
          </Modal>
        )}

        {activeModal === 'password' && (
          <Modal title="Update Password" onClose={() => setActiveModal(null)}>
            <form onSubmit={(e) => handleSubmit(e, 'password')} className="space-y-4" noValidate>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Old Password</label>
                    <div className="relative">
                      <LockKeyhole className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type={passwordVisibility.currentPassword ? 'text' : 'password'}
                        name="currentPassword"
                        value={formData.currentPassword || ''}
                        onChange={handleChange}
                        className="w-full pl-10 pr-10 py-2 border rounded-lg focus:ring-2 focus:ring-[#00D3CD] focus:border-[#00D3CD]"
                      />
                      <button
                        type="button"
                        onClick={() => togglePasswordVisibility('currentPassword')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {passwordVisibility.currentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">New Password</label>
                    <div className="relative">
                      <LockKeyhole className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type={passwordVisibility.newPassword ? 'text' : 'password'}
                        name="newPassword"
                        value={formData.newPassword || ''}
                        onChange={handleChange}
                        className="w-full pl-10 pr-10 py-2 border rounded-lg focus:ring-2 focus:ring-[#00D3CD] focus:border-[#00D3CD]"
                      />
                      <button
                        type="button"
                        onClick={() => togglePasswordVisibility('newPassword')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {passwordVisibility.newPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Confirm Password</label>
                    <div className="relative">
                      <LockKeyhole className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type={passwordVisibility.confirmPassword ? 'text' : 'password'}
                        name="confirmPassword"
                        value={formData.confirmPassword || ''}
                        onChange={handleChange}
                        className={`w-full pl-10 pr-10 py-2 border rounded-lg focus:ring-2 focus:ring-[#00D3CD] focus:border-[#00D3CD] ${isPasswordMismatch ? 'border-red-400 focus:ring-red-200 focus:border-red-400' : ''
                          }`}
                      />
                      <button
                        type="button"
                        onClick={() => togglePasswordVisibility('confirmPassword')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {passwordVisibility.confirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {isPasswordMismatch && (
                      <p className="text-xs text-red-600 mt-1">Password does not match.</p>
                    )}
                  </div>
                </div>

                <div className="rounded-lg border border-gray-100 bg-gray-50 p-3 h-fit">
                  <p className="text-xs font-semibold text-gray-700 mb-2">Password Rules</p>
                  <ul className="space-y-1 text-xs text-gray-600">
                    <li className={currentPasswordInput ? 'text-green-700' : ''}>Old password entered</li>
                    <li className={newPasswordInput ? 'text-green-700' : ''}>New password entered</li>
                    <li className={!isPasswordMismatch && confirmPasswordInput ? 'text-green-700' : ''}>
                      Confirm password matches
                    </li>
                  </ul>
                </div>
              </div>

              <div className="flex justify-end gap-4">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="px-4 py-2 bg-gray-200 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={!canSavePassword}
                >
                  {updatePasswordMutation.isPending ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </Modal>
        )}

        {activeModal === 'settlementType' && (
          <Modal title="Edit Settlement Type" onClose={() => setActiveModal(null)}>
            <form onSubmit={(e) => handleSubmit(e, 'settlementType')} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Settlement Type</label>
                <div className="space-y-2">
                  {[
                    { value: 'today_settlement', label: 'Today Settlement', description: 'POS earnings are available immediately.' },
                    { value: 'next_day_settlement', label: 'Next Day Settlement', description: 'POS earnings are held until 10:30 AM the next day.' },
                  ].map((option) => (
                    <label
                      key={option.value}
                      className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition ${
                        formData.settlement_type === option.value
                          ? 'border-indigo-500 bg-indigo-50'
                          : 'border-gray-200 hover:border-indigo-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name="settlement_type"
                        value={option.value}
                        checked={formData.settlement_type === option.value}
                        onChange={handleChange}
                        className="mt-0.5"
                      />
                      <div>
                        <p className="text-sm font-medium text-gray-900">{option.label}</p>
                        <p className="text-xs text-gray-500">{option.description}</p>
                      </div>
                    </label>
                  ))}
                </div>
                <p className="mt-2 text-xs text-gray-500">
                  Note: Changing this only affects future POS transactions. Existing holds are not affected.
                </p>
              </div>
              <div className="flex justify-end gap-4">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="px-4 py-2 bg-gray-200 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg disabled:opacity-50"
                  disabled={updateMutation.isPending}
                >
                  {updateMutation.isPending ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </Modal>
        )}
      </div>

      <ToastContainer
        position="top-right"
        autoClose={5000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="light"
      />
    </div>
  );
}


// Updated Card Component with Edit Button
const Card = ({ title, children, editable, onEdit }) => (
  <div className="bg-white rounded-xl shadow-md p-6">
    <div className="flex justify-between items-center mb-4 border-b pb-2">
      <h2 className="text-xl font-semibold text-gray-800">{title}</h2>
      {editable && (
        <button
          onClick={onEdit}
          className="text-indigo-500 hover:text-indigo-700 transition-colors duration-200"
        >
          <Edit size={18} />
        </button>
      )}
    </div>
    <div className="space-y-3">{children}</div>
  </div>
);

// Reusable Modal Component
const Modal = ({ title, children, onClose, wide = false, scrollable = false }) => (
  <div className="fixed inset-0 bg-gray-800 bg-opacity-75 flex items-center justify-center z-50">
    <div
      className={`bg-white p-6 rounded-xl shadow-lg w-full ${
        wide ? 'max-w-4xl' : 'max-w-2xl'
      } ${scrollable ? 'max-h-[80vh] overflow-y-auto' : ''}`}
    >
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
        <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
          <X size={24} />
        </button>
      </div>
      {children}
    </div>
  </div>
);

// Reusable Info Field Component
const InfoField = ({ label, value, badge }) => (
  <div className="flex justify-between items-center py-2">
    <span className="font-medium text-gray-700">{label}:</span>
    {badge ? (
      <span
        className={`px-2 py-1 rounded-full text-xs font-semibold ${value === "Yes" || value === "active" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
          }`}
      >
        {value}
      </span>
    ) : (
      <span className="text-gray-900">{value}</span>
    )}
  </div>
);

// Reusable Image Field Component
const ImageField = ({ label, number, url }) => (
  <div className="py-2">
    <span className="font-medium text-gray-700">{label}:</span>
    <div className="mt-1">
      {number && <p className="text-gray-900">{number}</p>}
      {url ? (
        <a href={url} target="_blank" rel="noopener noreferrer">
          <img
            src={url}
            alt={`${label} preview`}
            className="mt-2 w-full max-w-xs rounded-lg shadow-sm hover:shadow-md transition"
            onError={(e) => (e.target.src = "https://via.placeholder.com/150?text=Image+Not+Found")}
          />
        </a>
      ) : (
        <p className="text-gray-500">No image available</p>
      )}
    </div>
  </div>
);

export default Settings;
