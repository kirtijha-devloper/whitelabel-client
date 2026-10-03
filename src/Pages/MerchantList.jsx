// Pages/MerchantList.jsx
import React from "react";
import Table from "../components/Table";
import { MdDelete, MdEdit } from "react-icons/md";

import { maskEmailForUser } from "../utils/userAccess";

const MerchantList = ({ currentUser }) => {
  // Dummy data for 10 merchants
  const merchantData = [
    { id: 1, name: "Merchant A", email: "merchantA@example.com", phone: "123-456-7890", status: "Active" },
    { id: 2, name: "Merchant B", email: "merchantB@example.com", phone: "234-567-8901", status: "Inactive" },
    { id: 3, name: "Merchant C", email: "merchantC@example.com", phone: "345-678-9012", status: "Active" },
    { id: 4, name: "Merchant D", email: "merchantD@example.com", phone: "456-789-0123", status: "Active" },
    { id: 5, name: "Merchant E", email: "merchantE@example.com", phone: "567-890-1234", status: "Inactive" },
    { id: 6, name: "Merchant F", email: "merchantF@example.com", phone: "678-901-2345", status: "Active" },
    { id: 7, name: "Merchant G", email: "merchantG@example.com", phone: "789-012-3456", status: "Active" },
    { id: 8, name: "Merchant H", email: "merchantH@example.com", phone: "890-123-4567", status: "Inactive" },
    { id: 9, name: "Merchant I", email: "merchantI@example.com", phone: "901-234-5678", status: "Active" },
    { id: 10, name: "Merchant J", email: "merchantJ@example.com", phone: "012-345-6789", status: "Active" },
  ];

  // Define table columns
  const columns = [
    { header: "ID", key: "id" },
    { header: "Name", key: "name" },
    { header: "Email", key: "email", render: (email) => <span className="text-sm text-gray-700">{maskEmailForUser(email, currentUser)}</span> },
    { header: "Phone", key: "phone" },
    {
      header: "Status",
      key: "status",
      render: (status) => (
        <span
          className={`px-2 py-1 rounded-full text-xs font-semibold ${
            status === "Active" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
          }`}
        >
          {status}
        </span>
      ),
    },
  ];

  const actions = [
    { label: <MdEdit className=" text-black text-xl"/>, onClick: (row) => console.log("Edit", row) },
    { label: <MdDelete  className=" text-red-500 text-xl"/>, onClick: (row) => console.log("Delete", row) },
  ];

  const handleRowClick = (row) => {
    console.log("Row clicked:", row);
  };

  return (
    <div className=" bg-gray-100 min-h-screen">
      <h1 className="text-2xl font-bold mb-4 text-gray-800">Merchant List</h1>
      <Table columns={columns} data={merchantData} onRowClick={handleRowClick} actions={actions}/>
    </div>
  );
};

export default MerchantList;