import { saveRoleMenu } from "@/lib/bot/role-menu-routes";

/** Creates a role menu (not posted yet: the dashboard's "publish" does that). */
export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return saveRoleMenu(request, id, null);
}
