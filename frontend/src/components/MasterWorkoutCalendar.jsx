import { useEffect, useMemo, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import styles from "../styles/MasterCalendar.module.css";

/**
 * MasterWorkoutCalendar
 * Read-only combined view of every trainer's workout sessions, with a
 * dropdown to isolate a single trainer's schedule.
 */
export default function MasterWorkoutCalendar({ trainers }) {
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "/api";
  const [sessions, setSessions] = useState([]);
  const [selectedTrainerId, setSelectedTrainerId] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        const token = localStorage.getItem("cas_jwt");
        const res = await fetch(`${apiBaseUrl}/calendars/workouts`, {
          headers: { Authorization: "Bearer " + token },
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load workout sessions.");
        setSessions(data.sessions || []);
      } catch (err) {
        setError(err.message);
      }
    };
    load();
  }, [apiBaseUrl]);

  const events = useMemo(() => {
    return sessions
      .filter((session) => !selectedTrainerId || session.trainer_id === selectedTrainerId)
      .map((session) => ({
        id: String(session.id),
        title: `Workout - ${session.status}`,
        start: session.start_time,
        end: session.end_time,
      }));
  }, [sessions, selectedTrainerId]);

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <h2 className={styles.title}>Master Workout Calendar</h2>
        <select
          value={selectedTrainerId}
          onChange={(e) => setSelectedTrainerId(e.target.value)}
          className={styles.select}
        >
          <option value="">All Trainers</option>
          {trainers.map((trainer) => (
            <option key={trainer.id} value={trainer.id}>
              {trainer.firstName} {trainer.lastName}
            </option>
          ))}
        </select>
      </div>
      {error && <p className={styles.errorText}>{error}</p>}
      <FullCalendar
        plugins={[dayGridPlugin, timeGridPlugin]}
        initialView="timeGridWeek"
        headerToolbar={{ left: "prev,next today", center: "title", right: "dayGridMonth,timeGridWeek" }}
        events={events}
        height="auto"
        showNonCurrentDates={true}
        fixedWeekCount={false}
        datesSet={(info) => {
          // Ensure month/year and days of week are displayed
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
