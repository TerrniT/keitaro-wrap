import type { Page } from "@playwright/test";

import {
  campaignDetail,
  campaignList,
  countries,
  health,
  meta,
  offerSearch,
  settings,
} from "./fixtures";

export interface MockApi {
  getCreatedPayload: () => Record<string, unknown> | null;
}

/**
 * Intercepts every /api request used by the create + detail flow. This makes
 * the browser test deterministic and independent of a running Keitaro.
 */
export async function installMockApi(page: Page): Promise<MockApi> {
  let createdPayload: Record<string, unknown> | null = null;

  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace(/^\/api/, "");
    const method = request.method();

    if (method === "GET" && path === "/health") {
      return route.fulfill({ json: health });
    }
    if (method === "GET" && path === "/meta") {
      return route.fulfill({ json: meta });
    }
    if (method === "GET" && path === "/settings") {
      return route.fulfill({ json: settings });
    }
    if (method === "GET" && path === "/countries") {
      return route.fulfill({ json: countries });
    }
    if (method === "GET" && path === "/offers") {
      return route.fulfill({ json: offerSearch });
    }
    if (method === "GET" && path === "/campaigns") {
      return route.fulfill({ json: campaignList });
    }
    if (method === "GET" && path === "/campaigns/999001") {
      return route.fulfill({ json: campaignDetail });
    }
    if (method === "POST" && path === "/campaigns") {
      createdPayload = request.postDataJSON() as Record<string, unknown>;
      return route.fulfill({ status: 201, json: campaignDetail });
    }

    return route.fulfill({
      status: 404,
      json: { detail: `Mock API: no handler for ${method} ${path}` },
    });
  });

  return { getCreatedPayload: () => createdPayload };
}
