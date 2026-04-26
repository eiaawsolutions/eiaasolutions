# Search Console + Bing Webmaster — Setup Checklist

**Site**: `https://eiaawsolutions.com/`
**Sitemap**: `https://eiaawsolutions.com/sitemap.xml`
**Robots**: `https://eiaawsolutions.com/robots.txt`
**Owner email**: eiaawsolutions@gmail.com

Run this once after the canonical domain is live and serving the apex (not redirecting apex → www). Total time: ~10 minutes.

---

## Pre-flight (do this first)

Confirm the site is actually live and the canonical resolves:

```bash
curl -I https://eiaawsolutions.com/
# Expect: HTTP/2 200 (NOT a 301 to www)

curl -I https://www.eiaawsolutions.com/
# Expect: HTTP/2 301 → https://eiaawsolutions.com/
# (so www folds into apex, matching our canonical declaration)

curl -I https://eiaawsolutions.com/sitemap.xml
# Expect: HTTP/2 200, content-type: application/xml

curl -I https://eiaawsolutions.com/robots.txt
# Expect: HTTP/2 200, content-type: text/plain

curl -I https://eiaawsolutions.com/media/og-card.png
# Expect: HTTP/2 200, content-type: image/png
```

If any of those fail, **fix before proceeding** — verification will fail too.

---

## Part 1 — Google Search Console (5 min)

1. Open <https://search.google.com/search-console/welcome>
2. Sign in as `eiaawsolutions@gmail.com`
3. Choose **"Domain"** property type (NOT "URL prefix" — Domain covers apex + www + all subdomains in one shot)
4. Enter: `eiaawsolutions.com` (no protocol, no slash)
5. Google shows a **DNS TXT record** to add. It looks like:
   ```
   google-site-verification=AbCdEf123456...
   ```
6. Add that TXT record to your DNS provider (Cloudflare / Namecheap / GoDaddy / wherever the domain is registered):
   - **Type**: TXT
   - **Host / Name**: `@` (or leave blank — means root)
   - **Value**: the full `google-site-verification=...` string Google gave you
   - **TTL**: 1 hour (or default)
7. Wait 2–10 min for DNS propagation. You can check with `dig TXT eiaawsolutions.com +short` or <https://dnschecker.org/#TXT/eiaawsolutions.com>
8. Back in Search Console, click **Verify**. Should turn green.
9. Once verified, in the left nav: **Sitemaps** → enter `sitemap.xml` → **Submit**
10. Confirm it shows status "Success" within ~5 min (Google fetches it immediately)

### Bonus settings inside Search Console (do these once verified)

- **Settings → Users and permissions** → add any team member who needs read access
- **Settings → Crawl stats** → check no errors
- **Indexing → Sitemaps** → confirm `/sitemap.xml` is listed and "Read" is recent
- **Indexing → Pages** → after ~48 hours, confirm both URLs (`/` and `/products.html`) are indexed
- **Experience → Core Web Vitals** → revisit in ~2 weeks once Google has CrUX data

---

## Part 2 — Bing Webmaster Tools (3 min)

Bing also feeds DuckDuckGo, Yahoo, Ecosia, and ChatGPT search.

**Fast path** (recommended): import directly from Search Console.

1. Open <https://www.bing.com/webmasters/>
2. Sign in (Microsoft account — create one with `eiaawsolutions@gmail.com` if you don't have it)
3. On the home screen, choose **"Import from Google Search Console"**
4. Authorize the connection. Bing pulls your verified Google sites, sitemaps, and even existing Search Console data.
5. Pick `eiaawsolutions.com` from the list → **Import**
6. Done. No separate verification needed.

**Manual path** (if you don't want to link Google ↔ Microsoft accounts):

1. Add site → enter `https://eiaawsolutions.com`
2. Bing offers 3 verification methods. Easiest is the DNS TXT (same flow as Google):
   - Add a TXT record `bingsiteauth.xml` value Bing gives you
3. Click verify
4. **Sitemaps** → submit `https://eiaawsolutions.com/sitemap.xml`

---

## Part 3 — Verify the social previews (2 min)

These don't index — they just confirm your OG card renders correctly when shared.

| Platform | Tool | What to do |
|---|---|---|
| LinkedIn | <https://www.linkedin.com/post-inspector/> | Paste `https://eiaawsolutions.com/`. If preview is wrong, click **"Inspect"** again — that force-refreshes LinkedIn's cache |
| Facebook / Meta | <https://developers.facebook.com/tools/debug/> | Paste URL → **Scrape Again** to refresh cache |
| X / Twitter | <https://cards-dev.twitter.com/validator> (deprecated but partial) — or just paste in a draft tweet to preview |
| WhatsApp | Send the URL to yourself in a chat. First send = first cache; if it looks wrong, append `?v=1` to bust |
| Slack / Discord | Paste in a personal channel; previews appear immediately |

Repeat for `https://eiaawsolutions.com/products.html`.

If any preview shows the wrong image / text, the cause is almost always platform-cache. Use the validators' **"Scrape Again" / "Inspect"** button to force a re-fetch.

---

## Part 4 — Validate the structured data (2 min)

| Tool | What to check |
|---|---|
| <https://search.google.com/test/rich-results> | Paste `https://eiaawsolutions.com/` — should detect: Organization, WebSite, SoftwareApplication (×3 — Sales Agent, Ai Ads Agency, Workforce), FAQPage. No errors. |
| <https://search.google.com/test/rich-results> | Paste `https://eiaawsolutions.com/products.html` — should detect: Organization, BreadcrumbList, ItemList (numberOfItems: 3, with 3 SoftwareApplication children), FAQPage, Service ×3 (per product, with areaServed) |
| <https://validator.schema.org/> | Same URLs — broader schema check, will flag warnings Google's tool ignores |
| `curl -I https://eiaawsolutions.com/llms.txt` | HTTP/2 200, content-type: `text/plain` — confirms the AI-readable summary is reachable for ChatGPT/Claude/Perplexity/Gemini/Apple Intelligence crawlers |

Expected outcomes:

- ✅ FAQPage on homepage and products page → **eligible for FAQ rich result** (collapsible Q&A in Google results) and high-density Q&A surface for AI Overviews / Perplexity / ChatGPT citations
- ✅ Organization with sameAs → feeds Knowledge Panel
- ✅ BreadcrumbList on /products.html → **breadcrumb shown in Google result** instead of raw URL
- ✅ Service schemas with `areaServed` (MY/SG/ID/TH/PH/VN) → AI Overviews can surface EIAAW for region-scoped product queries
- ✅ `llms.txt` at root + `<link rel="alternate" type="text/plain">` on every page → discoverable, structured AI summary
- ✅ `hreflang` (en, en-MY, en-SG, x-default) → correct regional surfacing in Google
- ✅ Product rich result eligibility once we add `aggregateRating` and/or `review` (future enhancement, not done yet)

---

## Indexing timeline (what to expect)

| Time after submission | What should happen |
|---|---|
| Same day | Google + Bing fetch sitemap, robots.txt confirms allowed |
| 24–72 hours | Both URLs appear in `site:eiaawsolutions.com` Google query |
| 1–2 weeks | Knowledge Panel begins forming if Organization schema is consistent across sameAs links |
| 2–4 weeks | FAQ rich result may appear in SERPs for queries about EIAAW |
| 4–6 weeks | AI Overviews / ChatGPT / Perplexity / Claude begin citing the page consistently |
| Ongoing | CrUX (Core Web Vitals real-user data) needs ~28 days of traffic to populate |

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| "Verification failed" | DNS TXT not yet propagated | Wait 10 more min; verify with `dig TXT eiaawsolutions.com` |
| Sitemap "Couldn't fetch" | Apex doesn't actually serve, or robots.txt disallows | Re-run pre-flight curl checks |
| URLs not indexed after 1 week | `noindex` somewhere or canonical points elsewhere | Use **URL Inspection** in Search Console → "Test live URL" |
| OG card shows old hero.jpg | Platform cache | Use the validator's "Scrape Again" button |
| FAQ rich result not appearing | Google decides per-query whether to render it | Patience; check `Performance → Search appearance: FAQ` after 2 weeks |
| Knowledge Panel doesn't form | sameAs links must reciprocate (LinkedIn page must link back to eiaawsolutions.com in its "Website" field) | Update LinkedIn + YouTube channel "About" sections to include the website URL |

---

## After everything is verified

Update this file with the verification dates:

- [ ] Google Search Console verified on: ____________
- [ ] Bing Webmaster verified on: ____________
- [ ] Sitemap submitted to Google on: ____________
- [ ] Sitemap submitted to Bing on: ____________
- [ ] LinkedIn preview confirmed on: ____________
- [ ] Rich Results Test passed on: ____________
- [ ] LinkedIn Company page (proper /company/ URL) created and `sameAs` updated on: ____________
