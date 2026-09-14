import "./style.css";
import { registerSW } from "virtual:pwa-register";
import {
  BLACK,
  GoGame,
  colorName,
  type Color,
} from "./engine/go";
import { pickAiMove } from "./engine/ai";
import { LESSONS, type Lesson } from "./lessons/lessons";
import { GoScene } from "./render/GoScene";
import type { CameraMode } from "./render/cameraRig";

type PlayMode = "hotseat" | "ai" | "teach";

registerSW({ immediate: true });

const canvas = document.getElementById("scene") as HTMLCanvasElement;
const turnDot = document.getElementById("turn-dot")!;
const turnLabel = document.getElementById("turn-label")!;
const turnPill = document.getElementById("turn-pill")!;
const capB = document.getElementById("cap-b")!;
const capW = document.getElementById("cap-w")!;
const toastEl = document.getElementById("toast")!;
const teachPanel = document.getElementById("teach-panel")!;
const teachTitle = document.getElementById("teach-title")!;
const teachStep = document.getElementById("teach-step")!;
const teachBody = document.getElementById("teach-body")!;
const teachLessons = document.getElementById("teach-lessons")!;
const teachHint = document.getElementById("teach-hint")!;
const resultSheet = document.getElementById("result-sheet")!;
const resultTitle = document.getElementById("result-title")!;
const resultBody = document.getElementById("result-body")!;
const scoreGrid = document.getElementById("score-grid")!;
const scoreHelp = document.getElementById("score-help")!;
const confirmSheet = document.getElementById("confirm-sheet")!;

let game = new GoGame(9);
let playMode: PlayMode = "hotseat";
let boardSize = 9;
let humanColor: Color = BLACK;
let aiBusy = false;
let showCoords = false;
let toastTimer = 0;
let pendingConfirm: (() => void) | null = null;

let lessonIndex = 0;
let stepIndex = 0;
let lesson: Lesson = LESSONS[0];

const scene = new GoScene(canvas, {
  onIntersect: (x, y, kind) => handleIntersect(x, y, kind),
  onMiss: () => scene.hideHover(),
});
scene.rebuildBoard(boardSize);
scene.sync(game);
scene.start();

function toast(msg: string, ms = 1600): void {
  toastEl.textContent = msg;
  toastEl.classList.remove("hidden");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toastEl.classList.add("hidden"), ms);
}

function refreshHud(): void {
  capB.textContent = String(game.captures.black);
  capW.textContent = String(game.captures.white);
  turnDot.className = `stone-dot ${game.toPlay === BLACK ? "black" : "white"}`;

  if (game.over) {
    turnPill.classList.add("over");
    if (game.resigned) {
      turnLabel.textContent = `${colorName(game.winner as Color)} wins by resignation`;
    } else if (game.winner === 0) {
      turnLabel.textContent = "Jigo — draw";
    } else if (game.winner) {
      turnLabel.textContent = `${colorName(game.winner)} wins`;
    } else {
      turnLabel.textContent = "Game over";
    }
  } else if (game.scoring) {
    turnPill.classList.add("over");
    turnLabel.textContent = "Mark dead stones";
  } else {
    turnPill.classList.remove("over");
    const name = colorName(game.toPlay);
    if (playMode === "ai" && game.toPlay !== humanColor) turnLabel.textContent = "AI thinking…";
    else if (playMode === "teach") turnLabel.textContent = `${name} · Teach Me`;
    else turnLabel.textContent = `${name} to play`;
  }

  teachPanel.classList.toggle("hidden", playMode !== "teach");
}

function showResult(title: string, body: string, scoring = false): void {
  resultTitle.textContent = title;
  resultBody.textContent = body;
  scoreHelp.classList.toggle("hidden", !scoring);
  document.getElementById("btn-confirm-score")!.classList.toggle("hidden", !scoring);
  if (scoring) {
    const s = game.score();
    scoreGrid.innerHTML = `
      <div class="score-card">Black<br/><b>${s.blackTotal.toFixed(1)}</b>
        <small>terr ${s.blackTerritory} · cap ${s.blackCaptures}</small></div>
      <div class="score-card">White<br/><b>${s.whiteTotal.toFixed(1)}</b>
        <small>terr ${s.whiteTerritory} · cap ${s.whiteCaptures} · komi ${s.komi}</small></div>`;
  } else {
    scoreGrid.innerHTML = "";
  }
  resultSheet.classList.remove("hidden");
}

function hideResult(): void {
  resultSheet.classList.add("hidden");
}

function askConfirm(title: string, body: string, onYes: () => void): void {
  document.getElementById("confirm-title")!.textContent = title;
  document.getElementById("confirm-body")!.textContent = body;
  pendingConfirm = onYes;
  confirmSheet.classList.remove("hidden");
}

function newGame(size = boardSize): void {
  boardSize = size;
  game = new GoGame(size);
  humanColor = BLACK;
  aiBusy = false;
  hideResult();
  scene.rebuildBoard(size);
  scene.setHighlights([]);
  scene.sync(game);
  if (playMode === "teach") applyLessonStep();
  refreshHud();
}

function handleIntersect(x: number, y: number, kind: "hover" | "play"): void {
  if (kind === "hover") {
    if (game.over) {
      scene.hideHover();
      return;
    }
    if (game.scoring) {
      scene.setHover(x, y, game.board[game.idx(x, y)] !== 0);
      return;
    }
    if (playMode === "ai" && game.toPlay !== humanColor) {
      scene.hideHover();
      return;
    }
    scene.setHover(x, y, game.isLegal(game.idx(x, y)));
    return;
  }

  // play / tap
  if (game.scoring) {
    if (game.toggleDead(game.idx(x, y))) {
      scene.sync(game);
      showResult("Scoring", "Tap groups to mark them dead, then confirm.", true);
      refreshHud();
    }
    return;
  }

  if (game.over || aiBusy) return;
  if (playMode === "ai" && game.toPlay !== humanColor) return;

  if (playMode === "teach") {
    handleTeachPlay(x, y);
    return;
  }

  const result = game.play(x, y);
  if (!result) {
    toast("Illegal move");
    return;
  }
  scene.sync(game, result.captured);
  scene.hideHover();
  refreshHud();
  maybeAiTurn();
}

function handleTeachPlay(x: number, y: number): void {
  const step = lesson.steps[stepIndex];
  if (step.expect) {
    if (x === step.expect[0] && y === step.expect[1]) {
      const r = game.play(x, y);
      if (r) scene.sync(game, r.captured);
      teachHint.textContent = "Nice — that is the idea.";
      toast("Correct");
      refreshHud();
      window.setTimeout(() => nextStep(), 700);
    } else {
      teachHint.textContent = step.hint ?? "Try the highlighted intersection.";
      toast("Not that point");
    }
    return;
  }
  // free exploration — allow legal moves for feel
  const r = game.play(x, y);
  if (!r) toast("Illegal");
  else {
    scene.sync(game, r.captured);
    refreshHud();
  }
}

function maybeAiTurn(): void {
  if (playMode !== "ai" || game.over || game.scoring) return;
  if (game.toPlay === humanColor) return;
  aiBusy = true;
  refreshHud();
  window.setTimeout(() => {
    const move = pickAiMove(game);
    if (move === null) {
      game.pass();
      toast("AI passes");
      if (game.scoring) enterScoring();
    } else {
      const r = game.playIndex(move);
      if (r) scene.sync(game, r.captured);
    }
    aiBusy = false;
    refreshHud();
  }, 380 + Math.random() * 420);
}

function enterScoring(): void {
  scene.setHighlights([]);
  scene.sync(game);
  showResult("Scoring", "Both players passed. Mark dead groups, then confirm.", true);
  refreshHud();
}

function applyLessonStep(): void {
  lesson = LESSONS[lessonIndex];
  const step = lesson.steps[stepIndex];
  if (lesson.size !== boardSize) {
    boardSize = lesson.size;
    document.querySelectorAll<HTMLButtonElement>("#size-chips .chip").forEach((b) => {
      b.classList.toggle("active", Number(b.dataset.size) === boardSize);
    });
  }
  game = new GoGame(lesson.size);
  game.setPosition(step.stones ?? [], step.toPlay ?? BLACK);
  scene.rebuildBoard(lesson.size);
  scene.sync(game);
  scene.setHighlights(step.highlights ?? []);
  teachTitle.textContent = lesson.title;
  teachStep.textContent = `${stepIndex + 1} / ${lesson.steps.length}`;
  teachBody.textContent = step.text;
  teachHint.textContent = step.hint ?? "";
  renderLessonChips();
  refreshHud();
}

function renderLessonChips(): void {
  teachLessons.innerHTML = "";
  LESSONS.forEach((L, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = `chip${i === lessonIndex ? " active" : ""}`;
    b.textContent = L.title;
    b.addEventListener("click", () => {
      lessonIndex = i;
      stepIndex = 0;
      applyLessonStep();
    });
    teachLessons.appendChild(b);
  });
}

function nextStep(): void {
  if (stepIndex < lesson.steps.length - 1) {
    stepIndex++;
    applyLessonStep();
  } else if (lessonIndex < LESSONS.length - 1) {
    lessonIndex++;
    stepIndex = 0;
    applyLessonStep();
    toast(`Lesson: ${LESSONS[lessonIndex].title}`);
  } else {
    teachHint.textContent = "You finished the lessons — try a game vs AI!";
  }
}

function prevStep(): void {
  if (stepIndex > 0) {
    stepIndex--;
    applyLessonStep();
  } else if (lessonIndex > 0) {
    lessonIndex--;
    stepIndex = LESSONS[lessonIndex].steps.length - 1;
    applyLessonStep();
  }
}

// Mode chips
document.querySelectorAll<HTMLButtonElement>("#mode-chips .chip").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll("#mode-chips .chip").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    playMode = btn.dataset.mode as PlayMode;
    if (playMode === "teach") {
      lessonIndex = 0;
      stepIndex = 0;
      applyLessonStep();
    } else {
      scene.setHighlights([]);
      newGame(boardSize);
      if (playMode === "ai") maybeAiTurn();
    }
    refreshHud();
  });
});

document.querySelectorAll<HTMLButtonElement>("#size-chips .chip").forEach((btn) => {
  btn.addEventListener("click", () => {
    const size = Number(btn.dataset.size);
    if (size === boardSize && playMode !== "teach") return;
    document.querySelectorAll("#size-chips .chip").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    if (playMode === "teach") {
      toast("Lessons use 9×9 — switch to Hotseat or AI for other sizes");
      btn.classList.remove("active");
      document.querySelector<HTMLButtonElement>(`#size-chips [data-size="${boardSize}"]`)?.classList.add("active");
      return;
    }
    newGame(size);
  });
});

document.querySelectorAll<HTMLButtonElement>("#camera-chips .chip[data-cam]").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll("#camera-chips .chip[data-cam]").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    scene.setCamera(btn.dataset.cam as CameraMode);
  });
});

document.getElementById("btn-reset-cam")!.addEventListener("click", () => scene.resetCamera());

document.getElementById("btn-pass")!.addEventListener("click", () => {
  if (playMode === "teach") {
    toast("Use Next in Teach Me");
    return;
  }
  if (game.over || game.scoring || aiBusy) return;
  if (playMode === "ai" && game.toPlay !== humanColor) return;
  const r = game.pass();
  if (!r) return;
  scene.sync(game);
  toast(`${colorName(r.color)} passes`);
  if (r.ended) enterScoring();
  else {
    refreshHud();
    maybeAiTurn();
  }
});

document.getElementById("btn-resign")!.addEventListener("click", () => {
  if (playMode === "teach") return;
  if (game.over || game.scoring) return;
  askConfirm("Resign?", `${colorName(game.toPlay)} resigns the game.`, () => {
    const r = game.resign();
    if (!r) return;
    scene.sync(game);
    refreshHud();
    showResult("Resignation", `${colorName(r.color)} resigns. ${colorName(game.winner as Color)} wins.`);
  });
});

document.getElementById("btn-undo")!.addEventListener("click", () => {
  if (!game.canUndo()) {
    toast("Nothing to undo");
    return;
  }
  // In AI mode undo twice when possible so human stays to play
  game.undo();
  if (playMode === "ai" && game.canUndo() && game.toPlay !== humanColor) game.undo();
  if (playMode === "ai" && game.canUndo() && game.toPlay !== humanColor) game.undo();
  scene.sync(game);
  hideResult();
  if (playMode === "teach") scene.setHighlights(lesson.steps[stepIndex].highlights ?? []);
  else scene.setHighlights([]);
  refreshHud();
});

document.getElementById("btn-new")!.addEventListener("click", () => {
  askConfirm("New game?", "Clear the board and start over.", () => {
    if (playMode === "teach") {
      stepIndex = 0;
      applyLessonStep();
    } else newGame(boardSize);
  });
});

document.getElementById("btn-coords")!.addEventListener("click", () => {
  showCoords = !showCoords;
  scene.setCoordinates(showCoords);
  const b = document.getElementById("btn-coords")!;
  b.setAttribute("aria-pressed", String(showCoords));
  b.classList.toggle("primary", showCoords);
});

document.getElementById("btn-teach-next")!.addEventListener("click", () => nextStep());
document.getElementById("btn-teach-prev")!.addEventListener("click", () => prevStep());

document.getElementById("btn-confirm-score")!.addEventListener("click", () => {
  const s = game.finishScoring();
  scene.sync(game);
  refreshHud();
  const winner =
    s.winner === 0 ? "Jigo (draw)." : `${colorName(s.winner)} wins by ${Math.abs(s.blackTotal - s.whiteTotal).toFixed(1)} points.`;
  showResult("Final score", winner, true);
  document.getElementById("btn-confirm-score")!.classList.add("hidden");
  scoreHelp.classList.add("hidden");
});

document.getElementById("btn-result-new")!.addEventListener("click", () => {
  hideResult();
  newGame(boardSize);
});

document.getElementById("btn-confirm-yes")!.addEventListener("click", () => {
  confirmSheet.classList.add("hidden");
  pendingConfirm?.();
  pendingConfirm = null;
});
document.getElementById("btn-confirm-no")!.addEventListener("click", () => {
  confirmSheet.classList.add("hidden");
  pendingConfirm = null;
});

refreshHud();
renderLessonChips();

