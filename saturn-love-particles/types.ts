export enum HandGesture {
  UNKNOWN = 'UNKNOWN',
  OPEN = 'OPEN',
  CLOSED = 'CLOSED',
  NONE = 'NONE'
}

export interface ParticleState {
  expansion: number; // 0.0 to 1.0
}

export interface PhraseResponse {
  phrases: string[];
}
