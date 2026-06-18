<!-- version: 1.1.0 -->
<!-- classification: REVIEW -->
<!-- review-type: DOCUMENTATION -->
<!-- date: 2026-06-09 -->
<!-- last-updated: 2026-06-18 -->
<!-- status: ACTIVE -->

# Documentation Quick Start Guide

How to create, update, and manage documentation using the new classification system.

---

## 🚀 Quick Start (5 minutes)

### Step 1: Determine Document Type

What are you documenting? Choose one:

| Type | When to Use | Example |
|------|------------|---------|
| **FEATURE** | How to use/operate a feature | "How the Logs Panel works" |
| **TESTING** | How to test a feature | "Test procedures for Logs Panel" |
| **DESIGN** | Why design choices were made | "Design decisions in Logs Panel" |
| **GAPS** | Missing features and future work | "Gaps in Logs Panel" |
| **ANALYSIS** | Deep-dive into performance/security/etc | "Performance analysis of Logs Panel" |
| **CHANGE** | What code/behavior changed | "Code changes in Logs Panel" |
| **STUDY** | Research & exploration (pre-decision) | "Logging strategies exploration" |
| **REVIEW** | Audit, verification, approval | "Documentation review of Logs Panel" |
| **ARCHITECTURE** | System design & structure | "Architecture of Logs Panel" |
| **SUMMARY** | Executive overview & status | "Implementation status of Logs Panel" |
| **PLAN** | Spec-driven implementation plan (docs/PLANS/) | "PLAN-08 Team Executor spec" |

**👉 See full descriptions**: `docs/DOCUMENTATION-TAXONOMY.md`

---

### Step 2: Check if Doc Already Exists

**Before creating**, check the registry:

```bash
# Open the registry
cat docs/DOCUMENTATION-REGISTRY.md

# Or search from command line
grep -r "LOGS-PANEL" docs/DOCUMENTATION-REGISTRY.md
```

**Find** the feature/system name in the registry.

**Check** if a doc of that type already exists.

---

### Step 3: Decide: Create vs. Update

| Situation | Action |
|-----------|--------|
| Doc exists, minor fix | Update existing, bump `last-updated` date |
| Doc exists, major changes | Create new doc with new date, link to old |
| Doc doesn't exist | Create new doc with today's date |

---

### Step 4: Create the Document

**Option A: Copy Template**

```bash
# 1. Find the template for your type
vim docs/DOCUMENTATION-TEMPLATES.md
#    (search for your TYPE)

# 2. Copy the template to a new file
cp docs/DOCUMENTATION-TEMPLATES.md \
   docs/TYPE-<NAME>-$(date +%Y-%m-%d).md

# 3. Edit the file
vim docs/TYPE-<NAME>-2026-06-09.md
```

**Option B: Manual**

```bash
# 1. Create file with correct naming
touch docs/FEATURE-LOGS-PANEL-$(date +%Y-%m-%d).md

# 2. Add version header (REQUIRED)
cat > docs/FEATURE-LOGS-PANEL-2026-06-09.md << 'EOF'
<!-- version: 1.0.0 -->
<!-- classification: FEATURE -->
<!-- date: 2026-06-09 -->
<!-- last-updated: 2026-06-09 -->
<!-- status: ACTIVE -->

# Feature: [Name]

[Content...]
EOF

# 3. Edit
vim docs/FEATURE-LOGS-PANEL-2026-06-09.md
```

---

### Step 5: Update the Registry

Add an entry to `docs/DOCUMENTATION-REGISTRY.md`:

```markdown
| FEATURE-LOGS-PANEL-2026-06-09.md | 2026-06-09 | Logs Panel | ✅ Active | Live logging, metrics, auto-analysis |
```

---

### Step 6: Commit

```bash
git add docs/FEATURE-LOGS-PANEL-2026-06-09.md
git add docs/DOCUMENTATION-REGISTRY.md
git commit -m "docs: FEATURE Logs Panel — live logging, metrics, auto-analysis

Classification: FEATURE
Date: 2026-06-09
Content: Architecture, workflows, configuration, error handling

Also updated DOCUMENTATION-REGISTRY.md to track new doc."
```

---

## 📋 Common Workflows

### Workflow 1: Create a Feature Doc

```bash
# 1. Check if FEATURE doc exists
grep "FEATURE.*LOGS-PANEL" docs/DOCUMENTATION-REGISTRY.md

# 2. Get template
head -30 docs/DOCUMENTATION-TEMPLATES.md | grep -A 30 "FEATURE Doc Template"

# 3. Create file with template
cat > docs/FEATURE-LOGS-PANEL-$(date +%Y-%m-%d).md << 'EOF'
<!-- version: 1.0.0 -->
<!-- classification: FEATURE -->
<!-- date: 2026-06-09 -->
<!-- last-updated: 2026-06-09 -->
<!-- status: ACTIVE -->

# Feature: Logs Panel

[Fill in using template from DOCUMENTATION-TEMPLATES.md]
EOF

# 4. Update registry
vim docs/DOCUMENTATION-REGISTRY.md
# Add: | FEATURE-LOGS-PANEL-2026-06-09.md | 2026-06-09 | Logs Panel | ✅ Active | [description] |

# 5. Commit
git add docs/FEATURE-LOGS-PANEL-2026-06-09.md docs/DOCUMENTATION-REGISTRY.md
git commit -m "docs: FEATURE Logs Panel — [description]"
```

---

### Workflow 2: Update Existing Doc

```bash
# 1. Check what date it has
ls -la docs/FEATURE-LOGS-PANEL*.md
# Output: docs/FEATURE-LOGS-PANEL-2026-06-09.md

# 2. Edit the existing file
vim docs/FEATURE-LOGS-PANEL-2026-06-09.md
# Update: <!-- last-updated: 2026-06-09 -->

# 3. Commit
git add docs/FEATURE-LOGS-PANEL-2026-06-09.md
git commit -m "docs: FEATURE Logs Panel — clarify workflows section"
```

---

### Workflow 3: Create New Analysis (Different Date)

```bash
# 1. Check existing analyses
grep "ANALYSIS.*LOGS-PANEL" docs/DOCUMENTATION-REGISTRY.md

# 2. Previous was: ANALYSIS-DESIGN-LOGS-PANEL-2026-06-09.md
# Now I want: ANALYSIS-PERFORMANCE-LOGS-PANEL-2026-06-10.md (different date)

# 3. Create new doc
cat > docs/reviews/ANALYSIS-PERFORMANCE-LOGS-PANEL-$(date +%Y-%m-%d).md << 'EOF'
<!-- version: 1.0.0 -->
<!-- classification: ANALYSIS -->
<!-- analysis-type: PERFORMANCE -->
<!-- date: 2026-06-10 -->
<!-- last-updated: 2026-06-10 -->
<!-- status: ACTIVE -->
<!-- related-docs: ANALYSIS-DESIGN-LOGS-PANEL-2026-06-09.md -->

# Analysis: Performance of Logs Panel

[Content...]
EOF

# 4. Update registry
vim docs/DOCUMENTATION-REGISTRY.md

# 5. Commit
git add docs/reviews/ANALYSIS-PERFORMANCE-LOGS-PANEL-2026-06-10.md \
         docs/DOCUMENTATION-REGISTRY.md
git commit -m "docs: ANALYSIS Performance — render time, memory usage"
```

---

## 📁 Directory Structure Reference

```
docs/
├── DOCUMENTATION-TAXONOMY.md           ← Classification system (read first)
├── DOCUMENTATION-TEMPLATES.md          ← Templates for all types
├── DOCUMENTATION-QUICK-START.md        ← This file
├── DOCUMENTATION-REGISTRY.md           ← Index of all docs (update every time)
│
├── README.md                           ← Main index
│
├── FEATURE-*.md                        ← Feature operational guides
├── CHANGE-*.md                         ← Code & behavior changes
├── SUMMARY-*.md                        ← Executive summaries
│
├── features/                           ← Feature-specific docs
│   └── FEATURE-*.md
│
├── testing/                            ← Testing procedures
│   └── TESTING-*.md
│
├── studies/                            ← Research & exploration
│   └── STUDY-*.md
│
├── architecture/                       ← System architecture
│   └── ARCHITECTURE-*.md
│
├── PLANS/                              ← Document PLANs (PLAN-*) pending approval
│   └── PLAN-*.md                       ← promoted to specs/docs/approvedPlans/ (dated) on approval
│
└── reviews/                            ← Analysis, design, gaps, reviews
    ├── DESIGN-*.md
    ├── GAPS-*.md
    ├── ANALYSIS-*.md
    ├── REVIEW-*.md
    ├── INDEX-*.md
    └── ...
```

---

## ✅ Checklist Before Creating Doc

- [ ] Determined document TYPE
- [ ] Checked DOCUMENTATION-REGISTRY.md for existing docs
- [ ] Decided to CREATE vs UPDATE
- [ ] Used correct filename format: `TYPE-NAME-YYYY-MM-DD.md`
- [ ] Added version header with all required fields
- [ ] Filled in template content (from DOCUMENTATION-TEMPLATES.md)
- [ ] Used terminal-friendly formatting (Unicode box-drawing only)
- [ ] Added links to related docs
- [ ] Updated DOCUMENTATION-REGISTRY.md
- [ ] Committed with descriptive message
- [ ] No broken references (all linked docs exist)

---

## 🔍 Searching Documentation

### Find all FEATURE docs
```bash
grep -r "<!-- classification: FEATURE -->" docs/
```

### Find all docs about Logs Panel
```bash
find docs -name "*LOGS-PANEL*" -type f
```

### Find docs updated today
```bash
grep -r "<!-- last-updated: $(date +%Y-%m-%d) -->" docs/
```

### Find docs by type
```bash
grep -r "<!-- classification: DESIGN -->" docs/
grep -r "<!-- classification: TESTING -->" docs/
grep -r "<!-- classification: GAPS -->" docs/
```

---

## 📅 Naming Conventions

### Correct Format
```
TYPE-NAME-YYYY-MM-DD.md

FEATURE-LOGS-PANEL-2026-06-09.md       ✅
TESTING-LOGS-PANEL-2026-06-09.md       ✅
DESIGN-LOGS-PANEL-2026-06-09.md        ✅
ANALYSIS-PERFORMANCE-LOGS-2026-06-10.md ✅
```

### Incorrect (Don't do this)
```
FEATURE-LOGS-PANEL.md                   ❌ No date
feature-logs-panel-2026-06-09.md        ❌ Lowercase
FEATURE_LOGS_PANEL_2026-06-09.md        ❌ Underscores
FEATURE-LOGS-PANEL-June-9-2026.md       ❌ Wrong date format
```

---

## 🏷️ Version Header Explained

```markdown
<!-- version: 1.0.0 -->              ← Document version (major.minor.patch)
<!-- classification: FEATURE -->     ← Type: FEATURE, TESTING, DESIGN, etc.
<!-- date: 2026-06-09 -->            ← Creation date (ISO format YYYY-MM-DD)
<!-- last-updated: 2026-06-09 -->    ← Last update date
<!-- status: ACTIVE -->              ← DRAFT, ACTIVE, SUPERSEDED, ARCHIVED

<!-- Optional fields -->
<!-- analysis-type: PERFORMANCE -->     ← For ANALYSIS docs
<!-- review-type: DOCUMENTATION -->     ← For REVIEW docs
<!-- reviewed-by: Name, Title -->       ← Who reviewed it
<!-- related-docs: OTHER-2026-06-09.md -->  ← Links to related docs
```

---

## 🚨 Common Mistakes

| Mistake | Why Bad | Fix |
|---------|---------|-----|
| No date in filename | Can't tell when created | Always use YYYY-MM-DD |
| No version header | Can't track status | Add required header |
| Mixed lowercase/uppercase | Inconsistent | Use UPPERCASE-HYPHEN-FORMAT |
| Outdated last-updated | Confusing if stale | Update when you edit |
| No entry in registry | Can't find doc later | Add row to DOCUMENTATION-REGISTRY.md |
| Broken links | Readers can't navigate | Use format: `FILENAME.md` in brackets |
| Create duplicate doc | Confusion, maintenance nightmare | Check registry first |

---

## 📞 Support

### Questions about Classification?
→ Read: `docs/DOCUMENTATION-TAXONOMY.md` (full definitions)

### Need a Template?
→ Read: `docs/DOCUMENTATION-TEMPLATES.md` (copy-paste templates)

### Want to Find a Doc?
→ Check: `docs/DOCUMENTATION-REGISTRY.md` (index of all docs)

### Not Sure if Doc Exists?
→ Search: `grep -r "FEATURE-NAME" docs/DOCUMENTATION-REGISTRY.md`

---

## 📚 Learning Resources

| Resource | Purpose |
|----------|---------|
| DOCUMENTATION-TAXONOMY.md | Full doc type definitions & naming rules |
| DOCUMENTATION-TEMPLATES.md | Copy-paste templates for each type |
| DOCUMENTATION-REGISTRY.md | Index of all docs (search before creating) |
| DOCUMENTATION-QUICK-START.md | This file (workflows & examples) |

**Recommended reading order**:
1. This file (QUICK-START) — 5 min
2. TAXONOMY — 10 min (understand doc types)
3. TEMPLATES — as needed (copy templates)
4. REGISTRY — before creating (check if exists)

---

## 🎯 Examples

### Example 1: Create a FEATURE Doc

```bash
# Feature: Registry Auth Login
# Date: 2026-06-15

# 1. Check registry
grep "REGISTRY-AUTH" docs/DOCUMENTATION-REGISTRY.md
# → Found: FEATURE-WAVE-5-REGISTRY-AUTH.md (old, needs update)

# 2. Decide
# → Update existing (same date) OR create new version-dated doc
# → Decision: Create new: FEATURE-REGISTRY-AUTH-LOGIN-2026-06-15.md

# 3. Create file
cat > docs/FEATURE-REGISTRY-AUTH-LOGIN-2026-06-15.md << 'EOF'
<!-- version: 1.0.0 -->
<!-- classification: FEATURE -->
<!-- date: 2026-06-15 -->
<!-- last-updated: 2026-06-15 -->
<!-- status: ACTIVE -->

# Feature: Registry Authentication & Login

[Use FEATURE template from DOCUMENTATION-TEMPLATES.md]
EOF

# 4. Update registry
# → Add row: | FEATURE-REGISTRY-AUTH-LOGIN-2026-06-15.md | 2026-06-15 | Registry Auth | ✅ Active | Device-code login, key management |

# 5. Commit
git add docs/FEATURE-REGISTRY-AUTH-LOGIN-2026-06-15.md docs/DOCUMENTATION-REGISTRY.md
git commit -m "docs: FEATURE Registry Auth Login — 2026-06-15

Device-code OAuth flow, JWT storage, key import/export"
```

---

### Example 2: Create a GAPS Doc

```bash
# System: Logs Panel
# Date: 2026-06-16 (new analysis found gaps)

# 1. Check registry
grep "GAPS.*LOGS-PANEL" docs/DOCUMENTATION-REGISTRY.md
# → Not found (GAPS doc doesn't exist yet)

# 2. Create
cat > docs/reviews/GAPS-LOGS-PANEL-2026-06-16.md << 'EOF'
<!-- version: 1.0.0 -->
<!-- classification: GAPS -->
<!-- date: 2026-06-16 -->
<!-- last-updated: 2026-06-16 -->
<!-- status: ACTIVE -->
<!-- related-docs: DESIGN-LOGS-PANEL-2026-06-09.md -->

# Gaps & Missing Features: Logs Panel

## Gap 1: Analysis Timeout

**Impact**: High — analysis could hang indefinitely

[Use GAPS template...]
EOF

# 3. Update registry
# → Add row: | GAPS-LOGS-PANEL-2026-06-16.md | 2026-06-16 | Logs Panel | ✅ Active | 6 gaps identified, P0 blocker for timeout |

# 4. Commit
git add docs/reviews/GAPS-LOGS-PANEL-2026-06-16.md docs/DOCUMENTATION-REGISTRY.md
git commit -m "docs: GAPS Logs Panel — analysis timeout, confirmation, persistence"
```

---

## 🎓 Next Steps

1. **Read** `docs/DOCUMENTATION-TAXONOMY.md` for full details
2. **Bookmark** `docs/DOCUMENTATION-REGISTRY.md` (check before creating docs)
3. **Copy** templates from `docs/DOCUMENTATION-TEMPLATES.md` when creating
4. **Follow** this workflow every time you create documentation
5. **Update** registry + commit with clear message

---

**Guide Version**: 1.0.0  
**Created**: 2026-06-09  
**Last Updated**: 2026-06-09  
**Status**: ACTIVE  
