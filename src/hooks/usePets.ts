import { useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { subscribeToPets } from '../services/firebase/firestore';
import { useAuthStore } from '../store/authStore';
import { usePetsStore } from '../store/petsStore';

/**
 * Subscribes to real-time pet updates for the current family.
 * Must be called once high in the component tree (e.g. in the root layout).
 */
export function usePetsSubscription() {
  const familyId = useAuthStore((s) => s.user?.familyId);
  const setPets = usePetsStore((s) => s.setPets);

  useEffect(() => {
    if (!familyId) return;
    const unsubscribe = subscribeToPets(familyId, setPets);
    return unsubscribe;
  }, [familyId]);
}

/** Returns all pets from the store (active + inactive/deceased).
 *  Use useActivePets() when inactive pets must be excluded. */
export function usePets() {
  return usePetsStore((s) => s.pets);
}

/** Returns only active pets (excludes deceased / soft-deleted). */
export function useActivePets() {
  return usePetsStore(useShallow((s) => s.pets.filter((p) => p.isActive !== false)));
}

/** Returns a single pet by id */
export function usePet(petId: string) {
  return usePetsStore((s) => s.pets.find((p) => p.id === petId));
}
