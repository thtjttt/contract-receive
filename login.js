/* ===== หน้าเข้าสู่ระบบ ===== */

const loginForm = document.getElementById("login-form");
const loginError = document.getElementById("login-error");
const loginButton = document.getElementById("login-button");

// หน้าที่จะกลับไปหลังเข้าสู่ระบบ (เฉพาะหน้าในเว็บนี้)
function nextPage() {
  const next = new URLSearchParams(location.search).get("next") || "";
  return /^[\w-]+\.html(\?[\w=&%-]*)?$/.test(next) ? next : "index.html";
}

// ชื่อสั้น → อีเมลที่เป็นไปได้ เช่น "may" → "yongsawat.may@gmail.com" หรือ "yongsawat.printing+may@gmail.com"
// ถ้าพิมพ์อีเมลเต็ม (มี @) ใช้ตามที่พิมพ์
function loginEmails(text) {
  const value = text.trim().toLowerCase();
  if (!value || value.includes("@")) return [value];
  if (value.startsWith("yongsawat.")) return [value + "@gmail.com"];
  return ["yongsawat." + value + "@gmail.com", "yongsawat.printing+" + value + "@gmail.com"];
}

// เข้าสู่ระบบอยู่แล้ว ไปหน้าถัดไปเลย
db.auth.getSession().then(({ data }) => {
  if (data.session) location.replace(nextPage());
});

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const emails = loginEmails(document.getElementById("email").value);
  const email = emails[0];
  const password = document.getElementById("password").value;
  loginError.textContent = "";

  if (!email || !password) {
    loginError.textContent = "กรุณากรอกชื่อผู้ใช้ (หรืออีเมล) และรหัสผ่าน";
    return;
  }

  loginButton.disabled = true;
  loginButton.textContent = "กำลังเข้าสู่ระบบ…";
  // ลองอีเมลที่เป็นไปได้ทีละแบบ จนกว่าจะเข้าได้
  let error = null;
  for (const candidate of emails) {
    ({ error } = await db.auth.signInWithPassword({ email: candidate, password }));
    if (!error || !/invalid/i.test(error.message)) break;
  }
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
