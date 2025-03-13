from ultralytics import YOLO
import cv2
import numpy as np
cap = cv2.VideoCapture(0)
cap.set(3, 1280)
cap.set(4, 720)
model = YOLO('yolov8m.pt')
while True:
    ret, frame = cap.read()
    if not ret:
        break
    results = model(frame)[0]
    for result in results.boxes.data.tolist():
        x1, y1, x2, y2, score, class_id = result
        class_name = results.names[int(class_id)]
        cv2.rectangle(frame, (int(x1), int(y1)), (int(x2), int(y2)), (0, 0, 0), 2)
        cv2.putText(frame, f'{class_name} {score:.2f}', (int(x1), int(y1)), cv2.FONT_HERSHEY_SIMPLEX, 2, (255, 0, 0), 6)
    cv2.imshow('frame', frame)
    if cv2.waitKey(1) & 0xFF == ord('q'):
        cap.release()
        cv2.destroyAllWindows()
        exit(0)
