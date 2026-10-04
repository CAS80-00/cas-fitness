import { useEffect, useState } from "react";
import styles from "../styles/CalendarSlotManagement.module.css";

/**
 * Comprehensive Calendar Slot Management
 * - Superuser creates recurring slots for employees
 * - Generates continuous slots from start time until end time (all day)
 * - Employees/Members approve and manage their slots
 * - Member status options: CONSULTATION, TRAINING, BREAK
 * - Superuser status options: SICK, NO_SHOW, VACATION
 */
export default function CalendarSlotManagement() {
  const [employees, setEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [slotInstances, setSlotInstances] = useState([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [currentUser, setCurrentUser] = useState(null);

  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "/api";

  // Form state for creating new slot template
  const [formData, setFormData] = useState({
    calendarType: "WORKOUT",
    startDate: new Date().toISOString().split("T")[0],
    endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    startHour: 9,
    startMinute: 0,
    durationMinutes: 60,
    endHour: 17,
    endMinute: 0,
    locationFormat: "IN_PERSON",
    daysOfWeek: [1, 2, 3, 4, 5], // Mon-Fri
  });

  const apiToken = () => localStorage.getItem("cas_jwt");
  const currentUserData = localStorage.getItem("cas_user");
  const isSuperuser = currentUserData ? JSON.parse(currentUserData).roleId === 1 : false;

  useEffect(() => {
    loadEmployees();
    if (currentUserData) {
      setCurrentUser(JSON.parse(currentUserData));
    }
  }, []);

  const loadEmployees = async () => {
    try {
      const res = await fetch(`${apiBaseUrl}/admin/users`, {
        headers: { Authorization: `Bearer ${apiToken()}` },
      });
      if (!res.ok) throw new Error("Failed to load employees.");
      const data = await res.json();
      // Filter to only employees (roleId 2 or 3)
      setEmployees(data.users.filter((u) => u.roleId === 2 || u.roleId === 3));
    } catch (err) {
      setMessage(`Error: ${err.message}`);
    }
  };

  const loadSlotInstances = async (userId) => {
    try {
      setLoading(true);
      const token = apiToken();
      const res = await fetch(`${apiBaseUrl}/admin/slot-instances/${userId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to load slots.");
      const data = await res.json();
      setSlotInstances(data.instances || []);
    } catch (err) {
      setMessage(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectEmployee = (employee) => {
    setSelectedEmployee(employee);
    setShowCreateForm(false);
    setMessage("");
    loadSlotInstances(employee.id);
  };

  const handleCreateSlots = async (e) => {
    e.preventDefault();
    if (!selectedEmployee || formData.daysOfWeek.length === 0) {
      setMessage("Please select an employee and at least one day of week.");
      return;
    }

    try {
      setLoading(true);
      const token = apiToken();
      const startTime = `${String(formData.startHour).padStart(2, "0")}:${String(formData.startMinute).padStart(2, "0")}`;
      const endTimeOfDay = `${String(formData.endHour).padStart(2, "0")}:${String(formData.endMinute).padStart(2, "0")}`;

      const payload = {
        userId: selectedEmployee.id,
        calendarType: formData.calendarType,
        startDate: formData.startDate,
        endDate: formData.endDate,
        startTime,
        endTimeOfDay,
        durationMinutes: formData.durationMinutes,
        locationFormat: formData.locationFormat,
        daysOfWeek: formData.daysOfWeek,
      };

      const res = await fetch(`${apiBaseUrl}/admin/slot-templates`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Failed to create slots.");
      const data = await res.json();
      setMessage(`✓ Created ${data.instancesCount} slot instances!`);
      setShowCreateForm(false);
      loadSlotInstances(selectedEmployee.id);
      // Reset form
      setFormData({
        calendarType: "WORKOUT",
        startDate: new Date().toISOString().split("T")[0],
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        startHour: 9,
        startMinute: 0,
        durationMinutes: 60,
        endHour: 17,
        endMinute: 0,
        locationFormat: "IN_PERSON",
        daysOfWeek: [1, 2, 3, 4, 5],
      });
    } catch (err) {
      setMessage(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateSlotStatus = async (slotId, newStatus) => {
    try {
      setLoading(true);
      const token = apiToken();
      const res = await fetch(`${apiBaseUrl}/admin/slot-instances/${slotId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!res.ok) throw new Error("Failed to update slot.");
      setMessage(`✓ Slot updated to ${newStatus}`);
      if (selectedEmployee) loadSlotInstances(selectedEmployee.id);
    } catch (err) {
      setMessage(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSlot = async (slotId) => {
    if (!window.confirm("Delete this slot?")) return;

    try {
      setLoading(true);
      const token = apiToken();
      const res = await fetch(`${apiBaseUrl}/admin/slot-instances/${slotId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error("Failed to delete slot.");
      setMessage("✓ Slot deleted");
      if (selectedEmployee) loadSlotInstances(selectedEmployee.id);
    } catch (err) {
      setMessage(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const timeOptions = [];
  for (let h = 0; h < 24; h++) {
    timeOptions.push({ hour: h, label: `${String(h).padStart(2, "0")}:00` });
  }

  const minuteOptions = [0, 15, 30, 45];
  const durationOptions = Array.from({ length: 12 }, (_, i) => (i + 1) * 5); // 5, 10, 15... 60

  const getMemberStatusOptions = () => ["CONSULTATION", "TRAINING", "BREAK"];
  const getSuperuserStatusOptions = () => ["SICK", "NO_SHOW", "VACATION", "APPROVED"];

  const getStatusColor = (status) => {
    switch (status) {
      case "PENDING":
        return "#fbbf24"; // yellow
      case "APPROVED":
        return "#60a5fa"; // blue
      case "CONSULTATION":
        return "#34d399"; // green
      case "TRAINING":
        return "#8b5cf6"; // purple
      case "BREAK":
        return "#f87171"; // red
      case "SICK":
        return "#ef4444"; // dark red
      case "NO_SHOW":
        return "#f97316"; // orange
      case "VACATION":
        return "#06b6d4"; // cyan
      default:
        return "#6b7280"; // gray
    }
  };

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>Calendar Slot Management</h2>

      <div className={styles.grid}>
        {/* Left Panel: Employee Selection */}
        <div className={styles.panel}>
          <h3 className={styles.panelTitle}>Select Employee</h3>
          <div className={styles.employeeList}>
            {employees.map((emp) => (
              <button
                key={emp.id}
                className={selectedEmployee?.id === emp.id ? styles.employeeButtonActive : styles.employeeButton}
                onClick={() => handleSelectEmployee(emp)}
              >
                <div className={styles.empName}>
                  {emp.firstName} {emp.lastName}
                </div>
                <div className={styles.empRole}>{emp.roleName}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Right Panel: Slot Management */}
        {selectedEmployee && (
          <div className={styles.panel}>
            <div className={styles.panelHeader}>
              <h3 className={styles.panelTitle}>
                Slots for {selectedEmployee.firstName} {selectedEmployee.lastName}
              </h3>
              {isSuperuser && (
                <button
                  className={styles.createButton}
                  onClick={() => setShowCreateForm(!showCreateForm)}
                  disabled={loading}
                >
                  {showCreateForm ? "Cancel" : "+ Create Slots"}
                </button>
              )}
            </div>

            {message && <div className={styles.message}>{message}</div>}

            {/* Create Slot Form */}
            {showCreateForm && isSuperuser && (
              <form className={styles.form} onSubmit={handleCreateSlots}>
                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label>Calendar Type</label>
                    <select
                      value={formData.calendarType}
                      onChange={(e) =>
                        setFormData({ ...formData, calendarType: e.target.value })
                      }
                    >
                      <option value="WORKOUT">Workout Calendar</option>
                      <option value="CONSULTATION">Consultation Calendar</option>
                    </select>
                  </div>

                  <div className={styles.formGroup}>
                    <label>Format</label>
                    <select
                      value={formData.locationFormat}
                      onChange={(e) =>
                        setFormData({ ...formData, locationFormat: e.target.value })
                      }
                    >
                      <option value="IN_PERSON">In-Person</option>
                      <option value="VIDEO">Video</option>
                      <option value="STUDENT_CHOICE">Student's Choice</option>
                    </select>
                  </div>
                </div>

                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label>Start Date</label>
                    <input
                      type="date"
                      value={formData.startDate}
                      onChange={(e) =>
                        setFormData({ ...formData, startDate: e.target.value })
                      }
                      required
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label>End Date</label>
                    <input
                      type="date"
                      value={formData.endDate}
                      onChange={(e) =>
                        setFormData({ ...formData, endDate: e.target.value })
                      }
                      required
                    />
                  </div>
                </div>

                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label>Start Time (Hour)</label>
                    <select
                      value={formData.startHour}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          startHour: parseInt(e.target.value),
                        })
                      }
                    >
                      {timeOptions.map((opt) => (
                        <option key={opt.hour} value={opt.hour}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className={styles.formGroup}>
                    <label>Start Time (Minutes)</label>
                    <select
                      value={formData.startMinute}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          startMinute: parseInt(e.target.value),
                        })
                      }
                    >
                      {minuteOptions.map((m) => (
                        <option key={m} value={m}>
                          :{String(m).padStart(2, "0")}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className={styles.formGroup}>
                    <label>Duration (minutes)</label>
                    <select
                      value={formData.durationMinutes}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          durationMinutes: parseInt(e.target.value),
                        })
                      }
                    >
                      {durationOptions.map((d) => (
                        <option key={d} value={d}>
                          {d} mins
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className={styles.formGroup}>
                    <label>Calculated End Time</label>
                    <div className={styles.calculatedTime}>
                      {String((formData.startHour + Math.floor((formData.startMinute + formData.durationMinutes) / 60))).padStart(2, "0")}
                      :
                      {String((formData.startMinute + formData.durationMinutes) % 60).padStart(2, "0")}
                    </div>
                  </div>
                </div>

                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label>End Time of Day (Hour)</label>
                    <select
                      value={formData.endHour}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          endHour: parseInt(e.target.value),
                        })
                      }
                    >
                      {timeOptions.map((opt) => (
                        <option key={opt.hour} value={opt.hour}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className={styles.formGroup}>
                    <label>End Time of Day (Minutes)</label>
                    <select
                      value={formData.endMinute}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          endMinute: parseInt(e.target.value),
                        })
                      }
                    >
                      {minuteOptions.map((m) => (
                        <option key={m} value={m}>
                          :{String(m).padStart(2, "0")}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className={styles.formGroup}>
                  <label>Days of Week</label>
                  <div className={styles.daysGrid}>
                    {dayNames.map((day, idx) => (
                      <label key={idx} className={styles.dayCheckbox}>
                        <input
                          type="checkbox"
                          checked={formData.daysOfWeek.includes(idx)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFormData({
                                ...formData,
                                daysOfWeek: [...formData.daysOfWeek, idx],
                              });
                            } else {
                              setFormData({
                                ...formData,
                                daysOfWeek: formData.daysOfWeek.filter((d) => d !== idx),
                              });
                            }
                          }}
                        />
                        {day}
                      </label>
                    ))}
                  </div>
                </div>

                <button type="submit" className={styles.submitButton} disabled={loading}>
                  {loading ? "Creating..." : "Create Slot Template"}
                </button>
              </form>
            )}

            {/* Slots List */}
            <div className={styles.slotsList}>
              {loading && <div className={styles.loading}>Loading...</div>}
              {!loading && slotInstances.length === 0 && (
                <div className={styles.empty}>No slots yet.</div>
              )}
              {!loading &&
                slotInstances.map((slot) => (
                  <div key={slot.id} className={styles.slotCard}>
                    <div className={styles.slotDate}>{slot.slot_date}</div>
                    <div className={styles.slotTime}>
                      {slot.start_time} - {slot.end_time}
                    </div>
                    <div
                      className={styles.slotStatus}
                      style={{ backgroundColor: getStatusColor(slot.status) }}
                    >
                      {slot.status}
                    </div>

                    {/* Status Update Buttons */}
                    <div className={styles.slotActions}>
                      {isSuperuser ? (
                        <>
                          {getSuperuserStatusOptions().map((status) => (
                            <button
                              key={status}
                              className={styles.statusBtn}
                              onClick={() => handleUpdateSlotStatus(slot.id, status)}
                              disabled={loading}
                            >
                              {status}
                            </button>
                          ))}
                        </>
                      ) : (
                        <>
                          {getMemberStatusOptions().map((status) => (
                            <button
                              key={status}
                              className={styles.statusBtn}
                              onClick={() => handleUpdateSlotStatus(slot.id, status)}
                              disabled={loading}
                            >
                              {status}
                            </button>
                          ))}
                        </>
                      )}
                      <button
                        className={styles.deleteBtn}
                        onClick={() => handleDeleteSlot(slot.id)}
                        disabled={loading}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
