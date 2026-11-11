import { useEffect, useState } from "react";
import AccessQRCode from "../components/AccessQRCode";
import TrainerSessionScheduler from "../components/TrainerSessionScheduler";
import StudentSessionManagement from "../components/StudentSessionManagement";
import SessionHistory from "../components/SessionHistory";
import CreditCardManager from "../components/CreditCardManager";
import CreditCardModal from "../components/CreditCardModal";
import SubscriptionManagement from "../components/SubscriptionManagement";
import ChangePasswordModal from "../components/ChangePasswordModal";
import SiteHeader from "../components/SiteHeader";
import SiteFooter from "../components/SiteFooter";
import BannerDisplay from "../components/BannerDisplay";
import styles from "../styles/StudentProfile.module.css";

/**
 * StudentProfile
 * Member dashboard: read-only profile panel, door-access QR pass with a
 * 30-day scan history modal, and the personal-trainer workout calendar.
 */
export default function StudentProfile({ currentUser, onLogout, onNavigate, onAuthenticated, cartItems = [] }) {
  const [showHistory, setShowHistory] = useState(false);
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [scanHistory, setScanHistory] = useState([]);
  const [subscription, setSubscription] = useState(null);
  const [autoRenew, setAutoRenew] = useState(true);
  const [updatingAutoRenew, setUpdatingAutoRenew] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [trainerSessions, setTrainerSessions] = useState([]);
  const [showScheduler, setShowScheduler] = useState(false);
  const [showCardModal, setShowCardModal] = useState(false);
  const [showArchivedSessions, setShowArchivedSessions] = useState(false);
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "/api";

  // Load active subscription on mount
  useEffect(() => {
    const loadSubscription = async () => {
      if (!currentUser?.id) return;
      try {
        const token = localStorage.getItem("cas_jwt");
        const res = await fetch(`${apiBaseUrl}/subscriptions/student/${currentUser.id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.ok) {
          const data = await res.json();
          // Find active or paused subscription
          const activeSubscription = data.subscriptions?.find(sub => 
            sub.status === 'ACTIVE' || sub.status === 'PAUSED'
          );
          if (activeSubscription) {
            setSubscription(activeSubscription);
            setAutoRenew(activeSubscription.auto_renew ?? true);
          }
        }

        // Check if card is expired and pause subscription if needed
        const cardCheckRes = await fetch(`${apiBaseUrl}/subscriptions/check-card-status/${currentUser.id}`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });

        if (cardCheckRes.ok) {
          const cardStatus = await cardCheckRes.json();
          if (cardStatus.isExpired) {
            setStatusMessage('Your subscription has been paused because your credit card expired. Please update your card.');
          }
        }
      } catch (err) {
        console.error('Error loading subscription:', err);
      }
    };
    loadSubscription();
  }, [currentUser?.id, apiBaseUrl]);

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
    const autoCompletePastSessions = async () => {
      if (!currentUser?.id) return;
      try {
        const token = localStorage.getItem("cas_jwt");
        await fetch(`${apiBaseUrl}/trainer-sessions/auto-complete/${currentUser.id}`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch (error) {
        console.error("Error auto-completing sessions:", error);
      }
    };
    autoCompletePastSessions();
  }, [currentUser?.id, apiBaseUrl]);

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

  // Get archived sessions (expired in the last 3 months)
  const getArchivedSessions = () => {
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    
    return trainerSessions.filter(session => 
      session.is_expired && 
      new Date(session.expiration_date) >= threeMonthsAgo
    );
  };

  // Get active sessions (not expired)
  const getActiveSessions = () => {
    return trainerSessions.filter(session => !session.is_expired);
  };

  const archivedSessions = getArchivedSessions();
  const activeSessions = getActiveSessions();

  return (
    <div className={styles.page}>
      <SiteHeader
        currentUser={currentUser}
        onNavigate={onNavigate}
        onLogout={onLogout}
        onAuthenticated={onAuthenticated}
        cartItemCount={cartItems.length}
      />

      <BannerDisplay page="dashboard" />

      <div className={styles.contentWrap}>
        <div className={styles.header}>
          <div>
            <h1 className={styles.headerTitle}>Welcome back, {currentUser?.firstName || "Member"}!</h1>
            <p className={styles.headerSubtitle}>Member ID: {currentUser?.id}</p>
          </div>
        </div>

        <div className={styles.infoCard}>
          <div className={styles.profileGrid}>
            {/* Column 1: QR Code + History */}
            <div className={styles.qrColumn}>
              <AccessQRCode userId={currentUser?.id} activeSubscription={subscription} />
              <button type="button" onClick={() => setShowHistory(true)} className={styles.historyButton}>
                History
              </button>
            </div>

            {/* Column 2: Profile Information */}
            <div className={styles.infoColumn}>
              <h2 className={styles.infoTitle}>Profile Info</h2>
              <div><strong>First Name:</strong> {currentUser?.firstName || "—"}</div>
              <div><strong>Last Name:</strong> {currentUser?.lastName || "—"}</div>
              <div><strong>Email:</strong> {currentUser?.email || "—"}</div>
              <div><strong>Status:</strong> <span className={styles.statusActive}>{subscription?.status || 'No Active Subscription'}</span></div>
              <div><strong>Plan:</strong> {subscription?.title || '—'}</div>
              {subscription?.next_renewal_date && (
                <div><strong>Next Payment:</strong> {new Date(subscription.next_renewal_date).toLocaleDateString()}</div>
              )}
              <button type="button" onClick={() => setShowChangePasswordModal(true)} className={styles.historyButton}>
                Change Password
              </button>
            </div>

            {/* Column 3: Payment Method + Auto-Renewal */}
            <div className={styles.paymentColumn}>
              <CreditCardManager userId={currentUser?.id} onAddCard={() => setShowCardModal(true)} />
              
              <label className={styles.autoRenewLabel}>
                <input
                  type="checkbox"
                  checked={autoRenew}
                  onChange={async () => {
                    if (!subscription?.id) return;
                    const newValue = !autoRenew;
                    setUpdatingAutoRenew(true);
                    try {
                      const token = localStorage.getItem("cas_jwt");
                      const res = await fetch(`${apiBaseUrl}/subscriptions/${subscription.id}/auto-renew`, {
                        method: 'PUT',
                        headers: {
                          'Authorization': `Bearer ${token}`,
                          'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ autoRenew: newValue }),
                      });

                      if (res.ok) {
                        setAutoRenew(newValue);
                        setSubscription({ ...subscription, auto_renew: newValue });
                        setStatusMessage(`Auto-renewal ${newValue ? 'enabled' : 'disabled'}`);
                      } else {
                        const data = await res.json();
                        setStatusMessage(data.error || 'Failed to update auto-renewal');
                      }
                    } catch (err) {
                      setStatusMessage('Error updating auto-renewal setting');
                      console.error('Error:', err);
                    } finally {
                      setUpdatingAutoRenew(false);
                    }
                  }}
                  disabled={updatingAutoRenew}
                  className={styles.checkbox}
                />
                Auto-Renewal
              </label>
            </div>
          </div>

          <SubscriptionManagement userId={currentUser?.id} />
        </div>

        <div className={styles.dashboardGrid}>
          <div className={styles.leftColumn}>

            {activeSessions.length > 0 ? (
              <div className={styles.sessionsCard}>
                <h2 className={styles.infoTitle}>Trainer Sessions</h2>
                <div className={styles.sessionsList}>
                  {activeSessions.map((session) => (
                    <div key={session.id} className={styles.sessionItem}>
                      <div className={styles.sessionRow}>
                        <span>Purchased:</span>
                        <span className={styles.sessionValue}>{session.purchased_sessions || session.total_sessions}</span>
                      </div>
                      <div className={styles.sessionRow}>
                        <span>Used:</span>
                        <span className={styles.sessionValue}>{session.used_sessions || 0}</span>
                      </div>
                      <div className={styles.sessionRow}>
                        <span>Scheduled:</span>
                        <span className={styles.sessionValue}>{session.scheduled_sessions || 0}</span>
                      </div>
                      <div className={styles.sessionRow}>
                        <span>Remaining:</span>
                        <span className={`${styles.sessionValue}`}>{session.remaining_sessions || 0}</span>
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
                {archivedSessions.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowArchivedSessions(true)}
                    className={styles.archiveButton}
                  >
                    View Archived ({archivedSessions.length})
                  </button>
                )}
              </div>
            ) : (
              <div className={styles.sessionsCard}>
                <h2 className={styles.infoTitle}>Trainer Sessions</h2>
                <p className={styles.noSessions}>No trainer sessions assigned yet</p>
              </div>
            )}
          </div>

          <div className={styles.calendarColumn}>
            <StudentSessionManagement />
            <SessionHistory userId={currentUser?.id} />
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

        {showArchivedSessions && (
          <div className={styles.modalOverlay}>
            <div className={styles.modalCard}>
              <div className={styles.modalHeader}>
                <h3 className={styles.modalTitle}>Archived Sessions (Last 3 Months)</h3>
                <button type="button" onClick={() => setShowArchivedSessions(false)} className={styles.modalClose}>✕</button>
              </div>
              <div className={styles.modalBody}>
                {archivedSessions.length === 0 ? (
                  <p className={styles.emptyText}>No archived sessions</p>
                ) : (
                  <div className={styles.sessionsList}>
                    {archivedSessions.map((session) => (
                      <div key={session.id} className={`${styles.sessionItem} ${styles.sessionExpired}`}>
                        <div className={styles.sessionRow}>
                          <span>Purchased:</span>
                          <span className={styles.sessionValue}>{session.purchased_sessions || session.total_sessions}</span>
                        </div>
                        <div className={styles.sessionRow}>
                          <span>Used:</span>
                          <span className={styles.sessionValue}>{session.used_sessions || 0}</span>
                        </div>
                        <div className={styles.sessionRow}>
                          <span>Scheduled:</span>
                          <span className={styles.sessionValue}>{session.scheduled_sessions || 0}</span>
                        </div>
                        <div className={styles.sessionRow}>
                          <span>Remaining:</span>
                          <span className={`${styles.sessionValue} ${styles.sessionValueZero}`}>{session.remaining_sessions || 0}</span>
                        </div>
                        <div className={`${styles.sessionRow} ${styles.expiresRowContainer}`}>
                          <span>Expires:</span>
                          <span className={`${styles.expiryDate} ${styles.expiryDatePassed}`}>
                            {new Date(session.expiration_date).toLocaleDateString()}
                          </span>
                          <div className={styles.expiredBadge}>EXPIRED</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <CreditCardModal
        userId={currentUser?.id}
        isOpen={showCardModal}
        onClose={() => setShowCardModal(false)}
        onCardSaved={() => window.location.reload()}
      />

      <ChangePasswordModal
        isOpen={showChangePasswordModal}
        onClose={() => setShowChangePasswordModal(false)}
        userId={currentUser?.id}
      />

      <SiteFooter isSuperuser={currentUser?.roleId === 1} />
    </div>
  );
}

