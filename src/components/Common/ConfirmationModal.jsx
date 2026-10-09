import React from "react";
import { AlertTriangle, AlertCircle, CheckCircle2, Info, X, Loader2 } from "lucide-react";

/**
 * Reusable Confirmation Pop-Up Modal synced with AbheePay UI design tokens.
 */
const ConfirmationModal = ({
  isOpen,
  onClose,
  onConfirm,
  title = "Confirm Action",
  message = "Are you sure you want to proceed with this action?",
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "primary", // "primary" | "danger" | "warning" | "success"
  isLoading = false,
}) => {
  if (!isOpen) return null;

  const variantStyles = {
    primary: {
      icon: <Info className="w-6 h-6 text-[#00D3CD]" />,
      iconBg: "bg-[#00D3CD]/10 border border-[#00D3CD]/20",
      buttonBg: "bg-[#00D3CD] hover:bg-[#00bdb7] text-white shadow-sm",
    },
    danger: {
      icon: <AlertCircle className="w-6 h-6 text-rose-600" />,
      iconBg: "bg-rose-50 border border-rose-200",
      buttonBg: "bg-rose-600 hover:bg-rose-700 text-white shadow-sm",
    },
    warning: {
      icon: <AlertTriangle className="w-6 h-6 text-amber-600" />,
      iconBg: "bg-amber-50 border border-amber-200",
      buttonBg: "bg-amber-500 hover:bg-amber-600 text-white shadow-sm",
    },
    success: {
      icon: <CheckCircle2 className="w-6 h-6 text-emerald-600" />,
      iconBg: "bg-emerald-50 border border-emerald-200",
      buttonBg: "bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm",
    },
  };

  const currentVariant = variantStyles[variant] || variantStyles.primary;

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden transform transition-all animate-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${currentVariant.iconBg}`}>
              {currentVariant.icon}
            </div>
            <h3 className="text-base font-bold text-gray-900 leading-tight">
              {title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body Message */}
        <div className="p-5">
          <p className="text-sm text-gray-600 leading-relaxed">
            {message}
          </p>
        </div>

        {/* Footer Buttons */}
        <div className="flex items-center justify-end gap-3 p-4 bg-gray-50/80 border-t border-gray-100">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 text-xs font-semibold text-gray-700 hover:text-gray-900 hover:bg-gray-200/60 rounded-xl transition-colors disabled:opacity-50"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={`inline-flex items-center gap-2 px-5 py-2 text-xs font-semibold rounded-xl transition-all disabled:opacity-50 ${currentVariant.buttonBg}`}
          >
            {isLoading ? <Loader2 size={14} className="animate-spin" /> : null}
            <span>{confirmText}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationModal;

