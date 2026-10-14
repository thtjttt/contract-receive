/* ===== ข้อมูลสัญญาซื้อขาย (เก็บที่ Supabase ทุกคนที่เข้าสู่ระบบเห็นชุดเดียวกัน) ===== */

// ที่อยู่ตู้เก็บข้อมูล และกุญแจสาธารณะ (เปิดเผยได้ ข้อมูลถูกล็อกด้วยการเข้าสู่ระบบ)
// ⚠ ห้ามใส่กุญแจลับ (sb_secret_ / service_role) ในไฟล์นี้เด็ดขาด
const SUPABASE_URL = "https://mbnuvglgeottssxlabmj.supabase.co";
const SUPABASE_KEY = "sb_publishable_r29yy9ypCHsqNhbGmPAaKg_-G2gNApe";
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ข้อมูลที่เคยกรอกไว้ในเครื่องนี้ (ก่อนย้ายขึ้นระบบ)
const STORAGE_KEY = "contracts.data";
const MIGRATED_KEY = "contracts.data.migrated";

// วันที่สำรองข้อมูลครั้งล่าสุด
const BACKUP_KEY = "contracts.lastBackup";

// เหลือไม่เกินกี่วันถึงวันส่งของ ให้เตือน (แถวสีส้ม)
const SOON_DAYS = 7;

// บริษัทที่ได้รับสัญญา (ใบเสร็จมาในนามบริษัทเดียวกับสัญญา)
const COMPANIES = [
  { key: "yongsawat", label: "ยงสวัสดิ์" },
  { key: "amata", label: "อมตะ" }
];

// ข้อมูลสัญญา 1 รายการ มีช่องดังนี้
// id = เลขรายการ, userId = เจ้าของ, recorder = ผู้บันทึก (อีเมล)
// company = บริษัท ("yongsawat" / "amata", "" = ยังไม่ระบุ)
// customer = ชื่อลูกค้า
// receivedDate = วันที่ได้รับสัญญา, deliverDate = วันที่ต้องส่งของ
// guaranteeSent = ส่งเอกสารรอถอนเงินค้ำแล้วหรือยัง (true = ส่งแล้ว)
// receiptDate = วันที่ได้รับใบเสร็จ ("" = ยังไม่ได้รับ)

/* ===== เข้าสู่ระบบ ===== */

let currentUser = null;

// ทุกหน้า (ยกเว้นหน้าเข้าสู่ระบบ) ต้องเข้าสู่ระบบก่อน
async function requireUser() {
  const { data } = await db.auth.getSession();
  const user = data.session ? data.session.user : null;
  if (!user) {
    const here = location.pathname.split("/").pop() + location.search;
    location.replace("login.html?next=" + encodeURIComponent(here || "index.html"));
    // หยุดการทำงานของหน้านี้ไว้ระหว่างเปลี่ยนหน้า
    await new Promise(() => {});
  }
  currentUser = user;
  showUserBox(user);
  return user;
}

// มุมบนขวา: อีเมลของคนที่เข้าสู่ระบบ + ปุ่มออกจากระบบ
function showUserBox(user) {
  const inner = document.querySelector(".site-header .inner");
  if (!inner || document.getElementById("user-box")) return;
  const box = document.createElement("div");
  box.id = "user-box";
  box.className = "user-box";
  box.innerHTML = '<span class="user-email">' + escapeHtml(user.email) + "</span>" +
    '<a class="user-logout" href="change-password.html">เปลี่ยนรหัสผ่าน</a>' +
    '<button type="button" class="user-logout">ออกจากระบบ</button>';
  box.querySelector("button").addEventListener("click", async () => {
    await db.auth.signOut();
    location.replace("login.html");
  });
  inner.appendChild(box);
}

// ชื่อสั้นของผู้บันทึก (ส่วนหน้าของอีเมล)
function recorderName(email) {
  return email ? String(email).split("@")[0] : "-";
}

/* ===== อ่าน / บันทึก / แก้ / ลบ ===== */

// แปลงจากแถวในฐานข้อมูล เป็นข้อมูลที่หน้าเว็บใช้
function fromRow(r) {
  return {
    id: r.id,
    userId: r.user_id,
    recorder: r.recorder,
    company: r.company || "",
    customer: r.customer,
    receivedDate: r.received_date,
    deliverDate: r.deliver_date,
    receiptDate: r.receipt_date || "",
    guaranteeSent: Boolean(r.guarantee_sent)
  };
}

// แปลงกลับเป็นแถวในฐานข้อมูล (ใส่เฉพาะช่องที่มี)
function toRow(c) {
  const row = {};
  if ("company" in c) row.company = c.company || "";
  if ("customer" in c) row.customer = c.customer;
  if ("receivedDate" in c) row.received_date = c.receivedDate;
  if ("deliverDate" in c) row.deliver_date = c.deliverDate;
  if ("receiptDate" in c) row.receipt_date = c.receiptDate || null;
  if ("guaranteeSent" in c) row.guarantee_sent = Boolean(c.guaranteeSent);
  return row;
}

// ข้อความผิดพลาดแบบอ่านง่าย
function friendlyError(error) {
  const msg = String((error && error.message) || error || "");
  if (/fetch|network|Failed to fetch|NetworkError/i.test(msg)) {
    return "เชื่อมต่ออินเทอร์เน็ตไม่ได้ กรุณาตรวจอินเทอร์เน็ตแล้วลองใหม่";
  }
  if (/JWT|session|auth/i.test(msg)) {
    return "การเข้าสู่ระบบหมดอายุ กรุณาออกจากระบบแล้วเข้าใหม่";
  }
  return "ทำรายการไม่สำเร็จ กรุณาลองใหม่อีกครั้ง";
}

async function fetchContracts() {
  const { data, error } = await db.from("contracts").select("*")
    .order("received_date", { ascending: false }).order("id", { ascending: false });
  if (error) throw error;
  return data.map(fromRow);
}

async function fetchContract(id) {
  const { data, error } = await db.from("contracts").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? fromRow(data) : null;
}

async function addContracts(list) {
  const { data, error } = await db.from("contracts").insert(list.map(toRow)).select();
  if (error) throw error;
  return data.map(fromRow);
}

async function updateContract(id, changes) {
  const { data, error } = await db.from("contracts").update(toRow(changes)).eq("id", id).select();
  if (error) throw error;
  if (!data.length) throw new Error("แก้ได้เฉพาะสัญญาของตัวเอง");
  return fromRow(data[0]);
}

async function removeContract(id) {
  const { data, error } = await db.from("contracts").delete().eq("id", id).select();
  if (error) throw error;
  if (!data.length) throw new Error("ลบได้เฉพาะสัญญาของตัวเอง");
}

/* ===== ข้อมูลเดิมที่เคยกรอกไว้ในเครื่องนี้ ===== */

function legacyContracts() {
  try {
    if (localStorage.getItem(MIGRATED_KEY)) return [];
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(saved) ? saved : [];
  } catch (e) {
    return [];
  }
}

// ย้ายแล้ว: เก็บสำเนาเดิมไว้ ไม่ลบทิ้ง แต่ไม่ถามซ้ำ
function markLegacyMigrated() {
  try { localStorage.setItem(MIGRATED_KEY, new Date().toISOString()); } catch (e) { /* ไม่เป็นไร */ }
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

// ชื่อบริษัทที่แสดง ("" = ยังไม่ระบุ)
function companyLabel(key) {
  const found = COMPANIES.find((c) => c.key === key);
  return found ? found.label : "ยังไม่ระบุ";
}

// ป้ายสีชื่อบริษัท
function companyBadge(key) {
  const known = COMPANIES.some((c) => c.key === key);
  return '<span class="company company-' + (known ? key : "none") + '">' + companyLabel(key) + "</span>";
}

// สรุปจำนวนแยกบริษัท เช่น "ยงสวัสดิ์ 1, อมตะ 2"
function companySummary(list) {
  const parts = COMPANIES
    .map((co) => ({ label: co.label, n: list.filter((c) => c.company === co.key).length }))
    .filter((p) => p.n > 0)
    .map((p) => p.label + " " + p.n);
  const unknown = list.filter((c) => !COMPANIES.some((co) => co.key === c.company)).length;
  if (unknown) parts.push("ยังไม่ระบุ " + unknown);
  return parts.join(", ");
}
