import { streamObject } from "ai";
import { z } from "zod";
import { sheetPrompt, updateDocumentPrompt } from "@/artifacts/lib/prompts";
import { createDocumentHandler } from "@/artifacts/server";

export const sheetDocumentHandler = createDocumentHandler<"sheet">({
  kind: "sheet",
  onCreateDocument: async ({ title, dataStream, model, chatId }) => {
    let draftContent = "";

    if (!model) {
      throw new Error("Missing model for sheet artifact generation");
    }

    const { fullStream } = streamObject({
      model,
      system: sheetPrompt,
      prompt: title,
      schema: z.object({
        csv: z.string().describe("CSV data"),
      }),
    });

    for await (const delta of fullStream) {
      const { type } = delta;

      if (type === "object") {
        const { object } = delta;
        const { csv } = object;

        if (csv) {
          dataStream.write({
            type: "data-sheetDelta",
            data: { value: csv, chatId },
            transient: true,
          });

          draftContent = csv;
        }
      }
    }

    dataStream.write({
      type: "data-sheetDelta",
      data: { value: draftContent, chatId },
      transient: true,
    });

    return draftContent;
  },
  onUpdateDocument: async ({ document, description, dataStream, model, chatId }) => {
    let draftContent = "";

    if (!model) {
      throw new Error("Missing model for sheet artifact update");
    }

    const { fullStream } = streamObject({
      model,
      system: updateDocumentPrompt(document.content, "sheet"),
      prompt: description,
      schema: z.object({
        csv: z.string(),
      }),
    });

    for await (const delta of fullStream) {
      const { type } = delta;

      if (type === "object") {
        const { object } = delta;
        const { csv } = object;

        if (csv) {
          dataStream.write({
            type: "data-sheetDelta",
            data: { value: csv, chatId },
            transient: true,
          });

          draftContent = csv;
        }
      }
    }

    return draftContent;
  },
});
