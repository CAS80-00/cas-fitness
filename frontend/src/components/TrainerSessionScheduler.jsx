import { useState, useEffect } from "react";
import styles from "../styles/TrainerSessionScheduler.module.css";

/**
 * TrainerSessionScheduler
 * Allows students with available trainer sessions to:
 * - View list of available trainers
 * - See trainer availability (days/times)
 * - Book specific sessions
 */
export default function TrainerSessionScheduler({ studentId, trainerSessions, onSessionBooked }) {
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "/api";

  const [step, setStep] = useState("select-session"); // 'select-session', 'select-trainer', 'select-time', 'confirm'
  const [trainers, setTrainers] = useState([]);
  const [selectedSession, setSelectedSession] = useState(null);
  const [selectedTrainer, setSelectedTrainer] = useState(null);
  const [trainerSchedule, setTrainerSchedule] = useState(null);
  const [selectedAvailability, setSelectedAvailability] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedLocationFormat, setSelectedLocationFormat] = useState("IN_PERSON");
  const [selectedSessionLog, setSelectedSessionLog] = useState(null);

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
          throw new Error("Failed to load available trainers");
        }
        const data = await res.json();
        setTrainers(data);
      } catch (err) {
        setError(err.message);
      }
    };
    loadTrainers();
  }, [apiBaseUrl]);

  const handleSelectSession = (session) => {
    setSelectedSession(session);
    setStep("select-trainer");
    setError("");
  };

  const handleSelectTrainer = async (trainer) => {
    setLoading(true);
    try {
      setError("");
      const res = await fetch(
        `${apiBaseUrl}/trainer-sessions/trainer-schedule/${trainer.id}`,
        { headers: authHeaders() }
      );
      if (!res.ok) {
        throw new Error("Failed to load trainer schedule");
      }
      const data = await res.json();
      setSelectedTrainer(trainer);
      setTrainerSchedule(data);
      setStep("select-time");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectTimeSlot = (availability) => {
    setSelectedAvailability(availability);
    setSelectedDate(null);
    setSelectedLocationFormat(availability.locationFormat === "STUDENT_CHOICE" ? "IN_PERSON" : availability.locationFormat);
  };

  const handleDateChange = (e) => {
    setSelectedDate(e.target.value);
  };

  const isDateWithinRange = (date) => {
    if (!date || !selectedSession) return false;
    const selectedDateTime = new Date(date);
    const startDate = new Date(selectedSession.start_date);
    const expirationDate = new Date(selectedSession.expiration_date);
    return selectedDateTime >= startDate && selectedDateTime <= expirationDate;
  };

  const isDateAvailable = (date) => {
    if (!date || !selectedAvailability) return false;
    const selectedDateTime = new Date(date);
    const dayOfWeek = selectedDateTime.getDay();
    return dayOfWeek === selectedAvailability.dayOfWeek;
  };

  const handleProceedToConfirm = () => {
    if (!selectedDate) {
      setError("Please select a date");
      return;
    }

    // Find the first pending session log for this session
    const pendingLog = selectedSession.session_logs?.find(log => log.status === 'PENDING');
    if (!pendingLog) {
      setError("No pending sessions available to book");
      return;
    }

    setSelectedSessionLog(pendingLog);
    setStep("confirm");
  };

  const handleConfirmBooking = async () => {
    if (!selectedSessionLog || !selectedDate || !selectedTrainer) {
      setError("Missing required booking information");
      return;
    }

    setLoading(true);
    try {
      setError("");
      const res = await fetch(`${apiBaseUrl}/trainer-sessions/book-session`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          sessionId: selectedSession.id,
          sessionLogId: selectedSessionLog.id,
          trainerId: selectedTrainer.id,
          scheduledDate: selectedDate,
          locationFormat: selectedLocationFormat,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to book session");
      }

      setSuccess("Session booked successfully!");
      setTimeout(() => {
        if (onSessionBooked) {
          onSessionBooked();
        }
        resetForm();
      }, 1500);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setStep("select-session");
    setSelectedSession(null);
    setSelectedTrainer(null);
    setTrainerSchedule(null);
    setSelectedAvailability(null);
    setSelectedDate(null);
    setSelectedLocationFormat("IN_PERSON");
    setSelectedSessionLog(null);
    setSuccess("");
  };

  const availablePendingSessions = trainerSessions.filter(
    (session) => session.status === "ACTIVE" && session.remaining_sessions > 0 && 
                 (new Date(session.expiration_date) > new Date())
  );

  if (availablePendingSessions.length === 0) {
    return (
      <div className={styles.emptyState}>
        <p>No available trainer sessions to book at this time.</p>
      </div>
    );
  }

  return (
    <div className={styles.scheduler}>
      {error && <div className={styles.errorMessage}>{error}</div>}
      {success && <div className={styles.successMessage}>{success}</div>}

      {step === "select-session" && (
        <div className={styles.step}>
          <h3 className={styles.stepTitle}>Select a Session Package</h3>
          <div className={styles.sessionList}>
            {availablePendingSessions.map((session) => (
              <div
                key={session.id}
                className={styles.sessionCard}
                onClick={() => handleSelectSession(session)}
              >
                <div className={styles.sessionInfo}>
                  <p className={styles.packageName}>{session.package_name || "Trainer Sessions"}</p>
                  <p className={styles.sessionDetails}>
                    Remaining: <strong>{session.remaining_sessions}/{session.total_sessions}</strong>
                  </p>
                  <p className={styles.expiryDate}>
                    Expires: {new Date(session.expiration_date).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {step === "select-trainer" && selectedSession && (
        <div className={styles.step}>
          <button className={styles.backButton} onClick={() => setStep("select-session")}>
            ← Back
          </button>
          <h3 className={styles.stepTitle}>Select a Trainer</h3>
          {loading ? (
            <p className={styles.loadingText}>Loading trainers...</p>
          ) : (
            <div className={styles.trainerList}>
              {trainers.map((trainer) => (
                <div
                  key={trainer.id}
                  className={styles.trainerCard}
                  onClick={() => handleSelectTrainer(trainer)}
                >
                  <div className={styles.trainerInfo}>
                    <p className={styles.trainerName}>
                      {trainer.firstName} {trainer.lastName}
                    </p>
                    <p className={styles.trainerEmail}>{trainer.email}</p>
                    {trainer.phone && <p className={styles.trainerPhone}>{trainer.phone}</p>}
                    <p className={styles.availabilityCount}>
                      {trainer.availabilityCount} availability slots
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {step === "select-time" && selectedTrainer && trainerSchedule && (
        <div className={styles.step}>
          <button className={styles.backButton} onClick={() => setStep("select-trainer")}>
            ← Back
          </button>
          <h3 className={styles.stepTitle}>
            Select Time with {selectedTrainer.firstName} {selectedTrainer.lastName}
          </h3>

          <div className={styles.availabilitySection}>
            <h4 className={styles.sectionTitle}>Available Time Slots</h4>
            <div className={styles.availabilityGrid}>
              {trainerSchedule.availability.length > 0 ? (
                trainerSchedule.availability.map((slot) => (
                  <div
                    key={slot.id}
                    className={`${styles.availabilitySlot} ${
                      selectedAvailability?.id === slot.id ? styles.selected : ""
                    }`}
                    onClick={() => handleSelectTimeSlot(slot)}
                  >
                    <p className={styles.dayOfWeek}>
                      {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][slot.dayOfWeek]}
                    </p>
                    <p className={styles.timeRange}>
                      {slot.startTime} - {slot.endTime}
                    </p>
                    <p className={styles.locationFormat}>
                      {slot.locationFormat === "STUDENT_CHOICE"
                        ? "Your Choice"
                        : slot.locationFormat}
                    </p>
                  </div>
                ))
              ) : (
                <p className={styles.noSlots}>No availability slots found</p>
              )}
            </div>
          </div>

          {selectedAvailability && (
            <div className={styles.dateSelectionSection}>
              <h4 className={styles.sectionTitle}>Select Date</h4>
              <input
                type="date"
                value={selectedDate}
                onChange={handleDateChange}
                min={new Date().toISOString().split("T")[0]}
                max={new Date(selectedSession.expiration_date).toISOString().split("T")[0]}
                className={styles.dateInput}
              />
              {selectedDate && !isDateWithinRange(selectedDate) && (
                <p className={styles.errorText}>Date is outside session validity period</p>
              )}
              {selectedDate && !isDateAvailable(selectedDate) && (
                <p className={styles.errorText}>
                  Date is not a {["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][selectedAvailability.dayOfWeek]}
                </p>
              )}

              {selectedAvailability.locationFormat === "STUDENT_CHOICE" && (
                <div className={styles.locationSection}>
                  <h4 className={styles.sectionTitle}>Session Format</h4>
                  <div className={styles.locationOptions}>
                    <label className={styles.radioLabel}>
                      <input
                        type="radio"
                        name="locationFormat"
                        value="IN_PERSON"
                        checked={selectedLocationFormat === "IN_PERSON"}
                        onChange={(e) => setSelectedLocationFormat(e.target.value)}
                      />
                      In-Person
                    </label>
                    <label className={styles.radioLabel}>
                      <input
                        type="radio"
                        name="locationFormat"
                        value="VIDEO"
                        checked={selectedLocationFormat === "VIDEO"}
                        onChange={(e) => setSelectedLocationFormat(e.target.value)}
                      />
                      Video
                    </label>
                  </div>
                </div>
              )}

              <button
                className={styles.proceedButton}
                onClick={handleProceedToConfirm}
                disabled={!selectedDate || !isDateWithinRange(selectedDate) || !isDateAvailable(selectedDate)}
              >
                Proceed to Confirm
              </button>
            </div>
          )}
        </div>
      )}

      {step === "confirm" && selectedSession && selectedTrainer && selectedSessionLog && (
        <div className={styles.step}>
          <button className={styles.backButton} onClick={() => setStep("select-time")}>
            ← Back
          </button>
          <h3 className={styles.stepTitle}>Confirm Your Booking</h3>

          <div className={styles.confirmationCard}>
            <div className={styles.confirmRow}>
              <span className={styles.label}>Session Package:</span>
              <span className={styles.value}>{selectedSession.package_name || "Trainer Sessions"}</span>
            </div>
            <div className={styles.confirmRow}>
              <span className={styles.label}>Trainer:</span>
              <span className={styles.value}>
                {selectedTrainer.firstName} {selectedTrainer.lastName}
              </span>
            </div>
            <div className={styles.confirmRow}>
              <span className={styles.label}>Session Date:</span>
              <span className={styles.value}>
                {new Date(selectedDate).toLocaleDateString()}
              </span>
            </div>
            <div className={styles.confirmRow}>
              <span className={styles.label}>Time:</span>
              <span className={styles.value}>
                {selectedAvailability.startTime} - {selectedAvailability.endTime}
              </span>
            </div>
            <div className={styles.confirmRow}>
              <span className={styles.label}>Format:</span>
              <span className={styles.value}>{selectedLocationFormat}</span>
            </div>
            <div className={styles.confirmRow}>
              <span className={styles.label}>Session Number:</span>
              <span className={styles.value}>{selectedSessionLog.session_number}</span>
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
