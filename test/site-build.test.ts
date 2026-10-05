/**
 * Checks the built website (dist/web) for the machine-readable promises the
 * site makes to agents. Runs after `npm run build` (as in CI); skipped when
 * the site has not been built.
 */
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const root = new URL("../dist/web/", import.meta.url);
const built = existsSync(new URL("index.html", root));
const read = (p: string) => readFileSync(new URL(p, root), "utf8");
const text = (html: string) =>
  html
    .replace(/<script[\s\S]*?<\/script>/g, "")
    .replace(/<style[\s\S]*?<\/style>/g, "")
    .replace(/<header[\s\S]*?<\/header>/g, "")
    .replace(/<footer[\s\S]*?<\/footer>/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
const jsonLd = (html: string) => JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)![1]!) as { "@graph": Record<string, unknown>[] };

describe.skipIf(!built)("built website", () => {
  it.each(["about", "contact", "privacy"])("has a substantial /%s trust page with a Markdown twin", (page) => {
    expect(text(read(`${page}/index.html`)).length).toBeGreaterThan(500);
    expect(read(`${page}.md`).length).toBeGreaterThan(500);
  });

  it("lists the trust and policy pages in the sitemap", () => {
    const sitemap = read("sitemap-0.xml");
    for (const p of ["/about", "/contact", "/privacy", "/docs/api/versioning", "/docs/cli"]) expect(sitemap).toContain(`https://3d.shep.bot${p}<`);
  });

  it("gives agents when-to-use guidance in llms.txt (llmstxt.org layout) and AGENTS.md", () => {
    const llms = read("llms.txt");
    expect(llms.startsWith("# 3D Asset Server\n\n> ")).toBe(true);
    const beforeSections = llms.slice(0, llms.indexOf("\n## "));
    expect(beforeSections).toContain("When to use 3D Asset Server");
    expect(beforeSections).not.toMatch(/\n#{1,6} /); // free-form part has no headings
    expect(llms).toContain("/about.md");
    const agents = read("AGENTS.md");
    expect(agents).toContain("## When to use this");
    expect(agents).toContain("## When not to use it");
  });

  it("publishes an Organization with contact points", () => {
    const org = jsonLd(read("index.html"))["@graph"].find((n) => n["@type"] === "Organization") as { contactPoint: { url: string }[] };
    expect(org.contactPoint.length).toBeGreaterThan(0);
    expect(org.contactPoint[0]!.url).toBe("https://3d.shep.bot/contact");
  });

  it("documents versioning, deprecation and rate limits", () => {
    const page = text(read("docs/api/versioning/index.html"));
    for (const term of ["Deprecation", "Sunset", "Retry-After", "RateLimit-Policy", "90 days"]) expect(page).toContain(term);
  });

  it("names the product in the homepage title and H1", () => {
    const home = read("index.html");
    expect(home).toMatch(/<title>3D Asset Server[^<]*<\/title>/);
    expect(home.match(/<h1[\s\S]*?<\/h1>/)![0]).toContain("3D Asset Server");
  });
});
