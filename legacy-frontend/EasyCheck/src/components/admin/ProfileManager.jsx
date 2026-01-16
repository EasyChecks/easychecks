import React, { useState } from 'react';

/**
 * ProfileManager Component
 * 
 * Inline profile manager for 6 categories:
 * 1. Position (ตำแหน่ง)
 * 2. Department (แผนก)
 * 3. Salary (เงินเดือน)
 * 4. Relationship (ความสัมพันธ์)
 * 5. Education (การศึกษา)
 * 6. Skills (ทักษะ)
 */

const ProfileManager = ({ 
  category, 
  items = [], 
  onAdd, 
  onRemove, 
  onRemoveAll 
}) => {
  const [formData, setFormData] = useState({});

  // Category configurations
  const categoryConfig = {
    position: {
      title: 'ตำแหน่ง',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M6 6V5a3 3 0 013-3h2a3 3 0 013 3v1h2a2 2 0 012 2v3.57A22.952 22.952 0 0110 13a22.95 22.95 0 01-8-1.43V8a2 2 0 012-2h2zm2-1a1 1 0 011-1h2a1 1 0 011 1v1H8V5zm1 5a1 1 0 011-1h.01a1 1 0 110 2H10a1 1 0 01-1-1z" clipRule="evenodd" />
          <path d="M2 13.692V16a2 2 0 002 2h12a2 2 0 002-2v-2.308A24.974 24.974 0 0110 15c-2.796 0-5.487-.46-8-1.308z" />
        </svg>
      ),
      fields: [
        { name: 'title', placeholder: 'ชื่อตำแหน่ง', type: 'text' },
        { name: 'level', placeholder: 'ระดับ (เช่น Senior, Junior)', type: 'text' },
        { name: 'startDate', placeholder: 'วันที่เริ่มต้น', type: 'date' }
      ],
      display: (item) => (
        <>
          <div className="font-medium text-gray-800">{item.title}</div>
          <div className="text-sm text-gray-600">{item.level}</div>
          {item.startDate && <div className="text-xs text-gray-500">เริ่มงาน: {item.startDate}</div>}
        </>
      )
    },
    department: {
      title: 'แผนก',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
        </svg>
      ),
      fields: [
        { name: 'name', placeholder: 'ชื่อแผนก', type: 'text' },
        { name: 'code', placeholder: 'รหัสแผนก', type: 'text' },
        { name: 'manager', placeholder: 'หัวหน้าแผนก', type: 'text' }
      ],
      display: (item) => (
        <>
          <div className="font-medium text-gray-800">{item.name}</div>
          {item.code && <div className="text-sm text-gray-600">รหัส: {item.code}</div>}
          {item.manager && <div className="text-xs text-gray-500">หัวหน้า: {item.manager}</div>}
        </>
      )
    },
    salary: {
      title: 'เงินเดือน',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" />
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clipRule="evenodd" />
        </svg>
      ),
      fields: [
        { name: 'amount', placeholder: 'จำนวนเงิน', type: 'number' },
        { name: 'currency', placeholder: 'สกุลเงิน (THB)', type: 'text' },
        { name: 'effectiveDate', placeholder: 'วันที่มีผล', type: 'date' }
      ],
      display: (item) => (
        <>
          <div className="font-medium text-gray-800">
            {Number(item.amount).toLocaleString()} {item.currency || 'THB'}
          </div>
          {item.effectiveDate && <div className="text-sm text-gray-600">มีผลตั้งแต่: {item.effectiveDate}</div>}
        </>
      )
    },
    relationship: {
      title: 'ความสัมพันธ์',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
        </svg>
      ),
      fields: [
        { name: 'name', placeholder: 'ชื่อ-นามสกุล', type: 'text' },
        { name: 'relation', placeholder: 'ความสัมพันธ์ (บิดา/มารดา/คู่สมรส)', type: 'text' },
        { name: 'phone', placeholder: 'เบอร์โทร', type: 'tel' }
      ],
      display: (item) => (
        <>
          <div className="font-medium text-gray-800">{item.name}</div>
          <div className="text-sm text-gray-600">{item.relation}</div>
          {item.phone && <div className="text-xs text-gray-500">โทร: {item.phone}</div>}
        </>
      )
    },
    education: {
      title: 'การศึกษา',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.356-.257l4-1.714a1 1 0 11.788 1.838L7.667 9.088l1.94.831a1 1 0 00.787 0l7-3a1 1 0 000-1.838l-7-3zM3.31 9.397L5 10.12v4.102a8.969 8.969 0 00-1.05-.174 1 1 0 01-.89-.89 11.115 11.115 0 01.25-3.762zM9.3 16.573A9.026 9.026 0 007 14.935v-3.957l1.818.78a3 3 0 002.364 0l5.508-2.361a11.026 11.026 0 01.25 3.762 1 1 0 01-.89.89 8.968 8.968 0 00-5.35 2.524 1 1 0 01-1.4 0zM6 18a1 1 0 001-1v-2.065a8.935 8.935 0 00-2-.712V17a1 1 0 001 1z" />
        </svg>
      ),
      fields: [
        { name: 'institution', placeholder: 'สถาบัน', type: 'text' },
        { name: 'degree', placeholder: 'คณะ - สาขาวิชา', type: 'text' },
        { name: 'year', placeholder: 'ปีที่จบ', type: 'number' }
      ],
      display: (item) => (
        <>
          <div className="font-medium text-gray-800">{item.degree}</div>
          <div className="text-sm text-gray-600">{item.institution}</div>
          {item.year && <div className="text-xs text-gray-500">จบปี: {item.year}</div>}
        </>
      )
    },
    skills: {
      title: 'ทักษะ',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
        </svg>
      ),
      fields: [
        { name: 'name', placeholder: 'ชื่อทักษะ', type: 'text' },
        { name: 'level', placeholder: 'ระดับ (เริ่มต้น/ปานกลาง/ชำนาญ)', type: 'text' },
        { name: 'years', placeholder: 'ประสบการณ์ (ปี)', type: 'number' }
      ],
      display: (item) => (
        <>
          <div className="font-medium text-gray-800">{item.name}</div>
          <div className="text-sm text-gray-600">{item.level}</div>
          {item.years && <div className="text-xs text-gray-500">ประสบการณ์: {item.years} ปี</div>}
        </>
      )
    }
  };

  const config = categoryConfig[category];
  if (!config) return null;

  const handleAdd = () => {
    const isValid = config.fields.every(field => formData[field.name]);
    if (isValid) {
      onAdd({ ...formData });
      setFormData({});
    }
  };

  const handleInputChange = (fieldName, value) => {
    setFormData(prev => ({ ...prev, [fieldName]: value }));
  };

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
          {config.icon}
          {config.title}
        </h3>
        {items.length > 0 && (
          <button
            type="button"
            onClick={onRemoveAll}
            className="text-sm text-red-500 hover:text-red-700 transition-colors"
          >
            ลบทั้งหมด
          </button>
        )}
      </div>

      {/* Display added items */}
      {items.length > 0 && (
        <div className="mb-4 space-y-2">
          {items.map((item, index) => (
            <div key={index} className="flex items-start gap-3 p-3 bg-orange-50 rounded-lg border border-orange-200">
              <div className="flex-1">
                {config.display(item)}
              </div>
              <button
                type="button"
                onClick={() => onRemove(index)}
                className="text-red-500 hover:text-red-700 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add new item form */}
      <div className="grid grid-cols-1 md:grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3">
        {config.fields.map((field) => (
          <div key={field.name}>
            <input
              type={field.type}
              value={formData[field.name] || ''}
              onChange={(e) => handleInputChange(field.name, e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent text-sm"
              placeholder={field.placeholder}
            />
          </div>
        ))}
        <div className="flex items-end">
          <button
            type="button"
            onClick={handleAdd}
            className="w-full px-4 py-2 bg-gradient-to-r from-brand-primary to-orange-600 text-white rounded-lg hover:shadow-md transition-all flex items-center justify-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
            เพิ่ม
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProfileManager;
