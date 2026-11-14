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
