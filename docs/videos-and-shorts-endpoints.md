# Videos & Shorts API Endpoints

This document enumerates the currently available REST endpoints that power the videos and shorts experiences. Share it with the frontend team to ensure consistent integration with the backend service.

## Base URL

All routes are mounted under the following prefix:

- **Base path:** `/api/v1`
- **Service:** `videos`
- **Complete base URL:** `/api/v1/videos`

> Combine the base URL with each endpoint path below when making requests. Example: `GET /api/v1/videos`.

## Authentication

- GET endpoints remain public in the current implementation.
- POST endpoints use JSON Web Token (JWT) auth via the `Authorization: Bearer <token>` header (Passport JWT is already configured).
- Creating content via `POST /api/v1/videos` or `POST /api/v1/videos/shorts` requires a valid Bearer token; the authenticated user's id is stored with the new record.
- `POST /api/v1/videos/views` accepts anonymous requests but will associate the authenticated user id when a valid token is supplied.

## Endpoints

| Method | Path      | Description                                                                                                | Query Parameters / Body                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ------ | --------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `GET`  | `/`       | Retrieve a paginated list of videos. Returns all videos ordered by created date (newest first) by default. | Query: `limit` _(number, optional)_ (default `20`).<br>Query: `page` _(number, optional)_ (default `1`).                                                                                                                                                                                                                                                                                                                                   |
| `GET`  | `/filter` | Retrieve videos matching a curated sort order.                                                             | Query: `sort` _(string, optional)_ — one of `most_viewed`, `popular`, `top_rated`, `latest`, `oldest`.<br>Query: `limit` _(number, optional)_.<br>Query: `page` _(number, optional)_.<br>Query: `featured` _(0 or 1, optional)_.                                                                                                                                                                                                           |
| `GET`  | `/shorts` | Retrieve a feed of short-form videos. Returns only videos where `is_short = 1`.                            | Query: `sort` _(string, optional)_ (defaults to `latest`).<br>Query: `limit` _(number, optional)_.<br>Query: `page` _(number, optional)_.                                                                                                                                                                                                                                                                                                  |
| `POST` | `/`       | Create a new long-form video record.                                                                       | Requires `Authorization: Bearer <token>` header. Body (JSON): must include `title` _(string)_ and at least one source field (`video_location`, `youtube`, `vimeo`, `daily`, `facebook`, `instagram`, `ok`, `twitch`, or `trailer`). Optional fields include `description`, `thumbnail`, `duration`, `category_id`, `tags`, `privacy`, `approved`, `featured`, `monetization`, `rent_price`, etc. The authenticated user becomes the owner. |
| `POST` | `/shorts` | Create a new short-form video record. The service automatically stores it with `is_short = 1`.             | Requires `Authorization: Bearer <token>` header. Body (JSON): same shape as `POST /api/v1/videos`; the record is persisted as a short regardless of body `is_short` value, and it's owned by the authenticated user.                                                                                                                                                                                                                       |

### Response Shape (high level)

Each endpoint returns a JSON object with a `data` array of videos. Items include fields such as:

- `id`, `title`, `slug`, `description`
- Media details (`thumbnail`, `duration`, `video_location`)
- Engagement stats (`views`, `comments`, `likes`)
- `is_short` flag (1 for shorts)
- Short-form filter also checks `duration` < `00:01:20`

> The exact schema originates from the database view in `videos.service.js` and may evolve. Frontend consumers should be resilient to extra fields.

## Request Examples

<details>
<summary>Fetch paginated videos</summary>

```
GET /api/v1/videos?limit=20&page=1
Accept: application/json
```

</details>

<details>
<summary>Fetch top-rated videos</summary>

```
GET /api/v1/videos/filter?sort=top_rated&limit=12&page=1
Accept: application/json
```

</details>

<details>
<summary>Fetch latest shorts</summary>

```
GET /api/v1/videos/shorts?sort=latest&limit=15&page=1
Accept: application/json
```

</details>

<details>
<summary>Fetch featured videos</summary>

```
GET /api/v1/videos/filter?featured=1&limit=12&page=1
Accept: application/json
```

</details>

<details>
<summary>Create a video</summary>

```
POST /api/v1/videos
Content-Type: application/json
Authorization: Bearer <token>

{
	"user_id": 1,
	"title": "Amazing Hausa Movie",
	"video_location": "upload/videos/2025/movie.mp4",
	"thumbnail": "upload/photos/2025/movie-thumb.jpg",
	"duration": "01:15:00",
	"category_id": 3,
	"tags": "hausa,movie"
}
```

</details>

<details>
<summary>Create a short</summary>

```
POST /api/v1/videos/shorts
Content-Type: application/json
Authorization: Bearer <token>

{
	"user_id": 1,
	"title": "Quick Recipe Clip",
	"video_location": "upload/videos/2025/recipe.mp4",
	"thumbnail": "upload/photos/2025/recipe-thumb.jpg",
	"duration": "00:01:00",
	"tags": "food,short"
}
```

</details>

## Notes & Next Steps

- There is no dedicated shorts router; shorts are served through the `/shorts` path under the videos service.
- Shorts selection logic only returns videos where `is_short = 1`.
- Creation endpoints now exist (`POST /api/v1/videos` and `POST /api/v1/videos/shorts`). Update this document again if update/delete routes are introduced.
- Coordinate with backend before relying on additional filters or response properties.

## View Tracking Endpoint

- **Base path:** `/api/v1/videos/views`

| Method | Path | Description                                                               | Body                                                                                                                                                                                                                                                                                                |
| ------ | ---- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST` | `/`  | Register a view for a specific video and increment the aggregate counter. | JSON body must include `video_id` _(positive integer)_. Optional fields: `fingerprint` _(string ≤ 300 chars)_ for client/device deduplication and `user_id` _(positive integer)_ when no JWT is supplied. When a JWT is provided, the authenticated user's id overrides `user_id` sent in the body. |

### Behaviour

- If a fingerprint (or authenticated user id) has already been recorded for the same `video_id`, the endpoint refreshes the timestamp but does **not** increment the aggregate views column.
- On first-time views, a row is inserted into the `views` table and the corresponding `videos.views` counter increases atomically.
- Responses include `{ data: { videoId, views, counted } }`, where `counted` indicates whether the aggregate increased.

### Request Example

```
POST /api/v1/videos/views
Content-Type: application/json

{
	"video_id": 42,
	"fingerprint": "device_1a2b3c"
}
```

Possible 201 response when a new view is counted:

```
{
	"data": {
		"videoId": 42,
		"views": 128,
		"counted": true
	}
}
```

When the same fingerprint repeats, the service returns HTTP 200 with `counted: false`.
