
import React from "react";
import DynamicForm from "../components/DynamicForm";

const CreateMerchant = () => {
  const merchantFields = [
    {
      label: "Merchant Name",
      name: "name",
      type: "text",
      required: true,
      placeholder: "Enter merchant name",
    },
    {
      label: "Email",
      name: "email",
      type: "email",
      required: true,
      placeholder: "Enter email",
      validate: (value) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(value) ? "" : "Invalid email address";
      },
    },
    {
      label: "Phone",
      name: "phone",
      type: "text",
      required: true,
      placeholder: "Enter phone number",
      validate: (value) => {
        const phoneRegex = /^\d{10}$/;
        return phoneRegex.test(value) ? "" : "Phone number must be 10 digits";
      },
    },
    {
      label: "Status",
      name: "status",
      type: "select",
      required: true,
      options: [
        { label: "Active", value: "Active" },
        { label: "Inactive", value: "Inactive" },
      ],
    },
  ];

  const handleSubmit = (formData) => {
    console.log("Merchant Created:", formData);
    alert("Merchant created successfully!");
  };

  return (
    <div className="p-6 bg-gray-100 min-h-screen">
      <DynamicForm
        fields={merchantFields}
        onSubmit={handleSubmit}
        title="Create Merchant"
        buttonLabel="Create Merchant"
      />
    </div>
  );
};

export default CreateMerchant;