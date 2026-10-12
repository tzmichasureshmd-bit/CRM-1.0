import { redirect } from "next/navigation"

// "Automation Flows" is the business-process automation module. It lives at
// /automations (event → condition → action workflows), which is a separate
// surface from the conversation bot builder at /flows.
export default function AutomationFlowsPage() {
  redirect("/automations")
}
