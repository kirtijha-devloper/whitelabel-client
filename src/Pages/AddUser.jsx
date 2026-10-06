import { useEffect, useRef, useState } from 'react';
import { UserPlus, Mail, Lock, User, Briefcase, Phone, Loader2, X, Eye, EyeOff } from 'lucide-react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useUserCreation } from '../context/UserCreationContext';
import { createUser } from '../api/userCreateApi';
import { getAllPosMachines } from "../api/posMachine";
import { useQuery } from "@tanstack/react-query";
import Select from "react-select";
import { toast } from 'react-toastify';
import { updateUserProfile, userDetail } from '../api/authApi';
import { BASE_SITE_URL } from '../constants';
import { normalizePermissions } from '../utils/accessControl';
import { normalizeUserRole, maskEmailForUser } from '../utils/userAccess';
import { fetchEmployeeAccessRoles } from '../api/employeeAccessRoleApi';

const FILE_FIELDS = ['aadhar_photo', 'aadhar_back_photo', 'pan_photo', 'bank_passbook', 'shop_photo'];
const FILE_FIELD_CONFIG = [
  {
    name: 'aadhar_photo',
    label: 'Aadhar Card Image',
    urlKeys: ['aadhar_number_url', 'aadhar_photo_url'],
    accept: 'image/*',
  },
  {
    name: 'aadhar_back_photo',
    label: 'Aadhar Card Back Side Image',
    urlKeys: ['aadhar_back_number_url', 'aadhar_back_photo_url'],
    accept: 'image/*',
  },
  {
    name: 'pan_photo',
    label: 'PAN Card Image',
    urlKeys: ['pan_number_url', 'pan_photo_url'],
    accept: 'image/*',
  },
  {
    name: 'bank_passbook',
    label: 'Bank Passbook',
    urlKeys: ['bank_passbook_url'],
    accept: 'image/*,application/pdf',
  },
  {
    name: 'shop_photo',
    label: 'Shop Photo',
    urlKeys: ['shop_with_photo_url', 'shop_photo_url'],
    accept: 'image/*',
  },
];

const FILE_FALLBACK_SRC =
  'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2280%22 height=%2280%22 viewBox=%220 0 80 80%22%3E%3Crect width=%2280%22 height=%2280%22 fill=%22%23f3f4f6%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 dominant-baseline=%22middle%22 text-anchor=%22middle%22 fill=%22%236b7280%22 font-family=%22Arial,sans-serif%22 font-size=%2210%22%3ENo Image%3C/text%3E%3C/svg%3E';

const PASSWORD_LENGTH = 8;
const PASSWORD_LOWERCASE = "abcdefghijklmnopqrstuvwxyz";
const PASSWORD_UPPERCASE = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const PASSWORD_DIGITS = "0123456789";
const PASSWORD_SPECIAL = "!@#$%^&*";

const getRandomIndex = (max) => {
  if (typeof window !== "undefined" && window.crypto?.getRandomValues) {
    const randomBuffer = new Uint32Array(1);
    window.crypto.getRandomValues(randomBuffer);
    return randomBuffer[0] % max;
  }
  return Math.floor(Math.random() * max);
};

const pickRandomChar = (characters) => characters[getRandomIndex(characters.length)];

const generateStrongPassword = () => {
  const combinedChars = `${PASSWORD_LOWERCASE}${PASSWORD_UPPERCASE}${PASSWORD_DIGITS}${PASSWORD_SPECIAL}`;
  const passwordChars = [
    pickRandomChar(PASSWORD_LOWERCASE),
    pickRandomChar(PASSWORD_UPPERCASE),
    pickRandomChar(PASSWORD_DIGITS),
    pickRandomChar(PASSWORD_SPECIAL),
  ];

  while (passwordChars.length < PASSWORD_LENGTH) {
    passwordChars.push(pickRandomChar(combinedChars));
  }

  for (let i = passwordChars.length - 1; i > 0; i -= 1) {
    const j = getRandomIndex(i + 1);
    [passwordChars[i], passwordChars[j]] = [passwordChars[j], passwordChars[i]];
  }

  return passwordChars.join("");
};

const resolveImageUrl = (rawUrl) => {
  if (!rawUrl) return null;
  const value = String(rawUrl).trim();

  if (/^https?:\/\//i.test(value)) return value;
  if (/^https\/\//i.test(value)) return value.replace(/^https\/\//i, 'https://');
  if (/^http\/\//i.test(value)) return value.replace(/^http\/\//i, 'http://');
  if (value.startsWith('//')) return `https:${value}`;
  if (/^[\w-]+(\.[\w-]+)+\//.test(value)) return `https://${value}`;

  const base = String(BASE_SITE_URL || '').replace(/\/+$/, '');
  const path = value.startsWith('/') ? value : `/${value}`;
  return `${base}${path}`;
};

const sanitizeAadhaarNumber = (value = '') => String(value).replace(/\D/g, '').slice(0, 12);

const sanitizePanNumber = (value = '') => {
  const normalizedValue = String(value).toUpperCase().replace(/[^A-Z0-9]/g, '');
  let nextValue = '';

  for (const character of normalizedValue) {
    const currentIndex = nextValue.length;

    if (currentIndex < 5) {
      if (/[A-Z]/.test(character)) {
        nextValue += character;
      }
      continue;
    }

    if (currentIndex < 9) {
      if (/[0-9]/.test(character)) {
        nextValue += character;
      }
      continue;
    }

    if (currentIndex === 9 && /[A-Z]/.test(character)) {
      nextValue += character;
    }

    if (nextValue.length === 10) {
      break;
    }
  }

  return nextValue;
};

const isValidAadhaarNumber = (value = '') => /^\d{12}$/.test(value);
const isValidPanNumber = (value = '') => /^[A-Z]{5}\d{4}[A-Z]$/.test(value);

const getAadhaarValidationMessage = (value = '') => {
  if (!value) return '';
  return isValidAadhaarNumber(value) ? '' : 'Aadhaar number must contain exactly 12 digits.';
};

const getPanValidationMessage = (value = '') => {
  if (!value) return '';
  return isValidPanNumber(value) ? '' : 'PAN must be 5 letters, 4 digits, and 1 letter.';
};

const EDITABLE_UPDATE_FIELDS = [
  'name',
  'email',
  'mobile_number',
  'mobile_number_country_code',
  'gender',
  'dob',
  'address1',
  'address2',
  'city',
  'district',
  'pincode',
  'state',
  'country',
  'aadhar_number',
  'pan_number',
  'company_or_shop_name',
  'settlement_type',
  'aadhar_photo',
  'aadhar_back_photo',
  'pan_photo',
  'bank_passbook',
  'shop_photo',
];

function AddUser({ currentUser }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { id: routeUserId } = useParams();
  const { state, dispatch } = useUserCreation();
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedMachines, setSelectedMachines] = useState([]);
  const [showPassword, setShowPassword] = useState(false);
  const normalizedRole = String(currentUser?.role || "").trim().toLowerCase();
  const isActualAdminUser = normalizedRole === "admin" || normalizedRole === "super_admin";
  const isAdminArea = location.pathname.startsWith("/admin/") || location.pathname.startsWith("/super-admin/");
  const isFranchiseUser = normalizedRole === "franchise" || location.pathname.startsWith("/franchise/");
  const isSuperFranchiseUser = normalizedRole === "super_franchise" || location.pathname.startsWith("super-frenchise");
  const parsedEditUserId = Number(routeUserId);
  const isEditMode = Boolean(routeUserId) && location.pathname.endsWith("/edit") && isAdminArea;
  const isRoleSelectionDisabled = isFranchiseUser || isEditMode ;
  const showPosAssignment = !isEditMode;
  const hasInitializedCreateForm = useRef(false);
  const normalizedSelectedRole = normalizeUserRole(state.formData.role);
  const isEmployeeRole = normalizedSelectedRole === "employee";
  const selectedPermissions = normalizePermissions(state.formData.permissions);

  const {
    data: employeeAccessRoles = [],
    isLoading: employeeAccessRolesLoading,
  } = useQuery({
    queryKey: ['employee-access-roles'],
    queryFn: fetchEmployeeAccessRoles,
    enabled: isActualAdminUser,
    select: (response) => {
      const payload = response?.data || response?.rows || response || [];
      return Array.isArray(payload) ? payload : [];
    },
  });

  const {
    data: posMachines = [],
    isLoading: posMachinesLoading,
    isError: isPosMachineError,
  } = useQuery({
    queryKey: ["posMachines", searchTerm],
    queryFn: () => getAllPosMachines(searchTerm),
    staleTime: 1000 * 60 * 5,
    select: (res) => (Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : []),
    enabled: showPosAssignment && !isEmployeeRole,
  });

  const {
    data: editableUserResponse,
    isLoading: editableUserLoading,
    error: editableUserError,
  } = useQuery({
    queryKey: ["editable-user", parsedEditUserId],
    queryFn: () => userDetail(parsedEditUserId),
    enabled: isEditMode && Number.isFinite(parsedEditUserId),
  });

  const handleSearchChange = (inputValue) => {
    setSearchTerm(inputValue);
  };

  const formatDateInput = (value) => {
    if (!value) return '';
    const parsedDate = new Date(value);
    if (Number.isNaN(parsedDate.getTime())) {
      return String(value).split('T')[0];
    }
    return parsedDate.toISOString().split('T')[0];
  };

  useEffect(() => {
    if (!isEditMode) return;
    dispatch({ type: "RESET" });
    setSelectedMachines([]);
  }, [dispatch, isEditMode]);

  useEffect(() => {
    const isCreateRoute = location.pathname.endsWith("/create-user");
    if (!isCreateRoute || isEditMode) return;
    if (hasInitializedCreateForm.current) return;

    const generatedPassword = generateStrongPassword();
    dispatch({ type: "RESET" });
    dispatch({
      type: "UPDATE_FORM",
      payload: { password: generatedPassword },
    });
    setSelectedMachines([]);
    setShowPassword(false);
    hasInitializedCreateForm.current = true;
  }, [dispatch, isEditMode, location.pathname]);

  useEffect(() => {
    if (!location.pathname.endsWith("/create-user")) {
      hasInitializedCreateForm.current = false;
    }
  }, [location.pathname]);

  useEffect(() => {
    if (!isEditMode) return;

    const storedUser = (() => {
      try {
        const raw = localStorage.getItem("selectedUser");
        const parsed = raw ? JSON.parse(raw) : null;
        return String(parsed?.id) === String(routeUserId) ? parsed : null;
      } catch {
        return null;
      }
    })();

    const user = editableUserResponse?.user || editableUserResponse?.data || storedUser;
    if (!user) return;
    dispatch({
      type: "UPDATE_FORM",
      payload: {
        name: user.name || '',
        email: maskEmailForUser(user.email, currentUser) || '',
        password: '',
        mobile_number: normalizedRole === 'employee' ? '' : (user.mobile_number || ''),
        mobile_number_country_code: user.mobile_number_country_code || user.country_code || '+91',
        role: normalizeUserRole(user.role || 'merchant'),
        permissions: normalizePermissions(user.permissions),
        address1: user.address1 || '',
        address2: user.address2 || '',
        city: user.city || '',
        district: user.district || '',
        pincode: user.pincode || '',
        state: user.state || '',
        country: user.country || '',
        aadhar_number: sanitizeAadhaarNumber(user.aadhar_number || ''),
        pan_number: sanitizePanNumber(user.pan_number || ''),
        company_or_shop_name: user.company_or_shop_name || user.organization_name || '',
        employee_access_role_id: user.employee_access_role_id || '',
        aadhar_photo: null,
        aadhar_back_photo: null,
        pan_photo: null,
        bank_passbook: null,
        shop_photo: null,
        settlement_type: user.settlement_type || 'today_settlement',
        gender: user.gender || '',
        dob: formatDateInput(user.dob),
      },
    });
  }, [dispatch, editableUserResponse, isEditMode, currentUser]);

  useEffect(() => {
    if (isFranchiseUser && !isEditMode && state.formData.role !== "merchant") {
      dispatch({
        type: "UPDATE_FORM",
        payload: { role: "merchant" },
      });
    }
  }, [dispatch, isEditMode, isFranchiseUser, state.formData.role]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    const sanitizedAadhaarNumber = sanitizeAadhaarNumber(state.formData.aadhar_number);
    const sanitizedPanNumber = sanitizePanNumber(state.formData.pan_number);

    if (sanitizedAadhaarNumber !== state.formData.aadhar_number) {
      dispatch({
        type: "UPDATE_FORM",
        payload: { aadhar_number: sanitizedAadhaarNumber },
      });
    }

    if (sanitizedPanNumber !== state.formData.pan_number) {
      dispatch({
        type: "UPDATE_FORM",
        payload: { pan_number: sanitizedPanNumber },
      });
    }

    if (!isEmployeeRole && !isValidAadhaarNumber(sanitizedAadhaarNumber)) {
      toast.error("Aadhaar number must contain exactly 12 digits.");
      return;
    }

    if (!isEmployeeRole && !isValidPanNumber(sanitizedPanNumber)) {
      toast.error("PAN number must be 5 letters, 4 digits, and 1 letter.");
      return;
    }

    if (isEmployeeRole && !state.formData.employee_access_role_id) {
      toast.error("Please select an employee access role.");
      return;
    }

    const submissionFormData = {
      ...state.formData,
      role: normalizeUserRole(state.formData.role),
      aadhar_number: sanitizedAadhaarNumber,
      pan_number: sanitizedPanNumber,
      permissions: selectedPermissions,
    };

    setLoading(true);

    try {
      if (isEditMode) {
        if (!Number.isFinite(parsedEditUserId)) {
          throw new Error("Invalid user id");
        }

        const payload = {};
        EDITABLE_UPDATE_FIELDS.forEach((key) => {
          const value = submissionFormData[key];
          if (FILE_FIELDS.includes(key)) {
            if (value instanceof File) {
              payload[key] = value;
            }
            return;
          }
          if (key === "email" && typeof value === "string" && value.includes("*")) {
            return;
          }
          if (value !== undefined && value !== null) {
            payload[key] = key === "dob" ? formatDateInput(value) : value;
          }
        });

        if (normalizeUserRole(submissionFormData.role) === "employee") {
          payload.role = "employee";
          payload.employee_access_role_id = submissionFormData.employee_access_role_id || '';
        }

        await updateUserProfile({ id: parsedEditUserId, data: payload });
        toast.success("User updated successfully!");
        dispatch({ type: "RESET" });
        navigate(`/admin/user/${parsedEditUserId}`);
        return;
      }

      if (!isEmployeeRole && !submissionFormData.bank_passbook && !getExistingFileUrl('bank_passbook')) {
        throw new Error('Bank passbook upload is required for merchant and franchise users.');
      }

      const formData = new FormData();
      Object.keys(submissionFormData).forEach((key) => {
        const value = submissionFormData[key];
        if (key === "permissions") {
          return;
        }
        if (FILE_FIELDS.includes(key)) {
          if (value instanceof File) {
            formData.append(key, value);
          }
          return;
        }
        if (value !== undefined && value !== null) {
          formData.append(key, value);
        }
      });

      if (normalizeUserRole(submissionFormData.role) === "employee") {
        if (submissionFormData.employee_access_role_id) {
          formData.append("employee_access_role_id", submissionFormData.employee_access_role_id);
        }
      } else {
        // Keep backend payload on POS machine id while showing serial number in UI.
        formData.append(
          "pos_machine_ids",
          JSON.stringify(selectedMachines.map((machine) => machine.posMachineId ?? machine.value))
        );
      }

      const response = await createUser(formData);
      const createdRoleLabel =
        normalizeUserRole(submissionFormData.role) === "employee"
          ? "Employee"
          : "User";
      const notificationSuccessMessages = [
        response?.sms?.sent ? response?.sms?.message : null,
        response?.email?.sent ? response?.email?.message : null,
      ].filter(Boolean);
      const notificationFailureMessages = [
        response?.sms?.sent === false ? response?.sms?.message : null,
        response?.email?.sent === false ? response?.email?.message : null,
      ].filter(Boolean);

      if (notificationSuccessMessages.length > 0) {
        toast.success(
          `${createdRoleLabel} created successfully. ${notificationSuccessMessages.join(" ")}`
        );
      } else {
        toast.success(response?.message || `${createdRoleLabel} created successfully!`);
      }

      if (notificationFailureMessages.length > 0) {
        toast.warn(notificationFailureMessages.join(" "));
      }

      const redirectUrl = isFranchiseUser
        ? "/franchise/list" : isSuperFranchiseUser ? "/super-franchise/franchise-list"
        : normalizeUserRole(submissionFormData.role) === "employee"
          ? "/admin/employee-list"
          : "/admin/list";
      dispatch({ type: "RESET" });
      setSelectedMachines([]);
      setSearchTerm("");
      navigate(redirectUrl);
    } catch (error) {
      toast.error(error.message || (isEditMode ? "User update failed" : "User creation failed"));
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, files } = e.target;
    let nextValue = type === 'file' ? files[0] : value;

    if (type !== 'file') {
      if (name === 'aadhar_number') {
        nextValue = sanitizeAadhaarNumber(value);
      }

      if (name === 'pan_number') {
        nextValue = sanitizePanNumber(value);
      }
    }

    const payload = { [name]: nextValue };

    if (name === "role") {
      const nextRole = normalizeUserRole(nextValue);
      payload.role = nextRole;
      if (nextRole === "employee") {
        payload.aadhar_number = "";
        payload.pan_number = "";
        payload.aadhar_photo = null;
        payload.aadhar_back_photo = null;
        payload.pan_photo = null;
        payload.bank_passbook = null;
        payload.shop_photo = null;
        payload.settlement_type = "today_settlement";
        payload.permissions = [];
        payload.employee_access_role_id = "";
        setSelectedMachines([]);
      } else if (normalizeUserRole(state.formData.role) === "employee") {
        payload.permissions = [];
        payload.employee_access_role_id = "";
      }
    }

    dispatch({
      type: 'UPDATE_FORM',
      payload,
    });
  };

  const aadharValidationMessage = getAadhaarValidationMessage(state.formData.aadhar_number);
  const panValidationMessage = getPanValidationMessage(state.formData.pan_number);
  const hasInvalidDocumentNumbers = Boolean(aadharValidationMessage || panValidationMessage);

  const getExistingFileUrl = (fieldName) => {
    const user = editableUserResponse?.user;
    if (!user || !isEditMode) return null;

    const fieldConfig = FILE_FIELD_CONFIG.find((item) => item.name === fieldName);
    if (!fieldConfig) return null;

    for (const key of fieldConfig.urlKeys) {
      const value = resolveImageUrl(user?.[key]);
      if (value) return value;
    }
    return null;
  };

  const selectOptions = posMachines
    .filter(machine => machine.assigned_to === null)
    .map((machine) => ({
      value: machine.id ?? machine.tid_number,
      posMachineId: machine.id ?? machine.tid_number,
      tidNumber: machine.tid_number,
      serialNumber: machine.device_serial_number,
      label: `${machine.status} (Serial No.: ${machine.device_serial_number || machine.tid_number || 'N/A'})`,
    }));

  const handleSelectChange = (selected) => {
    setSelectedMachines(selected || []);
  };

  const SelectedMachinesList = () => {
    if (selectedMachines.length === 0) return null;

    return (
      <div className="mt-4">
        <h3 className="text-sm font-medium text-gray-700 mb-2">Selected POS Machines:</h3>
        <div className="flex flex-wrap gap-2">
          {selectedMachines.map((machine) => (
            <div
              key={machine.value}
              className="bg-primary/10 text-primary px-3 py-1 rounded-full flex items-center gap-2"
            >
              <span>{machine.label}</span>
              <button
                type="button"
                onClick={() => {
                  setSelectedMachines(selectedMachines.filter(m => m.value !== machine.value));
                }}
                className="hover:text-primary/70"
              >
                <X size={16} />
              </button>
            </div>
          ))}
        </div>
      </div>
    );
  };

  if (isEditMode && editableUserLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex items-center gap-2 text-gray-600">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>Loading user details...</span>
        </div>
      </div>
    );
  }

  if (isEditMode && editableUserError) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="bg-red-50 p-4 rounded-lg text-red-600">
          {editableUserError.message || "Failed to load user details"}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="max-w-4xl mx-auto">
        <div className="flex gap-4 items-center mb-4">
          <div className="bg-primary text-white p-3 rounded-lg">
            <UserPlus size={20} />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">
            {isEditMode ? "Update User" : isFranchiseUser ? "Create New Merchant" : "Create New User"}
          </h1>
        </div>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="space-y-6">
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                  <Briefcase size={16} /> Role
                  {isEditMode && (
                    <span className="text-xs text-gray-500">(locked in update mode)</span>
                  )}
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="role"
                      value="merchant"
                      checked={state.formData.role === 'merchant'}
                      onChange={handleChange}
                      disabled={isRoleSelectionDisabled}
                    />
                    Merchant
                  </label>
                  {!isFranchiseUser && (
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="role"
                        value="franchise"
                        checked={state.formData.role === 'franchise'}
                        onChange={handleChange}
                        disabled={isRoleSelectionDisabled}
                      />
                      Franchise
                    </label>
                  )}
                  {isActualAdminUser && !isFranchiseUser && (
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="role"
                        value="super_franchise"
                        checked={state.formData.role === 'super_franchise'}
                        onChange={handleChange}
                        disabled={isRoleSelectionDisabled}
                      />
                      Super Franchise
                    </label>
                  )}
                  {isActualAdminUser && !isFranchiseUser && (
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="role"
                        value="employee"
                        checked={state.formData.role === 'employee'}
                        onChange={handleChange}
                        disabled={isRoleSelectionDisabled}
                      />
                      Employee
                    </label>
                  )}
                </div>
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                  <User size={16} /> Full Name
                </label>
                <input
                  type="text"
                  name="name"
                  value={state.formData.name}
                  onChange={handleChange}
                  required
                  placeholder="Enter full name"
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {!isEmployeeRole && (
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                    <Briefcase size={16} /> Company / Shop Name
                  </label>
                  <input
                    type="text"
                    name="company_or_shop_name"
                    value={state.formData.company_or_shop_name || ''}
                    onChange={handleChange}
                    placeholder="Enter company or shop name"
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              )}

              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                  <Mail size={16} /> Email Address
                </label>
                <input
                  type="email"
                  name="email"
                  value={state.formData.email}
                  onChange={handleChange}
                  required
                  placeholder="Enter email address"
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                  <Phone size={16} /> Mobile Number
                </label>
                <input
                  type="text"
                  pattern="^[6-9][0-9]{9}$"
                  name="mobile_number"
                  value={state.formData.mobile_number}
                  onChange={handleChange}
                  required
                  maxLength={10}
                  placeholder="Enter mobile number"
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                  Gender
                </label>
                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="gender"
                      value="male"
                      checked={state.formData.gender === 'male'}
                      onChange={handleChange}
                    />
                    Male
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="gender"
                      value="female"
                      checked={state.formData.gender === 'female'}
                      onChange={handleChange}
                    />
                    Female
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="gender"
                      value="other"
                      checked={state.formData.gender === 'other'}
                      onChange={handleChange}
                    />
                    Other
                  </label>
                </div>
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                  Date of Birth
                </label>
                <input
                  type="date"
                  name="dob"
                  value={state.formData.dob || ''}
                  onChange={handleChange}
                  required={!isEmployeeRole}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {isEmployeeRole && (
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                    Employee Access Role
                  </label>
                  <select
                    name="employee_access_role_id"
                    value={state.formData.employee_access_role_id || ''}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                    disabled={employeeAccessRolesLoading}
                  >
                    <option value="">Select access role</option>
                    {employeeAccessRoles.map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {!isEditMode && (
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                    <Lock size={16} /> Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      name="password"
                      value={state.formData.password}
                      onChange={handleChange}
                      required
                      placeholder="Auto-generated password"
                      className="w-full px-4 py-2 pr-11 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="absolute inset-y-0 right-0 inline-flex items-center px-3 text-gray-500 hover:text-gray-700"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-xl font-semibold mb-4">Address Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Address Line 1
                </label>
                <input
                  type="text"
                  name="address1"
                  value={state.formData.address1}
                  onChange={handleChange}
                  required={!isEmployeeRole}
                  placeholder="Enter Address Line 1"
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Address Line 2
                </label>
                <input
                  type="text"
                  name="address2"
                  value={state.formData.address2}
                  onChange={handleChange}
                  placeholder="Enter Address Line 2"
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  City
                </label>
                <input
                  type="text"
                  name="city"
                  value={state.formData.city}
                  onChange={handleChange}
                  required={!isEmployeeRole}
                  placeholder="Enter City"
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  District
                </label>
                <input
                  type="text"
                  name="district"
                  value={state.formData.district}
                  onChange={handleChange}
                  required={!isEmployeeRole}
                  placeholder="Enter District"
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Pincode
                </label>
                <input
                  type="text"
                  name="pincode"
                  value={state.formData.pincode}
                  onChange={handleChange}
                  required={!isEmployeeRole}
                  placeholder="Enter Pincode"
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  State
                </label>
                <input
                  type="text"
                  name="state"
                  value={state.formData.state}
                  onChange={handleChange}
                  required={!isEmployeeRole}
                  placeholder="Enter State"
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Country
                </label>
                <input
                  type="text"
                  name="country"
                  value={state.formData.country}
                  onChange={handleChange}
                  placeholder="Enter Country"
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          </div>

          {!isEmployeeRole && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-xl font-semibold mb-4">Document Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              <div className="min-w-0">
                <label className="block text-sm font-medium text-gray-700 mb-2 leading-5">
                  Aadhar Card Number
                </label>
                <input
                  type="text"
                  name="aadhar_number"
                  value={state.formData.aadhar_number}
                  onChange={handleChange}
                  required
                  placeholder="Enter Aadhar Number"
                  inputMode="numeric"
                  maxLength={12}
                  pattern="[0-9]{12}"
                  title="Aadhaar number must contain exactly 12 digits"
                  aria-invalid={Boolean(aadharValidationMessage)}
                  className="w-full min-w-0 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
                <p className={`mt-1 text-xs ${aadharValidationMessage ? 'text-red-600' : 'text-gray-500'}`}>
                  {aadharValidationMessage || "Only 12 digits allowed. Spaces, letters, and special characters are blocked."}
                </p>
              </div>

              <div className="min-w-0">
                <label className="block text-sm font-medium text-gray-700 mb-2 leading-5">
                  PAN Card Number
                </label>
                <input
                  type="text"
                  name="pan_number"
                  value={state.formData.pan_number}
                  onChange={handleChange}
                  required
                  placeholder="Enter PAN Number"
                  inputMode="text"
                  maxLength={10}
                  pattern="[A-Z]{5}[0-9]{4}[A-Z]{1}"
                  title="PAN must be 5 letters, 4 digits, and 1 letter"
                  autoCapitalize="characters"
                  spellCheck={false}
                  aria-invalid={Boolean(panValidationMessage)}
                  className="w-full min-w-0 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
                <p className={`mt-1 text-xs ${panValidationMessage ? 'text-red-600' : 'text-gray-500'}`}>
                  {panValidationMessage || "Format: ABCDE1234F. Only valid characters for each position are allowed."}
                </p>
              </div>

              {FILE_FIELD_CONFIG.map((field) => {
                const selectedFile = state.formData[field.name];
                const hasSelectedFile = selectedFile instanceof File;
                const existingUrl = getExistingFileUrl(field.name);
                const inputId = `upload-${field.name}`;
                const fileField = (
                  <div key={field.name} className={`${field.fullWidth ? 'md:col-span-2 ' : ''}min-w-0`}>
                    <label className="block text-sm font-medium text-gray-700 mb-2 leading-5">
                      {field.label}
                    </label>

                    <div className="w-full rounded-lg border border-gray-200 px-3 py-3">
                      <div className="flex flex-wrap items-center gap-3">
                        {existingUrl && !hasSelectedFile && (
                          <a
                            href={existingUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group relative inline-flex items-center gap-2"
                            title="Open current image in new tab"
                          >
                            <img
                              src={existingUrl}
                              alt={`${field.label} thumbnail`}
                              className="h-9 w-9 rounded border object-cover"
                              onError={(e) => {
                                e.currentTarget.onerror = null;
                                e.currentTarget.src = FILE_FALLBACK_SRC;
                              }}
                            />
                            <span className="text-xs text-blue-700 underline">View</span>
                            <span className="pointer-events-none absolute left-11 top-1/2 z-20 hidden -translate-y-1/2 rounded-md bg-white p-1 shadow-lg group-hover:block">
                              <img
                                src={existingUrl}
                                alt={`${field.label} preview`}
                                className="h-24 w-24 rounded border object-cover"
                                onError={(e) => {
                                  e.currentTarget.onerror = null;
                                  e.currentTarget.src = FILE_FALLBACK_SRC;
                                }}
                              />
                            </span>
                          </a>
                        )}

                        <label
                          htmlFor={inputId}
                          className="cursor-pointer rounded-md bg-primary/10 px-3 py-2 text-sm font-medium text-primary hover:bg-primary/20"
                        >
                          {hasSelectedFile
                            ? "Change Image"
                            : existingUrl
                              ? "Replace Image"
                              : "Select Image"}
                        </label>

                        <span className="min-w-0 break-all text-xs text-gray-600">
                          {hasSelectedFile
                            ? selectedFile.name
                            : existingUrl
                              ? "Current image available"
                              : "No image selected"}
                        </span>
                      </div>

                      <input
                        id={inputId}
                        type="file"
                        name={field.name}
                        onChange={handleChange}
                        accept={field.accept || 'image/*'}
                        className="hidden"
                      />
                    </div>
                  </div>
                );

                return fileField;
              })}
            </div>
          </div>
          )}
          {!isEmployeeRole && (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-semibold mb-6">{isEditMode ? "Settlement Settings" : "POS Machines"}</h2>

            <div className="space-y-6">

              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                  Settlement Type
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="settlement_type"
                      value="today_settlement"
                      checked={state.formData.settlement_type === 'today_settlement'}
                      onChange={handleChange}
                    />
                    Today Settlement
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="settlement_type"
                      value="next_day_settlement"
                      checked={state.formData.settlement_type === 'next_day_settlement'}
                      onChange={handleChange}
                    />
                    Next Day Settlement
                  </label>
                </div>
              </div>

              {showPosAssignment && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Search and Select POS Machines
                  </label>

                  <div className="relative">
                    <Select
                      isMulti
                      name="pos_machine_ids"
                      value={selectedMachines}
                      options={selectOptions}
                      onChange={handleSelectChange}
                      isLoading={posMachinesLoading}
                      onInputChange={handleSearchChange}
                      placeholder="Search by Device Serial Number or name..."
                      className="w-full"
                      classNamePrefix="react-select"
                      noOptionsMessage={() =>
                        isPosMachineError
                          ? "Error loading POS machines"
                          : "No unassigned POS machines found"
                      }
                    />
                    {posMachinesLoading && (
                      <div className="absolute right-10 top-1/2 transform -translate-y-1/2">
                        <Loader2 className="animate-spin h-5 w-5 text-gray-400" />
                      </div>
                    )}
                  </div>

                  <SelectedMachinesList />
                </div>
              )}
            </div>
          </div>
          )}

          <div className="flex justify-between">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="px-6 py-2 border border-gray-300 rounded-lg"
            >
              Back
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-2 px-6 py-2 bg-primary text-white rounded-lg disabled:opacity-70 disabled:cursor-not-allowed"
              disabled={loading || hasInvalidDocumentNumbers}
            >
              {loading && <Loader2 size={16} className="animate-spin" />}
              <span>
                {loading
                  ? isEditMode
                    ? 'Updating...'
                    : 'Submitting...'
                  : isEditMode
                    ? 'Update User'
                    : 'Submit'}
              </span>
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}

export default AddUser;
