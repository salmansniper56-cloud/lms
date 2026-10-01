import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { z } from "zod";
import { createThread } from "./ai";
import { Loading } from "@/components/query-state";

export const Route = createFileRoute("/_authenticated/ai/")({
  validateSearch: z.object({ prompt: z.string().optional() }),
  component: AiIndex,
});

function AiIndex() {
  const { prompt } = Route.useSearch();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    createThread(prompt ? prompt.slice(0, 60) : "New conversation").then((id) => {
      qc.invalidateQueries({ queryKey: ["ai-threads"] });
      navigate({ to: "/ai/$threadId", params: { threadId: id }, search: { prompt }, replace: true });
    });
  }, [prompt, navigate, qc]);
  return <Loading />;
}
