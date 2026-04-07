/**
 * 📋 Audit Middleware — บันทึก action อัตโนมัติสำหรับทุก write request
 * ─────────────────────────────────────────────────────────────────────
 * ทำไมต้อง middleware แทน manual call ใน controller?
 * — ถ้าใส่ createAuditLog() ในทุก controller → ลืมง่าย + duplicate
 * — middleware จับ response สำเร็จ (2xx) แล้ว log อัตโนมัติ
 * — ลดโอกาส "ลืม log" จาก 100% เป็น 0%
 *
 * วิธีการทำงาน:
 * 1. ดัก JSON response ด้วย monkeypatch res.json()
 * 2. ถ้า method เป็น POST/PUT/PATCH/DELETE และ status 2xx
 *    → สร้าง audit log จาก route, method, user, body
 * 3. ไม่บล็อก response — log เป็น async fire-and-forget
 *
 * ข้อจำกัด:
 * — ตรวจจาก URL pattern → ถ้า route ใหม่ไม่ตรง pattern จะไม่รู้จัก action
 *    → fallback เป็น "{METHOD} {path}" ซึ่งยังดีกว่าไม่มี log เลย
 * — ไม่ log oldValues อัตโนมัติ (ต้อง query ก่อน update ซึ่งเพิ่ม latency)
 *    → ถ้าต้องการ oldValues ให้ controller log เองเหมือนเดิม
 */

import type { Request, Response, NextFunction } from '../types/express.js';
import { createAuditLog } from '../services/audit.service.js';

// ========== Route → Action Mapping ==========

/**
 * ทำไมต้อง map ด้วย regex แทน exact match?
 * — เพราะ route มี dynamic param เช่น /attendance/123
 * — regex จับ pattern ได้ยืดหยุ่นกว่า
 *
 * ทำไมเรียง specific → generic?
 * — regex match แบบ first-match → ถ้าเรียงกลับจะ match ผิดตัว
 */
interface RouteActionMapping {
  method: string;          // HTTP method เช่น "POST", "PUT"
  pattern: RegExp;         // URL pattern
  action: string;          // AuditAction value
  targetTable: string;     // ชื่อตารางที่ถูกกระทำ
}

const ROUTE_ACTION_MAP: RouteActionMapping[] = [
  // ─── Attendance ───
  { method: 'POST', pattern: /\/attendance\/check-in$/, action: 'CHECK_IN', targetTable: 'attendance' },
  { method: 'POST', pattern: /\/attendance\/check-out$/, action: 'CHECK_OUT', targetTable: 'attendance' },
  { method: 'PUT', pattern: /\/attendance\/\d+$/, action: 'UPDATE_ATTENDANCE', targetTable: 'attendance' },
  { method: 'DELETE', pattern: /\/attendance\/\d+$/, action: 'DELETE_ATTENDANCE', targetTable: 'attendance' },

  // ─── Shifts ───
  { method: 'POST', pattern: /\/shifts$/, action: 'CREATE_SHIFT', targetTable: 'shifts' },
  { method: 'PUT', pattern: /\/shifts\/\d+$/, action: 'UPDATE_SHIFT', targetTable: 'shifts' },
  { method: 'DELETE', pattern: /\/shifts\/\d+$/, action: 'DELETE_SHIFT', targetTable: 'shifts' },

  // ─── Users ───
  { method: 'POST', pattern: /\/users$/, action: 'CREATE_USER', targetTable: 'users' },
  { method: 'PUT', pattern: /\/users\/\d+$/, action: 'UPDATE_USER', targetTable: 'users' },
  { method: 'DELETE', pattern: /\/users\/\d+$/, action: 'DELETE_USER', targetTable: 'users' },

  // ─── Leave Requests ───
  { method: 'POST', pattern: /\/leave-requests$/, action: 'CREATE_LEAVE', targetTable: 'leave_requests' },
  { method: 'POST', pattern: /\/leave-requests\/\d+\/approve$/, action: 'APPROVE_LEAVE', targetTable: 'leave_requests' },
  { method: 'POST', pattern: /\/leave-requests\/\d+\/reject$/, action: 'REJECT_LEAVE', targetTable: 'leave_requests' },
  { method: 'PUT', pattern: /\/leave-requests\/\d+$/, action: 'UPDATE_LEAVE', targetTable: 'leave_requests' },
  { method: 'DELETE', pattern: /\/leave-requests\/\d+$/, action: 'DELETE_LEAVE', targetTable: 'leave_requests' },

  // ─── Announcements ───
  { method: 'POST', pattern: /\/announcements$/, action: 'CREATE_ANNOUNCEMENT', targetTable: 'announcements' },
  { method: 'PUT', pattern: /\/announcements\/\d+$/, action: 'UPDATE_ANNOUNCEMENT', targetTable: 'announcements' },
  { method: 'DELETE', pattern: /\/announcements\/\d+$/, action: 'DELETE_ANNOUNCEMENT', targetTable: 'announcements' },

  // ─── Events ───
  { method: 'POST', pattern: /\/events$/, action: 'CREATE_EVENT', targetTable: 'events' },
  { method: 'PUT', pattern: /\/events\/\d+$/, action: 'UPDATE_EVENT', targetTable: 'events' },
  { method: 'DELETE', pattern: /\/events\/\d+$/, action: 'DELETE_EVENT', targetTable: 'events' },

  // ─── Locations ───
  { method: 'POST', pattern: /\/locations$/, action: 'CREATE_LOCATION', targetTable: 'locations' },
  { method: 'PUT', pattern: /\/locations\/\d+$/, action: 'UPDATE_LOCATION', targetTable: 'locations' },
  { method: 'DELETE', pattern: /\/locations\/\d+$/, action: 'DELETE_LOCATION', targetTable: 'locations' },

  // ─── Late Requests ───
  { method: 'POST', pattern: /\/late-requests$/, action: 'CREATE_LATE_REQUEST', targetTable: 'late_requests' },
  { method: 'POST', pattern: /\/late-requests\/\d+\/approve$/, action: 'APPROVE_LATE_REQUEST', targetTable: 'late_requests' },
  { method: 'POST', pattern: /\/late-requests\/\d+\/reject$/, action: 'REJECT_LATE_REQUEST', targetTable: 'late_requests' },
  { method: 'PUT', pattern: /\/late-requests\/\d+$/, action: 'UPDATE_LATE_REQUEST', targetTable: 'late_requests' },
  { method: 'DELETE', pattern: /\/late-requests\/\d+$/, action: 'DELETE_LATE_REQUEST', targetTable: 'late_requests' },
];

/**
 * จับ ID จาก URL เช่น /attendance/123 → 123
 * ทำไมใช้ regex แทน parseInt(req.params.id)?
 * — เพราะ middleware อาจถูกใช้ก่อน router resolve params
 */
function extractIdFromPath(path: string): number | null {
  const match = path.match(/\/(\d+)(?:\/[a-z-]*)?$/);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * จับ ID จาก response body — fallback ถ้า URL ไม่มี (POST create)
 * ส่วนใหญ่ response จะมี data.attendanceId, data.shiftId, data.userId ฯลฯ
 */
function extractIdFromBody(body: Record<string, unknown>): number | null {
  const data = (body?.data ?? body) as Record<string, unknown>;
  // ลอง key ที่พบบ่อยในระบบนี้
  for (const key of ['attendanceId', 'shiftId', 'userId', 'leaveRequestId', 'eventId', 'locationId', 'id']) {
    if (typeof data?.[key] === 'number') return data[key] as number;
  }
  return null;
}

function normalizePath(path: string): string {
  // strip query
  const clean = path.split('?')[0] ?? path;
  // remove /api prefix if present
  return clean.startsWith('/api/') ? clean.slice('/api'.length) : clean;
}

function inferTargetTableFromPath(path: string): string {
  const p = normalizePath(path);
  const seg = (p.split('/').filter(Boolean)[0] ?? '').trim();
  return seg || 'unknown';
}

// ========== Middleware ==========

/**
 * Express middleware: บันทึก audit log อัตโนมัติหลัง write request สำเร็จ
 *
 * ทำไม monkeypatch res.json แทน res.on('finish')?
 * — res.on('finish') ไม่ให้เข้าถึง response body ได้
 * — เราต้องการ response body เพื่อดึง targetId (เช่น attendanceId)
 * — monkeypatch res.json จับ body ก่อนส่ง → ใช้ body ได้
 */
export function auditMiddleware(req: Request, res: Response, next: NextFunction) {
  // ข้าม GET/OPTIONS/HEAD — ไม่เปลี่ยนข้อมูล ไม่ต้อง log
  if (['GET', 'OPTIONS', 'HEAD'].includes(req.method)) {
    return next();
  }

  // เก็บ reference ของ res.json ดั้งเดิม
  const originalJson = res.json.bind(res);

  // override res.json เพื่อดัก response body
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  res.json = function (body: any) {
    // เรียก original ก่อนเสมอ → ไม่ delay response
    const result = originalJson(body);

    // log เฉพาะ 2xx response (สำเร็จเท่านั้น)
    // ถ้า 4xx/5xx = error → ไม่มีอะไรเปลี่ยนใน DB ไม่ต้อง log
    if (res.statusCode >= 200 && res.statusCode < 300) {
      // ค้นหา action จาก route mapping
      const path = req.originalUrl || req.path;
      const normalized = normalizePath(path);

      // Don't log audit API itself
      if (normalized === '/audit' || normalized.startsWith('/audit/')) {
        return result;
      }

      const mapping = ROUTE_ACTION_MAP.find(
        (m) => m.method === req.method && m.pattern.test(normalized),
      );

      const action = mapping?.action ?? `${req.method} ${normalized}`;
      const targetTable = mapping?.targetTable ?? inferTargetTableFromPath(normalized);
      // ดึง targetId จาก URL ก่อน → ถ้าไม่มี ลองจาก response body
      const targetId = extractIdFromPath(normalized) ?? extractIdFromBody(body ?? {}) ?? 0;

      // fire-and-forget: ไม่ await เพราะไม่ต้องการ block response
      createAuditLog({
        userId: req.user?.userId,
        action,
        targetTable,
        targetId,
        newValues: body?.data ?? undefined,
        ipAddress: (req.headers['x-forwarded-for'] as string) || req.ip || undefined,
        userAgent: req.headers['user-agent'] || undefined,
      }).catch(() => {
        // silent: audit failure ไม่ส่งผลต่อ response
      });
    }

    return result;
  };

  next();
}
