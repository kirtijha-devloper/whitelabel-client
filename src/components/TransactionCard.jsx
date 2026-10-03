import React from 'react';

const TransactionCard = ({ transaction }) => {
  return (
    <div className="bg-white rounded-xl shadow-sm p-6 flex justify-between items-center">
      <div>
        <p className="font-medium text-gray-900">{transaction.beneficiary}</p>
        <p className="text-sm text-gray-600">{transaction.date}</p>
      </div>
      <div className="text-right">
        <p className="font-medium text-gray-900">{transaction.amount}</p>
        <p
          className={`text-sm ${
            transaction.status === 'completed'
              ? 'text-green-600'
              : transaction.status === 'pending'
              ? 'text-yellow-600'
              : 'text-red-600'
          }`}
        >
          {transaction.status}
        </p>
      </div>
    </div>
  );
};

export default TransactionCard;