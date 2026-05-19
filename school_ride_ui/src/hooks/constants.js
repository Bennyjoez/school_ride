// Shared constants used across users, forms, filters and badges

export const ROLE_LABELS = {
  1: "Admin",
  2: "Director",
  3: "Manager",
  4: "Teacher",
  5: "Driver",
  6: "Guardian",
};

// Maps user_type to Badge variant colour
export const ROLE_BADGE_VARIANT = {
  1: "purple", // Admin
  2: "blue", // Director
  3: "blue", // Manager
  4: "green", // Teacher
  5: "amber", // Driver
  6: "green", // Guardian
};

// For use in selects — excludes Admin option
export const USER_TYPES = [
  { value: "2", label: "Director" },
  { value: "3", label: "Manager" },
  { value: "4", label: "Teacher" },
  { value: "5", label: "Driver" },
  { value: "6", label: "Guardian" },
];

// For Admin use — includes Admin option
export const ADMIN_USER_TYPES = [{ value: "1", label: "Admin" }, ...USER_TYPES];

// Vehicle status labels and badge colours
export const VEHICLE_STATUS_LABEL = {
  available: "Available",
  in_service: "In Service",
  maintenance: "Maintenance",
};

export const VEHICLE_STATUS_BADGE = {
  available: "green",
  in_service: "amber",
  maintenance: "red",
};

// Vehicle type labels
export const VEHICLE_TYPE_LABEL = {
  1: "Bus",
  2: "Van",
  3: "Car",
};

// Trip status badge colours
export const TRIP_STATUS_BADGE = {
  scheduled: "blue",
  active: "green",
  completed: "default",
  cancelled: "red",
};

// Route direction labels
export const DIRECTION_LABEL = {
  AM: "Morning",
  PM: "Afternoon",
  BOTH: "Both",
};

export const TIMEZONES = [
  "Africa/Nairobi",
  "Africa/Lagos",
  "Africa/Johannesburg",
  "Africa/Cairo",
  "Africa/Accra",
  "Europe/London",
  "Europe/Paris",
  "America/New_York",
  "America/Chicago",
  "America/Los_Angeles",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Australia/Sydney",
];

export const VEHICLE_TYPE_OPTIONS = [
  { value: "1", label: "Bus" },
  { value: "2", label: "Van" },
  { value: "3", label: "Car" },
];

export const VEHICLE_STATUS_OPTIONS = [
  { value: "available", label: "Available" },
  { value: "in_service", label: "In Service" },
  { value: "maintenance", label: "Maintenance" },
];

export const DIRECTION_OPTIONS = [
  { value: 'AM',   label: 'Morning (AM)'   },
  { value: 'PM',   label: 'Afternoon (PM)' },
  { value: 'BOTH', label: 'Both'           },
]