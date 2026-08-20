import { Response as ExpressResponse } from "express";

/**
 * Converts a Web API Response object to an Express Response
 * This allows you to return Response objects like in Next.js/Vercel
 * 
 * @param webResponse - Web API Response from AI SDK
 * @param expressRes - Express Response object
 */
export async function sendWebResponse(
  webResponse: Response,
  expressRes: ExpressResponse
): Promise<void> {
  // Copy headers from Web API Response to Express Response
  webResponse.headers.forEach((value, key) => {
    expressRes.setHeader(key, value);
  });

  // Set status code
  expressRes.status(webResponse.status);

  // If there's no body, end the response
  if (!webResponse.body) {
    expressRes.end();
    return;
  }

  // Stream the body to Express response
  const reader = webResponse.body.getReader();
  const decoder = new TextDecoder();

  try {
    let done = false;
    while (!done) {
      const chunk = await reader.read();
      done = chunk.done;
      if (!done && chunk.value) {
        // Handle both string chunks (from JsonToSseTransformStream) and binary chunks
        const data = typeof chunk.value === 'string' 
          ? chunk.value 
          : decoder.decode(chunk.value, { stream: true });
        
        expressRes.write(data);
      }
    }
  } catch (error) {
    console.error("Error streaming response:", error);
    if (!expressRes.writableEnded) {
      expressRes.write(
        `data: ${JSON.stringify({
          type: "error",
          error: error instanceof Error ? error.message : "Stream error",
        })}\n\n`
      );
    }
  } finally {
    if (!expressRes.writableEnded) {
      expressRes.end();
    }
  }
}

