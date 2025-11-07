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
  const promptPart = { text: "Aísla el sujeto principal de esta imagen. Haz el fondo transparente." };

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
    throw new Error("No se pudo identificar un sujeto en la imagen.");
  } catch (error) {
    console.error("Error al identificar el sujeto con Gemini:", error);
    if (error instanceof Error) {
        return Promise.reject(`Fallo al identificar el sujeto: ${error.message}`);
    }
    return Promise.reject("Ocurrió un error desconocido durante la identificación del sujeto.");
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

    throw new Error("No se generó ninguna imagen. Por favor, revisa tu descripción e imágenes.");

  } catch (error) {
    console.error("Error al generar la imagen con Gemini:", error);
    if (error instanceof Error) {
        return Promise.reject(`Fallo al generar la imagen: ${error.message}`);
    }
    return Promise.reject("Ocurrió un error desconocido durante la generación de la imagen.");
  }
};