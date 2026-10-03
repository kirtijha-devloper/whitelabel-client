import { useMutation } from '@tanstack/react-query';
import { fetchUserDetails, login } from '../../api/authApi';
import { setAuthToken } from '../../utils/auth';
import {  useNavigate } from 'react-router-dom';

export const useLogin = () => {
  const navigate = useNavigate();
  return useMutation({
    mutationFn: login,
    onSuccess: async (data) => {
      // setAuthToken(data.accessToken); 
      console.log('Login successful:', data);

    },
    onError: (error) => {
      console.error('Login failed:', error);
    },
  });
};