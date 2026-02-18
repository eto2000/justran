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

    // Rotation state
    const [fgRotation, setFgRotation] = useState(0); // in degrees
    const initialTouchAngle = useRef(0);
    const initialRotationRef = useRef(0);
    const [isRotating, setIsRotating] = useState(false);
    const isDraggingRef = useRef(false);
    const isPinchingRef = useRef(false);
    const isRotatingRef = useRef(false);

    // Store image objects to avoid reloading them on every render
    const bgImgRef = useRef(null);
    const fgImgRef = useRef(null);
    const invertedFgImgRef = useRef(null);
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
            bgImg.crossOrigin = "anonymous";
            bgImg.onload = () => {
                bgImgRef.current = bgImg;
                setImagesLoaded(prev => ({ ...prev, bg: true }));
            };
            bgImg.src = backgroundSrc;
        }

        if (foregroundSrc) {
            const fgImg = new Image();
            fgImg.crossOrigin = "anonymous";
            fgImg.onload = () => {
                fgImgRef.current = fgImg;

                // Pre-calculate inverted version
                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = fgImg.width;
                tempCanvas.height = fgImg.height;
                const tempCtx = tempCanvas.getContext('2d');
                tempCtx.drawImage(fgImg, 0, 0);
                const imageData = tempCtx.getImageData(0, 0, fgImg.width, fgImg.height);
                const data = imageData.data;
                for (let i = 0; i < data.length; i += 4) {
                    if (data[i + 3] > 0) {
                        data[i] = 255 - data[i];
                        data[i + 1] = 255 - data[i + 1];
                        data[i + 2] = 255 - data[i + 2];
                    }
                }
                tempCtx.putImageData(imageData, 0, 0);
                invertedFgImgRef.current = tempCanvas;

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

                // Translate to center of image position, rotate, then draw
                const centerX = fgPosition.x + fgWidth / 2;
                const centerY = fgPosition.y + fgHeight / 2;

                ctx.translate(centerX, centerY);
                ctx.rotate(fgRotation * Math.PI / 180);

                if (invertColors && invertedFgImgRef.current) {
                    ctx.drawImage(invertedFgImgRef.current, -fgWidth / 2, -fgHeight / 2, fgWidth, fgHeight);
                } else {
                    ctx.drawImage(fgImg, -fgWidth / 2, -fgHeight / 2, fgWidth, fgHeight);
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
    }, [imagesLoaded, fgPosition, fgScale, fgRotation, blendMode, invertColors, isVideo]);

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

    // Helper function to calculate angle between two touch points in degrees
    const getTouchAngle = (touch1, touch2) => {
        const dx = touch1.clientX - touch2.clientX;
        const dy = touch1.clientY - touch2.clientY;
        return Math.atan2(dy, dx) * 180 / Math.PI;
    };

    // Touch event handlers for mobile support via useEffect to handle non-passive events
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const handleTS = (e) => {
            if (!imagesLoaded.fg || !fgImgRef.current) return;

            // Two-finger pinch to zoom
            if (e.touches.length === 2) {
                e.preventDefault();
                isPinchingRef.current = true;
                isRotatingRef.current = true;
                isDraggingRef.current = false;
                setIsPinching(true);
                setIsRotating(true);
                setIsDragging(false);

                const distance = getTouchDistance(e.touches[0], e.touches[1]);
                initialPinchDistance.current = distance;
                initialPinchScale.current = fgScale;

                const angle = getTouchAngle(e.touches[0], e.touches[1]);
                initialTouchAngle.current = angle;
                initialRotationRef.current = fgRotation;
                return;
            }

            // Single finger drag
            if (e.touches.length === 1) {
                const touch = e.touches[0];
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
                    // Only prevent default (stop scrolling) if touching the foreground object
                    e.preventDefault();
                    isDraggingRef.current = true;
                    setIsDragging(true);
                    setDragStart({
                        x: touchX - fgPosition.x,
                        y: touchY - fgPosition.y
                    });
                }
            }
        };

        const handleTM = (e) => {
            // Handle pinch-to-zoom
            if (isPinchingRef.current && e.touches.length === 2) {
                e.preventDefault();

                const distance = getTouchDistance(e.touches[0], e.touches[1]);
                const scale = (distance / initialPinchDistance.current) * initialPinchScale.current;

                // Limit scale between 0.1 and 3 (same as slider)
                const clampedScale = Math.max(0.1, Math.min(3, scale));
                setFgScale(clampedScale);

                const angle = getTouchAngle(e.touches[0], e.touches[1]);
                const angleDelta = angle - initialTouchAngle.current;
                setFgRotation(initialRotationRef.current + angleDelta);
                return;
            }

            // Handle single-finger drag
            if (isDraggingRef.current && e.touches.length === 1) {
                e.preventDefault();
                const touch = e.touches[0];
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

        const handleTE = (e) => {
            if (e.touches.length === 0) {
                isDraggingRef.current = false;
                isPinchingRef.current = false;
                isRotatingRef.current = false;
                setIsDragging(false);
                setIsPinching(false);
                setIsRotating(false);
            } else if (e.touches.length === 1 && isPinchingRef.current) {
                isPinchingRef.current = false;
                isRotatingRef.current = false;
                setIsPinching(false);
                setIsRotating(false);
            }
        };

        canvas.addEventListener('touchstart', handleTS, { passive: false });
        canvas.addEventListener('touchmove', handleTM, { passive: false });
        canvas.addEventListener('touchend', handleTE, { passive: false });

        return () => {
            canvas.removeEventListener('touchstart', handleTS);
            canvas.removeEventListener('touchmove', handleTM);
            canvas.removeEventListener('touchend', handleTE);
        };
    }, [imagesLoaded, fgPosition, fgScale, fgRotation, dragStart]);

    const handleDownload = async () => {
        console.log("handleDownload called");
        if (isDownloading) return;

        const canvas = canvasRef.current;
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

        if (isVideo && videoRef.current) {
            // Video download logic (maintained but optimized)
            console.log("Downloading video...");
            const video = videoRef.current;
            setIsDownloading(true);

            try {
                const stream = canvas.captureStream(30);
                let mimeType = 'video/webm';
                const preferredTypes = ['video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8'];
                for (const type of preferredTypes) {
                    if (MediaRecorder.isTypeSupported(type)) {
                        mimeType = type;
                        break;
                    }
                }

                const mediaRecorder = new MediaRecorder(stream, { mimeType });
                const chunks = [];
                mediaRecorder.ondataavailable = (e) => {
                    if (e.data.size > 0) chunks.push(e.data);
                };

                mediaRecorder.onstop = async () => {
                    const blob = new Blob(chunks, { type: mimeType });
                    const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';
                    const fileName = `justran-video.${ext}`;

                    if (navigator.share) {
                        try {
                            const file = new File([blob], fileName, { type: mimeType });
                            await navigator.share({
                                files: [file],
                                title: '저장하기',
                            });
                            setIsDownloading(false);
                            video.loop = true;
                            video.play();
                            return;
                        } catch (err) {
                            console.log('Video share failed:', err);
                        }
                    }

                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = fileName;
                    link.click();
                    setIsDownloading(false);
                    video.loop = true;
                    video.play();
                };

                video.pause();
                video.loop = false;
                const onSeeked = () => {
                    video.removeEventListener('seeked', onSeeked);
                    mediaRecorder.start();
                    video.play();
                    video.onended = () => {
                        mediaRecorder.stop();
                        video.onended = null;
                    };
                };
                video.addEventListener('seeked', onSeeked);
                video.currentTime = 0;
            } catch (e) {
                console.error("Video record failed:", e);
                setIsDownloading(false);
            }
            return;
        }

        // Image saving logic
        setIsDownloading(true);

        // Use toBlob directly which is more compatible with gesture tracking than multiple awaits
        canvas.toBlob(async (blob) => {
            if (!blob) {
                setIsDownloading(false);
                return;
            }

            // Try Web Share API - This is the ONLY way to "Save to Photos" on iOS from a button
            if (navigator.share) {
                try {
                    const file = new File([blob], 'justran-result.png', { type: 'image/png' });
                    // On Safari, we MUST trigger this as soon as possible after the click
                    await navigator.share({
                        files: [file],
                        title: 'Justran 결과'
                    });
                    setIsDownloading(false);
                    return;
                } catch (error) {
                    console.log('Share failed:', error);
                    // If user cancelled, don't show the modal
                    if (error.name === 'AbortError') {
                        setIsDownloading(false);
                        return;
                    }
                }
            }

            // Fallback for non-sharing browsers or failed sharing: Show the preview modal
            const url = canvas.toDataURL('image/png');
            setPreviewUrl(url);
            setShowPreview(true);
            setIsDownloading(false);
        }, 'image/png');
    };

    return (
        <div className="canvas-editor">
            <div className="controls">
                <div className="control-row">
                    <label>
                        Scale:
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
                        className={`btn-control ${blendMode === 'screen' ? 'active' : ''}`}
                    >
                        기록배경
                    </button>
                    <button
                        onClick={() => setInvertColors(!invertColors)}
                        className={`btn-control ${invertColors ? 'active' : ''}`}
                    >
                        기록글자
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
                    style={{
                        cursor: isDragging ? 'grabbing' : 'default',
                        touchAction: 'manipulation'
                    }}
                />
            </div>

            {showPreview && (
                <div className="modal-overlay" onClick={() => setShowPreview(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>이미지 저장</h3>
                            <p>이미지를 길게 누르면 '사진 앱에 저장'할 수 있어요.</p>
                        </div>
                        <img
                            src={previewUrl}
                            alt="Preview"
                        />
                        <button
                            className="modal-close"
                            onClick={() => setShowPreview(false)}
                        >
                            닫기
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CanvasEditor;
