# Departure wireframes

23 October 2026. D1-01 low-fidelity design. Text below represents intended layout, not screenshots or an implemented UI. Numerical labels refer to synthetic fixture SAFE-30 from the fixture matrix.

## Desktop, form followed by results in DOM order

```text
+-----------------------------------------------------------------------+
| Dashboard shell > Departure Recommendation                             |
| Plan a road departure against a recorded ferry cutoff                  |
| [Simulation / source limitations banner]                              |
|                                                                       |
| 1 Origin [Batamindo Industrial Park v]                                 |
|   Or latitude [1.0604795] longitude [104.0303214]                        |
| 2 Terminal [Batu Ampar v]     3 Ferry destination [Fixture Singapore]    |
| 4 Service [Cargo v]           Permission must be recorded               |
| 5 Road date [2026-10-23]      6 Road departure [08:00] WIB (weekday)     |
| 7 Ferry service date [2026-10-23] WIB                                   |
| 8 Target [Automatic / recorded sailing UUID v]                         |
|   Recorded cutoff, source zone and verification shown with the target  |
| 9 [Calculate recommendation]   [Stop, only while loading]              |
|                                                                       |
| RESULT: SAFE - estimated buffer meets the 15-minute simulation threshold|
| Selected ferry: synthetic UUID ...0001                                 |
| Ferry departure: 23 Oct 2026 09:30 WIB                                  |
| Recorded cutoff: 23 Oct 2026 09:00 WIB                                  |
| Road departure:  23 Oct 2026 08:00 WIB                                  |
| Terminal ETA:    23 Oct 2026 08:30 WIB   Travel: 30 min                  |
| Signed buffer: +30.00 min              Threshold: 15 min                |
| Fixed-duration latest departure estimate: 23 Oct 2026 08:15 WIB         |
| [Use this road time] -> fills date/time, then requires Calculate        |
| Sources / verification / representative point / assumptions            |
| Planning estimate; synthetic congestion; no boarding guarantee         |
|                                                                       |
| OTHER EVALUATED SAILINGS (at most 3)                                   |
| Ferry date/time | Recorded cutoff | Status | Buffer | [Choose/recalculate]|
| [Revise plan]                  Recalculate after changing inputs       |
+-----------------------------------------------------------------------+
```

Wide displays may place the form beside the result after preserving this reading order; do not make a modal the only way to understand a result. Result status and explanatory text precede dense provenance details. UUIDs may be abbreviated visually with accessible full identity; never use a clock as the option key.

## Mobile, single column

```text
+--------------------------------------+
| Departure Recommendation             |
| Simulation / source limitations      |
| Origin                               |
| [Supported origin v]                 |
| Terminal [Batu Ampar v]               |
| Destination [Fixture Singapore]      |
| Service [Cargo v]                    |
| Road date [2026-10-23]                |
| Road departure [08:00] WIB            |
| Day type: weekday                    |
| Ferry service date [2026-10-23] WIB    |
| Target [Automatic v]                 |
| [Calculate recommendation]           |
|                                      |
| SAFE                                 |
| Estimated buffer meets threshold     |
| Ferry: 23 Oct 09:30 WIB               |
| Cutoff: 23 Oct 09:00 WIB              |
| ETA: 23 Oct 08:30 WIB                 |
| Buffer: +30.00 min                   |
| Simulation threshold: 15 min          |
| Latest estimate: 23 Oct 08:15 WIB     |
| [Use this road time]                 |
| Sources and limitations              |
|                                      |
| Alternative ferry                    |
| Full date / cutoff / status / buffer |
| [Choose and recalculate]             |
+--------------------------------------+
```

At 390 px design width, labels/times wrap naturally and alternatives become stacked cards rather than a horizontally scrolling table. Preserve full dates when crossing midnight. Explain a tiny negative buffer as negative even when two-decimal display would show `-0.00`; display “less than 0.01 min late” and keep MISSED. A below-threshold fraction rounded to the threshold stays RISKY with a boundary explanation. Do not show a rounded value as proof of a different status.

## Empty, unavailable, and error variants

| Variant | Replacement result area |
| --- | --- |
| Initial | “Enter a road plan to calculate an estimate.” |
| Loading | “Calculating…” plus Stop; no stale SAFE card. |
| Validation | Summary links to inline field errors; focus first invalid field. |
| RISKY | “Estimated arrival leaves less than the configured safety buffer”; signed zero/positive buffer. |
| MISSED | “Estimated arrival is after this recorded cutoff”; negative buffer, original target retained, feasible alternatives below. |
| Empty | “UNAVAILABLE — No recorded schedules match this lookup”; show constraints/date and Revise. |
| Missing cutoff/date/zone | “UNAVAILABLE — [specific required data] is not verified”; known target only, decision values shown as “Unavailable”. |
| Stale source | Verification timestamp and age limitation; no credible status inferred from stale data. |
| Service/target mismatch | Field correction message; never swap target silently. |
| Outage/malformed | “The planning service is temporarily unavailable”; Retry; no status card or guessed schedule. |
| Expired session | Sign-in action, cleared results and alternatives. |
| No alternatives/truncation | State which service date was searched and whether metadata exclusions or limits prevented complete comparison. |

Keyboard order: origin selector (or latitude/longitude fields when that input mode is chosen), terminal, destination, service, road date, road time, service date, target, Calculate, Stop when present, result actions, then alternative actions. Source details remain keyboard reachable. [User flow](USER_FLOW.md) defines announcements/focus and lifecycle; actual layout inspection is required in Sprint 5.
