import { act } from 'react';
import { usePetsStore } from '../petsStore';
import type { Pet } from '../../types';

const makePet = (overrides: Partial<Pet> & { id: string; name: string }): Pet => ({
  familyId: 'fam1',
  species: 'cat',
  sex: 'unknown',
  isNeutered: false,
  isActive: true,
  createdBy: 'user1',
  createdAt: null as any,
  updatedAt: null as any,
  ...overrides,
});

// Reset store state between tests
beforeEach(() => {
  usePetsStore.setState({ pets: [] });
});

describe('usePetsStore – setPets', () => {
  it('replaces the entire pets list', () => {
    const pets = [makePet({ id: 'p1', name: 'Luna' }), makePet({ id: 'p2', name: 'Max' })];
    act(() => usePetsStore.getState().setPets(pets));
    expect(usePetsStore.getState().pets).toHaveLength(2);
    expect(usePetsStore.getState().pets[0].id).toBe('p1');
  });

  it('replaces with empty array', () => {
    act(() => usePetsStore.getState().setPets([makePet({ id: 'p1', name: 'Luna' })]));
    act(() => usePetsStore.getState().setPets([]));
    expect(usePetsStore.getState().pets).toHaveLength(0);
  });
});

describe('usePetsStore – upsertPet', () => {
  it('adds a new pet when not present', () => {
    act(() => usePetsStore.getState().upsertPet(makePet({ id: 'p1', name: 'Luna' })));
    expect(usePetsStore.getState().pets).toHaveLength(1);
    expect(usePetsStore.getState().pets[0].name).toBe('Luna');
  });

  it('updates an existing pet in place', () => {
    act(() => {
      usePetsStore.getState().setPets([makePet({ id: 'p1', name: 'Luna' })]);
      usePetsStore.getState().upsertPet(makePet({ id: 'p1', name: 'Luna Updated' }));
    });
    const { pets } = usePetsStore.getState();
    expect(pets).toHaveLength(1);
    expect(pets[0].name).toBe('Luna Updated');
  });
});

describe('usePetsStore – removePet', () => {
  it('removes the correct pet by id', () => {
    act(() =>
      usePetsStore.getState().setPets([
        makePet({ id: 'p1', name: 'Luna' }),
        makePet({ id: 'p2', name: 'Max' }),
      ])
    );
    act(() => usePetsStore.getState().removePet('p1'));
    const { pets } = usePetsStore.getState();
    expect(pets).toHaveLength(1);
    expect(pets[0].id).toBe('p2');
  });

  it('does nothing when id not found', () => {
    act(() => usePetsStore.getState().setPets([makePet({ id: 'p1', name: 'Luna' })]));
    act(() => usePetsStore.getState().removePet('nonexistent'));
    expect(usePetsStore.getState().pets).toHaveLength(1);
  });
});
