import { create } from 'zustand';
import { Pet } from '../types';

interface PetsState {
  pets: Pet[];
  setPets: (pets: Pet[]) => void;
  upsertPet: (pet: Pet) => void;
  removePet: (petId: string) => void;
}

export const usePetsStore = create<PetsState>((set) => ({
  pets: [],
  setPets: (pets) => set({ pets }),
  upsertPet: (pet) =>
    set((state) => {
      const idx = state.pets.findIndex((p) => p.id === pet.id);
      if (idx >= 0) {
        const updated = [...state.pets];
        updated[idx] = pet;
        return { pets: updated };
      }
      return { pets: [...state.pets, pet] };
    }),
  removePet: (petId) =>
    set((state) => ({ pets: state.pets.filter((p) => p.id !== petId) })),
}));
