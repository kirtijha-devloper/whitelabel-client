import axios from 'axios';
import { BASE_URL } from '../constants';
import { getAuthToken } from '../utils/auth';

const api = axios.create({
  baseURL: BASE_URL, 
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = getAuthToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const sddsLogin = async (credentials) => {
  console.log(credentials, "credential");
  // return new Promise((resolve) =>
  //   setTimeout(() => {
  //     resolve({
  //       success: true,
  //       message: 'Mocked SDDS login success',
  //       token: 'mocked_sdds_token_12345', // You can use any dummy token here
  //       data: { mobile_number: '9876543210', name: 'John Doe' },
  //     });
  //   }, 1000) // Simulate network delay
  // );
  try {
    const response = await api.post('/payment/sdds/login', credentials);
    console.log("data................. in backend for sdds login", response)
    return response.data;
  } catch (error) {
    throw new Error(error.response?.data?.error?.message || 'SDDS login failed');
  }
};

export const verifyTpin = async (tpinData) => {
  // return new Promise((resolve) =>
  //   setTimeout(() => {
  //     resolve({
  //       success: true,
  //       message: 'Mocked TPIN verification success',
  //       data: { verified: true },
  //     });
  //   }, 1000)
  // );
  try {
    const response = await api.post('/payment/sdds/verify-tpin', tpinData);
    return response.data;
  } catch (error) {
    throw new Error(error.response?.data?.error?.message || 'TPIN verification failed');
  }
};

// Remitter Login
export const remitterLogin = async (data) => {
  // return new Promise((resolve, reject) =>
  //   setTimeout(() => {
  //     // Simulate "registered" remitter for mobile '9876543210'
  //     if (data.mobile_number === '9876543210') {
  //       resolve({
  //         success: true,
  //         message: 'Mocked remitter login success',
  //         token: 'mocked_remitter_token_67890',
  //       });
  //     } else {
  //       reject(new Error('Remitter not found'));
  //     }
  //   }, 1000)
  // );
  console.log(data, "data");
  try {
    const response = await api.post('/payment/sdds/remitter-login', data);
    console.log(response, "response);")
    return response.data;
  } catch (error) {
    console.log(error?.response?.data)
    throw new Error(error.response?.data?.message || 'Remitter login failed');
  }
};

// Remitter Register
export const remitterRegister = async (data) => {
  // return new Promise((resolve) =>
  //   setTimeout(() => {
  //     resolve({
  //       success: true,
  //       message: 'Mocked remitter registration success',
  //       data: {
  //         mobile_number: data.mobile_number,
  //         name: data.name,
  //         token: 'mocked_remitter_token_' + Math.random().toString(36).substr(2, 9),
  //       },
  //     });
  //   }, 1000)
  // );
  try {
    console.log(data, "data come from frontend")
    const response = await api.post('/payment/sdds/remitter-register', data);
    console.log(response, "data cmes from bckend.")
    return response.data;
  } catch (error) {
    console.log(error)
    throw new Error(error.response?.data?.message || 'Remitter registration failed');
  }
};

// Get Beneficiary List
export const getBeneficiaryList = async (data) => {
  // return new Promise((resolve) =>
  //   setTimeout(() => {
  //     resolve({
  //       success: true,
  //       message: 'Mocked beneficiary list fetched',
  //       data: [
  //         { id: 1, bank_account_holder_name: 'John Doe', bank_account_number: '1234567890' },
  //         { id: 2, bank_account_holder_name: 'Jane Smith', bank_account_number: '0987654321' },
  //       ],
  //     });
  //   }, 1000)
  // );
  console.log('get beneficiary list payload:', data);
  try {
    const response = await api.post('/payment/sdds/remitter-beneficiaries', data);
    console.log(response, 'response')
    return response.data;
  } catch (error) {
    console.log(error?.response)
    throw new Error(error.response?.data?.message || 'Failed to fetch beneficiaries');
  }
};

export const addBeneficiary = async (data) => {
  // return new Promise((resolve) =>
  //   setTimeout(() => {
  //     resolve({
  //       success: true,
  //       message: 'Mocked beneficiary added',
  //       data: {
  //         id: Math.random().toString(36).substr(2, 9),
  //         bank_account_holder_name: data.bank_account_holder_name,
  //         bank_account_number: data.bank_account_number,
  //       },
  //     });
  //   }, 1000)
  // );
  console.log(data, "data for add beneficiary.");
  try {
    const response = await api.post('/payment/sdds/add-beneficiary', data);
    return response.data;
  } catch (error) {
    console.log(error.response, "data")
    throw new Error(error.response?.data?.message || 'Failed to add beneficiary');
  }
};

export const deleteBeneficiary = async (data) => {
  // return new Promise((resolve) =>
  //   setTimeout(() => {
  //     resolve({
  //       success: true,
  //       message: 'Mocked beneficiary deleted',
  //       data: { id: data.id },
  //     });
  //   }, 1000)
  // );
  console.log(data,"data delete")
  try {
    const response = await api.post('/payment/sdds/delete-beneficiary', data);
    return response.data;
  } catch (error) {
    console.log(error.response)
    throw new Error(error.response?.data?.message || 'Failed to delete beneficiary');
  }
};

export const transferImps = async (data) => {
  // return new Promise((resolve) =>
  //   setTimeout(() => {
  //     resolve({
  //       success: true,
  //       message: 'Mocked IMPS transfer success',
  //       data: {
  //         transaction_id: 'txn_' + Math.random().toString(36).substr(2, 9),
  //         amount: data.INPUT_DEBIT_AMOUNT,
  //         beneficiary: data.BENE_ACC_NAME,
  //       },
  //     });
  //   }, 1000)
  // );
  console.log(data, "daaaaaaa")
  try {
    const response = await api.post('/payment/sdds/transfer-imps', data);
    return response.data;
  } catch (error) {
    console.log(error.response, "eror")
    throw new Error(error.response?.data?.message || 'IMPS transfer failed');
  }
};

export const impsTransactionList = async ({remitter_id})=>{
  try{
    const response = await api.get(`/payment/sdds/imps-transactions-list?remitter_id=${remitter_id}`);
    console.log(response, "response from backend")
    return response.data;
  } catch(error){
    console.log(error.response, "errrrrrrrrrrrr")
    throw new Error(error.response?.data?.message || 'IMPS transfer failed');
  }
}

export const remitterList = async ()=>{
  try{
    const response = await api.get('/payment/sdds/remitter-list');
    return response.data;
  }catch(error){
    console.log(error.response, "errrrrrrrrrrrr")
    throw new Error(error.response?.data?.message || 'RemitterList Failed');
  }
}

export const getRemitterDetails = async (remitterId) => {
  try{
    const response = await api.get(`/payment/sdds/remitter/${remitterId}`);
    return response.data;
  } catch(error){
    console.log(error.response, "error in getremitterdetails");
    throw new Error(error.response?.data?.message || 'RemitterDetails Failed')
  }
};

export const getCommissionDetails = async (remitterId) => {
  return new Promise((resolve) =>
    setTimeout(() => {
      resolve({
        success: true,
        message: 'Mocked commission details fetched',
        data: {
          perTransaction: '5000.00',
          limitConsumed: '0.00',
          limitAvailable: '25000.00',
        },
      });
    }, 1000)
  );
};
