import React, { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  AlertCircle,
  CheckCircle2,
  Landmark,
  MapPin,
  Pencil,
  Send,
  Trash2,
  UserPlus,
  X,
  ShieldAlert,
} from 'lucide-react';
import { BASE_URL } from '../constants';
import {
  getVimoAuthToken,
  getVimoBanks,
  getVimoPurposes,
  getVimoStates,
  getVimoPayoutReference,
  createVimoPayout,
  getVimoBeneficiaries,
  createVimoBeneficiary,
  updateVimoBeneficiary,
  deleteVimoBeneficiary,
  checkVimoBeneficiaryLimit,
  getVimoWalletBalance,
} from '../api/vimoApi';
import {
  getServiceDisabledMessage,
  getServiceFlagValue,
  isServiceDisabledError,
} from '../utils/serviceFlags';
import { checkUserDailyPayoutLimit, recordUserPayoutExecution } from '../utils/userLimit';

const MIN_PAYOUT_AMOUNT = 100;
const MAX_PAYOUT_AMOUNT = 80000;
const IFSC_REGEX = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const BENEFICIARY_NAME_REGEX = /^[A-Za-z ]{2,100}$/;
const ACCOUNT_NUMBER_REGEX = /^[0-9]{9,18}$/;

const sanitizeIfsc = (value = '') => String(value || '').toUpperCase().replace(/\s+/g, '').trim();
const sanitizeBeneficiaryName = (value = '') =>
  String(value || '')
    .replace(/[^A-Za-z ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
const sanitizeAccountNumber = (value = '') => String(value || '').replace(/\D/g, '').slice(0, 18);

const VimoPayout = ({ currentUser }) => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    amount: '',
    merchantRefId: '',
    paymentMode: 'IMPS',
    paymentPurpose: '',
    beneficiaryBank: '',
    beneficiaryBranch: '',
    beneficiaryEmail: '',
    beneficiaryAccountNumber: '',
    beneficiaryIFSC: '',
    beneficiaryMobileNumber: '',
    beneficiaryName: '',
    beneficiaryStateCode: '',
    beneficiaryLocation: '',
    lat: '',
    long: '',
    tpin: '',
    purpose: '',
    service_charge: '',
    beneficiary_id: null,
  });
  const [vimoPhase, setVimoPhase] = useState('list');
  const [limitAlertModal, setLimitAlertModal] = useState(null);
  const [failedError, setFailedError] = useState(null);
  const [selectedBeneficiary, setSelectedBeneficiary] = useState(null);
  const [confirmChecked, setConfirmChecked] = useState(false);
  const [showBeneficiaryForm, setShowBeneficiaryForm] = useState(false);
  const [editingBeneficiary, setEditingBeneficiary] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [locationStatus, setLocationStatus] = useState('unknown');
  const [isCheckingLimit, setIsCheckingLimit] = useState(false);
  const [checkingMessage, setCheckingMessage] = useState('');

  const isPayoutEnabled = getServiceFlagValue(currentUser?.service_flags, 'vimo_payout', true);
  const walletNum = parseFloat(currentUser?.wallet ?? 0);
  const availableBalanceNum =
    currentUser?.available_balance !== undefined
      ? parseFloat(currentUser.available_balance)
      : walletNum;
  const settlementHoldNum = Math.max(0, walletNum - availableBalanceNum);
  const payoutMaxAmount = Math.min(
    Number.isFinite(availableBalanceNum) ? Math.max(0, availableBalanceNum) : 0,
    MAX_PAYOUT_AMOUNT
  );
  const settlementType = currentUser?.settlement_type;
  const role = String(currentUser?.role || '').trim().toLowerCase();
  const normalizedRole = role === 'franchaise' ? 'franchise' : role;
  const fieldClassName =
    'mt-1 block w-full rounded-xl border border-gray-200 bg-slate-50 px-4 py-3 text-sm text-gray-900 shadow-sm outline-none transition focus:border-[#00D3CD] focus:bg-white focus:ring-2 focus:ring-[#00D3CD]/20';
  const payoutAmount = Number(form.amount);
  const isAmountPresent = form.amount !== '';
  const isAmountWholeNumber = /^[0-9]+$/.test(form.amount);
  const isAmountWithinRange =
    isAmountPresent &&
    isAmountWholeNumber &&
    Number.isFinite(payoutAmount) &&
    payoutAmount >= MIN_PAYOUT_AMOUNT &&
    payoutAmount <= payoutMaxAmount;
  const amountValidationMessage = isAmountPresent && !isAmountWithinRange
    ? `Amount must be between ${MIN_PAYOUT_AMOUNT} to ₹${payoutMaxAmount.toFixed(2)}.`
    : '';

  const getAmountValidationError = () => {
    if (!isAmountPresent || !isAmountWholeNumber || !Number.isFinite(payoutAmount)) {
      return 'Enter a valid whole number amount.';
    }

    if (payoutAmount < MIN_PAYOUT_AMOUNT || payoutAmount > payoutMaxAmount) {
      return `Amount must be between ${MIN_PAYOUT_AMOUNT} to ₹${payoutMaxAmount.toFixed(2)}.`;
    }

    return '';
  };

  const handleAmountChange = (value) => {
    const sanitized = String(value || '').replace(/\D/g, '');

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

  const resetBeneficiaryForm = () => {
    setForm((prev) => ({
      ...prev,
      beneficiaryBank: '',
      beneficiaryBranch: '',
      beneficiaryEmail: '',
      beneficiaryAccountNumber: '',
      beneficiaryIFSC: '',
      beneficiaryMobileNumber: '',
      beneficiaryName: '',
      beneficiaryStateCode: '',
      beneficiaryLocation: '',
      beneficiary_id: null,
    }));
  };

  const openAddBeneficiaryModal = () => {
    setEditingBeneficiary(null);
    resetBeneficiaryForm();
    setShowBeneficiaryForm(true);
  };

  const handleBeneficiaryFormSubmit = (e) => {
    e.preventDefault();

    const beneficiaryBank = String(form.beneficiaryBank || '').trim();
    const beneficiaryAccountNumber = sanitizeAccountNumber(form.beneficiaryAccountNumber);
    const beneficiaryIFSC = sanitizeIfsc(form.beneficiaryIFSC);
    const beneficiaryName = sanitizeBeneficiaryName(form.beneficiaryName);
    const beneficiaryMobileNumber = String(form.beneficiaryMobileNumber || '').trim();
    const beneficiaryEmail = String(form.beneficiaryEmail || '').trim();
    const beneficiaryBranch = String(form.beneficiaryBranch || '').trim();

    if (
      !beneficiaryBank ||
      !beneficiaryAccountNumber ||
      !beneficiaryIFSC ||
      !beneficiaryName ||
      !beneficiaryMobileNumber ||
      !beneficiaryEmail
    ) {
      toast.error('Please fill all beneficiary fields.');
      return;
    }

    if (!ACCOUNT_NUMBER_REGEX.test(beneficiaryAccountNumber)) {
      toast.error('Account number must contain 9 to 18 digits only.');
      return;
    }

    if (!IFSC_REGEX.test(beneficiaryIFSC)) {
      toast.error('IFSC must be in valid format: ABCD0XXXXXX.');
      return;
    }

    if (!/^[6-9]\d{9}$/.test(beneficiaryMobileNumber)) {
      toast.error(
        "Mobile number must be a valid 10-digit number starting with 6, 7, 8, or 9."
      );
      return;
    }

    if (!IFSC_REGEX.test(beneficiaryIFSC)) {
      toast.error('IFSC must be in valid format: ABCD0XXXXXX.');
      return;
    }

    if (!/^[6-9]\d{9}$/.test(beneficiaryMobileNumber)) {
      toast.error(
        "Mobile number must be a valid 10-digit number starting with 6, 7, 8, or 9."
      );
      return;
    }

    if (!BENEFICIARY_NAME_REGEX.test(beneficiaryName)) {
      toast.error('Beneficiary name must contain only letters and single spaces.');
      return;
    }

    if (!/^[6-9]\d{9}$/.test(beneficiaryMobileNumber)) {
      toast.error('Mobile number must be exactly 10 digits and start with 6, 7, 8, or 9.');
      return;
    }

    const payload = {
      user_id: Number(currentUser?.id),
      bankName: beneficiaryBank,
      accountNumber: beneficiaryAccountNumber,
      ifsc: beneficiaryIFSC,
      name: beneficiaryName,
      mobileNumber: beneficiaryMobileNumber,
      email: beneficiaryEmail,
      state: form.beneficiaryStateCode,
      branchName: beneficiaryBranch,
    };

    console.info('[vimo-beneficiary] submit payload:', {
      id: editingBeneficiary?.id,
      payload,
    });

    beneficiaryMutation.mutate({ id: editingBeneficiary?.id, data: payload });
  };

  const handleSelectBeneficiary = (beneficiary) => {
    const mobile = beneficiary.mobile_number || beneficiary.mobile || beneficiary.mobileNumber || '';
    if (!/^[6-9]\d{9}$/.test(mobile)) {
      toast.error('Selected beneficiary has an invalid mobile number. It must be 10 digits and start with 6, 7, 8, or 9.');
      return;
    }
    const beneficiaryData = {
      beneficiary_id: beneficiary.id,
      beneficiaryBank:
        beneficiary.bank_name || beneficiary.bankName || beneficiary.bank || '',
      beneficiaryBranch:
        beneficiary.branch_name || beneficiary.branchName || beneficiary.branch || '',
      beneficiaryEmail: beneficiary.email || '',
      beneficiaryAccountNumber: sanitizeAccountNumber(
        beneficiary.account_number || beneficiary.accountNumber || ''
      ),
      beneficiaryIFSC: sanitizeIfsc(
        beneficiary.ifsc_code || beneficiary.ifsc || beneficiary.ifscCode || ''
      ),
      beneficiaryName:
        sanitizeBeneficiaryName(
          beneficiary.beneficiary_name || beneficiary.name || beneficiary.accountName || ''
        ),
      beneficiaryMobileNumber:
        beneficiary.mobile_number || beneficiary.mobile || beneficiary.mobileNumber || '',
      beneficiaryStateCode:
        beneficiary.state || beneficiary.state_code || beneficiary.stateCode || '',
      beneficiaryLocation: beneficiary.location || '',
    };

    setSelectedBeneficiary(beneficiary);
    setForm((prev) => ({ ...prev, ...beneficiaryData }));
    setVimoPhase('amount');
  };

  const getGeolocation = () =>
    new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve({ latitude: null, longitude: null });
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
        () => resolve({ latitude: null, longitude: null }),
        { timeout: 10000 }
      );
    });



  const goToConfirmPhase = async () => {
    const activeBeneficiaryMobile =
      form.beneficiaryMobileNumber ||
      selectedBeneficiary?.mobile_number ||
      selectedBeneficiary?.mobile ||
      selectedBeneficiary?.mobileNumber ||
      '';
    if (!/^[6-9]\d{9}$/.test(activeBeneficiaryMobile)) {
      toast.error('Beneficiary mobile number must be exactly 10 digits and start with 6, 7, 8, or 9.');
      return;
    }
    const amountError = getAmountValidationError();
    if (amountError) {
      toast.error(amountError);
      return;
    }
    if (!form.merchantRefId) {
      toast.error('merchantRefId is required.');
      return;
    }

    const isGlobalLimitActive = getServiceFlagValue(currentUser?.service_flags, 'user_daily_limit', true);
    const limitCheck = checkUserDailyPayoutLimit({
      userId: currentUser?.id,
      requestedAmount: payoutAmount,
      isGlobalLimitActive,
    });

    if (!limitCheck.allowed) {
      setLimitAlertModal(limitCheck.message);
      return;
    }

    const serviceCharge = Number(form.service_charge) || 0;
    if (availableBalanceNum < payoutAmount + serviceCharge) {
      if (settlementHoldNum > 0) {
        toast.error(
          `Insufficient available balance. \u20B9${settlementHoldNum.toFixed(
            2
          )} is on hold and will be available tomorrow at 10:30 AM. Available now: \u20B9${availableBalanceNum.toFixed(
            2
          )}.`
        );
      } else {
        toast.error('Insufficient wallet balance.');
      }
      return;
    }

    setIsCheckingLimit(true);
    setCheckingMessage('Fetching geolocation...');

    let lat = form.lat;
    let long = form.long;

    if (!lat || !long) {
      if (!navigator.geolocation) {
        toast.error('Browser geolocation is not available. Payout cannot be done.');
        setIsCheckingLimit(false);
        return;
      }

      try {
        const coords = await getGeolocation();
        if (!coords?.latitude || !coords?.longitude) {
          toast.error('Unable to get location. Please enable location permission and retry.');
          setIsCheckingLimit(false);
          return;
        }

        lat = String(coords.latitude);
        long = String(coords.longitude);
        setForm((prev) => ({
          ...prev,
          lat,
          long,
        }));
      } catch (geoErr) {
        toast.error('Location error. Please try again.');
        setIsCheckingLimit(false);
        return;
      }
    }

    setCheckingMessage('Checking beneficiary limit...');
    try {
      const activeAccountNumber = form.beneficiaryAccountNumber || selectedBeneficiary?.account_number || selectedBeneficiary?.accountNumber;
      const activeIfsc = form.beneficiaryIFSC || selectedBeneficiary?.ifsc_code || selectedBeneficiary?.ifsc || selectedBeneficiary?.ifscCode;
      
      const response = await checkVimoBeneficiaryLimit({
        accountNumber: activeAccountNumber,
        bankIfsc: activeIfsc,
        provider: 'Vimo'
      });

      if (response && response.success) {
        const remainingLimit = Number(response.remainingLimit || 0);
        if (payoutAmount > remainingLimit) {
          toast.error(
            `You have only ₹${remainingLimit.toLocaleString('en-IN')} left as limit on this account. Please use this as the max amount.`
          );
          setIsCheckingLimit(false);
          return;
        }
      }
    } catch (err) {
      console.error('[vimo-payout] limit-check error:', err);
      toast.warn('Could not verify monthly limit online, proceeding with caution.');
    }

    setCheckingMessage('Checking Vimo balance...');
    try {
      const balanceResponse = await getVimoWalletBalance();
      if (balanceResponse && balanceResponse.success) {
        const availableBalance = Number(balanceResponse?.data?.availableBalance || 0);
        if (payoutAmount > availableBalance) {
          toast.error(
            'System is temporarily busy or undergoing maintenance. Please try again in 5-10 minutes. If this issue persists, you may contact the administrator.'
          );
          setIsCheckingLimit(false);
          return;
        }
      } else {
        toast.error(
          'System is temporarily busy or undergoing maintenance. Please try again in 5-10 minutes. If this issue persists, you may contact the administrator.'
        );
        setIsCheckingLimit(false);
        return;
      }
    } catch (err) {
      console.error('[vimo-payout] balance-check error:', err);
      toast.error(
        'System is temporarily busy or undergoing maintenance. Please try again in 5-10 minutes. If this issue persists, you may contact the administrator.'
      );
      setIsCheckingLimit(false);
      return;
    } finally {
      setIsCheckingLimit(false);
    }

    setVimoPhase('confirm');
  };

  const handleConfirmPayout = (e) => {
    e.preventDefault();
    if (!confirmChecked) {
      toast.error('Please check the confirmation checkbox.');
      return;
    }
    if (!form.tpin) {
      toast.error('TPIN is required.');
      return;
    }
    handleSubmit(e);
  };

  const goBackToList = () => {
    setVimoPhase('list');
    setSelectedBeneficiary(null);
    setConfirmChecked(false);
  };

  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationStatus('unsupported');
      return;
    }

    if (navigator.permissions && navigator.permissions.query) {
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

  const vimoTokenQuery = useQuery({
    queryKey: ['vimoAuthToken'],
    queryFn: () => getVimoAuthToken(),
    enabled: true,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  const banksQuery = useQuery({
    queryKey: ['vimoBanks'],
    queryFn: () => getVimoBanks(),
    enabled: vimoTokenQuery.isSuccess,
    retry: 1,
  });

  const purposesQuery = useQuery({
    queryKey: ['vimoPurposes'],
    queryFn: () => getVimoPurposes(),
    enabled: vimoTokenQuery.isSuccess,
    retry: 1,
  });

  const statesQuery = useQuery({
    queryKey: ['vimoStates'],
    queryFn: () => getVimoStates(),
    enabled: vimoTokenQuery.isSuccess,
    retry: 1,
  });

  const referenceQuery = useQuery({
    queryKey: ['vimoPayoutReference'],
    queryFn: () => getVimoPayoutReference(),
    enabled: Boolean(currentUser?.id),
    retry: 1,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (referenceQuery.isSuccess && referenceQuery.data?.merchantRefId) {
      setForm((prev) => ({
        ...prev,
        merchantRefId: prev.merchantRefId || referenceQuery.data.merchantRefId,
      }));
    }
  }, [referenceQuery.isSuccess, referenceQuery.data?.merchantRefId]);

  const payoutMutation = useMutation({
    mutationFn: createVimoPayout,
    onSuccess: async (data, variables) => {
      recordUserPayoutExecution(currentUser?.id, payoutAmount);
      toast.success(data?.message || 'Payout processed successfully');
      await queryClient.invalidateQueries(['totalPayouts']);
      await queryClient.invalidateQueries(['wallet']);
      await queryClient.invalidateQueries(['payoutReport']);
      await queryClient.invalidateQueries(['vimoPayoutReference']);

      const currentRole = String(currentUser?.role || 'merchant').trim().toLowerCase();
      const currentNormalizedRole =
        currentRole === 'franchaise' ? 'franchise' : currentRole;

      navigate(`/${currentNormalizedRole}/vimo-payout/success`, {
        replace: true,
        state: { payoutData: data, payoutPayload: variables, role: currentRole },
      });
    },
    onError: async (error) => {
      console.error('[vimo-payout] failed', error);
      const status = error?.status || error?.response?.status;
      const errorData = error?.response?.data;
      const msg = errorData?.message || error?.message || 'Failed to execute Vimo payout';
      const missing = Array.isArray(errorData?.missing) ? errorData.missing : null;

      if (isServiceDisabledError(error)) {
        toast.error(getServiceDisabledMessage(error));
        return;
      }

      if (status === 409) {
        toast.warn('Duplicate merchantRefId detected. Requesting new reference and please retry.');
        await queryClient.invalidateQueries(['vimoPayoutReference']);
        const newRefData = await queryClient.fetchQuery({
          queryKey: ['vimoPayoutReference'],
          queryFn: getVimoPayoutReference,
        });
        setForm((prev) => ({ ...prev, merchantRefId: newRefData?.merchantRefId || '' }));
        return;
      }

      if (missing && missing.length > 0) {
        const friendly = missing.map((key) => {
          if (key === 'beneficiaryBank') return 'bank';
          if (key === 'beneficiaryAccountNumber') return 'account number';
          if (key === 'beneficiaryIFSC') return 'IFSC';
          if (key === 'beneficiaryName') return 'name';
          if (key === 'beneficiaryMobileNumber') return 'mobile';
          return key;
        });
        toast.error(`Beneficiary information missing: ${friendly.join(', ')}`);
        return;
      }

      if (msg.toLowerCase().includes('insufficient')) {
        if (settlementHoldNum > 0) {
          toast.error(
            `Insufficient available balance. \u20B9${settlementHoldNum.toFixed(
              2
            )} is on hold and will be available tomorrow at 10:30 AM. Available now: \u20B9${availableBalanceNum.toFixed(
              2
            )}.`
          );
        } else {
          toast.error('Insufficient wallet balance. Please top up and try again.');
        }
      } else if (msg.toLowerCase().includes('disabled')) {
        toast.error('Vimo Payout is currently disabled.');
      } else {
        toast.error(msg);
      }

      if (status === 409) {
        return;
      }

      setFailedError({ message: msg, status });
      setVimoPhase('failed');
    },
  });

  const beneficiaryMutation = useMutation({
    mutationFn: ({ id, data }) => (id ? updateVimoBeneficiary(id, data) : createVimoBeneficiary(data)),
    onSuccess: async () => {
      toast.success('Beneficiary saved successfully.');
      await queryClient.invalidateQueries(['vimoBeneficiaries', currentUser?.id]);
      setShowBeneficiaryForm(false);
      setEditingBeneficiary(null);
    },
    onError: (error) => {
      toast.error(error?.message || 'Failed to save beneficiary.');
    },
  });

  const deleteBeneficiaryMutation = useMutation({
    mutationFn: (id) => deleteVimoBeneficiary(id),
    onSuccess: async () => {
      toast.success('Beneficiary deleted successfully.');
      await queryClient.invalidateQueries(['vimoBeneficiaries', currentUser?.id]);
    },
    onError: (error) => {
      toast.error(error?.message || 'Failed to delete beneficiary.');
    },
  });

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!isPayoutEnabled) {
      toast.error('Vimo Payout is currently disabled.');
      return;
    }

    const isGlobalLimitActive = getServiceFlagValue(currentUser?.service_flags, 'user_daily_limit', true);
    const limitCheck = checkUserDailyPayoutLimit({
      userId: currentUser?.id,
      requestedAmount: Number(form.amount) || 0,
      isGlobalLimitActive,
    });

    if (!limitCheck.allowed) {
      setLimitAlertModal(limitCheck.message);
      return;
    }

    const activeBeneficiaryId = form.beneficiary_id || selectedBeneficiary?.id;
    const activeBeneficiaryBank =
      form.beneficiaryBank ||
      selectedBeneficiary?.bank_name ||
      selectedBeneficiary?.bankName ||
      selectedBeneficiary?.bank ||
      '';
    const activeBeneficiaryAccountNumber =
      form.beneficiaryAccountNumber ||
      selectedBeneficiary?.account_number ||
      selectedBeneficiary?.accountNumber ||
      '';
    const activeBeneficiaryIFSC =
      form.beneficiaryIFSC ||
      selectedBeneficiary?.ifsc_code ||
      selectedBeneficiary?.ifsc ||
      selectedBeneficiary?.ifscCode ||
      '';
    const activeBeneficiaryName =
      form.beneficiaryName ||
      selectedBeneficiary?.beneficiary_name ||
      selectedBeneficiary?.name ||
      selectedBeneficiary?.accountName ||
      '';
    const activeBeneficiaryMobile =
      form.beneficiaryMobileNumber ||
      selectedBeneficiary?.mobile_number ||
      selectedBeneficiary?.mobile ||
      selectedBeneficiary?.mobileNumber ||
      '';

    if (!/^[6-9]\d{9}$/.test(activeBeneficiaryMobile)) {
      toast.error('Beneficiary mobile number is invalid. It must be 10 digits and start with 6, 7, 8, or 9.');
      return;
    }

    if (!['merchant', 'franchise'].includes(normalizedRole)) {
      toast.error('Only merchant or franchise users can perform payouts.');
      return;
    }

    const amountError = getAmountValidationError();
    if (amountError) {
      toast.error(amountError);
      return;
    }
    if (!form.merchantRefId) {
      toast.error('merchantRefId is required.');
      return;
    }

    if (!activeBeneficiaryId) {
      const missing = [];
      if (!activeBeneficiaryBank) missing.push('bank');
      if (!activeBeneficiaryAccountNumber) missing.push('account number');
      if (!activeBeneficiaryIFSC) missing.push('IFSC');
      if (!activeBeneficiaryName) missing.push('name');
      if (!activeBeneficiaryMobile) missing.push('mobile');
      if (missing.length > 0) {
        toast.error(`Beneficiary information missing: ${missing.join(', ')}`);
        return;
      }
    }

    let lat = form.lat;
    let long = form.long;
    const needsLocation = lat === '' || lat == null || long === '' || long == null;

    if (needsLocation) {
      if (!navigator.geolocation) {
        toast.error('Browser geolocation is not available. Payout cannot be done.');
        return;
      }

      const coords = await getGeolocation();
      if (coords == null || coords.latitude == null || coords.longitude == null) {
        toast.error('Could not determine location. Please enable location permission and retry.');
        return;
      }

      lat = String(coords.latitude);
      long = String(coords.longitude);
      setForm((prev) => ({ ...prev, lat, long }));
    }

    if (!form.tpin) {
      toast.error('TPIN is required.');
      return;
    }

    const payload = {
      user_id: Number(currentUser?.id),
      amount: Number(form.amount),
      merchantRefId: String(form.merchantRefId),
      paymentMode: String(form.paymentMode),
      paymentPurpose: String(form.paymentPurpose),
      beneficiary_id: activeBeneficiaryId ? Number(activeBeneficiaryId) : undefined,
      beneficiaryBank: String(activeBeneficiaryBank || ''),
      beneficiaryAccountNumber: String(activeBeneficiaryAccountNumber || ''),
      beneficiaryIFSC: String(activeBeneficiaryIFSC || '').toUpperCase(),
      beneficiaryMobileNumber: String(activeBeneficiaryMobile || ''),
      beneficiaryName: String(activeBeneficiaryName || ''),
      lat: String(lat || ''),
      long: String(long || ''),
      tpin: String(form.tpin),
      purpose: form.paymentPurpose ? String(form.paymentPurpose) : undefined,
      service_charge: form.service_charge ? Number(form.service_charge) : undefined,
    };

    const endpoint = `${BASE_URL.replace(/\/$/, '')}/vimo/payout`;
    console.info('[vimo-payout] submit endpoint:', endpoint);
    console.info('[vimo-payout] selected paymentPurpose:', form.paymentPurpose);
    console.info('[vimo-payout] submit payload:', payload);
    payoutMutation.mutate(payload);
  };

  const rawBanks = Array.isArray(banksQuery.data?.data) ? banksQuery.data.data : [];
  const banks = rawBanks.map((bank) => ({
    code: bank.code || bank.ifsc_code || bank.id || '',
    description: bank.description || bank.bank_name || bank.name || '',
  }));

  const getBankDescriptionFromValue = (value) => {
    if (!value) return '';
    const normalized = value.toString().trim().toLowerCase();
    const match = banks.find(
      (bank) => bank.description.toString().trim().toLowerCase() === normalized
    );
    return match ? match.description : value;
  };

  const rawPurposes = Array.isArray(purposesQuery.data?.data)
    ? purposesQuery.data.data
    : [{ value: '004', label: 'Payout' }];
  const purposes = rawPurposes
    .map((purpose) => {
      if (typeof purpose === 'string') return { value: purpose, label: purpose };
      return {
        value: String(purpose.value || purpose.code || purpose.id || ''),
        label: String(
          purpose.label ||
          purpose.description ||
          purpose.name ||
          purpose.value ||
          purpose.code ||
          ''
        ),
      };
    })
    .filter((item) => item.value);

  useEffect(() => {
    if (!form.paymentPurpose && purposes.length > 0) {
      setForm((prev) => ({ ...prev, paymentPurpose: purposes[0].value }));
    }
  }, [form.paymentPurpose, purposes]);

  const rawStates = Array.isArray(statesQuery.data?.data) ? statesQuery.data.data : [];
  const states = rawStates
    .map((state) => ({
      code: String(state.code || state.state_code || state.id || ''),
      description: String(state.description || state.name || state.state || ''),
    }))
    .filter((item) => item.code);

  const beneficiariesQuery = useQuery({
    queryKey: ['vimoBeneficiaries', currentUser?.id],
    queryFn: () => getVimoBeneficiaries(currentUser?.id),
    enabled: Boolean(currentUser?.id),
    retry: 1,
  });

  const beneficiaries = Array.isArray(beneficiariesQuery.data?.data)
    ? beneficiariesQuery.data.data
    : [];

  const searchLower = searchTerm.trim().toLowerCase();
  const filteredBeneficiaries = searchLower
    ? beneficiaries.filter((beneficiary) => {
      const name = (beneficiary.beneficiary_name || beneficiary.name || beneficiary.accountName || '').toString().toLowerCase();
      const account = (beneficiary.account_number || beneficiary.accountNumber || '').toString().toLowerCase();
      const ifsc = (beneficiary.ifsc_code || beneficiary.ifsc || beneficiary.ifscCode || '').toString().toLowerCase();
      const bank = (beneficiary.bank_name || beneficiary.bankName || beneficiary.bank || '').toString().toLowerCase();
      const mobile = (beneficiary.mobile_number || beneficiary.mobile || beneficiary.mobileNumber || '').toString().toLowerCase();
      const state = (beneficiary.state || beneficiary.state_code || beneficiary.stateCode || '').toString().toLowerCase();
      return (
        name.includes(searchLower) ||
        account.includes(searchLower) ||
        ifsc.includes(searchLower) ||
        bank.includes(searchLower) ||
        mobile.includes(searchLower) ||
        state.includes(searchLower)
      );
    })
    : beneficiaries;

  const isLoading =
    vimoTokenQuery.isLoading ||
    banksQuery.isLoading ||
    purposesQuery.isLoading ||
    statesQuery.isLoading ||
    payoutMutation.isPending ||
    beneficiariesQuery.isLoading;

  const locationAlertConfig = {
    denied: {
      className: 'border border-red-200 bg-red-50 text-red-700',
      icon: <AlertCircle className="h-4 w-4 shrink-0" />,
      message:
        'Location permission denied. Please enable location in browser settings and refresh or continue to trigger the permission prompt again.',
    },
    prompt: {
      className: 'border border-amber-200 bg-amber-50 text-amber-700',
      icon: <MapPin className="h-4 w-4 shrink-0" />,
      message:
        'Location permission is required. You will be prompted when you continue to confirm the payout.',
    },
    granted: {
      className: 'border border-green-200 bg-green-50 text-green-700',
      icon: <CheckCircle2 className="h-4 w-4 shrink-0" />,
      message: 'Location permission granted. Geolocation is available.',
    },
  }[locationStatus];

  const renderListPhase = (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:mb-5">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Beneficiary List</h2>
          <p className="text-sm text-gray-500">
            Manage saved payout accounts and start a transfer from here.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <input
            type="search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search beneficiary, account, IFSC, bank, mobile or state"
            className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 shadow-sm outline-none transition focus:border-[#00D3CD] focus:ring-2 focus:ring-[#00D3CD]/20 sm:max-w-md"
          />
          <button
            type="button"
            onClick={openAddBeneficiaryModal}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#00D3CD] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#00b8b3] sm:w-auto"
          >
            <UserPlus className="h-4 w-4" />
            Add Beneficiary
          </button>
        </div>
      </div>

      {beneficiariesQuery.isLoading ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-slate-50 px-4 py-6 text-sm text-gray-500">
          Loading beneficiaries...
        </div>
      ) : beneficiaries.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-slate-50 px-4 py-6 text-sm text-gray-500">
          No beneficiaries found. Use Add Beneficiary to register one.
        </div>
      ) : filteredBeneficiaries.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-slate-50 px-4 py-6 text-sm text-gray-500">
          No beneficiaries match your search.
        </div>
      ) : (
        <div className="space-y-3">
          {filteredBeneficiaries.map((beneficiary) => {
            const isSelected = selectedBeneficiary?.id === beneficiary.id;
            const account = beneficiary.account_number || beneficiary.accountNumber || 'N/A';
            const ifsc =
              beneficiary.ifsc_code || beneficiary.ifsc || beneficiary.ifscCode || 'N/A';
            const bank = beneficiary.bank_name || beneficiary.bankName || beneficiary.bank || 'N/A';
            const mobile =
              beneficiary.mobile_number || beneficiary.mobile || beneficiary.mobileNumber || 'N/A';
            const stateValue = beneficiary.state || beneficiary.state_code || beneficiary.stateCode || '';
            const state = stateValue || 'N/A';
            const canPayout = Boolean(stateValue);

            return (
              <div
                key={beneficiary.id}
                className={`rounded-2xl border p-4 shadow-sm transition ${isSelected
                  ? 'border-[#00D3CD] bg-white'
                  : 'border-gray-200 bg-white'
                  }`}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <button
                    type="button"
                    onClick={() => handleSelectBeneficiary(beneficiary)}
                    className="text-left flex-1"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-base font-semibold text-gray-900">
                        {beneficiary.beneficiary_name || beneficiary.name || beneficiary.accountName || 'Beneficiary'}
                      </p>
                      {isSelected && (
                        <span className="rounded-full bg-[#00D3CD]/10 px-2 py-0.5 text-[11px] font-semibold text-[#009d98]">
                          Selected
                        </span>
                      )}
                    </div>
                    <p className="mt-2 text-sm text-gray-500">
                      {account} • {ifsc}
                    </p>
                    <div className="mt-3 grid gap-2 text-sm text-gray-600 sm:grid-cols-3">
                      <p>
                        <span className="font-medium text-gray-700">Bank:</span>{' '}
                        {bank}
                      </p>
                      <p>
                        <span className="font-medium text-gray-700">Mobile:</span>{' '}
                        {mobile}
                      </p>
                      <p>
                        <span className="font-medium text-gray-700">State:</span>{' '}
                        {state}
                      </p>
                    </div>
                  </button>

                  <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingBeneficiary(beneficiary);
                        setForm((prev) => ({
                          ...prev,
                          beneficiary_id: beneficiary.id,
                          beneficiaryBank: getBankDescriptionFromValue(
                            beneficiary.bank_name || beneficiary.bankName || beneficiary.bank || ''
                          ),
                          beneficiaryAccountNumber:
                            beneficiary.account_number || beneficiary.accountNumber || '',
                          beneficiaryIFSC:
                            beneficiary.ifsc_code || beneficiary.ifsc || beneficiary.ifscCode || '',
                          beneficiaryName:
                            beneficiary.beneficiary_name || beneficiary.name || beneficiary.accountName || beneficiary.account_name || '',
                          beneficiaryStateCode:
                            beneficiary.state || beneficiary.state_code || beneficiary.stateCode || '',
                          beneficiaryMobileNumber:
                            beneficiary.mobile_number || beneficiary.mobile || beneficiary.mobileNumber || '',
                          beneficiaryEmail: beneficiary.email || '',
                          beneficiaryLocation: beneficiary.location || '',
                        }));
                        setShowBeneficiaryForm(true);
                      }}
                      className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-blue-200 px-3 py-2 text-xs font-semibold text-blue-600 transition-colors hover:bg-blue-50"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteBeneficiaryMutation.mutate(beneficiary.id)}
                      className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 transition-colors hover:bg-red-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSelectBeneficiary(beneficiary)}
                      disabled={!canPayout}
                      className={`inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold text-white transition-colors ${canPayout
                        ? 'bg-[#00D3CD] hover:bg-[#00b8b3]'
                        : 'bg-gray-300 text-gray-600 cursor-not-allowed'
                        }`}
                    >
                      <Send className="h-3.5 w-3.5" />
                      Pay
                    </button>
                  </div>
                  {!canPayout && (
                    <p className="mt-2 text-xs text-amber-600">
                      State required for payout.
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  const renderAmountPhase = (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        goToConfirmPhase();
      }}
      className="space-y-4"
    >
      <div className="rounded-2xl border border-[#00D3CD]/20 bg-[#00D3CD]/5 p-4">
        <p className="text-sm font-semibold text-gray-900">Selected Beneficiary</p>
        <p className="mt-2 text-base font-semibold text-gray-900">
          {selectedBeneficiary?.beneficiary_name || selectedBeneficiary?.name || selectedBeneficiary?.accountName}
        </p>
        <p className="mt-1 text-sm text-gray-600">
          {selectedBeneficiary?.account_number || selectedBeneficiary?.accountNumber} |{' '}
          {selectedBeneficiary?.ifsc_code || selectedBeneficiary?.ifsc || selectedBeneficiary?.ifscCode}
        </p>
      </div>

      <div>
        <label className="mb-1 block text-sm font-semibold text-gray-800">
          Amount <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-bold text-gray-500">
            {'\u20B9'}
          </span>
          <input
            value={form.amount}
            onChange={(e) => handleAmountChange(e.target.value)}
            type="text"
            inputMode="numeric"
            pattern="\d*"
            maxLength={String(Math.floor(payoutMaxAmount)).length}
            placeholder="0"
            className="w-full rounded-2xl border border-[#00D3CD]/25 bg-slate-50 py-3 pl-10 pr-4 text-2xl font-bold text-gray-900 shadow-sm outline-none transition focus:border-[#00D3CD] focus:bg-white focus:ring-2 focus:ring-[#00D3CD]/20"
            required
            autoFocus
          />
        </div>
        {amountValidationMessage && (
          <p className="mt-1 text-xs font-medium text-rose-600">{amountValidationMessage}</p>
        )}
        <p className="mt-1 text-xs text-gray-500">
          Maximum payout amount: ₹{payoutMaxAmount.toFixed(2)}. The cap is based on available wallet balance, limited to ₹{MAX_PAYOUT_AMOUNT.toFixed(2)}.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-gray-700">Merchant Ref ID</label>
          <input
            value={form.merchantRefId}
            onChange={(e) => setForm((prev) => ({ ...prev, merchantRefId: e.target.value }))}
            className={fieldClassName}
            readOnly={!referenceQuery.isError}
            required
          />
          {referenceQuery.isLoading && (
            <div className="mt-1 text-xs text-blue-500">Getting new reference...</div>
          )}
          {referenceQuery.isError && (
            <div className="mt-1 text-xs text-red-500">
              Failed to fetch reference, enter manually or retry.
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Payment Mode</label>
          <select
            value={form.paymentMode}
            onChange={(e) => setForm((prev) => ({ ...prev, paymentMode: e.target.value }))}
            className={fieldClassName}
          >
            <option>IMPS</option>
            <option>NEFT</option>
            <option>RTGS</option>
          </select>
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700">Payment Purpose</label>
          <select
            value={form.paymentPurpose}
            onChange={(e) => setForm((prev) => ({ ...prev, paymentPurpose: e.target.value }))}
            className={fieldClassName}
          >
            {purposes.map((purpose) => (
              <option key={purpose.value} value={purpose.value}>
                {purpose.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
        <button
          type="button"
          onClick={goBackToList}
          className="inline-flex items-center justify-center rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50"
        >
          Back
        </button>
        <button
          type="submit"
          disabled={!isAmountWithinRange}
          className={`inline-flex items-center justify-center rounded-xl px-4 py-3 text-sm font-semibold text-white transition-colors ${isAmountWithinRange ? 'bg-[#00D3CD] hover:bg-[#00b8b3]' : 'cursor-not-allowed bg-gray-400'
            }`}
        >
          Continue to Confirm
        </button>
      </div>
    </form>
  );

  const renderConfirmPhase = (
    <form onSubmit={handleConfirmPayout} className="space-y-4">
      <div className="rounded-2xl border border-green-200 bg-green-50 p-4">
        <p className="text-sm font-semibold text-gray-900">Confirm Payout</p>
        <ul className="mt-3 space-y-2 text-sm text-gray-700">
          <li>
            <strong>Beneficiary:</strong>{' '}
            {selectedBeneficiary?.beneficiary_name || selectedBeneficiary?.name}
          </li>
          <li>
            <strong>Account:</strong>{' '}
            {selectedBeneficiary?.account_number || selectedBeneficiary?.accountNumber}
          </li>
          <li>
            <strong>IFSC:</strong>{' '}
            {selectedBeneficiary?.ifsc_code ||
              selectedBeneficiary?.ifsc ||
              selectedBeneficiary?.ifscCode}
          </li>
          <li>
            <strong>Amount:</strong> {'\u20B9'}
            {form.amount ? Number(form.amount).toLocaleString('en-IN') : form.amount}
          </li>
          <li>
            <strong>Reference:</strong> {form.merchantRefId}
          </li>
          <li>
            <strong>Lat/Long:</strong> {form.lat || 'N/A'} / {form.long || 'N/A'}
          </li>
        </ul>
      </div>

      <label className="flex items-start gap-3 rounded-2xl border border-gray-200 bg-slate-50 px-4 py-3">
        <input
          id="confirmCheck"
          type="checkbox"
          checked={confirmChecked}
          onChange={(e) => setConfirmChecked(e.target.checked)}
          className="mt-0.5 h-4 w-4"
        />
        <span className="text-sm text-gray-700">
          I confirm that the payout details are correct and I want to proceed.
        </span>
      </label>

      <div>
        <label className="block text-sm font-medium text-gray-700">TPIN</label>
        <input
          value={form.tpin}
          onChange={(e) => setForm((prev) => ({ ...prev, tpin: e.target.value }))}
          type="password"
          className={fieldClassName}
          required
        />
      </div>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
        <button
          type="button"
          onClick={() => setVimoPhase('amount')}
          className="inline-flex items-center justify-center rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50"
        >
          Back
        </button>
        <button
          type="submit"
          disabled={isLoading || !isPayoutEnabled}
          className={`inline-flex items-center justify-center rounded-xl px-4 py-3 text-sm font-semibold text-white transition-colors ${isPayoutEnabled ? 'bg-[#00D3CD] hover:bg-[#00b8b3]' : 'cursor-not-allowed bg-gray-400'
            }`}
        >
          {isLoading ? 'Processing...' : 'Submit Payout'}
        </button>
      </div>
    </form>
  );

  const renderLimitCheckModal = isCheckingLimit ? (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-3 backdrop-blur-[2px]">
      <div className="w-full max-w-sm rounded-[28px] border border-white/70 bg-white p-6 shadow-2xl text-center animate-in fade-in zoom-in duration-200">
        <div className="flex justify-center mb-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-[#00D3CD] border-t-transparent"></div>
        </div>
        <h3 className="text-lg font-semibold text-gray-900">Please Wait</h3>
        <p className="mt-2 text-sm text-gray-600 font-medium">{checkingMessage || 'Verifying transaction...'}</p>
        <p className="mt-1 text-xs text-gray-400">Do not refresh or go back.</p>
      </div>
    </div>
  ) : null;

  const renderBeneficiaryModal = showBeneficiaryForm ? (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 p-3 backdrop-blur-[2px] sm:items-center sm:p-4">
      <div className="w-full max-w-xl overflow-hidden rounded-[28px] border border-white/70 bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-gray-100 bg-gradient-to-r from-[#00D3CD]/10 via-white to-white px-4 py-3 sm:px-5 sm:py-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#00D3CD]/10 text-[#00B8B3]">
              <UserPlus className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                {editingBeneficiary ? 'Edit Beneficiary' : 'Add Beneficiary'}
              </h3>
              <p className="text-sm text-gray-500">
                Save beneficiary details with the same clean merchant theme.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setShowBeneficiaryForm(false);
              setEditingBeneficiary(null);
            }}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white text-gray-500 transition-colors hover:bg-slate-100 hover:text-gray-700"
            aria-label="Close beneficiary form"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form
          onSubmit={handleBeneficiaryFormSubmit}
          className="max-h-[58vh] overflow-y-auto px-4 py-3 sm:max-h-[78vh] sm:px-5 sm:py-5"
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700">Bank</label>
              {banks.length > 0 ? (
                <select
                  value={form.beneficiaryBank}
                  onChange={(e) => setForm((prev) => ({ ...prev, beneficiaryBank: e.target.value }))}
                  className={fieldClassName}
                  required
                >
                  <option value="">Select Bank</option>
                  {form.beneficiaryBank &&
                    !banks.some(
                      (bank) =>
                        (bank.description || '').toString().toLowerCase() ===
                        form.beneficiaryBank.toString().toLowerCase()
                    ) && (
                      <option value={form.beneficiaryBank}>{form.beneficiaryBank}</option>
                    )}
                  {banks.map((bank) => (
                    <option key={bank.code || bank.description} value={bank.description}>
                      {bank.description} {bank.code ? `(${bank.code})` : ''}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  value={form.beneficiaryBank}
                  onChange={(e) => setForm((prev) => ({ ...prev, beneficiaryBank: e.target.value }))}
                  className={fieldClassName}
                  placeholder="Enter Bank Name"
                  required
                />
              )}
            </div>

            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700">Account Holder Name</label>
              <input
                value={form.beneficiaryName}
                placeholder="Enter Account Holder Name"
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    beneficiaryName: sanitizeBeneficiaryName(e.target.value),
                  }))
                }
                className={fieldClassName}
                maxLength={100}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Account Number</label>
              <input
                value={form.beneficiaryAccountNumber}
                placeholder="Enter Account Number"
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    beneficiaryAccountNumber: sanitizeAccountNumber(e.target.value),
                  }))
                }
                className={fieldClassName}
                inputMode="numeric"
                maxLength={18}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">IFSC</label>
              <input
                value={form.beneficiaryIFSC}
                placeholder="Enter IFSC Code"
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, beneficiaryIFSC: sanitizeIfsc(e.target.value) }))
                }
                className={`${fieldClassName} uppercase`}
                maxLength={11}
                required
              />
            </div>


            <div>
              <label className="block text-sm font-medium text-gray-700">
                Mobile
              </label>

              <input
                type="tel"
                placeholder="Enter Mobile Number"
                value={form.beneficiaryMobileNumber}
                onChange={(e) => setForm((prev) => ({ ...prev, beneficiaryMobileNumber: e.target.value.replace(/\D/g, '').slice(0, 10) }))}
                inputMode="numeric"
                maxLength={10}
                className={fieldClassName}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Email</label>
              <input
                value={form.beneficiaryEmail}
                placeholder="Enter Your Email"
                onChange={(e) => setForm((prev) => ({ ...prev, beneficiaryEmail: e.target.value }))}
                type="email"
                className={fieldClassName}
                required
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700">State</label>
              <select
                value={form.beneficiaryStateCode}
                onChange={(e) => setForm((prev) => ({ ...prev, beneficiaryStateCode: e.target.value }))}
                className={fieldClassName}
              >
                <option value="">Select State</option>
                {states.map((state) => (
                  <option key={state.code} value={state.code}>
                    {state.description} ({state.code})
                  </option>
                ))}
              </select>
              {statesQuery.isLoading && <p className="mt-1 text-xs text-gray-500">Loading states...</p>}
              {statesQuery.isError && <p className="mt-1 text-xs text-red-500">Failed to load states</p>}
            </div>
          </div>

          <div className="mt-4 flex flex-col-reverse gap-3 sm:mt-5 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => {
                setShowBeneficiaryForm(false);
                setEditingBeneficiary(null);
              }}
              className="inline-flex items-center justify-center rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-xl bg-[#00D3CD] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#00b8b3]"
            >
              Save Beneficiary
            </button>
          </div>
        </form>
      </div>
    </div>
  ) : null;

  return (
    <div className="pb-1">
      <div className="mx-auto max-w-4xl rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:p-5 md:p-6">
        <div className="mb-5 border-b border-gray-100 pb-4 sm:mb-6 sm:pb-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Payout</h1>
              <p className="mt-1 text-sm text-gray-600">
                Role: {role}. Payout status:{' '}
                <span
                  className={
                    isPayoutEnabled ? 'font-semibold text-green-600' : 'font-semibold text-red-600'
                  }
                >
                  {isPayoutEnabled ? 'Enabled' : 'Disabled'}
                </span>
              </p>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-slate-50 px-4 py-3">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">
                <Landmark className="h-4 w-4 text-[#00D3CD]" />
                Available Balance
              </div>
              <p className="mt-2 text-xl font-semibold text-gray-900">
                {'\u20B9'}
                {availableBalanceNum.toFixed(2)}
              </p>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {locationAlertConfig && (
              <div className={`flex items-start gap-3 rounded-2xl px-4 py-3 text-sm ${locationAlertConfig.className}`}>
                {locationAlertConfig.icon}
                <p>{locationAlertConfig.message}</p>
              </div>
            )}

            {!isPayoutEnabled && (
              <div className="rounded-2xl border border-gray-200 bg-slate-100 px-4 py-3 text-sm text-gray-700">
                Vimo Payout is currently disabled right now.
              </div>
            )}

            {settlementHoldNum > 0 && (
              <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <p>
                  <strong>{'\u20B9'}{settlementHoldNum.toFixed(2)}</strong> is on settlement hold
                  and will be available tomorrow at 10:30 AM. Available for payout now:{' '}
                  <strong>{'\u20B9'}{availableBalanceNum.toFixed(2)}</strong>
                </p>
              </div>
            )}

            {settlementType === 'next_day_settlement' && availableBalanceNum <= 0 && (
              <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <p>
                  No funds are available for payout right now. Your POS earnings are on hold until
                  tomorrow at 10:30 AM.
                </p>
              </div>
            )}
          </div>
        </div>

        {vimoPhase === 'list' && renderListPhase}
        {vimoPhase === 'amount' && renderAmountPhase}
        {vimoPhase === 'confirm' && renderConfirmPhase}
        {vimoPhase === 'failed' && (
          <div className="flex flex-col items-center py-8 gap-5">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
              <AlertCircle className="h-8 w-8 text-red-600" />
            </div>
            <div className="text-center">
              <h2 className="text-xl font-bold text-gray-900">Payout Failed</h2>
              <p className="mt-2 text-sm text-gray-500 max-w-sm">{failedError?.message || 'An error occurred while processing the payout.'}</p>
              {failedError?.status && (
                <p className="mt-1 text-xs text-red-500">Error code: {failedError.status}</p>
              )}
            </div>
            <div className="flex flex-col w-full gap-3 max-w-xs">
              <button
                type="button"
                onClick={() => {
                  setVimoPhase('list');
                  setSelectedBeneficiary(null);
                  setConfirmChecked(false);
                  setFailedError(null);
                  setForm((prev) => ({ ...prev, amount: '', tpin: '' }));
                }}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#00D3CD] px-4 py-3 text-sm font-semibold text-white hover:bg-[#00b8b3]"
              >
                Try Again
              </button>
              <button
                type="button"
                onClick={() => navigate(`/${normalizedRole}/reports/payout`)}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                Payout Report
              </button>
              <button
                type="button"
                onClick={() => navigate(`/${normalizedRole}/dashboard`)}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                Dashboard
              </button>
            </div>
          </div>
        )}

        {(vimoTokenQuery.isError || banksQuery.isError || purposesQuery.isError) && (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            Unable to load Vimo service data. Please refresh and try again.
          </div>
        )}
      </div>

      {renderBeneficiaryModal}
      {renderLimitCheckModal}

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
  );
};

export default VimoPayout;
