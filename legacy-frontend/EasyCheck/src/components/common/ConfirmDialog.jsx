import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';

const ConfirmDialog = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title, 
  message, 
  confirmText = 'ตกลง', 
  cancelText = 'ยกเลิก',
  type = 'info' // 'info', 'success', 'warning', 'danger'
}) => {
  if (!isOpen) return null;

  const getIconAndColor = () => {
    switch(type) {
      case 'success':
        return {
          icon: (
            <svg className="w-12 h-12 sm:w-16 sm:h-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ),
          color: 'text-green-500',
          bgColor: 'from-green-50 to-emerald-50',
          buttonColor: 'from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700'
        };
      case 'warning':
        return {
          icon: (
            <svg className="w-12 h-12 sm:w-16 sm:h-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          ),
          color: 'text-yellow-500',
          bgColor: 'from-yellow-50 to-amber-50',
          buttonColor: 'from-yellow-500 to-amber-600 hover:from-yellow-600 hover:to-amber-700'
        };
      case 'danger':
        return {
          icon: (
            <svg className="w-12 h-12 sm:w-16 sm:h-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ),
          color: 'text-red-500',
          bgColor: 'from-red-50 to-orange-50',
          buttonColor: 'from-brand-primary to-orange-600 hover:from-orange-600 hover:to-orange-700'
        };
      default:
        return {
          icon: (
            <svg className="w-12 h-12 sm:w-16 sm:h-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ),
          color: 'text-brand-primary',
          bgColor: 'from-orange-50 to-amber-50',
          buttonColor: 'from-brand-primary to-orange-600 hover:from-orange-700 hover:to-orange-700'
        };
    }
  };

  const { icon, color, bgColor, buttonColor } = getIconAndColor();

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // close on Escape
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const dialog = (
    <div 
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fadeIn"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl max-w-md w-full transform transition-all animate-scaleIn">
        {/* Icon Section */}
        <div className={`bg-gradient-to-br ${bgColor} px-6 py-8 sm:px-8 sm:py-10 rounded-t-2xl sm:rounded-t-3xl`}>
          <div className={`${color} mx-auto w-fit`}>
            {icon}
          </div>
        </div>

        {/* Content Section */}
        <div className="px-6 py-6 sm:px-8 sm:py-8">
          <h3 className="text-lg sm:text-xl font-bold text-gray-800 mb-3 sm:mb-4 text-center">
            {title}
          </h3>
          <p className="text-sm sm:text-base text-gray-600 text-center leading-relaxed">
            {message}
          </p>
        </div>

        {/* Button Section */}
        <div className="px-6 pb-6 sm:px-8 sm:pb-8 flex gap-3 sm:gap-4">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 sm:px-6 sm:py-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl sm:rounded-2xl transition-all duration-200 text-sm sm:text-base"
          >
            {cancelText}
          </button>
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={`flex-1 px-4 py-3 sm:px-6 sm:py-4 bg-gradient-to-r ${buttonColor} text-white font-semibold rounded-xl sm:rounded-2xl transition-all duration-200 transform hover:scale-105 shadow-lg text-sm sm:text-base`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );

  if (typeof document !== 'undefined') {
    return createPortal(dialog, document.body);
  }

  return dialog;

};

export default ConfirmDialog;
