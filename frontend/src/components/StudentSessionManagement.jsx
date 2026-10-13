import { useState, useEffect } from 'react';
import styles from '../styles/StudentSessionManagement.module.css';
import { broadcastSessionCancelled } from '../utils/calendarEvents';

const StudentSessionManagement = () => {
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '/api';
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [cancellingId, setCancellingId] = useState(null);

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    try {
      const token = localStorage.getItem('cas_jwt');
      const res = await fetch(`${apiBaseUrl}/calendars/workouts`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load sessions');

      // Filter for current user's sessions that are SCHEDULED
      const userSessions = data.sessions
        .filter((s) => s.status === 'SCHEDULED')
        .map((s) => ({
          ...s,
          sessionStart: new Date(s.start_time),
          hoursUntilSession: (new Date(s.start_time).getTime() - Date.now()) / (1000 * 60 * 60),
          canCancel: (new Date(s.start_time).getTime() - Date.now()) / (1000 * 60 * 60) >= 24,
        }))
        .sort((a, b) => a.sessionStart - b.sessionStart);

      setSessions(userSessions);
      setError('');
    } catch (err) {
      setError(err.message);
      setSessions([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelSession = async (logId) => {
    if (!window.confirm('Are you sure you want to cancel this session? Your session credit will be restored.')) {
      return;
    }

    setCancellingId(logId);
    try {
      const token = localStorage.getItem('cas_jwt');
      const res = await fetch(`${apiBaseUrl}/trainer-sessions/session-log/${logId}/cancel`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to cancel session');
        return;
      }

      setSuccessMessage('Session cancelled successfully!');
      setTimeout(() => setSuccessMessage(''), 3000);
      
      // Broadcast cancellation event to all calendars
      const cancelledSession = sessions.find(s => s.id === logId);
      if (cancelledSession) {
        broadcastSessionCancelled({
          id: logId,
          trainer_id: cancelledSession.trainer_id,
          student_id: cancelledSession.student_id,
          scheduled_date: cancelledSession.start_time,
        });
      }
      
      loadSessions();
    } catch (err) {
      setError(err.message);
    } finally {
      setCancellingId(null);
    }
  };

  if (loading) {
    return <div className={styles.container}>Loading your sessions...</div>;
  }

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>My Booked Trainer Sessions</h2>

      {error && <div className={styles.errorMessage}>{error}</div>}
      {successMessage && <div className={styles.successMessage}>{successMessage}</div>}

      {sessions.length === 0 ? (
        <p className={styles.emptyMessage}>No scheduled sessions yet. Book one with a trainer!</p>
      ) : (
        <div className={styles.sessionsList}>
          {sessions.map((session) => (
            <div key={session.id} className={styles.sessionCard}>
              <div className={styles.sessionHeader}>
                <div className={styles.sessionTime}>
                  <div className={styles.timeLabel}>
                    {session.sessionStart.toLocaleDateString('en-US', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </div>
                  <div className={styles.timeValue}>
                    {session.sessionStart.toLocaleTimeString('en-US', {
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: true,
                    })}
                  </div>
                </div>

                <div className={styles.sessionInfo}>
                  <div className={styles.sessionRow}>
                    <span className={styles.label}>Trainer:</span>
                    <span className={styles.value}>
                      {session.trainer_id ? 'Assigned Trainer' : 'TBD'}
                    </span>
                  </div>
                  <div className={styles.sessionRow}>
                    <span className={styles.label}>Duration:</span>
                    <span className={styles.value}>50 minutes</span>
                  </div>
                  <div className={styles.sessionRow}>
                    <span className={styles.label}>Status:</span>
                    <span className={`${styles.value} ${styles.statusScheduled}`}>SCHEDULED</span>
                  </div>
                </div>

                <div className={styles.timeRemaining}>
                  {session.hoursUntilSession > 24 ? (
                    <div className={styles.hoursDisplay}>
                      {Math.floor(session.hoursUntilSession)} hours away
                    </div>
                  ) : (
                    <div className={styles.hoursDisplayClose}>
                      {session.hoursUntilSession > 0
                        ? `${session.hoursUntilSession.toFixed(1)} hours away`
                        : 'Session in progress'}
                    </div>
                  )}
                </div>
              </div>

              <div className={styles.sessionFooter}>
                <button
                  className={`${styles.cancelBtn} ${
                    !session.canCancel || cancellingId === session.id ? styles.disabled : ''
                  }`}
                  onClick={() => handleCancelSession(session.id)}
                  disabled={!session.canCancel || cancellingId === session.id}
                  title={
                    !session.canCancel
                      ? `Cannot cancel within 24 hours. ${(24 - session.hoursUntilSession).toFixed(1)} hours remaining.`
                      : 'Click to cancel this session'
                  }
                >
                  {cancellingId === session.id ? 'Cancelling...' : 'Cancel Session'}
                </button>
                {!session.canCancel && (
                  <div className={styles.cancelInfo}>
                    Cannot cancel within 24 hours of session start
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default StudentSessionManagement;
