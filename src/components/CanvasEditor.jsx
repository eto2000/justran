import React, { useRef, useEffect, useState } from 'react';

const CanvasEditor = ({ backgroundSrc, foregroundSrc }) => {
    const canvasRef = useRef(null);
    const [fgPosition, setFgPosition] = useState({ x: 50, y: 50 });
    const [fgScale, setFgScale] = useState(1);
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

    // Store image objects to avoid reloading them on every render
    const bgImgRef = useRef(null);
    const fgImgRef = useRef(null);
    const [imagesLoaded, setImagesLoaded] = useState({ bg: false, fg: false });

    // Load images when sources change
    useEffect(() => {
        const bgImg = new Image();
        const fgImg = new Image();

        bgImg.onload = () => {
            bgImgRef.current = bgImg;
            setImagesLoaded(prev => ({ ...prev, bg: true }));
        };

        fgImg.onload = () => {
            fgImgRef.current = fgImg;
            setImagesLoaded(prev => ({ ...prev, fg: true }));
        };

        if (backgroundSrc) bgImg.src = backgroundSrc;
        if (foregroundSrc) fgImg.src = foregroundSrc;

    }, [backgroundSrc, foregroundSrc]);

    // Draw canvas whenever images are loaded or position/scale changes
    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');

        if (!imagesLoaded.bg || !bgImgRef.current) return;

        const bgImg = bgImgRef.current;

        // Set canvas size to background image size
        canvas.width = bgImg.width;
        canvas.height = bgImg.height;

        // Draw background
        ctx.drawImage(bgImg, 0, 0);

        if (imagesLoaded.fg && fgImgRef.current) {
            const fgImg = fgImgRef.current;

            // Save context for composite operation
            ctx.save();

            // Apply multiply blend mode for transparency
            ctx.globalCompositeOperation = 'multiply';

            const fgWidth = fgImg.width * fgScale;
            const fgHeight = fgImg.height * fgScale;

            ctx.drawImage(fgImg, fgPosition.x, fgPosition.y, fgWidth, fgHeight);

            ctx.restore();
        }
    }, [imagesLoaded, fgPosition, fgScale]);

    const handleMouseDown = (e) => {
        if (!imagesLoaded.fg || !fgImgRef.current) return;

        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();

        // Calculate mouse position relative to canvas
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const mouseX = (e.clientX - rect.left) * scaleX;
        const mouseY = (e.clientY - rect.top) * scaleY;

        // Hit detection
        const fgImg = fgImgRef.current;
        const fgWidth = fgImg.width * fgScale;
        const fgHeight = fgImg.height * fgScale;

        if (
            mouseX >= fgPosition.x &&
            mouseX <= fgPosition.x + fgWidth &&
            mouseY >= fgPosition.y &&
            mouseY <= fgPosition.y + fgHeight
        ) {
            setIsDragging(true);
            setDragStart({
                x: mouseX - fgPosition.x,
                y: mouseY - fgPosition.y
            });
        }
    };

    const handleMouseMove = (e) => {
        if (!isDragging) return;

        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();

        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const mouseX = (e.clientX - rect.left) * scaleX;
        const mouseY = (e.clientY - rect.top) * scaleY;

        setFgPosition({
            x: mouseX - dragStart.x,
            y: mouseY - dragStart.y
        });
    };

    const handleMouseUp = () => {
        setIsDragging(false);
    };

    // Touch event handlers for mobile support
    const handleTouchStart = (e) => {
        if (!imagesLoaded.fg || !fgImgRef.current) return;

        // Prevent scrolling while dragging
        // e.preventDefault(); // Note: might need touch-action: none in CSS

        const touch = e.touches[0];
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();

        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const touchX = (touch.clientX - rect.left) * scaleX;
        const touchY = (touch.clientY - rect.top) * scaleY;

        const fgImg = fgImgRef.current;
        const fgWidth = fgImg.width * fgScale;
        const fgHeight = fgImg.height * fgScale;

        if (
            touchX >= fgPosition.x &&
            touchX <= fgPosition.x + fgWidth &&
            touchY >= fgPosition.y &&
            touchY <= fgPosition.y + fgHeight
        ) {
            setIsDragging(true);
            setDragStart({
                x: touchX - fgPosition.x,
                y: touchY - fgPosition.y
            });
        }
    };

    const handleTouchMove = (e) => {
        if (!isDragging) return;

        const touch = e.touches[0];
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();

        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const touchX = (touch.clientX - rect.left) * scaleX;
        const touchY = (touch.clientY - rect.top) * scaleY;

        setFgPosition({
            x: touchX - dragStart.x,
            y: touchY - dragStart.y
        });
    };

    const handleTouchEnd = () => {
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
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                    style={{
                        maxWidth: '100%',
                        height: 'auto',
                        border: '1px solid #ccc',
                        cursor: isDragging ? 'grabbing' : 'default',
                        touchAction: 'none' // Prevent scrolling on mobile while dragging
                    }}
                />
            </div>
        </div>
    );
};

export default CanvasEditor;
