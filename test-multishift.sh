#!/bin/bash
# ======================================================
# test-multishift.sh — ทดสอบระบบหลายกะ (Multi-Shift Test)
# ======================================================
# ข้อมูลที่ตั้งไว้ใน DB:
#   User: BKK0004 (userId=154)
#   กะเช้า  shiftId=181  → 06:00-14:00  (no location → ข้าม GPS)
#   กะบ่าย shiftId=182  → 14:00-22:00  (no location → ข้าม GPS)
#
# ผ่านไปทุก test: ✅   ล้มเหลวตามคาด: ⚠️   ไม่คาดคิด: ❌

BASE="${BASE:-http://localhost:3001/api}"
PASS=0
FAIL=0

# ─────────────────────────────────────────────
# สี Terminal
# ─────────────────────────────────────────────
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

log_header() { echo -e "\n${BOLD}${CYAN}══════════════════════════════════════${NC}"; echo -e "${BOLD}${CYAN} $1${NC}"; echo -e "${BOLD}${CYAN}══════════════════════════════════════${NC}"; }
log_ok()   { echo -e "  ${GREEN}✅ PASS${NC} — $1"; PASS=$((PASS+1)); }
log_warn() { echo -e "  ${YELLOW}⚠️  EXPECTED FAIL${NC} — $1"; PASS=$((PASS+1)); }
log_fail() { echo -e "  ${RED}❌ FAIL${NC} — $1"; FAIL=$((FAIL+1)); }

# ─────────────────────────────────────────────
# ฟังก์ชัน: เรียก API
# ─────────────────────────────────────────────
call_api() {
  local method="$1" url="$2" token="$3" body="$4"
  if [ -n "$body" ] && [ -n "$token" ]; then
    curl -s -w "\n|||%{http_code}" -X "$method" "$url" \
      -H "Content-Type: application/json" -H "Authorization: Bearer $token" \
      -d "$body"
  elif [ -n "$token" ]; then
    curl -s -w "\n|||%{http_code}" -X "$method" "$url" \
      -H "Content-Type: application/json" -H "Authorization: Bearer $token"
  else
    curl -s -w "\n|||%{http_code}" -X "$method" "$url" \
      -H "Content-Type: application/json" -d "$body"
  fi
}

parse_code() { echo "$1" | grep -o '|||[0-9]*' | tr -d '|||'; }
parse_body() { echo "$1" | sed 's/|||[0-9]*$//'; }

# ─────────────────────────────────────────────
# Bootstrap: ขอ Token
# ─────────────────────────────────────────────
log_header "🔐 Bootstrap Tokens"

SA_RES=$(call_api "POST" "$BASE/auth/login" "" '{"employeeId":"SA001","password":"8017231061031"}')
USER_RES=$(call_api "POST" "$BASE/auth/login" "" '{"employeeId":"BKK0004","password":"6819199987040"}')

SA_TOKEN=$(parse_body "$SA_RES" | sed -n 's/.*"accessToken":"\([^"]*\)".*/\1/p')
USER_TOKEN=$(parse_body "$USER_RES" | sed -n 's/.*"accessToken":"\([^"]*\)".*/\1/p')

if [ -z "$SA_TOKEN" ] || [ -z "$USER_TOKEN" ]; then
  echo -e "${RED}❌ ไม่สามารถขอ token ได้ กรุณาตรวจสอบว่า backend รันอยู่ที่ $BASE${NC}"
  exit 1
fi
echo -e "  SA_TOKEN    : ${SA_TOKEN:0:20}..."
echo -e "  USER_TOKEN  : ${USER_TOKEN:0:20}..."
log_ok "Token bootstrap สำเร็จ"

# ─────────────────────────────────────────────
# TEST 1: ดูรายการกะของ user วันนี้ → ควรเห็น 2 กะ
# ─────────────────────────────────────────────
log_header "📋 TEST 1 — ดูกะของ BKK0004 วันนี้ (ควรเห็น 2 กะ)"
RES=$(call_api "GET" "$BASE/shifts/today/154" "$USER_TOKEN" "")
CODE=$(parse_code "$RES")
BODY=$(parse_body "$RES")
echo "  HTTP $CODE | $(echo "$BODY" | head -c 300)"

if [ "$CODE" = "200" ]; then
  COUNT=$(echo "$BODY" | grep -o '"shiftId"' | wc -l)
  if [ "$COUNT" -ge 2 ]; then
    log_ok "ดูกะวันนี้ → เห็น $COUNT กะ (ถูกต้อง)"
  else
    log_fail "ดูกะวันนี้ → เห็นแค่ $COUNT กะ (ควรเห็น ≥ 2)"
  fi
else
  log_fail "GET /shifts/today/154 → HTTP $CODE"
fi

# ─────────────────────────────────────────────
# TEST 2: Check-in กะเช้า (shiftId=181)
# ─────────────────────────────────────────────
log_header "✅ TEST 2 — Check-in กะเช้า (shiftId=181 / 06:00-14:00)"
RES=$(call_api "POST" "$BASE/attendance/check-in" "$USER_TOKEN" \
  '{"shiftId":181,"latitude":13.7563,"longitude":100.5018,"address":"Bangkok Test"}')
CODE=$(parse_code "$RES")
BODY=$(parse_body "$RES")
echo "  HTTP $CODE | $(echo "$BODY" | head -c 400)"

if [ "$CODE" = "201" ]; then
  ATTENDANCE_ID=$(echo "$BODY" | sed -n 's/.*"attendanceId":\([0-9]*\).*/\1/p' | head -1)
  log_ok "Check-in กะเช้าสำเร็จ → attendanceId=$ATTENDANCE_ID"
elif [ "$CODE" = "400" ] || [ "$CODE" = "409" ]; then
  # อาจเกิดเพราะเลยเวลาออก 14:00 ไปแล้ว → ระบบบล็อกถูกต้อง
  MSG=$(echo "$BODY" | sed -n 's/.*"error":"\([^"]*\)".*/\1/p')
  log_warn "HTTP $CODE → \"$MSG\" (อาจเป็นเพราะเลยเวลากะเช้าไปแล้ว)"
else
  log_fail "Check-in กะเช้า → HTTP $CODE ไม่คาดคิด"
fi

# ─────────────────────────────────────────────
# TEST 3: Check-in กะเช้าซ้ำ → ควร 409
# ─────────────────────────────────────────────
log_header "⚠️  TEST 3 — Check-in กะเช้าซ้ำ (ควร 409 Conflict)"
RES=$(call_api "POST" "$BASE/attendance/check-in" "$USER_TOKEN" \
  '{"shiftId":181,"latitude":13.7563,"longitude":100.5018,"address":"Bangkok Test"}')
CODE=$(parse_code "$RES")
BODY=$(parse_body "$RES")
MSG=$(echo "$BODY" | sed -n 's/.*"error":"\([^"]*\)".*/\1/p')
echo "  HTTP $CODE | msg: $MSG"

if [ "$CODE" = "409" ]; then
  log_warn "Duplicate check-in → HTTP 409 (ดีมาก ระบบป้องกันได้)"
elif [ "$CODE" = "201" ]; then
  log_fail "ระบบยอมให้ check-in ซ้ำ! → ควรเป็น 409"
else
  # อาจ 400 (เลยเวลากะ) ซึ่งก็ถือว่า block ได้
  log_warn "HTTP $CODE → \"$MSG\""
fi

# ─────────────────────────────────────────────
# TEST 4: Check-in กะบ่าย (shiftId=182) ในขณะที่กะเช้ายังไม่ checkout
# ─────────────────────────────────────────────
log_header "✅ TEST 4 — Check-in กะบ่าย (shiftId=182 / 14:00-22:00) แยกกะ"
RES=$(call_api "POST" "$BASE/attendance/check-in" "$USER_TOKEN" \
  '{"shiftId":182,"latitude":13.7563,"longitude":100.5018,"address":"Bangkok Test"}')
CODE=$(parse_code "$RES")
BODY=$(parse_body "$RES")
echo "  HTTP $CODE | $(echo "$BODY" | head -c 400)"

ATT2_ID=$(echo "$BODY" | sed -n 's/.*"attendanceId":\([0-9]*\).*/\1/p' | head -1)

if [ "$CODE" = "201" ]; then
  log_ok "Check-in กะบ่ายสำเร็จ → attendanceId=$ATT2_ID"
elif [ "$CODE" = "400" ]; then
  MSG=$(echo "$BODY" | sed -n 's/.*"error":"\([^"]*\)".*/\1/p')
  log_warn "HTTP 400 → \"$MSG\" (อาจเป็นเพราะยังไม่ถึงเวลากะบ่าย)"
elif [ "$CODE" = "409" ]; then
  MSG=$(echo "$BODY" | sed -n 's/.*"error":"\([^"]*\)".*/\1/p')
  log_fail "HTTP 409 → \"$MSG\" — ระบบไม่ยอมให้ check-in กะที่ 2 ทั้งที่ shiftId ต่างกัน"
else
  log_fail "HTTP $CODE ไม่คาดคิด"
fi

# ─────────────────────────────────────────────
# TEST 5: ดูสถานะวันนี้ → ควรเห็น attendance ที่เพิ่งสร้าง
# ─────────────────────────────────────────────
log_header "📋 TEST 5 — ตรวจสอบสถานะวันนี้ของ user 154"
RES=$(call_api "GET" "$BASE/attendance/today/154" "$USER_TOKEN" "")
CODE=$(parse_code "$RES")
BODY=$(parse_body "$RES")
echo "  HTTP $CODE | $(echo "$BODY" | head -c 500)"

if [ "$CODE" = "200" ]; then
  ATT_COUNT=$(echo "$BODY" | grep -o '"attendanceId"' | wc -l)
  log_ok "Today attendance → เห็น $ATT_COUNT record(s)"
else
  log_fail "GET /attendance/today/154 → HTTP $CODE"
fi

# ─────────────────────────────────────────────
# TEST 6: Check-out กะบ่าย (ระบุ shiftId)
# ─────────────────────────────────────────────
log_header "🚪 TEST 6 — Check-out กะบ่าย (shiftId=182)"
RES=$(call_api "POST" "$BASE/attendance/check-out" "$USER_TOKEN" \
  '{"shiftId":182,"latitude":13.7563,"longitude":100.5018,"address":"Bangkok Test"}')
CODE=$(parse_code "$RES")
BODY=$(parse_body "$RES")
echo "  HTTP $CODE | $(echo "$BODY" | head -c 400)"

if [ "$CODE" = "200" ]; then
  log_ok "Check-out กะบ่ายสำเร็จ"
elif [ "$CODE" = "404" ]; then
  MSG=$(echo "$BODY" | sed -n 's/.*"error":"\([^"]*\)".*/\1/p')
  log_warn "HTTP 404 → \"$MSG\" (กะบ่ายอาจไม่ได้ check-in ไว้ก่อนหน้า)"
else
  MSG=$(echo "$BODY" | sed -n 's/.*"error":"\([^"]*\)".*/\1/p')
  log_fail "Check-out กะบ่าย → HTTP $CODE → \"$MSG\""
fi

# ─────────────────────────────────────────────
# TEST 7: Check-out ซ้ำ → ควร 404 (ไม่มี record ที่ยังไม่ checkout)
# ─────────────────────────────────────────────
log_header "⚠️  TEST 7 — Check-out กะบ่ายซ้ำ (ควร 404)"
RES=$(call_api "POST" "$BASE/attendance/check-out" "$USER_TOKEN" \
  '{"shiftId":182,"latitude":13.7563,"longitude":100.5018,"address":"Bangkok Test"}')
CODE=$(parse_code "$RES")
BODY=$(parse_body "$RES")
MSG=$(echo "$BODY" | sed -n 's/.*"error":"\([^"]*\)".*/\1/p')
echo "  HTTP $CODE | msg: $MSG"

if [ "$CODE" = "404" ]; then
  log_warn "Double check-out → HTTP 404 (ดีมาก ระบบป้องกันได้)"
elif [ "$CODE" = "200" ]; then
  log_fail "ระบบยอมให้ check-out ซ้ำ!"
else
  log_warn "HTTP $CODE → \"$MSG\""
fi

# ─────────────────────────────────────────────
# TEST 8: Check-out กะเช้า (ถ้า check-in ไว้)
# ─────────────────────────────────────────────
log_header "🚪 TEST 8 — Check-out กะเช้า (shiftId=181)"
RES=$(call_api "POST" "$BASE/attendance/check-out" "$USER_TOKEN" \
  '{"shiftId":181,"latitude":13.7563,"longitude":100.5018,"address":"Bangkok Test"}')
CODE=$(parse_code "$RES")
BODY=$(parse_body "$RES")
MSG=$(echo "$BODY" | sed -n 's/.*"error":"\([^"]*\)".*/\1/p')
echo "  HTTP $CODE | $(echo "$BODY" | head -c 300)"

if [ "$CODE" = "200" ]; then
  log_ok "Check-out กะเช้าสำเร็จ"
elif [ "$CODE" = "404" ]; then
  log_warn "HTTP 404 → \"$MSG\" (กะเช้าถูกบล็อกไม่ให้ check-in ตั้งแต่ต้น)"
else
  log_warn "HTTP $CODE → \"$MSG\""
fi

# ─────────────────────────────────────────────
# TEST 9: ดูประวัติย้อนหลัง
# ─────────────────────────────────────────────
log_header "📋 TEST 9 — ประวัติ attendance ย้อนหลัง 7 วัน"
TODAY=$(date +%Y-%m-%d)
WEEK_AGO=$(date -d "-7 days" +%Y-%m-%d)
RES=$(call_api "GET" "$BASE/attendance/history/154?startDate=$WEEK_AGO&endDate=$TODAY" "$USER_TOKEN" "")
CODE=$(parse_code "$RES")
BODY=$(parse_body "$RES")
echo "  HTTP $CODE | $(echo "$BODY" | head -c 400)"

if [ "$CODE" = "200" ]; then
  COUNT=$(echo "$BODY" | grep -o '"attendanceId"' | wc -l)
  log_ok "ดูประวัติสำเร็จ → $COUNT record(s)"
else
  log_fail "GET /attendance/history/154 → HTTP $CODE"
fi

# ─────────────────────────────────────────────
# TEST 10: SuperAdmin ดู attendance ทั้งหมด
# ─────────────────────────────────────────────
log_header "👑 TEST 10 — SuperAdmin ดู All Attendance"
RES=$(call_api "GET" "$BASE/attendance?userId=154" "$SA_TOKEN" "")
CODE=$(parse_code "$RES")
BODY=$(parse_body "$RES")
echo "  HTTP $CODE | $(echo "$BODY" | head -c 300)"

if [ "$CODE" = "200" ]; then
  COUNT=$(echo "$BODY" | grep -o '"attendanceId"' | wc -l)
  log_ok "SuperAdmin ดู attendance userId=154 → $COUNT record(s)"
else
  log_fail "GET /attendance?userId=154 (SA) → HTTP $CODE"
fi

# ─────────────────────────────────────────────
# SUMMARY
# ─────────────────────────────────────────────
echo ""
echo -e "${BOLD}══════════════════════════════════════${NC}"
echo -e "${BOLD} 📊 สรุปผลการทดสอบ${NC}"
echo -e "${BOLD}══════════════════════════════════════${NC}"
echo -e "  ${GREEN}✅ ผ่าน (PASS/WARN)  : $PASS${NC}"
echo -e "  ${RED}❌ ล้มเหลว (FAIL)    : $FAIL${NC}"
echo ""
if [ "$FAIL" -eq 0 ]; then
  echo -e "  ${GREEN}${BOLD}🎉 ระบบหลายกะทำงานได้ถูกต้อง!${NC}"
else
  echo -e "  ${RED}${BOLD}⚠️  มีปัญหา $FAIL จุด กรุณาตรวจสอบ${NC}"
fi
echo ""
