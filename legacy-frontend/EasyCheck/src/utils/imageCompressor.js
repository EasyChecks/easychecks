/**
 * Image Compressor Utility
 * บีบอัดรูปภาพเป็น JPEG ขนาดเล็กลงเพื่อประหยัด localStorage
 */

/**
 * บีบอัดภาพจาก Canvas เป็น JPEG ขนาดเล็ก
 * @param {HTMLCanvasElement} canvas - Canvas element ที่มีรูปภาพ
 * @param {Object} options - ตัวเลือกการบีบอัด
 * @param {number} options.maxWidth - ความกว้างสูงสุด (default: 800px)
 * @param {number} options.maxHeight - ความสูงสูงสุด (default: 800px) 
 * @param {number} options.quality - คุณภาพ JPEG 0-1 (default: 0.7)
 * @returns {Promise<string>} - Base64 ของรูป JPEG ที่บีบอัดแล้ว
 */
export const compressImage = async (canvas, options = {}) => {
  const {
    maxWidth = 800,
    maxHeight = 800,
    quality = 0.7
  } = options;

  return new Promise((resolve, reject) => {
    try {
      // คำนวณขนาดใหม่โดยรักษาสัดส่วน
      let width = canvas.width;
      let height = canvas.height;

      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width = Math.floor(width * ratio);
        height = Math.floor(height * ratio);
      }

      // สร้าง canvas ใหม่สำหรับ resize
      const resizedCanvas = document.createElement('canvas');
      resizedCanvas.width = width;
      resizedCanvas.height = height;
      const ctx = resizedCanvas.getContext('2d');

      // วาดรูปใหม่ด้วยขนาดที่ย่อแล้ว
      ctx.drawImage(canvas, 0, 0, width, height);

      // แปลงเป็น JPEG Base64
      const compressedImage = resizedCanvas.toDataURL('image/jpeg', quality);
      
      resolve(compressedImage);
    } catch (error) {
      reject(error);
    }
  });
};

/**
 * คำนวณขนาดไฟล์จาก Base64 string
 * @param {string} base64String - Base64 string
 * @returns {number} - ขนาดไฟล์ในหน่วย KB
 */
export const getBase64Size = (base64String) => {
  if (!base64String) return 0;
  
  // ลบ header (data:image/jpeg;base64,) ออก
  const base64Data = base64String.split(',')[1] || base64String;
  
  // คำนวณขนาดจริง (Base64 ใหญ่กว่าไฟล์จริงประมาณ 33%)
  const sizeInBytes = (base64Data.length * 3) / 4;
  const sizeInKB = sizeInBytes / 1024;
  
  return Math.round(sizeInKB * 10) / 10; // ปัดเป็นทศนิยม 1 ตำแหน่ง
};

/**
 * ตรวจสอบและบีบอัดรูปหากขนาดเกิน limit
 * @param {string} base64Image - รูป Base64 ต้นฉบับ
 * @param {number} maxSizeKB - ขนาดสูงสุดที่อนุญาต (KB)
 * @returns {Promise<string>} - รูปที่บีบอัดแล้ว
 */
export const ensureImageSize = async (base64Image, maxSizeKB = 100) => {
  const currentSize = getBase64Size(base64Image);
  
  if (currentSize <= maxSizeKB) {
    return base64Image; // ขนาดพอดีแล้ว ไม่ต้องบีบอัด
  }
  
  // สร้าง canvas จาก Base64
  const img = new Image();
  img.src = base64Image;
  
  return new Promise((resolve, reject) => {
    img.onload = async () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      
      // คำนวณ quality ที่เหมาะสม
      let quality = 0.7;
      if (currentSize > 500) quality = 0.5;
      if (currentSize > 1000) quality = 0.3;
      
      try {
        const compressed = await compressImage(canvas, { 
          maxWidth: 800, 
          maxHeight: 800, 
          quality 
        });
        resolve(compressed);
      } catch (error) {
        reject(error);
      }
    };
    
    img.onerror = reject;
  });
};

export default {
  compressImage,
  getBase64Size,
  ensureImageSize
};
