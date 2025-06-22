from ultralytics import YOLOv10

# Load the pretrained model
model = YOLOv10.from_pretrained('jameslahm/yolov10x')

# Source image URL (cats image from COCO dataset)
source = 'http://images.cocodataset.org/val2017/000000039769.jpg'

# Run prediction and save results
results = model.predict(source=source, save=True)
print(f"Prediction completed. Results saved to {results[0].save_dir}") 