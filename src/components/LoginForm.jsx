import React from 'react';
import FormInput from './FormInput';

const LoginForm = ({
  mobile,
  setMobile,
  onSubmit,
  isLoading
}) => {
  return (
    <div className="bg-white rounded-xl shadow-sm p-6 ">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">Remitter Login</h2>
      
      <FormInput
        type="tel"
        placeholder="Enter Mobile Number"
        value={mobile}
        onChange={(e) => setMobile(e.target.value)}
        className="mb-4"
      />

      <button
        onClick={onSubmit}
        disabled={isLoading || !mobile}
        className="w-full bg-[#00D3CD] text-white py-3 rounded-lg hover:bg-[#00bdb7] transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? 'Searching...' : 'Search'}
      </button>
    </div>
  );
};

export default LoginForm;