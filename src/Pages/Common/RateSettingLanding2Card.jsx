import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

const RateSettingLanding2Card = ({
  role = 'franchise',
  title,
  subtitle,
  posPath,
  pgPath,
  posTitle = 'POS Transaction Charges',
  pgTitle = 'PG Transaction Charges',
  posDesc,
  pgDesc,
  actionText,
}) => {
  const isMerchant = role === 'merchant';
  const isSuperFranchise = role === 'super_franchise' || role === 'superfranchise';

  const defaultBasePath = isMerchant
    ? '/merchant/charges'
    : isSuperFranchise
    ? '/super-franchise/rate-settings'
    : '/franchise/rate-settings';

  const resolvedTitle = title || (isMerchant ? 'Charges & Rates' : 'Rate Settings');
  const resolvedSubtitle = subtitle || (
    isMerchant
      ? 'View your applicable transaction charges for POS and Payment Gateway services.'
      : isSuperFranchise
      ? 'Configure downstream pricing for POS and Payment Gateway transactions for your franchises and merchants.'
      : 'Configure downstream pricing for POS and Payment Gateway transactions.'
  );

  const resolvedPosPath = posPath || `${defaultBasePath}/pos`;
  const resolvedPgPath = pgPath || `${defaultBasePath}/pg`;

  const resolvedPosDesc = posDesc || (
    isMerchant
      ? 'View applicable card swipe and UPI transaction charges for POS terminals.'
      : isSuperFranchise
      ? 'Configure POS card swipe and UPI transaction rates for your downline franchises and merchants.'
      : 'Configure POS card swipe and UPI transaction rates for your downline.'
  );

  const resolvedPgDesc = pgDesc || (
    isMerchant
      ? 'View applicable Payment Gateway transaction charges and MDR matrix.'
      : isSuperFranchise
      ? 'Configure Payment Gateway transaction rates and MDR charge rules for your downline franchises and merchants.'
      : 'Configure Payment Gateway transaction rates and MDR charge rules.'
  );

  const resolvedActionText = actionText || (isMerchant ? 'View Rates' : 'Configure Rates');

  const cardData = [
    {
      title: posTitle,
      desc: resolvedPosDesc,
      path: resolvedPosPath,
    },
    {
      title: pgTitle,
      desc: resolvedPgDesc,
      path: resolvedPgPath,
    },
  ];

  return (
    <div className="bg-gray-100 min-h-screen p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Main Title & Description */}
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">{resolvedTitle}</h1>
          <p className="text-sm text-gray-600 mt-1">{resolvedSubtitle}</p>
        </div>

        {/* 2-Card Grid */}
        <div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl">
            {cardData.map((card) => (
              <Link
                key={card.path}
                to={card.path}
                className="group block rounded-2xl border border-gray-200 bg-white p-6 shadow-sm hover:shadow-md hover:border-[#00D3CD]/50 transition-all"
              >
                <h3 className="text-lg font-bold text-gray-800 group-hover:text-[#008c87] transition-colors">
                  {card.title}
                </h3>
                <p className="text-sm text-gray-500 mt-2 line-clamp-2 leading-relaxed">
                  {card.desc}
                </p>
                <div className="mt-6 flex items-center gap-1.5 text-xs font-semibold text-[#008c87]">
                  <span>{resolvedActionText}</span>
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RateSettingLanding2Card;
