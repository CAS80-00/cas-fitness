import { useState, useEffect } from "react";
import styles from "../styles/TrainerSessionManagement.module.css";

/**
 * TrainerSessionManagement
 * Comprehensive trainer session management for admin/superuser
 * Features:
 * - View all trainer sessions for a student
 * - Add new trainer sessions
 * - Edit existing sessions (dates, trainer, expiration)
 * - Delete sessions
 * - Track individual session logs
 * - Mark sessions as completed/scheduled/cancelled
 */
export default function TrainerSessionManagement({ studentId, onClose }) {
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "/api";

  const [sessions, setSessions] = useState([]);
  const [packages, setPackages] = useState([]);
  const [trainers, setTrainers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [activeTab, setActiveTab] = useState("sessions"); // 'sessions' or 'packages'
  const [selectedSession, setSelectedSession] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("add"); // 'add', 'edit', 'view'

  const [formData, setFormData] = useState({
    total_sessions: 4,
    start_date: new Date().toISOString().split("T")[0],
    expiration_date: "",
    notes: "",
  });

  const authHeaders = () => ({
    "Authorization": "Bearer " + localStorage.getItem("cas_jwt"),
    "Content-Type": "application/json",
  });

  // Load data on mount
  useEffect(() => {
    loadSessions();
    loadPackages();
  }, [studentId]);

  const loadSessions = async () => {
    try {
      setError("");
      const res = await fetch(
        `${apiBaseUrl}/trainer-sessions/student/${studentId}`,
        { headers: authHeaders() }
      );
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to load trainer sessions (${res.status})`);
      }
      const data = await res.json();
      setSessions(data);
    } catch (err) {
      console.error("Error fetching sessions:", err);
      setError(err.message);
    }
  };

  const loadPackages = async () => {
    try {
      const res = await fetch(`${apiBaseUrl}/trainer-sessions/packages`, {
        headers: authHeaders(),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to load packages (${res.status})`);
      }
      const data = await res.json();
      setPackages(data);
    } catch (err) {
      console.error("Error loading packages:", err);
    }
  };

  const handleAddSession = () => {
    setModalMode("add");
    setSelectedSession(null);
    setFormData({
      total_sessions: 4,
      start_date: new Date().toISOString().split("T")[0],
      expiration_date: "",
      notes: "",
    });
    setIsModalOpen(true);
  };

  const handleEditSession = (session) => {
    setModalMode("edit");
    setSelectedSession(session);
    setFormData({
      total_sessions: session.total_sessions,
      start_date: new Date(session.start_date).toISOString().split("T")[0],
      expiration_date: new Date(session.expiration_date)
        .toISOString()
        .split("T")[0],
      notes: session.notes || "",
    });
    setIsModalOpen(true);
  };

  const handleViewSession = (session) => {
    setModalMode("view");
    setSelectedSession(session);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      if (!formData.total_sessions) throw new Error("Session count is required");
      if (!formData.expiration_date)
        throw new Error("Expiration date is required");

      const payload = {
        student_id: studentId,
        total_sessions: parseInt(formData.total_sessions),
        start_date: new Date(formData.start_date).toISOString(),
        expiration_date: new Date(formData.expiration_date).toISOString(),
        notes: formData.notes,
      };

      console.log('Sending payload:', payload);

      let res;
      if (modalMode === "add") {
        res = await fetch(`${apiBaseUrl}/trainer-sessions/assign`, {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch(
          `${apiBaseUrl}/trainer-sessions/session/${selectedSession.id}`,
          {
            method: "PUT",
            headers: authHeaders(),
            body: JSON.stringify(payload),
          }
        );
      }

      if (!res.ok) {
        const err = await res.json();
        console.error('Backend error response:', err);
        console.error('Stringified:', JSON.stringify(err));
        throw new Error(err.error || "Failed to save session");
      }

      setSuccess(
        `Trainer session ${modalMode === "add" ? "created" : "updated"} successfully`
      );
      setIsModalOpen(false);
      loadSessions();
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteSession = async (sessionId) => {
    if (!window.confirm("Are you sure you want to delete this session package?"))
      return;

    try {
      const res = await fetch(
        `${apiBaseUrl}/trainer-sessions/session/${sessionId}`,
        {
          method: "DELETE",
          headers: authHeaders(),
        }
      );

      if (!res.ok) throw new Error("Failed to delete session");
      setSuccess("Trainer session deleted successfully");
      loadSessions();
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleUpdateSessionLog = async (logId, status) => {
    try {
      const res = await fetch(
        `${apiBaseUrl}/trainer-sessions/session-log/${logId}`,
        {
          method: "PUT",
          headers: authHeaders(),
          body: JSON.stringify({ status }),
        }
      );

      if (!res.ok) throw new Error("Failed to update session log");
      setSuccess("Session log updated successfully");
      loadSessions();
    } catch (err) {
      setError(err.message);
    }
  };

  const getPackageName = (packageId) => {
    if (!packageId) return "Custom";
    const pkg = packages.find((p) => p.id === packageId);
    return pkg ? pkg.name : "Unknown";
  };

  const isExpired = (expirationDate) => {
    return new Date(expirationDate) < new Date();
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2>Trainer Session Management</h2>
        <button className={styles.closeBtn} onClick={onClose}>
          ✕
        </button>
      </div>

      {error && <div className={styles.alert}>{error}</div>}
      {success && <div className={styles.successAlert}>{success}</div>}

      <div className={styles.tabsContainer}>
        <button
          className={`${styles.tab} ${activeTab === "sessions" ? styles.active : ""}`}
          onClick={() => setActiveTab("sessions")}
        >
          Sessions ({sessions.length})
        </button>
        <button
          className={`${styles.tab} ${activeTab === "packages" ? styles.active : ""}`}
          onClick={() => setActiveTab("packages")}
        >
          Packages ({packages.length})
        </button>
      </div>

      {activeTab === "sessions" && (
        <div className={styles.tabContent}>
          <button className={styles.primaryBtn} onClick={handleAddSession}>
            + Add New Session Package
          </button>

          {sessions.length === 0 ? (
            <p className={styles.emptyState}>No trainer sessions assigned yet</p>
          ) : (
            <div className={styles.sessionsList}>
              {sessions.map((session) => (
                <div
                  key={session.id}
                  className={`${styles.sessionCard} ${
                    isExpired(session.expiration_date) ? styles.expired : ""
                  } ${session.status === "CANCELLED" ? styles.cancelled : ""}`}
                >
                  <div className={styles.sessionHeader}>
                    <div>
                      <h3>{getPackageName(session.package_id)}</h3>
                    </div>
                    <span
                      className={`${styles.badge} ${styles[`status-${session.status}`]}`}
                    >
                      {session.status}
                    </span>
                  </div>

                  <div className={styles.sessionDetails}>
                    <div className={styles.detail}>
                      <span className={styles.label}>Total Sessions:</span>
                      <span className={styles.value}>{session.total_sessions}</span>
                    </div>
                    <div className={styles.detail}>
                      <span className={styles.label}>Remaining:</span>
                      <span className={styles.value}>
                        {session.remaining_sessions}
                      </span>
                    </div>
                    <div className={styles.detail}>
                      <span className={styles.label}>Start Date:</span>
                      <span className={styles.value}>
                        {new Date(session.start_date).toLocaleDateString()}
                      </span>
                    </div>
                    <div className={styles.detail}>
                      <span className={styles.label}>Expires:</span>
                      <span
                        className={`${styles.value} ${
                          isExpired(session.expiration_date) ? styles.expiredText : ""
                        }`}
                      >
                        {new Date(session.expiration_date).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  {session.notes && (
                    <div className={styles.notes}>
                      <p>
                        <strong>Notes:</strong> {session.notes}
                      </p>
                    </div>
                  )}

                  <div className={styles.actions}>
                    <button
                      className={styles.secondaryBtn}
                      onClick={() => handleViewSession(session)}
                    >
                      View Details
                    </button>
                    <button
                      className={styles.secondaryBtn}
                      onClick={() => handleEditSession(session)}
                    >
                      Edit
                    </button>
                    <button
                      className={styles.dangerBtn}
                      onClick={() => handleDeleteSession(session.id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "packages" && (
        <div className={styles.tabContent}>
          {packages.length === 0 ? (
            <p className={styles.emptyState}>No trainer session packages available</p>
          ) : (
            <div className={styles.packagesList}>
              {packages.map((pkg) => (
                <div key={pkg.id} className={styles.packageCard}>
                  <h3>{pkg.name}</h3>
                  <p>{pkg.description}</p>
                  <div className={styles.packageDetails}>
                    <div>
                      <span className={styles.label}>Sessions:</span>
                      <span>{pkg.session_count}</span>
                    </div>
                    <div>
                      <span className={styles.label}>Duration:</span>
                      <span>{pkg.duration_minutes} mins</span>
                    </div>
                    <div>
                      <span className={styles.label}>Price:</span>
                      <span>${pkg.price.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {isModalOpen && (
        <SessionModal
          mode={modalMode}
          session={selectedSession}
          formData={formData}
          setFormData={setFormData}
          trainers={trainers}
          packages={packages}
          isLoading={isLoading}
          onSubmit={handleSubmit}
          onClose={() => setIsModalOpen(false)}
          onUpdateLog={handleUpdateSessionLog}
        />
      )}
    </div>
  );
}

/**
 * SessionModal
 * Modal for adding/editing/viewing trainer sessions
 */
function SessionModal({
  mode,
  session,
  formData,
  setFormData,
  trainers,
  packages,
  isLoading,
  onSubmit,
  onClose,
  onUpdateLog,
}) {
  const calculateExpirationDate = (startDate, sessionCount) => {
    const date = new Date(startDate);
    // Assume 1 session per week, so sessions * 7 days
    date.setDate(date.getDate() + sessionCount * 7);
    return date.toISOString().split("T")[0];
  };

  const handleStartDateChange = (value) => {
    setFormData({
      ...formData,
      start_date: value,
      expiration_date: calculateExpirationDate(value, formData.total_sessions),
    });
  };

  const handleSessionCountChange = (value) => {
    setFormData({
      ...formData,
      total_sessions: value,
      expiration_date: calculateExpirationDate(
        formData.start_date,
        value
      ),
    });
  };

  return (
    <div className={styles['modal-overlay']}>
      <div className={styles['modal-content']}>
        <div className={styles['modal-header']}>
          <h2>
            {mode === "add" && "Add New Trainer Session"}
            {mode === "edit" && "Edit Trainer Session"}
            {mode === "view" && "View Trainer Session"}
          </h2>
          <button className={styles['modal-close']} onClick={onClose}>
            ✕
          </button>
        </div>

        {mode === "view" && session ? (
          <SessionDetails session={session} onUpdateLog={onUpdateLog} />
        ) : (
          <form onSubmit={onSubmit} className={styles.form}>
            <div className={styles['form-group']}>
              <label>Number of Sessions *</label>
              <input
                type="number"
                min="1"
                value={formData.total_sessions}
                onChange={(e) => handleSessionCountChange(e.target.value)}
                required
              />
            </div>

            <div className={styles['form-group']}>
              <label>Start Date *</label>
              <input
                type="date"
                value={formData.start_date}
                onChange={(e) => handleStartDateChange(e.target.value)}
                required
              />
            </div>

            <div className={styles['form-group']}>
              <label>Expiration Date *</label>
              <input
                type="date"
                value={formData.expiration_date}
                onChange={(e) =>
                  setFormData({ ...formData, expiration_date: e.target.value })
                }
                required
              />
              <small>Auto-calculated based on session count (7 days/session)</small>
            </div>

            <div className={styles['form-group']}>
              <label>Notes</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows="3"
              />
            </div>

            <div className={styles['form-actions']}>
              <button
                type="submit"
                className={styles['primary-btn']}
                disabled={isLoading}
              >
                {isLoading ? "Saving..." : "Save Session"}
              </button>
              <button
                type="button"
                className={styles['secondary-btn']}
                onClick={onClose}
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

/**
 * SessionDetails
 * Display detailed view of a trainer session with all logs
 */
function SessionDetails({ session, onUpdateLog }) {
  return (
    <div className={styles['session-details']}>
      <div className={styles['details-section']}>
        <h3>Session Information</h3>
        <table className={styles['details-table']}>
          <tbody>
            <tr>
              <td>Total Sessions:</td>
              <td>{session.total_sessions}</td>
            </tr>
            <tr>
              <td>Remaining Sessions:</td>
              <td>{session.remaining_sessions}</td>
            </tr>
            <tr>
              <td>Start Date:</td>
              <td>{new Date(session.start_date).toLocaleDateString()}</td>
            </tr>
            <tr>
              <td>Expires:</td>
              <td>{new Date(session.expiration_date).toLocaleDateString()}</td>
            </tr>
            <tr>
              <td>Status:</td>
              <td>{session.status}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {session.session_logs && session.session_logs.length > 0 && (
        <div className={styles['details-section']}>
          <h3>Session Logs</h3>
          <div className={styles['logs-table-container']}>
            <table className={styles['logs-table']}>
              <thead>
                <tr>
                  <th>Session #</th>
                  <th>Scheduled</th>
                  <th>Completed</th>
                  <th>Status</th>
                  <th>Format</th>
                  <th>Notes</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {session.session_logs.map((log) => (
                  <tr key={log.id}>
                    <td>{log.session_number}</td>
                    <td>
                      {log.scheduled_date
                        ? new Date(log.scheduled_date).toLocaleDateString()
                        : "-"}
                    </td>
                    <td>
                      {log.completed_date
                        ? new Date(log.completed_date).toLocaleDateString()
                        : "-"}
                    </td>
                    <td>
                      <select
                        value={log.status}
                        onChange={(e) => onUpdateLog(log.id, e.target.value)}
                        className={styles['status-select']}
                      >
                        <option value="PENDING">Pending</option>
                        <option value="SCHEDULED">Scheduled</option>
                        <option value="COMPLETED">Completed</option>
                        <option value="CANCELLED">Cancelled</option>
                        <option value="RESCHEDULED">Rescheduled</option>
                        <option value="NO_SHOW">No Show</option>
                      </select>
                    </td>
                    <td>{log.location_format || "-"}</td>
                    <td className={styles['notes-col']}>{log.notes || "-"}</td>
                    <td></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {session.notes && (
        <div className={styles['details-section']}>
          <h3>Notes</h3>
          <p>{session.notes}</p>
        </div>
      )}
    </div>
  );
}
