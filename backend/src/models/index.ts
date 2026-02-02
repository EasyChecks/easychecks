/**
 * 📦 Models Index - รวม export ทุก models
 * 
 * ใช้สำหรับ import ได้ง่ายๆ เช่น:
 * import { attendanceModel, shiftModel } from '../models';
 */

export * from './attendance.model.js';
export * from './shift.model.js';

// Default exports
export { default as attendanceModel } from './attendance.model.js';
export { default as shiftModel } from './shift.model.js';
