import React from 'react';
import FormInput from './FormInput';


const RemitterForm = ({
  mobile,
  setMobile,
  otp,
  setOtp,
  name,
  setName,
  onSubmit,
  isLoading
}) => {
  return (
    <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
      <h2 className="text-xl font-semibold text-gray-900 mb-6">Register New Remitter</h2>
      
      <FormInput
        placeholder="Mobile Number"
        value={mobile}
        onChange={(e) => setMobile(e.target.value)}
        className="mb-4"
      />

      <FormInput
        placeholder="OTP"
        value={otp}
        onChange={(e) => setOtp(e.target.value)}
        className="mb-4"
      />

      <FormInput
        placeholder="Full Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="mb-4"
      />

      <button
        onClick={onSubmit}
        disabled={isLoading}
        className="w-full bg-[#00D3CD] text-white py-3 rounded-lg hover:bg-[#00bdb7] transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? 'Registering...' : 'Register Remitter'}
      </button>
    </div>
  );
};

export default RemitterForm;