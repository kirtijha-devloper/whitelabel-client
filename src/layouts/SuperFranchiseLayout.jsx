import React, { Suspense, lazy, useEffect, useRef } from 'react';
import { Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import Loader from '../components/Loader';
import { fetchUserDetails } from '../api/authApi';
import { getDashboard } from '../api/DashboardAndHeader';
import HeaderInfo from '../components/HeaderInfo';
import LoginPopupOverlay from '../components/LoginPopupOverlay';
import { UserCreationProvider } from '../context/UserCreationContext';
import SuperFranchiseSidebar from '../components/SuperFranchise/SuperFranchiseSidebar';

// Lazy Load Pages
const SuperFranchiseDashboard = lazy(() => import('../Pages/SuperFranchiseDashboard'));
const AddUser = lazy(() => import('../Pages/AddUser'));
const CreateUserDetail = lazy(() => import('../Pages/CreateUserDetail'));
const CreateUserPosDetails = lazy(() => import('../Pages/CreateUserPosDetails'));
const CreateChargeSet = lazy(() => import('../Pages/CreateChargeSet'));
const UserDetails = lazy(() => import('../Pages/UserDetails'));
const UserList = lazy(() => import('../Pages/UserList'));
const MerchantList = lazy(() => import('../Pages/MerchantList'));
const PosMachineList = lazy(() => import('../Pages/PosMachineList'));
const StockPOSMachine = lazy(() => import('../Pages/StockPOSMachine'));
const AddPOSMachine = lazy(() => import('../Pages/AddPOSMachine'));
const Reports = lazy(() => import('../Pages/Reports'));
const PayoutReport = lazy(() => import('../Pages/PayoutReport'));
const CCBillPaymentReports = lazy(() => import('../Pages/CCBillPaymentReports'));
const BillAvenueCCBillPayReports = lazy(() => import('../Pages/BillAvenueCCBillPayReports'));
const Settings = lazy(() => import('../Pages/Settings'));
const PosSetting = lazy(() => import('../Pages/PosSetting'));
const SuperFranchiseRateSettings = lazy(() => import('../Pages/SuperFranchiseRateSettings'));
const FranchiseMerchantRateSetting = lazy(() => import('../Pages/FranchiseMerchantRateSetting'));
const FranchiseRateSettings = lazy(() => import('../Pages/FranchiseRateSettings'));
const Ledger = lazy(() => import('../Pages/Ledger'));
const FranchiseLedger = lazy(() => import('../Pages/FranchiseLedger'));
const Logout = lazy(() => import('../Pages/Logout'));

export default function SuperFranchiseLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const scrollRef = useRef(null);

  const { data: currentUser, isLoading: userLoading, isError: userError } = useQuery({
    queryKey: ['currentUser'],
    queryFn: fetchUserDetails,
    onError: (error) => {
      console.error('Failed to fetch current user:', error.message);
    },
  });

  const { data: dashboard, isLoading: dashboardQueryLoading, isError: dashboardQueryError } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => getDashboard(),
    onError: (error) => {
      console.error('Failed to fetch dashboard data:', error.message);
    },
  });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo(0, 0);
    }
  }, [location.pathname]);

  if (userLoading || dashboardQueryLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader />
      </div>
    );
  }

  if (userError || dashboardQueryError) {
    navigate('/login');
    return null;
  }

  const normalizedRole = String(currentUser?.role || '').trim().toLowerCase();
  if (currentUser && normalizedRole !== 'super_franchise') {
    const redirectPath =
      normalizedRole === 'admin'
        ? '/admin/dashboard'
        : normalizedRole === 'franchise' || normalizedRole === 'franchaise'
        ? '/franchise/dashboard'
        : '/merchant/dashboard';
    return <Navigate to={redirectPath} replace />;
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <div className="h-screen bg-white shadow-lg overflow-y-auto overflow-x-hidden scrollbar-hide">
        <SuperFranchiseSidebar currentUser={currentUser} />
      </div>
      <div ref={scrollRef} id="main-content" className="flex-1 bg-gray-100 p-2 overflow-y-auto h-screen">
        <HeaderInfo dashboardData={dashboard} currentUser={currentUser} />
        <LoginPopupOverlay currentUser={currentUser} />
        <UserCreationProvider>
          <Suspense fallback={<div className="flex items-center justify-center h-full"><Loader /></div>}>
            <Routes>
              <Route path="dashboard" element={<SuperFranchiseDashboard dashboardData={dashboard} />} />
              <Route path="create-user" element={<AddUser currentUser={currentUser} />} />
              <Route path="create-user/details/:id" element={<CreateUserDetail currentUser={currentUser} />} />
              <Route path="create-user/pos/:id" element={<CreateUserPosDetails currentUser={currentUser} />} />
              <Route path="create-user/charge-set/:id" element={<CreateChargeSet currentUser={currentUser} />} />
              <Route path="user/:id" element={<UserDetails currentUser={currentUser} />} />
              <Route path="franchise-list" element={<UserList currentUser={currentUser} roleFilter="franchise" />} />
              <Route path="list" element={<UserList currentUser={currentUser} />} />
              <Route path="merchant-list" element={<MerchantList />} />
              <Route path="pos-machine-list" element={<PosMachineList />} />
              <Route path="stock-pos" element={<StockPOSMachine currentUser={currentUser} />} />
              <Route path="stock-pos/add" element={<AddPOSMachine currentUser={currentUser} />} />
              <Route path="reports" element={<Reports currentUser={currentUser} />} />
              <Route path="reports/payout" element={<PayoutReport />} />
              <Route path="reports/cc-bill" element={<CCBillPaymentReports />} />
              <Route path="reports/ba-cc-bill" element={<BillAvenueCCBillPayReports />} />
              <Route path="setting" element={<Settings currentUser={currentUser} />} />
              <Route path="pos-setting" element={<PosSetting currentUser={currentUser} />} />
              <Route path="rate-settings" element={<SuperFranchiseRateSettings currentUser={currentUser} />} />
              <Route path="merchant-rates" element={<FranchiseMerchantRateSetting currentUser={currentUser} />} />
              <Route path="ledger" element={<Ledger currentUser={currentUser} />} />
              <Route path="ledger-entries" element={<FranchiseLedger currentUser={currentUser} />} />
              <Route path="logout" element={<Logout />} />
            </Routes>
          </Suspense>
        </UserCreationProvider>
      </div>
    </div>
  );
}
