#!/usr/bin/env python3
"""
Scouter Cohort DNA Engine — Standalone v1.0

Single-file, stdlib-only module for embedding in an existing codebase.

Contains:
- 21 program/investor families
- exact a16z Speedrun SR002-SR007 subcohort DNA
- 2024 / 2025 / 2026 historical DNA priors
- current program-intent layer
- market/category momentum layer
- second-check / evidence-confidence layer
- current program ranking
- historical nearest-cohort ranking

IMPORTANT:
"Cohort Fit" is a similarity score, NOT an acceptance probability.
"""

from __future__ import annotations
import argparse
import copy
import json
import math
from pathlib import Path
from typing import Any, Dict, Iterable, List, Tuple


FOUNDER_WEIGHTS = {
    "technical_depth": 1.20, "research_depth": 0.65, "elite_academic": 0.55,
    "elite_employer": 0.70, "repeat_founder": 0.80, "prior_exit": 0.75,
    "early_career": 0.45, "product_builder": 1.10, "enterprise_gtm": 0.70,
    "domain_expertise": 1.00, "speed": 1.20, "global_ambition": 0.85,
    "cofounder_complementarity": 0.70, "customer_obsession": 1.00,
}
COMPANY_WEIGHTS = {
    "ai_native": 0.70, "technical_differentiation": 1.20, "defensible_ip": 0.75,
    "software_high_margin": 0.55, "capital_intensive": 0.45, "enterprise_b2b": 0.55,
    "consumer": 0.35, "developer_facing": 0.45, "regulated_market": 0.45,
    "traction": 1.00, "revenue": 0.75, "speed_ship": 1.10, "global_market": 0.75,
    "local_market_fit": 0.60, "team_small": 0.65, "proprietary_data": 0.60,
}
TAG_TO_FOUNDER = {
    "technical_founder": {"technical_depth": .90},
    "frontier_researcher": {"technical_depth": .95, "research_depth": .95},
    "phd": {"research_depth": .80},
    "top_university": {"elite_academic": .90},
    "ex_frontier_ai": {"elite_employer": 1.00, "technical_depth": .90},
    "ex_bigtech": {"elite_employer": .75},
    "repeat_founder": {"repeat_founder": 1.00},
    "prior_exit": {"prior_exit": 1.00, "repeat_founder": 1.00},
    "student_founder": {"early_career": 1.00},
    "recent_grad": {"early_career": .90},
    "founding_engineer": {"product_builder": .95, "technical_depth": .85},
    "open_source_builder": {"product_builder": .95, "technical_depth": .85},
    "enterprise_sales": {"enterprise_gtm": .95},
    "domain_expert": {"domain_expertise": .95},
    "fast_builder": {"speed": .95, "product_builder": .90},
    "global_ambition": {"global_ambition": 1.00},
    "complementary_team": {"cofounder_complementarity": .95},
    "customer_obsessed": {"customer_obsession": .95},
}
TAG_TO_COMPANY = {
    "ai_native": {"ai_native": 1.00},
    "hard_tech": {"technical_differentiation": .95, "defensible_ip": .85, "capital_intensive": .75},
    "patented": {"defensible_ip": 1.00},
    "software": {"software_high_margin": .90},
    "hardware": {"capital_intensive": .90, "software_high_margin": .20},
    "enterprise": {"enterprise_b2b": .95},
    "consumer": {"consumer": .95},
    "developer_product": {"developer_facing": .95},
    "regulated": {"regulated_market": .95},
    "has_traction": {"traction": .85},
    "strong_traction": {"traction": 1.00},
    "has_revenue": {"revenue": .80},
    "strong_revenue": {"revenue": 1.00},
    "fast_shipping": {"speed_ship": .95},
    "global_market": {"global_market": .95},
    "local_market": {"local_market_fit": .90},
    "small_team": {"team_small": .95},
    "proprietary_data": {"proprietary_data": .95},
}

def clamp(v: float, lo: float = 0.0, hi: float = 1.0) -> float:
    return max(lo, min(hi, float(v)))

def load_json(path: Path) -> Dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))

def merge_signal(dst: Dict[str, float], updates: Dict[str, float]) -> None:
    for k, v in updates.items():
        dst[k] = max(dst.get(k, 0.0), clamp(v))

def build_profile_from_tags(*, founder_tags=(), company_tags=(), categories=(),
                            stage=None, geographies=(), founder_overrides=None,
                            company_overrides=None, evidence=None) -> Dict[str, Any]:
    founder, company = {}, {}
    for tag in founder_tags: merge_signal(founder, TAG_TO_FOUNDER.get(tag, {}))
    for tag in company_tags: merge_signal(company, TAG_TO_COMPANY.get(tag, {}))
    if founder_overrides:
        founder.update({k: clamp(v) for k, v in founder_overrides.items()})
    if company_overrides:
        company.update({k: clamp(v) for k, v in company_overrides.items()})
    return {
        "founder": founder, "company": company,
        "categories": list(dict.fromkeys(categories)),
        "stage": stage, "geographies": list(dict.fromkeys(geographies)),
        "evidence": evidence or []
    }

def _effective_program(program: Dict[str, Any], year: str) -> Dict[str, Any]:
    out = copy.deepcopy(program)
    yr = program.get("years", {}).get(str(year), {})
    out["founder_targets"].update(yr.get("founder_overrides", {}))
    out["company_targets"].update(yr.get("company_overrides", {}))
    out["category_affinity"].update(yr.get("category_overrides", {}))
    out["stage_affinity"].update(yr.get("stage_overrides", {}))
    out["_year_meta"] = yr
    return out

def _numeric_similarity(observed: Dict[str, Any], target: Dict[str, float],
                        weights: Dict[str, float]) -> Tuple[float|None, float, list]:
    if not target:
        return None, 0.0, []
    total_possible = sum(weights.get(k, 1.0) for k in target)
    numerator = denominator = used = 0.0
    details = []
    for key, tgt in target.items():
        if key not in observed or observed[key] is None:
            continue
        try:
            obs = clamp(observed[key]); tgt = clamp(tgt)
        except (TypeError, ValueError):
            continue
        w = weights.get(key, 1.0)
        sim = 1.0 - abs(obs - tgt)
        numerator += sim*w; denominator += w; used += w
        details.append({"feature": key, "observed": obs, "target": tgt,
                        "similarity": sim, "importance": w})
    if not denominator:
        return None, 0.0, []
    return numerator/denominator, (used/total_possible if total_possible else 0), details

def _tag_affinity(tags: Iterable[str], affinity: Dict[str, float]) -> Tuple[float|None, float, list]:
    tags = [t for t in tags if t]
    if not tags or not affinity:
        return None, 0.0, []
    vals = [(t, clamp(affinity.get(t, .35))) for t in tags]
    scores = sorted((v for _,v in vals), reverse=True)
    score = scores[0] if len(scores)==1 else .65*scores[0] + .35*sum(scores[1:min(3,len(scores))])/max(1,min(2,len(scores)-1))
    return clamp(score), min(1.0, len(tags)/2.0), [{"tag":k,"affinity":v} for k,v in vals]

def _single_affinity(value: str|None, affinity: Dict[str,float]) -> Tuple[float|None, float]:
    if not value or not affinity: return None, 0.0
    return clamp(affinity.get(value, .30)), 1.0

def _geo_affinity(geos: Iterable[str], affinity: Dict[str,float]) -> Tuple[float|None, float, list]:
    geos = [g for g in geos if g]
    if not geos or not affinity: return None, 0.0, []
    vals = [(g, clamp(affinity.get(g, .30))) for g in geos]
    return max(v for _,v in vals), min(1.0,len(geos)/2.0), [{"tag":k,"affinity":v} for k,v in vals]

def _source_confidence(meta: Dict[str,Any]) -> float:
    return {"high":1.0,"medium":.86,"low":.68}.get(meta.get("confidence","medium"),.80)

def _combine_components(components: list) -> Tuple[float, float]:
    active = [(n,s,c,w) for n,s,c,w in components if s is not None]
    if not active: raise ValueError("Profile contains no scoreable information.")
    total_w = sum(w for _,_,_,w in active)
    score = sum(s*w for _,s,_,w in active)/total_w
    coverage = sum(c*w for _,_,c,w in active)/total_w
    return clamp(score), clamp(coverage)

def _top_feature_explanations(founder_details, company_details, n_match=5, n_gap=4):
    rows=[]
    for namespace, ds in (("founder",founder_details),("company",company_details)):
        for d in ds:
            z=dict(d); z["feature"]=f"{namespace}.{z['feature']}"; rows.append(z)
    matches=sorted(rows,key=lambda d:d["similarity"]*d["importance"],reverse=True)[:n_match]
    gaps=sorted(rows,key=lambda d:(1-d["similarity"])*d["importance"],reverse=True)[:n_gap]
    for arr in (matches,gaps):
        for d in arr:
            for k in ("observed","target","similarity","importance"): d[k]=round(d[k],3)
    return matches,gaps

def score_historical_cohort(profile: Dict[str,Any], program: Dict[str,Any], year: str) -> Dict[str,Any]:
    p=_effective_program(program,year)
    fs,fc,fd=_numeric_similarity(profile.get("founder",{}),p["founder_targets"],FOUNDER_WEIGHTS)
    cs,cc,cd=_numeric_similarity(profile.get("company",{}),p["company_targets"],COMPANY_WEIGHTS)
    cats,catc,cate=_tag_affinity(profile.get("categories",[]),p["category_affinity"])
    ss,sc=_single_affinity(profile.get("stage"),p["stage_affinity"])
    gs,gc,ge=_geo_affinity(profile.get("geographies",[]),p["geo_affinity"])
    cw=p.get("component_weights",{})
    comps=[
        ("founder",fs,fc,cw.get("founder",.45)),
        ("company",cs,cc,cw.get("company",.35)),
        ("category",cats,catc,cw.get("category",.10)),
        ("stage",ss,sc,cw.get("stage",.05)),
        ("geography",gs,gc,cw.get("geography",.05)),
    ]
    raw,cov=_combine_components(comps)
    penalty=0.0; warnings=[]
    constraints=p.get("constraints",{})
    if constraints.get("enterprise_required") and profile.get("company",{}).get("enterprise_b2b",0)<.5:
        penalty+=.18; warnings.append("enterprise orientation below program hard-prior")
    if constraints.get("technical_founder_required") and profile.get("founder",{}).get("technical_depth",0)<.55:
        penalty+=.15; warnings.append("technical founder signal below program hard-prior")
    if constraints.get("local_market_fit_required") and profile.get("company",{}).get("local_market_fit",0)<.50:
        penalty+=.12; warnings.append("local/Abu Dhabi market-entry fit below program hard-prior")
    geos=set(profile.get("geographies",[]) or [])
    relocation_signal=("abu_dhabi" in geos or "mena" in geos or profile.get("company",{}).get("local_market_fit",0)>=.60)
    if constraints.get("relocation_required") and not relocation_signal:
        penalty+=.10; warnings.append("no Abu Dhabi/MENA relocation or market-entry signal supplied")
    if constraints.get("repeat_or_breakout"):
        founder = profile.get("founder",{}) or {}
        company = profile.get("company",{}) or {}
        repeat_path = max(founder.get("repeat_founder",0), founder.get("prior_exit",0))
        breakout_path = max(company.get("traction",0), company.get("revenue",0), company.get("speed_ship",0))
        if max(repeat_path, breakout_path) < .55:
            penalty += .14
            warnings.append("HF0 pathway weak: neither repeat-founder nor breakout-growth signal is strong")
    founder_first_missing = bool(constraints.get("founder_first") and not profile.get("founder"))
    if founder_first_missing:
        warnings.append("founder-first program scored without founder data; fit is provisional")
    score=clamp(raw-penalty)
    matches,gaps=_top_feature_explanations(fd,cd)
    confidence_multiplier = .62 if founder_first_missing else 1.0
    return {
        "program":p["name"], "program_id":None,  # caller fills this in (see score_historical / rank_historical_batches)
        "year":str(year), "historical_cohort_fit":round(score*100,1),
        "dna_confidence":round(cov*_source_confidence(p.get("_year_meta",{}))*confidence_multiplier*100,1),
        "archetype":p["archetype"], "trend_tags":p.get("_year_meta",{}).get("trend_tags",[]),
        "year_semantics":p.get("year_semantics","program_year"),
        "year_note":p.get("_year_meta",{}).get("notes",""),
        "component_scores":{n:None if s is None else round(s*100,1) for n,s,_,_ in comps},
        "component_coverage":{n:round(c*100,1) for n,_,c,_ in comps},
        "top_matches":matches, "top_gaps":gaps, "warnings":warnings,
        "sources":p.get("sources",[]),
    }

def _score_intent(profile: Dict[str,Any], intent: Dict[str,Any]) -> Dict[str,Any]:
    fs,fc,fd=_numeric_similarity(profile.get("founder",{}),intent.get("founder_targets",{}),FOUNDER_WEIGHTS)
    cs,cc,cd=_numeric_similarity(profile.get("company",{}),intent.get("company_targets",{}),COMPANY_WEIGHTS)
    cats,catc,cate=_tag_affinity(profile.get("categories",[]),intent.get("category_affinity",{}))
    ss,sc=_single_affinity(profile.get("stage"),intent.get("stage_affinity",{}))
    gs,gc,ge=_geo_affinity(profile.get("geographies",[]),intent.get("geo_affinity",{}))
    cw=intent.get("component_weights",{})
    comps=[
        ("founder",fs,fc,cw.get("founder",.30)),
        ("company",cs,cc,cw.get("company",.30)),
        ("category",cats,catc,cw.get("category",.25)),
        ("stage",ss,sc,cw.get("stage",.10)),
        ("geography",gs,gc,cw.get("geography",.05)),
    ]
    active=[x for x in comps if x[1] is not None]
    if not active:
        return {"score":None,"coverage":0.0,"matches":[],"gaps":[]}
    score,cov=_combine_components(active)
    founder_first_missing = bool(intent.get("founder_first") and not profile.get("founder"))
    if founder_first_missing:
        cov *= .62
    matches,gaps=_top_feature_explanations(fd,cd,4,3)
    return {
        "score":score, "coverage":cov, "matches":matches, "gaps":gaps,
        "founder_first_missing":founder_first_missing,
        "category_evidence":cate
    }

def _regional_market_categories(signals: Dict[str,Any], profile: Dict[str,Any]) -> Dict[str,float]:
    base=copy.deepcopy(signals["market_regime"]["global"]["category_momentum"])
    regions=signals["market_regime"].get("regions",{})
    for geo in profile.get("geographies",[]):
        if geo in regions:
            for k,delta in regions[geo].get("boost",{}).items():
                base[k]=clamp(base.get(k,.5)+delta)
    return base

def _score_market(profile: Dict[str,Any], signals: Dict[str,Any]) -> Dict[str,Any]:
    g=signals["market_regime"]["global"]
    cat_aff=_regional_market_categories(signals,profile)
    cats,catc,cate=_tag_affinity(profile.get("categories",[]),cat_aff)
    cs,cc,cd=_numeric_similarity(profile.get("company",{}),g.get("company_trait_momentum",{}),COMPANY_WEIGHTS)
    fs,fc,fd=_numeric_similarity(profile.get("founder",{}),g.get("founder_trait_momentum",{}),FOUNDER_WEIGHTS)
    comps=[("category",cats,catc,.55),("company",cs,cc,.25),("founder",fs,fc,.20)]
    active=[x for x in comps if x[1] is not None]
    if not active: return {"score":None,"coverage":0.0}
    score,cov=_combine_components(active)
    return {"score":score,"coverage":cov,"category_evidence":cate}

def _freshness_weight(days: float, half_life: float) -> float:
    if days is None: return .75
    try: days=max(0.0,float(days))
    except: return .75
    return math.exp(-math.log(2)*days/max(1.0,half_life))

def verify_profile(profile: Dict[str,Any], signals: Dict[str,Any]) -> Dict[str,Any]:
    rules=signals["verification_rules"]; ev=profile.get("evidence",[]) or []
    if not ev:
        base=rules.get("minimum_default_confidence_without_evidence",.55)
        return {
            "evidence_confidence":round(base*100,1),
            "verified_items":0, "contradictions":0,
            "warnings":["No explicit evidence records supplied; run second-check/enrichment before investment use."],
            "hard_checks":{k:"unresolved" for k in rules.get("recommended_hard_checks",[])}
        }
    vals=[]; contradictions=0; hard={}
    for e in ev:
        st=e.get("status","unresolved")
        src=e.get("source_type","unknown")
        conf=clamp(e.get("confidence",1.0))
        fresh=_freshness_weight(e.get("freshness_days"),rules.get("freshness_half_life_days",365))
        v=rules["status_weight"].get(st,.45)*rules["source_type_weight"].get(src,.45)*conf*(.65+.35*fresh)
        vals.append(v)
        if st=="contradicted": contradictions+=1
        field=e.get("field")
        if field in rules.get("recommended_hard_checks",[]):
            hard[field]=st
    # Strong contradiction penalty to confidence, not fit.
    score=(sum(vals)/len(vals)) if vals else .55
    score*=max(.35,1-.18*contradictions)
    warnings=[]
    for k in rules.get("recommended_hard_checks",[]):
        if k not in hard: hard[k]="unresolved"
    unresolved=[k for k,v in hard.items() if v in ("unresolved","inferred")]
    if unresolved: warnings.append("Unresolved hard checks: "+", ".join(unresolved))
    if contradictions: warnings.append(f"{contradictions} contradictory evidence item(s) detected.")
    return {
        "evidence_confidence":round(clamp(score)*100,1),
        "verified_items":sum(1 for e in ev if e.get("status") in ("verified","corroborated")),
        "contradictions":contradictions, "warnings":warnings, "hard_checks":hard
    }

def _fit_band(score: float) -> str:
    if score>=92: return "EXCEPTIONAL FIT"
    if score>=85: return "VERY HIGH FIT"
    if score>=75: return "HIGH FIT"
    if score>=65: return "MODERATE FIT"
    return "LOW FIT"

def score_current_program(profile: Dict[str,Any], pid: str, program: Dict[str,Any],
                          library: Dict[str,Any], signals: Dict[str,Any],
                          latest_year: str="2026") -> Dict[str,Any]:
    hist=score_historical_cohort(profile,program,latest_year)
    intent_cfg=signals.get("program_intent",{}).get(pid,{})
    intent=_score_intent(profile,intent_cfg)
    market=_score_market(profile,signals)
    parts=[
        ("historical_latest_cohort",hist["historical_cohort_fit"]/100,
         hist["dna_confidence"]/100,signals["layer_weights"]["current_program_fit"]["historical_latest_cohort"]),
        ("current_program_intent",intent.get("score"),intent.get("coverage",0),
         signals["layer_weights"]["current_program_fit"]["current_program_intent"]),
        ("market_regime",market.get("score"),market.get("coverage",0),
         signals["layer_weights"]["current_program_fit"]["market_regime"]),
    ]
    active=[p for p in parts if p[1] is not None]
    total=sum(w for _,_,_,w in active)
    final=sum(s*w for _,s,_,w in active)/total
    layer_cov=sum(c*w for _,_,c,w in active)/total
    verification=verify_profile(profile,signals)
    # Overall confidence combines data coverage, DNA source confidence and explicit verification.
    overall_conf=.45*layer_cov + .35*(hist["dna_confidence"]/100) + .20*(verification["evidence_confidence"]/100)
    return {
        "program":program["name"], "program_id":pid, "current_year":latest_year,
        "current_program_fit":round(clamp(final)*100,1),
        "fit_band":_fit_band(final*100),
        "historical_latest_cohort_fit":hist["historical_cohort_fit"],
        "current_intent_fit":None if intent.get("score") is None else round(intent["score"]*100,1),
        "market_regime_fit":None if market.get("score") is None else round(market["score"]*100,1),
        "overall_confidence":round(clamp(overall_conf)*100,1),
        "evidence_confidence":verification["evidence_confidence"],
        "historical_component_scores":hist["component_scores"],
        "historical_top_matches":hist["top_matches"],
        "historical_top_gaps":hist["top_gaps"],
        "intent_top_matches":intent.get("matches",[]),
        "intent_top_gaps":intent.get("gaps",[]),
        "intent_trend_tags":intent_cfg.get("trend_tags",[]),
        "intent_note":intent_cfg.get("notes",""),
        "market_category_evidence":[
            {"tag":x["tag"],"momentum":round(x["affinity"]*100,1)}
            for x in market.get("category_evidence",[])
        ],
        "verification_warnings":verification["warnings"] + (
            ["Founder-first program: founder data missing, so program fit confidence is reduced."]
            if intent.get("founder_first_missing") else []
        ),
        "sources":{
            "historical":hist.get("sources",[]),
            "current_intent":intent_cfg.get("sources",[]),
            "market":signals["market_regime"]["global"].get("sources",[])
        },
        "score_semantics":"Cohort/program similarity, not acceptance probability",
    }

def rank_current_programs(profile: Dict[str,Any], library: Dict[str,Any], signals: Dict[str,Any],
                          latest_year="2026", top_n=None) -> List[Dict[str,Any]]:
    rows=[score_current_program(profile,pid,p,library,signals,latest_year)
          for pid,p in library["programs"].items()
          if latest_year in p.get("years",{})]
    rows.sort(key=lambda r:(r["current_program_fit"],r["overall_confidence"]),reverse=True)
    return rows[:top_n] if top_n else rows

def rank_historical_batches(profile: Dict[str,Any], library: Dict[str,Any],
                            years=("2024","2025","2026"), top_n=None) -> List[Dict[str,Any]]:
    rows=[]
    for pid,p in library["programs"].items():
        for y in years:
            if y not in p.get("years",{}): continue
            r=score_historical_cohort(profile,p,y); r["program_id"]=pid
            rows.append(r)
    rows.sort(key=lambda r:(r["historical_cohort_fit"],r["dna_confidence"]),reverse=True)
    return rows[:top_n] if top_n else rows


def _effective_subcohort(program: Dict[str,Any], cohort_id: str) -> Dict[str,Any]:
    cohort = program.get("cohorts", {}).get(str(cohort_id))
    if cohort is None:
        raise KeyError(f"Unknown cohort_id={cohort_id!r}")
    out = copy.deepcopy(program)
    out["founder_targets"].update(cohort.get("founder_overrides", {}))
    out["company_targets"].update(cohort.get("company_overrides", {}))
    out["category_affinity"].update(cohort.get("category_affinity", {}))
    out["stage_affinity"].update(cohort.get("stage_affinity", {}))
    out["geo_affinity"].update(cohort.get("geo_affinity", {}))
    out["_cohort_meta"] = cohort
    return out

def score_program_subcohort(profile: Dict[str,Any], program: Dict[str,Any],
                            cohort_id: str, program_id: str|None=None) -> Dict[str,Any]:
    p = _effective_subcohort(program, str(cohort_id))
    meta = p["_cohort_meta"]

    fs,fc,fd = _numeric_similarity(profile.get("founder",{}), p["founder_targets"], FOUNDER_WEIGHTS)
    cs,cc,cd = _numeric_similarity(profile.get("company",{}), p["company_targets"], COMPANY_WEIGHTS)
    cats,catc,cate = _tag_affinity(profile.get("categories",[]), p["category_affinity"])
    ss,sc = _single_affinity(profile.get("stage"), p["stage_affinity"])
    gs,gc,ge = _geo_affinity(profile.get("geographies",[]), p["geo_affinity"])

    cw = p.get("component_weights", {})
    comps = [
        ("founder", fs, fc, cw.get("founder", .42)),
        ("company", cs, cc, cw.get("company", .33)),
        ("category", cats, catc, cw.get("category", .15)),
        ("stage", ss, sc, cw.get("stage", .05)),
        ("geography", gs, gc, cw.get("geography", .05)),
    ]
    raw, cov = _combine_components(comps)
    penalty = 0.0
    warnings = []

    constraints = p.get("constraints", {})
    if constraints.get("enterprise_required") and profile.get("company",{}).get("enterprise_b2b",0) < .5:
        penalty += .18
        warnings.append("enterprise orientation below program hard-prior")
    if constraints.get("technical_founder_required") and profile.get("founder",{}).get("technical_depth",0) < .55:
        penalty += .15
        warnings.append("technical founder signal below program hard-prior")
    if constraints.get("local_market_fit_required") and profile.get("company",{}).get("local_market_fit",0) < .50:
        penalty += .12
        warnings.append("local/Abu Dhabi market-entry fit below program hard-prior")
    geos = set(profile.get("geographies",[]) or [])
    relocation_signal = (
        "abu_dhabi" in geos or "mena" in geos or
        profile.get("company",{}).get("local_market_fit",0) >= .60
    )
    if constraints.get("relocation_required") and not relocation_signal:
        penalty += .10
        warnings.append("no Abu Dhabi/MENA relocation or market-entry signal supplied")
    if constraints.get("repeat_or_breakout"):
        founder = profile.get("founder",{}) or {}
        company = profile.get("company",{}) or {}
        repeat_path = max(founder.get("repeat_founder",0), founder.get("prior_exit",0))
        breakout_path = max(company.get("traction",0), company.get("revenue",0), company.get("speed_ship",0))
        if max(repeat_path, breakout_path) < .55:
            penalty += .14
            warnings.append("HF0 pathway weak: neither repeat-founder nor breakout-growth signal is strong")

    score = clamp(raw - penalty)
    matches, gaps = _top_feature_explanations(fd, cd)
    confidence = _source_confidence(meta)

    if "partial" in meta.get("coverage_status","").lower():
        confidence *= .82
        warnings.append("cohort snapshot is partial/in-progress")
    elif "survivorship" in meta.get("coverage_status","").lower():
        confidence *= .86
        warnings.append("historical directory snapshot is survivorship-biased/incomplete")

    return {
        "program": p["name"],
        "program_id": program_id,
        "cohort_id": str(cohort_id),
        "year": str(meta.get("year","")),
        "subcohort_dna_fit": round(score * 100, 1),
        "dna_confidence": round(cov * confidence * 100, 1),
        "fit_band": _fit_band(score * 100),
        "component_scores": {
            n: None if s is None else round(s * 100, 1)
            for n,s,_,_ in comps
        },
        "component_coverage": {
            n: round(c * 100, 1)
            for n,_,c,_ in comps
        },
        "top_matches": matches,
        "top_gaps": gaps,
        "program_period": meta.get("period"),
        "program_location": meta.get("program_location"),
        "coverage_status": meta.get("coverage_status"),
        "coverage_note": meta.get("coverage_note"),
        "observed_snapshot_stats": meta.get("observed_snapshot_stats", {}),
        "warnings": warnings,
        "sources": meta.get("sources", p.get("sources", [])),
        "score_semantics": (
            "Subcohort DNA similarity using empirical cohort composition plus program selection priors; "
            "not acceptance probability."
        ),
    }

def rank_program_subcohorts(profile: Dict[str,Any], library: Dict[str,Any],
                            program_id: str|None=None, top_n=None) -> List[Dict[str,Any]]:
    rows = []
    for pid, program in library["programs"].items():
        if program_id is not None and pid != program_id:
            continue
        for cohort_id in program.get("cohorts", {}):
            rows.append(score_program_subcohort(
                profile, program, cohort_id, program_id=pid
            ))
    rows.sort(
        key=lambda r: (r["subcohort_dna_fit"], r["dna_confidence"]),
        reverse=True,
    )
    return rows[:top_n] if top_n else rows


def run_engine(profile: Dict[str,Any], library: Dict[str,Any], signals: Dict[str,Any],
               years=("2024","2025","2026"), top_current=20, top_historical=20) -> Dict[str,Any]:
    verification=verify_profile(profile,signals)
    return {
        "engine":"Scouter Cohort DNA Engine",
        "version":"1.5.0",
        "as_of":signals.get("as_of"),
        "semantics":{
            "current_program_fit":"Apply-today style similarity using latest cohort + current intent + market context.",
            "historical_cohort_fit":"Nearest historical program-year DNA.",
            "subcohort_dna_fit":"Nearest named program cohort/batch DNA when cohort-level data exists.",
            "acceptance_probability":"NOT CALCULATED. Requires applicant/rejected ground truth."
        },
        "verification":verification,
        "current_program_ranking":rank_current_programs(profile,library,signals,top_n=top_current),
        "historical_nearest_batches":rank_historical_batches(profile,library,years=years,top_n=top_historical),
        "program_subcohort_ranking":rank_program_subcohorts(profile,library,top_n=top_historical)
    }


# ---------------------------------------------------------------------------
# EMBEDDED DATA
# Keep these blocks versioned. Later they can be replaced by DB/API-backed
# loaders without changing the public CohortDNAEngine API.
# ---------------------------------------------------------------------------

COHORT_LIBRARY = json.loads(r"""{
  "version": "1.5.0",
  "as_of": "2026-09-05",
  "score_semantics": {
    "historical_cohort_fit": "Similarity to the observed/researched DNA prior for a specific program-year. NOT an acceptance probability.",
    "current_program_fit": "Weighted fit to the program's latest cohort DNA + current stated intent + market regime. NOT an acceptance probability.",
    "confidence": "Evidence coverage and reliability. Confidence is reported separately and does not manufacture fit.",
    "calibration_note": "YC founder_targets/company_targets.team_small and YC/Techstars/Antler category_affinity overrides for years with n>=15 real companies are now EMPIRICALLY CALIBRATED from actual scraped rosters (Apify YC/Techstars/Antler datasets, 2026-09-05). Techstars/Antler founder-level targets remain hand-authored priors because the source data contains no founder identities/bios. All other programs (500 Global, a16z Speedrun, Sequoia Arc, etc.) remain fully hand-authored priors - no roster data was available for them in this project. Sequoia Capital is now added as a separate investor DNA (distinct from Arc): its portfolio-level stage/category/partner priors are calibrated from a user-provided 425-company Sequoia export; 2024/2025/2026 deltas use verified recent-partnership samples plus official Sequoia current-thesis material. Founder-level Sequoia values remain research priors rather than a complete founder census. a16z Speedrun is now cohort-calibrated from the current official directory export: 256 company records total; SR002–SR007 mapped into 2024–2026 with empirical company/team/geography/category distributions. Exact founder-quality features remain official-selection priors because directory cards do not provide complete comparable founder biographies for every historical cohort. Entrepreneurs First is now founder-first calibrated from official 2026 selection criteria plus a 192-company EF portfolio export. Founded-year statistics are explicitly treated as formation outcomes, not cohort membership. Hub71 is now exact-cohort calibrated for Cohorts 14–18 using official cohort announcements, including applications/selection counts, international share, funding maturity, stage mix, specialist-program mix and accepted-company composition. HF0 is now calibrated with official W24/S24/F24/W25/S25/2026 residency outcome facts plus a separate Tracxn portfolio-investment layer covering stage, sector, geography and 2024-2026 investment activity. Residency acceptance and fund investment activity are explicitly not conflated."
  },
  "feature_definitions": {
    "founder": {
      "technical_depth": "Depth of engineering/technical ability",
      "research_depth": "Research record: top papers, PhD, frontier research",
      "elite_academic": "Selective university/lab pedigree",
      "elite_employer": "Frontier AI/big-tech/high-signal operating background",
      "repeat_founder": "Prior founder experience",
      "prior_exit": "Prior meaningful acquisition/IPO exit",
      "early_career": "Unusually early career / student / recent graduate",
      "product_builder": "Evidence of shipping products, prototypes or OSS",
      "enterprise_gtm": "Enterprise sales/GTM ability",
      "domain_expertise": "Deep lived expertise in the problem/industry",
      "speed": "Observed speed / intensity / build velocity",
      "global_ambition": "Global-market ambition",
      "cofounder_complementarity": "Complementary founding team",
      "customer_obsession": "Evidence of customer discovery / founder-led sales"
    },
    "company": {
      "ai_native": "AI is core to the product, not a cosmetic feature",
      "technical_differentiation": "Hard-to-copy technical edge",
      "defensible_ip": "Patents/proprietary research/hard technical IP",
      "software_high_margin": "Software-like gross margin / scalable economics",
      "capital_intensive": "Hardware/deep-tech/capex intensity",
      "enterprise_b2b": "Enterprise/B2B orientation",
      "consumer": "Consumer orientation",
      "developer_facing": "Developers are users/buyers",
      "regulated_market": "Regulated or compliance-heavy market",
      "traction": "Early user/customer proof",
      "revenue": "Meaningful early revenue",
      "speed_ship": "Fast product iteration/shipping",
      "global_market": "Can target a global market from inception",
      "local_market_fit": "Requires/benefits from local market access",
      "team_small": "Very small founding team",
      "proprietary_data": "Unique data asset/flywheel"
    }
  },
  "category_vocabulary": [
    "ai_agents",
    "ai_infra",
    "developer_tools",
    "vertical_ai",
    "voice_ai",
    "physical_ai_robotics",
    "cyber_security",
    "fintech",
    "health_bio",
    "climate_energy",
    "industrial_deeptech",
    "semiconductors",
    "defense_dualuse",
    "consumer",
    "gaming",
    "marketplace",
    "web3",
    "scientific_ai",
    "enterprise_saas",
    "hardware"
  ],
  "stage_vocabulary": [
    "pre_idea",
    "idea",
    "prototype",
    "launched",
    "pre_seed",
    "seed",
    "series_a"
  ],
  "geography_vocabulary": [
    "us",
    "europe",
    "latam",
    "mena",
    "asia",
    "global",
    "sf",
    "abu_dhabi",
    "saudi",
    "chile",
    "la",
    "nyc",
    "london",
    "paris",
    "bangalore"
  ],
  "programs": {
    "yc": {
      "name": "Y Combinator",
      "region": "US / Global",
      "archetype": "Fast-moving, formidable founders building venture-scale companies; increasingly AI-heavy, with a strong bias to small teams that ship and learn quickly.",
      "founder_targets": {
        "technical_depth": 0.82,
        "research_depth": 0.45,
        "elite_academic": 0.5,
        "elite_employer": 0.45,
        "repeat_founder": 0.35,
        "prior_exit": 0.15,
        "early_career": 0.62,
        "product_builder": 0.88,
        "enterprise_gtm": 0.55,
        "domain_expertise": 0.75,
        "speed": 0.98,
        "global_ambition": 0.96,
        "cofounder_complementarity": 0.78,
        "customer_obsession": 0.88
      },
      "company_targets": {
        "ai_native": 0.78,
        "technical_differentiation": 0.76,
        "defensible_ip": 0.42,
        "software_high_margin": 0.82,
        "capital_intensive": 0.35,
        "enterprise_b2b": 0.77,
        "consumer": 0.45,
        "developer_facing": 0.58,
        "regulated_market": 0.35,
        "traction": 0.66,
        "revenue": 0.52,
        "speed_ship": 0.98,
        "global_market": 0.92,
        "local_market_fit": 0.25,
        "team_small": 0.92,
        "proprietary_data": 0.48
      },
      "category_affinity": {
        "ai_agents": 0.94,
        "ai_infra": 0.88,
        "developer_tools": 0.86,
        "vertical_ai": 0.95,
        "voice_ai": 0.8,
        "physical_ai_robotics": 0.72,
        "cyber_security": 0.72,
        "fintech": 0.72,
        "health_bio": 0.68,
        "climate_energy": 0.45,
        "industrial_deeptech": 0.63,
        "semiconductors": 0.55,
        "defense_dualuse": 0.58,
        "consumer": 0.58,
        "gaming": 0.42,
        "marketplace": 0.5,
        "web3": 0.38,
        "scientific_ai": 0.75,
        "enterprise_saas": 0.9,
        "hardware": 0.55
      },
      "stage_affinity": {
        "pre_idea": 0.2,
        "idea": 0.48,
        "prototype": 0.82,
        "launched": 0.95,
        "pre_seed": 1.0,
        "seed": 0.7,
        "series_a": 0.18
      },
      "geo_affinity": {
        "us": 0.95,
        "europe": 0.7,
        "latam": 0.6,
        "mena": 0.58,
        "asia": 0.66,
        "global": 1.0,
        "sf": 1.0,
        "abu_dhabi": 0.3,
        "saudi": 0.28,
        "chile": 0.3
      },
      "years": {
        "2024": {
          "trend_tags": [
            "AI platform shift",
            "B2B SaaS dominance",
            "practical LLM applications",
            "small teams"
          ],
          "founder_overrides": {
            "repeat_founder": 0.058,
            "prior_exit": 0.07,
            "elite_employer": 0.4,
            "elite_academic": 0.366,
            "technical_depth": 0.6
          },
          "company_overrides": {
            "ai_native": 0.72,
            "enterprise_b2b": 0.84,
            "team_small": 0.375
          },
          "category_overrides": {
            "ai_agents": 0.75,
            "vertical_ai": 0.82,
            "enterprise_saas": 0.63,
            "industrial_deeptech": 0.086,
            "physical_ai_robotics": 0.023,
            "health_bio": 0.106,
            "ai_infra": 0.051,
            "hardware": 0.018,
            "consumer": 0.1,
            "fintech": 0.083,
            "cyber_security": 0.018,
            "climate_energy": 0.004,
            "defense_dualuse": 0.002
          },
          "stage_overrides": {},
          "notes": "W24: 260 companies from 27k applications; at least half AI; 65% B2B SaaS/enterprise. [DATA-CALIBRATED] founder signals from real founder bios (repeat=5.8%, exit=7.0%, big-tech=40.0%, elite-academic=36.6%, avg team size=8.25). [DATA-CALIBRATED] category mix from real industry/sector tags (n=568, mapped categories: ai_infra, climate_energy, consumer, cyber_security, defense_dualuse, enterprise_saas, fintech, hardware, health_bio, industrial_deeptech, physical_ai_robotics).",
          "confidence": "high"
        },
        "2025": {
          "trend_tags": [
            "four-batch cadence",
            "agentic AI",
            "coding/devtools",
            "vertical AI",
            "faster iteration"
          ],
          "founder_overrides": {
            "speed": 1.0,
            "repeat_founder": 0.092,
            "prior_exit": 0.063,
            "elite_employer": 0.369,
            "elite_academic": 0.362,
            "technical_depth": 0.592
          },
          "company_overrides": {
            "ai_native": 0.84,
            "speed_ship": 1.0,
            "team_small": 0.672
          },
          "category_overrides": {
            "ai_agents": 0.92,
            "developer_tools": 0.91,
            "vertical_ai": 0.94,
            "consumer": 0.072,
            "enterprise_saas": 0.647,
            "fintech": 0.084,
            "climate_energy": 0.006,
            "industrial_deeptech": 0.119,
            "health_bio": 0.072,
            "defense_dualuse": 0.008,
            "cyber_security": 0.026,
            "ai_infra": 0.061,
            "physical_ai_robotics": 0.053,
            "hardware": 0.011
          },
          "stage_overrides": {},
          "notes": "YC moved to four batches/year as AI and software cycles accelerated. [DATA-CALIBRATED] founder signals from real founder bios (repeat=9.2%, exit=6.3%, big-tech=36.9%, elite-academic=36.2%, avg team size=5.28). [DATA-CALIBRATED] category mix from real industry/sector tags (n=621, mapped categories: ai_infra, climate_energy, consumer, cyber_security, defense_dualuse, enterprise_saas, fintech, hardware, health_bio, industrial_deeptech, physical_ai_robotics).",
          "confidence": "high"
        },
        "2026": {
          "trend_tags": [
            "AI agents become default",
            "AI-native workflows",
            "physical AI emergence",
            "scientific AI",
            "tiny teams"
          ],
          "founder_overrides": {
            "technical_depth": 0.596,
            "speed": 1.0,
            "repeat_founder": 0.142,
            "prior_exit": 0.063,
            "elite_employer": 0.346,
            "elite_academic": 0.418
          },
          "company_overrides": {
            "ai_native": 0.92,
            "team_small": 0.861,
            "technical_differentiation": 0.8
          },
          "category_overrides": {
            "ai_agents": 1.0,
            "vertical_ai": 1.0,
            "physical_ai_robotics": 0.072,
            "scientific_ai": 0.84,
            "enterprise_saas": 0.564,
            "fintech": 0.107,
            "consumer": 0.054,
            "defense_dualuse": 0.025,
            "industrial_deeptech": 0.202,
            "health_bio": 0.086,
            "cyber_security": 0.028,
            "ai_infra": 0.109,
            "climate_energy": 0.019,
            "hardware": 0.016
          },
          "stage_overrides": {},
          "notes": "Directory mix shows strong agent, workflow, scientific-AI and physical-AI representation. [DATA-CALIBRATED] founder signals from real founder bios (repeat=14.2%, exit=6.3%, big-tech=34.6%, elite-academic=41.8%, avg team size=3.39). [DATA-CALIBRATED] category mix from real industry/sector tags (n=569, mapped categories: ai_infra, climate_energy, consumer, cyber_security, defense_dualuse, enterprise_saas, fintech, hardware, health_bio, industrial_deeptech, physical_ai_robotics).",
          "confidence": "high"
        }
      },
      "sources": [
        "https://www.ycombinator.com/blog/meet-the-yc-winter-2024-batch",
        "https://www.ycombinator.com/",
        "https://www.ycombinator.com/companies/industry/artificial-intelligence",
        "Internal Scouter scrape (Apify YC/Techstars/Antler datasets), n=568 companies, calibrated 2026-09-05",
        "Internal Scouter scrape (Apify YC/Techstars/Antler datasets), n=621 companies, calibrated 2026-09-05",
        "Internal Scouter scrape (Apify YC/Techstars/Antler datasets), n=569 companies, calibrated 2026-09-05"
      ],
      "constraints": {}
    },
    "techstars": {
      "name": "Techstars",
      "region": "US / Global",
      "archetype": "Program-specific accelerator network favoring strong teams, commercial execution, domain fit and mentor/corporate leverage.",
      "founder_targets": {
        "technical_depth": 0.62,
        "research_depth": 0.32,
        "elite_academic": 0.35,
        "elite_employer": 0.42,
        "repeat_founder": 0.42,
        "prior_exit": 0.18,
        "early_career": 0.42,
        "product_builder": 0.78,
        "enterprise_gtm": 0.78,
        "domain_expertise": 0.83,
        "speed": 0.78,
        "global_ambition": 0.78,
        "cofounder_complementarity": 0.84,
        "customer_obsession": 0.85
      },
      "company_targets": {
        "ai_native": 0.63,
        "technical_differentiation": 0.6,
        "defensible_ip": 0.42,
        "software_high_margin": 0.7,
        "capital_intensive": 0.48,
        "enterprise_b2b": 0.72,
        "consumer": 0.42,
        "developer_facing": 0.38,
        "regulated_market": 0.55,
        "traction": 0.72,
        "revenue": 0.58,
        "speed_ship": 0.78,
        "global_market": 0.72,
        "local_market_fit": 0.6,
        "team_small": 0.7,
        "proprietary_data": 0.48
      },
      "category_affinity": {
        "ai_agents": 0.72,
        "ai_infra": 0.6,
        "developer_tools": 0.58,
        "vertical_ai": 0.82,
        "voice_ai": 0.66,
        "physical_ai_robotics": 0.63,
        "cyber_security": 0.66,
        "fintech": 0.72,
        "health_bio": 0.75,
        "climate_energy": 0.72,
        "industrial_deeptech": 0.7,
        "semiconductors": 0.5,
        "defense_dualuse": 0.48,
        "consumer": 0.5,
        "gaming": 0.4,
        "marketplace": 0.55,
        "web3": 0.32,
        "scientific_ai": 0.62,
        "enterprise_saas": 0.82,
        "hardware": 0.58
      },
      "stage_affinity": {
        "pre_idea": 0.1,
        "idea": 0.28,
        "prototype": 0.7,
        "launched": 0.92,
        "pre_seed": 0.9,
        "seed": 0.82,
        "series_a": 0.35
      },
      "geo_affinity": {
        "us": 0.94,
        "europe": 0.72,
        "latam": 0.65,
        "mena": 0.6,
        "asia": 0.72,
        "global": 0.9,
        "sf": 0.72,
        "abu_dhabi": 0.3,
        "saudi": 0.3,
        "chile": 0.38
      },
      "years": {
        "2024": {
          "trend_tags": [
            "AI share rising",
            "sustainability",
            "future of work",
            "healthtech",
            "program-specific verticals"
          ],
          "founder_overrides": {},
          "company_overrides": {
            "ai_native": 0.55
          },
          "category_overrides": {
            "health_bio": 0.173,
            "ai_infra": 0.447,
            "fintech": 0.163,
            "hardware": 0.083,
            "physical_ai_robotics": 0.137,
            "enterprise_saas": 0.14,
            "developer_tools": 0.04,
            "consumer": 0.08,
            "climate_energy": 0.163,
            "industrial_deeptech": 0.07,
            "web3": 0.02,
            "cyber_security": 0.017,
            "marketplace": 0.03
          },
          "stage_overrides": {},
          "notes": "Spring 2024: 268 companies, 23 accelerators; AI represented 36% and was rising. [DATA LIMITATION] Source scrape has NO founder-level data (no names/bios) - founder_targets/overrides remain hand-authored priors, NOT empirically calibrated. [DATA-CALIBRATED] category mix from real industry/sector tags (n=300, mapped categories: ai_infra, climate_energy, consumer, cyber_security, developer_tools, enterprise_saas, fintech, hardware, health_bio, industrial_deeptech, marketplace, physical_ai_robotics, web3).",
          "confidence": "high"
        },
        "2025": {
          "trend_tags": [
            "50+ AI startups in fall network",
            "digital health",
            "space",
            "cleantech",
            "manufacturing"
          ],
          "founder_overrides": {},
          "company_overrides": {
            "ai_native": 0.66
          },
          "category_overrides": {
            "health_bio": 0.29,
            "industrial_deeptech": 0.05,
            "climate_energy": 0.086,
            "ai_infra": 0.489,
            "marketplace": 0.068,
            "enterprise_saas": 0.33,
            "fintech": 0.122,
            "hardware": 0.068,
            "physical_ai_robotics": 0.09,
            "cyber_security": 0.072,
            "web3": 0.036,
            "developer_tools": 0.005,
            "consumer": 0.032
          },
          "stage_overrides": {},
          "notes": "Network remained diversified while AI became a major cross-program layer. [DATA LIMITATION] Source scrape has NO founder-level data (no names/bios) - founder_targets/overrides remain hand-authored priors, NOT empirically calibrated. [DATA-CALIBRATED] category mix from real industry/sector tags (n=221, mapped categories: ai_infra, climate_energy, consumer, cyber_security, developer_tools, enterprise_saas, fintech, hardware, health_bio, industrial_deeptech, marketplace, physical_ai_robotics, web3).",
          "confidence": "high"
        },
        "2026": {
          "trend_tags": [
            "AI/ML",
            "digital health",
            "HR tech",
            "deep tech",
            "revenue operations",
            "circular economy"
          ],
          "founder_overrides": {},
          "company_overrides": {
            "ai_native": 0.72,
            "traction": 0.74
          },
          "category_overrides": {
            "vertical_ai": 0.88,
            "industrial_deeptech": 0.123,
            "hardware": 0.046,
            "ai_infra": 0.615,
            "health_bio": 0.277,
            "cyber_security": 0.031,
            "developer_tools": 0.031,
            "enterprise_saas": 0.462,
            "fintech": 0.108,
            "consumer": 0.092,
            "physical_ai_robotics": 0.2,
            "climate_energy": 0.062,
            "marketplace": 0.031
          },
          "stage_overrides": {},
          "notes": "Spring/Tokyo 2026 cohorts show broad AI plus sector-specialist programs. [DATA LIMITATION] Source scrape has NO founder-level data (no names/bios) - founder_targets/overrides remain hand-authored priors, NOT empirically calibrated. [DATA-CALIBRATED] category mix from real industry/sector tags (n=65, mapped categories: ai_infra, climate_energy, consumer, cyber_security, developer_tools, enterprise_saas, fintech, hardware, health_bio, industrial_deeptech, marketplace, physical_ai_robotics).",
          "confidence": "high"
        }
      },
      "sources": [
        "https://www.techstars.com/",
        "https://www.techstars.com/newsroom/meet-the-startups-joining-techstars-spring-2026-accelerator-programs",
        "Internal Scouter scrape (Apify YC/Techstars/Antler datasets), n=221 companies, calibrated 2026-09-05",
        "Internal Scouter scrape (Apify YC/Techstars/Antler datasets), n=65 companies, calibrated 2026-09-05",
        "Internal Scouter scrape (Apify YC/Techstars/Antler datasets), n=300 companies, calibrated 2026-09-05"
      ],
      "constraints": {}
    },
    "500_global": {
      "name": "500 Global Flagship",
      "region": "US / Global",
      "archetype": "Globally sourced early-stage tech founders with evidence of product-market learning, growth discipline and cross-border scale potential.",
      "founder_targets": {
        "technical_depth": 0.6,
        "research_depth": 0.28,
        "elite_academic": 0.35,
        "elite_employer": 0.48,
        "repeat_founder": 0.45,
        "prior_exit": 0.2,
        "early_career": 0.42,
        "product_builder": 0.82,
        "enterprise_gtm": 0.76,
        "domain_expertise": 0.74,
        "speed": 0.84,
        "global_ambition": 0.98,
        "cofounder_complementarity": 0.78,
        "customer_obsession": 0.9
      },
      "company_targets": {
        "ai_native": 0.7,
        "technical_differentiation": 0.6,
        "defensible_ip": 0.35,
        "software_high_margin": 0.8,
        "capital_intensive": 0.28,
        "enterprise_b2b": 0.74,
        "consumer": 0.42,
        "developer_facing": 0.45,
        "regulated_market": 0.38,
        "traction": 0.72,
        "revenue": 0.6,
        "speed_ship": 0.86,
        "global_market": 0.96,
        "local_market_fit": 0.4,
        "team_small": 0.78,
        "proprietary_data": 0.44
      },
      "category_affinity": {
        "ai_agents": 0.82,
        "ai_infra": 0.76,
        "developer_tools": 0.68,
        "vertical_ai": 0.88,
        "voice_ai": 0.68,
        "physical_ai_robotics": 0.48,
        "cyber_security": 0.68,
        "fintech": 0.75,
        "health_bio": 0.62,
        "climate_energy": 0.52,
        "industrial_deeptech": 0.48,
        "semiconductors": 0.35,
        "defense_dualuse": 0.32,
        "consumer": 0.55,
        "gaming": 0.42,
        "marketplace": 0.62,
        "web3": 0.38,
        "scientific_ai": 0.5,
        "enterprise_saas": 0.9,
        "hardware": 0.35
      },
      "stage_affinity": {
        "pre_idea": 0.05,
        "idea": 0.2,
        "prototype": 0.68,
        "launched": 0.95,
        "pre_seed": 0.92,
        "seed": 0.78,
        "series_a": 0.25
      },
      "geo_affinity": {
        "us": 0.82,
        "europe": 0.72,
        "latam": 0.78,
        "mena": 0.74,
        "asia": 0.82,
        "global": 1.0,
        "sf": 0.82,
        "abu_dhabi": 0.38,
        "saudi": 0.45,
        "chile": 0.48
      },
      "years": {
        "2024": {
          "trend_tags": [
            "AI infrastructure",
            "AI-enabled vertical software",
            "global founder mix",
            "PMF faster"
          ],
          "founder_overrides": {},
          "company_overrides": {
            "ai_native": 0.72
          },
          "category_overrides": {
            "ai_infra": 0.82,
            "vertical_ai": 0.86
          },
          "stage_overrides": {},
          "notes": "Batch 34: 16 startups; at least nine directly in AI infrastructure or AI-enabled verticals.",
          "confidence": "high"
        },
        "2025": {
          "trend_tags": [
            "agentic workflows",
            "B2B AI",
            "growth efficiency",
            "security"
          ],
          "founder_overrides": {},
          "company_overrides": {
            "ai_native": 0.78,
            "enterprise_b2b": 0.8
          },
          "category_overrides": {
            "ai_agents": 0.88,
            "cyber_security": 0.75
          },
          "stage_overrides": {},
          "notes": "Flagship remained cross-border and increasingly AI-native.",
          "confidence": "medium"
        },
        "2026": {
          "trend_tags": [
            "AI ops",
            "synthetic data",
            "agentic security",
            "prompt-driven infrastructure",
            "global reach"
          ],
          "founder_overrides": {},
          "company_overrides": {
            "ai_native": 0.84,
            "technical_differentiation": 0.64
          },
          "category_overrides": {
            "ai_agents": 0.91,
            "ai_infra": 0.86,
            "cyber_security": 0.8
          },
          "stage_overrides": {},
          "notes": "Batch 36/37 era: AI ops, agentic security and infrastructure are recurring patterns.",
          "confidence": "medium"
        }
      },
      "sources": [
        "https://500.co/strategy/flagship",
        "https://programs.500.co/content/christine-s-quarterly-letter-q1-24-in-review-and-outlook",
        "https://flagship.aplica.500.co/"
      ],
      "constraints": {}
    },
    "speedrun": {
      "name": "a16z speedrun",
      "region": "US / Global",
      "archetype": "Extremely selective pre-seed/seed program that prioritizes founder background over the initial idea: zero-to-one agency, rapid execution, earned secrets, complementary founder teams, internal product-building ability, clear market validation and outlier evidence. Its portfolio shifted sharply from gaming-heavy cohorts in 2024 toward AI agents, vertical AI and infrastructure by 2025–2026.",
      "founder_targets": {
        "technical_depth": 0.9,
        "research_depth": 0.52,
        "elite_academic": 0.5,
        "elite_employer": 0.6,
        "repeat_founder": 0.52,
        "prior_exit": 0.3,
        "early_career": 0.68,
        "product_builder": 0.98,
        "enterprise_gtm": 0.72,
        "domain_expertise": 0.92,
        "speed": 1.0,
        "global_ambition": 0.96,
        "cofounder_complementarity": 0.94,
        "customer_obsession": 0.96
      },
      "company_targets": {
        "ai_native": 0.92,
        "technical_differentiation": 0.92,
        "defensible_ip": 0.52,
        "software_high_margin": 0.82,
        "capital_intensive": 0.4,
        "enterprise_b2b": 0.68,
        "consumer": 0.58,
        "developer_facing": 0.64,
        "regulated_market": 0.3,
        "traction": 0.74,
        "revenue": 0.48,
        "speed_ship": 1.0,
        "global_market": 0.96,
        "local_market_fit": 0.18,
        "team_small": 0.93,
        "proprietary_data": 0.5
      },
      "category_affinity": {
        "ai_agents": 0.98,
        "ai_infra": 0.91,
        "developer_tools": 0.88,
        "vertical_ai": 0.88,
        "voice_ai": 0.8,
        "physical_ai_robotics": 0.72,
        "cyber_security": 0.68,
        "fintech": 0.66,
        "health_bio": 0.5,
        "climate_energy": 0.3,
        "industrial_deeptech": 0.48,
        "semiconductors": 0.48,
        "defense_dualuse": 0.46,
        "consumer": 0.82,
        "gaming": 0.72,
        "marketplace": 0.45,
        "web3": 0.4,
        "scientific_ai": 0.58,
        "enterprise_saas": 0.8,
        "hardware": 0.48
      },
      "stage_affinity": {
        "pre_idea": 0.16,
        "idea": 0.46,
        "prototype": 0.9,
        "launched": 0.98,
        "pre_seed": 1.0,
        "seed": 0.8,
        "series_a": 0.12
      },
      "geo_affinity": {
        "us": 0.94,
        "europe": 0.72,
        "latam": 0.58,
        "mena": 0.55,
        "asia": 0.62,
        "global": 0.96,
        "sf": 1.0,
        "abu_dhabi": 0.2,
        "saudi": 0.2,
        "chile": 0.22,
        "la": 0.62,
        "nyc": 0.72
      },
      "years": {
        "2024": {
          "trend_tags": [
            "gaming-first DNA",
            "AI emerging inside gaming/consumer",
            "creator and interactive entertainment",
            "small technical teams",
            "tech x games"
          ],
          "founder_overrides": {
            "technical_depth": 0.84,
            "product_builder": 0.95,
            "speed": 0.98,
            "domain_expertise": 0.78,
            "cofounder_complementarity": 0.84
          },
          "company_overrides": {
            "ai_native": 0.74,
            "team_small": 0.82,
            "traction": 0.64,
            "speed_ship": 0.98,
            "technical_differentiation": 0.84
          },
          "category_overrides": {
            "ai_agents": 0.841,
            "ai_infra": 0.662,
            "developer_tools": 0.655,
            "vertical_ai": 0.868,
            "voice_ai": 0.568,
            "physical_ai_robotics": 0.516,
            "cyber_security": 0.538,
            "fintech": 0.501,
            "health_bio": 0.52,
            "climate_energy": 0.33,
            "industrial_deeptech": 0.456,
            "semiconductors": 0.375,
            "defense_dualuse": 0.51,
            "consumer": 0.687,
            "gaming": 0.93,
            "marketplace": 0.449,
            "web3": 0.355,
            "scientific_ai": 0.481,
            "enterprise_saas": 0.595,
            "hardware": 0.375
          },
          "stage_overrides": {
            "prototype": 0.9,
            "launched": 0.98,
            "pre_seed": 1.0
          },
          "notes": "[DATA-CALIBRATED] Current directory snapshot contains 57 companies across SR002+SR003. Explicit AI-tag/description share 56.1%; gaming 66.7%; mapped vertical-AI 42.1%; median employees 6; 47.4% have <=5 employees. Category mix, team-size and geography are empirical; founder-quality targets remain selection-prior based.",
          "confidence": "high"
        },
        "2025": {
          "trend_tags": [
            "gaming-to-tech expansion",
            "AI agents",
            "vertical AI",
            "consumer AI",
            "developer tools",
            "fintech and industrial AI"
          ],
          "founder_overrides": {
            "technical_depth": 0.89,
            "product_builder": 0.97,
            "speed": 1.0,
            "domain_expertise": 0.87,
            "cofounder_complementarity": 0.88,
            "customer_obsession": 0.91
          },
          "company_overrides": {
            "ai_native": 0.88,
            "team_small": 0.85,
            "traction": 0.7,
            "speed_ship": 1.0,
            "technical_differentiation": 0.89
          },
          "category_overrides": {
            "ai_agents": 0.969,
            "ai_infra": 0.678,
            "developer_tools": 0.659,
            "vertical_ai": 0.97,
            "voice_ai": 0.626,
            "physical_ai_robotics": 0.58,
            "cyber_security": 0.425,
            "fintech": 0.672,
            "health_bio": 0.539,
            "climate_energy": 0.33,
            "industrial_deeptech": 0.546,
            "semiconductors": 0.375,
            "defense_dualuse": 0.5,
            "consumer": 0.785,
            "gaming": 0.711,
            "marketplace": 0.526,
            "web3": 0.446,
            "scientific_ai": 0.491,
            "enterprise_saas": 0.69,
            "hardware": 0.488
          },
          "stage_overrides": {
            "prototype": 0.9,
            "launched": 0.98,
            "pre_seed": 1.0,
            "seed": 0.78
          },
          "notes": "[DATA-CALIBRATED] 98 companies across SR004+SR005. AI share 78.6%; mapped AI-agents 53.1%; vertical-AI 59.2%; gaming falls to 18.4%; median employees 5. March 2025 marked Speedrun's explicit expansion beyond gaming into tech, entertainment and AI.",
          "confidence": "high"
        },
        "2026": {
          "trend_tags": [
            "AI agents become dominant",
            "vertical AI",
            "AI infrastructure",
            "tiny teams",
            "cofounder density",
            "SF concentration",
            "earned secrets and velocity",
            "early customer validation"
          ],
          "founder_overrides": {
            "technical_depth": 0.93,
            "product_builder": 0.99,
            "speed": 1.0,
            "domain_expertise": 0.95,
            "cofounder_complementarity": 0.96,
            "customer_obsession": 0.97,
            "repeat_founder": 0.56,
            "elite_employer": 0.62
          },
          "company_overrides": {
            "ai_native": 0.96,
            "team_small": 0.92,
            "traction": 0.78,
            "speed_ship": 1.0,
            "technical_differentiation": 0.94,
            "enterprise_b2b": 0.76
          },
          "category_overrides": {
            "ai_agents": 0.995,
            "ai_infra": 0.741,
            "developer_tools": 0.609,
            "vertical_ai": 0.961,
            "voice_ai": 0.589,
            "physical_ai_robotics": 0.551,
            "cyber_security": 0.519,
            "fintech": 0.661,
            "health_bio": 0.569,
            "climate_energy": 0.33,
            "industrial_deeptech": 0.552,
            "semiconductors": 0.375,
            "defense_dualuse": 0.464,
            "consumer": 0.671,
            "gaming": 0.551,
            "marketplace": 0.544,
            "web3": 0.422,
            "scientific_ai": 0.467,
            "enterprise_saas": 0.738,
            "hardware": 0.524
          },
          "stage_overrides": {
            "prototype": 0.92,
            "launched": 0.98,
            "pre_seed": 1.0,
            "seed": 0.82
          },
          "notes": "[DATA-CALIBRATED] 77 disclosed companies across SR006+partial SR007. AI share 90.9%; AI-agents 71.4%; vertical-AI 68.8%; AI-infra 19.5%; gaming only 3.9%; median employees 4; 68.8% have <=5 employees; 68.8% are SF/Bay Area based. SR007 remains in progress, so 2026 category estimates are provisional.",
          "confidence": "high"
        }
      },
      "sources": [
        "https://speedrun.a16z.com/faq",
        "https://a16z.com/applications-for-a16z-speedrun-sr007-are-now-open/",
        "https://speedrun.a16z.com/companies",
        "https://a16z.com/meet-the-new-a16z-speedrun/",
        "https://a16z.com/applications-for-sr005-are-officially-open/",
        "https://a16z.com/a16z-speedrun-application-winter-spring-2026/",
        "https://speedrun.substack.com/p/what-we-look-for-in-applications",
        "https://a16z.com/newsletter/big-ideas-2026-part-1/",
        "Internal Scouter Speedrun directory export parsed 2026-09-05, n=256 current directory entries"
      ],
      "constraints": {},
      "entity_type": "accelerator_investor",
      "cohorts": {
        "002": {
          "year": "2024",
          "period": "Winter/Spring 2024",
          "program_location": "San Francisco",
          "coverage_status": "current-directory survivorship sample",
          "coverage_note": "25 companies remain in the supplied current directory snapshot; contemporaneous a16z posts described 35+ SR002 startups, so this is not a complete historical census.",
          "confidence": "medium",
          "sources": [
            "https://www.linkedin.com/posts/a16z_35-gaming-startups-10-weeks-of-pure-hustle-activity-7177073031175950339-kLax",
            "https://startupintros.com/news/2024-03-20-a16z-speedrun-sr002"
          ],
          "founder_overrides": {
            "technical_depth": 0.82,
            "product_builder": 0.94,
            "speed": 0.98,
            "domain_expertise": 0.74,
            "cofounder_complementarity": 0.82
          },
          "company_overrides": {
            "ai_native": 0.802,
            "team_small": 0.82,
            "traction": 0.6,
            "speed_ship": 1.0,
            "technical_differentiation": 0.8
          },
          "category_affinity": {
            "ai_agents": 0.784,
            "ai_infra": 0.658,
            "developer_tools": 0.561,
            "vertical_ai": 0.83,
            "voice_ai": 0.423,
            "physical_ai_robotics": 0.408,
            "cyber_security": 0.577,
            "fintech": 0.522,
            "health_bio": 0.369,
            "climate_energy": 0.333,
            "industrial_deeptech": 0.365,
            "semiconductors": 0.365,
            "defense_dualuse": 0.486,
            "consumer": 0.602,
            "gaming": 0.95,
            "marketplace": 0.484,
            "web3": 0.351,
            "scientific_ai": 0.507,
            "enterprise_saas": 0.598,
            "hardware": 0.365
          },
          "stage_affinity": {
            "idea": 0.46,
            "prototype": 0.91,
            "launched": 0.98,
            "pre_seed": 1.0,
            "seed": 0.8,
            "series_a": 0.12
          },
          "geo_affinity": {
            "us": 0.955,
            "sf": 0.92,
            "la": 0.442,
            "nyc": 0.42,
            "global": 0.94,
            "europe": 0.7,
            "latam": 0.56,
            "mena": 0.54,
            "asia": 0.62
          },
          "observed_snapshot_stats": {
            "n": 25,
            "cohorts": [
              "002"
            ],
            "ai_share": 0.56,
            "median_employees": 7,
            "mean_employees": 11.44,
            "small_team_le5_share": 0.4,
            "small_team_le10_share": 0.68,
            "avg_founder_profiles": 1.84,
            "solo_founder_profile_share": 0.44,
            "three_plus_founder_profile_share": 0.24,
            "sf_bay_share": 0.44,
            "la_share": 0.12,
            "nyc_share": 0.04,
            "us_share": 0.84,
            "category_share": {
              "ai_agents": 0.28,
              "ai_infra": 0.12,
              "developer_tools": 0.04,
              "vertical_ai": 0.4,
              "voice_ai": 0.0,
              "physical_ai_robotics": 0.0,
              "cyber_security": 0.08,
              "fintech": 0.04,
              "health_bio": 0.0,
              "climate_energy": 0.0,
              "industrial_deeptech": 0.0,
              "semiconductors": 0.0,
              "defense_dualuse": 0.04,
              "consumer": 0.08,
              "gaming": 0.76,
              "marketplace": 0.04,
              "web3": 0.0,
              "scientific_ai": 0.04,
              "enterprise_saas": 0.08,
              "hardware": 0.0
            },
            "traction_mention_proxy": 0.12,
            "repeat_founder_mention_proxy": 0.0,
            "exit_mention_proxy": 0.0,
            "elite_employer_mention_proxy": 0.0,
            "elite_academic_mention_proxy": 0.0,
            "research_mention_proxy": 0.04
          },
          "vector_semantics": "Hybrid cohort-DNA vector: empirical category/team/geography composition from the current Speedrun directory snapshot + official Speedrun selection priors for founder-quality dimensions. Not an acceptance probability and not necessarily a complete historical roster."
        },
        "003": {
          "year": "2024",
          "period": "2024-07-29 to 2024-10-20",
          "program_location": "Los Angeles",
          "coverage_status": "high-coverage directory sample",
          "coverage_note": "32 companies are present in the supplied snapshot, matching the 32 companies described in the SR003 Demo Day post.",
          "confidence": "high",
          "sources": [
            "https://www.linkedin.com/posts/a16zspeedrun_speedrun-application-activity-7192292038254452736-psdz",
            "https://www.linkedin.com/posts/a16zspeedrun_demo-day-ft-sr003-32-companies-pitched-activity-7252361640048828416-xSAL"
          ],
          "founder_overrides": {
            "technical_depth": 0.85,
            "product_builder": 0.96,
            "speed": 1.0,
            "domain_expertise": 0.8,
            "cofounder_complementarity": 0.86
          },
          "company_overrides": {
            "ai_native": 0.803,
            "team_small": 0.859,
            "traction": 0.64,
            "speed_ship": 1.0,
            "technical_differentiation": 0.83
          },
          "category_affinity": {
            "ai_agents": 0.867,
            "ai_infra": 0.617,
            "developer_tools": 0.685,
            "vertical_ai": 0.902,
            "voice_ai": 0.598,
            "physical_ai_robotics": 0.532,
            "cyber_security": 0.401,
            "fintech": 0.398,
            "health_bio": 0.584,
            "climate_energy": 0.333,
            "industrial_deeptech": 0.489,
            "semiconductors": 0.365,
            "defense_dualuse": 0.536,
            "consumer": 0.731,
            "gaming": 0.95,
            "marketplace": 0.36,
            "web3": 0.351,
            "scientific_ai": 0.383,
            "enterprise_saas": 0.546,
            "hardware": 0.365
          },
          "stage_affinity": {
            "idea": 0.46,
            "prototype": 0.91,
            "launched": 0.98,
            "pre_seed": 1.0,
            "seed": 0.8,
            "series_a": 0.12
          },
          "geo_affinity": {
            "us": 0.965,
            "sf": 0.626,
            "la": 0.82,
            "nyc": 0.463,
            "global": 0.94,
            "europe": 0.7,
            "latam": 0.56,
            "mena": 0.54,
            "asia": 0.62
          },
          "observed_snapshot_stats": {
            "n": 32,
            "cohorts": [
              "003"
            ],
            "ai_share": 0.562,
            "median_employees": 5.0,
            "mean_employees": 8.88,
            "small_team_le5_share": 0.531,
            "small_team_le10_share": 0.75,
            "avg_founder_profiles": 2.12,
            "solo_founder_profile_share": 0.25,
            "three_plus_founder_profile_share": 0.25,
            "sf_bay_share": 0.281,
            "la_share": 0.219,
            "nyc_share": 0.125,
            "us_share": 0.875,
            "category_share": {
              "ai_agents": 0.344,
              "ai_infra": 0.062,
              "developer_tools": 0.125,
              "vertical_ai": 0.438,
              "voice_ai": 0.062,
              "physical_ai_robotics": 0.031,
              "cyber_security": 0.0,
              "fintech": 0.0,
              "health_bio": 0.094,
              "climate_energy": 0.0,
              "industrial_deeptech": 0.031,
              "semiconductors": 0.0,
              "defense_dualuse": 0.062,
              "consumer": 0.188,
              "gaming": 0.594,
              "marketplace": 0.0,
              "web3": 0.0,
              "scientific_ai": 0.0,
              "enterprise_saas": 0.031,
              "hardware": 0.0
            },
            "traction_mention_proxy": 0.031,
            "repeat_founder_mention_proxy": 0.0,
            "exit_mention_proxy": 0.0,
            "elite_employer_mention_proxy": 0.0,
            "elite_academic_mention_proxy": 0.031,
            "research_mention_proxy": 0.0
          },
          "vector_semantics": "Hybrid cohort-DNA vector: empirical category/team/geography composition from the current Speedrun directory snapshot + official Speedrun selection priors for founder-quality dimensions. Not an acceptance probability and not necessarily a complete historical roster."
        },
        "004": {
          "year": "2025",
          "period": "Jan–Mar 2025",
          "demo_day": "2025-03-18",
          "program_location": "San Francisco",
          "coverage_status": "current-directory snapshot",
          "coverage_note": "41 companies are present; no complete official roster count was used as a denominator.",
          "confidence": "medium",
          "sources": [
            "https://a16z.com/meet-the-new-a16z-speedrun/",
            "https://speedrun.substack.com/p/lessons-learned-during-the-founders-journey"
          ],
          "founder_overrides": {
            "technical_depth": 0.87,
            "product_builder": 0.96,
            "speed": 1.0,
            "domain_expertise": 0.83,
            "cofounder_complementarity": 0.88
          },
          "company_overrides": {
            "ai_native": 0.813,
            "team_small": 0.81,
            "traction": 0.66,
            "speed_ship": 1.0,
            "technical_differentiation": 0.86
          },
          "category_affinity": {
            "ai_agents": 0.978,
            "ai_infra": 0.641,
            "developer_tools": 0.576,
            "vertical_ai": 0.978,
            "voice_ai": 0.665,
            "physical_ai_robotics": 0.606,
            "cyber_security": 0.401,
            "fintech": 0.739,
            "health_bio": 0.567,
            "climate_energy": 0.333,
            "industrial_deeptech": 0.365,
            "semiconductors": 0.365,
            "defense_dualuse": 0.5,
            "consumer": 0.93,
            "gaming": 0.931,
            "marketplace": 0.672,
            "web3": 0.549,
            "scientific_ai": 0.383,
            "enterprise_saas": 0.621,
            "hardware": 0.504
          },
          "stage_affinity": {
            "idea": 0.46,
            "prototype": 0.91,
            "launched": 0.98,
            "pre_seed": 1.0,
            "seed": 0.8,
            "series_a": 0.12
          },
          "geo_affinity": {
            "us": 0.938,
            "sf": 0.92,
            "la": 0.418,
            "nyc": 0.498,
            "global": 0.94,
            "europe": 0.7,
            "latam": 0.56,
            "mena": 0.54,
            "asia": 0.62
          },
          "observed_snapshot_stats": {
            "n": 41,
            "cohorts": [
              "004"
            ],
            "ai_share": 0.585,
            "median_employees": 7,
            "mean_employees": 8.37,
            "small_team_le5_share": 0.366,
            "small_team_le10_share": 0.78,
            "avg_founder_profiles": 2.05,
            "solo_founder_profile_share": 0.268,
            "three_plus_founder_profile_share": 0.244,
            "sf_bay_share": 0.39,
            "la_share": 0.073,
            "nyc_share": 0.195,
            "us_share": 0.78,
            "category_share": {
              "ai_agents": 0.341,
              "ai_infra": 0.049,
              "developer_tools": 0.024,
              "vertical_ai": 0.366,
              "voice_ai": 0.073,
              "physical_ai_robotics": 0.049,
              "cyber_security": 0.0,
              "fintech": 0.146,
              "health_bio": 0.049,
              "climate_energy": 0.0,
              "industrial_deeptech": 0.0,
              "semiconductors": 0.0,
              "defense_dualuse": 0.024,
              "consumer": 0.317,
              "gaming": 0.341,
              "marketplace": 0.122,
              "web3": 0.049,
              "scientific_ai": 0.0,
              "enterprise_saas": 0.049,
              "hardware": 0.024
            },
            "traction_mention_proxy": 0.024,
            "repeat_founder_mention_proxy": 0.0,
            "exit_mention_proxy": 0.0,
            "elite_employer_mention_proxy": 0.0,
            "elite_academic_mention_proxy": 0.0,
            "research_mention_proxy": 0.0
          },
          "vector_semantics": "Hybrid cohort-DNA vector: empirical category/team/geography composition from the current Speedrun directory snapshot + official Speedrun selection priors for founder-quality dimensions. Not an acceptance probability and not necessarily a complete historical roster."
        },
        "005": {
          "year": "2025",
          "period": "2025-07-28 to 2025-10-10",
          "program_location": "Los Angeles",
          "coverage_status": "high-coverage directory sample",
          "coverage_note": "57 companies are present in the supplied snapshot; official Speedrun coverage described 58 founders at SR005 Demo Day, so the directory is treated as high coverage but not a proven census.",
          "confidence": "high",
          "sources": [
            "https://a16z.com/applications-for-sr005-are-officially-open/",
            "https://speedrun.substack.com/p/58-founders-2-minutes-to-pitch-scenes"
          ],
          "founder_overrides": {
            "technical_depth": 0.91,
            "product_builder": 0.98,
            "speed": 1.0,
            "domain_expertise": 0.91,
            "cofounder_complementarity": 0.9,
            "customer_obsession": 0.93
          },
          "company_overrides": {
            "ai_native": 0.969,
            "team_small": 0.893,
            "traction": 0.73,
            "speed_ship": 1.0,
            "technical_differentiation": 0.91
          },
          "category_affinity": {
            "ai_agents": 0.964,
            "ai_infra": 0.661,
            "developer_tools": 0.656,
            "vertical_ai": 0.978,
            "voice_ai": 0.588,
            "physical_ai_robotics": 0.552,
            "cyber_security": 0.401,
            "fintech": 0.645,
            "health_bio": 0.534,
            "climate_energy": 0.333,
            "industrial_deeptech": 0.584,
            "semiconductors": 0.365,
            "defense_dualuse": 0.505,
            "consumer": 0.713,
            "gaming": 0.573,
            "marketplace": 0.443,
            "web3": 0.351,
            "scientific_ai": 0.5,
            "enterprise_saas": 0.697,
            "hardware": 0.482
          },
          "stage_affinity": {
            "idea": 0.46,
            "prototype": 0.91,
            "launched": 0.98,
            "pre_seed": 1.0,
            "seed": 0.8,
            "series_a": 0.12
          },
          "geo_affinity": {
            "us": 0.98,
            "sf": 0.735,
            "la": 0.82,
            "nyc": 0.506,
            "global": 0.94,
            "europe": 0.7,
            "latam": 0.56,
            "mena": 0.54,
            "asia": 0.62
          },
          "observed_snapshot_stats": {
            "n": 57,
            "cohorts": [
              "005"
            ],
            "ai_share": 0.93,
            "median_employees": 5.0,
            "mean_employees": 6.36,
            "small_team_le5_share": 0.643,
            "small_team_le10_share": 0.893,
            "avg_founder_profiles": 1.88,
            "solo_founder_profile_share": 0.298,
            "three_plus_founder_profile_share": 0.123,
            "sf_bay_share": 0.491,
            "la_share": 0.158,
            "nyc_share": 0.211,
            "us_share": 0.93,
            "category_share": {
              "ai_agents": 0.667,
              "ai_infra": 0.123,
              "developer_tools": 0.123,
              "vertical_ai": 0.754,
              "voice_ai": 0.07,
              "physical_ai_robotics": 0.053,
              "cyber_security": 0.0,
              "fintech": 0.158,
              "health_bio": 0.07,
              "climate_energy": 0.0,
              "industrial_deeptech": 0.123,
              "semiconductors": 0.0,
              "defense_dualuse": 0.053,
              "consumer": 0.211,
              "gaming": 0.07,
              "marketplace": 0.018,
              "web3": 0.0,
              "scientific_ai": 0.035,
              "enterprise_saas": 0.193,
              "hardware": 0.035
            },
            "traction_mention_proxy": 0.088,
            "repeat_founder_mention_proxy": 0.0,
            "exit_mention_proxy": 0.0,
            "elite_employer_mention_proxy": 0.035,
            "elite_academic_mention_proxy": 0.035,
            "research_mention_proxy": 0.018
          },
          "vector_semantics": "Hybrid cohort-DNA vector: empirical category/team/geography composition from the current Speedrun directory snapshot + official Speedrun selection priors for founder-quality dimensions. Not an acceptance probability and not necessarily a complete historical roster."
        },
        "006": {
          "year": "2026",
          "period": "late Jan–Apr 2026",
          "demo_day": "2026-04-14",
          "program_location": "San Francisco",
          "coverage_status": "high-coverage current directory sample",
          "coverage_note": "58 companies are present. Speedrun says recent cohorts generally contain 60–70 teams; SR006 was selected from 19,000+ pitches at <0.4% acceptance.",
          "confidence": "high",
          "sources": [
            "https://a16z.com/a16z-speedrun-application-winter-spring-2026/",
            "https://speedrun.substack.com/p/what-we-look-for-in-applications",
            "https://speedrun.a16z.com/faq"
          ],
          "founder_overrides": {
            "technical_depth": 0.94,
            "product_builder": 0.99,
            "speed": 1.0,
            "domain_expertise": 0.96,
            "cofounder_complementarity": 0.96,
            "customer_obsession": 0.97,
            "elite_employer": 0.64,
            "repeat_founder": 0.56
          },
          "company_overrides": {
            "ai_native": 0.946,
            "team_small": 0.886,
            "traction": 0.8,
            "speed_ship": 1.0,
            "technical_differentiation": 0.95
          },
          "category_affinity": {
            "ai_agents": 0.996,
            "ai_infra": 0.696,
            "developer_tools": 0.521,
            "vertical_ai": 0.972,
            "voice_ai": 0.57,
            "physical_ai_robotics": 0.527,
            "cyber_security": 0.52,
            "fintech": 0.678,
            "health_bio": 0.575,
            "climate_energy": 0.333,
            "industrial_deeptech": 0.534,
            "semiconductors": 0.365,
            "defense_dualuse": 0.48,
            "consumer": 0.65,
            "gaming": 0.555,
            "marketplace": 0.566,
            "web3": 0.435,
            "scientific_ai": 0.467,
            "enterprise_saas": 0.739,
            "hardware": 0.534
          },
          "stage_affinity": {
            "idea": 0.46,
            "prototype": 0.91,
            "launched": 0.98,
            "pre_seed": 1.0,
            "seed": 0.8,
            "series_a": 0.12
          },
          "geo_affinity": {
            "us": 0.976,
            "sf": 0.92,
            "la": 0.389,
            "nyc": 0.504,
            "global": 0.94,
            "europe": 0.7,
            "latam": 0.56,
            "mena": 0.54,
            "asia": 0.62
          },
          "observed_snapshot_stats": {
            "n": 58,
            "cohorts": [
              "006"
            ],
            "ai_share": 0.879,
            "median_employees": 4.0,
            "mean_employees": 5.62,
            "small_team_le5_share": 0.621,
            "small_team_le10_share": 0.897,
            "avg_founder_profiles": 2.17,
            "solo_founder_profile_share": 0.155,
            "three_plus_founder_profile_share": 0.259,
            "sf_bay_share": 0.655,
            "la_share": 0.017,
            "nyc_share": 0.207,
            "us_share": 0.914,
            "category_share": {
              "ai_agents": 0.707,
              "ai_infra": 0.155,
              "developer_tools": 0.017,
              "vertical_ai": 0.69,
              "voice_ai": 0.052,
              "physical_ai_robotics": 0.034,
              "cyber_security": 0.034,
              "fintech": 0.19,
              "health_bio": 0.103,
              "climate_energy": 0.0,
              "industrial_deeptech": 0.069,
              "semiconductors": 0.0,
              "defense_dualuse": 0.034,
              "consumer": 0.121,
              "gaming": 0.052,
              "marketplace": 0.103,
              "web3": 0.017,
              "scientific_ai": 0.017,
              "enterprise_saas": 0.241,
              "hardware": 0.069
            },
            "traction_mention_proxy": 0.293,
            "repeat_founder_mention_proxy": 0.086,
            "exit_mention_proxy": 0.017,
            "elite_employer_mention_proxy": 0.172,
            "elite_academic_mention_proxy": 0.121,
            "research_mention_proxy": 0.052
          },
          "vector_semantics": "Hybrid cohort-DNA vector: empirical category/team/geography composition from the current Speedrun directory snapshot + official Speedrun selection priors for founder-quality dimensions. Not an acceptance probability and not necessarily a complete historical roster."
        },
        "007": {
          "year": "2026",
          "period": "2026-07-27 to 2026-10-11",
          "demo_day": "2026-10-06",
          "program_location": "San Francisco",
          "coverage_status": "partial in-progress cohort snapshot",
          "coverage_note": "Only 19 companies are present in the supplied snapshot as of 2026-09-05. SR007 is still in progress, so this cohort vector is explicitly provisional.",
          "confidence": "medium",
          "sources": [
            "https://a16z.com/applications-for-a16z-speedrun-sr007-are-now-open/",
            "https://speedrun.a16z.com/faq"
          ],
          "founder_overrides": {
            "technical_depth": 0.95,
            "product_builder": 0.99,
            "speed": 1.0,
            "domain_expertise": 0.96,
            "cofounder_complementarity": 0.97,
            "customer_obsession": 0.97
          },
          "company_overrides": {
            "ai_native": 1.0,
            "team_small": 0.968,
            "traction": 0.76,
            "speed_ship": 1.0,
            "technical_differentiation": 0.96
          },
          "category_affinity": {
            "ai_agents": 0.996,
            "ai_infra": 0.797,
            "developer_tools": 0.688,
            "vertical_ai": 0.959,
            "voice_ai": 0.568,
            "physical_ai_robotics": 0.554,
            "cyber_security": 0.401,
            "fintech": 0.602,
            "health_bio": 0.573,
            "climate_energy": 0.333,
            "industrial_deeptech": 0.616,
            "semiconductors": 0.365,
            "defense_dualuse": 0.362,
            "consumer": 0.677,
            "gaming": 0.408,
            "marketplace": 0.505,
            "web3": 0.351,
            "scientific_ai": 0.383,
            "enterprise_saas": 0.712,
            "hardware": 0.51
          },
          "stage_affinity": {
            "idea": 0.46,
            "prototype": 0.91,
            "launched": 0.98,
            "pre_seed": 1.0,
            "seed": 0.8,
            "series_a": 0.12
          },
          "geo_affinity": {
            "us": 0.971,
            "sf": 0.92,
            "la": 0.38,
            "nyc": 0.453,
            "global": 0.94,
            "europe": 0.7,
            "latam": 0.56,
            "mena": 0.54,
            "asia": 0.62
          },
          "observed_snapshot_stats": {
            "n": 19,
            "cohorts": [
              "007"
            ],
            "ai_share": 1.0,
            "median_employees": 3,
            "mean_employees": 3.42,
            "small_team_le5_share": 0.895,
            "small_team_le10_share": 1.0,
            "avg_founder_profiles": 2.21,
            "solo_founder_profile_share": 0.105,
            "three_plus_founder_profile_share": 0.316,
            "sf_bay_share": 0.789,
            "la_share": 0.0,
            "nyc_share": 0.105,
            "us_share": 0.895,
            "category_share": {
              "ai_agents": 0.737,
              "ai_infra": 0.316,
              "developer_tools": 0.158,
              "vertical_ai": 0.684,
              "voice_ai": 0.053,
              "physical_ai_robotics": 0.053,
              "cyber_security": 0.0,
              "fintech": 0.105,
              "health_bio": 0.105,
              "climate_energy": 0.0,
              "industrial_deeptech": 0.158,
              "semiconductors": 0.0,
              "defense_dualuse": 0.0,
              "consumer": 0.158,
              "gaming": 0.0,
              "marketplace": 0.053,
              "web3": 0.0,
              "scientific_ai": 0.0,
              "enterprise_saas": 0.211,
              "hardware": 0.053
            },
            "traction_mention_proxy": 0.0,
            "repeat_founder_mention_proxy": 0.0,
            "exit_mention_proxy": 0.0,
            "elite_employer_mention_proxy": 0.0,
            "elite_academic_mention_proxy": 0.053,
            "research_mention_proxy": 0.0
          },
          "vector_semantics": "Hybrid cohort-DNA vector: empirical category/team/geography composition from the current Speedrun directory snapshot + official Speedrun selection priors for founder-quality dimensions. Not an acceptance probability and not necessarily a complete historical roster."
        }
      },
      "observed_directory_stats": {
        "snapshot_as_of": "2026-09-05",
        "total_companies_parsed": 256,
        "cohort_counts": {
          "003": 32,
          "006": 58,
          "005": 57,
          "002": 25,
          "004": 41,
          "007": 19,
          "001": 24
        },
        "last_three_year_companies": 232,
        "year_stats": {
          "2024": {
            "n": 57,
            "cohorts": [
              "002",
              "003"
            ],
            "ai_share": 0.561,
            "median_employees": 6,
            "mean_employees": 10,
            "small_team_le5_share": 0.474,
            "small_team_le10_share": 0.719,
            "avg_founder_profiles": 2,
            "solo_founder_profile_share": 0.333,
            "three_plus_founder_profile_share": 0.246,
            "sf_bay_share": 0.351,
            "la_share": 0.175,
            "nyc_share": 0.088,
            "us_share": 0.86,
            "category_share": {
              "ai_agents": 0.316,
              "ai_infra": 0.088,
              "developer_tools": 0.088,
              "vertical_ai": 0.421,
              "voice_ai": 0.035,
              "physical_ai_robotics": 0.018,
              "cyber_security": 0.035,
              "fintech": 0.018,
              "health_bio": 0.053,
              "climate_energy": 0.0,
              "industrial_deeptech": 0.018,
              "semiconductors": 0.0,
              "defense_dualuse": 0.053,
              "consumer": 0.14,
              "gaming": 0.667,
              "marketplace": 0.018,
              "web3": 0.0,
              "scientific_ai": 0.018,
              "enterprise_saas": 0.053,
              "hardware": 0.0
            },
            "traction_mention_proxy": 0.07,
            "repeat_founder_mention_proxy": 0.0,
            "exit_mention_proxy": 0.0,
            "elite_employer_mention_proxy": 0.0,
            "elite_academic_mention_proxy": 0.018,
            "research_mention_proxy": 0.018
          },
          "2025": {
            "n": 98,
            "cohorts": [
              "004",
              "005"
            ],
            "ai_share": 0.786,
            "median_employees": 5,
            "mean_employees": 7.21,
            "small_team_le5_share": 0.526,
            "small_team_le10_share": 0.845,
            "avg_founder_profiles": 1.95,
            "solo_founder_profile_share": 0.286,
            "three_plus_founder_profile_share": 0.173,
            "sf_bay_share": 0.449,
            "la_share": 0.122,
            "nyc_share": 0.204,
            "us_share": 0.867,
            "category_share": {
              "ai_agents": 0.531,
              "ai_infra": 0.092,
              "developer_tools": 0.082,
              "vertical_ai": 0.592,
              "voice_ai": 0.071,
              "physical_ai_robotics": 0.051,
              "cyber_security": 0.0,
              "fintech": 0.153,
              "health_bio": 0.061,
              "climate_energy": 0.0,
              "industrial_deeptech": 0.071,
              "semiconductors": 0.0,
              "defense_dualuse": 0.041,
              "consumer": 0.255,
              "gaming": 0.184,
              "marketplace": 0.061,
              "web3": 0.02,
              "scientific_ai": 0.02,
              "enterprise_saas": 0.133,
              "hardware": 0.031
            },
            "traction_mention_proxy": 0.061,
            "repeat_founder_mention_proxy": 0.0,
            "exit_mention_proxy": 0.0,
            "elite_employer_mention_proxy": 0.02,
            "elite_academic_mention_proxy": 0.02,
            "research_mention_proxy": 0.01
          },
          "2026": {
            "n": 77,
            "cohorts": [
              "006",
              "007"
            ],
            "ai_share": 0.909,
            "median_employees": 4,
            "mean_employees": 5.08,
            "small_team_le5_share": 0.688,
            "small_team_le10_share": 0.922,
            "avg_founder_profiles": 2.18,
            "solo_founder_profile_share": 0.143,
            "three_plus_founder_profile_share": 0.273,
            "sf_bay_share": 0.688,
            "la_share": 0.013,
            "nyc_share": 0.182,
            "us_share": 0.909,
            "category_share": {
              "ai_agents": 0.714,
              "ai_infra": 0.195,
              "developer_tools": 0.052,
              "vertical_ai": 0.688,
              "voice_ai": 0.052,
              "physical_ai_robotics": 0.039,
              "cyber_security": 0.026,
              "fintech": 0.169,
              "health_bio": 0.104,
              "climate_energy": 0.0,
              "industrial_deeptech": 0.091,
              "semiconductors": 0.0,
              "defense_dualuse": 0.026,
              "consumer": 0.13,
              "gaming": 0.039,
              "marketplace": 0.091,
              "web3": 0.013,
              "scientific_ai": 0.013,
              "enterprise_saas": 0.234,
              "hardware": 0.065
            },
            "traction_mention_proxy": 0.221,
            "repeat_founder_mention_proxy": 0.065,
            "exit_mention_proxy": 0.013,
            "elite_employer_mention_proxy": 0.13,
            "elite_academic_mention_proxy": 0.104,
            "research_mention_proxy": 0.039
          }
        },
        "method_note": "Parsed from user-provided Speedrun company-directory export. Current public directory may omit historical companies and SR007 is in progress. Founder-profile count is the number of founder-profile cards visible in the directory record, not independently verified legal founder count. AI share is detected primarily from Speedrun's explicit 'AI' category tags; this handles concatenated directory labels such as 'GamingAI Agents' without substring false positives."
      }
    },
    "sequoia_capital": {
      "name": "Sequoia Capital",
      "region": "US / Europe / Global",
      "entity_type": "venture_investor",
      "archetype": "Outlier-founder investor that partners from pre-seed through growth, with unusually high weight on category-defining insight, founder magnetism, technical/product excellence, durable PMF and global-scale ambition.",
      "founder_targets": {
        "technical_depth": 0.9,
        "research_depth": 0.58,
        "elite_academic": 0.64,
        "elite_employer": 0.7,
        "repeat_founder": 0.54,
        "prior_exit": 0.3,
        "early_career": 0.46,
        "product_builder": 0.94,
        "enterprise_gtm": 0.74,
        "domain_expertise": 0.94,
        "speed": 0.93,
        "global_ambition": 1.0,
        "cofounder_complementarity": 0.87,
        "customer_obsession": 0.95
      },
      "company_targets": {
        "ai_native": 0.78,
        "technical_differentiation": 0.97,
        "defensible_ip": 0.68,
        "software_high_margin": 0.73,
        "capital_intensive": 0.5,
        "enterprise_b2b": 0.74,
        "consumer": 0.42,
        "developer_facing": 0.6,
        "regulated_market": 0.45,
        "traction": 0.8,
        "revenue": 0.52,
        "speed_ship": 0.92,
        "global_market": 0.99,
        "local_market_fit": 0.2,
        "team_small": 0.8,
        "proprietary_data": 0.68
      },
      "category_affinity": {
        "ai_agents": 0.91,
        "ai_infra": 0.86,
        "developer_tools": 0.84,
        "voice_ai": 0.541,
        "physical_ai_robotics": 0.76,
        "cyber_security": 0.88,
        "fintech": 0.798,
        "health_bio": 0.66,
        "climate_energy": 0.577,
        "industrial_deeptech": 0.725,
        "semiconductors": 0.8,
        "defense_dualuse": 0.76,
        "consumer": 0.743,
        "gaming": 0.451,
        "marketplace": 0.451,
        "web3": 0.604,
        "scientific_ai": 0.88,
        "enterprise_saas": 0.96,
        "hardware": 0.74,
        "vertical_ai": 0.92
      },
      "stage_affinity": {
        "pre_idea": 0.28,
        "idea": 0.52,
        "prototype": 0.82,
        "launched": 0.96,
        "pre_seed": 0.98,
        "seed": 0.96,
        "series_a": 0.78
      },
      "geo_affinity": {
        "us": 0.98,
        "europe": 0.88,
        "latam": 0.62,
        "mena": 0.58,
        "asia": 0.68,
        "global": 1.0,
        "sf": 1.0,
        "abu_dhabi": 0.34,
        "saudi": 0.32,
        "chile": 0.34
      },
      "years": {
        "2024": {
          "trend_tags": [
            "AI application formation",
            "agents and workflow software",
            "frontier AI research commercialization",
            "developer/open-source leverage",
            "physical AI and security"
          ],
          "founder_overrides": {
            "technical_depth": 0.92,
            "research_depth": 0.7,
            "elite_employer": 0.78,
            "product_builder": 0.96,
            "domain_expertise": 0.94
          },
          "company_overrides": {
            "ai_native": 0.86,
            "technical_differentiation": 0.97,
            "speed_ship": 0.92
          },
          "category_overrides": {
            "ai_agents": 0.98,
            "enterprise_saas": 0.93,
            "scientific_ai": 0.88,
            "ai_infra": 0.86,
            "developer_tools": 0.86,
            "physical_ai_robotics": 0.84,
            "cyber_security": 0.8,
            "defense_dualuse": 0.78,
            "fintech": 0.76,
            "health_bio": 0.74
          },
          "stage_overrides": {
            "pre_seed": 1.0,
            "seed": 0.96,
            "launched": 0.94
          },
          "notes": "Research-calibrated from a 20-company verified 2024 partnership sample (including Agency, Reflection AI, Rox, Magentic, FastAPI Labs, Physical Intelligence, SSI, XBOW, OpenEvidence and others). The sample is not claimed to be the complete annual roster.",
          "confidence": "high"
        },
        "2025": {
          "trend_tags": [
            "agent economy",
            "coding reaches strong PMF",
            "vertical AI",
            "open-source AI infrastructure",
            "security and fintech workflows",
            "maximum velocity"
          ],
          "founder_overrides": {
            "product_builder": 0.97,
            "speed": 1.0,
            "customer_obsession": 0.97,
            "domain_expertise": 0.96,
            "repeat_founder": 0.6
          },
          "company_overrides": {
            "ai_native": 0.91,
            "traction": 0.84,
            "speed_ship": 0.98,
            "enterprise_b2b": 0.8
          },
          "category_overrides": {
            "ai_agents": 0.96,
            "vertical_ai": 0.96,
            "developer_tools": 0.92,
            "ai_infra": 0.92,
            "cyber_security": 0.93,
            "fintech": 0.9,
            "enterprise_saas": 0.94,
            "scientific_ai": 0.84,
            "consumer": 0.68
          },
          "stage_overrides": {
            "pre_seed": 0.98,
            "seed": 0.96,
            "launched": 0.98,
            "series_a": 0.82
          },
          "notes": "Research-calibrated from a 17-company verified 2025 partnership sample. Sequoia's 2025 AI Ascent emphasized maximum velocity, coding PMF, agent economics, vertical applications and open source.",
          "confidence": "high"
        },
        "2026": {
          "trend_tags": [
            "long-horizon agents / doers",
            "AI security",
            "frontier research",
            "AI inference infrastructure",
            "semiconductors and systems",
            "physical-world AI",
            "AI-native vertical work"
          ],
          "founder_overrides": {
            "technical_depth": 0.96,
            "research_depth": 0.8,
            "elite_employer": 0.86,
            "product_builder": 0.96,
            "domain_expertise": 0.97,
            "speed": 0.98,
            "global_ambition": 1.0
          },
          "company_overrides": {
            "ai_native": 0.95,
            "technical_differentiation": 0.99,
            "defensible_ip": 0.8,
            "capital_intensive": 0.6,
            "proprietary_data": 0.76,
            "speed_ship": 0.96
          },
          "category_overrides": {
            "ai_agents": 1.0,
            "ai_infra": 0.98,
            "scientific_ai": 0.98,
            "cyber_security": 0.97,
            "semiconductors": 0.95,
            "physical_ai_robotics": 0.93,
            "developer_tools": 0.91,
            "enterprise_saas": 0.93,
            "vertical_ai": 0.95,
            "defense_dualuse": 0.88,
            "hardware": 0.9,
            "health_bio": 0.86,
            "fintech": 0.82
          },
          "stage_overrides": {
            "pre_seed": 0.98,
            "seed": 0.96,
            "launched": 0.96,
            "series_a": 0.86
          },
          "notes": "Research-calibrated from a 12-company verified 2026 partnership sample (Air, Corma, Etched, Standard Intelligence, NUVACORE, Ineffable Intelligence, Parallel, Anthropic, Waymo and others), combined with Sequoia's 2026 AGI/AI Ascent thesis. Sample is not exhaustive.",
          "confidence": "high"
        }
      },
      "observed_portfolio_stats": {
        "raw_export_as_of": "2026-09-05",
        "raw_company_count": 425,
        "stage_counts": {
          "Growth": 168,
          "Early": 89,
          "Acquired": 39,
          "IPO": 67,
          "Pre-Seed/Seed": 61
        },
        "stage_share": {
          "Growth": 0.395,
          "Early": 0.209,
          "Acquired": 0.092,
          "IPO": 0.158,
          "Pre-Seed/Seed": 0.144
        },
        "early_or_preseed_seed_count": 150,
        "early_or_preseed_seed_share": 0.353,
        "description_ai_share_all": 0.252,
        "description_ai_share_early": 0.44,
        "description_ai_share_preseed_seed": 0.525,
        "observed_category_share_all": {
          "ai_agents": 0.056,
          "ai_infra": 0.031,
          "developer_tools": 0.078,
          "voice_ai": 0.016,
          "physical_ai_robotics": 0.021,
          "cyber_security": 0.075,
          "fintech": 0.078,
          "health_bio": 0.068,
          "climate_energy": 0.021,
          "industrial_deeptech": 0.042,
          "semiconductors": 0.014,
          "defense_dualuse": 0.009,
          "consumer": 0.089,
          "gaming": 0.012,
          "marketplace": 0.014,
          "web3": 0.035,
          "scientific_ai": 0.028,
          "enterprise_saas": 0.153,
          "hardware": 0.049
        },
        "observed_category_share_early": {
          "ai_agents": 0.133,
          "ai_infra": 0.06,
          "developer_tools": 0.1,
          "voice_ai": 0.02,
          "physical_ai_robotics": 0.02,
          "cyber_security": 0.1,
          "fintech": 0.093,
          "health_bio": 0.047,
          "climate_energy": 0.027,
          "industrial_deeptech": 0.067,
          "semiconductors": 0.013,
          "defense_dualuse": 0.027,
          "consumer": 0.073,
          "gaming": 0.007,
          "marketplace": 0.007,
          "web3": 0.033,
          "scientific_ai": 0.053,
          "enterprise_saas": 0.167,
          "hardware": 0.04
        },
        "observed_category_share_preseed_seed": {
          "ai_agents": 0.131,
          "ai_infra": 0.066,
          "developer_tools": 0.098,
          "voice_ai": 0.049,
          "physical_ai_robotics": 0.033,
          "cyber_security": 0.066,
          "fintech": 0.098,
          "health_bio": 0.016,
          "climate_energy": 0.016,
          "industrial_deeptech": 0.033,
          "semiconductors": 0.016,
          "defense_dualuse": 0.033,
          "consumer": 0.082,
          "gaming": 0.0,
          "marketplace": 0.0,
          "web3": 0.033,
          "scientific_ai": 0.066,
          "enterprise_saas": 0.164,
          "hardware": 0.049
        },
        "top_partners_all": [
          {
            "partner": "Shaun Maguire",
            "companies": 40
          },
          {
            "partner": "Alfred Lin",
            "companies": 38
          },
          {
            "partner": "Pat Grady",
            "companies": 32
          },
          {
            "partner": "Andrew Reed",
            "companies": 31
          },
          {
            "partner": "Roelof Botha",
            "companies": 29
          },
          {
            "partner": "Sonya Huang",
            "companies": 22
          },
          {
            "partner": "Jim Goetz",
            "companies": 21
          },
          {
            "partner": "Bogomil Balkansky",
            "companies": 21
          },
          {
            "partner": "Bill Coughran",
            "companies": 20
          },
          {
            "partner": "Konstantine Buhler",
            "companies": 20
          },
          {
            "partner": "Bryan Schreier",
            "companies": 19
          },
          {
            "partner": "James Flynn",
            "companies": 18
          },
          {
            "partner": "Jess Lee",
            "companies": 17
          },
          {
            "partner": "Doug Leone",
            "companies": 16
          },
          {
            "partner": "George Robson",
            "companies": 15
          }
        ],
        "top_partners_early": [
          {
            "partner": "Shaun Maguire",
            "companies": 19
          },
          {
            "partner": "Bogomil Balkansky",
            "companies": 14
          },
          {
            "partner": "Konstantine Buhler",
            "companies": 12
          },
          {
            "partner": "Alfred Lin",
            "companies": 11
          },
          {
            "partner": "Jess Lee",
            "companies": 11
          },
          {
            "partner": "Bill Coughran",
            "companies": 10
          },
          {
            "partner": "Lauren Reeder",
            "companies": 10
          },
          {
            "partner": "Bryan Schreier",
            "companies": 7
          },
          {
            "partner": "Stephanie Zhan",
            "companies": 7
          },
          {
            "partner": "Julien Bek",
            "companies": 6
          },
          {
            "partner": "George Robson",
            "companies": 6
          },
          {
            "partner": "Charlie Curnin",
            "companies": 6
          },
          {
            "partner": "Josephine Chen",
            "companies": 5
          },
          {
            "partner": "Pat Grady",
            "companies": 5
          },
          {
            "partner": "Dean Meyer",
            "companies": 5
          }
        ],
        "classification_note": "Category and AI shares are deterministic keyword classifications of the user-provided descriptions; multi-label categories can sum to >100%."
      },
      "recent_partnership_samples": {
        "2024": {
          "sample_size": 20,
          "sample_companies": [
            "Agency",
            "Blockit AI",
            "Decart",
            "Enter",
            "Eon",
            "FastAPI Labs",
            "Kela",
            "LangChain",
            "Lemni",
            "Magentic",
            "Nevis",
            "OpenEvidence",
            "Pace",
            "Physical Intelligence",
            "Reflection AI",
            "Rox",
            "Safe Superintelligence",
            "Traversal",
            "XBOW",
            "Xaira"
          ],
          "ai_description_share": 0.75,
          "current_stage_distribution": {
            "Early": 11,
            "Pre-Seed/Seed": 7,
            "Growth": 2
          },
          "category_share": {
            "ai_agents": 0.3,
            "ai_infra": 0.1,
            "developer_tools": 0.05,
            "voice_ai": 0.0,
            "physical_ai_robotics": 0.05,
            "cyber_security": 0.05,
            "fintech": 0.05,
            "health_bio": 0.05,
            "climate_energy": 0.0,
            "industrial_deeptech": 0.05,
            "semiconductors": 0.0,
            "defense_dualuse": 0.05,
            "consumer": 0.0,
            "gaming": 0.0,
            "marketplace": 0.0,
            "web3": 0.0,
            "scientific_ai": 0.15,
            "enterprise_saas": 0.25,
            "hardware": 0.05
          },
          "category_affinity_from_sample": {
            "ai_agents": 1.0,
            "ai_infra": 0.727,
            "developer_tools": 0.613,
            "voice_ai": 0.3,
            "physical_ai_robotics": 0.613,
            "cyber_security": 0.613,
            "fintech": 0.613,
            "health_bio": 0.613,
            "climate_energy": 0.3,
            "industrial_deeptech": 0.613,
            "semiconductors": 0.3,
            "defense_dualuse": 0.613,
            "consumer": 0.3,
            "gaming": 0.3,
            "marketplace": 0.3,
            "web3": 0.3,
            "scientific_ai": 0.812,
            "enterprise_saas": 0.945,
            "hardware": 0.613
          },
          "coverage_note": "Verified recent-partnership sample, not a complete Sequoia annual investment roster."
        },
        "2025": {
          "sample_size": 17,
          "sample_companies": [
            "Astrocade",
            "Auctor",
            "Avelios",
            "Ent",
            "Firetiger",
            "Glow",
            "Inferact",
            "Irregular",
            "Juicebox",
            "Paid",
            "Probook",
            "Rillet",
            "Rogo",
            "Rowspace",
            "Sail Research",
            "Serval",
            "WithCoverage"
          ],
          "ai_description_share": 0.765,
          "current_stage_distribution": {
            "Growth": 5,
            "Early": 8,
            "Pre-Seed/Seed": 4
          },
          "category_share": {
            "ai_agents": 0.118,
            "ai_infra": 0.059,
            "developer_tools": 0.0,
            "voice_ai": 0.0,
            "physical_ai_robotics": 0.0,
            "cyber_security": 0.176,
            "fintech": 0.235,
            "health_bio": 0.0,
            "climate_energy": 0.0,
            "industrial_deeptech": 0.0,
            "semiconductors": 0.0,
            "defense_dualuse": 0.0,
            "consumer": 0.118,
            "gaming": 0.059,
            "marketplace": 0.0,
            "web3": 0.0,
            "scientific_ai": 0.0,
            "enterprise_saas": 0.059,
            "hardware": 0.0
          },
          "category_affinity_from_sample": {
            "ai_agents": 0.813,
            "ai_infra": 0.676,
            "developer_tools": 0.3,
            "voice_ai": 0.3,
            "physical_ai_robotics": 0.3,
            "cyber_security": 0.915,
            "fintech": 1.0,
            "health_bio": 0.3,
            "climate_energy": 0.3,
            "industrial_deeptech": 0.3,
            "semiconductors": 0.3,
            "defense_dualuse": 0.3,
            "consumer": 0.813,
            "gaming": 0.676,
            "marketplace": 0.3,
            "web3": 0.3,
            "scientific_ai": 0.3,
            "enterprise_saas": 0.676,
            "hardware": 0.3
          },
          "coverage_note": "Verified recent-partnership sample, not a complete Sequoia annual investment roster."
        },
        "2026": {
          "sample_size": 12,
          "sample_companies": [
            "Air",
            "Anthropic",
            "Chai Discovery",
            "Corma",
            "Etched",
            "Ineffable Intelligence",
            "NUVACORE",
            "Parallel Web Systems",
            "Preview",
            "Scanner",
            "Standard Intelligence",
            "Waymo"
          ],
          "ai_description_share": 0.583,
          "current_stage_distribution": {
            "Early": 3,
            "Growth": 5,
            "Pre-Seed/Seed": 4
          },
          "category_share": {
            "ai_agents": 0.083,
            "ai_infra": 0.167,
            "developer_tools": 0.0,
            "voice_ai": 0.0,
            "physical_ai_robotics": 0.0,
            "cyber_security": 0.25,
            "fintech": 0.0,
            "health_bio": 0.083,
            "climate_energy": 0.0,
            "industrial_deeptech": 0.083,
            "semiconductors": 0.083,
            "defense_dualuse": 0.0,
            "consumer": 0.0,
            "gaming": 0.0,
            "marketplace": 0.0,
            "web3": 0.0,
            "scientific_ai": 0.25,
            "enterprise_saas": 0.0,
            "hardware": 0.083
          },
          "category_affinity_from_sample": {
            "ai_agents": 0.726,
            "ai_infra": 0.884,
            "developer_tools": 0.3,
            "voice_ai": 0.3,
            "physical_ai_robotics": 0.3,
            "cyber_security": 1.0,
            "fintech": 0.3,
            "health_bio": 0.726,
            "climate_energy": 0.3,
            "industrial_deeptech": 0.726,
            "semiconductors": 0.726,
            "defense_dualuse": 0.3,
            "consumer": 0.3,
            "gaming": 0.3,
            "marketplace": 0.3,
            "web3": 0.3,
            "scientific_ai": 1.0,
            "enterprise_saas": 0.3,
            "hardware": 0.726
          },
          "coverage_note": "Verified recent-partnership sample, not a complete Sequoia annual investment roster."
        }
      },
      "sources": [
        "User-provided Sequoia portfolio export parsed on 2026-09-05 (425 companies)",
        "https://sequoiacap.com/our-companies/",
        "https://sequoiacap.com/arc",
        "https://sequoiacap.com/article/seed-venture-funds-2025",
        "https://sequoiacap.com/article/ai-ascent-2025",
        "https://sequoiacap.com/article/2026-this-is-agi",
        "https://sequoiacap.com/article/ai-ascent-2026",
        "https://sequoiacap.com/people/bogomil-balkansky",
        "https://sequoiacap.com/people/dean-meyer",
        "https://sequoiacap.com/companies/reflection-ai",
        "https://sequoiacap.com/companies/glow",
        "https://sequoiacap.com/companies/etched",
        "https://sequoiacap.com/companies/ineffable-intelligence",
        "https://sequoiacap.com/companies/nuvacore"
      ],
      "constraints": {}
    },
    "sequoia_arc": {
      "name": "Sequoia Arc",
      "region": "US / Europe / Global",
      "archetype": "Bi-annual open call for outlier pre-seed/seed founders; very small cohorts (~10 in the current Intensive) centered on founder quality, customer insight, positioning, PMF, team design and speed.",
      "founder_targets": {
        "technical_depth": 0.88,
        "research_depth": 0.55,
        "elite_academic": 0.72,
        "elite_employer": 0.72,
        "repeat_founder": 0.62,
        "prior_exit": 0.34,
        "early_career": 0.5,
        "product_builder": 0.88,
        "enterprise_gtm": 0.68,
        "domain_expertise": 0.9,
        "speed": 0.86,
        "global_ambition": 1.0,
        "cofounder_complementarity": 0.86,
        "customer_obsession": 0.92
      },
      "company_targets": {
        "ai_native": 0.76,
        "technical_differentiation": 0.94,
        "defensible_ip": 0.64,
        "software_high_margin": 0.78,
        "capital_intensive": 0.4,
        "enterprise_b2b": 0.7,
        "consumer": 0.45,
        "developer_facing": 0.58,
        "regulated_market": 0.38,
        "traction": 0.72,
        "revenue": 0.48,
        "speed_ship": 0.86,
        "global_market": 0.98,
        "local_market_fit": 0.22,
        "team_small": 0.82,
        "proprietary_data": 0.56
      },
      "category_affinity": {
        "ai_agents": 0.88,
        "ai_infra": 0.88,
        "developer_tools": 0.9,
        "vertical_ai": 0.82,
        "voice_ai": 0.65,
        "physical_ai_robotics": 0.6,
        "cyber_security": 0.72,
        "fintech": 0.62,
        "health_bio": 0.55,
        "climate_energy": 0.45,
        "industrial_deeptech": 0.55,
        "semiconductors": 0.5,
        "defense_dualuse": 0.48,
        "consumer": 0.58,
        "gaming": 0.38,
        "marketplace": 0.42,
        "web3": 0.36,
        "scientific_ai": 0.65,
        "enterprise_saas": 0.83,
        "hardware": 0.48
      },
      "stage_affinity": {
        "pre_idea": 0.1,
        "idea": 0.38,
        "prototype": 0.78,
        "launched": 0.9,
        "pre_seed": 1.0,
        "seed": 0.92,
        "series_a": 0.2
      },
      "geo_affinity": {
        "us": 0.94,
        "europe": 0.82,
        "latam": 0.48,
        "mena": 0.45,
        "asia": 0.55,
        "global": 0.9,
        "sf": 0.95,
        "abu_dhabi": 0.2,
        "saudi": 0.18,
        "chile": 0.2
      },
      "years": {
        "2024": {
          "trend_tags": [
            "AI research commercialization",
            "agents",
            "developer platforms",
            "PMF archetypes"
          ],
          "founder_overrides": {
            "research_depth": 0.62
          },
          "company_overrides": {
            "ai_native": 0.92
          },
          "category_overrides": {
            "ai_agents": 1.0,
            "developer_tools": 0.95,
            "vertical_ai": 0.94,
            "scientific_ai": 0.9
          },
          "stage_overrides": {},
          "notes": "Five Arc 2024 companies are directly verified on Sequoia company pages in this research set: Agency, Reflection AI, Rox, Magentic and FastAPI Labs. This confirms unusually strong AI/agent/developer-tool concentration, but is not asserted to be a complete Arc 2024 roster.",
          "confidence": "high"
        },
        "2025": {
          "trend_tags": [
            "PMF rigor",
            "terrifying questions",
            "category insight",
            "high-conviction seed"
          ],
          "founder_overrides": {
            "customer_obsession": 0.95
          },
          "company_overrides": {
            "traction": 0.76
          },
          "category_overrides": {},
          "stage_overrides": {},
          "notes": "Sequoia's Arc/PMF material emphasizes clarity of customer problem and product-market fit.",
          "confidence": "medium"
        },
        "2026": {
          "trend_tags": [
            "smaller Arc Intensive",
            "~10 companies",
            "company design",
            "positioning",
            "team and growth"
          ],
          "founder_overrides": {
            "domain_expertise": 0.94
          },
          "company_overrides": {
            "technical_differentiation": 0.96
          },
          "category_overrides": {},
          "stage_overrides": {},
          "notes": "Current Arc is a bi-annual open call for pre-seed/seed founders. The Arc Intensive is four days and cohorts are approximately 10 companies, with direct focus on customer understanding, competitive positioning, team building and growth strategy.",
          "confidence": "high"
        }
      },
      "sources": [
        "https://www.sequoiacap.com/arc/",
        "https://sequoiacap.com/arc",
        "https://sequoiacap.com/article/pmf-framework",
        "https://sequoiacap.com/article/pmf-framework-2",
        "https://sequoiacap.com/companies/agency",
        "https://sequoiacap.com/companies/reflection-ai",
        "https://sequoiacap.com/companies/rox",
        "https://sequoiacap.com/companies/magentic",
        "https://sequoiacap.com/companies/fastapi-labs"
      ],
      "constraints": {},
      "entity_type": "founder_program"
    },
    "hf0": {
      "name": "HF0",
      "region": "US / Global",
      "archetype": "Ultra-small San Francisco residency for repeat founders OR first-time breakout teams with exceptional growth. HF0 is unusually traction- and velocity-heavy: existing ARR, rapid weekly growth and extreme revenue expansion matter far more than idea-stage promise or category fashion.",
      "founder_targets": {
        "technical_depth": 0.88,
        "research_depth": 0.44,
        "elite_academic": 0.5,
        "elite_employer": 0.58,
        "repeat_founder": 0.62,
        "prior_exit": 0.42,
        "early_career": 0.38,
        "product_builder": 0.96,
        "enterprise_gtm": 0.84,
        "domain_expertise": 0.88,
        "speed": 1.0,
        "global_ambition": 0.98,
        "cofounder_complementarity": 0.9,
        "customer_obsession": 0.96
      },
      "company_targets": {
        "ai_native": 0.78,
        "technical_differentiation": 0.88,
        "defensible_ip": 0.5,
        "software_high_margin": 0.86,
        "capital_intensive": 0.3,
        "enterprise_b2b": 0.82,
        "consumer": 0.38,
        "developer_facing": 0.64,
        "regulated_market": 0.3,
        "traction": 1.0,
        "revenue": 1.0,
        "speed_ship": 1.0,
        "global_market": 0.98,
        "local_market_fit": 0.16,
        "team_small": 0.8,
        "proprietary_data": 0.48
      },
      "category_affinity": {
        "ai_agents": 0.9,
        "ai_infra": 0.891,
        "developer_tools": 0.871,
        "vertical_ai": 0.862,
        "voice_ai": 0.711,
        "physical_ai_robotics": 0.58,
        "cyber_security": 0.678,
        "fintech": 0.629,
        "health_bio": 0.456,
        "climate_energy": 0.322,
        "industrial_deeptech": 0.541,
        "semiconductors": 0.477,
        "defense_dualuse": 0.534,
        "consumer": 0.612,
        "gaming": 0.445,
        "marketplace": 0.409,
        "web3": 0.384,
        "scientific_ai": 0.48,
        "enterprise_saas": 0.909,
        "hardware": 0.444
      },
      "stage_affinity": {
        "pre_idea": 0.02,
        "idea": 0.08,
        "prototype": 0.4,
        "launched": 1.0,
        "pre_seed": 0.88,
        "seed": 1.0,
        "series_a": 0.9
      },
      "geo_affinity": {
        "us": 1.0,
        "europe": 0.62,
        "latam": 0.48,
        "mena": 0.44,
        "asia": 0.52,
        "global": 0.88,
        "sf": 1.0,
        "abu_dhabi": 0.18,
        "saudi": 0.18,
        "chile": 0.2
      },
      "years": {
        "2024": {
          "trend_tags": [
            "repeat unicorn founders",
            "existing $1M+ ARR",
            "10-team batches",
            "revenue acceleration",
            "technical founder density"
          ],
          "founder_overrides": {
            "repeat_founder": 0.76,
            "prior_exit": 0.56,
            "speed": 1.0
          },
          "company_overrides": {
            "traction": 0.96,
            "revenue": 0.94,
            "speed_ship": 1.0
          },
          "category_overrides": {},
          "stage_overrides": {
            "launched": 1.0,
            "pre_seed": 0.9,
            "seed": 0.92
          },
          "notes": "[OFFICIAL OUTCOME-CALIBRATED] W24: 3/10 entered at $1M ARR. S24: four repeat-unicorn founders; 3/10 exceeded $2M ARR by demo day. F24: 4/10 exceeded $2M revenue; top team exceeded $10M.",
          "confidence": "high"
        },
        "2025": {
          "trend_tags": [
            "extreme revenue velocity",
            "breakout first-time founders also qualify",
            "$3M+ demo-day revenue",
            "$82M average post-demo valuation",
            "small elite cohorts"
          ],
          "founder_overrides": {
            "repeat_founder": 0.64,
            "speed": 1.0,
            "product_builder": 0.98
          },
          "company_overrides": {
            "traction": 1.0,
            "revenue": 1.0,
            "speed_ship": 1.0
          },
          "category_overrides": {},
          "stage_overrides": {
            "launched": 1.0,
            "pre_seed": 0.9,
            "seed": 1.0
          },
          "notes": "[OFFICIAL OUTCOME-CALIBRATED] W25: 4/10 exceeded $3M revenue by demo day. S25: teams raising post-demo averaged $82M valuation; top team exceeded $20M annualized revenue.",
          "confidence": "high"
        },
        "2026": {
          "trend_tags": [
            "repeat founders OR breakout growth",
            "not only early stage",
            "seed / Series A welcomed",
            "5 of 10 >$10M annualized",
            "12% average weekly growth",
            "AI-age company-building"
          ],
          "founder_overrides": {
            "repeat_founder": 0.6,
            "speed": 1.0,
            "product_builder": 0.99
          },
          "company_overrides": {
            "traction": 1.0,
            "revenue": 1.0,
            "speed_ship": 1.0,
            "ai_native": 0.82
          },
          "category_overrides": {},
          "stage_overrides": {
            "launched": 1.0,
            "pre_seed": 0.84,
            "seed": 1.0,
            "series_a": 0.94
          },
          "notes": "[CURRENT OUTCOME-CALIBRATED] Latest 2026 HF0 batch: 5/10 teams broke $10M annualized by demo day. HF0 now explicitly solicits strong seed and Series A teams as well as repeat founders.",
          "confidence": "high"
        }
      },
      "sources": [
        "https://www.hf0.com/",
        "https://www.hf0.com/facts",
        "https://www.linkedin.com/posts/hf0_hf0-the-best-place-for-repeat-and-breakout-activity-7199849194268835841-B2iy",
        "https://www.linkedin.com/posts/hf0_5-of-10-teams-at-demo-day-broke-10m-annualized-activity-7463636839501815808-gzwg",
        "Internal Scouter HF0 Tracxn snapshot parsed 2026-09-06"
      ],
      "constraints": {
        "repeat_or_breakout": true
      },
      "entity_type": "residency_investor",
      "component_weights": {
        "founder": 0.3,
        "company": 0.45,
        "category": 0.08,
        "stage": 0.12,
        "geography": 0.05
      },
      "cohorts": {
        "W24": {
          "year": "2024",
          "period": "Winter 2024",
          "program_location": "San Francisco",
          "coverage_status": "official cohort outcome metrics; full company roster not available",
          "coverage_note": "Cohort-level revenue/founder outcome facts are official. Category composition falls back to HF0 family affinity because a complete standardized company roster was not available.",
          "founder_overrides": {
            "repeat_founder": 0.7,
            "prior_exit": 0.48
          },
          "company_overrides": {
            "revenue": 0.88,
            "traction": 0.92,
            "speed_ship": 1.0
          },
          "category_affinity": {
            "ai_agents": 0.9,
            "ai_infra": 0.891,
            "developer_tools": 0.871,
            "vertical_ai": 0.862,
            "voice_ai": 0.711,
            "physical_ai_robotics": 0.58,
            "cyber_security": 0.678,
            "fintech": 0.629,
            "health_bio": 0.456,
            "climate_energy": 0.322,
            "industrial_deeptech": 0.541,
            "semiconductors": 0.477,
            "defense_dualuse": 0.534,
            "consumer": 0.612,
            "gaming": 0.445,
            "marketplace": 0.409,
            "web3": 0.384,
            "scientific_ai": 0.48,
            "enterprise_saas": 0.909,
            "hardware": 0.444
          },
          "stage_affinity": {
            "pre_idea": 0.02,
            "idea": 0.08,
            "prototype": 0.4,
            "launched": 1.0,
            "pre_seed": 0.88,
            "seed": 1.0,
            "series_a": 0.9
          },
          "geo_affinity": {
            "us": 1.0,
            "europe": 0.62,
            "latam": 0.48,
            "mena": 0.44,
            "asia": 0.52,
            "global": 0.88,
            "sf": 1.0,
            "abu_dhabi": 0.18,
            "saudi": 0.18,
            "chile": 0.2
          },
          "observed_snapshot_stats": {
            "teams": 10,
            "joined_at_1m_arr_share": 0.3
          },
          "vector_semantics": "HF0 named cohort outcome DNA: official revenue/repeat-founder signals + family-level category prior. Not a complete accepted-company category census.",
          "notes": "3/10 teams entered already at $1M ARR.",
          "sources": [
            "https://www.hf0.com/facts"
          ]
        },
        "S24": {
          "year": "2024",
          "period": "Summer 2024",
          "program_location": "San Francisco",
          "coverage_status": "official cohort outcome metrics; full company roster not available",
          "coverage_note": "Cohort-level revenue/founder outcome facts are official. Category composition falls back to HF0 family affinity because a complete standardized company roster was not available.",
          "founder_overrides": {
            "repeat_founder": 0.92,
            "prior_exit": 0.72
          },
          "company_overrides": {
            "revenue": 0.91,
            "traction": 0.96,
            "speed_ship": 1.0
          },
          "category_affinity": {
            "ai_agents": 0.9,
            "ai_infra": 0.891,
            "developer_tools": 0.871,
            "vertical_ai": 0.862,
            "voice_ai": 0.711,
            "physical_ai_robotics": 0.58,
            "cyber_security": 0.678,
            "fintech": 0.629,
            "health_bio": 0.456,
            "climate_energy": 0.322,
            "industrial_deeptech": 0.541,
            "semiconductors": 0.477,
            "defense_dualuse": 0.534,
            "consumer": 0.612,
            "gaming": 0.445,
            "marketplace": 0.409,
            "web3": 0.384,
            "scientific_ai": 0.48,
            "enterprise_saas": 0.909,
            "hardware": 0.444
          },
          "stage_affinity": {
            "pre_idea": 0.02,
            "idea": 0.08,
            "prototype": 0.4,
            "launched": 1.0,
            "pre_seed": 0.88,
            "seed": 1.0,
            "series_a": 0.9
          },
          "geo_affinity": {
            "us": 1.0,
            "europe": 0.62,
            "latam": 0.48,
            "mena": 0.44,
            "asia": 0.52,
            "global": 0.88,
            "sf": 1.0,
            "abu_dhabi": 0.18,
            "saudi": 0.18,
            "chile": 0.2
          },
          "observed_snapshot_stats": {
            "teams": 10,
            "repeat_unicorn_founder_teams": 4,
            "over_2m_arr_by_demo_day_share": 0.3
          },
          "vector_semantics": "HF0 named cohort outcome DNA: official revenue/repeat-founder signals + family-level category prior. Not a complete accepted-company category census.",
          "notes": "4 repeat-unicorn founders in one batch; 3/10 teams broke $2M ARR by demo day.",
          "sources": [
            "https://www.hf0.com/facts"
          ]
        },
        "F24": {
          "year": "2024",
          "period": "Fall 2024",
          "program_location": "San Francisco",
          "coverage_status": "official cohort outcome metrics; full company roster not available",
          "coverage_note": "Cohort-level revenue/founder outcome facts are official. Category composition falls back to HF0 family affinity because a complete standardized company roster was not available.",
          "founder_overrides": {
            "repeat_founder": 0.72,
            "prior_exit": 0.5
          },
          "company_overrides": {
            "revenue": 0.94,
            "traction": 0.98,
            "speed_ship": 1.0
          },
          "category_affinity": {
            "ai_agents": 0.9,
            "ai_infra": 0.891,
            "developer_tools": 0.871,
            "vertical_ai": 0.862,
            "voice_ai": 0.711,
            "physical_ai_robotics": 0.58,
            "cyber_security": 0.678,
            "fintech": 0.629,
            "health_bio": 0.456,
            "climate_energy": 0.322,
            "industrial_deeptech": 0.541,
            "semiconductors": 0.477,
            "defense_dualuse": 0.534,
            "consumer": 0.612,
            "gaming": 0.445,
            "marketplace": 0.409,
            "web3": 0.384,
            "scientific_ai": 0.48,
            "enterprise_saas": 0.909,
            "hardware": 0.444
          },
          "stage_affinity": {
            "pre_idea": 0.02,
            "idea": 0.08,
            "prototype": 0.4,
            "launched": 1.0,
            "pre_seed": 0.88,
            "seed": 1.0,
            "series_a": 0.9
          },
          "geo_affinity": {
            "us": 1.0,
            "europe": 0.62,
            "latam": 0.48,
            "mena": 0.44,
            "asia": 0.52,
            "global": 0.88,
            "sf": 1.0,
            "abu_dhabi": 0.18,
            "saudi": 0.18,
            "chile": 0.2
          },
          "observed_snapshot_stats": {
            "teams": 10,
            "over_2m_revenue_by_demo_day_share": 0.4,
            "top_annualized_revenue_usd_m": 10
          },
          "vector_semantics": "HF0 named cohort outcome DNA: official revenue/repeat-founder signals + family-level category prior. Not a complete accepted-company category census.",
          "notes": "4/10 teams broke $2M in revenue by demo day; top team broke $10M.",
          "sources": [
            "https://www.hf0.com/facts"
          ]
        },
        "W25": {
          "year": "2025",
          "period": "Winter 2025",
          "program_location": "San Francisco",
          "coverage_status": "official cohort outcome metrics; full company roster not available",
          "coverage_note": "Cohort-level revenue/founder outcome facts are official. Category composition falls back to HF0 family affinity because a complete standardized company roster was not available.",
          "founder_overrides": {
            "repeat_founder": 0.68,
            "prior_exit": 0.48
          },
          "company_overrides": {
            "revenue": 0.97,
            "traction": 0.99,
            "speed_ship": 1.0
          },
          "category_affinity": {
            "ai_agents": 0.9,
            "ai_infra": 0.891,
            "developer_tools": 0.871,
            "vertical_ai": 0.862,
            "voice_ai": 0.711,
            "physical_ai_robotics": 0.58,
            "cyber_security": 0.678,
            "fintech": 0.629,
            "health_bio": 0.456,
            "climate_energy": 0.322,
            "industrial_deeptech": 0.541,
            "semiconductors": 0.477,
            "defense_dualuse": 0.534,
            "consumer": 0.612,
            "gaming": 0.445,
            "marketplace": 0.409,
            "web3": 0.384,
            "scientific_ai": 0.48,
            "enterprise_saas": 0.909,
            "hardware": 0.444
          },
          "stage_affinity": {
            "pre_idea": 0.02,
            "idea": 0.08,
            "prototype": 0.4,
            "launched": 1.0,
            "pre_seed": 0.88,
            "seed": 1.0,
            "series_a": 0.9
          },
          "geo_affinity": {
            "us": 1.0,
            "europe": 0.62,
            "latam": 0.48,
            "mena": 0.44,
            "asia": 0.52,
            "global": 0.88,
            "sf": 1.0,
            "abu_dhabi": 0.18,
            "saudi": 0.18,
            "chile": 0.2
          },
          "observed_snapshot_stats": {
            "teams": 10,
            "over_3m_revenue_by_demo_day_share": 0.4
          },
          "vector_semantics": "HF0 named cohort outcome DNA: official revenue/repeat-founder signals + family-level category prior. Not a complete accepted-company category census.",
          "notes": "4/10 teams broke $3M in revenue by demo day.",
          "sources": [
            "https://www.hf0.com/facts"
          ]
        },
        "S25": {
          "year": "2025",
          "period": "Summer 2025",
          "program_location": "San Francisco",
          "coverage_status": "official cohort outcome metrics; full company roster not available",
          "coverage_note": "Cohort-level revenue/founder outcome facts are official. Category composition falls back to HF0 family affinity because a complete standardized company roster was not available.",
          "founder_overrides": {
            "repeat_founder": 0.7,
            "prior_exit": 0.5
          },
          "company_overrides": {
            "revenue": 0.99,
            "traction": 0.99,
            "speed_ship": 1.0
          },
          "category_affinity": {
            "ai_agents": 0.9,
            "ai_infra": 0.891,
            "developer_tools": 0.871,
            "vertical_ai": 0.862,
            "voice_ai": 0.711,
            "physical_ai_robotics": 0.58,
            "cyber_security": 0.678,
            "fintech": 0.629,
            "health_bio": 0.456,
            "climate_energy": 0.322,
            "industrial_deeptech": 0.541,
            "semiconductors": 0.477,
            "defense_dualuse": 0.534,
            "consumer": 0.612,
            "gaming": 0.445,
            "marketplace": 0.409,
            "web3": 0.384,
            "scientific_ai": 0.48,
            "enterprise_saas": 0.909,
            "hardware": 0.444
          },
          "stage_affinity": {
            "pre_idea": 0.02,
            "idea": 0.08,
            "prototype": 0.4,
            "launched": 1.0,
            "pre_seed": 0.88,
            "seed": 1.0,
            "series_a": 0.9
          },
          "geo_affinity": {
            "us": 1.0,
            "europe": 0.62,
            "latam": 0.48,
            "mena": 0.44,
            "asia": 0.52,
            "global": 0.88,
            "sf": 1.0,
            "abu_dhabi": 0.18,
            "saudi": 0.18,
            "chile": 0.2
          },
          "observed_snapshot_stats": {
            "teams": 10,
            "avg_post_demo_valuation_usd_m": 82,
            "top_annualized_revenue_usd_m": 20
          },
          "vector_semantics": "HF0 named cohort outcome DNA: official revenue/repeat-founder signals + family-level category prior. Not a complete accepted-company category census.",
          "notes": "Teams raising after demo day averaged $82M valuation; top team broke $20M annualized revenue.",
          "sources": [
            "https://www.hf0.com/facts"
          ]
        },
        "W26": {
          "year": "2026",
          "period": "Winter/Spring 2026",
          "program_location": "San Francisco",
          "coverage_status": "official cohort outcome metrics; full company roster not available",
          "coverage_note": "Cohort-level revenue/founder outcome facts are official. Category composition falls back to HF0 family affinity because a complete standardized company roster was not available.",
          "founder_overrides": {
            "repeat_founder": 0.68,
            "prior_exit": 0.48
          },
          "company_overrides": {
            "revenue": 1.0,
            "traction": 1.0,
            "speed_ship": 1.0
          },
          "category_affinity": {
            "ai_agents": 0.9,
            "ai_infra": 0.891,
            "developer_tools": 0.871,
            "vertical_ai": 0.862,
            "voice_ai": 0.711,
            "physical_ai_robotics": 0.58,
            "cyber_security": 0.678,
            "fintech": 0.629,
            "health_bio": 0.456,
            "climate_energy": 0.322,
            "industrial_deeptech": 0.541,
            "semiconductors": 0.477,
            "defense_dualuse": 0.534,
            "consumer": 0.612,
            "gaming": 0.445,
            "marketplace": 0.409,
            "web3": 0.384,
            "scientific_ai": 0.48,
            "enterprise_saas": 0.909,
            "hardware": 0.444
          },
          "stage_affinity": {
            "pre_idea": 0.02,
            "idea": 0.08,
            "prototype": 0.4,
            "launched": 1.0,
            "pre_seed": 0.88,
            "seed": 1.0,
            "series_a": 0.9
          },
          "geo_affinity": {
            "us": 1.0,
            "europe": 0.62,
            "latam": 0.48,
            "mena": 0.44,
            "asia": 0.52,
            "global": 0.88,
            "sf": 1.0,
            "abu_dhabi": 0.18,
            "saudi": 0.18,
            "chile": 0.2
          },
          "observed_snapshot_stats": {
            "teams": 10,
            "over_10m_annualized_by_demo_day_share": 0.5,
            "average_weekly_growth_rate": 0.12
          },
          "vector_semantics": "HF0 named cohort outcome DNA: official revenue/repeat-founder signals + family-level category prior. Not a complete accepted-company category census.",
          "notes": "HF0 reported 5/10 teams in its latest 2026 batch broke $10M annualized by demo day. Contemporaneous HF0 posts identify Tenkara as W26.",
          "sources": [
            "https://www.linkedin.com/posts/hf0_5-of-10-teams-at-demo-day-broke-10m-annualized-activity-7463636839501815808-gzwg",
            "https://www.linkedin.com/company/hf0"
          ]
        }
      },
      "observed_portfolio_stats": {
        "investment_activity": {
          "2024": {
            "first_round": 8,
            "follow_on": 0,
            "total": 8
          },
          "2025": {
            "first_round": 9,
            "follow_on": 2,
            "total": 11
          },
          "2026_ytd_jul": {
            "first_round": 5,
            "follow_on": 0,
            "total": 5
          }
        },
        "first_entry_stage": {
          "seed": 16,
          "series_a": 4,
          "series_b": 1,
          "series_d": 1,
          "total": 22,
          "seed_share": 0.727,
          "seed_or_a_share": 0.909,
          "avg_round_size_usd_m": {
            "seed": 8.65,
            "series_a": 13.2,
            "series_b": 20.0,
            "series_d": 112.0
          }
        },
        "sector_counts": {
          "enterprise_applications": 14,
          "high_tech": 7,
          "ai_industry_applications": 3,
          "consumer": 3,
          "aerospace_maritime_defense": 2,
          "others": 14,
          "tech_companies": 19,
          "enterprise_b2b_companies": 16,
          "software_companies": 14,
          "saas_companies_min": 9
        },
        "geography_counts": {
          "united_states": 18,
          "canada": 1,
          "india": 1,
          "singapore": 1,
          "known_total": 21,
          "us_share": 0.857
        },
        "recent_2026_investments": [
          {
            "date": "2026-07-28",
            "company": "Fish",
            "stage": "Seed",
            "location": "United States"
          },
          {
            "date": "2026-07-23",
            "company": "Ephemeral",
            "stage": "Seed",
            "location": null
          },
          {
            "date": "2026-03-23",
            "company": "Hamilton",
            "stage": "Seed",
            "location": "United States"
          },
          {
            "date": "2026-03-17",
            "company": "Tenkara",
            "stage": "Seed",
            "location": "United States"
          },
          {
            "date": "2026-03-17",
            "company": "Gency AI",
            "stage": "Series B",
            "location": "Singapore"
          }
        ],
        "source_semantics": "Tracxn HF0 investor activity / portfolio statistics. These are NOT equivalent to HF0 residency cohort membership and are used only for investment-stage, sector, geography and portfolio-maturity calibration."
      },
      "selection_pathways": {
        "repeat_founder": {
          "description": "Repeat founder / prior major outcome can independently explain strong fit.",
          "signals": [
            "repeat_founder",
            "prior_exit"
          ]
        },
        "breakout_company": {
          "description": "First-time founder can qualify through exceptional growth and market velocity.",
          "signals": [
            "traction",
            "revenue",
            "speed_ship"
          ]
        },
        "logic": "OR-like pathway; low repeat-founder status should not invalidate a company with exceptional breakout traction."
      }
    },
    "spc": {
      "name": "South Park Commons Founder Fellowship",
      "region": "US / Global",
      "archetype": "Founder-first -1 to 0 program for unusually ambitious technologists; idea can change, but depth, builder ability and long-horizon ambition must be exceptional.",
      "founder_targets": {
        "technical_depth": 0.92,
        "research_depth": 0.65,
        "elite_academic": 0.68,
        "elite_employer": 0.68,
        "repeat_founder": 0.5,
        "prior_exit": 0.28,
        "early_career": 0.6,
        "product_builder": 0.92,
        "enterprise_gtm": 0.35,
        "domain_expertise": 0.82,
        "speed": 0.88,
        "global_ambition": 1.0,
        "cofounder_complementarity": 0.6,
        "customer_obsession": 0.6
      },
      "company_targets": {
        "ai_native": 0.62,
        "technical_differentiation": 0.94,
        "defensible_ip": 0.68,
        "software_high_margin": 0.58,
        "capital_intensive": 0.55,
        "enterprise_b2b": 0.48,
        "consumer": 0.42,
        "developer_facing": 0.55,
        "regulated_market": 0.35,
        "traction": 0.3,
        "revenue": 0.15,
        "speed_ship": 0.8,
        "global_market": 0.92,
        "local_market_fit": 0.18,
        "team_small": 0.96,
        "proprietary_data": 0.4
      },
      "category_affinity": {
        "ai_agents": 0.78,
        "ai_infra": 0.84,
        "developer_tools": 0.82,
        "vertical_ai": 0.62,
        "voice_ai": 0.55,
        "physical_ai_robotics": 0.78,
        "cyber_security": 0.72,
        "fintech": 0.45,
        "health_bio": 0.7,
        "climate_energy": 0.72,
        "industrial_deeptech": 0.8,
        "semiconductors": 0.78,
        "defense_dualuse": 0.72,
        "consumer": 0.58,
        "gaming": 0.4,
        "marketplace": 0.32,
        "web3": 0.34,
        "scientific_ai": 0.82,
        "enterprise_saas": 0.58,
        "hardware": 0.76
      },
      "stage_affinity": {
        "pre_idea": 1.0,
        "idea": 1.0,
        "prototype": 0.82,
        "launched": 0.5,
        "pre_seed": 0.88,
        "seed": 0.38,
        "series_a": 0.05
      },
      "geo_affinity": {
        "us": 0.9,
        "europe": 0.58,
        "latam": 0.45,
        "mena": 0.42,
        "asia": 0.48,
        "global": 0.82,
        "sf": 1.0,
        "abu_dhabi": 0.16,
        "saudi": 0.16,
        "chile": 0.18
      },
      "years": {
        "2024": {
          "trend_tags": [
            "true pre-idea",
            "unreasonable ambition",
            "patient capital",
            "builder-first"
          ],
          "founder_overrides": {},
          "company_overrides": {
            "traction": 0.18,
            "revenue": 0.08
          },
          "category_overrides": {},
          "stage_overrides": {},
          "notes": "Fall 2024 explicitly described SPC as a -1 to 0 / pre-idea program.",
          "confidence": "high"
        },
        "2025": {
          "trend_tags": [
            "frontier technologists",
            "community density",
            "research-to-product",
            "repeat founders"
          ],
          "founder_overrides": {
            "research_depth": 0.68,
            "repeat_founder": 0.54
          },
          "company_overrides": {},
          "category_overrides": {},
          "stage_overrides": {},
          "notes": "Founder-first model remained stable.",
          "confidence": "medium"
        },
        "2026": {
          "trend_tags": [
            "AI makes building cheap",
            "depth over prompt-to-product",
            "frontier tech",
            "professors/dropouts/repeat exits"
          ],
          "founder_overrides": {
            "technical_depth": 0.96,
            "global_ambition": 1.0
          },
          "company_overrides": {
            "technical_differentiation": 0.98
          },
          "category_overrides": {},
          "stage_overrides": {},
          "notes": "2026 messaging explicitly prioritizes depth/direction as prototyping gets cheaper.",
          "confidence": "high"
        }
      },
      "sources": [
        "https://www.southparkcommons.com/founder-fellowship",
        "https://blog.southparkcommons.com/p/spc-founder-fellowship-fall-2024"
      ],
      "constraints": {}
    },
    "neo": {
      "name": "Neo Residency",
      "region": "US / Global",
      "archetype": "Ultra-curated technical-talent residency; unusually strong young builders, elite CS networks, student founders and pre-seed teams with high product velocity.",
      "founder_targets": {
        "technical_depth": 0.95,
        "research_depth": 0.58,
        "elite_academic": 0.82,
        "elite_employer": 0.58,
        "repeat_founder": 0.28,
        "prior_exit": 0.12,
        "early_career": 0.92,
        "product_builder": 0.95,
        "enterprise_gtm": 0.36,
        "domain_expertise": 0.62,
        "speed": 0.96,
        "global_ambition": 0.95,
        "cofounder_complementarity": 0.72,
        "customer_obsession": 0.66
      },
      "company_targets": {
        "ai_native": 0.8,
        "technical_differentiation": 0.9,
        "defensible_ip": 0.55,
        "software_high_margin": 0.75,
        "capital_intensive": 0.34,
        "enterprise_b2b": 0.54,
        "consumer": 0.55,
        "developer_facing": 0.72,
        "regulated_market": 0.2,
        "traction": 0.46,
        "revenue": 0.25,
        "speed_ship": 0.94,
        "global_market": 0.94,
        "local_market_fit": 0.15,
        "team_small": 0.96,
        "proprietary_data": 0.38
      },
      "category_affinity": {
        "ai_agents": 0.9,
        "ai_infra": 0.9,
        "developer_tools": 0.94,
        "vertical_ai": 0.72,
        "voice_ai": 0.65,
        "physical_ai_robotics": 0.62,
        "cyber_security": 0.65,
        "fintech": 0.52,
        "health_bio": 0.4,
        "climate_energy": 0.32,
        "industrial_deeptech": 0.5,
        "semiconductors": 0.58,
        "defense_dualuse": 0.45,
        "consumer": 0.72,
        "gaming": 0.52,
        "marketplace": 0.35,
        "web3": 0.38,
        "scientific_ai": 0.55,
        "enterprise_saas": 0.7,
        "hardware": 0.48
      },
      "stage_affinity": {
        "pre_idea": 0.72,
        "idea": 0.88,
        "prototype": 0.95,
        "launched": 0.78,
        "pre_seed": 1.0,
        "seed": 0.68,
        "series_a": 0.1
      },
      "geo_affinity": {
        "us": 0.94,
        "europe": 0.6,
        "latam": 0.42,
        "mena": 0.38,
        "asia": 0.52,
        "global": 0.78,
        "sf": 1.0,
        "abu_dhabi": 0.14,
        "saudi": 0.14,
        "chile": 0.16
      },
      "years": {
        "2024": {
          "trend_tags": [
            "elite CS students",
            "technical builder network",
            "early company formation"
          ],
          "founder_overrides": {},
          "company_overrides": {},
          "category_overrides": {},
          "stage_overrides": {},
          "notes": "Modeled from Neo's long-running Scholars/technical talent flywheel.",
          "confidence": "low"
        },
        "2025": {
          "trend_tags": [
            "AI-native student founders",
            "developer tools",
            "high-agency builders"
          ],
          "founder_overrides": {},
          "company_overrides": {
            "ai_native": 0.84
          },
          "category_overrides": {},
          "stage_overrides": {},
          "notes": "",
          "confidence": "low"
        },
        "2026": {
          "trend_tags": [
            "up to 20 startups/student teams",
            "$750k uncapped for startups",
            "SF residency",
            "OpenAI/Microsoft access"
          ],
          "founder_overrides": {
            "early_career": 0.96
          },
          "company_overrides": {
            "ai_native": 0.88
          },
          "category_overrides": {},
          "stage_overrides": {},
          "notes": "2026 Residency explicitly mixes student teams and pre-seed/seed startups.",
          "confidence": "high"
        }
      },
      "sources": [
        "https://portal.neo.com/residency",
        "https://neo.com/"
      ],
      "constraints": {}
    },
    "pearx": {
      "name": "PearX",
      "region": "US / Global",
      "archetype": "Small-batch pre-seed accelerator emphasizing exceptional founders, rapid learning, customer insight and shipping; very strong AI share in recent cohorts.",
      "founder_targets": {
        "technical_depth": 0.82,
        "research_depth": 0.48,
        "elite_academic": 0.62,
        "elite_employer": 0.55,
        "repeat_founder": 0.38,
        "prior_exit": 0.16,
        "early_career": 0.64,
        "product_builder": 0.92,
        "enterprise_gtm": 0.56,
        "domain_expertise": 0.78,
        "speed": 0.95,
        "global_ambition": 0.92,
        "cofounder_complementarity": 0.82,
        "customer_obsession": 0.98
      },
      "company_targets": {
        "ai_native": 0.88,
        "technical_differentiation": 0.78,
        "defensible_ip": 0.45,
        "software_high_margin": 0.82,
        "capital_intensive": 0.28,
        "enterprise_b2b": 0.7,
        "consumer": 0.48,
        "developer_facing": 0.62,
        "regulated_market": 0.32,
        "traction": 0.56,
        "revenue": 0.35,
        "speed_ship": 0.96,
        "global_market": 0.92,
        "local_market_fit": 0.18,
        "team_small": 0.92,
        "proprietary_data": 0.42
      },
      "category_affinity": {
        "ai_agents": 0.94,
        "ai_infra": 0.88,
        "developer_tools": 0.84,
        "vertical_ai": 0.92,
        "voice_ai": 0.76,
        "physical_ai_robotics": 0.58,
        "cyber_security": 0.68,
        "fintech": 0.62,
        "health_bio": 0.58,
        "climate_energy": 0.38,
        "industrial_deeptech": 0.48,
        "semiconductors": 0.45,
        "defense_dualuse": 0.38,
        "consumer": 0.65,
        "gaming": 0.44,
        "marketplace": 0.42,
        "web3": 0.3,
        "scientific_ai": 0.62,
        "enterprise_saas": 0.88,
        "hardware": 0.4
      },
      "stage_affinity": {
        "pre_idea": 0.25,
        "idea": 0.82,
        "prototype": 0.96,
        "launched": 0.9,
        "pre_seed": 1.0,
        "seed": 0.52,
        "series_a": 0.08
      },
      "geo_affinity": {
        "us": 0.94,
        "europe": 0.58,
        "latam": 0.44,
        "mena": 0.4,
        "asia": 0.52,
        "global": 0.8,
        "sf": 1.0,
        "abu_dhabi": 0.15,
        "saudi": 0.15,
        "chile": 0.16
      },
      "years": {
        "2024": {
          "trend_tags": [
            "95%+ AI in S24",
            "AI infrastructure",
            "vertical AI",
            "small cohorts"
          ],
          "founder_overrides": {},
          "company_overrides": {
            "ai_native": 0.96
          },
          "category_overrides": {
            "ai_infra": 0.94,
            "vertical_ai": 0.95
          },
          "stage_overrides": {},
          "notes": "Pear reported >95% AI in S24.",
          "confidence": "high"
        },
        "2025": {
          "trend_tags": [
            "idea-to-traction",
            "hands-on product",
            "AI remains dominant",
            "small cohort"
          ],
          "founder_overrides": {
            "customer_obsession": 0.96
          },
          "company_overrides": {
            "ai_native": 0.91
          },
          "category_overrides": {},
          "stage_overrides": {},
          "notes": "",
          "confidence": "medium"
        },
        "2026": {
          "trend_tags": [
            "building is cheap, learning is edge",
            "demand discovery",
            "customer insight",
            "pre-seed AI"
          ],
          "founder_overrides": {
            "customer_obsession": 1.0
          },
          "company_overrides": {
            "speed_ship": 0.96,
            "ai_native": 0.92
          },
          "category_overrides": {},
          "stage_overrides": {},
          "notes": "S26 Request for Startups explicitly reframes advantage as speed of learning rather than speed of coding.",
          "confidence": "high"
        }
      },
      "sources": [
        "https://pear.vc/pearx-s26-applications/",
        "https://pear.vc/request-for-startups/"
      ],
      "constraints": {}
    },
    "alchemist": {
      "name": "Alchemist Accelerator",
      "region": "US / Global",
      "archetype": "Enterprise-first accelerator for technical founders commercializing B2B software/deep tech; strong preference for teams that can sell into enterprises.",
      "founder_targets": {
        "technical_depth": 0.9,
        "research_depth": 0.52,
        "elite_academic": 0.48,
        "elite_employer": 0.58,
        "repeat_founder": 0.42,
        "prior_exit": 0.18,
        "early_career": 0.36,
        "product_builder": 0.82,
        "enterprise_gtm": 0.9,
        "domain_expertise": 0.9,
        "speed": 0.8,
        "global_ambition": 0.84,
        "cofounder_complementarity": 0.92,
        "customer_obsession": 0.94
      },
      "company_targets": {
        "ai_native": 0.72,
        "technical_differentiation": 0.82,
        "defensible_ip": 0.62,
        "software_high_margin": 0.78,
        "capital_intensive": 0.48,
        "enterprise_b2b": 1.0,
        "consumer": 0.08,
        "developer_facing": 0.55,
        "regulated_market": 0.58,
        "traction": 0.66,
        "revenue": 0.52,
        "speed_ship": 0.8,
        "global_market": 0.82,
        "local_market_fit": 0.42,
        "team_small": 0.76,
        "proprietary_data": 0.52
      },
      "category_affinity": {
        "ai_agents": 0.78,
        "ai_infra": 0.8,
        "developer_tools": 0.78,
        "vertical_ai": 0.9,
        "voice_ai": 0.64,
        "physical_ai_robotics": 0.68,
        "cyber_security": 0.82,
        "fintech": 0.68,
        "health_bio": 0.68,
        "climate_energy": 0.66,
        "industrial_deeptech": 0.88,
        "semiconductors": 0.64,
        "defense_dualuse": 0.62,
        "consumer": 0.08,
        "gaming": 0.12,
        "marketplace": 0.34,
        "web3": 0.28,
        "scientific_ai": 0.72,
        "enterprise_saas": 0.96,
        "hardware": 0.65
      },
      "stage_affinity": {
        "pre_idea": 0.05,
        "idea": 0.22,
        "prototype": 0.72,
        "launched": 0.92,
        "pre_seed": 0.88,
        "seed": 0.88,
        "series_a": 0.35
      },
      "geo_affinity": {
        "us": 0.92,
        "europe": 0.62,
        "latam": 0.48,
        "mena": 0.45,
        "asia": 0.58,
        "global": 0.82,
        "sf": 0.96,
        "abu_dhabi": 0.2,
        "saudi": 0.2,
        "chile": 0.22
      },
      "years": {
        "2024": {
          "trend_tags": [
            "enterprise monetization",
            "technical founding teams",
            "AI-SaaS",
            "deep tech"
          ],
          "founder_overrides": {},
          "company_overrides": {},
          "category_overrides": {},
          "stage_overrides": {},
          "notes": "",
          "confidence": "medium"
        },
        "2025": {
          "trend_tags": [
            "enterprise AI",
            "Japan/global deep tech cohorts",
            "domain-specific AI"
          ],
          "founder_overrides": {},
          "company_overrides": {
            "ai_native": 0.76
          },
          "category_overrides": {},
          "stage_overrides": {},
          "notes": "",
          "confidence": "medium"
        },
        "2026": {
          "trend_tags": [
            "AI-native enterprise",
            "deeptech commercialization",
            "technical + business cofounder"
          ],
          "founder_overrides": {
            "cofounder_complementarity": 0.95
          },
          "company_overrides": {},
          "category_overrides": {},
          "stage_overrides": {},
          "notes": "",
          "confidence": "medium"
        }
      },
      "sources": [
        "https://www.alchemistaccelerator.com/"
      ],
      "constraints": {}
    },
    "ef": {
      "name": "Entrepreneurs First",
      "region": "Europe / SF bridge / Global",
      "archetype": "Founder-first Talent Investing: EF selects exceptional individuals before a company, cofounder or fixed idea, then drives cofounder formation, rapid zero-to-one execution and globally ambitious technology-company creation.",
      "founder_targets": {
        "technical_depth": 0.9,
        "research_depth": 0.6,
        "elite_academic": 0.52,
        "elite_employer": 0.5,
        "product_builder": 0.96,
        "enterprise_gtm": 0.46,
        "domain_expertise": 0.88,
        "speed": 0.98,
        "global_ambition": 1.0,
        "cofounder_complementarity": 0.96,
        "customer_obsession": 0.82
      },
      "company_targets": {
        "technical_differentiation": 0.9,
        "speed_ship": 0.9,
        "global_market": 0.98,
        "team_small": 0.98
      },
      "category_affinity": {
        "ai_agents": 0.789,
        "ai_infra": 0.791,
        "developer_tools": 0.769,
        "vertical_ai": 0.834,
        "voice_ai": 0.639,
        "physical_ai_robotics": 0.679,
        "cyber_security": 0.635,
        "fintech": 0.646,
        "health_bio": 0.693,
        "climate_energy": 0.612,
        "industrial_deeptech": 0.751,
        "semiconductors": 0.602,
        "defense_dualuse": 0.605,
        "consumer": 0.582,
        "gaming": 0.43,
        "marketplace": 0.448,
        "web3": 0.381,
        "scientific_ai": 0.723,
        "enterprise_saas": 0.766,
        "hardware": 0.624
      },
      "stage_affinity": {
        "pre_idea": 1.0,
        "idea": 1.0,
        "prototype": 0.88,
        "launched": 0.66,
        "pre_seed": 0.94,
        "seed": 0.38,
        "series_a": 0.06
      },
      "geo_affinity": {
        "us": 0.86,
        "europe": 1.0,
        "latam": 0.42,
        "mena": 0.4,
        "asia": 0.76,
        "global": 0.98,
        "sf": 1.0,
        "abu_dhabi": 0.16,
        "saudi": 0.16,
        "chile": 0.18,
        "nyc": 0.72,
        "london": 1.0,
        "paris": 0.88,
        "bangalore": 0.88
      },
      "years": {
        "2024": {
          "trend_tags": [
            "AI-native vertical formation",
            "biotech and healthcare",
            "industrial/deeptech",
            "developer infrastructure",
            "two-founder CEO/CTO formation"
          ],
          "founder_overrides": {
            "cofounder_complementarity": 0.97,
            "global_ambition": 0.99,
            "product_builder": 0.95,
            "speed": 0.97,
            "early_career": 0.82,
            "repeat_founder": 0.24
          },
          "company_overrides": {
            "technical_differentiation": 0.9,
            "speed_ship": 0.9,
            "global_market": 0.98,
            "team_small": 0.98
          },
          "category_overrides": {
            "ai_agents": 0.694,
            "ai_infra": 0.735,
            "developer_tools": 0.734,
            "vertical_ai": 0.901,
            "voice_ai": 0.603,
            "physical_ai_robotics": 0.679,
            "cyber_security": 0.601,
            "fintech": 0.656,
            "health_bio": 0.762,
            "climate_energy": 0.608,
            "industrial_deeptech": 0.802,
            "semiconductors": 0.603,
            "defense_dualuse": 0.617,
            "consumer": 0.629,
            "gaming": 0.496,
            "marketplace": 0.523,
            "web3": 0.427,
            "scientific_ai": 0.73,
            "enterprise_saas": 0.838,
            "hardware": 0.656
          },
          "stage_overrides": {},
          "notes": "[DATA-CALIBRATED OUTCOME LAYER] 74 current EF portfolio companies in the supplied export have Founded=2024. AI-description share=52.7%; two listed founders=81.1%; CEO+CTO pair=66.2%. Founded year is NOT treated as EF batch year. Category/team composition is used as portfolio-formation evidence; founder-selection targets come from EF's official person-first selection criteria.",
          "confidence": "high"
        },
        "2025": {
          "trend_tags": [
            "AI agents accelerate",
            "developer infrastructure rises",
            "deeptech and defense",
            "global / SF bridge ambition",
            "two-founder CEO/CTO formation"
          ],
          "founder_overrides": {
            "cofounder_complementarity": 0.97,
            "global_ambition": 0.99,
            "product_builder": 0.95,
            "speed": 0.97,
            "early_career": 0.78,
            "repeat_founder": 0.28
          },
          "company_overrides": {
            "technical_differentiation": 0.93,
            "speed_ship": 0.94,
            "global_market": 0.98,
            "team_small": 0.98
          },
          "category_overrides": {
            "ai_agents": 0.791,
            "ai_infra": 0.758,
            "developer_tools": 0.749,
            "vertical_ai": 0.901,
            "voice_ai": 0.619,
            "physical_ai_robotics": 0.6,
            "cyber_security": 0.602,
            "fintech": 0.674,
            "health_bio": 0.71,
            "climate_energy": 0.607,
            "industrial_deeptech": 0.768,
            "semiconductors": 0.567,
            "defense_dualuse": 0.617,
            "consumer": 0.638,
            "gaming": 0.516,
            "marketplace": 0.523,
            "web3": 0.427,
            "scientific_ai": 0.678,
            "enterprise_saas": 0.781,
            "hardware": 0.597
          },
          "stage_overrides": {},
          "notes": "[DATA-CALIBRATED OUTCOME LAYER] 70 current EF portfolio companies in the supplied export have Founded=2025. AI-description share=58.6%; two listed founders=80.0%; CEO+CTO pair=80.0%. Founded year is NOT treated as EF batch year. Category/team composition is used as portfolio-formation evidence; founder-selection targets come from EF's official person-first selection criteria.",
          "confidence": "high"
        },
        "2026": {
          "trend_tags": [
            "founder-first selection remains primary",
            "Fellowship + direct funding pathways",
            "experienced-founder pathway added",
            "SF bridge becomes structural",
            "AI / physical-world / frontier-tech outcomes"
          ],
          "founder_overrides": {
            "cofounder_complementarity": 0.97,
            "global_ambition": 0.99,
            "product_builder": 0.95,
            "speed": 0.97
          },
          "company_overrides": {
            "technical_differentiation": 0.93,
            "speed_ship": 0.94,
            "global_market": 0.98,
            "team_small": 0.98
          },
          "category_overrides": {
            "ai_agents": 0.707,
            "ai_infra": 0.786,
            "developer_tools": 0.747,
            "vertical_ai": 0.818,
            "voice_ai": 0.594,
            "physical_ai_robotics": 0.679,
            "cyber_security": 0.591,
            "fintech": 0.677,
            "health_bio": 0.69,
            "climate_energy": 0.574,
            "industrial_deeptech": 0.773,
            "semiconductors": 0.567,
            "defense_dualuse": 0.646,
            "consumer": 0.551,
            "gaming": 0.438,
            "marketplace": 0.451,
            "web3": 0.401,
            "scientific_ai": 0.657,
            "enterprise_saas": 0.812,
            "hardware": 0.583
          },
          "stage_overrides": {},
          "notes": "[DATA-CALIBRATED OUTCOME LAYER] 10 current EF portfolio companies in the supplied export have Founded=2026. AI-description share=30.0%; two listed founders=80.0%; CEO+CTO pair=100.0%. Founded year is NOT treated as EF batch year. Category/team composition is used as portfolio-formation evidence; founder-selection targets come from EF's official person-first selection criteria.",
          "confidence": "medium"
        }
      },
      "sources": [
        "https://www.joinef.com/",
        "https://www.joinef.com/the-fellowship-residency/",
        "https://www.joinef.com/faqs/",
        "https://apply.joinef.com/",
        "https://www.joinef.com/who-you-ll-meet/",
        "https://www.joinef.com/posts/introducing-the-bridge/",
        "https://www.joinef.com/posts/2026-q1-portfolio-news/",
        "https://www.joinef.com/posts/2026-q2-portfolio-news/",
        "Internal Scouter EF portfolio export parsed 2026-09-05, n=192"
      ],
      "constraints": {
        "founder_first": true,
        "idea_not_required": true,
        "cofounder_not_required": true,
        "technical_majority_not_absolute": true
      },
      "entity_type": "founder_first_investor_program",
      "year_semantics": "portfolio_company_founded_year_calibration; NOT exact EF batch membership",
      "component_weights": {
        "founder": 0.62,
        "company": 0.2,
        "category": 0.05,
        "stage": 0.08,
        "geography": 0.05
      },
      "observed_portfolio_stats": {
        "snapshot_as_of": "2026-09-05",
        "total_companies_parsed": 192,
        "founded_year_counts": {
          "2023": 38,
          "2024": 74,
          "2025": 70,
          "2026": 10
        },
        "last_three_years": {
          "n": 154,
          "ai_description_share": 0.539,
          "avg_listed_founders": 1.92,
          "median_listed_founders": 2.0,
          "solo_founder_share": 0.13,
          "two_founder_share": 0.805,
          "three_plus_founder_share": 0.058,
          "ceo_cto_pair_share": 0.747,
          "category_share": {
            "ai_agents": 0.13,
            "ai_infra": 0.136,
            "developer_tools": 0.136,
            "vertical_ai": 0.468,
            "voice_ai": 0.032,
            "physical_ai_robotics": 0.058,
            "cyber_security": 0.026,
            "fintech": 0.104,
            "health_bio": 0.188,
            "climate_energy": 0.039,
            "industrial_deeptech": 0.253,
            "semiconductors": 0.026,
            "defense_dualuse": 0.065,
            "consumer": 0.084,
            "gaming": 0.019,
            "marketplace": 0.026,
            "web3": 0.0,
            "scientific_ai": 0.104,
            "enterprise_saas": 0.312,
            "hardware": 0.058
          },
          "location_share": {
            "london": 0.429,
            "paris": 0.24,
            "bangalore": 0.182,
            "nyc": 0.065,
            "sf": 0.052,
            "external": 0.019,
            "other": 0.013
          },
          "top_industries": [
            {
              "industry": "Enterprise Services",
              "count": 33,
              "share": 0.214
            },
            {
              "industry": "Dev Tools / Infra",
              "count": 20,
              "share": 0.13
            },
            {
              "industry": "Healthcare",
              "count": 16,
              "share": 0.104
            },
            {
              "industry": "Biotechnology",
              "count": 15,
              "share": 0.097
            },
            {
              "industry": "Industrial & Manufacturing",
              "count": 14,
              "share": 0.091
            },
            {
              "industry": "Financial Services",
              "count": 12,
              "share": 0.078
            },
            {
              "industry": "Legal & Compliance",
              "count": 10,
              "share": 0.065
            },
            {
              "industry": "Marketing & Advertising",
              "count": 10,
              "share": 0.065
            },
            {
              "industry": "Aerospace & Defence",
              "count": 9,
              "share": 0.058
            },
            {
              "industry": "Construction & Real Estate",
              "count": 8,
              "share": 0.052
            },
            {
              "industry": "Robotics",
              "count": 5,
              "share": 0.032
            },
            {
              "industry": "Pharmaceuticals",
              "count": 5,
              "share": 0.032
            },
            {
              "industry": "Insurance",
              "count": 4,
              "share": 0.026
            },
            {
              "industry": "Agriculture & Farming",
              "count": 4,
              "share": 0.026
            },
            {
              "industry": "Privacy & Cybersecurity",
              "count": 4,
              "share": 0.026
            }
          ]
        },
        "formation_year_stats": {
          "2024": {
            "n": 74,
            "ai_description_share": 0.527,
            "avg_listed_founders": 1.92,
            "median_listed_founders": 2.0,
            "solo_founder_share": 0.135,
            "two_founder_share": 0.811,
            "three_plus_founder_share": 0.054,
            "ceo_cto_pair_share": 0.662,
            "category_share": {
              "ai_agents": 0.054,
              "ai_infra": 0.108,
              "developer_tools": 0.122,
              "vertical_ai": 0.473,
              "voice_ai": 0.027,
              "physical_ai_robotics": 0.095,
              "cyber_security": 0.027,
              "fintech": 0.081,
              "health_bio": 0.243,
              "climate_energy": 0.041,
              "industrial_deeptech": 0.284,
              "semiconductors": 0.041,
              "defense_dualuse": 0.054,
              "consumer": 0.081,
              "gaming": 0.014,
              "marketplace": 0.027,
              "web3": 0.0,
              "scientific_ai": 0.149,
              "enterprise_saas": 0.365,
              "hardware": 0.095
            },
            "location_share": {
              "london": 0.473,
              "bangalore": 0.176,
              "paris": 0.176,
              "nyc": 0.122,
              "sf": 0.041,
              "external": 0.014
            },
            "top_industries": [
              {
                "industry": "Enterprise Services",
                "count": 24,
                "share": 0.324
              },
              {
                "industry": "Biotechnology",
                "count": 12,
                "share": 0.162
              },
              {
                "industry": "Industrial & Manufacturing",
                "count": 8,
                "share": 0.108
              },
              {
                "industry": "Dev Tools / Infra",
                "count": 8,
                "share": 0.108
              },
              {
                "industry": "Healthcare",
                "count": 8,
                "share": 0.108
              },
              {
                "industry": "Legal & Compliance",
                "count": 5,
                "share": 0.068
              },
              {
                "industry": "Construction & Real Estate",
                "count": 5,
                "share": 0.068
              },
              {
                "industry": "Aerospace & Defence",
                "count": 4,
                "share": 0.054
              },
              {
                "industry": "Robotics",
                "count": 4,
                "share": 0.054
              },
              {
                "industry": "Pharmaceuticals",
                "count": 4,
                "share": 0.054
              },
              {
                "industry": "Financial Services",
                "count": 4,
                "share": 0.054
              },
              {
                "industry": "Marketing & Advertising",
                "count": 3,
                "share": 0.041
              },
              {
                "industry": "Telecoms & Media",
                "count": 3,
                "share": 0.041
              },
              {
                "industry": "Logistics",
                "count": 3,
                "share": 0.041
              },
              {
                "industry": "Insurance",
                "count": 2,
                "share": 0.027
              }
            ]
          },
          "2025": {
            "n": 70,
            "ai_description_share": 0.586,
            "avg_listed_founders": 1.87,
            "median_listed_founders": 2.0,
            "solo_founder_share": 0.143,
            "two_founder_share": 0.8,
            "three_plus_founder_share": 0.043,
            "ceo_cto_pair_share": 0.8,
            "category_share": {
              "ai_agents": 0.229,
              "ai_infra": 0.157,
              "developer_tools": 0.157,
              "vertical_ai": 0.5,
              "voice_ai": 0.043,
              "physical_ai_robotics": 0.014,
              "cyber_security": 0.029,
              "fintech": 0.114,
              "health_bio": 0.143,
              "climate_energy": 0.043,
              "industrial_deeptech": 0.214,
              "semiconductors": 0.014,
              "defense_dualuse": 0.057,
              "consumer": 0.1,
              "gaming": 0.029,
              "marketplace": 0.029,
              "web3": 0.0,
              "scientific_ai": 0.071,
              "enterprise_saas": 0.229,
              "hardware": 0.029
            },
            "location_share": {
              "london": 0.371,
              "paris": 0.343,
              "bangalore": 0.157,
              "sf": 0.071,
              "other": 0.029,
              "external": 0.029
            },
            "top_industries": [
              {
                "industry": "Dev Tools / Infra",
                "count": 11,
                "share": 0.157
              },
              {
                "industry": "Enterprise Services",
                "count": 8,
                "share": 0.114
              },
              {
                "industry": "Healthcare",
                "count": 7,
                "share": 0.1
              },
              {
                "industry": "Financial Services",
                "count": 6,
                "share": 0.086
              },
              {
                "industry": "Industrial & Manufacturing",
                "count": 5,
                "share": 0.071
              },
              {
                "industry": "Marketing & Advertising",
                "count": 5,
                "share": 0.071
              },
              {
                "industry": "Aerospace & Defence",
                "count": 4,
                "share": 0.057
              },
              {
                "industry": "Biotechnology",
                "count": 3,
                "share": 0.043
              },
              {
                "industry": "Legal & Compliance",
                "count": 3,
                "share": 0.043
              },
              {
                "industry": "Energy & Utilities",
                "count": 3,
                "share": 0.043
              },
              {
                "industry": "Consumer Products",
                "count": 3,
                "share": 0.043
              },
              {
                "industry": "Construction & Real Estate",
                "count": 3,
                "share": 0.043
              },
              {
                "industry": "Privacy & Cybersecurity",
                "count": 2,
                "share": 0.029
              },
              {
                "industry": "Agriculture & Farming",
                "count": 2,
                "share": 0.029
              },
              {
                "industry": "Gaming",
                "count": 2,
                "share": 0.029
              }
            ]
          },
          "2026": {
            "n": 10,
            "ai_description_share": 0.3,
            "avg_listed_founders": 2.2,
            "median_listed_founders": 2.0,
            "solo_founder_share": 0.0,
            "two_founder_share": 0.8,
            "three_plus_founder_share": 0.2,
            "ceo_cto_pair_share": 1.0,
            "category_share": {
              "ai_agents": 0.0,
              "ai_infra": 0.2,
              "developer_tools": 0.1,
              "vertical_ai": 0.2,
              "voice_ai": 0.0,
              "physical_ai_robotics": 0.1,
              "cyber_security": 0.0,
              "fintech": 0.2,
              "health_bio": 0.1,
              "climate_energy": 0.0,
              "industrial_deeptech": 0.3,
              "semiconductors": 0.0,
              "defense_dualuse": 0.2,
              "consumer": 0.0,
              "gaming": 0.0,
              "marketplace": 0.0,
              "web3": 0.0,
              "scientific_ai": 0.0,
              "enterprise_saas": 0.5,
              "hardware": 0.0
            },
            "location_share": {
              "london": 0.5,
              "bangalore": 0.4,
              "nyc": 0.1
            },
            "top_industries": [
              {
                "industry": "Financial Services",
                "count": 2,
                "share": 0.2
              },
              {
                "industry": "Legal & Compliance",
                "count": 2,
                "share": 0.2
              },
              {
                "industry": "Marketing & Advertising",
                "count": 2,
                "share": 0.2
              },
              {
                "industry": "Industrial & Manufacturing",
                "count": 1,
                "share": 0.1
              },
              {
                "industry": "Aerospace & Defence",
                "count": 1,
                "share": 0.1
              },
              {
                "industry": "Enterprise Services",
                "count": 1,
                "share": 0.1
              },
              {
                "industry": "Logistics",
                "count": 1,
                "share": 0.1
              },
              {
                "industry": "Dev Tools / Infra",
                "count": 1,
                "share": 0.1
              },
              {
                "industry": "Healthcare",
                "count": 1,
                "share": 0.1
              }
            ]
          }
        },
        "method_note": "Source is the user-provided EF public portfolio export. It supplies company, location, industries, description, founder names/profile links, roles and Founded year. It does not supply exact EF program/batch membership, acceptance date, employee count or complete comparable founder biographies."
      },
      "selection_dna": {
        "official_signals": [
          "continuously outperformed peer group",
          "exceptional outcomes relative to peers",
          "ambition",
          "founder aptitude",
          "extreme bias to action",
          "intellectual excellence",
          "ability to anticipate/reimagine/build future technology",
          "majority technical backgrounds",
          "previous building of products, organizations or startups",
          "cofounder formation",
          "globally important / U.S.-scale ambition"
        ],
        "cofounder_signal": "EF states that about 80% of participants find a cofounder within eight weeks.",
        "current_2026_pathways": {
          "fellowship": "$10K equity-free grant, 3-month SF residency for exploration",
          "direct_funding": "up to $250K for founders ready to go all-in",
          "experienced_founders": "XF2 Fall 2026 targets founders/operators with 7+ years experience who previously founded or were key to company inception"
        }
      }
    },
    "antler": {
      "name": "Antler",
      "region": "Global (regional residencies)",
      "archetype": "Day-zero global investor; strong domain operators and builders, increasingly mixing repeat founders, technical teams and evidence of commercial pull before showcase.",
      "founder_targets": {
        "technical_depth": 0.68,
        "research_depth": 0.38,
        "elite_academic": 0.42,
        "elite_employer": 0.58,
        "repeat_founder": 0.56,
        "prior_exit": 0.3,
        "early_career": 0.45,
        "product_builder": 0.8,
        "enterprise_gtm": 0.78,
        "domain_expertise": 0.9,
        "speed": 0.82,
        "global_ambition": 0.84,
        "cofounder_complementarity": 0.88,
        "customer_obsession": 0.9
      },
      "company_targets": {
        "ai_native": 0.7,
        "technical_differentiation": 0.66,
        "defensible_ip": 0.45,
        "software_high_margin": 0.7,
        "capital_intensive": 0.45,
        "enterprise_b2b": 0.72,
        "consumer": 0.4,
        "developer_facing": 0.38,
        "regulated_market": 0.48,
        "traction": 0.7,
        "revenue": 0.56,
        "speed_ship": 0.82,
        "global_market": 0.78,
        "local_market_fit": 0.6,
        "team_small": 0.76,
        "proprietary_data": 0.44
      },
      "category_affinity": {
        "ai_agents": 0.82,
        "ai_infra": 0.64,
        "developer_tools": 0.58,
        "vertical_ai": 0.88,
        "voice_ai": 0.76,
        "physical_ai_robotics": 0.72,
        "cyber_security": 0.66,
        "fintech": 0.78,
        "health_bio": 0.75,
        "climate_energy": 0.72,
        "industrial_deeptech": 0.76,
        "semiconductors": 0.52,
        "defense_dualuse": 0.55,
        "consumer": 0.52,
        "gaming": 0.35,
        "marketplace": 0.55,
        "web3": 0.28,
        "scientific_ai": 0.62,
        "enterprise_saas": 0.85,
        "hardware": 0.68
      },
      "stage_affinity": {
        "pre_idea": 0.7,
        "idea": 0.9,
        "prototype": 0.92,
        "launched": 0.82,
        "pre_seed": 1.0,
        "seed": 0.68,
        "series_a": 0.1
      },
      "geo_affinity": {
        "us": 0.88,
        "europe": 0.9,
        "latam": 0.68,
        "mena": 0.62,
        "asia": 0.82,
        "global": 1.0,
        "sf": 0.78,
        "abu_dhabi": 0.32,
        "saudi": 0.3,
        "chile": 0.38
      },
      "years": {
        "2024": {
          "trend_tags": [
            "day-zero founders",
            "operator-heavy teams",
            "AI enterprise",
            "health/fintech",
            "repeat founders in US"
          ],
          "founder_overrides": {
            "repeat_founder": 0.52
          },
          "company_overrides": {},
          "category_overrides": {},
          "stage_overrides": {},
          "notes": "US showcases show strong operator/repeat-founder and domain-specialist DNA.",
          "confidence": "high"
        },
        "2025": {
          "trend_tags": [
            "enterprise AI",
            "hardware/energy",
            "fintech",
            "domain teams",
            "commercial evidence"
          ],
          "founder_overrides": {},
          "company_overrides": {
            "traction": 0.72,
            "ai_native": 0.72
          },
          "category_overrides": {},
          "stage_overrides": {},
          "notes": "",
          "confidence": "medium"
        },
        "2026": {
          "trend_tags": [
            "repeat/exited founders",
            "AI voice",
            "deeptech",
            "energy",
            "real ARR/LOIs by showcase"
          ],
          "founder_overrides": {
            "repeat_founder": 0.64,
            "prior_exit": 0.36
          },
          "company_overrides": {
            "traction": 0.8,
            "revenue": 0.66
          },
          "category_overrides": {
            "enterprise_saas": 0.515,
            "climate_energy": 0.061,
            "industrial_deeptech": 0.091,
            "consumer": 0.152,
            "fintech": 0.061,
            "health_bio": 0.091
          },
          "stage_overrides": {},
          "notes": "Spring 2026 US showcase includes multiple repeat/exited founders and meaningful ARR/pilot evidence. [DATA LIMITATION] Source scrape has NO founder-level data (no names/bios) - founder_targets/overrides remain hand-authored priors, NOT empirically calibrated. [DATA-CALIBRATED] category mix from real industry/sector tags (n=33, mapped categories: climate_energy, consumer, enterprise_saas, fintech, health_bio, industrial_deeptech).",
          "confidence": "high"
        }
      },
      "sources": [
        "https://www.antler.co/blog/announcing-the-spring-2024-us-portfolio-showcase-antler-us",
        "https://www.antler.co/blog/announcing-the-fall-2025-u-s-portfolio-showcase",
        "https://www.antler.co/blog/announcing-the-spring-2026-u-s-portfolio-showcase",
        "Internal Scouter scrape (Apify YC/Techstars/Antler datasets), n=33 companies, calibrated 2026-09-05"
      ],
      "constraints": {}
    },
    "seedcamp": {
      "name": "Seedcamp",
      "region": "Europe / Global",
      "archetype": "Europe's day-one seed fund; high-margin software, global ambition, fast time-to-market and increasingly AI/devtools/security-heavy technical teams.",
      "founder_targets": {
        "technical_depth": 0.8,
        "research_depth": 0.48,
        "elite_academic": 0.52,
        "elite_employer": 0.58,
        "repeat_founder": 0.52,
        "prior_exit": 0.28,
        "early_career": 0.48,
        "product_builder": 0.9,
        "enterprise_gtm": 0.7,
        "domain_expertise": 0.82,
        "speed": 0.9,
        "global_ambition": 0.98,
        "cofounder_complementarity": 0.84,
        "customer_obsession": 0.9
      },
      "company_targets": {
        "ai_native": 0.84,
        "technical_differentiation": 0.82,
        "defensible_ip": 0.5,
        "software_high_margin": 0.96,
        "capital_intensive": 0.22,
        "enterprise_b2b": 0.82,
        "consumer": 0.32,
        "developer_facing": 0.7,
        "regulated_market": 0.42,
        "traction": 0.66,
        "revenue": 0.45,
        "speed_ship": 0.92,
        "global_market": 0.98,
        "local_market_fit": 0.2,
        "team_small": 0.82,
        "proprietary_data": 0.48
      },
      "category_affinity": {
        "ai_agents": 0.94,
        "ai_infra": 0.9,
        "developer_tools": 0.94,
        "vertical_ai": 0.92,
        "voice_ai": 0.82,
        "physical_ai_robotics": 0.48,
        "cyber_security": 0.94,
        "fintech": 0.8,
        "health_bio": 0.68,
        "climate_energy": 0.58,
        "industrial_deeptech": 0.56,
        "semiconductors": 0.66,
        "defense_dualuse": 0.45,
        "consumer": 0.4,
        "gaming": 0.32,
        "marketplace": 0.4,
        "web3": 0.28,
        "scientific_ai": 0.78,
        "enterprise_saas": 0.96,
        "hardware": 0.4
      },
      "stage_affinity": {
        "pre_idea": 0.08,
        "idea": 0.45,
        "prototype": 0.85,
        "launched": 0.92,
        "pre_seed": 1.0,
        "seed": 0.88,
        "series_a": 0.2
      },
      "geo_affinity": {
        "us": 0.55,
        "europe": 1.0,
        "latam": 0.35,
        "mena": 0.4,
        "asia": 0.35,
        "global": 0.88,
        "sf": 0.5,
        "abu_dhabi": 0.16,
        "saudi": 0.16,
        "chile": 0.16
      },
      "years": {
        "2024": {
          "trend_tags": [
            "security",
            "devtools/computing",
            "AI applications",
            "European software"
          ],
          "founder_overrides": {},
          "company_overrides": {},
          "category_overrides": {
            "cyber_security": 1.0,
            "developer_tools": 1.0,
            "ai_infra": 0.92
          },
          "stage_overrides": {},
          "notes": "36 new companies; highlighted security, devtools/computing and AI applications.",
          "confidence": "high"
        },
        "2025": {
          "trend_tags": [
            "enterprise AI",
            "voice AI infra",
            "AI chip design",
            "frontier data",
            "scientific AI"
          ],
          "founder_overrides": {},
          "company_overrides": {
            "ai_native": 0.88
          },
          "category_overrides": {
            "voice_ai": 0.88,
            "semiconductors": 0.72,
            "scientific_ai": 0.84
          },
          "stage_overrides": {},
          "notes": "Portfolio additions broadened AI across infrastructure and scientific/industrial use cases.",
          "confidence": "medium"
        },
        "2026": {
          "trend_tags": [
            "revenue infrastructure for AI",
            "AI legal/admin",
            "AI workforce OS",
            "security",
            "high-margin software"
          ],
          "founder_overrides": {},
          "company_overrides": {
            "ai_native": 0.92,
            "software_high_margin": 0.98
          },
          "category_overrides": {
            "vertical_ai": 0.96,
            "cyber_security": 0.96
          },
          "stage_overrides": {},
          "notes": "Fund VII continues Europe-first, day-one, software-driven strategy.",
          "confidence": "medium"
        }
      },
      "sources": [
        "https://seedcamp.com/views/our-2024-year-in-review/",
        "https://seedcamp.com/our-companies/"
      ],
      "constraints": {}
    },
    "ewor": {
      "name": "EWOR",
      "region": "Europe / Global",
      "archetype": "Radically selective founder fellowship for outliers; person-first, globally ambitious, strong technical/research/repeat-founder signals, from no idea to meaningful traction.",
      "founder_targets": {
        "technical_depth": 0.9,
        "research_depth": 0.68,
        "elite_academic": 0.7,
        "elite_employer": 0.62,
        "repeat_founder": 0.52,
        "prior_exit": 0.3,
        "early_career": 0.7,
        "product_builder": 0.9,
        "enterprise_gtm": 0.56,
        "domain_expertise": 0.84,
        "speed": 0.96,
        "global_ambition": 1.0,
        "cofounder_complementarity": 0.7,
        "customer_obsession": 0.82
      },
      "company_targets": {
        "ai_native": 0.78,
        "technical_differentiation": 0.92,
        "defensible_ip": 0.64,
        "software_high_margin": 0.72,
        "capital_intensive": 0.45,
        "enterprise_b2b": 0.58,
        "consumer": 0.36,
        "developer_facing": 0.52,
        "regulated_market": 0.32,
        "traction": 0.46,
        "revenue": 0.34,
        "speed_ship": 0.92,
        "global_market": 0.98,
        "local_market_fit": 0.18,
        "team_small": 0.92,
        "proprietary_data": 0.42
      },
      "category_affinity": {
        "ai_agents": 0.86,
        "ai_infra": 0.82,
        "developer_tools": 0.78,
        "vertical_ai": 0.8,
        "voice_ai": 0.65,
        "physical_ai_robotics": 0.68,
        "cyber_security": 0.68,
        "fintech": 0.66,
        "health_bio": 0.72,
        "climate_energy": 0.76,
        "industrial_deeptech": 0.82,
        "semiconductors": 0.7,
        "defense_dualuse": 0.72,
        "consumer": 0.5,
        "gaming": 0.3,
        "marketplace": 0.3,
        "web3": 0.28,
        "scientific_ai": 0.84,
        "enterprise_saas": 0.74,
        "hardware": 0.68
      },
      "stage_affinity": {
        "pre_idea": 0.94,
        "idea": 1.0,
        "prototype": 0.92,
        "launched": 0.82,
        "pre_seed": 1.0,
        "seed": 0.72,
        "series_a": 0.12
      },
      "geo_affinity": {
        "us": 0.66,
        "europe": 1.0,
        "latam": 0.54,
        "mena": 0.52,
        "asia": 0.55,
        "global": 0.92,
        "sf": 0.58,
        "abu_dhabi": 0.2,
        "saudi": 0.2,
        "chile": 0.22
      },
      "years": {
        "2024": {
          "trend_tags": [
            "outlier founder thesis",
            "unicorn-builder mentorship",
            "founder-first",
            "AI ventures"
          ],
          "founder_overrides": {},
          "company_overrides": {},
          "category_overrides": {},
          "stage_overrides": {},
          "notes": "EWOR emphasized extreme selectivity and founder quality; 2024 fellows include experienced and frontier-AI profiles.",
          "confidence": "medium"
        },
        "2025": {
          "trend_tags": [
            "global virtual-first",
            "operator-led venture",
            "AI + deeptech",
            "traction track"
          ],
          "founder_overrides": {
            "global_ambition": 1.0
          },
          "company_overrides": {
            "traction": 0.52
          },
          "category_overrides": {},
          "stage_overrides": {},
          "notes": "",
          "confidence": "medium"
        },
        "2026": {
          "trend_tags": [
            "top 0.1% positioning",
            "up to $600k",
            "AI builders",
            "defense/deeptech expansion",
            "no-batch bespoke support"
          ],
          "founder_overrides": {
            "technical_depth": 0.94,
            "speed": 0.98
          },
          "company_overrides": {
            "technical_differentiation": 0.94
          },
          "category_overrides": {},
          "stage_overrides": {},
          "notes": "Current fellowship explicitly invests in people from no idea to $600k ARR and is virtual-first.",
          "confidence": "high"
        }
      },
      "sources": [
        "https://www.ewor.com/"
      ],
      "constraints": {}
    },
    "hub71": {
      "name": "Hub71",
      "region": "MENA / Global",
      "archetype": "Market-ready, internationally sourced pre-seed to Series A startups using Abu Dhabi as a commercial expansion base. Hub71 weights team quality, market opportunity, traction/fundraising readiness, global growth potential and credible Abu Dhabi/MENA market-entry plans more heavily than classic founder-first accelerators.",
      "founder_targets": {
        "technical_depth": 0.68,
        "research_depth": 0.4,
        "elite_academic": 0.42,
        "elite_employer": 0.56,
        "repeat_founder": 0.56,
        "prior_exit": 0.28,
        "early_career": 0.3,
        "product_builder": 0.82,
        "enterprise_gtm": 0.92,
        "domain_expertise": 0.92,
        "speed": 0.82,
        "global_ambition": 1.0,
        "cofounder_complementarity": 0.86,
        "customer_obsession": 0.94
      },
      "company_targets": {
        "ai_native": 0.82,
        "technical_differentiation": 0.82,
        "defensible_ip": 0.6,
        "software_high_margin": 0.68,
        "capital_intensive": 0.52,
        "enterprise_b2b": 0.78,
        "consumer": 0.3,
        "developer_facing": 0.38,
        "regulated_market": 0.78,
        "traction": 0.95,
        "revenue": 0.78,
        "speed_ship": 0.8,
        "global_market": 0.98,
        "local_market_fit": 1.0,
        "team_small": 0.54,
        "proprietary_data": 0.62
      },
      "category_affinity": {
        "ai_agents": 0.658,
        "ai_infra": 0.6,
        "developer_tools": 0.709,
        "vertical_ai": 0.929,
        "voice_ai": 0.601,
        "physical_ai_robotics": 0.638,
        "cyber_security": 0.624,
        "fintech": 0.838,
        "health_bio": 0.733,
        "climate_energy": 0.852,
        "industrial_deeptech": 0.75,
        "semiconductors": 0.398,
        "defense_dualuse": 0.51,
        "consumer": 0.533,
        "gaming": 0.44,
        "marketplace": 0.532,
        "web3": 0.777,
        "scientific_ai": 0.637,
        "enterprise_saas": 0.805,
        "hardware": 0.619
      },
      "stage_affinity": {
        "pre_idea": 0.0,
        "idea": 0.03,
        "prototype": 0.3,
        "launched": 0.9,
        "pre_seed": 0.72,
        "seed": 1.0,
        "series_a": 0.92
      },
      "geo_affinity": {
        "us": 0.88,
        "europe": 0.9,
        "latam": 0.66,
        "mena": 1.0,
        "asia": 0.84,
        "global": 1.0,
        "sf": 0.62,
        "abu_dhabi": 1.0,
        "saudi": 0.78,
        "chile": 0.24
      },
      "years": {
        "2024": {
          "trend_tags": [
            "FinTech + Web3",
            "ClimateTech specialist formation",
            "global market-entry",
            "funded seed-stage companies"
          ],
          "founder_overrides": {
            "enterprise_gtm": 0.88,
            "global_ambition": 0.98,
            "domain_expertise": 0.88
          },
          "company_overrides": {
            "ai_native": 0.66,
            "regulated_market": 0.7,
            "traction": 0.86,
            "revenue": 0.68,
            "local_market_fit": 1.0,
            "global_market": 0.98
          },
          "category_overrides": {
            "ai_agents": 0.437,
            "ai_infra": 0.546,
            "developer_tools": 0.751,
            "vertical_ai": 0.915,
            "voice_ai": 0.423,
            "physical_ai_robotics": 0.432,
            "cyber_security": 0.429,
            "fintech": 0.809,
            "health_bio": 0.702,
            "climate_energy": 0.913,
            "industrial_deeptech": 0.786,
            "semiconductors": 0.37,
            "defense_dualuse": 0.522,
            "consumer": 0.617,
            "gaming": 0.504,
            "marketplace": 0.528,
            "web3": 0.927,
            "scientific_ai": 0.644,
            "enterprise_saas": 0.75,
            "hardware": 0.673
          },
          "stage_overrides": {
            "launched": 0.92,
            "pre_seed": 0.7,
            "seed": 1.0,
            "series_a": 0.9
          },
          "notes": "[DATA-CALIBRATED] C14+C15: 46 accepted startups; specialist ClimateTech and Digital Assets tracks materially shape the mix. Official-cohort sample n=46; weighted average funding $5.65M; international share 80.5%.",
          "confidence": "high"
        },
        "2025": {
          "trend_tags": [
            "AI becomes core cross-sector layer",
            "regulated fintech",
            "industrial/physical AI",
            "climate + digital assets",
            "higher funding maturity"
          ],
          "founder_overrides": {
            "enterprise_gtm": 0.92,
            "global_ambition": 0.98,
            "domain_expertise": 0.94
          },
          "company_overrides": {
            "ai_native": 0.86,
            "regulated_market": 0.76,
            "traction": 0.92,
            "revenue": 0.74,
            "local_market_fit": 1.0,
            "global_market": 0.98
          },
          "category_overrides": {
            "ai_agents": 0.679,
            "ai_infra": 0.61,
            "developer_tools": 0.715,
            "vertical_ai": 0.967,
            "voice_ai": 0.531,
            "physical_ai_robotics": 0.648,
            "cyber_security": 0.644,
            "fintech": 0.809,
            "health_bio": 0.672,
            "climate_energy": 0.906,
            "industrial_deeptech": 0.786,
            "semiconductors": 0.37,
            "defense_dualuse": 0.399,
            "consumer": 0.593,
            "gaming": 0.534,
            "marketplace": 0.558,
            "web3": 0.858,
            "scientific_ai": 0.62,
            "enterprise_saas": 0.85,
            "hardware": 0.581
          },
          "stage_overrides": {
            "launched": 0.92,
            "pre_seed": 0.7,
            "seed": 1.0,
            "series_a": 0.9
          },
          "notes": "[DATA-CALIBRATED] C16+C17: 53 accepted startups. C17 is officially 81% AI-driven and primarily seed-stage. Official-cohort sample n=53; weighted average funding $6.71M; international share 68.4%.",
          "confidence": "high"
        },
        "2026": {
          "trend_tags": [
            "1.1% selectivity",
            "100% international",
            "$8.5M avg funding",
            "AI-native verticals",
            "Life Sciences added",
            "market readiness"
          ],
          "founder_overrides": {
            "enterprise_gtm": 0.96,
            "global_ambition": 1.0,
            "domain_expertise": 0.94
          },
          "company_overrides": {
            "ai_native": 0.94,
            "regulated_market": 0.86,
            "traction": 0.98,
            "revenue": 0.82,
            "local_market_fit": 1.0,
            "global_market": 0.98
          },
          "category_overrides": {
            "ai_agents": 0.576,
            "ai_infra": 0.618,
            "developer_tools": 0.842,
            "vertical_ai": 0.967,
            "voice_ai": 0.561,
            "physical_ai_robotics": 0.628,
            "cyber_security": 0.567,
            "fintech": 0.794,
            "health_bio": 0.823,
            "climate_energy": 0.797,
            "industrial_deeptech": 0.6,
            "semiconductors": 0.37,
            "defense_dualuse": 0.399,
            "consumer": 0.543,
            "gaming": 0.381,
            "marketplace": 0.543,
            "web3": 0.834,
            "scientific_ai": 0.672,
            "enterprise_saas": 0.715,
            "hardware": 0.623
          },
          "stage_overrides": {
            "launched": 0.92,
            "pre_seed": 0.7,
            "seed": 1.0,
            "series_a": 0.9
          },
          "notes": "[DATA-CALIBRATED] C18: 27/2,453 selected; $8.5M average funding, 100% headquartered outside UAE, Pre-Seed to Series A. Official-cohort sample n=27; weighted average funding $8.5M; international share 100.0%.",
          "confidence": "high"
        }
      },
      "sources": [
        "https://www.hub71.com/index.php/program/access-programme/apply",
        "https://www.hub71.com/index.php/latest-news/press-release/hub71-selects-27-startups-for-cohort-18-in-first-all-international-intake-after-record-2453-applications",
        "https://www.hub71.com/index.php/program/access-programme",
        "https://www.hub71.com/index.php/latest-news/press-release/hub71-welcomes-25-startups-from-11-countries-as-part-of-its-14th-cohort",
        "https://www.hub71.com/latest-news/press-release/hub71-welcomes-21-startups-in-15th-cohort-to-abu-dhabi-that-have-raised-over-usd-130-million-in-funding",
        "https://www.hub71.com/index.php/latest-news/press-release/hub71-strengthens-abu-dhabis-thriving-tech-ecosystem-with-its-latest-cohort",
        "https://www.hub71.com/latest-news/press-release/hub71-welcomes-record-ai-startups-in-latest-cohort,-reinforcing-abu-dhabis-role-in-global-ai-innovation",
        "https://www.hub71.com/latest-news/press-release/hub71-selects-27-startups-for-cohort-18-in-first-all-international-intake-after-record-2453-applications"
      ],
      "constraints": {
        "local_market_fit_required": true,
        "relocation_required": true
      },
      "entity_type": "accelerator_ecosystem",
      "component_weights": {
        "founder": 0.22,
        "company": 0.43,
        "category": 0.1,
        "stage": 0.1,
        "geography": 0.15
      },
      "cohorts": {
        "14": {
          "year": "2024",
          "period": "2024-04-15",
          "program_location": "Abu Dhabi",
          "coverage_status": "official complete cohort announcement",
          "coverage_note": "Exact startup roster reconstructed from official Hub71 cohort announcement.",
          "founder_overrides": {
            "enterprise_gtm": 0.9,
            "global_ambition": 1.0,
            "domain_expertise": 0.9,
            "customer_obsession": 0.92
          },
          "company_overrides": {
            "ai_native": 0.62,
            "traction": 0.86,
            "revenue": 0.66,
            "regulated_market": 0.72,
            "local_market_fit": 1.0,
            "global_market": 0.98,
            "technical_differentiation": 0.8
          },
          "category_affinity": {
            "ai_agents": 0.414,
            "ai_infra": 0.573,
            "developer_tools": 0.802,
            "vertical_ai": 0.878,
            "voice_ai": 0.403,
            "physical_ai_robotics": 0.41,
            "cyber_security": 0.408,
            "fintech": 0.785,
            "health_bio": 0.667,
            "climate_energy": 0.827,
            "industrial_deeptech": 0.724,
            "semiconductors": 0.367,
            "defense_dualuse": 0.387,
            "consumer": 0.631,
            "gaming": 0.544,
            "marketplace": 0.56,
            "web3": 0.943,
            "scientific_ai": 0.65,
            "enterprise_saas": 0.68,
            "hardware": 0.576
          },
          "stage_affinity": {
            "prototype": 0.25,
            "launched": 0.92,
            "pre_seed": 0.7,
            "seed": 1.0,
            "series_a": 0.92
          },
          "geo_affinity": {
            "abu_dhabi": 1.0,
            "mena": 1.0,
            "global": 1.0,
            "us": 0.88,
            "europe": 0.9,
            "asia": 0.84,
            "latam": 0.66
          },
          "observed_snapshot_stats": {
            "n": 25,
            "track_counts": {
              "access": 11,
              "digital_assets": 9,
              "climate": 5
            },
            "ai_share_description_classifier": 0.36,
            "category_share": {
              "ai_agents": 0.0,
              "ai_infra": 0.04,
              "developer_tools": 0.2,
              "vertical_ai": 0.24,
              "voice_ai": 0.0,
              "physical_ai_robotics": 0.0,
              "cyber_security": 0.0,
              "fintech": 0.16,
              "health_bio": 0.08,
              "climate_energy": 0.2,
              "industrial_deeptech": 0.12,
              "semiconductors": 0.0,
              "defense_dualuse": 0.0,
              "consumer": 0.08,
              "gaming": 0.04,
              "marketplace": 0.04,
              "web3": 0.36,
              "scientific_ai": 0.08,
              "enterprise_saas": 0.08,
              "hardware": 0.04
            },
            "applications": 1200,
            "selected": 25,
            "acceptance_rate": 0.0208,
            "international_share": 0.81,
            "seed_series_a_share": 0.64,
            "total_funding_usd_m": 122.0,
            "avg_funding_usd_m": 5.0,
            "program_mix": {
              "access": 11,
              "digital_assets": 9,
              "climate": 5
            }
          },
          "vector_semantics": "Exact Hub71 cohort DNA. Company/category composition comes from the official cohort roster; traction/stage/funding maturity comes from official cohort-level statistics. Founder-quality values remain selection priors because public cohort announcements do not expose comparable founder biographies for every company.",
          "sources": [
            "https://www.hub71.com/index.php/latest-news/press-release/hub71-welcomes-25-startups-from-11-countries-as-part-of-its-14th-cohort"
          ]
        },
        "15": {
          "year": "2024",
          "period": "2024-09-11",
          "program_location": "Abu Dhabi",
          "coverage_status": "official complete cohort announcement",
          "coverage_note": "Exact startup roster reconstructed from official Hub71 cohort announcement.",
          "founder_overrides": {
            "enterprise_gtm": 0.9,
            "global_ambition": 1.0,
            "domain_expertise": 0.9,
            "customer_obsession": 0.92
          },
          "company_overrides": {
            "ai_native": 0.66,
            "traction": 0.89,
            "revenue": 0.7,
            "regulated_market": 0.74,
            "local_market_fit": 1.0,
            "global_market": 0.98,
            "technical_differentiation": 0.8
          },
          "category_affinity": {
            "ai_agents": 0.414,
            "ai_infra": 0.403,
            "developer_tools": 0.616,
            "vertical_ai": 0.892,
            "voice_ai": 0.403,
            "physical_ai_robotics": 0.41,
            "cyber_security": 0.408,
            "fintech": 0.779,
            "health_bio": 0.699,
            "climate_energy": 0.957,
            "industrial_deeptech": 0.814,
            "semiconductors": 0.367,
            "defense_dualuse": 0.58,
            "consumer": 0.584,
            "gaming": 0.374,
            "marketplace": 0.391,
            "web3": 0.865,
            "scientific_ai": 0.603,
            "enterprise_saas": 0.773,
            "hardware": 0.74
          },
          "stage_affinity": {
            "prototype": 0.25,
            "launched": 0.92,
            "pre_seed": 0.7,
            "seed": 1.0,
            "series_a": 0.92
          },
          "geo_affinity": {
            "abu_dhabi": 1.0,
            "mena": 1.0,
            "global": 1.0,
            "us": 0.88,
            "europe": 0.9,
            "asia": 0.84,
            "latam": 0.66
          },
          "observed_snapshot_stats": {
            "n": 21,
            "track_counts": {
              "access": 9,
              "climate": 7,
              "digital_assets": 5
            },
            "ai_share_description_classifier": 0.286,
            "category_share": {
              "ai_agents": 0.0,
              "ai_infra": 0.0,
              "developer_tools": 0.048,
              "vertical_ai": 0.238,
              "voice_ai": 0.0,
              "physical_ai_robotics": 0.0,
              "cyber_security": 0.0,
              "fintech": 0.143,
              "health_bio": 0.095,
              "climate_energy": 0.333,
              "industrial_deeptech": 0.19,
              "semiconductors": 0.0,
              "defense_dualuse": 0.048,
              "consumer": 0.048,
              "gaming": 0.0,
              "marketplace": 0.0,
              "web3": 0.238,
              "scientific_ai": 0.048,
              "enterprise_saas": 0.143,
              "hardware": 0.143
            },
            "applications": 1228,
            "selected": 21,
            "acceptance_rate": 0.0171,
            "international_share": 0.8,
            "seed_series_a_share": 0.55,
            "total_funding_usd_m": 134.9,
            "avg_funding_usd_m": 6.42,
            "program_mix": {
              "access": 9,
              "climate": 7,
              "digital_assets": 5
            }
          },
          "vector_semantics": "Exact Hub71 cohort DNA. Company/category composition comes from the official cohort roster; traction/stage/funding maturity comes from official cohort-level statistics. Founder-quality values remain selection priors because public cohort announcements do not expose comparable founder biographies for every company.",
          "sources": [
            "https://www.hub71.com/latest-news/press-release/hub71-welcomes-21-startups-in-15th-cohort-to-abu-dhabi-that-have-raised-over-usd-130-million-in-funding"
          ]
        },
        "16": {
          "year": "2025",
          "period": "2025-02-10",
          "program_location": "Abu Dhabi",
          "coverage_status": "official complete cohort announcement",
          "coverage_note": "Exact startup roster reconstructed from official Hub71 cohort announcement.",
          "founder_overrides": {
            "enterprise_gtm": 0.9,
            "global_ambition": 1.0,
            "domain_expertise": 0.95,
            "customer_obsession": 0.92
          },
          "company_overrides": {
            "ai_native": 0.78,
            "traction": 0.9,
            "revenue": 0.72,
            "regulated_market": 0.76,
            "local_market_fit": 1.0,
            "global_market": 0.98,
            "technical_differentiation": 0.88
          },
          "category_affinity": {
            "ai_agents": 0.798,
            "ai_infra": 0.595,
            "developer_tools": 0.695,
            "vertical_ai": 0.971,
            "voice_ai": 0.596,
            "physical_ai_robotics": 0.602,
            "cyber_security": 0.6,
            "fintech": 0.83,
            "health_bio": 0.699,
            "climate_energy": 0.957,
            "industrial_deeptech": 0.763,
            "semiconductors": 0.367,
            "defense_dualuse": 0.387,
            "consumer": 0.583,
            "gaming": 0.646,
            "marketplace": 0.663,
            "web3": 0.865,
            "scientific_ai": 0.682,
            "enterprise_saas": 0.911,
            "hardware": 0.407
          },
          "stage_affinity": {
            "prototype": 0.25,
            "launched": 0.92,
            "pre_seed": 0.7,
            "seed": 1.0,
            "series_a": 0.92
          },
          "geo_affinity": {
            "abu_dhabi": 1.0,
            "mena": 1.0,
            "global": 1.0,
            "us": 0.88,
            "europe": 0.9,
            "asia": 0.84,
            "latam": 0.66
          },
          "observed_snapshot_stats": {
            "n": 27,
            "track_counts": {
              "access": 17,
              "climate": 5,
              "digital_assets": 5
            },
            "ai_share_description_classifier": 0.444,
            "category_share": {
              "ai_agents": 0.148,
              "ai_infra": 0.037,
              "developer_tools": 0.074,
              "vertical_ai": 0.259,
              "voice_ai": 0.037,
              "physical_ai_robotics": 0.037,
              "cyber_security": 0.037,
              "fintech": 0.148,
              "health_bio": 0.074,
              "climate_energy": 0.259,
              "industrial_deeptech": 0.111,
              "semiconductors": 0.0,
              "defense_dualuse": 0.0,
              "consumer": 0.037,
              "gaming": 0.074,
              "marketplace": 0.074,
              "web3": 0.185,
              "scientific_ai": 0.074,
              "enterprise_saas": 0.222,
              "hardware": 0.0
            },
            "applications": 1300,
            "selected": 27,
            "acceptance_rate": 0.0208,
            "international_share": 0.63,
            "seed_series_a_share": 0.55,
            "total_funding_usd_m": 145.0,
            "avg_funding_usd_m": 4.9,
            "program_mix": {
              "access": 17,
              "climate": 5,
              "digital_assets": 5
            }
          },
          "vector_semantics": "Exact Hub71 cohort DNA. Company/category composition comes from the official cohort roster; traction/stage/funding maturity comes from official cohort-level statistics. Founder-quality values remain selection priors because public cohort announcements do not expose comparable founder biographies for every company.",
          "sources": [
            "https://www.hub71.com/index.php/latest-news/press-release/hub71-strengthens-abu-dhabis-thriving-tech-ecosystem-with-its-latest-cohort"
          ]
        },
        "17": {
          "year": "2025",
          "period": "2025-09-02",
          "program_location": "Abu Dhabi",
          "coverage_status": "official complete cohort announcement",
          "coverage_note": "Exact startup roster reconstructed from official Hub71 cohort announcement.",
          "founder_overrides": {
            "enterprise_gtm": 0.95,
            "global_ambition": 1.0,
            "domain_expertise": 0.95,
            "customer_obsession": 0.92
          },
          "company_overrides": {
            "ai_native": 0.94,
            "traction": 0.96,
            "revenue": 0.78,
            "regulated_market": 0.82,
            "local_market_fit": 1.0,
            "global_market": 0.98,
            "technical_differentiation": 0.88
          },
          "category_affinity": {
            "ai_agents": 0.566,
            "ai_infra": 0.62,
            "developer_tools": 0.73,
            "vertical_ai": 0.971,
            "voice_ai": 0.403,
            "physical_ai_robotics": 0.675,
            "cyber_security": 0.673,
            "fintech": 0.789,
            "health_bio": 0.644,
            "climate_energy": 0.882,
            "industrial_deeptech": 0.806,
            "semiconductors": 0.367,
            "defense_dualuse": 0.387,
            "consumer": 0.608,
            "gaming": 0.374,
            "marketplace": 0.391,
            "web3": 0.869,
            "scientific_ai": 0.562,
            "enterprise_saas": 0.816,
            "hardware": 0.624
          },
          "stage_affinity": {
            "prototype": 0.25,
            "launched": 0.92,
            "pre_seed": 0.7,
            "seed": 1.0,
            "series_a": 0.92
          },
          "geo_affinity": {
            "abu_dhabi": 1.0,
            "mena": 1.0,
            "global": 1.0,
            "us": 0.88,
            "europe": 0.9,
            "asia": 0.84,
            "latam": 0.66
          },
          "observed_snapshot_stats": {
            "n": 26,
            "track_counts": {
              "access": 13,
              "climate": 6,
              "digital_assets": 7
            },
            "ai_share_description_classifier": 0.5,
            "category_share": {
              "ai_agents": 0.038,
              "ai_infra": 0.077,
              "developer_tools": 0.154,
              "vertical_ai": 0.423,
              "voice_ai": 0.0,
              "physical_ai_robotics": 0.115,
              "cyber_security": 0.115,
              "fintech": 0.192,
              "health_bio": 0.077,
              "climate_energy": 0.308,
              "industrial_deeptech": 0.231,
              "semiconductors": 0.0,
              "defense_dualuse": 0.0,
              "consumer": 0.077,
              "gaming": 0.0,
              "marketplace": 0.0,
              "web3": 0.308,
              "scientific_ai": 0.038,
              "enterprise_saas": 0.231,
              "hardware": 0.077
            },
            "applications": 2000,
            "selected": 26,
            "acceptance_rate": 0.013,
            "international_share": 0.74,
            "seed_series_a_share": 0.7,
            "total_funding_usd_m": 223.0,
            "avg_funding_usd_m": 8.58,
            "program_mix": {
              "access": 13,
              "climate": 6,
              "digital_assets": 7
            },
            "official_ai_share": 0.81
          },
          "vector_semantics": "Exact Hub71 cohort DNA. Company/category composition comes from the official cohort roster; traction/stage/funding maturity comes from official cohort-level statistics. Founder-quality values remain selection priors because public cohort announcements do not expose comparable founder biographies for every company.",
          "sources": [
            "https://www.hub71.com/latest-news/press-release/hub71-welcomes-record-ai-startups-in-latest-cohort,-reinforcing-abu-dhabis-role-in-global-ai-innovation"
          ]
        },
        "18": {
          "year": "2026",
          "period": "2026-06-04",
          "program_location": "Abu Dhabi",
          "coverage_status": "official complete cohort announcement",
          "coverage_note": "Exact startup roster reconstructed from official Hub71 cohort announcement.",
          "founder_overrides": {
            "enterprise_gtm": 0.95,
            "global_ambition": 1.0,
            "domain_expertise": 0.95,
            "customer_obsession": 0.92
          },
          "company_overrides": {
            "ai_native": 0.95,
            "traction": 0.99,
            "revenue": 0.84,
            "regulated_market": 0.88,
            "local_market_fit": 1.0,
            "global_market": 0.98,
            "technical_differentiation": 0.88
          },
          "category_affinity": {
            "ai_agents": 0.567,
            "ai_infra": 0.62,
            "developer_tools": 0.856,
            "vertical_ai": 0.971,
            "voice_ai": 0.557,
            "physical_ai_robotics": 0.627,
            "cyber_security": 0.561,
            "fintech": 0.789,
            "health_bio": 0.833,
            "climate_energy": 0.791,
            "industrial_deeptech": 0.583,
            "semiconductors": 0.367,
            "defense_dualuse": 0.387,
            "consumer": 0.544,
            "gaming": 0.374,
            "marketplace": 0.544,
            "web3": 0.841,
            "scientific_ai": 0.675,
            "enterprise_saas": 0.706,
            "hardware": 0.623
          },
          "stage_affinity": {
            "prototype": 0.25,
            "launched": 0.92,
            "pre_seed": 0.7,
            "seed": 1.0,
            "series_a": 0.92
          },
          "geo_affinity": {
            "abu_dhabi": 1.0,
            "mena": 1.0,
            "global": 1.0,
            "us": 0.88,
            "europe": 0.9,
            "asia": 0.84,
            "latam": 0.66
          },
          "observed_snapshot_stats": {
            "n": 27,
            "track_counts": {
              "access": 9,
              "digital_assets": 6,
              "climate": 5,
              "life_sciences": 7
            },
            "ai_share_description_classifier": 0.593,
            "category_share": {
              "ai_agents": 0.037,
              "ai_infra": 0.074,
              "developer_tools": 0.296,
              "vertical_ai": 0.407,
              "voice_ai": 0.037,
              "physical_ai_robotics": 0.074,
              "cyber_security": 0.037,
              "fintech": 0.185,
              "health_bio": 0.259,
              "climate_energy": 0.185,
              "industrial_deeptech": 0.037,
              "semiconductors": 0.0,
              "defense_dualuse": 0.0,
              "consumer": 0.037,
              "gaming": 0.0,
              "marketplace": 0.037,
              "web3": 0.259,
              "scientific_ai": 0.111,
              "enterprise_saas": 0.111,
              "hardware": 0.074
            },
            "applications": 2453,
            "selected": 27,
            "acceptance_rate": 0.011,
            "international_share": 1.0,
            "seed_series_a_share": 0.72,
            "total_funding_usd_m": 230.0,
            "avg_funding_usd_m": 8.5,
            "program_mix": {
              "access": 9,
              "digital_assets": 6,
              "climate": 5,
              "life_sciences": 7
            }
          },
          "vector_semantics": "Exact Hub71 cohort DNA. Company/category composition comes from the official cohort roster; traction/stage/funding maturity comes from official cohort-level statistics. Founder-quality values remain selection priors because public cohort announcements do not expose comparable founder biographies for every company.",
          "sources": [
            "https://www.hub71.com/latest-news/press-release/hub71-selects-27-startups-for-cohort-18-in-first-all-international-intake-after-record-2453-applications"
          ]
        }
      },
      "observed_cohort_stats": {
        "14": {
          "n": 25,
          "track_counts": {
            "access": 11,
            "digital_assets": 9,
            "climate": 5
          },
          "ai_share_description_classifier": 0.36,
          "category_share": {
            "ai_agents": 0.0,
            "ai_infra": 0.04,
            "developer_tools": 0.2,
            "vertical_ai": 0.24,
            "voice_ai": 0.0,
            "physical_ai_robotics": 0.0,
            "cyber_security": 0.0,
            "fintech": 0.16,
            "health_bio": 0.08,
            "climate_energy": 0.2,
            "industrial_deeptech": 0.12,
            "semiconductors": 0.0,
            "defense_dualuse": 0.0,
            "consumer": 0.08,
            "gaming": 0.04,
            "marketplace": 0.04,
            "web3": 0.36,
            "scientific_ai": 0.08,
            "enterprise_saas": 0.08,
            "hardware": 0.04
          },
          "applications": 1200,
          "selected": 25,
          "acceptance_rate": 0.0208,
          "international_share": 0.81,
          "seed_series_a_share": 0.64,
          "total_funding_usd_m": 122.0,
          "avg_funding_usd_m": 5.0,
          "program_mix": {
            "access": 11,
            "digital_assets": 9,
            "climate": 5
          }
        },
        "15": {
          "n": 21,
          "track_counts": {
            "access": 9,
            "climate": 7,
            "digital_assets": 5
          },
          "ai_share_description_classifier": 0.286,
          "category_share": {
            "ai_agents": 0.0,
            "ai_infra": 0.0,
            "developer_tools": 0.048,
            "vertical_ai": 0.238,
            "voice_ai": 0.0,
            "physical_ai_robotics": 0.0,
            "cyber_security": 0.0,
            "fintech": 0.143,
            "health_bio": 0.095,
            "climate_energy": 0.333,
            "industrial_deeptech": 0.19,
            "semiconductors": 0.0,
            "defense_dualuse": 0.048,
            "consumer": 0.048,
            "gaming": 0.0,
            "marketplace": 0.0,
            "web3": 0.238,
            "scientific_ai": 0.048,
            "enterprise_saas": 0.143,
            "hardware": 0.143
          },
          "applications": 1228,
          "selected": 21,
          "acceptance_rate": 0.0171,
          "international_share": 0.8,
          "seed_series_a_share": 0.55,
          "total_funding_usd_m": 134.9,
          "avg_funding_usd_m": 6.42,
          "program_mix": {
            "access": 9,
            "climate": 7,
            "digital_assets": 5
          }
        },
        "16": {
          "n": 27,
          "track_counts": {
            "access": 17,
            "climate": 5,
            "digital_assets": 5
          },
          "ai_share_description_classifier": 0.444,
          "category_share": {
            "ai_agents": 0.148,
            "ai_infra": 0.037,
            "developer_tools": 0.074,
            "vertical_ai": 0.259,
            "voice_ai": 0.037,
            "physical_ai_robotics": 0.037,
            "cyber_security": 0.037,
            "fintech": 0.148,
            "health_bio": 0.074,
            "climate_energy": 0.259,
            "industrial_deeptech": 0.111,
            "semiconductors": 0.0,
            "defense_dualuse": 0.0,
            "consumer": 0.037,
            "gaming": 0.074,
            "marketplace": 0.074,
            "web3": 0.185,
            "scientific_ai": 0.074,
            "enterprise_saas": 0.222,
            "hardware": 0.0
          },
          "applications": 1300,
          "selected": 27,
          "acceptance_rate": 0.0208,
          "international_share": 0.63,
          "seed_series_a_share": 0.55,
          "total_funding_usd_m": 145.0,
          "avg_funding_usd_m": 4.9,
          "program_mix": {
            "access": 17,
            "climate": 5,
            "digital_assets": 5
          }
        },
        "17": {
          "n": 26,
          "track_counts": {
            "access": 13,
            "climate": 6,
            "digital_assets": 7
          },
          "ai_share_description_classifier": 0.5,
          "category_share": {
            "ai_agents": 0.038,
            "ai_infra": 0.077,
            "developer_tools": 0.154,
            "vertical_ai": 0.423,
            "voice_ai": 0.0,
            "physical_ai_robotics": 0.115,
            "cyber_security": 0.115,
            "fintech": 0.192,
            "health_bio": 0.077,
            "climate_energy": 0.308,
            "industrial_deeptech": 0.231,
            "semiconductors": 0.0,
            "defense_dualuse": 0.0,
            "consumer": 0.077,
            "gaming": 0.0,
            "marketplace": 0.0,
            "web3": 0.308,
            "scientific_ai": 0.038,
            "enterprise_saas": 0.231,
            "hardware": 0.077
          },
          "applications": 2000,
          "selected": 26,
          "acceptance_rate": 0.013,
          "international_share": 0.74,
          "seed_series_a_share": 0.7,
          "total_funding_usd_m": 223.0,
          "avg_funding_usd_m": 8.58,
          "program_mix": {
            "access": 13,
            "climate": 6,
            "digital_assets": 7
          },
          "official_ai_share": 0.81
        },
        "18": {
          "n": 27,
          "track_counts": {
            "access": 9,
            "digital_assets": 6,
            "climate": 5,
            "life_sciences": 7
          },
          "ai_share_description_classifier": 0.593,
          "category_share": {
            "ai_agents": 0.037,
            "ai_infra": 0.074,
            "developer_tools": 0.296,
            "vertical_ai": 0.407,
            "voice_ai": 0.037,
            "physical_ai_robotics": 0.074,
            "cyber_security": 0.037,
            "fintech": 0.185,
            "health_bio": 0.259,
            "climate_energy": 0.185,
            "industrial_deeptech": 0.037,
            "semiconductors": 0.0,
            "defense_dualuse": 0.0,
            "consumer": 0.037,
            "gaming": 0.0,
            "marketplace": 0.037,
            "web3": 0.259,
            "scientific_ai": 0.111,
            "enterprise_saas": 0.111,
            "hardware": 0.074
          },
          "applications": 2453,
          "selected": 27,
          "acceptance_rate": 0.011,
          "international_share": 1.0,
          "seed_series_a_share": 0.72,
          "total_funding_usd_m": 230.0,
          "avg_funding_usd_m": 8.5,
          "program_mix": {
            "access": 9,
            "digital_assets": 6,
            "climate": 5,
            "life_sciences": 7
          }
        }
      }
    },
    "sanabil_500": {
      "name": "Sanabil Accelerator by 500 Global",
      "region": "MENA",
      "archetype": "Riyadh-based accelerator for MENA-focused tech startups with MVP, early traction and clear regional scaling ambition.",
      "founder_targets": {
        "technical_depth": 0.58,
        "research_depth": 0.25,
        "elite_academic": 0.3,
        "elite_employer": 0.45,
        "repeat_founder": 0.44,
        "prior_exit": 0.18,
        "early_career": 0.4,
        "product_builder": 0.82,
        "enterprise_gtm": 0.84,
        "domain_expertise": 0.84,
        "speed": 0.82,
        "global_ambition": 0.82,
        "cofounder_complementarity": 0.82,
        "customer_obsession": 0.92
      },
      "company_targets": {
        "ai_native": 0.66,
        "technical_differentiation": 0.6,
        "defensible_ip": 0.34,
        "software_high_margin": 0.72,
        "capital_intensive": 0.3,
        "enterprise_b2b": 0.72,
        "consumer": 0.38,
        "developer_facing": 0.3,
        "regulated_market": 0.52,
        "traction": 0.88,
        "revenue": 0.7,
        "speed_ship": 0.82,
        "global_market": 0.72,
        "local_market_fit": 1.0,
        "team_small": 0.7,
        "proprietary_data": 0.4
      },
      "category_affinity": {
        "ai_agents": 0.78,
        "ai_infra": 0.52,
        "developer_tools": 0.48,
        "vertical_ai": 0.84,
        "voice_ai": 0.72,
        "physical_ai_robotics": 0.52,
        "cyber_security": 0.62,
        "fintech": 0.88,
        "health_bio": 0.64,
        "climate_energy": 0.62,
        "industrial_deeptech": 0.58,
        "semiconductors": 0.35,
        "defense_dualuse": 0.45,
        "consumer": 0.48,
        "gaming": 0.32,
        "marketplace": 0.58,
        "web3": 0.38,
        "scientific_ai": 0.46,
        "enterprise_saas": 0.84,
        "hardware": 0.45
      },
      "stage_affinity": {
        "pre_idea": 0.0,
        "idea": 0.05,
        "prototype": 0.62,
        "launched": 1.0,
        "pre_seed": 0.82,
        "seed": 0.94,
        "series_a": 0.35
      },
      "geo_affinity": {
        "us": 0.35,
        "europe": 0.42,
        "latam": 0.22,
        "mena": 1.0,
        "asia": 0.45,
        "global": 0.64,
        "sf": 0.25,
        "abu_dhabi": 0.62,
        "saudi": 1.0,
        "chile": 0.14
      },
      "years": {
        "2024": {
          "trend_tags": [
            "MENA scale",
            "MVP required",
            "early traction",
            "regional growth"
          ],
          "founder_overrides": {},
          "company_overrides": {},
          "category_overrides": {},
          "stage_overrides": {},
          "notes": "",
          "confidence": "medium"
        },
        "2025": {
          "trend_tags": [
            "selection rigor",
            "MENA enterprise demand",
            "growth readiness"
          ],
          "founder_overrides": {},
          "company_overrides": {
            "traction": 0.9
          },
          "category_overrides": {},
          "stage_overrides": {},
          "notes": "",
          "confidence": "medium"
        },
        "2026": {
          "trend_tags": [
            "Batch 12",
            "12-week Riyadh",
            "MVP + early traction",
            "regional expansion"
          ],
          "founder_overrides": {},
          "company_overrides": {
            "local_market_fit": 1.0,
            "traction": 0.92
          },
          "category_overrides": {},
          "stage_overrides": {},
          "notes": "Current published criteria explicitly require MVP and early traction.",
          "confidence": "high"
        }
      },
      "sources": [
        "https://mena.500.co/founders/mena/seed-accelerator"
      ],
      "constraints": {}
    },
    "flat6labs": {
      "name": "Flat6Labs",
      "region": "MENA / Africa",
      "archetype": "Regional early-stage platform whose DNA depends heavily on local program; favors tech-enabled teams with local-market relevance, commercialization potential and ecosystem fit.",
      "founder_targets": {
        "technical_depth": 0.52,
        "research_depth": 0.24,
        "elite_academic": 0.25,
        "elite_employer": 0.36,
        "repeat_founder": 0.36,
        "prior_exit": 0.12,
        "early_career": 0.5,
        "product_builder": 0.76,
        "enterprise_gtm": 0.76,
        "domain_expertise": 0.86,
        "speed": 0.74,
        "global_ambition": 0.7,
        "cofounder_complementarity": 0.78,
        "customer_obsession": 0.88
      },
      "company_targets": {
        "ai_native": 0.58,
        "technical_differentiation": 0.54,
        "defensible_ip": 0.32,
        "software_high_margin": 0.65,
        "capital_intensive": 0.38,
        "enterprise_b2b": 0.65,
        "consumer": 0.46,
        "developer_facing": 0.25,
        "regulated_market": 0.5,
        "traction": 0.62,
        "revenue": 0.48,
        "speed_ship": 0.76,
        "global_market": 0.62,
        "local_market_fit": 1.0,
        "team_small": 0.72,
        "proprietary_data": 0.36
      },
      "category_affinity": {
        "ai_agents": 0.66,
        "ai_infra": 0.42,
        "developer_tools": 0.38,
        "vertical_ai": 0.76,
        "voice_ai": 0.6,
        "physical_ai_robotics": 0.48,
        "cyber_security": 0.54,
        "fintech": 0.82,
        "health_bio": 0.72,
        "climate_energy": 0.78,
        "industrial_deeptech": 0.68,
        "semiconductors": 0.3,
        "defense_dualuse": 0.35,
        "consumer": 0.62,
        "gaming": 0.3,
        "marketplace": 0.68,
        "web3": 0.34,
        "scientific_ai": 0.45,
        "enterprise_saas": 0.72,
        "hardware": 0.52
      },
      "stage_affinity": {
        "pre_idea": 0.22,
        "idea": 0.58,
        "prototype": 0.86,
        "launched": 0.88,
        "pre_seed": 0.95,
        "seed": 0.78,
        "series_a": 0.2
      },
      "geo_affinity": {
        "us": 0.2,
        "europe": 0.28,
        "latam": 0.18,
        "mena": 1.0,
        "asia": 0.22,
        "global": 0.5,
        "sf": 0.12,
        "abu_dhabi": 0.62,
        "saudi": 0.72,
        "chile": 0.1
      },
      "years": {
        "2024": {
          "trend_tags": [
            "regional programs",
            "fintech/health/commerce",
            "early-stage execution"
          ],
          "founder_overrides": {},
          "company_overrides": {},
          "category_overrides": {},
          "stage_overrides": {},
          "notes": "",
          "confidence": "low"
        },
        "2025": {
          "trend_tags": [
            "sector-specific programs",
            "climate/green economy",
            "local ecosystem partnerships"
          ],
          "founder_overrides": {},
          "company_overrides": {},
          "category_overrides": {
            "climate_energy": 0.82
          },
          "stage_overrides": {},
          "notes": "",
          "confidence": "low"
        },
        "2026": {
          "trend_tags": [
            "program-specific specialization",
            "Palestine early-stage tech",
            "Egypt proptech/circular economy"
          ],
          "founder_overrides": {},
          "company_overrides": {
            "local_market_fit": 1.0
          },
          "category_overrides": {},
          "stage_overrides": {},
          "notes": "2026 program portfolio is highly local/program-specific, so family-level DNA has lower precision.",
          "confidence": "medium"
        }
      },
      "sources": [
        "https://flat6labs.com/programs/"
      ],
      "constraints": {}
    },
    "platanus": {
      "name": "Platanus Ventures",
      "region": "LatAm",
      "archetype": "Pre-seed investor/program for strong technical founders in Latin America; emphasizes product velocity, weekly growth, ambitious software and a dense Spanish-speaking builder network.",
      "founder_targets": {
        "technical_depth": 0.88,
        "research_depth": 0.38,
        "elite_academic": 0.42,
        "elite_employer": 0.48,
        "repeat_founder": 0.4,
        "prior_exit": 0.16,
        "early_career": 0.68,
        "product_builder": 0.96,
        "enterprise_gtm": 0.62,
        "domain_expertise": 0.78,
        "speed": 0.98,
        "global_ambition": 0.88,
        "cofounder_complementarity": 0.86,
        "customer_obsession": 0.94
      },
      "company_targets": {
        "ai_native": 0.78,
        "technical_differentiation": 0.78,
        "defensible_ip": 0.42,
        "software_high_margin": 0.88,
        "capital_intensive": 0.18,
        "enterprise_b2b": 0.76,
        "consumer": 0.36,
        "developer_facing": 0.62,
        "regulated_market": 0.42,
        "traction": 0.62,
        "revenue": 0.42,
        "speed_ship": 0.98,
        "global_market": 0.82,
        "local_market_fit": 0.82,
        "team_small": 0.9,
        "proprietary_data": 0.38
      },
      "category_affinity": {
        "ai_agents": 0.9,
        "ai_infra": 0.72,
        "developer_tools": 0.82,
        "vertical_ai": 0.88,
        "voice_ai": 0.7,
        "physical_ai_robotics": 0.38,
        "cyber_security": 0.62,
        "fintech": 0.9,
        "health_bio": 0.55,
        "climate_energy": 0.48,
        "industrial_deeptech": 0.42,
        "semiconductors": 0.3,
        "defense_dualuse": 0.3,
        "consumer": 0.52,
        "gaming": 0.38,
        "marketplace": 0.62,
        "web3": 0.4,
        "scientific_ai": 0.45,
        "enterprise_saas": 0.92,
        "hardware": 0.28
      },
      "stage_affinity": {
        "pre_idea": 0.1,
        "idea": 0.55,
        "prototype": 0.95,
        "launched": 0.96,
        "pre_seed": 1.0,
        "seed": 0.72,
        "series_a": 0.1
      },
      "geo_affinity": {
        "us": 0.4,
        "europe": 0.28,
        "latam": 1.0,
        "mena": 0.18,
        "asia": 0.18,
        "global": 0.78,
        "sf": 0.42,
        "abu_dhabi": 0.1,
        "saudi": 0.1,
        "chile": 0.92
      },
      "years": {
        "2024": {
          "trend_tags": [
            "technical founders",
            "B2B software",
            "fintech infrastructure",
            "AI/devtools",
            "LatAm builder density"
          ],
          "founder_overrides": {},
          "company_overrides": {},
          "category_overrides": {
            "developer_tools": 0.86,
            "fintech": 0.92
          },
          "stage_overrides": {},
          "notes": "",
          "confidence": "medium"
        },
        "2025": {
          "trend_tags": [
            "AI agents",
            "AI-native teams",
            "global software from LatAm",
            "weekly growth"
          ],
          "founder_overrides": {},
          "company_overrides": {
            "ai_native": 0.84
          },
          "category_overrides": {
            "ai_agents": 0.94
          },
          "stage_overrides": {},
          "notes": "",
          "confidence": "medium"
        },
        "2026": {
          "trend_tags": [
            "two cohorts",
            "$200k/7% model",
            "technical founders",
            "pre-seed LatAm",
            "product velocity"
          ],
          "founder_overrides": {
            "technical_depth": 0.92,
            "speed": 1.0
          },
          "company_overrides": {},
          "category_overrides": {},
          "stage_overrides": {},
          "notes": "2026 public route confirms recurring cohorts and direct pre-seed investment.",
          "confidence": "medium"
        }
      },
      "sources": [
        "https://platan.us/programa",
        "https://platan.us/"
      ],
      "constraints": {}
    },
    "latitud": {
      "name": "Latitud Fellowship",
      "region": "LatAm / SF bridge",
      "archetype": "Pre-founder fellowship for LatAm-born ambitious operators/builders; invests before first line of code and increasingly pushes global-from-day-one company formation.",
      "founder_targets": {
        "technical_depth": 0.72,
        "research_depth": 0.38,
        "elite_academic": 0.48,
        "elite_employer": 0.62,
        "repeat_founder": 0.42,
        "prior_exit": 0.2,
        "early_career": 0.68,
        "product_builder": 0.88,
        "enterprise_gtm": 0.64,
        "domain_expertise": 0.76,
        "speed": 0.96,
        "global_ambition": 1.0,
        "cofounder_complementarity": 0.52,
        "customer_obsession": 0.76
      },
      "company_targets": {
        "ai_native": 0.72,
        "technical_differentiation": 0.7,
        "defensible_ip": 0.38,
        "software_high_margin": 0.78,
        "capital_intensive": 0.22,
        "enterprise_b2b": 0.62,
        "consumer": 0.42,
        "developer_facing": 0.48,
        "regulated_market": 0.3,
        "traction": 0.18,
        "revenue": 0.08,
        "speed_ship": 0.9,
        "global_market": 0.98,
        "local_market_fit": 0.7,
        "team_small": 0.98,
        "proprietary_data": 0.32
      },
      "category_affinity": {
        "ai_agents": 0.88,
        "ai_infra": 0.68,
        "developer_tools": 0.68,
        "vertical_ai": 0.84,
        "voice_ai": 0.68,
        "physical_ai_robotics": 0.42,
        "cyber_security": 0.55,
        "fintech": 0.88,
        "health_bio": 0.52,
        "climate_energy": 0.42,
        "industrial_deeptech": 0.38,
        "semiconductors": 0.28,
        "defense_dualuse": 0.28,
        "consumer": 0.58,
        "gaming": 0.35,
        "marketplace": 0.58,
        "web3": 0.36,
        "scientific_ai": 0.42,
        "enterprise_saas": 0.84,
        "hardware": 0.28
      },
      "stage_affinity": {
        "pre_idea": 1.0,
        "idea": 1.0,
        "prototype": 0.74,
        "launched": 0.42,
        "pre_seed": 0.88,
        "seed": 0.25,
        "series_a": 0.02
      },
      "geo_affinity": {
        "us": 0.45,
        "europe": 0.2,
        "latam": 1.0,
        "mena": 0.12,
        "asia": 0.12,
        "global": 0.88,
        "sf": 0.78,
        "abu_dhabi": 0.08,
        "saudi": 0.08,
        "chile": 0.62
      },
      "years": {
        "2024": {
          "trend_tags": [
            "blank-document pre-founders",
            "LatAm operator/builders",
            "fast idea-to-product"
          ],
          "founder_overrides": {},
          "company_overrides": {},
          "category_overrides": {},
          "stage_overrides": {},
          "notes": "",
          "confidence": "medium"
        },
        "2025": {
          "trend_tags": [
            "global ambition rising",
            "SF week",
            "LatAm-to-global bridge",
            "AI-era builders"
          ],
          "founder_overrides": {
            "global_ambition": 1.0
          },
          "company_overrides": {},
          "category_overrides": {},
          "stage_overrides": {},
          "notes": "H2 2025 explicitly framed fellowship as LatAm-born, global-facing, with SF bridge.",
          "confidence": "high"
        },
        "2026": {
          "trend_tags": [
            "$62.5k for 2.5%",
            "seasoned operator or builder/hacker",
            "global-from-day-one",
            "AI-native formation"
          ],
          "founder_overrides": {
            "elite_employer": 0.68,
            "product_builder": 0.92
          },
          "company_overrides": {
            "ai_native": 0.78
          },
          "category_overrides": {},
          "stage_overrides": {},
          "notes": "Current fellowship invests before first line of code and welcomes extremely young builders if output is exceptional.",
          "confidence": "high"
        }
      },
      "sources": [
        "https://www.fellowship.latitud.com/",
        "https://www.latitud.com/blog/latitud-fellowships-san-francisco-diary-h2-2025"
      ],
      "constraints": {}
    },
    "startup_chile": {
      "name": "Start-Up Chile BIG",
      "region": "LatAm / Global",
      "archetype": "Equity-free public accelerator spanning Build, Ignite and Growth; favors scalable tech/science ventures willing to use Chile as a launch, pilot or expansion base.",
      "founder_targets": {
        "technical_depth": 0.55,
        "research_depth": 0.34,
        "elite_academic": 0.28,
        "elite_employer": 0.34,
        "repeat_founder": 0.34,
        "prior_exit": 0.12,
        "early_career": 0.46,
        "product_builder": 0.76,
        "enterprise_gtm": 0.68,
        "domain_expertise": 0.78,
        "speed": 0.72,
        "global_ambition": 0.8,
        "cofounder_complementarity": 0.74,
        "customer_obsession": 0.8
      },
      "company_targets": {
        "ai_native": 0.58,
        "technical_differentiation": 0.64,
        "defensible_ip": 0.46,
        "software_high_margin": 0.6,
        "capital_intensive": 0.46,
        "enterprise_b2b": 0.58,
        "consumer": 0.44,
        "developer_facing": 0.26,
        "regulated_market": 0.46,
        "traction": 0.58,
        "revenue": 0.44,
        "speed_ship": 0.72,
        "global_market": 0.76,
        "local_market_fit": 0.86,
        "team_small": 0.64,
        "proprietary_data": 0.38
      },
      "category_affinity": {
        "ai_agents": 0.68,
        "ai_infra": 0.44,
        "developer_tools": 0.42,
        "vertical_ai": 0.76,
        "voice_ai": 0.56,
        "physical_ai_robotics": 0.58,
        "cyber_security": 0.52,
        "fintech": 0.66,
        "health_bio": 0.74,
        "climate_energy": 0.82,
        "industrial_deeptech": 0.76,
        "semiconductors": 0.38,
        "defense_dualuse": 0.32,
        "consumer": 0.58,
        "gaming": 0.3,
        "marketplace": 0.58,
        "web3": 0.34,
        "scientific_ai": 0.62,
        "enterprise_saas": 0.68,
        "hardware": 0.58
      },
      "stage_affinity": {
        "pre_idea": 0.08,
        "idea": 0.42,
        "prototype": 0.82,
        "launched": 0.88,
        "pre_seed": 0.82,
        "seed": 0.84,
        "series_a": 0.55
      },
      "geo_affinity": {
        "us": 0.38,
        "europe": 0.42,
        "latam": 0.98,
        "mena": 0.22,
        "asia": 0.22,
        "global": 0.82,
        "sf": 0.2,
        "abu_dhabi": 0.1,
        "saudi": 0.1,
        "chile": 1.0
      },
      "years": {
        "2024": {
          "trend_tags": [
            "BIG 8",
            "50 companies",
            "Build/Ignite/Growth",
            "global applicants",
            "broad tech sectors"
          ],
          "founder_overrides": {},
          "company_overrides": {},
          "category_overrides": {},
          "stage_overrides": {},
          "notes": "BIG 8 selected 50 startups across three maturity tracks.",
          "confidence": "high"
        },
        "2025": {
          "trend_tags": [
            "BIG 9/10",
            "AI adoption",
            "energy/climate",
            "legaltech/ops AI",
            "multi-country"
          ],
          "founder_overrides": {},
          "company_overrides": {
            "ai_native": 0.64
          },
          "category_overrides": {
            "climate_energy": 0.86,
            "vertical_ai": 0.8
          },
          "stage_overrides": {},
          "notes": "BIG 9 selected 64 from 900+ applications; BIG 10 kept broad multi-industry tech mix.",
          "confidence": "high"
        },
        "2026": {
          "trend_tags": [
            "BIG 11/12",
            "70 then 59 ventures",
            "AI across business workflows",
            "biotech/robotics/energy",
            "Chile landing"
          ],
          "founder_overrides": {},
          "company_overrides": {
            "local_market_fit": 0.9
          },
          "category_overrides": {
            "physical_ai_robotics": 0.64,
            "health_bio": 0.78
          },
          "stage_overrides": {},
          "notes": "BIG 12 selected 59 from 1,296 applications across 10 countries.",
          "confidence": "high"
        }
      },
      "sources": [
        "https://startupchile.org/blog/generacion-big-8/",
        "https://startupchile.org/en/blog/big-9-is-here-meet-the-startups/",
        "https://startupchile.org/en/blog/big-12-get-to-know-the-new-batch/"
      ],
      "constraints": {}
    }
  }
}""")
COHORT_SIGNALS = json.loads(r"""{
  "version": "1.5.0",
  "as_of": "2026-09-05",
  "program_intent": {
    "yc": {
      "as_of": "2026-09-05",
      "confidence": "medium",
      "trend_tags": [
        "AI agents become default",
        "AI-native workflows",
        "physical AI emergence",
        "scientific AI",
        "tiny teams"
      ],
      "founder_targets": {
        "technical_depth": 0.88,
        "speed": 1.0,
        "product_builder": 0.92
      },
      "company_targets": {
        "ai_native": 0.94,
        "team_small": 0.96,
        "technical_differentiation": 0.8,
        "speed_ship": 1.0
      },
      "category_affinity": {
        "ai_agents": 1.0,
        "vertical_ai": 1.0,
        "physical_ai_robotics": 0.9,
        "scientific_ai": 0.88,
        "enterprise_saas": 0.96,
        "defense_dualuse": 0.82,
        "industrial_deeptech": 0.78
      },
      "stage_affinity": {},
      "geo_affinity": {},
      "notes": "Directory mix shows strong agent, workflow, scientific-AI and physical-AI representation.",
      "sources": [
        "https://www.ycombinator.com/rfs",
        "https://www.ycombinator.com/companies"
      ]
    },
    "techstars": {
      "as_of": "2026-09-05",
      "confidence": "medium",
      "trend_tags": [
        "AI/ML",
        "digital health",
        "HR tech",
        "deep tech",
        "revenue operations",
        "circular economy"
      ],
      "founder_targets": {},
      "company_targets": {
        "ai_native": 0.72,
        "traction": 0.74
      },
      "category_affinity": {
        "vertical_ai": 0.88,
        "industrial_deeptech": 0.78
      },
      "stage_affinity": {},
      "geo_affinity": {},
      "notes": "Spring/Tokyo 2026 cohorts show broad AI plus sector-specialist programs.",
      "sources": [
        "https://www.techstars.com/newsroom/meet-the-startups-joining-techstars-spring-2026-accelerator-programs",
        "https://www.techstars.com/accelerators"
      ]
    },
    "500_global": {
      "as_of": "2026-09-05",
      "confidence": "medium",
      "trend_tags": [
        "AI ops",
        "synthetic data",
        "agentic security",
        "prompt-driven infrastructure",
        "global reach"
      ],
      "founder_targets": {},
      "company_targets": {
        "ai_native": 0.84,
        "technical_differentiation": 0.64
      },
      "category_affinity": {
        "ai_agents": 0.91,
        "ai_infra": 0.86,
        "cyber_security": 0.8
      },
      "stage_affinity": {},
      "geo_affinity": {},
      "notes": "Batch 36/37 era: AI ops, agentic security and infrastructure are recurring patterns.",
      "sources": [
        "https://flagship.aplica.500.co/",
        "https://500.co/founders/flagship",
        "https://500.co/strategy/flagship"
      ]
    },
    "speedrun": {
      "as_of": "2026-09-05",
      "confidence": "high",
      "trend_tags": [
        "zero-to-one agency",
        "rapid execution",
        "earned secrets",
        "founder backgrounds prioritized over idea",
        "complementary cofounders",
        "technical in-house building",
        "market validation",
        "AI agents",
        "agentic commerce",
        "AI fintech",
        "robotics",
        "personalized consumer AI",
        "outlier evidence beyond pedigree"
      ],
      "founder_targets": {
        "technical_depth": 0.94,
        "research_depth": 0.56,
        "elite_academic": 0.48,
        "elite_employer": 0.58,
        "repeat_founder": 0.54,
        "prior_exit": 0.3,
        "early_career": 0.68,
        "product_builder": 1.0,
        "enterprise_gtm": 0.76,
        "domain_expertise": 0.97,
        "speed": 1.0,
        "global_ambition": 0.98,
        "cofounder_complementarity": 0.98,
        "customer_obsession": 0.99
      },
      "company_targets": {
        "ai_native": 0.96,
        "technical_differentiation": 0.96,
        "defensible_ip": 0.56,
        "traction": 0.8,
        "revenue": 0.52,
        "speed_ship": 1.0,
        "global_market": 0.97,
        "team_small": 0.95,
        "proprietary_data": 0.56
      },
      "category_affinity": {
        "ai_agents": 1.0,
        "ai_infra": 0.93,
        "developer_tools": 0.88,
        "vertical_ai": 0.99,
        "voice_ai": 0.82,
        "physical_ai_robotics": 0.86,
        "cyber_security": 0.8,
        "fintech": 0.88,
        "health_bio": 0.84,
        "climate_energy": 0.58,
        "industrial_deeptech": 0.84,
        "semiconductors": 0.72,
        "defense_dualuse": 0.78,
        "consumer": 0.88,
        "gaming": 0.58,
        "marketplace": 0.78,
        "web3": 0.46,
        "scientific_ai": 0.76,
        "enterprise_saas": 0.93,
        "hardware": 0.72
      },
      "stage_affinity": {
        "pre_idea": 0.14,
        "idea": 0.44,
        "prototype": 0.92,
        "launched": 0.98,
        "pre_seed": 1.0,
        "seed": 0.82,
        "series_a": 0.12
      },
      "geo_affinity": {
        "us": 0.96,
        "sf": 1.0,
        "la": 0.56,
        "nyc": 0.72,
        "global": 0.98,
        "europe": 0.74,
        "latam": 0.6,
        "mena": 0.58,
        "asia": 0.66
      },
      "notes": "Current Speedrun selection is explicitly founder-first. Official FAQ says teams are evaluated on zero-to-one capacity, rapid execution, earned secrets, complementary technology/business/GTM skills and early market validation. The program says founder backgrounds are prioritized over ideas. SR006 reviewed 19,000+ pitches and selected <0.4%; recent cohorts are generally 60–70 teams. Current public portfolio composition is heavily AI-agent/vertical-AI oriented, while 2026 Speedrun thesis work also emphasizes personalized consumer products.",
      "sources": [
        "https://speedrun.a16z.com/faq",
        "https://speedrun.substack.com/p/what-we-look-for-in-applications",
        "https://a16z.com/a16z-speedrun-application-winter-spring-2026/",
        "https://a16z.com/applications-for-a16z-speedrun-sr007-are-now-open/",
        "https://a16z.com/newsletter/big-ideas-2026-part-1/",
        "https://speedrun.a16z.com/companies"
      ]
    },
    "sequoia_arc": {
      "as_of": "2026-09-05",
      "confidence": "high",
      "trend_tags": [
        "outlier early-stage founders",
        "pre-seed and seed",
        "~10 company intensive",
        "customer understanding",
        "competitive positioning",
        "team building",
        "growth strategy",
        "PMF rigor"
      ],
      "founder_targets": {
        "technical_depth": 0.9,
        "product_builder": 0.92,
        "domain_expertise": 0.95,
        "global_ambition": 1.0,
        "customer_obsession": 0.98,
        "cofounder_complementarity": 0.9
      },
      "company_targets": {
        "technical_differentiation": 0.97,
        "traction": 0.76,
        "speed_ship": 0.92,
        "global_market": 0.99,
        "team_small": 0.88
      },
      "category_affinity": {
        "ai_agents": 0.96,
        "ai_infra": 0.9,
        "developer_tools": 0.92,
        "vertical_ai": 0.92,
        "physical_ai_robotics": 0.82,
        "cyber_security": 0.84,
        "scientific_ai": 0.88,
        "enterprise_saas": 0.9
      },
      "stage_affinity": {
        "idea": 0.5,
        "prototype": 0.86,
        "launched": 0.94,
        "pre_seed": 1.0,
        "seed": 0.98
      },
      "geo_affinity": {
        "us": 0.96,
        "europe": 0.88,
        "global": 0.94
      },
      "notes": "Arc is Sequoia's bi-annual open call, not the entirety of Sequoia seed investing. Current Intensive cohorts are ~10 companies and focus on PMF, customer understanding, positioning, team design and growth.",
      "sources": [
        "https://sequoiacap.com/arc",
        "https://sequoiacap.com/article/pmf-framework",
        "https://sequoiacap.com/article/pmf-framework-2"
      ]
    },
    "hf0": {
      "as_of": "2026-09-06",
      "confidence": "high",
      "component_weights": {
        "founder": 0.28,
        "company": 0.5,
        "category": 0.05,
        "stage": 0.12,
        "geography": 0.05
      },
      "trend_tags": [
        "repeat founders",
        "first-time breakout founders",
        "insane growth",
        "already building / shipping / in market",
        "seed and Series A now valid",
        "extreme revenue velocity",
        "10-team residency",
        "San Francisco intensity",
        "AI-age company building"
      ],
      "founder_targets": {
        "technical_depth": 0.9,
        "repeat_founder": 0.6,
        "prior_exit": 0.42,
        "product_builder": 0.98,
        "enterprise_gtm": 0.88,
        "domain_expertise": 0.9,
        "speed": 1.0,
        "global_ambition": 0.98,
        "cofounder_complementarity": 0.9,
        "customer_obsession": 0.98
      },
      "company_targets": {
        "traction": 1.0,
        "revenue": 1.0,
        "speed_ship": 1.0,
        "technical_differentiation": 0.9,
        "enterprise_b2b": 0.84,
        "global_market": 0.98,
        "team_small": 0.78,
        "ai_native": 0.82
      },
      "category_affinity": {
        "ai_agents": 0.9,
        "ai_infra": 0.891,
        "developer_tools": 0.871,
        "vertical_ai": 0.862,
        "voice_ai": 0.711,
        "physical_ai_robotics": 0.58,
        "cyber_security": 0.678,
        "fintech": 0.629,
        "health_bio": 0.456,
        "climate_energy": 0.322,
        "industrial_deeptech": 0.541,
        "semiconductors": 0.477,
        "defense_dualuse": 0.534,
        "consumer": 0.612,
        "gaming": 0.445,
        "marketplace": 0.409,
        "web3": 0.384,
        "scientific_ai": 0.48,
        "enterprise_saas": 0.909,
        "hardware": 0.444
      },
      "stage_affinity": {
        "pre_idea": 0.02,
        "idea": 0.08,
        "prototype": 0.4,
        "launched": 1.0,
        "pre_seed": 0.86,
        "seed": 1.0,
        "series_a": 0.95
      },
      "geo_affinity": {
        "sf": 1.0,
        "us": 1.0,
        "global": 0.9,
        "europe": 0.62,
        "asia": 0.54,
        "latam": 0.48,
        "mena": 0.44
      },
      "notes": "HF0 is currently best modeled as two admissible pathways: repeat founder OR first-time breakout team with exceptional velocity. Latest 2026 messaging says HF0 is not only for early-stage companies and explicitly asks for strong seed / Series A teams. Latest batch reported 5/10 teams above $10M annualized at demo day.",
      "sources": [
        "https://www.hf0.com/",
        "https://www.hf0.com/facts",
        "https://www.linkedin.com/posts/hf0_hf0-the-best-place-for-repeat-and-breakout-activity-7199849194268835841-B2iy",
        "https://www.linkedin.com/posts/hf0_5-of-10-teams-at-demo-day-broke-10m-annualized-activity-7463636839501815808-gzwg"
      ]
    },
    "spc": {
      "as_of": "2026-09-05",
      "confidence": "high",
      "trend_tags": [
        "AI makes building cheap",
        "depth over prompt-to-product",
        "frontier tech",
        "professors/dropouts/repeat exits"
      ],
      "founder_targets": {
        "technical_depth": 0.91,
        "global_ambition": 1.0,
        "research_depth": 0.83,
        "domain_expertise": 0.91
      },
      "company_targets": {
        "technical_differentiation": 0.95,
        "defensible_ip": 0.8
      },
      "category_affinity": {
        "ai_infra": 0.94,
        "scientific_ai": 0.91,
        "physical_ai_robotics": 0.9,
        "semiconductors": 0.82,
        "industrial_deeptech": 0.84
      },
      "stage_affinity": {},
      "geo_affinity": {},
      "notes": "2026 messaging explicitly prioritizes depth/direction as prototyping gets cheaper.",
      "sources": [
        "https://www.southparkcommons.com/founder-fellowship",
        "https://blog.southparkcommons.com/p/applications-open-spc-founder-fellowship"
      ]
    },
    "neo": {
      "as_of": "2026-09-05",
      "confidence": "high",
      "trend_tags": [
        "up to 20 startups/student teams",
        "$750k uncapped for startups",
        "SF residency",
        "OpenAI/Microsoft access"
      ],
      "founder_targets": {
        "early_career": 0.96
      },
      "company_targets": {
        "ai_native": 0.88
      },
      "category_affinity": {},
      "stage_affinity": {},
      "geo_affinity": {},
      "notes": "2026 Residency explicitly mixes student teams and pre-seed/seed startups.",
      "sources": [
        "https://portal.neo.com/residency",
        "https://neo.com/"
      ]
    },
    "pearx": {
      "as_of": "2026-09-05",
      "confidence": "high",
      "trend_tags": [
        "building is cheap, learning is edge",
        "demand discovery",
        "customer insight",
        "pre-seed AI"
      ],
      "founder_targets": {
        "customer_obsession": 0.98,
        "speed": 0.94,
        "domain_expertise": 0.92
      },
      "company_targets": {
        "speed_ship": 0.93,
        "ai_native": 0.92,
        "traction": 0.7
      },
      "category_affinity": {
        "vertical_ai": 0.98,
        "enterprise_saas": 0.95,
        "ai_agents": 0.94
      },
      "stage_affinity": {},
      "geo_affinity": {},
      "notes": "S26 Request for Startups explicitly reframes advantage as speed of learning rather than speed of coding.",
      "sources": [
        "https://pear.vc/pearx-s26-applications/",
        "https://pear.vc/request-for-startups/",
        "https://pear.vc/request-for-startups-august-2026/"
      ]
    },
    "alchemist": {
      "as_of": "2026-09-05",
      "confidence": "medium",
      "trend_tags": [
        "AI-native enterprise",
        "deeptech commercialization",
        "technical + business cofounder"
      ],
      "founder_targets": {
        "cofounder_complementarity": 0.95
      },
      "company_targets": {},
      "category_affinity": {},
      "stage_affinity": {},
      "geo_affinity": {},
      "notes": "",
      "sources": [
        "https://www.alchemistaccelerator.com/",
        "https://www.alchemistaccelerator.com/programs"
      ]
    },
    "ef": {
      "as_of": "2026-09-05",
      "confidence": "high",
      "founder_first": true,
      "component_weights": {
        "founder": 0.72,
        "company": 0.1,
        "category": 0.03,
        "stage": 0.1,
        "geography": 0.05
      },
      "trend_tags": [
        "back the individual before the company",
        "outlier performance vs peers",
        "ambition",
        "extreme bias to action",
        "technical majority",
        "cofounder formation",
        "SF bridge",
        "direct $250K path",
        "$10K exploration fellowship",
        "experienced-founder track",
        "AI and frontier-tech density"
      ],
      "founder_targets": {
        "technical_depth": 0.92,
        "research_depth": 0.62,
        "elite_academic": 0.52,
        "elite_employer": 0.5,
        "product_builder": 0.98,
        "enterprise_gtm": 0.46,
        "domain_expertise": 0.9,
        "speed": 1.0,
        "global_ambition": 1.0,
        "cofounder_complementarity": 0.98,
        "customer_obsession": 0.84
      },
      "company_targets": {
        "technical_differentiation": 0.92,
        "speed_ship": 0.92,
        "global_market": 1.0,
        "team_small": 0.98
      },
      "category_affinity": {
        "ai_agents": 0.9,
        "ai_infra": 0.92,
        "developer_tools": 0.9,
        "vertical_ai": 0.9,
        "voice_ai": 0.78,
        "physical_ai_robotics": 0.91,
        "cyber_security": 0.86,
        "fintech": 0.82,
        "health_bio": 0.9,
        "climate_energy": 0.84,
        "industrial_deeptech": 0.94,
        "semiconductors": 0.92,
        "defense_dualuse": 0.88,
        "consumer": 0.74,
        "gaming": 0.62,
        "marketplace": 0.64,
        "web3": 0.58,
        "scientific_ai": 0.94,
        "enterprise_saas": 0.88,
        "hardware": 0.9
      },
      "stage_affinity": {
        "pre_idea": 1.0,
        "idea": 1.0,
        "prototype": 0.9,
        "launched": 0.68,
        "pre_seed": 0.96,
        "seed": 0.38,
        "series_a": 0.05
      },
      "geo_affinity": {
        "sf": 1.0,
        "london": 0.98,
        "paris": 0.86,
        "bangalore": 0.88,
        "nyc": 0.72,
        "us": 0.94,
        "europe": 0.98,
        "asia": 0.78,
        "global": 1.0
      },
      "notes": "EF's current selection is explicitly person-first: applicants can have no company, cofounder or idea. EF looks for outlier achievement, ambition, founder aptitude, bias to action and intellectual excellence; most selected individuals are technical. 2026 adds a bifurcated pathway: early-career Fellowship/direct funding plus a separate experienced-founder track, so career age/repeat-founder status is not modeled as one unimodal target.",
      "sources": [
        "https://www.joinef.com/faqs/",
        "https://apply.joinef.com/",
        "https://www.joinef.com/",
        "https://www.joinef.com/the-fellowship-residency/",
        "https://www.joinef.com/who-you-ll-meet/",
        "https://www.joinef.com/posts/introducing-the-bridge/",
        "https://www.joinef.com/posts/2026-q1-portfolio-news/",
        "https://www.joinef.com/posts/2026-q2-portfolio-news/"
      ]
    },
    "antler": {
      "as_of": "2026-09-05",
      "confidence": "high",
      "trend_tags": [
        "repeat/exited founders",
        "AI voice",
        "deeptech",
        "energy",
        "real ARR/LOIs by showcase"
      ],
      "founder_targets": {
        "repeat_founder": 0.64,
        "prior_exit": 0.36,
        "speed": 0.95,
        "domain_expertise": 0.89,
        "cofounder_complementarity": 0.9
      },
      "company_targets": {
        "traction": 0.67,
        "revenue": 0.66,
        "speed_ship": 0.92
      },
      "category_affinity": {
        "ai_agents": 0.9,
        "voice_ai": 0.87,
        "physical_ai_robotics": 0.82,
        "climate_energy": 0.78,
        "industrial_deeptech": 0.8
      },
      "stage_affinity": {},
      "geo_affinity": {},
      "notes": "Spring 2026 US showcase includes multiple repeat/exited founders and meaningful ARR/pilot evidence.",
      "sources": [
        "https://www.antler.co/apply",
        "https://www.antler.co/location/us",
        "https://www.antler.co/continental-europe",
        "https://www.antler.co/blog/announcing-the-spring-2026-u-s-portfolio-showcase"
      ]
    },
    "seedcamp": {
      "as_of": "2026-09-05",
      "confidence": "medium",
      "trend_tags": [
        "revenue infrastructure for AI",
        "AI legal/admin",
        "AI workforce OS",
        "security",
        "high-margin software"
      ],
      "founder_targets": {
        "global_ambition": 0.98,
        "domain_expertise": 0.91,
        "speed": 0.91
      },
      "company_targets": {
        "ai_native": 0.92,
        "software_high_margin": 0.94,
        "technical_differentiation": 0.88
      },
      "category_affinity": {
        "vertical_ai": 0.94,
        "cyber_security": 0.92,
        "ai_infra": 0.94,
        "physical_ai_robotics": 0.78,
        "scientific_ai": 0.82
      },
      "stage_affinity": {},
      "geo_affinity": {},
      "notes": "Fund VII continues Europe-first, day-one, software-driven strategy.",
      "sources": [
        "https://seedcamp.com/views/fund-vii-is-now-live/",
        "https://seedcamp.com/faqs/"
      ]
    },
    "ewor": {
      "as_of": "2026-09-05",
      "confidence": "high",
      "trend_tags": [
        "top 0.1% positioning",
        "up to $600k",
        "AI builders",
        "defense/deeptech expansion",
        "no-batch bespoke support"
      ],
      "founder_targets": {
        "technical_depth": 0.9,
        "speed": 0.98,
        "research_depth": 0.8,
        "repeat_founder": 0.72,
        "global_ambition": 0.98,
        "early_career": 0.75
      },
      "company_targets": {
        "technical_differentiation": 0.92
      },
      "category_affinity": {},
      "stage_affinity": {},
      "geo_affinity": {},
      "notes": "Current fellowship explicitly invests in people from no idea to $600k ARR and is virtual-first.",
      "sources": [
        "https://www.ewor.com/fellowship",
        "https://www.ewor.com/en-us/year/2026"
      ]
    },
    "hub71": {
      "as_of": "2026-09-05",
      "confidence": "high",
      "component_weights": {
        "founder": 0.2,
        "company": 0.45,
        "category": 0.1,
        "stage": 0.1,
        "geography": 0.15
      },
      "trend_tags": [
        "pre-seed to Series A",
        "team + market opportunity + growth plan",
        "traction and funds raised explicitly reviewed",
        "long-term Abu Dhabi founder commitment",
        "market-ready international startups",
        "AI-native verticals",
        "regulated digital finance",
        "ClimateTech and industrial systems",
        "Life Sciences",
        "corporate/government market access"
      ],
      "founder_targets": {
        "enterprise_gtm": 0.96,
        "domain_expertise": 0.95,
        "global_ambition": 1.0,
        "cofounder_complementarity": 0.86,
        "customer_obsession": 0.96,
        "product_builder": 0.82,
        "speed": 0.84
      },
      "company_targets": {
        "traction": 0.98,
        "revenue": 0.82,
        "global_market": 1.0,
        "local_market_fit": 1.0,
        "regulated_market": 0.86,
        "technical_differentiation": 0.88,
        "ai_native": 0.92
      },
      "category_affinity": {
        "ai_agents": 0.9,
        "ai_infra": 0.88,
        "developer_tools": 0.7,
        "vertical_ai": 0.98,
        "voice_ai": 0.9,
        "physical_ai_robotics": 0.94,
        "cyber_security": 0.92,
        "fintech": 0.98,
        "health_bio": 0.98,
        "climate_energy": 0.98,
        "industrial_deeptech": 0.96,
        "semiconductors": 0.8,
        "defense_dualuse": 0.84,
        "consumer": 0.56,
        "gaming": 0.42,
        "marketplace": 0.64,
        "web3": 0.92,
        "scientific_ai": 0.94,
        "enterprise_saas": 0.91,
        "hardware": 0.88
      },
      "stage_affinity": {
        "pre_idea": 0.0,
        "idea": 0.03,
        "prototype": 0.28,
        "launched": 0.92,
        "pre_seed": 0.72,
        "seed": 1.0,
        "series_a": 0.94
      },
      "geo_affinity": {
        "abu_dhabi": 1.0,
        "mena": 1.0,
        "global": 1.0,
        "us": 0.9,
        "europe": 0.92,
        "asia": 0.86,
        "latam": 0.68
      },
      "notes": "Hub71 Access is explicitly a market-entry and growth programme, not a classic idea-stage accelerator. Current evaluation requires team, market opportunity, growth plans, traction, funds raised, and a credible Abu Dhabi plan. At least one founder is expected to relocate long-term. Cohort 18 selected 27/2,453 (1.1%), averaged $8.5M raised, and was 100% international.",
      "sources": [
        "https://www.hub71.com/index.php/program/access-programme",
        "https://www.hub71.com/latest-news/press-release/hub71-selects-27-startups-for-cohort-18-in-first-all-international-intake-after-record-2453-applications",
        "https://www.hub71.com/latest-news/press-release/hub71-welcomes-record-ai-startups-in-latest-cohort,-reinforcing-abu-dhabis-role-in-global-ai-innovation"
      ]
    },
    "sanabil_500": {
      "as_of": "2026-09-05",
      "confidence": "high",
      "trend_tags": [
        "Batch 12",
        "12-week Riyadh",
        "MVP + early traction",
        "regional expansion"
      ],
      "founder_targets": {
        "enterprise_gtm": 0.88,
        "domain_expertise": 0.88
      },
      "company_targets": {
        "local_market_fit": 0.95,
        "traction": 0.88,
        "revenue": 0.72
      },
      "category_affinity": {
        "fintech": 0.9,
        "enterprise_saas": 0.88,
        "ai_agents": 0.82
      },
      "stage_affinity": {},
      "geo_affinity": {},
      "notes": "Current published criteria explicitly require MVP and early traction.",
      "sources": [
        "https://mena.500.co/founders/mena/seed-accelerator",
        "https://mena.500.co/mena"
      ]
    },
    "flat6labs": {
      "as_of": "2026-09-05",
      "confidence": "medium",
      "trend_tags": [
        "program-specific specialization",
        "Palestine early-stage tech",
        "Egypt proptech/circular economy"
      ],
      "founder_targets": {},
      "company_targets": {
        "local_market_fit": 1.0
      },
      "category_affinity": {},
      "stage_affinity": {},
      "geo_affinity": {},
      "notes": "2026 program portfolio is highly local/program-specific, so family-level DNA has lower precision.",
      "sources": [
        "https://flat6labs.com/programs/",
        "https://flat6labs.com/apply-now/"
      ]
    },
    "platanus": {
      "as_of": "2026-09-05",
      "confidence": "medium",
      "trend_tags": [
        "two cohorts",
        "$200k/7% model",
        "technical founders",
        "pre-seed LatAm",
        "product velocity"
      ],
      "founder_targets": {
        "technical_depth": 0.92,
        "speed": 1.0
      },
      "company_targets": {},
      "category_affinity": {},
      "stage_affinity": {},
      "geo_affinity": {},
      "notes": "2026 public route confirms recurring cohorts and direct pre-seed investment.",
      "sources": [
        "https://platan.us/programa",
        "https://platan.us/"
      ]
    },
    "latitud": {
      "as_of": "2026-09-05",
      "confidence": "high",
      "trend_tags": [
        "$62.5k for 2.5%",
        "seasoned operator or builder/hacker",
        "global-from-day-one",
        "AI-native formation"
      ],
      "founder_targets": {
        "elite_employer": 0.68,
        "product_builder": 0.9,
        "early_career": 0.8,
        "global_ambition": 0.98
      },
      "company_targets": {
        "ai_native": 0.78,
        "team_small": 0.94,
        "speed_ship": 0.94
      },
      "category_affinity": {
        "ai_agents": 0.92,
        "developer_tools": 0.87,
        "vertical_ai": 0.9
      },
      "stage_affinity": {},
      "geo_affinity": {},
      "notes": "Current fellowship invests before first line of code and welcomes extremely young builders if output is exceptional.",
      "sources": [
        "https://www.fellowship.latitud.com/"
      ]
    },
    "startup_chile": {
      "as_of": "2026-09-05",
      "confidence": "high",
      "trend_tags": [
        "BIG 11/12",
        "70 then 59 ventures",
        "AI across business workflows",
        "biotech/robotics/energy",
        "Chile landing"
      ],
      "founder_targets": {},
      "company_targets": {
        "local_market_fit": 0.92,
        "traction": 0.72
      },
      "category_affinity": {
        "physical_ai_robotics": 0.8,
        "health_bio": 0.82,
        "climate_energy": 0.88,
        "industrial_deeptech": 0.86,
        "ai_agents": 0.78
      },
      "stage_affinity": {},
      "geo_affinity": {},
      "notes": "BIG 12 selected 59 from 1,296 applications across 10 countries.",
      "sources": [
        "https://startupchile.org/en/blog/big-12-get-to-know-the-new-batch/"
      ]
    },
    "sequoia_capital": {
      "as_of": "2026-09-05",
      "confidence": "high",
      "trend_tags": [
        "long-horizon agents",
        "agents that do work, not just chat",
        "AI security",
        "AI infrastructure and inference",
        "semiconductor/system co-design",
        "frontier AI research",
        "physical AI",
        "vertical AI",
        "customer-back moats",
        "outlier founder magnetism"
      ],
      "founder_targets": {
        "technical_depth": 0.96,
        "research_depth": 0.78,
        "elite_employer": 0.84,
        "product_builder": 0.97,
        "domain_expertise": 0.97,
        "speed": 0.99,
        "global_ambition": 1.0,
        "customer_obsession": 0.96,
        "cofounder_complementarity": 0.88
      },
      "company_targets": {
        "ai_native": 0.95,
        "technical_differentiation": 0.99,
        "defensible_ip": 0.8,
        "traction": 0.82,
        "speed_ship": 0.97,
        "global_market": 1.0,
        "proprietary_data": 0.76
      },
      "category_affinity": {
        "ai_agents": 1.0,
        "ai_infra": 0.98,
        "developer_tools": 0.92,
        "vertical_ai": 0.96,
        "voice_ai": 0.78,
        "physical_ai_robotics": 0.94,
        "cyber_security": 0.97,
        "fintech": 0.84,
        "health_bio": 0.88,
        "climate_energy": 0.68,
        "industrial_deeptech": 0.9,
        "semiconductors": 0.96,
        "defense_dualuse": 0.9,
        "consumer": 0.68,
        "gaming": 0.52,
        "marketplace": 0.5,
        "web3": 0.52,
        "scientific_ai": 0.99,
        "enterprise_saas": 0.94,
        "hardware": 0.91
      },
      "stage_affinity": {
        "prototype": 0.82,
        "launched": 0.96,
        "pre_seed": 0.98,
        "seed": 0.96,
        "series_a": 0.86
      },
      "geo_affinity": {
        "us": 0.98,
        "sf": 1.0,
        "europe": 0.88,
        "global": 1.0
      },
      "notes": "2026 intent is dominated by long-horizon agents and real-world impact, while recent partnerships also show strong security, inference, frontier research, semiconductors and physical-world AI. Sequoia continues to emphasize outlier founders, customer-back moats and category-defining ambition.",
      "sources": [
        "https://sequoiacap.com/article/2026-this-is-agi",
        "https://sequoiacap.com/article/ai-ascent-2026",
        "https://sequoiacap.com/article/seed-venture-funds-2025",
        "https://sequoiacap.com/our-companies/",
        "https://sequoiacap.com/people/bogomil-balkansky",
        "https://sequoiacap.com/people/dean-meyer"
      ]
    }
  },
  "market_regime": {
    "as_of": "2026-09-05",
    "semantics": "Directional momentum priors used as a light contextual layer; not market-size statistics.",
    "global": {
      "category_momentum": {
        "ai_agents": 0.98,
        "vertical_ai": 0.95,
        "ai_infra": 0.9,
        "developer_tools": 0.82,
        "voice_ai": 0.82,
        "physical_ai_robotics": 0.91,
        "cyber_security": 0.86,
        "fintech": 0.72,
        "health_bio": 0.82,
        "climate_energy": 0.72,
        "industrial_deeptech": 0.84,
        "semiconductors": 0.86,
        "defense_dualuse": 0.88,
        "consumer": 0.74,
        "gaming": 0.68,
        "marketplace": 0.52,
        "web3": 0.48,
        "scientific_ai": 0.9,
        "enterprise_saas": 0.86,
        "hardware": 0.8
      },
      "company_trait_momentum": {
        "ai_native": 0.98,
        "technical_differentiation": 0.92,
        "defensible_ip": 0.8,
        "software_high_margin": 0.78,
        "capital_intensive": 0.67,
        "enterprise_b2b": 0.83,
        "consumer": 0.64,
        "developer_facing": 0.78,
        "regulated_market": 0.7,
        "traction": 0.84,
        "revenue": 0.73,
        "speed_ship": 0.96,
        "global_market": 0.9,
        "local_market_fit": 0.58,
        "team_small": 0.94,
        "proprietary_data": 0.83
      },
      "founder_trait_momentum": {
        "technical_depth": 0.94,
        "research_depth": 0.78,
        "elite_academic": 0.68,
        "elite_employer": 0.73,
        "repeat_founder": 0.72,
        "prior_exit": 0.6,
        "early_career": 0.72,
        "product_builder": 0.96,
        "enterprise_gtm": 0.78,
        "domain_expertise": 0.92,
        "speed": 0.98,
        "global_ambition": 0.93,
        "cofounder_complementarity": 0.86,
        "customer_obsession": 0.93
      },
      "sources": [
        "https://www.ycombinator.com/rfs",
        "https://sequoiacap.com/article/ai-ascent-2026",
        "https://pear.vc/request-for-startups-august-2026/",
        "https://seedcamp.com/views/fund-vii-is-now-live/",
        "https://www.southparkcommons.com/founder-fellowship",
        "https://sequoiacap.com/article/2026-this-is-agi",
        "https://sequoiacap.com/article/ai-ascent-2025"
      ]
    },
    "regions": {
      "us": {
        "boost": {
          "ai_agents": 0.04,
          "physical_ai_robotics": 0.05,
          "defense_dualuse": 0.06,
          "semiconductors": 0.04,
          "scientific_ai": 0.03
        }
      },
      "europe": {
        "boost": {
          "cyber_security": 0.04,
          "industrial_deeptech": 0.06,
          "climate_energy": 0.05,
          "scientific_ai": 0.04,
          "physical_ai_robotics": 0.04
        }
      },
      "mena": {
        "boost": {
          "fintech": 0.08,
          "enterprise_saas": 0.05,
          "climate_energy": 0.06,
          "industrial_deeptech": 0.04,
          "ai_agents": 0.03
        }
      },
      "latam": {
        "boost": {
          "fintech": 0.07,
          "enterprise_saas": 0.05,
          "ai_agents": 0.04,
          "marketplace": 0.03,
          "climate_energy": 0.04
        }
      },
      "asia": {
        "boost": {
          "semiconductors": 0.07,
          "hardware": 0.05,
          "industrial_deeptech": 0.05,
          "ai_agents": 0.03
        }
      }
    }
  },
  "verification_rules": {
    "source_type_weight": {
      "official_company": 1.0,
      "official_program": 1.0,
      "official_registry": 1.0,
      "patent_office": 0.98,
      "academic_primary": 0.96,
      "direct_linkedin_profile": 0.92,
      "direct_founder_post": 0.9,
      "reputable_media": 0.84,
      "investor_portfolio": 0.82,
      "database": 0.72,
      "aggregator": 0.58,
      "social_mention": 0.52,
      "unknown": 0.45
    },
    "status_weight": {
      "verified": 1.0,
      "corroborated": 0.92,
      "likely": 0.75,
      "inferred": 0.62,
      "unresolved": 0.45,
      "contradicted": 0.15
    },
    "freshness_half_life_days": 365,
    "minimum_default_confidence_without_evidence": 0.55,
    "recommended_hard_checks": [
      "founder_role",
      "company_active",
      "company_founded_date",
      "funding_stage",
      "program_membership",
      "founder_previous_employer"
    ]
  },
  "layer_weights": {
    "current_program_fit": {
      "historical_latest_cohort": 0.6,
      "current_program_intent": 0.25,
      "market_regime": 0.15
    }
  }
}""")
PROFILE_SCHEMA = json.loads(r"""{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "Scouter Cohort DNA Profile",
  "description": "Normalized founder/company profile accepted by Scouter Cohort DNA Engine v1.0.",
  "type": "object",
  "properties": {
    "founder": {
      "type": "object",
      "additionalProperties": {
        "type": [
          "number",
          "null"
        ],
        "minimum": 0,
        "maximum": 1
      }
    },
    "company": {
      "type": "object",
      "additionalProperties": {
        "type": [
          "number",
          "null"
        ],
        "minimum": 0,
        "maximum": 1
      }
    },
    "categories": {
      "type": "array",
      "items": {
        "type": "string"
      }
    },
    "stage": {
      "type": [
        "string",
        "null"
      ]
    },
    "geographies": {
      "type": "array",
      "items": {
        "type": "string"
      }
    },
    "evidence": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "field": {
            "type": "string"
          },
          "status": {
            "enum": [
              "verified",
              "corroborated",
              "likely",
              "inferred",
              "unresolved",
              "contradicted"
            ]
          },
          "source_type": {
            "type": "string"
          },
          "confidence": {
            "type": "number",
            "minimum": 0,
            "maximum": 1
          },
          "freshness_days": {
            "type": [
              "number",
              "null"
            ],
            "minimum": 0
          },
          "url": {
            "type": [
              "string",
              "null"
            ]
          }
        },
        "required": [
          "field",
          "status",
          "source_type"
        ]
      }
    }
  },
  "required": [
    "founder",
    "company",
    "categories",
    "geographies"
  ]
}""")

ENGINE_VERSION = "1.5.0-hf0-calibrated"
ENGINE_AS_OF = COHORT_SIGNALS.get("as_of", COHORT_LIBRARY.get("as_of"))


# ---------------------------------------------------------------------------
# PUBLIC CODEBASE API
# ---------------------------------------------------------------------------

class CohortDNAEngine:
    """
    Stable integration wrapper.

    Recommended codebase usage:

        from scouter_cohort_engine import CohortDNAEngine

        engine = CohortDNAEngine()
        result = engine.score(profile)

    `profile` may contain founder-only, company-only, or both.
    """

    def __init__(
        self,
        library: Dict[str, Any] | None = None,
        signals: Dict[str, Any] | None = None,
    ) -> None:
        self.library = library or COHORT_LIBRARY
        self.signals = signals or COHORT_SIGNALS

    @property
    def version(self) -> str:
        return ENGINE_VERSION

    @property
    def as_of(self) -> str | None:
        return ENGINE_AS_OF

    def score(
        self,
        profile: Dict[str, Any],
        *,
        years: Iterable[str] = ("2024", "2025", "2026"),
        top_current: int = 20,
        top_historical: int = 20,
    ) -> Dict[str, Any]:
        """Return current-program ranking + historical nearest cohorts."""
        return run_engine(
            profile,
            self.library,
            self.signals,
            years=tuple(str(y) for y in years),
            top_current=top_current,
            top_historical=top_historical,
        )

    def current_programs(
        self,
        profile: Dict[str, Any],
        *,
        year: str = "2026",
        top_n: int | None = None,
    ) -> List[Dict[str, Any]]:
        """Rank programs using latest cohort + intent + market context."""
        return rank_current_programs(
            profile, self.library, self.signals,
            latest_year=str(year), top_n=top_n
        )

    def historical_batches(
        self,
        profile: Dict[str, Any],
        *,
        years: Iterable[str] = ("2024", "2025", "2026"),
        top_n: int | None = None,
    ) -> List[Dict[str, Any]]:
        """Rank historical program-year DNAs."""
        return rank_historical_batches(
            profile, self.library,
            years=tuple(str(y) for y in years),
            top_n=top_n
        )

    def verify(self, profile: Dict[str, Any]) -> Dict[str, Any]:
        """Run only the second-check / evidence-confidence layer."""
        return verify_profile(profile, self.signals)

    def subcohorts(
        self,
        profile: Dict[str, Any],
        *,
        program_id: str | None = None,
        top_n: int | None = None,
    ) -> List[Dict[str, Any]]:
        """Rank exact named cohorts/batches when cohort-level DNA exists."""
        if program_id is not None and program_id not in self.library["programs"]:
            raise KeyError(
                f"Unknown program_id={program_id!r}. "
                f"Available: {', '.join(sorted(self.library['programs']))}"
            )
        return rank_program_subcohorts(
            profile, self.library, program_id=program_id, top_n=top_n
        )

    def score_subcohort(
        self,
        profile: Dict[str, Any],
        program_id: str,
        cohort_id: str,
    ) -> Dict[str, Any]:
        """Score one exact program cohort, e.g. speedrun SR006."""
        if program_id not in self.library["programs"]:
            raise KeyError(
                f"Unknown program_id={program_id!r}. "
                f"Available: {', '.join(sorted(self.library['programs']))}"
            )
        return score_program_subcohort(
            profile,
            self.library["programs"][program_id],
            str(cohort_id),
            program_id=program_id,
        )

    def score_program(
        self,
        profile: Dict[str, Any],
        program_id: str,
        *,
        year: str = "2026",
    ) -> Dict[str, Any]:
        """Score one specific program using current intent."""
        if program_id not in self.library["programs"]:
            raise KeyError(
                f"Unknown program_id={program_id!r}. "
                f"Available: {', '.join(sorted(self.library['programs']))}"
            )
        return score_current_program(
            profile,
            program_id,
            self.library["programs"][program_id],
            self.library,
            self.signals,
            latest_year=str(year),
        )

    def score_historical(
        self,
        profile: Dict[str, Any],
        program_id: str,
        year: str,
    ) -> Dict[str, Any]:
        """Score one specific historical program-year cohort."""
        if program_id not in self.library["programs"]:
            raise KeyError(
                f"Unknown program_id={program_id!r}. "
                f"Available: {', '.join(sorted(self.library['programs']))}"
            )
        result = score_historical_cohort(
            profile,
            self.library["programs"][program_id],
            str(year),
        )
        result["program_id"] = program_id
        return result

    def programs(self) -> List[Dict[str, Any]]:
        """Small metadata list useful for UI dropdowns."""
        return [
            {
                "id": pid,
                "name": p["name"],
                "region": p.get("region"),
                "years": sorted(p.get("years", {}).keys()),
                "archetype": p.get("archetype"),
                "cohorts": sorted(p.get("cohorts", {}).keys()),
            }
            for pid, p in self.library["programs"].items()
        ]

    def build_profile(
        self,
        *,
        founder_tags: Iterable[str] = (),
        company_tags: Iterable[str] = (),
        categories: Iterable[str] = (),
        stage: str | None = None,
        geographies: Iterable[str] = (),
        founder_overrides: Dict[str, float] | None = None,
        company_overrides: Dict[str, float] | None = None,
        evidence: List[Dict[str, Any]] | None = None,
    ) -> Dict[str, Any]:
        """Convenience helper for building normalized engine input."""
        return build_profile_from_tags(
            founder_tags=founder_tags,
            company_tags=company_tags,
            categories=categories,
            stage=stage,
            geographies=geographies,
            founder_overrides=founder_overrides,
            company_overrides=company_overrides,
            evidence=evidence,
        )


# Convenient singleton for simple integrations.
engine = CohortDNAEngine()


def score(profile: Dict[str, Any], **kwargs: Any) -> Dict[str, Any]:
    """Functional shorthand: `scouter_cohort_engine.score(profile)`."""
    return engine.score(profile, **kwargs)


def get_profile_schema() -> Dict[str, Any]:
    return copy.deepcopy(PROFILE_SCHEMA)


def get_program_ids() -> List[str]:
    return sorted(COHORT_LIBRARY["programs"].keys())


__all__ = [
    "CohortDNAEngine",
    "engine",
    "score",
    "build_profile_from_tags",
    "get_profile_schema",
    "get_program_ids",
    "score_program_subcohort",
    "rank_program_subcohorts",
    "COHORT_LIBRARY",
    "COHORT_SIGNALS",
    "PROFILE_SCHEMA",
    "ENGINE_VERSION",
    "ENGINE_AS_OF",
]


# ---------------------------------------------------------------------------
# OPTIONAL CLI
# ---------------------------------------------------------------------------

def main() -> None:
    import argparse

    parser = argparse.ArgumentParser(
        description="Scouter Cohort DNA Engine — standalone"
    )
    parser.add_argument("profile", help="Path to normalized founder/company JSON")
    parser.add_argument(
        "--mode",
        choices=("both", "current", "historical", "subcohorts", "verify"),
        default="both",
    )
    parser.add_argument("--year", default="2026")
    parser.add_argument("--top", type=int, default=20)
    parser.add_argument("--program", default=None, help="Program id for subcohort mode, e.g. speedrun")
    args = parser.parse_args()

    profile = json.loads(Path(args.profile).read_text(encoding="utf-8"))
    e = CohortDNAEngine()

    if args.mode == "current":
        output = e.current_programs(profile, year=args.year, top_n=args.top)
    elif args.mode == "historical":
        output = e.historical_batches(profile, top_n=args.top)
    elif args.mode == "subcohorts":
        output = e.subcohorts(profile, program_id=args.program, top_n=args.top)
    elif args.mode == "verify":
        output = e.verify(profile)
    else:
        output = e.score(
            profile,
            top_current=args.top,
            top_historical=args.top,
        )

    print(json.dumps(output, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
