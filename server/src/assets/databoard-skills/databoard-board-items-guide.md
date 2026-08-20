# Databoard — Board Items (Rows) Guide

A **board item** is a row in a board. This guide covers how to read and
write rows via the `get_board_items`, `get_board_item`, `create_board_item`,
and `create_board_items` tools.

## Discovering field IDs

Before creating a row you MUST know the `board_field_id` (the field's `_id`)
for every field you want to populate. Field NAMES are not accepted by the
write API.

1. Call `get_board_details({ board_id })`.
2. From the response, read each field's `_id`. That is the `board_field_id`
   to use in `fields[]`.
3. For nested `TableInTable` fields, also collect the `_id` of every nested
   field — those are needed in the inner row objects.

## `create_board_item` body shape

```json
{
  "board_id": "brd_xxx",
  "fields": [
    { "board_field_id": "<id>", "value": "..." }
  ],
  "logo_url": null,
  "conversation_id": null,
  "app_name": null,
  "related_board_item_id": null
}
```

Only `board_id` and `fields` are required. The other top-level keys are for
specialized integrations (chat conversations, company logos, cross-board
linking).

## Value shapes by field type

| Field type           | `value` shape                                                        |
| -------------------- | -------------------------------------------------------------------- |
| `ShortText`/`LongText`/`RichText`/`Email`/`Phone`/`Link`/`Country` | string                                  |
| `Number`             | number                                                               |
| `Currency`           | `{ "currency_code": "HKD", "amounts": 25000000 }`                    |
| `Date`               | ISO date string `"2026-04-15"` or pre-formatted `"15, 03, 1994"`     |
| `Datetime`           | ISO datetime string                                                  |
| `Time`               | string (`"HH:mm"` or ISO time)                                       |
| `Checkbox`           | boolean                                                              |
| `SingleSelection`    | the selected option's `value` string                                 |
| `MultipleSelection`  | array of option `value` strings                                      |
| `Priority`           | the priority label string                                            |
| `Assignee`           | the user id                                                          |
| `MultipleAssignee`   | array of user ids                                                    |
| `Attachment`         | array of attachment descriptors (see existing rows for shape)        |
| `MapToBoard`         | the target board's `board_item_id`                                   |
| `TableInTable`       | array of row objects keyed by NESTED field `_id` (see below)         |

### `TableInTable` value shape

For a `TableInTable` field, the entry needs three things: `board_field_id`
(the parent field id), `type: "TableInTable"`, and `child-board` (the child
board id whose schema each nested row follows). The `value` is an array
where each element is a row object **keyed by the nested field `_id`**:

```json
{
  "board_field_id": "<parent_field_id>",
  "type": "TableInTable",
  "child-board": "brd_<child_id>",
  "value": [
    {
      "<nested_field_id_1>": "Company Type",
      "<nested_field_id_2>": "Limited Company",
      "<nested_field_id_3>": "[295, 338, 900, 375]",
      "<nested_field_id_4>": "0.97"
    },
    {
      "<nested_field_id_1>": "Date of Incorporation",
      "<nested_field_id_2>": "15, 03, 1994"
    }
  ]
}
```

Get nested field ids by calling `get_board_details` on the **child** board
(the one referenced by `child-board`).

## Example: full create payload

```json
{
  "board_id": "brd_company",
  "fields": [
    { "board_field_id": "f_name", "value": "Hutchison Port Holdings Limited" },
    {
      "board_field_id": "f_chinese_names",
      "type": "TableInTable",
      "child-board": "brd_chinese_names",
      "value": [
        { "n_name": "和記港口控股有限公司", "n_bbox": "[295, 293, 700, 335]", "n_conf": "0.92" }
      ]
    },
    {
      "board_field_id": "f_obligations",
      "type": "TableInTable",
      "child-board": "brd_obligations",
      "value": [
        {
          "n_label": "Total amount of outstanding obligations",
          "n_amount": { "currency_code": "HKD", "amounts": 25000000000 },
          "n_bbox": "[610, 700, 645, 850]",
          "n_conf": "0.91"
        }
      ]
    }
  ]
}
```

## Listing items

> **⛔ Anti-pattern: do NOT loop `get_board_item`.** When the user asks to
> read, dump, count, or summarize rows in a board, call `get_board_items`
> ONCE (paginate if needed). The response already contains every row's
> field values. Calling `get_board_item` per row wastes 10–100× tool calls
> for the same data. `get_board_item` is only justified when the user
> explicitly references a single `board_item_id`, or you need raw field
> metadata (e.g. `field.contact_field`) that the list response strips out.

`get_board_items` accepts:

- `limit` (1–100, default 10), `skip` (default 0)
- `sort` — e.g. `-created_at` (descending) or `created_at`
- `filter` — object keyed by `board_field_id`, e.g.
  `{ "<field_id>": "match value" }`
- Convenience: `phone`, `email`
- `include_parent` — include parent rows when this board is a child via
  `MapToBoard`/`TableInTable` linkage

The tool returns a *summarized* item list — `_id`, top-level metadata, plus
each field flattened to `{ name, type, value }`. For the full raw record
(including nested field metadata), call `get_board_item` with the specific
`board_item_id`.

## Updating an item

`update_board_item` edits a single row by id. **Different shape from
create:** the body uses `data: [{ key, value }]` where `key` is the
`board_field_id`. Only fields listed in `data` are modified — anything
omitted keeps its current value.

```json
{
  "board_id": "brd_xxx",
  "board_item_id": "bi_xxx",
  "data": [
    { "key": "<field_id>", "value": "new value" }
  ]
}
```

The `value` shapes are the same as for create (Currency is
`{ currency_code, amounts }`, TableInTable is array-of-row-objects keyed by
nested field `_id`, etc.).

## Deleting an item

`delete_board_item` removes a single row by id. Irreversible. Confirm with
the user before calling unless they have already explicitly asked to delete
this specific row.

## Bulk create

`create_board_items` POSTs `{ items: [...], strict_mode? }` to
`/v1/board/create/:id/board_items`. Up to 1000 items per call.

- `strict_mode: true` (default) — entire batch fails on any item error.
- `strict_mode: false` — valid items are inserted; errors are reported per
  item.

Use bulk for seeding or migration. For a single user-driven row, prefer
`create_board_item` so you can branch on the response.

## Common pitfalls

- ❌ Using field NAMES instead of `_id` — write requests will silently drop
  unknown ids.
- ❌ Missing `type: "TableInTable"` + `child-board` on a nested-table entry
  — the API treats the value as a plain string array.
- ❌ Currency as a number — must be `{ currency_code, amounts }`.
- ❌ Forgetting that nested rows are keyed by **nested field `_id`**, not by
  field name. Get them via `get_board_details` on the child board.
