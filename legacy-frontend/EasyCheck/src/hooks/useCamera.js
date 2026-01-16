import { useState, useCallback } from 'react';
import { config } from '@/config';

/**
 * Hook สำหรับขออนุญาตและจัดการกล้อง
 * คล้ายกับการขออนุญาตตำแหน่ง
 */
export const useCamera = () => {
  const [hasPermission, setHasPermission] = useState(null); // null = ยังไม่ได้ถาม, true = อนุญาต, false = ไม่อนุญาต
  const [error, setError] = useState(null);
  const [stream, setStream] = useState(null);

  /**
   * ขออนุญาตกล้อง
   */
  const requestCameraPermission = useCallback(async () => {
    // ตรวจสอบว่า browser รองรับ getUserMedia หรือไม่
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      const errorMsg = 'เบราว์เซอร์ของคุณไม่รองรับการใช้งานกล้อง';
      setError(errorMsg);
      setHasPermission(false);
      return { success: false, error: errorMsg };
    }

    // ถ้าปิดการตรวจสอบกล้องใน config
    if (!config.features.enableCameraCheck) {
      setHasPermission(true);
      return { success: true, message: 'การตรวจสอบกล้องถูกปิดใช้งาน' };
    }

    try {
      // ตั้งค่ากล้องตาม config
      const constraints = {
        video: {
          facingMode: config.camera.facingMode, // 'user' = กล้องหน้า, 'environment' = กล้องหลัง
          width: { ideal: config.camera.width },
          height: { ideal: config.camera.height },
        },
        audio: false, // ไม่ใช้เสียง
      };

      // ขออนุญาตกล้อง
      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      
      setStream(mediaStream);
      setHasPermission(true);
      setError(null);

      return { 
        success: true, 
        stream: mediaStream,
        message: 'อนุญาตการใช้งานกล้องแล้ว'
      };

    } catch (err) {
      let errorMsg = 'ไม่สามารถเข้าถึงกล้องได้';

      // แยก error ตามประเภท
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        errorMsg = 'คุณไม่อนุญาตให้เข้าถึงกล้อง กรุณาอนุญาตในการตั้งค่าเบราว์เซอร์';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        errorMsg = 'ไม่พบกล้องในอุปกรณ์ของคุณ';
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        errorMsg = 'กล้องกำลังถูกใช้งานโดยแอปพลิเคชันอื่น';
      } else if (err.name === 'OverconstrainedError' || err.name === 'ConstraintNotSatisfiedError') {
        errorMsg = 'การตั้งค่ากล้องไม่รองรับในอุปกรณ์ของคุณ';
      }

      setError(errorMsg);
      setHasPermission(false);

      return { success: false, error: errorMsg };
    }
  }, []);

  /**
   * ปิดกล้อง
   */
  const stopCamera = useCallback(() => {
    if (stream) {
      // หยุดทุก track ของ stream
      stream.getTracks().forEach(track => {
        track.stop();
      });
      setStream(null);
    }
  }, [stream]);

  /**
   * ถ่ายรูป
   */
  const capturePhoto = useCallback(() => {
    if (!stream) {
      return { success: false, error: 'กล้องยังไม่ถูกเปิดใช้งาน' };
    }

    try {
      // สร้าง video element ชั่วคราว
      const video = document.createElement('video');
      video.srcObject = stream;
      video.play();

      return new Promise((resolve) => {
        video.onloadedmetadata = () => {
          // สร้าง canvas สำหรับวาดภาพ
          const canvas = document.createElement('canvas');
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          
          const ctx = canvas.getContext('2d');
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

          // แปลง canvas เป็น blob
          canvas.toBlob((blob) => {
            // แปลง blob เป็น base64
            const reader = new FileReader();
            reader.onloadend = () => {
              resolve({
                success: true,
                photoUrl: reader.result, // base64 string
                blob: blob,
              });
            };
            reader.readAsDataURL(blob);
          }, 'image/jpeg', 0.9); // quality 90%
        };
      });

    } catch {
      return { success: false, error: 'ไม่สามารถถ่ายรูปได้' };
    }
  }, [stream]);

  /**
   * ตรวจสอบสถานะการอนุญาต (โดยไม่ขออนุญาต)
   */
  const checkPermission = useCallback(async () => {
    if (!navigator.permissions || !navigator.permissions.query) {
      // Browser ไม่รองรับ Permissions API
      return { success: false, error: 'ไม่สามารถตรวจสอบสิทธิ์กล้องได้' };
    }

    try {
      const result = await navigator.permissions.query({ name: 'camera' });
      
      if (result.state === 'granted') {
        setHasPermission(true);
        return { success: true, state: 'granted' };
      } else if (result.state === 'denied') {
        setHasPermission(false);
        return { success: false, state: 'denied' };
      } else {
        // prompt = ยังไม่ได้ถาม
        return { success: true, state: 'prompt' };
      }

    } catch {
      return { success: false, error: 'ไม่สามารถตรวจสอบสิทธิ์กล้องได้' };
    }
  }, []);

  return {
    hasPermission,
    error,
    stream,
    requestCameraPermission,
    stopCamera,
    capturePhoto,
    checkPermission,
  };
};

export default useCamera;
