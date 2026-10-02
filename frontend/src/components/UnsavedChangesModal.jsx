import styles from "../styles/UnsavedChangesModal.module.css";

/**
 * UnsavedChangesModal
 * Generic confirmation modal for Superuser CMS flows: blocks navigation,
 * logout, or (via a native beforeunload prompt handled by the caller) tab
 * close while there are unsaved edits.
 */
export default function UnsavedChangesModal({ open, onSave, onDiscard }) {
  if (!open) return null;

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <p className={styles.message}>There are unsaved changes, do you want to save them?</p>
        <div className={styles.actions}>
          <button type="button" onClick={onDiscard} className={styles.discardButton}>
            No
          </button>
          <button type="button" onClick={onSave} className={styles.saveButton}>
            Yes
          </button>
        </div>
      </div>
    </div>
  );
}
