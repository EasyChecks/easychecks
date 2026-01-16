import React from 'react';

/**
 * ErrorBoundary - Component สำหรับจัดการ Error ที่เกิดขึ้นใน React Tree
 * ป้องกันไม่ให้ error ทำให้ทั้งแอพพลิเคชัน crash
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError() {
    // Update state so the next render will show the fallback UI
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Log error to console for debugging
    console.error('🔥 Error Boundary caught an error:', error, errorInfo);
    
    // You can also log the error to an error reporting service
    this.setState({
      error,
      errorInfo
    });
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });
    // Reload the page to reset the app state
    window.location.href = '/';
  };

  handleReload = () => {
    window.location.reload();
  };

  handleClearAndReset = () => {
    // ล้างข้อมูล localStorage ทั้งหมด
    console.log('🗑️ Clearing localStorage...');
    localStorage.clear();
    // รีเซ็ตแอพ
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-red-50 via-white to-red-50">
          <div className="max-w-2xl px-8 py-12 text-center">
            {/* Error Icon */}
            <div className="mb-8">
              <svg 
                className="w-48 h-48 mx-auto text-red-500 opacity-80" 
                xmlns="http://www.w3.org/2000/svg" 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={1.5} 
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" 
                />
              </svg>
            </div>

            {/* Error Message */}
            <h1 className="mb-4 text-5xl font-bold text-gray-800 font-prompt">เกิดข้อผิดพลาด!</h1>
            <h2 className="mb-4 text-2xl font-semibold text-gray-700 font-prompt">
              ระบบเกิดข้อผิดพลาดที่ไม่คาดคิด
            </h2>
            <p className="mb-6 text-lg text-gray-600 font-prompt">
              ขออภัยในความไม่สะดวก<br />
              กรุณาลองรีเฟรชหน้านี้หรือกลับไปหน้าหลัก
            </p>

            {/* Error Details (Development Mode) */}
            {import.meta.env.DEV && this.state.error && (
              <details className="mb-8 text-left">
                <summary className="px-4 py-2 text-sm font-semibold text-white cursor-pointer bg-red-500 rounded-lg hover:bg-red-600">
                  🔍 รายละเอียดข้อผิดพลาด (Development Mode)
                </summary>
                <div className="p-4 mt-2 overflow-auto text-xs text-left bg-gray-900 rounded-lg max-h-64">
                  <div className="mb-4">
                    <p className="mb-2 font-semibold text-red-400">Error:</p>
                    <pre className="text-red-300">{this.state.error.toString()}</pre>
                  </div>
                  {this.state.errorInfo && (
                    <div>
                      <p className="mb-2 font-semibold text-yellow-400">Component Stack:</p>
                      <pre className="text-yellow-200">{this.state.errorInfo.componentStack}</pre>
                    </div>
                  )}
                </div>
              </details>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
              <button
                onClick={this.handleReload}
                className="flex items-center justify-center gap-2 px-8 py-3 text-lg font-medium text-gray-700 transition-all duration-300 transform bg-white border-2 border-gray-300 shadow-md rounded-xl font-prompt hover:bg-gray-50 hover:scale-105 active:scale-95"
              >
                <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px" fill="currentColor">
                  <path d="M0 0h24v24H0z" fill="none"/>
                  <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
                </svg>
                รีเฟรชหน้า
              </button>
              
              <button
                onClick={this.handleClearAndReset}
                className="flex items-center justify-center gap-2 px-8 py-3 text-lg font-medium text-white transition-all duration-300 transform bg-red-500 shadow-lg rounded-xl font-prompt hover:bg-red-600 hover:scale-105 active:scale-95"
              >
                <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px" fill="currentColor">
                  <path d="M0 0h24v24H0z" fill="none"/>
                  <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                </svg>
                ล้างข้อมูลและรีเซ็ต
              </button>
              
              <button
                onClick={this.handleReset}
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
              หากปัญหายังคงอยู่ กรุณาติดต่อผู้ดูแลระบบพร้อมแจ้งรายละเอียดข้อผิดพลาด
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
