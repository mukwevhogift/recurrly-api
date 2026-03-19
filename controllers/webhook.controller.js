import { verifyWebhook } from "@clerk/express/webhooks";

import { deleteUserForClerkId, syncUserFromClerk } from "../utils/clerk-user.js";

export const handleClerkWebhook = async (req, res, next) => {
  try {
    const event = await verifyWebhook(req);

    if (event.type === "user.created" || event.type === "user.updated") {
      await syncUserFromClerk(event.data);
    }

    if (event.type === "user.deleted" && event.data.id) {
      await deleteUserForClerkId(event.data.id);
    }

    res.status(200).json({
      success: true,
      message: "Clerk webhook processed successfully",
      data: {
        type: event.type,
      },
    });
  } catch (error) {
    next(error);
  }
};
