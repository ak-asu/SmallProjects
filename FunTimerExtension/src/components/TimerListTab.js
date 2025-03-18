import React, { useState, useEffect } from "react";
import "./timerListTab.css";
import { MESSAGES, STORAGE_KEYS } from "../utils/constants.js";

const TimerListTab = () => {
  const [timers, setTimers] = useState([]);

  useEffect(() => {
    const storedTimers = JSON.parse(localStorage.getItem(STORAGE_KEYS.TIMERS)) || [];
    setTimers(storedTimers.sort((a, b) => new Date(a.timer) - new Date(b.timer)));
  }, []);

  const deleteTimer = (id) => {
    const updatedTimers = timers.filter((timer) => timer.id !== id);
    localStorage.setItem(STORAGE_KEYS.TIMERS, JSON.stringify(updatedTimers));
    setTimers(updatedTimers);
    chrome.runtime.sendMessage({ command: MESSAGES.REMOVE_TIMER, timerId: id });
  };

  return (
    <div className="timer-list-container">
      {timers.length === 0 && <p className="no-timers">No timers set</p>}
      {timers.length > 0 && <button onClick={() => localStorage.clear()}>Delete All</button>}
      {timers.map((timer) => (
        <div key={timer.id} className="timer-item">
          <span>{timer.name} - {timer.timer}</span>
          <button onClick={() => deleteTimer(timer.id)}>Edit</button>
          <button onClick={() => deleteTimer(timer.id)}>Delete</button>
        </div>
      ))}
    </div>
  );
};

export default TimerListTab;
