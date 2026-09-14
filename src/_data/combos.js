/**
 * The 16 job x flavor combinations, for pagination over
 * src/jobs/job-flavor.njk. See docs/BUILD-SPEC.md section 6.1.
 */
import data from "../../data.json" with { type: "json" };

export default () =>
  data.employees.flatMap((e) =>
    data.flavors.map((f) => ({
      jobId: e.id,
      flavorId: f.id,
      employee: e,
      flavor: f
    }))
  );
