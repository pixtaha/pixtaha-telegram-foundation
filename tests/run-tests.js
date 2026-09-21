// Zero-dependency test runner:  node tests/run-tests.js
// بيشغّل نفس الكود اللي بتلصقه في n8n Code nodes، مع محاكاة لـ $() و $input.

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const payload = (name) => JSON.parse(read(`test-payloads/${name}.json`));

// ---------- n8n mock ----------
function runCodeNode(file, { nodes = {}, input = [] }) {
  const code = read(file);
  const $ = (name) => {
    if (!(name in nodes)) throw new Error(`Node "${name}" is not mocked in this test`);
    const items = nodes[name];
    return { first: () => items[0], all: () => items };
  };
  const $input = { first: () => input[0], all: () => input };
  return new Function('$', '$input', code)($, $input)[0].json;
}

// ---------- tiny assertion helpers ----------
let passed = 0;
const failures = [];

function check(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failures.push({ name, message: e.message });
    console.log(`  ✗ ${name}\n      ${e.message}`);
  }
}

function expectFields(actual, expected) {
  for (const [key, want] of Object.entries(expected)) {
    const got = actual[key];
    if (JSON.stringify(got) !== JSON.stringify(want)) {
      throw new Error(`${key}: expected ${JSON.stringify(want)}, got ${JSON.stringify(got)}`);
    }
  }
}

function expectThrows(fn, contains) {
  try {
    fn();
  } catch (e) {
    if (!e.message.includes(contains)) {
      throw new Error(`expected error containing "${contains}", got "${e.message}"`);
    }
    return;
  }
  throw new Error(`expected an error containing "${contains}", but nothing was thrown`);
}

// =====================================================================
// 1) Normalize
// =====================================================================
console.log('\nNormalize');

const UID = 1000000003;
const normalize = (name, envItem = { environment: 'dev' }) =>
  runCodeNode('n8n/code/normalize.js', {
    nodes: {
      'Telegram Trigger': [{ json: payload(name) }],
      'Build Config': [{ json: envItem }],
    },
  });

const normalizeCases = [
  ['01-command-start', { message_type: 'command', is_command: true, command: '/start', command_args: null, user_id: UID }],
  ['02-text-hello', { message_type: 'message', message_text: 'Hello', is_edit: false }],
  ['03-photo-small', { message_type: 'photo', has_photo: true, photo_file_id: 'DEMO_PHOTO_SMALL_2', sent_as_document: false }],
  ['04-photo-large', { message_type: 'photo', photo_file_id: 'DEMO_PHOTO_LARGE_4' }], // آخر عنصر = الأكبر
  ['05-photo-as-document-png', { message_type: 'photo', has_photo: true, sent_as_document: true, document_mime: 'image/png', photo_file_id: 'DEMO_DOC_PNG' }],
  ['06-document-csv', { message_type: 'document', document_name: 'products_100.csv', document_mime: 'text/csv', document_file_id: 'DEMO_DOC_CSV', sent_as_document: true }],
  ['07-voice', { message_type: 'audio', is_voice: true, audio_file_id: 'DEMO_VOICE' }],
  ['08-video-mp4', { message_type: 'video', has_video: true, video_file_id: 'DEMO_VIDEO_MP4', sent_as_document: false }],
  ['09-video-as-document-mov', { message_type: 'video', has_video: true, sent_as_document: true, document_mime: 'video/quicktime' }],
  ['10-location', { message_type: 'location', latitude: 30.0444, longitude: 31.2357, venue_title: null }],
  ['11-location-venue', { message_type: 'location', venue_title: 'مكتب بريد - تجريبي', venue_address: 'عنوان تجريبي' }],
  ['12-edited-message', { message_type: 'message', is_edit: true, update_type: 'edited_message', user_id: UID, chat_id: UID, message_text: 'Hello (edited)' }],
  ['13-reply-to-document', { message_type: 'reply', is_reply: true, replied_to_type: 'document', replied_to_document_name: 'products_100.csv', replied_to_message_id: 6 }],
  ['14-callback-query', {
    message_type: 'callback_query', callback_query_id: 'demo_cb_1', message_id: 40,
    callback_context: 'order', callback_action: 'approve',
    callback_param_1: '123', callback_param_2: 'cash', callback_param_3: null, callback_param_7: null,
    callback_params: ['123', 'cash'],
  }],
  ['15-callback-duplicate', {
    message_type: 'callback_query', callback_context: 'duplicate', callback_action: 'replace', callback_param_1: '55',
    is_reply: true, replied_to_type: 'photo',
    barcode: '6221031234567', barcode_is_global: true, hint: 'Sony A7', hint_category_2: 'Cameras', hint_category_3: 'Mirrorless',
  }],
  ['16-photo-caption-barcode', { message_type: 'photo', barcode: '6221031234567', barcode_is_global: true, hint: 'Sony A7', hint_category_2: 'Cameras', hint_category_3: 'Mirrorless' }],
  ['17-text-not-barcode', { message_type: 'message', barcode: null, hint: 'Sony A7 camera' }], // regression: القديم كان بيطلّع باركود "7"
  ['18-arabic-digits-barcode', { message_type: 'photo', barcode: '6221031234567', hint: 'كاميرا' }],
  ['19-group-message', { message_type: 'command', command: '/start', command_args: 'hello there', chat_type: 'supergroup', chat_id: -1001234567890, user_id: UID }],
  ['20-sticker', { message_type: 'sticker' }],
  ['21-contact-other', { message_type: 'other' }],
];

for (const [name, expected] of normalizeCases) {
  check(name, () => expectFields(normalize(name), expected));
}

check('every callback_param_1..7 exists on every output', () => {
  for (const [name] of normalizeCases) {
    const out = normalize(name);
    for (let i = 1; i <= 7; i++) {
      if (!(`callback_param_${i}` in out)) throw new Error(`${name}: missing callback_param_${i}`);
    }
  }
});

check('throws when env is missing from Build Config', () => {
  expectThrows(() => normalize('02-text-hello', {}), 'Missing environment');
});

check('accepts trigger data wrapped in an array', () => {
  const out = runCodeNode('n8n/code/normalize.js', {
    nodes: {
      'Telegram Trigger': [{ json: [payload('02-text-hello')] }],
      'Build Config': [{ json: { environment: 'dev' } }],
    },
  });
  expectFields(out, { message_type: 'message' });
});

// =====================================================================
// 2) Build Config
// =====================================================================
console.log('\nBuild Config');

const rows = [
  { config_key: 'tg_token', config_value: 'T' },
  { config_key: 'tg_chat_developer', config_value: '1' },
].map((json) => ({ json }));

const buildConfig = (setup, input) =>
  runCodeNode('n8n/code/build-config.js', { nodes: { 'Set Environment': [{ json: setup }] }, input });

check('turns rows into one object and keeps environment', () => {
  expectFields(buildConfig({ environment: 'dev' }, rows), { tg_token: 'T', tg_chat_developer: '1', environment: 'dev' });
});

check('passes when all required_keys exist (spaces are trimmed)', () => {
  buildConfig({ environment: 'dev', required_keys: 'tg_token, tg_chat_developer' }, rows);
});

check('throws on missing required key', () => {
  expectThrows(() => buildConfig({ environment: 'dev', required_keys: 'tg_token,nope' }, rows), 'nope');
});

check('throws when there are no rows (wrong environment name)', () => {
  expectThrows(() => buildConfig({ environment: 'prod' }, [{ json: {} }]), 'No config rows found');
});

check('throws when environment field is missing', () => {
  expectThrows(() => buildConfig({}, rows), 'Missing "environment"');
});

// =====================================================================
// 3) Build Staff Context
// =====================================================================
console.log('\nBuild Staff Context');

const staffRows = [
  { telegram_chat_id: '2000000001', full_name: 'Owner One', job_title: 'Owner', whatsapp_number: '1', phone_number: '1' },
  { telegram_chat_id: String(UID), full_name: 'Dev', job_title: ' DEVELOPER ', whatsapp_number: '2', phone_number: '2' },
  { telegram_chat_id: '2000000004', full_name: 'Rec A', job_title: 'Reception', whatsapp_number: '3', phone_number: '3' },
  { telegram_chat_id: '2000000005', full_name: 'Rec B', job_title: 'Reception', whatsapp_number: '4', phone_number: '4' },
  { telegram_chat_id: '2000000010', full_name: 'Mgr', job_title: 'Manager', whatsapp_number: null, phone_number: null },
].map((json) => ({ json }));

const buildStaff = (userId, input) =>
  runCodeNode('n8n/code/build-staff-context.js', {
    nodes: { Normalize: [{ json: { user_id: userId } }] },
    input,
  });

check('known user: is_staff, current_user and role (case/space-insensitive)', () => {
  const out = buildStaff(UID, staffRows);
  expectFields(out, { is_staff: true });
  expectFields(out.current_user, { chat_id: String(UID), name: 'Dev', role: 'developer' });
});

check('unknown user: is_staff false and current_user null', () => {
  expectFields(buildStaff(999, staffRows), { is_staff: false, current_user: null });
});

check('user_id given as number still matches string chat_id', () => {
  expectFields(buildStaff(1000000003, staffRows), { is_staff: true });
});

check('roles: known roles always exist as arrays', () => {
  const out = buildStaff(UID, staffRows);
  for (const r of ['owner', 'admin', 'developer', 'reception', 'cashier', 'social']) {
    if (!Array.isArray(out.roles[r])) throw new Error(`roles.${r} is not an array`);
  }
  expectFields({ n: out.roles.admin.length, r: out.roles.reception.length }, { n: 0, r: 2 });
});

check('roles: unknown role (Manager) is added automatically', () => {
  expectFields({ n: buildStaff(UID, staffRows).roles.manager?.length }, { n: 1 });
});

check('empty Postgres result ([{}]) => nobody is staff, no crash', () => {
  const out = buildStaff(UID, [{ json: {} }]);
  expectFields(out, { is_staff: false, current_user: null });
  expectFields({ n: out.roles.owner.length }, { n: 0 });
});

// ---------- summary ----------
console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) process.exit(1);
