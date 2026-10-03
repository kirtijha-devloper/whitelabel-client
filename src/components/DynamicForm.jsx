// components/DynamicForm.jsx
import React, { useState } from "react";

const DynamicForm = ({ fields, onSubmit, title, buttonLabel = "Submit", className = "", defaultValues = {}, onValuesChange }) => {
  // Initialize form state based on fields and defaultValues
  const initialState = fields.reduce((acc, field) => {
    acc[field.name] = defaultValues[field.name] !== undefined ? defaultValues[field.name] : (field.defaultValue || "");
    return acc;
  }, {});

  const [formData, setFormData] = useState(initialState);
  const [errors, setErrors] = useState({});

  // Handle input change
  const handleChange = (e) => {
    const { name, value } = e.target;
    const newFormData = { ...formData, [name]: value };
    setFormData(newFormData);

    // Notify parent of change
    if (onValuesChange) {
      onValuesChange(newFormData);
    }

    // Clear error for the field when user types
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  // Handle form submission with validation
  const handleSubmit = (e) => {
    e.preventDefault();
    const newErrors = {};

    // Validate required fields
    fields.forEach((field) => {
      if (field.required && !formData[field.name]) {
        newErrors[field.name] = `${field.label} is required`;
      }
      // Add custom validation if provided
      if (field.validate && formData[field.name]) {
        const validationError = field.validate(formData[field.name]);
        if (validationError) {
          newErrors[field.name] = validationError;
        }
      }
    });

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    // If no errors, call the onSubmit prop with form data
    onSubmit(formData);
    // Reset form after submission
    setFormData(initialState);
    setErrors({});
  };

  return (
    <div className={`p-6 bg-white rounded-lg shadow-md max-w-lg mx-auto mt-6 ${className}`}>
      <h2 className="text-2xl font-bold mb-6 text-gray-800 text-center">{title}</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        {fields.map((field) => (
          <div key={field.name} className="flex flex-col">
            <label htmlFor={field.name} className="text-sm font-medium text-gray-700 mb-1">
              {field.label}
              {field.required && <span className="text-red-500">*</span>}
            </label>
            {field.type === "select" ? (
              <select
                id={field.name}
                name={field.name}
                value={formData[field.name]}
                onChange={handleChange}
                className="p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select {field.label}</option>
                {field.options.map((option) => {
                  const value = typeof option === 'object' ? option.value : option;
                  const label = typeof option === 'object' ? option.label : option;
                  return (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  );
                })}
              </select>
            ) : (
              <input
                type={field.type || "text"}
                id={field.name}
                name={field.name}
                value={formData[field.name]}
                onChange={handleChange}
                placeholder={field.placeholder || ""}
                min={field.min}
                max={field.max}
                step={field.step}
                className="p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            )}
            {errors[field.name] && (
              <p className="text-red-500 text-sm mt-1">{errors[field.name]}</p>
            )}
          </div>
        ))}
        <button
          type="submit"
          className="w-full bg-green-500 text-white py-2 rounded-md hover:bg-green-600 transition"
        >
          {buttonLabel}
        </button>
      </form>
    </div>
  );
};

export default DynamicForm;