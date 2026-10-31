import React, { Suspense, lazy, useEffect } from 'react';
import './App.css';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Lazy Load Pages & Layouts
const Login = lazy(() => import('./Pages/Auth/Login'));
const Signup = lazy(() => import('./Pages/Auth/Signup'));
const AdminLayout = lazy(() => import('./layouts/AdminLayout'));
const SuperFranchiseLayout = lazy(() => import('./layouts/SuperFranchiseLayout'));
const FranchiseLayout = lazy(() => import('./layouts/FranchiseLayout'));
const MerchantLayout = lazy(() => import('./layouts/MerchantLayout'));
const Logout = lazy(() => import('./Pages/Logout'));
import ananyaPayFavicon from './assets/favicon-96x96.png';
import abheePayFavicon from './assets/FORMAT-PNG.png';
import { getLogo } from './api/logoApi';

// Simple Loading Component
const Loading = () => (
  <div className="flex items-center justify-center min-h-screen bg-gray-50">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#00D3CD]"></div>
  </div>
);

export default function App() {
  const isAnanyaPay =
    typeof window !== 'undefined' &&
    (window.location.hostname.toLowerCase().includes("ananyapay"));

  useEffect(() => {

    const fetchLogo = async () => {
      try {
        const response = await getLogo();
        console.log('Fetched logo response:', response);
        const faviconUrl = response.logo ? response.logo : abheePayFavicon;
        if (response.company_name) {
          document.title = response.company_name;
        } else {
          document.title = "ABHEEPAY";
        }

        // Recreate/replace the link element to force modern browsers to redraw the title bar tab icon
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
        document.title = "ABHEEPAY";
      }
    }


    fetchLogo();
  }, [isAnanyaPay]);

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