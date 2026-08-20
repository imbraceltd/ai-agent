import { smoothStream, streamText } from "ai";
import { vibeCodePrompt, updateDocumentPrompt } from "@/artifacts/lib/prompts";
import { createDocumentHandler } from "@/artifacts/server";
import { VibeCodeStreamingParser } from "./parser";

/**
 * Convert simplified DB format back to boltAction format for AI prompt context.
 */
function convertToBoltFormat(simple: string): string {
  return simple
    .replace(/<project([^>]*)>/g, (_m, attrs) => `<boltArtifact${attrs}>`)
    .replace(/<\/project>/g, "</boltArtifact>")
    .replace(
      /<file\s+path="([^"]+)">([\s\S]*?)<\/file>/g,
      (_m, path, content) =>
        `<boltAction type="file" filePath="${path}">${content}</boltAction>`,
    )
    .replace(
      /<shell>([\s\S]*?)<\/shell>/g,
      (_m, content) => `<boltAction type="shell">${content}</boltAction>`,
    )
    .replace(
      /<start>([\s\S]*?)<\/start>/g,
      (_m, content) => `<boltAction type="start">${content}</boltAction>`,
    );
}

/**
 * Convert boltArtifact/boltAction XML to simplified <file>/<shell>/<start> format for DB storage.
 */
function convertToSimpleFormat(raw: string): string {
  return raw
    .replace(/<boltArtifact([^>]*)>/g, (_m, attrs) => {
      const id = attrs.match(/id="([^"]*)"/)?.[1] ?? "";
      const title = attrs.match(/title="([^"]*)"/)?.[1] ?? "";
      return `<project id="${id}" title="${title}">`;
    })
    .replace(/<\/boltArtifact>/g, "</project>")
    .replace(
      /<boltAction\s+type="file"\s+filePath="([^"]+)">([\s\S]*?)<\/boltAction>/g,
      (_m, path, content) => `<file path="${path}">${content}</file>`,
    )
    .replace(
      /<boltAction\s+type="shell">([\s\S]*?)<\/boltAction>/g,
      (_m, content) => `<shell>${content}</shell>`,
    )
    .replace(
      /<boltAction\s+type="start">([\s\S]*?)<\/boltAction>/g,
      (_m, content) => `<start>${content}</start>`,
    );
}

/**
 * Document handler for the "vibe-code" artifact kind.
 * Generates multi-file web application projects using boltArtifact/boltAction XML format.
 * The AI output is parsed server-side and emitted as structured stream events
 * that the client uses to drive a WebContainer runtime.
 */
// export const vibeCodeDocumentHandler = createDocumentHandler<"vibe-code">({
//   kind: "vibe-code",

//   onCreateDocument: async ({ title, description, dataStream, model, chatId }) => {
//     let draftContent = "";

//     if (!model) {
//       throw new Error("Missing model for vibe-code artifact generation");
//     }

//     const parser = new VibeCodeStreamingParser({
//       onArtifactOpen: (data) => {
//         dataStream.write({
//           type: "data-vibeCodeDelta",
//           data: {
//             action: "artifact-open",
//             artifactId: data.artifactId,
//             title: data.title,
//             chatId,
//           },
//           transient: true,
//         });
//       },
//       onArtifactClose: (data) => {
//         dataStream.write({
//           type: "data-vibeCodeDelta",
//           data: {
//             action: "artifact-close",
//             artifactId: data.artifactId,
//             chatId,
//           },
//           transient: true,
//         });
//       },
//       onActionOpen: (data) => {
//         dataStream.write({
//           type: "data-vibeCodeDelta",
//           data: {
//             action: "action-open",
//             actionId: data.actionId,
//             actionType: data.action.type,
//             filePath: data.action.type === "file" ? data.action.filePath : undefined,
//             chatId,
//           },
//           transient: true,
//         });
//       },
//       onActionStream: (data) => {
//         dataStream.write({
//           type: "data-vibeCodeDelta",
//           data: {
//             action: "action-stream",
//             actionId: data.actionId,
//             actionType: data.action.type,
//             filePath: data.action.type === "file" ? data.action.filePath : undefined,
//             content: data.action.content,
//             chatId,
//           },
//           transient: true,
//         });
//       },
//       onActionClose: (data) => {
//         dataStream.write({
//           type: "data-vibeCodeDelta",
//           data: {
//             action: "action-close",
//             actionId: data.actionId,
//             actionType: data.action.type,
//             filePath: data.action.type === "file" ? data.action.filePath : undefined,
//             content: data.action.content,
//             chatId,
//           },
//           transient: true,
//         });
//       },
//     });

//     const { fullStream } = streamText({
//       model,
//       system: vibeCodePrompt,
//       experimental_transform: smoothStream({ chunking: "word" }),
//       prompt: description || title,
//     });

//     for await (const delta of fullStream) {
//       if (delta.type === "text-delta") {
//         draftContent += delta.text;
//         parser.parse("msg", draftContent);
//       }
//     }

//     return convertToSimpleFormat(draftContent);
//   },

//   onUpdateDocument: async ({ document, description, dataStream, model, chatId }) => {
//     let draftContent = "";

//     if (!model) {
//       throw new Error("Missing model for vibe-code artifact update");
//     }

//     const parser = new VibeCodeStreamingParser({
//       onArtifactOpen: (data) => {
//         dataStream.write({
//           type: "data-vibeCodeDelta",
//           data: {
//             action: "artifact-open",
//             artifactId: data.artifactId,
//             title: data.title,
//             chatId,
//           },
//           transient: true,
//         });
//       },
//       onArtifactClose: (data) => {
//         dataStream.write({
//           type: "data-vibeCodeDelta",
//           data: {
//             action: "artifact-close",
//             artifactId: data.artifactId,
//             chatId,
//           },
//           transient: true,
//         });
//       },
//       onActionOpen: (data) => {
//         dataStream.write({
//           type: "data-vibeCodeDelta",
//           data: {
//             action: "action-open",
//             actionId: data.actionId,
//             actionType: data.action.type,
//             filePath: data.action.type === "file" ? data.action.filePath : undefined,
//             chatId,
//           },
//           transient: true,
//         });
//       },
//       onActionStream: (data) => {
//         dataStream.write({
//           type: "data-vibeCodeDelta",
//           data: {
//             action: "action-stream",
//             actionId: data.actionId,
//             actionType: data.action.type,
//             filePath: data.action.type === "file" ? data.action.filePath : undefined,
//             content: data.action.content,
//             chatId,
//           },
//           transient: true,
//         });
//       },
//       onActionClose: (data) => {
//         dataStream.write({
//           type: "data-vibeCodeDelta",
//           data: {
//             action: "action-close",
//             actionId: data.actionId,
//             actionType: data.action.type,
//             filePath: data.action.type === "file" ? data.action.filePath : undefined,
//             content: data.action.content,
//             chatId,
//           },
//           transient: true,
//         });
//       },
//     });

//     const { fullStream } = streamText({
//       model,
//       system: updateDocumentPrompt(convertToBoltFormat(document.content ?? "")      experimental_transform: smoothStream({ chunking: "word" }),
//       prompt: description,
//     });

//     for await (const delta of fullStream) {
//       if (delta.type === "text-delta") {
//         draftContent += delta.text;
//         parser.parse("msg", draftContent);
//       }
//     }

//     return convertToSimpleFormat(draftContent);
//   },
// });
