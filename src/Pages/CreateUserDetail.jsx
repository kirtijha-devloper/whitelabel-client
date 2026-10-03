import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { UserPlus, Lock, CheckCircle } from 'lucide-react';
import { useUserCreation } from '../context/UserCreationContext';
import StepIndicator from '../components/StepIndicator';
import { onboardUser } from '../api/FranchiseApi';

const steps = ['Basic Info', 'Address & Documents', 'POS Assignment', 'ChargeSet'];

function CreateUserDetail({ currentUser }) {
  const navigate = useNavigate();
  const { state, dispatch } = useUserCreation();
  const [showSuccess, setShowSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const { id } = useParams();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = await onboardUser(id, state.formData, state.formData.role);
      if (data?.id) {
        setShowSuccess(true);
        setTimeout(() => {
          setShowSuccess(false);
          const redirectUrl = currentUser.role === "franchise" ? `/franchise/create-user/pos/${data.id}` : `/admin/create-user/pos/${data.id}`;
          dispatch({ type: 'NEXT_STEP' });
          navigate(redirectUrl);
        }, 1500);
      }
    } catch (error) {
      console.error("Error onboarding user:", error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, files } = e.target;
    dispatch({
      type: 'UPDATE_FORM',
      payload: { [name]: type === 'file' ? files[0] : value },
    });
  };

  return (
    <div className="min-h-screen">
      <StepIndicator currentStep={state.currentStep} steps={steps} />

      <div className="max-w-4xl mx-auto">
        <div className="flex gap-8 text-center mb-4">
          <div className="flex items-center gap-2">
            <p className="text-lg font-semibold">Role: </p>
            <p className="text-sm font-medium pt-1">{state.formData.role}</p>
          </div>
          <div className="flex items-center gap-2">
            <p className="text-lg font-semibold">Name: </p>
            <p className="text-sm font-medium pt-1">{state.formData.name}</p>
          </div>
          <div className="flex items-center gap-2">
            <p className="text-lg font-semibold">Phone: </p>
            <p className="text-sm font-medium pt-1">{state.formData.mobile_number}</p>
          </div>

        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-xl font-semibold mb-4">Personal Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

              {/* Gender Selection */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                  Gender
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="gender"
                      value="male"
                      checked={state.formData.gender === 'male'}
                      onChange={handleChange}
                    />
                    Male
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="gender"
                      value="female"
                      checked={state.formData.gender === 'female'}
                      onChange={handleChange}
                    />
                    Female
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="gender"
                      value="other"
                      checked={state.formData.gender === 'other'}
                      onChange={handleChange}
                    />
                    Other
                  </label>
                </div>
              </div>

              {/* Date of Birth */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                  Date of Birth
                </label>
                <input
                  type="date"
                  name="dob"
                  value={state.formData.dob || ''}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>

            </div>
          </div>


          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-xl font-semibold mb-4">Address Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Address Line 1
                </label>
                <input
                  type="text"
                  name="address1"
                  value={state.formData.address1}
                  onChange={handleChange}
                  required
                  placeholder="Enter Address Line 1"
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Address Line 2
                </label>
                <input
                  type="text"
                  name="address2"
                  value={state.formData.address2}
                  onChange={handleChange}
                  placeholder="Enter Address Line 2"
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  City
                </label>
                <input
                  type="text"
                  name="city"
                  value={state.formData.city}
                  onChange={handleChange}
                  required
                  placeholder="Enter City"
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  District
                </label>
                <input
                  type="text"
                  name="district"
                  value={state.formData.district}
                  onChange={handleChange}
                  required
                  placeholder="Enter District"
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Pincode
                </label>
                <input
                  type="text"
                  name="pincode"
                  value={state.formData.pincode}
                  onChange={handleChange}
                  required
                  placeholder="Enter Pincode"
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  State
                </label>
                <input
                  type="text"
                  name="state"
                  value={state.formData.state}
                  onChange={handleChange}
                  required
                  placeholder="Enter State"
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-xl font-semibold mb-4">Document Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              <div className="min-w-0">
                <label className="block text-sm font-medium text-gray-700 mb-2 leading-5">
                  Aadhar Card Number
                </label>
                <input
                  type="text"
                  name="aadhar_number"
                  value={state.formData.aadhar_number}
                  onChange={handleChange}
                  required
                  placeholder="Enter Aadhar Number"
                  className="w-full min-w-0 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="min-w-0">
                <label className="block text-sm font-medium text-gray-700 mb-2 leading-5">
                  PAN Card Number
                </label>
                <input
                  type="text"
                  name="pan_number"
                  value={state.formData.pan_number}
                  onChange={handleChange}
                  required
                  placeholder="Enter PAN Number"
                  className="w-full min-w-0 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="min-w-0">
                <label className="block text-sm font-medium text-gray-700 mb-2 leading-5">
                  Aadhar Card Image
                </label>
                <input
                  type="file"
                  name="aadhar_photo"
                  onChange={handleChange}
                  accept="image/*"
                  className="w-full min-w-0 text-sm text-gray-700 px-3 py-2 border rounded-lg file:mr-3 file:rounded-md file:border-0 file:bg-primary/10 file:px-3 file:py-2 file:text-primary file:font-medium"
                />
              </div>

              <div className="min-w-0">
                <label className="block text-sm font-medium text-gray-700 mb-2 leading-5">
                  PAN Card Image
                </label>
                <input
                  type="file"
                  name="pan_photo"
                  onChange={handleChange}
                  accept="image/*"
                  className="w-full min-w-0 text-sm text-gray-700 px-3 py-2 border rounded-lg file:mr-3 file:rounded-md file:border-0 file:bg-primary/10 file:px-3 file:py-2 file:text-primary file:font-medium"
                />
              </div>

              <div className="min-w-0">
                <label className="block text-sm font-medium text-gray-700 mb-2 leading-5">
                  Bank Passbook
                </label>
                <input
                  type="file"
                  name="bank_passbook"
                  onChange={handleChange}
                  accept="image/*,application/pdf"
                  className="w-full min-w-0 text-sm text-gray-700 px-3 py-2 border rounded-lg file:mr-3 file:rounded-md file:border-0 file:bg-primary/10 file:px-3 file:py-2 file:text-primary file:font-medium"
                />
              </div>

              <div className="md:col-span-2 min-w-0">
                <label className="block text-sm font-medium text-gray-700 mb-2 leading-5">
                  Shop Photo URL
                </label>
                <input
                  type="file"
                  name="shop_photo"
                  onChange={handleChange}
                  accept="image/*"
                  className="w-full min-w-0 text-sm text-gray-700 px-3 py-2 border rounded-lg file:mr-3 file:rounded-md file:border-0 file:bg-primary/10 file:px-3 file:py-2 file:text-primary file:font-medium"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-between">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="px-6 py-2 border border-gray-300 rounded-lg"
            >
              Back
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-primary text-white rounded-lg"
              disabled={loading}
            >
              {loading ? 'Submitting...' : 'Next Step'}
            </button>
          </div>
        </form>

        {showSuccess && (
          <div className="fixed bottom-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-2">
            <CheckCircle size={20} /> Details saved successfully!
          </div>
        )}
      </div>
    </div>
  );
}

export default CreateUserDetail;
