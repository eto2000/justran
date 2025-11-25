import React, { useRef, useEffect, useState } from 'react';

const CanvasEditor = ({ backgroundSrc, foregroundSrc, isVideo }) => {
    const canvasRef = useRef(null);
    const videoRef = useRef(null);
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
    const [isDownloading, setIsDownloading] = useState(false); // Track download progress

    // Store image objects to avoid reloading them on every render
    const bgImgRef = useRef(null);
    const fgImgRef = useRef(null);
    const [imagesLoaded, setImagesLoaded] = useState({ bg: false, fg: false });

    // Load images when sources change
    // Load images or video when sources change
    useEffect(() => {
        // Reset loaded state when sources change
        setImagesLoaded({ bg: false, fg: false });

        if (isVideo && backgroundSrc) {
            const video = document.createElement('video');
            video.src = backgroundSrc;
            video.crossOrigin = "anonymous";
            video.loop = true;
            video.muted = true;
            video.playsInline = true;

            video.onloadedmetadata = () => {
                videoRef.current = video;
                setImagesLoaded(prev => ({ ...prev, bg: true }));
                video.play().catch(e => console.error("Video play failed", e));
            };
        } else if (backgroundSrc) {
            const bgImg = new Image();
            bgImg.onload = () => {
                bgImgRef.current = bgImg;
                setImagesLoaded(prev => ({ ...prev, bg: true }));
            };
            bgImg.src = backgroundSrc;
        }

        if (foregroundSrc) {
            const fgImg = new Image();
            fgImg.onload = () => {
                fgImgRef.current = fgImg;
                setImagesLoaded(prev => ({ ...prev, fg: true }));
            };
            fgImg.src = foregroundSrc;
        }

    }, [backgroundSrc, foregroundSrc, isVideo]);

    // Draw canvas whenever images are loaded or position/scale changes
    // Draw canvas whenever images are loaded or position/scale changes
    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');

        if (!imagesLoaded.bg) return;

        let animationFrameId;

        const drawForeground = () => {
            if (imagesLoaded.fg && fgImgRef.current) {
                const fgImg = fgImgRef.current;

                // Save context for composite operation
                ctx.save();

                // Apply blend mode for transparency
                let effectiveBlendMode = blendMode;
                if (invertColors) {
                    effectiveBlendMode = blendMode === 'multiply' ? 'screen' : 'multiply';
                }
                ctx.globalCompositeOperation = effectiveBlendMode;

                const fgWidth = fgImg.width * fgScale;
                const fgHeight = fgImg.height * fgScale;

                if (invertColors) {
                    const tempCanvas = document.createElement('canvas');
                    tempCanvas.width = fgImg.width;
                    tempCanvas.height = fgImg.height;
                    const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true, alpha: true });
                    tempCtx.clearRect(0, 0, fgImg.width, fgImg.height);
                    tempCtx.drawImage(fgImg, 0, 0);
                    const imageData = tempCtx.getImageData(0, 0, fgImg.width, fgImg.height);
                    const data = imageData.data;
                    for (let i = 0; i < data.length; i += 4) {
                        const alpha = data[i + 3];
                        if (alpha > 0) {
                            data[i] = 255 - data[i];
                            data[i + 1] = 255 - data[i + 1];
                            data[i + 2] = 255 - data[i + 2];
                        }
                    }
                    tempCtx.putImageData(imageData, 0, 0);
                    ctx.drawImage(tempCanvas, fgPosition.x, fgPosition.y, fgWidth, fgHeight);
                } else {
                    ctx.drawImage(fgImg, fgPosition.x, fgPosition.y, fgWidth, fgHeight);
                }
                ctx.restore();
            }
        };

        const render = () => {
            if (isVideo && videoRef.current) {
                const video = videoRef.current;
                if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
                    canvas.width = video.videoWidth;
                    canvas.height = video.videoHeight;
                }
                ctx.drawImage(video, 0, 0);
                drawForeground();
                animationFrameId = requestAnimationFrame(render);
            } else if (!isVideo && bgImgRef.current) {
                const bgImg = bgImgRef.current;
                if (canvas.width !== bgImg.width || canvas.height !== bgImg.height) {
                    canvas.width = bgImg.width;
                    canvas.height = bgImg.height;
                }
                ctx.drawImage(bgImg, 0, 0);
                drawForeground();
            }
        };

        render();

        return () => {
            if (animationFrameId) {
                cancelAnimationFrame(animationFrameId);
            }
        };
    }, [imagesLoaded, fgPosition, fgScale, blendMode, invertColors, isVideo]);

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
        console.log("handleDownload called");

        // Prevent multiple simultaneous downloads
        if (isDownloading) {
            console.log("Download already in progress, ignoring...");
            return;
        }

        const canvas = canvasRef.current;

        if (isVideo && videoRef.current) {
            console.log("Downloading video...");
            const video = videoRef.current;

            // Set downloading state
            setIsDownloading(true);

            // Start recording process
            try {
                const stream = canvas.captureStream(30); // 30 FPS
                console.log("Stream captured:", stream);

                let mimeType = 'video/webm'; // Default fallback
                if (MediaRecorder.isTypeSupported('video/mp4')) {
                    mimeType = 'video/mp4';
                } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9')) {
                    mimeType = 'video/webm;codecs=vp9';
                } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8')) {
                    mimeType = 'video/webm;codecs=vp8';
                }

                console.log("Using MIME type:", mimeType);

                if (!MediaRecorder.isTypeSupported(mimeType)) {
                    alert("이 브라우저에서는 비디오 저장을 지원하지 않습니다.");
                    return;
                }

                const mediaRecorder = new MediaRecorder(stream, { mimeType });
                console.log("MediaRecorder created:", mediaRecorder);

                const chunks = [];

                mediaRecorder.ondataavailable = (e) => {
                    if (e.data.size > 0) {
                        chunks.push(e.data);
                    }
                };

                mediaRecorder.onstop = () => {
                    console.log("Recording stopped, creating blob...");
                    const blob = new Blob(chunks, { type: mimeType });
                    const url = URL.createObjectURL(blob);

                    // Download logic
                    const link = document.createElement('a');
                    link.href = url;
                    // Extension based on mimeType
                    const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';
                    link.download = `composed-video.${ext}`;
                    link.click();

                    // Reset video loop
                    video.loop = true;
                    video.play();

                    // Reset downloading state
                    setIsDownloading(false);
                };

                // Prepare for recording
                video.pause();
                video.currentTime = 0;
                video.loop = false; // Play once for recording

                mediaRecorder.start();
                console.log("Recording started");

                video.onended = () => {
                    console.log("Video ended, stopping recording");
                    mediaRecorder.stop();
                    video.onended = null; // Cleanup
                };

                video.play().then(() => console.log("Video playing for recording"))
                    .catch(e => console.error("Video play failed during recording:", e));
            } catch (e) {
                console.error("Error in video download:", e);
                // Reset downloading state on error
                setIsDownloading(false);
            }
            return;
        }

        console.log("Downloading image...");
        // Image download logic
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
                    <button
                        onClick={handleDownload}
                        className="btn-control btn-save"
                        disabled={isDownloading}
                    >
                        {isDownloading ? '저장 중...' : '저장'}
                    </button>
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
