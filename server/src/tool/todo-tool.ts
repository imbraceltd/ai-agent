/**
 * Todo Tools - Per-session todo list management backed by Redis.
 * Provides todoRead and todoWrite tools for the AI agent.
 * Enabled via assistant metadata.enable_todo flag.
 */

import { tool } from "ai";
import { z } from "zod";
import logger from "@/lib/logger";
import { getToolContext } from "@/core/agents/tool/toolContext";
import { redis } from "@/lib/redis";

/**
 * Todo item structure
 */
interface TodoItem {
  id: string;
  content: string;
  status: "pending" | "done";
  createdAt: string;
  updatedAt: string;
}

/** TTL for a session's todo list (1 hour). */
const TODO_TTL_SECONDS = 60 * 60;

/** Namespace for todo keys. Combined with the client's nba: keyPrefix. */
const TODO_KEY_PREFIX = "todo:";

function todoKey(threadId: string): string {
  return `${TODO_KEY_PREFIX}${threadId}`;
}

/**
 * Read the todo list for the given session from Redis.
 * Returns empty array when none exists.
 */
async function getTodos(threadId: string): Promise<TodoItem[]> {
  const key = todoKey(threadId);
  const raw = await redis.get(key);
  if (!raw) {
    logger.debug("todo-tool: redis GET (empty)", { threadId, key });
    return [];
  }
  try {
    const parsed = JSON.parse(raw);
    const todos = Array.isArray(parsed) ? (parsed as TodoItem[]) : [];
    logger.debug("todo-tool: redis GET", {
      threadId,
      key,
      count: todos.length,
      bytes: raw.length,
    });
    return todos;
  } catch (err) {
    logger.warn("Failed to parse todos from Redis, resetting", {
      threadId,
      key,
      error: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}

/**
 * Persist the todo list to Redis with TTL.
 * Uses setex to refresh the 1-hour expiration on every write so active
 * sessions don't lose their todos mid-conversation.
 */
async function setTodos(threadId: string, todos: TodoItem[]): Promise<void> {
  const key = todoKey(threadId);
  const payload = JSON.stringify(todos);
  await redis.setex(key, TODO_TTL_SECONDS, payload);
  logger.debug("todo-tool: redis SETEX", {
    threadId,
    key,
    count: todos.length,
    bytes: payload.length,
    ttlSeconds: TODO_TTL_SECONDS,
  });
}

/**
 * Generate a short unique ID for todo items.
 * @returns A random 8-character hex string
 */
function generateTodoId(): string {
  return `todo_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Clean up the todo store for a specific session.
 * Should be called when a session ends to free memory.
 * @param threadId - Session/thread ID to clean up
 */
export async function cleanupTodoStore(threadId: string): Promise<void> {
  const key = todoKey(threadId);
  const deleted = await redis.del(key);
  logger.info("todo-tool: redis DEL on cleanup", { threadId, key, deleted });
}

/**
 * todoRead - Read/list all todo items for the current chat session.
 */
export const todoRead = tool({
  description: `Read and list all todo items for the current chat session.
Returns a list of todos with their ID, content, and status (pending or done).
Use this tool to check the current state of the todo list before making changes.`,
  inputSchema: z.object({
    status: z
      .enum(["all", "pending", "done"])
      .optional()
      .default("all")
      .describe("Filter todos by status. Defaults to 'all'."),
  }),
  execute: async ({ status }) => {
    const toolContext = getToolContext();
    const threadId = toolContext.thread_id;

    if (!threadId) {
      logger.error("todoRead: missing thread_id in tool context");
      return { status: "error", error: "thread_id is missing from tool context" };
    }

    const todos = await getTodos(threadId);
    const filtered =
      status === "all" ? todos : todos.filter((t) => t.status === status);

    logger.info("todoRead executed", {
      threadId,
      totalCount: todos.length,
      filteredCount: filtered.length,
      filterStatus: status,
    });

    return {
      status: "success",
      todos: filtered.map((t) => ({
        id: t.id,
        content: t.content,
        status: t.status,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
      })),
      summary: {
        total: todos.length,
        pending: todos.filter((t) => t.status === "pending").length,
        done: todos.filter((t) => t.status === "done").length,
      },
    };
  },
});

/**
 * todoWrite - Create a new todo item or mark an existing one as done.
 */
export const todoWrite = tool({
  description: `Create a new todo item or update the status of an existing todo in the current chat session.

Actions:
- "add": Create a new todo item with the given content. Status defaults to "pending".
- "done": Mark an existing todo item as done by its ID.

Use todoRead first to check existing items before updating.`,
  inputSchema: z.object({
    action: z
      .enum(["add", "done"])
      .describe("The action to perform: 'add' to create a new todo, 'done' to mark as completed."),
    content: z
      .string()
      .optional()
      .describe("The content/description of the todo item. Required when action is 'add'."),
    todoId: z
      .string()
      .optional()
      .describe("The ID of the todo item to update. Required when action is 'done'."),
  }),
  execute: async ({ action, content, todoId }) => {
    const toolContext = getToolContext();
    const threadId = toolContext.thread_id;

    if (!threadId) {
      logger.error("todoWrite: missing thread_id in tool context");
      return { status: "error", error: "thread_id is missing from tool context" };
    }

    const todos = await getTodos(threadId);
    const now = new Date().toISOString();

    if (action === "add") {
      if (!content) {
        return { status: "error", error: "content is required when action is 'add'" };
      }

      const newTodo: TodoItem = {
        id: generateTodoId(),
        content,
        status: "pending",
        createdAt: now,
        updatedAt: now,
      };

      todos.push(newTodo);
      await setTodos(threadId, todos);

      logger.info("todoWrite: item added", {
        threadId,
        todoId: newTodo.id,
        content: content.slice(0, 100),
      });

      return {
        status: "success",
        action: "add",
        todo: {
          id: newTodo.id,
          content: newTodo.content,
          status: newTodo.status,
          createdAt: newTodo.createdAt,
        },
      };
    }

    if (action === "done") {
      if (!todoId) {
        return { status: "error", error: "todoId is required when action is 'done'" };
      }

      const todo = todos.find((t) => t.id === todoId);
      if (!todo) {
        return { status: "error", error: `Todo item not found: ${todoId}` };
      }

      todo.status = "done";
      todo.updatedAt = now;
      await setTodos(threadId, todos);

      logger.info("todoWrite: item marked done", {
        threadId,
        todoId: todo.id,
        content: todo.content.slice(0, 100),
      });

      return {
        status: "success",
        action: "done",
        todo: {
          id: todo.id,
          content: todo.content,
          status: todo.status,
          updatedAt: todo.updatedAt,
        },
      };
    }

    return { status: "error", error: `Unknown action: ${action}` };
  },
});
