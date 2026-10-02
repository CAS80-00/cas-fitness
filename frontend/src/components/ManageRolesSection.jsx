import { useEffect, useState } from "react";
import RolesCard from "./RolesCard";
import styles from "../styles/ManageRolesSection.module.css";

function normalizeRole(role) {
  return {
    roleId: role.id,
    roleName: role.role_name,
    assignedPermissions: Array.isArray(role.permissions) ? role.permissions : [],
  };
}

/**
 * ManageRolesSection
 * Roles dropdown (Student populated by default) + "Configure Permissions"
 * to edit an existing role's RBAC matrix, and "Add Role" two-step flow:
 * Step 1 prompts for a new role name, Step 2 opens RolesCard to configure
 * granular permission toggles for that role. Both paths converge on the
 * same RolesCard-in-overlay experience.
 */
export default function ManageRolesSection() {
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "/api";
  const [roles, setRoles] = useState([]);
  const [selectedRoleId, setSelectedRoleId] = useState("");
  const [error, setError] = useState("");

  const [showNameModal, setShowNameModal] = useState(false);
  const [newRoleName, setNewRoleName] = useState("");
  const [configuringRole, setConfiguringRole] = useState(null);

  const authHeaders = () => {
    const token = localStorage.getItem("cas_jwt");
    return { Authorization: "Bearer " + token };
  };

  const loadRoles = async () => {
    try {
      const res = await fetch(`${apiBaseUrl}/admin/roles`, { headers: authHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load roles.");
      setRoles(data.roles || []);
      if (!selectedRoleId && data.roles?.length) {
        const student = data.roles.find((r) => r.role_name === "STUDENT");
        setSelectedRoleId(String((student || data.roles[0]).id));
      }
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => {
    loadRoles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const continueToPermissions = async () => {
    if (!newRoleName.trim()) return;
    try {
      const res = await fetch(`${apiBaseUrl}/admin/roles`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ roleName: newRoleName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create role.");
      setRoles((prev) => [...prev, data.role]);
      setSelectedRoleId(String(data.role.id));
      setShowNameModal(false);
      setNewRoleName("");
      setConfiguringRole(normalizeRole(data.role));
    } catch (err) {
      setError(err.message);
    }
  };

  const savePermissions = async (assignedPermissions) => {
    if (!configuringRole) return;
    const res = await fetch(`${apiBaseUrl}/admin/roles/${configuringRole.roleId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ permissions: assignedPermissions }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to save role permissions.");
    setRoles((prev) => prev.map((r) => (r.id === data.role.id ? data.role : r)));
  };

  const selectedRole = roles.find((r) => String(r.id) === selectedRoleId);

  return (
    <div className={styles.card}>
      <h2 className={styles.title}>Manage Roles</h2>
      {error && <p className={styles.errorText}>{error}</p>}

      <div className={styles.rolesRow}>
        <select
          value={selectedRoleId}
          onChange={(e) => setSelectedRoleId(e.target.value)}
          className={styles.select}
        >
          {roles.map((role) => (
            <option key={role.id} value={role.id}>
              {role.role_name}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={!selectedRole}
          onClick={() => setConfiguringRole(normalizeRole(selectedRole))}
          className={styles.addButton}
        >
          Configure Permissions
        </button>
        <button type="button" onClick={() => setShowNameModal(true)} className={styles.addButton}>
          Add Role
        </button>
      </div>

      {showNameModal && (
        <div className={styles.overlay}>
          <div className={styles.modal}>
            <h3 className={styles.modalTitle}>New Role Name</h3>
            <input
              autoFocus
              value={newRoleName}
              onChange={(e) => setNewRoleName(e.target.value)}
              placeholder="e.g. Front Desk"
              className={styles.input}
            />
            <div className={styles.modalActions}>
              <button
                type="button"
                onClick={() => {
                  setShowNameModal(false);
                  setNewRoleName("");
                }}
                className={styles.cancelButton}
              >
                Cancel
              </button>
              <button type="button" onClick={continueToPermissions} className={styles.continueButton}>
                Continue
              </button>
            </div>
          </div>
        </div>
      )}

      {configuringRole && (
        <div className={styles.overlay}>
          <div className={styles.configureWrap}>
            <RolesCard
              selectedRole={configuringRole}
              isSuperuser={configuringRole.roleName === "SUPERUSER"}
              onSavePermissions={savePermissions}
              onClose={() => setConfiguringRole(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
