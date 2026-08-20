# Databoard — `MapToBoard` Field Guide

`MapToBoard` creates a relation from a row in one board to a row in another
board (foreign-key style). Use it to model independent entities that reference
each other.

## When to use

- **Use it for:** orders → customers, tickets → projects, employees → teams.
- **Don't use it for:** sub-records that have no meaning outside their parent
  (those belong in a `TableInTable` — see `databoard-table-in-table-guide`).

## Schema (creation)

At creation time, `MapToBoard` is declared without specifying the target —
the link is established via the UI or a follow-up update once both boards
exist.

```json
{ "name": "customer", "type": "MapToBoard" }
```

You can stack multiple `MapToBoard` fields on the same board to model
multi-way relationships (e.g. an order linked to both a customer and a
salesperson).

## Naming

Name the field after the *thing being referenced*, singular and lowercase:

| Context                           | Field name      |
| --------------------------------- | --------------- |
| Order linked to a customer        | `customer`      |
| Ticket linked to a project        | `project`       |
| Invoice linked to an order        | `order`         |
| Employee linked to a manager      | `manager`       |

## Cardinality

`MapToBoard` itself models a single reference. To model many-to-many, either:

1. Add a `MapToBoard` on each side, or
2. Create a join board with two `MapToBoard` fields plus relationship
   metadata.

## Verifying

After creating a board with `MapToBoard` fields, call `get_board_details`
to confirm the field is present. Linking the field to a specific target board
typically happens outside the agent flow.
