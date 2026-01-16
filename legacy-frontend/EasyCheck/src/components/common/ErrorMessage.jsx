import React, { memo } from 'react';

/**
 * ErrorMessage - Optimized error display component
 * ใช้ React.memo เพราะ error messages ไม่เปลี่ยนบ่อย
 */
const ErrorMessage = memo(function ErrorMessage({ 
  title = 'เกิดข้อผิดพลาด',
  message,
  onRetry,
  icon = <svg xmlns="http://www.w3.org/2000/svg" className="w-16 h-16 text-amber-500" viewBox="0 0 24 24" fill="currentColor"><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/></svg>
}) {
  return (
    <div className="flex items-center justify-center min-h-[200px] p-6">
      <div className="text-center max-w-md">
        <div className="text-6xl mb-4">{icon}</div>
        <h3 className="text-xl font-semibold text-gray-800 mb-2">{title}</h3>
        <p className="text-gray-600 mb-6">{message}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="px-6 py-2 bg-brand-primary hover:bg-orange-600 text-white rounded-lg transition-colors duration-200 font-medium"
          >
            ลองอีกครั้ง
          </button>
        )}
      </div>
    </div>
  );
});

ErrorMessage.displayName = 'ErrorMessage';

export default ErrorMessage;
