import React, { useState, useEffect } from 'react';
import { getDefaultRateItems } from '../api/defaultRateSettingApi';
import Loader from '../components/Loader';

const DefaultRateSetting = () => {
  const [defaultRates, setDefaultRates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchDefaultRates();
  }, []);

  const fetchDefaultRates = async () => {
    try {
      setLoading(true);
      const data = await getDefaultRateItems();
      console.log(data);
      setDefaultRates(data);
      setError(null);
    } catch (err) {
      setError(err.message || 'Failed to fetch default rates');
      setDefaultRates([]);
    } finally {
      setLoading(false);
    }
  };

  const formatRate = (rate) => {
    return rate ? `${rate}%` : '0%';
  };

  const formatCardType = (cardType) => {
    if (!cardType) return '-';
    return cardType.charAt(0).toUpperCase() + cardType.slice(1);
  };

  const formatCardClassification = (classification) => {
    if (!classification) return '-';
    return classification.charAt(0).toUpperCase() + classification.slice(1);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader />
      </div>
    );
  }


   const handleChargeChange = (id, newRate) => {
    setUserRates((currentRates) =>
      currentRates.map((rate) =>
        rate.id === id ? { ...rate, rate: newRate } : rate
      )
    );
  };

  const handleRateBlur = (rateId, newRate) => {
    // const originalRate = fetchedUserRates.find((rate) => rate.id === rateId);

    // if (originalRate && String(originalRate.rate) !== String(newRate)) {
    //   updateRateMutation.mutate({ userId, rateId, rate: newRate });
    // }
  };

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
        <p className="font-medium">Error: {error}</p>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h1 className="text-2xl font-bold text-gray-900">Default Rate Settings</h1>
            <p className="text-sm text-gray-600 mt-1">
              Manage and view all default rates for rate items
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Alias
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Mode
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Card Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Classification
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Rate
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {defaultRates.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="px-6 py-8 text-center text-gray-500">
                      No default rates found
                    </td>
                  </tr>
                ) : (
                  defaultRates.map((rate) => (
                    <tr key={rate.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {rate.id}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {rate.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {rate.ctype || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {rate.alias || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {rate.mode || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatCardType(rate.card_type)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatCardClassification(rate.card_classification)}
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
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="px-6 py-4 border-t border-gray-200">
            <p className="text-sm text-gray-600">
              Total records: {defaultRates.length}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DefaultRateSetting;
