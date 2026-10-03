import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  addBeneficiary,
  transferImps,
  getBeneficiaryList,
  getCommissionDetails,
  deleteBeneficiary,
  remitterList,
  impsTransactionList,
  getRemitterDetails,
} from '../../api/financialApi';
import TransactionCard from '../../components/TransactionCard';
import Modal from '../../components/Modal';
import FormInput from '../../components/FormInput';
import { Send, Trash2, Eye } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import Loader from '../../components/Loader';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { getSddsToken } from '../../utils/auth';

const RemitterDetails = ({ currentUser }) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { state } = useLocation();
  const user = state;

  const role = currentUser.role;

  // State hooks
  const [modals, setModals] = useState({
    addBeneficiary: false,
    transfer: false,
    viewBeneficiary: false,
  });
  const [selectedBeneficiary, setSelectedBeneficiary] = useState(null);
  const [beneficiaryData, setBeneficiaryData] = useState({
    bank_name: '',
    account_number: '',
    confirm_account_number: '',
    bank_account_holder_name: '',
    ifsc_code: '',
    beneficiary_mobile: '',
    branch_name: '',
  });
  const [transferData, setTransferData] = useState({
    amount: '',
    transferType: 'IMPS',
    tpin: '',
  });
  const [tableAmounts, setTableAmounts] = useState({});

  // Geolocation utility
  const getGeolocation = () => {
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          resolve({
            lat: pos.coords.latitude.toString(),
            long: pos.coords.longitude.toString(),
          });
        },
        () => {
          resolve({
            lat: '26.9194401',
            long: '75.7531271',
          });
        },
        { timeout: 10000 }
      );
    });
  };

  // Queries
  const { data: remitterDetails, isLoading: remitterLoading, error: remitterError } = useQuery({
    queryKey: ['remitterDetails', user?.remitter_id],
    queryFn: () => getRemitterDetails(user.remitter_id),
    enabled: !!user?.remitter_id,
  });

  const { data: beneficiariesData, isLoading: beneficiariesLoading } = useQuery({
    queryKey: ['beneficiaries', user?.mobile],
    queryFn: async () => {
      const { lat, long } = await getGeolocation();
      const browserId = localStorage.getItem('browserId') || '52e49c456f92b900cf0ed2e20172a7c2';
      const sddsToken = getSddsToken() || '';
      return getBeneficiaryList({
        mobile_number: user.mobile,
        browser_id: browserId,
        lat,
        long,
        sddsToken,
        is_third_party_data_required: false,
      });
    },
    enabled: !!user?.mobile,
  });

  const { data: commission, isLoading: commissionLoading } = useQuery({
    queryKey: ['commissionDetails', user?.mobile],
    queryFn: () => getCommissionDetails(user.mobile),
    enabled: !!user?.mobile,
  });

  // const { data: transactionsData, isLoading: transactionsLoading, error: transactionsError } = useQuery({
  //   queryKey: ['impsTransactionList'],
  //   queryFn: impsTransactionList,
  //   enabled: !!user,
  // });

  // Mutations
  const addBeneficiaryMutation = useMutation({
    mutationFn: addBeneficiary,
    onSuccess: () => {
      toast.success('Beneficiary added successfully');
      setModals({ ...modals, addBeneficiary: false });
      setBeneficiaryData({
        bank_name: '',
        account_number: '',
        confirm_account_number: '',
        bank_account_holder_name: '',
        ifsc_code: '',
        beneficiary_mobile: '',
        branch_name: '',
      });
      queryClient.invalidateQueries(['beneficiaries', user.mobile]);
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to add beneficiary');
    },
  });

  const deleteBeneficiaryMutation = useMutation({
    mutationFn: deleteBeneficiary,
    onSuccess: () => {
      toast.success('Beneficiary deleted successfully');
      queryClient.invalidateQueries(['beneficiaries', user.mobile]);
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to delete beneficiary');
    },
  });

  const transferMutation = useMutation({
    mutationFn: transferImps,
    onSuccess: () => {
      toast.success('Transfer successful');
      setModals({ ...modals, transfer: false });
      setTransferData({ amount: '', transferType: 'IMPS', tpin: '' });
      setSelectedBeneficiary(null);
      setTableAmounts({});
      queryClient.invalidateQueries(['impsTransactionList', user.mobile]);
    },
    onError: (error) => {
      toast.error(error.message || 'Transfer failed');
    },
  });

  // Handlers
  const handleAddBeneficiary = async () => {
    const mobile = beneficiaryData.beneficiary_mobile || '';
    if (!/^[6-9]\d{9}$/.test(mobile)) {
      toast.error('Mobile number must be exactly 10 digits and start with 6, 7, 8, or 9.');
      return;
    }
    if (beneficiaryData.account_number !== beneficiaryData.confirm_account_number) {
      toast.error('Account number and confirm account number do not match');
      return;
    }

    const { lat, long } = await getGeolocation();
    const browserId = localStorage.getItem('browserId') || '52e49c456f92b900cf0ed2e20172a7c2';
    const sddsToken = getSddsToken() || '';

    addBeneficiaryMutation.mutate({
      remitter_id: user.remitter_id.toString(),
      mobile_number: user.mobile,
      browser_id: browserId,
      lat,
      long,
      sddsToken,
      bank_name: beneficiaryData.bank_name,
      account_number: beneficiaryData.account_number,
      ifsc_code: beneficiaryData.ifsc_code,
      bank_account_holder_name: beneficiaryData.bank_account_holder_name,
      beneficiary_mobile: beneficiaryData.beneficiary_mobile,
      branch_name: beneficiaryData.branch_name,
    });
  };

  const handleDeleteBeneficiary = async (beneficiary) => {
    const { lat, long } = await getGeolocation();
    const browserId = localStorage.getItem('browserId') || '52e49c456f92b900cf0ed2e20172a7c2';
    const sddsToken = getSddsToken() || '';

    deleteBeneficiaryMutation.mutate({
      mobile_number: user.mobile,
      browser_id: browserId,
      lat,
      long,
      sddsToken,
      reference_id: beneficiary.external_reference_id,
      id: beneficiary.id,
    });
  };

  const handleTransfer = async () => {
    const mobile = selectedBeneficiary?.mobile || '';
    if (!/^[6-9]\d{9}$/.test(mobile)) {
      toast.error('Beneficiary mobile number is invalid. It must be 10 digits and start with 6, 7, 8, or 9.');
      return;
    }
    if (!selectedBeneficiary) return;
    if (!transferData.tpin) {
      toast.error('Please enter a TPIN');
      return;
    }
    if (parseFloat(transferData.amount) <= 0) {
      toast.error('Amount must be greater than 0');
      return;
    }

    const { lat, long } = await getGeolocation();
    const browserId = localStorage.getItem('browserId') || '52e49c456f92b900cf0ed2e20172a7c2';
    const sddsToken = getSddsToken() || '';

    transferMutation.mutate({
      remitter_number: user.mobile,
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
      beneficiary_mobile: selectedBeneficiary.mobile || '', // Ensure beneficiary_mobile is included
      branch_name: selectedBeneficiary.branch_name || 'NA',
      transfer_type: transferData.transferType,
      external_reference_id: selectedBeneficiary.external_reference_id,
      tpin: transferData.tpin,
    });
  };

  const handleTableAmountChange = (beneficiaryId, value) => {
    // Input Validation: Block negative values
    if (parseFloat(value) < 0) return;

    setTableAmounts((prev) => ({
      ...prev,
      [beneficiaryId]: value,
    }));
  };

  // Early returns after all hooks
  if (!user) {
    navigate(role === 'merchant' ? '/merchant/payout' : '/franchise/payout');
    return null;
  }

  if (remitterLoading) {
    return <Loader />;
  }

  if (remitterError) {
    navigate(role === 'merchant' ? '/merchant/payout' : '/franchise/payout');
    toast.error('No RemitterId found');
    return null;
  }

  if (commissionLoading || beneficiariesLoading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  // Data mapping
  const beneficiaries = beneficiariesData?.data?.map((b, index) => ({
    id: b.id || index + 1,
    name: b.bank_account_holder_name || 'Unknown',
    account: b.bank_account_number || 'N/A',
    bank: b.bank_name || 'N/A',
    ifsc: b.bank_ifsc || 'N/A',
    mobile: b.beneficiary_mobile || 'N/A', // Ensure mobile is mapped
    status: b.status === 1 ? 'Verified' : 'Unverified',
    remitter_id: b.remitter_id || '',
    branch_name: b.bank_branch_name || 'N/A',
    external_reference_id: b.external_reference_id || '',
    createdAt: b.createdAt || 'N/A',
    updatedAt: b.updatedAt || 'N/A',
    user_id: b.user_id || '',
  })) || [];

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
    <div className=" w-[87vw] md:w-full">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Remitter Details</h1>
        <div className=' flex gap-4 flex-col lg:flex-row'>
          <button
            onClick={() => setModals({ ...modals, addBeneficiary: true })}
            className="bg-[#00D3CD] text-white px-4 py-2 rounded-lg hover:bg-[#00bdb7] transition-colors"
          >
            Add New Account
          </button>
          <button
            onClick={() => navigate(role === 'merchant' ? "/merchant/payout/transaction-history" : "/franchise/payout/transaction-history", { state: user })}
            className="bg-[#00D3CD] text-white px-4 py-2 rounded-lg hover:bg-[#00bdb7] transition-colors"
          >
            Transaction History
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-xl font-semibold mb-4">Remitter Information</h2>
          <div className="space-y-3">
            <div>
              <p className="text-sm text-gray-500">Mobile Number</p>
              <p className="text-lg font-medium">{user.mobile}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Name</p>
              <p className="text-lg font-medium">{user.name || 'Not Provided'}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-xl font-semibold mb-4">Commission Details</h2>
          <div className="space-y-3">
            <div>
              <p className="text-sm text-gray-500">Per Transaction</p>
              <p className="text-lg font-medium">₹{commission?.data.perTransaction || '5000.00'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Limit Consumed</p>
              <p className="text-lg font-medium">₹{commission?.data.limitConsumed || '0.00'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Limit Available</p>
              <p className="text-lg font-medium text-green-600">
                ₹{commission?.data.limitAvailable || '25000.00'}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6">
        <h2 className="text-xl font-semibold mb-4">Beneficiaries</h2>
        <div className="bg-white rounded-xl shadow-sm p-6 overflow-x-auto">
          {beneficiaries.length === 0 ? (
            <p className="text-gray-500 text-center py-4">No beneficiaries found.</p>
          ) : (
            <table className="w-full text-left">
              <thead>
                <tr className="border-b">
                  <th className='p-3'>Id</th>
                  <th className="p-3">Name</th>
                  <th className="p-3">Account</th>
                  <th className="p-3">Bank</th>
                  <th className="p-3">IFSC</th>
                  <th className="p-3">Mobile</th>
                  <th className="p-3">Send Amount</th>
                  <th className="p-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {beneficiaries.map((beneficiary) => (
                  <tr key={beneficiary.id} className="border-b hover:bg-gray-50">
                    <td className='p-3'>{beneficiary.id}</td>
                    <td className="p-3">{beneficiary.name}</td>
                    <td className="p-3">{beneficiary.account}</td>
                    <td className="p-3">{beneficiary.bank}</td>
                    <td className="p-3">{beneficiary.ifsc}</td>
                    <td className="p-3">{beneficiary.mobile}</td>
                    <td className="p-3">
                      <input
                        type="number"
                        placeholder="Amount"
                        min="1"
                        onKeyDown={(e) => ["-", "e", "+"].includes(e.key) && e.preventDefault()}
                        value={tableAmounts[beneficiary.id] || ''}
                        onChange={(e) => handleTableAmountChange(beneficiary.id, e.target.value)}
                        className="w-24 p-1 border rounded-lg focus:ring-2 focus:ring-[#00D3CD]"
                      />
                    </td>
                    <td className="p-3">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => {
                            setSelectedBeneficiary(beneficiary);
                            setModals({ ...modals, viewBeneficiary: true });
                          }}
                          className="p-2 text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            setSelectedBeneficiary(beneficiary);
                            setTransferData({
                              ...transferData,
                              amount: tableAmounts[beneficiary.id] || '',
                              tpin: '',
                            });
                            setModals({ ...modals, transfer: true });
                          }}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Send Money"
                        >
                          <Send className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            if (window.confirm('Are you sure you want to delete this beneficiary?')) {
                              handleDeleteBeneficiary(beneficiary);
                            }
                          }}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <Modal
        isOpen={modals.addBeneficiary}
        onClose={() => setModals({ ...modals, addBeneficiary: false })}
        title="Add New Account"
      >
        <div className="space-y-4">
          <FormInput
            placeholder="Account Holder Name"
            value={beneficiaryData.bank_account_holder_name}
            onChange={(e) =>
              setBeneficiaryData({ ...beneficiaryData, bank_account_holder_name: e.target.value })
            }
          />
          <FormInput
            placeholder="Bank Name"
            value={beneficiaryData.bank_name}
            onChange={(e) => setBeneficiaryData({ ...beneficiaryData, bank_name: e.target.value })}
          />
          <FormInput
            placeholder="Account Number"
            value={beneficiaryData.account_number}
            onChange={(e) => setBeneficiaryData({ ...beneficiaryData, account_number: e.target.value })}
          />
          <FormInput
            placeholder="Confirm Account Number"
            value={beneficiaryData.confirm_account_number}
            onChange={(e) =>
              setBeneficiaryData({ ...beneficiaryData, confirm_account_number: e.target.value })
            }
          />
          <FormInput
            placeholder="Beneficiary Mobile"
            value={beneficiaryData.beneficiary_mobile}
            onChange={(e) =>
              setBeneficiaryData({ ...beneficiaryData, beneficiary_mobile: e.target.value.replace(/\D/g, '').slice(0, 10) })
            }
            inputMode="numeric"
            maxLength={10}
          />
          <FormInput
            placeholder="Branch Name"
            value={beneficiaryData.branch_name}
            onChange={(e) => setBeneficiaryData({ ...beneficiaryData, branch_name: e.target.value })}
          />
          <FormInput
            placeholder="IFSC Code"
            value={beneficiaryData.ifsc_code}
            onChange={(e) => setBeneficiaryData({ ...beneficiaryData, ifsc_code: e.target.value })}
          />
          <button
            onClick={handleAddBeneficiary}
            disabled={addBeneficiaryMutation.isPending}
            className="w-full bg-[#00D3CD] text-white py-3 rounded-lg hover:bg-[#00bdb7] transition-colors disabled:opacity-50"
          >
            {addBeneficiaryMutation.isPending ? 'Adding...' : 'Add Account'}
          </button>
        </div>
      </Modal>

      <Modal
        isOpen={modals.viewBeneficiary}
        onClose={() => {
          setModals({ ...modals, viewBeneficiary: false });
          setSelectedBeneficiary(null);
        }}
        title="Beneficiary Details"
        style={{ height: '80%' }}
      >
        {selectedBeneficiary && (
          <div className="space-y-4 h-[50vh]">
            <div className="grid grid-cols-1 gap-3 overflow-y-scroll h-full">
              <div>
                <p className="text-sm text-gray-500">Name</p>
                <p className="text-lg font-medium">{selectedBeneficiary.name}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Account Number</p>
                <p className="text-lg font-medium">{selectedBeneficiary.account}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Bank Name</p>
                <p className="text-lg font-medium">{selectedBeneficiary.bank}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">IFSC Code</p>
                <p className="text-lg font-medium">{selectedBeneficiary.ifsc}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Beneficiary Mobile</p>
                <p className="text-lg font-medium">{selectedBeneficiary.mobile}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Branch Name</p>
                <p className="text-lg font-medium">{selectedBeneficiary.branch_name}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Remitter ID</p>
                <p className="text-lg font-medium">{selectedBeneficiary.remitter_id}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">External Reference ID</p>
                <p className="text-lg font-medium">{selectedBeneficiary.external_reference_id}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">User ID</p>
                <p className="text-lg font-medium">{selectedBeneficiary.user_id}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Status</p>
                <p className="text-lg font-medium text-green-600">{selectedBeneficiary.status}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Created At</p>
                <p className="text-lg font-medium">{selectedBeneficiary.createdAt}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Updated At</p>
                <p className="text-lg font-medium">{selectedBeneficiary.updatedAt}</p>
              </div>
            </div>
            <button
              onClick={() => {
                setModals({ ...modals, viewBeneficiary: false });
                setSelectedBeneficiary(null);
              }}
              className="w-full bg-gray-200 text-gray-800 py-3 rounded-lg hover:bg-gray-300 transition-colors"
            >
              Close
            </button>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={modals.transfer}
        onClose={() => setModals({ ...modals, transfer: false })}
        title="Send Money"
      >
        {selectedBeneficiary && (
          <div className="space-y-4">
            <div className="bg-gray-50 p-4 rounded-lg mb-4">
              <p className="text-sm text-gray-500">Sending to</p>
              <p className="font-medium">{selectedBeneficiary.name}</p>
              <p className="text-sm text-gray-600">{selectedBeneficiary.account}</p>
              <p className="text-sm text-gray-600">{selectedBeneficiary.bank}</p>
            </div>
            <FormInput
              type="number"
              placeholder="Enter Amount"
              value={transferData.amount}
              min="1"
              disabled={true}
              onChange={(e) => setTransferData({ ...transferData, amount: e.target.value })}
            />
            <select
              value={transferData.transferType}
              onChange={(e) => setTransferData({ ...transferData, transferType: e.target.value })}
              className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-[#00D3CD]"
            >
              <option value="IMPS">IMPS</option>
              <option value="NEFT">NEFT</option>
              <option value="RTGS">RTGS</option>
            </select>
            <FormInput
              type="password"
              placeholder="Enter TPIN"
              value={transferData.tpin}
              onChange={(e) => setTransferData({ ...transferData, tpin: e.target.value })}
            />
            <button
              onClick={handleTransfer}
              disabled={transferMutation.isPending || !transferData.amount || !transferData.tpin}
              className="w-full bg-[#00D3CD] text-white py-3 rounded-lg hover:bg-[#00bdb7] transition-colors disabled:opacity-50"
            >
              {transferMutation.isPending ? 'Processing...' : 'Send Money'}
            </button>
          </div>
        )}
      </Modal>

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
    </div>
  );
};

export default RemitterDetails;
