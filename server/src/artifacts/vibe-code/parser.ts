/**
 * Server-side streaming parser for boltArtifact/boltAction XML tags.
 * Ported from bolt.diy's StreamingMessageParser (app/lib/runtime/message-parser.ts).
 * Removes all browser-specific code (DOM manipulation, quick actions).
 */

const ARTIFACT_TAG_OPEN = "<boltArtifact";
const ARTIFACT_TAG_CLOSE = "</boltArtifact>";
const ARTIFACT_ACTION_TAG_OPEN = "<boltAction";
const ARTIFACT_ACTION_TAG_CLOSE = "</boltAction>";

export type ActionType = "file" | "shell" | "start";

export interface FileAction {
  type: "file";
  filePath: string;
  content: string;
}

export interface ShellAction {
  type: "shell";
  content: string;
}

export interface StartAction {
  type: "start";
  content: string;
}

export type BoltAction = FileAction | ShellAction | StartAction;

export interface ArtifactData {
  id: string;
  title: string;
}

export interface ActionCallbackData {
  artifactId: string;
  messageId: string;
  actionId: string;
  action: BoltAction;
}

export interface ArtifactCallbackData {
  messageId: string;
  artifactId: string;
  title: string;
}

export interface ParserCallbacks {
  onArtifactOpen?: (data: ArtifactCallbackData) => void;
  onArtifactClose?: (data: ArtifactCallbackData) => void;
  onActionOpen?: (data: ActionCallbackData) => void;
  onActionStream?: (data: ActionCallbackData) => void;
  onActionClose?: (data: ActionCallbackData) => void;
}

interface MessageState {
  position: number;
  insideArtifact: boolean;
  insideAction: boolean;
  artifactCounter: number;
  currentArtifact: ArtifactData | undefined;
  currentAction: Partial<BoltAction> & { content: string };
  actionId: number;
}

function cleanMarkdownSyntax(content: string): string {
  const codeBlockRegex = /^\s*```\w*\n([\s\S]*?)\n\s*```\s*$/;
  const match = content.match(codeBlockRegex);
  return match?.[1] ?? content;
}

function cleanEscapedTags(content: string): string {
  return content.replace(/&lt;/g, "<").replace(/&gt;/g, ">");
}

export class VibeCodeStreamingParser {
  #messages = new Map<string, MessageState>();
  #callbacks: ParserCallbacks;

  constructor(callbacks: ParserCallbacks = {}) {
    this.#callbacks = callbacks;
  }

  parse(messageId: string, input: string): void {
    let existing = this.#messages.get(messageId);

    if (!existing) {
      existing = {
        position: 0,
        insideAction: false,
        insideArtifact: false,
        artifactCounter: 0,
        currentArtifact: undefined,
        currentAction: { content: "" },
        actionId: 0,
      };
      this.#messages.set(messageId, existing);
    }

    const state: MessageState = existing;

    let i = state.position;
    let earlyBreak = false;

    while (i < input.length) {
      if (state.insideArtifact) {
        const currentArtifact = state.currentArtifact;
        if (!currentArtifact) break;

        if (state.insideAction) {
          const closeIndex = input.indexOf(ARTIFACT_ACTION_TAG_CLOSE, i);
          const currentAction = state.currentAction;

          if (closeIndex !== -1) {
            // Action tag closed — finalize content
            currentAction.content += input.slice(i, closeIndex);
            let content = currentAction.content.trim();

            content = cleanEscapedTags(content);

            if (currentAction.type === "file") {
              const filePath = (currentAction as FileAction).filePath;
              if (!filePath?.endsWith(".md")) {
                content = cleanMarkdownSyntax(content);
              }
              content += "\n";
            }

            currentAction.content = content;

            this.#callbacks.onActionClose?.({
              artifactId: currentArtifact.id,
              messageId,
              actionId: String(state.actionId - 1),
              action: currentAction as BoltAction,
            });

            state.insideAction = false;
            state.currentAction = { content: "" };
            i = closeIndex + ARTIFACT_ACTION_TAG_CLOSE.length;
          } else {
            // Still streaming action content — only grab the NEW portion
            const newContent = input.slice(i);
            currentAction.content += newContent;

            if (currentAction.type === "file") {
              this.#callbacks.onActionStream?.({
                artifactId: currentArtifact.id,
                messageId,
                actionId: String(state.actionId - 1),
                action: {
                  type: "file",
                  filePath: (currentAction as FileAction).filePath,
                  content: cleanEscapedTags(currentAction.content),
                },
              });
            }

            // Advance position to end of input so we don't re-process this content
            i = input.length;
            break;
          }
        } else {
          // Inside artifact but outside action — look for action open or artifact close
          const actionOpenIndex = input.indexOf(ARTIFACT_ACTION_TAG_OPEN, i);
          const artifactCloseIndex = input.indexOf(ARTIFACT_TAG_CLOSE, i);

          if (
            actionOpenIndex !== -1 &&
            (artifactCloseIndex === -1 || actionOpenIndex < artifactCloseIndex)
          ) {
            const actionEndIndex = input.indexOf(">", actionOpenIndex);

            if (actionEndIndex !== -1) {
              state.insideAction = true;
              state.currentAction = this.#parseActionTag(
                input,
                actionOpenIndex,
                actionEndIndex
              );

              this.#callbacks.onActionOpen?.({
                artifactId: currentArtifact.id,
                messageId,
                actionId: String(state.actionId++),
                action: state.currentAction as BoltAction,
              });

              i = actionEndIndex + 1;
            } else {
              break; // Incomplete tag
            }
          } else if (artifactCloseIndex !== -1) {
            this.#callbacks.onArtifactClose?.({
              messageId,
              artifactId: currentArtifact.id,
              title: currentArtifact.title,
            });

            state.insideArtifact = false;
            state.currentArtifact = undefined;
            i = artifactCloseIndex + ARTIFACT_TAG_CLOSE.length;
          } else {
            break; // Wait for more input
          }
        }
      } else if (input[i] === "<" && input[i + 1] !== "/") {
        // Detect artifact open tag
        let j = i;
        let potentialTag = "";

        while (j < input.length && potentialTag.length < ARTIFACT_TAG_OPEN.length) {
          potentialTag += input[j];

          if (potentialTag === ARTIFACT_TAG_OPEN) {
            const nextChar = input[j + 1];

            if (nextChar && nextChar !== ">" && nextChar !== " ") {
              i = j + 1;
              break;
            }

            const openTagEnd = input.indexOf(">", j);

            if (openTagEnd !== -1) {
              const artifactTag = input.slice(i, openTagEnd + 1);
              const artifactTitle =
                this.#extractAttribute(artifactTag, "title") ?? "Untitled";
              const artifactId = `${messageId}-${state.artifactCounter++}`;

              state.insideArtifact = true;
              state.currentArtifact = {
                id: artifactId,
                title: artifactTitle,
              };

              this.#callbacks.onArtifactOpen?.({
                messageId,
                artifactId,
                title: artifactTitle,
              });

              i = openTagEnd + 1;
            } else {
              earlyBreak = true;
            }
            break;
          } else if (!ARTIFACT_TAG_OPEN.startsWith(potentialTag)) {
            i = j + 1;
            break;
          }

          j++;
        }

        if (j === input.length && ARTIFACT_TAG_OPEN.startsWith(potentialTag)) {
          break; // Incomplete tag at end of input
        }
      } else {
        i++;
      }

      if (earlyBreak) break;
    }

    state.position = i;
  }

  reset(): void {
    this.#messages.clear();
  }

  #parseActionTag(
    input: string,
    actionOpenIndex: number,
    actionEndIndex: number
  ): Partial<BoltAction> & { content: string } {
    const actionTag = input.slice(actionOpenIndex, actionEndIndex + 1);
    const actionType = this.#extractAttribute(actionTag, "type") as ActionType;

    const base: Partial<BoltAction> & { content: string } = {
      type: actionType,
      content: "",
    };

    if (actionType === "file") {
      const filePath = this.#extractAttribute(actionTag, "filePath") ?? "";
      (base as FileAction).filePath = filePath;
    }

    return base;
  }

  #extractAttribute(tag: string, attributeName: string): string | undefined {
    const match = tag.match(new RegExp(`${attributeName}="([^"]*)"`, "i"));
    return match ? match[1] : undefined;
  }
}
