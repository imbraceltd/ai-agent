# Databoard — Naming Conventions

## Field name rule (HARD RULE)

ALL board field names MUST be `lowercase_with_underscores`.

NEVER use Title Case, spaces, hyphens, or camelCase.

| Wrong            | Correct          |
| ---------------- | ---------------- |
| `Full Name`      | `full_name`      |
| `Job Title`      | `job_title`      |
| `Company Name`   | `company_name`   |
| `Raw OCR Text`   | `raw_ocr_text`   |
| `customerEmail`  | `customer_email` |
| `Order-ID`       | `order_id`       |

### Why

Document AI extraction and downstream workflow steps reference fields by name.
Inconsistent casing breaks references silently. The lowercase_with_underscores
rule guarantees stable, predictable identifiers across all integrations.

## Board name rule

- Board names must be **unique within an organization**.
- If `create_board` fails with a uniqueness conflict, retry with a different name
  (e.g. append a discriminator: `customers` → `customers_v2`, `customers_eu`).

## Field description

- Optional but recommended for non-obvious fields.
- Plain text, no formatting requirements.

## Identifier field

- Exactly one field per board should be marked `is_identifier: true`.
- Use it for the most distinctive human-readable column (often a name, code, or title).
- Identifier fields are usually `ShortText`.
