import { redirect } from "next/navigation";

export default async function PeopleCompatibilityPage({ searchParams }: { searchParams: Promise<{ invite?: string }> }) {
  const inviteStatus = (await searchParams).invite;
  redirect(inviteStatus ? `/admin/people?invite=${encodeURIComponent(inviteStatus)}` : "/admin/people");
}
