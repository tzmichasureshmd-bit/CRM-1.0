import { redirect } from "next/navigation"

// Bot Flow Builder is the conversation-automation studio. The visual
// chatbot builder lives at /flows; this route is the sidebar entry point.
export default function BotFlowBuilderPage() {
  redirect("/flows")
}
