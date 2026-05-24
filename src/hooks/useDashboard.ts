import { useState, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  collection, getDocs, query, where, orderBy, Timestamp,
} from 'firebase/firestore';
import { differenceInCalendarDays, startOfDay, endOfDay, addDays } from 'date-fns';
import { db } from '../services/firebase/config';
import { paths } from '../services/firebase/firestore';
import { useAuthStore } from '../store/authStore';
import { usePets } from './usePets';
import { Medication, Vaccine, Treatment, Appointment } from '../types';

export interface DashboardTask {
  petId: string;
  petName: string;
  type: 'medication' | 'vaccine' | 'treatment' | 'appointment';
  label: string;
  scheduledDate: Date;
  daysUntil: number;
  route: string;
  /** HH:MM display string — present when a specific time is known (e.g. reminderTime on medications) */
  timeLabel?: string;
}

export interface DashboardData {
  today: DashboardTask[];
  upcoming7: DashboardTask[];
  overdue: DashboardTask[];
  isLoading: boolean;
}

export function useDashboard(): DashboardData {
  const [data, setData] = useState<DashboardData>({
    today: [],
    upcoming7: [],
    overdue: [],
    isLoading: true,
  });
  const user = useAuthStore((s) => s.user);
  const pets = usePets();

  const fetchDashboard = useCallback(async () => {
    if (!user?.familyId) {
      setData((d) => ({ ...d, isLoading: false }));
      return;
    }
    if (pets.length === 0) {
      setData({ today: [], upcoming7: [], overdue: [], isLoading: false });
      return;
    }

    setData((d) => ({ ...d, isLoading: true }));
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
        // Date filtering is done client-side to avoid composite index issues.
        try {
          const medsSnap = await getDocs(
            query(
              collection(db, paths.medications(familyId, petId)),
              where('isActive', '==', true)
            )
          );
          medsSnap.docs.forEach((d) => {
            const m = { id: d.id, ...d.data() } as Medication;
            const dueDate = m.nextDueDate?.toDate();
            if (!dueDate) return;
            if (dueDate > sevenDaysEnd) return; // too far ahead — skip
            const days = differenceInCalendarDays(dueDate, now);
            allTasks.push({
              petId, petName: pet.name, type: 'medication',
              label: m.name, scheduledDate: dueDate, daysUntil: days,
              route: route('medications'),
              timeLabel: m.reminderTime,
            });
          });
        } catch { /* skip */ }

        // ── Vaccines due soon (within 7 days or overdue) ────────────
        try {
          const vaccSnap = await getDocs(
            query(
              collection(db, paths.vaccines(familyId, petId)),
              where('nextDueDate', '<=', Timestamp.fromDate(sevenDaysEnd)),
              orderBy('nextDueDate', 'asc')
            )
          );
          vaccSnap.docs.forEach((d) => {
            const v = d.data() as Vaccine;
            const dueDate = v.nextDueDate?.toDate();
            if (!dueDate) return;
            const days = differenceInCalendarDays(dueDate, now);
            allTasks.push({
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
              orderBy('nextDueDate', 'asc')
            )
          );
          treatSnap.docs.forEach((d) => {
            const tr = d.data() as Treatment;
            const dueDate = tr.nextDueDate?.toDate();
            if (!dueDate) return;
            const days = differenceInCalendarDays(dueDate, now);
            allTasks.push({
              petId, petName: pet.name, type: 'treatment',
              label: tr.productName, scheduledDate: dueDate, daysUntil: days,
              route: route('treatments'),
            });
          });
        } catch { /* skip */ }

        // ── Appointments today through 7 days ───────────────────────
        // Range on scheduledDate only (no equality filter on another field)
        // so Firestore handles it with a single-field index. Status is
        // filtered client-side to avoid requiring a composite index.
        try {
          const aptSnap = await getDocs(
            query(
              collection(db, paths.appointments(familyId, petId)),
              where('scheduledDate', '>=', Timestamp.fromDate(todayStart)),
              where('scheduledDate', '<=', Timestamp.fromDate(sevenDaysEnd)),
              orderBy('scheduledDate', 'asc')
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

    setData({
      today: allTasks.filter((t) => t.daysUntil === 0),
      upcoming7: allTasks.filter((t) => t.daysUntil > 0 && t.daysUntil <= 7),
      overdue: allTasks.filter((t) => t.daysUntil < 0),
      isLoading: false,
    });
  }, [user?.familyId, pets]);

  // Refresh whenever the tab comes into focus
  useFocusEffect(useCallback(() => { fetchDashboard(); }, [fetchDashboard]));

  return data;
}
