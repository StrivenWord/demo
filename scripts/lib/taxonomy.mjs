/**
 * The fixed vocabulary of the model: employees, flavors, dimensions, and the two
 * dimension orderings. See docs/BUILD-SPEC.md sections 4.1 and 5.2.
 *
 * These are the only taxonomy constants that stay in code. Everything else about a
 * flavor -- its label, posture, character string, and Hi/Lo configuration -- lives in
 * content/flavors.json so that a relabelling is a one-file change.
 */

export const DIMENSION_IDS = ["security", "accountability", "efficiency", "innovation"];

export const EMPLOYEE_IDS = ["lux", "puk", "jam", "wow"];

/**
 * The order dimensions appear on a flavor's configuration line in the source document,
 * and the order they are listed in data.json's `dimensions` array.
 */
export const CONFIG_LINE_ORDER = ["security", "accountability", "efficiency", "innovation"];

/**
 * The order the four policy paragraphs appear in the body of a flavor section, and
 * therefore the order data.json emits them in.
 *
 * BUILD-SPEC 4.1.5: This is a different order from the config line. Do not confuse them.
 *
 * Two things depend on this being the emission order rather than, say, filesystem order:
 * validate.mjs check 3 asserts it, and src/assets/scripts.js compares paragraphs
 * positionally when diffing two flavors. Note that sorting lexia filenames alphabetically
 * would put `accountability` first and silently reorder every policy page.
 */
export const PARAGRAPH_ORDER = ["security", "efficiency", "innovation", "accountability"];
