/**
 * Diff view for jobs/<job>/index.html, the compare page. See docs/BUILD-SPEC.md
 * section 9.
 *
 * Scope is deliberately small: everything else on the site is pre-rendered.
 * This is the one progressive enhancement. Without it, the compare page shows
 * all four flavors side by side, fully readable. With it, a pair selector
 * narrows the view to two flavors and marks where their texts differ.
 *
 * Classic script, no modules, no bundler, no dependencies. No network calls;
 * the policy data comes from window.COUNTY_AI_DATA, loaded via a classic
 * <script src> before this file (BUILD-SPEC 6.3). State lives in
 * location.hash, never history.pushState, because pushState has no meaningful
 * effect under file:// (BUILD-SPEC section 3).
 */
(function () {
  "use strict";

  var FLAVOR_IDS = ["green", "red", "blue", "yellow"];

  function init() {
    var grid = document.querySelector(".compare-grid[data-job]");
    if (!grid || !window.COUNTY_AI_DATA) return;

    var jobId = grid.getAttribute("data-job");
    var employee = window.COUNTY_AI_DATA.employees.filter(function (e) {
      return e.id === jobId;
    })[0];
    if (!employee) return;

    var flavorNames = {};
    window.COUNTY_AI_DATA.flavors.forEach(function (f) {
      flavorNames[f.id] = f.name;
    });

    var controls = buildControls(flavorNames);
    grid.parentNode.insertBefore(controls.el, grid);

    var initial = readHash();
    if (initial) {
      controls.setValues(initial[0], initial[1]);
      applyDiff(grid, employee, initial[0], initial[1]);
    }

    controls.el.addEventListener("change", function () {
      var values = controls.getValues();
      if (values[0] && values[1] && values[0] !== values[1]) {
        location.hash = "diff=" + values[0] + "," + values[1];
        applyDiff(grid, employee, values[0], values[1]);
      }
    });

    controls.resetButton.addEventListener("click", function () {
      controls.setValues("", "");
      history.replaceState ? history.replaceState(null, "", location.pathname + location.search) : (location.hash = "");
      showAllFlavors(grid);
    });
  }

  function readHash() {
    var m = location.hash.match(/^#diff=(\w+),(\w+)$/);
    if (!m) return null;
    if (FLAVOR_IDS.indexOf(m[1]) === -1 || FLAVOR_IDS.indexOf(m[2]) === -1) return null;
    return [m[1], m[2]];
  }

  function buildControls(flavorNames) {
    var el = document.createElement("div");
    el.className = "diff-controls";
    el.setAttribute("role", "group");
    el.setAttribute("aria-label", "Compare two flavors");

    function makeSelect(id, labelText) {
      var label = document.createElement("label");
      label.textContent = labelText + " ";
      var select = document.createElement("select");
      select.id = id;

      var blank = document.createElement("option");
      blank.value = "";
      blank.textContent = "Choose a flavor";
      select.appendChild(blank);

      FLAVOR_IDS.forEach(function (id) {
        var opt = document.createElement("option");
        opt.value = id;
        opt.textContent = flavorNames[id] || id;
        select.appendChild(opt);
      });

      label.appendChild(select);
      return { label: label, select: select };
    }

    var a = makeSelect("diffA", "Compare");
    var b = makeSelect("diffB", "with");
    el.appendChild(a.label);
    el.appendChild(b.label);

    var resetButton = document.createElement("button");
    resetButton.type = "button";
    resetButton.textContent = "Show all four";
    el.appendChild(resetButton);

    return {
      el: el,
      resetButton: resetButton,
      getValues: function () {
        return [a.select.value, b.select.value];
      },
      setValues: function (va, vb) {
        a.select.value = va;
        b.select.value = vb;
      }
    };
  }

  function showAllFlavors(grid) {
    var columns = grid.querySelectorAll(".compare-column");
    for (var i = 0; i < columns.length; i++) {
      columns[i].hidden = false;
      clearDiffMarks(columns[i]);
    }
  }

  function applyDiff(grid, employee, flavorA, flavorB) {
    var columns = grid.querySelectorAll(".compare-column");
    for (var i = 0; i < columns.length; i++) {
      var flavorId = columns[i].getAttribute("data-flavor");
      var keep = flavorId === flavorA || flavorId === flavorB;
      columns[i].hidden = !keep;
      clearDiffMarks(columns[i]);
    }

    var paragraphsA = paragraphTexts(employee, flavorA);
    var paragraphsB = paragraphTexts(employee, flavorB);
    if (!paragraphsA || !paragraphsB) return;

    markChanges(grid, flavorA, paragraphsA, paragraphsB);
    markChanges(grid, flavorB, paragraphsB, paragraphsA);
  }

  function paragraphTexts(employee, flavorId) {
    var policy = employee.policies[flavorId];
    if (!policy) return null;
    return policy.paragraphs.map(function (p) {
      return p.text;
    });
  }

  function markChanges(grid, flavorId, ownTexts, otherTexts) {
    var column = grid.querySelector('.compare-column[data-flavor="' + flavorId + '"]');
    if (!column) return;
    var paras = column.querySelectorAll(".policy-para");
    for (var i = 0; i < paras.length; i++) {
      if (ownTexts[i] !== otherTexts[i]) {
        paras[i].classList.add("diff-changed");
        var marker = document.createElement("span");
        marker.className = "visually-hidden";
        marker.textContent = "changed: ";
        paras[i].insertBefore(marker, paras[i].firstChild);
      }
    }
  }

  function clearDiffMarks(column) {
    var changed = column.querySelectorAll(".policy-para.diff-changed");
    for (var i = 0; i < changed.length; i++) {
      changed[i].classList.remove("diff-changed");
      var marker = changed[i].querySelector(".visually-hidden");
      if (marker) marker.remove();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
