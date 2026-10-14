/* ===== หน้าบันทึกรับสัญญา (และหน้าแก้ไข เมื่อเปิดด้วย ?edit=เลขรายการ) ===== */

const form = document.getElementById("contract-form");
const fields = {
  customer: document.getElementById("customer"),
  receivedDate: document.getElementById("receivedDate"),
  deliverDate: document.getElementById("deliverDate")
};
const receiptDateInput = document.getElementById("receiptDate");
const guaranteeBox = document.getElementById("guaranteeSent");
const duplicateBox = document.getElementById("duplicate");
const saveButton = document.getElementById("save-button");
const companyGroup = document.getElementById("company-group");
const companyInputs = document.querySelectorAll("input[name=company]");

function selectedCompany() {
  const checked = document.querySelector("input[name=company]:checked");
  return checked ? checked.value : "";
}

// โหมดแก้ไข: หารายการที่จะแก้
const editId = Number(new URLSearchParams(location.search).get("edit"));
const editing = editId ? loadContracts().find((c) => c.id === editId) : null;
const saveLabel = editing ? "บันทึกการแก้ไข" : "บันทึกรับสัญญา";

if (editId && !editing) {
  // ไม่พบรายการ (อาจถูกลบไปแล้ว)
  form.hidden = true;
  form.insertAdjacentHTML("afterend", '<p class="empty panel">ไม่พบรายการที่จะแก้ไข อาจถูกลบไปแล้ว ' +
    '<a href="contracts.html">กลับไปหน้ารายการ</a></p>');
} else if (editing) {
  document.title = "แก้ไขสัญญา | ระบบรับเข้าสัญญาซื้อขาย";
  document.getElementById("page-title").textContent = "แก้ไขสัญญา";
  document.getElementById("page-subtitle").textContent = "แก้ข้อมูลแล้วกด \"บันทึกการแก้ไข\"";
  companyInputs.forEach((r) => { r.checked = r.value === editing.company; });
  fields.customer.value = editing.customer;
  fields.receivedDate.value = editing.receivedDate;
  fields.deliverDate.value = editing.deliverDate;
  receiptDateInput.value = editing.receiptDate || "";
  guaranteeBox.checked = Boolean(editing.guaranteeSent);
  // ตอนแก้ไข ใช้ช่องวันที่ใบเสร็จ แทนช่องติ๊ก "มาพร้อมสัญญา"
  document.getElementById("receipt-date-field").hidden = false;
  document.getElementById("receipt-with-field").hidden = true;
  saveButton.textContent = saveLabel;
} else {
  // วันที่ได้รับ ตั้งเป็นวันนี้ให้อัตโนมัติ
  fields.receivedDate.value = todayISO();
}

// แสดงวันที่แบบ พ.ศ. ใต้ช่องวันที่ ให้อ่านง่าย
function showThaiDate(input) {
  document.getElementById(input.id + "-thai").textContent = input.value ? "= " + formatThaiDate(input.value) : "";
}
[fields.receivedDate, fields.deliverDate, receiptDateInput].forEach((input) => {
  showThaiDate(input);
  input.addEventListener("input", () => showThaiDate(input));
});

document.getElementById("receipt-clear").addEventListener("click", () => {
  receiptDateInput.value = "";
  showThaiDate(receiptDateInput);
  setError("receiptDate", "");
});

function setError(key, message) {
  document.getElementById(key + "-error").textContent = message;
  const input = key === "company" ? companyGroup : (fields[key] || receiptDateInput);
  input.classList.toggle("invalid", Boolean(message));
}

// แก้ข้อมูลแล้ว ล้างคำเตือนของช่องนั้น และให้ตรวจเรื่องบันทึกซ้ำใหม่
Object.keys(fields).forEach((key) => {
  fields[key].addEventListener("input", () => {
    setError(key, "");
    duplicateBox.hidden = true;
    saveButton.textContent = saveLabel;
  });
});
receiptDateInput.addEventListener("input", () => setError("receiptDate", ""));
companyInputs.forEach((r) => r.addEventListener("change", () => {
  setError("company", "");
  duplicateBox.hidden = true;
  saveButton.textContent = saveLabel;
}));

// ตรวจว่ากรอกครบและถูกต้อง
function validate(data) {
  let ok = true;
  if (!data.company) { setError("company", "กรุณาเลือกบริษัทที่ได้รับสัญญา"); ok = false; }
  if (!data.customer) { setError("customer", "กรุณากรอกชื่อลูกค้า"); ok = false; }
  if (!data.receivedDate) { setError("receivedDate", "กรุณาเลือกวันที่ได้รับสัญญา"); ok = false; }
  if (!data.deliverDate) {
    setError("deliverDate", "กรุณาเลือกวันที่ต้องส่งของ");
    ok = false;
  } else if (data.receivedDate && data.deliverDate < data.receivedDate) {
    setError("deliverDate", "วันที่ต้องส่งของ อยู่ก่อนวันที่ได้รับสัญญา กรุณาตรวจอีกครั้ง");
    ok = false;
  }
  if (data.receiptDate && data.receivedDate && data.receiptDate < data.receivedDate) {
    setError("receiptDate", "วันที่ได้รับใบเสร็จ อยู่ก่อนวันที่ได้รับสัญญา กรุณาตรวจอีกครั้ง");
    ok = false;
  }
  return ok;
}

// เทียบชื่อแบบไม่สนช่องว่างและตัวพิมพ์
function sameText(a, b) {
  const clean = (s) => s.replace(/\s+/g, "").toLowerCase();
  return clean(a) === clean(b);
}

form.addEventListener("submit", (event) => {
  event.preventDefault();

  const data = {
    company: selectedCompany(),
    customer: fields.customer.value.trim().replace(/\s+/g, " "),
    receivedDate: fields.receivedDate.value,
    deliverDate: fields.deliverDate.value,
    guaranteeSent: guaranteeBox.checked,
    // ตอนแก้ไข ใช้วันที่ในช่องใบเสร็จ
    // ตอนบันทึกใหม่ ใบเสร็จมาพร้อมสัญญา = วันที่ได้รับใบเสร็จ เท่ากับวันที่ได้รับสัญญา
    receiptDate: editing
      ? receiptDateInput.value
      : (document.getElementById("receiptWith").checked ? fields.receivedDate.value : "")
  };

  if (!validate(data)) {
    const firstBad = form.querySelector(".invalid");
    if (firstBad) (firstBad.querySelector("input") || firstBad).focus();
    return;
  }

  const contracts = loadContracts();

  // เคยบันทึกลูกค้ารายนี้กับบริษัทเดียวกันแล้ว (ไม่นับรายการที่กำลังแก้): เตือนก่อน กดอีกครั้งจึงบันทึก
  const existing = contracts.filter((c) =>
    c.id !== editId && c.company === data.company && sameText(c.customer, data.customer));
  if (existing.length > 0 && duplicateBox.hidden) {
    const dates = existing.map((c) => formatThaiDate(c.receivedDate)).join(", ");
    duplicateBox.innerHTML =
      "<strong>ลูกค้ารายนี้มีสัญญากับบริษัท" + companyLabel(data.company) + "บันทึกไว้แล้ว</strong>" +
      "<br>ได้รับเมื่อ: " + dates +
      "<br>ถ้าถูกต้องแล้ว กด \"ยืนยัน บันทึก\" ถ้าไม่ใช่ กด \"ยกเลิก\"";
    duplicateBox.hidden = false;
    saveButton.textContent = "ยืนยัน บันทึก";
    duplicateBox.scrollIntoView({ block: "center" });
    return;
  }

  let id = editId;
  if (editing) {
    const index = contracts.findIndex((c) => c.id === editId);
    if (index < 0) {
      alert("ไม่พบรายการที่จะแก้ไข อาจถูกลบไปแล้ว");
      return;
    }
    contracts[index] = { id: editId, ...data };
  } else {
    id = contracts.reduce((max, c) => Math.max(max, c.id), 0) + 1;
    contracts.push({ id, ...data });
  }

  if (!saveContracts(contracts)) {
    alert("บันทึกไม่สำเร็จ เบราว์เซอร์อาจปิดการเก็บข้อมูลไว้");
    return;
  }

  location.href = "contracts.html?" + (editing ? "edited=" : "new=") + id;
});
