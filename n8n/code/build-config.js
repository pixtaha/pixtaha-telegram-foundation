const setup = $('Set Environment').first().json;
const env = setup.environment;
if (!env) throw new Error('Missing "environment" field in Set Environment node');

// الـ keys المطلوبة (اختياري) من حقل required_keys في Set Environment
const required = (setup.required_keys || '')
  .split(',')
  .map((k) => k.trim())
  .filter(Boolean);

// كل صفوف الجدول تتحول لـ object واحد: { config_key: config_value }
const config = {};
for (const row of $input.all()) {
  const { config_key, config_value } = row.json;
  if (config_key) config[config_key] = config_value;
}

if (Object.keys(config).length === 0) {
  throw new Error(`No config rows found for environment "${env}". Check the environment name in Set Environment node.`);
}

const missing = required.filter((k) => !config[k]);
if (missing.length > 0) {
  throw new Error(`Missing config keys for environment "${env}": ${missing.join(', ')}`);
}

return [{ json: { ...config, environment: env } }];
