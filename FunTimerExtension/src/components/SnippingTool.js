export function startSnippingTool(callback) {
  const overlay = document.createElement("div");
  overlay.className = "snipping-overlay";
  document.body.appendChild(overlay);

  let startX, startY, endX, endY;
  let selecting = false;

  overlay.addEventListener("mousedown", (e) => {
    selecting = true;
    startX = e.clientX;
    startY = e.clientY;
  });

  overlay.addEventListener("mousemove", (e) => {
    if (!selecting) return;
    endX = e.clientX;
    endY = e.clientY;
    overlay.style.clipPath = `polygon(${startX}px ${startY}px, ${endX}px ${startY}px, ${endX}px ${endY}px, ${startX}px ${endY}px)`;
  });

  overlay.addEventListener("mouseup", () => {
    selecting = false;
    overlay.remove();
    callback({ startX, startY, endX, endY });
  });
}
