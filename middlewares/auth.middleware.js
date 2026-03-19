import { getAuth } from "@clerk/express";
import User from "../models/user.model.js";
import { syncUserFromClerkId } from "../utils/clerk-user.js";

const authorize = async (req, res, next) => {
  try {
    const auth = getAuth(req, { acceptsToken: "session_token" });

    if (!auth.isAuthenticated || !auth.userId) {
      return res
        .status(401)
        .json({ success: false, message: "Not authorized, no active Clerk session" });
    }

    let user = await User.findOne({ clerkId: auth.userId });
    if (!user) {
      user = await syncUserFromClerkId(auth.userId);
    }

    if (!user) {
      return res
        .status(401)
        .json({ success: false, message: "User is not provisioned in the API" });
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      message: "Not authorized",
      error: error.message,
    });
  }
};

export default authorize;
