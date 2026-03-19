const authRemovedMessage =
  "Local email/password auth has been removed. Sign in with Clerk on the frontend and send the Clerk session token to this API.";

export const signup = (req, res) => {
  res.status(410).json({
    success: false,
    message: authRemovedMessage,
  });
};

export const signin = (req, res) => {
  res.status(410).json({
    success: false,
    message: authRemovedMessage,
  });
};

export const signout = (req, res) => {
  res.status(200).json({
    success: true,
    message: "Sign out is handled by Clerk on the frontend.",
  });
};
