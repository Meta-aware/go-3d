import { BLACK, EMPTY, GoGame, opponent, type Color, WHITE } from "./go";

/** Liberty-aware heuristic: capture, atari, extend, avoid self-atari, slight shape. */
export function pickAiMove(game: GoGame, color: Color = game.toPlay): number | null {
  const legal = game.legalMoves(color);
  if (legal.length === 0) return null;

  const stonesOnBoard = game.board.reduce((n: number, c) => n + (c !== EMPTY ? 1 : 0), 0);
  const last = game.lastMove;
  let best = legal[0];
  let bestScore = -1e9;

  for (const i of legal) {
    let score = Math.random() * 7;
    const [x, y] = game.xy(i);
    const edge = Math.min(x, y, game.size - 1 - x, game.size - 1 - y);

    const saved = game.board[i];
    game.board[i] = color;
    const opp = opponent(color);
    let captured = 0;
    const seen = new Set<number>();
    for (const n of game.neighbors(i)) {
      if (game.board[n] === opp && !seen.has(n)) {
        const g = game.getGroup(n);
        for (const s of g.stones) seen.add(s);
        if (g.liberties.size === 0) captured += g.stones.length;
        else if (g.liberties.size === 1) score += 22 + g.stones.length * 4;
      }
    }
    const own = game.getGroup(i);
    const libs = own.liberties.size;
    game.board[i] = saved;

    score += captured * 90;
    if (libs === 1 && captured === 0) score -= 55;
    else if (libs === 1 && captured > 0) score += 10;
    score += Math.min(libs, 5) * 3;

    let friendly = 0;
    let enemy = 0;
    for (const n of game.neighbors(i)) {
      if (game.board[n] === color) friendly++;
      else if (game.board[n] === opp) enemy++;
    }
    score += friendly * 4;
    score += enemy * 3;

    if (stonesOnBoard < game.size) {
      if (edge === 0) score -= 18;
      else if (edge === 1) score -= 6;
      else score += edge * 1.4;
      const starBias = Math.abs(x - (game.size - 1) / 2) + Math.abs(y - (game.size - 1) / 2);
      score += Math.max(0, 6 - starBias);
    } else if (edge === 0 && captured === 0) {
      score -= 8;
    }

    if (last !== null && last >= 0) {
      const [lx, ly] = game.xy(last);
      const d = Math.abs(lx - x) + Math.abs(ly - y);
      if (d > 0 && d <= 3) score += 10 - d * 2;
    }

    if (score > bestScore) {
      bestScore = score;
      best = i;
    }
  }

  if (stonesOnBoard > game.size * 2 && bestScore < 6 && Math.random() < 0.12) {
    return null;
  }

  return best;
}

export function estimateMoveValue(game: GoGame, i: number, color: Color): number {
  if (!game.isLegal(i, color)) return -Infinity;
  game.board[i] = color;
  const g = game.getGroup(i);
  let cap = 0;
  const opp = opponent(color);
  const seen = new Set<number>();
  for (const n of game.neighbors(i)) {
    if (game.board[n] === opp && !seen.has(n)) {
      const og = game.getGroup(n);
      for (const s of og.stones) seen.add(s);
      if (og.liberties.size === 0) cap += og.stones.length;
    }
  }
  game.board[i] = EMPTY;
  return cap * 10 + g.liberties.size;
}

export { BLACK, WHITE };
