/* ===== หน้ารายการสัญญาที่ได้รับ ===== */

let contracts = [];
const searchBox = document.getElementById("search");
const tableBody = document.getElementById("contract-rows");
const dataTable = document.querySelector(".data-table");
const resultInfo = document.getElementById("result-info");
const emptyBox = document.getElementById("empty");
const tableWrap = document.getElementById("table-wrap");
const receiptAlert = document.getElementById("receipt-alert");
const filterButtons = document.querySelectorAll("[data-filter]");
const companyButtons = document.querySelectorAll("[data-company]");
const viewButtons = document.querySelectorAll("[data-view]");
const loadingBox = document.getElementById("loading");
const errorBox = document.getElementById("load-error");

const params = new URLSearchParams(location.search);
// แถวที่เพิ่งบันทึกหรือเพิ่งแก้ (ส่งมาจากหน้าบันทึกรับสัญญา)
const newId = Number(params.get("new") || params.get("edited"));
const successBox = document.getElementById("success");
const deleteConfirm = document.getElementById("delete-confirm");
let pendingDeleteId = null;
// ตัวกรอง: "all" = ทั้งหมด, "noreceipt" = ยังไม่ได้รับใบเสร็จ
let currentFilter = params.get("filter") === "noreceipt" ? "noreceipt" : "all";
// ตัวกรองบริษัท: "all" = ทุกบริษัท หรือรหัสบริษัท
let currentCompany = COMPANIES.some((co) => co.key === params.get("company")) ? params.get("company") : "all";

// มุมมอง: "mine" = ของฉัน (แก้ได้), "everyone" = ของทุกคน (ดูอย่างเดียว) จำไว้ในเครื่อง
const VIEW_KEY = "contracts.view";
let currentView = "mine";
try { if (localStorage.getItem(VIEW_KEY) === "everyone") currentView = "everyone"; } catch (e) { /* ไม่เป็นไร */ }
if (params.get("view") === "everyone" || params.get("view") === "mine") currentView = params.get("view");

function isMine(c) {
  return currentUser && c.userId === currentUser.id;
}

// สัญญาที่อยู่ในมุมมองปัจจุบัน
function inView() {
  return currentView === "mine" ? contracts.filter(isMine) : contracts;
}

function showError(message) {
  errorBox.hidden = false;
  errorBox.textContent = message;
  errorBox.scrollIntoView({ block: "center" });
}

// ช่องใบเสร็จ: ได้รับแล้ว = วันที่สีเขียว, ยังไม่ได้รับ = บอกว่ารอมากี่วัน
function receiptCell(c, editable) {
  const lock = editable ? "" : " disabled";
  if (c.receiptDate) {
    return '<label class="check check-done">' +
      '<input type="checkbox" data-receipt="' + c.id + '" checked' + lock + ">" +
      "ได้รับ " + formatThaiDate(c.receiptDate) + "</label>";
  }
  const waited = -daysUntil(c.receivedDate);
  return '<label class="check check-missing">' +
    '<input type="checkbox" data-receipt="' + c.id + '"' + lock + ">" +
    "ยังไม่ได้รับ</label>" +
    '<div class="wait-note">' + (waited > 0 ? "รอมา " + waited + " วัน" : "สัญญามาถึงวันนี้") + "</div>";
}

function render() {
  const typed = searchBox.value.trim();
  const keyword = typed.toLowerCase();
  const viewList = inView();
  const missing = missingReceipts(viewList);

  // ปุ่มสลับมุมมอง และคอลัมน์ผู้บันทึก (แสดงเฉพาะ "ของทุกคน")
  viewButtons.forEach((b) => {
    b.classList.toggle("active", b.dataset.view === currentView);
    b.querySelector(".n").textContent = b.dataset.view === "mine" ? contracts.filter(isMine).length : contracts.length;
  });
  dataTable.classList.toggle("show-recorder", currentView === "everyone");
  document.getElementById("view-note").textContent = currentView === "mine"
    ? "แสดงเฉพาะสัญญาที่คุณบันทึก แก้ไข ลบ และติ๊กได้"
    : "แสดงสัญญาของทุกคน แก้ไขได้เฉพาะรายการของคุณ (รายการของคนอื่นดูได้อย่างเดียว)";

  // แถบเตือนใบเสร็จ (บอกแยกบริษัท)
  receiptAlert.hidden = missing.length === 0;
  document.getElementById("missing-count").textContent = missing.length;
  document.getElementById("missing-detail").textContent = missing.length ? "(" + companySummary(missing) + ")" : "";

  // ตัวเลขบนปุ่มกรอง: นับตามบริษัทที่เลือกอยู่
  const inCompany = viewList.filter((c) => currentCompany === "all" || c.company === currentCompany);
  document.getElementById("count-all").textContent = inCompany.length;
  document.getElementById("count-noreceipt").textContent = missingReceipts(inCompany).length;
  filterButtons.forEach((b) => b.classList.toggle("active", b.dataset.filter === currentFilter));

  // ตัวเลขบนปุ่มบริษัท: นับตามสถานะใบเสร็จที่เลือกอยู่
  const inStatus = currentFilter === "all" ? viewList : missing;
  companyButtons.forEach((b) => {
    const key = b.dataset.company;
    b.classList.toggle("active", key === currentCompany);
    b.querySelector(".n").textContent = key === "all"
      ? inStatus.length
      : inStatus.filter((c) => c.company === key).length;
  });

  // เรียงรับล่าสุดอยู่บนสุด
  const rows = inCompany
    .filter((c) => currentFilter === "all" || !c.receiptDate)
    .filter((c) => !keyword || c.customer.toLowerCase().includes(keyword))
    .sort((a, b) => b.receivedDate.localeCompare(a.receivedDate) || b.id - a.id);

  tableBody.innerHTML = rows.map((c) => {
    const mine = isMine(c);
    const lock = mine ? "" : " disabled";
    const left = daysUntil(c.deliverDate);
    const soon = left >= 0 && left <= SOON_DAYS;
    const classes = [soon ? "row-soon" : "", c.id === newId ? "row-new" : ""].join(" ").trim();
    let note = "";
    if (soon) {
      note = '<div class="soon-note">' + (left === 0 ? "ต้องส่งของวันนี้" : "อีก " + left + " วันถึงวันส่งของ") + "</div>";
    }
    const actions = mine
      ? '<div class="row-actions">' +
        '<a class="small-button" href="add-contract.html?edit=' + c.id + '">แก้ไข</a>' +
        '<button type="button" class="small-button danger" data-delete="' + c.id + '">ลบ</button>' +
        "</div>"
      : '<span class="muted">ดูอย่างเดียว</span>';
    return "<tr" + (classes ? ' class="' + classes + '"' : "") + ">" +
      '<td data-label="ชื่อลูกค้า">' + escapeHtml(c.customer) + "</td>" +
      '<td data-label="บริษัท">' + companyBadge(c.company) + "</td>" +
      '<td data-label="ผู้บันทึก" class="recorder-col" title="' + escapeHtml(c.recorder || "") + '">' +
        "<span>" + escapeHtml(recorderName(c.recorder)) + (mine ? ' <span class="muted">(คุณ)</span>' : "") + "</span></td>" +
      '<td data-label="วันที่ได้รับสัญญา">' + formatThaiDate(c.receivedDate) + "</td>" +
      '<td data-label="ใบเสร็จ">' + receiptCell(c, mine) + "</td>" +
      '<td data-label="วันที่ต้องส่งของ"><div>' + formatThaiDate(c.deliverDate) + "</div>" + note + "</td>" +
      '<td data-label="ส่งเอกสารรอถอนเงินค้ำ"><label class="check' + (c.guaranteeSent ? " check-done" : "") + '">' +
      '<input type="checkbox" data-guarantee="' + c.id + '"' + (c.guaranteeSent ? " checked" : "") + lock + ">" +
      (c.guaranteeSent ? "ส่งแล้ว" : "ยังไม่ส่ง") + "</label></td>" +
      '<td data-label="จัดการ">' + actions + "</td>" +
      "</tr>";
  }).join("");

  // ข้อความสรุปผลค้นหา
  const total = currentFilter === "all" ? inCompany.length : missingReceipts(inCompany).length;
  const scope = (currentCompany === "all" ? "" : " ของบริษัท" + companyLabel(currentCompany)) +
    (currentFilter === "noreceipt" ? " ในรายการที่ยังไม่ได้รับใบเสร็จ" : "");
  if (rows.length === 0) {
    tableWrap.hidden = true;
    emptyBox.hidden = false;
    if (keyword) {
      emptyBox.innerHTML = 'ยังไม่พบการรับสัญญาของ "<strong>' + escapeHtml(typed) + '</strong>"' + scope +
        (currentView === "mine" ? " (ในรายการของคุณ ลองกด \"ของทุกคน\")" : "") +
        '<br><a href="add-contract.html">ได้รับแล้ว? กดเพื่อบันทึกรับสัญญา</a>';
    } else if (currentFilter === "noreceipt") {
      emptyBox.textContent = "ได้รับใบเสร็จครบทุกรายการแล้ว" + (currentCompany === "all" ? "" : " (บริษัท" + companyLabel(currentCompany) + ")");
    } else if (currentCompany !== "all") {
      emptyBox.textContent = "ยังไม่มีสัญญาของบริษัท" + companyLabel(currentCompany);
    } else {
      emptyBox.innerHTML = 'ยังไม่มีสัญญาที่บันทึกไว้ <a href="add-contract.html">บันทึกรับสัญญา</a>';
    }
    resultInfo.textContent = "";
  } else {
    tableWrap.hidden = false;
    emptyBox.hidden = true;
    resultInfo.textContent = keyword
      ? "พบ " + rows.length + " รายการ จาก " + total + " รายการ"
      : "แสดง " + rows.length + " รายการ";
  }
}

function setFilter(filter) {
  currentFilter = filter;
  render();
}

searchBox.addEventListener("input", render);
filterButtons.forEach((b) => b.addEventListener("click", () => setFilter(b.dataset.filter)));
companyButtons.forEach((b) => b.addEventListener("click", () => {
  currentCompany = b.dataset.company;
  render();
}));
viewButtons.forEach((b) => b.addEventListener("click", () => {
  currentView = b.dataset.view;
  try { localStorage.setItem(VIEW_KEY, currentView); } catch (e) { /* ไม่เป็นไร */ }
  render();
}));
document.getElementById("show-missing").addEventListener("click", () => {
  currentCompany = "all";
  setFilter("noreceipt");
});

// ติ๊กในตารางแล้วบันทึกทันที (เฉพาะรายการของตัวเอง)
tableBody.addEventListener("change", async (event) => {
  const box = event.target;
  const id = Number(box.dataset.receipt || box.dataset.guarantee);
  const item = contracts.find((c) => c.id === id);
  if (!item || !isMine(item)) return;

  const changes = box.dataset.receipt
    // ติ๊ก = ได้รับใบเสร็จวันนี้, เอาติ๊กออก = กลับเป็นยังไม่ได้รับ
    ? { receiptDate: box.checked ? todayISO() : "" }
    : { guaranteeSent: box.checked };

  box.disabled = true;
  try {
    Object.assign(item, await updateContract(id, changes));
  } catch (e) {
    showError("บันทึกการติ๊กไม่สำเร็จ: " + friendlyError(e));
  }
  render();
});

/* ----- ลบรายการ: ถามยืนยันก่อน และเอากลับคืนได้ ----- */

tableBody.addEventListener("click", (event) => {
  const button = event.target.closest("[data-delete]");
  if (!button) return;
  const item = contracts.find((c) => c.id === Number(button.dataset.delete));
  if (!item || !isMine(item)) return;
  pendingDeleteId = item.id;
  document.getElementById("delete-summary").innerHTML =
    "ลบสัญญาของ <strong>" + escapeHtml(item.customer) + "</strong>" +
    " (ได้รับ " + formatThaiDate(item.receivedDate) + ") ใช่ไหม?";
  deleteConfirm.hidden = false;
  deleteConfirm.scrollIntoView({ block: "center" });
});

document.getElementById("delete-no").addEventListener("click", () => {
  pendingDeleteId = null;
  deleteConfirm.hidden = true;
});

document.getElementById("delete-yes").addEventListener("click", async () => {
  const item = contracts.find((c) => c.id === pendingDeleteId);
  deleteConfirm.hidden = true;
  pendingDeleteId = null;
  if (!item) return;
  try {
    await removeContract(item.id);
  } catch (e) {
    showError("ลบไม่สำเร็จ: " + friendlyError(e));
    return;
  }
  contracts = contracts.filter((c) => c !== item);
  render();

  // แถบข้อความ พร้อมปุ่มเอากลับคืน
  successBox.hidden = false;
  successBox.innerHTML = 'ลบสัญญาของ "' + escapeHtml(item.customer) + '" แล้ว' +
    '<button type="button" class="link-button" id="undo-delete">เอากลับคืน</button>';
  document.getElementById("undo-delete").addEventListener("click", async (ev) => {
    ev.target.disabled = true;
    try {
      const [restored] = await addContracts([item]);
      contracts.push(restored);
      successBox.textContent = 'เอาสัญญาของ "' + item.customer + '" กลับคืนแล้ว';
      render();
    } catch (e) {
      ev.target.disabled = false;
      showError("เอากลับคืนไม่สำเร็จ: " + friendlyError(e));
    }
  });
  successBox.scrollIntoView({ block: "center" });
});

/* ----- ย้ายข้อมูลที่เคยกรอกไว้ในเครื่องนี้ ขึ้นระบบ ----- */

function showMigrateBanner() {
  const legacy = legacyContracts();
  const banner = document.getElementById("migrate");
  if (!legacy.length) { banner.hidden = true; return; }
  document.getElementById("migrate-count").textContent = legacy.length;
  banner.hidden = false;
}

document.getElementById("migrate-yes").addEventListener("click", async (ev) => {
  const legacy = legacyContracts();
  if (!legacy.length) return;
  ev.target.disabled = true;
  ev.target.textContent = "กำลังย้ายข้อมูล…";
  try {
    const added = await addContracts(legacy.map((c) => ({
      company: COMPANIES.some((co) => co.key === c.company) ? c.company : "",
      customer: c.customer,
      receivedDate: c.receivedDate,
      deliverDate: c.deliverDate,
      receiptDate: c.receiptDate || "",
      guaranteeSent: Boolean(c.guaranteeSent)
    })));
    markLegacyMigrated();
    contracts = contracts.concat(added);
    document.getElementById("migrate").hidden = true;
    successBox.hidden = false;
    successBox.textContent = "ย้ายข้อมูลเดิมขึ้นระบบเรียบร้อยแล้ว " + added.length + " รายการ";
    currentView = "mine";
    render();
  } catch (e) {
    ev.target.disabled = false;
    ev.target.textContent = "ย้ายขึ้นระบบ";
    showError("ย้ายข้อมูลไม่สำเร็จ: " + friendlyError(e));
  }
});

document.getElementById("migrate-no").addEventListener("click", () => {
  markLegacyMigrated();
  document.getElementById("migrate").hidden = true;
});

/* ----- เริ่มต้น: เข้าสู่ระบบ แล้วโหลดข้อมูล ----- */

async function start() {
  await requireUser();
  try {
    contracts = await fetchContracts();
  } catch (e) {
    loadingBox.hidden = true;
    showError("โหลดข้อมูลไม่สำเร็จ: " + friendlyError(e));
    return;
  }
  loadingBox.hidden = true;
  showMigrateBanner();
  render();
  document.dispatchEvent(new Event("contracts-loaded"));

  // แสดงข้อความสำเร็จ และเลื่อนไปที่แถวใหม่ / แถวที่แก้
  if (newId) {
    const saved = contracts.find((c) => c.id === newId);
    if (saved) {
      successBox.hidden = false;
      successBox.textContent = params.get("edited")
        ? 'แก้ไขสัญญาของ "' + saved.customer + '" เรียบร้อยแล้ว'
        : 'บันทึกรับสัญญาของ "' + saved.customer + '" เรียบร้อยแล้ว' +
          (saved.receiptDate ? "" : " (ยังไม่ได้รับใบเสร็จ ระบบจะเตือนไว้ให้)");
      const row = document.querySelector(".row-new");
      if (row) row.scrollIntoView({ block: "center" });
    }
  }
}

start();
