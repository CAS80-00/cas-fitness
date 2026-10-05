import { useEffect, useState, useMemo } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import styles from "../styles/TrainerConsolidatedCalendar.module.css";

/**
 * EmployeeConsolidatedCalendar
 * Single unified calendar view for any employee showing:
 * - Available consultation slots (green)
 * - Booked consultations (orange)
 * - Available workout slots (blue)
 * - Booked workout sessions (purple)
 */
export default function EmployeeConsolidatedCalendar({ employeeId, refreshTrigger = 0 }) {
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "/api";
  const [consultationSlots, setConsultationSlots] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [workoutSlots, setWorkoutSlots] = useState([]);
  const [workoutSessions, setWorkoutSessions] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const apiToken = () => localStorage.getItem("cas_jwt");

  // Load all calendar data
  useEffect(() => {
    if (!employeeId) return;
    loadCalendarData();
  }, [employeeId, refreshTrigger]);

  const loadCalendarData = async () => {
    try {
      setLoading(true);
      setError("");

      // Fetch consultation slots
      const consultationSlotsResponse = await fetch(
        `${apiBaseUrl}/calendars/trainer-consultation-slots?trainer_id=${employeeId}`,
        {
          headers: {
            Authorization: `Bearer ${apiToken()}`,
          },
        }
      );

      if (!consultationSlotsResponse.ok) {
        throw new Error(`Failed to load consultation slots: ${consultationSlotsResponse.statusText}`);
      }

      const consultationSlotsData = await consultationSlotsResponse.json();
      setConsultationSlots(consultationSlotsData.data || []);

      // Fetch booked consultations
      const bookingsResponse = await fetch(
        `${apiBaseUrl}/calendars/trainer-consultations?trainer_id=${employeeId}`,
        {
          headers: {
            Authorization: `Bearer ${apiToken()}`,
          },
        }
      );

      if (!bookingsResponse.ok) {
        throw new Error(`Failed to load bookings: ${bookingsResponse.statusText}`);
      }

      const bookingsData = await bookingsResponse.json();
      setBookings(bookingsData.data || []);

      // Fetch workout slots
      const workoutSlotsResponse = await fetch(
        `${apiBaseUrl}/calendars/trainer-workout-slots?trainer_id=${employeeId}`,
        {
          headers: {
            Authorization: `Bearer ${apiToken()}`,
          },
        }
      );

      if (!workoutSlotsResponse.ok) {
        throw new Error(`Failed to load workout slots: ${workoutSlotsResponse.statusText}`);
      }

      const workoutSlotsData = await workoutSlotsResponse.json();
      setWorkoutSlots(workoutSlotsData.data || []);

      // Fetch booked workout sessions
      const workoutSessionsResponse = await fetch(
        `${apiBaseUrl}/calendars/trainer-workouts?trainer_id=${employeeId}`,
        {
          headers: {
            Authorization: `Bearer ${apiToken()}`,
          },
        }
      );

      if (!workoutSessionsResponse.ok) {
        throw new Error(`Failed to load workout sessions: ${workoutSessionsResponse.statusText}`);
      }

      const workoutSessionsData = await workoutSessionsResponse.json();
      setWorkoutSessions(workoutSessionsData.data || []);
    } catch (err) {
      console.error("Error loading calendar data:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Combine all data into calendar events
  const events = useMemo(() => {
    const allEvents = [];

    // Add available consultation slots (green)
    consultationSlots.forEach((slot) => {
      allEvents.push({
        id: `consultation-slot-${slot.id}`,
        title: "Consultation Available",
        start: slot.start_time,
        end: slot.end_time,
        backgroundColor: "#10b981",
        borderColor: "#059669",
        textColor: "#ffffff",
        extendedProps: { type: "consultation-available", slotData: slot },
      });
    });

    // Add booked consultations (orange)
    bookings.forEach((booking) => {
      allEvents.push({
        id: `consultation-booking-${booking.id}`,
        title: `Consultation: ${booking.client_name}`,
        start: booking.start_time,
        end: booking.end_time,
        backgroundColor: "#f59e0b",
        borderColor: "#d97706",
        textColor: "#ffffff",
        extendedProps: { type: "consultation-booked", bookingData: booking },
      });
    });

    // Add available workout slots (blue)
    workoutSlots.forEach((slot) => {
      allEvents.push({
        id: `workout-slot-${slot.id}`,
        title: "Workout Available",
        start: slot.start_time,
        end: slot.end_time,
        backgroundColor: "#3b82f6",
        borderColor: "#1d4ed8",
        textColor: "#ffffff",
        extendedProps: { type: "workout-available", slotData: slot },
      });
    });

    // Add booked workout sessions (purple)
    workoutSessions.forEach((session) => {
      allEvents.push({
        id: `workout-session-${session.id}`,
        title: `Workout: ${session.client_name}`,
        start: session.start_time,
        end: session.end_time,
        backgroundColor: "#8b5cf6",
        borderColor: "#6d28d9",
        textColor: "#ffffff",
        extendedProps: { type: "workout-booked", sessionData: session },
      });
    });

    return allEvents;
  }, [consultationSlots, bookings, workoutSlots, workoutSessions]);

  const handleEventClick = (info) => {
    const eventType = info.event.extendedProps.type;
    if (eventType === "consultation-booked" || eventType === "workout-booked") {
      setSelectedEvent({
        type: eventType,
        data: eventType === "consultation-booked" 
          ? info.event.extendedProps.bookingData 
          : info.event.extendedProps.sessionData,
      });
      setShowDetailsModal(true);
    }
  };

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <h2 className={styles.title}>My Calendar</h2>
        {loading && <span className={styles.loadingText}>Loading...</span>}
      </div>

      {error && <p className={styles.errorText}>{error}</p>}

      <div className={styles.legend}>
        <div className={styles.legendItem}>
          <div className={styles.colorBox} style={{ backgroundColor: "#10b981" }}></div>
          <span>Consultation Available</span>
        </div>
        <div className={styles.legendItem}>
          <div className={styles.colorBox} style={{ backgroundColor: "#f59e0b" }}></div>
          <span>Consultation Booked</span>
        </div>
        <div className={styles.legendItem}>
          <div className={styles.colorBox} style={{ backgroundColor: "#3b82f6" }}></div>
          <span>Workout Available</span>
        </div>
        <div className={styles.legendItem}>
          <div className={styles.colorBox} style={{ backgroundColor: "#8b5cf6" }}></div>
          <span>Workout Booked</span>
        </div>
      </div>

      <FullCalendar
        plugins={[dayGridPlugin, timeGridPlugin]}
        initialView="timeGridWeek"
        headerToolbar={{ left: "prev,next today", center: "title", right: "dayGridMonth,timeGridWeek,timeGridDay" }}
        events={events}
        eventClick={handleEventClick}
        height="auto"
        slotMinTime="06:00:00"
        slotMaxTime="22:00:00"
      />

      {showDetailsModal && selectedEvent && (
        <div className={styles.modal}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h3>{selectedEvent.type === "consultation-booked" ? "Consultation Booking" : "Workout Session"} Details</h3>
              <button
                className={styles.closeBtn}
                onClick={() => {
                  setShowDetailsModal(false);
                  setSelectedEvent(null);
                }}
              >
                ✕
              </button>
            </div>

            <div className={styles.modalBody}>
              <div className={styles.detailRow}>
                <label>Client Name:</label>
                <span>{selectedEvent.data.client_name}</span>
              </div>
              <div className={styles.detailRow}>
                <label>Email:</label>
                <span>{selectedEvent.data.client_email}</span>
              </div>
              {selectedEvent.data.client_phone && (
                <div className={styles.detailRow}>
                  <label>Phone:</label>
                  <span>{selectedEvent.data.client_phone}</span>
                </div>
              )}
              <div className={styles.detailRow}>
                <label>Status:</label>
                <span className={styles.status}>{selectedEvent.data.status}</span>
              </div>
              {selectedEvent.data.format && (
                <div className={styles.detailRow}>
                  <label>Format:</label>
                  <span>{selectedEvent.data.format === "IN_PERSON" ? "In-Person" : "Video"}</span>
                </div>
              )}
              <div className={styles.detailRow}>
                <label>Start Time:</label>
                <span>{new Date(selectedEvent.data.start_time).toLocaleString()}</span>
              </div>
              <div className={styles.detailRow}>
                <label>End Time:</label>
                <span>{new Date(selectedEvent.data.end_time).toLocaleString()}</span>
              </div>
              {selectedEvent.data.timezone && (
                <div className={styles.detailRow}>
                  <label>Timezone:</label>
                  <span>{selectedEvent.data.timezone}</span>
                </div>
              )}
            </div>

            <div className={styles.modalFooter}>
              <button
                className={styles.closeButtonStyle}
                onClick={() => {
                  setShowDetailsModal(false);
                  setSelectedEvent(null);
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
