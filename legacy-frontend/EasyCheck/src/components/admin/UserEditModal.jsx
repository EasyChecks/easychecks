import React, { useEffect } from 'react';
import ProfileManager from './ProfileManager';

const UserEditModal = React.memo(function UserEditModal({ 
  show, 
  editingUser, 
  editForm, 
  currentUser, 
  onClose, 
  onSave, 
  onChange 
}) {
  // ป้องกันการ scroll พื้นหลังเมื่อ modal เปิด
  useEffect(() => {
    if (show) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [show]);

  if (!show || !editingUser) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[70] p-4"
    >
      <div 
        className="bg-white rounded-2xl shadow-sm w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between flex-shrink-0 px-6 py-4 bg-gradient-to-r from-brand-primary to-orange-600">
          <h2 className="flex items-center gap-2 text-xl font-bold text-white">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            แก้ไขข้อมูลผู้ใช้
          </h2>
          <button
            onClick={onClose}
            className="p-1 text-white transition-colors rounded-lg hover:bg-white/20"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 p-6 overflow-y-auto">
          <div className="space-y-6">
            
            {/* ข้อมูลส่วนตัว */}
            <div>
              <h3 className="flex items-center gap-2 mb-4 text-lg font-semibold text-gray-800">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-brand-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                ข้อมูลส่วนตัว
              </h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {/* Profile Image */}
                <div className="md:col-span-2">
                  <label className="block mb-2 text-sm font-medium text-gray-700">
                    รูปโปรไฟล์
                  </label>
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0">
                      <img 
                        src={editForm.profileImage || `https://i.pravatar.cc/100?u=${editingUser.id}`} 
                        alt="profile" 
                        className="object-cover w-24 h-24 border-2 border-gray-200 rounded-lg"
                      />
                    </div>
                    <div className="flex-1 space-y-2">
                      <div className="flex gap-2">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onloadend = () => {
                                onChange({ ...editForm, profileImage: reader.result });
                              };
                              reader.readAsDataURL(file);
                            }
                          }}
                          className="flex-1 px-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-orange-50 file:text-orange-700 hover:file:bg-orange-100"
                        />
                      </div>
                      <p className="text-xs text-gray-500">
                        อัพโหลดไฟล์รูปภาพ (JPG, PNG) หรือกรอก URL ด้านล่าง
                      </p>
                      <input
                        type="text"
                        value={editForm.profileImage || ''}
                        onChange={(e) => onChange({ ...editForm, profileImage: e.target.value })}
                        className="w-full px-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                        placeholder="หรือกรอก URL รูปภาพ (เช่น https://...)"
                      />
                    </div>
                  </div>
                </div>

                {/* Title Prefix */}
                <div className="md:col-span-2">
                  <label className="block mb-1 text-sm font-medium text-gray-700">
                    คำนำหน้า <span className="text-red-500">*</span>
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => onChange({ ...editForm, titlePrefix: 'นาย' })}
                      className={`px-6 py-2 rounded-lg font-medium transition-all ${
                        (editForm.titlePrefix || editingUser.titlePrefix || 'นาย') === 'นาย'
                          ? 'bg-brand-primary text-white shadow-md'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      นาย
                    </button>
                    <button
                      type="button"
                      onClick={() => onChange({ ...editForm, titlePrefix: 'นาง' })}
                      className={`px-6 py-2 rounded-lg font-medium transition-all ${
                        (editForm.titlePrefix || editingUser.titlePrefix || 'นาย') === 'นาง'
                          ? 'bg-brand-primary text-white shadow-md'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      นาง
                    </button>
                    <button
                      type="button"
                      onClick={() => onChange({ ...editForm, titlePrefix: 'นางสาว' })}
                      className={`px-6 py-2 rounded-lg font-medium transition-all ${
                        (editForm.titlePrefix || editingUser.titlePrefix || 'นาย') === 'นางสาว'
                          ? 'bg-brand-primary text-white shadow-md'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      นางสาว
                    </button>
                  </div>
                </div>

                {/* Name */}
                <div>
                  <label className="block mb-1 text-sm font-medium text-gray-700">
                    ชื่อ นามสกุล <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={(editForm.name || editingUser.name || '')
                      .replace(/^(นาย|นาง|นางสาว)\s*/g, '')  // ตัดคำนำหน้าออก
                    }
                    onChange={(e) => onChange({ ...editForm, name: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    placeholder="เช่น สมชาย ใจดี (ไม่ต้องใส่คำนำหน้า)"
                  />
                </div>

                {/* Email */}
                <div>
                  <label className="block mb-1 text-sm font-medium text-gray-700">
                    อีเมล <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    value={editForm.email || editingUser.email || ''}
                    onChange={(e) => onChange({ ...editForm, email: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    placeholder="example@email.com"
                  />
                </div>

                {/* Phone */}
                <div>
                  <label className="block mb-1 text-sm font-medium text-gray-700">
                    เบอร์โทรศัพท์ <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    value={editForm.phone || editingUser.phone || ''}
                    onChange={(e) => onChange({ ...editForm, phone: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    placeholder="081-234-5678"
                  />
                </div>

                {/* Birth Date */}
                <div>
                  <label className="block mb-1 text-sm font-medium text-gray-700">
                    วันเกิด
                  </label>
                  <input
                    type="date"
                    value={editForm.birthDate || editingUser.birthDate || ''}
                    onChange={(e) => onChange({ ...editForm, birthDate: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  />
                </div>

                {/* Age */}
                <div>
                  <label className="block mb-1 text-sm font-medium text-gray-700">
                    อายุ (ปี)
                  </label>
                  <input
                    type="number"
                    value={editForm.age || editingUser.age || ''}
                    onChange={(e) => onChange({ ...editForm, age: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    placeholder="35"
                  />
                </div>

                {/* National ID */}
                <div>
                  <label className="block mb-1 text-sm font-medium text-gray-700">
                    เลขบัตรประชาชน
                  </label>
                  <input
                    type="text"
                    value={editForm.nationalId || editingUser.nationalId || ''}
                    onChange={(e) => onChange({ ...editForm, nationalId: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    placeholder="1234567890123"
                    maxLength="13"
                  />
                </div>

                {/* Blood Type */}
                <div>
                  <label className="block mb-1 text-sm font-medium text-gray-700">
                    หมู่เลือด
                  </label>
                  <select
                    value={editForm.bloodType || editingUser.bloodType || ''}
                    onChange={(e) => onChange({ ...editForm, bloodType: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  >
                    <option value="">เลือกหมู่เลือด</option>
                    <option value="A">A</option>
                    <option value="B">B</option>
                    <option value="AB">AB</option>
                    <option value="O">O</option>
                  </select>
                </div>
              </div>
            </div>

            {/* ข้อมูลบัญชี */}
            <div>
              <h3 className="flex items-center gap-2 mb-4 text-lg font-semibold text-gray-800">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-brand-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
                ข้อมูลบัญชี
              </h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {/* Username - Read Only */}
                <div>
                  <label className="block mb-1 text-sm font-medium text-gray-700">
                    Username
                  </label>
                  <input
                    type="text"
                    value={editForm.username || editingUser.username || ''}
                    disabled
                    className="w-full px-4 py-2 text-gray-600 bg-gray-100 border border-gray-300 rounded-lg cursor-not-allowed"
                  />
                  <p className="mt-1 text-xs text-gray-500">สร้างอัตโนมัติเมื่อเพิ่มผู้ใช้ใหม่</p>
                </div>

                {/* Password */}
                <div>
                  <label className="block mb-1 text-sm font-medium text-gray-700">
                    Password (รหัสผ่าน)
                  </label>
                  <input
                    type="text"
                    value={editForm.password || editingUser.password || ''}
                    onChange={(e) => onChange({ ...editForm, password: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    placeholder="เลขบัตรประชาชน 13 หลัก"
                  />
                  <p className="mt-1 text-xs text-gray-500">แสดงแบบไม่เข้ารหัส</p>
                </div>
              </div>
            </div>

            {/* ข้อมูลการทำงาน */}
            <div>
              <h3 className="flex items-center gap-2 mb-4 text-lg font-semibold text-gray-800">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-brand-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                ข้อมูลการทำงาน
              </h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {/* Employee ID - Read Only */}
                <div>
                  <label className="block mb-1 text-sm font-medium text-gray-700">
                    รหัสพนักงาน
                  </label>
                  <input
                    type="text"
                    value={editForm.employeeId || editingUser.employeeId || editingUser.username || ''}
                    disabled
                    className="w-full px-4 py-2 text-gray-600 bg-gray-100 border border-gray-300 rounded-lg cursor-not-allowed"
                  />
                  <p className="mt-1 text-xs text-gray-500">ไม่สามารถแก้ไขได้</p>
                </div>

                {/* Branch - Read Only */}
                <div>
                  <label className="block mb-1 text-sm font-medium text-gray-700">
                    สาขา
                  </label>
                  <input
                    type="text"
                    value={editForm.branchCode || editingUser.branchCode || ''}
                    disabled
                    className="w-full px-4 py-2 text-gray-600 bg-gray-100 border border-gray-300 rounded-lg cursor-not-allowed"
                    placeholder="ระบุโดย รหัสพนักงาน"
                  />
                  <p className="mt-1 text-xs text-gray-500">ไม่สามารถแก้ไขได้</p>
                </div>

                {/* Position */}
                <div>
                  <label className="block mb-1 text-sm font-medium text-gray-700">
                    ตำแหน่ง
                  </label>
                  <input
                    type="text"
                    value={editForm.position || editingUser.position || ''}
                    onChange={(e) => onChange({ ...editForm, position: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    placeholder="Senior Software Engineer"
                  />
                </div>

                {/* Department */}
                <div>
                  <label className="block mb-1 text-sm font-medium text-gray-700">
                    แผนก
                  </label>
                  <select
                    value={editForm.department || editingUser.department || ''}
                    onChange={(e) => onChange({ ...editForm, department: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  >
                    <option value="">เลือกแผนก</option>
                    <option value="IT">IT</option>
                    <option value="HR">HR</option>
                    <option value="Sales">Sales</option>
                    <option value="Marketing">Marketing</option>
                    <option value="Finance">Finance</option>
                    <option value="Operations">Operations</option>
                  </select>
                </div>

                {/* Role */}
                <div>
                  <label className="block mb-1 text-sm font-medium text-gray-700">
                    บทบาท
                  </label>
                  {currentUser?.role === 'admin' && editingUser?.role === 'superadmin' ? (
                    <div>
                      <input
                        type="text"
                        value="Super Admin"
                        disabled
                        className="w-full px-4 py-2 font-medium text-gray-600 bg-gray-100 border border-gray-300 rounded-lg cursor-not-allowed"
                      />
                      <p className="mt-1 text-xs text-red-500">Admin ไม่สามารถปรับ Role ของ Super Admin ได้ (แต่แก้ข้อมูลอื่นได้)</p>
                    </div>
                  ) : (
                    <select
                      value={editForm.role || editingUser.role || ''}
                      onChange={(e) => onChange({ ...editForm, role: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    >
                      <option value="">เลือกบทบาท</option>
                      <option value="user">User</option>
                      <option value="manager">Manager</option>
                      <option value="admin">Admin</option>
                      {currentUser?.role === 'superadmin' && (
                        <option value="superadmin">Super Admin</option>
                      )}
                    </select>
                  )}
                </div>

                {/* Status */}
                <div>
                  <label className="block mb-1 text-sm font-medium text-gray-700">
                    สถานะ
                  </label>
                  <select
                    value={editForm.status || editingUser.status || ''}
                    onChange={(e) => onChange({ ...editForm, status: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  >
                    <option value="active">ทำงานอยู่ (Active)</option>
                    <option value="leave">ลาออกแล้ว (Leave)</option>
                    <option value="suspended">โดนพักงาน (Suspended)</option>
                    <option value="pending">รอโปรโมท (Pending)</option>
                  </select>
                </div>

                {/* Start Date */}
                <div>
                  <label className="block mb-1 text-sm font-medium text-gray-700">
                    วันที่เริ่มงาน
                  </label>
                  <input
                    type="date"
                    value={editForm.startDate || editingUser.startDate || ''}
                    onChange={(e) => onChange({ ...editForm, startDate: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  />
                </div>

                {/* Salary */}
                <div>
                  <label className="block mb-1 text-sm font-medium text-gray-700">
                    เงินเดือน (บาท)
                  </label>
                  <input
                    type="number"
                    value={editForm.salary || editingUser.salary || ''}
                    onChange={(e) => onChange({ ...editForm, salary: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    placeholder="45000"
                  />
                </div>
              </div>
            </div>

            {/* ข้อมูลผู้ติดต่อฉุกเฉิน */}
            <div>
              <h3 className="flex items-center gap-2 mb-4 text-lg font-semibold text-gray-800">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-brand-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                ข้อมูลผู้ติดต่อฉุกเฉิน
              </h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div>
                  <label className="block mb-1 text-sm font-medium text-gray-700">
                    ชื่อผู้ติดต่อฉุกเฉิน
                  </label>
                  <input
                    type="text"
                    value={editForm.emergencyContactName || editingUser.emergencyContact?.name || ''}
                    onChange={(e) => onChange({ ...editForm, emergencyContactName: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    placeholder="นายสมชาย รัตนา"
                  />
                </div>

                <div>
                  <label className="block mb-1 text-sm font-medium text-gray-700">
                    เบอร์ผู้ติดต่อฉุกเฉิน
                  </label>
                  <input
                    type="tel"
                    value={editForm.emergencyContactPhone || editingUser.emergencyContact?.phone || ''}
                    onChange={(e) => onChange({ ...editForm, emergencyContactPhone: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    placeholder="089-888-4357"
                  />
                </div>

                <div>
                  <label className="block mb-1 text-sm font-medium text-gray-700">
                    ความสัมพันธ์
                  </label>
                  <select
                    value={editForm.emergencyContactRelation || editingUser.emergencyContact?.relation || ''}
                    onChange={(e) => onChange({ ...editForm, emergencyContactRelation: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  >
                    <option value="">เลือกความสัมพันธ์</option>
                    <option value="บิดา">บิดา</option>
                    <option value="มารดา">มารดา</option>
                    <option value="สามี">สามี</option>
                    <option value="ภรรยา">ภรรยา</option>
                    <option value="พี่ชาย">พี่ชาย</option>
                    <option value="พี่สาว">พี่สาว</option>
                    <option value="น้องชาย">น้องชาย</option>
                    <option value="น้องสาว">น้องสาว</option>
                    <option value="อื่นๆ">อื่นๆ</option>
                  </select>
                </div>
              </div>
            </div>

            {/* ข้อมูลสวัสดิการ (Benefits) */}
            <div>
              <h3 className="flex items-center gap-2 mb-4 text-lg font-semibold text-gray-800">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-brand-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                ข้อมูลสวัสดิการ
              </h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {/* เลขประกันสังคม */}
                <div>
                  <label className="block mb-1 text-sm font-medium text-gray-700">
                    เลขประกันสังคม
                  </label>
                  <input
                    type="text"
                    value={editForm.socialSecurityNumber || editingUser.socialSecurityNumber || ''}
                    onChange={(e) => onChange({ ...editForm, socialSecurityNumber: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    placeholder="X-XXXX-XXXXX-XX-X"
                  />
                </div>

                {/* สิทธิประกันสังคม */}
                <div>
                  <label className="block mb-1 text-sm font-medium text-gray-700">
                    สิทธิประกันสังคม
                  </label>
                  <select
                    value={editForm.socialSecurityRights || editingUser.socialSecurityRights || 'มี'}
                    onChange={(e) => onChange({ ...editForm, socialSecurityRights: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  >
                    <option value="มี">มี</option>
                    <option value="ไม่มี">ไม่มี</option>
                  </select>
                </div>

                {/* กองทุนสำรองเลี้ยงชีพ */}
                <div>
                  <label className="block mb-1 text-sm font-medium text-gray-700">
                    กองทุนสำรองเลี้ยงชีพ
                  </label>
                  <input
                    type="text"
                    value={editForm.providentFund || editingUser.providentFund || ''}
                    onChange={(e) => onChange({ ...editForm, providentFund: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    placeholder="เช่น 5% หรือ ไม่มี"
                  />
                </div>

                {/* ประกันสุขภาพกลุ่ม */}
                <div>
                  <label className="block mb-1 text-sm font-medium text-gray-700">
                    ประกันสุขภาพกลุ่ม
                  </label>
                  <input
                    type="text"
                    value={editForm.groupHealthInsurance || editingUser.groupHealthInsurance || ''}
                    onChange={(e) => onChange({ ...editForm, groupHealthInsurance: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    placeholder="เช่น AIA, Allianz หรือ ไม่มี"
                  />
                </div>
              </div>
            </div>

            {/* ที่อยู่ */}
            <div>
              <h3 className="flex items-center gap-2 mb-4 text-lg font-semibold text-gray-800">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-brand-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                ที่อยู่
              </h3>
              <textarea
                value={editForm.address || editingUser.address || ''}
                onChange={(e) => onChange({ ...editForm, address: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                rows="3"
                placeholder="กรอกที่อยู่"
              />
            </div>

            {/* ประวัติการทำงาน */}
            <div>
              <h3 className="mb-4 text-lg font-semibold text-gray-800">
                ประวัติการทำงาน
              </h3>
              {editForm.workHistory && editForm.workHistory.length > 0 ? (
                <div className="mb-3 space-y-2">
                  {editForm.workHistory.map((work, index) => (
                    <div key={index} className="flex items-start gap-3 p-3 border border-orange-200 rounded-lg bg-orange-50">
                      <div className="flex-1">
                        <input
                          type="text"
                          value={work.position}
                          onChange={(e) => {
                            const newWorkHistory = [...editForm.workHistory];
                            newWorkHistory[index] = { ...work, position: e.target.value };
                            onChange({ ...editForm, workHistory: newWorkHistory });
                          }}
                          className="w-full px-2 py-1 mb-1 text-sm font-medium border border-orange-300 rounded focus:ring-2 focus:ring-orange-500"
                          placeholder="ตำแหน่ง"
                        />
                        <input
                          type="text"
                          value={work.company}
                          onChange={(e) => {
                            const newWorkHistory = [...editForm.workHistory];
                            newWorkHistory[index] = { ...work, company: e.target.value };
                            onChange({ ...editForm, workHistory: newWorkHistory });
                          }}
                          className="w-full px-2 py-1 mb-1 text-sm border border-orange-300 rounded focus:ring-2 focus:ring-orange-500"
                          placeholder="บริษัท"
                        />
                        <input
                          type="text"
                          value={work.period}
                          onChange={(e) => {
                            const newWorkHistory = [...editForm.workHistory];
                            newWorkHistory[index] = { ...work, period: e.target.value };
                            onChange({ ...editForm, workHistory: newWorkHistory });
                          }}
                          className="w-full px-2 py-1 text-xs border border-orange-300 rounded focus:ring-2 focus:ring-orange-500"
                          placeholder="ช่วงเวลา (เช่น 2020-2023)"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const newWorkHistory = editForm.workHistory.filter((_, i) => i !== index);
                          onChange({ ...editForm, workHistory: newWorkHistory });
                        }}
                        className="text-red-500 transition-colors hover:text-red-700"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </div>
                    
                  ))}
                </div>
              ) : (
                <p className="mb-3 text-sm text-gray-500">ไม่มีประวัติการทำงาน</p>
              )}
              <button
                type="button"
                onClick={() => {
                  const newWorkHistory = [...(editForm.workHistory || []), { period: '', position: '', company: '' }];
                  onChange({ ...editForm, workHistory: newWorkHistory });
                }}
                className="flex items-center justify-center w-full gap-2 px-4 py-2 text-sm font-medium text-orange-700 transition-colors bg-orange-100 rounded-lg hover:bg-orange-200"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                </svg>
                เพิ่มประวัติการทำงาน
              </button>
            </div>

            {/* การศึกษา */}
            <div>
              <h3 className="mb-4 text-lg font-semibold text-gray-800">
                การศึกษา
              </h3>
              {editForm.education && editForm.education.length > 0 ? (
                <div className="mb-3 space-y-2">
                  {editForm.education.map((edu, index) => (
                    <div key={index} className="flex items-center gap-3 p-3 border border-green-200 rounded-lg bg-green-50">
                        <input
                        type="text"
                        value={typeof edu === 'string' ? edu : `${edu.degree || ''}${edu.institution ? ' - ' + edu.institution : ''}${edu.year ? ' (' + edu.year + ')' : ''}`}
                        onChange={(e) => {
                          const newEducation = [...editForm.education];
                          newEducation[index] = e.target.value;
                          onChange({ ...editForm, education: newEducation });
                        }}
                        className="flex-1 px-2 py-1 text-sm border border-green-300 rounded focus:ring-2 focus:ring-green-500"
                        placeholder="เช่น ปริญญาตรี, มหาวิทยาลัยเกษตรศาสตร์, วิทยาการคอมพิวเตอร์, 3.45"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const newEducation = editForm.education.filter((_, i) => i !== index);
                          onChange({ ...editForm, education: newEducation });
                        }}
                        className="text-red-500 transition-colors hover:text-red-700"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mb-3 text-sm text-gray-500">ไม่มีข้อมูลการศึกษา</p>
              )}
              <button
                type="button"
                onClick={() => {
                  const newEducation = [...(editForm.education || []), ''];
                  onChange({ ...editForm, education: newEducation });
                }}
                className="flex items-center justify-center w-full gap-2 px-4 py-2 text-sm font-medium text-green-700 transition-colors bg-green-100 rounded-lg hover:bg-green-200"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                </svg>
                เพิ่มข้อมูลการศึกษา
              </button>
            </div>

            {/* ทักษะ */}
            <div>
              <h3 className="mb-4 text-lg font-semibold text-gray-800">
                ทักษะ
              </h3>
              {editForm.skills && editForm.skills.length > 0 ? (
                <div className="flex flex-wrap gap-2 mb-3">
                  {editForm.skills.map((skill, index) => (
                    <div key={index} className="inline-flex items-center gap-2 px-3 py-1 text-sm border border-orange-200 rounded-full bg-orange-50">
                      <input
                        type="text"
                        value={typeof skill === 'string' ? skill : `${skill.name || ''}${skill.level ? ' - ' + skill.level : ''}${skill.years ? ' (' + skill.years + ' ปี)' : ''}`}
                        onChange={(e) => {
                          const newSkills = [...editForm.skills];
                          newSkills[index] = e.target.value;
                          onChange({ ...editForm, skills: newSkills });
                        }}
                        className="w-24 text-orange-700 bg-transparent border-none focus:outline-none focus:ring-0"
                        placeholder="ทักษะ"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const newSkills = editForm.skills.filter((_, i) => i !== index);
                          onChange({ ...editForm, skills: newSkills });
                        }}
                        className="text-orange-500 transition-colors hover:text-orange-700"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mb-3 text-sm text-gray-500">ไม่มีข้อมูลทักษะ</p>
              )}
              <button
                type="button"
                onClick={() => {
                  const newSkills = [...(editForm.skills || []), ''];
                  onChange({ ...editForm, skills: newSkills });
                }}
                className="flex items-center justify-center w-full gap-2 px-4 py-2 text-sm font-medium text-orange-700 transition-colors bg-orange-100 rounded-lg hover:bg-orange-200"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                </svg>
                เพิ่มทักษะ
              </button>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex justify-end flex-shrink-0 gap-3 px-6 py-4 border-t bg-gray-50">
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
          >
            ยกเลิก
          </button>
          <button
            onClick={() => {
              onSave();      
            }}
            className="px-6 py-2.5 bg-gradient-to-r from-brand-primary to-orange-600 text-white rounded-lg hover:from-orange-600 hover:to-orange-700 transition-all shadow-sm hover:shadow-sm transform hover:scale-105 font-medium"
          >
            บันทึกการแก้ไข
          </button>
        </div>
      </div>
    </div>
  );
});

export default UserEditModal;
