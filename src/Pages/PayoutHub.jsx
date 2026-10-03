import { useNavigate } from "react-router-dom";
import { ArrowRight, Banknote, Zap } from "lucide-react";
import { normalizeServiceFlags } from "../utils/serviceFlags";

/**
 * Payout Hub — displays a card for every enabled payout service.
 * If a service is disabled (globally or for this user), its card is hidden.
 */
const PAYOUT_SERVICES = [
  {
    serviceKey: "vimo_payout",
    label: "Payout",
    subtitle: "Vimo Network",
    description: "Send money instantly via Vimo payout channel.",
    path: "/merchant/vimo-payout",
    accent: "#00B9B2",   // teal
    badge: "P-1",
  },
  {
    serviceKey: "sevenpay_payout",
    label: "Payout-S",
    subtitle: "SevenPay Network",
    description: "Fast and reliable payouts via SevenPay.",
    path: "/merchant/sevenpay-payout",
    accent: "#7C3AED",  // violet
    badge: "P-S",
  },
  {
    serviceKey: "branchx_payout",
    label: "Payout 3",
    subtitle: "BranchX Network",
    description: "BranchX-powered secure money transfer.",
    path: "/merchant/branchx-payout",
    accent: "#0EA5E9",  // sky blue
    badge: "P-3",
  },
  {
    serviceKey: "ndia5_payout",
    label: "PAYOUT-N",
    subtitle: "NDIA5 Network",
    description: "High-throughput NDIA5 payout channel.",
    path: "/merchant/ndia5-payout",
    accent: "#F59E0B",  // amber
    badge: "P-N",
  },
  {
    serviceKey: "mx_payout",
    label: "Payout 5",
    subtitle: "MX Network",
    description: "MX-powered payout with competitive rates.",
    path: "/merchant/mx-payout",
    accent: "#EF4444",  // red
    badge: "P-5",
  },
];

const PayoutHub = ({ currentUser }) => {
  const navigate = useNavigate();
  const serviceFlags = normalizeServiceFlags(currentUser?.service_flags, true);

  // Only show cards for enabled services
  const visibleServices = PAYOUT_SERVICES.filter(
    (s) => serviceFlags[s.serviceKey]
  );

  return (
    <div className="min-h-[60vh] flex flex-col">
      {/* Page heading */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 rounded-xl bg-[#00B9B2]/10 flex items-center justify-center">
            <Banknote className="w-5 h-5 text-[#00B9B2]" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
            Payout Services
          </h1>
        </div>
        <p className="text-sm text-gray-500 ml-12">
          Select a payout channel to initiate a transfer.
        </p>
      </div>

      {/* Cards grid */}
      {visibleServices.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
            <Zap className="w-7 h-7 text-gray-400" />
          </div>
          <p className="text-gray-700 font-semibold text-lg mb-1">
            No Payout Services Available
          </p>
          <p className="text-gray-400 text-sm max-w-xs">
            All payout channels are currently disabled for your account.
            Please contact your administrator.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {visibleServices.map((service) => (
            <PayoutCard
              key={service.serviceKey}
              service={service}
              onClick={() => navigate(service.path)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/*  Individual Payout Card                                                      */
/* -------------------------------------------------------------------------- */
const PayoutCard = ({ service, onClick }) => {
  return (
    <button
      onClick={onClick}
      className="group relative w-full text-left rounded-2xl border border-gray-200 bg-white shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 overflow-hidden focus:outline-none focus:ring-2 focus:ring-offset-2"
      style={{ "--accent": service.accent, focusRingColor: service.accent }}
    >
      {/* Accent stripe on the left */}
      <span
        className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl transition-all duration-200 group-hover:w-1.5"
        style={{ backgroundColor: service.accent }}
      />

      {/* Badge */}
      <span
        className="absolute top-4 right-4 text-[10px] font-bold px-2 py-0.5 rounded-full"
        style={{
          backgroundColor: `${service.accent}18`,
          color: service.accent,
          border: `1px solid ${service.accent}40`,
        }}
      >
        {service.badge}
      </span>

      <div className="pl-6 pr-10 py-5">
        {/* Icon */}
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center mb-4 transition-transform duration-200 group-hover:scale-105"
          style={{ backgroundColor: `${service.accent}15` }}
        >
          <Banknote className="w-5 h-5" style={{ color: service.accent }} />
        </div>

        {/* Labels */}
        <p className="text-base font-bold text-gray-900 mb-0.5 leading-tight">
          {service.label}
        </p>

      </div>

      {/* Arrow CTA at the bottom */}
      <div
        className="flex items-center gap-1 px-6 py-3 text-xs font-semibold border-t border-gray-100 transition-colors duration-200"
        style={{ color: service.accent }}
      >
        Open <ArrowRight className="w-3.5 h-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
      </div>
    </button>
  );
};

export default PayoutHub;
