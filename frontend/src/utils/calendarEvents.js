/**
 * Centralized event system for calendar synchronization
 * Allows components to emit and listen to calendar update events
 */

const listeners = new Map();

export const CalendarEvents = {
  SESSION_CANCELLED: 'session-cancelled',
  SESSION_BOOKED: 'session-booked',
  SESSION_RESCHEDULED: 'session-rescheduled',
};

/**
 * Subscribe to a calendar event
 * @param {string} eventType - Event type from CalendarEvents
 * @param {Function} callback - Function to call when event occurs
 * @returns {Function} Unsubscribe function
 */
export function onCalendarEvent(eventType, callback) {
  if (!listeners.has(eventType)) {
    listeners.set(eventType, []);
  }
  listeners.get(eventType).push(callback);

  // Return unsubscribe function
  return () => {
    const callbacks = listeners.get(eventType);
    const index = callbacks.indexOf(callback);
    if (index > -1) {
      callbacks.splice(index, 1);
    }
  };
}

/**
 * Emit a calendar event to all listeners
 * @param {string} eventType - Event type from CalendarEvents
 * @param {Object} data - Event data to pass to listeners
 */
export function emitCalendarEvent(eventType, data) {
  if (!listeners.has(eventType)) return;
  
  const callbacks = listeners.get(eventType);
  callbacks.forEach(callback => {
    try {
      callback(data);
    } catch (err) {
      console.error(`Error in ${eventType} listener:`, err);
    }
  });
}

/**
 * Broadcast a cancellation event
 * @param {Object} sessionData - Session that was cancelled
 */
export function broadcastSessionCancelled(sessionData) {
  emitCalendarEvent(CalendarEvents.SESSION_CANCELLED, {
    sessionId: sessionData.id,
    slotId: sessionData.slot_id,
    trainerId: sessionData.trainer_id,
    studentId: sessionData.student_id,
    scheduledDate: sessionData.scheduled_date,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Broadcast a booking event
 * @param {Object} sessionData - Session that was booked
 */
export function broadcastSessionBooked(sessionData) {
  emitCalendarEvent(CalendarEvents.SESSION_BOOKED, {
    sessionId: sessionData.id,
    slotId: sessionData.slot_id,
    trainerId: sessionData.trainer_id,
    studentId: sessionData.student_id,
    scheduledDate: sessionData.scheduled_date,
    timestamp: new Date().toISOString(),
  });
}
