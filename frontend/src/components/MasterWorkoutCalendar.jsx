import { useEffect, useMemo, useState, useCallback, forwardRef, useImperativeHandle, useRef } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import styles from "../styles/MasterCalendar.module.css";

/**
 * MasterWorkoutCalendar
 * Read-only combined view of every trainer's workout sessions and availability slots.
 * Displays both booked sessions and trainer availability.
 */
const MasterWorkoutCalendar = forwardRef(({ trainers, refreshTrigger = 0 }, ref) => {
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "/api";
  const [sessions, setSessions] = useState([]);
  const [trainerSlots, setTrainerSlots] = useState([]);
  const [selectedTrainerId, setSelectedTrainerId] = useState("");
  const [error, setError] = useState("");
  const [currentWeekStart, setCurrentWeekStart] = useState(new Date());
  const loadDataRef = useRef(null);

  // Expose refresh function via ref
  useImperativeHandle(ref, () => ({
    refreshCalendar: () => {
      console.log("[MasterCalendar] Manual refresh triggered");
      if (loadDataRef.current) {
        loadDataRef.current();
      }
    }
  }));

  const loadData = useCallback(async () => {
    try {
      const token = localStorage.getItem("cas_jwt");
      
      // Load all trainer slots including blocked times (BREAK, LUNCH, SICK, etc.)
      const slotsRes = await fetch(`${apiBaseUrl}/calendars/master-calendar-slots`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const slotsData = await slotsRes.json();
      if (!slotsRes.ok) throw new Error(slotsData.error || "Failed to load trainer slots.");
      setTrainerSlots(slotsData.slots || []);
    } catch (err) {
      setError(err.message);
    }
  }, [apiBaseUrl]);

  // Store the loadData function in ref so it can be called externally
  useEffect(() => {
    loadDataRef.current = loadData;
  }, [loadData]);

  useEffect(() => {
    loadData();
  }, [apiBaseUrl, refreshTrigger, loadData]);

  const events = useMemo(() => {
    const allEvents = [];

    // Add trainer slots from new slot_instances table
    trainerSlots
      .filter((slot) => !selectedTrainerId || slot.trainerId === selectedTrainerId)
      .forEach((slot) => {
        // Slots have concrete slot_date and start/end times
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
              console.warn(`Invalid slot data for slot ${slot.id}:`, slot);
              return;
            }
            
            const eventStart = new Date(year, month - 1, day, hours, minutes, 0, 0);
            const eventEnd = new Date(year, month - 1, day, endHours, endMinutes, 0, 0);

            // Validate Date objects
            if (isNaN(eventStart.getTime()) || isNaN(eventEnd.getTime())) {
              console.warn(`Invalid date created for slot ${slot.id}:`, { slot, eventStart, eventEnd });
              return;
            }

            // Determine title and color based on status
            let title, backgroundColor, borderColor, textColor;
            
            switch (slot.status) {
              case "WORKOUT":
              case "APPROVED":
                title = `${slot.trainerName} - Available`;
                backgroundColor = "#10b981"; // green
                borderColor = "#059669";
                textColor = "#ffffff";
                break;
              case "BOOKED":
                title = `${slot.trainerName} - Booked`;
                backgroundColor = "#6b7280"; // gray
                borderColor = "#4b5563";
                textColor = "#ffffff";
                break;
              case "BREAK":
                title = `${slot.trainerName} - Break`;
                backgroundColor = "#f59e0b"; // amber
                borderColor = "#d97706";
                textColor = "#000000";
                break;
              case "LUNCH":
                title = `${slot.trainerName} - Lunch`;
                backgroundColor = "#ec4899"; // pink
                borderColor = "#be185d";
                textColor = "#ffffff";
                break;
              case "SICK":
                title = `${slot.trainerName} - Sick`;
                backgroundColor = "#ef4444"; // red
                borderColor = "#b91c1c";
                textColor = "#ffffff";
                break;
              case "NO_SHOW":
                title = `${slot.trainerName} - No Show`;
                backgroundColor = "#8b5cf6"; // purple
                borderColor = "#6d28d9";
                textColor = "#ffffff";
                break;
              case "VACATION":
                title = `${slot.trainerName} - Vacation`;
                backgroundColor = "#3b82f6"; // blue
                borderColor = "#1d4ed8";
                textColor = "#ffffff";
                break;
              case "PERSONAL_TIME":
                title = `${slot.trainerName} - Personal Time`;
                backgroundColor = "#14b8a6"; // teal
                borderColor = "#0d9488";
                textColor = "#ffffff";
                break;
              default:
                title = `${slot.trainerName} - ${slot.status}`;
                backgroundColor = "#6b7280"; // gray
                borderColor = "#4b5563";
                textColor = "#ffffff";
            }

            allEvents.push({
              id: `slot-${slot.id}`,
              title,
              start: eventStart.toISOString(),
              end: eventEnd.toISOString(),
              backgroundColor,
              borderColor,
              textColor,
              extendedProps: { 
                type: "slot",
                status: slot.status,
                trainerId: slot.trainerId,
                trainerName: slot.trainerName,
              },
            });
          } catch (err) {
            console.error(`Error parsing slot ${slot.id}:`, err, slot);
          }
        }
      });

    return allEvents;
  }, [trainerSlots, selectedTrainerId]);

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
        <div style={{ marginBottom: "0.75rem", fontWeight: "600" }}>Trainer Calendar Status:</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "0.75rem" }}>
          {/* Available */}
          <span style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span
              style={{
                display: "inline-block",
                width: "12px",
                height: "12px",
                backgroundColor: "#10b981",
                borderRadius: "2px",
              }}
            />
            <span>Available</span>
          </span>
          {/* Booked */}
          <span style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span
              style={{
                display: "inline-block",
                width: "12px",
                height: "12px",
                backgroundColor: "#6b7280",
                borderRadius: "2px",
              }}
            />
            <span>Booked</span>
          </span>
          {/* Break */}
          <span style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span
              style={{
                display: "inline-block",
                width: "12px",
                height: "12px",
                backgroundColor: "#f59e0b",
                borderRadius: "2px",
              }}
            />
            <span>Break</span>
          </span>
          {/* Lunch */}
          <span style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span
              style={{
                display: "inline-block",
                width: "12px",
                height: "12px",
                backgroundColor: "#ec4899",
                borderRadius: "2px",
              }}
            />
            <span>Lunch</span>
          </span>
          {/* Sick */}
          <span style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span
              style={{
                display: "inline-block",
                width: "12px",
                height: "12px",
                backgroundColor: "#ef4444",
                borderRadius: "2px",
              }}
            />
            <span>Sick</span>
          </span>
          {/* No Show */}
          <span style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span
              style={{
                display: "inline-block",
                width: "12px",
                height: "12px",
                backgroundColor: "#8b5cf6",
                borderRadius: "2px",
              }}
            />
            <span>No Show</span>
          </span>
          {/* Vacation */}
          <span style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span
              style={{
                display: "inline-block",
                width: "12px",
                height: "12px",
                backgroundColor: "#3b82f6",
                borderRadius: "2px",
              }}
            />
            <span>Vacation</span>
          </span>
          {/* Personal Time */}
          <span style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span
              style={{
                display: "inline-block",
                width: "12px",
                height: "12px",
                backgroundColor: "#14b8a6",
                borderRadius: "2px",
              }}
            />
            <span>Personal Time</span>
          </span>
        </div>
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
});

MasterWorkoutCalendar.displayName = "MasterWorkoutCalendar";

export default MasterWorkoutCalendar;



