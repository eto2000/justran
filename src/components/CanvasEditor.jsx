import React, { useRef, useEffect, useState } from 'react';

const CanvasEditor = ({ backgroundSrc, foregroundSrc }) => {
    const canvasRef = useRef(null);
    const [fgPosition, setFgPosition] = useState({ x: 50, y: 50 });
    const [fgScale, setFgScale] = useState(1);
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [isPinching, setIsPinching] = useState(false);
    const initialPinchDistance = useRef(0);
    const initialPinchScale = useRef(1);
    const [showPreview, setShowPreview] = useState(false);
    const [previewUrl, setPreviewUrl] = useState('');
    const [blendMode, setBlendMode] = useState('multiply'); // 'multiply' for white bg, 'screen' for black bg
    const [invertColors, setInvertColors] = useState(false); // Toggle to invert text colors

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

            // Apply blend mode for transparency
            // When colors are inverted, reverse the blend mode
            // multiply <-> screen
            let effectiveBlendMode = blendMode;
            if (invertColors) {
                effectiveBlendMode = blendMode === 'multiply' ? 'screen' : 'multiply';
            }
            ctx.globalCompositeOperation = effectiveBlendMode;

            const fgWidth = fgImg.width * fgScale;
            const fgHeight = fgImg.height * fgScale;

            // If color inversion is enabled, process the image to invert only text colors
            if (invertColors) {
                // Create a temporary canvas to process the image
                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = fgImg.width;
                tempCanvas.height = fgImg.height;
                const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true, alpha: true });

                // Clear canvas to ensure it's transparent
                tempCtx.clearRect(0, 0, fgImg.width, fgImg.height);

                // Draw the original image
                tempCtx.drawImage(fgImg, 0, 0);

                // Get image data
                const imageData = tempCtx.getImageData(0, 0, fgImg.width, fgImg.height);
                const data = imageData.data;

                // Invert RGB values while preserving alpha, but only for non-transparent pixels
                for (let i = 0; i < data.length; i += 4) {
                    const alpha = data[i + 3];
                    // Only invert if pixel is not fully transparent
                    if (alpha > 0) {
                        data[i] = 255 - data[i];         // Red
                        data[i + 1] = 255 - data[i + 1]; // Green
                        data[i + 2] = 255 - data[i + 2]; // Blue
                        // data[i + 3] is alpha, leave it unchanged
                    }
                }

                // Put the modified image data back
                tempCtx.putImageData(imageData, 0, 0);

                // Draw the inverted image
                ctx.drawImage(tempCanvas, fgPosition.x, fgPosition.y, fgWidth, fgHeight);
            } else {
                // Draw the original image without inversion
                ctx.drawImage(fgImg, fgPosition.x, fgPosition.y, fgWidth, fgHeight);
            }

            ctx.restore();
        }
    }, [imagesLoaded, fgPosition, fgScale, blendMode, invertColors]);

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

    // Helper function to calculate distance between two touch points
    const getTouchDistance = (touch1, touch2) => {
        const dx = touch1.clientX - touch2.clientX;
        const dy = touch1.clientY - touch2.clientY;
        return Math.sqrt(dx * dx + dy * dy);
    };

    // Touch event handlers for mobile support
    const handleTouchStart = (e) => {
        if (!imagesLoaded.fg || !fgImgRef.current) return;

        // Two-finger pinch to zoom
        if (e.touches.length === 2) {
            e.preventDefault();
            setIsPinching(true);
            setIsDragging(false); // Stop dragging if pinching starts

            const distance = getTouchDistance(e.touches[0], e.touches[1]);
            initialPinchDistance.current = distance;
            initialPinchScale.current = fgScale;
            return;
        }

        // Single finger drag
        if (e.touches.length === 1) {
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
        }
    };

    const handleTouchMove = (e) => {
        // Handle pinch-to-zoom
        if (isPinching && e.touches.length === 2) {
            e.preventDefault();

            const distance = getTouchDistance(e.touches[0], e.touches[1]);
            const scale = (distance / initialPinchDistance.current) * initialPinchScale.current;

            // Limit scale between 0.1 and 3 (same as slider)
            const clampedScale = Math.max(0.1, Math.min(3, scale));
            setFgScale(clampedScale);
            return;
        }

        // Handle single-finger drag
        if (isDragging && e.touches.length === 1) {
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
        }
    };

    const handleTouchEnd = (e) => {
        // If no more touches, reset both states
        if (e.touches.length === 0) {
            setIsDragging(false);
            setIsPinching(false);
        }
        // If went from 2 fingers to 1, stop pinching but might start dragging
        else if (e.touches.length === 1 && isPinching) {
            setIsPinching(false);
        }
    };

    const handleDownload = async () => {
        const canvas = canvasRef.current;

        // Check if Web Share API is supported and we can share files
        if (navigator.share && navigator.canShare) {
            try {
                const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
                const file = new File([blob], 'composed-image.png', { type: 'image/png' });

                if (navigator.canShare({ files: [file] })) {
                    await navigator.share({
                        files: [file],
                        title: 'Composed Image',
                        text: 'Check out my composed image!'
                    });
                    return;
                }
            } catch (error) {
                console.log('Sharing failed or was cancelled:', error);
                // Fallback to preview if sharing fails
            }
        }

        // Fallback: Show preview for long-press save on mobile, or download link on desktop
        const url = canvas.toDataURL();

        // Simple detection for mobile devices to prefer preview over download link
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

        if (isMobile) {
            setPreviewUrl(url);
            setShowPreview(true);
        } else {
            const link = document.createElement('a');
            link.download = 'composed-image.png';
            link.href = url;
            link.click();
        }
    };

    return (
        <div className="canvas-editor">
            <div className="controls">
                <div className="control-row">
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
                </div>
                <div className="control-row button-group">
                    <button
                        onClick={() => setBlendMode(blendMode === 'multiply' ? 'screen' : 'multiply')}
                        className="btn-control btn-background"
                    >
                        배경제거
                    </button>
                    <button
                        onClick={() => setInvertColors(!invertColors)}
                        className={`btn-control btn-text-color ${invertColors ? 'active' : ''}`}
                    >
                        글자색
                    </button>
                    <button onClick={handleDownload} className="btn-control btn-save">저장</button>
                </div>
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

            {showPreview && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.8)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000,
                    padding: '20px'
                }}>
                    <div style={{
                        backgroundColor: 'white',
                        padding: '20px',
                        borderRadius: '10px',
                        maxWidth: '90%',
                        maxHeight: '90%',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '15px'
                    }}>
                        <p style={{ margin: 0, fontWeight: 'bold' }}>저장하려면 이미지를 오래 눌러요</p>
                        <img
                            src={previewUrl}
                            alt="Preview"
                            style={{
                                maxWidth: '100%',
                                maxHeight: '60vh',
                                objectFit: 'contain',
                                border: '1px solid #eee'
                            }}
                        />
                        <button
                            onClick={() => setShowPreview(false)}
                            style={{
                                padding: '10px 20px',
                                backgroundColor: '#333',
                                color: 'white',
                                border: 'none',
                                borderRadius: '5px',
                                cursor: 'pointer'
                            }}
                        >
                            Close
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CanvasEditor;
