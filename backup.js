/* ===== สำรองข้อมูล และนำข้อมูลกลับมา (ไฟล์ .csv เปิดด้วย Excel ได้) ===== */

const BACKUP_COLUMNS = [
  "ชื่อลูกค้า",
  "วันที่ได้รับสัญญา",
  "วันที่ได้รับใบเสร็จ",
  "วันที่ต้องส่งของ",
  "ส่งเก็บเอกสารรอทำเงินค้ำ",
  "บริษัท"
];

const backupStatus = document.getElementById("backup-status");
const restoreInput = document.getElementById("restore-file");
const restoreConfirm = document.getElementById("restore-confirm");
const restoreMessage = document.getElementById("restore-message");
let pendingRestore = null;

/* ----- ดาวน์โหลดสำรองข้อมูล ----- */

// ใส่เครื่องหมายคำพูดให้ช่องที่มี , หรือ " และกัน Excel มองชื่อเป็นสูตร
function csvCell(value) {
  let text = String(value);
  if (/^[=+\-@]/.test(text)) text = "'" + text;
  return /[",\n\r]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
}

function downloadBackup() {
  const list = loadContracts();
  const lines = [BACKUP_COLUMNS.join(",")].concat(list.map((c) => [
    c.customer,
    c.receivedDate,
    c.receiptDate || "",
    c.deliverDate,
    c.guaranteeSent ? "ส่งแล้ว" : "ยังไม่ส่ง",
    COMPANIES.some((co) => co.key === c.company) ? companyLabel(c.company) : ""
  ].map(csvCell).join(",")));

  // ﻿ ช่วยให้ Excel อ่านภาษาไทยถูก
  const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
  const [y, m, d] = todayISO().split("-");
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "สำรองสัญญาซื้อขาย-" + (Number(y) + 543) + "-" + m + "-" + d + ".csv";
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);

  try { localStorage.setItem(BACKUP_KEY, todayISO()); } catch (e) { /* ไม่เป็นไร */ }
  showBackupStatus();
}

function showBackupStatus() {
  let last = "";
  try { last = localStorage.getItem(BACKUP_KEY) || ""; } catch (e) { /* ไม่เป็นไร */ }
  const count = loadContracts().length;
  if (!last) {
    backupStatus.textContent = count ? "ยังไม่เคยสำรองข้อมูลในเครื่องนี้" : "";
    backupStatus.className = count ? "backup-status backup-warn" : "backup-status";
    return;
  }
  const ago = -daysUntil(last);
  backupStatus.textContent = "สำรองล่าสุด: " + formatThaiDate(last) +
    (ago === 0 ? " (วันนี้)" : " (" + ago + " วันที่แล้ว)");
  backupStatus.className = "backup-status" + (ago > 7 ? " backup-warn" : "");
}

/* ----- นำข้อมูลกลับมา ----- */

// แยกไฟล์ CSV เป็นแถว ๆ (รองรับช่องที่มีเครื่องหมายคำพูด)
function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

// รับวันที่ได้ทั้ง 2026-10-14 และ 14/10/2569 (กรณีเปิดแล้วบันทึกจาก Excel)
function readDate(text) {
  const t = text.trim();
  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  let y, mo, d;
  if (m) { [, y, mo, d] = m.map(Number); }
  else {
    m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!m) return null;
    [, d, mo, y] = m.map(Number);
  }
  if (y > 2400) y -= 543;
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return y + "-" + String(mo).padStart(2, "0") + "-" + String(d).padStart(2, "0");
}

function readBackup(text) {
  const rows = parseCsv(text.replace(/^﻿/, ""));
  const header = (rows.shift() || []).map((h) => h.trim());
  const col = BACKUP_COLUMNS.map((name) => header.indexOf(name));
  if (col[0] < 0 || col[1] < 0 || col[3] < 0) {
    throw new Error("ไฟล์นี้ไม่ใช่ไฟล์สำรองของระบบนี้ กรุณาเลือกไฟล์ที่ได้จากปุ่ม \"ดาวน์โหลดสำรองข้อมูล\"");
  }
  return rows.map((r, i) => {
    const get = (k) => (col[k] >= 0 ? (r[col[k]] || "").trim() : "");
    const customer = get(0).replace(/^'/, "");
    const receivedDate = readDate(get(1));
    const deliverDate = readDate(get(3));
    const receiptText = get(2);
    const receiptDate = receiptText ? readDate(receiptText) : "";
    if (!customer || !receivedDate || !deliverDate || receiptDate === null) {
      throw new Error("ข้อมูลแถวที่ " + (i + 2) + " ในไฟล์ไม่ครบหรือวันที่ผิดรูปแบบ");
    }
    // ไฟล์สำรองรุ่นเก่าไม่มีคอลัมน์บริษัท = ยังไม่ระบุ
    const company = (COMPANIES.find((co) => co.label === get(5)) || { key: "" }).key;
    return {
      id: i + 1,
      company,
      customer,
      receivedDate,
      deliverDate,
      guaranteeSent: get(4) === "ส่งแล้ว",
      receiptDate
    };
  });
}

function showRestoreMessage(text, isError) {
  restoreMessage.hidden = false;
  restoreMessage.className = isError ? "restore-message restore-error" : "restore-message";
  restoreMessage.textContent = text;
}

restoreInput.addEventListener("change", () => {
  const file = restoreInput.files[0];
  restoreInput.value = "";
  restoreConfirm.hidden = true;
  restoreMessage.hidden = true;
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    try {
      pendingRestore = readBackup(reader.result);
    } catch (e) {
      showRestoreMessage(e.message, true);
      return;
    }
    const current = loadContracts().length;
    document.getElementById("restore-summary").innerHTML =
      "ไฟล์ <strong>" + escapeHtml(file.name) + "</strong> มี <strong>" + pendingRestore.length + "</strong> รายการ" +
      "<br>ข้อมูลในเครื่องนี้ตอนนี้ <strong>" + current + "</strong> รายการ จะถูก <strong>แทนที่ทั้งหมด</strong> ด้วยข้อมูลจากไฟล์";
    restoreConfirm.hidden = false;
  };
  reader.onerror = () => showRestoreMessage("เปิดไฟล์ไม่ได้ กรุณาลองใหม่", true);
  reader.readAsText(file, "utf-8");
});

document.getElementById("restore-yes").addEventListener("click", () => {
  if (!pendingRestore) return;
  if (!saveContracts(pendingRestore)) {
    showRestoreMessage("นำข้อมูลกลับมาไม่สำเร็จ เบราว์เซอร์อาจปิดการเก็บข้อมูลไว้", true);
    return;
  }
  location.href = "contracts.html?restored=" + pendingRestore.length;
});

document.getElementById("restore-no").addEventListener("click", () => {
  pendingRestore = null;
  restoreConfirm.hidden = true;
});

document.getElementById("backup-download").addEventListener("click", downloadBackup);
showBackupStatus();

// ข้อความหลังนำข้อมูลกลับมาสำเร็จ
const restoredCount = new URLSearchParams(location.search).get("restored");
if (restoredCount !== null) {
  const msg = document.getElementById("success");
  msg.hidden = false;
  msg.textContent = "นำข้อมูลกลับมาเรียบร้อยแล้ว " + Number(restoredCount) + " รายการ";
}
