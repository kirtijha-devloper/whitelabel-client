import { useState, useEffect } from 'react';
import { getAuthToken, removeAuthToken } from '../utils/auth';

export const useAuth = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userRole, setUserRole] = useState(null);

  useEffect(() => {
    const token = getAuthToken();
    if (token) {
        setIsAuthenticated(true);
        const user = mockUsers.find(u => u.token === token);
        if (user) {
          setUserRole({
            isAdmin: user.isAdmin,
            isFranchise: user.isFranchise,
            isMerchant: user.isMerchant,
          });
        }
      }
  }, []);

  const logout = () => {
    removeAuthToken();
    setIsAuthenticated(false);
    setUserRole(null)
  };

  return { isAuthenticated,userRole, logout };
};

export const mockUsers = [
  { id: 1, name: "John Admin", email: "john@admin.com", password: "pass123", isAdmin: true, isFranchise: false, isMerchant: false, token:"token-john123" },
  { id: 2, name: "Alice Franchise", email: "alice@franchise.com", password: "pass123", isAdmin: false, isFranchise: true, isMerchant: false, token:"token-alice123" },
  { id: 3, name: "Bob Merchant", email: "bob@merchant.com", password: "pass123", isAdmin: false, isFranchise: false, isMerchant: true },
  { id: 4, name: "Emma Admin", email: "emma@admin.com", password: "pass123", isAdmin: true, isFranchise: false, isMerchant: false },
  { id: 5, name: "Mike Franchise", email: "mike@franchise.com", password: "pass123", isAdmin: false, isFranchise: true, isMerchant: false },
  { id: 6, name: "Sarah Merchant", email: "sarah@merchant.com", password: "pass123", isAdmin: false, isFranchise: false, isMerchant: true },
  { id: 7, name: "Tom Admin", email: "tom@admin.com", password: "pass123", isAdmin: true, isFranchise: false, isMerchant: false },
  { id: 8, name: "Lisa Franchise", email: "lisa@franchise.com", password: "pass123", isAdmin: false, isFranchise: true, isMerchant: false },
  { id: 9, name: "Peter Merchant", email: "peter@merchant.com", password: "pass123", isAdmin: false, isFranchise: false, isMerchant: true },
  { id: 10, name: "Kate Admin", email: "kate@admin.com", password: "pass123", isAdmin: true, isFranchise: false, isMerchant: false },
];
