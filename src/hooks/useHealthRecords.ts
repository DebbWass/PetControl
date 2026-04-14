import { useState, useEffect } from 'react';
import { orderBy, where } from 'firebase/firestore';
import { subscribeToCollection, paths } from '../services/firebase/firestore';
import { Medication, Vaccine, Treatment, FoodRecord, WeightRecord } from '../types';

export function useMedications(petId: string, familyId: string): Medication[] {
  const [records, setRecords] = useState<Medication[]>([]);
  useEffect(() => {
    if (!petId || !familyId) return;
    return subscribeToCollection<Medication>(
      paths.medications(familyId, petId),
      [where('isActive', '==', true), orderBy('createdAt', 'desc')],
      setRecords
    );
  }, [petId, familyId]);
  return records;
}

export function useVaccines(petId: string, familyId: string): Vaccine[] {
  const [records, setRecords] = useState<Vaccine[]>([]);
  useEffect(() => {
    if (!petId || !familyId) return;
    return subscribeToCollection<Vaccine>(
      paths.vaccines(familyId, petId),
      [orderBy('vaccinationDate', 'desc')],
      setRecords
    );
  }, [petId, familyId]);
  return records;
}

export function useTreatments(petId: string, familyId: string): Treatment[] {
  const [records, setRecords] = useState<Treatment[]>([]);
  useEffect(() => {
    if (!petId || !familyId) return;
    return subscribeToCollection<Treatment>(
      paths.treatments(familyId, petId),
      [orderBy('treatmentDate', 'desc')],
      setRecords
    );
  }, [petId, familyId]);
  return records;
}

export function useFood(petId: string, familyId: string): FoodRecord[] {
  const [records, setRecords] = useState<FoodRecord[]>([]);
  useEffect(() => {
    if (!petId || !familyId) return;
    return subscribeToCollection<FoodRecord>(
      paths.food(familyId, petId),
      [orderBy('feedingDate', 'desc')],
      setRecords
    );
  }, [petId, familyId]);
  return records;
}

export function useWeights(petId: string, familyId: string): WeightRecord[] {
  const [records, setRecords] = useState<WeightRecord[]>([]);
  useEffect(() => {
    if (!petId || !familyId) return;
    return subscribeToCollection<WeightRecord>(
      paths.weights(familyId, petId),
      [orderBy('recordedDate', 'desc')],
      setRecords
    );
  }, [petId, familyId]);
  return records;
}
