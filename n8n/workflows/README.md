# Workflows

حط هنا export الـ workflow من n8n (`Download` من قايمة الـ workflow)، مثلاً `telegram-foundation.json`.

## قبل ما ترفع أي export على GitHub

- [ ] امسح الـ **pinned data** (الـ `pinData` في الـ JSON). ممكن يكون فيه IDs وأسماء حقيقية من تجاربك.
- [ ] دوّر في الملف على أي token أو key أو رقم تليفون حقيقي.
- [ ] الـ export بيحتفظ باسم وID الـ Credentials بس، مش الأسرار نفسها. مع كده الأفضل تراجع الملف بعينك.
- [ ] لو الـ workflow فيه Webhook أو Telegram Trigger، الـ webhook URL بيتولد من السيرفر، فمش هيبان في الـ JSON، بس راجع أي node بتحط فيها URL يدوي.
