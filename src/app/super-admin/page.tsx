import { AdminDashboard } from "@/app/admin/page";

export const dynamic = "force-dynamic";

export default function SuperAdminPage() {
  return <AdminDashboard basePath="/super-admin" />;
}
