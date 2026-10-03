// components/DashboardLayout.jsx
import { useState } from "react";

const DashboardLayout = ({ headerContent, statsContent, transactionContent, newsContent }) => {
  const [walletBalance] = useState(22330.00); // Default value, can be passed as prop

  return (
    <div className="p-6 bg-gray-100 min-h-screen">
      {/* Header Section */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center space-x-4">
          <div className="bg-pink-200 text-gray-800 font-semibold py-2 px-4 rounded-lg">
            Company Logo
          </div>
          {headerContent}
        </div>
        <div className="flex items-center space-x-4">
          <div className="bg-purple-600 text-white py-2 px-4 rounded-lg">
            Wallet Balance: ₹{walletBalance.toFixed(2)}
          </div>
          <button className="bg-pink-500 text-white py-2 px-4 rounded-lg hover:bg-pink-600 transition">
            Payout
          </button>
        </div>
      </div>

      {/* Stats Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        {statsContent}
      </div>

      {/* Transaction Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        {transactionContent}
      </div>

      {/* News Section */}
      <div className="bg-cyan-100 p-6 rounded-lg shadow-md">
        <h2 className="text-xl font-semibold mb-4">News</h2>
        {newsContent || <p className="text-gray-600">[News content will be added here]</p>}
      </div>
    </div>
  );
};

export default DashboardLayout;