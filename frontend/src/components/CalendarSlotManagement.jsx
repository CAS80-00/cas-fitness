import { useEffect, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import styles from "../styles/CalendarSlotManagement.module.css";
import {
  SLOT_STATUSES,
  getMemberStatusOptions,
  getSuperuserStatusOptions,
  getWholeDayStatusOptions,
  getStatusColor,
} from "../utils/slotStatusConfig";

/**
 * Comprehensive Calendar Slot Management
 * - Superuser creates recurring slots for employees
 * - Employees create slots for themselves
 * - Generates continuous hourly slots at the specified minute
 * - Displays slots in a calendar view
 * - Employees/Members approve and manage their slots
 * - Member status options: CONSULTATION, TRAINING, BREAK
 * - Superuser status options: SICK, NO_SHOW, VACATION
 */
export default function CalendarSlotManagement({ employeeId, isEmployee = false, onSlotChanged = () => {} }) {
  const [employees, setEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [slotInstances, setSlotInstances] = useState([]);
  const [slotEvents, setSlotEvents] = useState([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [currentUser, setCurrentUser] = useState(null);

  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "/api";

  // Form state for creating new slot template
  const [formData, setFormData] = useState({
    calendarType: "WORKOUT",
    startDate: new Date().toISOString().split("T")[0],
    endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    startHour: 9,
    startMinute: 0,
    durationMinutes: 60,
    endHour: 17,
    endMinute: 0,
    locationFormat: "IN_PERSON",
    daysOfWeek: [1, 2, 3, 4, 5], // Mon-Fri
    publishedAtDate: new Date().toISOString().split("T")[0], // When to publish slots
    publishedAtTime: "00:00", // When to publish slots
  });

  // Whole day marking state
  const [showWholeDayModal, setShowWholeDayModal] = useState(false);
  const [wholeDayData, setWholeDayData] = useState({
    dateType: "single", // "single" or "range"
    date: null,
    startDate: null,
    endDate: null,
    status: "SICK",
  });

  // Calendar scroll time - set to earliest slot start time
  const [scrollTime, setScrollTime] = useState("09:00:00");

  const apiToken = () => localStorage.getItem("cas_jwt");
  const currentUserData = localStorage.getItem("cas_user");
  const isSuperuser = currentUserData ? JSON.parse(currentUserData).roleId === 1 : false;

  // Helper: Calculate hours until session starts
  const getHoursUntilSession = () => {
    if (!selectedSlot || !selectedSlot.slot_date || !selectedSlot.start_time) return 999;
    const sessionStart = new Date(`${selectedSlot.slot_date}T${selectedSlot.start_time}`);
    const now = new Date();
    return (sessionStart - now) / (1000 * 60 * 60);
  };

  // Helper: Check if trainer can cancel (24+ hours away)
  const canCancelSession = () => {
    if (isSuperuser) return true; // Superuser can always cancel
    const hours = getHoursUntilSession();
    return hours >= 24;
  };

  // Manage trainer session status
  const handleManageSessionStatus = async (newStatus) => {
    if (!selectedSlot) return;

    console.log(`[CalendarSlotManagement] Selected slot data:`, selectedSlot);

    // Use session_log_id if available (for booked sessions), otherwise use slot id
    const sessionLogId = selectedSlot.session_log_id || selectedSlot.id;
    
    if (!sessionLogId) {
      setMessage("Error: Session log ID not available");
      return;
    }

    try {
      setLoading(true);
      const token = apiToken();
      
      console.log(`[CalendarSlotManagement] Managing session ${sessionLogId} with status ${newStatus}`);
      console.log(`[CalendarSlotManagement] Full URL: ${apiBaseUrl}/trainer-sessions/session-log/${sessionLogId}/manage-status`);
      
      const res = await fetch(
        `${apiBaseUrl}/trainer-sessions/session-log/${sessionLogId}/manage-status`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ newStatus }),
        }
      );

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || `Failed to update session status to ${newStatus}`);
      }

      setMessage(`✓ Session marked as ${newStatus}`);
      setShowStatusModal(false);
      setSelectedSlot(null);
      if (selectedEmployee) loadSlotInstances(selectedEmployee.id);
      onSlotChanged();
    } catch (err) {
      setMessage(`Error: ${err.message}`);
      console.error("Error managing session status:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentUserData) {
      setCurrentUser(JSON.parse(currentUserData));
    }
    
    // If employee mode, set selectedEmployee to self
    if (isEmployee && employeeId) {
      setSelectedEmployee(employeeId);
      loadSlotInstances(employeeId);
    } else if (!isEmployee) {
      // Superuser mode - load all employees
      loadEmployees();
    }
  }, [employeeId, isEmployee]);

  // Auto-select first employee when in superuser mode and employees are loaded
  useEffect(() => {
    if (!isEmployee && employees.length > 0 && !selectedEmployee) {
      handleSelectEmployee(employees[0]);
    }
  }, [employees, isEmployee, selectedEmployee]);

  const loadEmployees = async () => {
    try {
      const token = apiToken();
      const res = await fetch(`${apiBaseUrl}/admin/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to load employees.");
      const data = await res.json();
      // Filter to only employees (roleId 2 or 3)
      setEmployees(data.users.filter((u) => u.roleId === 2 || u.roleId === 3));
    } catch (err) {
      setMessage(`Error: ${err.message}`);
    }
  };

  const loadSlotInstances = async (userId) => {
    try {
      setLoading(true);
      const token = apiToken();
      
      // Employees use /my-slots to fetch their own slots
      // Superusers use /admin/slot-instances/:userId to fetch any employee's slots
      const endpoint = isEmployee 
        ? `${apiBaseUrl}/calendars/my-slots`
        : `${apiBaseUrl}/admin/slot-instances/${userId}`;
      
      const res = await fetch(endpoint, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to load slots.");
      const data = await res.json();
      
      const instances = data.instances || [];
      console.log("Loaded slots:", instances); // Debug log
      setSlotInstances(instances);
    } catch (err) {
      setMessage(`Error: ${err.message}`);
      console.error("Error loading slots:", err); // Debug log
    } finally {
      setLoading(false);
    }
  };

  // Convert slot instances to calendar events
  useEffect(() => {
    console.log("Converting slots to events. SlotInstances count:", slotInstances.length); // Debug log
    console.log("Full slots data:", JSON.stringify(slotInstances, null, 2)); // Debug log - full data
    
    const events = slotInstances.map((slot, idx) => {
      // Ensure slot_date is in YYYY-MM-DD format and times are HH:MM
      const dateStr = typeof slot.slot_date === 'string' 
        ? slot.slot_date.split('T')[0]  // Strip any time part if present
        : slot.slot_date;
      
      const startTime = typeof slot.start_time === 'string'
        ? slot.start_time.substring(0, 5)  // Get HH:MM from HH:MM:SS
        : slot.start_time;
      
      const endTime = typeof slot.end_time === 'string'
        ? slot.end_time.substring(0, 5)  // Get HH:MM from HH:MM:SS
        : slot.end_time;

      // Use ISO string format for dates to ensure proper timezone handling
      // This treats the date/time as local time rather than UTC
      const startDateTime = `${dateStr}T${startTime}`;
      const endDateTime = `${dateStr}T${endTime}`;
      
      const event = {
        id: slot.id || idx,
        title: slot.displayStatus || slot.status || "PENDING",
        start: startDateTime,
        end: endDateTime,
        backgroundColor: getStatusColor(slot.displayStatus || slot.status),
        borderColor: getStatusColor(slot.displayStatus || slot.status),
        extendedProps: {
          slotData: slot,
        },
      };
      console.log(`Event ${idx + 1}:`, event); // Debug log - each event
      return event;
    });
    console.log("Total events created:", events.length); // Debug log
    console.log("All events:", JSON.stringify(events, null, 2)); // Debug log - all events
    setSlotEvents(events);

    // Calculate scroll time from earliest slot
    if (slotInstances.length > 0) {
      const startTimes = slotInstances.map((slot) => {
        const startTime = typeof slot.start_time === 'string'
          ? slot.start_time.substring(0, 5)  // Get HH:MM
          : slot.start_time;
        return startTime;
      });
      
      // Sort times and get the earliest
      const earliestTime = startTimes.sort()[0];
      // Convert HH:MM to HH:MM:00 format for scrollTime
      const scrollTimeFormatted = `${earliestTime}:00`;
      setScrollTime(scrollTimeFormatted);
      console.log("Set scroll time to:", scrollTimeFormatted); // Debug log
    }
  }, [slotInstances]);

  const handleSelectEmployee = (employee) => {
    setSelectedEmployee(employee);
    setShowCreateForm(false);
    setMessage("");
    console.log("Selected employee:", employee.id); // Debug log
    loadSlotInstances(employee.id);
  };

  const handleCreateSlots = async (e) => {
    e.preventDefault();
    
    // Better validation with specific error messages
    if (!selectedEmployee) {
      setMessage("❌ Please select an employee first");
      return;
    }
    
    if (!formData.daysOfWeek || formData.daysOfWeek.length === 0) {
      setMessage("❌ Please select at least one day of week");
      return;
    }
    
    if (!formData.startDate) {
      setMessage("❌ Please enter a start date");
      return;
    }
    
    if (!formData.endDate) {
      setMessage("❌ Please enter an end date");
      return;
    }
    
    if (formData.startHour === undefined || formData.startHour === null) {
      setMessage("❌ Please enter a start hour");
      return;
    }
    
    if (formData.startMinute === undefined || formData.startMinute === null) {
      setMessage("❌ Please enter start minutes");
      return;
    }
    
    if (!formData.durationMinutes || formData.durationMinutes <= 0) {
      setMessage("❌ Please enter a valid slot duration");
      return;
    }

    try {
      setLoading(true);
      const token = apiToken();

      // Handle both employee mode (string) and superuser mode (object)
      const employeeId = typeof selectedEmployee === 'string' ? selectedEmployee : selectedEmployee.id;

      // Different payload format for superuser vs employee endpoints
      let payload;
      const endpoint = isEmployee ? `${apiBaseUrl}/calendars/slots/create` : `${apiBaseUrl}/admin/slot-templates`;
      
      if (isEmployee) {
        // Employee endpoint expects: startHour, startMinute, durationMinutes, etc.
        payload = {
          userId: employeeId,
          calendarType: formData.calendarType,
          startDate: formData.startDate,
          endDate: formData.endDate,
          startHour: formData.startHour,
          startMinute: formData.startMinute,
          durationMinutes: formData.durationMinutes,
          endHour: formData.endHour,
          endMinute: formData.endMinute,
          locationFormat: formData.locationFormat,
          daysOfWeek: formData.daysOfWeek,
        };
      } else {
        // Superuser endpoint expects: startTime (HH:MM format), not separate hour/minute
        const startTime = `${String(formData.startHour).padStart(2, '0')}:${String(formData.startMinute).padStart(2, '0')}`;
        const endTimeOfDay = `${String(formData.endHour).padStart(2, '0')}:${String(formData.endMinute).padStart(2, '0')}`;
        payload = {
          userId: employeeId,
          calendarType: formData.calendarType,
          startDate: formData.startDate,
          endDate: formData.endDate,
          startTime: startTime, // Changed from startHour/startMinute
          endTimeOfDay: endTimeOfDay, // Add end time of day to limit slot creation
          durationMinutes: formData.durationMinutes,
          locationFormat: formData.locationFormat,
          daysOfWeek: formData.daysOfWeek,
        };
      }

      console.log("Creating slots with payload:", payload); // Debug log
      
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        if (err.missingFields) {
          throw new Error(`Missing required fields: ${err.missingFields.join(', ')}`);
        }
        throw new Error(err.error || "Failed to create slots.");
      }

      const data = await res.json();
      const slotsCount = data.instancesCount || data.slotsCreated || 0;
      const employeeName = isEmployee ? "your" : `${selectedEmployee.firstName}'s`;
      setMessage(`✓ Created ${slotsCount} slots for ${employeeName} calendar`);
      setShowCreateForm(false);
      setFormData({
        calendarType: "WORKOUT",
        startDate: new Date().toISOString().split("T")[0],
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        startHour: 9,
        startMinute: 0,
        durationMinutes: 60,
        endHour: 17,
        endMinute: 0,
        locationFormat: "IN_PERSON",
        daysOfWeek: [1, 2, 3, 4, 5],
        publishedAtDate: new Date().toISOString().split("T")[0],
        publishedAtTime: "00:00",
      });
      // Reload slots after creation
      await new Promise(resolve => setTimeout(resolve, 500)); // Small delay to ensure DB writes
      loadSlotInstances(employeeId);
      onSlotChanged(); // Trigger refresh of all calendars
    } catch (err) {
      setMessage(`Error: ${err.message}`);
      console.error("Error creating slots:", err); // Debug log
    } finally {
      setLoading(false);
    }
  };

  const handleSlotClick = (info) => {
    console.log("Slot clicked:", info.event.extendedProps.slotData); // Debug log
    setSelectedSlot(info.event.extendedProps.slotData);
    setShowStatusModal(true);
  };

  const handleUpdateSlotStatus = async (newStatus) => {
    if (!selectedSlot) return;

    try {
      setLoading(true);
      const token = apiToken();
      
      // If REMOVED, delete the slot instead of updating status
      if (newStatus === "REMOVED") {
        const res = await fetch(`${apiBaseUrl}/admin/slot-instances/${selectedSlot.id}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error("Failed to delete slot.");
        setMessage("✓ Slot removed");
      } else {
        const res = await fetch(`${apiBaseUrl}/admin/slot-instances/${selectedSlot.id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ status: newStatus }),
        });
        if (!res.ok) throw new Error("Failed to update slot.");
        setMessage(`✓ Slot updated to ${newStatus}`);
      }
      
      setShowStatusModal(false);
      setSelectedSlot(null);
      if (selectedEmployee) loadSlotInstances(selectedEmployee.id);
      
      // Trigger calendar refresh after status change
      setTimeout(() => {
        onSlotChanged();
      }, 500);
    } catch (err) {
      setMessage(`Error: ${err.message}`);
      console.error("Error updating slot:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSlot = async () => {
    if (!selectedSlot || !window.confirm("Delete this slot?")) return;

    try {
      setLoading(true);
      const token = apiToken();
      const res = await fetch(`${apiBaseUrl}/admin/slot-instances/${selectedSlot.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error("Failed to delete slot.");
      setMessage("✓ Slot deleted");
      setShowStatusModal(false);
      setSelectedSlot(null);
      if (selectedEmployee) loadSlotInstances(selectedEmployee.id);
    } catch (err) {
      setMessage(`Error: ${err.message}`);
      console.error("Error deleting slot:", err); // Debug log
    } finally {
      setLoading(false);
    }
  };

  const handleChangeCalendarType = async (newCalendarType) => {
    if (!selectedSlot) return;

    try {
      setLoading(true);
      const token = apiToken();
      const res = await fetch(`${apiBaseUrl}/admin/slot-instances/${selectedSlot.id}/calendar-type`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ calendarType: newCalendarType }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to change calendar type.");
      }
      
      setMessage(`✓ Slot moved to ${newCalendarType} calendar`);
      setShowStatusModal(false);
      setSelectedSlot(null);
      if (selectedEmployee) loadSlotInstances(selectedEmployee.id);
      onSlotChanged(); // Trigger refresh of all calendars
    } catch (err) {
      setMessage(`Error: ${err.message}`);
      console.error("Error changing calendar type:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkWholDay = async () => {
    const date = wholeDayData.dateType === "single" ? wholeDayData.date : null;
    const startDate = wholeDayData.dateType === "range" ? wholeDayData.startDate : null;
    const endDate = wholeDayData.dateType === "range" ? wholeDayData.endDate : null;

    if (!selectedEmployee || !wholeDayData.status) {
      setMessage("Please select a status.");
      return;
    }

    if (wholeDayData.dateType === "single" && !date) {
      setMessage("Please select a date.");
      return;
    }

    if (wholeDayData.dateType === "range" && (!startDate || !endDate)) {
      setMessage("Please select start and end dates.");
      return;
    }

    if (wholeDayData.dateType === "range" && new Date(startDate) > new Date(endDate)) {
      setMessage("Start date must be before end date.");
      return;
    }

    try {
      setLoading(true);
      const token = apiToken();
      
      // Single day
      if (wholeDayData.dateType === "single") {
        if (wholeDayData.status === "REMOVED") {
          const res = await fetch(
            `${apiBaseUrl}/admin/slot-instances-whole-day/${selectedEmployee.id}/${date}`,
            {
              method: "DELETE",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
            }
          );
          if (!res.ok) throw new Error("Failed to remove whole day.");
          const data = await res.json();
          setMessage(`✓ Removed ${data.deletedCount} slots`);
        } else {
          const res = await fetch(
            `${apiBaseUrl}/admin/slot-instances-whole-day/${selectedEmployee.id}/${date}`,
            {
              method: "PUT",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({ status: wholeDayData.status }),
            }
          );
          if (!res.ok) throw new Error("Failed to mark whole day.");
          const data = await res.json();
          setMessage(`✓ Marked ${data.updatedCount} slots as ${wholeDayData.status}`);
        }
      } 
      // Date range
      else {
        if (wholeDayData.status === "REMOVED") {
          const res = await fetch(
            `${apiBaseUrl}/admin/slot-instances-date-range/${selectedEmployee.id}`,
            {
              method: "DELETE",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({ startDate, endDate }),
            }
          );
          if (!res.ok) throw new Error("Failed to remove date range.");
          const data = await res.json();
          setMessage(`✓ Removed ${data.deletedCount} slots`);
        } else {
          const res = await fetch(
            `${apiBaseUrl}/admin/slot-instances-date-range/${selectedEmployee.id}`,
            {
              method: "PUT",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({ status: wholeDayData.status, startDate, endDate }),
            }
          );
          if (!res.ok) throw new Error("Failed to mark date range.");
          const data = await res.json();
          setMessage(`✓ Marked ${data.updatedCount} slots as ${wholeDayData.status}`);
        }
      }
      
      setShowWholeDayModal(false);
      setWholeDayData({ dateType: "single", date: null, startDate: null, endDate: null, status: "SICK" });
      if (selectedEmployee) loadSlotInstances(selectedEmployee.id);
      
      // Trigger calendar refresh after whole day status change
      setTimeout(() => {
        onSlotChanged();
      }, 500);
    } catch (err) {
      setMessage(`Error: ${err.message}`);
      console.error("Error marking whole day:", err);
    } finally {
      setLoading(false);
    }
  };

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const timeOptions = [];
  for (let h = 0; h < 24; h++) {
    timeOptions.push({ hour: h, label: `${String(h).padStart(2, "0")}:00` });
  }

  const minuteOptions = [0, 15, 30, 45];
  const durationOptions = Array.from({ length: 12 }, (_, i) => (i + 1) * 5); // 5, 10, 15... 60

  // Fallback status options if imports fail
  const memberStatusOptions = getMemberStatusOptions();
  const superuserStatusOptions = getSuperuserStatusOptions();
  const wholeDayStatusOptions = getWholeDayStatusOptions();

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>Calendar Slot Management</h2>

      <div className={styles.grid}>
        {/* Left Panel: Employee Selection - Hidden in employee mode */}
        {!isEmployee && (
          <div className={styles.panel}>
            <h3 className={styles.panelTitle}>Select Employee</h3>
            <div className={styles.employeeList}>
              {employees.map((emp) => (
                <button
                  key={emp.id}
                  className={selectedEmployee?.id === emp.id ? styles.employeeButtonActive : styles.employeeButton}
                  onClick={() => handleSelectEmployee(emp)}
                >
                  <div className={styles.empName}>
                    {emp.firstName} {emp.lastName}
                  </div>
                  <div className={styles.empRole}>{emp.roleName}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Right Panel: Slot Management */}
        {selectedEmployee && (
          <div className={styles.panel} style={{gridColumn: isEmployee ? '1 / -1' : 'auto'}}>
            <div className={styles.panelHeader}>
              <h3 className={styles.panelTitle}>
                {isEmployee ? "My Availability Slots" : `Slots for ${selectedEmployee.firstName || selectedEmployee} ${selectedEmployee.lastName || ''}`}
              </h3>
              {(isSuperuser || isEmployee) && (
                <button
                  className={styles.createButton}
                  onClick={() => setShowCreateForm(!showCreateForm)}
                  disabled={loading}
                >
                  {showCreateForm ? "Cancel" : "+ Create Slots"}
                </button>
              )}
            </div>

            {message && <div className={styles.message}>{message}</div>}

            {/* Create Slot Form */}
            {showCreateForm && (isSuperuser || isEmployee) && (
              <form className={styles.form} onSubmit={handleCreateSlots}>
                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label>Calendar Type</label>
                    <select
                      value={formData.calendarType}
                      onChange={(e) =>
                        setFormData({ ...formData, calendarType: e.target.value })
                      }
                    >
                      <option value="WORKOUT">Workout Calendar</option>
                      <option value="CONSULTATION">Consultation Calendar</option>
                    </select>
                  </div>

                  <div className={styles.formGroup}>
                    <label>Format</label>
                    <select
                      value={formData.locationFormat}
                      onChange={(e) =>
                        setFormData({ ...formData, locationFormat: e.target.value })
                      }
                    >
                      <option value="IN_PERSON">In-Person</option>
                      <option value="VIDEO">Video</option>
                      <option value="STUDENT_CHOICE">Student's Choice</option>
                    </select>
                  </div>
                </div>

                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label>Start Date</label>
                    <input
                      type="date"
                      value={formData.startDate}
                      onChange={(e) =>
                        setFormData({ ...formData, startDate: e.target.value })
                      }
                      required
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label>End Date</label>
                    <input
                      type="date"
                      value={formData.endDate}
                      onChange={(e) =>
                        setFormData({ ...formData, endDate: e.target.value })
                      }
                      required
                    />
                  </div>
                </div>

                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label>
                      Publish Date
                      <div className={styles.helpText}>
                        Slots will not appear until this date and time
                      </div>
                    </label>
                    <input
                      type="date"
                      value={formData.publishedAtDate}
                      onChange={(e) =>
                        setFormData({ ...formData, publishedAtDate: e.target.value })
                      }
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label>Publish Time</label>
                    <input
                      type="time"
                      value={formData.publishedAtTime}
                      onChange={(e) =>
                        setFormData({ ...formData, publishedAtTime: e.target.value })
                      }
                    />
                  </div>
                </div>

                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label>Start Time (Hour)</label>
                    <select
                      value={formData.startHour}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          startHour: parseInt(e.target.value),
                        })
                      }
                    >
                      {timeOptions.map((opt) => (
                        <option key={opt.hour} value={opt.hour}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className={styles.formGroup}>
                    <label>
                      Slot Start Minute
                      <div className={styles.helpText}>
                        Each hour, slots start at this minute (e.g., :00, :15, :30, :45)
                      </div>
                    </label>
                    <select
                      value={formData.startMinute}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          startMinute: parseInt(e.target.value),
                        })
                      }
                    >
                      {minuteOptions.map((m) => (
                        <option key={m} value={m}>
                          :{String(m).padStart(2, "0")}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className={styles.formGroup}>
                    <label>Duration (minutes)</label>
                    <select
                      value={formData.durationMinutes}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          durationMinutes: parseInt(e.target.value),
                        })
                      }
                    >
                      {durationOptions.map((d) => (
                        <option key={d} value={d}>
                          {d} mins
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className={styles.formGroup}>
                    <label>Calculated End Time</label>
                    <div className={styles.calculatedTime}>
                      {String((formData.startHour + Math.floor((formData.startMinute + formData.durationMinutes) / 60))).padStart(2, "0")}
                      :
                      {String((formData.startMinute + formData.durationMinutes) % 60).padStart(2, "0")}
                    </div>
                  </div>

                  <div className={styles.formGroup}>
                    <label>Daily Slot Schedule Preview</label>
                    <div className={styles.schedulePreview}>
                      <div className={styles.scheduleHelp}>
                        Slots will repeat every hour at :{String(formData.startMinute).padStart(2, "0")}
                      </div>
                      <div className={styles.slotExamples}>
                        {[0, 1, 2, 3, 4].map((offset) => {
                          const startH = formData.startHour + offset;
                          if (startH > formData.endHour) return null;
                          const endH = startH + Math.floor((formData.startMinute + formData.durationMinutes) / 60);
                          const endM = (formData.startMinute + formData.durationMinutes) % 60;
                          if (endH > formData.endHour) return null;
                          return (
                            <div key={offset} className={styles.slotExample}>
                              {String(startH).padStart(2, "0")}:{String(formData.startMinute).padStart(2, "0")} - {String(endH).padStart(2, "0")}:{String(endM).padStart(2, "0")}
                            </div>
                          );
                        })}
                        <div className={styles.slotExample} style={{ opacity: 0.6 }}>... and so on until end of day</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label>End Time of Day (Hour)</label>
                    <select
                      value={formData.endHour}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          endHour: parseInt(e.target.value),
                        })
                      }
                    >
                      {timeOptions.map((opt) => (
                        <option key={opt.hour} value={opt.hour}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className={styles.formGroup}>
                    <label>End Time of Day (Minutes)</label>
                    <select
                      value={formData.endMinute}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          endMinute: parseInt(e.target.value),
                        })
                      }
                    >
                      {minuteOptions.map((m) => (
                        <option key={m} value={m}>
                          :{String(m).padStart(2, "0")}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className={styles.formGroup}>
                  <label>Days of Week</label>
                  <div className={styles.daysGrid}>
                    {dayNames.map((day, idx) => (
                      <label key={idx} className={styles.dayCheckbox}>
                        <input
                          type="checkbox"
                          checked={formData.daysOfWeek.includes(idx)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFormData({
                                ...formData,
                                daysOfWeek: [...formData.daysOfWeek, idx],
                              });
                            } else {
                              setFormData({
                                ...formData,
                                daysOfWeek: formData.daysOfWeek.filter((d) => d !== idx),
                              });
                            }
                          }}
                        />
                        <span>{day}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <button type="submit" className={styles.submitButton} disabled={loading}>
                  {loading ? "Creating..." : "Create Slots"}
                </button>
              </form>
            )}

            {/* Calendar Display for viewing and managing slots */}
            {selectedEmployee && !showCreateForm && (
              <div className={styles.calendarContainer}>
                {loading && <div className={styles.loading}>Loading slots...</div>}
                {!loading && slotEvents.length === 0 && (
                  <div className={styles.empty}>No slots found. Create some!</div>
                )}
                {!loading && slotEvents.length > 0 && (
                  <FullCalendar
                    plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                    initialView="timeGridWeek"
                    headerToolbar={{
                      left: "prev,next today",
                      center: "title",
                      right: "dayGridMonth,timeGridWeek,timeGridDay",
                    }}
                    events={slotEvents}
                    eventClick={handleSlotClick}
                    height="auto"
                    slotDuration="00:30:00"
                    slotLabelInterval="00:30:00"
                    scrollTime={scrollTime}
                  />
                )}
              </div>
            )}

            {/* Status Update Modal */}
            {showStatusModal && selectedSlot && (
              <div className={styles.modal}>
                <div className={styles.modalContent}>
                  <div className={styles.modalHeader}>
                    <h3>Update Slot Status</h3>
                    <button
                      className={styles.closeBtn}
                      onClick={() => {
                        setShowStatusModal(false);
                        setSelectedSlot(null);
                      }}
                    >
                      ✕
                    </button>
                  </div>

                  <div className={styles.slotDetails}>
                    <p>
                      <strong>Date:</strong> {selectedSlot.slot_date}
                    </p>
                    <p>
                      <strong>Time:</strong> {selectedSlot.start_time} - {selectedSlot.end_time}
                    </p>
                    <p>
                      <strong>Current Status:</strong>{" "}
                      <span style={{ color: getStatusColor(selectedSlot.displayStatus || selectedSlot.status) }}>
                        {selectedSlot.displayStatus || selectedSlot.status}
                      </span>
                    </p>
                    {selectedSlot.calendar_type && (
                      <p>
                        <strong>Calendar Type:</strong>{" "}
                        <span style={{ fontWeight: "bold" }}>
                          {selectedSlot.calendar_type}
                        </span>
                      </p>
                    )}
                  </div>

                  {isSuperuser && selectedSlot.calendar_type && (
                    <div className={styles.statusOptions}>
                      <p className={styles.optionLabel}>Change Calendar Type:</p>
                      <div style={{ display: "flex", gap: "10px", marginBottom: "1.5rem" }}>
                        {["WORKOUT", "CONSULTATION"].map((type) => {
                          const isCurrentType = selectedSlot.calendar_type === type;
                          const isWorkout = type === "WORKOUT";
                          const bgColor = isWorkout ? "#3b82f6" : "#10b981"; // Blue for WORKOUT, Green for CONSULTATION
                          
                          return (
                            <button
                              key={type}
                              className={styles.optionBtn}
                              style={{ 
                                backgroundColor: isCurrentType ? "#d1d5db" : bgColor,
                                color: isCurrentType ? "#9ca3af" : "#ffffff",
                                borderLeftColor: bgColor,
                                opacity: isCurrentType ? 0.6 : 1,
                                cursor: isCurrentType ? "not-allowed" : "pointer",
                                fontWeight: "500"
                              }}
                              onClick={() => handleChangeCalendarType(type)}
                              disabled={loading || isCurrentType}
                            >
                              {type}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {selectedSlot.status === "BOOKED" && (
                    <div className={styles.statusOptions}>
                      <p className={styles.optionLabel}>Manage Session:</p>
                      
                      <button
                        className={styles.optionBtn}
                        style={{ borderLeftColor: "#10b981", backgroundColor: "#10b981" }}
                        onClick={() => handleManageSessionStatus('COMPLETED')}
                        disabled={loading}
                      >
                        ✓ Mark Complete
                      </button>

                      <button
                        className={styles.optionBtn}
                        style={{ borderLeftColor: "#f59e0b", backgroundColor: "#f59e0b" }}
                        onClick={() => handleManageSessionStatus('ABSENT')}
                        disabled={loading}
                      >
                        ! Mark Absent
                      </button>

                      {canCancelSession() ? (
                        <button
                          className={styles.optionBtn}
                          style={{ borderLeftColor: "#ef4444", backgroundColor: "#ef4444" }}
                          onClick={() => handleManageSessionStatus('CANCELLED')}
                          disabled={loading}
                        >
                          ✕ Cancel Session
                        </button>
                      ) : (
                        <div style={{
                          padding: "0.75rem 1rem",
                          backgroundColor: "#f3f4f6",
                          borderRadius: "4px",
                          color: "#6b7280",
                          fontSize: "0.875rem",
                          marginTop: "0.5rem"
                        }}>
                          Can only cancel {Math.ceil(getHoursUntilSession())} hours before session
                        </div>
                      )}
                    </div>
                  )}

                  <div className={styles.statusOptions}>
                    <p className={styles.optionLabel}>Select new status:</p>
                    {isSuperuser ? (
                      <div>
                        {superuserStatusOptions
                          .filter(status => status !== "CONSULTATION" && status !== "WORKOUT")
                          .map((status) => (
                          <button
                            key={status}
                            className={styles.optionBtn}
                            style={{ borderLeftColor: getStatusColor(status) }}
                            onClick={() => handleUpdateSlotStatus(status)}
                            disabled={loading}
                          >
                            {status}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div>
                        {memberStatusOptions
                          .filter(status => status !== "CONSULTATION" && status !== "WORKOUT")
                          .map((status) => (
                          <button
                            key={status}
                            className={styles.optionBtn}
                            style={{ borderLeftColor: getStatusColor(status) }}
                            onClick={() => handleUpdateSlotStatus(status)}
                            disabled={loading}
                          >
                            {status}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className={styles.modalFooter}>
                    {isSuperuser && (
                      <button
                        className={styles.deleteBtn}
                        onClick={handleDeleteSlot}
                        disabled={loading}
                      >
                        Delete Slot
                      </button>
                    )}
                    <button
                      className={styles.cancelBtn}
                      onClick={() => {
                        setShowStatusModal(false);
                        setSelectedSlot(null);
                      }}
                      disabled={loading}
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            )}

            
            {/* Whole Day Marking Modal */}
            {showWholeDayModal && isSuperuser && (
              <div className={styles.modal}>
                <div className={styles.modalContent}>
                  <div className={styles.modalHeader}>
                    <h3>Mark Whole Day / Date Range</h3>
                    <button
                      className={styles.closeBtn}
                      onClick={() => {
                        setShowWholeDayModal(false);
                        setWholeDayData({ dateType: "single", date: null, startDate: null, endDate: null, status: "SICK" });
                      }}
                    >
                      ✕
                    </button>
                  </div>

                  <div className={styles.formGroup}>
                    <label>Select Type</label>
                    <div style={{ display: "flex", gap: "10px" }}>
                      <button
                        className={wholeDayData.dateType === "single" ? styles.selectedTab : styles.tabButton}
                        onClick={() => setWholeDayData({ ...wholeDayData, dateType: "single" })}
                      >
                        Single Day
                      </button>
                      <button
                        className={wholeDayData.dateType === "range" ? styles.selectedTab : styles.tabButton}
                        onClick={() => setWholeDayData({ ...wholeDayData, dateType: "range" })}
                      >
                        Date Range
                      </button>
                    </div>
                  </div>

                  {wholeDayData.dateType === "single" ? (
                    <div className={styles.formGroup}>
                      <label>Select Date</label>
                      <input
                        type="date"
                        value={wholeDayData.date || ""}
                        onChange={(e) =>
                          setWholeDayData({ ...wholeDayData, date: e.target.value })
                        }
                      />
                    </div>
                  ) : (
                    <>
                      <div className={styles.formGroup}>
                        <label>Start Date</label>
                        <input
                          type="date"
                          value={wholeDayData.startDate || ""}
                          onChange={(e) =>
                            setWholeDayData({ ...wholeDayData, startDate: e.target.value })
                          }
                        />
                      </div>
                      <div className={styles.formGroup}>
                        <label>End Date</label>
                        <input
                          type="date"
                          value={wholeDayData.endDate || ""}
                          onChange={(e) =>
                            setWholeDayData({ ...wholeDayData, endDate: e.target.value })
                          }
                        />
                      </div>
                    </>
                  )}

                  <div className={styles.formGroup}>
                    <label>Status for {wholeDayData.dateType === "single" ? "Day" : "Date Range"}</label>
                    <div className={styles.statusOptions}>
                      {wholeDayStatusOptions.map((status) => (
                        <button
                          key={status}
                          className={`${styles.optionBtn} ${wholeDayData.status === status ? styles.selected : ""}`}
                          style={{ borderLeftColor: getStatusColor(status) }}
                          onClick={() => setWholeDayData({ ...wholeDayData, status })}
                        >
                          {status}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className={styles.modalFooter}>
                    <button
                      className={styles.submitButton}
                      onClick={handleMarkWholDay}
                      disabled={loading}
                    >
                      {loading ? "Updating..." : wholeDayData.dateType === "single" ? "Mark Day" : "Mark Date Range"}
                    </button>
                    <button
                      className={styles.cancelBtn}
                      onClick={() => {
                        setShowWholeDayModal(false);
                        setWholeDayData({ dateType: "single", date: null, startDate: null, endDate: null, status: "SICK" });
                      }}
                      disabled={loading}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}







