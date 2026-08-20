# Databoard — Field Types Reference

Complete reference of all 23 field types supported by `create_board` and
`update_board_schema`. Use the `type` value verbatim (case-sensitive).

For the two structural types (`TableInTable`, `MapToBoard`), see their
dedicated guides — this file covers the schema and gives a one-line summary
per type.

## Quick list

`ShortText`, `LongText`, `SingleSelection`, `MultipleSelection`, `Number`,
`Time`, `Date`, `Datetime`, `Link`, `Priority`, `Assignee`,
`MultipleAssignee`, `Email`, `Phone`, `RichText`, `Country`, `Notes`,
`Origin`, `Attachment`, `Currency`, `Checkbox`, `MapToBoard`, `TableInTable`.

## Common shape

Every field has at minimum:

```json
{ "name": "lowercase_with_underscores", "type": "<TypeName>" }
```

Optional flags on every field:

- `is_default: boolean` — show in default UI view (default `false`).
- `is_identifier: boolean` — mark as the row's identifier (one per board).
- `description: string` — human-readable hint.

## Per-type schema

### Text

- **`ShortText`** — single-line text. Use for names, codes, titles.
- **`LongText`** — multi-line plain text. Use for paragraphs.
- **`RichText`** — formatted HTML/markdown content. Use for editorial copy.
- **`Notes`** — append-only comment thread tied to a row.

### Selection

- **`SingleSelection`** — pick one of N. Provide options via `data`:
  ```json
  {
    "name": "status",
    "type": "SingleSelection",
    "data": [{ "value": "Open" }, { "value": "Closed" }]
  }
  ```
- **`MultipleSelection`** — pick many of N. Same `data` shape.
- **`Priority`** — predefined selection (Low/Med/High/Urgent). No `data` needed.
- **`Country`** — country picker with ISO codes. No `data` needed.

### Numeric

- **`Number`** — integer or decimal.
- **`Currency`** — money. Locale handled by the UI.

### Boolean

- **`Checkbox`** — true/false.

### Time

- **`Date`** — calendar date (no time).
- **`Time`** — time of day. Settings:
  ```json
  { "settings": { "time_zone": "Asia/Bangkok", "enable_timezone": true } }
  ```
- **`Datetime`** — date + time. Same `settings` shape as `Time`.

### People

- **`Assignee`** — single org member.
- **`MultipleAssignee`** — multiple org members.

### Contact

- **`Email`** — email address (validated).
- **`Phone`** — phone number. Settings:
  ```json
  { "settings": { "default_country_code": "+66" } }
  ```

### Reference / Link

- **`Link`** — external URL.
- **`Origin`** — system-managed source reference (where a row was ingested from).
- **`MapToBoard`** — link to a row in another board. **See `databoard-map-to-board-guide`.**

### Files

- **`Attachment`** — file uploads.

### Structural

- **`TableInTable`** — nested table inside a row. **See `databoard-table-in-table-guide`.**

## Full example payload

```json
"fields": [
  { "name": "short_text_field",         "type": "ShortText", "is_default": true, "is_identifier": true },
  { "name": "long_text_field",          "type": "LongText" },
  { "name": "single_selection_field",   "type": "SingleSelection",
    "data": [{ "value": "Option A" }, { "value": "Option B" }, { "value": "Option C" }] },
  { "name": "multiple_selection_field", "type": "MultipleSelection",
    "data": [{ "value": "Tag 1" }, { "value": "Tag 2" }, { "value": "Tag 3" }] },
  { "name": "number_field",             "type": "Number" },
  { "name": "time_field",               "type": "Time",
    "settings": { "time_zone": "Asia/Bangkok", "enable_timezone": true } },
  { "name": "date_field",               "type": "Date" },
  { "name": "datetime_field",           "type": "Datetime",
    "settings": { "time_zone": "Asia/Bangkok", "enable_timezone": true } },
  { "name": "link_field",               "type": "Link" },
  { "name": "priority_field",           "type": "Priority" },
  { "name": "assignee_field",           "type": "Assignee" },
  { "name": "multiple_assignee_field",  "type": "MultipleAssignee" },
  { "name": "email_field",              "type": "Email" },
  { "name": "phone_field",              "type": "Phone",
    "settings": { "default_country_code": "+66" } },
  { "name": "rich_text_field",          "type": "RichText" },
  { "name": "country_field",            "type": "Country" },
  { "name": "notes_field",              "type": "Notes" },
  { "name": "origin_field",             "type": "Origin" },
  { "name": "attachment_field",         "type": "Attachment" },
  { "name": "currency_field",           "type": "Currency" },
  { "name": "checkbox_field",           "type": "Checkbox" },
  { "name": "map_to_board_field",       "type": "MapToBoard" }
]
```
