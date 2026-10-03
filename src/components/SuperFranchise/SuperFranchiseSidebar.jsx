import { Link, useLocation, useNavigate } from "react-router-dom";
import { useState } from "react";
import { FaUserPlus, FaUsers, FaBox, FaFileAlt, FaWallet, FaMoneyBillWave, FaChartBar, FaDatabase, FaCog, FaSignOutAlt, FaCube, FaSlidersH, FaQuestionCircle } from "react-icons/fa";
import { IoMenu } from "react-icons/io5";
import AbheePayLogo from '../../assets/FORMAT-PNG.png';
import { ChevronLeft, ChevronRight } from "lucide-react";
import { PiLayout } from "react-icons/pi";
import { logoutCurrentSession } from "../../utils/auth";
import { normalizeServiceFlags } from "../../utils/serviceFlags";

const SuperFranchiseSidebar = ({ currentUser }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const serviceFlags = normalizeServiceFlags(currentUser?.service_flags, true);

  const toggleSidebar = () => setIsCollapsed(!isCollapsed);
  const currentPath = location.pathname + location.search;
  const isActivePath = (path) => {
    if (path.includes("?")) {
      return currentPath === path;
    }
    return currentPath === path || location.pathname.startsWith(`${path}/`);
  };

  const menuItems = [
    { name: "Dashboard", path: "/super-franchise/dashboard", icon: <FaCube /> },
    { name: "Create User", path: "/super-franchise/create-user", icon: <FaUserPlus /> },
    { name: "User List", path: "/super-franchise/franchise-list", icon: <FaUsers /> },
    // { name: "Merchant List", path: "/super-franchise/list", icon: <FaUserPlus /> },
    { name: "Stock POS", path: "/super-franchise/stock-pos", icon: <FaBox /> },
    {
      name: "Payout-X",
      path: "/super-franchise/branchx-payout",
      icon: <PiLayout className="w-5 h-5" />,
      serviceKey: "branchx_payout",
    },
    {
      name: "Payout-V",
      path: "/super-franchise/vimo-payout",
      icon: <PiLayout className="w-5 h-5" />,
      serviceKey: "vimo_payout",
    },
    {
      name: "Payout-S",
      path: "/super-franchise/sevenpay-payout",
      icon: <PiLayout className="w-5 h-5" />,
      serviceKey: "sevenpay_payout",
    },
    {
      name: "PAYOUT-N",
      path: "/super-franchise/ndia5-payout",
      icon: <PiLayout className="w-5 h-5" />,
      serviceKey: "ndia5_payout",
    },
    {
      name: "Payout-M-X",
      path: "/super-franchise/mx-payout",
      icon: <PiLayout className="w-5 h-5" />,
      serviceKey: "mx_payout",
    },
    {
      name: "CC Bill Pay",
      path: "/super-franchise/cc-bill-pay",
      icon: <FaMoneyBillWave />,
      serviceKey: "cc_bill_pay",
    },
    {
      name: "BA CC Bill Pay",
      path: "/super-franchise/ba-cc-bill-pay",
      icon: <FaMoneyBillWave />,
      serviceKey: "ba_cc_bill_pay",
    },
    {
      name: "CC Bill 3",
      path: "/super-franchise/ba-cc-bill-pay?flow=cc-bill-3",
      icon: <FaMoneyBillWave />,
      serviceKey: "cc_bill_3",
    },
    { name: "Reports", path: "/super-franchise/reports", icon: <FaChartBar /> },
    { name: "Ledger", path: "/super-franchise/ledger", icon: <FaDatabase /> },
    { name: "Charges", path: "/super-franchise/franchise-charges", icon: <FaMoneyBillWave /> },
    { name: "Settlement", path: "/super-franchise/pos-setting", icon: <FaSlidersH /> },
    { name: "Help", path: "/super-franchise/complaint-box", icon: <FaQuestionCircle /> },
    { name: "Setting", path: "/super-franchise/setting", icon: <FaCog /> },
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
          {!isCollapsed && (
            <Link to="/super-franchise/dashboard" className="text-xl font-bold text-pink-500">
              <img src={AbheePayLogo} width={150} alt="AbheePay Logo" />
            </Link>
          )}
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
            className="flex items-center px-3 py-2 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors w-full"
          >
            <FaSignOutAlt className="w-5 h-5 flex-shrink-0" />
            {!isCollapsed && <span className="ml-3">Logout</span>}
          </button>
        </div>
      </div>
    </>
  );
};

export default SuperFranchiseSidebar;
