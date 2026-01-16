import React, { createContext, useContext, useState, useEffect } from 'react';

// สร้าง Context สำหรับจัดการข้อมูลการลาทั้งหมด - ทำให้คอมโพเนนต์ไหนก็เข้าถึงข้อมูลลาได้หมด
const LeaveContext = createContext();

// Hook ที่ใช้เรียกข้อมูลลาจาก Context - ใช้แทนการเขียน useContext(LeaveContext) ยาวๆ
export const useLeave = () => {
    const context = useContext(LeaveContext);
    if (!context) {
        throw new Error('useLeave must be used within a LeaveProvider'); // ป้องกันการเรียกใช้นอก Provider
    }
    return context;
};

export const LeaveProvider = ({ children }) => {
    // เก็บรายการลาทั้งหมด - อ่านจาก localStorage เท่านั้น ไม่ใช้ mock data
    const [leaveList, setLeaveList] = useState(() => {
        const saved = localStorage.getItem('leaveList');
        return saved ? JSON.parse(saved) : []; // เริ่มต้นเป็น array ว่าง
    });

    // กำหนดจำนวนวันลาที่มีสิทธิ์สำหรับแต่ละประเภทการลา - อ่านจาก localStorage (แก้ไขได้โดย HR Admin)
    const [leaveQuota, setLeaveQuota] = useState(() => {
        const saved = localStorage.getItem('leaveQuotaSettings');
        if (saved) {
            // ถ้ามีการตั้งค่าใน localStorage ให้ใช้ค่านั้น
            return JSON.parse(saved);
        }
        // ถ้าไม่มี ใช้ค่าเริ่มต้น
        return {
            'ลาป่วย': { totalDays: 60, requireDocument: true, documentAfterDays: 3 },
            'ลากิจ': { totalDays: 45, requireDocument: false, documentAfterDays: 0 },
            'ลาพักร้อน': { totalDays: 10, requireDocument: false, documentAfterDays: 0 },
            'ลาคลอด': { totalDays: 90, requireDocument: false, documentAfterDays: 0 },
            'ลาเพื่อทำหมัน': { totalDays: 30, requireDocument: true, documentAfterDays: 0 },
            'ลาเพื่อรับราชการทหาร': { totalDays: 60, requireDocument: true, documentAfterDays: 0 },
            'ลาเพื่อฝึกอบรม': { totalDays: 30, requireDocument: false, documentAfterDays: 0 },
            'ลาไม่รับค่าจ้าง': { totalDays: 90, requireDocument: false, documentAfterDays: 0 }
        };
    });

    // Sync leaveQuota กับ localStorage เมื่อมีการเปลี่ยนแปลง
    useEffect(() => {
        const handleQuotaChange = () => {
            const saved = localStorage.getItem('leaveQuotaSettings');
            if (saved) {
                setLeaveQuota(JSON.parse(saved));
            }
        };

        // ดูการเปลี่ยนแปลงจาก localStorage
        window.addEventListener('storage', handleQuotaChange);
        window.addEventListener('leaveQuotaUpdated', handleQuotaChange);

        return () => {
            window.removeEventListener('storage', handleQuotaChange);
            window.removeEventListener('leaveQuotaUpdated', handleQuotaChange);
        };
    }, []);

    // เก็บรายการขอเข้างานสายแยกต่างหาก - ไม่ปนกับการลา
    const [lateArrivalList, setLateArrivalList] = useState(() => {
        const saved = localStorage.getItem('lateArrivalList');
        return saved ? JSON.parse(saved) : [];
    });

    // บันทึกรายการเข้างานสายลง localStorage ทุกครั้งที่มีการเปลี่ยนแปลง
    useEffect(() => {
        localStorage.setItem('lateArrivalList', JSON.stringify(lateArrivalList));
    }, [lateArrivalList]);

    // บันทึกรายการลาลง localStorage ทุกครั้งที่มีการเปลี่ยนแปลง - ทำให้ข้อมูลไม่หายตอน refresh
    useEffect(() => {
        localStorage.setItem('leaveList', JSON.stringify(leaveList));
    }, [leaveList]);

    // ระบบ Real-time Sync - ดูการเปลี่ยนแปลงจากแท็บอื่นหรือคอมโพเนนต์อื่น
    useEffect(() => {
        // จับเหตุการณ์เมื่อ localStorage เปลี่ยน (เช่นแท็บอื่นเพิ่มการลาใหม่)
        const handleStorageChange = (e) => {
            if (e.key === 'leaveList' && e.newValue) {
                const newList = JSON.parse(e.newValue);
                setLeaveList(newList); // อัพเดทรายการลาให้ตรงกับแท็บอื่น
            }
        };

        // จับเหตุการณ์เมื่อมีการสร้างคำขอลาใหม่
        const handleLeaveRequestCreated = () => {
            const saved = localStorage.getItem('leaveList');
            if (saved) {
                setLeaveList(JSON.parse(saved)); // โหลดข้อมูลใหม่ทันทีที่มีคำขอลาใหม่
            }
        };

        // จับเหตุการณ์เมื่อมีการอัพเดทสถานะการลา (อนุมัติ/ไม่อนุมัติ)
        const handleLeaveStatusUpdated = () => {
            const saved = localStorage.getItem('leaveList');
            if (saved) {
                setLeaveList(JSON.parse(saved)); // รีเฟรชข้อมูลให้เห็นสถานะใหม่ทันที
            }
        };

        // ตรวจดูการเปลี่ยนแปลงจาก localStorage และเหตุการณ์ทั้งหมด
        window.addEventListener('storage', handleStorageChange);
        window.addEventListener('leaveRequestCreated', handleLeaveRequestCreated);
        window.addEventListener('leaveStatusUpdated', handleLeaveStatusUpdated);

        // ทำความสะอาดตอนคอมโพเนนต์ถูกทำลาย - ป้องกัน memory leak
        return () => {
            window.removeEventListener('storage', handleStorageChange);
            window.removeEventListener('leaveRequestCreated', handleLeaveRequestCreated);
            window.removeEventListener('leaveStatusUpdated', handleLeaveStatusUpdated);
        };
    }, []);

    // คำนวณจำนวนวันลาที่ใช้ไปแล้วสำหรับแต่ละประเภท - นับเฉพาะที่ได้รับอนุมัติเท่านั้น
    // รองรับการนับแยกตาม userId หรือนับรวมทุกคน (ถ้าไม่ส่ง userId มา)
    const getUsedDays = (leaveType, userId = null) => {
        return leaveList
            .filter(leave => {
                // กรองตามประเภทการลาและสถานะอนุมัติ
                const matchType = leave.leaveType === leaveType && leave.status === 'อนุมัติ';
                
                // ถ้าส่ง userId มา ให้กรองเฉพาะ user นั้น ถ้าไม่ส่งมาให้นับทุกคน
                const matchUser = userId ? leave.userId === userId : true;
                
                return matchType && matchUser;
            })
            .reduce((total, leave) => {
                // แปลงเป็นวันตามประเภท
                let daysCount = 0;
                
                if (leave.leaveMode === 'hourly') {
                    // ลารายชั่วโมง - แยกชั่วโมงออกมา
                    const hourMatch = leave.days.match(/(\d+)\s*ชม/);
                    const hours = hourMatch ? parseInt(hourMatch[1]) : 0;
                    
                    // ตามกฎ: ≤ 4 ชม. = 0.5 วัน, > 4 ชม. = 1 วัน
                    daysCount = hours <= 4 ? 0.5 : 1;
                } else {
                    // ลาเต็มวัน - แปลงตัวเลขจาก "4 วัน" เป็น 4
                    daysCount = parseFloat(leave.days) || 0;
                }
                
                return total + daysCount;
            }, 0); // เริ่มนับจาก 0
    };

    // คำนวณจำนวนวันระหว่างวันเริ่มต้นและวันสิ้นสุด - ใช้สำหรับหาว่าลากี่วัน
    const calculateDays = (startDate, endDate) => {
        const start = new Date(startDate.split('/').reverse().join('-')); // แปลง dd/mm/yyyy เป็น yyyy-mm-dd แล้วสร้าง Date object
        const end = new Date(endDate.split('/').reverse().join('-'));
        const diffTime = Math.abs(end - start); // หาผลต่างเวลาเป็น milliseconds
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // แปลงเป็นวัน แล้ว +1 เพราะนับวันเริ่มต้นด้วย
        return diffDays;
    };

    // จัดรูปแบบข้อความช่วงเวลาให้สวยงามและอ่านง่าย
    const formatPeriod = (startDate, endDate, startTime, endTime) => {
        if (startTime && endTime) {
            // ถ้ามีเวลา = ลารายชั่วโมง แสดงแบบ "01/01/2025 (09:00 - 12:00)"
            return `${startDate} (${startTime} - ${endTime})`;
        }
        if (startDate === endDate) {
            // ถ้าลาวันเดียว แสดงแค่วันเดียว
            return startDate;
        }
        // ถ้าลาหลายวัน แสดงแบบ "01/01/2025 → 05/01/2025"
        return `${startDate} → ${endDate}`;
    };

    // ฟังก์ชันเพิ่มคำขอลาใหม่ - หัวใจสำคัญของระบบลา
    const addLeave = (leaveData) => {
        
        let days, period;
        
        // เช็คว่าเป็นการลารายชั่วโมงหรือเต็มวัน
        if (leaveData.leaveMode === 'hourly') {
            // กรณีลารายชั่วโมง - คำนวณจากเวลาเริ่มต้นและสิ้นสุด
            const [startHour, startMin] = leaveData.startTime.split(':').map(Number); // แยกชั่วโมงกับนาที
            const [endHour, endMin] = leaveData.endTime.split(':').map(Number);
            const startMinutes = startHour * 60 + startMin; // แปลงเป็นนาทีทั้งหมด
            const endMinutes = endHour * 60 + endMin;
            const diffMinutes = endMinutes - startMinutes; // หาผลต่าง
            const hours = Math.floor(diffMinutes / 60); // ได้กี่ชั่วโมงเต็ม
            const minutes = diffMinutes % 60; // เหลือกี่นาที
            
            // จัดรูปแบบข้อความให้สวยงาม เช่น "2 ชม. 30 นาที" หรือ "3 ชั่วโมง"
            days = minutes > 0 ? `${hours} ชม. ${minutes} นาที` : `${hours} ชั่วโมง`;
            period = formatPeriod(leaveData.startDate, leaveData.endDate, leaveData.startTime, leaveData.endTime);
        } else {
            // กรณีลาเต็มวัน - คำนวณจำนวนวัน
            days = `${calculateDays(leaveData.startDate, leaveData.endDate)} วัน`;
            period = formatPeriod(leaveData.startDate, leaveData.endDate);
        }
        
        // สร้าง object คำขอลาใหม่
        const newLeave = {
            id: Date.now(), // ใช้ timestamp เป็น ID ไม่ซ้ำกัน
            leaveType: leaveData.leaveType,
            days: days,
            category: leaveData.leaveType,
            period: period,
            startDate: leaveData.startDate,
            endDate: leaveData.endDate,
            startTime: leaveData.startTime || null,
            endTime: leaveData.endTime || null,
            leaveMode: leaveData.leaveMode || 'fullday',
            reason: leaveData.reason,
            status: 'รออนุมัติ', // สถานะเริ่มต้นเป็นรออนุมัติเสมอ
            statusColor: 'yellow', // สีเหลืองสำหรับรออนุมัติ
            documents: leaveData.documents || [],
            userId: leaveData.userId, // เก็บ userId สำหรับ integration
            userName: leaveData.userName // เก็บ userName สำหรับ integration
        };
        
        setLeaveList(prev => [newLeave, ...prev]); // เพิ่มเข้าไปด้านหน้าสุด (รายการใหม่อยู่บนสุด)
        
        // บันทึกลง localStorage ทันที
        const updatedList = [newLeave, ...leaveList];
        localStorage.setItem('leaveList', JSON.stringify(updatedList));
        
        // ส่งสัญญาณแจ้งเตือนทันทีที่มีการขอลา - ทำให้คอมโพเนนต์อื่นรู้ทันที
        window.dispatchEvent(new CustomEvent('leaveRequestCreated', {
            detail: { leave: newLeave }
        }));
        
        return newLeave; // ส่งข้อมูลลากลับไปให้ผู้เรียกใช้
    };

    // ฟังก์ชันเพิ่มคำขอเข้างานสาย - บันทึกใน leaveList เหมือนการลาปกติ
    const addLateArrival = (lateArrivalData) => {
        // คำนวณระยะเวลาที่สายจากเวลาเริ่มต้นและสิ้นสุด
        const [startHour, startMin] = lateArrivalData.startTime.split(':').map(Number);
        const [endHour, endMin] = lateArrivalData.endTime.split(':').map(Number);
        const startMinutes = startHour * 60 + startMin;
        const endMinutes = endHour * 60 + endMin;
        const diffMinutes = endMinutes - startMinutes;
        const hours = Math.floor(diffMinutes / 60);
        const minutes = diffMinutes % 60;
        
        const duration = minutes > 0 ? `${hours} ชม. ${minutes} นาที` : `${hours} ชั่วโมง`;
        const period = formatPeriod(lateArrivalData.date, lateArrivalData.date, lateArrivalData.startTime, lateArrivalData.endTime);

        const newLateArrival = {
            id: Date.now(),
            leaveType: 'ขอเข้างานสาย',
            days: duration,
            category: 'ขอเข้างานสาย',
            period: period,
            startDate: lateArrivalData.date,
            endDate: lateArrivalData.date,
            startTime: lateArrivalData.startTime,
            endTime: lateArrivalData.endTime,
            leaveMode: 'hourly', // ระบุว่าเป็นลารายชั่วโมง
            reason: lateArrivalData.reason,
            status: 'รออนุมัติ',
            statusColor: 'yellow',
            documents: lateArrivalData.documents || [],
            userId: lateArrivalData.userId,
            userName: lateArrivalData.userName
        };
        
        // บันทึกใน leaveList แทน lateArrivalList
        setLeaveList(prev => [newLateArrival, ...prev]);
        
        // บันทึกลง localStorage ทันที
        const updatedList = [newLateArrival, ...leaveList];
        localStorage.setItem('leaveList', JSON.stringify(updatedList));
        
        // ส่งสัญญาณแจ้งเตือนทันทีที่มีการขอเข้างานสาย
        window.dispatchEvent(new CustomEvent('leaveRequestCreated', {
            detail: { leave: newLateArrival }
        }));
        
        return newLateArrival;
    };

    // อัพเดทข้อมูลคำขอลา - ใช้ตอนต้องการแก้ไขข้อมูล
    const updateLeave = (id, updates) => {
        setLeaveList(prev => prev.map(leave => 
            leave.id === id ? { ...leave, ...updates } : leave // ถ้า id ตรงก็อัพเดท ไม่ตรงก็เก็บไว้เหมือนเดิม
        ));
    };

    // ลบคำขอลาออกจากรายการ - ลบถาวร
    const deleteLeave = (id) => {
        setLeaveList(prev => prev.filter(leave => leave.id !== id)); // กรองเอาตัวที่ไม่ใช่ id นี้ออกมา
    };

    // ยกเลิกคำขอลา - ใช้ได้เฉพาะสถานะ "รออนุมัติ" เท่านั้น (ถ้าอนุมัติแล้วจะยกเลิกไม่ได้)
    const cancelLeave = (id) => {
        // เช็คในรายการลา (รวมทั้งลาปกติและเข้างานสาย)
        const leave = leaveList.find(l => l.id === id);
        if (leave && leave.status === 'รออนุมัติ') {
            deleteLeave(id); // ถ้าเจอและยังรออนุมัติก็ลบได้
            return true;
        }
        return false; // ถ้าไม่เจอหรือไม่ใช่รออนุมัติ ก็ยกเลิกไม่ได้
    };

    // สร้างข้อมูลสรุปสิทธิ์การลาทั้งหมด - แสดงบนหน้า Dashboard
    // รองรับการแสดงสรุปของ user เฉพาะคน หรือของทุกคน (ถ้าไม่ส่ง userId)
    const getLeaveSummary = (userId = null) => {
        return Object.keys(leaveQuota).map(type => ({
            title: type, // ชื่อประเภทลา เช่น "ลาป่วย"
            description: getLeaveDescription(type), // คำอธิบายเงื่อนไข
            daysUsed: getUsedDays(type, userId), // วันที่ใช้ไปแล้วของ user นี้ (หรือทุกคนถ้าไม่ส่ง userId)
            totalDays: leaveQuota[type].totalDays, // วันที่มีสิทธิ์ทั้งหมด
            rules: getLeaveRules(type) // กฎเกณฑ์การลา
        }));
    };

    // ดึงคำอธิบายแต่ละประเภทลา - แสดงเป็นข้อความสั้นๆ
    const getLeaveDescription = (type) => {
        const descriptions = {
            'ลาป่วย': 'ลาป่วยไม่เกิน 60 วัน/ปี กรณีลาป่วยตั้งแต่ 3 วันขึ้นไป จำเป็นต้องมีใบรับรองแพทย์',
            'ลากิจ': 'ปีแรกลาได้ไม่เกิน 15 วัน/ปี ปีถัดไปลาได้ไม่เกิน 45 วัน/ปี ต้องได้รับอนุมัติก่อน',
            'ลาพักร้อน': 'ลาได้ไม่เกิน 10 วัน/ปี สะสมได้ไม่เกิน 20 วัน',
            'ลาคลอด': 'ลาคลอดบุตรได้ไม่เกิน 90 วัน ไม่จำเป็นต้องมีใบรับรองแพทย์',
            'ลาเพื่อทำหมัน': 'ลาได้ตามระยะเวลาที่แพทย์กำหนดและออกใบรับรอง โดยได้รับค่าจ้าง',
            'ลาเพื่อรับราชการทหาร': 'ลาเพื่อเรียกพล ฝึกวิชาทหาร หรือทดสอบความพร้อม ได้รับค่าจ้างไม่เกิน 60 วันต่อปี',
            'ลาเพื่อฝึกอบรม': 'ลาเพื่อฝึกอบรมหรือพัฒนาความรู้ ไม่ได้รับค่าจ้างในวันลา',
            'ลาไม่รับค่าจ้าง': 'ลาเพื่อธุระส่วนตัว ติดตามคู่สมรส หรือพักฟื้น ไม่เกิน 90 วันต่อปี ไม่ได้รับค่าจ้าง'
        };
        return descriptions[type] || ''; // ถ้าไม่เจอคืนค่าว่าง
    };

    // ดึงกฎเกณฑ์ของแต่ละประเภทลา - เป็น Array ของข้อความ
    const getLeaveRules = (type) => {
        const rules = {
            'ลาป่วย': [
                'ลาป่วยได้ไม่เกิน 60 วัน/ปี',
                'กรณีลาป่วยตั้งแต่ 3 วันขึ้นไป จำเป็นต้องมีใบรับรองแพทย์',
                'ยื่นใบลาป่วยทันทีที่กลับมาทำงานวันแรก',
                'กรณีแพทย์นัดล่วงหน้า ให้ยื่นใบลาป่วยก่อนถึงวันนัดหมาย'
            ],
            'ลากิจ': [
                'สำหรับปีแรกที่เข้าทำงาน ลากิจได้ไม่เกิน 15 วัน/ปี',
                'ในปีถัดๆ ไป ลากิจได้ไม่เกิน 45 วัน/ปี',
                'ในกรณีลาเพื่อเลี้ยงบุตร สามารถใช้สิทธิต่อจากการลาคลอดบุตร ได้ไม่เกิน 150 วัน',
                'จำเป็นต้องได้รับการอนุมัติจากผู้บังคับบัญชาก่อน จึงจะสามารถใช้วันลากิจส่วนตัวได้',
                'กรณีงานมีเหตุฉุกเฉิน สามารถเรียกตัวกลับได้ทุกเมื่อ'
            ],
            'ลาพักร้อน': [
                'ลาได้ไม่เกิน 10 วัน/ปี หากบรรจุเป็นราชการไม่ครบ 6 เดือน ไม่ได้รับสิทธิ์ลาพักผ่อน',
                'สะสมวันลาได้ไม่เกิน 20 วัน',
                'จำเป็นต้องได้รับการอนุมัติจากผู้บังคับบัญชาก่อน จึงจะสามารถใช้วันลาพักผ่อนได้',
                'กรณีงานมีเหตุฉุกเฉิน สามารถเรียกตัวกลับได้ทุกเมื่อ'
            ],
            'ลาคลอด': [
                'ลาคลอดบุตรได้ไม่เกิน 90 วัน',
                'ไม่จำเป็นต้องมีใบรับรองแพทย์',
                'ยื่นใบลาคลอดบุตรล่วงหน้า หรือในวันลา เพื่อเสนอต่อผู้บังคับบัญชาให้ทำการอนุมัติตามลำดับ'
            ],
            'ลาเพื่อทำหมัน': [
                'ลูกจ้างมีสิทธิ์ลาเพื่อทำหมันได้',
                'มีสิทธิ์ลาเนื่องจากการทำหมันตามระยะเวลาที่แพทย์แผนปัจจุบันชั้นหนึ่งกำหนดและออกใบรับรองให้',
                'ลูกจ้างมีสิทธิ์ได้รับค่าจ้างในวันลานั้นด้วย',
                'ต้องแนบใบรับรองแพทย์'
            ],
            'ลาเพื่อรับราชการทหาร': [
                'ลูกจ้างมีสิทธิ์ลาเพื่อรับราชการทหารในการเรียกพลเพื่อตรวจสอบ',
                'เพื่อฝึกวิชาทหาร หรือเพื่อทดสอบความพร้อม',
                'ลาได้เท่ากับจำนวนวันที่ทางการทหารเรียก',
                'ได้รับค่าจ้างตลอดเวลาที่ลาแต่ไม่เกิน 60 วันต่อปี',
                'ต้องแนบหนังสือเรียกตัวจากทางการทหาร'
            ],
            'ลาเพื่อฝึกอบรม': [
                'ลูกจ้างมีสิทธิ์ลาเพื่อการฝึกอบรมหรือพัฒนาความรู้ความสามารถ',
                'ดำเนินการตามหลักเกณฑ์และวิธีการที่กำหนดในกฎกระทรวง',
                'ไม่ได้รับค่าจ้างในวันลานั้น',
                'ต้องได้รับการอนุมัติจากผู้บังคับบัญชาก่อน'
            ],
            'ลาไม่รับค่าจ้าง': [
                'สามารถลาได้เพื่อเหตุผลส่วนตัว เช่น ไปทำธุระส่วนตัว ติดตามคู่สมรสไปต่างประเทศ พักฟื้นยาวหลังลาป่วย',
                'ต้องยื่นคำร้องล่วงหน้าอย่างน้อย 15-30 วัน (ขึ้นอยู่กับระยะเวลาที่ลา)',
                'ลาได้ไม่เกิน 90 วันต่อปี',
                'ไม่ได้รับค่าจ้างในวันลา',
                'ต้องได้รับการอนุมัติจากผู้บังคับบัญชาก่อน'
            ],
            'ขอเข้างานสาย': [
                'สามารถขอเข้างานสายได้เฉพาะกรณีเจอเหตุสุดวิสัยในระหว่างมาทำงาน',
                'ต้องระบุเหตุผลที่ชัดเจนและสมเหตุสมผล',
                'ควรแนบรูปภาพหลักฐานประกอบการพิจารณา (ถ้ามี)',
                'วันที่ขอจะถูกล็อคเป็นวันปัจจุบันเท่านั้น',
                'ต้องได้รับการอนุมัติจากผู้บังคับบัญชา'
            ]
        };
        return rules[type] || [];
    };

    // Get leaves by type
    const getLeavesByType = (leaveType) => {
        if (!leaveType) return leaveList;
        return leaveList.filter(leave => leave.leaveType === leaveType);
    };

    // ฟังก์ชันสำหรับ Manager - เปลี่ยนสถานะลาโดยตรง
    const updateLeaveStatus = (id, newStatus) => {
        const statusColors = {
            'รออนุมัติ': 'yellow',
            'อนุมัติ': 'green',
            'ไม่อนุมัติ': 'red'
        };
        
        setLeaveList(prev => {
            const updated = prev.map(leave => {
                if (leave.id === id) {
                    const updatedLeave = {
                        ...leave,
                        status: newStatus,
                        statusColor: statusColors[newStatus] || 'yellow'
                    };
                    
                    // ส่งสัญญาณแจ้งเตือนทันทีที่มีการอนุมัติ/ไม่อนุมัติ - ทำให้คอมโพเนนต์อื่นรู้ทันที
                    window.dispatchEvent(new CustomEvent('leaveStatusUpdated', {
                        detail: { leave: updatedLeave, oldStatus: leave.status, newStatus }
                    }));
                    
                    return updatedLeave;
                }
                return leave;
            });
            
            // บันทึกลง localStorage (สำคัญมาก!)
            localStorage.setItem('leaveList', JSON.stringify(updated));
            
            // ส่งสัญญาณไปที่แท็บอื่นด้วย - cross-tab sync
            window.dispatchEvent(new StorageEvent('storage', {
                key: 'leaveList',
                newValue: JSON.stringify(updated),
                url: window.location.href
            }));
            
            return updated;
        });
    };

    // ตรวจสอบความถูกต้องของคำขอลาตามกฎเกณฑ์ - ป้องกันการลาผิดกฎ
    const validateLeaveRequest = (leaveData) => {
        const { leaveType, startDate, endDate, documents, leaveMode, userId } = leaveData;
        const errors = []; // เก็บข้อผิดพลาดทั้งหมด

        // ดึงเงื่อนไขการลาจาก leaveQuota (อ่านจาก localStorage)
        const quotaConfig = leaveQuota[leaveType];
        
        if (!quotaConfig) {
            errors.push('ประเภทการลาไม่ถูกต้อง');
            return { isValid: false, errors };
        }

        // คำนวณจำนวนวันสำหรับตรวจสอบ
        let totalDays = 0;
        if (leaveMode === 'fullday') {
            totalDays = calculateDays(startDate, endDate);
        }

        // เช็คเงื่อนไขเอกสารแนบตามที่ HR Admin ตั้งไว้
        if (quotaConfig.requireDocument) {
            const needDocument = quotaConfig.documentAfterDays === 0 
                ? true  // ต้องแนบทุกครั้ง
                : totalDays >= quotaConfig.documentAfterDays; // ต้องแนบเมื่อลาเกินจำนวนวันที่กำหนด
            
            if (needDocument && (!documents || documents.length === 0)) {
                if (quotaConfig.documentAfterDays === 0) {
                    errors.push(`${leaveType} ต้องแนบเอกสาร/ใบรับรองทุกครั้ง`);
                } else {
                    errors.push(`กรณี${leaveType}ตั้งแต่ ${quotaConfig.documentAfterDays} วันขึ้นไป จำเป็นต้องแนบเอกสาร/ใบรับรอง`);
                }
            }
        }
        
        // เช็คว่ามีวันลาเหลือพอไหม - นับเฉพาะของ user นี้
        const daysUsed = getUsedDays(leaveType, userId);
        const daysAvailable = quotaConfig.totalDays - daysUsed;
        
        // ถ้าโควต้าไม่ใช่ไม่จำกัด (999) ให้เช็ค
        if (quotaConfig.totalDays < 999 && totalDays > daysAvailable) {
            errors.push(`คุณมีสิทธิ์${leaveType}เหลืออีก ${daysAvailable} วัน (ลาได้ไม่เกิน ${quotaConfig.totalDays} วัน/ปี)`);
        }

        // ส่งผลลัพธ์กลับไป บอกว่าผ่านหรือไม่ผ่าน พร้อมรายการข้อผิดพลาด
        return {
            isValid: errors.length === 0, // true ถ้าไม่มี error
            errors: errors // Array ของข้อความ error
        };
    };

    // รวม value ทั้งหมดที่จะส่งออกให้คอมโพเนนต์อื่นใช้
    const value = {
        leaveList,              // รายการลาทั้งหมด
        lateArrivalList,        // รายการเข้างานสายทั้งหมด
        leaveQuota,             // โควต้าวันลาแต่ละประเภท
        addLeave,               // ฟังก์ชันเพิ่มคำขอลาใหม่
        addLateArrival,         // ฟังก์ชันเพิ่มคำขอเข้างานสาย
        updateLeave,            // ฟังก์ชันอัพเดทข้อมูลลา
        deleteLeave,            // ฟังก์ชันลบรายการลา
        cancelLeave,            // ฟังก์ชันยกเลิกคำขอลา
        getUsedDays,            // ฟังก์ชันดูจำนวนวันที่ใช้ไปแล้ว
        getLeaveSummary,        // ฟังก์ชันดึงสรุปสิทธิ์การลา
        getLeavesByType,        // ฟังก์ชันกรองลาตามประเภท
        calculateDays,          // ฟังก์ชันคำนวณจำนวนวัน
        updateLeaveStatus,      // ฟังก์ชันอัพเดทสถานะการลา (สำหรับ Manager)
        validateLeaveRequest,   // ฟังก์ชันตรวจสอบความถูกต้องของคำขอลา
        getLeaveRules           // ฟังก์ชันดึงกฎเกณฑ์การลา
    };

    // ส่ง Context ออกไปให้ component ลูกทั้งหมดใช้งานได้
    return (
        <LeaveContext.Provider value={value}>
            {children}
        </LeaveContext.Provider>
    );
};

export default LeaveProvider;
