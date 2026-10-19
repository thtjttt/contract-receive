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
const companyRows = document.getElementById("company-rows");
const companyTotal = document.getElementById("company-total");

/* ----- บริษัท + จำนวนชุด: ติ๊กได้หลายบริษัท ----- */

companyRows.innerHTML = COMPANIES.map((co) =>
  '<div class="company-row" data-row="' + co.key + '">' +
  '<label class="check company-check"><input type="checkbox" data-company="' + co.key + '"> ' + co.label + "</label>" +
  '<span class="company-sets-input">' +
  '<input type="number" min="1" step="1" inputmode="numeric" data-sets="' + co.key + '" aria-label="จำนวนชุดของ ' + co.label + '" disabled>' +
  " ชุด</span>" +
  "</div>"
).join("");

const companyBoxes = companyRows.querySelectorAll("input[data-company]");
const setsBox = (key) => companyRows.querySelector('input[data-sets="' + key + '"]');

// ตัวเลขชุด: ตัวเลขเต็มตั้งแต่ 1 (ผิดรูปแบบ = 0)
function readSets(input) {
  const text = input.value.trim();
  return /^\d+$/.test(text) && Number(text) > 0 ? Number(text) : 0;
}

// บริษัทที่ติ๊ก พร้อมจำนวนชุด
function selectedItems() {
  return [...companyBoxes].filter((b) => b.checked).map((b) => ({
    company: b.dataset.company,
    sets: readSets(setsBox(b.dataset.company))
  }));
}

function updateCompanyRows() {
  companyBoxes.forEach((b) => {
    const input = setsBox(b.dataset.company);
    input.disabled = !b.checked;
    if (!b.checked) input.value = "";
    b.closest(".company-row").classList.toggle("is-checked", b.checked);
  });
  const items = selectedItems();
  const total = items.reduce((sum, i) => sum + i.sets, 0);
  companyTotal.textContent = items.length ? "รวม " + items.length + " บริษัท " + setsText(total) : "";
}

companyBoxes.forEach((b) => b.addEventListener("change", () => {
  updateCompanyRows();
  if (b.checked) setsBox(b.dataset.company).focus();
  clearCompanyError();
}));
companyRows.querySelectorAll("input[data-sets]").forEach((input) => input.addEventListener("input", () => {
  updateCompanyRows();
  clearCompanyError();
}));

function clearCompanyError() {
  setError("company", "");
  companyRows.querySelectorAll(".invalid").forEach((el) => el.classList.remove("invalid"));
  duplicateBox.hidden = true;
  saveButton.textContent = saveLabel;
}

/* ----- โหมดแก้ไข ----- */

// เลขรายการที่จะแก้ (โหลดข้อมูลจริงใน start ด้านล่าง)
const editId = Number(new URLSearchParams(location.search).get("edit"));
let editing = null;
let saveLabel = editId ? "บันทึกการแก้ไข" : "บันทึกรับสัญญา";
const formError = document.getElementById("form-error");

function showFormError(message) {
  formError.hidden = !message;
  formError.textContent = message || "";
}

// แทนฟอร์มด้วยข้อความ (เช่น ไม่พบรายการ หรือเป็นรายการของคนอื่น)
function replaceForm(html) {
  form.hidden = true;
  form.insertAdjacentHTML("afterend", '<p class="empty panel">' + html +
    ' <a href="contracts.html">กลับไปหน้ารายการ</a></p>');
}

function fillForEdit() {
  document.title = "แก้ไขสัญญา | ระบบรับเข้าสัญญาซื้อขาย";
  document.getElementById("page-title").textContent = "แก้ไขสัญญา";
  document.getElementById("page-subtitle").textContent = "แก้ข้อมูลแล้วกด \"บันทึกการแก้ไข\"";
  editing.items.forEach((item) => {
    const box = companyRows.querySelector('input[data-company="' + item.company + '"]');
    if (!box) return;
    box.checked = true;
    setsBox(item.company).value = item.sets || "";
  });
  updateCompanyRows();
  fields.customer.value = editing.customer;
  fields.receivedDate.value = editing.receivedDate;
  fields.deliverDate.value = editing.deliverDate;
  receiptDateInput.value = editing.receiptDate || "";
  guaranteeBox.checked = Boolean(editing.guaranteeSent);
  document.getElementById("ebidding").checked = Boolean(editing.ebidding);
  // ตอนแก้ไข ใช้ช่องวันที่ใบเสร็จ แทนช่องติ๊ก "มาพร้อมสัญญา"
  document.getElementById("receipt-date-field").hidden = false;
  document.getElementById("receipt-with-field").hidden = true;
  saveButton.textContent = saveLabel;
  [fields.receivedDate, fields.deliverDate, receiptDateInput].forEach(showThaiDate);
}

// วันที่ได้รับ ตั้งเป็นวันนี้ให้อัตโนมัติ (ตอนบันทึกใหม่)
if (!editId) fields.receivedDate.value = todayISO();

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

// ตรวจว่ากรอกครบและถูกต้อง
function validate(data) {
  let ok = true;
  if (!data.items.length) {
    setError("company", "กรุณาติ๊กบริษัทที่ได้รับสัญญา อย่างน้อย 1 บริษัท");
    ok = false;
  } else {
    const missing = data.items.filter((i) => !i.sets);
    missing.forEach((i) => setsBox(i.company).classList.add("invalid"));
    if (missing.length) {
      setError("company", "กรุณากรอกจำนวนชุดของ " + missing.map((i) => companyLabel(i.company)).join(", ") +
        " เป็นตัวเลขเต็ม ตั้งแต่ 1 ขึ้นไป");
      ok = false;
    }
  }
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

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  setError("company", "");
  companyRows.querySelectorAll(".invalid").forEach((el) => el.classList.remove("invalid"));

  const data = {
    items: selectedItems(),
    customer: fields.customer.value.trim().replace(/\s+/g, " "),
    receivedDate: fields.receivedDate.value,
    deliverDate: fields.deliverDate.value,
    guaranteeSent: guaranteeBox.checked,
    ebidding: document.getElementById("ebidding").checked,
    // ตอนแก้ไข ใช้วันที่ในช่องใบเสร็จ
    // ตอนบันทึกใหม่ ใบเสร็จมาพร้อมสัญญา = วันที่ได้รับใบเสร็จ เท่ากับวันที่ได้รับสัญญา
    receiptDate: editing
      ? receiptDateInput.value
      : (document.getElementById("receiptWith").checked ? fields.receivedDate.value : "")
  };

  if (!validate(data)) {
    const firstBad = form.querySelector("input.invalid, .invalid input, .invalid");
    if (firstBad) firstBad.focus();
    return;
  }

  saveButton.disabled = true;
  showFormError("");
  try {
    await saveForm(data);
  } catch (e) {
    showFormError("บันทึกไม่สำเร็จ: " + friendlyError(e));
  }
  saveButton.disabled = false;
});

async function saveForm(data) {
  // เคยบันทึกลูกค้ารายนี้กับบริษัทเดียวกันแล้ว (ของใครก็ได้ ไม่นับรายการที่กำลังแก้): เตือนก่อน กดอีกครั้งจึงบันทึก
  // ตอนแก้ไข: เตือนเฉพาะบริษัทที่เพิ่งติ๊กเพิ่ม (บริษัทเดิมเคยยืนยันไปแล้ว)
  const oldKeys = editing ? editing.items.map((i) => i.company) : [];
  const keys = data.items.map((i) => i.company).filter((k) => !oldKeys.includes(k));
  if (duplicateBox.hidden && keys.length) {
    const contracts = await fetchContracts();
    const existing = contracts.filter((c) =>
      c.id !== editId && sameText(c.customer, data.customer) && c.items.some((i) => keys.includes(i.company)));
    if (existing.length > 0) {
      showDuplicate(keys, existing);
      return;
    }
  }

  let id = editId;
  if (editing) {
    await updateContract(editId, data);
  } else {
    const [added] = await addContracts([data]);
    id = added.id;
  }
  location.href = "contracts.html?" + (editing ? "edited=" : "new=") + id;
}

function showDuplicate(keys, existing) {
  const same = [...new Set(existing.flatMap((c) => c.items.map((i) => i.company)).filter((k) => keys.includes(k)))];
  const dates = existing.map((c) => formatThaiDate(c.receivedDate) +
    (c.userId === currentUser.id ? "" : " (บันทึกโดย " + escapeHtml(recorderLabel(c)) + ")")).join(", ");
  duplicateBox.innerHTML =
    "<strong>ลูกค้ารายนี้มีสัญญากับบริษัท" + same.map(companyLabel).join(", ") + " บันทึกไว้แล้ว</strong>" +
    "<br>ได้รับเมื่อ: " + dates +
    "<br>ถ้าถูกต้องแล้ว กด \"ยืนยัน บันทึก\" ถ้าไม่ใช่ กด \"ยกเลิก\"";
  duplicateBox.hidden = false;
  saveButton.textContent = "ยืนยัน บันทึก";
  duplicateBox.scrollIntoView({ block: "center" });
}

/* ----- เริ่มต้น: เข้าสู่ระบบ แล้วโหลดรายการที่จะแก้ (ถ้ามี) ----- */

async function start() {
  saveButton.disabled = true;
  const user = await requireUser();
  if (editId) {
    try {
      editing = await fetchContract(editId);
    } catch (e) {
      replaceForm("โหลดรายการที่จะแก้ไม่สำเร็จ: " + escapeHtml(friendlyError(e)));
      return;
    }
    if (!editing) {
      replaceForm("ไม่พบรายการที่จะแก้ไข อาจถูกลบไปแล้ว");
      return;
    }
    if (editing.userId !== user.id) {
      replaceForm("รายการนี้บันทึกโดย " + escapeHtml(recorderLabel(editing)) + " แก้ไขได้เฉพาะเจ้าของรายการ");
      return;
    }
    fillForEdit();
  }
  saveButton.disabled = false;

  // ช่องชื่อลูกค้า: แสดงรายชื่อลูกค้าเดิมให้เลือก (สะกดตรงกันทุกครั้ง)
  let knownContracts = [];
  try { knownContracts = await fetchContracts(); } catch (e) { /* ไม่มีรายชื่อให้เลือก ก็พิมพ์เองได้ */ }
  attachCustomerSuggest(fields.customer, () => knownContracts, () => {
    setError("customer", "");
    duplicateBox.hidden = true;
    saveButton.textContent = saveLabel;
  });
}

start();
