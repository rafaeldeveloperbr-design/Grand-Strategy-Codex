import { diplomacyWorld } from './diplomacyWorld';
import { army, relation, war } from './southAmericaAudit';

export function militaryWorld(scenario: 'peace' | 'wars' | 'manyArmies' = 'peace') {
  const initial = diplomacyWorld('normal');
  const world = { ...initial, provinces: initial.provinces!, armies: initial.armies! };
  if (scenario !== 'peace') {
    world.wars = [war('ARG', 'CHL'), war('COL', 'VEN'), war('FRA', 'DEU')];
    for (const w of world.wars) {
      const row = world.relations.find(r => r.countryA === w.attacker && r.countryB === w.defender || r.countryB === w.attacker && r.countryA === w.defender);
      if (row) row.status = 'war'; else world.relations.push(relation(w.attacker, w.defender));
    }
  }
  if (scenario === 'manyArmies') {
    for (const country of world.countries) for (const province of world.provinces.filter(p => p.owner === country.tag)) {
      world.armies.push(army(country.tag, province.id, 2, `extra-${province.id}`));
    }
  }
  return world;
}
