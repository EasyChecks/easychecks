import React, { memo } from 'react';

/**
 * CsvImportModal - Modal สำหรับแสดง preview ข้อมูล CSV ก่อนนำเข้า
 * ใช้ร่วมกับ AdminManageUser
 * Optimized with React.memo to prevent unnecessary re-renders
 */
const CsvImportModal = memo(function CsvImportModal({ 
  isOpen, 
  csvData, 
  generateEmployeeId,
  onConfirm, 
  onClose 
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-sm max-w-6xl w-full max-h-[90vh] overflow-hidden">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-brand-primary to-orange-600 text-white p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              อัพโหลดไฟล์ CSV
            </h2>
            <button
              onClick={onClose}
              className="text-white hover:bg-white hover:bg-opacity-20 rounded-lg p-2 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <p className="text-orange-100 mt-2">ตรวจสอบข้อมูลก่อนนำเข้าระบบ</p>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          <div className="mb-4 bg-orange-50 border border-orange-200 rounded-lg p-4">
            <p className="text-sm text-orange-800">
              <span className="font-semibold flex items-center gap-2">
                <svg className="w-4 h-4 fill-brand-primary" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm-1 16H9v-2h4v2zm3-4H9v-2h7v2z"/>
                </svg>
                จำนวนข้อมูล:
              </span> {csvData.length} รายการ
            </p>
            <p className="text-sm text-brand-primary mt-1">
              กรุณาตรวจสอบข้อมูลให้ถูกต้องก่อนยืนยันการนำเข้า
            </p>
          </div>

          {/* CSV Data Preview Table */}
          <div className="overflow-x-auto border border-gray-300 rounded-lg">
            <table className="w-full min-w-max border-collapse text-xs">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-300 px-3 py-2 text-left text-xs font-semibold whitespace-nowrap">#</th>
                  <th className="border border-gray-300 px-3 py-2 text-left text-xs font-semibold whitespace-nowrap">รหัสพนักงาน (Auto)</th>
                  <th className="border border-gray-300 px-3 py-2 text-left text-xs font-semibold whitespace-nowrap">คำนำหน้า</th>
                  <th className="border border-gray-300 px-3 py-2 text-left text-xs font-semibold whitespace-nowrap">ชื่อ-นามสกุล</th>
                  <th className="border border-gray-300 px-3 py-2 text-left text-xs font-semibold whitespace-nowrap">อีเมล</th>
                  <th className="border border-gray-300 px-3 py-2 text-left text-xs font-semibold whitespace-nowrap">บทบาท</th>
                  <th className="border border-gray-300 px-3 py-2 text-left text-xs font-semibold whitespace-nowrap">สถานะ</th>
                  <th className="border border-gray-300 px-3 py-2 text-left text-xs font-semibold whitespace-nowrap">เบอร์โทร</th>
                  <th className="border border-gray-300 px-3 py-2 text-left text-xs font-semibold whitespace-nowrap">แผนก</th>
                  <th className="border border-gray-300 px-3 py-2 text-left text-xs font-semibold whitespace-nowrap">ตำแหน่ง</th>
                  <th className="border border-gray-300 px-3 py-2 text-left text-xs font-semibold whitespace-nowrap">วันเกิด</th>
                  <th className="border border-gray-300 px-3 py-2 text-left text-xs font-semibold whitespace-nowrap">เลขบัตรประชาชน</th>
                  <th className="border border-gray-300 px-3 py-2 text-left text-xs font-semibold whitespace-nowrap">กรุ๊ปเลือด</th>
                  <th className="border border-gray-300 px-3 py-2 text-left text-xs font-semibold whitespace-nowrap">เงินเดือน</th>
                  <th className="border border-gray-300 px-3 py-2 text-left text-xs font-semibold whitespace-nowrap">ที่อยู่</th>
                  <th className="border border-gray-300 px-3 py-2 text-left text-xs font-semibold whitespace-nowrap">ผู้ติดต่อฉุกเฉิน</th>
                  <th className="border border-gray-300 px-3 py-2 text-left text-xs font-semibold whitespace-nowrap">เบอร์ฉุกเฉิน</th>
                  <th className="border border-gray-300 px-3 py-2 text-left text-xs font-semibold whitespace-nowrap">ความสัมพันธ์</th>
                  <th className="border border-gray-300 px-3 py-2 text-left text-xs font-semibold whitespace-nowrap">วันเริ่มงาน</th>
                  <th className="border border-gray-300 px-3 py-2 text-left text-xs font-semibold whitespace-nowrap">จังหวัด</th>
                  <th className="border border-gray-300 px-3 py-2 text-left text-xs font-semibold whitespace-nowrap">สาขา</th>
                  <th className="border border-gray-300 px-3 py-2 text-left text-xs font-semibold whitespace-nowrap">เลขประกันสังคม</th>
                  <th className="border border-gray-300 px-3 py-2 text-left text-xs font-semibold whitespace-nowrap">กองทุนสำรองเลี้ยงชีพ</th>
                  <th className="border border-gray-300 px-3 py-2 text-left text-xs font-semibold whitespace-nowrap">ประกันสุขภาพ</th>
                  <th className="border border-gray-300 px-3 py-2 text-left text-xs font-semibold whitespace-nowrap">การศึกษา</th>
                  <th className="border border-gray-300 px-3 py-2 text-left text-xs font-semibold whitespace-nowrap">ประวัติการทำงาน</th>
                  <th className="border border-gray-300 px-3 py-2 text-left text-xs font-semibold whitespace-nowrap">ทักษะ</th>
                </tr>
              </thead>
              <tbody>
                {csvData.map((row, index) => {
                  const provinceCode = (row.provinceCode || 'BKK').toUpperCase().slice(0, 3);
                  const branchCode = (row.branchCode || '101').slice(0, 3);
                  const previewEmployeeId = generateEmployeeId(provinceCode, branchCode);

                  return (
                    <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="border border-gray-300 px-3 py-2 text-center whitespace-nowrap">{index + 1}</td>
                      <td className="border border-gray-300 px-3 py-2 whitespace-nowrap">
                        <span className="font-semibold text-brand-primary">{previewEmployeeId}</span>
                      </td>
                      <td className="border border-gray-300 px-3 py-2 whitespace-nowrap">{row.titlePrefix || 'นาย'}</td>
                      <td className="border border-gray-300 px-3 py-2 whitespace-nowrap">{row.name || ''}</td>
                      <td className="border border-gray-300 px-3 py-2 text-xs whitespace-nowrap">{row.email || ''}</td>
                      <td className="border border-gray-300 px-3 py-2 whitespace-nowrap">
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                          row.role === 'admin' ? 'bg-orange-50 text-orange-700' :
                          row.role === 'superadmin' ? 'bg-red-100 text-red-700' :
                          row.role === 'manager' ? 'bg-blue-100 text-blue-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {row.role === 'admin' ? 'Admin' : 
                           row.role === 'superadmin' ? 'Super Admin' :
                           row.role === 'manager' ? 'Manager' : 
                           'User'}
                        </span>
                      </td>
                      <td className="border border-gray-300 px-3 py-2 whitespace-nowrap">{row.status || ''}</td>
                      <td className="border border-gray-300 px-3 py-2 whitespace-nowrap">{row.phone || ''}</td>
                      <td className="border border-gray-300 px-3 py-2 whitespace-nowrap">{row.department || ''}</td>
                      <td className="border border-gray-300 px-3 py-2 whitespace-nowrap">{row.position || ''}</td>
                      <td className="border border-gray-300 px-3 py-2 whitespace-nowrap">{row.birthDate || ''}</td>
                      <td className="border border-gray-300 px-3 py-2 whitespace-nowrap">{row.nationalId || ''}</td>
                      <td className="border border-gray-300 px-3 py-2 text-center whitespace-nowrap">{row.bloodType || ''}</td>
                      <td className="border border-gray-300 px-3 py-2 text-right whitespace-nowrap">{row.salary || ''}</td>
                      <td className="border border-gray-300 px-3 py-2 whitespace-nowrap max-w-xs overflow-hidden text-ellipsis">{row.address || ''}</td>
                      <td className="border border-gray-300 px-3 py-2 whitespace-nowrap">{row.emergencyContactName || ''}</td>
                      <td className="border border-gray-300 px-3 py-2 whitespace-nowrap">{row.emergencyContactPhone || ''}</td>
                      <td className="border border-gray-300 px-3 py-2 whitespace-nowrap">{row.emergencyContactRelation || ''}</td>
                      <td className="border border-gray-300 px-3 py-2 whitespace-nowrap">{row.startDate || ''}</td>
                      <td className="border border-gray-300 px-3 py-2 whitespace-nowrap">{row.provinceCode || ''}</td>
                      <td className="border border-gray-300 px-3 py-2 whitespace-nowrap">{row.branchCode || ''}</td>
                      <td className="border border-gray-300 px-3 py-2 whitespace-nowrap">{row.socialSecurityNumber || ''}</td>
                      <td className="border border-gray-300 px-3 py-2 whitespace-nowrap">{row.providentFund || ''}</td>
                      <td className="border border-gray-300 px-3 py-2 whitespace-nowrap">{row.groupHealthInsurance || ''}</td>
                      <td className="border border-gray-300 px-3 py-2 whitespace-nowrap max-w-md overflow-hidden text-ellipsis">{row.education || ''}</td>
                      <td className="border border-gray-300 px-3 py-2 whitespace-nowrap max-w-md overflow-hidden text-ellipsis">{row.workHistory || ''}</td>
                      <td className="border border-gray-300 px-3 py-2 whitespace-nowrap max-w-xs overflow-hidden text-ellipsis">{row.skills || ''}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* CSV Format Example */}
          <div className="mt-6 bg-gray-50 border border-gray-200 rounded-lg p-4">
            <h3 className="font-semibold text-gray-700 mb-2 flex items-center gap-2">
              <svg className="w-4 h-4 fill-brand-primary" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z"/>
              </svg>
              ตัวอย่างรูปแบบไฟล์ CSV:
            </h3>
            <div className="bg-white border border-gray-300 rounded p-3 text-xs overflow-x-auto">
              <code className="text-gray-800">
                titlePrefix,name,email,provinceCode,branchCode,role,department,position,nationalId,phone,skills<br/>
                นาย,สมชาย ใจดี,somchai@email.com,BKK,101,user,IT,Developer,1234567890123,081-234-5678,"JavaScript|React"<br/>
                นางสาว,สมหญิง สวย,somying@email.com,BKK,101,admin,HR,HR Manager,9876543210987,082-345-6789,"HR|Recruitment"
              </code>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="bg-gray-50 px-6 py-4 flex justify-end gap-3 border-t">
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl transition-colors font-medium"
          >
            ยกเลิก
          </button>
          <button
            onClick={onConfirm}
            className="px-6 py-2.5 bg-gradient-to-r from-brand-primary to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white rounded-xl shadow-sm hover:shadow-sm transition-all font-medium"
          >
            ยืนยันนำเข้า ({csvData.length} รายการ)
          </button>
        </div>
      </div>
    </div>
  );
});

CsvImportModal.displayName = 'CsvImportModal';

export default CsvImportModal;
