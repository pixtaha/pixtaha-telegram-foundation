-- =====================================================================
-- Arab Automators - Telegram Workflow Setup
-- الجداول + الديمو داتا للتعلم فقط (كل القيم وهمية)
--
-- الخطوات:
--   1) افتح SQL Editor في Supabase / pgAdmin / أي أداة Postgres
--   2) الصق الملف كله واضغط Run
--   3) تقدر تشغّله أكتر من مرة، مش هيكرر الداتا ومش هيدّي errors
--
-- الجداول:
--   1) configurations : إعدادات الـ workflow (tokens, IDs, URLs)
--   2) staff          : الموظفين وأدوارهم
-- =====================================================================


-- =====================================================================
-- 1) configurations
-- الـ environment الافتراضي dev، ونفس الـ key ينفع يتكرر في demo / production
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.configurations (
  id           serial PRIMARY KEY,
  environment  text        NOT NULL DEFAULT 'dev',   -- dev / demo / production
  config_key   text        NOT NULL,
  config_value text        NOT NULL,
  description  text        NULL,
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT configurations_env_key_unique UNIQUE (environment, config_key)
);

INSERT INTO public.configurations (config_key, config_value, description) VALUES
  ('whatsapp_phone_number_id', '100000000000001',                   'Phone Number ID بتاع رقم واتساب Cloud API'),
  ('whatsapp_access_token',    'EAAX_DEMO_WHATSAPP_TOKEN',          'Access Token بتاع واتساب Cloud API'),
  ('openai_api_key',           'sk-proj-DEMO_OPENAI_KEY',           'مفتاح OpenAI API للتصنيف بالـ AI'),
  ('cw_base_url',              'https://chatwoot.example.com',      'رابط Chatwoot'),
  ('cw_account_id',            '1',                                 'Account ID بتاع Chatwoot'),
  ('cw_token',                 'DEMO_CHATWOOT_TOKEN',               'Chatwoot API Token'),
  ('wa_verify_token',          'demo-verify-token',                 'Webhook Verify Token بتاع واتساب'),
  ('phone_admin',              '201000000001',                      'رقم الأدمن'),
  ('phone_support',            '201000000002',                      'رقم الدعم'),
  ('tg_token',                 '123456789:AA_DEMO_TELEGRAM_TOKEN',  'Telegram Bot Token'),
  ('tg_chat_developer',        '1000000001',                        'شات تليجرام المطور'),
  ('tg_chat_support',          '1000000002',                        'شات تليجرام الدعم'),
  ('tg_chat_owner',            '1000000003',                        'شات تليجرام المالك')
ON CONFLICT (environment, config_key) DO NOTHING;


-- =====================================================================
-- 2) staff
-- telegram_chat_id من نوع bigint لأن IDs تليجرام أكبر من int العادي
-- is_active : وقّف الموظف بدل ما تمسحه
-- job_title : Owner / Admin / Developer / Reception / Cashier / Social
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.staff (
  id               serial PRIMARY KEY,
  environment      text        NOT NULL DEFAULT 'dev',
  telegram_chat_id bigint      NOT NULL,
  full_name        text        NOT NULL,
  job_title        text        NOT NULL,
  whatsapp_number  text        NULL,
  phone_number     text        NULL,
  is_active        boolean     NOT NULL DEFAULT true,
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT staff_env_chat_unique UNIQUE (environment, telegram_chat_id)
);

-- !!! مهم: غيّر الرقم 1000000003 (الـ Developer) لـ Telegram ID بتاعك انت !!!
-- تعرف الـ ID بتاعك من بوت @userinfobot على تليجرام.
-- لو سبته زي ما هو، البوت مش هيتعرف عليك كموظف (is_staff = false).
INSERT INTO public.staff
  (telegram_chat_id, full_name, job_title, whatsapp_number, phone_number)
VALUES
  (2000000001, 'منصور الشناوي', 'Owner',     '201000000101', '201000000101'),
  (2000000002, 'هبة عادل',     'Admin',     '201000000102', '201000000102'),
  (1000000003, 'Your Name',    'Developer', '201000000103', '201000000103'),  -- غيّر الـ ID والاسم
  (2000000004, 'سارة محمد',    'Reception', '201000000104', '201000000104'),
  (2000000005, 'أحمد فتحي',    'Reception', '201000000105', '201000000105'),
  (2000000006, 'ياسر إبراهيم', 'Cashier',   '201000000106', '201000000106'),
  (2000000007, 'نهى سمير',     'Cashier',   '201000000107', '201000000107'),
  (2000000008, 'مريم خالد',    'Social',    '201000000108', '201000000108'),
  (2000000009, 'عمر حسام',     'Social',    '201000000109', '201000000109')
ON CONFLICT (environment, telegram_chat_id) DO NOTHING;


-- =====================================================================
-- تأكد إن كل حاجة اتعملت: المفروض configurations = 13 و staff = 9
-- =====================================================================
SELECT 'configurations' AS table_name, count(*) AS rows FROM public.configurations
UNION ALL
SELECT 'staff', count(*) FROM public.staff;
