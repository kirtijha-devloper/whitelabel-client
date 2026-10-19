import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

const AdminRateSettingLanding = () => {
  const location = useLocation();
  const isSuperAdminRoute = location.pathname.startsWith('/super-admin');
  const basePath = isSuperAdminRoute
    ? '/super-admin/rate-setting'
    : '/admin/rate-setting';

  const cardData = [
    {
      title: 'POS Transaction Charges',
      desc: isSuperAdminRoute
        ? 'Default and Admin-level transaction rate matrix in one place.'
        : 'Configure POS transaction rates for Super Franchise (Default & Overrides).',
      path: `${basePath}/txn`,
    },
    {
      title: 'POS Rental Charges',
      desc: isSuperAdminRoute
        ? 'Manage POS rental charges applicable to Admin accounts.'
        : 'Manage POS monthly rental defaults and terminal rental fees for downline.',
      path: `${basePath}/rental`,
    },
    {
      title: 'CC Bill Pay Charges',
      desc: 'Configure BBPS (Credit Card Bill Pay) commission and charge slabs.',
      path: `${basePath}/cc-bill`,
    },
    {
      title: 'Payout Charges',
      desc: 'Configure payout transaction fees and slab-wise transfer charges.',
      path: `${basePath}/payout`,
    },
  ];

  return (
    <div className="bg-gray-100 min-h-screen p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Main Title & Description */}
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Rate Settings</h1>
          <p className="text-sm text-gray-600 mt-1">
            {isSuperAdminRoute
              ? 'Manage platform base rates and Admin-specific rate assignments.'
              : 'Configure downstream pricing for Super Franchise, Franchise, and Merchants.'}
          </p>
        </div>

        {/* Category Navigation Cards */}
        <div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {cardData.map((card) => (
              <Link
                key={card.path}
                to={card.path}
                className="group block rounded-2xl border border-gray-200 bg-white p-5 shadow-sm hover:shadow-md hover:border-[#00D3CD]/50 transition-all"
              >
                <h3 className="text-base font-bold text-gray-800 group-hover:text-[#008c87] transition-colors">
                  {card.title}
                </h3>
                <p className="text-xs text-gray-500 mt-2 line-clamp-2 leading-relaxed">
                  {card.desc}
                </p>
                <div className="mt-4 flex items-center gap-1.5 text-xs font-semibold text-[#008c87]">
                  <span>Configure Rates</span>
                  <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminRateSettingLanding;
