/* ===== หน้าเข้าสู่ระบบ ===== */

const loginForm = document.getElementById("login-form");
const loginError = document.getElementById("login-error");
const loginButton = document.getElementById("login-button");

// หน้าที่จะกลับไปหลังเข้าสู่ระบบ (เฉพาะหน้าในเว็บนี้)
function nextPage() {
  const next = new URLSearchParams(location.search).get("next") || "";
  return /^[\w-]+\.html(\?[\w=&%-]*)?$/.test(next) ? next : "index.html";
}

// เข้าสู่ระบบอยู่แล้ว ไปหน้าถัดไปเลย
db.auth.getSession().then(({ data }) => {
  if (data.session) location.replace(nextPage());
});

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  loginError.textContent = "";

  if (!email || !password) {
    loginError.textContent = "กรุณากรอกอีเมลและรหัสผ่าน";
    return;
  }

  loginButton.disabled = true;
  loginButton.textContent = "กำลังเข้าสู่ระบบ…";
  const { error } = await db.auth.signInWithPassword({ email, password });
  loginButton.disabled = false;
  loginButton.textContent = "เข้าสู่ระบบ";

  if (error) {
    loginError.textContent = /invalid/i.test(error.message)
      ? "อีเมลหรือรหัสผ่านไม่ถูกต้อง"
      : friendlyError(error);
    return;
  }
  location.replace(nextPage());
});
