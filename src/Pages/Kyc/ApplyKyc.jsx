import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { fetchUserDetails } from '../../api/authApi';
import { getKycProfile, generateKycOtp, submitKyc } from '../../api/kycApi';
import OtpVerificationModal from '../../components/Kyc/OtpVerificationModal';
import { Phone, Mail, Hash, FileText, IdCard, CreditCard, ShieldCheck } from 'lucide-react';
import Loader from '../../components/Loader';

const ApplyKyc = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();

  const [formData, setFormData] = useState({
    mobile: '',
    email: '',
    bankAccountNo: '',
    bankIfsc: '',
    aadhaar: '',
    pan: '',
    latitude: null,
    longitude: null,
    consent: true // Changed to boolean for checkbox state
  });
  const [forceResetMode, setForceResetMode] = useState(false);

  const [loadingProfile, setLoadingProfile] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpInfo, setOtpInfo] = useState({ otpReferenceID: null, hash: null });
  const [isKycCompleted, setIsKycCompleted] = useState(false);

  const basePath = location.pathname.split('/').slice(0, 2).join('/');
  const ccBillPath = `${basePath}/cc-bill-pay`;

  useEffect(() => {
    fetchProfileData();
  }, []);

  const fetchProfileData = async () => {
    try {
      const resp = await getKycProfile();
      if (resp.success && resp.data) {
        const kycDone = resp.data.isKycDone ?? resp.data.kycDone ?? false;
        if (kycDone) {
          setIsKycCompleted(true);
        }
        setFormData((prev) => ({
          ...prev,
          mobile: resp.data.mobile || '',
          email: resp.data.email || '',
          aadhaar: resp.data.aadhaar || '',
          pan: resp.data.pan || '',
          bankAccountNo: resp.data.bankAccountNo || '',
          bankIfsc: resp.data.bankIfsc || '',
        }));
      }

      // Also check current user record for ipay_outlet_id (fallback if API flag isn't set)
      try {
        const user = await fetchUserDetails();
        const ipayOutletRaw =
          user?.ipay_outlet_id ??
          user?.ipayOutletId ??
          user?.outletId ??
          user?.outlet_id;
        if (ipayOutletRaw !== undefined && ipayOutletRaw !== null && `${ipayOutletRaw}`.trim() !== "") {
          setIsKycCompleted(true);
        }
      } catch {
        // Ignore user fetch errors; we already rely on /kyc/info as primary source.
      }
    } catch (error) {
      toast.error("Failed to load pre-filled KYC details.");
    } finally {
      setLoadingProfile(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const getCoordinates = () => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Geolocation is not supported by your browser"));
      } else {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            resolve({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude
            });
          },
          (error) => {
            reject(new Error("Invalid Latitude, please try again"));
          }
        );
      }
    });
  };

  const handleGetOtp = async (e) => {
    e.preventDefault();

    // Basic validation
if (!formData.bankAccountNo || !formData.bankIfsc) {
      toast.error('Please fill Bank Account and IFSC fields');
      return;
    }

    if (!formData.consent) {
      toast.error('Please provide consent to proceed with KYC Verification');
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Capture Location
      toast.info("Capturing location for verification...", { autoClose: 2000 });
      let coords = {};
      try {
        coords = await getCoordinates();
        setFormData(prev => ({
          ...prev,
          latitude: coords.latitude,
          longitude: coords.longitude
        }));
      } catch (geoError) {
        toast.info('Location unavailable; continuing without coordinates.', { autoClose: 2500 });
      }

      // 2. Initial check & dispatch OTP
      const kycPayload = {
        ...formData,
        bankAccountNo: formData.bankAccountNo,
        bankIfsc: formData.bankIfsc,
        latitude: coords.latitude,
        longitude: coords.longitude,
        consent: formData.consent ? 'Y' : 'N',
        forceReset: forceResetMode ? true : undefined
      };

      const resp = await generateKycOtp(kycPayload);

      if (resp.success) {
        setOtpInfo({
          otpReferenceID: resp.data.otpReferenceID,
          hash: resp.data.hash
        });
        toast.success(resp.message);
        setShowOtpModal(true);
      } else {
        toast.error(resp.message || 'Failed to initiate KYC');
      }

    } catch (error) {
      toast.error(error.message || 'Failed to capture location or generate OTP');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFinalSubmit = async (otp) => {
    try {
      if (!otpInfo.otpReferenceID || !otpInfo.hash) {
        toast.error("Missing OTP Reference information. Please grab a new OTP.");
        return;
      }

      const resp = await submitKyc({
        otpReferenceID: otpInfo.otpReferenceID,
        hash: otpInfo.hash,
        otp: otp
      });

      if (resp.success) {
        setShowOtpModal(false);
        toast.success(`KYC Verification Process Completed Successfully! Outlet ID: ${resp.data?.outletId || 'N/A'}`);
        setIsKycCompleted(true);
        queryClient.invalidateQueries(['currentUser']);
      } else {
        toast.error(resp.message || 'OTP Verification Failed.');
      }
    } catch (error) {
      throw error; // Let the OTP modal catch it and display it
    }
  };

  if (loadingProfile) {
    return <div className="min-h-screen flex items-center justify-center"><Loader /></div>;
  }

  if (isKycCompleted) {
    return (
      <div className="p-6">
        <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-lg p-12 text-center mt-10 border-t-4 border-green-500">
          <ShieldCheck size={64} className="mx-auto text-green-500 mb-6" />
          <h2 className="text-3xl font-bold text-gray-900 mb-4">KYC Verified Successfully</h2>
          <p className="text-gray-600 text-lg mb-6">Your KYC verification process is already complete. You can now access all services including BBPS Credit Card Bill Payments.</p>
          <div className="flex flex-col md:flex-row items-center justify-center gap-4">
            <button
              type="button"
              onClick={() => navigate(ccBillPath)}
              className="inline-flex items-center justify-center rounded-lg bg-primary px-6 py-3 text-white font-semibold shadow hover:opacity-90"
            >
              Go to CC Bill Pay
            </button>
            <button
              type="button"
              onClick={() => {
                setIsKycCompleted(false);
                setForceResetMode(true);
                toast.info('Re-initiation mode enabled. You can now restart InstantPay onboarding.');
              }}
              className="inline-flex items-center justify-center rounded-lg bg-white border border-primary text-primary px-6 py-3 font-semibold shadow-sm hover:bg-primary hover:text-white transition"
            >
              Reset InstantPay Onboarding
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center mb-6">
          <div className="bg-primary text-white p-3 rounded-lg">
            <ShieldCheck size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Apply for KYC Verification</h1>
            {forceResetMode && (
              <p className="mt-2 text-sm text-yellow-700 bg-yellow-100 border border-yellow-200 rounded-md p-3 max-w-xl">
                Re-initiation mode is enabled. This will restart your InstantPay onboarding flow and send a new OTP to the registered mobile number.
              </p>
            )}
          </div>
        </div>

        <form onSubmit={handleGetOtp} className="space-y-6">
          <div className="bg-white rounded-xl shadow-lg p-8">
            <h2 className="text-lg font-semibold text-gray-800 mb-6 border-b pb-2">Personal Information</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                  <Phone size={16} className="text-gray-400" /> Mobile Number
                </label>
                <input
                  type="text"
                  name="mobile"
                  value={formData.mobile}
                  disabled
                  title="Mobile number is fetched from your profile."
                  className="w-full px-4 py-2 border border-gray-100 bg-gray-100 text-gray-500 rounded-lg cursor-not-allowed outline-none"
                />
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                  <Mail size={16} className="text-gray-400" /> Email Address
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  disabled
                  title="Email is fetched from your profile."
                  className="w-full px-4 py-2 border border-gray-100 bg-gray-100 text-gray-500 rounded-lg cursor-not-allowed outline-none"
                />
              </div>
            </div>

            <h2 className="text-lg font-semibold text-gray-800 mb-6 border-b pb-2">Identity Documents</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                  <IdCard size={16} className="text-gray-400" /> Aadhaar Number
                </label>
                <input
                  type="text"
                  name="aadhaar"
                  value={formData.aadhaar}
                  disabled
                  title="Aadhaar is fetched from your profile (Masked for security)."
                  className="w-full px-4 py-2 border border-gray-100 bg-gray-100 text-gray-500 rounded-lg cursor-not-allowed outline-none font-mono"
                />
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                  <CreditCard size={16} className="text-gray-400" /> PAN Number
                </label>
                <input
                  type="text"
                  name="pan"
                  value={formData.pan}
                  disabled
                  title="PAN is fetched from your profile (Masked for security)."
                  className="w-full px-4 py-2 border border-gray-100 bg-gray-100 text-gray-500 rounded-lg cursor-not-allowed outline-none uppercase font-mono"
                />
              </div>
            </div>

            <h2 className="text-lg font-semibold text-gray-800 mb-6 border-b pb-2">Bank Details (Editable)</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                  <Hash size={16} className="text-gray-400" /> Account Number
                </label>
                <input
                  type="text"
                  name="bankAccountNo"
                  value={formData.bankAccountNo}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
                  placeholder="Enter bank account number"
                  maxLength={18}
                />
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                  <FileText size={16} className="text-gray-400" /> IFSC Code
                </label>
                <input
                  type="text"
                  name="bankIfsc"
                  value={formData.bankIfsc}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all uppercase"
                  placeholder="Enter bank IFSC code"
                  maxLength={11}
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-6 border-t mt-4">
              <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                <input
                  type="checkbox"
                  name="consent"
                  checked={formData.consent}
                  onChange={handleChange}
                  className="w-4 h-4 text-primary bg-gray-100 border-gray-300 rounded focus:ring-primary cursor-pointer"
                />
                I consent to the use of my Aadhaar & PAN for KYC verification.
              </label>

              <button
                type="submit"
                disabled={isSubmitting}
                title="This will verify your location and send an OTP to your Aadhaar-linked mobile"
                className={`px-8 py-3 rounded-lg text-white font-medium transition-colors ml-auto
                  ${isSubmitting ? 'bg-gray-400 cursor-not-allowed' : 'bg-primary hover:opacity-90 shadow-md'}`}
              >
                {isSubmitting ? 'Validating...' : forceResetMode ? 'Re-initiate KYC' : 'Get OTP'}
              </button>
            </div>
          </div>
        </form>
      </div>

      {showOtpModal && (
        <OtpVerificationModal
          isOpen={showOtpModal}
          onClose={() => setShowOtpModal(false)}
          mobileNumber={formData.mobile} // For display in modal 
          onSuccess={handleFinalSubmit}
        />
      )}
    </div>
  );
};

export default ApplyKyc;
