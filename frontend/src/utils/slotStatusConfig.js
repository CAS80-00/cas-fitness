/**
 * Slot Status Configuration
 * Defines roles, permissions, colors, and public display for each status
 */

export const SLOT_STATUSES = {
  APPROVED: {
    label: "Approved",
    color: "#3b82f6",
    borderColor: "#1e40af",
    roles: ["superuser"],
    description: "Created and approved, awaiting assignment",
  },
  CONSULTATION: {
    label: "Consultation",
    color: "#10b981",
    borderColor: "#047857",
    roles: ["superuser", "employee", "trainer"],
    publicDisplay: "Available",
    description: "Available for consultation bookings",
  },
  WORKOUT: {
    label: "Workout",
    color: "#8b5cf6",
    borderColor: "#6d28d9",
    roles: ["superuser", "employee", "trainer"],
    publicDisplay: "Available",
    description: "Available for workout sessions",
  },
  BREAK: {
    label: "Break",
    color: "#f59e0b",
    borderColor: "#d97706",
    roles: ["superuser", "employee", "trainer"],
    publicDisplay: "Break",
    description: "Break time (not available)",
  },
  LUNCH: {
    label: "Lunch",
    color: "#ec4899",
    borderColor: "#be185d",
    roles: ["superuser", "employee", "trainer"],
    publicDisplay: "Lunch",
    description: "Lunch break (not available)",
  },
  SICK: {
    label: "Sick",
    color: "#ef4444",
    borderColor: "#991b1b",
    roles: ["superuser"],
    publicDisplay: "Unavailable",
    description: "Marked as sick (unavailable)",
  },
  NO_SHOW: {
    label: "No Show",
    color: "#dc2626",
    borderColor: "#7f1d1d",
    roles: ["superuser"],
    publicDisplay: "Unavailable",
    description: "No show (unavailable)",
  },
  VACATION: {
    label: "Vacation",
    color: "#06b6d4",
    borderColor: "#0e7490",
    roles: ["superuser"],
    publicDisplay: "Vacation",
    description: "On vacation (unavailable)",
  },
  PERSONAL_TIME: {
    label: "Personal Time",
    color: "#a855f7",
    borderColor: "#6d28d9",
    roles: ["superuser"],
    publicDisplay: "Unavailable",
    description: "Personal time (unavailable)",
  },
  REMOVED: {
    label: "Removed",
    color: "#6b7280",
    borderColor: "#374151",
    roles: ["superuser"],
    publicDisplay: "Hidden",
    description: "Removed from availability",
  },
};

export const getMemberStatusOptions = () => {
  return ["CONSULTATION", "WORKOUT", "BREAK", "LUNCH"];
};

export const getSuperuserStatusOptions = () => {
  return ["CONSULTATION", "WORKOUT", "BREAK", "LUNCH", "SICK", "NO_SHOW", "VACATION", "PERSONAL_TIME", "REMOVED"];
};

export const getWholeDayStatusOptions = () => {
  return ["SICK", "NO_SHOW", "VACATION", "PERSONAL_TIME", "REMOVED"];
};

export const getStatusColor = (status) => {
  return SLOT_STATUSES[status]?.color || "#gray";
};

export const getPublicDisplay = (status) => {
  return SLOT_STATUSES[status]?.publicDisplay || "Unavailable";
};
