import { createFileRoute } from "@tanstack/react-router";
import { MessagesSquare } from "lucide-react";

export const Route = createFileRoute("/_authenticated/chat/")({
  component: () => (
    <div className="flex h-full flex-col items-center justify-center p-10 text-center">
      <MessagesSquare className="h-10 w-10 text-gold" />
      <h2 className="mt-4 text-2xl font-semibold">Your NUML Chat Room</h2>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">Search classmates and teachers by NUML ID, connect, then chat and share Word documents.</p>
    </div>
  ),
});
