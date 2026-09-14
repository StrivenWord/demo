/**
 * Group the 64 lexias by (employee, dimension, setting) and report which cells in each
 * group say the same thing.
 *
 * This is the review surface. Three of the four flavors set Security Hi, for example, so
 * those three cells *could* carry identical text -- and for 19 of the 32 groups they do.
 * The other 13 diverge: same dimension setting, different words. Whether each divergence
 * is deliberate drafting or accidental drift is a question for a human, which is exactly
 * why this is a report rather than a validation rule.
 *
 * Deduplicating the 64 cells down to the 48 unique texts on disk would have buried this
 * question instead of surfacing it.
 */
import { wordDiff, formatDelta } from "./word-diff.mjs";

/**
 * @returns {{ groups: Array, identicalCount: number, divergentCount: number }}
 *   groups are ordered divergent-first, since those are the ones needing attention.
 */
export function groupLexias(flavors, lexias) {
  const flavorById = new Map(flavors.map((f) => [f.id, f]));
  const buckets = new Map();

  for (const lexia of lexias.values()) {
    const flavor = flavorById.get(lexia.flavor);
    if (!flavor) continue;
    const setting = flavor.dimensions[lexia.dimension];
    const id = `${lexia.employee}-${lexia.dimension}-${setting.toLowerCase()}`;

    if (!buckets.has(id)) {
      buckets.set(id, {
        id,
        employee: lexia.employee,
        dimension: lexia.dimension,
        setting,
        members: []
      });
    }
    buckets.get(id).members.push(lexia);
  }

  const groups = [];
  for (const bucket of buckets.values()) {
    // Order members by the flavor order in content/flavors.json so the columns of a
    // variant page read the same way as the rest of the site.
    const order = flavors.map((f) => f.id);
    bucket.members.sort((a, b) => order.indexOf(a.flavor) - order.indexOf(b.flavor));

    const variants = [];
    for (const member of bucket.members) {
      const existing = variants.find((v) => v.text === member.text);
      if (existing) existing.flavors.push(member.flavor);
      else variants.push({ text: member.text, flavors: [member.flavor] });
    }

    // Diff every variant against the first, so a review page can render the divergence
    // without computing anything in the browser (BUILD-SPEC section 0).
    const base = variants[0].text;
    for (const [i, v] of variants.entries()) {
      v.diffVsFirst = i === 0 ? null : wordDiff(base, v.text);
      v.deltaVsFirst = i === 0 ? null : formatDelta(base, v.text);
    }

    groups.push({
      ...bucket,
      memberIds: bucket.members.map((m) => m.id),
      variantCount: variants.length,
      identical: variants.length === 1,
      variants
    });
  }

  groups.sort((a, b) => {
    if (a.identical !== b.identical) return a.identical ? 1 : -1;
    return a.id.localeCompare(b.id);
  });

  return {
    groups,
    identicalCount: groups.filter((g) => g.identical).length,
    divergentCount: groups.filter((g) => !g.identical).length
  };
}

/** The shape comparison behind `lint:lexias --fail-on-change`. */
export function lockShape(groups) {
  return groups
    .map((g) => ({
      id: g.id,
      variantCount: g.variantCount,
      identical: g.identical,
      variants: g.variants.map((v) => v.flavors)
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
}
