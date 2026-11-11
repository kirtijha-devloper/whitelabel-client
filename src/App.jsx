import React, { Suspense, lazy, useEffect } from 'react';
import './App.css';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useQueryClient } from '@tanstack/react-query';
import { resolveThemeBundle, applyThemeBundle } from './utils/theme';

// Lazy Load Pages & Layouts
const Login = lazy(() => import('./Pages/Auth/Login'));
const Signup = lazy(() => import('./Pages/Auth/Signup'));
const AdminLayout = lazy(() => import('./layouts/AdminLayout'));
const SuperFranchiseLayout = lazy(() => import('./layouts/SuperFranchiseLayout'));
const FranchiseLayout = lazy(() => import('./layouts/FranchiseLayout'));
const MerchantLayout = lazy(() => import('./layouts/MerchantLayout'));
const Logout = lazy(() => import('./Pages/Logout'));
const PGPaymentReturn = lazy(() => import('./Pages/PGPaymentReturn'));
import abheePayFavicon from './assets/FORMAT-3D-4.jpg';
import { getLogo } from './api/logoApi';

// Simple Loading Component
const Loading = () => (
  <div className="flex items-center justify-center min-h-screen bg-gray-50">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#00D3CD]"></div>
  </div>
);

export default function App() {
  const host_name = window.location;
  const queryClient = useQueryClient();

  useEffect(() => {
    const fetchLogo = async () => {
      const currentUser = queryClient.getQueryData(["currentUser"]);
      try {
        const response = await getLogo({ hostname: host_name });
        const themeBundle = resolveThemeBundle({
          apiTheme: response?.theme_colors || response?.theme || response?.colors || currentUser?.company?.theme_colors || currentUser?.company?.theme,
          currentUser,
          hostname: window.location.hostname,
        });
        applyThemeBundle(themeBundle);

        console.log('Fetched logo response:', response);
        const faviconUrl = response.logo ? response.logo : abheePayFavicon;
        if (response.company_name) {
          document.title = response.company_name;
        } else {
          document.title = "ABHEEPAY";
        }

        const existingIcon = document.getElementById("icon") || document.querySelector("link[rel*='icon']");
        const newIcon = document.createElement("link");
        newIcon.id = "icon";
        newIcon.rel = "icon";
        newIcon.type = "image/png";
        newIcon.href = `${faviconUrl}?v=${Date.now()}`;

        if (existingIcon && existingIcon.parentNode) {
          existingIcon.parentNode.replaceChild(newIcon, existingIcon);
        } else {
          document.head.appendChild(newIcon);
        }
      } catch (error) {
        console.error('Error fetching logo:', error);
        const fallbackUser = queryClient.getQueryData(["currentUser"]);
        applyThemeBundle(
          resolveThemeBundle({
            apiTheme: fallbackUser?.company?.theme_colors || fallbackUser?.company?.theme,
            currentUser: fallbackUser,
            hostname: window.location.hostname,
          })
        );

        const newIcon = document.createElement("link");
        newIcon.id = "icon";
        newIcon.rel = "icon";
        newIcon.type = "image/png";
        newIcon.href = `${abheePayFavicon}?v=${Date.now()}`;
        document.head.appendChild(newIcon);
        document.title = "ABHEEPAY";
      }
    };

    fetchLogo();
  }, [host_name, queryClient]);

  // ✅ Ab yeh doosra useEffect bilkul ALAG bahar hai:
  useEffect(() => {
    const applyFromUserCache = () => {
      const currentUser = queryClient.getQueryData(["currentUser"]);
      const bundle = resolveThemeBundle({
        apiTheme: currentUser?.company?.theme_colors || currentUser?.company?.theme,
        currentUser,
        hostname: window.location.hostname,
      });
      applyThemeBundle(bundle);
    };

    applyFromUserCache();
    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      if (event?.query?.queryKey?.[0] === "currentUser") {
        applyFromUserCache();
      }
    });
    return () => unsubscribe();
  }, [queryClient]);

  return (
    <Router>
      <ToastContainer />
      <Suspense fallback={<Loading />}>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/logout" element={<Logout />} />
          <Route path="/pg/payment-return" element={<PGPaymentReturn />} />

          {/* Admin Routes */}
          <Route path="/admin/*" element={<AdminLayout />} />
          {/* Super admin routes */}
          <Route path="/super-admin/*" element={<AdminLayout />} />

          {/* Super Franchise Routes */}
          <Route path="/super-franchise/*" element={<SuperFranchiseLayout />} />

          {/* Franchise Routes */}
          <Route path="/franchise/*" element={<FranchiseLayout />} />

          {/* Merchant Routes */}
          <Route path="/merchant/*" element={<MerchantLayout />} />
        </Routes>
      </Suspense>
    </Router>
  );
}