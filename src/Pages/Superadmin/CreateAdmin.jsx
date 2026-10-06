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
} from 'lucide-react';

import { useNavigate } from 'react-router-dom';

import { useUserCreation } from '../../context/UserCreationContext';


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


function CreateAdmin() {
  const navigate = useNavigate();

  const { state, dispatch } = useUserCreation();

  const [loading, setLoading] = useState(false);


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
  const file = e.target.files?.[0];

  if (!file) return;

  // Allowed file types
  const allowedTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
  ];

  // Validate file type
  if (!allowedTypes.includes(file.type)) {
    alert('Only JPG, JPEG, PNG, and WEBP images are allowed.');

    // Clear selected file
    e.target.value = '';

    return;
  }

  // File is valid
  dispatch({
    type: 'UPDATE_FORM',
    payload: {
      [fieldName]: file,
    },
  });
};


  // ==========================================
  // HANDLE FORM SUBMIT
  // ==========================================

  const handleSubmit = async (e) => {
    e.preventDefault();

    setLoading(true);

    try {
      // Ensure required default values are present
      dispatch({
        type: 'UPDATE_FORM',
        payload: {
          role: 'admin',
          country: state.formData.country || 'India',
          mobile_number_country_code:
            state.formData.mobile_number_country_code || '+91',
        },
      });

      // Move to next step
      dispatch({
        type: 'NEXT_STEP',
      });

      // Navigate to next step
      navigate('/super-admin/create-admin/address');
    } catch (error) {
      console.error('Error in step 1 completion:', error);
    } finally {
      setLoading(false);
    }
  };


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
                COMPANY / SHOP INFORMATION
            ========================================== */}

            <div className="bg-gray-50 rounded-lg p-5">

              <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <Building size={18} />
                Company / Shop Information
              </h2>


              {/* 2 COLUMNS */}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">


                {/* COMPANY / SHOP NAME */}

                <div className="md:col-span-2">

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


                {/* COMPANY ID */}

                <div>

                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Company ID
                  </label>

                  <input
                    type="text"
                    name="company_id"
                    value={state.formData.company_id || ''}
                    onChange={handleChange}
                    placeholder="Enter company ID"
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />

                </div>


                {/* DOMAIN NAME */}

                <div>

                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Domain Name
                  </label>

                  <input
                    type="text"
                    name="domain_name"
                    value={state.formData.domain_name || ''}
                    onChange={handleChange}
                    placeholder="Enter domain name"
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