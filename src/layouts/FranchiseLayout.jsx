import React, { Suspense, lazy, useEffect, useRef } from 'react';
import { Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { useDashboardData } from '../hooks/auth/useDashboardData';
import HeaderInfo from '../components/HeaderInfo';
import { UserCreationProvider } from '../context/UserCreationContext';
import { useQuery } from '@tanstack/react-query';
import Loader from '../components/Loader';
import { fetchUserDetails } from '../api/authApi';
import FranchiseSidebar from '../components/Franchise/FranchiseSidebar';
import { getDashboard } from '../api/DashboardAndHeader';
import LoginPopupOverlay from '../components/LoginPopupOverlay';
import { getServiceFlagValue } from '../utils/serviceFlags';

// Lazy Load Pages
const Dashboard = lazy(() => import('../Pages/Dashboard'));
const MerchantList = lazy(() => import('../Pages/MerchantList'));
const UserList = lazy(() => import('../Pages/UserList'));
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
const FranchiseDashboard = lazy(() => import('../Pages/FranchiseDashboard'));
const Settings = lazy(() => import('../Pages/Settings'));
const Logout = lazy(() => import('../Pages/Logout'));
const MerchantPayoutLogin = lazy(() => import('../Pages/Merchant/MerchantPayoutLogin'));
const VimoPayout = lazy(() => import('../Pages/VimoPayout'));
const SevenPayPayout = lazy(() => import('../Pages/SevenPayPayout'));
const Ndia5Payout = lazy(() => import('../Pages/Ndia5Payout'));
const BranchXPayout = lazy(() => import('../Pages/BranchXPayout'));
const MxPayout = lazy(() => import('../Pages/MxPayout'));
const RemitterDetails = lazy(() => import('../Pages/Merchant/RemitterDetails'));
const TransactionHistory = lazy(() => import('../Pages/Merchant/TransactionHistory'));
const MerchantCharges = lazy(() => import('../Pages/Merchant/MerchantCharges'));
const TodayPayouts = lazy(() => import('../Pages/TodayPayouts'));
const FranchiseMerchantRateSetting = lazy(() => import('../Pages/FranchiseMerchantRateSetting'));
const FranchiseRateSettings = lazy(() => import('../Pages/FranchiseRateSettings'));
const FranchiseLedger = lazy(() => import('../Pages/FranchiseLedger'));
const Ledger = lazy(() => import('../Pages/Ledger')); // reuse admin ledger statements page
const CCBillPay = lazy(() => import('../Pages/CCBillPay'));
const BillAvenueCCBillPay = lazy(() => import('../Pages/BillAvenueCCBillPay'));
const BillAvenueCCBillPayReports = lazy(() => import('../Pages/BillAvenueCCBillPayReports'));
const BillAvenueBillerUpload = lazy(() => import('../Pages/BillAvenueBillerUpload'));
const ApplyKyc = lazy(() => import('../Pages/Kyc/ApplyKyc'));
const AddUser = lazy(() => import('../Pages/AddUser'));
const PayoutReport = lazy(() => import('../Pages/PayoutReport'));
const CCBillPaymentReports = lazy(() => import('../Pages/CCBillPaymentReports'));
const PayoutSuccess = lazy(() => import('../Pages/PayoutSuccess'));
const PayoutFailure = lazy(() => import('../Pages/PayoutFailure'));
const SetLimit = lazy(() => import('../Pages/SetLimit'));
const PosSetting = lazy(() => import('../Pages/PosSetting'));
const ComplaintBox = lazy(() => import('../Pages/Merchant/ComplaintBox'));

export default function FranchiseLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const scrollRef = useRef(null);

  const { data: _dashboardData, isLoading: dashboardLoading, isError: dashboardError } = useDashboardData();

  const { data: currentUser, isLoading: userLoading, isError: userError } = useQuery({
    queryKey: ["currentUser"],
    queryFn: fetchUserDetails,
    onError: (error) => {
      console.error("Failed to fetch current user:", error.message);
    },
  });

  const {
    data: dashboard,
    isLoading: dashboardQueryLoading,
    isError: dashboardQueryError,
  } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => getDashboard(),
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

  if (userLoading || dashboardLoading || dashboardQueryLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader />
      </div>
    );
  }

  if (dashboardError || dashboardQueryError || userError) {
    navigate('/login');
    return null;
  }

  const normalizedRole = String(currentUser?.role || '').trim().toLowerCase();
  const resolvedRole = normalizedRole === 'franchaise' ? 'franchise' : normalizedRole;
  if (currentUser && resolvedRole && resolvedRole !== 'franchise') {
    const redirectPath =
      resolvedRole === 'admin' || resolvedRole === 'merchant'
        ? `/${resolvedRole}/dashboard`
        : '/login';
    return <Navigate to={redirectPath} replace />;
  }

  const dashboardPath = '/franchise/dashboard';
  const guardServiceRoute = (serviceKey, element) =>
    getServiceFlagValue(currentUser?.service_flags, serviceKey, true)
      ? element
      : <Navigate to={dashboardPath} replace />;

  return (
    <div className="flex min-h-screen bg-gray-50">
      <div className=" h-screen bg-white shadow-lg overflow-y-auto overflow-x-hidden scrollbar-hide">
        <FranchiseSidebar currentUser={currentUser} />
      </div>
      <div ref={scrollRef} id="main-content" className="flex-1 bg-gray-100 p-2 overflow-y-auto h-screen">
        <HeaderInfo dashboardData={dashboard} currentUser={currentUser} />
        <LoginPopupOverlay currentUser={currentUser} />
        <UserCreationProvider>
          <Suspense fallback={<div className="flex items-center justify-center h-full"><Loader /></div>}>
            <Routes>
              <Route path="dashboard" element={<FranchiseDashboard dashboardData={dashboard} />} />
              <Route path="create-user" element={<AddUser currentUser={currentUser} />} />
              <Route path="create-user/details/:id" element={<CreateUserDetail currentUser={currentUser} />} />
              <Route path="create-user/pos/:id" element={<CreateUserPosDetails currentUser={currentUser} />} />
              <Route path="create-user/charge-set/:id" element={<CreateChargeSet currentUser={currentUser} />} />
              <Route path="user/:id" element={<UserDetails currentUser={currentUser} />} />
              <Route path="merchant-list" element={<MerchantList />} />
              <Route path="list" element={<UserList currentUser={currentUser} />} />
              <Route path="pos-machine-list" element={<PosMachineList />} />
              {/* <Route path="create-merchant" element={<CreateMerchant />} />
            <Route path="create-franchise" element={<CreateFranchise />} /> */}
              <Route path='payout' element={<MerchantPayoutLogin currentUser={currentUser} />} />
              <Route
                path='vimo-payout'
                element={guardServiceRoute('vimo_payout', <VimoPayout currentUser={currentUser} />)}
              />
              <Route
                path='vimo-payout/success'
                element={guardServiceRoute('vimo_payout', <PayoutSuccess />)}
              />
              <Route
                path='vimo-payout/failed'
                element={guardServiceRoute('vimo_payout', <PayoutFailure />)}
              />
              <Route
                path='branchx-payout'
                element={guardServiceRoute('branchx_payout', <BranchXPayout currentUser={currentUser} />)}
              />
              <Route
                path='sevenpay-payout'
                element={guardServiceRoute('sevenpay_payout', <SevenPayPayout currentUser={currentUser} />)}
              />
              <Route
                path='sevenpay-payout/success'
                element={guardServiceRoute('sevenpay_payout', <PayoutSuccess />)}
              />
              <Route
                path='ndia5-payout'
                element={guardServiceRoute('ndia5_payout', <Ndia5Payout currentUser={currentUser} />)}
              />
              <Route
                path='ndia5-payout/success'
                element={guardServiceRoute('ndia5_payout', <PayoutSuccess />)}
              />
              <Route
                path='mx-payout'
                element={guardServiceRoute('mx_payout', <MxPayout currentUser={currentUser} />)}
              />
              <Route
                path='mx-payout/success'
                element={guardServiceRoute('mx_payout', <PayoutSuccess />)}
              />
              <Route
                path='branchx-payout/success'
                element={guardServiceRoute('branchx_payout', <PayoutSuccess />)}
              />
              <Route
                path="cc-bill-pay"
                element={guardServiceRoute('cc_bill_pay', <CCBillPay currentUser={currentUser} />)}
              />
              <Route
                path="cc-bill-pay/review"
                element={guardServiceRoute('cc_bill_pay', <CCBillPay currentUser={currentUser} />)}
              />
              <Route
                path="cc-bill-pay/result"
                element={guardServiceRoute('cc_bill_pay', <CCBillPay currentUser={currentUser} />)}
              />
              <Route
                path="cc-bill-pay/kyc"
                element={guardServiceRoute('cc_bill_pay', <ApplyKyc />)}
              />
              <Route
                path="ba-cc-bill-pay"
                element={<BillAvenueCCBillPay currentUser={currentUser} />}
              />
              <Route
                path="ba-cc-bill-pay/review"
                element={<BillAvenueCCBillPay currentUser={currentUser} />}
              />
              <Route
                path="ba-cc-bill-pay/result"
                element={<BillAvenueCCBillPay currentUser={currentUser} />}
              />
              <Route path="kyc" element={<ApplyKyc />} />
              <Route path="payout/remitter-details" element={<RemitterDetails currentUser={currentUser} />} />
              <Route path="payout/transaction-history" element={<TransactionHistory currentUser={currentUser} />} />
              <Route path="stock-pos" element={<StockPOSMachine currentUser={currentUser} />} />
              <Route path="stock-pos/add" element={<AddPOSMachine currentUser={currentUser} />} />
              <Route path="pos-razorpay-report" element={<POSRazarpayReport />} />
              <Route path="transaction/:id" element={<TransactionDetails />} />
              <Route path="charges-set" element={<MerchantCharges currentUser={currentUser} />} />
              {/* <Route path="wallet" element={<Wallet />} /> */}
              <Route path="reports" element={<Reports currentUser={currentUser} />} />
              <Route path="reports/payout" element={<PayoutReport />} />
              <Route path="reports/cc-bill-3" element={<PayoutReport reportVariant="cc-bill-3" />} />
              <Route path="reports/cc-bill" element={<CCBillPaymentReports />} />
              <Route path="reports/ba-cc-bill" element={<BillAvenueCCBillPayReports />} />
              <Route path="setting" element={<Settings currentUser={currentUser} />} />
              <Route path="pos-setting" element={<PosSetting currentUser={currentUser} />} />
              <Route path="complaint-box" element={<ComplaintBox currentUser={currentUser} />} />
              <Route path="complaint" element={<ComplaintBox currentUser={currentUser} />} />
              <Route path="commissions" element={<Navigate to="/franchise/dashboard" replace />} />
              <Route path="merchant-rates" element={<FranchiseMerchantRateSetting currentUser={currentUser} />} />
              <Route path="rate-settings" element={<FranchiseRateSettings />} />
              {/* show same ledger statements page as admin; backend will restrict results to franchise user */}
              <Route path="ledger" element={<Ledger currentUser={currentUser} />} />
              {/* keep legacy/alternate entries view if needed */}
              <Route path="ledger-entries" element={<FranchiseLedger currentUser={currentUser} />} />
              <Route path="logout" element={<Logout />} />
              <Route path="reports/all-pos-txn" element={<AllPOSTxnReport />} />
              <Route path="total-payouts" element={<TodayPayouts currentUser={currentUser} />} />
            </Routes>
          </Suspense>
        </UserCreationProvider>
      </div>
    </div>
  );
}
