import { useEffect, useState } from "react";
import AccessQRCode from "../components/AccessQRCode";
import TrainerSessionScheduler from "../components/TrainerSessionScheduler";
import SiteHeader from "../components/SiteHeader";
import SiteFooter from "../components/SiteFooter";
import styles from "../styles/StudentProfile.module.css";

/**
 * StudentProfile
 * Member dashboard: read-only profile panel, door-access QR pass with a
 * 30-day scan history modal, and the personal-trainer workout calendar.
 */
export default function StudentProfile({ currentUser, onLogout, onNavigate, onAuthenticated }) {
  const [showHistory, setShowHistory] = useState(false);
  const [scanHistory, setScanHistory] = useState([]);
  const [autoRenew, setAutoRenew] = useState(true);
  const [subscription] = useState({ status: "ACTIVE", title: "Pro Performance" });
  const [statusMessage, setStatusMessage] = useState("");
  const [trainerSessions, setTrainerSessions] = useState([]);
  const [showScheduler, setShowScheduler] = useState(false);
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "/api";

  useEffect(() => {
    const loadHistory = async () => {
      if (!currentUser?.id || !showHistory) return;
      try {
        const token = localStorage.getItem("cas_jwt");
        const res = await fetch(`${apiBaseUrl}/members/scan-history/${currentUser.id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Unable to load scan history.");
        setScanHistory(data.entries || []);
      } catch (error) {
        setStatusMessage(error.message);
      }
    };
    loadHistory();
  }, [showHistory, currentUser?.id, apiBaseUrl]);

  useEffect(() => {
    const loadTrainerSessions = async () => {
      if (!currentUser?.id) return;
      try {
        const token = localStorage.getItem("cas_jwt");
        const res = await fetch(`${apiBaseUrl}/trainer-sessions/student/${currentUser.id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          // Fetch full details with logs for each session
          const sessionsWithLogs = await Promise.all(
            (data || []).map(async (session) => {
              try {
                const detailRes = await fetch(
                  `${apiBaseUrl}/trainer-sessions/session/${session.id}`,
                  { headers: { Authorization: `Bearer ${token}` } }
                );
                if (detailRes.ok) {
                  return await detailRes.json();
                }
              } catch (err) {
                console.error(`Error loading details for session ${session.id}:`, err);
              }
              return session;
            })
          );
          setTrainerSessions(sessionsWithLogs || []);
        }
      } catch (error) {
        console.error("Error loading trainer sessions:", error);
      }
    };
    loadTrainerSessions();
  }, [currentUser?.id, apiBaseUrl]);

  return (
    <div className={styles.page}>
      <SiteHeader
        currentUser={currentUser}
        onNavigate={onNavigate}
        onLogout={onLogout}
        onAuthenticated={onAuthenticated}
      />

      <div className={styles.contentWrap}>
        <div className={styles.header}>
          <div>
            <h1 className={styles.headerTitle}>Welcome back, {currentUser?.firstName || "Member"}!</h1>
            <p className={styles.headerSubtitle}>Member ID: {currentUser?.id}</p>
          </div>
        </div>

        <div className={styles.infoCard}>
          <h2 className={styles.infoTitle}>Profile Info</h2>
          <div className={styles.infoGrid}>
            <p>
              <strong>First Name:</strong> {currentUser?.firstName || "—"}
            </p>
            <p>
              <strong>Last Name:</strong> {currentUser?.lastName || "—"}
            </p>
            <p>
              <strong>Email:</strong> {currentUser?.email || "—"}
            </p>
            <p>
              <strong>Status:</strong> <span className={styles.statusActive}>{subscription.status}</span>
            </p>
            <p>
              <strong>Plan:</strong> {subscription.title}
            </p>
            <p>
              <strong>Renewal Date:</strong> 2026-12-31
            </p>
            <label className={styles.autoRenewLabel}>
              <input
                type="checkbox"
                checked={autoRenew}
                onChange={() => setAutoRenew((prev) => !prev)}
                className={styles.checkbox}
              />
              Auto-Renewal
            </label>
          </div>
        </div>

        <div className={styles.dashboardGrid}>
          <div className={styles.leftColumn}>
            <AccessQRCode userId={currentUser?.id} activeSubscription={subscription} />
            <button type="button" onClick={() => setShowHistory(true)} className={styles.historyButton}>
              History
            </button>

            {trainerSessions.length > 0 ? (
              <div className={styles.sessionsCard}>
                <h2 className={styles.infoTitle}>Trainer Sessions</h2>
                <div className={styles.sessionsList}>
                  {trainerSessions.map((session) => (
                    <div key={session.id} className={styles.sessionItem}>
                      <div className={styles.sessionRow}>
                        <span>Purchased:</span>
                        <span className={styles.sessionValue}>{session.total_sessions}</span>
                      </div>
                      <div className={styles.sessionRow}>
                        <span>Used:</span>
                        <span className={styles.sessionValue}>{session.total_sessions - (session.remaining_sessions || 0)}</span>
                      </div>
                      <div className={styles.sessionRow}>
                        <span>Remaining:</span>
                        <span className={styles.sessionValue}>{session.remaining_sessions || 0}</span>
                      </div>
                      <div className={styles.sessionRow}>
                        <span>Expires:</span>
                        <span className={styles.expiryDate}>
                          {new Date(session.expiration_date).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setShowScheduler(true)}
                  className={styles.scheduleButton}
                >
                  Schedule Session
                </button>
              </div>
            ) : (
              <div className={styles.sessionsCard}>
                <h2 className={styles.infoTitle}>Trainer Sessions</h2>
                <p className={styles.noSessions}>No trainer sessions assigned yet</p>
              </div>
            )}
          </div>

          <div className={styles.calendarColumn}>
          </div>
        </div>

        {statusMessage && <p className={styles.statusMessage}>{statusMessage}</p>}

        {showHistory && (
          <div className={styles.modalOverlay}>
            <div className={styles.modalCard}>
              <div className={styles.modalHeader}>
                <h3 className={styles.modalTitle}>30-Day Scan History</h3>
                <button type="button" onClick={() => setShowHistory(false)} className={styles.modalClose}>✕</button>
              </div>
              <div className={styles.modalBody}>
                {scanHistory.length === 0 ? (
                  <p className={styles.emptyText}>No scans yet</p>
                ) : (
                  <ul className={styles.historyList}>
                    {scanHistory.map((entry, idx) => (
                      <li key={idx} className={styles.historyItem}>
                        <span className={styles.scanDate}>{new Date(entry.scanned_at).toLocaleDateString()}</span>
                        <span className={styles.scanTime}>{new Date(entry.scanned_at).toLocaleTimeString()}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        )}

        {showScheduler && (
          <div className={styles.modalOverlay}>
            <div className={styles.schedulerModalCard}>
              <div className={styles.modalHeader}>
                <h3 className={styles.modalTitle}>Schedule Trainer Session</h3>
                <button type="button" onClick={() => setShowScheduler(false)} className={styles.modalClose}>✕</button>
              </div>
              <div className={styles.schedulerModalBody}>
                <TrainerSessionScheduler
                  studentId={currentUser?.id}
                  trainerSessions={trainerSessions}
                  onSessionBooked={() => {
                    setShowScheduler(false);
                    // Reload trainer sessions after booking
                    const loadTrainerSessions = async () => {
                      if (!currentUser?.id) return;
                      try {
                        const token = localStorage.getItem("cas_jwt");
                        const res = await fetch(`${apiBaseUrl}/trainer-sessions/student/${currentUser.id}`, {
                          headers: { Authorization: `Bearer ${token}` },
                        });
                        if (res.ok) {
                          const data = await res.json();
                          const sessionsWithLogs = await Promise.all(
                            (data || []).map(async (session) => {
                              try {
                                const detailRes = await fetch(
                                  `${apiBaseUrl}/trainer-sessions/session/${session.id}`,
                                  { headers: { Authorization: `Bearer ${token}` } }
                                );
                                if (detailRes.ok) {
                                  return await detailRes.json();
                                }
                              } catch (err) {
                                console.error(`Error loading details for session ${session.id}:`, err);
                              }
                              return session;
                            })
                          );
                          setTrainerSessions(sessionsWithLogs || []);
                        }
                      } catch (error) {
                        console.error("Error loading trainer sessions:", error);
                      }
                    };
                    loadTrainerSessions();
                  }}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      <SiteFooter isSuperuser={currentUser?.roleId === 1} />
    </div>
  );
}

