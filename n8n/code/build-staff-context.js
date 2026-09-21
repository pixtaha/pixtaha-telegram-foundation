// n8n Code node: "Build Staff Context"
// Mode: Run Once for All Items | Language: JavaScript
// Input : rows from the "Get Staff" Postgres node
// Output: ONE item => { is_staff, current_user, roles }

const norm = (v) => String(v ?? '').trim().toLowerCase();

// الأدوار دي دايمًا موجودة كـ array (فاضي لو مفيش حد)، عشان ما تلاقيش undefined
const KNOWN_ROLES = ['owner', 'admin', 'developer', 'reception', 'cashier', 'social'];

// استبعد الـ item الفاضي اللي بيرجع لما الجدول مفيهوش صفوف (Always Output Data)
const staff = $input.all()
  .map((i) => i.json)
  .filter((s) => s.telegram_chat_id);

// المقارنة بـ user_id (اللي بعت) مش chat_id (مكان الرسالة)، عشان تشتغل في الجروبات كمان
const userId = $('Normalize').first().json.user_id;

const pick = (s) => ({
  chat_id: s.telegram_chat_id,
  name: s.full_name,
  whatsapp: s.whatsapp_number,
  phone: s.phone_number,
});

const roles = Object.fromEntries(KNOWN_ROLES.map((r) => [r, []]));
for (const s of staff) {
  const role = norm(s.job_title);
  if (!role) continue;
  (roles[role] ||= []).push(pick(s)); // أي دور جديد في الجدول يظهر لوحده
}

const me = staff.find((s) => String(s.telegram_chat_id) === String(userId));

return [{
  json: {
    is_staff: Boolean(me),
    current_user: me ? { ...pick(me), role: norm(me.job_title) } : null,
    roles,
  },
}];
