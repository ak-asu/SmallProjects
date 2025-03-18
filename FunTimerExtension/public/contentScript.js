function startBalloonsAnimation() {
    const balloonContainer = document.createElement("div");
    balloonContainer.className = "balloon-container";
    document.body.appendChild(balloonContainer);
    for (let i = 0; i < 5; i++) {
        const balloon = document.createElement("div");
        balloon.className = "balloon";
        balloon.style.left = `${Math.random() * 100}vw`;
        balloon.style.animationDelay = `${Math.random() * 3}s`;
        balloonContainer.appendChild(balloon);
    }
    setTimeout(() => {
        balloonContainer.remove();
    }, 7000);
}

function startRocketsAnimation() {
    const rocketContainer = document.createElement("div");
    rocketContainer.className = "rocket-container";
    document.body.appendChild(rocketContainer);
    for (let i = 0; i < 5; i++) {
        const rocket = document.createElement("div");
        rocket.className = "rocket";
        rocket.style.left = `${Math.random() * 100}vw`;
        rocket.style.animationDelay = `${Math.random() * 3}s`;
        rocketContainer.appendChild(rocket);
    }
    setTimeout(() => {
        rocketContainer.remove();
    }, 7000);
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "TRIGGER_ANIMATION") {
        const animationType = message.animation;
        if (animationType === "balloons") {
            startBalloonsAnimation();
        } else if (animationType === "rockets") {
            startRocketsAnimation();
        }
        sendResponse({ status: "Animation started" });
    } else {
        sendResponse({ status: "Unknown message type" });
    }
    return true;
});
