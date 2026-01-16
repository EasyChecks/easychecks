import React, { useEffect } from 'react';

const SuccessDialog = ({ 
  isOpen, 
  onClose, 
  title = 'สำเร็จ!',
  message,
  autoClose = true,
  autoCloseDelay = 2000
}) => {
  useEffect(() => {
    if (isOpen && autoClose) {
      const timer = setTimeout(() => {
        onClose();
      }, autoCloseDelay);

      return () => clearTimeout(timer);
    }
  }, [isOpen, autoClose, autoCloseDelay, onClose]);

  if (!isOpen) return null;

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl max-w-md w-full transform transition-all animate-scaleIn">
        {/* Success Icon Section */}
        <div className="bg-gradient-to-br from-green-50 to-emerald-50 px-6 py-8 sm:px-8 sm:py-10 rounded-t-2xl sm:rounded-t-3xl">
          <div className="mx-auto w-fit">
            <div className="relative">
              <div className="absolute inset-0 bg-green-500 rounded-full animate-ping opacity-20"></div>
              <div className="relative bg-green-500 rounded-full p-3 sm:p-4">
                <svg className="w-12 h-12 sm:w-16 sm:h-16 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Content Section */}
        <div className="px-6 py-6 sm:px-8 sm:py-8 text-center">
          <h3 className="text-lg sm:text-xl font-bold text-gray-800 mb-3 sm:mb-4">
            {title}
          </h3>
          <p className="text-sm sm:text-base text-gray-600 leading-relaxed">
            {message}
          </p>
        </div>

        {/* Optional Close Button */}
        {!autoClose && (
          <div className="px-6 pb-6 sm:px-8 sm:pb-8">
            <button
              onClick={onClose}
              className="w-full px-4 py-3 sm:px-6 sm:py-4 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-semibold rounded-xl sm:rounded-2xl transition-all duration-200 transform hover:scale-105 shadow-lg text-sm sm:text-base"
            >
              ตกลง
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default SuccessDialog;
