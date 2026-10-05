import { useEffect, useState } from "react";
import SiteHeader from "../components/SiteHeader";
import SiteFooter from "../components/SiteFooter";
import SuperuserProfilePanel from "../components/SuperuserProfilePanel";
import ManageRolesSection from "../components/ManageRolesSection";
import UserManagementSection from "../components/UserManagementSection";
import SuperuserEmployeeView from "../components/SuperuserEmployeeView";
import SuperuserMemberView from "../components/SuperuserMemberView";
import MasterConsultationCalendar from "../components/MasterConsultationCalendar";
import MasterWorkoutCalendar from "../components/MasterWorkoutCalendar";
import CalendarSlotManagement from "../components/CalendarSlotManagement";
import PromoCodesSection from "../components/PromoCodesSection";
import styles from "../styles/SuperuserDashboard.module.css";

const EMPLOYEE_STATUS_OPTIONS = ["ACTIVE", "PENDING", "SUSPENDED", "CANCELLED"];
const MEMBER_STATUS_OPTIONS = ["ACTIVE", "PENDING", "SUSPENDED", "INACTIVE", "CANCELLED"];

/**
 * SuperuserDashboard
 * Restricted to role === SUPERUSER (enforced both by App.jsx's login
 * routing and by every /api/admin/* endpoint requiring requireSuperuser
 * server-side). Hosts: the editable Superuser profile panel, Manage Roles,
 * Manage Employees, Manage Members, the master Consultation/Workout
 * calendars, and Promocodes & Campaigns — all synced to PostgreSQL (Neon)
 * via /api/admin/*.
 */
export default function SuperuserDashboard({ currentUser, onLogout, onNavigate, onAuthenticated }) {
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "/api";
  const [profile, setProfile] = useState(currentUser);
  const [roles, setRoles] = useState([]);
  const [staff, setStaff] = useState([]);
  const [plans, setPlans] = useState([]);
  const [viewingEmployeeId, setViewingEmployeeId] = useState(null);
  const [viewingMemberId, setViewingMemberId] = useState(null);
  const [calendarRefreshTrigger, setCalendarRefreshTrigger] = useState(0);

  const authHeaders = () => {
    const token = localStorage.getItem("cas_jwt");
    return { Authorization: "Bearer " + token };
  };

  // Handle session invalidation (logged out from another device)
  const handleSessionInvalidated = () => {
    localStorage.removeItem("cas_jwt");
    localStorage.removeItem("cas_user");
    onLogout?.();
    onNavigate?.("home");
  };

  // Trigger refresh of all calendars when slot changes occur
  const triggerCalendarRefresh = () => {
    setCalendarRefreshTrigger(prev => prev + 1);
  };

  useEffect(() => {
    const loadRoles = async () => {
      try {
        const res = await fetch(`${apiBaseUrl}/admin/roles`, { headers: authHeaders() });
        const data = await res.json();
        if (res.ok) setRoles(data.roles || []);
      } catch {
        // Non-fatal: the employee Add form falls back to an empty role list.
      }
    };
    const loadStaff = async () => {
      try {
        const res = await fetch(`${apiBaseUrl}/admin/users?type=employee`, { headers: authHeaders() });
        const data = await res.json();
        if (res.ok) setStaff(data.users || []);
      } catch {
        // Non-fatal: calendar filters just show "All" only.
      }
    };
    const loadPlans = async () => {
      try {
        const res = await fetch(`${apiBaseUrl}/plans`);
        const data = await res.json();
        if (res.ok) setPlans(data.plans || []);
      } catch {
        // Non-fatal: the promo form's "Applies To" falls back to "All Plans" only.
      }
    };
    loadRoles();
    loadStaff();
    loadPlans();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const employeeRoleOptions = roles.filter((role) => role.role_name !== "SUPERUSER" && role.role_name !== "STUDENT");

  // If viewing a specific employee, show the detailed view
  if (viewingEmployeeId) {
    return (
      <div className={styles.page}>
        <SiteHeader
          currentUser={profile}
          onNavigate={onNavigate}
          onLogout={onLogout}
          onAuthenticated={onAuthenticated}
        />

        <div className={styles.contentWrap}>
          <SuperuserEmployeeView
            employeeId={viewingEmployeeId}
            roleOptions={employeeRoleOptions}
            onBack={() => setViewingEmployeeId(null)}
          />
        </div>

        <SiteFooter isSuperuser={true} />
      </div>
    );
  }

  // If viewing a specific member, show the detailed member view
  if (viewingMemberId) {
    return (
      <div className={styles.page}>
        <SiteHeader
          currentUser={profile}
          onNavigate={onNavigate}
          onLogout={onLogout}
          onAuthenticated={onAuthenticated}
        />

        <div className={styles.contentWrap}>
          <SuperuserMemberView
            memberId={viewingMemberId}
            onBack={() => setViewingMemberId(null)}
          />
        </div>

        <SiteFooter isSuperuser={true} />
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <SiteHeader
        currentUser={profile}
        onNavigate={onNavigate}
        onLogout={onLogout}
        onAuthenticated={onAuthenticated}
      />

      <div className={styles.contentWrap}>
        <div className={styles.header}>
          <h1 className={styles.title}>Superuser Control Panel</h1>
          <p className={styles.subtitle}>
            System level overrides, CMS engine, and global privilege settings.
          </p>
        </div>

        <SuperuserProfilePanel currentUser={profile} onProfileUpdated={setProfile} />

        <ManageRolesSection />

        <UserManagementSection
          type="employee"
          title="Manage Employees"
          statusOptions={EMPLOYEE_STATUS_OPTIONS}
          roleOptions={employeeRoleOptions}
          onViewEmployee={(employeeId) => setViewingEmployeeId(employeeId)}
        />

        <UserManagementSection type="member" title="Manage Members" statusOptions={MEMBER_STATUS_OPTIONS} onViewMember={(memberId) => setViewingMemberId(memberId)} />

        <MasterConsultationCalendar staff={staff} refreshTrigger={calendarRefreshTrigger} />

        <MasterWorkoutCalendar trainers={staff} refreshTrigger={calendarRefreshTrigger} />

        <CalendarSlotManagement onSlotChanged={triggerCalendarRefresh} />

        <PromoCodesSection plans={plans} onSessionInvalidated={handleSessionInvalidated} />
      </div>

      <SiteFooter isSuperuser={true} />
    </div>
  );
}
