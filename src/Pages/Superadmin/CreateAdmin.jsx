import { useState } from 'react';
import {
  UserPlus,
  Users,
  Mail,
  Lock,
  User,
  Phone,
  MapPin,
  FileText,
  Building,
  Calendar,
  CreditCard,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { useUserCreation } from '../../context/UserCreationContext';

function CreateAdmin() {
  const navigate = useNavigate();
  const { state, dispatch } = useUserCreation();
  const [loading, setLoading] = useState(false);

  // ==========================================
  // HANDLE NORMAL INPUT CHANGE
  // ==========================================
  const handleChange = (e) => {
    const { name, value } = e.target;

    dispatch({
      type: 'UPDATE_FORM',
      payload: {
        [name]: value,
      },
    });
  };

  // ==========================================
  // HANDLE FILE CHANGE
  // ==========================================
  const handleFileChange = (e) => {
    const { name, files } = e.target;

    dispatch({
      type: 'UPDATE_FORM',
      payload: {
        [name]: files?.[0] || null,
      },
    });
  };

  // ==========================================
  // HANDLE FORM SUBMIT & NEXT STEP
  // ==========================================
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Ensure role is explicitly set to admin before moving ahead
      dispatch({
        type: 'UPDATE_FORM',
        payload: {
          role: 'admin',
        },
      });

      // Move to next step in context
      dispatch({
        type: 'NEXT_STEP',
      });

      // Navigate to Next Step Route
      navigate('/super-admin/create-admin/address');
    } catch (error) {
      console.error('Error in step 1 completion:', error);
    } finally {
      setLoading(false);
    }
  };

  const FILE_FIELD_CONFIG = [
  {
    name: 'aadhar_photo',
    label: 'Aadhaar Front Photo',
    accept: 'image/*',
  },
  {
    name: 'aadhar_back_photo',
    label: 'Aadhaar Back Photo',
    accept: 'image/*',
  },
  {
    name: 'pan_photo',
    label: 'PAN Card Photo',
    accept: 'image/*',
  },
  {
    name: 'bank_passbook',
    label: 'Bank Passbook',
    accept: 'image/*,application/pdf',
  },
  {
    name: 'shop_photo',
    label: 'Shop / Office Photo',
    accept: 'image/*',
    fullWidth: true,
  },
];

  return (
    <div className="min-h-screen p-4 md:p-6">
      {/* ==========================================
          STEP INDICATOR
      ========================================== */}

      <div className="max-w-4xl mx-auto">
        {/* ==========================================
            PAGE HEADER
        ========================================== */}
        <div className="flex gap-4 items-center mb-6">
          <div className="bg-primary text-white p-3 rounded-lg">
            <UserPlus size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Create Admin
            </h1>

          </div>
        </div>

        {/* ==========================================
            FORM
        ========================================== */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
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
                PERSONAL INFORMATION
            ========================================== */}
            <div className="bg-gray-50 rounded-lg p-5">
              <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <User size={18} />
                Personal Information
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* NAME */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Full Name
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
                      value={state.formData.mobile_number_country_code || '+91'}
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
                      placeholder="Enter 10-digit mobile number"
                      className="w-full px-4 py-2 border rounded-r-lg focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                {/* PASSWORD */}
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                    <Lock size={15} />
                    Password
                  </label>
                  <input
                    type="password"
                    name="password"
                    value={state.formData.password || ''}
                    onChange={handleChange}
                    required
                    minLength={8}
                    placeholder="Enter password (min 8 chars)"
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
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

                {/* DOB */}
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
                {/* ADDRESS 1 */}
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

                {/* ADDRESS 2 */}
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
                    placeholder="Enter pincode"
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
            {/* ==========================================
    KYC & DOCUMENT INFORMATION
========================================== */}
            <div className="bg-gray-50 rounded-lg p-5">
              <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <FileText size={18} />
                KYC & Document Information
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                {/* AADHAAR NUMBER */}
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

                {/* PAN NUMBER */}
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
                    placeholder="Enter 10-char PAN number"
                    title="PAN must be 5 letters, 4 digits, and 1 letter"
                    autoCapitalize="characters"
                    spellCheck={false}
                    className="w-full min-w-0 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 uppercase"
                  />

                  <p className="mt-1 text-xs text-gray-500">
                    Format: ABCDE1234F
                  </p>
                </div>

                {/* DOCUMENT FILES */}
                {FILE_FIELD_CONFIG.map((field) => {
                  const selectedFile = state.formData[field.name];
                  const hasSelectedFile = selectedFile instanceof File;
                  const inputId = `upload-${field.name}`;

                  return (
                    <div
                      key={field.name}
                      className={`${field.fullWidth ? 'md:col-span-2 ' : ''}min-w-0`}
                    >
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {field.label}
                      </label>

                      {/* FILE BOX */}
                      <div className="w-full rounded-lg border border-gray-200 bg-white px-3 py-3">
                        <div className="flex flex-wrap items-center gap-3">

                          {/* SELECT / REPLACE FILE BUTTON */}
                          <label
                            htmlFor={inputId}
                            className="cursor-pointer inline-flex items-center rounded-md bg-primary/10 px-3 py-2 text-sm font-medium text-primary hover:bg-primary/20 transition-colors"
                          >
                            {hasSelectedFile ? 'Replace File' : 'Select File'}
                          </label>

                          {/* SELECTED FILE NAME */}
                          <span className="min-w-0 break-all text-xs text-gray-600">
                            {hasSelectedFile
                              ? selectedFile.name
                              : 'No file selected'}
                          </span>
                        </div>

                        {/* HIDDEN FILE INPUT */}
                        <input
                          id={inputId}
                          type="file"
                          name={field.name}
                          onChange={handleFileChange}
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
                COMPANY / SHOP NAME
            ========================================== */}
            <div className="bg-gray-50 rounded-lg p-5">
              <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <Building size={18} />
                Company / Shop Information
              </h2>

              <label className="block text-sm font-medium text-gray-700 mb-2">
                Company / Shop Name
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
                className="px-6 py-2 bg-primary text-white rounded-lg disabled:opacity-50 font-medium transition-colors"
              >
                {loading ? 'Processing...' : 'Submit'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default CreateAdmin;