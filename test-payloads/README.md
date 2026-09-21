# Test payloads

كل ملف هنا هو **الـ output بتاع Telegram Trigger node** لنوع رسالة معيّن، والـ tests بتشغّل عليه كود الـ **Normalize node**.

كل الأرقام والأسماء والـ file_ids وهمية. الـ `user_id` هو `1000000003` وده نفس الـ Developer في `sql/setup.sql`.

| الملف | الحالة | مصدره |
|---|---|---|
| 01 → 13 | أنواع الرسائل الأساسية (command, text, photo, document, voice, video, location, edited, reply) | شكل حقيقي من Telegram |
| 14, 15 | ضغطة زرار (`callback_query`) وضغطة "duplicate" | مكتوب يدويًا |
| 16, 17, 18 | الباركود والـ hints (عادي، مش باركود، أرقام عربي) | مكتوب يدويًا |
| 19 | رسالة في جروب (`user_id` مختلف عن `chat_id`) | مكتوب يدويًا |
| 20, 21 | ستيكر وجهة اتصال (`other`) | مكتوب يدويًا |

## إضافة حالة جديدة

1. حط الـ JSON (الـ update object بتاع Telegram، من غير الـ array اللي حواليه) في ملف جديد هنا.
2. ضيف سطر في `normalizeCases` جوه `tests/run-tests.js` بالقيم المتوقعة.
3. شغّل `npm test`.

> ما تحطش payloads حقيقية فيها Telegram IDs أو أسماء ناس. بدّلهم بقيم وهمية الأول.
