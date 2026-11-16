import { Link } from "react-router-dom";
import { Compass } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";

export function NotFoundPage() {
  return (
    <div className="rounded-xl border bg-card">
      <EmptyState
        icon={Compass}
        title="Страница не найдена"
        description="Похоже, ссылка устарела или в адресе опечатка."
        action={
          <Button asChild>
            <Link to="/">Вернуться к кампаниям</Link>
          </Button>
        }
      />
    </div>
  );
}
