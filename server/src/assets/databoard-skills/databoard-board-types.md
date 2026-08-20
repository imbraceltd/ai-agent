# Databoard — Board Types

The `type` field on a board controls its role in the platform. Pick one of:

## `General`

Default for most use cases. A regular data table that users edit through the
Databoard UI and that workflows read/write.

**Pick this when:** the user describes a CRUD-style data list — customers,
orders, tasks, leads, inventory, anything with rows and columns.

## `KnowledgeHub`

A board whose rows represent knowledge documents/articles consumed by AI
agents (RAG retrieval, prompt grounding). Treated specially by the platform —
indexed for semantic search.

**Pick this when:** the user describes FAQs, knowledge articles, product
documentation, SOPs, or any content meant to be retrieved by an AI agent at
runtime rather than displayed as tabular data.

## `System`

Reserved for platform-managed boards (audit logs, system events). **Do not
create `System` boards from the agent.** Filter it out when listing boards.

## How to choose

If unsure, default to `General`. Switch to `KnowledgeHub` only when the user
explicitly mentions knowledge base, RAG, FAQ, articles, or AI grounding.

## Hidden flag

Separate from `type`: `hidden: true` keeps a board out of the default UI list
without changing its type. Leave `hidden: false` unless the user asks
otherwise.
