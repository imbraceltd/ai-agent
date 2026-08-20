# Databoard — `TableInTable` Field Guide

`TableInTable` lets a single row contain a nested table of sub-rows. Use it
when a one-to-many relationship belongs *inside* the parent record rather than
as a separate board.

## When to use

- **Use it for:** order line items inside an order, milestones inside a
  project, contact list inside a company record — sub-rows that are
  meaningless without their parent.
- **Don't use it for:** entities that are queried independently (those should
  be a separate board joined via `MapToBoard`).

Rule of thumb: if the user would ever want to filter/sort the child rows
across all parents, prefer a separate board with `MapToBoard`.

## Schema

```json
{
  "name": "line_items",
  "type": "TableInTable",
  "fields": [
    { "name": "product_name", "type": "ShortText", "is_identifier": true },
    { "name": "quantity",     "type": "Number" },
    { "name": "unit_price",   "type": "Currency" }
  ]
}
```

The nested `fields` array follows the same rules as top-level fields:

- Names are `lowercase_with_underscores`.
- Each nested field has its own `name` + `type` (and optional `data`,
  `settings`, `is_identifier`, `description`).
- Nested fields can be most simple types (`ShortText`, `LongText`, `Number`,
  `SingleSelection`, `MultipleSelection`, `Date`, `Datetime`, `Currency`,
  `Checkbox`, `Email`, `Phone`, `Link`, `RichText`).
- **Do NOT nest `TableInTable` inside `TableInTable`** — only one level of
  nesting is supported.
- **Do NOT use `Assignee`/`MultipleAssignee` inside a nested table** unless
  the user explicitly asks; it is supported but rarely what they want.
- Mark exactly one nested field with `is_identifier: true`.

## Updating a `TableInTable`

When updating via `update_board_schema`, include `field_id` for the
`TableInTable` field itself if you are modifying it. Modifying nested fields
within an existing `TableInTable` is not supported via this tool today —
recreate the field if the nested schema must change. Verify with
`get_board_details` after any change.

## Example: Order with line items

```json
{
  "name": "orders",
  "type": "General",
  "fields": [
    { "name": "order_number", "type": "ShortText", "is_identifier": true },
    { "name": "customer",     "type": "MapToBoard" },
    { "name": "ordered_at",   "type": "Datetime" },
    {
      "name": "line_items",
      "type": "TableInTable",
      "fields": [
        { "name": "product_name", "type": "ShortText", "is_identifier": true },
        { "name": "quantity",     "type": "Number" },
        { "name": "unit_price",   "type": "Currency" }
      ]
    }
  ]
}
```
