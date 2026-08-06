# Candidate profile

Derived from `./resume/resume.pdf` and user preferences. Refresh when the resume or targets change via `/job-sync-resume`.

Source resume: `./resume/resume.pdf`  
Editable base (for tailored resumes): `.cursor/skills/job-generate-resume/base-resume.md`  
Sync via `/job-sync-resume` · tailor via `/job-generate-resume <lead-folder>` · cover letters via `/job-generate-cover-letter <lead-folder>`.

## Snapshot

- **Name:** Rob Higgins
- **Headline:** Fullstack Software Engineer / Head of Engineering
- **Location:** Denver, CO
- **Contact:** higginsrob@gmail.com · linkedin.com/in/higginsrob · github.com/higginsrob · 424.299.9338
- **Level:** Staff / Lead / Head of Engineering · 10+ years

## Target roles (priority order)

_(Confirm with user — draft from resume)_

1. Staff / Lead Software Engineer (IC)
2. Senior Full Stack / Senior Software Engineer (senior+)
3. Engineering Manager / AI Engineering Manager / Head of Engineering (hands-on or small-team)
4. Platform / Infrastructure / Data+ML platform with staff-level scope

## Target stack (priority)

_(Confirm with user — draft from resume experience)_

| Priority | Stack signal | How to treat |
|----------|--------------|--------------|
| **Boost** | TypeScript / JavaScript, React, Node.js, Python, PostgreSQL, AWS/GCP, Terraform, Docker/K8s, platform/SDK, LLM/AI products, event-driven / data pipelines | Prefer for search queries, admission, and hire-likelihood |
| **Neutral / fine** | Three.js / WebGL / AR (strong history, not required chase), Go, Java, Redis, GraphQL | Keep and score normally if title/scope fit |
| **Deprioritize** | Pure mobile-only (iOS/Android native), PHP/.NET shop specialists, pure data-science/research without product eng | Lower stack score; drop first when capacity is tight |

## Strong fit signals (boost score)

- Early engineer → acquisition (Vertebrae → Snap); ownership of cloud infra, SDKs, merchant integrations
- Tech lead for AR Enterprise Web SDK at Snap (cross-cloud, product + platform)
- Head of Engineering at Panorama AI (LLM/BI products; data + platform teams)
- End-to-end fullstack: React/Node + Python + cloud + platform architecture
- SDK / developer tools and embeddable product surfaces

## Experience anchors (use when matching)

| Org | Role | Highlights |
|-----|------|------------|
| Panorama AI | Head of Engineering / Lead SWE | LLM + ML products; Python ETL, Postgres, JS tag, event ingestion; eng org standards |
| Snap Inc. | SWE · AR Enterprise Web SDK Tech Lead | Cross-cloud pub/sub; ARES Web SDK; Camera Kit; Three.js product viewer |
| Vertebrae | Senior Fullstack SWE (early eng) | AR/VR e-comm platform 0→1; Terraform/cloud at scale; merchant SDK; Snap acquisition |

## Skills to match against JDs

**Lead with:** System design, platform engineering, TypeScript/JS, React, Node.js, Python, PostgreSQL, AWS/GCP, Terraform, LLM/AI product eng, technical leadership

Also strong: Docker/K8s, microservices, event-driven architecture, CI/CD, SDKs & developer tools, data pipelines/ETL

**Have but do not chase:** Three.js / AR try-on specifically (valuable context, not a search focus unless user asks)

## Soft preferences

- **Location bias:** Denver, CO metro · US remote · hybrid OK
- Prefer remote / hybrid / Denver local-office over distant pure onsite
- Company type: product companies, startups through mid-size, AI/platform/SDK-oriented; open to larger tech
- Role shape: strong IC (staff/lead) or hands-on EM / small-team Head of Eng — avoid pure people-manager with no technical ownership

## Hard excludes (unless user overrides)

- Junior / mid / “new grad”
- Roles clearly below senior/lead level
- Unpaid, equity-only founder bait without a real company
- Pure mobile-only native (iOS/Android) with no web/platform scope
- Recruiter/agency spam postings with no real company or JD

## Setup checklist (agent)

If Snapshot name is still a placeholder, or `base-resume.md` is still the stub:

1. Require a resume in `./resume/`
2. Populate `base-resume.md` from it (from `base-resume.example.md` if missing)
3. Fill `candidate.md` from the resume (from this example if missing)
4. Ask the user to confirm target roles, location bias, stack boost/deprioritize, and hard excludes

Later resume edits: run `/job-sync-resume` (merge facts; preserve prefs).
