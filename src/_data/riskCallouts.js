/**
 * Authored risk callouts, verified against the source text.
 * See docs/BUILD-SPEC.md section 7.5. Keyed by employee id, then flavor id.
 *
 * Both the keys and the prose name colours, so the 2026-07-08 reassignment touched both.
 * The underlying claims are unchanged: Security is Lo only under Exposed, and
 * Accountability is Hi only under Guardrails and Enable.
 */
export default {
  puk: {
    green: {
      title: "Federal compliance exposure",
      description:
        "Security Lo removes the CJIS compliance requirement present in Red, Yellow, and Blue. " +
        "Criminal justice data may be processed outside county or state-authorized systems on " +
        "personally owned devices."
    }
  },
  wow: {
    blue: {
      title: "Legal documentation gap",
      description:
        "Accountability Lo removes AI-use logging from the determination record. The Red and " +
        "Yellow texts retain the log as part of that record; Blue does not."
    }
  }
};
