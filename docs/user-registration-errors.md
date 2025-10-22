# User Registration Error Messages

This document lists all possible error responses that can be returned by the `/users/register` endpoint.

## Validation Errors (Status: 400)

### Required Fields Missing

```json
{
  "success": false,
  "message": "Username, email, password, and gender are required."
}
```

### Username Too Short

```json
{
  "success": false,
  "message": "Username must be at least 3 characters long."
}
```

### Invalid Email Format

```json
{
  "success": false,
  "message": "Invalid email format."
}
```

### Password Too Short

```json
{
  "success": false,
  "message": "Password must be at least 6 characters long."
}
```

## Conflict Errors (Status: 409)

### Username Already Taken

```json
{
  "success": false,
  "message": "Validation failed.",
  "errors": [
    {
      "field": "username",
      "message": "Username is already taken."
    }
  ]
}
```

### Email Already Exists

```json
{
  "success": false,
  "message": "Validation failed.",
  "errors": [
    {
      "field": "email",
      "message": "An account with this email already exists."
    }
  ]
}
```

### Both Username and Email Taken

```json
{
  "success": false,
  "message": "Validation failed.",
  "errors": [
    {
      "field": "username",
      "message": "Username is already taken."
    },
    {
      "field": "email",
      "message": "An account with this email already exists."
    }
  ]
}
```

## Server Errors (Status: 500)

### Database or Internal Server Error

```json
{
  "success": false,
  "error": {
    "message": "Something went wrong on the server.",
    "details": "...",
    "stack": "..." // Only in development mode
  }
}
```

## Success Response (Status: 201)

For reference, the successful registration response:

````json
{
  "success": true,
  "message": "User logged in successfully",
  "data": {
    "user": {
      "id": 123,
      "username": "exampleuser",
      "email": "user@example.com",
      "gender": "male",
      // ... other user fields
    },
    "token": "jwt.token.here"
  }
}
```</content>
<parameter name="filePath">/home/hezekiahs-dev/Desktop/projects/vehance/extra/arewaflix-node-ramp/docs/user-registration-errors.md
````
