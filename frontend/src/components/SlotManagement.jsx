import { useEffect, useState } from "react";
import styles from "../styles/SlotManagement.module.css";

export default function SlotManagement() {
  const [activeTab, setActiveTab] = useState("trainer");
  const [trainers, setTrainers] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [slots, setSlots] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const [formData, setFormData] = useState({
    startDate: new Date().toISOString().split("T")[0],
    startHour: 9,
    startMinute: 0,
    durationMinutes: 60,
    locationFormat: "IN_PERSON",
    format: "IN_PERSON",
    consultationStart: "",
    consultationEnd: "",
  });

  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "/api";

  useEffect(() => {
    loadTrainersAndEmployees();
  }, []);

  const loadTrainersAndEmployees = async () => {
    try {
      const token = localStorage.getItem("cas_jwt");
      const res = await fetch(`${apiBaseUrl}/admin/users?roleId=3,2`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to load users.");
      const data = await res.json();

      const trainersData = data.users.filter((u) => u.roleId === 3);
      const employeesData = data.users.filter((u) => u.roleId === 2);

      setTrainers(trainersData);
      setEmployees(employeesData);
    } catch (err) {
      setMessage(`Error loading users: ${err.message}`);
    }
  };

  const loadSlots = async (personId) => {
    try {
      setLoading(true);
      const token = localStorage.getItem("cas_jwt");
      let url;

      if (activeTab === "trainer") {
        url = `${apiBaseUrl}/admin/trainer-slots/${personId}`;
      } else {
        url = `${apiBaseUrl}/admin/consultation-slots?employeeId=${personId}`;
      }

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to load slots.");
      const data = await res.json();
      setSlots(data.slots || []);
    } catch (err) {
      setMessage(`Error loading slots: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPerson = (person) => {
    setSelectedPerson(person);
    setShowForm(false);
    setMessage("");
    loadSlots(person.id);
  };

  const handleCreateSlot = async (e) => {
    e.preventDefault();
    if (!selectedPerson) return;

    try {
      setLoading(true);
      const token = localStorage.getItem("cas_jwt");
      let payload;

      if (activeTab === "trainer") {
        // For trainer: convert date + hour + minute to start/end times
        const startDateTime = `${formData.startDate}T${String(formData.startHour).padStart(2, "0")}:${String(formData.startMinute).padStart(2, "0")}:00`;
        const startDate = new Date(startDateTime);
        const endDate = new Date(startDate.getTime() + formData.durationMinutes * 60000);

        const dayOfWeek = startDate.getDay();
        const startTimeStr = startDate.toTimeString().slice(0, 5);
        const endTimeStr = endDate.toTimeString().slice(0, 5);

        payload = {
          trainerId: selectedPerson.id,
          dayOfWeek: dayOfWeek,
          startTime: startTimeStr,
          endTime: endTimeStr,
          locationFormat: formData.locationFormat,
        };
      } else {
        payload = {
          employeeId: selectedPerson.id,
          startTime: new Date(formData.consultationStart).toISOString(),
          endTime: new Date(formData.consultationEnd).toISOString(),
          format: formData.format,
        };
      }

      const res = await fetch(
        `${apiBaseUrl}/admin/${activeTab === "trainer" ? "trainer-slots" : "consultation-slots"}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        },
      );

      if (!res.ok) throw new Error("Failed to create slot.");
      setMessage("✓ Slot created successfully!");
      setShowForm(false);
      loadSlots(selectedPerson.id);
      // Reset form
      setFormData({
        startDate: new Date().toISOString().split("T")[0],
        startHour: 9,
        startMinute: 0,
        durationMinutes: 60,
        locationFormat: "IN_PERSON",
        format: "IN_PERSON",
        consultationStart: "",
        consultationEnd: "",
      });
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
      const token = localStorage.getItem("cas_jwt");
      const res = await fetch(
        `${apiBaseUrl}/admin/${activeTab === "trainer" ? "trainer-slots" : "consultation-slots"}/${slotId}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      if (!res.ok) throw new Error("Failed to delete slot.");
      setMessage("Slot deleted.");
      if (selectedPerson) loadSlots(selectedPerson.id);
    } catch (err) {
      setMessage(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const minuteOptions = [0, 15, 30, 45];
  const durationOptions = [15, 25, 30, 45, 55, 60, 90, 120];

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>Manage Calendar Slots</h2>

      <div className={styles.tabs}>
        <button
          className={activeTab === "trainer" ? styles.tabActive : styles.tab}
          onClick={() => {
            setActiveTab("trainer");
            setSelectedPerson(null);
            setShowForm(false);
            setSlots([]);
          }}
        >
          Workout Calendar (Trainer Slots)
        </button>
        <button
          className={activeTab === "consultation" ? styles.tabActive : styles.tab}
          onClick={() => {
            setActiveTab("consultation");
            setSelectedPerson(null);
            setShowForm(false);
            setSlots([]);
          }}
        >
          Consultation Calendar
        </button>
      </div>

      <div className={styles.content}>
        {/* Person Selection */}
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>
            {activeTab === "trainer" ? "Select Trainer" : "Select Employee"}
          </h3>
          <div className={styles.personGrid}>
            {(activeTab === "trainer" ? trainers : employees).map((person) => (
              <button
                key={person.id}
                className={
                  selectedPerson?.id === person.id ? styles.personCardActive : styles.personCard
                }
                onClick={() => handleSelectPerson(person)}
              >
                <div className={styles.personName}>
                  {person.firstName} {person.lastName}
                </div>
                <div className={styles.personEmail}>{person.email}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Slots Display */}
        {selectedPerson && (
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <h3 className={styles.sectionTitle}>
                Slots for {selectedPerson.firstName} {selectedPerson.lastName}
              </h3>
              <button
                className={styles.addButton}
                onClick={() => setShowForm(!showForm)}
                disabled={loading}
              >
                {showForm ? "Cancel" : "+ Add Slot"}
              </button>
            </div>

            {message && <div className={styles.message}>{message}</div>}

            {/* Add Slot Form */}
            {showForm && (
              <form className={styles.form} onSubmit={handleCreateSlot}>
                {activeTab === "trainer" ? (
                  <>
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
                      <label>Start Time - Hour</label>
                      <select
                        value={formData.startHour}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            startHour: parseInt(e.target.value),
                          })
                        }
                      >
                        {Array.from({ length: 24 }, (_, i) => (
                          <option key={i} value={i}>
                            {String(i).padStart(2, "0")}:00
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className={styles.formGroup}>
                      <label>Start Time - Minutes</label>
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
                      <label>Format</label>
                      <select
                        value={formData.locationFormat}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            locationFormat: e.target.value,
                          })
                        }
                      >
                        <option value="IN_PERSON">In-Person</option>
                        <option value="VIDEO">Video</option>
                        <option value="STUDENT_CHOICE">Student's Choice</option>
                      </select>
                    </div>
                  </>
                ) : (
                  <>
                    <div className={styles.formGroup}>
                      <label>Start Date & Time</label>
                      <input
                        type="datetime-local"
                        value={formData.consultationStart}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            consultationStart: e.target.value,
                          })
                        }
                        required
                      />
                    </div>
                    <div className={styles.formGroup}>
                      <label>End Date & Time</label>
                      <input
                        type="datetime-local"
                        value={formData.consultationEnd}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            consultationEnd: e.target.value,
                          })
                        }
                        required
                      />
                    </div>
                    <div className={styles.formGroup}>
                      <label>Format</label>
                      <select
                        value={formData.format}
                        onChange={(e) =>
                          setFormData({ ...formData, format: e.target.value })
                        }
                      >
                        <option value="IN_PERSON">In-Person</option>
                        <option value="VIDEO">Video</option>
                      </select>
                    </div>
                  </>
                )}
                <button type="submit" className={styles.submitButton} disabled={loading}>
                  {loading ? "Creating..." : "Create Slot"}
                </button>
              </form>
            )}

            {/* Slots List */}
            <div className={styles.slotsList}>
              {loading && <div className={styles.loading}>Loading...</div>}
              {!loading && slots.length === 0 && (
                <div className={styles.empty}>No slots created yet.</div>
              )}
              {!loading &&
                slots.map((slot) => (
                  <div key={slot.id} className={styles.slotCard}>
                    <div className={styles.slotInfo}>
                      {activeTab === "trainer" ? (
                        <>
                          <div className={styles.slotDay}>{dayNames[slot.dayOfWeek]}</div>
                          <div className={styles.slotTime}>
                            {slot.startTime} - {slot.endTime}
                          </div>
                          <div className={styles.slotFormat}>{slot.locationFormat}</div>
                        </>
                      ) : (
                        <>
                          <div className={styles.slotTime}>
                            {new Date(slot.startTime).toLocaleString()} -{" "}
                            {new Date(slot.endTime).toLocaleTimeString()}
                          </div>
                          <div className={styles.slotFormat}>{slot.format}</div>
                          <div className={styles.slotStatus}>{slot.status}</div>
                        </>
                      )}
                    </div>
                    <button
                      className={styles.deleteButton}
                      onClick={() => handleDeleteSlot(slot.id)}
                      disabled={loading}
                    >
                      Delete
                    </button>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
