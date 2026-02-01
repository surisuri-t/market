
export enum Difficulty {
  EASY = '쉬움',
  NORMAL = '보통',
  HARD = '어려움'
}

export enum Category {
  GROCERY = '시장보기',
  STATIONERY = '문구사기',
  FRUIT = '과일사기',
  ELECTRONICS = '가전제품',
  CLOTHING = '옷사기',
  CLEANING = '청소 & 빨래',
  TRAVEL = '여행가기',
  DINING = '식사하기',
  COSMETICS = '화장품사기'
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
