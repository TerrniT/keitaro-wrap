/**
 * Deterministic Keitaro fixture for the browser E2E test. The shape mirrors
 * the FastAPI responses so the real React app renders exactly as it does
 * against a live tracker.
 */

export const ZERO = {
  clicks: 0,
  conversions: 0,
  revenue: 0,
  cost: 0,
  profit: 0,
  roi: 0,
  cr: 0,
  epc: 0,
};

export const countries = [
  { code: "DE", name: "Germany", flag: "🇩🇪" },
  { code: "US", name: "United States", flag: "🇺🇸" },
  { code: "AU", name: "Australia", flag: "🇦🇺" },
];

export const settings = {
  campaign_prefix: "test_kotovsky_",
  default_domain_id: 1,
  default_group_id: 1,
  default_traffic_source_id: 1,
  offers_synced_at: "2026-11-16T12:00:00+00:00",
  offers_cached: 1,
  keitaro_base_url: "https://tracker.example.test",
  api_key_configured: true,
};

export const meta = {
  settings,
  domains: [
    {
      id: 1,
      name: "tracker.example.test",
      state: "active",
      is_ssl: true,
      campaigns_count: 1,
    },
  ],
  groups: [{ id: 1, name: "E2E group", position: 1, type: "campaigns" }],
  sources: [{ id: 1, name: "E2E source", state: "active" }],
  countries,
  keitaro_base_url: "https://tracker.example.test",
  api_key_configured: true,
  connection_ok: true,
  connection_error: null,
};

export const offer = {
  id: 10184,
  name: "10184 E2E Flexacil offer",
  country: ["DE"],
  group_id: 1,
  state: "active",
};

export const offerSearch = { items: [offer], total: 1, cached: true };

export const campaign = {
  id: 999001,
  name: "test_kotovsky_e2e_campaign",
  alias: "test-kotovsky-e2e-campaign-abc123",
  state: "active",
  type: "position",
  group_id: 1,
  group: "E2E group",
  domain_id: 1,
  domain: "https://tracker.example.test/",
  traffic_source_id: 1,
  traffic_source: "E2E source",
  streams_count: 2,
  currency: "USD",
  clicks: 0,
  conversions: 0,
  revenue: 0,
  cost: 0,
  profit: 0,
  roi: 0,
  cr: 0,
  created_at: "2026-11-16 12:00:00",
  updated_at: "2026-11-16 12:00:00",
  geo: ["DE"],
  offer_id: 10184,
  test_url: "https://tracker.example.test/test-kotovsky-e2e-campaign-abc123",
  admin_url:
    "https://tracker.example.test/admin/#!/campaign/999001/main",
};

export const streams = [
  {
    id: 1001,
    name: "Google",
    position: 1,
    type: "regular",
    schema: "redirect",
    state: "active",
    action_type: "http",
    action_payload: "https://www.google.com",
    filters: [{ name: "country", mode: "accept", payload: ["DE"] }],
    country_filter: ["DE"],
    clicks_today: 0,
    stats: ZERO,
    offers: [],
    removed_offers: [],
  },
  {
    id: 1002,
    name: "Offers",
    position: 2,
    type: "regular",
    schema: "landings",
    state: "active",
    action_type: "http",
    action_payload: "",
    filters: [],
    country_filter: [],
    clicks_today: 0,
    stats: ZERO,
    offers: [
      {
        offer_id: 10184,
        name: offer.name,
        share: 100,
        state: "active",
        country: ["DE"],
        stats: ZERO,
        trend: [{ date: "2026-11-16", clicks: 0, conversions: 0, profit: 0 }],
      },
    ],
    removed_offers: [],
  },
];

export const campaignDetail = {
  campaign,
  streams,
  interval: "today",
  totals: ZERO,
  has_removed_offers: false,
};

export const campaignList = {
  items: [campaign],
  total: 1,
  interval: "today",
  totals: ZERO,
};

export const health = {
  status: "ok",
  app: "Keitaro Wrapper",
  keitaro_connected: true,
  keitaro_error: null,
};
