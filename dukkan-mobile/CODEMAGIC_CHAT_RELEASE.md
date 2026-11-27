# Çalışkan Dükkan — Codemagic TestFlight

- Repo: erdcss/CRM-RMA-PANEL (main), source: dukkan-mobile/
- Apple app: 6826848065; bundle: com.caliskan.dukkan; team: U3WGSDJCT2
- Codemagic workflow: caliskan-dukkan-ios-testflight
- GitHub Actions: .github/workflows/dukkan-codemagic-direct-testflight.yml
- Chat request marker: .github/release-requests/dukkan-codemagic-direct-testflight.txt

## Chat commands
When the user says "Çalışkan Dükkan TestFlight al" or, in an explicitly Dükkan context, "TestFlight al", read the latest marker on main and create/update only that marker with a unique request identifier (timestamp and requested commit); then check the GitHub Actions run and its summary for the actual Codemagic build ID. Do not change other release markers or start EAS. If the marker does not exist, create it. Never report success solely from a Git commit. The workflow launches the current main branch via Codemagic API and monitors the returned build ID; App Store Connect processing must be checked separately. Check in-progress runs before creating a second request. No automatic retries of the POST.

## One-time prerequisites
Existing Codemagic CRM-RMA-PANEL app, CODEMAGIC_API_TOKEN in GitHub Actions Secrets; CODEMAGIC_DUKKAN_APP_ID or existing CODEMAGIC_APP_ID if discovery is ambiguous. Existing Apple integration 'Codemagic Caliskan B2B' must have access to the Dükkan Apple app and matching App Store distribution certificate/provisioning profile. No new Expo project needed. No secrets in code or chat. TestFlight only, no public App Store submission. Expo EAS remains available for legacy manual rollback but is not used by this command. If Apple has closed the current marketing version train, update app.json and package.json version deliberately before requesting another build. The current app version is unchanged. The build number is fetched from Apple and incremented in the build workspace. Branding is fetched from the existing administrator endpoint.

Do not request a release by modifying codemagic.yaml in the same commit as the marker. A normal code commit must not start the Dükkan Codemagic workflow.
