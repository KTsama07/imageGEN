import { GoogleGenAI, GenerateContentResponse, Part } from "@google/genai";

const apiKey = process.env.API_KEY;
if (!apiKey) {
  console.error("API_KEY environment variable is not set.");
  // It's better to throw here or handle it in a way that App can show a persistent error
}

const ai = new GoogleGenAI({ apiKey: apiKey || "MISSING_API_KEY" }); // apiKey must be passed in an object

// Single file conversion, to be mapped over an array of files if multiple are provided
const convertFileToPart = (file: File): Promise<Part> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      const mimeType = result.substring(result.indexOf(':') + 1, result.indexOf(';'));
      const base64Data = result.substring(result.indexOf(',') + 1);
      resolve({ inlineData: { data: base64Data, mimeType } });
    };
    reader.onerror = (error) => reject(error);
  });
};

export const generateImage = async ( // Renamed from generateAnimeImage
  userPrompt: string,
  imageStyle: string, // New parameter
  referenceImageFiles?: File[],
  numberOfImages: number = 1,
  aspectRatio: string = '1:1'
): Promise<string[]> => {
  if (!apiKey) {
    throw new Error("API_KEY is not configured. Please set the API_KEY environment variable.");
  }

  if (!userPrompt.trim() && (!referenceImageFiles || referenceImageFiles.length === 0)) {
    throw new Error("Cannot generate image without a text prompt or at least one reference image.");
  }

  let describedPromptContent = '';
  const imageParts: Part[] = [];

  if (referenceImageFiles && referenceImageFiles.length > 0) {
    try {
      for (const file of referenceImageFiles) {
        const imagePart = await convertFileToPart(file);
        imageParts.push(imagePart);
      }
      
      const systemInstructionForDescriber = `You are an expert prompt engineer. Analyze the provided ${referenceImageFiles.length} image(s). The user has also provided the following text request: '${userPrompt || `Describe the combined essence of the image(s) for recreation in a ${imageStyle} style.`}'. Synthesize information from ALL provided images and the user's text request to generate a single, concise, and highly descriptive text prompt. This prompt will be fed into an image generation model (Imagen 3). The prompt should be tailored for a high-quality ${imageStyle} generation, emphasizing appropriate artistic elements like lighting, focus, color palette, and detail level suitable for the ${imageStyle}. Output *only* the final generation prompt, without any surrounding text, explanations, or markdown formatting. Ensure the description captures key artistic elements, composition, character expressions (if any), and color palettes from the reference images, translating them into a cohesive ${imageStyle} aesthetic. If multiple images are very different, try to find a common theme or style, or a way to blend their key features as requested by the user's text and desired ${imageStyle}.`;

      const textPart = { text: userPrompt || `Describe the key elements from the ${referenceImageFiles.length} uploaded image(s) to guide an image generator for the ${imageStyle} style.` };
      
      const partsForGemini: Part[] = [...imageParts, textPart];

      const descriptivePromptResponse: GenerateContentResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash-preview-04-17', 
        contents: { parts: partsForGemini },
        config: {
          systemInstruction: systemInstructionForDescriber,
        }
      });
      
      describedPromptContent = descriptivePromptResponse.text.trim();
      
      if (!describedPromptContent) {
        console.warn("Gemini Flash did not return a descriptive prompt. Will use user prompt and a note about reference images.");
      }

    } catch (err) {
      console.error('Error getting description from Gemini Flash:', err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      if (errorMessage.includes('400') && errorMessage.toLowerCase().includes('image')){
         throw new Error(`Failed to process one or more reference images. An image format might be unsupported or corrupted. Try different images (e.g. PNG, JPG). Details: ${errorMessage}`);
      }
      throw new Error(`Failed to process reference images: ${errorMessage}`);
    }
  }

  let effectivePromptContent = userPrompt.trim();

  if (describedPromptContent) {
      effectivePromptContent = describedPromptContent;
  } else if (!effectivePromptContent && referenceImageFiles && referenceImageFiles.length > 0) {
      effectivePromptContent = `a scene inspired by the uploaded image(s), in a vibrant ${imageStyle} style`;
  } else if (!effectivePromptContent) {
      effectivePromptContent = `a beautiful and intricate ${imageStyle} artwork`;
  }
  
  // Ensure imageStyle is incorporated directly into the core prompt.
  const corePrompt = `High-quality, ultra-detailed ${imageStyle}: ${effectivePromptContent}.`;
  
  // More generic quality suffix
  const styleSuffix = `Evocative lighting, sharp focus, masterpiece quality, high resolution, vibrant colors, intricate details.`;

  let aspectRatioInstruction = '';
  if (aspectRatio === '1:1') aspectRatioInstruction = 'Rendered in a square aspect ratio.';
  else if (aspectRatio === '9:16') aspectRatioInstruction = 'Rendered in a portrait aspect ratio (9:16).';
  else if (aspectRatio === '16:9') aspectRatioInstruction = 'Rendered in a landscape aspect ratio (16:9).';
  else if (aspectRatio === '2:3') aspectRatioInstruction = 'Rendered in a portrait aspect ratio (2:3).';
  else if (aspectRatio === '3:2') aspectRatioInstruction = 'Rendered in a landscape aspect ratio (3:2).';

  let finalPromptForImagen = `${corePrompt} ${styleSuffix} ${aspectRatioInstruction}`;
  
  finalPromptForImagen = finalPromptForImagen.replace(/\s{2,}/g, ' ').replace(/\s+\./g, '.').replace(/\.{2,}/g, '.').trim();

  try {
    const response = await ai.models.generateImages({
      model: 'imagen-3.0-generate-002',
      prompt: finalPromptForImagen,
      config: {
        numberOfImages: numberOfImages,
        outputMimeType: 'image/jpeg',
      },
    });

    if (response.generatedImages && response.generatedImages.length > 0) {
      return response.generatedImages.map(img => {
        if (img.image && img.image.imageBytes) {
          return `data:image/jpeg;base64,${img.image.imageBytes}`;
        }
        console.error('An image object was missing imageBytes.', img);
        throw new Error('Image data missing in one of the generated images.');
      }).filter(url => !!url); 
    }
    throw new Error('No image data received from Imagen API. The response might be empty or malformed.');
  } catch (error) {
    console.error('Imagen API error:', error);
    if (error instanceof Error) {
        if (error.message.includes('API_KEY_INVALID') || error.message.includes('PERMISSION_DENIED')) {
            throw new Error('Invalid API Key or insufficient permissions for Imagen. Please check your Google AI Studio configuration.');
        }
        if (error.message.includes('exhausted') || error.message.includes('quota')) {
            throw new Error('Imagen API quota exceeded. Please check your usage limits.');
        }
         throw new Error(`Imagen API request failed: ${error.message}`);
    }
    throw new Error('Unknown error calling Imagen API.');
  }
};