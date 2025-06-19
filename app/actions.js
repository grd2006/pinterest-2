// app/actions.js
"use server"; // This directive marks all functions in this file as Server Actions.

export async function fetchRandomPhotosWithISR(count = 10) {
  const ACCESS_KEY = process.env.NEXT_PUBLIC_ACCESS_KEY;
  const url = `https://api.unsplash.com/photos/random?count=${count}`;

  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `Client-ID ${ACCESS_KEY}`,
      },
      // This is where the ISR caching happens!
      // This specific fetch request will be cached and revalidated.
      next: { revalidate: 300 } // Revalidate every 5 minutes (300 seconds)
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch photos. Status: ${res.status}`);
    }

    const data = await res.json();
    
    // Ensure the return value is always an array, just like your original logic
    const photos = Array.isArray(data) ? data : [data];

    // Server Actions must return a plain, serializable object.
    return { photos, error: null };

  } catch (error) {
    console.error("Server Action Error (fetchRandomPhotosWithISR):", error.message);
    return { photos: [], error: error.message };
  }
}