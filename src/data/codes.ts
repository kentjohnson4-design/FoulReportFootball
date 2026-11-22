// 2026 foul report codes, transcribed from the statewide "2026 FOUL REPORT CODES" sheet.
// Yardage is the nominal penalty from that sheet; it is not the yardage actually walked off
// (half-distance, enforcement spot and offsetting fouls change that).

export interface FoulCode {
  code: string;
  name: string;
  yds: string;
}

export const CODE_SET_LABEL = '2026 NFHS';

export const FOUL_CODES: FoulCode[] = [
  { code: 'BAT', name: 'Illegal Batting', yds: '10' },
  { code: 'BBW', name: 'Blocking Below the Waist', yds: '15' },
  { code: 'CHB', name: 'Chop Block', yds: '15' },
  { code: 'CLP', name: 'Clipping', yds: '15' },
  { code: 'DH', name: 'Holding - Defense', yds: '10' },
  { code: 'DIS', name: 'Disconcerting Act', yds: '5' },
  { code: 'DOG', name: 'Delay of Game', yds: '5' },
  { code: 'DPI', name: 'Pass Interference - Defense', yds: '15' },
  { code: 'DQ-BOX', name: 'Sub Leaving Team Box (Fight)', yds: '15+DQ' },
  { code: 'DQ-FI1', name: 'Fighting - First Half', yds: '15+DQ' },
  { code: 'DQ-FI2', name: 'Fighting - Second Half', yds: '15+DQ' },
  { code: 'DQ-FIH', name: 'Fighting - Halftime', yds: '15+DQ' },
  { code: 'DQ-FIP', name: 'Fighting - Before the Game', yds: '15+DQ' },
  { code: 'DQ-FLG', name: 'Flagrant Act', yds: '15+DQ' },
  { code: 'DQ-OFF', name: 'Contacting a Game Official', yds: '15+DQ' },
  { code: 'DQ-STK', name: 'Striking, Kicking or Kneeing', yds: '15+DQ' },
  { code: 'DQ-UNS', name: 'Second Unsportsmanlike Foul', yds: '15+DQ' },
  { code: 'ENC', name: 'Encroachment', yds: '5' },
  { code: 'FKI', name: 'Free-Kick Infraction', yds: '5' },
  { code: 'FM5', name: 'Incidental Grasp of the Face Mask', yds: '5' },
  { code: 'FST', name: 'False Start', yds: '5' },
  { code: 'HTR', name: 'Helping the Runner', yds: '5' },
  { code: 'IBB', name: 'Illegal Block in the Back', yds: '10' },
  { code: 'IBF', name: 'Illegal Block After Fair-Catch Sig.', yds: '15' },
  { code: 'IBK', name: 'Illegal Block on a Free Kick', yds: '10' },
  { code: 'IBT', name: 'Illegal Blocking Technique', yds: '10' },
  { code: 'IDP', name: 'Ineligible Receiver Downfield', yds: '5' },
  { code: 'IFC', name: 'Invalid or Illegal Fair-Catch Signal', yds: '5' },
  { code: 'IFP', name: 'Illegal Forward Pass', yds: '5 (+LOD)' },
  { code: 'ILF', name: 'Illegal Formation', yds: '5' },
  { code: 'ILH', name: 'Illegally Handing the Ball Forward', yds: '5+LOD' },
  { code: 'ILM', name: 'Illegal Motion', yds: '5' },
  { code: 'ILN', name: 'Illegal Numbering / <5 on Line', yds: '5' },
  { code: 'ILP', name: 'Illegal Participation', yds: '15' },
  { code: 'ILP-HOF', name: 'Participating Without a Helmet', yds: '15' },
  { code: 'ILS', name: 'Illegal Substitution', yds: '5' },
  { code: 'ING', name: 'Intentional Grounding', yds: '5+LOD' },
  { code: 'INL', name: 'Interlocked Blocking', yds: '10' },
  { code: 'ISH', name: 'Illegal Shift', yds: '5' },
  { code: 'ITP', name: 'Illegal Touching of Forward Pass', yds: '5+LOD' },
  { code: 'IUH', name: 'Illegal Use of Hands or Arms', yds: '10' },
  { code: 'KCI', name: 'Kick-Catch Interference', yds: '15' },
  { code: 'KIK', name: 'Illegally Kicking the Ball', yds: '10' },
  { code: 'KOB', name: 'Free Kick Out of Bounds', yds: '5' },
  { code: 'OH', name: 'Holding - Offense', yds: '10' },
  { code: 'OPI', name: 'Pass Interference - Offense', yds: '15' },
  { code: 'PF-BSB', name: 'Illegal Blindside Block', yds: '15' },
  { code: 'PF-DFP', name: 'Forceful Contact vs. Defenseless Plyr', yds: '15' },
  { code: 'PF-FMM', name: 'Face Mask - Twist, Turn or Pull', yds: '15' },
  { code: 'PF-HCT', name: 'Horse-Collar Tackle', yds: '15' },
  { code: 'PF-HUR', name: 'Hurdling an Opponent', yds: '15' },
  { code: 'PF-ICH', name: 'Contact w/ Helmet-less Opponent', yds: '15' },
  { code: 'PF-IHC', name: 'Illegal Helmet Contact (Butt/Face/Spear)', yds: '15' },
  { code: 'PF-IPC', name: 'Illegal Contact in Restricted Area', yds: '15' },
  { code: 'PF-LTO', name: 'Late Hit Out of Bounds', yds: '15' },
  { code: 'PF-LTP', name: 'Late Hit / Piling On', yds: '15' },
  { code: 'PF-RFH', name: 'Roughing the Holder', yds: '15+1st' },
  { code: 'PF-RFK', name: 'Roughing the Kicker', yds: '15+1st' },
  { code: 'PF-RPS', name: 'Roughing the Passer', yds: '15+1st' },
  { code: 'PF-RSN', name: 'Roughing the Snapper', yds: '15+1st' },
  { code: 'PF-SLP', name: "Slapping the Blocker's Head", yds: '15' },
  { code: 'PF-TGT', name: 'Targeting', yds: '15' },
  { code: 'PF-TRP', name: 'Tripping', yds: '15' },
  { code: 'PF-UNR', name: 'Unnecessary Roughness', yds: '15' },
  { code: 'PLB', name: 'Planned Loose-Ball Infraction', yds: '5' },
  { code: 'RGT', name: 'Runner Grasping a Teammate', yds: '10' },
  { code: 'RNH', name: 'Running Into the Holder', yds: '5' },
  { code: 'RNK', name: 'Running Into the Kicker', yds: '5' },
  { code: 'SL5', name: 'Sideline Interference (2nd)', yds: '5' },
  { code: 'SLW', name: 'Sideline Warning (1st)', yds: 'Warn' },
  { code: 'SNP', name: 'Snap Infraction', yds: '5' },
  { code: 'UNS-ACT', name: 'UNS - Delayed / Excessive Act', yds: '15' },
  { code: 'UNS-BCH', name: 'UNS - Bench / Nonplayer', yds: '15' },
  { code: 'UNS-DOG', name: 'UNS - Delay of Game to Start Half', yds: '15' },
  { code: 'UNS-EQP', name: 'UNS - Coach Allowed Illegal Equip.', yds: '15' },
  { code: 'UNS-LNG', name: 'UNS - Profanity / Abusive Lang.', yds: '15' },
  { code: 'UNS-OTH', name: 'UNS - Other', yds: '15' },
  { code: 'UNS-ROH', name: 'UNS - Removal of Helmet', yds: '15' },
  { code: 'UNS-SLM', name: 'Sideline Interference (3rd+)', yds: '15' },
  { code: 'UNS-TAU', name: 'UNS - Taunting or Baiting', yds: '15' },
  { code: 'UNS-UFA', name: 'Unfair Act', yds: '15' },
];

export const CODE_MAP = new Map(FOUL_CODES.map((c) => [c.code, c]));

export function codeGroup(code: string): string {
  if (code.startsWith('PF-')) return 'Personal fouls';
  if (code.startsWith('UNS-')) return 'Unsportsmanlike';
  if (code.startsWith('DQ-')) return 'Disqualifications';
  return 'Other fouls';
}

// Which team (offense/defense/kicking/receiving) normally commits the foul.
// Only a starting suggestion: it is filled in when the side is still blank.
export const DEFAULT_SIDE: Record<string, 'O' | 'D' | 'K' | 'R'> = {
  DH: 'D', DPI: 'D', ENC: 'D', 'PF-RPS': 'D', 'PF-RSN': 'D', DIS: 'D',
  OH: 'O', OPI: 'O', FST: 'O', IDP: 'O', ING: 'O', ILF: 'O', ILM: 'O', ISH: 'O',
  ILN: 'O', IFP: 'O', ILH: 'O', HTR: 'O', RGT: 'O', INL: 'O', SNP: 'O', CHB: 'O',
  KCI: 'K', KOB: 'K', FKI: 'K',
  RNK: 'R', RNH: 'R', 'PF-RFK': 'R', 'PF-RFH': 'R', IFC: 'R', IBF: 'R',
};

// Fouls charged to someone other than a numbered player.
export const DEFAULT_PLAYER: Record<string, string> = {
  SLW: 'TEAM', SL5: 'TEAM', 'UNS-SLM': 'HC', 'UNS-EQP': 'HC', 'UNS-BCH': 'BENCH', DOG: 'TEAM', 'UNS-DOG': 'TEAM',
};

// Extra words people search by that are not in the official foul name.
const ALIASES: Record<string, string> = {
  DPI: 'PI interference',
  OPI: 'PI interference',
  OH: 'hold',
  DH: 'hold',
  ENC: 'offside neutral zone',
  FM5: 'facemask',
  'PF-FMM': 'facemask',
  'PF-IHC': 'spear spearing',
  'PF-TGT': 'helmet',
  'PF-RPS': 'roughing',
  IBB: 'back',
  SLW: 'sideline',
  SL5: 'sideline',
  'UNS-SLM': 'sideline',
};

/** Starting order for "most called" until the user has their own history. */
export const STARTER_COMMON = ['FST', 'OH', 'IBB', 'DOG', 'ENC', 'PF-UNR', 'DPI', 'ILF', 'ILM', 'DH'];

function searchWords(c: FoulCode): string[] {
  const extra: string[] = [];
  if (c.code.startsWith('PF-')) extra.push('personal', 'foul');
  if (c.code.startsWith('UNS-')) extra.push('unsportsmanlike');
  if (c.code.startsWith('DQ-')) extra.push('ejection', 'eject', 'disqualification');
  return [...c.code.split('-'), ...c.name.split(/[^A-Za-z0-9<]+/), ...(ALIASES[c.code] ?? '').split(' '), ...extra]
    .filter(Boolean)
    .map((w) => w.toUpperCase());
}

/**
 * Codes matching a search, best first. Every word typed must start one of the code's words
 * (code, name or common nickname), so "hold def" finds DH and "pi" finds DPI and OPI.
 * Ties go to the codes this user calls most.
 */
export function searchCodes(query: string, freq: Map<string, number>): FoulCode[] {
  const q = query.trim().toUpperCase();
  if (!q) return FOUL_CODES;
  const tokens = q.split(/\s+/);
  const scored: [FoulCode, number][] = [];
  for (const c of FOUL_CODES) {
    const bare = c.code.replace(/^(PF|UNS|DQ)-/, '');
    let score = 0;
    if (c.code === q || bare === q) score = 100;
    else if (c.code.startsWith(q) || bare.startsWith(q)) score = 80;
    else {
      const words = searchWords(c);
      if (tokens.every((t) => words.some((w) => w.startsWith(t)))) score = 50;
    }
    if (score) scored.push([c, score]);
  }
  return scored
    .sort((a, b) => b[1] - a[1] || (freq.get(b[0].code) ?? 0) - (freq.get(a[0].code) ?? 0) || a[0].code.localeCompare(b[0].code))
    .map(([c]) => c);
}
