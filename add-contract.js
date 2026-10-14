/* ===== หน้าบันทึกรับสัญญา ===== */

const form = document.getElementById("contract-form");
const fields = {
  customer: document.getElementById("customer"),
  receivedDate: document.getElementById("receivedDate"),
  deliverDate: document.getElementById("deliverDate")
};
const duplicateBox = document.getElementById("duplicate");
const saveButton = document.getElementById("save-button");

// วันที่ได้รับ ตั้งเป็นวันนี้ให้อัตโนมัติ
fields.receivedDate.value = todayISO();

// แสดงวันที่แบบ พ.ศ. ใต้ช่องวันที่ ให้อ่านง่าย
function showThaiDate(key) {
  const value = fields[key].value;
  document.getElementById(key + "-thai").textContent = value ? "= " + formatThaiDate(value) : "";
}
["receivedDate", "deliverDate"].forEach((key) => {
  showThaiDate(key);
  fields[key].addEventListener("input", () => showThaiDate(key));
});

function setError(key, message) {
  document.getElementById(key + "-error").textContent = message;
  fields[key].classList.toggle("invalid", Boolean(message));
}

// แก้ข้อมูลแล้ว ล้างคำเตือนของช่องนั้น และให้ตรวจเรื่องบันทึกซ้ำใหม่
Object.keys(fields).forEach((key) => {
  fields[key].addEventListener("input", () => {
    setError(key, "");
    duplicateBox.hidden = true;
    saveButton.textContent = "บันทึกรับสัญญา";
  });
});

// ตรวจว่ากรอกครบและถูกต้อง
function validate(data) {
  let ok = true;
  if (!data.customer) { setError("customer", "กรุณากรอกชื่อลูกค้า"); ok = false; }
  if (!data.receivedDate) { setError("receivedDate", "กรุณาเลือกวันที่ได้รับสัญญา"); ok = false; }
  if (!data.deliverDate) {
    setError("deliverDate", "กรุณาเลือกวันที่ต้องส่งของ");
    ok = false;
  } else if (data.receivedDate && data.deliverDate < data.receivedDate) {
    setError("deliverDate", "วันที่ต้องส่งของ อยู่ก่อนวันที่ได้รับสัญญา กรุณาตรวจอีกครั้ง");
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
    customer: fields.customer.value.trim().replace(/\s+/g, " "),
    receivedDate: fields.receivedDate.value,
    deliverDate: fields.deliverDate.value,
    guaranteeSent: document.getElementById("guaranteeSent").checked,
    // ใบเสร็จมาพร้อมสัญญา = วันที่ได้รับใบเสร็จ เท่ากับวันที่ได้รับสัญญา
    receiptDate: document.getElementById("receiptWith").checked ? fields.receivedDate.value : ""
  };

  if (!validate(data)) {
    const firstBad = form.querySelector(".invalid");
    if (firstBad) firstBad.focus();
    return;
  }

  const contracts = loadContracts();

  // เคยบันทึกลูกค้ารายนี้แล้ว: เตือนก่อน กดอีกครั้งจึงบันทึก
  const existing = contracts.filter((c) =>
    sameText(c.customer, data.customer));
  if (existing.length > 0 && duplicateBox.hidden) {
    const dates = existing.map((c) => formatThaiDate(c.receivedDate)).join(", ");
    duplicateBox.innerHTML =
      "<strong>ลูกค้ารายนี้เคยบันทึกรับสัญญาแล้ว</strong>" +
      "<br>ได้รับเมื่อ: " + dates +
      "<br>ถ้าเป็นสัญญาฉบับใหม่ กด \"ยืนยัน บันทึกอีกฉบับ\" ถ้าไม่ใช่ กด \"ยกเลิก\"";
    duplicateBox.hidden = false;
    saveButton.textContent = "ยืนยัน บันทึกอีกฉบับ";
    duplicateBox.scrollIntoView({ block: "center" });
    return;
  }

  const newId = contracts.reduce((max, c) => Math.max(max, c.id), 0) + 1;
  contracts.push({ id: newId, ...data });
  if (!saveContracts(contracts)) {
    alert("บันทึกไม่สำเร็จ เบราว์เซอร์อาจปิดการเก็บข้อมูลไว้");
    return;
  }

  location.href = "contracts.html?new=" + newId;
});
