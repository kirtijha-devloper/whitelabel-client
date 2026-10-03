import { Link, useLocation, useNavigate } from "react-router-dom";
import { useState } from "react";
import { FaUserPlus, FaBox, FaFileAlt, FaWallet, FaMoneyBillWave, FaChartBar, FaDatabase, FaCog, FaSignOutAlt, FaCube, FaSlidersH, FaQuestionCircle } from "react-icons/fa";
import { IoMenu } from "react-icons/io5";
import AbheePayLogo from '../../assets/FORMAT-PNG.png';
import { ChevronLeft, ChevronRight } from "lucide-react";
import { PiLayout } from "react-icons/pi";
import { logoutCurrentSession } from "../../utils/auth";
import { normalizeServiceFlags } from "../../utils/serviceFlags";

const FranchiseSidebar = ({ currentUser }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const serviceFlags = normalizeServiceFlags(currentUser?.service_flags, true);

  const toggleSidebar = () => setIsCollapsed(!isCollapsed);
  const currentPath = location.pathname + location.search
  const isActivePath = (path) =>{
    if(path.includes("?")) {
      return currentPath === path;
    }
    return currentPath === path;
  }

  const menuItems = [
    { name: "Dashboard", path: "/franchise/dashboard", icon: <FaCube /> },
    { name: "Create Merchant", path: "/franchise/create-user", icon: <FaUserPlus /> },
    { name: "Merchant List", path: "/franchise/list", icon: <FaUserPlus /> },
    { name: "Stock POS", path: "/franchise/stock-pos", icon: <FaBox /> },
    {
      name: "Payout-X",
      path: "/franchise/branchx-payout",
      icon: <PiLayout className="w-5 h-5" />,
      serviceKey: "branchx_payout",
    },
    {
      name: "Payout-V",
      path: "/franchise/vimo-payout",
      icon: <PiLayout className="w-5 h-5" />,
      serviceKey: "vimo_payout",
    },
    {
      name: "Payout-S",
      path: "/franchise/sevenpay-payout",
      icon: <PiLayout className="w-5 h-5" />,
      serviceKey: "sevenpay_payout",
    },
    {
      name: "PAYOUT-N",
      path: "/franchise/ndia5-payout",
      icon: <PiLayout className="w-5 h-5" />,
      serviceKey: "ndia5_payout",
    },
    {
      name: "Payout-M-X",
      path: "/franchise/mx-payout",
      icon: <PiLayout className="w-5 h-5" />,
      serviceKey: "mx_payout",
    },
    {
      name: "CC Bill Pay",
      path: "/franchise/cc-bill-pay",
      icon: <FaMoneyBillWave />,
      serviceKey: "cc_bill_pay",
    },
    {
      name: "BA CC Bill Pay",
      path: "/franchise/ba-cc-bill-pay",
      icon: <FaMoneyBillWave />,
      serviceKey: "ba_cc_bill_pay",
    },
    {
      name: "CC Bill 3",
      path: "/franchise/ba-cc-bill-pay?flow=cc-bill-3",
      icon: <FaMoneyBillWave />,
      serviceKey: "cc_bill_3",
    },
    { name: "Reports", path: "/franchise/reports", icon: <FaChartBar /> },
    { name: "Ledger", path: "/franchise/ledger", icon: <FaDatabase /> },
    { name: "Charges", path: "/franchise/merchant-rates", icon: <FaMoneyBillWave /> },
    { name: "Settlement", path: "/franchise/pos-setting", icon: <FaSlidersH /> },
    { name: "Help", path: "/franchise/complaint-box", icon: <FaQuestionCircle /> },
    { name: "Setting", path: "/franchise/setting", icon: <FaCog /> },
  ];

  const handleLogout = () => {
    setTimeout(() => {
      logoutCurrentSession();
      navigate("/login");
    }, 500);
  };

  return (
    <>
      {/* Mobile Menu Button */}
      <button
        className="lg:hidden fixed top-4 right-4 z-50 p-2 bg-gray-900 text-white rounded-lg"
        onClick={toggleSidebar}
      >
        <IoMenu className="w-6 h-6" />
      </button>

      <div
        className={`fixed lg:static inset-y-0 left-0 z-40 bg-gray-900 transform transition-transform duration-300 ease-in-out
          ${isCollapsed ? "-translate-x-full lg:translate-x-0 lg:w-20" : "translate-x-0 w-64"}
          flex flex-col min-h-screen`}
      >
        {/* Logo Section */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          {!isCollapsed && <Link to={"/franchise/dashboard"} className="text-xl font-bold text-pink-500"><img src={AbheePayLogo} width={150}/></Link>}
          <button
            onClick={toggleSidebar}
            className="hidden lg:block p-1 rounded-lg hover:bg-gray-800 text-gray-400"
          >
            {isCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-4">
          <ul className="space-y-2">
            {menuItems.filter((item) => !item.hidden).map((item) => {
              const isServiceDisabled = item.serviceKey && !serviceFlags[item.serviceKey];
              const isDisabled = Boolean(item.disabled || isServiceDisabled);
              const tooltip = isServiceDisabled ? "Service is currently disabled" : item.tooltip;

              return (
                <li key={item.path}>
                  {isDisabled ? (
                    <div
                      title={tooltip}
                      className="flex items-center px-3 py-2 rounded-lg transition-colors opacity-60 cursor-not-allowed text-gray-400"
                    >
                      <span className="flex-shrink-0">{item.icon}</span>
                      {!isCollapsed && <span className="ml-3">{item.name}</span>}
                    </div>
                  ) : (
                    <Link
                      to={item.path}
                      title={tooltip}
                      className={`flex items-center px-3 py-2 rounded-lg transition-colors
                        ${isActivePath(item.path)
                          ? "bg-[#00D3CD] text-white"
                          : "text-gray-400 hover:bg-gray-800 hover:text-white"}
                      `}
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
            <FaSignOutAlt className="w-5 h-5" />
            {!isCollapsed && <span className="ml-3">Logout</span>}
          </button>
        </div>
      </div>
    </>
  );
};

export default FranchiseSidebar;
