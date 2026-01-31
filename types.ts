
export enum Difficulty {
  EASY = '쉬움',
  NORMAL = '보통',
  HARD = '어려움'
}

export interface GameItem {
  id: string;
  name: string;
  description: string;
  icon: string; // Emoji or SVG path
}

export interface GameScenario {
  theme: string;
  items: GameItem[];
  decoys: GameItem[];
}

export enum GameState {
  LOBBY = 'LOBBY',
  OBSERVATION = 'OBSERVATION',
  FILL_GAPS = 'FILL_GAPS',
  RESULT = 'RESULT'
}
