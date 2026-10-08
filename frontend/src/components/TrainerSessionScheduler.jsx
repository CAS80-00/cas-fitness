import { useState, useEffect } from "react";
import TrainerAvailabilityCalendar from "./TrainerAvailabilityCalendar";
import styles from "../styles/TrainerSessionScheduler.module.css";

/**
 * TrainerSessionScheduler
 * Allows students with available trainer sessions to:
 * - View list of available trainers from the master calendar
 * - See trainer availability (calendar slots)
 * - Book specific sessions from available WORKOUT slots
 */
export default function TrainerSessionScheduler({ studentId, trainerSessions, onSessionBooked }) {
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "/api";

  const [step, setStep] = useState("select-session"); // 'select-session', 'select-trainer', 'select-slot', 'confirm', 'calendar'
  const [viewMode, setViewMode] = useState("list"); // 'list' or 'calendar'
  const [trainers, setTrainers] = useState([]);
  const [selectedSession, setSelectedSession] = useState(null);
  const [selectedTrainer, setSelectedTrainer] = useState(null);
  const [trainerSlots, setTrainerSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const getToken = () => localStorage.getItem("cas_jwt");

  const authHeaders = () => ({
    Authorization: `Bearer ${getToken()}`,
    "Content-Type": "application/json",
  });

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
        setTrainers(data);
      } catch (err) {
        setError(err.message);
        console.error("Error loading trainers:", err);
      }
    };
    loadTrainers();
  }, []);

  // Load trainer schedule when trainer is selected
  useEffect(() => {
    if (!selectedTrainer || !selectedSession) return;

    const loadSchedule = async () => {
      try {
        setLoading(true);
        setError("");

        // Get date range from selected session
        const startDate = new Date(selectedSession.start_date).toISOString().split('T')[0];
        const endDate = new Date(selectedSession.expiration_date).toISOString().split('T')[0];

        const res = await fetch(
          `${apiBaseUrl}/trainer-sessions/trainer-schedule/${selectedTrainer.id}?startDate=${startDate}&endDate=${endDate}`,
          { headers: authHeaders() }
        );

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Failed to load trainer schedule");
        }

        const data = await res.json();
        setTrainerSlots(data.availableSlots || []);
      } catch (err) {
        setError(err.message);
        console.error("Error loading schedule:", err);
        setTrainerSlots([]);
      } finally {
        setLoading(false);
      }
    };

    loadSchedule();
  }, [selectedTrainer, selectedSession]);

  const handleSelectSession = (session) => {
    setSelectedSession(session);
    setSelectedTrainer(null);
    setTrainerSlots([]);
    setSelectedSlot(null);
    setStep("select-trainer");
  };

  const handleSelectTrainer = (trainer) => {
    setSelectedTrainer(trainer);
    setStep("select-slot");
  };

  const handleSelectSlot = (slot) => {
    setSelectedSlot(slot);
    setStep("confirm");
  };

  const handleCalendarSlotSelect = (slot) => {
    // Set the trainer from the calendar slot
    setSelectedTrainer({ id: slot.trainerId, firstName: slot.trainerName.split(" ")[0], lastName: slot.trainerName.split(" ")[1] || "" });
    setSelectedSlot(slot);
    setStep("confirm");
  };

  const handleConfirmBooking = async () => {
    if (!selectedSession || !selectedTrainer || !selectedSlot) {
      setError("Missing required information");
      return;
    }

    try {
      setLoading(true);
      setError("");

      const res = await fetch(`${apiBaseUrl}/trainer-sessions/book-session`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          sessionPackageId: selectedSession.id,
          trainerId: selectedTrainer.id,
          slotInstanceId: selectedSlot.id,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to book session");
      }

      const result = await res.json();
      setSuccess("Session booked successfully!");
      
      // Callback to parent to refresh session list
      if (onSessionBooked) {
        onSessionBooked(selectedSession.id, result.sessionLog);
      }

      // Reset for next booking
      setTimeout(() => {
        setStep("select-session");
        setSelectedSession(null);
        setSelectedTrainer(null);
        setTrainerSlots([]);
        setSelectedSlot(null);
        setSuccess("");
      }, 1500);
    } catch (err) {
      setError(err.message);
      console.error("Error booking session:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.schedulerContainer}>
      <h3>Schedule Trainer Session</h3>

      {error && <div className={styles.errorMessage}>{error}</div>}
      {success && <div className={styles.successMessage}>{success}</div>}

      {/* Step 1: Select Session Package */}
      {step === "select-session" && (
        <div className={styles.step}>
          <h4>Select a Session Package</h4>
          {trainerSessions && trainerSessions.length > 0 ? (
            <div className={styles.sessionList}>
              {trainerSessions.map((session) => (
                <div
                  key={session.id}
                  className={styles.sessionCard}
                  onClick={() => handleSelectSession(session)}
                >
                  <div className={styles.sessionInfo}>
                    <strong>{session.package_name || "Trainer Sessions"}</strong>
                    <p>Sessions: {session.remaining_sessions} remaining</p>
                    <p>Valid: {new Date(session.start_date).toLocaleDateString()} - {new Date(session.expiration_date).toLocaleDateString()}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p>No active trainer sessions available</p>
          )}
        </div>
      )}

      {/* Step 2: Select Trainer */}
      {step === "select-trainer" && selectedSession && (
        <div className={styles.step}>
          <button className={styles.backButton} onClick={() => setStep("select-session")}>← Back</button>
          <h4>Select a Trainer - View Mode</h4>
          
          <div className={styles.viewToggleButtons}>
            <button 
              className={`${styles.viewToggleBtn} ${viewMode === "list" ? styles.active : ""}`}
              onClick={() => setViewMode("list")}
            >
              List View
            </button>
            <button 
              className={`${styles.viewToggleBtn} ${viewMode === "calendar" ? styles.active : ""}`}
              onClick={() => setViewMode("calendar")}
            >
              Calendar View
            </button>
          </div>

          {viewMode === "list" ? (
            <>
              <h4>Available Trainers</h4>
              {trainers && trainers.length > 0 ? (
                <div className={styles.trainerList}>
                  {trainers.map((trainer) => (
                    <div
                      key={trainer.id}
                      className={styles.trainerCard}
                      onClick={() => handleSelectTrainer(trainer)}
                    >
                      <strong>{trainer.firstName} {trainer.lastName}</strong>
                      <p>{trainer.email}</p>
                      <p className={styles.availabilityBadge}>{trainer.availableSlots} available slots</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p>No trainers available</p>
              )}
            </>
          ) : (
            <>
              <TrainerAvailabilityCalendar 
                sessionPackage={selectedSession}
                onSelectSlot={handleCalendarSlotSelect}
              />
            </>
          )}
        </div>
      )}

      {/* Step 3: Select Time Slot */}
      {step === "select-slot" && selectedTrainer && (
        <div className={styles.step}>
          <button className={styles.backButton} onClick={() => setStep("select-trainer")}>← Back</button>
          <h4>Select Available Time</h4>
          <p className={styles.trainerName}>{selectedTrainer.firstName} {selectedTrainer.lastName}</p>
          
          {loading ? (
            <p>Loading availability...</p>
          ) : trainerSlots && trainerSlots.length > 0 ? (
            <div className={styles.slotList}>
              {trainerSlots.map((slot) => (
                <div
                  key={slot.id}
                  className={styles.slotCard}
                  onClick={() => handleSelectSlot(slot)}
                >
                  <div className={styles.slotDate}>
                    {new Date(slot.date).toLocaleDateString()}
                  </div>
                  <div className={styles.slotTime}>
                    {slot.startTime} - {slot.endTime}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p>No available time slots for this trainer during your session period</p>
          )}
        </div>
      )}

      {/* Step 4: Confirm Booking */}
      {step === "confirm" && selectedSlot && (
        <div className={styles.step}>
          <button className={styles.backButton} onClick={() => setStep("select-slot")}>← Back</button>
          <h4>Confirm Booking</h4>
          <div className={styles.confirmDetails}>
            <div>
              <strong>Trainer:</strong> {selectedTrainer?.firstName} {selectedTrainer?.lastName}
            </div>
            <div>
              <strong>Date:</strong> {new Date(selectedSlot.date).toLocaleDateString()}
            </div>
            <div>
              <strong>Time:</strong> {selectedSlot.startTime} - {selectedSlot.endTime}
            </div>
          </div>
          <button
            className={styles.confirmButton}
            onClick={handleConfirmBooking}
            disabled={loading}
          >
            {loading ? "Booking..." : "Confirm Booking"}
          </button>
        </div>
      )}
    </div>
  );
}
