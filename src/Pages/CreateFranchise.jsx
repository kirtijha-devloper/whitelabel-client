
import React from "react";
import DynamicForm from "../components/DynamicForm";

const CreateFranchise = () => {
  const franchiseFields = [
    {
      label: "Franchise Name",
      name: "name",
      type: "text",
      required: true,
      placeholder: "Enter franchise name",
    },
    {
      label: "Location",
      name: "location",
      type: "text",
      required: true,
      placeholder: "Enter location",
    },
    {
      label: "Owner Name",
      name: "owner",
      type: "text",
      required: true,
      placeholder: "Enter owner name",
    },
    {
      label: "Contact Email",
      name: "email",
      type: "email",
      required: true,
      placeholder: "Enter contact email",
      validate: (value) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(value) ? "" : "Invalid email address";
      },
    },
  ];

  const handleSubmit = (formData) => {
    console.log("Franchise Created:", formData);
    alert("Franchise created successfully!");
  };

  return (
    <div className="p-6 bg-gray-100 min-h-screen">
      <DynamicForm
        fields={franchiseFields}
        onSubmit={handleSubmit}
        title="Create Franchise"
        buttonLabel="Create Franchise"
      />
    </div>
  );
};

export default CreateFranchise;