import React, { useState, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import Modal from '../../components/Modal';
import FormInput from '../../components/FormInput';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { payout, payoutStatusCheck } from '../../api/financialApi';
import { fetchUserDetails } from '../../api/authApi';
import { listPayoutChargesWithParams } from '../../api/rateSettingsApi';
import { Loader2 } from 'lucide-react';

const BeneficiaryDetails = () => {
  const navigate = useNavigate();
  const { state } = useLocation();
  const beneficiary = state;

  const [amount, setAmount] = useState('');
  const [purpose, setPurpose] = useState('');
  const [tpinModalOpen, setTpinModalOpen] = useState(false);
  const [tpin, setTpin] = useState('');
  const [statusModal, setStatusModal] = useState({ open: false, status: null, message: '', data: null, checking: false });

  // Fetch current user to get merchant_id
  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: fetchUserDetails,
  });

  const merchantId = currentUser?.merchant_id || currentUser?.id;

  // Fetch merchant-specific charges first
  const {
    data: merchantChargesData,
    isLoading: merchantChargesLoading,
    isError: merchantChargesError,
  } = useQuery({
    queryKey: ['payoutCharges', 'merchant', merchantId],
    queryFn: () => listPayoutChargesWithParams({ merchant_id: merchantId, status: 'active' }),
    enabled: !!merchantId,
  });

  // Normalize merchant charges to check if they exist
  const merchantChargesNormalized = useMemo(() => {
    if (!merchantChargesData) return null;
    return Array.isArray(merchantChargesData?.data)
      ? merchantChargesData.data
      : Array.isArray(merchantChargesData?.charges)
      ? merchantChargesData.charges
      : Array.isArray(merchantChargesData)
      ? merchantChargesData
      : [];
  }, [merchantChargesData]);

  // Fetch default charges if merchant-specific charges are not available
  const {
    data: defaultChargesData,
    isLoading: defaultChargesLoading,
    isError: defaultChargesError,
  } = useQuery({
    queryKey: ['payoutCharges', 'default'],
    queryFn: () => listPayoutChargesWithParams({ status: 'active', is_default: 'true' }),
    enabled: !!merchantId && !merchantChargesLoading && (!merchantChargesNormalized || merchantChargesNormalized.length === 0),
  });

  // Normalize charges data - prioritize merchant charges, fallback to default
  const chargesList = useMemo(() => {
    if (merchantChargesNormalized && merchantChargesNormalized.length > 0) {
      return merchantChargesNormalized;
    }

    const defaultCharges = Array.isArray(defaultChargesData?.data)
      ? defaultChargesData.data
      : Array.isArray(defaultChargesData?.charges)
      ? defaultChargesData.charges
      : Array.isArray(defaultChargesData)
      ? defaultChargesData
      : [];

    return defaultCharges;
  }, [merchantChargesNormalized, defaultChargesData]);

  const chargesLoading = merchantChargesLoading || (defaultChargesLoading && chargesList.length === 0);
  const hasCharges = chargesList.length > 0;

  // Calculate charge based on amount
  const calculateCharge = (amt) => {
    if (!amt || amt <= 0 || !hasCharges) return { charge: 0, total: amt };

    const amount = parseFloat(amt);
    // Find the applicable charge based on min/max range
    const applicableCharge = chargesList.find(
      (charge) => amount >= parseFloat(charge.min) && amount <= parseFloat(charge.max)
    );

    if (!applicableCharge) {
      return { charge: 0, total: amount };
    }

    // Calculate charge: amount + (percentage of amount)
    const flatCharge = parseFloat(applicableCharge.amount) || 0;
    const percentageCharge = (amount * parseFloat(applicableCharge.percentage || 0)) / 100;
    const totalCharge = flatCharge + percentageCharge;
    const totalAmount = amount + totalCharge;

    return {
      charge: totalCharge,
      total: totalAmount,
      applicableCharge,
    };
  };

  const chargeCalculation = useMemo(() => {
    if (!amount || Number(amount) <= 0) {
      return { charge: 0, total: 0, applicableCharge: null };
    }
    return calculateCharge(amount);
  }, [amount, chargesList]);

  // Geolocation utility
  const getGeolocation = () => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve({ latitude: 26.9194401, longitude: 75.7531271 });
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          resolve({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          });
        },
        () => {
          resolve({ latitude: 26.9194401, longitude: 75.7531271 });
        },
        { timeout: 10000 }
      );
    });
  };

  const payoutMutation = useMutation({
    mutationFn: payout,
    onSuccess: (res) => {
      const status = (res?.status || '').toUpperCase();
      const message = res?.message || 'Payout response received';
      const payloadData = res?.data || null;

      // Open status modal
      setStatusModal({ open: true, status, message, data: payloadData, checking: false });

      // If pending, trigger status-check
      if (status === 'PENDING') {
        const apiTxnId = payloadData?.apiTxnId;
        const requestId = payloadData?.requestId;
        setStatusModal((prev) => ({ ...prev, checking: true }));
        statusCheckMutation.mutate({ merchant_id: merchantId, apiTxnId, requestId });
      }
    },
    onError: (error) => {
      toast.error(error.message || 'Payout failed');
      setStatusModal({ open: true, status: 'FAILED', message: error.message || 'Payout failed', data: null, checking: false });
    },
  });

  const statusCheckMutation = useMutation({
    mutationFn: payoutStatusCheck,
    onSuccess: (res) => {
      const status = (res?.status || '').toUpperCase();
      const message = res?.message || 'Status check completed';
      const payloadData = res?.data || null;
      setStatusModal({ open: true, status, message, data: payloadData, checking: false });
    },
    onError: (error) => {
      toast.error(error.message || 'Status check failed');
      setStatusModal((prev) => ({ ...prev, checking: false }));
    },
  });

  if (!beneficiary) {
    toast.error('No beneficiary selected');
    navigate('/merchant/payout');
    return null;
  }

  const handleProceed = () => {
    const mobile = beneficiary?.mobile_number || beneficiary?.mobile || beneficiary?.mobileNumber || '';
    if (!/^[6-9]\d{9}$/.test(mobile)) {
      toast.error('Beneficiary mobile number is invalid. It must be 10 digits and start with 6, 7, 8, or 9.');
      return;
    }
    if (!amount || Number(amount) <= 0) {
      toast.error('Enter a valid amount');
      return;
    }
    if (!hasCharges) {
      toast.error('No charges set. Please contact admin.');
      return;
    }
    if (!chargeCalculation.applicableCharge) {
      toast.error('Amount is outside the charge range. Please enter a valid amount.');
      return;
    }
    if (!purpose || purpose.trim().length < 2) {
      toast.error('Enter a valid purpose');
      return;
    }
    setTpinModalOpen(true);
  };

  const handleConfirmTpin = async () => {
    if (!tpin || tpin.length < 4) {
      toast.error('Enter a valid TPIN');
      return;
    }
    if (!merchantId) {
      toast.error('Merchant not identified');
      return;
    }
    if (!chargeCalculation.applicableCharge) {
      toast.error('Invalid amount range');
      return;
    }
    const coords = await getGeolocation();
    setTpinModalOpen(false);
    const payload = {
      merchant_id: merchantId,
      beneficiary_id: beneficiary.id,
      amount: Number(amount), // Sending amount (before charges)
      service_charge: chargeCalculation.charge, // Service charge (same as charge_amount)
      tpin,
      purpose: purpose,
      latitude: coords.latitude,
      longitude: coords.longitude,
    };
    payoutMutation.mutate(payload);
  };

  return (
    <div className="min-h-screen p-6">
      <h1 className="text-2xl font-bold mb-4">Beneficiary Details</h1>

      <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-gray-600">Name</p>
            <p className="font-medium">{beneficiary.beneficiary_name}</p>
          </div>
          <div>
            <p className="text-gray-600">Account Number</p>
            <p className="font-medium">{beneficiary.account_number}</p>
          </div>
          <div>
            <p className="text-gray-600">Bank</p>
            <p className="font-medium">{beneficiary.bank_name}</p>
          </div>
          <div>
            <p className="text-gray-600">IFSC</p>
            <p className="font-medium">{beneficiary.ifsc_code}</p>
          </div>
          <div>
            <p className="text-gray-600">Mobile</p>
            <p className="font-medium">{beneficiary.mobile_number || '—'}</p>
          </div>
          <div>
            <p className="text-gray-600">Email</p>
            <p className="font-medium">{beneficiary.email || '—'}</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <h2 className="text-xl font-semibold mb-3">Payout Charges</h2>
        {chargesLoading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="animate-spin h-6 w-6 text-indigo-600" />
            <span className="ml-2 text-gray-600">Loading charges...</span>
          </div>
        ) : !hasCharges ? (
          <div className="text-center py-4">
            <p className="text-gray-500">No charges set. Please contact admin.</p>
          </div>
        ) : (
          <div className="space-y-2">
            <ul className="divide-y">
              {chargesList.map((charge, index) => (
                <li key={charge.id || index} className="py-2 flex items-center justify-between">
                  <span className="text-gray-700">
                    ₹{parseFloat(charge.min).toLocaleString('en-IN')} – ₹{parseFloat(charge.max).toLocaleString('en-IN')}
                  </span>
                  <div className="text-right">
                    {charge.amount > 0 && (
                      <span className="font-medium block">₹{parseFloat(charge.amount).toFixed(2)}</span>
                    )}
                    {charge.percentage > 0 && (
                      <span className="text-sm text-gray-600">
                        {charge.amount > 0 ? '+' : ''}{parseFloat(charge.percentage).toFixed(2)}%
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm p-6">
        <h2 className="text-xl font-semibold mb-3">Enter Amount and Note</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <FormInput
              placeholder="Amount (₹) e.g. 1000"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
              type="number"
              min="1"
              step="1"
              inputMode="numeric"
            />
            <p className="text-xs text-gray-500 mt-1">Enter a positive whole amount.</p>
            {amount && Number(amount) > 0 && hasCharges && (
              <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                {chargeCalculation.applicableCharge ? (
                  <>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600">Sending Amount:</span>
                      <span className="font-medium">₹{parseFloat(amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600">Charge:</span>
                      <span className="font-medium">₹{chargeCalculation.charge.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm font-semibold pt-2 border-t border-gray-200">
                      <span>Total Amount:</span>
                      <span className="text-[#00D3CD]">₹{chargeCalculation.total.toFixed(2)}</span>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-red-600">Amount is outside the charge range.</p>
                )}
              </div>
            )}
          </div>
          <div>
            <FormInput
              placeholder="Note (Purpose) e.g. Salary payment"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              maxLength={100}
            />
            <p className="text-xs text-gray-500 mt-1">Short note, up to 100 characters.</p>
          </div>
        </div>
        <button
          onClick={handleProceed}
          disabled={!hasCharges || !chargeCalculation.applicableCharge}
          className="mt-4 bg-[#00D3CD] text-white px-4 py-2 rounded-lg hover:bg-[#00bdb7] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Proceed
        </button>
        {!hasCharges && (
          <p className="mt-2 text-sm text-red-600">Cannot proceed: No charges set.</p>
        )}
      </div>

      <Modal
        isOpen={tpinModalOpen}
        onClose={() => setTpinModalOpen(false)}
        title="Enter TPIN"
      >
        <div className="space-y-4">
          <FormInput
            placeholder="TPIN"
            value={tpin}
            onChange={(e) => setTpin(e.target.value)}
            type="password"
          />
          <button
            onClick={handleConfirmTpin}
            className="w-full bg-[#00D3CD] text-white py-3 rounded-lg hover:bg-[#00bdb7] transition-colors"
          >
            Confirm
          </button>
        </div>
      </Modal>

      <ToastContainer position="top-right" autoClose={3000} hideProgressBar theme="light" />

      {/* Status Modal */}
      <Modal
        isOpen={statusModal.open}
        onClose={() => setStatusModal({ open: false, status: null, message: '', data: null, checking: false })}
        title="Payment Status"
      >
        {(() => {
          const s = statusModal.status;
          const colorClass = s === 'SUCCESS' ? 'bg-green-100 text-green-800 border-green-300'
            : s === 'FAILED' ? 'bg-red-100 text-red-800 border-red-300'
            : 'bg-yellow-100 text-yellow-800 border-yellow-300';
          return (
            <div className={`rounded-lg border p-4 ${colorClass}`}>
              <p className="font-semibold mb-2">{statusModal.message}</p>
              {statusModal.checking && (
                <p className="text-sm">Checking status… please wait.</p>
              )}
              {statusModal.data && (
                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                  <div><span className="text-gray-600">UTR:</span> <span className="font-medium">{statusModal.data.utr || '—'}</span></div>
                  <div><span className="text-gray-600">API Txn ID:</span> <span className="font-medium">{statusModal.data.apiTxnId || '—'}</span></div>
                  <div><span className="text-gray-600">Amount:</span> <span className="font-medium">₹{Number(statusModal.data.amount || amount || 0).toLocaleString('en-IN')}</span></div>
                  <div><span className="text-gray-600">Beneficiary:</span> <span className="font-medium">{statusModal.data.beneficiaryName || beneficiary.beneficiary_name}</span></div>
                  <div><span className="text-gray-600">Bank:</span> <span className="font-medium">{statusModal.data.bankName || beneficiary.bank_name}</span></div>
                  <div><span className="text-gray-600">IFSC:</span> <span className="font-medium">{statusModal.data.ifscCode || beneficiary.ifsc_code}</span></div>
                </div>
              )}
              <button
                onClick={() => setStatusModal({ open: false, status: null, message: '', data: null, checking: false })}
                className="mt-4 w-full bg-gray-900 text-white py-2 rounded-lg"
              >
                Close
              </button>
            </div>
          );
        })()}
      </Modal>
    </div>
  );
};

export default BeneficiaryDetails;