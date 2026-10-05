import { useEffect, useState, useMemo } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import styles from "../styles/ConsultationCalendar.module.css";
import PhoneInputWithCountryCode from "./PhoneInputWithCountryCode";

const SLOT_MINUTES = 30;
const HOLD_SECONDS = 5 * 60;

/**
 * ConsultationCalendar
 * Member booking flow using real trainer availability from Master Consultation Calendar.
 * Shows available consultation slots from trainers and allows booking with 5-minute hold.
 */
export default function ConsultationCalendar({ employeeId }) {
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "/api";
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [holdTimer, setHoldTimer] = useState(0);
  const [timeZone, setTimeZone] = useState(
    Intl.DateTimeFormat().resolvedOptions().timeZone,
  );
  const [consultationSlots, setConsultationSlots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    countryCode: "+1",
    format: "IN_PERSON",
    consent: false,
  });
  const [bookingComplete, setBookingComplete] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  useEffect(() => {
    if (holdTimer <= 0) return undefined;
    const timer = setInterval(() => setHoldTimer((prev) => prev - 1), 1000);
    return () => clearInterval(timer);
  }, [holdTimer]);

  // Load available consultation slots from the master calendar
  useEffect(() => {
    const loadSlots = async () => {
      try {
        setLoading(true);
        
        const slotsRes = await fetch(`${apiBaseUrl}/calendars/trainer-consultation-slots-all`);
        const slotsData = await slotsRes.json();
        if (!slotsRes.ok) throw new Error(slotsData.error || "Failed to load available slots.");
        setConsultationSlots(slotsData.slots || []);
      } catch (err) {
        setStatusMessage(`Error loading slots: ${err.message}`);
        console.error("Error loading consultation slots:", err);
      } finally {
        setLoading(false);
      }
    };
    loadSlots();
  }, [apiBaseUrl]);

  // Convert slots to FullCalendar events
  const events = useMemo(() => {
    return consultationSlots
      .filter((slot) => !employeeId || slot.trainerId === employeeId)
      .map((slot) => {
        try {
          const [hours, minutes] = slot.startTime.split(":").map(Number);
          const [endHours, endMinutes] = slot.endTime.split(":").map(Number);
          const [year, month, day] = slot.slotDate.split("-").map(Number);
          
          const eventStart = new Date(year, month - 1, day, hours, minutes, 0, 0);
          const eventEnd = new Date(year, month - 1, day, endHours, endMinutes, 0, 0);

          if (isNaN(eventStart.getTime()) || isNaN(eventEnd.getTime())) {
            return null;
          }

          return {
            id: `slot-${slot.id}`,
            title: `${slot.trainerName} - Available`,
            start: eventStart.toISOString(),
            end: eventEnd.toISOString(),
            backgroundColor: "#10b981",
            borderColor: "#047857",
            textColor: "#ffffff",
            extendedProps: { 
              type: "availability", 
              slotId: slot.id,
              trainerId: slot.trainerId,
              trainerName: slot.trainerName,
              slotData: slot,
            },
          };
        } catch (err) {
          console.error(`Error parsing slot ${slot.id}:`, err);
          return null;
        }
      })
      .filter(Boolean);
  }, [consultationSlots, employeeId]);

  const handleEventClick = (info) => {
    const slot = info.event.extendedProps.slotData;
    setSelectedSlot({
      ...slot,
      eventStart: info.event.start,
      eventEnd: info.event.end,
    });
    setHoldTimer(HOLD_SECONDS);
    setStatusMessage("");
  };

  const submitBooking = async (event) => {
    event.preventDefault();
    if (!selectedSlot) return;

    try {
      setLoading(true);
      const res = await fetch(
        `${apiBaseUrl}/calendars/consultations/book`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clientName: formData.name,
            clientEmail: formData.email,
            clientPhone: `${formData.countryCode}${formData.phone}`,
            employeeId: selectedSlot.trainerId,
            format: formData.format,
            startTime: selectedSlot.eventStart.toISOString(),
            endTime: selectedSlot.eventEnd.toISOString(),
            consentGiven: formData.consent,
            timezone: timeZone,
          }),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Unable to book consultation.");

      setBookingComplete(true);
      setStatusMessage(
        "Your appointment has been booked! A confirmation with instructions will be sent to your email shortly. We will contact you within 24 hours to confirm your attendance.",
      );
      setHoldTimer(0);
      setSelectedSlot(null);
    } catch (error) {
      setStatusMessage(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <h2 className={styles.title}>Book a Consultation</h2>
        <div className={styles.timezoneRow}>
          <span className={styles.timezoneLabel}>Timezone</span>
          <select
            value={timeZone}
            onChange={(event) => setTimeZone(event.target.value)}
            className={styles.select}
          >
            <option value={timeZone}>{timeZone}</option>
            <option value="UTC">UTC</option>
            <option value="America/New_York">America/New_York</option>
            <option value="America/Chicago">America/Chicago</option>
          </select>
        </div>
      </div>

      {bookingComplete ? (
        <div className={styles.confirmation}>{statusMessage}</div>
      ) : (
        <div className={styles.grid}>
          <div className={styles.calendarColumn}>
            {loading ? (
              <div style={{ padding: "2rem", textAlign: "center" }}>Loading available slots...</div>
            ) : consultationSlots.length === 0 ? (
              <div style={{ padding: "2rem", textAlign: "center", color: "#666" }}>
                No consultation slots available at this time. Please check back later.
              </div>
            ) : (
              <FullCalendar
                plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                initialView="dayGridMonth"
                events={events}
                eventClick={handleEventClick}
                headerToolbar={{
                  left: "prev,next today",
                  center: "title",
                  right: "dayGridMonth,timeGridWeek",
                }}
                height="auto"
                timeZone={timeZone}
                dayCellClassNames="fc-day-cell"
                showNonCurrentDates={true}
                fixedWeekCount={false}
                datesSet={(info) => {
                  const monthYear = document.querySelector(".fc-toolbar-title");
                  if (monthYear) {
                    monthYear.style.fontSize = "1.2em";
                    monthYear.style.fontWeight = "600";
                  }
                }}
              />
            )}
          </div>

          <div className={styles.sidebar}>
            <h3 className={styles.sidebarTitle}>Reservation Info</h3>
            {statusMessage && <p className={styles.statusMessage}>{statusMessage}</p>}
            {selectedSlot && holdTimer > 0 ? (
              <form className={styles.holdForm} onSubmit={submitBooking}>
                <div className={styles.slotInfo}>
                  <p><strong>Trainer:</strong> {selectedSlot.trainerName}</p>
                  <p><strong>Date:</strong> {selectedSlot.slotDate}</p>
                  <p><strong>Time:</strong> {selectedSlot.startTime} - {selectedSlot.endTime}</p>
                </div>
                <div className={styles.holdTimer}>
                  Hold expires in: {Math.floor(holdTimer / 60)}:
                  {(holdTimer % 60).toString().padStart(2, "0")}
                </div>
                <input
                  type="text"
                  placeholder="Full Name"
                  required
                  className={styles.formInput}
                  value={formData.name}
                  onChange={(event) => setFormData({ ...formData, name: event.target.value })}
                />
                <input
                  type="email"
                  placeholder="Email Address"
                  required
                  className={styles.formInput}
                  value={formData.email}
                  onChange={(event) => setFormData({ ...formData, email: event.target.value })}
                />
                <div style={{ paddingBottom: "0.75rem" }}>
                  <PhoneInputWithCountryCode
                    value={formData.phone}
                    onChange={(countryCode, phoneNumber) => {
                      setFormData({
                        ...formData,
                        phone: phoneNumber,
                        countryCode: countryCode,
                      });
                    }}
                    placeholder="Enter your phone number"
                    required
                    showLabel={false}
                  />
                </div>
                <select
                  className={styles.formInput}
                  value={formData.format}
                  onChange={(event) => setFormData({ ...formData, format: event.target.value })}
                >
                  <option value="IN_PERSON">In Person</option>
                  <option value="VIDEO">Video Consultation</option>
                </select>
                <label className={styles.consentLabel}>
                  <input
                    type="checkbox"
                    required
                    checked={formData.consent}
                    onChange={(event) =>
                      setFormData({ ...formData, consent: event.target.checked })
                    }
                    className={styles.consentCheckbox}
                  />
                  I authorize to be contacted to confirm appointment.
                </label>
                <button 
                  type="submit" 
                  className={styles.confirmButton}
                  disabled={loading}
                >
                  {loading ? "Booking..." : "Confirm Booking"}
                </button>
              </form>
            ) : (
              <p className={styles.helperText}>
                Click on an available time slot to hold it for 5 minutes and complete your booking.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
