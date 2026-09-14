/**
 * The full extracted dataset, exposed to every template as the global `policy`.
 * Source of truth is data.json at the repo root (BUILD-SPEC.md section 5).
 */
import data from "../../data.json" with { type: "json" };

export default data;
