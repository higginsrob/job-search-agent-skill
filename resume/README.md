# Your resume

Add your resume here before running the job-search skills.

## What to add

Put at least one of:

- `resume.pdf` (or any `*.pdf`) — preferred master copy
- `resume.md` — optional markdown source if you already have one

You can also drop additional versions (e.g. dated PDFs). The skills use the newest PDF/MD they find unless you point them at a specific file.

## First-time setup

When you run `/job-search`, `/job-sync-resume`, `/job-generate-resume`, or `/job-generate-cover-letter`, the agent will:

1. Look in this folder for a resume
2. If none is found, stop and ask you to add one
3. Derive `.cursor/skills/job-generate-resume/base-resume.md` and `.cursor/skills/job-search/candidate.md` from your resume (and ask a few questions about target roles, location, and stack preferences)

After you edit the master resume later, run `/job-sync-resume` to refresh `base-resume.md`, `candidate.md`, and the board artifacts (`resume.md` / `resume.html` / `resume.pdf`) without wiping your search preferences.

Do **not** commit personal materials if this repo is public:

- `resume/*` is gitignored except this README
- `candidate.md` and `base-resume.md` are gitignored (stubs live in `*.example.md`)

