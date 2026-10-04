#!/usr/bin/env python3
"""Step by Step backend. Local only. Search (DuckDuckGo), page/YouTube extraction, optional LLM.
LLM is optional and uses YOUR OWN key via env vars (never typed into chat):
  STEPWISE_LLM_BASE_URL (e.g. http://localhost:8080/v1)  STEPWISE_LLM_KEY  STEPWISE_LLM_MODEL
Any OpenAI-compatible endpoint works. Use a provider whose terms allow your age.
"""
import json, os, re, sys, urllib.parse, http.server
import requests
from bs4 import BeautifulSoup

UA = {"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) Step by Step/0.1"}
BASE = getattr(sys, "_MEIPASS", None) or os.path.dirname(os.path.abspath(__file__))  # _MEIPASS when frozen by PyInstaller
ROOT = os.path.join(BASE, "static")
LLM_URL = os.environ.get("STEPWISE_LLM_BASE_URL", "").rstrip("/")
LLM_KEY = os.environ.get("STEPWISE_LLM_KEY", "")
LLM_MODEL = os.environ.get("STEPWISE_LLM_MODEL", "")
AI_BUILD = os.environ.get("STEPWISE_AI_BUILD", "") == "1"  # AI step-building is opt-in; a connected model otherwise only answers questions (rule/markup extraction stays the default, no long waits)
LLM_TIMEOUT = int(os.environ.get("STEPWISE_LLM_TIMEOUT", "120"))      # seconds; raise for slow local models
LLM_MAX_TOKENS = int(os.environ.get("STEPWISE_LLM_MAX_TOKENS", "900"))  # reply budget for the step-building call
LLM_TEXT_CHARS = int(os.environ.get("STEPWISE_LLM_TEXT_CHARS", "6000"))  # source characters sent; lower for small context windows
WARN_RE = re.compile(r"\b(warning|caution|danger|careful|sharp|hot|burn|unplug|electric|shock|wear (?:gloves|goggles|eye)|flammable|poison|never|do not|don't)\b", re.I)

def ddg_search(q, n=8):
    r=_ddg(q,n)
    return r if r else bing_search(q,n)

def bing_search(q, n=8):
    """Fallback when DuckDuckGo shows its bot challenge."""
    import base64
    h=requests.get("https://www.bing.com/search",params={"q":q,"setlang":"en","mkt":"en-US","cc":"US"},headers=UA,timeout=15).text
    out=[]
    for li in BeautifulSoup(h,"html.parser").select("li.b_algo"):
        a=li.select_one("h2 a")
        if not a: continue
        url=a.get("href","")
        m=re.search(r"[?&]u=a1([^&]+)",url)
        if m:
            b=m.group(1); b+="="*(-len(b)%4)
            try: url=base64.urlsafe_b64decode(b).decode()
            except Exception: continue
        p=li.select_one("p")
        out.append({"title":a.get_text(" ",strip=True),"url":url,"snippet":p.get_text(" ",strip=True) if p else "","engine":"bing"})
        if len(out)>=n: break
    return out

def _ddg(q, n=8):
    r = requests.get("https://html.duckduckgo.com/html/", params={"q": q}, headers=UA, timeout=15)
    soup = BeautifulSoup(r.text, "html.parser")
    out = []
    for a in soup.select("a.result__a"):
        href = a.get("href", "")
        m = re.search(r"uddg=([^&]+)", href)
        url = urllib.parse.unquote(m.group(1)) if m else href
        sn = a.find_parent(class_="result")
        snippet = sn.select_one(".result__snippet").get_text(" ", strip=True) if sn and sn.select_one(".result__snippet") else ""
        out.append({"title": a.get_text(" ", strip=True), "url": url, "snippet": snippet})
        if len(out) >= n: break
    return out

def youtube_text(url):
    """Best effort: title, description and captions if the video has them."""
    html = requests.get(url, headers=UA, timeout=15).text
    title = re.search(r"<title>(.*?)</title>", html, re.S)
    title = re.sub(r"\s*- YouTube$", "", title.group(1)).strip() if title else url
    desc = re.search(r'"shortDescription":"(.*?)(?<!\\)"', html)
    desc = json.loads('"' + desc.group(1) + '"') if desc else ""
    caps = ""
    m = re.search(r'"captionTracks":(\[.*?\])', html)
    if m:
        try:
            tracks = json.loads(m.group(1))
            t = next((t for t in tracks if t.get("languageCode", "").startswith("en")), tracks[0])
            xml = requests.get(t["baseUrl"], headers=UA, timeout=15).text
            caps = " ".join(BeautifulSoup(xml, "html.parser").stripped_strings)
        except Exception:
            caps = ""
    return {"title": title, "text": (desc + "\n" + caps).strip(), "has_captions": bool(caps), "source": "youtube"}

def tidy_step(tx, name=None):
    tx=re.sub(r"\[\d+\]","",tx).strip()
    tip=None
    m=re.search(r"(?:^|\.)\s*(Tip|Warning|Note|Caution)\s*:\s*(.*)$",tx,re.S)
    if m and m.start()>0: tip=(m.group(1),m.group(2).strip()); tx=tx[:m.start()].rstrip()+("." if not tx[:m.start()].rstrip().endswith(".") else "")
    parts=re.split(r"(?<=[.!?])\s+",tx,1)
    title=(name or parts[0])[:110]
    detail=parts[1] if len(parts)>1 and not name else (tx if name else "")
    out={"title":title,"detail":detail or title}
    if tip: out["tip"]=tip[0]+": "+tip[1]
    return out

def jsonld_howto(html):
    """Structured steps from schema.org HowTo / Recipe markup when the page has it (most reliable source)."""
    out=None
    for m in re.finditer(r'<script[^>]+application/ld\+json[^>]*>(.*?)</script>',html,re.S|re.I):
        try: data=json.loads(m.group(1))
        except Exception: continue
        stack=[data]
        while stack:
            d=stack.pop()
            if isinstance(d,list): stack.extend(d); continue
            if not isinstance(d,dict): continue
            if "@graph" in d: stack.extend(d["@graph"])
            t=d.get("@type"); t=t if isinstance(t,list) else [t]
            if ("HowTo" in t or "Recipe" in t) and d.get("recipeInstructions" if "Recipe" in t else "step"):
                raw=d.get("recipeInstructions") if "Recipe" in t else d.get("step")
                steps=[]
                sec=[None]
                def walk(x):
                    if isinstance(x,str): steps.append({**tidy_step(x),"section":sec[0]})
                    elif isinstance(x,list): [walk(i) for i in x]
                    elif isinstance(x,dict):
                        if x.get("itemListElement"):
                            if x.get("@type")=="HowToSection": sec[0]=x.get("name")
                            walk(x["itemListElement"])
                        else:
                            tx=(x.get("text") or x.get("description") or x.get("name") or "").strip()
                            if tx: steps.append({**tidy_step(tx, x.get("name") if x.get("name") and x.get("name")!=tx else None),"section":sec[0]})
                walk(raw)
                mats=[]
                for k in ("supply","tool","recipeIngredient"):
                    v=d.get(k) or []; v=v if isinstance(v,list) else [v]
                    mats+= [i if isinstance(i,str) else i.get("name","") for i in v]
                if steps: out={"title":d.get("name") or "","steps":steps,"materials":[x for x in mats if x][:20],"kind":"HowTo" if "HowTo" in t else "Recipe"}
    return out

def page_text(url):
    if re.search(r"(youtube\.com|youtu\.be)", url):
        return youtube_text(url)
    html = requests.get(url, headers=UA, timeout=20).text
    try:
        import trafilatura
        text = trafilatura.extract(html, include_comments=False, include_tables=False) or ""
    except ImportError:  # optional dependency: fall back to plain visible text
        soup = BeautifulSoup(html, "html.parser")
        for t in soup(["script", "style", "nav", "header", "footer", "aside", "form"]): t.decompose()
        text = "\n".join(l.strip() for l in soup.get_text("\n").splitlines() if len(l.strip()) > 25)
    t = re.search(r"<title>(.*?)</title>", html, re.S)
    sj = jsonld_howto(html)
    if sj and (len(text) < 400 or JUNK.search(text[:1500])): text = "\n".join(s["detail"] for s in sj["steps"])
    return {"title": (sj and sj["title"]) or (t.group(1).strip() if t else url), "text": text, "source": "web", "structured": sj}

VERBS="fold unfold take bring make press crease flip turn rotate lift pull push open close cut glue tape draw mark place put add mix stir pour heat cook bake boil measure cover wrap tie attach connect insert remove unplug plug screw tighten loosen align line slide tuck smooth flatten repeat start begin gather prepare cut trim sand paint wash dry check use set hold keep position squeeze pinch lay spread apply stick secure finish write download install click select type run".split()
VRE=re.compile(r"^(?:(?:then|next|now|first|finally|also|after that|once done)[, ]+)?(%s)\b"%"|".join(VERBS),re.I)
JUNK=re.compile(r"javascript is disabled|enable javascript|enable cookies|captcha|access denied|are you a robot|verify you are human",re.I)
def heuristic_steps(title, text):
    if JUNK.search(text[:1500]): raise ValueError("page is behind a bot/JavaScript wall")
    lines = [l.strip() for l in text.splitlines() if l.strip()]
    steps = []
    for l in lines:
        m = re.match(r"^(?:step\s*)?(\d{1,2})[\).:\-]\s*(.+)$", l, re.I)
        if m and len(m.group(2)) > 8:
            steps.append(m.group(2))
    mode = "numbered lines found in the page"
    if len(steps) < 3:
        sents = re.split(r"(?<=[.!?])\s+", " ".join(lines))
        imp = [s.strip() for s in sents if 12 < len(s) < 220 and VRE.match(s.strip())]
        steps = imp[:25]
        mode = "instruction-style sentences (imperative verbs) from the page; no numbered list found"
    warns = [s.strip() for s in re.split(r"(?<=[.!?])\s+", text) if WARN_RE.search(s) and len(s) < 220][:5]
    return {"title": title, "warnings": warns, "materials": [], "steps": [{"title": s.split(".")[0][:70], "detail": s} for s in steps], "method": "heuristic: " + mode, "ai": False}

def llm(messages, max_tokens=None):
    max_tokens = max_tokens or LLM_MAX_TOKENS
    r = requests.post(LLM_URL + "/chat/completions", headers={"Authorization": "Bearer " + LLM_KEY},
                      json={"model": LLM_MODEL, "messages": messages, "max_tokens": max_tokens, "temperature": 0.2}, timeout=LLM_TIMEOUT)
    r.raise_for_status()
    return r.json()["choices"][0]["message"]["content"]

def ai_steps(title, text):
    prompt = ("Turn this tutorial text into simple beginner steps. Reply with ONLY JSON: "
              '{"title":str,"warnings":[str],"materials":[str],"steps":[{"title":str,"detail":str}]}. '
              "Only use what the text says; do not invent steps. Warnings = safety or common mistakes.\n\nTITLE: "
              + title + "\n\nTEXT:\n" + text[:LLM_TEXT_CHARS])
    out = llm([{"role": "user", "content": prompt}])
    m = re.search(r"\{.*\}", out, re.S)
    data = json.loads(m.group(0))
    data["method"] = "AI (%s) from the source text" % LLM_MODEL
    data["ai"] = True
    return data

def ask(question, step, context):
    """Grounded Q&A. Retrieval + abstention: if the source does not cover the question's key words, say so instead of echoing instructions."""
    hits=retrieve(question, context, 3, with_cov=True)
    good=[h for h in hits if h[2]>=0.6]
    cites=[h[1][:300] for h in good]
    if not LLM_URL:
        if not good:
            return {"answer":"The source doesn't seem to address that. I can't reason beyond it without an AI model connected. Try rephrasing with words from the step, or check the source page itself.","citations":[],"ai":False,"abstained":True}
        return {"answer":"No AI model is connected, so this is retrieval only. The source says:\n- "+"\n- ".join(cites),"citations":cites,"ai":False,"abstained":False}
    ctx="\n".join(h[1] for h in hits) or context[:4000]
    out=llm([{"role":"system","content":"You help a beginner who is stuck on one step of a tutorial. Answer ONLY from the source text. If the source does not cover the question, say so plainly and give no guess. Be short."},
             {"role":"user","content":"Current step: %s\n\nSource text:\n%s\n\nQuestion: %s"%(step,ctx[:8000],question)}],500)
    return {"answer":out,"citations":cites,"ai":True,"abstained":False}

# ---------- retrieval, grounding, agent pipeline ----------
STOP=set("the a an and or to of in on it is for with that this then you your are be as at by from into what which how do does did i my me should can could would will if when where why who whom there their its so not but about get make made use used".split())
def stem(w):
    for suf in ("ing","ed","es","s","ly"):
        if len(w)>4 and w.endswith(suf): w=w[:-len(suf)]; break
    return w[:-1] if len(w)>3 and w.endswith("e") else w
def toks(t): return [stem(w) for w in re.findall(r"[a-z0-9]+", t.lower()) if w not in STOP]
def sentences(text):
    return [x.strip() for x in re.split(r"(?<=[.!?])\s+|\n+", re.sub(r"\[\d+\]","",text)) if len(x.strip())>12]
def retrieve(query, text, k=3, with_cov=False):
    """Sentence-window retrieval (window of 2). Returns [(score, passage)] best first, no overlapping passages.
    With with_cov=True returns (score, passage, coverage) where coverage = share of the question's content words found in the passage."""
    import math
    ss=sentences(text)
    if not ss: return []
    cs=[(i," ".join(ss[i:i+2])) for i in range(len(ss))]
    df={}
    for _,c in cs:
        for w in set(toks(c)): df[w]=df.get(w,0)+1
    q=set(toks(query)); out=[]
    for i,c in cs:
        ct=toks(c)
        if not ct: continue
        sc=sum(math.log(1+len(cs)/df[w])*(1+math.log(ct.count(w))) for w in q if w in df and w in ct)/math.sqrt(len(ct))
        cov=len(q&set(ct))/len(q) if q else 0
        out.append((round(sc,3),i,c,round(cov,2)))
    out.sort(reverse=True); chosen=[]; used=set()
    for sc,i,c,cov in out:
        if sc<=0: break
        if i in used or (i+1) in used or (i-1) in used: continue
        used.update({i,i+1}); chosen.append((sc,c,cov) if with_cov else (sc,c))
        if len(chosen)>=k: break
    return chosen
def ground(steps, text):
    """For each step, find best supporting source chunk; mark ungrounded steps (guardrail against invented steps)."""
    n=0
    for st in steps:
        hit=retrieve(st.get("detail","")+" "+st.get("title",""), text, 1)
        sc=hit[0][0] if hit else 0
        words=set(toks(st.get("detail","")))
        cov=(len(words & set(toks(hit[0][1])))/len(words)) if hit and words else 0
        st["evidence"]=hit[0][1][:300] if hit else ""
        st["grounding"]=round(cov,2)
        st["grounded"]=cov>=0.5
        n+=st["grounded"]
    return {"grounded_steps":n,"total":len(steps),"rate":round(n/len(steps),2) if steps else 0}
def relevance(topic, res):
    t=set(toks(topic))-{"how","make","fold","build","step","tutorial"} or set(toks(topic))
    hay=set(toks(res["title"]+" "+res["source_url"]+" "+res["source_text"][:3000]))
    return round(len(t&hay)/len(t),2) if t else 1.0
def quality(res):
    r=res.get("relevance",1.0)
    st=len(res["steps"])
    if st<3: return 0.0
    return round(r*0.4 + (0.3 if ("numbered" in res["method"]) else 0) + res["grounding_summary"]["rate"]*0.1 + min(st,10)/10*0.3,3) if r>=0.6 else 0.0
def _unused_quality(res):
    """Pick-the-best-source score: numbered structure + grounding + length sanity."""
    st=res["steps"]
    if not st: return 0
    return round(res["grounding_summary"]["rate"]*0.5 + min(len(st),10)/10*0.3 + (0.2 if ("numbered" in res["method"]) else 0),3)
def build(url, topic=None):
    pg=page_text(url)
    if len(pg["text"])<80: raise ValueError("too little readable text")
    res=None
    sj=pg.get("structured")
    if sj and len(sj["steps"])>=3:
        res={"title":pg["title"],"warnings":[w for w in (re.split(r"(?<=[.!?])\s+",pg["text"]) ) if WARN_RE.search(w) and len(w)<220][:5],"materials":sj["materials"],"steps":sj["steps"],"method":"structured %s markup (numbered) published by the site"%sj["kind"],"ai":False}
    if not res and LLM_URL and LLM_MODEL and AI_BUILD:
        try: res=ai_steps(pg["title"],pg["text"])
        except Exception as e: print("AI failed:",e,file=sys.stderr)
    res=res or heuristic_steps(pg["title"],pg["text"])
    res["warnings"]=list(dict.fromkeys(res.get("warnings",[])))[:6]
    res["grounding_summary"]=ground(res["steps"],pg["text"])
    if res.get("ai"):
        # AI-written steps must be traceable to the source. Unsupported ones are removed from the instructions and listed separately.
        keep=[x for x in res["steps"] if x.get("grounded")]; drop=[x for x in res["steps"] if not x.get("grounded")]
        if len(keep)>=2:
            res["rejected_steps"]=[(x.get("title","")+": "+x.get("detail","")).strip() for x in drop]
            res["steps"]=keep; res["grounding_summary"]={"grounded_steps":len(keep),"total":len(keep)+len(drop),"rate":round(len(keep)/(len(keep)+len(drop)),2)}
        else:
            res=heuristic_steps(pg["title"],pg["text"]); res["warnings"]=list(dict.fromkeys(res.get("warnings",[])))[:6]; res["grounding_summary"]=ground(res["steps"],pg["text"]); res["ai_rejected_all"]=True
    res["source_url"]=url; res["source_text"]=pg["text"][:20000]
    if pg.get("source")=="youtube": res["video_note"]=("Video link: captions were found, so these steps come from the spoken text." if pg.get("has_captions") else "Video link: no captions could be read, so these steps come from the video's title and description only, not from the video itself. Treat them as incomplete.")
    res["relevance"]=relevance(topic,res) if topic else 1.0; res["quality"]=quality(res)
    return res
def topic_agent(topic, tries=4):
    """Autonomous loop: search -> fetch candidates -> extract -> ground -> score -> choose; every action logged."""
    trace=[]; cands=[]
    core="how to "+re.sub(r"^how to ","",topic.strip(),flags=re.I)
    results=[]
    for q in (core, "site:wikihow.com "+core):
        r=ddg_search(q,8)
        trace.append({"tool":"web_search","input":q,"output":"%d results via %s"%(len(r),(r[0].get("engine","duckduckgo") if r else "none"))})
        for x in r:
            if x["url"] not in [y["url"] for y in results]: results.append(x)
    for r in results[:tries+4]:
        if len(cands)>=tries: break
        if re.search(r"(youtube\.com|youtu\.be)",r["url"]): 
            trace.append({"tool":"skip","input":r["url"],"output":"video: needs captions, tried only when pasted as a link"}); continue
        try:
            res=build(r["url"],topic); cands.append(res)
            trace.append({"tool":"fetch+extract+ground","input":r["url"],"output":"%d steps, relevance %s, %.0f%% grounded, quality %s"%(len(res["steps"]),res["relevance"],res["grounding_summary"]["rate"]*100,res["quality"])})
        except Exception as e:
            trace.append({"tool":"fetch+extract+ground","input":r["url"],"output":"failed: %s"%str(e)[:80]})
    if not cands: raise ValueError("no usable tutorial found for that topic")
    best=max(cands,key=lambda c:c["quality"])
    if best["quality"]<=0: raise ValueError("found pages but none looked like a tutorial for %r; try a link"%topic)
    trace.append({"tool":"choose","output":"picked %s (quality %s of %d candidates)"%(best["source_url"],best["quality"],len(cands))})
    best["trace"]=trace; best["alternatives"]=[{"url":c["source_url"],"title":c["title"],"quality":c["quality"]} for c in cands if c is not best]
    return best

class H(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k): super().__init__(*a, directory=ROOT, **k)
    def j(self, obj, code=200):
        b = json.dumps(obj).encode(); self.send_response(code)
        self.send_header("Content-Type", "application/json"); self.send_header("Content-Length", str(len(b))); self.end_headers(); self.wfile.write(b)
    def do_GET(self):
        u = urllib.parse.urlparse(self.path); q = urllib.parse.parse_qs(u.query)
        try:
            if u.path == "/api/status": return self.j({"ai": bool(LLM_URL and LLM_MODEL), "model": LLM_MODEL})
            if u.path == "/api/search": return self.j({"results": ddg_search(q["q"][0])})
        except Exception as e: return self.j({"error": str(e)}, 500)
        return super().do_GET()
    def do_POST(self):
        n = int(self.headers.get("Content-Length", 0)); body = json.loads(self.rfile.read(n) or b"{}")
        try:
            if self.path == "/api/tutorial":  # kept for old clients; same pipeline (and same unsupported-step rejection) as /api/tutorial2
                try: return self.j(build(body["url"]))
                except ValueError as e: return self.j({"error": "Could not read enough text from that link (video without captions?). Try a written tutorial or search by topic."}, 422)
            if self.path == "/api/topic": return self.j(topic_agent(body["topic"]))
            if self.path == "/api/tutorial2": return self.j(build(body["url"]))
            if self.path == "/api/ask": return self.j(ask(body["question"], body.get("step", ""), body.get("context", "")))
        except Exception as e: return self.j({"error": str(e)}, 500)
        self.j({"error": "not found"}, 404)

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8765))
    print("Step by Step on http://localhost:%d  AI: %s" % (port, "on (" + LLM_MODEL + ")" if LLM_URL else "off (heuristic extraction only)"))
    http.server.ThreadingHTTPServer(("127.0.0.1", port), H).serve_forever()
