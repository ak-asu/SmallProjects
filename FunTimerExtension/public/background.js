chrome.runtime.onInstalled.addListener(() => {
    loadTimers();
});

chrome.alarms.onAlarm.addListener((alarm) => {
    const timerId = alarm.name;
    chrome.storage.local.get([timerId], function (result) {
        const timerData = result[timerId];
        if (timerData) {
            triggerAnimation(timerData.animation, timerData.triggerAllTabs);
            if (timerData.repeat) {
                setTimer(timerData);
            } else {
                removeTimer(timerId);
            }
        }
    });
});

function loadTimers() {
    chrome.storage.local.get('timers', function (result) {
        const timers = result.timers || [];
        timers.forEach(timer => {
            setTimer(timer);
        });
    });
}

function setTimer(timerData) {
    const timeLeft = (new Date(timerData.timer) - new Date()) / 60000; // Convert milliseconds to minutes
    chrome.alarms.create(timerData.id.toString(), {
        delayInMinutes: timeLeft,
    });
    chrome.storage.local.set({ [timerData.id]: timerData }, function () {});
}

function triggerAnimation(animationType, triggerAllTabs) {
    if (triggerAllTabs) {
        chrome.tabs.query({}, (tabs) => {
            tabs.forEach((tab) => {
                if (tabs && tabs[0] && tabs[0].url && !tabs[0].url.startsWith('chrome://') && !tabs[0].url.startsWith('edge://')) {
                    chrome.scripting.executeScript({
                        target: { tabId: tab.id },
                        files: ['contentScript.js']
                    }, () => {
                        chrome.tabs.sendMessage(tab.id, { type: "TRIGGER_ANIMATION", animation: animationType }, (response) => {
                            if (chrome.runtime.lastError) {
                                console.error(chrome.runtime.lastError.message);
                            }
                        });
                    });
                }
            });
        });
    } else {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (!tabs || !tabs[0] || !tabs[0].url || tabs[0].url.startsWith('chrome://') || tabs[0].url.startsWith('edge://')) {
                console.warn('No valid active tab found for animation');
                return;
            }
            chrome.scripting.executeScript({
                target: { tabId: tabs[0].id },
                files: ['contentScript.js']
            }, () => {
                chrome.tabs.sendMessage(tabs[0].id, { type: "TRIGGER_ANIMATION", animation: animationType }, (response) => {
                    if (chrome.runtime.lastError) {
                        console.error(chrome.runtime.lastError.message);
                    }
                });
            });
        });
    }
}

function removeTimer(timerId) {
    chrome.storage.local.remove(timerId.toString(), function () {
        chrome.storage.local.get('timers', function (result) {
            let timers = result.timers || [];
            timers = timers.filter(timer => timer.id !== timerId);
            chrome.storage.local.set({ timers: timers }, function () {});
        });
    });
}

function saveTimers() {
    chrome.storage.local.get(null, function (result) {
        const timers = Object.keys(result).filter(key => key !== 'timers').map(key => result[key]);
        chrome.storage.local.set({ timers: timers }, function () {});
    });
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.command === 'createTimer') {
        setTimer(request.timerData);
    } else if (request.command === 'removeTimer') {
        removeTimer(request.timerId);
    }
});
