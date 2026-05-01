# PostCraft MCP

**Social Media Content Intelligence & Posting Plans — MCP Project**

---

## Product Requirements Document

Version 3.1 · May 2026 · Combined & Revised (manual publishing only)

| Field | Value |
|---|---|
| **Project Name** | PostCraft MCP v3.1 |
| **Version** | 3.1 — Manual publishing only |
| **Status** | Active Development |
| **Platforms** | YouTube · Instagram · X (Twitter) · Reddit · LinkedIn · Facebook |
| **UI Layer** | Prefab — all output displayed via Prefab dashboard |
| **Build Phases** | 4 Phases — Content Engine → Posting Plans & Analytics → Intelligence → Scale |
| **Target Market** | Creators, SMBs, Agencies |

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [MCP Architecture](#2-mcp-architecture)
3. [Prefab UI — The Output Surface](#3-prefab-ui--the-output-surface)
4. [Platform Coverage](#4-platform-coverage)
5. [Phase 1 — Content Generation Engine](#5-phase-1--content-generation-engine)
6. [Phase 2 — Posting Plans & Analytics](#6-phase-2--posting-plans--analytics)
7. [Phase 3 — Intelligence Layer](#7-phase-3--intelligence-layer)
8. [Phase 4 — Scale & Monetisation](#8-phase-4--scale--monetisation)
9. [Technology Stack](#9-technology-stack)
10. [External APIs](#10-external-apis)
11. [Data Model](#11-data-model)
12. [Build Timeline](#12-build-timeline)
13. [Risks & Mitigations](#13-risks--mitigations)
14. [Appendix](#14-appendix)

---

# 1. Executive Summary

> **Product Vision**
>
> PostCraft is an MCP server that transforms how creators, businesses, and agencies **plan** social media content. It generates platform-perfect structured ideas for six platforms, builds **suggested** calendars and **where-to-post** guidance (never auto-posting), pulls analytics when you paste links to posts you published yourself, and adapts the next cycle using real performance data — all surfaced through Prefab.

## 1.1 The Problem

Consistent, high-quality social media presence is table stakes in 2026. Yet for the majority of businesses and creators without a dedicated social media team, it remains one of the most time-consuming and inconsistently executed activities they do. The gap is not creativity — it is the operational overhead of doing it every single day, across multiple platforms, each with different formats and rules.

| Pain Point | Current State | PostCraft Solution |
|---|---|---|
| Content creation | 2–4 hours per week, manually per platform | Structured ideas for any platform in seconds |
| Platform formatting | Each platform has different specs — creators forget | Platform-enforced content schemas per generation |
| Planning what goes where | Guessing which platform each idea belongs on | A clear **posting plan**: suggested dates, times, and platform mix across all channels |
| Performance tracking | Log into each platform separately | Unified analytics dashboard in Prefab |
| Improvement | Guesswork on what to post next | Adaptive generation using real engagement data |

## 1.2 Target Users

| Segment | Who They Are | Primary Use Case |
|---|---|---|
| **Solo Creators** | YouTubers, podcasters, coaches with 5k–500k followers | Repurpose long-form content into daily social posts across platforms |
| **SMBs** | Local restaurants, salons, D2C brands, clinics | Stay consistently active without hiring a social media manager |
| **Agencies** | Content agencies managing 5–50 client accounts | Scale content production for clients without scaling headcount |
| **Indie Hackers** | Solo product builders growing in public | Document their build journey consistently across platforms |

## 1.3 Design Principles

- **Content first, plan second.** Generation is always Phase 1. The human reviews ideas, then PostCraft proposes **when and where** to post — the human publishes natively on each app.
- **Configurable count, always.** No hardcoded "30 posts". The user always sets the count explicitly.
- **Platform-native content.** Every idea is formatted to the exact spec of its target platform — not a generic caption adapted after the fact.
- **Prefab is the only UI.** There is no terminal output for users to read. Everything surfaces in a Prefab dashboard panel.
- **Never auto-post.** PostCraft does not call publish endpoints. Outputs are copy-ready assets plus a suggested calendar and checklist so you post everywhere yourself.
- **Read-only analytics scopes.** Platform APIs are used for metrics and insights where needed — not for publishing on your behalf.

---

# 2. MCP Architecture

## 2.1 Overview

PostCraft is built as an MCP server with tools organised across phases. **Publishing is always manual** — the server never calls a platform's "create post" API. The Claude agent orchestrates tools from a single user prompt. Each tool is independent, testable, and can be called selectively.

> **Architecture Pattern**
>
> `User Prompt → Claude Agent → MCP Server (Node.js/TypeScript) → Platform APIs + Prefab`
>
> The server exposes tools over stdio transport. Claude decides the order and parameters. Results from one tool feed into the next as structured JSON. All final outputs push to Prefab.

## 2.2 All MCP Tools

### Phase 1 — Content Generation

| Tool | Purpose | Input | Output |
|---|---|---|---|
| **`generate_content_ideas`** | Core generation tool. Takes brand brief, platform, topic, and count. Calls Claude API. Returns N structured content objects formatted to the platform's exact spec. | platform, topic, count, content_type, tone_override, avoid_topics, reference_url | N idea objects + Prefab push |
| **`get_platform_formats`** | Returns allowed content types, character limits, field requirements, and formatting rules for a platform. Called before generation to validate. | platform | Format spec JSON |
| **`save_content_library`** | CRUD on `content-library.json`. Saves, retrieves, updates, and deletes idea sets. Supports tagging, filtering, and marking ideas as used. | operation, platform, topic, ideas[] | Updated library + Prefab push |
| **`update_brand_config`** | Reads and writes `brand-config.json`. Updates tone, platforms, content pillars, topic lists. Validates before writing. | field, value (or full config object) | Updated config + Prefab config panel |
| **`push_to_prefab`** | Re-pushes any saved idea set, config, or analytics to Prefab. Useful for dashboard refreshes without re-generating. | idea_set_id or panel_type | Prefab panel refresh confirmation |

### Phase 2 — Posting Plans & Analytics

| Tool | Purpose | Input | Output |
|---|---|---|---|
| **`build_posting_schedule`** | Maps approved ideas to **suggested** date/time slots per platform, using research-based defaults and `times-config.json` + brand overrides. Produces a full **posting plan** (calendar + per-slot copy of what to publish where). **Does not publish.** | ideas[], platforms[], start_date, horizon_days | Schedule JSON + Prefab calendar / checklist panels |
| **`suggest_cross_platform_distribution`** | Given a topic or idea set, proposes **how to spread content across platforms** — which formats, sequencing (e.g. IG carousel Monday → X thread Tuesday → LinkedIn Wednesday), and repurposing angles. | topic or idea_set_id, platforms[] | Distribution plan JSON + Prefab summary card |
| **`fetch_post_analytics`** | Fetches engagement metrics for a **single** post by URL or post ID (after the user has published it manually). | post_url or post_id, platform | Metrics object + Prefab analytics card |
| **`fetch_account_analytics`** | Fetches account-level stats: recent posts, average engagement rate, follower trend, top N posts. | account_handle, platform, days | Account summary + Prefab overview panel |

### Phase 3 — Intelligence

| Tool | Purpose | Input | Output |
|---|---|---|---|
| **`generate_adaptive_calendar`** | Generates next content cycle using performance data from the previous one. Top performers become examples; bottom performers are avoided. | platform, count, performance_data | N improved idea objects + Prefab push |
| **`repurpose_content`** | Takes a long-form asset (blog URL, YouTube transcript, podcast RSS). Generates derivative social posts for one or more platforms. | source_url or transcript, platforms[], count_per_platform | Multi-platform idea sets + Prefab push |

## 2.3 Tool Execution Flow

**Full content cycle — Phase 1 + 2 (manual publishing):**

```
1.  User prompt: "Generate 8 Instagram carousels about morning skincare, then build a
    2-week posting plan for Instagram, X, and LinkedIn with suggested times"
2.  get_platform_formats('instagram')            → validates carousel spec
3.  generate_content_ideas(...)                    → returns 8 carousel objects
4.  save_content_library(operation='create')       → persists to content-library.json
5.  push_to_prefab(panel_type='content_cards')    → idea cards in Prefab
6.  User reviews in Prefab, selects ideas + platforms
7.  suggest_cross_platform_distribution(...)       → optional: where/when to spread content
8.  build_posting_schedule(...)                    → suggested slots + checklist (no API publish)
9.  push_to_prefab(panel_type='posting_calendar')  → calendar + "post everywhere" checklist in Prefab
10. User publishes manually on each platform using copy from Prefab
11. User pastes published URLs back (or uses mark-posted flow)
12. fetch_post_analytics(post_url, ...)            → metrics after live post exists
13. save_content_library(operation='update')       → attaches analytics to ideas when matched
14. push_to_prefab(panel_type='analytics_card')   → dashboard updated
```

---

# 3. Prefab UI — The Output Surface

All PostCraft output flows into Prefab. There is no terminal output users are expected to read. Every content idea, analytics report, posting plan, and config option surfaces as a Prefab panel.

## 3.1 Why Prefab

- MCP tools produce structured JSON — Prefab turns that JSON into interactive panels with no frontend code
- Users review, copy, tweak, and approve content ideas directly in the dashboard
- Analytics from multiple platforms render as comparable cards side by side
- Prefab's webhook model means the MCP tool pushes data once and the dashboard is always current
- Phase 3 workflow in Prefab: approve/edit ideas before they enter the **suggested** calendar (still no auto-publish)

## 3.2 Dashboard Panels

| Panel | What It Shows | Triggered By |
|---|---|---|
| **Content Idea Cards** | N idea cards for the chosen platform. Each shows: hook/title, full body copy, platform-specific fields, content type badge, and copy-to-clipboard. | `generate_content_ideas` |
| **Posting Plan Calendar** | Grid of **suggested** dates/times per platform with copy previews, export-friendly checklist, and optional ICS export for personal calendar reminders. Status: draft → planned → **posted manually** (user confirms). | `build_posting_schedule`, `push_to_prefab` |
| **Cross-Platform Distribution** | Summary card: which ideas go to which platforms this week, repurposing hooks, and recommended order (e.g. long-form YouTube → clips on X/IG). | `suggest_cross_platform_distribution` |
| **Review Queue** | Ideas awaiting inclusion in a posting plan or edits before planning. Approve / Edit / Regenerate — **does not post.** | `save_content_library`, Prefab |
| **Post Analytics Card** | Engagement metrics for a single post: views/reach, likes, comments, shares, saves, engagement rate, sparkline trend. | `fetch_post_analytics` |
| **Account Overview Panel** | Aggregated stats: total posts analysed, avg engagement rate by platform, top post, recent trend. | `fetch_account_analytics` |
| **Cross-Platform Comparison** | Side-by-side ER comparison across platforms when multiple analytics are loaded. Bar chart by platform, post type, and time of day. | Multiple analytics fetches |
| **Content Library** | Archive of all generated idea sets. Filterable by platform, date, topic. Shows used/unused status. | `save_content_library` |
| **Performance Digest** | Weekly plain-English summary: top post, worst performer, recommendation for next cycle. | Automated weekly trigger |
| **Config Panel** | Shows current brand config. Allows inline editing via `update_brand_config`. | `update_brand_config` |

## 3.3 Prefab Integration Pattern

Each MCP tool ends with a `push_to_prefab()` call that POSTs a structured JSON payload to the Prefab webhook URL. The payload includes a `panel_type` field that maps to a pre-built Prefab component. No frontend code is required — all component definitions live in the Prefab dashboard config.

Content is always saved to `content-library.json` **before** the Prefab push fires. If the webhook is unreachable, content is never lost — the next tool call will retry the push.

---

# 4. Platform Coverage

PostCraft supports six platforms. Each has a distinct content schema enforced during generation and (in Phase 2) **read-only** analytics APIs after you publish manually.

## 4.1 Platform Content Specifications

| Platform | Content Types | Key Limits | Structured Output Fields |
|---|---|---|---|
| **YouTube** | Video idea, Short idea, Community post | Title: 60 chars · Description: 5,000 chars · Tags: 500 chars | title, description, tags[], thumbnail_concept, chapters[], cta, target_duration_min, hook_script_line |
| **Instagram** | Feed post, Carousel, Reel idea, Story idea | Caption: 2,200 chars · Hashtags: 30 max | hook, caption_body, hashtags[], content_type, slide_count (carousel), audio_suggestion (reel), cta |
| **X (Twitter)** | Single tweet, Thread | Tweet: 280 chars · Thread: up to 25 tweets | tweet_text (or thread[]), hook_tweet, hashtags[] (max 2), cta_tweet |
| **Reddit** | Text post, Link post, Comment idea | Title: 300 chars · Body: 40,000 chars | subreddit_suggestion, title, body, post_type, flair_suggestion, tldr, engagement_hook |
| **LinkedIn** | Article, Post, Document post | Post: 3,000 chars · Article: 125,000 chars | headline, body, content_type, cta, hashtags[] (max 5), target_audience_note |
| **Facebook** | Post, Carousel, Event post | Caption: 63,206 chars (effective: 400) | caption, content_type, hashtags[], link_preview, cta, best_time_note |

## 4.2 Platform Analytics Reference

| Metric | YouTube | Instagram | X (Twitter) | Reddit | LinkedIn | Facebook |
|---|---|---|---|---|---|---|
| **Views / Reach** | Views + impressions | Reach + impressions | Impressions | Upvotes × ratio est. | Impressions | Reach |
| **Likes** | Likes | Likes | Likes | Upvotes | Reactions | Likes + reactions |
| **Comments** | Comments | Comments | Replies | Comment count | Comments | Comments |
| **Shares** | Shares | Shares | Retweets + quotes | Crossposts | Reposts | Shares |
| **Saves / Bookmarks** | N/A | Saves (strong signal) | Bookmarks | N/A | N/A | Saves |
| **Engagement Rate** | (L+C+S)/Views | (L+C+Sv)/Reach | Engagements/Impr. | Upvote ratio % | (R+C+Cl)/Impr. | (L+C+S)/Reach |
| **Platform-unique** | Avg view duration, CTR | Story views, profile visits | Link clicks, quote tweets | Awards, crosspost subs | Follower growth, dwell time | Video views, event responses |
| **Auth required?** | OAuth for watch time | Yes — Business account | No for public tweets | No for public posts | Yes — Page token | Yes — Page token |

---

# 5. Phase 1 — Content Generation Engine

**Weeks 1–5**

## 5.1 Goal

Deliver the complete content generation pipeline. At the end of Phase 1, an agent prompt like *"Generate 8 Instagram carousel ideas about morning skincare"* produces 8 fully structured idea objects, saves them to the local library, and pushes them to a Prefab dashboard where the user can read, copy, and manage them. No posting plans, no analytics yet — just the generation pipeline working end to end.

## 5.2 Feature Breakdown

| Feature | What It Does | Implementation | External API |
|---|---|---|---|
| **Brand Config System** | Reads `brand-config.json` at server startup. Stores: brand name, tone, active platforms, content pillars, topic bank, avoid list, content rules, and language. All generation calls pull from this as default context. | `fs.readFile` on startup, validated with Zod schema. If missing, scaffolds a default config and prompts user to fill it in via Prefab. | None — local file |
| **Platform Format Registry** | Stores the content spec for each platform (character limits, allowed content types, required fields, tone rules). Called before every generation run. | Static JSON registry in `platform-formats.json`. `get_platform_formats` reads and returns the spec. Zod enforces output schema. | None — local registry |
| **Configurable Count Generation** | User specifies count — any positive integer. The tool generates exactly that many ideas. No hardcoded default. | count validated as positive integer via Zod. Claude system prompt: *"Generate exactly {count} ideas. No more, no fewer."* Response validated for count match. | Anthropic Claude API |
| **YouTube Idea Generator** | Video ideas with title, description, tags, thumbnail concept, chapter breakdown, target duration, and hook script line. | Platform-specific system prompt fragment injected from registry. Output parsed against YouTube Zod schema. | Anthropic Claude API |
| **Instagram Idea Generator** | Carousel, Reel, Feed, and Story ideas. Carousel includes full slide-by-slide outline. Caption and hashtag count validated against Instagram limits. | Caption truncated at 2,200 chars with warning. Hashtag count validated: error if >30. | Anthropic Claude API |
| **X (Twitter) Idea Generator** | Single tweets and full thread structures. Each tweet validated at 280 chars. Hook tweet always position 1. | Each thread tweet validated at 280 chars. If over, Claude re-generates with explicit constraint. Max 25 tweets per thread. | Anthropic Claude API |
| **Reddit Idea Generator** | Text and link posts. Tone-corrected to community-native (no promotional language). Subreddit suggestions included. | Reddit tone rules injected: *"Write as a community member. No brand voice. No promotional language."* | Anthropic Claude API |
| **LinkedIn Idea Generator** | Professional posts, document carousels, and article ideas. Tone calibrated for professional context. Hashtag count capped at 5. | LinkedIn tone rules: structured, insight-led, professional credibility framing. | Anthropic Claude API |
| **Facebook Idea Generator** | Posts optimised for Facebook's reach algorithm. Community and conversational framing. Link previews included. | Facebook-specific content rules injected. Caption kept under 400 chars for engagement (despite higher limits). | Anthropic Claude API |
| **Content Library CRUD** | `content-library.json` stores all generated idea sets. Operations: create, read (by ID/platform/date), update (edit, mark as used), delete. | `fs/promises` for atomic JSON reads/writes. UUID per set. Ideas within sets get sequential IDs. Indexed by platform and date. | None — local file |
| **Reference URL Ingestion** | User passes a blog URL, video transcript URL, or article. Tool fetches and parses it, uses it as source material for generating derivative ideas. | node-fetch to retrieve. Cheerio for HTML text extraction. Cleaned text passed to Claude as context. | node-fetch, Cheerio (free npm) |
| **Avoid Topics Enforcement** | User passes topics/keywords to exclude. Post-generation validation scans output and re-generates if forbidden terms appear. | `avoid_topics` array injected into system prompt. Each idea scanned post-generation. Flag + re-generate if found. | None — prompt engineering |
| **Prefab Content Cards** | After every generation run, pushes all N idea cards to Prefab. Each card shows hook, body, platform fields, content type badge, and copy button. | POST to `PREFAB_WEBHOOK_URL` with `panel_type: 'content_cards'`. | Prefab webhook (free) |
| **Prefab Library Panel** | Pushes full content library table to Prefab on demand. Filterable by platform and date. Used/unused status shown. | `save_content_library(operation='list')` + Prefab table component. | Prefab webhook (free) |

## 5.3 Phase 1 Acceptance Criteria

- Agent generates N structured content ideas from a brand brief in under 30 seconds
- Generated ideas pass platform-specific field validation (no missing required fields)
- All ideas saved to `content-library.json` with correct structure
- Prefab content cards panel populated after every generation run
- `avoid_topics` enforcement confirmed: re-generation triggered on forbidden term detection
- No unhandled errors on a clean run

## 5.4 Phase 1 Demo Prompt

> "Generate 7 Instagram carousel ideas about morning skincare routines for PostGlow — a natural skincare brand. Tone: warm and educational. Avoid mentioning competitor brands. Each carousel should have a slide-by-slide outline. Save all ideas to my library and push them to the Prefab dashboard."

**What fires:**
1. `get_platform_formats('instagram')` — validates carousel spec
2. `generate_content_ideas(platform='instagram', topic='morning skincare routines', count=7, content_type='carousel', avoid_topics=['competitor brand names'])` — produces 7 carousel objects
3. `save_content_library(operation='create', ideas=[...])` — saves to library
4. `push_to_prefab(panel_type='content_cards', ...)` — 7 cards appear in Prefab

---

# 6. Phase 2 — Posting Plans & Analytics

**Weeks 6–11**

## 6.1 Goal

Close the loop in two directions — **without automated publishing.** First, turn approved ideas into a **suggested posting schedule** and **cross-platform guidance** so the user knows *what to post, where, and when* across all channels. Second, fetch real engagement data for posts the user has already published (paste URL or ID), including content created long before PostCraft existed.

> **Key design decision — No auto-posting:**
>
> PostCraft **never** calls Meta, X, LinkedIn, Reddit, or YouTube publishing endpoints. The posting plan is a **recommendation layer**: calendar slots, checklists, and copy blocks the user publishes manually in each native app.

> **Key design decision — Analytics for existing posts:**
>
> `fetch_post_analytics` works on any public post you have access to. Paste a URL after you have posted manually.

## 6.2 Posting Plan Features (suggestions only)

| Feature | What It Does | Implementation | External API |
|---|---|---|---|
| **Suggested calendar** | Maps ideas to date/time slots per platform using `times-config.json` + research defaults + optional brand overrides in `brand-config.json`. Outputs a structured schedule JSON for Prefab and optional `.ics` for personal calendar reminders. | Pure local logic + Claude for sequencing hints when requested. **No publish APIs.** | None |
| **Cross-platform distribution** | Proposes how to spread a topic across platforms: format per channel, order (e.g. teaser on X → deep dive on LinkedIn → carousel on IG), and repurposing angles. | `suggest_cross_platform_distribution` builds a plan object; optional Claude pass for narrative rationale. | Anthropic Claude API (optional rationale only) |
| **Review queue → plan** | Ideas move from review into `build_posting_schedule`. User can exclude platforms or dates; rejected ideas flagged for regeneration in Prefab. | Prefab components update `content-library.json` status fields. No polling of publish APIs. | Prefab webhook |
| **"Post everywhere" checklist** | Prefab panel lists each upcoming slot: platform, suggested time, copy button, deep link to the relevant app/site (where applicable). User ticks **Posted manually** when done. | `push_to_prefab(panel_type='posting_checklist')`. Status stored locally. | None |
| **Media attachments (optional)** | User keeps assets in `/media`; schedule entries reference paths. **Upload happens only when the user posts manually** — PostCraft does not upload to platforms. | Paths stored in schedule entries; validation helpers for dimensions per platform doc. | None |
| **Export** | Export posting plan to Markdown checklist or CSV for agencies; optional ICS for calendar apps. | Local generators from schedule JSON. | None |

## 6.3 Analytics Features

| Feature | What It Does | Implementation | External API |
|---|---|---|---|
| **Single Post Analytics — YouTube** | Views, likes, comments, shares, watch time (avg view duration), impressions, CTR, subscriber change from video. | YouTube Data API v3 `videos.list`. Video ID extracted from URL via regex. OAuth required for watch time. | YouTube Data API v3 (free, 10k units/day) |
| **Single Post Analytics — Instagram** | Reach, impressions, likes, comments, saves, shares, engagement rate. Works for Feed, Carousel, and Reels. | Instagram Graph API `/media/{id}/insights`. Media ID extracted from URL via /oembed lookup. Requires Business account. | Instagram Graph API (free with account) |
| **Single Post Analytics — X (Twitter)** | Impressions, engagements, likes, retweets, quotes, replies, link clicks, bookmarks. | X API v2 `/tweets/{id}?tweet.fields=public_metrics`. No auth needed for public tweets. | X API v2 (free basic tier) |
| **Single Post Analytics — Reddit** | Upvotes, upvote ratio, comment count, awards, crosspost count. Top 3 comments by upvotes included. | Reddit JSON API (append `.json` to any Reddit URL — no auth for public posts). | Reddit API / PRAW (free) |
| **Single Post Analytics — LinkedIn** | Impressions, clicks, reactions, comments, reposts, engagement rate, follower growth from post. | LinkedIn Marketing API v2 (insights endpoints where available). Requires Page token for owned content. | LinkedIn Marketing API (free) |
| **Single Post Analytics — Facebook** | Reach, impressions, likes, comments, shares, saves, link clicks, video views. | Meta Graph API insights for Page-owned posts. Requires Page token. | Meta Graph API (free) |
| **Account-Level Analytics — All Platforms** | Account summary: follower count, average engagement rate, top posts, trend over 30 days. Supported for all 6 platforms where APIs allow. | Platform-specific account endpoints. Results aggregated into Prefab overview panels. | Platform APIs |
| **Prefab Analytics Card** | After every analytics fetch, pushes a metrics card to Prefab with all metrics, engagement rate highlighted, and a comparison badge (above/below account average). | `push_to_prefab(panel_type='analytics_card')`. Comparison badge computed locally. | Prefab webhook (free) |
| **Cross-Platform Comparison** | When analytics from multiple platforms are loaded, Prefab renders a side-by-side ER comparison panel. | Session analytics buffer (`Map<post_id, metrics>`). When >1 platform present, `panel_type: 'cross_platform_comparison'` sent. | Prefab webhook (free) |
| **Analytics → Library Linkage** | If an analysed post matches a PostCraft-generated idea (by platform + topic + date), analytics are written back to that idea's record. | Fuzzy match by platform + topic tags + date window (±7 days). `save_content_library(operation='update', performance={...})`. | None — local |
| **Batch Analytics** | User provides a list of up to 10 post URLs for the same platform. Fetches all in sequence, pushes a comparison table to Prefab. | Sequential fetch with 500ms delay between calls (rate limit aware). Single Prefab table push at end. | Platform APIs |
| **Mark posted + optional reminder** | User marks a checklist row as posted and may paste the live URL. Optional **reminder** (email/Prefab/local cron) nudges analytics fetch after ~48h — still **user-triggered** fetch. | Updates `content-library.json`; optional `node-cron` for reminders only (no publish). | Optional notification channels |
| **Weekly Performance Digest** | Every Monday, generates a plain-English summary of performance data already in the library or fetched that week, pushed to Prefab as a digest card. | Claude API call with available metrics. | Anthropic Claude API |

## 6.4 Phase 2 Demo Prompts

> **Demo A — Posting plan everywhere (no publishing)**
>
> "I've picked 5 carousel ideas and 3 X threads. Build a **suggested** 2-week posting plan across Instagram, X, and LinkedIn with optimal slots, a cross-platform distribution summary, and push the calendar + checklist to Prefab."

> **Demo B — Analytics for an existing post**
>
> "Fetch analytics for this YouTube video I posted 3 months ago: https://youtu.be/abc123 and push the results to my Prefab dashboard."

> **Demo C — Account overview**
>
> "Give me an overview of my Instagram account @postglow_skin — follower count, average engagement rate on my last 10 posts, and my top performing post. Show it in Prefab."

---

# 7. Phase 3 — Intelligence Layer

**Weeks 12–19**

## 7.1 Goal

Make the system learn. Use two or more months of performance data to generate progressively better content, personalise **suggested** posting windows per account, repurpose long-form assets, and support multiple brand accounts — still **without** auto-publishing.

## 7.2 Feature Breakdown

| Feature | What It Does | Implementation | External API |
|---|---|---|---|
| **Adaptive Content Generation** | Before generating the next cycle, fetches the top and bottom 5 posts from the previous month. Passes them to Claude as examples and anti-examples for the next generation. | Retrieves ranked posts from `content-library.json`. Constructs few-shot examples prompt: *"Generate content in the style of these top 5. Avoid patterns from these bottom 5."* | Anthropic Claude API |
| **Personalised suggested windows** | After 4+ weeks of data, analyses engagement by day-of-week and hour-of-day per platform. Refines the **default lookup** used by `build_posting_schedule` with account-specific optimal windows. | Statistical mode of top-10 post times per platform from library analytics. Requires minimum 20 posts per platform to activate. | None |
| **Content Performance Scoring** | Each post gets an aggregate score (0–100) from: engagement rate vs account average, save rate, share rate, and comment rate. Score stored in library. | Weighted formula: `(ER × 0.35) + (save_rate × 0.35) + (share_rate × 0.20) + (comment_rate × 0.10) × 100`. | None |
| **Content Repurposing** | Takes a long-form asset (blog URL, YouTube video transcript, podcast RSS) and generates a full set of derivative social posts for one or more platforms. | Web fetch for blog/transcript. Claude API for derivative generation. YouTube transcript via yt-dlp (free, local). | Anthropic Claude API, yt-dlp |
| **Trending Hashtag Detection** | Before generating each post, fetches currently trending hashtags in the topic category. Blends 2–3 trending tags with evergreen ones. | RapidAPI Trending Hashtags (free tier: 500 req/month). Falls back to static list if limit reached. | RapidAPI Trending Hashtags |
| **AI Image Generation** | For posts without user-supplied creative, optionally generates social-ready images via Stability AI for the user to **download and attach when posting manually**. | Stability AI API (free: 25 images/month). Image resized to platform spec for reference. | Stability AI API |
| **Canva Integration** | Generates Canva design links pre-populated with post copy. User clicks through to customise the visual. | Canva Connect API (free tier). Template ID mapped to post format type. | Canva Connect API (free) |
| **Competitor Content Monitoring** | Fetches top-performing recent posts from specified competitor accounts (public data only). Surfaces their winning content patterns as strategy inputs for next generation. | Meta Graph API public content endpoint. Reddit public JSON API for community strategy research. **Read-only.** | Meta Graph API |
| **Caption variant suggestions** | For high-priority slots, generates 2 caption variants for **manual** A/B testing; user publishes one or both on the platform and pastes URLs back for analytics comparison. | Stored on idea record as `variant_a` / `variant_b`. No audience-split publishing via API. | None |
| **Multi-Account Support** | Supports multiple brand profiles with separate configs, libraries, and **posting plans**. Switchable in the agent prompt. | Account selector argument on all MCP tools. Separate file namespacing per `account_id`. | None |
| **CSV Export** | Exports full content library to CSV: caption, platform, posted time, reach, engagement rate, score. For reporting to clients. | Node.js `csv-writer` package. `save_content_library(operation='export')`. | None |

---

# 8. Phase 4 — Scale & Monetisation

**Weeks 20–28**

## 8.1 Goal

Package PostCraft into a product that can be sold. Build agency-grade features — white-labelling, client workspaces, billing — and wrap the whole thing in a web UI that non-technical users can operate without touching the MCP layer directly.

## 8.2 Feature Breakdown

| Feature | What It Does | Implementation | External API |
|---|---|---|---|
| **Web UI (Non-Technical Users)** | A Next.js web app wrapping all MCP tool calls in a clean UI. Users set up their brand, generate content, review, approve, and see analytics — without touching Claude Desktop or a terminal. | Next.js 14 App Router. MCP server called via REST bridge. Hosted on Vercel (free tier). | Vercel (free) |
| **Agency Client Workspaces** | Each agency gets a workspace with multiple client sub-accounts. Clients get view-only access to their calendar and analytics. Agency retains full generation control. | Workspace model in data layer. Role-based access: owner, editor, viewer. Per-client API key namespacing. | None |
| **White-Label Dashboard** | Agency brands the Prefab dashboard with their own logo, colours, and domain. Client-facing reports show agency branding. | Prefab theme config API. Custom CSS injection. CNAME support. | Prefab Pro (paid) |
| **Stripe Subscription Billing** | In-app subscription management. Tier enforcement: post limits, account limits, feature gating. Webhook handles upgrade/downgrade/cancellation. | Stripe Billing API + Webhooks. Metered billing for image generation. | Stripe API |
| **Custom Content Rules Engine** | Agency defines rules governing all generated content: *"Never mention competitors"*, *"Always include a CTA"*, *"Never post on Sundays"*. Rules injected into every generation prompt. | Rules stored per account in `content-rules.json`. Injected as system prompt constraints. | None |
| **Bulk Content Import** | Upload a CSV of existing posts. System classifies each by type, scores against performance data, and bootstraps the brand voice model for a new account. | CSV parser + Claude classification per row. Bootstraps `content-library.json` instantly. | Anthropic Claude API |
| **Slack / Email Alerts** | Weekly performance digest, post approval requests, and billing alerts pushed to Slack or email. | Slack Incoming Webhooks (free). SendGrid free tier (100 emails/day). | Slack API, SendGrid |
| **REST API Access Tier** | Exposes PostCraft's content generation and **posting plans** as a REST API for agencies and developers. | Express.js REST wrapper around MCP tools. API key auth. Rate-limited by subscription tier. | None |

## 8.3 Pricing Tiers

|  | Free | Creator — ₹599/mo | Business — ₹1,799/mo | Agency — ₹6,999/mo |
|---|---|---|---|---|
| Platforms | 1 | 4 | 6 | 6 per client |
| Ideas / month | 15 | 100 | Unlimited | Unlimited |
| **Posting plans / month** | 1 | Unlimited | Unlimited | Unlimited |
| AI Image generation | No | No | 5/month | 25/month |
| Analytics | Basic | Full | Full + A/B | Full + A/B + Reports |
| Brand accounts | 1 | 1 | 3 | 20 client accounts |
| Approval queue | No | Yes | Yes | Yes + client view |
| White-label | No | No | No | Yes |

---

# 9. Technology Stack

## 9.1 Core Stack

| Layer | Technology | Why This Choice | Alternative |
|---|---|---|---|
| **MCP Runtime** | Node.js 20 + TypeScript | MCP SDK is TypeScript-native. Async model handles concurrent API calls cleanly. Type safety catches API contract errors at compile time. | Python (MCP SDK available but TS is better supported for production) |
| **MCP SDK** | @modelcontextprotocol/sdk v1.x | Official SDK. Tool registration, schema validation, stdio transport, and protocol compliance built-in. | Manual stdio MCP protocol |
| **Schema Validation** | Zod | Validates all MCP tool inputs AND external API responses. TypeScript types auto-derived. Catches contract errors at parse time. | Joi, Yup |
| **AI Generation** | Anthropic Claude API (claude-sonnet-4-20250514) | Best structured JSON output quality. Consistent instruction-following for platform schemas. | GPT-4o (comparable), Gemini 1.5 Pro |
| **Cron / reminders (Phase 2+)** | node-cron | Optional weekly digest trigger or "consider fetching analytics" reminders — never invokes publish APIs. | Bull/BullMQ for heavier job queues |
| **HTTP Client** | node-fetch + got | node-fetch for simple API calls. got for calls requiring retry, timeout, and rate-limit-aware backoff. | axios |
| **HTML Parsing** | Cheerio | Reference URL ingestion — scrapes article/blog text. Lightweight jQuery-style API. | Playwright (overkill for static pages) |
| **Local Storage (Phase 1–2)** | JSON files (fs/promises) | Zero setup. Human-readable. Perfect for single-user MCP server. | SQLite (Phase 3 migration path) |
| **Database (Phase 3+)** | SQLite via better-sqlite3 | When multi-account and query complexity demands it. File-based, no server process. | PostgreSQL (if cloud-hosted) |
| **Reddit API** | PRAW / Reddit JSON API | Reddit JSON API requires no key for public posts (append `.json` to any URL). PRAW for authenticated operations. | Snoowrap (JS, less maintained) |
| **Scheduling Queue (Phase 4)** | BullMQ + Redis | Optional background jobs for digests, reminders, large exports — **not** for publishing posts. | Inngest, Temporal |
| **Web Framework (Phase 4)** | Next.js 14 (App Router) | Full-stack React. API routes as REST bridge to MCP server. Excellent Vercel deployment. | Remix, SvelteKit |
| **Styling (Phase 4)** | Tailwind CSS + shadcn/ui | Dashboard-grade components (tables, charts, modals) available out of the box. | Chakra UI, MUI |
| **Payments (Phase 4)** | Stripe | Industry standard. Excellent subscription management and metered billing. | Razorpay (India-first alternative) |
| **UI Layer** | Prefab (all output) | No frontend code to write. Webhook-driven panels. Handles dashboard layout and copy actions. | Custom React dashboard |

---

# 10. External APIs

## 10.1 API Dependency Matrix

| API / Service | Free Tier | Used For | Phase | Priority |
|---|---|---|---|---|
| **Anthropic Claude API** | $5 free credit on signup | Content generation for all platforms. Adaptive generation. Performance digest. Repurposing. | Phase 1+ | Must-Have |
| **Meta Graph API** | Free with developer account + Page | Instagram + Facebook **insights** and page-level metrics. Public competitor page content (read). **Not used to publish posts.** | Phase 2+ | Must-Have |
| **X API v2** | Free tier for public read | Public tweet / account metrics. **Not used to post tweets.** | Phase 2+ | Must-Have |
| **YouTube Data API v3** | Free — 10,000 units/day | Video analytics (views, likes, watch time, CTR). Channel stats. **Read-only.** | Phase 2+ | Must-Have |
| **LinkedIn Marketing API** | Free with Page + app approval | Post and account **insights** for owned content. Approval takes 3–5 days — apply on Day 1. **Not used to publish via PostCraft.** | Phase 2+ | Must-Have |
| **Reddit JSON API / PRAW** | Free — no key for public posts | Post and subreddit metrics (read). | Phase 2+ | Must-Have |
| **Prefab Webhook** | Free tier available | All UI output: content cards, analytics, posting plan calendar, checklists, library, config. | Phase 1+ | Must-Have |
| **Canva Connect API** | Free tier | Pre-populate Canva templates with post copy. User clicks to customise. | Phase 3 | Should-Have |
| **Stability AI API** | Free: 25 images/month | AI-generated images for posts without user-supplied media. | Phase 3 | Should-Have |
| **RapidAPI Trending Hashtags** | Free: 500 req/month | Trending hashtags by topic, blended with evergreen tags at generation time. | Phase 3 | Should-Have |
| **Stripe** | Free to integrate (2.9% + 30¢/transaction) | Subscription management, plan enforcement, metered billing. | Phase 4 | Phase 4 Only |
| **SendGrid** | Free: 100 emails/day | Weekly digest emails, billing alerts. | Phase 4 | Phase 4 Only |

## 10.2 API Auth Requirements

| Platform | Auth Type | Scope Needed | Setup Notes |
|---|---|---|---|
| **YouTube** | OAuth 2.0 (watch time) or API Key (public stats) | youtube.readonly | Google Cloud Console → Enable YouTube Data API → Create OAuth credentials. API key sufficient for public stats. |
| **Instagram** | Meta OAuth 2.0 — User Access Token | instagram_basic, instagram_manage_insights | Business/Creator account required. Meta developer app → Add Instagram product → Long-lived token (60-day expiry, must refresh). |
| **Facebook** | Meta OAuth 2.0 — Page Access Token | `pages_read_engagement` (and other **read** scopes as required for insights) | Same Meta developer app as Instagram. **No `publish` scope in PostCraft default config.** |
| **X (Twitter)** | Bearer Token (typical) | `tweet.read`, `users.read` | Sufficient for public and many authenticated **read** metrics. **Do not enable `tweet.write` for PostCraft's default deployment.** |
| **LinkedIn** | OAuth 2.0 — Organisation Token | **Read** scopes for analytics / organisation shares as required by product | PostCraft does not require `w_organization_social` for publishing in the default product model. |
| **Reddit** | None for public JSON | N/A for public post metrics | Append `.json` to public URLs. **No posting credentials required** for analytics-only use. |
| **Prefab** | Webhook URL (pre-authenticated) | POST to webhook endpoint | Create Prefab account → New dashboard → Add webhook source → Copy URL to `.env`. |

## 10.3 Environment Variables

| Variable | Phase | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | Phase 1 | Claude API — content generation and analysis |
| `PREFAB_WEBHOOK_URL` | Phase 1 | Prefab dashboard webhook — all UI pushes |
| `META_ACCESS_TOKEN` | Phase 2 | Meta Graph API — **insights and read** operations (optional; only if using connected-account analytics) |
| `META_PAGE_ID` | Phase 2 | Target Facebook Page ID (for Page insights) |
| `META_IG_ACCOUNT_ID` | Phase 2 | Target Instagram Business Account ID (for media insights) |
| `YOUTUBE_API_KEY` | Phase 2 | YouTube Data API v3 — public stats |
| `YOUTUBE_CLIENT_ID` + `YOUTUBE_CLIENT_SECRET` | Phase 2 | OAuth credentials for watch time metrics (optional) |
| `X_BEARER_TOKEN` | Phase 2 | X API v2 — read metrics (typical) |
| `LINKEDIN_ACCESS_TOKEN` | Phase 2 | LinkedIn — **read/analytics** token if using Marketing API insights |
| `LINKEDIN_ORG_ID` | Phase 2 | LinkedIn Page organisation ID |
| `REDDIT_CLIENT_ID` + `REDDIT_SECRET` | Phase 2 | Optional — only if building authenticated Reddit features beyond public JSON |
| `STABILITY_API_KEY` | Phase 3 | Stability AI — image generation |
| `RAPIDAPI_KEY` | Phase 3 | RapidAPI — trending hashtags |
| `STRIPE_SECRET_KEY` | Phase 4 | Stripe — subscription billing |
| `SENDGRID_API_KEY` | Phase 4 | SendGrid — email alerts and digests |

---

# 11. Data Model

## 11.1 content-library.json — Idea Set Record

```json
{
  "id": "set_abc123",
  "created_at": "2026-05-01T10:30:00Z",
  "account_id": "postglow",
  "platform": "instagram",
  "topic": "morning skincare routines",
  "count": 7,
  "tone_used": "warm, educational",
  "content_type": "carousel",
  "reference_url": null,
  "avoid_topics": ["competitor brand names"],
  "ideas": [],
  "usage": {
    "idea_001": {
      "status": "planned",
      "suggested_at": "2026-05-10T09:00:00+05:30",
      "posted_manually_at": "2026-05-10T09:15:00Z",
      "live_post_url": "https://instagram.com/p/xyz"
    },
    "idea_002": { "status": "unused" }
  },
  "analytics": {
    "idea_001": {
      "fetched_at": "2026-05-12T08:00:00Z",
      "reach": 4820,
      "likes": 312,
      "saves": 190,
      "comments": 28,
      "shares": 45,
      "engagement_rate": 0.0646,
      "performance_score": 81
    }
  }
}
```

> Each entry in `ideas` is a full platform-specific content object. See section 4 for per-platform schemas.

## 11.2 brand-config.json

```json
{
  "account_id": "postglow",
  "brand_name": "PostGlow",
  "tone": "warm, educational, empowering",
  "language": "en",
  "products": ["vitamin C serum", "hyaluronic moisturiser"],
  "target_audience": "Women 25-40, skin-conscious, ingredient-aware",
  "active_platforms": ["youtube", "instagram", "x", "reddit", "linkedin", "facebook"],
  "content_pillars": ["ingredient_spotlight", "skin_tips", "product_education", "community_qa"],
  "content_mix": { "educational": 0.7, "promotional": 0.2, "personal": 0.1 },
  "topic_bank": ["morning routines", "ingredient science", "skincare myths", "seasonal care"],
  "avoid_topics": ["competitor brand names", "medical claims", "before/after language"],
  "posting_times": {
    "instagram": ["09:00", "19:00"],
    "linkedin": ["08:00", "17:00"],
    "x": ["08:00", "20:00"],
    "youtube": ["15:00"],
    "reddit": ["10:00"],
    "facebook": ["10:00", "20:00"]
  },
  "content_rules": [
    "Always end Instagram posts with a question",
    "Reddit posts must not use brand voice — community member tone only",
    "YouTube titles must be curiosity-gap or specific result format",
    "Never mention competitor brand names"
  ],
  "platform_overrides": {
    "reddit": { "tone": "casual, community-native, zero promotional language" },
    "youtube": { "tone": "educational, structured, searchable" },
    "linkedin": { "tone": "professional, insight-led, credibility-first" }
  }
}
```

---

# 12. Build Timeline

## 12.1 Phase Summary

| Phase | Timeline | Key Deliverable | Done When |
|---|---|---|---|
| **Phase 1 — Content Engine** | Weeks 1–5 | Content generation for all 6 platforms, configurable count, local library, Prefab content cards and library panel | User generates 5 YouTube ideas + 8 Instagram carousels from one prompt and sees both in Prefab |
| **Phase 2 — Posting plans & Analytics** | Weeks 6–11 | `build_posting_schedule` + `suggest_cross_platform_distribution` for all 6 platforms. Read-only analytics. Prefab calendar + checklist. | User gets a 2-week **suggested** plan across channels and fetches analytics for a 3-month-old YouTube URL — both in Prefab |
| **Phase 3 — Intelligence** | Weeks 12–19 | Adaptive generation using performance data, content repurposing, personalised timing, multi-account, AI image generation | Month 2 content outperforms Month 1 by >10% average engagement across accounts |
| **Phase 4 — Scale** | Weeks 20–28 | Web UI, agency workspaces, Stripe billing, white-label Prefab, REST API | First paying customer on Business or Agency plan |

## 12.2 Phase 1 — Week by Week

| Week | Milestone |
|---|---|
| **1** | MCP server scaffold — all tools registered with Zod schemas, stdio transport confirmed in Claude Desktop, `brand-config.json` validated on startup, Prefab webhook tested with dummy payload |
| **2** | `platform-formats.json` built for all 6 platforms. `get_platform_formats` working. `generate_content_ideas` working for Instagram (baseline). Configurable count confirmed: 1, 5, 10 all produce exact count. |
| **3** | YouTube, X, LinkedIn generators added. Platform Zod schemas enforced. `reference_url` ingestion working (Cheerio → Claude context). `avoid_topics` enforcement with post-gen validation. |
| **4** | Reddit and Facebook generators added. `save_content_library` CRUD fully working. JSON read/write/update/delete tested. Prefab `content_cards` panel showing real generated ideas. |
| **5** | Prefab library panel working. `update_brand_config` working. `push_to_prefab` standalone tool working. End-to-end test: full Phase 1 demo prompt → all tools fire → Prefab shows content cards + library. |

## 12.3 Phase 2 — Week by Week

| Week | Milestone |
|---|---|
| **6** | `build_posting_schedule` + `suggest_cross_platform_distribution` working. Prefab posting calendar + cross-platform distribution cards + manual checklist (copy buttons). **Confirm no publish API calls in codebase.** |
| **7** | Optimal time lookup (`times-config.json`) integrated with schedule builder. Optional ICS export for personal calendar reminders. |
| **8** | Optional `node-cron` for digest/reminder jobs only (no publish). Mark-posted + paste URL flow wired to library. |
| **9** | YouTube + X + Reddit `fetch_post_analytics` working. All pushing to Prefab `analytics_card`. Batch analytics (up to 10 URLs) working. |
| **10** | Instagram + LinkedIn + Facebook `fetch_post_analytics` working. `fetch_account_analytics` working for all 6 platforms. |
| **11** | Cross-platform comparison panel working. Analytics-to-library linkage (fuzzy match). Weekly digest Claude call + Prefab digest card. End-to-end Phase 2 test passes. |

## 12.4 Phase 3 — Week by Week

| Week | Milestone |
|---|---|
| **12–13** | Performance scoring implemented. `generate_adaptive_calendar` using top/bottom performers as few-shot examples. |
| **14** | Personalised posting times activated for accounts with 20+ posts per platform. |
| **15** | `repurpose_content` tool working — blog URL → multi-platform idea set. yt-dlp transcript ingestion working. |
| **16** | Trending hashtag detection (RapidAPI). Canva Connect integration. |
| **17** | AI image generation (Stability AI) for **download & manual attach**. Dual caption variant suggestions for manual A/B. |
| **18–19** | Multi-account support + competitor monitoring. CSV export. Phase 3 full demo passing. |

---

# 13. Risks & Mitigations

| Risk | Level | Description | Mitigation |
|---|---|---|---|
| **Meta API changes** | High | Meta frequently deprecates API versions. A version change can break **insights** and read calls overnight. | Pin API version in all calls. Subscribe to Meta changelog. Abstract all Meta calls behind an adapter layer. |
| **X API pricing instability** | High | X has made API access unpredictable. **Read** access for metrics may change. | X treated as one of many platforms. Clear "X API unavailable" message in Prefab. |
| **Instagram token expiry** | High | Meta long-lived tokens expire after 60 days. Silent expiry can break **connected-account insights** fetches. | Weekly cron checks token expiry date. 10-day warning in Prefab config panel. Token refresh flow documented. |
| **Feature creep: auto-posting** | Med | Stakeholders may request "just one auto-post" — undermines trust and compliance. | **Non-goal** documented in PRD. All platform `write` scopes off by default. Code review gate for any `publish` PR. |
| **Platform spam / policy (user behaviour)** | Med | Even with manual posting, high-frequency or off-brand content can harm accounts. | Posting plan includes **suggested** max posts per day per platform. Content rules in `brand-config.json`. |
| **LinkedIn API approval delay** | Med | LinkedIn requires manual app review (3–5 days). Access is not instant. | Apply on Day 1 of Phase 2 setup. Use CSV export + manual posting as temporary workaround during approval. |
| **YouTube quota (10k units/day)** | Med | Complex API requests burn through daily quota faster than expected. | Cache analytics results in `content-library.json`. Only re-fetch if >24hrs stale. Warn user if daily quota >70% consumed. |
| **Content quality variance** | Med | Generated content quality varies with vague prompts. Broad topics produce weaker output. | Topic specificity guidance in Prefab config panel. Claude asks for clarification if topic is too broad. Example topics in `brand-config.json`. |
| **Reddit rate limits** | Low | Reddit JSON API allows ~60 requests/minute without auth. Easy to hit during batch analytics. | 500ms delay between batch calls. PRAW handles rate limiting automatically when auth is used. |
| **Prefab webhook downtime** | Low | If Prefab is unreachable, tools appear to fail even though content was generated successfully. | Content always saved to `content-library.json` BEFORE `push_to_prefab` fires. Content is never lost on webhook failure. |

---

# 14. Appendix

## 14.1 Folder Structure

```text
postcraft-mcp/
├── src/
│   ├── server.ts                      ← MCP server entry + tool registration
│   ├── tools/
│   │   ├── generateContentIdeas.ts    ← Phase 1 — core generation tool
│   │   ├── getPlatformFormats.ts      ← Phase 1 — format registry lookup
│   │   ├── saveContentLibrary.ts      ← Phase 1 — CRUD on content library
│   │   ├── updateBrandConfig.ts       ← Phase 1 — config management
│   │   ├── pushToPrefab.ts            ← Phase 1 — Prefab UI push (used by all tools)
│   │   ├── buildPostingSchedule.ts       ← Phase 2 — suggested calendar + checklist (no publish)
│   │   ├── suggestCrossPlatformDistribution.ts ← Phase 2 — where/when to post across platforms
│   │   ├── fetchPostAnalytics.ts      ← Phase 2 — single post metrics
│   │   ├── fetchAccountAnalytics.ts   ← Phase 2 — account-level summary
│   │   ├── generateAdaptiveCalendar.ts ← Phase 3 — performance-driven generation
│   │   └── repurposeContent.ts        ← Phase 3 — long-form to social posts
│   ├── platforms/
│   │   ├── youtube.ts                 ← YouTube Data API v3 client
│   │   ├── instagram.ts               ← Instagram Graph API client
│   │   ├── facebook.ts                ← Facebook Graph API client
│   │   ├── twitter.ts                 ← X API v2 client
│   │   ├── linkedin.ts                ← LinkedIn Marketing API client
│   │   └── reddit.ts                  ← Reddit JSON API / PRAW client
│   ├── schemas/
│   │   ├── youtubeSchema.ts           ← Zod schema for YT content objects
│   │   ├── instagramSchema.ts         ← Zod schema for IG content objects
│   │   ├── facebookSchema.ts          ← Zod schema for FB content objects
│   │   ├── xSchema.ts                 ← Zod schema for X content objects
│   │   ├── linkedinSchema.ts          ← Zod schema for LinkedIn content objects
│   │   └── redditSchema.ts            ← Zod schema for Reddit content objects
│   └── utils/
│       ├── fileStore.ts               ← JSON CRUD helpers
│       ├── prefab.ts                  ← Prefab push helper
│       ├── urlParser.ts               ← Post ID extraction from URLs
│       └── scheduler.ts               ← Optional cron: digests / reminders only (no publish)
├── data/
│   ├── accounts/
│   │   └── postglow/
│   │       ├── brand-config.json      ← Brand configuration (user edits)
│   │       ├── content-library.json   ← All idea sets + analytics
│   │       └── media/                 ← User-supplied images
│   ├── platform-formats.json          ← Platform spec registry
│   └── times-config.json              ← Default suggested-slot lookup for posting plans
├── .env.example                       ← All required env vars documented
├── claude_desktop_config.json         ← Drop into Claude Desktop config
├── package.json
└── tsconfig.json
```

## 14.2 Claude Desktop Config

```json
{
  "mcpServers": {
    "postcraft": {
      "command": "node",
      "args": ["/absolute/path/to/postcraft-mcp/dist/server.ts"],
      "env": {
        "ANTHROPIC_API_KEY": "your-key-here"
      }
    }
  }
}
```

## 14.3 The Full Demo Prompt — All Tools

> **Master Demo Prompt (fires all Phase 1 + 2 tools)**
>
> "My brand is PostGlow — natural skincare, warm educational tone, targeting women 25–40. Do the following:
> 1. Generate 5 Instagram carousel ideas and 3 YouTube video ideas about vitamin C serums
> 2. Save all ideas to my content library and push them to Prefab for review
> 3. Build a **suggested** 2-week posting plan for Instagram + X + LinkedIn from my approved ideas — optimal slots and a 'post everywhere' checklist — and push to Prefab (**do not publish**)  
> 4. Fetch analytics for this YouTube video I posted last month: https://youtu.be/abc123  
> 5. Fetch an overview of my Instagram account @postglow_skin — last 10 posts engagement  
> 6. Push everything to my Prefab dashboard side by side"

*This prompt triggers: `generate_content_ideas` (×2) → `save_content_library` (×2) → `push_to_prefab` (content cards) → `suggest_cross_platform_distribution` → `build_posting_schedule` → `push_to_prefab` (calendar + checklist) → `fetch_post_analytics` (YouTube URL) → `fetch_account_analytics` (Instagram) → `push_to_prefab` (analytics + overview).*

---

*PostCraft MCP v3.1 · Content generation, posting plans & analytics (manual publishing only) · May 2026 · Internal Use Only*
