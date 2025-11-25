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
        <h1>Just Ran!</h1>
        <p>배경이미지와 기록을 올리세요</p>
      </header>

      <div className="upload-section">
        <ImageUploader
          label="Background"
          id="bg-upload"
          onUpload={setBackgroundSrc}
        />
        <ImageUploader
          label="기록(흰색바탕)"
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
            <p>다녀왔냐? 기록 남기자</p>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
