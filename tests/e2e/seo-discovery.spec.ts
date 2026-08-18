import { expect, test } from "@playwright/test";

test("publishes crawl rules and the canonical public sitemap", async ({ request }) => {
  const robotsResponse = await request.get("/robots.txt");
  expect(robotsResponse.status()).toBe(200);
  expect(robotsResponse.headers()["content-type"]).toContain("text/plain");

  const robots = await robotsResponse.text();
  expect(robots).toContain("User-agent: *");
  expect(robots).toContain("Allow: /");
  expect(robots).toContain("Sitemap: https://365x100.com/sitemap.xml");
  expect(robots).not.toContain("Disallow:");

  const sitemapResponse = await request.get("/sitemap.xml");
  expect(sitemapResponse.status()).toBe(200);
  expect(sitemapResponse.headers()["content-type"]).toMatch(/application\/xml|text\/xml/);

  const sitemap = await sitemapResponse.text();
  const urls = Array.from(sitemap.matchAll(/<loc>([^<]+)<\/loc>/g), (match) => match[1]);

  expect(urls).toEqual([
    "https://365x100.com/",
    "https://365x100.com/privacy",
    "https://365x100.com/terms",
  ]);
  expect(new Set(urls).size).toBe(urls.length);
  expect(sitemap).not.toContain("/auth/callback");
  expect(sitemap).not.toContain("<priority>");
  expect(sitemap).not.toContain("<changefreq>");
  expect(sitemap).not.toContain("<lastmod>");
});

test("keeps the OAuth callback out of search results", async ({ page }) => {
  await page.goto("/auth/callback");

  const robotsMeta = page.locator('meta[name="robots"]');
  await expect(robotsMeta).toHaveAttribute("content", /noindex/);
  await expect(robotsMeta).toHaveAttribute("content", /nofollow/);
});
