import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';

const OtpVerificationModal = ({ isOpen, onClose, mobileNumber, onSuccess }) => {
  const [otp, setOtp] = useState('');
  const [timeLeft, setTimeLeft] = useState(357); // 05:57
  const [loading, setLoading] = useState(false);

  // Handle countdown timer
  useEffect(() => {
    if (!isOpen) return;

    // reset timer and otp when opened
    setTimeLeft(357);
    setOtp('');

    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen]);

  const handleVerify = async (e) => {
    e.preventDefault();
    if (otp.length < 4) {
      toast.error('Please enter a valid OTP.');
      return;
    }

    setLoading(true);
    try {
      // Pass the OTP back to ApplyKyc to handle the final submission with all formData
      await onSuccess(otp);
    } catch (error) {
      toast.error(error.message || 'OTP Verification failed.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const timeString = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-sm overflow-hidden">
        {/* Header */}
        <div className="bg-primary text-white p-4 text-center">
          <h2 className="text-lg font-semibold">OTP Verification</h2>
          <p className="text-sm font-medium">{timeString}</p>
        </div>

        {/* Body */}
        <div className="p-6">
          <form onSubmit={handleVerify} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">
                Enter OTP
              </label>
              <input
                type="text"
                maxLength="6"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder=""
              />
            </div>

            <button
              type="submit"
              disabled={loading || timeLeft === 0}
              className={`w-full py-2 px-4 rounded-md text-white font-medium transition-colors
                ${loading || timeLeft === 0 ? 'bg-gray-400 cursor-not-allowed' : 'bg-primary hover:bg-opacity-90 shadow-md'}`}
            >
              {loading ? 'Verifying...' : 'Verify OTP'}
            </button>

            <div className="text-left mt-2">
              <button
                type="button"
                onClick={onClose}
                className="text-xs text-gray-500 hover:text-gray-700 font-medium"
              >
                Change Mobile Nu
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default OtpVerificationModal;
