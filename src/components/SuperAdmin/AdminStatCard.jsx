import React from "react";

const AdminStatCard = ({ title, value }) => {
  return (
    <div className="rounded-xl bg-white p-5 shadow-sm">

      <p className="text-sm font-medium text-gray-500">
        {title}
      </p>

      <h3 className="mt-3 text-3xl font-bold text-gray-800">
        {value}
      </h3>

    </div>
  );
};

export default AdminStatCard;