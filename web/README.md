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

## Optional Gemini cloud intent routing (not enabled by default)
The existing local analytics and on-device Gemini Nano path continue to work. The cloud fallback sends only allowlisted generic fleet wording to Gemini; financial calculations and trip records stay local. No Gemini API key is exposed. The cloud model can only select existing supported report intents.

Owner activation checklist: verify the Firebase project remains Spark (no billing account); enable Firebase AI Logic with Gemini Developer API; register the existing web app and obtain its appId; configure reCAPTCHA Enterprise and App Check for the GitHub Pages host; verify current free model quota; set project-level/per-user limits as supported; then fill in the public appId and reCAPTCHA site key in gemini-cloud.mjs and enable the two flags. Do not enable on Blaze or submit confidential data. Check actual billing plan again before release. App Check must not be disabled. Test with non-sensitive generic questions before production. The current branch has not been live-tested against Firebase.
