import { Router } from "express";

import { handleClerkWebhook } from "../controllers/webhook.controller.js";

const webhookRouter = Router();

webhookRouter.post("/", handleClerkWebhook);

export default webhookRouter;
