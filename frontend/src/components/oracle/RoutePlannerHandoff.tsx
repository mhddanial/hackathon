"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import { Button } from "@/components/ui/button";
import { routeInputFromResult, saveRouteDraft } from "@/lib/route-draft";
import type { RouteData } from "@/types/route";

export function RoutePlannerHandoff({
  data,
  incomplete,
}: {
  data: RouteData;
  incomplete: boolean;
}) {
  const { user } = useAuth();
  const router = useRouter();
  const [error, setError] = useState("");
  let available = !incomplete;
  try {
    routeInputFromResult(data);
  } catch {
    available = false;
  }
  const open = () => {
    try {
      if (!user || !available) return;
      const id = saveRouteDraft(
        routeInputFromResult(data),
        user.id,
        window.sessionStorage,
      );
      router.push(`/planner?draft=${id}`);
    } catch {
      setError(
        "Draft storage is unavailable. Copy the planning inputs into the Planner instead.",
      );
    }
  };
  return (
    <div className="space-y-2">
      <Button variant="outline" onClick={open} disabled={!available || !user}>
        Edit in Route Planner
      </Button>
      {!available && (
        <p className="text-xs text-muted-foreground">
          A completed result with saved planning inputs is required to open an
          editable draft.
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
