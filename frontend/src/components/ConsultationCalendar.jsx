import { useEffect, useState } from "react";
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
 * Public booking flow with an atomic 5-minute slot hold (mirrored server
 * side via SELECT FOR UPDATE), timezone auto-detection with override, and
 * mandatory contact-consent checkbox before confirming.
 */
export default function ConsultationCalendar({ employeeId }) {
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [holdTimer, setHoldTimer] = useState(0);
  const [timeZone, setTimeZone] = useState(
    Intl.DateTimeFormat().resolvedOptions().timeZone,
  );
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

  const handleDateClick = (arg) => {
    setSelectedSlot(arg.date);
    setHoldTimer(HOLD_SECONDS);
  };

  const submitBooking = async (event) => {
    event.preventDefault();
    if (!selectedSlot) return;

    try {
      const startTime = selectedSlot.toISOString();
      const endTime = new Date(
        selectedSlot.getTime() + SLOT_MINUTES * 60 * 1000,
      ).toISOString();

      const res = await fetch(
        `${import.meta.env.VITE_API_BASE_URL || "/api"}/calendars/consultations/book`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clientName: formData.name,
            clientEmail: formData.email,
            clientPhone: `${formData.countryCode}${formData.phone}`,
            employeeId,
            format: formData.format,
            startTime,
            endTime,
            consentGiven: formData.consent,
            timezone: timeZone,
          }),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Unable to book consultation.");

      setBookingComplete(true);
      setStatusMessage(
        "Your appointment has been booked. We will contact you within 24 hours from your booked appointment to confirm you will attend. Thank you for your inquiry. A confirmation with instructions will be sent to your email shortly.",
      );
      setHoldTimer(0);
    } catch (error) {
      setStatusMessage(error.message);
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
            <FullCalendar
              plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
              initialView="dayGridMonth"
              selectable
              dateClick={handleDateClick}
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
                // Ensure month and year are displayed
                const monthYear = document.querySelector(".fc-toolbar-title");
                if (monthYear) {
                  monthYear.style.fontSize = "1.2em";
                  monthYear.style.fontWeight = "600";
                }
              }}
            />
          </div>

          <div className={styles.sidebar}>
            <h3 className={styles.sidebarTitle}>Reservation Info</h3>
            {statusMessage && <p className={styles.statusMessage}>{statusMessage}</p>}
            {selectedSlot && holdTimer > 0 ? (
              <form className={styles.holdForm} onSubmit={submitBooking}>
                <div className={styles.holdTimer}>
                  Hold expires in: {Math.floor(holdTimer / 60)}:
                  {(holdTimer % 60).toString().padStart(2, "0")}
                </div>
                <input
                  type="text"
                  placeholder="Full Name"
                  required
                  className={styles.formInput}
                  onChange={(event) => setFormData({ ...formData, name: event.target.value })}
                />
                <input
                  type="email"
                  placeholder="Email Address"
                  required
                  className={styles.formInput}
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
                  onChange={(event) => setFormData({ ...formData, format: event.target.value })}
                >
                  <option value="IN_PERSON">In Person</option>
                  <option value="VIDEO">Video Consultation</option>
                </select>
                <label className={styles.consentLabel}>
                  <input
                    type="checkbox"
                    required
                    onChange={(event) =>
                      setFormData({ ...formData, consent: event.target.checked })
                    }
                    className={styles.consentCheckbox}
                  />
                  I authorize to be contacted to confirm appointment.
                </label>
                <button type="submit" className={styles.confirmButton}>
                  Confirm Booking
                </button>
              </form>
            ) : (
              <p className={styles.helperText}>
                Select a calendar time slot to start your 5-minute reservation hold.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
