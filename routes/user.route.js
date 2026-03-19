import { Router } from "express";

import authorize from "../middlewares/auth.middleware.js";
import { getCurrentUser, getUser } from "../controllers/user.controller.js";

const userRouter = Router();

userRouter.use(authorize);

// GET current user
userRouter.get("/me", getCurrentUser);

// GET user by id
userRouter.get("/:id", getUser);

export default userRouter;
