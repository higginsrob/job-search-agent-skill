.PHONY: help server dev reset icons github-pages \
	skills skills-all skills-list skills-clean \
	skills-claude skills-codex skills-opencode skills-pi skills-qwen skills-gemini \
	skills-user skills-user-claude skills-user-codex skills-user-opencode \
	skills-user-pi skills-user-qwen skills-user-cursor

.DEFAULT_GOAL := help

# Source of truth for skill packages in this repo
SKILLS_SRC := .cursor/skills
SKILL_NAMES := job-search job-sync-resume job-generate-resume job-generate-cover-letter job-company-detail

# Static demo publish (GitHub Pages)
GH_PAGES_BRANCH ?= gh-pages
GH_PAGES_REMOTE ?= origin
GH_PAGES_URL ?= https://higginsrob.github.io/job-search-agent-skill/

# Project-local agent skill roots (relative to repo)
AGENT_CLAUDE   := .claude/skills
AGENT_CODEX    := .agents/skills
AGENT_OPENCODE := .opencode/skills
AGENT_PI       := .pi/skills
AGENT_QWEN     := .qwen/skills
AGENT_GEMINI   := .gemini/skills

# Personal / global skill roots
USER_CLAUDE   := $(HOME)/.claude/skills
USER_CODEX    := $(HOME)/.agents/skills
USER_OPENCODE := $(HOME)/.config/opencode/skills
USER_PI       := $(HOME)/.pi/agent/skills
USER_QWEN     := $(HOME)/.qwen/skills
USER_CURSOR   := $(HOME)/.cursor/skills

RSYNC_EXCLUDES := \
	--exclude 'candidate.md' \
	--exclude 'base-resume.md' \
	--exclude '__pycache__/' \
	--exclude '.DS_Store' \
	--exclude '*.py[cod]'

# Sync each skill package into DEST (does not wipe other skills in DEST)
define sync_skills_to
	@test -d "$(SKILLS_SRC)" || (echo "Missing $(SKILLS_SRC)/"; exit 1)
	@mkdir -p "$(1)"
	@for skill in $(SKILL_NAMES); do \
		src="$(SKILLS_SRC)/$$skill"; \
		if [ ! -d "$$src" ]; then \
			echo "skip missing $$src"; \
			continue; \
		fi; \
		mkdir -p "$(1)/$$skill"; \
		rsync -a --delete $(RSYNC_EXCLUDES) "$$src/" "$(1)/$$skill/"; \
		echo "  $$skill → $(1)/$$skill/"; \
	done
	@echo "Synced skills → $(1)"
endef

define clean_skills_from
	@for skill in $(SKILL_NAMES); do \
		rm -rf "$(1)/$$skill"; \
	done
	@echo "Removed job-* skills from $(1)"
endef

help:
	@echo ""
	@echo "  Job Search — make targets"
	@echo "  ──────────────────────────────────────────────────"
	@echo "  make help     Show this help"
	@echo "  make server   Serve the leads board at http://127.0.0.1:8765"
	@echo "                (write APIs for status / applied / delete)"
	@echo "  make dev      Same as server, but auto-reload on script/UI changes"
	@echo "  make icons    Fetch/refresh company icons under companies/*/icon.*"
	@echo "  make reset    Wipe local job history + candidate settings"
	@echo "                (keeps resume/; requires typing RESET to confirm)"
	@echo "  make github-pages"
	@echo "                Publish a static demo: reset $(GH_PAGES_BRANCH) from"
	@echo "                latest main; force-add leads/, companies/, resume,"
	@echo "                and candidate profile; push."
	@echo "                Live example: $(GH_PAGES_URL)"
	@echo ""
	@echo "  Sync skills to other agents (source: $(SKILLS_SRC)/)"
	@echo "  ──────────────────────────────────────────────────"
	@echo "  make skills           Sync into all project agent folders"
	@echo "  make skills-list      Show source skills + known destinations"
	@echo "  make skills-claude    → $(AGENT_CLAUDE)/"
	@echo "  make skills-codex     → $(AGENT_CODEX)/   (Codex / universal)"
	@echo "  make skills-opencode  → $(AGENT_OPENCODE)/"
	@echo "  make skills-pi        → $(AGENT_PI)/"
	@echo "  make skills-qwen      → $(AGENT_QWEN)/"
	@echo "  make skills-gemini    → $(AGENT_GEMINI)/"
	@echo "  make skills-clean     Remove synced job-* skills from project agents"
	@echo ""
	@echo "  make skills-user         Sync into personal (~) agent folders"
	@echo "  make skills-user-claude  → $(USER_CLAUDE)/"
	@echo "  make skills-user-codex   → $(USER_CODEX)/"
	@echo "  make skills-user-opencode→ $(USER_OPENCODE)/"
	@echo "  make skills-user-pi      → $(USER_PI)/"
	@echo "  make skills-user-qwen    → $(USER_QWEN)/"
	@echo "  make skills-user-cursor  → $(USER_CURSOR)/"
	@echo ""
	@echo "  Typical flow:  make server   → browse board"
	@echo "                 /job-search   → fill leads (in Cursor)"
	@echo "                 make skills   → use same skills in Claude/Codex/…"
	@echo "                 make reset    → start over"
	@echo ""

server:
	python3 scripts/serve_leads.py

dev:
	python3 scripts/dev_server.py

icons:
	python3 scripts/fetch_company_icon.py

reset:
	python3 scripts/reset_local_data.py

# Publish a static snapshot of the board (main + local demo data) to gh-pages.
# Uses a temporary worktree so switching branches cannot wipe gitignored local data.
github-pages:
	@set -eu; \
	if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then \
		echo "Not a git repository."; exit 1; \
	fi; \
	if ! git diff --quiet || ! git diff --cached --quiet; then \
		echo "Working tree has uncommitted changes. Commit or stash first."; exit 1; \
	fi; \
	if [ ! -f leads/index.json ]; then \
		echo "Missing leads/index.json — run /job-search (or copy the example) first."; exit 1; \
	fi; \
	if [ ! -d companies ] || [ -z "$$(find companies -mindepth 1 -maxdepth 1 ! -name '.gitkeep' 2>/dev/null | head -1)" ]; then \
		echo "companies/ looks empty — research a company first for a useful demo."; exit 1; \
	fi; \
	if [ ! -f .cursor/skills/job-search/candidate.md ]; then \
		echo "Missing .cursor/skills/job-search/candidate.md — run /job-search or /job-sync-resume first."; exit 1; \
	fi; \
	for f in resume/resume.md resume/resume.html resume/resume.pdf; do \
		if [ ! -f "$$f" ]; then \
			echo "Missing $$f — add resume files or run /job-sync-resume first."; exit 1; \
		fi; \
	done; \
	ROOT=$$(git rev-parse --show-toplevel); \
	echo "Fetching latest main from $(GH_PAGES_REMOTE)..."; \
	git fetch $(GH_PAGES_REMOTE) main; \
	BASE="$(GH_PAGES_REMOTE)/main"; \
	if git show-ref --verify --quiet refs/heads/main \
		&& git merge-base --is-ancestor $(GH_PAGES_REMOTE)/main main; then \
		BASE="main"; \
	fi; \
	WT=$$(mktemp -d "$${TMPDIR:-/tmp}/job-search-gh-pages.XXXXXX"); \
	cleanup() { git worktree remove --force "$$WT" 2>/dev/null || rm -rf "$$WT"; }; \
	trap cleanup EXIT; \
	echo "Building $(GH_PAGES_BRANCH) from $${BASE} in worktree..."; \
	git worktree add --detach "$$WT" "$$BASE"; \
	cp -a "$$ROOT/leads" "$$ROOT/companies" "$$WT/"; \
	mkdir -p "$$WT/resume" "$$WT/.cursor/skills/job-search" "$$WT/.cursor/skills/job-generate-resume"; \
	cp "$$ROOT/resume/resume.md" "$$ROOT/resume/resume.html" "$$ROOT/resume/resume.pdf" "$$WT/resume/"; \
	cp "$$ROOT/.cursor/skills/job-search/candidate.md" "$$WT/.cursor/skills/job-search/candidate.md"; \
	cp "$$ROOT/.cursor/skills/job-search/candidate.md" "$$WT/candidate.md"; \
	if [ -f "$$ROOT/.cursor/skills/job-generate-resume/base-resume.md" ]; then \
		cp "$$ROOT/.cursor/skills/job-generate-resume/base-resume.md" \
			"$$WT/.cursor/skills/job-generate-resume/base-resume.md"; \
	fi; \
	touch "$$WT/.nojekyll"; \
	find "$$WT/leads" "$$WT/companies" -name .DS_Store -delete 2>/dev/null || true; \
	git -C "$$WT" checkout -B $(GH_PAGES_BRANCH); \
	echo "Staging demo data (force-add; gitignored on main)..."; \
	git -C "$$WT" add -f .nojekyll candidate.md \
		':(exclude)*.DS_Store' ':(exclude)**/.DS_Store' \
		leads companies \
		resume/resume.md resume/resume.html resume/resume.pdf \
		.cursor/skills/job-search/candidate.md; \
	if [ -f "$$WT/.cursor/skills/job-generate-resume/base-resume.md" ]; then \
		git -C "$$WT" add -f .cursor/skills/job-generate-resume/base-resume.md; \
	fi; \
	if git -C "$$WT" diff --cached --quiet; then \
		echo "Nothing new to publish (tree already matches)."; \
	else \
		git -C "$$WT" commit -m "$$(printf '%s\n\n%s\n' \
			'Publish static example board for GitHub Pages' \
			'Snapshot of leads/, companies/, resume, and candidate profile on top of main.')"; \
	fi; \
	echo "Pushing $(GH_PAGES_BRANCH) -> $(GH_PAGES_REMOTE)..."; \
	if ! git -C "$$WT" push --force-with-lease -u $(GH_PAGES_REMOTE) $(GH_PAGES_BRANCH); then \
		echo "force-with-lease failed; retrying with --force for publish branch..."; \
		git -C "$$WT" push --force -u $(GH_PAGES_REMOTE) $(GH_PAGES_BRANCH); \
	fi; \
	trap - EXIT; \
	cleanup; \
	echo ""; \
	echo "Published static demo (local leads/companies/resume untouched)."; \
	echo "  Branch: $(GH_PAGES_BRANCH)"; \
	echo "  URL:    $(GH_PAGES_URL)"; \
	echo "If the site 404s, set Pages source to branch $(GH_PAGES_BRANCH) / (root) in repo Settings."

# ── Project agent sync ──────────────────────────────────────────────
skills: skills-all
skills-all: skills-claude skills-codex skills-opencode skills-pi skills-qwen skills-gemini

skills-claude:
	$(call sync_skills_to,$(AGENT_CLAUDE))

skills-codex:
	$(call sync_skills_to,$(AGENT_CODEX))

skills-opencode:
	$(call sync_skills_to,$(AGENT_OPENCODE))

skills-pi:
	$(call sync_skills_to,$(AGENT_PI))

skills-qwen:
	$(call sync_skills_to,$(AGENT_QWEN))

skills-gemini:
	$(call sync_skills_to,$(AGENT_GEMINI))

skills-clean:
	$(call clean_skills_from,$(AGENT_CLAUDE))
	$(call clean_skills_from,$(AGENT_CODEX))
	$(call clean_skills_from,$(AGENT_OPENCODE))
	$(call clean_skills_from,$(AGENT_PI))
	$(call clean_skills_from,$(AGENT_QWEN))
	$(call clean_skills_from,$(AGENT_GEMINI))

skills-list:
	@echo "Source ($(SKILLS_SRC)):"
	@for skill in $(SKILL_NAMES); do \
		if [ -d "$(SKILLS_SRC)/$$skill" ]; then echo "  ✓ $$skill"; else echo "  ✗ $$skill (missing)"; fi; \
	done
	@echo ""
	@echo "Project destinations:"
	@echo "  claude    $(AGENT_CLAUDE)/"
	@echo "  codex     $(AGENT_CODEX)/"
	@echo "  opencode  $(AGENT_OPENCODE)/"
	@echo "  pi        $(AGENT_PI)/"
	@echo "  qwen      $(AGENT_QWEN)/"
	@echo "  gemini    $(AGENT_GEMINI)/"
	@echo ""
	@echo "Personal destinations:"
	@echo "  claude    $(USER_CLAUDE)/"
	@echo "  codex     $(USER_CODEX)/"
	@echo "  opencode  $(USER_OPENCODE)/"
	@echo "  pi        $(USER_PI)/"
	@echo "  qwen      $(USER_QWEN)/"
	@echo "  cursor    $(USER_CURSOR)/"

# ── Personal (~) agent sync ─────────────────────────────────────────
skills-user: skills-user-claude skills-user-codex skills-user-opencode skills-user-pi skills-user-qwen skills-user-cursor

skills-user-claude:
	$(call sync_skills_to,$(USER_CLAUDE))

skills-user-codex:
	$(call sync_skills_to,$(USER_CODEX))

skills-user-opencode:
	$(call sync_skills_to,$(USER_OPENCODE))

skills-user-pi:
	$(call sync_skills_to,$(USER_PI))

skills-user-qwen:
	$(call sync_skills_to,$(USER_QWEN))

skills-user-cursor:
	$(call sync_skills_to,$(USER_CURSOR))
