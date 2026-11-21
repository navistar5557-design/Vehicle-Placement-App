import fs from "node:fs";
import assert from "node:assert/strict";

const js=fs.readFileSync(new URL("./app.js",import.meta.url),"utf8");
const css=fs.readFileSync(new URL("./styles.css",import.meta.url),"utf8");

assert.ok(js.includes('class="ops-revenue"'),"Revenue tile must have a dedicated class");
assert.ok(js.includes('class="ops-margin"'),"Margin tile must have a dedicated class");

assert.ok(css.includes('grid-template-columns:68px 68px 68px 68px 96px 96px 68px 68px!important;'),
  "Revenue and Margin should be wider than the other desktop operation tiles");
assert.ok(css.includes('.header-ops-metrics>.ops-revenue'),"Revenue width override missing");
assert.ok(css.includes('.header-ops-metrics>.ops-margin'),"Margin width override missing");
assert.ok(css.includes('.app.sidebar-collapsed .dashboard-header-summary .header-ops-metrics'),
  "Collapsed-sidebar centering rule missing");
assert.ok(css.includes('left:50%'),"Collapsed operations strip must move to the center");
assert.ok(css.includes('transform:translateX(-50%)'),"Collapsed operations strip must center itself");
assert.ok(css.includes('left .28s cubic-bezier(.4,0,.2,1)'),
  "Operations movement must use the requested 280ms premium easing");
assert.ok(css.includes('transform .28s cubic-bezier(.4,0,.2,1)'),
  "Operations transform animation must use the requested easing");
assert.ok(css.includes('@media(max-width:900px)'),"Mobile protection rule missing");

console.log("Dashboard operations header layout checks passed.");

assert.ok(css.includes('.dashboard-header-summary{'),"dashboard summary centering rule missing");
assert.ok(css.includes('position:absolute'),"Today's Operations parent should be positioned independently in header");
assert.ok(css.includes('top:4px'),"Today's Operations should stay at the top of the header");
assert.ok(css.includes('left:50%'),"Today's Operations parent must be horizontally centered");
assert.ok(css.includes('width:max-content'),"Today's Operations block should size to its content");
assert.ok(css.includes('.app.sidebar-collapsed .dashboard-header-summary .header-ops-metrics'),"collapsed-state metric reset missing");
