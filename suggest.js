/* ===== รายชื่อลูกค้าให้เลือก ขณะพิมพ์ (ใช้ทั้งช่องค้นหา และช่องชื่อลูกค้าในฟอร์ม) ===== */

// เทียบชื่อแบบไม่สนช่องว่างและตัวพิมพ์
function normalizeName(text) {
  return String(text || "").replace(/\s+/g, "").toLowerCase();
}

// รวมชื่อลูกค้าที่ไม่ซ้ำ พร้อมจำนวนสัญญา
function customerNames(list) {
  const map = new Map();
  list.forEach((c) => {
    const key = normalizeName(c.customer);
    if (!key) return;
    const found = map.get(key);
    if (found) found.count += 1;
    else map.set(key, { name: c.customer, key, count: 1 });
  });
  return [...map.values()];
}

// ผูกรายชื่อให้เลือกกับช่องพิมพ์
// getList() = ส่งรายการสัญญาล่าสุด, onPick(name) = ทำอะไรต่อเมื่อเลือกชื่อ
function attachCustomerSuggest(input, getList, onPick) {
  const wrap = document.createElement("div");
  wrap.className = "suggest-wrap";
  input.parentNode.insertBefore(wrap, input);
  wrap.appendChild(input);

  const box = document.createElement("ul");
  box.className = "suggest-list";
  box.setAttribute("role", "listbox");
  box.hidden = true;
  wrap.appendChild(box);

  input.setAttribute("autocomplete", "off");
  input.setAttribute("aria-autocomplete", "list");

  let items = [];
  let active = -1;

  function close() {
    box.hidden = true;
    active = -1;
  }

  function highlight(index) {
    active = index;
    [...box.children].forEach((li, i) => li.classList.toggle("active", i === index));
    if (box.children[index]) box.children[index].scrollIntoView({ block: "nearest" });
  }

  function pick(index) {
    const item = items[index];
    if (!item) return;
    input.value = item.name;
    close();
    onPick(item.name);
  }

  function update() {
    const typed = normalizeName(input.value);
    if (!typed) { close(); return; }
    items = customerNames(getList())
      .filter((n) => n.key.includes(typed) && n.key !== typed)
      .sort((a, b) =>
        (b.key.startsWith(typed) - a.key.startsWith(typed)) ||
        (b.count - a.count) ||
        a.name.localeCompare(b.name, "th"))
      .slice(0, 10);
    if (!items.length) { close(); return; }
    box.innerHTML = items.map((n, i) =>
      '<li role="option" data-index="' + i + '">' +
      '<span class="suggest-name">' + escapeHtml(n.name) + "</span>" +
      '<span class="suggest-count">' + n.count + " ฉบับ</span></li>"
    ).join("");
    box.hidden = false;
    active = -1;
  }

  input.addEventListener("input", update);
  input.addEventListener("focus", update);
  input.addEventListener("blur", () => setTimeout(close, 150));
  input.addEventListener("keydown", (event) => {
    if (box.hidden) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      highlight(Math.min(active + 1, items.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      highlight(Math.max(active - 1, 0));
    } else if (event.key === "Enter" && active >= 0) {
      event.preventDefault();
      pick(active);
    } else if (event.key === "Escape") {
      close();
    }
  });
  // ใช้ mousedown เพื่อเลือกก่อนช่องพิมพ์เสียโฟกัส
  box.addEventListener("mousedown", (event) => {
    const li = event.target.closest("li[data-index]");
    if (!li) return;
    event.preventDefault();
    pick(Number(li.dataset.index));
  });
}
