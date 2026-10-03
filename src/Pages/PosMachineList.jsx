// Pages/PosMachineList.jsx
import React from "react";
import Table from "../components/Table";
import Sidebar from "../components/Sidebar";

import { maskEmailForUser } from "../utils/userAccess";

const PosMachineList = ({ currentUser }) => {
  const PosMachineData = [
    { id: 1, name: "PosMachine A", email: "PosMachineA@example.com", phone: "123-456-7890", status: "Active" },
    { id: 2, name: "PosMachine B", email: "PosMachineB@example.com", phone: "234-567-8901", status: "Inactive" },
    { id: 3, name: "PosMachine C", email: "PosMachineC@example.com", phone: "345-678-9012", status: "Active" },
    { id: 4, name: "PosMachine D", email: "PosMachineD@example.com", phone: "456-789-0123", status: "Active" },
    { id: 5, name: "PosMachine E", email: "PosMachineE@example.com", phone: "567-890-1234", status: "Inactive" },
    { id: 6, name: "PosMachine F", email: "PosMachineF@example.com", phone: "678-901-2345", status: "Active" },
    { id: 7, name: "PosMachine G", email: "PosMachineG@example.com", phone: "789-012-3456", status: "Active" },
    { id: 8, name: "PosMachine H", email: "PosMachineH@example.com", phone: "890-123-4567", status: "Inactive" },
    { id: 9, name: "PosMachine I", email: "PosMachineI@example.com", phone: "901-234-5678", status: "Active" },
    { id: 10, name: "PosMachine J", email: "PosMachineJ@example.com", phone: "012-345-6789", status: "Active" },
  ];

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

  const handleRowClick = (row) => {
    console.log("Row clicked:", row);
  };

  return (
    <div className=" flex ">
      <Sidebar/> 
    <div className="p-6 bg-gray-100 min-h-screen w-full">
      <h1 className="text-2xl font-bold mb-6 text-gray-800">Pos Machine List</h1>
      <Table columns={columns} data={PosMachineData} onRowClick={handleRowClick} />
    </div>
    </div>
  );
};

export default PosMachineList;