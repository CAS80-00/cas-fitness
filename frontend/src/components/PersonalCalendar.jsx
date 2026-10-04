import { useEffect, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import dayGridPlugin from "@fullcalendar/daygrid";
import styles from "../styles/PersonalCalendar.module.css";

/**
 * Personal Calendar
 * Members view and manage their assigned slots
 * - See slots assigned by superuser
 * - Change status: CONSULTATION, TRAINING, BREAK
 * - Color-coded by status
 */
export default function PersonalCalendar() {
  const [slots, setSlots] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [showStatusModal, setShowStatusModal] = useState(false);

  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "/api";
  const currentUserData = localStorage.getItem("cas_user");
  const currentUser = currentUserData ? JSON.parse(currentUserData) : null;
  const apiToken = () => localStorage.getItem("cas_jwt");

  useEffect(() => {
    loadSlots();
  }, []);

  const loadSlots = async () => {
    if (!currentUser?.id) return;

    try {
      setLoading(true);
      const token = apiToken();
      const res = await fetch(`${apiBaseUrl}/admin/slot-instances/${currentUser.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to load slots.");
      const data = await res.json();
      setSlots(data.instances || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "PENDING":
        return "#fbbf24"; // yellow
      case "APPROVED":
        return "#60a5fa"; // blue
      case "CONSULTATION":
        return "#34d399"; // green
      case "TRAINING":
        return "#8b5cf6"; // purple
      case "BREAK":
        return "#f87171"; // red
      default:
        return "#6b7280"; // gray
    }
  };

  // Convert slot instances to calendar events
  useEffect(() => {
    const calendarEvents = slots.map((slot) => {
      const dateTime = `${slot.slot_date}T${slot.start_time}`;
      return {
        id: slot.id,
        title: slot.status,
        start: dateTime,
        end: `${slot.slot_date}T${slot.end_time}`,
        backgroundColor: getStatusColor(slot.status),
        borderColor: getStatusColor(slot.status),
        extendedProps: {
          slotData: slot,
        },
      };
    });
    setEvents(calendarEvents);
  }, [slots]);

  const handleSlotClick = (info) => {
    setSelectedSlot(info.event.extendedProps.slotData);
    setShowStatusModal(true);
  };

  const handleStatusChange = async (newStatus) => {
    if (!selectedSlot) return;

    try {
      setLoading(true);
      const token = apiToken();
      const res = await fetch(`${apiBaseUrl}/admin/slot-instances/${selectedSlot.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!res.ok) throw new Error("Failed to update slot.");
      setShowStatusModal(false);
      setSelectedSlot(null);
      loadSlots();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!currentUser) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>Please log in to view your calendar.</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>My Calendar</h2>

      {error && <div className={styles.error}>{error}</div>}

      {loading && <div className={styles.loading}>Loading your slots...</div>}

      {!loading && slots.length === 0 && (
        <div className={styles.empty}>
          No slots assigned yet. Your superuser will create slots for you.
        </div>
      )}

      {!loading && slots.length > 0 && (
        <>
          <FullCalendar
            plugins={[dayGridPlugin, timeGridPlugin]}
            initialView="timeGridWeek"
            headerToolbar={{ left: "prev,next today", center: "title", right: "dayGridMonth,timeGridWeek,timeGridDay" }}
            events={events}
            eventClick={handleSlotClick}
            height="auto"
            showNonCurrentDates={true}
            fixedWeekCount={false}
          />

          {/* Status Update Modal */}
          {showStatusModal && selectedSlot && (
            <div className={styles.modal}>
              <div className={styles.modalContent}>
                <div className={styles.modalHeader}>
                  <h3>Update Slot Status</h3>
                  <button
                    className={styles.closeBtn}
                    onClick={() => {
                      setShowStatusModal(false);
                      setSelectedSlot(null);
                    }}
                  >
                    ✕
                  </button>
                </div>

                <div className={styles.slotDetails}>
                  <p>
                    <strong>Date:</strong> {selectedSlot.slot_date}
                  </p>
                  <p>
                    <strong>Time:</strong> {selectedSlot.start_time} - {selectedSlot.end_time}
                  </p>
                  <p>
                    <strong>Current Status:</strong>{" "}
                    <span style={{ color: getStatusColor(selectedSlot.status) }}>
                      {selectedSlot.status}
                    </span>
                  </p>
                </div>

                <div className={styles.statusOptions}>
                  <p className={styles.optionLabel}>Select new status:</p>
                  <button
                    className={styles.optionBtn}
                    style={{ borderLeftColor: getStatusColor("CONSULTATION") }}
                    onClick={() => handleStatusChange("CONSULTATION")}
                    disabled={loading}
                  >
                    📚 Consultation
                  </button>
                  <button
                    className={styles.optionBtn}
                    style={{ borderLeftColor: getStatusColor("TRAINING") }}
                    onClick={() => handleStatusChange("TRAINING")}
                    disabled={loading}
                  >
                    💪 Training Session
                  </button>
                  <button
                    className={styles.optionBtn}
                    style={{ borderLeftColor: getStatusColor("BREAK") }}
                    onClick={() => handleStatusChange("BREAK")}
                    disabled={loading}
                  >
                    ☕ Break
                  </button>
                </div>

                <div className={styles.modalFooter}>
                  <button
                    className={styles.cancelBtn}
                    onClick={() => {
                      setShowStatusModal(false);
                      setSelectedSlot(null);
                    }}
                    disabled={loading}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Legend */}
          <div className={styles.legend}>
            <h4>Slot Status Legend:</h4>
            <div className={styles.legendItems}>
              <div className={styles.legendItem}>
                <span className={styles.legendColor} style={{ backgroundColor: "#fbbf24" }}></span>
                <span>Pending - Awaiting your decision</span>
              </div>
              <div className={styles.legendItem}>
                <span className={styles.legendColor} style={{ backgroundColor: "#34d399" }}></span>
                <span>Consultation - Available for consultation</span>
              </div>
              <div className={styles.legendItem}>
                <span className={styles.legendColor} style={{ backgroundColor: "#8b5cf6" }}></span>
                <span>Training - Available for training session</span>
              </div>
              <div className={styles.legendItem}>
                <span className={styles.legendColor} style={{ backgroundColor: "#f87171" }}></span>
                <span>Break - Time off</span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
