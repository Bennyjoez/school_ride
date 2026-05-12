    
"""
    GET    /routes/                    - list routes in school
    POST   /routes/                    - create a route
    GET    /routes/{id}/               - retrieve a route (with stops)
    PATCH  /routes/{id}/               - update a route
    DELETE /routes/{id}/               - delete a route
    GET    /routes/{id}/stops/         - list stops for a route
    POST   /routes/{id}/stops/         - add a stop to a route
    GET    /routes/{id}/stops/{stop_id}/ - retrieve a stop
    PATCH  /routes/{id}/stops/{stop_id}/ - update a stop
    DELETE /routes/{id}/stops/{stop_id}/ - delete a stop
"""
"""
    GET    /vehicles/                  - list vehicles in school
    POST   /vehicles/                  - create a vehicle
    GET    /vehicles/{id}/             - retrieve a vehicle
    PATCH  /vehicles/{id}/             - update a vehicle
    DELETE /vehicles/{id}/             - delete a vehicle
    GET    /vehicles/available/        - vehicles with status=available
    PATCH  /vehicles/{id}/assign-driver/ - assign a driver to a vehicle
"""