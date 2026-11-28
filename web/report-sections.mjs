export function reportSectionButtons(sections, prefix) {
  return sections.map(([id, label]) =>
    '<button type="button" id="' + prefix + '-toggle-' + id + '" aria-controls="' + prefix + '-' + id +
    '" aria-expanded="false">' + label + '</button>').join("");
}

export function wireReportSections(root, initial = "", onChange = () => {}) {
  const buttons = [...root.querySelectorAll(".analysis-section-controls button")];
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
