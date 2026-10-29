import axios from 'axios';
import { BASE_URL } from '../constants';

/**
 * Fetches the current tenant branding based on registered domain.
 */
export const fetchCurrentBranding = async () => {
  const currentHostname = typeof window !== 'undefined' ? window.location.hostname : '';
  const params = {};

  // For authorized local development / testing only:
  // If ?dev_domain=... is present in the browser URL or localStorage, pass it to local server
  if (typeof window !== 'undefined') {
    const urlParams = new URLSearchParams(window.location.search);
    const devDomain = urlParams.get('dev_domain') || localStorage.getItem('dev_tenant_domain');
    if (devDomain && (currentHostname === 'localhost' || currentHostname === '127.0.0.1')) {
      params.dev_domain = devDomain;
    }
  }

  const response = await axios.get(`${BASE_URL}/branding/current`, {
    params,
    headers: {
      'Cache-Control': 'no-cache',
    },
    timeout: 6000,
  });

  return response.data?.data || null;
};

