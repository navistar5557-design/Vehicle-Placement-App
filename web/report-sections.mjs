export function reportSectionButtons(sections, prefix) {
  return sections.map(([id, label]) =>
    '<button type="button" id="' + prefix + '-toggle-' + id + '" aria-controls="' + prefix + '-' + id +
    '" aria-expanded="false" data-report-section>' + label + '</button>').join("");
}

function wireReportSections(root, initial = "", onChange) {
  const buttons = [...root.querySelectorAll("[data-report-section]")];
  let active;
  function show(id, focus = false) {
    active = id;
    for (const button of buttons) {
      const panel = button.getAttribute("aria-controls");
      const expanded = panel === id;
      button.setAttribute("aria-expanded", String(expanded));
      root.querySelector("#" + panel).hidden = !expanded;
      if (expanded && focus) button.focus({ preventScroll: true });
    }
    onChange(id);
  }
  for (const button of buttons) {
    button.onclick = () => {
      const panel = button.getAttribute("aria-controls");
      show(active === panel ? "" : panel);
    };
  }
  show(initial);
  return show;
}

export function wireReportDirectory(root, { search, empty, hint, initial, onSelect, onSearch }) {
  const groups = [...root.querySelectorAll(".report-directory-group")].map(group => {
    const heading = group.querySelector("h3").textContent;
    const entries = [...group.querySelectorAll("button")].map(button => ({
      button, name: (button.textContent + " " + heading).toLowerCase()
    }));
    return { group, entries };
  });
  const show = wireReportSections(root, initial, id => {
    hint.hidden = Boolean(id);
    onSelect?.(id);
  });

  function filter() {
    const terms = search.value.toLowerCase().trim().split(/\s+/).filter(Boolean);
    let hasMatches = false;
    for (const { group, entries } of groups) {
      for (const { button, name } of entries) {
        button.hidden = !terms.every(term => name.includes(term));
        if (button.hidden && button.getAttribute("aria-expanded") === "true") show("");
      }
      group.hidden = entries.every(({ button }) => button.hidden);
      hasMatches ||= !group.hidden;
    }
    empty.hidden = hasMatches;
  }

  function applySearch() {
    filter();
    onSearch?.(search.value);
  }
  search.addEventListener("input", applySearch);
  filter();

  return (id, focus = false) => {
    const button = root.querySelector('[aria-controls="' + id + '"]');
    if (button?.hidden) {
      search.value = "";
      applySearch();
    }
    show(id, focus);
  };
}
