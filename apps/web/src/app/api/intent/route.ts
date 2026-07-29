import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";

import { parseIntent } from "@/lib/agent/intent-parser";

const RequestSchema = z.object({
  message: z.string().min(1, "Message cannot be empty."),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message } = RequestSchema.parse(body);

    const intent = await parseIntent(message);

    return NextResponse.json({ success: true, intent }, { status: 200 });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: "Validation failed",
          details: error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        },
        { status: 422 }
      );
    }

    if (error instanceof Error) {
      if (error.message.includes("GOOGLE_API_KEY")) {
        return NextResponse.json(
          { success: false, error: "Server misconfiguration: missing API key." },
          { status: 500 }
        );
      }

      if (error.message.includes("empty message")) {
        return NextResponse.json(
          { success: false, error: error.message },
          { status: 400 }
        );
      }

      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: false, error: "An unexpected error occurred." },
      { status: 500 }
    );
  }
}
