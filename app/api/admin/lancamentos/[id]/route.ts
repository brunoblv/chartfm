import { NextRequest, NextResponse } from "next/server";
import { requirePrivilegedSession } from "@/lib/admin-auth";
import {
  activateWeeklyRelease,
  addAlbumToRelease,
  deactivateWeeklyRelease,
  deleteWeeklyRelease,
  removeAlbumFromRelease,
  reorderReleaseAlbums,
  updateWeeklyReleaseLabel,
} from "@/lib/weekly-releases";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = await requirePrivilegedSession();
  if (!auth) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { id } = await params;
  const body = (await req.json()) as {
    action?: "activate" | "deactivate" | "addAlbum" | "removeAlbum" | "reorder";
    weekLabel?: string;
    albumId?: number;
    albumIds?: number[];
  };

  if (body.action === "activate") {
    const result = await activateWeeklyRelease(id);
    return NextResponse.json(result);
  }

  if (body.action === "deactivate") {
    const result = await deactivateWeeklyRelease(id);
    return NextResponse.json(result);
  }

  if (body.action === "addAlbum" && body.albumId != null) {
    const result = await addAlbumToRelease(id, body.albumId);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json(result);
  }

  if (body.action === "removeAlbum" && body.albumId != null) {
    const result = await removeAlbumFromRelease(id, body.albumId);
    return NextResponse.json(result);
  }

  if (body.action === "reorder" && body.albumIds) {
    const result = await reorderReleaseAlbums(id, body.albumIds);
    return NextResponse.json(result);
  }

  if (body.weekLabel !== undefined) {
    const result = await updateWeeklyReleaseLabel(id, body.weekLabel);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json(result);
  }

  return NextResponse.json({ error: "unknown_action" }, { status: 400 });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const auth = await requirePrivilegedSession();
  if (!auth) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { id } = await params;
  const result = await deleteWeeklyRelease(id);
  return NextResponse.json(result);
}
