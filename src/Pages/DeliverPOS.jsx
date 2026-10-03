// Pages/DeliveryPOS.jsx
import React from "react";
import DynamicForm from "../components/DynamicForm";
import { useNavigate } from "react-router-dom";

const DeliveryPOS = () => {
  const navigate = useNavigate();

  const deliveryFields = [
    {
      label: "Serial Number",
      name: "serialNumber",
      type: "text",
      required: true,
      placeholder: "Enter serial number to deliver",
    },
    {
      label: "Delivery Date",
      name: "deliveryDate",
      type: "date",
      required: true,
    },
  ];

  const handleSubmit = (formData) => {
    console.log("POS Machine Delivered:", formData);
    alert("POS Machine marked as delivered!");
    navigate("/stock-pos");
  };

  return (
    <div className="p-6 bg-gray-100 min-h-screen">
      <DynamicForm
        fields={deliveryFields}
        onSubmit={handleSubmit}
        title="Mark POS Machine as Delivered"
        buttonLabel="Mark Delivered"
      />
    </div>
  );
};

export default DeliveryPOS;