import { useState, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  collection, getDocs, query, where, orderBy, Timestamp,
} from 'firebase/firestore';
import {
  differenceInCalendarDays, startOfDay, endOfDay, addDays, setHours, setMinutes,
} from 'date-fns';
import { db } from '../services/firebase/config';
import { paths, updateRecord } from '../services/firebase/firestore';
import { useAuthStore } from '../store/authStore';
import { useActivePets } from './usePets';
import { Medication, Vaccine, Treatment, Appointment, FrequencyUnit } from '../types';
import { calcMedicationNextDue } from '../utils/medicationUtils';

export interface DashboardTask {
  recordId: string;
  petId: string;
  petName: string;
  type: 'medication' | 'vaccine' | 'treatment' | 'appointment';
  label: string;
  scheduledDate: Date;
  daysUntil: number;
  route: string;
  /** HH:MM display string — present when a specific time is known */
  timeLabel?: string;
  /** Frequency fields — present on medication tasks, used for mark-done advancement */
  frequencyValue?: number;
  frequencyUnit?: FrequencyUnit;
}

export interface DashboardData {
  today: DashboardTask[];
  upcoming7: DashboardTask[];
  overdue: DashboardTask[];
  isLoading: boolean;
  refresh: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Advance an overdue recurring medication date forward by its frequency
 * until it reaches today or the future.  This ensures a daily medication
 * saved weeks ago shows as "today" instead of staying stuck in overdue.
 */
function advanceToCurrentDue(
  dueDate: Date,
  fv: number,
  fu: FrequencyUnit,
  reminderTime?: string,
): Date {
  if (fu === 'as_needed') return dueDate;
  const todayStart = startOfDay(new Date());
  if (dueDate >= todayStart) return dueDate; // already today or future

  let d = dueDate;
  let safety = 500; // cap iterations
  while (d < todayStart && safety-- > 0) {
    const next = calcMedicationNextDue(d, fv, fu);
    if (!next) break;
    d = next;
  }

  // Re-apply the reminder time component to whichever calendar day we landed on
  if (reminderTime) {
    const parts = reminderTime.split(':').map(Number);
    const hour = isNaN(parts[0]) ? 8 : parts[0];
    const minute = isNaN(parts[1]) ? 0 : parts[1];
    d = setHours(setMinutes(d, minute), hour);
  }
  return d;
}

// ─── Public action ────────────────────────────────────────────────────────────

/**
 * Mark a medication task as given.
 * Calculates the next due date (one frequency interval from now, preserving
 * the original reminder time) and writes it back to Firestore.
 */
export async function markMedicationDone(
  familyId: string,
  task: DashboardTask,
): Promise<void> {
  if (task.type !== 'medication' || !task.frequencyValue || !task.frequencyUnit) return;
  const now = new Date();
  const base = calcMedicationNextDue(now, task.frequencyValue, task.frequencyUnit);
  if (!base) return; // as_needed — nothing to advance

  let nextDate = base;
  if (task.timeLabel) {
    const parts = task.timeLabel.split(':').map(Number);
    const hour = isNaN(parts[0]) ? 8 : parts[0];
    const minute = isNaN(parts[1]) ? 0 : parts[1];
    nextDate = setHours(setMinutes(base, minute), hour);
  }

  await updateRecord<Medication>(
    paths.medications(familyId, task.petId),
    task.recordId,
    { nextDueDate: Timestamp.fromDate(nextDate) },
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useDashboard(): DashboardData {
  const [state, setState] = useState<Omit<DashboardData, 'refresh'>>({
    today: [],
    upcoming7: [],
    overdue: [],
    isLoading: true,
  });
  const user = useAuthStore((s) => s.user);
  const pets = useActivePets();

  const fetchDashboard = useCallback(async () => {
    if (!user?.familyId) {
      setState((d) => ({ ...d, isLoading: false }));
      return;
    }
    if (pets.length === 0) {
      setState({ today: [], upcoming7: [], overdue: [], isLoading: false });
      return;
    }

    setState((d) => ({ ...d, isLoading: true }));
    const familyId = user.familyId;
    const now = new Date();
    const todayStart = startOfDay(now);
    const sevenDaysEnd = endOfDay(addDays(now, 7));

    const allTasks: DashboardTask[] = [];

    await Promise.all(
      pets.map(async (pet) => {
        const petId = pet.id;
        const route = (sub: string) => `/pet/${petId}/${sub}`;

        // ── Medications: overdue + today + upcoming 7 days ──────────
        // Query only by isActive (single-field index, always available).
        // Date filtering and overdue-advancement are done client-side.
        try {
          const medsSnap = await getDocs(
            query(
              collection(db, paths.medications(familyId, petId)),
              where('isActive', '==', true),
            )
          );
          medsSnap.docs.forEach((d) => {
            const m = { id: d.id, ...d.data() } as Medication;
            const rawDue = m.nextDueDate?.toDate();
            if (!rawDue) return;

            // Advance overdue recurring medications to the current cycle date
            const effectiveDue = advanceToCurrentDue(
              rawDue,
              m.frequencyValue,
              m.frequencyUnit,
              m.reminderTime,
            );

            if (effectiveDue > sevenDaysEnd) return; // too far ahead — skip

            const days = differenceInCalendarDays(effectiveDue, now);
            allTasks.push({
              recordId: d.id,
              petId, petName: pet.name, type: 'medication',
              label: m.name, scheduledDate: effectiveDue, daysUntil: days,
              route: route('medications'),
              timeLabel: m.reminderTime,
              frequencyValue: m.frequencyValue,
              frequencyUnit: m.frequencyUnit,
            });
          });
        } catch { /* skip */ }

        // ── Vaccines due soon (within 7 days or overdue) ────────────
        try {
          const vaccSnap = await getDocs(
            query(
              collection(db, paths.vaccines(familyId, petId)),
              where('nextDueDate', '<=', Timestamp.fromDate(sevenDaysEnd)),
              orderBy('nextDueDate', 'asc'),
            )
          );
          vaccSnap.docs.forEach((d) => {
            const v = d.data() as Vaccine;
            const dueDate = v.nextDueDate?.toDate();
            if (!dueDate) return;
            const days = differenceInCalendarDays(dueDate, now);
            allTasks.push({
              recordId: d.id,
              petId, petName: pet.name, type: 'vaccine',
              label: v.name, scheduledDate: dueDate, daysUntil: days,
              route: route('vaccines'),
            });
          });
        } catch { /* skip */ }

        // ── Treatments due soon ─────────────────────────────────────
        try {
          const treatSnap = await getDocs(
            query(
              collection(db, paths.treatments(familyId, petId)),
              where('nextDueDate', '<=', Timestamp.fromDate(sevenDaysEnd)),
              orderBy('nextDueDate', 'asc'),
            )
          );
          treatSnap.docs.forEach((d) => {
            const tr = d.data() as Treatment;
            const dueDate = tr.nextDueDate?.toDate();
            if (!dueDate) return;
            const days = differenceInCalendarDays(dueDate, now);
            allTasks.push({
              recordId: d.id,
              petId, petName: pet.name, type: 'treatment',
              label: tr.productName, scheduledDate: dueDate, daysUntil: days,
              route: route('treatments'),
            });
          });
        } catch { /* skip */ }

        // ── Appointments today through 7 days ───────────────────────
        // Range on scheduledDate only — status filtered client-side.
        try {
          const aptSnap = await getDocs(
            query(
              collection(db, paths.appointments(familyId, petId)),
              where('scheduledDate', '>=', Timestamp.fromDate(todayStart)),
              where('scheduledDate', '<=', Timestamp.fromDate(sevenDaysEnd)),
              orderBy('scheduledDate', 'asc'),
            )
          );
          aptSnap.docs.forEach((d) => {
            const a = d.data() as Appointment;
            if (a.status !== 'scheduled') return; // client-side filter
            const aptDate = a.scheduledDate?.toDate();
            if (!aptDate) return;
            const days = differenceInCalendarDays(aptDate, now);
            const hh = aptDate.getHours().toString().padStart(2, '0');
            const mm = aptDate.getMinutes().toString().padStart(2, '0');
            allTasks.push({
              recordId: d.id,
              petId, petName: pet.name, type: 'appointment',
              label: a.title, scheduledDate: aptDate, daysUntil: days,
              route: route('appointments'),
              timeLabel: `${hh}:${mm}`,
            });
          });
        } catch { /* skip */ }
      })
    );

    allTasks.sort((a, b) => a.scheduledDate.getTime() - b.scheduledDate.getTime());

    setState({
      today: allTasks.filter((t) => t.daysUntil === 0),
      upcoming7: allTasks.filter((t) => t.daysUntil > 0 && t.daysUntil <= 7),
      overdue: allTasks.filter((t) => t.daysUntil < 0),
      isLoading: false,
    });
  }, [user?.familyId, pets]);

  // Refresh whenever the tab comes into focus
  useFocusEffect(useCallback(() => { fetchDashboard(); }, [fetchDashboard]));

  return { ...state, refresh: fetchDashboard };
}
