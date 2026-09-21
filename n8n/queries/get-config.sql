-- n8n Postgres node: "Get Config"  (Operation: Execute a Query)
-- Settings > Always Output Data: ON
-- Options > Query Parameters:  {{ $json.environment }}
SELECT config_key, config_value
FROM public.configurations
WHERE environment = $1;
