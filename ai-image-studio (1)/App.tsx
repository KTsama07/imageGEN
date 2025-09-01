import React from 'react';
import { ImageGenerator } from './components/ImageGenerator';

const App: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col items-center p-4 selection:bg-indigo-500 selection:text-white">
      <header className="w-full max-w-6xl mx-auto my-6 flex flex-col justify-center items-center px-4">
        <div className="text-center">
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-purple-400 via-pink-500 to-red-500">
            AI Image Studio
          </h1>
          <p className="mt-1 sm:mt-2 text-slate-400 text-base sm:text-lg">
            Craft stunning visuals in any style with the power of AI!
          </p>
        </div>
      </header>
      <main className="w-full max-w-2xl">
        <ImageGenerator />
      </main>
      <footer className="py-8 mt-auto text-center text-slate-500 text-sm">
        <p>Powered by Google Gemini API & Imagen 3</p>
        <p>Ensure your API_KEY environment variable is set.</p>
      </footer>
    </div>
  );
};

export default App;