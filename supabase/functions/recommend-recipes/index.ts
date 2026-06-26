import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';

interface RecommendRequest {
  preferences: {
    likedIngredients: string[];
    dislikedIngredients: string[];
    dietaryTags: string[];
    allergies: string[];
    defaultServings: number;
  };
  existingRecipeTitles: string[];
  count?: number;
}

interface GeneratedRecipe {
  title: string;
  description: string;
  ingredients: { id: string; name: string; quantity: string; unit: string; category: string }[];
  steps: string[];
  tags: string[];
  duration: number;
  servings: number;
  difficulty: 'Facile' | 'Moyen' | 'Difficile';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('ONSPACE_AI_API_KEY');
    const baseUrl = Deno.env.get('ONSPACE_AI_BASE_URL');

    if (!apiKey || !baseUrl) {
      return new Response(
        JSON.stringify({ error: 'OnSpace AI not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body: RecommendRequest = await req.json();
    const { preferences, existingRecipeTitles, count = 3 } = body;

    // Build context prompt
    const liked = preferences.likedIngredients.length > 0
      ? `Ingrédients aimés: ${preferences.likedIngredients.join(', ')}`
      : '';
    const disliked = preferences.dislikedIngredients.length > 0
      ? `Ingrédients à éviter: ${preferences.dislikedIngredients.join(', ')}`
      : '';
    const diet = preferences.dietaryTags.length > 0
      ? `Régimes: ${preferences.dietaryTags.join(', ')}`
      : '';
    const allergies = preferences.allergies.length > 0
      ? `Allergies: ${preferences.allergies.join(', ')}`
      : '';
    const existing = existingRecipeTitles.length > 0
      ? `Évite ces recettes déjà connues: ${existingRecipeTitles.slice(0, 10).join(', ')}`
      : '';

    const userContext = [liked, disliked, diet, allergies, existing].filter(Boolean).join('\n');

    const systemPrompt = `Tu es un chef cuisinier français expert. Tu génères des recettes personnalisées en JSON.
Respecte STRICTEMENT ce format JSON sans aucun texte autour:
{
  "recipes": [
    {
      "title": "Nom de la recette",
      "description": "Description appétissante en 1-2 phrases",
      "ingredients": [
        { "id": "i1", "name": "Nom", "quantity": "200", "unit": "g", "category": "Légumes" }
      ],
      "steps": ["Étape 1...", "Étape 2..."],
      "tags": ["Tag1", "Tag2"],
      "duration": 30,
      "servings": ${preferences.defaultServings || 4},
      "difficulty": "Facile"
    }
  ]
}
Les catégories d'ingrédients doivent être parmi: Légumes, Viandes, Poissons, Fruits, Produits laitiers, Céréales & Féculents, Épices & Herbes, Huiles & Condiments, Boissons.
difficulty doit être exactement "Facile", "Moyen", ou "Difficile".
Génère exactement ${count} recettes variées, savoureuses et réalisables à la maison.`;

    const userMessage = `Génère ${count} recettes de cuisine françaises personnalisées.\n${userContext}\n\nLes recettes doivent être variées (entrée, plat, dessert si possible) et adaptées aux préférences ci-dessus.`;

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        temperature: 0.8,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('OnSpace AI error:', errText);
      return new Response(
        JSON.stringify({ error: `OnSpace AI: ${errText}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content ?? '';

    // Parse JSON from response
    let recipes: GeneratedRecipe[] = [];
    try {
      // Extract JSON block if wrapped in markdown
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        recipes = parsed.recipes ?? [];
      }
    } catch (e) {
      console.error('JSON parse error:', e, 'Content:', content);
      return new Response(
        JSON.stringify({ error: 'Failed to parse AI response', raw: content }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ recipes }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Function error:', error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
