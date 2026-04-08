import { NextResponse } from "next/server";
import { initSchema } from "@/lib/neo4j";

export async function POST() {
  try {
    await initSchema();
    return NextResponse.json({ success: true, message: "Schema initialized" });
  } catch (error) {
    console.error("Schema init error:", error);
    return NextResponse.json(
      { error: "Failed to initialize schema" },
      { status: 500 }
    );
  }
}
