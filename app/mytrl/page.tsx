import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { isMyTrlOwner } from "@/lib/mytrl-access";
import MyTrlClient from "./MyTrlClient";

export default async function MyTrlPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.handle) {
    redirect("/login");
  }

  if (!isMyTrlOwner(session.user.handle)) {
    notFound();
  }

  return (
    <Suspense fallback={null}>
      <MyTrlClient />
    </Suspense>
  );
}
