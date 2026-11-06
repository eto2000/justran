import React, { useRef, useEffect, useState } from 'react';

const CanvasEditor = ({ backgroundSrc, foregroundSrc, isVideo }) => {
    const canvasRef = useRef(null);
    const videoRef = useRef(null);
    const [fgPosition, setFgPosition] = useState({ x: 50, y: 50 });
    const [fgScale, setFgScale] = useState(1);
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const initialPinchDistance = useRef(0);
    const initialPinchScale = useRef(1);
    const [showPreview, setShowPreview] = useState(false);
    const [previewUrl, setPreviewUrl] = useState('');
    const [blendMode, setBlendMode] = useState('multiply'); // 'multiply' for white bg, 'screen' for black bg
    const [invertColors, setInvertColors] = useState(false); // Toggle to invert text colors
    const [isDownloading, setIsDownloading] = useState(false); // Track download progress
    const [jpgQuality, setJpgQuality] = useState(80); // JPEG save quality (10-100, default 80)

    // Color tint state: null = 원본 색상 사용, string = hex 색상으로 색조화
    const [tintColor, setTintColor] = useState(null);
    const [showColorPicker, setShowColorPicker] = useState(false);
    const tintedFgImgRef = useRef(null); // 색조화된 기록이미지 캐시
    const colorPickerRef = useRef(null);

    // Rotation state
    const [fgRotation, setFgRotation] = useState(0); // in degrees
    const initialTouchAngle = useRef(0);
    const initialRotationRef = useRef(0);
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
        // eslint-disable-next-line react-hooks/set-state-in-effect
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

                // 색조화 이미지도 새 소스에 맞게 재계산
                if (tintColor) {
                    tintedFgImgRef.current = buildTintedImage(fgImg, tintColor, blendMode, invertColors);
                }

                setImagesLoaded(prev => ({ ...prev, fg: true }));
            };
            fgImg.src = foregroundSrc;
        }

    }, [backgroundSrc, foregroundSrc, isVideo]);

    // hex 색상 문자열을 {r, g, b}로 파싱
    const hexToRgb = (hex) => {
        const clean = hex.replace('#', '');
        return {
            r: parseInt(clean.substring(0, 2), 16),
            g: parseInt(clean.substring(2, 4), 16),
            b: parseInt(clean.substring(4, 6), 16),
        };
    };

    /**
     * 배경 제거 후 남은 픽셀에만 색상을 적용한 오프스크린 캔버스를 반환.
     *
     * 기록이미지는 흰 배경(multiply) 또는 검은 배경(screen) 위에 그려진 상태.
     * - 흰 배경 모드: 픽셀이 밝을수록 배경 → 밝기를 알파 반전으로 마스크 계산
     *   alpha = 1 - brightness  (흰=0, 검정 텍스트=1)
     * - 검은 배경 모드: 픽셀이 어두울수록 배경 → 밝기 자체가 알파
     *   alpha = brightness      (검정=0, 흰 텍스트=1)
     *
     * invertColors가 true이면 배경 판정 기준도 반전.
     */
    const buildTintedImage = (sourceImg, hexColor, currentBlendMode, isInverted) => {
        const w = sourceImg.width;
        const h = sourceImg.height;

        // 원본 픽셀 데이터 추출
        const srcCanvas = document.createElement('canvas');
        srcCanvas.width = w;
        srcCanvas.height = h;
        const srcCtx = srcCanvas.getContext('2d');
        srcCtx.drawImage(sourceImg, 0, 0);
        const srcData = srcCtx.getImageData(0, 0, w, h).data;

        // 결과 캔버스
        const outCanvas = document.createElement('canvas');
        outCanvas.width = w;
        outCanvas.height = h;
        const outCtx = outCanvas.getContext('2d');
        const outImageData = outCtx.createImageData(w, h);
        const out = outImageData.data;

        const { r: tr, g: tg, b: tb } = hexToRgb(hexColor);

        // 실효 블렌드 모드: invertColors가 켜지면 multiply↔screen 반전
        let effectiveMode = currentBlendMode;
        if (isInverted) {
            effectiveMode = currentBlendMode === 'multiply' ? 'screen' : 'multiply';
        }

        for (let i = 0; i < srcData.length; i += 4) {
            const pr = srcData[i];
            const pg = srcData[i + 1];
            const pb = srcData[i + 2];
            const pa = srcData[i + 3];

            if (pa === 0) {
                // 완전 투명 픽셀 → 그대로 투명
                out[i] = 0; out[i + 1] = 0; out[i + 2] = 0; out[i + 3] = 0;
                continue;
            }

            // 밝기 (0~1)
            const brightness = (pr + pg + pb) / (3 * 255);

            // 배경 기준에 따라 마스크 알파 계산
            // multiply(흰배경): 어두울수록 전경 → alpha = 1 - brightness
            // screen(검은배경): 밝을수록 전경  → alpha = brightness
            let alpha;
            if (effectiveMode === 'multiply') {
                alpha = 1 - brightness;
            } else {
                alpha = brightness;
            }

            // 원본 픽셀 알파도 반영
            alpha = alpha * (pa / 255);

            out[i]     = tr;
            out[i + 1] = tg;
            out[i + 2] = tb;
            out[i + 3] = Math.round(alpha * 255);
        }

        outCtx.putImageData(outImageData, 0, 0);
        return outCanvas;
    };

    // tintColor / blendMode / invertColors 가 바뀌면 색조화 이미지를 재계산
    useEffect(() => {
        if (!fgImgRef.current || !tintColor) {
            tintedFgImgRef.current = null;
            return;
        }
        tintedFgImgRef.current = buildTintedImage(fgImgRef.current, tintColor, blendMode, invertColors);
    }, [tintColor, blendMode, invertColors]);

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

                ctx.save();

                const fgWidth = fgImg.width * fgScale;
                const fgHeight = fgImg.height * fgScale;

                const centerX = fgPosition.x + fgWidth / 2;
                const centerY = fgPosition.y + fgHeight / 2;

                ctx.translate(centerX, centerY);
                ctx.rotate(fgRotation * Math.PI / 180);

                if (tintColor && tintedFgImgRef.current) {
                    // tint 이미지는 이미 배경 제거 + 색상 적용이 완료된 상태
                    // source-over로 그냥 얹으면 됨
                    ctx.globalCompositeOperation = 'source-over';
                    ctx.drawImage(tintedFgImgRef.current, -fgWidth / 2, -fgHeight / 2, fgWidth, fgHeight);
                } else {
                    // 기존 방식: multiply/screen 블렌드로 배경 제거
                    let effectiveBlendMode = blendMode;
                    if (invertColors) {
                        effectiveBlendMode = blendMode === 'multiply' ? 'screen' : 'multiply';
                    }
                    ctx.globalCompositeOperation = effectiveBlendMode;

                    const drawSource = (invertColors && invertedFgImgRef.current)
                        ? invertedFgImgRef.current
                        : fgImg;
                    ctx.drawImage(drawSource, -fgWidth / 2, -fgHeight / 2, fgWidth, fgHeight);
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
    }, [imagesLoaded, fgPosition, fgScale, fgRotation, blendMode, invertColors, tintColor, isVideo]);

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

                // Limit scale between 0.1 and 6 (same as slider)
                const clampedScale = Math.max(0.1, Math.min(5, scale));
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
            } else if (e.touches.length === 1 && isPinchingRef.current) {
                isPinchingRef.current = false;
                isRotatingRef.current = false;
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

    // 컬러피커 외부 클릭 시 닫기
    useEffect(() => {
        if (!showColorPicker) return;
        const handleOutsideClick = (e) => {
            if (colorPickerRef.current && !colorPickerRef.current.contains(e.target)) {
                setShowColorPicker(false);
            }
        };
        document.addEventListener('mousedown', handleOutsideClick);
        document.addEventListener('touchstart', handleOutsideClick);
        return () => {
            document.removeEventListener('mousedown', handleOutsideClick);
            document.removeEventListener('touchstart', handleOutsideClick);
        };
    }, [showColorPicker]);

    const handleDownload = async () => {
        console.log("handleDownload called");
        if (isDownloading) return;

        const canvas = canvasRef.current;

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

        const qualityVal = jpgQuality / 100;

        // Use toBlob directly which is more compatible with gesture tracking than multiple awaits
        canvas.toBlob(async (blob) => {
            if (!blob) {
                setIsDownloading(false);
                return;
            }

            // Try Web Share API - This is the ONLY way to "Save to Photos" on iOS from a button
            if (navigator.share) {
                try {
                    const file = new File([blob], 'justran-result.jpg', { type: 'image/jpeg' });
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
            const url = canvas.toDataURL('image/jpeg', qualityVal);
            setPreviewUrl(url);
            setShowPreview(true);
            setIsDownloading(false);
        }, 'image/jpeg', qualityVal);
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
                            max="5"
                            step="0.1"
                            value={fgScale}
                            onChange={(e) => setFgScale(parseFloat(e.target.value))}
                        />
                    </label>
                </div>
                <div className="control-row">
                    <label>
                        Quality:
                        <input
                            type="range"
                            min="10"
                            max="100"
                            step="5"
                            value={jpgQuality}
                            onChange={(e) => setJpgQuality(parseInt(e.target.value))}
                        />
                        <span style={{ minWidth: '45px', textAlign: 'right' }}>{jpgQuality}%</span>
                    </label>
                </div>
                <div className="control-row button-group">
                    <button
                        onClick={() => setBlendMode(blendMode === 'multiply' ? 'screen' : 'multiply')}
                        className={`btn-control ${blendMode === 'screen' ? 'active' : ''}`}
                    >
                        배경제거하기
                    </button>
                    <button
                        onClick={() => setInvertColors(!invertColors)}
                        className={`btn-control ${invertColors ? 'active' : ''}`}
                    >
                        글자반전
                    </button>
                    {/* 색상 선택 버튼 */}
                    <div className="color-picker-wrapper" ref={colorPickerRef}>
                        <button
                            className={`btn-control btn-color-pick ${tintColor ? 'active' : ''}`}
                            onClick={() => setShowColorPicker(v => !v)}
                            title="기록이미지 색상 선택"
                        >
                            {/* 현재 선택된 색상을 작은 원으로 표시 */}
                            <span
                                className="color-dot"
                                style={{ background: tintColor || 'transparent' }}
                            />
                            색상선택
                        </button>
                        {showColorPicker && (
                            <div className="color-popover">
                                <div className="color-popover-header">
                                    <span>기록이미지 색상</span>
                                    {tintColor && (
                                        <button
                                            className="color-reset-btn"
                                            onClick={() => { setTintColor(null); setShowColorPicker(false); }}
                                        >
                                            원본으로
                                        </button>
                                    )}
                                </div>
                                {/* 프리셋 색상 팔레트 */}
                                <div className="color-swatches">
                                    {[
                                        '#ffffff', '#000000', '#e8e8e8',
                                        '#ff3b30', '#ff9500', '#ffcc00',
                                        '#34c759', '#30d5c8', '#007aff',
                                        '#5856d6', '#af52de', '#ff2d55',
                                    ].map(color => (
                                        <button
                                            key={color}
                                            className={`color-swatch ${tintColor === color ? 'selected' : ''}`}
                                            style={{ background: color }}
                                            onClick={() => { setTintColor(color); setShowColorPicker(false); }}
                                            title={color}
                                        />
                                    ))}
                                </div>
                                {/* 직접 색상 입력 */}
                                <div className="color-custom-row">
                                    <span>직접 선택</span>
                                    <input
                                        type="color"
                                        className="color-input-native"
                                        value={tintColor || '#ffffff'}
                                        onChange={(e) => setTintColor(e.target.value)}
                                    />
                                </div>
                            </div>
                        )}
                    </div>
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
