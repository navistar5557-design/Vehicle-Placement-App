import fs from "node:fs";
import assert from "node:assert/strict";

const html=fs.readFileSync(new URL("./index.html",import.meta.url),"utf8");
const js=fs.readFileSync(new URL("./app.js",import.meta.url),"utf8");
const css=fs.readFileSync(new URL("./styles.css",import.meta.url),"utf8");

assert.ok(html.includes('id="appSidebar"'),"shared sidebar must have an accessible target id");
assert.ok(html.includes('id="menuBtn"'),"sidebar toggle button must exist");
assert.ok(html.includes('aria-controls="appSidebar"'),"toggle must control the sidebar");
assert.ok(html.includes('id="sidebarBackdrop"'),"mobile drawer backdrop must exist");

assert.ok(js.includes('const SIDEBAR_PREF_KEY="cube_sidebar_collapsed"'),"desktop preference key missing");
assert.ok(js.includes('localStorage.setItem(SIDEBAR_PREF_KEY'),"desktop collapsed preference must be persisted");
assert.ok(js.includes('function toggleSidebar()'),"toggle handler missing");
assert.ok(js.includes('function closeMobileSidebar()'),"mobile close handler missing");
assert.ok(js.includes('window.addEventListener("resize",syncSidebarLayout)'),"resize synchronization missing");
assert.ok(js.includes('$("#sidebarBackdrop")?.addEventListener("click",closeMobileSidebar)'),"backdrop close behavior missing");
assert.ok(js.includes('if(sidebarIsMobile()) closeMobileSidebar(); else syncSidebarLayout();'),"navigation must close only the mobile drawer");
assert.ok(js.includes('e.key==="Escape"&&sidebarIsMobile()'),"Escape close behavior missing");

assert.ok(css.includes('.app.sidebar-collapsed .main'),"collapsed layout must expand the main area");
assert.ok(css.includes('margin-left:0'),"collapsed main area must release sidebar space");
assert.ok(css.includes('.app.sidebar-collapsed .sidebar'),"collapsed sidebar state missing");
assert.ok(css.includes('.sidebar-backdrop.open'),"mobile backdrop open state missing");
assert.ok(css.includes('.sidebar.open'),"mobile drawer open state missing");
assert.equal(css.includes('transition:grid-template-columns .28s'),false,"grid-column animation should not be used because it causes expensive table reflow");
assert.ok(css.includes('transform:translate3d(-102%,0,0)'),"desktop sidebar should use GPU-accelerated translate3d");
assert.ok(css.includes('transition:margin-left .28s'),"main content resize should use a single 280ms margin transition");
assert.ok(css.includes('will-change:transform'),"sidebar should be promoted for smoother transform animation");
assert.ok(js.includes('function beginSidebarMotion()'),"sidebar motion optimization helper missing");
assert.ok(js.includes('app.classList.add("sidebar-motion")'),"sidebar motion optimization class must be applied");
assert.ok(css.includes('body.sidebar-drawer-open{overflow:hidden}'),"mobile background scroll lock missing");

console.log("Collapsible sidebar checks passed.");
