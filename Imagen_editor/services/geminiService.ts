import { GoogleGenAI, Modality, GenerateContentResponse } from "@google/genai";
import { ImageFile } from '../types';

const fileToGenerativePart = async (file: File) => {
  const base64EncodedDataPromise = new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result.split(',')[1]);
      }
    };
    reader.readAsDataURL(file);
  });

  return {
    inlineData: {
      data: await base64EncodedDataPromise,
      mimeType: file.type,
    },
  };
};

export const identifySubject = async (
  primaryImage: ImageFile
): Promise<string> => {
  if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable is not set.");
  }
  
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const primaryImagePart = await fileToGenerativePart(primaryImage.file);
  const promptPart = { text: "Isolate the main subject from this image. Make the background transparent." };

  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { parts: [primaryImagePart, promptPart] },
      config: {
        responseModalities: [Modality.IMAGE],
      },
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        const base64ImageBytes: string = part.inlineData.data;
        return `data:${part.inlineData.mimeType};base64,${base64ImageBytes}`;
      }
    }
    throw new Error("Could not identify a subject in the image.");
  } catch (error) {
    console.error("Error identifying subject with Gemini:", error);
    if (error instanceof Error) {
        return Promise.reject(`Failed to identify subject: ${error.message}`);
    }
    return Promise.reject("An unknown error occurred during subject identification.");
  }
};


export const generateImage = async (
  prompt: string,
  primaryImage: ImageFile,
  referenceImages: ImageFile[]
): Promise<string> => {
  if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable is not set.");
  }
  
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const primaryImagePart = await fileToGenerativePart(primaryImage.file);
  const referenceImageParts = await Promise.all(
    referenceImages.map(img => fileToGenerativePart(img.file))
  );

  const parts = [
    primaryImagePart,
    ...referenceImageParts,
    { text: prompt },
  ];

  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { parts: parts },
      config: {
          responseModalities: [Modality.IMAGE],
      },
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        const base64ImageBytes: string = part.inlineData.data;
        return `data:${part.inlineData.mimeType};base64,${base64ImageBytes}`;
      }
    }

    throw new Error("No image was generated. Please check your prompt and images.");

  } catch (error) {
    console.error("Error generating image with Gemini:", error);
    if (error instanceof Error) {
        return Promise.reject(`Failed to generate image: ${error.message}`);
    }
    return Promise.reject("An unknown error occurred during image generation.");
  }
};