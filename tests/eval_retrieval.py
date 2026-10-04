"""Small offline eval of question grounding on saved real pages. Each case: question, keyword that the correct passage must contain.
This is a 10-case sanity benchmark written by the builder, NOT an independent benchmark."""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import server as S
D = lambda n: json.load(open(os.path.join(os.path.dirname(__file__), "fixtures", n + ".json")))["text"]
CASES = [("airplane", "what size paper should I use", "letter"), ("airplane", "how do I make the paper stay folded", "fingernail"),
 ("airplane", "which way should the crease point", "toward you"), ("airplane", "how do I throw it", "throw"),
 ("airplane", "can I use colored paper", "construction paper"), ("airplane", "how do I make the wings", "wing"),
 ("crane", "what kind of paper do I need", "square"), ("crane", "what do I do with the accordion fold", "accordion"),
 ("crane", "how do I make the head", "head"), ("crane", "what is the first fold", "diagonal")]
hit1 = hit3 = 0
for doc, q, kw in CASES:
    r = S.retrieve(q, D(doc), 3); top = [c.lower() for _, c in r]
    h1 = bool(top) and kw in top[0]; h3 = any(kw in c for c in top); hit1 += h1; hit3 += h3
    print(("HIT1 " if h1 else "HIT3 " if h3 else "MISS ") + doc + ": " + q)
print("top1 %d/%d, top3 %d/%d" % (hit1, len(CASES), hit3, len(CASES)))
NEG = [("airplane", "how do I replace a bicycle tire"), ("airplane", "what if my paper is too thick"), ("crane", "what voltage does it need"), ("crane", "how long should I bake it")]
ab = sum(1 for d, q in NEG if S.ask(q, "", D(d))["abstained"]); print("abstained correctly on off-source questions: %d/%d" % (ab, len(NEG)))
