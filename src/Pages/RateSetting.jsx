import React, { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Home, ChevronRight, CreditCard, Plus, Edit, Trash2, Building2, Tag, Percent, X
} from 'lucide-react';
import {
  getTransactionRates,
  createTransactionRate,
  updateTransactionRate,
  deleteTransactionRate,
} from '../api/rateSettingApi';

const RateSetting = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    card: '',
    alias: '',
    rate: '',
    transFor: ''
  });

  // Fetch transaction rates with useQuery
  const { data: cards = [], isLoading: isLoadingRates } = useQuery({
    queryKey: ['transactionRates'],
    queryFn: getTransactionRates,
  });

  // Mutation for creating a rate
  const createRateMutation = useMutation({
    mutationFn: createTransactionRate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactionRates'] });
      handleClose();
    },
    onError: (error) => {
      console.error(error);
      alert(error.response?.data?.message || 'Error saving data');
    },
  });

  // Mutation for updating a rate
  const updateRateMutation = useMutation({
    mutationFn: updateTransactionRate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactionRates'] });
      handleClose();
    },
    onError: (error) => {
      console.error(error);
      alert(error.response?.data?.message || 'Error updating data');
    },
  });

  // Mutation for deleting a rate
  const deleteRateMutation = useMutation({
    mutationFn: deleteTransactionRate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactionRates'] });
    },
    onError: (error) => {
      console.error(error);
      alert(error.response?.data?.message || 'Error deleting data');
    },
  });

  const isSaving = createRateMutation.isPending || updateRateMutation.isPending;

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    // For rate, only allow numbers and decimal point
    if (name === 'rate') {
      if (value === '' || /^\d*\.?\d*$/.test(value)) {
        setFormData(prev => ({ ...prev, [name]: value }));
      }
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleClose = useCallback(() => {
    setIsModalOpen(false);
    setFormData({ card: '', alias: '', rate: '', transFor: '' });
    setEditingId(null);
  }, []);

  const handleEdit = (card) => {
    setFormData({
      card: card.card,
      alias: card.alias,
      rate: card.rate,
      transFor: card.transFor
    });
    setEditingId(card.id);
    setIsModalOpen(true);
  };

  const handleDelete = (id) => {
    if (window.confirm('Are you sure you want to delete this card?')) {
      deleteRateMutation.mutate(id);
    }
  };

  const handleSave = () => {
    if (!formData.card || !formData.alias || !formData.rate || !formData.transFor) {
      alert('Please fill in all fields');
      return;
    }

    const payload = {
      rate: formData.rate,
      transFor: formData.transFor,
      card: formData.card,
      alias: formData.alias
    };

    if (editingId) {
      // The `updateTransactionRate` function expects an object with an `id`
      // and the rest of the data, so we spread the payload here.
      updateRateMutation.mutate({ id: editingId, ...payload });
    } else {
      createRateMutation.mutate(payload);
    }
  };


  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') handleClose();
    };

    if (isModalOpen) {
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isModalOpen, handleClose]);

  return (
    <div className="p-4 md:p-6 bg-slate-50 min-h-screen font-sans">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 text-sm text-gray-600 mb-6 font-semibold tracking-wide">
        <Home
          className="w-4 h-4 text-blue-600 cursor-pointer hover:text-blue-800"
          onClick={() => navigate('/admin/dashboard')}
        />
        <span
          className="text-gray-800 cursor-pointer hover:underline"
          onClick={() => navigate('/admin/dashboard')}
        >
          Home
        </span>
        <ChevronRight className="w-4 h-4 text-gray-400" />
        <span className="text-gray-800">Rate Setting</span>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden flex flex-col max-w-5xl mx-auto">
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between gap-3 bg-gray-50/50">
          <div className="flex items-center gap-3">
            <div className="p-1.5 bg-blue-50/80 border border-blue-100 text-blue-600 rounded-lg shadow-sm">
              <CreditCard className="w-4 h-4" />
            </div>
            <h2 className="text-[16px] font-bold text-slate-800 tracking-wide">Rate Setting List</h2>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#1855e4] text-white font-bold text-[11px] uppercase tracking-wider hover:bg-blue-700 transition shadow-md hover:shadow-lg"
          >
            <Plus className="w-3.5 h-3.5" strokeWidth={2.5} />
            Add New Card
          </button>
        </div>

        {/* Card List */}
        <div className="p-6 space-y-4 bg-white">
          {cards.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-xl bg-gray-50">
              <CreditCard className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 font-medium">No cards added yet. Click the button above to add a new card.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {cards.map(card => (
                <div
                  key={card.id}
                  className="group flex flex-col p-5 bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md hover:border-blue-100 transition-all duration-300 relative overflow-hidden"
                >
                  <div className="absolute top-0 left-0 w-1 h-full bg-blue-500 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-slate-50 text-slate-700 rounded-lg border border-slate-100 group-hover:bg-blue-50 group-hover:text-blue-600 group-hover:border-blue-100 transition-colors">
                        <CreditCard className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-800 text-[15px]">{card.card}</h3>
                        <div className="flex items-center gap-1.5 mt-1 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                          <Building2 className="w-3 h-3 text-gray-400" />
                          <span>{card.transFor}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 px-3 py-1 bg-green-50 text-green-700 rounded-full border border-green-100">
                      <Percent className="w-3 h-3" />
                      <span className="font-bold text-xs tracking-wide">{card.rate}%</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-gray-50 mt-auto">
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider bg-gray-50 px-2.5 py-1 rounded-md">
                      <Tag className="w-3 h-3 text-gray-400" />
                      <span>{card.alias}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleEdit(card)}
                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-transparent hover:border-blue-100"
                        title="Edit Card"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(card.id)}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100"
                        title="Delete Card"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <>
          <div
            className="fixed inset-0 bg-black bg-opacity-50 transition-opacity duration-300 ease-in-out backdrop-blur-sm"
            onClick={handleClose}
          />
          <div
            className="fixed inset-0 flex items-center justify-center p-4 pointer-events-none"
          >
            <div
              className="bg-white rounded-xl shadow-xl w-full max-w-2xl pointer-events-auto transform transition-all duration-300 ease-in-out"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 sm:p-8">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-2xl font-semibold text-gray-800 flex items-center gap-2">
                    <span>✨</span> Rate Setting Details
                  </h3>
                  <button
                    onClick={handleClose}
                    className="text-gray-400 hover:text-gray-600 transition-colors p-2 hover:bg-gray-100 rounded-full"
                  >
                    <svg className="w-5 h-5" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                      <path d="M6 18L18 6M6 6l12 12"></path>
                    </svg>
                  </button>
                </div>

                <div className="space-y-6">
                  <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
                    <div>
                      <label htmlFor="transFor" className="block text-sm font-medium text-gray-700 mb-1">
                        transFor
                      </label>
                      <select
                        id="transFor"
                        name="transFor"
                        value={formData.transFor}
                        onChange={handleInputChange}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                      >
                        <option value="">Select transFor</option>
                        <option value="Telering">Telering</option>
                        <option value="Ever Life">Ever Life</option>
                        <option value="Default Rate">Default Rate</option>
                      </select>
                    </div>

                    <div>
                      <label htmlFor="card" className="block text-sm font-medium text-gray-700 mb-1">
                        Card Name
                      </label>
                      <input
                        type="text"
                        id="card"
                        name="card"
                        value={formData.card}
                        onChange={handleInputChange}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                        placeholder="Enter card name"
                      />
                    </div>

                    <div>
                      <label htmlFor="alias" className="block text-sm font-medium text-gray-700 mb-1">
                        Card Name Alias
                      </label>
                      <input
                        type="text"
                        id="alias"
                        name="alias"
                        value={formData.alias}
                        onChange={handleInputChange}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                        placeholder="Enter card alias (eg: Mastercard, Master Card)"
                      />
                    </div>

                    <div>
                      <label htmlFor="rate" className="block text-sm font-medium text-gray-700 mb-1">
                        Rate (%)
                      </label>
                      <input
                        type="text"
                        id="rate"
                        name="rate"
                        value={formData.rate}
                        onChange={handleInputChange}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                        placeholder="Enter rate percentage"
                      />
                    </div>
                  </form>
                </div>

                <div className="mt-8 flex justify-end gap-3">
                  <button
                    onClick={handleClose}
                    className="px-6 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-all duration-200 font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="px-6 py-2.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center gap-2"
                  >
                    {isSaving ? (
                      <>
                        <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Saving...
                      </>
                    ) : 'Save Changes'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default RateSetting
