import { clerkClient } from "@clerk/express";

import Subscription from "../models/subscription.model.js";
import User from "../models/user.model.js";

const getPrimaryEmailAddress = (clerkUser) => {
  const primaryEmailAddressId =
    clerkUser.primaryEmailAddressId || clerkUser.primary_email_address_id;
  const emailAddresses = clerkUser.emailAddresses || clerkUser.email_addresses || [];
  const primaryEmail =
    emailAddresses.find((emailAddress) => emailAddress.id === primaryEmailAddressId) ||
    emailAddresses[0];

  return (
    primaryEmail?.emailAddress ||
    primaryEmail?.email_address ||
    null
  );
};

const buildUserName = ({ firstName, lastName, username, email }) => {
  const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();

  if (fullName.length >= 2) {
    return fullName;
  }

  if (username && username.trim().length >= 2) {
    return username.trim();
  }

  const emailPrefix = email.split("@")[0].replace(/[._-]+/g, " ").trim();
  if (emailPrefix.length >= 2) {
    return emailPrefix;
  }

  return "Clerk User";
};

const normalizeClerkUser = (clerkUser) => {
  const email = getPrimaryEmailAddress(clerkUser)?.trim().toLowerCase();
  if (!email) {
    const error = new Error("Clerk user does not have a primary email address");
    error.statusCode = 400;
    throw error;
  }

  const firstName = clerkUser.firstName || clerkUser.first_name;
  const lastName = clerkUser.lastName || clerkUser.last_name;
  const username = clerkUser.username || null;

  return {
    clerkId: clerkUser.id,
    email,
    imageUrl: clerkUser.imageUrl || clerkUser.image_url || "",
    name: buildUserName({
      firstName,
      lastName,
      username,
      email,
    }),
  };
};

export const syncUserFromClerk = async (clerkUser) => {
  const normalizedUser = normalizeClerkUser(clerkUser);
  const existingByClerkId = await User.findOne({ clerkId: normalizedUser.clerkId });

  if (existingByClerkId) {
    existingByClerkId.name = normalizedUser.name;
    existingByClerkId.email = normalizedUser.email;
    existingByClerkId.imageUrl = normalizedUser.imageUrl;
    existingByClerkId.authProvider = "clerk";
    await existingByClerkId.save();
    return existingByClerkId;
  }

  const existingByEmail = await User.findOne({ email: normalizedUser.email });
  if (existingByEmail) {
    if (
      existingByEmail.clerkId &&
      existingByEmail.clerkId !== normalizedUser.clerkId
    ) {
      const error = new Error("A different Clerk account is already linked to this email");
      error.statusCode = 409;
      throw error;
    }

    existingByEmail.clerkId = normalizedUser.clerkId;
    existingByEmail.name = normalizedUser.name;
    existingByEmail.imageUrl = normalizedUser.imageUrl;
    existingByEmail.authProvider = "clerk";
    await existingByEmail.save();
    return existingByEmail;
  }

  return User.create({
    ...normalizedUser,
    authProvider: "clerk",
  });
};

export const syncUserFromClerkId = async (clerkUserId) => {
  const clerkUser = await clerkClient.users.getUser(clerkUserId);
  return syncUserFromClerk(clerkUser);
};

export const deleteUserForClerkId = async (clerkUserId) => {
  const user = await User.findOneAndDelete({ clerkId: clerkUserId });
  if (!user) {
    return null;
  }

  await Subscription.deleteMany({ user: user._id });
  return user;
};
