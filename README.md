**English** | **[العربية](README.ar.md)**

# Telegram Workflow Foundation for n8n

A reusable foundation for any Telegram bot built in n8n:

- **Config from the database** instead of hard-coding tokens and IDs inside nodes, with `dev` / `demo` / `production` support.
- **Normalize**: any Telegram update (text, photo, video, voice, file, location, button press, edited message) becomes one object with stable field names.
- **Staff Context**: identifies who sent the message (`is_staff`) and groups your staff by role.
- **Tests**: 35 tests that run the exact code you paste into n8n against 21 payloads.

> **For learning only.** Every value in this repo is fake. Read the [Security](#security) section before putting real data anywhere.

---

## Repo structure

```
.
├── sql/
│   └── setup.sql                 both tables + demo data
├── n8n/
│   ├── code/                     Code node sources (paste into n8n)
│   │   ├── build-config.js
│   │   ├── normalize.js
│   │   └── build-staff-context.js
│   ├── queries/                  queries for the Postgres nodes
│   │   ├── get-config.sql
│   │   └── get-staff.sql
│   └── workflows/                put your workflow export here (see the README inside)
├── test-payloads/                21 payloads covering message types
├── tests/
│   └── run-tests.js
└── package.json
```

---

## Quick start

### 1) Database

Open your **SQL Editor** (Supabase, pgAdmin, or any Postgres client), paste `sql/setup.sql`, and run it. At the end you should see `configurations = 13` and `staff = 9`.

The script is idempotent: you can run it several times without errors or duplicated data.

> **Important:** in `sql/setup.sql`, change the `Developer` row (ID `1000000003`) to your own Telegram ID. You can get it from the `@userinfobot` bot. If you leave it as is, the bot won't recognize you as staff (`is_staff = false`).

### 2) The workflow in n8n

Build the nodes in this order, **using exactly these names** (the code reads other nodes by name):

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

| Node | Type | Content |
|---|---|---|
| **Telegram Trigger** | Telegram Trigger node | Your bot's credentials |
| **Set Environment** | Edit Fields node | Two fields: `environment` = `dev`, and `required_keys` = `tg_token,tg_chat_developer` (optional) |
| **Get Config** | Postgres node | [`n8n/queries/get-config.sql`](n8n/queries/get-config.sql) |
| **Build Config** | Code node | [`n8n/code/build-config.js`](n8n/code/build-config.js) |
| **Normalize** | Code node | [`n8n/code/normalize.js`](n8n/code/normalize.js) |
| **Get Staff** | Postgres node | [`n8n/queries/get-staff.sql`](n8n/queries/get-staff.sql) |
| **Build Staff Context** | Code node | [`n8n/code/build-staff-context.js`](n8n/code/build-staff-context.js) |

**Code nodes:** Mode = **Run Once for All Items**, language = JavaScript.
**Postgres nodes:** Operation = **Execute a Query**, and turn on **Settings → Always Output Data**. The Query Parameters are written at the top of each `.sql` file.

Tip: wrap the 6 nodes after the trigger in a **group** named `Load Context`.

### 3) Run the tests

```bash
npm test
```

No dependencies. Requires Node 18 or newer.

---

## What you get after the group

### From **Normalize**

One item with about 60 fields. All of them are always present (`null` when not applicable), so you never hit `undefined`. The main ones:

| Group | Fields |
|---|---|
| Who and where | `user_id`, `chat_id`, `chat_type`, `message_id`, `username`, `first_name` |
| Type | `message_type`, `update_type`, `is_edit` |
| Text | `message_text`, `caption` |
| Commands | `is_command`, `command`, `command_args` |
| Media | `photo_file_id`, `video_file_id`, `audio_file_id`, `is_voice`, `document_file_id`, `document_name`, `document_mime`, `sent_as_document` |
| Location | `latitude`, `longitude`, `venue_title`, `venue_address` |
| Replies | `is_reply`, `replied_to_message_id`, `replied_to_type`, `replied_to_text`, `replied_to_*_id` |
| Buttons | `callback_query_id`, `callback_data`, `callback_context`, `callback_action`, `callback_params`, `callback_param_1..7` |
| Barcode | `barcode`, `barcode_is_global`, `hint`, `hint_category_2`, `hint_category_3` |
| Raw | `raw` (the original Telegram update) |

#### `message_type` values

| Value | When |
|---|---|
| `message` | Plain text |
| `command` | Starts with `/` (`/start@BotName` is cleaned to `/start`) |
| `photo` | A photo, or a file with an `image/*` MIME type (then `sent_as_document = true`) |
| `video` | A video, or a file with a `video/*` MIME type |
| `audio` | Voice note or audio (`is_voice` tells them apart) |
| `document` | Any other file (CSV, PDF, ...) |
| `location` | A plain location or a venue |
| `sticker` | A sticker |
| `callback_query` | An inline button press |
| `reply` / `mention_reply` | A reply to a message / a mention |
| `other` | No text and no media (contact, poll, ...) |
| `unsupported` | Anything else |

An edited message keeps its normal type, with `is_edit = true` and `update_type = "edited_message"`.

#### Callback params

`callback_data` is split on `:`

```
context:action:param1:param2:...
order:approve:123:cash
   ↓        ↓     ↓     ↓
context  action  param_1  param_2
```

Up to 7 params are supported, and all of them are also available in an array called `callback_params`.

> Telegram limits `callback_data` to **64 bytes**, so keep the params short.

#### Barcode and hints

The barcode must be **the first word, digits only** (6 or more digits, or the whole first line being a number). If there's no barcode, every line becomes a hint. Arabic-Indic and Persian digits are converted to Western digits.

```
6221031234567 Sony A7      ← barcode = 6221031234567, hint = "Sony A7"
Cameras                   ← hint_category_2
Mirrorless                ← hint_category_3
```

### From **Build Staff Context**

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

The known roles always exist as arrays (empty when nobody has that role), and any new role you add to the table shows up automatically.

---

## Using the data in the rest of the workflow

Target **roles**, not people. If a staff member changes, you edit the table and the workflow stays untouched.

| Case | How |
|---|---|
| A config value | `{{ $('Build Config').first().json.tg_chat_developer }}` |
| A role with one person | `{{ $('Build Staff Context').first().json.roles.owner[0]?.chat_id }}` |
| A role with several people | **Split Out node** on `roles.reception`; the `chat_id` is then `{{ $json.chat_id }}` |
| Message data | `{{ $('Normalize').first().json.message_type }}` |

**Rules of thumb:**

- Always read by node name, `$('Node Name').first().json...`, not `$json`, because `$json` changes with every node.
- The index in an array (`[0]`, `[1]`) comes from `ORDER BY id`. Deactivating a staff member or adding a new one can shift it, so don't rely on it for roles with several people.
- `is_staff = false` means the sender isn't staff, so put an **IF node** after the group to stop the workflow in that case.

---

## Managing data

**Add a config value or update one:**

```sql
INSERT INTO public.configurations (environment, config_key, config_value, description)
VALUES ('dev', 'my_new_key', 'my_value', 'What this key is for')
ON CONFLICT (environment, config_key)
DO UPDATE SET
  config_value = EXCLUDED.config_value,
  description  = EXCLUDED.description,
  updated_at   = now();
```

**Copy the dev config to demo:**

```sql
INSERT INTO public.configurations (environment, config_key, config_value, description)
SELECT 'demo', config_key, config_value, description
FROM public.configurations
WHERE environment = 'dev'
ON CONFLICT (environment, config_key) DO NOTHING;
```

**Add a staff member:**

```sql
INSERT INTO public.staff (telegram_chat_id, full_name, job_title, whatsapp_number, phone_number)
VALUES (2000000010, 'Staff Name', 'Cashier', '201000000110', '201000000110');
```

**Deactivate a staff member without deleting:**

```sql
UPDATE public.staff
SET is_active = false, updated_at = now()
WHERE environment = 'dev' AND telegram_chat_id = 2000000010;
```

---

## Security

- The tables store values as **plain text**, so use them for learning and fake data only.
- Real tokens (Telegram, OpenAI, WhatsApp, ...) belong in **n8n Credentials**.
- The **Telegram Trigger node** and the **Telegram node** only take the token from Credentials, not from an expression. So a `tg_token` stored in the table only works with the **HTTP Request node**.
- If you use Supabase and the tables live in the `public` schema without RLS, anyone with the `anon key` can read them through the REST API. If n8n connects straight to Postgres (**Postgres node**) you're not affected, but still don't store sensitive data there.
- If a real token is ever published by mistake (on GitHub or anywhere else), **rotate it immediately** at its source. Deleting it in a new commit is not enough, because it stays in the git history.

---

## FAQ

**Why `environment`?**
So the same workflow can run on `dev`, `demo` and `production` with different settings. The default is `dev` so an INSERT that forgets to set it never touches production.

**I get `Missing config keys`.**
A key is missing from the table for that environment, or it's misspelled. Check `required_keys` in the **Set Environment node**.

**I get `No config rows found`.**
The environment name is wrong (for example `prod` instead of `production`), or the table has no rows for it.

**Normalize throws `Missing environment`.**
The **Build Config node** didn't return `environment`. Check the nodes before it.

**`is_staff` is `false` but I'm staff.**
The `telegram_chat_id` in the `staff` table doesn't match your ID, the row has `is_active = false`, or its `environment` differs from the one chosen in the **Set Environment node**.

---

## Roadmap

- [ ] **IF node** that blocks anyone who isn't staff
- [ ] **Switch node** that routes by `message_type`
- [ ] Fallback branches for unsupported types
- [ ] Workflow export in `n8n/workflows/`
