# Rebellion V2.1 ? visibility, growth and cleanup

## Audit and root causes

V2 calculates national/local unrest explanations, eases provincial unrest toward that pressure by 2.5% daily, and advances a separate organization meter. At 100 organization, connected provinces of the same government and rebel type with unrest >=70 join a faction. The trigger province becomes the historical origin. One infantry army is raised using population, unrest, development, organization, national military strength and type. The faction is stored in its government's `Country.rebellions`; no new Country is created. Its tag is a virtual owner and internal war participant. Unopposed occupation and Battle V3 conquest both use `transferProvince`.

The fast growth came from organization rates up to 1.5/day, 2.5% population mobilization multiplied by development/type, and reinforcement up to 100/day. Reinforcement could recruit from involved provinces still held by the government. Initial recruited troops were not deducted from the future mobilization pool. Active local organization was already frozen: the snowball was military reinforcement, not a continuing organization multiplier.

Persistence had two causes: defeat required both zero territory AND zero troops, and `getProvinceRebellion` fell back to historical involved membership after recapture cleared local metadata. Surviving landless troops could continue issuing orders and recruiting. There was no mutable territorial base or territorial-loss cleanup gate. Notifications used unrest bands (25/50/70/85), while showing organization, and could repeat after oscillation/cooldown.

## Visibility and notifications

`REBELLION_MARKER_THRESHOLD = 50` gates both provincial unrest indicators and active faction flags on the map. Below 50, they disappear; invalid faction references do not render. ProvincePanel and detailed tooltip data retain full unrest/organization. Country coloring is unchanged.

Organization milestones are 25/50/75/90. Messages occur only on upward crossing of the highest milestone reached that tick and either above the persisted `notifiedMilestone` high-water mark or after the existing 30-day cooldown since the last warning. Identical ticks never repeat; falling/re-crossing within that cooldown cannot repeat a milestone. At 100, the existing committed-state faction formation announcement is used, avoiding an extra critical/formation toast. Memory survives recapture and terminal cleanup, suppressing immediate repeated warnings while allowing a new crossing in a later cycle after cooldown. Existing lastLogDay/lastBand remain backward compatible.

## Balance before / after

Unrest bands remain 25/50/70/85. Organization rates by band:

| Band | V2 points/day | V2.1 points/day |
|---|---:|---:|
| <25 | -0.8 | -0.8 |
| 25?49 | -0.1 | -0.1 |
| 50?69 | 0.35 | 0.2275 |
| 70?84 | 0.8 | 0.52 |
| >=85 | 1.5 | 0.975 |

Final formula: clamp(progress + min(MAX_DAILY_REBELLION_PROGRESS=1, bandRate) - min(1,garrisonRatio)*0.7 - (suppressionDays>0 ? min(1,garrisonRatio)*2 : 0), 0, 100). Positive band rates decrease 35%; decay and suppression retain their strength. The cap limits positive growth, not beneficial decay. Unrest pressure formulas are unchanged.

Constant high-unrest/no-garrison fixture: 30 days = 45 points before / 29.25 after; from zero, 100 takes 67 / 103 days. Recorded daily increments are 1.5 / 0.975 until the final clamped increment. This isolates organization balance; real campaign unrest and garrisons vary.

Initial strength uses the existing formula with populationMobilization reduced 0.025 -> 0.02 (20% of the population contribution), preserving type/development and national-strength limits, minimum 100 and maximum 40,000.

Active organization stays frozen, which is slower than pre-rebellion growth. Military additions require controlled rebel territory; government-held supporters no longer fund it. Let P be controlled population, S support/100, N controlled provinces, T living troops, R cumulative recruited troops. Daily addition = floor(max(0,min(50,25*N,40000-T,0.3*P-R,P*S*0.0005+P*max(S,0.25)*0.001))). This halves former population rates and global cap. A stationary noncombat army in controlled territory receives additions; a replacement army may be raised only if no living armies remain and controlled territory exists. Population is consumed, cumulative pool and daily guards prevent unlimited growth/resurrection. Zero territory always means zero reinforcement.

## Base, recapture and ending

`originProvince` remains historical; `baseProvince` starts there and represents the current base. On any rebel territory transfer, the hook retains a still-controlled base or chooses the lexically smallest controlled province ID. Recapture removes local factionId/progress, cancels local recruitment/construction through the existing transfer operation, preserves residual unrest, and removes current involved membership. It does not restart conquest resentment just for returning rebel territory.

Losing the last province sets cleanupPending immediately and clears baseProvince. Movement removes pending/orphan forces before they can continue an existing march. Objective maintenance transitions to defeated, removes every army by authoritative owner (including split armies missing optional factionId), removes wars/relations and local links, and records/logs defeat once. Terminal faction records remain as save/history, rather than deleting their government's Country.

A new faction gets its formation day to establish unopposed control. A genuine ongoing Battle V3 at the linked origin also preserves formation while disputed. A territoryless old save without that combat is defeated on the next maintenance tick, even if surviving troops remain at the origin. A valid rebel occupation without armies remains active and can raise finite replacements. Stale base pointers with remaining territory are repaired deterministically.

## Movement, combat and activation

Before planning, indexed faction/owner/base guards remove orphan armies, including those with existing orders. Existing destination and inCombat guards preserve equivalent move orders. Initial forces cannot wander landless from their origin; established factions require controlled territory. Cleanup cannot establish new occupation.

Battle V3 still handles combat, casualties, conquest and retreat. No combat model or retreat rule changed. Internal diplomacy remains startInternalWar and normal war/access relations. Negotiation now also returns territory through transferProvince instead of assigning Province.owner directly. Legacy save migration retains its existing owner-tag canonicalization, which is schema migration rather than conquest.

Simulation Activation code/wake reasons were untouched: active rebellions retain the existing wake reason; terminal records do not add one.

## Save/load and performance

Provincial notification memory is normalized explicitly. Optional faction baseProvince, territoryEstablished and cleanupPending serialize through the existing save format and normalize to safe defaults (origin, false, false) for older saves. Territory and combat state are authoritative on maintenance; no format version bump is needed. Terminal/missing faction occupations are restored through transferProvince using the saved sponsor, army original owner or province original owner, when that recipient exists. A malformed save lacking every valid historical recipient cannot safely invent a new owner. Existing save/load tests cover active factions, armies, objectives and diplomacy, alongside new metadata round-trip tests.

Movement builds faction, controlled-owner and province maps once per planning pass. Reinforcement builds territories/armies grouped by owner once, then computes population/strength from relevant groups. transferProvince already copies global state; its hook reuses that transition and makes one province pass for the two affected owners, with deterministic base selection. Existing objective/AI pathfinding and immutable output maps retain their previous global scans; this patch does not claim the entire tick is O(relevant territories). No rebellion-specific benchmark exists.

## Regression coverage and limits

New `rebellionV21.test.tsx` covers marker 0/49/50, threshold descent, four milestone crossings/non-repeat/fall/save memory, 30-day growth and eventual trigger, cap, frozen active organization, finite territorial reinforcement, zero-territory reinforcement, A/B recapture/base migration/unrest preservation/end/orphans/no orders/one-time cleanup, stale save and order dedup. Existing V2/lifecycle cases retain Battle V3 casualties/retreat, genuine formation disputes, occupation, victory, old saves, negotiation, activation and real multi-tick integration. Previous assertions expecting landless persistence or recruitment were updated to the requested territorial rules.

Limits: initial mobilization remains abstract and does not debit population (existing V2 behavior); the finite reinforcement pool still tracks post-formation recruits. The constant-pressure fixture is not a full campaign balance simulation. Existing global pathfinding/objective scans and the large production bundle remain outside this polish.

## Validation

- New V2.1 suite: 19 tests, including deterministic stale-base repair and 1,000-day finite recruitment exhaustion.
- Final full suite: 95 files / 2,486 tests passed with `npm run test:run -- --maxWorkers=2` (90.51 s). Lint, typecheck, build and git diff --check passed. Production build retains the existing >500 kB chunk warning.
- Browser Battle V3 smoke passes plain, mountains, fortress, air, reinforcement, annihilation and mid-battle save/load; no runtime errors. Full smoke timed out waiting for the amphibious fixture to begin a battle (script line 74). Amphibious implementation was not modified; that browser scenario remains unverified.
- Simulation Activation benchmark completed all six scenarios. Normal-phase AI medians with activation: USA 106.67 ms / BRA 121.82 ms / TUV 74.28 ms; corresponding legacy full-AI medians 254.36 / 287.25 / 174.43 ms. These measure activation versus legacy dispatch, not V2 versus V2.1 rebellion performance. Existing activation tests provide behavior regression coverage.
