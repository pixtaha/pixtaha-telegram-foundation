const rawInput = $('Telegram Trigger').first().json;
const raw = Array.isArray(rawInput) ? rawInput[0] : rawInput;
if (!raw) throw new Error('No trigger data found');

const env = $('Build Config').first().json.environment;
if (!env) throw new Error('Missing environment - check Build Config node');

const CALLBACK_PARAMS_COUNT = 7;

// ---------- helpers ----------
function normalizeDigits(text) {
  if (!text) return text;
  return String(text)
    .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString())
    .replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d).toString());
}

function escapeSql(text) {
  if (!text) return text;
  return text.replace(/'/g, "''");
}

function describeMedia(m) {
  if (!m) return { type: null };
  if (Array.isArray(m.photo) && m.photo.length) {
    return { type: 'photo', file_id: m.photo[m.photo.length - 1].file_id };
  }
  if (m.video || m.video_note) {
    const v = m.video || m.video_note;
    return { type: 'video', file_id: v.file_id };
  }
  if (m.voice || m.audio) {
    const a = m.voice || m.audio;
    return { type: 'audio', file_id: a.file_id, is_voice: Boolean(m.voice) };
  }
  if (m.document) {
    const d = m.document;
    const mime = d.mime_type || '';
    const type = mime.startsWith('image/') ? 'photo'
      : mime.startsWith('video/') ? 'video'
      : mime.startsWith('audio/') ? 'audio'
      : 'document';
    return { type, file_id: d.file_id, name: d.file_name || null, mime: d.mime_type || null, as_document: true };
  }
  if (m.sticker) return { type: 'sticker', file_id: m.sticker.file_id };
  if (m.venue || m.location) {
    const loc = m.venue?.location || m.location;
    return {
      type: 'location',
      latitude: loc.latitude,
      longitude: loc.longitude,
      title: m.venue?.title || null,
      address: m.venue?.address || null,
    };
  }
  return { type: null };
}

function extractBarcodeAndHints(rawText) {
  const empty = { barcodeClean: '', hint: null, hint_category_2: null, hint_category_3: null };
  if (!rawText) return empty;

  const lines = normalizeDigits(rawText.toString().trim())
    .split(/\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) return empty;

  const [firstToken, ...rest] = lines[0].split(/\s+/);
  const digits = firstToken.replace(/\D/g, '');
  const isNumericToken = /^\d[\d-]*$/.test(firstToken);
  const restOfFirstLine = rest.join(' ').trim();

  let barcodeClean = '';
  let hints;

  if (isNumericToken && (rest.length === 0 || digits.length >= 6)) {
    barcodeClean = digits;
    hints = restOfFirstLine ? [restOfFirstLine, ...lines.slice(1)] : lines.slice(1);
  } else {
    hints = lines;
  }

  const [h1 = null, h2 = null, h3 = null] = hints;
  return {
    barcodeClean,
    hint: escapeSql(h1),
    hint_category_2: escapeSql(h2),
    hint_category_3: escapeSql(h3),
  };
}

// ---------- output defaults ----------
const out = {
  env,
  source_channel: 'telegram',
  update_id: raw.update_id ?? null,
  update_type: Object.keys(raw).find(k => k !== 'update_id') || null,

  user_id: null, chat_id: null, message_id: null, chat_type: null,
  username: null, first_name: null,

  message_type: null, message_text: null, caption: null, is_edit: false,
  is_command: false, command: null, command_args: null,

  callback_query_id: null, callback_data: null, callback_context: null, callback_action: null,
  callback_params: [],
  callback_param_1: null, callback_param_2: null, callback_param_3: null, callback_param_4: null,
  callback_param_5: null, callback_param_6: null, callback_param_7: null,

  has_photo: false, photo_file_id: null,
  has_video: false, video_file_id: null,
  audio_file_id: null, is_voice: false,
  sent_as_document: false, document_file_id: null, document_name: null, document_mime: null,
  latitude: null, longitude: null, venue_title: null, venue_address: null,

  is_reply: false, replied_to_message_id: null, replied_to_type: null, replied_to_text: null,
  replied_to_photo_id: null, replied_to_photo_file_id: null, replied_to_video_id: null,
  replied_to_audio_id: null, replied_to_document_url: null,
  replied_to_document_name: null, replied_to_document_mime: null,
};

function fillReplied(rep) {
  const m = describeMedia(rep);
  out.is_reply = true;
  out.replied_to_message_id = rep.message_id ?? null;
  out.replied_to_type = m.type || 'text';
  out.replied_to_text = m.type === 'document' ? m.name : (rep.caption || rep.text || null);

  if (m.type === 'photo') out.replied_to_photo_id = out.replied_to_photo_file_id = m.file_id;
  if (m.type === 'video') out.replied_to_video_id = m.file_id;
  if (m.type === 'audio') out.replied_to_audio_id = m.file_id;
  if (m.as_document) {
    out.replied_to_document_url = m.file_id;
    out.replied_to_document_name = m.name;
    out.replied_to_document_mime = m.mime;
  }
}

// ---------- main ----------
const cq = raw.callback_query;
const msg = raw.message || raw.edited_message;

if (cq) {
  out.message_type = 'callback_query';
  out.user_id = cq.from?.id ?? null;
  out.username = cq.from?.username ?? null;
  out.first_name = cq.from?.first_name ?? null;
  out.chat_id = cq.message?.chat?.id ?? null;
  out.chat_type = cq.message?.chat?.type ?? null;
  out.message_id = cq.message?.message_id ?? null;
  out.callback_query_id = cq.id ?? null;
  out.callback_data = cq.data ?? null;
  out.message_text = normalizeDigits(out.callback_data);

  if (out.callback_data) {
    const [context, action, ...params] = out.callback_data.split(':');
    out.callback_context = context || null;
    out.callback_action = action || null;
    out.callback_params = params;
    for (let i = 0; i < CALLBACK_PARAMS_COUNT; i++) {
      out[`callback_param_${i + 1}`] = params[i] || null;
    }
  }

  if (cq.message?.reply_to_message) fillReplied(cq.message.reply_to_message);

} else if (msg) {
  out.is_edit = Boolean(raw.edited_message);
  out.user_id = msg.from?.id ?? null;
  out.username = msg.from?.username ?? null;
  out.first_name = msg.from?.first_name ?? null;
  out.chat_id = msg.chat?.id ?? null;
  out.chat_type = msg.chat?.type ?? null;
  out.message_id = msg.message_id ?? null;
  out.caption = normalizeDigits(msg.caption ?? null);
  out.message_text = normalizeDigits(msg.text ?? null) || out.caption || null;

  if (msg.reply_to_message) fillReplied(msg.reply_to_message);

  const media = describeMedia(msg);

  if (media.as_document) {
    out.sent_as_document = true;
    out.document_file_id = media.file_id;
    out.document_name = media.name;
    out.document_mime = media.mime;
  }

  if (media.type === 'photo') {
    out.message_type = 'photo'; out.has_photo = true; out.photo_file_id = media.file_id;
  } else if (media.type === 'video') {
    out.message_type = 'video'; out.has_video = true; out.video_file_id = media.file_id;
  } else if (media.type === 'audio') {
    out.message_type = 'audio'; out.audio_file_id = media.file_id; out.is_voice = Boolean(media.is_voice);
  } else if (media.type === 'document') {
    out.message_type = 'document';
  } else if (media.type === 'sticker') {
    out.message_type = 'sticker';
  } else if (media.type === 'location') {
    out.message_type = 'location';
    out.latitude = media.latitude;
    out.longitude = media.longitude;
    out.venue_title = media.title;
    out.venue_address = media.address;
  } else {
    const ents = msg.entities || [];
    const cmdEntity = ents.find(e => e.type === 'bot_command' && e.offset === 0);

    if (cmdEntity && out.message_text) {
      const [first, ...args] = out.message_text.split(/\s+/);
      out.is_command = true;
      out.command = first.split('@')[0];
      out.command_args = args.join(' ') || null;
      out.message_type = 'command';
    } else if (!out.message_text) {
      out.message_type = 'other';
    } else if (out.is_reply) {
      out.message_type = ents.some(e => e.type === 'mention') ? 'mention_reply' : 'reply';
    } else {
      out.message_type = ents.some(e => e.type === 'mention' && e.offset === 0) ? 'mention_reply' : 'message';
    }
  }
}

if (!out.message_type) out.message_type = 'unsupported';

// ---------- Barcode + Hints ----------
const isDuplicateCb = out.message_type === 'callback_query' && out.callback_context === 'duplicate';
const skipExtraction = ['command', 'callback_query', 'location', 'sticker', 'audio', 'other', 'unsupported']
  .includes(out.message_type);

const hintSourceText = isDuplicateCb
  ? out.replied_to_text
  : (skipExtraction ? null : (out.caption || out.message_text));

const { barcodeClean, hint, hint_category_2, hint_category_3 } = extractBarcodeAndHints(hintSourceText);
const barcode_is_global = [8, 12, 13].includes(barcodeClean.length);

return [{
  json: {
    ...out,
    raw,
    barcode: barcodeClean || null,
    barcode_is_global,
    hint,
    hint_category_2,
    hint_category_3,
  },
}];
