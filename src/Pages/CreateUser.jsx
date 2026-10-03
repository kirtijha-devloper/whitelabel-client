import { useState } from 'react';
import { UserPlus, Users, Mail, Lock, User, Briefcase, Phone, CheckCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useSignup } from '../hooks/auth/useSignup';
import { createUser } from '../api/userCreateApi';
import { useUserCreation } from '../context/UserCreationContext';
import StepIndicator from '../components/StepIndicator';
import { toast } from 'react-toastify';

const steps = ['Basic Info', 'Address & Documents', 'POS Assignment', 'ChargeSet'];

function CreateUser({ currentUser }) {
  const navigate = useNavigate();
  const { state, dispatch } = useUserCreation();
  const { mutate: signup, isPending, isError, error } = createUser();
  const [showSuccess, setShowSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    signup(state.formData, {
      onSuccess: (data) => {
        if (data?.user?.id) {
          const redirectUrl = "/admin/rate-setting";
          navigate(redirectUrl);
        }
      },
      onError: (error) => {
        const errorMessage = error?.response?.data?.message || error?.message || 'Something went wrong!';
        toast.error(errorMessage);
        console.error("Error creating user:", error);
      }
    });
  };

  const handleChange = (e) => {
    dispatch({
      type: 'UPDATE_FORM',
      payload: { [e.target.name]: e.target.value },
    });
  };

  return (
    <div className="min-h-screen">
      <StepIndicator currentStep={state.currentStep} steps={steps} />

      <div className="max-w-2xl mx-auto">
        <div className="flex gap-4 items-center mb-4">
          <div className="bg-primary text-white p-3 rounded-lg">
            <UserPlus size={20} />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Create New User</h1>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                <Briefcase size={16} /> Role
              </label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="role"
                    value="merchant"
                    checked={state.formData.role === 'merchant'}
                    onChange={handleChange}
                  /> Merchant
                </label>
                {currentUser.role !== 'franchise' && (
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="role"
                      value="franchise"
                      checked={state.formData.role === 'franchise'}
                      onChange={handleChange}
                    /> Franchise
                  </label>
                )}
              </div>
            </div>

            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                <User size={16} /> Full Name
              </label>
              <input
                type="text"
                name="name"
                value={state.formData.name}
                onChange={handleChange}
                required
                placeholder="Enter full name"
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                <Mail size={16} /> Email Address
              </label>
              <input
                type="email"
                name="email"
                value={state.formData.email}
                onChange={handleChange}
                required
                placeholder="Enter email address"
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                <Phone size={16} /> Mobile Number
              </label>
              <input
                type="text"
                name="mobile_number"
                value={state.formData.mobile_number}
                onChange={handleChange}
                required
                placeholder="Enter mobile number"
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                <Lock size={16} /> Password
              </label>
              <input
                type="password"
                name="password"
                value={state.formData.password}
                onChange={handleChange}
                required
                placeholder="Enter password"
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <button
              type="submit"
              disabled={isPending}
              className="w-full bg-primary text-white py-2 px-4 rounded-lg flex items-center justify-center gap-2"
            >
              {isPending ? 'Creating...' : 'Next Step'}
            </button>
          </form>
        </div>

        {showSuccess && (
          <div className="fixed bottom-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-2">
            <CheckCircle size={20} /> Basic information saved!
          </div>
        )}
      </div>
    </div>
  );
}

export default CreateUser;
