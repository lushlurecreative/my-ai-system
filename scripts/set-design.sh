#!/usr/bin/env bash
# Usage: bash ~/my-ai-system/scripts/set-design.sh /path/to/project "glob1,glob2" ["sitesdir1,sitesdir2"]
# Only ever ADDS entries (never removes), so a builder cannot use it to switch the gate off. Sets which files decide how a customer site looks (designPaths) and where finished sites live (designSitesDirs) in the project's .claude/system.json.
set -e
P="${1:?project folder}"; G="${2:?comma-separated globs, e.g. pipeline/designer/**,pipeline/gen/presets/**,docs/validation/**/sites/**}"; S="${3:-}"
node -e '
const fs=require("fs"),f=process.argv[1]+"/.claude/system.json";let d={};try{d=JSON.parse(fs.readFileSync(f,"utf8"))}catch(e){}
const add=(k,v)=>{d[k]=[...new Set([...(Array.isArray(d[k])?d[k]:[]),...v.split(",").map(x=>x.trim()).filter(Boolean)])]};add("designPaths",process.argv[2]);
if(process.argv[3])add("designSitesDirs",process.argv[3]);
fs.writeFileSync(f,JSON.stringify(d)+"\n");console.log("designPaths:",d.designPaths.join(" "),"| designSitesDirs:",(d.designSitesDirs||[]).join(" "));' "$P" "$G" "$S"
