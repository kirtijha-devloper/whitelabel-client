import { useState } from 'react';
import { verifyOtp, fetchUserDetails, forgotPassword, verifyForgotPasswordOtp, resetPasswordWithToken } from '../../api/authApi';
import { useLogin } from '../../hooks/auth/useLogin';
import { useNavigate } from 'react-router-dom';
import { setAuthToken } from '../../utils/auth';
import { getAdminLandingPathForUser } from '../../utils/accessControl';
import { markLoginPopupsPending } from '../../utils/loginPopups';
import { toast } from 'react-toastify';
import { X } from 'lucide-react';

const LoginForm = () => {
  const { mutate: loginMutation, isPending, isError, error } = useLogin();
  const navigate = useNavigate();
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');
  const [mobile, setMobile] = useState('');
  const [otpError, setOtpError] = useState(null);

  // Forgot password states
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotStep, setForgotStep] = useState(1); // 1: Mobile, 2: OTP, 3: New Password
  const [forgotMobile, setForgotMobile] = useState('');
  const [forgotOtp, setForgotOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState(null);

  const normalizeRole = (role) => {
    const value = String(role || '').trim().toLowerCase();
    if (value === 'franchaise') return 'franchise';
    return value;
  };

  // Handle mobile number and password submission
  const handleCredentialsSubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const credentials = {
      mobile_number: formData.get('mobile'),
      password: formData.get('password'),
    };
    console.log(credentials, 'credentials');

    loginMutation(credentials, {
      onSuccess: (data) => {
        console.log(data, 'login response');
        setMobile(credentials.mobile_number);
        setOtpSent(true); // Show OTP input
      },
      onError: (err) => {
        console.error('Login failed:', err);
      },
    });
  };

  // Handle OTP submission
  const handleOtpSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await verifyOtp({
        mobile_number: mobile,
        otp,
        purpose: 'login',
      });
      console.log(response, 'OTP verification response');

      setAuthToken(response.token);
      markLoginPopupsPending();

      const user = await fetchUserDetails();
      console.log(user, 'User details fetched');
      const role = normalizeRole(user?.role);

      if (role === 'super_admin') {
        navigate('/super-admin/dashboard');
      } else if (role === 'admin') {
        navigate('/admin/dashboard');
      } else if (role === 'employee') {
        navigate(getAdminLandingPathForUser(user));
      } else if (role === 'super_franchise') {
        navigate('/super-franchise/dashboard');
      } else if (role === 'franchise') {
        navigate('/franchise/dashboard');
      } else if (role === 'merchant') {
        navigate('/merchant/dashboard');
      } else {
        navigate('/merchant/dashboard'); // Default
      }
    } catch (error) {
      console.error('OTP verification failed:', error);
      setOtpError(error.message || 'Invalid OTP. Please try again.');
    }
  };

  // Go back to credentials form
  const handleBack = () => {
    setOtpSent(false);
    setOtp('');
    setOtpError(null);
  };

  // Forgot password flow handlers
  const handleForgotMobileSubmit = async (e) => {
    e.preventDefault();
    setForgotLoading(true);
    setForgotError(null);
    try {
      await forgotPassword({ mobile_number: forgotMobile });
      toast.success("OTP sent to your registered email address.");
      setForgotStep(2);
    } catch (err) {
      setForgotError(err.message || "Failed to send OTP.");
    } finally {
      setForgotLoading(false);
    }
  };

  const handleForgotOtpSubmit = async (e) => {
    e.preventDefault();
    setForgotLoading(true);
    setForgotError(null);
    try {
      const response = await verifyForgotPasswordOtp({
        mobile_number: forgotMobile,
        otp: forgotOtp,
      });
      setResetToken(response.reset_token);
      toast.success("OTP verified. Please set your new password.");
      setForgotStep(3);
    } catch (err) {
      setForgotError(err.message || "Invalid or expired OTP.");
    } finally {
      setForgotLoading(false);
    }
  };

  const handleResetPasswordSubmit = async (e) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      setForgotError("Password must be at least 6 characters long.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setForgotError("Passwords do not match.");
      return;
    }
    setForgotLoading(true);
    setForgotError(null);
    try {
      await resetPasswordWithToken({
        new_password: newPassword,
        reset_token: resetToken,
      });
      toast.success("Password updated successfully. You can now login.");
      closeForgotModal();
    } catch (err) {
      setForgotError(err.message || "Failed to reset password.");
    } finally {
      setForgotLoading(false);
    }
  };

  const closeForgotModal = () => {
    setShowForgotModal(false);
    setForgotStep(1);
    setForgotMobile('');
    setForgotOtp('');
    setNewPassword('');
    setConfirmPassword('');
    setResetToken('');
    setForgotError(null);
  };

  return (
    <div className="space-y-4">
      {!otpSent ? (
        <form onSubmit={handleCredentialsSubmit} className="space-y-4">
          <div>
            <input
              type="tel"
              name="mobile"
              placeholder="Mobile Number"
              className="w-full p-3 border rounded"
              pattern="[0-9]{10}"
              required
            />
          </div>
          <div>
            <input
              type="password"
              name="password"
              placeholder="Password"
              className="w-full p-3 border rounded"
              required
            />
          </div>
          {isError && <p className="text-red-500">{error.message}</p>}
          <button
            type="submit"
            disabled={isPending}
            className="w-full p-3 bg-[#00CEC8] hover:bg-gray-900/10 text-white text-xl rounded-2xl"
          >
            {isPending ? 'Sending OTP...' : 'Send OTP'}
          </button>

          <div className="text-center mt-2">
            <button
              type="button"
              onClick={() => setShowForgotModal(true)}
              className="text-sm text-teal-600 hover:text-teal-800 hover:underline focus:outline-none font-medium"
            >
              Forgot Password?
            </button>
          </div>
        </form>
      ) : (
        <form onSubmit={handleOtpSubmit} className="space-y-4">
          <p className="text-green-600 text-sm font-medium">
            OTP sent to your mail & number.
            <br />
            Please check your mail or registered number.
          </p>
          <div>
            <input
              type="text"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              placeholder="Enter OTP"
              className="w-full p-3 border rounded"
              required
            />
          </div>
          {otpError && <p className="text-red-500">{otpError}</p>}
          <button
            type="submit"
            className="w-full p-3 bg-[#00CEC8] hover:bg-gray-900/10 text-white text-xl rounded-2xl"
            disabled={isPending}
          >
            Verify OTP
          </button>
          <button
            type="button"
            onClick={handleBack}
            className="w-full p-3 text-gray-500 hover:text-gray-700"
          >
            Change Mobile Number
          </button>
        </form>
      )}

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 transition-opacity duration-300">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl relative overflow-hidden transform transition-all duration-300 scale-100 border border-gray-100">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h3 className="text-xl font-bold text-gray-900">
                {forgotStep === 1 && "Forgot Password"}
                {forgotStep === 2 && "Verify OTP"}
                {forgotStep === 3 && "Reset Password"}
              </h3>
              <button
                type="button"
                onClick={closeForgotModal}
                className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-full hover:bg-gray-100"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6">
              {forgotError && (
                <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100">
                  {forgotError}
                </div>
              )}

              {forgotStep === 1 && (
                <form onSubmit={handleForgotMobileSubmit} className="space-y-4">
                  <p className="text-sm text-gray-600 leading-relaxed">
                    Enter your registered 10-digit mobile number. We will send an OTP to your registered mobile number and email address.
                  </p>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                      Mobile Number
                    </label>
                    <input
                      type="tel"
                      value={forgotMobile}
                      onChange={(e) => setForgotMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      placeholder="Enter mobile number"
                      className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#00CEC8] focus:border-transparent outline-none transition-all"
                      pattern="[0-9]{10}"
                      required
                    />
                  </div>
                  <div className="flex space-x-3 pt-2">
                    <button
                      type="button"
                      onClick={closeForgotModal}
                      className="w-1/2 p-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={forgotLoading}
                      className="w-1/2 p-3 bg-[#00CEC8] hover:bg-[#00b0ab] disabled:bg-[#a3f0ed] text-white font-semibold rounded-xl transition-colors flex items-center justify-center"
                    >
                      {forgotLoading ? (
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        "Send OTP"
                      )}
                    </button>
                  </div>
                </form>
              )}

              {forgotStep === 2 && (
                <form onSubmit={handleForgotOtpSubmit} className="space-y-4">
                  <p className="text-sm text-gray-600 leading-relaxed">
                    Please enter the 6-digit verification code sent to your registered email for <span className="font-semibold text-gray-900">{forgotMobile}</span>.
                  </p>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                      Verification Code (OTP)
                    </label>
                    <input
                      type="text"
                      value={forgotOtp}
                      onChange={(e) => setForgotOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="Enter 6-digit OTP"
                      className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#00CEC8] focus:border-transparent outline-none tracking-widest text-center text-lg font-bold transition-all"
                      required
                    />
                  </div>
                  <div className="flex space-x-3 pt-2">
                    <button
                      type="button"
                      onClick={() => { setForgotStep(1); setForgotError(null); }}
                      className="w-1/2 p-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl transition-colors"
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      disabled={forgotLoading}
                      className="w-1/2 p-3 bg-[#00CEC8] hover:bg-[#00b0ab] disabled:bg-[#a3f0ed] text-white font-semibold rounded-xl transition-colors flex items-center justify-center"
                    >
                      {forgotLoading ? (
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        "Verify OTP"
                      )}
                    </button>
                  </div>
                </form>
              )}

              {forgotStep === 3 && (
                <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
                  <p className="text-sm text-gray-600 leading-relaxed">
                    Set a new strong password for your account.
                  </p>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                        New Password
                      </label>
                      <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="At least 6 characters"
                        className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#00CEC8] focus:border-transparent outline-none transition-all"
                        minLength={6}
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                        Confirm New Password
                      </label>
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Re-enter new password"
                        className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#00CEC8] focus:border-transparent outline-none transition-all"
                        minLength={6}
                        required
                      />
                    </div>
                  </div>
                  <div className="flex space-x-3 pt-4">
                    <button
                      type="button"
                      onClick={closeForgotModal}
                      className="w-1/2 p-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={forgotLoading}
                      className="w-1/2 p-3 bg-[#00CEC8] hover:bg-[#00b0ab] disabled:bg-[#a3f0ed] text-white font-semibold rounded-xl transition-colors flex items-center justify-center"
                    >
                      {forgotLoading ? (
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        "Reset Password"
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LoginForm;
