import React, { memo } from 'react';

/**
 * EmptyState - Optimized empty state component
 * ใช้สำหรับแสดงเมื่อไม่มีข้อมูล
 */
const EmptyState = memo(function EmptyState({ 
  icon = <svg xmlns="http://www.w3.org/2000/svg" className="w-32 h-32 text-gray-300 mx-auto" fill="currentColor" viewBox="0 0 24 24"><path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>,
  title = 'ไม่พบข้อมูล',
  message = 'ยังไม่มีข้อมูลในขณะนี้',
  actionLabel,
  onAction
}) {
  return (
    <div className="flex items-center justify-center min-h-[300px] p-6">
      <div className="text-center max-w-md">
        <div className="mb-4">{icon}</div>
        <h3 className="text-xl font-semibold text-gray-800 mb-2">{title}</h3>
        <p className="text-gray-600 mb-6">{message}</p>
        {actionLabel && onAction && (
          <button
            onClick={onAction}
            className="px-6 py-2 bg-gradient-to-r from-brand-primary to-orange-600 hover:from-orange-700 hover:to-orange-700 text-white rounded-lg transition-all duration-200 font-medium shadow-md hover:shadow-lg transform hover:scale-105"
          >
            {actionLabel}
          </button>
        )}
      </div>
    </div>
  );
});

EmptyState.displayName = 'EmptyState';

export default EmptyState;
