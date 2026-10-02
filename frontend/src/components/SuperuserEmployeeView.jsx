import { useState, useEffect } from "react";
import PhoneInputWithCountryCode from "./PhoneInputWithCountryCode";
import styles from "../styles/SuperuserEmployeeView.module.css";

/**
 * SuperuserEmployeeView
 * Comprehensive employee management view for superusers.
 * Shows: Employee ID, Name, Last Name, Email, Phone (with country code), Status, and Role.
 * Allows: Editing all fields and changing the employee's role.
 */
export default function SuperuserEmployeeView({
  employeeId,
  onBack,
  roleOptions = [],
}) {
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "/api";
  const [employee, setEmployee] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isEditing, setIsEditing] = useState(false);

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    countryCode: "+1",
    roleId: "",
    status: "",
  });

  const authHeaders = () => {
    const token = localStorage.getItem("cas_jwt");
    return { Authorization: "Bearer " + token };
  };

  // Load employee data
  useEffect(() => {
    const loadEmployee = async () => {
      setIsLoading(true);
      setError("");
      try {
        const res = await fetch(`${apiBaseUrl}/admin/users?type=employee&search=${employeeId}`, {
          headers: authHeaders(),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load employee.");

        if (data.users && data.users.length > 0) {
          const emp = data.users[0];
          setEmployee(emp);
          
          // Extract country code from phone
          let countryCode = "+1";
          let phoneNum = emp.phone || "";
          if (emp.phone) {
            // Try to extract country code (assumes format like +1234567890)
            const match = emp.phone.match(/^\+(\d{1,3})/);
            if (match) {
              countryCode = `+${match[1]}`;
              phoneNum = emp.phone.substring(countryCode.length);
            }
          }

          setFormData({
            firstName: emp.firstName || "",
            lastName: emp.lastName || "",
            email: emp.email || "",
            phone: phoneNum,
            countryCode,
            roleId: emp.roleId || "",
            status: emp.status || "",
          });
        } else {
          setError("Employee not found.");
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    if (employeeId) {
      loadEmployee();
    }
  }, [employeeId, apiBaseUrl]);

  const handleSave = async () => {
    setError("");
    setSuccess("");

    if (!formData.firstName || !formData.lastName || !formData.email) {
      setError("First name, last name, and email are required.");
      return;
    }

    try {
      const fullPhone = `${formData.countryCode}${formData.phone}`;
      const body = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        phone: fullPhone,
      };

      if (formData.roleId) {
        body.roleId = formData.roleId;
      }

      const res = await fetch(`${apiBaseUrl}/admin/users/${employee.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save employee.");

      setEmployee(data.user);
      setSuccess("Employee profile saved successfully!");
      setIsEditing(false);

      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError(err.message);
    }
  };

  const getRoleLabel = (roleId) => {
    if (!roleId) return "—";
    const role = roleOptions.find((r) => r.id === roleId);
    return role ? role.role_name : "Unknown Role";
  };

  if (isLoading) {
    return (
      <div className={styles.container}>
        <button onClick={onBack} className={styles.backButton}>
          ← Back
        </button>
        <div className={styles.card}>
          <p className={styles.loadingText}>Loading employee information...</p>
        </div>
      </div>
    );
  }

  if (error && !employee) {
    return (
      <div className={styles.container}>
        <button onClick={onBack} className={styles.backButton}>
          ← Back
        </button>
        <div className={styles.card}>
          <p className={styles.errorText}>{error}</p>
        </div>
      </div>
    );
  }

  if (!employee) {
    return (
      <div className={styles.container}>
        <button onClick={onBack} className={styles.backButton}>
          ← Back
        </button>
        <div className={styles.card}>
          <p className={styles.errorText}>Employee not found.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <button onClick={onBack} className={styles.backButton}>
        ← Back to Employees
      </button>

      <div className={styles.card}>
        <div className={styles.header}>
          <div>
            <h2 className={styles.title}>Employee Profile</h2>
            <p className={styles.subtitle}>
              ID: <span className={styles.idValue}>{employee.id}</span>
            </p>
          </div>
          {!isEditing && (
            <button onClick={() => setIsEditing(true)} className={styles.editButton}>
              Edit Profile
            </button>
          )}
        </div>

        {error && <p className={styles.errorText}>{error}</p>}
        {success && <p className={styles.successText}>{success}</p>}

        {!isEditing ? (
          // View Mode
          <div className={styles.viewMode}>
            <div className={styles.infoGrid}>
              <div className={styles.infoField}>
                <label className={styles.fieldLabel}>First Name</label>
                <p className={styles.fieldValue}>{employee.firstName}</p>
              </div>
              <div className={styles.infoField}>
                <label className={styles.fieldLabel}>Last Name</label>
                <p className={styles.fieldValue}>{employee.lastName}</p>
              </div>
              <div className={styles.infoField}>
                <label className={styles.fieldLabel}>Email</label>
                <p className={styles.fieldValue}>{employee.email}</p>
              </div>
              <div className={styles.infoField}>
                <label className={styles.fieldLabel}>Phone</label>
                <p className={styles.fieldValue}>{employee.phone || "—"}</p>
              </div>
              <div className={styles.infoField}>
                <label className={styles.fieldLabel}>Role</label>
                <p className={styles.fieldValue}>
                  <span className={styles.roleBadge}>{getRoleLabel(employee.roleId)}</span>
                </p>
              </div>
              <div className={styles.infoField}>
                <label className={styles.fieldLabel}>Status</label>
                <p className={styles.fieldValue}>
                  <span className={`${styles.statusBadge} ${styles[`status-${employee.status?.toLowerCase()}`]}`}>
                    {employee.status}
                  </span>
                </p>
              </div>
              <div className={styles.infoField}>
                <label className={styles.fieldLabel}>Created At</label>
                <p className={styles.fieldValue}>
                  {employee.createdAt ? new Date(employee.createdAt).toLocaleDateString() : "—"}
                </p>
              </div>
            </div>
          </div>
        ) : (
          // Edit Mode
          <div className={styles.editMode}>
            <div className={styles.formGrid}>
              <label className={styles.formField}>
                <span className={styles.formLabel}>First Name *</span>
                <input
                  type="text"
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  className={styles.input}
                  placeholder="First name"
                />
              </label>

              <label className={styles.formField}>
                <span className={styles.formLabel}>Last Name *</span>
                <input
                  type="text"
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  className={styles.input}
                  placeholder="Last name"
                />
              </label>

              <label className={styles.formField}>
                <span className={styles.formLabel}>Email *</span>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className={styles.input}
                  placeholder="Email"
                />
              </label>

              <label className={styles.formField}>
                <span className={styles.formLabel}>Phone</span>
                <PhoneInputWithCountryCode
                  value={formData.phone}
                  onChange={(code, phoneNum) => {
                    setFormData({ ...formData, phone: phoneNum, countryCode: code });
                  }}
                  placeholder="Phone number"
                  showLabel={false}
                />
              </label>

              <label className={styles.formField}>
                <span className={styles.formLabel}>Role</span>
                <select
                  value={formData.roleId || ""}
                  onChange={(e) => setFormData({ ...formData, roleId: e.target.value })}
                  className={styles.select}
                >
                  <option value="">Select a role</option>
                  {roleOptions.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.role_name}
                    </option>
                  ))}
                </select>
              </label>

              <label className={styles.formField}>
                <span className={styles.formLabel}>Status</span>
                <p className={styles.fieldValue} style={{ marginTop: "0.5rem" }}>
                  <span className={`${styles.statusBadge} ${styles[`status-${formData.status?.toLowerCase()}`]}`}>
                    {formData.status}
                  </span>
                </p>
                <small style={{ color: "#999", marginTop: "0.25rem", display: "block" }}>
                  Edit status in the employee list
                </small>
              </label>
            </div>

            <div className={styles.formActions}>
              <button
                onClick={() => {
                  setIsEditing(false);
                  setError("");
                  // Reset form to current employee data
                  let countryCode = "+1";
                  let phoneNum = employee.phone || "";
                  if (employee.phone) {
                    const match = employee.phone.match(/^\+(\d{1,3})/);
                    if (match) {
                      countryCode = `+${match[1]}`;
                      phoneNum = employee.phone.substring(countryCode.length);
                    }
                  }
                  setFormData({
                    firstName: employee.firstName || "",
                    lastName: employee.lastName || "",
                    email: employee.email || "",
                    phone: phoneNum,
                    countryCode,
                    roleId: employee.roleId || "",
                    status: employee.status || "",
                  });
                }}
                className={styles.cancelButton}
              >
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
