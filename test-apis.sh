#!/bin/bash
# Test all Person 5 APIs (Attendance, Shift, Audit)

BASE="${BASE:-http://localhost:3001/api}"
SA_TOKEN=""
ADMIN_TOKEN=""
USER_TOKEN=""

# SA user: SA001, ADMIN user: BKK0001, USER: BKK0004

get_token() {
  local employee_id="$1"
  local password="$2"
  local response

  response=$(curl -s -X POST "$BASE/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"employeeId\":\"$employee_id\",\"password\":\"$password\"}")

  echo "$response" | sed -n 's/.*"accessToken":"\([^"]*\)".*/\1/p'
}

bootstrap_tokens() {
  SA_TOKEN=$(get_token "SA001" "8017231061031")
  ADMIN_TOKEN=$(get_token "BKK0001" "4850495039640")
  USER_TOKEN=$(get_token "BKK0004" "6819199987040")

  if [ -z "$SA_TOKEN" ] || [ -z "$ADMIN_TOKEN" ] || [ -z "$USER_TOKEN" ]; then
    echo "❌ Failed to bootstrap tokens from /auth/login"
    echo "   Ensure backend is running and seed credentials are up to date."
    exit 1
  fi

  echo "✅ Token bootstrap completed"
}

test_api() {
  local label="$1"
  local method="$2"
  local url="$3"
  local token="$4"
  local data="$5"
  
  echo "============================================"
  echo "TEST: $label"
  echo "  $method $url"
  echo "  Token: ${token:0:8}..."
  
  if [ -n "$data" ]; then
    RESPONSE=$(curl -s -w "\n|||HTTP_CODE:%{http_code}" -X "$method" "$url" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $token" \
      -d "$data" 2>&1)
  elif [ -n "$token" ]; then
    RESPONSE=$(curl -s -w "\n|||HTTP_CODE:%{http_code}" -X "$method" "$url" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $token" 2>&1)
  else
    RESPONSE=$(curl -s -w "\n|||HTTP_CODE:%{http_code}" -X "$method" "$url" \
      -H "Content-Type: application/json" 2>&1)
  fi
  
  HTTP_CODE=$(echo "$RESPONSE" | grep '|||HTTP_CODE:' | sed 's/.*|||HTTP_CODE://')
  BODY=$(echo "$RESPONSE" | grep -v '|||HTTP_CODE:')
  
  echo "  HTTP Status: $HTTP_CODE"
  echo "  Response: $(echo "$BODY" | head -c 500)"
  echo ""
}

extract_leave_id_from_body() {
  echo "$BODY" | sed -n 's/.*"leaveId":\([0-9][0-9]*\).*/\1/p' | head -n 1
}

echo "######################################################"
echo "#  PHASE 1: ATTENDANCE APIs (8 endpoints)             #"
echo "######################################################"
echo ""

bootstrap_tokens
echo ""

# 1) POST /attendance/check-gps - valid coords
test_api "Check GPS - Valid coords (User)" \
  "POST" "$BASE/attendance/check-gps" "$USER_TOKEN" \
  '{"latitude":13.7563,"longitude":100.5018}'

# 2) POST /attendance/check-gps - invalid (0,0)  
test_api "Check GPS - (0,0) coords (User)" \
  "POST" "$BASE/attendance/check-gps" "$USER_TOKEN" \
  '{"latitude":0,"longitude":0}'

# 3) POST /attendance/check-gps - no auth
test_api "Check GPS - No Auth" \
  "POST" "$BASE/attendance/check-gps" "" \
  '{"latitude":13.7563,"longitude":100.5018}'

# 4) POST /attendance/check-in - User check in
test_api "Check-in (User BKK0004, userId=10)" \
  "POST" "$BASE/attendance/check-in" "$USER_TOKEN" \
  '{"latitude":13.7563,"longitude":100.5018,"address":"Bangkok, Thailand"}'

# 5) POST /attendance/check-in - Duplicate check in (should fail 409)
test_api "Check-in DUPLICATE (should 409)" \
  "POST" "$BASE/attendance/check-in" "$USER_TOKEN" \
  '{"latitude":13.7563,"longitude":100.5018,"address":"Bangkok, Thailand"}'

# 6) POST /attendance/check-out - User check out
test_api "Check-out (User BKK0004)" \
  "POST" "$BASE/attendance/check-out" "$USER_TOKEN" \
  '{"latitude":13.7563,"longitude":100.5018,"address":"Bangkok, Thailand"}'

# 7) GET /attendance/history/:userId
test_api "History - User 10 (self)" \
  "GET" "$BASE/attendance/history/10" "$USER_TOKEN"

# 8) GET /attendance/history/:userId?startDate&endDate
test_api "History - User 10 with date filter" \
  "GET" "$BASE/attendance/history/10?startDate=2026-01-01&endDate=2026-12-31" "$USER_TOKEN"

# 9) GET /attendance - Admin only (SA token)
test_api "Get All Attendance (SuperAdmin)" \
  "GET" "$BASE/attendance" "$SA_TOKEN"

# 10) GET /attendance - User token (should 403)
test_api "Get All Attendance (User - should 403)" \
  "GET" "$BASE/attendance" "$USER_TOKEN"

# 11) GET /attendance/today/:userId
test_api "Today attendance - User 10" \
  "GET" "$BASE/attendance/today/10" "$USER_TOKEN"

# 12) PUT /attendance/:id - Admin update (will use id=1 for existing record)
test_api "Update Attendance id=1 (SuperAdmin)" \
  "PUT" "$BASE/attendance/1" "$SA_TOKEN" \
  '{"status":"LATE","note":"Test update from API"}'

# 13) PUT /attendance/:id - User (should 403)
test_api "Update Attendance (User - should 403)" \
  "PUT" "$BASE/attendance/1" "$USER_TOKEN" \
  '{"status":"LATE","note":"Should fail"}'

# 14) DELETE /attendance/:id - Admin delete (use id that won't break other tests)
test_api "Delete Attendance id=999 (SuperAdmin, expect 404)" \
  "DELETE" "$BASE/attendance/999" "$SA_TOKEN" \
  '{"deleteReason":"Test deletion"}'

# 15) DELETE /attendance - User (should 403)
test_api "Delete Attendance (User - should 403)" \
  "DELETE" "$BASE/attendance/1" "$USER_TOKEN" \
  '{"deleteReason":"Should fail"}'

echo ""
echo "######################################################"
echo "#  PHASE 2: SHIFT APIs (6 endpoints)                  #"
echo "######################################################"
echo ""

# 16) POST /shifts - Create shift (SuperAdmin)
test_api "Create Shift REGULAR (SuperAdmin)" \
  "POST" "$BASE/shifts" "$SA_TOKEN" \
  '{"userId":10,"name":"กะทดสอบ API","shiftType":"REGULAR","startTime":"09:00","endTime":"17:00","gracePeriodMinutes":15,"lateThresholdMinutes":30}'

# 17) POST /shifts - User (should 403)
test_api "Create Shift (User - should 403)" \
  "POST" "$BASE/shifts" "$USER_TOKEN" \
  '{"userId":10,"name":"Should Fail","shiftType":"REGULAR","startTime":"09:00","endTime":"17:00"}'

# 18) GET /shifts - List all (User)
test_api "Get All Shifts (User)" \
  "GET" "$BASE/shifts" "$USER_TOKEN"

# 19) GET /shifts - List all (SuperAdmin)
test_api "Get All Shifts (SuperAdmin)" \
  "GET" "$BASE/shifts" "$SA_TOKEN"

# 20) GET /shifts/today/:userId
test_api "Today Shifts - User 10" \
  "GET" "$BASE/shifts/today/10" "$USER_TOKEN"

# 21) GET /shifts/:id - Get by ID (use id=1)
test_api "Get Shift by ID=1 (User)" \
  "GET" "$BASE/shifts/1" "$USER_TOKEN"

# 22) GET /shifts/:id - Not found
test_api "Get Shift by ID=99999 (expect 404)" \
  "GET" "$BASE/shifts/99999" "$USER_TOKEN"

# 23) PUT /shifts/:id - Update shift (SuperAdmin)
test_api "Update Shift id=1 (SuperAdmin)" \
  "PUT" "$BASE/shifts/1" "$SA_TOKEN" \
  '{"name":"กะเช้า (Updated via API test)","gracePeriodMinutes":20}'

# 24) PUT /shifts/:id - User (should 403)
test_api "Update Shift (User - should 403)" \
  "PUT" "$BASE/shifts/1" "$USER_TOKEN" \
  '{"name":"Should Fail"}'

# 25) DELETE /shifts/:id - Soft delete (SuperAdmin, use a test ID)
test_api "Delete Shift id=999 (SuperAdmin, expect 404)" \
  "DELETE" "$BASE/shifts/999" "$SA_TOKEN" \
  '{"deleteReason":"Test API deletion"}'

# 26) DELETE /shifts - User (should 403)
test_api "Delete Shift (User - should 403)" \
  "DELETE" "$BASE/shifts/1" "$USER_TOKEN" \
  '{"deleteReason":"Should fail"}'

echo ""
echo "######################################################"
echo "#  PHASE 3: AUDIT APIs (2 endpoints)                  #"
echo "######################################################"
echo ""

# 27) GET /audit/actions - SuperAdmin
test_api "Get Audit Actions (SuperAdmin)" \
  "GET" "$BASE/audit/actions" "$SA_TOKEN"

# 28) GET /audit/actions - User (should 403)
test_api "Get Audit Actions (User - should 403)" \
  "GET" "$BASE/audit/actions" "$USER_TOKEN"

# 29) GET /audit - Query logs (SuperAdmin)
test_api "Get Audit Logs no filter (SuperAdmin)" \
  "GET" "$BASE/audit?limit=5" "$SA_TOKEN"

# 30) GET /audit - Query with filters
test_api "Get Audit Logs with filters (SuperAdmin)" \
  "GET" "$BASE/audit?action=CHECK_IN&limit=5" "$SA_TOKEN"

# 31) GET /audit - User (should 403)
test_api "Get Audit Logs (User - should 403)" \
  "GET" "$BASE/audit" "$USER_TOKEN"

# 32) GET /audit - No auth
test_api "Get Audit Logs (No Auth)" \
  "GET" "$BASE/audit" ""

echo ""
echo "######################################################"
echo "#  PHASE 4: LEAVE APIs (8 endpoints)                  #"
echo "######################################################"
echo ""

# Use per-run offset so repeated test runs don't overlap with leaves created by previous runs.
RUN_OFFSET=$((365 + ($(date +%s) % 10000)))
FULL_DAY_START=$(date -d "+${RUN_OFFSET} day" +%F)
FULL_DAY_END=$(date -d "+$((RUN_OFFSET + 1)) day" +%F)
HOURLY_DAY=$(date -d "+$((RUN_OFFSET + 2)) day" +%F)

# 33) POST /leave-requests - Create full-day leave (User)
test_api "Create Leave FULL-DAY (User)" \
  "POST" "$BASE/leave-requests" "$USER_TOKEN" \
  "{\"leaveType\":\"PERSONAL\",\"startDate\":\"$FULL_DAY_START\",\"endDate\":\"$FULL_DAY_END\",\"reason\":\"Full-day smoke test\"}"
FULL_DAY_LEAVE_ID=$(extract_leave_id_from_body)

# 34) POST /leave-requests - Create hourly leave (User)
test_api "Create Leave HOURLY (User)" \
  "POST" "$BASE/leave-requests" "$USER_TOKEN" \
  "{\"leaveType\":\"PERSONAL\",\"isHourly\":true,\"startDate\":\"$HOURLY_DAY\",\"endDate\":\"$HOURLY_DAY\",\"startTime\":\"09:00\",\"endTime\":\"11:30\",\"reason\":\"Hourly smoke test\"}"
HOURLY_LEAVE_ID=$(extract_leave_id_from_body)

# 35) GET /leave-requests/my - User list own leaves
test_api "Get My Leaves (User)" \
  "GET" "$BASE/leave-requests/my?take=5" "$USER_TOKEN"

# 36) GET /leave-requests - User should be forbidden
test_api "Get All Leaves (User - should 403)" \
  "GET" "$BASE/leave-requests" "$USER_TOKEN"

# 37) GET /leave-requests - Admin list all
test_api "Get All Leaves (Admin)" \
  "GET" "$BASE/leave-requests?take=5" "$ADMIN_TOKEN"

# 38) POST /leave-requests/:id/approve - Admin approve hourly leave
if [ -n "$HOURLY_LEAVE_ID" ]; then
  test_api "Approve Hourly Leave id=$HOURLY_LEAVE_ID (Admin)" \
    "POST" "$BASE/leave-requests/$HOURLY_LEAVE_ID/approve" "$ADMIN_TOKEN" \
    '{"adminComment":"Approve hourly from smoke test"}'
else
  echo "============================================"
  echo "TEST: Approve Hourly Leave (Admin)"
  echo "  Skipped: hourly leave ID not found from previous response"
  echo ""
fi

# 39) POST /leave-requests/:id/reject - Admin reject full-day leave
if [ -n "$FULL_DAY_LEAVE_ID" ]; then
  test_api "Reject Full-day Leave id=$FULL_DAY_LEAVE_ID (Admin)" \
    "POST" "$BASE/leave-requests/$FULL_DAY_LEAVE_ID/reject" "$ADMIN_TOKEN" \
    '{"rejectionReason":"Reject full-day from smoke test"}'
else
  echo "============================================"
  echo "TEST: Reject Full-day Leave (Admin)"
  echo "  Skipped: full-day leave ID not found from previous response"
  echo ""
fi

# 40) POST /leave-requests (User) - Invalid hourly range, end before start (expect 400)
test_api "Create Leave HOURLY Invalid Time (User, expect 400)" \
  "POST" "$BASE/leave-requests" "$USER_TOKEN" \
  "{\"leaveType\":\"PERSONAL\",\"isHourly\":true,\"startDate\":\"$HOURLY_DAY\",\"endDate\":\"$HOURLY_DAY\",\"startTime\":\"14:00\",\"endTime\":\"11:00\",\"reason\":\"Invalid hourly smoke test\"}"

echo ""
echo "######################################################"
echo "#  DONE - All 40 tests completed                      #"
echo "######################################################"
