"""
 API endpoints for user management:
    POST /auth/login/   — obtain access + refresh tokens
    POST /auth/refresh/ — exchange refresh token for a new access token


    POST   /users/               — create a new user
    GET    /users/{id}/          — retrieve a user
    PATCH  /users/{id}/          — update a user
    DELETE /users/{id}/          — deactivate a user (soft delete)
    GET    /users/me/            — current user's profile
    PATCH  /users/me/            — update current user's profile
    POST   /users/me/change-password/ — change own password
    GET    /users/drivers/       — list all drivers in the school
"""