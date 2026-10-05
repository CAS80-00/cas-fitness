import { useEffect, useState } from "react";
import styles from "../styles/EmployeeSlotCreation.module.css";

/**
 * EmployeeSlotCreation
 * Allows employees to create their own availability slots
 * Can create slots for WORKOUT or CONSULTATION calendar types
 */
export default function EmployeeSlotCreation({ employeeId, onSlotCreated = () => {} }) {
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "/api";
  const [formData, setFormData] = useState({
    calendarType: "CONSULTATION",
    startDate: new Date().toISOString().split("T")[0],
    endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    startHour: 9,
    startMinute: 0,
    durationMinutes: 60,
    endHour: 17,
    endMinute: 0,
    daysOfWeek: [1, 2, 3, 4, 5], // Mon-Fri
  });

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState(""); // "success", "error"
  const [showForm, setShowForm] = useState(false);

  const apiToken = () => localStorage.getItem("cas_jwt");

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;

    if (type === "checkbox") {
      const dayNum = parseInt(value);
      setFormData((prev) => ({
        ...prev,
        daysOfWeek: checked
          ? [...prev.daysOfWeek, dayNum]
          : prev.daysOfWeek.filter((d) => d !== dayNum),
      }));
    } else if (type === "number") {
      setFormData((prev) => ({
        ...prev,
        [name]: parseInt(value),
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        [name]: value,
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      // Validate dates
      if (new Date(formData.startDate) > new Date(formData.endDate)) {
        throw new Error("Start date must be before end date");
      }

      if (formData.daysOfWeek.length === 0) {
        throw new Error("Please select at least one day of the week");
      }

      // Calculate end time
      const endHour = formData.endHour;
      const endMinute = formData.endMinute;

      const response = await fetch(`${apiBaseUrl}/slots/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiToken()}`,
        },
        body: JSON.stringify({
          userId: employeeId,
          calendarType: formData.calendarType,
          startDate: formData.startDate,
          endDate: formData.endDate,
          startHour: formData.startHour,
          startMinute: formData.startMinute,
          durationMinutes: formData.durationMinutes,
          endHour: endHour,
          endMinute: endMinute,
          locationFormat: "IN_PERSON",
          daysOfWeek: formData.daysOfWeek,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create slots");
      }

      const data = await response.json();
      setMessageType("success");
      setMessage(`✓ Successfully created ${data.slotsCreated} slots`);

      // Reset form
      setFormData({
        calendarType: "CONSULTATION",
        startDate: new Date().toISOString().split("T")[0],
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        startHour: 9,
        startMinute: 0,
        durationMinutes: 60,
        endHour: 17,
        endMinute: 0,
        daysOfWeek: [1, 2, 3, 4, 5],
      });

      // Close form after success
      setTimeout(() => {
        setShowForm(false);
        setMessage("");
        onSlotCreated(); // Trigger parent refresh
      }, 2000);
    } catch (err) {
      console.error("Error creating slots:", err);
      setMessageType("error");
      setMessage(`✗ ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const daysOfWeekLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3 className={styles.title}>Create Availability Slots</h3>
        <button
          className={styles.toggleButton}
          onClick={() => setShowForm(!showForm)}
        >
          {showForm ? "Cancel" : "+ Add Slots"}
        </button>
      </div>

      {showForm && (
        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.formGroup}>
            <label htmlFor="calendarType">Calendar Type</label>
            <select
              id="calendarType"
              name="calendarType"
              value={formData.calendarType}
              onChange={handleInputChange}
              className={styles.select}
            >
              <option value="CONSULTATION">Consultation</option>
              <option value="WORKOUT">Workout</option>
            </select>
          </div>

          <div className={styles.row}>
            <div className={styles.formGroup}>
              <label htmlFor="startDate">Start Date</label>
              <input
                id="startDate"
                type="date"
                name="startDate"
                value={formData.startDate}
                onChange={handleInputChange}
                className={styles.input}
                required
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="endDate">End Date</label>
              <input
                id="endDate"
                type="date"
                name="endDate"
                value={formData.endDate}
                onChange={handleInputChange}
                className={styles.input}
                required
              />
            </div>
          </div>

          <div className={styles.row}>
            <div className={styles.formGroup}>
              <label htmlFor="startHour">Start Time (Hour)</label>
              <input
                id="startHour"
                type="number"
                name="startHour"
                value={formData.startHour}
                onChange={handleInputChange}
                min="0"
                max="23"
                className={styles.input}
                required
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="startMinute">Start Time (Minute)</label>
              <input
                id="startMinute"
                type="number"
                name="startMinute"
                value={formData.startMinute}
                onChange={handleInputChange}
                min="0"
                max="59"
                step="15"
                className={styles.input}
                required
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="durationMinutes">Duration (Minutes)</label>
              <input
                id="durationMinutes"
                type="number"
                name="durationMinutes"
                value={formData.durationMinutes}
                onChange={handleInputChange}
                min="15"
                max="480"
                step="15"
                className={styles.input}
                required
              />
            </div>
          </div>

          <div className={styles.row}>
            <div className={styles.formGroup}>
              <label htmlFor="endHour">End Time (Hour)</label>
              <input
                id="endHour"
                type="number"
                name="endHour"
                value={formData.endHour}
                onChange={handleInputChange}
                min="0"
                max="23"
                className={styles.input}
                required
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="endMinute">End Time (Minute)</label>
              <input
                id="endMinute"
                type="number"
                name="endMinute"
                value={formData.endMinute}
                onChange={handleInputChange}
                min="0"
                max="59"
                step="15"
                className={styles.input}
                required
              />
            </div>
          </div>

          <div className={styles.daysContainer}>
            <label>Days of Week</label>
            <div className={styles.daysGrid}>
              {daysOfWeekLabels.map((day, index) => (
                <label key={index} className={styles.dayCheckbox}>
                  <input
                    type="checkbox"
                    name={`day-${index}`}
                    value={index + 1}
                    checked={formData.daysOfWeek.includes(index + 1)}
                    onChange={handleInputChange}
                  />
                  <span>{day}</span>
                </label>
              ))}
            </div>
          </div>

          {message && (
            <div className={`${styles.message} ${styles[messageType]}`}>
              {message}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className={styles.submitButton}
          >
            {loading ? "Creating..." : "Create Slots"}
          </button>
        </form>
      )}
    </div>
  );
}
