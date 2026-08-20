import { smoothStream, streamText } from "ai";
import { updateDocumentPrompt } from "@/artifacts/lib/prompts";
import { createDocumentHandler } from "@/artifacts/server";

export const textDocumentHandler = createDocumentHandler<"text">({
  kind: "text",
  onCreateDocument: async ({ title, dataStream, model, chatId }) => {
    let draftContent = "";

    if (!model) {
      throw new Error("Missing model for text artifact generation");
    }

    const { fullStream } = streamText({
      model,
      system:
        "Write about the given topic. Markdown is supported. Use headings wherever appropriate.",
      experimental_transform: smoothStream({ chunking: "word" }),
      prompt: title,
    });

    for await (const delta of fullStream) {
      const { type } = delta;

      if (type === "text-delta") {
        const { text } = delta;

        draftContent += text;

        dataStream.write({
          type: "data-textDelta",
          data: { value: text, chatId },
          transient: true,
        });
      }
    }

    return draftContent;
  },
  onUpdateDocument: async ({ document, description, dataStream, model, chatId }) => {
    let draftContent = "";

    if (!model) {
      throw new Error("Missing model for text artifact update");
    }

    const { fullStream } = streamText({
      model,
      system: updateDocumentPrompt(document.content, "text"),
      experimental_transform: smoothStream({ chunking: "word" }),
      prompt: description,
      providerOptions: {
        openai: {
          prediction: {
            type: "content",
            content: document.content,
          },
        },
      },
    });

    for await (const delta of fullStream) {
      const { type } = delta;

      if (type === "text-delta") {
        const { text } = delta;

        draftContent += text;

        dataStream.write({
          type: "data-textDelta",
          data: { value: text, chatId },
          transient: true,
        });
      }
    }

    return draftContent;
  },
});
