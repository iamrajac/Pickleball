// ── Push Notification helpers ────────────────────────────────────────────────
// Uses browser Notification API. Works while the tab is open.
// For background push (when tab is closed), FCM server setup would be needed.

const _scheduled = new Map(); // key → timeoutId

export function notifySupported() {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export async function requestPermission() {
  if (!notifySupported()) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const result = await Notification.requestPermission();
  return result === 'granted';
}

export function notify(title, body, tag) {
  if (!notifySupported() || Notification.permission !== 'granted') return;
  try {
    const n = new Notification(title, {
      body,
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      tag: tag || String(Date.now()),
    });
    setTimeout(() => n.close(), 7000);
  } catch {}
}

// Schedule a notification at a specific timestamp (ms)
// Max 24 hours in advance — skip if already passed or too far ahead
export function scheduleAt(key, title, body, atMs) {
  if (_scheduled.has(key)) clearTimeout(_scheduled.get(key));
  const delay = atMs - Date.now();
  if (delay <= 0 || delay > 24 * 60 * 60 * 1000) return;
  const id = setTimeout(() => {
    notify(title, body, key);
    _scheduled.delete(key);
  }, delay);
  _scheduled.set(key, id);
}

export function cancelScheduled(key) {
  if (_scheduled.has(key)) {
    clearTimeout(_scheduled.get(key));
    _scheduled.delete(key);
  }
}

// Schedule all relevant notifications for an upcoming tournament
export function scheduleUpcomingNotifications(tournament) {
  if (!tournament?.scheduledAt || !tournament?.code) return;
  const ms = typeof tournament.scheduledAt === 'number'
    ? tournament.scheduledAt
    : new Date(tournament.scheduledAt).getTime();
  const name = tournament.name || `#${tournament.code}`;

  // 1 hour before
  scheduleAt(`${tournament.code}_1h`, '🏓 Tournament in 1 hour', `${name} starts in 1 hour. Get ready!`, ms - 60 * 60 * 1000);
  // 10 minutes before
  scheduleAt(`${tournament.code}_10m`, '🏓 Tournament starting soon!', `${name} starts in 10 minutes!`, ms - 10 * 60 * 1000);
  // At start time
  scheduleAt(`${tournament.code}_start`, '🏓 Tournament is LIVE now!', `${name} has started. Go go go!`, ms);
}

// Game event notifications (called from match/tournament logic)
export function notifyChampion(tournamentName, champion) {
  notify('🏆 Champions Crowned!', `${champion} win ${tournamentName || 'the tournament'}!`, 'champion');
}

export function notifyComeback(teamName, from, to) {
  notify('🔥 Comeback Alert!', `${teamName} trailing ${from}, now ${to}!`, 'comeback');
}

export function notifyAllMatchesDone(tournamentName) {
  notify('✅ All matches complete!', `Time to start playoffs for ${tournamentName || 'the tournament'}`, 'all_done');
}
