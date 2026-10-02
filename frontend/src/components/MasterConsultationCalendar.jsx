import { useEffect, useMemo, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import styles from "../styles/MasterCalendar.module.css";

/**
 * MasterConsultationCalendar
 * Read-only combined view of every consultation appointment across staff,
 * with a dropdown to isolate a single staff member's schedule. Distinct
 * from ConsultationCalendar.jsx, which is the public booking flow.
 */
export default function MasterConsultationCalendar({ staff }) {
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "/api";
  const [appointments, setAppointments] = useState([]);
  const [selectedStaffId, setSelectedStaffId] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`${apiBaseUrl}/calendars/consultations`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load consultations.");
        setAppointments(data.appointments || []);
      } catch (err) {
        setError(err.message);
      }
    };
    load();
  }, [apiBaseUrl]);

  const events = useMemo(() => {
    return appointments
      .filter((appt) => !selectedStaffId || appt.employee_id === selectedStaffId)
      .map((appt) => ({
        id: String(appt.id),
        title: `${appt.client_name} (${appt.status})`,
        start: appt.start_time,
        end: appt.end_time,
      }));
  }, [appointments, selectedStaffId]);

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <h2 className={styles.title}>Master Consultation Calendar</h2>
        <select
          value={selectedStaffId}
          onChange={(e) => setSelectedStaffId(e.target.value)}
          className={styles.select}
        >
          <option value="">All Staff</option>
          {staff.map((member) => (
            <option key={member.id} value={member.id}>
              {member.firstName} {member.lastName}
            </option>
          ))}
        </select>
      </div>
      {error && <p className={styles.errorText}>{error}</p>}
      <FullCalendar
        plugins={[dayGridPlugin, timeGridPlugin]}
        initialView="dayGridMonth"
        headerToolbar={{ left: "prev,next today", center: "title", right: "dayGridMonth,timeGridWeek" }}
        events={events}
        height="auto"
        showNonCurrentDates={true}
        fixedWeekCount={false}
        datesSet={(info) => {
          // Ensure month and year are displayed prominently
          const monthYear = document.querySelector(".fc-toolbar-title");
          if (monthYear) {
            monthYear.style.fontSize = "1.2em";
            monthYear.style.fontWeight = "600";
          }
        }}
      />
    </div>
  );
}
