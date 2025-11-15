import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { DOMParser } from "https://deno.land/x/deno_dom@v0.1.38/deno-dom-wasm.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { wikipediaUrl } = await req.json();
    
    if (!wikipediaUrl) {
      return new Response(
        JSON.stringify({ error: 'Wikipedia URL is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate Wikipedia URL to prevent SSRF attacks
    try {
      const parsed = new URL(wikipediaUrl);
      if (!parsed.hostname.endsWith('.wikipedia.org') || 
          (parsed.protocol !== 'http:' && parsed.protocol !== 'https:')) {
        return new Response(
          JSON.stringify({ error: 'Invalid Wikipedia URL. Must be from *.wikipedia.org' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid URL format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Fetching Wikipedia article:', wikipediaUrl);

    // Fetch Wikipedia page
    const wikiResponse = await fetch(wikipediaUrl);
    if (!wikiResponse.ok) {
      throw new Error('Failed to fetch Wikipedia article');
    }

    const html = await wikiResponse.text();
    
    // Parse HTML and extract article content
    const doc = new DOMParser().parseFromString(html, 'text/html');
    if (!doc) {
      throw new Error('Failed to parse Wikipedia HTML');
    }

    // Extract article title
    const title = doc.querySelector('#firstHeading')?.textContent?.trim() || 'Unknown Article';
    
    // Extract main content paragraphs (skip references, navigation, etc.)
    const contentDiv = doc.querySelector('#mw-content-text .mw-parser-output');
    if (!contentDiv) {
      throw new Error('Could not find article content');
    }

    // Get all paragraphs and filter out unwanted content
    const paragraphs = Array.from(contentDiv.querySelectorAll('p'))
      .map(p => p.textContent?.trim())
      .filter(text => text && text.length > 50); // Only keep substantial paragraphs

    const articleText = paragraphs.join('\n\n').slice(0, 15000); // Limit to ~15k chars

    if (articleText.length < 500) {
      throw new Error('Article content is too short to generate a meaningful quiz');
    }

    console.log('Article extracted, length:', articleText.length);

    // Call Lovable AI to generate quiz
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const systemPrompt = `You are an AI model trained to convert Wikipedia article text into structured educational content.

Your task:
1. Summarize the article (80–120 words)
2. Identify key people, organizations, and locations mentioned
3. Detect major sections or thematic divisions
4. Generate 5–10 multiple-choice quiz questions with:
   - question
   - four answer options (A-D)
   - correct answer (must be one of: A, B, C, or D)
   - difficulty level: easy/medium/hard
   - explanation grounded strictly in the article
5. Suggest 3–8 related Wikipedia topics based on themes in the article

Constraints:
- Use ONLY the article text; do not assume external facts.
- Output MUST be valid JSON following this schema:

{
  "title": "",
  "summary": "",
  "key_entities": {
    "people": [],
    "organizations": [],
    "locations": []
  },
  "sections": [],
  "quiz": [
    {
      "question": "",
      "options": ["", "", "", ""],
      "answer": "",
      "difficulty": "",
      "explanation": ""
    }
  ],
  "related_topics": []
}

Respond with JSON only.`;

    console.log('Calling Lovable AI for quiz generation...');

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Article Title: ${title}\n\nArticle Content:\n${articleText}` }
        ],
        temperature: 0.7,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Payment required. Please add credits to your Lovable AI workspace.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error('AI generation failed');
    }

    const aiData = await aiResponse.json();
    console.log('AI response received');

    // Extract the generated content
    const generatedContent = aiData.choices[0].message.content;
    
    // Parse the JSON response from AI
    let quizData;
    try {
      // Try to extract JSON from markdown code blocks if present
      const jsonMatch = generatedContent.match(/```json\n([\s\S]*?)\n```/) || 
                       generatedContent.match(/```\n([\s\S]*?)\n```/);
      
      const jsonText = jsonMatch ? jsonMatch[1] : generatedContent;
      quizData = JSON.parse(jsonText);
    } catch (parseError) {
      console.error('Failed to parse AI response:', generatedContent);
      throw new Error('Invalid JSON response from AI');
    }

    // Add the Wikipedia URL to the response
    quizData.wikipedia_url = wikipediaUrl;

    console.log('Quiz generated successfully with', quizData.quiz?.length, 'questions');

    return new Response(
      JSON.stringify(quizData),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in generate-quiz function:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Failed to generate quiz' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});