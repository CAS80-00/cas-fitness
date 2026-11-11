import { useState, useEffect } from "react";
import styles from "../styles/SuperuserProfilePanel.module.css";
import PhoneInputWithCountryCode from "./PhoneInputWithCountryCode";

/**
 * SuperuserProfilePanel
 * Editable profile section for the Superuser dashboard: Member ID and Role
 * stay locked/read-only, while Name/Last Name/Email/Phone are editable and
 * persisted via PATCH /api/auth/profile. "Change Password" reuses the
 * existing forgot-password OTP flow, emailing a reset challenge to the
 * Superuser's own address.
 */
export default function SuperuserProfilePanel({ currentUser, onProfileUpdated }) {
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "/api";
  const [isEditing, setIsEditing] = useState(false);
  const [firstName, setFirstName] = useState(currentUser?.firstName || "");
  const [lastName, setLastName] = useState(currentUser?.lastName || "");
  const [email, setEmail] = useState(currentUser?.email || "");
  const [phone, setPhone] = useState(currentUser?.phone || "");
  const [countryCode, setCountryCode] = useState("+1");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");

  // Sync internal state when currentUser prop changes (e.g., after profile update)
  useEffect(() => {
    if (!isEditing) {
      setFirstName(currentUser?.firstName || "");
      setLastName(currentUser?.lastName || "");
      setEmail(currentUser?.email || "");
      setPhone(currentUser?.phone || "");
      setCountryCode("+1");
    }
  }, [currentUser, isEditing]);

  const authHeaders = () => {
    const token = localStorage.getItem("cas_jwt");
    return { Authorization: "Bearer " + token };
  };

  const saveProfile = async () => {
    setIsSaving(true);
    setError("");
    try {
      const fullPhone = `${countryCode}${phone}`;
      const res = await fetch(`${apiBaseUrl}/auth/profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ firstName, lastName, email, phone: fullPhone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update profile.");
      onProfileUpdated?.(data.user);
      setIsEditing(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const cancelEdit = () => {
    setFirstName(currentUser?.firstName || "");
    setLastName(currentUser?.lastName || "");
    setEmail(currentUser?.email || "");
    setPhone(currentUser?.phone || "");
    setCountryCode("+1");
    setError("");
    setIsEditing(false);
  };

  const changePassword = async () => {
    setStatusMessage("");
    setError("");
    try {
      const res = await fetch(`${apiBaseUrl}/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: currentUser?.email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to start password reset.");
      setStatusMessage(data.message || "Check your email for password reset instructions.");
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <h2 className={styles.title}>Superuser Profile</h2>
        {!isEditing && (
          <button type="button" onClick={() => setIsEditing(true)} className={styles.editButton}>
            Edit
          </button>
        )}
      </div>

      <div className={styles.lockedGrid}>
        <div className={styles.lockedField}>
          <span className={styles.lockedLabel}>Member ID</span>
          <span className={styles.lockedValue}>Superuser</span>
        </div>
        <div className={styles.lockedField}>
          <span className={styles.lockedLabel}>Role</span>
          <span className={styles.lockedValue}>Superuser</span>
        </div>
      </div>

      {isEditing ? (
        <div className={styles.editGrid}>
          <label className={styles.fieldLabel}>
            Name
            <input value={firstName} onChange={(e) => setFirstName(e.target.value)} className={styles.input} />
          </label>
          <label className={styles.fieldLabel}>
            Last Name
            <input value={lastName} onChange={(e) => setLastName(e.target.value)} className={styles.input} />
          </label>
          <label className={styles.fieldLabel}>
            Email Address
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={styles.input}
            />
          </label>
          <div className={styles.phoneFieldLabel}>
            <label className={styles.fieldLabel}>Phone Number</label>
            <PhoneInputWithCountryCode
              value={phone}
              onChange={(code, phoneNum) => {
                setPhone(phoneNum);
                setCountryCode(code);
              }}
              placeholder="Enter phone number"
              required
            />
          </div>
        </div>
      ) : (
        <div className={styles.viewGrid}>
          <p>
            Name: {currentUser?.firstName} {currentUser?.lastName}
          </p>
          <p>Email: {currentUser?.email}</p>
          <p>Phone: {currentUser?.phone || "—"}</p>
        </div>
      )}

      {error && <p className={styles.errorText}>{error}</p>}
      {statusMessage && <p className={styles.statusText}>{statusMessage}</p>}

      <div className={styles.actions}>
        {isEditing ? (
          <>
            <button type="button" onClick={cancelEdit} className={styles.cancelButton}>
              Cancel
            </button>
            <button type="button" onClick={saveProfile} disabled={isSaving} className={styles.saveButton}>
              {isSaving ? "Saving…" : "Save Changes"}
            </button>
          </>
        ) : (
          <button type="button" onClick={changePassword} className={styles.changePasswordButton}>
            Change Password
          </button>
        )}
      </div>
    </div>
  );
}
