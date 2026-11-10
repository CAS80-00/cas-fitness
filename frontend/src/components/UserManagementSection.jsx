import { useState } from "react";
import StatusWindowModal from "./StatusWindowModal";
import PhoneInputWithCountryCode from "./PhoneInputWithCountryCode";
import styles from "../styles/UserManagementSection.module.css";

const STATUS_STYLE = {
  ACTIVE: "active",
  PENDING: "pending",
  PENDING_VERIFICATION: "pending",
  SUSPENDED: "suspended",
  CANCELLED: "cancelled",
  INACTIVE: "inactive",
};

/**
 * UserManagementSection
 * Shared implementation for "Manage Employees" and "Manage Members": search,
 * results table with an inline status dropdown (+ suspension/override date
 * window modal), a "View Profile Dashboard" edit panel, and an Add workflow
 * whose submit button ("Authorize Log In") creates the account and emails a
 * temporary password (or surfaces it in dev mode when no SMTP is configured).
 *
 * Props:
 *  - type: "employee" | "member"
 *  - title: section heading
 *  - statusOptions: status values selectable for this user type
 *  - roleOptions: [{id, role_name}] selectable for Add (employees only)
 *  - onViewEmployee: optional callback(employeeId) when "View Profile" is clicked (full page view for employees)
 *  - onViewMember: optional callback(memberId) when "View Profile" is clicked (full page view for members)
 */
export default function UserManagementSection({ 
  type, 
  title, 
  statusOptions, 
  roleOptions = [],
  onViewEmployee = null,
  onViewMember = null,
}) {
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "/api";
  const idLabel = type === "employee" ? "Employee ID" : "Member ID";

  const [search, setSearch] = useState({ id: "", lastName: "", email: "", phone: "" });
  const [results, setResults] = useState([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    countryCode: "+1",
    roleId: roleOptions[0]?.id || "",
    sendInstructions: false,
  });
  const [addResult, setAddResult] = useState(null);
  const [addError, setAddError] = useState("");

  const [statusModal, setStatusModal] = useState(null); // { user, status }
  const [detailUser, setDetailUser] = useState(null);
  const [detailForm, setDetailForm] = useState(null);
  const [detailError, setDetailError] = useState("");
  const [detailSuccess, setDetailSuccess] = useState("");

  const authHeaders = () => {
    const token = localStorage.getItem("cas_jwt");
    return { Authorization: "Bearer " + token };
  };

  const runSearch = async () => {
    setIsLoading(true);
    setError("");
    setHasSearched(true);
    try {
      const term = search.id || search.lastName || search.email || search.phone;
      const params = new URLSearchParams({ type });
      if (term) params.set("search", term);
      const res = await fetch(`${apiBaseUrl}/admin/users?${params.toString()}`, {
        headers: authHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Search failed.");
      setResults(data.users || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const submitAdd = async (event) => {
    event.preventDefault();
    setAddError("");
    setAddResult(null);
    try {
      const fullPhone = `${addForm.countryCode}${addForm.phone}`;
      const res = await fetch(`${apiBaseUrl}/admin/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ userType: type, ...addForm, phone: fullPhone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add user.");
      setAddResult(data);
      setAddForm({ firstName: "", lastName: "", email: "", phone: "", roleId: roleOptions[0]?.id || "", sendInstructions: false });
      if (hasSearched) runSearch();
    } catch (err) {
      setAddError(err.message);
    }
  };

  const applyStatus = async (user, status, window = {}) => {
    try {
      const res = await fetch(`${apiBaseUrl}/admin/users/${user.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ status, ...window }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update status.");
      setResults((prev) => prev.map((row) => (row.id === user.id ? data.user : row)));
    } catch (err) {
      setError(err.message);
    }
  };

  const handleStatusSelect = (user, status) => {
    if (status === "SUSPENDED") {
      setStatusModal({ user, status });
      return;
    }
    applyStatus(user, status);
  };

  const openDetail = (user) => {
    setDetailUser(user);
    setDetailForm({
      firstName: user.firstName || "",
      lastName: user.lastName || "",
      email: user.email || "",
      phone: user.phone || "",
      countryCode: "+1",
      roleId: type === "employee" ? user.roleId : null,
    });
    setDetailError("");
    setDetailSuccess("");
  };

  const saveDetail = async () => {
    setDetailError("");
    setDetailSuccess("");
    try {
      const fullPhone = `${detailForm.countryCode}${detailForm.phone}`;
      const body = {
        firstName: detailForm.firstName,
        lastName: detailForm.lastName,
        email: detailForm.email,
        phone: fullPhone,
      };
      
      // Include roleId for employees
      if (type === "employee" && detailForm.roleId) {
        body.roleId = detailForm.roleId;
      }

      const res = await fetch(`${apiBaseUrl}/admin/users/${detailUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save profile.");
      
      setResults((prev) => prev.map((row) => (row.id === detailUser.id ? data.user : row)));
      setDetailSuccess("Profile saved successfully!");
      setTimeout(() => {
        setDetailUser(null);
        setDetailSuccess("");
      }, 1500);
    } catch (err) {
      setDetailError(err.message);
    }
  };

  return (
    <div className={styles.card}>
      <div className={styles.headerRow}>
        <h2 className={styles.title}>{title}</h2>
        <button type="button" onClick={() => setShowAddForm((v) => !v)} className={styles.addButton}>
          {showAddForm ? "Cancel" : `Add ${type === "employee" ? "Employee" : "Member"}`}
        </button>
      </div>

      {showAddForm && (
        <form onSubmit={submitAdd} className={styles.addForm}>
          <input
            required
            placeholder="Name"
            value={addForm.firstName}
            onChange={(e) => setAddForm({ ...addForm, firstName: e.target.value })}
            className={styles.input}
          />
          <input
            required
            placeholder="Last Name"
            value={addForm.lastName}
            onChange={(e) => setAddForm({ ...addForm, lastName: e.target.value })}
            className={styles.input}
          />
          <input
            required
            type="email"
            placeholder="Email"
            value={addForm.email}
            onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
            className={styles.input}
          />
          <div className={styles.phoneInputWrapper}>
            <PhoneInputWithCountryCode
              value={addForm.phone}
              onChange={(code, phoneNum) => {
                setAddForm({ ...addForm, phone: phoneNum, countryCode: code });
              }}
              placeholder="Enter phone number"
              showLabel={false}
            />
          </div>
          {type === "employee" && (
            <select
              value={addForm.roleId}
              onChange={(e) => setAddForm({ ...addForm, roleId: e.target.value })}
              className={styles.input}
            >
              {roleOptions.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.role_name}
                </option>
              ))}
            </select>
          )}
          <div className={styles.checkboxRow}>
            <input
              type="checkbox"
              id="sendInstructions"
              checked={addForm.sendInstructions}
              onChange={(e) => setAddForm({ ...addForm, sendInstructions: e.target.checked })}
              className={styles.checkbox}
            />
            <label htmlFor="sendInstructions" className={styles.checkboxLabel}>
              Send Login Instructions
            </label>
          </div>
          <span className={styles.statusHint}>Status defaults to Pending</span>
          <button type="submit" className={styles.authorizeButton}>
            Authorize Log In
          </button>
        </form>
      )}
      {addError && <p className={styles.errorText}>{addError}</p>}
      {addResult && (
        <div className={styles.successBanner}>
          <p>Account created for {addResult.user.email}.</p>
          {addResult.delivery?.temporaryPassword && (
            <p className={styles.devNote}>
              {addResult.delivery.devNote} Temporary password:{" "}
              <strong>{addResult.delivery.temporaryPassword}</strong>
            </p>
          )}
        </div>
      )}

      <div className={styles.searchRow}>
        <input
          placeholder={idLabel}
          value={search.id}
          onChange={(e) => setSearch({ ...search, id: e.target.value })}
          className={styles.input}
        />
        <input
          placeholder="Last Name"
          value={search.lastName}
          onChange={(e) => setSearch({ ...search, lastName: e.target.value })}
          className={styles.input}
        />
        <input
          placeholder="Email"
          value={search.email}
          onChange={(e) => setSearch({ ...search, email: e.target.value })}
          className={styles.input}
        />
        <input
          placeholder="Phone"
          value={search.phone}
          onChange={(e) => setSearch({ ...search, phone: e.target.value })}
          className={styles.input}
        />
        <button type="button" onClick={runSearch} className={styles.submitButton}>
          Submit
        </button>
      </div>

      {error && <p className={styles.errorText}>{error}</p>}

      {hasSearched && (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>{idLabel}</th>
                <th>Name</th>
                <th>Last Name</th>
                <th>Email</th>
                <th>Phone</th>
                {type === "employee" && <th>Role</th>}
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={type === "employee" ? 8 : 7} className={styles.emptyCell}>
                    Loading…
                  </td>
                </tr>
              )}
              {!isLoading && results.length === 0 && (
                <tr>
                  <td colSpan={type === "employee" ? 8 : 7} className={styles.emptyCell}>
                    No results.
                  </td>
                </tr>
              )}
              {results.map((user) => (
                <tr key={user.id}>
                  <td className={styles.idCell} title={user.id}>
                    {user.id.slice(0, 8)}
                  </td>
                  <td>{user.firstName}</td>
                  <td>{user.lastName}</td>
                  <td>{user.email}</td>
                  <td>{user.phone || "—"}</td>
                  {type === "employee" && (
                    <td className={styles.roleCell}>
                      <span className={styles.roleBadge}>{user.roleName || "—"}</span>
                    </td>
                  )}
                  <td>
                    <select
                      value={user.status}
                      onChange={(e) => handleStatusSelect(user, e.target.value)}
                      className={`${styles.statusSelect} ${styles[STATUS_STYLE[user.status] || "pending"]}`}
                    >
                      {statusOptions.map((option) => (
                        <option key={option} value={option}>
                          {option.charAt(0) + option.slice(1).toLowerCase()}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <button 
                      type="button" 
                      onClick={() => {
                        if (type === "employee" && onViewEmployee) {
                          onViewEmployee(user.id);
                        } else if (type === "member" && onViewMember) {
                          onViewMember(user.id);
                        } else {
                          openDetail(user);
                        }
                      }} 
                      className={styles.viewButton}
                    >
                      View Profile
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {statusModal && (
        <StatusWindowModal
          status={statusModal.status}
          onCancel={() => setStatusModal(null)}
          onConfirm={(window) => {
            applyStatus(statusModal.user, statusModal.status, window);
            setStatusModal(null);
          }}
        />
      )}

      {detailUser && (
        <div className={styles.overlay}>
          <div className={styles.detailModal}>
            <h3 className={styles.detailTitle}>
              {idLabel}: {detailUser.id}
            </h3>
            <label className={styles.fieldLabel}>
              Name
              <input
                value={detailForm.firstName}
                onChange={(e) => setDetailForm({ ...detailForm, firstName: e.target.value })}
                className={styles.input}
              />
            </label>
            <label className={styles.fieldLabel}>
              Last Name
              <input
                value={detailForm.lastName}
                onChange={(e) => setDetailForm({ ...detailForm, lastName: e.target.value })}
                className={styles.input}
              />
            </label>
            <label className={styles.fieldLabel}>
              Email
              <input
                type="email"
                value={detailForm.email}
                onChange={(e) => setDetailForm({ ...detailForm, email: e.target.value })}
                className={styles.input}
              />
            </label>
            <label className={styles.fieldLabel}>
              Phone
              <PhoneInputWithCountryCode
                value={detailForm.phone}
                onChange={(code, phoneNum) => {
                  setDetailForm({ ...detailForm, phone: phoneNum, countryCode: code });
                }}
                placeholder="Enter phone number"
                showLabel={false}
              />
            </label>
            {type === "employee" && roleOptions.length > 0 && (
              <label className={styles.fieldLabel}>
                Role
                <select
                  value={detailForm.roleId || ""}
                  onChange={(e) => setDetailForm({ ...detailForm, roleId: e.target.value })}
                  className={styles.input}
                >
                  <option value="">Select a role</option>
                  {roleOptions.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.role_name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {detailError && <p className={styles.errorText}>{detailError}</p>}
            {detailSuccess && <p className={styles.successText}>{detailSuccess}</p>}
            <div className={styles.detailActions}>
              <button type="button" onClick={() => setDetailUser(null)} className={styles.cancelButton}>
                Close
              </button>
              <button type="button" onClick={saveDetail} className={styles.saveButton}>
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
