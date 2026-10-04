import sys, os, unittest
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import server as S

TUT = """How to Replace a Bike Tire Tube
You will need a new tube, tire levers and a pump.
Warning: deflate the tire fully before you start. Never use a sharp tool to pry the tire.
1. Flip the bike over and remove the wheel.
2. Use the tire levers to lift one side of the tire off the rim.
3. Pull out the old tube and check the inside of the tire for thorns.
4. Put a little air in the new tube and tuck it into the tire.
5. Press the tire back onto the rim, then inflate to the pressure printed on the sidewall.
"""

class Core(unittest.TestCase):
    def test_numbered_steps(self):
        r = S.heuristic_steps("bike", TUT); self.assertEqual(len(r["steps"]), 5); self.assertIn("numbered", r["method"])
    def test_warning_extraction(self):
        r = S.heuristic_steps("bike", TUT); self.assertTrue(any("deflate" in w.lower() or "sharp" in w.lower() for w in r["warnings"]))
    def test_grounding_flags_invented_step(self):
        steps = [{"title": "t", "detail": "Flip the bike over and remove the wheel."}, {"title": "t", "detail": "Spray the frame with gold paint and sing loudly."}]
        g = S.ground(steps, TUT)
        self.assertTrue(steps[0]["grounded"]); self.assertFalse(steps[1]["grounded"]); self.assertEqual(g["grounded_steps"], 1)
    def test_retrieval_finds_right_passage(self):
        top = S.retrieve("how do I check for thorns in the tire", TUT, 1)[0][1]; self.assertIn("thorns", top)
    def test_ask_without_ai_is_labelled_and_cited(self):
        S.LLM_URL = ""; a = S.ask("what pressure should I inflate to", "inflate", TUT)
        self.assertFalse(a["ai"]); self.assertTrue(a["citations"]); self.assertIn("sidewall", " ".join(a["citations"]))
    def test_ask_unrelated_does_not_hallucinate(self):
        S.LLM_URL = ""; a = S.ask("quantum chromodynamics lagrangian", "x", TUT); self.assertEqual(a["citations"], [])
    def test_abstains_when_source_silent(self):
        S.LLM_URL = ""; a = S.ask("what if my tire is made of titanium", "x", TUT)
        self.assertTrue(a["abstained"]); self.assertEqual(a["citations"], [])
    def test_citations_not_overlapping(self):
        S.LLM_URL = ""; a = S.ask("how do I remove the old tube from the tire", "x", TUT)
        c = a["citations"]; self.assertEqual(len(c), len(set(c)))
    def test_junk_wall_rejected(self):
        with self.assertRaises(ValueError): S.heuristic_steps("x", "JavaScript is disabled in your browser. Please enable JavaScript to proceed.")
    def test_relevance_rejects_offtopic(self):
        r = {"title": "Paper money", "source_url": "https://x/paper", "source_text": "The paper company sells paper."}
        self.assertLess(S.relevance("origami crane", r), 0.6)
    def test_quality_zero_when_offtopic(self):
        r = {"relevance": 0.3, "steps": [1] * 5, "method": "numbered", "grounding_summary": {"rate": 1}}; self.assertEqual(S.quality(r), 0.0)
    def test_presets_have_valid_fold_geometry(self):
        import json, re
        js = open(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "static", "presets.js")).read()
        self.assertGreaterEqual(js.count("title:"), 20)
if __name__ == "__main__": unittest.main(verbosity=2)
