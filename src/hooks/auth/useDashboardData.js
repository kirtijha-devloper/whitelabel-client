import { useQuery } from '@tanstack/react-query';
import { getDashboardData } from '../../api/authApi';
import { getAuthToken } from '../../utils/auth';

export const useDashboardData = () => {
  const token = getAuthToken();

  return useQuery({
    queryKey: ['dashboardData', token],
    queryFn: () => getDashboardData(token),
    enabled: !!token, 
    onError: (error) => {
      console.error('Failed to fetch dashboard data:', error.message);
    },
  });
};