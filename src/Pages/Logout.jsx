import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut, AlertTriangle, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { logoutCurrentSession } from "../utils/auth";

const Logout = () => {
  const navigate = useNavigate();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = () => {
    setIsLoggingOut(true);
    // Simulate a slight delay for better UX (optional)
    setTimeout(() => {
      logoutCurrentSession();
      setIsLoggingOut(false);
      navigate("/login");
    }, 500);
  };

  const openModal = () => setIsModalOpen(true);
  const closeModal = () => setIsModalOpen(false);


  return (
    <>
      {/* Logout Trigger */}
      <motion.div
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={openModal}
        className="flex items-center gap-2 cursor-pointer text-red-500 hover:text-red-700 transition-colors duration-200"
      >
        <LogOut size={20} />
        <span className="font-medium">Logout</span>
      </motion.div>

      {/* Confirmation Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-gray-800 bg-opacity-75 flex items-center justify-center z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.2 }}
            className="bg-white p-6 rounded-xl shadow-lg w-full max-w-md"
          >
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="text-yellow-500" size={24} />
              <h2 className="text-xl font-semibold text-gray-900">Confirm Logout</h2>
            </div>
            <p className="text-gray-600 mb-6">
              Are you sure you want to log out? You’ll need to sign in again to access your account.
            </p>
            <div className="flex justify-end gap-4">
              <button
                onClick={closeModal}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors duration-200"
              >
                Cancel
              </button>
              <button
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors duration-200 flex items-center gap-2 disabled:opacity-50"
              >
                {isLoggingOut ? (
                  <>
                    <Loader2 className="animate-spin" size={16} />
                    Logging Out...
                  </>
                ) : (
                  <>
                    <LogOut size={16} />
                    Logout
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </>
  );
};

export default Logout;
