type AxiosErrorShape = {
  code?: string;
  message?: string;
  response?: {
    status?: number;
    data?: {
      message?: string;
      error?: string;
    };
  };
};

function normalizeApiMessage(message: string): string {
  if (message.includes('มีคำขอมาสายในวันนี้อยู่แล้ว')) {
    return 'คุณได้ส่งคำขอมาสายของวันนี้ไปแล้ว';
  }
  if (message.includes('รูปแบบเวลาไม่ถูกต้อง')) {
    return 'รูปแบบเวลาไม่ถูกต้อง กรุณากรอกเวลาเป็น ชม.:นาที';
  }
  if (
    message.includes('เวลามาถึงต้องมากกว่าเวลาที่กำหนด') ||
    message.includes('เวลาที่มาจริงต้องหลังเวลาที่กำหนด')
  ) {
    return 'เวลาที่มาจริงต้องมากกว่าเวลาที่กำหนด';
  }
  if (message.includes('ไม่พบผู้ใช้')) {
    return 'ไม่พบข้อมูลผู้ใช้ กรุณาเข้าสู่ระบบใหม่';
  }
  if (message.includes('ไม่พบคำขอมาสาย')) {
    return 'ไม่พบคำขอมาสายที่ต้องการ';
  }
  if (message.includes('สถานะรอการอนุมัติ')) {
    return 'แก้ไขหรือยกเลิกได้เฉพาะคำขอที่รอพิจารณาเท่านั้น';
  }
  return message;
}

export function getLateRequestErrorMessage(err: unknown, fallback: string): string {
  const axiosErr = err as AxiosErrorShape;
  const response = axiosErr?.response;
  const status = response?.status;
  const apiMessage = response?.data?.message || response?.data?.error;

  if (apiMessage) {
    return normalizeApiMessage(apiMessage);
  }

  if (axiosErr?.message === 'Network Error' || axiosErr?.code === 'ERR_NETWORK') {
    return 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่';
  }

  if (status === 400) {
    return 'ข้อมูลไม่ครบหรือไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง';
  }
  if (status === 401) {
    return 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่';
  }
  if (status === 403) {
    return 'คุณไม่มีสิทธิ์ทำรายการนี้';
  }
  if (status === 404) {
    return 'ไม่พบข้อมูลคำขอมาสาย';
  }
  if (status === 409) {
    return 'คุณได้ส่งคำขอมาสายของวันนี้ไปแล้ว';
  }
  if (status === 413) {
    return 'ไฟล์ใหญ่เกินกำหนด กรุณาเลือกไฟล์ขนาดเล็กลง';
  }
  if (status === 415) {
    return 'ประเภทไฟล์ไม่รองรับ กรุณาใช้ PDF, JPG หรือ PNG';
  }
  if (status === 500) {
    return 'ระบบขัดข้องชั่วคราว กรุณาลองใหม่อีกครั้ง';
  }

  return fallback;
}
