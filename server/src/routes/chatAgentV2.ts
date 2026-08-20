import { Router } from "express";
import { handleChatV2 } from "@/controllers/chatController";
import { chatClientAuth } from "@/middleware/chatClientAuth";
import type { Router as RouterType } from "express";

const router: RouterType = Router();

// Reason: chatClientAuth verifies the imbrace token via app-gateway and resolves
// the caller to a local PostgreSQL user (req.chatClientUser.id is a real UUID).
// Without it, handleChatV2 falls back to body.user_id which is the imbrace `u_<uuid>`
// format and fails Zod's .uuid() check inside ensureChatExists → 500.
router.post("/", chatClientAuth, handleChatV2);

export default router;
