import React, { memo } from 'react';

/**
 * LoadingSpinner - Optimized loading component
 * ใช้ React.memo เพื่อป้องกัน re-render ที่ไม่จำเป็น
 */
const LoadingSpinner = memo(function LoadingSpinner({ size = 'md', text = 'กำลังโหลด...' }) {
  // Size variants
  const sizeClasses = {
    sm: 'w-6 h-6',
    md: 'w-12 h-12',
    lg: 'w-16 h-16',
    xl: 'w-24 h-24'
  };

  const textSizeClasses = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
    xl: 'text-xl'
  };

  return (
    <div className="flex items-center justify-center min-h-[200px]">
      <div className="text-center">
        <div 
          className={`${sizeClasses[size]} mx-auto mb-4 border-b-2 border-brand-primary rounded-full animate-spin`}
          aria-label="Loading"
          role="status"
        />
        <p className={`${textSizeClasses[size]} text-gray-600`}>{text}</p>
      </div>
    </div>
  );
});

LoadingSpinner.displayName = 'LoadingSpinner';

export default LoadingSpinner;
