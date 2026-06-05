import api from "../axios";

// Schools
export const getSchools = () => api.get("/schools/");
export const getSchool = (id) => api.get(`/schools/${id}/`);
export const createSchool = (data) => api.post("/schools/", data);
export const updateSchool = (id, data) => api.patch(`/schools/${id}/`, data);
export const deactivateSchool = (id) => api.delete(`/schools/${id}/`);

// Vehicles
export const getVehicles = () => api.get("/vehicles/");
export const getAvailableVehicles = () => api.get("/vehicles/available/");
export const getVehicle = (id) => api.get(`/vehicles/${id}/`);
export const createVehicle = (data) => api.post("/vehicles/", data);
export const updateVehicle = (id, data) => api.patch(`/vehicles/${id}/`, data);
export const deleteVehicle = (id) => api.delete(`/vehicles/${id}/`);
export const assignDriver = (id, data) =>
  api.patch(`/vehicles/${id}/assign-driver/`, data);

// Routes
export const getRoutes = () => api.get("/routes/");
export const getRoute = (id) => api.get(`/routes/${id}/`);
export const createRoute = (data) => api.post("/routes/", data);
export const updateRoute = (id, data) => api.patch(`/routes/${id}/`, data);
export const deleteRoute = (id) => api.delete(`/routes/${id}/`);

// Stops
export const getStops = (routeId) => api.get(`/routes/${routeId}/stops/`);
export const createStop = (routeId, data) =>
  api.post(`/routes/${routeId}/stops/`, data);
export const updateStop = (routeId, stopId, data) =>
  api.patch(`/routes/${routeId}/stops/${stopId}/`, data);
export const deleteStop = (routeId, stopId) =>
  api.delete(`/routes/${routeId}/stops/${stopId}/`);

// Students
export const getStudents = () => api.get("/students/");
export const getStudent = (id) => api.get(`/students/${id}/`);
export const createStudent = (data) => api.post("/students/", data);
export const updateStudent = (id, data) => api.patch(`/students/${id}/`, data);
export const deactivateStudent = (id) => api.delete(`/students/${id}/`);
export const generateCode = (id) => api.post(`/students/${id}/generate-code/`);
export const getStudentRoutes = (id) => api.get(`/students/${id}/routes/`);
export const assignStudentRoute = (id, data) =>
  api.post(`/students/${id}/routes/`, data);
export const updateStudentRoute = (studentId, assignmentId, data) =>
  api.patch(`/students/${studentId}/routes/${assignmentId}/`, data);
export const removeStudentRoute = (studentId, assignmentId) =>
  api.delete(`/students/${studentId}/routes/${assignmentId}/`);

// Trips
export const getTrips = () => api.get("/trips/");
export const getTrip = (id) => api.get(`/trips/${id}/`);
export const createTrip = (data) => api.post("/trips/", data);
export const updateTrip = (id, data) => api.patch(`/trips/${id}/`, data);
export const startTrip = (id) => api.post(`/trips/${id}/start/`);
export const endTrip = (id) => api.post(`/trips/${id}/end/`);
export const checkinEvent = (id, data) =>
  api.post(`/trips/${id}/checkin/`, data);
export const postPing = (id, data) => api.post(`/trips/${id}/ping/`, data);
export const getTripPings = (id) => api.get(`/trips/${id}/pings/`);

// Notifications
export const getNotifications = (params = {}) => api.get("/notifications/", { params });
export const getUnreadCount = () => api.get("/notifications/unread_count/");
export const getNotification = (id) =>  api.get(`/notifications/${id}/`);
