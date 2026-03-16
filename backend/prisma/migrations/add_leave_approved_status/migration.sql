-- AlterEnum: เพิ่ม 'LEAVE_APPROVED' เข้าไปใน AttendanceStatus enum
DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1
		FROM pg_type t
		JOIN pg_enum e ON t.oid = e.enumtypid
		WHERE t.typname = 'AttendanceStatus'
			AND e.enumlabel = 'LEAVE_APPROVED'
	) THEN
		ALTER TYPE "AttendanceStatus" ADD VALUE 'LEAVE_APPROVED';
	END IF;
END $$;
