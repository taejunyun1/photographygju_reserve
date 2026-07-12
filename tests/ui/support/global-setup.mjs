const baseURL = "http://127.0.0.1:4179";
const studentEmail = "student@example.com";
const studentPassword = "fixture-password";

async function api(path, options = {}) {
  const response = await fetch(`${baseURL}${path}`, {
    ...options,
    headers: {
      "content-type": "application/json",
      ...(options.headers || {})
    },
    body: options.body && typeof options.body !== "string" ? JSON.stringify(options.body) : options.body
  });
  const payload = await response.json();
  if (!payload.ok) throw new Error(`${path}: ${payload.error || response.statusText}`);
  return payload.data;
}

export default async function globalSetup() {
  await api("/api/auth/signup", {
    method: "POST",
    body: {
      name: "접근성 학생",
      studentId: "20260001",
      grade: "1학년",
      studentStatus: "재학생",
      phone: "010-0000-0000",
      email: studentEmail,
      password: studentPassword
    }
  });

  const adminLogin = await api("/api/auth/login", {
    method: "POST",
    body: { loginId: "admin", password: "admin" }
  });
  const authorization = `Bearer ${adminLogin.token}`;
  const users = await api("/api/admin/users", { headers: { authorization } });
  const student = users.find((user) => user.email === studentEmail);
  if (!student) throw new Error("Isolated E2E student was not created.");

  await api(`/api/admin/users/${student.id}/approval`, {
    method: "PATCH",
    headers: { authorization },
    body: { approvalStatus: "approved" }
  });
}
