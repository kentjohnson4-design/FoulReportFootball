export type Team = 'H' | 'V';
export type Side = 'O' | 'D' | 'K' | 'R';
export type Status = 'A' | 'D' | 'O';
export type Official = 'R' | 'U' | 'L' | 'H' | 'B' | 'D';
export type CrewPos = Official | 'FR';
/** 1-4 are quarters, 5 is overtime. */
export type Quarter = 1 | 2 | 3 | 4 | 5;
export type PeriodKey = '1' | '2' | '3' | '4' | 'OT';

export interface Foul {
  id: string;
  quarter: Quarter;
  /** Game clock when the flag was thrown, mm:ss. */
  time: string;
  team: Team | '';
  code: string;
  side: Side | '';
  /** Jersey number, or HC / TEAM / BENCH. */
  player: string;
  status: Status;
  official: Official | '';
  note: string;
  createdAt: number;
}

export interface Timeout {
  id: string;
  team: Team;
  quarter: Quarter;
  time: string;
  createdAt: number;
}

export interface Toss {
  winner: Team | '';
  choice: 'Defer' | 'Receive' | 'Kick' | 'Defend' | '';
  defendGoal: string;
  receive2ndHalf: Team | '';
  otWinner: Team | '';
  otChoice: 'Offense' | 'Defense' | '';
  otEnd: string;
}

export interface SendRecord {
  at: number;
  method: 'share-pdf' | 'email-text' | 'manual';
  /** Fingerprint of the report content when it was sent, to spot later changes. */
  hash: string;
}

export interface Game {
  id: string;
  createdAt: number;
  updatedAt: number;
  date: string;
  home: string;
  away: string;
  homeScore: string;
  awayScore: string;
  homeKicker: string;
  awayKicker: string;
  refereeEmail: string;
  crew: Record<CrewPos, string>;
  toss: Toss;
  periodTimes: Record<PeriodKey, { start: string; end: string }>;
  fouls: Foul[];
  timeouts: Timeout[];
  currentQuarter: Quarter;
  status: 'in-progress' | 'final';
  notes: string;
  sentLog: SendRecord[];
}

export const OFFICIALS: Official[] = ['R', 'U', 'L', 'H', 'B', 'D'];
export const CREW_POSITIONS: CrewPos[] = ['R', 'U', 'L', 'H', 'B', 'D', 'FR'];
export const CREW_NAMES: Record<CrewPos, string> = {
  R: 'Referee',
  U: 'Umpire',
  L: 'Line Judge',
  H: 'Head Linesman',
  B: 'Back Judge',
  D: 'Deep Judge',
  FR: 'Foul Reporter',
};
export const SIDE_NAMES: Record<Side, string> = { O: 'Offense', D: 'Defense', K: 'Kicking', R: 'Receiving' };
export const STATUS_NAMES: Record<Status, string> = { A: 'Accepted', D: 'Declined', O: 'Offsetting' };
export const QUARTERS: Quarter[] = [1, 2, 3, 4, 5];
export const quarterLabel = (q: Quarter) => (q === 5 ? 'OT' : `Q${q}`);
