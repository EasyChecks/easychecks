import cron from 'node-cron';
import { autoCheckoutOverdueAttendances } from './attendance.service.js';

/**
 * ตรวจงานค้างทุก 10 นาที แล้วทำ auto-checkout ให้ record ที่เลยเวลาเลิกกะ + 30 นาที
 */
export function startAttendanceAutoCheckoutCron() {
  cron.schedule('*/10 * * * *', async () => {
    try {
      const count = await autoCheckoutOverdueAttendances();
      if (count > 0) {
        console.log(`[CRON] auto-checkout completed: ${count} records`);
      }
    } catch (error) {
      console.error('[CRON] auto-checkout failed:', error);
    }
  });

  console.log('[CRON] attendance auto-checkout scheduled every 10 minutes');
}
