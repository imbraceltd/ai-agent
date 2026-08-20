import { Router } from "express";
import {
  handleGetAllChats,
  handleGetChatById,
  handleDeleteChat,
  handleGetAgentPromptSuggestion,
} from "@/controllers/chatController";
import type { Router as RouterType } from "express";

const router: RouterType = Router();

router.get("/", handleGetAllChats);
// V1 POST handler removed — use chatAgentV2 route instead
router.get("/get-agent-prompt-suggestion", handleGetAgentPromptSuggestion);
router.get("/:id", handleGetChatById);
router.delete("/:id", handleDeleteChat);

export default router;
