import { useState, useEffect } from "react";
import styles from "../styles/AuthCard.module.css";
import PhoneInputWithCountryCode from "./PhoneInputWithCountryCode";

const PASSWORD_RULES = [
  "At least 8 characters",
  "1 uppercase letter",
  "1 number",
  "1 symbol (@, #, %)",
];

/**
 * AuthCard
 * Standalone login/register component. Login is the default view.
 * Handles the authorized-email check, live password validation, the
 * post-submit 2FA OTP step (60s resend countdown), and the Forgot Password
 * modal trigger.
 */
export default function AuthCard({ onAuthenticated }) {
  const [isLogin, setIsLogin] = useState(true);
  const [authStep, setAuthStep] = useState("credentials");
  const [userId, setUserId] = useState(null);
  const [otpCode, setOtpCode] = useState("");
  const [deliveryMethod, setDeliveryMethod] = useState("email");
  const [resendSeconds, setResendSeconds] = useState(0);
  const [forgotEmail, setForgotEmail] = useState("");
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [countryCode, setCountryCode] = useState("+1");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [devCode, setDevCode] = useState("");
  const [devNote, setDevNote] = useState("");

  // Validation States
  const [emailAuthorized, setEmailAuthorized] = useState(null);
  const [emailError, setEmailError] = useState("");
  const [passwordErrors, setPasswordErrors] = useState([]);
  const [serverError, setServerError] = useState("");

  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "/api";

  // Live Password Criteria Check
  useEffect(() => {
    if (isLogin) return;
    const errors = [];
    if (password.length < 8) errors.push("At least 8 characters");
    if (!/[A-Z]/.test(password)) errors.push("1 uppercase letter");
    if (!/[0-9]/.test(password)) errors.push("1 number");
    if (!/[@#%]/.test(password)) errors.push("1 symbol (@, #, %)");
    setPasswordErrors(errors);
  }, [password, isLogin]);

  // Pre-Authorized Email Lookup
  const handleEmailBlur = async () => {
    if (!email || isLogin) return;
    try {
      const res = await fetch(`${apiBaseUrl}/auth/verify-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setEmailAuthorized(false);
        setEmailError(data.error || "Email authorization check failed");
      } else {
        setEmailAuthorized(true);
        setEmailError("");
      }
    } catch {
      setEmailError("Network error checking authorization status.");
    }
  };

  // 60-second disabled countdown on the "Resend Code" button
  useEffect(() => {
    if (resendSeconds <= 0) return undefined;
    const timer = setInterval(() => {
      setResendSeconds((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [resendSeconds]);

  const performOtpLogin = async () => {
    console.log("🔍 performOtpLogin called with userId:", userId, "otpCode:", otpCode);
    
    if (!userId) {
      console.log("❌ No userId");
      setServerError("Session lost. Please log in again.");
      return;
    }
    if (otpCode.length !== 6) {
      console.log("❌ OTP code length invalid:", otpCode.length);
      setServerError("Please enter a 6-digit code.");
      return;
    }

    console.log("✅ Validation passed, sending OTP verification request...");
    try {
      const payload = { userId, code: otpCode, purpose: "2FA" };
      console.log("📤 Request payload:", payload);
      
      const res = await fetch(`${apiBaseUrl}/auth/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      
      console.log("📥 Response status:", res.status);
      const data = await res.json();
      console.log("📥 Response data:", data);
      
      if (!res.ok) throw new Error(data.error || "OTP verification failed.");

      localStorage.setItem("cas_jwt", data.token);
      localStorage.setItem("cas_user", JSON.stringify(data.user));
      console.log("✅ OTP verified successfully");
      if (onAuthenticated) onAuthenticated(data.user);
    } catch (err) {
      console.log("❌ Error:", err.message);
      setServerError(err.message);
    }
  };

  const requestPasswordReset = async () => {
    try {
      const res = await fetch(`${apiBaseUrl}/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: forgotEmail }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Unable to send reset instructions.");
      // Generic response regardless of whether the account exists, per spec.
      setServerError(data.message);
      setShowForgotModal(false);
      setForgotEmail("");
    } catch (err) {
      setServerError(err.message);
    }
  };

  const resendOtp = async () => {
    try {
      const res = await fetch(`${apiBaseUrl}/auth/resend-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, deliveryMethod }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Unable to resend OTP.");
      setResendSeconds(60);
      setDevCode(data.delivery?.devCode || "");
      setDevNote(data.delivery?.devNote || "");
    } catch (err) {
      setServerError(err.message);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log("📋 Form submitted, authStep:", authStep);
    setServerError("");

    if (authStep === "otp") {
      console.log("🔐 OTP step detected, calling performOtpLogin");
      await performOtpLogin();
      return;
    }

    if (isLogin) {
      try {
        const res = await fetch(`${apiBaseUrl}/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password, deliveryMethod }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Login failed.");

        if (data.otpRequired) {
          setUserId(data.userId);
          setAuthStep("otp");
          setResendSeconds(60);
          setDevCode(data.delivery?.devCode || "");
          setDevNote(data.delivery?.devNote || "");
          return;
        }
      } catch (err) {
        setServerError(err.message);
      }
      return;
    }

    try {
      const res = await fetch(`${apiBaseUrl}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          phone: `${countryCode}${phone}`,
          firstName,
          lastName,
          deliveryMethod,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Registration failed.");
      setUserId(data.userId);
      setAuthStep("otp");
      setResendSeconds(60);
      setDevCode(data.delivery?.devCode || "");
      setDevNote(data.delivery?.devNote || "");
    } catch (err) {
      setServerError(err.message);
    }
  };

  const switchMode = (loginMode) => {
    setIsLogin(loginMode);
    setAuthStep("credentials");
    setServerError("");
    setDevCode("");
    setDevNote("");
    setCountryCode("+1");
  };

  return (
    <div className={styles.card}>
      <div className={styles.tabs}>
        <button
          type="button"
          onClick={() => switchMode(true)}
          className={isLogin ? styles.tabButtonActive : styles.tabButton}
        >
          Log In
        </button>
        <button
          type="button"
          onClick={() => switchMode(false)}
          className={!isLogin ? styles.tabButtonActive : styles.tabButton}
        >
          Register
        </button>
      </div>

      {serverError && <div className={styles.serverError}>{serverError}</div>}

      <form onSubmit={handleSubmit} className={styles.form}>
        {authStep === "otp" && (
          <div className={styles.fieldGroup}>
            <div>
              <label className={styles.label}>2FA Delivery Method</label>
              <select
                value={deliveryMethod}
                onChange={(e) => setDeliveryMethod(e.target.value)}
                className={styles.input}
              >
                <option value="email">Email</option>
                <option value="sms">SMS</option>
              </select>
            </div>
            <label className={styles.label}>6-Digit Verification Code</label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
              placeholder="000000"
              required
              className={styles.inputOtp}
            />
            {devCode && (
              <div className={styles.devCodeBanner}>
                <p className={styles.devCodeNote}>{devNote}</p>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    setOtpCode(devCode.toString());
                  }}
                  className={styles.devCodeButton}
                >
                  Dev mode — use code {devCode}
                </button>
              </div>
            )}
            <button
              type="button"
              disabled={resendSeconds > 0}
              onClick={resendOtp}
              className={styles.resendButton}
            >
              {resendSeconds > 0 ? `Resend code in ${resendSeconds}s` : "Resend Code"}
            </button>
          </div>
        )}

        {authStep === "credentials" && (
          <>
            <div className={isLogin ? styles.credentialsRowLogin : styles.credentialsRow}>
              <div>
                <input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onBlur={handleEmailBlur}
                  required
                  className={styles.input}
                />
                {!isLogin && emailError && <p className={styles.errorText}>{emailError}</p>}
              </div>

              <div>
                <input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className={styles.input}
                  title="At least 8 characters, 1 uppercase letter, 1 number, and 1 symbol (@, #, or %)"
                />
              </div>

              {isLogin && (
                <button type="submit" className={styles.inlineSubmitButton}>
                  Log In
                </button>
              )}
            </div>

            {!isLogin && password.length > 0 && (
              <div className={styles.passwordChecklist}>
                {PASSWORD_RULES.map((rule) => {
                  const passed = !passwordErrors.includes(rule);
                  return (
                    <div key={rule} className={styles.checklistRow}>
                      <span className={passed ? styles.checklistIconPass : styles.checklistIconFail}>
                        {passed ? "✓" : "✗"}
                      </span>
                      <span className={passed ? styles.checklistLabelPass : styles.checklistLabelFail}>
                        {rule}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {!isLogin && (
              <>
                <div className={styles.nameRow}>
                  <input
                    type="text"
                    placeholder="First Name"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                    className={styles.input}
                  />
                  <input
                    type="text"
                    placeholder="Last Name"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    required
                    className={styles.input}
                  />
                </div>
                <div>
                  <label className={styles.label}>Confirm Password</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    className={styles.input}
                  />
                  {confirmPassword && password !== confirmPassword && (
                    <p className={styles.errorText}>Passwords must match</p>
                  )}
                </div>

                <div>
                  <label className={styles.label}>Phone Number</label>
                  <PhoneInputWithCountryCode
                    value={phone}
                    onChange={(code, phoneNum) => {
                      setPhone(phoneNum);
                      setCountryCode(code);
                    }}
                    placeholder="Enter phone number"
                    required
                    showLabel={false}
                  />
                </div>
              </>
            )}
          </>
        )}

        {isLogin && authStep === "credentials" && (
          <button
            type="button"
            onClick={() => setShowForgotModal(true)}
            className={styles.forgotLink}
          >
            Forgot Password?
          </button>
        )}

        {!(isLogin && authStep === "credentials") && (
          <button
            type="submit"
            disabled={
              (authStep === "credentials" &&
                !isLogin &&
                (emailAuthorized === false ||
                  passwordErrors.length > 0 ||
                  password !== confirmPassword)) ||
              (authStep === "otp" && otpCode.length !== 6)
            }
            className={styles.submitButton}
          >
            {authStep === "otp" ? "Verify Code" : "Proceed to 2FA Verification"}
          </button>
        )}
      </form>

      {showForgotModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalCard}>
            <h3 className={styles.modalTitle}>Forgot Password</h3>
            <p className={styles.modalMessage}>
              Enter your email and we will send reset instructions if your account is active.
            </p>
            <input
              type="email"
              value={forgotEmail}
              onChange={(e) => setForgotEmail(e.target.value)}
              className={styles.input}
              placeholder="name@example.com"
            />
            <div className={styles.modalActions}>
              <button
                type="button"
                onClick={() => setShowForgotModal(false)}
                className={styles.modalCancelButton}
              >
                Cancel
              </button>
              <button type="button" onClick={requestPasswordReset} className={styles.modalSendButton}>
                Send
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
