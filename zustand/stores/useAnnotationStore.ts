import { create } from 'zustand';

export interface Annotation {
  id: number;
  type: 'text' | 'shape';
  data: any;
}

interface AnnotationState {
  annotations: Annotation[];
  selectedId: number | null;
  addAnnotation: (annotation: Annotation) => void;
  removeAnnotation: (id: number) => void;
  selectAnnotation: (id: number | null) => void;
  clearAnnotations: () => void;
}

export const useAnnotationStore = create<AnnotationState>(((set) => ({
  annotations: [],
  selectedId: null,

  addAnnotation: (annotation) =>
    set((state) => ({
      annotations: [...state.annotations, annotation],
    })),

  removeAnnotation: (id) =>
    set((state) => ({
      annotations: state.annotations.filter(a => a.id !== id),
      selectedId: state.selectedId === id ? null : state.selectedId,
    })),

  selectAnnotation: (id) => set({ selectedId: id }),

  clearAnnotations: () => set({ annotations: [], selectedId: null }),
}));
