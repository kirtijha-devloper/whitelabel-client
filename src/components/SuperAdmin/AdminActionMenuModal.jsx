import React from "react";
import {
  X,
  SlidersHorizontal,
  Percent,
  Wallet,
  ChevronRight,
  Building,
  Globe,
  User,
} from "lucide-react";

const AdminActionMenuModal = ({
  isOpen,
  onClose,
  admin,
  onSelectServiceManagement,
  onSelectRateManagement,
  onSelectWalletManagement,
}) => {
  if (!isOpen || !admin) return null;

  const adminName = admin.name || "Administrator";
  const companyName =
    admin.company?.company_name ||
    admin.company_or_shop_name ||
    "Company Not Specified";
  const domainName = admin.company?.domain_name || null;
  const username = admin.username || admin.abheepay_id || `ID: ${admin.id}`;
  const walletBalance = Number(admin.wallet_balance ?? admin.wallet ?? 0);
  const isActive = admin.status === "active";

  const options = [
    {
      id: "service",
      title: "Service Management",
      description:
        "Configure and toggle enabled services (POS, PG, QR, Soundbox, DMT, Bill Payments)",
      icon: <SlidersHorizontal className="h-6 w-6 text-[#00D3CD]" />,
      iconBg: "bg-[#00D3CD]/10 border border-[#00D3CD]/20",
      badge: "Services",
      badgeColor: "bg-[#00D3CD]/10 text-[#00a8a3]",
      onClick: () => onSelectServiceManagement(admin),
    },
    {
      id: "rate",
      title: "Rate Management",
      description:
        "Configure transaction charges, rental slabs, and service commissions",
      icon: <Percent className="h-6 w-6 text-emerald-600" />,
      iconBg: "bg-emerald-50 border border-emerald-200",
      badge: "Rates & Slabs",
      badgeColor: "bg-emerald-50 text-emerald-700",
      onClick: () => onSelectRateManagement(admin),
    },
    {
      id: "wallet",
      title: "Wallet Management",
      description:
        "View current balance, perform credit or debit fund adjustments, and check ledger",
      icon: <Wallet className="h-6 w-6 text-blue-600" />,
      iconBg: "bg-blue-50 border border-blue-200",
      badge: `₹${walletBalance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`,
      badgeColor: "bg-blue-50 text-blue-700 font-semibold",
      onClick: () => onSelectWalletManagement(admin),
    },
  ];

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/50 backdrop-blur-[1px] p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-gray-100 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* HEADER */}
        <div className="flex items-start justify-between border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white px-6 py-5">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="rounded-lg bg-[#00D3CD]/15 p-1.5 text-[#00a8a3]">
                <User size={18} />
              </span>
              <h2 className="text-lg font-bold text-gray-900">
                Admin Management
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
              <span className="text-gray-500">{username}</span>
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

        {/* WALLET & QUICK STATS BAR */}
        <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50/70 px-6 py-2.5 text-xs">
          <span className="text-gray-500">Available Wallet Balance:</span>
          <span className="font-bold text-gray-900 text-sm">
            ₹
            {walletBalance.toLocaleString("en-IN", {
              minimumFractionDigits: 2,
            })}
          </span>
        </div>

        {/* ACTION OPTIONS LIST */}
        <div className="space-y-3 p-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
            Select Management Area
          </p>

          <div className="space-y-2.5">
            {options.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={opt.onClick}
                className="group flex w-full items-center justify-between rounded-xl border border-gray-200 bg-white p-4 text-left transition-all hover:border-[#00D3CD] hover:bg-[#00D3CD]/5 hover:shadow-sm"
              >
                <div className="flex items-start gap-3.5">
                  <div
                    className={`mt-0.5 rounded-xl p-2.5 transition-transform group-hover:scale-105 ${opt.iconBg}`}
                  >
                    {opt.icon}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-gray-900 group-hover:text-[#00a8a3] transition-colors">
                        {opt.title}
                      </h3>
                      {opt.badge && (
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${opt.badgeColor}`}
                        >
                          {opt.badge}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-gray-500 line-clamp-2">
                      {opt.description}
                    </p>
                  </div>
                </div>

                <div className="ml-3 flex-shrink-0 text-gray-400 group-hover:text-[#00a8a3] group-hover:translate-x-0.5 transition-all">
                  <ChevronRight size={20} />
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* FOOTER */}
        <div className="border-t border-gray-100 bg-gray-50 px-6 py-3.5 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-100 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminActionMenuModal;

