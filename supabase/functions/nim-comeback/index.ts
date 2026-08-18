// This function has been deprecated and removed.
// The comeback planner feature is no longer available.
Deno.serve(async () => {
  return new Response(JSON.stringify({ error: "This feature has been deprecated" }), {
    status: 410,
    headers: { "Content-Type": "application/json" },
  });
});