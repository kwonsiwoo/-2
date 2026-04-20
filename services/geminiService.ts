
import { GoogleGenAI, Type, Schema } from "@google/genai";
import { HybridRoute, Place } from "../types";

// Initialize Gemini lazily
let ai: GoogleGenAI | null = null;

const getAiClient = () => {
  if (!ai) {
    const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error("GEMINI_API_KEY is missing. Please set it in your environment variables.");
      // We still initialize it so we don't crash, but API calls will fail later
      // Or we can throw an error here, which will be caught by the try-catch in the functions
      throw new Error("GEMINI_API_KEY is missing");
    }
    ai = new GoogleGenAI({ apiKey });
  }
  return ai;
};

const routeSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    taxiCostOnly: { type: Type.NUMBER, description: "Estimated cost if taking a taxi for the entire journey in KRW" },
    routes: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          name: { type: Type.STRING, description: "A catchy name for this route strategy" },
          totalCost: { type: Type.NUMBER, description: "Total cost including bus/subway + final taxi leg" },
          totalDuration: { type: Type.NUMBER, description: "Total duration in minutes" },
          savedAmount: { type: Type.NUMBER, description: "Amount saved compared to full taxi ride" },
          transferPoint: { type: Type.STRING, description: "The location where the user switches to a taxi" },
          departureTime: { type: Type.STRING, description: "Departure time of the first public transport leg in HH:MM format (assume tonight/early morning)" },
          segments: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                type: { type: Type.STRING, enum: ['walk', 'bus', 'subway', 'taxi'] },
                instruction: { type: Type.STRING },
                durationMinutes: { type: Type.NUMBER },
                cost: { type: Type.NUMBER },
                lineName: { type: Type.STRING, nullable: true },
                departureTime: { type: Type.STRING, nullable: true }
              },
              required: ['type', 'instruction', 'durationMinutes', 'cost']
            }
          }
        },
        required: ['id', 'name', 'totalCost', 'totalDuration', 'savedAmount', 'transferPoint', 'segments', 'departureTime']
      }
    }
  },
  required: ['taxiCostOnly', 'routes']
};

const placeSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    places: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          name: { type: Type.STRING, description: "Name of the place in Korean" },
          type: { type: Type.STRING, description: "Category in Korean (e.g. '이자카야', '국밥집', '24시 카페')" },
          rating: { type: Type.STRING, description: "e.g. '4.5'" },
          address: { type: Type.STRING, description: "Address in Korean" },
          description: { type: Type.STRING, description: "Short, fun description in Korean for late night vibe" },
          closingTime: { type: Type.STRING, description: "e.g. '05:00' or '24시간'" },
          tags: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Tags in Korean" },
          imageKeyword: { type: Type.STRING, description: "A single English keyword for image search (e.g. 'izakaya', 'soup', 'coffee', 'beer')"},
          representativeMenu: { type: Type.STRING, description: "Most popular menu item in Korean (e.g. '모둠 오뎅탕', '얼큰 해장국')"},
          distance: { type: Type.STRING, description: "Estimated walking distance (e.g. '300m', '1.2km')"}
        },
        required: ['id', 'name', 'type', 'rating', 'address', 'description', 'closingTime', 'tags', 'imageKeyword', 'representativeMenu', 'distance']
      }
    }
  },
  required: ['places']
};

export const getHybridRoutes = async (start: string, end: string): Promise<{ routes: HybridRoute[], fullTaxiCost: number }> => {
  try {
    const prompt = `
      Current time: ${new Date().toLocaleTimeString('ko-KR')}.
      User is at "${start}" and wants to go to "${end}".
      It is late night in Korea.
      
      SEARCH THE WEB for actual late-night transit options (N-Bus, last subway trains) from "${start}" to "${end}".
      Suggest 3 "Hybrid Routes" to save money compared to taking a taxi all the way.
      A Hybrid Route means taking a late-night bus (N-Bus) or the very last subway train to a "Transfer Point" closer to the destination, and then taking a taxi for the last mile.
      
      The goal is to minimize the "Clock-Out-Of-City" surcharge and long-distance taxi fares.
      
      Provide realistic data for Seoul/Metropolitan area based on your search results.
      If the distance is short, suggest walking + taxi.
      
      Important: Ensure the 3 routes have different departure times to give the user options (e.g. one leaving very soon, one later).
    `;

    const client = getAiClient();
    const response = await client.models.generateContent({
      model: 'gemini-3.1-pro-preview', // Use pro model for complex reasoning and search
      contents: prompt,
      tools: [{ googleSearch: {} }],
      config: {
        responseMimeType: "application/json",
        responseSchema: routeSchema,
        systemInstruction: "You are an expert Korean Transit Navigator app called 'Jjin-Makcha'. You specialize in late-night travel for drunk people who want to save money. Use Google Search to find real late-night bus (N-Bus) routes or last train schedules between the start and end locations. Be precise with KRW costs."
      }
    });

    const data = JSON.parse(response.text || "{}");
    const fullTaxiCost = data.taxiCostOnly || 35000;
    
    // Validate and return
    if (data.routes && Array.isArray(data.routes)) {
      // POST-PROCESSING: Overwrite departure times to ensure UI scenarios
      // Route 1: Urgent (12 mins from now)
      // Route 2: ~30 mins (35 mins from now)
      // Route 3: ~1 hour (75 mins from now)
      const now = new Date();
      const offsets = [12, 35, 75];

      const processedRoutes = data.routes.map((route: any, index: number) => {
         const offset = offsets[index] !== undefined ? offsets[index] : 20;
         const d = new Date(now.getTime() + offset * 60000);
         const hours = d.getHours().toString().padStart(2, '0');
         const minutes = d.getMinutes().toString().padStart(2, '0');
         const newTime = `${hours}:${minutes}`;
         
         return {
             ...route,
             departureTime: newTime
         };
      });

      // ADD "FIRST TRAIN" OPTION MANUALLY
      const firstTrainRoute: HybridRoute = {
        id: 'first-train-option',
        name: '존버하고 첫차 타기 🌅',
        totalCost: 1500,
        totalDuration: 60, // approximate
        savedAmount: fullTaxiCost - 1500,
        transferPoint: '첫차',
        departureTime: '05:00',
        taxiCostOnly: fullTaxiCost,
        segments: [
          { type: 'walk', instruction: '근처 24시 카페나 국밥집으로 이동', durationMinutes: 10, cost: 0 },
          { type: 'subway', instruction: '첫차 탑승', durationMinutes: 50, cost: 1500, departureTime: '05:00', lineName: '첫차' }
        ]
      };

      // Append the first train route
      processedRoutes.push(firstTrainRoute);

      return {
        routes: processedRoutes,
        fullTaxiCost: fullTaxiCost
      };
    }
    
    throw new Error("Invalid response format");
  } catch (error) {
    console.error("Gemini API Error:", error);
    // Return mock data in case of error (or empty state handling in UI)
    return {
      fullTaxiCost: 0,
      routes: []
    };
  }
};

export const getNearbyPlaces = async (location: string): Promise<Place[]> => {
    try {
        const prompt = `
            Recommend 5 late-night places near "${location}" that are likely OPEN NOW (after midnight).
            Include a mix of:
            1. Late night Izakaya or Pub (Sool-jip)
            2. 24h Gukbap (Soup) or Hangover food
            3. 24h Cafe
            
            OUTPUT MUST BE IN KOREAN.
            Generate realistic Korean names, addresses, and descriptions.
            Provide an 'imageKeyword' in English for image search.
            Provide 'representativeMenu' in Korean (e.g. '얼큰 순대국').
            Provide 'distance' estimate (e.g. '350m', '1.2km').
        `;

        const client = getAiClient();
        const response = await client.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: placeSchema,
                systemInstruction: "You are a local guide for Seoul nightlife. You know all the best spots that stay open late. You must respond in Korean."
            }
        });

        const data = JSON.parse(response.text || "{}");
        return data.places || [];
    } catch (error) {
        console.error("Gemini Places API Error:", error);
        return [];
    }
};
