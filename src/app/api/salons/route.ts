import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { query } = await request.json();
    
    // Using the n8n webhook provided in the chat widget as the general data engine
    const response = await fetch("https://n8n.smartden.online/webhook/b74ab3f2-ac1b-416d-8da0-801d3726cd65/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        chatInput: `Find 3 premium hair salons near New York for a person with this profile: ${query}. Return JSON with name, rating, address, and specialities.` 
      })
    });

    if (!response.ok) throw new Error("n8n request failed");
    
    // For now, we return the mock data but "trigger" the workflow
    // In a real scenario, we would parse the n8n response here.
    return NextResponse.json({
      salons: [
        {
          id: "n1",
          name: "n8n Curated: Salon NY",
          rating: 4.9,
          reviews: 150,
          address: "123 Broadway, NY",
          distance: "0.5 miles",
          image: "https://images.unsplash.com/photo-1560066984-138dadb4c035?q=80&w=800&auto=format&fit=crop",
          specialties: ["AI Matched", "Premium"]
        }
      ]
    });
  } catch (error) {
    console.error("Salons API Error:", error);
    return NextResponse.json({ error: "Failed to fetch salons" }, { status: 500 });
  }
}

export async function GET() {
    return NextResponse.json({ error: "Use POST" }, { status: 405 });
}
