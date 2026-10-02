import { useState, useEffect } from "react";
import { QRCodeSVG } from "qrcode.react";
import PhoneInputWithCountryCode from "./PhoneInputWithCountryCode";
import styles from "../styles/SuperuserMemberView.module.css";

/**
 * SuperuserMemberView
 * Comprehensive member management view for superusers.
 * Shows: Member ID, Name, Last Name, Email, Phone (with country code), and Status.
 * Allows: Editing all fields and changing the member's status.
 * Note: Members do not have role management (all are STUDENT).
 */
export default function SuperuserMemberView({
  memberId,
  onBack,
}) {
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "/api";
  const [member, setMember] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [subscription, setSubscription] = useState({ status: "ACTIVE" });

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    countryCode: "+1",
    status: "",
  });

  const authHeaders = () => {
    const token = localStorage.getItem("cas_jwt");
    return { Authorization: "Bearer " + token };
  };

  const MEMBER_STATUS_OPTIONS = ["ACTIVE", "PENDING", "SUSPENDED", "INACTIVE", "CANCELLED"];

  useEffect(() => {
    const loadMember = async () => {
      try {
        setIsLoading(true);
        setError("");

        const res = await fetch(`${apiBaseUrl}/admin/users/${memberId}`, {
          headers: authHeaders(),
        });

        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.error || `Failed to load member (${res.status})`);
        }

        const data = await res.json();
        const m = data.user;

        if (!m) {
          throw new Error("Member not found");
        }

        setMember(m);

        // Parse phone to extract country code if present
        let parsedPhone = m.phone || "";
        let parsedCountryCode = "+1";

        if (parsedPhone && parsedPhone.startsWith("+")) {
          // Extract country code (digits after +)
          const match = parsedPhone.match(/^\+(\d{1,3})/);
          if (match) {
            parsedCountryCode = "+" + match[1];
            parsedPhone = parsedPhone.substring(parsedCountryCode.length);
          }
        }

        setFormData({
          firstName: m.first_name || "",
          lastName: m.last_name || "",
          email: m.email || "",
          phone: parsedPhone,
          countryCode: parsedCountryCode,
          status: m.status || "ACTIVE",
        });

        // Set subscription based on member status
        setSubscription({ 
          status: m.status === "ACTIVE" ? "ACTIVE" : "INACTIVE"
        });
      } catch (err) {
        setError(err.message || "Failed to load member");
      } finally {
        setIsLoading(false);
      }
    };

    loadMember();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memberId]);

  const handleSave = async () => {
    try {
      setError("");
      setSuccess("");

      // Combine phone with country code
      const fullPhone = formData.phone ? formData.countryCode + formData.phone : "";

      const res = await fetch(`${apiBaseUrl}/admin/users/${memberId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(),
        },
        body: JSON.stringify({
          first_name: formData.firstName,
          last_name: formData.lastName,
          email: formData.email,
          phone: fullPhone,
          status: formData.status,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || `Update failed (${res.status})`);
      }

      const updatedData = await res.json();
      setMember(updatedData.user);
      setSuccess("Member updated successfully");
      setIsEditing(false);

      setTimeout(() => setSuccess(""), 1500);
    } catch (err) {
      setError(err.message || "Failed to update member");
    }
  };

  const handleCancel = () => {
    if (!member) return;

    // Reset form to original data
    let parsedPhone = member.phone || "";
    let parsedCountryCode = "+1";

    if (parsedPhone && parsedPhone.startsWith("+")) {
      const match = parsedPhone.match(/^\+(\d{1,3})/);
      if (match) {
        parsedCountryCode = "+" + match[1];
        parsedPhone = parsedPhone.substring(parsedCountryCode.length);
      }
    }

    setFormData({
      firstName: member.first_name || "",
      lastName: member.last_name || "",
      email: member.email || "",
      phone: parsedPhone,
      countryCode: parsedCountryCode,
      status: member.status || "ACTIVE",
    });

    setIsEditing(false);
    setError("");
    setSuccess("");
  };

  if (isLoading) {
    return (
      <div className={styles.container}>
        <button onClick={onBack} className={styles.backButton}>
          ← Back to Members
        </button>
        <div className={styles.loadingText}>Loading member...</div>
      </div>
    );
  }

  if (!member) {
    return (
      <div className={styles.container}>
        <button onClick={onBack} className={styles.backButton}>
          ← Back to Members
        </button>
        <div className={styles.errorText}>Member not found</div>
      </div>
    );
  }

  const statusBadgeClass = member.status ? member.status.toLowerCase().replace(/_/g, "-") : "pending";

  return (
    <div className={styles.container}>
      <button onClick={onBack} className={styles.backButton}>
        ← Back to Members
      </button>

      <div className={styles.card}>
        <div className={styles.header}>
          <div>
            <h2 className={styles.title}>{member.first_name} {member.last_name}</h2>
            <p className={styles.subtitle}>
              ID: <span className={styles.idValue}>{member.id}</span>
            </p>
          </div>
          {!isEditing && (
            <button onClick={() => setIsEditing(true)} className={styles.editButton}>
              Edit Profile
            </button>
          )}
        </div>

        {error && <div className={styles.errorText}>{error}</div>}
        {success && <div className={styles.successText}>{success}</div>}

        {!isEditing ? (
          <div className={styles.viewMode}>
            <div className={styles.qrSection}>
              <h3 className={styles.qrTitle}>Gym Entry Pass</h3>
              <div className={styles.qrFrame}>
                {member && member.id ? (
                  <QRCodeSVG 
                    value={member.id} 
                    size={220} 
                    level="H" 
                    includeMargin
                    fgColor="#000000"
                    bgColor="#ffffff"
                  />
                ) : (
                  <div className={styles.qrPlaceholder}>Loading...</div>
                )}
              </div>
              <div className={styles.qrMemberId}>
                <small>ID: {member?.id || "—"}</small>
              </div>
              <p className={styles.qrHint}>
                {subscription?.status === "ACTIVE" 
                  ? "Member can scan this at gym entry" 
                  : "Access disabled - subscription not active"}
              </p>
            </div>

            <div className={styles.infoGrid}>
              <div className={styles.infoField}>
                <label className={styles.fieldLabel}>First Name</label>
                <p className={styles.fieldValue}>{member.first_name || "—"}</p>
              </div>

              <div className={styles.infoField}>
                <label className={styles.fieldLabel}>Last Name</label>
                <p className={styles.fieldValue}>{member.last_name || "—"}</p>
              </div>

              <div className={styles.infoField}>
                <label className={styles.fieldLabel}>Email</label>
                <p className={styles.fieldValue}>{member.email || "—"}</p>
              </div>

              <div className={styles.infoField}>
                <label className={styles.fieldLabel}>Phone</label>
                <p className={styles.fieldValue}>{member.phone || "—"}</p>
              </div>

              <div className={styles.infoField}>
                <label className={styles.fieldLabel}>Status</label>
                <span className={`${styles.statusBadge} ${styles[`status-${statusBadgeClass}`]}`}>
                  {member.status ? member.status.charAt(0) + member.status.slice(1).toLowerCase() : "—"}
                </span>
              </div>

              <div className={styles.infoField}>
                <label className={styles.fieldLabel}>Created</label>
                <p className={styles.fieldValue}>
                  {member.created_at ? new Date(member.created_at).toLocaleDateString() : "—"}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className={styles.editMode}>
            <div className={styles.formGrid}>
              <div className={styles.formField}>
                <label className={styles.formLabel}>First Name</label>
                <input
                  type="text"
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  className={styles.input}
                />
              </div>

              <div className={styles.formField}>
                <label className={styles.formLabel}>Last Name</label>
                <input
                  type="text"
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  className={styles.input}
                />
              </div>

              <div className={styles.formField}>
                <label className={styles.formLabel}>Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className={styles.input}
                />
              </div>

              <div className={styles.formField} style={{ gridColumn: "1 / -1" }}>
                <label className={styles.formLabel}>Phone</label>
                <PhoneInputWithCountryCode
                  countryCode={formData.countryCode}
                  phone={formData.phone}
                  onCountryCodeChange={(code) => setFormData({ ...formData, countryCode: code })}
                  onPhoneChange={(phone) => setFormData({ ...formData, phone })}
                />
              </div>

              <div className={styles.formField}>
                <label className={styles.formLabel}>Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className={styles.select}
                >
                  {MEMBER_STATUS_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option.charAt(0) + option.slice(1).toLowerCase()}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className={styles.formActions}>
              <button onClick={handleCancel} className={styles.cancelButton}>
                Cancel
              </button>
              <button onClick={handleSave} className={styles.saveButton}>
                Save Changes
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
