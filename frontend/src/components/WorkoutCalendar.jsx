import { useCallback, useEffect, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import styles from "../styles/WorkoutCalendar.module.css";

/**
 * WorkoutCalendar
 * Complete calendar system with:
 * - Student booking flow
 * - Trainer availability setup
 * - Session status management
 * - Superuser settings
 * - Timezone handling (display local, store UTC)
 */
export default function WorkoutCalendar({
  trainerId,
  isStudent = true,
  isTrainer = false,
  isSuperuser = false,
  userRole,
}) {
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "/api";
  const [sessions, setSessions] = useState([]);
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [selectedTrainer, setSelectedTrainer] = useState(trainerId || "");
  const [trainers, setTrainers] = useState([]);
  const [loading, setLoading] = useState(false);

  // Trainer availability UI state
  const [showAvailabilitySetup, setShowAvailabilitySetup] = useState(false);
  const [availabilityRules, setAvailabilityRules] = useState([]);
  const [vacations, setVacations] = useState([]);

  // Superuser settings state
  const [showSettings, setShowSettings] = useState(false);
  const [calendarSettings, setCalendarSettings] = useState({
    slot_duration_minutes: 60,
    break_duration_minutes: 15,
    cancellation_cutoff_hours: 24,
  });

  // Session status update state
  const [selectedSession, setSelectedSession] = useState(null);
  const [showStatusModal, setShowStatusModal] = useState(false);

  const getToken = () => localStorage.getItem("cas_jwt");

  const loadSessions = useCallback(async () => {
    const token = getToken();
    if (!token) return;

    setLoading(true);
    try {
      const res = await fetch(`${apiBaseUrl}/calendars/workouts`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Unable to load workout sessions.");

      setSessions(
        (data.sessions || []).map((session) => ({
          id: String(session.id),
          title: `${session.status} ${session.student_id ? "- Booked" : "- Available"}`,
          start: session.start_time,
          end: session.end_time,
          backgroundColor: getEventColor(session.status),
          borderColor: getEventColor(session.status),
          extendedProps: {
            trainerId: session.trainer_id,
            studentId: session.student_id,
            status: session.status,
            originalSession: session,
          },
        }))
      );
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl]);

  const getEventColor = (status) => {
    switch (status) {
      case "SCHEDULED":
        return "#3b82f6";
      case "COMPLETED":
        return "#10b981";
      case "FAILED":
        return "#ef4444";
      case "ABSENT":
        return "#f97316";
      default:
        return "#6b7280";
    }
  };

  const loadTrainerAvailability = useCallback(async () => {
    const token = getToken();
    if (!token) return;

    try {
      const [availRes, vacRes] = await Promise.all([
        fetch(`${apiBaseUrl}/calendars/trainer-availability`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${apiBaseUrl}/calendars/trainer-vacations`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (availRes.ok) {
        const availData = await availRes.json();
        setAvailabilityRules(availData.availability || []);
      }

      if (vacRes.ok) {
        const vacData = await vacRes.json();
        setVacations(vacData.vacations || []);
      }
    } catch (error) {
      setErrorMessage(error.message);
    }
  }, [apiBaseUrl]);

  const loadCalendarSettings = useCallback(async () => {
    try {
      const res = await fetch(`${apiBaseUrl}/calendars/settings`);
      const data = await res.json();
      if (res.ok) {
        setCalendarSettings(data.settings);
      }
    } catch (error) {
      console.error("Error loading settings:", error);
    }
  }, [apiBaseUrl]);

  useEffect(() => {
    loadSessions();
    if (isTrainer) {
      loadTrainerAvailability();
    }
    if (isSuperuser) {
      loadCalendarSettings();
    }
  }, [loadSessions, loadTrainerAvailability, loadCalendarSettings, isTrainer, isSuperuser]);

  const handleSlotSelect = async (arg) => {
    if (!isStudent) return;

    const token = getToken();
    if (!token || !selectedTrainer) {
      setErrorMessage("Please select a trainer before booking.");
      return;
    }

    const start = arg.startStr;
    const end = arg.endStr;

    try {
      const res = await fetch(`${apiBaseUrl}/calendars/workouts/book`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          trainerId: selectedTrainer,
          startTime: start,
          endTime: end,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to book workout.");
      setStatusMessage("Session scheduled successfully!");
      setErrorMessage("");
      loadSessions();
    } catch (error) {
      setErrorMessage(error.message);
    }
  };

  const handleEventClick = (info) => {
    if (isTrainer) {
      setSelectedSession(info.event.extendedProps.originalSession);
      setShowStatusModal(true);
    }
  };

  const handleStatusUpdate = async (newStatus) => {
    if (!selectedSession) return;

    const token = getToken();
    try {
      const res = await fetch(
        `${apiBaseUrl}/calendars/workouts/${selectedSession.id}/status`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ status: newStatus }),
        }
      );

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update status.");

      setStatusMessage(`Session marked as ${newStatus}`);
      setErrorMessage("");
      setShowStatusModal(false);
      setSelectedSession(null);
      loadSessions();
    } catch (error) {
      setErrorMessage(error.message);
    }
  };

  const handleAddAvailability = async (dayOfWeek, startTime, endTime, format) => {
    const token = getToken();
    try {
      const res = await fetch(`${apiBaseUrl}/calendars/trainer-availability`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          dayOfWeek,
          startTime,
          endTime,
          locationFormat: format,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to set availability.");

      setStatusMessage("Availability rule saved!");
      setErrorMessage("");
      loadTrainerAvailability();
    } catch (error) {
      setErrorMessage(error.message);
    }
  };

  const handleAddVacation = async (startDate, endDate) => {
    const token = getToken();
    try {
      const res = await fetch(`${apiBaseUrl}/calendars/trainer-vacations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ startDate, endDate }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add vacation.");

      setStatusMessage("Vacation blockout added!");
      setErrorMessage("");
      loadTrainerAvailability();
    } catch (error) {
      setErrorMessage(error.message);
    }
  };

  const handleUpdateSettings = async () => {
    const token = getToken();
    try {
      const res = await fetch(`${apiBaseUrl}/calendars/settings`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          slotDurationMinutes: calendarSettings.slot_duration_minutes,
          breakDurationMinutes: calendarSettings.break_duration_minutes,
          cancellationCutoffHours: calendarSettings.cancellation_cutoff_hours,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update settings.");

      setStatusMessage("Calendar settings updated!");
      setErrorMessage("");
      setShowSettings(false);
    } catch (error) {
      setErrorMessage(error.message);
    }
  };

  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div className={styles.card}>
      {/* Header */}
      <div className={styles.header}>
        <h3 className={styles.title}>Workout Session Schedule</h3>
        <div className="flex gap-2">
          {isStudent && (
            <select
              value={selectedTrainer}
              onChange={(e) => setSelectedTrainer(e.target.value)}
              className={styles.trainerSelect}
            >
              <option value="">Select Trainer</option>
              <option value="trainer-1">Trainer 1</option>
              <option value="trainer-2">Trainer 2</option>
            </select>
          )}
          {isTrainer && (
            <button
              onClick={() => setShowAvailabilitySetup(!showAvailabilitySetup)}
              className="rounded bg-blue-600 px-3 py-1 text-xs text-white hover:bg-blue-700"
            >
              {showAvailabilitySetup ? "Hide" : "Setup"} Availability
            </button>
          )}
          {isSuperuser && (
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="rounded bg-purple-600 px-3 py-1 text-xs text-white hover:bg-purple-700"
            >
              {showSettings ? "Close" : "Settings"}
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      {statusMessage && (
        <div className="rounded border border-green-600 bg-green-900 bg-opacity-20 px-3 py-2 text-xs text-green-400">
          {statusMessage}
        </div>
      )}
      {errorMessage && (
        <div className="rounded border border-red-600 bg-red-900 bg-opacity-20 px-3 py-2 text-xs text-red-400">
          {errorMessage}
        </div>
      )}

      {/* Trainer Availability Setup Panel */}
      {showAvailabilitySetup && isTrainer && (
        <div className="space-y-4 rounded border border-blue-600 bg-blue-900 bg-opacity-20 p-4">
          <h4 className="font-semibold text-white">Set Your Availability</h4>

          {/* Availability Rules */}
          <div className="space-y-2">
            <h5 className="text-sm font-medium text-gray-300">Working Days</h5>
            {days.map((day, idx) => {
              const rule = availabilityRules.find((r) => r.day_of_week === idx);
              return (
                <div key={idx} className="flex items-center gap-2 text-xs text-gray-300">
                  <label className="w-12">{day}</label>
                  <input
                    type="time"
                    defaultValue={rule?.start_time || "09:00"}
                    className="w-20 rounded bg-gray-900 px-2 py-1 text-white"
                    onBlur={(e) => {
                      const endInput = e.target.nextElementSibling;
                      const endTime = endInput?.value || "17:00";
                      handleAddAvailability(idx, e.target.value, endTime, "IN_PERSON");
                    }}
                  />
                  <span>-</span>
                  <input
                    type="time"
                    defaultValue={rule?.end_time || "17:00"}
                    className="w-20 rounded bg-gray-900 px-2 py-1 text-white"
                    onBlur={(e) => {
                      const startInput = e.target.previousElementSibling?.previousElementSibling;
                      const startTime = startInput?.value || "09:00";
                      handleAddAvailability(idx, startTime, e.target.value, "IN_PERSON");
                    }}
                  />
                  <select className="w-24 rounded bg-gray-900 px-2 py-1 text-xs text-white">
                    <option value="IN_PERSON">In-Person</option>
                    <option value="VIDEO">Video</option>
                    <option value="STUDENT_CHOICE">Your Choice</option>
                  </select>
                </div>
              );
            })}
          </div>

          {/* Vacation Blockouts */}
          <div className="space-y-2 border-t border-blue-600 pt-4">
            <h5 className="text-sm font-medium text-gray-300">Vacation Blockouts</h5>
            <div className="flex gap-2">
              <input
                type="date"
                id="vacation-start"
                className="flex-1 rounded bg-gray-900 px-2 py-1 text-xs text-white"
                placeholder="Start"
              />
              <input
                type="date"
                id="vacation-end"
                className="flex-1 rounded bg-gray-900 px-2 py-1 text-xs text-white"
                placeholder="End"
              />
              <button
                onClick={() => {
                  const start = document.getElementById("vacation-start").value;
                  const end = document.getElementById("vacation-end").value;
                  if (start && end) {
                    handleAddVacation(start, end);
                    document.getElementById("vacation-start").value = "";
                    document.getElementById("vacation-end").value = "";
                  }
                }}
                className="rounded bg-blue-600 px-3 py-1 text-xs text-white hover:bg-blue-700"
              >
                Add
              </button>
            </div>
            {vacations.length > 0 && (
              <ul className="text-xs text-gray-400">
                {vacations.map((vac) => (
                  <li key={vac.id}>
                    {vac.start_date} to {vac.end_date}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* Superuser Settings Panel */}
      {showSettings && isSuperuser && (
        <div className="space-y-4 rounded border border-purple-600 bg-purple-900 bg-opacity-20 p-4">
          <h4 className="font-semibold text-white">Calendar Settings</h4>

          <div className="space-y-2">
            <label className="block text-xs text-gray-300">
              Slot Duration (minutes)
              <input
                type="number"
                min="15"
                value={calendarSettings.slot_duration_minutes}
                onChange={(e) =>
                  setCalendarSettings({
                    ...calendarSettings,
                    slot_duration_minutes: parseInt(e.target.value),
                  })
                }
                className="ml-2 w-20 rounded bg-gray-900 px-2 py-1 text-white"
              />
            </label>

            <label className="block text-xs text-gray-300">
              Break Duration (minutes)
              <input
                type="number"
                min="0"
                value={calendarSettings.break_duration_minutes}
                onChange={(e) =>
                  setCalendarSettings({
                    ...calendarSettings,
                    break_duration_minutes: parseInt(e.target.value),
                  })
                }
                className="ml-2 w-20 rounded bg-gray-900 px-2 py-1 text-white"
              />
            </label>

            <label className="block text-xs text-gray-300">
              Cancellation Cutoff (hours)
              <input
                type="number"
                min="1"
                value={calendarSettings.cancellation_cutoff_hours}
                onChange={(e) =>
                  setCalendarSettings({
                    ...calendarSettings,
                    cancellation_cutoff_hours: parseInt(e.target.value),
                  })
                }
                className="ml-2 w-20 rounded bg-gray-900 px-2 py-1 text-white"
              />
            </label>
          </div>

          <button
            onClick={handleUpdateSettings}
            className="w-full rounded bg-purple-600 px-3 py-2 text-sm text-white hover:bg-purple-700"
          >
            Save Settings
          </button>
        </div>
      )}

      {/* Calendar */}
      <FullCalendar
        plugins={[timeGridPlugin, interactionPlugin]}
        initialView="timeGridWeek"
        allDaySlot={false}
        slotMinTime="06:00:00"
        slotMaxTime="22:00:00"
        selectable={isStudent}
        select={handleSlotSelect}
        eventClick={handleEventClick}
        events={sessions}
        height="auto"
        headerToolbar={{
          left: "prev,next today",
          center: "title",
          right: "timeGridWeek,timeGridDay",
        }}
        showNonCurrentDates={true}
        loading={(isLoading) => setLoading(isLoading)}
      />

      {/* Session Status Modal */}
      {showStatusModal && selectedSession && isTrainer && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50">
          <div className="space-y-4 rounded-lg border border-gray-600 bg-gray-900 p-6">
            <h4 className="font-semibold text-white">Update Session Status</h4>
            <p className="text-xs text-gray-400">
              {new Date(selectedSession.start_time).toLocaleString()}
            </p>
            <div className="space-y-2">
              {["SCHEDULED", "COMPLETED", "FAILED", "ABSENT"].map((status) => (
                <button
                  key={status}
                  onClick={() => handleStatusUpdate(status)}
                  className={`w-full rounded px-3 py-2 text-sm font-medium ${
                    status === "COMPLETED"
                      ? "bg-green-600 text-white hover:bg-green-700"
                      : status === "FAILED"
                        ? "bg-red-600 text-white hover:bg-red-700"
                        : status === "ABSENT"
                          ? "bg-orange-600 text-white hover:bg-orange-700"
                          : "bg-blue-600 text-white hover:bg-blue-700"
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
            <button
              onClick={() => {
                setShowStatusModal(false);
                setSelectedSession(null);
              }}
              className="w-full rounded bg-gray-700 px-3 py-2 text-sm text-white hover:bg-gray-600"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
