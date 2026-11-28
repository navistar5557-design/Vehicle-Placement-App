# CUBE Logistics Web Portal

Responsive web portal for the Vehicle Placement system.

## Shared Firebase data
The web portal uses the same Firebase Authentication and Firestore project as the Android app:
- trips
- vehicles
- vendors
- locations
- settings
- users
- roles

## Login
Email logins work directly. Username logins follow the Android rule:
`username -> username@cube.internal`

## Free hosting
The repository includes `.github/workflows/deploy-web.yml` for GitHub Pages.

After the first deployment, add the GitHub Pages hostname (for example `navistar5557-design.github.io`) under Firebase Authentication > Settings > Authorized domains so Firebase email/password login works from the web portal.

## Notes
- Firebase web API keys are identifiers and are expected to be present in client-side Firebase apps. Access control must be enforced through Firebase Authentication and Firestore Security Rules.
- Master renames cascade to existing trip references, matching Android behavior.

## Gemini cloud intent routing (configured on development branch)
The existing local analytics and on-device Gemini Nano path continue to work. The cloud fallback sends only allowlisted generic fleet wording to Gemini; financial calculations and trip records stay local. No Gemini API key is exposed. The cloud model can only select existing supported report intents.

Owner provided screenshots confirming Spark, Gemini Developer API enabled, and enforced Web App Check, plus the web app ID and public reCAPTCHA site key, on 2026-11-27. These public settings are configured on this branch. Verify current free model quota and project-level/per-user limits as supported. Do not enable on Blaze or submit confidential data. Check actual billing plan again before release. App Check must not be disabled. Test with non-sensitive generic questions before production. The current branch has not been live-tested against Firebase.

## General AI mode (v0.4.44)
Select General AI to ask free-form questions, including writing help, general logistics advice and general knowledge in English or Tamil. The typed prompt is sent to Gemini only in this explicit mode, without automatically attaching fleet records, credentials, or prior chats. Google free-tier data terms apply; do not enter confidential information. Fleet Analytics remains separate and uses authorized local data. No web search or live business data in General AI. Errors are surfaced without raw secrets. No paid services enabled.

## Unified assistant (v0.4.45)
No mode selector: local intent routing answers supported recorded fleet questions using authorized Firebase data. General questions go to Gemini, with a visible privacy notice; basic identifier and credential checks block obvious sensitive prompts. Unsupported fleet questions are not fabricated. Never paste confidential information: automatic checks are not comprehensive. This release does not give Gemini access to company data or live web search. Chat messages are in-memory only, cleared on logout/new conversation. The new responsive panel includes expand, copy, quick prompts, loading and keyboard controls. No paid billing changes.

## Read-only fleet query tool (v0.4.46)
Gemini may choose an allowlisted query plan using sanitized vocabulary only; the application validates it and computes results locally against authorized Firebase records. Supports common date ranges, ISO date ranges, vehicle/vendor filters, rankings, expenses and trip status. Never grants Gemini direct database access. Financial data remains behind existing role checks. Balance means freight less advance, not verified unpaid invoices. Unsupported scopes return clarification. No raw fleet records or identifiers are attached to Gemini prompts.

## AI Analysis

The AI Analysis sidebar report shares the Reports role permission and uses the existing trip and vehicle listeners. Reviewed imports require Create Trip permission and use the regular trip form and Save Trip action. Firestore security rules are managed outside this repository.

- Date filters use India time. Historical financial totals exclude cancelled trips. The forecast projects current-month booked freight at the current calendar-day run rate. The optional target is a report input.
- Availability is based on open assignments across all trips. Last recorded destinations and completion timestamps are planning clues. Alerts use recorded empty distance, placement plus planned transit, the existing margin threshold, prior completed route expenses and the user-entered freight target.
- The report assistant runs locally. Browser voice support varies. History and favorites are held in memory for the sign-in. Exports and briefing drafts are user-initiated. Trip ingestion accepts plain text with labeled fields.
- Live location, verified idle duration, distance estimates and idle revenue loss need GPS or dispatch event data. Verified receipts and balances need payment records. Scans and images need OCR. Scheduled briefings and alerts outside the open report need a separately approved background workflow.

Run the report calculation tests with `node web/ai-analysis-test.mjs`.
