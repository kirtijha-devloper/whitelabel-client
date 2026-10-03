import React, { Suspense, lazy, useEffect, useRef } from 'react';
import { Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { useDashboardData } from '../hooks/auth/useDashboardData';
import HeaderInfo from '../components/HeaderInfo';
import { UserCreationProvider } from '../context/UserCreationContext';
import { useQuery } from '@tanstack/react-query';
import { getDashboard } from '../api/DashboardAndHeader';
import Loader from '../components/Loader';
import { fetchUserDetails } from '../api/authApi';
import {
  getAdminLandingPathForUser,
  hasAnyPermission,
  hasPermission,
  isAdminUser,
  isEmployeeUser,
} from '../utils/accessControl';
import { normalizeUserRole } from '../utils/userAccess';
import LoginPopupOverlay from '../components/LoginPopupOverlay';

// Lazy Load Pages
const Dashboard = lazy(() => import('../Pages/Dashboard'));
const CreateUser = lazy(() => import('../Pages/CreateUser'));
const MerchantList = lazy(() => import('../Pages/MerchantList'));
const UserList = lazy(() => import('../Pages/UserList'));
const EmployeeList = lazy(() => import('../Pages/EmployeeList'));
const PosMachineList = lazy(() => import('../Pages/PosMachineList'));
const CreateMerchant = lazy(() => import('../Pages/CreateMerchant'));
const CreateFranchise = lazy(() => import('../Pages/CreateFranchise'));
const StockPOSMachine = lazy(() => import('../Pages/StockPOSMachine'));
const POSRazarpayReport = lazy(() => import('../Pages/POSRazorPayReport'));
const Wallet = lazy(() => import('../Pages/Wallet'));
const Reports = lazy(() => import('../Pages/Reports'));
const AllPOSTxnReport = lazy(() => import('../Pages/AllPOSTxnReports'));
const AddPOSMachine = lazy(() => import('../Pages/AddPOSMachine'));
const UserDetails = lazy(() => import('../Pages/UserDetails'));
const CreateUserDetail = lazy(() => import('../Pages/CreateUserDetail'));
const CreateUserPosDetails = lazy(() => import('../Pages/CreateUserPosDetails'));
const CreateChargeSet = lazy(() => import('../Pages/CreateChargeSet'));
const TransactionDetails = lazy(() => import('../Pages/TransactionDetails'));
const Ledger = lazy(() => import('../Pages/Ledger'));
// const ChargeSet = lazy(() => import('../Pages/ChargeSet'));
const RateSetting = lazy(() => import('../Pages/RateSetting'));
const RateItemSetting = lazy(() => import('../Pages/RateItemSetting'));
const Settings = lazy(() => import('../Pages/Settings'));
const Logout = lazy(() => import('../Pages/Logout'));
const ComplaintBox = lazy(() => import('../Pages/Merchant/ComplaintBox'));
const TodayPayouts = lazy(() => import('../Pages/TodayPayouts'));
const AssignToFranchise = lazy(() => import('../Pages/AssignToFranchise'));
const AddUser = lazy(() => import('../Pages/AddUser'));
const UserRateSetting = lazy(() => import('../Pages/UserRateSetting'));
const DefaultRateSetting = lazy(() => import('../Pages/DefaultRateSetting'));
const CommissionSettings = lazy(() => import('../Pages/CommissionSettings'));
const AdminRateSettingLanding = lazy(() => import('../Pages/AdminRateSettingLanding'));
const AdminRateSetting = lazy(() => import('../Pages/AdminRateSetting'));
const RateSettings = lazy(() => import('../Pages/RateSettings'));
const PayoutReport = lazy(() => import('../Pages/PayoutReport'));
const AdminPayoutAuditLogs = lazy(() => import('../Pages/AdminPayoutAuditLogs'));
const AllTransactionReport = lazy(() => import('../Pages/AllTransactionReport'));
const AdminLedger = lazy(() => import('../Pages/AdminLedger'));
const MerchantTransactionCharges = lazy(() => import('../Pages/MerchantTransactionCharges'));
const RazorpayNotification = lazy(() => import('../Pages/RazorpayNotification'));
const CCBillPaymentReports = lazy(() => import('../Pages/CCBillPaymentReports'));
const BillAvenueCCBillPayReports = lazy(() => import('../Pages/BillAvenueCCBillPayReports'));
const BillAvenueBillerUpload = lazy(() => import('../Pages/BillAvenueBillerUpload'));
const SystemActivityLog = lazy(() => import('../Pages/SystemActivityLog'));
const SetLimit = lazy(() => import('../Pages/SetLimit'));
const PosSetting = lazy(() => import('../Pages/PosSetting'));


export default function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const scrollRef = useRef(null);

  const { data: currentUser, isLoading: userLoading, isError: userError } = useQuery({
    queryKey: ["currentUser"],
    queryFn: fetchUserDetails,
    onError: (error) => {
      console.error("Failed to fetch current user:", error.message);
    },
  });

  const { data: dashboardData, isLoading: dashboardLoading, isError: dashboardError } = useDashboardData();

  const { data: dashboard } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => getDashboard(),
    enabled: Boolean(currentUser && (isAdminUser(currentUser) || isEmployeeUser(currentUser))),
    onError: (error) => {
      console.error('Failed to fetch dashboard data:', error.message);
    },
  });

  // Scroll to top on route change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo(0, 0);
    }
  }, [location.pathname]);

  if (userLoading || dashboardLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div><Loader /></div>
      </div>
    );
  }

  if (dashboardError || userError) {
    navigate('/login');
    return null;
  }

  const resolvedRole = normalizeUserRole(currentUser?.role);
  const isAdminViewer = isAdminUser(currentUser);
  const isEmployeeViewer = isEmployeeUser(currentUser);
  const employeeLandingPath = getAdminLandingPathForUser(currentUser);
  const canCreateUsers = hasPermission(currentUser, 'users.create');
  const canViewUsers = hasPermission(currentUser, 'users.list');
  const canReadUsers = hasPermission(currentUser, 'users.read');
  const canUpdateUsers = hasPermission(currentUser, 'users.update');
  const canViewStockPos = hasAnyPermission(currentUser, ['stock.pos.read', 'stock.pos.manage']);
  const canManageStockPos = hasAnyPermission(currentUser, ['stock.pos.read', 'stock.pos.manage']);
  const canViewRazorpayNotifications = hasAnyPermission(currentUser, ['razorpay.notifications.list', 'razorpay.notifications.read']);
  const canViewWallet = hasAnyPermission(currentUser, ['wallet.read', 'wallet.credit', 'wallet.debit']);
  const canViewReports = hasPermission(currentUser, 'reports.read');
  const canViewPayout = hasPermission(currentUser, 'payout.read');
  const canViewLedger = hasAnyPermission(currentUser, ['ledger.read', 'ledger.manage']);
  const canViewComplaints = hasAnyPermission(currentUser, ['complaints.read', 'complaints.manage']);
  const canViewRateSettings = hasAnyPermission(currentUser, ['rate.settings.read', 'rate.settings.manage']);
  const canViewSetLimit = hasAnyPermission(currentUser, ['set_limit.read', 'set_limit.manual', 'set_limit.excel']);
  const canViewPosSetting = hasAnyPermission(currentUser, ['pos.settlement.read', 'pos.settlement.manage', 'set_limit.read']);

  if (currentUser && resolvedRole && !['admin', 'employee'].includes(resolvedRole)) {
    const redirectPath =
      resolvedRole === 'franchise' || resolvedRole === 'merchant'
        ? `/${resolvedRole}/dashboard`
        : '/login';
    return <Navigate to={redirectPath} replace />;
  }

  const guardRoute = (allowed, element) =>
    allowed ? element : <Navigate to={employeeLandingPath} replace />;

  const noAccessElement = (
    <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
      <h2 className="text-2xl font-semibold text-gray-900">No Access Assigned</h2>
      <p className="mt-2 text-sm text-gray-500">
        Ask the admin to enable at least one employee permission for this account.
      </p>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-gray-50">
      <div className=" h-screen bg-white shadow-lg overflow-y-auto overflow-x-hidden scrollbar-hide">
        <Sidebar currentUser={currentUser} />
      </div>
      <div ref={scrollRef} id="main-content" className="flex-1 bg-gray-100 p-1 overflow-y-auto h-screen">
        <HeaderInfo dashboardData={dashboardData} currentUser={currentUser} />
        <LoginPopupOverlay currentUser={currentUser} />
        <UserCreationProvider>
          <Suspense fallback={<div className="flex items-center justify-center h-full"><Loader /></div>}>
            <Routes>
              <Route
                path="dashboard"
                element={
                  (isAdminViewer || isEmployeeViewer)
                    ? <Dashboard dashboardData={dashboard} />
                    : <Navigate to={employeeLandingPath} replace />
                }
              />
              {/* <Route path="create-user" element={<CreateUser currentUser={currentUser}/>} /> */}
              <Route path="create-user" element={guardRoute(canCreateUsers, <AddUser currentUser={currentUser} />)} />

              <Route path="create-user/details/:id" element={guardRoute(canCreateUsers, <CreateUserDetail currentUser={currentUser} />)} />
              <Route path="create-user/pos/:id" element={guardRoute(canCreateUsers, <CreateUserPosDetails currentUser={currentUser} />)} />
              <Route path="create-user/charge-set/:id" element={guardRoute(canCreateUsers, <CreateChargeSet currentUser={currentUser} />)} />
              <Route path="user/:id" element={guardRoute(canReadUsers, <UserDetails currentUser={currentUser} />)} />
              <Route path="user/:id/edit" element={guardRoute(canUpdateUsers, <AddUser currentUser={currentUser} />)} />
              <Route path="merchant-list" element={guardRoute(isAdminViewer, <MerchantList />)} />
              <Route path="list" element={guardRoute(canViewUsers, <UserList currentUser={currentUser} />)} />
              <Route path="employee-list" element={guardRoute(isAdminViewer, <EmployeeList currentUser={currentUser} />)} />
              <Route path="pos-machine-list" element={guardRoute(isAdminViewer, <PosMachineList />)} />
              <Route path="create-merchant" element={guardRoute(isAdminViewer, <CreateMerchant />)} />
              <Route path="create-franchise" element={guardRoute(isAdminViewer, <CreateFranchise />)} />
              <Route path="stock-pos" element={guardRoute(canViewStockPos, <StockPOSMachine currentUser={currentUser} />)} />
              <Route path="stock-pos/add" element={guardRoute(canManageStockPos, <AddPOSMachine currentUser={currentUser} />)} />
              <Route path="stock-pos/add-to-franchise" element={guardRoute(canManageStockPos, <AssignToFranchise />)} />
              <Route path="pos-razorpay-report" element={guardRoute(isAdminViewer, <POSRazarpayReport />)} />
              <Route path="transaction/:id" element={guardRoute(isAdminViewer, <TransactionDetails />)} />
              <Route path="wallet" element={guardRoute(canViewWallet, <Wallet />)} />
              {/* <Route path="charges-set" element={<ChargeSet />} /> */}
              <Route path="default-rate" element={guardRoute(isAdminViewer, <DefaultRateSetting />)} />
              <Route path="rate-items" element={guardRoute(isAdminViewer, <RateItemSetting />)} />
              <Route path="user-rate-settings/:userId" element={guardRoute(isAdminViewer, <UserRateSetting />)} />

              <Route path="ledger" element={guardRoute(canViewLedger, <Ledger currentUser={currentUser} />)} />
              <Route path="reports" element={guardRoute(canViewReports, <Reports currentUser={currentUser} />)} />
              <Route path="complaint" element={guardRoute(canViewComplaints, <ComplaintBox currentUser={currentUser} />)} />
              <Route path="setting" element={guardRoute(isAdminViewer, <Settings currentUser={currentUser} />)} />
              <Route path="pos-setting" element={guardRoute(canViewPosSetting || isAdminViewer, <PosSetting currentUser={currentUser} />)} />
              <Route path="set-limit" element={guardRoute(canViewSetLimit || isAdminViewer, <SetLimit currentUser={currentUser} />)} />
              <Route path="system-log" element={guardRoute(canViewRateSettings || isAdminViewer, <SystemActivityLog />)} />
              <Route path="billavenue-billers-upload" element={<BillAvenueBillerUpload />} />
              <Route path="commissions" element={guardRoute(isAdminViewer, <CommissionSettings currentUser={currentUser} />)} />
              <Route path="rate-setting" element={guardRoute(canViewRateSettings, <AdminRateSettingLanding />)} />
              <Route path="rate-setting/txn" element={guardRoute(canViewRateSettings, <AdminRateSetting mode="pos_txn" initialTab="default" />)} />
              <Route path="rate-setting/rental" element={guardRoute(canViewRateSettings, <RateSettings hideTabs initialTab="pos_rental" />)} />
              <Route path="rate-setting/cc-bill" element={guardRoute(canViewRateSettings, <RateSettings hideTabs initialTab="bbps_cc" />)} />
              <Route path="rate-setting/payout" element={guardRoute(canViewRateSettings, <RateSettings hideTabs initialTab="payout" />)} />
              <Route path="rate-setting/default" element={guardRoute(canViewRateSettings, <AdminRateSetting initialTab="default" />)} />
              <Route path="rate-setting/franchise" element={guardRoute(canViewRateSettings, <AdminRateSetting initialTab="specific" />)} />
              <Route path="rate-setting/unassigned" element={guardRoute(canViewRateSettings, <AdminRateSetting initialTab="unassigned" />)} />
              <Route path="rate-setting/pos-txn" element={guardRoute(canViewRateSettings, <RateSettings hideTabs initialTab="pos_txn" />)} />
              <Route path="franchise-rates" element={guardRoute(canViewRateSettings, <AdminRateSetting initialTab="specific" />)} />
              <Route path="rate-settings" element={guardRoute(canViewRateSettings, <RateSettings />)} />
              <Route path="logout" element={<Logout />} />
              <Route path="reports/all-pos-txn" element={guardRoute(canViewReports, <AllPOSTxnReport />)} />
              <Route path="reports/payout" element={guardRoute(canViewReports, <PayoutReport />)} />
              <Route path="reports/cc-bill-3" element={guardRoute(canViewReports, <PayoutReport reportVariant="cc-bill-3" />)} />
              <Route path="reports/payout-audit-logs" element={guardRoute(isAdminViewer, <AdminPayoutAuditLogs />)} />
              <Route path="reports/all-transactions" element={guardRoute(canViewReports, <AllTransactionReport />)} />
              <Route path="total-payouts" element={guardRoute(canViewPayout, <TodayPayouts currentUser={currentUser} />)} />
              <Route path="transaction-charges" element={guardRoute(isAdminViewer, <MerchantTransactionCharges />)} />
              <Route path="ledger-entries" element={guardRoute(canViewLedger, <AdminLedger currentUser={currentUser} />)} />
              <Route
                path="razorpay-notifications"
                element={guardRoute(
                  canViewRazorpayNotifications,
                  <RazorpayNotification currentUser={currentUser} />
                )}
              />
              <Route path="reports/cc-bill" element={guardRoute(canViewReports, <CCBillPaymentReports />)} />
              <Route path="reports/ba-cc-bill" element={guardRoute(canViewReports, <BillAvenueCCBillPayReports />)} />
              <Route
                path="no-access"
                element={
                  isEmployeeViewer && employeeLandingPath !== "/admin/no-access"
                    ? <Navigate to={employeeLandingPath} replace />
                    : noAccessElement
                }
              />
              <Route path="*" element={<Navigate to={isEmployeeViewer ? employeeLandingPath : "/admin/dashboard"} replace />} />
            </Routes>
          </Suspense>
        </UserCreationProvider>
      </div>
    </div>
  );
}
