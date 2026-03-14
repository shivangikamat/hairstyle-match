import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({
    suggestions: [
      {
        name: "Textured Bob",
        reason: "Works well with oval faces and adds volume.",
      },
      {
        name: "Curtain Layers",
        reason: "Soft framing layers that suit most face shapes.",
      },
      {
        name: "Butterfly Cut",
        reason: "Keeps length while adding movement and volume.",
      },
    ],
  });
}
