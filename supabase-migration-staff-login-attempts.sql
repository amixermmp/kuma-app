-- กันสุ่ม PIN พนักงาน: บันทึกการใส่ PIN ทุกครั้ง (ใช้นับครั้งที่ผิดต่อ IP / ทั้งระบบ ในช่วง 15 นาที)
CREATE TABLE IF NOT EXISTS staff_login_attempts (
  id         bigserial PRIMARY KEY,
  ip         text        NOT NULL,
  success    boolean     NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS staff_login_attempts_ip_time ON staff_login_attempts (ip, created_at DESC);
CREATE INDEX IF NOT EXISTS staff_login_attempts_time    ON staff_login_attempts (created_at DESC);

-- เข้าถึงได้เฉพาะเซิร์ฟเวอร์ (service role) เท่านั้น
ALTER TABLE staff_login_attempts ENABLE ROW LEVEL SECURITY;
