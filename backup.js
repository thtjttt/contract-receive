/* ===== สำรองข้อมูลเป็นไฟล์ และเพิ่มข้อมูลจากไฟล์ (ไฟล์ .csv เปิดด้วย Excel ได้) ===== */

const BACKUP_COLUMNS = [
  "ชื่อลูกค้า",
  "วันที่ได้รับสัญญา",
  "วันที่ได้รับใบเสร็จ",
  "วันที่ต้องส่งของ",
  "ส่งเอกสารรอถอนเงินค้ำ",
  "บริษัท",
  "ผู้บันทึก",
  "จำนวนชุด"
];
// คอลัมน์จำนวนชุดแยกบริษัท เช่น "ชุด ยงสวัสดิ์"
const SET_COLUMNS = COMPANIES.map((co) => "ชุด " + co.label);

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

// จดว่าสำรองข้อมูลแล้ววันนี้
function markBackedUp() {
  try { localStorage.setItem(BACKUP_KEY, todayISO()); } catch (e) { /* ไม่เป็นไร */ }
  showBackupStatus();
}

async function downloadBackup() {
  // ได้รายการตามมุมมองที่เลือกอยู่ (ของฉัน / ของทุกคน)
  const list = inView();
  const lines = [BACKUP_COLUMNS.concat(SET_COLUMNS).join(",")].concat(list.map((c) => [
    c.customer,
    c.receivedDate,
    c.receiptDate || "",
    c.deliverDate,
    c.guaranteeSent ? "ส่งแล้ว" : "ยังไม่ส่ง",
    c.items.map((it) => companyLabel(it.company)).join(" + "),
    c.recorder || "",
    c.sets || ""
  ].concat(COMPANIES.map((co) => setsFor(c, co.key) || "")).map(csvCell).join(",")));

  // \uFEFF ช่วยให้ Excel อ่านภาษาไทยถูก
  const blob = new Blob(["\uFEFF" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
  const [y, m, d] = todayISO().split("-");
  const fileName = "สำรองสัญญาซื้อขาย-" + (Number(y) + 543) + "-" + m + "-" + d + ".csv";
  restoreMessage.hidden = true;

  // Chrome / Edge บนคอมพิวเตอร์: เปิดหน้าต่าง "บันทึกเป็น…" ให้เลือกโฟลเดอร์
  // ครั้งต่อไปจะเปิดที่โฟลเดอร์เดิมให้เอง (จำด้วย id)
  if (window.showSaveFilePicker) {
    let handle;
    try {
      handle = await window.showSaveFilePicker({
        id: "contract-backup",
        startIn: "documents",
        suggestedName: fileName,
        types: [{ description: "ไฟล์สำรองข้อมูล (เปิดด้วย Excel ได้)", accept: { "text/csv": [".csv"] } }]
      });
    } catch (e) {
      if (e.name === "AbortError") return; // กดยกเลิก = ไม่บันทึก
      handle = null; // เปิดหน้าต่างไม่ได้ ใช้วิธีดาวน์โหลดปกติแทน
    }
    if (handle) {
      try {
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
      } catch (e) {
        showRestoreMessage("บันทึกไฟล์ไม่สำเร็จ กรุณาลองใหม่ หรือเลือกโฟลเดอร์อื่น", true);
        return;
      }
      markBackedUp();
      showRestoreMessage("บันทึกไฟล์สำรอง \"" + handle.name + "\" เรียบร้อยแล้ว", false);
      return;
    }
  }

  // เบราว์เซอร์อื่น / มือถือ: ดาวน์โหลดลงโฟลเดอร์ Downloads ตามปกติ
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  markBackedUp();
}

function showBackupStatus() {
  let last = "";
  try { last = localStorage.getItem(BACKUP_KEY) || ""; } catch (e) { /* ไม่เป็นไร */ }
  // ข้อมูลอยู่บนระบบออนไลน์แล้ว แค่บอกวันที่ดาวน์โหลดไฟล์ล่าสุด ไม่ต้องเตือน
  backupStatus.className = "backup-status";
  if (!last) {
    backupStatus.textContent = "";
    return;
  }
  const ago = -daysUntil(last);
  backupStatus.textContent = "ดาวน์โหลดไฟล์ล่าสุดจากเครื่องนี้: " + formatThaiDate(last) +
    (ago === 0 ? " (วันนี้)" : " (" + ago + " วันที่แล้ว)");
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
  const rows = parseCsv(text.replace(/^\uFEFF/, ""));
  const header = (rows.shift() || []).map((h) => h.trim());
  // ชื่อคอลัมน์เดิมในไฟล์สำรองรุ่นเก่า (ยังนำกลับมาได้)
  const oldNames = { "ส่งเอกสารรอถอนเงินค้ำ": "ส่งเก็บเอกสารรอทำเงินค้ำ" };
  const col = BACKUP_COLUMNS.map((name) =>
    header.indexOf(name) >= 0 ? header.indexOf(name) : header.indexOf(oldNames[name]));
  const setCol = SET_COLUMNS.map((name) => header.indexOf(name));
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
    // บริษัท + จำนวนชุด: ไฟล์รุ่นใหม่มีคอลัมน์ "ชุด <บริษัท>" แยกทีละบริษัท
    // ไฟล์รุ่นเก่ามีบริษัทเดียวในคอลัมน์ "บริษัท" (ไม่มี = ยังไม่ระบุ)
    let items = COMPANIES.map((co, k) => {
      const cell = setCol[k] >= 0 ? (r[setCol[k]] || "").trim() : "";
      return /^\d+$/.test(cell) && Number(cell) > 0 ? { company: co.key, sets: Number(cell) } : null;
    }).filter(Boolean);
    if (!items.length) {
      const names = get(5).split("+").map((x) => x.trim());
      items = COMPANIES.filter((co) => names.includes(co.label)).map((co) => ({ company: co.key, sets: null }));
      const oldSets = /^\d+$/.test(get(7)) && Number(get(7)) > 0 ? Number(get(7)) : null;
      if (items.length === 1) items[0].sets = oldSets;
    }
    return {
      id: i + 1,
      items,
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
    document.getElementById("restore-summary").innerHTML =
      "ไฟล์ <strong>" + escapeHtml(file.name) + "</strong> มี <strong>" + pendingRestore.length + "</strong> รายการ" +
      "<br>จะ <strong>เพิ่ม</strong> ทั้งหมดเข้าเป็น “ของฉัน” (รายการที่มีอยู่แล้วไม่ถูกลบ)" +
      "<br>⚠ ถ้าเคยเพิ่มไฟล์นี้ไปแล้ว รายการจะซ้ำ";
    restoreConfirm.hidden = false;
  };
  reader.onerror = () => showRestoreMessage("เปิดไฟล์ไม่ได้ กรุณาลองใหม่", true);
  reader.readAsText(file, "utf-8");
});

document.getElementById("restore-yes").addEventListener("click", async (ev) => {
  if (!pendingRestore) return;
  ev.target.disabled = true;
  try {
    await addContracts(pendingRestore);
  } catch (e) {
    ev.target.disabled = false;
    showRestoreMessage("เพิ่มข้อมูลไม่สำเร็จ: " + friendlyError(e), true);
    return;
  }
  location.href = "contracts.html?view=mine&restored=" + pendingRestore.length;
});

document.getElementById("restore-no").addEventListener("click", () => {
  pendingRestore = null;
  restoreConfirm.hidden = true;
});

document.getElementById("backup-download").addEventListener("click", downloadBackup);
document.addEventListener("contracts-loaded", showBackupStatus);

// ข้อความหลังนำข้อมูลกลับมาสำเร็จ
const restoredCount = new URLSearchParams(location.search).get("restored");
if (restoredCount !== null) {
  const msg = document.getElementById("success");
  msg.hidden = false;
  msg.textContent = "เพิ่มข้อมูลจากไฟล์เรียบร้อยแล้ว " + Number(restoredCount) + " รายการ";
}
