import { tool, type UIMessageStreamWriter } from "ai";
import { z } from "zod";
import {
  artifactKinds,
  documentHandlersByArtifactKind,
} from "../artifacts/server";
import { generateUUID } from "@/lib/utils";

type CreateDocumentProps = {
  userId: string;
  dataStream: any;
  model: any;
  chatId: string;
};

export const createDocument = ({
  userId,
  dataStream,
  model,
  chatId,
}: CreateDocumentProps) =>
  tool({
    description:
      "Create a document for a writing or content creation activities. This tool will call other functions that will generate the contents of the document based on the title and kind.",
    inputSchema: z.object({
      title: z.string(),
      kind: z.enum(artifactKinds),
      description: z
        .string()
        .optional()
        .describe("Detailed requirements for the document."),
    }),
    execute: async ({ title, kind, description }) => {
      const id = generateUUID();

      dataStream.write({
        type: "data-kind",
        data: { value: kind, chatId },
        transient: true,
      });

      dataStream.write({
        type: "data-id",
        data: { value: id, chatId },
        transient: true,
      });

      dataStream.write({
        type: "data-title",
        data: { value: title, chatId },
        transient: true,
      });

      dataStream.write({
        type: "data-clear",
        data: { chatId },
        transient: true,
      });

      const documentHandler = documentHandlersByArtifactKind.find(
        (documentHandlerByArtifactKind) =>
          documentHandlerByArtifactKind.kind === kind,
      );

      if (!documentHandler) {
        throw new Error(`No document handler found for kind: ${kind}`);
      }

      await documentHandler.onCreateDocument({
        id,
        title,
        description,
        dataStream,
        userId,
        model,
        chatId,
      });

      dataStream.write({
        type: "data-finish",
        data: { chatId },
        transient: true,
      });

      return {
        id,
        title,
        kind,
        chatId,
        content: "A document was created and is now visible to the user.",
      };
    },
  });
