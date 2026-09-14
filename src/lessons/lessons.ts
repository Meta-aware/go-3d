import { BLACK, WHITE, type Color } from "../engine/go";

export interface LessonStone {
  x: number;
  y: number;
  color: Color;
}

export interface Highlight {
  x: number;
  y: number;
  tone: "hint" | "hot" | "good" | "bad";
}

export interface LessonStep {
  text: string;
  stones?: LessonStone[];
  highlights?: Highlight[];
  toPlay?: Color;
  /** If set, the student should play this intersection. */
  expect?: [number, number];
  hint?: string;
}

export interface Lesson {
  id: string;
  title: string;
  blurb: string;
  size: number;
  steps: LessonStep[];
}

export const LESSONS: Lesson[] = [
  {
    id: "liberties",
    title: "Liberties",
    blurb: "Empty points next to a stone keep it alive.",
    size: 9,
    steps: [
      {
        text: "Every stone needs liberties — empty intersections directly up, down, left, or right. Diagonals do not count.",
        stones: [{ x: 4, y: 4, color: BLACK }],
        highlights: [
          { x: 4, y: 3, tone: "hint" },
          { x: 4, y: 5, tone: "hint" },
          { x: 3, y: 4, tone: "hint" },
          { x: 5, y: 4, tone: "hint" },
        ],
      },
      {
        text: "This black stone still has three liberties. White has taken one. Play on a remaining liberty to reduce it further.",
        stones: [
          { x: 4, y: 4, color: BLACK },
          { x: 4, y: 3, color: WHITE },
        ],
        highlights: [
          { x: 4, y: 5, tone: "hot" },
          { x: 3, y: 4, tone: "hint" },
          { x: 5, y: 4, tone: "hint" },
        ],
        toPlay: WHITE,
        expect: [4, 5],
        hint: "Tap a glowing point next to the black stone.",
      },
      {
        text: "A stone on the edge starts with only three liberties. In the corner it has two. Edge play is tight.",
        stones: [
          { x: 4, y: 0, color: BLACK },
          { x: 0, y: 8, color: WHITE },
        ],
        highlights: [
          { x: 3, y: 0, tone: "hint" },
          { x: 5, y: 0, tone: "hint" },
          { x: 4, y: 1, tone: "hint" },
          { x: 0, y: 7, tone: "good" },
          { x: 1, y: 8, tone: "good" },
        ],
      },
    ],
  },
  {
    id: "capture",
    title: "Capture",
    blurb: "Fill the last liberty to take a stone off the board.",
    size: 9,
    steps: [
      {
        text: "This white stone has one liberty left. Occupying that point captures it — the stone is removed and added to Black's prisoners.",
        stones: [
          { x: 2, y: 2, color: WHITE },
          { x: 2, y: 1, color: BLACK },
          { x: 1, y: 2, color: BLACK },
          { x: 3, y: 2, color: BLACK },
        ],
        highlights: [{ x: 2, y: 3, tone: "hot" }],
        toPlay: BLACK,
        expect: [2, 3],
        hint: "Play on the highlighted liberty to capture.",
      },
      {
        text: "Groups share liberties. This chain of two still has one breath. Capture the whole group at once.",
        stones: [
          { x: 4, y: 4, color: WHITE },
          { x: 5, y: 4, color: WHITE },
          { x: 4, y: 3, color: BLACK },
          { x: 5, y: 3, color: BLACK },
          { x: 4, y: 5, color: BLACK },
          { x: 5, y: 5, color: BLACK },
          { x: 3, y: 4, color: BLACK },
        ],
        highlights: [{ x: 6, y: 4, tone: "hot" }],
        toPlay: BLACK,
        expect: [6, 4],
        hint: "The last liberty is on the right of the white chain.",
      },
      {
        text: "Suicide is illegal — you may not play a stone that would have zero liberties — unless that play captures, which gives it breathing room. Capturing recaptures are legal.",
        stones: [
          { x: 2, y: 4, color: WHITE },
          { x: 3, y: 3, color: WHITE },
          { x: 3, y: 5, color: WHITE },
          { x: 4, y: 4, color: BLACK },
        ],
        highlights: [{ x: 3, y: 4, tone: "bad" }],
      },
    ],
  },
  {
    id: "atari",
    title: "Atari",
    blurb: "A group with one liberty is in atari.",
    size: 9,
    steps: [
      {
        text: "Atari means “one liberty left.” White is in atari. Black can capture next, or White can run by playing the liberty first.",
        stones: [
          { x: 3, y: 4, color: WHITE },
          { x: 3, y: 3, color: BLACK },
          { x: 2, y: 4, color: BLACK },
          { x: 4, y: 4, color: BLACK },
        ],
        highlights: [{ x: 3, y: 5, tone: "hot" }],
      },
      {
        text: "You are White. Extend out of atari — play the last liberty to gain more room.",
        stones: [
          { x: 3, y: 4, color: WHITE },
          { x: 3, y: 3, color: BLACK },
          { x: 2, y: 4, color: BLACK },
          { x: 4, y: 4, color: BLACK },
        ],
        highlights: [{ x: 3, y: 5, tone: "good" }],
        toPlay: WHITE,
        expect: [3, 5],
        hint: "Play the highlighted point to escape atari.",
      },
      {
        text: "After extending, White has more liberties. Chasing a running group is a fight — count liberties before you commit.",
        stones: [
          { x: 3, y: 4, color: WHITE },
          { x: 3, y: 5, color: WHITE },
          { x: 3, y: 3, color: BLACK },
          { x: 2, y: 4, color: BLACK },
          { x: 4, y: 4, color: BLACK },
        ],
        highlights: [
          { x: 2, y: 5, tone: "hint" },
          { x: 3, y: 6, tone: "hint" },
          { x: 4, y: 5, tone: "hint" },
        ],
      },
    ],
  },
  {
    id: "eyes",
    title: "Eyes",
    blurb: "Two true eyes make a group unconditionally alive.",
    size: 9,
    steps: [
      {
        text: "An eye is an empty point (or small space) inside a group. This black group has one eye. White can eventually throw in and capture it.",
        stones: [
          { x: 2, y: 2, color: BLACK },
          { x: 3, y: 2, color: BLACK },
          { x: 4, y: 2, color: BLACK },
          { x: 2, y: 3, color: BLACK },
          { x: 4, y: 3, color: BLACK },
          { x: 2, y: 4, color: BLACK },
          { x: 3, y: 4, color: BLACK },
          { x: 4, y: 4, color: BLACK },
          { x: 1, y: 2, color: WHITE },
          { x: 1, y: 3, color: WHITE },
          { x: 1, y: 4, color: WHITE },
          { x: 2, y: 1, color: WHITE },
          { x: 3, y: 1, color: WHITE },
          { x: 4, y: 1, color: WHITE },
          { x: 5, y: 2, color: WHITE },
          { x: 5, y: 3, color: WHITE },
          { x: 5, y: 4, color: WHITE },
          { x: 2, y: 5, color: WHITE },
          { x: 3, y: 5, color: WHITE },
          { x: 4, y: 5, color: WHITE },
        ],
        highlights: [{ x: 3, y: 3, tone: "hint" }],
      },
      {
        text: "Two separate eyes cannot both be filled: playing inside either eye is suicide while the other eye still gives a liberty. This group is alive.",
        stones: [
          { x: 2, y: 2, color: BLACK },
          { x: 3, y: 2, color: BLACK },
          { x: 4, y: 2, color: BLACK },
          { x: 5, y: 2, color: BLACK },
          { x: 2, y: 3, color: BLACK },
          { x: 5, y: 3, color: BLACK },
          { x: 2, y: 4, color: BLACK },
          { x: 3, y: 4, color: BLACK },
          { x: 4, y: 4, color: BLACK },
          { x: 5, y: 4, color: BLACK },
        ],
        highlights: [
          { x: 3, y: 3, tone: "good" },
          { x: 4, y: 3, tone: "good" },
        ],
      },
      {
        text: "Try to play inside an eye. The engine will reject it — suicide, and it does not capture. Alive groups can be left alone at the end of the game.",
        stones: [
          { x: 2, y: 2, color: BLACK },
          { x: 3, y: 2, color: BLACK },
          { x: 4, y: 2, color: BLACK },
          { x: 5, y: 2, color: BLACK },
          { x: 2, y: 3, color: BLACK },
          { x: 5, y: 3, color: BLACK },
          { x: 2, y: 4, color: BLACK },
          { x: 3, y: 4, color: BLACK },
          { x: 4, y: 4, color: BLACK },
          { x: 5, y: 4, color: BLACK },
        ],
        highlights: [
          { x: 3, y: 3, tone: "bad" },
          { x: 4, y: 3, tone: "bad" },
        ],
        toPlay: WHITE,
        hint: "Tap an eye — the move is illegal. Then tap Next.",
      },
    ],
  },
];
