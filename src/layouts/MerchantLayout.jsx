import {
  Routes,
  Route,
  useNavigate,
  Navigate,
  useLocation,
} from "react-router-dom";
import Dashboard from "../Pages/Dashboard";
import CreateUser from "../Pages/CreateUser";
import MerchantList from "../Pages/MerchantList";
import UserList from "../Pages/UserList";
import PosMachineList from "../Pages/PosMachineList";
import CreateMerchant from "../Pages/CreateMerchant";
import CreateFranchise from "../Pages/CreateFranchise";
import StockPOSMachine from "../Pages/StockPOSMachine";
import POSRazarpayReport from "../Pages/POSRazorPayReport";
import Reports from "../Pages/Reports";
import AllPOSTxnReport from "../Pages/AllPOSTxnReports";
import Sidebar from "../components/Sidebar";
import { useDashboardData } from "../hooks/auth/useDashboardData";
import HeaderInfo from "../components/HeaderInfo";
import MerchantSideBar from "../Pages/Merchant/MerchantSideBar";
import MerchantDashboard from "../Pages/Merchant/MerchantDashboard";
import MerchantHeaderInfo from "../components/MerchantHeaderInfo";
import MerchantPayoutLogin from "../Pages/Merchant/MerchantPayoutLogin";
import RemitterDetails from "../Pages/Merchant/RemitterDetails";
import { useQuery } from "@tanstack/react-query";
import { getDashboard } from "../api/DashboardAndHeader";
import { fetchUserDetails } from "../api/authApi";
import Logout from "../Pages/Logout";
import Settings from "../Pages/Settings";
import MerchantCharges from "../Pages/Merchant/MerchantCharges";
import MerchantLedger from "../Pages/Merchant/MerchantLedger";
import TransactionHistory from "../Pages/Merchant/TransactionHistory";
import ComplaintBox from "../Pages/Merchant/ComplaintBox";
import Loader from "../components/Loader";
import TodayPayouts from "../Pages/TodayPayouts";
import CCBillPay from "../Pages/CCBillPay";
import BillAvenueCCBillPay from "../Pages/BillAvenueCCBillPay";
import BillAvenueCCBillPayReports from "../Pages/BillAvenueCCBillPayReports";
import BillAvenueBillerUpload from "../Pages/BillAvenueBillerUpload";
import ApplyKyc from "../Pages/Kyc/ApplyKyc";
import PayoutReport from "../Pages/PayoutReport";
import CCBillPaymentReports from "../Pages/CCBillPaymentReports";
import VimoPayout from "../Pages/VimoPayout";
import SevenPayPayout from "../Pages/SevenPayPayout";
import Ndia5Payout from "../Pages/Ndia5Payout";
import BranchXPayout from "../Pages/BranchXPayout";
import MxPayout from "../Pages/MxPayout";
import PayoutSuccess from "../Pages/PayoutSuccess";
import PayoutFailure from "../Pages/PayoutFailure";
import LoginPopupOverlay from "../components/LoginPopupOverlay";
import { getServiceFlagValue } from "../utils/serviceFlags";
import PayoutHub from "../Pages/PayoutHub";

const getMerchantPageTitle = (pathname) => {
  const routeTitles = [
    ["/merchant/dashboard", "Merchant Dashboard"],
    ["/merchant/vimo-payout/success", "Payout Success"],
    ["/merchant/vimo-payout/failed", "Payout Failed"],
    ["/merchant/vimo-payout", "Vimo Payout"],
    ["/merchant/branchx-payout/success", "Payout Success"],
    ["/merchant/branchx-payout", "BranchX Payout"],
    ["/merchant/sevenpay-payout/success", "Payout Success"],
    ["/merchant/sevenpay-payout", "SevenPay Payout"],
    ["/merchant/ndia5-payout/success", "Payout Success"],
    ["/merchant/ndia5-payout", "PAYOUT-N"],
    ["/merchant/mx-payout/success", "Payout Success"],
    ["/merchant/mx-payout", "Payout-M-X"],
    ["/merchant/payout/remitter-details", "Remitter Details"],
    ["/merchant/payout/transaction-history", "Transaction History"],
    ["/merchant/payout-hub", "Payout Services"],
    ["/merchant/payout", "Payout"],
    ["/merchant/charges", "Charges"],
    ["/merchant/reports/ba-cc-bill", "BA CC Bill Report"],
    ["/merchant/reports/cc-bill", "CC Bill Report"],
    ["/merchant/reports/payout", "Payout Report"],
    ["/merchant/reports", "Reports"],
    ["/merchant/cc-bill-pay/review", "CC Bill Review"],
    ["/merchant/cc-bill-pay/result", "CC Bill Result"],
    ["/merchant/cc-bill-pay/kyc", "CC Bill KYC"],
    ["/merchant/cc-bill-pay", "CC Bill Pay"],
    ["/merchant/ba-cc-bill-pay/review", "BA CC Bill Review"],
    ["/merchant/ba-cc-bill-pay/result", "BA CC Bill Result"],
    ["/merchant/ba-cc-bill-pay", "BA CC Bill Pay"],
    ["/merchant/kyc", "KYC"],
    ["/merchant/setting", "Settings"],
    ["/merchant/ledger", "Ledger"],
    ["/merchant/complaint-box", "Complaint Box"],
    ["/merchant/total-payouts", "Total Payouts"],
  ];

  const match = routeTitles.find(([routePath]) => pathname.startsWith(routePath));
  return match?.[1] || "Merchant Dashboard";
};

const MerchantLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const {
    data: dashboardData,
    isLoading: dashboardLoading,
    isError: dashboardError,
  } = useDashboardData();

  const {
    data: currentUser,
    isLoading: userLoading,
    isError: userError,
  } = useQuery({
    queryKey: ["currentUser"],
    queryFn: fetchUserDetails,
    onError: (error) => {
      console.error("Failed to fetch current user:", error.message);
    },
  });

  const { data: dashboard } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => getDashboard(),
    onError: (error) => {
      console.error("Failed to fetch dashboard data:", error.message);
    },
  });
  console.log(dashboard, "dashboard");

  if (userLoading || dashboardLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader />
      </div>
    );
  }

  if (dashboardError || userError) {
    navigate("/login");
    return null;
  }

  const normalizedRole = String(currentUser?.role || "")
    .trim()
    .toLowerCase();
  const resolvedRole =
    normalizedRole === "franchaise" ? "franchise" : normalizedRole;
  if (currentUser && resolvedRole && resolvedRole !== "merchant") {
    const redirectPath =
      resolvedRole === "admin" || resolvedRole === "franchise"
        ? `/${resolvedRole}/dashboard`
        : "/login";
    return <Navigate to={redirectPath} replace />;
  }

  const dashboardPath = "/merchant/dashboard";
  const guardServiceRoute = (serviceKey, element) =>
    getServiceFlagValue(currentUser?.service_flags, serviceKey, true)
      ? element
      : <Navigate to={dashboardPath} replace />;

  const isCompactMobileRoute =
    location.pathname === "/merchant" ||
    location.pathname.startsWith("/merchant/dashboard") ||
    location.pathname.startsWith("/merchant/payout-hub") ||
    location.pathname.startsWith("/merchant/vimo-payout") ||
    location.pathname.startsWith("/merchant/sevenpay-payout") ||
    location.pathname.startsWith("/merchant/ndia5-payout") ||
    location.pathname.startsWith("/merchant/branchx-payout") ||
    location.pathname.startsWith("/merchant/mx-payout") ||
    location.pathname.startsWith("/merchant/ledger") ||
    location.pathname.startsWith("/merchant/charges") ||
    location.pathname.startsWith("/merchant/reports") ||
    location.pathname.startsWith("/merchant/cc-bill-pay") ||
    location.pathname.startsWith("/merchant/ba-cc-bill-pay");
  const pageTitle = getMerchantPageTitle(location.pathname);

  return (
    <div className="flex min-h-screen bg-gray-50">
      <MerchantSideBar currentUser={currentUser} />
      <div
        className={`flex-1 min-w-0 bg-gray-100 ${isCompactMobileRoute ? "px-2.5 pb-4 pt-3 sm:p-4 lg:p-6" : "p-6"
          }`}
      >
        <MerchantHeaderInfo
          dashboardData={dashboardData}
          currentUser={currentUser}
          pageTitle={pageTitle}
        />
        <LoginPopupOverlay currentUser={currentUser} />
        <Routes>
          <Route
            path="dashboard"
            element={<MerchantDashboard dashboardData={dashboard} currentUser={currentUser} />}
          />
          <Route
            path="payout"
            element={<MerchantPayoutLogin currentUser={currentUser} />}
          />
          <Route
            path="payout-hub"
            element={<PayoutHub currentUser={currentUser} />}
          />
          <Route
            path="vimo-payout"
            element={guardServiceRoute(
              "vimo_payout",
              <VimoPayout currentUser={currentUser} />
            )}
          />
          <Route
            path="vimo-payout/success"
            element={guardServiceRoute("vimo_payout", <PayoutSuccess />)}
          />
          <Route
            path="vimo-payout/failed"
            element={guardServiceRoute("vimo_payout", <PayoutFailure />)}
          />
          <Route
            path="branchx-payout"
            element={guardServiceRoute(
              "branchx_payout",
              <BranchXPayout currentUser={currentUser} />
            )}
          />
          <Route
            path="sevenpay-payout"
            element={guardServiceRoute(
              "sevenpay_payout",
              <SevenPayPayout currentUser={currentUser} />
            )}
          />
          <Route
            path="sevenpay-payout/success"
            element={guardServiceRoute("sevenpay_payout", <PayoutSuccess />)}
          />
          <Route
            path="ndia5-payout"
            element={guardServiceRoute(
              "ndia5_payout",
              <Ndia5Payout currentUser={currentUser} />
            )}
          />
          <Route
            path="ndia5-payout/success"
            element={guardServiceRoute("ndia5_payout", <PayoutSuccess />)}
          />
          <Route
            path="mx-payout"
            element={guardServiceRoute(
              "mx_payout",
              <MxPayout currentUser={currentUser} />
            )}
          />
          <Route
            path="mx-payout/success"
            element={guardServiceRoute("mx_payout", <PayoutSuccess />)}
          />
          <Route
            path="branchx-payout/success"
            element={guardServiceRoute("branchx_payout", <PayoutSuccess />)}
          />
          <Route
            path="payout/remitter-details"
            element={<RemitterDetails currentUser={currentUser} />}
          />
          <Route
            path="payout/transaction-history"
            element={<TransactionHistory currentUser={currentUser} />}
          />
          <Route
            path="charges"
            element={<MerchantCharges currentUser={currentUser} />}
          />
          <Route
            path="reports"
            element={<Reports currentUser={currentUser} />}
          />
          <Route path="reports/payout" element={<PayoutReport />} />
          <Route path="reports/cc-bill-3" element={<PayoutReport reportVariant="cc-bill-3" />} />
          <Route path="reports/cc-bill" element={<CCBillPaymentReports />} />
          <Route
            path="reports/ba-cc-bill"
            element={<BillAvenueCCBillPayReports />}
          />
          <Route
            path="cc-bill-pay"
            element={guardServiceRoute(
              "cc_bill_pay",
              <CCBillPay currentUser={currentUser} />
            )}
          />
          <Route
            path="cc-bill-pay/review"
            element={guardServiceRoute(
              "cc_bill_pay",
              <CCBillPay currentUser={currentUser} />
            )}
          />
          <Route
            path="cc-bill-pay/result"
            element={guardServiceRoute(
              "cc_bill_pay",
              <CCBillPay currentUser={currentUser} />
            )}
          />
          <Route
            path="cc-bill-pay/kyc"
            element={guardServiceRoute("cc_bill_pay", <ApplyKyc />)}
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
          <Route
            path="setting"
            element={<Settings currentUser={currentUser} />}
          />
          <Route path="ledger" element={<MerchantLedger />} />
          <Route
            path="wallet"
            element={<Navigate to="/merchant/ledger" replace />}
          />
          <Route
            path="complaint-box"
            element={<ComplaintBox currentUser={currentUser} />}
          />
          <Route
            path="complaint"
            element={<ComplaintBox currentUser={currentUser} />}
          />
          <Route
            path="total-payouts"
            element={<TodayPayouts currentUser={currentUser} />}
          />
          <Route path="logout" element={<Logout />} />
        </Routes>
      </div>
    </div>
  );
};

export default MerchantLayout;
