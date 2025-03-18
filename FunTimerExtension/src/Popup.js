import React, { useEffect, useState } from "react";
import ConfigTab from "./components/ConfigTab.js";
import TimerListTab from "./components/TimerListTab.js";


const Popup = () => {
  const [activeTab, setActiveTab] = useState("config");

  return (
    <div className="popup-container">
      <div className="tab-buttons">
        <button
          className={activeTab === "config" ? "active" : ""}
          onClick={() => setActiveTab("config")}
        >
          Configuration
        </button>
        <button
          className={activeTab === "timers" ? "active" : ""}
          onClick={() => setActiveTab("timers")}
        >
          Timers
        </button>
      </div>
      <div className="tab-content">
        {activeTab === "config" ? <ConfigTab /> : <TimerListTab />}
      </div>
    </div>
  );
};

export default Popup;
