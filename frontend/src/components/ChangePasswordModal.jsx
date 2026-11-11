import { useState } from "react";
import styles from "../styles/ChangePasswordModal.module.css";

const PASSWORD_RULES = [
  "At least 8 characters",
  "1 uppercase letter",
  "1 number",
  "1 symbol (@, #, %)",
];

/**
 * ChangePasswordModal
 * Multi-step modal for changing password:
 * 1. Enter current password
 * 2. Enter new password + confirm
 * 3. Verify with 6-digit OTP code
 */
export default function ChangePasswordModal({ isOpen, onClose, userId }) {
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "/api";
  
  // Step state: 1 = current password, 2 = new password, 3 = OTP verification
  const [step, setStep] = useState(1);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [otpCode, setOtpCode] = useState("");
  
  const [passwordErrors, setPasswordErrors] = useState([]);
  const [error, setError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(0);
  const [devCode, setDevCode] = useState("");
  const [devNote, setDevNote] = useState("");

  const authHeaders = () => {
    const token = localStorage.getItem("cas_jwt");
    return { Authorization: "Bearer " + token };
  };

  // Validate new password against policy
  const validatePassword = (pwd) => {
    const errors = [];
    if (pwd.length < 8) errors.push("At least 8 characters");
    if (!/[A-Z]/.test(pwd)) errors.push("1 uppercase letter");
    if (!/[0-9]/.test(pwd)) errors.push("1 number");
    if (!/[@#%]/.test(pwd)) errors.push("1 symbol (@, #, %)");
    return errors;
  };

  // Handle new password input
  const handleNewPasswordChange = (e) => {
    const pwd = e.target.value;
    setNewPassword(pwd);
    setPasswordErrors(validatePassword(pwd));
  };

  // Step 1: Verify current password and request OTP
  const handleRequestOTP = async () => {
    setError("");
    setIsLoading(true);
    setDevCode("");
    setDevNote("");

    if (!currentPassword) {
      setError("Current password is required.");
      setIsLoading(false);
      return;
    }

    try {
      const res = await fetch(`${apiBaseUrl}/auth/request-password-change`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ currentPassword }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to verify password.");
      }

      // Capture devCode if provided (development mode when SMTP not configured)
      if (data.delivery?.devCode) {
        setDevCode(data.delivery.devCode);
        setDevNote(data.delivery.devNote);
      }

      setStatusMessage("Verification code sent to your email.");
      setStep(3); // Skip step 2, go directly to OTP
      setResendSeconds(60);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2: Validate new password before OTP
  const handleProceedToOTP = async () => {
    setError("");

    if (!newPassword) {
      setError("New password is required.");
      return;
    }

    if (passwordErrors.length > 0) {
      setError("Password does not meet requirements.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    // Now request OTP
    handleRequestOTP();
  };

  // Step 3: Verify OTP and change password
  const handleChangePassword = async () => {
    setError("");
    setIsLoading(true);

    if (!otpCode || otpCode.length !== 6) {
      setError("Please enter a valid 6-digit code.");
      setIsLoading(false);
      return;
    }

    try {
      const res = await fetch(`${apiBaseUrl}/auth/complete-password-change`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ newPassword, otpCode }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to change password.");
      }

      setStatusMessage("Password changed successfully!");
      setTimeout(() => {
        handleClose();
      }, 2000);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle resend OTP
  const handleResendOTP = async () => {
    try {
      const res = await fetch(`${apiBaseUrl}/auth/request-password-change`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ currentPassword }),
      });

      const data = await res.json();

      if (!res.ok) throw new Error("Failed to resend code.");

      // Capture devCode if provided
      if (data.delivery?.devCode) {
        setDevCode(data.delivery.devCode);
        setDevNote(data.delivery.devNote);
      }

      setOtpCode("");
      setError("");
      setStatusMessage("New verification code sent.");
      setResendSeconds(60);
    } catch (err) {
      setError("Failed to resend verification code: " + err.message);
    }
  };

  const handleClose = () => {
    // Reset all state
    setStep(1);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setOtpCode("");
    setPasswordErrors([]);
    setError("");
    setStatusMessage("");
    setResendSeconds(0);
    setDevCode("");
    setDevNote("");
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2>Change Password</h2>
          <button
            type="button"
            onClick={handleClose}
            className={styles.closeButton}
            disabled={isLoading}
          >
            ✕
          </button>
        </div>

        <div className={styles.content}>
          {/* Step 1 & 2: Current Password and New Password */}
          {step <= 2 && (
            <>
              {/* Current Password Input */}
              <div className={styles.step}>
                <label className={styles.label}>
                  Current Password
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter your current password"
                    className={styles.input}
                    disabled={isLoading}
                  />
                </label>
              </div>

              {/* New Password Input */}
              <div className={styles.step}>
                <label className={styles.label}>
                  New Password
                  <input
                    type="password"
                    value={newPassword}
                    onChange={handleNewPasswordChange}
                    placeholder="Enter new password"
                    className={styles.input}
                    disabled={isLoading}
                  />
                </label>

                {/* Password Requirements Checklist */}
                <div className={styles.requirements}>
                  {PASSWORD_RULES.map((rule) => {
                    const isMet = !validatePassword(newPassword).includes(rule);
                    return (
                      <div
                        key={rule}
                        className={`${styles.requirementItem} ${
                          isMet ? styles.requirementMet : ""
                        }`}
                      >
                        <span className={styles.requirementCheck}>
                          {isMet ? "✓" : "○"}
                        </span>
                        {rule}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Confirm Password Input */}
              <div className={styles.step}>
                <label className={styles.label}>
                  Confirm New Password
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter new password"
                    className={styles.input}
                    disabled={isLoading}
                  />
                </label>
              </div>
            </>
          )}

          {/* Step 3: OTP Verification */}
          {step === 3 && (
            <div className={styles.step}>
              <p className={styles.instruction}>
                A 6-digit verification code has been sent to your email.
              </p>
              
              {devCode && (
                <div className={styles.devCodeBox}>
                  <p className={styles.devNote}>🔧 Development Mode</p>
                  <p className={styles.devCodeText}>Code: <strong>{devCode}</strong></p>
                  {devNote && <p className={styles.devNoteDetail}>{devNote}</p>}
                </div>
              )}
              
              <label className={styles.label}>
                Verification Code
                <input
                  type="text"
                  maxLength="6"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="000000"
                  className={styles.otpInput}
                  disabled={isLoading}
                />
              </label>
              <button
                type="button"
                onClick={handleResendOTP}
                disabled={resendSeconds > 0 || isLoading}
                className={styles.resendButton}
              >
                {resendSeconds > 0
                  ? `Resend code in ${resendSeconds}s`
                  : "Resend code"}
              </button>
            </div>
          )}

          {/* Error Message */}
          {error && <p className={styles.error}>{error}</p>}

          {/* Status Message */}
          {statusMessage && <p className={styles.status}>{statusMessage}</p>}
        </div>

        <div className={styles.footer}>
          <button
            type="button"
            onClick={handleClose}
            className={styles.cancelButton}
            disabled={isLoading}
          >
            Cancel
          </button>

          {step <= 2 && (
            <button
              type="button"
              onClick={handleProceedToOTP}
              className={styles.submitButton}
              disabled={isLoading}
            >
              {isLoading ? "Sending..." : "Next"}
            </button>
          )}

          {step === 3 && (
            <button
              type="button"
              onClick={handleChangePassword}
              className={styles.submitButton}
              disabled={isLoading || otpCode.length !== 6}
            >
              {isLoading ? "Changing..." : "Change Password"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
