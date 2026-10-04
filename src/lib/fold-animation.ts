import type { Step } from "./types";

/**
 * Which paper motion to animate for a step.
 *
 * The animation is deterministic — a small CSS paper-fold primitive chosen by
 * keyword — never a generated asset. A wrong-looking animation is worse than a
 * simple one, so every step maps onto a motion we can draw with confidence.
 */
export type FoldKind =
  | "half"
  | "diagonal"
  | "corner"
  | "collapse"
  | "flip"
  | "open"
  | "press";

export interface FoldDemo {
  kind: FoldKind;
  /** What the motion shows, in the user's words. */
  caption: string;
  /** The crease line drawn on the sheet for this motion. */
  crease: "horizontal" | "vertical" | "diagonal" | "none";
}

/** A whole-sheet turn. Only trusted when the step's own title says so. */
const FLIP = /\b(turn(ing)?\s+(it|the\s+\w+)?\s*over|turn\s+over|flip)\b/;

const RULES: Array<{ kind: FoldKind; test: RegExp }> = [
  // Structural folds first: instructions often bury a "turn it over" inside a
  // longer folding sentence, and animating that turn would teach the wrong move.
  { kind: "collapse", test: /\b(collapse|squash|petal fold|reverse[- ]fold|zigzag)\b/ },
  { kind: "half", test: /\b(in half|halfway|lengthwise|horizontally|vertically)\b/ },
  { kind: "corner", test: /\b(corner|edge|flap|tip|point)s?\b[^.]*\b(center|centre|middle|inward|inside|into|meet)\b/ },
  { kind: "corner", test: /\b(to the center|to the centre|to the middle|inward|into its center|into the center)\b/ },
  { kind: "diagonal", test: /\b(diagonal|diagonally|corner[- ]to[- ]corner|triangle|crease the diagonals)\b/ },
  { kind: "press", test: /\b(crease|press|flatten|smooth|rub|firmly)\b/ },
  // "open" last: instructions mention opening a crease in passing far more
  // often than they ask the user to open the model out as the main move.
  { kind: "open", test: /\b(open|opens|opening|pull|unwrap|release|pockets?|apart|spread)\b/ },
];

const META: Record<FoldKind, Omit<FoldDemo, "kind">> = {
  half: {
    caption: "Fold one edge all the way over and press the crease flat.",
    crease: "vertical",
  },
  diagonal: {
    caption: "Bring two opposite corners together and fold across the diagonal.",
    crease: "diagonal",
  },
  corner: {
    caption: "Carry the corner inward until its edge reaches the centre.",
    crease: "none",
  },
  collapse: {
    caption: "Push both sides inward at once so the layer collapses flat.",
    crease: "vertical",
  },
  flip: {
    caption: "Turn the whole model over and lay it back down flat.",
    crease: "none",
  },
  open: {
    caption: "Ease the folds open and pull the flaps out to shape it.",
    crease: "vertical",
  },
  press: {
    caption: "Fold it over, press the crease firmly, then open it flat again.",
    crease: "horizontal",
  },
};

/** Pick the paper motion that best matches a step's wording. */
export function foldDemoFor(step: Step): FoldDemo {
  const title = step.title.toLowerCase();
  const body = step.instruction.toLowerCase();

  // "Turn the square over" is an instruction in its own right — that step is
  // about the turn, so the title wins outright. Otherwise the title is the
  // shortest description of the move, so it is consulted before the body.
  const kind: FoldKind = FLIP.test(title)
    ? "flip"
    : (RULES.find((rule) => rule.test.test(title))?.kind ??
      RULES.find((rule) => rule.test.test(body))?.kind ??
      (FLIP.test(body) ? "flip" : "half"));

  return { kind, ...META[kind] };
}
