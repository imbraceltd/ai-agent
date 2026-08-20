import {
  ReasoningHandler,
  ReasoningContext,
  ToolCallInfo,
  StepResult,
} from ".";
import sessionModel, { ReasoningData } from "../../models/sessionModel";

/**
 * Factory function to create reasoning handlers
 */
export function createReasoningHandler(
  type: "logging" | "database" = "logging",
  logger?: any
): ReasoningHandler {
  switch (type) {
    case "database":
      return new DatabaseReasoningHandler(logger);
    case "logging":
    default:
      return new LoggingReasoningHandler(logger);
  }
}

/**
 * Logging implementation of ReasoningHandler abstract class
 * Uses structured logging to track reasoning flow
 */
export class LoggingReasoningHandler extends ReasoningHandler {
  private logger: any;

  constructor(logger?: any) {
    super();
    this.logger = logger || console;
  }

  /**
   * Initialize the logging handler
   */
  override initialize(): void {
    this.logger.info("LoggingReasoningHandler initialized");
  }

  /**
   * Log reasoning text with context
   */
  override handleReasoning(reasoning: string, context: ReasoningContext): void {
    if (!reasoning) return;

    this.logger.info("AI Reasoning Step:", {
      sessionId: context.sessionId,
      stepId: context.stepId,
      timestamp: context.timestamp,
      reasoning: reasoning,
      finishReason: context.finishReason,
      usage: context.usage,
    });
  }

  /**
   * Log reasoning associated with tool calls
   */
  override handleToolReasoning(
    reasoning: string,
    toolCall: ToolCallInfo,
    context: ReasoningContext
  ): void {
    if (!reasoning) return;

    this.logger.info("Tool Call Reasoning:", {
      sessionId: context.sessionId,
      stepId: context.stepId,
      timestamp: context.timestamp,
      toolName: toolCall.toolName,
      reasoning: reasoning,
      hasInput: !!toolCall.input,
      hasOutput: !!toolCall.output,
      usage: context.usage,
    });
  }

  /**
   * Log step completion with summary
   */
  override handleStepCompletion(stepResult: StepResult): void {
    const toolCalls =
      stepResult.content?.filter((item) => item.type === "tool-call") || [];

    const reasoning = stepResult.content?.find(
      (item) => item.type === "reasoning"
    )?.text;

    this.logger.info("Step Completion Summary:", {
      stepId: stepResult.stepId,
      hasReasoning: !!reasoning,
      toolCallCount: toolCalls.length,
      toolNames: toolCalls.map((tc) => tc.toolName),
      finishReason: stepResult.finishReason,
      usage: stepResult.usage,
    });
  }

  /**
   * Cleanup resources
   */
  override dispose(): void {
    this.logger.info("LoggingReasoningHandler disposed");
  }
}

/**
 * Database implementation of ReasoningHandler abstract class
 * Stores reasoning data in a database for analysis and audit
 */
export class DatabaseReasoningHandler extends ReasoningHandler {
  private logger: any;
  private isInitialized: boolean = false;

  constructor(logger?: any) {
    super();
    this.logger = logger || console;
  }

  /**
   * Initialize database connections and models
   */
  override async initialize(): Promise<void> {
    try {
      // Database connection is already established via connectDB in ai-agent.ts
      this.isInitialized = true;
      this.logger.info("DatabaseReasoningHandler initialized");
    } catch (error) {
      this.logger.error(
        "Failed to initialize DatabaseReasoningHandler:",
        error
      );
      throw error;
    }
  }

  /**
   * Store reasoning in database
   */
  override async handleReasoning(
    reasoning: string,
    context: ReasoningContext
  ): Promise<void> {
    if (!reasoning || !this.isInitialized) return;

    try {
      const reasoningData: ReasoningData = {
        reasoning: reasoning,
        timestamp: context.timestamp,
        type: "general",
        ...(context.stepId && { stepId: context.stepId }),
        ...(context.finishReason && { finishReason: context.finishReason }),
        ...(context.usage && { usage: context.usage }),
      };

      // Add reasoning data to the session's reasoning array
      await sessionModel.findOneAndUpdate(
        { sessionId: context.sessionId },
        { $push: { reasoning: reasoningData } },
        { upsert: true }
      );

      this.logger.info("Reasoning saved to session database", {
        sessionId: context.sessionId,
        stepId: context.stepId,
      });
    } catch (error) {
      this.logger.error("Failed to save reasoning to database:", error);
      throw error;
    }
  }

  /**
   * Store tool-specific reasoning in database
   */
  override async handleToolReasoning(
    reasoning: string,
    toolCall: ToolCallInfo,
    context: ReasoningContext
  ): Promise<void> {
    if (!reasoning || !this.isInitialized) return;

    try {
      const reasoningData: ReasoningData = {
        reasoning: reasoning,
        timestamp: context.timestamp,
        type: "tool-call",
        toolName: toolCall.toolName,
        toolInput: toolCall.input,
        toolOutput: toolCall.output,
        ...(context.stepId && { stepId: context.stepId }),
        ...(context.finishReason && { finishReason: context.finishReason }),
        ...(context.usage && { usage: context.usage }),
      };

      // Add tool reasoning data to the session's reasoning array
      await sessionModel.findOneAndUpdate(
        { sessionId: context.sessionId },
        { $push: { reasoning: reasoningData } },
        { upsert: true }
      );

      this.logger.info("Tool reasoning saved to session database", {
        sessionId: context.sessionId,
        toolName: toolCall.toolName,
      });
    } catch (error) {
      this.logger.error("Failed to save tool reasoning to database:", error);
      throw error;
    }
  }

  /**
   * Track step completion in database
   */
  override async handleStepCompletion(stepResult: StepResult): Promise<void> {
    if (!this.isInitialized) return;

    try {
      const toolCalls =
        stepResult.content?.filter((item) => item.type === "tool-call") || [];
      const reasoning = stepResult.content?.find(
        (item) => item.type === "reasoning"
      )?.text;

      this.logger.info("Step completion tracked", {
        stepId: stepResult.stepId,
        hasReasoning: !!reasoning,
        toolCallCount: toolCalls.length,
        finishReason: stepResult.finishReason,
      });
    } catch (error) {
      this.logger.error("Failed to track step completion:", error);
      throw error;
    }
  }

  /**
   * Cleanup database connections and resources
   */
  override async dispose(): Promise<void> {
    try {
      // Database connection cleanup is handled elsewhere
      this.isInitialized = false;
      this.logger.info("DatabaseReasoningHandler disposed");
    } catch (error) {
      this.logger.error("Error disposing DatabaseReasoningHandler:", error);
    }
  }
}
