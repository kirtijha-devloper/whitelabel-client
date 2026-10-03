import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { getUserRateItems, updateUserRateItem } from '../api/userRateSettingApi';
import Loader from '../components/Loader';

const UserRateSetting = () => {
  const { userId } = useParams();
  const queryClient = useQueryClient();
  const [userRates, setUserRates] = useState([]);

  const { data: fetchedUserRates, isLoading, error } = useQuery({
    queryKey: ['userRates', userId],
    queryFn: () => getUserRateItems(userId),
  });

  const updateRateMutation = useMutation({
    mutationFn: updateUserRateItem,
    onSuccess: () => {
      toast.success('Rate updated successfully!');
      queryClient.invalidateQueries({ queryKey: ['userRates', userId] });
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to update rate.');
    },
  });

  useEffect(() => {
    if (fetchedUserRates) {
      setUserRates(fetchedUserRates);
    }
  }, [fetchedUserRates]);

  const handleChargeChange = (id, newRate) => {
    setUserRates((currentRates) =>
      currentRates.map((rate) =>
        rate.id === id ? { ...rate, rate: newRate } : rate
      )
    );
  };

  const handleRateBlur = (rateId, newRate) => {
    const originalRate = fetchedUserRates.find((rate) => rate.id === rateId);

    if (originalRate && String(originalRate.rate) !== String(newRate)) {
      updateRateMutation.mutate({ userId, rateId, rate: newRate });
    }
  };

  if (isLoading) return <Loader />;
  if (error) return <div>Error loading user rates: {error.message}</div>;

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h1 className="text-3xl font-bold text-gray-900">User Rate Settings</h1>
        </div>

        <div className="overflow-x-auto">
            <table className="w-full table-auto">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Card Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Alias
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Company
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Charge
                  </th>
                 
                </tr>
              </thead>
              <tbody>
                {userRates.map((rate) => (
                  <tr key={rate.id} className="border-b">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {rate.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {rate.alias}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {rate.ctype}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <input
                        type="text"
                        value={rate.rate}
                        onChange={(e) => handleChargeChange(rate.id, e.target.value)}
                        onBlur={(e) => handleRateBlur(rate.id, e.target.value)}
                        className="border border-gray-300 rounded-md p-1"
                      />
                    </td>
                    
                  </tr>
                ))}
              </tbody>
            </table>
          </div>


      </div>
    </div>
  );
};

export default UserRateSetting;
