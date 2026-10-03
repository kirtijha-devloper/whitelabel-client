import React, { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  remitterLogin,
  remitterRegister,
  getBeneficiaryList,
  addBeneficiary,
  transferImps,
  sddsLogin,
  remitterList,
  impsTransactionList,
} from '../../api/financialApi';
import { v4 as uuidv4 } from 'uuid';
import Modal from '../../components/Modal';
import FormInput from '../../components/FormInput';
import RemitterForm from '../../components/RemitterForm';
import RecentRemitters from '../../components/RecentRemitters';
import TransactionCard from '../../components/TransactionCard';
import LoginForm from '../../components/LoginForm';
import { useNavigate } from 'react-router-dom';
import { getSddsToken, setSddsToken } from '../../utils/auth';
import { ToastContainer, toast } from 'react-toastify'; // Import react-toastify
import 'react-toastify/dist/ReactToastify.css'; // Import toastify CSS

const MerchantPayoutLogin = ({currentUser}) => {
  const [isSddsLoggedIn, setIsSddsLoggedIn] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [modals, setModals] = useState({
    login: false,
    register: false,
    bankList: false,
    addBeneficiary: false,
    transfer: false,
    history: false,
  });
  const [showRegisterForm, setShowRegisterForm] = useState(false);
  const [mobile, setMobile] = useState('');
  const [otp, setOtp] = useState('');
  const [name, setName] = useState('');
  const [loadingMessage, setLoadingMessage] = useState('Initializing SDDS authentication...');
  const navigate = useNavigate();

  const credentials = {
    browser_id: 'sfsdfsdfsd',
    lat: '26.8913845',
    long: '75.7728197',
  };

  const role = currentUser.role;

  const sddsLoginMutation = useMutation({
    mutationFn: sddsLogin,
    onSuccess: (data) => {
      console.log(data?.data?.data?.authorisation?.token, 'sdds token');
      setSddsToken(data?.data?.data?.authorisation?.token);
      setIsSddsLoggedIn(true);
      setModals({ ...modals, login: true });
      setLoadingMessage(null);
    },
    onError: (error) => {
      setLoadingMessage(`SDDS Login Failed: ${error.message || 'Unknown error'}`);
      toast.error(`SDDS Login Failed: ${error.message || 'Unknown error'}`); 
    },
  });

  useEffect(() => {
    let browserId = localStorage.getItem('browserId');
    if (!browserId) {
      browserId = uuidv4();
      localStorage.setItem('browserId', browserId);
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude.toString();
        const long = pos.coords.longitude.toString();
        setLoadingMessage('Authenticating with SDDS...');
        sddsLoginMutation.mutate({ browser_id: browserId, lat, long });
      },
      (err) => {
        console.error('Geolocation failed:', err);
        setLoadingMessage('Using fallback coordinates for SDDS login...');
        sddsLoginMutation.mutate({
          browser_id: browserId,
          lat: '26.8913845',
          long: '75.7728197',
        });
      },
      { timeout: 10000 }
    );
  }, []);

  // const { data: remittersData, isLoading: remittersLoading, error: remittersError } = useQuery({
  //   queryKey: ['remitterList'],
  //   queryFn: remitterList,
  //   enabled: isSddsLoggedIn,
  // });

  // const { data: transactionsData, isLoading: transactionsLoading, error: transactionsError } = useQuery({
  //   queryKey: ['impsTransactionList'],
  //   queryFn: impsTransactionList,
  //   enabled: isSddsLoggedIn,
  // });

  const loginMutation = useMutation({
    mutationFn: remitterLogin,
    onSuccess: (data) => {
      if (data.data?.data?.isUser) {
        const user = data.data.data.user;
        const remitterId = data.remitter_id;
        setIsLoggedIn(true);
        toast.success(data.message);
        setShowRegisterForm(false);
        navigate(role === 'merchant' ? '/merchant/payout/remitter-details': '/franchise/payout/remitter-details', {
          state: {
            mobile: user.mobile,
            name: user.name,
            user_id: user.user_id,
            status: user.status,
            remitter_id: remitterId,
          },
        });
      } else {
        toast.info(
          `${data.data?.message || 'OTP sent successfully'}\n${data.message || 'Remitter not found. Please register first.'}`
        ); 
        setShowRegisterForm(true);
      }
    },
    onError: (error) => {
      toast.error(error.message || 'Login Failed'); // Toast for login error
      setShowRegisterForm(true);
    },
  });

  const registerMutation = useMutation({
    mutationFn: remitterRegister,
    onSuccess: () => {
      setIsLoggedIn(true);
      toast.success('Remitter Registered'); // Toast for successful registration
      setShowRegisterForm(false);
      navigate(role === 'merchant' ? '/merchant/payout/remitter-details': '/franchise/payout/remitter-details', {
        state: { user: data.data?.user || { mobile_number: mobile, name, user_id } },
      });
    }
  });

  const { data: bankList, refetch: refetchBankList } = useQuery({
    queryKey: ['bankList', mobile],
    queryFn: () => getBeneficiaryList({ mobile, lat: '26.8913845', long: '75.7728197' }),
    enabled: modals.bankList && !!mobile && isLoggedIn,
  });

  const handleLogin = () => {
    const browserId = localStorage.getItem('browserId');
    const sddsToken = getSddsToken();
    loginMutation.mutate({
      mobile_number: mobile,
      browser_id: browserId,
      lat: '26.8913845',
      long: '75.7728197',
      sddsToken,
    });
  };

  const handleRegister = () => {
    const browserId = localStorage.getItem('browserId');
    const sddsToken = getSddsToken();
    registerMutation.mutate({
      mobile_number: mobile,
      otp,
      name,
      browser_id: browserId,
      lat: '26.8913845',
      long: '75.7728197',
      sddsToken,
    });
  };

  const handleTransfer = async () => {
    if (!selectedBeneficiary) return;

    const { lat, long } = await getGeolocation();
    const browserId = localStorage.getItem('browserId') || '52e49c456f92b900cf0ed2e20172a7c2';
    const sddsToken = getSddsToken() || '';

    transferMutation.mutate({
      mobile_number: user.mobile,
      browser_id: browserId,
      lat,
      long,
      sddsToken,
      amount: transferData.amount,
      beneficiary_id: selectedBeneficiary.id.toString(),
      account_number: selectedBeneficiary.account,
      ifsc_code: selectedBeneficiary.ifsc,
      bank_name: selectedBeneficiary.bank,
      bank_account_holder_name: selectedBeneficiary.name,
      branch_name: selectedBeneficiary.branch_name || 'NA',
      transfer_type: transferData.transferType,
    });
  };

  if (!isSddsLoggedIn || sddsLoginMutation.isPending) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="text-center">
          <svg
            className="animate-spin h-8 w-8 text-[#00D3CD] mx-auto mb-4"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          <p className="text-gray-700">{loadingMessage}</p>
        </div>
      </div>
    );
  }

  // const recentRemitters = remittersData?.data?.map((remitter, index) => ({
  //   id: remitter.id || index + 1,
  //   name: remitter.name || 'Unknown',
  //   mobile: remitter.mobile_number || 'N/A',
  //   registeredAt: new Date(remitter.created_at || Date.now()).toLocaleString(),
  // })) || [];

  // const transactions = transactionsData?.transactions?.map((txn, index) => ({
  //   id: txn.id || index + 1,
  //   amount: `₹${parseFloat(txn.amount || 0).toFixed(2)}`,
  //   beneficiary: txn.reason || 'Unknown',
  //   status: txn.status || 'Pending',
  //   date: new Date(txn.transaction_date || Date.now()).toLocaleDateString('en-US', {
  //     month: 'long',
  //     day: 'numeric',
  //     year: 'numeric',
  //   }),
  // })) || [];

  return (
    <>
      <div className="min-h-screen">
        <div className="">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-6">
              {showRegisterForm ? (
                <RemitterForm
                  mobile={mobile}
                  setMobile={setMobile}
                  otp={otp}
                  setOtp={setOtp}
                  name={name}
                  setName={setName}
                  onSubmit={handleRegister}
                  isLoading={registerMutation.isPending}
                />
              ) : (
                <LoginForm
                  mobile={mobile}
                  setMobile={setMobile}
                  onSubmit={handleLogin}
                  isLoading={loginMutation.isPending}
                />
              )}
            </div>

            <div className="space-y-4">
            </div>
          </div>
        </div>
      </div>

      <ToastContainer
        position="top-right"
        autoClose={5000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="light"
      />
    </>
  );
};

export default MerchantPayoutLogin;
