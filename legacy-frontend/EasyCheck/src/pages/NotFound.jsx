import React from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * NotFoundPage - หน้า 404 เมื่อไม่พบ Route
 * แสดงเมื่อ user พิมพ์ URL ผิดหรือเข้า route ที่ไม่มีอยู่
 */
function NotFoundPage() {
  const navigate = useNavigate();

  const handleGoHome = () => {
    navigate('/', { replace: true });
  };

  const handleGoBack = () => {
    navigate(-1);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-orange-50 via-white to-orange-50">
      <div className="max-w-2xl px-8 py-12 text-center">
        {/* 404 Icon */}
        <div className="mb-8">
          <svg 
            className="w-48 h-48 mx-auto text-brand-primary opacity-80" 
            xmlns="http://www.w3.org/2000/svg" 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={1.5} 
              d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" 
            />
          </svg>
        </div>

        {/* Error Message */}
        <h1 className="mb-4 text-6xl font-bold text-gray-800 font-prompt">404</h1>
        <h2 className="mb-4 text-3xl font-semibold text-gray-700 font-prompt">
          ไม่พบหน้าที่คุณต้องการ
        </h2>
        <p className="mb-8 text-lg text-gray-600 font-prompt">
          ขออภัย เราไม่พบหน้าที่คุณกำลังมองหา<br />
          URL อาจพิมพ์ผิด หรือหน้านี้ถูกย้ายไปแล้ว
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
          <button
            onClick={handleGoBack}
            className="flex items-center justify-center gap-2 px-8 py-3 text-lg font-medium text-gray-700 transition-all duration-300 transform bg-white border-2 border-gray-300 shadow-md rounded-xl font-prompt hover:bg-gray-50 hover:scale-105 active:scale-95"
          >
            <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px" fill="currentColor">
              <path d="M0 0h24v24H0z" fill="none"/>
              <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
            </svg>
            ย้อนกลับ
          </button>
          
          <button
            onClick={handleGoHome}
            className="flex items-center justify-center gap-2 px-8 py-3 text-lg font-medium text-white transition-all duration-300 transform shadow-lg bg-brand-primary rounded-xl font-prompt hover:bg-orange-600 hover:scale-105 active:scale-95"
          >
            <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px" fill="currentColor">
              <path d="M0 0h24v24H0z" fill="none"/>
              <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
            </svg>
            กลับหน้าหลัก
          </button>
        </div>

        {/* Help Text */}
        <p className="mt-8 text-sm text-gray-500 font-prompt">
          หากคุณคิดว่านี่คือข้อผิดพลาด กรุณาติดต่อผู้ดูแลระบบ
        </p>
      </div>
    </div>
  );
}

export default NotFoundPage;
