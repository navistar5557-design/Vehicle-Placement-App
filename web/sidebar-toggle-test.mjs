import fs from "node:fs";
import assert from "node:assert/strict";

const html=fs.readFileSync(new URL("./index.html",import.meta.url),"utf8");
const js=fs.readFileSync(new URL("./app.js",import.meta.url),"utf8");
const css=fs.readFileSync(new URL("./styles.css",import.meta.url),"utf8");

assert.ok(html.includes('id="appSidebar"'),"shared sidebar must exist");
assert.ok(html.includes('id="menuBtn"'),"sidebar toggle button must exist");
assert.ok(html.includes('class="mobile-menu sidebar-edge-toggle"'),"toggle must be attached to sidebar edge styling");
assert.ok(html.includes('aria-controls="appSidebar"'),"toggle must control sidebar");
assert.ok(html.includes('id="sidebarBackdrop"'),"mobile backdrop must remain available");

const asideEnd=html.indexOf("</aside>");
const togglePos=html.indexOf('id="menuBtn"');
const mainPos=html.indexOf('<main class="main">');
const headerPos=html.indexOf('<header class="topbar">');
assert.ok(togglePos>asideEnd && togglePos<mainPos,"toggle must sit between sidebar and main content");
assert.ok(togglePos<headerPos,"toggle must not remain inside the top header");

assert.ok(js.includes("let desktopSidebarCollapsed=false;"),"desktop must start expanded on every load");
assert.equal(js.includes('cube_sidebar_collapsed'),false,"collapsed state must not be restored from localStorage");
assert.equal(js.includes('localStorage.setItem(SIDEBAR_PREF_KEY'),false,"manual desktop state must not be persisted");
assert.ok(js.includes("desktopSidebarCollapsed=!desktopSidebarCollapsed;"),"manual toggle must still collapse and expand");
assert.ok(js.includes("function toggleSidebar()"),"toggle handler missing");
assert.ok(js.includes("syncSidebarLayout();\n  if(page!==\"dashboard\")"),"navigation must preserve current manual sidebar state");

assert.ok(css.includes(".sidebar-edge-toggle{"),"edge toggle styling missing");
assert.ok(css.includes("left:245px"),"expanded toggle must sit on sidebar right boundary");
assert.ok(css.includes(".app.sidebar-collapsed .sidebar-edge-toggle"),"collapsed toggle position missing");
assert.ok(css.includes("left:12px"),"collapsed toggle must remain visible");
assert.ok(css.includes("cubic-bezier(.4,0,.2,1)"),"requested smooth easing missing");
assert.ok(css.includes("transition-duration:.28s"),"sidebar animation must remain approximately 280ms");
assert.ok(css.includes("transform:translate3d(-102%,0,0)"),"sidebar should keep GPU accelerated slide");
assert.ok(css.includes("transition:margin-left .28s"),"main content expansion animation must remain");

console.log("Sidebar edge toggle checks passed.");
