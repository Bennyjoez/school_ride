import api from "../axios";

// Auth
export const login = (data) => api.post("/auth/login/", data);
export const refresh = (data) => api.post("/auth/refresh/", data);

// Users
export const getUsers = () => api.get("/users/");
export const getUser = (id) => api.get(`/users/${id}/`);
export const createUser = (data) => api.post("/users/", data);
export const updateUser = (id, data) => api.patch(`/users/${id}/`, data);
export const deactivateUser = (id) => api.delete(`/users/${id}/`);
export const getMe = () => api.get("/users/me/");
export const updateMe = (data) => api.patch("/users/me/", data);
export const changePassword = (data) =>
  api.post("/users/me/change-password/", data);
export const getDrivers = () => api.get("/users/drivers/");
