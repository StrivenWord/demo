/**
 * Word-level diff between two policy paragraphs, with no dependencies.
 *
 * Used by scripts/lint-lexias.mjs (divergence report), scripts/drift.mjs (distance from
 * the frozen v5 source), and scripts/build-data.mjs (precomputing the runs that the
 * variant-group review pages render).
 *
 * The diff is computed at build time and baked into review.json rather than computed in
 * the browser, because BUILD-SPEC section 0 requires the review pages to be readable with
 * JavaScript disabled.
 *
 * Tokenisation keeps whitespace attached to the preceding word, so joining the tokens of
 * any run reproduces the original text exactly. That matters: the ` -- ` convention
 * (BUILD-SPEC 4.1.8) must survive a round trip through here untouched.
 */

/** Split into tokens of "word + following whitespace". */
export function tokenize(text) {
  return text.match(/\S+\s*/g) ?? [];
}

/**
 * Longest common subsequence over token arrays, returned as runs of
 * { op: "same" | "del" | "ins", text }.
 *
 * Paragraphs here are at most a few hundred tokens, so the O(n*m) table is fine.
 */
export function wordDiff(a, b) {
  const A = tokenize(a);
  const B = tokenize(b);
  const n = A.length;
  const m = B.length;

  // lcs[i][j] = length of the LCS of A[i..] and B[j..]
  const lcs = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i][j] =
        A[i] === B[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }

  const runs = [];
  const push = (op, text) => {
    const last = runs[runs.length - 1];
    if (last && last.op === op) last.text += text;
    else runs.push({ op, text });
  };

  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (A[i] === B[j]) {
      push("same", A[i]);
      i++;
      j++;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      push("del", A[i]);
      i++;
    } else {
      push("ins", B[j]);
      j++;
    }
  }
  while (i < n) push("del", A[i++]);
  while (j < m) push("ins", B[j++]);

  return runs;
}

/** Counts for a one-line summary, e.g. "-12 +18 words". */
export function wordDelta(a, b) {
  let removed = 0;
  let added = 0;
  for (const run of wordDiff(a, b)) {
    if (run.op === "same") continue;
    const count = tokenize(run.text).length;
    if (run.op === "del") removed += count;
    else added += count;
  }
  return { removed, added };
}

export function formatDelta(a, b) {
  const { removed, added } = wordDelta(a, b);
  return `-${removed} +${added} words`;
}
