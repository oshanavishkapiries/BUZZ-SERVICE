# Text.lk - SMS Gateway Sri Lanka API Documentation

**Generated Text Document**

---

## Welcome to Text.lk - SMS Gateway Sri Lanka Docs

Get familiar with our APIs and technical resources in your favorite languages.

### Available APIs:
- Contacts API
- Contact Groups API
- SMS API
- Profile API

---

## CONTACTS API

The Text.lk SMS Gateway Sri Lanka Contacts API helps you manage contacts that are identified by a unique random ID. Using this ID, you can create, view, update, or delete contacts. This API works as a collection of customer-specific contacts that allows you to group them and assign custom values that you can later use when sending SMS template messages.

### Technical Specifications:
- **Protocol**: HTTP/HTTPS
- **Architecture**: RESTful
- **Authentication**: API Token (Access Key)
- **Request/Response Format**: JSON
- **Encoding**: UTF-8
- **Values**: URL encoded

### Base API Endpoint:
```
https://app.text.lk/api/http/contacts
```

### Global Parameters:
| Parameter | Required | Description |
|-----------|----------|-------------|
| api_token | YES | API Token from Developers option |
| Accept | YES | Set to `application/json` |
| Content-Type | YES | Set to `application/json` |

---

## 1. Create a Contact

Creates a new contact object. Text.lk returns the created contact object with each request.

### Endpoint:
```
POST https://app.text.lk/api/http/contacts/{group_id}/store
```

### Parameters:
| Parameter | Required | Type | Description |
|-----------|----------|------|-------------|
| group_id | YES | string | Contact Groups UID |
| PHONE | YES | number | The phone number of the contact |
| OTHER_FIELDS | NO | string | Additional fields: FIRST_NAME, LAST_NAME, etc. (depending on contact group configuration) |

### Example Request (cURL):
```bash
curl -X POST https://app.text.lk/api/http/contacts/6065ecdc9184a/store \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json' \
  -d '{
    "api_token":"3025|WF9gS91cBKQlotCLlKytQYdNhmqpDZ8Sq9N8w0UY949716e8",
    "PHONE":"94710000000",
    "FIRST_NAME":"Jhon",
    "LAST_NAME":"Doe"
  }'
```

### Success Response:
```json
{
  "status": "success",
  "data": "contacts data with all details"
}
```

### Error Response:
```json
{
  "status": "error",
  "message": "A human-readable description of the error."
}
```

---

## 2. View a Contact

Retrieves the information of an existing contact. You only need to supply the unique contact UID and group UID that was returned upon creation.

### Endpoint:
```
POST https://app.text.lk/api/http/contacts/{group_id}/search/{uid}
```

### Parameters:
| Parameter | Required | Type | Description |
|-----------|----------|------|-------------|
| group_id | YES | string | Contact Groups UID |
| uid | YES | string | Contact UID |

### Example Request (cURL):
```bash
curl -X POST https://app.text.lk/api/http/contacts/6065ecdc9184a/search/606732aec8705 \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json' \
  -d '{
    "api_token":"3025|WF9gS91cBKQlotCLlKytQYdNhmqpDZ8Sq9N8w0UY949716e8"
  }'
```

### Response:
```json
{
  "status": "success",
  "data": "contacts data with all details"
}
```

---

## 3. Update a Contact

Updates an existing contact. You only need to supply the unique UID of the contact and contact group UID.

### Endpoint:
```
PATCH https://app.text.lk/api/http/contacts/{group_id}/update/{uid}
```

### Parameters:
| Parameter | Required | Type | Description |
|-----------|----------|------|-------------|
| group_id | YES | string | Contact Groups UID |
| uid | YES | string | Contact UID |
| PHONE | YES | number | The phone number of the contact |
| OTHER_FIELDS | NO | string | Additional fields: FIRST_NAME, LAST_NAME, etc. |

### Example Request (cURL):
```bash
curl -X PATCH https://app.text.lk/api/http/contacts/6065ecdc9184a/update/606732aec8705 \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json' \
  -d '{
    "api_token":"3025|WF9gS91cBKQlotCLlKytQYdNhmqpDZ8Sq9N8w0UY949716e8",
    "PHONE":"94710000000",
    "FIRST_NAME":"Jhon",
    "LAST_NAME":"Doe"
  }'
```

### Response:
```json
{
  "status": "success",
  "data": "contacts data with all details"
}
```

---

## 4. Delete a Contact

Deletes an existing contact. You only need to supply the unique contact UID and group UID.

### Endpoint:
```
DELETE https://app.text.lk/api/http/contacts/{group_id}/delete/{uid}
```

### Parameters:
| Parameter | Required | Type | Description |
|-----------|----------|------|-------------|
| group_id | YES | string | Contact Groups UID |
| uid | YES | string | Contact UID |

### Example Request (cURL):
```bash
curl -X DELETE https://app.text.lk/api/http/contacts/6065ecdc9184a/delete/606732aec8705 \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json' \
  -d '{
    "api_token":"3025|WF9gS91cBKQlotCLlKytQYdNhmqpDZ8Sq9N8w0UY949716e8"
  }'
```

### Response:
```json
{
  "status": "success",
  "data": "contacts data with all details"
}
```

---

## 5. View All Contacts in Group

Retrieves all contacts within a specific contact group.

### Endpoint:
```
POST https://app.text.lk/api/http/contacts/{group_id}/all
```

### Parameters:
| Parameter | Required | Type | Description |
|-----------|----------|------|-------------|
| group_id | YES | string | Contact Groups UID |

### Example Request (cURL):
```bash
curl -X POST https://app.text.lk/api/http/contacts/6065ecdc9184a/all \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json' \
  -d '{
    "api_token":"3025|WF9gS91cBKQlotCLlKytQYdNhmqpDZ8Sq9N8w0UY949716e8"
  }'
```

### Success Response:
```json
{
  "status": "success",
  "data": "contacts data with pagination"
}
```

### Error Response:
```json
{
  "status": "error",
  "message": "A human-readable description of the error."
}
```

---

## Support & Additional Resources

- **WhatsApp Hotline**: Available for support
- **Developer Dashboard**: https://app.text.lk/developers/http-docs
- **API Token Management**: Access via Developers option in dashboard

---

**Copyright © Text.lk - 2026 Text.lk - SMS Gateway Sri Lanka, All rights reserved.**

---

> **Note**: 
> - Replace placeholder values (`{group_id}`, `{uid}`, `api_token`) with your actual credentials and IDs.
> - All phone numbers should be in international format (e.g., `94710000000` for Sri Lanka).
> - Ensure your API token is kept secure and not exposed in client-side code.
> - Rate limits and premium features may apply—check your dashboard for details.

---

*Document generated from: API Documents - Text.lk - SMS Gateway Sri Lanka.pdf*  
*Date: May 2026*