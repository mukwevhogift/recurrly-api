# SubDub API Documentation

Last updated: March 17, 2026  
API version: `v1`  
Service: `subdub`

## Overview
SubDub is an Express API for subscription tracking and renewal reminders.

### Core stack
- Runtime: Node.js
- Framework: Express 4
- Database: MongoDB + Mongoose
- Authentication: Clerk session tokens
- Background workflows: Upstash Workflow + QStash
- Email delivery: Nodemailer

## Authentication

### Current auth model
- The frontend authenticates with Clerk.
- The frontend sends a Clerk session token in `Authorization: Bearer <token>`.
- The backend verifies that token with Clerk middleware and resolves a local Mongo `User` record.
- This repo mounts `clerkMiddleware()` globally, so the backend also needs `CLERK_PUBLISHABLE_KEY` in its environment.
- `CLERK_JWT_KEY` is a different value from the publishable key. It is the Clerk JWT verification key and is optional but recommended.

### Why a local `User` record still exists
- Subscriptions reference `User` by Mongo ObjectId.
- Reminder workflows later load `subscription.user.name` and `subscription.user.email`.
- Clerk is the identity provider, but Mongo still stores app-side user data.

### Deprecated auth routes
These routes no longer perform local email/password auth:
- `POST /api/v1/auth/signup` -> `410 Gone`
- `POST /api/v1/auth/signin` -> `410 Gone`
- `POST /api/v1/auth/signout` -> informational response only

## Data Models

### User
| Field | Type | Notes |
|---|---|---|
| `clerkId` | string | Unique Clerk user id |
| `name` | string | Stored for emails and UI |
| `email` | string | Required, unique |
| `authProvider` | string | `local` or `clerk` |
| `imageUrl` | string | Optional Clerk avatar |
| `password` | string | Legacy field, no longer used for auth |

### Subscription
| Field | Type | Notes |
|---|---|---|
| `name` | string | Required |
| `price` | number | Required |
| `currency` | string | Enum |
| `frequency` | string | Enum |
| `category` | string | Enum |
| `startDate` | date | Required |
| `renewalDate` | date | Auto-computed if omitted |
| `paymentMethod` | string | Required |
| `status` | string | `active`, `cancelled`, `expired` |
| `user` | ObjectId(User) | Required |

## Endpoint Summary

### Health
- `GET /`

### Auth
- `POST /api/v1/auth/signup`
- `POST /api/v1/auth/signin`
- `POST /api/v1/auth/signout`

### Clerk webhooks
- `POST /api/v1/webhooks/clerk`

### Users
- `GET /api/v1/users/me`
- `GET /api/v1/users/:id`

### Subscriptions
- `GET /api/v1/subscriptions`
- `GET /api/v1/subscriptions/me`
- `GET /api/v1/subscriptions/user/:id`
- `GET /api/v1/subscriptions/upcoming-renewals`
- `GET /api/v1/subscriptions/me/upcoming-renewals`
- `GET /api/v1/subscriptions/:id`
- `POST /api/v1/subscriptions`
- `PUT /api/v1/subscriptions/:id`
- `DELETE /api/v1/subscriptions/:id`
- `PUT /api/v1/subscriptions/:id/cancel`

## Endpoint Details

### `GET /api/v1/users/me`
Returns the current authenticated user.

Auth: Yes

### `GET /api/v1/users/:id`
Returns the current user only when `:id` matches the authenticated Mongo user id.

Auth: Yes

### `GET /api/v1/subscriptions`
Returns the authenticated user's subscriptions.

Auth: Yes

Query params:
- `page`
- `limit`

### `GET /api/v1/subscriptions/me`
Alias of `GET /api/v1/subscriptions`.

Auth: Yes

### `GET /api/v1/subscriptions/user/:id`
Compatibility route for older clients. Only works when `:id` matches the authenticated Mongo user id.

Auth: Yes

### `GET /api/v1/subscriptions/upcoming-renewals`
Returns the authenticated user's active upcoming renewals.

Auth: Yes

### `GET /api/v1/subscriptions/me/upcoming-renewals`
Alias of `GET /api/v1/subscriptions/upcoming-renewals`.

Auth: Yes

### `GET /api/v1/subscriptions/:id`
Returns one subscription owned by the authenticated user.

Auth: Yes

### `POST /api/v1/subscriptions`
Creates a subscription for the authenticated user and triggers the reminder workflow.

Auth: Yes

### `PUT /api/v1/subscriptions/:id`
Updates a subscription owned by the authenticated user.

Auth: Yes

Notes:
- `user` and `status` are server-controlled.

### `DELETE /api/v1/subscriptions/:id`
Deletes a subscription owned by the authenticated user.

Auth: Yes

### `PUT /api/v1/subscriptions/:id/cancel`
Cancels a subscription owned by the authenticated user.

Auth: Yes

### `POST /api/v1/webhooks/clerk`
Processes Clerk user webhooks.

Behavior:
- `user.created` and `user.updated` upsert the local Mongo user.
- `user.deleted` deletes the local user and their subscriptions.

Security:
- Requires valid Clerk webhook signature headers.
- Must receive the raw request body.

## Environment Variables
| Variable | Required | Description |
|---|---|---|
| `PORT` | Yes | HTTP server port |
| `SERVER_URL` | Yes | Public server URL |
| `DB_URI` | Yes | MongoDB connection string |
| `CLERK_SECRET_KEY` | Yes | Clerk backend secret key (`sk_*`) |
| `CLERK_PUBLISHABLE_KEY` | Yes | Clerk publishable key (`pk_*`). Required in this repo because Clerk middleware is mounted globally in the API |
| `CLERK_JWT_KEY` | Recommended | Clerk JWT verification key. This is not the publishable key. Enables networkless token verification |
| `CLERK_WEBHOOK_SIGNING_SECRET` | Yes | Clerk webhook secret |
| `CLERK_AUTHORIZED_PARTIES` | Recommended | Comma-separated allowed frontend origins for Clerk tokens |
| `CORS_ORIGINS` | Recommended | Comma-separated browser origins allowed to call the API |
| `QSTASH_URL` | Yes | Upstash QStash base URL |
| `QSTASH_TOKEN` | Yes | Upstash token |
| `QSTASH_CURRENT_SIGNING_KEY` | Yes | Current QStash signing key |
| `QSTASH_NEXT_SIGNING_KEY` | Yes | Next QStash signing key |
| `EMAIL_PASSWORD` | Yes | Gmail app password |

## Example Request

```bash
curl -X GET http://localhost:5500/api/v1/users/me \
  -H "Authorization: Bearer <clerk_session_token>"
```

## Notes
- Local email/password authentication has been removed from the backend.
- The app still keeps Mongo users because subscriptions and reminder emails depend on them.
- `scripts/test-reminder.sh` now expects a Clerk session token instead of calling `/auth/signin`.
- If `CLERK_JWT_KEY` is omitted, Clerk token verification can still work, but networkless verification is not enabled.
