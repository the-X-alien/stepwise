import type { Guide, Step } from "./types";

type PaperStep = Pick<Step, "title" | "instruction" | "verifyHint"> & {
  estSeconds?: number;
};

function paperGuide(id: string, title: string, summary: string, steps: PaperStep[]): Guide {
  return {
    id: `paper-${id}`,
    title,
    summary,
    warnings: [{
      id: "paper-safety",
      severity: "caution",
      text: "Use a flat surface and make each crease slowly. These are paper-craft instructions; no sharp tools are needed.",
    }],
    tools: ["one square sheet of paper"],
    source: { kind: "demo", ref: "Step by Step paper-folding starter guide" },
    createdAt: "2026-10-03T00:00:00.000Z",
    steps: steps.map((step, index) => ({
      index: index + 1,
      title: step.title,
      instruction: step.instruction,
      warnings: [],
      tools: index === 0 ? ["one square sheet of paper"] : [],
      estSeconds: step.estSeconds ?? 35,
      sourceQuote: step.instruction,
      verifyHint: step.verifyHint,
    })),
  };
}

export const PAPER_GUIDES: Guide[] = [
  paperGuide("crane", "Fold an origami crane", "A classic crane, broken into eight small folds.", [
    { title: "Make a square base", instruction: "Place the paper colored-side down. Fold it diagonally both ways, open it, then turn it over and fold it in half horizontally and vertically. Open it and collapse the creases into a square with the open corners at the bottom.", verifyHint: "Show the small square base with its open flaps pointing down." },
    { title: "Fold the lower edges inward", instruction: "With the open point at the bottom, fold the left and right lower edges to the center line. Crease sharply, then unfold.", verifyHint: "Show two diagonal crease lines meeting at the center." },
    { title: "Make the petal fold", instruction: "Lift the bottom point upward. Let the pre-creased side edges fold inward along the creases, making a tall diamond. Flatten it.", verifyHint: "Show a narrow diamond with a long point at the top." },
    { title: "Repeat on the other side", instruction: "Turn the model over and repeat the lower-edge folds and petal fold on the back layer.", verifyHint: "Show a slim diamond shape on both sides." },
    { title: "Fold the legs inward", instruction: "Fold the lower left and lower right edges of the top layer to the center line. Turn over and repeat on the other side.", verifyHint: "Show two narrow lower flaps folded toward the middle." },
    { title: "Form the neck and tail", instruction: "Lift one thin lower flap and reverse-fold it upward inside the layers to make the neck. Repeat with the other flap for the tail.", verifyHint: "Show two slim points rising from the body." },
    { title: "Shape the head", instruction: "Reverse-fold the tip of the neck downward to make a small beak.", verifyHint: "Show a short beak folded down at the end of the neck." },
    { title: "Open the wings", instruction: "Gently pull the wings outward and flatten the body just enough for the crane to hold its shape.", verifyHint: "Show two open wings and the finished crane silhouette." },
  ]),
  paperGuide("frog", "Fold a jumping paper frog", "A springy frog with a back that pops when you press it.", [
    { title: "Make a square sheet", instruction: "If your paper is rectangular, fold one corner diagonally to the opposite edge, crease it, and trim or fold away the extra strip to leave a square.", verifyHint: "Show one square sheet with a diagonal crease." },
    { title: "Crease the diagonals", instruction: "Fold the square corner-to-corner in both directions, opening it after each fold. The two creases should make an X.", verifyHint: "Show the X-shaped diagonal creases." },
    { title: "Collapse the top into a triangle", instruction: "Push the left and right sides toward the center so the top half collapses into a flat triangle. Keep the lower half flat underneath.", verifyHint: "Show a triangle flap on top of a rectangular lower half." },
    { title: "Fold the front corners into feet", instruction: "Fold each bottom corner of the top triangle upward toward its point, making two front legs. Crease both folds.", verifyHint: "Show two small triangular front legs pointing up." },
    { title: "Fold the lower sides to the middle", instruction: "On the rectangular bottom half, fold the left and right edges inward until they meet at the center line.", verifyHint: "Show a narrow rectangle with both sides meeting in the middle." },
    { title: "Fold the bottom up", instruction: "Fold the bottom edge upward to meet the base of the front legs, then crease it firmly.", verifyHint: "Show the bottom edge folded up under the front legs." },
    { title: "Make the spring", instruction: "Fold the new bottom edge back down about halfway, making a zigzag spring crease. Flatten the fold firmly, then release it.", verifyHint: "Show a short accordion-like fold at the frog's back." },
    { title: "Turn over and test", instruction: "Turn the frog over. Press and release the folded spring at its back to make it hop.", verifyHint: "Show the frog upright with the spring fold underneath." },
  ]),
  paperGuide("boat", "Fold a paper boat", "A classic paper boat from one rectangular sheet.", [
    { title: "Fold the paper in half", instruction: "Place a rectangular sheet upright and fold the top edge down to meet the bottom edge. Crease across the middle.", verifyHint: "Show a flat rectangle folded in half with the crease across its center." },
    { title: "Fold the top corners inward", instruction: "With the folded edge at the top, fold both top corners down toward the center line so they meet and form a triangle.", verifyHint: "Show a peaked triangle above two rectangular flaps." },
    { title: "Fold the bottom flaps up", instruction: "Fold the front bottom flap upward over the triangle. Turn the model over and fold the other flap upward too.", verifyHint: "Show a triangle with a narrow strip folded across its base." },
    { title: "Open into a square", instruction: "Open the model from the bottom and bring the two ends toward each other. Flatten it into a diamond shape.", verifyHint: "Show a diamond with an opening at the top point." },
    { title: "Fold the points upward", instruction: "Take the bottom point of the top layer and fold it up to the top point. Turn over and repeat with the other bottom point.", verifyHint: "Show a smaller triangle with a clear top opening." },
    { title: "Open and shape the boat", instruction: "Open the bottom again, bring the ends together, and gently pull the top corners apart to form the boat. Flatten its bottom so it can stand.", verifyHint: "Show the finished boat with its two pointed ends and open center." },
  ]),
  paperGuide("airplane", "Fold a paper airplane", "A balanced dart-style plane with matching wings.", [
    { title: "Fold the sheet lengthwise", instruction: "Place a rectangular sheet upright. Bring the long edges together, crease the center, then open it flat again.", verifyHint: "Show one straight center crease from top to bottom." },
    { title: "Make the nose point", instruction: "Fold the top left corner to the center line. Fold the top right corner to the center line so the edges meet neatly.", verifyHint: "Show a pointed top and two folded edges meeting at the center." },
    { title: "Fold the point inward", instruction: "Fold the pointed tip down toward the bottom, stopping before the lower edge so the nose is blunt and the corner flaps are held in place.", verifyHint: "Show a short flat nose flap covering the two corner folds." },
    { title: "Fold new top corners", instruction: "Fold the new top left and top right corners toward the center line, leaving a small triangle of the lower flap visible beneath them.", verifyHint: "Show two diagonal flaps meeting near the center, with a small tab visible." },
    { title: "Lock the center tab", instruction: "Fold the small exposed tab upward over the two flaps to hold them in place. Then fold the plane in half along the original center crease.", verifyHint: "Show the plane folded in half with the tab locked inside." },
    { title: "Fold the first wing", instruction: "Fold one top edge down so it lines up with the bottom edge of the body, forming a long wing. Crease firmly.", verifyHint: "Show one wing folded down along the body." },
    { title: "Match the second wing", instruction: "Turn the plane over and fold the other wing to match the first. Open both wings to the same angle and keep the nose straight.", verifyHint: "Show two symmetric wings and a straight center body." },
  ]),
  paperGuide("fortune-teller", "Fold a paper fortune teller", "The childhood cootie-catcher game, ready to customize.", [
    { title: "Start with a square", instruction: "Place a square sheet flat. Fold it diagonally corner-to-corner in both directions, opening after each fold.", verifyHint: "Show an X of creases across the square." },
    { title: "Fold all corners to the center", instruction: "Bring each of the four corners to the exact center point and crease each small triangle flat.", verifyHint: "Show a smaller square with all four corners folded to its middle." },
    { title: "Turn the square over", instruction: "Flip the model over so the folded flaps face the table and the smooth side is facing you.", verifyHint: "Show the smooth side of the smaller square." },
    { title: "Fold the new corners inward", instruction: "Fold each of the four corners of this smaller square into its center. Crease them all flat.", verifyHint: "Show an even smaller square made from four folded corners." },
    { title: "Fold the square in half", instruction: "Fold the small square in half horizontally, crease it, and open it again. Fold it in half vertically and open it again.", verifyHint: "Show two crossing creases on the small square." },
    { title: "Open the pockets", instruction: "Turn the model over. Slide a thumb and finger from each hand under the four outer flaps.", verifyHint: "Show four pockets lifted away from the back." },
    { title: "Shape the fortune teller", instruction: "Push the four pockets toward the center and bring the corners together until the fortune teller opens into four flaps.", verifyHint: "Show four pocket flaps that can open and close." },
    { title: "Add the game", instruction: "Write four colors on the outside and numbers or fortunes inside each flap. Spell a color by opening it in alternating directions.", verifyHint: "Show the outside labels and numbered inner flaps." },
  ]),
  paperGuide("heart", "Fold a simple paper heart", "A symmetrical heart from one square sheet.", [
    { title: "Fold the square in half", instruction: "Place the paper colored-side down. Fold it in half horizontally and crease, then open it flat again.", verifyHint: "Show a horizontal crease through the middle of the square." },
    { title: "Bring the top edge to the center", instruction: "Fold the top edge down until it lines up exactly with the center crease.", verifyHint: "Show a narrow top flap ending at the center line." },
    { title: "Fold the bottom corners upward", instruction: "Fold the lower left corner upward toward the center so its edge meets the vertical center. Repeat on the lower right corner.", verifyHint: "Show a point at the bottom with matching left and right folds." },
    { title: "Fold the left top corner", instruction: "Fold the top left corner down and inward to soften the heart's top-left edge.", verifyHint: "Show the top-left corner folded back from the point." },
    { title: "Fold the right top corner", instruction: "Fold the top right corner down and inward to match the left side as closely as possible.", verifyHint: "Show two matching rounded top corners." },
    { title: "Round the side corners", instruction: "Fold the small left and right side tips slightly toward the back to make a smoother heart outline.", verifyHint: "Show the side tips tucked back with a heart-shaped outline." },
    { title: "Turn over and flatten", instruction: "Turn the model over and press each crease flat. Adjust the two top curves so they are symmetric.", verifyHint: "Show the finished heart from the front." },
  ]),
];

export function getPaperGuide(id: string): Guide | null {
  return PAPER_GUIDES.find((guide) => guide.id === id) ?? null;
}
