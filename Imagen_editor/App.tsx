
import React, { useState } from 'react';
import { generateImage, identifySubject } from './services/geminiService';
import { ImageFile } from './types';
import { SparklesIcon, XCircleIcon, ImageIcon, Spinner, DownloadIcon, CheckCircleIcon } from './components/icons';
import FileUpload from './components/FileUpload';

const ImagePreview: React.FC<{ image: ImageFile; onRemove: (id: string) => void }> = ({ image, onRemove }) => {
  return (
    <div className="relative group">
      <img src={image.preview} alt={image.file.name} className="w-24 h-24 object-cover rounded-md" />
      <button
        onClick={() => onRemove(image.id)}
        className="absolute top-0 right-0 p-1 bg-white bg-opacity-70 rounded-full text-gray-800 opacity-0 group-hover:opacity-100 transition-opacity"
        aria-label="Remove image"
      >
        <XCircleIcon className="w-5 h-5" />
      </button>
    </div>
  );
};

type Step = 'initial' | 'validating' | 'generating' | 'final';

export default function App() {
  const [primaryImage, setPrimaryImage] = useState<ImageFile | null>(null);
  const [referenceImages, setReferenceImages] = useState<ImageFile[]>([]);
  const [prompt, setPrompt] = useState<string>('');
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isIdentifying, setIsIdentifying] = useState<boolean>(false);
  const [identifiedSubjectImage, setIdentifiedSubjectImage] = useState<string | null>(null);
  // FIX: Removed extra equals sign in useState declaration
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<Step>('initial');
  
  const handlePrimaryImageUpload = (files: FileList) => {
    const file = files[0];
    if (file) {
      const newImage: ImageFile = {
        id: `primary-${Date.now()}`,
        file,
        preview: URL.createObjectURL(file),
      };
      setPrimaryImage(newImage);
    }
  };

  const handleReferenceImageUpload = (files: FileList) => {
    const newImages: ImageFile[] = Array.from(files).map((file, index) => ({
      id: `ref-${Date.now()}-${index}`,
      file,
      preview: URL.createObjectURL(file),
    }));
    setReferenceImages(prev => [...prev, ...newImages]);
  };
  
  const removePrimaryImage = () => {
      setPrimaryImage(null);
  };
  
  const removeReferenceImage = (id: string) => {
    setReferenceImages(prev => prev.filter(img => img.id !== id));
  };
  
  const handleStartGeneration = async () => {
    if (!primaryImage) {
      setError("Please upload a primary image to edit.");
      return;
    }
    
    setIsIdentifying(true);
    setError(null);
    setStep('validating');
    setGeneratedImage(null);

    try {
      const subjectImage = await identifySubject(primaryImage);
      setIdentifiedSubjectImage(subjectImage);
    } catch (err: any) {
      setError(err.toString());
      setStep('initial');
    } finally {
      setIsIdentifying(false);
    }
  };

  const handleConfirmAndGenerate = async () => {
     if (!primaryImage) {
      setError("Primary image is missing.");
      setStep('initial');
      return;
    }
     if (!prompt.trim()) {
      setError("Please enter a prompt to describe your edits.");
      setStep('initial');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    setStep('generating');
    
    try {
      let detailedPrompt = `The first image provided is the primary image, containing the main subject. You must not modify the shape, colors, or features of this main subject. Preserve it exactly as it is.`;
      if (referenceImages.length > 0) {
        detailedPrompt += ` The subsequent images are for reference only; use them as inspiration for the background or scene.`;
      }
      detailedPrompt += ` Now, apply the user's request to the image: "${prompt}"`;

      const result = await generateImage(detailedPrompt, primaryImage, referenceImages);
      setGeneratedImage(result);
      setStep('final');
    } catch (err: any) {
      setError(err.toString());
      setStep('initial');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelValidation = () => {
    setStep('initial');
    setIdentifiedSubjectImage(null);
    setError(null);
  };


  const handleDownload = () => {
    if (!generatedImage) return;
    const link = document.createElement('a');
    link.href = generatedImage;
    const mimeType = generatedImage.split(';')[0].split(':')[1] || 'image/png';
    const extension = mimeType.split('/')[1] || 'png';
    link.download = `ai-generated-image-${Date.now()}.${extension}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  const canGenerate = !!(primaryImage && prompt && !isLoading && !isIdentifying && step === 'initial');

  const renderOutputContent = () => {
    if (step === 'validating') {
      if (isIdentifying) {
        return (
          <div className="text-center text-gray-600">
            <Spinner className="w-12 h-12 mx-auto mb-4" />
            <p className="text-lg">Identifying subject...</p>
            <p className="text-sm">The AI is analyzing your primary image.</p>
          </div>
        );
      }
      if (identifiedSubjectImage) {
        return (
          <div className="text-center">
            <h2 className="text-xl font-semibold mb-4 text-gray-800">Confirm Subject</h2>
            <p className="text-gray-600 mb-4">Is this the main subject you want to keep unchanged?</p>
            <div className="bg-checkered-pattern p-2 rounded-lg inline-block">
                <img src={identifiedSubjectImage} alt="Identified subject" className="max-h-64 mx-auto rounded-md" />
            </div>
            <div className="flex justify-center gap-4 mt-6">
              <button onClick={handleCancelValidation} className="flex items-center gap-2 px-6 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold rounded-lg transition-colors">
                <XCircleIcon className="w-5 h-5" />
                Cancel
              </button>
              <button onClick={handleConfirmAndGenerate} className="flex items-center gap-2 px-6 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors">
                <CheckCircleIcon className="w-5 h-5" />
                Confirm & Generate
              </button>
            </div>
          </div>
        );
      }
    }

    if (step === 'generating') {
      return (
        <div className="text-center text-gray-600">
          <Spinner className="w-12 h-12 mx-auto mb-4" />
          <p className="text-lg">AI is creating your image...</p>
          <p className="text-sm">This may take a moment.</p>
        </div>
      );
    }
    
    if (error) {
      return (
        <div className="text-center text-red-700 bg-red-100 border border-red-200 p-4 rounded-lg">
          <XCircleIcon className="w-12 h-12 mx-auto mb-2"/>
          <h3 className="font-bold text-lg mb-1">Error</h3>
          <p className="text-sm">{error}</p>
        </div>
      );
    }
    
    if (generatedImage && step === 'final') {
        return (
            <div className="w-full">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Generated Image</h2>
                <button
                    onClick={handleDownload}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg transition-colors"
                    aria-label="Download generated image"
                >
                    <DownloadIcon className="w-5 h-5" />
                    Download
                </button>
            </div>
            <img src={generatedImage} alt="Generated result" className="w-full h-auto object-contain rounded-lg max-h-[75vh]" />
            </div>
        );
    }
    
    return (
        <div className="text-center text-gray-500">
            <ImageIcon className="w-20 h-20 mx-auto mb-4"/>
            <p className="text-lg">Your generated image will appear here.</p>
        </div>
    );
  };


  return (
    <div className="min-h-screen bg-gray-100 text-gray-900 font-sans">
      <style>{`
        .bg-checkered-pattern {
          background-image:
            linear-gradient(45deg, #e2e8f0 25%, transparent 25%),
            linear-gradient(-45deg, #e2e8f0 25%, transparent 25%),
            linear-gradient(45deg, transparent 75%, #e2e8f0 75%),
            linear-gradient(-45deg, transparent 75%, #e2e8f0 75%);
          background-size: 20px 20px;
          background-position: 0 0, 0 10px, 10px -10px, -10px 0px;
        }
      `}</style>
      <header className="bg-white/70 backdrop-blur-sm border-b border-gray-200 p-4 text-center sticky top-0 z-10">
        <h1 className="text-2xl md:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 to-purple-600">
          AI Image Editor
        </h1>
        <p className="text-gray-600 mt-1">Edit photos with text prompts and reference images using Gemini.</p>
      </header>
      
      <main className="p-4 md:p-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-7xl mx-auto">
          {/* Controls Column */}
          <div className="flex flex-col gap-6 p-6 bg-white rounded-lg shadow-md">
            <div>
              <h2 className="text-lg font-semibold mb-2 text-indigo-600">1. Upload Primary Image</h2>
              {primaryImage ? (
                <div className="relative group w-full">
                  <img src={primaryImage.preview} alt="Primary preview" className="w-full h-auto object-contain rounded-lg max-h-96" />
                   <button
                        onClick={removePrimaryImage}
                        className="absolute top-2 right-2 p-1.5 bg-white bg-opacity-70 rounded-full text-gray-800 opacity-0 group-hover:opacity-100 transition-opacity"
                        aria-label="Remove image"
                    >
                        <XCircleIcon className="w-6 h-6" />
                    </button>
                </div>
              ) : (
                <FileUpload onFileUpload={handlePrimaryImageUpload} label="Drop your main photo here, or"/>
              )}
            </div>
            
            <div>
              <h2 className="text-lg font-semibold mb-2 text-indigo-600">2. Add Reference Images (Optional)</h2>
              <FileUpload onFileUpload={handleReferenceImageUpload} label="Drop reference photos here, or" multiple />
              {referenceImages.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-4">
                  {referenceImages.map(img => (
                    <ImagePreview key={img.id} image={img} onRemove={removeReferenceImage} />
                  ))}
                </div>
              )}
            </div>
            
            <div>
              <h2 className="text-lg font-semibold mb-2 text-indigo-600">3. Describe Your Edit</h2>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder='e.g., "Change the background to a beach at sunset" or "Apply a retro, vintage filter"'
                className="w-full h-28 p-3 bg-white border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
              />
            </div>
            
            <div className="mt-4">
               <button
                  onClick={handleStartGeneration}
                  disabled={!canGenerate}
                  className={`w-full flex items-center justify-center gap-2 px-6 py-4 text-lg font-bold rounded-lg transition-all
                    ${!canGenerate 
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                      : 'bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white shadow-lg transform hover:scale-105'}`
                  }
                >
                  {isLoading || isIdentifying ? (
                    <>
                      <Spinner className="w-6 h-6"/>
                      Processing...
                    </>
                  ) : (
                    <>
                      <SparklesIcon className="w-6 h-6" />
                      Generate Image
                    </>
                  )}
                </button>
            </div>
          </div>
          
          {/* Output Column */}
          <div className="bg-white rounded-lg p-4 lg:p-6 flex flex-col items-center justify-center min-h-[50vh] lg:min-h-full shadow-inner sticky top-24">
            <div className="w-full h-full flex items-center justify-center">
                {renderOutputContent()}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
