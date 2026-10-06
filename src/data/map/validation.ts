import type { MapValidationIssue, MapValidationResult, TopologyCountry, TopologyProvince } from './types';

/** Pure initial-map audit. Connectivity is diagnosed, never repaired.
 * Multiple land components are reported even when intentional (future islands).
 * This is not a validator for rebel occupation or mutable saved game state.
 */
export function validateMapTopology(
  provinces: readonly TopologyProvince[],
  countries: readonly TopologyCountry[],
): MapValidationResult {
  const issues: MapValidationIssue[] = [];
  const provinceIndex = new Map<string, TopologyProvince>();
  const countryIndex = new Map<string, TopologyCountry>();
  for (const province of provinces) {
    if (provinceIndex.has(province.id)) issues.push({ type: 'duplicate-province-id', provinceId: province.id, message: `Duplicate province ${province.id}.` });
    else provinceIndex.set(province.id, province);
  }
  for (const country of countries) {
    if (countryIndex.has(country.tag)) issues.push({ type: 'duplicate-country-id', countryTag: country.tag, message: `Duplicate country ${country.tag}.` });
    else countryIndex.set(country.tag, country);
  }
  const neighborSets = new Map([...provinceIndex].map(([id, province]) => [id, new Set(province.neighbors)]));
  const land = new Map([...provinceIndex.keys()].map(id => [id, new Set<string>()]));
  const holdings = new Map([...countryIndex].map(([tag, country]) => [tag, new Set(country.provinces)]));

  for (const province of provinces) {
    const provinceId = province.id;
    const countryTag = province.owner;
    if (!countryIndex.has(countryTag)) {
      issues.push({ type: 'invalid-owner', provinceId, countryTag, message: `Province ${provinceId} has unknown owner ${countryTag}.` });
    } else if (!holdings.get(countryTag)!.has(provinceId)) {
      issues.push({ type: 'unlisted-owned-province', provinceId, countryTag, message: `Owner ${countryTag} does not list ${provinceId}.` });
    }
    const seen = new Set<string>();
    for (const neighborId of province.neighbors) {
      const context = { provinceId, neighborId };
      if (seen.has(neighborId)) {
        issues.push({ ...context, type: 'duplicate-neighbor', message: `Repeated edge ${provinceId} -> ${neighborId}.` });
        continue;
      }
      seen.add(neighborId);
      if (neighborId === provinceId) {
        issues.push({ ...context, type: 'self-neighbor', message: `Province ${provinceId} neighbors itself.` });
      } else if (!provinceIndex.has(neighborId)) {
        issues.push({ ...context, type: 'missing-neighbor', message: `Unknown neighbor ${neighborId} of ${provinceId}.` });
      } else {
        land.get(provinceId)!.add(neighborId);
        land.get(neighborId)!.add(provinceId);
        if (!neighborSets.get(neighborId)!.has(provinceId)) {
          issues.push({ ...context, type: 'asymmetric-neighbor', message: `Edge ${provinceId} -> ${neighborId} has no reverse edge.` });
        }
      }
    }
  }
  for (const country of countries) {
    const countryTag = country.tag;
    for (const provinceId of country.provinces) {
      const province = provinceIndex.get(provinceId);
      if (!province) issues.push({ type: 'missing-country-province', countryTag, provinceId, message: `Country ${countryTag} lists unknown province ${provinceId}.` });
      else if (province.owner !== countryTag) issues.push({ type: 'owner-mismatch', countryTag, provinceId, message: `Country ${countryTag} lists ${provinceId}, owned by ${province.owner}.` });
    }
    // No first-province inference: validate only explicit capital metadata.
    for (const provinceId of new Set([country.capital, country.capitalId])) {
      if (provinceId === undefined) continue;
      if (!provinceIndex.has(provinceId) || provinceIndex.get(provinceId)!.owner !== countryTag || !holdings.get(countryTag)!.has(provinceId)) {
        issues.push({ type: 'invalid-capital', countryTag, provinceId, message: `Invalid capital ${provinceId} for ${countryTag}.` });
      }
    }
  }
  const components: string[][] = [];
  const visited = new Set<string>();
  for (const [id, neighbors] of land) {
    if (neighbors.size === 0) issues.push({ type: 'isolated-province', provinceId: id, message: `Province ${id} has no valid land connection.` });
    if (visited.has(id)) continue;
    const component = [id];
    visited.add(id);
    for (let cursor = 0; cursor < component.length; cursor++) {
      for (const neighbor of land.get(component[cursor])!) {
        if (!visited.has(neighbor)) { visited.add(neighbor); component.push(neighbor); }
      }
    }
    components.push(component);
  }
  if (components.length > 1) issues.push({ type: 'disconnected-components', message: `Land graph has ${components.length} disconnected components.` });
  return { valid: issues.length === 0, issues, components };
}
