const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "/api";

export class ApiError extends Error {
  status: number;
  details?: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
    ...options,
  });

  if (!response.ok) {
    let message = `Ошибка ${response.status}`;
    let details: unknown;
    try {
      const body = await response.json();
      details = body;
      if (typeof body?.detail === "string") message = body.detail;
      else if (Array.isArray(body?.detail)) message = body.detail.map((item: any) => item.msg).join("; ");
    } catch {
      message = response.statusText || message;
    }
    throw new ApiError(message, response.status, details);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export interface StatMetrics {
  clicks: number;
  conversions: number;
  revenue: number;
  cost: number;
  profit: number;
  roi: number;
  cr: number;
  epc: number;
}

export interface TrendPoint {
  date: string;
  clicks: number;
  conversions: number;
  profit: number;
}

export interface Country {
  code: string;
  name: string;
  flag: string;
}

export interface Offer {
  id: number;
  name: string;
  country: string[];
  group_id: number | null;
  state: string;
}

export interface Domain {
  id: number;
  name: string;
  state: string;
  is_ssl: boolean;
  campaigns_count: number;
}

export interface Group {
  id: number;
  name: string;
  position: number;
  type: string;
}

export interface Source {
  id: number;
  name: string;
  state: string;
}

export interface Settings {
  campaign_prefix: string;
  default_domain_id: number | null;
  default_group_id: number | null;
  default_traffic_source_id: number | null;
  offers_synced_at: string | null;
  offers_cached: number;
  keitaro_base_url: string;
  api_key_configured: boolean;
}

export interface Meta {
  settings: Settings;
  domains: Domain[];
  groups: Group[];
  sources: Source[];
  countries: Country[];
  keitaro_base_url: string;
  api_key_configured: boolean;
  connection_ok: boolean;
  connection_error: string | null;
}

export interface CampaignSummary {
  id: number;
  name: string;
  alias: string;
  state: string;
  type: string;
  group_id: number | null;
  group: string | null;
  domain_id: number | null;
  domain: string | null;
  traffic_source_id: number | null;
  traffic_source: string | null;
  streams_count: number;
  currency: string;
  clicks: number;
  conversions: number;
  revenue: number;
  cost: number;
  profit: number;
  roi: number;
  cr: number;
  created_at: string | null;
  updated_at: string | null;
  geo: string[];
  offer_id: number | null;
  test_url: string | null;
  admin_url: string | null;
}

export interface CampaignList {
  items: CampaignSummary[];
  total: number;
  interval: string;
  totals: StatMetrics;
}

export interface StreamOffer {
  offer_id: number;
  name: string;
  share: number;
  state: "active" | "disabled" | "removed";
  country: string[];
  stats: StatMetrics;
  trend: TrendPoint[];
}

export interface Stream {
  id: number;
  name: string;
  position: number;
  type: string;
  schema: string;
  state: string;
  action_type: string | null;
  action_payload: string | null;
  filters: Record<string, any>[];
  country_filter: string[];
  clicks_today: number;
  stats: StatMetrics;
  offers: StreamOffer[];
  removed_offers: StreamOffer[];
}

export interface CampaignDetail {
  campaign: CampaignSummary;
  streams: Stream[];
  interval: string;
  totals: StatMetrics;
  has_removed_offers: boolean;
}

export interface CampaignStats {
  campaign_id: number;
  interval: string;
  totals: StatMetrics;
  streams: Record<string, StatMetrics>;
  offers: Record<string, StatMetrics>;
  trends: Record<string, TrendPoint[]>;
  clicks_today: Record<string, number>;
  trend_dates: string[];
}

export interface OfferSearch {
  items: Offer[];
  total: number;
  cached: boolean;
}

export interface Health {
  status: string;
  app: string;
  keitaro_connected: boolean;
  keitaro_error: string | null;
}

export interface CreateCampaignPayload {
  name: string;
  geo: string[];
  offer_id: number;
  domain_id?: number | null;
  group_id?: number | null;
  traffic_source_id?: number | null;
}

export interface StreamOfferPayload {
  offer_id: number;
  share: number;
  state: "active" | "disabled";
}

export const api = {
  health: () => request<Health>("/health"),
  meta: (refresh = false) => request<Meta>(`/meta${refresh ? "?refresh=true" : ""}`),
  countries: () => request<Country[]>("/countries"),
  settings: () => request<Settings>("/settings"),
  updateSettings: (payload: Partial<Settings>) =>
    request<Settings>("/settings", { method: "PUT", body: JSON.stringify(payload) }),
  campaigns: (search = "", interval = "today") => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    params.set("interval", interval);
    return request<CampaignList>(`/campaigns?${params.toString()}`);
  },
  campaign: (id: number, interval = "today") =>
    request<CampaignDetail>(`/campaigns/${id}?interval=${interval}`),
  stats: (id: number, interval = "today") =>
    request<CampaignStats>(`/campaigns/${id}/stats?interval=${interval}`),
  createCampaign: (payload: CreateCampaignPayload) =>
    request<CampaignDetail>("/campaigns", { method: "POST", body: JSON.stringify(payload) }),
  archiveCampaign: (id: number) =>
    request<void>(`/campaigns/${id}`, { method: "DELETE" }),
  offers: (q = "", limit = 30) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    params.set("limit", String(limit));
    return request<OfferSearch>(`/offers?${params.toString()}`);
  },
  syncOffers: () => request<{ synced: number; synced_at: string }>("/offers/sync", { method: "POST" }),
  saveStreamOffers: (campaignId: number, streamId: number, offers: StreamOfferPayload[]) =>
    request<Stream>(`/campaigns/${campaignId}/streams/${streamId}/offers`, {
      method: "PUT",
      body: JSON.stringify({ offers }),
    }),
  addOffer: (campaignId: number, streamId: number, offerId: number) =>
    request<Stream>(`/campaigns/${campaignId}/streams/${streamId}/offers`, {
      method: "POST",
      body: JSON.stringify({ offer_id: offerId }),
    }),
  removeOffer: (campaignId: number, streamId: number, offerId: number) =>
    request<Stream>(`/campaigns/${campaignId}/streams/${streamId}/offers/${offerId}`, {
      method: "DELETE",
    }),
  restoreOffer: (campaignId: number, streamId: number, offerId: number) =>
    request<Stream>(
      `/campaigns/${campaignId}/streams/${streamId}/offers/${offerId}/restore`,
      { method: "POST" },
    ),
};
