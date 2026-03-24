# SubDub API

Last verified: March 25, 2026

## Base URL

- Local: `http://localhost:5500`
- API prefix: `/api/v1`

## Authentication

Protected routes require:

```http
Authorization: Bearer <clerk_session_token>
```

If the session is missing, invalid, or the Clerk user has not been provisioned in MongoDB, the API returns `401`.

## Response Format

Successful responses use:

```json
{
  "success": true,
  "message": "Human-readable message",
  "data": {}
}
```

List endpoints may also include:

```json
{
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

Error responses use:

```json
{
  "success": false,
  "message": "Error message",
  "error": "Serialized error details"
}
```

## Resources

### User

```json
{
  "_id": "mongodb_object_id",
  "clerkId": "user_xxx",
  "name": "Jane Doe",
  "email": "jane@example.com",
  "authProvider": "clerk",
  "imageUrl": "https://...",
  "createdAt": "2026-03-24T12:00:00.000Z",
  "updatedAt": "2026-03-24T12:00:00.000Z"
}
```

### Subscription

```json
{
  "_id": "mongodb_object_id",
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
  "user": "mongodb_object_id",
  "createdAt": "2026-03-24T12:00:00.000Z",
  "updatedAt": "2026-03-24T12:00:00.000Z"
}
```

Rules:

- `currency`: `USD`, `EUR`, `GBP`, `INR`, `JPY`, `AUD`
- `frequency`: `monthly`, `quarterly`, `yearly`
- `category`: `Entertainment`, `Food`, `Health`, `Other`
- `color`: optional hex color like `#E50914`; defaults to `#2563EB`
- `status`: `active`, `cancelled`, `expired`
- `startDate` cannot be in the future
- `renewalDate` must be after `startDate`
- If `renewalDate` is omitted on create, it is auto-calculated from `frequency`
- `user` and `status` are server-controlled on create and update

## Endpoints

### Health

#### `GET /`

Returns plain text:

```text
Hello World!
```

### Auth

#### `POST /api/v1/auth/signup`

Compatibility endpoint. Returns `410 Gone`.

#### `POST /api/v1/auth/signin`

Compatibility endpoint. Returns `410 Gone`.

#### `POST /api/v1/auth/signout`

Returns `200 OK` with an informational message.

### Users

#### `GET /api/v1/users/me`

Returns the authenticated MongoDB user record for the current Clerk session.

Auth: Required

#### `GET /api/v1/users/:id`

Returns a user record only when `:id` matches the authenticated user's MongoDB id.

Auth: Required

Possible errors:

- `403` if `:id` does not match the current user
- `404` if the user does not exist

### Subscriptions

Pagination query params available on list endpoints:

- `page` default `1`
- `limit` default `10`, max `100`

#### `GET /api/v1/subscriptions`

Returns the authenticated user's subscriptions, sorted by newest first.

Auth: Required

#### `GET /api/v1/subscriptions/me`

Alias of `GET /api/v1/subscriptions`.

Auth: Required

#### `GET /api/v1/subscriptions/user/:id`

Returns subscriptions for the authenticated user only when `:id` matches the current user's MongoDB id.

Auth: Required

Possible errors:

- `403` if `:id` does not match the current user

#### `GET /api/v1/subscriptions/upcoming-renewals`

Returns active subscriptions for the authenticated user where `renewalDate >= now`, sorted by nearest renewal first.

Auth: Required

#### `GET /api/v1/subscriptions/me/upcoming-renewals`

Alias of `GET /api/v1/subscriptions/upcoming-renewals`.

Auth: Required

#### `GET /api/v1/subscriptions/:id`

Returns one subscription owned by the authenticated user.

Auth: Required

Possible errors:

- `404` if the subscription does not exist or is not owned by the current user

#### `POST /api/v1/subscriptions`

Creates a subscription for the authenticated user and starts the reminder workflow.

Auth: Required

Request body:

| Field | Type | Required | Notes |
|---|---|---|---|
| `name` | string | Yes | 2-100 characters |
| `price` | number | Yes | Must be `>= 0` |
| `currency` | string | Yes | `USD`, `EUR`, `GBP`, `INR`, `JPY`, `AUD` |
| `frequency` | string | Yes | `monthly`, `quarterly`, `yearly` |
| `category` | string | Yes | `Entertainment`, `Food`, `Health`, `Other` |
| `color` | string | No | Hex color such as `#E50914`; defaults to `#2563EB` |
| `startDate` | ISO date string | Yes | Cannot be in the future |
| `renewalDate` | ISO date string | No | Auto-calculated if omitted |
| `paymentMethod` | string | Yes | Free-form string |

Ignored if provided:

- `user`
- `status`

Response `data` shape:

```json
{
  "subscription": {},
  "workflowRunId": "workflow_run_id"
}
```

#### `PUT /api/v1/subscriptions/:id`

Updates a subscription owned by the authenticated user.

Auth: Required

Accepts one or more mutable subscription fields from the create body.

Ignored if provided:

- `user`
- `status`

Possible errors:

- `404` if the subscription does not exist or is not owned by the current user

#### `DELETE /api/v1/subscriptions/:id`

Deletes a subscription owned by the authenticated user.

Auth: Required

Possible errors:

- `404` if the subscription does not exist or is not owned by the current user

#### `PUT /api/v1/subscriptions/:id/cancel`

Marks a subscription owned by the authenticated user as `cancelled`.

Auth: Required

Possible errors:

- `404` if the subscription does not exist or is not owned by the current user

### Clerk Webhook

#### `POST /api/v1/webhooks/clerk`

Processes Clerk webhook events.

Behavior:

- `user.created`: create or sync the local MongoDB user
- `user.updated`: sync the local MongoDB user
- `user.deleted`: delete the local MongoDB user and that user's subscriptions

Requirements:

- Valid Clerk webhook signature headers
- Raw JSON request body

### Workflow Callback

#### `POST /api/v1/workflows/subscription/reminder`

Internal route used by Upstash Workflow after a subscription is created.

Request body:

```json
{
  "subscriptionId": "mongodb_object_id"
}
```

Behavior:

- Loads the subscription and its user
- Stops if the subscription is missing, inactive, or already past renewal
- Schedules reminder emails for 7, 5, 2, 1, and 0 days before renewal

## Example

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
