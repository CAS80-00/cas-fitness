import { useEffect, useMemo, useState } from "react";
import styles from "../styles/SubscriptionForm.module.css";
import PhoneInputWithCountryCode from "./PhoneInputWithCountryCode";

/**
 * SubscriptionForm
 * Props: selectedPlan, currentUser, onNavigateToFOP, onBackToPlans.
 * Authenticated users see a read-only pre-filled form; unauthenticated
 * visitors choose "Yes/No" (already a member?) and get an editable form
 * with async email/phone duplicate checks that gate the submit button.
 */
export default function SubscriptionForm({
  selectedPlan,
  currentUser,
  onNavigateToFOP,
  onBackToPlans,
}) {
  const [isMember, setIsMember] = useState(Boolean(currentUser));
  const [duplicateErrors, setDuplicateErrors] = useState({ email: "", phone: "" });
  const [formData, setFormData] = useState({
    memberId: currentUser?.id || "",
    firstName: currentUser?.firstName || "",
    lastName: currentUser?.lastName || "",
    email: currentUser?.email || "",
    phone: currentUser?.phone || "",
    countryCode: "+1",
  });

  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "/api";
  const isReadOnlyMember = Boolean(currentUser);

  useEffect(() => {
    const controller = new AbortController();
    const checkDuplicates = async () => {
      if (isReadOnlyMember) return;
      if (!formData.email && !formData.phone) return;

      try {
        const res = await fetch(`${apiBaseUrl}/auth/check-duplicate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: formData.email, phone: formData.phone }),
          signal: controller.signal,
        });
        const data = await res.json();
        if (!res.ok) return;
        setDuplicateErrors({
          email: data.emailExists ? "Email already exists in the system" : "",
          phone: data.phoneExists ? "Phone already in the system" : "",
        });
      } catch (error) {
        if (error.name !== "AbortError") {
          console.error("Duplicate check failed:", error);
        }
      }
    };

    checkDuplicates();
    return () => controller.abort();
  }, [formData.email, formData.phone, apiBaseUrl, isReadOnlyMember]);

  const hasDuplicate = useMemo(
    () => Boolean(duplicateErrors.email || duplicateErrors.phone),
    [duplicateErrors],
  );

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <span className={styles.logo}>CAS</span>
        {currentUser ? (
          <span className={styles.headerMeta}>Hello, {currentUser.firstName}</span>
        ) : (
          <span className={styles.headerMeta}>{selectedPlan?.title}</span>
        )}
      </div>

      {!currentUser && (
        <div className={styles.memberPrompt}>
          <p className={styles.promptText}>Are you already a member?</p>
          <div className={styles.choiceRow}>
            <button
              type="button"
              onClick={() => setIsMember(true)}
              className={isMember ? styles.choiceButtonActiveYes : styles.choiceButton}
            >
              Yes
            </button>
            <button
              type="button"
              onClick={() => setIsMember(false)}
              className={!isMember ? styles.choiceButtonActiveNo : styles.choiceButton}
            >
              No
            </button>
          </div>
        </div>
      )}

      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!hasDuplicate) onNavigateToFOP(formData);
        }}
        className={styles.form}
      >
        <input
          type="text"
          placeholder="Membership Number"
          value={formData.memberId}
          readOnly={isReadOnlyMember || isMember}
          onChange={(event) => setFormData({ ...formData, memberId: event.target.value })}
          className={styles.input}
        />
        <input
          type="text"
          placeholder="First Name"
          value={formData.firstName}
          readOnly={isReadOnlyMember}
          required
          onChange={(event) => setFormData({ ...formData, firstName: event.target.value })}
          className={styles.input}
        />
        <input
          type="text"
          placeholder="Last Name"
          value={formData.lastName}
          readOnly={isReadOnlyMember}
          required
          onChange={(event) => setFormData({ ...formData, lastName: event.target.value })}
          className={styles.input}
        />
        <input
          type="email"
          placeholder="Email Address"
          value={formData.email}
          readOnly={isReadOnlyMember}
          required
          onChange={(event) => setFormData({ ...formData, email: event.target.value })}
          className={styles.input}
        />
        {duplicateErrors.email && <p className={styles.errorText}>{duplicateErrors.email}</p>}
        <PhoneInputWithCountryCode
          value={formData.phone}
          onChange={(countryCode, phoneNumber) => {
            setFormData({
              ...formData,
              phone: phoneNumber,
              countryCode: countryCode,
            });
          }}
          placeholder="Enter your phone number"
          readOnly={isReadOnlyMember}
          required
          error={duplicateErrors.phone}
          showLabel={false}
        />
        {duplicateErrors.phone && <p className={styles.errorText}>{duplicateErrors.phone}</p>}
        <div className={styles.actionsGrid}>
          <button type="button" onClick={onBackToPlans} className={styles.backButton}>
            Back to plans
          </button>
          <button type="submit" disabled={hasDuplicate} className={styles.continueButton}>
            Continue to payment
          </button>
        </div>
      </form>
    </div>
  );
}
