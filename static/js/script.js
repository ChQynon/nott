document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const modelStatus = document.getElementById('model-status');
    const video = document.getElementById('webcam');
    const canvas = document.getElementById('output');
    const ctx = canvas.getContext('2d');
    const startButton = document.getElementById('startBtn');
    const stopButton = document.getElementById('stopBtn');
    const flipButton = document.getElementById('flipBtn');
    const fullscreenButton = document.getElementById('fullscreenBtn');
    const fpsElement = document.getElementById('fps');
    const detectionList = document.getElementById('detection-list');
    
    // Variables
    let stream = null;
    let isStreaming = false;
    let processingImage = false;
    let animationId = null;
    let lastFrameTime = 0;
    let facingMode = 'environment'; // Start with back camera
    const FPS_ALPHA = 0.1; // For exponential moving average of FPS
    let avgFps = 0;
    
    // Check if model is loaded
    function checkModelStatus() {
        fetch('/status')
            .then(response => response.json())
            .then(data => {
                if (data.model_ready) {
                    modelStatus.textContent = 'Ready';
                    modelStatus.classList.add('ready');
                    startButton.disabled = false;
                } else {
                    setTimeout(checkModelStatus, 1000);
                }
            })
            .catch(error => {
                console.error('Error checking model status:', error);
                setTimeout(checkModelStatus, 2000);
            });
    }
    
    // Start webcam
    async function startWebcam() {
        try {
            if (stream) {
                stopWebcam(false);
            }

            stream = await navigator.mediaDevices.getUserMedia({ 
                video: { 
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    facingMode: facingMode 
                } 
            });
            
            video.srcObject = stream;
            video.onloadedmetadata = () => {
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                startButton.disabled = true;
                stopButton.disabled = false;
                flipButton.disabled = false;
                isStreaming = true;
                animationId = requestAnimationFrame(processFrame);

                // Animate video in
                video.style.opacity = 0;
                canvas.style.opacity = 0;
                setTimeout(() => {
                    video.style.transition = 'opacity 0.5s ease';
                    canvas.style.transition = 'opacity 0.5s ease';
                    video.style.opacity = 1;
                    canvas.style.opacity = 1;
                }, 100);
            };
        } catch (err) {
            console.error('Error accessing webcam:', err);
            alert('Error accessing webcam. Please make sure you have a webcam connected and have granted permission.');
        }
    }
    
    // Flip camera
    async function flipCamera() {
        facingMode = facingMode === 'environment' ? 'user' : 'environment';
        
        // Add rotation animation
        flipButton.classList.add('rotating');
        setTimeout(() => flipButton.classList.remove('rotating'), 500);
        
        if (isStreaming) {
            startWebcam(); // Restart camera with new facing mode
        }
    }
    
    // Toggle fullscreen
    function toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => {
                console.error(`Error attempting to enable full-screen mode: ${err.message}`);
            });
            fullscreenButton.innerHTML = '<i class="fas fa-compress"></i>';
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
                fullscreenButton.innerHTML = '<i class="fas fa-expand"></i>';
            }
        }
    }
    
    // Stop webcam
    function stopWebcam(resetUI = true) {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            video.srcObject = null;
            isStreaming = false;
            if (animationId) {
                cancelAnimationFrame(animationId);
            }
            
            if (resetUI) {
                startButton.disabled = false;
                stopButton.disabled = true;
                flipButton.disabled = true;
                
                // Clear canvas
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                // Clear detections
                detectionList.innerHTML = '';
            }
        }
    }
    
    // Process video frame
    async function processFrame(timestamp) {
        if (!isStreaming) return;
        
        // Calculate FPS
        if (lastFrameTime) {
            const currentFps = 1000 / (timestamp - lastFrameTime);
            // Exponential moving average for smoother FPS display
            avgFps = avgFps ? (FPS_ALPHA * currentFps + (1 - FPS_ALPHA) * avgFps) : currentFps;
            fpsElement.textContent = `${avgFps.toFixed(1)} FPS`;
        }
        lastFrameTime = timestamp;
        
        // If not already processing, send frame to server
        if (!processingImage && video.readyState === video.HAVE_ENOUGH_DATA) {
            processingImage = true;
            
            // Draw current frame to canvas
            if (facingMode === 'user') {
                // Mirror for front camera
                ctx.save();
                ctx.scale(-1, 1);
                ctx.drawImage(video, -canvas.width, 0, canvas.width, canvas.height);
                ctx.restore();
            } else {
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            }
            
            // Convert to blob and send to server
            canvas.toBlob(async (blob) => {
                try {
                    const response = await fetch('/process', {
                        method: 'POST',
                        body: blob
                    });
                    
                    if (response.ok) {
                        // If response is an image
                        if (response.headers.get('content-type').includes('image')) {
                            const imgBlob = await response.blob();
                            const imgUrl = URL.createObjectURL(imgBlob);
                            const img = new Image();
                            
                            // Get detections from header
                            const detectionsHeader = response.headers.get('X-Detections');
                            let detections = {};
                            
                            if (detectionsHeader) {
                                try {
                                    detections = JSON.parse(detectionsHeader);
                                } catch (e) {
                                    console.error('Error parsing detections:', e);
                                }
                            }
                            
                            img.onload = () => {
                                // Clear canvas and draw the processed image
                                ctx.clearRect(0, 0, canvas.width, canvas.height);
                                
                                if (facingMode === 'user') {
                                    // Mirror for front camera
                                    ctx.save();
                                    ctx.scale(-1, 1);
                                    ctx.drawImage(img, -canvas.width, 0, canvas.width, canvas.height);
                                    ctx.restore();
                                } else {
                                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                                }
                                
                                URL.revokeObjectURL(imgUrl);
                                processingImage = false;
                            };
                            
                            img.src = imgUrl;
                            
                            // Update the detection list with real data
                            if (Object.keys(detections).length > 0) {
                                updateDetections(detections);
                            } else {
                                // If no detections, show a message
                                updateDetections({"No objects detected": 0});
                            }
                        } else {
                            // Handle JSON response (error or status messages)
                            const data = await response.json();
                            console.log('Server response:', data);
                            processingImage = false;
                        }
                    } else {
                        console.error('Error from server:', response.statusText);
                        processingImage = false;
                    }
                } catch (error) {
                    console.error('Error sending frame to server:', error);
                    processingImage = false;
                }
            }, 'image/jpeg', 0.8);
        }
        
        animationId = requestAnimationFrame(processFrame);
    }
    
    // Update detected objects display
    function updateDetections(objectCounts) {
        detectionList.innerHTML = '';
        
        for (const [objectName, count] of Object.entries(objectCounts)) {
            const detectionItem = document.createElement('div');
            detectionItem.className = 'detection-item';
            
            const nameSpan = document.createElement('span');
            nameSpan.textContent = objectName;
            
            const countBadge = document.createElement('span');
            countBadge.className = 'detection-count';
            countBadge.textContent = count;
            
            detectionItem.appendChild(nameSpan);
            detectionItem.appendChild(countBadge);
            detectionList.appendChild(detectionItem);
        }
    }
    
    // Handle document visibility change
    document.addEventListener('visibilitychange', () => {
        if (document.hidden && isStreaming) {
            // Pause processing when tab is not visible
            cancelAnimationFrame(animationId);
        } else if (!document.hidden && isStreaming) {
            // Resume processing when tab becomes visible again
            animationId = requestAnimationFrame(processFrame);
        }
    });
    
    // Add some CSS for the rotation animation
    const style = document.createElement('style');
    style.textContent = `
        @keyframes rotate {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
        }
        .rotating {
            animation: rotate 0.5s ease;
        }
    `;
    document.head.appendChild(style);
    
    // Event listeners
    startButton.addEventListener('click', startWebcam);
    stopButton.addEventListener('click', () => stopWebcam(true));
    flipButton.addEventListener('click', flipCamera);
    fullscreenButton.addEventListener('click', toggleFullscreen);
    
    // Check if model is loaded on page load
    checkModelStatus();
}); 