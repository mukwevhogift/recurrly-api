import { SERVER_URL } from "../config/env.js";
import { workflowClient } from "../config/upstash.js";
import Subscription from "../models/subscription.model.js";

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;

const parsePagination = (query) => {
  const parsedPage = Number.parseInt(query.page, 10);
  const parsedLimit = Number.parseInt(query.limit, 10);

  const page = Number.isNaN(parsedPage) || parsedPage < 1
    ? DEFAULT_PAGE
    : parsedPage;
  const limit = Number.isNaN(parsedLimit) || parsedLimit < 1
    ? DEFAULT_LIMIT
    : Math.min(parsedLimit, MAX_LIMIT);

  return {
    page,
    limit,
    skip: (page - 1) * limit,
  };
};

const buildPaginationMeta = ({ total, page, limit }) => {
  const totalPages = Math.ceil(total / limit) || 1;

  return {
    total,
    page,
    limit,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  };
};

const createError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const sanitizeSubscriptionInput = (payload) => {
  const nextPayload = { ...payload };
  delete nextPayload.status;
  delete nextPayload.user;
  return nextPayload;
};

const getOwnedSubscription = async (subscriptionId, userId) => {
  const subscription = await Subscription.findOne({
    _id: subscriptionId,
    user: userId,
  });

  if (!subscription) {
    throw createError("Subscription not found", 404);
  }

  return subscription;
};

// GET authenticated user's subscriptions
export const getSubscriptions = async (req, res, next) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const filter = { user: req.user._id };

    const [subscriptions, total] = await Promise.all([
      Subscription.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Subscription.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      message: "Subscriptions fetched successfully",
      data: subscriptions,
      pagination: buildPaginationMeta({ total, page, limit }),
    });
  } catch (error) {
    next(error);
  }
};

// GET subscription by id
export const getSubscription = async (req, res, next) => {
  try {
    const subscription = await getOwnedSubscription(req.params.id, req.user._id);

    res.status(200).json({
      success: true,
      message: "Subscription fetched successfully",
      data: subscription,
    });
  } catch (error) {
    next(error);
  }
};

// POST create subscription
export const createSubscription = async (req, res, next) => {
  try {
    const subscription = await Subscription.create({
      ...sanitizeSubscriptionInput(req.body),
      user: req.user._id,
    });

    const { workflowRunId } = await workflowClient.trigger({
      url: `${SERVER_URL}/api/v1/workflows/subscription/reminder`,
      body: {
        subscriptionId: subscription.id,
      },
      headers: {
        "content-type": "application/json",
      },
      retries: 0,
    });

    res.status(201).json({
      success: true,
      message: "Subscription created successfully",
      data: {
        subscription,
        workflowRunId,
      },
    });
  } catch (error) {
    next(error);
  }
};

// PUT update subscription by id
export const updateSubscription = async (req, res, next) => {
  try {
    const subscription = await Subscription.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      sanitizeSubscriptionInput(req.body),
      { new: true, runValidators: true }
    );

    if (!subscription) {
      throw createError("Subscription not found", 404);
    }

    res.status(200).json({
      success: true,
      message: "Subscription updated successfully",
      data: subscription,
    });
  } catch (error) {
    next(error);
  }
};

// DELETE delete subscription by id
export const deleteSubscription = async (req, res, next) => {
  try {
    const subscription = await Subscription.findOneAndDelete({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!subscription) {
      throw createError("Subscription not found", 404);
    }

    res.status(200).json({
      success: true,
      message: "Subscription deleted successfully",
      data: subscription,
    });
  } catch (error) {
    next(error);
  }
};

// GET all subscriptions for a user
export const getUserSubscriptions = async (req, res, next) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);

    if (req.user.id !== req.params.id) {
      throw createError("You are not the owner of this subscription", 403);
    }

    const filter = { user: req.params.id };
    const [subscriptions, total] = await Promise.all([
      Subscription.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Subscription.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      message: "User Subscriptions fetched successfully",
      data: subscriptions,
      pagination: buildPaginationMeta({ total, page, limit }),
    });
  } catch (error) {
    next(error);
  }
};

// PUT cancel subscription of a user
export const cancelSubscription = async (req, res, next) => {
  try {
    const subscription = await getOwnedSubscription(req.params.id, req.user._id);

    subscription.status = "cancelled";
    await subscription.save();

    res.status(200).json({
      success: true,
      message: "Subscription cancelled successfully",
      data: subscription,
    });
  } catch (error) {
    next(error);
  }
};

// GET upcoming renewals subscriptions of a user
export const getUpcomingRenewals = async (req, res, next) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);

    const filter = {
      user: req.user._id,
      status: "active",
      renewalDate: { $gte: new Date() },
    };
    const [subscriptions, total] = await Promise.all([
      Subscription.find(filter)
        .sort({ renewalDate: 1 })
        .skip(skip)
        .limit(limit),
      Subscription.countDocuments(filter),
    ]);

    res
      .status(200)
      .json({
        success: true,
        message: "Upcoming renewals fetched successfully",
        data: subscriptions,
        pagination: buildPaginationMeta({ total, page, limit }),
      });
  } catch (error) {
    next(error);
  }
};
