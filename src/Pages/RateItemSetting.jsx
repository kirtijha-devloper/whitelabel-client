import React, { useState, useEffect } from 'react';
import { getRateItems, createRateItem, updateRateItem, deleteRateItem } from '../api/rateItemSettingApi';
import Modal from '../components/Modal';
import Loader from '../components/Loader';

const companyOptions = ["Telering Process", "Ever Life"];
const modeOptions = ["CARD", "BHARATQR", "UPI"];
const cardTypeOptions = ["CREDIT", "DEBIT", "PREPAID"];

const INITIAL_FORM_STATE = {
  brandName: '',
  mode: 'CARD',
  card_type: 'CREDIT',
  card_classification: '',
  alias: '',
  merchantRate: 0.00,
  franchiseRate: 0.00,
  ctype: 'Telering Process'
};

const RateItemSetting = () => {
  const [rates, setRates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [editingRate, setEditingRate] = useState(null);
  const [formData, setFormData] = useState(INITIAL_FORM_STATE);
  const [error, setError] = useState('');

  // Fetch rates on component mount
  useEffect(() => {
    fetchRates();
  }, []);

  const fetchRates = async () => {
    try {
      setLoading(true);
      const data = await getRateItems();
      setRates(data);
    } catch (err) {
      setError('Failed to fetch rate items');
      console.error('Error fetching rate items:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitLoading(true);
    setError('');

    // Validate required fields
    if (!formData.mode || !formData.card_type || formData.merchantRate === '' || formData.franchiseRate === '') {
      setError('Please fill in all required fields');
      setSubmitLoading(false);
      return;
    }

    try {
      // Ensure mode is properly set
      const payload = {
        brandName: formData.brandName,  // updated to brandName
        mode: formData.mode,
        card_type: formData.card_type,
        card_classification: formData.card_classification || '',
        alias: formData.alias,
        merchantRate: parseFloat(formData.merchantRate),
        franchiseRate: parseFloat(formData.franchiseRate),
        ctype: formData.ctype // company
      };

      if (editingRate) {
        await updateRateItem({
          id: editingRate.id,
          ...payload
        });
      } else {
        await createRateItem(payload);
      }
      
      await fetchRates();
      closeModal();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to save rate item');
      console.error('Error saving rate item:', err);
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleEdit = (rate) => {
    setEditingRate(rate);
    setFormData({
      brandName: rate.brandName || "",
      mode: rate.mode || "",
      card_type: rate.card_type || "",
      card_classification: rate.card_classification || "",
      alias: rate.alias || "",
      merchantRate: rate.merchantRate || 0.00,
      franchiseRate: rate.franchiseRate || 0.00,
      ctype: rate.ctype || "Telering Process",
    });
    setModalOpen(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this rate?')) {
      try {
        await deleteRateItem(id);
        await fetchRates();
      } catch (err) {
        setError('Failed to delete rate');
        console.error('Error deleting rate:', err);
      }
    }
  };

  const openModal = () => {
    setEditingRate(null);
    setFormData(INITIAL_FORM_STATE);
    setModalOpen(true);
    setError('');
  };

  const closeModal = () => {
    setModalOpen(false);
    setFormData(INITIAL_FORM_STATE);
    setError('');
  };

  if (loading) return <Loader />;

  return (
    <div className="bg-gray-100 min-h-screen">
      <div>
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-center mb-6">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Rate Item Settings</h1>
              <p className="text-gray-600 mt-2 text-sm md:text-base">Manage transaction rate items and configurations</p>
            </div>
            <button
              onClick={openModal}
              className="w-full sm:w-auto bg-[#00D3CD] hover:bg-[#00b8b3] text-white font-semibold py-2 px-4 rounded-lg transition duration-200"
            >
              Add Rate Item
            </button>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
              {error}
            </div>
          )}

          {/* Mobile Cards */}
          <div className="md:hidden space-y-3">
            {rates.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-100 p-6 text-center text-gray-500">
                No rate items found. Add your first rate item above.
              </div>
            ) : (
              rates.map((rate) => (
                <div key={rate.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-gray-900">#{rate.id}</p>
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {rate.mode}
                      </span>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        {rate.card_type}
                      </span>
                    </div>
                  </div>
                  <p className="text-sm text-gray-700">
                    <span className="font-medium">Brand Name:</span> {rate.brandName || "-"}
                  </p>
                  <p className="text-sm text-gray-700">
                    <span className="font-medium">Classification:</span> {rate.card_classification || "-"}
                  </p>
                  <p className="text-sm text-gray-700">
                    <span className="font-medium">Merchant Rate:</span> {rate.merchantRate}
                  </p>
                  <p className="text-sm text-gray-700">
                    <span className="font-medium">Franchise Rate:</span> {rate.franchiseRate}
                  </p>
                  <div className="flex gap-3 pt-1">
                    <button
                      onClick={() => handleEdit(rate)}
                      className="text-[#00D3CD] hover:text-[#00b8b3] text-sm font-medium"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(rate.id)}
                      className="text-red-600 hover:text-red-900 text-sm font-medium"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Desktop/Tablet Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full table-auto">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Brand Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Mode
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Card Type
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Classification
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Merchant Rate
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Franchise Rate
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {rates.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="px-6 py-12 text-center text-gray-500">
                      No rate items found. Add your first rate item above.
                    </td>
                  </tr>
                ) : (
                  rates.map((rate) => (
                    <tr key={rate.id} className="hover:bg-gray-50">
                      <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {rate.brandName}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {rate.mode}
                        </span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          {rate.card_type}
                        </span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                        {rate.card_classification || '-'}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                        {rate.merchantRate}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                        {rate.franchiseRate}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => handleEdit(rate)}
                          className="text-[#00D3CD] hover:text-[#00b8b3] mr-3"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(rate.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <Modal
        isOpen={modalOpen}
        onClose={closeModal}
        title={editingRate ? 'Edit Rate Item' : 'Add Rate Item'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-md text-sm">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="mode" className="block text-sm font-medium text-gray-700 mb-1">
              Mode *
            </label>
            <select
              id="mode"
              name="mode"
              value={formData.mode}
              onChange={handleInputChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00D3CD]"
            >
              <option value="" disabled>Select Mode</option>
              {modeOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="card_type" className="block text-sm font-medium text-gray-700 mb-1">
              Card Type *
            </label>
            <select
              id="card_type"
              name="card_type"
              value={formData.card_type}
              onChange={handleInputChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00D3CD]"
            >
              <option value="">Select Card Type</option>
              {cardTypeOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="brandName" className="block text-sm font-medium text-gray-700 mb-1">
              Brand Name
            </label>
            <input
              type="text"
              id="brandName"
              name="brandName"
              value={formData.brandName}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00D3CD]"
              placeholder="Enter brand name"
            />
          </div>


          <div>
            <label htmlFor="card_classification" className="block text-sm font-medium text-gray-700 mb-1">
              Card Classification
            </label>
            <input
              type="text"
              id="card_classification"
              name="card_classification"
              value={formData.card_classification}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00D3CD]"
              placeholder="Enter card classification"
            />
          </div>



          <div>
            <label htmlFor="merchantRate" className="block text-sm font-medium text-gray-700 mb-1">
              Merchant Rate *
            </label>
            <input
              type="number"
              step="0.01"
              id="merchantRate"
              name="merchantRate"
              value={formData.merchantRate}
              onChange={handleInputChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00D3CD]"
              placeholder="Enter merchant rate"
            />
          </div>

          <div>
            <label htmlFor="franchiseRate" className="block text-sm font-medium text-gray-700 mb-1">
              Franchise Rate *
            </label>
            <input
              type="number"
              step="0.01"
              id="franchiseRate"
              name="franchiseRate"
              value={formData.franchiseRate}
              onChange={handleInputChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00D3CD]"
              placeholder="Enter franchise rate"
            />
          </div>



          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={closeModal}
              disabled={submitLoading}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitLoading}
              className="px-4 py-2 text-sm font-medium text-white bg-[#00D3CD] rounded-md hover:bg-[#00b8b3] disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            >
              {submitLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Saving...
                </>
              ) : (
                editingRate ? 'Update' : 'Add Rate Item'
              )}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default RateItemSetting;
