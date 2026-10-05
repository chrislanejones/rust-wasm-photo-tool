// The e2e backend guard's rules (e2e/guard/backend.ts). The guard itself was
// proven red and green against real Playwright runs (see the PR); this pins
// the rules so a later edit cannot quietly widen them.
import { describe, expect, it } from "vitest";
import {
  PLACEHOLDER_CONVEX_URL,
  assertPlaceholderConvexUrl,
  convexHostsIn,
  demoEnv,
  disallowedHosts,
  forbiddenRequestReason,
  importsUnguardedTest,
} from "../../../e2e/guard/backend";

describe("assertPlaceholderConvexUrl", () => {
  it("accepts the placeholder and reserved-TLD hosts", () => {
    expect(() => assertPlaceholderConvexUrl(PLACEHOLDER_CONVEX_URL)).not.toThrow();
    expect(() => assertPlaceholderConvexUrl("https://nothing.invalid")).not.toThrow();
  });

  it("refuses the live deployment, any other convex.cloud name, and garbage", () => {
    expect(() => assertPlaceholderConvexUrl("https://brave-ant-608.convex.cloud")).toThrow(/REAL deployment host/);
    expect(() => assertPlaceholderConvexUrl("https://smoke-placeholder-124.convex.cloud")).toThrow(/REAL/);
    expect(() => assertPlaceholderConvexUrl("not a url")).toThrow(/not a URL/);
  });

  it("builds the same env string the configs used before the guard existed", () => {
    expect(demoEnv()).toBe(
      'VITE_CONVEX_URL="https://smoke-placeholder-123.convex.cloud" ' +
        'VITE_CLERK_PUBLISHABLE_KEY="pk_test_Y2xlcmsuc21va2UuaW52YWxpZCQ="',
    );
  });
});

describe("forbiddenRequestReason", () => {
  it("flags a real Convex host over http and websocket, and .convex.site", () => {
    expect(forbiddenRequestReason("https://brave-ant-608.convex.cloud/api/query")).toMatch(/real Convex deployment host/);
    expect(forbiddenRequestReason("wss://brave-ant-608.convex.cloud/api/1.42.0/sync")).toMatch(/real Convex/);
    expect(forbiddenRequestReason("https://brave-ant-608.convex.site/stripe")).toMatch(/real Convex/);
  });

  it("flags the upload path on ANY host, the placeholder included", () => {
    expect(forbiddenRequestReason(`${PLACEHOLDER_CONVEX_URL}/api/storage/upload?token=x`)).toBe("Convex upload URL path");
    expect(forbiddenRequestReason("http://localhost:4311/api/storage/upload")).toBe("Convex upload URL path");
  });

  it("allows the placeholder, localhost, blob/data URLs and unrelated hosts", () => {
    expect(forbiddenRequestReason(`${PLACEHOLDER_CONVEX_URL}/api/1.42.0/sync`)).toBeNull();
    expect(forbiddenRequestReason("http://localhost:4311/assets/index.js")).toBeNull();
    expect(forbiddenRequestReason("blob:http://localhost:4311/abc")).toBeNull();
    expect(forbiddenRequestReason("data:image/png;base64,AAAA")).toBeNull();
    expect(forbiddenRequestReason("https://fonts.example/x.woff2")).toBeNull();
    expect(forbiddenRequestReason("https://notconvex.cloud/")).toBeNull();
  });
});

describe("bundle scan helpers", () => {
  it("finds Convex hosts in bundled text and keeps only the disallowed ones", () => {
    const text = 'var a=`https://smoke-placeholder-123.convex.cloud`;fetch("https://brave-ant-608.convex.cloud/x")';
    const hosts = convexHostsIn(text);
    expect(hosts.sort()).toEqual(["brave-ant-608.convex.cloud", "smoke-placeholder-123.convex.cloud"]);
    expect(disallowedHosts(hosts)).toEqual(["brave-ant-608.convex.cloud"]);
  });
});

describe("importsUnguardedTest", () => {
  it("flags `test` imported from @playwright/test", () => {
    expect(importsUnguardedTest('import { test, expect, type Page } from "@playwright/test";')).toBe(true);
    expect(importsUnguardedTest("import { expect, test as base } from '@playwright/test';")).toBe(true);
  });

  it("allows type-only imports, expect alone, and the guarded module", () => {
    expect(importsUnguardedTest('import type { Page, TestInfo } from "@playwright/test";')).toBe(false);
    expect(importsUnguardedTest('import { expect, type Page } from "@playwright/test";')).toBe(false);
    expect(importsUnguardedTest('import { test, expect } from "./guard/test";')).toBe(false);
  });
});
