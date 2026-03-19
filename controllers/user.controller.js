import User from "../models/user.model.js";

const createForbiddenError = (message) => {
  const error = new Error(message);
  error.statusCode = 403;
  return error;
};

export const getCurrentUser = async (req, res, next) => {
  try {
    res.status(200).json({
      success: true,
      message: "Current user fetched successfully",
      data: req.user,
    });
  } catch (error) {
    next(error);
  }
};

export const getUser = async (req, res, next) => {
  try {
    if (req.user.id !== req.params.id) {
      throw createForbiddenError("You can only access your own user record");
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      const error = new Error("User not found");
      error.statusCode = 404;
      throw error;
    }
    res.status(200).json({
      success: true,
      message: "User fetched successfully",
      data: user,
    });
  } catch (error) {
    next(error);
  }
};
