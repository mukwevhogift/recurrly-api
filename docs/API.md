# SubDub API

Last verified against `app.js`, routes, controllers, and models on March 26, 2026.

## Base URL

- Local: `http://localhost:5500`
- API prefix: `/api/v1`

## Authentication

Protected routes require a Clerk session token:

```http
Authorization: Bearer <clerk_session_token>
```

The backend reads the token with Clerk's Express middleware and `getAuth(req, { acceptsToken: "session_token" })`.

Common auth failures on protected routes:

### `401 Unauthorized` - no active Clerk session

```json
{
  "success": false,
  "message": "Not authorized, no active Clerk session"
}
```

### `401 Unauthorized` - Clerk user not provisioned locally

```json
{
  "success": false,
  "message": "User is not provisioned in the API"
}
```

### `401 Unauthorized` - generic auth failure

```json
{
  "success": false,
  "message": "Not authorized",
  "error": "Some Clerk error message"
}
```

## Response Conventions

### Standard success envelope

Most JSON endpoints return:

```json
{
  "success": true,
  "message": "Human-readable message",
  "data": {}
}
```

### Paginated list envelope

List endpoints add `pagination`:

```json
{
  "success": true,
  "message": "Human-readable message",
  "data": [],
  "pagination": {
    "total": 12,
    "page": 1,
    "limit": 10,
    "totalPages": 2,
    "hasNextPage": true,
    "hasPrevPage": false
  }
}
```

### Standard error envelope

Errors handled by `errorMiddleware` return:

```json
{
  "success": false,
  "message": "Human-readable error message",
  "error": "{\"statusCode\":400}"
}
```

Notes:

- The `error` field is a JSON string, not a nested JSON object.
- The exact contents of `error` are not stable. It depends on what enumerable properties existed on the thrown error.
- Some endpoints bypass `errorMiddleware` and return only `success` and `message`.

### Non-standard responses

- `GET /` returns plain text, not JSON.
- `POST /api/v1/workflows/subscription/reminder` returns Upstash Workflow JSON, not the standard API envelope.

## Resource Shapes

### User

Returned by `GET /api/v1/users/me` and `GET /api/v1/users/:id`.

| Field | Type | Notes |
| --- | --- | --- |
| `_id` | string | MongoDB ObjectId |
| `clerkId` | string | Clerk user id |
| `name` | string | 2-50 chars |
| `email` | string | Lowercased before storage |
| `authProvider` | string | `local` or `clerk` |
| `imageUrl` | string | Optional image URL |
| `createdAt` | string | ISO date-time |
| `updatedAt` | string | ISO date-time |

Example:

```json
{
  "_id": "67e2b67c8ccf0df31f0a1001",
  "clerkId": "user_2w6dQ3bJ4R8S9",
  "name": "Jane Doe",
  "email": "jane@example.com",
  "authProvider": "clerk",
  "imageUrl": "https://img.clerk.com/example.png",
  "createdAt": "2026-03-24T12:00:00.000Z",
  "updatedAt": "2026-03-24T12:00:00.000Z"
}
```

### Subscription

Returned by all subscription endpoints.

| Field | Type | Notes |
| --- | --- | --- |
| `_id` | string | MongoDB ObjectId |
| `name` | string | 2-100 chars |
| `price` | number | Must be `>= 0` |
| `currency` | string | `USD`, `EUR`, `GBP`, `INR`, `JPY`, `AUD` |
| `frequency` | string | `monthly`, `quarterly`, `yearly` |
| `category` | string | `Entertainment`, `Food`, `Health`, `Other` |
| `color` | string | Hex color, uppercased before storage, defaults to `#2563EB` |
| `startDate` | string | ISO date-time, cannot be in the future |
| `renewalDate` | string | ISO date-time, must be after `startDate` |
| `paymentMethod` | string | Free-form string |
| `status` | string | `active`, `cancelled`, `expired` |
| `user` | string | Owning user ObjectId |
| `createdAt` | string | ISO date-time |
| `updatedAt` | string | ISO date-time |

Example:

```json
{
  "_id": "67e2b8d68ccf0df31f0a2001",
  "name": "Netflix",
  "price": 15.99,
  "currency": "USD",
  "frequency": "monthly",
  "category": "Entertainment",
  "color": "#E50914",
  "startDate": "2026-03-01T00:00:00.000Z",
  "renewalDate": "2026-03-31T00:00:00.000Z",
  "paymentMethod": "Visa ending in 4242",
  "status": "active",
  "user": "67e2b67c8ccf0df31f0a1001",
  "createdAt": "2026-03-24T12:00:00.000Z",
  "updatedAt": "2026-03-24T12:00:00.000Z"
}
```

Subscription behavior that matters for clients:

- `user` is server-controlled on create and update.
- `status` is server-controlled on create and update.
- On create, if `renewalDate` is omitted, the server auto-calculates it from `startDate`:
  - `monthly`: `+30` days
  - `quarterly`: `+90` days
  - `yearly`: `+365` days
- On create and normal saves, status is derived from dates:
  - `cancelled` stays `cancelled`
  - past renewal date becomes `expired`
  - otherwise status becomes `active`
- On update, `renewalDate` is not auto-recalculated. If you change `startDate` or `frequency`, send `renewalDate` explicitly if you want it to move.

## List Query Parameters

Used by subscription list endpoints:

| Query | Type | Default | Notes |
| --- | --- | --- | --- |
| `page` | integer | `1` | Values below `1` fall back to `1` |
| `limit` | integer | `10` | Values below `1` fall back to `10`; max is `100` |

## Subscription Write Fields

Used by create and update endpoints.

| Field | Type | Required on create | Mutable on update | Notes |
| --- | --- | --- | --- | --- |
| `name` | string | Yes | Yes | 2-100 chars |
| `price` | number | Yes | Yes | Must be `>= 0` |
| `currency` | string | Yes | Yes | `USD`, `EUR`, `GBP`, `INR`, `JPY`, `AUD` |
| `frequency` | string | Yes | Yes | `monthly`, `quarterly`, `yearly` |
| `category` | string | Yes | Yes | `Entertainment`, `Food`, `Health`, `Other` |
| `color` | string | No | Yes | Hex color like `#E50914`; stored uppercased |
| `startDate` | ISO date-time string | Yes | Yes | Cannot be in the future |
| `renewalDate` | ISO date-time string | No | Yes | Auto-generated only on create if omitted |
| `paymentMethod` | string | Yes | Yes | Free-form string |
| `status` | string | Ignored | Ignored | Use cancel endpoint instead |
| `user` | string | Ignored | Ignored | Server uses authenticated user |

## Endpoints

### Health

#### `GET /`

Auth: Not required

Response `200 OK`:

```text
Hello World!
```

### Auth

#### `POST /api/v1/auth/signup`

Compatibility endpoint kept for older clients. Local email/password auth has been removed.

Auth: Not required

Request body: Ignored

Response `410 Gone`:

```json
{
  "success": false,
  "message": "Local email/password auth has been removed. Sign in with Clerk on the frontend and send the Clerk session token to this API."
}
```

#### `POST /api/v1/auth/signin`

Compatibility endpoint kept for older clients. Local email/password auth has been removed.

Auth: Not required

Request body: Ignored

Response `410 Gone`:

```json
{
  "success": false,
  "message": "Local email/password auth has been removed. Sign in with Clerk on the frontend and send the Clerk session token to this API."
}
```

#### `POST /api/v1/auth/signout`

Informational endpoint only. Real sign-out happens on the frontend through Clerk.

Auth: Not required

Request body: Ignored

Response `200 OK`:

```json
{
  "success": true,
  "message": "Sign out is handled by Clerk on the frontend."
}
```

### Users

#### `GET /api/v1/users/me`

Returns the authenticated MongoDB user document.

Auth: Required

Response `200 OK`:

```json
{
  "success": true,
  "message": "Current user fetched successfully",
  "data": {
    "_id": "67e2b67c8ccf0df31f0a1001",
    "clerkId": "user_2w6dQ3bJ4R8S9",
    "name": "Jane Doe",
    "email": "jane@example.com",
    "authProvider": "clerk",
    "imageUrl": "https://img.clerk.com/example.png",
    "createdAt": "2026-03-24T12:00:00.000Z",
    "updatedAt": "2026-03-24T12:00:00.000Z"
  }
}
```

Common errors:

- `401 Unauthorized` for missing, invalid, or unprovisioned Clerk sessions

#### `GET /api/v1/users/:id`

Returns a user document only when `:id` matches the authenticated user's MongoDB id.

Auth: Required

Path params:

| Param | Type | Notes |
| --- | --- | --- |
| `id` | string | MongoDB ObjectId of the current user |

Response `200 OK`:

```json
{
  "success": true,
  "message": "User fetched successfully",
  "data": {
    "_id": "67e2b67c8ccf0df31f0a1001",
    "clerkId": "user_2w6dQ3bJ4R8S9",
    "name": "Jane Doe",
    "email": "jane@example.com",
    "authProvider": "clerk",
    "imageUrl": "https://img.clerk.com/example.png",
    "createdAt": "2026-03-24T12:00:00.000Z",
    "updatedAt": "2026-03-24T12:00:00.000Z"
  }
}
```

Possible errors:

- `401 Unauthorized` if the Clerk session is missing or invalid
- `403 Forbidden` if `:id` does not match `req.user.id`

```json
{
  "success": false,
  "message": "You can only access your own user record",
  "error": "{\"message\":\"You can only access your own user record\",\"statusCode\":403}"
}
```

- `404 Not Found` if `:id` matches the current user but that MongoDB user record no longer exists

```json
{
  "success": false,
  "message": "User not found",
  "error": "{\"message\":\"User not found\",\"statusCode\":404}"
}
```

Implementation note:

- Ownership is checked before the database lookup. If `:id` is someone else's id, the API returns `403` without checking whether that user exists.

### Subscriptions

#### `GET /api/v1/subscriptions`
#### `GET /api/v1/subscriptions/me`

Both routes return the authenticated user's subscriptions, sorted by `createdAt` descending.

Auth: Required

Query params:

| Query | Type | Notes |
| --- | --- | --- |
| `page` | integer | Optional |
| `limit` | integer | Optional, max `100` |

Response `200 OK`:

```json
{
  "success": true,
  "message": "Subscriptions fetched successfully",
  "data": [
    {
      "_id": "67e2b8d68ccf0df31f0a2001",
      "name": "Netflix",
      "price": 15.99,
      "currency": "USD",
      "frequency": "monthly",
      "category": "Entertainment",
      "color": "#E50914",
      "startDate": "2026-03-01T00:00:00.000Z",
      "renewalDate": "2026-03-31T00:00:00.000Z",
      "paymentMethod": "Visa ending in 4242",
      "status": "active",
      "user": "67e2b67c8ccf0df31f0a1001",
      "createdAt": "2026-03-24T12:00:00.000Z",
      "updatedAt": "2026-03-24T12:00:00.000Z"
    },
    {
      "_id": "67e2b8d68ccf0df31f0a2002",
      "name": "Spotify",
      "price": 9.99,
      "currency": "USD",
      "frequency": "monthly",
      "category": "Entertainment",
      "color": "#1DB954",
      "startDate": "2026-03-10T00:00:00.000Z",
      "renewalDate": "2026-04-09T00:00:00.000Z",
      "paymentMethod": "Mastercard ending in 4444",
      "status": "active",
      "user": "67e2b67c8ccf0df31f0a1001",
      "createdAt": "2026-03-20T12:00:00.000Z",
      "updatedAt": "2026-03-20T12:00:00.000Z"
    }
  ],
  "pagination": {
    "total": 2,
    "page": 1,
    "limit": 10,
    "totalPages": 1,
    "hasNextPage": false,
    "hasPrevPage": false
  }
}
```

Possible errors:

- `401 Unauthorized` if the Clerk session is missing or invalid

#### `GET /api/v1/subscriptions/user/:id`

Compatibility route for older clients. Returns subscriptions only when `:id` matches the authenticated user id.

Auth: Required

Path params:

| Param | Type | Notes |
| --- | --- | --- |
| `id` | string | MongoDB ObjectId of the current user |

Query params:

| Query | Type | Notes |
| --- | --- | --- |
| `page` | integer | Optional |
| `limit` | integer | Optional, max `100` |

Response `200 OK`:

```json
{
  "success": true,
  "message": "User Subscriptions fetched successfully",
  "data": [
    {
      "_id": "67e2b8d68ccf0df31f0a2001",
      "name": "Netflix",
      "price": 15.99,
      "currency": "USD",
      "frequency": "monthly",
      "category": "Entertainment",
      "color": "#E50914",
      "startDate": "2026-03-01T00:00:00.000Z",
      "renewalDate": "2026-03-31T00:00:00.000Z",
      "paymentMethod": "Visa ending in 4242",
      "status": "active",
      "user": "67e2b67c8ccf0df31f0a1001",
      "createdAt": "2026-03-24T12:00:00.000Z",
      "updatedAt": "2026-03-24T12:00:00.000Z"
    }
  ],
  "pagination": {
    "total": 1,
    "page": 1,
    "limit": 10,
    "totalPages": 1,
    "hasNextPage": false,
    "hasPrevPage": false
  }
}
```

Possible errors:

- `401 Unauthorized` if the Clerk session is missing or invalid
- `403 Forbidden` if `:id` does not match the authenticated user

```json
{
  "success": false,
  "message": "You are not the owner of this subscription",
  "error": "{\"message\":\"You are not the owner of this subscription\",\"statusCode\":403}"
}
```

#### `GET /api/v1/subscriptions/upcoming-renewals`
#### `GET /api/v1/subscriptions/me/upcoming-renewals`

Both routes return only active subscriptions for the authenticated user where `renewalDate >= now`, sorted by `renewalDate` ascending.

Auth: Required

Query params:

| Query | Type | Notes |
| --- | --- | --- |
| `page` | integer | Optional |
| `limit` | integer | Optional, max `100` |

Response `200 OK`:

```json
{
  "success": true,
  "message": "Upcoming renewals fetched successfully",
  "data": [
    {
      "_id": "67e2b8d68ccf0df31f0a2001",
      "name": "Netflix",
      "price": 15.99,
      "currency": "USD",
      "frequency": "monthly",
      "category": "Entertainment",
      "color": "#E50914",
      "startDate": "2026-03-01T00:00:00.000Z",
      "renewalDate": "2026-03-31T00:00:00.000Z",
      "paymentMethod": "Visa ending in 4242",
      "status": "active",
      "user": "67e2b67c8ccf0df31f0a1001",
      "createdAt": "2026-03-24T12:00:00.000Z",
      "updatedAt": "2026-03-24T12:00:00.000Z"
    }
  ],
  "pagination": {
    "total": 1,
    "page": 1,
    "limit": 10,
    "totalPages": 1,
    "hasNextPage": false,
    "hasPrevPage": false
  }
}
```

Possible errors:

- `401 Unauthorized` if the Clerk session is missing or invalid

#### `GET /api/v1/subscriptions/:id`

Returns one subscription owned by the authenticated user.

Auth: Required

Path params:

| Param | Type | Notes |
| --- | --- | --- |
| `id` | string | Subscription ObjectId |

Response `200 OK`:

```json
{
  "success": true,
  "message": "Subscription fetched successfully",
  "data": {
    "_id": "67e2b8d68ccf0df31f0a2001",
    "name": "Netflix",
    "price": 15.99,
    "currency": "USD",
    "frequency": "monthly",
    "category": "Entertainment",
    "color": "#E50914",
    "startDate": "2026-03-01T00:00:00.000Z",
    "renewalDate": "2026-03-31T00:00:00.000Z",
    "paymentMethod": "Visa ending in 4242",
    "status": "active",
    "user": "67e2b67c8ccf0df31f0a1001",
    "createdAt": "2026-03-24T12:00:00.000Z",
    "updatedAt": "2026-03-24T12:00:00.000Z"
  }
}
```

Possible errors:

- `401 Unauthorized` if the Clerk session is missing or invalid
- `404 Not Found` if the subscription does not exist, is not owned by the current user, or the id cannot be cast

Examples:

```json
{
  "success": false,
  "message": "Subscription not found",
  "error": "{\"message\":\"Subscription not found\",\"statusCode\":404}"
}
```

```json
{
  "success": false,
  "message": "Resource not found",
  "error": "{\"statusCode\":404}"
}
```

#### `POST /api/v1/subscriptions`

Creates a subscription for the authenticated user, then triggers the reminder workflow.

Auth: Required

Request body:

```json
{
  "name": "Netflix",
  "price": 15.99,
  "currency": "USD",
  "frequency": "monthly",
  "category": "Entertainment",
  "color": "#E50914",
  "startDate": "2026-03-01T00:00:00.000Z",
  "paymentMethod": "Visa ending in 4242"
}
```

Response `201 Created`:

```json
{
  "success": true,
  "message": "Subscription created successfully",
  "data": {
    "subscription": {
      "_id": "67e2b8d68ccf0df31f0a2001",
      "name": "Netflix",
      "price": 15.99,
      "currency": "USD",
      "frequency": "monthly",
      "category": "Entertainment",
      "color": "#E50914",
      "startDate": "2026-03-01T00:00:00.000Z",
      "renewalDate": "2026-03-31T00:00:00.000Z",
      "paymentMethod": "Visa ending in 4242",
      "status": "active",
      "user": "67e2b67c8ccf0df31f0a1001",
      "createdAt": "2026-03-24T12:00:00.000Z",
      "updatedAt": "2026-03-24T12:00:00.000Z"
    },
    "workflowRunId": "wfr_01HXYZABCDEF1234567890"
  }
}
```

Possible errors:

- `400 Bad Request` for schema validation failures
- `401 Unauthorized` if the Clerk session is missing or invalid
- `500 Internal Server Error` if database write or workflow trigger fails

Validation example:

```json
{
  "success": false,
  "message": "Start date cannot be in the future",
  "error": "{\"statusCode\":400}"
}
```

Notes:

- `user` and `status` are ignored if sent.
- If `renewalDate` is omitted, it is auto-calculated from `frequency`.
- The subscription is inserted before the workflow trigger runs. If the workflow trigger fails, this endpoint can return an error even though the subscription was already created.

#### `PUT /api/v1/subscriptions/:id`

Updates a subscription owned by the authenticated user.

Auth: Required

Path params:

| Param | Type | Notes |
| --- | --- | --- |
| `id` | string | Subscription ObjectId |

Request body:

- Partial updates are allowed.
- Any mutable subscription fields may be sent.
- `user` and `status` are ignored.

Example request:

```json
{
  "price": 17.99,
  "paymentMethod": "Visa ending in 1111",
  "renewalDate": "2026-04-02T00:00:00.000Z"
}
```

Response `200 OK`:

```json
{
  "success": true,
  "message": "Subscription updated successfully",
  "data": {
    "_id": "67e2b8d68ccf0df31f0a2001",
    "name": "Netflix",
    "price": 17.99,
    "currency": "USD",
    "frequency": "monthly",
    "category": "Entertainment",
    "color": "#E50914",
    "startDate": "2026-03-01T00:00:00.000Z",
    "renewalDate": "2026-04-02T00:00:00.000Z",
    "paymentMethod": "Visa ending in 1111",
    "status": "active",
    "user": "67e2b67c8ccf0df31f0a1001",
    "createdAt": "2026-03-24T12:00:00.000Z",
    "updatedAt": "2026-03-25T09:15:00.000Z"
  }
}
```

Possible errors:

- `400 Bad Request` for validation failures on updated fields
- `401 Unauthorized` if the Clerk session is missing or invalid
- `404 Not Found` if the subscription does not exist, is not owned by the current user, or the id cannot be cast

Important behavior:

- `renewalDate` is not auto-recalculated on update.
- If you change `frequency` or `startDate`, send `renewalDate` explicitly if the billing cycle should move too.

#### `DELETE /api/v1/subscriptions/:id`

Deletes a subscription owned by the authenticated user.

Auth: Required

Path params:

| Param | Type | Notes |
| --- | --- | --- |
| `id` | string | Subscription ObjectId |

Response `200 OK`:

```json
{
  "success": true,
  "message": "Subscription deleted successfully",
  "data": {
    "_id": "67e2b8d68ccf0df31f0a2001",
    "name": "Netflix",
    "price": 15.99,
    "currency": "USD",
    "frequency": "monthly",
    "category": "Entertainment",
    "color": "#E50914",
    "startDate": "2026-03-01T00:00:00.000Z",
    "renewalDate": "2026-03-31T00:00:00.000Z",
    "paymentMethod": "Visa ending in 4242",
    "status": "active",
    "user": "67e2b67c8ccf0df31f0a1001",
    "createdAt": "2026-03-24T12:00:00.000Z",
    "updatedAt": "2026-03-24T12:00:00.000Z"
  }
}
```

Possible errors:

- `401 Unauthorized` if the Clerk session is missing or invalid
- `404 Not Found` if the subscription does not exist, is not owned by the current user, or the id cannot be cast

#### `PUT /api/v1/subscriptions/:id/cancel`

Marks a subscription owned by the authenticated user as `cancelled`.

Auth: Required

Path params:

| Param | Type | Notes |
| --- | --- | --- |
| `id` | string | Subscription ObjectId |

Response `200 OK`:

```json
{
  "success": true,
  "message": "Subscription cancelled successfully",
  "data": {
    "_id": "67e2b8d68ccf0df31f0a2001",
    "name": "Netflix",
    "price": 15.99,
    "currency": "USD",
    "frequency": "monthly",
    "category": "Entertainment",
    "color": "#E50914",
    "startDate": "2026-03-01T00:00:00.000Z",
    "renewalDate": "2026-03-31T00:00:00.000Z",
    "paymentMethod": "Visa ending in 4242",
    "status": "cancelled",
    "user": "67e2b67c8ccf0df31f0a1001",
    "createdAt": "2026-03-24T12:00:00.000Z",
    "updatedAt": "2026-03-25T11:30:00.000Z"
  }
}
```

Possible errors:

- `401 Unauthorized` if the Clerk session is missing or invalid
- `404 Not Found` if the subscription does not exist, is not owned by the current user, or the id cannot be cast

### Clerk Webhook

#### `POST /api/v1/webhooks/clerk`

Processes Clerk webhook events.

Auth: Bearer token not required

Requirements:

- Raw JSON request body
- Valid Clerk webhook headers:
  - `svix-id`
  - `svix-timestamp`
  - `svix-signature`
- `CLERK_WEBHOOK_SIGNING_SECRET` must be configured on the server

Handled events:

- `user.created`: create or sync the local MongoDB user
- `user.updated`: sync the local MongoDB user
- `user.deleted`: delete the local MongoDB user and all of that user's subscriptions
- Any other event type: acknowledged with `200`, but no local change is made

Response `200 OK`:

```json
{
  "success": true,
  "message": "Clerk webhook processed successfully",
  "data": {
    "type": "user.created"
  }
}
```

Failure behavior:

- Missing webhook headers, invalid signature, or missing webhook signing secret are passed to the shared error handler.
- The response uses the standard error envelope when possible.
- The exact failure status depends on the Clerk library error that was thrown.

Typical failure messages:

- `Missing required webhook headers: svix-id, svix-timestamp, svix-signature`
- `Unable to verify incoming webhook: ...`
- `Missing webhook signing secret. Set the CLERK_WEBHOOK_SIGNING_SECRET environment variable with the webhook secret from the Clerk Dashboard.`

### Workflow Callback

#### `POST /api/v1/workflows/subscription/reminder`

Internal route used by Upstash Workflow after subscription creation. This is not a public client-facing endpoint.

Auth: No bearer token required

Request body:

```json
{
  "subscriptionId": "67e2b8d68ccf0df31f0a2001"
}
```

What it does:

- Loads the subscription and populates the user `name` and `email`
- Stops immediately if the subscription no longer exists
- Stops immediately if the subscription is not `active`
- Stops immediately if the renewal date is already in the past
- Schedules reminder emails for:
  - 7 days before
  - 5 days before
  - 2 days before
  - 1 day before
  - final day

Success response `200 OK`:

```json
{
  "workflowRunId": "wfr_01HXYZABCDEF1234567890"
}
```

Important differences from the rest of the API:

- This route is wrapped by `@upstash/workflow/express`.
- It does not return the standard `success/message/data` envelope.
- On success, the wrapper returns only `workflowRunId`.

Known failure responses from the wrapper:

### `400 Bad Request` - workflow authentication failed

```json
{
  "message": "Failed to authenticate Workflow request. If this is unexpected, see the caveat https://upstash.com/docs/workflow/basics/caveats#avoid-non-deterministic-code-outside-context-run",
  "workflowRunId": "wfr_01HXYZABCDEF1234567890"
}
```

### `500 Internal Server Error` - workflow execution error

```json
{
  "error": "Error",
  "message": "An error occured while executing workflow."
}
```

## Example Create Request

```bash
curl -X POST http://localhost:5500/api/v1/subscriptions \
  -H "Authorization: Bearer <clerk_session_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Netflix",
    "price": 15.99,
    "currency": "USD",
    "frequency": "monthly",
    "category": "Entertainment",
    "color": "#E50914",
    "startDate": "2026-03-01T00:00:00.000Z",
    "paymentMethod": "Visa ending in 4242"
  }'
```
