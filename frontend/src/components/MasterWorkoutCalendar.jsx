import { useEffect, useMemo, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import styles from "../styles/MasterCalendar.module.css";

/**
 * MasterWorkoutCalendar
 * Read-only combined view of every trainer's workout sessions and availability slots.
 * Displays both booked sessions and trainer availability.
 */
export default function MasterWorkoutCalendar({ trainers }) {
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "/api";
  const [sessions, setSessions] = useState([]);
  const [trainerSlots, setTrainerSlots] = useState([]);
  const [selectedTrainerId, setSelectedTrainerId] = useState("");
  const [error, setError] = useState("");
  const [currentWeekStart, setCurrentWeekStart] = useState(new Date());

  useEffect(() => {
    const load = async () => {
      try {
        const token = localStorage.getItem("cas_jwt");
        
        // Load booked workout sessions
        const sessionRes = await fetch(`${apiBaseUrl}/calendars/workouts`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const sessionData = await sessionRes.json();
        if (!sessionRes.ok) throw new Error(sessionData.error || "Failed to load workout sessions.");
        setSessions(sessionData.sessions || []);

        // Load trainer availability slots
        const slotsRes = await fetch(`${apiBaseUrl}/calendars/trainer-slots-all`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const slotsData = await slotsRes.json();
        if (!slotsRes.ok) throw new Error(slotsData.error || "Failed to load trainer slots.");
        setTrainerSlots(slotsData.slots || []);
      } catch (err) {
        setError(err.message);
      }
    };
    load();
  }, [apiBaseUrl]);

  const events = useMemo(() => {
    const allEvents = [];

    // Add booked sessions
    sessions
      .filter((session) => !selectedTrainerId || session.trainer_id === selectedTrainerId)
      .forEach((session) => {
        allEvents.push({
          id: `session-${session.id}`,
          title: `${session.status}`,
          start: session.start_time,
          end: session.end_time,
          backgroundColor: getSessionColor(session.status),
          borderColor: getSessionColor(session.status),
          extendedProps: { type: "session" },
        });
      });

    // Add trainer availability slots (converted to calendar events)
    const startDate = currentWeekStart;
    const endDate = new Date(currentWeekStart.getTime() + 28 * 24 * 60 * 60 * 1000); // 4 weeks

    trainerSlots
      .filter((slot) => !selectedTrainerId || slot.trainerId === selectedTrainerId)
      .forEach((slot) => {
        // Generate events for each week in the range
        let checkDate = new Date(startDate);
        
        while (checkDate < endDate) {
          // Check if this day matches the slot's day of week
          if (checkDate.getDay() === slot.dayOfWeek) {
            // Create a date-time for this slot on this week
            const [hours, minutes] = slot.startTime.split(":").map(Number);
            const [endHours, endMinutes] = slot.endTime.split(":").map(Number);

            const eventStart = new Date(checkDate);
            eventStart.setHours(hours, minutes, 0, 0);

            const eventEnd = new Date(checkDate);
            eventEnd.setHours(endHours, endMinutes, 0, 0);

            allEvents.push({
              id: `slot-${slot.id}-${checkDate.toISOString().split("T")[0]}`,
              title: `${slot.trainerName} - Available (${slot.locationFormat})`,
              start: eventStart.toISOString(),
              end: eventEnd.toISOString(),
              backgroundColor: "#10b981",
              borderColor: "#059669",
              textColor: "#ffffff",
              extendedProps: { type: "availability" },
            });
          }

          checkDate.setDate(checkDate.getDate() + 1);
        }
      });

    return allEvents;
  }, [sessions, trainerSlots, selectedTrainerId, currentWeekStart]);

  const getSessionColor = (status) => {
    switch (status) {
      case "SCHEDULED":
        return "#3b82f6";
      case "COMPLETED":
        return "#8b5cf6";
      case "FAILED":
        return "#ef4444";
      case "ABSENT":
        return "#f97316";
      default:
        return "#6b7280";
    }
  };

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
      <div style={{ marginBottom: "1rem", fontSize: "0.875rem", color: "#888" }}>
        <span style={{ display: "inline-block", marginRight: "1.5rem" }}>
          <span
            style={{
              display: "inline-block",
              width: "12px",
              height: "12px",
              backgroundColor: "#3b82f6",
              marginRight: "0.5rem",
              borderRadius: "2px",
            }}
          />
          Scheduled
        </span>
        <span style={{ display: "inline-block", marginRight: "1.5rem" }}>
          <span
            style={{
              display: "inline-block",
              width: "12px",
              height: "12px",
              backgroundColor: "#8b5cf6",
              marginRight: "0.5rem",
              borderRadius: "2px",
            }}
          />
          Completed
        </span>
        <span style={{ display: "inline-block", marginRight: "1.5rem" }}>
          <span
            style={{
              display: "inline-block",
              width: "12px",
              height: "12px",
              backgroundColor: "#10b981",
              marginRight: "0.5rem",
              borderRadius: "2px",
            }}
          />
          Trainer Available
        </span>
      </div>
      <FullCalendar
        plugins={[dayGridPlugin, timeGridPlugin]}
        initialView="timeGridWeek"
        headerToolbar={{ left: "prev,next today", center: "title", right: "dayGridMonth,timeGridWeek" }}
        events={events}
        height="auto"
        showNonCurrentDates={true}
        fixedWeekCount={false}
        datesSet={(info) => {
          setCurrentWeekStart(info.start);
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
