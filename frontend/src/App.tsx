import { Route, Routes } from "react-router-dom";

import { AppShell } from "@/components/app-shell";
import { CampaignsPage } from "@/pages/campaigns";
import { CampaignDetailPage } from "@/pages/campaign-detail";
import { CreateCampaignPage } from "@/pages/create-campaign";
import { SettingsPage } from "@/pages/settings";
import { NotFoundPage } from "@/pages/not-found";

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<CampaignsPage />} />
        <Route path="campaigns/new" element={<CreateCampaignPage />} />
        <Route path="campaigns/:campaignId" element={<CampaignDetailPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
