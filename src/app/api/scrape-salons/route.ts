export async function GET() {
  return new Response(JSON.stringify({ message: "Not implemented yet." }), {
    status: 501,
    headers: { "Content-Type": "application/json" },
  });
}
