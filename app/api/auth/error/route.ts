import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const error = searchParams.get("error");

  let errorMessage = "An unknown error occurred";

  if (error === "AccessDenied") {
    errorMessage =
      "Access was denied. You may have declined the authorization request.";
  } else if (error === "Configuration") {
    errorMessage = "There is a problem with the server configuration.";
  } else if (error) {
    errorMessage = `An error occurred: ${error}`;
  }

  return NextResponse.json({ error: errorMessage }, { status: 400 });
}
