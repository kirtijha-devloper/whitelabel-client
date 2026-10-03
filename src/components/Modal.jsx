import React from 'react';
import { X } from "lucide-react";

const Modal = ({ isOpen, onClose, title, children, className = "" }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className={`bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] shadow-2xl transform transition-all duration-300 scale-100 overflow-hidden ${className}`}>
        <div className="sticky top-0 z-20 border-b border-gray-100 bg-white px-6 py-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold text-gray-800">{title}</h2>
            <button
              onClick={onClose}
              aria-label="Close modal"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
            >
              <X size={18} strokeWidth={2.25} />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto max-h-[calc(90vh-4rem)] px-6 py-4">
          {children}
        </div>
      </div>
    </div>
  );
};

export default Modal;
