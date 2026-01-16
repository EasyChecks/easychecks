/**
 * ATTENDANCE_CONFIG - การกำหนดค่าระบบเข้างานออกงาน
 * 
 * กฎเกณฑ์การเข้างาน-ออกงานที่ครบถ้วน ตามมาตรฐานองค์กร
 */

export const ATTENDANCE_CONFIG = {
  // Grace Period - ช่วงเวลาผ่อนผันก่อนเวลาเข้างาน
  GRACE_PERIOD_MINUTES: 15, // 15 นาที (เช่น กะ 09:00 → สามารถ check-in ตั้งแต่ 08:45)
  
  // Late Threshold - เกณฑ์การมาสาย
  LATE_THRESHOLD_MINUTES: 30, // 30 นาที
  // ตรรกะ: ≤30 นาที = มาสาย, >30 นาที = ขาด
  
  // Auto Checkout Time - เวลา checkout อัตโนมัติสำหรับคนลืม
  AUTO_CHECKOUT_TIME: '00:00', // เที่ยงคืน - สำหรับกะกลางวันที่ลืม checkout
  
  // Noon Cutoff - เวลาตัด checkout สำหรับกะข้ามวัน
  NOON_CUTOFF_TIME: '12:00', // เที่ยงวัน - สำหรับกะกลางคืนที่ข้ามวัน
  
  // เวลาแบ่งกะกลางวัน/กลางคืน
  NIGHT_SHIFT_START: '18:00', // กะที่เริ่มหลัง 18:00 ถือว่าเป็นกะกลางคืน
  DAY_SHIFT_END: '18:00',     // กะที่สิ้นสุดก่อน 18:00 ถือว่าเป็นกะกลางวัน
  
  // Consecutive Shift Gap - ช่วงห่างสูงสุดระหว่างกะติดกัน
  CONSECUTIVE_SHIFT_GAP_MINUTES: 30, // 30 นาที
  // ตัวอย่าง: กะ 09:00-10:00 และ 10:00-11:00 → check-in ครั้งเดียวได้
  
  // Status Types
  STATUS: {
    ON_TIME: 'on_time',      // ตรงเวลา
    LATE: 'late',            // มาสาย (≤30 นาที)
    ABSENT: 'absent',        // ขาด (>30 นาที หรือไม่มา)
    LEAVE: 'leave'           // ลา
  },
  
  // Status Labels (Thai)
  STATUS_LABELS: {
    on_time: 'ตรงเวลา',
    late: 'มาสาย',
    absent: 'ขาด',
    leave: 'ลา'
  }
};

/**
 * กฎการคำนวณสถานะ:
 * 
 * 1. Grace Period (15 นาที ก่อนกะ):
 *    - กะ 09:00 → สามารถ check-in ตั้งแต่ 08:45 = ตรงเวลา
 * 
 * 2. Late Threshold (30 นาที):
 *    - check-in 09:01-09:30 = มาสาย
 *    - check-in >09:30 = ขาด + auto checkout
 * 
 * 3. กะติดกัน:
 *    - กะ 09:00-10:00, 10:00-11:00
 *    - ถ้า check-in 08:55 → ครอบคลุมทั้งสองกะ
 * 
 * 4. ลืม checkout:
 *    - กะกลางวัน (สิ้นสุดก่อน 18:00) → Auto checkout ที่ 00:00 (เที่ยงคืน)
 *    - กะกลางคืน (เริ่มหลัง 18:00) → ใช้กฎกะข้ามวัน (ตัดที่เที่ยง)
 * 
 * 5. กะข้ามวัน:
 *    - กะกลางคืน (22:00-06:00) → checkout ตัดที่ 12:00 วันถัดไป
 *    - กะกลางวัน (16:00-02:00) → checkout ตัดที่ 00:00
 * 
 * 6. ป้องกัน double check-in:
 *    - ถ้ามี check-in แล้ว ไม่สามารถ check-in ซ้ำได้
 */

export default ATTENDANCE_CONFIG;
