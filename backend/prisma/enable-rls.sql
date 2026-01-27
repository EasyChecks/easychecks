-- Enable Row Level Security (RLS) for all tables
-- This prevents unauthorized access to data through Supabase API

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE download_logs ENABLE ROW LEVEL SECURITY;

-- ========================================
-- USERS TABLE POLICIES
-- ========================================

-- Users can read their own data
CREATE POLICY "Users can view own profile"
ON users FOR SELECT
USING (auth.uid()::text = user_id);

-- Admins and superadmins can view all users
CREATE POLICY "Admins can view all users"
ON users FOR SELECT
USING (
  auth.uid()::text IN (
    SELECT user_id FROM users WHERE role IN ('ADMIN', 'SUPERADMIN')
  )
);

-- Users can update their own non-critical fields
CREATE POLICY "Users can update own profile"
ON users FOR UPDATE
USING (auth.uid()::text = user_id)
WITH CHECK (
  auth.uid()::text = user_id 
  AND role = (SELECT role FROM users WHERE user_id = auth.uid()::text)
  AND status = (SELECT status FROM users WHERE user_id = auth.uid()::text)
);

-- Only superadmins can insert users
CREATE POLICY "Superadmins can insert users"
ON users FOR INSERT
WITH CHECK (
  auth.uid()::text IN (
    SELECT user_id FROM users WHERE role = 'SUPERADMIN'
  )
);

-- Only superadmins can delete users
CREATE POLICY "Superadmins can delete users"
ON users FOR DELETE
USING (
  auth.uid()::text IN (
    SELECT user_id FROM users WHERE role = 'SUPERADMIN'
  )
);

-- ========================================
-- BRANCHES TABLE POLICIES
-- ========================================

-- Everyone can view branches
CREATE POLICY "All authenticated users can view branches"
ON branches FOR SELECT
TO authenticated
USING (true);

-- Only admins can manage branches
CREATE POLICY "Admins can manage branches"
ON branches FOR ALL
USING (
  auth.uid()::text IN (
    SELECT user_id FROM users WHERE role IN ('ADMIN', 'SUPERADMIN')
  )
)
WITH CHECK (
  auth.uid()::text IN (
    SELECT user_id FROM users WHERE role IN ('ADMIN', 'SUPERADMIN')
  )
);

-- ========================================
-- ATTENDANCE TABLE POLICIES
-- ========================================

-- Users can view their own attendance
CREATE POLICY "Users can view own attendance"
ON attendance FOR SELECT
USING (auth.uid()::text = user_id);

-- Admins can view all attendance
CREATE POLICY "Admins can view all attendance"
ON attendance FOR SELECT
USING (
  auth.uid()::text IN (
    SELECT user_id FROM users WHERE role IN ('ADMIN', 'SUPERADMIN')
  )
);

-- Users can insert their own attendance (check-in)
CREATE POLICY "Users can create own attendance"
ON attendance FOR INSERT
WITH CHECK (auth.uid()::text = user_id);

-- Users can update their own attendance (check-out)
CREATE POLICY "Users can update own attendance"
ON attendance FOR UPDATE
USING (auth.uid()::text = user_id)
WITH CHECK (auth.uid()::text = user_id);

-- Admins can manage all attendance
CREATE POLICY "Admins can manage all attendance"
ON attendance FOR ALL
USING (
  auth.uid()::text IN (
    SELECT user_id FROM users WHERE role IN ('ADMIN', 'SUPERADMIN')
  )
)
WITH CHECK (
  auth.uid()::text IN (
    SELECT user_id FROM users WHERE role IN ('ADMIN', 'SUPERADMIN')
  )
);

-- ========================================
-- LEAVE_REQUESTS TABLE POLICIES
-- ========================================

-- Users can view their own leave requests
CREATE POLICY "Users can view own leave requests"
ON leave_requests FOR SELECT
USING (auth.uid()::text = user_id);

-- Admins can view all leave requests
CREATE POLICY "Admins can view all leave requests"
ON leave_requests FOR SELECT
USING (
  auth.uid()::text IN (
    SELECT user_id FROM users WHERE role IN ('ADMIN', 'SUPERADMIN')
  )
);

-- Users can create their own leave requests
CREATE POLICY "Users can create own leave requests"
ON leave_requests FOR INSERT
WITH CHECK (auth.uid()::text = user_id);

-- Users can update their own pending leave requests
CREATE POLICY "Users can update own pending leave requests"
ON leave_requests FOR UPDATE
USING (
  auth.uid()::text = user_id 
  AND status = 'PENDING'
)
WITH CHECK (
  auth.uid()::text = user_id 
  AND status = 'PENDING'
);

-- Admins can approve/reject leave requests
CREATE POLICY "Admins can manage leave requests"
ON leave_requests FOR UPDATE
USING (
  auth.uid()::text IN (
    SELECT user_id FROM users WHERE role IN ('ADMIN', 'SUPERADMIN')
  )
)
WITH CHECK (
  auth.uid()::text IN (
    SELECT user_id FROM users WHERE role IN ('ADMIN', 'SUPERADMIN')
  )
);

-- ========================================
-- AUDIT_LOGS TABLE POLICIES
-- ========================================

-- Only admins can view audit logs
CREATE POLICY "Admins can view audit logs"
ON audit_logs FOR SELECT
USING (
  auth.uid()::text IN (
    SELECT user_id FROM users WHERE role IN ('ADMIN', 'SUPERADMIN')
  )
);

-- System can insert audit logs (via service role)
CREATE POLICY "Service role can insert audit logs"
ON audit_logs FOR INSERT
TO service_role
WITH CHECK (true);

-- Backend can insert audit logs when authenticated
CREATE POLICY "Backend can insert audit logs"
ON audit_logs FOR INSERT
TO authenticated
WITH CHECK (true);

-- ========================================
-- NOTIFICATIONS TABLE POLICIES
-- ========================================

-- Users can view their own notifications
CREATE POLICY "Users can view own notifications"
ON notifications FOR SELECT
USING (auth.uid()::text = user_id);

-- Users can update their own notifications (mark as read)
CREATE POLICY "Users can update own notifications"
ON notifications FOR UPDATE
USING (auth.uid()::text = user_id)
WITH CHECK (auth.uid()::text = user_id);

-- Admins can create notifications for users
CREATE POLICY "Admins can create notifications"
ON notifications FOR INSERT
WITH CHECK (
  auth.uid()::text IN (
    SELECT user_id FROM users WHERE role IN ('ADMIN', 'SUPERADMIN')
  )
);

-- System can create notifications
CREATE POLICY "Service role can create notifications"
ON notifications FOR INSERT
TO service_role
WITH CHECK (true);

-- ========================================
-- DOWNLOAD_LOGS TABLE POLICIES
-- ========================================

-- Users can view their own download logs
CREATE POLICY "Users can view own download logs"
ON download_logs FOR SELECT
USING (auth.uid()::text = user_id);

-- Admins can view all download logs
CREATE POLICY "Admins can view all download logs"
ON download_logs FOR SELECT
USING (
  auth.uid()::text IN (
    SELECT user_id FROM users WHERE role IN ('ADMIN', 'SUPERADMIN')
  )
);

-- System can insert download logs
CREATE POLICY "Backend can insert download logs"
ON download_logs FOR INSERT
TO authenticated
WITH CHECK (auth.uid()::text = user_id);

-- ========================================
-- IMPORTANT NOTES:
-- ========================================
-- 1. These policies assume Supabase Auth is being used
-- 2. Service role bypasses RLS (use carefully in backend)
-- 3. Adjust policies based on your specific requirements
-- 4. Test thoroughly before deploying to production
