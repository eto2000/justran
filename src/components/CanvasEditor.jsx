import React, { useRef, useEffect, useState } from 'react';

const CanvasEditor = ({ backgroundSrc, foregroundSrc }) => {
    const canvasRef = useRef(null);
    const [fgPosition, setFgPosition] = useState({ x: 50, y: 50 });
    const [fgScale, setFgScale] = useState(1);
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

    // Draw canvas
    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');

        const bgImg = new Image();
        const fgImg = new Image();

        let bgLoaded = false;
        let fgLoaded = false;

        const draw = () => {
            if (!bgLoaded) return;

            // Set canvas size to background image size
            canvas.width = bgImg.width;
            canvas.height = bgImg.height;

            // Draw background
            ctx.drawImage(bgImg, 0, 0);

            if (fgLoaded) {
                // Save context for composite operation
                ctx.save();

                // Apply multiply blend mode for transparency
                ctx.globalCompositeOperation = 'multiply';

                const fgWidth = fgImg.width * fgScale;
                const fgHeight = fgImg.height * fgScale;

                ctx.drawImage(fgImg, fgPosition.x, fgPosition.y, fgWidth, fgHeight);

                ctx.restore();
            }
        };

        bgImg.onload = () => {
            bgLoaded = true;
            draw();
        };

        fgImg.onload = () => {
            fgLoaded = true;
            draw();
        };

        if (backgroundSrc) {
            bgImg.src = backgroundSrc;
        }

        if (foregroundSrc) {
            fgImg.src = foregroundSrc;
        }

    }, [backgroundSrc, foregroundSrc, fgPosition, fgScale]);

    const handleMouseDown = (e) => {
        const rect = canvasRef.current.getBoundingClientRect();
        const x = (e.clientX - rect.left) * (canvasRef.current.width / rect.width);
        const y = (e.clientY - rect.top) * (canvasRef.current.height / rect.height);

        // Simple hit detection (can be improved)
        setIsDragging(true);
        setDragStart({ x: x - fgPosition.x, y: y - fgPosition.y });
    };

    const handleMouseMove = (e) => {
        if (!isDragging) return;

        const rect = canvasRef.current.getBoundingClientRect();
        const x = (e.clientX - rect.left) * (canvasRef.current.width / rect.width);
        const y = (e.clientY - rect.top) * (canvasRef.current.height / rect.height);

        setFgPosition({ x: x - dragStart.x, y: y - dragStart.y });
    };

    const handleMouseUp = () => {
        setIsDragging(false);
    };

    const handleDownload = () => {
        const canvas = canvasRef.current;
        const link = document.createElement('a');
        link.download = 'composed-image.png';
        link.href = canvas.toDataURL();
        link.click();
    };

    return (
        <div className="canvas-editor">
            <div className="controls">
                <label>
                    Size:
                    <input
                        type="range"
                        min="0.1"
                        max="3"
                        step="0.1"
                        value={fgScale}
                        onChange={(e) => setFgScale(parseFloat(e.target.value))}
                    />
                </label>
                <button onClick={handleDownload} className="btn-download">Download</button>
            </div>
            <div className="canvas-container">
                <canvas
                    ref={canvasRef}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                    style={{ maxWidth: '100%', height: 'auto', border: '1px solid #ccc' }}
                />
            </div>
        </div>
    );
};

export default CanvasEditor;
