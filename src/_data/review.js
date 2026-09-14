/**
 * Review state for the 64 lexias, exposed to every template as the global `review`.
 * Source of truth is review.json at the repo root (BUILD-SPEC.md section 5.4).
 *
 * Separate from `policy` because BUILD-SPEC 5.1 fixes data.json's top-level keys; review
 * state lives in its own artifact rather than being folded into the rendering data.
 */
import data from "../../review.json" with { type: "json" };

export default data;
