import { useMutation } from '@tanstack/react-query';
import { signup } from '../../api/authApi';
import { setAuthToken } from '../../utils/auth';

export const useSignup = () => {
  return useMutation({
    mutationFn: signup,
    onSuccess: (data) => {
      console.log('Signup successful:', data);
    },
    onError: (error) => {
      console.error('Signup failed:', error);
    },
  });
};