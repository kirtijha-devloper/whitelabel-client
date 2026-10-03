import React from 'react';
import { Link } from 'react-router-dom';

const cardData = [
  {
    title: 'POS Transaction Charges',
    desc: 'Default, Franchise and Unassigned transaction rate matrix in one place.',
    path: '/admin/rate-setting/txn',
  },
  {
    title: 'POS Rental Charges',
    desc: 'Manage POS rental defaults and merchant-specific rental fees.',
    path: '/admin/rate-setting/rental',
  },
  {
    title: 'CC Bill Pay Charges',
    desc: 'Configure BBPS (CC Bill Pay) charge slabs.',
    path: '/admin/rate-setting/cc-bill',
  },
  {
    title: 'Payout Charges',
    desc: 'Create and update payout charge slabs for merchants.',
    path: '/admin/rate-setting/payout',
  },
];

const AdminRateSettingLanding = () => {
  return (
    <div className="bg-gray-100 min-h-screen p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Rate Settings</h1>
          <p className="text-sm text-gray-600 mt-1">Choose a rate category to configure. Keep this interface clean and focused.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {cardData.map((card) => (
            <Link
              key={card.path}
              to={card.path}
              className="block rounded-xl border border-gray-200 bg-white p-4 shadow-sm hover:shadow-md transition"
            >
              <h2 className="text-lg font-semibold text-gray-800">{card.title}</h2>
              <p className="text-sm text-gray-500 mt-2">{card.desc}</p>
              <span className="mt-3 inline-flex items-center text-sm text-[#1855e4] font-semibold">Open &rarr;</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AdminRateSettingLanding;
