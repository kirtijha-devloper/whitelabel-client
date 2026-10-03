
import React from "react";
import DynamicForm from "../components/DynamicForm";
import { useNavigate } from "react-router-dom";

const AddEditPOS = () => {
  const navigate = useNavigate();

  const addEditFields = [
    {
      label: "Serial Number",
      name: "serialNumber",
      type: "text",
      required: true,
      placeholder: "Enter serial number",
    },
    {
      label: "Location",
      name: "location",
      type: "text",
      required: true,
      placeholder: "Enter location",
    },
    {
      label: "Status",
      name: "status",
      type: "select",
      required: true,
      options: [
        { label: "Active", value: "Active" },
        { label: "D-Active", value: "D-Active" },
      ],
    },
  ];

  const handleSubmit = (formData) => {
    console.log("POS Machine Added/Edited:", formData);
    alert("POS Machine added/edited successfully!");
    navigate("/stock-pos");
  };

  return (
    <div className="p-6 bg-gray-100 min-h-screen">
      <DynamicForm
        fields={addEditFields}
        onSubmit={handleSubmit}
        title="Add/Edit POS Machine"
        buttonLabel="Save POS Machine"
      />
    </div>
  );
};

export default AddEditPOS;