import React from 'react';
import TransactionCard from './TransactionCard';



const RecentRemitters = ({ remitters }) => {
  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Recent Remitters</h2>
        <span className="text-sm text-gray-500">{remitters.length} registered</span>
      </div>
      
      <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
        {remitters.map((remitter) => (
          <div 
            key={remitter.id}
            className="bg-gray-50 flex justify-between rounded-lg p-4 hover:bg-gray-100 transition-colors duration-200"
          >
            <p className="font-medium text-gray-900">{remitter.name}</p>
            <p className="text-sm text-gray-600">{remitter.mobile}</p>
            <p className="text-xs text-gray-500 mt-1">{remitter.registeredAt}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default RecentRemitters;