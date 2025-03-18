# YOLO Computer Vision Toolkit

A collection of Python scripts demonstrating object detection using YOLO (You Only Look Once) models with OpenCV.

## Overview

This project contains implementations of object detection using YOLOv8 models from Ultralytics. The scripts demonstrate different approaches to object detection:

- Static image detection with visualization
- Custom bounding box rendering
- Real-time webcam detection

## Prerequisites

- Python 3.6 or higher
- Required packages (install via `pip install -r requirements.txt`):
  - ultralytics
  - mediapipe
  - opencv-python

## Installation

1. Clone this repository:
   ```
   git clone https://github.com/yourusername/yolocv.git
   cd yolocv
   ```

2. Install dependencies:
   ```
   pip install -r requirements.txt
   ```

3. Download the YOLO model weights (automatically downloaded on first run)

## Usage

### Static Image Detection

```python
python yolo.py
```
This script loads an image from `test.jpg`, performs object detection, and saves the visualization to `output.jpg`.

### Custom Bounding Box Rendering

```python
python yolo2.py
```
This script performs detection on a static image but adds custom bounding boxes and labels to the output.

### Real-time Webcam Detection

```python
python yolo3.py
```
This script opens your webcam and performs real-time object detection. Press 'q' to quit.

## Notes

YOLO (You Only Look Once) is a state-of-the-art object detection algorithm that processes the entire image in a single forward pass, combining localization and classification. This is more efficient than traditional approaches like sliding windows, RCNN, Faster RCNN, and Fast RCNN.

## License

MIT