import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function TipAlias({ searchParams }: { searchParams?: { to?: string | string[] } }) {
  const to = Array.isArray(searchParams?.to) ? searchParams?.to[0] : searchParams?.to;
  redirect(to ? `/?to=${encodeURIComponent(to)}` : "/");
}
