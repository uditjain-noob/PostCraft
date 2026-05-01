  
**POST**  
**CRAFT**

*Social Media Content Scheduler — MCP Project*

**PRODUCT REQUIREMENTS DOCUMENT**

Version 1.0  ·  May 2025  ·  Confidential

| Project Name | PostCraft MCP |
| :---- | :---- |
| **Version** | 1.0 — Initial PRD |
| **Status** | **Draft for Review** |
| **Build Phases** | 4 Phases (MVP → Scale) |
| **Target Market** | SMBs, Creators, Agencies |

# **1\. Executive Summary**

| Product Vision PostCraft is a Model Context Protocol (MCP) server that transforms the way small businesses, solo creators, and marketing agencies produce and distribute social media content. A single natural-language prompt generates a month of on-brand posts, schedules them across Instagram, LinkedIn, Facebook, and X, tracks engagement, and iterates on what performs — all without opening a single social media app. |
| :---- |

## **1.1 The Problem**

Consistent social media presence is table stakes for any business in 2025\. Yet for the 90% of businesses that do not have a dedicated social media manager, it remains one of the most time-consuming, inconsistently executed, and poorly measured activities they do. The gap is not creativity — it is the operational overhead of doing it every single day.

| Pain Point | Current State | PostCraft Solution |
| :---- | :---- | :---- |
| Content creation | 2–4 hours per week manually | 30-post calendar in 60 seconds |
| Scheduling | Multiple apps, manual timeslots | Auto-scheduled at optimal times |
| Performance tracking | Log into each platform separately | Unified engagement dashboard |
| Content improvement | Guesswork on what to post next | Data-driven next month generation |

## **1.2 Target Users**

| Segment | Who They Are | Primary Use Case |
| :---- | :---- | :---- |
| **Solo Creators** | YouTubers, podcasters, coaches with 5k–500k followers | Repurpose long-form content into daily social posts |
| **SMBs** | Local restaurants, salons, D2C brands, clinics | Stay consistently active without hiring a social manager |
| **Agencies** | Content agencies managing 5–50 client accounts | Scale client content production without scaling headcount |
| **Indie Hackers** | Solo product builders growing in public | Document their build journey consistently across platforms |

# **2\. MCP Server Architecture**

## **2.1 Overview**

PostCraft is built as an MCP server with 5 specialised tools. The Claude agent orchestrates these tools in sequence from a single user prompt. Each tool is independent, testable, and can be called selectively — giving the agent maximum flexibility.

| Architecture Pattern MCP Server (Node.js) ← Claude Agent ← User PromptThe server exposes 5 tools over stdio transport. Claude decides the order and parameters. Results from one tool feed into the next as structured JSON. |
| :---- |

## **2.2 The 5 MCP Tools**

| MCP Tool | Purpose | Output | API Required |
| :---- | :---- | :---- | :---- |
| **generate\_content\_calendar** | Sends brand brief \+ tone guidelines \+ topic list to Claude API. Returns a structured 30-day content plan: post idea, caption, hashtags, platform, and optimal posting time for each day. | Structured JSON calendar object with 30 entries | Claude API (content generation) |
| **schedule\_and\_publish** | Takes the approved calendar JSON and schedules posts via Meta Graph API and X API v2. Handles text, image, and carousel formats. Queues up to 60 days ahead. | Array of scheduled post IDs per platform with confirmation timestamps | Meta Graph API, X API v2 |
| **fetch\_engagement\_analytics** | Pulls post-level metrics 48hrs after publish: likes, shares, comments, reach, saves, link clicks. Computes engagement rate per post and content type. | Metrics JSON keyed by post ID with engagement rate, reach, and save rate | Meta Graph API, X API v2 |
| **save\_content\_library** | CRUD operations on local content.json. Archives every post with performance data. Tracks which topics, formats, and times work best per account. | Confirmation \+ updated library stats (total posts, avg engagement, top topic) | None — local file system |
| **push\_to\_prefab\_ui** | Formats content calendar, performance dashboard, and approval queue into a Prefab-compatible payload. Sends to the Prefab webhook endpoint. | Dashboard URL \+ confirmation of panels pushed | Prefab webhook (local or cloud) |

## **2.3 Tool Execution Flow**

The following sequence shows how all 5 tools fire from a single user prompt:

1. User sends prompt: 'Generate and schedule a month of content for my brand'

2. generate\_content\_calendar fires — returns 30 structured post objects

3. save\_content\_library fires — persists the calendar to local JSON (create)

4. User approves calendar via Prefab UI (or auto-approves in 'autopilot' mode)

5. schedule\_and\_publish fires — posts each item at its scheduled time

6. 48hrs after each post: fetch\_engagement\_analytics fires — collects metrics

7. save\_content\_library fires again — updates each post with performance data (update)

8. push\_to\_prefab\_ui fires — refreshes the dashboard with latest analytics

# **3\. Build Phases**

| PHASE 1 — MVP Core Generate & Schedule Loop | Weeks 1–4 |
| :---- | ----: |

## **3.1 Goal**

Deliver the core value proposition: a user can describe their brand, and PostCraft generates and schedules a month of content across at least 2 platforms. No analytics, no dashboard yet — just the content pipeline working end to end.

## **3.2 Features — Phase 1**

| Feature | Description / Solution | Implementation | External API |
| :---- | :---- | :---- | :---- |
| **Brand Brief Onboarding** | User describes brand name, tone (formal/casual/funny), products, target audience, and competitors in a JSON config file. Agent reads this as context for every generation call. | Local brand-config.json read at startup. Validated against a Zod schema. | None |
| **Content Calendar Generation** | Calls Claude API with brand brief \+ content mix instructions (70% educational, 20% promotional, 10% personal). Returns 30 structured post objects in JSON. | claude-sonnet-4-20250514 via Anthropic SDK. System prompt engineers the output schema. | Anthropic Claude API |
| **Platform Targeting** | Each post in the calendar is tagged with a target platform (Instagram, LinkedIn, X, Facebook) and a format (text-only, image-with-caption, carousel). Platform tone rules applied per post. | Platform-specific system prompt fragments injected during generation. JSON schema enforces platform field. | None |
| **Hashtag Generation** | 5–10 relevant hashtags generated per post. Differentiated by platform — Instagram gets more hashtags than LinkedIn. Trending hashtag detection is a Phase 2 feature. | Generated inline by Claude during calendar creation. No separate API call needed. | None |
| **Optimal Posting Times** | Default optimal time slots hardcoded per platform based on published research (Instagram: 9am Tue/Wed, LinkedIn: 8am Tue–Thu etc). Personalised timing is Phase 3\. | Static lookup table in times-config.json. User can override per platform. | None |
| **Meta Graph API Scheduling** | Approves and schedules each post to Instagram and Facebook Pages using Meta Graph API. Handles text posts and single-image posts. Carousel and Reel formats in Phase 2\. | Meta Graph API v19. OAuth token stored in .env. Rate limit: 200 calls/hour — well within needs. | Meta Graph API (free) |
| **X (Twitter) Scheduling** | Schedules tweet threads to X using API v2. Handles text-only posts. Image posts in Phase 2\. | X API v2 Basic tier (free: 1500 posts/month). OAuth 2.0 PKCE flow. | X API v2 (free basic) |
| **Local Content Library** | Saves the full content calendar to local content.json. Each post object stores: id, platform, caption, hashtags, media\_url (if any), scheduled\_time, status (draft/scheduled/published), and performance (null until Phase 2). | Node.js fs/promises for CRUD. UUID per post. Atomic writes to prevent corruption. | None |
| **MCP Server Setup** | Full MCP server scaffold using @modelcontextprotocol/sdk. StdioServerTransport. All 5 tools registered with Zod input schemas. Error handling and retry logic. | npm: @modelcontextprotocol/sdk, zod, node-fetch. TypeScript for type safety. | None |

## **3.3 MVP Acceptance Criteria**

* Agent generates a 30-post content calendar from a brand brief in under 60 seconds

* At least 25 of 30 posts are scheduled successfully to Meta and/or X

* All posts saved to local content.json with correct structure

* No unhandled errors on a clean run — full retry logic in place

* Claude Desktop config wired — tools visible and callable from the agent

| MVP Demo Prompt "Generate a month of Instagram and LinkedIn content for my D2C skincare brand, PostGlow. We sell natural face serums to women 25-40. Tone is warm and educational. Schedule everything and save to my content library." |
| :---- |

| PHASE 2 — ANALYTICS & RICH MEDIA Engagement Tracking \+ Image Support | Weeks 5–8 |
| :---- | ----: |

## **3.4 Goal**

Close the feedback loop. After posts go live, automatically collect engagement data, feed it back into the content library, and surface the insights to the user. Also add image post support so the content is actually visually engaging.

## **3.5 Features — Phase 2**

| Feature | Description / Solution | Implementation | External API |
| :---- | :---- | :---- | :---- |
| **Engagement Analytics Pull** | fetch\_engagement\_analytics fires automatically 48hrs after each post publishes. Collects: reach, impressions, likes, comments, shares, saves, link clicks. Computes engagement rate (interactions/reach). | Scheduled via node-cron. Meta Graph API Insights endpoint. X v2 metrics endpoint. | Meta Graph API, X API v2 |
| **Content Performance Scoring** | Each post gets an aggregate performance score (0–100) computed from: engagement rate vs account average, save rate (strong intent signal), share rate. Score stored in content.json. | Weighted formula: (ER × 0.4) \+ (save\_rate × 0.4) \+ (share\_rate × 0.2) × 100\. Computed locally. | None |
| **Top Performer Detection** | After each month's cycle, identifies the top 3 posts by score. Flags what they had in common: topic category, format, posting time, or caption length. Feeds insight into next month's generation. | Claude API call with performance data \+ top posts. Returns structured insights JSON. | Anthropic Claude API |
| **Image Post Support** | Allows user to place images in a /media folder. Agent matches image files to posts by post ID or tag. Uploads image to platform before scheduling the post. | Meta Graph API media upload endpoint. X v2 media/upload endpoint. Validates image dimensions per platform. | Meta Graph API, X API v2 |
| **Canva Integration (Basic)** | Generates Canva design links pre-populated with the post copy. User clicks link to customise the visual. Does not auto-generate images — that is Phase 3\. | Canva Connect API (free tier). Template ID mapped to post format type. | Canva Connect API (free) |
| **LinkedIn Publishing** | Adds LinkedIn as a third platform. Publishes text posts and single-image posts to LinkedIn Pages via LinkedIn Marketing API. | LinkedIn Marketing API v2. OAuth 2.0. Rate limit: 100 posts/day per app — sufficient. | LinkedIn Marketing API (free) |
| **Prefab Dashboard — Basic** | push\_to\_prefab\_ui sends first live dashboard payload: content calendar grid, published vs scheduled status, top 3 performing posts, and engagement rate chart. | Prefab webhook integration. Dashboard config in prefab-schema.json. Local dev server on port 3001\. | Prefab (free tier) |
| **Performance Weekly Digest** | Every Monday, the agent auto-generates a plain-English performance summary: 'Your top post this week was X with 4.2% engagement. Your worst performer was Y. Recommendation for next week: post more carousel content on Wednesdays.' | Claude API call with the week's metrics. Output pushed to Prefab as a digest card. | Anthropic Claude API |
| **CSV Export** | User can export the full content library to CSV. Includes all fields: caption, platform, posted time, reach, engagement rate, score. Useful for manual analysis or reporting to clients. | Node.js csv-writer package. save\_content\_library tool gets an 'export' operation mode. | None |

| PHASE 3 — INTELLIGENCE LAYER AI-Powered Optimisation \+ Multi-Account | Weeks 9–14 |
| :---- | ----: |

## **3.6 Goal**

Make the system learn. Use 2+ months of performance data to generate progressively better content, personalise posting times, and support multiple client accounts. This is where the product transitions from 'useful tool' to 'competitive advantage.'

## **3.7 Features — Phase 3**

| Feature | Description / Solution | Implementation | External API |
| :---- | :---- | :---- | :---- |
| **Adaptive Content Generation** | Before generating next month's calendar, fetches the top and bottom 5 posts from the previous month. Passes them to Claude with the instruction: 'Generate this month's content in the style of the top 5 and avoid patterns from the bottom 5.' | Retrieves ranked posts from content.json. Constructs few-shot examples prompt. Performance data becomes training signal. | Anthropic Claude API |
| **Personalised Posting Times** | After 4+ weeks of data, analyses engagement by day-of-week and hour-of-day per platform. Overwrites the default posting time lookup with account-specific optimal windows. | Statistical mode of top-10 post times per platform from content.json analytics. Requires min 20 posts per platform. | None |
| **Trending Hashtag Detection** | Before generating each post, fetches currently trending hashtags in the post's topic category. Blends 2–3 trending tags with the evergreen ones. | RapidAPI Trending Hashtags (free tier: 500 req/month). Falls back to static list if limit hit. | RapidAPI Trending Hashtags |
| **AI Image Generation** | For posts without a user-supplied image, optionally generates a social-media-ready image using Stability AI or DALL-E. Prompt engineered from the post caption and brand colour palette. | Stability AI API (free: 25 images/month). Image resized to platform spec before upload. | Stability AI API or DALL-E API |
| **Multi-Account Support** | Supports multiple brand profiles stored as separate account configs. Each account has its own brand-config.json, content.json library, and scheduled queue. Switchable in the agent prompt. | Account selector argument on all MCP tools. Separate file namespacing by account\_id. | None |
| **Competitor Content Monitoring** | Fetches top-performing recent posts from specified competitor accounts (public data only). Identifies their winning content patterns and surfaces them as strategy inputs for the next generation cycle. | Meta Graph API public content endpoint. Returns post text and engagement stats for public pages. | Meta Graph API |
| **Approval Workflow** | Before scheduling, sends the full calendar to the Prefab approval queue. Each post shows a preview with 'Approve / Edit / Reject' buttons. Rejected posts are regenerated automatically. | Prefab approval component. MCP tool polls the approval status endpoint before calling schedule\_and\_publish. | Prefab API |
| **Content Repurposing** | Takes a long-form asset (blog URL, YouTube video transcript, podcast RSS) and automatically generates a full month's worth of derivative social posts from it. | Web fetch for blog/transcript. Claude API for derivative generation. YouTube transcript via yt-dlp (free). | Anthropic Claude API, yt-dlp |
| **A/B Caption Testing** | For high-priority posts, generates 2 caption variants and publishes them to two different audience segments. After 24hrs, identifies the winner and uses its patterns in future generations. | Meta Graph API audience split feature. A/B results stored in content.json with variant\_id field. | Meta Graph API |

| PHASE 4 — SCALE & MONETISATION Agency Features \+ SaaS Wrapper | Weeks 15–22 |
| :---- | ----: |

## **3.8 Goal**

Package the MCP server into a product that can be sold. Build the agency-grade features — white-labelling, client workspaces, billing integration — and wrap the whole thing in a web UI that non-technical users can operate without touching the MCP layer directly.

## **3.9 Features — Phase 4**

| Feature | Description / Solution | Implementation | External API |
| :---- | :---- | :---- | :---- |
| **Web UI (Non-Technical Users)** | A Next.js web app that wraps all MCP tool calls in a clean UI. Users can set up their brand, generate content, review the calendar, approve posts, and see analytics — all without touching Claude Desktop or the terminal. | Next.js 14 App Router. MCP server called via REST bridge. Hosted on Vercel (free tier). | Vercel (free) |
| **Agency Client Workspaces** | Each agency gets a workspace with multiple client sub-accounts. Client can be given view-only access to their calendar and analytics. Agency retains full control over generation and scheduling. | Workspace model in data layer. Role-based access: owner, editor, viewer. Per-client API key namespacing. | None |
| **White-Label Dashboard** | Agency can brand the Prefab dashboard with their own logo, colours, and domain. Client-facing reports show the agency's brand, not PostCraft's. | Prefab theme config API. Custom CSS injection. CNAME support. | Prefab Pro (paid) |
| **Stripe Subscription Billing** | In-app subscription management via Stripe. Tier enforcement: post limits, account limits, and feature gating per plan. Webhook handles upgrade/downgrade/cancellation. | Stripe Billing API \+ Webhooks. Plan config in stripe-plans.json. Metered billing for image generation. | Stripe API (free to integrate) |
| **Slack / Email Alerts** | Sends weekly performance digest, post approval requests, and billing alerts to a configured Slack channel or email address. | Slack Incoming Webhooks (free). SendGrid free tier: 100 emails/day. | Slack API, SendGrid |
| **Custom Content Rules Engine** | Agency can define rules that govern all generated content: 'Never mention competitor names', 'Always include a CTA', 'Minimum 3 hashtags', 'Never post on Sundays'. Rules injected into every generation prompt. | Rules stored per account in content-rules.json. Injected as system prompt constraints. | None |
| **Bulk Content Import** | Upload a CSV of existing posts. System classifies each post by type, scores it against current performance data, and uses it to bootstrap the brand voice model for a new account. | CSV parser \+ Claude classification call per row. Bootstraps content.json library instantly. | Anthropic Claude API |
| **API Access Tier** | Exposes PostCraft's content generation and scheduling as a REST API. Agencies and developers can integrate it into their own tools. Rate-limited by subscription tier. | Express.js REST wrapper around MCP tools. API key auth. Rate limit via express-rate-limit. | None |

# **4\. Full Technology Stack**

## **4.1 Core Stack Decision**

PostCraft is built Node.js-first because the MCP SDK is TypeScript-native, the social platform SDKs are best supported in JavaScript, and the async/event-driven model handles scheduling and webhook callbacks naturally.

| Layer | Technology | Why This Choice | Alternative |
| :---- | :---- | :---- | :---- |
| **MCP Server** | **Node.js \+ TypeScript** | MCP SDK is TypeScript-native. Type safety catches API contract errors at compile time. Essential for a tool that calls multiple external APIs. | Python (MCP SDK available but less mature for production) |
| **MCP SDK** | **@modelcontextprotocol/sdk v1.x** | Official SDK. Handles tool registration, input validation, stdio transport, and protocol compliance automatically. | Building raw MCP over stdio manually |
| **Schema Validation** | **Zod** | Validates all MCP tool inputs and external API responses. Prevents runtime errors from malformed data. Works natively with TypeScript types. | Joi, Yup |
| **AI Generation** | **Anthropic Claude API (claude-sonnet-4-20250514)** | Best-in-class instruction following for structured JSON output. claude-sonnet-4 balances quality and cost. System prompts reliably produce consistent calendar schemas. | GPT-4o, Gemini 1.5 Pro |
| **Scheduling (cron)** | **node-cron** | Lightweight cron-style scheduler for triggering analytics fetches 48hrs after publish. No external queue needed at MVP scale. | Bull/BullMQ, Agenda |
| **Local Data Store (MVP)** | **JSON files (fs/promises)** | Zero setup, zero dependencies, human-readable. Perfect for MVP and single-user. Each account is a separate directory of JSON files. | SQLite (Phase 3 migration path) |
| **Database (Phase 3+)** | **SQLite via better-sqlite3** | When multi-account and query complexity demands it. File-based, no server process, embedded in the app. Easy migration from JSON. | PostgreSQL (if cloud-hosted) |
| **Web Framework (Phase 4\)** | **Next.js 14 (App Router)** | Full-stack React framework. API routes serve as REST bridge to MCP server. Server components reduce client bundle. Excellent Vercel deployment. | Remix, SvelteKit |
| **Styling (Phase 4\)** | **Tailwind CSS \+ shadcn/ui** | Utility-first CSS with a high-quality component library. Dashboard-grade components (tables, charts, modals) available out of the box. | Chakra UI, MUI |
| **Charts (Phase 4\)** | **Recharts** | React-native charting library. Composable, lightweight, and well-suited for the engagement dashboard. No D3 learning curve. | Chart.js, Victory |
| **Background Jobs (Phase 4\)** | **BullMQ \+ Redis** | When cron is insufficient. BullMQ handles retry logic, dead-letter queues, and job priority for the publishing pipeline at scale. | Inngest, Temporal |
| **Payments (Phase 4\)** | **Stripe** | Industry standard. Excellent webhook reliability, subscription management, and metered billing support for usage-based tiers. | Razorpay (India-first alternative) |
| **Deployment (Phase 4\)** | **Vercel (web) \+ Railway (MCP server)** | Vercel for the Next.js frontend. Railway for the long-running Node.js MCP server process. Both have generous free tiers. | Fly.io, Render |

# **5\. External APIs — Full Breakdown**

## **5.1 API Dependency Matrix**

PostCraft uses 8 external APIs across its 4 phases. All Phase 1 and 2 APIs have free tiers sufficient for development and early production use.

| API / Service | Free Tier | What We Use It For | Fallback | Priority |
| :---- | :---- | :---- | :---- | :---- |
| **Anthropic Claude API** | Free $5 credit on signup | Content calendar generation, performance insight generation, content repurposing, A/B analysis | OpenAI GPT-4o | **Must-Have** |
| **Meta Graph API** | Free (requires Meta developer account \+ Page) | Instagram \+ Facebook post scheduling, media upload, engagement analytics, competitor page data | None — no alternative for native Meta scheduling | **Must-Have** |
| **X (Twitter) API v2** | Free: 1,500 posts/month, Basic: $100/mo for more | Tweet and thread scheduling, engagement metric pulls (likes, reposts, impressions) | Buffer API as scheduling proxy if X API access is blocked | **Must-Have** |
| **LinkedIn Marketing API** | Free (requires LinkedIn Page \+ app approval) | LinkedIn post and image scheduling, page analytics pull. Note: approval takes 3–5 days | Phantombuster as workaround during approval | **Should-Have** |
| **Canva Connect API** | Free tier available | Pre-populate Canva templates with generated post copy. User clicks through to design the image. | Manual image creation — Canva integration is a nice-to-have | **Nice-to-Have** |
| **Stability AI API** | Free: 25 images/month | AI-generated images for posts without user-supplied media. Prompt engineered from post caption. | DALL-E 3 via OpenAI API (pay-per-image) | **Nice-to-Have** |
| **RapidAPI (Trending Hashtags)** | Free: 500 req/month | Fetch trending hashtags in a given topic category before generating each post. Blended with evergreen tags. | Static hashtag list as fallback (no API needed) | **Nice-to-Have** |
| **Stripe** | Free to integrate (2.9% \+ 30¢ per transaction) | Subscription management, plan enforcement, metered billing for image generation usage | Razorpay for India-first billing | **Phase 4 Only** |

## **5.2 Meta Graph API — Setup Notes**

The Meta API is the highest-friction dependency. Here is the exact setup path:

9. Create a Meta Developer account at developers.facebook.com

10. Create a new App — select 'Business' type

11. Add 'Instagram Graph API' and 'Pages API' products to the app

12. Generate a long-lived Page Access Token (valid 60 days — must refresh via cron)

13. Store token in .env as META\_ACCESS\_TOKEN

14. Add the Page ID and Instagram Business Account ID to brand-config.json

| Rate Limit Note Meta Graph API allows 200 API calls per hour per access token. A 30-post schedule fires at most 30 scheduling calls \+ 30 analytics calls \= 60 calls. Well within limits. Image uploads count separately. |
| :---- |

## **5.3 Authentication Storage Pattern**

All API tokens stored in a .env file — never committed to source control. A .env.example file documents every required variable for easy onboarding.

| Environment Variable | Purpose |
| :---- | :---- |
| ANTHROPIC\_API\_KEY | Claude API — content generation and analysis |
| META\_ACCESS\_TOKEN | Meta Graph API — Instagram \+ Facebook scheduling |
| META\_PAGE\_ID | Target Facebook Page ID |
| META\_IG\_ACCOUNT\_ID | Target Instagram Business Account ID |
| X\_API\_KEY \+ X\_API\_SECRET | X OAuth 1.0a app credentials |
| X\_ACCESS\_TOKEN \+ X\_ACCESS\_SECRET | X account-level access tokens |
| LINKEDIN\_ACCESS\_TOKEN | LinkedIn Marketing API OAuth token |
| LINKEDIN\_ORG\_ID | LinkedIn Page organisation ID |
| STABILITY\_API\_KEY | Stability AI image generation (Phase 3\) |
| STRIPE\_SECRET\_KEY | Stripe billing (Phase 4\) |
| PREFAB\_WEBHOOK\_URL | Prefab dashboard push endpoint |

# **6\. Data Model**

## **6.1 content.json — Post Record Schema**

| Post Object Structure {  "id": "post\_abc123",  "account\_id": "postglow",  "platform": "instagram",  "format": "image\_caption",  "caption": "Your skin deserves better than harsh chemicals...",  "hashtags": \["\#naturalskincare", "\#serumlovers"\],  "media\_url": "./media/post\_abc123.jpg",  "scheduled\_time": "2025-06-03T09:00:00+05:30",  "status": "published",  "topic\_category": "educational",  "content\_pillar": "ingredient\_spotlight",  "performance": {    "reach": 4820,    "impressions": 6100,    "likes": 312,    "comments": 28,    "shares": 45,    "saves": 190,    "link\_clicks": 67,    "engagement\_rate": 0.0646,    "performance\_score": 81  },  "variant\_id": null,  "created\_at": "2025-05-28T14:22:11Z",  "updated\_at": "2025-06-05T10:15:44Z"} |
| :---- |

## **6.2 brand-config.json — Account Configuration**

| Brand Config Structure {  "account\_id": "postglow",  "brand\_name": "PostGlow",  "tone": "warm, educational, empowering",  "products": \["vitamin C serum", "hyaluronic moisturiser"\],  "target\_audience": "Women 25-40, skin-conscious, ingredient-aware",  "content\_pillars": \["ingredient\_spotlight", "skin\_tips", "customer\_stories", "product\_launch"\],  "content\_mix": { "educational": 0.7, "promotional": 0.2, "personal": 0.1 },  "active\_platforms": \["instagram", "linkedin", "facebook"\],  "posting\_times": {    "instagram": \["09:00", "19:00"\],    "linkedin": \["08:00", "17:00"\],    "facebook": \["10:00", "20:00"\]  },  "content\_rules": \[    "Always end with a question to encourage comments",    "Never mention competitor brand names",    "Always include one concrete skin benefit in every caption"  \]} |
| :---- |

# **7\. Monetisation Strategy**

## **7.1 Pricing Tiers**

|  | Free | Creator — ₹599/mo | Business — ₹1,799/mo | Agency — ₹6,999/mo |
| :---- | :---- | :---- | :---- | :---- |
| Platforms | 1 | 3 | 5 | 5 per client |
| Posts/month | 15 | 60 | **Unlimited** | **Unlimited** |
| AI Image gen | No | No | 5/month | 25/month |
| Analytics | Basic | Full | Full \+ A/B | Full \+ A/B \+ Reports |
| Accounts | 1 | 1 | 3 | 20 client accounts |
| Approval queue | No | Yes | Yes | Yes \+ client view |
| White-label | No | No | No | **Yes** |

## **7.2 Revenue Projections — Conservative Case**

| Month | Creator | Business | Agency | Monthly Revenue |
| :---- | :---- | :---- | :---- | :---- |
| Month 1-2 | 10 users | 2 users | 0 | **₹9,590** |
| Month 3-4 | 40 users | 10 users | 2 agencies | **₹55,960** |
| Month 6 | 100 users | 30 users | 8 agencies | **₹1,67,860** |
| Month 12 | 300 users | 80 users | 20 agencies | **₹4,57,780 (\~₹4.6L)** |

## **7.3 Key Growth Levers**

* Freemium funnel: Free plan users hit the 15-post limit and upgrade to Creator. Target: 15% free-to-paid conversion.

* Agency channel: One agency sale \= 20 client accounts worth of retention. Prioritise agency acquisition from Month 3\.

* Content repurposing virality: Every PostCraft-scheduled post is quality content — users will naturally mention the tool in their posts.

* Integration partnerships: Canva template marketplace, Shopify app store (for D2C brands), Notion template integration.

# **8\. Risks & Mitigations**

| Risk | Severity | Description | Mitigation |
| :---- | :---- | :---- | :---- |
| Meta API changes | **High** | Meta frequently deprecates API versions. A version change can break scheduling overnight. | Pin API version in all calls. Subscribe to Meta changelog. Abstract API calls behind an adapter layer. |
| X API pricing | **High** | X has made API access unpredictable. Free tier limits (1500 posts/mo) may not scale. | Abstract X as one of many platforms. If X becomes cost-prohibitive, deprioritise and focus on Meta \+ LinkedIn. |
| AI generation quality | **Med** | Generated captions may not match brand voice precisely, especially for niche businesses. | Robust system prompt engineering. Approval queue (Phase 3\) as human safety net. Brand voice examples in config. |
| Platform policy violation | **High** | Automated posting can trigger spam detection on Meta/X and result in account suspension. | Respect rate limits. Randomise scheduling times ±15 minutes. Never post more than 3x/day per platform. |
| LinkedIn API approval | **Med** | LinkedIn requires manual app review (3–5 days). Marketing API access is not instant. | Apply on Day 1\. Use Phantombuster as a temporary workaround during Phase 1 testing. |
| Token expiry | **Low** | Meta long-lived tokens expire after 60 days. Expired tokens cause silent scheduling failures. | Cron job checks token expiry weekly and triggers refresh flow. Alert on Slack/email if refresh fails. |

# **9\. Build Timeline Summary**

| Phase | Timeline | Key Deliverable | Success Metric |
| :---- | :---- | :---- | :---- |
| **Phase 1 MVP** | Weeks 1–4 | Content generation \+ Meta \+ X scheduling \+ local storage | 30 posts generated and scheduled from one prompt |
| **Phase 2 Analytics** | Weeks 5–8 | Engagement tracking \+ image posts \+ LinkedIn \+ Prefab dashboard | Engagement data auto-collected for 100% of posts |
| **Phase 3 Intelligence** | Weeks 9–14 | Adaptive generation \+ personalised times \+ multi-account \+ repurposing | Month 2 content outperforms Month 1 by \>10% avg engagement |
| **Phase 4 Scale** | Weeks 15–22 | Web UI \+ agency workspaces \+ Stripe billing \+ white-label | First paying customer on Business or Agency plan |

## **9.1 Week-by-Week — Phase 1 Detail**

| Week | Milestone |
| :---- | :---- |
| Week 1 | MCP server scaffold, all 5 tools registered, Zod schemas defined, stdio transport working in Claude Desktop |
| Week 2 | generate\_content\_calendar working — brand config → 30-post JSON output. save\_content\_library CRUD working. |
| Week 3 | Meta Graph API auth, single-post scheduling, image upload. X API auth, tweet scheduling. |
| Week 4 | End-to-end test: single prompt → calendar → schedule 30 posts → verify in Meta \+ X dashboards. Bug fixes. |

# **10\. Appendix**

## **10.1 Folder Structure**

| Repository Structure postcraft-mcp/├── src/│   ├── server.ts              ← MCP server entry point│   ├── tools/│   │   ├── generateCalendar.ts│   │   ├── scheduleAndPublish.ts│   │   ├── fetchAnalytics.ts│   │   ├── saveContentLibrary.ts│   │   └── pushToPrefab.ts│   ├── apis/│   │   ├── meta.ts│   │   ├── twitter.ts│   │   ├── linkedin.ts│   │   └── anthropic.ts│   ├── schemas/│   │   ├── postSchema.ts│   │   └── brandConfigSchema.ts│   └── utils/│       ├── scheduler.ts       ← node-cron jobs│       └── fileStore.ts       ← JSON CRUD helpers├── data/│   ├── accounts/│   │   └── postglow/│   │       ├── brand-config.json│   │       ├── content.json│   │       └── media/│   └── content-rules.json├── .env.example├── claude\_desktop\_config.json├── package.json└── tsconfig.json |
| :---- |

## **10.2 claude\_desktop\_config.json**

| Claude Desktop Configuration {  "mcpServers": {    "postcraft": {      "command": "node",      "args": \["/absolute/path/to/postcraft-mcp/dist/server.js"\],      "env": {        "ANTHROPIC\_API\_KEY": "your-key-here"      }    }  }} |
| :---- |

## **10.3 The Full Demo Prompt**

| Full End-to-End Demo Prompt (triggers all 5 MCP tools) "Generate a full month of Instagram, LinkedIn, and Facebook content for PostGlow — a D2C natural skincare brand. We sell vitamin C serums and hyaluronic moisturisers to women aged 25–40 who care about ingredients. Tone is warm, educational, and empowering. Use a 70/20/10 mix of educational, promotional, and personal posts. Schedule everything at optimal times, save to the content library, and push the full calendar to my Prefab dashboard for approval." |
| :---- |

*This single prompt triggers: generate\_content\_calendar → save\_content\_library (create) → schedule\_and\_publish → push\_to\_prefab\_ui. After 48hrs: fetch\_engagement\_analytics → save\_content\_library (update) → push\_to\_prefab\_ui (refresh).*

*PostCraft MCP — PRD v1.0 — Internal Use Only — May 2025*