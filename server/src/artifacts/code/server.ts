import { streamObject } from "ai";
import { z } from "zod";
import { codePrompt, updateDocumentPrompt } from "@/artifacts/lib/prompts";
import { createDocumentHandler } from "@/artifacts/server";

export const codeDocumentHandler = createDocumentHandler<"code">({
  kind: "code",
  onCreateDocument: async ({ title, dataStream, model, chatId }) => {
    let draftContent = "";

    if (!model) {
      throw new Error("Missing model for code artifact generation");
    }

    const { fullStream } = streamObject({
      model,
      system: codePrompt,
      prompt: title,
      schema: z.object({
        code: z.string(),
      }),
    });

    for await (const delta of fullStream) {
      const { type } = delta;

      if (type === "object") {
        const { object } = delta;
        const { code } = object;

        if (code) {
          dataStream.write({
            type: "data-codeDelta",
            data: { value: code ?? "", chatId },
            transient: true,
          });

          draftContent = code;
        }
      }
    }

    return draftContent;
  },
  onUpdateDocument: async ({ document, description, dataStream, model, chatId }) => {
    let draftContent = "";

    if (!model) {
      throw new Error("Missing model for code artifact update");
    }

    const { fullStream } = streamObject({
      model,
      system: updateDocumentPrompt(document.content, "code"),
      prompt: description,
      schema: z.object({
        code: z.string(),
      }),
    });

    for await (const delta of fullStream) {
      const { type } = delta;

      if (type === "object") {
        const { object } = delta;
        const { code } = object;

        if (code) {
          dataStream.write({
            type: "data-codeDelta",
            data: { value: code ?? "", chatId },
            transient: true,
          });

          draftContent = code;
        }
      }
    }

    return draftContent;
  },
});
