# Telegram Workflow Foundation for n8n

أساس شغل أي بوت Telegram في n8n:

- **إعدادات من الداتابيز** بدل ما تحط الـ tokens والـ IDs جوه الـ nodes، مع دعم `dev` / `demo` / `production`.
- **Normalize**: أي رسالة من Telegram (نص، صورة، فيديو، صوت، ملف، location، زرار، رسالة معدّلة) بتتحول لـ object واحد بأسماء ثابتة.
- **Staff Context**: بيعرف مين اللي بعت (`is_staff`) وبيجمّع الموظفين حسب الأدوار.
- **Tests**: 35 اختبار بيشغّلوا نفس الكود اللي بتلصقه في n8n على 21 payload.

> **للتعلم فقط.** كل القيم في الريبو وهمية. اقرا قسم [الأمان](#الأمان) قبل ما تحط بيانات حقيقية.

---

## هيكل الريبو

```
.
├── sql/
│   └── setup.sql                 الجدولين + الديمو داتا
├── n8n/
│   ├── code/                     كود الـ Code nodes (الصقه في n8n)
│   │   ├── build-config.js
│   │   ├── normalize.js
│   │   └── build-staff-context.js
│   ├── queries/                  الـ queries بتاعة الـ Postgres nodes
│   │   ├── get-config.sql
│   │   └── get-staff.sql
│   └── workflows/                حط هنا export الـ workflow (اقرا الـ README اللي جوه)
├── test-payloads/                21 payload لأنواع الرسائل
├── tests/
│   └── run-tests.js
└── package.json
```

---

## Quick start

### 1) الداتابيز

افتح **SQL Editor** (Supabase أو pgAdmin أو أي أداة Postgres)، الصق `sql/setup.sql` واضغط **Run**. المفروض يظهر في الآخر `configurations = 13` و`staff = 9`.

الملف يتشغّل أكتر من مرة من غير errors ومن غير تكرار للداتا.

> **مهم:** في `sql/setup.sql` غيّر صف الـ `Developer` (الـ ID `1000000003`) لـ Telegram ID بتاعك، تعرفه من بوت `@userinfobot`. لو سبته، البوت مش هيتعرف عليك كموظف (`is_staff = false`).

### 2) الـ workflow في n8n

ابني الـ nodes بالترتيب ده، **وبالأسماء دي بالظبط** (الكود بيقرا من الـ nodes بالاسم):

```
Telegram Trigger
   ↓
Set Environment        Edit Fields node
   ↓
Get Config             Postgres node
   ↓
Build Config           Code node
   ↓
Normalize              Code node
   ↓
Get Staff              Postgres node
   ↓
Build Staff Context    Code node
```

| الـ node | النوع | المحتوى |
|---|---|---|
| **Telegram Trigger** | Telegram Trigger node | الـ Credentials بتاعة البوت |
| **Set Environment** | Edit Fields node | حقلين: `environment` = `dev`، و`required_keys` = `tg_token,tg_chat_developer` (اختياري) |
| **Get Config** | Postgres node | [`n8n/queries/get-config.sql`](n8n/queries/get-config.sql) |
| **Build Config** | Code node | [`n8n/code/build-config.js`](n8n/code/build-config.js) |
| **Normalize** | Code node | [`n8n/code/normalize.js`](n8n/code/normalize.js) |
| **Get Staff** | Postgres node | [`n8n/queries/get-staff.sql`](n8n/queries/get-staff.sql) |
| **Build Staff Context** | Code node | [`n8n/code/build-staff-context.js`](n8n/code/build-staff-context.js) |

**في الـ Code nodes:** Mode = **Run Once for All Items**، واللغة JavaScript.
**في الـ Postgres nodes:** Operation = **Execute a Query**، وفعّل **Settings ← Always Output Data**. الـ Query Parameters مكتوبة في أول كل ملف `.sql`.

الأفضل تجمّع الـ 6 nodes بعد الـ Trigger في **group** اسمه `Load Context`.

### 3) شغّل الاختبارات

```bash
npm test
```

مفيش dependencies. محتاج Node 18 أو أحدث بس.

---

## الـ output اللي بتاخده بعد الـ Group

### من **Normalize**

بيرجّع item واحد فيه حوالي 60 حقل، كلهم موجودين دايمًا (القيمة `null` لو مش منطبقة)، فمش هتلاقي `undefined`. أهم الحقول:

| المجموعة | الحقول |
|---|---|
| مين وفين | `user_id`, `chat_id`, `chat_type`, `message_id`, `username`, `first_name` |
| النوع | `message_type`, `update_type`, `is_edit` |
| النص | `message_text`, `caption` |
| الأوامر | `is_command`, `command`, `command_args` |
| الميديا | `photo_file_id`, `video_file_id`, `audio_file_id`, `is_voice`, `document_file_id`, `document_name`, `document_mime`, `sent_as_document` |
| الموقع | `latitude`, `longitude`, `venue_title`, `venue_address` |
| الرد على رسالة | `is_reply`, `replied_to_message_id`, `replied_to_type`, `replied_to_text`, `replied_to_*_id` |
| الزراير | `callback_query_id`, `callback_data`, `callback_context`, `callback_action`, `callback_params`, `callback_param_1..7` |
| الباركود | `barcode`, `barcode_is_global`, `hint`, `hint_category_2`, `hint_category_3` |
| الخام | `raw` (الـ update الأصلي من Telegram) |

#### قيم `message_type`

| القيمة | متى |
|---|---|
| `message` | نص عادي |
| `command` | بيبدأ بـ `/` (والـ `/start@BotName` بيتنضف لـ `/start`) |
| `photo` | صورة، أو ملف نوعه `image/*` (والـ `sent_as_document = true`) |
| `video` | فيديو، أو ملف نوعه `video/*` |
| `audio` | voice أو audio (والـ `is_voice` بيفرّق) |
| `document` | أي ملف تاني (CSV, PDF...) |
| `location` | موقع عادي أو venue |
| `sticker` | ستيكر |
| `callback_query` | ضغطة على زرار inline |
| `reply` / `mention_reply` | رد على رسالة / منشن |
| `other` | من غير نص ولا ميديا (جهة اتصال، poll...) |
| `unsupported` | أي حاجة تانية |

الرسالة المعدّلة بتيجي بنفس النوع مع `is_edit = true` و`update_type = "edited_message"`.

#### الـ Callback params

الـ `callback_data` بيتقسم على `:`

```
context:action:param1:param2:...
order:approve:123:cash
   ↓        ↓     ↓     ↓
context  action  param_1  param_2
```

بيدعم لحد 7 params، وكلهم كمان في array اسمه `callback_params`.

> Telegram بيحدّد `callback_data` بـ **64 بايت** كحد أقصى، فخلي الـ params قصيرة.

#### الباركود والـ hints

الباركود لازم يكون **أول كلمة أرقام بس** (6 أرقام أو أكتر، أو الكلمة كلها رقم). لو مفيش باركود، كل السطور بتبقى hints. الأرقام العربي والفارسي بتتحوّل لأرقام إنجليزي.

```
6221031234567 Sony A7      ← barcode = 6221031234567, hint = "Sony A7"
Cameras                   ← hint_category_2
Mirrorless                ← hint_category_3
```

### من **Build Staff Context**

```json
{
  "is_staff": true,
  "current_user": { "chat_id": "...", "name": "...", "whatsapp": "...", "phone": "...", "role": "developer" },
  "roles": {
    "owner": [ { "chat_id": "...", "name": "...", "whatsapp": "...", "phone": "..." } ],
    "admin": [], "developer": [], "reception": [], "cashier": [], "social": []
  }
}
```

الأدوار المعروفة دايمًا موجودة كـ array (فاضي لو مفيش حد)، وأي دور جديد تضيفه في الجدول بيظهر لوحده.

---

## استخدام الداتا في باقي الـ workflow

استهدف **الأدوار** مش الأشخاص. لو موظف اتغيّر، تعدّل الجدول بس والـ workflow ما يتغيرش.

| الحالة | الطريقة |
|---|---|
| إعداد من الجدول | `{{ $('Build Config').first().json.tg_chat_developer }}` |
| دور فيه شخص واحد | `{{ $('Build Staff Context').first().json.roles.owner[0]?.chat_id }}` |
| دور فيه ناس كتير | **Split Out node** على `roles.reception`، والـ `chat_id` هو `{{ $json.chat_id }}` |
| بيانات الرسالة | `{{ $('Normalize').first().json.message_type }}` |

**قواعد:**

- اقرا دايمًا بالاسم `$('Node Name').first().json...` مش `$json`، لأن `$json` بيتغير مع كل node.
- الـ index في الـ array (`[0]`, `[1]`) بيتحدد من `ORDER BY id`. توقيف موظف أو إضافة واحد جديد ممكن يغيّره، فما تعتمدش عليه في الأدوار المتعددة.
- `is_staff = false` معناها إن اللي بعت مش موظف، فحط **IF node** بعد الـ group يوقف الـ workflow وقتها.

---

## إدارة الداتا

**إعداد جديد أو تعديل قيمة:**

```sql
INSERT INTO public.configurations (environment, config_key, config_value, description)
VALUES ('dev', 'my_new_key', 'my_value', 'وصف الـ key')
ON CONFLICT (environment, config_key)
DO UPDATE SET
  config_value = EXCLUDED.config_value,
  description  = EXCLUDED.description,
  updated_at   = now();
```

**نسخ إعدادات dev على demo:**

```sql
INSERT INTO public.configurations (environment, config_key, config_value, description)
SELECT 'demo', config_key, config_value, description
FROM public.configurations
WHERE environment = 'dev'
ON CONFLICT (environment, config_key) DO NOTHING;
```

**موظف جديد:**

```sql
INSERT INTO public.staff (telegram_chat_id, full_name, job_title, whatsapp_number, phone_number)
VALUES (2000000010, 'اسم الموظف', 'Cashier', '201000000110', '201000000110');
```

**توقيف موظف من غير مسح:**

```sql
UPDATE public.staff
SET is_active = false, updated_at = now()
WHERE environment = 'dev' AND telegram_chat_id = 2000000010;
```

---

## الأمان

- الجداول بتخزّن القيم **plain text**، فاستخدمها للتعلم وبيانات وهمية بس.
- الـ tokens الحقيقية (Telegram وOpenAI وWhatsApp...) الأحسن تتحط في **n8n Credentials**.
- الـ **Telegram Trigger node** والـ **Telegram node** بياخدوا الـ token من الـ Credentials بس، مش من expression. فـ `tg_token` في الجدول ينفع مع **HTTP Request node** بس.
- لو الداتابيز Supabase والجداول في schema `public` من غير RLS، أي حد معاه الـ `anon key` يقدر يقرأها من الـ REST API. لو n8n بيتصل بـ Postgres مباشرة (**Postgres node**) مش هتتأثر، بس برضه لا تحط بيانات حساسة.
- لو أي token حقيقي اتنشر بالغلط في GitHub أو أي مكان، **غيّره فورًا** من مصدره، ومسحه من الـ commit مش كفاية لأنه بيفضل في الـ history.

---

## أسئلة شائعة

**ليه `environment`؟**
عشان نفس الـ workflow يشتغل على `dev` و`demo` و`production` بإعدادات مختلفة. الافتراضي `dev` عشان أي INSERT من غير تحديد ما يلمسش production.

**بيرمي error `Missing config keys`؟**
الـ key ناقص في الجدول للـ environment ده، أو مكتوب غلط. راجع `required_keys` في **Set Environment node**.

**بيرمي error `No config rows found`؟**
اسم الـ environment غلط (مثلاً `prod` بدل `production`)، أو الجدول فاضي للبيئة دي.

**الـ Normalize بيرمي error `Missing environment`؟**
الـ **Build Config node** ما رجّعش `environment`. راجع الـ nodes اللي قبله.

**`is_staff` بـ `false` وأنا موظف؟**
الـ `telegram_chat_id` في جدول `staff` غير الـ ID بتاعك، أو الموظف `is_active = false`، أو الـ `environment` في الصف غير اللي مختاره في **Set Environment node**.

---

## Roadmap

- [ ] **IF node** يمنع أي حد مش موظف
- [ ] **Switch node** بيوزّع على حسب `message_type`
- [ ] Fallback branches للأنواع غير المدعومة
- [ ] Export للـ workflow في `n8n/workflows/`
