import React, { useState, useEffect, useRef, useMemo } from 'react';
import { usersData } from '../../../data/usersData';

// --- Toast Notification Component ---
// (เหมือนเดิม)
const Toast = ({ message, type, onClose }) => {
    useEffect(() => {
        const timer = setTimeout(onClose, 4000);
        return () => clearTimeout(timer);
    }, [onClose]);

    const icons = {
        error: (
            <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
        ),
        warning: (
            <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
        ),
        success: (
            <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
        )
    };

    const styles = {
        error: 'bg-red-50 border-red-200 text-red-800',
        warning: 'bg-orange-50 border-orange-200 text-orange-800',
        success: 'bg-green-50 border-green-200 text-green-800'
    };

    const iconColors = {
        error: 'text-red-500',
        warning: 'text-orange-500',
        success: 'text-green-500'
    };

    return (
        <div className="fixed top-6 right-6 z-[60] animate-slideInRight">
            <div className={`${styles[type]} border-2 rounded-xl shadow-2xl p-4 pr-12 min-w-[320px] max-w-md`}>
                <div className="flex items-start gap-3">
                    <div className={iconColors[type]}>
                        {icons[type]}
                    </div>
                    <div className="flex-1">
                        <p className="text-sm font-semibold leading-relaxed">{message}</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="absolute text-gray-400 transition-colors top-3 right-3 hover:text-gray-600"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    );
};


// --- ICON SVG (แบบทึบ) ---
const LineIcon = ({ className = 'block w-6 h-6', ...props }) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        width="24"
        height="24"
        preserveAspectRatio="xMidYMid meet"
        fill="currentColor"
        stroke="none"
        className={className}
        aria-hidden="true"
        focusable="false"
        style={{ display: 'block', verticalAlign: 'middle' }}
        {...props}
    >
        <path d="M12 2C6.48 2 2 5.58 2 10c0 3.25 2.37 6.05 5.64 6.85.21.51.57 1.54.72 2.35.2.75-.37 1.63-.82 1.96-.07.04 2.28-.78 4.46-2.72 1.02.09 1.99.08 3 .08 5.52 0 10-3.58 10-8s-4.48-8-10-8z"/>
    </svg>
);

const SmsIcon = ({ className = 'block w-6 h-6', ...props }) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        width="24"
        height="24"
        preserveAspectRatio="xMidYMid meet"
        fill="currentColor"
        stroke="none"
        className={className}
        aria-hidden="true"
        focusable="false"
        style={{ display: 'block', verticalAlign: 'middle' }}
        {...props}
    >
        <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
    </svg>
);

const EmailIcon = ({ className = 'block w-6 h-6', ...props }) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        width="24"
        height="24"
        preserveAspectRatio="xMidYMid meet"
        fill="currentColor"
        stroke="none"
        className={className}
        aria-hidden="true"
        focusable="false"
        style={{ display: 'block', verticalAlign: 'middle' }}
        {...props}
    >
        <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
    </svg>
);
// --- จบส่วน ICON SVG ---


// --- +++ [โค้ดอัปเดต] Modal สำหรับดูรายละเอียดประวัติการแจ้งเตือน +++ ---
const HistoryDetailModal = ({ notification, onClose, recipientOptions = [], onDelete }) => {
    // State สำหรับซ่อน/แสดง รายชื่อ
    const [isUserListVisible, setIsUserListVisible] = useState(false);

    const getRecipientText = () => {
        if (notification.recipients.includes('all')) return 'ทั้งหมด';
        return notification.recipients
            .map(value => recipientOptions.find(opt => opt.value === value)?.label || value)
            .join(', ');
    };

    const getChannelIcons = () => {
        const channels = [];
        if (notification.channels.line) channels.push({ name: 'LINE', icon: <LineIcon className="w-5 h-5" />, color: 'bg-gray-600' });
        if (notification.channels.sms) channels.push({ name: 'SMS', icon: <SmsIcon className="w-5 h-5" />, color: 'bg-gray-600' });
        if (notification.channels.email) channels.push({ name: 'Email', icon: <EmailIcon className="w-5 h-5" />, color: 'bg-gray-600' });
        return channels;
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
            <div className="w-full max-w-3xl overflow-hidden bg-white shadow-2xl rounded-2xl animate-scaleIn">
                {/* Header */}
                <div className="p-6 text-white bg-orange-600">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-2xl font-bold">รายละเอียดการแจ้งเตือน</h2>
                            <p className="mt-1 text-sm text-orange-100">{notification.timestamp}</p>
                        </div>
                        <button
                            onClick={onClose}
                            className="flex items-center justify-center w-10 h-10 transition-colors rounded-full bg-white/20 hover:bg-white/30"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
                    {/* Title */}
                    <div className="p-4 border border-gray-200 bg-gray-50 rounded-xl">
                        <p className="mb-2 text-sm font-semibold text-gray-600">หัวข้อ</p>
                        <p className="text-lg font-semibold text-gray-800">{notification.title}</p>
                    </div>

                    {/* Recipients */}
                    <div className="p-4 border border-gray-200 bg-gray-50 rounded-xl">
                        <p className="mb-2 text-sm font-semibold text-gray-600">ผู้รับ</p>
                        <p className="font-semibold text-gray-800">{getRecipientText()}</p>

                        <div className="flex items-center justify-between mt-1">
                            <p className="text-sm text-gray-500">จำนวน {notification.recipientCount} คน</p>

                            {/* ปุ่ม Toggle ซ่อน/แสดง */}
                            {notification.sentToUsers && notification.sentToUsers.length > 0 && (
                                <button
                                    onClick={() => setIsUserListVisible(!isUserListVisible)}
                                    className="text-xs font-semibold text-orange-600 underline hover:text-orange-700 focus:outline-none"
                                >
                                    {isUserListVisible ? 'ซ่อนรายชื่อ' : 'ดูรายชื่อ'}
                                </button>
                            )}
                        </div>
                        

                        {/* ส่วนแสดงรายชื่อ (จะแสดงเมื่อกดปุ่ม) */}
                        {isUserListVisible && notification.sentToUsers && notification.sentToUsers.length > 0 && (
                            <>
                                <hr className="my-3 border-gray-200" />
                                <p className="mb-2 text-xs font-semibold text-gray-500 uppercase">รายชื่อผู้รับ:</p>
                                <ul className="space-y-1.5 max-h-32 overflow-y-auto">
                                    {notification.sentToUsers.sort((a,b) => a.name.localeCompare(b.name)).map(user => (
                                        <li key={user.id} className="text-sm text-gray-700">
                                            {user.name} 
                                            <span className="ml-2 text-xs text-gray-400">
                                                {user.position || user.department}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            </>
                        )}
                    </div>


                    {/* Channels */}
                    <div className="p-4 border border-gray-200 bg-gray-50 rounded-xl">
                        <p className="mb-3 text-sm font-semibold text-gray-600">ช่องทางการส่ง</p>
                        <div className="flex flex-wrap gap-2">
                            {getChannelIcons().map((channel, index) => (
                                <div key={index} className={`${channel.color} text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium`}>
                                    <span className="text-xl">{channel.icon}</span>
                                    <span>{channel.name}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Message */}
                    <div className="p-4 border border-gray-200 bg-gray-50 rounded-xl">
                        <p className="mb-2 text-sm font-semibold text-gray-600">ข้อความ</p>
                        <p className="leading-relaxed text-gray-800 whitespace-pre-wrap">{notification.message}</p>
                    </div>

                    {/* Status */}
                    <div className="p-4 border border-green-200 bg-green-50 rounded-xl">
                        <div className="flex items-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <p className="font-semibold text-green-800">ส่งสำเร็จ</p>
                        </div>
                    </div>
                </div>

                {/* +++ [โค้ดอัปเดต] Footer +++ */}
                <div className="flex gap-3 p-4 border-t border-gray-200 bg-gray-50">
                    <button
                        onClick={onClose}
                        className="flex-1 py-3 font-semibold text-gray-800 transition-colors bg-gray-200 hover:bg-gray-300 rounded-xl"
                    >
                        ปิด
                    </button>
                    <button
                        onClick={() => onDelete(notification.id)}
                        className="flex-1 py-3 font-semibold text-white transition-all bg-red-600 hover:bg-red-700 rounded-xl"
                    >
                        ลบรายการนี้
                    </button>
                </div>
            </div>
        </div>
    );
};
// --- +++ [จบโค้ดอัปเดต] Modal ประวัติ +++ ---


// --- Modal สำหรับยืนยันการส่ง ---
const ConfirmSendModal = ({ data, channels, onConfirm, onClose, recipientOptions = [] }) => {
    const getRecipientText = () => {
        if (data.recipientGroups.includes('all')) return 'ทั้งหมด';
        return data.recipientGroups
            .map(value => recipientOptions.find(opt => opt.value === value)?.label || value)
            .join(', ');
    };

    const getSelectedChannels = () => {
        const selected = [];
        if (channels.line) selected.push({ name: 'LINE', icon: <LineIcon className="inline-block w-4 h-4 mr-1" /> });
        if (channels.sms) selected.push({ name: 'SMS', icon: <SmsIcon className="inline-block w-4 h-4 mr-1" /> });
        if (channels.email) selected.push({ name: 'Email', icon: <EmailIcon className="inline-block w-4 h-4 mr-1" /> });
        return selected;
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="w-full max-w-md overflow-hidden bg-white shadow-2xl rounded-2xl">
                <div className="p-6 text-white bg-orange-600">
                    <h3 className="text-xl font-bold">ยืนยันการส่งแจ้งเตือน</h3>
                </div>
                <div className="p-6 space-y-4">
                    <div className="p-4 border border-orange-200 rounded-lg bg-orange-50">
                        <div className="flex items-start gap-3">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-orange-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                            <div>
                                <p className="font-semibold text-orange-800">คุณกำลังจะส่งแจ้งเตือนไปยัง</p>
                                <p className="mt-1 text-orange-700"><strong>{getRecipientText()}</strong></p>
                                <p className="mt-2 text-sm text-orange-600">ผ่านช่องทาง: <strong>{getSelectedChannels().map(c => <span key={c.name} className="inline-flex items-center gap-1 mr-2">{c.icon}{c.name}</span>)}</strong></p>
                            </div>
                        </div>
                    </div>
                    <p className="text-sm text-gray-600">การแจ้งเตือนจะถูกส่งไปยังผู้รับทุกคนในกลุ่มที่เลือกทันที</p>
                </div>
                <div className="flex gap-3 p-4 border-t border-gray-200 bg-gray-50">
                    <button
                        onClick={onClose}
                        className="flex-1 py-3 font-semibold text-gray-800 transition-colors bg-gray-200 hover:bg-gray-300 rounded-xl"
                    >
                        ยกเลิก
                    </button>
                    <button
                        onClick={onConfirm}
                        className="flex-1 py-3 font-semibold text-white transition-all bg-orange-600 shadow-lg hover:bg-orange-700 rounded-xl"
                    >
                        ยืนยันและส่ง
                    </button>
                </div>
            </div>
        </div>
    );
};

// --- Success Modal ---
// (เหมือนเดิม)
const SuccessModal = ({ onClose }) => {
    useEffect(() => {
        const timer = setTimeout(onClose, 1500);
        return () => clearTimeout(timer);
    }, [onClose]);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="w-full max-w-sm p-8 text-center bg-white shadow-2xl rounded-2xl">
                <div className="flex items-center justify-center w-20 h-20 mx-auto mb-4 bg-green-100 rounded-full">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-12 h-12 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                </div>
                <h3 className="mb-2 text-2xl font-bold text-gray-800">ส่งสำเร็จ!</h3>
                <p className="text-gray-600">แจ้งเตือนถูกส่งเรียบร้อยแล้ว</p>
            </div>
        </div>
    );
};

// --- Card สำหรับแสดงประวัติ ---
const NotificationHistoryCard = ({ notification, onClick }) => {
    const getChannelIcons = () => {
        const icons = [];
        if (notification.channels.line) icons.push(<div key="line" className="text-gray-600"><LineIcon className="w-6 h-6" /></div>);
        if (notification.channels.sms) icons.push(<div key="sms" className="text-orange-600"><SmsIcon className="w-6 h-6" /></div>);
        if (notification.channels.email) icons.push(<div key="email" className="text-gray-600"><EmailIcon className="w-6 h-6" /></div>);
        return icons;
    };

    return (
        <div
            onClick={onClick}
            className="p-5 transition-all bg-white border border-gray-200 cursor-pointer rounded-xl hover:border-orange-300 hover:shadow-lg group"
        >
            <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                    <h3 className="font-bold text-gray-800 transition-colors group-hover:text-orange-600 line-clamp-1">
                        {notification.title}
                    </h3>
                    <p className="mt-1 text-sm text-gray-500">{notification.timestamp}</p>
                </div>
                <div className="flex items-center gap-2">
                    {getChannelIcons().map((ic, i) => <div key={i}>{ic}</div>)}
                </div>
            </div>
            <p className="mb-3 text-sm text-gray-600 line-clamp-2">{notification.message}</p>
            <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">
                    ส่งถึง {notification.recipientCount} คน
                </span>
                <span className="flex items-center gap-1 text-xs font-semibold text-green-600">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    ส่งแล้ว
                </span>
            </div>
        </div>
    );
};

// --- Modal สำหรับแสดงรายชื่อผู้รับ ---
const RecipientListModal = ({ users, onClose }) => {
    return (
        <div className="fixed inset-0 z-[55] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
            <div className="w-full max-w-lg overflow-hidden bg-white shadow-2xl rounded-2xl animate-scaleIn">
                {/* Header */}
                <div className="p-6 text-white bg-orange-600">
                    <div className="flex items-center justify-between">
                        <h2 className="text-2xl font-bold">รายชื่อผู้รับ</h2>
                        <button
                            onClick={onClose}
                            className="flex items-center justify-center w-10 h-10 transition-colors rounded-full bg-white/20 hover:bg-white/30"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="p-6 max-h-[60vh] overflow-y-auto">
                    <ul className="divide-y divide-gray-200">
                        {users.length === 0 ? (
                            <li className="py-4 text-center text-gray-500">ไม่พบรายชื่อผู้รับ</li>
                        ) : (
                            // เรียงตามชื่อ
                            users.sort((a, b) => a.name.localeCompare(b.name)).map(user => (
                                <li key={user.employeeId || user.id} className="py-4">
                                    <p className="font-semibold text-gray-800">{user.name}</p>
                                    <p className="text-sm text-gray-500">
                                        {user.position || user.department || 'N/A'}
                                    </p>
                                </li>
                            ))
                        )}
                    </ul>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between p-4 border-t border-gray-200 bg-gray-50">
                     <span className="text-sm font-semibold text-gray-700">
                        ทั้งหมด {users.length} คน
                     </span>
                     <button
                        onClick={onClose}
                        className="px-6 py-3 font-semibold text-gray-800 transition-colors bg-gray-200 hover:bg-gray-300 rounded-xl"
                    >
                        ปิด
                    </button>
                </div>
            </div>
        </div>
    );
};
// --- [จบ] Modal สำหรับแสดงรายชื่อผู้รับ ---


// --- Modal ยืนยันการล้างประวัติ ---
const ConfirmClearModal = ({ onConfirm, onClose }) => {
    return (
        <div className="fixed inset-0 z-[55] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
            <div className="w-full max-w-md overflow-hidden bg-white shadow-2xl rounded-2xl animate-scaleIn">
                {/* Header (ใช้สีแดง) */}
                <div className="p-6 text-white bg-red-600">
                    <h3 className="flex items-center gap-2 text-xl font-bold">
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        ยืนยันการล้างประวัติ
                    </h3>
                </div>
                
                {/* Content */}
                <div className="p-6">
                    <p className="text-gray-700">
                        คุณแน่ใจหรือไม่ว่าต้องการล้างประวัติการส่งทั้งหมด?
                    </p>
                    <p className="mt-2 text-sm font-semibold text-red-700">
                        การกระทำนี้ไม่สามารถย้อนกลับได้
                    </p>
                </div>
                
                {/* Footer */}
                <div className="flex gap-3 p-4 border-t border-gray-200 bg-gray-50">
                    <button
                        onClick={onClose}
                        className="flex-1 py-3 font-semibold text-gray-800 transition-colors bg-gray-200 hover:bg-gray-300 rounded-xl"
                    >
                        ยกเลิก
                    </button>
                    <button
                        onClick={onConfirm}
                        className="flex-1 py-3 font-semibold text-white transition-all bg-red-600 hover:bg-red-700 rounded-xl"
                    >
                        ยืนยันและลบทั้งหมด
                    </button>
                </div>
            </div>
        </div>
    );
};
// --- [จบ] Modal ยืนยันการล้างประวัติ ---


// --- +++ [เพิ่มใหม่] Modal ยืนยันการลบทีละรายการ +++ ---
const ConfirmDeleteModal = ({ onConfirm, onClose }) => {
    return (
        <div className="fixed inset-0 z-[55] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
            <div className="w-full max-w-md overflow-hidden bg-white shadow-2xl rounded-2xl animate-scaleIn">
                <div className="p-6 text-white bg-red-600">
                    <h3 className="flex items-center gap-2 text-xl font-bold">
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        ยืนยันการลบรายการ
                    </h3>
                </div>
                <div className="p-6">
                    <p className="text-gray-700">
                        คุณแน่ใจหรือไม่ว่าต้องการลบรายการนี้?
                    </p>
                    <p className="mt-2 text-sm font-semibold text-red-700">
                        การกระทำนี้ไม่สามารถย้อนกลับได้
                    </p>
                </div>
                <div className="flex gap-3 p-4 border-t border-gray-200 bg-gray-50">
                    <button
                        onClick={onClose}
                        className="flex-1 py-3 font-semibold text-gray-800 transition-colors bg-gray-200 hover:bg-gray-300 rounded-xl"
                    >
                        ยกเลิก
                    </button>
                    <button
                        onClick={onConfirm}
                        className="flex-1 py-3 font-semibold text-white transition-all bg-red-600 hover:bg-red-700 rounded-xl"
                    >
                        ยืนยันและลบ
                    </button>
                </div>
            </div>
        </div>
    );
};
// --- +++ [จบ] Modal ยืนยันการลบทีละรายการ +++ ---



function GroupNotificationScreen() {
    const [title, setTitle] = useState('');
    const [recipientGroups, setRecipientGroups] = useState([]);
    const [message, setMessage] = useState('');
    const [sendChannels, setSendChannels] = useState({ line: false, sms: false, email: false });
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [selectedHistory, setSelectedHistory] = useState(null);
    const [notificationHistory, setNotificationHistory] = useState([]);
    const [toast, setToast] = useState(null);
    const [fieldErrors, setFieldErrors] = useState({});
    const [recipientSearch, setRecipientSearch] = useState('');
    const [showRecipientModal, setShowRecipientModal] = useState(false); 
    const [showClearConfirm, setShowClearConfirm] = useState(false);
    const [deletingId, setDeletingId] = useState(null); // <-- [เพิ่มใหม่] State
    const dropdownRef = useRef(null);

    // --- Logic (useMemo, etc.) ---
    const groupOptions = useMemo(() => {
        const byDept = usersData.reduce((acc, u) => {
            const d = u.department || 'อื่นๆ';
            acc[d] = (acc[d] || 0) + 1;
            return acc;
        }, {});

        const allCount = usersData.length;
        const managersCount = usersData.filter(u => u.role === 'manager').length;
        const adminCount = usersData.filter(u => u.role === 'admin' || u.role === 'superadmin').length;
        const hrCount = byDept['HR'] || 0;
        const marketingCount = byDept['Marketing'] || 0;
        const financeCount = byDept['Finance'] || 0;

        return [
            { value: 'all', label: 'ทั้งหมด', count: allCount },
            { value: 'managers', label: 'หัวหน้าทีม', count: managersCount },
            { value: 'hr', label: 'ฝ่ายบุคคล', count: hrCount },
            { value: 'admin', label: 'ผู้ดูแลระบบ', count: adminCount },
            { value: 'marketing', label: 'ฝ่ายการตลาด', count: marketingCount },
            { value: 'finance', label: 'ฝ่ายการเงิน', count: financeCount },
        ];
    }, [usersData]);

    const userOptions = useMemo(() => {
        return usersData.map(u => ({
            value: `user:${u.employeeId || u.username || u.id}`,
            label: `${u.name}${u.position ? ' — ' + u.position : (u.department ? ' — ' + u.department : '')}`,
            count: 1,
            meta: { id: u.employeeId || u.username || u.id, name: u.name || '', email: u.email || '', phone: u.phone || '' }
        }));
    }, [usersData]);

    const recipientOptions = useMemo(() => [...groupOptions, ...userOptions], [groupOptions, userOptions]);

    // --- Logic ดึงรายชื่อผู้ใช้ (Unique) จากกลุ่มที่เลือก ---
    const selectedUsers = useMemo(() => {
        const usersMap = new Map();
        
        const addUsersToMap = (userArray) => {
            for (const user of userArray) {
                const id = user.employeeId || user.username || user.id;
                if (id && !usersMap.has(id)) {
                    usersMap.set(id, user);
                }
            }
        };

        if (recipientGroups.includes('all')) {
            addUsersToMap(usersData);
            return Array.from(usersMap.values());
        }

        for (const item of recipientGroups) {
            if (item.startsWith('user:')) {
                const userId = item.split(':')[1];
                const user = usersData.find(u => (u.employeeId || u.username || u.id) === userId);
                if (user) addUsersToMap([user]);
            } else {
                switch (item) {
                    case 'managers':
                        addUsersToMap(usersData.filter(u => u.role === 'manager'));
                        break;
                    case 'hr':
                        addUsersToMap(usersData.filter(u => u.department === 'HR'));
                        break;
                    case 'admin':
                        addUsersToMap(usersData.filter(u => u.role === 'admin' || u.role === 'superadmin'));
                        break;
                    case 'marketing':
                        addUsersToMap(usersData.filter(u => u.department === 'Marketing'));
                        break;
                    case 'finance':
                        addUsersToMap(usersData.filter(u => u.department === 'Finance'));
                        break;
                    default:
                        break;
                }
            }
        }
        return Array.from(usersMap.values());
    }, [recipientGroups, usersData]);
    // --- [จบ] Logic ดึงรายชื่อ ---


    const removeRecipient = (value) => {
        setRecipientGroups(prev => prev.filter(v => v !== value));
    };

    const filteredRecipientOptions = (() => {
        const q = recipientSearch.trim().toLowerCase();
        if (!q) {
            return groupOptions;
        }

        const matchedGroups = groupOptions.filter(opt =>
            (opt.label && opt.label.toLowerCase().includes(q)) ||
            (String(opt.value).toLowerCase().includes(q))
        );

        const matchedUsers = userOptions.filter(opt =>
            (opt.label && opt.label.toLowerCase().includes(q)) ||
            (opt.meta && opt.meta.name && opt.meta.name.toLowerCase().includes(q)) ||
            (opt.meta && opt.meta.email && opt.meta.email.toLowerCase().includes(q)) ||
            (opt.meta && opt.meta.phone && opt.meta.phone.toLowerCase().includes(q)) ||
            String(opt.value).toLowerCase().includes(q)
        );

        return [...matchedGroups, ...matchedUsers];
    })();

    useEffect(() => {
        const savedHistory = localStorage.getItem('notificationHistory');
        if (savedHistory) {
            setNotificationHistory(JSON.parse(savedHistory));
        }
    }, []);

    const showToast = (message, type = 'error') => {
        setToast({ message, type });
    };

    const closeToast = () => {
        setToast(null);
    };

    const handleRecipientChange = (value) => {
        setRecipientGroups(prevSelected => {
            if (value === 'all') {
                return prevSelected.includes('all') ? [] : ['all'];
            }
            let newSelection = prevSelected.filter(item => item !== 'all');
            if (newSelection.includes(value)) {
                return newSelection.filter(item => item !== value);
            } else {
                newSelection.push(value);
                return newSelection;
            }
        });
    };

    const getDropdownButtonText = () => {
        if (recipientGroups.includes('all')) return 'ทั้งหมด';
        if (recipientGroups.length === 0) return 'เลือกผู้รับ';
        if (recipientGroups.length === 1) {
            return recipientOptions.find(opt => opt.value === recipientGroups[0])?.label || 'เลือกผู้รับ';
        }
        return `${recipientGroups.length} กลุ่ม/คน ที่เลือก`;
    };

    const toggleChannel = (channel) => {
        setSendChannels(prev => ({ ...prev, [channel]: !prev[channel] }));
    };

    const hasSelectedChannel = () => {
        return sendChannels.line || sendChannels.sms || sendChannels.email;
    };

    const validateForm = () => {
        const errors = {};
        let isValid = true;

        if (!title.trim()) {
            errors.title = true;
            showToast('กรุณากรอกหัวข้อการแจ้งเตือน', 'error');
            isValid = false;
        } else if (recipientGroups.length === 0) {
            errors.recipients = true;
            showToast('กรุณาเลือกกลุ่มผู้รับอย่างน้อย 1 กลุ่ม', 'error');
            isValid = false;
        } else if (!message.trim()) {
            errors.message = true;
            showToast('กรุณากรอกข้อความที่ต้องการส่ง', 'error');
            isValid = false;
        } else if (message.trim().length < 10) {
            errors.message = true;
            showToast('ข้อความควรมีความยาวอย่างน้อย 10 ตัวอักษร', 'warning');
            isValid = false;
        } else if (!hasSelectedChannel()) {
            errors.channels = true;
            showToast('กรุณาเลือกช่องทางการส่งอย่างน้อย 1 ช่องทาง', 'error');
            isValid = false;
        }

        setFieldErrors(errors);

        if (!isValid) {
            setTimeout(() => setFieldErrors({}), 3000);
        }

        return isValid;
    };

    const handleSubmit = () => {
        if (!validateForm()) return;
        setShowConfirmModal(true);
    };

    const confirmSendNotification = async () => {
        setShowConfirmModal(false);

        const notification = {
            id: Date.now(),
            title: title.trim(),
            message: message.trim(),
            recipients: [...recipientGroups], 
            recipientCount: selectedUsers.length,
            
            sentToUsers: selectedUsers.map(u => ({
                id: u.employeeId || u.username || u.id,
                name: u.name,
                position: u.position || null,
                department: u.department || null
            })),

            channels: { ...sendChannels },
            timestamp: new Date().toLocaleString('th-TH', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            }),
            status: 'success'
        };


        const updatedHistory = [notification, ...notificationHistory];
        setNotificationHistory(updatedHistory);
        localStorage.setItem('notificationHistory', JSON.stringify(updatedHistory));

        try {
            // ( ... Logic การส่ง ... )
        } catch (error) {
            console.error('Error sending notification:', error);
        }

        setShowSuccessModal(true);
        setTimeout(() => {
            setTitle('');
            setMessage('');
            setRecipientGroups([]);
            setSendChannels({ line: false, sms: false, email: false });
        }, 2000);
    };

    // --- ฟังก์ชันล้างประวัติ ---
    const handleClearHistory = () => {
        setNotificationHistory([]); 
        localStorage.removeItem('notificationHistory'); 
        setShowClearConfirm(false); 
        showToast('ล้างประวัติการส่งทั้งหมดแล้ว', 'success'); 
    };
    
    // --- +++ [เพิ่มใหม่] ฟังก์ชันขอลบทีละรายการ +++ ---
    const requestDeleteNotification = (id) => {
        setSelectedHistory(null); // 1. ปิด Modal ประวัติ
        setDeletingId(id);       // 2. ตั้งค่า ID ที่จะลบ (เพื่อเปิด Modal ยืนยัน)
    };

    // --- +++ [เพิ่มใหม่] ฟังก์ชันยืนยันการลบทีละรายการ +++ ---
    const confirmDeleteNotification = () => {
        if (!deletingId) return;

        const updatedHistory = notificationHistory.filter(item => item.id !== deletingId);
        
        setNotificationHistory(updatedHistory);
        localStorage.setItem('notificationHistory', JSON.stringify(updatedHistory));
        
        setDeletingId(null); // ปิด Modal ยืนยัน
        showToast('ลบรายการแจ้งเตือนแล้ว', 'success');
    };


    // [ปรับปรุง] เพิ่ม showRecipientModal, showClearConfirm, และ deletingId
    useEffect(() => {
        if (showConfirmModal || showSuccessModal || selectedHistory || showRecipientModal || showClearConfirm || deletingId) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => { document.body.style.overflow = 'unset'; };
    }, [showConfirmModal, showSuccessModal, selectedHistory, showRecipientModal, showClearConfirm, deletingId]);

    useEffect(() => {
        function handleClickOutside(event) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsDropdownOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [dropdownRef]);
    // --- จบส่วน Logic ---


    return (
        <>
            <div className="flex-1 p-4 overflow-y-auto bg-gray-50 md:p-8 font-prompt">
                {/* Header */}
                <header className="mb-8">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="flex items-center justify-center w-12 h-12 bg-orange-600 shadow-lg rounded-xl">
                            <svg xmlns="http://www.w3.org/2000/svg" className="text-white h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                            </svg>
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold text-gray-800">การแจ้งเตือนแบบกลุ่ม</h1>
                            <p className="mt-1 text-gray-600">ส่งข้อความแจ้งเตือนไปยังกลุ่มเป้าหมายผ่าน LINE, SMS และ Email</p>
                        </div>
                    </div>
                </header>

                <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                    {/* ฟอร์มส่งแจ้งเตือน */}
                    <div className="space-y-6 lg:col-span-2">
                        {/* Card หลัก */}
                        <div className="overflow-hidden bg-white border border-gray-200 shadow-lg rounded-2xl">
                            <div className="p-6 text-white bg-orange-600">
                                <h2 className="flex items-center gap-2 text-xl font-bold">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
                                    </svg>
                                    สร้างข้อความแจ้งเตือน
                                </h2>
                                <p className="mt-1 text-sm text-orange-100">กรอกข้อมูลและเลือกกลุ่มเป้าหมาย</p>
                            </div>

                            <div className="p-6 space-y-5">
                                {/* หัวข้อ */}
                                <div>
                                    <label htmlFor="title" className="block mb-2 text-sm font-semibold text-gray-700">
                                        หัวข้อ <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        id="title"
                                        value={title}
                                        onChange={(e) => {
                                            setTitle(e.target.value);
                                            if (fieldErrors.title) setFieldErrors(prev => ({ ...prev, title: false }));
                                        }}
                                        placeholder="เช่น ประกาศด่วนสำหรับทีมช่าง"
                                        className={`w-full px-4 py-3 border-2 rounded-xl focus:outline-none transition-all ${
                                            fieldErrors.title 
                                                ? 'border-red-400 bg-red-50 focus:ring-2 focus:ring-red-500 shake' 
                                                : 'border-gray-300 focus:ring-2 focus:ring-orange-500 focus:border-transparent'
                                        }`}
                                    />
                                    {fieldErrors.title && (
                                        <p className="flex items-center gap-1 mt-1 text-xs text-red-600">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                            กรุณากรอกหัวข้อ
                                        </p>
                                    )}
                                </div>

                                {/* เลือกผู้รับ (ปุ่มดูรายชื่ออยู่ซ้ายล่าง) */}
                                <div>
                                    <label className="block mb-2 text-sm font-semibold text-gray-700">
                                        เลือกผู้รับ <span className="text-red-500">*</span>
                                    </label>

                                    {/* กล่องหลัก (ปุ่ม + Dropdown) */}
                                    <div className="relative" ref={dropdownRef}>
                                        <div
                                            role="button"
                                            tabIndex={0}
                                            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                                            className={`flex items-center justify-between w-full px-4 py-3 text-left bg-white border-2 rounded-xl transition-all cursor-pointer ${
                                                fieldErrors.recipients
                                                    ? 'border-red-400 bg-red-50 focus:ring-2 focus:ring-red-500 shake'
                                                    : 'border-gray-300 hover:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-500'
                                            }`}
                                        >
                                            <div className="flex-1 min-w-0">
                                                {recipientGroups.length === 0 ? (
                                                    <span className="text-gray-400">เลือกผู้รับ</span>
                                                ) : (
                                                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1"> 
                                                        {recipientGroups.map(val => {
                                                            const opt = recipientOptions.find(o => o.value === val);
                                                            const label = opt?.label || val;
                                                            return (
                                                                <span key={val} className="flex items-center gap-2 px-2 py-1 text-sm bg-gray-100 rounded-full">
                                                                    <span className="truncate max-w-[180px]">{label}</span>
                                                                    <button
                                                                        type="button"
                                                                        onClick={(e) => { e.stopPropagation(); removeRecipient(val); }}
                                                                        className="flex items-center justify-center w-5 h-5 text-gray-500 rounded-full hover:bg-gray-200"
                                                                        aria-label="ลบ"
                                                                    >
                                                                        &times;
                                                                    </button>
                                                                </span>
                                                            );
                                                        })}
                                                        <span className="ml-1 text-sm text-gray-500">
                                                            ({selectedUsers.length} คน)
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                            <svg className={`w-5 h-5 text-gray-400 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                            </svg>
                                        </div>
                                        
                                        {/* Dropdown Panel */}
                                        {isDropdownOpen && (
                                            <div className="absolute z-20 w-full mt-2 bg-white border border-gray-200 shadow-xl rounded-xl">
                                                <div className="p-3 border-b">
                                                    <input
                                                        type="text"
                                                        value={recipientSearch}
                                                        onChange={(e) => setRecipientSearch(e.target.value)}
                                                        placeholder="ค้นหาผู้รับ..."
                                                        className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                                                    />
                                                </div>
                                                <ul className="p-2 space-y-1 overflow-y-auto max-h-64">
                                                    {filteredRecipientOptions.length === 0 && (
                                                        <li className="p-3 text-sm text-gray-500">ไม่พบผลลัพธ์</li>
                                                    )}
                                                    {filteredRecipientOptions.map(option => (
                                                        <li key={option.value}>
                                                            <label className="flex items-center justify-between p-3 transition-colors rounded-lg cursor-pointer hover:bg-orange-50 group">
                                                                <div className="flex items-center">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={recipientGroups.includes(option.value)}
                                                                        onChange={() => {
                                                                            handleRecipientChange(option.value);
                                                                            if (fieldErrors.recipients) setFieldErrors(prev => ({ ...prev, recipients: false }));
                                                                        }}
                                                                        className="w-5 h-5 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
                                                                    />
                                                                    <span className="ml-3 font-medium text-gray-800 group-hover:text-orange-600">
                                                                        {option.label}
                                                                    </span>
                                                                </div>
                                                                <span className="px-2 py-1 text-sm text-gray-500 bg-gray-100 rounded-full">
                                                                    {option.count} คน
                                                                </span>
                                                            </label>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                    </div> {/* <-- จบ div.relative */}


                                    {/* [ตำแหน่งใหม่ - ซ้าย] ปุ่มดูรายชื่อ */}
                                    {recipientGroups.length > 0 && (
                                        <div className="mt-2 text-left"> 
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setIsDropdownOpen(false); 
                                                    setShowRecipientModal(true); 
                                                }}
                                                className="text-xs font-semibold text-orange-600 underline transition-colors hover:text-orange-700 focus:outline-none"
                                            >
                                                ดูรายชื่อผู้รับทั้งหมด ({selectedUsers.length} คน)
                                            </button>
                                        </div>
                                    )}

                                    {/* [ตำแหน่งใหม่] ข้อความ Error */}
                                    {fieldErrors.recipients && (
                                        <p className="flex items-center gap-1 mt-2 text-xs text-red-600">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                            กรุณาเลือกผู้รับ
                                        </p>
                                    )}
                                </div> {/* <-- จบ div "เลือกผู้รับ" */}


                                {/* ข้อความ */}
                                <div>
                                    <label htmlFor="message" className="block mb-2 text-sm font-semibold text-gray-700">
                                        ข้อความแจ้งเตือน <span className="text-red-500">*</span>
                                    </label>
                                    <textarea
                                        id="message"
                                        value={message}
                                        onChange={(e) => {
                                            setMessage(e.target.value);
                                            if (fieldErrors.message) setFieldErrors(prev => ({ ...prev, message: false }));
                                        }}
                                        rows="6"
                                        placeholder="พิมพ์ข้อความที่ต้องการส่ง..."
                                        className={`w-full px-4 py-3 border-2 rounded-xl focus:outline-none transition-all resize-none ${
                                            fieldErrors.message
                                                ? 'border-red-400 bg-red-50 focus:ring-2 focus:ring-red-500 shake'
                                                : 'border-gray-300 focus:ring-2 focus:ring-orange-500 focus:border-transparent'
                                        }`}
                                    ></textarea>
                                    <div className="flex items-center justify-between mt-1">
                                        <div>
                                            {fieldErrors.message && (
                                                <p className="flex items-center gap-1 text-xs text-red-600">
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                    </svg>
                                                    กรุณากรอกข้อความ
                                                </p>
                                            )}
                                        </div>
                                        <p className={`text-sm ${message.length < 10 && message.length > 0 ? 'text-orange-500 font-semibold' : 'text-gray-500'}`}>
                                            {message.length} ตัวอักษร
                                            {message.length > 0 && message.length < 10 && ' (ต้องการอย่างน้อย 10)'}
                                        </p>
                                    </div>
                                </div>

                                {/* เลือกช่องทางการส่ง */}
                                <div>
                                    <label className="block mb-3 text-sm font-semibold text-gray-700">
                                        เลือกช่องทางการส่ง <span className="text-red-500">*</span>
                                    </label>
                                    {fieldErrors.channels && (
                                        <div className="flex items-center gap-2 p-3 mb-3 text-sm text-red-700 border border-red-200 rounded-lg bg-red-50 shake">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                            กรุณาเลือกช่องทางการส่งอย่างน้อย 1 ช่องทาง
                                        </div>
                                    )}
                                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                                        {/* --- LINE Button --- */}
                                        <button
                                            type="button"
                                            onClick={() => {
                                                toggleChannel('line');
                                                if (fieldErrors.channels) setFieldErrors(prev => ({ ...prev, channels: false }));
                                            }}
                                            className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${
                                                sendChannels.line
                                                    ? 'border-green-500 bg-green-50 shadow-lg scale-105'
                                                    : 'border-gray-200 hover:border-green-300 hover:bg-gray-50'
                                            }`}
                                        >
                                            <div className={`${sendChannels.line ? 'text-green-700' : 'text-gray-700'} inline-flex items-center justify-center w-8 h-8`}>
                                                <LineIcon className="w-8 h-8" />
                                            </div>
                                            <span className={`font-semibold ${sendChannels.line ? 'text-green-700' : 'text-gray-700'}`}>
                                                LINE
                                            </span>
                                            {sendChannels.line && (
                                                <div className="flex items-center gap-1 text-xs text-green-600">
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                    </svg>
                                                    เลือกแล้ว
                                                </div>
                                            )}
                                        </button>

                                        {/* --- SMS Button --- */}
                                        <button
                                            type="button"
                                            onClick={() => {
                                                toggleChannel('sms');
                                                if (fieldErrors.channels) setFieldErrors(prev => ({ ...prev, channels: false }));
                                            }}
                                            className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${
                                                sendChannels.sms
                                                    ? 'border-orange-500 bg-orange-50 shadow-lg scale-105'
                                                    : 'border-gray-200 hover:border-orange-300 hover:bg-gray-50'
                                            }`}
                                        >
                                            <div className={`${sendChannels.sms ? 'text-orange-700' : 'text-gray-700'} inline-flex items-center justify-center w-8 h-8`}>
                                                <SmsIcon className="w-8 h-8" />
                                            </div>
                                            <span className={`font-semibold ${sendChannels.sms ? 'text-orange-700' : 'text-gray-700'}`}>
                                                SMS
                                            </span>
                                            {sendChannels.sms && (
                                                <div className="flex items-center gap-1 text-xs text-orange-600">
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                    </svg>
                                                    เลือกแล้ว
                                                </div>
                                            )}
                                        </button>

                                        {/* --- Email Button --- */}
                                        <button
                                            type="button"
                                            onClick={() => {
                                                toggleChannel('email');
                                                if (fieldErrors.channels) setFieldErrors(prev => ({ ...prev, channels: false }));
                                            }}
                                            className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${
                                                sendChannels.email
                                                    ? 'border-red-500 bg-red-50 shadow-lg scale-105'
                                                    : 'border-gray-200 hover:border-orange-300 hover:bg-gray-50'
                                            }`}
                                        >
                                            <div className={`${sendChannels.email ? 'text-red-700' : 'text-gray-700'} inline-flex items-center justify-center w-8 h-8`}>
                                                <EmailIcon className="w-8 h-8" />
                                            </div>
                                            <span className={`font-semibold ${sendChannels.email ? 'text-red-700' : 'text-gray-700'}`}>
                                                Email
                                            </span>
                                            {sendChannels.email && (
                                                <div className="flex items-center gap-1 text-xs text-red-600">
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                    </svg>
                                                    เลือกแล้ว
                                                </div>
                                            )}
                                        </button>
                                    </div>
                                </div>

                                {/* ปุ่มส่ง */}
                                <button
                                    onClick={handleSubmit}
                                    className="flex items-center justify-center w-full gap-2 py-4 font-bold text-white transition-all bg-orange-600 shadow-lg hover:bg-orange-700 rounded-xl hover:shadow-xl"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                    </svg>
                                    ส่งแจ้งเตือน
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* [โค้ดอัปเดต] ประวัติการแจ้งเตือน */}
                    <div className="lg:col-span-1">
                        <div className="sticky overflow-hidden bg-white border border-gray-200 shadow-lg rounded-2xl top-6">
                            {/* [ปรับปรุง] เพิ่มปุ่มล้างประวัติ */}
                            <div className="flex items-center justify-between p-5 text-white bg-orange-600">
                                <h2 className="flex items-center gap-2 text-lg font-bold">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    ประวัติการส่ง
                                </h2>
                                
                                {/* [เพิ่มใหม่] ปุ่มล้างประวัติ (จะแสดงเมื่อมีประวัติ) */}
                                {notificationHistory.length > 0 && (
                                    <button
                                        onClick={() => setShowClearConfirm(true)}
                                        className="flex items-center justify-center w-8 h-8 transition-colors rounded-full bg-white/20 hover:bg-white/30"
                                        aria-label="ล้างประวัติ"
                                        title="ล้างประวัติ"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                    </button>
                                )}
                            </div>

                            <div className="p-4 space-y-3 max-h-[calc(100vh-200px)] overflow-y-auto">
                                {notificationHistory.length === 0 ? (
                                    <div className="py-12 text-center">
                                        <div className="flex items-center justify-center w-20 h-20 mx-auto mb-4 bg-gray-100 rounded-full">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="w-10 h-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                                            </svg>
                                        </div>
                                        <p className="text-sm text-gray-500">ยังไม่มีประวัติการส่ง</p>
                                    </div>
                                ) : (
                                    notificationHistory.map((notification) => (
                                        <NotificationHistoryCard
                                            key={notification.id}
                                            notification={notification}
                                            onClick={() => setSelectedHistory(notification)}
                                        />
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Modals */}
            {showConfirmModal && (
                <ConfirmSendModal
                    data={{ title, recipientGroups, message }}
                    channels={sendChannels}
                    onConfirm={confirmSendNotification}
                    onClose={() => setShowConfirmModal(false)}
                    recipientOptions={recipientOptions}
                />
            )}

            {showSuccessModal && (
                <SuccessModal onClose={() => setShowSuccessModal(false)} />
            )}

            {selectedHistory && (
                <HistoryDetailModal
                    notification={selectedHistory}
                    onClose={() => setSelectedHistory(null)}
                    recipientOptions={recipientOptions}
                    onDelete={requestDeleteNotification} // <-- [เพิ่มใหม่] ส่งฟังก์ชันลบ
                />
            )}

         
            {showRecipientModal && (
                <RecipientListModal
                    users={selectedUsers}
                    onClose={() => setShowRecipientModal(false)}
                />
            )}

            
            {showClearConfirm && (
                <ConfirmClearModal
                    onConfirm={handleClearHistory}
                    onClose={() => setShowClearConfirm(false)}
                />
            )}

           
            {deletingId && (
                <ConfirmDeleteModal
                    onConfirm={confirmDeleteNotification}
                    onClose={() => setDeletingId(null)}
                />
            )}


            {/* Toast Notification */}
            {toast && (
                <Toast
                    message={toast.message}
                    type={toast.type}
                    onClose={closeToast}
                />
            )}

            {/* Style jsx */}
            <style jsx>{`
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes scaleIn {
                    from { 
                        opacity: 0;
                        transform: scale(0.9);
                    }
                    to { 
                        opacity: 1;
                        transform: scale(1);
                    }
                }
                @keyframes slideInRight {
                    from {
                        opacity: 0;
                        transform: translateX(100%);
                    }
                    to {
                        opacity: 1;
                        transform: translateX(0);
                    }
                }
                @keyframes shake {
                    0%, 100% { transform: translateX(0); }
                    10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
                    20%, 40%, 60%, 80% { transform: translateX(5px); }
                }
                .animate-fadeIn {
                    animation: fadeIn 0.2s ease-out;
                }
                .animate-scaleIn {
                    animation: scaleIn 0.3s ease-out;
                }
                .animate-slideInRight {
                    animation: slideInRight 0.3s ease-out;
                }
                .shake {
                    animation: shake 0.5s ease-in-out;
                }
            `}</style>
        </>
    );
}

export default GroupNotificationScreen;
