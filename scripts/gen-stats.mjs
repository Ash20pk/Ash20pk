// Generates stats.svg and langs.svg for the profile README using the GitHub API.
const USER = "Ash20pk";
const TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
const H = { Authorization: `Bearer ${TOKEN}`, "User-Agent": USER };

const gql = async (q) => {
  const r = await fetch("https://api.github.com/graphql", { method: "POST", headers: H, body: JSON.stringify({ query: q }) });
  const j = await r.json(); if (j.errors) throw new Error(JSON.stringify(j.errors)); return j.data;
};

const d = await gql(`{
  user(login:"${USER}"){
    followers{totalCount}
    repositories(first:100, ownerAffiliations:OWNER, isFork:false, orderBy:{field:UPDATED_AT,direction:DESC}){
      totalCount
      nodes{ stargazerCount languages(first:10, orderBy:{field:SIZE,direction:DESC}){edges{size node{name color}}} }
    }
    contributionsCollection{
      totalCommitContributions totalPullRequestContributions totalPullRequestReviewContributions totalIssueContributions
      restrictedContributionsCount
      contributionCalendar{ totalContributions weeks{contributionDays{contributionCount date}} }
    }
  }
}`);
const u = d.user, c = u.contributionsCollection;
const repos = u.repositories.nodes;
const stars = repos.reduce((a, r) => a + r.stargazerCount, 0);
const commits = c.totalCommitContributions + c.restrictedContributionsCount;

// streaks
const days = c.contributionCalendar.weeks.flatMap(w => w.contributionDays);
let cur = 0, best = 0, run = 0;
for (const day of days) { run = day.contributionCount > 0 ? run + 1 : 0; best = Math.max(best, run); }
for (let i = days.length - 1; i >= 0; i--) { if (days[i].contributionCount > 0) cur++; else if (i !== days.length - 1) break; }

// languages
const skip = new Set(["CSS", "HTML", "Jupyter Notebook", "SCSS", "Shell", "Dockerfile", "Makefile", "PLpgSQL"]);
const lang = {};
for (const r of repos) for (const e of r.languages.edges) if (!skip.has(e.node.name)) { lang[e.node.name] ??= { s: 0, c: e.node.color || "#8b949e" }; lang[e.node.name].s += e.size; }
const top = Object.entries(lang).sort((a, b) => b[1].s - a[1].s).slice(0, 8);
const total = top.reduce((a, [, v]) => a + v.s, 0);

const BG = "#0d1117", FG = "#c9d1d9", ACC = "#4fc3f7", MUTED = "#8b949e", FONT = `font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif"`;
const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");

// ---- stats card
const stats = [
  ["Total stars", stars], ["Commits (past year)", commits], ["Pull requests", c.totalPullRequestContributions],
["Public repos", u.repositories.totalCount], ["Followers", u.followers.totalCount],
  ["Contributions (past year)", c.contributionCalendar.totalContributions], ["Current / best streak", `${cur} / ${best} days`],
];
const W = 495, rowH = 30, statsH = 70 + stats.length * rowH;
let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${statsH}" viewBox="0 0 ${W} ${statsH}" ${FONT}>
<rect width="${W}" height="${statsH}" rx="10" fill="${BG}" stroke="#30363d"/>
<text x="25" y="38" fill="${ACC}" font-size="18" font-weight="600">Aswin's GitHub stats</text>`;
stats.forEach(([k, v], i) => {
  const y = 75 + i * rowH;
  svg += `<text x="25" y="${y}" fill="${FG}" font-size="14">${esc(k)}</text><text x="${W - 25}" y="${y}" fill="${FG}" font-size="14" font-weight="700" text-anchor="end">${esc(v)}</text>`;
});
svg += `</svg>`;
await import("node:fs").then(fs => fs.writeFileSync("stats.svg", svg));

// ---- languages card
const barY = 60, listY = 95, langH = listY + Math.ceil(top.length / 2) * 26 + 20;
let l = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${langH}" viewBox="0 0 ${W} ${langH}" ${FONT}>
<rect width="${W}" height="${langH}" rx="10" fill="${BG}" stroke="#30363d"/>
<text x="25" y="38" fill="${ACC}" font-size="18" font-weight="600">Most used languages</text>
<defs><clipPath id="r"><rect x="25" y="${barY}" width="${W - 50}" height="10" rx="5"/></clipPath></defs><g clip-path="url(#r)">`;
let x = 25;
for (const [, v] of top) { const w = (v.s / total) * (W - 50); l += `<rect x="${x}" y="${barY}" width="${w}" height="10" fill="${v.c}"/>`; x += w; }
l += `</g>`;
top.forEach(([name, v], i) => {
  const col = i % 2, row = Math.floor(i / 2), cx = 25 + col * 230, cy = listY + row * 26;
  l += `<circle cx="${cx + 6}" cy="${cy - 4}" r="6" fill="${v.c}"/><text x="${cx + 20}" y="${cy}" fill="${FG}" font-size="14">${esc(name)} <tspan fill="${MUTED}">${(v.s / total * 100).toFixed(1)}%</tspan></text>`;
});
l += `</svg>`;
await import("node:fs").then(fs => fs.writeFileSync("langs.svg", l));
console.log("ok", { stars, commits, cur, best, langs: top.map(t => t[0]) });
