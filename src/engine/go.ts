/** Go rules engine — independent of rendering. Japanese scoring (territory + captures). */

export const EMPTY = 0;
export const BLACK = 1;
export const WHITE = 2;

export type Color = 1 | 2;
export type Cell = 0 | 1 | 2;

export interface Captures {
  black: number;
  white: number;
}

export interface PlayResult {
  type: "play";
  index: number;
  color: Color;
  captured: number[];
}

export interface PassResult {
  type: "pass";
  color: Color;
  ended: boolean;
}

export interface ResignResult {
  type: "resign";
  color: Color;
}

export type ActionResult = PlayResult | PassResult | ResignResult;

export interface ScoreBreakdown {
  blackTerritory: number;
  whiteTerritory: number;
  blackCaptures: number;
  whiteCaptures: number;
  blackDead: number;
  whiteDead: number;
  komi: number;
  blackTotal: number;
  whiteTotal: number;
  winner: Color | 0;
}

interface Snapshot {
  board: Cell[];
  toPlay: Color;
  captures: Captures;
  koPoint: number | null;
  lastMove: number | null;
  consecutivePasses: number;
  over: boolean;
  winner: Color | 0 | null;
  resigned: Color | null;
  scoring: boolean;
  dead: boolean[];
}

const DIRS: [number, number][] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

export function opponent(color: Color): Color {
  return color === BLACK ? WHITE : BLACK;
}

export function colorName(color: Color): string {
  return color === BLACK ? "Black" : "White";
}

export class GoGame {
  readonly size: number;
  board: Cell[];
  toPlay: Color = BLACK;
  captures: Captures = { black: 0, white: 0 };
  koPoint: number | null = null;
  lastMove: number | null = null;
  consecutivePasses = 0;
  over = false;
  winner: Color | 0 | null = null;
  resigned: Color | null = null;
  komi: number;
  scoring = false;
  dead: boolean[];
  private history: Snapshot[] = [];

  constructor(size: number, komi = 6.5) {
    if (size < 5 || size > 25) throw new Error("Unsupported board size");
    this.size = size;
    this.board = new Array(size * size).fill(EMPTY);
    this.dead = new Array(size * size).fill(false);
    this.komi = komi;
  }

  idx(x: number, y: number): number {
    return y * this.size + x;
  }

  xy(i: number): [number, number] {
    return [i % this.size, Math.floor(i / this.size)];
  }

  inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.size && y < this.size;
  }

  neighbors(i: number): number[] {
    const [x, y] = this.xy(i);
    const out: number[] = [];
    for (const [dx, dy] of DIRS) {
      const nx = x + dx;
      const ny = y + dy;
      if (this.inBounds(nx, ny)) out.push(this.idx(nx, ny));
    }
    return out;
  }

  getGroup(i: number, treatDeadAsEmpty = false): { stones: number[]; liberties: Set<number> } {
    const raw = this.board[i];
    if (raw === EMPTY) return { stones: [], liberties: new Set() };
    const color = raw as Color;
    const stones: number[] = [];
    const liberties = new Set<number>();
    const seen = new Set<number>([i]);
    const stack = [i];
    while (stack.length) {
      const c = stack.pop()!;
      stones.push(c);
      for (const n of this.neighbors(c)) {
        const cell = this.board[n];
        const empty = cell === EMPTY || (treatDeadAsEmpty && this.dead[n]);
        if (empty) liberties.add(n);
        else if (cell === color && !this.dead[n] && !seen.has(n)) {
          seen.add(n);
          stack.push(n);
        }
      }
    }
    return { stones, liberties };
  }

  libertiesOf(i: number): number {
    if (this.board[i] === EMPTY) return 0;
    return this.getGroup(i).liberties.size;
  }

  private wouldCaptureAndSuicide(i: number, color: Color): { captured: number; suicide: boolean } {
    const saved = this.board[i];
    this.board[i] = color;
    const opp = opponent(color);
    let captured = 0;
    const seen = new Set<number>();
    for (const n of this.neighbors(i)) {
      if (this.board[n] === opp && !seen.has(n)) {
        const g = this.getGroup(n);
        for (const s of g.stones) seen.add(s);
        if (g.liberties.size === 0) captured += g.stones.length;
      }
    }
    const own = this.getGroup(i);
    const suicide = own.liberties.size === 0;
    this.board[i] = saved;
    return { captured, suicide };
  }

  isLegal(i: number, color: Color = this.toPlay): boolean {
    if (this.over || this.scoring) return false;
    if (i < 0 || i >= this.board.length) return false;
    if (this.board[i] !== EMPTY) return false;
    if (this.koPoint === i) return false;
    const { captured, suicide } = this.wouldCaptureAndSuicide(i, color);
    if (suicide && captured === 0) return false;
    return true;
  }

  legalMoves(color: Color = this.toPlay): number[] {
    const moves: number[] = [];
    for (let i = 0; i < this.board.length; i++) {
      if (this.isLegal(i, color)) moves.push(i);
    }
    return moves;
  }

  playIndex(i: number): PlayResult | null {
    if (!this.isLegal(i)) return null;
    this.pushHistory();
    const color = this.toPlay;
    const opp = opponent(color);
    this.board[i] = color;

    const captured: number[] = [];
    const seen = new Set<number>();
    for (const n of this.neighbors(i)) {
      if (this.board[n] === opp && !seen.has(n)) {
        const g = this.getGroup(n);
        for (const s of g.stones) seen.add(s);
        if (g.liberties.size === 0) {
          for (const s of g.stones) {
            this.board[s] = EMPTY;
            captured.push(s);
          }
        }
      }
    }

    if (color === BLACK) this.captures.black += captured.length;
    else this.captures.white += captured.length;

    const own = this.getGroup(i);
    if (captured.length === 1 && own.stones.length === 1 && own.liberties.size === 1) {
      this.koPoint = captured[0];
    } else {
      this.koPoint = null;
    }

    this.lastMove = i;
    this.consecutivePasses = 0;
    this.toPlay = opp;
    return { type: "play", index: i, color, captured };
  }

  play(x: number, y: number): PlayResult | null {
    if (!this.inBounds(x, y)) return null;
    return this.playIndex(this.idx(x, y));
  }

  pass(): PassResult | null {
    if (this.over || this.scoring) return null;
    this.pushHistory();
    const color = this.toPlay;
    this.lastMove = -1;
    this.koPoint = null;
    this.consecutivePasses += 1;
    this.toPlay = opponent(color);
    const ended = this.consecutivePasses >= 2;
    if (ended) {
      this.scoring = true;
    }
    return { type: "pass", color, ended };
  }

  resign(): ResignResult | null {
    if (this.over) return null;
    this.pushHistory();
    const color = this.toPlay;
    this.resigned = color;
    this.over = true;
    this.scoring = false;
    this.winner = opponent(color);
    return { type: "resign", color };
  }

  canUndo(): boolean {
    return this.history.length > 0;
  }

  undo(): boolean {
    const snap = this.history.pop();
    if (!snap) return false;
    this.applySnapshot(snap);
    return true;
  }

  toggleDead(i: number): boolean {
    if (!this.scoring || this.board[i] === EMPTY) return false;
    this.pushHistory();
    const g = this.getGroup(i);
    const next = !this.dead[i];
    for (const s of g.stones) this.dead[s] = next;
    return true;
  }

  finishScoring(): ScoreBreakdown {
    const score = this.score();
    this.over = true;
    this.scoring = false;
    this.winner = score.winner;
    return score;
  }

  score(): ScoreBreakdown {
    const { blackTerritory, whiteTerritory } = this.territory();
    let blackDead = 0;
    let whiteDead = 0;
    for (let i = 0; i < this.board.length; i++) {
      if (!this.dead[i]) continue;
      if (this.board[i] === BLACK) blackDead++;
      else if (this.board[i] === WHITE) whiteDead++;
    }
    const blackCaptures = this.captures.black + whiteDead;
    const whiteCaptures = this.captures.white + blackDead;
    const blackTotal = blackTerritory + blackCaptures;
    const whiteTotal = whiteTerritory + whiteCaptures + this.komi;
    let winner: Color | 0 = 0;
    if (blackTotal > whiteTotal) winner = BLACK;
    else if (whiteTotal > blackTotal) winner = WHITE;
    return {
      blackTerritory,
      whiteTerritory,
      blackCaptures,
      whiteCaptures,
      blackDead,
      whiteDead,
      komi: this.komi,
      blackTotal,
      whiteTotal,
      winner,
    };
  }

  territory(): { blackTerritory: number; whiteTerritory: number; owner: (Color | 0)[] } {
    const owner: (Color | 0)[] = new Array(this.board.length).fill(0);
    const visited = new Set<number>();
    let blackTerritory = 0;
    let whiteTerritory = 0;

    const isEmpty = (i: number) => this.board[i] === EMPTY || this.dead[i];

    for (let i = 0; i < this.board.length; i++) {
      if (!isEmpty(i) || visited.has(i)) continue;
      const region: number[] = [];
      const borders = new Set<Color>();
      const stack = [i];
      visited.add(i);
      while (stack.length) {
        const c = stack.pop()!;
        region.push(c);
        for (const n of this.neighbors(c)) {
          if (isEmpty(n)) {
            if (!visited.has(n)) {
              visited.add(n);
              stack.push(n);
            }
          } else {
            borders.add(this.board[n] as Color);
          }
        }
      }
      let who: Color | 0 = 0;
      if (borders.size === 1) who = [...borders][0];
      for (const p of region) owner[p] = who;
      if (who === BLACK) blackTerritory += region.length;
      else if (who === WHITE) whiteTerritory += region.length;
    }
    return { blackTerritory, whiteTerritory, owner };
  }

  setPosition(stones: { x: number; y: number; color: Color }[], toPlay: Color = BLACK): void {
    this.board.fill(EMPTY);
    this.dead.fill(false);
    this.captures = { black: 0, white: 0 };
    this.koPoint = null;
    this.lastMove = null;
    this.consecutivePasses = 0;
    this.over = false;
    this.winner = null;
    this.resigned = null;
    this.scoring = false;
    this.history = [];
    this.toPlay = toPlay;
    for (const s of stones) {
      if (this.inBounds(s.x, s.y)) this.board[this.idx(s.x, s.y)] = s.color;
    }
  }

  cloneBoard(): Cell[] {
    return this.board.slice();
  }

  private pushHistory(): void {
    this.history.push({
      board: this.board.slice(),
      toPlay: this.toPlay,
      captures: { ...this.captures },
      koPoint: this.koPoint,
      lastMove: this.lastMove,
      consecutivePasses: this.consecutivePasses,
      over: this.over,
      winner: this.winner,
      resigned: this.resigned,
      scoring: this.scoring,
      dead: this.dead.slice(),
    });
  }

  private applySnapshot(s: Snapshot): void {
    this.board = s.board.slice();
    this.toPlay = s.toPlay;
    this.captures = { ...s.captures };
    this.koPoint = s.koPoint;
    this.lastMove = s.lastMove;
    this.consecutivePasses = s.consecutivePasses;
    this.over = s.over;
    this.winner = s.winner;
    this.resigned = s.resigned;
    this.scoring = s.scoring;
    this.dead = s.dead.slice();
  }
}

export function starPoints(size: number): [number, number][] {
  if (size === 9) return [
    [2, 2], [2, 6], [6, 2], [6, 6], [4, 4],
  ];
  if (size === 13) return [
    [3, 3], [3, 9], [9, 3], [9, 9], [6, 6],
  ];
  if (size >= 19) {
    const t = 3;
    const m = (size - 1) / 2;
    const b = size - 4;
    return [
      [t, t], [t, m], [t, b],
      [m, t], [m, m], [m, b],
      [b, t], [b, m], [b, b],
    ];
  }
  const m = Math.floor(size / 2);
  return [[m, m]];
}

export function coordLabel(x: number, y: number, size: number): string {
  const letters = "ABCDEFGHJKLMNOPQRST";
  const col = letters[x] ?? String(x);
  return `${col}${size - y}`;
}
