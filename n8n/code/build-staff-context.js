const norm = (v) => String(v ?? '').trim().toLowerCase();

// الأدوار دي دايمًا موجودة كـ array (فاضي لو مفيش حد)، عشان ما تلاقيش undefined
const KNOWN_ROLES = ['owner', 'admin', 'developer', 'reception', 'cashier', 'social'];

const staff = $input.all()
  .map((i) => i.json)
  .filter((s) => s.telegram_chat_id);

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
  (roles[role] ||= []).push(pick(s));
}

const me = staff.find((s) => String(s.telegram_chat_id) === String(userId));

return [{
  json: {
    is_staff: Boolean(me),
    current_user: me ? { ...pick(me), role: norm(me.job_title) } : null,
    roles,
  },
}];
