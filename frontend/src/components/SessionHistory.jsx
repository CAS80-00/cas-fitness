import { useEffect, useState } from 'react';
import styles from '../styles/SessionHistory.module.css';

export default function SessionHistory({ userId }) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '/api';

  useEffect(() => {
    const loadHistory = async () => {
      if (!userId) return;
      try {
        setLoading(true);
        const token = localStorage.getItem('cas_jwt');
        const res = await fetch(`${apiBaseUrl}/trainer-sessions/history/student/${userId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to load session history');
        setSessions(data.sessions || []);
        setError('');
      } catch (err) {
        setError(err.message);
        setSessions([]);
      } finally {
        setLoading(false);
      }
    };
    loadHistory();
  }, [userId, apiBaseUrl]);

  const getStatusBadge = (status) => {
    switch (status) {
      case 'COMPLETED':
        return <span className={`${styles.badge} ${styles.completed}`}>✓ Completed</span>;
      case 'ABSENT':
        return <span className={`${styles.badge} ${styles.absent}`}>Absent</span>;
      case 'CANCELLED':
        return <span className={`${styles.badge} ${styles.cancelled}`}>Cancelled</span>;
      default:
        return <span className={`${styles.badge}`}>{status}</span>;
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className={styles.card}>
        <div className={styles.titleRow}>
          <h2 className={styles.title}>Session History (Last 3 Months)</h2>
        </div>
        <div className={styles.loading}>Loading session history...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.card}>
        <div className={styles.titleRow}>
          <h2 className={styles.title}>Session History (Last 3 Months)</h2>
        </div>
        <div className={styles.error}>Error: {error}</div>
      </div>
    );
  }

  return (
    <div className={styles.card}>
      <div className={styles.titleRow}>
        <h2 className={styles.title}>Session History (Last 3 Months)</h2>
        <button
          className={styles.toggleBtn}
          onClick={() => setIsExpanded(!isExpanded)}
          aria-expanded={isExpanded}
        >
          {isExpanded ? '−' : '+'}
        </button>
      </div>
      
      {isExpanded && (
        <>
          {sessions.length === 0 ? (
            <p className={styles.empty}>No session history available</p>
          ) : (
            <div className={styles.historyList}>
              {sessions.map((session) => (
                <div key={session.id} className={styles.historyItem}>
                  <div className={styles.itemHeader}>
                    <div className={styles.dateAndTrainer}>
                      <span className={styles.date}>{formatDate(session.scheduledDate)}</span>
                      <span className={styles.trainer}>with {session.trainerName}</span>
                    </div>
                    {getStatusBadge(session.status)}
                  </div>
                  <div className={styles.itemDetails}>
                    <span className={styles.detail}>
                      <strong>Package:</strong> {session.packageName || 'N/A'}
                    </span>
                    {session.notes && (
                      <span className={styles.detail}>
                        <strong>Notes:</strong> {session.notes}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
