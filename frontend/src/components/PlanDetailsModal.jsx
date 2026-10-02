import { useState, useEffect } from "react";
import styles from "../styles/PlanDetailsModal.module.css";

/**
 * PlanDetailsModal
 * Simple card container with plan details text area.
 * Regular users: read-only text
 * Superusers: can edit the text
 */
export default function PlanDetailsModal({ plan, currentUser, onClose, onSave }) {
  const [isEditing, setIsEditing] = useState(false);
  const [detailsText, setDetailsText] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);

  const isSuperuser = currentUser?.roleId === 1;

  // Initialize details text when modal opens or plan changes
  useEffect(() => {
    if (plan) {
      setDetailsText(plan.details || "");
      setIsEditing(false);
      setError(null);
    }
  }, [plan]);

  const handleSave = async () => {
    try {
      setIsSaving(true);
      setError(null);

      const token = localStorage.getItem("cas_jwt");
      const response = await fetch(`/api/plans/${plan.id}/details`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          details: detailsText,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to save details");
      }

      setIsEditing(false);
      if (onSave) onSave();
    } catch (err) {
      setError(err.message || "Failed to save details");
      console.error("Error saving details:", err);
    } finally {
      setIsSaving(false);
    }
  };

  if (!plan) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.header}>
          <h2 className={styles.title}>{plan.title}</h2>
          <button
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        {/* Content - Details Text Area */}
        <div className={styles.content}>
          {!isEditing ? (
            <div className={styles.viewMode}>
              <p className={styles.detailsText}>
                {detailsText || "(No details added yet)"}
              </p>
            </div>
          ) : (
            <div className={styles.editMode}>
              <textarea
                value={detailsText}
                onChange={(e) => setDetailsText(e.target.value)}
                className={styles.textarea}
                placeholder="Enter plan details here..."
                rows={8}
              />
              {error && <div className={styles.error}>{error}</div>}
            </div>
          )}
        </div>

        {/* Footer with Actions */}
        <div className={styles.footer}>
          {!isEditing ? (
            <>
              {isSuperuser && (
                <button
                  type="button"
                  className={styles.editButton}
                  onClick={() => setIsEditing(true)}
                >
                  ✏️ Edit
                </button>
              )}
              <button type="button" className={styles.closeModalButton} onClick={onClose}>
                Close
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className={styles.saveButton}
                onClick={handleSave}
                disabled={isSaving}
              >
                {isSaving ? "Saving..." : "💾 Save"}
              </button>
              <button
                type="button"
                className={styles.cancelButton}
                onClick={() => setIsEditing(false)}
                disabled={isSaving}
              >
                Cancel
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
