/* ===== หน้ารายการสัญญาที่ได้รับ ===== */

const contracts = loadContracts();
const searchBox = document.getElementById("search");
const tableBody = document.getElementById("contract-rows");
const resultInfo = document.getElementById("result-info");
const emptyBox = document.getElementById("empty");
const tableWrap = document.getElementById("table-wrap");
const receiptAlert = document.getElementById("receipt-alert");
const filterButtons = document.querySelectorAll("[data-filter]");
const companyButtons = document.querySelectorAll("[data-company]");

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

// ช่องใบเสร็จ: ได้รับแล้ว = วันที่สีเขียว, ยังไม่ได้รับ = บอกว่ารอมากี่วัน
function receiptCell(c) {
  if (c.receiptDate) {
    return '<label class="check check-done">' +
      '<input type="checkbox" data-receipt="' + c.id + '" checked>' +
      "ได้รับ " + formatThaiDate(c.receiptDate) + "</label>";
  }
  const waited = -daysUntil(c.receivedDate);
  return '<label class="check check-missing">' +
    '<input type="checkbox" data-receipt="' + c.id + '">' +
    "ยังไม่ได้รับ</label>" +
    '<div class="wait-note">' + (waited > 0 ? "รอมา " + waited + " วัน" : "สัญญามาถึงวันนี้") + "</div>";
}

function render() {
  const typed = searchBox.value.trim();
  const keyword = typed.toLowerCase();
  const missing = missingReceipts(contracts);

  // แถบเตือนใบเสร็จ (บอกแยกบริษัท)
  receiptAlert.hidden = missing.length === 0;
  document.getElementById("missing-count").textContent = missing.length;
  document.getElementById("missing-detail").textContent = missing.length ? "(" + companySummary(missing) + ")" : "";

  // ตัวเลขบนปุ่มกรอง: นับตามบริษัทที่เลือกอยู่
  const inCompany = contracts.filter((c) => currentCompany === "all" || c.company === currentCompany);
  document.getElementById("count-all").textContent = inCompany.length;
  document.getElementById("count-noreceipt").textContent = missingReceipts(inCompany).length;
  filterButtons.forEach((b) => b.classList.toggle("active", b.dataset.filter === currentFilter));

  // ตัวเลขบนปุ่มบริษัท: นับตามสถานะใบเสร็จที่เลือกอยู่
  const inStatus = currentFilter === "all" ? contracts : missing;
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
    const left = daysUntil(c.deliverDate);
    const soon = left >= 0 && left <= SOON_DAYS;
    const classes = [soon ? "row-soon" : "", c.id === newId ? "row-new" : ""].join(" ").trim();
    let note = "";
    if (soon) {
      note = '<div class="soon-note">' + (left === 0 ? "ต้องส่งของวันนี้" : "อีก " + left + " วันถึงวันส่งของ") + "</div>";
    }
    return "<tr" + (classes ? ' class="' + classes + '"' : "") + ">" +
      '<td data-label="ชื่อลูกค้า">' + escapeHtml(c.customer) + "</td>" +
      '<td data-label="บริษัท">' + companyBadge(c.company) + "</td>" +
      '<td data-label="วันที่ได้รับสัญญา">' + formatThaiDate(c.receivedDate) + "</td>" +
      '<td data-label="ใบเสร็จ">' + receiptCell(c) + "</td>" +
      '<td data-label="วันที่ต้องส่งของ"><div>' + formatThaiDate(c.deliverDate) + "</div>" + note + "</td>" +
      '<td data-label="ส่งเก็บเอกสารรอทำเงินค้ำ"><label class="check' + (c.guaranteeSent ? " check-done" : "") + '">' +
      '<input type="checkbox" data-guarantee="' + c.id + '"' + (c.guaranteeSent ? " checked" : "") + ">" +
      (c.guaranteeSent ? "ส่งแล้ว" : "ยังไม่ส่ง") + "</label></td>" +
      '<td data-label="จัดการ"><div class="row-actions">' +
      '<a class="small-button" href="add-contract.html?edit=' + c.id + '">แก้ไข</a>' +
      '<button type="button" class="small-button danger" data-delete="' + c.id + '">ลบ</button>' +
      "</div></td>" +
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
document.getElementById("show-missing").addEventListener("click", () => {
  currentCompany = "all";
  setFilter("noreceipt");
});

// ติ๊กในตารางแล้วบันทึกทันที
tableBody.addEventListener("change", (event) => {
  const box = event.target;
  const id = Number(box.dataset.receipt || box.dataset.guarantee);
  const item = contracts.find((c) => c.id === id);
  if (!item) return;
  const before = { receiptDate: item.receiptDate, guaranteeSent: item.guaranteeSent };

  if (box.dataset.receipt) {
    // ติ๊ก = ได้รับใบเสร็จวันนี้, เอาติ๊กออก = กลับเป็นยังไม่ได้รับ
    item.receiptDate = box.checked ? todayISO() : "";
  } else {
    item.guaranteeSent = box.checked;
  }

  if (!saveContracts(contracts)) {
    alert("บันทึกไม่สำเร็จ เบราว์เซอร์อาจปิดการเก็บข้อมูลไว้");
    Object.assign(item, before);
  }
  render();
});

/* ----- ลบรายการ: ถามยืนยันก่อน และเอากลับคืนได้ ----- */

tableBody.addEventListener("click", (event) => {
  const button = event.target.closest("[data-delete]");
  if (!button) return;
  const item = contracts.find((c) => c.id === Number(button.dataset.delete));
  if (!item) return;
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

document.getElementById("delete-yes").addEventListener("click", () => {
  const index = contracts.findIndex((c) => c.id === pendingDeleteId);
  deleteConfirm.hidden = true;
  pendingDeleteId = null;
  if (index < 0) return;
  const [removed] = contracts.splice(index, 1);
  if (!saveContracts(contracts)) {
    contracts.splice(index, 0, removed);
    alert("ลบไม่สำเร็จ เบราว์เซอร์อาจปิดการเก็บข้อมูลไว้");
    return;
  }
  render();

  // แถบข้อความ พร้อมปุ่มเอากลับคืน
  successBox.hidden = false;
  successBox.innerHTML = 'ลบสัญญาของ "' + escapeHtml(removed.customer) + '" แล้ว' +
    '<button type="button" class="link-button" id="undo-delete">เอากลับคืน</button>';
  document.getElementById("undo-delete").addEventListener("click", () => {
    contracts.splice(Math.min(index, contracts.length), 0, removed);
    if (!saveContracts(contracts)) {
      contracts.splice(contracts.indexOf(removed), 1);
      alert("เอากลับคืนไม่สำเร็จ เบราว์เซอร์อาจปิดการเก็บข้อมูลไว้");
      return;
    }
    successBox.textContent = 'เอาสัญญาของ "' + removed.customer + '" กลับคืนแล้ว';
    render();
  });
  successBox.scrollIntoView({ block: "center" });
});

render();

// แสดงข้อความสำเร็จ และเลื่อนไปที่แถวใหม่ / แถวที่แก้
if (newId) {
  const saved = contracts.find((c) => c.id === newId);
  if (saved) {
    const msg = successBox;
    msg.hidden = false;
    msg.textContent = params.get("edited")
      ? 'แก้ไขสัญญาของ "' + saved.customer + '" เรียบร้อยแล้ว'
      : 'บันทึกรับสัญญาของ "' + saved.customer + '" เรียบร้อยแล้ว' +
        (saved.receiptDate ? "" : " (ยังไม่ได้รับใบเสร็จ ระบบจะเตือนไว้ให้)");
    const row = document.querySelector(".row-new");
    if (row) row.scrollIntoView({ block: "center" });
  }
}
