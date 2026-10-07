import { useState, useEffect } from 'react';

import {
  UserPlus,
  UserCheck,
  Users,
  Mail,
  Lock,
  User,
  Phone,
  MapPin,
  FileText,
  Building,
  Calendar,
  Eye,
  EyeOff,
  RefreshCw,
} from 'lucide-react';

import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'react-toastify';

import { useUserCreation } from '../../context/UserCreationContext';
import { createAdmin, getAdminDetails, updateAdmin } from '../../api/superAdminApi';


// ==========================================
// FILE FIELD CONFIGURATION
// ==========================================

const FILE_FIELD_CONFIG = [
  {
    name: 'aadhar_photo',
    label: 'Aadhaar Front Photo',
    accept: '.jpg,.jpeg,.png,.webp',
  },
  {
    name: 'aadhar_back_photo',
    label: 'Aadhaar Back Photo',
    accept: '.jpg,.jpeg,.png,.webp',
  },
  {
    name: 'pan_photo',
    label: 'PAN Card Photo',
    accept: '.jpg,.jpeg,.png,.webp',
  },
  {
    name: 'bank_passbook',
    label: 'Bank Passbook',
    accept: '.jpg,.jpeg,.png,.webp,.pdf',
  },
  {
    name: 'shop_photo',
    label: 'Shop / Office Photo',
    accept: '.jpg,.jpeg,.png,.webp',
  },
];

// ==========================================
// DOMAIN NORMALIZER
// ==========================================

const normalizeDomain = (value = '') => {
  const input = value.trim();

  if (!input) return '';

  try {
    const url = new URL(
      /^https?:\/\//i.test(input)
        ? input
        : `https://${input}`
    );

    return url.hostname
      .replace(/^www\./i, '')
      .toLowerCase();
  } catch {
    return input
      .replace(/^https?:\/\//i, '')
      .replace(/^www\./i, '')
      .split('/')[0]
      .split('?')[0]
      .split('#')[0]
      .replace(/:\d+$/, '')
      .toLowerCase();
  }
};


function CreateAdmin() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditMode = Boolean(id);

  const { state, dispatch } = useUserCreation();

  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // ==========================================
  // FETCH ADMIN IN EDIT MODE
  // ==========================================
  useEffect(() => {
    if (!isEditMode) return;

    let isMounted = true;
    const fetchAdmin = async () => {
      try {
        setFetching(true);
        const res = await getAdminDetails(id);
        const adminData = res?.data || res;
        if (!adminData || !isMounted) return;

        const comp = adminData.company || {};
        dispatch({
          type: 'UPDATE_FORM',
          payload: {
            name: adminData.name || '',
            email: adminData.email || '',
            mobile_number: adminData.mobile_number || '',
            password: '',
            gender: adminData.gender || '',
            dob: adminData.dob ? String(adminData.dob).slice(0, 10) : '',
            address1: adminData.address1 || comp.address1 || '',
            address2: adminData.address2 || comp.address2 || '',
            city: adminData.city || comp.city || '',
            district: adminData.district || comp.district || '',
            pincode: adminData.pincode || comp.pincode || '',
            state: adminData.state || comp.state || '',
            country: adminData.country || comp.country || 'India',
            aadhar_number: adminData.aadhar_number || '',
            pan_number: adminData.pan_number || comp.pan_number || '',
            gst_number: comp.gst_number || '',
            company_or_shop_name:
              adminData.company_or_shop_name ||
              comp.company_name ||
              '',
            domain_name: comp.domain_name || '',
            company_title: comp.company_title || '',
            settlement_type:
              adminData.settlement_type || 'today_settlement',
          },
        });
      } catch (err) {
        console.error('Failed to fetch admin details:', err);
        toast.error(err?.message || 'Failed to load Admin details.');
      } finally {
        if (isMounted) setFetching(false);
      }
    };

    fetchAdmin();

    return () => {
      isMounted = false;
    };
  }, [id, isEditMode, dispatch]);


  // ==========================================
  // PASSWORD GENERATOR
  // ==========================================
  const generateRandomPassword = () => {
    const uppercase = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const lowercase = 'abcdefghijkmnopqrstuvwxyz';
    const numbers = '23456789';
    const symbols = '!@#$%^&*';
    const allChars = uppercase + lowercase + numbers + symbols;

    let generated = '';
    generated += uppercase.charAt(Math.floor(Math.random() * uppercase.length));
    generated += lowercase.charAt(Math.floor(Math.random() * lowercase.length));
    generated += numbers.charAt(Math.floor(Math.random() * numbers.length));
    generated += symbols.charAt(Math.floor(Math.random() * symbols.length));

    for (let i = 4; i < 12; i++) {
      generated += allChars.charAt(Math.floor(Math.random() * allChars.length));
    }

    const shuffled = generated.split('').sort(() => 0.5 - Math.random()).join('');
    dispatch({
      type: 'UPDATE_FORM',
      payload: { password: shuffled },
    });
  };


  // ==========================================
  // HANDLE NORMAL INPUT CHANGE
  // ==========================================

  const handleChange = (e) => {
    const { name, value } = e.target;

    let nextValue = value;

    // Mobile Number
    if (name === 'mobile_number') {
      nextValue = value.replace(/\D/g, '').slice(0, 10);
    }

    // Pincode
    if (name === 'pincode') {
      nextValue = value.replace(/\D/g, '').slice(0, 6);
    }

    // Aadhaar Number
    if (name === 'aadhar_number') {
      nextValue = value.replace(/\D/g, '').slice(0, 12);
    }

    // PAN Number
    if (name === 'pan_number') {
      nextValue = value
        .replace(/[^a-zA-Z0-9]/g, '')
        .toUpperCase()
        .slice(0, 10);
    }

    // GST Number
    if (name === 'gst_number') {
      nextValue = value
        .replace(/[^a-zA-Z0-9]/g, '')
        .toUpperCase()
        .slice(0, 15);
    }

    if (name === 'domain_name') {
      nextValue = normalizeDomain(value);
    }

    dispatch({
      type: 'UPDATE_FORM',
      payload: {
        [name]: nextValue,
      },
    });
  };


  // ==========================================
  // HANDLE FILE CHANGE
  // ==========================================

  const handleFileChange = (e, fieldName) => {
    const targetField = fieldName || e.target.name;
    const file = e.target.files?.[0];

    if (!file) return;

    // Allowed file types
    const allowedTypes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp',
      'application/pdf',
    ];

    // Validate file type
    if (!allowedTypes.includes(file.type)) {
      toast.error('Only JPG, JPEG, PNG, WEBP, and PDF files are allowed.');
      e.target.value = '';
      return;
    }

    // File is valid
    dispatch({
      type: 'UPDATE_FORM',
      payload: {
        [targetField]: file,
      },
    });
  };


  // ==========================================
  // HANDLE FORM SUBMIT (CREATE OR EDIT)
  // ==========================================

  const handleSubmit = async (e) => {
    e.preventDefault();
    const form = state.formData;

    if (!form.name?.trim()) {
      toast.error('Director name is required');
      return;
    }
    if (!form.email?.trim()) {
      toast.error('Email address is required');
      return;
    }
    if (!form.mobile_number?.trim() || form.mobile_number.length !== 10) {
      toast.error('Valid 10-digit Indian mobile number is required');
      return;
    }
    if (!isEditMode && (!form.password || form.password.length < 8)) {
      toast.error('Password must be at least 8 characters long');
      return;
    }
    if (isEditMode && form.password && form.password.length < 8) {
      toast.error('New password must be at least 8 characters long');
      return;
    }
    if (!form.company_or_shop_name?.trim()) {
      toast.error('Company / Shop Name is required');
      return;
    }
    if (!form.domain_name?.trim()) {
      toast.error('Domain Name is required');
      return;
    }

    setLoading(true);

    try {
      if (isEditMode) {
        // EDIT MODE: PUT /api/super-admin/admin/:id
        const updatePayload = {
          name: form.name.trim(),
          email: form.email.trim(),
          mobile_number: form.mobile_number.trim(),
          gender: form.gender || null,
          dob: form.dob || null,
          address1: form.address1 || null,
          address2: form.address2 || null,
          city: form.city || null,
          district: form.district || null,
          pincode: form.pincode || null,
          state: form.state || null,
          country: form.country || 'India',
          aadhar_number: form.aadhar_number || null,
          pan_number: form.pan_number || null,
          gst_number: form.gst_number || null,
          company_name: form.company_or_shop_name.trim(),
          company_or_shop_name: form.company_or_shop_name.trim(),
          company_title: form.company_title?.trim() || null,
          domain_name: normalizeDomain(form.domain_name),
          settlement_type: form.settlement_type || 'today_settlement',
        };

        if (form.password && form.password.trim()) {
          updatePayload.password = form.password.trim();
        }

        const res = await updateAdmin(id, updatePayload);
        toast.success(res?.message || 'Admin updated successfully!');
        dispatch({ type: 'RESET' });
        navigate('/super-admin/admin-list');
      } else {
        // CREATE MODE: POST /api/super-admin/createAdmin (multipart/form-data)
        const formData = new FormData();

        Object.entries(form).forEach(([key, value]) => {
          if (value !== null && value !== undefined && !(value instanceof File)) {
            if (Array.isArray(value) || typeof value === 'object') {
              formData.append(key, JSON.stringify(value));
            } else {
              formData.append(key, String(value));
            }
          }
        });

        formData.set('role', 'admin');

        formData.set(
          'company_name',
          form.company_or_shop_name.trim()
        );

        formData.set(
          'company_or_shop_name',
          form.company_or_shop_name.trim()
        );

        formData.set(
          'company_title',
          form.company_title?.trim() || ''
        );

        formData.set(
          'domain_name',
          normalizeDomain(form.domain_name)
        );

        formData.set(
          'country',
          form.country || 'India'
        );

        formData.set(
          'mobile_number_country_code',
          form.mobile_number_country_code || '+91'
        );

        FILE_FIELD_CONFIG.forEach((field) => {
          const file = form[field.name];
          if (file instanceof File) {
            formData.append(field.name, file);
          }
        });

        // Company Logo
        if (form.company_logo instanceof File) {
          formData.append('company_logo', form.company_logo);
        }

        const res = await createAdmin(formData);
        toast.success(res?.message || 'Admin and Company created successfully!');
        dispatch({ type: 'RESET' });
        navigate('/super-admin/admin-list');
      }
    } catch (err) {
      console.error(isEditMode ? 'Error updating admin:' : 'Error creating admin:', err);
      toast.error(err?.message || (isEditMode ? 'Failed to update Admin.' : 'Failed to create Admin.'));
    } finally {
      setLoading(false);
    }
  };


  if (fetching) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }


  return (
    <div className="min-h-screen p-4 md:p-6">

      {/* ==========================================
          MAIN CONTAINER
      ========================================== */}

      <div className="max-w-4xl mx-auto">

        {/* ==========================================
            PAGE HEADER
        ========================================== */}

        <div className="flex gap-4 items-center mb-6">

          <div className="bg-primary text-white p-3 rounded-lg">
            {isEditMode ? <UserCheck size={22} /> : <UserPlus size={22} />}
          </div>

          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {isEditMode ? 'Edit Admin' : 'Create Admin'}
            </h1>
            <p className="text-sm text-gray-500">
              {isEditMode
                ? 'Update administrator profile and company details'
                : 'Register a new administrator and white-label company'}
            </p>
          </div>

        </div>


        {/* ==========================================
            FORM
        ========================================== */}

        <div className="bg-white rounded-xl shadow-lg p-6">

          <form
            onSubmit={handleSubmit}
            className="space-y-6"
          >

            {/* ==========================================
                ROLE SELECTION
            ========================================== */}

            <div className="bg-gray-50 rounded-lg p-5">

              <label className="flex items-center gap-2 text-sm font-semibold text-gray-800 mb-3">
                <Users size={16} />
                User Role
              </label>

              <div className="flex gap-6">

                <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-gray-700">

                  <input
                    type="radio"
                    name="role"
                    value="admin"
                    checked={true}
                    disabled
                    onChange={handleChange}
                    className="w-4 h-4 text-indigo-600 focus:ring-indigo-500 border-gray-300"
                  />

                  <span>Admin</span>

                </label>

              </div>

            </div>


            {/* ==========================================
                PERSONAL / COMPANY INFORMATION
            ========================================== */}

            <div className="bg-gray-50 rounded-lg p-5">

              <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <User size={18} />
                Company Information
              </h2>


              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                {/* DIRECTOR NAME */}

                <div>

                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Director Name
                  </label>

                  <input
                    type="text"
                    name="name"
                    value={state.formData.name || ''}
                    onChange={handleChange}
                    required
                    placeholder="Enter full name"
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />

                </div>


                {/* EMAIL */}

                <div>

                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                    <Mail size={15} />
                    Email Address
                  </label>

                  <input
                    type="email"
                    name="email"
                    value={state.formData.email || ''}
                    onChange={handleChange}
                    required
                    placeholder="Enter email address"
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />

                </div>


                {/* MOBILE */}

                <div>

                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                    <Phone size={15} />
                    Mobile Number
                  </label>

                  <div className="flex">

                    <input
                      type="text"
                      value={
                        state.formData.mobile_number_country_code || '+91'
                      }
                      disabled
                      className="w-20 px-3 py-2 border border-r-0 rounded-l-lg bg-gray-100 text-gray-600 font-medium"
                    />

                    <input
                      type="text"
                      name="mobile_number"
                      value={state.formData.mobile_number || ''}
                      onChange={handleChange}
                      required
                      maxLength={10}
                      inputMode="numeric"
                      pattern="[0-9]{10}"
                      placeholder="Enter 10-digit mobile number"
                      title="Mobile number must contain exactly 10 digits"
                      className="w-full px-4 py-2 border rounded-r-lg focus:ring-2 focus:ring-indigo-500"
                    />

                  </div>

                </div>


                {/* PASSWORD */}

                <div>

                  <div className="flex items-center justify-between mb-2">
                    <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                      <Lock size={15} />
                      {isEditMode ? 'New Password (Optional)' : 'Password'}
                      {!isEditMode && <span className="text-red-500">*</span>}
                    </label>

                    <button
                      type="button"
                      onClick={generateRandomPassword}
                      className="text-xs text-primary hover:underline flex items-center gap-1 font-medium"
                    >
                      <RefreshCw size={12} />
                      Generate
                    </button>
                  </div>

                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      name="password"
                      value={state.formData.password || ''}
                      onChange={handleChange}
                      required={!isEditMode}
                      minLength={8}
                      placeholder={
                        isEditMode
                          ? 'Leave blank to keep existing password'
                          : 'Enter password (min 8 chars)'
                      }
                      className="w-full px-4 py-2 pr-10 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                    />

                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>

                  {isEditMode && (
                    <p className="mt-1 text-xs text-gray-500">
                      Only fill this if you want to reset the admin password.
                    </p>
                  )}

                </div>


                {/* GENDER */}

                <div>

                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Gender
                  </label>

                  <div className="flex gap-5 py-2">

                    <label className="flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer">

                      <input
                        type="radio"
                        name="gender"
                        value="male"
                        checked={state.formData.gender === 'male'}
                        onChange={handleChange}
                      />

                      Male

                    </label>


                    <label className="flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer">

                      <input
                        type="radio"
                        name="gender"
                        value="female"
                        checked={state.formData.gender === 'female'}
                        onChange={handleChange}
                      />

                      Female

                    </label>


                    <label className="flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer">

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


                {/* DATE OF BIRTH */}

                <div>

                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                    <Calendar size={15} />
                    Date of Birth
                  </label>

                  <input
                    type="date"
                    name="dob"
                    value={state.formData.dob || ''}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />

                </div>

              </div>

            </div>


            {/* ==========================================
                ADDRESS INFORMATION
            ========================================== */}

            <div className="bg-gray-50 rounded-lg p-5">

              <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <MapPin size={18} />
                Address Information
              </h2>


              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                {/* ADDRESS LINE 1 */}

                <div className="md:col-span-2">

                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Address Line 1
                  </label>

                  <input
                    type="text"
                    name="address1"
                    value={state.formData.address1 || ''}
                    onChange={handleChange}
                    required
                    placeholder="Enter address line 1"
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />

                </div>


                {/* ADDRESS LINE 2 */}

                <div className="md:col-span-2">

                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Address Line 2
                  </label>

                  <input
                    type="text"
                    name="address2"
                    value={state.formData.address2 || ''}
                    onChange={handleChange}
                    placeholder="Enter address line 2"
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />

                </div>


                {/* CITY */}

                <div>

                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    City
                  </label>

                  <input
                    type="text"
                    name="city"
                    value={state.formData.city || ''}
                    onChange={handleChange}
                    required
                    placeholder="Enter city"
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />

                </div>


                {/* DISTRICT */}

                <div>

                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    District
                  </label>

                  <input
                    type="text"
                    name="district"
                    value={state.formData.district || ''}
                    onChange={handleChange}
                    required
                    placeholder="Enter district"
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />

                </div>


                {/* PINCODE */}

                <div>

                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Pincode
                  </label>

                  <input
                    type="text"
                    name="pincode"
                    value={state.formData.pincode || ''}
                    onChange={handleChange}
                    required
                    maxLength={6}
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    placeholder="Enter 6-digit pincode"
                    title="Pincode must contain exactly 6 digits"
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />

                </div>


                {/* STATE */}

                <div>

                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    State
                  </label>

                  <input
                    type="text"
                    name="state"
                    value={state.formData.state || ''}
                    onChange={handleChange}
                    required
                    placeholder="Enter state"
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />

                </div>


                {/* COUNTRY */}

                <div>

                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Country
                  </label>

                  <input
                    type="text"
                    name="country"
                    value={state.formData.country || 'India'}
                    onChange={handleChange}
                    required
                    placeholder="Enter country"
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />

                </div>

              </div>

            </div>


            {/* ==========================================
                KYC & DOCUMENT INFORMATION
            ========================================== */}

            <div className="bg-gray-50 rounded-lg p-5">

              <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <FileText size={18} />
                KYC & Document Information
              </h2>


              {/* 2 COLUMNS */}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">


                {/* ==========================================
                    AADHAAR NUMBER
                ========================================== */}

                <div className="min-w-0">

                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Aadhaar Number
                  </label>

                  <input
                    type="text"
                    name="aadhar_number"
                    value={state.formData.aadhar_number || ''}
                    onChange={handleChange}
                    required
                    maxLength={12}
                    inputMode="numeric"
                    pattern="[0-9]{12}"
                    placeholder="Enter 12-digit Aadhaar number"
                    title="Aadhaar number must contain exactly 12 digits"
                    className="w-full min-w-0 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />

                  <p className="mt-1 text-xs text-gray-500">
                    Only 12 digits allowed.
                  </p>

                </div>


                {/* ==========================================
                    PAN NUMBER
                ========================================== */}

                <div className="min-w-0">

                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    PAN Number
                  </label>

                  <input
                    type="text"
                    name="pan_number"
                    value={state.formData.pan_number || ''}
                    onChange={handleChange}
                    required
                    maxLength={10}
                    inputMode="text"
                    pattern="[A-Z]{5}[0-9]{4}[A-Z]{1}"
                    placeholder="Enter 10-character PAN"
                    title="PAN must be 5 letters, 4 digits, and 1 letter"
                    autoCapitalize="characters"
                    spellCheck={false}
                    className="w-full min-w-0 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 uppercase"
                  />

                  <p className="mt-1 text-xs text-gray-500">
                    Format: ABCDE1234F
                  </p>

                </div>


                {/* ==========================================
                    GST NUMBER
                ========================================== */}

                <div className="min-w-0">

                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    GST Number
                  </label>

                  <input
                    type="text"
                    name="gst_number"
                    value={state.formData.gst_number || ''}
                    onChange={handleChange}
                    required
                    maxLength={15}
                    inputMode="text"
                    pattern="[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}"
                    placeholder="Enter 15-character GST"
                    title="GST number must be 15 characters in the correct format"
                    autoCapitalize="characters"
                    spellCheck={false}
                    className="w-full min-w-0 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 uppercase"
                  />

                  <p className="mt-1 text-xs text-gray-500">
                    Format: 07AAAAA0000A1Z5
                  </p>

                </div>


                {/* ==========================================
                    DOCUMENT FILES
                ========================================== */}

                {FILE_FIELD_CONFIG.map((field) => {
                  const selectedFile = state.formData[field.name];

                  const hasSelectedFile = selectedFile instanceof File;

                  const inputId = `upload-${field.name}`;

                  return (
                    <div
                      key={field.name}
                      className="min-w-0"
                    >
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {field.label}
                      </label>

                      <div className="w-full rounded-lg border border-gray-200 bg-white px-3 py-3">
                        <div className="flex flex-wrap items-center gap-3">

                          <label
                            htmlFor={inputId}
                            className="cursor-pointer inline-flex items-center rounded-md bg-primary/10 px-3 py-2 text-sm font-medium text-primary hover:bg-primary/20 transition-colors"
                          >
                            {hasSelectedFile ? 'Replace File' : 'Select File'}
                          </label>

                          <span className="min-w-0 break-all text-xs text-gray-600">
                            {hasSelectedFile
                              ? selectedFile.name
                              : 'No file selected'}
                          </span>

                        </div>

                        <input
                          id={inputId}
                          type="file"
                          name={field.name}
                          onChange={(e) => handleFileChange(e, field.name)}
                          accept={field.accept}
                          className="hidden"
                        />
                      </div>
                    </div>
                  );
                })}

              </div>

            </div>

            {/* ==========================================
                COMPANY / SHOP INFORMATION
            ========================================== */}

            <div className="bg-gray-50 rounded-lg p-5">

              <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <Building size={18} />
                Company Information
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">

                {/* COMPANY NAME */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Company Name <span className="text-red-500">*</span>
                  </label>

                  <input
                    type="text"
                    name="company_or_shop_name"
                    value={state.formData.company_or_shop_name || ''}
                    onChange={handleChange}
                    required
                    placeholder="Enter company or shop name"
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                {/* COMPANY LOGO */}
                <div className="min-w-0">

                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Company Logo
                  </label>

                  <div className="w-full rounded-lg border border-gray-200 bg-white px-3 py-3">
                    <div className="flex flex-wrap items-center gap-3">

                      <label
                        htmlFor="upload-company-logo"
                        className="cursor-pointer inline-flex items-center rounded-md bg-primary/10 px-3 py-2 text-sm font-medium text-primary hover:bg-primary/20 transition-colors"
                      >
                        {state.formData.company_logo instanceof File
                          ? 'Replace Image'
                          : 'Select Image'}
                      </label>

                      <span className="min-w-0 break-all text-xs text-gray-600">
                        {state.formData.company_logo instanceof File
                          ? state.formData.company_logo.name
                          : 'No image selected'}
                      </span>

                    </div>

                    <input
                      id="upload-company-logo"
                      type="file"
                      name="company_logo"
                      onChange={(e) =>
                        handleFileChange(e, 'company_logo')
                      }
                      accept=".jpg,.jpeg,.png,.webp"
                      className="hidden"
                    />
                  </div>

                </div>

                {/* DOMAIN NAME */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Domain Name <span className="text-red-500">*</span>
                  </label>

                  <input
                    type="text"
                    name="domain_name"
                    value={state.formData.domain_name || ''}
                    onChange={handleChange}
                    required
                    placeholder="e.g. google.com"
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />

                  <p className="mt-1 text-xs text-gray-500">
                    Enter domain like google.com. Protocol, www, path,
                    query and trailing slash will be removed automatically.
                  </p>
                </div>

                {/* COMPANY TITLE */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Company Title
                  </label>

                  <input
                    type="text"
                    name="company_title"
                    value={state.formData.company_title || ''}
                    onChange={handleChange}
                    placeholder="Enter company title"
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

              </div>
            </div>


            {/* ==========================================
                BUTTONS
            ========================================== */}

            <div className="flex justify-between pt-4">

              <button
                type="button"
                onClick={() => navigate(-1)}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
              >
                Back
              </button>


              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2 bg-primary text-white rounded-lg disabled:opacity-50 font-medium transition-colors hover:bg-primary-hover shadow-sm"
              >
                {loading ? 'Processing...' : (isEditMode ? 'Update Admin' : 'Submit')}
              </button>

            </div>

          </form>

        </div>

      </div>

    </div>
  );
}


export default CreateAdmin;