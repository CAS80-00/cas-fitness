import { useEffect, useMemo, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import { ChevronUp, ChevronDown } from "lucide-react";
import styles from "../styles/MasterCalendar.module.css";

/**
 * MasterConsultationCalendar
 * Read-only combined view of every consultation appointment across staff,
 * with a dropdown to isolate a single staff member's schedule.
 * Displays both booked consultations and trainer consultation availability slots.
 */
export default function MasterConsultationCalendar({ staff, refreshTrigger = 0 }) {
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "/api";
  const [appointments, setAppointments] = useState([]);
  const [consultationSlots, setConsultationSlots] = useState([]);
  const [selectedStaffId, setSelectedStaffId] = useState("");
  const [error, setError] = useState("");
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    if (!isExpanded) return;
    
    const load = async () => {
      try {
        const token = localStorage.getItem("cas_jwt");
        
        // Load booked consultations
        const appointmentsRes = await fetch(`${apiBaseUrl}/calendars/consultations`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const appointmentsData = await appointmentsRes.json();
        if (!appointmentsRes.ok) throw new Error(appointmentsData.error || "Failed to load consultations.");
        setAppointments(appointmentsData.appointments || []);

        // Load trainer consultation availability slots from new slot_instances table
        const slotsRes = await fetch(`${apiBaseUrl}/calendars/trainer-consultation-slots-all`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const slotsData = await slotsRes.json();
        if (!slotsRes.ok) throw new Error(slotsData.error || "Failed to load consultation slots.");
        setConsultationSlots(slotsData.slots || []);
      } catch (err) {
        setError(err.message);
        console.error("Error loading consultation data:", err);
      }
    };
    load();
  }, [apiBaseUrl, refreshTrigger, isExpanded]);

  const handleEventClick = (info) => {
    if (info.event.extendedProps.type === "booked") {
      // Find the appointment details
      const appointmentId = parseInt(info.event.id.split("-")[1]);
      const appointment = appointments.find(a => a.id === appointmentId);
      if (appointment) {
        setSelectedBooking(appointment);
        setShowDetailsModal(true);
      }
    }
  };

  const events = useMemo(() => {
    const allEvents = [];

    // Add booked consultations (legacy appointments)
    appointments
      .filter((appt) => !selectedStaffId || appt.employee_id === selectedStaffId)
      .forEach((appt) => {
        allEvents.push({
          id: `appointment-${appt.id}`,
          title: `${appt.client_name} (${appt.status})`,
          start: appt.start_time,
          end: appt.end_time,
          backgroundColor: "#f59e0b",
          borderColor: "#d97706",
          textColor: "#ffffff",
          extendedProps: { type: "booked", appointmentData: appt },
        });
      });

    // Add trainer consultation availability slots (new slot_instances)
    consultationSlots
      .filter((slot) => !selectedStaffId || slot.trainerId === selectedStaffId)
      .forEach((slot) => {
        if (slot.slotDate && slot.startTime && slot.endTime) {
          try {
            const [hours, minutes] = slot.startTime.split(":").map(Number);
            const [endHours, endMinutes] = slot.endTime.split(":").map(Number);

            // Parse slot_date (YYYY-MM-DD format)
            const [year, month, day] = slot.slotDate.split("-").map(Number);
            
            // Validate parsed values
            if (!Number.isFinite(hours) || !Number.isFinite(minutes) || 
                !Number.isFinite(endHours) || !Number.isFinite(endMinutes) ||
                !Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
              console.warn(`Invalid consultation slot data for slot ${slot.id}:`, slot);
              return;
            }
            
            const eventStart = new Date(year, month - 1, day, hours, minutes, 0, 0);
            const eventEnd = new Date(year, month - 1, day, endHours, endMinutes, 0, 0);

            // Validate Date objects
            if (isNaN(eventStart.getTime()) || isNaN(eventEnd.getTime())) {
              console.warn(`Invalid date created for consultation slot ${slot.id}:`, { slot, eventStart, eventEnd });
              return;
            }

            allEvents.push({
              id: `consultation-slot-${slot.id}`,
              title: `${slot.trainerName} - Available`,
              start: eventStart.toISOString(),
              end: eventEnd.toISOString(),
              backgroundColor: "#3b82f6",
              borderColor: "#1d4ed8",
              textColor: "#ffffff",
              extendedProps: { type: "availability", slotId: slot.id },
            });
          } catch (err) {
            console.error(`Error parsing consultation slot ${slot.id}:`, err, slot);
          }
        }
      });

    return allEvents;
  }, [appointments, consultationSlots, selectedStaffId]);

  return (
    <div className={styles.card}>
      <button
        type="button"
        className={styles.headerButton}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <h2 className={styles.title}>Master Consultation Calendar</h2>
        {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
      </button>

      {isExpanded && (
      <div className={styles.collapsibleContent}>
        <div className={styles.header}>
          <select
            value={selectedStaffId}
            onChange={(e) => setSelectedStaffId(e.target.value)}
            className={styles.select}
          >
            <option value="">All Staff</option>
            {staff && staff.map((member) => (
              <option key={member.id} value={member.id}>
                {member.first_name || member.firstName} {member.last_name || member.lastName}
              </option>
            ))}
          </select>
        </div>
        {error && <p className={styles.errorText}>{error}</p>}
      
      <div className={styles.legend} style={{ marginBottom: "1rem" }}>
        <div style={{ display: "flex", gap: "2rem", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <div style={{ width: "20px", height: "20px", backgroundColor: "#3b82f6", borderRadius: "3px" }}></div>
            <span>Available Slot</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <div style={{ width: "20px", height: "20px", backgroundColor: "#f59e0b", borderRadius: "3px" }}></div>
            <span>Booked Consultation</span>
          </div>
        </div>
      </div>
      
      <FullCalendar
        plugins={[dayGridPlugin, timeGridPlugin]}
        initialView="dayGridMonth"
        headerToolbar={{ left: "prev,next today", center: "title", right: "dayGridMonth,timeGridWeek" }}
        events={events}
        eventClick={handleEventClick}
        height="auto"
        showNonCurrentDates={true}
        fixedWeekCount={false}
        datesSet={() => {
          // Ensure month and year are displayed prominently
          const monthYear = document.querySelector(".fc-toolbar-title");
          if (monthYear) {
            monthYear.style.fontSize = "1.2em";
            monthYear.style.fontWeight = "600";
          }
        }}
      />
      </div>
      )}

      {showDetailsModal && selectedBooking && (
        <div className={styles.modal}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h3>Consultation Booking Details</h3>
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
              <div className={styles.detailRow}>
                <label>Consent Given:</label>
                <span>{selectedBooking.consent_given ? "Yes" : "No"}</span>
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
