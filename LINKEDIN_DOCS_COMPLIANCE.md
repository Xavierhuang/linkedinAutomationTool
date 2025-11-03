# ✅ LinkedIn API Documentation Compliance

## Reference Documentation

Based on official LinkedIn documentation:
- [Share on LinkedIn (Consumer API)](https://learn.microsoft.com/en-us/linkedin/consumer/integrations/self-serve/share-on-linkedin)
- [Posts API (Marketing API)](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api)
- [Images API](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/images-api)
- [Getting Access](https://learn.microsoft.com/en-us/linkedin/shared/authentication/getting-access)

---

## API Choice

We're using the **Posts API** (`/v2/posts`), which is the modern marketing API for creating organic and sponsored posts.

### Why Posts API vs ugcPosts?
- **Posts API** (`/v2/posts`) - Modern, supports both organic and sponsored posts
- **ugcPosts API** (`/v2/ugcPosts`) - Older consumer API, different payload format

---

## Changes Made to Match LinkedIn Documentation

### 1. ✅ **Added Required `Linkedin-Version` Header**

According to [LinkedIn Posts API docs](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api), the `Linkedin-Version` header is **required**.

**Format:** `YYYYMM` (e.g., "202510" for October 2025)

**BEFORE (Missing header):**
```python
headers={
    "Authorization": f"Bearer {access_token}",
    "Content-Type": "application/json",
    "X-Restli-Protocol-Version": "2.0.0"
}
```

**AFTER (With required header):**
```python
from datetime import datetime
version_header = datetime.now().strftime("%Y%m")  # "202510"

headers={
    "Authorization": f"Bearer {access_token}",
    "Content-Type": "application/json",
    "X-Restli-Protocol-Version": "2.0.0",
    "Linkedin-Version": version_header  # ✅ Required!
}
```

**File:** `backend/linkedpilot/adapters/linkedin_adapter.py` (Line 254-264)

---

### 2. ✅ **Correct Media Payload Format**

According to the [Posts API documentation](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api), media posts require specific structure:

**Single Image:**
```json
{
  "content": {
    "media": {
      "title": "Image title",
      "id": "urn:li:digitalmediaAsset:..."
    }
  }
}
```

**Carousel Images:**
```json
{
  "content": {
    "multiImage": {
      "images": [
        {"title": "Slide 1", "id": "urn:..."},
        {"title": "Slide 2", "id": "urn:..."}
      ]
    }
  }
}
```

**Implementation:** `backend/linkedpilot/adapters/linkedin_adapter.py` (Line 229-245)

---

### 3. ✅ **Added Media Processing Delay**

LinkedIn needs time to process uploaded media assets before they can be used in posts. Added a 2-second delay after image upload.

**Implementation:**
```python
media_urns.append(media_urn)
print(f"   [SUCCESS] Image uploaded! URN: {media_urn}")
# Give LinkedIn a moment to process the media asset
import asyncio
await asyncio.sleep(2)
```

**Files:**
- `backend/linkedpilot/routes/scheduled_posts.py` (Line 209-211)
- `backend/linkedpilot/routes/ai_content.py` (Line 544-546)

---

### 4. ✅ **Correct Request Headers**

Our implementation matches LinkedIn's requirements:

| Header                        | Value              | Required | Status |
| ----------------------------- | ------------------ | -------- | ------ |
| `Authorization`               | `Bearer {token}`   | Yes      | ✅      |
| `Content-Type`                | `application/json` | Yes      | ✅      |
| `X-Restli-Protocol-Version`   | `2.0.0`            | Yes      | ✅      |
| `Linkedin-Version`            | `YYYYMM`           | Yes      | ✅ NEW  |

---

### 5. ✅ **Correct Post Structure**

Our post payload matches the Posts API schema:

```json
{
  "author": "urn:li:organization:{id}",
  "commentary": "Post text content",
  "visibility": "PUBLIC",
  "distribution": {
    "feedDistribution": "MAIN_FEED",
    "targetEntities": [],
    "thirdPartyDistributionChannels": []
  },
  "lifecycleState": "PUBLISHED",
  "isReshareDisabledByAuthor": false,
  "content": {
    "media": {
      "title": "Image",
      "id": "urn:li:digitalmediaAsset:..."
    }
  }
}
```

---

## Media Upload Flow (3-Step Process)

According to [Images API documentation](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/images-api):

### Step 1: Register Upload ✅
```
POST /v2/assets?action=registerUpload
```
Returns: `uploadUrl` and `asset` URN

### Step 2: Upload Binary ✅
```
PUT {uploadUrl}
Content-Type: image/png
Body: [binary image data]
```

### Step 3: Wait & Create Post ✅
```
[WAIT 2 seconds for processing]
POST /v2/posts
Body: { content: { media: { id: asset } } }
```

**All three steps implemented correctly!**

---

## Expected Response

According to LinkedIn docs, successful post creation returns:
- **Status Code:** `201 Created`
- **Post ID:** In `X-RestLi-Id` response header
- **Response Body:** Post details or empty

---

## Testing Checklist

Based on LinkedIn's documentation:

- ✅ **Auth Scope:** `w_member_social` (required for posting)
- ✅ **API Endpoint:** `/v2/posts` (modern Posts API)
- ✅ **Headers:** All required headers present
- ✅ **Payload:** Matches documented schema
- ✅ **Media Format:** Correct structure with titles
- ✅ **Processing Delay:** 2-second wait after upload
- ✅ **Author URN:** Correct format for organizations
- ✅ **Error Handling:** Detailed logging and debug output

---

## What Was Wrong Before

1. ❌ **Missing `Linkedin-Version` header** - Required by Posts API
2. ❌ **Missing `title` field** in media content - Required field
3. ❌ **No processing delay** - LinkedIn needs time to process uploaded media
4. ❌ **Carousel images missing titles** - Each slide needs a title

---

## What's Correct Now

1. ✅ **All required headers** present (including `Linkedin-Version`)
2. ✅ **Correct media payload** format with titles
3. ✅ **2-second processing delay** after media upload
4. ✅ **Debug logging** to see exact payload sent
5. ✅ **Proper error handling** with detailed messages

---

## Deployment Status

✅ **Backend Files Updated:**
- `linkedpilot/adapters/linkedin_adapter.py` (42KB)
- `linkedpilot/routes/scheduled_posts.py` (14KB)
- `linkedpilot/routes/ai_content.py` (22KB)

✅ **Backend Restarted:** PM2 service online

---

## Test Now

Create a post with an image and click "Post Now". You should see:

```
[IMAGE] Uploading image: https://...
[SUCCESS] Image uploaded! URN: urn:li:digitalmediaAsset:...
[SEND] Sending to LinkedIn Posts API...
[DEBUG] Full payload:
{
  "author": "urn:li:organization:108737174",
  "commentary": "Your post text...",
  "content": {
    "media": {
      "title": "Image",
      "id": "urn:li:digitalmediaAsset:..."
    }
  },
  ...
}
📬 LinkedIn response: 201
✅ Post created successfully!
```

---

## References

All implementations are based on official Microsoft/LinkedIn documentation:
- https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api
- https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/images-api
- https://learn.microsoft.com/en-us/linkedin/consumer/integrations/self-serve/share-on-linkedin





## Reference Documentation

Based on official LinkedIn documentation:
- [Share on LinkedIn (Consumer API)](https://learn.microsoft.com/en-us/linkedin/consumer/integrations/self-serve/share-on-linkedin)
- [Posts API (Marketing API)](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api)
- [Images API](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/images-api)
- [Getting Access](https://learn.microsoft.com/en-us/linkedin/shared/authentication/getting-access)

---

## API Choice

We're using the **Posts API** (`/v2/posts`), which is the modern marketing API for creating organic and sponsored posts.

### Why Posts API vs ugcPosts?
- **Posts API** (`/v2/posts`) - Modern, supports both organic and sponsored posts
- **ugcPosts API** (`/v2/ugcPosts`) - Older consumer API, different payload format

---

## Changes Made to Match LinkedIn Documentation

### 1. ✅ **Added Required `Linkedin-Version` Header**

According to [LinkedIn Posts API docs](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api), the `Linkedin-Version` header is **required**.

**Format:** `YYYYMM` (e.g., "202510" for October 2025)

**BEFORE (Missing header):**
```python
headers={
    "Authorization": f"Bearer {access_token}",
    "Content-Type": "application/json",
    "X-Restli-Protocol-Version": "2.0.0"
}
```

**AFTER (With required header):**
```python
from datetime import datetime
version_header = datetime.now().strftime("%Y%m")  # "202510"

headers={
    "Authorization": f"Bearer {access_token}",
    "Content-Type": "application/json",
    "X-Restli-Protocol-Version": "2.0.0",
    "Linkedin-Version": version_header  # ✅ Required!
}
```

**File:** `backend/linkedpilot/adapters/linkedin_adapter.py` (Line 254-264)

---

### 2. ✅ **Correct Media Payload Format**

According to the [Posts API documentation](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api), media posts require specific structure:

**Single Image:**
```json
{
  "content": {
    "media": {
      "title": "Image title",
      "id": "urn:li:digitalmediaAsset:..."
    }
  }
}
```

**Carousel Images:**
```json
{
  "content": {
    "multiImage": {
      "images": [
        {"title": "Slide 1", "id": "urn:..."},
        {"title": "Slide 2", "id": "urn:..."}
      ]
    }
  }
}
```

**Implementation:** `backend/linkedpilot/adapters/linkedin_adapter.py` (Line 229-245)

---

### 3. ✅ **Added Media Processing Delay**

LinkedIn needs time to process uploaded media assets before they can be used in posts. Added a 2-second delay after image upload.

**Implementation:**
```python
media_urns.append(media_urn)
print(f"   [SUCCESS] Image uploaded! URN: {media_urn}")
# Give LinkedIn a moment to process the media asset
import asyncio
await asyncio.sleep(2)
```

**Files:**
- `backend/linkedpilot/routes/scheduled_posts.py` (Line 209-211)
- `backend/linkedpilot/routes/ai_content.py` (Line 544-546)

---

### 4. ✅ **Correct Request Headers**

Our implementation matches LinkedIn's requirements:

| Header                        | Value              | Required | Status |
| ----------------------------- | ------------------ | -------- | ------ |
| `Authorization`               | `Bearer {token}`   | Yes      | ✅      |
| `Content-Type`                | `application/json` | Yes      | ✅      |
| `X-Restli-Protocol-Version`   | `2.0.0`            | Yes      | ✅      |
| `Linkedin-Version`            | `YYYYMM`           | Yes      | ✅ NEW  |

---

### 5. ✅ **Correct Post Structure**

Our post payload matches the Posts API schema:

```json
{
  "author": "urn:li:organization:{id}",
  "commentary": "Post text content",
  "visibility": "PUBLIC",
  "distribution": {
    "feedDistribution": "MAIN_FEED",
    "targetEntities": [],
    "thirdPartyDistributionChannels": []
  },
  "lifecycleState": "PUBLISHED",
  "isReshareDisabledByAuthor": false,
  "content": {
    "media": {
      "title": "Image",
      "id": "urn:li:digitalmediaAsset:..."
    }
  }
}
```

---

## Media Upload Flow (3-Step Process)

According to [Images API documentation](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/images-api):

### Step 1: Register Upload ✅
```
POST /v2/assets?action=registerUpload
```
Returns: `uploadUrl` and `asset` URN

### Step 2: Upload Binary ✅
```
PUT {uploadUrl}
Content-Type: image/png
Body: [binary image data]
```

### Step 3: Wait & Create Post ✅
```
[WAIT 2 seconds for processing]
POST /v2/posts
Body: { content: { media: { id: asset } } }
```

**All three steps implemented correctly!**

---

## Expected Response

According to LinkedIn docs, successful post creation returns:
- **Status Code:** `201 Created`
- **Post ID:** In `X-RestLi-Id` response header
- **Response Body:** Post details or empty

---

## Testing Checklist

Based on LinkedIn's documentation:

- ✅ **Auth Scope:** `w_member_social` (required for posting)
- ✅ **API Endpoint:** `/v2/posts` (modern Posts API)
- ✅ **Headers:** All required headers present
- ✅ **Payload:** Matches documented schema
- ✅ **Media Format:** Correct structure with titles
- ✅ **Processing Delay:** 2-second wait after upload
- ✅ **Author URN:** Correct format for organizations
- ✅ **Error Handling:** Detailed logging and debug output

---

## What Was Wrong Before

1. ❌ **Missing `Linkedin-Version` header** - Required by Posts API
2. ❌ **Missing `title` field** in media content - Required field
3. ❌ **No processing delay** - LinkedIn needs time to process uploaded media
4. ❌ **Carousel images missing titles** - Each slide needs a title

---

## What's Correct Now

1. ✅ **All required headers** present (including `Linkedin-Version`)
2. ✅ **Correct media payload** format with titles
3. ✅ **2-second processing delay** after media upload
4. ✅ **Debug logging** to see exact payload sent
5. ✅ **Proper error handling** with detailed messages

---

## Deployment Status

✅ **Backend Files Updated:**
- `linkedpilot/adapters/linkedin_adapter.py` (42KB)
- `linkedpilot/routes/scheduled_posts.py` (14KB)
- `linkedpilot/routes/ai_content.py` (22KB)

✅ **Backend Restarted:** PM2 service online

---

## Test Now

Create a post with an image and click "Post Now". You should see:

```
[IMAGE] Uploading image: https://...
[SUCCESS] Image uploaded! URN: urn:li:digitalmediaAsset:...
[SEND] Sending to LinkedIn Posts API...
[DEBUG] Full payload:
{
  "author": "urn:li:organization:108737174",
  "commentary": "Your post text...",
  "content": {
    "media": {
      "title": "Image",
      "id": "urn:li:digitalmediaAsset:..."
    }
  },
  ...
}
📬 LinkedIn response: 201
✅ Post created successfully!
```

---

## References

All implementations are based on official Microsoft/LinkedIn documentation:
- https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api
- https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/images-api
- https://learn.microsoft.com/en-us/linkedin/consumer/integrations/self-serve/share-on-linkedin





## Reference Documentation

Based on official LinkedIn documentation:
- [Share on LinkedIn (Consumer API)](https://learn.microsoft.com/en-us/linkedin/consumer/integrations/self-serve/share-on-linkedin)
- [Posts API (Marketing API)](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api)
- [Images API](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/images-api)
- [Getting Access](https://learn.microsoft.com/en-us/linkedin/shared/authentication/getting-access)

---

## API Choice

We're using the **Posts API** (`/v2/posts`), which is the modern marketing API for creating organic and sponsored posts.

### Why Posts API vs ugcPosts?
- **Posts API** (`/v2/posts`) - Modern, supports both organic and sponsored posts
- **ugcPosts API** (`/v2/ugcPosts`) - Older consumer API, different payload format

---

## Changes Made to Match LinkedIn Documentation

### 1. ✅ **Added Required `Linkedin-Version` Header**

According to [LinkedIn Posts API docs](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api), the `Linkedin-Version` header is **required**.

**Format:** `YYYYMM` (e.g., "202510" for October 2025)

**BEFORE (Missing header):**
```python
headers={
    "Authorization": f"Bearer {access_token}",
    "Content-Type": "application/json",
    "X-Restli-Protocol-Version": "2.0.0"
}
```

**AFTER (With required header):**
```python
from datetime import datetime
version_header = datetime.now().strftime("%Y%m")  # "202510"

headers={
    "Authorization": f"Bearer {access_token}",
    "Content-Type": "application/json",
    "X-Restli-Protocol-Version": "2.0.0",
    "Linkedin-Version": version_header  # ✅ Required!
}
```

**File:** `backend/linkedpilot/adapters/linkedin_adapter.py` (Line 254-264)

---

### 2. ✅ **Correct Media Payload Format**

According to the [Posts API documentation](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api), media posts require specific structure:

**Single Image:**
```json
{
  "content": {
    "media": {
      "title": "Image title",
      "id": "urn:li:digitalmediaAsset:..."
    }
  }
}
```

**Carousel Images:**
```json
{
  "content": {
    "multiImage": {
      "images": [
        {"title": "Slide 1", "id": "urn:..."},
        {"title": "Slide 2", "id": "urn:..."}
      ]
    }
  }
}
```

**Implementation:** `backend/linkedpilot/adapters/linkedin_adapter.py` (Line 229-245)

---

### 3. ✅ **Added Media Processing Delay**

LinkedIn needs time to process uploaded media assets before they can be used in posts. Added a 2-second delay after image upload.

**Implementation:**
```python
media_urns.append(media_urn)
print(f"   [SUCCESS] Image uploaded! URN: {media_urn}")
# Give LinkedIn a moment to process the media asset
import asyncio
await asyncio.sleep(2)
```

**Files:**
- `backend/linkedpilot/routes/scheduled_posts.py` (Line 209-211)
- `backend/linkedpilot/routes/ai_content.py` (Line 544-546)

---

### 4. ✅ **Correct Request Headers**

Our implementation matches LinkedIn's requirements:

| Header                        | Value              | Required | Status |
| ----------------------------- | ------------------ | -------- | ------ |
| `Authorization`               | `Bearer {token}`   | Yes      | ✅      |
| `Content-Type`                | `application/json` | Yes      | ✅      |
| `X-Restli-Protocol-Version`   | `2.0.0`            | Yes      | ✅      |
| `Linkedin-Version`            | `YYYYMM`           | Yes      | ✅ NEW  |

---

### 5. ✅ **Correct Post Structure**

Our post payload matches the Posts API schema:

```json
{
  "author": "urn:li:organization:{id}",
  "commentary": "Post text content",
  "visibility": "PUBLIC",
  "distribution": {
    "feedDistribution": "MAIN_FEED",
    "targetEntities": [],
    "thirdPartyDistributionChannels": []
  },
  "lifecycleState": "PUBLISHED",
  "isReshareDisabledByAuthor": false,
  "content": {
    "media": {
      "title": "Image",
      "id": "urn:li:digitalmediaAsset:..."
    }
  }
}
```

---

## Media Upload Flow (3-Step Process)

According to [Images API documentation](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/images-api):

### Step 1: Register Upload ✅
```
POST /v2/assets?action=registerUpload
```
Returns: `uploadUrl` and `asset` URN

### Step 2: Upload Binary ✅
```
PUT {uploadUrl}
Content-Type: image/png
Body: [binary image data]
```

### Step 3: Wait & Create Post ✅
```
[WAIT 2 seconds for processing]
POST /v2/posts
Body: { content: { media: { id: asset } } }
```

**All three steps implemented correctly!**

---

## Expected Response

According to LinkedIn docs, successful post creation returns:
- **Status Code:** `201 Created`
- **Post ID:** In `X-RestLi-Id` response header
- **Response Body:** Post details or empty

---

## Testing Checklist

Based on LinkedIn's documentation:

- ✅ **Auth Scope:** `w_member_social` (required for posting)
- ✅ **API Endpoint:** `/v2/posts` (modern Posts API)
- ✅ **Headers:** All required headers present
- ✅ **Payload:** Matches documented schema
- ✅ **Media Format:** Correct structure with titles
- ✅ **Processing Delay:** 2-second wait after upload
- ✅ **Author URN:** Correct format for organizations
- ✅ **Error Handling:** Detailed logging and debug output

---

## What Was Wrong Before

1. ❌ **Missing `Linkedin-Version` header** - Required by Posts API
2. ❌ **Missing `title` field** in media content - Required field
3. ❌ **No processing delay** - LinkedIn needs time to process uploaded media
4. ❌ **Carousel images missing titles** - Each slide needs a title

---

## What's Correct Now

1. ✅ **All required headers** present (including `Linkedin-Version`)
2. ✅ **Correct media payload** format with titles
3. ✅ **2-second processing delay** after media upload
4. ✅ **Debug logging** to see exact payload sent
5. ✅ **Proper error handling** with detailed messages

---

## Deployment Status

✅ **Backend Files Updated:**
- `linkedpilot/adapters/linkedin_adapter.py` (42KB)
- `linkedpilot/routes/scheduled_posts.py` (14KB)
- `linkedpilot/routes/ai_content.py` (22KB)

✅ **Backend Restarted:** PM2 service online

---

## Test Now

Create a post with an image and click "Post Now". You should see:

```
[IMAGE] Uploading image: https://...
[SUCCESS] Image uploaded! URN: urn:li:digitalmediaAsset:...
[SEND] Sending to LinkedIn Posts API...
[DEBUG] Full payload:
{
  "author": "urn:li:organization:108737174",
  "commentary": "Your post text...",
  "content": {
    "media": {
      "title": "Image",
      "id": "urn:li:digitalmediaAsset:..."
    }
  },
  ...
}
📬 LinkedIn response: 201
✅ Post created successfully!
```

---

## References

All implementations are based on official Microsoft/LinkedIn documentation:
- https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api
- https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/images-api
- https://learn.microsoft.com/en-us/linkedin/consumer/integrations/self-serve/share-on-linkedin







