import React, { useState } from "react";
import "./configTab.css";
import { ANIMATIONS, MESSAGES, STORAGE_KEYS } from "../utils/constants.js";


const ConfigTab = () => {
  const [name, setName] = useState("");
  const [timer, setTimer] = useState("");
  const [animation, setAnimation] = useState(ANIMATIONS.BALLOONS);
  const [region, setRegion] = useState("full-screen");
  const [repeat, setRepeat] = useState(false);
  const [coordinates, setCoordinates] = useState(null);
  const [triggerAllTabs, setTriggerAllTabs] = useState(false);

  const saveConfig = () => {
    const newConfig = {
        id: Date.now(),
        name,
        timer,
        animation,
        region,
        repeat,
        coordinates,
        triggerAllTabs,
    };
    const storedConfigs = JSON.parse(localStorage.getItem(STORAGE_KEYS.TIMERS)) || [];
    storedConfigs.push(newConfig);
    localStorage.setItem(STORAGE_KEYS.TIMERS, JSON.stringify(storedConfigs));
    chrome.runtime.sendMessage({ command: MESSAGES.CREATE_TIMER, timerData: newConfig });
    resetConfig();
  };

  const resetConfig = () => {
    setName("");
    setTimer("");
    setRepeat(false);
    setCoordinates(null);
  };

  return (
    <div className="config-tab-container">
      <input
        type="text"
        placeholder="Enter name"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <input
        type="datetime-local"
        value={timer}
        onChange={(e) => setTimer(e.target.value)}
      />
      <select value={animation} onChange={(e) => setAnimation(e.target.value)}>
        {Object.values(ANIMATIONS).map((anim) => (
          <option key={anim} value={anim}>
            {anim.charAt(0).toUpperCase() + anim.slice(1)}
          </option>
        ))}
      </select>
      <select value={region} onChange={(e) => setRegion(e.target.value)}>
        <option value="full-screen">Full Screen</option>
        <option value="selected-region">Selected Region</option>
      </select>
      <button onClick={() => setCoordinates(prompt("Enter region coords"))}>
        Snip Region
      </button>
      <label>
        Repeat:
        <input
          type="checkbox"
          checked={repeat}
          onChange={() => setRepeat(!repeat)}
        />
      </label>
      <label>
        Trigger on all tabs:
        <input
          type="checkbox"
          checked={triggerAllTabs}
          onChange={() => setTriggerAllTabs(!triggerAllTabs)}
        />
      </label>
      <button onClick={saveConfig}>Add</button>
      <button onClick={resetConfig}>Reset</button>
    </div>
  );
};

export default ConfigTab;
