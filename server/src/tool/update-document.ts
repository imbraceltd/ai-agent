import { tool, type UIMessageStreamWriter } from "ai";
import { z } from "zod";
import { documentHandlersByArtifactKind } from "@/artifacts/server";
import { getDocumentById } from "@/artifacts/queries";


type UpdateDocumentProps = {
  userId: string;
  dataStream: UIMessageStreamWriter<any>;
  model: any;
  chatId: string;
};

export const updateDocument = ({ userId, dataStream, model, chatId }: UpdateDocumentProps) =>
  tool({
    description: "Update an existing document with the given description. IMPORTANT: When a user asks to modify, add features, fix bugs, or change ANYTHING about an existing document, you MUST use this tool. NEVER paste code in chat instead. Only call this tool ONCE per user request.",
    inputSchema: z.object({
      id: z.string().describe("The ID of the document to update"),
      description: z
        .string()
        .describe("The description of changes that need to be made"),
    }),
    execute: async ({ id, description }) => {
      const document = await getDocumentById({ id });

      if (!document) {
        return {
          error: "Document not found",
        };
      }

      dataStream.write({
        type: "data-clear",
        data: { chatId },
        transient: true,
      });

      const documentHandler = documentHandlersByArtifactKind.find(
        (documentHandlerByArtifactKind) =>
          documentHandlerByArtifactKind.kind === document.kind
      );

      if (!documentHandler) {
        throw new Error(`No document handler found for kind: ${document.kind}`);
      }

      await documentHandler.onUpdateDocument({
        document,
        description,
        dataStream,
        userId,
        model,
        chatId,
      });

      dataStream.write({ type: "data-finish", data: { chatId }, transient: true });

      return {
        id,
        title: document.title,
        kind: document.kind,
        chatId,
        content: "The document has been updated successfully.",
      };
    },
  });
