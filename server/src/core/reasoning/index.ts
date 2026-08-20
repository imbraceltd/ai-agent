/**
 * Data types for reasoning system (equivalent to DTOs in .NET)
 */

import { TokenUsage } from "../../models/sessionModel";

/**
 * Context information for reasoning processing
 */
export type ReasoningContext = {
  sessionId: string;
  stepId?: string | number;
  timestamp: string;
  finishReason?: string;
  usage?: TokenUsage;
};

/**
 * Information about a tool call
 */
export type ToolCallInfo = {
  toolName: string;
  input: any;
  output?: any;
};

/**
 * Content item structure
 */
export type ContentItem = {
  type: string;
  text?: string;
  toolCallId?: string;
  toolName?: string;
  input?: any;
  output?: any;
};

/**
 * Step result structure
 */
export type StepResult = {
  stepId?: string | number;
  content?: ContentItem[];
  finishReason?: string;
  usage?: TokenUsage;
};

/**
 * Tool result data structure
 */
export type ToolResult = {
  stepId: string | number;
  toolCallId: string;
  toolName: string;
  input: any;
  output?: any;
  reasoning?: string;
  timestamp: string;
  sessionId: string;
  finishReason?: string;
  usage?: TokenUsage;
};

/**
 * Abstract base class for handling reasoning (equivalent to interface in .NET)
 * All reasoning handlers must implement these methods
 */
export abstract class ReasoningHandler {
  /**
   * Process reasoning text from a step result
   * @param reasoning - The reasoning text extracted from the AI model
   * @param context - Additional context about the reasoning step
   */
  abstract handleReasoning(
    reasoning: string,
    context: ReasoningContext
  ): Promise<void> | void;

  /**
   * Process reasoning associated with a tool call
   * @param reasoning - The reasoning text that led to the tool call
   * @param toolCall - Information about the tool call
   * @param context - Additional context
   */
  abstract handleToolReasoning(
    reasoning: string,
    toolCall: ToolCallInfo,
    context: ReasoningContext
  ): Promise<void> | void;

  /**
   * Handle completion of a reasoning step
   * @param stepResult - The complete step result
   */
  abstract handleStepCompletion(stepResult: StepResult): Promise<void> | void;

  /**
   * Optional: Initialize the reasoning handler
   * Virtual method that can be overridden
   */
  initialize?(): Promise<void> | void;

  /**
   * Optional: Cleanup resources
   * Virtual method that can be overridden
   */
  dispose?(): Promise<void> | void;
}
