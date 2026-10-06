import React from "react";

const AdminStatCard = ({ title, value }) => {
  return (
    <div className="rounded-xl bg-white p-5 shadow-sm flex justify-between items-center ">

      <p className="text-sm font-medium text-gray-500">
        {title}
      </p>

      <h3 className="mt-3 w-10 h-10 rounded-full bg-black flex items-center justify-center text-3xl font-bold text-white ">
        {value}
      </h3>

    </div>
  );
};

export default AdminStatCard;