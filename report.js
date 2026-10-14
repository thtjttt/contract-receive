/* ===== หน้ารายงานสัญญาที่ได้รับประจำวัน ===== */

let allContracts = [];
const dateInput = document.getElementById("report-date");
const reportRows = document.getElementById("report-rows");
const reportWrap = document.getElementById("report-wrap");
const reportEmpty = document.getElementById("report-empty");
const reportSummary = document.getElementById("report-summary");
const reportSubtitle = document.getElementById("report-subtitle");
const viewButtons = document.querySelectorAll("[data-view]");

// มุมมองเริ่มต้น: ของทุกคน
let reportView = "everyone";

// เปิดด้วย ?date=2026-10-14 ได้ ไม่ใส่ = วันนี้
const startDate = new URLSearchParams(location.search).get("date");
dateInput.value = /^\d{4}-\d{2}-\d{2}$/.test(startDate || "") ? startDate : todayISO();

// เลื่อนวันที่ไปข้างหน้า/ข้างหลัง
function shiftDate(iso, days) {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return date.toISOString().slice(0, 10);
}

function render() {
  const day = dateInput.value || todayISO();
  const mineOnly = reportView === "mine";
  viewButtons.forEach((b) => b.classList.toggle("active", b.dataset.view === reportView));

  const rows = allContracts
    .filter((c) => c.receivedDate === day)
    .filter((c) => !mineOnly || c.userId === currentUser.id)
    .sort((a, b) => a.id - b.id);

  const isToday = day === todayISO();
  reportSubtitle.textContent = "วันที่ได้รับสัญญา: " + formatThaiDate(day) + (isToday ? " (วันนี้)" : "") +
    " · " + (mineOnly ? "เฉพาะของฉัน (" + currentUser.email + ")" : "ของทุกคน");

  reportRows.innerHTML = rows.map((c, i) =>
    "<tr>" +
    '<td class="num">' + (i + 1) + "</td>" +
    "<td>" + escapeHtml(c.customer) + "</td>" +
    "<td>" + companyBadge(c.company) + "</td>" +
    '<td class="sets-col">' + setsText(c.sets) + "</td>" +
    "<td>" + escapeHtml(recorderName(c.recorder)) + "</td>" +
    "<td>" + formatThaiDate(c.deliverDate) + "</td>" +
    "<td>" + (c.receiptDate
      ? '<span class="check-done">ได้รับ ' + formatThaiDate(c.receiptDate) + "</span>"
      : '<span class="check-missing">ยังไม่ได้รับ</span>') + "</td>" +
    "<td>" + (c.guaranteeSent ? '<span class="check-done">ส่งแล้ว</span>' : '<span class="muted">ยังไม่ส่ง</span>') + "</td>" +
    "</tr>"
  ).join("");

  reportWrap.hidden = rows.length === 0;
  reportEmpty.hidden = rows.length > 0;
  reportEmpty.textContent = "ไม่มีสัญญาที่ได้รับใน" + (isToday ? "วันนี้" : "วันที่ " + formatThaiDate(day));
  reportSummary.textContent = rows.length
    ? "รวม " + rows.length + " ฉบับ " + setsText(totalSets(rows)) + " (" + companySummary(rows) + ")" +
      " · ยังไม่ได้รับใบเสร็จ " + missingReceipts(rows).length + " ฉบับ"
    : "";
  document.getElementById("report-printed").textContent = "พิมพ์เมื่อ " + formatThaiDate(todayISO()) +
    " เวลา " + new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }) + " น.";
  document.title = "รายงานประจำวัน " + formatThaiDate(day) + " | ระบบรับเข้าสัญญาซื้อขาย";
}

dateInput.addEventListener("change", render);
document.getElementById("prev-day").addEventListener("click", () => { dateInput.value = shiftDate(dateInput.value || todayISO(), -1); render(); });
document.getElementById("next-day").addEventListener("click", () => { dateInput.value = shiftDate(dateInput.value || todayISO(), 1); render(); });
document.getElementById("to-today").addEventListener("click", () => { dateInput.value = todayISO(); render(); });
viewButtons.forEach((b) => b.addEventListener("click", () => { reportView = b.dataset.view; render(); }));
document.getElementById("print-report").addEventListener("click", () => { render(); window.print(); });

(async () => {
  await requireUser();
  try {
    allContracts = await fetchContracts();
  } catch (e) {
    reportSubtitle.textContent = "";
    const box = document.getElementById("load-error");
    box.hidden = false;
    box.textContent = "โหลดข้อมูลไม่สำเร็จ: " + friendlyError(e);
    return;
  }
  render();
})();
