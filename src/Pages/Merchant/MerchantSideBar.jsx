import { Link, useLocation, useNavigate } from "react-router-dom";
import { useState } from "react";
import { 
  Wallet,
  CreditCard,
  BarChart3,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Box,
  Layers,
  HelpCircle
} from "lucide-react";
import AbheePayLogo from '../../assets/FORMAT-PNG.png';
import { PiLayout } from "react-icons/pi";
import { logoutCurrentSession } from "../../utils/auth";
import { normalizeServiceFlags } from "../../utils/serviceFlags";

const MerchantSideBar = ({ currentUser }) => {
  const [isCollapsed, setIsCollapsed] = useState(true);
  const location = useLocation();
  const navigate = useNavigate();
  const serviceFlags = normalizeServiceFlags(currentUser?.service_flags, true);
  const currentFullPath = location.pathname + location.search;
  const isActivePath = (path) => {
    if (path.includes("?")) {
      return currentFullPath === path;
    }
    // When on a flow with query params like ?flow=cc-bill-3, don't match the base route without query
    if (location.search && location.search.length > 1) {
      return false;
    }
    return location.pathname === path || location.pathname.startsWith(`${path}/`);
  };

  // Show the Payout Hub entry if at least one payout provider is enabled
  const PAYOUT_KEYS = ["vimo_payout", "sevenpay_payout", "branchx_payout", "ndia5_payout", "mx_payout"];
  const hasAnyPayout = PAYOUT_KEYS.some((k) => serviceFlags[k]);

  const menuItems = [
    { name: "Dashboard", path: "/merchant/dashboard", icon: <BarChart3 className="w-5 h-5" /> },
    // Single "Payout" hub entry — replaces the individual payout-x/v/s/n/mx items
    {
      name: "Payout",
      path: "/merchant/payout-hub",
      icon: <Layers className="w-5 h-5" />,
      // Active for any payout sub-route as well
      activePaths: [
        "/merchant/payout-hub",
        "/merchant/vimo-payout",
        "/merchant/sevenpay-payout",
        "/merchant/branchx-payout",
        "/merchant/ndia5-payout",
        "/merchant/mx-payout",
      ],
      disabled: !hasAnyPayout,
    },
    { name: "Ledger", path: "/merchant/ledger", icon: <Wallet className="w-5 h-5" /> },
    { name: "Charges", path: "/merchant/charges", icon: <CreditCard className="w-5 h-5" /> },
    {
      name: "CC Bill Pay",
      path: "/merchant/cc-bill-pay",
      icon: <CreditCard className="w-5 h-5" />,
      serviceKey: "cc_bill_pay",
    },
    {
      name: "BA CC Bill Pay",
      path: "/merchant/ba-cc-bill-pay",
      icon: <CreditCard className="w-5 h-5" />,
      serviceKey: "ba_cc_bill_pay",
    },
    {
      name: "CC Bill 3",
      path: "/merchant/ba-cc-bill-pay?flow=cc-bill-3",
      icon: <CreditCard className="w-5 h-5" />,
      serviceKey: "cc_bill_3",
    },
    { name: "Reports", path: "/merchant/reports", icon: <BarChart3 className="w-5 h-5" /> },
    { name: "Help", path: "/merchant/complaint-box", icon: <HelpCircle className="w-5 h-5" /> },
    { name: "Settings", path: "/merchant/setting", icon: <Settings className="w-5 h-5" /> },
  ];


  const handleLogout = () => {
    setTimeout(() => {
      logoutCurrentSession();
      navigate("/login");
    }, 500);
  };

  return (
    <>
      <div
        className={`fixed lg:static inset-y-0 left-0 z-40 bg-gray-900 transform transition-transform duration-300 ease-in-out
          ${isCollapsed ? "-translate-x-full lg:translate-x-0 lg:w-20" : "translate-x-0 w-64"}
          flex flex-col min-h-screen`}
      >
        {/* Logo Section */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          {!isCollapsed && <Link to={"/merchant/dashboard"} className="text-xl font-bold text-pink-500"><img src={AbheePayLogo} width={150}/></Link>}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="hidden lg:block p-1 rounded-lg hover:bg-gray-800 text-gray-400"
          >
            {isCollapsed ? (
              <ChevronRight className="w-5 h-5" />
            ) : (
              <ChevronLeft className="w-5 h-5" />
            )}
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-4">
          <ul className="space-y-2">
            {menuItems.filter((item) => !item.hidden).map((item) => {
              const isServiceDisabled = item.serviceKey && !serviceFlags[item.serviceKey];
              const isDisabled = Boolean(item.disabled || isServiceDisabled);
              const tooltip = isServiceDisabled
                ? "Service is currently disabled"
                : item.disabled
                ? "No payout services are enabled for your account"
                : item.tooltip;
              // Support multiple active paths (e.g. Payout hub highlights for all payout sub-routes)
              const isActive = item.activePaths
                ? item.activePaths.some((p) => isActivePath(p))
                : isActivePath(item.path);

              return (
                <li key={item.path}>
                  {isDisabled ? (
                    <div
                      title={tooltip}
                      className={`flex items-center px-3 py-2 rounded-lg transition-colors opacity-60 cursor-not-allowed text-gray-400`}
                    >
                      <span className="flex-shrink-0">{item.icon}</span>
                      {!isCollapsed && <span className="ml-3">{item.name}</span>}
                    </div>
                  ) : (
                    <Link
                      to={item.path}
                      title={tooltip}
                      className={`flex items-center px-3 py-2 rounded-lg transition-colors
                        ${isActive
                          ? "bg-[#00D3CD] text-white"
                          : "text-gray-400 hover:bg-gray-800 hover:text-white"
                        }`}
                    >
                      <span className="flex-shrink-0">{item.icon}</span>
                      {!isCollapsed && <span className="ml-3">{item.name}</span>}
                    </Link>
                  )}
                </li>
              );
            })}

          </ul>
        </nav>

        {/* Logout Button */}
        <div className="p-4 border-t border-gray-700">
          <button
            onClick={handleLogout}
            className="flex items-center px-3 py-2 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
          >
            <LogOut className="w-5 h-5" />
            {!isCollapsed && <span className="ml-3">Logout</span>}
          </button>
        </div>
      </div>
    </>
  );
};

export default MerchantSideBar;
