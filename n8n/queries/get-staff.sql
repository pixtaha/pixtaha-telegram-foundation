-- n8n Postgres node: "Get Staff"  (Operation: Execute a Query)
-- Settings > Always Output Data: ON
-- Options > Query Parameters:  {{ $('Normalize').first().json.env }}
SELECT
  telegram_chat_id::text AS telegram_chat_id,
  full_name,
  job_title,
  whatsapp_number,
  phone_number
FROM public.staff
WHERE environment = $1
  AND is_active = true
ORDER BY id;
