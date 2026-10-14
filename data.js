/* ===== ข้อมูลสัญญาซื้อขายที่ได้รับ (เก็บไว้ในเบราว์เซอร์ของเครื่องนี้เท่านั้น) ===== */

// ชื่อช่องเก็บข้อมูลในเบราว์เซอร์
const STORAGE_KEY = "contracts.data";

// วันที่สำรองข้อมูลครั้งล่าสุด
const BACKUP_KEY = "contracts.lastBackup";

// เหลือไม่เกินกี่วันถึงวันส่งของ ให้เตือน (แถวสีส้ม)
const SOON_DAYS = 7;

// ข้อมูลสัญญา 1 รายการ มีช่องดังนี้
// customer = ชื่อลูกค้า
// receivedDate = วันที่ได้รับสัญญา, deliverDate = วันที่ต้องส่งของ
// guaranteeSent = ส่งเก็บเอกสารรอทำเงินค้ำแล้วหรือยัง (true = ส่งแล้ว)
// receiptDate = วันที่ได้รับใบเสร็จ ("" = ยังไม่ได้รับ)

// อ่านข้อมูลทั้งหมดของเครื่องนี้ (ยังไม่เคยบันทึก = ตารางว่าง)
function loadContracts() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch (e) {
    // อ่านไม่ได้ แสดงเป็นตารางว่าง
  }
  return [];
}

// บันทึกข้อมูลทั้งหมดลงเบราว์เซอร์
function saveContracts(list) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    return true;
  } catch (e) {
    return false;
  }
}

/* ===== ตัวช่วยเรื่องวันที่และข้อความ ===== */

const THAI_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
  "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

// "2026-10-14" → "14 ต.ค. 2569"
function formatThaiDate(iso) {
  if (!iso) return "-";
  const [y, m, d] = iso.split("-").map(Number);
  return d + " " + THAI_MONTHS[m - 1] + " " + (y + 543);
}

// วันนี้ในรูป "2026-10-14"
function todayISO() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return now.getFullYear() + "-" + pad(now.getMonth() + 1) + "-" + pad(now.getDate());
}

// จากวันนี้ถึงวันที่กำหนด เหลือกี่วัน (ติดลบ = เลยมาแล้ว)
function daysUntil(iso) {
  const toDate = (s) => { const [y, m, d] = s.split("-").map(Number); return Date.UTC(y, m - 1, d); };
  return Math.round((toDate(iso) - toDate(todayISO())) / 86400000);
}

// กันตัวอักษรพิเศษในชื่อทำให้หน้าเว็บเพี้ยน
function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;"
  })[c]);
}

// รายการที่ยังไม่ได้รับใบเสร็จ
function missingReceipts(list) {
  return list.filter((c) => !c.receiptDate);
}
