/* ===== หน้าเข้าสู่ระบบ ===== */

const loginForm = document.getElementById("login-form");
const loginError = document.getElementById("login-error");
const loginButton = document.getElementById("login-button");

// หน้าที่จะกลับไปหลังเข้าสู่ระบบ (เฉพาะหน้าในเว็บนี้)
function nextPage() {
  const next = new URLSearchParams(location.search).get("next") || "";
  return /^[\w-]+\.html(\?[\w=&%-]*)?$/.test(next) ? next : "index.html";
}

// ชื่อสั้น → อีเมลเต็ม เช่น "somchai" → "yongsawat.printing+somchai@gmail.com"
// ถ้าพิมพ์อีเมลเต็ม (มี @) ใช้ตามที่พิมพ์
const SHORT_NAME_EMAIL = { before: "yongsawat.printing+", after: "@gmail.com" };
function toLoginEmail(text) {
  const value = text.trim().toLowerCase();
  if (!value || value.includes("@")) return value;
  return SHORT_NAME_EMAIL.before + value + SHORT_NAME_EMAIL.after;
}

// เข้าสู่ระบบอยู่แล้ว ไปหน้าถัดไปเลย
db.auth.getSession().then(({ data }) => {
  if (data.session) location.replace(nextPage());
});

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const email = toLoginEmail(document.getElementById("email").value);
  const password = document.getElementById("password").value;
  loginError.textContent = "";

  if (!email || !password) {
    loginError.textContent = "กรุณากรอกชื่อผู้ใช้ (หรืออีเมล) และรหัสผ่าน";
    return;
  }

  loginButton.disabled = true;
  loginButton.textContent = "กำลังเข้าสู่ระบบ…";
  const { error } = await db.auth.signInWithPassword({ email, password });
  loginButton.disabled = false;
  loginButton.textContent = "เข้าสู่ระบบ";

  if (error) {
    loginError.textContent = /invalid/i.test(error.message)
      ? "ชื่อผู้ใช้ (หรืออีเมล) หรือรหัสผ่านไม่ถูกต้อง"
      : friendlyError(error);
    return;
  }
  location.replace(nextPage());
});
