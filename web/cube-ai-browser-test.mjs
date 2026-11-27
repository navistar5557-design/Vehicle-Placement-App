import { chromium } from "playwright";
import assert from "node:assert/strict";
import {createServer} from "node:http";
import {readFile} from "node:fs/promises";
const server=createServer(async(req,res)=>{
 const path=new URL(req.url,"http://localhost").pathname;
 if(path==="/"){res.setHeader("Content-Type","text/html");res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/cube-ai.css"></head><body></body></html>');return;}
 if(!["/cube-ai.mjs","/cube-ai.css"].includes(path)){res.statusCode=404;res.end();return;}
 res.setHeader("Content-Type",path.endsWith(".mjs")?"text/javascript":"text/css");res.end(await readFile(new URL("."+path,import.meta.url)));
});
await new Promise(r=>server.listen(0,"127.0.0.1",r));
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:1280,height:800}});
 const errors=[];page.on("pageerror",e=>errors.push(String(e)));
 await page.goto("http://127.0.0.1:"+server.address().port);
 await page.evaluate(async()=>{
  const {mountCubeAI}=await import("/cube-ai.mjs");
  const t={tripNumber:"TEST-1",vehicle:"TEST-VEHICLE",freight:1000,margin:250,totalExpenses:750,status:"Created",createdAt:1};
  window.fixture={authorized:true,canViewReports:true,tripsReady:true,vehiclesReady:true,period:"Test month",minMarginPercent:10,summary:{trips:[t],active:1,transit:0,completed:0,revenue:1000,margin:250,low:0,delayed:0},kpiRows:{active:[t],transit:[],completed:[],low:[],delayed:[]},vehicles:[{number:"FREE-1",active:true,availability:"available"}]};
  window.widget=mountCubeAI(()=>window.fixture);
 });
 assert.equal(await page.locator("#cubeAi").isVisible(),false);
 await page.evaluate(()=>window.widget.show());
 await page.getByRole("button",{name:"✦ CUBE AI"}).click();
 await page.getByRole("button",{name:"Which vehicles are available now?"}).click();
 await page.getByText("FREE-1 · Available",{exact:true}).waitFor();
 await page.getByRole("textbox",{name:"Ask about your fleet"}).fill("Margin this month");
 await page.getByRole("button",{name:"Ask",exact:true}).click();
 await page.getByText("Total margin: ₹250.",{exact:false}).waitFor();
 await page.getByRole("textbox",{name:"Ask about your fleet"}).press("Escape");
 assert.equal(await page.locator("#cubeAiPanel").isVisible(),false);
 await page.evaluate(()=>{window.widget.hide();window.fixture.canViewReports=false;window.widget.show();});
 await page.getByRole("button",{name:"✦ CUBE AI"}).click();
 assert.equal(await page.getByText("FREE-1 · Available",{exact:true}).count(),0);
 await page.getByRole("textbox",{name:"Ask about your fleet"}).fill("Revenue this month");
 await page.getByRole("button",{name:"Ask",exact:true}).click();
 await page.getByText("Your role does not allow financial reports.").waitFor();
 await page.setViewportSize({width:375,height:667});
 const rect=await page.locator("#cubeAiPanel").boundingBox();
 assert.ok(rect.x>=0&&rect.x+rect.width<=375&&rect.y>=0&&rect.y+rect.height<=667,"mobile panel fits viewport");
 await page.evaluate(()=>window.widget.hide());
 assert.equal(await page.locator("#cubeAi").isVisible(),false);
 assert.deepEqual(errors,[]);
 console.log("CUBE AI desktop/mobile browser interaction and logout tests passed");
}finally{await browser.close();server.close();}
