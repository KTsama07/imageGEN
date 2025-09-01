import React, { useState, useCallback, useRef, useEffect } from 'react';
import { generateImage } from '../services/geminiService'; // Renamed from generateAnimeImage
import { Spinner } from './Spinner';

// Helper function to convert File to base64 for preview
const fileToDataURL = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });
};

const availableStyles = [
  { value: 'anime', label: 'Anime' },
  { value: 'photorealistic', label: 'Photorealistic' },
  { value: 'futuristic', label: 'Futuristic' },
  { value: 'fantasy', label: 'Fantasy' },
  { value: 'cyberpunk', label: 'Cyberpunk' },
  { value: 'steampunk', label: 'Steampunk' },
  { value: 'cartoon', label: 'Cartoon' },
  { value: 'abstract', label: 'Abstract' },
  { value: 'watercolor', label: 'Watercolor' },
  { value: 'pixel art', label: 'Pixel Art' },
  { value: '3d render', label: '3D Render' },
  { value: 'impressionistic', label: 'Impressionistic' },
];

export const ImageGenerator: React.FC = () => {
  const [prompt, setPrompt] = useState<string>('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [numberOfImages, setNumberOfImages] = useState<number>(1);
  const [aspectRatio, setAspectRatio] = useState<string>('1:1');
  const [imageStyle, setImageStyle] = useState<string>(availableStyles[0].value); // Default to first style
  const [fullscreenImageUrl, setFullscreenImageUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      const newFilesArray = Array.from(files);
      const validFiles: File[] = [];
      const newPreviewUrls: string[] = [];
      let encounteredError = false;

      for (const file of newFilesArray) {
        if (!file.type.startsWith('image/')) {
          setError('Please upload only valid image files (e.g., JPG, PNG, WEBP).');
          encounteredError = true;
          setSelectedFiles([]);
          setPreviewUrls([]);
          if (fileInputRef.current) {
            fileInputRef.current.value = "";
          }
          return;
        }
        validFiles.push(file);
        try {
          const dataUrl = await fileToDataURL(file);
          newPreviewUrls.push(dataUrl);
        } catch (e) {
          setError('Could not generate image preview for one or more files.');
          setPreviewUrls([]);
          encounteredError = true;
          break;
        }
      }

      if (!encounteredError) {
        setSelectedFiles(prev => [...prev, ...validFiles].slice(0, 5));
        setPreviewUrls(prev => [...prev, ...newPreviewUrls].slice(0, 5));
        setError(null);
      }
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const clearAllImages = () => {
    setSelectedFiles([]);
    setPreviewUrls([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removeImage = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    setPreviewUrls(prev => prev.filter((_, i) => i !== index));
  }

  const handleSubmit = useCallback(async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!prompt.trim() && selectedFiles.length === 0) {
      setError('Please enter a prompt or upload at least one image.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setImageUrls([]);

    try {
      const generatedImagesArray = await generateImage( // Renamed from generateAnimeImage
        prompt,
        imageStyle,
        selectedFiles.length > 0 ? selectedFiles : undefined,
        numberOfImages,
        aspectRatio
      );
      setImageUrls(generatedImagesArray);
    } catch (err) {
      console.error('Image generation failed:', err);
      if (err instanceof Error) {
        setError(`Failed to generate image: ${err.message}. Check console for details. Ensure API key is valid and has necessary model access.`);
      } else {
        setError('An unknown error occurred during image generation.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [prompt, selectedFiles, numberOfImages, aspectRatio, imageStyle]);

  const canSubmit = (prompt.trim().length > 0 || selectedFiles.length > 0) && !isLoading;

  const openFullscreen = (url: string) => {
    setFullscreenImageUrl(url);
  };

  const closeFullscreen = useCallback(() => {
    setFullscreenImageUrl(null);
  }, []);

  useEffect(() => {
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeFullscreen();
      }
    };
    if (fullscreenImageUrl) {
      document.addEventListener('keydown', handleEscKey);
    }
    return () => {
      document.removeEventListener('keydown', handleEscKey);
    };
  }, [fullscreenImageUrl, closeFullscreen]);

  return (
    <div className="p-6 bg-slate-800 rounded-xl shadow-2xl space-y-6">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="prompt" className="block text-sm font-medium text-indigo-300 mb-1">
            Enter your vision:
          </label>
          <textarea
            id="prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="e.g., a knight facing a dragon, a serene forest scene, a bustling futuristic city"
            className="w-full p-3 bg-slate-700 border border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition duration-150 ease-in-out placeholder-slate-500 text-slate-100 min-h-[80px] resize-y"
            rows={3}
            disabled={isLoading}
            aria-label="Image generation prompt"
          />
        </div>

        <div>
          <label htmlFor="file-upload" className="block text-sm font-medium text-indigo-300 mb-1">
            Upload Reference Image(s) (Optional, up to 5):
          </label>
          <div className="mt-1 flex items-center space-x-4">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading || selectedFiles.length >= 5}
              className="px-4 py-2 border border-slate-600 rounded-lg text-sm font-medium text-slate-300 bg-slate-700 hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Choose Image(s)
            </button>
             {selectedFiles.length > 0 && (
                <button
                type="button"
                onClick={clearAllImages}
                disabled={isLoading}
                className="px-3 py-1.5 border border-red-600 text-red-300 bg-red-700/50 hover:bg-red-600/50 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 focus:ring-red-500 disabled:opacity-50"
                aria-label="Clear all selected images"
              >
                Clear All ({selectedFiles.length})
              </button>
            )}
          </div>
          <input
            id="file-upload"
            name="file-upload"
            type="file"
            accept="image/png, image/jpeg, image/webp, image/heic, image/heif"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="sr-only"
            multiple // Allow multiple file selection
            disabled={isLoading || selectedFiles.length >= 5}
            aria-label="Upload reference images"
          />

          {previewUrls.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-4" aria-label="Selected image previews">
              {previewUrls.map((url, index) => (
                <div key={index} className="relative group w-28 h-28 bg-slate-700 rounded-lg overflow-hidden shadow-md">
                  <img src={url} alt={`Preview ${index + 1}`} className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removeImage(index)}
                    disabled={isLoading}
                    className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity disabled:opacity-50"
                    aria-label={`Remove image ${index + 1}`}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
           {selectedFiles.length >= 5 && (
            <p className="text-xs text-amber-400 mt-2">Maximum of 5 reference images allowed.</p>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label htmlFor="image-style" className="block text-sm font-medium text-indigo-300 mb-1">
                Image Style:
              </label>
              <select
                id="image-style"
                value={imageStyle}
                onChange={(e) => setImageStyle(e.target.value)}
                disabled={isLoading}
                className="w-full p-3 bg-slate-700 border border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition duration-150 ease-in-out text-slate-100"
                aria-label="Select image style"
              >
                {availableStyles.map(style => (
                  <option key={style.value} value={style.value}>{style.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="num-images" className="block text-sm font-medium text-indigo-300 mb-1">
                Number of Images:
              </label>
              <select
                id="num-images"
                value={numberOfImages}
                onChange={(e) => setNumberOfImages(parseInt(e.target.value, 10))}
                disabled={isLoading}
                className="w-full p-3 bg-slate-700 border border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition duration-150 ease-in-out text-slate-100"
                aria-label="Select number of images to generate"
              >
                <option value={1}>1</option>
                <option value={2}>2</option>
                <option value={3}>3</option>
                <option value={4}>4</option>
              </select>
            </div>

            <div>
              <label htmlFor="aspect-ratio" className="block text-sm font-medium text-indigo-300 mb-1">
                Aspect Ratio:
              </label>
              <select
                id="aspect-ratio"
                value={aspectRatio}
                onChange={(e) => setAspectRatio(e.target.value)}
                disabled={isLoading}
                className="w-full p-3 bg-slate-700 border border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition duration-150 ease-in-out text-slate-100"
                aria-label="Select aspect ratio for generated images"
              >
                <option value="1:1">Square (1:1)</option>
                <option value="9:16">Portrait (9:16)</option>
                <option value="16:9">Landscape (16:9)</option>
                <option value="2:3">Portrait (2:3)</option>
                <option value="3:2">Landscape (3:2)</option>
              </select>
            </div>
        </div>
        
        <button
          type="submit"
          disabled={!canSubmit}
          className="w-full flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 focus:ring-indigo-500 disabled:bg-slate-500 disabled:cursor-not-allowed transition duration-150 ease-in-out"
        >
          {isLoading ? (
            <>
              <Spinner className="mr-2 h-5 w-5" />
              Generating...
            </>
          ) : (
            '✨ Generate Image'
          )}
        </button>
      </form>

      {error && (
        <div role="alert" className="mt-6 p-4 bg-red-700/50 border border-red-500 text-red-200 rounded-lg">
          <p className="font-semibold">Error:</p>
          <p>{error}</p>
        </div>
      )}

      <div className="mt-8">
        {isLoading && imageUrls.length === 0 && (
           <div aria-live="polite" className="flex flex-col items-center justify-center h-80 bg-slate-700/50 rounded-lg border-2 border-dashed border-slate-600">
             <Spinner className="h-12 w-12 text-indigo-400" />
             <p className="mt-4 text-slate-400">Conjuring your masterpiece(s)...</p>
           </div>
        )}
        {!isLoading && imageUrls.length === 0 && !error && (
          <div className="flex flex-col items-center justify-center h-80 bg-slate-700/50 rounded-lg border-2 border-dashed border-slate-600">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p className="mt-4 text-slate-400">Your generated image(s) will appear here.</p>
          </div>
        )}
        {imageUrls.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {imageUrls.map((url, index) => (
              <div key={index} className="bg-slate-700 p-3 rounded-lg shadow-lg flex flex-col">
                <img
                  src={url}
                  alt={`Generated ${imageStyle} style ${index + 1}`}
                  className="w-full h-auto object-contain rounded-md mb-3"
                />
                <div className="mt-auto grid grid-cols-2 gap-2">
                  <a
                    href={url}
                    download={`generated_${imageStyle}_image_${index + 1}.jpeg`}
                    className="col-span-1 inline-block w-full text-center px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition duration-150 ease-in-out text-sm"
                  >
                    Download
                  </a>
                  <button
                    onClick={() => openFullscreen(url)}
                    className="col-span-1 inline-block w-full text-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition duration-150 ease-in-out text-sm"
                    aria-label={`View image ${index + 1} fullscreen`}
                  >
                    Fullscreen
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {fullscreenImageUrl && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="fullscreen-image-label"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={closeFullscreen} 
        >
          <button
            onClick={closeFullscreen}
            className="absolute top-4 right-4 text-white hover:text-slate-300 z-50"
            aria-label="Close fullscreen view"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <div className="relative max-w-full max-h-full" onClick={(e) => e.stopPropagation()}> {/* Prevents backdrop click from closing when clicking image itself */}
            <img
              id="fullscreen-image-label"
              src={fullscreenImageUrl}
              alt={`Fullscreen generated ${imageStyle}`}
              className="block max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl"
            />
          </div>
        </div>
      )}
    </div>
  );
};