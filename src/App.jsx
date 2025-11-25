import React, { useState } from 'react';
import ImageUploader from './components/ImageUploader';
import CanvasEditor from './components/CanvasEditor';
import './styles/index.css';

function App() {
  const [backgroundSrc, setBackgroundSrc] = useState(null);
  const [foregroundSrc, setForegroundSrc] = useState(null);

  return (
    <div className="app-container">
      <header>
        <h1>Image Composer</h1>
        <p>Upload a background and a text image to compose them.</p>
      </header>

      <div className="upload-section">
        <ImageUploader
          label="Background"
          id="bg-upload"
          onUpload={setBackgroundSrc}
        />
        <ImageUploader
          label="Text Image (White BG)"
          id="fg-upload"
          onUpload={setForegroundSrc}
        />
      </div>

      <main className="workspace">
        {backgroundSrc ? (
          <CanvasEditor
            backgroundSrc={backgroundSrc}
            foregroundSrc={foregroundSrc}
          />
        ) : (
          <div className="placeholder">
            <p>Please upload a background image to start.</p>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
