import { useNavigate } from "react-router-dom";
import { ArrowRight, CreditCard, Zap } from "lucide-react";
import { normalizeServiceFlags } from "../utils/serviceFlags";

const CC_BILL_SERVICES = [
  {
    serviceKey: "cc_bill_pay",
    label: "CC Bill 1",
    subtitle: "Primary Gateway",
    description: "Instant credit card bill payments with fast settlement.",
    path: "/merchant/cc-bill-pay",
    accent: "#00B9B2", // Teal
    badge: "CC Bill 1",
  },
  {
    serviceKey: "ba_cc_bill_pay",
    label: "CC Bill 2",
    subtitle: "BillAvenue BBPS",
    description: "BBPS powered credit card bill payments via BillAvenue.",
    path: "/merchant/ba-cc-bill-pay",
    accent: "#7C3AED", // Violet
    badge: "CC Bill 2",
  },
  {
    serviceKey: "cc_bill_3",
    label: "CC Bill 3",
    subtitle: "Alternate BBPS",
    description: "High-success alternate credit card bill payment flow.",
    path: "/merchant/ba-cc-bill-pay?flow=cc-bill-3",
    accent: "#F59E0B", // Amber
    badge: "CC Bill 3",
  },
];

const CCBillHub = ({ currentUser }) => {
  const navigate = useNavigate();
  const serviceFlags = normalizeServiceFlags(currentUser?.service_flags, true);

  // Only show cards for enabled services
  const visibleServices = CC_BILL_SERVICES.filter(
    (s) => serviceFlags[s.serviceKey]
  );

  return (
    <div className="min-h-[60vh] flex flex-col">
      {/* Page heading */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 rounded-xl bg-[#00B9B2]/10 flex items-center justify-center">
            <CreditCard className="w-5 h-5 text-[#00B9B2]" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
            Credit Card Bill Services
          </h1>
        </div>
        <p className="text-sm text-gray-500 ml-12">
          Select a credit card payment channel to process bill payments.
        </p>
      </div>

      {/* Cards grid */}
      {visibleServices.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
            <Zap className="w-7 h-7 text-gray-400" />
          </div>
          <p className="text-gray-700 font-semibold text-lg mb-1">
            No CC Bill Services Available
          </p>
          <p className="text-gray-400 text-sm max-w-xs">
            All credit card bill payment channels are currently disabled for your account.
            Please contact your administrator.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {visibleServices.map((service) => (
            <CCBillCard
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

const CCBillCard = ({ service, onClick }) => {
  return (
    <button
      onClick={onClick}
      className="group relative w-full text-left rounded-2xl border border-gray-200 bg-white shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 overflow-hidden focus:outline-none focus:ring-2 focus:ring-offset-2"
      style={{ focusRingColor: service.accent }}
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
          <CreditCard className="w-5 h-5" style={{ color: service.accent }} />
        </div>

        {/* Labels */}
        <p className="text-base font-bold text-gray-900 mb-0.5 leading-tight">
          {service.label}
        </p>
        <p className="text-xs text-gray-500 mt-1">
          {service.description}
        </p>
      </div>

      {/* Arrow CTA at bottom */}
      <div
        className="flex items-center gap-1 px-6 py-3 text-xs font-semibold border-t border-gray-100 transition-colors duration-200"
        style={{ color: service.accent }}
      >
        Open <ArrowRight className="w-3.5 h-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
      </div>
    </button>
  );
};

export default CCBillHub;