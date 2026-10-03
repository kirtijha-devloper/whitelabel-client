import React from 'react';

const FormInput = ({
  label,
  type = "text",
  placeholder,
  value,
  onChange,
  className = "",
  name,
  ...props
}) => {
  return (
    <div className="space-y-1">
      {label && (
        <label htmlFor={name} className="block text-sm font-medium text-gray-700">
          {label}
        </label>
      )}
      <input
        id={name}
        name={name}
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        className={`w-full p-2 border rounded-lg focus:ring-2 focus:ring-[#00D3CD] transition-all duration-200 ${className}`}
        {...props}
      />
    </div>
  );
};

export default FormInput;