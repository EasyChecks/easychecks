import React from 'react';

export default function ErrorDialog({ isOpen, message, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4 z-50 shadow-xl">
        <div className="text-center">
          <div className="mb-4 flex justify-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-10 h-10 text-red-600" viewBox="0 0 24 24" fill="currentColor">
                <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
              </svg>
            </div>
          </div>
          <h3 className="text-xl font-bold text-gray-800 mb-2">เกิดข้อผิดพลาด</h3>
          <p className="text-gray-600 mb-6 whitespace-pre-line">{message}</p>
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors duration-200 w-full"
          >
            ตรวจสอบแล้ว
          </button>
        </div>
      </div>
    </div>
  );
}
