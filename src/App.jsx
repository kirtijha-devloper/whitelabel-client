import React, { Suspense, lazy } from 'react';
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

// Simple Loading Component
const Loading = () => (
  <div className="flex items-center justify-center min-h-screen bg-gray-50">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#00D3CD]"></div>
  </div>
);

export default function App() {
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