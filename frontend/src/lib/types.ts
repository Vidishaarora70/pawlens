export type Species = "cat" | "dog";

export interface Breed { name: string; confidence: number }
export interface Vote { model: string; species: Species; confidence: number }

export interface PredictionResult {
  id: string;
  filename: string | null;
  is_pet: boolean;
  gate_confidence: number;
  species: Species | null;
  species_confidence: number | null;
  breeds: Breed[];
  votes: Vote[];
  agreement: boolean;
  models_disagree: boolean;
  heatmap_png: string | null;
  cam_model: string | null;
  inference_ms: number;
  demo_mode: boolean;
}

export interface BatchResult { results: PredictionResult[]; inference_ms: number }

export type StressName = "blur" | "brightness" | "rotation" | "noise";
export interface StressTest {
  name: StressName;
  unit: string;
  levels: number[];
  confidence: number[];
  still_correct: boolean[];
  label_flipped_at: number | null;
}
export interface StressResult {
  base_label: Species;
  base_confidence: number;
  tests: StressTest[];
  robustness_score: number;
  inference_ms: number;
  demo_mode: boolean;
}

export interface Health {
  status: string;
  version: string;
  demo_mode: boolean;
  models_loaded: string[];
  cam_models: string[];
  gate_threshold: number;
  max_batch: number;
  max_file_mb: number;
}

export interface ModelMetrics {
  model: string;
  description: string;
  task: "species" | "breed" | "gate";
  params: number;
  test_samples?: number;
  test_accuracy: number | null;
  precision?: number;
  recall?: number;
  f1?: number;
  top3_accuracy?: number | null;
  confusion_matrix?: number[][];
  labels?: string[];
  history?: Record<string, number[]>;
  avg_inference_ms_cpu?: number;
  runtime_ms?: number | null;
  trained_at?: string;
  loaded: boolean;
}

export interface HistoryItem {
  id: string;
  at: number;
  thumb: string;
  is_pet: boolean;
  species: Species | null;
  confidence: number | null;
  breed: string | null;
  uncertain: boolean;
}
