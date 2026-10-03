import { createContext, useContext, useReducer } from 'react';

const initialState = {
  formData: {
    name: '',
    email: '',
    password: '',
    mobile_number: '',
    role: 'merchant',
    permissions: [],
    employee_access_role_id: '',
    gender: '',
    dob: '',
    address1: '',
    address2: '',
    city: '',
    district: '',
    pincode: '',
    state: '',
    country: '',
    mobile_number_country_code: '+91',
    aadhar_number: '',
    pan_number: '',
    company_or_shop_name: '',
    aadhar_photo: null,
    aadhar_back_photo: null,
    pan_photo: null,
    bank_passbook: null,
    shop_photo: null,
    settlement_type: 'today_settlement', 
  },
  currentStep: 1,
  isCompleted: false,
};

const userCreationReducer = (state, action) => {
  switch (action.type) {
    case 'UPDATE_FORM':
      return {
        ...state,
        formData: { ...state.formData, ...action.payload },
      };
    case 'NEXT_STEP':
      return {
        ...state,
        currentStep: Math.min(state.currentStep + 1, 3),
      };
    case 'PREV_STEP':
      return {
        ...state,
        currentStep: Math.max(state.currentStep - 1, 1),
      };
    case 'RESET':
      return initialState;
    default:
      return state;
  }
};

const UserCreationContext = createContext({
  state: initialState,
  dispatch: () => {},
});

export const UserCreationProvider = ({ children }) => {
  const [state, dispatch] = useReducer(userCreationReducer, initialState);

  return (
    <UserCreationContext.Provider value={{ state, dispatch }}>
      {children}
    </UserCreationContext.Provider>
  );
};

export const useUserCreation = () => {
  const context = useContext(UserCreationContext);
  if (!context) {
    throw new Error('useUserCreation must be used within a UserCreationProvider');
  }
  return context;
};
