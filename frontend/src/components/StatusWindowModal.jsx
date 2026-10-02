import { useState } from "react";
import styles from "../styles/StatusWindowModal.module.css";

/**
 * StatusWindowModal
 * Shared date/time window picker used when an admin changes a user's status
 * to one that supports a scheduled window (e.g. Suspended for Employees, or
 * any of the time-delimited overrides for Members). Supports either an
 * explicit start/end date-time or a "Permanent" flag (no end date).
 */
export default function StatusWindowModal({ status, onConfirm, onCancel }) {
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [permanent, setPermanent] = useState(false);

  const handleConfirm = () => {
    onConfirm({
      startsAt: startsAt ? new Date(startsAt).toISOString() : null,
      endsAt: permanent || !endsAt ? null : new Date(endsAt).toISOString(),
      permanent,
    });
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <h3 className={styles.title}>Set {status} Window</h3>

        <label className={styles.fieldLabel}>
          Start Date &amp; Time
          <input
            type="datetime-local"
            value={startsAt}
            onChange={(event) => setStartsAt(event.target.value)}
            className={styles.input}
          />
        </label>

        <label className={styles.fieldLabel}>
          End Date &amp; Time
          <input
            type="datetime-local"
            value={endsAt}
            disabled={permanent}
            onChange={(event) => setEndsAt(event.target.value)}
            className={styles.input}
          />
        </label>

        <label className={styles.permanentLabel}>
          <input
            type="checkbox"
            checked={permanent}
            onChange={(event) => setPermanent(event.target.checked)}
            className={styles.checkbox}
          />
          Permanent (no end date)
        </label>

        <div className={styles.actions}>
          <button type="button" onClick={onCancel} className={styles.cancelButton}>
            Cancel
          </button>
          <button type="button" onClick={handleConfirm} className={styles.confirmButton}>
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}
