import { useEffect, useState } from "react";
import styles from "../styles/LegalContentModal.module.css";

/**
 * LegalContentModal
 * Shared implementation for Terms and Conditions / Privacy Policy modals.
 * Superuser-only Edit mode with Save/Cancel and an unsaved-changes guard.
 */
export default function LegalContentModal({ title, pageKey, open, onClose, isSuperuser = false }) {
  const [content, setContent] = useState("");
  const [draft, setDraft] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "/api";

  useEffect(() => {
    if (!open) return;
    const loadContent = async () => {
      try {
        const res = await fetch(`${apiBaseUrl}/legal/${pageKey}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Unable to load legal content.");
        const text = data?.content?.body || "";
        setContent(text);
        setDraft(text);
      } catch (error) {
        setStatusMessage(error.message);
      }
    };
    loadContent();
  }, [open, pageKey, apiBaseUrl]);

  if (!open) return null;

  const saveChanges = async () => {
    const token = localStorage.getItem("cas_jwt");
    try {
      const res = await fetch(`${apiBaseUrl}/legal/${pageKey}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ content: { body: draft } }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save content.");
      setContent(draft);
      setIsDirty(false);
      setIsEditing(false);
      setStatusMessage(
        pageKey === "terms-and-conditions"
          ? "Terms and conditions updated successfully."
          : "Content saved successfully.",
      );
      // 3-second auto-fading success banner
      setTimeout(() => setStatusMessage(""), 3000);
    } catch (error) {
      setStatusMessage(error.message);
    }
  };

  const handleClose = () => {
    if (isDirty && !window.confirm("Changes haven’t been saved, still want to exit?")) return;
    onClose();
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2 className={styles.title}>{title}</h2>
          <button type="button" onClick={handleClose} className={styles.closeButton}>
            ×
          </button>
        </div>

        {statusMessage && <div className={styles.successBanner}>{statusMessage}</div>}

        {isEditing ? (
          <textarea
            rows={16}
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value);
              setIsDirty(true);
            }}
            className={styles.textarea}
          />
        ) : (
          <div className={styles.bodyText}>{content || "No content available yet."}</div>
        )}

        <div className={styles.actions}>
          {isSuperuser && !isEditing && (
            <button type="button" onClick={() => setIsEditing(true)} className={styles.editButton}>
              Edit
            </button>
          )}
          {isSuperuser && isEditing && (
            <>
              <button
                type="button"
                onClick={() => {
                  setDraft(content);
                  setIsEditing(false);
                  setIsDirty(false);
                }}
                className={styles.cancelButton}
              >
                Cancel
              </button>
              <button type="button" onClick={saveChanges} className={styles.saveButton}>
                Save
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
