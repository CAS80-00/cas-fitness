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
 */
export default function EmployeeConsolidatedCalendar({ employeeId, refreshTrigger = 0 }) {
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "/api";
  const [availableSlots, setAvailableSlots] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const apiToken = () => localStorage.getItem("cas_jwt");

  // Load available slots and bookings
  useEffect(() => {
    if (!employeeId) return;
    loadCalendarData();
  }, [employeeId, refreshTrigger]);

  const loadCalendarData = async () => {
    try {
      setLoading(true);
      setError("");

      // Fetch available consultation slots for this trainer
      const slotsResponse = await fetch(
        `${apiBaseUrl}/calendars/trainer-consultation-slots?trainer_id=${employeeId}`,
        {
          headers: {
            Authorization: `Bearer ${apiToken()}`,
          },
        }
      );

      if (!slotsResponse.ok) {
        throw new Error(`Failed to load available slots: ${slotsResponse.statusText}`);
      }

      const slotsData = await slotsResponse.json();
      setAvailableSlots(slotsData.data || []);

      // Fetch booked consultations for this trainer
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
    } catch (err) {
      console.error("Error loading calendar data:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Combine slots and bookings into calendar events
  const events = useMemo(() => {
    const allEvents = [];

    // Add available consultation slots (green)
    availableSlots.forEach((slot) => {
      allEvents.push({
        id: `slot-${slot.id}`,
        title: "Available",
        start: slot.start_time,
        end: slot.end_time,
        backgroundColor: "#10b981",
        borderColor: "#059669",
        textColor: "#ffffff",
        extendedProps: { type: "available", slotData: slot },
      });
    });

    // Add booked consultations (orange)
    bookings.forEach((booking) => {
      allEvents.push({
        id: `booking-${booking.id}`,
        title: booking.client_name,
        start: booking.start_time,
        end: booking.end_time,
        backgroundColor: "#f59e0b",
        borderColor: "#d97706",
        textColor: "#ffffff",
        extendedProps: { type: "booked", bookingData: booking },
      });
    });

    return allEvents;
  }, [availableSlots, bookings]);

  const handleEventClick = (info) => {
    if (info.event.extendedProps.type === "booked") {
      setSelectedBooking(info.event.extendedProps.bookingData);
      setShowDetailsModal(true);
    }
  };

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <h2 className={styles.title}>My Consultation Calendar</h2>
        {loading && <span className={styles.loadingText}>Loading...</span>}
      </div>

      {error && <p className={styles.errorText}>{error}</p>}

      <div className={styles.legend}>
        <div className={styles.legendItem}>
          <div className={styles.colorBox} style={{ backgroundColor: "#10b981" }}></div>
          <span>Available Slots</span>
        </div>
        <div className={styles.legendItem}>
          <div className={styles.colorBox} style={{ backgroundColor: "#f59e0b" }}></div>
          <span>Booked Consultations</span>
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

      {showDetailsModal && selectedBooking && (
        <div className={styles.modal}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h3>Booking Details</h3>
              <button
                className={styles.closeBtn}
                onClick={() => {
                  setShowDetailsModal(false);
                  setSelectedBooking(null);
                }}
              >
                ✕
              </button>
            </div>

            <div className={styles.modalBody}>
              <div className={styles.detailRow}>
                <label>Client Name:</label>
                <span>{selectedBooking.client_name}</span>
              </div>
              <div className={styles.detailRow}>
                <label>Email:</label>
                <span>{selectedBooking.client_email}</span>
              </div>
              <div className={styles.detailRow}>
                <label>Phone:</label>
                <span>{selectedBooking.client_phone || "N/A"}</span>
              </div>
              <div className={styles.detailRow}>
                <label>Status:</label>
                <span className={styles.status}>{selectedBooking.status}</span>
              </div>
              <div className={styles.detailRow}>
                <label>Format:</label>
                <span>{selectedBooking.format === "IN_PERSON" ? "In-Person" : "Video Consultation"}</span>
              </div>
              <div className={styles.detailRow}>
                <label>Start Time:</label>
                <span>{new Date(selectedBooking.start_time).toLocaleString()}</span>
              </div>
              <div className={styles.detailRow}>
                <label>End Time:</label>
                <span>{new Date(selectedBooking.end_time).toLocaleString()}</span>
              </div>
              {selectedBooking.timezone && (
                <div className={styles.detailRow}>
                  <label>Timezone:</label>
                  <span>{selectedBooking.timezone}</span>
                </div>
              )}
            </div>

            <div className={styles.modalFooter}>
              <button
                className={styles.closeButtonStyle}
                onClick={() => {
                  setShowDetailsModal(false);
                  setSelectedBooking(null);
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
