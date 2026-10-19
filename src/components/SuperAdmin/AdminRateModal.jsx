import React from "react";
import { useNavigate } from "react-router-dom";
import {
  X,
  CreditCard,
  ArrowUpRight,
  ShieldCheck,
  ChevronRight,
  Building,
  Globe,
  User,
  Sliders,
  ExternalLink,
} from "lucide-react";

/**
 * AdminRateModal (Step 2: Rate Category Selection Modal)
 * Displays the selected admin's details and three clickable cards:
 * 1. POS Rate
 * 2. Pay Rate
 * 3. CC Bill Rate
 */
const AdminRateModal = ({ isOpen, onClose, admin }) => {
  const navigate = useNavigate();

  if (!isOpen || !admin) return null;

  const adminName = admin.name || "Administrator";
  const adminCode = admin.abheepay_id || admin.username || `ID: #${admin.id}`;
  const companyName =
    admin.company?.company_name ||
    admin.company_or_shop_name ||
    "Company Not Specified";
  const domainName = admin.company?.domain_name || "Platform Admin";
  const isActive = admin.status === "active";

  const categories = [
    {
      id: "pos",
      title: "POS Rate",
      badge: "POS & Card Rules",
      badgeColor: "bg-[#00D3CD]/10 text-[#00a8a3] border-[#00D3CD]/20",
      icon: <CreditCard className="h-6 w-6 text-[#00a8a3]" />,
      iconBg: "bg-[#00D3CD]/10 border border-[#00D3CD]/20",
      description:
        "Manage POS card transaction charges, applicable transaction methods, networks, card types, classifications, amount ranges, settlement types, flat charges, GST, and percentage rates.",
      actionText: "Configure POS Rates",
      onClick: () => {
        onClose();
        navigate(`/super-admin/admin/${admin.id}/rates/pos`, {
          state: { admin },
        });
      },
    },
    {
      id: "pay",
      title: "Pay Rate",
      badge: "Payout & Banking",
      badgeColor: "bg-blue-50 text-blue-700 border-blue-200",
      icon: <ArrowUpRight className="h-6 w-6 text-blue-600" />,
      iconBg: "bg-blue-50 border border-blue-200",
      description:
        "Manage the applicable payout and banking transaction rates. Configure slab-wise flat or percentage fees across Instant Payout (IMPS), NEFT, and RTGS methods.",
      actionText: "Configure Pay Rates",
      onClick: () => {
        onClose();
        navigate(`/super-admin/admin/${admin.id}/rates/pay`, {
          state: { admin },
        });
      },
    },
    {
      id: "cc-bill",
      title: "CC Bill Rate",
      badge: "Credit Card Bill",
      badgeColor: "bg-purple-50 text-purple-700 border-purple-200",
      icon: <ShieldCheck className="h-6 w-6 text-purple-600" />,
      iconBg: "bg-purple-50 border border-purple-200",
      description:
        "Manage the applicable credit card bill payment charges. Configure slab-wise charges, fee types, and custom overrides for BBPS credit card bill payments.",
      actionText: "Configure CC Bill Rates",
      onClick: () => {
        onClose();
        navigate(`/super-admin/admin/${admin.id}/rates/cc-bill`, {
          state: { admin },
        });
      },
    },
  ];

  const handleOpenAllRates = () => {
    onClose();
    navigate(`/super-admin/admin/${admin.id}/rates`, {
      state: { admin },
    });
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-[2px] p-4">
      <div className="w-full max-w-3xl rounded-2xl bg-white shadow-2xl border border-gray-100 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* HEADER */}
        <div className="flex items-start justify-between border-b border-gray-100 bg-gradient-to-r from-gray-50 via-white to-gray-50 px-6 py-5">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="rounded-lg bg-[#00D3CD]/15 p-1.5 text-[#00a8a3]">
                <Sliders size={18} />
              </span>
              <h2 className="text-lg font-bold text-gray-900">
                Rate Management
              </h2>
              <span
                className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize ${
                  isActive
                    ? "bg-green-100 text-green-700 border border-green-200"
                    : "bg-red-100 text-red-700 border border-red-200"
                }`}
              >
                {admin.status || "active"}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-gray-600">
              <span className="font-semibold text-gray-900">{adminName}</span>
              <span className="text-gray-300">•</span>
              <span className="font-mono text-gray-500">{adminCode}</span>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
              <span className="inline-flex items-center gap-1 font-medium text-blue-600">
                <Building size={12} />
                {companyName}
              </span>
              {domainName && (
                <>
                  <span className="text-gray-300">•</span>
                  <span className="inline-flex items-center gap-1 text-gray-500">
                    <Globe size={12} />
                    {domainName}
                  </span>
                </>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
            title="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* INFORMATIVE SUBHEADER */}
        <div className="bg-gray-50/80 border-b border-gray-100 px-6 py-3 flex items-center justify-between text-xs text-gray-600">
          <span>
            Select a rate category below to inspect platform defaults and configure admin-specific overrides.
          </span>
          <button
            type="button"
            onClick={handleOpenAllRates}
            className="inline-flex items-center gap-1 font-semibold text-[#00a8a3] hover:underline"
          >
            <span>Overview Hub</span>
            <ExternalLink size={12} />
          </button>
        </div>

        {/* CATEGORY CARDS */}
        <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          {categories.map((cat) => (
            <div
              key={cat.id}
              onClick={cat.onClick}
              className="group cursor-pointer rounded-xl border border-gray-200 bg-white p-5 shadow-sm hover:border-[#00D3CD] hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between">
                  <div className={`rounded-xl p-2.5 ${cat.iconBg} group-hover:scale-105 transition-transform`}>
                    {cat.icon}
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold border ${cat.badgeColor}`}>
                    {cat.badge}
                  </span>
                </div>

                <h3 className="text-base font-bold text-gray-900 mt-4 group-hover:text-[#00a8a3] transition-colors">
                  {cat.title}
                </h3>
                <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">
                  {cat.description}
                </p>
              </div>

              <div className="mt-5 pt-3 border-t border-gray-100 flex items-center justify-between text-xs font-semibold text-[#00a8a3] group-hover:translate-x-1 transition-transform">
                <span>{cat.actionText}</span>
                <ChevronRight size={14} />
              </div>
            </div>
          ))}
        </div>

        {/* FOOTER */}
        <div className="border-t border-gray-100 bg-gray-50/50 px-6 py-3.5 flex items-center justify-between">
          <p className="text-xs text-gray-500">
            Platform defaults remain unchanged. All changes are saved specifically for {adminName}.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminRateModal;
