import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, Trash2, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import StepIndicator from '../components/StepIndicator';
import { useUserCreation } from '../context/UserCreationContext';
import { createChargeSlab } from '../api/chargeSet';

const steps = ['Basic Info', 'Address & Documents', 'POS Assignment', 'ChargeSet'];

const CreateChargeSet = ({currentUser}) => {
  const navigate = useNavigate();
  const { state, dispatch } = useUserCreation();
  const queryClient = useQueryClient();
  const [showSuccess, setShowSuccess] = useState(false);
  const [category, setCategory] = useState('payout');
  const [slab, setSlab] = useState({
    min_amount: '',
    max_amount: '',
    flat_fee: '',
    percent_fee: '',
  });
  const [savedSlabs, setSavedSlabs] = useState([]);

  const { id } = useParams();

  // Create charge slab mutation
  const createSlabMutation = useMutation({
    mutationFn: createChargeSlab,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['chargeTypes'] });
      console.log(data, "dtaaaaaaaaaaaa")
      setShowSuccess(true);
      setSavedSlabs([...savedSlabs, { ...slab, id: data?.slab?.user_id, category }]); // Assuming API returns an id
      setSlab({
        min_amount: '',
        max_amount: '',
        flat_fee: '',
        percent_fee: '',
      });
      setTimeout(() => setShowSuccess(false), 3000);
    },
    onError: (error) => {
      console.error('Error creating slab:', error);
    },
  });
  console.log(savedSlabs, "savedSlabs");

  const handleSlabSubmit = async (e) => {
    e.preventDefault();

    try {
      await createSlabMutation.mutateAsync({
        charge_type_category: category,
        min_amount: parseFloat(slab.min_amount),
        max_amount: parseFloat(slab.max_amount),
        flat_fee: parseFloat(slab.flat_fee),
        percent_fee: parseFloat(slab.percent_fee),
        user_id: id,
      });
    } catch (error) {
      console.error('Error creating slab:', error);
    }
  };
  const redirectUrl = currentUser.role === "admin" ? '/admin/list' :'/franchise/list';

  const handleComplete = () => {
    dispatch({ type: 'NEXT_STEP' });
    navigate(redirectUrl);
  };

  const updateSlabField = (field, value) => {
    setSlab({ ...slab, [field]: value });
  };

  return (
    <div className="min-h-screen">
      <StepIndicator currentStep={state.currentStep} steps={steps} />

      <div className="max-w-4xl mx-auto space-y-6">
        {/* User Info Summary */}
        <div className="flex gap-8 text-center mb-4">
          <div className="flex items-center gap-2">
            <p className="text-lg font-semibold">Role: </p>
            <p className="text-sm font-medium">{state.formData.role}</p>
          </div>
          <div className="flex items-center gap-2">
            <p className="text-lg font-semibold">Name: </p>
            <p className="text-sm font-medium">{state.formData.name}</p>
          </div>
          <div className="flex items-center gap-2">
            <p className="text-lg font-semibold">Phone: </p>
            <p className="text-sm font-medium">{state.formData.mobile_number}</p>
          </div>
        </div>

        {/* Charge Slabs Form */}
        <div className="bg-white rounded-xl shadow-lg p-6 space-y-4">
          <div className="lg:w-1/2">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
              required
            >
              <option value="payout">Payout Charge Set</option>
              <option value="pos_rental">POS Rental Set</option>
            </select>
          </div>

          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">Charge Slabs</h2>
          </div>

          {/* Current Slab Input */}
          <form onSubmit={handleSlabSubmit} className="space-y-4">
            <div className="relative p-4 border rounded-lg bg-gray-50">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Min Amount
                  </label>
                  <input
                    type="number"
                    value={slab.min_amount}
                    onChange={(e) => updateSlabField('min_amount', e.target.value)}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                    placeholder="0"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Max Amount
                  </label>
                  <input
                    type="number"
                    value={slab.max_amount}
                    onChange={(e) => updateSlabField('max_amount', e.target.value)}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                    placeholder="1000"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Flat Fee
                  </label>
                  <input
                    type="number"
                    value={slab.flat_fee}
                    onChange={(e) => updateSlabField('flat_fee', e.target.value)}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                    placeholder="10"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Percent Fee
                  </label>
                  <input
                    type="number"
                    value={slab.percent_fee}
                    onChange={(e) => updateSlabField('percent_fee', e.target.value)}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                    placeholder="2.5"
                    required
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={createSlabMutation.isPending}
              className="px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50"
            >
              {createSlabMutation.isPending ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="animate-spin" size={16} />
                  Saving Slab...
                </div>
              ) : (
                'Save Slab'
              )}
            </button>
          </form>

          {/* Display Saved Slabs */}
          {savedSlabs.length > 0 && (
            <div className="mt-6">
              <h3 className="text-md font-semibold mb-2">Saved Slabs</h3>
              {savedSlabs.map((savedSlab, index) => (
                <div key={index} className="p-4 border rounded-lg bg-gray-100 mb-2">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <p>Category: {savedSlab.category}</p>
                    <p>Min: {savedSlab.min_amount}</p>
                    <p>Max: {savedSlab.max_amount}</p>
                    <p>Flat Fee: {savedSlab.flat_fee}</p>
                    <p>Percent Fee: {savedSlab.percent_fee}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-between mt-6">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Back
            </button>
            <button
              type="button"
              onClick={handleComplete}
              className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
              disabled={savedSlabs.length === 0}
            >
              Complete Setup
            </button>
          </div>
        </div>

        {/* Success Message */}
        {showSuccess && (
          <div className="fixed bottom-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-2">
            <CheckCircle size={20} />
            Slab saved successfully!
          </div>
        )}

        {/* Error Message */}
        {createSlabMutation.isError && (
          <div className="fixed bottom-4 right-4 bg-red-500 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-2">
            <AlertCircle size={20} />
            {createSlabMutation.error?.message || 'An error occurred'}
          </div>
        )}
      </div>
    </div>
  );
};

export default CreateChargeSet;