# D6-04 moderator guide — preparation only

24 October 2026, Asia/Jakarta. **No participant collection is authorized or recorded by this guide.** Follow [USABILITY_PROTOCOL.md](USABILITY_PROTOCOL.md), which remains the source of truth. Institutional requirements and participant arrangements remain pending. All task data must be labeled **SYNTHETIC SIMULATION**, never real sailings or observed traffic.

## Before scheduling a session

- Confirm the supervisor/institution's instrument, consent and ethics requirements. If they require a different instrument, revise the protocol before collecting responses; the existing questions are custom formative questions, not SUS/UEQ.
- Arrange adults meeting the protocol's experience criteria. Five is the planned sample, not a completed count. Record actual recruitment limitations.
- Verify each U1–U5 fixture in the actual UI, record its case ID and app revision, and reset it between tasks. The U4 gap has been fixed and checked in headless Chromium as described below. This developer verification does not supply institutional approval, consent or participant observations.
- Use the [environment guide](VALIDATION_ENVIRONMENT.md) for the isolated synthetic setup. Keep real accounts, credentials and shipment/customer data out of the session. Automated browser acceptance and participant sessions are separate activities.
- Prepare the [blank observation template](../evidence/sprint-6/observation-template.json). Keep identity, contact and consent material outside the repository. Arrange the protocol's retention/deletion process before collecting anything.

## Opening script

Explain that this is a study of the application, not a test of the person; participation is voluntary and they may skip or stop. Explain the planned 20–30 minutes, synthetic planning scenarios, intended academic report use, and the retention arrangements. Obtain affirmative consent before observing. Ask separately for any optional recording or screenshots; declining recording must not be treated as declining participation.

Only after consent, assign an anonymous participant ID. Record actual experience band, device familiarity, device/viewport, app revision and task/device order without identifying details. Alternate initial desktop/mobile order where practical. Invite think-aloud without explaining how to complete a task.

## Task cards and moderator setup

Read the participant instructions from the protocol without teaching which controls to use. The expected outcomes below are for the moderator; do not read them as hints. Start elapsed timing at the task instruction and finish at declared completion. Log help and corrections, even when the task eventually succeeds.

| Task | Participant instruction from the protocol | Moderator setup and readiness |
| --- | --- | --- |
| U1 | Plan a supplied road departure and identify the selected ferry and recorded cutoff. | Existing `safe` mode supports a daytime synthetic case. Supply and record the plan values; verify all four time meanings can be identified. Observe keyboard-only/mobile completion where feasible. |
| U2 | Explain SAFE, exact-cutoff RISKY, and a negative-buffer MISSED outcome in supplied scenarios. | Existing `safe`, `risky` and `missed` modes supply +30, +0 and −5 minute buffers with a 15-minute simulation threshold. Reset target/plan between cases. Observe explanations without supplying threshold answers or boarding guarantees. |
| U3 | Starting with a missed selected target, find a relevant alternative and use it. | Use `missed` with target `00000000-0000-4000-8000-000000000001`. The current fixture supplies a separately evaluated alternative. Observe preservation of road date/time and explicit recalculation. The fixture does not supply every all-missed backend scenario; do not claim that coverage from this task. |
| U4 | Revise the road date/time for an overnight/source-zone scenario; change it during a delayed request. | **Verified synthetic setup:** `overnight` uses road 23 October 2026 23:50 WIB, service date 24 October, fixed cutoff 00:40 and ferry departure 01:10 WIB. Revise to 24 October 00:00: buffer changes from +20 SAFE to +10 RISKY while cutoff stays fixed. `source-zone` uses road 23 October 22:00 WIB and service date 23 October: source ferry departure 24 October 00:30 +08:00 is 23 October 23:30 WIB; source cutoff 24 October 00:00 +08:00 is 23 October 23:00 WIB. Apply `delay: 1200`, submit, then edit road time to 22:20; the old response must be discarded. Recalculate without delay for +10 RISKY. These are moderator expectations, not hints to read to participants. |
| U5 | Explain unavailable data, empty schedules, and service outage; recover where possible. | Existing `unavailable`, `empty` (automatic target) and `outage` modes cover missing cutoff, empty lookup and outage. Return to `safe` for recovery. No dedicated missing-source-zone UI fixture is provided; do not claim that variant was observed without one. |

Mode names refer to the existing loopback-only `frontend/scripts/departure-ui-fixture.mjs` and its `/__control` endpoint. Every reset must specify `mode`, `delay` and `catalog`, since controls retain earlier values. The baseline used by the existing automated script is `safe`, `0`, `normal`, with road/service date 23 October 2026 and road time 08:00 WIB. These are fixed synthetic inputs, not today's sailings. The [five U4 headless preparation groups](../evidence/sprint-6/u4-browser-acceptance.json) and existing departure groups passed against the actual Next UI. Neither a moderator session nor participant task execution has occurred. Fixed U4 occurrences remain independent of revised road times; modes accept only their explicit road/service dates.

If someone requests help or cannot proceed, log the intervention and distinguish assisted completion from unassisted completion. Record `failed` or `stopped` when appropriate. Record critical misunderstandings even after eventual success. Do not replace a missing or blocked task with a successful observation.

## Questions and session close

After **each task**, ask Q1 exactly: “How easy was this task?” Use 1 very difficult, 2 difficult, 3 neither, 4 easy, 5 very easy.

After **all tasks**, ask these once:

- Q2: “How clear was the meaning of the recommendation status?”
- Q3: “How clear was the difference between road departure, terminal arrival, and ferry cutoff?”
- Q4: “How clear were missing data and simulation limitations?”

For Q2–Q4 use 1 very unclear through 5 very clear, with 3 neither, as specified in the protocol. Ask Q5: “What should change before you would use this for planning?” Skipped answers stay missing/null. Do not combine these items into a validated aggregate score.

Keep only authorized anonymized summaries in report evidence. Stop the temporary servers after use and verify ports 3011/9011 have no listeners. Update [USABILITY_RESULTS.md](USABILITY_RESULTS.md) only with genuine observations, actual denominators, missing tasks/answers and limitations. Link any proposed fix to observation IDs and record its retest scope. D6-04 and DEP-14 remain pending until the required real participant evidence exists.
