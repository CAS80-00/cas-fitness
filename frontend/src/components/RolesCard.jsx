import { useEffect, useMemo, useState } from "react";
import styles from "../styles/RolesCard.module.css";

/**
 * Full RBAC permission tree: 6 master categories, each with its own set of
 * granular sub-actions. Each leaf is addressed as "<categoryKey>.<actionKey>"
 * in the flat `assignedPermissions` string array that this component both
 * consumes (to derive its initial toggle state) and produces (on Save).
 */
const PERMISSION_TREE = [
  {
    key: "editPages",
    label: "Edit Pages",
    actions: [
      { key: "editLandingPage", label: "Edit body of landing page" },
      { key: "editPlansPage", label: "Edit body of plans page" },
      { key: "editAboutUsPage", label: "Edit body of About us page" },
      { key: "editTermsPage", label: "Edit terms and conditions page" },
      { key: "editPrivacyPage", label: "Edit privacy page" },
    ],
  },
  {
    key: "manageEmployeeAccounts",
    label: "Manage Employee Accounts",
    actions: [
      { key: "seeEmployeeDashboards", label: "See employee dashboards" },
      { key: "createEmployeeProfiles", label: "Create employee profiles" },
      { key: "assignEmployeeIds", label: "Assign Employee IDs" },
      { key: "defineJobRoles", label: "Define job roles" },
      { key: "setEmployeeStatus", label: "Set employee status" },
      { key: "modifyEmployeeProfiles", label: "Modify employee profiles" },
      { key: "deleteEmployeeProfiles", label: "Delete employee profiles" },
    ],
  },
  {
    key: "controlPrivilegeLevels",
    label: "Control Privileges Levels",
    actions: [
      { key: "addNewRoles", label: "Add new roles" },
      { key: "deleteRoles", label: "Delete roles" },
      { key: "modifyRolesAccess", label: "Modify roles access" },
    ],
  },
  {
    key: "manageStudentProfiles",
    label: "Manage Student Profiles",
    actions: [
      { key: "seeStudentProfiles", label: "See students profile" },
      { key: "createStudentProfiles", label: "Create student profiles" },
      { key: "assignStudentIds", label: "Assign Student IDs" },
      {
        key: "modifyStudentProfiles",
        label: "Modify Student profiles (except form of payment and autorenewal)",
      },
      { key: "extendMemberships", label: "Extend memberships" },
      { key: "changeStudentStatus", label: "Change student status" },
      { key: "addPersonalTrainerSessions", label: "Add personal trainer sessions" },
      {
        key: "cancelPersonalTrainerAppointmentsAnytime",
        label: "Cancel personal trainer appointments anytime",
      },
      {
        key: "modifyPersonalTrainerAppointmentsAnytime",
        label: "Modify personal trainer appointments anytime",
      },
    ],
  },
  {
    key: "consultationCalendar",
    label: "Consultation Calendar",
    actions: [
      {
        key: "viewConsultationCalendar",
        label: "View Consultation calendar in profile dashboard and see appointments",
      },
      { key: "manageTimeSlots", label: "Manage time slots" },
      {
        key: "manageAppointmentStatus",
        label: "Manage status of appointments (view, create, cancel, or manually adjust)",
      },
      { key: "setTimeZoneManually", label: "Set up time zone manually" },
      { key: "defineMeetingTypes", label: "Define meeting types" },
      { key: "assignSlotsToEmployees", label: "Assign slots to specific employees" },
      { key: "changeAppointmentStatusValues", label: "Change status: pending, confirmed, canceled" },
    ],
  },
  {
    key: "workoutCalendar",
    label: "Workout Calendar",
    actions: [
      { key: "assignCalendarToTrainer", label: "Assign a calendar to a trainer" },
      { key: "showCalendarInTrainerDashboard", label: "Show calendar in trainer dashboard" },
      { key: "trainerViewBookedSessions", label: "Assigned trainer can view booked sessions" },
      { key: "assignTrainerAvailability", label: "Assign trainer availability time slots" },
      { key: "setCancelModifyTimeLimit", label: "Set up time limit to cancel or modify booking" },
      { key: "cancelOrModifyAnytime", label: "Cancel or modify booking at any time" },
      { key: "setVacationBlackouts", label: "Set vacations blackouts" },
      { key: "manualOverrideSessionStatus", label: "Manually override session status" },
    ],
  },
];

function buildTreeFromAssigned(assignedPermissions) {
  const assignedSet = new Set(Array.isArray(assignedPermissions) ? assignedPermissions : []);
  const tree = {};
  PERMISSION_TREE.forEach((category) => {
    tree[category.key] = {};
    category.actions.forEach((action) => {
      tree[category.key][action.key] = assignedSet.has(`${category.key}.${action.key}`);
    });
  });
  return tree;
}

function treeToAssignedPermissions(tree) {
  return PERMISSION_TREE.flatMap((category) =>
    category.actions
      .filter((action) => tree[category.key]?.[action.key])
      .map((action) => `${category.key}.${action.key}`),
  );
}

/**
 * RolesCard
 * Standalone RBAC privilege manager. Superuser locks every toggle
 * Active/Green. Section master toggles cascade to their sub-actions;
 * partially-enabled sections show an indeterminate state rather than
 * looking fully off. Save persists via `onSavePermissions` (Neon-backed)
 * and shows a 3-second success banner; Close checks for unsaved edits and
 * offers "Save and close" / "Keep me here".
 *
 * Props:
 *  - selectedRole: { roleId, roleName, assignedPermissions: string[] }
 *  - onSavePermissions(assignedPermissions): may return a Promise
 *  - isSuperuser: boolean — forces every toggle Active/Green and locked
 *  - onClose: optional, called when the card should be dismissed
 */
export default function RolesCard({ selectedRole, onSavePermissions, isSuperuser, onClose }) {
  const [tree, setTree] = useState(() => buildTreeFromAssigned(selectedRole?.assignedPermissions));
  const [isDirty, setIsDirty] = useState(false);
  const [showClosePrompt, setShowClosePrompt] = useState(false);
  const [showSavedBanner, setShowSavedBanner] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setTree(buildTreeFromAssigned(selectedRole?.assignedPermissions));
    setIsDirty(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRole?.roleId]);

  const effectiveTree = useMemo(() => {
    if (!isSuperuser) return tree;
    const forced = {};
    PERMISSION_TREE.forEach((category) => {
      forced[category.key] = {};
      category.actions.forEach((action) => {
        forced[category.key][action.key] = true;
      });
    });
    return forced;
  }, [tree, isSuperuser]);

  const sectionState = (categoryKey) => {
    const values = Object.values(effectiveTree[categoryKey] || {});
    if (values.length === 0 || values.every((v) => !v)) return "off";
    if (values.every(Boolean)) return "on";
    return "indeterminate";
  };

  const toggleSection = (categoryKey, enabled) => {
    if (isSuperuser) return;
    setTree((prev) => {
      const updated = {};
      Object.keys(prev[categoryKey]).forEach((actionKey) => {
        updated[actionKey] = enabled;
      });
      return { ...prev, [categoryKey]: updated };
    });
    setIsDirty(true);
  };

  const toggleAction = (categoryKey, actionKey) => {
    if (isSuperuser) return;
    setTree((prev) => ({
      ...prev,
      [categoryKey]: {
        ...prev[categoryKey],
        [actionKey]: !prev[categoryKey][actionKey],
      },
    }));
    setIsDirty(true);
  };

  const persist = async () => {
    setIsSaving(true);
    setError("");
    try {
      await onSavePermissions?.(treeToAssignedPermissions(effectiveTree));
      setIsDirty(false);
      setShowSavedBanner(true);
      setTimeout(() => setShowSavedBanner(false), 3000);
      return true;
    } catch (err) {
      setError(err.message || "Failed to save role permissions.");
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = () => {
    persist();
  };

  const handleClose = () => {
    if (isDirty) {
      setShowClosePrompt(true);
      return;
    }
    onClose?.();
  };

  const saveAndClose = async () => {
    const success = await persist();
    setShowClosePrompt(false);
    if (success) onClose?.();
  };

  return (
    <div className={styles.card}>
      <h3 className={styles.title}>
        Role Permissions Matrix {selectedRole?.roleName ? `- ${selectedRole.roleName}` : ""}
      </h3>
      {showSavedBanner && (
        <p className={styles.savedBanner}>Role permissions updated successfully</p>
      )}
      {error && <p className={styles.errorBanner}>{error}</p>}

      <div className={styles.sectionList}>
        {PERMISSION_TREE.map((category) => {
          const state = sectionState(category.key);
          const trackClass =
            state === "on"
              ? styles.toggleTrackOn
              : state === "indeterminate"
                ? styles.toggleTrackIndeterminate
                : styles.toggleTrackOff;

          return (
            <div key={category.key} className={styles.sectionCard}>
              <div className={styles.sectionHeaderRow}>
                <span className={styles.sectionLabel}>{category.label}</span>
                <button
                  type="button"
                  disabled={isSuperuser}
                  onClick={() => toggleSection(category.key, state !== "on")}
                  className={trackClass}
                >
                  <span className={styles.toggleKnob} />
                </button>
              </div>
              <div className={styles.permissionList}>
                {category.actions.map((action) => {
                  const enabled = effectiveTree[category.key][action.key];
                  return (
                    <div key={action.key} className={styles.permissionRow}>
                      <span>{action.label}</span>
                      <button
                        type="button"
                        disabled={isSuperuser}
                        onClick={() => toggleAction(category.key, action.key)}
                        className={enabled ? styles.toggleTrackOnSmall : styles.toggleTrackOffSmall}
                      >
                        <span className={styles.toggleKnob} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className={styles.actionsGrid}>
        <button type="button" onClick={handleSave} disabled={isSaving} className={styles.saveButton}>
          {isSaving ? "Saving…" : "Save"}
        </button>
        <button type="button" onClick={handleClose} className={styles.closeButton}>
          Close
        </button>
      </div>

      {showClosePrompt && (
        <div className={styles.promptOverlay}>
          <div className={styles.promptCard}>
            <p className={styles.promptMessage}>Selection not saved.</p>
            <div className={styles.promptActions}>
              <button type="button" onClick={saveAndClose} className={styles.promptSaveButton}>
                Save and close
              </button>
              <button
                type="button"
                onClick={() => setShowClosePrompt(false)}
                className={styles.promptKeepButton}
              >
                Keep me here
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
