import React, { useState, useRef, useEffect } from 'react';

const CustomDatePicker = ({ 
  value, 
  onChange, 
  minDate, 
  label, 
  required = false,
  error = null,
  clearError = () => {}
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const pickerRef = useRef(null);

  // Parse value to Date object
  const selectedDate = value ? new Date(value + 'T00:00:00') : null;

  // Close picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Format date for display (dd/mm/yyyy)
  const formatDisplayDate = (date) => {
    if (!date) return '';
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  };

  // Format date for value (yyyy-mm-dd)
  const formatValueDate = (date) => {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Get days in month
  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];
    
    // Add empty cells for days before month starts
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    
    // Add all days in month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day));
    }
    
    return days;
  };

  // Check if date is disabled
  const isDateDisabled = (date) => {
    if (!date || !minDate) return false;
    const min = new Date(minDate + 'T00:00:00');
    const check = new Date(date);
    check.setHours(0, 0, 0, 0);
    min.setHours(0, 0, 0, 0);
    return check < min;
  };

  // Check if date is selected
  const isDateSelected = (date) => {
    if (!date || !selectedDate) return false;
    return date.toDateString() === selectedDate.toDateString();
  };

  // Check if date is today
  const isToday = (date) => {
    if (!date) return false;
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  // Handle date selection
  const handleDateClick = (date) => {
    if (isDateDisabled(date)) return;
    onChange(formatValueDate(date));
    setIsOpen(false);
    clearError();
  };

  // Navigate months
  const goToPreviousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
  };

  const goToNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
  };

  const goToToday = () => {
    const today = new Date();
    setCurrentMonth(today);
    const todayFormatted = formatValueDate(today);
    
    // Check if today is disabled
    if (!isDateDisabled(today)) {
      onChange(todayFormatted);
      setIsOpen(false);
      clearError();
    }
  };

  const monthNames = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
  
  const dayNames = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];

  const days = getDaysInMonth(currentMonth);

  return (
    <div className="relative" ref={pickerRef}>
      <label className="block text-gray-700 font-semibold text-sm sm:text-base mb-1.5 sm:mb-2">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      
      {/* Input Display */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full px-3 sm:px-4 py-3 sm:py-3.5 lg:py-4 text-left text-base sm:text-lg font-medium border-2 rounded-xl transition-all duration-200 flex items-center justify-between ${
          error 
            ? 'border-red-400 hover:border-red-500 focus:border-red-500' 
            : 'border-gray-300 hover:border-orange-400 focus:border-orange-500'
        } ${isOpen ? 'border-orange-500 shadow-lg' : ''}`}
      >
        <span className={value ? 'text-gray-800' : 'text-gray-400'}>
          {value ? formatDisplayDate(value) : 'เลือกวันที่'}
        </span>
        <svg 
          xmlns="http://www.w3.org/2000/svg" 
          className={`w-5 h-5 sm:w-6 sm:h-6 transition-colors ${isOpen ? 'text-orange-500' : 'text-gray-400'}`}
          fill="currentColor" 
          viewBox="0 0 24 24"
        >
          <path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zm0-12H5V6h14v2z"/>
        </svg>
      </button>

      {/* Validation Error */}
      {error && (
        <div className="flex items-center gap-1.5 mt-1.5 text-red-600">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-xs sm:text-sm font-medium">{error}</span>
        </div>
      )}

      {/* Calendar Dropdown */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border-2 border-orange-400 overflow-hidden animate-slideDown">
            {/* Header */}
            <div className="bg-gradient-to-r from-orange-500 to-orange-600 px-4 py-4">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={goToPreviousMonth}
                  className="p-2.5 hover:bg-white/20 rounded-lg transition-colors active:scale-95"
                >
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                
                <div className="text-white font-bold text-lg sm:text-xl">
                  {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear() + 543}
                </div>
                
                <button
                  type="button"
                  onClick={goToNextMonth}
                  className="p-2.5 hover:bg-white/20 rounded-lg transition-colors active:scale-95"
                >
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Calendar Grid */}
            <div className="p-4 sm:p-5">
              {/* Day Names */}
              <div className="grid grid-cols-7 gap-2 mb-3">
                {dayNames.map((day) => (
                  <div key={day} className="text-center text-sm sm:text-base font-bold text-gray-600 py-2">
                    {day}
                  </div>
                ))}
              </div>

              {/* Days */}
              <div className="grid grid-cols-7 gap-2">
                {days.map((date, index) => {
                  if (!date) {
                    return <div key={`empty-${index}`} />;
                  }

                  const disabled = isDateDisabled(date);
                  const selected = isDateSelected(date);
                  const today = isToday(date);

                  return (
                    <button
                      key={date.toISOString()}
                      type="button"
                      onClick={() => handleDateClick(date)}
                      disabled={disabled}
                      className={`
                        aspect-square rounded-xl text-base sm:text-lg font-semibold transition-all duration-200 min-h-[44px]
                        ${disabled 
                          ? 'bg-gray-100 text-gray-300 cursor-not-allowed opacity-50' 
                          : 'hover:bg-orange-50 hover:scale-105 cursor-pointer active:scale-95'
                        }
                        ${selected && !disabled
                          ? 'bg-gradient-to-br from-orange-500 to-orange-600 text-white shadow-lg scale-105 font-bold ring-2 ring-orange-300' 
                          : today && !disabled
                            ? 'bg-orange-100 text-orange-700 font-bold ring-2 ring-orange-300'
                            : !disabled
                              ? 'text-gray-700 hover:ring-2 hover:ring-orange-200'
                              : ''
                        }
                      `}
                    >
                      {date.getDate()}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-gray-200 px-4 py-4 bg-gray-50 flex justify-between items-center">
              <button
                type="button"
                onClick={() => {
                  onChange('');
                  setIsOpen(false);
                }}
                className="px-4 py-2.5 text-base sm:text-lg text-gray-600 hover:text-gray-800 hover:bg-gray-200 rounded-lg font-medium transition-all active:scale-95"
              >
                ล้างค่า
              </button>
              <button
                type="button"
                onClick={goToToday}
                className="px-4 py-2.5 text-base sm:text-lg text-white bg-orange-600 hover:bg-orange-700 rounded-lg font-bold transition-all shadow-md active:scale-95"
              >
                วันนี้
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomDatePicker;
