# ADR-001: BP-008 vs ES-005 Marketplace Enforcement Progression Discrepancy

**Status:** Open — requires product/architecture decision
**Date:** August 2026
**Affected Documents:** BP-008 §20 (Marketplace Enforcement), ES-005 §49 (Progressive Seller Enforcement), IS-006 §48 (Suspension Workflow), IS-010 §57

---

## Context

A QA review of the full BP/ES/IS documentation set (per `docs/project/PROJECT-MASTER-INDEX.md`) found that two source-authority documents describe the platform's progressive enforcement sequence differently:

**BP-008 §20 (Business Authority) — 5 stages:**

```
Warning → Education → Temporary Restriction → Marketplace Suspension → Permanent Removal
```

**ES-005 §49 (Technical Authority) — 6 stages:**

```
Issue Detected → Communication/Warning → Improvement Opportunity → Restriction → Temporary Marketplace Suspension → Extended Suspension/Revocation
```

Both documents state the sequence is progressive, and both allow severe violations to bypass intermediate steps — but the number of stages, the stage names, and the terminal state ("Permanent Removal" vs "Revocation") differ.

Both texts were supplied as authoritative source content and preserved verbatim in their respective documents; this discrepancy originates in the source material itself, not in a documentation-generation error.

## Interim Resolution

IS-006 §48 (Suspension Workflow) already had to pick one sequence to build an executable plan against. It adopted the ES-005 §49 six-stage version as the implementation-authoritative sequence, on the basis that it is the more granular of the two, and both describe the same underlying progressive-discipline principle (BP-008 BR-8.11). IS-010 §57 (Sprint 30) inherits this same choice.

This is noted here as an **interim, documentation-level reconciliation only** — it has not been formally approved as a business decision.

## Decision Needed

One of the following must be confirmed by whoever owns BP-008 (business authority):

1. **Adopt the ES-005 six-stage sequence as authoritative** and update BP-008 §20 to match, via the formal amendment process (BP-001 §19: reason, affected modules, implementation impact, migration considerations, version increment).
2. **Adopt the BP-008 five-stage sequence as authoritative** and update ES-005 §49 (and IS-006 §48, IS-010 §57) to match.
3. **Treat both as valid at different granularities** (e.g. BP-008's 5 stages are the business-level summary, ES-005's 6 stages are the technical elaboration) and formally document the stage-to-stage mapping so no future implementer has to guess.

## Consequence (Until Resolved)

Implementation should continue to follow IS-006 §48's six-stage sequence (already in use), since it is the one currently wired into an executable IS. This ADR exists so that choice is traceable and revisable rather than silently baked in.

---

## Revision History

| Version | Date | Description |
|----------|------|-------------|
| 1.0.0 | August 2026 | Initial ADR recording the BP-008/ES-005 enforcement-progression discrepancy found during documentation QA |
