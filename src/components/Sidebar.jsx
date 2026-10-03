import { Link, useLocation, useNavigate } from "react-router-dom";
import { useState } from "react";
import { FaUserPlus, FaUsers, FaIdBadge, FaBox, FaFileAlt, FaWallet, FaCommentDots, FaMoneyBillWave, FaChartBar, FaDatabase, FaCog, FaSignOutAlt, FaCube, FaSlidersH } from "react-icons/fa";
import { IoMenu } from "react-icons/io5";
import AbheePayLogo from '../assets/FORMAT-PNG.png';
import { ChevronLeft, ChevronRight } from "lucide-react";
import { logoutCurrentSession } from "../utils/auth";
import { getAdminLandingPathForUser, hasAnyPermission, hasPermission, isAdminUser } from "../utils/accessControl";

const Sidebar = ({ currentUser }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const isAdmin = isAdminUser(currentUser);
  const isEmployee = currentUser?.role && String(currentUser?.role).toLowerCase() === 'employee';
  const landingPath = getAdminLandingPathForUser(currentUser);

  const toggleSidebar = () => setIsCollapsed(!isCollapsed);
  const isActivePath = (path) =>
    location.pathname === path || location.pathname.startsWith(`${path}/`);

  const menuItems = [
    { name: "Dashboard", path: "/admin/dashboard", icon: <FaCube />, adminOnlyOrEmployee: true },
    { name: "Create User", path: "/admin/create-user", icon: <FaUserPlus />, permission: "users.create" },
    { name: "User List", path: "/admin/list", icon: <FaUsers />, permission: "users.list" },
    { name: "Employee List", path: "/admin/employee-list", icon: <FaIdBadge />, adminOnly: true },
    { name: "Stock POS", path: "/admin/stock-pos", icon: <FaBox />, permissions: ["stock.pos.read", "stock.pos.manage"] },
    // { name: "POS-Razorpay Report", path: "/admin/pos-razorpay-report", icon: <FaFileAlt /> },
    {
      name: "Razorpay Notifications",
      path: "/admin/razorpay-notifications",
      icon: <FaFileAlt />,
      permissions: ["razorpay.notifications.list", "razorpay.notifications.read"],
    },
    // {
    //   name: "Wallet",
    //   path: "/admin/wallet",
    //   icon: <FaWallet />,
    //   permissions: ["wallet.read", "wallet.credit", "wallet.debit"],
    // },
    { name: "Reports", path: "/admin/reports", icon: <FaChartBar />, permission: "reports.read" },
    // { name: "Payout Audit Logs", path: "/admin/reports/payout-audit-logs", icon: <FaFileAlt />, adminOnly: true },
    { name: "Ledger", path: "/admin/ledger", icon: <FaDatabase />, permissions: ["ledger.read", "ledger.manage"] },
    { name: "Help & Complaints", path: "/admin/complaint", icon: <FaCommentDots />, adminOnlyOrEmployee: true },
    {
      name: "Rate Setting",
      path: "/admin/rate-setting",
      icon: <FaMoneyBillWave />,
      permissions: ["rate.settings.read", "rate.settings.manage"],
    },
    // {
    //   name: "Set Limit",
    //   path: "/admin/set-limit",
    //   icon: <FaSlidersH />,
    //   permissions: ["set_limit.read", "set_limit.manual", "set_limit.excel"],
    // },
    { name: "Settlement", path: "/admin/pos-setting", icon: <FaSlidersH />, permissions: ["pos.settlement.read", "pos.settlement.manage", "set_limit.read"] },
    { name: "Setting", path: "/admin/setting", icon: <FaCog /> },
    {
      name: "System Log",
      path: "/admin/system-log",
      icon: <FaFileAlt />,
      permissions: ["rate.settings.read", "users.service.settings.manage"],
    },
  ];

  const visibleMenuItems = menuItems.filter((item) => {
    if (item.adminOnlyOrEmployee) {
      return isAdmin || isEmployee;
    }
    if (item.adminOnly) {
      return isAdmin;
    }
    if (item.permissions) {
      return hasAnyPermission(currentUser, item.permissions);
    }
    if (item.permission) {
      return hasPermission(currentUser, item.permission);
    }
    return isAdmin;
  });

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
          {!isCollapsed && <Link to={landingPath} className="text-xl font-bold text-pink-500"><img src={AbheePayLogo} width={150} /></Link>}
          <button
            onClick={toggleSidebar}
            className="hidden lg:block p-1 rounded-lg hover:bg-gray-800 text-gray-400"
          >
            {isCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-4">
          <ul className="space-y-2">
            {visibleMenuItems.map((item) => (
              <li key={item.path}>
                <Link
                  to={item.path}
                  className={`flex items-center px-3 py-2 rounded-lg transition-colors
                    ${isActivePath(item.path)
                      ? "bg-[#00D3CD] text-white"
                      : "text-gray-400 hover:bg-gray-800 hover:text-white"}
                  `}
                >
                  <span className="flex-shrink-0">{item.icon}</span>
                  {!isCollapsed && <span className="ml-3">{item.name}</span>}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* Logout Button */}
        <div className="p-4 border-t border-gray-700 w-full">
          <button
            onClick={handleLogout}
            // to="/admin/logout"
            className="flex items-center px-3 py-2 text-red-500 w-full hover:bg-red-500/10 rounded-lg transition-colors"
          >
            <FaSignOutAlt className="w-5 h-5" />
            {!isCollapsed && <span className="ml-3">Logout</span>}
          </button>
        </div>
      </div>
    </>
  );
};

export default Sidebar;
