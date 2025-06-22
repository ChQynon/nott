from flask import Flask, render_template, Response, jsonify, make_response
import cv2
import base64
import numpy as np
import io
from PIL import Image
from ultralytics import YOLOv10
import time
import threading
import queue
import json

app = Flask(__name__)
app.config['SEND_FILE_MAX_AGE_DEFAULT'] = 0  # Disable caching for development

# Global variables
model = None
model_ready = False
processing_queue = queue.Queue(maxsize=1)
result_queue = queue.Queue(maxsize=1)

def load_model():
    global model, model_ready
    try:
        print("NOTT: Loading model...")
        model = YOLOv10.from_pretrained('jameslahm/yolov10x')
        model_ready = True
        print("NOTT: Model loaded successfully!")
    except Exception as e:
        print(f"NOTT: Error loading model: {e}")

# Start model loading in a separate thread
threading.Thread(target=load_model, daemon=True).start()

def process_image():
    """Process images from queue in a separate thread"""
    global model, model_ready
    while True:
        if not model_ready:
            time.sleep(0.1)
            continue
            
        if not processing_queue.empty():
            img_data = processing_queue.get()
            try:
                # Decode image
                img = np.array(Image.open(io.BytesIO(img_data)))
                
                # Make prediction
                results = model.predict(source=img, save=False)
                
                # Get the annotated image
                res_plotted = results[0].plot()
                
                # Get detection results
                detection_results = {}
                for box in results[0].boxes:
                    class_id = int(box.cls[0].item())
                    class_name = results[0].names[class_id]
                    confidence = round(box.conf[0].item(), 2)
                    
                    if class_name in detection_results:
                        detection_results[class_name] += 1
                    else:
                        detection_results[class_name] = 1
                
                # Encode image to send back
                success, encoded_image = cv2.imencode('.jpg', res_plotted)
                if success:
                    # Add detection data as custom header
                    result_data = {
                        'image': encoded_image.tobytes(),
                        'detections': detection_results
                    }
                    result_queue.put(result_data)
            except Exception as e:
                print(f"NOTT: Error processing image: {e}")
                # Put empty result to avoid blocking
                result_queue.put(None)

# Start image processing thread
threading.Thread(target=process_image, daemon=True).start()

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/status')
def status():
    return jsonify({"model_ready": model_ready})

@app.route('/process', methods=['POST'])
def process():
    from flask import request
    if not model_ready:
        return jsonify({'status': 'error', 'message': 'Model not ready yet'})
    
    try:
        img_data = request.data
        
        # Add to queue if not full (discard if full to avoid lag)
        if processing_queue.qsize() < processing_queue.maxsize:
            # Clear the queue first to always process the latest frame
            while not processing_queue.empty():
                processing_queue.get()
            processing_queue.put(img_data)
            
            # Wait for result with timeout
            try:
                result_data = result_queue.get(timeout=1.0)
                if result_data is None:
                    return jsonify({'status': 'error', 'message': 'Processing failed'})
                
                # Create response with the processed image
                response = make_response(result_data['image'])
                response.headers['Content-Type'] = 'image/jpeg'
                
                # Add detections as header (encoded as JSON)
                response.headers['X-Detections'] = json.dumps(result_data['detections'])
                
                return response
            except queue.Empty:
                return jsonify({'status': 'error', 'message': 'Processing timeout'})
        else:
            return jsonify({'status': 'busy', 'message': 'Server busy, try again'})
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)})

@app.after_request
def add_header(response):
    # Cache control
    response.headers['Cache-Control'] = 'no-store'
    response.headers['Pragma'] = 'no-cache'
    return response

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0') 