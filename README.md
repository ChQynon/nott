# NOTT - Real-time Object Detection

NOTT is a modern, full-screen, real-time object detection web application. This application uses computer vision technology to detect objects in real-time through your camera.

## Features

- Full-screen, immersive design
- Real-time object detection and counting
- Camera flip functionality (switch between front and back camera)
- Fullscreen mode
- Responsive design for desktop and mobile devices
- Modern dark UI with sleek animations

## Installation

1. Clone this repository
```bash
git clone https://github.com/yourusername/nott.git
cd nott
```

2. Install dependencies
```bash
pip install -r requirements.txt
```

3. Run the application
```bash
python app.py
```

4. Open your browser and navigate to `http://localhost:5000`

## Deployment Options

### Deploying to Replicate

1. Create an account on [Replicate](https://replicate.com)

2. Install the Replicate CLI
```bash
pip install replicate
```

3. Authenticate with your API token
```bash
export REPLICATE_API_TOKEN=<your-token>
```

4. Create a `cog.yaml` file in the project root with the following content:
```yaml
build:
  gpu: true
  python_version: "3.10"
  python_packages:
    - flask==3.0.0
    - opencv-python==4.6.0
    - pillow==9.0.0
    - numpy==1.20.0
    - git+https://github.com/THU-MIG/yolov10.git

predict: "app.py:app"
```

5. Push your model to Replicate
```bash
replicate push yourusername/nott
```

### Deploying to Render or similar platforms

1. Create an account on [Render](https://render.com)

2. Create a new Web Service on Render and connect your Git repository

3. Configure the service with the following settings:
   - Build Command: `pip install -r requirements.txt`
   - Start Command: `gunicorn app:app`

4. Add the following environment variables:
   - `PYTHON_VERSION=3.10`

5. Deploy your application

## Usage

1. Allow camera permissions when prompted
2. Wait for the "Ready" status indicating the model is loaded
3. Click the play button to start the camera
4. Use the flip button to switch between front and back cameras
5. Use the fullscreen button for a more immersive experience
6. Detected objects will appear in the panel on the right side

## License

MIT 