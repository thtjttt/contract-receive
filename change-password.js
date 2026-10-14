/* ===== หน้าเปลี่ยนรหัสผ่าน (เปลี่ยนได้เฉพาะของตัวเอง) ===== */

const passwordForm = document.getElementById("password-form");
const passwordButton = document.getElementById("password-button");
const passwordError = document.getElementById("password-error");
const passwordSuccess = document.getElementById("password-success");
const pwFields = ["current-password", "new-password", "confirm-password"];

function setPwError(id, message) {
  document.getElementById(id + "-error").textContent = message;
  document.getElementById(id).classList.toggle("invalid", Boolean(message));
}

pwFields.forEach((id) => {
  document.getElementById(id).addEventListener("input", () => {
    setPwError(id, "");
    passwordError.hidden = true;
  });
});

passwordForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  passwordError.hidden = true;
  passwordSuccess.hidden = true;
  pwFields.forEach((id) => setPwError(id, ""));

  const current = document.getElementById("current-password").value;
  const next = document.getElementById("new-password").value;
  const confirm = document.getElementById("confirm-password").value;

  let ok = true;
  if (!current) { setPwError("current-password", "กรุณากรอกรหัสผ่านปัจจุบัน"); ok = false; }
  if (next.length < 8) { setPwError("new-password", "รหัสผ่านใหม่ต้องยาวอย่างน้อย 8 ตัว"); ok = false; }
  else if (next === current) { setPwError("new-password", "รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสเดิม"); ok = false; }
  if (confirm !== next) { setPwError("confirm-password", "รหัสผ่านใหม่ทั้ง 2 ช่องไม่ตรงกัน"); ok = false; }
  if (!ok) {
    const firstBad = passwordForm.querySelector(".invalid");
    if (firstBad) firstBad.focus();
    return;
  }

  passwordButton.disabled = true;
  passwordButton.textContent = "กำลังเปลี่ยนรหัสผ่าน…";
  try {
    // ตรวจรหัสผ่านปัจจุบันก่อน กันคนอื่นมาเปลี่ยนแทนตอนลืมออกจากระบบ
    const check = await db.auth.signInWithPassword({ email: currentUser.email, password: current });
    if (check.error) {
      setPwError("current-password", /invalid/i.test(check.error.message)
        ? "รหัสผ่านปัจจุบันไม่ถูกต้อง"
        : friendlyError(check.error));
      return;
    }
    const { error } = await db.auth.updateUser({ password: next });
    if (error) {
      passwordError.hidden = false;
      passwordError.textContent = /weak|short|least/i.test(error.message)
        ? "รหัสผ่านใหม่ง่ายเกินไป กรุณาตั้งให้ยาวขึ้น และผสมตัวอักษรกับตัวเลข"
        : "เปลี่ยนรหัสผ่านไม่สำเร็จ: " + friendlyError(error);
      return;
    }
    passwordForm.reset();
    passwordSuccess.hidden = false;
    passwordSuccess.textContent = "เปลี่ยนรหัสผ่านเรียบร้อยแล้ว ครั้งหน้าให้เข้าสู่ระบบด้วยรหัสผ่านใหม่";
  } finally {
    passwordButton.disabled = false;
    passwordButton.textContent = "เปลี่ยนรหัสผ่าน";
  }
});

(async () => {
  const user = await requireUser();
  document.getElementById("password-who").textContent = "บัญชี: " + user.email;
})();
