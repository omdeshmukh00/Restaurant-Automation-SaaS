import React, { useState } from 'react';
import { X, Clock, Cake } from 'lucide-react';
import { useStaffStore } from '../../store/staff.store';
import type { ShiftAssignment, UpcomingBirthday } from '../../store/staff.store';

const SHIFT_COLORS = ['#f97316', '#3b82f6', '#a855f7', '#22c55e', '#eab308'];

function shiftTimeLabel(sh: ShiftAssignment): string {
  return `${sh.startTime} – ${sh.endTime}`;
}

function shiftDayLabel(sh: ShiftAssignment): string {
  if (!sh.days || sh.days.length === 0) return 'No recurring days';
  if (sh.days.length === 7) return 'Every day';
  return sh.days.join(', ');
}

// ── Schedule Detail Modal ──────────────────────────────────────────────────

function ScheduleModal({ shifts, onClose }: { shifts: ShiftAssignment[]; onClose: () => void }): JSX.Element {
  const scheduledToday = shifts.filter((s) => s.scheduledToday).length;
  const activeNow = shifts.filter((s) => s.activeNow).length;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <button
        type="button"
        aria-label="Close modal"
        className="absolute inset-0 bg-black/50 backdrop-blur-sm w-full h-full cursor-default"
        onClick={onClose}
      />
      <div className="relative z-10 bg-white dark:bg-gray-900 rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md">
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 rounded-full bg-gray-200 dark:bg-gray-700" />
        </div>
        <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-800">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Today&apos;s Full Schedule</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {scheduledToday} scheduled today • {activeNow} on shift now
            </p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>
        <div className="p-5 space-y-3 max-h-[60vh] overflow-y-auto">
          {shifts.length === 0 && (
            <p className="text-xs text-gray-500 dark:text-gray-400 text-center py-6">No active shift assignments.</p>
          )}
          {shifts.map((sh, i) => {
            const c = SHIFT_COLORS[i % SHIFT_COLORS.length];
            return (
              <div
                key={sh.id}
                className="flex items-center gap-3 p-3 rounded-xl border"
                style={{ borderColor: `${c}40`, background: `${c}10` }}
              >
                <div className="w-1 self-stretch rounded-full flex-shrink-0" style={{ background: c }} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-900 dark:text-gray-100">{sh.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{sh.staffName}</p>
                  <div className="flex items-center gap-1 mt-0.5">
                    <Clock className="w-3 h-3 text-gray-400" />
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {shiftTimeLabel(sh)} • {shiftDayLabel(sh)}
                    </p>
                  </div>
                </div>
                {sh.activeNow && (
                  <span className="text-[10px] font-semibold px-2 py-1 rounded-full bg-green-100 dark:bg-green-950/40 text-green-600 dark:text-green-400 flex-shrink-0">
                    On Now
                  </span>
                )}
              </div>
            );
          })}
        </div>
        <div className="flex justify-end px-5 pb-5">
          <button onClick={onClose} className="px-4 py-2 text-xs font-semibold text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">Close</button>
        </div>
      </div>
    </div>
  );
}

// ── Birthdays Detail Modal ─────────────────────────────────────────────────

function BirthdaysModal({ birthdays, onClose }: { birthdays: UpcomingBirthday[]; onClose: () => void }): JSX.Element {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <button
        type="button"
        aria-label="Close modal"
        className="absolute inset-0 bg-black/50 backdrop-blur-sm w-full h-full cursor-default"
        onClick={onClose}
      />
      <div className="relative z-10 bg-white dark:bg-gray-900 rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-sm">
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 rounded-full bg-gray-200 dark:bg-gray-700" />
        </div>
        <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-800">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Upcoming Birthdays</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{birthdays.length} birthdays coming up</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>
        <div className="p-5 space-y-3">
          {birthdays.length === 0 && (
            <p className="text-xs text-gray-500 dark:text-gray-400 text-center py-6">No upcoming birthdays recorded.</p>
          )}
          {birthdays.map((b, i) => (
            <div key={b.id} className="flex items-center gap-3 p-3 bg-pink-50 dark:bg-pink-950/20 border border-pink-100 dark:border-pink-900/30 rounded-xl">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-400 to-rose-400 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                {b.avatar}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">{b.name}</p>
                <div className="flex items-center gap-1 mt-0.5">
                  <Cake className="w-3 h-3 text-pink-400" />
                  <p className="text-xs text-pink-500 dark:text-pink-400 font-medium">{b.date}</p>
                  {b.daysUntil !== undefined && (
                    <span className="text-[10px] text-pink-400">
                      {b.daysUntil === 0 ? 'Today!' : `in ${b.daysUntil}d`}
                    </span>
                  )}
                </div>
              </div>
              {i === 0 && b.daysUntil !== undefined && b.daysUntil <= 7 && (
                <span className="text-xs font-semibold px-2 py-1 bg-pink-100 dark:bg-pink-950/40 text-pink-600 dark:text-pink-400 rounded-full flex-shrink-0">Soon</span>
              )}
            </div>
          ))}
        </div>
        <div className="flex justify-end px-5 pb-5">
          <button onClick={onClose} className="px-4 py-2 text-xs font-semibold text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">Close</button>
        </div>
      </div>
    </div>
  );
}

// ── TodaysSchedule ─────────────────────────────────────────────────────────

export function TodaysSchedule(): JSX.Element {
  const { shifts } = useStaffStore();
  const [showAll, setShowAll] = useState(false);

  const todays = shifts.filter((s) => s.scheduledToday);
  const list = todays.length ? todays : shifts;

  return (
    <>
      <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">Today&apos;s Schedule</h3>
          {shifts.length > 0 && (
            <button onClick={() => setShowAll(true)} className="text-xs font-semibold text-orange-500 hover:underline">View All</button>
          )}
        </div>
        <div className="space-y-3">
          {list.length === 0 && (
            <p className="text-xs text-gray-500 dark:text-gray-400">No shifts scheduled.</p>
          )}
          {list.slice(0, 5).map((sh, i) => {
            const c = SHIFT_COLORS[i % SHIFT_COLORS.length];
            return (
              <div key={sh.id} className="flex items-center gap-3">
                <div className="w-1 h-10 rounded-full flex-shrink-0" style={{ background: c }} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-gray-800 dark:text-gray-100">{shiftTimeLabel(sh)}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{sh.name} • {sh.staffName}</p>
                </div>
                {sh.activeNow ? (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-950/40 text-green-600 dark:text-green-400 flex-shrink-0">On Now</span>
                ) : sh.scheduledToday ? (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 flex-shrink-0">Today</span>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
      {showAll && <ScheduleModal shifts={shifts} onClose={() => setShowAll(false)} />}
    </>
  );
}

// ── UpcomingBirthdays ──────────────────────────────────────────────────────

export function UpcomingBirthdays(): JSX.Element {
  const { birthdays } = useStaffStore();
  const [showAll, setShowAll] = useState(false);

  return (
    <>
      <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">Upcoming Birthdays</h3>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">
              {birthdays.length === 0 ? 'None yet' : `${birthdays.length} coming up`}
            </span>
            {birthdays.length > 0 && (
              <button onClick={() => setShowAll(true)} className="text-xs font-semibold text-orange-500 hover:underline">View All</button>
            )}
          </div>
        </div>
        <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
          {birthdays.length === 0 && (
            <p className="text-xs text-gray-500 dark:text-gray-400">No upcoming birthdays recorded.</p>
          )}
          {birthdays.map((b, i) => (
            <div key={b.id} className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-400 to-rose-400 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                {b.avatar}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-gray-800 dark:text-gray-100 truncate">{b.name}</p>
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0 text-right">
                <p>{b.date}</p>
                {b.daysUntil !== undefined && (
                  <p className="text-[10px]">
                    {b.daysUntil === 0 ? 'Today!' : `in ${b.daysUntil}d`}
                  </p>
                )}
              </div>
              {i === 0 && b.daysUntil !== undefined && b.daysUntil <= 7 && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-pink-100 dark:bg-pink-950/40 text-pink-600 dark:text-pink-400 flex-shrink-0">Soon</span>
              )}
            </div>
          ))}
        </div>
      </div>
      {showAll && <BirthdaysModal birthdays={birthdays} onClose={() => setShowAll(false)} />}
    </>
  );
}
