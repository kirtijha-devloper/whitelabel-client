import React, { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { Landmark, UserPlus, X, ShieldAlert } from 'lucide-react';
import {
  getMxBeneficiaries,
  addMxBeneficiary,
  deleteMxBeneficiary,
  initiateMxPayout,
  checkMxPayoutStatus,
  getMxPayoutReference,
} from '../api/mxPayoutApi';
import { getVimoBanks } from '../api/vimoApi';
import {
  getServiceDisabledMessage,
  getServiceFlagValue,
  isServiceDisabledError,
} from '../utils/serviceFlags';
import { checkUserDailyPayoutLimit, recordUserPayoutExecution } from '../utils/userLimit';

const POLL_INTERVAL_MS = 6000;
const MAX_POLL_ATTEMPTS = 10;
const AUTO_POLL_CUTOFF_MS = 4 * 60 * 1000;
const MX_MAX_PAYOUT_AMOUNT = 100000;

const EMPTY_ADD_FORM = {
  beneficiary_name: '',
  mobile_number: '',
  bank_name: '',
  account_number: '',
  ifsc_code: '',
  email: '',
};

const hasRepeatedDigitSequence = (value = '') => /(\d)\1{4,}/.test(value);

const MxPayout = ({ currentUser }) => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const pollTimerRef = useRef(null);
  const pollAttemptsRef = useRef(0);
  const pollingStartedAtRef = useRef(null);

  const merchantId = currentUser?.id;
  const isPayoutEnabled = getServiceFlagValue(currentUser?.service_flags, 'mx_payout', true);
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
    MX_MAX_PAYOUT_AMOUNT
  );
  const settlementType = currentUser?.settlement_type;
  const fieldClassName =
    'mt-1 block w-full rounded-xl border border-gray-200 bg-slate-50 px-4 py-3 text-sm text-gray-900 shadow-sm outline-none transition focus:border-[#00D3CD] focus:bg-white focus:ring-2 focus:ring-[#00D3CD]/20';

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
  
  const activeRefId = useRef(null);

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

  const beneficiariesQuery = useQuery({
    queryKey: ['mxBeneficiaries', merchantId],
    queryFn: () => getMxBeneficiaries(merchantId),
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

  const banksQuery = useQuery({
    queryKey: ['mxBankOptions'],
    queryFn: () => getVimoBanks(),
    retry: 1,
    refetchOnWindowFocus: false,
  });

  const banks = Array.isArray(banksQuery.data?.data)
    ? banksQuery.data.data
    : Array.isArray(banksQuery.data)
    ? banksQuery.data
    : [];
  const normalizedBankOptions = banks
    .map((bank) => ({
      code: String(bank.code || '').trim(),
      description: String(bank.description || bank.bank_name || bank.name || '').trim(),
    }))
    .filter((bank) => bank.description);
  const normalizedBankName = String(addForm.bank_name || '').trim().toLowerCase();
  const filteredBankSuggestions = normalizedBankName
    ? normalizedBankOptions
        .filter((bank) => bank.description.toLowerCase().includes(normalizedBankName))
        .slice(0, 8)
    : normalizedBankOptions.slice(0, 8);

  const addBeneficiaryMutation = useMutation({
    mutationFn: addMxBeneficiary,
    onSuccess: async () => {
      toast.success('Beneficiary added successfully.');
      await queryClient.invalidateQueries(['mxBeneficiaries', merchantId]);
      setShowAddForm(false);
      setAddForm(EMPTY_ADD_FORM);
    },
    onError: (error) => {
      const msg = error?.response?.data?.message || error?.message || 'Failed to add beneficiary';
      toast.error(msg);
    },
  });

  const deleteBeneficiaryMutation = useMutation({
    mutationFn: ({ id }) => deleteMxBeneficiary(id, merchantId),
    onSuccess: async () => {
      toast.success('Beneficiary removed.');
      await queryClient.invalidateQueries(['mxBeneficiaries', merchantId]);
    },
    onError: (error) => {
      toast.error(error?.message || 'Failed to delete beneficiary.');
    },
  });

  const buildSuccessState = (statusData, amountVal) => ({
    payoutData: {
      status: statusData?.status,
      utr: statusData?.utr || statusData?.bankReferenceNo,
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
    returnPath: `/${normalizedRole}/mx-payout`,
  });

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
    pollTimerRef.current = setTimeout(
      () => doPoll({ requestId, payoutTransactionId }),
      POLL_INTERVAL_MS
    );
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
      ? {
          requestId: effectiveRequestId,
        }
      : effectivePayoutTransactionId
      ? {
          payout_transaction_id: Number(effectivePayoutTransactionId),
        }
      : {};

    if (!payload.requestId && !payload.payout_transaction_id) {
      toast.error('Missing payout reference for status check (requestId or payout_transaction_id required).');
      return;
    }

    try {
      const res = await checkMxPayoutStatus(payload);
      const statusRaw = res?.data?.status || res?.status;
      const status = statusRaw ? String(statusRaw).toUpperCase() : 'PENDING';
      setPollStatus(status);
      
      await queryClient.invalidateQueries(['currentUser']);

      if (status === 'SUCCESS') {
        clearPollingTimer();
        toast.success('Payout successful!');
        navigate(`/${normalizedRole}/mx-payout/success`, {
          replace: true,
          state: buildSuccessState(res?.data || res, form.amount),
        });
      } else if (status === 'FAILED') {
        clearPollingTimer();
        toast.error('Payout failed.');
      } else if (pollAttemptsRef.current >= MAX_POLL_ATTEMPTS) {
        clearPollingTimer();
        setPollStatus('TIMEOUT');
        toast.warn('Max status-check attempts reached. Please check the Payout Report for final status.');
      } else {
        toast.info(`Payout pending, retrying... (${pollAttemptsRef.current}/${MAX_POLL_ATTEMPTS})`);
        startPolling({ requestId: pendingApiRef, payoutTransactionId: savedPayoutTransactionId });
      }
    } catch (error) {
      await queryClient.invalidateQueries(['currentUser']).catch(() => {});
      
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

  const payoutMutation = useMutation({
    mutationFn: initiateMxPayout,
    onSuccess: async (data) => {
      recordUserPayoutExecution(currentUser?.id, Number(form.amount));
      await queryClient.invalidateQueries(['currentUser']);
      const txnStatus = data?.data?.status || data?.status;

      if (txnStatus === 'PENDING') {
        const apiRef = data?.data?.requestId || activeRefId.current || null;
        const payoutId = data?.data?.payoutTransactionId || null;
        setPendingApiRef(apiRef);
        setSavedPayoutTransactionId(payoutId);
        setPhase('pending');
        setPollStatus('PENDING');
        pollAttemptsRef.current = 0;
        startPolling({ requestId: apiRef, payoutTransactionId: payoutId });
        toast.info('Payout requested. Checking status automatically...');
      } else if (txnStatus === 'SUCCESS') {
        const payoutId = data?.data?.payoutTransactionId || null;
        setSavedPayoutTransactionId(payoutId);
        toast.success(data?.message || 'Payout successful');
        navigate(`/${normalizedRole}/mx-payout/success`, {
          replace: true,
          state: buildSuccessState(data?.data || data, form.amount),
        });
      } else {
        toast.error(data?.message || 'Payout failed');
        setPhase('pending');
        setPollStatus('FAILED');
      }
    },
    onError: (error) => {
      const status = error?.status || error?.response?.status;
      const msg = error?.response?.data?.message || error?.message || 'Payout failed';
      const isTimeout = msg.toLowerCase().includes('timeout') ||
                        msg.toLowerCase().includes('network') ||
                        status === 504 ||
                        error?.response?.status === 504;

      if (isTimeout && activeRefId.current) {
        toast.info('Network request timed out. Checking status in background...');
        setPollStatus('PENDING');
        pollAttemptsRef.current = 0;
        startPolling({ requestId: activeRefId.current });
      } else {
        setPhase('confirm');
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
              `Insufficient available balance. Rs ${settlementHoldNum.toFixed(2)} is on hold. Available: Rs ${availableBalanceNum.toFixed(2)}.`
            );
          } else {
            toast.error('Insufficient wallet balance.');
          }
        } else {
          toast.error(msg);
        }
      }
    },
  });

  const handleSelectBeneficiary = (beneficiary) => {
    setSelectedBeneficiary(beneficiary);
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

  const handleAmountContinue = async (event) => {
    event.preventDefault();
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
          `Maximum payout amount is Rs ${payoutMaxAmount.toFixed(2)}. Rs ${settlementHoldNum.toFixed(2)} is on hold. Available: Rs ${availableBalanceNum.toFixed(2)}.`
        );
      } else {
        toast.error(`Maximum payout amount is Rs ${payoutMaxAmount.toFixed(2)}.`);
      }
      return;
    }

    setPhase('confirm');
  };

  const handleSubmitPayout = async (event) => {
    event.preventDefault();
    if (!confirmChecked) {
      toast.error('Please confirm the transaction.');
      return;
    }
    if (!form.tpin) {
      toast.error('T-PIN is required.');
      return;
    }
    if (!isPayoutEnabled) {
      toast.error('Payout-M-X is currently disabled.');
      return;
    }

    setPhase('pending');
    setPollStatus('INITIATING');

    try {
      const refRes = await getMxPayoutReference(merchantId);
      const referenceId = refRes?.reference || refRes?.crn || refRes?.merchantRefId || refRes?.requestId;
      if (!referenceId) {
        throw new Error('Failed to generate reference ID');
      }

      activeRefId.current = referenceId;
      setPendingApiRef(referenceId);

      const lat = coords.lat || '22.5726';
      const lng = coords.lng || '88.3639';

      const payload = {
        merchant_id: Number(merchantId),
        beneficiary_id: Number(selectedBeneficiary.id),
        amount: Number(form.amount),
        tpin: String(form.tpin),
        reference_id: referenceId,
        remark: form.purpose || 'Vendor payout',
        transferMode: 'IMPS',
        latitude: lat,
        longitude: lng,
      };

      payoutMutation.mutate(payload);
    } catch (err) {
      toast.error(err?.message || 'Failed to initiate payout');
      setPhase('confirm');
    }
  };

  const handleAddBeneficiarySubmit = (event) => {
    event.preventDefault();
    const { beneficiary_name, mobile_number, bank_name, account_number, ifsc_code, email } = addForm;
    if (!beneficiary_name || !mobile_number || !bank_name || !account_number || !ifsc_code || !email) {
      toast.error('All fields are required.');
      return;
    }
    if (!/^\d{10}$/.test(mobile_number)) {
      toast.error('Mobile number must be exactly 10 digits.');
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

  return (
    <div className="pb-1">
      <div className="mx-auto max-w-4xl rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:p-5 md:p-6">
        <h1 className="mb-2 text-2xl font-bold">Payout-M-X</h1>
        <p className="mb-5 border-b border-gray-100 pb-4 text-sm text-gray-600 sm:mb-6 sm:pb-5">
          Role: {normalizedRole}. Payout status: {isPayoutEnabled ? 'Enabled' : 'Disabled'}.
        </p>

        <div className="mb-4 rounded-2xl border border-gray-200 bg-slate-50 px-4 py-3">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">
            <Landmark className="h-4 w-4 text-[#00D3CD]" />
            Available Balance
          </div>
          <p className="mt-2 text-xl font-semibold text-gray-900">
            Rs {availableBalanceNum.toFixed(2)}
          </p>
        </div>

        {pollStatus === 'CRON_HANDOVER' && (
          <div className="mb-4 rounded border border-blue-200 bg-blue-50 px-4 py-3 text-blue-700">
            Payout has been handed over to the backend cron status update process. Refresh the report page for the latest status.
          </div>
        )}
        {locationStatus === 'denied' && (
          <div className="mb-4 rounded bg-red-100 px-4 py-3 text-red-700">
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
            Payout-M-X is currently disabled right now.
          </div>
        )}

        {settlementHoldNum > 0 && (
          <div className="mb-4 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
            <span className="mt-0.5 shrink-0 text-amber-500">!</span>
            <div className="text-sm text-amber-700">
              <strong>Rs {settlementHoldNum.toFixed(2)}</strong> of your balance is on settlement hold
              and will be available tomorrow at 10:30 AM. Available for payout:{' '}
              <strong>Rs {availableBalanceNum.toFixed(2)}</strong>
            </div>
          </div>
        )}
        {settlementType === 'next_day_settlement' && availableBalanceNum <= 0 && (
          <div className="mb-4 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3">
            <span className="mt-0.5 shrink-0 text-red-500">x</span>
            <p className="text-sm text-red-700">
              No funds available for payout right now. Your earnings are on hold until tomorrow at 10:30 AM.
            </p>
          </div>
        )}

        {phase === 'pending' && (
          <div className="rounded-2xl border border-gray-100 bg-slate-50 px-4 py-10 text-center">
            <div className="mb-4 flex justify-center">
              {pollStatus === 'FAILED' ? (
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-red-600 text-2xl font-bold">✕</div>
              ) : pollStatus === 'SUCCESS' ? (
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-green-600 text-2xl font-bold">✓</div>
              ) : (
                <div className="h-12 w-12 animate-spin rounded-full border-4 border-gray-200 border-t-[#00D3CD]" />
              )}
            </div>
            <h2 className="mb-2 text-xl font-semibold text-gray-900">
              {pollStatus === 'INITIATING'
                ? 'Initiating Payout...'
                : pollStatus === 'FAILED'
                ? 'Payout Failed'
                : 'Processing Payout...'}
            </h2>
            <p className="mb-6 text-sm text-gray-600">
              {pollStatus === 'INITIATING'
                ? 'Pre-checking and initiating your request. Please do not refresh.'
                : pollStatus === 'FAILED'
                ? 'Payout failed. In case of failure, check status reports or contact admin.'
                : pollStatus === 'TIMEOUT'
                ? 'Still pending after multiple checks. We continue checking in background.'
                : pollStatus === 'CRON_HANDOVER'
                ? 'Payout has been handed over to cron status updates.'
                : 'Payout requested. Checking status automatically ...'}
            </p>
            {pollStatus === 'FAILED' || pollStatus === 'TIMEOUT' || pollStatus === 'CRON_HANDOVER' ? (
              <button
                type="button"
                onClick={resetToList}
                className="inline-flex items-center justify-center rounded-xl bg-[#00D3CD] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#00b8b3]"
              >
                Back to Payout
              </button>
            ) : null}
          </div>
        )}

        {phase === 'list' && (
          <div>
            <div className="mb-4 flex flex-col gap-3 sm:mb-5">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Beneficiaries</h2>
                <p className="text-sm text-gray-500">
                  Choose a saved account to continue with Payout-M-X.
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
                {filteredBeneficiaries.map((beneficiary) => (
                  <div
                    key={beneficiary.id}
                    className="rounded-2xl border border-gray-200 bg-white p-4"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-gray-900">
                        {beneficiary.beneficiary_name}
                      </div>
                      <div className="mt-1 break-words text-xs text-gray-600">
                        {beneficiary.account_number} | {beneficiary.ifsc_code} | {beneficiary.bank_name}
                      </div>
                      <div className="mt-1 break-words text-xs text-gray-500">
                        {beneficiary.mobile_number} | {beneficiary.email}
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 sm:mt-0 sm:ml-2 sm:flex sm:shrink-0 sm:items-center">
                      <button
                        type="button"
                        onClick={() => deleteBeneficiaryMutation.mutate({ id: beneficiary.id })}
                        disabled={deleteBeneficiaryMutation.isPending}
                        className="inline-flex items-center justify-center rounded-xl border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 transition-colors hover:bg-red-50 disabled:opacity-60"
                      >
                        Delete
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSelectBeneficiary(beneficiary)}
                        disabled={!isPayoutEnabled}
                        className={`inline-flex items-center justify-center rounded-xl px-3 py-2 text-xs font-semibold text-white transition-colors ${
                          isPayoutEnabled
                            ? 'bg-green-600 hover:bg-green-700'
                            : 'cursor-not-allowed bg-gray-400'
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
                  Rs
                </span>
                <input
                  value={form.amount}
                  onChange={(event) => handleAmountChange(event.target.value)}
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
                Maximum payout amount: Rs {payoutMaxAmount.toFixed(2)}. The cap is limited to Rs{' '}
                {MX_MAX_PAYOUT_AMOUNT.toLocaleString('en-IN')}. A service charge may be added
                by the server based on admin-configured slabs.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Purpose (optional)</label>
              <input
                value={form.purpose}
                onChange={(event) => setForm((prev) => ({ ...prev, purpose: event.target.value }))}
                className="mt-1 block w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-sm outline-none transition-colors focus:border-[#00D3CD]"
                placeholder="e.g. Vendor payment"
              />
            </div>

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
              <button
                type="button"
                onClick={() => {
                  setPhase('list');
                  setSelectedBeneficiary(null);
                }}
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
                <li><strong>Amount:</strong> Rs {Number(form.amount).toLocaleString('en-IN')}</li>
                {form.purpose && <li><strong>Purpose:</strong> {form.purpose}</li>}
                {coords.lat && <li><strong>Location:</strong> {coords.lat}, {coords.lng}</li>}
              </ul>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-slate-50 px-4 py-3 text-sm text-gray-600">
              A service charge will be calculated automatically from the admin-configured slabs.
              The total deduction will be <strong>amount + service charge</strong>.
            </div>

            <div className="flex items-start gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3">
              <input
                id="mxConfirmCheck"
                type="checkbox"
                checked={confirmChecked}
                onChange={(event) => setConfirmChecked(event.target.checked)}
                className="mt-0.5 h-4 w-4"
              />
              <label htmlFor="mxConfirmCheck" className="text-sm text-gray-700">
                I confirm to proceed with this payout
              </label>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                T-PIN <span className="text-red-500">*</span>
              </label>
              <input
                value={form.tpin}
                onChange={(event) => setForm((prev) => ({ ...prev, tpin: event.target.value }))}
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
                disabled={isLoading}
                className="inline-flex items-center justify-center rounded-xl bg-[#00D3CD] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#00b8b3] disabled:opacity-60"
              >
                {isLoading ? 'Processing...' : 'Confirm & Pay'}
              </button>
            </div>
          </form>
        )}

        {showAddForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
              <button
                type="button"
                onClick={() => {
                  setShowAddForm(false);
                  setAddForm(EMPTY_ADD_FORM);
                }}
                className="absolute right-4 top-4 rounded-full p-1 text-gray-400 hover:bg-slate-100 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>

              <h2 className="mb-4 text-xl font-bold text-gray-900">Add New Beneficiary</h2>

              <form onSubmit={handleAddBeneficiarySubmit} className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    value={addForm.beneficiary_name}
                    onChange={(event) =>
                      setAddForm((prev) => ({ ...prev, beneficiary_name: event.target.value }))
                    }
                    className={fieldClassName}
                    placeholder="Enter full name"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Mobile Number <span className="text-red-500">*</span>
                    </label>
                    <input
                      value={addForm.mobile_number}
                      onChange={(event) =>
                        setAddForm((prev) => ({
                          ...prev,
                          mobile_number: event.target.value.replace(/\D/g, '').slice(0, 10),
                        }))
                      }
                      className={fieldClassName}
                      placeholder="10 digit mobile"
                      required
                    />
                    {mobileHasRepeatedDigits && (
                      <p className="mt-1 text-xs text-red-500">
                        Invalid mobile number: repeating patterns detected.
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Email Address <span className="text-red-500">*</span>
                    </label>
                    <input
                      value={addForm.email}
                      onChange={(event) =>
                        setAddForm((prev) => ({ ...prev, email: event.target.value }))
                      }
                      type="email"
                      className={fieldClassName}
                      placeholder="email@example.com"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Bank Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    value={addForm.bank_name}
                    onChange={(event) =>
                      setAddForm((prev) => ({ ...prev, bank_name: event.target.value }))
                    }
                    className={fieldClassName}
                    placeholder="Search or enter bank name"
                    required
                  />
                  {filteredBankSuggestions.length > 0 && (
                    <div className="mt-1 max-h-40 overflow-y-auto rounded-xl border border-gray-100 bg-white shadow-lg">
                      {filteredBankSuggestions.map((bankOption) => (
                        <button
                          key={bankOption.code}
                          type="button"
                          onClick={() =>
                            setAddForm((prev) => ({ ...prev, bank_name: bankOption.description }))
                          }
                          className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-slate-50"
                        >
                          {bankOption.description}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Account Number <span className="text-red-500">*</span>
                    </label>
                    <input
                      value={addForm.account_number}
                      onChange={(event) =>
                        setAddForm((prev) => ({
                          ...prev,
                          account_number: event.target.value.replace(/\D/g, ''),
                        }))
                      }
                      className={fieldClassName}
                      placeholder="Account number"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      IFSC Code <span className="text-red-500">*</span>
                    </label>
                    <input
                      value={addForm.ifsc_code}
                      onChange={(event) =>
                        setAddForm((prev) => ({
                          ...prev,
                          ifsc_code: event.target.value.toUpperCase().slice(0, 11),
                        }))
                      }
                      className={fieldClassName}
                      placeholder="11 characters"
                      required
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddForm(false);
                      setAddForm(EMPTY_ADD_FORM);
                    }}
                    className="flex-1 rounded-xl border border-gray-200 py-3 text-sm font-semibold text-gray-700 transition hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isLoading || mobileHasRepeatedDigits}
                    className="flex-1 rounded-xl bg-[#00D3CD] py-3 text-sm font-semibold text-white transition hover:bg-[#00b8b3] disabled:opacity-60"
                  >
                    {addBeneficiaryMutation.isPending ? 'Adding...' : 'Add Beneficiary'}
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

export default MxPayout;
