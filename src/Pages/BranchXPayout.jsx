import React, { useState, useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  getBranchXBeneficiaries,
  addBranchXBeneficiary,
  deleteBranchXBeneficiary,
  initiateBranchXPayout,
  checkBranchXPayoutStatus,
} from '../api/branchxApi';
import {
  getServiceDisabledMessage,
  getServiceFlagValue,
  isServiceDisabledError,
} from '../utils/serviceFlags';
import { ShieldAlert } from 'lucide-react';
import { checkUserDailyPayoutLimit, recordUserPayoutExecution } from '../utils/userLimit';

const POLL_INTERVAL_MS = 6000; // poll every 6 s (documented desired rate)
const MAX_POLL_ATTEMPTS = 10; // total ~60s
const AUTO_POLL_CUTOFF_MS = 4 * 60 * 1000; // 4 minutes cutoff before cron takes over
const BRANCHX_MAX_PAYOUT_AMOUNT = 100000;

const EMPTY_ADD_FORM = {
  beneficiary_name: '',
  mobile_number: '',
  bank_name: '',
  account_number: '',
  ifsc_code: '',
  email: '',
};

const hasRepeatedDigitSequence = (value = '') => /(\d)\1{4,}/.test(value);

const BranchXPayout = ({ currentUser }) => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const pollTimerRef = useRef(null);
  const pollAttemptsRef = useRef(0);
  const pollingStartedAtRef = useRef(null);

  const merchantId = currentUser?.id;
  const isPayoutEnabled = getServiceFlagValue(currentUser?.service_flags, 'branchx_payout', true);
  const role = String(currentUser?.role || '').trim().toLowerCase();
  const normalizedRole = role === 'franchaise' ? 'franchise' : role;

  const walletNum = parseFloat(currentUser?.wallet ?? 0);
  const availableBalanceNum =
    currentUser?.available_balance !== undefined
      ? parseFloat(currentUser.available_balance)
      : walletNum;
  const settlementHoldNum = Math.max(0, walletNum - availableBalanceNum);
  const payoutMaxAmount = Math.min(
    Number.isFinite(availableBalanceNum) ? Math.max(0, availableBalanceNum) : 0,
    BRANCHX_MAX_PAYOUT_AMOUNT
  );
  const settlementType = currentUser?.settlement_type;

  // phase: 'list' | 'amount' | 'confirm' | 'pending'
  const [phase, setPhase] = useState('list');
  const [limitAlertModal, setLimitAlertModal] = useState(null);
  const [selectedBeneficiary, setSelectedBeneficiary] = useState(null);
  const [form, setForm] = useState({ amount: '', purpose: '', tpin: '' });
  const [confirmChecked, setConfirmChecked] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState(EMPTY_ADD_FORM);
  const [pendingApiRef, setPendingApiRef] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [savedPayoutTransactionId, setSavedPayoutTransactionId] = useState(null);
  const [pollStatus, setPollStatus] = useState(null);
  const [locationStatus, setLocationStatus] = useState('unknown');
  const [coords, setCoords] = useState({ lat: '', lng: '' });

  // Monitor geolocation permission
  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationStatus('unsupported');
      return;
    }
    if (navigator.permissions?.query) {
      navigator.permissions
        .query({ name: 'geolocation' })
        .then((result) => {
          setLocationStatus(result.state);
          result.onchange = () => setLocationStatus(result.state);
        })
        .catch(() => setLocationStatus('prompt'));
    } else {
      navigator.geolocation.getCurrentPosition(
        () => setLocationStatus('granted'),
        () => setLocationStatus('denied')
      );
    }
  }, []);

  // Clear poll timer on unmount
  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    };
  }, []);

  const getGeolocation = () =>
    new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve(null);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: String(pos.coords.latitude), lng: String(pos.coords.longitude) }),
        () => resolve(null),
        { timeout: 10000 }
      );
    });

  // ── Queries ──────────────────────────────────────────────────────────────

  const beneficiariesQuery = useQuery({
    queryKey: ['branchxBeneficiaries', merchantId],
    queryFn: () => getBranchXBeneficiaries(merchantId),
    enabled: Boolean(merchantId),
    retry: 1,
  });

  const beneficiaries = Array.isArray(beneficiariesQuery.data?.data)
    ? beneficiariesQuery.data.data
    : [];

  const normalizedSearchTerm = String(searchTerm || '').trim().toLowerCase();
  const filteredBeneficiaries = normalizedSearchTerm
    ? beneficiaries.filter((beneficiary) => {
        const beneficiaryName = String(beneficiary.beneficiary_name || beneficiary.name || '').toLowerCase();
        const beneficiaryMobile = String(
          beneficiary.mobile_number || beneficiary.mobile || beneficiary.mobileNumber || ''
        ).toLowerCase();
        const beneficiaryAccount = String(
          beneficiary.account_number || beneficiary.accountNumber || ''
        ).toLowerCase();
        return (
          beneficiaryName.includes(normalizedSearchTerm) ||
          beneficiaryMobile.includes(normalizedSearchTerm) ||
          beneficiaryAccount.includes(normalizedSearchTerm)
        );
      })
    : beneficiaries;

  // ── Mutations ─────────────────────────────────────────────────────────────

  const addBeneficiaryMutation = useMutation({
    mutationFn: addBranchXBeneficiary,
    onSuccess: async () => {
      toast.success('Beneficiary added successfully.');
      await queryClient.invalidateQueries(['branchxBeneficiaries', merchantId]);
      setShowAddForm(false);
      setAddForm(EMPTY_ADD_FORM);
    },
    onError: (error) => {
      const msg = error?.response?.data?.message || error?.message || 'Failed to add beneficiary';
      toast.error(msg);
    },
  });

  const deleteBeneficiaryMutation = useMutation({
    mutationFn: ({ id }) => deleteBranchXBeneficiary(id, merchantId),
    onSuccess: async () => {
      toast.success('Beneficiary removed.');
      await queryClient.invalidateQueries(['branchxBeneficiaries', merchantId]);
    },
    onError: (error) => {
      toast.error(error?.message || 'Failed to delete beneficiary.');
    },
  });

  // Build the success navigation state from a payout result
  const buildSuccessState = (statusData, amountVal) => ({
    payoutData: {
      status: statusData?.status,
      utr: statusData?.utr,
      message: statusData?.message || 'Payout completed',
      amount: amountVal,
      beneficiaryName: selectedBeneficiary?.beneficiary_name,
      beneficiaryAccountNumber: selectedBeneficiary?.account_number,
      beneficiaryIFSC: selectedBeneficiary?.ifsc_code,
      beneficiaryBank: selectedBeneficiary?.bank_name,
      beneficiaryMobileNumber: selectedBeneficiary?.mobile_number,
    },
    payoutPayload: { amount: amountVal },
    role: normalizedRole,
    returnPath: `/${normalizedRole}/branchx-payout`,
  });

  // ── Polling ───────────────────────────────────────────────────────────────

  const clearPollingTimer = () => {
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  };

  const startPolling = ({ requestId = null, payoutTransactionId = null } = {}) => {
    clearPollingTimer();
    if (!pollingStartedAtRef.current) {
      pollingStartedAtRef.current = Date.now();
    }
    pollTimerRef.current = setTimeout(() => doPoll({ requestId, payoutTransactionId }), POLL_INTERVAL_MS);
  };

  const doPoll = async ({ requestId = null, payoutTransactionId = null } = {}) => {
    const elapsed = Date.now() - (pollingStartedAtRef.current || 0);
    if (elapsed >= AUTO_POLL_CUTOFF_MS) {
      clearPollingTimer();
      setPollStatus('CRON_HANDOVER');
      toast.info('Payout has been handed over to cron status checks; refreshed report will display updates.');
      return;
    }

    const nextAttempt = pollAttemptsRef.current + 1;
    if (nextAttempt > MAX_POLL_ATTEMPTS) {
      clearPollingTimer();
      setPollStatus('TIMEOUT');
      toast.warn('Max status-check attempts reached. Please check the Payout Report for final status.');
      return;
    }

    pollAttemptsRef.current = nextAttempt;

    const effectiveRequestId = requestId || pendingApiRef;
    const effectivePayoutTransactionId = payoutTransactionId || savedPayoutTransactionId;

    const payload = effectiveRequestId
      ? { requestId: effectiveRequestId }
      : effectivePayoutTransactionId
      ? { payout_transaction_id: Number(effectivePayoutTransactionId) }
      : {};

    if (!payload.requestId && !payload.payout_transaction_id) {
      toast.error('Missing payout reference for status check (requestId or payout_transaction_id required).');
      return;
    }

    try {
      const res = await checkBranchXPayoutStatus(payload);
      // Per doc: use data.data.status first, fall back to data.status
      const statusRaw = res?.data?.data?.status || res?.data?.status;
      const status = statusRaw ? String(statusRaw).toUpperCase() : 'PENDING';
      setPollStatus(status);

      if (status === 'SUCCESS') {
        clearPollingTimer();
        toast.success('Payout successful!');
        await queryClient.invalidateQueries(['currentUser']);
        navigate(`/${normalizedRole}/branchx-payout/success`, {
          replace: true,
          state: buildSuccessState(res?.data?.data, form.amount),
        });
      } else if (status === 'FAILED') {
        clearPollingTimer();
        toast.error('Payout failed. Your wallet has been refunded.');
      } else {
        if (pollAttemptsRef.current >= MAX_POLL_ATTEMPTS) {
          clearPollingTimer();
          setPollStatus('TIMEOUT');
          toast.warn('Max status-check attempts reached. Please check the Payout Report for final status.');
        } else {
          toast.info(`Payout pending, retrying... (${pollAttemptsRef.current}/${MAX_POLL_ATTEMPTS})`);
          startPolling({ requestId: pendingApiRef, payoutTransactionId: savedPayoutTransactionId });
        }
      }
    } catch (error) {
      if (pollAttemptsRef.current >= MAX_POLL_ATTEMPTS) {
        clearPollingTimer();
        setPollStatus('TIMEOUT');
        toast.warn('Status check timed out after repeated errors. Please check the Payout Report.');
        return;
      }

      toast.warn(`Status-check error (${error?.message || 'Network issue'}), retrying... (${pollAttemptsRef.current}/${MAX_POLL_ATTEMPTS})`);
      startPolling({ requestId: pendingApiRef, payoutTransactionId: savedPayoutTransactionId });
    }
  };

  // ── Payout mutation ───────────────────────────────────────────────────────

  const payoutMutation = useMutation({
    mutationFn: initiateBranchXPayout,
    onSuccess: async (data) => {
      recordUserPayoutExecution(currentUser?.id, Number(form.amount));
      await queryClient.invalidateQueries(['currentUser']);
      const txnStatus = data?.data?.status;

      if (txnStatus === 'PENDING') {
        const apiRef = data?.data?.api_ref || null;
        const payoutId = data?.data?.id || data?.data?.payout_transaction_id || null;
        setPendingApiRef(apiRef);
        setSavedPayoutTransactionId(payoutId);
        setPhase('pending');
        setPollStatus('PENDING');
        pollAttemptsRef.current = 0;
        startPolling({ requestId: apiRef, payoutTransactionId: payoutId });
        toast.info('Payout requested. Checking status automatically…');
      } else if (txnStatus === 'SUCCESS') {
        const payoutId = data?.data?.id || data?.data?.payout_transaction_id || null;
        setSavedPayoutTransactionId(payoutId);
        toast.success(data?.message || 'Payout successful');
        navigate(`/${normalizedRole}/branchx-payout/success`, {
          replace: true,
          state: buildSuccessState(data?.data, form.amount),
        });
      } else {
        toast.error(data?.data?.message || data?.message || 'Payout failed');
      }
    },
    onError: (error) => {
      const status = error?.status || error?.response?.status;
      const msg = error?.response?.data?.message || error?.message || 'Payout failed';

      if (isServiceDisabledError(error)) {
        toast.error(getServiceDisabledMessage(error));
        return;
      }

      if (msg.toLowerCase().includes('t-pin has expired')) {
        toast.error('T-PIN has expired. Please generate a new one.');
      } else if (status === 401 || msg.toLowerCase().includes('invalid t-pin')) {
        toast.error('Invalid T-PIN. Please try again.');
      } else if (msg.toLowerCase().includes('insufficient')) {
        if (settlementHoldNum > 0) {
          toast.error(
            `Insufficient available balance. ₹${settlementHoldNum.toFixed(2)} is on hold. Available: ₹${availableBalanceNum.toFixed(2)}.`
          );
        } else {
          toast.error('Insufficient wallet balance.');
        }
      } else {
        toast.error(msg);
      }
    },
  });

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleSelectBeneficiary = (b) => {
    const mobile = b.mobile_number || b.mobile || b.mobileNumber || '';
    if (!/^[6-9]\d{9}$/.test(mobile)) {
      toast.error('Selected beneficiary has an invalid mobile number. It must be 10 digits and start with 6, 7, 8, or 9.');
      return;
    }
    setSelectedBeneficiary(b);
    setConfirmChecked(false);
    setForm({ amount: '', purpose: '', tpin: '' });
    setPhase('amount');
  };

  const handleAmountChange = (value) => {
    const sanitized = String(value || '')
      .replace(/[^\d.]/g, '')
      .replace(/(\..*)\./g, '$1');

    if (sanitized === '') {
      setForm((prev) => ({ ...prev, amount: '' }));
      return;
    }

    const nextAmount = Number(sanitized);
    if (!Number.isFinite(nextAmount) || nextAmount > payoutMaxAmount) {
      return;
    }

    setForm((prev) => ({ ...prev, amount: sanitized }));
  };

  const handleAmountContinue = async (e) => {
    e.preventDefault();
    const enteredAmount = Number(form.amount);

    if (!form.amount || !Number.isFinite(enteredAmount) || enteredAmount <= 0) {
      toast.error('Enter a valid amount.');
      return;
    }

    const isGlobalLimitActive = getServiceFlagValue(currentUser?.service_flags, 'user_daily_limit', true);
    const limitCheck = checkUserDailyPayoutLimit({
      userId: currentUser?.id,
      requestedAmount: enteredAmount,
      isGlobalLimitActive,
    });

    if (!limitCheck.allowed) {
      setLimitAlertModal(limitCheck.message);
      return;
    }

    if (enteredAmount > payoutMaxAmount) {
      if (settlementHoldNum > 0) {
        toast.error(
          `Maximum payout amount is ₹${payoutMaxAmount.toFixed(2)}. ₹${settlementHoldNum.toFixed(2)} is on hold. Available: ₹${availableBalanceNum.toFixed(2)}.`
        );
      } else {
        toast.error(`Maximum payout amount is ₹${payoutMaxAmount.toFixed(2)}.`);
      }
      return;
    }
    // Acquire coords if not yet obtained
    if (!coords.lat || !coords.lng) {
      const loc = await getGeolocation();
      if (loc) setCoords(loc);
    }
    setPhase('confirm');
  };

  const handleSubmitPayout = async (e) => {
    e.preventDefault();
    if (!confirmChecked) {
      toast.error('Please confirm the transaction.');
      return;
    }
    if (!form.tpin) {
      toast.error('T-PIN is required.');
      return;
    }
    if (!isPayoutEnabled) {
      toast.error('Payout-X is currently disabled.');
      return;
    }

    const mobile = selectedBeneficiary?.mobile_number || selectedBeneficiary?.mobile || selectedBeneficiary?.mobileNumber || '';
    if (!/^[6-9]\d{9}$/.test(mobile)) {
      toast.error('Beneficiary mobile number is invalid. It must be 10 digits and start with 6, 7, 8, or 9.');
      return;
    }

    let lat = coords.lat;
    let lng = coords.lng;
    if (!lat || !lng) {
      const loc = await getGeolocation();
      if (loc) {
        lat = loc.lat;
        lng = loc.lng;
        setCoords(loc);
      }
    }

    const payload = {
      merchant_id: Number(merchantId),
      beneficiary_id: Number(selectedBeneficiary.id),
      amount: Number(form.amount),
      tpin: String(form.tpin),
      ...(form.purpose ? { purpose: form.purpose } : {}),
      ...(lat ? { latitude: lat, longitude: lng } : {}),
    };

    payoutMutation.mutate(payload);
  };

  const handleAddBeneficiarySubmit = (e) => {
    e.preventDefault();
    const { beneficiary_name, mobile_number, bank_name, account_number, ifsc_code, email } = addForm;
    if (!beneficiary_name || !mobile_number || !bank_name || !account_number || !ifsc_code || !email) {
      toast.error('All fields are required.');
      return;
    }
    if (!/^[6-9]\d{9}$/.test(mobile_number)) {
      toast.error('Mobile number must be exactly 10 digits and start with 6, 7, 8, or 9.');
      return;
    }
    if (hasRepeatedDigitSequence(mobile_number)) {
      toast.error('Mobile number cannot contain the same digit 5 or more times consecutively.');
      return;
    }
    addBeneficiaryMutation.mutate({
      merchant_id: Number(merchantId),
      ...addForm,
    });
  };

  const resetToList = () => {
    setPhase('list');
    setSelectedBeneficiary(null);
    setConfirmChecked(false);
    setPollStatus(null);
    setPendingApiRef(null);
    setSavedPayoutTransactionId(null);
    setForm({ amount: '', purpose: '', tpin: '' });
    pollingStartedAtRef.current = null;
    pollAttemptsRef.current = 0;
    if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
  };

  const isLoading =
    payoutMutation.isPending ||
    addBeneficiaryMutation.isPending ||
    deleteBeneficiaryMutation.isPending;
  const mobileHasRepeatedDigits = hasRepeatedDigitSequence(addForm.mobile_number);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="pb-1">
      <div className="mx-auto max-w-4xl rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:p-5 md:p-6">
        <h1 className="text-2xl font-bold mb-2">Payout-X</h1>
        <p className="mb-5 border-b border-gray-100 pb-4 text-sm text-gray-600 sm:mb-6 sm:pb-5">
          Role: {normalizedRole}. Payout status: {isPayoutEnabled ? 'Enabled' : 'Disabled'}.
        </p>


        {pollStatus === 'CRON_HANDOVER' && (
        <div className="mb-4 px-4 py-3 bg-blue-50 border border-blue-200 text-blue-700 rounded">
          Payout has been handed over to the backend cron status update process. Refresh the report page for the latest status.
        </div>
      )}
      {locationStatus === 'denied' && (
          <div className="mb-4 px-4 py-3 bg-red-100 text-red-700 rounded">
            Location permission denied. Please enable location in browser settings and refresh.
          </div>
        )}
        {locationStatus === 'prompt' && (
          <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-700">
            Location permission is required. You will be prompted when you proceed.
          </div>
        )}

        {!isPayoutEnabled && (
          <div className="mb-4 rounded-2xl border border-gray-200 bg-slate-100 px-4 py-3 text-gray-700">
            Payout-X is currently disabled right now.
          </div>
        )}

        {settlementHoldNum > 0 && (
          <div className="mb-4 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
            <span className="text-amber-500 shrink-0 mt-0.5">⚠</span>
            <div className="text-sm text-amber-700">
              <strong>₹{settlementHoldNum.toFixed(2)}</strong> of your balance is on settlement hold
              and will be available tomorrow at 10:30 AM.{' '}
              Available for payout: <strong>₹{availableBalanceNum.toFixed(2)}</strong>
            </div>
          </div>
        )}
        {settlementType === 'next_day_settlement' && availableBalanceNum <= 0 && (
          <div className="mb-4 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3">
            <span className="text-red-500 shrink-0 mt-0.5">✕</span>
            <p className="text-sm text-red-700">
              No funds available for payout right now. Your earnings are on hold until tomorrow at 10:30 AM.
            </p>
          </div>
        )}

        {/* ── PENDING phase ── */}
        {phase === 'pending' && (
          <div className="rounded-2xl border border-gray-100 bg-slate-50 px-4 py-10 text-center">
            <div className="text-4xl mb-4">⏳</div>
            <h2 className="mb-2 text-xl font-semibold text-gray-900">Payout Processing...</h2>
            <p className="text-sm text-gray-600 mb-6">
              {pollStatus === 'FAILED'
                ? 'Payout failed. Your wallet has been refunded automatically.'
                : pollStatus === 'TIMEOUT'
                ? 'Still pending after multiple checks. We continue checking in background.'
                : pollStatus === 'CRON_HANDOVER'
                ? 'Payout has been handed over to cron status updates.'
                : 'Payout requested. Checking status ...'}
            </p>
            {pollStatus === 'FAILED' || pollStatus === 'TIMEOUT' ? (
              <button
                type="button"
                onClick={resetToList}
                className="inline-flex items-center justify-center rounded-xl bg-[#00D3CD] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#00b8b3]"
              >
                Back to Payout
              </button>
            ) : (
              <div className="flex justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-[#00D3CD]" />
              </div>
            )}
          </div>
        )}

        {/* ── LIST phase ── */}
        {phase === 'list' && (
          <div>
            <div className="mb-4 flex flex-col gap-3 sm:mb-5">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Beneficiaries</h2>
                <p className="text-sm text-gray-500">
                  Choose a saved account to continue with Payout-X.
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <input
                  type="search"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by name, mobile or account number"
                  className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 shadow-sm outline-none transition focus:border-[#00D3CD] focus:ring-2 focus:ring-[#00D3CD]/20 sm:max-w-md"
                />
                <button
                  type="button"
                  onClick={() => setShowAddForm(true)}
                  className="inline-flex w-full items-center justify-center rounded-xl bg-[#00D3CD] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#00b8b3] sm:w-auto"
                >
                  + Add Beneficiary
                </button>
              </div>
            </div>

            {beneficiariesQuery.isLoading ? (
              <div className="rounded-2xl border border-dashed border-gray-200 bg-slate-50 px-4 py-6 text-sm text-gray-500">
                Loading beneficiaries...
              </div>
            ) : beneficiariesQuery.isError ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                Failed to load beneficiaries. Please refresh.
              </div>
            ) : beneficiaries.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-gray-200 bg-slate-50 px-4 py-6 text-sm text-gray-500">
                No beneficiaries found. Add one to proceed.
              </div>
            ) : filteredBeneficiaries.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-gray-200 bg-slate-50 px-4 py-6 text-sm text-gray-500">
                No beneficiaries match your search.
              </div>
            ) : (
              <div className="space-y-3">
                {filteredBeneficiaries.map((b) => (
                  <div
                    key={b.id}
                    className="rounded-2xl border border-gray-200 bg-white p-4"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-gray-900">{b.beneficiary_name}</div>
                      <div className="mt-1 break-words text-xs text-gray-600">
                        {b.account_number} | {b.ifsc_code} | {b.bank_name}
                      </div>
                      <div className="mt-1 break-words text-xs text-gray-500">{b.mobile_number} | {b.email}</div>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 sm:mt-0 sm:ml-2 sm:flex sm:shrink-0 sm:items-center">
                      <button
                        type="button"
                        onClick={() => deleteBeneficiaryMutation.mutate({ id: b.id })}
                        disabled={deleteBeneficiaryMutation.isPending}
                        className="inline-flex items-center justify-center rounded-xl border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 transition-colors hover:bg-red-50 disabled:opacity-60"
                      >
                        Delete
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSelectBeneficiary(b)}
                        disabled={!isPayoutEnabled}
                        className={`inline-flex items-center justify-center rounded-xl px-3 py-2 text-xs font-semibold text-white transition-colors ${
                          isPayoutEnabled
                            ? 'bg-green-600 hover:bg-green-700'
                            : 'bg-gray-400 cursor-not-allowed'
                        }`}
                      >
                        Pay
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── AMOUNT phase ── */}
        {phase === 'amount' && (
          <form onSubmit={handleAmountContinue} className="space-y-4">
            <div className="rounded-2xl border border-[#00D3CD]/20 bg-[#00D3CD]/5 p-4">
              <div className="text-sm font-semibold text-gray-900">Selected Beneficiary</div>
              <div className="mt-1 text-sm text-gray-700">{selectedBeneficiary?.beneficiary_name}</div>
              <div className="mt-1 break-words text-xs text-gray-600">
                {selectedBeneficiary?.account_number} | {selectedBeneficiary?.ifsc_code} |{' '}
                {selectedBeneficiary?.bank_name}
              </div>
            </div>

            <div>
              <label className="mb-1 block text-base font-semibold text-gray-800">
                Amount <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg font-bold text-gray-500">
                  ₹
                </span>
                <input
                  value={form.amount}
                  onChange={(e) => handleAmountChange(e.target.value)}
                  type="text"
                  inputMode="decimal"
                  pattern="[0-9]*[.]?[0-9]*"
                  placeholder="0"
                  className="w-full rounded-2xl border border-gray-200 bg-white py-3 pl-10 pr-4 text-2xl font-bold text-gray-900 shadow-sm outline-none transition-colors focus:border-[#00D3CD]"
                  required
                  autoFocus
                />
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Maximum payout amount: ₹{payoutMaxAmount.toFixed(2)}. The cap is limited to ₹{BRANCHX_MAX_PAYOUT_AMOUNT.toLocaleString('en-IN')}. A service charge may be added by the server based on admin-configured slabs.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Purpose (optional)
              </label>
              <input
                value={form.purpose}
                onChange={(e) => setForm((p) => ({ ...p, purpose: e.target.value }))}
                className="mt-1 block w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-sm outline-none transition-colors focus:border-[#00D3CD]"
                placeholder="e.g. Vendor payment"
              />
            </div>

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
              <button
                type="button"
                onClick={() => { setPhase('list'); setSelectedBeneficiary(null); }}
                className="inline-flex items-center justify-center rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50"
              >
                Back
              </button>
              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-xl bg-[#00D3CD] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#00b8b3]"
              >
                Continue to Confirm
              </button>
            </div>
          </form>
        )}

        {/* ── CONFIRM phase ── */}
        {phase === 'confirm' && (
          <form onSubmit={handleSubmitPayout} className="space-y-4">
            <div className="rounded-2xl border border-green-200 bg-green-50 p-4">
              <div className="mb-2 text-sm font-semibold text-gray-900">Confirm Payout</div>
              <ul className="space-y-1 text-sm text-gray-700">
                <li><strong>Beneficiary:</strong> {selectedBeneficiary?.beneficiary_name}</li>
                <li><strong>Account:</strong> {selectedBeneficiary?.account_number}</li>
                <li><strong>IFSC:</strong> {selectedBeneficiary?.ifsc_code}</li>
                <li><strong>Bank:</strong> {selectedBeneficiary?.bank_name}</li>
                <li><strong>Mobile:</strong> {selectedBeneficiary?.mobile_number}</li>
                <li>
                  <strong>Amount:</strong> ₹{Number(form.amount).toLocaleString('en-IN')}
                </li>
                {form.purpose && <li><strong>Purpose:</strong> {form.purpose}</li>}
                {coords.lat && (
                  <li><strong>Location:</strong> {coords.lat}, {coords.lng}</li>
                )}
              </ul>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-slate-50 px-4 py-3 text-sm text-gray-600">
              A service charge will be calculated automatically from the admin-configured slabs.
              The total deduction will be <strong>amount + service charge</strong>.
            </div>

            <div className="flex items-start gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3">
              <input
                id="branchxConfirmCheck"
                type="checkbox"
                checked={confirmChecked}
                onChange={(e) => setConfirmChecked(e.target.checked)}
                className="mt-0.5 h-4 w-4"
              />
              <label htmlFor="branchxConfirmCheck" className="text-sm text-gray-700">
                I confirm to proceed with this payout
              </label>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                T-PIN <span className="text-red-500">*</span>
              </label>
              <input
                value={form.tpin}
                onChange={(e) => setForm((p) => ({ ...p, tpin: e.target.value }))}
                type="password"
                className="mt-1 block w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-sm outline-none transition-colors focus:border-[#00D3CD]"
                required
              />
            </div>

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
              <button
                type="button"
                onClick={() => setPhase('amount')}
                className="inline-flex items-center justify-center rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={isLoading || !isPayoutEnabled}
                className={`inline-flex items-center justify-center rounded-xl px-4 py-3 text-sm font-semibold text-white ${
                  isPayoutEnabled && !isLoading
                    ? 'bg-[#00D3CD] hover:bg-[#00b8b3]'
                    : 'bg-gray-400 cursor-not-allowed'
                }`}
              >
                {isLoading ? 'Processing…' : 'Submit Payout'}
              </button>
            </div>
          </form>
        )}

        {/* ── Add Beneficiary Modal ── */}
        {showAddForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-lg rounded-lg bg-white p-5 shadow-lg">
              <h3 className="text-lg font-semibold mb-1">Add Beneficiary</h3>
              <p className="text-xs text-gray-500 mb-3">
                Bank account is validated automatically (penny-drop). The name stored will be
                the bank-verified name, which may differ from what you enter.
              </p>
              <form onSubmit={handleAddBeneficiarySubmit} className="space-y-3">
                {[
                  { field: 'beneficiary_name', label: 'Beneficiary Name' },
                  { field: 'mobile_number', label: 'Mobile Number' },
                  { field: 'bank_name', label: 'Bank Name' },
                  { field: 'account_number', label: 'Account Number' },
                  { field: 'ifsc_code', label: 'IFSC Code' },
                  { field: 'email', label: 'Email', type: 'email' },
                ].map(({ field, label, type = 'text' }) => (
                  <div key={field}>
                    <label className="block text-sm font-medium text-gray-700">
                      {label} <span className="text-red-500">*</span>
                    </label>
                    <input
                      type={type}
                      value={addForm[field]}
                      onChange={(e) =>
                        setAddForm((p) => ({
                          ...p,
                          [field]:
                            field === 'mobile_number'
                              ? e.target.value.replace(/\D/g, '').slice(0, 10)
                              :
                            field === 'ifsc_code'
                              ? e.target.value.toUpperCase()
                              : e.target.value,
                        }))
                      }
                      inputMode={field === 'mobile_number' ? 'numeric' : undefined}
                      maxLength={field === 'mobile_number' ? 10 : undefined}
                      pattern={field === 'mobile_number' ? '\\d{10}' : undefined}
                      className={`mt-1 block w-full rounded shadow-sm focus:ring-indigo-500 ${
                        field === 'mobile_number' && mobileHasRepeatedDigits
                          ? 'border-red-500 focus:border-red-500'
                          : 'border-gray-300'
                      }`}
                      required
                    />
                    {field === 'mobile_number' && mobileHasRepeatedDigits && (
                      <p className="mt-1 text-xs text-red-600">
                        Mobile number cannot contain the same digit 5 or more times consecutively.
                      </p>
                    )}
                  </div>
                ))}
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddForm(false);
                      setAddForm(EMPTY_ADD_FORM);
                    }}
                    className="px-4 py-2 rounded bg-gray-300 text-gray-700 hover:bg-gray-400"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={addBeneficiaryMutation.isPending || mobileHasRepeatedDigits}
                    className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
                  >
                    {addBeneficiaryMutation.isPending ? 'Validating…' : 'Add'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Daily Limit Exceeded Center Pop-up Modal */}
        {limitAlertModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-fadeIn">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 border border-gray-100 text-center">
              <div className="w-14 h-14 bg-red-50 rounded-2xl border border-red-100 flex items-center justify-center mx-auto text-red-600 shadow-sm">
                <ShieldAlert className="w-8 h-8" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-gray-900">Daily Payout Limit Exceeded</h3>
                <p className="text-sm text-gray-600 leading-relaxed px-2">
                  {limitAlertModal}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setLimitAlertModal(null)}
                className="w-full py-3 px-4 bg-[#00D3CD] hover:bg-[#00b8b2] text-white font-bold rounded-xl text-sm transition-all shadow-md active:scale-95"
              >
                OK
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BranchXPayout;
// END OF FILE