import { useCallback, useEffect, useRef, useState, forwardRef, useImperativeHandle } from "react";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import styles from "../styles/TrainerAvailabilityCalendar.module.css";

/**
 * TrainerAvailabilityCalendar
 * Displays all trainers' workout availability in a calendar view
 * Shows which trainers are available on which dates/times
 */
const TrainerAvailabilityCalendar = forwardRef(({ onSelectSlot, sessionPackage }, ref) => {
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "/api";
  const [events, setEvents] = useState([]);
  const [trainers, setTrainers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedTrainer, setSelectedTrainer] = useState(null);
  const [calendarView, setCalendarView] = useState("timeGridWeek"); // timeGridWeek, dayGridMonth
  const loadScheduleRef = useRef(null);

  const getToken = () => localStorage.getItem("cas_jwt");

  const authHeaders = () => ({
    Authorization: `Bearer ${getToken()}`,
    "Content-Type": "application/json",
  });

  // Expose refresh function via ref
  useImperativeHandle(ref, () => ({
    refreshCalendar: () => {
      console.log("[Calendar] Manual refresh triggered");
      if (loadScheduleRef.current) {
        loadScheduleRef.current();
      }
    }
  }));

  // Load available trainers
  useEffect(() => {
    const loadTrainers = async () => {
      try {
        setError("");
        const res = await fetch(`${apiBaseUrl}/trainer-sessions/available-trainers`, {
          headers: authHeaders(),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Failed to load available trainers");
        }
        const data = await res.json();
        console.log(`[Calendar] Loaded ${data.length} available trainers`);
        setTrainers(data);
        if (data.length > 0 && !selectedTrainer) {
          console.log(`[Calendar] Auto-selecting first trainer: ${data[0].id}`);
          setSelectedTrainer(data[0].id);
        }
      } catch (err) {
        setError(err.message);
        console.error("Error loading trainers:", err);
      }
    };
    loadTrainers();
  }, []);

  // Define loadSchedule as a callback so it can be called from ref
  const loadSchedule = useCallback(async () => {
    if (!selectedTrainer || !sessionPackage) return;

    try {
      setLoading(true);
      setError("");

      const startDate = new Date(sessionPackage.start_date).toISOString().split('T')[0];
      const endDate = new Date(sessionPackage.expiration_date).toISOString().split('T')[0];

      console.log(`[Calendar] Loading slots for trainer ${selectedTrainer} from ${startDate} to ${endDate}`);

      const res = await fetch(
        `${apiBaseUrl}/trainer-sessions/trainer-schedule/${selectedTrainer}?startDate=${startDate}&endDate=${endDate}`,
        { headers: authHeaders() }
      );

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to load trainer schedule");
      }

      const data = await res.json();
      console.log(`[Calendar] Received data:`, data);
      
      const trainerInfo = data.trainer;
      
      // Convert slots to calendar events
      const calendarEvents = data.availableSlots.map((slot) => {
        // Ensure date is in YYYY-MM-DD format
        let dateStr = slot.date;
        if (dateStr.includes('T')) {
          // If it's a full ISO string, extract just the date part
          dateStr = dateStr.split('T')[0];
        }
        
        const isBooked = slot.isBooked || slot.status === 'BOOKED';
        const title = isBooked 
          ? `BOOKED - ${slot.bookedBy}` 
          : `${trainerInfo.firstName} ${trainerInfo.lastName}`;
        const backgroundColor = isBooked ? "#6b7280" : "#10b981"; // gray for booked, green for available
        const borderColor = isBooked ? "#4b5563" : "#059669";
        
        return {
          id: String(slot.id),
          title,
          start: `${dateStr}T${slot.startTime}`,
          end: `${dateStr}T${slot.endTime}`,
          backgroundColor,
          borderColor,
          extendedProps: {
            trainerId: selectedTrainer,
            trainerName: `${trainerInfo.firstName} ${trainerInfo.lastName}`,
            slotId: slot.id,
            startTime: slot.startTime,
            endTime: slot.endTime,
            date: dateStr,
            isBooked,
            bookedBy: slot.bookedBy,
            sessionId: slot.sessionId,
          },
        };
      });

      console.log(`[Calendar] Created ${calendarEvents.length} calendar events`);
      if (calendarEvents.length > 0) {
        console.log(`[Calendar] First event:`, calendarEvents[0]);
      }
      setEvents(calendarEvents);
    } catch (err) {
      setError(err.message);
      console.error("Error loading schedule:", err);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [selectedTrainer, sessionPackage, apiBaseUrl]);

  // Store loadSchedule in ref so it can be called externally
  useEffect(() => {
    loadScheduleRef.current = loadSchedule;
  }, [loadSchedule]);

  // Load trainer schedule when trainer or date range changes
  useEffect(() => {
    loadSchedule();
  }, [loadSchedule]);

  const handleSelectEvent = (info) => {
    const event = info.event;
    
    // Don't allow selecting booked slots
    if (event.extendedProps.isBooked) {
      alert(`This slot is already booked by ${event.extendedProps.bookedBy}`);
      return;
    }
    
    const slot = {
      id: event.extendedProps.slotId,
      date: event.extendedProps.date,
      startTime: event.extendedProps.startTime,
      endTime: event.extendedProps.endTime,
      trainerId: event.extendedProps.trainerId,
      trainerName: event.extendedProps.trainerName,
    };

    if (onSelectSlot) {
      onSelectSlot(slot);
    }
  };

  if (!sessionPackage) {
    return (
      <div className={styles.container}>
        <p>Please select a session package first</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <h3>Trainer Availability Calendar</h3>

      {error && <div className={styles.errorMessage}>{error}</div>}

      <div className={styles.controls}>
        <div className={styles.trainerSelect}>
          <label htmlFor="trainer-select">Select Trainer:</label>
          <select
            id="trainer-select"
            value={selectedTrainer || ""}
            onChange={(e) => setSelectedTrainer(e.target.value)}
            className={styles.select}
          >
            <option value="">All Trainers</option>
            {trainers.map((trainer) => (
              <option key={trainer.id} value={trainer.id}>
                {trainer.firstName} {trainer.lastName} ({trainer.availableSlots} slots)
              </option>
            ))}
          </select>
        </div>

        <div className={styles.viewToggle}>
          <button
            className={`${styles.viewButton} ${calendarView === "timeGridWeek" ? styles.active : ""}`}
            onClick={() => setCalendarView("timeGridWeek")}
          >
            Week
          </button>
          <button
            className={`${styles.viewButton} ${calendarView === "dayGridMonth" ? styles.active : ""}`}
            onClick={() => setCalendarView("dayGridMonth")}
          >
            Month
          </button>
        </div>
      </div>

      {loading ? (
        <p className={styles.loading}>Loading availability...</p>
      ) : events && events.length > 0 ? (
        <div className={styles.calendarWrapper}>
          <FullCalendar
            plugins={[timeGridPlugin, dayGridPlugin, interactionPlugin]}
            initialView={calendarView}
            headerToolbar={{
              left: "prev,next today",
              center: "title",
              right: "timeGridWeek,dayGridMonth",
            }}
            events={events}
            eventClick={handleSelectEvent}
            height="auto"
            contentHeight="auto"
            slotLabelFormat={{
              hour: "numeric",
              minute: "2-digit",
              meridiem: "short",
            }}
            slotDuration="00:30:00"
            snapDuration="00:15:00"
            editable={false}
            selectable={false}
          />
        </div>
      ) : (
        <p className={styles.noAvailability}>No availability found for the selected trainer during this period</p>
      )}

      <div className={styles.info}>
        <p>Click on any availability slot to book it</p>
      </div>
    </div>
  );
});

TrainerAvailabilityCalendar.displayName = "TrainerAvailabilityCalendar";

export default TrainerAvailabilityCalendar;
