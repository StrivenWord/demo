/**
 * Authored risk callouts, verified against the source text.
 * See docs/BUILD-SPEC.md section 7.5. Keyed by employee id, then flavor id.
 */
export default {
  puk: {
    yellow: {
      title: "Federal compliance exposure",
      description:
        "Security Lo removes the CJIS compliance requirement present in Green, Red, and Blue. " +
        "Criminal justice data may be processed outside county or state-authorized systems on " +
        "personally owned devices."
    }
  },
  wow: {
    blue: {
      title: "Legal documentation gap",
      description:
        "Accountability Lo removes AI-use logging from the determination record. The Green and " +
        "Red texts retain the log as part of that record; Blue does not."
    }
  }
};
